import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Search, Calendar, MapPin, Clock, ChevronRight, Star,
  MessageCircle, XCircle, CheckCircle, Flag, User, X,
  Send, ArrowLeft
} from "lucide-react";
import BookingNavbar from "../../components/Navbar/Navbar";
import { useNavigate } from "react-router-dom";
import ReportModal from "../../components/Report/ReportSection";
import { autoCancelExpiredTasks, autoCancelConfirmedUnpaidTasks } from "../../api/api";
import PaymentFlow from "../../components/payment/Payment";

const API_BASE = "http://127.0.0.1:8000/api";
const WS_BASE  = "ws://127.0.0.1:8000";

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatCurrency = (amount) =>
  amount != null ? `NPR ${Number(amount).toFixed(2)}` : "—";

const formatDate = (dateStr) => {
  if (!dateStr) return "Date not set";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch { return dateStr; }
};

const getPaymentStatus = (task) =>
  String(task?.paymentStatus || task?.payment_status || "pending").toLowerCase();
const isPaid     = (task) => getPaymentStatus(task) === "paid";
const isReleased = (task) =>
  String(task?.escrow_status || "").toLowerCase().trim() === "released";

// ── Toast ─────────────────────────────────────────────────────────────────────
const makeToast = (status, taskName) => {
  const label = taskName ? `"${taskName}"` : "Your task";
  const map = {
    confirmed:        { color: "#6d28d9", message: `${label} has been confirmed.` },
    in_progress:      { color: "#1e40af", message: `A worker has started ${label}.` },
    completed:        { color: "#065f46", message: `${label} has been completed.` },
    cancelled:        { color: "#991b1b", message: `${label} was cancelled.` },
    declined:         { color: "#991b1b", message: `${label} was declined.` },
    accepted:         { color: "#b45309", message: `${label} has been accepted by the worker.` },
    payment_reminder: { color: "#c2410c", message: `⏰ 1 hour left to pay for ${label} before auto-cancellation!` },
  };
  return map[status] || null;
};

const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const add = (toast) => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, ...toast }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 10000);
  };
  const remove = id => setToasts(p => p.filter(t => t.id !== id));
  return { toasts, add, remove };
};

const ToastContainer = ({ toasts, removeToast }) => (
  <div style={{
    position: "fixed", top: "80px", right: "20px", zIndex: 9999,
    display: "flex", flexDirection: "column", gap: "10px",
    alignItems: "flex-end", pointerEvents: "none",
  }}>
    {toasts.map(t => (
      <div key={t.id} style={{
        pointerEvents: "auto", position: "relative",
        display: "flex", alignItems: "center", gap: "12px",
        padding: "12px 16px", borderRadius: "12px",
        minWidth: "260px", maxWidth: "340px",
        background: "white", border: "1px solid #e8e0d4", color: "#1c1008",
        fontSize: "13px", fontWeight: "600",
        boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
        animation: "toastIn 0.3s ease", overflow: "hidden",
      }}>
        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: t.color, flexShrink: 0 }}/>
        <div style={{ flex: 1, lineHeight: "1.5" }}>{t.message}</div>
        <button onClick={() => removeToast(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#a8a29e", display: "flex" }}>
          <X size={13} />
        </button>
        <div style={{ position:"absolute", bottom:0, left:0, height:"2px", width:"100%", background:"#f5efe6" }}>
          <div style={{ height:"100%", background: t.color, opacity:0.6, animation:"toastBar 10s linear forwards" }}/>
        </div>
      </div>
    ))}
    <style>{`
      @keyframes toastIn  { from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)} }
      @keyframes toastBar { from{width:100%}to{width:0%} }
    `}</style>
  </div>
);

// ── WebSocket hook ─────────────────────────────────────────────────────────────
const useReconnectingWebSocket = (url, onMessage) => {
  const wsRef        = useRef(null);
  const retryRef     = useRef(0);
  const timerRef     = useRef(null);
  const activeRef    = useRef(true);
  const onMessageRef = useRef(onMessage);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  const connect = useCallback(() => {
    if (!activeRef.current || !url) return;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen    = () => { retryRef.current = 0; };
    ws.onmessage = (e) => {
      try { const d = JSON.parse(e.data); if (d.type !== "ping") onMessageRef.current(d); } catch {}
    };
    ws.onclose = () => {
      if (!activeRef.current) return;
      timerRef.current = setTimeout(connect, Math.min(1000 * 2 ** retryRef.current++, 30000));
    };
    ws.onerror = () => ws.close();
  }, [url]);

  useEffect(() => {
    if (!url) return;
    activeRef.current = true; connect();
    return () => { activeRef.current = false; clearTimeout(timerRef.current); wsRef.current?.close(); };
  }, [url, connect]);
};

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  pending:     { color: "#b45309", bg: "#fef9ee", border: "#fde68a", dot: "#f59e0b", label: "Pending"     },
  confirmed:   { color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe", dot: "#8b5cf6", label: "Confirmed"   },
  in_progress: { color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe", dot: "#3b82f6", label: "In Progress" },
  completed:   { color: "#065f46", bg: "#f0fdf4", border: "#a7f3d0", dot: "#10b981", label: "Completed"   },
  released:    { color: "#0369a1", bg: "#e0f2fe", border: "#bae6fd", dot: "#0ea5e9", label: "Released"    },
  cancelled:   { color: "#991b1b", bg: "#fef2f2", border: "#fecaca", dot: "#ef4444", label: "Cancelled"   },
  declined:    { color: "#991b1b", bg: "#fef2f2", border: "#fecaca", dot: "#ef4444", label: "Declined"    },
};

const StatusPill = ({ status, released }) => {
  const key = released ? "released" : (status || "pending");
  const c   = STATUS_CFG[key] || STATUS_CFG.pending;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 10px", borderRadius: "9999px",
      fontSize: "11px", fontWeight: "700", letterSpacing: "0.02em",
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:c.dot, display:"inline-block" }}/>
      {c.label}
    </span>
  );
};

// ── Payment Deadline Badge ────────────────────────────────────────────────────
const PaymentDeadlineBadge = ({ confirmedAt }) => {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!confirmedAt) return;
    const deadline = new Date(confirmedAt).getTime() + 24 * 60 * 60 * 1000;
    const tick = () => {
      const diff = deadline - Date.now();
      if (diff <= 0) { setTimeLeft("Expired"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [confirmedAt]);

  if (!timeLeft) return null;
  const expired = timeLeft === "Expired";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4px",
      padding: "4px 10px", borderRadius: "9999px",
      fontSize: "11px", fontWeight: "700",
      background: expired ? "#fef2f2" : "#fff7ed",
      color:      expired ? "#991b1b" : "#c2410c",
      border:     `1px solid ${expired ? "#fecaca" : "#fed7aa"}`,
    }}>
      {expired ? "⚠ Payment overdue" : `Pay within: ${timeLeft}`}
    </span>
  );
};

