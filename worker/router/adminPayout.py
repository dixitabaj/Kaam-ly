"""
Admin Bulk Payout & Refund
- Smart disburse: tries eSewa first, falls back to Khalti, flags manual if both fail
- All money movements saved to payments collection ONLY
- Task collection gets status flags ONLY
"""

import uuid
import hmac
import hashlib
import base64
import httpx
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException, Form, Depends
from bson import ObjectId, errors as bson_errors
from worker.repository.taskRepo import _send_email
from worker.config.database import (
    collection,
    collection_task,
    collection_worker,
    collection_payment,
    refund_collection,
)
from worker.router import notifications
from worker.manager import websocket_manager

from ..services.auth import require_admin

router = APIRouter(prefix="/api", tags=["admin-payouts"], dependencies=[Depends(require_admin)])

# ── eSewa Config ──────────────────────────────────────────────────────────────
ESEWA_MERCHANT_CODE = "EPAYTEST"
ESEWA_SECRET_KEY    = "8gBm/:&EnhH.1/q"
ESEWA_DISBURSE_URL  = "https://rc-epay.esewa.com.np/api/epay/merchant-api/v2/disbursement/"
# Production: "https://epay.esewa.com.np/api/epay/merchant-api/v2/disbursement/"

# ── Khalti Config ─────────────────────────────────────────────────────────────
KHALTI_SECRET_KEY   = "39a74e06a31f4c99abf2bcaf061c190d"
KHALTI_DISBURSE_URL = "https://khalti.com/api/v2/disbursement/"
# Sandbox: "https://dev.khalti.com/api/v2/disbursement/"
def send_worker_payment_email(worker_email: str, worker_name: str,
                               task_name: str, amount: float, 
                               method: str, transaction_uuid: str):
    subject = "💰 Payment Received — Kaamly"
    html = f"""
    <html>
      <body style="margin:0;padding:32px;background:#f9f6ef;
                   font-family:'Segoe UI',Arial,sans-serif;">
        <div style="max-width:520px;margin:0 auto;background:white;
                    border-radius:16px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <div style="background:linear-gradient(135deg,#059669,#047857);
                      padding:28px 32px;">
            <h1 style="margin:0;color:white;font-size:20px;font-weight:800;
                       letter-spacing:-0.02em;">💰 Payment Received</h1>
          </div>
          <div style="padding:28px 32px;">
            <p style="color:#1c1008;font-size:15px;margin:0 0 16px;">
              Hi <strong>{worker_name}</strong>,
            </p>
            <p style="color:#57534e;font-size:14px;line-height:1.75;margin:0 0 20px;">
              Your payment for <strong>"{task_name}"</strong> has been successfully
              sent to your <strong>{method.upper()}</strong> account.
            </p>
            <div style="background:#f0fdf4;border:1px solid #a7f3d0;
                        border-radius:12px;padding:18px 24px;margin-bottom:24px;">
              <span style="font-size:13px;font-weight:700;color:#065f46;">
                Amount Received:
              </span>
              <span style="font-size:20px;font-weight:900;color:#059669;margin-left:12px;">
                NPR {amount:,.2f}
              </span>
            </div>
            <p style="color:#a8a29e;font-size:12px;margin:0;">
              Transaction ID:&nbsp;
              <code style="background:#f5efe6;padding:2px 8px;
                           border-radius:4px;font-size:11px;">{transaction_uuid}</code>
            </p>
          </div>
          <div style="background:#faf7f2;padding:14px 32px;
                      border-top:1px solid #f0ebe2;text-align:center;">
            <p style="margin:0;font-size:11px;color:#a8a29e;">
              This is an automated message — please do not reply.
            </p>
          </div>
        </div>
      </body>
    </html>
    """
    _send_email(worker_email, subject, html)

