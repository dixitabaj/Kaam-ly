import os
from uuid import uuid4
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Form, File, UploadFile, HTTPException, Query, Depends
from bson import ObjectId, errors as bson_errors
from ..repository.reportRepo import ReportRepo, _serialize
from ..config.database import (
    collection_reports, collection_task, refund_collection,
    collection_payment, collection_worker, collection,
)
from .notifications import notify_with_fallback
from ..services.emailUtil import send_refund_email, send_declined_refund_email
from ..services.auth import get_current_user, require_admin
from typing import Dict

router = APIRouter(tags=["reports"])
reportRepo = ReportRepo(collection_reports)

UPLOAD_DIR = "uploads/reports"
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

VALID_PAYMENT_METHODS = {"khalti", "esewa"}


def _find_customer(customer_id: str):
    """Look up a customer by ObjectId or email."""
    try:
        doc = collection.find_one({"_id": ObjectId(customer_id)})
        if doc:
            return doc
    except Exception:
        pass
    return collection.find_one({"email": customer_id})


def _find_worker(worker_id: str):
    """Look up a worker by string _id or email (workers use email as _id)."""
    doc = collection_worker.find_one({"_id": worker_id})
    if doc:
        return doc
    return collection_worker.find_one({"email": worker_id})


# ─────────────────────────────────────────────────────────────
# POST /reports
# ─────────────────────────────────────────────────────────────
@router.post("/reports")
async def create_report(
    reporterId:       str                  = Form(None),
    reporterType:     str                  = Form(None),
    reportedId:       str                  = Form(...),
    reportedType:     str                  = Form(...),
    reason:           str                  = Form(...),
    description:      Optional[str]        = Form(None),
    evidence:         Optional[UploadFile] = File(None),
    taskId:           Optional[str]        = Form(None),
    requestForRefund: bool                 = Form(False),
    esewaId:          Optional[str]        = Form(None),
    current_user:     Dict                = Depends(get_current_user),
):
    evidence_url = None

    # ── 1. Handle file upload ──────────────────────────────────────────────────
    if evidence:
        if evidence.content_type not in ALLOWED_TYPES:
            raise HTTPException(status_code=400, detail="Invalid image type.")

        contents = await evidence.read()

        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large (max 5MB).")

        file_extension  = evidence.filename.split(".")[-1]
        unique_filename = f"{uuid4()}.{file_extension}"
        file_path       = os.path.join(UPLOAD_DIR, unique_filename)

        with open(file_path, "wb") as buffer:
            buffer.write(contents)

        evidence_url = f"/uploads/reports/{unique_filename}"

    # ── 2. Prepare report data ─────────────────────────────────────────────────
    # Do not trust client-supplied reporter identity — derive from authenticated token
    reporter_id = str(current_user.get("user_id"))
    reporter_type = current_user.get("user_type")

    data = {
        "reporterId":       reporter_id,
        "reporterType":     reporter_type,
        "reportedId":       reportedId,
        "reportedType":     reportedType,
        "reason":           reason,
        "description":      description,
        "requestForRefund": requestForRefund,
        "status":           "pending",
        "refundStatus":     "pending",
        "createdAt":        datetime.utcnow(),
        "refund_id":        None,
    }

    if taskId:
        data["taskId"] = taskId

    # ── 3. Check task + resolve payment method ─────────────────────────────────
    create_refund_doc = False
    task              = None
    payment_method    = None
    payment_ref       = None
    payment_tx        = None

    if taskId:
        try:
            obj_id = ObjectId(taskId)
            task   = collection_task.find_one({"_id": obj_id})

            if not task:
                raise HTTPException(status_code=404, detail="Task not found")

            # ── ONE REPORT PER TASK GUARD ──────────────────────────────────────
            existing = collection_reports.find_one({"taskId": taskId})
            if existing:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message":            "A report has already been filed for this task.",
                        "existing_report_id": str(existing["_id"]),
                        "status":             existing.get("status", "pending"),
                        "reason":             existing.get("reason", ""),
                        "taskId":             taskId,
                    },
                )

            if task.get("escrow_status") in ("held", "released") and requestForRefund:
                create_refund_doc = True

                payment_method = (task.get("payment_method") or "").lower()

                if payment_method not in VALID_PAYMENT_METHODS:
                    payment_tx = collection_payment.find_one(
                        {"task_id": str(taskId), "type": "customer_payment", "status": {"$in": ["success", "paid", "pending"]}},
                        sort=[("created_at", -1)],
                    )
                    if payment_tx:
                        payment_method = (payment_tx.get("method") or "").lower()

                if payment_method not in VALID_PAYMENT_METHODS:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Could not determine payment method for this task. "
                               f"Supported methods: {', '.join(VALID_PAYMENT_METHODS)}",
                    )

                if payment_method == "khalti":
                    payment_ref = task.get("khalti_pidx") or task.get("khalti_txn_id")

                elif payment_method == "esewa":
                    payment_tx = collection_payment.find_one(
                        {"task_id": str(taskId), "type": "customer_payment", "status": {"$in": ["success", "paid", "pending"]}},
                        sort=[("created_at", -1)],
                    )
                    if payment_tx:
                        payment_ref = payment_tx.get("transaction_uuid") or payment_tx.get("gateway_ref")

                    if not payment_ref and esewaId:
                        payment_ref = esewaId

                    if not payment_ref:
                        raise HTTPException(
                            status_code=400,
                            detail="Could not find eSewa transaction reference for this task. "
                                   "Please provide the eSewa transaction ID manually.",
                        )

                collection_task.update_one(
                    {"_id": obj_id},
                    {"$set": {"dispute": "true", "disputedAt": datetime.utcnow()}},
                )

                if payment_tx is None:
                    payment_tx = collection_payment.find_one(
                        {"task_id": str(taskId), "type": "customer_payment", "status": {"$in": ["success", "paid", "pending"]}},
                        sort=[("created_at", -1)],
                    )

        except bson_errors.InvalidId:
            raise HTTPException(status_code=400, detail="Invalid taskId")

    # ── 4. Create the report ───────────────────────────────────────────────────
    report    = reportRepo.createReport(data, evidence_url)
    report_id = report.get("id") or report.get("_id")

    worker_id = task.get("assignedWorkerId") if task else None
    worker    = _find_worker(worker_id) if worker_id else None

    # ── 5. Create refund if needed ─────────────────────────────────────────────
    refund_id = None

    if create_refund_doc:
        worker_payment_method = worker.get("payment_method") if worker else None
        # requester is the task's customer — double-check it matches authenticated user
        task_user_id = str(task.get("userId")) if task else None
        if task_user_id and task_user_id != reporter_id and current_user.get("user_type") != "admin":
            # Prevent customers from filing refunds on behalf of others
            raise HTTPException(status_code=403, detail="Not authorized to request refund for this task")

        refund_doc = {
            "task_id":                         taskId,
            "report_id":                       str(report_id),
            "requester_id":                    str(task.get("userId")),
            "reported_id":                     str(task.get("assignedWorkerId")) if task.get("assignedWorkerId") else None,
            "requester_type":                  "customer",
            "reported_type":                   "worker",
            "amount_customer":                 None,
            "amount_worker":                   None,
            "reason":                          reason,
            "total_amount":                    task.get("totalCost"),
            "status":                          "pending",
            "refundStatus":                    "pending",
            "created_at":                      datetime.utcnow(),
            "evidence_files":                  [evidence_url] if evidence_url else [],
            "payment_method_worker":           worker_payment_method,
            "esewa_transaction_uuid_worker":   worker.get("payment_id") if worker_payment_method == "esewa" else None,
            "khalti_worker":                   worker.get("payment_id") if worker_payment_method == "khalti" else None,
            "payment_method_customer":         payment_tx.get("method") if payment_tx else None,
            "esewa_transaction_uuid_customer": payment_tx.get("transaction_uuid") if payment_method == "esewa" else None,
            "khalti_customer":                 payment_tx.get("khalti_pidx") if payment_method == "khalti" else None,
        }

        refund_result = refund_collection.insert_one(refund_doc)
        refund_id     = str(refund_result.inserted_id)

        collection_task.update_one(
            {"_id": ObjectId(taskId)},
            {"$set": {"refund_id": refund_id}},
        )

        collection_reports.update_one(
            {"_id": ObjectId(str(report_id))},
            {"$set": {"refund_id": refund_id, "refundStatus": "pending"}},
        )

    # ── 6. Return response ─────────────────────────────────────────────────────
    return {
        "message":         "Report submitted successfully",
        "report":          report,
        "report_id":       str(report_id),
        "refund_id":       refund_id,
        "refundRequested": create_refund_doc,
        "paymentMethod":   payment_method,
    }


