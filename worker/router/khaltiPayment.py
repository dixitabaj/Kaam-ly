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
    collection_payment,
)
from ..services.OAuth2 import get_current_user

load_dotenv()

router = APIRouter()

# ── Config ────────────────────────────────────────────────────────────────────
BASE_URL          = os.getenv("BASE_URL", "http://localhost:5173")
KHALTI_SECRET_KEY = "ebfd3f0f11fb481097ef8bec307a6b32"
KHALTI_BASE_URL   = "https://dev.khalti.com"


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
    payment_type:     str,
    direction:        str,
    amount:           float,
    method:           str,
    status:           str,
    transaction_uuid: str = "",
    gateway_ref:      str = "",
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


def get_payment_ref_for_task(task_id: str) -> str:
    """
    Look up the gateway_ref (pidx / txn_id) for a task from collection_payment.
    Returns the first successful or pending inbound payment's gateway_ref.
    """
    payment = collection_payment.find_one(
        {
            "task_id":  task_id,
            "direction": "inbound",
            "status":   {"$in": ["success", "pending"]},
        },
        sort=[("created_at", 1)],
    )
    if not payment:
        return None
    return payment.get("gateway_ref") or payment.get("transaction_uuid")


# ══════════════════════════════════════════════════════════════════════════════
# RELEASE — Customer releases escrow
# ══════════════════════════════════════════════════════════════════════════════

@router.patch("/customer/release/{task_id}", tags=["payment"])
def release_to_worker(
    task_id:      str,
    current_user: dict = Depends(get_current_user),
):
    task = get_task_or_404(task_id)

    if current_user["user_id"] != task.get("userId"):
        raise HTTPException(status_code=403, detail="Not authorized to release this payment")

    if task.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Task must be completed before releasing payment")

    if task.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Payment has not been completed")

    if task.get("escrow_status") == "released":
        raise HTTPException(status_code=400, detail="Payment already released")
    if task.get("escrow_status") == "refunded":
        raise HTTPException(status_code=400, detail="Task has been refunded, cannot release")
    if task.get("escrow_status") != "held":
        raise HTTPException(status_code=400, detail="Escrow is not in held state")

    # Resolve payment reference from collection_payment, not the task document
    payment_ref = get_payment_ref_for_task(task_id)
    if not payment_ref:
        raise HTTPException(status_code=400, detail="No payment reference found for this task")

    final_price = float(task.get("totalCost") or task.get("basePrice") or 0)
    if final_price <= 0:
        raise HTTPException(status_code=400, detail="Invalid task amount")

    platform_fee  = round(final_price * 0.05, 2)
    worker_payout = round(final_price - platform_fee, 2)

    worker_id = task.get("assignedWorkerId")
    if not worker_id:
        raise HTTPException(status_code=400, detail="No worker assigned to this task")

    worker = collection_worker.find_one({"email": worker_id})
    if not worker:
        raise HTTPException(status_code=404, detail="Assigned worker not found")

    now = datetime.utcnow()

    # Task only stores escrow lifecycle status and financial summary
    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "escrow_status": "released",
            "released_at":   now,
            "platform_fee":  platform_fee,
            "worker_payout": worker_payout,
        }}
    )

    # Full payment record goes to collection_payment
    save_payment(
        task_id=task_id,
        payment_type="escrow_release",
        direction="internal",
        amount=worker_payout,
        method=_get_payment_method(task_id),
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


def _get_payment_method(task_id: str) -> str:
    """Retrieve the payment method used for a task from collection_payment."""
    payment = collection_payment.find_one(
        {"task_id": task_id, "direction": "inbound"},
        sort=[("created_at", 1)],
    )
    return payment.get("method", "unknown") if payment else "unknown"


# ══════════════════════════════════════════════════════════════════════════════
# INITIATE — Khalti
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/task/{task_id}/pay/khalti", tags=["payment"])
def pay_via_khalti(task_id: str):
    task = get_task_or_404(task_id)

    if task.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Task already paid")

    total_amount_paisa = int(float(task["totalCost"])) * 100
    task_name          = task.get("taskName") or task.get("taskDescrip", "Task Payment")
    transaction_uuid   = str(uuid.uuid4())

    phone = str(task.get("userPhone") or "9800000000")
    if phone.startswith("+977"):
        phone = phone.replace("+977", "")
    phone = phone[:10]

    payload = {
        "return_url":          f"http://localhost:8000/payment/verify/khalti/{task_id}",
        "website_url":         BASE_URL,
        "amount":              total_amount_paisa,
        "purchase_order_id":   transaction_uuid,
        "purchase_order_name": task_name,
        "customer_info": {
            "name":  task.get("userName", "Customer"),
            "email": task.get("userEmail", "test@gmail.com"),
            "phone": phone,
        }
    }

    print("KHALTI KEY BEING USED:", KHALTI_SECRET_KEY)
    print("KHALTI URL BEING USED:", KHALTI_BASE_URL)
    print("KHALTI PAYLOAD:", payload)

    resp = requests.post(
        f"{KHALTI_BASE_URL}/api/v2/epayment/initiate/",
        json=payload,
        headers={
            "Authorization": f"Key {KHALTI_SECRET_KEY}",
            "Content-Type":  "application/json",
        }
    )

    print("KHALTI INITIATE RESPONSE:", resp.text)

    data = resp.json()

    if resp.status_code != 200 or not data.get("pidx"):
        raise HTTPException(status_code=400, detail=f"Khalti initiation failed: {data}")

    pidx = data["pidx"]

    # All payment details go to collection_payment only
    save_payment(
        task_id=task_id,
        payment_type="customer_payment",
        direction="inbound",
        amount=float(task["totalCost"]),
        method="khalti",
        status="pending",
        transaction_uuid=transaction_uuid,
        gateway_ref=pidx,
        raw_response=data,
    )

    # Task only gets minimal status flags — no payment gateway fields
    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "payment_status": "unpaid",
            "escrow_status":  "pending",
        }}
    )

    return {
        "payment_url": data.get("payment_url"),
        "pidx":        pidx,
    }


