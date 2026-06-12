from fastapi import APIRouter, Form, File, UploadFile, HTTPException, Query
from typing import List, Optional
from ..repository import taskRepo, workerRepo
import os
import json
import asyncio
import traceback
from datetime import datetime
from ..schemas.schemas import TaskResponse, TaskResponseUpdate, TaskOfferUpdate, StatusUpdate
from ..manager import websocket_manager
from ..config import database
from bson import ObjectId
from ..router import notifications
from ..config.database import collection_worker, db, worker_calendar
from pydantic import BaseModel
import cloudinary.uploader
from ..config.cloudinary_config import cloudinary  # This imports the configured cloudinary
import base64
from io import BytesIO
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(tags=["Task"])

# ── Status messages map ───────────────────────────────────────────────────────
STATUS_MESSAGES = {
    "accepted":    ("Task Accepted ✅",  "Your task '{name}' has been accepted by the worker."),
    "confirmed":   ("Task Confirmed 🎉", "Your task '{name}' is confirmed! Please make payment within 24 hours."),
    "in_progress": ("Work Started 🔧",   "The worker has started working on '{name}'."),
    "completed":   ("Task Completed ✅", "'{name}' has been completed. Please release payment."),
    "declined":    ("Task Declined ❌",  "Your task '{name}' was declined by the worker."),
    "cancelled":   ("Task Cancelled ❌", "Your task '{name}' has been cancelled."),
}
try:
    from ..router.recommend_router import linucb, TASK_CATEGORIES, build_feature_vector, refresh_global_theta, save_model
    print(f"[LINUCB IMPORT] ✅ loaded — arms={linucb.n_arms if linucb else 'None'}")
except Exception as e:
    print(f"[LINUCB IMPORT] ❌ {e}")
# ───────── TIME HELPERS ─────────

def _to_mins(t: str) -> int:
    h, m = t.strip().split(":")
    return int(h) * 60 + int(m)

def _to_str(mins: int) -> str:
    return f"{mins // 60:02d}:{mins % 60:02d}"


# ───────── RESOLVE WORKER ─────────

def resolve_worker(worker_id: str, collection_worker):
    worker = None
    try:
        worker = collection_worker.find_one({"_id": ObjectId(worker_id)})
    except Exception:
        pass
    if not worker:
        worker = collection_worker.find_one({"email": worker_id})
    return worker


# ───────── GET GENERAL SLOTS ─────────

from datetime import timezone

def get_general_slots(worker: dict, date: str) -> list[dict]:
    try:
        date_dt = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format (YYYY-MM-DD)")

    resolved_id = str(worker["_id"])

    day_start = date_dt.replace(tzinfo=timezone.utc)
    day_end   = day_start.replace(hour=23, minute=59, second=59)

    avail_doc = db.worker_calendar.find_one({
        "workerId": resolved_id,
        "date": {"$gte": day_start, "$lte": day_end},
        "available": True,
        "slots": {"$exists": True},
    })

    if avail_doc and avail_doc.get("slots"):
        return [
            {"start": s["start"], "end": s["end"]}
            for s in avail_doc["slots"]
            if isinstance(s, dict)
            and isinstance(s.get("start"), str) and ":" in s["start"]
            and isinstance(s.get("end"),   str) and ":" in s["end"]
        ]

    day_cap    = date_dt.strftime("%A")
    day_low    = day_cap.lower()
    hours_dict = worker.get("hours") or worker.get("availability", {}).get("hours", {})
    weekly     = hours_dict.get(day_cap) or hours_dict.get(day_low) or []

    slots = []
    for s in weekly:
        if isinstance(s, dict) and s.get("start") and s.get("end"):
            slots.append({"start": s["start"], "end": s["end"]})
        elif isinstance(s, str) and "-" in s:
            start, end = s.split("-")
            slots.append({"start": start.strip(), "end": end.strip()})
    return slots


# ───────── GET BOOKED SLOTS FROM CALENDAR ─────────

def get_booked_slots_from_calendar(worker: dict, date: str, db):
    resolved_id = str(worker["_id"])
    email = worker.get("email")

    calendar_docs = list(db.worker_calendar.find({
        "workerId": {"$in": [resolved_id, email]},
        "status": {"$in": ["confirmed", "pending", "accepted", "in_progress"]}
    }))

    booked = []

    for entry in calendar_docs:
        entry_date = str(entry.get("date")).split(" ")[0]

        if entry_date != date:
            continue

        slot = entry.get("slot")
        if not slot:
            continue

        booked.append({
            "start": slot["start"],
            "end": slot["end"]
        })

    return booked


# ───────── SUBTRACT LOGIC ─────────

def get_free_slots(general_slots, booked_slots, min_duration=15):
    free = [
        {"start": _to_mins(s["start"]), "end": _to_mins(s["end"])}
        for s in general_slots
    ]

    for b in booked_slots:
        b_start = _to_mins(b["start"])
        b_end = _to_mins(b["end"])

        remaining = []

        for seg in free:
            if b_end <= seg["start"] or b_start >= seg["end"]:
                remaining.append(seg)
            else:
                if seg["start"] < b_start:
                    remaining.append({"start": seg["start"], "end": b_start})
                if seg["end"] > b_end:
                    remaining.append({"start": b_end, "end": seg["end"]})

        free = remaining

    return [
        {"start": _to_str(s["start"]), "end": _to_str(s["end"])}
        for s in free
        if s["end"] - s["start"] >= min_duration
    ]


# ───────── FINAL API ─────────

@router.get("/worker/free-slots/{workerId}/{date}")
def get_worker_free_slots(workerId: str, date: str):
    worker = resolve_worker(workerId, collection_worker)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    general = get_general_slots(worker, date)
    booked = get_booked_slots_from_calendar(worker, date, db)
    free = get_free_slots(general, booked)

    return {
        "workerId": str(worker["_id"]),
        "date": date,
        "generalSlots": general,
        "bookedSlots": booked,
        "freeSlots": free
    }


from datetime import datetime, timedelta

