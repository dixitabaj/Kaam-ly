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
from fastapi import APIRouter, HTTPException
from bson import ObjectId
from worker.config.database import collection_task, collection_worker
from worker.router import notifications
from worker.manager import websocket_manager

router = APIRouter(prefix="/api", tags=["admin-payouts"])  # ← fixed prefix

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


@router.post("/payouts/{task_id}/mark-paid")
def mark_payout_paid(task_id: str):
    task = collection_task.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.get("escrow_status") != "released":
        raise HTTPException(status_code=400, detail="Escrow not released yet")
    if task.get("payout_status") == "paid":
        raise HTTPException(status_code=400, detail="Already marked as paid")

    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {"payout_status": "paid", "payout_at": datetime.utcnow()}}
    )
    worker_id = task.get("assignedWorkerId")
    if worker_id:
        collection_worker.update_one(
            {"email": worker_id},
            {"$inc": {"total_earnings": task.get("worker_payout", 0)}}
        )
    return {
        "success":       True,
        "message":       "Payout marked as paid",
        "task_id":       task_id,
        "worker_payout": task.get("worker_payout", 0),
    }


@router.get("/payouts/history")  # ← kept only once, merged both versions
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
                        "payout_status":    "paid",
                        "payout_transaction": transaction_uuid,
                        "payout_at":        datetime.utcnow(),
                        "sandbox_mode":     sandbox
                    }}
                )
                succeeded += 1
                results.append({"task_id": task_id, "worker_email": worker_id, "amount": amount,
                                 "transaction_uuid": transaction_uuid, "status": "success",
                                 "sandbox_mode": sandbox, "esewa_response": esewa_response["body"]})
            else:
                failed += 1
                results.append({"task_id": task_id, "worker_email": worker_id, "amount": amount,
                                 "status": "failed", "sandbox_mode": sandbox, "esewa_response": esewa_response["body"]})
        except Exception as e:
            failed += 1
            results.append({"task_id": task_id, "worker_email": worker_id, "status": "error",
                             "sandbox_mode": sandbox, "reason": str(e)})

    return {
        "message":   f"Bulk payout complete: {succeeded} succeeded, {failed} failed",
        "succeeded": succeeded,
        "failed":    failed,
        "results":   results
    }

"""
Add these routes to your existing payout.py (admin_payout.py).
They handle the customer refund queue — fetching pending refunds
and marking them as processed with customer + worker notifications.
"""

# ── Add these imports at the top of your payout.py (if not already present) ──
# from fastapi import APIRouter, HTTPException
# from bson import ObjectId
# from datetime import datetime
# from worker.config.database import collection_task, collection_worker
# from ..router import notifications          ← your existing notifications module
# from ..manager import websocket_manager    ← your existing WS manager
# import json

# ─────────────────────────────────────────────────────────────────────────────
# GET /api/refunds/pending
# Returns all cancelled tasks that had a payment and need a refund processed
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/refunds/pending")
def get_pending_refunds():
    # Single clean query using $or instead of nested $in with $exists
    tasks = list(collection_task.find({
        "status":        "cancelled",
        "paymentStatus": "paid",
        "refundAmount":  {"$gt": 0},
        "$or": [
            {"refund_status": "pending_refund"},
            {"refund_status": {"$exists": False}},
        ]
    }))

    result = []
    for task in tasks:
        task_id     = str(task["_id"])
        customer_id = task.get("userId")
        worker_id   = task.get("assignedWorkerId")

        customer = None
        if customer_id:
            try:
                from ..config import database as db
                customer = db.collection_user.find_one({"_id": ObjectId(customer_id)})
            except Exception:
                pass

        worker = None
        if worker_id:
            try:
                worker = collection_worker.find_one({"_id": ObjectId(worker_id)})
            except Exception:
                pass

        result.append({
            "task_id":        task_id,
            "task_name":      task.get("taskName") or task.get("taskDescrip", "Unnamed Task"),
            "customer_id":    customer_id,
            "customer_name":  f"{customer.get('firstName','')} {customer.get('lastName','')}".strip() if customer else "Unknown",
            "customer_email": customer.get("email", "") if customer else "",
            "total_cost":     task.get("totalCost", 0),
            "refund_amount":  task.get("refundAmount", 0),
            "penalty_amount": task.get("penaltyAmount", 0),
            "cancel_reason":  task.get("cancelReason", ""),
            "cancelled_at":   str(task.get("cancelledAt", "")),
            "refund_status":  task.get("refund_status", "pending_refund"),
            "refunded_at":    str(task.get("refunded_at", "")) if task.get("refunded_at") else None,
            "worker_name":    f"{worker.get('firstName','')} {worker.get('lastName','')}".strip() if worker else "Unknown",
        })

    total_owed = sum(r["refund_amount"] for r in result if r["refund_status"] != "refunded")
    return {"count": len(result), "total_owed": total_owed, "refunds": result}

