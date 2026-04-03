from ..config import database
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from pydantic import BaseModel
from ..router import notifications
import os
from dotenv import load_dotenv
import asyncio
import traceback


# ── Time helpers ──────────────────────────────────────────────────────────────

def _to_mins(t: str) -> int:
    h, m = t.strip().split(":")
    return int(h) * 60 + int(m)

def _to_str(mins: int) -> str:
    return f"{mins // 60:02d}:{mins % 60:02d}"

def _add_hours(time_str: str, hours: float) -> str:
    return _to_str(_to_mins(time_str) + int(hours * 60))


# ── Worker resolver ───────────────────────────────────────────────────────────

def _get_worker_by_id(worker_id: str) -> dict | None:
    worker = None
    try:
        worker = database.collection_worker.find_one({"_id": ObjectId(worker_id)})
    except Exception:
        pass
    if not worker:
        worker = database.collection_worker.find_one({"email": worker_id})
    return worker


# ── Calendar block / unblock ──────────────────────────────────────────────────

def _block_calendar(worker: dict, date_str: str, service_time: str, hours: float, task_id: str):
    """Insert a new calendar booking record for this task."""
    resolved_id = str(worker["_id"])
    block_end   = _add_hours(service_time, hours)

    database.worker_calendar.insert_one({
        "workerId":  resolved_id,
        "date":      date_str,
        "taskId":    task_id,
        "slot": {
            "start": service_time,
            "end":   block_end,
        },
        "status":    "confirmed",
        "createdAt": datetime.now(timezone.utc),
    })
    print(f"[CALENDAR] Booked {resolved_id} on {date_str}: {service_time} → {block_end} (task: {task_id})")


def _unblock_calendar(task_id: str):
    """Delete the calendar booking record for this task."""
    result = database.worker_calendar.delete_one({"taskId": task_id})
    print(f"[CALENDAR] Unblocked task {task_id} — deleted: {result.deleted_count}")


# ── Serialize datetime/ObjectId fields for JSON safety ───────────────────────

def serialize_task(task: dict) -> dict:
    for key, value in list(task.items()):
        if isinstance(value, datetime):
            task[key] = value.isoformat()
        elif isinstance(value, ObjectId):
            task[key] = str(value)
    return task


# ── Task CRUD ─────────────────────────────────────────────────────────────────