// ── Small button ──────────────────────────────────────────────────────────────
const Btn = ({ onClick, variant = "default", children, disabled }) => {
  const V = {
    default: { color:"#78716c", bg:"white",   border:"#e2d9cc" },
    primary: { color:"#f6a623", bg:"#fffbf2", border:"#fde68a" },
    blue:    { color:"#1e40af", bg:"#eff6ff", border:"#bfdbfe" },
    green:   { color:"#065f46", bg:"#f0fdf4", border:"#a7f3d0" },
    sky:     { color:"#0369a1", bg:"#e0f2fe", border:"#bae6fd" },
    red:     { color:"#991b1b", bg:"#fef2f2", border:"#fecaca" },
    amber:   { color:"#b45309", bg:"#fffbf2", border:"#fde68a" },
  };
  const v = V[variant] || V.default;
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        display:"inline-flex", alignItems:"center", gap:"5px",
        padding:"6px 14px", borderRadius:"9999px",
        fontSize:"12px", fontWeight:"600",
        color:v.color, background:v.bg, border:`1.5px solid ${v.border}`,
        cursor:disabled?"default":"pointer", opacity:disabled?0.6:1,
        transition:"opacity 0.15s", whiteSpace:"nowrap",
      }}
      onMouseEnter={e=>{ if(!disabled) e.currentTarget.style.opacity="0.75"; }}
      onMouseLeave={e=>{ e.currentTarget.style.opacity="1"; }}
    >{children}</button>
  );
};

