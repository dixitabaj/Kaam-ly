import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Search, X, AlertTriangle, CheckCircle, XCircle, Clock, Trash2,
  Eye, User, Briefcase, RefreshCw, RotateCcw, AlertCircle,
  MoreVertical, Link2, Wallet, CreditCard, Receipt, Calendar,
  ThumbsUp, ThumbsDown, ShieldAlert, Hash, Info, FileText,
  Shield, ChevronRight, Package, BarChart2, DollarSign, Activity,
  Send, ChevronLeft, ChevronRight as ChevRight
} from "lucide-react";
import BookingNavbar from "../../components/Navbar/Navbar";

const BASE = "http://localhost:8000/api";

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

const patchStatus = async (refundId, status, adminNote, amountCustomer, amountWorker) => {
  const token = getToken();
  const form  = new URLSearchParams();
  form.append("status",     status);
  form.append("admin_note", adminNote ?? "");
  if (status === "approved") {
    form.append("amount_customer", String(Number(amountCustomer) || 0));
    form.append("amount_worker",   String(Number(amountWorker)   || 0));
  }
  return fetch(`${BASE}/update-status/${refundId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form.toString(),
  });
};

// ── Responsive hook ──────────────────────────────────────────────────────────
const useBreakpoint = () => {
  const [bp, setBp] = useState(() => {
    const w = window.innerWidth;
    if (w < 480)  return "xs";
    if (w < 768)  return "sm";
    if (w < 1024) return "md";
    if (w < 1440) return "lg";
    return "xl";
  });
  useEffect(() => {
    const handler = () => {
      const w = window.innerWidth;
      if (w < 480)  setBp("xs");
      else if (w < 768)  setBp("sm");
      else if (w < 1024) setBp("md");
      else if (w < 1440) setBp("lg");
      else setBp("xl");
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return bp;
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
    pending:            { color: C.brand,  icon: Clock,        label: "Pending"      },
    approved:           { color: C.green,  icon: CheckCircle,  label: "Approved"     },
    rejected:           { color: C.red,    icon: XCircle,      label: "Rejected"     },
    refunded:           { color: C.green,  icon: CheckCircle,  label: "Refunded"     },
    declined:           { color: C.red,    icon: XCircle,      label: "Declined"     },
    queued:             { color: C.amber,  icon: Clock,        label: "Queued"       },
    refund_in_progress: { color: C.amber,  icon: Clock,        label: "In Progress"  },
    processing:         { color: C.amber,  icon: RefreshCw,    label: "Processing"   },
  };
  const c    = map[status] ?? map.pending;
  const Icon = c.icon;
  return (
    <span style={{ background: "white", color: c.color, borderRadius: 100, padding: "4px 10px 4px 8px", fontSize: "clamp(10px, 1.2vw, 12px)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", border: `1px solid ${c.color}30` }}>
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
  <span style={{ background: isDispute ? C.disputeLight : C.tealLight, color: isDispute ? C.dispute : C.teal, borderRadius: 100, padding: "4px 10px 4px 8px", fontSize: "clamp(10px, 1.2vw, 12px)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", border: `1px solid ${isDispute ? C.dispute : C.teal}25` }}>
    <Wallet size={12} />{fmtNPR(amount)}
  </span>
);

const DisputeBadge = () => (
  <span style={{ background: C.disputeLight, color: C.dispute, borderRadius: 100, padding: "4px 10px 4px 8px", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", border: `1px solid ${C.disputeMid}` }}>
    <ShieldAlert size={11} /> Dispute
  </span>
);

const Spinner = ({ size = 28, color = C.teal }) => (
  <div style={{ width: size, height: size, border: `3px solid ${C.border}`, borderTop: `3px solid ${color}`, borderRadius: "50%", animation: "spin 0.75s linear infinite", flexShrink: 0 }} />
);

const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const bg   = type === "error" ? C.red : type === "warning" ? C.brand : C.green;
  const Icon = type === "error" ? XCircle : type === "warning" ? AlertTriangle : CheckCircle;
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 99999, background: bg, color: "white", padding: "12px 20px", borderRadius: 12, fontSize: "clamp(12px, 1.5vw, 14px)", fontWeight: 500, boxShadow: "0 10px 25px rgba(0,0,0,0.18)", display: "flex", alignItems: "center", gap: 8, maxWidth: "min(360px, 90vw)", animation: "slideUp 0.2s ease" }}>
      <Icon size={18} />{message}
    </div>
  );
};

const ConfirmDialog = ({ message, onConfirm, onCancel, danger = false }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(28,20,16,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div style={{ background: C.surface, borderRadius: 24, padding: "clamp(20px, 4vw, 28px)", width: "min(380px, 92vw)", boxShadow: "0 25px 50px rgba(0,0,0,0.3)", animation: "scaleIn 0.18s ease" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: danger ? C.redLight : C.brandLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <AlertTriangle size={24} color={danger ? C.red : C.brand} />
      </div>
      <h3 style={{ margin: "0 0 8px", fontSize: "clamp(16px, 2vw, 18px)", fontWeight: 600, color: C.textPrimary }}>Confirm Action</h3>
      <p style={{ margin: "0 0 24px", fontSize: "clamp(12px, 1.5vw, 14px)", color: C.textSecond, lineHeight: 1.6 }}>{message}</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button onClick={onCancel}  style={{ padding: "10px 20px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", fontSize: 14, color: C.textSecond, fontFamily: "inherit" }}>Cancel</button>
        <button onClick={onConfirm} style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: danger ? C.red : C.green, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "white", fontFamily: "inherit" }}>Confirm</button>
      </div>
    </div>
  </div>
);

const StatCard = ({ label, value, color, icon: Icon, sub }) => (
  <div style={{ background: C.surface, borderRadius: 16, padding: "clamp(12px, 2vw, 20px)", border: `1px solid ${color}25`, minWidth: 0 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
      <div style={{ fontSize: "clamp(9px, 1vw, 11px)", color, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", lineHeight: 1.3 }}>{label}</div>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={15} color={color} />
      </div>
    </div>
    <div style={{ fontSize: "clamp(18px, 2.5vw, 24px)", fontWeight: 700, color: C.textPrimary, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: "clamp(9px, 1vw, 11px)", color: C.textMuted, marginTop: 6, lineHeight: 1.3 }}>{sub}</div>}
  </div>
);

// ── Pay All Modal ────────────────────────────────────────────────────────────
const PayAllModal = ({ inProgressCount, inProgressAmount, onConfirm, onCancel, processing }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 10001, background: "rgba(28,20,16,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div style={{ background: C.surface, borderRadius: 24, width: "min(480px, 95vw)", boxShadow: "0 30px 60px rgba(0,0,0,0.28)", animation: "scaleIn 0.2s ease", overflow: "hidden" }}>
      <div style={{ background: `linear-gradient(135deg, ${C.green} 0%, ${C.teal} 100%)`, padding: "clamp(18px, 3vw, 24px) clamp(18px, 3vw, 28px)", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Send size={32} color="white" />
        </div>
        <h2 style={{ color: "white", margin: "0 0 8px", fontSize: "clamp(17px, 2.5vw, 22px)", fontWeight: 700 }}>Disburse All Pending</h2>
        <p style={{ color: "rgba(255,255,255,0.8)", margin: 0, fontSize: "clamp(12px, 1.5vw, 14px)" }}>
          {inProgressCount} refund{inProgressCount !== 1 ? "s" : ""} totaling {fmtNPR(inProgressAmount)}
        </p>
      </div>
      <div style={{ padding: "clamp(18px, 3vw, 24px) clamp(18px, 3vw, 28px)" }}>
        <div style={{ background: C.amberLight, borderRadius: 12, padding: "14px 16px", marginBottom: 24, border: `1px solid ${C.amber}30`, display: "flex", gap: 10 }}>
          <AlertCircle size={16} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: "clamp(11px, 1.3vw, 13px)", color: C.amber, lineHeight: 1.6 }}>
            Calls the <strong>eSewa API</strong> for all approved refunds. Both customer refund and worker payout will be processed. Status is only set to "Refunded" if eSewa confirms success.
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button onClick={onCancel} disabled={processing}
            style={{ padding: "11px 24px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, cursor: processing ? "not-allowed" : "pointer", fontSize: 14, color: C.textSecond, fontFamily: "inherit", opacity: processing ? 0.5 : 1 }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={processing}
            style={{ padding: "11px 28px", borderRadius: 12, border: "none", background: `linear-gradient(135deg, ${C.green} 0%, ${C.teal} 100%)`, cursor: processing ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 700, color: "white", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, opacity: processing ? 0.7 : 1 }}>
            {processing ? <><Spinner size={16} color="white" /> Processing…</> : <><Send size={16} /> Disburse — {fmtNPR(inProgressAmount)}</>}
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ── Pay All Results Modal ────────────────────────────────────────────────────
// ✅ FIXED: now shows customer + worker totals separately
const PayAllResultModal = ({ result, onClose }) => {
  if (!result) return null;
  const { success = [], failed = [] } = result;

  const total_success_amount =
    result.total_success_amount ||
    success.reduce((sum, s) => sum + (s.amount_customer ?? s.amount ?? 0), 0);

  // ✅ NEW: worker total
  const total_worker_amount =
    result.total_worker_amount ||
    success.reduce((sum, s) => sum + (s.amount_worker ?? 0), 0);

  const total = success.length + failed.length;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10001, background: "rgba(28,20,16,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.surface, borderRadius: 24, width: "min(660px, 97vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 30px 60px rgba(0,0,0,0.28)", animation: "scaleIn 0.2s ease" }}>
        <div style={{ background: `linear-gradient(135deg, ${C.green} 0%, ${C.teal} 100%)`, padding: "clamp(16px, 2.5vw, 20px) clamp(18px, 3vw, 28px)", borderRadius: "24px 24px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Send size={22} color="white" />
            </div>
            <div>
              <h2 style={{ color: "white", margin: 0, fontSize: "clamp(15px, 2vw, 19px)", fontWeight: 700 }}>Disbursement Results</h2>
              <p style={{ color: "rgba(255,255,255,0.7)", margin: "4px 0 0", fontSize: "clamp(11px, 1.2vw, 12px)" }}>
                Processed {total} refund{total !== 1 ? "s" : ""} via eSewa 
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>

        {/* ✅ FIXED: 3 columns — customer, worker, failed */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, padding: "clamp(14px, 2vw, 20px) clamp(18px, 3vw, 28px)", borderBottom: `1px solid ${C.border}`, background: C.bg }}>
          <div style={{ textAlign: "center", padding: "14px", background: C.greenLight, borderRadius: 12, border: `1px solid ${C.green}30` }}>
            <div style={{ fontSize: "clamp(15px, 2.5vw, 22px)", fontWeight: 800, color: C.green }}>{fmtNPR(total_success_amount)}</div>
            <div style={{ fontSize: "clamp(9px, 1vw, 11px)", color: C.green, fontWeight: 600, textTransform: "uppercase", marginTop: 4 }}>Customer Refunds</div>
          </div>
          {/* ✅ NEW: worker payout card */}
          <div style={{ textAlign: "center", padding: "14px", background: C.blueLight, borderRadius: 12, border: `1px solid ${C.blue}30` }}>
            <div style={{ fontSize: "clamp(15px, 2.5vw, 22px)", fontWeight: 800, color: C.blue }}>{fmtNPR(total_worker_amount)}</div>
            <div style={{ fontSize: "clamp(9px, 1vw, 11px)", color: C.blue, fontWeight: 600, textTransform: "uppercase", marginTop: 4 }}>Worker Payouts</div>
          </div>
          <div style={{ textAlign: "center", padding: "14px", background: C.redLight, borderRadius: 12, border: `1px solid ${C.red}30` }}>
            <div style={{ fontSize: "clamp(15px, 2.5vw, 22px)", fontWeight: 800, color: C.red }}>{failed.length}</div>
            <div style={{ fontSize: "clamp(9px, 1vw, 11px)", color: C.red, fontWeight: 600, textTransform: "uppercase", marginTop: 4 }}>Failed</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "clamp(14px, 2vw, 20px) clamp(18px, 3vw, 28px)" }}>
          {success.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: C.green, textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle size={14} /> Successful ({success.length})
              </h3>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {success.map((item, i) => (
                  <div key={i} style={{ background: C.greenLight, borderRadius: 10, padding: "12px 14px", marginBottom: 8, border: `1px solid ${C.green}20` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 6 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>{shortId(item.refund_id)}</div>

                        {/* ✅ Customer row */}
                        <div style={{ fontSize: 11, color: C.textSecond, display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                          <User size={10} color={C.purple} />
                          <span style={{ fontWeight: 600, color: C.green }}>Customer: {fmtNPR(item.amount_customer ?? item.amount)}</span>
                          {item.customer_esewa && <span style={{ color: C.textMuted }}> → {item.customer_esewa}</span>}
                        </div>

                        {/* ✅ Worker row — always shown, with status color */}
                        <div style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4, color:
                          !item.worker_payout ? C.textMuted :
                          (item.worker_payout.status === "sent" || item.worker_payout.status === "mock_success" || item.worker_payout.status === "success") ? C.blue :
                          item.worker_payout.status === "no_phone" ? C.amber : C.red
                        }}>
                          <Briefcase size={10} />
                          <span style={{ fontWeight: 600 }}>Worker: {fmtNPR(item.amount_worker ?? 0)}</span>
                          {!item.worker_payout && <span style={{ color: C.textMuted }}> — not set</span>}
                          {item.worker_payout && (
                            <span> — {
                              (item.worker_payout.status === "sent" || item.worker_payout.status === "mock_success" || item.worker_payout.status === "success")
                                ? `Sent → ${item.worker_payout.phone || "worker account"}`
                                : item.worker_payout.status === "no_phone"
                                ? "No phone on file — process manually"
                                : item.worker_payout.error || item.worker_payout.status || "Failed"
                            }</span>
                          )}
                        </div>
                      </div>
                      {item.transaction_uuid && (
                        <span style={{ fontSize: 9, color: C.green, fontFamily: "monospace", flexShrink: 0 }}>
                          Txn: {item.transaction_uuid.slice(-8)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {failed.length > 0 && (
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: C.red, textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <XCircle size={14} /> Failed ({failed.length})
              </h3>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {failed.map((item, i) => (
                  <div key={i} style={{ background: C.redLight, borderRadius: 10, padding: "10px 14px", marginBottom: 8, border: `1px solid ${C.red}20` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary, marginBottom: 2 }}>{shortId(item.refund_id)}</div>
                    <div style={{ fontSize: 11, color: C.red }}>{item.error || "eSewa API error"}</div>
                    <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{fmtNPR(item.amount_customer ?? item.amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "clamp(12px, 2vw, 16px) clamp(18px, 3vw, 28px)", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 24px", borderRadius: 12, border: "none", background: C.teal, color: "white", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit" }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Task Details Tab ─────────────────────────────────────────────────────────
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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "9px 0", borderBottom: `1px solid ${C.divider}`, gap: 12 }}>
      <span style={{ fontSize: "clamp(11px, 1.2vw, 12px)", color: C.textMuted, fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: "clamp(11px, 1.3vw, 13px)", color: color ?? C.textPrimary, fontWeight: 600, textAlign: "right", wordBreak: "break-word", maxWidth: "60%" }}>{value ?? "—"}</span>
    </div>
  );

  if (!taskId) return (
    <div style={{ padding: "clamp(32px, 5vw, 56px) 24px", textAlign: "center" }}>
      <Package size={40} style={{ color: C.textMuted, marginBottom: 12 }} />
      <div style={{ fontSize: 14, color: C.textMuted }}>No task linked to this refund.</div>
    </div>
  );

  if (loading) return (
    <div style={{ padding: "clamp(32px, 5vw, 56px) 24px", textAlign: "center" }}>
      <RefreshCw size={28} style={{ color: C.teal, animation: "spin 1s linear infinite", marginBottom: 12 }} />
      <div style={{ fontSize: 13, color: C.textMuted }}>Loading task details…</div>
    </div>
  );

  if (error || !task) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && (
        <div style={{ background: C.amberLight, borderRadius: 12, padding: "12px 16px", border: `1px solid ${C.amber}30`, display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={15} color={C.amber} />
          <span style={{ fontSize: 13, color: C.amber }}>Task endpoint unavailable ({error}).</span>
        </div>
      )}
      <div style={{ background: C.surface, borderRadius: 14, padding: 18, border: `1px solid ${C.border}` }}>
        <KV label="Task ID"   value={shortId(taskId)} />
        <KV label="Task Name" value={refund.task_name} />
      </div>
    </div>
  );

  const totalCost   = Number(task.totalCost    ?? task.basePrice   ?? 0);
  const workerPay   = Number(task.worker_payout ?? 0);
  const platformFee = Number(task.platform_fee  ?? 0);
  const hasSplit    = workerPay > 0 || platformFee > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ background: C.tealLight, borderRadius: 14, padding: 18, border: `1px solid ${C.teal}25` }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "clamp(14px, 2vw, 16px)", fontWeight: 700, color: C.textPrimary, marginBottom: 8 }}>
              {task.taskName ?? task.taskDescrip ?? "Unnamed Task"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {task.taskStatus    && <Chip label={task.taskStatus}                 color={C.teal}   icon={Activity}    />}
              {task.escrow_status && <Chip label={`Escrow: ${task.escrow_status}`} color={C.blue}   icon={Shield}      />}
              {task.payout_status && <Chip label={`Payout: ${task.payout_status}`} color={task.payout_status === "paid" ? C.green : C.amber} icon={DollarSign} />}
              {task.payment_method && <Chip label={task.payment_method}            color={C.purple} />}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: C.teal, fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Total Cost</div>
            <div style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 800, color: C.teal }}>{fmtNPR(totalCost)}</div>
          </div>
        </div>
      </div>

      {hasSplit && (
        <div style={{ background: C.surface, borderRadius: 14, padding: 18, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 14 }}>Payment Split</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
            {[
              { label: "Customer Paid", value: totalCost,   color: C.blue,  icon: CreditCard },
              { label: "Worker Payout", value: workerPay,   color: C.green, icon: Briefcase  },
              { label: "Platform Fee",  value: platformFee, color: C.brand, icon: BarChart2  },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} style={{ background: `${color}0D`, borderRadius: 12, padding: "14px 16px", border: `1px solid ${color}20` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Icon size={13} color={color} />
                  <span style={{ fontSize: "clamp(9px, 1vw, 11px)", color, fontWeight: 600, textTransform: "uppercase" }}>{label}</span>
                </div>
                <div style={{ fontSize: "clamp(15px, 2vw, 18px)", fontWeight: 800, color }}>{fmtNPR(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: C.surface, borderRadius: 14, padding: 18, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Task Information</div>
        <KV label="Task ID"      value={shortId(task._id ?? task.id)} />
        <KV label="Category"     value={task.taskCategory ?? task.category} />
        <KV label="Location"     value={task.location ?? task.address} />
        <KV label="Posted On"    value={`${fmt(task.createdAt ?? task.created_at)} ${fmtTime(task.createdAt ?? task.created_at)}`} />
        {task.completedAt && <KV label="Completed On" value={`${fmt(task.completedAt)} ${fmtTime(task.completedAt)}`} />}
        {task.released_at && <KV label="Released At"  value={`${fmt(task.released_at)} ${fmtTime(task.released_at)}`} />}
        {task.taskDescrip && task.taskName && (
          <div style={{ paddingTop: 10 }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 500, marginBottom: 6 }}>Description</div>
            <div style={{ fontSize: 13, color: C.textSecond, lineHeight: 1.6 }}>{task.taskDescrip}</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Refund Detail Modal ──────────────────────────────────────────────────────
const RefundDetailModal = ({ refund, onClose, onApprove, onReject, onDelete, onWaive, onEnforce }) => {
  const [activeTab,  setActiveTab]  = useState("refund");
  const [confirm,    setConfirm]    = useState(null);
  const [adminNote,  setAdminNote]  = useState(refund.admin_note || "");
  const [amtCust,    setAmtCust]    = useState(String(refund.amount_customer ?? refund.refund_amount ?? ""));
  const [amtWorker,  setAmtWorker]  = useState(String(refund.amount_worker   ?? refund.penalty_amount ?? ""));
  const backdropRef = useRef(null);
  const bp = useBreakpoint();
  const isMobile = bp === "xs" || bp === "sm";

  const isDispute = isDisputeCharge(refund);
  const isPending = refund.status === "pending";
  const accent    = isDispute ? C.dispute : C.teal;
  const refundId  = refund._id;
  const dispAmt   = Number(refund.amount_customer ?? refund.refund_amount ?? refund.amount ?? 0);
  const dispWkr   = Number(refund.amount_worker   ?? refund.penalty_amount ?? 0);
  const hasTask   = !!(refund.task_id ?? refund.taskId);

  const TABS = [
    { id: "refund", label: "Refund Details", icon: RotateCcw },
    { id: "task",   label: "Task Details",   icon: Package,  disabled: !hasTask },
  ];

  const DRow = ({ icon: Icon, label, value, valueColor }) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0", borderBottom: `1px solid ${C.divider}` }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: C.bg, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={12} color={C.textSecond} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "clamp(10px, 1.1vw, 11px)", color: C.textMuted, fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: "clamp(12px, 1.3vw, 13px)", color: valueColor || C.textPrimary, fontWeight: 500, wordBreak: "break-word" }}>{value ?? "—"}</div>
      </div>
    </div>
  );

  return (
    <>
      <div ref={backdropRef}
        onClick={e => { if (e.target === backdropRef.current) onClose(); }}
        style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(28,20,16,0.52)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? 0 : 16 }}>
        <div onClick={e => e.stopPropagation()}
          style={{ background: C.surface, borderRadius: isMobile ? "20px 20px 0 0" : 28, width: isMobile ? "100%" : "min(720px, 96vw)", maxHeight: isMobile ? "95vh" : "93vh", display: "flex", flexDirection: "column", boxShadow: "0 30px 60px rgba(0,0,0,0.28)", animation: "scaleIn 0.2s ease", overflow: "hidden", marginTop: isMobile ? "auto" : 0 }}>

          {/* Header */}
          <div style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`, padding: `clamp(14px, 2.5vw, 20px) clamp(16px, 3vw, 28px) 0`, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {isDispute ? <ShieldAlert size={20} color="white" /> : <RotateCcw size={20} color="white" />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600, marginBottom: 3 }}>{shortId(refundId)}</div>
                  <h2 style={{ color: "white", margin: 0, fontSize: "clamp(15px, 2.5vw, 19px)", fontWeight: 700 }}>
                    {isDispute ? "Dispute Charge" : "Refund Request"}
                  </h2>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                {!isMobile && <StatusBadge status={refund.status} />}
                {!isMobile && (isDispute ? <DisputeBadge /> : <AmountBadge amount={dispAmt} />)}
                <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                  <X size={15} />
                </button>
              </div>
            </div>

            {isPending && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                {isDispute ? (
                  <>
                    <button onClick={() => setConfirm({ type: "enforce", message: `Enforce dispute charge of ${fmtNPR(dispAmt)}? Worker will be deducted.` })}
                      style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: "rgba(255,255,255,0.95)", color: C.dispute, fontWeight: 700, fontSize: "clamp(11px, 1.3vw, 12px)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                      <ShieldAlert size={13} /> Enforce
                    </button>
                    <button onClick={() => setConfirm({ type: "waive", message: "Waive this dispute charge? No deduction will be made." })}
                      style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.35)", background: "transparent", color: "white", fontWeight: 600, fontSize: "clamp(11px, 1.3vw, 12px)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                      <Shield size={13} /> Waive
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setConfirm({ type: "approve", message: `Approve refund of ${fmtNPR(Number(amtCust) || dispAmt)} to customer and ${fmtNPR(Number(amtWorker) || dispWkr)} to worker? This will call the eSewa API immediately.` })}
                      style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: "rgba(255,255,255,0.95)", color: C.green, fontWeight: 700, fontSize: "clamp(11px, 1.3vw, 12px)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                      <ThumbsUp size={13} /> Approve & Pay
                    </button>
                    <button onClick={() => setConfirm({ type: "reject", message: "Reject this refund request?", danger: true })}
                      style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.35)", background: "transparent", color: "white", fontWeight: 600, fontSize: "clamp(11px, 1.3vw, 12px)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                      <ThumbsDown size={13} /> Reject
                    </button>
                  </>
                )}
                <button onClick={() => setConfirm({ type: "delete", message: "Permanently delete this record?", danger: true })}
                  style={{ padding: "8px 10px", borderRadius: 9, background: "rgba(255,255,255,0.12)", border: "none", color: "rgba(255,255,255,0.85)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            )}

            <div style={{ display: "flex", gap: 2 }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => !t.disabled && setActiveTab(t.id)}
                  style={{ padding: "10px clamp(12px, 2vw, 18px)", border: "none", background: activeTab === t.id ? C.surface : "transparent", color: activeTab === t.id ? accent : "rgba(255,255,255,0.75)", fontWeight: activeTab === t.id ? 700 : 500, fontSize: "clamp(11px, 1.3vw, 13px)", cursor: t.disabled ? "not-allowed" : "pointer", fontFamily: "inherit", borderRadius: "10px 10px 0 0", display: "flex", alignItems: "center", gap: 6, opacity: t.disabled ? 0.4 : 1 }}>
                  <t.icon size={13} />{!isMobile && t.label}
                  {isMobile && t.id === "refund" && "Refund"}
                  {isMobile && t.id === "task"   && "Task"}
                </button>
              ))}
            </div>
          </div>

          {/* Tab body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "clamp(14px, 2.5vw, 24px)", background: C.bg }}>
            {activeTab === "refund" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Amount cards */}
                <div style={{ display: "grid", gridTemplateColumns: isDispute ? "1fr" : "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  <div style={{ background: isDispute ? C.disputeLight : C.tealLight, borderRadius: 14, padding: "clamp(14px, 2vw, 18px)", border: `1px solid ${accent}25`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: "clamp(9px, 1vw, 11px)", color: accent, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>
                        {isDispute ? "Dispute Charge" : "Customer Refund"}
                      </div>
                      <div style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 800, color: dispAmt > 0 ? accent : C.textMuted }}>
                        {dispAmt > 0 ? fmtNPR(dispAmt) : "Not set"}
                      </div>
                      <div style={{ fontSize: "clamp(9px, 1vw, 11px)", color: accent + "99", marginTop: 4 }}>
                        {isDispute ? "Deducted from worker" : "Paid to customer via eSewa"}
                      </div>
                    </div>
                    <div style={{ width: 50, height: 50, borderRadius: 13, background: accent + "20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {isDispute ? <ShieldAlert size={24} color={accent} /> : <Wallet size={24} color={accent} />}
                    </div>
                  </div>

                  {!isDispute && (
                    <div style={{ background: C.blueLight, borderRadius: 14, padding: "clamp(14px, 2vw, 18px)", border: `1px solid ${C.blue}25`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: "clamp(9px, 1vw, 11px)", color: C.blue, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>
                          Worker Payout
                        </div>
                        <div style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 800, color: dispWkr > 0 ? C.blue : C.textMuted }}>
                          {dispWkr > 0 ? fmtNPR(dispWkr) : "Not set"}
                        </div>
                        <div style={{ fontSize: "clamp(9px, 1vw, 11px)", color: C.blue + "99", marginTop: 4 }}>
                          Paid to worker via eSewa
                        </div>
                      </div>
                      <div style={{ width: 50, height: 50, borderRadius: 13, background: C.blueLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Briefcase size={24} color={C.blue} />
                      </div>
                    </div>
                  )}
                </div>

                {/* In-progress banner */}
                {refund.status === "refund_in_progress" && (
                  <div style={{ background: C.amberLight, borderRadius: 14, padding: 16, border: `1px solid ${C.amber}30`, display: "flex", gap: 10 }}>
                    <Clock size={15} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: "clamp(11px, 1.3vw, 13px)", color: C.amber, lineHeight: 1.6 }}>
                      <strong>Queued for disbursement.</strong> Amounts are set. Use <strong>Pay All</strong> to trigger eSewa transfers for both customer and worker.
                    </div>
                  </div>
                )}

                {isDispute && (
                  <div style={{ background: C.disputeLight, borderRadius: 14, padding: 16, border: `1px solid ${C.disputeMid}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <ShieldAlert size={15} color={C.dispute} />
                      <span style={{ fontWeight: 700, color: C.dispute, fontSize: 13 }}>Dispute Charge</span>
                    </div>
                    <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.6)", display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <Info size={13} color={C.dispute} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: "clamp(11px, 1.2vw, 12px)", color: C.dispute, lineHeight: 1.5 }}>
                        {refund.status === "approved"
                          ? "Charge enforced. Worker deduction applied."
                          : (refund.status === "rejected" || refund.status === "declined")
                          ? "Charge waived. No deduction applied."
                          : "Approving deducts from worker's settlement. Does NOT trigger a customer refund."}
                      </span>
                    </div>
                  </div>
                )}

                {/* Editable amounts for pending non-dispute */}
                {isPending && !isDispute && (
                  <div style={{ background: C.surface, borderRadius: 14, padding: "clamp(14px, 2vw, 18px)", border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Set Refund Amounts</div>
                    <div style={{ fontSize: "clamp(11px, 1.2vw, 12px)", color: C.textMuted, marginBottom: 12, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Info size={12} color={C.textMuted} />
                      Both customer and worker will be paid immediately via eSewa upon approval.
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                      {[
                        { label: "Customer Refund",  value: amtCust,   setter: setAmtCust,   required: true,  hint: "Sent to customer via eSewa "    },
                        { label: "Worker Payout",    value: amtWorker, setter: setAmtWorker, required: false, hint: "Sent to worker via eSewa " },
                      ].map(({ label, value, setter, required, hint }) => (
                        <div key={label}>
                          <label style={{ fontSize: "clamp(10px, 1.1vw, 11px)", fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
                            {label} (NPR){required && <span style={{ color: C.red }}> *</span>}
                          </label>
                          <div style={{ fontSize: "clamp(9px, 1vw, 10px)", color: C.textMuted, marginBottom: 6 }}>{hint}</div>
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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
                  {[
                    { label: "Requester",  id: refund.requester_id ?? refund.customer_id, type: refund.requester_type ?? "customer" },
                    { label: isDispute ? "Charged To" : "Worker", id: refund.reported_id ?? refund.worker_email, type: refund.reported_type ?? "worker" },
                  ].map(({ label, id, type }) => (
                    <div key={label} style={{ background: C.surface, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>{label}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar type={type} size={36} />
                        <div>
                          <div style={{ fontSize: "clamp(11px, 1.3vw, 13px)", fontWeight: 600, color: C.textPrimary, marginBottom: 3, wordBreak: "break-all" }}>{shortId(id)}</div>
                          <TypeBadge type={type} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Info rows */}
                <div style={{ background: C.surface, borderRadius: 14, padding: "clamp(14px, 2vw, 18px)", border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Refund Information</div>
                  <DRow icon={AlertCircle} label="Reason"       value={refund.reason} />
                  <DRow icon={Link2}       label="Report ID"    value={refund.report_id ? shortId(refund.report_id) : "No linked report"} valueColor={refund.report_id ? accent : C.textMuted} />
                  {(refund.task_id ?? refund.taskId) && <DRow icon={Hash}       label="Task ID"    value={shortId(refund.task_id ?? refund.taskId)} />}
                  {refund.task_name && <DRow icon={FileText}   label="Task Name"  value={refund.task_name} />}
                  <DRow icon={Calendar}   label="Requested On" value={`${fmt(refund.created_at)} ${fmtTime(refund.created_at)}`} />
                  {refund.resolved_at && <DRow icon={CheckCircle} label="Resolved On" value={`${fmt(refund.resolved_at)} ${fmtTime(refund.resolved_at)}`} />}
                </div>

                {/* Disbursement result */}
                {!isDispute && refund.status === "refunded" && (
                  <div style={{ background: C.greenLight, borderRadius: 12, padding: "12px 16px", border: `1px solid ${C.green}30`, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <CheckCircle size={15} color={C.green} />
                      <span style={{ fontSize: "clamp(12px, 1.4vw, 13px)", color: C.green, fontWeight: 600 }}>eSewa disbursement confirmed</span>
                    </div>
                    {refund.esewa_refund?.transaction_uuid && (
                      <span style={{ fontSize: 11, color: C.green, paddingLeft: 23 }}>
                        Customer Txn: {refund.esewa_refund.transaction_uuid}
                      </span>
                    )}
                    {refund.worker_payout && (
                      <div style={{ paddingLeft: 23, fontSize: 11, color:
                        (refund.worker_payout.status === "sent" || refund.worker_payout.status === "mock_success" || refund.worker_payout.status === "success") ? C.blue :
                        refund.worker_payout.status === "no_phone" ? C.amber : C.red
                      }}>
                        Worker payout ({fmtNPR(dispWkr)}): {
                          (refund.worker_payout.status === "sent" || refund.worker_payout.status === "mock_success" || refund.worker_payout.status === "success")
                            ? `Sent to ${refund.worker_payout.phone || "worker account"}`
                            : refund.worker_payout.status === "no_phone"
                            ? "No phone on file — process manually"
                            : refund.worker_payout.error || "Failed"
                        }
                      </div>
                    )}
                  </div>
                )}

                {/* Admin note input */}
                {isPending && (
                  <div style={{ background: C.surface, borderRadius: 14, padding: "clamp(14px, 2vw, 18px)", border: `1px solid ${C.border}` }}>
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
                    <Package size={15} /> View Task Details <ChevronRight size={14} />
                  </button>
                )}
              </div>
            )}

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
            if (confirm.type === "approve") onApprove(refundId, adminNote, cAmt, wAmt);
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

// ── Refund Card (mobile) ─────────────────────────────────────────────────────
const RefundCard = ({ refund, onSelect }) => {
  const isDispute = isDisputeCharge(refund);
  const amount    = Number(refund.amount_customer ?? refund.refund_amount ?? refund.amount ?? 0);
  return (
    <div onClick={() => onSelect(refund)}
      style={{ background: isDispute ? C.dispute + "06" : C.surface, borderRadius: 16, padding: "14px 16px", border: `1px solid ${isDispute ? C.disputeMid : C.border}`, marginBottom: 10, cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isDispute && <ShieldAlert size={13} color={C.dispute} />}
          <span style={{ fontSize: 12, fontWeight: 700, color: isDispute ? C.dispute : C.textMuted }}>{shortId(refund._id)}</span>
        </div>
        <StatusBadge status={refund.status ?? refund.refund_status} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, color: C.textSecond, marginBottom: 4, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{refund.reason || "—"}</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>{fmt(refund.created_at)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          {isDispute ? <DisputeBadge /> : <AmountBadge amount={amount} />}
          {Number(refund.amount_worker ?? 0) > 0 && (
            <div style={{ fontSize: 10, color: C.blue, fontWeight: 600, marginTop: 4, display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
              <Briefcase size={9} /> Worker: {fmtNPR(refund.amount_worker)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Refund Table Row (desktop) ───────────────────────────────────────────────
const RefundRow = ({ refund, onSelect, onApprove, onReject, onDelete, onWaive, onEnforce }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const isDispute = isDisputeCharge(refund);
  const amount    = Number(refund.amount_customer ?? refund.refund_amount ?? refund.amount ?? 0);

  const handleAction = (action) => {
    if (action === "view")    onSelect(refund);
    // ✅ FIXED: pass amount_worker instead of hardcoded 0
    if (action === "approve") onApprove(refund._id, "", amount, Number(refund.amount_worker ?? 0));
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
            <TypeBadge type={refund.requester_type ?? "customer"} />
          </div>
        </div>
      </td>
      <td style={{ padding: "13px 16px" }}>
        {isDispute ? <DisputeBadge /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <AmountBadge amount={amount} />
            {Number(refund.amount_worker ?? 0) > 0 && (
              <span style={{ fontSize: 10, color: C.blue, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
                <Briefcase size={9} /> Worker: {fmtNPR(refund.amount_worker)}
              </span>
            )}
          </div>
        )}
      </td>
      <td style={{ padding: "13px 16px" }}>
        <div style={{ fontSize: 13, color: C.textSecond, fontWeight: 500, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{refund.reason || "—"}</div>
        {refund.task_name && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{refund.task_name}</div>}
      </td>
      <td style={{ padding: "13px 16px" }}><StatusBadge status={refund.status ?? refund.refund_status} /></td>
      <td style={{ padding: "13px 16px" }}>
        <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 500 }}>{fmt(refund.created_at)}</div>
        <div style={{ fontSize: 11, color: C.textMuted }}>{fmtTime(refund.created_at)}</div>
      </td>
      <td style={{ padding: "13px 16px" }} onClick={e => e.stopPropagation()}>
        <div style={{ position: "relative", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => setMenuOpen(v => !v)}
            style={{ padding: "7px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", color: C.textMuted, display: "flex", alignItems: "center" }}>
            <MoreVertical size={15} />
          </button>
          {menuOpen && <ContextMenu refund={refund} onAction={handleAction} onClose={() => setMenuOpen(false)} />}
        </div>
      </td>
    </tr>
  );
};

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
      { label: "Approve & Pay",  icon: CheckCircle, action: "approve", color: C.green   },
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

// ── Main RefundManagement Component ─────────────────────────────────────────
export default function RefundManagement() {
  const [refunds,          setRefunds]          = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState(null);
  const [stats,            setStats]            = useState({
    total: 0, pending: 0, approved: 0, rejected: 0, refunded: 0,
    totalAmount: 0, approvedAmount: 0,
    disputePending: 0,
    inProgress: 0, inProgressAmount: 0,
  });
  const [search,           setSearch]           = useState("");
  const [filterStatus,     setFilterStatus]     = useState("all");
  const [filterType,       setFilterType]       = useState("all");
  const [selected,         setSelected]         = useState(null);
  const [toast,            setToast]            = useState(null);
  const [confirm,          setConfirm]          = useState(null);
  const [currentPage,      setCurrentPage]      = useState(1);
  const [totalCount,       setTotalCount]       = useState(0);
  const [payAllModal,      setPayAllModal]      = useState(false);
  const [payAllResult,     setPayAllResult]     = useState(null);
  const [payAllProcessing, setPayAllProcessing] = useState(false);

  const bp       = useBreakpoint();
  const isMobile = bp === "xs" || bp === "sm";
  const isTablet = bp === "md";
  const PAGE_SIZE = 50;
  const isFirst   = useRef(true);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  const normalize = useCallback((list) => list.map(r => ({
    ...r,
    _id:             String(r._id ?? r.refund_id ?? r.id ?? ""),
    amount_customer: r.amount_customer ?? r.refund_amount ?? r.amount ?? 0,
    amount_worker:   r.amount_worker   ?? r.penalty_amount ?? 0,
    status:          r.refund_status   ?? r.status ?? "pending",
  })), []);

  const fetchPage = useCallback(async (page, q = search) => {
    try {
      setLoading(true); setError(null);
      const skip   = (page - 1) * PAGE_SIZE;
      const params = new URLSearchParams({ skip, limit: PAGE_SIZE });
      if (q?.trim()) params.append("search", q.trim());
      if (filterType === "dispute") params.append("type", "dispute");
      if (filterType === "refund")  params.append("type", "refund");

      let response = null;

      if (filterStatus === "pending") {
        response = await apiCall(`${BASE}/refunds/pending?${params}`).catch(() => null);
      } else if (filterStatus === "approved") {
        response = await apiCall(`${BASE}/refunds/approved?${params}`).catch(() => null);
      } else if (filterStatus === "rejected") {
        response = await apiCall(`${BASE}/refunds/rejected?${params}`).catch(() => null);
      } else if (filterStatus === "in_progress") {
        response = await apiCall(`${BASE}/refunds/in-progress?${params}`).catch(() => null);
      } else {
        const unified = await apiCall(`${BASE}/refunds?${params}`).catch(() => null);
        if (unified?.ok) {
          const d    = await unified.json();
          const list = normalize(d.refunds ?? d.items ?? d.data ?? d ?? []);
          setRefunds(list); setTotalCount(d.total ?? list.length);
          setCurrentPage(page); setLoading(false);
          return;
        }

        const [pRes, aRes, rRes, iRes] = await Promise.all([
          apiCall(`${BASE}/refunds/pending`).catch(() => null),
          apiCall(`${BASE}/refunds/approved`).catch(() => null),
          apiCall(`${BASE}/refunds/rejected`).catch(() => null),
          apiCall(`${BASE}/refunds/in-progress`).catch(() => null),
        ]);

        let combined = [];
        const merge = (res, fallbackStatus) => {
          if (res?.ok) return res.json().then(d => (d.refunds ?? []).map(r => ({ ...r, status: r.refund_status ?? fallbackStatus })));
          return Promise.resolve([]);
        };
        const [p, a, r, i] = await Promise.all([
          merge(pRes, "pending"), merge(aRes, "approved"),
          merge(rRes, "rejected"), merge(iRes, "refund_in_progress"),
        ]);
        combined = [...p, ...a, ...r, ...i];

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
        setTotalCount(list.length); setCurrentPage(page); setLoading(false);
        return;
      }

      if (response?.ok) {
        const d    = await response.json();
        const list = normalize(d.refunds ?? d.items ?? d.data ?? d ?? []);
        setRefunds(list); setTotalCount(d.total ?? list.length);
        setCurrentPage(page);
      } else {
        throw new Error(`Failed to fetch refunds`);
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
      const [pRes, aRes, rRes, iRes] = await Promise.all([
        apiCall(`${BASE}/refunds/pending`).catch(() => null),
        apiCall(`${BASE}/refunds/approved`).catch(() => null),
        apiCall(`${BASE}/refunds/rejected`).catch(() => null),
        apiCall(`${BASE}/refunds/in-progress`).catch(() => null),
      ]);
      const sum = (list, key) => list.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
      let pending = [], approved = [], rejected = [], inProgress = [];
      if (pRes?.ok) { const d = await pRes.json(); pending    = d.refunds ?? []; }
      if (aRes?.ok) { const d = await aRes.json(); approved   = d.refunds ?? []; }
      if (rRes?.ok) { const d = await rRes.json(); rejected   = d.refunds ?? []; }
      if (iRes?.ok) { const d = await iRes.json(); inProgress = d.refunds ?? []; }

      const refunded         = approved.filter(r => r.status === "refunded");
      const inProgressAmount = inProgress.reduce((acc, r) => 
  acc + (Number(r.amount_customer) || 0) + (Number(r.amount_worker) || 0), 0
);

      setStats({
        total:           pending.length + approved.length + rejected.length + inProgress.length,
        pending:         pending.length,
        approved:        approved.filter(r => r.status !== "refunded").length,
        rejected:        rejected.length,
        refunded:        refunded.length,
        inProgress:      inProgress.length,
        inProgressAmount,
        totalAmount:     sum(pending, "amount_customer") + sum(approved, "amount_customer") + inProgressAmount,
        approvedAmount:  sum(refunded, "amount_customer"),
        disputePending:  pending.filter(isDisputeCharge).length,
      });
    } catch (e) {
      console.error("Error fetching stats:", e);
    }
  }, []);

  const handlePayAll = async () => {
    setPayAllProcessing(true);
    try {
      const res = await apiCall(`${BASE}/refunds/pay-all-in-progress`, { method: "POST" });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Disbursement failed");
      }
      const result = await res.json();
      setPayAllResult(result);
      await fetchPage(currentPage, search);
      await fetchStats();

      const okCount   = result.success?.length ?? 0;
      const failCount = Array.isArray(result.failed) ? result.failed.length : 0;

      showToast(
        failCount === 0
          ? `✓ All ${okCount} refund${okCount !== 1 ? "s" : ""} disbursed via eSewa`
          : `Disbursed ${okCount}, ${failCount} failed — check results`,
        failCount === 0 ? "success" : "warning"
      );
    } catch (e) {
      showToast(`Disbursement failed: ${e.message}`, "error");
    } finally {
      setPayAllProcessing(false);
      setPayAllModal(false);
    }
  };

  const handleApprove = async (id, note, amtC, amtW) => {
    const res = await patchStatus(id, "approved", note, amtC, amtW);
    if (!res.ok) {
      const b = await res.text().catch(() => "");
      showToast(`Failed to approve: ${b}`, "error");
      return null;
    }
    const data = await res.json().catch(() => ({}));

    const customerRefund  = data.customer_refund  || data.customer_disburse || data.esewa_refund;
    const workerPayout    = data.worker_payout     || data.worker_disburse;
    const PAYOUT_SUCCESS = ["success", "sent", "mock_success"];

    const customerSuccess = PAYOUT_SUCCESS.includes(customerRefund?.status) || data.customer_refunded === true;
    const workerSuccess   = PAYOUT_SUCCESS.includes(workerPayout?.status)   || data.worker_paid === true;
    
    let actualStatus = "approved";
    let toastMsg     = "";
    let toastType    = "error";

    if (customerSuccess && (amtW === 0 || workerSuccess)) {
      actualStatus = "refunded";
      toastMsg     = "✓ Refund disbursed via eSewa successfully";
      toastType    = "success";
    } else if (customerSuccess) {
      actualStatus = "refund_in_progress";
      toastMsg     = "⚠ Customer refunded. Worker payout failed — retry via Pay All.";
      toastType    = "warning";
    } else if (workerSuccess) {
      actualStatus = "refund_in_progress";
      toastMsg     = "⚠ Worker paid. Customer refund failed — retry via Pay All.";
      toastType    = "warning";
    } else {
      actualStatus = "refund_in_progress";
      toastMsg     = "eSewa call failed — refund queued for Pay All retry.";
      toastType    = "warning";
    }
    try {
      const freshRes = await apiCall(`${BASE}/refunds/${id}`);
      if (freshRes.ok) {
        const freshData = await freshRes.json();
        const fresh = normalize([freshData.refund ?? freshData])[0];
        setRefunds(prev => prev.map(r => r._id === id ? fresh : r));
        if (selected?._id === id) setSelected(fresh);
      }
    } catch {
      // fallback to local update if refetch fails
      setRefunds(prev => prev.map(r => r._id === id ? {
        ...r,
        status:          actualStatus,
        admin_note:      note,
        amount_customer: amtC,
        amount_worker:   amtW,
        esewa_refund:    customerRefund,
        worker_payout:   workerPayout,
      } : r));
      if (selected?._id === id) setSelected(prev => ({
        ...prev,
        status:          actualStatus,
        admin_note:      note,
        amount_customer: amtC,
        amount_worker:   amtW,
        esewa_refund:    customerRefund,
        worker_payout:   workerPayout,
      }));
    }
    showToast(toastMsg, toastType);
    fetchStats();
    return data;
  };

  const handleReject = async (id, note) => {
    const res = await patchStatus(id, "declined", note, null, null);
    if (!res.ok) { showToast("Failed to reject", "error"); return; }
    setRefunds(p => p.map(r => r._id === id ? { ...r, status: "declined", admin_note: note } : r));
    if (selected?._id === id) setSelected(p => ({ ...p, status: "declined", admin_note: note }));
    setStats(p => ({ ...p, pending: Math.max(0, p.pending - 1), rejected: p.rejected + 1 }));
    showToast("Refund rejected");
    fetchStats();
  };

  const handleEnforce = async (id, note) => {
    const res = await patchStatus(id, "approved", note, null, null);
    if (!res.ok) { showToast("Failed to enforce", "error"); return; }
    setRefunds(p => p.map(r => r._id === id ? { ...r, status: "approved", admin_note: note } : r));
    if (selected?._id === id) setSelected(p => ({ ...p, status: "approved", admin_note: note }));
    showToast("Dispute charge enforced");
    fetchStats();
  };

  const handleWaive = async (id, note) => {
    const res = await patchStatus(id, "declined", note, null, null);
    if (!res.ok) { showToast("Failed to waive", "error"); return; }
    setRefunds(p => p.map(r => r._id === id ? { ...r, status: "declined", admin_note: note } : r));
    if (selected?._id === id) setSelected(p => ({ ...p, status: "declined", admin_note: note }));
    showToast("Dispute charge waived");
    fetchStats();
  };

  const handleDelete = async (id) => {
    setConfirm({
      message: "Permanently delete this record? This cannot be undone.", danger: true,
      onConfirm: async () => {
        setConfirm(null);
        const token = getToken();
        const res = await fetch(`${BASE}/refunds/${id}`, {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).catch(() => null);
        if (!res?.ok) { showToast(res?.status === 404 ? "Delete endpoint not available" : "Failed to delete", "error"); return; }
        setRefunds(p => p.filter(r => r._id !== id));
        setTotalCount(p => p - 1);
        if (selected?._id === id) setSelected(null);
        showToast("Record deleted");
        fetchStats();
      },
    });
  };

  useEffect(() => { fetchPage(1, ""); fetchStats(); }, []);
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    const t = setTimeout(() => fetchPage(1, search), 400);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { if (!isFirst.current) fetchPage(1, search); }, [filterStatus, filterType]);

  const totalPages   = Math.ceil(totalCount / PAGE_SIZE);
  const disputeCount = refunds.filter(isDisputeCharge).length;
  const refundCount  = refunds.filter(r => !isDisputeCharge(r)).length;

  const Pill = ({ active, onClick, label, color }) => {
    const c = color ?? C.teal;
    return (
      <button onClick={onClick} style={{ padding: "6px clamp(10px, 1.5vw, 14px)", borderRadius: 20, cursor: "pointer", fontSize: "clamp(11px, 1.2vw, 12px)", border: `1px solid ${active ? c + "50" : C.border}`, background: active ? c + "18" : C.surface, color: active ? c : C.textSecond, fontWeight: active ? 600 : 500, transition: "all 0.15s", fontFamily: "inherit", whiteSpace: "nowrap" }}>
        {label}
      </button>
    );
  };

  const statsColumns = isMobile ? "repeat(2, 1fr)" : isTablet ? "repeat(4, 1fr)" : "repeat(8, 1fr)";

  return (
    <>
    <BookingNavbar />
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: C.bg, minHeight: "100vh", padding: "clamp(12px, 2.5vw, 24px)" }}>
      {toast   && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {confirm && <ConfirmDialog message={confirm.message} danger={confirm.danger} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
      {payAllModal && (
        <PayAllModal
          inProgressCount={stats.inProgress}
          inProgressAmount={stats.inProgressAmount}
          onConfirm={handlePayAll}
          onCancel={() => setPayAllModal(false)}
          processing={payAllProcessing}
        />
      )}
      {payAllResult && <PayAllResultModal result={payAllResult} onClose={() => setPayAllResult(null)} />}

      <style>{`
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", marginBottom: "clamp(16px, 2.5vw, 24px)", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: "clamp(20px, 3.5vw, 27px)", fontWeight: 700, color: C.textPrimary, letterSpacing: "-0.01em" }}>Refunds & Disputes</h1>
          <p style={{ margin: 0, fontSize: "clamp(11px, 1.3vw, 13px)", color: C.textMuted }}>
            <span style={{ color: C.teal,    fontWeight: 600 }}>{refundCount} refunds</span> ·{" "}
            <span style={{ color: C.dispute, fontWeight: 600 }}>{disputeCount} dispute charges</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {stats.inProgress > 0 && (
            <button
              onClick={() => setPayAllModal(true)}
              style={{ padding: "clamp(9px, 1.5vw, 11px) clamp(14px, 2vw, 24px)", borderRadius: 12, border: "none", background: `linear-gradient(135deg, ${C.green} 0%, ${C.teal} 100%)`, cursor: "pointer", fontSize: "clamp(12px, 1.5vw, 14px)", fontWeight: 700, color: "white", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", boxShadow: "0 4px 12px rgba(61,158,110,0.3)" }}>
              <Send size={15} /> Pay All — {fmtNPR(stats.inProgressAmount)}
            </button>
          )}
          <button onClick={() => { fetchPage(1, search); fetchStats(); }}
            style={{ padding: "clamp(9px, 1.5vw, 10px) clamp(12px, 1.8vw, 18px)", borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", fontSize: "clamp(12px, 1.5vw, 14px)", color: C.textSecond, display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}>
            <RefreshCw size={15} /> {!isMobile && "Refresh"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: statsColumns, gap: "clamp(8px, 1.5vw, 12px)", marginBottom: "clamp(14px, 2vw, 22px)" }}>
        <StatCard label="Total"           value={stats.total}                                                  color={C.teal}    icon={Receipt}     />
        <StatCard label="Pending"         value={stats.pending}                                                color={C.brand}   icon={Clock}       sub="Awaiting decision" />
        <StatCard label="In Progress"     value={stats.inProgress}                                             color={C.amber}   icon={RefreshCw}   sub={fmtNPR(stats.inProgressAmount)} />
        <StatCard label="Approved"        value={stats.approved}                                               color={C.blue}    icon={CheckCircle} sub="Ready for disbursement" />
        <StatCard label="Refunded"        value={stats.refunded}                                               color={C.green}   icon={CheckCircle} sub="eSewa confirmed" />
        <StatCard label="Rejected"        value={stats.rejected}                                               color={C.red}     icon={XCircle}     />
        <StatCard label="Total Requested" value={`NPR ${Number(stats.totalAmount    ?? 0).toLocaleString()}`} color={C.blue}    icon={Wallet}      />
        <StatCard label="Total Refunded"  value={`NPR ${Number(stats.approvedAmount ?? 0).toLocaleString()}`} color={C.green}   icon={CreditCard}  />
      </div>

      {stats.pending > 0 && (
        <div style={{ background: C.brandLight, borderRadius: 14, padding: "clamp(10px, 1.8vw, 14px) clamp(14px, 2.5vw, 20px)", marginBottom: 16, border: `1px solid ${C.brand}30`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Clock size={18} color={C.brand} style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 700, color: C.brand, fontSize: "clamp(12px, 1.5vw, 14px)" }}>{stats.pending} refund{stats.pending > 1 ? "s" : ""} awaiting decision</span>
          <span style={{ fontSize: "clamp(11px, 1.3vw, 13px)", color: C.textSecond }}>— set amounts and approve to disburse via eSewa</span>
        </div>
      )}

      {stats.inProgress > 0 && (
        <div style={{ background: C.amberLight, borderRadius: 14, padding: "clamp(10px, 1.8vw, 14px) clamp(14px, 2.5vw, 20px)", marginBottom: 16, border: `1px solid ${C.amber}30`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <RefreshCw size={18} color={C.amber} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, color: C.amber, fontSize: "clamp(12px, 1.5vw, 14px)" }}>{stats.inProgress} refund{stats.inProgress > 1 ? "s" : ""} ready for eSewa disbursement</span>
            <span style={{ fontSize: "clamp(11px, 1.3vw, 13px)", color: C.textSecond, marginLeft: 8 }}>— {fmtNPR(stats.inProgressAmount)} total</span>
          </div>
          <button onClick={() => setPayAllModal(true)}
            style={{ padding: "8px 18px", borderRadius: 20, border: "none", background: `linear-gradient(135deg, ${C.green} 0%, ${C.teal} 100%)`, color: "white", fontSize: "clamp(11px, 1.3vw, 13px)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Send size={13} /> Pay All
          </button>
        </div>
      )}

      <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: "clamp(12px, 2vw, 16px) clamp(14px, 2.5vw, 20px)", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <div style={{ flex: 2, position: "relative", minWidth: "min(200px, 100%)" }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted }} />
            <input type="text" placeholder="Search by ID, reason, task…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: "clamp(12px, 1.3vw, 13px)", outline: "none", background: C.bg, color: C.textPrimary, fontFamily: "inherit" }}
              onFocus={e => { e.target.style.borderColor = C.teal; e.target.style.background = C.surface; }}
              onBlur={e  => { e.target.style.borderColor = C.border; e.target.style.background = C.bg; }}
            />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[["all","All"],["pending","Pending",C.brand],["in_progress","In Progress",C.amber],["approved","Approved",C.blue],["refunded","Refunded",C.green],["rejected","Rejected",C.red]].map(([v,l,c]) => (
              <Pill key={v} active={filterStatus === v} onClick={() => setFilterStatus(v)} label={l} color={c} />
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, paddingTop: 10, borderTop: `1px solid ${C.divider}`, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginRight: 4 }}>Type</span>
          <Pill active={filterType === "all"}     onClick={() => setFilterType("all")}     label="All"      />
          <Pill active={filterType === "refund"}  onClick={() => setFilterType("refund")}  label="Refunds"  color={C.teal}    />
          <Pill active={filterType === "dispute"} onClick={() => setFilterType("dispute")} label="Disputes" color={C.dispute} />
        </div>
      </div>

      <div style={{ background: C.surface, borderRadius: 20, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.08)" }}>
        {loading ? (
          <div style={{ padding: "clamp(40px, 8vw, 80px) 24px", textAlign: "center" }}>
            <RefreshCw size={38} style={{ color: C.teal, marginBottom: 14, animation: "spin 1s linear infinite" }} />
            <p style={{ color: C.textSecond, margin: 0, fontSize: 14 }}>Loading records…</p>
          </div>
        ) : error ? (
          <div style={{ padding: "clamp(40px, 8vw, 80px) 24px", textAlign: "center" }}>
            <AlertTriangle size={38} style={{ color: C.red, marginBottom: 14 }} />
            <p style={{ color: C.red, margin: 0, fontSize: 14 }}>{error}</p>
          </div>
        ) : refunds.length === 0 ? (
          <div style={{ padding: "clamp(40px, 8vw, 80px) 24px", textAlign: "center" }}>
            <RotateCcw size={44} style={{ color: C.textMuted, marginBottom: 14 }} />
            <h3 style={{ margin: "0 0 6px", color: C.textPrimary, fontSize: 17 }}>No records found</h3>
            <p style={{ color: C.textMuted, margin: 0, fontSize: 13 }}>
              {search || filterStatus !== "all" || filterType !== "all" ? "Try adjusting your filters" : "No refund or dispute records yet"}
            </p>
          </div>
        ) : isMobile ? (
          <div style={{ padding: "clamp(12px, 2vw, 16px)" }}>
            {refunds.map(r => (
              <RefundCard key={r._id} refund={r} onSelect={setSelected} />
            ))}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
              <thead>
                <tr style={{ background: C.bg, borderBottom: `2px solid ${C.border}` }}>
                  {["ID / Report", "Requester", "Amounts", "Reason", "Status", "Date", ""].map((h, i) => (
                    <th key={h || i} style={{ padding: "13px 16px", textAlign: i === 6 ? "right" : "left", fontSize: "clamp(9px, 1vw, 11px)", fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>{h}</th>
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
          </div>
        )}
      </div>

      {!loading && !error && totalCount > 0 && (
        <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: "clamp(11px, 1.2vw, 12px)", color: C.textMuted }}>
            {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button onClick={() => fetchPage(currentPage - 1, search)} disabled={currentPage === 1}
              style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: currentPage === 1 ? C.bg : C.surface, color: currentPage === 1 ? C.textMuted : C.textSecond, cursor: currentPage === 1 ? "default" : "pointer", display: "flex", alignItems: "center" }}>
              <ChevronLeft size={15} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= (isMobile ? 0 : 1))
              .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx - 1] > 1) acc.push("..."); acc.push(p); return acc; }, [])
              .map((p, i) => p === "..." ? (
                <span key={`d${i}`} style={{ padding: "6px 4px", fontSize: 13, color: C.textMuted }}>…</span>
              ) : (
                <button key={p} onClick={() => fetchPage(p, search)}
                  style={{ padding: "6px clamp(8px, 1.2vw, 12px)", borderRadius: 8, border: `1px solid ${C.border}`, background: currentPage === p ? C.textPrimary : C.surface, color: currentPage === p ? "white" : C.textSecond, cursor: "pointer", fontSize: "clamp(11px, 1.2vw, 13px)", fontWeight: currentPage === p ? 700 : 500, fontFamily: "inherit" }}>
                  {p}
                </button>
              ))}
            <button onClick={() => fetchPage(currentPage + 1, search)} disabled={currentPage >= totalPages}
              style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: currentPage >= totalPages ? C.bg : C.surface, color: currentPage >= totalPages ? C.textMuted : C.textSecond, cursor: currentPage >= totalPages ? "default" : "pointer", display: "flex", alignItems: "center" }}>
              <ChevRight size={15} />
            </button>
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