async def insert_task(task: dict) -> str:
    task["createdAt"] = datetime.now(timezone.utc)
    result  = database.collection_task.insert_one(task)
    task_id = str(result.inserted_id)
    print(f"[TASK] Task inserted: {task_id}")
 
    userId     = task.get("userId")
    assignedId = task.get("assignedWorkerId")
 
    customer = database.collection.find_one({"_id": userId})
    if not customer:
        try:
            customer = database.collection.find_one({"_id": ObjectId(userId)})
        except: pass
    if not customer:
        customer = database.collection.find_one({"email": userId})
    print(f"[NOTIFY] Customer found: {customer is not None}")
 
    worker = database.collection_worker.find_one({"_id": assignedId})
    if not worker:
        try:
            worker = database.collection_worker.find_one({"_id": ObjectId(assignedId)})
        except: pass
    if not worker:
        worker = database.collection_worker.find_one({"email": assignedId})
    print(f"[NOTIFY] Worker found: {worker is not None}")
 
    notify_tasks = []
 
    if customer:
        notify_tasks.append(notifications.notify_with_fallback(
            userId=str(userId),
            title="Task Created! 📋",
            body=f"Your task '{task['taskName']}' has been created and is pending confirmation.",
            token=customer.get("fcmToken"),
            email=customer.get("email"),
            is_worker=False,
            data={
                "event_type": "task_created",
                "task_id":    task_id,
                "taskName":   task["taskName"],
            },
        ))
 
    if worker:
        notify_tasks.append(notifications.notify_with_fallback(
            userId=str(assignedId),
            title="New Task Assigned! 🎉",
            body=f"You have been assigned: '{task['taskName']}'",
            token=worker.get("fcmToken"),
            email=worker.get("email"),
            is_worker=True,
            data={
                "event_type": "new_task",               # ← SW uses this to show correct notification
                "task_id":    task_id,
                "taskName":   task["taskName"],
                "taskType":   task.get("taskType", ""),
                "address":    task.get("address", ""),
                "serviceDate": str(task.get("serviceDate", "")),
                "serviceTime": str(task.get("serviceTime", "")),
            },
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

    if status in ("accepted", "confirmed"):
        if not task.get("estimatedHours") or not task.get("totalCost"):
            raise ValueError(
                "Cannot confirm task before estimated hours and total cost are set. "
                "Please finalize the offer first."
            )

    now = datetime.now(timezone.utc)
    update_data = {"status": status}
    started_at = None;

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
    if status == "in_progress":
        payment_status = (task.get("paymentStatus") or task.get("payment_status") or "").lower()
        escrow_status  = (task.get("escrow_status") or "").lower()
        is_paid = payment_status == "paid" or escrow_status in ("paid", "escrowed", "held")
        if not is_paid:
            raise ValueError("Payment not received yet. Customer must pay before work can begin.")
    if status == "completed":
        started_at = (
            task.get("startedAt") or task.get("confirmedAt") or
            task.get("createdAt") or task.get("serviceDate")
        )
    if isinstance(started_at, str):
        started_at = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
    
    # ✅ Add this: normalize naive datetimes from MongoDB
    if started_at and started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)

    if started_at:
        update_data["actualHours"] = round((now - started_at).total_seconds() / 3600, 2)
    # ── Calendar operations ───────────────────────────────────────────────────
    worker_id    = task.get("assignedWorkerId")
    service_date = task.get("serviceDate")
    service_time = task.get("serviceTime")
    hours        = task.get("estimatedHours")
    date_str     = str(service_date).split("T")[0] if service_date else None

    if worker_id and date_str and service_time and hours:
        worker = _get_worker_by_id(worker_id)
        if worker:
            try:
                if status == "confirmed":
                    _block_calendar(worker, date_str, service_time, hours, str(obj_id))

                elif status in ("cancelled", "declined"):
                    _unblock_calendar(str(obj_id))

            except Exception as e:
                print(f"[CALENDAR ERROR] {e}")
                traceback.print_exc()
        else:
            print(f"[CALENDAR] Worker not found for id: {worker_id}")
    else:
        print(f"[CALENDAR] Skipped — missing fields (worker={worker_id} date={date_str} time={service_time} hours={hours})")

    # ── Persist status update ─────────────────────────────────────────────────
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
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    result = database.collection_task.update_many(
        {"status": "pending", "createdAt": {"$lt": cutoff}},
        {"$set": {
            "status":       "cancelled",
            "cancelledAt":  datetime.now(timezone.utc),
            "cancelReason": "Auto-cancelled: no worker response within 24 hours",
        }}
    )
    return result.modified_count


def auto_cancel_confirmed_unpaid_tasks() -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

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

    # Unblock calendar for each expired task
    for t in expired_tasks:
        try:
            _unblock_calendar(str(t["_id"]))
        except Exception as e:
            print(f"[CALENDAR RESTORE ERROR] {e}")

    database.collection_task.update_many(
        {"_id": {"$in": task_ids}},
        {"$set": {
            "status":       "cancelled",
            "cancelledAt":  datetime.now(timezone.utc),
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

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))
 
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
LOGIN        = os.getenv("SMTP_LOGIN")
PASSWORD     = os.getenv("SMTP_PASSWORD")
SMTP_SERVER  = os.getenv("SMTP_SERVER", "smtp.gmail.com")
PORT         = int(os.getenv("SMTP_PORT", "587"))
 
 
def _send_email(to: str, subject: str, html: str):
    msg = MIMEMultipart("alternative")
    msg["From"]    = SENDER_EMAIL
    msg["To"]      = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html, "html"))
    try:
        server = smtplib.SMTP(SMTP_SERVER, PORT)
        server.starttls()
        server.login(LOGIN, PASSWORD)
        server.sendmail(SENDER_EMAIL, to, msg.as_string())
        server.quit()
        print(f"[auto_release] ✉ Sent '{subject}' → {to}")
    except Exception as e:
        print(f"[auto_release] ✗ Email failed to {to}: {e}")
 
 
