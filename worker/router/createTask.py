from fastapi import APIRouter, Form, File, UploadFile, HTTPException
from typing import List, Optional
from ..repository import taskRepo, workerRepo
import os
import time
from ..schemas.schemas import TaskResponse, TaskResponseUpdate, TaskOfferUpdate
from ..manager import websocket_manager
import json
from datetime import datetime
from .notifications import notify_task_assigned  # ← added

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(tags=["Task"])

# -----------------------------
# Create Task Endpoint
# -----------------------------
@router.post("/task")
async def create_task(
    taskName: str = Form(...),
    taskType: str = Form(...),
    taskDescrip: str = Form(...),
    estimatedHours: Optional[int] = Form(None),
    selectedService: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    lat: Optional[str] = Form(None),
    lng: Optional[str] = Form(None),
    userId: str = Form(...),
    taskImg: Optional[List[UploadFile]] = File(default=None),
    status: str = Form("pending"),
    assignedWorker:  str = Form(...),
    serviceDate: datetime=Form(...),
    note: str=Form(...),
    serviceTime: str=Form(...)
):
    # Save uploaded files
    saved_files = []
    if taskImg:
        for file in taskImg:
            if hasattr(file, 'filename') and file.filename:
                file_path = os.path.join(UPLOAD_DIR, file.filename)
                contents = await file.read()
                with open(file_path, "wb") as f:
                    f.write(contents)
                saved_files.append(file.filename)

    worker = workerRepo.showWorkerByID(assignedWorker)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    # Get the lowest rate across all skills (matches your registration logic)
    base_price = min(skill.price for skill in worker.skills) if worker.skills else 0
    totalCost  = int(base_price) * int(estimatedHours)


    task = {
        "taskName":       taskName,
        "taskType":       taskType,
        "taskDescrip":    taskDescrip,
        "estimatedHours": estimatedHours or 0,
        "selectedService": selectedService or "",
        "address":        address or "",
        "lat":            lat or "",
        "lng":            lng or "",
        "userId":         userId,
        "taskImg":        saved_files or None,
        "createdAt":      time.time(),
        "status":         status.lower(),
        "assignedWorkerId": assignedWorker,
        "serviceDate":    serviceDate,
        "basePrice":      base_price,
        "totalCost":      totalCost,
        "note":           note,
        "serviceTime":    serviceTime,
    }

    task_id = await taskRepo.insert_task(task)

    # ── Websocket notification (existing) ────────────────────────────────────
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
        "totalCost":   totalCost,
    })
    await websocket_manager.manager.send_to_user(assignedWorker, task_notification)

    # ── Push notification (new) ───────────────────────────────────────────────
    # assignedWorker is the worker's email (e.g. "dix@gmail.com")
    try:
        notify_task_assigned(
            worker_email=assignedWorker,
            task_name=taskName,
            task_id=str(task_id),
        )
    except Exception as e:
        # Never let notification failure break task creation
        print(f"[FCM] Push notification failed (non-critical): {e}")

    return {
        "message":   "Task created successfully",
        "taskId":    task_id,
        "task":      base_price,
        "totalCost": totalCost,
    }


# -----------------------------
# Get all tasks for a user
# -----------------------------
@router.get("/tasks/user/{user_id}")
async def get_tasks_by_user(user_id: str):
    tasks = taskRepo.get_tasks_by_user(user_id)
    return {"tasks": tasks}


# -----------------------------
# Get all notifications for a user
# -----------------------------
@router.get("/notifications")
async def get_notifications(userId: str):
    notifs = taskRepo.get_user_notifications(userId)
    return {"notifications": notifs}


# -----------------------------
# Assign worker to a task
# -----------------------------
@router.post("/tasks/{task_id}/assign/{worker_id}")
async def assign_worker(task_id: str, worker_id: str):
    success = taskRepo.assign_worker(task_id, worker_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to assign worker")
    return {"message": "Worker assigned successfully"}


@router.get("/tasks/worker/{worker_id}")
async def getTaskByWorkerId(worker_id):
    tasks = taskRepo.get_tasks_by_worker(worker_id)
    return {"tasks": tasks}


@router.get("/task/{task_id}")
async def get_task_by_id(task_id: str):
    success = taskRepo.get_task_by_id(task_id)
    if not success:
        raise HTTPException(status_code=400, detail="Task not found")
    return success


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