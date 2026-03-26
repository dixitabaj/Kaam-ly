import os
import shutil
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Query, File, UploadFile, Form
from typing import Optional
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime
from ..repository.reportRepo import ReportRepo, _serialize
from ..config.database import collection_reports, collection_task, refund_collection

router = APIRouter(tags=["reports"])
reportRepo = ReportRepo(collection_reports)

# ─────────────────────────────────────────────────────────────
# Upload config
# ─────────────────────────────────────────────────────────────
UPLOAD_DIR = "uploads/reports"
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

# ─────────────────────────────────────────────────────────────
# CREATE REPORT
# ─────────────────────────────────
from bson import ObjectId, errors as bson_errors

@router.post("/reports")
async def create_report(
    reporterId:   str = Form(...),
    reporterType: str = Form(...),
    reportedId:   str = Form(...),
    reportedType: str = Form(...),
    reason:       str = Form(...),
    description:  Optional[str] = Form(None),
    evidence:     Optional[UploadFile] = File(None),
    taskId:       Optional[str] = Form(None),
    requestForRefund: bool = Form(False),
    esewaId:      Optional[str] = Form(None)  # Only required if refund requested
):
    evidence_url = None

    # ─── Handle evidence upload ───
    if evidence:
        if evidence.content_type not in ALLOWED_TYPES:
            raise HTTPException(status_code=400, detail="Invalid image type.")
        contents = await evidence.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large (max 5MB).")
        file_extension = evidence.filename.split(".")[-1]
        unique_filename = f"{uuid4()}.{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
        evidence_url = f"/static/reports/{unique_filename}"

    # ─── Prepare report data ───
    data = {
        "reporterId": reporterId,
        "reporterType": reporterType,
        "reportedId": reportedId,
        "reportedType": reportedType,
        "reason": reason,
        "description": description
    }
    if taskId:
        data["taskId"] = taskId

    # ─── Check task for refund eligibility ───
    create_refund_doc = False
    task = None
    if taskId:
        try:
            obj_id = ObjectId(taskId)
            task = collection_task.find_one({"_id": obj_id})
            if not task:
                raise HTTPException(status_code=404, detail="Task not found")
            if task.get("escrow_status") in ("held", "released") and requestForRefund:
                create_refund_doc = True
                # Set task status to dispute
                collection_task.update_one(
                    {"_id": obj_id},
                    {"$set": {"taskStatus": "dispute", "disputedAt": datetime.utcnow()}}
                )
        except bson_errors.InvalidId:
            raise HTTPException(status_code=400, detail="Invalid taskId")

    # ─── Create report ───
    report = reportRepo.createReport(data, evidence_url)

    # ─── Create refund document if eligible ───
    if create_refund_doc:
        if not esewaId:
            raise HTTPException(status_code=400, detail="eSewa ID required for refund requests")
        refund_doc = {
            "task_id": taskId,
            "requester_id": str(task.get("userId")),
            "reported_id": str(task.get("assignedWorkerId")) if task.get("assignedWorkerId") else None,
            "requester_type": "customer",
            "reported_type": "worker",
            "amount_customer": None,  # Admin decides
            "amount_worker": None,    # Admin decides
            "reason": reason,
            "total_amount": task.get("totalCost"),
            "status": "pending",
            "created_at": datetime.utcnow(),
            "evidence_files": [evidence_url] if evidence_url else [],
            "esewa_id": esewaId,      # Store eSewa ID for payout
        }
        refund_collection.insert_one(refund_doc)
        report["refund_requested"] = True
        report["refund_doc_id"] = str(refund_doc["_id"])

    return report
# ─────────────────────────────────────────────────────────────
# GET REPORTS (with filters)
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
# STATS
# ─────────────────────────────────────────────────────────────
@router.get("/reports/stats")
def get_report_stats():
    return reportRepo.getStats()


# ─────────────────────────────────────────────────────────────
# UPDATE STATUS
# ─────────────────────────────────────────────────────────────
@router.patch("/reports/{id}/status")
def update_status(
    id: str,
    status: str = Form(...),
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
# REPORTS BY REPORTER
# ─────────────────────────────────────────────────────────────
@router.get("/reports/user/{userId}")
def get_reports_by_user(userId: str):
    reports = reportRepo.getReportsByUserId(userId)
    return {
        "reports": reports,
        "total": len(reports),
    }


# ─────────────────────────────────────────────────────────────
# GET SINGLE REPORT
# ─────────────────────────────────────────────────────────────
@router.get("/reports/{id}")
def get_report_by_id(id: str):
    report = reportRepo.getReportById(id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


# ─────────────────────────────────────────────────────────────
# DELETE REPORT
# ─────────────────────────────────────────────────────────────
@router.delete("/reports/{id}")
def delete_report(id: str):
    try:
        obj_id = ObjectId(id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid ID")

    report = reportRepo.col.find_one({"_id": obj_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    reportRepo.col.delete_one({"_id": obj_id})
    return {"success": True}


# ─────────────────────────────────────────────────────────────
# REPORTS AGAINST A USER
# ─────────────────────────────────────────────────────────────
@router.get("/reports/reported/{userId}")
def get_reports_against_user(userId: str):
    reports = reportRepo.col.find({"reportedId": userId}).sort("createdAt", -1)
    serialized = [_serialize(r) for r in reports]

    return {
        "reports": serialized,
        "total": len(serialized),
        "pending": sum(1 for r in serialized if r.get("status") == "pending"),
        "resolved": sum(1 for r in serialized if r.get("status") == "resolved"),
        "declined": sum(1 for r in serialized if r.get("status") == "declined"),
    }



# GET /reports/count/{userId}
# Lightweight — just counts, no full report data.
# Used for the "X prior reports" badge in the admin modal
# without fetching the entire report list.
@router.get("/reports/count/{userId}")
def get_report_count_for_user(userId: str):
    return {
        "userId":   userId,
        "total":    reportRepo.col.count_documents({"reportedId": userId}),
        "pending":  reportRepo.col.count_documents({"reportedId": userId, "status": "pending"}),
        "resolved": reportRepo.col.count_documents({"reportedId": userId, "status": "resolved"}),
        "declined": reportRepo.col.count_documents({"reportedId": userId, "status": "declined"}),
    }