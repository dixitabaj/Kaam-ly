from datetime import datetime, timezone
from uuid import uuid4
from ..repository.refundRepo import create_refund, update_refund_status
from ..services.esewaService import disburse_to_worker
from ..router import notifications
from ..config import database
from bson import ObjectId
import asyncio

LATE_CANCEL_HOURS  = 4
WORKER_PENALTY_PCT = 0.25


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_service_datetime(task: dict) -> datetime | None:
    try:
        date_str = str(task.get("serviceDate", "")).split("T")[0]
        time_str = task.get("serviceTIme", "00:00")  # Note: your schema uses "serviceTIme" not "serviceTime"
        dt = datetime.fromisoformat(f"{date_str}T{time_str}:00")
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    except Exception:
        return None


def _hours_until_start(task: dict) -> float | None:
    sdt = _parse_service_datetime(task)
    return None if not sdt else (sdt - datetime.now(timezone.utc)).total_seconds() / 3600


def _resolve_user(uid):
    doc = database.collection.find_one({"_id": uid})
    if not doc:
        try: 
            doc = database.collection.find_one({"_id": ObjectId(str(uid))})
        except: 
            pass
    return doc or database.collection.find_one({"email": uid})


def _resolve_worker(wid):
    doc = database.collection_worker.find_one({"_id": wid})
    if not doc:
        try: 
            doc = database.collection_worker.find_one({"_id": ObjectId(str(wid))})
        except: 
            pass
    return doc or database.collection_worker.find_one({"email": wid})


async def _notify_both(task, title, customer_body, worker_body):
    jobs = []
    customer = _resolve_user(task.get("userId"))
    if customer:
        jobs.append(notifications.notify_with_fallback(
            userId=str(task["userId"]), title=title, body=customer_body,
            token=customer.get("fcmToken"), email=customer.get("email"), is_worker=False,
        ))
    worker = _resolve_worker(task.get("assignedWorkerId"))
    if worker:
        jobs.append(notifications.notify_with_fallback(
            userId=str(task["assignedWorkerId"]), title=title, body=worker_body,
            token=worker.get("fcmToken"), email=worker.get("email"), is_worker=True,
        ))
    if jobs:
        try: 
            await asyncio.gather(*jobs)
        except Exception as e: 
            print(f"[NOTIFY] {e}")


async def _record_worker_disbursement(
    refund_id: str,
    worker_id: str,
    esewa_id: str | None,
    amount: float,
    task_id: str,
    reason: str,
    disburse_response: dict | None = None,
):
    """
    Stores worker disbursement info directly on the refund record.
    This eliminates need for a separate worker_payouts collection.
    """
    status = "paid" if (disburse_response and disburse_response.get("status") in ("SUCCESS", "COMPLETE")) else "pending"
    if not esewa_id:
        status = "pending_manual"  # Admin must manually process

    await database.refund_collection.update_one(
        {"_id": refund_id},
        {"$set": {
            "worker_disbursement": {
                "worker_id":         str(worker_id),
                "esewa_id":          esewa_id,
                "amount":            amount,
                "reason":            reason,
                "status":            status,
                "disburse_response": disburse_response,
                "created_at":        datetime.now(timezone.utc),
                "processed_at":      datetime.now(timezone.utc) if status == "paid" else None,
            }
        }}
    )


async def _pay_worker(
    worker,
    task_id: str,
    amount: float,
    reason: str,
    refund_id: str,  # Added to link disbursement to refund record
) -> dict:
    """
    Attempts live eSewa disbursement first.
    Falls back to recording pending status on refund record if API unavailable/fails.
    Always returns a status dict so callers can log the outcome.
    """
    worker_id  = str(worker.get("_id", ""))
    esewa_id   = worker.get("esewaId") or worker.get("phone")

    if not esewa_id:
        # No eSewa ID stored on worker profile — flag for manual admin processing
        await _record_worker_disbursement(refund_id, worker_id, None, amount, task_id, reason)
        return {"method": "queued_manual", "reason": "No eSewa ID on worker profile"}

    # Attempt live disbursement
    idempotency_key  = f"cancel-{task_id}-{worker_id}"
    success, api_res = await disburse_to_worker(esewa_id, amount, reason, idempotency_key)

    if success:
        # Record it as paid immediately
        await _record_worker_disbursement(refund_id, worker_id, esewa_id, amount, task_id, reason, api_res)
        return {"method": "esewa_disburse", "success": True, "response": api_res}
    else:
        reason_code = api_res.get("reason", "")
        if reason_code == "not_enabled":
            # Enterprise API not yet configured — queue for manual processing
            await _record_worker_disbursement(refund_id, worker_id, esewa_id, amount, task_id, f"{reason} [queued: enterprise API pending]")
            return {"method": "queued_pending_agreement", "esewa_id": esewa_id}
        else:
            # API call failed (network, auth, etc.) — queue as failed for retry
            await _record_worker_disbursement(refund_id, worker_id, esewa_id, amount, task_id, f"{reason} [API error]", api_res)
            return {"method": "queued_api_error", "error": api_res}


