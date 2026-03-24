"""
notifications.py — clean single file, two routers.

Add to main.py:
    from worker.routes.notifications import notifications_router, tasks_router
    app.include_router(notifications_router)
    app.include_router(tasks_router)
"""

import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId
import firebase_admin
from firebase_admin import credentials, messaging
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig

from ..config.database import collection, collection_worker, collection_notification, collection_task

# ── Firebase ──────────────────────────────────────────────────────────────────
SERVICE_ACCOUNT_PATH = os.getenv(
    "FIREBASE_SERVICE_ACCOUNT",
    os.path.join(os.path.dirname(__file__), "kaam-ly-firebase.json")
)
if not firebase_admin._apps:
    try:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
        print("[FCM] Firebase Admin SDK initialized ✓")
    except Exception as e:
        print(f"[FCM] Firebase Admin SDK init failed: {e}")

# ── Email ─────────────────────────────────────────────────────────────────────
email_conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME", "your-email@gmail.com"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD", "your-app-password"),
    MAIL_FROM=os.getenv("MAIL_FROM", "your-email@gmail.com"),
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    VALIDATE_CERTS=True,
)

# ── Schemas ───────────────────────────────────────────────────────────────────
class SaveTokenRequest(BaseModel):
    userId: str
    token:  str

class SendNotificationRequest(BaseModel):
    recipient_email: str
    title:           str
    body:            str
    click_action:    Optional[str] = "/"
    event_type:      Optional[str] = "default"
    task_id:         Optional[str] = None

class DirectNotificationRequest(BaseModel):
    token: str
    title: str
    body:  str

# ── Internal helpers ──────────────────────────────────────────────────────────

async def notify_email(to: str, title: str, body: str):
    try:
        msg = MessageSchema(
            subject=title, recipients=[to],
            body=f"""
            <div style="font-family:-apple-system,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
                <div style="background:#f6ad56;padding:16px 24px;border-radius:12px 12px 0 0;">
                    <h2 style="color:white;margin:0;">🔔 {title}</h2>
                </div>
                <div style="background:white;padding:24px;border:1px solid #e2e8f0;border-radius:0 0 12px 12px;">
                    <p style="color:#0f172a;margin:0 0 16px;">{body}</p>
                    <a href="http://localhost:5173"
                       style="display:inline-block;padding:10px 20px;background:#f6ad56;color:white;border-radius:8px;text-decoration:none;font-weight:700;">
                        Open Kaam-ly
                    </a>
                </div>
            </div>
            """,
            subtype="html"
        )
        await FastMail(email_conf).send_message(msg)
        print(f"[EMAIL] Sent ✓ to {to}")
    except Exception as e:
        print(f"[EMAIL] Failed: {e}")


def _send_fcm(token: str, title: str, body: str, data: dict = None, click_action: str = "/") -> bool:
    try:
        msg = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={"title": title, "body": body, "click_action": click_action, **(data or {})},
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    title=title, body=body,
                    icon="/icon-192.png", badge="/icon-192.png",
                ),
                fcm_options=messaging.WebpushFCMOptions(link=click_action),
            ),
            token=token,
        )
        messaging.send(msg)
        print(f"[FCM] Sent ✓ to {token[:20]}…")
        return True
    except messaging.UnregisteredError:
        print("[FCM] Stale token")
        raise
    except Exception as e:
        print(f"[FCM] Send failed: {e}")
        return False


async def notify_with_fallback(
    userId: str, title: str, body: str,
    token: str = None, email: str = None,
    data: dict = None, click_action: str = "/",
):
    # 1. Save to DB
    try:
        collection_notification.insert_one({
            "userId": userId, "title": title, "body": body,
            "read": False, "createdAt": datetime.utcnow(),
        })
    except Exception as e:
        print(f"[NOTIFY] DB save failed: {e}")

    # 2. Try FCM push
    push_ok = False
    if token:
        try:
            push_ok = _send_fcm(token, title, body, data, click_action)
        except messaging.UnregisteredError:
            collection_worker.update_one({"fcmToken": token}, {"$unset": {"fcmToken": ""}})
            collection.update_one({"fcmToken": token}, {"$unset": {"fcmToken": ""}})

    # 3. Email fallback
    if not push_ok and email:
        await notify_email(to=email, title=title, body=body)


async def _get_customer(customer_id: str):
    try:
        return collection.find_one({"_id": ObjectId(customer_id)})
    except Exception:
        return collection.find_one({"email": customer_id})


# ═══════════════════════════════════════════════════════════════════════════════
# ROUTER 1 — notifications_router  →  prefix: /api/notifications
# ═══════════════════════════════════════════════════════════════════════════════
notifications_router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@notifications_router.post("/save-token")
async def save_token(request: SaveTokenRequest):
    userId = request.userId
    token  = request.token
    now    = datetime.utcnow()

    # 1. Try worker (_id is email string)
    result = collection_worker.update_one(
        {"_id": userId},
        {"$set": {"fcmToken": token, "tokenUpdatedAt": now}}
    )
    if result.matched_count > 0:
        return {"success": True}

    # 2. Try customer by ObjectId
    try:
        result = collection.update_one(
            {"_id": ObjectId(userId)},
            {"$set": {"fcmToken": token, "tokenUpdatedAt": now}}
        )
        if result.matched_count > 0:
            return {"success": True}
    except Exception:
        pass

    # 3. Try customer by email
    result = collection.update_one(
        {"email": userId},
        {"$set": {"fcmToken": token, "tokenUpdatedAt": now}}
    )
    if result.matched_count > 0:
        return {"success": True}

    return {"success": False, "error": "User not found"}


