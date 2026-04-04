// FraudDashboard.tsx - Fixed
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Trash2, KeyRound, AlertTriangle, UserX, UserCheck, Eye, RefreshCw,
  ShieldAlert, Mail, Calendar, Briefcase, Phone, X, CheckCircle, XCircle
} from "lucide-react";

const API_BASE = "http://127.0.0.1:8000/api";

const getToken = () => {
  const u = localStorage.getItem("user");
  return u ? JSON.parse(u)?.token : null;
};

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

const C = {
  bg:          "#F7F5EF",
  surface:     "#FFFFFF",
  border:      "#EDE8DF",
  text:        "#1C1008",
  muted:       "#9C8E82",
  amber:       "#D77D43",
  amberLight:  "#FDF3E8",
  amberBorder: "#F5D9BB",
  green:       "#16a34a",
  greenLight:  "#f0fdf4",
  greenBorder: "#bbf7d0",
  red:         "#dc2626",
  redLight:    "#fef2f2",
  redBorder:   "#fecaca",
  yellow:      "#d97706",
  yellowLight: "#fffbeb",
  yellowBorder:"#fde68a",
  dark:        "#111827",
  gray:        "#6b7280",
  grayLight:   "#f9fafb",
  orange:      "#ea580c",
  orangeLight: "#fff7ed",
  orangeBorder: "#fed7aa",
};

// Toast Component
const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 99999, background: type === "error" ? "#ef4444" : type === "warning" ? "#f59e0b" : "#10b981", color: "white", padding: "12px 20px", borderRadius: "12px", fontSize: "14px", fontWeight: "500", boxShadow: "0 10px 25px rgba(0,0,0,0.15)", animation: "slideUp 0.2s ease", display: "flex", alignItems: "center", gap: "8px" }}>
        {type === "success" && <CheckCircle size={18} />}
        {type === "error" && <XCircle size={18} />}
        {message}
      </div>
  );
};

// Confirm Dialog Component
const ConfirmDialog = ({ message, onConfirm, onCancel, danger = false }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.2s ease" }}>
    <div style={{ background: "white", borderRadius: "24px", padding: "28px", width: "360px", boxShadow: "0 25px 50px rgba(0,0,0,0.3)", animation: "scaleIn 0.2s ease" }}>
      <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: danger ? "#fee2e2" : "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>
        <AlertTriangle size={24} color={danger ? "#dc2626" : "#d97706"} />
      </div>
      <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: "600", color: "#111827" }}>Confirm Action</h3>
      <p style={{ margin: "0 0 24px", fontSize: "14px", color: "#6b7280", lineHeight: "1.5" }}>{message}</p>
      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ padding: "10px 20px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: "14px", fontWeight: "500", color: "#6b7280" }}>Cancel</button>
        <button onClick={onConfirm} style={{ padding: "10px 20px", borderRadius: "12px", border: "none", background: danger ? "#dc2626" : "#d97706", cursor: "pointer", fontSize: "14px", fontWeight: "500", color: "white" }}>Confirm</button>
      </div>
    </div>
  </div>
);