def send_warning_email(customer_email: str, customer_name: str,
                       task_name: str, task_id: str):
    """Sent at T+24h — warns payment releases in 24 more hours."""
    subject = "⏰ Your payment will be auto-released in 24 hours"
    html = f"""
    <html>
      <body style="margin:0;padding:32px;background:#f9f6ef;
                   font-family:'Segoe UI',Arial,sans-serif;">
        <div style="max-width:520px;margin:0 auto;background:white;
                    border-radius:16px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <div style="background:linear-gradient(135deg,#f6a623,#e8890c);
                      padding:28px 32px;">
            <h1 style="margin:0;color:white;font-size:20px;font-weight:800;
                       letter-spacing:-0.02em;">⏰ Auto-Release Reminder</h1>
          </div>
          <div style="padding:28px 32px;">
            <p style="color:#1c1008;font-size:15px;margin:0 0 16px;">
              Hi <strong>{customer_name}</strong>,
            </p>
            <p style="color:#57534e;font-size:14px;line-height:1.75;margin:0 0 20px;">
              Your task <strong>"{task_name}"</strong> was marked as completed
              <strong>24 hours ago</strong>. The payment held in escrow will be
              <strong>automatically released to your worker in 24 hours</strong>
              if no action is taken.
            </p>
            <div style="background:#fff7ed;border:1px solid #fed7aa;
                        border-radius:12px;padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0 0 8px;font-size:13px;color:#c2410c;font-weight:700;">
                What can you do before the 48-hour mark?
              </p>
              <ul style="margin:0;padding-left:18px;color:#92400e;
                         font-size:13px;line-height:1.9;">
                <li>✅ <strong>Happy with the work?</strong> — Release payment manually now.</li>
                <li>⚠️ <strong>Have concerns?</strong> — Raise a dispute from your task dashboard.</li>
                <li>⏳ <strong>No action?</strong> — Payment auto-releases after 48 hours.</li>
              </ul>
            </div>
            <p style="color:#a8a29e;font-size:12px;margin:0;">
              Task ID:&nbsp;
              <code style="background:#f5efe6;padding:2px 8px;
                           border-radius:4px;font-size:11px;">{task_id}</code>
            </p>
          </div>
          <div style="background:#faf7f2;padding:14px 32px;
                      border-top:1px solid #f0ebe2;text-align:center;">
            <p style="margin:0;font-size:11px;color:#a8a29e;">
              This is an automated message — please do not reply.
            </p>
          </div>
        </div>
      </body>
    </html>
    """
    _send_email(customer_email, subject, html)
 
 
def send_released_email(customer_email: str, customer_name: str,
                        task_name: str, amount: float, task_id: str):
    """Sent at T+48h — confirms the payment was auto-released."""
    subject = "✅ Payment auto-released to your worker"
    html = f"""
    <html>
      <body style="margin:0;padding:32px;background:#f9f6ef;
                   font-family:'Segoe UI',Arial,sans-serif;">
        <div style="max-width:520px;margin:0 auto;background:white;
                    border-radius:16px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <div style="background:linear-gradient(135deg,#059669,#047857);
                      padding:28px 32px;">
            <h1 style="margin:0;color:white;font-size:20px;font-weight:800;
                       letter-spacing:-0.02em;">✅ Payment Released</h1>
          </div>
          <div style="padding:28px 32px;">
            <p style="color:#1c1008;font-size:15px;margin:0 0 16px;">
              Hi <strong>{customer_name}</strong>,
            </p>
            <p style="color:#57534e;font-size:14px;line-height:1.75;margin:0 0 20px;">
              The escrow payment for <strong>"{task_name}"</strong> has been
              <strong>automatically released</strong> to your worker after 48 hours
              of task completion.
            </p>
            <div style="background:#f0fdf4;border:1px solid #a7f3d0;
                        border-radius:12px;padding:18px 24px;margin-bottom:24px;">
              <span style="font-size:13px;font-weight:700;color:#065f46;">
                Amount Released:
              </span>
              <span style="font-size:20px;font-weight:900;color:#059669;margin-left:12px;">
                NPR {amount:,.2f}
              </span>
            </div>
            <p style="color:#57534e;font-size:14px;line-height:1.75;margin:0 0 20px;">
              We hope you had a great experience. You can still
              <strong>leave a review</strong> for your worker from your task dashboard.
            </p>
            <p style="color:#a8a29e;font-size:12px;margin:0;">
              Task ID:&nbsp;
              <code style="background:#f5efe6;padding:2px 8px;
                           border-radius:4px;font-size:11px;">{task_id}</code>
            </p>
          </div>
          <div style="background:#faf7f2;padding:14px 32px;
                      border-top:1px solid #f0ebe2;text-align:center;">
            <p style="margin:0;font-size:11px;color:#a8a29e;">
              This is an automated message — please do not reply.
            </p>
          </div>
        </div>
      </body>
    </html>
    """
    _send_email(customer_email, subject, html)
 
 
