from fastapi import HTTPException
from worker.config.database import collection_worker
from ..services.hashing import Hash
from ..schemas.schemas import WorkerCreateSchema, WorkerResponseSchema
from datetime import datetime
from bson import ObjectId

# -----------------------------
# 1️⃣ Add a worker
# -----------------------------
VALID_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
 
def addWorker(request: WorkerCreateSchema):
    if collection_worker.find_one({"_id": request.email}):
        raise HTTPException(status_code=400, detail="Worker email already registered")
 
    # Build hours from request — convert SlotSchema objects to plain dicts
    incoming = request.hours or {}
    hours = {}
    for day in VALID_DAYS:
        slots = incoming.get(day, [])
        # slots may be SlotSchema instances or already dicts
        hours[day] = [
            s.dict() if hasattr(s, "dict") else s
            for s in slots
        ]
 
    worker_doc = {
        "_id":               request.email,
        "firstName":         request.firstName,
        "lastName":          request.lastName,
        "phoneNo":           request.phoneNo,
        "email":             request.email,
        "password":          Hash.bcrypt(request.password),
        "taskType":          request.taskType,
        "skills":            [skill.dict() for skill in request.skills],
        "description":       request.description,
        "profilePhoto":      request.profilePhoto,
        "serviceAreas":      request.serviceAreas,
        "noOfCompletedTask": 0,
        "total_cancelled":   0,
        "ratings":           0.0,
        "reviewCount":       0,
        "responseTime":      0,
        "isAvailable":       request.isAvailable,
        "status":            "pending",
        "face_verified":     request.face_verified,
        "skill_verified":    request.skill_verified,
        "role":              request.role,
        "minHours":          request.minHours,
        "hours":             hours,          # ← now populated from request
        "registeredAt":      datetime.utcnow(),
    }
 
    result = collection_worker.insert_one(worker_doc)
    return {"id": str(result.inserted_id), "message": "Worker created successfully"}
# -----------------------------
# 2️⃣ Show all workers
# -----------------------------
def showWorkers(skip: int = 0, limit: int = 50, search: str = None):
    query = {"$text": {"$search": search}} if search else {}
    total = collection_worker.count_documents(query)
    workers = list(
        collection_worker.find(query, {"password": 0}).skip(skip).limit(limit)
    )
    for worker in workers:
        worker["id"] = str(worker["_id"])
        del worker["_id"]
    return {"workers": workers, "total": total}


# -----------------------------
# 3️⃣ Show worker by ID
# -----------------------------
def showWorkerByID(worker_id: str):
    w = collection_worker.find_one({"_id": worker_id}, {"password": 0})
    if not w:
        raise HTTPException(status_code=404, detail="Worker not found")

    service_area = w.get("serviceArea", {})
    return WorkerResponseSchema(
        id=str(w["_id"]),
        firstName=w.get("firstName", ""),
        lastName=w.get("lastName", ""),
        ratings=w.get("ratings", 0.0),
        taskType=w.get("taskType", ""),
        skills=w.get("skills", []),
        noOfCompletedTask=w.get("noOfCompletedTask", 0),
        responseTime=w.get("responseTime", 0),
        profilePhoto=w.get("profilePhoto", ""),
        description=w.get("description", ""),
        isAvailable=w.get("isAvailable", True),
        minHours=w.get("minHours", 0),
        serviceArea={
            "primaryCity": service_area.get("primaryCity", ""),
            "cities":      service_area.get("cities", []),
        },
    )


# -----------------------------
# 4️⃣ Get workers by category
# -----------------------------
def getWorkerByCategory(category: str):
    workers = list(
        collection_worker.find(
            {"taskType": {"$regex": f"^{category.strip()}$", "$options": "i"}},
            {"password": 0},
        )
    )
    if not workers:
        raise HTTPException(status_code=404, detail=f"No workers found in category '{category}'")
    return workers


# -----------------------------
# 5️⃣ Delete worker
# -----------------------------
def deleteWorkerById(id: str):
    return collection_worker.delete_one({"_id": id})


# -----------------------------
# 6️⃣ Update account status
# -----------------------------
def updateWorkerAccountStatus(id: str, status: str):
    return collection_worker.update_one({"_id": id}, {"$set": {"status": status}})


# -----------------------------
# 7️⃣ Toggle availability
# -----------------------------
def toggleWorkerAvailability(id: str, isAvailable: bool):
    return collection_worker.update_one(
        {"_id": id},
        {"$set": {"isAvailable": isAvailable, "availability_updated_at": datetime.utcnow()}},
    )


# -----------------------------
# 8️⃣ Verify skill
# -----------------------------
def verifyWorkerSkill(id: str):
    return collection_worker.update_one({"_id": id}, {"$set": {"skill_verified": True}})


