import os
from uuid import uuid4
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Form, File, UploadFile, HTTPException, Query
from bson import ObjectId, errors as bson_errors
from ..repository.reportRepo import ReportRepo, _serialize
from ..config.database import collection_reports, collection_task, refund_collection

router = APIRouter(tags=["reports"])
reportRepo = ReportRepo(collection_reports)

UPLOAD_DIR = "uploads/reports"
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


# ─────────────────────────────────────────────────────────────
# POST /reports
# ─────────────────────────────────────────────────────────────
@router.post("/reports")
async def create_report(
    reporterId:       str            = Form(...),
    reporterType:     str            = Form(...),
    reportedId:       str            = Form(...),
    reportedType:     str            = Form(...),
    reason:           str            = Form(...),
    description:      Optional[str]  = Form(None),
    evidence:         Optional[UploadFile] = File(None),
    taskId:           Optional[str]  = Form(None),
    requestForRefund: bool           = Form(False),
    esewaId:          Optional[str]  = Form(None)
):
    evidence_url = None

    # ── 1. Handle file upload ─────────────────────────────────────────────────
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

    # ── 2. Prepare report data ────────────────────────────────────────────────
    data = {
        "reporterId":       reporterId,
        "reporterType":     reporterType,
        "reportedId":       reportedId,
        "reportedType":     reportedType,
        "reason":           reason,
        "description":      description,
        "requestForRefund": requestForRefund,
        "createdAt":        datetime.utcnow(),
        # ID references — populated below when refund is created
        "refund_id":        None,
    }

    if taskId:
        data["taskId"] = taskId

    # ── 3. Check task (for refund) ────────────────────────────────────────────
    create_refund_doc = False
    task = None

    if taskId:
        try:
            obj_id = ObjectId(taskId)
            task   = collection_task.find_one({"_id": obj_id})

            if not task:
                raise HTTPException(status_code=404, detail="Task not found")

            if task.get("escrow_status") in ("held", "released") and requestForRefund:
                create_refund_doc = True

                # Mark task as disputed — IDs will be linked below
                collection_task.update_one(
                    {"_id": obj_id},
                    {"$set": {
                        "taskStatus": "dispute",
                        "disputedAt": datetime.utcnow()
                    }}
                )

        except bson_errors.InvalidId:
            raise HTTPException(status_code=400, detail="Invalid taskId")

    # ── 4. Create the report ──────────────────────────────────────────────────
    report    = reportRepo.createReport(data, evidence_url)
    report_id = report.get("id") or report.get("_id")

    # Store only the report_id on the task — no embedded details
    if taskId and report_id:
        collection_task.update_one(
            {"_id": ObjectId(taskId)},
            {"$set": {"report_id": str(report_id)}},
        )

    # ── 5. Create refund if needed ────────────────────────────────────────────
    refund_id = None

    if create_refund_doc:
        if not esewaId:
            raise HTTPException(
                status_code=400,
                detail="eSewa ID required for refund requests"
            )

        refund_doc = {
            "task_id":         taskId,
            "report_id":       str(report_id),   # link to report via ID only
            "requester_id":    str(task.get("userId")),
            "reported_id":     str(task.get("assignedWorkerId")) if task.get("assignedWorkerId") else None,
            "requester_type":  "customer",
            "reported_type":   "worker",
            "amount_customer": None,
            "amount_worker":   None,
            "reason":          reason,
            "total_amount":    task.get("totalCost"),
            "status":          "pending",
            "created_at":      datetime.utcnow(),
            "evidence_files":  [evidence_url] if evidence_url else [],
            "esewa_id":        esewaId or None,
        }

        refund_result = refund_collection.insert_one(refund_doc)
        refund_id     = str(refund_result.inserted_id)

        # Store only refund_id on the task — no embedded details
        collection_task.update_one(
            {"_id": ObjectId(taskId)},
            {"$set": {"refund_id": refund_id}},
        )

        # Store only refund_id on the report — no embedded details
        collection_reports.update_one(
            {"_id": ObjectId(str(report_id))},
            {"$set": {"refund_id": refund_id}},
        )

    # ── 6. Return response ────────────────────────────────────────────────────
    return {
        "message":        "Report submitted successfully",
        "report":         report,
        "report_id":      str(report_id),     # ← caller gets the ID
        "refund_id":      refund_id,          # ← caller gets the ID (None if no refund)
        "refundRequested": create_refund_doc
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
# GET /reports/stats
# ─────────────────────────────────────────────────────────────
@router.get("/reports/stats")
def get_report_stats():
    return reportRepo.getStats()


# ─────────────────────────────────────────────────────────────
# PATCH /reports/{id}/status
# ─────────────────────────────────────────────────────────────
@router.patch("/reports/{id}/status")
def update_status(
    id:        str,
    status:    str = Form(...),
    adminNote: str = Form("")
):
    VALID_STATUS = {"resolved", "declined"}

    if status not in VALID_STATUS:
        raise HTTPException(status_code=400, detail="Invalid status")

    ok = reportRepo.updateReportStatus(id, status, adminNote)
    if not ok:
        raise HTTPException(status_code=404, detail="Report not found")

    return {"success": True}


# ─────────────────────────────────────────────────────────────
# GET /reports/user/{userId}
# ─────────────────────────────────────────────────────────────
@router.get("/reports/user/{userId}")
def get_reports_by_user(userId: str):
    reports = reportRepo.getReportsByUserId(userId)
    return {
        "reports": reports,
        "total":   len(reports),
    }


# ─────────────────────────────────────────────────────────────
# GET /reports/{id}
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


# ─────────────────────────────────────────────────────────────
# GET /reports/reported/{userId}
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