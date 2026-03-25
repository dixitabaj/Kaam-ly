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
from ..config.database import collection_worker, db
from pydantic import BaseModel

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

def get_general_slots(worker: dict, date: str):
    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format (YYYY-MM-DD)")

    day_cap = date_obj.strftime("%A")
    day_low = day_cap.lower()

    hours_dict = worker.get("hours") or worker.get("availability", {}).get("hours", {})
    weekly = hours_dict.get(day_cap) or hours_dict.get(day_low) or []

    slots = []
    for s in weekly:
        if isinstance(s, dict):
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
        "status": "confirmed"
    }))

    booked = []

    for entry in calendar_docs:
        # Extract only date part
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
            # No overlap
            if b_end <= seg["start"] or b_start >= seg["end"]:
                remaining.append(seg)
            else:
                # Cut left part
                if seg["start"] < b_start:
                    remaining.append({"start": seg["start"], "end": b_start})

                # Cut right part
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
    # 1. Resolve worker
    worker = resolve_worker(workerId, collection_worker)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    # 2. Get general slots
    general = get_general_slots(worker, date)

    # 3. Get booked slots from worker_calendar
    booked = get_booked_slots_from_calendar(worker, date, db)

    # 4. Calculate free slots
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

        # ✅ FIXED LINE
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


# ── Create Task ───────────────────────────────────────────────────────────────
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
    saved_files = []
    if taskImg:
        for file in taskImg:
            if hasattr(file, "filename") and file.filename:
                file_path = os.path.join(UPLOAD_DIR, file.filename)
                contents  = await file.read()
                with open(file_path, "wb") as f:
                    f.write(contents)
                saved_files.append(file.filename)

    worker = workerRepo.showWorkerByID(assignedWorker)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    best_prices   = []
    selected_name = (selectedService or taskType or "").strip().lower()

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

    if "base_price" not in locals():
        if best_prices:
            base_price = min(best_prices)
        else:
            try:
                price_data = workerRepo.getPriceByTask(taskType, assignedWorker)
                base_price = float(price_data.get("price", 0) if price_data else 0)
            except Exception:
                base_price = 0

    task = {
        "taskName":         taskName,
        "taskType":         taskType,
        "taskDescrip":      taskDescrip,
        "selectedService":  selectedService or "",
        "address":          address or "",
        "lat":              lat or "",
        "lng":              lng or "",
        "userId":           userId,
        "taskImg":          saved_files or None,
        "status":           status.lower(),
        "assignedWorkerId": assignedWorker,
        "serviceDate":      serviceDate,
        "note":             note,
        "serviceTime":      serviceTime,
        "basePrice":        base_price,
    }

    task_id = await taskRepo.insert_task(task)

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

        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def get_task_datetime(task: dict) -> datetime | None:
    """Combine serviceDate + serviceTime into a single datetime."""
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
def _get_task_datetime(task: dict) -> datetime | None:
    """
    Parse serviceDate into a datetime.
    Handles:
      - Python datetime objects (from MongoDB Date type)
      - Full ISO strings: "2026-03-13T04:10:26.683+00:00"
      - Date-only strings: "2026-03-13"
    serviceTime is used only when serviceDate is a plain date string with no time component.
    """
    try:
        service_date = task.get("serviceDate")
        if not service_date:
            return None
 
        # Already a Python datetime (MongoDB Date field)
        if isinstance(service_date, datetime):
            return service_date.replace(tzinfo=None)  # strip tz for naive comparison
 
        service_date_str = str(service_date).strip()
 
        # Full ISO datetime string (has 'T')
        if "T" in service_date_str:
            # Remove timezone offset for naive datetime
            # Handles: "2026-03-13T04:10:26.683+00:00" or "2026-03-13T04:10:26.683Z"
            clean = service_date_str.replace("Z", "+00:00")
            try:
                dt = datetime.fromisoformat(clean)
                return dt.replace(tzinfo=None)
            except ValueError:
                # Fallback: strip timezone part manually
                clean = service_date_str[:26]  # "2026-03-13T04:10:26.683"
                return datetime.fromisoformat(clean)
 
        # Plain date string "2026-03-13" — combine with serviceTime
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
# REQUEST BODY
# ─────────────────────────────────────────────

