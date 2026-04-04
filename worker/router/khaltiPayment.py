import os
import uuid
import json
import requests
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from bson import ObjectId
from dotenv import load_dotenv

from worker.config.database import (
    collection,
    collection_worker,
    collection_task,
    collection_reports,
    collection_payment,   # ← add this to your database.py
)
from ..services.OAuth2 import get_current_user

load_dotenv()

router = APIRouter()

# ── Config ────────────────────────────────────────────────────────────────────
BASE_URL          = os.getenv("BASE_URL", "http://localhost:5173")
KHALTI_SECRET_KEY = os.getenv("KHALTI_SECRET_KEY", "39a74e06a31f4c99abf2bcaf061c190d")
KHALTI_BASE_URL   = "https://dev.khalti.com"   # swap to https://khalti.com in production


# ── Pydantic Models ───────────────────────────────────────────────────────────
class VerifyKhalti(BaseModel):
    task_id: str
    pidx:    str

class FinishTask(BaseModel):
    worker_id:   str
    final_price: float

class RenegotiateRequest(BaseModel):
    worker_id: str
    new_price: float
    reason:    str

class RenegotiateRespond(BaseModel):
    user_id:  str
    decision: str   # "accept" or "reject"

class WorkerAfterRejection(BaseModel):
    worker_id: str
    decision:  str  # "proceed" or "cancel"

class DisputeRequest(BaseModel):
    user_id: str
    reason:  str

class ResolveDispute(BaseModel):
    decision: str   # "release" or "refund"

class CompleteTask(BaseModel):
    user_id: str


# ── Helpers ───────────────────────────────────────────────────────────────────
def get_khalti_headers() -> dict:
    return {
        "Authorization": f"Key {KHALTI_SECRET_KEY}",
        "Content-Type":  "application/json",
    }


