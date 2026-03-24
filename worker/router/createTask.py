from fastapi import APIRouter, Form, File, UploadFile, HTTPException
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


# ── Update task status — FIXED: await notification instead of create_task ─────
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

            print(f"[STATUS] customer fcmToken: {customer.get('fcmToken', 'MISSING')[:20] if customer.get('fcmToken') else 'MISSING'}")
            print(f"[STATUS] customer email   : {customer.get('email', 'MISSING')}")

            # ── FIX: await directly — do NOT use asyncio.create_task ──
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

            # ── WebSocket → frontend toast ──
            try:
                await websocket_manager.manager.send_to_user(userId, json.dumps({
                    "type":     "task_status",
                    "taskId":   task_id,
                    "status":   status,
                    "taskName": taskName,
                }))
            except Exception as e:
                print(f"[STATUS] WebSocket send failed: {e}")

            # ── Schedule payment reminder if confirmed ──
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

        # Handle if serviceDate is already a datetime object (MongoDB may return it as one)
        if isinstance(service_date, datetime):
            date_part = service_date.date()
        else:
            # Try parsing ISO string e.g. "2025-03-24T00:00:00" or "2025-03-24"
            date_part = datetime.fromisoformat(str(service_date).split("T")[0]).date()

        # Parse serviceTime e.g. "14:30" or "2:30 PM"
        try:
            time_part = datetime.strptime(service_time, "%H:%M").time()
        except ValueError:
            try:
                time_part = datetime.strptime(service_time, "%I:%M %p").time()
            except ValueError:
                time_part = datetime.min.time()  # fallback to midnight

        return datetime.combine(date_part, time_part)

    except Exception as e:
        print(f"[get_task_datetime] Failed to parse datetime: {e}")
        return None
        
@router.patch("/task/{task_id}/cancel")
async def cancel_task(task_id: str, reason: str):
    try:
        obj_id = ObjectId(task_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID")

    task = database.collection_task.find_one({"_id": obj_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.get("status") == "completed":
        raise HTTPException(status_code=400, detail="Cannot cancel completed task")

    now = datetime.utcnow()

    task_datetime = get_task_datetime(task)
    if not task_datetime:
        raise HTTPException(status_code=400, detail="Invalid task datetime")

    hours_left = (task_datetime - now).total_seconds() / 3600

    penalty_amount = 0
    refund_amount  = 0
    total_cost     = task.get("totalCost") or 0

    # ── Penalty only if paid AND cancelled within 3 hours ──
    if task.get("paymentStatus") == "paid" and hours_left <= 3:
        penalty_amount = total_cost * 0.25
        refund_amount  = total_cost * 0.75
    elif task.get("paymentStatus") == "paid":
        refund_amount  = total_cost          # full refund if cancelled early

    result = database.collection_task.update_one(
        {"_id": obj_id},
        {"$set": {
            "status":         "cancelled",
            "cancelledAt":    now,
            "cancelReason":   reason,
            "penaltyAmount":  penalty_amount,
            "refundAmount":   refund_amount,
        }}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Failed to cancel task")

    worker_id = task.get("assignedWorkerId")

    # ── Credit penalty to worker ──
    if penalty_amount > 0 and worker_id:
        worker_filter = {"$or": [{"email": worker_id}, {"_id": worker_id}]}
        try:
            worker_filter = {"$or": [{"_id": ObjectId(worker_id)}, {"email": worker_id}]}
        except Exception:
            pass
        database.collection_worker.update_one(
            worker_filter,
            {"$inc": {"earnings": penalty_amount}}
        )

    # ── Notify customer ──
    _, customer = taskRepo.get_task_with_customer(task_id)
    task_name   = task.get("taskName", "your task")

    if customer:
        if penalty_amount > 0:
            customer_body = (
                f"Your task '{task_name}' was cancelled within 3 hours of the scheduled time. "
                f"NPR {refund_amount:.2f} will be refunded (25% penalty of NPR {penalty_amount:.2f} retained by worker)."
            )
        elif refund_amount > 0:
            customer_body = (
                f"Your task '{task_name}' was cancelled. "
                f"Full refund of NPR {refund_amount:.2f} will be processed."
            )
        else:
            customer_body = f"Your task '{task_name}' has been cancelled."

        await notifications.notify_with_fallback(
            userId=str(task.get("userId")),
            title="Task Cancelled ❌",
            body=customer_body,
            token=customer.get("fcmToken"),
            email=customer.get("email"),
            is_worker=False,
        )

    # ── Notify worker ──
    if worker_id:
        worker_filter = {"$or": [{"email": worker_id}, {"_id": worker_id}]}
        try:
            worker_filter = {"$or": [{"_id": ObjectId(worker_id)}, {"email": worker_id}]}
        except Exception:
            pass
        worker_doc = database.collection_worker.find_one(worker_filter)
        if worker_doc:
            if penalty_amount > 0:
                worker_body = (
                    f"Task '{task_name}' was cancelled within 3 hours. "
                    f"You will receive NPR {penalty_amount:.2f} (25% penalty fee)."
                )
            else:
                worker_body = f"Task '{task_name}' has been cancelled by the customer."

            await notifications.notify_with_fallback(
                userId=str(worker_id),
                title="Task Cancelled ❌",
                body=worker_body,
                token=worker_doc.get("fcmToken"),
                email=worker_doc.get("email"),
                is_worker=True,
            )

            # WebSocket to worker
            try:
                await websocket_manager.manager.send_to_user(worker_id, json.dumps({
                    "type":          "task_status",
                    "taskId":        task_id,
                    "status":        "cancelled",
                    "taskName":      task_name,
                    "penaltyAmount": penalty_amount,
                }))
            except Exception as e:
                print(f"[CANCEL] Worker WebSocket failed: {e}")

    # WebSocket to customer
    if customer:
        try:
            await websocket_manager.manager.send_to_user(
                str(task.get("userId")), json.dumps({
                    "type":         "task_status",
                    "taskId":       task_id,
                    "status":       "cancelled",
                    "taskName":     task_name,
                    "refundAmount": refund_amount,
                })
            )
        except Exception as e:
            print(f"[CANCEL] Customer WebSocket failed: {e}")

    return {
        "message":       "Task cancelled successfully",
        "penaltyApplied": penalty_amount > 0,
        "penaltyAmount": penalty_amount,
        "refundAmount":  refund_amount,
    }