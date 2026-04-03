from fastapi import APIRouter, HTTPException, Form
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId
from bson import errors as bson_errors
from ..config import database
from ..services.esewaService import refund_to_customer, disburse_to_worker
import asyncio
import uuid

router = APIRouter(tags=["refunds"])

from pydantic import BaseModel
from ..config.database import refund_collection, collection_reports, collection_task, collection


# ─────────────────────────────────────────────────────────────
# Schema
# ─────────────────────────────────────────────────────────────
class CreateRefundBody(BaseModel):
    taskId:   Optional[str] = None
    reportId: str
    reason:   str
    notes:    Optional[str] = None


# ─────────────────────────────────────────────────────────────
# POST /api/refunds - Create new refund
# ─────────────────────────────────────────────────────────────
@router.post("/refunds")
def create_refund(body: CreateRefundBody):
    try:
        report = collection_reports.find_one({"_id": ObjectId(body.reportId)})
    except bson_errors.InvalidId:
        raise HTTPException(status_code=400, detail="Invalid reportId")

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    task = None
    total_amount = None

    if body.taskId:
        try:
            task = collection_task.find_one({"_id": ObjectId(body.taskId)})
        except bson_errors.InvalidId:
            raise HTTPException(status_code=400, detail="Invalid taskId")

        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        total_amount = task.get("totalCost")

        collection_task.update_one(
            {"_id": ObjectId(body.taskId)},
            {"$set": {"taskStatus": "dispute", "disputedAt": datetime.utcnow()}},
        )

    refund_doc = {
        "task_id":         body.taskId,
        "report_id":       body.reportId,
        "requester_id":    report.get("reporterId"),
        "reported_id":     report.get("reportedId"),
        "requester_type":  report.get("reporterType", "customer"),
        "reported_type":   report.get("reportedType", "worker"),
        "reason":          body.reason,
        "notes":           body.notes,
        "total_amount":    total_amount,
        "amount_customer": None,
        "amount_worker":   None,
        "status":          "pending",
        "created_at":      datetime.utcnow(),
        "evidence_files":  [],
        "esewa_ref_id": task.get("esewa_ref_id") if task else None,
    }

    result    = refund_collection.insert_one(refund_doc)
    refund_id = str(result.inserted_id)

    if body.taskId:
        collection_task.update_one(
            {"_id": ObjectId(body.taskId)},
            {"$set": {"refund_id": refund_id}},
        )

    collection_reports.update_one(
        {"_id": ObjectId(body.reportId)},
        {"$set": {
            "refundStatus": "pending",
            "refund_id":    refund_id,
        }},
    )

    refund_doc["id"] = refund_id
    refund_doc.pop("_id", None)
    return refund_doc


# ─────────────────────────────────────────────────────────────
# GET /api/refunds - List all refunds
# ─────────────────────────────────────────────────────────────
@router.get("/refunds")
def get_refunds(
    report_id: Optional[str] = None,
    skip:      int = 0,
    limit:     int = 50,
):
    query = {}
    if report_id:
        query["report_id"] = report_id

    docs  = list(refund_collection.find(query).skip(skip).limit(limit).sort("created_at", -1))
    total = refund_collection.count_documents(query)

    for d in docs:
        d["id"] = str(d["_id"])
        d.pop("_id", None)

    return {"refunds": docs, "total": total}


# ─────────────────────────────────────────────────────────────
# GET /api/refunds/pending
# ─────────────────────────────────────────────────────────────
@router.get("/refunds/pending")
async def list_pending_refunds():
    docs = list(database.refund_collection.find(
        {"status": "pending"}
    ).sort("created_at", -1))

    for d in docs:
        d["id"] = str(d["_id"])
        d.pop("_id", None)
        if d.get("task_id"):
            try:
                task = database.collection_task.find_one({"_id": ObjectId(d["task_id"])})
                if task:
                    d["task_name"]   = task.get("taskName")
                    d["task_status"] = task.get("status")
            except Exception:
                pass

    return {"refunds": docs}


