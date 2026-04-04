"""
Full Payment Flow
- eSewa initiate + verify
- Khalti initiate + verify  
- Customer release (escrow confirmation)
- All payment records stored in payments collection
"""

import os
import uuid
import hmac
import hashlib
import base64
import json
import requests
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from bson import ObjectId

from worker.config.database import (
    collection_task,
    collection_worker,
    collection_payment,   # ← new collection, add to database.py
)
from ..services.OAuth2 import get_current_user

router = APIRouter(tags=["payment"])

# ── Config ────────────────────────────────────────────────────────────────────
BASE_URL            = os.getenv("BASE_URL", "http://localhost:5173")
ESEWA_MERCHANT_CODE = os.getenv("ESEWA_MERCHANT_CODE", "EPAYTEST")
ESEWA_SECRET_KEY    = os.getenv("ESEWA_SECRET_KEY", "8gBm/:&EnhH.1/q")
ESEWA_BASE_URL      = "https://rc.esewa.com.np"
# Production: "https://epay.esewa.com.np"

KHALTI_SECRET_KEY   = os.getenv("KHALTI_SECRET_KEY", "your-khalti-secret")
KHALTI_BASE_URL     = "https://a.khalti.com"
# Production: "https://khalti.com"


# ── Pydantic Models ───────────────────────────────────────────────────────────
class VerifyEsewa(BaseModel):
    task_id:          str
    transaction_uuid: str
    total_amount:     float

class InitiateKhalti(BaseModel):
    task_id: str

class VerifyKhalti(BaseModel):
    task_id: str
    pidx:    str


# ── Helpers ───────────────────────────────────────────────────────────────────
def get_task_or_404(task_id: str) -> dict:
    try:
        task = collection_task.find_one({"_id": ObjectId(task_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID format")
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def generate_esewa_signature(message: str) -> str:
    key    = ESEWA_SECRET_KEY.encode("utf-8")
    msg    = message.encode("utf-8")
    digest = hmac.new(key, msg, hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")


def save_payment(
    task_id:          str,
    payment_type:     str,    # "customer_payment" | "worker_payout" | "refund"
    direction:        str,    # "inbound" | "outbound"
    amount:           float,
    method:           str,    # "esewa" | "khalti"
    status:           str,    # "success" | "failed" | "pending"
    transaction_uuid: str = "",
    gateway_ref:      str = "",
    raw_response:     dict = None,
) -> str:
    """Save a payment record and return its _id as string."""
    doc = {
        "task_id":          task_id,
        "type":             payment_type,
        "direction":        direction,
        "amount":           amount,
        "method":           method,
        "status":           status,
        "transaction_uuid": transaction_uuid,
        "gateway_ref":      gateway_ref,       # esewa_ref_id or khalti_txn_id
        "raw_response":     raw_response or {},
        "created_at":       datetime.utcnow(),
    }
    result = collection_payment.insert_one(doc)
    return str(result.inserted_id)


# ══════════════════════════════════════════════════════════════════════════════
# eSewa PAYMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/task/{task_id}/pay/esewa")
def pay_via_esewa(task_id: str):
    """Initiate eSewa payment — returns form data for frontend to submit."""
    task = get_task_or_404(task_id)

    if task.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Task already paid")

    total_amount     = int(task["totalCost"])
    transaction_uuid = str(uuid.uuid4())
    message          = f"total_amount={total_amount},transaction_uuid={transaction_uuid},product_code={ESEWA_MERCHANT_CODE}"
    signature        = generate_esewa_signature(message)

    # Save pending payment record
    save_payment(
        task_id=task_id,
        payment_type="customer_payment",
        direction="inbound",
        amount=total_amount,
        method="esewa",
        status="pending",
        transaction_uuid=transaction_uuid,
    )

    # Update task with transaction UUID and pending status
    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "esewa_transaction_uuid": transaction_uuid,
            "payment_method":         "esewa",
            "payment_status":         "unpaid",
            "escrow_status":          "pending",
        }}
    )

    return {
        "esewa_url": f"{ESEWA_BASE_URL}/api/epay/main/v2/form",
        "form_data": {
            "amount":                  str(total_amount),
            "tax_amount":              "0",
            "total_amount":            str(total_amount),
            "transaction_uuid":        transaction_uuid,
            "product_code":            ESEWA_MERCHANT_CODE,
            "product_service_charge":  "0",
            "product_delivery_charge": "0",
            "success_url":             f"http://localhost:8000/payment/verify/esewa/{task_id}",
            "failure_url":             f"{BASE_URL}/payment/failed",
            "signed_field_names":      "total_amount,transaction_uuid,product_code",
            "signature":               signature,
        }
    }


@router.get("/payment/verify/esewa/{task_id}")
def verify_esewa_redirect(
    task_id: str,
    data:    Optional[str] = Query(None),
):
    """eSewa redirects here after payment. Verifies and marks task as paid."""
    if not data:
        return RedirectResponse(url=f"{BASE_URL}/payment/failed")

    try:
        decoded = json.loads(base64.b64decode(data).decode("utf-8"))
    except Exception as e:
        return RedirectResponse(url=f"{BASE_URL}/payment/failed")

    task      = get_task_or_404(task_id)
    status    = decoded.get("status")
    ref_id    = decoded.get("transaction_code")   # eSewa's reference ID
    amount    = float(decoded.get("total_amount", 0))
    txn_uuid  = decoded.get("transaction_uuid", task.get("esewa_transaction_uuid", ""))

    if status != "COMPLETE":
        # Save failed payment record
        save_payment(
            task_id=task_id,
            payment_type="customer_payment",
            direction="inbound",
            amount=amount,
            method="esewa",
            status="failed",
            transaction_uuid=txn_uuid,
            gateway_ref=ref_id or "",
            raw_response=decoded,
        )
        return RedirectResponse(url=f"{BASE_URL}/payment/failed")

    # ── Payment success ───────────────────────────────────────────────────────

    # Update payment record from pending → success
    collection_payment.update_one(
        {"task_id": task_id, "method": "esewa", "status": "pending"},
        {"$set": {
            "status":       "success",
            "gateway_ref":  ref_id,
            "raw_response": decoded,
            "paid_at":      datetime.utcnow(),
        }}
    )

    # Update task — only status flags, no money details
    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "payment_status": "paid",
            "escrow_status":  "held",
            "esewa_ref_id":   ref_id,     # keep for quick reference
            "payment_method": "esewa",
            "paid_at":        datetime.utcnow(),
        }}
    )

    user_email = task.get("userEmail", "")
    user_id    = str(task.get("userId", ""))

    return RedirectResponse(
        url=f"{BASE_URL}/customer/pay/{task_id}/{user_email}/{user_id}/customer?payment=success"
    )