# ─────────────────────────────────────────────────────────────
# GET /reports/stats
# ─────────────────────────────────────────────────────────────
@router.get("/reports/stats")
def get_report_stats(current_user: Dict = Depends(get_current_user)):
    if current_user.get("user_type") != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    return reportRepo.getStats()


# ─────────────────────────────────────────────────────────────
# GET /reports/user/{userId}
# ─────────────────────────────────────────────────────────────
@router.get("/reports/user/{userId}")
def get_reports_by_user(userId: str, current_user: Dict = Depends(get_current_user)):
    if current_user.get("user_type") != "admin" and str(current_user.get("user_id")) != str(userId):
        raise HTTPException(status_code=403, detail="Forbidden")
    reports = reportRepo.getReportsByUserId(userId)
    return {
        "reports": reports,
        "total":   len(reports),
    }


# ─────────────────────────────────────────────────────────────
# GET /reports/reported/{userId}
# ─────────────────────────────────────────────────────────────
@router.get("/reports/reported/{userId}")
def get_reports_against_user(userId: str, current_user: Dict = Depends(get_current_user)):
    if current_user.get("user_type") != "admin" and str(current_user.get("user_id")) != str(userId):
        raise HTTPException(status_code=403, detail="Forbidden")
    reports    = reportRepo.col.find({"reportedId": userId}).sort("createdAt", -1)
    serialized = [_serialize(r) for r in reports]

    return {
        "reports":  serialized,
        "total":    len(serialized),
        "pending":  sum(1 for r in serialized if r.get("status") == "pending"),
        "resolved": sum(1 for r in serialized if r.get("status") == "resolved"),
        "declined": sum(1 for r in serialized if r.get("status") == "declined"),
    }