# ══════════════════════════════════════════════════════════════════════════════
# GATEWAY HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _esewa_signature(message: str) -> str:
    key    = ESEWA_SECRET_KEY.encode("utf-8")
    msg    = message.encode("utf-8")
    digest = hmac.new(key, msg, hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")


async def _call_esewa(account_id: str, amount: float, transaction_uuid: str) -> dict:
    message   = f"total_amount={amount},transaction_uuid={transaction_uuid},product_code={ESEWA_MERCHANT_CODE}"
    signature = _esewa_signature(message)
    payload   = {
        "product_code":     ESEWA_MERCHANT_CODE,
        "transaction_uuid": transaction_uuid,
        "total_amount":     str(amount),
        "esewa_id":         account_id,
        "signature":        signature,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            ESEWA_DISBURSE_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
        )
    return {"status_code": resp.status_code, "body": resp.json() if resp.content else {}}


async def _call_khalti(account_id: str, amount: float, transaction_uuid: str) -> dict:
    payload = {
        "token":             KHALTI_SECRET_KEY,
        "identity":          account_id,
        "amount":            int(amount * 100),   # paisa
        "remarks":           f"Payout {transaction_uuid}",
        "purchase_order_id": transaction_uuid,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            KHALTI_DISBURSE_URL,
            json=payload,
            headers={
                "Authorization": f"Key {KHALTI_SECRET_KEY}",
                "Content-Type":  "application/json",
            },
        )
    return {"status_code": resp.status_code, "body": resp.json() if resp.content else {}}


async def smart_disburse(
    account_id:       str,
    amount:           float,
    transaction_uuid: str,
    sandbox:          bool = True,
    preferred_method: str  = None,
) -> dict:
    """
    Try preferred method first → fallback to other → flag manual if both fail.
    Returns: { method, status, transaction_uuid, gateway_ref, attempts }
    """
    if sandbox:
        return {
            "method":           preferred_method or "esewa",
            "status":           "success",
            "transaction_uuid": transaction_uuid,
            "gateway_ref":      f"SANDBOX-{transaction_uuid[:8]}",
            "attempts":         [{"method": preferred_method or "esewa", "status": "success", "at": datetime.utcnow().isoformat()}],
        }

    attempts      = []
    methods       = ["khalti", "esewa"] if (preferred_method or "").lower() == "khalti" else ["esewa", "khalti"]
    current_uuid  = transaction_uuid

    for i, method in enumerate(methods):
        if i == 1:
            current_uuid = str(uuid.uuid4())  # fresh uuid for fallback
        try:
            result = await (_call_esewa if method == "esewa" else _call_khalti)(account_id, amount, current_uuid)
            attempt = {
                "method":      method,
                "status_code": result["status_code"],
                "body":        result["body"],
                "at":          datetime.utcnow().isoformat(),
            }
            success = (
                result["status_code"] == 200 and
                (result["body"].get("status") == "SUCCESS" if method == "esewa" else True)
            )
            attempt["status"] = "success" if success else "failed"
            attempts.append(attempt)
            if success:
                ref_key = "ref_id" if method == "esewa" else "idx"
                return {
                    "method":           method,
                    "status":           "success",
                    "transaction_uuid": current_uuid,
                    "gateway_ref":      result["body"].get(ref_key, ""),
                    "attempts":         attempts,
                }
        except Exception as e:
            attempts.append({"method": method, "status": "error", "error": str(e), "at": datetime.utcnow().isoformat()})

    return {
        "method":           "none",
        "status":           "manual_required",
        "transaction_uuid": transaction_uuid,
        "gateway_ref":      "",
        "attempts":         attempts,
    }


def save_payment(
    task_id:          str,
    payment_type:     str,
    direction:        str,
    amount:           float,
    method:           str,
    status:           str,
    account_id:       str  = "",
    transaction_uuid: str  = "",
    gateway_ref:      str  = "",
    attempts:         list = None,
    note:             str  = "",
    resolved_by:      str  = "",
    extra:            dict = None,
) -> str:
    doc = {
        "task_id":          task_id,
        "type":             payment_type,
        "direction":        direction,
        "amount":           amount,
        "method":           method,
        "status":           status,
        "account_id":       account_id,
        "transaction_uuid": transaction_uuid,
        "gateway_ref":      gateway_ref,
        "attempts":         attempts or [],
        "note":             note,
        "resolved_by":      resolved_by,
        "created_at":       datetime.utcnow(),
        "resolved_at":      datetime.utcnow() if status in ("success", "manual_required") else None,
    }
    if extra:
        doc.update(extra)
    result = collection_payment.insert_one(doc)
    return str(result.inserted_id)


async def _notify(user_id, title, body, token, email, is_worker, data, ws_payload):
    try:
        await notifications.notify_with_fallback(
            userId=user_id, title=title, body=body,
            token=token, email=email, is_worker=is_worker, data=data,
        )
    except Exception as e:
        print(f"[NOTIFY] Push failed for {user_id}: {e}")
    try:
        await websocket_manager.manager.send_to_user(user_id, json.dumps(ws_payload))
    except Exception as e:
        print(f"[NOTIFY] WS failed for {user_id}: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# PAYOUT ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/payouts/{task_id}/pay")
async def pay_worker(task_id: str, sandbox: bool = True):
    """Pay a single worker after escrow is released."""
    task = collection_task.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(404, "Task not found")
    if task.get("escrow_status") != "released":
        raise HTTPException(400, "Escrow not released yet")
    if task.get("payout_status") == "paid":
        raise HTTPException(400, "Already paid")
    if task.get("dispute") == True or task.get("dispute") == "true":
        raise HTTPException(400, "Payment blocked — task has an open dispute.")

    # Pull worker_payout from payments collection, not task
    release_record = collection_payment.find_one(
        {"task_id": task_id, "type": "escrow_release", "status": "success"},
        sort=[("created_at", -1)]
    )
    if not release_record:
        raise HTTPException(400, "No escrow release record found")

    amount    = release_record.get("worker_payout") or release_record.get("amount", 0)
    worker_id = task.get("assignedWorkerId")
    task_name = task.get("taskName") or task.get("taskDescrip", "your task")

    if not worker_id or amount <= 0:
        raise HTTPException(400, "Missing worker or invalid amount")

    worker = collection_worker.find_one({"email": worker_id})
    if not worker:
        raise HTTPException(404, "Worker not found")

    payment_method = worker.get("paymentMethod")
    payment_id     = worker.get("paymentId")
    if not payment_method or not payment_id:
        raise HTTPException(400, "Worker has no payment information registered")

    transaction_uuid = str(uuid.uuid4())
    disburse_result  = await smart_disburse(payment_id, amount, transaction_uuid, sandbox=sandbox, preferred_method=payment_method.lower())

    now           = datetime.utcnow()
    payout_status = "paid" if disburse_result["status"] == "success" else "manual_required"

    # Task gets status flag ONLY
    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {"payout_status": payout_status}}
    )

    # All payout details go to payments collection
    payment_record_id = save_payment(
        task_id=task_id,
        payment_type="worker_payout",
        direction="outbound",
        amount=amount,
        method=disburse_result["method"],
        status=disburse_result["status"],
        account_id=payment_id,
        transaction_uuid=disburse_result["transaction_uuid"],
        gateway_ref=disburse_result["gateway_ref"],
        attempts=disburse_result["attempts"],
        resolved_by="auto" if disburse_result["status"] == "success" else "",
        extra={"paid_at": now, "sandbox_mode": sandbox},
    )

    if disburse_result["status"] == "success":
        collection_worker.update_one({"email": worker_id}, {"$inc": {"total_earnings": amount}})
        await _notify(
            user_id=worker_id,
            title="Payment Received 💰",
            body=f"NPR {amount:.2f} for '{task_name}' has been sent to your {disburse_result['method'].upper()} account.",
            token=worker.get("fcmToken"),
            email=worker.get("email"),
            is_worker=True,
            data={"event_type": "payout_sent", "task_id": task_id, "amount": str(amount)},
            ws_payload={"type": "payout_sent", "taskId": task_id, "taskName": task_name, "amount": amount},
        )

    return {
        "success":          disburse_result["status"] == "success",
        "payout_status":    payout_status,
        "method":           disburse_result["method"],
        "amount":           amount,
        "transaction_uuid": disburse_result["transaction_uuid"],
        "payment_id":       payment_record_id,
        "attempts":         disburse_result["attempts"],
        "manual_required":  disburse_result["status"] == "manual_required",
    }


