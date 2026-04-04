import os
from uuid import uuid4
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Form, File, UploadFile, HTTPException, Query
from bson import ObjectId, errors as bson_errors
from ..repository.reportRepo import ReportRepo, _serialize
from ..config.database import collection_reports, collection_task, refund_collection, collection_payment

router = APIRouter(tags=["reports"])
reportRepo = ReportRepo(collection_reports)

UPLOAD_DIR = "uploads/reports"
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

VALID_PAYMENT_METHODS = {"khalti", "esewa"}


# ─────────────────────────────────────────────────────────────
# POST /reports
# ─────────────────────────────────────────────────────────────
@router.post("/reports")
async def create_report(
    reporterId:       str                  = Form(...),
    reporterType:     str                  = Form(...),
    reportedId:       str                  = Form(...),
    reportedType:     str                  = Form(...),
    reason:           str                  = Form(...),
    description:      Optional[str]        = Form(None),
    evidence:         Optional[UploadFile] = File(None),
    taskId:           Optional[str]        = Form(None),
    requestForRefund: bool                 = Form(False),
    esewaId:          Optional[str]        = Form(None),
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

        evidence_url = f"/static/reports/{unique_filename}"

    # ── 2. Prepare report data ─────────────────────────────────────────────────
    data = {
        "reporterId":       reporterId,
        "reporterType":     reporterType,
        "reportedId":       reportedId,
        "reportedType":     reportedType,
        "reason":           reason,
        "description":      description,
        "requestForRefund": requestForRefund,
        "status":           "pending",
        "refundStatus":     "pending",   # ← lifecycle starts here
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
                        {"task_id": str(taskId), "type": "customer_payment", "status": "success"},
                        sort=[("paid_at", -1)],
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
                    if not esewaId:
                        raise HTTPException(
                            status_code=400,
                            detail="eSewa transaction ID is required for refund — "
                                   "this task was paid via eSewa.",
                        )
                    payment_ref = esewaId

                collection_task.update_one(
                    {"_id": obj_id},
                    {"$set": {"taskStatus": "dispute", "disputedAt": datetime.utcnow()}},
                )

        except bson_errors.InvalidId:
            raise HTTPException(status_code=400, detail="Invalid taskId")

    # ── 4. Create the report ───────────────────────────────────────────────────
    report    = reportRepo.createReport(data, evidence_url)
    report_id = report.get("id") or report.get("_id")

    if taskId and report_id:
        collection_task.update_one(
            {"_id": ObjectId(taskId)},
            {"$set": {"report_id": str(report_id)}},
        )

    # ── 5. Create refund if needed ─────────────────────────────────────────────
    refund_id = None

    if create_refund_doc:
        refund_doc = {
            "task_id":         taskId,
            "report_id":       str(report_id),
            "requester_id":    str(task.get("userId")),
            "reported_id":     str(task.get("assignedWorkerId")) if task.get("assignedWorkerId") else None,
            "requester_type":  "customer",
            "reported_type":   "worker",
            "amount_customer": None,
            "amount_worker":   None,
            "reason":          reason,
            "total_amount":    task.get("totalCost"),
            "status":          "pending",
            "refundStatus":    "pending",   # ← starts as pending
            "created_at":      datetime.utcnow(),
            "evidence_files":  [evidence_url] if evidence_url else [],
            "payment_method":  payment_method,
            "payment_ref":     payment_ref,
            "esewa_id":        payment_ref             if payment_method == "esewa"  else None,
            "khalti_pidx":     task.get("khalti_pidx") if payment_method == "khalti" else None,
            "khalti_txn_id":   task.get("khalti_txn_id") if payment_method == "khalti" else None,
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
# GET /reports/stats          ← MUST come before /reports/{id}
# ─────────────────────────────────────────────────────────────
@router.get("/reports/stats")
def get_report_stats():
    return reportRepo.getStats()


# ─────────────────────────────────────────────────────────────
# GET /reports/user/{userId}  ← MUST come before /reports/{id}
# ─────────────────────────────────────────────────────────────
@router.get("/reports/user/{userId}")
def get_reports_by_user(userId: str):
    reports = reportRepo.getReportsByUserId(userId)
    return {
        "reports": reports,
        "total":   len(reports),
    }


# ─────────────────────────────────────────────────────────────
# GET /reports/reported/{userId} ← MUST come before /reports/{id}
# ─────────────────────────────────────────────────────────────
@router.get("/reports/reported/{userId}")
def get_reports_against_user(userId: str):
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
# GET /reports/count/{userId} ← MUST come before /reports/{id}
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
):
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
def update_status(
    id:        str,
    status:    str = Form(...),
    adminNote: str = Form(""),
    customerRefundAmount: Optional[float] = Form(None),
    workerRefundAmount: Optional[float] = Form(None),
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
        if status == "resolved":
            new_refund_status = "refund_in_progress"

            # Use existing DB values, fall back to what was passed in, then 0
            amount_customer = refund_doc.get("amount_customer") or customerRefundAmount or 0
            amount_worker   = refund_doc.get("amount_worker")   or workerRefundAmount   or 0

            refund_collection.update_one(
                {"_id": refund_doc["_id"]},
                {"$set": {
                    "refundStatus":       new_refund_status,
                    "report_resolved_at": datetime.utcnow(),
                    "amount_customer":    amount_customer,   # ✅ actually persisted
                    "amount_worker":      amount_worker,     # ✅ actually persisted
                }}
            )

            if task_id:
                try:
                    collection_task.update_one(
                        {"_id": ObjectId(str(task_id))},
                        {"$set": {"taskStatus": "refund_in_progress"}}
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

        collection_reports.update_one(
            {"_id": obj_id},
            {"$set": {"refundStatus": new_refund_status}}
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
def get_report_by_id(id: str):
    report = reportRepo.getReportById(id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


# ─────────────────────────────────────────────────────────────
# DELETE /reports/{id}
# ─────────────────────────────────────────────────────────────
@router.delete("/reports/{id}")
def delete_report(id: str):
    try:
        obj_id = ObjectId(id)
    except bson_errors.InvalidId:
        raise HTTPException(status_code=400, detail="Invalid ID")

    report = reportRepo.col.find_one({"_id": obj_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    reportRepo.col.delete_one({"_id": obj_id})
    return {"success": True}