import React, { useEffect, useRef, useState } from "react";
import {
  Search, Send, Smile, Paperclip, Image, Mic,
  Info, MoreVertical, Star, Briefcase,
  MapPin, Calendar, DollarSign, CheckCircle2
} from "lucide-react";

/* ─────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────── */
const getRoomId = (u1, u2) => [u1, u2].sort().join("_");

const Avatar = ({ name = "?", size = 40, color }) => {
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
  const bg = color || "#f97316";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 700, fontSize: size * 0.36,
      flexShrink: 0,
      boxShadow: `0 2px 8px ${bg}66`,
    }}>
      {initials}
    </div>
  );
};

const AVATAR_COLORS = ["#f97316", "#10b981", "#6366f1", "#e11d48", "#0ea5e9", "#8b5cf6"];
const getColor = (name) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

const StatusBadge = ({ status }) => {
  const map = {
    "In Progress": { bg: "#fef3c7", color: "#d97706" },
    Pending:       { bg: "#eff6ff", color: "#3b82f6" },
    Accepted:      { bg: "#ecfdf5", color: "#059669" },
    Completed:     { bg: "#f3f4f6", color: "#6b7280" },
  };
  const s = map[status] || map["Pending"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: s.bg, color: s.color,
      padding: "3px 10px", borderRadius: 20,
      fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, display: "inline-block" }} />
      {status}
    </span>
  );
};