# -----------------------------
# 9️⃣ Verify face
# -----------------------------
def verifyWorkerFace(id: str):
    return collection_worker.update_one({"_id": id}, {"$set": {"face_verified": True}})


# -----------------------------
# 🔑 Reset password
# -----------------------------
def resetWorkerPassword(id: str, hashed_password: str):
    return collection_worker.update_one({"_id": id}, {"$set": {"password": hashed_password}})


# -----------------------------
# 🏠 Popular Services
# -----------------------------
def getPopularServices(limit_per_category: int = 8):
    pipeline = [
        {
            "$match": {
                "status":   {"$ne": "suspended"},
                "taskType": {"$exists": True, "$ne": None, "$ne": ""},
            }
        },
        {"$sort": {"noOfCompletedTask": -1}},
        {
            "$group": {
                "_id": "$taskType",
                "workers": {
                    "$push": {
                        "id":              "$email",
                        "name":            {"$concat": ["$firstName", " ", "$lastName"]},
                        "service_type":    "$taskType",
                        "rating":          "$ratings",
                        "review_count":    "$reviewCount",
                        "completed_tasks": "$noOfCompletedTask",
                      
                        "profile_pic":     "$profilePhoto",
                        "is_available":    "$isAvailable",
                        "response_time":   "$responseTime",
                        "face_verified":   "$face_verified",
                        "skill_verified":  "$skill_verified",
                        "description":     "$description",
                        "area": {
                            "$ifNull": [
                                "$serviceArea.primaryCity",
                                {"$ifNull": ["$serviceArea.city", "Nepal"]},
                            ]
                        },
                    }
                },
                "total_bookings": {"$sum": "$noOfCompletedTask"},
                "avg_rating":     {"$avg": "$ratings"},
                "total_workers":  {"$sum": 1},
            }
        },
        {"$sort": {"total_bookings": -1}},
        {
            "$project": {
                "category":       "$_id",
                "workers":        {"$slice": ["$workers", limit_per_category]},
                "total_bookings": 1,
                "total_workers":  1,
                "avg_rating":     {"$round": ["$avg_rating", 2]},
                "_id":            0,
            }
        },
    ]
    return list(collection_worker.aggregate(pipeline))


# -----------------------------
# ⭐ Top Rated
# -----------------------------
def getTopRatedWorkers(limit: int = 8):
    workers = list(
        collection_worker.find(
            {
                "status":      {"$ne": "suspended"},
                "ratings":     {"$exists": True, "$ne": None, "$gt": 0},
                "reviewCount": {"$gte": 1},
            },
            {"password": 0},
        ).sort([("ratings", -1), ("reviewCount", -1)]).limit(limit)
    )
    return [_format_worker(w) for w in workers]


# -----------------------------
# 🚨 Emergency Services
# -----------------------------
def getEmergencyWorkers(limit: int = 8):
    workers = list(
        collection_worker.find(
            {
                "status":       {"$ne": "suspended"},
                "isAvailable":  True,
                "responseTime": {"$exists": True, "$ne": None, "$gt": 0},
            },
            {"password": 0},
        ).sort("responseTime", 1).limit(limit)
    )
    return [_format_worker(w) for w in workers]


# -----------------------------
# 🏠 All Home Data (combined)
# -----------------------------
def getHomeData(limit: int = 8):
    return {
        "popular_services": getPopularServices(limit),
        "top_rated":        getTopRatedWorkers(limit),
        "emergency":        getEmergencyWorkers(limit),
    }


# -----------------------------
# 🔧 Format helper
# -----------------------------
def _format_worker(w: dict) -> dict:
    return {
        "id":              w.get("email") or str(w["_id"]),
        "name":            f"{w.get('firstName', '')} {w.get('lastName', '')}".strip(),
        "service_type":    w.get("taskType", "").capitalize(),
        "rating":          w.get("ratings", None),
        "review_count":    w.get("reviewCount", 0),
        "completed_tasks": w.get("noOfCompletedTask", 0),
       
        "profile_pic":     w.get("profilePhoto", ""),
        "is_available":    w.get("isAvailable", False),
        "response_time":   w.get("responseTime", None),
        "face_verified":   w.get("face_verified", False),
        "skill_verified":  w.get("skill_verified", False),
        "description":     w.get("description", ""),
        "area": (
            w.get("serviceArea", {}).get("primaryCity")
            or w.get("serviceArea", {}).get("city")
            or w.get("serviceArea", {}).get("district")
            or "Nepal"
        ),
    }


# -----------------------------
# 💰 Price by task
# -----------------------------
def getPriceByTask(task: str, worker_id: str):
    worker = collection_worker.find_one(
        {
            "email":       worker_id,
            "skills.name": {"$regex": task.strip(), "$options": "i"},
        },
        {"firstName": 1, "lastName": 1, "skills": 1, "serviceArea.primaryCity": 1, "_id": 0},
    )
    if not worker:
        raise HTTPException(status_code=404, detail="Worker or task not found")

    target_skill = next(
        (s for s in worker["skills"] if s["name"].lower() == task.lower().strip()), None
    )
    return {
        "worker_name": f"{worker['firstName']} {worker['lastName']}",
        "city":        worker.get("serviceArea", {}).get("primaryCity"),
        "task_name":   target_skill["name"],
        "price":       target_skill["price"],
        "rating":      target_skill.get("ratings"),
    }


