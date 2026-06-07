import React, { useEffect, useState, useRef } from "react";
import {
  Search, Calendar, MapPin, DollarSign, Clock, ChevronRight,
  Phone, Mail, MessageCircle, XCircle, CheckCircle, AlertCircle,
  Loader, User, Check, X, Home, Briefcase, ThumbsUp, ThumbsDown, Flag
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import BookingNavbar from "../components/Navbar/Navbar";
import {
  updateTaskStatus, getTasksByWorker, fetchCustomerById,
  fetchWorkerById, getPaymentStatus, cancelWorkerTask
} from "../api/api";
import ReportModal from "../components/Report/ReportSection";
import ChatWidget from "../components/HelpSection/HelpSection";

// ── Global responsive styles ──────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @keyframes toastIn  { from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)} }
    @keyframes toastBar { from{width:100%}to{width:0%} }
    @keyframes spin { to { transform: rotate(360deg); } }
    * { box-sizing: border-box; }

    .request-card-grid {
      display: grid;
      grid-template-columns: 200px 1fr 160px;
      gap: 0;
      align-items: start;
    }
    .card-left   { padding-right: 24px; border-right: 1px solid #f0ebe2; }
    .card-middle { padding: 0 24px;     border-right: 1px solid #f0ebe2; }
    .card-right  { padding-left: 24px;  display: flex; flex-direction: column; }

    .summary-pills { display: flex; gap: 10px; flex-wrap: wrap; }
    .tabs-row { display: flex; gap: 6px; margin-bottom: 1.5rem; flex-wrap: wrap; }

    @media (max-width: 900px) {
      .request-card-grid { grid-template-columns: 1fr; }
      .card-left { padding-right: 0; border-right: none; border-bottom: 1px solid #f0ebe2; padding-bottom: 14px; margin-bottom: 14px; }
      .card-middle { padding: 0; border-right: none; border-bottom: 1px solid #f0ebe2; padding-bottom: 14px; margin-bottom: 14px; }
      .card-right { padding-left: 0; }
    }

    @media (max-width: 600px) {
      .tv-main    { padding: 1rem !important; }
      .page-title { font-size: 20px !important; }
      .summary-pills { display: grid; grid-template-columns: 1fr 1fr; }
    }

    @media (min-width: 1600px) {
      .tv-main { max-width: 1800px !important; padding: 3rem 4rem !important; }
      .page-title    { font-size: 38px !important; }
      .page-subtitle { font-size: 1rem !important; }
      .summary-pill        { padding: 14px 24px !important; min-width: 100px !important; border-radius: 18px !important; }
      .summary-pill-value  { font-size: 26px !important; }
      .summary-pill-label  { font-size: 12px !important; }
      .search-box    { max-width: 460px !important; }
      .search-input  { font-size: 1rem !important; height: 46px !important; padding-left: 42px !important; }
      .search-icon   { left: 16px !important; }
      .tab-btn       { font-size: 15px !important; padding: 9px 20px !important; }
      .request-card  { padding: 28px 32px !important; border-radius: 22px !important; }
      .request-card-grid { grid-template-columns: 260px 1fr 200px !important; }
      .card-left     { padding-right: 32px !important; }
      .card-middle   { padding: 0 32px !important; }
      .card-right    { padding-left: 32px !important; }
      .customer-avatar     { width: 60px !important; height: 60px !important; font-size: 24px !important; }
      .customer-name       { font-size: 17px !important; }
      .customer-task-label { font-size: 13px !important; }
      .hourly-rate         { font-size: 13px !important; }
      .detail-icon    { width: 16px !important; height: 16px !important; }
      .detail-text    { font-size: 15px !important; }
      .task-desc      { font-size: 16px !important; margin-bottom: 16px !important; }
      .action-btn     { font-size: 14px !important; padding: 8px 18px !important; }
      .price-label    { font-size: 12px !important; }
      .price-value    { font-size: 18px !important; }
      .total-value    { font-size: 22px !important; }
      .modal-inner    { max-width: 720px !important; padding: 2.5rem !important; }
      .modal-title    { font-size: 22px !important; }
      .modal-details  { gap: 1.5rem !important; }
      .modal-det-label { font-size: 12px !important; }
      .modal-det-value { font-size: 17px !important; }
      .decline-modal  { max-width: 560px !important; padding: 2.5rem !important; }
      .decline-chip   { font-size: 14px !important; padding: 7px 16px !important; }
      .decline-area   { font-size: 15px !important; min-height: 100px !important; }
      .toast-container { top: 100px !important; right: 28px !important; }
      .toast-item      { min-width: 320px !important; max-width: 420px !important; font-size: 15px !important; padding: 16px 20px !important; }
    }
  `}</style>
);

// ── Toast System ──────────────────────────────────────────────────────────────
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
  <div className="toast-container" style={{
    position: "fixed", top: "80px", right: "20px", zIndex: 9999,
    display: "flex", flexDirection: "column", gap: "10px",
    alignItems: "flex-end", pointerEvents: "none",
  }}>
    {toasts.map(t => (
      <div key={t.id} className="toast-item" style={{
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
        <div style={{ position: "absolute", bottom: 0, left: 0, height: "2px", width: "100%", background: "#f5efe6" }}>
          <div style={{ height: "100%", background: t.color, opacity: 0.6, animation: "toastBar 10s linear forwards" }}/>
        </div>
      </div>
    ))}
  </div>
);

const makeToast = (event, taskName) => {
  const label = taskName ? `"${taskName}"` : "A task";
  const map = {
    new_task:    { color: "#f59e0b", message: `New request: ${label} has been assigned to you.` },
    confirmed:   { color: "#059669", message: `${label} has been confirmed.` },
    in_progress: { color: "#2563eb", message: `${label} is now in progress.` },
    completed:   { color: "#065f46", message: `${label} has been marked as completed.` },
    declined:    { color: "#dc2626", message: `${label} was declined.` },
    cancelled:   { color: "#991b1b", message: `${label} was cancelled.` },
  };
  return map[event] || null;
};

const showNativePush = (title, body, onClick) => {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (document.visibilityState === "visible" && document.hasFocus()) return;
  const n = new Notification(title, { body, icon: "/icon-192.png", badge: "/icon-192.png", tag: "new-task", renotify: true });
  if (onClick) n.onclick = onClick;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const isOfferReady = (request) =>
  request?.estimatedHours && request?.totalCost && Number(request.totalCost) > 0;

const Btn = ({ onClick, variant = "default", children, disabled, title, style: extraStyle }) => {
  const V = {
    default: { color: "#78716c", bg: "white",   border: "#e2d9cc" },
    primary: { color: "#f6a623", bg: "#fffbf2", border: "#fde68a" },
    blue:    { color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" },
    green:   { color: "#065f46", bg: "#f0fdf4", border: "#a7f3d0" },
    red:     { color: "#991b1b", bg: "#fef2f2", border: "#fecaca" },
    amber:   { color: "#b45309", bg: "#fffbf2", border: "#fde68a" },
    gray:    { color: "#9ca3af", bg: "#f3f4f6", border: "#e5e7eb" },
    cyan:    { color: "#f6a623", bg: "#fffbf2", border: "#fde68a" },
  };
  const v = V[variant] || V.default;
  return (
    <button
      onClick={onClick} disabled={disabled} title={title}
      style={{
        display: "inline-flex", alignItems: "center", gap: "6px",
        padding: "9px 18px",
        minHeight: "38px",
        borderRadius: "9999px",
        fontSize: "13px",
        fontWeight: "600",
        color: v.color,
        background: disabled ? "#f3f4f6" : v.bg,
        border: `1.5px solid ${disabled ? "#e5e7eb" : v.border}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "opacity 0.15s",
        whiteSpace: "nowrap",
        ...extraStyle,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = "0.75"; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
    >{children}</button>
  );
};

const STATUS_CFG = {
  pending:     { color: "#b45309", bg: "#fef9ee", border: "#fde68a", dot: "#f59e0b", label: "Pending"     },
  confirmed:   { color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe", dot: "#8b5cf6", label: "Confirmed"   },
  in_progress: { color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe", dot: "#3b82f6", label: "In Progress" },
  completed:   { color: "#065f46", bg: "#f0fdf4", border: "#a7f3d0", dot: "#10b981", label: "Completed"   },
  cancelled:   { color: "#991b1b", bg: "#fef2f2", border: "#fecaca", dot: "#ef4444", label: "Cancelled"   },
  declined:    { color: "#991b1b", bg: "#fef2f2", border: "#fecaca", dot: "#ef4444", label: "Declined"    },
};

const StatusPill = ({ status }) => {
  const c = STATUS_CFG[status] || STATUS_CFG.pending;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 10px", borderRadius: "9999px",
      fontSize: "11px", fontWeight: "700", letterSpacing: "0.02em",
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: c.dot, display: "inline-block" }}/>
      {c.label}
    </span>
  );
};

// ── Cancel Reason Modal ───────────────────────────────────────────────────────
const CancelReasonModal = ({ onConfirm, onClose }) => {
  const [reason, setReason] = useState("");
  const QUICK_REASONS = [
    "Personal emergency",
    "Schedule conflict",
    "Customer unresponsive",
    "Safety concern",
    "Incorrect task details",
    "Equipment unavailable",
  ];

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1020, backdropFilter: "blur(4px)" }}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: "20px", padding: "1.8rem", maxWidth: "460px", width: "90%", boxShadow: "0 24px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <XCircle size={18} color="#ef4444" />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#1c1008", margin: 0 }}>Cancel Task</h3>
          </div>
          <button onClick={onClose} style={{ background: "#f5efe6", border: "none", cursor: "pointer", color: "#78716c", width: "30px", height: "30px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>×</button>
        </div>
        <p style={{ fontSize: "13px", color: "#a8a29e", margin: "0 0 16px 46px", fontWeight: "500", lineHeight: "1.5" }}>
          Please let the customer know why you're cancelling. This cannot be undone.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
          {QUICK_REASONS.map(r => (
            <button key={r} onClick={() => setReason(r)} style={{ padding: "5px 13px", borderRadius: "9999px", fontSize: "12px", fontWeight: "600", border: reason === r ? "none" : "1.5px solid #e8dfd0", background: reason === r ? "#ef4444" : "white", color: reason === r ? "white" : "#78716c", cursor: "pointer", transition: "all 0.15s" }}>
              {r}
            </button>
          ))}
        </div>
        <textarea placeholder="Or write a custom reason…" value={reason} onChange={e => setReason(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e8dfd0", borderRadius: "10px", fontSize: "13px", minHeight: "80px", resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: "16px", transition: "border-color 0.2s", color: "#1c1008" }}
          onFocus={e => e.target.style.borderColor = "#ef4444"} onBlur={e => e.target.style.borderColor = "#e8dfd0"}
        />
        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", marginBottom: "16px", fontSize: "12px", color: "#92400e" }}>
          <AlertCircle size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: "1px" }} />
          Cancelling may affect your reliability rating. Only cancel when absolutely necessary.
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "1.5px solid #e8dfd0", background: "white", fontSize: "13px", fontWeight: "700", cursor: "pointer", color: "#78716c" }}>Go Back</button>
          <button onClick={() => { if (reason.trim()) onConfirm(reason.trim()); }} disabled={!reason.trim()}
            style={{ flex: 2, padding: "11px", borderRadius: "10px", border: "none", background: !reason.trim() ? "#e5e7eb" : "#ef4444", fontSize: "13px", fontWeight: "700", cursor: !reason.trim() ? "not-allowed" : "pointer", color: !reason.trim() ? "#9ca3af" : "white", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            <XCircle size={14} /> Confirm Cancellation
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const WorkerTaskRequestsPage = () => {
  const navigate = useNavigate();
  const [requests,             setRequests]             = useState([]);
  const [loading,              setLoading]              = useState(true);
  const [error,                setError]                = useState(null);
  const [searchQuery,          setSearchQuery]          = useState("");
  const [activeTab,            setActiveTab]            = useState("pending");
  const [selectedRequest,      setSelectedRequest]      = useState(null);
  const [showDetailsModal,     setShowDetailsModal]     = useState(false);
  const [processingAction,     setProcessingAction]     = useState(null);
  const [showDeclineModal,     setShowDeclineModal]     = useState(false);
  const [declineReason,        setDeclineReason]        = useState("");
  const [decliningRequestId,   setDecliningRequestId]   = useState(null);
  const [reportTask,           setReportTask]           = useState(null);
  const [showCancelModal,      setShowCancelModal]      = useState(false);
  const [cancellingRequestId,  setCancellingRequestId]  = useState(null);

  const { toasts, add: addToast, remove: removeToast } = useToast();

  const storedUser = localStorage.getItem("user") || sessionStorage.getItem("user");
  const workerId   = storedUser ? JSON.parse(storedUser).id : null;
  const wsRef      = useRef(null);

  const getTaskPaymentStatus = async (taskId) => {
    try { const data = await getPaymentStatus(taskId); return data?.task_status || "pending"; }
    catch { return "error"; }
  };

  const enrichTask = async (task) => {
    let customerData = null, workerData = null, paymentStatus = null;
    try {
      customerData  = await fetchCustomerById(task.userId);
      workerData    = await fetchWorkerById(task.assignedWorkerId);
      paymentStatus = await getTaskPaymentStatus(task.id || task._id);
    } catch (err) { console.error("[enrich] Failed:", err); }
    const workerEarnings = parseInt(workerData?.basePrice || 0) * parseInt(task.completionTime || 0);
    return {
      ...task, paymentStatus,
      customerId:     task.userId,
      customerName:   customerData?.first_name || "Customer",
      customerPhone:  customerData?.phoneNo    || "N/A",
      customerEmail:  customerData?.email      || "N/A",
      address:        task.address,
      totalCost:      task.totalCost,
      workerEarnings: workerEarnings || task.totalCost || 0,
      hourlyRate:     workerData?.basePrice,
      preferredDate:  task.serviceDate    || "None shown",
      preferredTime:  task.serviceTime || task.serviceTIme || "Flexible",
      estimatedHours: task.estimatedHours || task.completionTime || null,
      declineReason:  task.declineReason  || task.decline_reason  || null,
      cancelReason:   task.cancelReason   || task.cancel_reason   || null,
      profile: customerData?.profile_picture || null,
    };
  };

  const filteredRequests = requests.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      r.taskName?.toLowerCase().includes(q) ||
      r.taskDescrip?.toLowerCase().includes(q) ||
      r.customerName?.toLowerCase().includes(q);
    const status = r.status || "pending";
    return matchesSearch && (activeTab === "all" || status === activeTab);
  });

  // ── WebSocket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!workerId) return;
    let retryDelay = 1000, retryTimer = null, pingTimer = null, active = true;

    const handleMessage = async (event) => {
      try {
        const data = JSON.parse(typeof event === "string" ? event : event.data);
        if (data.type === "pong" || data.type === "ping") return;

        if (data.type === "new_task") {
          try {
            const rawTask = {
              id: data.taskId, _id: data.taskId,
              taskName: data.taskType, taskDescrip: data.note,
              address: data.address, serviceDate: data.serviceDate,
              serviceTime: data.serviceTime, totalCost: data.totalCost,
              estimatedHours: data.estimatedHours, completionTime: data.estimatedHours,
              status: "pending", userId: data.userId, assignedWorkerId: workerId,
            };
            const enriched = await enrichTask(rawTask);
            setRequests(prev => {
              const exists = prev.some(r => String(r._id || r.id) === String(data.taskId));
              return exists ? prev : [enriched, ...prev];
            });
            const toast = makeToast("new_task", data.taskType || "A task");
            if (toast) addToast(toast);
            showNativePush("New Task Request 🔔", `You have a new task: "${data.taskType || "A task"}"`,
              () => { window.focus(); navigate("/worker/requests"); });
          } catch (err) { console.error("[WorkerWS] enrichTask failed:", err); }
        }

        if (data.type === "task_status") {
          setRequests(prev => prev.map(r => String(r._id || r.id) === String(data.taskId) ? { ...r, status: data.status } : r));
          setSelectedRequest(prev => prev && String(prev._id || prev.id) === String(data.taskId) ? { ...prev, status: data.status } : prev);
          const task  = requests.find(r => String(r._id || r.id) === String(data.taskId));
          const toast = makeToast(data.status, task?.taskName);
          if (toast) addToast(toast);
        }

        if (data.type === "offer_updated") {
          setRequests(prev => prev.map(r => String(r._id || r.id) === String(data.taskId)
            ? { ...r, estimatedHours: data.estimatedHours, totalCost: data.totalCost, offerStatus: data.offerStatus } : r));
        }

        if (data.type === "payment_updated" || data.type === "payment_status") {
          const newPaymentStatus = data.paymentStatus || data.status;
          setRequests(prev => prev.map(r =>
            String(r._id || r.id) === String(data.taskId) ? { ...r, paymentStatus: newPaymentStatus } : r
          ));
          setSelectedRequest(prev =>
            prev && String(prev._id || prev.id) === String(data.taskId)
              ? { ...prev, paymentStatus: newPaymentStatus } : prev
          );
          if (newPaymentStatus === "paid") {
            const task = requests.find(r => String(r._id || r.id) === String(data.taskId));
            addToast({ color: "#059669", message: `Payment received for "${task?.taskName || "a task"}" — you can now start work!` });
          }
        }
      } catch (err) { console.error("[WorkerWS] message handling failed:", err); }
    };

    const flushPending = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/notifications/pending/${workerId}`);
        if (!res.ok) return;
        const { messages = [] } = await res.json();
        for (const msg of messages) await handleMessage(JSON.stringify(msg));
      } catch (err) { console.error("[WorkerWS] flush error:", err); }
    };

    const connect = () => {
      if (!active) return;
      const ws = new WebSocket(`ws://127.0.0.1:8000/ws/task-updates/${workerId}`);
      wsRef.current = ws;
      ws.onopen = () => {
        retryDelay = 1000;
        pingTimer = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" })); }, 25000);
        flushPending();
      };
      ws.onmessage = handleMessage;
      ws.onerror   = (e) => console.error("[WorkerWS] error:", e);
      ws.onclose   = () => {
        clearInterval(pingTimer);
        if (!active) return;
        retryTimer = setTimeout(() => { retryDelay = Math.min(retryDelay * 2, 30000); connect(); }, retryDelay);
      };
    };

    connect();
    const onVisible = () => { if (document.visibilityState === "visible") flushPending(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearTimeout(retryTimer); clearInterval(pingTimer);
      wsRef.current?.close();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [workerId]); // eslint-disable-line

  useEffect(() => {
    if (!workerId) return;
    const registerToken = async () => {
      try {
        const { initMessaging }              = await import("../api/firebase");
        const { requestNotificationPermission } = await import("../api/notification");
        const messaging = await initMessaging();
        if (!messaging) return;
        const token = await requestNotificationPermission();
        if (!token) return;
        await fetch("http://127.0.0.1:8000/api/notifications/save-token", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: workerId, token }),
        });
      } catch (err) { console.error("[FCM] Token registration failed:", err); }
    };
    registerToken();
  }, [workerId]);

  useEffect(() => {
    if (!workerId) return;
    let unsubscribe = () => {};
    const setup = async () => {
      try {
        const { initMessaging } = await import("../api/firebase");
        const { onMessage }     = await import("firebase/messaging");
        const messaging = await initMessaging();
        if (!messaging) return;
        unsubscribe = onMessage(messaging, (payload) => {
          const eventType = payload.data?.event_type || "new_task";
          const taskName  = payload.data?.taskName || payload.notification?.title || null;
          const toast = makeToast(eventType, taskName);
          if (toast) addToast(toast);
        });
      } catch (err) { console.error("[FCM] Foreground listener failed:", err); }
    };
    setup();
    return () => unsubscribe();
  }, [workerId]);

  useEffect(() => {
    const fetchRequests = async () => {
      if (!workerId) { setLoading(false); return; }
      try {
        const data     = await getTasksByWorker(workerId);
        const enriched = await Promise.all((data.tasks || []).map(enrichTask));
        enriched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setRequests(enriched);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, [workerId]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleViewDetails = (request) => { setSelectedRequest(request); setShowDetailsModal(true); };
  const handleViewCustomerProfile = (customerId, customerName) =>
    navigate(`/customer-profile/${customerId}`, { state: { customerId, customerName } });

  const handleAcceptRequest = async (requestId) => {
    const task = requests.find(r => String(r._id || r.id) === String(requestId));
    if (!isOfferReady(task)) { addToast({ color: "#b45309", message: "Cannot accept: estimated hours and total cost must be set first." }); return; }
    setProcessingAction(requestId);
    try {
      await updateTaskStatus(requestId, "confirmed");
      const apply = (r) => String(r._id || r.id) === String(requestId) ? { ...r, status: "confirmed" } : r;
      setRequests(prev => prev.map(apply));
      setSelectedRequest(prev => prev ? apply(prev) : prev);
      const toast = makeToast("confirmed", task?.taskName || task?.taskDescrip);
      if (toast) addToast(toast);
    } catch (err) {
      addToast({ color: "#dc2626", message: err?.message || "Failed to accept request. Please try again." });
    } finally { setProcessingAction(null); }
  };

  const handleDeclineRequest = (requestId) => { setDecliningRequestId(requestId); setDeclineReason(""); setShowDeclineModal(true); };

  const confirmDecline = async () => {
    if (!declineReason.trim()) { addToast({ color: "#dc2626", message: "Please provide a reason for declining." }); return; }
    setProcessingAction(decliningRequestId);
    setShowDeclineModal(false);
    const task = requests.find(r => String(r._id || r.id) === String(decliningRequestId));
    try {
      await updateTaskStatus(decliningRequestId, "declined", declineReason);
      const apply = (r) => String(r._id || r.id) === String(decliningRequestId) ? { ...r, status: "declined", declineReason } : r;
      setRequests(prev => prev.map(apply));
      setSelectedRequest(prev => prev ? apply(prev) : prev);
      const toast = makeToast("declined", task?.taskName || task?.taskDescrip);
      if (toast) addToast(toast);
    } catch {
      addToast({ color: "#dc2626", message: "Failed to decline request. Please try again." });
    } finally { setProcessingAction(null); setDecliningRequestId(null); }
  };

  const handleCancelRequest = (requestId) => { setCancellingRequestId(requestId); setShowCancelModal(true); };

  const confirmCancel = async (reason) => {
    setShowCancelModal(false);
    setProcessingAction(cancellingRequestId);
    try {
      await cancelWorkerTask(cancellingRequestId, "worker", reason);
      const apply = (r) => String(r._id || r.id) === String(cancellingRequestId)
        ? { ...r, status: "cancelled", cancelReason: reason, cancelledBy: "tasker" } : r;
      setRequests(prev => prev.map(apply));
      setSelectedRequest(prev => prev ? apply(prev) : prev);
    } catch (err) {
      addToast({ color: "#dc2626", message: err?.message || "Failed to cancel task. Please try again." });
    } finally { setProcessingAction(null); setCancellingRequestId(null); }
  };

  const handleStartWork = async (requestId) => {
    const task = requests.find(r => String(r._id || r.id) === String(requestId));
    if ((task?.paymentStatus || "").toLowerCase() !== "paid") {
      addToast({ color: "#991b1b", message: "Cannot start work — customer has not paid yet." }); return;
    }
    setProcessingAction(requestId);
    try {
      await updateTaskStatus(requestId, "in_progress");
      setRequests(prev => prev.map(r => String(r._id || r.id) === String(requestId) ? { ...r, status: "in_progress" } : r));
      const toast = makeToast("in_progress", task?.taskName || task?.taskDescrip);
      if (toast) addToast(toast);
    } catch (err) {
      addToast({ color: "#dc2626", message: err?.message || "Failed to start work." });
    } finally { setProcessingAction(null); }
  };

  const handleCompleteTask = async (requestId) => {
    if (!window.confirm("Mark this task as completed?")) return;
    setProcessingAction(requestId);
    const task = requests.find(r => String(r._id || r.id) === String(requestId));
    try {
      await updateTaskStatus(requestId, "completed");
      const apply = (r) => String(r._id || r.id) === String(requestId) ? { ...r, status: "completed" } : r;
      setRequests(prev => prev.map(apply));
      setSelectedRequest(prev => prev ? apply(prev) : prev);
      const toast = makeToast("completed", task?.taskName || task?.taskDescrip);
      if (toast) addToast(toast);
    } catch {
      addToast({ color: "#dc2626", message: "Failed to update task status. Please try again." });
    } finally { setProcessingAction(null); }
  };

  const sendChatMessage      = (userId) => navigate(`/chat/${workerId}/${userId}`);
  const handleContactSupport = ()       => navigate("/helpSection");
  const handleReport         = (request) => setReportTask(request);

  const formatDate = (d) => {
    if (!d) return "Not set";
    try {
      return new Date(d).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Kathmandu",
      });
    } catch { return d; }
  };
  const formatCurrency = (amount) => !amount ? "NPR 0" : `NPR ${Number(amount).toLocaleString("en-IN")}`;

  const pendingCount   = requests.filter(r => r.status === "pending").length;
  const acceptedCount  = requests.filter(r => r.status === "confirmed").length;
  const completedCount = requests.filter(r => r.status === "completed").length;
  const totalEarnings  = requests.filter(r => r.status === "completed").reduce((s, r) => s + (r.totalCost || 0), 0);

  const TABS = ["all","pending","confirmed","in_progress","completed","declined","cancelled"];
  const taskCounts = requests.reduce((acc, r) => { const s = r.status || "pending"; acc[s] = (acc[s] || 0) + 1; return acc; }, {});

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9f6ef" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: "36px", height: "36px", border: "3px solid #ece6d9", borderTop: "3px solid #f6a623", borderRadius: "50%", animation: "spin 0.75s linear infinite", margin: "0 auto" }}/>
        <p style={{ marginTop: "12px", color: "#a8a29e", fontWeight: "600", fontSize: "13px" }}>Loading your requests…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9f6ef" }}>
      <div style={{ background: "white", borderRadius: "14px", padding: "2rem", maxWidth: "320px", textAlign: "center", border: "1px solid #ece6d9" }}>
        <XCircle size={40} color="#ef4444"/>
        <h3 style={{ marginTop: "1rem", fontWeight: "800", color: "#1c1008" }}>Error Loading Requests</h3>
        <p style={{ color: "#78716c", fontSize: "13px" }}>{error}</p>
        <button onClick={() => window.location.reload()} style={{ marginTop: "1rem", padding: "9px 18px", background: "#f6a623", color: "white", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer", fontSize: "13px" }}>Try Again</button>
      </div>
    </div>
  );

  // ── Dispute helpers (used in modal + card) ────────────────────────────────
  const getDisputeState = (request) => {
    const d = request?.dispute;
    if (d === true || d === "true")   return "open";
    if (d === "rejected")              return "rejected";
    return null;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9f6ef", fontFamily: '"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', color: "#1c1008" }}>
      <GlobalStyles />
      <BookingNavbar/>
      <ChatWidget/>
      <ToastContainer toasts={toasts} removeToast={removeToast}/>

      <main className="tv-main" style={{ maxWidth: "1280px", margin: "0 auto", padding: "2rem 1.5rem" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1.25rem", marginBottom: "1.75rem" }}>
          <div>
            <h1 className="page-title" style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: "900", color: "#1c1008", margin: "0 0 4px", letterSpacing: "-0.02em" }}>Your Task Details</h1>
            <p className="page-subtitle" style={{ color: "#a8a29e", fontSize: "13px", fontWeight: "500", margin: 0 }}>Manage incoming requests from customers</p>
          </div>
          <div className="summary-pills">
            {[
              { label: "Pending",   value: pendingCount,                  dotColor: "#f59e0b" },
              { label: "Accepted",  value: acceptedCount,                 dotColor: "#8b5cf6" },
              { label: "Completed", value: completedCount,                dotColor: "#10b981" },
              { label: "Earnings",  value: formatCurrency(totalEarnings), dotColor: "#f6a623" },
            ].map(({ label, value, dotColor }) => (
              <div key={label} className="summary-pill" style={{ textAlign: "center", background: "white", border: "1px solid #ede8df", borderRadius: "14px", padding: "10px 18px", minWidth: "74px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div className="summary-pill-value" style={{ fontSize: "18px", fontWeight: "900", color: "#1c1008" }}>{value}</div>
                <div className="summary-pill-label" style={{ fontSize: "10px", color: "#a8a29e", fontWeight: "700", marginTop: "3px", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: dotColor, display: "inline-block" }}/>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="search-box" style={{ position: "relative", maxWidth: "320px", marginBottom: "1.25rem" }}>
          <Search size={13} className="search-icon" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#a8a29e" }}/>
          <input type="text" placeholder="Search by task or customer name…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="search-input"
            style={{ width: "100%", padding: "9px 14px 9px 34px", borderRadius: "9999px", border: "1.5px solid #e8dfd0", fontSize: "13px", outline: "none", background: "white", boxSizing: "border-box", color: "#1c1008", transition: "border-color 0.2s" }}
            onFocus={e => e.target.style.borderColor = "#f6a623"} onBlur={e => e.target.style.borderColor = "#e8dfd0"}
          />
        </div>

        {/* Tabs */}
        <div className="tabs-row">
          {TABS.map(tab => {
            const active = activeTab === tab;
            const count  = tab !== "all" ? taskCounts[tab] : null;
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} className="tab-btn"
                style={{ padding: "7px 16px", borderRadius: "9999px", fontWeight: "700", fontSize: "13px", border: active ? "none" : "1.5px solid #e8dfd0", background: active ? "#1c1008" : "white", color: active ? "white" : "#78716c", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", transition: "all 0.15s" }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = "#f6a623"; e.currentTarget.style.color = "#f6a623"; }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = "#e8dfd0"; e.currentTarget.style.color = "#78716c"; }}}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1).replace("_", " ")}
                {count > 0 && (
                  <span style={{ background: active ? "rgba(255,255,255,0.2)" : "#f5efe6", borderRadius: "9999px", padding: "1px 7px", fontSize: "11px", fontWeight: "800", color: active ? "white" : "#b45309" }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Task Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {filteredRequests.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 24px", background: "white", borderRadius: "16px", border: "1px dashed #e8dfd0" }}>
              <div style={{ width: "48px", height: "48px", background: "#f5efe6", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <Search size={20} color="#c4bab0"/>
              </div>
              <p style={{ color: "#a8a29e", fontWeight: "600", fontSize: "14px", margin: "0 0 4px" }}>No {activeTab} requests found</p>
              <p style={{ color: "#c4bab0", fontSize: "13px", margin: 0 }}>
                {activeTab === "pending"    ? "You don't have any pending requests at the moment."
                : activeTab === "confirmed" ? "No confirmed requests yet."
                : activeTab === "completed" ? "No completed tasks yet."
                : "No requests match your current filter."}
              </p>
            </div>
          ) : filteredRequests.map((request) => {
            const rid        = String(request._id || request.id);
            const offerReady = isOfferReady(request);
            const isPending  = request.status === "pending";
            return (
              <RequestCard
                key={rid}
                request={request} rid={rid}
                offerReady={offerReady} isPending={isPending}
                processingAction={processingAction}
                formatDate={formatDate} formatCurrency={formatCurrency}
                handleViewDetails={handleViewDetails}
                handleViewCustomerProfile={handleViewCustomerProfile}
                sendChatMessage={sendChatMessage}
                handleAcceptRequest={handleAcceptRequest}
                handleDeclineRequest={handleDeclineRequest}
                handleStartWork={handleStartWork}
                handleCompleteTask={handleCompleteTask}
                onReport={handleReport}
                onCancel={handleCancelRequest}
                getDisputeState={getDisputeState}
              />
            );
          })}
        </div>
      </main>

      {/* ── Details Modal ── */}
      {showDetailsModal && selectedRequest && (() => {
        const offerReady    = isOfferReady(selectedRequest);
        const isPending     = selectedRequest.status === "pending";
        const rid           = String(selectedRequest._id || selectedRequest.id);
        const disputeState  = getDisputeState(selectedRequest);

        // Full timeline — all timestamp fields matching your DB
        const timelineSteps = [
          { label: "Created",   field: "createdAt",   color: "#a8a29e" },
          { label: "Confirmed", field: "confirmedAt", color: "#6d28d9" },
          { label: "Paid",      field: "paid_at",     color: "#059669" },
          { label: "Started",   field: "startedAt",   color: "#1e40af" },
          { label: "Completed", field: "completedAt", color: "#065f46" },
          { label: "Released",  field: "released_at", color: "#0891b2" },
          { label: "Disputed",  field: "disputedAt",  color: "#dc2626" },

    { label:"Dispute Resolved",  field:"disputeResolvedAt",  color:"#059669" },
          { label: "Declined",  field: "declinedAt",  color: "#991b1b" },
          { label: "Cancelled", field: "cancelledAt", color: "#991b1b" },
        ].filter(s => {
          const val = selectedRequest[s.field];
          return val && val !== "null" && val !== "undefined" && val !== "";
        });

        return (
          <div onClick={() => setShowDetailsModal(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}
          >
            <div onClick={e => e.stopPropagation()}
              style={{ background: "white", borderRadius: "20px", padding: "2rem", maxWidth: 560, width: "90%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.15)" }}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <h2 style={{ fontSize: "17px", fontWeight: "800", color: "#1c1008", margin: 0 }}>Request Details</h2>
                <button onClick={() => setShowDetailsModal(false)} style={{ background: "#f5efe6", border: "none", width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer", color: "#78716c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>×</button>
              </div>

              {/* Customer profile row */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "1.25rem" }}>
                <div style={{ width: "48px", height: "48px", background: "linear-gradient(135deg,#f6a623,#e8890c)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", color: "white", fontWeight: "800", flexShrink: 0 }}>
                  {selectedRequest.customerName?.charAt(0) || <User size={18} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "800", fontSize: "16px", color: "#1c1008" }}>{selectedRequest.customerName || "Customer"}</div>
                  <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginTop: "3px" }}>
                    <span style={{ fontSize: "12px", color: "#78716c", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Phone size={11} color="#f6a623" /> {selectedRequest.customerPhone || "N/A"}
                    </span>
                    <span style={{ fontSize: "12px", color: "#78716c", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Mail size={11} color="#f6a623" /> {selectedRequest.customerEmail || "N/A"}
                    </span>
                  </div>
                  <button onClick={() => handleViewCustomerProfile(selectedRequest.customerId, selectedRequest.customerName)}
                    style={{ marginTop: "4px", fontSize: "11px", color: "#f6a623", background: "none", border: "none", cursor: "pointer", fontWeight: "700", padding: 0, textDecoration: "underline" }}>
                    View Profile
                  </button>
                </div>
                <StatusPill status={selectedRequest.status} />
              </div>

              {/* Task name + description */}
              <div style={{ fontSize: "14px", color: "#1c1008", fontWeight: "600", marginBottom: "10px" }}>
                <span style={{ color: "#a8a29e", fontWeight: "500" }}>Task: </span>
                {selectedRequest.taskName || "General Task"}
              </div>
              <div style={{ fontSize: "14px", color: "#1c1008", fontWeight: "600", marginBottom: "1.25rem" }}>
                <span style={{ color: "#a8a29e", fontWeight: "500" }}>Notes: </span>
                {selectedRequest.taskDescrip || "No description provided"}
              </div>

              {/* ── Dispute banners ── */}
              {disputeState === "open" && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "10px 14px", marginBottom: "1.25rem", fontSize: "12px", color: "#991b1b" }}>
                  <Flag size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: "1px" }}/>
                  <div>
                    <span style={{ fontWeight: "700", display: "block", marginBottom: "2px" }}>Dispute Open 🔍</span>
                    <span style={{ color: "#7f1d1d" }}>A dispute has been filed for this task. Payment is blocked until admin resolves it.</span>
                  </div>
                </div>
              )}
              {disputeState === "rejected" && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", background: "#f0fdf4", border: "1px solid #a7f3d0", borderRadius: "10px", padding: "10px 14px", marginBottom: "1.25rem", fontSize: "12px", color: "#065f46" }}>
                  <CheckCircle size={14} color="#10b981" style={{ flexShrink: 0, marginTop: "1px" }}/>
                  <div>
                    <span style={{ fontWeight: "700", display: "block", marginBottom: "2px" }}>Dispute Resolved</span>
                    <span>The dispute was reviewed and declined by admin. Payment will proceed normally.</span>
                  </div>
                </div>
              )}

              {/* Offer not ready alert */}
              {isPending && !offerReady && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", fontSize: "12px", color: "#92400e", marginBottom: "1.25rem" }}>
                  <AlertCircle size={14} color="#f59e0b" style={{ flexShrink: 0 }} />
                  Waiting for offer — <strong>estimated hours</strong> and <strong>total cost</strong> must be set before accepting.
                </div>
              )}

              {/* Decline reason banner */}
              {selectedRequest.status === "declined" && selectedRequest.declineReason && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "10px 14px", marginBottom: "1.25rem", fontSize: "12px", color: "#991b1b" }}>
                  <XCircle size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: "1px" }} />
                  <div>
                    <span style={{ fontWeight: "700", display: "block", marginBottom: "2px" }}>Decline reason</span>
                    <span style={{ color: "#7f1d1d" }}>{selectedRequest.declineReason}</span>
                  </div>
                </div>
              )}

              {/* Cancel reason banner */}
              {selectedRequest.status === "cancelled" && (selectedRequest.cancelReason || selectedRequest.cancel_reason) && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "10px 14px", marginBottom: "1.25rem", fontSize: "12px", color: "#991b1b" }}>
                  <XCircle size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: "1px" }} />
                  <div>
                    <span style={{ fontWeight: "700", display: "block", marginBottom: "2px" }}>Cancellation reason</span>
                    <span style={{ color: "#7f1d1d" }}>{selectedRequest.cancelReason || selectedRequest.cancel_reason}</span>
                  </div>
                </div>
              )}

              {/* Info grid */}
              <div style={{ display: "flex", flexDirection: "column", marginBottom: "1.25rem", background: "#faf7f2", borderRadius: "12px", overflow: "hidden" }}>
                {[
                  { icon: <Calendar size={13} color="#f6a623" />, label: "Date",       value: formatDate(selectedRequest.preferredDate) + (selectedRequest.preferredTime ? ` at ${selectedRequest.preferredTime}` : "") },
                  { icon: <Clock    size={13} color="#f6a623" />, label: "Est. Hours", value: selectedRequest.estimatedHours ? `${selectedRequest.estimatedHours} hrs` : "Not set yet" },
                  { icon: <MapPin   size={13} color="#f6a623" />, label: "Location",   value: selectedRequest.address || "Not specified" },
                  { icon: <DollarSign size={13} color="#f6a623" />, label: "Hourly Rate", value: selectedRequest.hourlyRate ? `NPR ${selectedRequest.hourlyRate}/hr` : "Not set" },
                  { icon: <CheckCircle size={13} color="#f6a623" />, label: "Payment",   value: selectedRequest.paymentStatus || "Pending" },
                ].map(({ icon, label, value }, i, arr) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderBottom: i < arr.length - 1 ? "1px solid #f0ebe2" : "none" }}>
                    <div style={{ width: "18px", display: "flex", justifyContent: "center" }}>{icon}</div>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#a8a29e", width: "90px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
                    <span style={{ fontSize: "13px", color: "#1c1008", fontWeight: "600" }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Total amount */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#fffbf2", borderRadius: "10px", border: "1px solid #fde68a", marginBottom: "1.25rem" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#a8601a" }}>Total Amount</span>
                <span style={{ fontSize: "20px", fontWeight: "900", color: "#f6a623" }}>
                  {selectedRequest.totalCost ? formatCurrency(selectedRequest.totalCost) : "NPR —"}
                </span>
              </div>

              {/* Worker earnings */}
              {selectedRequest.workerEarnings > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f0fdf4", padding: "10px 14px", borderRadius: "10px", border: "1px solid #a7f3d0", marginBottom: "1.25rem" }}>
                  <span style={{ fontWeight: "700", color: "#065f46", fontSize: "12px" }}>Your Earnings (after 5% fee)</span>
                  <span style={{ fontSize: "16px", fontWeight: "800", color: "#059669" }}>{formatCurrency(selectedRequest.totalCost - selectedRequest.platformFee)}</span>
                </div>
              )}

              {/* ── Full Timeline ── */}
              {timelineSteps.length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <p style={{ fontSize: "10px", fontWeight: "700", color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Timeline</p>
                  <div style={{ position: "relative" }}>
                    {timelineSteps.length > 1 && (
                      <div style={{ position: "absolute", left: "5px", top: "10px", bottom: "10px", width: "2px", background: "#f5efe6", borderRadius: "2px" }} />
                    )}
                    {timelineSteps.map((step, i) => (
                      <div key={i} style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: "14px", paddingLeft: "22px", marginBottom: i < timelineSteps.length - 1 ? "12px" : 0 }}>
                        <div style={{ position: "absolute", left: 0, top: "4px", width: "12px", height: "12px", borderRadius: "50%", background: step.color, border: "2px solid white", boxShadow: `0 0 0 2px ${step.color}` }} />
                        <div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "12px", fontWeight: "700", color: step.color }}>{step.label}</span>
                            <span style={{ fontSize: "11px", color: "#a8a29e" }}>
                              {(() => {
  const raw = selectedRequest[step.field];
  const utc = raw.endsWith("Z") || raw.includes("+") ? raw : raw + "Z";
  return new Date(utc).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kathmandu",
  });
})()}
                            </span>
                          </div>
                          {/* Inline sub-label for special steps */}
                          {step.field === "declinedAt" && selectedRequest.declineReason && (
                            <span style={{ fontSize: "11px", color: "#991b1b", background: "#fef2f2", padding: "3px 8px", borderRadius: "6px", border: "1px solid #fecaca", fontStyle: "italic", display: "block", marginTop: "4px" }}>
                              {selectedRequest.declineReason}
                            </span>
                          )}
                          {step.field === "cancelledAt" && (selectedRequest.cancelReason || selectedRequest.cancel_reason) && (
                            <span style={{ fontSize: "11px", color: "#991b1b", background: "#fef2f2", padding: "3px 8px", borderRadius: "6px", border: "1px solid #fecaca", fontStyle: "italic", display: "block", marginTop: "4px" }}>
                              {selectedRequest.cancelReason || selectedRequest.cancel_reason}
                            </span>
                          )}
                          {step.field === "disputedAt" && (
                            <span style={{ fontSize: "11px", color: "#dc2626", background: "#fef2f2", padding: "3px 8px", borderRadius: "6px", border: "1px solid #fecaca", display: "block", marginTop: "4px" }}>
                              {disputeState === "rejected" ? "Dispute rejected by admin" : "Dispute under review"}
                            </span>
                          )}
                          {step.field === "resolvedAt" && (
  <span style={{ fontSize: "11px", color: "#0891b2", background: "#e0f2fe", padding: "3px 8px", borderRadius: "6px", border: "1px solid #bae6fd", display: "block", marginTop: "4px" }}>
    Dispute resolved — payment released
  </span>
)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PENDING actions */}
              {isPending && (
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button onClick={() => handleAcceptRequest(rid)} disabled={processingAction === rid || !offerReady}
                    style={{ flex: 1, padding: "11px 20px", background: offerReady ? "linear-gradient(135deg,#059669,#047857)" : "#e5e7eb", color: offerReady ? "white" : "#9ca3af", border: "none", borderRadius: "10px", fontWeight: "700", cursor: !offerReady ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px" }}>
                    <ThumbsUp size={14} /> Accept
                  </button>
                  <button onClick={() => handleDeclineRequest(rid)} disabled={processingAction === rid}
                    style={{ flex: 1, padding: "11px", background: "white", color: "#78716c", border: "1.5px solid #e8dfd0", borderRadius: "10px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px" }}>
                    <ThumbsDown size={14} /> Decline
                  </button>
                  <button onClick={() => handleCancelRequest(rid)} disabled={processingAction === rid}
                    style={{ flex: 1, padding: "11px", background: "#fef2f2", color: "#991b1b", border: "1.5px solid #fecaca", borderRadius: "10px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px" }}>
                    <XCircle size={14} /> Cancel
                  </button>
                </div>
              )}

              {/* CONFIRMED actions */}
              {selectedRequest.status === "confirmed" && (
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button onClick={() => handleStartWork(rid)} disabled={selectedRequest.paymentStatus !== "paid"}
                    style={{ flex: 1, padding: "11px", background: selectedRequest.paymentStatus === "paid" ? "linear-gradient(135deg,#2563eb,#1d4ed8)" : "#e5e7eb", color: selectedRequest.paymentStatus === "paid" ? "white" : "#9ca3af", border: "none", borderRadius: "10px", fontWeight: "700", cursor: selectedRequest.paymentStatus !== "paid" ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px" }}>
                    <CheckCircle size={14} />
                    {selectedRequest.paymentStatus === "paid" ? "Start Work" : "Awaiting Payment"}
                  </button>
                  <button onClick={() => sendChatMessage(selectedRequest.customerId)}
                    style={{ flex: 1, padding: "11px", background: "white", color: "#78716c", border: "1.5px solid #e8dfd0", borderRadius: "10px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px" }}>
                    <MessageCircle size={14} /> Chat
                  </button>
                  <button onClick={() => handleCancelRequest(rid)}
                    style={{ flex: 1, padding: "11px", background: "#fef2f2", color: "#991b1b", border: "1.5px solid #fecaca", borderRadius: "10px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px" }}>
                    <XCircle size={14} /> Cancel
                  </button>
                </div>
              )}

              {/* IN PROGRESS actions */}
              {selectedRequest.status === "in_progress" && (
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button onClick={() => handleCompleteTask(rid)} disabled={processingAction === rid}
                    style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg,#059669,#047857)", color: "white", border: "none", borderRadius: "10px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px" }}>
                    <CheckCircle size={14} /> Mark as Completed
                  </button>
                  <button onClick={() => sendChatMessage(selectedRequest.customerId)}
                    style={{ flex: 1, padding: "11px", background: "white", color: "#78716c", border: "1.5px solid #e8dfd0", borderRadius: "10px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px" }}>
                    <MessageCircle size={14} /> Chat
                  </button>
                  <button onClick={() => handleCancelRequest(rid)}
                    style={{ flex: 1, padding: "11px", background: "#fef2f2", color: "#991b1b", border: "1.5px solid #fecaca", borderRadius: "10px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px" }}>
                    <XCircle size={14} /> Cancel
                  </button>
                </div>
              )}

              {/* COMPLETED actions */}
              {selectedRequest.status === "completed" && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={handleContactSupport}
                    style={{ flex: 1, padding: "11px", background: "white", color: "#78716c", border: "1.5px solid #e8dfd0", borderRadius: "10px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px" }}>
                    <MessageCircle size={14} /> Need Help?
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Decline Modal ── */}
      {showDeclineModal && (
        <div onClick={() => setShowDeclineModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1010, backdropFilter: "blur(4px)" }}
        >
          <div onClick={e => e.stopPropagation()} className="decline-modal"
            style={{ background: "white", borderRadius: "20px", padding: "1.8rem", maxWidth: "440px", width: "90%", boxShadow: "0 24px 60px rgba(0,0,0,0.15)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#1c1008", margin: 0 }}>Decline Request</h3>
              <button onClick={() => setShowDeclineModal(false)} style={{ background: "#f5efe6", border: "none", cursor: "pointer", color: "#78716c", width: "30px", height: "30px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>×</button>
            </div>
            <p style={{ fontSize: "13px", color: "#a8a29e", margin: "0 0 14px", fontWeight: "500" }}>Let the customer know why you're unable to take this task.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
              {["Not available on that date","Outside my service area","Task outside my expertise","Already fully booked","Equipment unavailable"].map(r => (
                <button key={r} onClick={() => setDeclineReason(r)} className="decline-chip"
                  style={{ padding: "5px 12px", borderRadius: "9999px", fontSize: "12px", fontWeight: "600", border: declineReason === r ? "none" : "1.5px solid #e8dfd0", background: declineReason === r ? "#f6a623" : "white", color: declineReason === r ? "white" : "#78716c", cursor: "pointer", transition: "all 0.15s" }}>
                  {r}
                </button>
              ))}
            </div>
            <textarea placeholder="Or write a custom reason…" value={declineReason} onChange={e => setDeclineReason(e.target.value)}
              className="decline-area"
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e8dfd0", borderRadius: "10px", fontSize: "13px", minHeight: "80px", resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: "14px", transition: "border-color 0.2s" }}
              onFocus={e => e.target.style.borderColor = "#f6a623"} onBlur={e => e.target.style.borderColor = "#e8dfd0"}
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setShowDeclineModal(false)} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1.5px solid #e8dfd0", background: "white", fontSize: "13px", fontWeight: "700", cursor: "pointer", color: "#78716c" }}>Cancel</button>
              <button onClick={confirmDecline} style={{ flex: 2, padding: "10px", borderRadius: "10px", border: "none", background: "#ef4444", fontSize: "13px", fontWeight: "700", cursor: "pointer", color: "white" }}>Confirm Decline</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Reason Modal ── */}
      {showCancelModal && (
        <CancelReasonModal
          onConfirm={confirmCancel}
          onClose={() => { setShowCancelModal(false); setCancellingRequestId(null); }}
        />
      )}

      {/* ── Report Modal ── */}
      {reportTask && (
        <ReportModal
          taskId={reportTask._id || reportTask.id}
          task={reportTask}
          reporterType="worker"
          reporterId={workerId}
          onClose={() => setReportTask(null)}
          onSubmitted={() => { addToast({ color: "#059669", message: "Report submitted. We'll review it." }); }}
        />
      )}
    </div>
  );
};

// ── Request Card ──────────────────────────────────────────────────────────────
const RequestCard = ({
  request, rid, offerReady, isPending, processingAction,
  formatDate, formatCurrency,
  handleViewDetails, handleViewCustomerProfile, sendChatMessage,
  handleAcceptRequest, handleDeclineRequest, handleStartWork, handleCompleteTask,
  onReport, onCancel, getDisputeState,
}) => {
  const [hovered, setHovered] = useState(false);
  const disputeState = getDisputeState(request);

  return (
    <div
      onClick={() => handleViewDetails(request)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="request-card"
      style={{ background: "white", borderRadius: "16px", border: `1px solid ${hovered ? "#f6a623" : "#ede8df"}`, padding: "20px 24px", transition: "all 0.18s ease", cursor: "pointer", boxShadow: hovered ? "0 6px 20px rgba(246,166,35,0.12)" : "0 1px 4px rgba(0,0,0,0.04)", transform: hovered ? "translateY(-1px)" : "none" }}
    >
      <div className="request-card-grid">

        {/* LEFT */}
        <div className="card-left">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <div className="customer-avatar" style={{ width: "46px", height: "46px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "800", color: "white", flexShrink: 0 }}>
              {request.profile ? (
                <img src={request.profile} alt="customer" style={{ width: "46px", height: "46px", borderRadius: "50%", objectFit: "cover" }}/>
              ) : (
                <div style={{ width: "46px", height: "46px", borderRadius: "50%", background: "linear-gradient(135deg,#f6a623,#e8890c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "800", color: "white" }}>
                  {request.customerName?.charAt(0) || "U"}
                </div>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="customer-name" style={{ fontWeight: "700", fontSize: "14px", color: "#1c1008", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{request.customerName || "Customer"}</div>
              <div className="customer-task-label" style={{ fontSize: "11px", color: "#a8a29e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{request.taskType || "General Task"}</div>
            </div>
          </div>
          {request.hourlyRate && (
            <div className="hourly-rate" style={{ fontSize: "11px", color: "#a8a29e", marginBottom: "10px" }}>
              NPR {request.hourlyRate}/hr <span style={{ color: "#c4bab0" }}>(Base rate)</span>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "10px" }}>
            <button onClick={e => { e.stopPropagation(); handleViewCustomerProfile(request.customerId, request.customerName); }}
              style={{ fontSize: "11px", color: "#f6a623", background: "none", border: "none", cursor: "pointer", fontWeight: "700", textAlign: "left", padding: 0, textDecoration: "underline" }}>
              View profile
            </button>
          </div>
        </div>

        {/* MIDDLE */}
        <div className="card-middle">
          <div className="task-desc" style={{ fontSize: "14px", color: "#1c1008", marginBottom: "12px", fontWeight: "600" }}>
            <span style={{ color: "#a8a29e", fontWeight: "500" }}>Task details: </span>
            {request.taskName || request.taskDescrip || "No description"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "7px", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
              <MapPin size={13} color="#a8a29e" className="detail-icon" style={{ marginTop: "1px", flexShrink: 0 }}/>
              <span className="detail-text" style={{ fontSize: "13px", color: "#57534e", lineHeight: "1.4" }}>{request.address || "Not specified"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <Calendar size={13} color="#a8a29e" className="detail-icon"/>
              <span className="detail-text" style={{ fontSize: "13px", color: "#57534e" }}>
                {formatDate(request.preferredDate)}{request.preferredTime ? ` at ${request.preferredTime}` : ""}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <Clock size={13} color="#a8a29e" className="detail-icon"/>
              <span className="detail-text" style={{ fontSize: "13px", color: "#57534e" }}>Duration: {request.estimatedHours || "Not set"}</span>
            </div>
          </div>

          {/* ── Dispute banner on card ── */}
          {disputeState === "open" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", marginBottom: "10px" }}>
              <Flag size={12} color="#991b1b"/>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#991b1b" }}>Disputed — payment blocked until admin resolves</span>
            </div>
          )}
          {disputeState === "rejected" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "#f0fdf4", border: "1px solid #a7f3d0", borderRadius: "8px", marginBottom: "10px" }}>
              <CheckCircle size={12} color="#065f46"/>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#065f46" }}>Dispute rejected — payment proceeds normally</span>
            </div>
          )}

          {/* Declined reason */}
          {request.status === "declined" && (
            <>
              <div style={{ fontSize: "12px", color: "#991b1b", marginBottom: "10px" }}>
                <span style={{ fontWeight: "700", display: "block", marginBottom: "2px" }}>Decline reason</span>
                <span style={{ color: "#7f1d1d" }}>{request.declineReason || request.decline_reason || "No reason provided"}</span>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <Btn onClick={e => { e.stopPropagation(); handleViewDetails(request); }} variant="default">View more <ChevronRight size={12}/></Btn>
                <Btn variant="red" onClick={e => { e.stopPropagation(); onReport(request); }}><Flag size={11}/> Report</Btn>
              </div>
            </>
          )}

          {/* Cancelled reason */}
          {request.status === "cancelled" && (request.cancelReason || request.cancel_reason) && (
            <>
              <div style={{ fontSize: "13px", color: "#991b1b", marginBottom: "8px", marginTop: "4px" }}>
                <span style={{ color: "#a8a29e" }}>Cancelled: </span>
                <span style={{ fontWeight: "600", color: "#991b1b" }}>{request.cancelReason || request.cancel_reason || "No reason provided"}</span>
              </div>
              <Btn variant="red" onClick={e => { e.stopPropagation(); onReport(request); }}><Flag size={11}/> Report</Btn>
            </>
          )}

          {/* Offer not ready */}
          {isPending && !offerReady && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", fontSize: "12px", color: "#92400e", marginBottom: "10px" }}>
              <AlertCircle size={13} color="#f59e0b" style={{ flexShrink: 0 }}/>
              Offer not discussed yet — hours & price required before accepting
            </div>
          )}

          {/* Payment status for confirmed/completed */}
          {(request.status === "confirmed" || request.status === "completed") && (
            <div style={{ fontSize: "12px", color: "#78716c", marginBottom: "10px" }}>
              Payment status:{" "}
              <span style={{ fontWeight: "700", color: request.paymentStatus === "paid" ? "#059669" : "#b45309" }}>
                {request.paymentStatus || "Pending"}
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>

            {/* PENDING */}
            {isPending && (
              <>
                <Btn onClick={e => { e.stopPropagation(); handleAcceptRequest(rid); }} disabled={processingAction === rid || !offerReady} variant={offerReady ? "green" : "gray"} title={!offerReady ? "Estimated hours and total cost must be set first" : ""}>
                  {processingAction === rid ? <><Loader size={12}/> Processing…</> : <><Check size={12}/> Accept</>}
                </Btn>
                <Btn onClick={e => { e.stopPropagation(); handleDeclineRequest(rid); }} disabled={processingAction === rid} variant="default"><X size={12}/> Decline</Btn>
                <Btn onClick={e => { e.stopPropagation(); sendChatMessage(request.customerId); }} variant="cyan"><MessageCircle size={12}/> Chat</Btn>
                <Btn variant="red" onClick={e => { e.stopPropagation(); onCancel(rid); }}><XCircle size={11}/> Cancel</Btn>
                <Btn variant="red" onClick={e => { e.stopPropagation(); onReport(request); }}><Flag size={11}/> Report</Btn>
              </>
            )}

            {/* CONFIRMED */}
            {request.status === "confirmed" && (
              <>
                <Btn onClick={e => { e.stopPropagation(); handleStartWork(rid); }} variant={request.paymentStatus === "paid" ? "blue" : "gray"} disabled={request.paymentStatus !== "paid"} title={request.paymentStatus !== "paid" ? "Waiting for customer payment" : ""}>
                  <CheckCircle size={12}/>{request.paymentStatus === "paid" ? "Start Work" : "Awaiting Payment"}
                </Btn>
                <Btn onClick={e => { e.stopPropagation(); handleViewDetails(request); }} variant="default">View more <ChevronRight size={12}/></Btn>
                <Btn onClick={e => { e.stopPropagation(); sendChatMessage(request.customerId); }} variant="cyan"><MessageCircle size={12}/> Chat</Btn>
                <Btn variant="red" onClick={e => { e.stopPropagation(); onCancel(rid); }}><XCircle size={11}/> Cancel</Btn>
                <Btn variant="red" onClick={e => { e.stopPropagation(); onReport(request); }}><Flag size={11}/> Report</Btn>
              </>
            )}

            {/* IN PROGRESS */}
            {request.status === "in_progress" && (
              <>
                <Btn onClick={e => { e.stopPropagation(); handleCompleteTask(rid); }} disabled={processingAction === rid} variant="blue">
                  <CheckCircle size={12}/> Mark Completed
                </Btn>
                <Btn onClick={e => { e.stopPropagation(); handleViewDetails(request); }} variant="default">View more <ChevronRight size={12}/></Btn>
                <Btn onClick={e => { e.stopPropagation(); sendChatMessage(request.customerId); }} variant="cyan"><MessageCircle size={12}/> Chat</Btn>
                <Btn variant="red" onClick={e => { e.stopPropagation(); onCancel(rid); }}><XCircle size={11}/> Cancel</Btn>
                <Btn variant="red" onClick={e => { e.stopPropagation(); onReport(request); }}><Flag size={11}/> Report</Btn>
              </>
            )}

            {/* COMPLETED */}
            {request.status === "completed" && (
              <>
                <Btn onClick={e => { e.stopPropagation(); handleViewDetails(request); }} variant="default">View more <ChevronRight size={12}/></Btn>
                <Btn onClick={e => { e.stopPropagation(); sendChatMessage(request.customerId); }} variant="cyan"><MessageCircle size={12}/> Chat</Btn>
                <Btn variant="red" onClick={e => { e.stopPropagation(); onReport(request); }}><Flag size={11}/> Report</Btn>
              </>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="card-right">
          <div style={{ marginBottom: "12px" }}>
            <div className="price-label" style={{ fontSize: "10px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "2px", fontWeight: "700" }}>Estimated price</div>
            <div className="price-value" style={{ fontSize: "15px", fontWeight: "700", color: "#1c1008" }}>{formatCurrency(request.workerEarnings || request.totalCost)}</div>
          </div>
          <div style={{ marginBottom: "12px" }}>
            <div className="price-label" style={{ fontSize: "10px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "2px", fontWeight: "700" }}>Estimated hours</div>
            <div className="price-value" style={{ fontSize: "13px", fontWeight: "600", color: request.estimatedHours ? "#374151" : "#f6a623" }}>
              {request.estimatedHours || "Not set yet"}
            </div>
          </div>
          <div style={{ borderTop: "1px dashed #e8dfd0", paddingTop: "12px" }}>
            <div className="price-label" style={{ fontSize: "10px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "2px", fontWeight: "700" }}>Total cost</div>
            <div className="total-value" style={{ fontSize: "17px", fontWeight: "900", color: request.totalCost ? "#f6a623" : "#c4bab0" }}>
              {request.totalCost ? formatCurrency(request.totalCost) : "Pending"}
            </div>
          </div>
          <button onClick={e => { e.stopPropagation(); handleViewDetails(request); }}
            style={{ display: "flex", alignItems: "center", gap: "3px", marginTop: "20px", fontSize: "12px", fontWeight: "600", color: hovered ? "#f6a623" : "#a8a29e", background: "none", border: "none", cursor: "pointer", transition: "color 0.15s", padding: 0, alignSelf: "flex-end" }}>
            View Details <ChevronRight size={13}/>
          </button>
        </div>

      </div>
    </div>
  );
};

export default WorkerTaskRequestsPage;