# ─────────────────────────────────────────────────────────────
# GET /api/refunds/approved
# ─────────────────────────────────────────────────────────────
@router.get("/refunds/approved")
async def list_approved_refunds():
    docs = list(database.refund_collection.find(
        {"status": {"$in": ["approved", "refunded"]}}
    ).sort("resolved_at", -1))

    for d in docs:
        d["id"] = str(d["_id"])
        d.pop("_id", None)
        if d.get("task_id"):
            try:
                task = database.collection_task.find_one({"_id": ObjectId(d["task_id"])})
                if task:
                    d["task_name"] = task.get("taskName")
            except Exception:
                pass

    return {"refunds": docs}


# ─────────────────────────────────────────────────────────────
# GET /api/refunds/rejected
# ─────────────────────────────────────────────────────────────
@router.get("/refunds/rejected")
async def list_rejected_refunds():
    docs = list(database.refund_collection.find(
        {"status": {"$in": ["rejected", "declined"]}}
    ).sort("resolved_at", -1))

    for d in docs:
        d["id"] = str(d["_id"])
        d.pop("_id", None)
        if d.get("task_id"):
            try:
                task = database.collection_task.find_one({"_id": ObjectId(d["task_id"])})
                if task:
                    d["task_name"] = task.get("taskName")
            except Exception:
                pass

    return {"refunds": docs}


# ─────────────────────────────────────────────────────────────
# GET /api/refunds/in-progress
# ─────────────────────────────────────────────────────────────
@router.get("/refunds/in-progress")
async def list_in_progress_refunds():
    """
    Refunds where admin has set amounts but eSewa disbursement hasn't happened yet.
    These are ready for Pay All processing.
    """
    docs = list(database.refund_collection.find(
        {"status": {"$in": ["refund_in_progress", "processing"]}}
    ).sort("created_at", -1))

    for d in docs:
        d["id"] = str(d["_id"])
        d.pop("_id", None)
        if d.get("task_id"):
            try:
                task = database.collection_task.find_one({"_id": ObjectId(d["task_id"])})
                if task:
                    d["task_name"] = task.get("taskName")
            except Exception:
                pass

    return {"refunds": docs}