def get_task_or_404(task_id: str) -> dict:
    try:
        task = collection_task.find_one({"_id": ObjectId(task_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID format")
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def save_payment(
    task_id:          str,
    payment_type:     str,    # "customer_payment" | "escrow_release" | "worker_payout" | "refund"
    direction:        str,    # "inbound" | "outbound" | "internal"
    amount:           float,
    method:           str,    # "khalti" | "esewa" | "manual"
    status:           str,    # "pending" | "success" | "failed"
    transaction_uuid: str = "",
    gateway_ref:      str = "",   # khalti_txn_id or esewa_ref_id
    raw_response:     dict = None,
) -> str:
    """Insert a payment record, return its _id as string."""
    doc = {
        "task_id":          task_id,
        "type":             payment_type,
        "direction":        direction,
        "amount":           amount,
        "method":           method,
        "status":           status,
        "transaction_uuid": transaction_uuid,
        "gateway_ref":      gateway_ref,
        "raw_response":     raw_response or {},
        "created_at":       datetime.utcnow(),
    }
    result = collection_payment.insert_one(doc)
    return str(result.inserted_id)


# ══════════════════════════════════════════════════════════════════════════════
# RELEASE — Customer releases escrow (no money moves, just a DB flag)
# ══════════════════════════════════════════════════════════════════════════════

@router.patch("/customer/release/{task_id}", tags=["payment"])
def release_to_worker(
    task_id:      str,
    current_user: dict = Depends(get_current_user),
):
    """
    Customer confirms they are happy with the work.
    Flips escrow_status: 'held' → 'released'.
    No money moves here — admin payout (payment_service.py) handles the actual transfer.
    """

    task = get_task_or_404(task_id)

    # ── Auth ──────────────────────────────────────────────────────────────────
    if current_user["user_id"] != task.get("userId"):
        raise HTTPException(status_code=403, detail="Not authorized to release this payment")

    # ── Task must be completed ────────────────────────────────────────────────
    if task.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Task must be completed before releasing payment")

    # ── Payment must be paid ──────────────────────────────────────────────────
    if task.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Payment has not been completed")

    # ── Escrow must still be held ─────────────────────────────────────────────
    if task.get("escrow_status") == "released":
        raise HTTPException(status_code=400, detail="Payment already released")
    if task.get("escrow_status") == "refunded":
        raise HTTPException(status_code=400, detail="Task has been refunded, cannot release")
    if task.get("escrow_status") != "held":
        raise HTTPException(status_code=400, detail="Escrow is not in held state")

    # ── Validate payment reference — accepts Khalti OR eSewa ─────────────────
    payment_ref = (
        task.get("khalti_pidx") or
        task.get("khalti_txn_id") or
        task.get("esewa_ref_id") or
        task.get("esewa_transaction_uuid")
    )
    if not payment_ref:
        raise HTTPException(status_code=400, detail="No payment reference found on this task")

    # ── Calculate split ───────────────────────────────────────────────────────
    final_price = float(task.get("totalCost") or task.get("basePrice") or 0)
    if final_price <= 0:
        raise HTTPException(status_code=400, detail="Invalid task amount")

    platform_fee  = round(final_price * 0.05, 2)   # 5% platform cut
    worker_payout = round(final_price - platform_fee, 2)

    # ── Find worker ───────────────────────────────────────────────────────────
    worker_id = task.get("assignedWorkerId")
    if not worker_id:
        raise HTTPException(status_code=400, detail="No worker assigned to this task")

    worker = collection_worker.find_one({"email": worker_id})
    if not worker:
        raise HTTPException(status_code=404, detail="Assigned worker not found")

    now = datetime.utcnow()

    # ── Update task ───────────────────────────────────────────────────────────
    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "escrow_status": "released",
            "released_at":   now,
            "platform_fee":  platform_fee,
            "worker_payout": worker_payout,
        }}
    )

    # ── Save release event to payments collection ─────────────────────────────
    save_payment(
        task_id=task_id,
        payment_type="escrow_release",
        direction="internal",
        amount=worker_payout,
        method=task.get("payment_method", "unknown"),
        status="success",
        transaction_uuid=payment_ref,
        gateway_ref=payment_ref,
    )

    return {
        "success":       True,
        "message":       "Payment released. Worker will be paid shortly by admin.",
        "task_id":       task_id,
        "total_cost":    final_price,
        "platform_fee":  platform_fee,
        "worker_payout": worker_payout,
        "released_at":   now.isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════════
# 1. INITIATE — Khalti
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/task/{task_id}/pay/khalti", tags=["payment"])
def pay_via_khalti(task_id: str):
    """
    Initiates a Khalti payment for the given task.
    Returns payment_url — redirect user to this URL (no HTML form needed).
    """
    task = get_task_or_404(task_id)

    if task.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Task already paid")

    total_amount       = int(task["totalCost"])
    total_amount_paisa = total_amount * 100   # Khalti uses paisa

    payload = {
        "return_url":          f"http://localhost:8000/payment/verify/khalti/{task_id}",
        "website_url":         BASE_URL,
        "amount":              total_amount_paisa,
        "purchase_order_id":   str(task_id),
        "purchase_order_name": f"Task Payment - {task_id}",
        "customer_info": {
            "name":  task.get("userName", "Customer"),
            "email": task.get("userEmail", ""),
            "phone": task.get("userPhone", "9800000000"),
        }
    }

    response = requests.post(
        f"{KHALTI_BASE_URL}/api/v2/epayment/initiate/",
        json=payload,
        headers=get_khalti_headers(),
    )

    if response.status_code != 200:
        print("Khalti initiation error:", response.text)
        raise HTTPException(status_code=502, detail=f"Khalti initiation failed: {response.text}")

    data        = response.json()
    pidx        = data.get("pidx")
    payment_url = data.get("payment_url")

    print("Khalti pidx:", pidx)
    print("Khalti payment_url:", payment_url)

    # ── Save pending payment record ───────────────────────────────────────────
    save_payment(
        task_id=task_id,
        payment_type="customer_payment",
        direction="inbound",
        amount=total_amount,
        method="khalti",
        status="pending",
        transaction_uuid=pidx,   # pidx acts as transaction UUID for Khalti
        gateway_ref=pidx,
        raw_response=data,
    )

    # ── Update task ───────────────────────────────────────────────────────────
    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "khalti_pidx":    pidx,
            "payment_method": "khalti",
            "payment_status": "unpaid",
            "escrow_status":  "pending",
        }}
    )

    return {
        "payment_url": payment_url,
        "pidx":        pidx,
    }