// ── Chat Panel ────────────────────────────────────────────────────────────────
const ChatPanel = ({ task, worker, customerId, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [sending, setSending]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const bottomRef               = useRef(null);
  const wsRef                   = useRef(null);
  const workerId = task?.assignedWorkerId;
  const taskId   = task?._id;

  // Fetch history
  useEffect(() => {
    if (!taskId || !workerId) return;
    setLoading(true);
    fetch(`${API_BASE}/messages/${taskId}/${workerId}`)
      .then(r => r.json())
      .then(d => setMessages(d.messages || d || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [taskId, workerId]);

  // Live WS
  useEffect(() => {
    if (!customerId || !taskId) return;
    const ws = new WebSocket(`${WS_BASE}/ws/chat/${taskId}/${customerId}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "chat" || msg.senderId) setMessages(p => [...p, msg]);
      } catch {}
    };
    return () => ws.close();
  }, [taskId, customerId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput(""); setSending(true);
    setMessages(p => [...p, { _id: Date.now(), senderId: customerId, message: text, createdAt: new Date().toISOString(), pending: true }]);
    try {
      await fetch(`${API_BASE}/messages`, {
        method: "POST", headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ taskId, senderId: customerId, receiverId: workerId, message: text }),
      });
    } catch {}
    setSending(false);
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const fmtTime = (d) => {
    if (!d) return "";
    try { return new Date(d).toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" }); } catch { return ""; }
  };

  // Group messages by date
  const grouped = messages.reduce((acc, msg) => {
    const date = msg.createdAt
      ? new Date(msg.createdAt).toLocaleDateString("en-US", { month:"short", day:"numeric" })
      : "Today";
    if (!acc.length || acc[acc.length-1].date !== date) acc.push({ date, msgs:[] });
    acc[acc.length-1].msgs.push(msg);
    return acc;
  }, []);

  return (
    <div
      style={{ position:"fixed", inset:0, zIndex:3000, background:"rgba(15,23,42,0.5)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={onClose}
    >
      <div
        onClick={e=>e.stopPropagation()}
        style={{ width:"min(520px,95vw)", height:"min(680px,90vh)", background:"white", borderRadius:"20px", boxShadow:"0 24px 60px rgba(0,0,0,0.18)", display:"flex", flexDirection:"column", overflow:"hidden" }}
      >
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"16px 20px", borderBottom:"1px solid #f0ebe2", flexShrink:0 }}>
          <button onClick={onClose} style={{ background:"#f5efe6", border:"none", width:"32px", height:"32px", borderRadius:"50%", cursor:"pointer", color:"#78716c", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <ArrowLeft size={14}/>
          </button>
          <div style={{ width:"40px", height:"40px", background:"linear-gradient(135deg,#f6a623,#e8890c)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px", color:"white", fontWeight:"800", flexShrink:0 }}>
            {worker?.firstName?.charAt(0)||"W"}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:"700", fontSize:"15px", color:"#1c1008" }}>
              {worker?`${worker.firstName} ${worker.lastName}`:"Worker"}
            </div>
            <div style={{ fontSize:"12px", color:"#a8a29e", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {task?.taskName||"Task chat"}
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
            <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#10b981" }}/>
            <span style={{ fontSize:"11px", color:"#10b981", fontWeight:"600" }}>Online</span>
          </div>
        </div>

        {/* Task context strip */}
        <div style={{ padding:"9px 20px", background:"#fffbf2", borderBottom:"1px solid #fde68a", display:"flex", alignItems:"center", gap:"10px", flexShrink:0, flexWrap:"wrap" }}>
          <Calendar size={12} color="#f6a623"/>
          <span style={{ fontSize:"12px", color:"#78716c" }}>
            {task?.serviceDate
              ? new Date(`${task.serviceDate.split("T")[0]}T${task.serviceTime||"00:00"}`).toLocaleDateString("en-US",{month:"short",day:"numeric"}) + " at " + (task.serviceTime||"—")
              : "No date"}
          </span>
          <span style={{ color:"#d1c4b2" }}>·</span>
          <MapPin size={12} color="#f6a623"/>
          <span style={{ fontSize:"12px", color:"#78716c", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{task?.address||"—"}</span>
          <StatusPill status={task?.status} released={isReleased(task)}/>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:"auto", padding:"16px 20px", display:"flex", flexDirection:"column", gap:"2px", background:"#faf7f2" }}>
          {loading ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:"#a8a29e", fontSize:"13px" }}>Loading messages…</div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign:"center", padding:"48px 0" }}>
              <MessageCircle size={32} color="#e2d9cc" style={{ marginBottom:"10px" }}/>
              <p style={{ color:"#a8a29e", fontSize:"13px", fontWeight:"600", margin:"0 0 4px" }}>No messages yet</p>
              <p style={{ color:"#c4bab0", fontSize:"12px", margin:0 }}>Start the conversation with your worker</p>
            </div>
          ) : (
            grouped.map((grp, gi) => (
              <div key={gi}>
                <div style={{ textAlign:"center", margin:"12px 0 8px" }}>
                  <span style={{ fontSize:"10px", color:"#a8a29e", background:"#f0ebe2", padding:"2px 10px", borderRadius:"9999px", fontWeight:"600", letterSpacing:"0.04em" }}>{grp.date}</span>
                </div>
                {grp.msgs.map((msg, i) => {
                  const mine       = String(msg.senderId) === String(customerId);
                  const showAvatar = !mine && (i === 0 || String(grp.msgs[i-1]?.senderId) !== String(msg.senderId));
                  return (
                    <div key={msg._id||i} style={{ display:"flex", flexDirection:mine?"row-reverse":"row", alignItems:"flex-end", gap:"7px", marginBottom:"3px" }}>
                      {!mine && (
                        <div style={{ width:"26px", height:"26px", borderRadius:"50%", background:showAvatar?"linear-gradient(135deg,#f6a623,#e8890c)":"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"10px", color:"white", fontWeight:"800", flexShrink:0 }}>
                          {showAvatar?(worker?.firstName?.charAt(0)||"W"):""}
                        </div>
                      )}
                      <div style={{ maxWidth:"68%" }}>
                        <div style={{
                          padding:"8px 12px",
                          borderRadius:mine?"16px 16px 4px 16px":"16px 16px 16px 4px",
                          background:mine?"linear-gradient(135deg,#f6a623,#e8890c)":"white",
                          color:mine?"white":"#1c1008",
                          fontSize:"13px", lineHeight:"1.5",
                          boxShadow:"0 1px 3px rgba(0,0,0,0.06)",
                          opacity:msg.pending?0.6:1,
                          border:mine?"none":"1px solid #f0ebe2",
                        }}>
                          {msg.message||msg.text||""}
                        </div>
                        <div style={{ fontSize:"10px", color:"#a8a29e", textAlign:mine?"right":"left", marginTop:"2px", paddingLeft:mine?0:"3px", paddingRight:mine?"3px":0 }}>
                          {fmtTime(msg.createdAt)}{msg.pending&&" · sending…"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <div style={{ padding:"12px 16px", borderTop:"1px solid #f0ebe2", background:"white", display:"flex", alignItems:"flex-end", gap:"10px", flexShrink:0 }}>
          <textarea
            value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey}
            placeholder="Type a message…" rows={1}
            style={{ flex:1, padding:"10px 14px", borderRadius:"20px", border:"1.5px solid #e8dfd0", fontSize:"13px", outline:"none", resize:"none", fontFamily:"inherit", maxHeight:"100px", background:"#faf7f2", color:"#1c1008", lineHeight:"1.5", transition:"border-color 0.2s" }}
            onFocus={e=>e.target.style.borderColor="#f6a623"}
            onBlur={e=>e.target.style.borderColor="#e8dfd0"}
          />
          <button
            onClick={sendMessage} disabled={!input.trim()||sending}
            style={{ width:"40px", height:"40px", borderRadius:"50%", background:input.trim()?"linear-gradient(135deg,#f6a623,#e8890c)":"#f0ebe2", border:"none", cursor:input.trim()?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.2s" }}
          >
            <Send size={15} color={input.trim()?"white":"#a8a29e"}/>
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Release Payment Modal ─────────────────────────────────────────────────────
const ReleasePaymentModal = ({ task, onClose, onConfirm, releasing }) => (
  <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, backdropFilter:"blur(4px)" }} onClick={onClose}>
    <div style={{ background:"white", borderRadius:"20px", padding:"1.8rem", maxWidth:"400px", width:"90%", boxShadow:"0 24px 60px rgba(0,0,0,0.15)" }} onClick={e=>e.stopPropagation()}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
        <h2 style={{ fontSize:"17px", fontWeight:"800", margin:0, color:"#1c1008" }}>Release Payment</h2>
        <button onClick={onClose} style={{ background:"#f5efe6", border:"none", width:"30px", height:"30px", borderRadius:"50%", cursor:"pointer", color:"#78716c", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
      </div>
      <div style={{ background:"#f0fdf4", border:"1px solid #a7f3d0", borderRadius:"12px", padding:"14px 16px", marginBottom:"1.25rem" }}>
        <p style={{ margin:0, fontSize:"13px", fontWeight:"700", color:"#065f46" }}>✅ Confirm completion</p>
        <p style={{ margin:"6px 0 0", fontSize:"13px", color:"#064e3b", lineHeight:"1.6" }}>
          This will release <strong>NPR {task?.totalCost?.toFixed?task.totalCost.toFixed(2):task?.totalCost}</strong> to the worker. This cannot be undone.
        </p>
      </div>
      <div style={{ display:"flex", gap:"8px" }}>
        <button onClick={onClose} disabled={releasing} style={{ flex:1, padding:"10px", borderRadius:"10px", border:"1.5px solid #e8dfd0", background:"white", cursor:"pointer", fontSize:"13px", fontWeight:"600", color:"#78716c" }}>Cancel</button>
        <button onClick={onConfirm} disabled={releasing} style={{ flex:2, padding:"10px", borderRadius:"10px", border:"none", background:"linear-gradient(135deg,#059669,#047857)", color:"white", fontWeight:"700", cursor:releasing?"default":"pointer", opacity:releasing?0.7:1, fontSize:"13px", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }}>
          {releasing?<><div style={{ width:"13px", height:"13px", border:"2px solid rgba(255,255,255,0.4)", borderTop:"2px solid white", borderRadius:"50%", animation:"spin 0.75s linear infinite" }}/> Releasing…</>:<><CheckCircle size={13}/> Yes, Release</>}
        </button>
      </div>
    </div>
  </div>
);

// ── Rate & Review Modal ───────────────────────────────────────────────────────
const RateReviewModal = ({ task, worker, customerId, onClose, onSubmitted }) => {
  const [rating, setRating]         = useState(0);
  const [hover, setHover]           = useState(0);
  const [comment, setComment]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);

  const handleSubmit = async () => {
    if (!rating) { setError("Please select a rating."); return; }
    setSubmitting(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/reviews`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ taskId:task._id, workerId:task.assignedWorkerId, customerId, rating, comment }),
      });
      if (!res.ok) throw new Error("Failed to submit review");
      onSubmitted(); onClose();
    } catch(e) { setError(e.message); } finally { setSubmitting(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, backdropFilter:"blur(4px)" }} onClick={onClose}>
      <div style={{ background:"white", borderRadius:"20px", padding:"2rem", maxWidth:"400px", width:"90%", boxShadow:"0 24px 60px rgba(0,0,0,0.15)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
          <h2 style={{ fontSize:"17px", fontWeight:"800", color:"#1c1008", margin:0 }}>Rate & Review</h2>
          <button onClick={onClose} style={{ background:"#f5efe6", border:"none", width:"30px", height:"30px", borderRadius:"50%", cursor:"pointer", color:"#78716c", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"12px", background:"#fffbf2", borderRadius:"12px", marginBottom:"1.25rem", border:"1px solid #fde68a" }}>
          <div style={{ width:"38px", height:"38px", background:"linear-gradient(135deg,#f6a623,#e8890c)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:"800", fontSize:"16px", flexShrink:0 }}>{worker?.firstName?.charAt(0)||"W"}</div>
          <div>
            <div style={{ fontWeight:"700", fontSize:"14px", color:"#1c1008" }}>{worker?.firstName} {worker?.lastName}</div>
            <div style={{ fontSize:"12px", color:"#a8601a" }}>{task.taskName}</div>
          </div>
        </div>
        <div style={{ textAlign:"center", marginBottom:"1.25rem" }}>
          <p style={{ fontSize:"11px", color:"#a8a29e", fontWeight:"700", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"10px" }}>Your experience</p>
          <div style={{ display:"flex", justifyContent:"center", gap:"6px" }}>
            {[1,2,3,4,5].map(i=>(
              <Star key={i} size={30} fill={(hover||rating)>=i?"#f59e0b":"none"} color={(hover||rating)>=i?"#f59e0b":"#e2d9cc"}
                style={{ cursor:"pointer", transition:"transform 0.1s", transform:(hover||rating)>=i?"scale(1.12)":"scale(1)" }}
                onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(0)} onClick={()=>setRating(i)}/>
            ))}
          </div>
          {rating>0&&<p style={{ fontSize:"12px", color:"#f59e0b", fontWeight:"700", marginTop:"6px" }}>{["","Poor","Fair","Good","Very Good","Excellent"][rating]}</p>}
        </div>
        <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Share details of your experience…" rows={3}
          style={{ width:"100%", padding:"10px 13px", borderRadius:"10px", border:"1.5px solid #e8dfd0", fontSize:"13px", outline:"none", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box", marginBottom:"12px", transition:"border-color 0.2s" }}
          onFocus={e=>e.target.style.borderColor="#f6a623"} onBlur={e=>e.target.style.borderColor="#e8dfd0"}/>
        {error&&<p style={{ color:"#dc2626", fontSize:"12px", marginBottom:"10px" }}>{error}</p>}
        <div style={{ display:"flex", gap:"8px" }}>
          <button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:"10px", border:"1.5px solid #e8dfd0", background:"white", cursor:"pointer", fontSize:"13px", fontWeight:"600", color:"#78716c" }}>Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} style={{ flex:2, padding:"10px", borderRadius:"10px", border:"none", background:"linear-gradient(135deg,#f6a623,#e8890c)", color:"white", fontSize:"13px", fontWeight:"700", cursor:submitting?"default":"pointer", opacity:submitting?0.7:1 }}>
            {submitting?"Submitting…":"Submit Review"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Cancel Task Modal ─────────────────────────────────────────────────────────
const CancelTaskModal = ({ task, onClose, onSubmit }) => {
  const [reason, setReason]             = useState("");
  const [photo, setPhoto]               = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState(null);

  const taskIsPaid       = task.paymentStatus === "paid";
  const taskDatetime     = task.serviceDate ? new Date(`${task.serviceDate.split("T")[0]}T${task.serviceTime||"00:00"}`) : null;
  const hoursLeft        = taskDatetime ? (taskDatetime - Date.now()) / 3600000 : null;
  const penaltyWillApply = taskIsPaid && hoursLeft !== null && hoursLeft < 4;
  const totalCost        = task.totalCost || 0;

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5*1024*1024) { setError("Photo must be under 5 MB."); return; }
    setPhoto(file); setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!reason.trim()) { setError("Please provide a reason."); return; }
    setSubmitting(true); setError(null);
    try { await onSubmit(reason, photo); onClose(); }
    catch(err) { setError(err.message||"Failed to cancel task"); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, backdropFilter:"blur(4px)" }} onClick={onClose}>
      <div style={{ background:"white", borderRadius:"20px", padding:"1.8rem", maxWidth:"420px", width:"90%", boxShadow:"0 24px 60px rgba(0,0,0,0.15)", maxHeight:"90vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
          <h2 style={{ fontSize:"17px", fontWeight:"800", margin:0, color:"#1c1008" }}>Cancel Task</h2>
          <button onClick={onClose} style={{ background:"#f5efe6", border:"none", width:"30px", height:"30px", borderRadius:"50%", cursor:"pointer", color:"#78716c", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>
        {penaltyWillApply&&(
          <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:"12px", padding:"12px 14px", marginBottom:"14px" }}>
            <p style={{ margin:0, fontSize:"13px", fontWeight:"700", color:"#991b1b" }}>⚠️ Cancellation Fee Applies</p>
            <p style={{ margin:"6px 0 0", fontSize:"13px", color:"#7f1d1d", lineHeight:"1.55" }}>
              A <strong>25% penalty (NPR {(totalCost*0.25).toFixed(2)})</strong> applies. Refund: <strong>NPR {(totalCost*0.75).toFixed(2)}</strong>.
            </p>
          </div>
        )}
        {taskIsPaid&&!penaltyWillApply&&(
          <div style={{ background:"#f0fdf4", border:"1px solid #a7f3d0", borderRadius:"12px", padding:"12px 14px", marginBottom:"14px" }}>
            <p style={{ margin:0, fontSize:"13px", fontWeight:"700", color:"#065f46" }}>✅ Full Refund</p>
            <p style={{ margin:"6px 0 0", fontSize:"13px", color:"#064e3b", lineHeight:"1.55" }}>Full refund of <strong>NPR {totalCost.toFixed(2)}</strong> will be processed.</p>
          </div>
        )}
        <p style={{ fontSize:"11px", fontWeight:"700", color:"#a8a29e", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"6px" }}>Reason</p>
        <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3} placeholder="Describe why you're cancelling…"
          style={{ width:"100%", padding:"10px", borderRadius:"10px", border:"1.5px solid #e8dfd0", fontSize:"13px", outline:"none", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box", marginBottom:"14px", transition:"border-color 0.2s" }}
          onFocus={e=>e.target.style.borderColor="#f6a623"} onBlur={e=>e.target.style.borderColor="#e8dfd0"}/>
        <p style={{ fontSize:"11px", fontWeight:"700", color:"#a8a29e", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"6px" }}>Photo <span style={{ fontWeight:"400", textTransform:"none" }}>(optional)</span></p>
        {photoPreview?(
          <div style={{ position:"relative", marginBottom:"12px" }}>
            <img src={photoPreview} alt="evidence" style={{ width:"100%", maxHeight:"130px", objectFit:"cover", borderRadius:"10px", border:"1px solid #e8dfd0" }}/>
            <button onClick={()=>{setPhoto(null);setPhotoPreview(null);}} style={{ position:"absolute", top:"6px", right:"6px", background:"rgba(0,0,0,0.55)", border:"none", borderRadius:"50%", width:"22px", height:"22px", cursor:"pointer", color:"white", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
          </div>
        ):(
          <label style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"6px", padding:"16px 12px", borderRadius:"10px", border:"1.5px dashed #e8dfd0", cursor:"pointer", marginBottom:"12px", fontSize:"12px", color:"#a8a29e", textAlign:"center", transition:"border-color 0.2s", boxSizing:"border-box", width:"100%" }}
            onMouseEnter={e=>e.currentTarget.style.borderColor="#f6a623"} onMouseLeave={e=>e.currentTarget.style.borderColor="#e8dfd0"}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M3 16v3a2 2 0 002 2h14a2 2 0 002-2v-3M12 3v13M8 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Upload photo
            <input type="file" accept="image/*" style={{ display:"none" }} onChange={handlePhotoChange}/>
          </label>
        )}
        {error&&<p style={{ color:"#dc2626", fontSize:"12px", marginBottom:"10px" }}>{error}</p>}
        <div style={{ display:"flex", gap:"8px" }}>
          <button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:"10px", border:"1.5px solid #e8dfd0", background:"white", cursor:"pointer", fontSize:"13px", fontWeight:"600", color:"#78716c" }}>Keep Task</button>
          <button onClick={handleSubmit} disabled={submitting} style={{ flex:2, padding:"10px", borderRadius:"10px", border:"none", background:penaltyWillApply?"linear-gradient(135deg,#dc2626,#b91c1c)":"#dc2626", color:"white", fontWeight:"700", cursor:submitting?"default":"pointer", opacity:submitting?0.7:1, fontSize:"13px" }}>
            {submitting?"Cancelling…":penaltyWillApply?`Cancel (NPR ${(totalCost*0.25).toFixed(2)} fee)`:"Confirm Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Task Detail Modal ─────────────────────────────────────────────────────────
const TaskModal = ({ task, worker, setShowDetailsModal }) => {
  const navigate = useNavigate();
  const released = isReleased(task);
  const hourlyRate     = worker?.basePrice ?? worker?.hourlyRate ?? worker?.skills?.[0]?.price ?? null;
  const estimatedHours = task.estimatedHours || task.completionTime;

  const timelineSteps = [
    { label:"Created",   field:"createdAt",   color:"#a8a29e" },
    { label:"Accepted",  field:"acceptedAt",  color:"#b45309" },
    { label:"Confirmed", field:"confirmedAt", color:"#6d28d9" },
    { label:"Started",   field:"startedAt",   color:"#1e40af" },
    { label:"Completed", field:"completedAt", color:"#065f46" },
    { label:"Released",  field:"releasedAt",  color:"#0369a1" },
    { label:"Declined",  field:"declinedAt",  color:"#991b1b" },
    { label:"Cancelled", field:"cancelledAt", color:"#991b1b" },
  ].filter(s => task[s.field]);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, backdropFilter:"blur(4px)" }} onClick={()=>setShowDetailsModal(false)}>
      <div style={{ background:"white", borderRadius:"20px", padding:"2rem", maxWidth:"500px", width:"90%", maxHeight:"90vh", overflow:"auto", boxShadow:"0 24px 60px rgba(0,0,0,0.15)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
          <h2 style={{ fontSize:"17px", fontWeight:"800", color:"#1c1008", margin:0 }}>Task Details</h2>
          <button onClick={()=>setShowDetailsModal(false)} style={{ background:"#f5efe6", border:"none", width:"32px", height:"32px", borderRadius:"50%", cursor:"pointer", color:"#78716c", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>

        <div style={{ display:"flex", alignItems:"flex-start", gap:"12px", marginBottom:"1.25rem" }}>
          <div style={{ width:"48px", height:"48px", background:"linear-gradient(135deg,#f6a623,#e8890c)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", color:"white", fontWeight:"800", flexShrink:0 }}>
            {worker?.firstName?.charAt(0)||"W"}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:"800", fontSize:"16px", color:"#1c1008" }}>{worker?`${worker.firstName} ${worker.lastName}`:"Worker"}</div>
            <div style={{ display:"flex", alignItems:"center", gap:"4px", marginTop:"2px" }}>
              <Star size={11} fill="#f59e0b" color="#f59e0b"/>
              <span style={{ fontSize:"12px", fontWeight:"700", color:"#1c1008" }}>{worker?.ratings??0}</span>
              <span style={{ fontSize:"12px", color:"#a8a29e" }}>· {worker?.noOfCompletedTask||0} jobs</span>
            </div>
            {worker&&<button onClick={()=>{setShowDetailsModal(false);navigate(`/worker/${worker._id||worker.id}`);}} style={{ marginTop:"4px", fontSize:"11px", color:"#f6a623", background:"none", border:"none", cursor:"pointer", fontWeight:"700", padding:0, textDecoration:"underline" }}>View Profile →</button>}
          </div>
          <StatusPill status={task.status} released={released}/>
        </div>

        {(task.taskDescrip||task.taskName)&&<p style={{ fontSize:"13px", color:"#57534e", lineHeight:"1.7", margin:"0 0 1.25rem", fontStyle:"italic" }}>{task.taskDescrip||task.taskName}</p>}

        <div style={{ display:"flex", flexDirection:"column", marginBottom:"1.25rem", background:"#faf7f2", borderRadius:"12px", overflow:"hidden" }}>
          {[
            {icon:<Calendar size={13} color="#f6a623"/>, label:"Date",        value:formatDate(task.serviceDate)},
            {icon:<Clock    size={13} color="#f6a623"/>, label:"Est. Hours",  value:estimatedHours?`${estimatedHours} hrs`:"Not set"},
            {icon:<MapPin   size={13} color="#f6a623"/>, label:"Location",    value:task.address||"Not specified"},
            {icon:<Star     size={13} color="#f6a623"/>, label:"Hourly Rate", value:hourlyRate?`NPR ${hourlyRate}/hr`:"Not set"},
            {icon:<Star     size={13} color="#f6a623"/>, label:"Extra Cost",  value:task.additionalCost>0?`NPR ${task.additionalCost}`:"None"},
          ].map(({icon,label,value},i,arr)=>(
            <div key={label} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"10px 14px", borderBottom:i<arr.length-1?"1px solid #f0ebe2":"none" }}>
              <div style={{ width:"18px", display:"flex", justifyContent:"center" }}>{icon}</div>
              <span style={{ fontSize:"11px", fontWeight:"700", color:"#a8a29e", width:"88px", textTransform:"uppercase", letterSpacing:"0.04em" }}>{label}</span>
              <span style={{ fontSize:"13px", color:"#1c1008", fontWeight:"600" }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", background:"#fffbf2", borderRadius:"10px", border:"1px solid #fde68a", marginBottom:"1.25rem" }}>
          <span style={{ fontSize:"12px", fontWeight:"700", color:"#a8601a" }}>Total Amount</span>
          <span style={{ fontSize:"20px", fontWeight:"900", color:"#f6a623" }}>{task.totalCost?`NPR ${task.totalCost}`:"NPR —"}</span>
        </div>

        {task.actualHours&&<div style={{ display:"flex", justifyContent:"space-between", marginBottom:"1.25rem" }}><span style={{ fontSize:"13px", fontWeight:"700", color:"#065f46" }}>Actual Hours</span><span style={{ fontSize:"14px", fontWeight:"800", color:"#065f46" }}>{task.actualHours} hrs</span></div>}

        {timelineSteps.length>0&&(
          <div style={{ marginBottom:"1.5rem" }}>
            <p style={{ fontSize:"10px", fontWeight:"700", color:"#a8a29e", textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 12px" }}>Timeline</p>
            <div style={{ position:"relative" }}>
              {timelineSteps.length>1&&<div style={{ position:"absolute", left:"5px", top:"10px", bottom:"10px", width:"2px", background:"#f5efe6", borderRadius:"2px" }}/>}
              {timelineSteps.map((step,i)=>(
                <div key={i} style={{ position:"relative", display:"flex", alignItems:"flex-start", gap:"14px", paddingLeft:"22px", marginBottom:i<timelineSteps.length-1?"12px":0 }}>
                  <div style={{ position:"absolute", left:0, top:"4px", width:"12px", height:"12px", borderRadius:"50%", background:step.color, border:"2px solid white", boxShadow:`0 0 0 2px ${step.color}` }}/>
                  <div>
                    <div style={{ display:"flex", alignItems:"baseline", gap:"8px", flexWrap:"wrap" }}>
                      <span style={{ fontSize:"12px", fontWeight:"700", color:step.color }}>{step.label}</span>
                      <span style={{ fontSize:"11px", color:"#a8a29e" }}>{new Date(task[step.field]).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"})}</span>
                    </div>
                    {step.field==="cancelledAt"&&task.cancelReason&&<span style={{ fontSize:"11px", color:"#991b1b", background:"#fef2f2", padding:"3px 8px", borderRadius:"6px", border:"1px solid #fecaca", fontStyle:"italic", display:"block", marginTop:"4px" }}>{task.cancelReason}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Task Card ─────────────────────────────────────────────────────────────────
const TaskCard = ({
  activeTab, task, worker,
  handleViewDetails, openPaymentModal,
  releasePayment, customerId,
  openChat, onRateReview, onReport, setCancelTaskData,
}) => {
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();

  const released       = isReleased(task);
  const paid           = isPaid(task);
  const estimatedHours = task.estimatedHours || task.completionTime;
  const showDeadline   = task.status === "confirmed" && !paid && task.confirmedAt;

  return (
    <div
      onClick={() => handleViewDetails(task)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "white",
        borderRadius: "16px",
        border: `1px solid ${hovered ? "#f6a623" : "#ede8df"}`,
        padding: "20px 24px",
        marginBottom: "14px",
        transition: "all 0.18s ease",
        cursor: "pointer",
        boxShadow: hovered ? "0 6px 20px rgba(246,166,35,0.12)" : "0 1px 4px rgba(0,0,0,0.04)",
        transform: hovered ? "translateY(-1px)" : "none",
      }}
    >
      <div style={{ display:"flex", alignItems:"flex-start" }}>

        {/* Left: Worker */}
        <div style={{ width:"200px", flexShrink:0, paddingRight:"24px", borderRight:"1px solid #f0ebe2" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px" }}>
            <div style={{ width:"46px", height:"46px", background:"linear-gradient(135deg,#f6a623,#e8890c)", borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", color:"white", fontWeight:"800", boxShadow:"0 2px 8px rgba(246,166,35,0.3)" }}>
              {worker?.firstName?.charAt(0)||<User size={16} color="white"/>}
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:"700", fontSize:"14px", color:"#1c1008", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {worker?`${worker.firstName} ${worker.lastName}`:"Worker"}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"3px" }}>
                <Star size={11} fill="#f59e0b" color="#f59e0b"/>
                <span style={{ fontSize:"11px", fontWeight:"700", color:"#1c1008" }}>{worker?.ratings??0}</span>
                <span style={{ fontSize:"11px", color:"#a8a29e" }}>({worker?.noOfCompletedTask||0} jobs)</span>
              </div>
            </div>
          </div>

          {worker?.specialization&&<div style={{ fontSize:"11px", color:"#a8a29e", marginBottom:"6px" }}>{worker.specialization}</div>}

          {worker&&(
            <button
              onClick={e=>{e.stopPropagation();navigate(`/worker/${worker._id||worker.id}`);}}
              style={{ fontSize:"11px", color:"#f6a623", background:"none", border:"none", cursor:"pointer", fontWeight:"700", padding:0, textDecoration:"underline", marginBottom:"10px", display:"block" }}
            >View Profile</button>
          )}


          {showDeadline&&(
            <div style={{ marginTop:"8px" }}>
              <PaymentDeadlineBadge confirmedAt={task.confirmedAt}/>
            </div>
          )}
        </div>

        {/* Middle: Details */}
        <div style={{ flex:1, paddingLeft:"24px", paddingRight:"24px", borderRight:"1px solid #f0ebe2" }}>
          <div style={{ fontSize:"14px", color:"#1c1008", fontWeight:"600", marginBottom:"14px" }}>
            <span style={{ color:"#a8a29e", fontWeight:"500" }}>Task details: </span>
            {task.taskName||task.taskDescrip||"—"}
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:"7px", marginBottom:"14px" }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:"7px" }}>
              <MapPin size={13} color="#a8a29e" style={{ marginTop:"1px", flexShrink:0 }}/>
              <span style={{ fontSize:"13px", color:"#57534e", lineHeight:"1.4" }}>{task.address||"Location not set"}</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
              <Calendar size={13} color="#a8a29e"/>
              <span style={{ fontSize:"13px", color:"#57534e" }}>
                {task.serviceDate
                  ? new Date(`${task.serviceDate.split("T")[0]}T${task.serviceTime||"00:00"}`).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) + " at " + (task.serviceTime||"—")
                  : "Date not set"}
              </span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
              <Clock size={13} color="#a8a29e"/>
              <span style={{ fontSize:"13px", color:"#57534e" }}>Duration: {estimatedHours?`${estimatedHours} hrs`:"Not set"}</span>
            </div>
          </div>

          <div style={{ fontSize:"13px", color:"#57534e", marginBottom:"16px" }}>
            {(task.status==="cancelled"||task.status==="declined")?(
              <>
                <span style={{ color:"#a8a29e" }}>{task.status==="cancelled"?"Cancelled: ":"Declined: "}</span>
                <span style={{ fontWeight:"600", color:"#991b1b" }}>{task.cancelReason||task.declineReason||"No reason provided"}</span>
              </>
            ):(
              <>
                <span style={{ color:"#a8a29e" }}>Payment status: </span>
                <span style={{ fontWeight:"700", color:paid?"#065f46":"#b45309" }}>
                  {paid?"paid":(task.payment_status||task.paymentStatus||"unpaid")}
                </span>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
            {activeTab==="confirmed"&&(
              <>
                {paid
                  ? <Btn variant="blue" onClick={e=>{e.stopPropagation();openPaymentModal(task._id,task.assignedWorkerId,customerId);}}>View Payment</Btn>
                  : <Btn variant="primary" onClick={e=>{e.stopPropagation();openPaymentModal(task._id,task.assignedWorkerId,customerId);}}>Make Payment</Btn>
                }
                <Btn variant="primary" onClick={e=>{e.stopPropagation();openChat(task);}}>
                  <MessageCircle size={12}/> Chat
                </Btn>
              </>
            )}

            {activeTab==="in_progress"&&(
              <>
                <Btn variant="blue" onClick={e=>{e.stopPropagation();openPaymentModal(task._id,task.assignedWorkerId,customerId);}}>View Payment</Btn>
                <Btn variant="primary" onClick={e=>{e.stopPropagation();openChat(task);}}>
                  <MessageCircle size={12}/> Chat
                </Btn>
              </>
            )}

            {activeTab==="completed"&&(
              <>
                {released?(
                  <span style={{ display:"inline-flex", alignItems:"center", gap:"4px", padding:"6px 13px", borderRadius:"9999px", fontSize:"12px", fontWeight:"700", color:"#0369a1", background:"#e0f2fe", border:"1px solid #bae6fd" }}>
                    <CheckCircle size={11}/> Released
                  </span>
                ):(
                  <Btn variant="green" onClick={e=>{e.stopPropagation();releasePayment(task._id,task);}}>Release Payment</Btn>
                )}
                <Btn variant="amber" onClick={e=>{e.stopPropagation();onRateReview(task);}}>
                  <Star size={11} fill="#f59e0b" color="#f59e0b"/> Rate
                </Btn>
                <Btn variant="red" onClick={e=>{e.stopPropagation();onReport(task);}}>
                  <Flag size={11}/> Report
                </Btn>
              </>
            )}

            {activeTab==="released"&&(
              <>
                <span style={{ display:"inline-flex", alignItems:"center", gap:"4px", padding:"6px 13px", borderRadius:"9999px", fontSize:"12px", fontWeight:"700", color:"#0369a1", background:"#e0f2fe", border:"1px solid #bae6fd" }}>
                  <CheckCircle size={11}/> Payment Released
                </span>
                <Btn variant="amber" onClick={e=>{e.stopPropagation();onRateReview(task);}}>
                  <Star size={11} fill="#f59e0b" color="#f59e0b"/> Rate
                </Btn>
                <Btn variant="red" onClick={e=>{e.stopPropagation();onReport(task);}}>
                  <Flag size={11}/> Report
                </Btn>
              </>
            )}

            {!["completed","cancelled","declined","released"].includes(activeTab)&&
             !["completed","cancelled","declined"].includes(task.status)&&(
              <Btn variant="red" onClick={e=>{e.stopPropagation();setCancelTaskData(task);}}>Cancel</Btn>
            )}
          </div>
        </div>

        {/* Right: Pricing */}
        <div style={{ width:"160px", flexShrink:0, paddingLeft:"24px", display:"flex", flexDirection:"column" }}>
          <div style={{ marginBottom:"12px" }}>
            <div style={{ fontSize:"10px", color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:"2px" }}>Estimated price</div>
            <div style={{ fontSize:"15px", fontWeight:"700", color:"#111827" }}>{formatCurrency(task.workerEarnings||task.totalCost)}</div>
          </div>
          <div style={{ marginBottom:"12px" }}>
            <div style={{ fontSize:"10px", color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:"2px" }}>Estimated hours</div>
            <div style={{ fontSize:"13px", fontWeight:"600", color:task.estimatedHours?"#374151":"#f59e0b" }}>
              {task.estimatedHours||"Not set yet"}
            </div>
          </div>
          <div style={{ borderTop:"1px dashed #e5e7eb", paddingTop:"12px" }}>
            <div style={{ fontSize:"10px", color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:"2px" }}>Total cost</div>
            <div style={{ fontSize:"17px", fontWeight:"700", color:task.totalCost?"#f6a623":"#9ca3af" }}>
              {task.totalCost?formatCurrency(task.totalCost):"Pending"}
            </div>
          </div>

          <button
            onClick={e=>{e.stopPropagation();handleViewDetails(task);}}
            style={{ display:"flex", alignItems:"center", gap:"3px", marginTop:"20px", fontSize:"12px", fontWeight:"600", color:hovered?"#f6a623":"#a8a29e", background:"none", border:"none", cursor:"pointer", transition:"color 0.15s", padding:0, alignSelf:"flex-end" }}
          >
            View Details <ChevronRight size={13}/>
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const CustomerTaskPage = () => {
  const navigate = useNavigate();
  const [tasks, setTasks]               = useState([]);
  const [workers, setWorkers]           = useState({});
  const [loading, setLoading]           = useState(true);
  const [releasing, setReleasing]       = useState(false);
  const [error, setError]               = useState(null);
  const [searchQuery, setSearchQuery]   = useState("");
  const [activeTab, setActiveTab]       = useState("pending");
  const [selectedTask, setSelectedTask] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [rateReviewTask, setRateReviewTask]     = useState(null);
  const [reportTask, setReportTask]             = useState(null);
  const [successMsg, setSuccessMsg]             = useState(null);
  const [cancelTaskData, setCancelTaskData]     = useState(null);
  const [releaseTaskData, setReleaseTaskData]   = useState(null);
  const [paymentModal, setPaymentModal]         = useState(null);

  const { toasts, add: addToast, remove: removeToast } = useToast();

  const storedUser  = localStorage.getItem("user") || sessionStorage.getItem("user");
  const currentUser = storedUser ? JSON.parse(storedUser) : null;
  const customerId  = currentUser?.id || currentUser?._id;

  const showSuccess = msg => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3500); };

  const openPaymentModal = (taskId, workerId, cid) => setPaymentModal({ taskId, userId: cid, role: "customer" });
  const openChat = (task) => {
  const workerId = task.assignedWorkerId;
  if (workerId && customerId) {
    navigate(`/chat/${customerId}/${workerId}`);
  }
};

  const fetchTasks = useCallback(async (opts = {}) => {
    if (!customerId) return;
    try {
      await Promise.all([autoCancelExpiredTasks(), autoCancelConfirmedUnpaidTasks()]);
      const res  = await fetch(`${API_BASE}/tasks/user/${customerId}`);
      if (!res.ok) throw new Error(`Failed to fetch tasks (${res.status})`);
      const data = await res.json();
      const fetched = (data.tasks || []).map(t => ({ ...t, _id: String(t._id || t.id || "") }));
      setTasks([...fetched].reverse());

      if (opts.syncSelected) {
        setSelectedTask(prev => prev ? (fetched.find(t => t._id === prev._id) || prev) : prev);
        setChatTask(prev => prev ? (fetched.find(t => t._id === prev._id) || prev) : prev);
      }

      const ids = [...new Set(fetched.map(t => t.assignedWorkerId).filter(Boolean))];
      const map = {};
      await Promise.all(ids.map(async id => {
        try { const r = await fetch(`${API_BASE}/worker/${id}`); const w = await r.json(); map[id] = w.worker || w; } catch {}
      }));
      setWorkers(prev => ({ ...prev, ...map }));
    } catch (err) {
      if (opts.initial) setError(err.message);
    } finally {
      if (opts.initial) setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { fetchTasks({ initial: true }); }, [fetchTasks]);

  useEffect(() => {
    const handle = () => { if (document.visibilityState === "visible") fetchTasks({ syncSelected: true }); };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, [fetchTasks]);

  const handleWsMessage = useCallback((data) => {
    if (data.type !== "task_status") return;
    fetchTasks({ syncSelected: true });
    const toast = makeToast(data.status, data.taskName || null);
    if (toast) addToast(toast);
  }, [fetchTasks, addToast]);

  const wsUrl = customerId ? `${WS_BASE}/ws/task-updates/${customerId}` : null;
  useReconnectingWebSocket(wsUrl, handleWsMessage);

  useEffect(() => {
    let unsubscribe = () => {};
    const setup = async () => {
      try {
        const { initMessaging } = await import("../../api/notification");
        const { onMessage }     = await import("firebase/messaging");
        const messaging = await initMessaging();
        if (!messaging) return;
        unsubscribe = onMessage(messaging, (payload) => {
          fetchTasks({ syncSelected: true });
          const status   = payload.data?.status || null;
          const taskName = payload.data?.taskName || payload.notification?.title || null;
          if (status) { const t = makeToast(status, taskName); if (t) addToast(t); }
          else addToast({ color: "#f6a623", message: payload.notification?.body || "New notification." });
        });
      } catch {}
    };
    setup();
    return () => unsubscribe();
  }, [fetchTasks, addToast]);

  const releasePayment = (taskId, task) =>
    setReleaseTaskData(task || tasks.find(t => t._id === taskId) || { _id: taskId });

  const confirmReleasePayment = async () => {
    if (!releaseTaskData) return;
    setReleasing(true);
    try {
      const res  = await fetch(`http://localhost:8000/customer/release/${releaseTaskData._id}`, {
        method: "PATCH",
        headers: { "Content-Type":"application/json", Authorization:`Bearer ${currentUser?.token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to release payment");
      setReleaseTaskData(null);
      await fetchTasks({ syncSelected: true });
      addToast({ color: "#065f46", message: `Payment released! Ref: ${data.esewa_ref_id}` });
    } catch (err) {
      addToast({ color: "#991b1b", message: "Error: " + err.message });
    } finally { setReleasing(false); }
  };

  const cancelTask = async (taskId, reason, photo) => {
    let evidenceUrl = null;
    if (photo) {
      const form = new FormData(); form.append("file", photo);
      try { const r = await fetch(`${API_BASE}/upload`,{method:"POST",body:form}); if(r.ok){const d=await r.json();evidenceUrl=d.url||d.file_url||null;} } catch {}
    }
    const res  = await fetch(`${API_BASE}/task/${taskId}/cancel`, {
      method: "PATCH", headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ cancelled_by:"customer", reason, ...(evidenceUrl?{evidenceUrl}:{}) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to cancel task");
    await fetchTasks({ syncSelected: true });
    if (data.penaltyAmount>0) addToast({ color:"#991b1b", message:`Cancelled. Refund NPR ${data.refundAmount?.toFixed(2)} (penalty NPR ${data.penaltyAmount?.toFixed(2)}).` });
    else if (data.refundAmount>0) addToast({ color:"#065f46", message:`Cancelled. Full refund NPR ${data.refundAmount?.toFixed(2)} coming.` });
    else addToast({ color:"#991b1b", message:"Task cancelled." });
  };

  const handleViewDetails = task => { setSelectedTask(task); setShowDetailsModal(true); };

  const filteredTasks = tasks.filter(t => {
    const q            = searchQuery.toLowerCase();
    const escrowStatus = String(t?.escrow_status || "").toLowerCase().trim();
    const worker       = workers[t.assignedWorkerId];
    const workerName   = worker ? `${worker.firstName||""} ${worker.lastName||""}`.toLowerCase() : "";
    const matchesSearch =
      t.taskName?.toLowerCase().includes(q) ||
      t.taskDescrip?.toLowerCase().includes(q) ||
      workerName.includes(q);

    if (activeTab === "released")  return matchesSearch && t.status === "completed" && escrowStatus === "released";
    if (activeTab === "completed") return matchesSearch && t.status === "completed" && escrowStatus !== "released";
    return matchesSearch && (activeTab === "all" || (t.status || "pending") === activeTab);
  });

  const taskCounts = tasks.reduce((acc, t) => {
    const s            = t.status || "pending";
    const escrowStatus = String(t?.escrow_status || "").toLowerCase().trim();
    const released     = s === "completed" && escrowStatus === "released";
    if (released) acc["released"] = (acc["released"] || 0) + 1;
    else          acc[s]          = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const TABS = [
    { id:"all",         label:"All"         },
    { id:"pending",     label:"Pending"     },
    { id:"confirmed",   label:"Confirmed"   },
    { id:"in_progress", label:"In Progress" },
    { id:"completed",   label:"Completed"   },
    { id:"released",    label:"Released"    },
    { id:"cancelled",   label:"Cancelled"   },
    { id:"declined",    label:"Declined"    },
  ];

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f9f6ef" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:"36px", height:"36px", border:"3px solid #ece6d9", borderTop:"3px solid #f6a623", borderRadius:"50%", animation:"spin 0.75s linear infinite", margin:"0 auto" }}/>
        <p style={{ marginTop:"12px", color:"#a8a29e", fontWeight:"600", fontSize:"13px" }}>Loading your tasks…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f9f6ef" }}>
      <div style={{ background:"white", borderRadius:"14px", padding:"2rem", maxWidth:"320px", textAlign:"center", border:"1px solid #ece6d9" }}>
        <XCircle size={40} color="#ef4444"/>
        <h3 style={{ marginTop:"1rem", fontWeight:"800", color:"#1c1008" }}>Something went wrong</h3>
        <p style={{ color:"#78716c", fontSize:"13px" }}>{error}</p>
        <button onClick={()=>navigate("/login")} style={{ marginTop:"1rem", padding:"9px 18px", background:"#f6a623", color:"white", border:"none", borderRadius:"8px", fontWeight:"700", cursor:"pointer", fontSize:"13px" }}>Go to Login</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#f9f6ef", fontFamily:'"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <BookingNavbar/>
      <ToastContainer toasts={toasts} removeToast={removeToast}/>

      {successMsg&&(
        <div style={{ position:"fixed", bottom:"24px", right:"24px", zIndex:9999, background:"#1c1008", color:"white", padding:"12px 18px", borderRadius:"12px", fontSize:"13px", fontWeight:"600", display:"flex", alignItems:"center", gap:"8px", boxShadow:"0 8px 24px rgba(0,0,0,0.18)" }}>
          <CheckCircle size={14} color="#34d399"/> {successMsg}
        </div>
      )}

      {releasing&&(
        <div style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(15,23,42,0.55)", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}>
          <div style={{ background:"white", borderRadius:"16px", padding:"2rem", textAlign:"center", boxShadow:"0 24px 48px rgba(0,0,0,0.2)" }}>
            <div style={{ width:"34px", height:"34px", border:"3px solid #ece6d9", borderTop:"3px solid #f6a623", borderRadius:"50%", animation:"spin 0.75s linear infinite", margin:"0 auto" }}/>
            <p style={{ marginTop:"1rem", fontWeight:"800", color:"#1c1008" }}>Releasing payment…</p>
            <p style={{ color:"#a8a29e", fontSize:"12px", marginTop:"4px" }}>Please don't close this page</p>
          </div>
        </div>
      )}

      <main style={{ maxWidth:"1280px", margin:"0 auto", padding:"2rem 1.5rem" }}>
        <div style={{ marginBottom:"1.75rem" }}>
          <h1 style={{ fontSize:"26px", fontWeight:"900", color:"#1c1008", margin:"0 0 4px", letterSpacing:"-0.02em" }}>My Tasks</h1>
          <p style={{ fontSize:"13px", color:"#a8a29e", fontWeight:"500", margin:0 }}>View and manage your service requests</p>
        </div>

        {/* Search */}
        <div style={{ position:"relative", maxWidth:"320px", marginBottom:"1.25rem" }}>
          <Search size={13} style={{ position:"absolute", left:"12px", top:"50%", transform:"translateY(-50%)", color:"#a8a29e" }}/>
          <input
            type="text" placeholder="Search tasks or workers…" value={searchQuery}
            onChange={e=>setSearchQuery(e.target.value)}
            style={{ width:"100%", padding:"9px 14px 9px 34px", borderRadius:"9999px", border:"1.5px solid #e8dfd0", fontSize:"13px", outline:"none", background:"white", boxSizing:"border-box", color:"#1c1008", transition:"border-color 0.2s" }}
            onFocus={e=>e.target.style.borderColor="#f6a623"}
            onBlur={e=>e.target.style.borderColor="#e8dfd0"}
          />
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:"6px", marginBottom:"1.5rem", flexWrap:"wrap" }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            const count  = tab.id !== "all" ? taskCounts[tab.id] : null;
            return (
              <button
                key={tab.id} onClick={()=>setActiveTab(tab.id)}
                style={{ padding:"7px 16px", borderRadius:"9999px", fontWeight:"700", fontSize:"13px", border:active?"none":"1.5px solid #e8dfd0", background:active?"#1c1008":"white", color:active?"white":"#78716c", cursor:"pointer", display:"flex", alignItems:"center", gap:"5px", transition:"all 0.15s" }}
                onMouseEnter={e=>{if(!active){e.currentTarget.style.borderColor="#f6a623";e.currentTarget.style.color="#f6a623";}}}
                onMouseLeave={e=>{if(!active){e.currentTarget.style.borderColor="#e8dfd0";e.currentTarget.style.color="#78716c";}}}
              >
                {tab.label}
                {count>0&&(
                  <span style={{ background:active?"rgba(255,255,255,0.2)":"#f5efe6", borderRadius:"9999px", padding:"1px 7px", fontSize:"11px", fontWeight:"800", color:active?"white":"#b45309" }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Task list */}
        {filteredTasks.length===0?(
          <div style={{ textAlign:"center", padding:"56px 24px", background:"white", borderRadius:"16px", border:"1px dashed #e8dfd0" }}>
            <div style={{ width:"48px", height:"48px", background:"#f5efe6", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}>
              <Search size={20} color="#c4bab0"/>
            </div>
            <p style={{ color:"#a8a29e", fontWeight:"600", fontSize:"14px", margin:0 }}>No tasks found for this filter.</p>
          </div>
        ):(
          filteredTasks.map(task=>(
            <TaskCard
              key={String(task._id||task.id)}
              activeTab={activeTab}
              task={task}
              worker={workers[task.assignedWorkerId]}
              handleViewDetails={handleViewDetails}
              openPaymentModal={openPaymentModal}
              releasePayment={releasePayment}
              customerId={customerId}
              openChat={openChat}
              onRateReview={setRateReviewTask}
              onReport={setReportTask}
              setCancelTaskData={setCancelTaskData}
            />
          ))
        )}
      </main>

      {paymentModal&&(
        <PaymentFlow
          taskIdProp={paymentModal.taskId}
          userIdProp={paymentModal.userId}
          roleProp={paymentModal.role}
          onClose={()=>{setPaymentModal(null);fetchTasks({syncSelected:true});}}
        />
      )}
      {showDetailsModal&&selectedTask&&(
        <TaskModal
          task={selectedTask}
          worker={workers[selectedTask.assignedWorkerId]}
          setShowDetailsModal={setShowDetailsModal}
        />
      )}
      {rateReviewTask&&(
        <RateReviewModal
          task={rateReviewTask}
          worker={workers[rateReviewTask.assignedWorkerId]}
          customerId={customerId}
          onClose={()=>setRateReviewTask(null)}
          onSubmitted={()=>showSuccess("Review submitted!")}
        />
      )}
      {reportTask&&(
        <ReportModal
          task={reportTask}
          worker={workers[reportTask.assignedWorkerId]}
          customerId={customerId}
          onClose={()=>setReportTask(null)}
          onSubmitted={()=>showSuccess("Report submitted. We'll review it.")}
        />
      )}
      {cancelTaskData&&(
        <CancelTaskModal
          task={cancelTaskData}
          onClose={()=>setCancelTaskData(null)}
          onSubmit={(reason,photo)=>cancelTask(cancelTaskData._id,reason,photo)}
        />
      )}
      {releaseTaskData&&(
        <ReleasePaymentModal
          task={releaseTaskData}
          releasing={releasing}
          onClose={()=>setReleaseTaskData(null)}
          onConfirm={confirmReleasePayment}
        />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

export default CustomerTaskPage;