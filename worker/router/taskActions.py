"""
task_actions.py — tasks_router only.

Handles notification-triggered task actions (start, complete) and
sends follow-up FCM pushes via notify_with_fallback from notifications.py.

Add to main.py:
    from worker.routes.task_actions import tasks_router
    app.include_router(tasks_router)
"""

from datetime import datetime

from fastapi import APIRouter, HTTPException
from bson import ObjectId

from ..config.database import collection_task
from .notifications import notify_with_fallback, _get_customer

tasks_router = APIRouter(prefix="/api/tasks", tags=["task-notification-actions"])


@tasks_router.post("/{task_id}/start-from-notification")
async def start_task_from_notification(task_id: str, body: dict):
    if body.get("source") != "notification_action":
        raise HTTPException(status_code=403, detail="Unauthorized source")

    try:
        task = collection_task.find_one({"_id": ObjectId(task_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID")

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.get("status") == "in_progress":
        return {"success": False, "message": "Task already in progress."}
    if task.get("status") != "confirmed":
        return {"success": False, "message": f"Must be confirmed first (current: {task.get('status')})."}

    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "status":      "in_progress",
            "startedAt":   datetime.utcnow(),
            "startedVia":  "notification_action",
        }},
    )

    task_name   = task.get("taskName") or task.get("taskDescrip", "your task")
    customer_id = task.get("userId")
    worker_id   = task.get("assignedWorkerId")

    if customer_id:
        customer = await _get_customer(customer_id)
        if customer:
            await notify_with_fallback(
                userId=str(customer_id),
                title="Work Has Started ▶",
                body=f'Your worker has started "{task_name}".',
                token=customer.get("fcmToken"),
                email=customer.get("email"),
                click_action="/tasks",
                data={"event_type": "task_started", "task_id": task_id},
            )

    if worker_id:
        await notify_with_fallback(
            userId=worker_id,
            title="Task In Progress",
            body=f'You started "{task_name}". Tap to mark complete when done.',
            click_action="/worker/requests",
            data={"event_type": "task_in_progress", "task_id": task_id},
            is_worker=True,
        )

    return {"success": True, "message": f'Work started on "{task_name}".', "task_id": task_id}


@tasks_router.post("/{task_id}/complete-from-notification")
async def complete_task_from_notification(task_id: str, body: dict):
    if body.get("source") != "notification_action":
        raise HTTPException(status_code=403, detail="Unauthorized source")

    try:
        task = collection_task.find_one({"_id": ObjectId(task_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID")

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.get("status") == "completed":
        return {"success": False, "message": "Task already completed."}
    if task.get("status") != "in_progress":
        return {"success": False, "message": f"Must be in progress first (current: {task.get('status')})."}

    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "status":       "completed",
            "completedAt":  datetime.utcnow(),
            "completedVia": "notification_action",
        }},
    )

    task_name   = task.get("taskName") or task.get("taskDescrip", "your task")
    customer_id = task.get("userId")

    if customer_id:
        customer = await _get_customer(customer_id)
        if customer:
            await notify_with_fallback(
                userId=str(customer_id),
                title="Task Completed ✓",
                body=f'"{task_name}" is done. Please review and release payment.',
                token=customer.get("fcmToken"),
                email=customer.get("email"),
                click_action="/tasks",
                data={"event_type": "task_completed", "task_id": task_id},
            )

    return {"success": True, "message": f'"{task_name}" marked as completed.', "task_id": task_id}