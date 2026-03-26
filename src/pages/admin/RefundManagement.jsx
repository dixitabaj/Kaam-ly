import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Search, X, AlertTriangle, CheckCircle, XCircle, Clock, Trash2,
  Eye, User, Briefcase, RefreshCw, RotateCcw, AlertCircle,
  MoreVertical, Link2, Wallet, CreditCard, Receipt, Calendar,
  ThumbsUp, ThumbsDown, ShieldAlert, Hash, Info, FileText,
  Shield, ChevronRight, Package, BarChart2, DollarSign, Activity
} from "lucide-react";
import BookingNavbar from "../../components/Navbar/Navbar";
const BASE = "http://localhost:8000/api";


// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  brand:        "#E8843A",  brandLight:   "#E8843A18",
  bg:           "#F7F5EF",  surface:      "#FFFFFF",
  border:       "#EDE8DF",  divider:      "#FAF7F2",
  textPrimary:  "#1C1410",  textSecond:   "#7A6E65",  textMuted: "#B0A89E",
  green:        "#3D9E6E",  greenLight:   "#3D9E6E18",
  red:          "#D94F3D",  redLight:     "#D94F3D15",
  blue:         "#3D7EC9",  blueLight:    "#3D7EC918",
  purple:       "#7C5CBF",  purpleLight:  "#7C5CBF18",
  teal:         "#2E9E8E",  tealLight:    "#2E9E8E18",
  amber:        "#B45309",  amberLight:   "#B4530915",
  dispute:      "#C2440C",  disputeLight: "#C2440C15", disputeMid: "#C2440C30",
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
const shortId = (id) => { if (!id) return "—"; return `#${String(id).slice(-6).toUpperCase()}`; };
const fmtNPR  = (n)  => (n != null ? `NPR ${Number(n).toLocaleString()}` : "—");

const isDisputeCharge = (r) =>
  r.is_dispute === true ||
  Number(r.disputeCharge ?? 0) > 0 ||
  (typeof r.reason === "string" && r.reason.toLowerCase().includes("dispute"));

const getToken = () =>
  localStorage.getItem("access_token") || localStorage.getItem("token") || "";

const apiCall = async (url, options = {}) => {
  const token = getToken();
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
};