# ══════════════════════════════════════════════════════════════════════════════
# AVAILABILITY
# Hours are stored as arrays of {start, end} objects per day, e.g.:
#   "Monday": [{"start": "09:00", "end": "12:00"}, {"start": "14:00", "end": "17:00"}]
#   "Tuesday": []   ← means unavailable that day
# ══════════════════════════════════════════════════════════════════════════════

# -----------------------------
# 📅 Get availability
# -----------------------------
def getAvailability(worker_id: str) -> dict:
    w = collection_worker.find_one({"_id": worker_id}, {"password": 0})
    if not w:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {
        "worker_id":         worker_id,
        "isAvailable":       w.get("isAvailable", True),
        "hours":             w.get("hours", {}),
        "unavailable_dates": w.get("unavailable_dates", []),
        "updated_at":        w.get("availability_updated_at"),
    }


# -----------------------------
# 📅 Update full weekly hours
# -----------------------------
def updateWeeklyHours(worker_id: str, hours: dict) -> dict:
    """
    hours = {
        "Monday":    [{"start": "09:00", "end": "17:00"}],
        "Tuesday":   [],   <- empty = unavailable
        ...
    }
    """
    result = collection_worker.update_one(
        {"_id": worker_id},
        {"$set": {"hours": hours, "availability_updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {"message": "Weekly hours updated", "hours": hours}


# -----------------------------
# 📅 Update a single day
# -----------------------------
def updateDayHours(worker_id: str, day: str, slots: list) -> dict:
    """
    day   = "Monday"
    slots = [{"start": "09:00", "end": "17:00"}]  or [] to clear
    """
    VALID_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
    if day not in VALID_DAYS:
        raise HTTPException(status_code=400, detail=f"Invalid day '{day}'. Must be one of {VALID_DAYS}")

    result = collection_worker.update_one(
        {"_id": worker_id},
        {"$set": {
            f"hours.{day}":          slots,
            "availability_updated_at": datetime.utcnow(),
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {"message": f"{day} hours updated", "day": day, "slots": slots}


# -----------------------------
# 📅 Add unavailable dates
# -----------------------------
def addUnavailableDates(worker_id: str, dates: list[str]) -> dict:
    for d in dates:
        try:
            datetime.strptime(d, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid date format '{d}'. Use YYYY-MM-DD.")

    result = collection_worker.update_one(
        {"_id": worker_id},
        {
            "$addToSet": {"unavailable_dates": {"$each": dates}},
            "$set":      {"availability_updated_at": datetime.utcnow()},
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {"message": "Unavailable dates added", "dates_added": dates}


# -----------------------------
# 📅 Remove unavailable dates
# -----------------------------
def removeUnavailableDates(worker_id: str, dates: list[str]) -> dict:
    result = collection_worker.update_one(
        {"_id": worker_id},
        {
            "$pullAll": {"unavailable_dates": dates},
            "$set":     {"availability_updated_at": datetime.utcnow()},
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {"message": "Unavailable dates removed", "dates_removed": dates}


# -----------------------------
# 📅 Check availability on date
# -----------------------------
def checkAvailabilityOnDate(worker_id: str, check_date: str) -> dict:
    try:
        parsed = datetime.strptime(check_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    w = collection_worker.find_one({"_id": worker_id}, {"password": 0})
    if not w:
        raise HTTPException(status_code=404, detail="Worker not found")

    if not w.get("isAvailable", True):
        return {"worker_id": worker_id, "date": check_date, "available": False,
                "reason": "Worker is globally unavailable", "slots": None}

    if check_date in w.get("unavailable_dates", []):
        return {"worker_id": worker_id, "date": check_date, "available": False,
                "reason": "Worker marked this date as unavailable", "slots": None}

    day_name = parsed.strftime("%A")   # e.g. "Monday"
    slots    = w.get("hours", {}).get(day_name, [])

    if not slots:
        return {"worker_id": worker_id, "date": check_date, "available": False,
                "reason": f"Worker does not work on {day_name}s", "slots": None}

    return {"worker_id": worker_id, "date": check_date, "day": day_name,
            "available": True, "slots": slots}

def toggleWorkerAvailability(id: str, isAvailable: bool):
    result = collection_worker.update_one(
        {"_id": id},
        {"$set": {"isAvailable": isAvailable, "availability_updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {"message": f"Worker marked as {'available' if isAvailable else 'unavailable'}", "isAvailable": isAvailable}