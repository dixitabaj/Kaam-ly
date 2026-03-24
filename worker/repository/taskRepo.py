from ..config import database
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel
from ..router import notifications

import asyncio

import asyncio
import traceback
from bson import ObjectId


async def insert_task(task: dict) -> str:
    task["createdAt"] = datetime.utcnow()
    result = database.collection_task.insert_one(task)
    task_id = str(result.inserted_id)
    print(f"[TASK] Task inserted: {task_id}")

    # ── Customer lookup — try ObjectId and email ──
    userId = task.get("userId")
    customer = database.collection.find_one({"_id": userId})
    if not customer:
        try:
            customer = database.collection.find_one({"_id": ObjectId(userId)})
        except: pass
    if not customer:
        customer = database.collection.find_one({"email": userId})
    print(f"[NOTIFY] Customer found: {customer is not None}")

    # ── Worker lookup — try ObjectId and email ──
    assignedId = task.get("assignedWorkerId")
    worker = database.collection_worker.find_one({"_id": assignedId})
    if not worker:
        try:
            worker = database.collection_worker.find_one({"_id": ObjectId(assignedId)})
        except: pass
    if not worker:
        worker = database.collection_worker.find_one({"email": assignedId})
    print(f"[NOTIFY] Worker found: {worker is not None}")
    print(f"[NOTIFY] Worker fcmToken: {worker.get('fcmToken', 'MISSING') if worker else 'N/A'}")

    # ── Fire notifications concurrently without blocking ──
    notify_tasks = []

    if customer:
        notify_tasks.append(notifications.notify_with_fallback(
            userId=str(userId),
            title="Task Created! 📋",
            body=f"Your task '{task['taskName']}' has been created and is pending confirmation.",
            token=customer.get("fcmToken"),
            email=customer.get("email"),
        ))

    if worker:
        notify_tasks.append(notifications.notify_with_fallback(
            userId=str(assignedId),
            title="New Task Assigned! 🎉",
            body=f"You have been assigned: '{task['taskName']}'",
            token=worker.get("fcmToken"),
            email=worker.get("email"),
        ))

    if notify_tasks:
        try:
            await asyncio.gather(*notify_tasks)
            print(f"[NOTIFY] All notifications sent ✓")
        except Exception as e:
            print(f"[NOTIFY] Notification error: {e}")
            traceback.print_exc()

    return task_id
def get_task_by_id(task_id: str) -> dict | None:
    """
    Fetch a single task by ID.
    """
    try:
        obj_id = ObjectId(task_id)
    except Exception:
        return None

    task = database.collection_task.find_one({"_id": obj_id})
    if task:
        task["id"] = str(task["_id"])
        del task["_id"]
    return task

def get_tasks_by_user(user_id: str) -> list[dict]:
    tasks = list(database.collection_task.find({"userId": user_id}))
    for task in tasks:
        task["id"] = str(task["_id"])
        del task["_id"]
    return tasks

def get_user_notifications(user_id: str) -> list[dict]:
    """
    Return tasks with status 'pending' as notifications
    """
    notifs = list(database.collection_task.find({"userId": user_id, "status": "pending"}))
    for n in notifs:
        n["id"] = str(n["_id"])
        del n["_id"]
    return notifs

def assign_worker(task_id: str, worker_id: str) -> bool:
    """
    Assign a worker to a task and mark it booked
    """
    try:
        obj_id = ObjectId(task_id)
    except Exception:
        return False

    result = database.collection_task.update_one(
        {"_id": obj_id},
        {"$set": {"assignedWorkerId": worker_id, "status": "booked"}}
    )
    return result.modified_count > 0



def get_tasks_by_worker(worker_id: str) -> list[dict]:
    """
    Fetch all tasks assigned to a specific worker.
    """
    tasks = list(database.collection_task.find({"assignedWorkerId": worker_id}))
    for t in tasks:
        t["id"] = str(t["_id"])
        del t["_id"]
    return tasks

from bson import ObjectId
from pydantic import BaseModel

class StatusUpdate(BaseModel):
    status: str 

from datetime import datetime
from bson import ObjectId


def updateTaskStatus(task_id: str, status: str):
    valid_status = ['pending', 'accepted', 'declined', 'cancelled', 'completed', 'in_progress']
    
    if status not in valid_status:
        raise ValueError(f"Invalid status. Must be one of: {valid_status}")

    try:
        obj_id = ObjectId(task_id)
    except Exception:
        raise ValueError("Invalid task ID format")

    task = database.collection_task.find_one({"_id": obj_id})
    if not task:
        raise ValueError("Task not found")

    update_data = {"status": status}

    if status == "completed":
        now = datetime.utcnow()
        update_data["completedAt"] = now

        # Use createdAt or serviceDate to calculate actual hours
        created_at = task.get("createdAt") or task.get("serviceDate")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))

        actual_hours = (now - created_at).total_seconds() / 3600
        update_data["actualHours"] = round(actual_hours, 2)  # Rounded to 2 decimal places

    # Update the task in one go
    result = database.collection_task.update_one(
        {"_id": obj_id},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        raise ValueError("Failed to update task status")

    return {
        "message": "Task status updated successfully",
        "task_id": str(obj_id),
        "new_status": status,
        "actualHours": update_data.get("actualHours")
    }

def get_tasks_by_worker_and_customer(worker_id: str, customer_id: str):
    tasks_cursor = database.collection_task.find(
        {"assignedWorkerId": worker_id, "userId": (customer_id)}
    )

    tasks = []
    for task in tasks_cursor:
        task["id"] = str(task["_id"])
        del task["_id"]
        tasks.append(task)

    return tasks

def update_task_offer(task_id: str, offer) -> bool:
    result = database.collection_task.find_one({"_id": ObjectId(task_id)})
    total_cost = offer.estimatedHours * result["basePrice"] + offer.additionalCost  # ← dot notation
    result = database.collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "estimatedHours": offer.estimatedHours,
            "additionalCost": offer.additionalCost,
            "totalCost": total_cost,
            "offerStatus": offer.offerStatus
        }}
    )
    return result.modified_count > 0

def get_all_tasks():
    tasks = list(database.collection_task.find({}))
    for t in tasks:
        t["id"] = str(t["_id"])
        del t["_id"]
    return tasks

def no_of_task_assigned_by_each_customer():
    pipeline = [
        {"$match": {"assignedWorkerId": {"$ne": None}}},  # Only consider tasks that have been assigned
        {"$group": {"_id": "$userId", "assignedTaskCount": {"$sum": 1}}}  # Group by userId and count tasks
    ]
    results = database.collection_task.aggregate(pipeline)
    return [{"customerId": r["_id"], "assignedTaskCount": r["assignedTaskCount"]} for r in results]