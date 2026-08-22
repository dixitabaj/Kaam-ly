from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Body, HTTPException
from starlette.websockets import WebSocketClose
from ..services.auth import verify_token, get_current_user
from fastapi import Depends
from ..repository import chatRepo
import json
from ..manager import websocket_manager
from ..config import database
from bson import ObjectId

router = APIRouter(tags=["Chat"])

active_connections = {}

# -----------------------------
# HELPERS
# -----------------------------
def normalize_room(id_a: str, id_b: str) -> str:
    a, b = sorted([id_a, id_b])
    return f"{a}__{b}"

async def connect(room_id: str, websocket: WebSocket):
    await websocket.accept()
    if room_id not in active_connections:
        active_connections[room_id] = []
    active_connections[room_id].append(websocket)

def disconnect(room_id: str, websocket: WebSocket):
    if room_id in active_connections and websocket in active_connections[room_id]:
        active_connections[room_id].remove(websocket)
        if not active_connections[room_id]:
            del active_connections[room_id]

def _resolve_chat_user_name(user_id: str) -> str:
    customer = database.collection.find_one({"_id": user_id})
    if not customer:
        try:
            customer = database.collection.find_one({"_id": ObjectId(user_id)})
        except Exception:
            pass
    if not customer:
        customer = database.collection.find_one({"email": user_id})
    if customer:
        name = f"{customer.get('first_name','')} {customer.get('last_name','')}".strip()
        if name:
            return name

    worker = None
    try:
        worker = database.collection_worker.find_one({"_id": ObjectId(user_id)})
    except Exception:
        pass
    if not worker:
        worker = database.collection_worker.find_one({"email": user_id})
    if worker:
        name = f"{worker.get('firstName','')} {worker.get('lastName','')}".strip()
        if name:
            return name
    return "Someone"

# -----------------------------
# WEBSOCKET
# /ws/{sender_id}/{receiver_id}
# -----------------------------
@router.websocket("/ws/{sender_id}/{receiver_id}")
async def websocket_endpoint(websocket: WebSocket, sender_id: str, receiver_id: str):
    # Authenticate the websocket connection using JWT from header or query param
    try:
        auth_header = websocket.headers.get("authorization")
        token = None
        if auth_header and auth_header.lower().startswith("bearer "):
            token = auth_header.split(None, 1)[1]
        else:
            token = websocket.query_params.get("token")

        if not token:
            await websocket.close(code=1008)
            return

        credentials_exception = HTTPException(status_code=401, detail="Invalid or expired token")
        user = verify_token(token, credentials_exception)
        authenticated_id = str(user.get("user_id"))
    except Exception:
        await websocket.close(code=1008)
        return

    # Ensure the authenticated user matches the sender_id in the URL
    if authenticated_id != str(sender_id):
        # policy: reject connections that try to impersonate a different sender
        await websocket.close(code=1008)
        return

    # Ensure the authenticated user is a participant (sender or receiver)
    if authenticated_id not in (str(sender_id), str(receiver_id)) and user.get("user_type") != "admin":
        await websocket.close(code=1008)
        return

    room_id = normalize_room(sender_id, receiver_id)
    await connect(room_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()

            message_text = data.get("message", "")

            # Use authenticated sender id (do not trust client payload)
            saved = chatRepo.save_message(
                sender_id=authenticated_id,
                receiver_id=receiver_id,
                message=message_text,
                room_id=room_id
            )

            payload = {
                "room_id":     room_id,
                "sender_id":   authenticated_id,
                "receiver_id": receiver_id,
                "message":     message_text,
                "timestamp":   saved.get("timestamp"),
                "_id":         str(saved.get("_id", ""))
            }

            # broadcast to everyone in the room
            for conn in active_connections.get(room_id, []):
                await conn.send_json(payload)

            # ── push toast notification to receiver (separate channel) ──────
            try:
                preview = message_text if len(message_text) <= 90 else message_text[:90] + "…"
                await websocket_manager.manager.send_to_user(receiver_id, json.dumps({
                    "type":       "new_message",
                    "senderId":   authenticated_id,
                    "senderName": _resolve_chat_user_name(authenticated_id),
                    "preview":    preview,
                }))
            except Exception:
                # do not leak internals or sensitive data
                pass

    except WebSocketDisconnect:
        disconnect(room_id, websocket)
    except Exception:
        disconnect(room_id, websocket)


# -----------------------------
# GET CHAT HISTORY
# GET /chat/history/{user1}/{user2}
# -----------------------------
@router.get("/chat/history/{user1}/{user2}")
def get_chat_history(user1: str, user2: str, current_user: dict = Depends(get_current_user)):
    uid = str(current_user.get("user_id"))
    if current_user.get("user_type") != "admin" and uid not in (str(user1), str(user2)):
        raise HTTPException(status_code=403, detail="Forbidden")
    return chatRepo.get_conversation(user1, user2)


# -----------------------------
# GET INBOX (all conversations)
# GET /chat/inbox/{user_id}
# -----------------------------
@router.get("/chat/inbox/{user_id}")
def get_inbox(user_id: str, current_user: dict = Depends(get_current_user)):
    uid = str(current_user.get("user_id"))
    if current_user.get("user_type") != "admin" and uid != str(user_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    return chatRepo.get_all_conversations(user_id)


# -----------------------------
# SAVE MESSAGE (REST fallback)
# POST /chat/send
# -----------------------------
@router.post("/chat/send")
def save_chat(data: dict = Body(...), current_user: dict = Depends(get_current_user)):
    # Use authenticated user as sender regardless of client payload
    sender   = str(current_user.get("user_id"))
    receiver = data.get("receiver_id")
    message  = data.get("message")
    room_id  = normalize_room(sender, receiver)

    return chatRepo.save_message(sender, receiver, message, room_id)