// ── FIX: patchStatus — explicit field handling for approve vs decline ─────────
// - On "approved": always sends amount_customer (required) and amount_worker
// - On "declined": never sends amount fields (backend ignores them anyway)
// - Removed the fragile `!= null` check that could silently drop fields
const patchStatus = async (refundId, status, adminNote, amountCustomer, amountWorker) => {
  const token = getToken();
  const form  = new URLSearchParams();

  form.append("status",     status);
  form.append("admin_note", adminNote ?? "");

  if (status === "approved") {
    // amount_customer is required for approval — backend will 400 without it
    form.append("amount_customer", String(Number(amountCustomer) || 0));
    form.append("amount_worker",   String(Number(amountWorker)   || 0));
  }
  // For "declined" we intentionally omit amounts — backend doesn't use them

  return fetch(`${BASE}/update-status/${refundId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form.toString(),
  });
};

// ── Small shared UI ──────────────────────────────────────────────────────────
const Avatar = ({ type, size = 38 }) => {
  const Icon = type === "worker" ? Briefcase : User;
  const col  = type === "worker" ? C.blue    : C.purple;
  const bg   = type === "worker" ? C.blueLight : C.purpleLight;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color: col, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "2px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      <Icon size={size * 0.48} />
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    pending:  { color: C.brand,  icon: Clock,        label: "Pending"  },
    approved: { color: C.green,  icon: CheckCircle,  label: "Approved" },
    rejected: { color: C.red,    icon: XCircle,      label: "Rejected" },
    refunded: { color: C.green,  icon: CheckCircle,  label: "Refunded" },
    declined: { color: C.red,    icon: XCircle,      label: "Declined" },
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
  const isW  = type === "worker";
  const Icon = isW ? Briefcase : User;
  return (
    <span style={{ background: isW ? C.blueLight : C.purpleLight, color: isW ? C.blue : C.purple, borderRadius: 100, padding: "2px 8px", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Icon size={11} />{isW ? "Worker" : "Customer"}
    </span>
  );
};

const Chip = ({ label, color, icon: Icon }) => (
  <span style={{ background: `${color}15`, color, borderRadius: 100, padding: "3px 10px 3px 8px", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
    {Icon && <Icon size={11} />}{label}
  </span>
);

const AmountBadge = ({ amount, isDispute = false }) => (
  <span style={{ background: isDispute ? C.disputeLight : C.tealLight, color: isDispute ? C.dispute : C.teal, borderRadius: 100, padding: "4px 10px 4px 8px", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", border: `1px solid ${isDispute ? C.dispute : C.teal}25` }}>
    <Wallet size={12} />{fmtNPR(amount)}
  </span>
);

const DisputeBadge = () => (
  <span style={{ background: C.disputeLight, color: C.dispute, borderRadius: 100, padding: "4px 10px 4px 8px", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", border: `1px solid ${C.disputeMid}` }}>
    <ShieldAlert size={11} /> Dispute Charge
  </span>
);

// ── FIX: EsewaRefundStatus — shows real eSewa result from backend ────────────
const EsewaRefundStatus = ({ esewaRefund }) => {
  if (!esewaRefund) return null;
  const { status, transaction_uuid, esewa_id, error, note } = esewaRefund;

  if (status === "sent") {
    return (
      <div style={{ background: C.greenLight, borderRadius: 12, padding: "12px 16px", border: `1px solid ${C.green}30`, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle size={15} color={C.green} />
          <span style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>eSewa refund sent successfully</span>
        </div>
        {transaction_uuid && <span style={{ fontSize: 11, color: C.green, paddingLeft: 23 }}>Txn: {transaction_uuid}</span>}
        {esewa_id          && <span style={{ fontSize: 11, color: C.green, paddingLeft: 23 }}>To: {esewa_id}</span>}
      </div>
    );
  }
  if (status === "no_esewa_id") {
    return (
      <div style={{ background: C.amberLight, borderRadius: 12, padding: "12px 16px", border: `1px solid ${C.amber}30`, display: "flex", alignItems: "center", gap: 8 }}>
        <AlertTriangle size={15} color={C.amber} />
        <span style={{ fontSize: 13, color: C.amber }}>No eSewa ID on file — refund must be processed manually.</span>
      </div>
    );
  }
  if (status === "failed" || status === "error") {
    return (
      <div style={{ background: C.redLight, borderRadius: 12, padding: "12px 16px", border: `1px solid ${C.red}30`, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <XCircle size={15} color={C.red} />
          <span style={{ fontSize: 13, color: C.red, fontWeight: 600 }}>eSewa disbursement failed — process manually</span>
        </div>
        {error && <span style={{ fontSize: 11, color: C.red, paddingLeft: 23 }}>{error}</span>}
      </div>
    );
  }
  return null;
};

const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const bg   = type === "error" ? C.red : type === "warning" ? C.brand : C.green;
  const Icon = type === "error" ? XCircle : type === "warning" ? AlertTriangle : CheckCircle;
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 99999, background: bg, color: "white", padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 500, boxShadow: "0 10px 25px rgba(0,0,0,0.18)", display: "flex", alignItems: "center", gap: 8, maxWidth: 360, animation: "slideUp 0.2s ease" }}>
      <Icon size={18} />{message}
    </div>
  );
};

const ConfirmDialog = ({ message, onConfirm, onCancel, danger = false }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(28,20,16,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ background: C.surface, borderRadius: 24, padding: 28, width: 380, boxShadow: "0 25px 50px rgba(0,0,0,0.3)", animation: "scaleIn 0.18s ease" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: danger ? C.redLight : C.brandLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <AlertTriangle size={24} color={danger ? C.red : C.brand} />
      </div>
      <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: C.textPrimary }}>Confirm Action</h3>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: C.textSecond, lineHeight: 1.6 }}>{message}</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button onClick={onCancel}  style={{ padding: "10px 20px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", fontSize: 14, color: C.textSecond, fontFamily: "inherit" }}>Cancel</button>
        <button onClick={onConfirm} style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: danger ? C.red : C.green, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "white", fontFamily: "inherit" }}>Confirm</button>
      </div>
    </div>
  </div>
);

const StatCard = ({ label, value, color, icon: Icon, sub }) => (
  <div style={{ background: C.surface, borderRadius: 16, padding: 20, border: `1px solid ${color}25` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
      <div style={{ fontSize: 11, color, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={17} color={color} />
      </div>
    </div>
    <div style={{ fontSize: 24, fontWeight: 700, color: C.textPrimary, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>{sub}</div>}
  </div>
);

// ── Context Menu ─────────────────────────────────────────────────────────────
const ContextMenu = ({ refund, onAction, onClose }) => {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const isDispute = isDisputeCharge(refund);
  const isPending = refund.status === "pending";
  const actions = [
    { label: "View Details",     icon: Eye,         action: "view",    color: C.blue    },
    ...(isPending && !isDispute ? [
      { label: "Approve",        icon: CheckCircle, action: "approve", color: C.green   },
      { label: "Reject",         icon: XCircle,     action: "reject",  color: C.red     },
    ] : []),
    ...(isDispute && isPending ? [
      { label: "Waive Charge",   icon: Shield,      action: "waive",   color: C.green   },
      { label: "Enforce Charge", icon: ShieldAlert, action: "enforce", color: C.dispute },
    ] : []),
    { label: "Delete",           icon: Trash2,      action: "delete",  color: C.red     },
  ];

  return (
    <div ref={ref} style={{ position: "absolute", right: 0, top: "100%", zIndex: 100000, background: "white", borderRadius: 14, boxShadow: "0 10px 40px rgba(0,0,0,0.15)", border: `1px solid ${C.border}`, minWidth: 190, marginTop: 4, animation: "scaleIn 0.1s ease" }}>
      {actions.map(({ label, icon: Icon, action, color }) => (
        <button key={action} onClick={() => { onAction(action); onClose(); }}
          style={{ width: "100%", padding: "11px 16px", border: "none", background: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontSize: 13, fontWeight: 500, color, textAlign: "left", borderBottom: `1px solid ${C.divider}` }}
          onMouseEnter={e => e.currentTarget.style.background = C.bg}
          onMouseLeave={e => e.currentTarget.style.background = "white"}
        >
          <Icon size={15} />{label}
        </button>
      ))}
    </div>
  );
};

// ── Task Details Tab ──────────────────────────────────────────────────────────
const TaskDetailsTab = ({ refund }) => {
  const [task,    setTask]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const taskId = refund.task_id ?? refund.taskId;

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    apiCall(`${BASE}/task/${taskId}`)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(d  => setTask(d.task ?? d))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [taskId]);

  const KV = ({ label, value, color }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "9px 0", borderBottom: `1px solid ${C.divider}` }}>
      <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500, flexShrink: 0, marginRight: 16 }}>{label}</span>
      <span style={{ fontSize: 13, color: color ?? C.textPrimary, fontWeight: 600, textAlign: "right", wordBreak: "break-word", maxWidth: 260 }}>{value ?? "—"}</span>
    </div>
  );

  if (!taskId) return (
    <div style={{ padding: "56px 24px", textAlign: "center" }}>
      <Package size={40} style={{ color: C.textMuted, marginBottom: 12 }} />
      <div style={{ fontSize: 14, color: C.textMuted }}>No task is linked to this refund.</div>
    </div>
  );

  if (loading) return (
    <div style={{ padding: "56px 24px", textAlign: "center" }}>
      <RefreshCw size={28} style={{ color: C.teal, animation: "spin 1s linear infinite", marginBottom: 12 }} />
      <div style={{ fontSize: 13, color: C.textMuted }}>Loading task details…</div>
    </div>
  );

  if (error || !task) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {error && (
          <div style={{ background: C.amberLight, borderRadius: 12, padding: "12px 16px", border: `1px solid ${C.amber}30`, display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={15} color={C.amber} />
            <span style={{ fontSize: 13, color: C.amber }}>Task endpoint unavailable ({error}). Showing available data.</span>
          </div>
        )}
        <div style={{ background: C.surface, borderRadius: 14, padding: 18, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Known Task Data</div>
          <KV label="Task ID"   value={shortId(taskId)} />
          <KV label="Task Name" value={refund.task_name} />
        </div>
      </div>
    );
  }

  const totalCost   = Number(task.totalCost    ?? task.basePrice   ?? 0);
  const workerPay   = Number(task.worker_payout ?? 0);
  const platformFee = Number(task.platform_fee  ?? 0);
  const hasSplit    = workerPay > 0 || platformFee > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ background: C.tealLight, borderRadius: 14, padding: 18, border: `1px solid ${C.teal}25` }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, marginBottom: 8 }}>
              {task.taskName ?? task.taskDescrip ?? "Unnamed Task"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {task.taskStatus    && <Chip label={task.taskStatus}                    color={C.teal}   icon={Activity}    />}
              {task.escrow_status && <Chip label={`Escrow: ${task.escrow_status}`}    color={C.blue}   icon={Shield}      />}
              {task.payout_status && <Chip label={`Payout: ${task.payout_status}`}    color={task.payout_status === "paid" ? C.green : C.amber} icon={DollarSign} />}
              {task.payment_method && <Chip label={task.payment_method}               color={C.purple} />}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: C.teal, fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Total Cost</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.teal }}>{fmtNPR(totalCost)}</div>
          </div>
        </div>
      </div>

      {hasSplit && (
        <div style={{ background: C.surface, borderRadius: 14, padding: 18, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 14 }}>Payment Split</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              { label: "Customer Paid", value: totalCost,   color: C.blue,  icon: CreditCard },
              { label: "Worker Payout", value: workerPay,   color: C.green, icon: Briefcase  },
              { label: "Platform Fee",  value: platformFee, color: C.brand, icon: BarChart2  },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} style={{ background: `${color}0D`, borderRadius: 12, padding: "14px 16px", border: `1px solid ${color}20` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Icon size={13} color={color} />
                  <span style={{ fontSize: 11, color, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px" }}>{label}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color }}>{fmtNPR(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: C.surface, borderRadius: 14, padding: 18, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Task Information</div>
        <KV label="Task ID"        value={shortId(task._id ?? task.id)} />
        <KV label="Category"       value={task.taskCategory ?? task.category} />
        <KV label="Location"       value={task.location ?? task.address} />
        <KV label="eSewa Ref"      value={task.esewa_ref_id} />
        <KV label="Posted On"      value={`${fmt(task.createdAt ?? task.created_at)} ${fmtTime(task.createdAt ?? task.created_at)}`} />
        {task.completedAt && <KV label="Completed On" value={`${fmt(task.completedAt)} ${fmtTime(task.completedAt)}`} />}
        {task.released_at && <KV label="Released At"  value={`${fmt(task.released_at)} ${fmtTime(task.released_at)}`} />}
        {task.taskDescrip && task.taskName && (
          <div style={{ paddingTop: 10 }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 500, marginBottom: 6 }}>Description</div>
            <div style={{ fontSize: 13, color: C.textSecond, lineHeight: 1.6 }}>{task.taskDescrip}</div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {[
          { label: "Customer", id: task.userId,           type: "customer" },
          { label: "Worker",   id: task.assignedWorkerId, type: "worker"   },
        ].filter(p => p.id).map(({ label, id, type }) => (
          <div key={label} style={{ background: C.surface, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>{label}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar type={type} size={38} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 3 }}>
                  {typeof id === "string" && id.includes("@") ? id : shortId(id)}
                </div>
                <TypeBadge type={type} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Refund Detail Modal (tabbed) ───────────────────────────────────────────────
const RefundDetailModal = ({ refund, onClose, onApprove, onReject, onDelete, onWaive, onEnforce }) => {
  const [activeTab,  setActiveTab]  = useState("refund");
  const [confirm,    setConfirm]    = useState(null);
  const [adminNote,  setAdminNote]  = useState(refund.admin_note || "");
  const [amtCust,    setAmtCust]    = useState(String(refund.amount_customer ?? refund.refund_amount ?? ""));
  const [amtWorker,  setAmtWorker]  = useState(String(refund.amount_worker   ?? refund.penalty_amount ?? ""));
  // FIX: track eSewa result returned from backend after approve
  const [esewaResult, setEsewaResult] = useState(refund.esewa_refund ?? null);
  const backdropRef = useRef(null);

  const isDispute = isDisputeCharge(refund);
  const isPending = refund.status === "pending";
  const accent    = isDispute ? C.dispute : C.teal;
  const refundId  = refund._id;
  console.log("refund Id", refundId
  );
  const dispAmt   = Number(refund.amount_customer ?? refund.refund_amount ?? refund.amount ?? 0);
  const dispWkr   = Number(refund.amount_worker   ?? refund.penalty_amount ?? 0);
  const hasTask   = !!(refund.task_id ?? refund.taskId);

  const TABS = [
    { id: "refund", label: "Refund Details", icon: RotateCcw },
    { id: "task",   label: "Task Details",   icon: Package,  disabled: !hasTask },
  ];

  const DRow = ({ icon: Icon, label, value, valueColor }) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "9px 0", borderBottom: `1px solid ${C.divider}` }}>
      <div style={{ width: 29, height: 29, borderRadius: 8, background: C.bg, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={13} color={C.textSecond} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, color: valueColor || C.textPrimary, fontWeight: 500 }}>{value ?? "—"}</div>
      </div>
    </div>
  );

  return (
    <>
      <div ref={backdropRef}
        onClick={e => { if (e.target === backdropRef.current) onClose(); }}
        style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(28,20,16,0.52)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div onClick={e => e.stopPropagation()}
          style={{ background: C.surface, borderRadius: 28, width: 720, maxHeight: "93vh", display: "flex", flexDirection: "column", boxShadow: "0 30px 60px rgba(0,0,0,0.28)", animation: "scaleIn 0.2s ease", overflow: "hidden" }}>

          {/* Header */}
          <div style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`, padding: "20px 28px 0", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isDispute ? <ShieldAlert size={22} color="white" /> : <RotateCcw size={22} color="white" />}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600, marginBottom: 3 }}>{shortId(refundId)}</div>
                  <h2 style={{ color: "white", margin: 0, fontSize: 19, fontWeight: 700 }}>
                    {isDispute ? "Dispute Charge" : "Refund Request"}
                  </h2>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                <StatusBadge status={refund.status} />
                {isDispute ? <DisputeBadge /> : <AmountBadge amount={dispAmt} />}
                <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white", marginLeft: 4, flexShrink: 0 }}>
                  <X size={15} />
                </button>
              </div>
            </div>

            {isPending && (
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                {isDispute ? (
                  <>
                    <button onClick={() => setConfirm({ type: "enforce", message: `Enforce dispute charge of ${fmtNPR(dispAmt)}? Worker will be deducted.` })}
                      style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: "rgba(255,255,255,0.95)", color: C.dispute, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                      <ShieldAlert size={14} /> Enforce Charge
                    </button>
                    <button onClick={() => setConfirm({ type: "waive", message: "Waive this dispute charge? No deduction will be made." })}
                      style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.35)", background: "transparent", color: "white", fontWeight: 600, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                      <Shield size={14} /> Waive Charge
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setConfirm({ type: "approve", message: `Approve refund of ${fmtNPR(Number(amtCust) || dispAmt)} to customer? eSewa refund will be triggered.` })}
                      style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: "rgba(255,255,255,0.95)", color: C.green, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                      <ThumbsUp size={14} /> Approve Refund
                    </button>
                    <button onClick={() => setConfirm({ type: "reject", message: "Reject this refund request?", danger: true })}
                      style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.35)", background: "transparent", color: "white", fontWeight: 600, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                      <ThumbsDown size={14} /> Reject
                    </button>
                  </>
                )}
                <button onClick={() => setConfirm({ type: "delete", message: "Permanently delete this record?", danger: true })}
                  style={{ padding: "8px 12px", borderRadius: 9, background: "rgba(255,255,255,0.12)", border: "none", color: "rgba(255,255,255,0.85)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            )}

            <div style={{ display: "flex", gap: 2 }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => !t.disabled && setActiveTab(t.id)}
                  style={{ padding: "10px 18px", border: "none", background: activeTab === t.id ? C.surface : "transparent", color: activeTab === t.id ? accent : "rgba(255,255,255,0.75)", fontWeight: activeTab === t.id ? 700 : 500, fontSize: 13, cursor: t.disabled ? "not-allowed" : "pointer", fontFamily: "inherit", borderRadius: "10px 10px 0 0", display: "flex", alignItems: "center", gap: 7, opacity: t.disabled ? 0.4 : 1, transition: "all 0.15s" }}>
                  <t.icon size={14} />{t.label}
                  {t.id === "task" && hasTask && (
                    <span style={{ background: activeTab === "task" ? accent + "20" : "rgba(255,255,255,0.2)", color: activeTab === "task" ? accent : "rgba(255,255,255,0.8)", borderRadius: 100, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
                      {shortId(refund.task_id ?? refund.taskId)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab body */}
          <div style={{ flex: 1, overflowY: "auto", padding: 24, background: C.bg }}>

            {/* REFUND TAB */}
            {activeTab === "refund" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                {/* Amount hero */}
                <div style={{ background: isDispute ? C.disputeLight : C.tealLight, borderRadius: 14, padding: 18, border: `1px solid ${accent}25`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 11, color: accent, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                      {isDispute ? "Dispute Charge Amount" : "Customer Refund"}
                    </div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: accent }}>{fmtNPR(dispAmt)}</div>
                    {!isDispute && dispWkr > 0 && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Worker deduction: {fmtNPR(dispWkr)}</div>}
                  </div>
                  <div style={{ width: 54, height: 54, borderRadius: 14, background: accent + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {isDispute ? <ShieldAlert size={26} color={accent} /> : <Wallet size={26} color={accent} />}
                  </div>
                </div>

                {isDispute && (
                  <div style={{ background: C.disputeLight, borderRadius: 14, padding: 16, border: `1px solid ${C.disputeMid}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <ShieldAlert size={15} color={C.dispute} />
                      <span style={{ fontWeight: 700, color: C.dispute, fontSize: 13 }}>Dispute Charge</span>
                    </div>
                    <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.6)", display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <Info size={13} color={C.dispute} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 12, color: C.dispute, lineHeight: 1.5 }}>
                        {refund.status === "approved"
                          ? "Charge enforced. eSewa refund was NOT triggered."
                          : (refund.status === "rejected" || refund.status === "declined")
                          ? "Charge waived. No deduction applied."
                          : "Approving deducts from worker's settlement — does NOT trigger an eSewa customer refund."}
                      </span>
                    </div>
                  </div>
                )}

                {/* Editable amounts for pending non-dispute refunds */}
                {isPending && !isDispute && (
                  <div style={{ background: C.surface, borderRadius: 14, padding: 18, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>Set Refund Amounts</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {[
                        { label: "Customer Refund",  value: amtCust,   setter: setAmtCust,   required: true  },
                        { label: "Worker Deduction", value: amtWorker, setter: setAmtWorker, required: false },
                      ].map(({ label, value, setter, required }) => (
                        <div key={label}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                            {label} (NPR){required && <span style={{ color: C.red }}> *</span>}
                          </label>
                          <div style={{ position: "relative" }}>
                            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 600, color: C.textMuted }}>NPR</span>
                            <input type="number" min="0" placeholder="0" value={value}
                              onChange={e => setter(e.target.value)}
                              style={{ width: "100%", padding: "10px 12px 10px 44px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, outline: "none", background: C.bg, boxSizing: "border-box", color: C.textPrimary, fontFamily: "inherit" }}
                              onFocus={e => { e.target.style.borderColor = C.teal; e.target.style.background = C.surface; }}
                              onBlur={e  => { e.target.style.borderColor = C.border; e.target.style.background = C.bg; }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parties */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {[
                    { label: "Requester",  id: refund.requester_id ?? refund.customer_id, type: refund.requester_type ?? "customer" },
                    { label: isDispute ? "Charged To" : "Refund To", id: refund.reported_id ?? refund.worker_email, type: refund.reported_type ?? "worker" },
                  ].map(({ label, id, type }) => (
                    <div key={label} style={{ background: C.surface, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>{label}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar type={type} size={38} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 3 }}>{shortId(id)}</div>
                          <TypeBadge type={type} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Info rows */}
                <div style={{ background: C.surface, borderRadius: 14, padding: 18, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Refund Information</div>
                  <DRow icon={AlertCircle} label="Reason"       value={refund.reason} />
                  <DRow icon={User}        label="Requested By" value={(refund.requested_by ?? refund.requestedBy) ? String(refund.requested_by ?? refund.requestedBy).charAt(0).toUpperCase() + String(refund.requested_by ?? refund.requestedBy).slice(1) : undefined} />
                  <DRow icon={Link2}       label="Report ID"    value={refund.report_id ? shortId(refund.report_id) : "No linked report"} valueColor={refund.report_id ? accent : C.textMuted} />
                  {(refund.task_id ?? refund.taskId) && <DRow icon={Hash}       label="Task ID"    value={shortId(refund.task_id ?? refund.taskId)} />}
                  {refund.task_name                  && <DRow icon={FileText}   label="Task Name"  value={refund.task_name} />}
                  <DRow icon={Calendar}   label="Requested On" value={`${fmt(refund.created_at)} ${fmtTime(refund.created_at)}`} />
                  {refund.resolved_at && <DRow icon={CheckCircle} label="Resolved On" value={`${fmt(refund.resolved_at)} ${fmtTime(refund.resolved_at)}`} />}
                </div>

                {/* FIX: show real eSewa result — replaces the old hardcoded "triggered ✓" banner */}
                {!isDispute && (refund.status === "approved" || refund.status === "refunded") && (
                  <EsewaRefundStatus esewaRefund={esewaResult ?? refund.esewa_refund} />
                )}

                {/* Admin note input */}
                {isPending && (
                  <div style={{ background: C.surface, borderRadius: 14, padding: 18, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Admin Note (optional)</div>
                    <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)}
                      placeholder="Add a note about your decision…" rows={3}
                      style={{ width: "100%", padding: "11px 14px", borderRadius: 11, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", background: C.bg, color: C.textPrimary, lineHeight: 1.5 }}
                      onFocus={e => { e.target.style.borderColor = accent; e.target.style.background = C.surface; }}
                      onBlur={e  => { e.target.style.borderColor = C.border; e.target.style.background = C.bg; }}
                    />
                  </div>
                )}

                {refund.admin_note && !isPending && (
                  <div style={{ background: isDispute ? C.disputeLight : C.tealLight, borderRadius: 14, padding: 16, border: `1px solid ${accent}30` }}>
                    <div style={{ fontSize: 11, color: accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Admin Note</div>
                    <p style={{ margin: 0, fontSize: 13, color: C.textSecond, lineHeight: 1.6 }}>{refund.admin_note}</p>
                  </div>
                )}

                {!isPending && (
                  <button onClick={() => setConfirm({ type: "delete", message: "Permanently delete this record?", danger: true })}
                    style={{ padding: "12px", borderRadius: 12, border: `1px solid ${C.red}30`, background: C.redLight, color: C.red, fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}>
                    <Trash2 size={15} /> Delete Record
                  </button>
                )}

                {hasTask && (
                  <button onClick={() => setActiveTab("task")}
                    style={{ padding: "11px 16px", borderRadius: 12, border: `1px solid ${C.teal}30`, background: C.tealLight, color: C.teal, fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}>
                    <Package size={15} /> View Full Task Details <ChevronRight size={14} />
                  </button>
                )}
              </div>
            )}

            {/* TASK TAB */}
            {activeTab === "task" && <TaskDetailsTab refund={refund} />}
          </div>
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          danger={confirm.danger}
          onConfirm={async () => {
            const cAmt = Number(amtCust)   || dispAmt;
            const wAmt = Number(amtWorker) || dispWkr;
            if (confirm.type === "approve") {
              // FIX: capture esewa_refund from response and show it in the modal
              const result = await onApprove(refundId, adminNote, cAmt, wAmt);
              if (result?.esewa_refund) setEsewaResult(result.esewa_refund);
            }
            if (confirm.type === "reject")  onReject(refundId, adminNote);
            if (confirm.type === "enforce") onEnforce?.(refundId, adminNote);
            if (confirm.type === "waive")   onWaive?.(refundId, adminNote);
            if (confirm.type === "delete")  { onDelete(refundId); onClose(); }
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
};

// ── Refund Table Row ──────────────────────────────────────────────────────────
const RefundRow = ({ refund, onSelect, onApprove, onReject, onDelete, onWaive, onEnforce }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const isDispute = isDisputeCharge(refund);
  const amount    = Number(refund.amount_customer ?? refund.refund_amount ?? refund.amount ?? 0);

  const handleAction = (action) => {
    if (action === "view")    onSelect(refund);
    if (action === "approve") onApprove(refund._id, "", amount, 0);
    if (action === "reject")  onReject(refund._id, "");
    if (action === "delete")  onDelete(refund._id);
    if (action === "waive")   onWaive?.(refund._id, "");
    if (action === "enforce") onEnforce?.(refund._id, "");
  };

  return (
    <tr
      style={{ borderBottom: `1px solid ${C.divider}`, transition: "background 0.15s", cursor: "pointer", background: isDispute ? C.dispute + "06" : C.surface }}
      onClick={() => onSelect(refund)}
      onMouseEnter={e => e.currentTarget.style.background = isDispute ? C.dispute + "12" : C.bg}
      onMouseLeave={e => e.currentTarget.style.background = isDispute ? C.dispute + "06" : C.surface}
    >
      <td style={{ padding: "13px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
          {isDispute && <ShieldAlert size={12} color={C.dispute} />}
          <span style={{ fontSize: 12, fontWeight: 700, color: isDispute ? C.dispute : C.textMuted }}>{shortId(refund._id)}</span>
        </div>
        {(refund.report_id ?? refund.reportId) && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: C.teal, fontWeight: 500 }}>
            <Link2 size={9} />Report {shortId(refund.report_id ?? refund.reportId)}
          </div>
        )}
      </td>
      <td style={{ padding: "13px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Avatar type={refund.requester_type ?? "customer"} size={32} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 2 }}>{shortId(refund.requester_id ?? refund.customer_id)}</div>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: "capitalize" }}>via {refund.requested_by ?? "customer"}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: "13px 16px" }}>
        {isDispute ? <DisputeBadge /> : <AmountBadge amount={amount} />}
      </td>
      <td style={{ padding: "13px 16px" }}>
        <div style={{ fontSize: 13, color: C.textSecond, fontWeight: 500, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{refund.reason || "—"}</div>
        {refund.task_name && (
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{refund.task_name}</div>
        )}
      </td>
      <td style={{ padding: "13px 16px" }}><StatusBadge status={refund.status ?? refund.refund_status} /></td>
      <td style={{ padding: "13px 16px" }}>
        <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 500 }}>{fmt(refund.created_at)}</div>
        <div style={{ fontSize: 11, color: C.textMuted }}>{fmtTime(refund.created_at)}</div>
      </td>
      <td style={{ padding: "13px 16px" }} onClick={e => e.stopPropagation()}>
        <div style={{ position: "relative", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => setMenuOpen(v => !v)}
            style={{ padding: "7px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", color: C.textMuted, display: "flex", alignItems: "center" }}
            onMouseEnter={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.textPrimary; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.surface; e.currentTarget.style.color = C.textMuted; }}
          >
            <MoreVertical size={15} />
          </button>
          {menuOpen && <ContextMenu refund={refund} onAction={handleAction} onClose={() => setMenuOpen(false)} />}
        </div>
      </td>
    </tr>
  );
};

// ── Main RefundManagement ─────────────────────────────────────────────────────
export default function RefundManagement() {
  const [refunds,      setRefunds]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [stats,        setStats]        = useState({ total: 0, pending: 0, approved: 0, rejected: 0, totalAmount: 0, approvedAmount: 0, disputePending: 0 });
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType,   setFilterType]   = useState("all");
  const [selected,     setSelected]     = useState(null);
  const [toast,        setToast]        = useState(null);
  const [confirm,      setConfirm]      = useState(null);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [totalCount,   setTotalCount]   = useState(0);
  const PAGE_SIZE = 50;
  const isFirst   = useRef(true);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  const normalize = useCallback((list) => {
    console.log("normalize() input:", list);
    return list.map(r => ({
      ...r,
      _id:             String(r._id ?? r.refund_id ?? r.id ?? ""),
      amount_customer: r.amount_customer ?? r.refund_amount ?? r.amount ?? 0,
      amount_worker:   r.amount_worker   ?? r.penalty_amount ?? 0,
      status:          r.refund_status   ?? r.status ?? "pending",
      
    }));
  }, []);

  const fetchPage = useCallback(async (page, q = search) => {
  try {
    setLoading(true);
    setError(null);
    const skip = (page - 1) * PAGE_SIZE;
    const params = new URLSearchParams({ skip, limit: PAGE_SIZE });
    
    if (q?.trim()) params.append("search", q.trim());
    if (filterType === "dispute") params.append("type", "dispute");
    if (filterType === "refund") params.append("type", "refund");

    // Handle different tabs with specific endpoints
    let endpoint = "";
    let response = null;
    
    if (filterStatus === "pending") {
      endpoint = `${BASE}/refunds/pending`;
      response = await apiCall(`${endpoint}?${params}`).catch(() => null);
    } 
    else if (filterStatus === "approved") {
      endpoint = `${BASE}/refunds/approved`;
      response = await apiCall(`${endpoint}?${params}`).catch(() => null);
    }
    else if (filterStatus === "rejected") {
      endpoint = `${BASE}/refunds/rejected`;
      response = await apiCall(`${endpoint}?${params}`).catch(() => null);
    }
    else {
      // "all" tab - try unified endpoint first
      const unified = await apiCall(`${BASE}/refunds?${params}`).catch(() => null);
      if (unified?.ok) {
        const d = await unified.json();
        const list = normalize(d.refunds ?? d.items ?? d.data ?? d ?? []);
        setRefunds(list);
        setTotalCount(d.total ?? list.length);
        setCurrentPage(page);
        setLoading(false);
        return;
      }
      
      // Fallback: merge pending + approved + rejected
      const [pRes, aRes, rRes] = await Promise.all([
        apiCall(`${BASE}/refunds/pending`).catch(() => null),
        apiCall(`${BASE}/refunds/approved`).catch(() => null),
        apiCall(`${BASE}/refunds/rejected`).catch(() => null),
      ]);
      
      let combined = [];
      if (pRes?.ok) {
        const d = await pRes.json();
        const pendingList = (d.refunds ?? []).map(r => ({ ...r, status: r.refund_status ?? "pending" }));
        combined.push(...pendingList);
      }
      if (aRes?.ok) {
        const d = await aRes.json();
        const approvedList = (d.refunds ?? []).map(r => ({ ...r, status: r.refund_status ?? "approved" }));
        combined.push(...approvedList);
      }
      if (rRes?.ok) {
        const d = await rRes.json();
        const rejectedList = (d.refunds ?? []).map(r => ({ ...r, status: r.refund_status ?? "rejected" }));
        combined.push(...rejectedList);
      }
      
      if (q?.trim()) {
        const lq = q.trim().toLowerCase();
        combined = combined.filter(r =>
          String(r.refund_id ?? r._id ?? "").toLowerCase().includes(lq) ||
          String(r.reason ?? "").toLowerCase().includes(lq) ||
          String(r.task_name ?? "").toLowerCase().includes(lq)
        );
      }
      
      const list = normalize(combined);
      setRefunds(list.slice(skip, skip + PAGE_SIZE));
      setTotalCount(list.length);
      setCurrentPage(page);
      setLoading(false);
      return;
    }
    
    // Handle pending, approved, or rejected specific endpoints
    if (response?.ok) {
      const d = await response.json();
      const list = normalize(d.refunds ?? d.items ?? d.data ?? d ?? []);
      setRefunds(list);
      setTotalCount(d.total ?? list.length);
      setCurrentPage(page);
    } else {
      throw new Error(`Failed to fetch ${filterStatus} refunds`);
    }
    
  } catch (e) {
    setError(`Failed to load refunds: ${e.message}`);
    showToast(e.message, "error");
  } finally {
    setLoading(false);
  }
}, [search, filterStatus, filterType, normalize]);
  const fetchStats = useCallback(async () => {
  try {
    // Fetch from all endpoints
    const [pRes, aRes, rRes] = await Promise.all([
      apiCall(`${BASE}/refunds/pending`).catch(() => null),
      apiCall(`${BASE}/refunds/approved`).catch(() => null),
      apiCall(`${BASE}/refunds/rejected`).catch(() => null),
    ]);
    
    let pendingCount = 0;
    let pendingAmount = 0;
    let approvedCount = 0;
    let approvedAmount = 0;
    let rejectedCount = 0;
    let rejectedAmount = 0;
    
    // Process pending refunds
    if (pRes?.ok) { 
      const d = await pRes.json(); 
      const pendingRefunds = d.refunds ?? [];
      pendingCount = pendingRefunds.length;
      pendingAmount = pendingRefunds.reduce((sum, r) => sum + (Number(r.amount_customer) || Number(r.refund_amount) || Number(r.amount) || 0), 0);
    }
    
    // Process approved refunds
    if (aRes?.ok) { 
      const d = await aRes.json(); 
      const approvedRefunds = d.refunds ?? [];
      approvedCount = approvedRefunds.length;
      approvedAmount = approvedRefunds.reduce((sum, r) => sum + (Number(r.amount_customer) || Number(r.refund_amount) || Number(r.amount) || 0), 0);
    }
    
    // Process rejected refunds
    if (rRes?.ok) { 
      const d = await rRes.json(); 
      const rejectedRefunds = d.refunds ?? [];
      rejectedCount = rejectedRefunds.length;
      rejectedAmount = rejectedRefunds.reduce((sum, r) => sum + (Number(r.amount_customer) || Number(r.refund_amount) || Number(r.amount) || 0), 0);
    }
    
    // Get total from all
    const totalRefunds = pendingCount + approvedCount + rejectedCount;
    
    setStats({ 
      total: totalRefunds, 
      pending: pendingCount, 
      approved: approvedCount, 
      rejected: rejectedCount,
      totalAmount: pendingAmount + approvedAmount + rejectedAmount,
      approvedAmount: approvedAmount,
      rejectedAmount: rejectedAmount,
      disputePending: 0 
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
  }
}, []);

  useEffect(() => { fetchPage(1, ""); fetchStats(); }, []);
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    const t = setTimeout(() => fetchPage(1, search), 400);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { if (!isFirst.current) fetchPage(1, search); }, [filterStatus, filterType]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  // FIX: handleApprove now returns the backend response so modal can show eSewa status
  const handleApprove = async (id, note, amtC, amtW) => {
    const res = await patchStatus(id, "approved", note, amtC, amtW);
    if (!res.ok) {
      const b = await res.text().catch(() => "");
      showToast(`Failed to approve: ${b}`, "error");
      return null;
    }
    const data = await res.json().catch(() => ({}));
    const esewaStatus = data.esewa_refund?.status;
    const toastMsg = esewaStatus === "sent"
      ? "Refund approved — eSewa disbursement sent ✓"
      : esewaStatus === "no_esewa_id"
      ? "Approved — no eSewa ID on file, refund manually"
      : esewaStatus === "failed" || esewaStatus === "error"
      ? "Approved but eSewa disbursement failed — process manually"
      : "Refund approved ✓";

    setRefunds(p => p.map(r => r._id === id ? { ...r, status: "approved", admin_note: note, esewa_refund: data.esewa_refund } : r));
    if (selected?._id === id) setSelected(p => ({ ...p, status: "approved", admin_note: note, esewa_refund: data.esewa_refund }));
    setStats(p => ({ ...p, pending: Math.max(0, p.pending - 1), approved: p.approved + 1 }));
    showToast(toastMsg, esewaStatus === "sent" ? "success" : "warning");
    fetchStats();
    return data; // FIX: return so modal can pick up esewa_refund
  };

  const handleReject = async (id, note) => {
    const res = await patchStatus(id, "declined", note, null, null);
    if (!res.ok) { showToast("Failed to reject", "error"); return; }
    setRefunds(p => p.map(r => r._id === id ? { ...r, status: "declined", admin_note: note } : r));
    if (selected?._id === id) setSelected(p => ({ ...p, status: "declined", admin_note: note }));
    setStats(p => ({ ...p, pending: Math.max(0, p.pending - 1), rejected: p.rejected + 1 }));
    showToast("Refund rejected"); fetchStats();
  };

  const handleEnforce = async (id, note) => {
    const res = await patchStatus(id, "approved", note, null, null);
    if (!res.ok) { showToast("Failed to enforce", "error"); return; }
    setRefunds(p => p.map(r => r._id === id ? { ...r, status: "approved", admin_note: note } : r));
    if (selected?._id === id) setSelected(p => ({ ...p, status: "approved", admin_note: note }));
    showToast("Dispute charge enforced"); fetchStats();
  };

  const handleWaive = async (id, note) => {
    const res = await patchStatus(id, "declined", note, null, null);
    if (!res.ok) { showToast("Failed to waive", "error"); return; }
    setRefunds(p => p.map(r => r._id === id ? { ...r, status: "declined", admin_note: note } : r));
    if (selected?._id === id) setSelected(p => ({ ...p, status: "declined", admin_note: note }));
    showToast("Dispute charge waived"); fetchStats();
  };

  const handleDelete = async (id) => {
    setConfirm({
      message: "Permanently delete this record? This cannot be undone.", danger: true,
      onConfirm: async () => {
        setConfirm(null);
        const token = getToken();
        const res = await fetch(`${BASE}/refunds/${id}`, {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }).catch(() => null);
        if (!res?.ok) { showToast(res?.status === 404 ? "Delete endpoint not available" : "Failed to delete", "error"); return; }
        setRefunds(p => p.filter(r => r._id !== id));
        setTotalCount(p => p - 1);
        if (selected?._id === id) setSelected(null);
        showToast("Record deleted"); fetchStats();
      },
    });
  };

  const totalPages   = Math.ceil(totalCount / PAGE_SIZE);
  const disputeCount = refunds.filter(isDisputeCharge).length;
  const refundCount  = refunds.filter(r => !isDisputeCharge(r)).length;

  const Pill = ({ active, onClick, label, color }) => {
    const c = color ?? C.teal;
    return (
      <button onClick={onClick} style={{ padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12, border: `1px solid ${active ? c + "50" : C.border}`, background: active ? c + "18" : C.surface, color: active ? c : C.textSecond, fontWeight: active ? 600 : 500, transition: "all 0.15s", fontFamily: "inherit" }}>
        {label}
      </button>
    );
  };

  const pageBtn = (dis) => ({ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: dis ? C.bg : C.surface, color: dis ? C.textMuted : C.textSecond, cursor: dis ? "default" : "pointer", fontSize: 13, fontFamily: "inherit" });

  return (
    <>
    <BookingNavbar />
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: C.bg, minHeight: "100vh", padding: 24 }}>
      {toast   && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {confirm && <ConfirmDialog message={confirm.message} danger={confirm.danger} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}

      <style>{`
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 27, fontWeight: 700, color: C.textPrimary, letterSpacing: "-0.01em" }}>Refund & Disputes</h1>
          <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>
            Review refund requests and dispute charges ·
            <span style={{ color: C.teal,    fontWeight: 600 }}> {refundCount} refunds</span> ·
            <span style={{ color: C.dispute, fontWeight: 600 }}> {disputeCount} dispute charges</span> on this page
          </p>
        </div>
        <button onClick={() => { fetchPage(1, search); fetchStats(); }}
          style={{ padding: "10px 18px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", fontSize: 14, color: C.textSecond, display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}
          onMouseEnter={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.teal; }}
          onMouseLeave={e => { e.currentTarget.style.background = C.surface; e.currentTarget.style.color = C.textSecond; }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12, marginBottom: 22 }}>
        <StatCard label="Total"           value={stats.total}                                                  color={C.teal}    icon={Receipt}    />
        <StatCard label="Pending"         value={stats.pending}                                                color={C.brand}   icon={Clock}       sub="Awaiting decision" />
        <StatCard label="Approved"        value={stats.approved}                                               color={C.green}   icon={CheckCircle} />
        <StatCard label="Rejected"        value={stats.rejected}                                               color={C.red}     icon={XCircle}     />
        <StatCard label="Total Requested" value={`NPR ${Number(stats.totalAmount    ?? 0).toLocaleString()}`} color={C.blue}    icon={Wallet}      />
        <StatCard label="Total Refunded"  value={`NPR ${Number(stats.approvedAmount ?? 0).toLocaleString()}`} color={C.green}   icon={CreditCard}  sub="eSewa processed" />
        <StatCard label="Dispute Pending" value={stats.disputePending ?? 0}                                    color={C.dispute} icon={ShieldAlert} sub="Charges to review" />
      </div>

      {/* Dispute banner */}
      {(stats.disputePending ?? 0) > 0 && (
        <div style={{ background: C.disputeLight, borderRadius: 14, padding: "14px 20px", marginBottom: 18, border: `1px solid ${C.disputeMid}`, display: "flex", alignItems: "center", gap: 12 }}>
          <ShieldAlert size={18} color={C.dispute} />
          <div>
            <span style={{ fontWeight: 700, color: C.dispute, fontSize: 14 }}>{stats.disputePending} dispute charge{stats.disputePending > 1 ? "s" : ""} pending review</span>
            <span style={{ fontSize: 13, color: C.textSecond, marginLeft: 8 }}>— these are <strong>not</strong> eSewa refunds; they deduct from worker settlement</span>
          </div>
          <button onClick={() => setFilterType("dispute")}
            style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 20, border: `1px solid ${C.disputeMid}`, background: C.dispute, color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            View Disputes
          </button>
        </div>
      )}

      {/* Search + Filters */}
      <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: "16px 20px", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <div style={{ flex: 2, position: "relative", minWidth: 260 }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted }} />
            <input type="text" placeholder="Search by ID, reason, task name…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", background: C.bg, boxSizing: "border-box", color: C.textPrimary, fontFamily: "inherit" }}
              onFocus={e => { e.target.style.borderColor = C.teal; e.target.style.background = C.surface; }}
              onBlur={e  => { e.target.style.borderColor = C.border; e.target.style.background = C.bg; }}
            />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[["all","All Status"], ["pending","Pending"], ["approved","Approved",C.green], ["rejected","Rejected",C.red]].map(([v,l,c]) => (
              <Pill key={v} active={filterStatus === v} onClick={() => setFilterStatus(v)} label={l} color={c} />
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, paddingTop: 12, borderTop: `1px solid ${C.divider}`, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginRight: 4 }}>TYPE</span>
          <Pill active={filterType === "all"}     onClick={() => setFilterType("all")}     label="All"             />
          <Pill active={filterType === "refund"}  onClick={() => setFilterType("refund")}  label="Refunds Only"    color={C.teal}    />
          <Pill active={filterType === "dispute"} onClick={() => setFilterType("dispute")} label="Dispute Charges" color={C.dispute} />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: C.surface, borderRadius: 20, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.08)" }}>
        {loading ? (
          <div style={{ padding: 80, textAlign: "center" }}>
            <RefreshCw size={38} style={{ color: C.teal, marginBottom: 14, animation: "spin 1s linear infinite" }} />
            <p style={{ color: C.textSecond, margin: 0, fontSize: 14 }}>Loading records…</p>
          </div>
        ) : error ? (
          <div style={{ padding: 80, textAlign: "center" }}>
            <AlertTriangle size={38} style={{ color: C.red, marginBottom: 14 }} />
            <p style={{ color: C.red, margin: 0, fontSize: 14 }}>{error}</p>
          </div>
        ) : refunds.length === 0 ? (
          <div style={{ padding: 80, textAlign: "center" }}>
            <RotateCcw size={44} style={{ color: C.textMuted, marginBottom: 14 }} />
            <h3 style={{ margin: "0 0 6px", color: C.textPrimary, fontSize: 17 }}>No records found</h3>
            <p style={{ color: C.textMuted, margin: 0, fontSize: 13 }}>
              {search || filterStatus !== "all" || filterType !== "all" ? "Try adjusting your filters" : "No refund or dispute records yet"}
            </p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `2px solid ${C.border}` }}>
                {["ID / Report", "Requester", "Type / Amount", "Reason", "Status", "Date", ""].map((h, i) => (
                  <th key={h || i} style={{ padding: "13px 16px", textAlign: i === 6 ? "right" : "left", fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {refunds.map(r => (
                <RefundRow key={r._id} refund={r}
                  onSelect={setSelected} onApprove={handleApprove} onReject={handleReject}
                  onDelete={handleDelete} onWaive={handleWaive} onEnforce={handleEnforce}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && totalCount > 0 && (
        <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, color: C.textMuted }}>
            Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} records
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <button onClick={() => fetchPage(1, search)}               disabled={currentPage === 1}            style={pageBtn(currentPage === 1)}>«</button>
            <button onClick={() => fetchPage(currentPage - 1, search)} disabled={currentPage === 1}            style={pageBtn(currentPage === 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx - 1] > 1) acc.push("..."); acc.push(p); return acc; }, [])
              .map((p, i) => p === "..." ? (
                <span key={`d${i}`} style={{ padding: "6px 8px", fontSize: 13, color: C.textMuted }}>…</span>
              ) : (
                <button key={p} onClick={() => fetchPage(p, search)}
                  style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: currentPage === p ? C.textPrimary : C.surface, color: currentPage === p ? "white" : C.textSecond, cursor: "pointer", fontSize: 13, fontWeight: currentPage === p ? 700 : 500, fontFamily: "inherit" }}>
                  {p}
                </button>
              ))}
            <button onClick={() => fetchPage(currentPage + 1, search)} disabled={currentPage >= totalPages} style={pageBtn(currentPage >= totalPages)}>›</button>
            <button onClick={() => fetchPage(totalPages, search)}      disabled={currentPage >= totalPages} style={pageBtn(currentPage >= totalPages)}>»</button>
          </div>
        </div>
      )}

      {selected && (
        <RefundDetailModal
          refund={selected}
          onClose={() => setSelected(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          onDelete={handleDelete}
          onWaive={handleWaive}
          onEnforce={handleEnforce}
        />
      )}
    </div>
    </>
  );
}