# ── Scheduler job (sync PyMongo — no await) ───────────────────────────────────
 

def _run_async(coro):
    """
    Run an async coroutine from a sync context (the APScheduler job).
    Creates a fresh event loop so it never conflicts with FastAPI's loop.
    """
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(coro)
    finally:
        loop.close()
 
 
async def _notify_both(
    customer_id: str | None,
    customer_token: str | None,
    customer_email_addr: str | None,
    worker_id: str | None,
    worker_token: str | None,
    worker_email_addr: str | None,
    customer_title: str,
    customer_body: str,
    worker_title: str,
    worker_body: str,
    task_id: str,
    task_name: str,
    total_cost: float,
    event_type: str,
):
    """Async helper — sends FCM push to customer + worker concurrently."""
    from ..router import notifications   # local import to avoid circular at module level
 
    notify_tasks = []
 
    if customer_id and (customer_token or customer_email_addr):
        notify_tasks.append(
            notifications.notify_with_fallback(
                userId   = str(customer_id),
                title    = customer_title,
                body     = customer_body,
                token    = customer_token,
                email    = customer_email_addr,
                is_worker= False,
                data     = {
                    "event_type": event_type,
                    "task_id":    task_id,
                    "taskName":   task_name,
                    "totalCost":  str(total_cost),
                },
            )
        )
 
    if worker_id and (worker_token or worker_email_addr):
        notify_tasks.append(
            notifications.notify_with_fallback(
                userId   = str(worker_id),
                title    = worker_title,
                body     = worker_body,
                token    = worker_token,
                email    = worker_email_addr,
                is_worker= True,
                data     = {
                    "event_type": event_type,
                    "task_id":    task_id,
                    "taskName":   task_name,
                    "totalCost":  str(total_cost),
                },
            )
        )
 
    if notify_tasks:
        import asyncio
        await asyncio.gather(*notify_tasks, return_exceptions=True)
 
 
