import cloudinary
import cloudinary.uploader
from ..config.cloudinary_config import cloudinary
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from ..config.database import collection_worker
from ..services.auth import get_current_user, require_admin
from typing import Dict
from datetime import datetime

router = APIRouter(prefix="/upload", tags=["Upload"])

CATEGORY_SKILLS_MAP = {
    "Plumbing":         ["Pipe Repair", "Drain Cleaning", "Sewer Repair", "Fixture Installation", "Water Heater Repair"],
    "Moving":           ["Packing", "Loading & Unloading", "Furniture Moving", "Relocation Support"],
    "Cleaning":         ["House Cleaning", "Office Cleaning", "Carpet Cleaning", "Window Cleaning", "Laundry & Ironing"],
    "Gardening":        ["Lawn Care", "Landscaping", "Tree Service", "Plant Care", "Garden Maintenance"],
    "Painting":         ["Interior Painting", "Exterior Painting", "Wall Painting", "Touch-ups & Patching"],
    "Carpentry":        ["Furniture Repair", "Cabinet Making", "Shelving & Storage", "Woodwork", "Joinery"],
    "Appliance Repair": ["Washer Repair", "Dryer Repair", "Fridge Repair", "Oven Repair"],
    "Electrical":       ["Wiring & Rewiring", "Lighting Installation", "Circuit Repair", "Outlet & Switch Repair"],
    "HVAC":             ["Heating Repair", "Air Conditioning", "Ventilation", "Furnace Repair", "Cooling Systems"],
    "Assembly":         ["Furniture Assembly", "Flat-pack Assembly", "TV Mounting", "Shelving Installation"],
}

# Build reverse map: sub-skill -> category
SUB_TO_CATEGORY = {
    sub: cat
    for cat, subs in CATEGORY_SKILLS_MAP.items()
    for sub in subs
}


def resolve_category(skill_name: str) -> Optional[str]:
    """Return the broad category for a given skill name or category name."""
    if skill_name in CATEGORY_SKILLS_MAP:
        return skill_name  # already a category
    return SUB_TO_CATEGORY.get(skill_name)  # sub-skill → category


class SkillVerifyDecision(BaseModel):
    decision: str          # "accepted" | "rejected"
    category: str          # e.g. "Carpentry"
    reason:   Optional[str] = ""


# ─── Upload evidence (per category) ───────────────────────────────────────────

