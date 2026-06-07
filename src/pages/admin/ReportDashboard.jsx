import React, { useEffect, useState, useRef } from "react";
import {
  Search, Filter, ChevronDown, X, AlertTriangle, CheckCircle,
  XCircle, Clock, Trash2, Eye, User, Briefcase,
  RefreshCw, Flag, Sparkles, ShieldAlert, MessageSquare,
  TrendingUp, ChevronRight, Shield, UserCheck, UserX,
  AlertCircle, FileText, Calendar, MoreVertical, Info,
  Ban, Check, AlertOctagon, HelpCircle, Brain,
  ThumbsUp, ThumbsDown, Scale, Gavel, Zap, PenTool, RotateCcw,
  Star, MessageCircle, Layers, History, ShoppingBag, Award,
  DollarSign, CreditCard, MapPin, Phone, Mail, CalendarIcon,
  Bell, Send, Percent, Plus,
} from "lucide-react";
import BookingNavbar from "../../components/Navbar/Navbar";

const BASE = "http://localhost:8000/api";

const O = {
  50:     "#fff7ed",
  100:    "#ffedd5",
  200:    "#fed7aa",
  300:    "#fdba74",
  400:    "#fb923c",
  500:    "#f97316",
  600:    "#ea580c",
  700:    "#c2410c",
  header: "#fba452",
  bg:     "#F7F5EF",
  border: "#ebe9e3",
};

const C = {
  brand:       "#E8843A",
  brandLight:  "#E8843A18",
  brandHover:  "#D4712A",
  bg:          "#F7F5EF",
  surface:     "#FFFFFF",
  border:      "#EDE8DF",
  divider:     "#FAF7F2",
  textPrimary: "#1C1410",
  textSecond:  "#7A6E65",
  textMuted:   "#B0A89E",
  green:       "#3D9E6E",
  greenLight:  "#3D9E6E18",
  red:         "#D94F3D",
  redLight:    "#D94F3D15",
  blue:        "#3D7EC9",
  blueLight:   "#3D7EC918",
  purple:      "#7C5CBF",
  purpleLight: "#7C5CBF18",
  aiAccent:    "#6C3FFF",
  aiLight:     "#6C3FFF12",
  aiMid:       "#6C3FFF30",
};

const REASON_COLORS = {
  "Fraud / Scam":           { bg: "white", color: C.red,        icon: AlertOctagon  },
  "Harassment":             { bg: "white", color: C.red,        icon: AlertTriangle },
  "No show":                { bg: "white", color: C.brandHover, icon: Clock         },
  "Poor quality work":      { bg: "white", color: C.brandHover, icon: AlertCircle   },
  "Fake profile":           { bg: "white", color: C.red,        icon: UserX         },
  "Inappropriate behavior": { bg: "white", color: C.red,        icon: Ban           },
};

const SEV_CONFIG = {
  Critical: { color: "#D94F3D", bg: "#D94F3D12", bar: 95, icon: AlertOctagon  },
  High:     { color: "#E8843A", bg: "#E8843A12", bar: 70, icon: AlertTriangle },
  Medium:   { color: "#C9A83D", bg: "#C9A83D12", bar: 45, icon: HelpCircle    },
  Low:      { color: "#3D9E6E", bg: "#3D9E6E12", bar: 20, icon: Check         },
};

const ACTION_COLORS = {
  "Warn user":       { color: "#C9A83D",   bg: "#C9A83D12", icon: AlertCircle },
  "Suspend account": { color: C.red,       bg: C.redLight,  icon: Ban         },
  "Permanent ban":   { color: "#B02020",   bg: "#B0202012", icon: XCircle     },
  "Dismiss report":  { color: C.textMuted, bg: "#B0A89E12", icon: Check       },
};

const CRED_COLORS = {
  High:   { color: C.green, bg: C.greenLight, icon: Shield      },
  Medium: { color: C.brand, bg: C.brandLight, icon: Info        },
  Low:    { color: C.red,   bg: C.redLight,   icon: AlertCircle },
};