@router.post("/payouts/{task_id}/mark-paid")
async def mark_payout_paid(task_id: str):
    """Admin manually marks a payout as paid without disbursement."""
    task = collection_task.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(404, "Task not found")
    if task.get("escrow_status") != "released":
        raise HTTPException(400, "Escrow not released yet")
    if task.get("payout_status") == "paid":
        raise HTTPException(400, "Already marked as paid")
    if task.get("dispute") == True or task.get("dispute") == "true":
        raise HTTPException(400, "Payment blocked — task has an open dispute.")

    # Pull amount from payments collection
    release_record = collection_payment.find_one(
        {"task_id": task_id, "type": "escrow_release", "status": "success"},
        sort=[("created_at", -1)]
    )
    amount    = (release_record.get("worker_payout") or release_record.get("amount", 0)) if release_record else 0
    worker_id = task.get("assignedWorkerId")
    task_name = task.get("taskName") or task.get("taskDescrip", "your task")
    now       = datetime.utcnow()

    # Task gets status flag ONLY
    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {"payout_status": "paid"}}
    )

    worker = collection_worker.find_one({"email": worker_id}) if worker_id else None
    if worker_id:
        collection_worker.update_one({"email": worker_id}, {"$inc": {"total_earnings": amount}})

    # All payout details go to payments collection
    save_payment(
        task_id=task_id,
        payment_type="worker_payout",
        direction="outbound",
        amount=amount,
        method="manual",
        status="success",
        account_id=worker.get("paymentId", "") if worker else "",
        resolved_by="admin",
        extra={"paid_at": now},
    )

    if worker:
        await _notify(
            user_id=worker_id,
            title="Payment Received 💰",
            body=f"NPR {amount:.2f} for '{task_name}' has been marked as paid.",
            token=worker.get("fcmToken"),
            email=worker.get("email"),
            is_worker=True,
            data={"event_type": "payout_sent", "task_id": task_id, "amount": str(amount)},
            ws_payload={"type": "payout_sent", "taskId": task_id, "taskName": task_name, "amount": amount},
        )

    return {"success": True, "message": "Payout marked as paid", "task_id": task_id, "worker_payout": amount}


@router.post("/payouts/{payment_id}/mark-manual-done")
async def mark_manual_payout_done(payment_id: str, admin_note: str = Form("")):
    """Admin confirms a manual bank transfer payout is complete."""
    p = collection_payment.find_one({"_id": ObjectId(payment_id)})
    if not p:
        raise HTTPException(404, "Payment record not found")
    if p.get("status") != "manual_required":
        raise HTTPException(400, "Payment is not in manual_required state")

    now     = datetime.utcnow()
    task_id = p.get("task_id")

    # Update payment record to success
    collection_payment.update_one(
        {"_id": ObjectId(payment_id)},
        {"$set": {
            "status":      "success",
            "method":      "manual",
            "resolved_at": now,
            "resolved_by": "admin",
            "note":        admin_note,
        }}
    )

    # Task gets status flag ONLY
    if task_id:
        collection_task.update_one(
            {"_id": ObjectId(task_id)},
            {"$set": {"payout_status": "paid"}}
        )

    return {"success": True, "message": "Manual payout marked as done", "payment_id": payment_id}