class CancelRequest(BaseModel):
    cancelled_by: str   # "customer" or "tasker"
    reason: str


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _get_task_datetime(task: dict) -> datetime | None:
    """
    Parse serviceDate into a datetime.
    Handles:
      - Python datetime objects (from MongoDB Date type)
      - Full ISO strings: "2026-03-13T04:10:26.683+00:00"
      - Date-only strings: "2026-03-13"
    serviceTime is used only when serviceDate is a plain date string with no time component.
    """
    try:
        service_date = task.get("serviceDate")
        if not service_date:
            return None

        # Already a Python datetime (MongoDB Date field)
        if isinstance(service_date, datetime):
            return service_date.replace(tzinfo=None)  # strip tz for naive comparison

        service_date_str = str(service_date).strip()

        # Full ISO datetime string (has 'T')
        if "T" in service_date_str:
            # Remove timezone offset for naive datetime
            # Handles: "2026-03-13T04:10:26.683+00:00" or "2026-03-13T04:10:26.683Z"
            clean = service_date_str.replace("Z", "+00:00")
            try:
                dt = datetime.fromisoformat(clean)
                return dt.replace(tzinfo=None)
            except ValueError:
                # Fallback: strip timezone part manually
                clean = service_date_str[:26]  # "2026-03-13T04:10:26.683"
                return datetime.fromisoformat(clean)

        # Plain date string "2026-03-13" — combine with serviceTime
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
    """
    Give the blocked calendar slot back to the worker after cancellation.
    Works for both offer-accepted (real estimatedHours block) and
    pending/confirmed (2-hour soft block).
    """
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


# ─────────────────────────────────────────────
# REFUND CALCULATION
# ─────────────────────────────────────────────

def calculate_refund(
    cancelled_by: str,
    escrow_status: str,
    task_status: str,
    hours_before_start: float,
    total_cost: float,
) -> dict:
    """
    Returns a dict with:
        refund_status  : "approved" | "declined" | "dispute"
        refund_amount  : float  (amount going back to customer)
        penalty_amount : float  (amount going to worker)
        reason         : str
    """

    # ── STEP 1: Guard — escrow already released ───────────────────────────────
    if escrow_status == "released":
        return {
            "refund_status":  "declined",
            "refund_amount":  0.0,
            "penalty_amount": 0.0,
            "reason":         "Escrow already released — refund not possible.",
        }

    # ── STEP 2: Mid-task cancellation → dispute ───────────────────────────────
    if task_status == "in_progress":
        return {
            "refund_status":  "dispute",
            "refund_amount":  0.0,
            "penalty_amount": 0.0,
            "reason":         "Task is in progress — dispute opened for admin review.",
        }

    # ── STEP 3: Tasker cancels before task starts → full refund ───────────────
    if cancelled_by == "tasker":
        return {
            "refund_status":  "approved",
            "refund_amount":  total_cost,
            "penalty_amount": 0.0,
            "reason":         "Tasker cancelled — full refund issued to customer.",
        }

    # ── STEP 4: Customer cancels before task starts ───────────────────────────
    if cancelled_by == "customer":
        if hours_before_start >= 4:
            return {
                "refund_status":  "approved",
                "refund_amount":  total_cost,
                "penalty_amount": 0.0,
                "reason":         "Cancelled with ≥4 hours notice — full refund issued.",
            }
        else:
            penalty = round(total_cost * 0.25, 2)
            refund  = round(total_cost * 0.75, 2)
            return {
                "refund_status":  "approved",
                "refund_amount":  refund,
                "penalty_amount": penalty,
                "reason":         (
                    f"Cancelled within 4 hours of start — "
                    f"75% refund (NPR {refund}) issued; "
                    f"25% penalty (NPR {penalty}) retained by worker."
                ),
            }

    # ── Fallback ──────────────────────────────────────────────────────────────
    return {
        "refund_status":  "dispute",
        "refund_amount":  0.0,
        "penalty_amount": 0.0,
        "reason":         "Unable to determine cancellation terms — dispute opened.",
    }