# ══════════════════════════════════════════════════════════════════════════════
# 2a. VERIFY — Khalti redirect (GET callback from Khalti)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/payment/verify/khalti/{task_id}", tags=["payment"])
def verify_khalti_redirect(
    task_id:             str,
    pidx:                Optional[str] = Query(None),
    status:              Optional[str] = Query(None),
    transaction_id:      Optional[str] = Query(None),
    tidx:                Optional[str] = Query(None),
    amount:              Optional[int] = Query(None),
    mobile:              Optional[str] = Query(None),
    purchase_order_id:   Optional[str] = Query(None),
    purchase_order_name: Optional[str] = Query(None),
):
    """
    Khalti redirects here after payment with query params.
    Always verify with Khalti lookup API — never trust redirect params alone.
    """
    if not pidx:
        return RedirectResponse(url=f"{BASE_URL}/payment/failed")

    # ── Verify with Khalti lookup ─────────────────────────────────────────────
    response = requests.post(
        f"{KHALTI_BASE_URL}/api/v2/epayment/lookup/",
        json={"pidx": pidx},
        headers=get_khalti_headers(),
    )

    if response.status_code != 200:
        print("Khalti lookup failed:", response.text)
        # Update pending record to failed
        collection_payment.update_one(
            {"task_id": task_id, "method": "khalti", "status": "pending"},
            {"$set": {"status": "failed", "raw_response": response.json()}}
        )
        return RedirectResponse(url=f"{BASE_URL}/payment/failed")

    data = response.json()
    print("Khalti lookup response:", data)

    if data.get("status") != "Completed":
        collection_payment.update_one(
            {"task_id": task_id, "method": "khalti", "status": "pending"},
            {"$set": {"status": "failed", "raw_response": data}}
        )
        return RedirectResponse(url=f"{BASE_URL}/payment/failed")

    # ── Payment confirmed ─────────────────────────────────────────────────────
    khalti_txn_id = data.get("transaction_id")
    paid_amount   = (data.get("total_amount") or 0) / 100   # paisa → NPR

    # Update payment record pending → success
    collection_payment.update_one(
        {"task_id": task_id, "method": "khalti", "status": "pending"},
        {"$set": {
            "status":       "success",
            "gateway_ref":  khalti_txn_id,
            "amount":       paid_amount,
            "raw_response": data,
            "paid_at":      datetime.utcnow(),
        }}
    )

    # Update task — status flags only
    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "payment_status": "paid",
            "escrow_status":  "held",
            "khalti_pidx":    pidx,
            "khalti_txn_id":  khalti_txn_id,
            "payment_method": "khalti",
            "paid_at":        datetime.utcnow(),
        }}
    )

    task       = collection_task.find_one({"_id": ObjectId(task_id)})
    user_email = task.get("userEmail", "")
    user_id    = str(task.get("userId", "unknown"))

    return RedirectResponse(
        url=f"{BASE_URL}/customer/pay/{task_id}/{user_id}/customer?payment=success"
    )


# ══════════════════════════════════════════════════════════════════════════════
# 2b. VERIFY — Khalti manual (POST for Swagger/Postman testing)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/payment/verify/khalti", tags=["payment"])
def verify_khalti_manual(body: VerifyKhalti):
    """Manual Khalti verification for Swagger/Postman testing."""
    response = requests.post(
        f"{KHALTI_BASE_URL}/api/v2/epayment/lookup/",
        json={"pidx": body.pidx},
        headers=get_khalti_headers(),
    )

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Khalti lookup failed: {response.text}")

    data = response.json()
    print("Khalti manual verify response:", data)

    if data.get("status") != "Completed":
        return {"message": "Payment not completed", "status": data.get("status")}

    khalti_txn_id = data.get("transaction_id")
    paid_amount   = (data.get("total_amount") or 0) / 100   # paisa → NPR

    # ── Save payment record ───────────────────────────────────────────────────
    save_payment(
        task_id=body.task_id,
        payment_type="customer_payment",
        direction="inbound",
        amount=paid_amount,
        method="khalti",
        status="success",
        transaction_uuid=body.pidx,
        gateway_ref=khalti_txn_id,
        raw_response=data,
    )

    # ── Update task ───────────────────────────────────────────────────────────
    collection_task.update_one(
        {"_id": ObjectId(body.task_id)},
        {"$set": {
            "payment_status": "paid",
            "escrow_status":  "held",
            "khalti_pidx":    body.pidx,
            "khalti_txn_id":  khalti_txn_id,
            "payment_method": "khalti",
            "paid_at":        datetime.utcnow(),
        }}
    )

    return {
        "message":        "Payment verified. Funds held in escrow.",
        "status":         "success",
        "transaction_id": khalti_txn_id,
        "amount":         paid_amount,
    }


# ══════════════════════════════════════════════════════════════════════════════
# PAYMENT HISTORY — query by task
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/payments/task/{task_id}", tags=["payment"])
def get_task_payments(task_id: str):
    """Get all payment records for a specific task."""
    payments = list(collection_payment.find({"task_id": task_id}).sort("created_at", 1))
    result   = []
    for p in payments:
        result.append({
            "payment_id":       str(p["_id"]),
            "type":             p.get("type"),
            "direction":        p.get("direction"),
            "amount":           p.get("amount"),
            "method":           p.get("method"),
            "status":           p.get("status"),
            "transaction_uuid": p.get("transaction_uuid"),
            "gateway_ref":      p.get("gateway_ref"),
            "created_at":       str(p.get("created_at", "")),
        })
    return {
        "task_id":  task_id,
        "count":    len(result),
        "payments": result,
    }