// FraudDashboard.jsx
import { useEffect, useState, useCallback } from "react";
import {
  Trash2, KeyRound, AlertTriangle, UserX, Eye, RefreshCw,
  ShieldAlert, Mail, Calendar, Phone, X, CheckCircle, XCircle,
  ScanLine, Users, Clock, Star, MapPin, Briefcase,
} from "lucide-react";
import { useFraudWorker, SCAN_INTERVALS } from "./useFraudWorker";

const API_BASE = "http://127.0.0.1:8000/api";

const getToken = () => {
  try {
    const u = localStorage.getItem("user");
    if (u) return JSON.parse(u)?.token;
    return localStorage.getItem("access_token") || localStorage.getItem("token") || null;
  } catch { return null; }
};

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

const C = {
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
  dark:         "#111827",
  gray:         "#6b7280",
  grayLight:    "#f9fafb",
  orange:       "#ea580c",
  orangeLight:  "#fff7ed",
  orangeBorder: "#fed7aa",
};

const fmtDateTime = (date) => {
  if (!date) return "—";
  try { return new Date(date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
};

const fmtCountdown = (ms) => {
  if (!ms || ms <= 0) return "now";
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
};

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 99999, background: type === "error" ? "#ef4444" : type === "warning" ? "#f59e0b" : "#10b981", color: "white", padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 500, boxShadow: "0 10px 25px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: 8 }}>
      {type === "success" && <CheckCircle size={18} />}
      {type === "error"   && <XCircle size={18} />}
      {type === "warning" && <AlertTriangle size={18} />}
      {message}
    </div>
  );
};

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

const RiskPill = ({ level }) => {
  const map = {
    clean:    { color: C.green,  bg: C.greenLight,  border: C.greenBorder,  label: "Clean"    },
    monitor:  { color: C.yellow, bg: C.yellowLight, border: C.yellowBorder, label: "Monitor"  },
    restrict: { color: C.orange, bg: C.orangeLight, border: C.orangeBorder, label: "Restrict" },
    suspend:  { color: C.red,    bg: C.redLight,    border: C.redBorder,    label: "Suspend"  },
  };
  const s = map[level] || map.monitor;
  return <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, padding: "3px 11px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{s.label}</span>;
};

const Avatar = ({ user, size = 38, fontSize = 14 }) => {
  const name = user.first_name || user.firstName || "";
  const last = user.last_name  || user.lastName  || "";
  const initials = `${name[0] ?? user.user_id?.[0] ?? "?"}${last[0] ?? ""}`.toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#F7BE88,#F7BE88dd)", color: "white", fontWeight: 600, fontSize, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "2px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      {initials}
    </div>
  );
};

const StatCard = ({ label, value, sub, accent }) => (
  <div style={{ background: C.surface, borderRadius: 16, padding: "20px 24px", border: `1px solid ${C.border}`, flex: "1 1 180px", minWidth: 140, borderLeft: `4px solid ${accent || C.border}` }}>
    <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 6, fontWeight: 500 }}>{sub}</div>}
  </div>
);

const Spinner = ({ size = 28, color = C.amber }) => (
  <div style={{ width: size, height: size, border: `3px solid ${C.border}`, borderTop: `3px solid ${color}`, borderRadius: "50%", animation: "spin 0.75s linear infinite", flexShrink: 0 }} />
);

const SignalTags = ({ signals }) => {
  const getColor = (score) => {
    if (score >= 35) return { bg: C.redLight,    color: C.red,    border: C.redBorder    };
    if (score >= 20) return { bg: C.orangeLight, color: C.orange, border: C.orangeBorder };
    return                   { bg: C.yellowLight, color: "#b45309", border: C.yellowBorder };
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {signals.slice(0, 3).map((s, i) => { const c = getColor(s.score); return <span key={i} title={s.reason} style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>{s.name}: +{s.score}</span>; })}
      {signals.length > 3 && <span style={{ fontSize: 10, color: C.muted, padding: "2px 6px" }}>+{signals.length - 3} more</span>}
    </div>
  );
};

