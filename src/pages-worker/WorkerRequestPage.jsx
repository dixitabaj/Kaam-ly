import React, { useEffect, useState, useRef } from "react";
import {
  Search,
  Calendar,
  MapPin,
  DollarSign,
  Clock,
  ChevronRight,
  Phone,
  Mail,
  MessageCircle,
  XCircle,
  CheckCircle,
  AlertCircle,
  Loader,
  User,
  Check,
  X,
  Home,
  Briefcase,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import BookingNavbar from "../components/Navbar/Navbar";
import {
  updateTaskStatus,
  getTasksByWorker,
  fetchCustomerById,
  fetchWorkerById,
  getPaymentStatus,
} from "../api/api";

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
  <div style={{
    position: "fixed", top: "90px", right: "20px", zIndex: 9999,
    display: "flex", flexDirection: "column", gap: "12px",
    alignItems: "flex-end", pointerEvents: "none",
  }}>
    {toasts.map(t => (
      <div key={t.id} style={{
        pointerEvents: "auto", position: "relative",
        display: "flex", alignItems: "center", gap: "12px",
        padding: "14px 18px", borderRadius: "16px",
        minWidth: "260px", maxWidth: "360px",
        background: "white", border: "1px solid #e5e7eb", color: "#111827",
        fontSize: "14px", fontWeight: "500",
        boxShadow: "0 10px 25px rgba(0,0,0,0.09)",
        animation: "toastSlideIn 0.35s ease", overflow: "hidden",
      }}>
        <div style={{
          width: "10px", height: "10px", borderRadius: "50%",
          background: t.color, flexShrink: 0,
        }}/>
        <div style={{ flex: 1, lineHeight: "1.45" }}>{t.message}</div>
        <button onClick={() => removeToast(t.id)} style={{
          background: "#f3f4f6", border: "none", cursor: "pointer",
          color: "#6b7280", borderRadius: "50%", width: "22px", height: "22px",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <X size={12} />
        </button>
        <div style={{ position:"absolute", bottom:0, left:0, height:"3px", width:"100%", background:"#f3f4f6" }}>
          <div style={{ height:"100%", background: t.color, opacity: 0.45, animation:"toastProgress 10s linear forwards" }}/>
        </div>
      </div>
    ))}
    <style>{`
      @keyframes toastSlideIn  { from { opacity:0; transform:translateX(40px); } to { opacity:1; transform:translateX(0); } }
      @keyframes toastProgress { from { width:100%; } to { width:0%; } }
    `}</style>
  </div>
);

// ── Toast message factory ─────────────────────────────────────────────────────
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

// ── Native browser notification (fires when tab is open but not focused) ──────
// FCM handles the closed-tab case via the service worker automatically.
const showNativePush = (title, body, onClick) => {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  // Don't double-fire if tab is already focused
  if (document.visibilityState === "visible" && document.hasFocus()) return;

  const n = new Notification(title, {
    body,
    icon:  "/icon-192.png",
    badge: "/icon-192.png",
    tag:   "new-task",          // replaces previous notification with same tag
    renotify: true,
  });
  if (onClick) n.onclick = onClick;
};

// ── Main Component ────────────────────────────────────────────────────────────
const WorkerTaskRequestsPage = () => {
  const navigate = useNavigate();
  const [requests,          setRequests]          = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState(null);
  const [searchQuery,       setSearchQuery]       = useState("");
  const [activeTab,         setActiveTab]         = useState("pending");
  const [selectedRequest,   setSelectedRequest]   = useState(null);
  const [showDetailsModal,  setShowDetailsModal]  = useState(false);
  const [processingAction,  setProcessingAction]  = useState(null);
  const [showDeclineModal,  setShowDeclineModal]  = useState(false);
  const [declineReason,     setDeclineReason]     = useState("");
  const [decliningRequestId,setDecliningRequestId]= useState(null);

  const { toasts, add: addToast, remove: removeToast } = useToast();

  const storedUser = localStorage.getItem("user") || sessionStorage.getItem("user");
  const workerId   = storedUser ? JSON.parse(storedUser).id : null;
  const wsRef      = useRef(null);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getTaskPaymentStatus = async (taskId) => {
    try {
      const data = await getPaymentStatus(taskId);
      return data?.task_status || "pending";
    } catch {
      return "error";
    }
  };

  const enrichTask = async (task) => {
    let customerData  = null;
    let workerData    = null;
    let paymentStatus = null;
    try {
      customerData  = await fetchCustomerById(task.userId);
      workerData    = await fetchWorkerById(task.assignedWorkerId);
      paymentStatus = await getTaskPaymentStatus(task.id || task._id);
    } catch (err) {
      console.error("[enrich] Failed to fetch customer/worker:", err);
    }
    const workerEarnings =
      parseInt(workerData?.basePrice || 0) * parseInt(task.completionTime || 0);
    return {
      ...task,
      paymentStatus,
      customerId:     task.userId,
      customerName:   customerData?.first_name || "Customer",
      customerPhone:  customerData?.phoneNo    || "N/A",
      customerEmail:  customerData?.email      || "N/A",
      address:        task.address,
      totalCost:      task.totalCost,
      workerEarnings: workerEarnings || task.totalCost || 300,
      hourlyRate:     workerData?.basePrice,
      preferredDate:  task.serviceDate   || "None shown",
      preferredTime:  task.serviceTime   || "Flexible",
      estimatedHours: task.completionTime || "4 hours",
    };
  };

  const filteredRequests = requests.filter((request) => {
    const matchesSearch =
      request.taskName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.taskDescrip?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.customerName?.toLowerCase().includes(searchQuery.toLowerCase());
    const status = request.status || "pending";
    return matchesSearch && (activeTab === "all" || status === activeTab);
  });

  // ── WebSocket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!workerId) return;
    let ws = null;
    const timer = setTimeout(() => {
      ws = new WebSocket(`ws://127.0.0.1:8000/ws/task-updates/${workerId}`);
      ws.onopen = () => console.log("Worker WS connected");

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "ping") return;

          if (data.type === "new_task") {
            const rawTask = {
              id:               data.taskId,
              _id:              data.taskId,
              taskName:         data.taskType,
              taskDescrip:      data.note,
              address:          data.address,
              serviceDate:      data.serviceDate,
              serviceTime:      data.serviceTime,
              totalCost:        data.totalCost,
              completionTime:   data.estimatedHours,
              status:           "pending",
              userId:           data.userId,
              assignedWorkerId: workerId,
            };
            const enriched = await enrichTask(rawTask);
            setRequests((prev) => {
              const exists = prev.some(r => String(r._id || r.id) === String(data.taskId));
              if (exists) return prev;
              return [enriched, ...prev];
            });

            // ── In-app toast ──────────────────────────────────────────────
            const taskLabel = data.taskType || data.taskName || "A task";
            const toast = makeToast("new_task", taskLabel);
            if (toast) addToast(toast);

            // ── Native push (tab open but not focused) ────────────────────
            // FCM service worker handles the closed-tab case automatically.
            showNativePush(
              "New Task Request 🔔",
              `You have a new task: "${taskLabel}". Tap to review.`,
              () => {
                window.focus();
                navigate("/worker/requests");
              }
            );
          }

          if (data.type === "task_status") {
            setRequests((prev) => {
              const updated = prev.map(r =>
                String(r._id || r.id) === String(data.taskId)
                  ? { ...r, status: data.status }
                  : r
              );
              const found = updated.find(r => String(r._id || r.id) === String(data.taskId));
              const toast = makeToast(data.status, found?.taskName || found?.taskDescrip);
              if (toast) addToast(toast);
              return updated;
            });
            setSelectedRequest((prev) =>
              prev && String(prev._id || prev.id) === String(data.taskId)
                ? { ...prev, status: data.status }
                : prev
            );
          }
        } catch (err) {
          console.error("WS parse/enrich error:", err);
        }
      };

      ws.onerror = (e) => console.error("Worker WS error", e);
      ws.onclose = () => console.log("Worker WS closed");
      wsRef.current = ws;
    }, 150);

    return () => {
      clearTimeout(timer);
      ws?.close();
      wsRef.current?.close();
    };
  }, [workerId]);

  // ── Initial fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchRequests = async () => {
      if (!workerId) { setLoading(false); return; }
      try {
        const data = await getTasksByWorker(workerId);
        const enriched = await Promise.all(
          (data.tasks || []).map((task) => enrichTask(task))
        );
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
  const handleViewDetails = (request) => {
    setSelectedRequest(request);
    setShowDetailsModal(true);
  };

  const handleViewCustomerProfile = (customerId, customerName) =>
    navigate(`/customer-profile/${customerId}`, { state: { customerId, customerName } });

  const handleContact = (type, customerName) => {
    const map = {
      call:    `Calling ${customerName}...`,
      email:   `Emailing ${customerName}...`,
      message: `Opening chat with ${customerName}...`,
    };
    alert(map[type] || "");
  };

  const handleAcceptRequest = async (requestId) => {
    setProcessingAction(requestId);
    try {
      await updateTaskStatus(requestId, "confirmed");
      const task = requests.find(r => (r._id || r.id) === requestId);
      const apply = (r) => (r._id || r.id) === requestId ? { ...r, status: "confirmed" } : r;
      setRequests((prev) => prev.map(apply));
      setSelectedRequest((prev) => (prev ? apply(prev) : prev));
      const toast = makeToast("confirmed", task?.taskName || task?.taskDescrip);
      if (toast) addToast(toast);
    } catch {
      addToast({ color: "#dc2626", message: "Failed to accept request. Please try again." });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleDeclineRequest = (requestId) => {
    setDecliningRequestId(requestId);
    setDeclineReason("");
    setShowDeclineModal(true);
  };

  const confirmDecline = async () => {
    if (!declineReason.trim()) {
      addToast({ color: "#dc2626", message: "Please provide a reason for declining." });
      return;
    }
    setProcessingAction(decliningRequestId);
    setShowDeclineModal(false);
    const task = requests.find(r => (r._id || r.id) === decliningRequestId);
    try {
      await updateTaskStatus(decliningRequestId, "declined", declineReason);
      const apply = (r) =>
        (r._id || r.id) === decliningRequestId ? { ...r, status: "declined", declineReason } : r;
      setRequests((prev) => prev.map(apply));
      setSelectedRequest((prev) => (prev ? apply(prev) : prev));
      const toast = makeToast("declined", task?.taskName || task?.taskDescrip);
      if (toast) addToast(toast);
    } catch {
      addToast({ color: "#dc2626", message: "Failed to decline request. Please try again." });
    } finally {
      setProcessingAction(null);
      setDecliningRequestId(null);
    }
  };

  const handleStartWork = async (requestId) => {
    const task = requests.find(r => String(r._id || r.id) === String(requestId));
    await updateTaskStatus(requestId, "in_progress");
    setRequests((prev) =>
      prev.map((r) =>
        String(r._id || r.id) === String(requestId) ? { ...r, status: "in_progress" } : r
      )
    );
    const toast = makeToast("in_progress", task?.taskName || task?.taskDescrip);
    if (toast) addToast(toast);
  };

  const handleCompleteTask = async (requestId) => {
    if (!window.confirm("Mark this task as completed?")) return;
    setProcessingAction(requestId);
    const task = requests.find(r => (r._id || r.id) === requestId);
    try {
      await updateTaskStatus(requestId, "completed");
      const apply = (r) => (r._id || r.id) === requestId ? { ...r, status: "completed" } : r;
      setRequests((prev) => prev.map(apply));
      setSelectedRequest((prev) => (prev ? apply(prev) : prev));
      const toast = makeToast("completed", task?.taskName || task?.taskDescrip);
      if (toast) addToast(toast);
    } catch {
      addToast({ color: "#dc2626", message: "Failed to update task status. Please try again." });
    } finally {
      setProcessingAction(null);
    }
  };

  const sendChatMessage     = (userId) => navigate(`/chat/${workerId}/${userId}`);
  const handleContactSupport = ()      => navigate("/helpSection");

  // ── Formatters ────────────────────────────────────────────────────────────
  const formatDate = (d) => {
    if (!d) return "Not set";
    try {
      return new Date(d).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
      });
    } catch { return d; }
  };

  const formatCurrency = (amount) =>
    !amount ? "Rs. 0" : `Rs. ${Number(amount).toLocaleString("en-IN")}`;

  // ── Status config ─────────────────────────────────────────────────────────
  const STATUS_CONFIG = {
    pending:     { color: "#b45309", bg: "#fef3c7", border: "#fcd34d", text: "Pending",     Icon: AlertCircle },
    confirmed:   { color: "#065f46", bg: "#d1fae5", border: "#6ee7b7", text: "Confirmed",   Icon: CheckCircle },
    completed:   { color: "#1e40af", bg: "#dbeafe", border: "#93c5fd", text: "Completed",   Icon: CheckCircle },
    cancelled:   { color: "#991b1b", bg: "#fee2e2", border: "#fca5a5", text: "Cancelled",   Icon: XCircle    },
    declined:    { color: "#374151", bg: "#f3f4f6", border: "#d1d5db", text: "Declined",    Icon: XCircle    },
    in_progress: { color: "#5b21b6", bg: "#ede9fe", border: "#c4b5fd", text: "In Progress", Icon: Loader     },
  };

  const StatusBadge = ({ status }) => {
    const cfg  = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const Icon = cfg.Icon;
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      }}>
        <Icon size={12} />{cfg.text}
      </span>
    );
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const pendingCount   = requests.filter((r) => r.status === "pending").length;
  const acceptedCount  = requests.filter((r) => r.status === "confirmed").length;
  const completedCount = requests.filter((r) => r.status === "completed").length;
  const totalEarnings  = requests
    .filter((r) => r.status === "completed")
    .reduce((s, r) => s + (r.totalCost || 0), 0);

  const TABS = [
    "all", "pending", "confirmed", "in_progress",
    "completed", "declined", "cancelled",
  ];

  // ── Loading / Error ───────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFDF2" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 48, height: 48, border: "3px solid #e5e7eb", borderTop: "3px solid #f59e0b", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ color: "#6b7280", fontSize: 15 }}>Loading your requests…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFDF2" }}>
      <div style={{ background: "white", borderRadius: 16, padding: "2rem", maxWidth: 400, textAlign: "center", border: "1px solid #e5e7eb" }}>
        <XCircle size={48} color="#ef4444" style={{ marginBottom: 16 }} />
        <p style={{ color: "#111827", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Error Loading Requests</p>
        <p style={{ color: "#6b7280", marginBottom: 20 }}>{error}</p>
        <button onClick={() => window.location.reload()} style={{ padding: "10px 28px", background: "#111827", color: "white", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer" }}>
          Try Again
        </button>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#FFFDF2", fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: "#111827" }}>
      <BookingNavbar />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "2rem" }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#111827", margin: "0 0 4px", letterSpacing: "-0.4px" }}>Your Task Details</h1>
            <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>Manage incoming requests from customers</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: "Pending",   value: pendingCount,                  color: "#b45309" },
              { label: "Accepted",  value: acceptedCount,                 color: "#065f46" },
              { label: "Completed", value: completedCount,                color: "#1e40af" },
              { label: "Earnings",  value: formatCurrency(totalEarnings), color: "#059669" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: "center", background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 16px", minWidth: 70 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Search ── */}
        <div style={{ position: "relative", maxWidth: 380, marginBottom: "1.5rem" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="text"
            placeholder="Search by task or customer name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: "100%", padding: "10px 12px 10px 38px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 14, outline: "none", background: "white", boxSizing: "border-box" }}
            onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
            onBlur={(e)  => (e.target.style.borderColor = "#e5e7eb")}
          />
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 4, marginBottom: "1.5rem", borderBottom: "1.5px solid #e5e7eb", flexWrap: "wrap" }}>
          {TABS.map((tab) => {
            const count    = requests.filter((r) => (r.status || "pending") === tab).length;
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "8px 16px", border: "none", background: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#111827" : "#6b7280",
                  borderBottom: isActive ? "2px solid #f59e0b" : "2px solid transparent",
                  marginBottom: -1.5, borderRadius: "6px 6px 0 0", transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1).replace("_", " ")}
                {count > 0 && tab !== "all" && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 999,
                    background: isActive ? "#f59e0b" : "#e5e7eb",
                    color: isActive ? "white" : "#6b7280",
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Task Cards ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredRequests.length === 0 ? (
            <div style={{ padding: "60px 40px", textAlign: "center", border: "1px solid #e5e7eb", borderRadius: 14, background: "white" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
              <h3 style={{ color: "#111827", fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>
                No {activeTab} requests found
              </h3>
              <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>
                {activeTab === "pending"    ? "You don't have any pending requests at the moment."
                 : activeTab === "confirmed" ? "No confirmed requests yet."
                 : activeTab === "completed" ? "No completed tasks yet."
                 : "No requests match your current filter."}
              </p>
            </div>
          ) : (
            filteredRequests.map((request) => {
              const rid = request._id || request.id;
              return (
                <div
                  key={rid}
                  style={{
                    display: "grid", gridTemplateColumns: "220px 1fr 180px",
                    gap: 0, padding: "20px 24px", alignItems: "start",
                    border: "1px solid #e5e7eb", borderRadius: 14, background: "white",
                    cursor: "pointer", transition: "background 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                  onClick={() => handleViewDetails(request)}
                >
                  {/* ── LEFT ── */}
                  <div style={{ paddingRight: 24, borderRight: "1px solid #f3f4f6" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#b45309", flexShrink: 0 }}>
                        {request.customerName?.charAt(0) || <User size={20} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>
                          {request.customerName || "Customer"}
                        </div>
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>
                          {request.taskName || "General Task"}
                        </div>
                      </div>
                    </div>

                    {request.hourlyRate && (
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
                        Rs. {request.hourlyRate}/hr <span style={{ color: "#9ca3af" }}>(Base rate)</span>
                      </div>
                    )}

                    <StatusBadge status={request.status} />

                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleViewCustomerProfile(request.customerId, request.customerName); }}
                        style={{ fontSize: 12, color: "#f59e0b", background: "none", border: "none", cursor: "pointer", fontWeight: 600, textAlign: "left", padding: 0, textDecoration: "underline" }}
                      >
                        View profile
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); sendChatMessage(request.customerId); }}
                        style={{ fontSize: 12, color: "#6b7280", background: "none", border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer", padding: "3px 10px", fontWeight: 500, width: "fit-content" }}
                      >
                        Chat
                      </button>
                    </div>
                  </div>

                  {/* ── MIDDLE ── */}
                  <div style={{ padding: "0 24px", borderRight: "1px solid #f3f4f6" }}>
                    <div style={{ fontSize: 14, color: "#374151", marginBottom: 8, fontWeight: 500 }}>
                      Task details:{" "}
                      <span style={{ fontWeight: 400, color: "#6b7280" }}>
                        {request.taskDescrip || request.taskName || "No description"}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6b7280" }}>
                        <MapPin size={13} color="#f59e0b" />
                        <span>Location: {request.address || "Not specified"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6b7280" }}>
                        <Calendar size={13} color="#f59e0b" />
                        <span>
                          Scheduled: {formatDate(request.preferredDate)}
                          {request.preferredTime ? ` at ${request.preferredTime}` : ""}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6b7280" }}>
                        <Clock size={13} color="#f59e0b" />
                        <span>Duration: {request.estimatedHours || "4 hours"}</span>
                      </div>
                    </div>

                    {request.status === "declined" && request.declineReason && (
                      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#dc2626", marginBottom: 12 }}>
                        <strong>Declined:</strong> {request.declineReason}
                      </div>
                    )}

                    {(request.status === "confirmed" || request.status === "completed") && (
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
                        Payment status:{" "}
                        <span style={{ fontWeight: 600, color: request.paymentStatus === "paid" ? "#059669" : "#b45309" }}>
                          {request.paymentStatus || "Pending"}
                        </span>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                      {request.status === "pending" && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAcceptRequest(rid); }}
                            disabled={processingAction === rid}
                            style={{ padding: "7px 16px", background: "#059669", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: processingAction === rid ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 5, opacity: processingAction === rid ? 0.7 : 1 }}
                          >
                            {processingAction === rid ? <><Loader size={13} /> Processing…</> : <><Check size={13} /> Accept</>}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeclineRequest(rid); }}
                            disabled={processingAction === rid}
                            style={{ padding: "7px 16px", background: "white", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: processingAction === rid ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 5 }}
                          >
                            <X size={13} /> Decline
                          </button>
                        </>
                      )}
                      {request.status === "confirmed" && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStartWork(rid); }}
                            style={{ padding: "7px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                          >
                            <CheckCircle size={13} /> Start Work
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleViewDetails(request); }}
                            style={{ padding: "7px 14px", background: "white", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                          >
                            View more <ChevronRight size={13} />
                          </button>
                        </>
                      )}
                      {request.status === "in_progress" && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCompleteTask(rid); }}
                            disabled={processingAction === rid}
                            style={{ padding: "7px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                          >
                            <CheckCircle size={13} /> Mark Completed
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleViewDetails(request); }}
                            style={{ padding: "7px 14px", background: "white", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                          >
                            View more <ChevronRight size={13} />
                          </button>
                        </>
                      )}
                      {request.status === "completed" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleViewDetails(request); }}
                          style={{ padding: "7px 14px", background: "white", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                        >
                          View more <ChevronRight size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── RIGHT: Pricing ── */}
                  <div style={{ paddingLeft: 24 }}>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Estimated price</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{formatCurrency(request.workerEarnings || request.totalCost)}</div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Estimated hours</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{request.estimatedHours || "4 hours"}</div>
                    </div>
                    <div style={{ borderTop: "1px dashed #e5e7eb", paddingTop: 10 }}>
                      <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Total cost</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b" }}>{formatCurrency(request.totalCost || request.workerEarnings)}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* ── Details Modal ── */}
      {showDetailsModal && selectedRequest && (
        <div onClick={() => setShowDetailsModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(3px)" }}
        >
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "white", borderRadius: 18, padding: "1.75rem", maxWidth: 680, width: "90%", maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid #f3f4f6" }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Request Details</h2>
              <button onClick={() => setShowDetailsModal(false)} style={{ background: "none", border: "none", fontSize: 26, cursor: "pointer", color: "#9ca3af", lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginBottom: "1.5rem", padding: "1rem", background: "#fafafa", borderRadius: 12 }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#b45309" }}>
                {selectedRequest.customerName?.charAt(0) || "C"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{selectedRequest.customerName || "Customer"}</div>
                <div style={{ display: "flex", gap: 16 }}>
                  <span style={{ fontSize: 13, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
                    <Phone size={12} /> {selectedRequest.customerPhone || "N/A"}
                  </span>
                  <span style={{ fontSize: 13, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
                    <Mail size={12} /> {selectedRequest.customerEmail || "N/A"}
                  </span>
                </div>
              </div>
              <StatusBadge status={selectedRequest.status} />
            </div>

            {selectedRequest.status === "declined" && selectedRequest.declineReason && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", marginBottom: "1.25rem", fontSize: 13, color: "#dc2626" }}>
                <strong>Decline reason:</strong> {selectedRequest.declineReason}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.25rem" }}>
              {[
                ["Task Name",      selectedRequest.taskName       || "General Task"],
                ["Location",       selectedRequest.address        || "Not specified"],
                ["Scheduled Date", formatDate(selectedRequest.preferredDate)],
                ["Preferred Time", selectedRequest.preferredTime  || "Flexible"],
                ["Duration",       selectedRequest.estimatedHours || "4 hours"],
                ["Hourly Rate",    `${formatCurrency(selectedRequest.hourlyRate || 600)}/hr`],
                ["Payment Status", selectedRequest.paymentStatus  || "Pending"],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 15, color: "#111827", fontWeight: 500 }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Description</div>
              <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, background: "#fafafa", padding: "0.875rem 1rem", borderRadius: 10, border: "1px solid #f3f4f6", margin: 0 }}>
                {selectedRequest.taskDescrip || selectedRequest.taskName || "No description provided"}
              </p>
            </div>

            <div style={{ background: "#fafafa", padding: "1.25rem", borderRadius: 12, border: "1px solid #f3f4f6", marginBottom: "1.25rem" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 12 }}>Payment Breakdown</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7280" }}>
                  <span>Subtotal ({selectedRequest.estimatedHours || 4} hrs × {formatCurrency(selectedRequest.hourlyRate || 600)}/hr)</span>
                  <span style={{ fontWeight: 600, color: "#374151" }}>{formatCurrency(selectedRequest.workerEarnings)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7280" }}>
                  <span>Platform Fee (5%)</span>
                  <span style={{ fontWeight: 600, color: "#374151" }}>{formatCurrency((selectedRequest.workerEarnings || 0) * 0.05)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: "1px dashed #e5e7eb" }}>
                  <span style={{ fontWeight: 600, color: "#111827" }}>Total Customer Pays</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b" }}>{formatCurrency((selectedRequest.workerEarnings || 0) * 1.05)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", background: "#d1fae5", padding: "10px 12px", borderRadius: 8 }}>
                  <span style={{ fontWeight: 600, color: "#065f46", fontSize: 13 }}>Your Earnings (after fees)</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#059669" }}>{formatCurrency(selectedRequest.workerEarnings)}</span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: "1.25rem" }}>
              {[["call", "Call", Phone], ["email", "Email", Mail], ["message", "Message", MessageCircle]].map(([type, label, Icon]) => (
                <button key={type}
                  onClick={() => handleContact(type, selectedRequest.customerName)}
                  style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "#374151" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                >
                  <Icon size={14} color="#f59e0b" /> {label}
                </button>
              ))}
            </div>

            {selectedRequest.status === "pending" && (
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => handleAcceptRequest(selectedRequest._id || selectedRequest.id)}
                  disabled={processingAction === (selectedRequest._id || selectedRequest.id)}
                  style={{ flex: 1, padding: "12px", background: "#059669", color: "white", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <ThumbsUp size={15} /> Accept Request
                </button>
                <button
                  onClick={() => handleDeclineRequest(selectedRequest._id || selectedRequest.id)}
                  disabled={processingAction === (selectedRequest._id || selectedRequest.id)}
                  style={{ flex: 1, padding: "12px", background: "white", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <ThumbsDown size={15} /> Decline
                </button>
              </div>
            )}
            {selectedRequest.status === "confirmed" && (
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => handleCompleteTask(selectedRequest._id || selectedRequest.id)}
                  style={{ flex: 1, padding: "12px", background: "#2563eb", color: "white", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <CheckCircle size={15} /> Mark as Completed
                </button>
                <button
                  onClick={handleContactSupport}
                  style={{ flex: 1, padding: "12px", background: "white", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <MessageCircle size={15} /> Need Help?
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Decline Modal ── */}
      {showDeclineModal && (
        <div onClick={() => setShowDeclineModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1010, backdropFilter: "blur(3px)" }}
        >
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "white", borderRadius: 16, padding: "1.75rem", maxWidth: 460, width: "90%", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>Decline Request</h3>
              <button onClick={() => setShowDeclineModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 24, lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>
              Let the customer know why you're unable to take this task.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {["Not available on that date","Outside my service area","Task outside my expertise","Already fully booked","Equipment unavailable"].map((r) => (
                <button key={r} onClick={() => setDeclineReason(r)}
                  style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 500, border: declineReason === r ? "none" : "1px solid #e5e7eb", background: declineReason === r ? "#f59e0b" : "#fafafa", color: declineReason === r ? "white" : "#374151", cursor: "pointer", transition: "all 0.15s" }}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              placeholder="Or write a custom reason…"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 13, minHeight: 80, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 16 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowDeclineModal(false)} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "#6b7280" }}>
                Cancel
              </button>
              <button onClick={confirmDecline} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: "#ef4444", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "white" }}>
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default WorkerTaskRequestsPage;