@router.post("/payment/verify/esewa")
def verify_esewa_manual(body: VerifyEsewa):
    """Manual eSewa verification for Swagger/Postman testing."""
    resp = requests.get(
        f"{ESEWA_BASE_URL}/api/epay/transaction/status/",
        params={
            "product_code":     ESEWA_MERCHANT_CODE,
            "total_amount":     body.total_amount,
            "transaction_uuid": body.transaction_uuid,
        }
    )
    data = resp.json()

    if data.get("status") == "COMPLETE":
        ref_id = data.get("ref_id", body.transaction_uuid)

        save_payment(
            task_id=body.task_id,
            payment_type="customer_payment",
            direction="inbound",
            amount=body.total_amount,
            method="esewa",
            status="success",
            transaction_uuid=body.transaction_uuid,
            gateway_ref=ref_id,
            raw_response=data,
        )

        collection_task.update_one(
            {"_id": ObjectId(body.task_id)},
            {"$set": {
                "payment_status": "paid",
                "escrow_status":  "held",
                "esewa_ref_id":   ref_id,
                "payment_method": "esewa",
                "paid_at":        datetime.utcnow(),
            }}
        )
        return {"message": "Payment verified. Funds held in escrow.", "status": "success"}

    return {"message": "Payment not completed", "status": data.get("status")}


# ══════════════════════════════════════════════════════════════════════════════
# Khalti PAYMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/task/{task_id}/pay/khalti")
def pay_via_khalti(task_id: str):
    """Initiate Khalti payment — returns pidx for frontend."""
    task = get_task_or_404(task_id)

    if task.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Task already paid")

    total_amount_paisa = int(task["totalCost"]) * 100   # Khalti uses paisa
    task_name          = task.get("taskName") or task.get("taskDescrip", "Task Payment")
    transaction_uuid   = str(uuid.uuid4())

    payload = {
        "return_url":         f"http://localhost:8000/payment/verify/khalti/{task_id}",
        "website_url":        BASE_URL,
        "amount":             total_amount_paisa,
        "purchase_order_id":  transaction_uuid,
        "purchase_order_name": task_name,
    }

    resp = requests.post(
        f"{KHALTI_BASE_URL}/api/v2/epayment/initiate/",
        json=payload,
        headers={
            "Authorization":  f"Key {KHALTI_SECRET_KEY}",
            "Content-Type":   "application/json",
        }
    )
    data = resp.json()

    if resp.status_code != 200 or not data.get("pidx"):
        raise HTTPException(status_code=400, detail=f"Khalti initiation failed: {data}")

    pidx = data["pidx"]

    # Save pending payment record
    save_payment(
        task_id=task_id,
        payment_type="customer_payment",
        direction="inbound",
        amount=task["totalCost"],
        method="khalti",
        status="pending",
        transaction_uuid=transaction_uuid,
        gateway_ref=pidx,
        raw_response=data,
    )

    # Update task
    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "khalti_pidx":      pidx,
            "payment_method":   "khalti",
            "payment_status":   "unpaid",
            "escrow_status":    "pending",
        }}
    )

    return {
        "payment_url": data.get("payment_url"),
        "pidx":        pidx,
    }


