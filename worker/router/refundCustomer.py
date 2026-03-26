import os
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Optional
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime
from ..config import database
from ..repository.refundRepo import create_refund
from ..services.uploadService import upload_file

router = APIRouter(prefix="/refunds", tags=["Refunds"])

# ───────────────────────────────
# Refund Request Schema
# ───────────────────────────────
class RefundRequest(BaseModel):
    task_id: str
    reason: str
    evidence_files: Optional[List[UploadFile]] = None


# ───────────────────────────────
# Customer requests a refund
# ───────────────────────────────
@router.post("/request")
async def request_refund(
    task_id: str = Form(...),
    reason: str = Form(...),
    evidence_files: Optional[List[UploadFile]] = File(None)
):
    # Validate task ID
    try:
        task_obj_id = ObjectId(task_id)
    except:
        raise HTTPException(400, "Invalid task ID")

    task = database.collection_task.find_one({"_id": task_obj_id})
    if not task:
        raise HTTPException(404, "Task not found")

    # Check if refund already exists
    existing = database.refund_collection.find_one({"task_id": task_id})
    if existing:
        raise HTTPException(400, "Refund request already exists for this task")

    # Upload evidence files if provided
    evidence_urls = []
    if evidence_files:
        for idx, file in enumerate(evidence_files):
            file_bytes = await file.read()
            filename = f"refund-{task_id}-{idx}-{file.filename}"
            upload_result = await upload_file(file_bytes, filename, folder="refund_evidence")
            if upload_result.get("success"):
                evidence_urls.append({
                    "url": upload_result["url"],
                    "public_id": upload_result["public_id"],
                    "filename": file.filename,
                })

    # Create refund request — admin decides amounts later
    refund_doc = await create_refund({
        "task_id": task_id,
        "requester_id": str(task.get("userId")),
        "reported_id": str(task.get("assignedWorkerId")) if task.get("assignedWorkerId") else None,
        "requester_type": "customer",
        "reported_type": "worker",
        "amount_customer": 0.0,  # Admin sets this later
        "amount_worker": 0.0,    # Admin sets this later
        "reason": reason,
        "requested_by": "customer",
        "evidence_files": evidence_urls,
        "status": "pending",
        "created_at": datetime.utcnow(),
    })

    return {
        "message": "Refund request submitted. Admin will review it shortly.",
        "refund_id": str(refund_doc["_id"]),
        "status": refund_doc["status"],
        "evidence_count": len(evidence_urls),
    }


# ───────────────────────────────
# Customer checks their refund requests
# ───────────────────────────────
@router.get("/my-requests")
async def get_my_refund_requests():
    """
    Retrieve all refund requests submitted by the current customer.
    Auth integration needed to get current user ID.
    """
    # current_user_id = get_current_user()
    # For demo, returning all
    refunds = list(database.refund_collection.find().sort("created_at", -1))
    for r in refunds:
        r["id"] = str(r["_id"])
    return {"refunds": refunds}


# ───────────────────────────────
# Customer checks refund status
# ───────────────────────────────
@router.get("/status/{refund_id}")
async def check_refund_status(refund_id: str):
    refund = database.refund_collection.find_one({"_id": refund_id})
    if not refund:
        raise HTTPException(404, "Refund not found")

    status_messages = {
        "pending": "Your refund request is under review by our team.",
        "approved": "Your refund has been approved!",
        "rejected": "Your refund request was not approved.",
    }

    return {
        "refund_id": refund["_id"],
        "task_id": refund["task_id"],
        "status": refund["status"],
        "message": status_messages.get(refund["status"], "Status unknown"),
        "amount_customer": refund.get("amount_customer"),  # Admin decides
        "amount_worker": refund.get("amount_worker"),      # Admin decides
        "reason": refund.get("reason"),
        "admin_note": refund.get("admin_note"),
        "created_at": refund.get("created_at"),
        "resolved_at": refund.get("resolved_at"),
    }


# ───────────────────────────────
# Customer cancels refund request
# ───────────────────────────────
@router.delete("/{refund_id}")
async def cancel_refund_request(refund_id: str):
    refund = database.refund_collection.find_one({"_id": refund_id})
    if not refund:
        raise HTTPException(404, "Refund not found")

    if refund["status"] != "pending":
        raise HTTPException(400, "Cannot cancel refund that has already been processed")

    database.refund_collection.delete_one({"_id": refund_id})
    return {"message": "Refund request cancelled"}