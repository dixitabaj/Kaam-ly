"""
Admin Bulk Payout via eSewa Merchant Disbursement API
Sandbox credentials pre-configured — swap for production when ready.
"""

import uuid
import hmac
import hashlib
import base64
import httpx
from datetime import datetime
from fastapi import APIRouter, HTTPException
from bson import ObjectId
from worker.config.database import collection_task, collection_worker

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