@router.get("/payment/verify/khalti/{task_id}")
def verify_khalti_redirect(
    task_id: str,
    pidx:    Optional[str] = Query(None),
    status:  Optional[str] = Query(None),
):
    """Khalti redirects here after payment. Verifies and marks task as paid."""
    task = get_task_or_404(task_id)

    if status != "Completed" or not pidx:
        return RedirectResponse(url=f"{BASE_URL}/payment/failed")

    # Lookup pidx with Khalti
    resp = requests.post(
        f"{KHALTI_BASE_URL}/api/v2/epayment/lookup/",
        json={"pidx": pidx},
        headers={
            "Authorization": f"Key {KHALTI_SECRET_KEY}",
            "Content-Type":  "application/json",
        }
    )
    data = resp.json()

    if data.get("status") != "Completed":
        collection_payment.update_one(
            {"task_id": task_id, "method": "khalti", "status": "pending"},
            {"$set": {"status": "failed", "raw_response": data}}
        )
        return RedirectResponse(url=f"{BASE_URL}/payment/failed")

    txn_id = data.get("transaction_id", pidx)
    amount = data.get("total_amount", 0) / 100   # convert paisa back to NPR

    # Update payment record pending → success
    collection_payment.update_one(
        {"task_id": task_id, "method": "khalti", "status": "pending"},
        {"$set": {
            "status":       "success",
            "gateway_ref":  txn_id,
            "amount":       amount,
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
            "khalti_txn_id":  txn_id,
            "payment_method": "khalti",
            "paid_at":        datetime.utcnow(),
        }}
    )

    user_email = task.get("userEmail", "")
    user_id    = str(task.get("userId", ""))

    return RedirectResponse(
        url=f"{BASE_URL}/customer/pay/{task_id}/{user_email}/{user_id}/customer?payment=success"
    )


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOMER RELEASE (Escrow confirmation — no real money moves here)
# ══════════════════════════════════════════════════════════════════════════════

@router.patch("/customer/release/{task_id}")
def release_to_worker(
    task_id:      str,
    current_user: dict = Depends(get_current_user),
):
    """
    Customer confirms they are happy with the work.
    Flips escrow_status: 'held' → 'released'.
    No money moves here — admin payout handles the actual transfer.
    """

    task = get_task_or_404(task_id)

    # ── Auth: only task owner can release ────────────────────────────────────
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
        raise HTTPException(status_code=400, detail="Task has been refunded")
    if task.get("escrow_status") != "held":
        raise HTTPException(status_code=400, detail="Escrow is not in held state")

    # ── Validate payment reference (eSewa or Khalti) ──────────────────────────
    payment_ref = (
        task.get("esewa_ref_id") or
        task.get("khalti_pidx") or
        task.get("khalti_txn_id") or
        task.get("esewa_transaction_uuid")
    )
    if not payment_ref:
        raise HTTPException(status_code=400, detail="No payment reference found on this task")

    # ── Validate amount ───────────────────────────────────────────────────────
    final_price = float(task.get("totalCost") or task.get("basePrice") or 0)
    if final_price <= 0:
        raise HTTPException(status_code=400, detail="Invalid task amount")

    # ── Calculate payout split ────────────────────────────────────────────────
    platform_fee  = round(final_price * 0.05, 2)    # 5% platform cut
    worker_payout = round(final_price - platform_fee, 2)

    # ── Find worker ───────────────────────────────────────────────────────────
    worker_id = task.get("assignedWorkerId")
    if not worker_id:
        raise HTTPException(status_code=400, detail="No worker assigned to this task")

    worker = collection_worker.find_one({"email": worker_id})
    if not worker:
        raise HTTPException(status_code=404, detail="Assigned worker not found")

    now = datetime.utcnow()

    # ── Update task — release escrow ──────────────────────────────────────────
    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "escrow_status": "released",
            "released_at":   now,
            "platform_fee":  platform_fee,
            "worker_payout": worker_payout,
        }}
    )

    # ── Save release event in payments collection ─────────────────────────────
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
        "message":       "Payment released. Worker will be paid shortly.",
        "task_id":       task_id,
        "total_cost":    final_price,
        "platform_fee":  platform_fee,
        "worker_payout": worker_payout,
        "released_at":   now.isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════════
# PAYMENT HISTORY — query by task
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/payments/task/{task_id}")
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