# ══════════════════════════════════════════════════════════════════════════════
# VERIFY REDIRECT — Khalti GET callback
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
    if not pidx:
        return RedirectResponse(url=f"{BASE_URL}/payment/failed")

    resp = requests.post(
        f"{KHALTI_BASE_URL}/api/v2/epayment/lookup/",
        json={"pidx": pidx},
        headers={
            "Authorization": f"Key {KHALTI_SECRET_KEY}",
            "Content-Type":  "application/json",
        }
    )

    print("KHALTI LOOKUP RESPONSE:", resp.text)

    if resp.status_code != 200:
        collection_payment.update_one(
            {"task_id": task_id, "method": "khalti", "status": "pending"},
            {"$set": {"status": "failed", "raw_response": resp.json()}}
        )
        return RedirectResponse(url=f"{BASE_URL}/payment/failed")

    data = resp.json()

    if data.get("status") != "Completed":
        collection_payment.update_one(
            {"task_id": task_id, "method": "khalti", "status": "pending"},
            {"$set": {"status": "failed", "raw_response": data}}
        )
        return RedirectResponse(url=f"{BASE_URL}/payment/failed")

    khalti_txn_id = data.get("transaction_id")
    paid_amount   = (data.get("total_amount") or 0) / 100

    # Update payment record in collection_payment with confirmed details
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

    # Task only stores escrow lifecycle status — no gateway-specific fields
    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "payment_status": "paid",
            "escrow_status":  "held",
            "paid_at":        datetime.utcnow(),
        }}
    )

    task    = collection_task.find_one({"_id": ObjectId(task_id)})
    user_id = str(task.get("userId", "unknown"))

    return RedirectResponse(
        url=f"{BASE_URL}/customer/pay/{task_id}/{user_id}/customer?payment=success"
    )


# ══════════════════════════════════════════════════════════════════════════════
# VERIFY MANUAL — Khalti POST for Swagger/Postman
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/payment/verify/khalti", tags=["payment"])
def verify_khalti_manual(body: VerifyKhalti):
    resp = requests.post(
        f"{KHALTI_BASE_URL}/api/v2/epayment/lookup/",
        json={"pidx": body.pidx},
        headers={
            "Authorization": f"Key {KHALTI_SECRET_KEY}",
            "Content-Type":  "application/json",
        }
    )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Khalti lookup failed: {resp.text}")

    data = resp.json()
    print("KHALTI MANUAL VERIFY RESPONSE:", data)

    if data.get("status") != "Completed":
        return {"message": "Payment not completed", "status": data.get("status")}

    khalti_txn_id = data.get("transaction_id")
    paid_amount   = (data.get("total_amount") or 0) / 100

    # All payment details go to collection_payment only
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

    # Task only stores escrow lifecycle status — no gateway-specific fields
    collection_task.update_one(
        {"_id": ObjectId(body.task_id)},
        {"$set": {
            "payment_status": "paid",
            "escrow_status":  "held",
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
# PAYMENT HISTORY
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/payments/task/{task_id}", tags=["payment"])
def get_task_payments(task_id: str):
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