# ─────────────────────────────────────────────────────────────────────────────
# POST /api/refunds/{task_id}/mark-refunded
# Admin calls this after manually processing the refund in eSewa.
# Notifies the customer (FCM + email) and worker via WebSocket + FCM.
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/refunds/{task_id}/mark-refunded")
async def mark_refund_processed(task_id: str):
    """
    Mark a cancelled task's refund as processed.
    - Updates refund_status → "refunded"
    - Notifies the customer via FCM push + email
    - Notifies the worker via FCM push + WebSocket
    """
    try:
        obj_id = ObjectId(task_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID")

    task = collection_task.find_one({"_id": obj_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.get("refund_status") == "refunded":
        raise HTTPException(status_code=400, detail="Refund already processed")

    if task.get("status") != "cancelled":
        raise HTTPException(status_code=400, detail="Task is not cancelled")

    if not task.get("refundAmount") or task.get("refundAmount", 0) <= 0:
        raise HTTPException(status_code=400, detail="No refund amount recorded for this task")

    now           = datetime.utcnow()
    refund_amount = task.get("refundAmount", 0)
    penalty       = task.get("penaltyAmount", 0)
    total_cost    = task.get("totalCost", 0)
    task_name     = task.get("taskName", "your task")
    customer_id   = str(task.get("userId", ""))
    worker_id     = str(task.get("assignedWorkerId", ""))

    # ── Update task in DB ──
    collection_task.update_one(
        {"_id": obj_id},
        {"$set": {
            "refund_status": "refunded",
            "refunded_at":   now,
            "refunded_by":   "admin",
        }}
    )

    # ── Fetch customer document ──
    customer = None
    try:
        customer = collection_task.database["users"].find_one({"_id": ObjectId(customer_id)})
    except Exception:
        pass

    # ── Fetch worker document ──
    worker = None
    try:
        worker = collection_worker.find_one({"_id": ObjectId(worker_id)})
    except Exception:
        pass

    # ── Notify customer ──
    if customer:
        if penalty > 0:
            # Partial refund (late cancellation penalty applied)
            customer_body = (
                f"Your refund of NPR {refund_amount:.2f} for '{task_name}' has been processed. "
                f"(NPR {penalty:.2f} was retained as a late cancellation fee for the worker.)"
            )
        else:
            # Full refund
            customer_body = (
                f"Your full refund of NPR {refund_amount:.2f} for '{task_name}' has been processed. "
                f"The amount will reflect in your eSewa account shortly."
            )

        try:
            await notifications.notify_with_fallback(
                userId=customer_id,
                title="Refund Processed ✅",
                body=customer_body,
                token=customer.get("fcmToken"),
                email=customer.get("email"),
                is_worker=False,
                data={
                    "event_type":    "refund_processed",
                    "task_id":       task_id,
                    "refund_amount": str(refund_amount),
                },
            )
        except Exception as e:
            print(f"[REFUND] Customer notification failed: {e}")

        # WebSocket to customer
        try:
            await websocket_manager.manager.send_to_user(customer_id, json.dumps({
                "type":          "refund_processed",
                "taskId":        task_id,
                "taskName":      task_name,
                "refundAmount":  refund_amount,
            }))
        except Exception as e:
            print(f"[REFUND] Customer WebSocket failed: {e}")

    # ── Notify worker ──
    if worker:
        if penalty > 0:
            worker_body = (
                f"Admin has processed the customer refund for '{task_name}'. "
                f"Your cancellation penalty of NPR {penalty:.2f} has been credited to your earnings."
            )
        else:
            worker_body = (
                f"The customer refund for cancelled task '{task_name}' has been fully processed. "
                f"No penalty was applied."
            )

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
            print(f"[REFUND] Worker notification failed: {e}")

        # WebSocket to worker
        try:
            await websocket_manager.manager.send_to_user(worker_id, json.dumps({
                "type":          "refund_processed",
                "taskId":        task_id,
                "taskName":      task_name,
                "penaltyAmount": penalty,
            }))
        except Exception as e:
            print(f"[REFUND] Worker WebSocket failed: {e}")

    return {
        "success":       True,
        "message":       "Refund marked as processed. Customer and worker notified.",
        "task_id":       task_id,
        "refund_amount": refund_amount,
        "penalty_amount": penalty,
        "refunded_at":   now.isoformat(),
    }