const toKTM = (d) => {
  if (!d) return null;
  const s = String(d);
  return new Date(!s.endsWith("Z") && !s.includes("+") ? s + "Z" : s);
};
const fmt = (d) => {
  try { const dt = toKTM(d); return dt ? dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Kathmandu" }) : "—"; }
  catch { return "—"; }
};
const fmtTime = (d) => {
  try { const dt = toKTM(d); return dt ? dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kathmandu" }) : ""; }
  catch { return ""; }
};
const shortId = (id) => id ? `#${id.slice(-6).toUpperCase()}` : "—";

const apiCall = async (url, options = {}) => {
  const token = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[API] ${options.method ?? "GET"} ${url} → ${res.status}`, body);
  }
  return res;
};

// ── Profile photo cache ───────────────────────────────────────────────────────
const photoCache = {};

const useProfilePhoto = (id, type) => {
  const [photo, setPhoto] = useState(photoCache[id] !== undefined ? photoCache[id] : null);
  const [name,  setName]  = useState(null);

  useEffect(() => {
    if (!id) return;
    if (photoCache[id] !== undefined) {
      setPhoto(photoCache[id]);
      const cachedName = photoCache[`${id}_name`];
      if (cachedName) setName(cachedName);
      return;
    }
    const endpoint = type === "worker" ? `${BASE}/worker/${id}` : `${BASE}/customer/${id}`;
    apiCall(endpoint).then(async res => {
      if (!res.ok) { photoCache[id] = null; setPhoto(null); setName(null); return; }
      const d = await res.json();
      const p = d.profilePhoto || d.profile_picture || d.photo || d.image || null;
      let n = null;
      if (type === "worker") {
        n = d.name || d.fullName || d.workerName ||
            `${d.firstName || ""} ${d.lastName || ""}`.trim() ||
            `${d.first_name || ""} ${d.last_name || ""}`.trim();
      } else {
        n = d.name || d.fullName || d.customerName ||
            `${d.first_name || ""} ${d.last_name || ""}`.trim() ||
            `${d.firstName || ""} ${d.lastName || ""}`.trim();
      }
      photoCache[id] = p;
      photoCache[`${id}_name`] = n;
      setPhoto(p);
      setName(n || null);
    }).catch(() => { photoCache[id] = null; setPhoto(null); setName(null); });
  }, [id, type]);

  return { photo, name };
};

// ── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = ({ type, size = 38, photo = null, name = null }) => {
  const [imgError, setImgError] = useState(false);
  const Icon  = type === "worker" ? Briefcase : User;
  const color = type === "worker" ? C.blue    : C.purple;
  const bg    = type === "worker" ? C.blueLight : C.purpleLight;
  const initials = name ? name.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase() : null;

  if (photo && !imgError) {
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "2px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
        <img src={photo} alt={name || type} onError={() => setImgError(true)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    );
  }
  if (initials) {
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "2px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", fontSize: size * 0.34, fontWeight: 700, letterSpacing: "-0.5px" }}>
        {initials}
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "2px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      <Icon size={size * 0.5} />
    </div>
  );
};

// ── Badges ────────────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    pending:  { bg: "white", color: C.brand, icon: Clock,       label: "Pending"  },
    resolved: { bg: "white", color: C.green, icon: CheckCircle, label: "Resolved" },
    declined: { bg: "white", color: C.red,   icon: XCircle,     label: "Declined" },
  };
  const c = map[status] ?? map.pending;
  const Icon = c.icon;
  return (
    <span style={{ background: c.bg, color: c.color, borderRadius: 100, padding: "4px 10px 4px 8px", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", border: `1px solid ${c.color}25` }}>
      <Icon size={12} />{c.label}
    </span>
  );
};

const TypeBadge = ({ type }) => {
  const isWorker = type === "worker";
  const Icon = isWorker ? Briefcase : User;
  return (
    <span style={{ background: isWorker ? C.blueLight : C.purpleLight, color: isWorker ? C.blue : C.purple, borderRadius: 100, padding: "2px 8px", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Icon size={11} />{isWorker ? "Worker" : "Customer"}
    </span>
  );
};

const ReasonBadge = ({ reason }) => {
  const config = REASON_COLORS[reason] ?? { bg: "#F0ECE7", color: C.textSecond, icon: AlertCircle };
  const Icon = config.icon;
  return (
    <span style={{ background: config.bg, color: config.color, borderRadius: 100, padding: "4px 10px 4px 8px", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", border: `1px solid ${config.color}25` }}>
      <Icon size={12} />{reason}
    </span>
  );
};

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const bg   = type === "error" ? C.red : type === "warning" ? C.brand : C.green;
  const Icon = type === "error" ? XCircle : type === "warning" ? AlertTriangle : CheckCircle;
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 99999, background: bg, color: "white", padding: "14px 20px", borderRadius: 12, fontSize: 14, fontWeight: 500, boxShadow: "0 10px 25px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 10, maxWidth: 380, animation: "slideUp 0.2s ease" }}>
      <Icon size={18} style={{ flexShrink: 0 }} />{message}
    </div>
  );
};

// ── Confirm Dialog ────────────────────────────────────────────────────────────
const ConfirmDialog = ({ title, message, subMessage, onConfirm, onCancel, danger = false, confirmLabel = "Confirm", cancelLabel = "Cancel" }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 100002, background: "rgba(28,20,16,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.2s ease" }}>
    <div style={{ background: C.surface, borderRadius: 24, padding: 28, width: 420, boxShadow: "0 25px 50px rgba(0,0,0,0.3)", animation: "scaleIn 0.2s ease" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: danger ? C.redLight : C.brandLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <AlertTriangle size={24} color={danger ? C.red : C.brand} />
      </div>
      <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: C.textPrimary }}>{title || "Confirm Action"}</h3>
      <p style={{ margin: "0 0 8px", fontSize: 14, color: C.textSecond, lineHeight: 1.5 }}>{message}</p>
      {subMessage && <p style={{ margin: "0 0 20px", fontSize: 13, color: C.textMuted, lineHeight: 1.5, padding: "10px 12px", background: C.bg, borderRadius: 10 }}>{subMessage}</p>}
      {!subMessage && <div style={{ marginBottom: 16 }} />}
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button onClick={onCancel}  style={{ padding: "10px 20px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", fontSize: 14, color: C.textSecond, fontFamily: "inherit" }}>{cancelLabel}</button>
        <button onClick={onConfirm} style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: danger ? C.red : C.green, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "white", fontFamily: "inherit" }}>{confirmLabel}</button>
      </div>
    </div>
  </div>
);

// ── Context Menu ──────────────────────────────────────────────────────────────
const ContextMenu = ({ report, onAction, onClose }) => {
  const menuRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const actions = [
    { label: "View Details", icon: Eye,         action: "view",    color: C.blue  },
    ...(report.status === "pending" ? [
      { label: "Resolve",    icon: CheckCircle, action: "resolve", color: C.green },
      { label: "Decline",    icon: XCircle,     action: "decline", color: C.red   },
    ] : []),
    { label: "Delete",       icon: Trash2,      action: "delete",  color: C.red   },
  ];

  return (
    <div ref={menuRef} style={{ position: "absolute", right: 0, top: "100%", zIndex: 100000, background: "white", borderRadius: 14, boxShadow: "0 10px 40px rgba(0,0,0,0.15)", border: `1px solid ${C.border}`, minWidth: 180, marginTop: 4, animation: "scaleIn 0.1s ease" }}>
      {actions.map(({ label, icon: Icon, action, color }) => (
        <button key={action} onClick={() => { onAction(action); onClose(); }}
          style={{ width: "100%", padding: "12px 16px", border: "none", background: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontSize: 13, fontWeight: 500, color, textAlign: "left", borderBottom: `1px solid ${C.divider}` }}
          onMouseEnter={e => e.currentTarget.style.background = C.bg}
          onMouseLeave={e => e.currentTarget.style.background = "white"}
        >
          <Icon size={16} />{label}
        </button>
      ))}
    </div>
  );
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, color, sub }) => (
  <div style={{ background: C.surface, borderRadius: 16, padding: 20, border: `1px solid ${color}25` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
      <div style={{ fontSize: 13, color, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
    </div>
    <div style={{ fontSize: 28, fontWeight: 700, color: C.textPrimary, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>{sub}</div>}
  </div>
);

// ── Customer History Panel ────────────────────────────────────────────────────
const CustomerHistoryPanel = ({ customerId, customerEmail }) => {
  const [customer, setCustomer] = useState(null);
  const [tasks,    setTasks]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    if (!customerId && !customerEmail) return;
    const loadData = async () => {
      setLoading(true);
      try {
        const customerRes = await fetch(`${BASE}/customer/${customerId}`);
        if (customerRes.ok) setCustomer(await customerRes.json());
        const tasksRes = await fetch(`${BASE}/tasks/user/${customerId}`);
        if (tasksRes.ok) { const d = await tasksRes.json(); setTasks(d.tasks || []); }
      } catch (err) { setError(err.message); }
      finally { setLoading(false); }
    };
    loadData();
  }, [customerId, customerEmail]);

  if (loading)   return <div style={{ padding: 40, textAlign: "center" }}>Loading customer history...</div>;
  if (error)     return <div style={{ padding: 40, textAlign: "center", color: C.red }}>Error: {error}</div>;
  if (!customer) return <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>No customer history available</div>;

  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const cancelledTasks = tasks.filter(t => t.status === "cancelled").length;
  const totalSpent     = tasks.reduce((sum, t) => sum + (t.totalCost || 0), 0);
  const fullName       = `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
  const initials       = fullName ? fullName.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase() : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: C.purpleLight, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, border: "2px solid white", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
            {customer.profile_picture
              ? <img src={customer.profile_picture} alt={fullName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : initials ? <span style={{ fontSize: 22, fontWeight: 700, color: C.purple }}>{initials}</span>
              : <User size={30} color={C.purple} />}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.textPrimary }}>{fullName || "—"}</h3>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}><TypeBadge type="customer" /><StatusBadge status={customer.status || "active"} /></div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {[["Email", customer.email, Mail], ["Phone", customer.phoneNo || "—", Phone], ["Address", customer.address || "—", MapPin], ["Member Since", fmt(customer.createdAt), CalendarIcon], ["Date of Birth", fmt(customer.date_of_birth), CalendarIcon], ["Gender", customer.gender || "—", User]].map(([label, value, Icon]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: C.bg, borderRadius: 10 }}>
              <Icon size={16} color={C.textMuted} />
              <div><div style={{ fontSize: 11, color: C.textMuted }}>{label}</div><div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{value || "—"}</div></div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[["Total Tasks", tasks.length, C.brand, ShoppingBag], ["Completed", completedTasks, C.green, CheckCircle], ["Cancelled", cancelledTasks, C.red, XCircle], ["Total Spent", `NPR ${totalSpent.toLocaleString()}`, C.purple, DollarSign]].map(([label, value, color, Icon]) => (
          <div key={label} style={{ background: C.surface, borderRadius: 12, padding: 14, textAlign: "center", border: `1px solid ${C.border}` }}>
            <Icon size={18} color={color} style={{ marginBottom: 6 }} />
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ background: C.surface, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}><History size={18} color={C.brand} /><h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.textPrimary }}>Task History ({tasks.length})</h4></div>
        {tasks.length === 0 ? <p style={{ textAlign: "center", color: C.textMuted, padding: 20 }}>No tasks found</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 400, overflowY: "auto" }}>
            {tasks.map((task, idx) => (
              <div key={idx} style={{ padding: 14, background: C.bg, borderRadius: 12, border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div><div style={{ fontWeight: 700, color: C.textPrimary }}>{task.taskName || "Untitled Task"}</div><div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>ID: {shortId(task._id)}</div></div>
                  <StatusBadge status={task.status} />
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                  {[["Date", task.serviceDate ? fmt(task.serviceDate) : "—"], ["Time", task.serviceTime || "—"], ["Amount", `NPR ${task.totalCost?.toLocaleString() || 0}`], ["Worker", task.assignedWorkerId ? shortId(task.assignedWorkerId) : "—"]].map(([label, val]) => (
                    <div key={label}><div style={{ fontSize: 10, color: C.textMuted }}>{label}</div><div style={{ fontSize: 12, fontWeight: 600, color: C.textSecond }}>{val}</div></div>
                  ))}
                </div>
                {task.cancelReason && <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.divider}`, fontSize: 11, color: C.red }}>Cancelled: {task.cancelReason}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Worker History Panel ──────────────────────────────────────────────────────
const WorkerHistoryPanel = ({ workerId, workerEmail }) => {
  const [worker,  setWorker]  = useState(null);
  const [tasks,   setTasks]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!workerId && !workerEmail) return;
    const loadData = async () => {
      setLoading(true);
      try {
        const workerRes = await apiCall(`${BASE}/worker/${workerId}`);
        if (workerRes.ok) setWorker(await workerRes.json());
        const tasksRes = await apiCall(`${BASE}/tasks/worker/${workerId}`);
        if (tasksRes.ok) { const d = await tasksRes.json(); setTasks(d.tasks || []); }
      } catch (err) { setError(err.message); }
      finally { setLoading(false); }
    };
    loadData();
  }, [workerId, workerEmail]);

  const getSkillName = (skill) => {
    if (!skill) return "";
    if (typeof skill === "string") return skill;
    if (typeof skill === "object") return skill.name || skill.skillName || JSON.stringify(skill);
    return String(skill);
  };

  if (loading)  return <div style={{ padding: 40, textAlign: "center" }}>Loading worker history...</div>;
  if (error)    return <div style={{ padding: 40, textAlign: "center", color: C.red }}>Error: {error}</div>;
  if (!worker)  return <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>No worker history available</div>;

  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const cancelledTasks = tasks.filter(t => t.status === "cancelled").length;
  const totalEarned    = tasks.reduce((sum, t) => sum + (t.totalCost || 0), 0);
  const fullName       = `${worker.firstName || ""} ${worker.lastName || ""}`.trim();
  const initials       = fullName ? fullName.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase() : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: C.blueLight, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, border: "2px solid white", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
            {worker.profilePhoto
              ? <img src={worker.profilePhoto} alt={fullName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : initials ? <span style={{ fontSize: 22, fontWeight: 700, color: C.blue }}>{initials}</span>
              : <Briefcase size={30} color={C.blue} />}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.textPrimary }}>{fullName || "—"}</h3>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}><TypeBadge type="worker" /><StatusBadge status={worker.status || "active"} /></div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {[["Email", worker.email, Mail], ["Phone", worker.phoneNo || worker.phone_no || "—", Phone], ["Task Type", worker.taskType || "—", Briefcase], ["Base Price", `NPR ${worker.basePrice?.toLocaleString() || 0}`, DollarSign], ["Rating", `⭐ ${worker.rating || worker.ratings || 0}`, Star], ["Completed Tasks", worker.noOfCompletedTask || 0, CheckCircle], ["Total Earnings", `NPR ${worker.total_earnings?.toLocaleString() || 0}`, DollarSign], ["Status", worker.status || "active", User]].map(([label, value, Icon]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: C.bg, borderRadius: 10 }}>
              <Icon size={16} color={C.textMuted} />
              <div><div style={{ fontSize: 11, color: C.textMuted }}>{label}</div><div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{value}</div></div>
            </div>
          ))}
        </div>
        {worker.skills?.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.divider}` }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>Skills</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {worker.skills.map((skill, idx) => <span key={idx} style={{ padding: "4px 10px", background: C.blueLight, color: C.blue, borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{getSkillName(skill)}</span>)}
            </div>
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[["Total Tasks", tasks.length, C.brand, ShoppingBag], ["Completed", completedTasks, C.green, CheckCircle], ["Cancelled", cancelledTasks, C.red, XCircle], ["Total Earned", `NPR ${totalEarned.toLocaleString()}`, C.green, DollarSign]].map(([label, value, color, Icon]) => (
          <div key={label} style={{ background: C.surface, borderRadius: 12, padding: 14, textAlign: "center", border: `1px solid ${C.border}` }}>
            <Icon size={18} color={color} style={{ marginBottom: 6 }} />
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ background: C.surface, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}><History size={18} color={C.brand} /><h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.textPrimary }}>Assigned Tasks ({tasks.length})</h4></div>
        {tasks.length === 0 ? <p style={{ textAlign: "center", color: C.textMuted, padding: 20 }}>No tasks assigned</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 400, overflowY: "auto" }}>
            {tasks.map((task, idx) => (
              <div key={idx} style={{ padding: 14, background: C.bg, borderRadius: 12, border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div><div style={{ fontWeight: 700, color: C.textPrimary }}>{task.taskName || "Untitled Task"}</div><div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>ID: {shortId(task._id)}</div></div>
                  <StatusBadge status={task.status} />
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                  {[["Date", task.serviceDate ? fmt(task.serviceDate) : "—"], ["Time", task.serviceTime || "—"], ["Amount", `NPR ${task.totalCost?.toLocaleString() || 0}`], ["Customer", task.userId ? shortId(task.userId) : "—"]].map(([label, val]) => (
                    <div key={label}><div style={{ fontSize: 10, color: C.textMuted }}>{label}</div><div style={{ fontSize: 12, fontWeight: 600, color: C.textSecond }}>{val}</div></div>
                  ))}
                </div>
                {task.payment_status && <div style={{ marginTop: 8, fontSize: 11, color: task.payment_status === "paid" ? C.green : C.brand }}>Payment: {task.payment_status} · Escrow: {task.escrow_status}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Task Timeline ─────────────────────────────────────────────────────────────
const TaskTimeline = ({ report }) => {
  const [task,    setTask]    = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!report.taskId) return;
    setLoading(true);
    apiCall(`${BASE}/task/${report.taskId}`)
      .then(r => r.ok ? r.json() : null)
      .then(t => setTask(t))
      .finally(() => setLoading(false));
  }, [report.taskId]);

  if (loading) return (
    <div style={{ background: C.surface, borderRadius: 16, padding: 18, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
      <RefreshCw size={14} style={{ animation: "spin 1s linear infinite", color: C.textMuted }} />
      <span style={{ fontSize: 13, color: C.textMuted }}>Loading timeline...</span>
    </div>
  );

  const events = [];

  // ── 1. Task created ──
  if (task?.createdAt) events.push({
    key: "created",
    color: C.blue,
    icon: <FileText size={8} color="white" />,
    label: "Task created",
    time: task.createdAt,
    meta: (
      <span>
        <strong>{task.taskName}</strong> · {task.taskType}
        {task.address && <> · {task.address}</>}
      </span>
    ),
  });

  // ── 2. Payment received ──
  if (task?.payment_status === "paid" && task?.confirmedAt) events.push({
    key: "paid",
    color: C.green,
    icon: <CreditCard size={8} color="white" />,
    label: "Payment received",
    time: task.confirmedAt,
    meta: (
      <span>
        NPR {task.totalCost?.toLocaleString()} via{" "}
        <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: C.greenLight, color: C.green }}>
          {(task.payment_method || "—").toUpperCase()}
        </span>
        {" · "}Base NPR {task.basePrice?.toLocaleString()}
        {task.additionalCost > 0 && <> + NPR {task.additionalCost?.toLocaleString()} additional</>}
        {" · "}Platform fee NPR {(task.platformFee || task.platform_fee)?.toLocaleString()}
        {" · "}Escrow held
      </span>
    ),
  });

  // ── 3. Worker assigned ──
  if (task?.assignedWorkerId && task?.offerStatus === "accepted") events.push({
    key: "assigned",
    color: C.purple,
    icon: <Briefcase size={8} color="white" />,
    label: "Worker assigned",
    time: task.confirmedAt,
    meta: (
      <span>
        Worker accepted offer · Scheduled {fmt(task.serviceDate)} at {task.serviceTime || "—"}
        {task.estimatedHours && <> · Est. {task.estimatedHours} hr{task.estimatedHours !== 1 ? "s" : ""}</>}
      </span>
    ),
  });

  // ── 4. Work started ──
  if (task?.startedAt) events.push({
    key: "started",
    color: C.brand,
    icon: <Zap size={8} color="white" />,
    label: "Work started",
    time: task.startedAt,
    meta: <span>Worker began the job on-site</span>,
  });

  // ── 5. Task completed ──
  if (task?.completedAt && task?.status === "completed") {
    const durationMs  = task.startedAt ? new Date(task.completedAt) - new Date(task.startedAt) : null;
    const durationMin = durationMs ? Math.round(durationMs / 60000) : null;
    events.push({
      key: "completed",
      color: C.green,
      icon: <Check size={8} color="white" />,
      label: "Task completed",
      time: task.completedAt,
      meta: (
        <span>
          Marked complete
          {durationMin != null && <> · Duration: {durationMin < 60 ? `${durationMin} min` : `${(durationMin / 60).toFixed(1)} hrs`}</>}
          {task.actualHours != null && <> · Actual hours logged: {task.actualHours}</>}
        </span>
      ),
    });
  }

  // ── 6. Escrow released ──
  if (task?.released_at && task?.escrow_status === "released") events.push({
    key: "payout",
    color: "#2E9E8E",
    icon: <DollarSign size={8} color="white" />,
    label: "Escrow released",
    time: task.released_at,
    meta: (
      <span>
        Worker payout NPR {task.worker_payout?.toLocaleString()}
        {" · "}Platform kept NPR {task.platform_fee?.toLocaleString()}
        {" · "}
        <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: C.greenLight, color: C.green }}>
          {task.payout_status}
        </span>
      </span>
    ),
  });

  // ── 7. Task cancelled ──
  if (task?.status === "cancelled") events.push({
    key: "cancelled",
    color: C.red,
    icon: <X size={8} color="white" />,
    label: "Task cancelled",
    time: task.cancelledAt || task.updatedAt,
    meta: task.cancelReason ? <span>Reason: {task.cancelReason}</span> : <span>Cancelled</span>,
  });

  // ── 8. Report filed — smart timing note ──
  const reportTimingNote = (() => {
    if (!report.createdAt) return null;
    const rep = new Date(report.createdAt);

    // Priority 1: relative to task completion
    if (task?.completedAt && task.status === "completed") {
      const comp = new Date(task.completedAt);
      const hrs = (rep - comp) / (1000 * 60 * 60);
      if (hrs < 0) return `filed ${Math.abs(hrs).toFixed(1)} hrs before task completed`;
      if (hrs < 1) return `filed ${(hrs * 60).toFixed(0)} min after task was completed`;
      return `filed ${hrs.toFixed(1)} hrs after task was completed`;
    }

    // Priority 2: relative to work start
    if (task?.startedAt) {
      const started = new Date(task.startedAt);
      const hrs = (rep - started) / (1000 * 60 * 60);
      if (hrs < 0) return `filed ${Math.abs(hrs).toFixed(1)} hrs before work began`;
      if (hrs < 1) return `filed ${(hrs * 60).toFixed(0)} min after work began`;
      return `filed ${hrs.toFixed(1)} hrs after work began`;
    }

    // Priority 3: relative to cancellation
    if (task?.status === "cancelled" && (task?.cancelledAt || task?.updatedAt)) {
      const cancelled = new Date(task.cancelledAt || task.updatedAt);
      const hrs = (rep - cancelled) / (1000 * 60 * 60);
      if (hrs >= 0) {
        if (hrs < 1) return `filed ${(hrs * 60).toFixed(0)} min after task was cancelled`;
        return `filed ${hrs.toFixed(1)} hrs after task was cancelled`;
      }
    }

    // Priority 4: relative to scheduled service time
    if (!task?.serviceDate) return null;
    const svc = new Date(`${new Date(task.serviceDate).toISOString().split("T")[0]}T${task.serviceTime || "00:00"}`);
    const hrs = (rep - svc) / (1000 * 60 * 60);
    if (hrs < -0.1) return `filed ${Math.abs(hrs).toFixed(1)} hrs before scheduled service`;
    if (hrs < 1)    return `filed ${(hrs * 60).toFixed(0)} min after scheduled service time`;
    return `filed ${hrs.toFixed(1)} hrs after scheduled service`;
  })();

  if (report.createdAt) events.push({
    key: "report",
    color: C.brand,
    icon: <Flag size={8} color="white" />,
    label: "Report filed",
    time: report.createdAt,
    meta: (
      <span>
        Reason:{" "}
        <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: C.brandLight, color: C.brandHover }}>
          {report.reason}
        </span>
        {reportTimingNote && <> · {reportTimingNote}</>}
      </span>
    ),
  });

  // ── 9. Resolution ──
  if (report.status === "resolved" && report.resolvedAt) events.push({
    key: "resolved",
    color: C.green,
    icon: <CheckCircle size={8} color="white" />,
    label: "Report resolved",
    time: report.resolvedAt,
    meta: report.adminNote ? <span>Admin note: {report.adminNote}</span> : <span>Approved by admin</span>,
  });

  if (report.status === "declined" && report.resolvedAt) events.push({
    key: "declined",
    color: C.red,
    icon: <XCircle size={8} color="white" />,
    label: "Report declined",
    time: report.resolvedAt,
    meta: report.adminNote ? <span>Note: {report.adminNote}</span> : <span>Declined by admin</span>,
  });

  // ── 10. Pending tail ──
  if (report.status === "pending") events.push({
    key: "pending",
    color: C.textMuted,
    icon: <Clock size={8} color="white" />,
    label: "Awaiting admin review",
    time: null,
    meta: <span>Report under review · Escrow: {task?.escrow_status || "—"}</span>,
  });

  // Sort chronologically, null-time last
  events.sort((a, b) => {
    if (!a.time) return 1;
    if (!b.time) return -1;
    return new Date(a.time) - new Date(b.time);
  });

  if (events.length === 0) return null;

  return (
    <div style={{ background: C.surface, borderRadius: 16, padding: 18, border: `1px solid ${C.border}` }}>
      {/* Header */}
      <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
        <Clock size={13} color={C.textMuted} /> Task timeline
      </div>

      {/* Summary chips */}
      {task && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${C.divider}` }}>
          {[
            ["Total",        `NPR ${task.totalCost?.toLocaleString()}`,                               C.green    ],
            ["Base",         `NPR ${task.basePrice?.toLocaleString()}`,                               C.blue     ],
            ...(task.additionalCost > 0 ? [["Extra", `NPR ${task.additionalCost?.toLocaleString()}`, C.purple]] : []),
            ["Platform fee", `NPR ${(task.platform_fee || task.platformFee)?.toLocaleString()}`,      C.textMuted],
            ...(task.worker_payout ? [["Worker gets", `NPR ${task.worker_payout?.toLocaleString()}`,  "#2E9E8E"]] : []),
          ].map(([label, value, color]) => (
            <div key={label} style={{ padding: "6px 12px", borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 1 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Timeline track */}
      <div style={{ position: "relative", paddingLeft: 28 }}>
        <div style={{ position: "absolute", left: 9, top: 8, bottom: 8, width: 1.5, background: C.border }} />
        {events.map((ev, idx) => (
          <div key={ev.key} style={{ position: "relative", marginBottom: idx < events.length - 1 ? 20 : 0 }}>
            <div style={{ position: "absolute", left: -23, top: 3, width: 16, height: 16, borderRadius: "50%", background: ev.color, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.surface}`, zIndex: 1 }}>
              {ev.icon}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{ev.label}</span>
              {ev.time && <span style={{ fontSize: 11, color: C.textMuted }}>{fmt(ev.time)} · {fmtTime(ev.time)}</span>}
            </div>
            <div style={{ fontSize: 12, color: C.textSecond, lineHeight: 1.6 }}>{ev.meta}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Task History Panel ────────────────────────────────────────────────────────
const TaskHistoryPanel = ({ taskId }) => {
  const [task,    setTask]    = useState(null);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!taskId) return;
    const loadTask = async () => {
      setLoading(true);
      try {
        const [taskRes, paymentRes] = await Promise.all([
          apiCall(`${BASE}/task/${taskId}`),
          apiCall(`http://127.0.0.1:8000/payments/task/${taskId}`),
        ]);
        if (taskRes.ok) setTask(await taskRes.json());
        else setError("Failed to load task details");
        if (paymentRes.ok) { const pd = await paymentRes.json(); setPayment(pd.payments?.[0] || null); }
      } catch (err) { setError(err.message); }
      finally { setLoading(false); }
    };
    loadTask();
  }, [taskId]);

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>Loading task details...</div>;
  if (error)   return <div style={{ padding: 40, textAlign: "center", color: C.red }}>Error: {error}</div>;
  if (!task)   return <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>No task details available</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.textPrimary }}>{task.taskName || "Task Details"}</h3>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>ID: {shortId(task._id)}</div>
          </div>
          <StatusBadge status={task.status} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {[
            ["Task Type",      task.taskType        || "—", Briefcase  ],
            ["Service",        task.selectedService || "—", Award      ],
            ["Description",    task.taskDescrip     || "—", FileText   ],
            ["Address",        task.address         || "—", MapPin     ],
            ["Scheduled Date", task.serviceDate ? fmt(task.serviceDate) : "—", CalendarIcon],
            ["Scheduled Time", task.serviceTime     || "—", Clock      ],
            ["Customer",       task.userId           ? shortId(task.userId)           : "—", User     ],
            ["Worker",         task.assignedWorkerId ? shortId(task.assignedWorkerId) : "—", Briefcase],
          ].map(([label, value, Icon]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: C.bg, borderRadius: 10 }}>
              <Icon size={16} color={C.textMuted} />
              <div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          ["Base Price",      `NPR ${task.basePrice?.toLocaleString()      || 0}`, C.brand ],
          ["Additional Cost", `NPR ${task.additionalCost?.toLocaleString() || 0}`, C.purple],
          ["Total Cost",      `NPR ${task.totalCost?.toLocaleString()      || 0}`, C.green ],
        ].map(([label, value, color]) => (
          <div key={label} style={{ background: C.surface, borderRadius: 12, padding: 14, textAlign: "center", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>
      {payment ? (
        <div style={{ background: C.surface, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <CreditCard size={18} color={C.brand} />
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.textPrimary }}>Payment Details</h4>
            <span style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: payment.status === "success" ? C.greenLight : C.redLight, color: payment.status === "success" ? C.green : C.red, border: `1px solid ${payment.status === "success" ? C.green : C.red}30`, textTransform: "capitalize" }}>
              {payment.status}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {[
              ["Method",           payment.method?.toUpperCase()],
              ["Amount",           `NPR ${payment.amount?.toLocaleString()}`],
              ["Direction",        payment.direction],
              ["Type",             payment.type?.replace(/_/g, " ")],
              ["Transaction UUID", payment.transaction_uuid || "—"],
              ["Gateway Ref",      payment.gateway_ref      || "—"],
              ["Payment ID",       payment.payment_id ? `#${payment.payment_id.slice(-6).toUpperCase()}` : "—"],
              ["Paid At", payment.created_at ? toKTM(payment.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kathmandu" }) : "—"],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: "10px 12px", background: C.bg, borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, wordBreak: "break-all" }}>{value || "—"}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ background: C.surface, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <CreditCard size={18} color={C.textMuted} />
          <span style={{ fontSize: 13, color: C.textMuted }}>No payment found for this task</span>
        </div>
      )}
    </div>
  );
};

// ── AI Analysis Panel ─────────────────────────────────────────────────────────
const AIAnalysisPanel = ({ report }) => {
  const [aiResult,        setAiResult]        = useState(null);
  const [refundCalc,      setRefundCalc]      = useState(null);
  const [taskData,        setTaskData]        = useState(null);
  const [context,         setContext]         = useState(null);
  const [loading,         setLoading]         = useState(false);
  const [historyLoading,  setHistoryLoading]  = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [showHistory,     setShowHistory]     = useState(false);
  const [apiError,        setApiError]        = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const token = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
        const res = await fetch(`${BASE}/reports/${report.id}/ai-review/history`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (res.ok) {
          const data = await res.json();
          if (data.reviews?.length) {
            setAnalysisHistory(data.reviews);
            const latest = data.reviews[0];
            setAiResult(latest.ai_result);
            setRefundCalc(latest.refund_calc ?? null);
            setTaskData(latest.context?.task ?? null);
            setContext(latest.context ?? null);
          }
        }
      } catch {}
      finally { setHistoryLoading(false); }
    };
    fetchHistory();
  }, [report.id]);

  const refreshHistory = async () => {
    try {
      const token = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
      const res = await fetch(`${BASE}/reports/${report.id}/ai-review/history`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (res.ok) { const data = await res.json(); if (data.reviews?.length) setAnalysisHistory(data.reviews); }
    } catch {}
  };

  async function runAnalysis() {
    setLoading(true); setAiResult(null); setRefundCalc(null); setTaskData(null); setContext(null); setApiError(null); setShowHistory(false);
    try {
      const token = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
      const response = await fetch(`${BASE}/reports/${report.id}/ai-review`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      const data = await response.json();
      setAiResult(data.aiResult ?? data.analysis ?? data.data ?? data);
      setRefundCalc(data.refundCalc ?? null);
      setTaskData(data.task ?? null);
      setContext(data.context ?? null);
      await refreshHistory();
    } catch (err) { setApiError(err.message); setAiResult({ error: `AI analysis failed: ${err.message}` }); }
    finally { setLoading(false); }
  }

  const getSeverityConfig = (s) => { const l = s?.toLowerCase?.() || "medium"; if (l.includes("critical")) return SEV_CONFIG.Critical; if (l.includes("high")) return SEV_CONFIG.High; if (l.includes("medium")) return SEV_CONFIG.Medium; return SEV_CONFIG.Low; };
  const getActionColor    = (a) => { if (!a) return ACTION_COLORS["Dismiss report"]; const l = a.toLowerCase(); if (l.includes("warn")) return ACTION_COLORS["Warn user"]; if (l.includes("suspend")) return ACTION_COLORS["Suspend account"]; if (l.includes("permanent") || l.includes("ban")) return ACTION_COLORS["Permanent ban"]; return ACTION_COLORS["Dismiss report"]; };
  const getCredColor      = (c) => { if (!c) return CRED_COLORS.Medium; const l = c.toLowerCase(); if (l.includes("high")) return CRED_COLORS.High; if (l.includes("medium")) return CRED_COLORS.Medium; return CRED_COLORS.Low; };

  const sev  = aiResult?.severity            ? getSeverityConfig(aiResult.severity)       : null;
  const act  = aiResult?.suggestedAction     ? getActionColor(aiResult.suggestedAction)   : null;
  const cred = aiResult?.reporterCredibility ? getCredColor(aiResult.reporterCredibility) : null;

  const Shimmer   = ({ w = "100%", h = 13 }) => <div style={{ width: w, height: h, borderRadius: 6, background: "linear-gradient(90deg,#EDE8DF 25%,#F7F5EF 50%,#EDE8DF 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />;
  const MiniLabel = ({ children }) => <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{children}</div>;

  const getRefundTypeConfig = (type) => {
    const configs = {
      full:             { label: "Full Refund",            color: C.green,    bg: C.greenLight,  icon: "✅", description: "Customer receives 100% refund"            },
      partial:          { label: "Partial Refund (75%)",   color: C.brand,    bg: C.brandLight,  icon: "⚖️", description: "Customer gets 75%, worker penalized 25%"   },
      manual:           { label: "Manual Review Required", color: C.purple,   bg: C.purpleLight, icon: "🔍", description: "Admin review needed"                       },
      blocked:          { label: "Refund Blocked",         color: C.red,      bg: C.redLight,    icon: "🚫", description: "Escrow released - refund not possible"     },
      already_refunded: { label: "Already Refunded",       color: C.green,    bg: C.greenLight,  icon: "✓",  description: "Refund already processed"                  },
      none:             { label: "No Refund",              color: C.textMuted,bg: C.bg,          icon: "—",  description: "No refund applicable"                      },
      error:            { label: "Calculation Error",      color: C.red,      bg: C.redLight,    icon: "⚠️", description: "Error in refund calculation"               },
    };
    return configs[type] || configs.none;
  };

  const refundTypeConfig = refundCalc ? getRefundTypeConfig(refundCalc.refund_type) : null;
  const sevColor = (s) => { if (!s) return C.textMuted; const l = s.toLowerCase(); if (l.includes("high") || l.includes("critical")) return C.red; if (l.includes("medium")) return C.brand; return C.green; };

  return (
    <div style={{ background: C.surface, borderRadius: 16, border: `1px solid #C4A8E840`, overflow: "hidden" }}>
      <div style={{ background: "#f6c263", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "white" }}>AI Deep Analysis</div>
        <div style={{ display: "flex", gap: 8 }}>
          {(analysisHistory.length > 0 || historyLoading) && (
            <button onClick={() => setShowHistory(v => !v)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: showHistory ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.2)", color: "white", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
              {historyLoading ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Loading...</> : <><Clock size={14} /> History ({analysisHistory.length})</>}
            </button>
          )}
          <button onClick={runAnalysis} disabled={loading} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: loading ? "rgba(255,255,255,0.3)" : "white", color: loading ? "white" : "#9B7FD4", fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
            {loading ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Analyzing…</> : aiResult && !aiResult.error ? <><RefreshCw size={14} /> Re-analyze</> : <><Zap size={14} /> Run Deep Analysis</>}
          </button>
        </div>
      </div>

      {!aiResult && !loading && !apiError && !historyLoading && (
        <div style={{ padding: "48px 20px", textAlign: "center" }}>
          <Brain size={48} style={{ color: "#9B7FD4", opacity: 0.3, marginBottom: 16 }} />
          <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: C.textPrimary }}>AI-Powered Analysis</h3>
          <p style={{ margin: "0 auto", fontSize: 14, color: C.textMuted, lineHeight: 1.6, maxWidth: 400 }}>Click "Run Deep Analysis" to get comprehensive insights, refund calculation, credibility assessment, and recommended actions.</p>
        </div>
      )}
      {historyLoading && !aiResult && (
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          <Shimmer w="60%" h={14} /><Shimmer w="100%" h={20} /><Shimmer w="90%" h={16} /><Shimmer w="95%" h={16} />
        </div>
      )}
      {loading && (
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          <Shimmer w="100%" h={20} /><Shimmer w="90%" h={16} /><Shimmer w="95%" h={16} />
        </div>
      )}
      {apiError && (
        <div style={{ margin: 16, padding: "12px 16px", background: C.redLight, border: `1px solid ${C.red}30`, borderRadius: 8, fontSize: 13, color: C.red }}>
          <strong>Error:</strong> {apiError}
        </div>
      )}
      {aiResult && !aiResult.error && (
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {showHistory && analysisHistory.length > 0 && (
            <div style={{ background: C.bg, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><History size={14} /> Analysis History ({analysisHistory.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 240, overflowY: "auto" }}>
                {analysisHistory.map((entry, idx) => (
                  <button key={entry.id || idx} onClick={() => { setAiResult(entry.ai_result); setRefundCalc(entry.refund_calc ?? null); setTaskData(entry.context?.task ?? null); setContext(entry.context ?? null); setShowHistory(false); }}
                    style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    onMouseEnter={e => e.currentTarget.style.background = C.bg} onMouseLeave={e => e.currentTarget.style.background = C.surface}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{idx === 0 ? "Latest" : `Run #${analysisHistory.length - idx}`}</span>
                        {entry.ai_result?.severity && <span style={{ fontSize: 11, fontWeight: 700, color: sevColor(entry.ai_result.severity), background: `${sevColor(entry.ai_result.severity)}18`, padding: "2px 8px", borderRadius: 20 }}>{entry.ai_result.severity}</span>}
                        {entry.ai_result?.refundRecommendation && <span style={{ fontSize: 11, color: C.textMuted, background: C.bg, padding: "2px 8px", borderRadius: 20 }}>{entry.ai_result.refundRecommendation}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>{entry.created_at ? toKTM(entry.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kathmandu" }) : "—"}</div>
                      {entry.ai_result?.summary && <div style={{ fontSize: 11, color: C.textSecond, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 380 }}>{entry.ai_result.summary}</div>}
                    </div>
                    <ChevronRight size={14} color={C.textMuted} style={{ flexShrink: 0, marginLeft: 8 }} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {refundCalc && (
            <div style={{ background: refundTypeConfig.bg, borderRadius: 14, padding: 18, border: `2px solid ${refundTypeConfig.color}40` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 22 }}>{refundTypeConfig.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: refundTypeConfig.color, textTransform: "uppercase", letterSpacing: "0.6px" }}>Policy-Based Refund Calculation</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{refundCalc.note}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
                <div style={{ background: "white", borderRadius: 10, padding: 14, border: `1px solid ${refundTypeConfig.color}20` }}>
                  <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4, fontWeight: 600 }}>REFUND TYPE</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: refundTypeConfig.color }}>{refundTypeConfig.label}</div>
                  <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{refundTypeConfig.description}</div>
                </div>
                <div style={{ background: "white", borderRadius: 10, padding: 14, border: `1px solid ${C.green}20` }}>
                  <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4, fontWeight: 600 }}>CUSTOMER GETS</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: C.green }}>NPR {refundCalc.refund_amount?.toLocaleString() || 0}</div>
                  {taskData?.totalCost && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{((refundCalc.refund_amount / (taskData.totalCost || 1)) * 100).toFixed(0)}% of total</div>}
                </div>
                <div style={{ background: "white", borderRadius: 10, padding: 14, border: `1px solid ${C.red}20` }}>
                  <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4, fontWeight: 600 }}>WORKER PENALTY</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: C.red }}>NPR {refundCalc.penalty_amount?.toLocaleString() || 0}</div>
                  {taskData?.totalCost && refundCalc.penalty_amount > 0 && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{((refundCalc.penalty_amount / (taskData.totalCost || 1)) * 100).toFixed(0)}% of total</div>}
                </div>
              </div>
              {taskData && (
                <div style={{ padding: "12px 14px", background: "white", borderRadius: 8, fontSize: 11, color: C.textSecond, display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <div><span style={{ fontWeight: 600 }}>Task Total:</span> NPR {(taskData.totalCost || taskData.basePrice || 0).toLocaleString()}</div>
                  <div><span style={{ fontWeight: 600 }}>Status:</span> {taskData.status}</div>
                  <div><span style={{ fontWeight: 600 }}>Escrow:</span> {taskData.escrow_status || "—"}</div>
                  {taskData.payment_status && <div><span style={{ fontWeight: 600 }}>Payment:</span> {taskData.payment_status}</div>}
                </div>
              )}
            </div>
          )}
          {aiResult.summary && (
            <div style={{ background: "#9B7FD412", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#9B7FD4", marginBottom: 8 }}>AI Summary</div>
              <p style={{ margin: 0, fontSize: 14, color: C.textSecond, lineHeight: 1.6 }}>{aiResult.summary}</p>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {aiResult.severity && (
              <div style={{ background: sev?.bg || "#9B7FD412", borderRadius: 12, padding: 16 }}>
                <MiniLabel>Severity Level</MiniLabel>
                <span style={{ fontSize: 18, fontWeight: 800, color: sev?.color }}>{aiResult.severity}</span>
                {aiResult.severityReason && <p style={{ margin: "8px 0 0", fontSize: 12, color: C.textSecond, lineHeight: 1.5 }}>{aiResult.severityReason}</p>}
              </div>
            )}
            {aiResult.suggestedAction && (
              <div style={{ background: act?.bg || "#9B7FD412", borderRadius: 12, padding: 16 }}>
                <MiniLabel>Suggested Action</MiniLabel>
                <span style={{ fontSize: 14, fontWeight: 700, color: act?.color, lineHeight: 1.5, display: "block" }}>{aiResult.suggestedAction}</span>
                {aiResult.actionReason && <p style={{ margin: "8px 0 0", fontSize: 12, color: C.textSecond, lineHeight: 1.5 }}>{aiResult.actionReason}</p>}
              </div>
            )}
          </div>
          {aiResult.accountActions && (
            <div style={{ background: C.bg, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><Shield size={14} /> Account Actions</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {aiResult.accountActions.reportedUser && (
                  <div style={{ background: C.surface, borderRadius: 10, padding: 14, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Reported User</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      {(() => { const a = aiResult.accountActions.reportedUser.action?.toLowerCase() || ""; const color = a.includes("ban") ? "#B02020" : a.includes("suspend") ? C.red : a.includes("warn") ? "#C9A83D" : C.green; const Icon = a.includes("ban") ? XCircle : a.includes("suspend") ? Ban : a.includes("warn") ? AlertCircle : Check; return <><Icon size={16} color={color} /><span style={{ fontSize: 14, fontWeight: 700, color, textTransform: "capitalize" }}>{aiResult.accountActions.reportedUser.action || "No action"}</span></>; })()}
                    </div>
                    {aiResult.accountActions.reportedUser.duration && <div style={{ fontSize: 11, color: C.brand, fontWeight: 600, marginBottom: 4 }}>Duration: {aiResult.accountActions.reportedUser.duration}</div>}
                    {aiResult.accountActions.reportedUser.reason  && <div style={{ fontSize: 11, color: C.textSecond, lineHeight: 1.5 }}>{aiResult.accountActions.reportedUser.reason}</div>}
                  </div>
                )}
                {aiResult.accountActions.reporter && (
                  <div style={{ background: C.surface, borderRadius: 10, padding: 14, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Reporter</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      {(() => { const a = aiResult.accountActions.reporter.action?.toLowerCase() || ""; const color = a.includes("ban") ? "#B02020" : a.includes("suspend") ? C.red : a.includes("warn") ? "#C9A83D" : C.green; const Icon = a.includes("ban") ? XCircle : a.includes("suspend") ? Ban : a.includes("warn") ? AlertCircle : Check; return <><Icon size={16} color={color} /><span style={{ fontSize: 14, fontWeight: 700, color, textTransform: "capitalize" }}>{aiResult.accountActions.reporter.action || "No action"}</span></>; })()}
                    </div>
                    {aiResult.accountActions.reporter.reason && <div style={{ fontSize: 11, color: C.textSecond, lineHeight: 1.5 }}>{aiResult.accountActions.reporter.reason}</div>}
                  </div>
                )}
              </div>
            </div>
          )}
          {aiResult.refundRecommendation && (
            <div style={{ background: "#2E9E8E15", borderRadius: 12, padding: 16, border: "1px solid #2E9E8E30" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Percent size={16} color="#2E9E8E" />
                <div style={{ fontSize: 12, fontWeight: 700, color: "#2E9E8E", textTransform: "uppercase", letterSpacing: "0.5px" }}>AI Refund Recommendation</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
                <div><div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>AI Recommendation</div><div style={{ fontSize: 15, fontWeight: 700, color: "#2E9E8E", textTransform: "capitalize" }}>{aiResult.refundRecommendation}</div></div>
                <div><div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>Recommended Amount</div><div style={{ fontSize: 15, fontWeight: 700, color: C.green }}>NPR {parseFloat(aiResult.refundAmount || 0).toLocaleString()}</div></div>
              </div>
              {aiResult.refundReason && <p style={{ margin: 0, fontSize: 12, color: C.textSecond, lineHeight: 1.5, paddingTop: 10, borderTop: "1px solid #2E9E8E20" }}><strong>Reasoning:</strong> {aiResult.refundReason}</p>}
              {refundCalc && String(aiResult.refundAmount) !== String(refundCalc.refund_amount) && <div style={{ marginTop: 10, padding: "8px 10px", background: "#FFF4E6", borderRadius: 6, fontSize: 11, color: C.brand }}><strong>Note:</strong> AI recommendation differs from policy calculation (NPR {refundCalc.refund_amount?.toLocaleString()}). Review both before deciding.</div>}
            </div>
          )}
          {aiResult.reporterCredibility && (
            <div style={{ background: cred?.bg || "#9B7FD412", borderRadius: 12, padding: 16 }}>
              <MiniLabel>Reporter Credibility</MiniLabel>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                {cred?.icon && React.createElement(cred.icon, { size: 18, color: cred.color })}
                <span style={{ fontSize: 16, fontWeight: 700, color: cred?.color }}>{aiResult.reporterCredibility}</span>
              </div>
              {aiResult.credibilityNote && <p style={{ margin: 0, fontSize: 12, color: C.textSecond, lineHeight: 1.5 }}>{aiResult.credibilityNote}</p>}
            </div>
          )}
          {aiResult.keyEvidence && (
            <div style={{ background: C.bg, borderRadius: 12, padding: 16 }}>
              <MiniLabel>Key Evidence</MiniLabel>
              <p style={{ margin: 0, fontSize: 13, color: C.textSecond, lineHeight: 1.6, whiteSpace: "pre-line" }}>{aiResult.keyEvidence}</p>
            </div>
          )}
          {aiResult.redFlags && aiResult.redFlags.length > 0 && (
            <div style={{ background: C.redLight, borderRadius: 12, padding: 16, border: `1px solid ${C.red}30` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><AlertTriangle size={16} color={C.red} /><MiniLabel>Red Flags ({aiResult.redFlags.length})</MiniLabel></div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: C.red, lineHeight: 1.8 }}>
                {aiResult.redFlags.map((flag, idx) => <li key={idx}>{flag}</li>)}
              </ul>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {aiResult.chatInsight && (
              <div style={{ background: C.bg, borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><MessageCircle size={14} color={C.textMuted} /><MiniLabel>Chat Insight</MiniLabel></div>
                <p style={{ margin: 0, fontSize: 12, color: C.textSecond, lineHeight: 1.6 }}>{aiResult.chatInsight}</p>
              </div>
            )}
            {aiResult.profileInsight && (
              <div style={{ background: C.bg, borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><User size={14} color={C.textMuted} /><MiniLabel>Profile Insight</MiniLabel></div>
                <p style={{ margin: 0, fontSize: 12, color: C.textSecond, lineHeight: 1.6 }}>{aiResult.profileInsight}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Action Modal ──────────────────────────────────────────────────────────────
const ActionModal = ({ report, refundId, onClose, onSuccess, onShowToast }) => {
  const [selectedAction, setSelectedAction] = useState("");
  const [duration,       setDuration]       = useState(7);
  const [message,        setMessage]        = useState("");
  const [sending,        setSending]        = useState(false);
  const [pastActions,    setPastActions]    = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoadingHistory(true);
      try {
        let res = await apiCall(`${BASE}/refunds?report_id=${report.id}&limit=1`);
        if (res.ok) { const d = await res.json(); const doc = d.refunds?.[0]; if (doc?.admin_actions?.length) { setPastActions(doc.admin_actions); setLoadingHistory(false); return; } }
        if (report.taskId) { res = await apiCall(`${BASE}/refunds?task_id=${report.taskId}&limit=1`); if (res.ok) { const d = await res.json(); setPastActions(d.refunds?.[0]?.admin_actions || []); } }
      } catch {}
      finally { setLoadingHistory(false); }
    };
    load();
  }, [report.id, report.taskId]);

  const actions = [
    { id: "warn_customer",    label: "Warn Customer",    color: C.brand, icon: AlertTriangle },
    { id: "warn_worker",      label: "Warn Worker",      color: C.brand, icon: AlertTriangle },
    { id: "suspend_customer", label: "Suspend Customer", color: C.red,   icon: Ban           },
    { id: "suspend_worker",   label: "Suspend Worker",   color: C.red,   icon: Ban           },
  ];
  const ACTION_LABEL = { warn_customer: "Customer Warned", warn_worker: "Worker Warned", suspend_customer: "Customer Suspended", suspend_worker: "Worker Suspended" };
  const ACTION_COLOR = { warn_customer: C.brand, warn_worker: C.brand, suspend_customer: C.red, suspend_worker: C.red };

  const handleSend = async () => {
    if (!selectedAction) { onShowToast("Please select an action", "error"); return; }
    setSending(true);
    try {
      const res = await apiCall(`${BASE}/refunds/${refundId}/action`, { method: "PATCH", body: JSON.stringify({ action: selectedAction, duration_days: selectedAction.includes("suspend") ? duration : null, message: message || null }) });
      if (res.ok) {
        const data = await res.json();
        setPastActions(prev => [...prev, { action: selectedAction, duration_days: selectedAction.includes("suspend") ? duration : null, message, applied_at: new Date().toISOString() }]);
        onShowToast(`✓ ${data.message}`, "success");
        onSuccess(); onClose();
      } else { const err = await res.json().catch(() => null); onShowToast(err?.detail || "Action failed", "error"); }
    } catch (err) { onShowToast(`Error: ${err.message}`, "error"); }
    finally { setSending(false); }
  };

  const selectedConfig = actions.find(a => a.id === selectedAction);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100001, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: C.surface, borderRadius: 24, padding: 28, width: 540, maxWidth: "90%", boxShadow: "0 25px 50px rgba(0,0,0,0.3)", animation: "scaleIn 0.2s ease", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.brandLight, display: "flex", alignItems: "center", justifyContent: "center" }}><Send size={18} color={C.brand} /></div>
            <div><h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.textPrimary }}>Take Action</h3><div style={{ fontSize: 11, color: C.textMuted }}>Send warning or suspend account</div></div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={20} color={C.textMuted} /></button>
        </div>
        {!loadingHistory && pastActions.length > 0 && (
          <div style={{ marginBottom: 20, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", background: C.bg, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 6 }}>
              <History size={14} color={C.textMuted} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Actions Already Taken ({pastActions.length})</span>
            </div>
            {pastActions.map((a, idx) => (
              <div key={idx} style={{ padding: "12px 14px", borderBottom: idx < pastActions.length - 1 ? `1px solid ${C.divider}` : "none", display: "flex", alignItems: "flex-start", gap: 10, background: C.surface }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: ACTION_COLOR[a.action] || C.textSecond, marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: ACTION_COLOR[a.action] || C.textSecond }}>{ACTION_LABEL[a.action] || a.action}</span>
                    <span style={{ fontSize: 11, color: C.textMuted }}>{a.applied_at ? toKTM(a.applied_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kathmandu" }) : "—"}</span>
                  </div>
                  {a.duration_days && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Duration: {a.duration_days} day(s)</div>}
                  {a.message && <div style={{ fontSize: 12, color: C.textSecond, marginTop: 3, fontStyle: "italic" }}>"{a.message}"</div>}
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 10 }}>Select Action</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {actions.map(action => {
              const alreadyDone = pastActions.some(p => p.action === action.id);
              return (
                <button key={action.id} onClick={() => setSelectedAction(action.id)}
                  style={{ padding: "12px 16px", borderRadius: 12, border: `2px solid ${selectedAction === action.id ? action.color : alreadyDone ? `${action.color}50` : C.border}`, background: selectedAction === action.id ? `${action.color}15` : C.surface, color: selectedAction === action.id ? action.color : alreadyDone ? `${action.color}99` : C.textSecond, fontWeight: selectedAction === action.id ? 700 : 500, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", position: "relative" }}>
                  <action.icon size={16} />{action.label}
                  {alreadyDone && <span style={{ position: "absolute", top: -7, right: -7, background: action.color, color: "white", fontSize: 9, fontWeight: 700, borderRadius: 20, padding: "2px 6px" }}>DONE</span>}
                </button>
              );
            })}
          </div>
        </div>
        {selectedAction.includes("suspend") && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>Suspension Duration (days)</label>
            <input type="number" min="1" max="365" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 1)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
        )}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>Message to User (optional)</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Additional notes or explanation..." rows={3} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", fontSize: 14, color: C.textSecond, fontFamily: "inherit" }}>Cancel</button>
          <button onClick={handleSend} disabled={sending || !selectedAction} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: !selectedAction || sending ? C.textMuted : (selectedConfig?.color || C.brand), color: "white", fontWeight: 600, fontSize: 14, cursor: !selectedAction || sending ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {sending ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Sending...</> : <><Send size={14} /> {pastActions.some(p => p.action === selectedAction) ? "Send Again" : "Send Action"}</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Refund Amount Modal ───────────────────────────────────────────────────────
const RefundAmountModal = ({ report, onClose, onConfirm, onShowToast, onShowActionModal }) => {
  const [refundDoc,   setRefundDoc]   = useState(null);
  const [taskDoc,     setTaskDoc]     = useState(null);
  const [workerPct,   setWorkerPct]   = useState("");
  const [customerPct, setCustomerPct] = useState("");
  const [loadingDoc,  setLoadingDoc]  = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [fetchError,  setFetchError]  = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoadingDoc(true);
      try {
        let doc = null;
        let res = await apiCall(`${BASE}/refunds?report_id=${report.id}&limit=1`);
        if (res.ok) { const d = await res.json(); doc = d.refunds?.[0] || null; }
        if (!doc && report.taskId) { res = await apiCall(`${BASE}/refunds?task_id=${report.taskId}&limit=1`); if (res.ok) { const d = await res.json(); doc = d.refunds?.[0] || null; } }
        if (doc) {
          setRefundDoc(doc);
          const totalAmount = doc.total_amount ?? doc.totalCost ?? report.totalCost ?? 0;
          if (doc.amount_customer != null && totalAmount > 0) {
            setCustomerPct(((doc.amount_customer / totalAmount) * 100).toFixed(1));
            setWorkerPct((((doc.amount_worker ?? 0) / totalAmount) * 100).toFixed(1));
          }
        }
        const taskId = doc?.task_id || report.taskId;
        if (taskId) { const taskRes = await apiCall(`${BASE}/task/${taskId}`); if (taskRes.ok) setTaskDoc(await taskRes.json()); }
      } catch (err) { setFetchError(err.message); }
      finally { setLoadingDoc(false); }
    };
    load();
  }, [report.id, report.taskId]);

  // ── Smart policy calculation based on actual task state ──
  const policy = (() => {
    if (!taskDoc) return null;
    const reportedAt = report.createdAt ? new Date(report.createdAt) : null;
    if (!reportedAt) return null;

    // Post-completion: task was fully completed before report
    if (taskDoc.status === "completed" && taskDoc.completedAt) {
      const completedAt = new Date(taskDoc.completedAt);
      const hrsAfter = (reportedAt - completedAt) / (1000 * 60 * 60);
      return {
        type: "post_completion",
        hours: Math.abs(hrsAfter),
        label: "Post-Completion Report",
        detail: `Report filed ${Math.abs(hrsAfter).toFixed(1)} hrs after task was completed. Work was performed and escrow may have been released.`,
        policyNote: "Policy: Manual review required — work was completed before report was filed.",
        suggestedCustomerPct: null,
        suggestedWorkerPct: null,
        color: C.red,
        bg: C.redLight,
        icon: "🔍",
      };
    }

    // During work: worker started but task not completed
    if (taskDoc.startedAt && taskDoc.status !== "completed") {
      const startedAt = new Date(taskDoc.startedAt);
      const hrsAfter = (reportedAt - startedAt) / (1000 * 60 * 60);
      return {
        type: "during_work",
        hours: Math.abs(hrsAfter),
        label: "Report During Active Work",
        detail: `Report filed ${Math.abs(hrsAfter).toFixed(1)} hrs after worker started. Work was already in progress.`,
        policyNote: "Policy: Manual review required — work had already begun.",
        suggestedCustomerPct: null,
        suggestedWorkerPct: null,
        color: C.brand,
        bg: C.brandLight,
        icon: "⚠️",
      };
    }

    // Standard pre-service cancellation
    if (!taskDoc.serviceDate) return null;
    const serviceDateTime = new Date(
      `${new Date(taskDoc.serviceDate).toISOString().split("T")[0]}T${taskDoc.serviceTime || "00:00"}`
    );
    const hrs = (serviceDateTime - reportedAt) / (1000 * 60 * 60);

    if (hrs >= 4) return {
      type: "early",
      hours: hrs,
      label: "Early Cancellation",
      detail: `Cancelled ${hrs.toFixed(1)} hrs before service — full refund applies.`,
      policyNote: "Policy: Full refund (cancelled 4+ hours in advance)",
      suggestedCustomerPct: 100,
      suggestedWorkerPct: 0,
      color: C.green,
      bg: C.greenLight,
      icon: "✅",
    };

    if (hrs >= 0) return {
      type: "late",
      hours: hrs,
      label: "Late Cancellation",
      detail: `Cancelled ${hrs.toFixed(1)} hrs before service — worker is owed 25%.`,
      policyNote: "Policy: 25% retained by worker (< 4 hours before service)",
      suggestedCustomerPct: 75,
      suggestedWorkerPct: 25,
      color: C.brand,
      bg: C.brandLight,
      icon: "⚠️",
    };

    // After scheduled time but no start/completion recorded
    return {
      type: "after_scheduled",
      hours: Math.abs(hrs),
      label: "Post-Scheduled Report",
      detail: `Filed ${Math.abs(hrs).toFixed(1)} hrs after scheduled service time. Task status: ${taskDoc.status}.`,
      policyNote: "Policy: Manual review required.",
      suggestedCustomerPct: null,
      suggestedWorkerPct: null,
      color: C.red,
      bg: C.redLight,
      icon: "🔍",
    };
  })();

  const applyPolicy = () => {
    if (!policy) return;
    if (policy.suggestedCustomerPct != null) setCustomerPct(String(policy.suggestedCustomerPct));
    if (policy.suggestedWorkerPct   != null) setWorkerPct(String(policy.suggestedWorkerPct));
    onShowToast("Policy amounts applied", "success");
  };

  const totalAmount    = refundDoc?.total_amount ?? refundDoc?.totalCost ?? report.totalCost ?? report.amount ?? 0;
  const customerAmt    = (totalAmount * (parseFloat(customerPct) || 0)) / 100;
  console.log("customer amt", customerAmt);
  const workerAmt      = (totalAmount * (parseFloat(workerPct)   || 0)) / 100;
  const totalRefundPct = (parseFloat(customerPct) || 0) + (parseFloat(workerPct) || 0);
  const totalRefundAmt = customerAmt + workerAmt;

  const handleSaveAmounts = async () => {
    const workerP   = parseFloat(workerPct)   || 0;
    const customerP = parseFloat(customerPct) || 0;
    if (customerP > 100 || workerP > 100) { onShowToast("Percentages cannot exceed 100%!", "error"); return; }
    if (customerP + workerP > 100)        { onShowToast("Total cannot exceed 100%!", "error"); return; }
    if (customerP === 0)                  { onShowToast("Customer refund percentage is required.", "error"); return; }
    setSubmitting(true);
    try {
      const res = await apiCall(`${BASE}/refunds/upsert/${report.taskId}`, { method: "PATCH", body: JSON.stringify({ amount_customer: customerAmt, amount_worker: workerAmt, reason: report.reason || "Dispute adjustment", requested_by: "admin", status: refundDoc?.status || "pending" }) });
      if (res.ok) {
        const data = await res.json();
        setRefundDoc(data); onConfirm(data);
        onShowToast(`Refund amounts saved: ${customerP}% to customer, ${workerP}% worker penalty`, "success");
        onClose();
      } else { const errBody = await res.json().catch(() => null); onShowToast(`⚠️ ${errBody?.detail || `HTTP ${res.status}`}`, "error"); }
    } catch (err) { onShowToast(`Error: ${err.message}`, "error"); }
    finally { setSubmitting(false); }
  };

  const amountsAlreadySet = refundDoc?.amount_customer != null && refundDoc.amount_customer > 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100000, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: C.surface, borderRadius: 24, padding: 28, width: 520, maxWidth: "90%", boxShadow: "0 25px 50px rgba(0,0,0,0.3)", animation: "scaleIn 0.2s ease", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#2E9E8E18", display: "flex", alignItems: "center", justifyContent: "center" }}><Percent size={18} color="#2E9E8E" /></div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.textPrimary }}>Set Refund Amounts</h3>
              <div style={{ fontSize: 11, color: C.textMuted }}>Report {shortId(report.id)} · Amounts can be set before approving</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={20} color={C.textMuted} /></button>
        </div>
        <div style={{ marginBottom: 16, padding: "12px 14px", background: "#EEF6FF", border: "1px solid #3D7EC930", borderRadius: 12, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Info size={16} color={C.blue} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: C.blue, lineHeight: 1.5 }}>
            <strong>Set amounts first, approve later.</strong> You can save refund amounts at any time. The refund will move to <em>in progress</em> once you approve the report.
          </div>
        </div>
        {policy && (
          <div style={{ marginBottom: 20, borderRadius: 14, border: `1px solid ${policy.color}35`, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", background: policy.bg, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{policy.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: policy.color, marginBottom: 2 }}>{policy.label}</div>
                <div style={{ fontSize: 12, color: C.textSecond, lineHeight: 1.5 }}>{policy.detail}</div>
                <div style={{ fontSize: 11, color: policy.color, marginTop: 4, fontWeight: 600 }}>{policy.policyNote}</div>
              </div>
            </div>
            {policy.suggestedCustomerPct != null && (
              <div style={{ padding: "10px 16px", background: C.surface, borderTop: `1px solid ${policy.color}20`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>
                  Suggested: <strong style={{ color: C.green }}>{policy.suggestedCustomerPct}% to customer</strong>
                  {policy.suggestedWorkerPct > 0 && <> · <strong style={{ color: C.red }}>{policy.suggestedWorkerPct}% worker penalty</strong></>}
                </span>
                <button onClick={applyPolicy} style={{ padding: "5px 12px", borderRadius: 20, border: "none", background: policy.color, color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Apply</button>
              </div>
            )}
          </div>
        )}
        {loadingDoc && (
          <div style={{ padding: "32px 0", textAlign: "center", color: C.textMuted }}>
            <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
            <div style={{ fontSize: 13 }}>Loading refund details...</div>
          </div>
        )}
        {fetchError && <div style={{ padding: 16, background: C.redLight, borderRadius: 10, color: C.red, fontSize: 13, marginBottom: 16 }}>Could not load refund data: {fetchError}</div>}
        {!loadingDoc && (
          <>
            <div style={{ background: C.bg, borderRadius: 14, padding: 16, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: C.textMuted }}>Total Task Amount</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>NPR {totalAmount.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>Report Status</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: report.status === "resolved" ? C.green : C.brand }}>{report.status}</span>
              </div>
              {taskDoc?.serviceDate && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: C.textMuted }}>Scheduled Service</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textSecond }}>
                    {new Date(`${new Date(taskDoc.serviceDate).toISOString().split("T")[0]}T${taskDoc.serviceTime || "00:00"}`).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>
                <Briefcase size={14} style={{ display: "inline", marginRight: 6 }} />Worker Penalty (%)
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg }}>
                <input type="number" min="0" max="100" step="1" value={workerPct} onChange={e => setWorkerPct(e.target.value)} placeholder="0" style={{ flex: 1, border: "none", background: "transparent", fontSize: 15, fontWeight: 600, color: C.textPrimary, outline: "none", fontFamily: "inherit" }} />
                <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>%</span>
                <span style={{ fontSize: 12, color: C.red, fontWeight: 700, minWidth: 100, textAlign: "right" }}>= NPR {workerAmt.toFixed(2)}</span>
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>
                <User size={14} style={{ display: "inline", marginRight: 6 }} />Customer Refund (%)
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg }}>
                <input type="number" min="0" max="100" step="1" value={customerPct} onChange={e => setCustomerPct(e.target.value)} placeholder="0" style={{ flex: 1, border: "none", background: "transparent", fontSize: 15, fontWeight: 600, color: C.textPrimary, outline: "none", fontFamily: "inherit" }} />
                <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>%</span>
                <span style={{ fontSize: 12, color: C.green, fontWeight: 700, minWidth: 100, textAlign: "right" }}>= NPR {customerAmt.toFixed(2)}</span>
              </div>
            </div>
            <div style={{ background: totalRefundPct > 100 ? C.redLight : "#9B7FD412", borderRadius: 12, padding: 14, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: C.textMuted }}>Total Refund</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: totalRefundPct > 100 ? C.red : "#9B7FD4" }}>{totalRefundPct.toFixed(1)}% = NPR {totalRefundAmt.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>Remaining</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: totalRefundPct > 100 ? C.red : C.green }}>{(100 - totalRefundPct).toFixed(1)}% = NPR {(totalAmount - totalRefundAmt).toLocaleString()}</span>
              </div>
              {totalRefundPct > 100 && <div style={{ marginTop: 8, fontSize: 12, color: C.red, fontWeight: 600 }}>⚠ Total percentage exceeds 100%!</div>}
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: refundDoc?.id ? 12 : 0 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", fontSize: 14, color: C.textSecond, fontFamily: "inherit" }}>Cancel</button>
              <button onClick={handleSaveAmounts} disabled={submitting || totalRefundPct > 100 || (parseFloat(customerPct) || 0) === 0}
                style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: totalRefundPct > 100 ? C.textMuted : "#2E9E8E", color: "white", fontWeight: 600, fontSize: 14, cursor: submitting || totalRefundPct > 100 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
                {submitting ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Saving...</> : totalRefundPct > 100 ? <><AlertTriangle size={14} /> Total Exceeds 100%</> : amountsAlreadySet ? <><Check size={14} /> Update Amounts</> : <><Check size={14} /> Save Amounts</>}
              </button>
            </div>
            {refundDoc?.id && (
              <button onClick={() => { onClose(); onShowActionModal(); }} style={{ width: "100%", padding: "12px", borderRadius: 10, border: `1px solid ${C.brand}40`, background: C.brandLight, color: C.brand, fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
                <Bell size={14} />Send Warning / Suspension
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ── Report Detail Modal ───────────────────────────────────────────────────────
const ReportDetailModal = ({ report, onClose, onResolve, onDecline, onDelete, onRefundCreated, onShowToast }) => {
  const [adminNote,       setAdminNote]       = useState(report.adminNote || "");
  const [confirm,         setConfirm]         = useState(null);
  const [activeTab,       setActiveTab]       = useState("details");
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [refundCount,     setRefundCount]     = useState(0);
  const [localReport,     setLocalReport]     = useState(report);
  const [refundData,      setRefundData]      = useState(null);
  const backdropRef = useRef(null);

  const reporterProfile = useProfilePhoto(localReport.reporterId, localReport.reporterType);
  const reportedProfile = useProfilePhoto(localReport.reportedId, localReport.reportedType);

  useEffect(() => { setLocalReport(report); }, [report]);

  useEffect(() => {
    const load = async () => {
      try {
        let res = await apiCall(`${BASE}/refunds?report_id=${report.id}&limit=1`);
        if (res.ok) { const d = await res.json(); if ((d.total ?? 0) > 0) { setRefundCount(d.total); setRefundData(d.refunds?.[0]); return; } }
        if (report.taskId) { res = await apiCall(`${BASE}/refunds?task_id=${report.taskId}&limit=1`); if (res.ok) { const d = await res.json(); setRefundCount(d.total ?? 0); setRefundData(d.refunds?.[0]); } }
      } catch {}
    };
    load();
  }, [report.id, report.taskId]);

  const handleRefundConfirm = (refund) => { setRefundCount(prev => Math.max(prev, 1)); setRefundData(refund); if (onRefundCreated) onRefundCreated(refund); };
  const handleResolveLocal  = async (reportId, note) => { await onResolve(reportId, note, refundData?.amount_customer, refundData?.amount_worker); setLocalReport(p => ({ ...p, status: "resolved", adminNote: note })); };
  const handleDeclineLocal  = async (reportId, note) => { await onDecline(reportId, note, refundData?.amount_customer, refundData?.amount_worker); setLocalReport(p => ({ ...p, status: "declined", adminNote: note })); };

  const triggerResolve = () => {
    const hasAmounts = refundData?.amount_customer != null && refundData.amount_customer > 0;
    setConfirm({
      type: "resolve", title: "Approve & Resolve Report",
      message: hasAmounts ? "Resolving this report will move the refund to in-progress and allow the money to be released." : `No refund amounts have been set yet. Resolving without amounts will approve the report but the refund will stay in "approved" state until amounts are added.`,
      subMessage: hasAmounts ? `Customer refund: NPR ${refundData.amount_customer?.toLocaleString() ?? 0} · Worker penalty: NPR ${refundData.amount_worker?.toLocaleString() ?? 0}` : `Tip: Set refund amounts first using the "Set Refund %" button, then approve.`,
      danger: false, confirmLabel: "Yes, Resolve Report",
    });
  };
  const triggerDecline = () => setConfirm({ type: "decline", title: "Decline Report", message: "Are you sure you want to decline this report? The refund request will also be declined.", danger: true, confirmLabel: "Yes, Decline" });

  const DetailRow = ({ icon: Icon, label, value }) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.divider}` }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={14} color={C.textSecond} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  );

  return (
    <>
      <div ref={backdropRef} onClick={e => { if (e.target === backdropRef.current) onClose(); }}
        style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(28,20,16,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div onClick={e => e.stopPropagation()}
          style={{ background: C.surface, borderRadius: 28, width: 900, height: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 60px rgba(0,0,0,0.3)", animation: "scaleIn 0.2s ease", overflow: "hidden" }}>

          {/* ── Modal Header ── */}
          <div style={{ background: O.header, paddingTop: "20px", paddingLeft: "28px", paddingRight: "28px", flexShrink: 0, position: "relative" }}>
            <button onClick={onClose} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}><X size={16} /></button>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}><Flag size={22} color="white" /></div>
              <div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 600, marginBottom: 4 }}>{shortId(localReport.id)}</div>
                <h2 style={{ color: "white", margin: 0, fontSize: 20, fontWeight: 700 }}>Report Details</h2>
              </div>
              {refundCount > 0 && (
                <div style={{ marginLeft: "auto", background: "rgba(255,255,255,0.2)", borderRadius: 20, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                  <RotateCcw size={14} color="white" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "white" }}>{refundCount} refund{refundCount > 1 ? "s" : ""} linked</span>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}><StatusBadge status={localReport.status} /><ReasonBadge reason={localReport.reason} /></div>
            <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
              {[
                { key: "details",          icon: FileText,   label: "Details"          },
                { key: "customer-history", icon: User,       label: "Customer History" },
                { key: "worker-history",   icon: Briefcase,  label: "Worker History"   },
                { key: "task-history",     icon: TrendingUp, label: "Task History"     },
                { key: "ai-analysis",      icon: Brain,      label: "AI Analysis"      },
              ].map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  style={{ padding: "8px 16px", borderRadius: "20px 20px 0 0", border: "none", background: activeTab === key ? "white" : "rgba(255,255,255,0.15)", color: activeTab === key ? O[600] : "white", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", transition: "all 0.15s", whiteSpace: "nowrap" }}>
                  <Icon size={14} />{label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Action strip — pending ── */}
          {localReport.status === "pending" && activeTab === "details" && (
            <div style={{ padding: "14px 24px", borderBottom: `1px solid ${C.border}`, background: C.bg, display: "flex", gap: 10, flexShrink: 0, alignItems: "center" }}>
              {localReport.taskId && (
                <button onClick={() => setShowRefundModal(true)}
                  style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid #2E9E8E50`, background: "#2E9E8E15", color: "#2E9E8E", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit", position: "relative" }}>
                  <Percent size={16} />
                  {refundData?.amount_customer != null ? "Edit Refund %" : "Set Refund %"}
                  {refundData?.amount_customer != null && (
                    <span style={{ position: "absolute", top: -6, right: -6, background: C.green, color: "white", borderRadius: "50%", width: 18, height: 18, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</span>
                  )}
                </button>
              )}
              <button onClick={triggerResolve} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: C.green, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
                <CheckCircle size={16} /> Approve & Resolve
              </button>
              <button onClick={triggerDecline} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: C.red, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
                <XCircle size={16} /> Decline
              </button>
              <button onClick={() => setConfirm({ type: "delete", title: "Delete Report", message: "Permanently delete this report? This cannot be undone.", danger: true, confirmLabel: "Delete" })}
                style={{ padding: "10px 14px", borderRadius: 10, background: C.redLight, color: C.red, border: `1px solid ${C.red}30`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Trash2 size={16} />
              </button>
            </div>
          )}

          {/* ── Action strip — resolved ── */}
          {localReport.status === "resolved" && localReport.taskId && activeTab === "details" && (
            <div style={{ padding: "12px 24px", borderBottom: `1px solid ${C.border}`, background: C.bg, display: "flex", gap: 10, flexShrink: 0, alignItems: "center" }}>
              <div style={{ flex: 1, fontSize: 13, color: C.green, display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
                <CheckCircle size={15} /> Report resolved — refund can now be processed
              </div>
              {refundData?.amount_customer != null ? (
                <div style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid #2E9E8E40`, background: "#2E9E8E10", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#2E9E8E", fontWeight: 600 }}>
                  <Check size={14} /> NPR {refundData.amount_customer?.toLocaleString()} set
                  <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 400, marginLeft: 2 }}>(locked)</span>
                </div>
              ) : (
                <div style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.textMuted, fontWeight: 500 }}>
                  <Percent size={14} /> No refund amounts set
                </div>
              )}
              {refundData?.id && (
                <button onClick={() => setShowActionModal(true)} style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${C.brand}40`, background: C.brandLight, color: C.brand, fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                  <Bell size={14} /> Warn/Suspend
                </button>
              )}
            </div>
          )}

          {/* ── Body ── */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px", background: C.bg }}>
            {activeTab === "details" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                {/* Reporter / Reported */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {[
                    { label: "Filed By", id: localReport.reporterId, type: localReport.reporterType, profile: reporterProfile },
                    { label: "Reported", id: localReport.reportedId, type: localReport.reportedType, profile: reportedProfile },
                  ].map(({ label, id, type, profile }) => (
                    <div key={label} style={{ background: C.surface, borderRadius: 16, padding: 18, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>{label}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Avatar type={type} size={44} photo={profile.photo} name={profile.name} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, marginBottom: 2 }}>{profile.name || "—"}</div>
                          <div style={{ fontSize: 11, color: C.textMuted, wordBreak: "break-all", marginBottom: 6 }}>{id}</div>
                          <TypeBadge type={type} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Description */}
                <div style={{ background: C.surface, borderRadius: 16, padding: 18, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>Description</div>
                  <p style={{ margin: 0, fontSize: 14, color: C.textSecond, lineHeight: 1.6 }}>{localReport.description || "No description provided."}</p>
                </div>
                  {/* Evidence Image */}
{/* Evidence Image */}
{localReport.evidenceUrl && (
  <div style={{ background: C.surface, borderRadius: 16, padding: 18, border: `1px solid ${C.border}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Evidence Attached</div>
      <a 
        href={`http://localhost:8000${localReport.evidenceUrl}`}
        target="_blank" 
        rel="noopener noreferrer"
        style={{ fontSize: 11, color: C.blue, textDecoration: "none", display: "flex", alignItems: "center", gap: 4, fontWeight: 500 }}
      >
        Open in new tab →
      </a>
    </div>
    
    <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}`, background: C.bg }}>
      <img 
        src={`http://localhost:8000${localReport.evidenceUrl}`}
        alt="Evidence" 
        style={{ width: "100%", height: "auto", display: "block", maxHeight: 500, objectFit: "contain" }}
        onError={(e) => {
          e.target.style.display = 'none';
          const parent = e.target.parentElement;
          parent.innerHTML = `
            <div style="padding: 40px; text-align: center; color: ${C.red}">
              <div style="margin-bottom: 12px">⚠️</div>
              <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px">Failed to load evidence image</div>
              <div style="font-size: 11px; color: ${C.textMuted}">Image path: ${localReport.evidenceUrl}</div>
            </div>
          `;
        }}
      />
    </div>
  </div>
)}
                {/* Report dates (simple) */}
                <div style={{ background: C.surface, borderRadius: 16, padding: 18, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>Report dates</div>
                  <DetailRow icon={Calendar} label="Filed on" value={`${fmt(localReport.createdAt)} at ${fmtTime(localReport.createdAt)}`} />
                  {localReport.resolvedAt && <DetailRow icon={CheckCircle} label="Resolved on" value={`${fmt(localReport.resolvedAt)} at ${fmtTime(localReport.resolvedAt)}`} />}
                </div>

                {/* Task Timeline — always shown when taskId exists */}
                {localReport.taskId && <TaskTimeline report={localReport} />}

                {/* Refund amounts summary */}
                {refundData?.amount_customer != null && (
                  <div style={{ background: "#2E9E8E15", borderRadius: 16, padding: 16, border: "1px solid #2E9E8E30" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <Percent size={16} color="#2E9E8E" />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#2E9E8E" }}>Refund Amounts Set</span>
                    </div>
                    <div style={{ display: "flex", gap: 20 }}>
                      <div><div style={{ fontSize: 11, color: C.textMuted }}>Customer gets</div><div style={{ fontSize: 16, fontWeight: 700, color: C.green }}>NPR {refundData.amount_customer?.toLocaleString()}</div></div>
                      <div><div style={{ fontSize: 11, color: C.textMuted }}>Worker penalty</div><div style={{ fontSize: 16, fontWeight: 700, color: C.red }}>NPR {refundData.amount_worker?.toLocaleString() || 0}</div></div>
                      <div><div style={{ fontSize: 11, color: C.textMuted }}>Refund status</div><div style={{ fontSize: 13, fontWeight: 700, color: C.brand }}>{refundData.refundStatus || refundData.status}</div></div>
                    </div>
                  </div>
                )}

                {/* Admin note textarea — pending only */}
                {localReport.status === "pending" && (
                  <div style={{ background: C.surface, borderRadius: 16, padding: 18, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>Admin Note (optional)</div>
                    <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="Add a note about this decision..." rows={3}
                      style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", background: C.bg, color: C.textPrimary }} />
                  </div>
                )}

                {/* Admin note display — resolved/declined */}
                {localReport.adminNote && localReport.status !== "pending" && (
                  <div style={{ background: C.brandLight, borderRadius: 16, padding: 16, border: `1px solid ${C.brand}30` }}>
                    <div style={{ fontSize: 11, color: C.brand, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Admin Note</div>
                    <p style={{ margin: 0, fontSize: 13, color: C.textSecond }}>{localReport.adminNote}</p>
                  </div>
                )}

                {/* Delete button — resolved/declined */}
                {localReport.status !== "pending" && (
                  <button onClick={() => setConfirm({ type: "delete", title: "Delete Report", message: "Permanently delete this report?", danger: true, confirmLabel: "Delete" })}
                    style={{ padding: "12px", borderRadius: 12, border: `1px solid ${C.red}30`, background: C.redLight, color: C.red, fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}>
                    <Trash2 size={16} /> Delete Report
                  </button>
                )}
              </div>

            ) : activeTab === "customer-history" ? (
              <CustomerHistoryPanel customerId={localReport.reporterId} customerEmail={localReport.reporterEmail} />
            ) : activeTab === "worker-history" ? (
              <WorkerHistoryPanel workerId={localReport.reportedId} workerEmail={localReport.reportedEmail} />
            ) : activeTab === "task-history" ? (
              <TaskHistoryPanel taskId={localReport.taskId} />
            ) : (
              <AIAnalysisPanel report={localReport} />
            )}
          </div>
        </div>
      </div>

      {showRefundModal && (
        <RefundAmountModal report={localReport} onClose={() => setShowRefundModal(false)} onConfirm={handleRefundConfirm} onShowToast={onShowToast} onShowActionModal={() => { setShowRefundModal(false); setShowActionModal(true); }} />
      )}
      {showActionModal && refundData?.id && (
        <ActionModal report={localReport} refundId={refundData.id} onClose={() => setShowActionModal(false)} onSuccess={() => onShowToast("Action sent successfully ✓", "success")} onShowToast={onShowToast} />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.title} message={confirm.message} subMessage={confirm.subMessage}
          danger={confirm.danger} confirmLabel={confirm.confirmLabel}
          onConfirm={() => {
            if (confirm.type === "resolve") handleResolveLocal(localReport.id, adminNote);
            if (confirm.type === "decline") handleDeclineLocal(localReport.id, adminNote);
            if (confirm.type === "delete")  onDelete(localReport.id);
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
};

// ── Report Table Row ──────────────────────────────────────────────────────────
const ReportRow = ({ report, onSelect, onResolve, onDecline, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const reporter = useProfilePhoto(report.reporterId, report.reporterType);
  const reported = useProfilePhoto(report.reportedId, report.reportedType);

  const handleAction = (action) => {
    if (action === "view")    onSelect(report);
    if (action === "resolve") onResolve(report.id, "");
    if (action === "decline") onDecline(report.id, "");
    if (action === "delete")  onDelete(report.id);
  };

  return (
    <tr style={{ borderBottom: `1px solid ${C.divider}`, transition: "background 0.2s", cursor: "pointer" }}
      onClick={() => onSelect(report)}
      onMouseEnter={e => e.currentTarget.style.background = C.bg}
      onMouseLeave={e => e.currentTarget.style.background = C.surface}>
      <td style={{ padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar type={report.reporterType} size={38} photo={reporter.photo} name={reporter.name} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>{reporter.name || shortId(report.reporterId)}</div>
            <TypeBadge type={report.reporterType} />
          </div>
        </div>
      </td>
      <td style={{ padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar type={report.reportedType} size={38} photo={reported.photo} name={reported.name} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>{reported.name || shortId(report.reportedId)}</div>
            <TypeBadge type={report.reportedType} />
          </div>
        </div>
      </td>
      <td style={{ padding: "16px" }}><ReasonBadge reason={report.reason} /></td>
      <td style={{ padding: "16px" }}><StatusBadge status={report.status} /></td>
      <td style={{ padding: "16px" }}>
        <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 500 }}>{fmt(report.createdAt)}</div>
        <div style={{ fontSize: 11, color: C.textMuted }}>{fmtTime(report.createdAt)}</div>
      </td>
      <td style={{ padding: "16px" }} onClick={e => e.stopPropagation()}>
        <div style={{ position: "relative", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => setMenuOpen(v => !v)} style={{ padding: "8px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", color: C.textMuted, display: "flex", alignItems: "center" }}>
            <MoreVertical size={16} />
          </button>
          {menuOpen && <ContextMenu report={report} onAction={handleAction} onClose={() => setMenuOpen(false)} />}
        </div>
      </td>
    </tr>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function ReportManagement() {
  const [reports,            setReports]            = useState([]);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState(null);
  const [stats,              setStats]              = useState({ total: 0, pending: 0, resolved: 0, declined: 0 });
  const [searchQuery,        setSearch]             = useState("");
  const [filterStatus,       setFilterStatus]       = useState("all");
  const [filterReporterType, setFilterReporterType] = useState("all");
  const [filterReportedType, setFilterReportedType] = useState("all");
  const [showFilters,        setShowFilters]        = useState(false);
  const [selectedReport,     setSelectedReport]     = useState(null);
  const [toast,              setToast]              = useState(null);
  const [confirm,            setConfirm]            = useState(null);
  const [currentPage,        setCurrentPage]        = useState(1);
  const [totalReports,       setTotalReports]       = useState(0);
  const PAGE_SIZE = 50;

  const isFirstRender = useRef(true);
  const showToast = (msg, type = "success") => setToast({ msg, type });

  const fetchPage = async (page, search = searchQuery) => {
    try {
      setLoading(true);
      const skip   = (page - 1) * PAGE_SIZE;
      const params = new URLSearchParams({ skip, limit: PAGE_SIZE });
      if (search?.trim())               params.append("search",       search.trim());
      if (filterStatus !== "all")       params.append("status",       filterStatus);
      if (filterReporterType !== "all") params.append("reporterType", filterReporterType);
      if (filterReportedType !== "all") params.append("reportedType", filterReportedType);
      const res = await apiCall(`${BASE}/reports?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReports(data.reports ?? []);
      setTotalReports(data.total ?? 0);
      setCurrentPage(page);
    } catch (e) { setError(`Failed to load reports: ${e.message}`); showToast(e.message, "error"); }
    finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try { const res = await fetch(`${BASE}/reports/stats`); if (res.ok) setStats(await res.json()); } catch {}
  };

  useEffect(() => { fetchPage(1, ""); fetchStats(); }, []);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const t = setTimeout(() => fetchPage(1, searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);
  useEffect(() => { if (!isFirstRender.current) fetchPage(1, searchQuery); }, [filterStatus, filterReporterType, filterReportedType]);

  const handleResolve = async (reportId, adminNote, customerAmount, workerAmount) => {
    const formData = new URLSearchParams();
    formData.append("status", "resolved");
    if (customerAmount != null) formData.append("customerRefundAmount", customerAmount); // ✅ ADD
    if (workerAmount   != null) formData.append("workerRefundAmount",   workerAmount);   // ✅ ADD
    if (adminNote) formData.append("adminNote", adminNote);
    const token = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
    const res = await fetch(`${BASE}/reports/${reportId}/status`, { method: "PATCH", headers: { "Content-Type": "application/x-www-form-urlencoded", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: formData });
    if (!res.ok) { showToast("Failed to resolve", "error"); return; }
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: "resolved", adminNote } : r));
    if (selectedReport?.id === reportId) setSelectedReport(p => ({ ...p, status: "resolved", adminNote }));
    setStats(p => ({ ...p, pending: p.pending - 1, resolved: p.resolved + 1 }));
    showToast("Report resolved — refund moved to in-progress ✓");
  };

  const handleDecline = async (reportId, adminNote) => {
    const formData = new URLSearchParams();
    formData.append("status", "declined");
    if (adminNote) formData.append("adminNote", adminNote);
    const token = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
    const res = await fetch(`${BASE}/reports/${reportId}/status`, { method: "PATCH", headers: { "Content-Type": "application/x-www-form-urlencoded", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: formData });
    if (!res.ok) { showToast("Failed to decline", "error"); return; }
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: "declined", adminNote } : r));
    if (selectedReport?.id === reportId) setSelectedReport(p => ({ ...p, status: "declined", adminNote }));
    setStats(p => ({ ...p, pending: p.pending - 1, declined: p.declined + 1 }));
    showToast("Report declined");
  };

  const handleDelete = async (reportId) => {
    setConfirm({
      title: "Delete Report", message: "Permanently delete this report? This cannot be undone.", danger: true, confirmLabel: "Delete",
      onConfirm: async () => {
        setConfirm(null);
        const res = await apiCall(`${BASE}/reports/${reportId}`, { method: "DELETE" });
        if (!res.ok) { showToast("Failed to delete", "error"); return; }
        setReports(prev => prev.filter(r => r.id !== reportId));
        setTotalReports(p => p - 1);
        if (selectedReport?.id === reportId) setSelectedReport(null);
        showToast("Report deleted");
      },
    });
  };

  const totalPages = Math.ceil(totalReports / PAGE_SIZE);
  const Pill    = ({ active, onClick, label }) => <button onClick={onClick} style={{ padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12, border: `1px solid ${active ? C.brand + "50" : C.border}`, background: active ? C.brandLight : C.surface, color: active ? C.brand : C.textSecond, fontWeight: active ? 600 : 500, transition: "all 0.15s", fontFamily: "inherit" }}>{label}</button>;
  const pageBtn = (disabled) => ({ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: disabled ? C.bg : C.surface, color: disabled ? C.textMuted : C.textSecond, cursor: disabled ? "default" : "pointer", fontSize: 13, fontFamily: "inherit" });

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: C.bg, minHeight: "100vh", padding: 24 }}>
      {toast   && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} danger={confirm.danger} confirmLabel={confirm.confirmLabel} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
      <style>{`
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 700, color: C.textPrimary, letterSpacing: "-0.01em" }}>Reports Management</h1>
          <p style={{ margin: 0, fontSize: 14, color: C.textMuted }}>Review and manage reports filed by customers and workers</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { fetchPage(1, searchQuery); fetchStats(); }} style={{ padding: "10px 18px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", fontSize: 14, color: C.textSecond, display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}><RefreshCw size={16} /> Refresh</button>
          <button onClick={() => setShowFilters(v => !v)} style={{ padding: "10px 18px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", fontSize: 14, fontWeight: 500, color: C.textSecond, display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}><Filter size={16} /> Filters<ChevronDown size={14} style={{ transform: showFilters ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} /></button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Reports" value={stats.total}    color={C.brand} />
        <StatCard label="Pending"       value={stats.pending}  color={C.brand} sub="Awaiting review" />
        <StatCard label="Resolved"      value={stats.resolved} color={C.green} />
        <StatCard label="Declined"      value={stats.declined} color={C.red}   />
      </div>

      <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: showFilters ? 16 : 0 }}>
          <div style={{ flex: 2, position: "relative", minWidth: 280 }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted }} />
            <input type="text" placeholder="Search by ID, reason, description..." value={searchQuery} onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "10px 12px 10px 38px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, outline: "none", background: C.bg, boxSizing: "border-box", color: C.textPrimary, fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Pill active={filterStatus === "all"}      onClick={() => setFilterStatus("all")}      label="All"      />
            <Pill active={filterStatus === "pending"}  onClick={() => setFilterStatus("pending")}  label="Pending"  />
            <Pill active={filterStatus === "resolved"} onClick={() => setFilterStatus("resolved")} label="Resolved" />
            <Pill active={filterStatus === "declined"} onClick={() => setFilterStatus("declined")} label="Declined" />
          </div>
        </div>
        {showFilters && (
          <div style={{ display: "flex", gap: 12, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
            <select value={filterReporterType} onChange={e => setFilterReporterType(e.target.value)} style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", background: C.bg, cursor: "pointer", minWidth: 160, color: C.textSecond, fontFamily: "inherit" }}>
              <option value="all">All Reporters</option><option value="customer">Customers</option><option value="worker">Workers</option>
            </select>
            <select value={filterReportedType} onChange={e => setFilterReportedType(e.target.value)} style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", background: C.bg, cursor: "pointer", minWidth: 160, color: C.textSecond, fontFamily: "inherit" }}>
              <option value="all">All Reported</option><option value="customer">Customers</option><option value="worker">Workers</option>
            </select>
          </div>
        )}
      </div>

      <div style={{ background: C.surface, borderRadius: 20, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
        {loading ? (
          <div style={{ padding: 80, textAlign: "center" }}><RefreshCw size={40} style={{ color: C.brand, marginBottom: 16, animation: "spin 1s linear infinite" }} /><p style={{ color: C.textSecond, margin: 0, fontSize: 15 }}>Loading reports...</p></div>
        ) : error ? (
          <div style={{ padding: 80, textAlign: "center" }}><AlertTriangle size={40} style={{ color: C.red, marginBottom: 16 }} /><p style={{ color: C.red, margin: 0, fontSize: 15 }}>{error}</p></div>
        ) : reports.length === 0 ? (
          <div style={{ padding: 80, textAlign: "center" }}><Flag size={48} style={{ color: C.textMuted, marginBottom: 16 }} /><h3 style={{ margin: "0 0 8px", color: C.textPrimary, fontSize: 18 }}>No reports found</h3><p style={{ color: C.textMuted, margin: 0, fontSize: 14 }}>{searchQuery || filterStatus !== "all" ? "Try adjusting your filters" : "No reports have been filed yet"}</p></div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `2px solid ${C.border}` }}>
                {["Reporter", "Reported", "Reason", "Status", "Date", ""].map((h, i) => (
                  <th key={h || i} style={{ padding: "14px 16px", textAlign: i === 5 ? "right" : "left", fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map(report => <ReportRow key={report.id} report={report} onSelect={setSelectedReport} onResolve={handleResolve} onDecline={handleDecline} onDelete={handleDelete} />)}
            </tbody>
          </table>
        )}
      </div>

      {!loading && !error && totalReports > 0 && (
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, totalReports)} of {totalReports} reports</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => fetchPage(1, searchQuery)} disabled={currentPage === 1} style={pageBtn(currentPage === 1)}>«</button>
            <button onClick={() => fetchPage(currentPage - 1, searchQuery)} disabled={currentPage === 1} style={pageBtn(currentPage === 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx - 1] > 1) acc.push("..."); acc.push(p); return acc; }, [])
              .map((p, i) => p === "..."
                ? <span key={`d${i}`} style={{ padding: "6px 8px", fontSize: 13, color: C.textMuted }}>…</span>
                : <button key={p} onClick={() => fetchPage(p, searchQuery)} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: currentPage === p ? C.textPrimary : C.surface, color: currentPage === p ? "white" : C.textSecond, cursor: "pointer", fontSize: 13, fontWeight: currentPage === p ? 700 : 500, fontFamily: "inherit" }}>{p}</button>
              )}
            <button onClick={() => fetchPage(currentPage + 1, searchQuery)} disabled={currentPage >= totalPages} style={pageBtn(currentPage >= totalPages)}>›</button>
            <button onClick={() => fetchPage(totalPages, searchQuery)} disabled={currentPage >= totalPages} style={pageBtn(currentPage >= totalPages)}>»</button>
          </div>
        </div>
      )}

      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onResolve={handleResolve}
          onDecline={handleDecline}
          onDelete={handleDelete}
          onShowToast={showToast}
          onRefundCreated={() => showToast("Refund amounts saved ✓", "success")}
        />
      )}
    </div>
  );
}