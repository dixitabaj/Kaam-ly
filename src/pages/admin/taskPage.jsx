import React, { useEffect, useState, useRef } from "react";
import {
  Search, CheckCircle, XCircle, MoreVertical,
  Phone, Mail, Briefcase, Calendar, X, User,
  Trash2, KeyRound, AlertTriangle, ChevronDown, ShieldAlert,
  Filter, RefreshCw, Eye, UserCheck, UserX, Clock,
  Star, MapPin, Wrench, Award, Building2,
  DollarSign, Globe, Lock, Unlock,
  Info, Users, AlertCircle, CreditCard, CalendarClock,
  Home, Map, FileText, Image as ImageIcon,
  CheckCircle2, Circle,
} from "lucide-react";

// ── API ───────────────────────────────────────────────────────────────────────
const BASE_URL = "http://localhost:8000/api";
const ALL_TASKS_ENDPOINT = `${BASE_URL}/tasks/all`;

const authHeaders = () => {
  const token = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

const apiCall = async (url, options = {}) => {
  const res = await fetch(url, { ...options, headers: authHeaders() });
  if (!res.ok) console.error(`[API] ${options.method ?? "GET"} ${url} → ${res.status}`);
  return res;
};

const fetchAllTasks = async () => {
  const res = await apiCall(ALL_TASKS_ENDPOINT);
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

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:           "#F7F5EF",
  surface:      "#FFFFFF",
  border:       "#EDE8DF",
  text:         "#1C1008",
  muted:        "#9C8E82",
  amber:        "#D77D43",
  amberLight:   "#FDF3E8",
  amberBorder:  "#F5D9BB",
  green:        "#16a34a",
  greenLight:   "#f0fdf4",
  greenBorder:  "#bbf7d0",
  red:          "#dc2626",
  redLight:     "#fef2f2",
  redBorder:    "#fecaca",
  yellow:       "#d97706",
  yellowLight:  "#fffbeb",
  yellowBorder: "#fde68a",
  blue:         "#2563eb",
  blueLight:    "#eff6ff",
  blueBorder:   "#bfdbfe",
  purple:       "#7c3aed",
  purpleLight:  "#f5f3ff",
  purpleBorder: "#ddd6fe",
  grayLight:    "#f9fafb",
};

const STATUS_CFG = {
  pending:     { label: "Pending",     color: T.yellow, bg: T.yellowLight, border: T.yellowBorder, icon: Clock },
  assigned:    { label: "Assigned",    color: T.blue,   bg: T.blueLight,   border: T.blueBorder,   icon: UserCheck },
  in_progress: { label: "In Progress", color: T.amber,  bg: T.amberLight,  border: T.amberBorder,  icon: Wrench },
  worker_done: { label: "Worker Done", color: T.purple, bg: T.purpleLight, border: T.purpleBorder, icon: CheckCircle2 },
  completed:   { label: "Completed",   color: T.green,  bg: T.greenLight,  border: T.greenBorder,  icon: CheckCircle },
  cancelled:   { label: "Cancelled",   color: T.red,    bg: T.redLight,    border: T.redBorder,    icon: XCircle },
};

const PAYMENT_CFG = {
  paid:   { label: "Paid",   color: T.green, bg: T.greenLight,  border: T.greenBorder, icon: CheckCircle },
  unpaid: { label: "Unpaid", color: T.red,   bg: T.redLight,    border: T.redBorder,   icon: AlertCircle },
};

const ESCROW_CFG = {
  held:     { label: "Held",     color: T.amber,  icon: Lock   },
  pending:  { label: "Pending",  color: T.muted,  icon: Clock  },
  released: { label: "Released", color: T.green,  icon: Unlock },
};

const fmt         = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const shortId     = (id) => id ? `#${id.slice(-6).toUpperCase()}` : "—";

// ── Helpers ───────────────────────────────────────────────────────────────────
const Spinner = ({ size = 20, color = T.amber }) => (
  <div style={{ width: size, height: size, border: `2.5px solid ${T.border}`, borderTop: `2.5px solid ${color}`, borderRadius: "50%", animation: "spin 0.75s linear infinite", flexShrink: 0 }} />
);

const Avatar = ({ task, size = 40, fontSize = 15 }) => {
  const letter = (task.selectedService || task.taskType || "T")[0]?.toUpperCase() || "T";
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg, ${T.amber}, #f5a623)`, color: "white", fontWeight: 700, fontSize, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "2px solid white", boxShadow: "0 2px 6px rgba(215,125,67,0.3)" }}>
      {letter}
    </div>
  );
};