@router.post("/payouts/bulk")
async def bulk_payout(sandbox: bool = True):
    """Pay all pending workers in one shot with smart fallback."""
    tasks = list(collection_task.find({
        "escrow_status": "released",
        "payout_status": {"$nin": ["paid"]},
        "dispute":       {"$nin": [True, "true"]},
    }))
    if not tasks:
        return {"message": "No pending payouts found", "processed": 0}

    results   = []
    succeeded = 0
    failed    = 0

    for task in tasks:
        task_id   = str(task["_id"])
        worker_id = task.get("assignedWorkerId")
        task_name = task.get("taskName") or task.get("taskDescrip", "your task")

        # Pull amount from payments collection
        release_record = collection_payment.find_one(
            {"task_id": task_id, "type": "escrow_release", "status": "success"},
            sort=[("created_at", -1)]
        )
        amount = (release_record.get("worker_payout") or release_record.get("amount", 0)) if release_record else 0

        if not worker_id or amount <= 0:
            results.append({"task_id": task_id, "status": "skipped", "reason": "Missing worker or invalid amount"})
            failed += 1
            continue

        worker = collection_worker.find_one({"email": worker_id})
        if not worker:
            results.append({"task_id": task_id, "status": "skipped", "reason": "Worker not found"})
            failed += 1
            continue

        payment_method = worker.get("paymentMethod")
        payment_id     = worker.get("paymentId")
        if not payment_method or not payment_id:
            results.append({"task_id": task_id, "status": "skipped", "reason": "Worker has no payment information registered"})
            failed += 1
            continue

        transaction_uuid = str(uuid.uuid4())
        try:
            disburse_result = await smart_disburse(payment_id, amount, transaction_uuid, sandbox=sandbox, preferred_method=payment_method.lower())
            now             = datetime.utcnow()
            payout_status   = "paid" if disburse_result["status"] == "success" else "manual_required"

            # Task gets status flag ONLY
            collection_task.update_one(
                {"_id": ObjectId(task_id)},
                {"$set": {"payout_status": payout_status}}
            )

            # All payout details to payments collection
            save_payment(
                task_id=task_id,
                payment_type="worker_payout",
                direction="outbound",
                amount=amount,
                method=disburse_result["method"],
                status=disburse_result["status"],
                account_id=payment_id,
                transaction_uuid=disburse_result["transaction_uuid"],
                gateway_ref=disburse_result["gateway_ref"],
                attempts=disburse_result["attempts"],
                resolved_by="auto" if disburse_result["status"] == "success" else "",
                extra={"paid_at": now, "sandbox_mode": sandbox},
            )

            if disburse_result["status"] == "success":
                collection_worker.update_one({"email": worker_id}, {"$inc": {"total_earnings": amount}})
                await _notify(
                    user_id=worker_id,
                    title="Payment Received 💰",
                    body=f"NPR {amount:.2f} for '{task_name}' sent to your {disburse_result['method'].upper()} account.",
                    token=worker.get("fcmToken"),
                    email=worker.get("email"),
                    is_worker=True,
                    data={"event_type": "payout_sent", "task_id": task_id, "amount": str(amount)},
                    ws_payload={"type": "payout_sent", "taskId": task_id, "taskName": task_name, "amount": amount},
                )
                send_worker_payment_email(
                    worker_email     = worker["email"],
                    worker_name      = f"{worker.get('firstName','')} {worker.get('lastName','')}".strip() or "there",
                    task_name        = task_name,
                    amount           = amount,
                    method           = disburse_result["method"],
                    transaction_uuid = disburse_result["transaction_uuid"],
                )
                succeeded += 1
            else:
                failed += 1

            results.append({
                "task_id":      task_id,
                "worker_email": worker_id,
                "amount":       amount,
                "status":       payout_status,
                "method":       disburse_result["method"],
                "attempts":     disburse_result["attempts"],
            })

        except Exception as e:
            failed += 1
            results.append({"task_id": task_id, "worker_email": worker_id, "status": "error", "reason": str(e)})

    return {
        "message":   f"Bulk payout complete: {succeeded} succeeded, {failed} failed/manual",
        "succeeded": succeeded,
        "failed":    failed,
        "results":   results,
    }


# ══════════════════════════════════════════════════════════════════════════════
# REFUND ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/refunds/manual-required")
def get_manual_required_refunds():
    """Refunds where both eSewa and Khalti failed — need manual bank transfer."""
    payments = list(collection_payment.find({"type": "refund", "status": "manual_required"}))
    result   = []
    for p in payments:
        task_id = p.get("task_id")
        task    = collection_task.find_one({"_id": ObjectId(task_id)}) if task_id else None
        result.append({
            "payment_id": str(p["_id"]),
            "task_id":    task_id,
            "task_name":  task.get("taskName", "Unknown") if task else "Unknown",
            "amount":     p.get("amount"),
            "account_id": p.get("account_id"),
            "attempts":   p.get("attempts", []),
            "created_at": str(p.get("created_at", "")),
        })
    return {"count": len(result), "refunds": result}


# @router.post("/refunds/bulk")
# async def bulk_refund():
#     """Process all pending refunds with smart fallback."""
#     tasks = list(collection_task.find({
#         "paymentStatus": "paid",
#         "refundAmount":  {"$gt": 0},
#         "$or": [
#             {"refund_status": "pending_refund"},
#             {"refund_status": {"$exists": False}},
#         ]
#     }))
#     if not tasks:
#         return {"message": "No pending refunds found", "processed": 0}

#     results   = []
#     succeeded = 0
#     failed    = 0

#     for task in tasks:
#         task_id       = str(task["_id"])
#         customer_id   = str(task.get("userId", ""))
#         worker_id     = str(task.get("assignedWorkerId", ""))
#         refund_amount = task.get("refundAmount", 0)
#         penalty       = task.get("penaltyAmount", 0)
#         task_name     = task.get("taskName", "your task")
#         now           = datetime.utcnow()

#         if refund_amount <= 0:
#             results.append({"task_id": task_id, "status": "skipped", "reason": "Refund amount <= 0"})
#             failed += 1
#             continue

#         try:
#             refund_doc      = refund_collection.find_one({"task_id": task_id})
#             amount_customer = refund_doc.get("amount_customer", refund_amount) if refund_doc else refund_amount
#             amount_worker   = refund_doc.get("amount_worker", 0) if refund_doc else 0

#             # Get customer payment info from payments collection
#             customer_payment = collection_payment.find_one(
#                 {"task_id": task_id, "type": "customer_payment", "status": "success"},
#                 sort=[("created_at", -1)]
#             )
#             payment_method = customer_payment.get("method") if customer_payment else None
#             payment_id     = customer_payment.get("account_id") if customer_payment else None

#             transaction_uuid = str(uuid.uuid4())

#             if payment_method and payment_id and amount_customer > 0:
#                 disburse_result = await smart_disburse(payment_id, amount_customer, transaction_uuid, sandbox=False, preferred_method=payment_method.lower())
#             else:
#                 disburse_result = {
#                     "method": "none", "status": "manual_required",
#                     "transaction_uuid": transaction_uuid, "gateway_ref": "",
#                     "attempts": [{"method": "none", "status": "no_payment_info"}],
#                 }

#             refund_status = "refunded" if disburse_result["status"] == "success" else "manual_required"

#             # Task gets status flag ONLY
#             collection_task.update_one(
#                 {"_id": ObjectId(task_id)},
#                 {"$set": {"refund_status": refund_status}}
#             )