@notifications_router.post("/send")
def send_notification(req: SendNotificationRequest):
    user = collection_worker.find_one({"email": req.recipient_email}, {"fcmToken": 1})
    if not user or not user.get("fcmToken"):
        user = collection.find_one({"email": req.recipient_email}, {"fcmToken": 1})

    if not user or not user.get("fcmToken"):
        return {"success": False, "message": "No FCM token found for user"}

    try:
        ok = _send_fcm(
            token=user["fcmToken"], title=req.title, body=req.body,
            data={"event_type": req.event_type or "default", "task_id": req.task_id or ""},
            click_action=req.click_action or "/",
        )
        return {"success": ok}
    except messaging.UnregisteredError:
        collection_worker.update_one({"email": req.recipient_email}, {"$unset": {"fcmToken": ""}})
        collection.update_one({"email": req.recipient_email}, {"$unset": {"fcmToken": ""}})
        return {"success": False, "message": "Stale token removed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@notifications_router.post("/send-direct")
async def send_direct(request: DirectNotificationRequest):
    try:
        ok = _send_fcm(request.token, request.title, request.body)
        return {"success": ok}
    except Exception as e:
        return {"success": False, "error": str(e)}


@notifications_router.get("/unread/{userId}")
async def get_unread(userId: str):
    try:
        docs = list(
            collection_notification
            .find({"userId": userId, "read": False})
            .sort("createdAt", -1)
            .limit(50)
        )
        for d in docs:
            d["_id"] = str(d["_id"])
        return {"notifications": docs}
    except Exception as e:
        return {"notifications": [], "error": str(e)}


@notifications_router.post("/mark-read/{userId}")
async def mark_read(userId: str):
    try:
        collection_notification.update_many(
            {"userId": userId, "read": False},
            {"$set": {"read": True}}
        )
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ═══════════════════════════════════════════════════════════════════════════════
# ROUTER 2 — tasks_router  →  prefix: /api/tasks
# ═══════════════════════════════════════════════════════════════════════════════
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
        {"$set": {"status": "in_progress", "startedAt": datetime.utcnow(), "startedVia": "notification_action"}}
    )

    task_name   = task.get("taskName") or task.get("taskDescrip", "your task")
    customer_id = task.get("userId")
    worker_id   = task.get("assignedWorkerId")

    if customer_id:
        customer = await _get_customer(customer_id)
        if customer:
            await notify_with_fallback(
                userId=str(customer_id), title="Work Has Started ▶",
                body=f'Your worker has started "{task_name}".',
                token=customer.get("fcmToken"), email=customer.get("email"),
                click_action="/tasks", data={"event_type": "task_started", "task_id": task_id}
            )

    if worker_id:
        worker = collection_worker.find_one({"email": worker_id})
        if worker:
            await notify_with_fallback(
                userId=worker_id, title="Task In Progress",
                body=f'You started "{task_name}". Tap to mark complete when done.',
                token=worker.get("fcmToken"), email=worker_id,
                click_action="/worker/requests",
                data={"event_type": "task_in_progress", "task_id": task_id}
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
        {"$set": {"status": "completed", "completedAt": datetime.utcnow(), "completedVia": "notification_action"}}
    )

    task_name   = task.get("taskName") or task.get("taskDescrip", "your task")
    customer_id = task.get("userId")

    if customer_id:
        customer = await _get_customer(customer_id)
        if customer:
            await notify_with_fallback(
                userId=str(customer_id), title="Task Completed ✓",
                body=f'"{task_name}" is done. Please review and release payment.',
                token=customer.get("fcmToken"), email=customer.get("email"),
                click_action="/tasks", data={"event_type": "task_completed", "task_id": task_id}
            )

    return {"success": True, "message": f'"{task_name}" marked as completed.', "task_id": task_id}


# ── Convenience trigger (import in other routers) ─────────────────────────────
def notify_task_assigned(worker_email: str, task_name: str, task_id: str):
    return send_notification(SendNotificationRequest(
        recipient_email=worker_email,
        title="New Task Request 🔔",
        body=f'You have a new task: "{task_name}". Tap to review.',
        click_action="/worker/requests",
        event_type="new_task_request",
        task_id=str(task_id),
    ))

@notifications_router.get("/{userId}")
async def get_all_notifications(userId: str):
    try:
        docs = list(
            collection_notification
            .find({"userId": userId})
            .sort("createdAt", -1)
            .limit(50)
        )
        for d in docs:
            d["_id"] = str(d["_id"])
        return {"notifications": docs}
    except Exception as e:
        return {"notifications": [], "error": str(e)}