async def _auto_refund(task, task_id, amount_customer, amount_worker, by, reason):
    doc = await create_refund({
        "task_id":         task_id,
        "requester_id":    task.get("userId"),
        "reported_id":     task.get("assignedWorkerId"),
        "requester_type":  "customer",
        "reported_type":   "worker",
        "amount_customer": amount_customer,
        "amount_worker":   amount_worker,
        "reason":          reason or f"Cancellation by {by}",
        "requested_by":    by,
    })
    return await update_refund_status(
        doc["_id"], "approved",
        admin_note=f"Auto-approved on cancellation by {by}",
    )


async def _open_dispute(task, task_id, reason):
    total = float(task.get("totalCost") or task.get("basePrice") or 0)
    return await create_refund({
        "task_id":         task_id,
        "requester_id":    task.get("userId"),
        "reported_id":     task.get("assignedWorkerId"),
        "requester_type":  "customer",
        "reported_type":   "worker",
        "amount_customer": total,
        "amount_worker":   0.0,
        "reason":          reason or "Mid-task cancellation — admin review required",
        "requested_by":    "customer",
    })


# ── Main entry point ──────────────────────────────────────────────────────────

async def process_cancellation(task_id: str, cancelled_by: str, reason: str = "") -> dict:
    try:
        obj_id = ObjectId(task_id)
    except Exception:
        return {"status": "error", "message": "Invalid task ID"}

    task = database.collection_task.find_one({"_id": obj_id})
    if not task:
        return {"status": "error", "message": "Task not found"}

    task_status    = task.get("status")
    payment_status = task.get("payment_status")  # Using your schema's field name
    total_amount   = float(task.get("totalCost") or task.get("basePrice") or 0)

    if task_status == "cancelled":
        return {"status": "error", "message": "Task already cancelled"}

    # ── Escrow released (task was completed + paid out) → no auto-refund ──────
    if payment_status == "released":
        database.collection_task.update_one({"_id": obj_id}, {"$set": {
            "status": "cancelled", "cancelledAt": datetime.now(timezone.utc),
            "cancelledBy": cancelled_by, "cancelReason": reason,
            "refundNote": "Escrow released — admin review required",
        }})
        await _notify_both(task, "Task Cancelled",
            customer_body=(
                f"Task '{task.get('taskName')}' was cancelled after payment was released. "
                "Please contact support if you believe a refund is owed."
            ),
            worker_body=f"Task '{task.get('taskName')}' was cancelled. Payment already released.",
        )
        return {"status": "cancelled", "refund_type": "none",
                "message": "Escrow already released — admin review required."}

    # ── No payment collected yet → just cancel ────────────────────────────────
    if payment_status in (None, "unpaid"):
        database.collection_task.update_one({"_id": obj_id}, {"$set": {
            "status": "cancelled", "cancelledAt": datetime.now(timezone.utc),
            "cancelledBy": cancelled_by, "cancelReason": reason,
        }})
        from ..repository.taskRepo import _unblock_calendar
        _unblock_calendar(task_id)
        await _notify_both(task, "Task Cancelled",
            customer_body=f"Task '{task.get('taskName')}' was cancelled. No payment to refund.",
            worker_body=f"Task '{task.get('taskName')}' was cancelled. No payment was collected.",
        )
        return {"status": "cancelled", "refund_type": "none", "message": "Cancelled. No payment to refund."}

    # ── payment_status == "paid" — apply refund policy ─────────────────────────
    refund_doc     = None
    worker_payout  = None
    refund_type    = "none"
    customer_body  = ""
    worker_body    = ""

    if cancelled_by == "worker":
        refund_type   = "full"
        customer_body = (
            f"Task '{task.get('taskName')}' was cancelled by your worker. "
            f"Full refund of NPR {total_amount:,.0f} is being returned to your eSewa."
        )
        worker_body = (
            f"You cancelled task '{task.get('taskName')}'. "
            "The customer will receive a full refund. A cancellation strike has been added to your profile."
        )
        database.collection_worker.update_one(
            {"_id": task.get("assignedWorkerId")},
            {"$inc": {"cancellationStrikes": 1}},
        )
        refund_doc = await _auto_refund(task, task_id, total_amount, 0.0, "worker", reason)

    elif cancelled_by == "customer":
        if task_status == "in_progress":
            refund_type   = "dispute"
            customer_body = (
                f"You cancelled '{task.get('taskName')}' mid-task. "
                "This is flagged for admin review — a decision will follow shortly."
            )
            worker_body = (
                f"Customer cancelled '{task.get('taskName')}' while you were working. "
                "An admin will review and determine your compensation."
            )
            refund_doc = await _open_dispute(task, task_id, reason)

        else:
            hours_left  = _hours_until_start(task)
            late_cancel = hours_left is not None and hours_left < LATE_CANCEL_HOURS

            if not late_cancel:
                # ≥ 4 hrs notice → full refund to customer, nothing to worker
                hrs_display = f"{hours_left:.1f}" if hours_left is not None else "sufficient"
                refund_type   = "full"
                customer_body = (
                    f"Task '{task.get('taskName')}' cancelled. "
                    f"Full refund of NPR {total_amount:,.0f} is being returned to your eSewa."
                )
                worker_body = (
                    f"Task '{task.get('taskName')}' was cancelled by the customer "
                    f"({hrs_display} hrs before start). No compensation due."
                )
                refund_doc = await _auto_refund(task, task_id, total_amount, 0.0, "customer", reason)

            else:
                # < 4 hrs notice → 75% to customer via eSewa refund, 25% to worker via disbursement
                amount_customer = round(total_amount * (1 - WORKER_PENALTY_PCT), 2)
                amount_worker   = round(total_amount * WORKER_PENALTY_PCT, 2)
                refund_type     = "partial"
                customer_body = (
                    f"Task '{task.get('taskName')}' cancelled with less than {LATE_CANCEL_HOURS}hrs notice. "
                    f"NPR {amount_customer:,.0f} is being refunded to your eSewa. "
                    f"NPR {amount_worker:,.0f} is sent to the worker as compensation."
                )
                worker_body = (
                    f"Task '{task.get('taskName')}' was cancelled with less than {LATE_CANCEL_HOURS}hrs notice. "
                    f"NPR {amount_worker:,.0f} compensation is being processed to your eSewa."
                )

                # Create refund doc first to get refund_id
                refund_doc = await _auto_refund(task, task_id, amount_customer, amount_worker, "customer", reason)
                
                # Now pay worker with refund_id
                worker = _resolve_worker(task.get("assignedWorkerId"))
                if worker:
                    worker_payout = await _pay_worker(
                        worker, task_id, amount_worker,
                        f"Late cancellation compensation — task {task_id}",
                        refund_doc["_id"]  # Link to refund record
                    )

                    # Update worker_body based on actual payout outcome
                    if worker_payout.get("method") == "esewa_disburse":
                        worker_body += " Payment sent."
                    elif worker_payout.get("method", "").startswith("queued"):
                        worker_body += " Payment is being processed and will arrive shortly."

    elif cancelled_by == "admin":
        refund_type   = "admin_full"
        customer_body = (
            f"Task '{task.get('taskName')}' was cancelled by an admin. "
            f"Full refund of NPR {total_amount:,.0f} is being returned to your eSewa."
        )
        worker_body = (
            f"Task '{task.get('taskName')}' was cancelled by an admin. "
            "The customer has been fully refunded."
        )
        refund_doc = await _auto_refund(task, task_id, total_amount, 0.0, "admin", reason)

    # ── Persist cancellation on task ──────────────────────────────────────────
    database.collection_task.update_one({"_id": obj_id}, {"$set": {
        "status":       "cancelled",
        "cancelledAt":  datetime.now(timezone.utc),
        "cancelledBy":  cancelled_by,
        "cancelReason": reason,
        "refundType":   refund_type,
    }})

    from ..repository.taskRepo import _unblock_calendar
    _unblock_calendar(task_id)

    await _notify_both(task, "Task Cancelled", customer_body=customer_body, worker_body=worker_body)

    return {
        "status":        "cancelled",
        "refund_type":   refund_type,
        "refund_doc":    refund_doc,
        "worker_payout": worker_payout,
        "message":       customer_body,
    }