# ─────────────────────────────────────────────
# MAIN ENDPOINT
# ─────────────────────────────────────────────

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

    # ── 3. Guard: already completed ──────────────────────────────────────────
    task_status = task.get("status", "")
    if task_status == "completed":
        raise HTTPException(status_code=400, detail="Cannot cancel a completed task")

    if task_status == "cancelled":
        raise HTTPException(status_code=400, detail="Task is already cancelled")

    # ── 4. Gather inputs for refund calculation ───────────────────────────────
    escrow_status = task.get("escrow_status", "pending")
    total_cost    = float(task.get("totalCost") or 0)

    now           = datetime.utcnow()
    task_datetime = _get_task_datetime(task)

    if task_datetime:
        hours_before_start = (task_datetime - now).total_seconds() / 3600
    else:
        # serviceDate is null/missing — treat as plenty of notice (full refund eligible)
        print(f"[CANCEL] serviceDate missing for task {task_id} — defaulting hours_before_start to 999")
        hours_before_start = 999.0

    # ── 5. Calculate refund ───────────────────────────────────────────────────
    refund = calculate_refund(
        cancelled_by       = body.cancelled_by,
        escrow_status      = escrow_status,
        task_status        = task_status,
        hours_before_start = hours_before_start,
        total_cost         = total_cost,
    )

    refund_status  = refund["refund_status"]
    refund_amount  = refund["refund_amount"]
    penalty_amount = refund["penalty_amount"]
    refund_reason  = refund["reason"]

    # ── 6. Persist cancellation ───────────────────────────────────────────────
    update_fields = {
        "status":           "cancelled",
        "cancelledBy":      body.cancelled_by,
        "cancelledAt":      now,
        "cancelReason":     body.reason,
        "refundStatus":     refund_status,
        "refundAmount":     refund_amount,
        "penaltyAmount":    penalty_amount,
        "refundUpdatedAt":  now,
    }

    # For dispute: open a ticket for admin
    if refund_status == "dispute":
        update_fields["disputeStatus"] = "open"
        update_fields["disputeOpenedAt"] = now

    result = database.collection_task.update_one({"_id": obj_id}, {"$set": update_fields})
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Failed to update task — no changes made")

    # ── 7. Credit penalty to worker ───────────────────────────────────────────
    worker_id = task.get("assignedWorkerId")

    if penalty_amount > 0 and worker_id:
        worker_filter = {"email": worker_id}
        try:
            worker_filter = {"_id": ObjectId(worker_id)}
        except Exception:
            pass
        database.collection_worker.update_one(
            worker_filter,
            {"$inc": {"earnings": penalty_amount}}
        )

    # ── 8. Restore worker calendar slot ──────────────────────────────────────
    if refund_status != "dispute":
        _restore_worker_slot(task)

    # ── 9. Fetch customer for notifications ───────────────────────────────────
    _, customer = taskRepo.get_task_with_customer(task_id)
    task_name   = task.get("taskName", "your task")
    user_id     = str(task.get("userId", ""))

    # ── 9b. Auto-create report if task was paid ───────────────────────────────
    payment_status = task.get("payment_status") or task.get("escrow_status") or ""
    was_paid       = payment_status in ("paid", "released", "escrowed", "held")

    if was_paid and total_cost > 0:
        try:
            if refund_status == "dispute":
                report_reason = "mid_task_cancellation_dispute"
            elif penalty_amount > 0:
                report_reason = "cancellation_with_penalty"
            else:
                report_reason = "cancellation_with_refund"

            report_doc = {
                "reporterId":    user_id,
                "reporterType":  "customer",
                "reportedId":    str(worker_id) if worker_id else "",
                "reportedType":  "worker",
                "reason":        report_reason,
                "description":   (
                    f"Task '{task_name}' (ID: {task_id}) was cancelled by {body.cancelled_by}. "
                    f"Total cost: NPR {total_cost:.2f}. "
                    f"Refund: NPR {refund_amount:.2f}. "
                    f"Penalty: NPR {penalty_amount:.2f}. "
                    f"Refund status: {refund_status}. "
                    f"Cancel reason: {body.reason}"
                ),
                "evidenceUrl":   None,
                "status":        "pending" if refund_status == "dispute" else "resolved",
                "createdAt":     now,
                "resolvedAt":    now if refund_status != "dispute" else None,
                "adminNote":     refund_reason,
                # Extra context for the admin report panel
                "taskId":        task_id,
                "taskName":      task_name,
                "cancelledBy":   body.cancelled_by,
                "refundStatus":  refund_status,
                "refundAmount":  refund_amount,
                "penaltyAmount": penalty_amount,
                "totalCost":     total_cost,
                "type":          "cancellation",
            }

            database.collection_reports.insert_one(report_doc)
            print(f"[REPORT] Auto-report created for paid task cancellation: {task_id}")

        except Exception as e:
            print(f"[REPORT] Failed to create auto-report (non-critical): {e}")
            traceback.print_exc()

    # ── 10. Notify customer ───────────────────────────────────────────────────
    if customer:
        if refund_status == "approved":
            customer_title = "Task Cancelled ❌"
            customer_body  = (
                f"Your task '{task_name}' was cancelled. {refund_reason}"
            )
        elif refund_status == "dispute":
            customer_title = "Cancellation Under Review 🔍"
            customer_body  = (
                f"Your task '{task_name}' was cancelled mid-progress. "
                f"A dispute has been opened — our team will review and process your refund."
            )
        else:  # declined
            customer_title = "Refund Not Available ❌"
            customer_body  = (
                f"Your task '{task_name}' was cancelled. {refund_reason}"
            )

        await notifications.notify_with_fallback(
            userId   = user_id,
            title    = customer_title,
            body     = customer_body,
            token    = customer.get("fcmToken"),
            email    = customer.get("email"),
            is_worker = False,
        )

        try:
            await websocket_manager.manager.send_to_user(user_id, json.dumps({
                "type":          "task_status",
                "taskId":        task_id,
                "status":        "cancelled",
                "taskName":      task_name,
                "refundStatus":  refund_status,
                "refundAmount":  refund_amount,
            }))
        except Exception as e:
            print(f"[CANCEL] Customer WebSocket failed: {e}")

    # ── 11. Notify worker ─────────────────────────────────────────────────────
    if worker_id:
        worker_doc = taskRepo._get_worker_by_id(str(worker_id))
        if worker_doc:
            if body.cancelled_by == "tasker":
                worker_title = "You Cancelled the Task ❌"
                worker_body  = f"You cancelled '{task_name}'. Customer will receive a full refund."
            elif refund_status == "dispute":
                worker_title = "Cancellation Under Review 🔍"
                worker_body  = (
                    f"Task '{task_name}' was cancelled mid-progress. "
                    f"A dispute has been opened for admin review."
                )
            elif penalty_amount > 0:
                worker_title = "Task Cancelled — Penalty Applied ❌"
                worker_body  = (
                    f"Task '{task_name}' was cancelled within 4 hours of start. "
                    f"You will receive NPR {penalty_amount:.2f} as a penalty fee."
                )
            else:
                worker_title = "Task Cancelled ❌"
                worker_body  = f"Task '{task_name}' has been cancelled by the customer with a full refund."

            await notifications.notify_with_fallback(
                userId    = str(worker_id),
                title     = worker_title,
                body      = worker_body,
                token     = worker_doc.get("fcmToken"),
                email     = worker_doc.get("email"),
                is_worker = True,
            )

            try:
                await websocket_manager.manager.send_to_user(str(worker_id), json.dumps({
                    "type":          "task_status",
                    "taskId":        task_id,
                    "status":        "cancelled",
                    "taskName":      task_name,
                    "penaltyAmount": penalty_amount,
                    "refundStatus":  refund_status,
                }))
            except Exception as e:
                print(f"[CANCEL] Worker WebSocket failed: {e}")

    # ── 12. Return summary ────────────────────────────────────────────────────
    return {
        "message":       "Task cancelled successfully",
        "cancelledBy":   body.cancelled_by,
        "refundStatus":  refund_status,
        "refundAmount":  refund_amount,
        "penaltyAmount": penalty_amount,
        "reason":        refund_reason,
        "dispute":       refund_status == "dispute",
    }


