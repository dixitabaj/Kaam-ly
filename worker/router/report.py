import os
import shutil
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Query, File, UploadFile, Form
from typing import Optional
from ..repository.reportRepo import ReportRepo
from ..config.database import collection_reports

router = APIRouter(tags=["reports"])
reportRepo = ReportRepo(collection_reports)

# Define where to save images
UPLOAD_DIR = "uploads/reports"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ─────────────────────────────────────────────────────────────────────────────
# ⚠️  ORDER MATTERS in FastAPI — fixed routes must come BEFORE dynamic /{id}
#     /reports/stats, /reports/user/{userId}, /reports/reported/{userId},
#     and /reports/count/{userId} are all declared first on purpose.
# ─────────────────────────────────────────────────────────────────────────────

# ── YOUR EXISTING ENDPOINTS (unchanged) ──────────────────────────────────────

@router.post("/reports")
async def create_report(
    reporterId:   str = Form(...),
    reporterType: str = Form(...),
    reportedId:   str = Form(...),
    reportedType: str = Form(...),
    reason:       str = Form(...),
    description:  Optional[str] = Form(None),
    evidence:     Optional[UploadFile] = File(None)
):
    evidence_url = None

    if evidence:
        if not evidence.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Only image files are allowed.")
        
        file_extension = evidence.filename.split(".")[-1]
        unique_filename = f"{uuid4()}.{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(evidence.file, buffer)
        
        evidence_url = f"/static/reports/{unique_filename}"

    data = {
        "reporterId":   reporterId,
        "reporterType": reporterType,
        "reportedId":   reportedId,
        "reportedType": reportedType,
        "reason":       reason,
        "description":  description
    }
    
    report = reportRepo.createReport(data, evidence_url)
    return report


@router.get("/reports")
def get_reports(
    skip:         int = Query(0),
    limit:        int = Query(50),
    status:       str = Query("all"),
    reporterType: str = Query("all"),
    reportedType: str = Query("all"),
    search:       str = Query(""),
):
    return reportRepo.getReports(
        skip=skip, limit=limit,
        status=status,
        reporterType=reporterType,
        reportedType=reportedType,
        search=search,
    )


@router.get("/reports/stats")
def get_report_stats():
    return reportRepo.getStats()


@router.patch("/reports/{id}/status")
def update_status(id: str, status: str = Form(...), adminNote: str = Form("")):
    if status not in ("resolved", "declined"):
        raise HTTPException(status_code=400, detail="Invalid status")
    ok = reportRepo.updateReportStatus(id, status, adminNote)
    if not ok:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"success": True}


@router.get("/reports/user/{userId}")
def get_reports_by_user(userId: str):
    reports = reportRepo.getReportsByUserId(userId)
    return {
        "reports": reports,
        "total":   len(reports),
    }


@router.get("/reports/{id}")
def get_report_by_id(id: str):
    report = reportRepo.getReportById(id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.delete("/reports/{id}")
def delete_report(id: str):
    report = reportRepo.getReportById(id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    from bson import ObjectId
    reportRepo.col.delete_one({"_id": ObjectId(id)})
    return {"success": True}


# ── NEW ENDPOINTS ─────────────────────────────────────────────────────────────

# GET /reports/reported/{userId}
# Returns all reports filed AGAINST a user (reportedId = userId).
# Different from /user/{userId} which returns reports filed BY a user.
# Used in the admin modal to show prior history on the reported person.
@router.get("/reports/reported/{userId}")
def get_reports_against_user(userId: str):
    reports = list(reportRepo.col.find({"reportedId": userId}).sort("createdAt", -1))
    serialized = []
    for r in reports:
        r["id"] = str(r["_id"])
        del r["_id"]
        serialized.append(r)
    return {
        "reports":  serialized,
        "total":    len(serialized),
        "pending":  sum(1 for r in serialized if r.get("status") == "pending"),
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