from fastapi import WebSocket
from datetime import datetime

# db is injected at startup to avoid circular imports
# set it via: websocket_manager.manager.set_db(db)
_db = None


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    def set_db(self, db):
        """Call once at startup: websocket_manager.manager.set_db(db)"""
        global _db
        _db = db

    # ── Connection lifecycle ──────────────────────────────────────────────────

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        print(f"[WS] ✅ {user_id} connected ({len(self.active_connections[user_id])} sockets)")

        # Flush any messages that arrived while the user was offline
        await self._flush_pending(user_id, websocket)

    async def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active_connections:
            try:
                self.active_connections[user_id].remove(websocket)
            except ValueError:
                pass
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        print(f"[WS] ❌ {user_id} disconnected")

    # ── Send (persist-first, then push) ──────────────────────────────────────

    async def send_to_user(self, user_id: str, message: str):
        """
        1. Always persist the message to MongoDB.
        2. Try to deliver live over WebSocket.
        3. If no socket / delivery fails → message stays in DB for next flush.
        """
        msg_id = self._persist(user_id, message)

        if user_id not in self.active_connections:
            print(f"[WS] ⚠ {user_id} offline — message queued (id={msg_id})")
            return

        dead = []
        delivered = False
        for ws in list(self.active_connections[user_id]):
            try:
                await ws.send_text(message)
                delivered = True
                print(f"[WS] 📤 Delivered to {user_id}")
            except Exception as e:
                print(f"[WS] Dead socket for {user_id}: {e}")
                dead.append(ws)

        for ws in dead:
            try:
                self.active_connections[user_id].remove(ws)
            except ValueError:
                pass

        if delivered:
            self._mark_delivered(msg_id)

    # ── Flush pending on reconnect ────────────────────────────────────────────

    async def _flush_pending(self, user_id: str, websocket: WebSocket):
        if _db is None:
            return
        try:
            pending = list(
                _db.ws_message_queue.find(
                    {"userId": user_id, "delivered": False}
                ).sort("createdAt", 1)
            )
            if not pending:
                return
            print(f"[WS] 🔄 Flushing {len(pending)} queued messages to {user_id}")
            ids = []
            for doc in pending:
                try:
                    await websocket.send_text(doc["message"])
                    ids.append(doc["_id"])
                except Exception as e:
                    print(f"[WS] Flush send failed: {e}")
                    break  # socket died mid-flush — stop, leave rest in queue
            if ids:
                _db.ws_message_queue.update_many(
                    {"_id": {"$in": ids}},
                    {"$set": {"delivered": True, "deliveredAt": datetime.utcnow()}}
                )
        except Exception as e:
            print(f"[WS] Flush error: {e}")

    # ── DB helpers ────────────────────────────────────────────────────────────

    def _persist(self, user_id: str, message: str):
        if _db is None:
            return None
        try:
            result = _db.ws_message_queue.insert_one({
                "userId":    user_id,
                "message":   message,
                "delivered": False,
                "createdAt": datetime.utcnow(),
            })
            return result.inserted_id
        except Exception as e:
            print(f"[WS] Persist error: {e}")
            return None

    def _mark_delivered(self, msg_id):
        if _db is None or msg_id is None:
            return
        try:
            _db.ws_message_queue.update_one(
                {"_id": msg_id},
                {"$set": {"delivered": True, "deliveredAt": datetime.utcnow()}}
            )
        except Exception as e:
            print(f"[WS] Mark-delivered error: {e}")


manager = ConnectionManager()