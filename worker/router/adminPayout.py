"""
Admin Bulk Payout & Refund
- Smart disburse: tries eSewa first, falls back to Khalti, flags manual if both fail
- All money movements saved to payments collection
- Sandbox credentials pre-configured — swap for production when ready
"""

import uuid
import hmac
import hashlib
import base64
import httpx
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException, Form
from bson import ObjectId, errors as bson_errors

from worker.config.database import (
    collection, 
    collection_task,
    collection_worker,
    collection_payment,   # ← add to database.py: collection_payment = db["payments"]
    refund_collection, 
    
)
from worker.router import notifications
from worker.manager import websocket_manager

router = APIRouter(prefix="/api", tags=["admin-payouts"])

# ── eSewa Config ──────────────────────────────────────────────────────────────
ESEWA_MERCHANT_CODE = "EPAYTEST"
ESEWA_SECRET_KEY    = "8gBm/:&EnhH.1/q"
ESEWA_DISBURSE_URL  = "https://rc-epay.esewa.com.np/api/epay/merchant-api/v2/disbursement/"
# Production: "https://epay.esewa.com.np/api/epay/merchant-api/v2/disbursement/"

# ── Khalti Config ─────────────────────────────────────────────────────────────
KHALTI_SECRET_KEY   = "39a74e06a31f4c99abf2bcaf061c190d"
KHALTI_DISBURSE_URL = "https://khalti.com/api/v2/disbursement/"
# Sandbox: "https://dev.khalti.com/api/v2/disbursement/"


# ══════════════════════════════════════════════════════════════════════════════
# GATEWAY HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _esewa_signature(message: str) -> str:
    key    = ESEWA_SECRET_KEY.encode("utf-8")
    msg    = message.encode("utf-8")
    digest = hmac.new(key, msg, hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")


async def _call_esewa(phone: str, amount: float, transaction_uuid: str) -> dict:
    message   = f"total_amount={amount},transaction_uuid={transaction_uuid},product_code={ESEWA_MERCHANT_CODE}"
    signature = _esewa_signature(message)
    payload   = {
        "product_code":     ESEWA_MERCHANT_CODE,
        "transaction_uuid": transaction_uuid,
        "total_amount":     str(amount),
        "esewa_id":         phone,
        "signature":        signature,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            ESEWA_DISBURSE_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
        )
    return {"status_code": resp.status_code, "body": resp.json() if resp.content else {}}


async def _call_khalti(phone: str, amount: float, transaction_uuid: str) -> dict:
    payload = {
        "token":             KHALTI_SECRET_KEY,
        "identity":          phone,
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
    phone:            str,
    amount:           float,
    transaction_uuid: str,
    sandbox:          bool = True,
) -> dict:
    """
    Try eSewa first → fallback to Khalti → flag manual if both fail.
    Returns: { method, status, transaction_uuid, gateway_ref, attempts }
    """
    if sandbox:
        return {
            "method":           "esewa",
            "status":           "success",
            "transaction_uuid": transaction_uuid,
            "gateway_ref":      f"SANDBOX-{transaction_uuid[:8]}",
            "attempts":         [{"method": "esewa", "status": "success", "at": datetime.utcnow().isoformat()}],
        }

    attempts = []

    # ── Try eSewa ─────────────────────────────────────────────────────────────
    try:
        result = await _call_esewa(phone, amount, transaction_uuid)
        attempt = {
            "method":      "esewa",
            "status_code": result["status_code"],
            "body":        result["body"],
            "at":          datetime.utcnow().isoformat(),
        }
        if result["status_code"] == 200 and result["body"].get("status") == "SUCCESS":
            attempt["status"] = "success"
            attempts.append(attempt)
            return {
                "method":           "esewa",
                "status":           "success",
                "transaction_uuid": transaction_uuid,
                "gateway_ref":      result["body"].get("ref_id", ""),
                "attempts":         attempts,
            }
        attempt["status"] = "failed"
        attempts.append(attempt)
    except Exception as e:
        attempts.append({"method": "esewa", "status": "error", "error": str(e), "at": datetime.utcnow().isoformat()})

    # ── Try Khalti ────────────────────────────────────────────────────────────
    try:
        khalti_uuid = str(uuid.uuid4())
        result      = await _call_khalti(phone, amount, khalti_uuid)
        attempt     = {
            "method":      "khalti",
            "status_code": result["status_code"],
            "body":        result["body"],
            "at":          datetime.utcnow().isoformat(),
        }
        if result["status_code"] == 200:
            attempt["status"] = "success"
            attempts.append(attempt)
            return {
                "method":           "khalti",
                "status":           "success",
                "transaction_uuid": khalti_uuid,
                "gateway_ref":      result["body"].get("idx", ""),
                "attempts":         attempts,
            }
        attempt["status"] = "failed"
        attempts.append(attempt)
    except Exception as e:
        attempts.append({"method": "khalti", "status": "error", "error": str(e), "at": datetime.utcnow().isoformat()})

    # ── Both failed ───────────────────────────────────────────────────────────
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
    phone:            str  = "",
    transaction_uuid: str  = "",
    gateway_ref:      str  = "",
    attempts:         list = None,
    note:             str  = "",
    resolved_by:      str  = "",
) -> str:
    doc = {
        "task_id":          task_id,
        "type":             payment_type,
        "direction":        direction,
        "amount":           amount,
        "method":           method,
        "status":           status,
        "phone":            phone,
        "transaction_uuid": transaction_uuid,
        "gateway_ref":      gateway_ref,
        "attempts":         attempts or [],
        "note":             note,
        "resolved_by":      resolved_by,
        "created_at":       datetime.utcnow(),
        "resolved_at":      datetime.utcnow() if status in ("success", "manual_required") else None,
    }
    result = collection_payment.insert_one(doc)
    return str(result.inserted_id)


