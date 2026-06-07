import { useEffect, useState, useRef } from "react";
import {
  Search, CheckCircle, XCircle, MoreVertical,
  Phone, Mail, Briefcase, Calendar, X, User,
  Trash2, KeyRound, AlertTriangle, ChevronDown, ShieldAlert,
  Filter, RefreshCw, Eye, UserCheck, UserX, Clock
} from "lucide-react";
import { fetchAllCustomer, getNoOfTasksAssignedByEachCustomer } from "../../api/api";

const BASE = "http://localhost:8000/api";

const deleteCustomer     = (id)         => fetch(`${BASE}/customer/${id}`,               { method: "DELETE" });
const updateStatus       = (id, status) => fetch(`${BASE}/customer/${id}/status`,         { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
const resetPassword      = (id)         => fetch(`${BASE}/customer/${id}/reset-password`, { method: "PATCH", headers: { "Content-Type": "application/json" } });
const fetchReportsByUser = (id)         => fetch(`${BASE}/reports/user/${id}`).then(r => r.json()).catch(() => []);

// Orange palette — used ONLY inside UserDetailModal
const O = {
  50:  "#fff7ed",
  100: "#ffedd5",
  200: "#fed7aa",
  300: "#fdba74",
  400: "#fb923c",
  500: "#f97316",
  600: "#ea580c",
  700: "#c2410c",
  header: "#f9ad66",
};

// ── Shared components (original styling) ─────────────────────────────────────

const StatusBadge = ({ status }) => {
  const map = {
    active:    { color: "#059669", bg: "#ffffff", icon: CheckCircle, label: "Active" },
    pending:   { color: "#b45309", bg: "#ffffff", icon: Clock,       label: "Pending" },
    suspended: { color: "#b91c1c", bg: "#ffffff", icon: XCircle,     label: "Suspended" },
  };
  const config = map[status?.toLowerCase()] ?? { color: "#6b7280", bg: "#ffffff", icon: User, label: status ?? "Unknown" };
  const Icon = config.icon;
  return (
    <span style={{ background: config.bg, color: config.color, borderRadius: "100px", padding: "4px 10px 4px 8px", fontSize: "12px", fontWeight: "500", display: "inline-flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
      <Icon size={12} />{config.label}
    </span>
  );
};

const Avatar = ({ user, size = 38, fontSize = 14 }) => {
  const initials = `${user.first_name?.[0] ?? "?"}${user.last_name?.[0] ?? ""}`.toUpperCase();
  const colors   = ["#F7BE88"];
  const color    = colors[(user.first_name?.charCodeAt(0) ?? 0) % colors.length];
  if (user.profile_picture && !user.profile_picture.includes("string") && user.profile_picture.startsWith("http"))
    return <img src={user.profile_picture} alt={initials} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg, ${color}, ${color}dd)`, color: "white", fontWeight: "600", fontSize, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "2px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      {initials}
    </div>
  );
};

const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 99999, background: type === "error" ? "#ef4444" : type === "warning" ? "#f59e0b" : "#10b981", color: "white", padding: "12px 20px", borderRadius: "12px", fontSize: "14px", fontWeight: "500", boxShadow: "0 10px 25px rgba(0,0,0,0.15)", animation: "slideUp 0.2s ease", display: "flex", alignItems: "center", gap: "8px", maxWidth: "300px" }}>
      {type === "success" && <CheckCircle size={18} />}
      {type === "error"   && <XCircle size={18} />}
      {type === "warning" && <AlertTriangle size={18} />}
      {message}
    </div>
  );
};

const ConfirmDialog = ({ message, onConfirm, onCancel, danger = false }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.2s ease" }}>
    <div style={{ background: "white", borderRadius: "24px", padding: "28px", width: "360px", boxShadow: "0 25px 50px rgba(0,0,0,0.3)", animation: "scaleIn 0.2s ease" }}>
      <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: danger ? "#fee2e2" : "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>
        <AlertTriangle size={24} color={danger ? "#dc2626" : "#d97706"} />
      </div>
      <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: "600", color: "#111827" }}>Confirm Action</h3>
      <p style={{ margin: "0 0 24px", fontSize: "14px", color: "#6b7280", lineHeight: "1.5" }}>{message}</p>
      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
        <button onClick={onCancel}  style={{ padding: "10px 20px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: "14px", fontWeight: "500", color: "#6b7280" }}>Cancel</button>
        <button onClick={onConfirm} style={{ padding: "10px 20px", borderRadius: "12px", border: "none", background: danger ? "#dc2626" : "#d97706", cursor: "pointer", fontSize: "14px", fontWeight: "500", color: "white" }}>Confirm</button>
      </div>
    </div>
  </div>
);

const StatCard = ({ label, value, color, bgColor }) => (
  <div style={{ 
    background: "white", 
    borderRadius: "16px", 
    padding: "20px", 
    border: "1px solid #fed7aa",
    borderLeft: "4px solid rgb(215, 125, 67)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
  }}>
    <div style={{ 
      fontSize: "12px", 
      color: "#9ca3af", 
      fontWeight: "600", 
      marginBottom: "8px", 
      textTransform: "uppercase", 
      letterSpacing: "0.5px" 
    }}>{label}</div>
    <div style={{ 
      fontSize: "32px", 
      fontWeight: "600", 
      color: "#111827", 
      lineHeight: 1 
    }}>{value}</div>
  </div>
);

const ContextMenu = ({ onAction, onClose }) => {
  const menuRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={menuRef} style={{ position: "absolute", right: 0, top: "100%", zIndex: 100000, background: "white", borderRadius: "14px", boxShadow: "0 10px 40px rgba(0,0,0,0.15)", border: "1px solid #e5e7eb", minWidth: "200px", marginTop: "4px", animation: "scaleIn 0.1s ease" }}>
      {[
        { label: "View Details",   icon: Eye,       action: "view",     color: "#3b82f6" },
        { label: "Activate",       icon: UserCheck,  action: "activate", color: "#059669" },
        { label: "Suspend",        icon: UserX,      action: "suspend",  color: "#dc2626" },
        { label: "Delete",         icon: Trash2,     action: "delete",   color: "#dc2626" },
      ].map(({ label, icon: Icon, action, color }) => (
        <button key={action} onClick={() => { onAction(action); onClose(); }} style={{ width: "100%", padding: "12px 16px", border: "none", background: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", fontSize: "13px", fontWeight: "500", color, textAlign: "left", borderBottom: "1px solid #f3f4f6" }}
          onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
          onMouseLeave={e => e.currentTarget.style.background = "white"}
        >
          <Icon size={16} />{label}
        </button>
      ))}
    </div>
  );
};

// ── UserDetailModal — orange themed ──────────────────────────────────────────

const UserDetailModal = ({ user, onClose, onDelete, onStatusUpdate, onResetPassword }) => {
  const [tab, setTab]           = useState("info");
  const [reports, setReports]   = useState([]);
  const [loadingReps, setLoadR] = useState(false);
  const [tempPassword, setTemp] = useState(null);
  const [confirm, setConfirm]   = useState(null);
  const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "Unknown User";

  useEffect(() => {
    if (tab !== "reports") return;
    setLoadR(true);
    fetchReportsByUser(user.id).then(d => { setReports(Array.isArray(d) ? d : d?.reports ?? []); setLoadR(false); });
  }, [tab, user.id]);

  const handleAction = (type) => {
    const msgs = {
      delete:   `Delete ${fullName}? This cannot be undone.`,
      suspend:  `Suspend ${fullName}? They won't be able to access their account.`,
      activate: `Activate ${fullName}?`,
    };
    setConfirm({ type, message: msgs[type] });
  };

  const handleConfirm = async () => {
    const type = confirm.type; setConfirm(null);
    if (type === "delete")   { await onDelete(user.id); onClose(); }
    if (type === "suspend")  await onStatusUpdate(user.id, "suspended");
    if (type === "activate") await onStatusUpdate(user.id, "active");
    if (type === "reset")    { const pwd = await onResetPassword(user.id); if (pwd) setTemp(pwd); }
  };

  return (
    <>
      <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div style={{ background: "white", borderRadius: "28px", width: "520px", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px rgba(0,0,0,0.3)", animation: "scaleIn 0.2s ease" }}>

          {/* Header — orange */}
          <div style={{ background: O.header, paddingTop: "28px", paddingLeft: "28px", paddingRight: "28px", position: "relative", flexShrink: 0, borderRadius: "28px 28px 0 0" }}>

            <button onClick={onClose} style={{ position: "absolute", top: "20px", right: "20px", background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: "36px", height: "36px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
              <X size={18} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <Avatar user={user} size={70} fontSize={24} />
              <div>
                <h2 style={{ color: "white", margin: "0 0 8px", fontSize: "22px", fontWeight: "600" }}>{fullName}</h2>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <StatusBadge status={user.status} />
                  {user.oauth_provider && (
                    <span style={{ background: "rgba(255,255,255,0.2)", color: "white", fontSize: "12px", padding: "4px 12px", borderRadius: "100px", fontWeight: "500" }}>
                      {user.oauth_provider}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "4px", marginTop: "24px", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
              {["info", "reports"].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 16px", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: "500", background: tab === t ? "white" : "transparent", color: tab === t ? O[600] : "rgba(255,255,255,0.7)", marginBottom: "-1px", transition: "all 0.15s" }}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Body — light orange tint */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px", background: "#F7F5EF", borderRadius: "0 0 28px 28px" }}>
            {tab === "info" && (
              <>
                {tempPassword && (
                  <div style={{ background: O[100], border: `1px solid ${O[300]}`, borderRadius: "16px", padding: "16px", marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <KeyRound size={18} color={O[700]} />
                      <strong style={{ color: O[700], fontSize: "14px" }}>Temporary Password</strong>
                    </div>
                    <code style={{ display: "block", background: "white", padding: "12px", borderRadius: "12px", fontFamily: "monospace", fontSize: "14px", color: "#111827", border: `1px solid ${O[200]}`, marginBottom: "8px" }}>{tempPassword}</code>
                    <p style={{ fontSize: "12px", color: O[700], margin: 0 }}>Share this with the user. They'll be prompted to change it on next login.</p>
                  </div>
                )}

                <div style={{ background: "white", borderRadius: "20px", padding: "20px", marginBottom: "16px", border: "1px solid #ebe9e3" }}>
                  <h4 style={{ margin: "0 0 16px", fontSize: "13px", fontWeight: "600", color: O[500], textTransform: "uppercase", letterSpacing: "0.5px" }}>Contact Information</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {user.email && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "12px", background: "#F7F5EF", border: `1px solid gray`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Mail size={16} color="gray" />
                        </div>
                        <div><div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "500", marginBottom: "2px" }}>Email</div><div style={{ fontSize: "14px", color: "#111827", fontWeight: "500" }}>{user.email}</div></div>
                      </div>
                    )}
                    {user.phoneNo && user.phoneNo !== "string" && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "12px", background: "#F7F5EF", border: `1px solid gray`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Phone size={16} color="gray" />
                        </div>
                        <div><div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "500", marginBottom: "2px" }}>Phone</div><div style={{ fontSize: "14px", color: "#111827", fontWeight: "500" }}>{user.phoneNo}</div></div>
                      </div>
                    )}
                    {user.registeredAt && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "12px", background: "#F7F5EF", border: `1px solid gray`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Calendar size={16} color="gray" />
                        </div>
                        <div><div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "500", marginBottom: "2px" }}>Joined</div><div style={{ fontSize: "14px", color: "#111827", fontWeight: "500" }}>{new Date(user.registeredAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div></div>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "12px", background: "#F7F5EF", border: `1px solid gray`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Briefcase size={16} color="gray" />
                      </div>
                      <div><div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "500", marginBottom: "2px" }}>Bookings</div><div style={{ fontSize: "14px", color: "#111827", fontWeight: "500" }}>{String(user.taskCount ?? 0)}</div></div>
                    </div>
                  </div>
                </div>

                <div style={{ background: "white", borderRadius: "20px", padding: "20px", border: "1px solid #ebe9e3" }}>
                  <h4 style={{ margin: "0 0 16px", fontSize: "13px", fontWeight: "600", color: O[500], textTransform: "uppercase", letterSpacing: "0.5px" }}>Account Actions</h4>
                  <div style={{ display: "flex", flexDirection: "row", gap: "8px" }}>
                    {user.status === "active"
                      ? <button onClick={() => handleAction("suspend")}  style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: "500", fontSize: "13px", cursor: "pointer", transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background="#f9fafb"} onMouseLeave={e => e.currentTarget.style.background="white"}>Suspend</button>
                      : <button onClick={() => handleAction("activate")} style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: "500", fontSize: "13px", cursor: "pointer", transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background="#f9fafb"} onMouseLeave={e => e.currentTarget.style.background="white"}>Activate</button>}
  
                    <button onClick={() => handleAction("delete")} style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #fecaca", background: "white", color: "#dc2626", fontWeight: "500", fontSize: "13px", cursor: "pointer", transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background="#fff5f5"} onMouseLeave={e => e.currentTarget.style.background="white"}>Delete</button>
                  </div>
                </div>
              </>
            )}

            {tab === "reports" && (
              loadingReps ? (
                <div style={{ textAlign: "center", padding: "40px", background: "white", borderRadius: "20px" }}>
                  <RefreshCw size={32} style={{ color: O[400], marginBottom: "12px", animation: "spin 1s linear infinite" }} />
                  <p style={{ color: "#6b7280", margin: 0 }}>Loading reports...</p>
                </div>
              ) : reports.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 24px", background: "white", borderRadius: "20px" }}>
                  <ShieldAlert size={48} style={{ color: O[300], marginBottom: "16px" }} />
                  <h4 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: "600", color: "#111827" }}>No Reports Found</h4>
                  <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>This customer doesn't have any reports yet.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {reports.map((r, i) => (
                    <div key={i} style={{ background: "white", borderRadius: "16px", padding: "16px", border: `1px solid ${O[100]}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <span style={{ fontWeight: "600", color: "#111827", fontSize: "14px" }}>{r.type ?? "Report"}</span>
                        <span style={{ padding: "2px 10px", borderRadius: "100px", fontSize: "12px", fontWeight: "500", background: r.status === "resolved" ? O[100] : r.status === "pending" ? O[50] : "#fee2e2", color: r.status === "resolved" ? O[700] : r.status === "pending" ? O[600] : "#b91c1c" }}>{r.status ?? "pending"}</span>
                      </div>
                      <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#4b5563", lineHeight: "1.5" }}>{r.description ?? r.message ?? "No description"}</p>
<span style={{ fontSize: "11px", color: "#9ca3af" }}>
  {r.date || r.createdAt ? new Date(r.date ?? r.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
</span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>
      {confirm && <ConfirmDialog message={confirm.message} danger={confirm.type === "delete" || confirm.type === "suspend"} onConfirm={handleConfirm} onCancel={() => setConfirm(null)} />}
    </>
  );
};

// ── UserRow (original) ────────────────────────────────────────────────────────

const UserRow = ({ user, onSelect, onStatusUpdate, onDelete, onResetPassword, onConfirmRequest }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "Unknown";

  const handleAction = (action) => {
    if (action === "view") { onSelect(user); return; }
    const msgs = {
      activate: `Activate ${fullName}?`,
      suspend:  `Suspend ${fullName}? They won't be able to log in.`,

      delete:   `Permanently delete ${fullName}? This cannot be undone.`,
    };
    onConfirmRequest({ type: action, message: msgs[action], userId: user.id });
  };

  return (
    <tr style={{ borderBottom: "1px solid #f3f4f6", transition: "all 0.2s", cursor: "pointer" }}
      onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
      onMouseLeave={e => e.currentTarget.style.background = "white"}
    >
      <td style={{ padding: "16px" }} onClick={() => onSelect(user)}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Avatar user={user} />
          <div>
            <div style={{ fontWeight: "600", color: "#111827", fontSize: "15px", marginBottom: "4px" }}>{fullName}</div>
            <div style={{ fontSize: "13px", color: "#6b7280", display: "flex", alignItems: "center", gap: "4px" }}><Mail size={12} />{user.email}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: "16px" }}>
        <span style={{ background: user.oauth_provider === "google" ? "#e6f0ff" : "#f3f4f6", color: user.oauth_provider === "google" ? "#2563eb" : "#161717", padding: "4px 12px", borderRadius: "20px", fontWeight: "500", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
          {user.oauth_provider === "google" ? "Google" : "Email"}
        </span>
      </td>
      <td style={{ fontSize: "14px", color: "#374151", fontWeight: "600", paddingLeft: "45px" }}>
        {user.taskCount ?? 0}
      </td>
      <td style={{ padding: "16px" }}><StatusBadge status={user.status} /></td>
      <td style={{ padding: "16px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "flex-end" }}>
          <button onClick={() => handleAction(user.status === "active" ? "suspend" : "activate")}
            style={{ padding: "8px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", cursor: "pointer", color: user.status === "active" ? "#dc2626" : "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}
            onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
            onMouseLeave={e => e.currentTarget.style.background = "white"}
          >
            {user.status === "active" ? <UserX size={16} /> : <UserCheck size={16} />}
          </button>
          <div style={{ position: "relative" }}>
            <button onClick={() => setMenuOpen(v => !v)}
              style={{ padding: "8px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", cursor: "pointer", color: "#6b7280", display: "flex", alignItems: "center", justifyContent: "center" }}
              onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
              onMouseLeave={e => e.currentTarget.style.background = "white"}
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && <ContextMenu onAction={handleAction} onClose={() => setMenuOpen(false)} />}
          </div>
        </div>
      </td>
    </tr>
  );
};

// ── Main page (original) ──────────────────────────────────────────────────────

export default function CustomerManagement() {
  const [users,        setUsers]   = useState([]);
  const [loading,      setLoading] = useState(true);
  const [error,        setError]   = useState(null);
  const [search,       setSearch]  = useState("");
  const [filterStatus, setFStatus] = useState("all");
  const [filterRole,   setFRole]   = useState("all");
  const [selected,     setSelect]  = useState(null);
  const [toast,        setToast]   = useState(null);
  const [showFilters,  setShowF]   = useState(false);
  const [confirm,      setConfirm] = useState(null);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  useEffect(() => {
    fetchAllCustomer()
      .then(d => { setUsers(Array.isArray(d) ? d : d?.customers ?? []); setLoading(false); })
      .catch(() => { setError("Failed to load users."); setLoading(false); });
  }, []);

  useEffect(() => {
    if (users.length === 0) return;
    getNoOfTasksAssignedByEachCustomer()
      .then(data => {
        const counts = {};
        (data?.task_counts ?? []).forEach(item => { if (item.customerId) counts[item.customerId] = item.assignedTaskCount; });
        setUsers(prev => prev.map(u => { const uid = u.id || u._id; return { ...u, taskCount: counts[uid] || 0 }; }));
      })
      .catch(err => console.error("Merge error:", err));
  }, [users.length]);

  const handleDelete = async (id) => {
    try { const res = await deleteCustomer(id); if (!res.ok) throw new Error(); setUsers(p => p.filter(u => u.id !== id)); setSelect(null); showToast("Customer deleted"); }
    catch { showToast("Failed to delete", "error"); }
  };

  const handleStatus = async (id, status) => {
    try { const res = await updateStatus(id, status); if (!res.ok) throw new Error(); setUsers(p => p.map(u => u.id === id ? { ...u, status } : u)); setSelect(p => p?.id === id ? { ...p, status } : p); showToast(`Customer ${status === "active" ? "activated" : "suspended"}`); }
    catch { showToast("Failed to update status", "error"); }
  };

  const handleReset = async (id) => {
    try { const res = await resetPassword(id); const data = await res.json(); showToast("Password reset"); return data?.temp_password ?? null; }
    catch { showToast("Failed to reset password", "error"); return null; }
  };

  const handleConfirm = async () => {
    const { type, userId } = confirm; setConfirm(null);
    if (type === "activate") await handleStatus(userId, "active");
    if (type === "suspend")  await handleStatus(userId, "suspended");
    if (type === "reset")    await handleReset(userId);
    if (type === "delete")   await handleDelete(userId);
  };

  const filtered = users
    .filter(u => filterRole   === "all" || u.role === filterRole)
    .filter(u => filterStatus === "all" || (u.status ?? "active") === filterStatus)
    .filter(u => {
      const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.toLowerCase();
      return name.includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    });

  const stats = {
    total:     users.length,
    active:    users.filter(u => (u.status ?? "active") === "active").length,
    suspended: users.filter(u => u.status === "suspended").length,
    pending:   users.filter(u => u.status === "pending").length,
  };

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", paddingLeft: "25px", paddingRight: "20px", paddingTop: "20px", paddingBottom: "20px", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <h1 style={{ 
  margin: "0 0 8px", 
  fontSize: "28px", 
  fontWeight: "600", 
  color: "rgb(215, 125, 67)"
}}>Customer Management</h1>
            <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>Manage and monitor all customer accounts</p>
          </div>
          <button onClick={() => setShowF(v => !v)} style={{ padding: "10px 20px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: "14px", fontWeight: "500", color: "#374151", display: "flex", alignItems: "center", gap: "8px" }}
            onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
            onMouseLeave={e => e.currentTarget.style.background = "white"}
          >
            <Filter size={16} /> Filters
            <ChevronDown size={16} style={{ transform: showFilters ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
          <StatCard label="Total Users" value={stats.total}     color="#080808" bgColor="#ffffff" />
          <StatCard label="Active"      value={stats.active}    color="#080808" bgColor="#ffffff" />
          <StatCard label="Suspended"   value={stats.suspended} color="#080808" bgColor="#ffffff" />
        </div>

        <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e5e7eb", padding: "16px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 1, position: "relative", minWidth: "250px" }}>
              <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input type="text" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: "100%", padding: "12px 12px 12px 42px", borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "14px", outline: "none", background: "#f9fafb", boxSizing: "border-box" }}
                onFocus={e => { e.target.style.borderColor = "#3b82f6"; e.target.style.background = "white"; }}
                onBlur={e  => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#f9fafb"; }}
              />
            </div>
            {showFilters && (
              <>
                <select value={filterRole} onChange={e => setFRole(e.target.value)} style={{ padding: "12px 16px", borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "14px", outline: "none", background: "#f9fafb", cursor: "pointer", minWidth: "150px" }}>
                  <option value="all">All Roles</option>
                  <option value="customer">Customers</option>
                  <option value="admin">Admins</option>
                </select>
                <select value={filterStatus} onChange={e => setFStatus(e.target.value)} style={{ padding: "12px 16px", borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "14px", outline: "none", background: "#f9fafb", cursor: "pointer", minWidth: "150px" }}>
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                </select>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ background: "white", borderRadius: "20px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
        {loading ? (
          <div style={{ padding: "80px", textAlign: "center" }}>
            <RefreshCw size={40} style={{ color: "#9ca3af", marginBottom: "16px", animation: "spin 1s linear infinite" }} />
            <p style={{ color: "#6b7280", margin: 0 }}>Loading customers...</p>
          </div>
        ) : error ? (
          <div style={{ padding: "80px", textAlign: "center" }}>
            <AlertTriangle size={40} style={{ color: "#dc2626", marginBottom: "16px" }} />
            <p style={{ color: "#dc2626", margin: 0 }}>{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "80px", textAlign: "center" }}>
            <User size={48} style={{ color: "#9ca3af", marginBottom: "16px" }} />
            <h3 style={{ margin: "0 0 8px", color: "#111827" }}>No customers found</h3>
            <p style={{ color: "#6b7280", margin: 0 }}>Try adjusting your search or filters</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                {["User", "Provider", "Bookings", "Status", "Actions"].map((h, i) => (
                  <th key={h} style={{ padding: "16px", textAlign: i === 4 ? "right" : "left", fontSize: "12px", fontWeight: "600", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((user, i) => (
                <UserRow key={user.id ?? i} user={user} onSelect={setSelect} onStatusUpdate={handleStatus} onDelete={handleDelete} onResetPassword={handleReset} onConfirmRequest={setConfirm} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && !error && filtered.length > 0 && (
        <div style={{ marginTop: "16px", fontSize: "13px", color: "#6b7280", textAlign: "right" }}>
          Showing {filtered.length} of {users.length} customers
        </div>
      )}

      {confirm  && <ConfirmDialog message={confirm.message} danger={confirm.type === "delete" || confirm.type === "suspend"} onConfirm={handleConfirm} onCancel={() => setConfirm(null)} />}
      {selected && <UserDetailModal user={selected} onClose={() => setSelect(null)} onDelete={handleDelete} onStatusUpdate={handleStatus} onResetPassword={handleReset} />}

      <style>{`
        @keyframes fadeIn  { from { opacity: 0; }                          to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin    { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}