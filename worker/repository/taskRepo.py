from ..config import database
from datetime import datetime, timedelta
from bson import ObjectId
from pydantic import BaseModel
from ..router import notifications

import asyncio
import traceback


# ── Serialize datetime/ObjectId fields for JSON safety ───────────────────────
def serialize_task(task: dict) -> dict:
    for key, value in list(task.items()):
        if isinstance(value, datetime):
            task[key] = value.isoformat()
        elif isinstance(value, ObjectId):
            task[key] = str(value)
    return task


async def insert_task(task: dict) -> str:
    task["createdAt"] = datetime.utcnow()
    result = database.collection_task.insert_one(task)
    task_id = str(result.inserted_id)
    print(f"[TASK] Task inserted: {task_id}")

    # ── Customer lookup — try ObjectId and email ──
    userId   = task.get("userId")
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
    worker     = database.collection_worker.find_one({"_id": assignedId})
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
            is_worker=False,  # customer
        ))

    if worker:
        notify_tasks.append(notifications.notify_with_fallback(
            userId=str(assignedId),
            title="New Task Assigned! 🎉",
            body=f"You have been assigned: '{task['taskName']}'",
            token=worker.get("fcmToken"),
            email=worker.get("email"),
            is_worker=True,   # ← FIX: tells _resolve_token to search collection_worker
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
    try:
        obj_id = ObjectId(task_id)
    except Exception:
        return None

    task = database.collection_task.find_one({"_id": obj_id})
    if task:
        task["id"] = str(task["_id"])
        del task["_id"]
        return serialize_task(task)
    return None


def get_tasks_by_user(user_id: str) -> list[dict]:
    tasks = list(database.collection_task.find({"userId": user_id}))
    result = []
    for task in tasks:
        task["id"] = str(task["_id"])
        del task["_id"]
        result.append(serialize_task(task))
    return result


def get_user_notifications(user_id: str) -> list[dict]:
    notifs = list(database.collection_task.find({"userId": user_id, "status": "pending"}))
    result = []
    for n in notifs:
        n["id"] = str(n["_id"])
        del n["_id"]
        result.append(serialize_task(n))
    return result


def assign_worker(task_id: str, worker_id: str) -> bool:
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
    tasks = list(database.collection_task.find({"assignedWorkerId": worker_id}))
    result = []
    for t in tasks:
        t["id"] = str(t["_id"])
        del t["_id"]
        result.append(serialize_task(t))
    return result


class StatusUpdate(BaseModel):
    status: str


def updateTaskStatus(task_id: str, status: str):
    valid_status = ['pending', 'accepted', 'declined', 'cancelled', 'completed', 'in_progress', 'confirmed']

    if status not in valid_status:
        raise ValueError(f"Invalid status. Must be one of: {valid_status}")

    try:
        obj_id = ObjectId(task_id)
    except Exception:
        raise ValueError("Invalid task ID format")

    task = database.collection_task.find_one({"_id": obj_id})
    if not task:
        raise ValueError("Task not found")

    # ── Guard: confirmed requires offer to be discussed first ──
    if status in ("accepted", "confirmed"):
        estimated_hours = task.get("estimatedHours")
        total_cost      = task.get("totalCost")
        if not estimated_hours or not total_cost:
            raise ValueError(
                "Cannot accept or confirm task before estimated hours and total cost have been set. "
                "Please discuss and finalize the offer first."
            )

    now         = datetime.utcnow()
    update_data = {"status": status}

    # ── Timeline timestamps ──
    status_to_field = {
        "accepted":    "acceptedAt",
        "confirmed":   "confirmedAt",
        "in_progress": "startedAt",
        "declined":    "declinedAt",
        "cancelled":   "cancelledAt",
        "completed":   "completedAt",
    }

    if status in status_to_field:
        update_data[status_to_field[status]] = now

    # ── Actual hours on completion ──
    if status == "completed":
        started_at = (
            task.get("startedAt") or
            task.get("confirmedAt") or
            task.get("createdAt") or
            task.get("serviceDate")
        )
        if isinstance(started_at, str):
            started_at = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        if started_at:
            actual_hours = (now - started_at).total_seconds() / 3600
            update_data["actualHours"] = round(actual_hours, 2)

    result = database.collection_task.update_one(
        {"_id": obj_id},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        raise ValueError("Failed to update task status")

    return {
        "message":     "Task status updated successfully",
        "task_id":     str(obj_id),
        "new_status":  status,
        "timestamp":   now.isoformat(),
        "actualHours": update_data.get("actualHours"),
    }


def get_tasks_by_worker_and_customer(worker_id: str, customer_id: str):
    tasks_cursor = database.collection_task.find(
        {"assignedWorkerId": worker_id, "userId": customer_id}
    )
    tasks = []
    for task in tasks_cursor:
        task["id"] = str(task["_id"])
        del task["_id"]
        tasks.append(serialize_task(task))
    return tasks


def update_task_offer(task_id: str, offer) -> bool:
    existing = database.collection_task.find_one({"_id": ObjectId(task_id)})
    if not existing:
        return False
    total_cost = offer.estimatedHours * existing["basePrice"] + offer.additionalCost
    result = database.collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "estimatedHours": offer.estimatedHours,
            "additionalCost": offer.additionalCost,
            "totalCost":      total_cost,
            "offerStatus":    offer.offerStatus,
        }}
    )
    return result.modified_count > 0