async def _notify(user_id: str, title: str, body: str, token: str, email: str, is_worker: bool, data: dict, ws_payload: dict):
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
    """
    Pay a single worker after escrow is released.
    Tries eSewa first → Khalti fallback → manual flag if both fail.
    """
    task = collection_task.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(404, "Task not found")
    if task.get("escrow_status") != "released":
        raise HTTPException(400, "Escrow not released yet")
    if task.get("payout_status") == "paid":
        raise HTTPException(400, "Already paid")

    amount    = task.get("worker_payout", 0)
    worker_id = task.get("assignedWorkerId")
    task_name = task.get("taskName") or task.get("taskDescrip", "your task")

    if not worker_id or amount <= 0:
        raise HTTPException(400, "Missing worker or invalid amount")

    worker = collection_worker.find_one({"email": worker_id})
    if not worker:
        raise HTTPException(404, "Worker not found")

    phone = worker.get("esewa_id") or worker.get("khalti_id") or worker.get("phoneNo")
    if not phone:
        raise HTTPException(400, "Worker has no eSewa/Khalti phone number registered")

    transaction_uuid = str(uuid.uuid4())
    disburse_result  = await smart_disburse(phone, amount, transaction_uuid, sandbox=sandbox)

    now           = datetime.utcnow()
    payout_status = "paid" if disburse_result["status"] == "success" else "manual_required"

    # ── Update task ───────────────────────────────────────────────────────────
    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "payout_status":      payout_status,
            "payout_method":      disburse_result["method"],
            "payout_transaction": disburse_result["transaction_uuid"],
            "payout_gateway_ref": disburse_result["gateway_ref"],
            "payout_at":          now,
            "sandbox_mode":       sandbox,
        }}
    )

    # ── Save payment record ───────────────────────────────────────────────────
    payment_id = save_payment(
        task_id=task_id,
        payment_type="worker_payout",
        direction="outbound",
        amount=amount,
        method=disburse_result["method"],
        status=disburse_result["status"],
        phone=phone,
        transaction_uuid=disburse_result["transaction_uuid"],
        gateway_ref=disburse_result["gateway_ref"],
        attempts=disburse_result["attempts"],
        resolved_by="auto" if disburse_result["status"] == "success" else "",
    )

    # ── Update worker earnings + notify if success ────────────────────────────
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
        "payment_id":       payment_id,
        "attempts":         disburse_result["attempts"],
        "manual_required":  disburse_result["status"] == "manual_required",
    }