#             # Customer refund → payments collection
#             save_payment(
#                 task_id=task_id,
#                 payment_type="refund",
#                 direction="outbound",
#                 amount=amount_customer,
#                 method=disburse_result["method"],
#                 status=disburse_result["status"],
#                 account_id=payment_id or "",
#                 transaction_uuid=disburse_result["transaction_uuid"],
#                 gateway_ref=disburse_result["gateway_ref"],
#                 attempts=disburse_result["attempts"],
#                 resolved_by="auto" if disburse_result["status"] == "success" else "",
#                 extra={"refunded_at": now, "refunded_by": "admin", "penalty_amount": penalty},
#             )

#             # ── Worker share ──────────────────────────────────────────────────
#             worker_disburse_result = None
#             worker_refund_status   = "skipped"

#             if worker_id and amount_worker > 0:
#                 worker = collection_worker.find_one({"email": worker_id})
#                 if worker:
#                     worker_payment_method = worker.get("paymentMethod")
#                     worker_payment_id     = worker.get("paymentId")
#                     worker_txn_uuid       = str(uuid.uuid4())

#                     if worker_payment_method and worker_payment_id:
#                         worker_disburse_result = await smart_disburse(worker_payment_id, amount_worker, worker_txn_uuid, sandbox=False, preferred_method=worker_payment_method.lower())
#                     else:
#                         worker_disburse_result = {
#                             "method": "none", "status": "manual_required",
#                             "transaction_uuid": worker_txn_uuid, "gateway_ref": "",
#                             "attempts": [{"method": "none", "status": "no_payment_info"}],
#                         }

#                     worker_refund_status = "refunded" if worker_disburse_result["status"] == "success" else "manual_required"

#                     save_payment(
#                         task_id=task_id,
#                         payment_type="worker_refund_share",
#                         direction="outbound",
#                         amount=amount_worker,
#                         method=worker_disburse_result["method"],
#                         status=worker_disburse_result["status"],
#                         account_id=worker_payment_id or "",
#                         transaction_uuid=worker_disburse_result["transaction_uuid"],
#                         gateway_ref=worker_disburse_result["gateway_ref"],
#                         attempts=worker_disburse_result["attempts"],
#                         resolved_by="auto" if worker_disburse_result["status"] == "success" else "",
#                         extra={"paid_at": now},
#                     )

#                     if worker_disburse_result["status"] == "success":
#                         await _notify(
#                             user_id=worker_id,
#                             title="Payment Credited 💰",
#                             body=f"Your share of NPR {amount_worker:.2f} for '{task_name}' has been credited.",
#                             token=worker.get("fcmToken"),
#                             email=worker.get("email"),
#                             is_worker=True,
#                             data={"event_type": "worker_share_paid", "task_id": task_id, "amount": str(amount_worker)},
#                             ws_payload={"type": "worker_share_paid", "taskId": task_id, "taskName": task_name, "amount": amount_worker},
#                         )

#             # Notify customer
#             if disburse_result["status"] == "success":
#                 try:
#                     from ..config import database as db
#                     customer = db.collection.find_one({"_id": ObjectId(customer_id)})
#                     if customer:
#                         body = (
#                             f"Your refund of NPR {amount_customer:.2f} for '{task_name}' has been processed."
#                             + (f" NPR {penalty:.2f} retained as penalty." if penalty > 0 else "")
#                         )
#                         await _notify(
#                             user_id=customer_id, title="Refund Processed ✅", body=body,
#                             token=customer.get("fcmToken"), email=customer.get("email"),
#                             is_worker=False,
#                             data={"event_type": "refund_processed", "task_id": task_id, "refund_amount": str(amount_customer)},
#                             ws_payload={"type": "refund_processed", "taskId": task_id, "taskName": task_name, "refundAmount": amount_customer},
#                         )
#                 except Exception:
#                     pass

#             succeeded += 1 if disburse_result["status"] == "success" else 0
#             failed    += 0 if disburse_result["status"] == "success" else 1

#             results.append({
#                 "task_id":              task_id,
#                 "status":               refund_status,
#                 "amount_customer":      amount_customer,
#                 "amount_worker":        amount_worker,
#                 "worker_refund_status": worker_refund_status,
#                 "penalty_amount":       penalty,
#                 "method":               disburse_result["method"],
#             })

#         except Exception as e:
#             results.append({"task_id": task_id, "status": "failed", "reason": str(e)})
#             failed += 1

#     return {
#         "message":   f"Bulk refund complete: {succeeded} succeeded, {failed} failed/manual",
#         "succeeded": succeeded,
#         "failed":    failed,
#         "results":   results,
#     }


