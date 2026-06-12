from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from ..schemas import schemas
from ..repository import workerRepo
from worker.config.database import collection_worker
import string, secrets
from passlib.context import CryptContext

router = APIRouter(tags=["worker"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ══════════════════════════════════════════════════════════════════════════════
# WORKER CRUD
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/worker")
def add_worker(request: schemas.WorkerCreateSchema):
    return workerRepo.addWorker(request)


@router.get("/workers/all")
def get_workers(
    skip:   int = Query(0,   ge=0),
    limit:  int = Query(50,  ge=1, le=500),
    search: str = None,
):
    return workerRepo.showWorkers(skip=skip, limit=limit, search=search)

@router.get("/all/worker")
def get_worker(
    skip:   int = Query(0, ge=0),
    limit:  Optional[int] = Query(None),
    search: str = None,
):
    return workerRepo.showWorkers(skip=skip, limit=limit, search=search)

@router.get("/worker/{id}")
def show_worker_by_id(id: str):
    return workerRepo.showWorkerByID(id)


@router.get("/worker/category/{category}")
def get_worker_by_category(category: str):
    return workerRepo.getWorkerByCategory(category)


@router.delete("/worker/delete/{id}")
def delete_worker(id: str):
    result = workerRepo.deleteWorkerById(id)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {"message": "Worker deleted successfully"}


@router.patch("/worker/status/{id}")
def update_worker_status(id: str, body: schemas.StatusUpdate):
    if body.status not in ("active", "suspended", "inactive", "pending"):
        raise HTTPException(status_code=400, detail="Invalid status value")
    result = workerRepo.updateWorkerAccountStatus(id, body.status)
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {"message": f"Worker status updated to {body.status}"}


@router.patch("/worker/verify-skill/{id}")
def verify_skill(id: str):
    result = workerRepo.verifyWorkerSkill(id)
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {"message": "Skill verified"}


@router.patch("/worker/verify-face/{id}")
def verify_face(id: str):
    result = workerRepo.verifyWorkerFace(id)
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {"message": "Face verified"}


@router.patch("/worker/reset-password/{id}")
def reset_password(id: str):
    alphabet      = string.ascii_letters + string.digits
    temp_password = "".join(secrets.choice(alphabet) for _ in range(10))
    hashed        = pwd_context.hash(temp_password)
    result        = workerRepo.resetWorkerPassword(id, hashed)
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {"temp_password": temp_password}


# ══════════════════════════════════════════════════════════════════════════════
# HOME / DISCOVERY
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/")
def get_home_data(limit: int = 8):
    return workerRepo.getHomeData(limit)


@router.get("/popular-services")
def get_popular_services(limit_per_category: int = 8):
    data = workerRepo.getPopularServices(limit_per_category)
    return {"categories": data, "total_categories": len(data)}


@router.get("/popular-services/{category}")
def get_popular_services_by_category(category: str, limit: int = 10):
    workers = list(
        collection_worker.find(
            {
                "taskType": {"$regex": f"^{category.strip()}$", "$options": "i"},
                "status":   {"$ne": "suspended"},
            },
            {"password": 0},
        ).sort("noOfCompletedTask", -1).limit(limit)
    )
    return [workerRepo._format_worker(w) for w in workers]


@router.get("/top-rated/")
def get_top_rated(limit: int = 8):
    return workerRepo.getTopRatedWorkers(limit)


@router.get("/emergency/")
def get_emergency(limit: int = 8):
    return workerRepo.getEmergencyWorkers(limit)


@router.get("/basePrice/{category}/{worker_id}")
def get_base_price_by_category(category: str, worker_id: str):
    return workerRepo.getPriceByTask(category, worker_id)


# ══════════════════════════════════════════════════════════════════════════════
# AVAILABILITY SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class SlotSchema(BaseModel):
    start: str   # "09:00"
    end:   str   # "17:00"


class DayHoursSchema(BaseModel):
    day:   str              # "Monday"
    slots: List[SlotSchema] # [] to clear the day


class WeeklyHoursSchema(BaseModel):
    Monday:    List[SlotSchema] = []
    Tuesday:   List[SlotSchema] = []
    Wednesday: List[SlotSchema] = []
    Thursday:  List[SlotSchema] = []
    Friday:    List[SlotSchema] = []
    Saturday:  List[SlotSchema] = []
    Sunday:    List[SlotSchema] = []


class UnavailableDatesSchema(BaseModel):
    dates: List[str]   # ["2025-12-25", "2025-12-26"]


class AvailabilityToggleSchema(BaseModel):
    isAvailable: bool


# ══════════════════════════════════════════════════════════════════════════════
# AVAILABILITY ROUTES
# ══════════════════════════════════════════════════════════════════════════════

# GET /worker/{worker_id}/availability
@router.get("/worker/{worker_id}/availability")
def get_availability(worker_id: str):
    return workerRepo.getAvailability(worker_id)


# PUT /worker/{worker_id}/availability/hours  — replace full weekly schedule
@router.put("/worker/{worker_id}/availability/hours")
def update_weekly_hours(worker_id: str, body: WeeklyHoursSchema):
    hours = {day: [s.dict() for s in slots] for day, slots in body.dict().items()}
    return workerRepo.updateWeeklyHours(worker_id, hours)


# PATCH /worker/{worker_id}/availability/hours/day  — update one day
@router.patch("/worker/{worker_id}/availability/hours/day")
def update_day_hours(worker_id: str, body: DayHoursSchema):
    slots = [s.dict() for s in body.slots]
    return workerRepo.updateDayHours(worker_id, body.day, slots)


# POST /worker/{worker_id}/availability/unavailable-dates  — add dates
@router.post("/worker/{worker_id}/availability/unavailable-dates")
def add_unavailable_dates(worker_id: str, body: UnavailableDatesSchema):
    return workerRepo.addUnavailableDates(worker_id, body.dates)


# DELETE /worker/{worker_id}/availability/unavailable-dates  — remove dates
@router.delete("/worker/{worker_id}/availability/unavailable-dates")
def remove_unavailable_dates(worker_id: str, body: UnavailableDatesSchema):
    return workerRepo.removeUnavailableDates(worker_id, body.dates)

# ══════════════════════════════════════════════════════════════════════════════
# ADD THESE TO workerRepo.py
# ══════════════════════════════════════════════════════════════════════════════

# -----------------------------
# ✏️ Update worker profile (PATCH)
# -----------------------------



# ══════════════════════════════════════════════════════════════════════════════
# ADD THESE TO workerRouter.py
# ══════════════════════════════════════════════════════════════════════════════

from typing import List

# PATCH /worker/{id}  — partial profile update
@router.patch("/worker/{id}")
def update_worker_profile(id: str, body: schemas.WorkerProfileUpdateSchema):
    # Convert Pydantic model to dict, excluding None values
    update_data = body.dict(exclude_none=True)
    
    # Pydantic already validated and converted everything!
    # Just pass it to the repo
    return workerRepo.updateWorkerProfile(id, update_data)


# ══════════════════════════════════════════════════════════════════════════════
# ALSO ADD: photo upload endpoint (if not already present)
# POST /worker/upload-photo/{id}
# ══════════════════════════════════════════════════════════════════════════════

from fastapi import UploadFile, File
import cloudinary
import cloudinary.uploader

# Configure cloudinary at the top of your router/main file:
# cloudinary.config(cloud_name=..., api_key=..., api_secret=...)

@router.post("/worker/upload-photo/{id}")
async def upload_worker_photo(id: str, photo: UploadFile = File(...)):
    worker = collection_worker.find_one({"_id": id})
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    contents = await photo.read()
    result   = cloudinary.uploader.upload(
        contents,
        folder=f"worker_photos/{id}",
        public_id="profile",
        overwrite=True,
        resource_type="image",
    )
    photo_url = result["secure_url"]

    collection_worker.update_one(
        {"_id": id},
        {"$set": {"profilePhoto": photo_url, "updatedAt": datetime.utcnow()}},
    )
    return {"photo_url": photo_url, "message": "Photo updated successfully"}


# GET /worker/{worker_id}/availability/check?date=2025-12-25
@router.get("/worker/{worker_id}/availability/check")
def check_availability_on_date(worker_id: str, date: str):
    return workerRepo.checkAvailabilityOnDate(worker_id, date)

@router.patch("/worker/{id}/availability/toggle")
def toggle_worker_availability(id: str, body: AvailabilityToggleSchema):
    return workerRepo.toggleWorkerAvailability(id, body.isAvailable)



@router.post("/worker/{id}/view")
def recordWorkerView(worker_id: str, viewer_id: str = None):
    if viewer_id and viewer_id == worker_id:
        return {"message": "Own view not counted"}

    collection_worker.update_one(
        {"_id": worker_id},
        {"$inc": {"view_count": 1}}
    )

    # ── LinUCB: weak interest signal ──
    try:
        from ..router.recommend_router import linucb, TASK_CATEGORIES, build_feature_vector, refresh_global_theta, save_model
        worker = collection_worker.find_one({"_id": worker_id})
        if worker:
            task_type  = worker.get("taskType", "")
            normalized = CATEGORY_ALIAS.get(task_type.lower().strip(), task_type)
            if linucb and normalized in TASK_CATEGORIES:
                arm  = TASK_CATEGORIES.index(normalized)
                x, _ = build_feature_vector(worker, normalized)
                linucb.update(arm, x, reward=0.05)   # very weak signal
                refresh_global_theta()
                save_model()
    except Exception as e:
        print(f"⚠️ LinUCB view signal failed: {e}")

    return {"message": "View recorded"}

@router.get("/worker/{id}/views")
def get_worker_views(id: str):
    return workerRepo.getWorkerViewCount(id)