import React, { useEffect, useState, useRef } from "react";
import {
  Search, CheckCircle, XCircle, MoreVertical,
  Phone, Mail, Briefcase, Calendar, X, User,
  Trash2, KeyRound, AlertTriangle, ChevronDown, ShieldAlert,
  Filter, RefreshCw, Eye, UserCheck, UserX, Clock,
  Star, MapPin, Wrench, Award, Building2,
  Clock3, DollarSign, Globe, Lock, Unlock,
  Info, Users, AlertCircle, CreditCard, CalendarClock,
  Home, Map, FileText, Image as ImageIcon, MapPin as MapPinIcon,
  Clock as ClockIcon, Calendar as CalendarIcon, DollarSign as DollarIcon,
  CreditCard as CreditCardIcon, CheckCircle2, Circle, AlertCircle as AlertCircleIcon
} from "lucide-react";

// ── API config ────────────────────────────────────────────────────────────────
const BASE_URL = "http://localhost:8000/api";
const ALL_TASKS_ENDPOINT = `${BASE_URL}/tasks/all`;

const authHeaders = () => {
  const token = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const apiCall = async (url, options = {}) => {
  const res = await fetch(url, { ...options, headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[API] ${options.method ?? "GET"} ${url} → ${res.status}`, body);
  }
  return res;
};

const fetchAllTasks = async () => {
  const res = await apiCall(ALL_TASKS_ENDPOINT, { method: "GET" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const patchTaskStatus = async (taskId, status) => {
  const res = await apiCall(`${BASE_URL}/taskStatus/update/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

// ── Orange palette (matches Worker/Customer pages) ─────────────────────────────
const O = {
  50:     "#fff7ed",
  100:    "#ffedd5",
  200:    "#fed7aa",
  300:    "#fdba74",
  400:    "#fb923c",
  500:    "#f97316",
  600:    "#ea580c",
  700:    "#c2410c",
  header: "#f9ad66",
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
};

const STATUS_CFG = {
  pending:     { label: "Pending",     color: C.brand,  bg: C.brandLight,  border: "#E8843A30", icon: Clock },
  assigned:    { label: "Assigned",    color: C.blue,   bg: C.blueLight,   border: "#3D7EC930", icon: UserCheck },
  worker_done: { label: "Worker Done", color: C.purple, bg: C.purpleLight, border: "#7C5CBF30", icon: CheckCircle2 },
  completed:   { label: "Completed",   color: C.green,  bg: "#FFFFFF",     border: "#3D9E6E30", icon: CheckCircle },
  paid:        { label: "Paid",        color: C.green,  bg: "#FFFFFF",     border: "#3D9E6E30", icon: DollarSign },
  cancelled:   { label: "Cancelled",   color: C.red,    bg: C.redLight,    border: "#D94F3D30", icon: XCircle },
};

const PAYMENT_CFG = {
  paid:   { label: "Paid",   color: C.green, bg: C.greenLight, border: "#3D9E6E30", icon: CheckCircle },
  unpaid: { label: "Unpaid", color: C.red,   bg: C.redLight,   border: "#D94F3D30", icon: AlertCircle },
};

const ESCROW_CFG = {
  held:     { label: "Held",     color: C.brand, icon: Lock },
  pending:  { label: "Pending",  color: C.textMuted, icon: Clock },
  released: { label: "Released", color: C.green, icon: Unlock },
};

const fmt = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const shortId = (id) => id ? `#${id.slice(-6).toUpperCase()}` : "—";
const initials = (str) => str ? str.slice(0, 2).toUpperCase() : "TK";

// ── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = ({ task, size = 38, fontSize = 14 }) => {
  const letter = (task.selectedService || task.taskType || "T")[0]?.toUpperCase() || "T";
  const color = O[400];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg, ${color}, ${color}dd)`, color: "white", fontWeight: "700", fontSize, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "2px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      {letter}
    </div>
  );
};

// ── Badge ──────────────────────────────────────────────────────────────────────
function Badge({ cfg, value, size = "md" }) {
  const config = cfg[value] || { label: value || "—", color: C.textMuted, bg: "#F0ECE7", border: C.border, icon: Circle };
  const Icon = config.icon;
  const padding = size === "sm" ? "2px 8px" : "4px 10px 4px 8px";
  const fontSize = size === "sm" ? "10px" : "12px";
  
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding, borderRadius: 100, background: config.bg, color: config.color, border: `1px solid ${config.border}`, fontSize, fontWeight: 600, whiteSpace: "nowrap" }}>
      {Icon && <Icon size={size === "sm" ? 10 : 12} />}
      {config.label}
    </span>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
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

// ── Confirm Dialog ────────────────────────────────────────────────────────────
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

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, icon: Icon }) => (
  <div style={{ background: "white", borderRadius: "16px", padding: "20px", border: "1px solid #e5e7eb" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
      {Icon && <Icon size={16} color={O[600]} />}
      <div style={{ fontSize: "13px", color: "#080808", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
    </div>
    <div style={{ fontSize: "28px", fontWeight: "700", color: "#080808", lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "5px" }}>{sub}</div>}
  </div>
);

// ── Context Menu ──────────────────────────────────────────────────────────────
const ContextMenu = ({ task, onAction, onClose }) => {
  const menuRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const actions = [
    { label: "View Details", icon: Eye, action: "view", color: "#3b82f6" },
    ...Object.entries(STATUS_CFG).map(([k, v]) => ({
      label: `Mark as ${v.label}`,
      icon: v.icon,
      action: `status_${k}`,
      color: v.color
    })),
  ];

  return (
    <div ref={menuRef} style={{ position: "absolute", right: 0, top: "100%", zIndex: 100000, background: "white", borderRadius: "14px", boxShadow: "0 10px 40px rgba(0,0,0,0.15)", border: "1px solid #e5e7eb", minWidth: "200px", marginTop: "4px", animation: "scaleIn 0.1s ease" }}>
      {actions.map(({ label, icon: Icon, action, color }) => (
        <button key={action} onClick={() => { onAction(action); onClose(); }}
          style={{ width: "100%", padding: "12px 16px", border: "none", background: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", fontSize: "13px", fontWeight: "500", color, textAlign: "left", borderBottom: "1px solid #f3f4f6" }}
          onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
          onMouseLeave={e => e.currentTarget.style.background = "white"}
        >
          <Icon size={16} />{label}
        </button>
      ))}
    </div>
  );
};

// ── Task Detail Modal ─────────────────────────────────────────────────────────
const TaskDetailModal = ({ task, onClose, onStatusChange, onConfirmAction }) => {
  const [tab, setTab] = useState("details");
  const [confirm, setConfirm] = useState(null);
  const backdropRef = useRef(null);

  if (!task) return null;

  const handleStatusChange = (newStatus) => {
    setConfirm({
      type: "status",
      message: `Change status to ${STATUS_CFG[newStatus]?.label}?`,
      action: () => onStatusChange(task._id, newStatus)
    });
  };

  const DetailRow = ({ icon: Icon, label, value }) => {
    if (value === null || value === undefined || value === "") return null;
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "8px 0", borderBottom: `1px solid ${O.border}` }}>
        <div style={{ width: "36px", height: "36px", borderRadius: "12px", background: O.bg, border: `1px solid ${O.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={16} color="#6b7280" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "500", marginBottom: "2px" }}>{label}</div>
          <div style={{ fontSize: "14px", color: "#111827", fontWeight: "500" }}>{value}</div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div ref={backdropRef} onClick={e => { if (e.target === backdropRef.current) onClose(); }}
        style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: "28px", width: "600px", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px rgba(0,0,0,0.3)", animation: "scaleIn 0.2s ease" }}>

          {/* Header */}
          <div style={{ background: O.header, paddingTop: "28px", paddingLeft: "28px", paddingRight: "28px", position: "relative", flexShrink: 0, borderRadius: "28px 28px 0 0" }}>
            <button onClick={onClose} style={{ position: "absolute", top: "20px", right: "20px", background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: "36px", height: "36px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
              <X size={18} />
            </button>
            
            <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "20px" }}>
              <Avatar task={task} size={70} fontSize={24} />
              <div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)", fontWeight: "600", marginBottom: "4px" }}>{shortId(task._id)}</div>
                <h2 style={{ color: "white", margin: "0 0 8px", fontSize: "22px", fontWeight: "600" }}>{task.selectedService || task.taskType}</h2>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <Badge cfg={STATUS_CFG} value={task.status} />
                  <Badge cfg={PAYMENT_CFG} value={task.payment_status} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "4px", marginTop: "16px", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
              {[
                { id: "details", label: "Details", icon: FileText },
                { id: "location", label: "Location", icon: MapPin },
                { id: "payment", label: "Payment", icon: DollarSign },
              ].map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setTab(id)} style={{ padding: "8px 16px", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "500", background: tab === id ? "white" : "transparent", color: tab === id ? O[600] : "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "-1px" }}>
                  <Icon size={14} />{label}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px", background: O.bg, borderRadius: "0 0 28px 28px" }}>
            
            {/* Status Update Section */}
            <div style={{ background: "white", borderRadius: "16px", padding: "16px", marginBottom: "20px", border: `1px solid ${O.border}` }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: "600", color: O[500], textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
                <RefreshCw size={14} /> Update Status
              </h4>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {Object.entries(STATUS_CFG).map(([k, v]) => {
                  const Icon = v.icon;
                  return (
                    <button
                      key={k}
                      onClick={() => handleStatusChange(k)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "100px",
                        border: `1px solid ${task.status === k ? v.border : O.border}`,
                        background: task.status === k ? v.bg : "white",
                        color: task.status === k ? v.color : C.textMuted,
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: "600",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      <Icon size={14} />
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {tab === "details" && (
              <>
                <div style={{ background: "white", borderRadius: "20px", padding: "20px", marginBottom: "16px", border: `1px solid ${O.border}` }}>
                  <h4 style={{ margin: "0 0 16px", fontSize: "13px", fontWeight: "600", color: O[500], textTransform: "uppercase", letterSpacing: "0.5px" }}>Service Details</h4>
                  <DetailRow icon={FileText} label="Service" value={task.selectedService || task.taskType} />
                  <DetailRow icon={Info} label="Description" value={task.taskDescrip} />
                  {task.note && <DetailRow icon={FileText} label="Note" value={task.note} />}
                  {task.taskImg?.length > 0 && (
                    <DetailRow icon={ImageIcon} label="Photos" value={`${task.taskImg.length} image(s) attached`} />
                  )}
                </div>

                <div style={{ background: "white", borderRadius: "20px", padding: "20px", border: `1px solid ${O.border}` }}>
                  <h4 style={{ margin: "0 0 16px", fontSize: "13px", fontWeight: "600", color: O[500], textTransform: "uppercase", letterSpacing: "0.5px" }}>Scheduling</h4>
                  <DetailRow icon={CalendarIcon} label="Service Date" value={fmt(task.serviceDate)} />
                  <DetailRow icon={ClockIcon} label="Service Time" value={task.serviceTIme || task.serviceTime} />
                  <DetailRow icon={CalendarClock} label="Booked On" value={fmtDateTime(task.createdAt)} />
                  {task.completionTime && <DetailRow icon={ClockIcon} label="Completion Time" value={`${task.completionTime} hour(s)`} />}
                  {task.estimatedHours && <DetailRow icon={ClockIcon} label="Estimated Hours" value={`${task.estimatedHours} hour(s)`} />}
                  {task.worker_done_at && <DetailRow icon={CheckCircle2} label="Worker Done At" value={fmtDateTime(task.worker_done_at)} />}
                  {task.paid_at && <DetailRow icon={CheckCircle} label="Paid At" value={fmtDateTime(task.paid_at)} />}
                </div>
              </>
            )}

            {tab === "location" && (
              <div style={{ background: "white", borderRadius: "20px", padding: "20px", border: `1px solid ${O.border}` }}>
                <h4 style={{ margin: "0 0 16px", fontSize: "13px", fontWeight: "600", color: O[500], textTransform: "uppercase", letterSpacing: "0.5px" }}>Location Information</h4>
                <DetailRow icon={MapPin} label="Full Address" value={task.address} />
                {task.lat && task.lng && (
                  <>
                    <DetailRow icon={Map} label="Coordinates" value={`${parseFloat(task.lat).toFixed(4)}, ${parseFloat(task.lng).toFixed(4)}`} />
                    <div style={{ marginTop: "16px" }}>
                      <a href={`https://www.google.com/maps?q=${task.lat},${task.lng}`} target="_blank" rel="noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 16px", background: O[100], color: O[700], borderRadius: "12px", textDecoration: "none", fontSize: "13px", fontWeight: "500" }}>
                        <MapPin size={16} />
                        View on Google Maps
                      </a>
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === "payment" && (
              <div style={{ background: "white", borderRadius: "20px", padding: "20px", border: `1px solid ${O.border}` }}>
                <h4 style={{ margin: "0 0 16px", fontSize: "13px", fontWeight: "600", color: O[500], textTransform: "uppercase", letterSpacing: "0.5px" }}>Payment Details</h4>
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginBottom: "20px" }}>
                  <div style={{ background: O.bg, padding: "16px", borderRadius: "14px", textAlign: "center" }}>
                    <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>Base Price</div>
                    <div style={{ fontSize: "18px", fontWeight: "700", color: "#111827" }}>NPR {task.basePrice}</div>
                  </div>
                  {task.additionalCost > 0 && (
                    <div style={{ background: O.bg, padding: "16px", borderRadius: "14px", textAlign: "center" }}>
                      <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>Additional Cost</div>
                      <div style={{ fontSize: "18px", fontWeight: "700", color: "#111827" }}>NPR {task.additionalCost}</div>
                    </div>
                  )}
                </div>

                <DetailRow icon={DollarSign} label="Total Cost" value={<span style={{ fontWeight: "700", color: C.green }}>NPR {task.totalCost}</span>} />
                {task.final_price && <DetailRow icon={DollarSign} label="Final Price" value={<span style={{ fontWeight: "700", color: C.green }}>NPR {task.final_price}</span>} />}
                <DetailRow icon={CreditCardIcon} label="Payment Method" value={task.payment_method?.toUpperCase()} />
                <DetailRow icon={AlertCircle} label="Payment Status" value={<Badge cfg={PAYMENT_CFG} value={task.payment_status} size="sm" />} />
                
                <div style={{ marginTop: "16px", padding: "16px", background: O.bg, borderRadius: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    {ESCROW_CFG[task.escrow_status]?.icon && React.createElement(ESCROW_CFG[task.escrow_status].icon, { size: 16, color: ESCROW_CFG[task.escrow_status].color })}
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#111827" }}>Escrow Status: </span>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: ESCROW_CFG[task.escrow_status]?.color || C.textMuted }}>
                      {ESCROW_CFG[task.escrow_status]?.label || task.escrow_status || "—"}
                    </span>
                  </div>
                  {task.esewa_ref_id && (
                    <div style={{ fontSize: "12px", color: "#6b7280" }}>
                      Reference: <code style={{ background: "white", padding: "2px 6px", borderRadius: "4px" }}>{task.esewa_ref_id}</code>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: "20px" }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: "600", color: O[500], textTransform: "uppercase", letterSpacing: "0.5px" }}>Customer & Worker</h4>
                  <DetailRow icon={User} label="Customer ID" value={<code style={{ background: O.bg, padding: "2px 6px", borderRadius: "4px", fontSize: "12px" }}>{task.userId}</code>} />
                  <DetailRow icon={User} label="Worker" value={task.assignedWorkerId || <span style={{ color: O[600] }}>Unassigned</span>} />
                  {task.offerStatus && <DetailRow icon={Info} label="Offer Status" value={task.offerStatus} />}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={() => { confirm.action(); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
};

// ── Task Row ─────────────────────────────────────────────────────────────────
const TaskRow = ({ task, onSelect, onStatusChange, onConfirmAction }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleAction = (action) => {
    if (action === "view") {
      onSelect(task);
      return;
    }
    if (action.startsWith("status_")) {
      const newStatus = action.replace("status_", "");
      onConfirmAction({
        type: "status",
        message: `Change status to ${STATUS_CFG[newStatus]?.label}?`,
        taskId: task._id,
        newStatus
      });
    }
  };

  return (
    <tr style={{ borderBottom: "1px solid #f3f4f6", transition: "all 0.2s", cursor: "pointer" }}
      onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
      onMouseLeave={e => e.currentTarget.style.background = "white"}
      onClick={() => onSelect(task)}
    >
      <td style={{ padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Avatar task={task} />
          <div>
            <div style={{ fontWeight: "600", color: O[600], fontSize: "13px", marginBottom: "4px" }}>{shortId(task._id)}</div>
            <div style={{ fontSize: "15px", fontWeight: "600", color: "#111827", marginBottom: "2px" }}>{task.selectedService || task.taskType}</div>
            <div style={{ fontSize: "12px", color: "#6b7280" }}>{fmt(task.createdAt)}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: "16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ fontSize: "13px", fontWeight: "500", color: "#111827" }}>{fmt(task.serviceDate)}</div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>{task.serviceTIme || task.serviceTime || "—"}</div>
        </div>
      </td>
      <td style={{ padding: "16px" }}>
        <div style={{ maxWidth: "200px" }}>
          <div style={{ fontSize: "13px", color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={task.address}>
            {task.address}
          </div>
          {task.assignedWorkerId ? (
            <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>Worker: {task.assignedWorkerId}</div>
          ) : (
            <span style={{ fontSize: "11px", color: O[600], background: O[100], padding: "2px 8px", borderRadius: "10px", display: "inline-block", marginTop: "2px" }}>Unassigned</span>
          )}
        </div>
      </td>
      <td style={{ padding: "16px" }}>
        <div style={{ fontWeight: "700", color: C.green, fontSize: "14px" }}>NPR {(task.final_price || task.totalCost || 0).toLocaleString()}</div>
        {task.additionalCost > 0 && <div style={{ fontSize: "11px", color: "#6b7280" }}>+NPR {task.additionalCost} extra</div>}
      </td>
      <td style={{ padding: "16px" }}>
        <Badge cfg={PAYMENT_CFG} value={task.payment_status} />
      </td>
      <td style={{ padding: "16px" }}>
        <Badge cfg={STATUS_CFG} value={task.status} />
      </td>
      <td style={{ padding: "16px" }} onClick={e => e.stopPropagation()}>
        <div style={{ position: "relative", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => setMenuOpen(v => !v)}
            style={{ padding: "8px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", cursor: "pointer", color: "#6b7280", display: "flex", alignItems: "center" }}
            onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
            onMouseLeave={e => e.currentTarget.style.background = "white"}
          >
            <MoreVertical size={15} />
          </button>
          {menuOpen && <ContextMenu task={task} onAction={handleAction} onClose={() => setMenuOpen(false)} />}
        </div>
      </td>
    </tr>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function TaskManagement() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [currentPage, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const showToast = (msg, type = "success") => setToast({ msg, type });

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllTasks();
      setTasks(Array.isArray(data) ? data : data.tasks ?? []);
    } catch (err) {
      setError(err.message || "Failed to load tasks");
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTasks(); }, []);

  const onStatusChange = async (id, newStatus) => {
    setUpdatingId(id);
    try {
      await patchTaskStatus(id, newStatus);
      setTasks(prev => prev.map(t => t._id === id ? { ...t, status: newStatus } : t));
      if (selected?._id === id) setSelected(prev => ({ ...prev, status: newStatus }));
      showToast(`Status updated to ${STATUS_CFG[newStatus]?.label}`);
    } catch (err) {
      showToast(`Failed to update status: ${err.message}`, "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConfirm = async () => {
    const { type, taskId, newStatus } = confirm;
    setConfirm(null);
    if (type === "status") {
      await onStatusChange(taskId, newStatus);
    }
  };

  // Filtering
  const filtered = tasks.filter(task => {
    // Search filter
    if (search) {
      const q = search.toLowerCase();
      const matches = 
        task.selectedService?.toLowerCase().includes(q) ||
        task.taskType?.toLowerCase().includes(q) ||
        task.address?.toLowerCase().includes(q) ||
        task.assignedWorkerId?.toLowerCase().includes(q) ||
        task.userId?.toLowerCase().includes(q) ||
        task._id?.toLowerCase().includes(q);
      if (!matches) return false;
    }
    
    // Status filter
    if (filterStatus !== "all" && task.status !== filterStatus) return false;
    
    // Payment filter
    if (filterPayment !== "all" && task.payment_status !== filterPayment) return false;
    
    return true;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Stats
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === "pending").length,
    active: tasks.filter(t => ["assigned", "worker_done"].includes(t.status)).length,
    completed: tasks.filter(t => ["completed", "paid"].includes(t.status)).length,
    revenue: tasks.filter(t => t.payment_status === "paid").reduce((s, t) => s + (t.totalCost || 0), 0),
    escrowHeld: tasks.filter(t => t.escrow_status === "held").reduce((s, t) => s + (t.totalCost || 0), 0),
  };

  const totalPages = Math.ceil(tasks.length / PAGE_SIZE);
  const paginatedTasks = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const pageBtn = (disabled) => ({
    padding: "6px 12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: disabled ? "#f9fafb" : "white",
    color: disabled ? "#9ca3af" : "#374151",
    cursor: disabled ? "default" : "pointer",
    fontSize: "13px",
    fontWeight: "500"
  });

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", paddingLeft: "25px", paddingRight: "20px", paddingTop: "20px", paddingBottom: "20px", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <h1 style={{ margin: "0 0 8px", fontSize: "28px", fontWeight: "600", color: "#111827" }}>Task Bookings</h1>
            <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>Manage service bookings, update statuses, and track payments</p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={() => setShowFilters(v => !v)}
              style={{ padding: "10px 20px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: "14px", fontWeight: "500", color: "#374151", display: "flex", alignItems: "center", gap: "8px" }}
              onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
              onMouseLeave={e => e.currentTarget.style.background = "white"}
            >
              <Filter size={16} /> Filters
              <ChevronDown size={16} style={{ transform: showFilters ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>
            <button onClick={loadTasks} disabled={loading}
              style={{ padding: "10px 20px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "white", cursor: loading ? "not-allowed" : "pointer", fontSize: "14px", fontWeight: "500", color: loading ? "#9ca3af" : "#374151", display: "flex", alignItems: "center", gap: "8px" }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#f9fafb"; }}
              onMouseLeave={e => e.currentTarget.style.background = "white"}
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} />
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "16px" }}>
          <StatCard label="Total Bookings" value={loading ? "—" : stats.total} icon={FileText} />
          <StatCard label="Pending" value={loading ? "—" : stats.pending} sub="Awaiting worker" icon={Clock} />
          <StatCard label="Active" value={loading ? "—" : stats.active} icon={UserCheck} />
          <StatCard label="Completed" value={loading ? "—" : stats.completed} icon={CheckCircle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px", marginBottom: "24px" }}>
          <StatCard label="Total Revenue" value={loading ? "—" : `NPR ${stats.revenue.toLocaleString()}`} icon={DollarSign} />
          <StatCard label="Escrow Held" value={loading ? "—" : `NPR ${stats.escrowHeld.toLocaleString()}`} sub="Pending release" icon={Lock} />
        </div>

        {/* Search + Filters */}
        <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e5e7eb", padding: "16px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 1, position: "relative", minWidth: "250px" }}>
              <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input
                type="text"
                placeholder="Search by service, worker, address, or booking ID…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: "100%", padding: "12px 12px 12px 42px", borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "14px", outline: "none", background: "#f9fafb", boxSizing: "border-box" }}
                onFocus={e => { e.target.style.borderColor = O[400]; e.target.style.background = "white"; }}
                onBlur={e => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#f9fafb"; }}
              />
            </div>
            
            {showFilters && (
              <>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  style={{ padding: "12px 16px", borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "14px", outline: "none", background: "#f9fafb", cursor: "pointer", minWidth: "150px" }}
                >
                  <option value="all">All Status</option>
                  {Object.entries(STATUS_CFG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>

                <select
                  value={filterPayment}
                  onChange={e => setFilterPayment(e.target.value)}
                  style={{ padding: "12px 16px", borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "14px", outline: "none", background: "#f9fafb", cursor: "pointer", minWidth: "150px" }}
                >
                  <option value="all">All Payments</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "white", borderRadius: "20px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
        {loading ? (
          <div style={{ padding: "80px", textAlign: "center" }}>
            <RefreshCw size={40} style={{ color: O[400], marginBottom: "16px", animation: "spin 1s linear infinite" }} />
            <p style={{ color: "#6b7280", margin: 0 }}>Loading bookings...</p>
          </div>
        ) : error ? (
          <div style={{ padding: "80px", textAlign: "center" }}>
            <AlertTriangle size={40} style={{ color: "#dc2626", marginBottom: "16px" }} />
            <p style={{ color: "#dc2626", margin: 0 }}>{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "80px", textAlign: "center" }}>
            <FileText size={48} style={{ color: "#9ca3af", marginBottom: "16px" }} />
            <h3 style={{ margin: "0 0 8px", color: "#111827" }}>No bookings found</h3>
            <p style={{ color: "#6b7280", margin: 0 }}>Try adjusting your search or filters</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                {["Booking", "Schedule", "Location / Worker", "Amount", "Payment", "Status", ""].map((h, i) => (
                  <th key={h} style={{ padding: "16px", textAlign: i === 6 ? "right" : "left", fontSize: "12px", fontWeight: "600", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedTasks.map(task => (
                <TaskRow
                  key={task._id}
                  task={task}
                  onSelect={setSelected}
                  onStatusChange={onStatusChange}
                  onConfirmAction={setConfirm}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && filtered.length > PAGE_SIZE && (
        <div style={{ marginTop: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "13px", color: "#6b7280" }}>
            Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} bookings
          </div>
          <div style={{ display: "flex", gap: "5px" }}>
            <button onClick={() => setPage(p => p - 1)} disabled={currentPage === 1} style={pageBtn(currentPage === 1)}>‹ Prev</button>
            {Array.from({ length: Math.ceil(filtered.length / PAGE_SIZE) }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) => p === "..." ? (
                <span key={`d${i}`} style={{ padding: "6px 4px", fontSize: "13px", color: "#9ca3af" }}>…</span>
              ) : (
                <button key={p} onClick={() => setPage(p)}
                  style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", background: currentPage === p ? "#111827" : "white", color: currentPage === p ? "white" : "#374151", cursor: "pointer", fontSize: "13px", fontWeight: currentPage === p ? "700" : "500" }}>{p}</button>
              ))}
            <button onClick={() => setPage(p => p + 1)} disabled={currentPage >= Math.ceil(filtered.length / PAGE_SIZE)} style={pageBtn(currentPage >= Math.ceil(filtered.length / PAGE_SIZE))}>Next ›</button>
          </div>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && filtered.length <= PAGE_SIZE && (
        <div style={{ marginTop: "16px", fontSize: "13px", color: "#6b7280", textAlign: "right" }}>
          Showing {filtered.length} of {tasks.length} bookings
        </div>
      )}

      {/* Modals */}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          danger={confirm.type === "status" && confirm.newStatus === "cancelled"}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {selected && (
        <TaskDetailModal
          task={selected}
          onClose={() => setSelected(null)}
          onStatusChange={onStatusChange}
          onConfirmAction={setConfirm}
        />
      )}
    </div>
  );
}