@router.patch("/update-status/{refund_id}")
async def update_refund_status(
    refund_id:       str,
    status:          str        = Form(...),
    amount_customer: float|None = Form(None),
    amount_worker:   float|None = Form(None),
    admin_note:      str        = Form(""),
):
    """Approve or decline a refund request. On approval, disburses to customer and worker."""
    if status not in ("approved", "declined"):
        raise HTTPException(400, "Invalid status. Must be 'approved' or 'declined'.")

    try:
        obj_id = ObjectId(refund_id)
    except bson_errors.InvalidId:
        raise HTTPException(400, "Invalid refund ID format.")

    refund = refund_collection.find_one({"_id": obj_id})
    if not refund:
        raise HTTPException(404, "Refund not found.")
    if refund.get("status") not in ("pending", None):
        raise HTTPException(400, f"Refund is already '{refund.get('status')}' and cannot be updated.")
    if status == "approved" and (amount_customer is None or amount_customer <= 0):
        raise HTTPException(400, "A positive customer refund amount is required for approval.")

    task        = None
    task_id_str = refund.get("task_id")

    if status == "approved":
        if not task_id_str:
            raise HTTPException(400, "No task linked to this refund.")
        try:
            task = collection_task.find_one({"_id": ObjectId(task_id_str)})
        except bson_errors.InvalidId:
            raise HTTPException(400, "Linked task has an invalid ID.")
        if not task:
            raise HTTPException(404, "Linked task not found.")

        total_paid = float(task.get("totalCost") or task.get("basePrice") or 0)
        if amount_customer > total_paid:
            raise HTTPException(400, f"Refund ({amount_customer}) exceeds what the customer paid ({total_paid}).")

    now       = datetime.utcnow()
    task_name = task.get("taskName", "your task") if task else "your task"
    penalty   = amount_worker or 0.0

    update_fields = {
        "status":      status,
        "admin_note":  admin_note,
        "resolved_at": now,
        "resolved_by": "admin",
    }

    customer_disburse_result = None
    worker_disburse_result   = None

    if status == "approved":
        update_fields["amount_customer"] = amount_customer
        update_fields["amount_worker"]   = penalty

        # ── 1. Disburse to CUSTOMER ───────────────────────────────────────────
        customer_obj_id = refund.get("requester_id") or (task.get("userId") if task else None)

        # Get customer payment info from payments collection
        customer_payment = collection_payment.find_one(
            {"task_id": task_id_str, "type": "customer_payment", "status": "success"},
            sort=[("created_at", -1)]
        )
        payment_method    = customer_payment.get("method") if customer_payment else None
        payment_id        = customer_payment.get("account_id") if customer_payment else None
        customer_txn_uuid = str(uuid.uuid4())

        if payment_method and payment_id:
            customer_disburse_result = await smart_disburse(payment_id, amount_customer, customer_txn_uuid, sandbox=True, preferred_method=payment_method.lower())
        else:
            customer_disburse_result = {
                "method": "none", "status": "manual_required",
                "transaction_uuid": customer_txn_uuid, "gateway_ref": "",
                "attempts": [{"method": "none", "status": "no_payment_info"}],
            }

        update_fields["refund_status"] = customer_disburse_result["status"]

        # Customer refund → payments collection
        save_payment(
            task_id=task_id_str or "",
            payment_type="refund",
            direction="outbound",
            amount=amount_customer,
            method=customer_disburse_result["method"],
            status=customer_disburse_result["status"],
            account_id=payment_id or "",
            transaction_uuid=customer_disburse_result["transaction_uuid"],
            gateway_ref=customer_disburse_result["gateway_ref"],
            attempts=customer_disburse_result["attempts"],
            note=admin_note,
            resolved_by="auto" if customer_disburse_result["status"] == "success" else "",
            extra={"refunded_at": now, "penalty_amount": penalty},
        )

        # Task gets status flag ONLY
        if task_id_str:
            collection_task.update_one(
                {"_id": ObjectId(task_id_str)},
                {"$set": {
                    "taskStatus":         "refunded",
                    "refund_status":      customer_disburse_result["status"],
                    "refund_resolved_at": now,
                }}
            )

        # Notify customer
        try:
            from ..config import database as db
            customer = db.collection.find_one({"_id": ObjectId(str(customer_obj_id))})
            if customer and customer_disburse_result["status"] == "success":
                body = (
                    f"Your refund of NPR {amount_customer:.2f} for '{task_name}' has been approved."
                    + (f" NPR {penalty:.2f} was retained as a penalty." if penalty > 0 else "")
                )
                await _notify(
                    user_id=str(customer_obj_id), title="Refund Approved ✅", body=body,
                    token=customer.get("fcmToken"), email=customer.get("email"),
                    is_worker=False,
                    data={"event_type": "refund_approved", "task_id": task_id_str or "", "refund_amount": str(amount_customer)},
                    ws_payload={"type": "refund_approved", "taskId": task_id_str or "", "taskName": task_name, "refundAmount": amount_customer, "penaltyAmount": penalty},
                )
        except Exception as e:
            print(f"[REFUND] Customer notify failed: {e}")

        # ── 2. Disburse to WORKER (penalty share) ─────────────────────────────
        if task:
            worker_id = task.get("assignedWorkerId")
            if worker_id and penalty > 0:
                worker_doc = (
                    collection_worker.find_one({"email": worker_id}) or
                    collection_worker.find_one({"_id": worker_id}) or
                    collection_worker.find_one({"id": worker_id})
                )
                if worker_doc:
                    worker_payment_method = worker_doc.get("paymentMethod")
                    worker_payment_id     = worker_doc.get("paymentId")
                    worker_txn_uuid       = str(uuid.uuid4())

                    if worker_payment_method and worker_payment_id:
                        worker_disburse_result = await smart_disburse(worker_payment_id, penalty, worker_txn_uuid, sandbox=True, preferred_method=worker_payment_method.lower())
                    else:
                        worker_disburse_result = {
                            "method": "none", "status": "manual_required",
                            "transaction_uuid": worker_txn_uuid, "gateway_ref": "", "attempts": [],
                        }

                    # Worker penalty → payments collection
                    save_payment(
                        task_id=task_id_str or "",
                        payment_type="worker_penalty_payout",
                        direction="outbound",
                        amount=penalty,
                        method=worker_disburse_result["method"],
                        status=worker_disburse_result["status"],
                        account_id=worker_payment_id or "",
                        transaction_uuid=worker_disburse_result["transaction_uuid"],
                        gateway_ref=worker_disburse_result["gateway_ref"],
                        attempts=worker_disburse_result["attempts"],
                        note=f"Worker penalty share from refund on task {task_id_str}",
                        resolved_by="auto" if worker_disburse_result["status"] == "success" else "",
                        extra={"paid_at": now},
                    )

                    if worker_disburse_result["status"] == "success":
                        collection_worker.update_one(
                            {"_id": worker_doc["_id"]},
                            {"$inc": {"total_earnings": penalty, "earnings": penalty}}
                        )

                    worker_notify_body = (
                        f"NPR {penalty:.2f} from '{task_name}' refund has been sent to your {worker_disburse_result['method'].upper()} account."
                        if worker_disburse_result["status"] == "success"
                        else f"NPR {penalty:.2f} from '{task_name}' refund could not be auto-sent — admin will process manually."
                    )
                    await _notify(
                        user_id=str(worker_doc["_id"]),
                        title="Refund Issued to Customer 🔔",
                        body=worker_notify_body,
                        token=worker_doc.get("fcmToken"),
                        email=worker_doc.get("email"),
                        is_worker=True,
                        data={"event_type": "refund_approved", "task_id": task_id_str or "", "penalty_amount": str(penalty)},
                        ws_payload={"type": "refund_approved", "taskId": task_id_str or "", "taskName": task_name, "penaltyAmount": penalty},
                    )

    refund_collection.update_one({"_id": obj_id}, {"$set": update_fields})

    return {
        "message":           f"Refund request {status} successfully.",
        "refund_id":         refund_id,
        "status":            status,
        "amount_customer":   update_fields.get("amount_customer"),
        "amount_worker":     update_fields.get("amount_worker"),
        "admin_note":        admin_note,
        "resolved_at":       now.isoformat(),
        "customer_disburse": customer_disburse_result,
        "worker_disburse":   worker_disburse_result,
    }