# # ── Cancel Task ───────────────────────────────────────────────────────────────
# @router.patch("/task/{task_id}/cancel")
# async def cancel_task(task_id: str, reason: str):
#     try:
#         obj_id = ObjectId(task_id)
#     except Exception:
#         raise HTTPException(status_code=400, detail="Invalid task ID")

#     task = database.collection_task.find_one({"_id": obj_id})
#     if not task:
#         raise HTTPException(status_code=404, detail="Task not found")

#     if task.get("status") == "completed":
#         raise HTTPException(status_code=400, detail="Cannot cancel completed task")

#     now           = datetime.utcnow()
#     task_datetime = get_task_datetime(task)
#     if not task_datetime:
#         raise HTTPException(status_code=400, detail="Invalid task datetime")

#     hours_left     = (task_datetime - now).total_seconds() / 3600
#     penalty_amount = 0
#     refund_amount  = 0
#     total_cost     = task.get("totalCost") or 0

#     if task.get("paymentStatus") == "paid" and hours_left <= 3:
#         penalty_amount = total_cost * 0.25
#         refund_amount  = total_cost * 0.75
#     elif task.get("paymentStatus") == "paid":
#         refund_amount  = total_cost

#     result = database.collection_task.update_one(
#         {"_id": obj_id},
#         {"$set": {
#             "status":        "cancelled",
#             "cancelledAt":   now,
#             "cancelReason":  reason,
#             "penaltyAmount": penalty_amount,
#             "refundAmount":  refund_amount,
#         }}
#     )

#     if result.modified_count == 0:
#         raise HTTPException(status_code=400, detail="Failed to cancel task")

#     # ── RESTORE SLOT: give the time window back to the worker ─────────────────
#     # Figures out which block was active at cancellation time:
#     #   - If offer was accepted → real estimatedHours block was in place
#     #   - Otherwise            → 2hr soft block was in place
#     # Only touches that specific day — all other days stay unchanged.
#     worker_id    = task.get("assignedWorkerId")
#     service_time = task.get("serviceTime")
#     service_date = task.get("serviceDate")

