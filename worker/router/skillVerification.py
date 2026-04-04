import cloudinary
import cloudinary.uploader
from ..config.cloudinary_config import cloudinary
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..config.database import collection_worker
from datetime import datetime

router = APIRouter(prefix="/upload", tags=["Upload"])


class SkillVerifyDecision(BaseModel):
    decision:   str
    skill_name: str
    reason:     Optional[str] = ""


@router.post("/skill-evidence")
async def upload_skill_evidence(
    file:       UploadFile = File(...),
    worker_id:  str        = Form(...),
    skill_name: str        = Form(...),
):
    ALLOWED_TYPES = {
        "image/jpeg", "image/png", "image/webp", "image/gif",
        "video/mp4", "video/quicktime", "video/x-msvideo", "video/webm",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"File type '{file.content_type}' not allowed.")

    MAX_SIZE = 50 * 1024 * 1024
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

    # Store evidence inside the specific skill object
    skill_update = {
        "skills.$.evidenceUrl":              file_url,
        "skills.$.evidenceType":             resource_type,
        "skills.$.evidenceName":             file.filename,
        "skills.$.evidenceUpdatedAt":        datetime.utcnow(),
        "skills.$.skillVerificationStatus":  "pending",
        "skills.$.skillVerifyReason":        "",
    }
    if thumbnail_url:
        skill_update["skills.$.evidenceThumbnail"] = thumbnail_url

    result = collection_worker.update_one(
        {"_id": worker_id, "skills.name": skill_name},
        {"$set": skill_update}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"Worker or skill '{skill_name}' not found.")

    return {
        "message":       "File uploaded successfully",
        "url":           file_url,
        "thumbnail":     thumbnail_url,
        "resource_type": resource_type,
        "filename":      file.filename,
        "skill_name":    skill_name,
    }


@router.get("/skill-evidence/all")
def get_all_skill_evidence(
    status: Optional[str] = None,
    skip:   int = 0,
    limit:  int = 50,
):
    # Match workers who have at least one skill with evidence
    query = {"skills": {"$elemMatch": {"evidenceUrl": {"$exists": True, "$ne": ""}}}}
    if status:
        query = {"skills": {"$elemMatch": {"evidenceUrl": {"$exists": True, "$ne": ""}, "skillVerificationStatus": status}}}

    workers = list(
        collection_worker.find(query, {"password": 0})
        .skip(skip).limit(limit)
        .sort("updatedAt", -1)
    )

    result = []
    for w in workers:
        skills_with_evidence = [
            {
                "name":                     sk.get("name", ""),
                "price":                    sk.get("price", 0),
                "evidenceUrl":              sk.get("evidenceUrl", ""),
                "evidenceType":             sk.get("evidenceType", ""),
                "evidenceName":             sk.get("evidenceName", ""),
                "evidenceThumbnail":        sk.get("evidenceThumbnail", ""),
                "evidenceUpdatedAt":        sk.get("evidenceUpdatedAt"),
                "skillVerificationStatus":  sk.get("skillVerificationStatus", "pending"),
                "skillVerifyReason":        sk.get("skillVerifyReason", ""),
            }
            for sk in w.get("skills", [])
            if sk.get("evidenceUrl")
        ]
        if not skills_with_evidence:
            continue
        result.append({
            "worker_id":    w.get("_id"),
            "name":         f"{w.get('firstName', '')} {w.get('lastName', '')}".strip(),
            "taskType":     w.get("taskType", ""),
            "profilePhoto": w.get("profilePhoto", ""),
            "skills":       skills_with_evidence,
        })

    total = collection_worker.count_documents(query)
    return {"evidence": result, "total": total}


@router.get("/skill-evidence/{worker_id}")
def get_worker_evidence(worker_id: str):
    w = collection_worker.find_one({"_id": worker_id}, {"password": 0})
    if not w:
        raise HTTPException(status_code=404, detail="Worker not found")

    skills_with_evidence = [
        {
            "name":                    sk.get("name", ""),
            "price":                   sk.get("price", 0),
            "evidenceUrl":             sk.get("evidenceUrl", ""),
            "evidenceType":            sk.get("evidenceType", ""),
            "evidenceName":            sk.get("evidenceName", ""),
            "evidenceThumbnail":       sk.get("evidenceThumbnail", ""),
            "evidenceUpdatedAt":       sk.get("evidenceUpdatedAt"),
            "skillVerificationStatus": sk.get("skillVerificationStatus", "pending"),
            "skillVerifyReason":       sk.get("skillVerifyReason", ""),
        }
        for sk in w.get("skills", [])
        if sk.get("evidenceUrl")
    ]

    return {
        "worker_id": worker_id,
        "name":      f"{w.get('firstName', '')} {w.get('lastName', '')}".strip(),
        "skills":    skills_with_evidence,
    }


@router.patch("/skill-evidence/{worker_id}/review")
def review_skill_evidence(worker_id: str, body: SkillVerifyDecision):
    if body.decision not in ("accepted", "rejected"):
        raise HTTPException(status_code=400, detail="decision must be 'accepted' or 'rejected'")

    result = collection_worker.update_one(
        {"_id": worker_id, "skills.name": body.skill_name},
        {"$set": {
            "skills.$.skillVerificationStatus": body.decision,
            "skills.$.skillVerifyReason":       body.reason or "",
            "skills.$.skillVerifiedAt":         datetime.utcnow(),
        }}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Worker or skill not found")

    return {
        "message":    f"Skill '{body.skill_name}' evidence {body.decision}",
        "worker_id":  worker_id,
        "skill_name": body.skill_name,
        "decision":   body.decision,
        "reason":     body.reason,
    }


@router.delete("/skill-evidence/{worker_id}")
def delete_skill_evidence(worker_id: str, skill_name: str):
    result = collection_worker.update_one(
        {"_id": worker_id, "skills.name": skill_name},
        {"$unset": {
            "skills.$.evidenceUrl":              "",
            "skills.$.evidenceType":             "",
            "skills.$.evidenceName":             "",
            "skills.$.evidenceThumbnail":        "",
            "skills.$.evidenceUpdatedAt":        "",
            "skills.$.skillVerifyReason":        "",
            "skills.$.skillVerifiedAt":          "",
            "skills.$.skillVerificationStatus":  "",
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Worker or skill not found")
    return {"message": f"Evidence removed for skill '{skill_name}'"}