# ─────────────────────────────────────────────────────────────
# PATCH /api/update-status/{refund_id}
# UPDATED WITH MOCK MODE
# ─────────────────────────────────────────────────────────────
@router.patch("/update-status/{refund_id}")
async def update_refund_status(
    refund_id:       str,
    status:          str           = Form(...),
    amount_customer: float | None  = Form(None),
    amount_worker:   float | None  = Form(None),
    admin_note:      str           = Form(""),
    sandbox:         bool          = Form(True)  # ← ADDED: Mock mode enabled by default
):
    """
    Admin sets status + amounts.

    - "approved"  → records amounts, sets status to "refund_in_progress".
                    With sandbox=True: Mocks eSewa response
                    With sandbox=False: Calls real eSewa API (needs production)
    - "declined"  → sets status to "declined". No eSewa.
    """
    if status not in ("approved", "declined"):
        raise HTTPException(status_code=400, detail="Invalid status. Use 'approved' or 'declined'.")

    try:
        obj_id = ObjectId(refund_id)
    except bson_errors.InvalidId:
        raise HTTPException(status_code=400, detail="Invalid refund ID")

    refund = database.refund_collection.find_one({"_id": obj_id})
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")

    if status == "approved" and amount_customer is None:
        raise HTTPException(status_code=400, detail="Customer refund amount is required for approval.")

    task_id = refund.get("task_id")
    esewa_refund_result = None

    if status == "approved":
        if not task_id:
            raise HTTPException(status_code=400, detail="No task associated with this refund.")

        try:
            task = database.collection_task.find_one({"_id": ObjectId(task_id)})
        except bson_errors.InvalidId:
            raise HTTPException(status_code=400, detail="Invalid task ID on refund.")

        total_paid = float(task.get("totalCost") or task.get("basePrice") or 0)
        if amount_customer > total_paid:
            raise HTTPException(
                status_code=400,
                detail=f"Refund amount ({amount_customer}) exceeds what the customer paid ({total_paid})."
            )

        # Get customer eSewa ID
        customer_esewa_id = None
        customer_id = refund.get("requester_id")
        customer = None
        
        if customer_id:
            try:
                from ..config import database as db
                customer = db.collection.find_one({"_id": ObjectId(customer_id)})
                if customer:
                    customer_esewa_id = customer.get("phoneNo") or customer.get("esewaId") or customer.get("phone")
            except Exception as e:
                print(f"[REFUND] Customer lookup failed: {e}")

        transaction_uuid = str(uuid.uuid4())
        
        # ── MOCK OR REAL eSEWA CALL ──
        if sandbox:
            # ✅ MOCK RESPONSE - No real API call
            esewa_refund_result = {
                "status": "mock_success",
                "transaction_uuid": transaction_uuid,
                "esewa_id": customer_esewa_id,
                "note": "MOCK refund - sandbox mode (no actual money transferred)",
                "timestamp": datetime.utcnow().isoformat()
            }
            refund_success = True
        else:
            # ❌ REAL eSewa API call (needs production credentials)
            if customer_esewa_id:
                try:
                    # Get esewa_ref_id from task
                    esewa_ref_id = refund.get("esewa_ref_id") or task.get("esewa_ref_id")
                    
                    if esewa_ref_id:
                        esewa_ok, api_resp = await refund_to_customer(
                            esewa_id=customer_esewa_id,
                            amount=amount_customer,
                            esewa_ref_id=esewa_ref_id,
                            remarks=f"Refund: {refund.get('reason', 'task dispute')[:50]}",
                            idempotency_key=f"refund-{refund_id}",
                        )
                        
                        if esewa_ok:
                            esewa_refund_result = {
                                "status": "sent",
                                "transaction_uuid": api_resp.get("transaction_uuid"),
                                "esewa_id": customer_esewa_id,
                                "timestamp": datetime.utcnow().isoformat()
                            }
                            refund_success = True
                        else:
                            esewa_refund_result = {
                                "status": "failed",
                                "error": api_resp.get("message", "Unknown error"),
                                "esewa_id": customer_esewa_id,
                                "timestamp": datetime.utcnow().isoformat()
                            }
                            refund_success = False
                    else:
                        esewa_refund_result = {
                            "status": "no_ref_id",
                            "error": "No eSewa transaction reference found",
                            "timestamp": datetime.utcnow().isoformat()
                        }
                        refund_success = False
                except Exception as e:
                    esewa_refund_result = {
                        "status": "error",
                        "error": str(e),
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    refund_success = False
            else:
                esewa_refund_result = {
                    "status": "no_esewa_id",
                    "note": "Customer has no eSewa ID. Process refund manually.",
                    "timestamp": datetime.utcnow().isoformat()
                }
                refund_success = False

        if sandbox or refund_success:
            update_fields = {
                "status":          "refunded" if (sandbox or refund_success) else "refund_in_progress",
                "amount_customer": amount_customer,
                "amount_worker":   amount_worker or 0.0,
                "admin_note":      admin_note,
                "approved_at":     datetime.utcnow(),
                "resolved_at":     datetime.utcnow(),
                "sandbox_mode":    sandbox,
                "refund_transaction": transaction_uuid if sandbox else (esewa_refund_result.get("transaction_uuid") if esewa_refund_result else None),
                "esewa_refund_response": esewa_refund_result,
            }
        else:
            update_fields = {
                "status":          "refund_failed",
                "amount_customer": amount_customer,
                "amount_worker":   amount_worker or 0.0,
                "admin_note":      admin_note,
                "approved_at":     datetime.utcnow(),
                "resolved_at":     datetime.utcnow(),
                "sandbox_mode":    sandbox,
                "esewa_refund_response": esewa_refund_result,
            }

        # Mark task as approved/pending-refund
        database.collection_task.update_one(
            {"_id": ObjectId(task_id)},
            {"$set": {"taskStatus": "refund_approved" if not refund_success else "refunded"}}
        )

    else:
        # declined
        update_fields = {
            "status":      "declined",
            "admin_note":  admin_note,
            "resolved_at": datetime.utcnow(),
        }

    database.refund_collection.update_one({"_id": obj_id}, {"$set": update_fields})

    return {
        "message":         f"Refund {status} successfully. Status set to '{update_fields['status']}'.{' (MOCK MODE)' if sandbox and status == 'approved' else ''}",
        "refund_id":       refund_id,
        "status":          update_fields["status"],
        "amount_customer": update_fields.get("amount_customer"),
        "amount_worker":   update_fields.get("amount_worker"),
        "admin_note":      admin_note,
        "resolved_at":     update_fields.get("resolved_at"),
        "sandbox_mode":    sandbox if status == "approved" else None,
        "esewa_refund":    esewa_refund_result if status == "approved" else None,
    }


# ─────────────────────────────────────────────────────────────
# POST /api/refunds/pay-all-in-progress
# UPDATED WITH MOCK MODE
# ─────────────────────────────────────────────────────────────
@router.post("/refunds/pay-all-in-progress")
async def pay_all_in_progress_refunds(sandbox: bool = True):  # ← ADDED sandbox parameter
    """
    Process all in-progress refunds.
    sandbox=True: Mock eSewa responses (for testing)
    sandbox=False: Call real eSewa API (needs production credentials)
    """
    in_progress = list(database.refund_collection.find({
        "status": {"$in": ["refund_in_progress", "processing"]},
        "amount_customer": {"$exists": True, "$ne": None, "$gt": 0}
    }))

    if not in_progress:
        raise HTTPException(status_code=400, detail="No in-progress refunds to process.")

    success      = []
    failed       = []
    total_amount = sum(r.get("amount_customer", 0) for r in in_progress)

    for refund in in_progress:
        refund_id       = str(refund["_id"])
        amount_customer = float(refund.get("amount_customer", 0))
        amount_worker   = float(refund.get("amount_worker", 0))
        task_id         = refund.get("task_id")

        # ── 1. Resolve esewa_ref_id ──
        esewa_ref_id = refund.get("esewa_ref_id")
        if not esewa_ref_id and task_id:
            try:
                task = database.collection_task.find_one({"_id": ObjectId(task_id)})
                if task:
                    esewa_ref_id = task.get("esewa_ref_id")
                    if esewa_ref_id:
                        database.refund_collection.update_one(
                            {"_id": refund["_id"]},
                            {"$set": {"esewa_ref_id": esewa_ref_id}}
                        )
            except Exception as e:
                print(f"[pay-all] Could not fetch esewa_ref_id: {e}")

        if not esewa_ref_id and not sandbox:
            failed.append({
                "refund_id": refund_id,
                "amount":    amount_customer,
                "error":     "No eSewa transaction reference found — cannot process.",
            })
            continue

        # ── 2. Resolve customer eSewa ID ──
        customer_id       = refund.get("requester_id")
        customer_esewa_id = None
        customer = None

        if customer_id:
            try:
                customer = database.collection.find_one({"_id": ObjectId(customer_id)})
                if customer:
                    customer_esewa_id = (
                        customer.get("esewaId")
                        or customer.get("esewa_id")
                        or customer.get("phone")
                        or customer.get("phoneNo")
                    )
            except Exception as e:
                print(f"[pay-all] Error fetching customer: {e}")

        if not customer_esewa_id and not sandbox:
            failed.append({
                "refund_id": refund_id,
                "amount":    amount_customer,
                "error":     "Customer has no eSewa ID on file — process manually.",
            })
            continue

        # ── 3. Resolve worker phone ──
        worker_esewa_id = None
        if amount_worker > 0:
            reported_id = refund.get("reported_id")
            if reported_id:
                try:
                    worker = database.collection_worker.find_one({"_id": (reported_id)})
                    if worker:
                        worker_esewa_id = (
                            worker.get("phoneNo")
                            or worker.get("phone")
                            or worker.get("mobile")
                        )
                except Exception as e:
                    print(f"[pay-all] Error fetching worker: {e}")

        transaction_uuid = str(uuid.uuid4())
        
        # ── 4. MOCK OR REAL CUSTOMER REFUND ──
        customer_result = None
        
        if sandbox:
            # ✅ MOCK RESPONSE
            customer_result = {
                "status": "mock_success",
                "transaction_uuid": transaction_uuid,
                "esewa_id": customer_esewa_id,
                "esewa_ref_id": esewa_ref_id,
                "note": "MOCK refund - sandbox mode (no actual money transferred)",
                "timestamp": datetime.utcnow().isoformat()
            }
            customer_sent = True
        else:
            # REAL eSewa API call
            try:
                esewa_ok, api_resp = await refund_to_customer(
                    esewa_id=customer_esewa_id,
                    amount=amount_customer,
                    esewa_ref_id=esewa_ref_id,
                    remarks=f"Refund: {refund.get('reason', 'task dispute')[:50]}",
                    idempotency_key=f"pay-all-cust-{refund_id}",
                )

                customer_result = {
                    "status": "sent" if esewa_ok else "failed",
                    "transaction_uuid": api_resp.get("transaction_uuid") if esewa_ok else None,
                    "esewa_id": customer_esewa_id,
                    "esewa_ref_id": esewa_ref_id,
                    "error": None if esewa_ok else api_resp.get("message"),
                    "timestamp": datetime.utcnow().isoformat(),
                }
                customer_sent = esewa_ok
            except Exception as e:
                customer_result = {
                    "status": "error",
                    "error": str(e),
                    "esewa_id": customer_esewa_id,
                    "timestamp": datetime.utcnow().isoformat(),
                }
                customer_sent = False

        # ── 5. MOCK OR REAL WORKER PAYOUT ──
        worker_result = None
        if amount_worker > 0:
            if sandbox:
                # ✅ MOCK RESPONSE
                worker_result = {
                    "status": "mock_success",
                    "transaction_uuid": str(uuid.uuid4()),
                    "phone": worker_esewa_id,
                    "note": "MOCK payout - sandbox mode (no actual money transferred)",
                    "timestamp": datetime.utcnow().isoformat(),
                }
            elif worker_esewa_id:
                try:
                    w_ok, w_resp = await disburse_to_worker(
                        phone=worker_esewa_id,
                        amount=amount_worker,
                        remarks=f"Penalty: {refund.get('reason', 'dispute')[:50]}",
                        idempotency_key=f"pay-all-wrkr-{refund_id}",
                    )
                    worker_result = {
                        "status": "sent" if w_ok else "failed",
                        "transaction_uuid": w_resp.get("transaction_uuid") if w_ok else None,
                        "error": None if w_ok else w_resp.get("message"),
                        "phone": worker_esewa_id,
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                except Exception as e:
                    worker_result = {
                        "status": "error",
                        "error": str(e),
                        "phone": worker_esewa_id,
                        "timestamp": datetime.utcnow().isoformat(),
                    }
            else:
                worker_result = {
                    "status": "no_phone",
                    "note": "Worker has no phone number on file — process manually.",
                    "timestamp": datetime.utcnow().isoformat(),
                }

        # ── 6. Persist result ──
        new_status = "refunded" if (sandbox or customer_sent) else "refund_in_progress"

        database.refund_collection.update_one(
            {"_id": refund["_id"]},
            {"$set": {
                "status":          new_status,
                "esewa_refund":    customer_result,
                "worker_payout":   worker_result,
                "processed_at":    datetime.utcnow(),
                "bulk_processed":  True,
                "sandbox_mode":    sandbox,
                "transaction_uuid": transaction_uuid if sandbox else None,
            }}
        )

        if (sandbox or customer_sent) and task_id:
            try:
                database.collection_task.update_one(
                    {"_id": ObjectId(task_id)},
                    {"$set": {
                        "taskStatus":       "refunded",
                        "bulk_refunded_at": datetime.utcnow(),
                    }}
                )
            except Exception:
                pass

        if sandbox or customer_sent:
            success.append({
                "refund_id":        refund_id,
                "amount":           amount_customer,
                "customer_esewa":   customer_esewa_id,
                "transaction_uuid": transaction_uuid if sandbox else customer_result.get("transaction_uuid"),
                "sandbox_mode":     sandbox,
                "worker_payout":    worker_result,
            })
        else:
            failed.append({
                "refund_id":     refund_id,
                "amount":        amount_customer,
                "error":         customer_result.get("error") or "eSewa disbursement failed",
                "worker_payout": worker_result,
            })

    mock_note = " (MOCK MODE - No actual money transferred)" if sandbox else ""
    
    return {
        "message":              f"Processed {len(in_progress)} refunds: {len(success)} succeeded, {len(failed)} failed.{mock_note}",
        "success":              success,
        "failed":               failed,
        "total_processed":      len(in_progress),
        "total_amount":         total_amount,
        "total_success_amount": sum(s.get("amount", 0) for s in success),
        "sandbox_mode":         sandbox,
    }


# ── Kept for compatibility ──
@router.post("/refunds/bulk-process")
async def bulk_process_refunds(sandbox: bool = True):
    return await pay_all_in_progress_refunds(sandbox=sandbox)


# ─────────────────────────────────────────────────────────────
# Existing legacy endpoints
# ─────────────────────────────────────────────────────────────
@router.patch("/{refund_id}/approve")
async def approve_refund(refund_id: str, admin_note: str = ""):
    from ..repository.refundRepo import update_refund_status
    result = await update_refund_status(refund_id, "approved", admin_note)
    if not result:
        raise HTTPException(404, "Refund not found")
    return {"message": "Refund approved", "refund": result}


@router.patch("/{refund_id}/reject")
async def reject_refund(refund_id: str, admin_note: str):
    from ..repository.refundRepo import update_refund_status
    result = await update_refund_status(refund_id, "rejected", admin_note)
    if not result:
        raise HTTPException(404, "Refund not found")
    return {"message": "Refund rejected", "refund": result}


class RefundUpdateSchema(BaseModel):
    amount_customer: float
    amount_worker:   float
    reason:          Optional[str] = "Manual adjustment"
    requested_by:    str
    status:          str = "refund_in_progress"
    admin_note:      Optional[str] = None


@router.patch("/refunds/upsert/{task_id}")
async def upsert_refund(task_id: str, data: RefundUpdateSchema):
    from pymongo import ReturnDocument

    now = datetime.now(timezone.utc)

    update_op = {
        "$set": {
            "amount_customer": data.amount_customer,
            "amount_worker":   data.amount_worker,
            "status":          data.status,
            "reason":          data.reason,
            "updated_at":      now,
        },
        "$setOnInsert": {
            "_id":          str(uuid.uuid4()),
            "task_id":      task_id,
            "created_at":   now,
            "requested_by": data.requested_by,
        }
    }

    if data.status == "refund_in_progress":
        update_op["$set"]["requested_at"] = now

    try:
        result = refund_collection.find_one_and_update(
            {"task_id": task_id},
            update_op,
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

        if not result:
            raise HTTPException(status_code=404, detail="Update failed")

        result["id"] = str(result["_id"])
        del result["_id"]
        return result

    except Exception as e:
        print(f"Error in upsert_refund: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def refund_history(skip: int = 0, limit: int = 50):
    from ..repository.refundRepo import list_refunds

    refunds = await list_refunds(skip=skip, limit=limit)

    for r in refunds:
        if r.get("task_id"):
            try:
                task = database.collection_task.find_one({"_id": ObjectId(r["task_id"])})
                if task:
                    r["task_name"] = task.get("taskName")

                customer = database.collection.find_one({"_id": ObjectId(r["requester_id"])})
                if customer:
                    r["customer_name"]  = customer.get("name")
                    r["customer_email"] = customer.get("email")
            except Exception:
                pass

    return {"refunds": refunds, "skip": skip, "limit": limit}