/* ─────────────────────────────────────────────
   CONVERSATION SIDEBAR ITEM
───────────────────────────────────────────── */
const ConvItem = ({ conv, active, onClick }) => (
  <div
    onClick={onClick}
    style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "11px 16px", cursor: "pointer",
      borderLeft: `3px solid ${active ? "#f97316" : "transparent"}`,
      background: active ? "#fff7f0" : "transparent",
      transition: "background 0.15s",
    }}
    onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#faf9f7"; }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
  >
    <Avatar name={conv.contact.name} size={44} color={getColor(conv.contact.name)} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1814", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {conv.contact.name}
      </div>
      <div style={{ fontSize: 12.5, color: "#8a8783", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>
        {conv.lastMessage || "No messages yet"}
      </div>
    </div>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
      <span style={{ fontSize: 11, color: "#a09e9a" }}>{conv.time}</span>
      {conv.unread > 0 && (
        <span style={{
          width: 18, height: 18, background: "#f97316", borderRadius: "50%",
          fontSize: 10, fontWeight: 700, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{conv.unread}</span>
      )}
    </div>
  </div>
);

/* ─────────────────────────────────────────────
   MAIN COMPONENT
   Props:
     currentUserId  – logged-in user ID (string)
     conversations  – array of:
       {
         id: string,
         contact: { id: string, name: string },
         lastMessage?: string,
         time?: string,
         unread?: number,
         task?: {
           title, status, description, date, budget,
           location, category, workerRating, workerJobs
         }
       }
───────────────────────────────────────────── */
export default function ChatPage({ currentUserId, conversations: convsProp = [] }) {
  const [conversations, setConversations] = useState(convsProp);
  const [messages, setMessages]           = useState({});
  const [activeId, setActiveId]           = useState(null);
  const [activeTab, setActiveTab]         = useState("chat");
  const [text, setText]                   = useState("");
  const [search, setSearch]               = useState("");
  const wsRefs    = useRef({});
  const bottomRef = useRef(null);

  const active         = conversations.find(c => c.id === activeId) || null;
  const activeMessages = messages[activeId] || [];

  /* ── Open WebSocket ── */
  const openWs = (conv) => {
    const cid = conv.id;
    if (wsRefs.current[cid]) return;

    const roomId = getRoomId(currentUserId, conv.contact.id);
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${roomId}`);

    ws.onopen = () => console.log(`✅ WS open: ${roomId}`);

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (
        (msg.sender_id === currentUserId   && msg.receiver_id === conv.contact.id) ||
        (msg.sender_id === conv.contact.id && msg.receiver_id === currentUserId)
      ) {
        setMessages(prev => {
          const existing = prev[cid] || [];
          const dup = existing.some(
            m => m.sender_id === msg.sender_id &&
                 m.receiver_id === msg.receiver_id &&
                 m.message === msg.message &&
                 m.timestamp === msg.timestamp
          );
          if (dup) return prev;
          setConversations(cs => cs.map(c =>
            c.id === cid
              ? { ...c, lastMessage: msg.message, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }
              : c
          ));
          return { ...prev, [cid]: [...existing, msg] };
        });
      }
    };

    ws.onerror = err => console.error("❌ WS error:", err);
    ws.onclose = ()  => console.log(`🔌 WS closed: ${roomId}`);
    wsRefs.current[cid] = ws;
  };

  /* ── Load history when switching conversation ── */
  useEffect(() => {
    if (!activeId || !active || !currentUserId) return;

    if (!messages[activeId]) {
      fetch(`http://127.0.0.1:8000/chat/history/${currentUserId}/${active.contact.id}`)
        .then(r => r.json())
        .then(data => setMessages(prev => ({ ...prev, [activeId]: data || [] })))
        .catch(err => console.error("History error:", err));
    }

    openWs(active);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages, activeTab]);

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => Object.values(wsRefs.current).forEach(ws => ws?.close());
  }, []);

  /* ── Send message ── */
  const sendMessage = () => {
    if (!text.trim() || !active) return;
    const ws = wsRefs.current[activeId];
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        sender_id: currentUserId,
        receiver_id: active.contact.id,
        message: text.trim(),
      }));
    } else {
      console.error("❌ WS not connected");
    }
    setText("");
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const filtered = conversations.filter(c =>
    c.contact.name.toLowerCase().includes(search.toLowerCase())
  );

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Lora:wght@500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .cr-root {
          display: flex;
          height: 100vh;
          background: #f7f5f2;
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          overflow: hidden;
        }

        /* ── SIDEBAR ── */
        .cr-sidebar {
          width: 310px;
          flex-shrink: 0;
          background: #ffffff;
          border-right: 1px solid #ede9e3;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .cr-sidebar-header {
          padding: 20px 16px 14px;
          border-bottom: 1px solid #ede9e3;
        }
        .cr-sidebar-title {
          font-family: 'Lora', serif;
          font-size: 22px;
          font-weight: 600;
          color: #1a1814;
          margin-bottom: 14px;
        }
        .cr-search { position: relative; }
        .cr-search svg {
          position: absolute; left: 11px; top: 50%;
          transform: translateY(-50%); color: #a09e9a; pointer-events: none;
        }
        .cr-search input {
          width: 100%;
          padding: 9px 12px 9px 36px;
          background: #faf9f7;
          border: 1.5px solid #ede9e3;
          border-radius: 22px;
          font-size: 13.5px; color: #1a1814;
          outline: none; font-family: inherit;
          transition: border-color 0.15s;
        }
        .cr-search input:focus { border-color: #f97316; }
        .cr-search input::placeholder { color: #b5b2ae; }

        .cr-conv-list { flex: 1; overflow-y: auto; padding: 6px 0; }
        .cr-empty-list {
          padding: 32px 16px; text-align: center;
          color: #a09e9a; font-size: 13px;
        }

        /* ── MAIN PANEL ── */
        .cr-main {
          flex: 1; display: flex; flex-direction: column;
          min-width: 0; overflow: hidden;
        }

        /* top bar */
        .cr-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 20px;
          background: #ffffff; border-bottom: 1px solid #ede9e3;
          flex-shrink: 0;
        }
        .cr-topbar-left { display: flex; align-items: center; gap: 12px; }
        .cr-topbar-name { font-size: 15px; font-weight: 700; color: #1a1814; font-family: 'Lora', serif; }
        .cr-topbar-sub  { font-size: 11px; color: #10b981; margin-top: 1px; font-weight: 500; }
        .cr-topbar-actions { display: flex; gap: 4px; }
        .cr-icon-btn {
          width: 36px; height: 36px; border-radius: 50%;
          background: #f7f5f2; border: none; color: #6b6966;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s;
        }
        .cr-icon-btn:hover { background: #ede9e3; color: #1a1814; }

        /* tabs */
        .cr-tabs {
          display: flex; background: #ffffff;
          border-bottom: 1px solid #ede9e3;
          padding: 0 20px; flex-shrink: 0;
        }
        .cr-tab {
          padding: 12px 20px; font-size: 13.5px; font-weight: 600;
          color: #8a8783; background: none; border: none;
          border-bottom: 2.5px solid transparent;
          cursor: pointer; font-family: inherit;
          transition: color 0.15s, border-color 0.15s;
        }
        .cr-tab.active { color: #f97316; border-bottom-color: #f97316; }

        /* ── MESSAGES ── */
        .cr-messages {
          flex: 1; overflow-y: auto; padding: 20px 20px 16px;
          display: flex; flex-direction: column; gap: 4px;
          background: #f7f5f2;
        }
        .cr-empty-chat {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 12px;
          color: #a09e9a; font-size: 14px;
        }
        .cr-empty-chat-icon {
          width: 64px; height: 64px; border-radius: 50%;
          background: #ede9e3;
          display: flex; align-items: center; justify-content: center; font-size: 28px;
        }
        .cr-empty-chat h3 { font-size: 17px; font-weight: 700; color: #3d3b38; font-family: 'Lora', serif; }

        .cr-msg-row {
          display: flex; align-items: flex-end; gap: 8px;
          max-width: 70%;
          animation: cr-fade 0.18s ease;
        }
        .cr-msg-row.sent     { align-self: flex-end; flex-direction: row-reverse; }
        .cr-msg-row.received { align-self: flex-start; }
        @keyframes cr-fade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .cr-bubble {
          padding: 10px 14px; border-radius: 18px;
          font-size: 14px; line-height: 1.45;
          word-wrap: break-word; max-width: 100%;
        }
        .cr-msg-row.sent     .cr-bubble {
          background: #f97316; color: #fff;
          border-bottom-right-radius: 4px;
          box-shadow: 0 2px 8px rgba(249,115,22,0.25);
        }
        .cr-msg-row.received .cr-bubble {
          background: #ffffff; color: #1a1814;
          border-bottom-left-radius: 4px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .cr-msg-time { font-size: 10.5px; color: #b5b2ae; padding: 2px 4px 0; }
        .cr-msg-row.sent .cr-msg-time { text-align: right; }

        /* ── INPUT ── */
        .cr-input-bar {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 16px;
          background: #ffffff; border-top: 1px solid #ede9e3;
          flex-shrink: 0;
        }
        .cr-attach-btn {
          width: 36px; height: 36px; border-radius: 50%;
          background: #f7f5f2; border: none; color: #6b6966;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
          flex-shrink: 0;
        }
        .cr-attach-btn:hover { background: #ede9e3; color: #f97316; }
        .cr-textarea-wrap {
          flex: 1; display: flex; align-items: center;
          background: #f7f5f2; border: 1.5px solid #ede9e3;
          border-radius: 24px; padding: 0 12px;
          transition: border-color 0.15s;
        }
        .cr-textarea-wrap:focus-within { border-color: #f97316; background: #fff; }
        .cr-textarea-wrap textarea {
          flex: 1; padding: 9px 6px; background: transparent;
          border: none; color: #1a1814; font-size: 14px;
          font-family: inherit; outline: none; resize: none;
          max-height: 100px; line-height: 1.3;
        }
        .cr-textarea-wrap textarea::placeholder { color: #b5b2ae; }
        .cr-smile-btn {
          background: none; border: none; color: #a09e9a;
          cursor: pointer; display: flex; align-items: center;
          padding: 4px; border-radius: 50%;
          transition: color 0.15s;
        }
        .cr-smile-btn:hover { color: #f97316; }
        .cr-send-btn {
          width: 40px; height: 40px; border-radius: 50%;
          background: #f97316; border: none; color: #fff;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, transform 0.12s;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(249,115,22,0.4);
        }
        .cr-send-btn:hover:not(:disabled) { background: #ea6c0a; transform: scale(1.06); }
        .cr-send-btn:disabled {
          background: #e5e2dd; box-shadow: none; cursor: default;
          color: #b5b2ae;
        }

        /* ── TASK PANEL ── */
        .cr-task-panel {
          flex: 1; overflow-y: auto; padding: 20px;
          background: #f7f5f2; display: flex;
          flex-direction: column; gap: 14px;
        }
        .cr-task-card {
          background: #ffffff; border-radius: 14px;
          padding: 20px 22px; border: 1px solid #ede9e3;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }
        .cr-task-title { font-size: 18px; font-weight: 700; color: #1a1814; margin-bottom: 8px; font-family: 'Lora', serif; }
        .cr-task-desc  { font-size: 13.5px; color: #6b6966; line-height: 1.6; margin-bottom: 16px; }
        .cr-meta-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .cr-meta-item  {
          display: flex; align-items: center; gap: 10px;
          background: #faf9f7; border-radius: 10px; padding: 10px 12px;
        }
        .cr-meta-icon {
          width: 32px; height: 32px; border-radius: 8px;
          background: #fff7f0;
          display: flex; align-items: center; justify-content: center;
          color: #f97316; flex-shrink: 0;
        }
        .cr-meta-label { font-size: 10.5px; color: #a09e9a; margin-bottom: 1px; }
        .cr-meta-value { font-size: 13px; font-weight: 600; color: #1a1814; }

        .cr-worker-card {
          background: #ffffff; border-radius: 14px;
          padding: 16px 20px; border: 1px solid #ede9e3;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
          display: flex; align-items: center; gap: 14px;
        }
        .cr-worker-name  { font-size: 15px; font-weight: 700; color: #1a1814; font-family: 'Lora', serif; }
        .cr-worker-sub   { font-size: 12px; color: #8a8783; margin-top: 3px; }
        .cr-worker-stats { display: flex; gap: 14px; margin-top: 8px; }
        .cr-stat-chip    { display: flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 600; color: #6b6966; }

        .cr-action-row { display: flex; gap: 10px; }
        .cr-action-btn {
          flex: 1; padding: 12px; border-radius: 12px;
          border: 1.5px solid #ede9e3; background: #ffffff;
          font-family: inherit; font-size: 13.5px; font-weight: 600;
          color: #6b6966; cursor: pointer; transition: all 0.15s;
        }
        .cr-action-btn:hover { border-color: #f97316; color: #f97316; background: #fff7f0; }
        .cr-action-btn.primary { background: #f97316; color: #fff; border-color: #f97316; box-shadow: 0 2px 8px rgba(249,115,22,0.3); }
        .cr-action-btn.primary:hover { background: #ea6c0a; }

        .cr-no-task {
          flex: 1; display: flex; align-items: center;
          justify-content: center; color: #a09e9a; font-size: 14px;
        }
        .cr-no-selection {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 10px;
          color: #a09e9a; font-size: 14px; background: #f7f5f2;
        }
        .cr-no-selection-icon {
          width: 72px; height: 72px; border-radius: 50%;
          background: #ede9e3;
          display: flex; align-items: center; justify-content: center;
          font-size: 32px; margin-bottom: 4px;
        }
        .cr-no-selection h3 { font-size: 18px; font-weight: 700; color: #3d3b38; font-family: 'Lora', serif; }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d6d3ce; border-radius: 4px; }
      `}</style>

      <div className="cr-root">

        {/* ══ SIDEBAR ══ */}
        <aside className="cr-sidebar">
          <div className="cr-sidebar-header">
            <div className="cr-sidebar-title">Messages</div>
            <div className="cr-search">
              <Search size={14} />
              <input
                placeholder="Search conversations..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="cr-conv-list">
            {filtered.length === 0 ? (
              <div className="cr-empty-list">No conversations yet</div>
            ) : (
              filtered.map(conv => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  active={conv.id === activeId}
                  onClick={() => { setActiveId(conv.id); setActiveTab("chat"); }}
                />
              ))
            )}
          </div>
        </aside>

        {/* ══ MAIN PANEL ══ */}
        <main className="cr-main">
          {!active ? (
            <div className="cr-no-selection">
              <div className="cr-no-selection-icon">💬</div>
              <h3>Your Messages</h3>
              <p>Select a conversation to start chatting</p>
            </div>
          ) : (
            <>
              {/* Top bar */}
              <div className="cr-topbar">
                <div className="cr-topbar-left">
                  <Avatar name={active.contact.name} size={40} color={getColor(active.contact.name)} />
                  <div>
                    <div className="cr-topbar-name">{active.contact.name}</div>
                    <div className="cr-topbar-sub">● Active now</div>
                  </div>
                </div>
                <div className="cr-topbar-actions">
                  <button className="cr-icon-btn"><Info size={17} /></button>
                  <button className="cr-icon-btn"><MoreVertical size={17} /></button>
                </div>
              </div>

              {/* Tabs */}
              <div className="cr-tabs">
                <button className={`cr-tab ${activeTab === "chat" ? "active" : ""}`} onClick={() => setActiveTab("chat")}>Chat</button>
                <button className={`cr-tab ${activeTab === "taskDetails" ? "active" : ""}`} onClick={() => setActiveTab("taskDetails")}>Task Details</button>
              </div>

              {/* ── CHAT TAB ── */}
              {activeTab === "chat" && (
                <>
                  <div className="cr-messages">
                    {activeMessages.length === 0 ? (
                      <div className="cr-empty-chat">
                        <div className="cr-empty-chat-icon">💬</div>
                        <h3>Start the conversation</h3>
                        <p>Send a message to {active.contact.name.split(" ")[0]}</p>
                      </div>
                    ) : (
                      activeMessages.map((msg, idx) => {
                        const isSent = msg.sender_id === currentUserId;
                        return (
                          <div key={idx} className={`cr-msg-row ${isSent ? "sent" : "received"}`}>
                            {!isSent && <Avatar name={active.contact.name} size={28} color={getColor(active.contact.name)} />}
                            <div>
                              <div className="cr-bubble">{msg.message}</div>
                              <div className="cr-msg-time">
                                {msg.timestamp
                                  ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                  : ""}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={bottomRef} />
                  </div>

                  <div className="cr-input-bar">
                    <button className="cr-attach-btn"><Paperclip size={17} /></button>
                    <button className="cr-attach-btn"><Image size={17} /></button>
                    <div className="cr-textarea-wrap">
                      <textarea
                        rows={1}
                        placeholder="Aa"
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={handleKey}
                      />
                      <button className="cr-smile-btn"><Smile size={18} /></button>
                    </div>
                    {text.trim() ? (
                      <button className="cr-send-btn" onClick={sendMessage}><Send size={17} /></button>
                    ) : (
                      <button className="cr-send-btn" disabled><Mic size={17} /></button>
                    )}
                  </div>
                </>
              )}

              {/* ── TASK DETAILS TAB ── */}
              {activeTab === "taskDetails" && (
                <div className="cr-task-panel">
                  {!active.task ? (
                    <div className="cr-no-task">No task linked to this conversation.</div>
                  ) : (
                    <>
                      <div className="cr-task-card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                          <div className="cr-task-title">{active.task.title}</div>
                          <StatusBadge status={active.task.status} />
                        </div>
                        <p className="cr-task-desc">{active.task.description}</p>
                        <div className="cr-meta-grid">
                          <div className="cr-meta-item">
                            <div className="cr-meta-icon"><Calendar size={15} /></div>
                            <div>
                              <div className="cr-meta-label">Scheduled</div>
                              <div className="cr-meta-value">{active.task.date || "—"}</div>
                            </div>
                          </div>
                          <div className="cr-meta-item">
                            <div className="cr-meta-icon"><DollarSign size={15} /></div>
                            <div>
                              <div className="cr-meta-label">Budget</div>
                              <div className="cr-meta-value">{active.task.budget || "—"}</div>
                            </div>
                          </div>
                          <div className="cr-meta-item" style={{ gridColumn: "span 2" }}>
                            <div className="cr-meta-icon"><MapPin size={15} /></div>
                            <div>
                              <div className="cr-meta-label">Location</div>
                              <div className="cr-meta-value">{active.task.location || "—"}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="cr-worker-card">
                        <Avatar name={active.contact.name} size={50} color={getColor(active.contact.name)} />
                        <div style={{ flex: 1 }}>
                          <div className="cr-worker-name">{active.contact.name}</div>
                          <div className="cr-worker-sub">{active.task.category || "Worker"}</div>
                          <div className="cr-worker-stats">
                            {active.task.workerRating && (
                              <span className="cr-stat-chip">
                                <Star size={13} fill="#FFB800" color="#FFB800" />
                                {active.task.workerRating}
                              </span>
                            )}
                            {active.task.workerJobs !== undefined && (
                              <span className="cr-stat-chip">
                                <Briefcase size={13} />
                                {active.task.workerJobs} jobs
                              </span>
                            )}
                          </div>
                        </div>
                        <CheckCircle2 size={22} color="#10b981" />
                      </div>

                      <div className="cr-action-row">
                        <button className="cr-action-btn" onClick={() => setActiveTab("chat")}>💬 Message</button>
                        <button className="cr-action-btn primary">✓ Mark Complete</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}