from fastapi import APIRouter, HTTPException, Form
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId
from bson import errors as bson_errors
from ..config import database
from ..services.esewaService import refund_to_customer, disburse_to_worker
import asyncio
import uuid
import asyncio, json
from ..services.emailUtil import send_action_email
from ..router import notifications
from ..manager import websocket_manager

router = APIRouter(tags=["refunds"])

from pydantic import BaseModel
from ..config.database import refund_collection, collection_reports, collection_task, collection
import json
from ..router import notifications          # notify_with_fallback
from ..manager import websocket_manager     # send_to_user
from ..config.database import collection_worker  # already have collection

# ── Paste this Pydantic schema with your other schemas ────────
class RefundActionBody(BaseModel):
    action:        str                # "warn_customer" | "warn_worker" | "suspend_customer" | "suspend_worker"
    duration_days: Optional[int] = None   # required when action contains "suspend"
    message:       Optional[str] = None   # extra admin note shown to user


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
        "refundStatus":    "pending",       # ← lifecycle field, starts as pending
        "created_at":      datetime.utcnow(),
        "evidence_files":  [],
        "esewa_ref_id":    task.get("esewa_ref_id") if task else None,
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
    task_id:   Optional[str] = None,
    skip:      int = 0,
    limit:     int = 50,
):
    query = {}
    if report_id:
        query["report_id"] = report_id
    if task_id:
        query["task_id"] = task_id

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
    # FIX: include refund_in_progress since that is the approved-but-not-yet-paid state
    docs = list(database.refund_collection.find(
        {"status": {"$in": ["refund_in_progress", "refunded"]}}
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
        {"refundStatus": {"$in": ["refund_in_progress", "processing"]}}
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
# ─────────────────────────────────────────────────────────────
# @router.patch("/update-status/{refund_id}")
# async def update_refund_status(
#     refund_id:       str,
#     status:          str           = Form(...),
#     amount_customer: float | None  = Form(None),
#     amount_worker:   float | None  = Form(None),
#     admin_note:      str           = Form(""),
#     sandbox:         bool          = Form(True),
# ):
#     """
#     Admin sets status + amounts.

#     Lifecycle:
#       pending → (admin reviews & sets amounts) → refund_in_progress
#       refund_in_progress → (eSewa succeeds) → refunded
#       refund_in_progress → (eSewa fails)    → refund_in_progress (stays, retry via pay-all)
#       pending → (admin declines)            → declined

#     - "approved"  → sets refundStatus to "refund_in_progress", then attempts eSewa.
#                     If eSewa succeeds → status "refunded", refundStatus "refunded"
#                     If eSewa fails    → status "refund_failed", refundStatus "refund_in_progress"
#                     With sandbox=True: Mocks eSewa response, always marks as refunded
#     - "declined"  → sets status to "declined". No eSewa.
#     """
#     if status not in ("approved", "declined"):
#         raise HTTPException(status_code=400, detail="Invalid status. Use 'approved' or 'declined'.")

#     try:
#         obj_id = ObjectId(refund_id)
#     except bson_errors.InvalidId:
#         raise HTTPException(status_code=400, detail="Invalid refund ID")

#     refund = database.refund_collection.find_one({"_id": obj_id})
#     if not refund:
#         raise HTTPException(status_code=404, detail="Refund not found")

#     if status == "approved" and amount_customer is None:
#         raise HTTPException(status_code=400, detail="Customer refund amount is required for approval.")

#     task_id = refund.get("task_id")
#     esewa_refund_result = None

#     if status == "approved":
#         if not task_id:
#             raise HTTPException(status_code=400, detail="No task associated with this refund.")

#         try:
#             task = database.collection_task.find_one({"_id": ObjectId(task_id)})
#         except bson_errors.InvalidId:
#             raise HTTPException(status_code=400, detail="Invalid task ID on refund.")

#         total_paid = float(task.get("totalCost") or task.get("basePrice") or 0)
#         if amount_customer > total_paid:
#             raise HTTPException(
#                 status_code=400,
#                 detail=f"Refund amount ({amount_customer}) exceeds what the customer paid ({total_paid})."
#             )

#         customer_esewa_id = None
#         customer_id = refund.get("requester_id")

#         if customer_id:
#             try:
#                 from ..config import database as db
#                 customer = db.collection.find_one({"_id": ObjectId(customer_id)})
#                 if customer:
#                     customer_esewa_id = customer.get("phoneNo") or customer.get("esewaId") or customer.get("phone")
#             except Exception as e:
#                 print(f"[REFUND] Customer lookup failed: {e}")

#         transaction_uuid = str(uuid.uuid4())

#         # Mark as refund_in_progress immediately on approval
#         database.refund_collection.update_one(
#             {"_id": obj_id},
#             {"$set": {"refundStatus": "refund_in_progress"}}
#         )

#         if sandbox:
#             esewa_refund_result = {
#                 "status":           "mock_success",
#                 "transaction_uuid": transaction_uuid,
#                 "esewa_id":         customer_esewa_id,
#                 "note":             "MOCK refund - sandbox mode (no actual money transferred)",
#                 "timestamp":        datetime.utcnow().isoformat(),
#             }
#             refund_success = True
#         else:
#             if customer_esewa_id:
#                 try:
#                     esewa_ref_id = refund.get("esewa_ref_id") or task.get("esewa_ref_id")

#                     if esewa_ref_id:
#                         esewa_ok, api_resp = await refund_to_customer(
#                             esewa_id=customer_esewa_id,
#                             amount=amount_customer,
#                             esewa_ref_id=esewa_ref_id,
#                             remarks=f"Refund: {refund.get('reason', 'task dispute')[:50]}",
#                             idempotency_key=f"refund-{refund_id}",
#                         )

#                         if esewa_ok:
#                             esewa_refund_result = {
#                                 "status":           "sent",
#                                 "transaction_uuid": api_resp.get("transaction_uuid"),
#                                 "esewa_id":         customer_esewa_id,
#                                 "timestamp":        datetime.utcnow().isoformat(),
#                             }
#                             refund_success = True
#                         else:
#                             esewa_refund_result = {
#                                 "status":    "failed",
#                                 "error":     api_resp.get("message", "Unknown error"),
#                                 "esewa_id":  customer_esewa_id,
#                                 "timestamp": datetime.utcnow().isoformat(),
#                             }
#                             refund_success = False
#                     else:
#                         esewa_refund_result = {
#                             "status":    "no_ref_id",
#                             "error":     "No eSewa transaction reference found",
#                             "timestamp": datetime.utcnow().isoformat(),
#                         }
#                         refund_success = False
#                 except Exception as e:
#                     esewa_refund_result = {
#                         "status":    "error",
#                         "error":     str(e),
#                         "timestamp": datetime.utcnow().isoformat(),
#                     }
#                     refund_success = False
#             else:
#                 esewa_refund_result = {
#                     "status":    "no_esewa_id",
#                     "note":      "Customer has no eSewa ID. Process refund manually.",
#                     "timestamp": datetime.utcnow().isoformat(),
#                 }
#                 refund_success = False

#         if sandbox or refund_success:
#             update_fields = {
#                 "status":                "refunded",
#                 "refundStatus":          "refunded",        # ← lifecycle: money released
#                 "amount_customer":       amount_customer,
#                 "amount_worker":         amount_worker or 0.0,
#                 "admin_note":            admin_note,
#                 "approved_at":           datetime.utcnow(),
#                 "resolved_at":           datetime.utcnow(),
#                 "sandbox_mode":          sandbox,
#                 "refund_transaction":    transaction_uuid if sandbox else (esewa_refund_result.get("transaction_uuid") if esewa_refund_result else None),
#                 "esewa_refund_response": esewa_refund_result,
#             }
#         else:
#             update_fields = {
#                 "status":                "refund_failed",
#                 "refundStatus":          "refund_in_progress",  # ← stays in_progress so pay-all can retry
#                 "amount_customer":       amount_customer,
#                 "amount_worker":         amount_worker or 0.0,
#                 "admin_note":            admin_note,
#                 "approved_at":           datetime.utcnow(),
#                 "resolved_at":           datetime.utcnow(),
#                 "sandbox_mode":          sandbox,
#                 "esewa_refund_response": esewa_refund_result,
#             }

#     else:
#         # declined
#         update_fields = {
#             "status":      "declined",
#             "refundStatus": "declined",
#             "admin_note":  admin_note,
#             "resolved_at": datetime.utcnow(),
#         }

#     database.refund_collection.update_one({"_id": obj_id}, {"$set": update_fields})

#     return {
#         "message":         f"Refund {status} successfully. Status set to '{update_fields['status']}'.{' (MOCK MODE)' if sandbox and status == 'approved' else ''}",
#         "refund_id":       refund_id,
#         "status":          update_fields["status"],
#         "refundStatus":    update_fields["refundStatus"],
#         "amount_customer": update_fields.get("amount_customer"),
#         "amount_worker":   update_fields.get("amount_worker"),
#         "admin_note":      admin_note,
#         "resolved_at":     update_fields.get("resolved_at"),
#         "sandbox_mode":    sandbox if status == "approved" else None,
#         "esewa_refund":    esewa_refund_result if status == "approved" else None,
#     }


# ─────────────────────────────────────────────────────────────
# POST /api/refunds/pay-all-in-progress
# ─────────────────────────────────────────────────────────────
@router.post("/refunds/pay-all-in-progress")
async def pay_all_in_progress_refunds(sandbox: bool = True):
    """
    Process all in-progress refunds.
    sandbox=True: Mock eSewa responses (for testing)
    sandbox=False: Call real eSewa API (needs production credentials)
    """
    in_progress = list(database.refund_collection.find({
"$or": [
    {"status": {"$in": ["refund_in_progress", "processing"]}},
    {"refundStatus": {"$in": ["refund_in_progress", "processing"]}},]
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

        task=collection_task.find_one({"_id": ObjectId(task_id)}) if task_id else None

        esewa_ref_id = task.get("esewa_ref_id") if task else None
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

        customer_id       = refund.get("requester_id")
        customer_esewa_id = None

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

        worker_esewa_id = None
        if amount_worker > 0:
            reported_id = refund.get("reported_id")
            if reported_id:
                try:
                    worker = database.collection_worker.find_one(
                        {"$or": [
                            {"_id":     reported_id},
                            {"email":   reported_id},
                            {"phoneNo": reported_id},
                            {"phone":   reported_id},
                        ]}
                    )
                    if worker:
                        worker_esewa_id = (
                            worker.get("paymentId")
                            or worker.get("payment_id")
                            or worker.get("phoneNo")
                            or worker.get("phone")
                            or worker.get("mobile")
                        )
                        print(f"[pay-all] ✅ Worker found: {worker.get('email')}, paymentId={worker_esewa_id}")
                    else:
                        print(f"[pay-all] ❌ Worker NOT found for reported_id={reported_id}")
                except Exception as e:
                    print(f"[pay-all] Error fetching worker: {e}")

        transaction_uuid = str(uuid.uuid4())
        customer_result  = None

        if sandbox:
            customer_result = {
                "status":           "mock_success",
                "transaction_uuid": transaction_uuid,
                "esewa_id":         customer_esewa_id,
                "esewa_ref_id":     esewa_ref_id,
                "note":             "MOCK refund - sandbox mode (no actual money transferred)",
                "timestamp":        datetime.utcnow().isoformat(),
            }
            customer_sent = True
        else:
            try:
                esewa_ok, api_resp = await refund_to_customer(
                    esewa_id=customer_esewa_id,
                    amount=amount_customer,
                    esewa_ref_id=esewa_ref_id,
                    remarks=f"Refund: {refund.get('reason', 'task dispute')[:50]}",
                    idempotency_key=f"pay-all-cust-{refund_id}",
                )
                customer_result = {
                    "status":           "sent" if esewa_ok else "failed",
                    "transaction_uuid": api_resp.get("transaction_uuid") if esewa_ok else None,
                    "esewa_id":         customer_esewa_id,
                    "esewa_ref_id":     esewa_ref_id,
                    "error":            None if esewa_ok else api_resp.get("message"),
                    "timestamp":        datetime.utcnow().isoformat(),
                }
                customer_sent = esewa_ok
            except Exception as e:
                customer_result = {
                    "status":    "error",
                    "error":     str(e),
                    "esewa_id":  customer_esewa_id,
                    "timestamp": datetime.utcnow().isoformat(),
                }
                customer_sent = False

        worker_result = None
        if amount_worker > 0:
            if sandbox:
                worker_result = {
                    "status":           "mock_success",
                    "transaction_uuid": str(uuid.uuid4()),
                    "phone":            worker_esewa_id,
                    "note":             "MOCK payout - sandbox mode (no actual money transferred)",
                    "timestamp":        datetime.utcnow().isoformat(),
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
                        "status":           "sent" if w_ok else "failed",
                        "transaction_uuid": w_resp.get("transaction_uuid") if w_ok else None,
                        "error":            None if w_ok else w_resp.get("message"),
                        "phone":            worker_esewa_id,
                        "timestamp":        datetime.utcnow().isoformat(),
                    }
                except Exception as e:
                    worker_result = {
                        "status":    "error",
                        "error":     str(e),
                        "phone":     worker_esewa_id,
                        "timestamp": datetime.utcnow().isoformat(),
                    }
            else:
                worker_result = {
                    "status":    "no_phone",
                    "note":      "Worker has no phone number on file — process manually.",
                    "timestamp": datetime.utcnow().isoformat(),
                }

        new_status       = "refunded"          if (sandbox or customer_sent) else "refund_in_progress"
        new_refund_status = "refunded"         if (sandbox or customer_sent) else "refund_in_progress"

        database.refund_collection.update_one(
            {"_id": refund["_id"]},
            {"$set": {
                "status":           new_status,
                "refundStatus":     new_refund_status,   # ← keep lifecycle field in sync
                "esewa_refund":     customer_result,
                "worker_payout":    worker_result,
                "processed_at":     datetime.utcnow(),
                "bulk_processed":   True,
                "sandbox_mode":     sandbox,
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
    "amount_customer":  amount_customer,
    "amount_worker":    amount_worker,
    "customer_esewa":   customer_esewa_id,
    "transaction_uuid": transaction_uuid,
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
        "total_success_amount": sum(s.get("amount_customer", 0) for s in success),  # ✅ correct field
        "total_worker_amount":  sum(s.get("amount_worker", 0)  for s in success),   # ✅ ADD worker total
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


# ─────────────────────────────────────────────────────────────
# PATCH /api/refunds/upsert/{task_id}
# ─────────────────────────────────────────────────────────────
@router.patch("/refunds/upsert/{task_id}")
async def upsert_refund(task_id: str, data: RefundUpdateSchema):
    from pymongo import ReturnDocument

    now = datetime.now(timezone.utc)

    # ── Guard: block refund_in_progress unless the linked report is resolved ──
    if data.status == "refund_in_progress":
        report_id = None

        # 1. Check existing refund doc for a linked report_id
        existing_refund = refund_collection.find_one({"task_id": task_id})
        if existing_refund:
            report_id = existing_refund.get("report_id")

        # 2. Fallback — look at the task doc itself
        if not report_id:
            try:
                task_doc = collection_task.find_one({"_id": ObjectId(task_id)})
                if task_doc:
                    report_id = task_doc.get("report_id")
            except Exception as e:
                print(f"[upsert_refund] Task lookup failed: {e}")

        # 3. If we found a report_id, verify the report is resolved
        if report_id:
            try:
                report_doc = collection_reports.find_one({"_id": ObjectId(str(report_id))})
                if report_doc:
                    report_status = report_doc.get("status", "pending")
                    if report_status != "resolved":
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                f"Cannot move refund to 'refund_in_progress' until the linked report is resolved. "
                                f"Current report status: '{report_status}'. "
                                f"Please resolve the report first before processing the refund."
                            ),
                        )
            except HTTPException:
                raise  # Re-raise our guard — don't swallow it
            except bson_errors.InvalidId:
                # Malformed report_id — skip the check rather than hard-blocking
                print(f"[upsert_refund] Malformed report_id '{report_id}', skipping status check.")
            except Exception as e:
                print(f"[upsert_refund] Report lookup failed: {e}")

    # ── Proceed with upsert ───────────────────────────────────────────────────
    update_op = {
        "$set": {
            "amount_customer": data.amount_customer,
            "amount_worker":   data.amount_worker,
            "status":          data.status,
            "refundStatus":    data.status,   # keep lifecycle field in sync
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

    except HTTPException:
        raise  # Re-raise guard exceptions
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


# ─────────────────────────────────────────────────────────────
# PATCH /api/refunds/{refund_id}/action
# Sends warn / suspend to customer or worker via FCM, email,
# and WebSocket in-app toast.
# ─────────────────────────────────────────────────────────────
@router.patch("/refunds/{refund_id}/action")
async def refund_action(refund_id: str, body: RefundActionBody):
    VALID_ACTIONS = {
        "warn_customer", "warn_worker",
        "suspend_customer", "suspend_worker",
    }
    if body.action not in VALID_ACTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid action. Choose from: {', '.join(VALID_ACTIONS)}",
        )

    # ── 1. Load refund (UUID string _id OR ObjectId) ──────────
    refund = refund_collection.find_one({"_id": refund_id})
    if not refund:
        try:
            refund = refund_collection.find_one({"_id": ObjectId(refund_id)})
        except Exception:
            pass
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")

    # ── DEBUG: log every field so you can see what's in the doc ──
    print(f"[ACTION DEBUG] refund doc keys: {list(refund.keys())}")
    print(f"[ACTION DEBUG] refund doc: { {k: v for k, v in refund.items() if k != '_id'} }")

    is_worker_target = "worker"  in body.action
    is_suspend       = "suspend" in body.action

    # ── 2. Resolve target_id — try every possible field name ──
    target_id = None

    if is_worker_target:
        target_id = (
            refund.get("reported_id")
            or refund.get("worker_id")
            or refund.get("assignedWorkerId")
        )
    else:
        target_id = (
            refund.get("requester_id")
            or refund.get("customer_id")
            or refund.get("userId")
            or refund.get("user_id")
        )

    # ── 3. If still not found, pull from the linked task doc ──
    if not target_id:
        task_id_ref = refund.get("task_id")
        print(f"[ACTION DEBUG] target_id not in refund, trying task_id={task_id_ref}")

        if task_id_ref:
            try:
                task_doc = collection_task.find_one({"_id": ObjectId(task_id_ref)})
                if task_doc:
                    print(f"[ACTION DEBUG] task doc keys: {list(task_doc.keys())}")
                    if is_worker_target:
                        target_id = (
                            task_doc.get("assignedWorkerId")
                            or task_doc.get("worker_id")
                            or task_doc.get("workerId")
                        )
                    else:
                        target_id = (
                            task_doc.get("userId")
                            or task_doc.get("customerId")
                            or task_doc.get("customer_id")
                        )
            except Exception as e:
                print(f"[ACTION DEBUG] task lookup failed: {e}")

    # ── 4. If still not found, pull from the linked report doc ──
    if not target_id:
        report_id_ref = refund.get("report_id")
        print(f"[ACTION DEBUG] target_id not in task, trying report_id={report_id_ref}")

        if report_id_ref:
            try:
                report_doc = collection_reports.find_one({"_id": ObjectId(str(report_id_ref))})
                if report_doc:
                    print(f"[ACTION DEBUG] report doc keys: {list(report_doc.keys())}")
                    if is_worker_target:
                        target_id = report_doc.get("reportedId")
                    else:
                        target_id = report_doc.get("reporterId")
            except Exception as e:
                print(f"[ACTION DEBUG] report lookup failed: {e}")

    if not target_id:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Could not resolve target user. "
                f"Refund fields present: {list(refund.keys())}. "
                f"Make sure the refund doc has 'requester_id'/'reported_id', "
                f"or a valid 'task_id' or 'report_id' to look up from."
            ),
        )

    print(f"[ACTION] ✓ Resolved target_id={target_id} for action={body.action}")

    # ── 5. Load user doc ──────────────────────────────────────
    user_doc   = None
    target_col = collection_worker if is_worker_target else collection

    try:
        user_doc = target_col.find_one({"_id": ObjectId(target_id)})
    except Exception:
        pass
    if not user_doc:
        user_doc = target_col.find_one({"_id": target_id})
    # last resort — try the other collection
    if not user_doc:
        other_col = collection if is_worker_target else collection_worker
        try:
            user_doc = other_col.find_one({"_id": ObjectId(target_id)})
        except Exception:
            pass
        if not user_doc:
            user_doc = other_col.find_one({"_id": target_id})

    print(f"[ACTION] user_doc found: {user_doc is not None}, email={user_doc.get('email') if user_doc else 'N/A'}")

    fcm_token = user_doc.get("fcmToken") if user_doc else None
    email     = user_doc.get("email")    if user_doc else None

    # ── 6. Build notification content ────────────────────────
    reason  = refund.get("reason", "a dispute")
    task_id = refund.get("task_id", "")

    if is_suspend:
        duration_str = f" for {body.duration_days} day(s)" if body.duration_days else ""
        title     = "Your Account Has Been Suspended"
        body_text = (
            f"Your account has been suspended{duration_str} due to: {reason}. "
            f"{'Note: ' + body.message if body.message else 'Contact support if you have questions.'}"
        )
        ws_type    = "account_suspended"
        toast_type = "error"
    else:
        title     = "Warning from Kaamly Admin"
        body_text = (
            f"You have received a formal warning regarding: {reason}. "
            f"{'Note: ' + body.message if body.message else 'Please review our community guidelines.'}"
        )
        ws_type    = "account_warning"
        toast_type = "warning"

    # ── 7. Apply suspension in DB ─────────────────────────────
    suspended_until = None
    if is_suspend:
        from datetime import timedelta
        days            = body.duration_days or 7
        suspended_until = datetime.utcnow() + timedelta(days=days)

        updated = False
        try:
            r = target_col.update_one(
                {"_id": ObjectId(target_id)},
                {"$set": {
                    "status":            "suspended",
                    "suspended_until":   suspended_until,
                    "suspension_reason": reason,
                    "suspended_at":      datetime.utcnow(),
                }},
            )
            updated = r.matched_count > 0
        except Exception:
            pass

        if not updated:
            target_col.update_one(
                {"_id": target_id},
                {"$set": {
                    "status":            "suspended",
                    "suspended_until":   suspended_until,
                    "suspension_reason": reason,
                    "suspended_at":      datetime.utcnow(),
                }},
            )

    # ── 8. Log action on the refund doc ──────────────────────
    refund_collection.update_one(
        {"_id": refund["_id"]},
        {"$push": {
            "admin_actions": {
                "action":          body.action,
                "duration_days":   body.duration_days,
                "message":         body.message,
                "suspended_until": suspended_until,
                "applied_at":      datetime.utcnow(),
            }
        }},
    )

    # ── 9. FCM push ───────────────────────────────────────────
    try:
        await notifications.notify_with_fallback(
            userId    = str(target_id),
            title     = title,
            body      = body_text,
            token     = fcm_token,
            email     = None,       # email sent separately via SMTP below
            is_worker = is_worker_target,
            data      = {
                "action":    body.action,
                "task_id":   str(task_id),
                "refund_id": str(refund_id),
            },
        )
        print(f"[ACTION] ✅ FCM sent → {target_id}")
    except Exception as e:
        print(f"[ACTION] FCM failed (non-fatal): {e}")

    # ── 10. Email via SMTP ────────────────────────────────────
    if email:
        try:
            await asyncio.to_thread(
                send_action_email,
                receiver_email = email,
                title          = title,
                body_text      = body_text,
                action         = body.action,
                duration_days  = body.duration_days,
                admin_note     = body.message,
            )
            print(f"[ACTION] ✅ Email sent → {email}")
        except Exception as e:
            print(f"[ACTION] Email failed (non-fatal): {e}")
    else:
        print(f"[ACTION] ⚠ No email found for target_id={target_id}")

    # ── 11. WebSocket in-app toast ────────────────────────────
    try:
        await websocket_manager.manager.send_to_user(
            str(target_id),
            json.dumps({
                "type":            ws_type,
                "title":           title,
                "message":         body_text,
                "taskId":          str(task_id),
                "refundId":        str(refund_id),
                "action":          body.action,
                "duration_days":   body.duration_days,
                "suspended_until": suspended_until.isoformat() if suspended_until else None,
                "adminNote":       body.message or "",
                "toast":           True,
                "toastType":       toast_type,
            }),
        )
        print(f"[ACTION] ✅ WebSocket toast sent → {target_id}")
    except Exception as e:
        print(f"[ACTION] WebSocket failed (non-fatal): {e}")

    # ── 12. Respond ───────────────────────────────────────────
    return {
        "message":         f"Action '{body.action}' applied successfully.",
        "target_id":       str(target_id),
        "action":          body.action,
        "suspended_until": suspended_until.isoformat() if suspended_until else None,
        "notifications_sent": {
            "fcm":       fcm_token is not None,
            "email":     email is not None,
            "websocket": True,
        },
    }