// ── Scan Status Bar ───────────────────────────────────────────────────────────
const ScanStatusBar = ({ isScanning, lastScanAt, nextScanIn, progress, total, scanInterval, onScanNow, onIntervalChange }) => {
  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 18px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, flexWrap: "wrap" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: isScanning ? C.amber : C.green, animation: isScanning ? "pulse 1.2s ease-in-out infinite" : "none" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: isScanning ? C.amber : C.green }}>
            {isScanning ? `Scanning${total > 0 ? ` ${pct}%` : "…"}` : "Idle · Worker Active"}
          </span>
        </div>

        {isScanning && total > 0 && (
          <div style={{ flex: "1 1 200px", minWidth: 120 }}>
            <div style={{ background: C.border, borderRadius: 999, height: 7, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 999, background: `linear-gradient(90deg,${C.amber},#f5a623)`, width: `${pct}%`, transition: "width 0.3s ease" }} />
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{progress.toLocaleString()} / {total.toLocaleString()} users</div>
          </div>
        )}

        <div style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 5 }}>
          <Clock size={11} />
          Last: <strong style={{ color: C.text, marginLeft: 3 }}>{lastScanAt ? fmtDateTime(lastScanAt) : "—"}</strong>
        </div>

        {!isScanning && nextScanIn > 0 && (
          <div style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 5 }}>
            Next in: <strong style={{ color: C.amber, marginLeft: 3 }}>{fmtCountdown(nextScanIn)}</strong>
          </div>
        )}

        <select value={scanInterval} onChange={e => onIntervalChange(Number(e.target.value))}
          style={{ fontSize: 11, padding: "4px 8px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.grayLight, color: C.text, fontWeight: 600, cursor: "pointer" }}>
          {SCAN_INTERVALS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      <button onClick={onScanNow} disabled={isScanning}
        style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, border: "none", background: isScanning ? C.border : C.amber, color: isScanning ? C.muted : "white", fontWeight: 700, fontSize: 12, cursor: isScanning ? "not-allowed" : "pointer", flexShrink: 0 }}>
        {isScanning ? <Spinner size={12} color="white" /> : <ScanLine size={12} />}
        {isScanning ? "Scanning…" : "Scan Now"}
      </button>
    </div>
  );
};

