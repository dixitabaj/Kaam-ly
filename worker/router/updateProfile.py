from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Depends
from ..services.auth import get_current_user
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId
from ..config.cloudinary_config import cloudinary
from ..config.database import collection

router = APIRouter(prefix="/update/customer", tags=["Customer Profile"])

# ── Helper ────────────────────────────────────────────────────────────────────

def to_object_id(id: str):
    try:
        return ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid customer ID format")

# ── Schemas ───────────────────────────────────────────────────────────────────

class UpdateNameSchema(BaseModel):
    customer_id: str
    first_name: str
    last_name: str

class UpdateAddressSchema(BaseModel):
    customer_id: str
    address: str

class UpdateDOBSchema(BaseModel):
    customer_id: str
    date_of_birth: str  # "YYYY-MM-DD"

class UpdateGenderSchema(BaseModel):
    customer_id: str
    gender: str  # "male" | "female" | "other" | "non-binary" | "prefer not to say"

class UpdateBioSchema(BaseModel):
    customer_id: str
    bio: str

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.patch("/update-name")
async def update_name(data: UpdateNameSchema, current_user: dict = Depends(get_current_user)):
    # Only owner or admin may update name
    if current_user.get("user_type") != "admin" and str(current_user.get("user_id")) != str(data.customer_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    result = collection.update_one(
        {"_id": to_object_id(data.customer_id)},
        {"$set": {
            "first_name": data.first_name.strip(),
            "last_name":  data.last_name.strip(),
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Name updated successfully"}


@router.patch("/update-address")
async def update_address(data: UpdateAddressSchema, current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "admin" and str(current_user.get("user_id")) != str(data.customer_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    result = collection.update_one(
        {"_id": to_object_id(data.customer_id)},
        {"$set": {"address": data.address.strip()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Address updated successfully"}


@router.patch("/update-dob")
async def update_dob(data: UpdateDOBSchema, current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "admin" and str(current_user.get("user_id")) != str(data.customer_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    result = collection.update_one(
        {"_id": to_object_id(data.customer_id)},
        {"$set": {"date_of_birth": data.date_of_birth}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Date of birth updated successfully"}


@router.patch("/update-gender")
async def update_gender(data: UpdateGenderSchema, current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "admin" and str(current_user.get("user_id")) != str(data.customer_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    allowed = {"male", "female", "other", "non-binary", "prefer not to say"}
    if data.gender.lower() not in allowed:
        raise HTTPException(status_code=400, detail="Invalid gender value")
    result = collection.update_one(
        {"_id": to_object_id(data.customer_id)},
        {"$set": {"gender": data.gender.lower()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Gender updated successfully"}


@router.patch("/update-bio")
async def update_bio(data: UpdateBioSchema, current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "admin" and str(current_user.get("user_id")) != str(data.customer_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    if len(data.bio) > 300:
        raise HTTPException(status_code=400, detail="Bio must be under 300 characters")
    result = collection.update_one(
        {"_id": to_object_id(data.customer_id)},
        {"$set": {"bio": data.bio.strip()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Bio updated successfully"}


@router.patch("/{customer_id}/photo")
async def update_photo(customer_id: str, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    # Only owner or admin may update photo
    if current_user.get("user_type") != "admin" and str(current_user.get("user_id")) != str(customer_id):
        raise HTTPException(status_code=403, detail="Forbidden")

    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG or WebP images allowed")

    customer = collection.find_one({"_id": to_object_id(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    contents = await file.read()  # UploadFile.read() is still async
    # Enforce a 5MB file size limit
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    upload = cloudinary.uploader.upload(
        contents,
        folder=f"profile_photos/{customer_id}",
        resource_type="image",
    )
    photo_url = upload.get("secure_url")

    collection.update_one(
        {"_id": to_object_id(customer_id)},
        {"$set": {"profile_picture": photo_url}}
    )

    return {"message": "Photo updated", "photo_url": photo_url}