import React, { useEffect, useState, useRef } from "react";
import {
  Search, Filter, ChevronDown, X, AlertTriangle, CheckCircle,
  XCircle, Clock, Trash2, Eye, User, Briefcase,
  RefreshCw, Flag, Brain, FileText, Calendar,
  MoreVertical, Ban, AlertCircle, AlertOctagon,
  HelpCircle, Check, DollarSign, TrendingDown,
  ArrowLeftRight, Receipt, Wallet, CreditCard,
  Hash, Link2, ChevronRight, Info, Shield,
  ThumbsUp, ThumbsDown, Undo2, RotateCcw
} from "lucide-react";
import BookingNavbar from "../../components/NavBar/NavBar";

const BASE = "http://localhost:8000/api";

// ── Design tokens (identical to ReportManagement) ──────────────────────────
const O = {
  header: "#fba452",
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
  teal:        "#2E9E8E",
  tealLight:   "#2E9E8E18",
};

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (d) => {
  try { return d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"; }
  catch { return "—"; }
};
const fmtTime = (d) => {
  try { return d ? new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : ""; }
  catch { return ""; }
};
const shortId  = (id) => id ? `#${id.slice(-6).toUpperCase()}` : "—";
const fmtNPR   = (n)  => n != null ? `NPR ${Number(n).toLocaleString()}` : "—";

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

// ── Avatar ──────────────────────────────────────────────────────────────────
const Avatar = ({ type, size = 38 }) => {
  const Icon  = type === "worker" ? Briefcase : User;
  const color = type === "worker" ? C.blue    : C.purple;
  const bg    = type === "worker" ? C.blueLight : C.purpleLight;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "2px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      <Icon size={size * 0.5} />
    </div>
  );
};

// ── Badges ──────────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    pending:  { color: C.brand, icon: Clock,        label: "Pending"  },
    approved: { color: C.green, icon: CheckCircle,  label: "Approved" },
    rejected: { color: C.red,   icon: XCircle,      label: "Rejected" },
  };
  const c    = map[status] ?? map.pending;
  const Icon = c.icon;
  return (
    <span style={{ background: "white", color: c.color, borderRadius: 100, padding: "4px 10px 4px 8px", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", border: `1px solid ${c.color}30` }}>
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

const AmountBadge = ({ amount }) => (
  <span style={{ background: C.tealLight, color: C.teal, borderRadius: 100, padding: "4px 10px 4px 8px", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", border: `1px solid ${C.teal}25` }}>
    <Wallet size={12} />{fmtNPR(amount)}
  </span>
);

// ── Toast ───────────────────────────────────────────────────────────────────
const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const bg   = type === "error" ? C.red : type === "warning" ? C.brand : C.green;
  const Icon = type === "error" ? XCircle : type === "warning" ? AlertTriangle : CheckCircle;
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 99999, background: bg, color: "white", padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 500, boxShadow: "0 10px 25px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: 8, maxWidth: 320, animation: "slideUp 0.2s ease" }}>
      <Icon size={18} />{message}
    </div>
  );
};

// ── Confirm Dialog ──────────────────────────────────────────────────────────
const ConfirmDialog = ({ message, onConfirm, onCancel, danger = false }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(28,20,16,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.2s ease" }}>
    <div style={{ background: C.surface, borderRadius: 24, padding: 28, width: 380, boxShadow: "0 25px 50px rgba(0,0,0,0.3)", animation: "scaleIn 0.2s ease" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: danger ? C.redLight : C.brandLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <AlertTriangle size={24} color={danger ? C.red : C.brand} />
      </div>
      <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: C.textPrimary }}>Confirm Action</h3>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: C.textSecond, lineHeight: 1.5 }}>{message}</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button onClick={onCancel}  style={{ padding: "10px 20px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", fontSize: 14, color: C.textSecond, fontFamily: "inherit" }}>Cancel</button>
        <button onClick={onConfirm} style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: danger ? C.red : C.green, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "white", fontFamily: "inherit" }}>Confirm</button>
      </div>
    </div>
  </div>
);