@router.post("/refunds/bulk")
async def bulk_refund():
    """Process all pending refunds with smart fallback."""
    # Include both pending, queued, AND approved/refund_in_progress
    pending_refunds = list(refund_collection.find({
        "status": {"$in": [ "queued", "approved", "refund_in_progress"]},
    }))

    if not pending_refunds:
        return {"message": "No pending refunds found", "processed": 0}

    results   = []
    succeeded = 0
    failed    = 0
    total_amount = 0

    for refund_doc in pending_refunds:
        task_id       = refund_doc.get("task_id")
        customer_id   = refund_doc.get("requester_id")
        worker_id     = refund_doc.get("reported_id")
        amount_customer = refund_doc.get("amount_customer") or 0
        amount_worker   = refund_doc.get("amount_worker") or 0
        now           = datetime.utcnow()

        # Skip if amount is 0
        if amount_customer <= 0 and amount_worker <= 0:
            results.append({"refund_id": str(refund_doc["_id"]), "status": "skipped", "reason": "No amount to refund"})
            continue

        try:
            task = collection_task.find_one({"_id": ObjectId(task_id)}) if task_id else None
            task_name = task.get("taskName", "your task") if task else "your task"

            customer_success = False
            worker_success = False
            customer_method = "none"
            worker_method = "none"

            # ── Customer refund ───────────────────────────────────────────────
            if amount_customer > 0:
                customer_payment = collection_payment.find_one(
                    {"task_id": str(task_id), "type": "customer_payment", "status": {"$in": ["success", "paid"]}},
                    sort=[("created_at", -1)],
                )
                payment_method = customer_payment.get("method") if customer_payment else None
                payment_id = customer_payment.get("account_id") if customer_payment else None
                customer_txn_uuid = str(uuid.uuid4())

                if payment_method and payment_id:
                    customer_disburse_result = await smart_disburse(
                        payment_id, amount_customer, customer_txn_uuid,
                        sandbox=False, preferred_method=payment_method.lower()
                    )
                    customer_success = customer_disburse_result["status"] == "success"
                    customer_method = customer_disburse_result["method"]
                else:
                    customer_success = False
                    customer_method = "none"

                # Save customer refund to payments collection
                save_payment(
                    task_id=task_id or "",
                    payment_type="refund",
                    direction="outbound",
                    amount=amount_customer,
                    method=customer_method,
                    status="success" if customer_success else "failed",
                    account_id=payment_id or "",
                    transaction_uuid=customer_txn_uuid,
                    resolved_by="auto" if customer_success else "",
                    extra={"refunded_at": now, "penalty_amount": amount_worker},
                )

            # ── Worker payout ──────────────────────────────────────────────────
            if worker_id and amount_worker > 0:
                worker_doc = (
                    collection_worker.find_one({"email": str(worker_id)}) or
                    collection_worker.find_one({"_id": ObjectId(str(worker_id))}) if ObjectId.is_valid(str(worker_id)) else None
                )
                if worker_doc:
                    worker_payment_method = worker_doc.get("paymentMethod")
                    worker_payment_id = worker_doc.get("paymentId")
                    worker_txn_uuid = str(uuid.uuid4())

                    if worker_payment_method and worker_payment_id:
                        worker_disburse_result = await smart_disburse(
                            worker_payment_id, amount_worker, worker_txn_uuid,
                            sandbox=False, preferred_method=worker_payment_method.lower()
                        )
                        worker_success = worker_disburse_result["status"] == "success"
                        worker_method = worker_disburse_result["method"]
                    else:
                        worker_success = False
                        worker_method = "none"

                    # Save worker payment
                    save_payment(
                        task_id=task_id or "",
                        payment_type="worker_refund_share",
                        direction="outbound",
                        amount=amount_worker,
                        method=worker_method,
                        status="success" if worker_success else "failed",
                        account_id=worker_payment_id or "",
                        transaction_uuid=worker_txn_uuid,
                        resolved_by="auto" if worker_success else "",
                        extra={"paid_at": now},
                    )

                    if worker_success:
                        collection_worker.update_one(
                            {"_id": worker_doc["_id"]},
                            {"$inc": {"total_earnings": amount_worker, "earnings": amount_worker}}
                        )

            # Update final status based on results
            if customer_success and (amount_worker == 0 or worker_success):
                final_status = "refunded"
                succeeded += 1
            elif customer_success or worker_success:
                final_status = "partially_refunded"
                succeeded += 1
            else:
                final_status = "failed"
                failed += 1

            total_amount += amount_customer if customer_success else 0

            # Update refund doc status
            refund_collection.update_one(
                {"_id": refund_doc["_id"]},
                {"$set": {
                    "status": final_status,
                    "refundStatus": final_status,
                    "resolved_at": now,
                    "resolved_by": "auto",
                }}
            )

            # Update task status flag
            if task_id:
                collection_task.update_one(
                    {"_id": ObjectId(task_id)},
                    {"$set": {"refund_status": final_status}}
                )

            results.append({
                "refund_id":         str(refund_doc["_id"]),
                "task_id":           task_id,
                "status":            final_status,
                "amount_customer":   amount_customer,
                "amount_worker":     amount_worker,
                "customer_success":  customer_success,
                "worker_success":    worker_success,
            })

        except Exception as e:
            failed += 1
            results.append({
                "refund_id": str(refund_doc["_id"]),
                "task_id": task_id,
                "status": "failed",
                "error": str(e)
            })

    return {
        "message":   f"Bulk refund complete: {succeeded} succeeded, {failed} failed",
        "succeeded": succeeded,
        "failed":    failed,
        "total_amount": total_amount,
        "results":   results,
    }# ══════════════════════════════════════════════════════════════════════════════
