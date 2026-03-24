# routers/uploadRouter.py
#
# pip install cloudinary python-multipart
#
# Mount in main.py:
#   from routers.uploadRouter import router as upload_router
#   app.include_router(upload_router, prefix="/api")

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..config.database import collection_worker
from datetime import datetime
from ..config import cloudinary_config # ← just to ensure config is loaded

router = APIRouter(prefix="/upload", tags=["Upload"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class SkillVerifyDecision(BaseModel):
    decision: str        # "accepted" or "rejected"
    reason:   Optional[str] = ""   # optional rejection reason shown to worker


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post("/skill-evidence")
async def upload_skill_evidence(
    file:      UploadFile = File(...),
    worker_id: str        = Form(...),
):
    """
    Upload skill evidence (image / video / PDF / doc) for a worker.
    Stores the Cloudinary URL in the worker's MongoDB document.
    """
    ALLOWED_TYPES = {
        "image/jpeg", "image/png", "image/webp", "image/gif",
        "video/mp4", "video/quicktime", "video/x-msvideo", "video/webm",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"File type '{file.content_type}' not allowed.")

    MAX_SIZE = 50 * 1024 * 1024   # 50 MB
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 50 MB.")

    if file.content_type.startswith("video/"):
        resource_type = "video"
    elif file.content_type.startswith("image/"):
        resource_type = "image"
    else:
        resource_type = "raw"

    try:
        result = cloudinary.uploader.upload(
            contents,
            resource_type = resource_type,
            folder        = f"skill_evidence/{worker_id}",
            eager = [{"width": 300, "height": 200, "crop": "fill"}] if resource_type == "video" else [],
        )
        file_url      = result["secure_url"]
        thumbnail_url = (
            result["eager"][0]["secure_url"]
            if resource_type == "video" and result.get("eager")
            else None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

    update_data = {
        "skillEvidenceUrl":       file_url,
        "skillEvidenceType":      resource_type,
        "skillEvidenceName":      file.filename,
        "skillEvidenceUpdatedAt": datetime.utcnow(),
        # Reset verification status whenever a new file is uploaded
        "skill_verified":         "pending",
        "skillVerifyReason":      "",
    }
    if thumbnail_url:
        update_data["skillEvidenceThumbnail"] = thumbnail_url

    collection_worker.update_one({"_id": worker_id}, {"$set": update_data})

    return {
        "message":       "File uploaded successfully",
        "url":           file_url,
        "thumbnail":     thumbnail_url,
        "resource_type": resource_type,
        "filename":      file.filename,
    }


# ── View all evidence (admin) ─────────────────────────────────────────────────

@router.get("/skill-evidence/all")
def get_all_skill_evidence(
    status: Optional[str] = None,   # filter: "pending" | "accepted" | "rejected"
    skip:   int = 0,
    limit:  int = 50,
):
    """
    Returns all workers who have uploaded skill evidence.
    Optionally filter by skill_verified status: pending / accepted / rejected.
    Used by the admin panel to review and action submissions.
    """
    query = {"skillEvidenceUrl": {"$exists": True, "$ne": ""}}
    if status:
        query["skill_verified"] = status

    workers = list(
        collection_worker.find(query, {
            "password": 0,
        }).skip(skip).limit(limit).sort("skillEvidenceUpdatedAt", -1)
    )

    result = []
    for w in workers:
        result.append({
            "worker_id":    w.get("email") or str(w["_id"]),
            "name":         f"{w.get('firstName', '')} {w.get('lastName', '')}".strip(),
            "taskType":     w.get("taskType", ""),
            "skills":       w.get("skills", []),
            "profilePhoto": w.get("profilePhoto", ""),
            # Evidence fields
            "evidenceUrl":       w.get("skillEvidenceUrl", ""),
            "evidenceType":      w.get("skillEvidenceType", ""),
            "evidenceName":      w.get("skillEvidenceName", ""),
            "evidenceThumbnail": w.get("skillEvidenceThumbnail", ""),
            "evidenceUploadedAt": w.get("skillEvidenceUpdatedAt"),
            # Verification status
            "skill_verified":   w.get("skill_verified", "pending"),
            "skillVerifyReason": w.get("skillVerifyReason", ""),
        })

    total = collection_worker.count_documents(query)
    return {"evidence": result, "total": total}


# ── View single worker's evidence ─────────────────────────────────────────────

@router.get("/skill-evidence/{worker_id}")
def get_worker_evidence(worker_id: str):
    """Get skill evidence for a specific worker."""
    w = collection_worker.find_one({"_id": worker_id}, {"password": 0})
    if not w:
        raise HTTPException(status_code=404, detail="Worker not found")

    return {
        "worker_id":         worker_id,
        "name":              f"{w.get('firstName', '')} {w.get('lastName', '')}".strip(),
        "evidenceUrl":       w.get("skillEvidenceUrl", ""),
        "evidenceType":      w.get("skillEvidenceType", ""),
        "evidenceName":      w.get("skillEvidenceName", ""),
        "evidenceThumbnail": w.get("skillEvidenceThumbnail", ""),
        "evidenceUploadedAt": w.get("skillEvidenceUpdatedAt"),
        "skill_verified":    w.get("skill_verified", "pending"),
        "skillVerifyReason": w.get("skillVerifyReason", ""),
    }


# ── Accept / Reject skill evidence (admin) ────────────────────────────────────

@router.patch("/skill-evidence/{worker_id}/review")
def review_skill_evidence(worker_id: str, body: SkillVerifyDecision):
    """
    Admin endpoint to accept or reject a worker's skill evidence.

    PATCH /api/upload/skill-evidence/{worker_id}/review
    Body: { "decision": "accepted" | "rejected", "reason": "optional note" }

    Sets skill_verified to "accepted" or "rejected" in MongoDB.
    """
    if body.decision not in ("accepted", "rejected"):
        raise HTTPException(
            status_code=400,
            detail="decision must be 'accepted' or 'rejected'"
        )

    result = collection_worker.update_one(
        {"_id": worker_id},
        {"$set": {
            "skill_verified":      body.decision,
            "skillVerifyReason":   body.reason or "",
            "skillVerifiedAt":     datetime.utcnow(),
        }}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Worker not found")

    return {
        "message":        f"Skill evidence {body.decision} for worker {worker_id}",
        "worker_id":      worker_id,
        "skill_verified": body.decision,
        "reason":         body.reason,
    }


# ── Delete evidence ───────────────────────────────────────────────────────────

@router.delete("/skill-evidence/{worker_id}")
def delete_skill_evidence(worker_id: str):
    """Remove skill evidence and reset verification for a worker."""
    result = collection_worker.update_one(
        {"_id": worker_id},
        {"$unset": {
            "skillEvidenceUrl":       "",
            "skillEvidenceType":      "",
            "skillEvidenceName":      "",
            "skillEvidenceThumbnail": "",
            "skillEvidenceUpdatedAt": "",
            "skillVerifyReason":      "",
            "skillVerifiedAt":        "",
        },
        "$set": {
            "skill_verified": False,
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {"message": "Skill evidence removed"}