@router.get("/worker/free-slots-range/{workerId}")
def get_worker_free_slots_range(
    workerId: str,
    start_date: str = Query(...),
    end_date: str = Query(...)
):
    worker = resolve_worker(workerId, collection_worker)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    try:
        current = datetime.strptime(start_date, "%Y-%m-%d")
        end     = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    result = {}

    while current <= end:
        date_str = current.strftime("%Y-%m-%d")

        general = get_general_slots(worker, date_str)
        booked  = get_booked_slots_from_calendar(worker, date_str, db)
        free    = get_free_slots(general, booked)

        result[date_str] = free
        current += timedelta(days=1)

    return {
        "workerId": str(worker["_id"]),
        "range": {
            "start": start_date,
            "end": end_date
        },
        "freeSlots": result
    }


# ── Payment reminder (fires 23h after confirmation) ───────────────────────────
async def _payment_reminder(task_id: str, userId: str, taskName: str, customer: dict):
    await asyncio.sleep(23 * 60 * 60)

    task, _ = taskRepo.get_task_with_customer(task_id)
    if not task:
        return
    if task.get("paymentStatus") == "paid" or task.get("status") != "confirmed":
        return

    title = "⏰ Payment Reminder"
    body  = f"1 hour left to pay for '{taskName}' before it gets auto-cancelled!"

    await notifications.notify_with_fallback(
        userId=userId, title=title, body=body,
        token=customer.get("fcmToken"), email=customer.get("email"), is_worker=False,
    )
    await websocket_manager.manager.send_to_user(userId, json.dumps({
        "type": "task_status", "taskId": task_id,
        "status": "payment_reminder", "taskName": taskName,
    }))


# ───────── LINUCB HELPER ─────────

def _linucb_update(worker: dict, task_type: str, reward: float, label: str):
    """Fire-and-forget LinUCB update. Never raises — always safe to call."""
    try:
        from ..router.recommend_router import (
            linucb, TASK_CATEGORIES, CATEGORY_ALIAS, build_feature_vector,
            refresh_global_theta, save_model,
        )
        normalized = CATEGORY_ALIAS.get(task_type.lower().strip(), task_type)
        print(f"[LINUCB] '{task_type}' → '{normalized}' | match={normalized in TASK_CATEGORIES}")
        if linucb and normalized in TASK_CATEGORIES:
            arm  = TASK_CATEGORIES.index(normalized)
            x, _ = build_feature_vector(worker, normalized)
            linucb.update(arm, x, reward)
            refresh_global_theta()
            save_model()
            print(f"✅ LinUCB updated [{label}] — arm={arm} reward={reward}")
        else:
            print(f"[LINUCB] ⚠️ Skipped — normalized='{normalized}' not in TASK_CATEGORIES")
    except Exception as e:
        print(f"⚠️ LinUCB update failed [{label}]: {e}")
        import traceback; traceback.print_exc()


def _resolve_worker_dict(worker_id: str) -> dict | None:
    """Try ObjectId first, fall back to email lookup."""
    worker = None
    try:
        worker = collection_worker.find_one({"_id": ObjectId(worker_id)})
    except Exception:
        pass
    if not worker:
        worker = collection_worker.find_one({"email": worker_id})
    return worker


 
@router.post("/task")
async def create_task(
    taskName:        str                        = Form(...),
    taskType:        str                        = Form(...),
    taskDescrip:     str                        = Form(...),
    selectedService: Optional[str]              = Form(None),
    address:         Optional[str]              = Form(None),
    lat:             Optional[str]              = Form(None),
    lng:             Optional[str]              = Form(None),
    userId:          str                        = Form(...),
    taskImg:         Optional[List[UploadFile]] = File(default=None),
    status:          str                        = Form("pending"),
    assignedWorker:  str                        = Form(...),
    serviceDate:     datetime                   = Form(...),
    note:            str                        = Form(...),
    serviceTime:     str                        = Form(...),
):
    # ── Upload images to Cloudinary ───────────────────────────────────────────
    uploaded_image_urls: list[str] = []
    if taskImg:
        for idx, file in enumerate(taskImg):
            try:
                contents = await file.read()
                if not contents:
                    continue
                result = cloudinary.uploader.upload(
                    contents,
                    folder=f"tasks/{taskName}_{userId}",
                    public_id=f"task_{int(datetime.now().timestamp())}_{idx}",
                    resource_type="auto",
                )
                url = (result or {}).get("secure_url")
                if url:
                    uploaded_image_urls.append(url)
                    print(f"[CLOUDINARY] Uploaded file {idx} → {url}")
                else:
                    print(f"[CLOUDINARY] No URL returned for file {idx}")
            except Exception as e:
                print(f"[CLOUDINARY] Error on file {idx}: {e}")
                traceback.print_exc()
 
    print(f"[CREATE_TASK] uploaded_image_urls = {uploaded_image_urls}")
 
    # ── Validate worker ───────────────────────────────────────────────────────
    worker = workerRepo.showWorkerByID(assignedWorker)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
 
    # ── Resolve base price ────────────────────────────────────────────────────
    best_prices:   list[float] = []
    selected_name              = (selectedService or taskType or "").strip().lower()
    base_price:    float | None = None
    
    for skill in getattr(worker, "skills", []) or []:
        if isinstance(skill, dict):
            price = skill.get("price") or skill.get("basePrice")
            name  = (skill.get("name") or "").strip().lower()
        else:
            price = getattr(skill, "price", None) or getattr(skill, "basePrice", None)
            name  = (getattr(skill, "name", "") or "").strip().lower()
        try:
            price = float(price) if price is not None else None
        except (TypeError, ValueError):
            price = None
 
        if price is not None:
            best_prices.append(price)
            if selected_name and name == selected_name:
                base_price = price
                break
 
    if base_price is None:
        if best_prices:
            base_price = min(best_prices)
        else:
            try:
                price_data = workerRepo.getPriceByTask(taskType, assignedWorker)
                base_price = float(price_data.get("price", 0) if price_data else 0)
            except Exception:
                base_price = 0.0
 
    # ── Build task document ───────────────────────────────────────────────────
    task_doc = {
        "taskName":         taskName,
        "taskType":         taskType,
        "taskDescrip":      taskDescrip,
        "selectedService":  selectedService or "",
        "address":          address or "",
        "lat":              lat or "",
        "lng":              lng or "",
        "userId":           userId,
        "taskImg":          uploaded_image_urls,   # always a list, never None
        "status":           status.lower(),
        "assignedWorkerId": assignedWorker,
        "serviceDate":      serviceDate,
        "note":             note,
        "serviceTime":      serviceTime,
        "basePrice":        base_price,
        "report_id":        None,
        "refund_id":        None,
    }
 
    task_id = await taskRepo.insert_task(task_doc)

    if serviceDate and serviceTime:
        start_dt = datetime.combine(serviceDate.date(), datetime.strptime(serviceTime, "%H:%M").time())
        end_dt = start_dt + timedelta(hours=2)
        slot_entry = {
            "workerId": assignedWorker,
            "date": serviceDate,
            "slot": {"start": start_dt.strftime("%H:%M"), "end": end_dt.strftime("%H:%M")},
            "status": status.lower(),
            "taskId": str(task_id)
        }
        db.worker_calendar.insert_one(slot_entry)

    # ── LinUCB: booking signal ────────────────────────────────────────────────
    worker_dict = _resolve_worker_dict(assignedWorker)
    if worker_dict:
        _linucb_update(worker_dict, taskType, reward=0.6, label="booking")

    task_notification = json.dumps({
        "type":        "new_task",
        "taskId":      str(task_id),
        "taskType":    taskType,
        "address":     address,
        "serviceDate": serviceDate.isoformat(),
        "status":      "pending",
        "userId":      userId,
        "note":        note,
        "serviceTime": serviceTime,
    })
    await websocket_manager.manager.send_to_user(assignedWorker, task_notification)
    print(f"[DEBUG] taskType from form = '{taskType}'")
    worker_dict = _resolve_worker_dict(assignedWorker)
    print(f"[DEBUG] worker_dict found = {worker_dict is not None}")
    if worker_dict:
        _linucb_update(worker_dict, taskType, reward=0.6, label="booking")
    return {
        "message":   "Task created successfully",
        "taskId":    task_id,
        "basePrice": base_price,
    }