// ── User Detail Modal ─────────────────────────────────────────────────────────
const UserDetailModal = ({ user, onClose, onDelete, onStatusUpdate, onResetPassword }) => {
  const [tempPassword, setTemp]        = useState(null);
  const [confirm,      setConfirm]     = useState(null);
  const [userInfo,     setUserInfo]    = useState(null);
  const [loadingInfo,  setLoadingInfo] = useState(true);
  const [infoError,    setInfoError]   = useState(null);

  const fullName = [user.first_name || user.firstName, user.last_name || user.lastName]
    .filter(Boolean).join(" ").trim() || user.user_id || "Unknown User";

  useEffect(() => {
    const load = async () => {
      setLoadingInfo(true); setInfoError(null);
      for (const [endpoint, role] of [
        [`${API_BASE}/customer/${user.user_id}`, "customer"],
        [`${API_BASE}/worker/${user.user_id}`,   "worker"  ],
      ]) {
        try {
          const res = await fetch(endpoint, { headers: authHeaders() });
          if (res.ok) {
            const d = await res.json();
            setUserInfo({ ...d, role, phone: d.phoneNo || d.phone_no || d.phone || d.phoneNumber || null, status: d.status || d.accountStatus || "active" });
            setLoadingInfo(false);
            return;
          }
        } catch { /* try next */ }
      }
      setInfoError("Could not load profile.");
      setLoadingInfo(false);
    };
    load();
  }, [user.user_id]);

  const handleAction = (type) => {
    const msgs = { delete: `Delete ${fullName}? Cannot be undone.`, suspend: `Suspend ${fullName}?`, activate: `Activate ${fullName}?`, reset: `Reset password for ${fullName}?` };
    setConfirm({ type, message: msgs[type] });
  };

  const handleConfirm = async () => {
    const { type } = confirm; setConfirm(null);
    if (type === "delete")   { await onDelete(user.user_id); onClose(); return; }
    if (type === "suspend")  await onStatusUpdate(user.user_id, "suspended");
    if (type === "activate") await onStatusUpdate(user.user_id, "active");
    if (type === "reset")    { const pwd = await onResetPassword(user.user_id); if (pwd) setTemp(pwd); }
  };

  const InfoRow = ({ icon: Icon, label, value }) => {
    if (!value && value !== 0) return null;
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: C.amberLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={14} color={C.amber} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>{label}</div>
          <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{value}</div>
        </div>
      </div>
    );
  };

  const isActive = (userInfo?.status || user.account_status || "active") === "active";

  return (
    <>
      <div onClick={e => e.target === e.currentTarget && onClose()}
        style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "white", borderRadius: 28, width: 540, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px rgba(0,0,0,0.3)" }}>

          <div style={{ background: C.red, padding: "24px 28px", position: "relative", flexShrink: 0, borderRadius: "28px 28px 0 0" }}>
            <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}><X size={18} /></button>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Avatar user={user} size={60} fontSize={22} />
              <div>
                <h2 style={{ color: "white", margin: "0 0 6px", fontSize: 20, fontWeight: 700 }}>{fullName}</h2>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <RiskPill level={user.risk_level} />
                  <span style={{ background: "rgba(255,255,255,0.2)", color: "white", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>Score: {user.total_score}</span>
                  {userInfo?.role && <span style={{ background: "rgba(255,255,255,0.15)", color: "white", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, textTransform: "capitalize" }}>{userInfo.role}</span>}
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 20, background: "#F7F5EF", borderRadius: "0 0 28px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
            {tempPassword && (
              <div style={{ background: C.amberLight, border: `1px solid ${C.amberBorder}`, borderRadius: 16, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><KeyRound size={18} color={C.amber} /><strong style={{ color: C.amber, fontSize: 14 }}>Temporary Password</strong></div>
                <code style={{ display: "block", background: "white", padding: 12, borderRadius: 12, fontFamily: "monospace", fontSize: 14, color: "#111827", border: `1px solid ${C.amberBorder}`, marginBottom: 8 }}>{tempPassword}</code>
                <p style={{ fontSize: 12, color: C.amber, margin: 0 }}>Share with the user — they'll be prompted to change it on login.</p>
              </div>
            )}

            <div style={{ background: "white", borderRadius: 16, padding: 18, border: "1px solid #ebe9e3" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: C.amber, textTransform: "uppercase", letterSpacing: "0.5px" }}>User Information</h4>
              {loadingInfo ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0" }}><Spinner size={18} /><span style={{ fontSize: 13, color: C.muted }}>Loading…</span></div>
              ) : infoError ? (
                <div style={{ padding: "12px 14px", background: C.redLight, border: `1px solid ${C.redBorder}`, borderRadius: 10, fontSize: 13, color: C.red }}>
                  {infoError}<div style={{ marginTop: 6, fontSize: 11, color: C.muted }}>ID: <code>{user.user_id}</code></div>
                </div>
              ) : (
                <div>
                  <InfoRow icon={Mail}       label="Email"           value={userInfo?.email} />
                  <InfoRow icon={Phone}      label="Phone"           value={userInfo?.phone} />
                  <InfoRow icon={Users}      label="Role"            value={userInfo?.role} />
                  <InfoRow icon={MapPin}     label="Address"         value={userInfo?.address} />
                  <InfoRow icon={Star}       label="Rating"          value={userInfo?.ratings ? `${userInfo.ratings} / 5` : null} />
                  <InfoRow icon={Briefcase}  label="Tasks Completed" value={userInfo?.noOfCompletedTask ?? userInfo?.completedTasks ?? null} />
                  <InfoRow icon={Calendar}   label="Member Since"    value={userInfo?.createdAt ? fmtDateTime(userInfo.createdAt) : null} />
                  <InfoRow icon={ShieldAlert}label="Account Status"  value={userInfo?.status} />
                </div>
              )}
            </div>

            <div style={{ background: "white", borderRadius: 16, padding: 18, border: "1px solid #ebe9e3" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: "0.5px" }}>Fraud Signals</h4>
              {!(user.signals?.length) ? <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>No signals recorded.</p> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {user.signals.map((s, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 12px", background: C.grayLight, borderRadius: 10, gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.reason}</div>
                      </div>
                      <span style={{ background: s.score >= 35 ? C.redLight : C.yellowLight, color: s.score >= 35 ? C.red : C.yellow, border: `1px solid ${s.score >= 35 ? C.redBorder : C.yellowBorder}`, padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>+{s.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: "white", borderRadius: 16, padding: 18, border: "1px solid #ebe9e3" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: "0.5px" }}>Evaluation Info</h4>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Clock size={14} color={C.muted} />
                <span style={{ fontSize: 13, color: C.text }}>Last evaluated: <strong>{fmtDateTime(user.evaluated_at)}</strong></span>
              </div>
              {user.manual_review && (
                <div style={{ marginTop: 10, padding: "10px 12px", background: C.amberLight, borderRadius: 10, border: `1px solid ${C.amberBorder}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, marginBottom: 4 }}>Manual Review on {fmtDateTime(user.manual_review.at)}</div>
                  <div style={{ fontSize: 12, color: C.text }}>Action: <strong>{user.manual_review.action}</strong></div>
                  {user.manual_review.note && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{user.manual_review.note}</div>}
                </div>
              )}
            </div>

            <div style={{ background: "white", borderRadius: 16, padding: 18, border: "1px solid #ebe9e3" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: "0.5px" }}>Account Actions</h4>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {isActive
                  ? <button onClick={() => handleAction("suspend")}  style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: 500, fontSize: 13, cursor: "pointer" }}>Suspend</button>
                  : <button onClick={() => handleAction("activate")} style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: 500, fontSize: 13, cursor: "pointer" }}>Activate</button>
                }
                <button onClick={() => handleAction("reset")}  style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: 500, fontSize: 13, cursor: "pointer" }}>Reset Password</button>
                <button onClick={() => handleAction("delete")} style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #fecaca", background: "white", color: "#dc2626", fontWeight: 500, fontSize: 13, cursor: "pointer" }}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {confirm && <ConfirmDialog message={confirm.message} danger={confirm.type === "delete" || confirm.type === "suspend"} onConfirm={handleConfirm} onCancel={() => setConfirm(null)} />}
    </>
  );
};

const th = { padding: "11px 16px", textAlign: "left", fontWeight: 700, color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.7px", background: C.grayLight, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };
const td = { padding: "14px 16px", color: "#374151", fontSize: 13, wordBreak: "break-word" };

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function FraudDashboard() {
  const [allUsers,     setAllUsers]     = useState([]);   // ← all levels, for stats
  const [users,        setUsers]        = useState([]);   // ← filtered by active tab
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [rescanning,   setRescanning]   = useState(null);
  const [showDetail,   setShowDetail]   = useState(false);
  const [error,        setError]        = useState(null);
  const [filterLevel,  setFilterLevel]  = useState("monitor");
  const [toast,        setToast]        = useState(null);
  const [confirm,      setConfirm]      = useState(null);
  const [scanInterval, setScanInterval] = useState(15 * 60 * 1000);

  const {
    isScanning, progress, total, lastScanAt, nextScanIn,
    scanNow, setWorkerInterval,
  } = useFraudWorker();

  const showToast = (msg, type = "success") => setToast({ msg, type });

  // ── Fetch all three risk levels in parallel so stat cards are always correct
  const fetchFlaggedUsers = useCallback(async (level) => {
    setLoading(true); setError(null);
    try {
      const [mon, res, sus] = await Promise.all([
        fetch(`${API_BASE}/fraud/flagged?level=monitor`,  { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API_BASE}/fraud/flagged?level=restrict`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API_BASE}/fraud/flagged?level=suspend`,  { headers: authHeaders() }).then(r => r.json()),
      ]);
      const all = [
        ...(mon.users || []),
        ...(res.users || []),
        ...(sus.users || []),
      ];
      setAllUsers(all);
      setUsers(all.filter(u => u.risk_level === level));
    } catch { setError("Failed to load fraud reports."); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { fetchFlaggedUsers(filterLevel); }, [fetchFlaggedUsers, filterLevel]);

  // When tab changes, re-filter from allUsers without a new fetch
  useEffect(() => {
    setUsers(allUsers.filter(u => u.risk_level === filterLevel));
  }, [filterLevel, allUsers]);

  // Auto-refresh table when background scan completes
  useEffect(() => {
    if (!isScanning && lastScanAt) {
      fetchFlaggedUsers(filterLevel);
    }
  }, [isScanning]); // eslint-disable-line

  const handleScanNow = () => {
    scanNow();
    showToast("Background scan started");
  };

  const handleIntervalChange = (ms) => {
    setScanInterval(ms);
    setWorkerInterval(ms);
  };

  const fetchUserDetail = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/fraud/user/${userId}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSelectedUser(await res.json());
      setShowDetail(true);
    } catch (e) { showToast("Failed to load user: " + e.message, "error"); }
  };

  const handleRescan = async (userId) => {
    setRescanning(userId);
    try {
      const data = await (await fetch(`${API_BASE}/fraud/user/${userId}/rescan`, { method: "POST", headers: authHeaders() })).json();
      showToast(`Rescan: ${data.risk_level} (${data.total_score} pts)`);
      await fetchFlaggedUsers(filterLevel);
    } catch (e) { showToast("Rescan failed: " + e.message, "error"); }
    finally { setRescanning(null); }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await fetch(`${API_BASE}/customer/${userId}`, { method: "DELETE", headers: authHeaders() });
      showToast("User deleted");
      await fetchFlaggedUsers(filterLevel);
      setSelectedUser(null);
    } catch { showToast("Failed to delete", "error"); }
  };

  const handleStatusUpdate = async (userId, status) => {
    try {
      await fetch(`${API_BASE}/customer/${userId}/status`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ status }) });
      showToast(`User ${status === "active" ? "activated" : "suspended"}`);
      await fetchFlaggedUsers(filterLevel);
      if (selectedUser) setSelectedUser({ ...selectedUser, account_status: status });
    } catch { showToast("Failed to update status", "error"); }
  };

  const handleResetPassword = async (userId) => {
    try {
      const data = await (await fetch(`${API_BASE}/customer/${userId}/reset-password`, { method: "PATCH", headers: authHeaders() })).json();
      showToast("Password reset");
      return data?.temp_password ?? null;
    } catch { showToast("Failed to reset password", "error"); return null; }
  };

  const handleConfirmAction = (type, userId) => {
    const u    = users.find(u => u.user_id === userId);
    const name = u?.first_name ? `${u.first_name} ${u.last_name || ""}`.trim() : userId;
    setConfirm({ type, userId, message: { delete: `Permanently delete ${name}?`, suspend: `Suspend ${name}?`, activate: `Activate ${name}?` }[type] });
  };

  const executeConfirm = async () => {
    const { type, userId } = confirm; setConfirm(null);
    if (type === "delete")   await handleDeleteUser(userId);
    if (type === "suspend")  await handleStatusUpdate(userId, "suspended");
    if (type === "activate") await handleStatusUpdate(userId, "active");
  };

  // ── Stats always from allUsers so counts are correct across all tabs ────────
  const stats = {
    monitor:  allUsers.filter(u => u.risk_level === "monitor").length,
    restrict: allUsers.filter(u => u.risk_level === "restrict").length,
    suspend:  allUsers.filter(u => u.risk_level === "suspend").length,
    avgScore: allUsers.length ? Math.round(allUsers.reduce((s, u) => s + (u.total_score || 0), 0) / allUsers.length) : 0,
  };

  const TABS = [
    { id: "monitor",  label: "Monitor",  count: stats.monitor,  color: C.yellow },
    { id: "restrict", label: "Restrict", count: stats.restrict, color: C.orange },
    { id: "suspend",  label: "Suspend",  count: stats.suspend,  color: C.red    },
  ];

  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ minHeight: "89vh", background: C.bg, fontFamily: '"DM Sans", -apple-system, sans-serif', padding: "clamp(12px,4vw,2rem)" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: C.red, margin: "0 0 6px" }}>Fraud Detection</h1>
              <p style={{ color: C.muted, margin: 0, fontSize: 13 }}>Monitor suspicious activity & enforce risk rules</p>
            </div>
            <button onClick={() => fetchFlaggedUsers(filterLevel)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 12, border: `1px solid ${C.border}`, background: "white", color: C.text, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          <ScanStatusBar
            isScanning={isScanning}
            lastScanAt={lastScanAt}
            nextScanIn={nextScanIn}
            progress={progress}
            total={total}
            scanInterval={scanInterval}
            onScanNow={handleScanNow}
            onIntervalChange={handleIntervalChange}
          />

          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            <StatCard label="Monitor"        value={stats.monitor}  sub="Needs observation"              accent={C.yellow} />
            <StatCard label="Restrict"       value={stats.restrict} sub="Limited access"                  accent={C.orange} />
            <StatCard label="Suspend"        value={stats.suspend}  sub="Account frozen"                  accent={C.red}    />
            <StatCard label="Avg Risk Score" value={stats.avgScore} sub={`Out of ${allUsers.length} users`} accent={C.amber} />
          </div>

          {error && <div style={{ background: C.redLight, border: `1px solid ${C.redBorder}`, borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: C.red }}>❌ {error}</div>}

          <div style={{ display: "flex", gap: 6, marginBottom: 16, borderBottom: `2px solid ${C.border}`, overflowX: "auto" }}>
            {TABS.map(({ id, label, count, color }) => {
              const active = filterLevel === id;
              return (
                <button key={id} onClick={() => setFilterLevel(id)}
                  style={{ padding: "10px 18px", borderRadius: "10px 10px 0 0", fontSize: 13, fontWeight: 700, border: `1px solid ${active ? C.border : "transparent"}`, borderBottom: active ? `2px solid ${C.surface}` : "none", background: active ? C.surface : "transparent", color: active ? C.text : C.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, marginBottom: active ? "-2px" : 0, whiteSpace: "nowrap", minHeight: 44 }}>
                  {label}
                  {count > 0 && <span style={{ background: active ? color : C.border, color: active ? "#fff" : C.muted, borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 800 }}>{count}</span>}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 80, background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <Spinner size={36} /><p style={{ color: C.muted, margin: 0, fontWeight: 600, fontSize: 14 }}>Loading…</p>
            </div>
          ) : (
            <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                <thead><tr>{["User", "Risk Level", "Score", "Signals", "Last Evaluated", "Actions"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: "64px 24px", textAlign: "center", color: C.muted, fontSize: 14, fontWeight: 600 }}>No flagged users in this category 🎉</td></tr>
                  ) : users.map(user => (
                    <tr key={user.user_id} style={{ borderBottom: `1px solid ${C.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = C.grayLight}
                      onMouseLeave={e => e.currentTarget.style.background = C.surface}>
                      <td style={{ ...td, fontWeight: 700, color: C.text }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <Avatar user={user} size={36} fontSize={12} />
                          <div>
                            <div style={{ fontWeight: 600, marginBottom: 2 }}>{user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user.user_id.slice(0, 16) + "…"}</div>
                            <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{user.user_id.slice(0, 14)}…</div>
                          </div>
                        </div>
                      </td>
                      <td style={td}><RiskPill level={user.risk_level} /></td>
                      <td style={{ ...td, fontWeight: 800, fontSize: 18, color: user.total_score >= 80 ? C.red : user.total_score >= 50 ? C.orange : C.yellow }}>{user.total_score}</td>
                      <td style={td}><SignalTags signals={user.signals || []} /></td>
                      <td style={{ ...td, color: C.muted, fontSize: 12 }}>{fmtDateTime(user.evaluated_at)}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button onClick={() => fetchUserDetail(user.user_id)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", color: C.text, display: "flex", alignItems: "center", gap: 4 }}><Eye size={12} /> Details</button>
                          <button onClick={() => handleConfirmAction("suspend", user.user_id)} style={{ background: C.redLight, border: `1px solid ${C.redBorder}`, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", color: C.red, display: "flex", alignItems: "center", gap: 4 }}><UserX size={12} /> Suspend</button>
                          <button onClick={() => handleConfirmAction("delete", user.user_id)} style={{ background: "none", border: `1px solid ${C.redBorder}`, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", color: C.red, display: "flex", alignItems: "center", gap: 4 }}><Trash2 size={12} /> Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {allUsers.length > 0 && (
            <div style={{ marginTop: 14, padding: "10px 16px", background: C.grayLight, borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12, color: C.muted, display: "flex", gap: 24, flexWrap: "wrap" }}>
              <span><strong>Risk Scoring:</strong></span>
              <span>• 0–24: Clean</span><span>• 25–49: Monitor</span><span>• 50–79: Restrict</span><span>• 80+: Suspend</span>
            </div>
          )}
        </div>
      </div>

      {showDetail && selectedUser && <UserDetailModal user={selectedUser} onClose={() => setShowDetail(false)} onDelete={handleDeleteUser} onStatusUpdate={handleStatusUpdate} onResetPassword={handleResetPassword} />}
      {confirm && <ConfirmDialog message={confirm.message} danger={confirm.type === "delete" || confirm.type === "suspend"} onConfirm={executeConfirm} onCancel={() => setConfirm(null)} />}

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        button { transition: all 0.2s ease; }
        button:active { transform: scale(0.97); }
      `}</style>
    </>
  );
}