const StatusPill = ({ cfg, value, size = "md" }) => {
  const s = cfg[value] || { label: value || "—", color: T.muted, bg: T.grayLight, border: T.border, icon: Circle };
  const Icon = s.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: size === "sm" ? "2px 8px" : "4px 10px", borderRadius: 999, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: size === "sm" ? 10 : 11, fontWeight: 700, whiteSpace: "nowrap" }}>
      {Icon && <Icon size={size === "sm" ? 10 : 11} />}
      {s.label}
    </span>
  );
};

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 99999, background: type === "error" ? "#ef4444" : type === "warning" ? "#f59e0b" : "#10b981", color: "white", padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 500, boxShadow: "0 10px 25px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: 8, maxWidth: 320 }}>
      {type === "success" && <CheckCircle size={16} />}
      {type === "error"   && <XCircle size={16} />}
      {type === "warning" && <AlertTriangle size={16} />}
      {message}
    </div>
  );
};

// ── Confirm Dialog ────────────────────────────────────────────────────────────
const ConfirmDialog = ({ message, onConfirm, onCancel, danger = false }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ background: "white", borderRadius: 24, padding: 28, width: 360, boxShadow: "0 25px 50px rgba(0,0,0,0.3)" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: danger ? "#fee2e2" : "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <AlertTriangle size={24} color={danger ? "#dc2626" : "#d97706"} />
      </div>
      <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: "#111827" }}>Confirm Action</h3>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "#6b7280", lineHeight: 1.5 }}>{message}</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button onClick={onCancel}  style={{ padding: "10px 20px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: 14, fontWeight: 500, color: "#6b7280" }}>Cancel</button>
        <button onClick={onConfirm} style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: danger ? "#dc2626" : "#d97706", cursor: "pointer", fontSize: 14, fontWeight: 500, color: "white" }}>Confirm</button>
      </div>
    </div>
  </div>
);

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, accent, icon: Icon }) => (
  <div style={{ background: T.surface, borderRadius: 16, padding: "20px 24px", border: `1px solid ${T.border}`, flex: "1 1 160px", minWidth: 130, borderLeft: `4px solid ${accent || T.amber}` }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px" }}>{label}</div>
      {Icon && <div style={{ width: 28, height: 28, borderRadius: 8, background: T.amberLight, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={14} color={T.amber} /></div>}
    </div>
    <div style={{ fontSize: 26, fontWeight: 800, color: T.text, lineHeight: 1.2 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 5, fontWeight: 500 }}>{sub}</div>}
  </div>
);

// ── Context Menu ──────────────────────────────────────────────────────────────
const ContextMenu = ({ task, onAction, onClose }) => {
  const menuRef = useRef(null);
  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  return (
    <div ref={menuRef} style={{ position: "absolute", right: 0, top: "100%", zIndex: 100000, background: "white", borderRadius: 14, boxShadow: "0 10px 40px rgba(0,0,0,0.12)", border: `1px solid ${T.border}`, minWidth: 210, marginTop: 4, overflow: "hidden" }}>
      <button onClick={() => { onAction("view"); onClose(); }}
        style={{ width: "100%", padding: "11px 16px", border: "none", borderBottom: `1px solid ${T.border}`, background: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, color: T.blue, textAlign: "left" }}
        onMouseEnter={e => e.currentTarget.style.background = T.blueLight}
        onMouseLeave={e => e.currentTarget.style.background = "white"}>
        <Eye size={14} /> View Details
      </button>
      <div style={{ padding: "6px 10px", fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px" }}>Change Status</div>
      {Object.entries(STATUS_CFG).map(([k, v]) => {
        const Icon = v.icon;
        return (
          <button key={k} onClick={() => { onAction(`status_${k}`); onClose(); }}
            style={{ width: "100%", padding: "9px 16px", border: "none", background: task.status === k ? v.bg : "white", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontSize: 12, fontWeight: 600, color: task.status === k ? v.color : T.text, textAlign: "left" }}
            onMouseEnter={e => e.currentTarget.style.background = v.bg}
            onMouseLeave={e => e.currentTarget.style.background = task.status === k ? v.bg : "white"}>
            <Icon size={13} />{v.label}
            {task.status === k && <span style={{ marginLeft: "auto", fontSize: 10, color: v.color }}>✓ current</span>}
          </button>
        );
      })}
    </div>
  );
};

// ── Task Detail Modal ─────────────────────────────────────────────────────────
const TaskDetailModal = ({ task, onClose, onStatusChange }) => {
  const [tab,     setTab]     = useState("details");
  const [confirm, setConfirm] = useState(null);
  const backdropRef = useRef(null);

  if (!task) return null;

  const InfoRow = ({ icon: Icon, label, value }) => {
    if (value === null || value === undefined || value === "") return null;
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "9px 0", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: T.amberLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={14} color={T.amber} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: T.muted, fontWeight: 500, marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{value}</div>
        </div>
      </div>
    );
  };

  const TABS = [
    { id: "details",  label: "Details",  icon: FileText  },
    { id: "location", label: "Location", icon: MapPin    },
    { id: "payment",  label: "Payment",  icon: DollarSign},
  ];

  return (
    <>
      <div ref={backdropRef} onClick={e => { if (e.target === backdropRef.current) onClose(); }}
        style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 28, width: 580, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 60px rgba(0,0,0,0.25)" }}>

          {/* Header */}
          <div style={{ background: T.amber, padding: "24px 28px 0", position: "relative", flexShrink: 0, borderRadius: "28px 28px 0 0" }}>
            <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
              <X size={18} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 20 }}>
              <Avatar task={task} size={64} fontSize={22} />
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 600, marginBottom: 4 }}>{shortId(task.id)}</div>
                <h2 style={{ color: "white", margin: "0 0 8px", fontSize: 20, fontWeight: 700 }}>{task.selectedService || task.taskType}</h2>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <StatusPill cfg={STATUS_CFG}  value={task.status} />
                  <StatusPill cfg={PAYMENT_CFG} value={task.payment_status} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 2 }}>
              {TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setTab(id)}
                  style={{ padding: "8px 16px", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: tab === id ? "white" : "transparent", color: tab === id ? T.amber : "rgba(255,255,255,0.75)", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s" }}>
                  <Icon size={13} />{label}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: 20, background: T.bg, borderRadius: "0 0 28px 28px", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Status changer */}
            <div style={{ background: "white", borderRadius: 16, padding: 18, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 12 }}>Update Status</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(STATUS_CFG).map(([k, v]) => {
                  const Icon = v.icon;
                  const active = task.status === k;
                  return (
                    <button key={k} onClick={() => setConfirm({ message: `Change status to "${v.label}"?`, action: () => onStatusChange(task.id, k) })}
                      style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${active ? v.border : T.border}`, background: active ? v.bg : "white", color: active ? v.color : T.muted, cursor: "pointer", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5, transition: "all 0.15s" }}>
                      <Icon size={11} />{v.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {tab === "details" && (
              <>
                <div style={{ background: "white", borderRadius: 16, padding: 18, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 11, color: T.amber, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 12 }}>Service Details</div>
                  <InfoRow icon={FileText}    label="Service"     value={task.selectedService || task.taskType} />
                  <InfoRow icon={Info}        label="Description" value={task.taskDescrip} />
                  <InfoRow icon={FileText}    label="Note"        value={task.note} />
                  {task.taskImg?.length > 0 && <InfoRow icon={ImageIcon} label="Photos" value={`${task.taskImg.length} image(s)`} />}
                </div>
                <div style={{ background: "white", borderRadius: 16, padding: 18, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 11, color: T.amber, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 12 }}>Scheduling</div>
                  <InfoRow icon={Calendar}     label="Service Date"      value={fmt(task.serviceDate)} />
                  <InfoRow icon={Clock}        label="Service Time"       value={task.serviceTIme || task.serviceTime} />
                  <InfoRow icon={CalendarClock}label="Booked On"         value={fmtDateTime(task.createdAt)} />
                  <InfoRow icon={Clock}        label="Completion Time"    value={task.completionTime ? `${task.completionTime} hr` : null} />
                  <InfoRow icon={CheckCircle2} label="Worker Done At"     value={task.worker_done_at ? fmtDateTime(task.worker_done_at) : null} />
                  <InfoRow icon={CheckCircle}  label="Paid At"            value={task.paid_at ? fmtDateTime(task.paid_at) : null} />
                </div>
              </>
            )}

            {tab === "location" && (
              <div style={{ background: "white", borderRadius: 16, padding: 18, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, color: T.amber, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 12 }}>Location</div>
                <InfoRow icon={MapPin} label="Address" value={task.address} />
                {task.lat && task.lng && (
                  <>
                    <InfoRow icon={Map} label="Coordinates" value={`${parseFloat(task.lat).toFixed(4)}, ${parseFloat(task.lng).toFixed(4)}`} />
                    <div style={{ marginTop: 14 }}>
                      <a href={`https://www.google.com/maps?q=${task.lat},${task.lng}`} target="_blank" rel="noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", background: T.amberLight, color: T.amber, borderRadius: 12, textDecoration: "none", fontSize: 13, fontWeight: 600, border: `1px solid ${T.amberBorder}` }}>
                        <MapPin size={14} /> View on Google Maps
                      </a>
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === "payment" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { label: "Base Price",  value: `NPR ${task.basePrice || 0}` },
                    { label: "Total Cost",  value: `NPR ${task.totalCost || 0}`, accent: true },
                    ...(task.additionalCost > 0 ? [{ label: "Additional", value: `NPR ${task.additionalCost}` }] : []),
                    ...(task.final_price ? [{ label: "Final Price", value: `NPR ${task.final_price}`, accent: true }] : []),
                  ].map((item, i) => (
                    <div key={i} style={{ background: item.accent ? T.amberLight : "white", borderRadius: 14, padding: "14px 16px", border: `1px solid ${item.accent ? T.amberBorder : T.border}`, textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{item.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: item.accent ? T.amber : T.text }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: "white", borderRadius: 16, padding: 18, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 11, color: T.amber, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 12 }}>Payment Info</div>
                  <InfoRow icon={CreditCard}  label="Method"         value={task.payment_method?.toUpperCase()} />
                  <InfoRow icon={AlertCircle} label="Payment Status" value={<StatusPill cfg={PAYMENT_CFG} value={task.payment_status} size="sm" />} />
                  <div style={{ marginTop: 14, padding: "12px 14px", background: T.amberLight, borderRadius: 12, border: `1px solid ${T.amberBorder}`, display: "flex", alignItems: "center", gap: 10 }}>
                    {ESCROW_CFG[task.escrow_status] && React.createElement(ESCROW_CFG[task.escrow_status].icon, { size: 16, color: ESCROW_CFG[task.escrow_status].color })}
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, fontWeight: 500 }}>Escrow Status</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: ESCROW_CFG[task.escrow_status]?.color || T.muted }}>{ESCROW_CFG[task.escrow_status]?.label || task.escrow_status || "—"}</div>
                    </div>
                    {task.esewa_ref_id && (
                      <div style={{ marginLeft: "auto", fontSize: 11, color: T.muted }}>Ref: <code style={{ background: "white", padding: "1px 6px", borderRadius: 4 }}>{task.esewa_ref_id.slice(-8)}</code></div>
                    )}
                  </div>
                </div>

                <div style={{ background: "white", borderRadius: 16, padding: 18, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 11, color: T.amber, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 12 }}>Parties</div>
                  <InfoRow icon={User} label="Customer ID" value={<code style={{ background: T.grayLight, padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>{task.userId}</code>} />
                  <InfoRow icon={User} label="Worker"      value={task.assignedWorkerId || <span style={{ color: T.muted }}>Unassigned</span>} />
                  <InfoRow icon={Info} label="Offer Status" value={task.offerStatus} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {confirm && <ConfirmDialog message={confirm.message} onConfirm={() => { confirm.action(); setConfirm(null); }} onCancel={() => setConfirm(null)} />}
    </>
  );
};

// ── Table header / cell styles ────────────────────────────────────────────────
const TH = { padding: "11px 16px", textAlign: "left", fontWeight: 700, color: T.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.7px", background: T.grayLight, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" };
const TD = { padding: "14px 16px", color: T.text, fontSize: 13 };

// ── Task Row ──────────────────────────────────────────────────────────────────
const TaskRow = ({ task, onSelect, onStatusChange, setConfirm }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleAction = (action) => {
    if (action === "view") { onSelect(task); return; }
    if (action.startsWith("status_")) {
      const s = action.replace("status_", "");
      setConfirm({ type: "status", message: `Change status to "${STATUS_CFG[s]?.label}"?`, taskId: task.id, newStatus: s });
    }
  };

  return (
    <tr style={{ borderBottom: `1px solid ${T.border}`, cursor: "pointer", transition: "background 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.background = T.grayLight}
      onMouseLeave={e => e.currentTarget.style.background = T.surface}
      onClick={() => onSelect(task)}>

      <td style={{ ...TD, fontWeight: 700 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar task={task} size={38} fontSize={14} />
          <div>
            <div style={{ fontSize: 11, color: T.amber, fontWeight: 700, marginBottom: 2 }}>{shortId(task.id)}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 1 }}>{task.selectedService || task.taskType}</div>
            <div style={{ fontSize: 11, color: T.muted }}>{fmtDateTime(task.createdAt)}</div>
          </div>
        </div>
      </td>

      <td style={TD}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{fmt(task.serviceDate)}</div>
        <div style={{ fontSize: 11, color: T.muted }}>{task.serviceTIme || task.serviceTime || "—"}</div>
      </td>

      <td style={{ ...TD, maxWidth: 200 }}>
        <div style={{ fontSize: 12, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }} title={task.address}>{task.address || "—"}</div>
        {task.assignedWorkerId
          ? <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{task.assignedWorkerId}</div>
          : <span style={{ fontSize: 10, color: T.amber, background: T.amberLight, padding: "1px 7px", borderRadius: 999, display: "inline-block", marginTop: 2, fontWeight: 600 }}>Unassigned</span>
        }
      </td>

      <td style={TD}>
        <div style={{ fontWeight: 800, color: T.green, fontSize: 15 }}>NPR {(task.final_price || task.totalCost || 0).toLocaleString()}</div>
        {task.additionalCost > 0 && <div style={{ fontSize: 10, color: T.muted }}>+NPR {task.additionalCost} extra</div>}
      </td>

      <td style={TD}><StatusPill cfg={PAYMENT_CFG} value={task.payment_status} /></td>
      <td style={TD}><StatusPill cfg={STATUS_CFG}  value={task.status} /></td>

      <td style={{ ...TD, whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
        <div style={{ position: "relative", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => setMenuOpen(v => !v)}
            style={{ padding: 7, borderRadius: 9, border: `1px solid ${T.border}`, background: "white", cursor: "pointer", color: T.muted, display: "flex", alignItems: "center" }}
            onMouseEnter={e => e.currentTarget.style.background = T.grayLight}
            onMouseLeave={e => e.currentTarget.style.background = "white"}>
            <MoreVertical size={15} />
          </button>
          {menuOpen && <ContextMenu task={task} onAction={handleAction} onClose={() => setMenuOpen(false)} />}
        </div>
      </td>
    </tr>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TaskManagement() {
  const [tasks,         setTasks]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [selected,      setSelected]      = useState(null);
  const [toast,         setToast]         = useState(null);
  const [showFilters,   setShowFilters]   = useState(false);
  const [confirm,       setConfirm]       = useState(null);
  const [currentPage,   setPage]          = useState(1);
  const PAGE_SIZE = 50;

  const showToast = (msg, type = "success") => setToast({ msg, type });

  const loadTasks = async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchAllTasks();
      setTasks(Array.isArray(data) ? data : data.tasks ?? []);
    } catch (err) {
      setError(err.message || "Failed to load tasks");
      showToast(err.message, "error");
    } finally { setLoading(false); }
  };

  useEffect(() => { loadTasks(); }, []);

  const onStatusChange = async (id, newStatus) => {
    try {
      await patchTaskStatus(id, newStatus);
      setTasks(prev => prev.map(t => t._id === id ? { ...t, status: newStatus } : t));
      if (selected?._id === id) setSelected(prev => ({ ...prev, status: newStatus }));
      showToast(`Status → ${STATUS_CFG[newStatus]?.label}`);
    } catch (err) { showToast(`Failed: ${err.message}`, "error"); }
  };

  const handleConfirm = async () => {
    const { taskId, newStatus } = confirm; setConfirm(null);
    await onStatusChange(taskId, newStatus);
  };

  const filtered = tasks.filter(t => {
    if (search) {
      const q = search.toLowerCase();
      if (![ t.selectedService, t.taskType, t.address, t.assignedWorkerId, t.userId, t._id ]
        .some(v => v?.toLowerCase().includes(q))) return false;
    }
    if (filterStatus  !== "all" && t.status         !== filterStatus)  return false;
    if (filterPayment !== "all" && t.payment_status !== filterPayment) return false;
    return true;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const stats = {
    total:       tasks.length,
    pending:     tasks.filter(t => t.status === "pending").length,
    active:      tasks.filter(t => ["assigned","in_progress","worker_done"].includes(t.status)).length,
    completed:   tasks.filter(t => ["completed","paid"].includes(t.status)).length,
    revenue:     tasks.filter(t => t.payment_status === "paid").reduce((s, t) => s + (t.totalCost || 0), 0),
    escrowHeld:  tasks.filter(t => t.escrow_status === "held").reduce((s, t) => s + (t.totalCost || 0), 0),
  };

  const totalPages    = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated     = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageBtn = (disabled) => ({ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: disabled ? T.grayLight : "white", color: disabled ? T.muted : T.text, cursor: disabled ? "default" : "pointer", fontSize: 13, fontWeight: 500 });

  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ minHeight: "89vh", background: T.bg, fontFamily: '"DM Sans", -apple-system, sans-serif', padding: "clamp(12px,4vw,2rem)" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: T.amber, margin: "0 0 6px" }}>Task Bookings</h1>
              <p style={{ color: T.muted, margin: 0, fontSize: 13 }}>Manage service bookings, update statuses and track payments</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowFilters(v => !v)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 12, border: `1px solid ${T.border}`, background: showFilters ? T.amberLight : "white", color: showFilters ? T.amber : T.text, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                <Filter size={14} /> Filters
                <ChevronDown size={14} style={{ transform: showFilters ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </button>
              <button onClick={loadTasks} disabled={loading}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 12, border: `1px solid ${T.border}`, background: "white", color: loading ? T.muted : T.text, fontWeight: 600, fontSize: 13, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? <Spinner size={14} /> : <RefreshCw size={14} />}
                {loading ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <StatCard label="Total"     value={loading ? "—" : stats.total}                                                    accent={T.amber}  icon={FileText}    />
            <StatCard label="Pending"   value={loading ? "—" : stats.pending}   sub="Awaiting worker"                          accent={T.yellow} icon={Clock}       />
            <StatCard label="Active"    value={loading ? "—" : stats.active}                                                   accent={T.blue}   icon={UserCheck}   />
            <StatCard label="Completed" value={loading ? "—" : stats.completed}                                                accent={T.green}  icon={CheckCircle} />
            <StatCard label="Revenue"   value={loading ? "—" : `NPR ${stats.revenue.toLocaleString()}`}                        accent={T.green}  icon={DollarSign}  />
            <StatCard label="Escrow"    value={loading ? "—" : `NPR ${stats.escrowHeld.toLocaleString()}`} sub="Pending release" accent={T.amber}  icon={Lock}        />
          </div>

          {/* Search + filter bar */}
          <div style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.border}`, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 1, position: "relative", minWidth: 240 }}>
              <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.muted }} />
              <input type="text" placeholder="Search by service, worker, address or ID…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{ width: "100%", padding: "9px 12px 9px 38px", borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 13, outline: "none", background: T.grayLight, color: T.text, boxSizing: "border-box" }}
                onFocus={e => { e.target.style.borderColor = T.amber; e.target.style.background = "white"; }}
                onBlur={e  => { e.target.style.borderColor = T.border; e.target.style.background = T.grayLight; }}
              />
            </div>
            {showFilters && (
              <>
                <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                  style={{ padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 13, background: T.grayLight, color: T.text, cursor: "pointer", outline: "none" }}>
                  <option value="all">All Status</option>
                  {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={filterPayment} onChange={e => { setFilterPayment(e.target.value); setPage(1); }}
                  style={{ padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 13, background: T.grayLight, color: T.text, cursor: "pointer", outline: "none" }}>
                  <option value="all">All Payments</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </>
            )}
            {(search || filterStatus !== "all" || filterPayment !== "all") && (
              <button onClick={() => { setSearch(""); setFilterStatus("all"); setFilterPayment("all"); setPage(1); }}
                style={{ padding: "9px 14px", borderRadius: 10, border: `1px solid ${T.border}`, background: "white", color: T.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <X size={12} /> Clear
              </button>
            )}
            <div style={{ fontSize: 12, color: T.muted, marginLeft: "auto", whiteSpace: "nowrap" }}>
              {filtered.length} of {tasks.length} bookings
            </div>
          </div>

          {/* Table */}
          <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, overflowX: "auto" }}>
            {loading ? (
              <div style={{ padding: 80, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <Spinner size={36} /><p style={{ color: T.muted, margin: 0, fontSize: 14, fontWeight: 600 }}>Loading bookings…</p>
              </div>
            ) : error ? (
              <div style={{ padding: 80, textAlign: "center" }}>
                <AlertTriangle size={40} style={{ color: T.red, marginBottom: 16 }} />
                <p style={{ color: T.red, margin: 0, fontWeight: 600 }}>{error}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 80, textAlign: "center" }}>
                <FileText size={48} style={{ color: T.muted, marginBottom: 16 }} />
                <h3 style={{ margin: "0 0 8px", color: T.text }}>No bookings found</h3>
                <p style={{ color: T.muted, margin: 0, fontSize: 13 }}>Try adjusting your search or filters</p>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                <thead>
                  <tr>{["Booking", "Schedule", "Location / Worker", "Amount", "Payment", "Status", ""].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {paginated.map(task => (
                    <TaskRow key={task.id} task={task} onSelect={setSelected} onStatusChange={onStatusChange} setConfirm={setConfirm} />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {!loading && !error && filtered.length > PAGE_SIZE && (
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 12, color: T.muted }}>
                Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => setPage(p => p - 1)} disabled={currentPage === 1} style={pageBtn(currentPage === 1)}>‹ Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce((acc, p, i, arr) => { if (i > 0 && p - arr[i-1] > 1) acc.push("…"); acc.push(p); return acc; }, [])
                  .map((p, i) => p === "…" ? (
                    <span key={`d${i}`} style={{ padding: "6px 4px", fontSize: 13, color: T.muted }}>…</span>
                  ) : (
                    <button key={p} onClick={() => setPage(p)} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: currentPage === p ? T.amber : "white", color: currentPage === p ? "white" : T.text, cursor: "pointer", fontSize: 13, fontWeight: currentPage === p ? 700 : 500 }}>{p}</button>
                  ))}
                <button onClick={() => setPage(p => p + 1)} disabled={currentPage >= totalPages} style={pageBtn(currentPage >= totalPages)}>Next ›</button>
              </div>
            </div>
          )}

        </div>
      </div>

      {confirm && <ConfirmDialog message={confirm.message} danger={confirm.newStatus === "cancelled"} onConfirm={handleConfirm} onCancel={() => setConfirm(null)} />}
      {selected && <TaskDetailModal task={selected} onClose={() => setSelected(null)} onStatusChange={onStatusChange} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        button { transition: all 0.15s ease; }
        button:active { transform: scale(0.97); }
      `}</style>
    </>
  );
}