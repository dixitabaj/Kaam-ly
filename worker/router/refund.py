from fastapi import APIRouter, HTTPException, Form
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId
from ..config import database
from ..services.esewaService import disburse_to_worker

router = APIRouter(prefix="/admin/refunds", tags=["Admin Refunds"])

@router.patch("/update-status/{refund_id}")
def update_refund_status(
    refund_id: str,
    status: str = Form(...),               # "approved" or "declined"
    amount_customer: float | None = Form(None),
    amount_worker: float | None = Form(None),
    admin_note: str = Form("")
):
    """
    Admin approves or declines a refund request and sets the amounts.
    Ensures the customer refund does not exceed what they paid.
    """
    if status not in ("approved", "declined"):
        raise HTTPException(status_code=400, detail="Invalid status")

    try:
        obj_id = ObjectId(refund_id)
    except bson_errors.InvalidId:
        raise HTTPException(status_code=400, detail="Invalid refund ID")

    refund = database.refund_collection.find_one({"_id": obj_id})
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")

    # If approved, amount_customer must be set
    if status == "approved" and amount_customer is None:
        raise HTTPException(status_code=400, detail="Customer refund amount must be specified for approval")

    # Validate that refund does not exceed customer payment
    if status == "approved":
        task_id = refund.get("task_id")
        if not task_id:
            raise HTTPException(status_code=400, detail="No task associated with this refund")
        
        try:
            task = database.collection_task.find_one({"_id": ObjectId(task_id)})
        except bson_errors.InvalidId:
            raise HTTPException(status_code=400, detail="Invalid task ID")

        total_paid = float(task.get("totalCost") or task.get("basePrice") or 0)
        if amount_customer > total_paid:
            raise HTTPException(
                status_code=400,
                detail=f"Refund amount cannot exceed what the customer paid ({total_paid})"
            )

    update_fields = {
        "status": status,
        "admin_note": admin_note,
        "resolved_at": datetime.utcnow(),
    }

    if status == "approved":
        update_fields["amount_customer"] = amount_customer
        update_fields["amount_worker"] = amount_worker or 0.0

        # Optional: Update the corresponding task's status to "refunded"
        if task_id:
            database.collection_task.update_one(
                {"_id": ObjectId(task_id)},
                {"$set": {"taskStatus": "refunded"}}
            )

    database.refund_collection.update_one({"_id": obj_id}, {"$set": update_fields})

    return {
        "message": f"Refund request {status} successfully",
        "refund_id": refund_id,
        "status": status,
        "amount_customer": update_fields.get("amount_customer"),
        "amount_worker": update_fields.get("amount_worker"),
        "admin_note": admin_note,
        "resolved_at": update_fields.get("resolved_at"),
    }

@router.get("/pending")
async def list_pending_refunds():
    """All refunds waiting for admin approval."""
    docs = list(database.refund_collection.find(
        {"status": "pending"}
    ).sort("created_at", -1))
    
    for d in docs:
        d["id"] = str(d["_id"])
        # Convert task_id to get task details
        try:
            task = database.collection_task.find_one({"_id": ObjectId(d["task_id"])})
            if task:
                d["task_name"] = task.get("taskName")
                d["task_status"] = task.get("status")
        except:
            pass
    
    return {"refunds": docs}


@router.get("/pending-disbursements")
async def list_pending_worker_disbursements():
    """
    All worker disbursements that failed or are pending manual processing.
    These are stored on refund records under worker_disbursement.
    """
    docs = list(database.refund_collection.find({
        "worker_disbursement.status": {"$in": ["pending", "pending_manual", "queued_api_error"]}
    }).sort("created_at", -1))
    
    result = []
    for d in docs:
        wd = d.get("worker_disbursement", {})
        if wd:
            # Get worker details
            try:
                worker = database.collection_worker.find_one({"_id": ObjectId(wd["worker_id"])})
                worker_name = worker.get("name", "Unknown") if worker else "Unknown"
                worker_email = worker.get("email", "") if worker else ""
            except:
                worker_name = "Unknown"
                worker_email = ""
            
            result.append({
                "refund_id": str(d["_id"]),
                "worker_id": wd["worker_id"],
                "worker_name": worker_name,
                "worker_email": worker_email,
                "esewa_id": wd.get("esewa_id"),
                "amount": wd["amount"],
                "reason": wd["reason"],
                "status": wd["status"],
                "created_at": wd["created_at"],
                "task_id": d["task_id"],
            })
    
    return {"pending_disbursements": result}


