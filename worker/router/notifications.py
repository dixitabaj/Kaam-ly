"""
notifications.py — fixed version.
"""

import os
import asyncio
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId
import firebase_admin
from firebase_admin import credentials, messaging

from ..config.database import (
    collection, collection_worker,
    collection_notification,
)

# ── Firebase ──────────────────────────────────────────────────────────────────
import os
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVICE_ACCOUNT_PATH = os.path.join(BASE_DIR, "kaam-ly-firebase.json")
if not firebase_admin._apps:
    try:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
        print("[FCM] Firebase Admin SDK initialized ✓")
    except Exception as e:
        print(f"[FCM] Firebase Admin SDK init failed: {e}")

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


# ═══════════════════════════════════════════════════════════════════════════════
# INTERNAL HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _resolve_token(user_id: str, is_worker: bool = False) -> tuple[Optional[str], Optional[str]]:
    """
    Try every possible lookup: string _id, ObjectId _id, email.
    Searches worker collection first if is_worker=True, then falls back to customer.
    """
    collections_to_try = (
        [collection_worker, collection] if is_worker
        else [collection, collection_worker]
    )

    for col in collections_to_try:
        # 1. string _id
        doc = col.find_one({"_id": user_id}, {"fcmToken": 1, "email": 1})
        if doc:
            token = doc.get("fcmToken")
            email = doc.get("email")
            print(f"[RESOLVE] ✓ string _id match — token={'✓' if token else '✗'}")
            return token, email

        # 2. ObjectId _id
        try:
            doc = col.find_one({"_id": ObjectId(user_id)}, {"fcmToken": 1, "email": 1})
            if doc:
                token = doc.get("fcmToken")
                email = doc.get("email")
                print(f"[RESOLVE] ✓ ObjectId match — token={'✓' if token else '✗'}")
                return token, email
        except Exception:
            pass

        # 3. email field
        doc = col.find_one({"email": user_id}, {"fcmToken": 1, "email": 1})
        if doc:
            token = doc.get("fcmToken")
            email = doc.get("email")
            print(f"[RESOLVE] ✓ email match — token={'✓' if token else '✗'}")
            return token, email

    print(f"[RESOLVE] ✗ No document found for user_id={user_id} is_worker={is_worker}")
    return None, None


def _send_fcm_sync(token: str, title: str, body: str, data: dict = None) -> bool:
    print(f"[FCM SYNC] ▶ token={token[:30]}... title={title}")
    msg = messaging.Message(
        notification=messaging.Notification(title=title, body=body),
        data={
            "title": title,
            "body":  body,
            **(data or {}),
        },
        webpush=messaging.WebpushConfig(
            notification=messaging.WebpushNotification(
                title=title,
                body=body,
                icon="/icon-192.png",
                badge="/icon-192.png",
            ),
        ),
        token=token,
    )
    try:
        result = messaging.send(msg)
        print(f"[FCM SYNC] ✅ message_id={result}")
        return True
    except messaging.UnregisteredError as e:
        print(f"[FCM SYNC] ❌ UnregisteredError (stale token): {e}")
        raise
    except Exception as e:
        print(f"[FCM SYNC] ❌ {type(e).__name__}: {e}")
        raise


async def _send_fcm(token: str, title: str, body: str, data: dict = None) -> bool:
    print(f"[FCM ASYNC] ▶ Dispatching to thread pool...")
    try:
        await asyncio.to_thread(_send_fcm_sync, token, title, body, data)
        print(f"[FCM ASYNC] ✅ success")
        return True
    except messaging.UnregisteredError:
        print("[FCM ASYNC] ❌ Stale token — re-raising")
        raise
    except Exception as e:
        print(f"[FCM ASYNC] ❌ {type(e).__name__}: {e}")
        return False


def _clear_stale_token(token: str):
    print(f"[FCM] Clearing stale token: {token[:20]}...")
    collection_worker.update_one({"fcmToken": token}, {"$unset": {"fcmToken": ""}})
    collection.update_one({"fcmToken": token}, {"$unset": {"fcmToken": ""}})


