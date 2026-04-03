from fastapi import APIRouter
from datetime import datetime
from ..config.database import collection_task

router = APIRouter()

@router.get("/worker/{worker_id}/recent-payouts")
def get_recent_payouts(worker_id: str):

    # Get latest 5 tasks for this worker
    tasks = collection_task.find(
        {"assignedWorkerId": worker_id}
    ).sort("payout_at", -1).limit(5)

    payouts = []

    for task in tasks:
        payouts.append({
            "label": f"{task.get('taskName', 'Task')} – {task.get('address', 'Location')}",
            "date": (
                task.get("payout_at").strftime("%b %d, %Y")
                if task.get("payout_at") else
                task.get("createdAt").strftime("%b %d, %Y")
                if task.get("createdAt") else ""
            ),
            "amount": task.get("worker_payout", 0),
            "status": "received" if task.get("payout_status") == "paid" else "pending"
        })

    return payouts