// ── Context Menu ─────────────────────────────────────────────────────────────
const ContextMenu = ({ refund, onAction, onClose }) => {
  const menuRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const actions = [
    { label: "View Details", icon: Eye,         action: "view",   color: C.blue  },
    ...(refund.status === "pending" ? [
      { label: "Approve",    icon: CheckCircle, action: "approve", color: C.green },
      { label: "Reject",     icon: XCircle,     action: "reject",  color: C.red   },
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

// ── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, color, icon: Icon, sub }) => (
  <div style={{ background: C.surface, borderRadius: 16, padding: 20, border: `1px solid ${color}25` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
      <div style={{ fontSize: 13, color, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={18} color={color} />
      </div>
    </div>
    <div style={{ fontSize: 28, fontWeight: 700, color: C.textPrimary, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>{sub}</div>}
  </div>
);

// ── Create Refund Modal (used from Report Detail) ────────────────────────────
export const CreateRefundModal = ({ report, onClose, onCreated }) => {
  const [amount,      setAmount]      = useState("");
  const [reason,      setReason]      = useState("");
  const [requestedBy, setRequestedBy] = useState("customer");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const backdropRef = useRef(null);

  const REASONS = [
    "Job not completed",
    "Worker no-show",
    "Poor quality work",
    "Fraud / Scam",
    "Duplicate payment",
    "Service not as described",
    "Other",
  ];

  const handleSubmit = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError("Please enter a valid refund amount.");
      return;
    }
    if (!reason) {
      setError("Please select a reason.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiCall(`${BASE}/refunds`, {
        method: "POST",
        body: JSON.stringify({
          reportId:    report.id,
          amount:      Number(amount),
          reason,
          requestedBy,
          requesterId: report.reporterId,
          reportedId:  report.reportedId,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }
      const data = await res.json();
      onCreated?.(data);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={backdropRef} onClick={e => { if (e.target === backdropRef.current) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 10001, background: "rgba(28,20,16,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "fadeIn 0.2s ease" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: C.surface, borderRadius: 24, width: 480, boxShadow: "0 25px 60px rgba(0,0,0,0.3)", animation: "scaleIn 0.2s ease", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${C.teal} 0%, ${C.teal}cc 100%)`, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RotateCcw size={20} color="white" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "white" }}>Request Refund</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>Linked to Report {shortId(report.id)}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Report link info */}
          <div style={{ background: C.tealLight, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, border: `1px solid ${C.teal}25` }}>
            <Link2 size={15} color={C.teal} />
            <div style={{ fontSize: 13, color: C.teal, fontWeight: 500 }}>
              This refund will be linked to report <strong>{shortId(report.id)}</strong> — <span style={{ textTransform: "capitalize" }}>{report.reason}</span>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>Refund Amount (NPR)</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 600, color: C.textMuted }}>NPR</span>
              <input
                type="number" min="1" placeholder="0"
                value={amount} onChange={e => setAmount(e.target.value)}
                style={{ width: "100%", padding: "12px 14px 12px 52px", borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 15, fontWeight: 600, outline: "none", background: C.bg, boxSizing: "border-box", color: C.textPrimary, fontFamily: "inherit" }}
                onFocus={e => { e.target.style.borderColor = C.teal; e.target.style.background = C.surface; }}
                onBlur={e  => { e.target.style.borderColor = C.border; e.target.style.background = C.bg; }}
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>Reason</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {REASONS.map(r => (
                <button key={r} onClick={() => setReason(r)}
                  style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${reason === r ? C.teal + "60" : C.border}`, background: reason === r ? C.tealLight : C.bg, color: reason === r ? C.teal : C.textSecond, fontSize: 12, fontWeight: reason === r ? 600 : 500, cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit" }}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Requested by */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>Requested By</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["customer", "worker", "admin"].map(role => (
                <button key={role} onClick={() => setRequestedBy(role)}
                  style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${requestedBy === role ? C.brand + "60" : C.border}`, background: requestedBy === role ? C.brandLight : C.bg, color: requestedBy === role ? C.brand : C.textSecond, fontSize: 12, fontWeight: requestedBy === role ? 600 : 500, cursor: "pointer", textTransform: "capitalize", transition: "all 0.15s", fontFamily: "inherit" }}>
                  {role}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ background: C.redLight, border: `1px solid ${C.red}30`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: C.red, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={15} />{error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", fontSize: 14, color: C.textSecond, fontFamily: "inherit" }}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={loading}
              style={{ flex: 2, padding: "12px", borderRadius: 12, border: "none", background: loading ? C.teal + "80" : C.teal, cursor: loading ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, color: "white", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {loading ? <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Submitting…</> : <><RotateCcw size={16} /> Submit Refund Request</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Refund Detail Modal ───────────────────────────────────────────────────────
const RefundDetailModal = ({ refund, onClose, onApprove, onReject, onDelete }) => {
  const [adminNote, setAdminNote] = useState(refund.adminNote || "");
  const [confirm,   setConfirm]   = useState(null);
  const backdropRef = useRef(null);

  const DetailRow = ({ icon: Icon, label, value, valueColor }) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.divider}` }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={14} color={C.textSecond} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, color: valueColor || C.textPrimary, fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  );

  return (
    <>
      <div ref={backdropRef} onClick={e => { if (e.target === backdropRef.current) onClose(); }}
        style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(28,20,16,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div onClick={e => e.stopPropagation()}
          style={{ background: C.surface, borderRadius: 28, width: 680, maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 60px rgba(0,0,0,0.3)", animation: "scaleIn 0.2s ease", overflow: "hidden" }}>

          {/* Header */}
          <div style={{ background: `linear-gradient(135deg, ${C.teal} 0%, ${C.teal}cc 100%)`, padding: "20px 28px 16px", flexShrink: 0, position: "relative" }}>
            <button onClick={onClose} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
              <X size={16} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <RotateCcw size={22} color="white" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 600, marginBottom: 4 }}>{shortId(refund.id)}</div>
                <h2 style={{ color: "white", margin: 0, fontSize: 20, fontWeight: 700 }}>Refund Details</h2>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <StatusBadge status={refund.status} />
              <AmountBadge amount={refund.amount} />
              {refund.reportId && (
                <span style={{ background: "rgba(255,255,255,0.15)", color: "white", borderRadius: 100, padding: "4px 10px 4px 8px", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Link2 size={12} />Report {shortId(refund.reportId)}
                </span>
              )}
            </div>
          </div>

          {/* Action strip */}
          {refund.status === "pending" && (
            <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}`, background: C.bg, display: "flex", gap: 10, flexShrink: 0 }}>
              <button onClick={() => setConfirm({ type: "approve", message: `Approve this refund of ${fmtNPR(refund.amount)}? This will initiate the refund process.` })}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: C.green, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
                <ThumbsUp size={16} /> Approve Refund
              </button>
              <button onClick={() => setConfirm({ type: "reject", message: "Reject this refund request?", danger: true })}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: C.red, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
                <ThumbsDown size={16} /> Reject
              </button>
              <button onClick={() => setConfirm({ type: "delete", message: "Permanently delete this refund request? This cannot be undone.", danger: true })}
                style={{ padding: "10px 14px", borderRadius: 10, background: C.redLight, color: C.red, border: `1px solid ${C.red}30`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Trash2 size={16} />
              </button>
            </div>
          )}

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px", background: C.bg }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Amount highlight */}
              <div style={{ background: C.tealLight, borderRadius: 16, padding: 20, border: `1px solid ${C.teal}25`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 11, color: C.teal, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Refund Amount</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: C.teal }}>{fmtNPR(refund.amount)}</div>
                </div>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: C.teal + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Wallet size={28} color={C.teal} />
                </div>
              </div>

              {/* Parties */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  { label: "Requester",  id: refund.requesterId, type: refund.requesterType ?? "customer" },
                  { label: "Refund To",  id: refund.reportedId,  type: refund.reportedType  ?? "worker"   },
                ].map(({ label, id, type }) => (
                  <div key={label} style={{ background: C.surface, borderRadius: 16, padding: 18, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>{label}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar type={type} size={40} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>{shortId(id)}</div>
                        <TypeBadge type={type} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Details */}
              <div style={{ background: C.surface, borderRadius: 16, padding: 18, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>Refund Information</div>
                <DetailRow icon={AlertCircle} label="Reason"       value={refund.reason       || "—"} />
                <DetailRow icon={User}        label="Requested By" value={refund.requestedBy  ? refund.requestedBy.charAt(0).toUpperCase() + refund.requestedBy.slice(1) : "—"} />
                <DetailRow icon={Link2}       label="Linked Report" value={refund.reportId ? shortId(refund.reportId) : "No linked report"} valueColor={refund.reportId ? C.teal : C.textMuted} />
                <DetailRow icon={Calendar}    label="Requested On" value={`${fmt(refund.createdAt)} at ${fmtTime(refund.createdAt)}`} />
                {refund.resolvedAt && <DetailRow icon={CheckCircle} label="Resolved On" value={`${fmt(refund.resolvedAt)} at ${fmtTime(refund.resolvedAt)}`} />}
              </div>

              {/* Admin note — editable if pending */}
              {refund.status === "pending" && (
                <div style={{ background: C.surface, borderRadius: 16, padding: 18, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>Admin Note (optional)</div>
                  <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)}
                    placeholder="Add a note about this decision..." rows={3}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", background: C.bg, color: C.textPrimary }}
                    onFocus={e => { e.target.style.borderColor = C.teal; e.target.style.background = C.surface; }}
                    onBlur={e  => { e.target.style.borderColor = C.border; e.target.style.background = C.bg; }}
                  />
                </div>
              )}

              {refund.adminNote && refund.status !== "pending" && (
                <div style={{ background: C.tealLight, borderRadius: 16, padding: 16, border: `1px solid ${C.teal}30` }}>
                  <div style={{ fontSize: 11, color: C.teal, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Admin Note</div>
                  <p style={{ margin: 0, fontSize: 13, color: C.textSecond }}>{refund.adminNote}</p>
                </div>
              )}

              {/* Delete for resolved/rejected */}
              {refund.status !== "pending" && (
                <button onClick={() => setConfirm({ type: "delete", message: "Permanently delete this refund record? This cannot be undone.", danger: true })}
                  style={{ padding: "12px", borderRadius: 12, border: `1px solid ${C.red}30`, background: C.redLight, color: C.red, fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}>
                  <Trash2 size={16} /> Delete Record
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          danger={confirm.danger}
          onConfirm={() => {
            if (confirm.type === "approve") onApprove(refund.id, adminNote);
            if (confirm.type === "reject")  onReject(refund.id, adminNote);
            if (confirm.type === "delete")  onDelete(refund.id);
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
};

// ── Refund Table Row ──────────────────────────────────────────────────────────
const RefundRow = ({ refund, onSelect, onApprove, onReject, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const handleAction = (action) => {
    if (action === "view")    onSelect(refund);
    if (action === "approve") onApprove(refund.id, "");
    if (action === "reject")  onReject(refund.id, "");
    if (action === "delete")  onDelete(refund.id);
  };
  return (
    <tr style={{ borderBottom: `1px solid ${C.divider}`, transition: "background 0.2s", cursor: "pointer" }}
      onClick={() => onSelect(refund)}
      onMouseEnter={e => e.currentTarget.style.background = C.bg}
      onMouseLeave={e => e.currentTarget.style.background = C.surface}
    >
      <td style={{ padding: "16px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, marginBottom: 2 }}>{shortId(refund.id)}</div>
        {refund.reportId && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: C.teal, fontWeight: 500 }}>
            <Link2 size={10} />Report {shortId(refund.reportId)}
          </div>
        )}
      </td>
      <td style={{ padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar type={refund.requesterType ?? "customer"} size={36} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>{shortId(refund.requesterId)}</div>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: "capitalize" }}>via {refund.requestedBy || "customer"}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: "16px" }}>
        <AmountBadge amount={refund.amount} />
      </td>
      <td style={{ padding: "16px" }}>
        <div style={{ fontSize: 13, color: C.textSecond, fontWeight: 500, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{refund.reason || "—"}</div>
      </td>
      <td style={{ padding: "16px" }}><StatusBadge status={refund.status} /></td>
      <td style={{ padding: "16px" }}>
        <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 500 }}>{fmt(refund.createdAt)}</div>
        <div style={{ fontSize: 11, color: C.textMuted }}>{fmtTime(refund.createdAt)}</div>
      </td>
      <td style={{ padding: "16px" }} onClick={e => e.stopPropagation()}>
        <div style={{ position: "relative", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => setMenuOpen(v => !v)}
            style={{ padding: "8px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", color: C.textMuted, display: "flex", alignItems: "center" }}
            onMouseEnter={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.textPrimary; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.surface; e.currentTarget.style.color = C.textMuted; }}
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && <ContextMenu refund={refund} onAction={handleAction} onClose={() => setMenuOpen(false)} />}
        </div>
      </td>
    </tr>
  );
};

// ── Main RefundManagement Component ──────────────────────────────────────────
export default function RefundManagement() {
  const [refunds,        setRefunds]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [stats,          setStats]          = useState({ total: 0, pending: 0, approved: 0, rejected: 0, totalAmount: 0, approvedAmount: 0 });
  const [searchQuery,    setSearch]         = useState("");
  const [filterStatus,   setFilterStatus]   = useState("all");
  const [showFilters,    setShowFilters]    = useState(false);
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [toast,          setToast]          = useState(null);
  const [confirm,        setConfirm]        = useState(null);
  const [currentPage,    setCurrentPage]    = useState(1);
  const [totalRefunds,   setTotalRefunds]   = useState(0);
  const PAGE_SIZE = 50;

  const isFirstRender = useRef(true);
  const showToast = (msg, type = "success") => setToast({ msg, type });

  const fetchPage = async (page, search = searchQuery) => {
    try {
      setLoading(true);
      const skip   = (page - 1) * PAGE_SIZE;
      const params = new URLSearchParams({ skip, limit: PAGE_SIZE });
      if (search?.trim())          params.append("search", search.trim());
      if (filterStatus !== "all") params.append("status", filterStatus);
      const res = await apiCall(`${BASE}/refunds?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRefunds(data.refunds ?? []);
      setTotalRefunds(data.total ?? 0);
      setCurrentPage(page);
    } catch (e) {
      setError(`Failed to load refunds: ${e.message}`);
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try { const res = await apiCall(`${BASE}/refunds/stats`); if (res.ok) setStats(await res.json()); }
    catch {}
  };

  useEffect(() => { fetchPage(1, ""); fetchStats(); }, []);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const t = setTimeout(() => fetchPage(1, searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);
  useEffect(() => {
    if (!isFirstRender.current) fetchPage(1, searchQuery);
  }, [filterStatus]);

  const handleApprove = async (refundId, adminNote) => {
    const res = await apiCall(`${BASE}/refunds/${refundId}/status`, { method: "PATCH", body: JSON.stringify({ status: "approved", adminNote }) });
    if (!res.ok) { showToast("Failed to approve", "error"); return; }
    setRefunds(prev => prev.map(r => r.id === refundId ? { ...r, status: "approved", adminNote } : r));
    if (selectedRefund?.id === refundId) setSelectedRefund(p => ({ ...p, status: "approved", adminNote }));
    setStats(p => ({ ...p, pending: p.pending - 1, approved: p.approved + 1 }));
    showToast("Refund approved ✓");
    fetchStats();
  };

  const handleReject = async (refundId, adminNote) => {
    const res = await apiCall(`${BASE}/refunds/${refundId}/status`, { method: "PATCH", body: JSON.stringify({ status: "rejected", adminNote }) });
    if (!res.ok) { showToast("Failed to reject", "error"); return; }
    setRefunds(prev => prev.map(r => r.id === refundId ? { ...r, status: "rejected", adminNote } : r));
    if (selectedRefund?.id === refundId) setSelectedRefund(p => ({ ...p, status: "rejected", adminNote }));
    setStats(p => ({ ...p, pending: p.pending - 1, rejected: p.rejected + 1 }));
    showToast("Refund rejected");
    fetchStats();
  };

  const handleDelete = async (refundId) => {
    setConfirm({
      message: "Permanently delete this refund record? This cannot be undone.",
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        const res = await apiCall(`${BASE}/refunds/${refundId}`, { method: "DELETE" });
        if (!res.ok) { showToast("Failed to delete", "error"); return; }
        setRefunds(prev => prev.filter(r => r.id !== refundId));
        setTotalRefunds(p => p - 1);
        if (selectedRefund?.id === refundId) setSelectedRefund(null);
        showToast("Refund deleted");
        fetchStats();
      },
    });
  };

  const totalPages = Math.ceil(totalRefunds / PAGE_SIZE);

  const Pill = ({ active, onClick, label }) => (
    <button onClick={onClick} style={{ padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12, border: `1px solid ${active ? C.teal + "50" : C.border}`, background: active ? C.tealLight : C.surface, color: active ? C.teal : C.textSecond, fontWeight: active ? 600 : 500, transition: "all 0.15s", fontFamily: "inherit" }}>{label}</button>
  );
  const pageBtn = (disabled) => ({ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: disabled ? C.bg : C.surface, color: disabled ? C.textMuted : C.textSecond, cursor: disabled ? "default" : "pointer", fontSize: 13, fontFamily: "inherit" });

  return (
    <><BookingNavbar />
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: C.bg, minHeight: "100vh", padding: 24 }}>
      {toast   && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {confirm && <ConfirmDialog message={confirm.message} danger={confirm.danger} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}

      <style>{`
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin    { to { transform: rotate(360deg); } }
      `}</style>

      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 700, color: C.textPrimary, letterSpacing: "-0.01em" }}>Refund Management</h1>
          <p style={{ margin: 0, fontSize: 14, color: C.textMuted }}>Review and process refund requests linked to reports</p>
        </div>
        <button onClick={() => { fetchPage(1, searchQuery); fetchStats(); }}
          style={{ padding: "10px 18px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", fontSize: 14, color: C.textSecond, display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}
          onMouseEnter={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.teal; }}
          onMouseLeave={e => { e.currentTarget.style.background = C.surface; e.currentTarget.style.color = C.textSecond; }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Stats — 6 cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, marginBottom: 24 }}>
        <StatCard label="Total"          value={stats.total}                                                         color={C.teal}   icon={Receipt}     />
        <StatCard label="Pending"         value={stats.pending}                                                       color={C.brand}  icon={Clock}        sub="Awaiting decision" />
        <StatCard label="Approved"        value={stats.approved}                                                      color={C.green}  icon={CheckCircle}  />
        <StatCard label="Rejected"        value={stats.rejected}                                                      color={C.red}    icon={XCircle}      />
        <StatCard label="Total Requested" value={`NPR ${Number(stats.totalAmount    ?? 0).toLocaleString()}`}         color={C.blue}   icon={Wallet}       />
        <StatCard label="Total Refunded"  value={`NPR ${Number(stats.approvedAmount ?? 0).toLocaleString()}`}         color={C.green}  icon={CreditCard}   sub="Approved refunds" />
      </div>

      {/* Search + Filters */}
      <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 2, position: "relative", minWidth: 280 }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted }} />
            <input type="text" placeholder="Search by ID, reason, report ID..."
              value={searchQuery} onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "10px 12px 10px 38px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, outline: "none", background: C.bg, boxSizing: "border-box", color: C.textPrimary, fontFamily: "inherit" }}
              onFocus={e => { e.target.style.borderColor = C.teal; e.target.style.background = C.surface; }}
              onBlur={e  => { e.target.style.borderColor = C.border; e.target.style.background = C.bg; }}
            />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Pill active={filterStatus === "all"}      onClick={() => setFilterStatus("all")}      label="All"      />
            <Pill active={filterStatus === "pending"}  onClick={() => setFilterStatus("pending")}  label="Pending"  />
            <Pill active={filterStatus === "approved"} onClick={() => setFilterStatus("approved")} label="Approved" />
            <Pill active={filterStatus === "rejected"} onClick={() => setFilterStatus("rejected")} label="Rejected" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: C.surface, borderRadius: 20, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
        {loading ? (
          <div style={{ padding: 80, textAlign: "center" }}>
            <RefreshCw size={40} style={{ color: C.teal, marginBottom: 16, animation: "spin 1s linear infinite" }} />
            <p style={{ color: C.textSecond, margin: 0, fontSize: 15 }}>Loading refunds...</p>
          </div>
        ) : error ? (
          <div style={{ padding: 80, textAlign: "center" }}>
            <AlertTriangle size={40} style={{ color: C.red, marginBottom: 16 }} />
            <p style={{ color: C.red, margin: 0, fontSize: 15 }}>{error}</p>
          </div>
        ) : refunds.length === 0 ? (
          <div style={{ padding: 80, textAlign: "center" }}>
            <RotateCcw size={48} style={{ color: C.textMuted, marginBottom: 16 }} />
            <h3 style={{ margin: "0 0 8px", color: C.textPrimary, fontSize: 18 }}>No refunds found</h3>
            <p style={{ color: C.textMuted, margin: 0, fontSize: 14 }}>
              {searchQuery || filterStatus !== "all" ? "Try adjusting your filters" : "No refund requests have been filed yet"}
            </p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `2px solid ${C.border}` }}>
                {["Refund ID", "Requester", "Amount", "Reason", "Status", "Date", ""].map((h, i) => (
                  <th key={h} style={{ padding: "14px 16px", textAlign: i === 6 ? "right" : "left", fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {refunds.map(refund => (
                <RefundRow key={refund.id} refund={refund} onSelect={setSelectedRefund} onApprove={handleApprove} onReject={handleReject} onDelete={handleDelete} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && totalRefunds > 0 && (
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>
            Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, totalRefunds)} of {totalRefunds} refunds
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => fetchPage(1, searchQuery)}              disabled={currentPage === 1}           style={pageBtn(currentPage === 1)}>«</button>
            <button onClick={() => fetchPage(currentPage - 1, searchQuery)} disabled={currentPage === 1}           style={pageBtn(currentPage === 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx - 1] > 1) acc.push("..."); acc.push(p); return acc; }, [])
              .map((p, i) => p === "..." ? (
                <span key={`d${i}`} style={{ padding: "6px 8px", fontSize: 13, color: C.textMuted }}>…</span>
              ) : (
                <button key={p} onClick={() => fetchPage(p, searchQuery)}
                  style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: currentPage === p ? C.textPrimary : C.surface, color: currentPage === p ? "white" : C.textSecond, cursor: "pointer", fontSize: 13, fontWeight: currentPage === p ? 700 : 500, fontFamily: "inherit" }}>{p}</button>
              ))}
            <button onClick={() => fetchPage(currentPage + 1, searchQuery)} disabled={currentPage >= totalPages} style={pageBtn(currentPage >= totalPages)}>›</button>
            <button onClick={() => fetchPage(totalPages, searchQuery)}      disabled={currentPage >= totalPages} style={pageBtn(currentPage >= totalPages)}>»</button>
          </div>
        </div>
      )}

      {selectedRefund && (
        <RefundDetailModal
          refund={selectedRefund}
          onClose={() => setSelectedRefund(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          onDelete={handleDelete}
        />
      )}
    </div>
    </>
  );
}