async def notify_with_fallback(
    userId: str,
    title: str,
    body: str,
    token: str = None,
    email: str = None,
    data: dict = None,
    click_action: str = "/",
    is_worker: bool = False,
):
    print(f"\n[NOTIFY] ══════════════════════════════════")
    print(f"[NOTIFY] userId    : {userId}")
    print(f"[NOTIFY] title     : {title}")
    print(f"[NOTIFY] body      : {body}")
    print(f"[NOTIFY] is_worker : {is_worker}")
    print(f"[NOTIFY] token in  : {'✓' if token else '✗'}")

    # 1. Save to DB
    try:
        collection_notification.insert_one({
            "userId": userId, "title": title, "body": body,
            "read": False, "createdAt": datetime.utcnow(),
        })
        print(f"[NOTIFY] DB save ✓")
    except Exception as e:
        print(f"[NOTIFY] DB save failed: {e}")

    # 2. Resolve token if not supplied or empty
    if not token:
        resolved_token, _ = _resolve_token(userId, is_worker=is_worker)
        token = resolved_token
        print(f"[NOTIFY] After resolve — token={'✓' if token else '✗'}")

    # 3. FCM push
    if token:
        try:
            await _send_fcm(token, title, body, data)
            print(f"[NOTIFY] ✅ FCM push sent")
        except messaging.UnregisteredError:
            _clear_stale_token(token)
            print(f"[NOTIFY] Stale token cleared")
        except Exception as e:
            print(f"[NOTIFY] ❌ FCM push failed: {e}")
    else:
        print(f"[NOTIFY] ⚠ No token — FCM push skipped")

    print(f"[NOTIFY] ══════════════════════════════════\n")


async def _get_customer(customer_id: str):
    try:
        return collection.find_one({"_id": ObjectId(customer_id)})
    except Exception:
        return collection.find_one({"email": customer_id})


# ═══════════════════════════════════════════════════════════════════════════════
# ROUTER
# ═══════════════════════════════════════════════════════════════════════════════
notifications_router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@notifications_router.post("/save-token")
async def save_token(request: SaveTokenRequest):
    userId = request.userId
    token  = request.token
    now    = datetime.utcnow()

    result = collection_worker.update_one(
        {"_id": userId},
        {"$set": {"fcmToken": token, "tokenUpdatedAt": now}},
    )
    if result.matched_count > 0:
        print(f"[TOKEN] Saved for worker _id={userId}")
        return {"success": True}

    try:
        result = collection.update_one(
            {"_id": ObjectId(userId)},
            {"$set": {"fcmToken": token, "tokenUpdatedAt": now}},
        )
        if result.matched_count > 0:
            print(f"[TOKEN] Saved for customer ObjectId={userId}")
            return {"success": True}
    except Exception:
        pass

    result = collection.update_one(
        {"email": userId},
        {"$set": {"fcmToken": token, "tokenUpdatedAt": now}},
    )
    if result.matched_count > 0:
        print(f"[TOKEN] Saved for customer email={userId}")
        return {"success": True}

    print(f"[TOKEN] ✗ User not found for userId={userId}")
    return {"success": False, "error": "User not found"}


@notifications_router.post("/send")
async def send_notification(req: SendNotificationRequest):
    token, _ = _resolve_token(req.recipient_email, is_worker=True)
    if not token:
        token, _ = _resolve_token(req.recipient_email, is_worker=False)
    if not token:
        return {"success": False, "message": "No FCM token found for user"}
    try:
        ok = await _send_fcm(
            token=token, title=req.title, body=req.body,
            data={"event_type": req.event_type or "default", "task_id": req.task_id or ""},
        )
        return {"success": ok}
    except messaging.UnregisteredError:
        _clear_stale_token(token)
        return {"success": False, "message": "Stale token removed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@notifications_router.post("/send-direct")
async def send_direct(request: DirectNotificationRequest):
    try:
        ok = await _send_fcm(request.token, request.title, request.body)
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
            {"$set": {"read": True}},
        )
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


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