#     if worker_id and service_time and service_date:
#         try:
#             day_name        = taskRepo._get_day_name(service_date)
#             estimated_hours = task.get("estimatedHours")
#             offer_accepted  = task.get("offerStatus") == "accepted"

#             # Determine which block end was in effect
#             blocked_end = (
#                 taskRepo._add_hours(service_time, estimated_hours)
#                 if (offer_accepted and estimated_hours)
#                 else taskRepo._add_hours(service_time, 2)
#             )

#             worker_doc = taskRepo._get_worker_by_id(str(worker_id))
#             if worker_doc:
#                 current_slots = taskRepo._get_day_slots(worker_doc, day_name)
#                 restored      = taskRepo._restore_slot(current_slots, service_time, blocked_end)
#                 taskRepo._save_day_slots(str(worker_id), day_name, restored)
#                 print(f"[SLOT] Slot restored on {day_name} after cancel: {service_time} → {blocked_end}")
#             else:
#                 print(f"[SLOT] Worker not found for slot restore — skipping")
#         except Exception as e:
#             print(f"[SLOT] Slot restore failed (non-critical): {e}")
#             traceback.print_exc()

#     # ── Credit penalty to worker ──────────────────────────────────────────────
#     if penalty_amount > 0 and worker_id:
#         worker_filter = {"email": worker_id}
#         try:
#             worker_filter = {"_id": ObjectId(worker_id)}
#         except Exception:
#             pass
#         database.collection_worker.update_one(
#             worker_filter,
#             {"$inc": {"earnings": penalty_amount}}
#         )

#     # ── Notify customer ───────────────────────────────────────────────────────
#     _, customer = taskRepo.get_task_with_customer(task_id)
#     task_name   = task.get("taskName", "your task")

#     if customer:
#         if penalty_amount > 0:
#             customer_body = (
#                 f"Your task '{task_name}' was cancelled within 3 hours of the scheduled time. "
#                 f"NPR {refund_amount:.2f} will be refunded (25% penalty of NPR {penalty_amount:.2f} retained by worker)."
#             )
#         elif refund_amount > 0:
#             customer_body = (
#                 f"Your task '{task_name}' was cancelled. "
#                 f"Full refund of NPR {refund_amount:.2f} will be processed."
#             )
#         else:
#             customer_body = f"Your task '{task_name}' has been cancelled."

#         await notifications.notify_with_fallback(
#             userId=str(task.get("userId")),
#             title="Task Cancelled ❌",
#             body=customer_body,
#             token=customer.get("fcmToken"),
#             email=customer.get("email"),
#             is_worker=False,
#         )

#     # ── Notify worker ─────────────────────────────────────────────────────────
#     if worker_id:
#         worker_doc = taskRepo._get_worker_by_id(str(worker_id))
#         if worker_doc:
#             if penalty_amount > 0:
#                 worker_body = (
#                     f"Task '{task_name}' was cancelled within 3 hours. "
#                     f"You will receive NPR {penalty_amount:.2f} (25% penalty fee)."
#                 )
#             else:
#                 worker_body = f"Task '{task_name}' has been cancelled by the customer."

#             await notifications.notify_with_fallback(
#                 userId=str(worker_id),
#                 title="Task Cancelled ❌",
#                 body=worker_body,
#                 token=worker_doc.get("fcmToken"),
#                 email=worker_doc.get("email"),
#                 is_worker=True,
#             )

#             try:
#                 await websocket_manager.manager.send_to_user(worker_id, json.dumps({
#                     "type":          "task_status",
#                     "taskId":        task_id,
#                     "status":        "cancelled",
#                     "taskName":      task_name,
#                     "penaltyAmount": penalty_amount,
#                 }))
#             except Exception as e:
#                 print(f"[CANCEL] Worker WebSocket failed: {e}")

#     # ── WebSocket to customer ─────────────────────────────────────────────────
#     if customer:
#         try:
#             await websocket_manager.manager.send_to_user(
#                 str(task.get("userId")), json.dumps({
#                     "type":         "task_status",
#                     "taskId":       task_id,
#                     "status":       "cancelled",
#                     "taskName":     task_name,
#                     "refundAmount": refund_amount,
#                 })
#             )
#         except Exception as e:
#             print(f"[CANCEL] Customer WebSocket failed: {e}")

#     return {
#         "message":        "Task cancelled successfully",
#         "penaltyApplied": penalty_amount > 0,
#         "penaltyAmount":  penalty_amount,
#         "refundAmount":   refund_amount,
#     }