# READ ENDPOINTS — pull everything from payments collection
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/payouts/pending")
def get_pending_payouts():
    """All tasks with released escrow not yet paid."""
    tasks  = list(collection_task.find({"escrow_status": "released", "payout_status": {"$exists": False}}))
    result = []
    for task in tasks:
        task_id      = str(task["_id"])
        worker_id    = task.get("assignedWorkerId")
        worker       = collection_worker.find_one({"email": worker_id}) if worker_id else None
        # Pull amounts from payments collection
        release_rec  = collection_payment.find_one({"task_id": task_id, "type": "escrow_release", "status": "success"}, sort=[("created_at", -1)])
        worker_payout = release_rec.get("worker_payout") or release_rec.get("amount", 0) if release_rec else 0
 
        result.append({
            "task_id":        task_id,
            "task_name":      task.get("taskName") or task.get("taskDescrip", "Unnamed Task"),
            "worker_email":   worker_id,
            "worker_name":    f"{worker.get('firstName','')} {worker.get('lastName','')}".strip() if worker else "Unknown",
            "worker_payment_method": worker.get("paymentMethod", "N/A") if worker else "N/A",
            "worker_payment_id":     worker.get("paymentId", "N/A") if worker else "N/A",
            "worker_payout":  worker_payout,
            "platform_fee":   task.get("platformFee") or task.get("platform_fee") or 0, 
            "total_cost":     task.get("totalCost", 0),
            "released_at":    str(release_rec.get("releasedAt") or release_rec.get("created_at", "")) if release_rec else "",  # ← correct key
        })
    return {"count": len(result), "total_amount": sum(t["worker_payout"] for t in result), "payouts": result}


@router.get("/payouts/manual-required")
def get_manual_required_payouts():
    """Payouts where both gateways failed — need manual bank transfer."""
    payments = list(collection_payment.find({"type": "worker_payout", "status": "manual_required"}))
    result   = []
    for p in payments:
        task_id = p.get("task_id")
        task    = collection_task.find_one({"_id": ObjectId(task_id)}) if task_id else None
        result.append({
            "payment_id": str(p["_id"]),
            "task_id":    task_id,
            "task_name":  task.get("taskName", "Unknown") if task else "Unknown",
            "amount":     p.get("amount"),
            "account_id": p.get("account_id"),
            "attempts":   p.get("attempts", []),
            "created_at": str(p.get("created_at", "")),
        })
    return {"count": len(result), "payouts": result}

@router.get("/payouts/history")
def get_payout_history():
    """Full payout history — sourced entirely from payments collection."""
    payouts = list(collection_payment.find({"type": "worker_payout"}).sort("created_at", -1))
    result  = []
    for p in payouts:
        task_id   = p.get("task_id")
        task      = collection_task.find_one({"_id": ObjectId(task_id)}) if task_id else None
        worker_id = task.get("assignedWorkerId") if task else None
        worker    = collection_worker.find_one({"email": worker_id}) if worker_id else None
        
        # ← GET PLATFORM FEE FROM TASK (prefer platform_fee over platformFee)
        platform_fee = 0
        if task:
            platform_fee = task.get("platform_fee") or task.get("platformFee") or 0
        
        result.append({
            "payment_id":       str(p["_id"]),
            "task_id":          task_id,
            "task_name":        task.get("taskName") or task.get("taskDescrip", "Unnamed") if task else "Unknown",
            "worker_email":     worker_id,
            "worker_name":      f"{worker.get('firstName','')} {worker.get('lastName','')}".strip() if worker else "Unknown",
            "amount":           p.get("amount"),
            "platform_fee":     platform_fee,  # ← FROM TASK
            "method":           p.get("method"),
            "status":           p.get("status"),
            "transaction_uuid": p.get("transaction_uuid"),
            "gateway_ref":      p.get("gateway_ref"),
            "paid_at":          str(p.get("paid_at", "")),
            "created_at":       str(p.get("created_at", "")),
        })
    total_paid    = sum(p["amount"] for p in result if p["status"] == "success")
    total_pending = sum(p["amount"] for p in result if p["status"] != "success")
    return {"count": len(result), "total_paid": total_paid, "total_pending": total_pending, "payouts": result}