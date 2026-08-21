from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Body
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
async def websocket_endpoint(
    websocket: WebSocket,
    sender_id: str,
    receiver_id: str
):
    room_id = normalize_room(sender_id, receiver_id)
    await connect(room_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()

            message_text = data.get("message", "")

            saved = chatRepo.save_message(
                sender_id=sender_id,
                receiver_id=receiver_id,
                message=message_text,
                room_id=room_id
            )

            payload = {
                "room_id":     room_id,
                "sender_id":   sender_id,
                "receiver_id": receiver_id,
                "message":     message_text,
                "timestamp":   saved["timestamp"],
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
                    "senderId":   sender_id,
                    "senderName": _resolve_chat_user_name(sender_id),
                    "preview":    preview,
                }))
            except Exception as e:
                print(f"[CHAT] push to task-updates failed: {e}")

    except WebSocketDisconnect:
        disconnect(room_id, websocket)
    except Exception as e:
        print(f"WS error: {e}")
        disconnect(room_id, websocket)


# -----------------------------
# GET CHAT HISTORY
# GET /chat/history/{user1}/{user2}
# -----------------------------
@router.get("/chat/history/{user1}/{user2}")
def get_chat_history(user1: str, user2: str):
    return chatRepo.get_conversation(user1, user2)


# -----------------------------
# GET INBOX (all conversations)
# GET /chat/inbox/{user_id}
# -----------------------------
@router.get("/chat/inbox/{user_id}")
def get_inbox(user_id: str):
    return chatRepo.get_all_conversations(user_id)


# -----------------------------
# SAVE MESSAGE (REST fallback)
# POST /chat/send
# -----------------------------
@router.post("/chat/send")
def save_chat(data: dict = Body(...)):
    sender   = data["sender_id"]
    receiver = data["receiver_id"]
    message  = data["message"]
    room_id  = normalize_room(sender, receiver)

    return chatRepo.save_message(sender, receiver, message, room_id)