def auto_release_job():
    """
    Runs every hour via APScheduler.
    - T+24h since completedAt → FCM push warning to customer + worker (once)
    - T+48h since completedAt → release escrow + FCM push to both + emails
    """
    now = datetime.now(timezone.utc)
    print(f"[auto_release] Job running at {now.isoformat()}")
 
    try:
        tasks = list(database.collection_task.find({
            "status":        "completed",
            "escrow_status": {"$ne": "released"},
            "completedAt":   {"$exists": True, "$ne": None},
        }))
    except Exception as e:
        print(f"[auto_release] DB error: {e}")
        return
 
    for task in tasks:
        task_id    = str(task["_id"])
        task_name  = task.get("taskName") or task.get("taskDescrip") or "Your Task"
        total_cost = float(task.get("totalCost") or 0)
        user_id    = task.get("userId")
        worker_id  = task.get("assignedWorkerId")
 
        # --- Parse completedAt ---
        completed_at = task.get("completedAt")
        if not completed_at:
            continue
        if isinstance(completed_at, str):
            try:
                completed_at = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
            except ValueError:
                continue
        if completed_at.tzinfo is None:
            completed_at = completed_at.replace(tzinfo=timezone.utc)
 
        hours_since = (now - completed_at).total_seconds() / 3600
 
        # --- Fetch customer ---
        customer       = None
        customer_email = None
        customer_token = None
        customer_name  = "Customer"
        if user_id:
            try:
                customer = database.collection.find_one({"_id": ObjectId(str(user_id))})
            except Exception:
                pass
            if not customer:
                customer = database.collection.find_one({"_id": user_id})
            if not customer:
                customer = database.collection.find_one({"email": user_id})
            if customer:
                customer_email = customer.get("email")
                customer_token = customer.get("fcmToken")
                first = customer.get("firstName") or customer.get("first_name") or ""
                last  = customer.get("lastName")  or customer.get("last_name")  or ""
                customer_name = f"{first} {last}".strip() or "Customer"
 
        # --- Fetch worker ---
        worker       = None
        worker_email = None
        worker_token = None
        worker_name  = "Worker"
        if worker_id:
            worker = _get_worker_by_id(str(worker_id))
            if worker:
                worker_email = worker.get("email")
                worker_token = worker.get("fcmToken")
                first = worker.get("firstName") or worker.get("first_name") or ""
                last  = worker.get("lastName")  or worker.get("last_name")  or ""
                worker_name = f"{first} {last}".strip() or "Worker"
 
        # ── T+48h → Auto-release ──────────────────────────────────────────────
        if hours_since >= 48:
            try:
                database.collection_task.update_one(
                    {"_id": task["_id"]},
                    {"$set": {
                        "escrow_status": "released",
                        "releasedAt":    now.isoformat(),
                        "auto_released": True,
                    }}
                )
                print(f"[auto_release] Released task {task_id} ({hours_since:.1f}h since completion)")
 
                # FCM push → customer + worker
                _run_async(_notify_both(
                    customer_id          = str(user_id) if user_id else None,
                    customer_token       = customer_token,
                    customer_email_addr  = customer_email,
                    worker_id            = str(worker_id) if worker_id else None,
                    worker_token         = worker_token,
                    worker_email_addr    = worker_email,
                    customer_title       = "Payment Released ✅",
                    customer_body        = f"Payment for '{task_name}' has been auto-released to your worker.",
                    worker_title         = "Payment Received! 💰",
                    worker_body          = f"NPR {total_cost:,.2f} for '{task_name}' has been released to you.",
                    task_id              = task_id,
                    task_name            = task_name,
                    total_cost           = total_cost,
                    event_type           = "payment_released",
                ))
 
                # Email → customer only
                if customer_email:
                    send_released_email(customer_email, customer_name,
                                        task_name, total_cost, task_id)
 
            except Exception as e:
                print(f"[auto_release] Release failed for {task_id}: {e}")
 
        # ── T+24h → Warning push + email (only once) ─────────────────────────
        elif hours_since >= 24 and not task.get("warning_email_sent"):
            try:
                database.collection_task.update_one(
                    {"_id": task["_id"]},
                    {"$set": {"warning_email_sent": True}}
                )
                print(f"[auto_release] Warning for task {task_id} ({hours_since:.1f}h since completion)")
 
                # FCM push → customer + worker
                _run_async(_notify_both(
                    customer_id          = str(user_id) if user_id else None,
                    customer_token       = customer_token,
                    customer_email_addr  = customer_email,
                    worker_id            = str(worker_id) if worker_id else None,
                    worker_token         = worker_token,
                    worker_email_addr    = worker_email,
                    customer_title       = "⏰ Payment Auto-Release in 24h",
                    customer_body        = f"Payment for '{task_name}' will be auto-released in 24 hours if no action is taken.",
                    worker_title         = "⏰ Payment Releasing Soon",
                    worker_body          = f"Payment for '{task_name}' will be auto-released to you in 24 hours.",
                    task_id              = task_id,
                    task_name            = task_name,
                    total_cost           = total_cost,
                    event_type           = "payment_reminder",
                ))
 
                # Email → customer only
                if customer_email:
                    send_warning_email(customer_email, customer_name,
                                       task_name, task_id)
 
            except Exception as e:
                print(f"[auto_release] Warning failed for {task_id}: {e}")
 
 