@router.patch("/{refund_id}/approve")
async def approve_refund(refund_id: str, admin_note: str = ""):
    """
    Admin approves a refund. This triggers:
    1. Customer eSewa refund (if amount_customer > 0)
    2. Worker disbursement (if amount_worker > 0 and not already processed)
    """
    from ..repository.refundRepo import update_refund_status
    
    result = await update_refund_status(refund_id, "approved", admin_note)
    if not result:
        raise HTTPException(404, "Refund not found")
    
    return {"message": "Refund approved", "refund": result}


@router.patch("/{refund_id}/reject")
async def reject_refund(refund_id: str, admin_note: str):
    """Admin rejects a refund request."""
    from ..repository.refundRepo import update_refund_status
    
    result = await update_refund_status(refund_id, "rejected", admin_note)
    if not result:
        raise HTTPException(404, "Refund not found")
    
    return {"message": "Refund rejected", "refund": result}


@router.patch("/disbursement/{refund_id}/mark-paid")
async def mark_disbursement_paid(refund_id: str, admin_note: str = ""):
    """
    Admin calls this after manually sending money to worker via eSewa merchant panel.
    Dashboard → Disburse → Enter worker eSewa ID and amount shown in the record.
    """
    refund = database.refund_collection.find_one({"_id": refund_id})
    if not refund or not refund.get("worker_disbursement"):
        raise HTTPException(404, "Disbursement record not found")
    
    database.refund_collection.update_one(
        {"_id": refund_id},
        {"$set": {
            "worker_disbursement.status": "paid",
            "worker_disbursement.processed_at": datetime.now(timezone.utc),
            "worker_disbursement.admin_note": admin_note,
        }}
    )
    
    return {"message": "Disbursement marked as paid"}


@router.patch("/disbursement/{refund_id}/retry")
async def retry_disbursement(refund_id: str):
    """Re-attempt a failed eSewa disbursement once enterprise API is configured."""
    refund = database.refund_collection.find_one({"_id": refund_id})
    if not refund or not refund.get("worker_disbursement"):
        raise HTTPException(404, "Disbursement record not found")
    
    wd = refund["worker_disbursement"]
    
    if not wd.get("esewa_id"):
        raise HTTPException(400, "No eSewa ID available. Manual processing required.")
    
    success, api_res = await disburse_to_worker(
        wd["esewa_id"], 
        wd["amount"],
        remarks=wd.get("reason", ""),
        idempotency_key=f"retry-{refund_id}",
    )
    
    new_status = "paid" if success else "queued_api_error"
    
    database.refund_collection.update_one(
        {"_id": refund_id},
        {"$set": {
            "worker_disbursement.status": new_status,
            "worker_disbursement.processed_at": datetime.now(timezone.utc) if success else None,
            "worker_disbursement.disburse_response": api_res,
        }}
    )
    
    return {
        "status": new_status, 
        "response": api_res,
        "message": "Disbursement successful" if success else "Disbursement failed"
    }


@router.get("/history")
async def refund_history(skip: int = 0, limit: int = 50):
    """Get all refunds (approved, rejected, pending) with pagination."""
    from ..repository.refundRepo import list_refunds
    
    refunds = await list_refunds(skip=skip, limit=limit)
    
    # Enrich with task and user details
    for r in refunds:
        try:
            task = database.collection_task.find_one({"_id": ObjectId(r["task_id"])})
            if task:
                r["task_name"] = task.get("taskName")
                
            customer = database.collection.find_one({"_id": ObjectId(r["requester_id"])})
            if customer:
                r["customer_name"] = customer.get("name")
                r["customer_email"] = customer.get("email")
        except:
            pass
    
    return {"refunds": refunds, "skip": skip, "limit": limit}