@router.post("/payouts/{task_id}/mark-paid")
async def mark_payout_paid(task_id: str):
    """Legacy endpoint — marks a payout as manually paid without disbursement."""
    task = collection_task.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(404, "Task not found")
    if task.get("escrow_status") != "released":
        raise HTTPException(400, "Escrow not released yet")
    if task.get("payout_status") == "paid":
        raise HTTPException(400, "Already marked as paid")

    now       = datetime.utcnow()
    amount    = task.get("worker_payout", 0)
    worker_id = task.get("assignedWorkerId")
    task_name = task.get("taskName") or task.get("taskDescrip", "your task")

    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {"payout_status": "paid", "payout_method": "manual", "payout_at": now}}
    )

    worker = None
    if worker_id:
        collection_worker.update_one({"email": worker_id}, {"$inc": {"total_earnings": amount}})
        worker = collection_worker.find_one({"email": worker_id})

    # ── Save payment record ───────────────────────────────────────────────────
    save_payment(
        task_id=task_id,
        payment_type="worker_payout",
        direction="outbound",
        amount=amount,
        method="manual",
        status="success",
        phone=worker.get("phoneNo", "") if worker else "",
        resolved_by="admin",
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

    now = datetime.utcnow()
    collection_payment.update_one(
        {"_id": ObjectId(payment_id)},
        {"$set": {"status": "success", "method": "manual", "resolved_at": now, "resolved_by": "admin", "note": admin_note}}
    )
    task_id = p.get("task_id")
    if task_id:
        collection_task.update_one(
            {"_id": ObjectId(task_id)},
            {"$set": {"payout_status": "paid", "payout_method": "manual", "payout_at": now}}
        )
    return {"success": True, "message": "Manual payout marked as done", "payment_id": payment_id}


@router.post("/payouts/bulk")
async def bulk_payout(sandbox: bool = True):
    """Pay all pending workers in one shot with smart fallback."""
    tasks = list(collection_task.find({
        "escrow_status": "released",
        "payout_status": {"$nin": ["paid"]},
    }))
    if not tasks:
        return {"message": "No pending payouts found", "processed": 0}

    results   = []
    succeeded = 0
    failed    = 0

    for task in tasks:
        task_id   = str(task["_id"])
        worker_id = task.get("assignedWorkerId")
        amount    = task.get("worker_payout", 0)
        task_name = task.get("taskName") or task.get("taskDescrip", "your task")

        if not worker_id or amount <= 0:
            results.append({"task_id": task_id, "status": "skipped", "reason": "Missing worker or invalid amount"})
            failed += 1
            continue

        worker = collection_worker.find_one({"email": worker_id})
        if not worker:
            results.append({"task_id": task_id, "status": "skipped", "reason": "Worker not found"})
            failed += 1
            continue

        phone = worker.get("esewa_id") or worker.get("khalti_id") or worker.get("phoneNo")
        if not phone:
            results.append({"task_id": task_id, "status": "skipped", "reason": "Worker has no phone/eSewa/Khalti ID"})
            failed += 1
            continue

        transaction_uuid = str(uuid.uuid4())
        try:
            disburse_result = await smart_disburse(phone, amount, transaction_uuid, sandbox=sandbox)
            now             = datetime.utcnow()
            payout_status   = "paid" if disburse_result["status"] == "success" else "manual_required"

            collection_task.update_one(
                {"_id": ObjectId(task_id)},
                {"$set": {
                    "payout_status":      payout_status,
                    "payout_method":      disburse_result["method"],
                    "payout_transaction": disburse_result["transaction_uuid"],
                    "payout_gateway_ref": disburse_result["gateway_ref"],
                    "payout_at":          now,
                    "sandbox_mode":       sandbox,
                }}
            )

            save_payment(
                task_id=task_id,
                payment_type="worker_payout",
                direction="outbound",
                amount=amount,
                method=disburse_result["method"],
                status=disburse_result["status"],
                phone=phone,
                transaction_uuid=disburse_result["transaction_uuid"],
                gateway_ref=disburse_result["gateway_ref"],
                attempts=disburse_result["attempts"],
                resolved_by="auto" if disburse_result["status"] == "success" else "",
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
                succeeded += 1
            else:
                failed += 1

            results.append({
                "task_id":        task_id,
                "worker_email":   worker_id,
                "amount":         amount,
                "status":         payout_status,
                "method":         disburse_result["method"],
                "attempts":       disburse_result["attempts"],
                "sandbox_mode":   sandbox,
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

# @router.get("/refunds/pending")
# def get_pending_refunds():
#     refunds       = list(refund_collection.find({"status": "pending"}))
#     result        = []
#     total_approved = 0
#     for refund in refunds:
#         task_id      = refund.get("task_id")
#         task         = collection_task.find_one({"_id": ObjectId(task_id)}) if task_id else None
#         worker_email = task.get("assignedWorkerId") if task else None
#         worker       = collection_worker.find_one({"email": worker_email}) if worker_email else None
#         refund_amount = refund.get("amount_customer") or 0
#         result.append({
#             "refund_id":      str(refund["_id"]),
#             "task_id":        task_id,
#             "task_name":      task.get("taskName", "Unnamed Task") if task else "Unknown",
#             "customer_id":    refund.get("requester_id", ""),
#             "refund_amount":  refund_amount,
#             "penalty_amount": refund.get("amount_worker") or 0,
#             "refund_status":  refund.get("status", "pending"),
#             "reason":         refund.get("reason", ""),
#             "created_at":     str(refund.get("created_at", "")),
#             "worker_email":   worker_email,
#             "worker_name":    f"{worker.get('firstName',''')} {worker.get('lastName','')}".strip() if worker else None,
#         })
#         total_pending += refund_amount
#     return {"count": len(result), "total_pending_amount": total_pending, "refunds": result}


# @router.get("/refunds/approved")
# def get_approved_refunds():
#     refunds        = list(refund_collection.find({"status": "approved"}))
#     result         = []
#     total_approved = 0
#     for refund in refunds:
#         task_id      = refund.get("task_id")
#         task         = collection_task.find_one({"_id": ObjectId(task_id)}) if task_id else None
#         worker_email = task.get("assignedWorkerId") if task else None
#         worker       = collection_worker.find_one({"email": worker_email}) if worker_email else None
#         refund_amount = refund.get("amount_customer") or 0
#         result.append({
#             "refund_id":      str(refund["_id"]),
#             "task_id":        task_id,
#             "task_name":      task.get("taskName", "Unnamed Task") if task else "Unknown",
#             "customer_id":    refund.get("requester_id", ""),
#             "refund_amount":  refund_amount,
#             "penalty_amount": refund.get("amount_worker") or 0,
#             "refund_status":  refund.get("status", "approved"),
#             "reason":         refund.get("reason", ""),
#             "created_at":     str(refund.get("created_at", "")),
#             "worker_email":   worker_email,
#             "worker_name":    f"{worker.get('firstName',''')} {worker.get('lastName','')}".strip() if worker else None,
#         })
#         total_approved += refund_amount
#     return {"count": len(result), "total_approved_amount": total_approved, "refunds": result}


# @router.get("/refunds/rejected")
# def get_rejected_refunds():
#     refunds        = list(refund_collection.find({"status": "rejected"}))
#     result         = []
#     total_rejected = 0
#     for refund in refunds:
#         task_id      = refund.get("task_id")
#         task         = collection_task.find_one({"_id": ObjectId(task_id)}) if task_id else None
#         worker_email = task.get("assignedWorkerId") if task else None
#         worker       = collection_worker.find_one({"email": worker_email}) if worker_email else None
#         refund_amount = refund.get("amount_customer") or 0
#         result.append({
#             "refund_id":      str(refund["_id"]),
#             "task_id":        task_id,
#             "task_name":      task.get("taskName", "Unnamed Task") if task else "Unknown",
#             "customer_id":    refund.get("requester_id", ""),
#             "refund_amount":  refund_amount,
#             "penalty_amount": refund.get("amount_worker") or 0,
#             "refund_status":  refund.get("status", "rejected"),
#             "reason":         refund.get("reason", ""),
#             "created_at":     str(refund.get("created_at", "")),
#             "worker_email":   worker_email,
#             "worker_name":    f"{worker.get('firstName',''')} {worker.get('lastName','')}".strip() if worker else None,
#         })
#         total_rejected += refund_amount
#     return {"count": len(result), "total_rejected_amount": total_rejected, "refunds": result}


# @router.get("/refunds/history")
# def get_refund_history():
#     refunds        = list(refund_collection.find({"status": "refunded"}))
#     result         = []
#     total_refunded = 0
#     total_penalty  = 0
#     for refund in refunds:
#         task_id      = refund.get("task_id")
#         task         = collection_task.find_one({"_id": ObjectId(task_id)}) if task_id else None
#         worker_email = task.get("assignedWorkerId") if task else None
#         worker       = collection_worker.find_one({"email": worker_email}) if worker_email else None
#         refund_amount  = refund.get("amount_customer") or 0
#         penalty_amount = refund.get("amount_worker") or 0
#         result.append({
#             "refund_id":      str(refund["_id"]),
#             "task_id":        task_id,
#             "task_name":      task.get("taskName", "Unnamed Task") if task else "Unknown",
#             "customer_id":    refund.get("requester_id", ""),
#             "refund_amount":  refund_amount,
#             "penalty_amount": penalty_amount,
#             "reason":         refund.get("reason", ""),
#             "refunded_at":    str(refund.get("updated_at", "")),
#             "refunded_by":    refund.get("resolved_by", ""),
#             "worker_email":   worker_email,
#             "worker_name":    f"{worker.get('firstName',''')} {worker.get('lastName','')}".strip() if worker else None,
#         })
#         total_refunded += refund_amount
#         total_penalty  += penalty_amount
#     return {"count": len(result), "total_refunded": total_refunded, "total_penalty": total_penalty, "refunds": result}


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
            "phone":      p.get("phone"),
            "attempts":   p.get("attempts", []),
            "created_at": str(p.get("created_at", "")),
        })
    return {"count": len(result), "refunds": result}


@router.post("/refunds/bulk")
async def bulk_refund():
    """Process all pending refunds with smart fallback."""
    tasks = list(collection_task.find({
        "paymentStatus": "paid",
        "refundAmount":  {"$gt": 0},
        "$or": [
            {"refund_status": "pending_refund"},
            {"refund_status": {"$exists": False}},
        ]
    }))
    if not tasks:
        return {"message": "No pending refunds found", "processed": 0}

    results   = []
    succeeded = 0
    failed    = 0

    for task in tasks:
        task_id       = str(task["_id"])
        customer_id   = str(task.get("userId", ""))
        worker_id     = str(task.get("assignedWorkerId", ""))
        refund_amount = task.get("refundAmount", 0)
        penalty       = task.get("penaltyAmount", 0)
        task_name     = task.get("taskName", "your task")
        now           = datetime.utcnow()

        if refund_amount <= 0:
            results.append({"task_id": task_id, "status": "skipped", "reason": "Refund amount <= 0"})
            failed += 1
            continue

        try:
            # ── Fetch refund doc to get split amounts ─────────────────────────
            refund_doc = None
            amount_customer = refund_amount  # fallback: full amount to customer
            amount_worker   = 0              # fallback: nothing to worker

            try:
                refund_doc = db_refunds.find_one({"task_id": task_id})  # adjust collection name
                if refund_doc:
                    amount_customer = refund_doc.get("amount_customer", refund_amount)
                    amount_worker   = refund_doc.get("amount_worker", 0)
            except Exception:
                pass

            # ── Fetch customer ────────────────────────────────────────────────
            customer = None
            try:
                from ..config import database as db
                customer = db.collection.find_one({"_id": ObjectId(customer_id)})
            except Exception:
                pass

            phone = None
            if customer:
                phone = customer.get("esewa_ref_id") or customer.get("khalti_txn_id") or customer.get("phoneNo")

            transaction_uuid = str(uuid.uuid4())

            # ── Disburse to customer ──────────────────────────────────────────
            if phone and amount_customer > 0:
                disburse_result = await smart_disburse(phone, amount_customer, transaction_uuid, sandbox=False)
            else:
                disburse_result = {
                    "method": "none", "status": "manual_required",
                    "transaction_uuid": transaction_uuid, "gateway_ref": "",
                    "attempts": [{"method": "none", "status": "no_phone", "note": "Customer has no eSewa/Khalti ID"}],
                }

            refund_status = "refunded" if disburse_result["status"] == "success" else "manual_required"

            # ── Disburse to worker (their share) ──────────────────────────────
            worker_disburse_result = None
            worker_refund_status   = "skipped"

            if worker_id and amount_worker > 0:
                worker = None
                try:
                    worker = collection_worker.find_one({"_id": ObjectId(worker_id)})
                except Exception:
                    pass

                if worker:
                    worker_phone = (
                        worker.get("esewa_ref_id")
                        or worker.get("khalti_txn_id")
                        or worker.get("phoneNo")
                    )
                    worker_transaction_uuid = str(uuid.uuid4())

                    if worker_phone:
                        worker_disburse_result = await smart_disburse(
                            worker_phone, amount_worker, worker_transaction_uuid, sandbox=False
                        )
                    else:
                        worker_disburse_result = {
                            "method": "none", "status": "manual_required",
                            "transaction_uuid": worker_transaction_uuid, "gateway_ref": "",
                            "attempts": [{"method": "none", "status": "no_phone", "note": "Worker has no eSewa/Khalti ID"}],
                        }

                    worker_refund_status = (
                        "refunded" if worker_disburse_result["status"] == "success" else "manual_required"
                    )

                    save_payment(
                        task_id=task_id,
                        payment_type="worker_refund_share",
                        direction="outbound",
                        amount=amount_worker,
                        method=worker_disburse_result["method"],
                        status=worker_disburse_result["status"],
                        phone=worker_phone or "",
                        transaction_uuid=worker_disburse_result["transaction_uuid"],
                        gateway_ref=worker_disburse_result["gateway_ref"],
                        attempts=worker_disburse_result["attempts"],
                        resolved_by="auto" if worker_disburse_result["status"] == "success" else "",
                    )

                    # ── Notify worker of their payment ────────────────────────
                    worker_body = (
                        f"Your share of NPR {amount_worker:.2f} for '{task_name}' has been credited to your account."
                        if worker_disburse_result["status"] == "success"
                        else f"Your share of NPR {amount_worker:.2f} for '{task_name}' requires manual processing."
                    )
                    await _notify(
                        user_id=worker_id,
                        title="Payment Credited 💰" if worker_disburse_result["status"] == "success" else "Payment Pending 🔔",
                        body=worker_body,
                        token=worker.get("fcmToken"),
                        email=worker.get("email"),
                        is_worker=True,
                        data={"event_type": "worker_share_paid", "task_id": task_id, "amount": str(amount_worker)},
                        ws_payload={"type": "worker_share_paid", "taskId": task_id, "taskName": task_name, "amount": amount_worker},
                    )

            # ── Update task ───────────────────────────────────────────────────
            collection_task.update_one(
                {"_id": ObjectId(task_id)},
                {"$set": {
                    "refund_status":              refund_status,
                    "refund_method":              disburse_result["method"],
                    "refund_transaction":         disburse_result["transaction_uuid"],
                    "refunded_at":                now,
                    "refunded_by":                "admin",
                    "worker_refund_status":       worker_refund_status,
                    "worker_refund_amount":       amount_worker,
                    "worker_refund_transaction":  worker_disburse_result["transaction_uuid"] if worker_disburse_result else None,
                }}
            )

            # ── Save customer payment record ──────────────────────────────────
            save_payment(
                task_id=task_id,
                payment_type="refund",
                direction="outbound",
                amount=amount_customer,
                method=disburse_result["method"],
                status=disburse_result["status"],
                phone=phone or "",
                transaction_uuid=disburse_result["transaction_uuid"],
                gateway_ref=disburse_result["gateway_ref"],
                attempts=disburse_result["attempts"],
                resolved_by="auto" if disburse_result["status"] == "success" else "",
            )

            # ── Notify customer ───────────────────────────────────────────────
            if customer and disburse_result["status"] == "success":
                body = (
                    f"Your refund of NPR {amount_customer:.2f} for '{task_name}' has been processed."
                    + (f" NPR {penalty:.2f} retained as penalty." if penalty > 0 else "")
                )
                await _notify(
                    user_id=customer_id,
                    title="Refund Processed ✅",
                    body=body,
                    token=customer.get("fcmToken"),
                    email=customer.get("email"),
                    is_worker=False,
                    data={"event_type": "refund_processed", "task_id": task_id, "refund_amount": str(amount_customer)},
                    ws_payload={"type": "refund_processed", "taskId": task_id, "taskName": task_name, "refundAmount": amount_customer},
                )

            if disburse_result["status"] == "success":
                succeeded += 1
            else:
                failed += 1

            results.append({
                "task_id":              task_id,
                "status":               refund_status,
                "amount_customer":      amount_customer,
                "amount_worker":        amount_worker,
                "worker_refund_status": worker_refund_status,
                "penalty_amount":       penalty,
                "method":               disburse_result["method"],
                "attempts":             disburse_result["attempts"],
                "worker_attempts":      worker_disburse_result["attempts"] if worker_disburse_result else [],
            })

        except Exception as e:
            results.append({"task_id": task_id, "status": "failed", "reason": str(e)})
            failed += 1

    return {
        "message":   f"Bulk refund complete: {succeeded} succeeded, {failed} failed/manual",
        "succeeded": succeeded,
        "failed":    failed,
        "results":   results,
    }

@router.patch("/update-status/{refund_id}")
async def update_refund_status(
    refund_id:       str,
    status:          str             = Form(...),
    amount_customer: float | None    = Form(None),
    amount_worker:   float | None    = Form(None),
    admin_note:      str             = Form(""),
):
    """Approve or decline a refund request. On approval, disburses to customer AND worker."""
    
    print(f"\n[REFUND DEBUG] ========== UPDATE REFUND STATUS ==========")
    print(f"[REFUND DEBUG] refund_id: {refund_id}")
    print(f"[REFUND DEBUG] status: {status}")
    print(f"[REFUND DEBUG] amount_customer: {amount_customer}")
    print(f"[REFUND DEBUG] amount_worker: {amount_worker}")
    print(f"[REFUND DEBUG] admin_note: {admin_note}")
    
    if status not in ("approved", "declined"):
        raise HTTPException(400, "Invalid status. Must be 'approved' or 'declined'.")
 
    try:
        obj_id = ObjectId(refund_id)
    except bson_errors.InvalidId:
        raise HTTPException(400, "Invalid refund ID format.")
 
    refund = refund_collection.find_one({"_id": obj_id})
    if not refund:
        raise HTTPException(404, "Refund not found.")
    
    print(f"[REFUND DEBUG] Refund found: {refund.get('_id')}")
    print(f"[REFUND DEBUG] Refund current status: {refund.get('status')}")
    print(f"[REFUND DEBUG] Refund requester_id: {refund.get('requester_id')}")
    print(f"[REFUND DEBUG] Refund task_id: {refund.get('task_id')}")
    
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
        
        print(f"[REFUND DEBUG] Task found: {task.get('_id')}")
        print(f"[REFUND DEBUG] Task assignedWorkerId: {task.get('assignedWorkerId')}")
        print(f"[REFUND DEBUG] Task userId: {task.get('userId')}")
        print(f"[REFUND DEBUG] Task totalCost: {task.get('totalCost')}")
        
        total_paid = float(task.get("totalCost") or task.get("basePrice") or 0)
        if amount_customer > total_paid:
            raise HTTPException(400, f"Refund ({amount_customer}) exceeds what the customer paid ({total_paid}).")
 
    now           = datetime.utcnow()
    task_name     = task.get("taskName", "your task") if task else "your task"
    penalty       = amount_worker or 0.0
 
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
 
        # ── 1. Fetch & disburse to CUSTOMER ──────────────────────────────────
        print(f"\n[REFUND DEBUG] === CUSTOMER DISBURSEMENT ===")
        customer        = None
        customer_obj_id = refund.get("requester_id") or (task.get("userId") if task else None)
        print(f"[REFUND DEBUG] customer_obj_id: {customer_obj_id}")
 
        try:
            from ..config import database as db
            customer = db.collection.find_one({"_id": ObjectId(str(customer_obj_id))})
        except Exception as e:
            print(f"[REFUND] Customer lookup failed: {e}")
 
        customer_phone = None
        if customer:
            print(f"[REFUND DEBUG] Customer found: {customer.get('email')}")
            customer_phone = customer.get("esewa_id") or customer.get("khalti_id") or customer.get("phoneNo")
            print(f"[REFUND DEBUG] Customer phone: {customer_phone}")
        else:
            print(f"[REFUND DEBUG] Customer NOT found!")
 
        customer_txn_uuid = str(uuid.uuid4())
 
        if customer_phone:
            customer_disburse_result = await smart_disburse(
                customer_phone, amount_customer, customer_txn_uuid, sandbox=True  # Changed to True for testing
            )
        else:
            customer_disburse_result = {
                "method": "none", "status": "manual_required",
                "transaction_uuid": customer_txn_uuid, "gateway_ref": "",
                "attempts": [{"method": "none", "status": "no_phone", "note": "Customer has no eSewa/Khalti ID"}],
            }
        
        print(f"[REFUND DEBUG] Customer disbursement result: {customer_disburse_result}")
 
        update_fields["refund_method"]      = customer_disburse_result["method"]
        update_fields["refund_status"]      = customer_disburse_result["status"]
        update_fields["refund_transaction"] = customer_disburse_result["transaction_uuid"]
        update_fields["refund_gateway_ref"] = customer_disburse_result["gateway_ref"]
 
        save_payment(
            task_id=task_id_str or "",
            payment_type="refund",
            direction="outbound",
            amount=amount_customer,
            method=customer_disburse_result["method"],
            status=customer_disburse_result["status"],
            phone=customer_phone or "",
            transaction_uuid=customer_disburse_result["transaction_uuid"],
            gateway_ref=customer_disburse_result["gateway_ref"],
            attempts=customer_disburse_result["attempts"],
            note=admin_note,
            resolved_by="auto" if customer_disburse_result["status"] == "success" else "",
        )
 
        # Notify customer
        if customer and customer_disburse_result["status"] == "success":
            body = (
                f"Your refund of NPR {amount_customer:.2f} for '{task_name}' has been approved."
                + (f" NPR {penalty:.2f} was retained as a penalty." if penalty > 0 else "")
            )
            await _notify(
                user_id=str(customer_obj_id),
                title="Refund Approved ✅",
                body=body,
                token=customer.get("fcmToken"),
                email=customer.get("email"),
                is_worker=False,
                data={"event_type": "refund_approved", "task_id": task_id_str or "", "refund_amount": str(amount_customer)},
                ws_payload={"type": "refund_approved", "taskId": task_id_str or "", "taskName": task_name, "refundAmount": amount_customer, "penaltyAmount": penalty},
            )
 
        # ── 2. Fetch & disburse to WORKER (penalty share) ─────────────────────
        print(f"\n[REFUND DEBUG] === WORKER DISBURSEMENT ===")
        if task:
            worker_id = task.get("assignedWorkerId")
            print(f"[REFUND DEBUG] worker_id from task: {worker_id}")
            print(f"[REFUND DEBUG] penalty amount: {penalty}")
            
            if worker_id:
                # Try multiple lookup methods for debugging
                print(f"[REFUND DEBUG] Attempting to find worker with _id: {worker_id}")
                worker_doc = collection_worker.find_one({"_id": worker_id})
                
                if not worker_doc:
                    print(f"[REFUND DEBUG] Not found with _id, trying with email: {worker_id}")
                    worker_doc = collection_worker.find_one({"email": worker_id})
                
                if not worker_doc:
                    print(f"[REFUND DEBUG] Not found with email, trying with id: {worker_id}")
                    worker_doc = collection_worker.find_one({"id": worker_id})
                
                print(f"[REFUND DEBUG] Worker lookup result: {'FOUND' if worker_doc else 'NOT FOUND'}")
                
                if worker_doc:
                    print(f"[REFUND DEBUG] Worker doc _id: {worker_doc.get('_id')}")
                    print(f"[REFUND DEBUG] Worker doc email: {worker_doc.get('email')}")
                    print(f"[REFUND DEBUG] Worker doc phoneNo: {worker_doc.get('phoneNo')}")
                    print(f"[REFUND DEBUG] Worker doc esewa_id: {worker_doc.get('esewa_id')}")
                    print(f"[REFUND DEBUG] Worker doc khalti_id: {worker_doc.get('khalti_id')}")
                    
                    worker_phone = (
                        worker_doc.get("esewa_id") or
                        worker_doc.get("khalti_id") or
                        worker_doc.get("phoneNo")
                    )
                    print(f"[REFUND DEBUG] Final worker_phone used: {worker_phone}")
 
                    if penalty > 0:
                        if worker_phone:
                            worker_txn_uuid = str(uuid.uuid4())
                            print(f"[REFUND DEBUG] Calling smart_disburse for worker with phone: {worker_phone}")
                            worker_disburse_result = await smart_disburse(
                                worker_phone, penalty, worker_txn_uuid, sandbox=True  # Changed to True for testing
                            )
                            print(f"[REFUND DEBUG] Worker disbursement result: {worker_disburse_result}")
                            
                            save_payment(
                                task_id=task_id_str or "",
                                payment_type="worker_penalty_payout",
                                direction="outbound",
                                amount=penalty,
                                method=worker_disburse_result["method"],
                                status=worker_disburse_result["status"],
                                phone=worker_phone,
                                transaction_uuid=worker_disburse_result["transaction_uuid"],
                                gateway_ref=worker_disburse_result["gateway_ref"],
                                attempts=worker_disburse_result["attempts"],
                                note=f"Worker share from refund approval on task {task_id_str}",
                                resolved_by="auto" if worker_disburse_result["status"] == "success" else "",
                            )
                            
                            if worker_disburse_result["status"] == "success":
                                collection_worker.update_one(
                                    {"_id": worker_doc["_id"]},
                                    {"$inc": {"total_earnings": penalty, "earnings": penalty}}
                                )
                                print(f"[REFUND DEBUG] Penalty of NPR {penalty:.2f} disbursed to worker {worker_id} successfully.")
                            else:
                                print(f"[REFUND DEBUG] Worker disbursement failed with status: {worker_disburse_result['status']}")
                        else:
                            print(f"[REFUND DEBUG] ERROR: Worker has NO PHONE NUMBER!")
                            worker_disburse_result = {
                                "method": "none", "status": "manual_required",
                                "transaction_uuid": "", "gateway_ref": "", "attempts": [],
                            }
                            save_payment(
                                task_id=task_id_str or "",
                                payment_type="worker_penalty_payout",
                                direction="outbound",
                                amount=penalty,
                                method="none",
                                status="manual_required",
                                phone="",
                                note="Worker has no eSewa/Khalti ID — manual transfer needed",
                                resolved_by="",
                            )
                    else:
                        print(f"[REFUND DEBUG] No penalty amount (penalty=0), skipping worker disbursement")
 
                    # Build worker notification body
                    if penalty > 0 and worker_disburse_result:
                        if worker_disburse_result["status"] == "success":
                            worker_notify_body = (
                                f"NPR {penalty:.2f} from '{task_name}' refund has been sent "
                                f"to your {worker_disburse_result['method'].upper()} account."
                            )
                        else:
                            worker_notify_body = (
                                f"NPR {penalty:.2f} from '{task_name}' refund could not be "
                                f"auto-sent — admin will process manually."
                            )
                    else:
                        worker_notify_body = (
                            f"A full refund of NPR {amount_customer:.2f} was issued for "
                            f"'{task_name}'. No penalty applied to you."
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
                else:
                    print(f"[REFUND DEBUG] CRITICAL: Worker NOT FOUND for worker_id: {worker_id}")
                    print(f"[REFUND DEBUG] This is why the worker phone is not being retrieved correctly!")
            else:
                print(f"[REFUND DEBUG] No worker_id in task")
        else:
            print(f"[REFUND DEBUG] No task object available")
 
        # ── 3. Update task status ─────────────────────────────────────────────
        if task_id_str:
            try:
                collection_task.update_one(
                    {"_id": ObjectId(task_id_str)},
                    {"$set": {"taskStatus": "refunded", "refund_resolved_at": now}}
                )
                print(f"[REFUND DEBUG] Task {task_id_str} updated to refunded")
            except Exception as e:
                print(f"[REFUND] Failed to update task: {e}")
 
    # ── Persist refund document update ────────────────────────────────────────
    refund_collection.update_one({"_id": obj_id}, {"$set": update_fields})
    print(f"[REFUND DEBUG] Refund {refund_id} updated with status: {status}")
    print(f"[REFUND DEBUG] ========== UPDATE REFUND STATUS COMPLETE ==========\n")
 
    return {
        "message":                f"Refund request {status} successfully.",
        "refund_id":              refund_id,
        "status":                 status,
        "amount_customer":        update_fields.get("amount_customer"),
        "amount_worker":          update_fields.get("amount_worker"),
        "admin_note":             admin_note,
        "resolved_at":            now.isoformat(),
        "customer_disburse":      customer_disburse_result,
        "worker_disburse":        worker_disburse_result,
    }


@router.get("/payouts/pending")
def get_pending_payouts():
    """All tasks with released escrow not yet paid."""
    tasks  = list(collection_task.find({
        "escrow_status": "released",
        "payout_status": {"$exists": False},
    }))
    result = []
    for task in tasks:
        task_id   = str(task["_id"])
        worker_id = task.get("assignedWorkerId")
        worker    = collection_worker.find_one({"email": worker_id}) if worker_id else None
        result.append({
            "task_id":        task_id,
            "task_name":      task.get("taskName") or task.get("taskDescrip", "Unnamed Task"),
            "worker_email":   worker_id,
            "worker_name":    f"{worker.get('firstName','')} {worker.get('lastName','')}".strip() if worker else "Unknown",
            "worker_phone":   worker.get("phoneNo") if worker else None,
            "worker_payout":  task.get("worker_payout", 0),
            "platform_fee":   task.get("platform_fee", 0),
            "total_cost":     task.get("totalCost", 0),
            "released_at":    str(task.get("released_at", "")),
            "payment_method": task.get("payment_method", ""),
        })
    return {"count": len(result), "total_amount": sum(t["worker_payout"] for t in result), "payouts": result}


@router.get("/payouts/manual-required")
def get_manual_required_payouts():
    """Payouts where both eSewa and Khalti failed — need manual bank transfer."""
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
            "phone":      p.get("phone"),
            "attempts":   p.get("attempts", []),
            "created_at": str(p.get("created_at", "")),
        })
    return {"count": len(result), "payouts": result}


@router.get("/payouts/history")
def get_payout_history():
    """Full payout history — all released tasks."""
    tasks  = list(collection_task.find({"escrow_status": "released"}))
    result = []
    for task in tasks:
        task_id   = str(task["_id"])
        worker_id = task.get("assignedWorkerId")
        worker    = collection_worker.find_one({"email": worker_id}) if worker_id else None
        result.append({
            "task_id":          task_id,
            "task_name":        task.get("taskName") or task.get("taskDescrip", "Unnamed Task"),
            "worker_email":     worker_id,
            "worker_name":      f"{worker.get('firstName','')} {worker.get('lastName','')}".strip() if worker else "Unknown",
            "worker_payout":    task.get("worker_payout", 0),
            "platform_fee":     task.get("platform_fee", 0),
            "total_cost":       task.get("totalCost", 0),
            "payout_status":    task.get("payout_status", "pending"),
            "payout_method":    task.get("payout_method", ""),
            "payout_at":        str(task.get("payout_at", "")),
            "released_at":      str(task.get("released_at", "")),
            "payment_method":   task.get("payment_method", ""),
            "transaction_uuid": task.get("payout_transaction", ""),
        })
    total_paid    = sum(t["worker_payout"] for t in result if t["payout_status"] == "paid")
    total_pending = sum(t["worker_payout"] for t in result if t["payout_status"] != "paid")
    return {"count": len(result), "total_paid": total_paid, "total_pending": total_pending, "payouts": result}


