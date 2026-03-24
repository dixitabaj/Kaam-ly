import time
from ..config.database import chat_collection


def save_message(
    sender_id: str,
    receiver_id: str,
    message: str,
    room_id: str
):
    chat = {
        "room_id":     room_id,
        "sender_id":   sender_id,
        "receiver_id": receiver_id,
        "message":     message,
        "timestamp":   time.time(),
        "read":        False
    }
    chat_collection.insert_one(chat)
    chat["_id"] = str(chat["_id"])
    return chat


def get_conversation(user1: str, user2: str):
    """Fetch all messages between two users."""
    a, b = sorted([user1, user2])
    room_id = f"{a}__{b}"

    chats = chat_collection.find(
        {"room_id": room_id}
    ).sort("timestamp", 1)

    result = []
    for chat in chats:
        chat["_id"] = str(chat["_id"])
        result.append(chat)

    return result


def get_all_conversations(user_id: str):
    """
    Fetch inbox — one entry per unique room,
    showing the other participant and last message.
    """
    chats = chat_collection.find({
        "$or": [
            {"sender_id": user_id},
            {"receiver_id": user_id}
        ]
    }).sort("timestamp", -1)  # newest first

    conversations = {}
    for chat in chats:
        room_id = chat.get("room_id", "")
        if not room_id:
            continue

        # only store the first (latest) message per room
        if room_id not in conversations:
            other = chat["receiver_id"] if chat["sender_id"] == user_id else chat["sender_id"]
            conversations[room_id] = {
                "room_id":      room_id,
                "other_user":   other,
                "last_message": chat["message"],
                "last_time":    chat["timestamp"],
                "read":         chat.get("read", False)
            }

    return list(conversations.values())