def get_all_tasks():
    tasks = list(database.collection_task.find({}))
    result = []
    for t in tasks:
        t["id"] = str(t["_id"])
        del t["_id"]
        result.append(serialize_task(t))
    return result


def no_of_task_assigned_by_each_customer():
    pipeline = [
        {"$match": {"assignedWorkerId": {"$ne": None}}},
        {"$group": {"_id": "$userId", "assignedTaskCount": {"$sum": 1}}}
    ]
    results = database.collection_task.aggregate(pipeline)
    return [{"customerId": r["_id"], "assignedTaskCount": r["assignedTaskCount"]} for r in results]


def auto_cancel_expired_pending_tasks() -> int:
    cutoff = datetime.utcnow() - timedelta(hours=24)
    result = database.collection_task.update_many(
        {
            "status":    "pending",
            "createdAt": {"$lt": cutoff}
        },
        {
            "$set": {
                "status":       "cancelled",
                "cancelledAt":  datetime.utcnow(),
                "cancelReason": "Auto-cancelled: no worker response within 24 hours"
            }
        }
    )
    return result.modified_count


def auto_cancel_confirmed_unpaid_tasks() -> int:
    cutoff = datetime.utcnow() - timedelta(hours=24)

    expired_tasks = list(database.collection_task.find({
        "status":      "confirmed",
        "confirmedAt": {"$lt": cutoff},
        "$or": [
            {"paymentStatus": {"$exists": False}},
            {"paymentStatus": None},
            {"paymentStatus": "unpaid"},
        ]
    }))

    if not expired_tasks:
        return 0

    task_ids   = [t["_id"] for t in expired_tasks]
    worker_ids = list({t["assignedWorkerId"] for t in expired_tasks if t.get("assignedWorkerId")})

    database.collection_task.update_many(
        {"_id": {"$in": task_ids}},
        {"$set": {
            "status":       "cancelled",
            "cancelledAt":  datetime.utcnow(),
            "cancelReason": "Auto-cancelled: payment not received within 24 hours of confirmation",
        }}
    )

    for worker_id in worker_ids:
        database.collection_worker.update_one(
            {"_id": worker_id},
            {"$set": {"isAvailable": True}}
        )

    return len(expired_tasks)

def get_task_with_customer(task_id: str):
    """Returns (task, customer) for notification purposes."""
    try:
        obj_id = ObjectId(task_id)
    except Exception:
        return None, None

    task = database.collection_task.find_one({"_id": obj_id})
    if not task:
        return None, None

    userId   = task.get("userId")
    customer = database.collection.find_one({"_id": userId})
    if not customer:
        try:
            customer = database.collection.find_one({"_id": ObjectId(str(userId))})
        except: pass
    if not customer:
        customer = database.collection.find_one({"email": userId})

    return task, customer