@router.post("/skill-evidence")
async def upload_skill_evidence(
    file:       UploadFile = File(...),
    worker_id:  str        = Form(...),
    skill_name: str        = Form(...),   # can be a sub-skill OR category name
    current_user: Dict = Depends(get_current_user),
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

    contents = await file.read()
    if len(contents) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 50 MB.")

    # Only the worker themselves or admin may upload evidence
    if current_user.get("user_type") != "admin" and str(current_user.get("user_id")) != str(worker_id):
        raise HTTPException(status_code=403, detail="Forbidden")

    category = resolve_category(skill_name)
    if not category:
        raise HTTPException(status_code=400, detail=f"Cannot resolve category for skill '{skill_name}'.")

    resource_type = (
        "video" if file.content_type.startswith("video/") else
        "image" if file.content_type.startswith("image/") else
        "raw"
    )

    try:
        upload_result = cloudinary.uploader.upload(
            contents,
            resource_type=resource_type,
            folder=f"skill_evidence/{worker_id}/{category}",
            eager=[{"width": 300, "height": 200, "crop": "fill"}] if resource_type == "video" else [],
        )
        file_url      = upload_result["secure_url"]
        thumbnail_url = (
            upload_result["eager"][0]["secure_url"]
            if resource_type == "video" and upload_result.get("eager")
            else None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

    # Build the skillVerify.<Category> subdocument
    category_doc = {
        f"skillVerify.{category}.status":             "pending",
        f"skillVerify.{category}.evidenceUrl":        file_url,
        f"skillVerify.{category}.evidenceType":       resource_type,
        f"skillVerify.{category}.evidenceName":       file.filename,
        f"skillVerify.{category}.evidenceUpdatedAt":  datetime.utcnow(),
        f"skillVerify.{category}.skillVerifyReason":  "",
        f"skillVerify.{category}.skillVerifiedAt":    None,
    }
    if thumbnail_url:
        category_doc[f"skillVerify.{category}.evidenceThumbnail"] = thumbnail_url

    result = collection_worker.update_one(
        {"_id": worker_id},
        {"$set": category_doc}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Worker not found.")

    return {
        "message":       "Evidence uploaded successfully",
        "url":           file_url,
        "thumbnail":     thumbnail_url,
        "resource_type": resource_type,
        "category":      category,
        "original_skill": skill_name,
    }


# ─── Get all workers with pending/any category evidence ───────────────────────

@router.get("/skill-evidence/all")
def get_all_skill_evidence(
    status: Optional[str] = None,
    skip:   int = 0,
    limit:  int = 50,
    admin: dict = Depends(require_admin),
):
    # Admin only
    from fastapi import Depends
    from ..services.auth import require_admin
    # note: use dependency inside function to avoid changing global router behavior
    admin = Depends(require_admin)
    query = {"skillVerify": {"$exists": True, "$ne": {}}}
    if status:
        # Match workers where at least one category has the given status
        query = {f"skillVerify.{cat}.status": status for cat in []}  # dynamic below
        query = {"$or": [{f"skillVerify.{cat}.status": status} for cat in CATEGORY_SKILLS_MAP]}

    workers = list(
        collection_worker.find(query, {"password": 0})
        .skip(skip).limit(limit)
        .sort("updatedAt", -1)
    )

    result = []
    for w in workers:
        skill_verify = w.get("skillVerify", {})
        categories = []
        for cat, data in skill_verify.items():
            if not data.get("evidenceUrl"):
                continue
            if status and data.get("status") != status:
                continue
            categories.append({
                "category":               cat,
                "status":                 data.get("status", "pending"),
                "evidenceUrl":            data.get("evidenceUrl", ""),
                "evidenceType":           data.get("evidenceType", ""),
                "evidenceName":           data.get("evidenceName", ""),
                "evidenceThumbnail":      data.get("evidenceThumbnail", ""),
                "evidenceUpdatedAt":      data.get("evidenceUpdatedAt"),
                "skillVerifyReason":      data.get("skillVerifyReason", ""),
                "skillVerifiedAt":        data.get("skillVerifiedAt"),
            })
        if not categories:
            continue
        result.append({
            "worker_id":    w.get("_id"),
            "name":         f"{w.get('firstName', '')} {w.get('lastName', '')}".strip(),
            "taskType":     w.get("taskType", ""),
            "profilePhoto": w.get("profilePhoto", ""),
            "categories":   categories,
        })

    total = collection_worker.count_documents(query)
    return {"evidence": result, "total": total}


# ─── Get single worker's category evidence ────────────────────────────────────

@router.get("/skill-evidence/{worker_id}")
def get_worker_evidence(worker_id: str, current_user: Dict = Depends(get_current_user)):
    w = collection_worker.find_one({"_id": worker_id}, {"password": 0})
    if not w:
        raise HTTPException(status_code=404, detail="Worker not found")

    skill_verify = w.get("skillVerify", {})
    categories = [
        {
            "category":          cat,
            "status":            data.get("status", "pending"),
            "evidenceUrl":       data.get("evidenceUrl", ""),
            "evidenceType":      data.get("evidenceType", ""),
            "evidenceName":      data.get("evidenceName", ""),
            "evidenceThumbnail": data.get("evidenceThumbnail", ""),
            "evidenceUpdatedAt": data.get("evidenceUpdatedAt"),
            "skillVerifyReason": data.get("skillVerifyReason", ""),
            "skillVerifiedAt":   data.get("skillVerifiedAt"),
        }
        for cat, data in skill_verify.items()
        if data.get("evidenceUrl")
    ]

    return {
        "worker_id":  worker_id,
        "name":       f"{w.get('firstName', '')} {w.get('lastName', '')}".strip(),
        "categories": categories,
    }


# ─── Admin reviews a category ─────────────────────────────────────────────────

@router.patch("/skill-evidence/{worker_id}/review")
def review_skill_evidence(worker_id: str, body: SkillVerifyDecision, admin: Dict = Depends(require_admin)):
    if body.decision not in ("accepted", "rejected"):
        raise HTTPException(status_code=400, detail="decision must be 'accepted' or 'rejected'")

    if body.category not in CATEGORY_SKILLS_MAP:
        raise HTTPException(status_code=400, detail=f"Unknown category '{body.category}'")

    result = collection_worker.update_one(
        {"_id": worker_id},
        {"$set": {
            f"skillVerify.{body.category}.status":            body.decision,
            f"skillVerify.{body.category}.skillVerifyReason": body.reason or "",
            f"skillVerify.{body.category}.skillVerifiedAt":   datetime.utcnow(),
        }}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Worker not found")

    return {
        "message":   f"Category '{body.category}' evidence {body.decision}",
        "worker_id": worker_id,
        "category":  body.category,
        "decision":  body.decision,
        "reason":    body.reason,
    }


# ─── Delete evidence for a category ──────────────────────────────────────────

@router.delete("/skill-evidence/{worker_id}")
def delete_skill_evidence(worker_id: str, category: str, admin: Dict = Depends(require_admin)):
    if category not in CATEGORY_SKILLS_MAP:
        raise HTTPException(status_code=400, detail=f"Unknown category '{category}'")

    result = collection_worker.update_one(
        {"_id": worker_id},
        {"$unset": {f"skillVerify.{category}": ""}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Worker not found")

    return {"message": f"Evidence removed for category '{category}'"}