# ── Get all tasks for a user ──────────────────────────────────────────────────
@router.get("/tasks/user/{user_id}")
async def get_tasks_by_user(user_id: str):
    tasks = taskRepo.get_tasks_by_user(user_id)
    return {"tasks": tasks}


@router.get("/notifications")
async def get_notifications(userId: str):
    notifs = taskRepo.get_user_notifications(userId)
    return {"notifications": notifs}


@router.post("/tasks/{task_id}/assign/{worker_id}")
async def assign_worker(task_id: str, worker_id: str):
    success = taskRepo.assign_worker(task_id, worker_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to assign worker")
    return {"message": "Worker assigned successfully"}


@router.get("/tasks/worker/{worker_id}")
async def getTaskByWorkerId(worker_id: str):
    tasks = taskRepo.get_tasks_by_worker(worker_id)
    return {"tasks": tasks}


@router.get("/task/{task_id}")
async def get_task_by_id(task_id: str):
    task = taskRepo.get_task_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/tasks/between/{user1}/{user2}")
def get_tasks_between(user1: str, user2: str):
    tasks = taskRepo.get_tasks_by_worker_and_customer(user1, user2)
    if not tasks:
        tasks = taskRepo.get_tasks_by_worker_and_customer(user2, user1)
    return tasks


@router.get("/tasks/all")
async def get_all_tasks():
    tasks = taskRepo.get_all_tasks()
    return {"tasks": tasks}


@router.patch("/tasks/{task_id}/offer")
async def update_task_offer(task_id: str, offer: TaskOfferUpdate):
    success = taskRepo.update_task_offer(task_id, offer)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update task offer")
    return {"message": "Task offer updated successfully"}


@router.get("/tasks/count")
async def count_tasks_by_customer():
    count = taskRepo.no_of_task_assigned_by_each_customer()
    return {"task_counts": count}


@router.patch("/tasks/auto-cancel-expired")
async def auto_cancel_expired():
    count = taskRepo.auto_cancel_expired_pending_tasks()
    return {"cancelled_count": count}


@router.patch("/tasks/auto-cancel-confirmed-unpaid")
async def auto_cancel_confirmed_unpaid():
    count = taskRepo.auto_cancel_confirmed_unpaid_tasks()
    return {"cancelled_count": count}


# ── Update task status ────────────────────────────────────────────────────────
@router.patch("/task/{task_id}/status")
async def update_task_status(task_id: str, status_update: StatusUpdate):
    try:
        result = taskRepo.updateTaskStatus(task_id, status_update.status)
        status = status_update.status

        task, customer = taskRepo.get_task_with_customer(task_id)
        print(f"[STATUS] task found    : {task is not None}")
        print(f"[STATUS] customer found: {customer is not None}")
        print(f"[STATUS] status        : {status}")

        if task and customer:
            userId   = str(task.get("userId", ""))
            taskName = task.get("taskName", "your task")

            if status in STATUS_MESSAGES:
                title, body_tpl = STATUS_MESSAGES[status]
                try:
                    await notifications.notify_with_fallback(
                        userId=userId,
                        title=title,
                        body=body_tpl.format(name=taskName),
                        token=customer.get("fcmToken"),
                        email=customer.get("email"),
                        is_worker=False,
                        data={
                            "event_type": status,
                            "task_id":    task_id,
                            "taskName":   taskName,
                        },
                    )
                    print(f"[STATUS] ✅ Notification sent for status={status}")
                except Exception as e:
                    print(f"[STATUS] ❌ Notification failed: {e}")
                    traceback.print_exc()

            try:
                await websocket_manager.manager.send_to_user(userId, json.dumps({
                    "type":     "task_status",
                    "taskId":   task_id,
                    "status":   status,
                    "taskName": taskName,
                }))
            except Exception as e:
                print(f"[STATUS] WebSocket send failed: {e}")

            if status == "confirmed":
                asyncio.create_task(
                    _payment_reminder(task_id, userId, taskName, customer)
                )

            # ── LinUCB: completed signal ──────────────────────────────────────
            if status == "completed":
                worker_id = task.get("assignedWorkerId")
                task_type = task.get("taskType")
                if worker_id and task_type:
                    worker_dict = _resolve_worker_dict(str(worker_id))
                    if worker_dict:
                        _linucb_update(worker_dict, task_type, reward=0.7, label="completed")

        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def get_task_datetime(task: dict) -> datetime | None:
    try:
        service_date = task.get("serviceDate")
        service_time = task.get("serviceTime", "00:00")

        if not service_date:
            return None

        if isinstance(service_date, datetime):
            date_part = service_date.date()
        else:
            date_part = datetime.fromisoformat(str(service_date).split("T")[0]).date()

        try:
            time_part = datetime.strptime(service_time, "%H:%M").time()
        except ValueError:
            try:
                time_part = datetime.strptime(service_time, "%I:%M %p").time()
            except ValueError:
                time_part = datetime.min.time()

        return datetime.combine(date_part, time_part)

    except Exception as e:
        print(f"[get_task_datetime] Failed to parse datetime: {e}")
        return None


# ─────────────────────────────────────────────
# REFUND CALCULATION
# ─────────────────────────────────────────────
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId
import json
import traceback

from ..config import database
from ..repository import taskRepo
from ..manager import websocket_manager
from ..router import notifications


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _get_task_datetime(task: dict) -> datetime | None:
    try:
        service_date = task.get("serviceDate")
        if not service_date:
            return None

        if isinstance(service_date, datetime):
            return service_date.replace(tzinfo=None)

        service_date_str = str(service_date).strip()

        if "T" in service_date_str:
            clean = service_date_str.replace("Z", "+00:00")
            try:
                dt = datetime.fromisoformat(clean)
                return dt.replace(tzinfo=None)
            except ValueError:
                clean = service_date_str[:26]
                return datetime.fromisoformat(clean)

        service_time = task.get("serviceTime", "00:00") or "00:00"
        date_part = datetime.fromisoformat(service_date_str).date()
        try:
            time_part = datetime.strptime(service_time, "%H:%M").time()
        except ValueError:
            time_part = datetime.strptime(service_time, "%I:%M %p").time()

        return datetime.combine(date_part, time_part)

    except Exception as e:
        print(f"[_get_task_datetime] Failed to parse '{task.get('serviceDate')}': {e}")
        return None


def _restore_worker_slot(task: dict):
    worker_id    = task.get("assignedWorkerId")
    service_time = task.get("serviceTime")
    service_date = task.get("serviceDate")

    if not (worker_id and service_time and service_date):
        return

    try:
        day_name        = taskRepo._get_day_name(service_date)
        estimated_hours = task.get("estimatedHours")
        offer_accepted  = task.get("offerStatus") == "accepted"

        blocked_end = (
            taskRepo._add_hours(service_time, estimated_hours)
            if (offer_accepted and estimated_hours)
            else taskRepo._add_hours(service_time, 2)
        )

        worker_doc = taskRepo._get_worker_by_id(str(worker_id))
        if worker_doc:
            current_slots = taskRepo._get_day_slots(worker_doc, day_name)
            restored      = taskRepo._restore_slot(current_slots, service_time, blocked_end)
            taskRepo._save_day_slots(str(worker_id), day_name, restored)
            print(f"[SLOT] Restored on {day_name}: {service_time} → {blocked_end}")
        else:
            print(f"[SLOT] Worker not found — skipping slot restore")

    except Exception as e:
        print(f"[SLOT] Restore failed (non-critical): {e}")
        traceback.print_exc()


# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────

WORKER_FLAG_THRESHOLD = 3

WORKER_REPEAT_SURCHARGE = [0.00, 0.05, 0.10, 0.15]


# ─────────────────────────────────────────────────────────────────────────────
# REQUEST BODY
# ─────────────────────────────────────────────────────────────────────────────

class CancelRequest(BaseModel):
    cancelled_by: str   # "customer" | "tasker"
    reason: str


# ─────────────────────────────────────────────────────────────────────────────
# WORKER CANCELLATION COUNTER
# ─────────────────────────────────────────────────────────────────────────────

def _increment_worker_cancellation_count(worker_id: str) -> int:
    filter_q = {"email": worker_id}
    try:
        filter_q = {"_id": ObjectId(worker_id)}
    except Exception:
        pass

    result = database.collection_worker.find_one_and_update(
        filter_q,
        {
            "$inc": {"cancellationCount": 1},
            "$set": {"cancellationUpdatedAt": datetime.utcnow()},
        },
        return_document=True,
        upsert=False,
    )

    new_count = int((result or {}).get("cancellationCount", 1))
    print(f"[CANCEL] Worker {worker_id} cancellation count → {new_count}")

    if new_count >= WORKER_FLAG_THRESHOLD:
        database.collection_worker.update_one(
            filter_q,
            {
                "$set": {
                    "isFlagged":   True,
                    "flagReason":  f"Exceeded {WORKER_FLAG_THRESHOLD} cancellations",
                    "flaggedAt":   datetime.utcnow(),
                }
            },
        )
        print(f"[CANCEL] ⚠️  Worker {worker_id} flagged after {new_count} cancellations")

    return new_count


# ─────────────────────────────────────────────────────────────────────────────
# REFUND CALCULATION
# ─────────────────────────────────────────────────────────────────────────────

def calculate_refund(
    cancelled_by:        str,
    escrow_status:       str,
    task_status:         str,
    hours_before_start:  float,
    total_cost:          float,
    worker_cancel_count: int = 0,
) -> dict:
    if escrow_status == "released":
        return {
            "refund_status":  "declined",
            "refund_amount":  0.0,
            "penalty_amount": 0.0,
            "surcharge_pct":  0.0,
            "reason":         "Escrow already released — refund not possible.",
        }

    if task_status == "in_progress":
        return {
            "refund_status":  "dispute",
            "refund_amount":  0.0,
            "penalty_amount": 0.0,
            "surcharge_pct":  0.0,
            "reason":         "Task is in progress — dispute opened for admin review.",
        }

    if cancelled_by == "tasker":
        surcharge_idx = min(worker_cancel_count, len(WORKER_REPEAT_SURCHARGE) - 1)
        surcharge_pct = WORKER_REPEAT_SURCHARGE[surcharge_idx]

        return {
            "refund_status":  "pending",
            "refund_amount":  total_cost,
            "penalty_amount": round(total_cost * surcharge_pct, 2),
            "surcharge_pct":  surcharge_pct,
            "reason": (
                f"Tasker cancelled — full refund issued to customer."
                + (
                    f" Additional {int(surcharge_pct*100)}% platform surcharge "
                    f"(NPR {round(total_cost * surcharge_pct, 2)}) applied due to "
                    f"repeat cancellations ({worker_cancel_count} previous)."
                    if surcharge_pct > 0
                    else ""
                )
            ),
        }

    if cancelled_by == "customer":
        if hours_before_start >= 4:
            return {
                "refund_status":  "dispute",
                "refund_amount":  total_cost,
                "penalty_amount": 0.0,
                "surcharge_pct":  0.0,
                "reason":         "Cancelled with ≥4 hours notice — full refund issued.",
            }
        else:
            penalty = round(total_cost * 0.25, 2)
            refund  = round(total_cost * 0.75, 2)
            return {
                "refund_status":  "dispute",
                "refund_amount":  refund,
                "penalty_amount": penalty,
                "surcharge_pct":  0.0,
                "reason": (
                    f"Cancelled within 4 hours of start — "
                    f"75 % refund (NPR {refund}) issued; "
                    f"25 % penalty (NPR {penalty}) retained by worker."
                ),
            }

    return {
        "refund_status":  "dispute",
        "refund_amount":  0.0,
        "penalty_amount": 0.0,
        "surcharge_pct":  0.0,
        "reason":         "Unable to determine cancellation terms — dispute opened.",
    }


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN REVIEW QUEUE
# ─────────────────────────────────────────────────────────────────────────────

def _create_cancellation_review_entry(
    task:          dict,
    task_id:       str,
    cancelled_by:  str,
    reason:        str,
    refund:        dict,
    total_cost:    float,
    now:           datetime,
) -> str | None:
    try:
        embedded = {
            "cancellationReview": {
                "cancelledBy":      cancelled_by,
                "cancelReason":     reason,
                "cancelledAt":      now,
                "totalCost":        total_cost,
                "refundStatus":     refund["refund_status"],
                "refundAmount":     refund["refund_amount"],
                "penaltyAmount":    refund["penalty_amount"],
                "surchargeApplied": refund.get("surcharge_pct", 0) > 0,
                "surchargePct":     refund.get("surcharge_pct", 0),
                "reviewStatus":     "pending" if refund["refund_status"] == "dispute" else "reviewed",
                "isDispute":        refund["refund_status"] == "dispute",
                "hasSurcharge":     refund.get("surcharge_pct", 0) > 0,
                "adminNote":        None,
                "reviewedBy":       None,
                "reviewedAt":       None,
            }
        }
        database.collection_task.update_one(
            {"_id": ObjectId(task_id)},
            {"$set": embedded},
        )
        print(f"[CANCEL_REVIEW] Embedded cancellationReview into task {task_id}")
        return task_id

    except Exception as e:
        print(f"[CANCEL_REVIEW] Failed to embed review (non-critical): {e}")
        traceback.print_exc()
        return None

# ─────────────────────────────────────────────────────────────────────────────
# ADMIN ENDPOINTS — Cancelled Tasks Review Queue
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/admin/cancelled-tasks")
async def get_cancelled_tasks_for_review(
    review_status: str = "pending",
    cancelled_by:  str = "all",
    skip:          int = 0,
    limit:         int = 50,
):
    query: dict = {}

    if review_status != "all":
        query["reviewStatus"] = review_status
    if cancelled_by != "all":
        query["cancelledBy"] = cancelled_by

    total  = database.db["cancelled_tasks"].count_documents(query)
    cursor = (
        database.db["cancelled_tasks"]
        .find(query)
        .sort("cancelledAt", -1)
        .skip(skip)
        .limit(limit)
    )

    items = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        items.append(doc)

    return {"total": total, "items": items}


@router.patch("/admin/cancelled-tasks/{review_id}/resolve")
async def resolve_cancelled_task_review(
    review_id:  str,
    admin_note: str,
    resolution: str,
    admin_id:   str,
):
    try:
        obj_id = ObjectId(review_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid review ID")

    result = database.db["cancelled_tasks"].update_one(
        {"_id": obj_id},
        {
            "$set": {
                "reviewStatus": "resolved",
                "resolution":   resolution,
                "adminNote":    admin_note,
                "reviewedBy":   admin_id,
                "reviewedAt":   datetime.utcnow(),
            }
        },
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Review entry not found or already resolved")

    return {"message": "Review resolved", "reviewId": review_id, "resolution": resolution}


@router.get("/admin/worker/{worker_id}/cancellation-stats")
async def get_worker_cancellation_stats(worker_id: str):
    filter_q = {"cancelledBy": "tasker", "workerId": worker_id}
    total_worker_cancels = database.db["cancelled_tasks"].count_documents(filter_q)

    worker_doc = None
    try:
        worker_doc = database.collection_worker.find_one({"_id": ObjectId(worker_id)})
    except Exception:
        worker_doc = database.collection_worker.find_one({"email": worker_id})

    if not worker_doc:
        raise HTTPException(status_code=404, detail="Worker not found")

    return {
        "workerId":            worker_id,
        "cancellationCount":   int(worker_doc.get("cancellationCount", 0)),
        "isFlagged":           worker_doc.get("isFlagged", False),
        "flagReason":          worker_doc.get("flagReason"),
        "flaggedAt":           worker_doc.get("flaggedAt"),
        "reviewQueueEntries":  total_worker_cancels,
        "surchargeThresholds": WORKER_REPEAT_SURCHARGE,
        "flagThreshold":       WORKER_FLAG_THRESHOLD,
    }

@router.post("/task/{task_id}/decline")
def decline_task_route(task_id: str, body: dict):
    reason = body.get("reason", "")
    success = taskRepo.decline_task(task_id, reason)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return { "message": "Task declined", "task_id": task_id }

# ─────────────────────────────────────────────────────────────────────────────
# MAIN CANCEL ENDPOINT
# ─────────────────────────────────────────────────────────────────────────────
@router.patch("/task/{task_id}/cancel-unpaid")
async def cancel_unpaid_task(task_id: str, body: CancelRequest):
    task = taskRepo.get_task_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.get("paymentStatus") == "paid":
        raise HTTPException(status_code=400, detail="Cannot auto-cancel a paid task")

    return await cancel_task(task_id, body)

@router.patch("/task/{task_id}/cancel")
async def cancel_task(task_id: str, body: CancelRequest):

    # ── 1. Validate task_id ───────────────────────────────────────────────────
    try:
        obj_id = ObjectId(task_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID")

    # ── 2. Fetch task ─────────────────────────────────────────────────────────
    task = database.collection_task.find_one({"_id": obj_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # ── 3. Guard: already in a terminal state ─────────────────────────────────
    task_status = task.get("status", "")
    if task_status == "completed":
        raise HTTPException(status_code=400, detail="Cannot cancel a completed task")
    if task_status == "cancelled":
        raise HTTPException(status_code=400, detail="Task is already cancelled")

    # ── 4. Gather inputs ──────────────────────────────────────────────────────
    now           = datetime.utcnow()
    escrow_status = task.get("escrow_status", "pending")
    total_cost    = float(task.get("totalCost") or 0)
    worker_id     = task.get("assignedWorkerId")
    task_type     = task.get("taskType")

    # ── 4a. EASY CANCELLATION PATH for pending escrow ────────────────────────
    if escrow_status == "pending":
        update_fields = {
            "status":        "cancelled",
            "cancelledBy":   body.cancelled_by,
            "cancelledAt":   now,
            "cancelReason":  body.reason,
            "refundStatus":  "not_applicable",
            "refundAmount":  0.0,
            "penaltyAmount": 0.0,
            "surchargePct":  0.0,
        }
        
        database.collection_task.update_one({"_id": obj_id}, {"$set": update_fields})
        
        # Restore worker slot
        _restore_worker_slot(task)

        # ── LinUCB: cancellation signal (pending/unpaid) ──────────────────────
        if worker_id and task_type:
            worker_dict = _resolve_worker_dict(str(worker_id))
            if worker_dict:
                reward = 0.1 if body.cancelled_by == "tasker" else 0.3
                _linucb_update(worker_dict, task_type, reward=reward, label=f"cancelled-pending-by-{body.cancelled_by}")
        
        # Notify customer
        _, customer = taskRepo.get_task_with_customer(task_id)
        task_name   = task.get("taskName", "your task")
        user_id     = str(task.get("userId", ""))
        
        if customer:
            await notifications.notify_with_fallback(
                userId    = user_id,
                title     = "Task Cancelled ❌",
                body      = f"Your task '{task_name}' has been cancelled. No payment was processed.",
                token     = customer.get("fcmToken"),
                email     = customer.get("email"),
                is_worker = False,
            )
            
            try:
                await websocket_manager.manager.send_to_user(user_id, json.dumps({
                    "type":         "task_status",
                    "taskId":       task_id,
                    "status":       "cancelled",
                    "taskName":     task_name,
                    "refundStatus": "not_applicable",
                    "refundAmount": 0.0,
                }))
            except Exception as e:
                print(f"[CANCEL] Customer WebSocket failed: {e}")
        
        # Notify worker
        if worker_id:
            worker_doc = taskRepo._get_worker_by_id(str(worker_id))
            if worker_doc:
                await notifications.notify_with_fallback(
                    userId    = str(worker_id),
                    title     = "Task Cancelled ❌",
                    body      = f"Task '{task_name}' has been cancelled. No payment was involved.",
                    token     = worker_doc.get("fcmToken"),
                    email     = worker_doc.get("email"),
                    is_worker = True,
                )
                
                try:
                    await websocket_manager.manager.send_to_user(str(worker_id), json.dumps({
                        "type":     "task_status",
                        "taskId":   task_id,
                        "status":   "cancelled",
                        "taskName": task_name,
                    }))
                except Exception as e:
                    print(f"[CANCEL] Worker WebSocket failed: {e}")
        
        return {
            "message":        "Task cancelled successfully (no payment processed)",
            "cancelledBy":    body.cancelled_by,
            "refundStatus":   "not_applicable",
            "refundAmount":   0.0,
            "penaltyAmount":  0.0,
            "surchargePct":   0.0,
            "reason":         "Payment was not yet processed",
            "dispute":        False,
        }

    # ── 4b. Continue with normal cancellation flow for paid/escrowed tasks ───
    task_datetime = _get_task_datetime(task)
    if task_datetime:
        hours_before_start = (task_datetime - now).total_seconds() / 3600
    else:
        print(f"[CANCEL] serviceDate missing for {task_id} — defaulting hours_before_start=999")
        hours_before_start = 999.0

    # ── 5. Worker cancellation counter ───────────────────────────────────────
    worker_prev_cancel_count = 0

    if body.cancelled_by == "tasker" and worker_id:
        filter_q = {"email": worker_id}
        try:
            filter_q = {"_id": ObjectId(worker_id)}
        except Exception:
            pass
        worker_doc_pre = database.collection_worker.find_one(filter_q, {"cancellationCount": 1})
        worker_prev_cancel_count = int((worker_doc_pre or {}).get("cancellationCount", 0))
        _increment_worker_cancellation_count(str(worker_id))

    # ── 6. Calculate refund ───────────────────────────────────────────────────
    refund = calculate_refund(
        cancelled_by        = body.cancelled_by,
        escrow_status       = escrow_status,
        task_status         = task_status,
        hours_before_start  = hours_before_start,
        total_cost          = total_cost,
        worker_cancel_count = worker_prev_cancel_count,
    )

    refund_status  = refund["refund_status"]
    refund_amount  = refund["refund_amount"]
    penalty_amount = refund["penalty_amount"]
    surcharge_pct  = refund.get("surcharge_pct", 0.0)
    refund_reason  = refund["reason"]

    # ── 7. Persist cancellation fields on the task ────────────────────────────
    update_fields = {
        "status":             "cancelled",
        "cancelledBy":        body.cancelled_by,
        "cancelledAt":        now,
        "cancelReason":       body.reason,
        "refundStatus":       refund_status,
        "refundAmount":       refund_amount,
        "penaltyAmount":      penalty_amount,
        "refundUpdatedAt":    now,
        "workerCancelCountAtTime": worker_prev_cancel_count + (
            1 if body.cancelled_by == "tasker" else 0
        ),
    }

    if refund_status == "dispute":
        update_fields["disputeStatus"]   = "open"
        update_fields["disputeOpenedAt"] = now

    result = database.collection_task.update_one({"_id": obj_id}, {"$set": update_fields})
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Failed to update task — no changes made")

    # ── 8. Insert into cancelled_tasks admin review queue ─────────────────────
    review_id = _create_cancellation_review_entry(
        task         = task,
        task_id      = task_id,
        cancelled_by = body.cancelled_by,
        reason       = body.reason,
        refund       = refund,
        total_cost   = total_cost,
        now          = now,
    )

    # ── 9. Credit penalty / surcharge ────────────────────────────────────────
    if penalty_amount > 0 and worker_id:
        filter_q = {"email": worker_id}
        try:
            filter_q = {"_id": ObjectId(worker_id)}
        except Exception:
            pass

        if body.cancelled_by == "customer":
            database.collection_worker.update_one(filter_q, {"$inc": {"earnings": penalty_amount}})
        else:
            if surcharge_pct > 0:
                surcharge_amount = round(total_cost * surcharge_pct, 2)
                database.collection_worker.update_one(
                    filter_q,
                    {"$inc": {"earnings": -surcharge_amount}}
                )
                print(f"[CANCEL] Deducted NPR {surcharge_amount} from worker {worker_id} (surcharge)")

    # ── 10. Restore worker calendar slot ──────────────────────────────────────
    if refund_status != "dispute":
        _restore_worker_slot(task)

    # ── 11. Auto-create report + store only report_id on the task ────────────
    payment_status = task.get("payment_status") or task.get("escrow_status") or ""
    was_paid       = payment_status in ("paid", "released", "escrowed", "held")
    report_id      = None
    id_refs: dict  = {}

    if was_paid and total_cost > 0:
        try:
            if refund_status == "dispute":
                report_reason = "mid_task_cancellation_dispute"
            elif surcharge_pct > 0:
                report_reason = "cancellation_with_surcharge"
            elif penalty_amount > 0:
                report_reason = "cancellation_with_penalty"
            else:
                report_reason = "cancellation_with_refund"

            user_id   = str(task.get("userId", ""))
            task_name = task.get("taskName", "your task")

            report_doc = {
                "reporterId":     user_id,
                "reporterType":   "customer",
                "reportedId":     str(worker_id) if worker_id else "",
                "reportedType":   "worker",
                "reason":         report_reason,
                "description": (
                    f"Task '{task_name}' (ID: {task_id}) cancelled by {body.cancelled_by}. "
                    f"Total: NPR {total_cost:.2f}. "
                    f"Refund: NPR {refund_amount:.2f}. "
                    f"Penalty: NPR {penalty_amount:.2f}. "
                    f"Surcharge: {int(surcharge_pct * 100)}%. "
                    f"Refund status: {refund_status}. "
                    f"Reason: {body.reason}"
                ),
                "evidenceUrl":    None,
                "status":         "pending" if refund_status == "dispute" else "resolved",
                "createdAt":      now,
                "resolvedAt":     now if refund_status != "dispute" else None,
                "adminNote":      refund_reason,
                "taskId":         task_id,
                "taskName":       task_name,
                "cancelledBy":    body.cancelled_by,
                "refundStatus":   refund_status,
                "refundAmount":   refund_amount,
                "penaltyAmount":  penalty_amount,
                "surchargePct":   surcharge_pct,
                "totalCost":      total_cost,
                "type":           "cancellation",
                "cancelReviewId": review_id,
                "workerCancelCount": worker_prev_cancel_count + (
                    1 if body.cancelled_by == "tasker" else 0
                ),
            }

            report_result = database.collection_reports.insert_one(report_doc)
            report_id     = str(report_result.inserted_id)
            print(f"[REPORT] Auto-report created for {task_id} — report_id={report_id}")

        except Exception as e:
            print(f"[REPORT] Failed to create auto-report (non-critical): {e}")
            traceback.print_exc()

        # ── 11b. Create entry in refunds collection ───────────────────────────
        try:
            payment_tx = database.collection_payment.find_one(
                {"task_id": str(task_id), "type": "customer_payment", "status": {"$in": ["success", "paid", "pending"]}},
                sort=[("created_at", -1)],
            )
            print("payment", payment_tx)

            worker_doc = None
            if worker_id:
                try:
                    worker_doc = database.collection_worker.find_one({"_id": ObjectId(str(worker_id))})
                except Exception:
                    worker_doc = database.collection_worker.find_one({"email": str(worker_id)})

            payment_method = (task.get("payment_method") or "").lower()
            if payment_method not in ("khalti", "esewa") and payment_tx:
                payment_method = (payment_tx.get("method") or "").lower()

            worker_payment_method = (worker_doc.get("paymentMethod") or "").lower() if worker_doc else None

            print(f"[REFUND] worker_doc={worker_doc}")
            print(f"[REFUND] worker_payment_method={worker_payment_method}")
            print(f"[REFUND] worker paymentId={worker_doc.get('paymentId') if worker_doc else None}")

            refund_doc = {
                "task_id":        task_id,
                "report_id":      report_id,
                "requester_id":   user_id,
                "reported_id":    str(worker_id) if worker_id else None,
                "requester_type": "customer",
                "reported_type":  "worker",
                "amount_customer": refund_amount,
                "amount_worker":   penalty_amount,
                "reason":          body.reason,
                "total_amount":    total_cost,
                "status":          "pending" if refund_status == "dispute" else "queued",
                "refundStatus":    "pending" if refund_status == "dispute" else "queued",
                "created_at":      now,
                "evidence_files":  [],
                "payment_method_customer":           payment_tx.get("method") if payment_tx else None,
                "esewa_transaction_uuid_customer":   payment_tx.get("transaction_uuid") if payment_method == "esewa" else None,
                "khalti_customer":                   payment_tx.get("transaction_uuid") if payment_method == "khalti" else None,
                "payment_method_worker":             worker_doc.get("paymentMethod") if worker_doc else None,
                "esewa_transaction_uuid_worker":     worker_doc.get("paymentId") if worker_doc and worker_payment_method == "esewa" else None,
                "khalti_worker":                     worker_doc.get("paymentId") if worker_doc and worker_payment_method == "khalti" else None,
            }

            refund_result = database.refund_collection.insert_one(refund_doc)
            refund_record_id = str(refund_result.inserted_id)
            id_refs["refund_id"] = refund_record_id

        except Exception as e:
            print(f"[REFUND] Failed to create refund record: {e}")

    # ── LinUCB: cancellation signal (paid task) ───────────────────────────────
    if worker_id and task_type:
        worker_dict = _resolve_worker_dict(str(worker_id))
        if worker_dict:
            reward = 0.1 if body.cancelled_by == "tasker" else 0.3
            _linucb_update(worker_dict, task_type, reward=reward, label=f"cancelled-paid-by-{body.cancelled_by}")

    # ── 12. Store only the IDs back on the task ───────────────────────────────
    if report_id:
        id_refs["report_id"] = report_id
    if review_id:
        id_refs["cancel_review_id"] = review_id
    if id_refs:
        database.collection_task.update_one({"_id": obj_id}, {"$set": id_refs})

    # ── 13. Notify customer ───────────────────────────────────────────────────
    _, customer = taskRepo.get_task_with_customer(task_id)
    task_name   = task.get("taskName", "your task")
    user_id     = str(task.get("userId", ""))

    if customer:
        if refund_status == "approved":
            c_title = "Task Cancelled ❌"
            c_body  = f"Your task '{task_name}' was cancelled. {refund_reason}"
        elif refund_status == "dispute":
            c_title = "Cancellation Under Review 🔍"
            c_body  = (
                f"Task '{task_name}' was cancelled mid-progress. "
                "A dispute has been opened — our team will review and process your refund."
            )

        await notifications.notify_with_fallback(
            userId    = user_id,
            title     = c_title,
            body      = c_body,
            token     = customer.get("fcmToken"),
            email     = customer.get("email"),
            is_worker = False,
        )

        try:
            await websocket_manager.manager.send_to_user(user_id, json.dumps({
                "type":         "task_status",
                "taskId":       task_id,
                "status":       "cancelled",
                "taskName":     task_name,
                "refundStatus": refund_status,
                "refundAmount": refund_amount,
            }))
        except Exception as e:
            print(f"[CANCEL] Customer WebSocket failed: {e}")

    # ── 14. Notify worker ─────────────────────────────────────────────────────
    if worker_id:
        worker_doc = taskRepo._get_worker_by_id(str(worker_id))
        if worker_doc:
            if body.cancelled_by == "tasker":
                if surcharge_pct > 0:
                    surcharge_amount = round(total_cost * surcharge_pct, 2)
                    w_title = "You Cancelled — Surcharge Applied ⚠️"
                    w_body  = (
                        f"You cancelled '{task_name}'. Customer gets a full refund. "
                        f"A {int(surcharge_pct*100)}% repeat-cancel surcharge of "
                        f"NPR {surcharge_amount:.2f} has been deducted from your earnings."
                    )
                else:
                    w_title = "You Cancelled the Task ❌"
                    w_body  = f"You cancelled '{task_name}'. Customer will receive a full refund."
            elif refund_status == "dispute":
                w_title = "Cancellation Under Review 🔍"
                w_body  = (
                    f"Task '{task_name}' was cancelled mid-progress. "
                    "A dispute has been opened for admin review."
                )
            elif penalty_amount > 0:
                w_title = "Task Cancelled — Penalty Applied ❌"
                w_body  = (
                    f"Task '{task_name}' was cancelled by customer within 4 hours. "
                    f"You will receive NPR {penalty_amount:.2f} as a penalty fee."
                )
            else:
                w_title = "Task Cancelled ❌"
                w_body  = f"Task '{task_name}' has been cancelled by the customer with a full refund."

            await notifications.notify_with_fallback(
                userId    = str(worker_id),
                title     = w_title,
                body      = w_body,
                token     = worker_doc.get("fcmToken"),
                email     = worker_doc.get("email"),
                is_worker = True,
            )

            try:
                await websocket_manager.manager.send_to_user(str(worker_id), json.dumps({
                    "type":           "task_status",
                    "taskId":         task_id,
                    "status":         "cancelled",
                    "taskName":       task_name,
                    "penaltyAmount":  penalty_amount,
                    "refundStatus":   refund_status,
                    "surchargePct":   surcharge_pct,
                }))
            except Exception as e:
                print(f"[CANCEL] Worker WebSocket failed: {e}")

    # ── 15. Return summary ────────────────────────────────────────────────────
    return {
        "message":           "Task cancelled successfully",
        "cancelledBy":       body.cancelled_by,
        "refundStatus":      refund_status,
        "refundAmount":      refund_amount,
        "penaltyAmount":     penalty_amount,
        "surchargePct":      surcharge_pct,
        "reason":            refund_reason,
        "dispute":           refund_status == "dispute",
        "report_id":         report_id,
        "cancel_review_id":  review_id,
        "workerCancelCount": worker_prev_cancel_count + (
            1 if body.cancelled_by == "tasker" else 0
        ),
    }