# ─────────────────────────────────────────────────────────────
# GET /reports/count/{userId}
# ─────────────────────────────────────────────────────────────
@router.get("/reports/count/{userId}")
def get_report_count_for_user(userId: str):
    return {
        "userId":   userId,
        "total":    reportRepo.col.count_documents({"reportedId": userId}),
        "pending":  reportRepo.col.count_documents({"reportedId": userId, "status": "pending"}),
        "resolved": reportRepo.col.count_documents({"reportedId": userId, "status": "resolved"}),
        "declined": reportRepo.col.count_documents({"reportedId": userId, "status": "declined"}),
    }


# ─────────────────────────────────────────────────────────────
# GET /reports
# ─────────────────────────────────────────────────────────────
@router.get("/reports")
def get_reports(
    skip:         int = Query(0, ge=0),
    limit:        int = Query(50, le=100),
    status:       str = Query("all"),
    reporterType: str = Query("all"),
    reportedType: str = Query("all"),
    search:       str = Query(""),
    current_user: Dict = Depends(get_current_user),
):
    if current_user.get("user_type") != "admin":
        raise HTTPException(status_code=403, detail="Admins only")

    return reportRepo.getReports(
        skip=skip,
        limit=limit,
        status=status,
        reporterType=reporterType,
        reportedType=reportedType,
        search=search,
    )


