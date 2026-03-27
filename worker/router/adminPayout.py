"""
Admin Bulk Payout via eSewa Merchant Disbursement API
Sandbox credentials pre-configured — swap for production when ready.
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
from worker.config.database import collection_task, collection_worker, refund_collection
from worker.router import notifications
from worker.manager import websocket_manager

router = APIRouter(prefix="/api", tags=["admin-payouts"])

ESEWA_MERCHANT_CODE = "EPAYTEST"
ESEWA_SECRET_KEY    = "8gBm/:&EnhH.1/q"
ESEWA_DISBURSE_URL  = "https://rc-epay.esewa.com.np/api/epay/merchant-api/v2/disbursement/"


def generate_signature(message: str, secret: str) -> str:
    key    = secret.encode("utf-8")
    msg    = message.encode("utf-8")
    digest = hmac.new(key, msg, hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")


async def disburse_to_esewa(esewa_id: str, amount: float, transaction_uuid: str) -> dict:
    message   = f"total_amount={amount},transaction_uuid={transaction_uuid},product_code={ESEWA_MERCHANT_CODE}"
    signature = generate_signature(message, ESEWA_SECRET_KEY)
    payload = {
        "product_code":     ESEWA_MERCHANT_CODE,
        "transaction_uuid": transaction_uuid,
        "total_amount":     str(amount),
        "esewa_id":         esewa_id,
        "signature":        signature,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            ESEWA_DISBURSE_URL,
            json=payload,
            headers={"Content-Type": "application/json"}
        )
    return {
        "status_code": response.status_code,
        "body":        response.json() if response.content else {}
    }


# ── Pending payouts ───────────────────────────────────────────────────────────

@router.get("/payouts/pending")
def get_pending_payouts():
    tasks = list(collection_task.find({
        "escrow_status": "released",
        "payout_status": {"$exists": False}
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
            "worker_name":    f"{worker.get('firstName', '')} {worker.get('lastName', '')}".strip() if worker else "Unknown",
            "worker_esewa":   worker.get("phoneNo") if worker else None,
            "worker_payout":  task.get("worker_payout", 0),
            "platform_fee":   task.get("platform_fee", 0),
            "total_cost":     task.get("totalCost", 0),
            "released_at":    str(task.get("released_at", "")),
            "esewa_ref_id":   task.get("esewa_ref_id", ""),
            "payment_method": task.get("payment_method", ""),
        })
    total_amount = sum(t["worker_payout"] for t in result)
    return {"count": len(result), "total_amount": total_amount, "payouts": result}


# ── Mark single payout as paid ────────────────────────────────────────────────

@router.post("/payouts/{task_id}/mark-paid")
async def mark_payout_paid(task_id: str):
    task = collection_task.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.get("escrow_status") != "released":
        raise HTTPException(status_code=400, detail="Escrow not released yet")
    if task.get("payout_status") == "paid":
        raise HTTPException(status_code=400, detail="Already marked as paid")

    now       = datetime.utcnow()
    amount    = task.get("worker_payout", 0)
    worker_id = task.get("assignedWorkerId")
    task_name = task.get("taskName") or task.get("taskDescrip", "your task")

    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {"payout_status": "paid", "payout_at": now}}
    )

    worker = None
    if worker_id:
        collection_worker.update_one(
            {"email": worker_id},
            {"$inc": {"total_earnings": amount}}
        )
        worker = collection_worker.find_one({"email": worker_id})

    # ── Notify worker ─────────────────────────────────────────────────────────
    if worker:
        try:
            await notifications.notify_with_fallback(
                userId=worker_id,
                title="Payment Received 💰",
                body=f"NPR {amount:.2f} for '{task_name}' has been marked as paid.",
                token=worker.get("fcmToken"),
                email=worker.get("email"),
                is_worker=True,
                data={
                    "event_type": "payout_sent",
                    "task_id":    task_id,
                    "amount":     str(amount),
                },
            )
        except Exception as e:
            print(f"[MARK PAID] Worker push notification failed: {e}")

        try:
            await websocket_manager.manager.send_to_user(worker_id, json.dumps({
                "type":     "payout_sent",
                "taskId":   task_id,
                "taskName": task_name,
                "amount":   amount,
            }))
        except Exception as e:
            print(f"[MARK PAID] Worker WebSocket failed: {e}")

    return {
        "success":       True,
        "message":       "Payout marked as paid",
        "task_id":       task_id,
        "worker_payout": amount,
    }


# ── Payout history ────────────────────────────────────────────────────────────

@router.get("/payouts/history")
def get_payout_history():
    tasks = list(collection_task.find({"escrow_status": "released"}))
    result = []
    for task in tasks:
        task_id   = str(task["_id"])
        worker_id = task.get("assignedWorkerId")
        worker    = collection_worker.find_one({"email": worker_id}) if worker_id else None
        result.append({
            "task_id":          task_id,
            "task_name":        task.get("taskName") or task.get("taskDescrip", "Unnamed Task"),
            "worker_email":     worker_id,
            "worker_name":      f"{worker.get('firstName', '')} {worker.get('lastName', '')}".strip() if worker else "Unknown",
            "worker_payout":    task.get("worker_payout", 0),
            "platform_fee":     task.get("platform_fee", 0),
            "total_cost":       task.get("totalCost", 0),
            "payout_status":    task.get("payout_status", "pending"),
            "payout_at":        str(task.get("payout_at", "")),
            "released_at":      str(task.get("released_at", "")),
            "esewa_ref_id":     task.get("esewa_ref_id", ""),
            "payment_method":   task.get("payment_method", ""),
            "transaction_uuid": task.get("payout_transaction", ""),
        })
    total_paid    = sum(t["worker_payout"] for t in result if t["payout_status"] == "paid")
    total_pending = sum(t["worker_payout"] for t in result if t["payout_status"] == "pending")
    return {"count": len(result), "total_paid": total_paid, "total_pending": total_pending, "payouts": result}


# ── Bulk payout ───────────────────────────────────────────────────────────────

@router.post("/payouts/bulk")
async def bulk_payout(sandbox: bool = True):
    tasks = list(collection_task.find({
        "escrow_status": "released",
        "payout_status": {"$ne": "paid"}
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
            results.append({"task_id": task_id, "status": "skipped", "reason": "Worker not found in database"})
            failed += 1
            continue

        esewa_id = worker.get("phoneNo")
        if not esewa_id:
            results.append({"task_id": task_id, "worker_email": worker_id, "status": "skipped", "reason": "Worker has no eSewa ID registered"})
            failed += 1
            continue

        transaction_uuid = str(uuid.uuid4())
        try:
            if sandbox:
                esewa_response = {"status_code": 200, "body": {"status": "SUCCESS", "transaction_uuid": transaction_uuid}}
            else:
                esewa_response = await disburse_to_esewa(esewa_id, amount, transaction_uuid)

            if esewa_response["status_code"] == 200 and esewa_response["body"].get("status") == "SUCCESS":
                collection_task.update_one(
                    {"_id": ObjectId(task_id)},
                    {"$set": {
                        "payout_status":      "paid",
                        "payout_transaction": transaction_uuid,
                        "payout_at":          datetime.utcnow(),
                        "sandbox_mode":       sandbox,
                    }}
                )

                # ── Notify worker ─────────────────────────────────────────────
                try:
                    await notifications.notify_with_fallback(
                        userId=worker_id,
                        title="Payment Received 💰",
                        body=f"NPR {amount:.2f} for '{task_name}' has been sent to your eSewa account.",
                        token=worker.get("fcmToken"),
                        email=worker.get("email"),
                        is_worker=True,
                        data={
                            "event_type":       "payout_sent",
                            "task_id":          task_id,
                            "amount":           str(amount),
                            "transaction_uuid": transaction_uuid,
                        },
                    )
                except Exception as e:
                    print(f"[BULK PAYOUT] Worker push notification failed for {worker_id}: {e}")

                try:
                    await websocket_manager.manager.send_to_user(worker_id, json.dumps({
                        "type":            "payout_sent",
                        "taskId":          task_id,
                        "taskName":        task_name,
                        "amount":          amount,
                        "transactionUuid": transaction_uuid,
                    }))
                except Exception as e:
                    print(f"[BULK PAYOUT] Worker WebSocket failed for {worker_id}: {e}")
                # ─────────────────────────────────────────────────────────────

                succeeded += 1
                results.append({
                    "task_id":          task_id,
                    "worker_email":     worker_id,
                    "amount":           amount,
                    "transaction_uuid": transaction_uuid,
                    "status":           "success",
                    "sandbox_mode":     sandbox,
                    "esewa_response":   esewa_response["body"],
                })
            else:
                failed += 1
                results.append({
                    "task_id":        task_id,
                    "worker_email":   worker_id,
                    "amount":         amount,
                    "status":         "failed",
                    "sandbox_mode":   sandbox,
                    "esewa_response": esewa_response["body"],
                })
        except Exception as e:
            failed += 1
            results.append({
                "task_id":      task_id,
                "worker_email": worker_id,
                "status":       "error",
                "sandbox_mode": sandbox,
                "reason":       str(e),
            })

    return {
        "message":   f"Bulk payout complete: {succeeded} succeeded, {failed} failed",
        "succeeded": succeeded,
        "failed":    failed,
        "results":   results,
    }


# ── Bulk refund ───────────────────────────────────────────────────────────────

@router.post("/refunds/bulk")
async def bulk_refund():
    tasks = list(collection_task.find({
        "status":        "cancelled",
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
            collection_task.update_one(
                {"_id": ObjectId(task_id)},
                {"$set": {
                    "refund_status": "refunded",
                    "refunded_at":   now,
                    "refunded_by":   "admin",
                }}
            )

            # ── Notify customer ───────────────────────────────────────────────
            customer = None
            try:
                from ..config import database as db
                customer = db.collection_user.find_one({"_id": ObjectId(customer_id)})
            except Exception:
                pass

            if customer:
                if penalty > 0:
                    customer_body = f"Your refund of NPR {refund_amount:.2f} for '{task_name}' has been processed. NPR {penalty:.2f} retained as penalty."
                else:
                    customer_body = f"Your full refund of NPR {refund_amount:.2f} for '{task_name}' has been processed."

                try:
                    await notifications.notify_with_fallback(
                        userId=customer_id,
                        title="Refund Processed ✅",
                        body=customer_body,
                        token=customer.get("fcmToken"),
                        email=customer.get("email"),
                        is_worker=False,
                        data={"event_type": "refund_processed", "task_id": task_id, "refund_amount": str(refund_amount)},
                    )
                except Exception as e:
                    print(f"[BULK REFUND] Customer notification failed: {e}")

                try:
                    await websocket_manager.manager.send_to_user(customer_id, json.dumps({
                        "type":         "refund_processed",
                        "taskId":       task_id,
                        "taskName":     task_name,
                        "refundAmount": refund_amount,
                    }))
                except Exception as e:
                    print(f"[BULK REFUND] Customer WS failed: {e}")

            # ── Notify worker ─────────────────────────────────────────────────
            worker = None
            try:
                worker = collection_worker.find_one({"_id": ObjectId(worker_id)})
            except Exception:
                pass

            if worker:
                if penalty > 0:
                    worker_body = f"Customer refund for '{task_name}' processed. Penalty of NPR {penalty:.2f} credited to your earnings."
                else:
                    worker_body = f"Customer refund for '{task_name}' processed. No penalty applied."

                try:
                    await notifications.notify_with_fallback(
                        userId=worker_id,
                        title="Refund Issued to Customer 🔔",
                        body=worker_body,
                        token=worker.get("fcmToken"),
                        email=worker.get("email"),
                        is_worker=True,
                    )
                except Exception as e:
                    print(f"[BULK REFUND] Worker notification failed: {e}")

                try:
                    await websocket_manager.manager.send_to_user(worker_id, json.dumps({
                        "type":         "refund_processed",
                        "taskId":       task_id,
                        "taskName":     task_name,
                        "penaltyAmount": penalty,
                    }))
                except Exception as e:
                    print(f"[BULK REFUND] Worker WS failed: {e}")

            results.append({"task_id": task_id, "status": "success", "refund_amount": refund_amount, "penalty_amount": penalty})
            succeeded += 1

        except Exception as e:
            results.append({"task_id": task_id, "status": "failed", "reason": str(e)})
            failed += 1

    return {
        "message":   f"Bulk refund complete: {succeeded} succeeded, {failed} failed",
        "succeeded": succeeded,
        "failed":    failed,
        "results":   results,
    }


# ── Pending refunds ───────────────────────────────────────────────────────────

@router.get("/refunds/pending")
def get_pending_refunds():
    refunds = list(refund_collection.find({"status": "pending"}))
    result        = []
    total_pending = 0

    for refund in refunds:
        task_id      = refund.get("task_id")
        task         = collection_task.find_one({"_id": ObjectId(task_id)}) if task_id else None
        worker_email = task.get("assignedWorkerId") if task else None
        worker       = collection_worker.find_one({"email": worker_email}) if worker_email else None
        refund_amount = refund.get("amount_customer") or 0

        result.append({
            "refund_id":      str(refund["_id"]),
            "task_id":        task_id,
            "task_name":      task.get("taskName", "Unnamed Task") if task else "Unknown",
            "customer_id":    refund.get("requester_id", ""),
            "refund_amount":  refund_amount,
            "penalty_amount": refund.get("amount_worker") or 0,
            "refund_status":  refund.get("status", "pending"),
            "reason":         refund.get("reason", ""),
            "created_at":     str(refund.get("created_at", "")),
            "worker_email":   worker_email,
            "worker_name":    (
                f"{worker.get('firstName', '')} {worker.get('lastName', '')}".strip()
                if worker else None
            ),
        })
        total_pending += refund_amount

    return {
        "count":                len(result),
        "total_pending_amount": total_pending,
        "refunds":              result,
    }


# ── Approved refunds ──────────────────────────────────────────────────────────

@router.get("/refunds/approved")
def get_approved_refunds():
    refunds = list(refund_collection.find({"status": "approved"}))
    result         = []
    total_approved = 0

    for refund in refunds:
        task_id      = refund.get("task_id")
        task         = collection_task.find_one({"_id": ObjectId(task_id)}) if task_id else None
        worker_email = task.get("assignedWorkerId") if task else None
        worker       = collection_worker.find_one({"email": worker_email}) if worker_email else None
        refund_amount = refund.get("amount_customer") or 0

        result.append({
            "refund_id":      str(refund["_id"]),
            "task_id":        task_id,
            "task_name":      task.get("taskName", "Unnamed Task") if task else "Unknown",
            "customer_id":    refund.get("requester_id", ""),
            "refund_amount":  refund_amount,
            "penalty_amount": refund.get("amount_worker") or 0,
            "refund_status":  refund.get("status", "approved"),
            "reason":         refund.get("reason", ""),
            "created_at":     str(refund.get("created_at", "")),
            "worker_email":   worker_email,
            "worker_name":    (
                f"{worker.get('firstName', '')} {worker.get('lastName', '')}".strip()
                if worker else None
            ),
        })
        total_approved += refund_amount

    return {
        "count":                 len(result),
        "total_approved_amount": total_approved,
        "refunds":               result,
    }


# ── Rejected refunds ──────────────────────────────────────────────────────────

@router.get("/refunds/rejected")
def get_rejected_refunds():
    refunds = list(refund_collection.find({"status": "rejected"}))
    result         = []
    total_rejected = 0

    for refund in refunds:
        task_id      = refund.get("task_id")
        task         = collection_task.find_one({"_id": ObjectId(task_id)}) if task_id else None
        worker_email = task.get("assignedWorkerId") if task else None
        worker       = collection_worker.find_one({"email": worker_email}) if worker_email else None
        refund_amount = refund.get("amount_customer") or 0

        result.append({
            "refund_id":      str(refund["_id"]),
            "task_id":        task_id,
            "task_name":      task.get("taskName", "Unnamed Task") if task else "Unknown",
            "customer_id":    refund.get("requester_id", ""),
            "refund_amount":  refund_amount,
            "penalty_amount": refund.get("amount_worker") or 0,
            "refund_status":  refund.get("status", "rejected"),
            "reason":         refund.get("reason", ""),
            "created_at":     str(refund.get("created_at", "")),
            "worker_email":   worker_email,
            "worker_name":    (
                f"{worker.get('firstName', '')} {worker.get('lastName', '')}".strip()
                if worker else None
            ),
        })
        total_rejected += refund_amount

    return {
        "count":                 len(result),
        "total_rejected_amount": total_rejected,
        "refunds":               result,
    }


# ── Refund history ────────────────────────────────────────────────────────────

@router.get("/refunds/history")
def get_refund_history():
    refunds = list(refund_collection.find({"status": "refunded"}))
    result         = []
    total_refunded = 0
    total_penalty  = 0

    for refund in refunds:
        task_id      = refund.get("task_id")
        task         = collection_task.find_one({"_id": ObjectId(task_id)}) if task_id else None
        worker_email = task.get("assignedWorkerId") if task else None
        worker       = collection_worker.find_one({"email": worker_email}) if worker_email else None
        refund_amount  = refund.get("amount_customer") or 0
        penalty_amount = refund.get("amount_worker") or 0

        result.append({
            "refund_id":      str(refund["_id"]),
            "task_id":        task_id,
            "task_name":      task.get("taskName", "Unnamed Task") if task else "Unknown",
            "customer_id":    refund.get("requester_id", ""),
            "refund_amount":  refund_amount,
            "penalty_amount": penalty_amount,
            "reason":         refund.get("reason", ""),
            "refunded_at":    str(refund.get("updated_at", "")),
            "refunded_by":    refund.get("resolved_by", ""),
            "worker_email":   worker_email,
            "worker_name":    (
                f"{worker.get('firstName', '')} {worker.get('lastName', '')}".strip()
                if worker else None
            ),
        })
        total_refunded += refund_amount
        total_penalty  += penalty_amount

    return {
        "count":          len(result),
        "total_refunded": total_refunded,
        "total_penalty":  total_penalty,
        "refunds":        result,
    }


# ── Update refund status (approve / decline) ──────────────────────────────────

@router.patch("/update-status/{refund_id}")
async def update_refund_status(
    refund_id:       str,
    status:          str          = Form(...),
    amount_customer: float | None = Form(None),
    amount_worker:   float | None = Form(None),
    admin_note:      str          = Form(""),
):
    if status not in ("approved", "declined"):
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'approved' or 'declined'.")

    try:
        obj_id = ObjectId(refund_id)
    except bson_errors.InvalidId:
        raise HTTPException(status_code=400, detail="Invalid refund ID format.")

    refund = refund_collection.find_one({"_id": obj_id})
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found.")

    if refund.get("status") not in ("pending", None):
        raise HTTPException(
            status_code=400,
            detail=f"Refund is already '{refund.get('status')}' and cannot be updated."
        )

    if status == "approved" and (amount_customer is None or amount_customer <= 0):
        raise HTTPException(status_code=400, detail="A positive customer refund amount is required for approval.")

    task        = None
    task_id_str = refund.get("task_id")

    if status == "approved":
        if not task_id_str:
            raise HTTPException(status_code=400, detail="No task linked to this refund.")

        try:
            task = collection_task.find_one({"_id": ObjectId(task_id_str)})
        except bson_errors.InvalidId:
            raise HTTPException(status_code=400, detail="Linked task has an invalid ID.")

        if not task:
            raise HTTPException(status_code=404, detail="Linked task not found.")

        total_paid = float(task.get("totalCost") or task.get("basePrice") or 0)
        if amount_customer > total_paid:
            raise HTTPException(
                status_code=400,
                detail=f"Refund amount ({amount_customer}) exceeds what the customer paid ({total_paid})."
            )

    now = datetime.utcnow()
    update_fields = {
        "status":      status,
        "admin_note":  admin_note,
        "resolved_at": now,
        "resolved_by": "admin",
    }

    esewa_refund_result = None

    if status == "approved":
        update_fields["amount_customer"] = amount_customer
        update_fields["amount_worker"]   = amount_worker or 0.0

        # ── Trigger eSewa refund to customer ──────────────────────────────────
        try:
            customer_esewa_id = None
            customer_obj_id   = refund.get("requester_id") or (task.get("userId") if task else None)
            customer          = None

            if customer_obj_id:
                try:
                    from ..config import database as db
                    customer = db.collection_user.find_one({"_id": ObjectId(str(customer_obj_id))})
                    if customer:
                        customer_esewa_id = customer.get("phoneNo") or customer.get("esewaId")
                except Exception as lookup_err:
                    print(f"[REFUND] Customer lookup failed: {lookup_err}")

            if customer_esewa_id:
                transaction_uuid = str(uuid.uuid4())
                esewa_response   = await disburse_to_esewa(
                    esewa_id=customer_esewa_id,
                    amount=amount_customer,
                    transaction_uuid=transaction_uuid,
                )

                if esewa_response.get("status_code") == 200 and esewa_response.get("body", {}).get("status") == "SUCCESS":
                    update_fields["esewa_refund_status"]      = "sent"
                    update_fields["esewa_refund_transaction"] = transaction_uuid
                    update_fields["esewa_refund_esewa_id"]    = customer_esewa_id
                    esewa_refund_result = {
                        "status":           "sent",
                        "transaction_uuid": transaction_uuid,
                        "esewa_id":         customer_esewa_id,
                    }
                else:
                    update_fields["esewa_refund_status"] = "failed"
                    update_fields["esewa_refund_error"]  = str(esewa_response.get("body", {}))
                    esewa_refund_result = {
                        "status": "failed",
                        "error":  str(esewa_response.get("body", {})),
                    }
            else:
                update_fields["esewa_refund_status"] = "no_esewa_id"
                esewa_refund_result = {
                    "status": "no_esewa_id",
                    "note":   "Customer has no eSewa ID registered. Process refund manually.",
                }

        except Exception as esewa_err:
            print(f"[REFUND] eSewa disburse error for refund {refund_id}: {esewa_err}")
            update_fields["esewa_refund_status"] = "error"
            update_fields["esewa_refund_error"]  = str(esewa_err)
            esewa_refund_result = {"status": "error", "error": str(esewa_err)}

        # ── Mark linked task as refunded ──────────────────────────────────────
        if task_id_str:
            try:
                collection_task.update_one(
                    {"_id": ObjectId(task_id_str)},
                    {"$set": {"taskStatus": "refunded", "refund_resolved_at": now}}
                )
            except Exception as task_err:
                print(f"[REFUND] Failed to update task status: {task_err}")

        # ── Notify customer ───────────────────────────────────────────────────
        if customer:
            task_name = task.get("taskName", "your task") if task else "your task"
            penalty   = amount_worker or 0.0
            if penalty > 0:
                customer_body = (
                    f"Your refund of NPR {amount_customer:.2f} for '{task_name}' has been approved. "
                    f"NPR {penalty:.2f} was retained as a penalty."
                )
            else:
                customer_body = (
                    f"Your full refund of NPR {amount_customer:.2f} for '{task_name}' has been approved."
                )

            try:
                await notifications.notify_with_fallback(
                    userId=str(customer_obj_id),
                    title="Refund Approved ✅",
                    body=customer_body,
                    token=customer.get("fcmToken"),
                    email=customer.get("email"),
                    is_worker=False,
                    data={
                        "event_type":    "refund_approved",
                        "task_id":       task_id_str or "",
                        "refund_amount": str(amount_customer),
                    },
                )
            except Exception as e:
                print(f"[REFUND APPROVE] Customer push failed: {e}")

            try:
                await websocket_manager.manager.send_to_user(str(customer_obj_id), json.dumps({
                    "type":          "refund_approved",
                    "taskId":        task_id_str or "",
                    "taskName":      task_name,
                    "refundAmount":  amount_customer,
                    "penaltyAmount": penalty,
                }))
            except Exception as e:
                print(f"[REFUND APPROVE] Customer WebSocket failed: {e}")

        # ── Notify worker ─────────────────────────────────────────────────────
        if task:
            worker_email = task.get("assignedWorkerId")
            if worker_email:
                worker_doc = collection_worker.find_one({"email": worker_email})
                task_name  = task.get("taskName", "a task")
                penalty    = amount_worker or 0.0

                if worker_doc:
                    if penalty > 0:
                        worker_body = (
                            f"A refund of NPR {amount_customer:.2f} was issued for '{task_name}'. "
                            f"NPR {penalty:.2f} has been credited to your earnings as a penalty fee."
                        )
                    else:
                        worker_body = (
                            f"A full refund of NPR {amount_customer:.2f} was issued for '{task_name}'. "
                            f"No penalty was applied."
                        )

                    try:
                        await notifications.notify_with_fallback(
                            userId=str(worker_doc["_id"]),
                            title="Refund Issued to Customer 🔔",
                            body=worker_body,
                            token=worker_doc.get("fcmToken"),
                            email=worker_doc.get("email"),
                            is_worker=True,
                            data={
                                "event_type":     "refund_approved",
                                "task_id":        task_id_str or "",
                                "refund_amount":  str(amount_customer),
                                "penalty_amount": str(penalty),
                            },
                        )
                    except Exception as e:
                        print(f"[REFUND APPROVE] Worker push failed: {e}")

                    try:
                        await websocket_manager.manager.send_to_user(
                            str(worker_doc["_id"]), json.dumps({
                                "type":          "refund_approved",
                                "taskId":        task_id_str or "",
                                "taskName":      task_name,
                                "refundAmount":  amount_customer,
                                "penaltyAmount": penalty,
                            })
                        )
                    except Exception as e:
                        print(f"[REFUND APPROVE] Worker WebSocket failed: {e}")

    # ── Persist to refund collection ──────────────────────────────────────────
    refund_collection.update_one({"_id": obj_id}, {"$set": update_fields})

    return {
        "message":         f"Refund request {status} successfully.",
        "refund_id":       refund_id,
        "status":          status,
        "amount_customer": update_fields.get("amount_customer"),
        "amount_worker":   update_fields.get("amount_worker"),
        "admin_note":      admin_note,
        "resolved_at":     now.isoformat(),
        "esewa_refund":    esewa_refund_result,
    }