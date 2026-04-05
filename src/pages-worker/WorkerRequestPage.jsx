import React, { useEffect, useState, useRef } from "react";
import {
  Search, Calendar, MapPin, DollarSign, Clock, ChevronRight,
  Phone, Mail, MessageCircle, XCircle, CheckCircle, AlertCircle,
  Loader, User, Check, X, Home, Briefcase, ThumbsUp, ThumbsDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import BookingNavbar from "../components/Navbar/Navbar";
import {
  updateTaskStatus, getTasksByWorker, fetchCustomerById,
  fetchWorkerById, getPaymentStatus,
} from "../api/api";

// ── Global responsive styles ──────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @keyframes toastIn  { from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)} }
    @keyframes toastBar { from{width:100%}to{width:0%} }
    @keyframes spin { to { transform: rotate(360deg); } }
    * { box-sizing: border-box; }

    /* ── Request card grid ── */
    .request-card-grid {
      display: grid;
      grid-template-columns: 200px 1fr 160px;
      gap: 0;
      align-items: start;
    }
    .card-left   { padding-right: 24px; border-right: 1px solid #f0ebe2; }
    .card-middle { padding: 0 24px;     border-right: 1px solid #f0ebe2; }
    .card-right  { padding-left: 24px;  display: flex; flex-direction: column; }

    /* ── Header summary pills ── */
    .summary-pills {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    /* ── Tabs ── */
    .tabs-row {
      display: flex;
      gap: 6px;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }

    /* ── Tablet (≤ 900px) ── */
    @media (max-width: 900px) {
      .request-card-grid {
        grid-template-columns: 1fr;
      }
      .card-left {
        padding-right: 0;
        border-right: none;
        border-bottom: 1px solid #f0ebe2;
        padding-bottom: 14px;
        margin-bottom: 14px;
      }
      .card-middle {
        padding: 0;
        border-right: none;
        border-bottom: 1px solid #f0ebe2;
        padding-bottom: 14px;
        margin-bottom: 14px;
      }
      .card-right { padding-left: 0; }
    }

    /* ── Mobile (≤ 600px) ── */
    @media (max-width: 600px) {
      .tv-main    { padding: 1rem !important; }
      .page-title { font-size: 20px !important; }
      .summary-pills { display: grid; grid-template-columns: 1fr 1fr; }
    }

    /* ── TV / large display (≥ 1600px) ── */
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

const Btn = ({ onClick, variant = "default", children, disabled, title, padding="15px 40px" }) => {
  const V = {
    default: { color: "#78716c", bg: "white",   border: "#e2d9cc" },
    primary: { color: "#f6a623", bg: "#fffbf2", border: "#fde68a" },
    blue:    { color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" },
    green:   { color: "#065f46", bg: "#f0fdf4", border: "#a7f3d0" },
    red:     { color: "#991b1b", bg: "#fef2f2", border: "#fecaca" },
    amber:   { color: "#b45309", bg: "#fffbf2", border: "#fde68a" },
    gray:    { color: "#9ca3af", bg: "#f3f4f6", border: "#e5e7eb" },
  };
  const v = V[variant] || V.default;
  return (
    <button
      onClick={onClick} disabled={disabled} title={title}
      className="action-btn"
      style={{
        display: "inline-flex", alignItems: "center", gap: "5px",
        padding: padding, borderRadius: "9999px",
        fontSize: "12px", fontWeight: "600",
        color: disabled ? v.color : v.color,
        background: disabled ? "#f3f4f6" : v.bg,
        border: `1.5px solid ${disabled ? "#e5e7eb" : v.border}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "opacity 0.15s", whiteSpace: "nowrap",
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

// ── Main Component ────────────────────────────────────────────────────────────
const WorkerTaskRequestsPage = () => {
  const navigate = useNavigate();
  const [requests,           setRequests]           = useState([]);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState(null);
  const [searchQuery,        setSearchQuery]        = useState("");
  const [activeTab,          setActiveTab]          = useState("pending");
  const [selectedRequest,    setSelectedRequest]    = useState(null);
  const [showDetailsModal,   setShowDetailsModal]   = useState(false);
  const [processingAction,   setProcessingAction]   = useState(null);
  const [showDeclineModal,   setShowDeclineModal]   = useState(false);
  const [declineReason,      setDeclineReason]      = useState("");
  const [decliningRequestId, setDecliningRequestId] = useState(null);

  const { toasts, add: addToast, remove: removeToast } = useToast();

  const storedUser = localStorage.getItem("user") || sessionStorage.getItem("user");
  const workerId   = storedUser ? JSON.parse(storedUser).id : null;
  const wsRef      = useRef(null);

  const getTaskPaymentStatus = async (taskId) => {
    try {
      const data = await getPaymentStatus(taskId);
      return data?.task_status || "pending";
    } catch { return "error"; }
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
      preferredTime:  task.serviceTime    || "Flexible",
      estimatedHours: task.estimatedHours || task.completionTime || null,
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
      } catch (err) { console.error("[WorkerWS] parse error:", err); }
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
        const { initMessaging } = await import("../api/notification");
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
  const handleContact = (type, customerName) => {
    const map = { call: `Calling ${customerName}…`, email: `Emailing ${customerName}…`, message: `Opening chat with ${customerName}…` };
    alert(map[type] || "");
  };

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

  const formatDate = (d) => {
    if (!d) return "Not set";
    try { return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
    catch { return d; }
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
        <button onClick={() => window.location.reload()} style={{ marginTop: "1rem", padding: "9px 18px", background: "#f6a623", color: "white", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer", fontSize: "13px" }}>
          Try Again
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f9f6ef", fontFamily: '"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', color: "#1c1008" }}>
      <GlobalStyles />
      <BookingNavbar/>
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
          <input
            type="text" placeholder="Search by task or customer name…"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="search-input"
            style={{ width: "100%", padding: "9px 14px 9px 34px", borderRadius: "9999px", border: "1.5px solid #e8dfd0", fontSize: "13px", outline: "none", background: "white", boxSizing: "border-box", color: "#1c1008", transition: "border-color 0.2s" }}
            onFocus={e => e.target.style.borderColor = "#f6a623"}
            onBlur={e  => e.target.style.borderColor = "#e8dfd0"}
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
                  <span style={{ background: active ? "rgba(255,255,255,0.2)" : "#f5efe6", borderRadius: "9999px", padding: "1px 7px", fontSize: "11px", fontWeight: "800", color: active ? "white" : "#b45309" }}>
                    {count}
                  </span>
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
              />
            );
          })}
        </div>
      </main>

      {/* Details Modal */}
      {showDetailsModal && selectedRequest && (() => {
        const offerReady = isOfferReady(selectedRequest);
        const isPending  = selectedRequest.status === "pending";
        return (
          <div onClick={() => setShowDetailsModal(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}
          >
            <div onClick={e => e.stopPropagation()} className="modal-inner"
              style={{ background: "white", borderRadius: "20px", padding: "2rem", maxWidth: 560, width: "90%", maxHeight: "88vh", overflow: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.15)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <h2 className="modal-title" style={{ fontSize: "17px", fontWeight: "800", color: "#1c1008", margin: 0 }}>Request Details</h2>
                <button onClick={() => setShowDetailsModal(false)} style={{ background: "#f5efe6", border: "none", width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer", color: "#78716c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>×</button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem", padding: "1rem", background: "#faf7f2", borderRadius: "12px" }}>
                <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "linear-gradient(135deg,#f6a623,#e8890c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "800", color: "white", flexShrink: 0, boxShadow: "0 2px 8px rgba(246,166,35,0.3)" }}>
                  {selectedRequest.customerName?.charAt(0) || <User size={20}/>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "800", fontSize: "16px", color: "#1c1008", marginBottom: "3px" }}>{selectedRequest.customerName || "Customer"}</div>
                  <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "12px", color: "#78716c", display: "flex", alignItems: "center", gap: "4px" }}><Phone size={11} color="#f6a623"/> {selectedRequest.customerPhone || "N/A"}</span>
                    <span style={{ fontSize: "12px", color: "#78716c", display: "flex", alignItems: "center", gap: "4px" }}><Mail size={11} color="#f6a623"/> {selectedRequest.customerEmail || "N/A"}</span>
                  </div>
                </div>
                <StatusPill status={selectedRequest.status}/>
              </div>

              {isPending && !offerReady && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", fontSize: "12px", color: "#92400e", marginBottom: "1.25rem" }}>
                  <AlertCircle size={14} color="#f59e0b" style={{ flexShrink: 0 }}/>
                  <span>Waiting for offer — <strong>estimated hours</strong> and <strong>total cost</strong> must be set before accepting.</span>
                </div>
              )}

              {selectedRequest.status === "declined" && selectedRequest.declineReason && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "10px 14px", marginBottom: "1.25rem", fontSize: "12px", color: "#dc2626" }}>
                  <strong>Decline reason:</strong> {selectedRequest.declineReason}
                </div>
              )}

              <div className="modal-details" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
                {[
                  ["Task Name",       selectedRequest.taskName      || "General Task"],
                  ["Location",        selectedRequest.address       || "Not specified"],
                  ["Scheduled Date",  formatDate(selectedRequest.preferredDate)],
                  ["Preferred Time",  selectedRequest.preferredTime || "Flexible"],
                  ["Estimated Hours", selectedRequest.estimatedHours || "Not set yet"],
                  ["Hourly Rate",     `${formatCurrency(selectedRequest.hourlyRate || 0)}/hr`],
                  ["Payment Status",  selectedRequest.paymentStatus || "Pending"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="modal-det-label" style={{ fontSize: "10px", color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px", fontWeight: "700" }}>{label}</div>
                    <div className="modal-det-value" style={{ fontSize: "14px", color: "#1c1008", fontWeight: "600" }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <div style={{ fontSize: "10px", color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px", fontWeight: "700" }}>Description</div>
                <p style={{ fontSize: "13px", color: "#57534e", lineHeight: 1.7, background: "#faf7f2", padding: "12px 14px", borderRadius: "10px", border: "1px solid #f0ebe2", margin: 0 }}>
                  {selectedRequest.taskDescrip || selectedRequest.taskName || "No description provided"}
                </p>
              </div>

              <div style={{ background: "#faf7f2", padding: "1.25rem", borderRadius: "12px", border: "1px solid #f0ebe2", marginBottom: "1.25rem" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#1c1008", marginBottom: "12px" }}>Payment Breakdown</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#78716c" }}>
                    <span>Subtotal ({selectedRequest.estimatedHours || "?"} hrs × {formatCurrency(selectedRequest.hourlyRate || 0)}/hr)</span>
                    <span style={{ fontWeight: "600", color: "#1c1008" }}>{formatCurrency(selectedRequest.workerEarnings)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#78716c" }}>
                    <span>Platform Fee (5%)</span>
                    <span style={{ fontWeight: "600", color: "#1c1008" }}>{formatCurrency((selectedRequest.workerEarnings || 0) * 0.05)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "10px", borderTop: "1px dashed #e8dfd0" }}>
                    <span style={{ fontWeight: "700", color: "#1c1008", fontSize: "13px" }}>Total Customer Pays</span>
                    <span style={{ fontSize: "17px", fontWeight: "900", color: "#f6a623" }}>{formatCurrency((selectedRequest.workerEarnings || 0) * 1.05)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", background: "#f0fdf4", padding: "10px 12px", borderRadius: "8px", border: "1px solid #a7f3d0" }}>
                    <span style={{ fontWeight: "700", color: "#065f46", fontSize: "12px" }}>Your Earnings (after fees)</span>
                    <span style={{ fontSize: "15px", fontWeight: "800", color: "#059669" }}>{formatCurrency(selectedRequest.workerEarnings)}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", marginBottom: "1rem" }}>
                {[["call","Call",Phone],["email","Email",Mail],["message","Message",MessageCircle]].map(([type,label,Icon]) => (
                  <button key={type} onClick={() => handleContact(type, selectedRequest.customerName)}
                    style={{ flex: 1, padding: "9px", borderRadius: "10px", border: "1px solid #e8dfd0", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "12px", fontWeight: "600", color: "#78716c", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#faf7f2"}
                    onMouseLeave={e => e.currentTarget.style.background = "white"}
                  >
                    <Icon size={13} color="#f6a623"/> {label}
                  </button>
                ))}
              </div>

              {isPending && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => handleAcceptRequest(selectedRequest._id || selectedRequest.id)}
                    disabled={processingAction === (selectedRequest._id || selectedRequest.id) || !offerReady}
                    style={{ flex: 1, padding: "30px 20px", background: offerReady ? "linear-gradient(135deg,#059669,#047857)" : "#e5e7eb", color: "white", border: "none", borderRadius: "10px", fontWeight: "700", cursor: !offerReady ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px" }}>
                    <ThumbsUp size={14}/> Accept Request
                  </button>
                  <button onClick={() => handleDeclineRequest(selectedRequest._id || selectedRequest.id)}
                    disabled={processingAction === (selectedRequest._id || selectedRequest.id)}
                    style={{ flex: 1, padding: "11px", background: "white", color: "#78716c", border: "1.5px solid #e8dfd0", borderRadius: "10px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px" }}>
                    <ThumbsDown size={14}/> Decline
                  </button>
                </div>
              )}

              {selectedRequest.status === "confirmed" && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => handleCompleteTask(selectedRequest._id || selectedRequest.id)}
                    style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg,#2563eb,#1d4ed8)", color: "white", border: "none", borderRadius: "10px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px" }}>
                    <CheckCircle size={14}/> Mark as Completed
                  </button>
                  <button onClick={handleContactSupport}
                    style={{ flex: 1, padding: "11px", background: "white", color: "#78716c", border: "1.5px solid #e8dfd0", borderRadius: "10px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px" }}>
                    <MessageCircle size={14}/> Need Help?
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Decline Modal */}
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
            <p style={{ fontSize: "13px", color: "#a8a29e", margin: "0 0 14px", fontWeight: "500" }}>
              Let the customer know why you're unable to take this task.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
              {["Not available on that date","Outside my service area","Task outside my expertise","Already fully booked","Equipment unavailable"].map(r => (
                <button key={r} onClick={() => setDeclineReason(r)} className="decline-chip"
                  style={{ padding: "5px 12px", borderRadius: "9999px", fontSize: "12px", fontWeight: "600", border: declineReason === r ? "none" : "1.5px solid #e8dfd0", background: declineReason === r ? "#f6a623" : "white", color: declineReason === r ? "white" : "#78716c", cursor: "pointer", transition: "all 0.15s" }}>
                  {r}
                </button>
              ))}
            </div>
            <textarea placeholder="Or write a custom reason…"
              value={declineReason} onChange={e => setDeclineReason(e.target.value)}
              className="decline-area"
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e8dfd0", borderRadius: "10px", fontSize: "13px", minHeight: "80px", resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: "14px", transition: "border-color 0.2s" }}
              onFocus={e => e.target.style.borderColor = "#f6a623"}
              onBlur={e  => e.target.style.borderColor = "#e8dfd0"}
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setShowDeclineModal(false)} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1.5px solid #e8dfd0", background: "white", fontSize: "13px", fontWeight: "700", cursor: "pointer", color: "#78716c" }}>Cancel</button>
              <button onClick={confirmDecline} style={{ flex: 2, padding: "10px", borderRadius: "10px", border: "none", background: "#ef4444", fontSize: "13px", fontWeight: "700", cursor: "pointer", color: "white" }}>Confirm Decline</button>
            </div>
          </div>
        </div>
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
}) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={() => handleViewDetails(request)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="request-card"
      style={{
        background: "white", borderRadius: "16px",
        border: `1px solid ${hovered ? "#f6a623" : "#ede8df"}`,
        padding: "20px 24px", transition: "all 0.18s ease", cursor: "pointer",
        boxShadow: hovered ? "0 6px 20px rgba(246,166,35,0.12)" : "0 1px 4px rgba(0,0,0,0.04)",
        transform: hovered ? "translateY(-1px)" : "none",
      }}
    >
      <div className="request-card-grid">

        {/* LEFT */}
        <div className="card-left">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <div className="customer-avatar" style={{ width: "46px", height: "46px", borderRadius: "50%", background: "linear-gradient(135deg,#f6a623,#e8890c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "800", color: "white", flexShrink: 0, boxShadow: "0 2px 8px rgba(246,166,35,0.3)" }}>
              {request.customerName?.charAt(0) || <User size={16} color="white"/>}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="customer-name" style={{ fontWeight: "700", fontSize: "14px", color: "#1c1008", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{request.customerName || "Customer"}</div>
              <div className="customer-task-label" style={{ fontSize: "11px", color: "#a8a29e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{request.taskName || "General Task"}</div>
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
            <button onClick={e => { e.stopPropagation(); sendChatMessage(request.customerId); }}
              style={{ fontSize: "11px", color: "#78716c", background: "white", border: "1.5px solid #e8dfd0", borderRadius: "9999px", cursor: "pointer", padding: "4px 10px", fontWeight: "600", width: "fit-content", transition: "border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#f6a623"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#e8dfd0"}>
              Chat
            </button>
          </div>
        </div>

        {/* MIDDLE */}
        <div className="card-middle">
          <div className="task-desc" style={{ fontSize: "14px", color: "#1c1008", marginBottom: "12px", fontWeight: "600" }}>
            <span style={{ color: "#a8a29e", fontWeight: "500" }}>Task details: </span>
            {request.taskDescrip || request.taskName || "No description"}
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

          {request.status === "declined" && request.declineReason && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", color: "#dc2626", marginBottom: "10px" }}>
              <strong>Declined:</strong> {request.declineReason}
            </div>
          )}
          {isPending && !offerReady && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", fontSize: "12px", color: "#92400e", marginBottom: "10px" }}>
              <AlertCircle size={13} color="#f59e0b" style={{ flexShrink: 0 }}/>
              Offer not discussed yet — hours & price required before accepting
            </div>
          )}
          {(request.status === "confirmed" || request.status === "completed") && (
            <div style={{ fontSize: "12px", color: "#78716c", marginBottom: "10px" }}>
              Payment status:{" "}
              <span style={{ fontWeight: "700", color: request.paymentStatus === "paid" ? "#059669" : "#b45309" }}>
                {request.paymentStatus || "Pending"}
              </span>
            </div>
          )}

          <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
            {isPending && (
              <>
                <Btn onClick={e => { e.stopPropagation(); handleAcceptRequest(rid); }}
                  disabled={processingAction === rid || !offerReady}
                  variant={offerReady ? "green" : "gray"}
                  title={!offerReady ? "Estimated hours and total cost must be set first" : ""}>
                  {processingAction === rid ? <><Loader size={12}/> Processing…</> : <><Check size={12}/> Accept</>}
                </Btn>
                <Btn onClick={e => { e.stopPropagation(); handleDeclineRequest(rid); }}
                  disabled={processingAction === rid} variant="red">
                  <X size={12}/> Decline
                </Btn>
              </>
            )}
            {request.status === "confirmed" && (
              <>
                <Btn onClick={e => { e.stopPropagation(); handleStartWork(rid); }}
                  variant={request.paymentStatus === "paid" ? "blue" : "gray"}
                  disabled={request.paymentStatus !== "paid"}
                  title={request.paymentStatus !== "paid" ? "Waiting for customer payment" : ""}
                  padding="15px 74px" >
                  <CheckCircle size={12}/>
                  {request.paymentStatus === "paid" ? "Start Work" : "Awaiting Payment"}
                </Btn>
                <Btn onClick={e => { e.stopPropagation(); handleViewDetails(request); }} variant="default">
                  View more <ChevronRight size={12}/>
                </Btn>
              </>
            )}
            {request.status === "in_progress" && (
              <>
                <Btn onClick={e => { e.stopPropagation(); handleCompleteTask(rid); }} disabled={processingAction === rid} variant="blue" padding="15px 64px" >
                  <CheckCircle size={12}/> Mark Completed
                </Btn>
                <Btn onClick={e => { e.stopPropagation(); handleViewDetails(request); }} variant="default">
                  View more <ChevronRight size={12}/>
                </Btn>
              </>
            )}
            {request.status === "completed" && (
              <Btn onClick={e => { e.stopPropagation(); handleViewDetails(request); }} variant="default">
                View more <ChevronRight size={12}/>
              </Btn>
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