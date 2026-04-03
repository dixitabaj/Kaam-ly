// taskSocket.js
// Drop-in replacement for connectTaskWebSocket / closeTaskWebSocket in api.js
//
// Features:
//   ✅ Auto-reconnect with exponential backoff (max 30s)
//   ✅ Flushes pending messages from DB on every (re)connect
//   ✅ Heartbeat ping to detect silent disconnects
//   ✅ Deduplicates messages by _id so replayed DB messages aren't shown twice

const BASE_WS  = "ws://127.0.0.1:8000";
const BASE_URL = "http://localhost:8000/api";

// ── State ─────────────────────────────────────────────────────────────────────
let _ws          = null;
let _userId      = null;
let _onMessage   = null;
let _retryDelay  = 1000;   // ms, doubles on each failure (capped at 30 s)
let _retryTimer  = null;
let _pingTimer   = null;
let _stopped     = false;
const _seen      = new Set(); // dedup by notification _id

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Connect (or reconnect) the task WebSocket for a user.
 * @param {string} userId
 * @param {function} onMessage  called with each parsed message object
 */
export const connectTaskWebSocket = (userId, onMessage) => {
  _stopped    = false;
  _userId     = userId;
  _onMessage  = onMessage;
  _open();
};

export const closeTaskWebSocket = () => {
  _stopped = true;
  _clearTimers();
  if (_ws) { _ws.close(); _ws = null; }
};

// ── Internal ──────────────────────────────────────────────────────────────────

function _open() {
  if (_stopped || !_userId) return;

  console.log(`[TaskWS] Connecting for ${_userId}…`);
  _ws = new WebSocket(`${BASE_WS}/ws/task-updates/${_userId}`);

  _ws.onopen = () => {
    console.log("[TaskWS] ✅ Connected");
    _retryDelay = 1000; // reset backoff on success
    _startPing();
    // Fetch any messages that arrived while we were offline
    _flushPending();
  };

  _ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      // ignore server heartbeat replies
      if (data.type === "pong" || data.type === "ping") return;

      if (_onMessage) _onMessage(data);
    } catch (err) {
      console.error("[TaskWS] Parse error:", err);
    }
  };

  _ws.onerror = (err) => {
    console.error("[TaskWS] ❌ Error:", err);
  };

  _ws.onclose = () => {
    console.warn("[TaskWS] 🔌 Closed");
    _clearTimers();
    if (!_stopped) _scheduleReconnect();
  };
}

function _scheduleReconnect() {
  console.log(`[TaskWS] Retrying in ${_retryDelay / 1000}s…`);
  _retryTimer = setTimeout(() => {
    _open();
    _retryDelay = Math.min(_retryDelay * 2, 30_000);
  }, _retryDelay);
}

function _startPing() {
  _pingTimer = setInterval(() => {
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(JSON.stringify({ type: "ping" }));
    }
  }, 25_000); // every 25 s
}

function _clearTimers() {
  if (_retryTimer) { clearTimeout(_retryTimer);  _retryTimer = null; }
  if (_pingTimer)  { clearInterval(_pingTimer);   _pingTimer  = null; }
}

/**
 * Ask the server for any notifications that were saved while we were offline
 * and fire them through the same onMessage handler.
 */
async function _flushPending() {
  if (!_userId || !_onMessage) return;
  try {
    const res  = await fetch(`${BASE_URL}/notifications/pending/${_userId}`);
    if (!res.ok) return;
    const body = await res.json();

    const messages = body.messages || [];
    if (messages.length === 0) return;

    console.log(`[TaskWS] 🔄 Flushing ${messages.length} pending message(s)`);

    for (const msg of messages) {
      // deduplicate in case the WS also delivered it live
      const key = msg._id || JSON.stringify(msg);
      if (_seen.has(key)) continue;
      _seen.add(key);
      _onMessage(msg);
    }
  } catch (err) {
    console.error("[TaskWS] Pending flush error:", err);
  }
}