# ─────────────────────────────────────────────────────────────
# PATCH /reports/{id}/status
# ─────────────────────────────────────────────────────────────
@router.patch("/reports/{id}/status")
async def update_status(
    id:                   str,
    status:               str             = Form(...),
    adminNote:            str             = Form(""),
    customerRefundAmount: Optional[float] = Form(None),
    workerRefundAmount:   Optional[float] = Form(None),
    admin: Dict = Depends(require_admin),
):
    VALID_STATUS = {"resolved", "declined"}

    if status not in VALID_STATUS:
        raise HTTPException(status_code=400, detail="Invalid status")

    try:
        obj_id = ObjectId(id)
    except bson_errors.InvalidId:
        raise HTTPException(status_code=400, detail="Invalid report ID")

    report = collection_reports.find_one({"_id": obj_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    ok = reportRepo.updateReportStatus(id, status, adminNote)
    if not ok:
        raise HTTPException(status_code=404, detail="Report not found")

    refund_id = report.get("refund_id")
    task_id   = report.get("taskId")

    # ── Resolve refund doc ─────────────────────────────────────────────────────
    refund_doc = None
    if refund_id:
        try:
            refund_doc = refund_collection.find_one({"_id": ObjectId(refund_id)})
        except Exception:
            refund_doc = refund_collection.find_one({"_id": refund_id})

    if not refund_doc and task_id:
        refund_doc = refund_collection.find_one({"task_id": str(task_id)})

    new_refund_status = None

    if refund_doc:
        # ── Resolve IDs once ───────────────────────────────────────────────────
        customer_id = report.get("reporterId") or refund_doc.get("requester_id")
        worker_id   = report.get("reportedId") or refund_doc.get("reported_id")

        if status == "resolved":
            new_refund_status = "refund_in_progress"

            # Read amounts from DB — only fall back if truly None
            # ADD THIS
            amount_customer = customerRefundAmount if customerRefundAmount is not None else (refund_doc.get("amount_customer") or 0)
            amount_worker   = workerRefundAmount   if workerRefundAmount   is not None else (refund_doc.get("amount_worker")   or 0)

            # ── Update refund doc ──────────────────────────────────────────────
            refund_collection.update_one(
                {"_id": refund_doc["_id"]},
                {"$set": {
                    "refundStatus":       new_refund_status,
                    "report_resolved_at": datetime.utcnow(),
                    "amount_customer":    amount_customer,
                    "amount_worker":      amount_worker,
                }}
            )

            # ── Notify customer ────────────────────────────────────────────────
            if customer_id:
                await notify_with_fallback(
                    userId=customer_id,
                    title="Refund Approved",
                    body=f"Your refund request has been approved. NPR {amount_customer:,.0f} will be refunded to your account.",
                    is_worker=False,
                )

            # ── Notify worker ──────────────────────────────────────────────────
            if worker_id and amount_worker > 0:
                await notify_with_fallback(
                    userId=worker_id,
                    title="Payment Adjustment",
                    body=f"A refund has been processed for this task. You will receive NPR {amount_worker:,.0f} as your payment.",
                    is_worker=True,
                )
            elif worker_id and amount_worker == 0:
                await notify_with_fallback(
                    userId=worker_id,
                    title="Task Refund Issued",
                    body="A full refund has been issued for this task. No payment will be released.",
                    is_worker=True,
                )

            # ── Email customer ─────────────────────────────────────────────────
            if customer_id:
                try:
                    customer = _find_customer(customer_id)
                    if customer and customer.get("email"):
                        send_refund_email(
                            to_email=customer["email"],
                            user_name=f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip() or "Customer",
                            subject="Refund Approved - Your Request Has Been Processed",
                            amount=amount_customer,
                            is_customer=True,
                            task_id=task_id,
                            admin_note=adminNote,
                        )
                except Exception as e:
                    print(f"Failed to send customer email: {e}")

            # ── Email worker ───────────────────────────────────────────────────
            if worker_id:
                try:
                    worker = _find_worker(worker_id)
                    if worker and worker.get("email"):
                        send_refund_email(
                            to_email=worker["email"],
                            user_name=f"{worker.get('firstName', '')} {worker.get('lastName', '')}".strip() or "Worker",
                            subject="Payment Adjustment Notification",
                            amount=amount_worker,
                            is_customer=False,
                            task_id=task_id,
                            admin_note=adminNote,
                        )
                except Exception as e:
                    print(f"Failed to send worker email: {e}")

            # ── Update task status ─────────────────────────────────────────────
            if task_id:
                try:
                    collection_task.update_one(
                        {"_id": ObjectId(str(task_id))},
                        {"$set": {"taskStatus": "refund_in_progress"}},
                    )
                except Exception:
                    pass

        else:  # declined
            new_refund_status = "declined"

            refund_collection.update_one(
                {"_id": refund_doc["_id"]},
                {"$set": {
                    "refundStatus":       new_refund_status,
                    "report_resolved_at": datetime.utcnow(),
                }}
            )
            if task_id:
                try:
                    result = collection_task.update_one(
                        {"_id": ObjectId(str(task_id))},
                        {"$set": {
                            "dispute":           "rejected",
                            "disputeResolvedAt": datetime.utcnow(),
                        }}
                    )
                    print(f"[DISPUTE REJECT] task_id={task_id}, matched={result.matched_count}, modified={result.modified_count}")
                except Exception as e:
                    print(f"[DISPUTE REJECT ERROR] task_id={task_id}, error={e}")

            # ── Notify customer ────────────────────────────────────────────────
            if customer_id:
                await notify_with_fallback(
                    userId=customer_id,
                    title="Refund Request Declined",
                    body=f"Your refund request has been declined. {adminNote or 'Please contact support for details.'}",
                    is_worker=False,
                )

            # ── Email customer ─────────────────────────────────────────────────
            if customer_id:
                try:
                    customer = _find_customer(customer_id)
                    if customer and customer.get("email"):
                        send_declined_refund_email(
                            to_email=customer["email"],
                            user_name=f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip() or "Customer",
                            task_id=task_id,
                            admin_note=adminNote,
                        )
                except Exception as e:
                    print(f"Failed to send declined email: {e}")

        # ── Update report refund status ────────────────────────────────────────
        collection_reports.update_one(
            {"_id": obj_id},
            {"$set": {"refundStatus": new_refund_status}},
        )

    return {
        "success":      True,
        "status":       status,
        "refundStatus": new_refund_status,
    }


# ─────────────────────────────────────────────────────────────
# GET /reports/{id}           ← Catch-all — keep at the bottom
# ─────────────────────────────────────────────────────────────
@router.get("/reports/{id}")
def get_report_by_id(id: str, current_user: Dict = Depends(get_current_user)):
    report = reportRepo.getReportById(id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    # allow admin, reporter, or reported user
    uid = str(current_user.get("user_id"))
    if current_user.get("user_type") != "admin" and uid not in (str(report.get("reporterId")), str(report.get("reportedId"))):
        raise HTTPException(status_code=403, detail="Forbidden")
    return report


# ─────────────────────────────────────────────────────────────
# DELETE /reports/{id}
# ─────────────────────────────────────────────────────────────
@router.delete("/reports/{id}")
def delete_report(id: str, admin: Dict = Depends(require_admin)):
    try:
        obj_id = ObjectId(id)
    except bson_errors.InvalidId:
        raise HTTPException(status_code=400, detail="Invalid ID")

    report = reportRepo.col.find_one({"_id": obj_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    reportRepo.col.delete_one({"_id": obj_id})
    return {"success": True}