const RiskPill = ({ level }) => {
  const map = {
    clean:     { color: C.green,  bg: C.greenLight,  border: C.greenBorder,  label: "Clean" },
    monitor:   { color: C.yellow, bg: C.yellowLight, border: C.yellowBorder, label: "Monitor" },
    restrict:  { color: C.orange, bg: C.orangeLight, border: C.orangeBorder, label: "Restrict" },
    suspend:   { color: C.red,    bg: C.redLight,    border: C.redBorder,    label: "Suspend" },
  };
  const s = map[level] || map.monitor;
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      padding: "3px 11px", borderRadius: 999, fontSize: 11, fontWeight: 700,
      letterSpacing: "0.02em", whiteSpace: "nowrap",
    }}>
      {s.label}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    active:    { color: "#059669", bg: "#ffffff", icon: CheckCircle, label: "Active" },
    pending:   { color: "#b45309", bg: "#ffffff", icon: Clock,       label: "Pending" },
    suspended: { color: "#b91c1c", bg: "#ffffff", icon: XCircle,     label: "Suspended" },
  };
  const config = map[status?.toLowerCase()] ?? { color: "#6b7280", bg: "#ffffff", icon: ShieldAlert, label: status ?? "Unknown" };
  const Icon = config.icon;
  return (
    <span style={{ background: config.bg, color: config.color, borderRadius: "100px", padding: "4px 10px 4px 8px", fontSize: "12px", fontWeight: "500", display: "inline-flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
      <Icon size={12} />{config.label}
    </span>
  );
};

const Avatar = ({ user, size = 38, fontSize = 14 }) => {
  const initials = `${user.first_name?.[0] ?? user.user_id?.[0] ?? "?"}${user.last_name?.[0] ?? ""}`.toUpperCase();
  const colors = ["#F7BE88"];
  const color = colors[(user.first_name?.charCodeAt(0) ?? user.user_id?.charCodeAt(0) ?? 0) % colors.length];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg, ${color}, ${color}dd)`, color: "white", fontWeight: "600", fontSize, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "2px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      {initials}
    </div>
  );
};

const StatCard = ({ label, value, sub, accent }) => (
  <div style={{
    background: C.surface, borderRadius: 16, padding: "clamp(16px, 4vw, 20px) clamp(16px, 5vw, 24px)",
    border: `1px solid ${C.border}`, flex: "1 1 180px", minWidth: "140px",
    borderLeft: accent ? `4px solid ${accent}` : `1px solid ${C.border}`,
  }}>
    <div style={{ fontSize: "clamp(9px, 2.5vw, 10px)", color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>
      {label}
    </div>
    <div style={{ fontSize: "clamp(22px, 6vw, 28px)", fontWeight: 800, color: C.text, lineHeight: 1.2 }}>
      {value}
    </div>
    {sub && <div style={{ fontSize: "clamp(10px, 2.5vw, 12px)", color: C.muted, marginTop: 6, fontWeight: 500 }}>{sub}</div>}
  </div>
);

const Banner = ({ type, children }) => {
  const styles = {
    warn:    { bg: C.yellowLight, border: C.yellowBorder, color: "#92400e" },
    success: { bg: C.greenLight,  border: C.greenBorder,  color: "#15803d" },
    error:   { bg: C.redLight,    border: C.redBorder,    color: C.red     },
    info:    { bg: C.amberLight,  border: C.amberBorder,  color: "#92400e" },
  };
  const s = styles[type] || styles.info;
  return (
    <div style={{
      background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12,
      padding: "clamp(10px, 3vw, 13px) clamp(12px, 4vw, 18px)", marginBottom: 16, 
      fontSize: "clamp(11px, 3vw, 13px)", color: s.color,
      display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.55,
    }}>
      {children}
    </div>
  );
};

const th = {
  padding: "clamp(8px, 2vw, 11px) clamp(10px, 2.5vw, 16px)", 
  textAlign: "left", fontWeight: 700,
  color: C.muted, fontSize: "clamp(9px, 2.5vw, 10px)", 
  textTransform: "uppercase",
  letterSpacing: "0.7px", background: C.grayLight,
  borderBottom: `1px solid ${C.border}`,
  whiteSpace: "nowrap",
};

const td = { 
  padding: "clamp(10px, 2.5vw, 14px) clamp(10px, 2.5vw, 16px)", 
  color: "#374151", 
  fontSize: "clamp(11px, 3vw, 13px)",
  wordBreak: "break-word",
};

const Spinner = ({ size = 28, color = C.amber }) => (
  <div style={{
    width: size, height: size,
    border: `3px solid ${C.border}`,
    borderTop: `3px solid ${color}`,
    borderRadius: "50%",
    animation: "spin 0.75s linear infinite",
    flexShrink: 0,
  }} />
);

const fmtDateTime = (date) => {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
};

const SignalTags = ({ signals }) => {
  const getSignalColor = (score) => {
    if (score >= 35) return { bg: C.redLight, color: C.red, border: C.redBorder };
    if (score >= 20) return { bg: C.orangeLight, color: C.orange, border: C.orangeBorder };
    return { bg: C.yellowLight, color: "#b45309", border: C.yellowBorder };
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {signals.slice(0, 3).map((signal, idx) => {
        const colors = getSignalColor(signal.score);
        return (
          <span
            key={idx}
            title={signal.reason}
            style={{
              background: colors.bg,
              color: colors.color,
              border: `1px solid ${colors.border}`,
              padding: "2px 8px",
              borderRadius: 6,
              fontSize: "clamp(9px, 2.5vw, 10px)",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {signal.name}: +{signal.score}
          </span>
        );
      })}
      {signals.length > 3 && (
        <span style={{ fontSize: "clamp(9px, 2.5vw, 10px)", color: C.muted, padding: "2px 6px" }}>
          +{signals.length - 3} more
        </span>
      )}
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  const modalRef = useRef(null);
  const touchStartRef = useRef(0);

  useEffect(() => {
    if (!isOpen) return;

    const handleTouchStart = (e) => {
      touchStartRef.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
      const touchEnd = e.touches[0].clientY;
      if (touchEnd - touchStartRef.current > 100) {
        onClose();
      }
    };

    const modalElement = modalRef.current;
    if (modalElement) {
      modalElement.addEventListener('touchstart', handleTouchStart);
      modalElement.addEventListener('touchmove', handleTouchMove);
    }

    document.body.style.overflow = 'hidden';

    return () => {
      if (modalElement) {
        modalElement.removeEventListener('touchstart', handleTouchStart);
        modalElement.removeEventListener('touchmove', handleTouchMove);
      }
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, backdropFilter: "blur(2px)",
      padding: "clamp(10px, 4vw, 20px)",
    }} onClick={onClose}>
      <div 
        ref={modalRef}
        style={{
          background: C.surface, borderRadius: 20, maxWidth: 700, width: "100%",
          maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 35px -10px rgba(0,0,0,0.2)",
        }} 
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: "clamp(16px, 4vw, 20px) clamp(16px, 5vw, 24px)", 
          borderBottom: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          position: "sticky", top: 0, background: C.surface, zIndex: 1,
        }}>
          <h3 style={{ margin: 0, fontSize: "clamp(16px, 4.5vw, 18px)", fontWeight: 800, color: C.text }}>
            {title}
          </h3>
          <button 
            onClick={onClose} 
            style={{
              background: "none", border: "none", fontSize: "clamp(20px, 5vw, 24px)", 
              cursor: "pointer", color: C.muted, padding: "0 8px",
              minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center",
            }}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        <div style={{ padding: "clamp(16px, 4vw, 24px)" }}>
          {children}
        </div>
      </div>
    </div>
  );
};

// User Detail Modal with Account Actions
const UserDetailModal = ({ user, onClose, onDelete, onStatusUpdate, onResetPassword }) => {
  const [tempPassword, setTemp] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const fullName = user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user.user_id || "Unknown User";

  const handleAction = (type) => {
    const msgs = {
      delete:   `Delete ${fullName}? This cannot be undone.`,
      suspend:  `Suspend ${fullName}? They won't be able to access their account.`,
      activate: `Activate ${fullName}?`,
      reset:    `Reset password for ${fullName}?`,
    };
    setConfirm({ type, message: msgs[type] });
  };

  const handleConfirm = async () => {
    const { type } = confirm;
    setConfirm(null);
    if (type === "delete") { await onDelete(user.user_id); onClose(); }
    if (type === "suspend") await onStatusUpdate(user.user_id, "suspended");
    if (type === "activate") await onStatusUpdate(user.user_id, "active");
    if (type === "reset") { const pwd = await onResetPassword(user.user_id); if (pwd) setTemp(pwd); }
  };

  return (
    <>
      <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div style={{ background: "white", borderRadius: "28px", width: "520px", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px rgba(0,0,0,0.3)", animation: "scaleIn 0.2s ease" }}>
          
          {/* Header */}
          <div style={{ background: C.red, paddingTop: "28px", paddingLeft: "28px", paddingRight: "28px", position: "relative", flexShrink: 0, borderRadius: "28px 28px 0 0" }}>
            <button onClick={onClose} style={{ position: "absolute", top: "20px", right: "20px", background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: "36px", height: "36px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
              <X size={18} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <Avatar user={user} size={70} fontSize={24} />
              <div>
                <h2 style={{ color: "white", margin: "0 0 8px", fontSize: "22px", fontWeight: "600" }}>{fullName}</h2>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <RiskPill level={user.risk_level} />
                  <StatusBadge status={user.account_status || "active"} />
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px", background: "#F7F5EF", borderRadius: "0 0 28px 28px" }}>
            {tempPassword && (
              <div style={{ background: C.amberLight, border: `1px solid ${C.amberBorder}`, borderRadius: "16px", padding: "16px", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <KeyRound size={18} color={C.amber} />
                  <strong style={{ color: C.amber, fontSize: "14px" }}>Temporary Password</strong>
                </div>
                <code style={{ display: "block", background: "white", padding: "12px", borderRadius: "12px", fontFamily: "monospace", fontSize: "14px", color: "#111827", border: `1px solid ${C.amberBorder}`, marginBottom: "8px" }}>{tempPassword}</code>
                <p style={{ fontSize: "12px", color: C.amber, margin: 0 }}>Share this with the user. They'll be prompted to change it on next login.</p>
              </div>
            )}

            <div style={{ background: "white", borderRadius: "20px", padding: "20px", marginBottom: "16px", border: "1px solid #ebe9e3" }}>
              <h4 style={{ margin: "0 0 16px", fontSize: "13px", fontWeight: "600", color: C.red, textTransform: "uppercase", letterSpacing: "0.5px" }}>Fraud Information</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "12px", background: "#F7F5EF", border: `1px solid gray`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <ShieldAlert size={16} color="gray" />
                  </div>
                  <div><div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "500", marginBottom: "2px" }}>Risk Score</div><div style={{ fontSize: "20px", fontWeight: "700", color: user.total_score >= 80 ? C.red : user.total_score >= 50 ? C.orange : C.yellow }}>{user.total_score}</div></div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "12px", background: "#F7F5EF", border: `1px solid gray`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Calendar size={16} color="gray" />
                  </div>
                  <div><div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "500", marginBottom: "2px" }}>Last Evaluated</div><div style={{ fontSize: "14px", color: "#111827", fontWeight: "500" }}>{fmtDateTime(user.evaluated_at)}</div></div>
                </div>
              </div>
            </div>

            <div style={{ background: "white", borderRadius: "20px", padding: "20px", border: "1px solid #ebe9e3" }}>
              <h4 style={{ margin: "0 0 16px", fontSize: "13px", fontWeight: "600", color: C.red, textTransform: "uppercase", letterSpacing: "0.5px" }}>Account Actions</h4>
              <div style={{ display: "flex", flexDirection: "row", gap: "8px", flexWrap: "wrap" }}>
                {(user.account_status || "active") === "active"
                  ? <button onClick={() => handleAction("suspend")} style={{ flex: 1, padding: "10px 14px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: "500", fontSize: "13px", cursor: "pointer" }}>Suspend Account</button>
                  : <button onClick={() => handleAction("activate")} style={{ flex: 1, padding: "10px 14px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: "500", fontSize: "13px", cursor: "pointer" }}>Activate Account</button>}
                <button onClick={() => handleAction("reset")} style={{ flex: 1, padding: "10px 14px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: "500", fontSize: "13px", cursor: "pointer" }}>Reset Password</button>
                <button onClick={() => handleAction("delete")} style={{ flex: 1, padding: "10px 14px", borderRadius: "10px", border: "1px solid #fecaca", background: "white", color: "#dc2626", fontWeight: "500", fontSize: "13px", cursor: "pointer" }}>Delete Account</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {confirm && <ConfirmDialog message={confirm.message} danger={confirm.type === "delete" || confirm.type === "suspend"} onConfirm={handleConfirm} onCancel={() => setConfirm(null)} />}
    </>
  );
};

export default function FraudDashboard() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rescanning, setRescanning] = useState(null);
  const [reviewAction, setReviewAction] = useState({ action: "", note: "" });
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [error, setError] = useState(null);
  const [filterLevel, setFilterLevel] = useState("monitor");
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  // API Calls
  const fetchFlaggedUsers = useCallback(async (level = "monitor") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/fraud/flagged?level=${level}`, {
        headers: authHeaders()
      });
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e) {
      setError("Failed to load fraud reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlaggedUsers(filterLevel);
  }, [fetchFlaggedUsers, filterLevel]);

  const fetchUserDetail = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/fraud/user/${userId}`, {
        headers: authHeaders()
      });
      const data = await res.json();
      setSelectedUser(data);
      setShowDetailModal(true);
    } catch (e) {
      showToast("Failed to load user details.", "error");
    }
  };

  const handleRescan = async (userId) => {
    setRescanning(userId);
    try {
      const res = await fetch(`${API_BASE}/fraud/user/${userId}/rescan`, {
        method: "POST",
        headers: authHeaders()
      });
      const data = await res.json();
      showToast(`Rescan complete: ${data.risk_level} (${data.total_score} points)`);
      await fetchFlaggedUsers(filterLevel);
    } catch (e) {
      showToast("Rescan failed: " + e.message, "error");
    } finally {
      setRescanning(null);
    }
  };

  const handleManualReview = async (userId) => {
    if (!reviewAction.action) return;
    try {
      const res = await fetch(`${API_BASE}/fraud/user/${userId}/review`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          action: reviewAction.action,
          note: reviewAction.note
        })
      });
      const data = await res.json();
      showToast(`User set to ${data.new_level}`);
      setShowReviewModal(false);
      setReviewAction({ action: "", note: "" });
      await fetchFlaggedUsers(filterLevel);
    } catch (e) {
      showToast("Review failed: " + e.message, "error");
    }
  };

  // Account Management Functions
  const handleDeleteUser = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/customer/${userId}`, {
        method: "DELETE",
        headers: authHeaders()
      });
      if (!res.ok) throw new Error();
      showToast("User deleted successfully");
      await fetchFlaggedUsers(filterLevel);
      setSelectedUser(null);
    } catch (e) {
      showToast("Failed to delete user", "error");
    }
  };

  const handleStatusUpdate = async (userId, status) => {
    try {
      const res = await fetch(`${API_BASE}/customer/${userId}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error();
      showToast(`User ${status === "active" ? "activated" : "suspended"}`);
      await fetchFlaggedUsers(filterLevel);
      if (selectedUser) {
        setSelectedUser({ ...selectedUser, account_status: status });
      }
    } catch (e) {
      showToast("Failed to update status", "error");
    }
  };

  const handleResetPassword = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/customer/${userId}/reset-password`, {
        method: "PATCH",
        headers: authHeaders()
      });
      const data = await res.json();
      showToast("Password reset successfully");
      return data?.temp_password ?? null;
    } catch (e) {
      showToast("Failed to reset password", "error");
      return null;
    }
  };

  // Confirm dialog helper
  const handleConfirmAction = (type, userId) => {
    const user = users.find(u => u.user_id === userId);
    const fullName = user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : userId;
    const msgs = {
      delete: `Permanently delete ${fullName}? This will remove all their data and cannot be undone.`,
      suspend: `Suspend ${fullName}? They will not be able to log in or perform actions.`,
      activate: `Activate ${fullName}? They will regain full access to the platform.`,
    };
    setConfirm({ type, userId, message: msgs[type] });
  };

  const executeConfirm = async () => {
    const { type, userId } = confirm;
    setConfirm(null);
    if (type === "delete") await handleDeleteUser(userId);
    if (type === "suspend") await handleStatusUpdate(userId, "suspended");
    if (type === "activate") await handleStatusUpdate(userId, "active");
  };

  const stats = {
    monitor: users.filter(u => u.risk_level === "monitor").length,
    restrict: users.filter(u => u.risk_level === "restrict").length,
    suspend: users.filter(u => u.risk_level === "suspend").length,
    avgScore: users.length ? Math.round(users.reduce((sum, u) => sum + (u.total_score || 0), 0) / users.length) : 0,
  };

  const TABS = [
    { id: "monitor", label: "Monitor", count: stats.monitor, color: C.yellow },
    { id: "restrict", label: "Restrict", count: stats.restrict, color: C.orange },
    { id: "suspend", label: "Suspend", count: stats.suspend, color: C.red },
  ];

  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <div style={{ 
        minHeight: "89vh", 
        background: C.bg, 
        fontFamily: '"DM Sans", -apple-system, sans-serif', 
        padding: "clamp(12px, 4vw, 2rem)",
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 clamp(8px, 2vw, 16px)" }}>

          {/* Header - FIXED */}
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "flex-start", 
            marginBottom: "clamp(20px, 5vw, 28px)", 
            flexWrap: "wrap", 
            gap: 16 
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                <div style={{ 
                  width: "clamp(32px, 8vw, 36px)", 
                  height: "clamp(32px, 8vw, 36px)", 
                  background: C.redLight, 
                  borderRadius: 10, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  fontSize: "clamp(16px, 4vw, 18px)"
                }}>
                  🛡️
                </div>
                <h1 style={{ fontSize: "clamp(20px, 6vw, 24px)", fontWeight: 800, color: C.red, margin: 0 }}>
                  Fraud Detection
                </h1>
              </div>
              <p style={{ color: C.muted, margin: 0, fontSize: "clamp(11px, 3vw, 13px)", paddingLeft: "clamp(0px, 2vw, 46px)" }}>
                Monitor suspicious activity & enforce risk rules
              </p>
            </div>
          </div>

          {/* Stats */}
          <div style={{ 
            display: "flex", 
            gap: "clamp(10px, 2.5vw, 12px)", 
            marginBottom: "clamp(20px, 5vw, 24px)", 
            flexWrap: "wrap",
            flexDirection: "row",
          }}>
            <StatCard label="Monitor" value={stats.monitor} sub="Needs observation" accent={C.yellow} />
            <StatCard label="Restrict" value={stats.restrict} sub="Limited access" accent={C.orange} />
            <StatCard label="Suspend" value={stats.suspend} sub="Account frozen" accent={C.red} />
            <StatCard label="Avg Risk Score" value={stats.avgScore} sub={`Out of ${users.length} users`} accent={C.amber} />
          </div>

          {/* Banners */}
          {stats.suspend > 0 && (
            <Banner type="error">
              <span style={{ fontSize: "clamp(14px, 4vw, 16px)" }}>⚠️</span>
              <span><strong>{stats.suspend} accounts</strong> have been suspended. Review immediately.</span>
            </Banner>
          )}
          {error && <Banner type="error">❌ {error}</Banner>}

          {/* Tabs */}
          <div style={{ 
            display: "flex", 
            gap: 6, 
            marginBottom: 16, 
            borderBottom: `2px solid ${C.border}`,
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
          }}>
            {TABS.map(({ id, label, count, color }) => {
              const active = filterLevel === id;
              return (
                <button
                  key={id}
                  onClick={() => setFilterLevel(id)}
                  style={{
                    padding: "clamp(8px, 2.5vw, 10px) clamp(12px, 3.5vw, 18px)", 
                    borderRadius: "10px 10px 0 0", 
                    fontSize: "clamp(11px, 3vw, 13px)", 
                    fontWeight: 700,
                    border: `1px solid ${active ? C.border : "transparent"}`,
                    borderBottom: active ? `2px solid ${C.surface}` : "none",
                    background: active ? C.surface : "transparent",
                    color: active ? C.text : C.muted,
                    cursor: "pointer", 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 7,
                    marginBottom: active ? "-2px" : 0,
                    whiteSpace: "nowrap",
                    minHeight: 44,
                  }}
                >
                  {label}
                  {count > 0 && (
                    <span style={{
                      background: active ? color : C.border,
                      color: active ? "#fff" : C.muted,
                      borderRadius: 999, 
                      padding: "1px 8px", 
                      fontSize: "clamp(10px, 2.5vw, 11px)", 
                      fontWeight: 800,
                    }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Users Table */}
          {loading ? (
            <div style={{
              textAlign: "center", 
              padding: "clamp(40px, 15vw, 80px)", 
              background: C.surface,
              borderRadius: 16, 
              border: `1px solid ${C.border}`,
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center", 
              gap: 16,
            }}>
              <Spinner size={36} />
              <p style={{ color: C.muted, margin: 0, fontWeight: 600, fontSize: "clamp(12px, 3.5vw, 14px)" }}>
                Loading fraud reports…
              </p>
            </div>
          ) : (
            <div style={{ 
              background: C.surface, 
              borderRadius: 16, 
              border: `1px solid ${C.border}`, 
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
            }}>
              <table style={{ 
                width: "100%", 
                borderCollapse: "collapse",
                minWidth: 800,
              }}>
                <thead>
                  <tr>
                    {["User", "Risk Level", "Score", "Signals", "Last Evaluated", "Actions"].map(h => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ 
                        padding: "clamp(40px, 15vw, 64px) 24px", 
                        textAlign: "center", 
                        color: C.muted, 
                        fontSize: "clamp(12px, 3.5vw, 14px)", 
                        fontWeight: 600 
                      }}>
                        No flagged users in this category 🎉
                      </td>
                    </tr>
                  ) : users.map(user => (
                    <tr
                      key={user.user_id}
                      style={{ borderBottom: `1px solid ${C.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = C.grayLight}
                      onMouseLeave={e => e.currentTarget.style.background = C.surface}
                    >
                      <td style={{ ...td, fontWeight: 700, color: C.text }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <Avatar user={user} size={36} fontSize={12} />
                          <div>
                            <div style={{ fontWeight: 600, marginBottom: "2px" }}>
                              {user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user.user_id.slice(0, 16)}
                            </div>
                            <div style={{ fontSize: "11px", color: C.muted, fontFamily: "monospace" }}>
                              {user.user_id.slice(0, 12)}…
                            </div>
                          </div>
                        </div>
                       </td>
                      <td style={td}>
                        <RiskPill level={user.risk_level} />
                      </td>
                      <td style={{ 
                        ...td, 
                        fontWeight: 800, 
                        fontSize: "clamp(16px, 4.5vw, 18px)", 
                        color: user.total_score >= 80 ? C.red : user.total_score >= 50 ? C.orange : C.yellow 
                      }}>
                        {user.total_score}
                      </td>
                      <td style={td}>
                        <SignalTags signals={user.signals || []} />
                      </td>
                      <td style={{ ...td, color: C.muted, fontSize: "clamp(10px, 2.5vw, 12px)" }}>
                        {fmtDateTime(user.evaluated_at)}
                      </td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        <div style={{ 
                          display: "flex", 
                          gap: "clamp(6px, 2vw, 8px)", 
                          flexWrap: "wrap",
                        }}>
                          <button
                            onClick={() => fetchUserDetail(user.user_id)}
                            style={{
                              background: "none", 
                              border: `1px solid ${C.border}`,
                              borderRadius: 8, 
                              padding: "clamp(4px, 1.5vw, 6px) clamp(8px, 2vw, 12px)", 
                              fontSize: "clamp(10px, 2.5vw, 11px)",
                              fontWeight: 600, 
                              cursor: "pointer", 
                              color: C.text,
                              minHeight: 32,
                              whiteSpace: "nowrap",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Eye size={12} /> Details
                          </button>
                          <button
                            onClick={() => handleRescan(user.user_id)}
                            disabled={rescanning === user.user_id}
                            style={{
                              background: C.amberLight, 
                              border: `1px solid ${C.amberBorder}`,
                              borderRadius: 8, 
                              padding: "clamp(4px, 1.5vw, 6px) clamp(8px, 2vw, 12px)", 
                              fontSize: "clamp(10px, 2.5vw, 11px)",
                              fontWeight: 600, 
                              cursor: rescanning === user.user_id ? "not-allowed" : "pointer",
                              color: C.amber,
                              minHeight: 32,
                              whiteSpace: "nowrap",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            {rescanning === user.user_id ? <Spinner size={12} /> : <RefreshCw size={12} />}
                            Rescan
                          </button>
                          <button
                            onClick={() => handleConfirmAction("suspend", user.user_id)}
                            style={{
                              background: C.redLight, 
                              border: `1px solid ${C.redBorder}`,
                              borderRadius: 8, 
                              padding: "clamp(4px, 1.5vw, 6px) clamp(8px, 2vw, 12px)", 
                              fontSize: "clamp(10px, 2.5vw, 11px)",
                              fontWeight: 600, 
                              cursor: "pointer", 
                              color: C.red,
                              minHeight: 32,
                              whiteSpace: "nowrap",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <UserX size={12} /> Suspend
                          </button>
                          <button
                            onClick={() => handleConfirmAction("delete", user.user_id)}
                            style={{
                              background: "none", 
                              border: `1px solid ${C.redBorder}`,
                              borderRadius: 8, 
                              padding: "clamp(4px, 1.5vw, 6px) clamp(8px, 2vw, 12px)", 
                              fontSize: "clamp(10px, 2.5vw, 11px)",
                              fontWeight: 600, 
                              cursor: "pointer", 
                              color: C.red,
                              minHeight: 32,
                              whiteSpace: "nowrap",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                       </td>
                     </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Info Footer */}
          {users.length > 0 && (
            <div style={{
              marginTop: 14, 
              padding: "clamp(10px, 3vw, 12px) clamp(12px, 4vw, 16px)",
              background: C.grayLight, 
              borderRadius: 10, 
              border: `1px solid ${C.border}`,
              fontSize: "clamp(10px, 2.5vw, 12px)", 
              color: C.muted, 
              display: "flex", 
              gap: "clamp(12px, 4vw, 24px)", 
              flexWrap: "wrap",
            }}>
              <span>📊 <strong>Risk Scoring:</strong></span>
              <span>• 0-24: Clean</span>
              <span>• 25-49: Monitor</span>
              <span>• 50-79: Restrict</span>
              <span>• 80+: Suspend</span>
              <span style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: "clamp(12px, 4vw, 20px)" }}>
                🔄 <strong>Rescan</strong> = Re-evaluate all fraud signals
              </span>
              <span>👥 <strong>Actions</strong> = Suspend/Delete user accounts</span>
            </div>
          )}

        </div>
      </div>

      {/* User Detail Modal */}
      {showDetailModal && selectedUser && (
        <UserDetailModal 
          user={selectedUser} 
          onClose={() => setShowDetailModal(false)} 
          onDelete={handleDeleteUser}
          onStatusUpdate={handleStatusUpdate}
          onResetPassword={handleResetPassword}
        />
      )}

      {/* Manual Review Modal */}
      <Modal isOpen={showReviewModal} onClose={() => setShowReviewModal(false)} title="Manual Review">
        {selectedUser && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: "clamp(11px, 3vw, 13px)", color: C.muted, marginBottom: 4 }}>User</div>
              <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "clamp(12px, 3vw, 14px)", wordBreak: "break-all" }}>
                {selectedUser.user_id}
              </div>
              <div style={{ marginTop: 8, fontSize: "clamp(11px, 3vw, 13px)" }}>
                Current Risk: <RiskPill level={selectedUser.risk_level} />
              </div>
              <div style={{ fontSize: "clamp(11px, 3vw, 13px)" }}>Score: <strong>{selectedUser.total_score}</strong></div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: "clamp(11px, 3vw, 12px)", fontWeight: 700, marginBottom: 8, color: C.text }}>
                Action
              </label>
              <div style={{ display: "flex", gap: "clamp(12px, 4vw, 16px)", flexWrap: "wrap" }}>
                {["clear", "restrict", "suspend"].map(action => (
                  <label key={action} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="action"
                      value={action}
                      checked={reviewAction.action === action}
                      onChange={(e) => setReviewAction({ ...reviewAction, action: e.target.value })}
                      style={{ width: "clamp(16px, 4vw, 18px)", height: "clamp(16px, 4vw, 18px)" }}
                    />
                    <span style={{ fontSize: "clamp(12px, 3.5vw, 13px)", textTransform: "capitalize" }}>{action}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: "clamp(11px, 3vw, 12px)", fontWeight: 700, marginBottom: 8, color: C.text }}>
                Note (optional)
              </label>
              <textarea
                value={reviewAction.note}
                onChange={(e) => setReviewAction({ ...reviewAction, note: e.target.value })}
                placeholder="Add a reason for this action..."
                style={{
                  width: "100%", 
                  padding: "clamp(8px, 2.5vw, 10px) clamp(10px, 3vw, 12px)", 
                  border: `1px solid ${C.border}`,
                  borderRadius: 10, 
                  fontSize: "clamp(12px, 3.5vw, 13px)", 
                  fontFamily: "inherit",
                  resize: "vertical", 
                  minHeight: 80,
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                onClick={() => setShowReviewModal(false)}
                style={{
                  padding: "clamp(8px, 2.5vw, 10px) clamp(16px, 5vw, 20px)", 
                  borderRadius: 10, 
                  border: `1px solid ${C.border}`,
                  background: "none", 
                  cursor: "pointer", 
                  fontSize: "clamp(12px, 3.5vw, 13px)",
                  minHeight: 44,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleManualReview(selectedUser.user_id)}
                disabled={!reviewAction.action}
                style={{
                  padding: "clamp(8px, 2.5vw, 10px) clamp(16px, 5vw, 20px)", 
                  borderRadius: 10, 
                  border: "none",
                  background: reviewAction.action ? C.text : C.grayLight,
                  color: reviewAction.action ? "#fff" : C.muted,
                  cursor: reviewAction.action ? "pointer" : "not-allowed",
                  fontSize: "clamp(12px, 3.5vw, 13px)", 
                  fontWeight: 600,
                  minHeight: 44,
                }}
              >
                Submit Review
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Dialog */}
      {confirm && (
        <ConfirmDialog 
          message={confirm.message} 
          danger={confirm.type === "delete" || confirm.type === "suspend"} 
          onConfirm={executeConfirm} 
          onCancel={() => setConfirm(null)} 
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        button { transition: all 0.2s ease; }
        button:active { transform: scale(0.97); }
      `}</style>
    </>
  );
}