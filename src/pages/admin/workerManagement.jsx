import { useEffect, useState, useRef } from "react";
import {
  Search, CheckCircle, XCircle, MoreVertical,
  Phone, Mail, Briefcase, Calendar, X, User,
  Trash2, KeyRound, AlertTriangle, ChevronDown, ShieldAlert,
  Filter, RefreshCw, Eye, UserCheck, UserX, Clock,
  Star, MapPin, Wrench, Award, Building2,
  Clock3, DollarSign, Globe, Lock, Unlock,
  Info, Users, AlertCircle
} from "lucide-react";

const BASE = "http://localhost:8000/api";

// ── Orange palette (matches CustomerManagement) ───────────────────────────────
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

const apiCall = async (url, options = {}) => {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[API] ${options.method ?? "GET"} ${url} → ${res.status}`, body);
  }
  return res;
};

const getId = (obj) => obj?._id ?? obj?.id;

const deleteWorker         = (id)              => apiCall(`${BASE}/worker/${id}`,               { method: "DELETE" });
const updateWorkerStatus   = (id, status)      => apiCall(`${BASE}/worker/status/${id}`,         { method: "PATCH",  headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
const toggleAvailability   = (id, isAvailable) => apiCall(`${BASE}/worker/${id}/availability`,   { method: "PATCH",  headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isAvailable }) });
const resetWorkerPassword  = (id)              => apiCall(`${BASE}/worker/${id}/reset-password`, { method: "PATCH",  headers: { "Content-Type": "application/json" } });
const verifyWorkerSkill    = (id)              => apiCall(`${BASE}/worker/${id}/verify-skill`,   { method: "PATCH",  headers: { "Content-Type": "application/json" } });
const verifyWorkerFace     = (id)              => apiCall(`${BASE}/worker/${id}/verify-face`,    { method: "PATCH",  headers: { "Content-Type": "application/json" } });
const fetchReviewsByWorker = (id)              => fetch(`${BASE}/reviews/worker/${id}`).then(r => r.json()).catch(() => []);

// ── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = ({ worker, size = 38, fontSize = 14 }) => {
  const initials = worker.firstName?.[0] ?? "W";
  const color    = "#F7BE88";
  if (worker.profilePhoto && !worker.profilePhoto.includes("string") && worker.profilePhoto.startsWith("http"))
    return <img src={worker.profilePhoto} alt={initials} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg, ${color}, ${color}dd)`, color: "white", fontWeight: "700", fontSize, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "2px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      {initials}
    </div>
  );
};

// ── Status Badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    active:    { color: "#059669", bg: "#ffffff", icon: CheckCircle, label: "Active" },
    pending:   { color: "#b45309", bg: "#ffffff", icon: Clock,       label: "Pending" },
    suspended: { color: "#b91c1c", bg: "#ffffff", icon: XCircle,     label: "Suspended" },
    inactive:  { color: "#6b7280", bg: "#ffffff", icon: User,        label: "Inactive" },
  };
  const config = map[status?.toLowerCase()] ?? { color: "#6b7280", bg: "#ffffff", icon: User, label: status ?? "Unknown" };
  const Icon = config.icon;
  return (
    <span style={{ background: config.bg, color: config.color, borderRadius: "100px", padding: "4px 10px 4px 8px", fontSize: "12px", fontWeight: "500", display: "inline-flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
      <Icon size={12} />{config.label}
    </span>
  );
};

// ── Availability Badge ────────────────────────────────────────────────────────
const AvailBadge = ({ isAvailable }) => (
  <span style={{ background: isAvailable ? "#ecfdf5" : "#fff7ed", color: isAvailable ? "#059669" : O[600], borderRadius: "100px", padding: "3px 10px 3px 8px", fontSize: "11px", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "4px" }}>
    {isAvailable ? <Unlock size={11} /> : <Lock size={11} />}
    {isAvailable ? "Available" : "Unavailable"}
  </span>
);

// ── Rating Stars ──────────────────────────────────────────────────────────────
const RatingStars = ({ rating = 0, count }) => {
  const full = Math.floor(rating);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
      <div style={{ display: "flex", gap: "1px" }}>
        {[...Array(5)].map((_, i) => (
          <Star key={i} size={12} fill={i < full ? O[500] : "none"} color={i < full ? O[500] : "#d1d5db"} />
        ))}
      </div>
      <span style={{ fontSize: "12px", fontWeight: "600", color: "#111827" }}>{(rating || 0).toFixed(1)}</span>
      {count > 0 && <span style={{ fontSize: "11px", color: "#6b7280" }}>({count})</span>}
    </div>
  );
};

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
const StatCard = ({ label, value, suffix = "" }) => (
  <div style={{ background: "white", borderRadius: "16px", padding: "20px", border: "1px solid #e5e7eb" }}>
    <div style={{ fontSize: "13px", color: "#080808", fontWeight: "500", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
    <div style={{ fontSize: "32px", fontWeight: "600", color: "#080808", lineHeight: 1 }}>{value}<span style={{ fontSize: "20px" }}>{suffix}</span></div>
  </div>
);

// ── Context Menu ──────────────────────────────────────────────────────────────
const ContextMenu = ({ worker, onAction, onClose }) => {
  const menuRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={menuRef} style={{ position: "absolute", right: 0, top: "100%", zIndex: 100000, background: "white", borderRadius: "14px", boxShadow: "0 10px 40px rgba(0,0,0,0.15)", border: "1px solid #e5e7eb", minWidth: "200px", marginTop: "4px", animation: "scaleIn 0.1s ease" }}>
      {[
        { label: "View Details",        icon: Eye,                                 action: "view",         color: "#3b82f6" },
        { label: "Activate",            icon: UserCheck,                           action: "activate",     color: "#059669" },
        { label: "Suspend",             icon: UserX,                               action: "suspend",      color: "#dc2626" },
        { label: "Toggle Availability", icon: worker.isAvailable ? Lock : Unlock,  action: "availability", color: worker.isAvailable ? "#dc2626" : "#059669" },
        { label: "Reset Password",      icon: KeyRound,                            action: "reset",        color: O[600] },
        { label: "Delete",              icon: Trash2,                              action: "delete",       color: "#dc2626" },
      ].map(({ label, icon: Icon, action, color }) => (
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

// ── Worker Detail Modal ───────────────────────────────────────────────────────
const WorkerDetailModal = ({ worker, onClose, onDelete, onStatusUpdate, onToggleAvailability, onResetPassword, onVerifySkill, onVerifyFace }) => {
  const [tab,          setTab]    = useState("info");
  const [reviews,      setRev]    = useState([]);
  const [loadingRev,   setLoadR]  = useState(false);
  const [tempPassword, setTemp]   = useState(null);
  const [confirm,      setConf]   = useState(null);
  const backdropRef = useRef(null);

  const wId      = getId(worker);
  const fullName = worker.lastName ? `${worker.firstName ?? ""} ${worker.lastName}`.trim() : worker.firstName || "Unknown Worker";

  useEffect(() => {
    if (tab !== "reviews") return;
    setLoadR(true);
    fetchReviewsByWorker(wId).then(d => { setRev(Array.isArray(d) ? d : d?.reviews ?? []); setLoadR(false); });
  }, [tab, wId]);

  const handleAction = (type) => {
    const msgs = {
      delete:      `Delete ${fullName}? This cannot be undone.`,
      suspend:     `Suspend ${fullName}? They won't be able to accept new jobs.`,
      activate:    `Activate ${fullName}?`,
      reset:       `Reset password for ${fullName}?`,
      verifySkill: `Mark skills as verified for ${fullName}?`,
      verifyFace:  `Mark face verification complete for ${fullName}?`,
    };
    setConf({ type, message: msgs[type] });
  };

  const handleConfirm = async () => {
    const { type } = confirm; setConf(null);
    if (type === "delete")      { await onDelete(wId); onClose(); }
    if (type === "suspend")     await onStatusUpdate(wId, "suspended");
    if (type === "activate")    await onStatusUpdate(wId, "active");
    if (type === "reset")       { const pwd = await onResetPassword(wId); if (pwd) setTemp(pwd); }
    if (type === "verifySkill") await onVerifySkill(wId);
    if (type === "verifyFace")  await onVerifyFace(wId);
  };

  const ActionBtn = ({ label, onClick, danger = false, neutral = false }) => (
    <button onClick={onClick}
      style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: danger ? "1px solid #fecaca" : "1px solid #e5e7eb", background: "white", color: danger ? "#dc2626" : "#374151", fontWeight: "500", fontSize: "13px", cursor: "pointer", transition: "background 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? "#fff5f5" : "#f9fafb"}
      onMouseLeave={e => e.currentTarget.style.background = "white"}
    >{label}</button>
  );

  const VerifRow = ({ label, verified, onVerify }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: verified ? "#ecfdf5" : "#fff7ed", borderRadius: "12px", border: `1px solid ${verified ? "#059669" : O[500]}25` }}>
      <div>
        <div style={{ fontSize: "13px", fontWeight: "600", color: "#111827" }}>{label}</div>
        <div style={{ fontSize: "12px", color: verified ? "#059669" : O[600], fontWeight: "500" }}>{verified ? "Verified ✓" : "Not Verified"}</div>
      </div>
      {!verified && (
        <button onClick={onVerify} style={{ padding: "6px 14px", borderRadius: "8px", border: "none", background: "#059669", color: "white", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
          Verify Now
        </button>
      )}
    </div>
  );

  return (
    <>
      <div ref={backdropRef} onClick={e => { if (e.target === backdropRef.current) onClose(); }}
        style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: "28px", width: "540px", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px rgba(0,0,0,0.3)", animation: "scaleIn 0.2s ease" }}>

          {/* Header — same orange as CustomerManagement */}
          <div style={{ background: O.header, paddingTop: "28px", paddingLeft: "28px", paddingRight: "28px", position: "relative", flexShrink: 0, borderRadius: "28px 28px 0 0" }}>
            <button onClick={onClose} style={{ position: "absolute", top: "20px", right: "20px", background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: "36px", height: "36px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
              <X size={18} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <Avatar worker={worker} size={70} fontSize={24} />
              <div>
                <h2 style={{ color: "white", margin: "0 0 8px", fontSize: "22px", fontWeight: "600" }}>{fullName}</h2>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
                  <StatusBadge status={worker.status || "active"} />
                  <AvailBadge isAvailable={worker.isAvailable} />
                </div>
                <RatingStars rating={worker.ratings || 0} count={worker.reviewCount || 0} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "4px", marginTop: "24px", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
              {["info", "reviews", "verification"].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 16px", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: "500", background: tab === t ? "white" : "transparent", color: tab === t ? O[600] : "rgba(255,255,255,0.7)", marginBottom: "-1px", transition: "all 0.15s" }}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Body — warm tint */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px", background: O.bg, borderRadius: "0 0 28px 28px" }}>

            {tab === "info" && (
              <>
                {tempPassword && (
                  <div style={{ background: O[100], border: `1px solid ${O[300]}`, borderRadius: "16px", padding: "16px", marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <KeyRound size={18} color={O[700]} /><strong style={{ color: O[700], fontSize: "14px" }}>Temporary Password</strong>
                    </div>
                    <code style={{ display: "block", background: "white", padding: "12px", borderRadius: "12px", fontFamily: "monospace", fontSize: "14px", color: "#111827", border: `1px solid ${O[200]}`, marginBottom: "8px" }}>{tempPassword}</code>
                    <p style={{ fontSize: "12px", color: O[700], margin: 0 }}>Share with the worker. They'll be prompted to change it on next login.</p>
                  </div>
                )}

                {/* Stats row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "16px" }}>
                  {[
                    {   label: "Completed",     value: worker.noOfCompletedTask || 0 },
                    {  label: "Response Time", value: `${worker.responseTime || 0}m` },
                    {  label: "Base Price",    value: `Rs. ${worker.basePrice || 0}` },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: "white", borderRadius: "14px", padding: "24px", border: `1px solid ${O.border}`, textAlign: "center", }}>
                    
                      <div style={{ fontSize: "15px", fontWeight: "700", color: "#111827" }}>{value}</div>
                      <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>{label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: "white", borderRadius: "20px", padding: "20px", marginBottom: "16px", border: `1px solid ${O.border}` }}>
                  <h4 style={{ margin: "0 0 16px", fontSize: "13px", fontWeight: "600", color: O[500], textTransform: "uppercase", letterSpacing: "0.5px" }}>Contact Information</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {[
                      { icon: Mail,   label: "Email",   value: worker.email },
                      { icon: Phone,  label: "Phone",   value: worker.phoneNo },
                      { icon: MapPin, label: "Address", value: worker.address || "Not provided" },
                      { icon: Wrench, label: "Service", value: worker.taskType || "Not specified" },
                    ].filter(r => r.value).map(({ icon: Icon, label, value }) => (
                      <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "12px", background: O.bg, border: `1px solid ${O.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={16} color="#6b7280" />
                        </div>
                        <div>
                          <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "500", marginBottom: "2px" }}>{label}</div>
                          <div style={{ fontSize: "14px", color: "#111827", fontWeight: "500" }}>{value}</div>
                        </div>
                      </div>
                    ))}
                    {worker.skills?.length > 0 && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "12px", background: O.bg, border: `1px solid ${O.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Award size={16} color="#6b7280" />
                        </div>
                        <div>
                          <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "500", marginBottom: "6px" }}>Skills</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {worker.skills.map((s, i) => {
                              const label = typeof s === "string" ? s : s?.name ?? s?.label ?? JSON.stringify(s);
                              return <span key={i} style={{ background: O[100], color: O[700], padding: "2px 10px", borderRadius: "10px", fontSize: "11px", fontWeight: "500" }}>{label}</span>;
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                    {worker.description && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "12px", background: O.bg, border: `1px solid ${O.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Info size={16} color="#6b7280" />
                        </div>
                        <div>
                          <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "500", marginBottom: "2px" }}>Description</div>
                          <div style={{ fontSize: "13px", color: "#374151", lineHeight: "1.5" }}>{worker.description}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ background: "white", borderRadius: "20px", padding: "20px", border: `1px solid ${O.border}` }}>
                  <h4 style={{ margin: "0 0 16px", fontSize: "13px", fontWeight: "600", color: O[500], textTransform: "uppercase", letterSpacing: "0.5px" }}>Account Actions</h4>
                  <div style={{ display: "flex", flexDirection: "row", gap: "8px"}}>
                    <>
                    {worker.status === "active"
                      ? <ActionBtn label="Suspend"  onClick={() => handleAction("suspend")}  danger />
                      : <ActionBtn label="Activate" onClick={() => handleAction("activate")} />}
                      </>
                      <> <ActionBtn label={worker.isAvailable ? "Mark Unavailable" : "Mark Available"} onClick={() => onToggleAvailability(wId, !worker.isAvailable)} />
                        </>
                        
                        <> <ActionBtn label="Reset Password" onClick={() => handleAction("reset")} /></>
                        
                        <>

                    <ActionBtn label="Delete Account" onClick={() => handleAction("delete")} danger />
                        </>
                   
                   
                  </div>
                </div>
              </>
            )}

            {tab === "reviews" && (
              loadingRev ? (
                <div style={{ textAlign: "center", padding: "40px", background: "white", borderRadius: "20px" }}>
                  <RefreshCw size={32} style={{ color: O[400], marginBottom: "12px", animation: "spin 1s linear infinite" }} />
                  <p style={{ color: "#6b7280", margin: 0 }}>Loading reviews...</p>
                </div>
              ) : reviews.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 24px", background: "white", borderRadius: "20px" }}>
                  <Star size={48} style={{ color: O[300], marginBottom: "16px" }} />
                  <h4 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: "600", color: "#111827" }}>No Reviews Yet</h4>
                  <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>This worker hasn't received any reviews.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {reviews.map((r, i) => (
                    <div key={i} style={{ background: "white", borderRadius: "16px", padding: "16px", border: `1px solid ${O[100]}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: "600", color: "#111827", fontSize: "14px" }}>{r.customerName || "Anonymous"}</span>
                          <RatingStars rating={r.rating || 0} />
                        </div>
                        <span style={{ fontSize: "11px", color: "#9ca3af" }}>{r.date ?? r.createdAt ?? ""}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: "13px", color: "#4b5563", lineHeight: "1.5" }}>{r.comment ?? r.feedback ?? "No comment"}</p>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === "verification" && (
              <div style={{ background: "white", borderRadius: "20px", padding: "20px", border: `1px solid ${O.border}` }}>
                <h4 style={{ margin: "0 0 16px", fontSize: "13px", fontWeight: "600", color: O[500], textTransform: "uppercase", letterSpacing: "0.5px" }}>Verification Status</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <VerifRow label="Skill Verification" verified={worker.skill_verified} onVerify={() => handleAction("verifySkill")} />
                  <VerifRow label="Face Verification"  verified={worker.face_verified}  onVerify={() => handleAction("verifyFace")} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {confirm && <ConfirmDialog message={confirm.message} danger={confirm.type === "delete" || confirm.type === "suspend"} onConfirm={handleConfirm} onCancel={() => setConf(null)} />}
    </>
  );
};

// ── Worker Row ────────────────────────────────────────────────────────────────
const WorkerRow = ({ worker, onSelect, onStatusUpdate, onToggleAvailability, onDelete, onResetPassword, onConfirmRequest }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const wId      = getId(worker);
  const fullName = worker.lastName ? `${worker.firstName ?? ""} ${worker.lastName}`.trim() : worker.firstName || "Unknown";

  const handleAction = (action) => {
    if (action === "view")         { onSelect(worker); return; }
    if (action === "availability") { onToggleAvailability(wId, !worker.isAvailable); return; }
    const msgs = {
      activate: `Activate ${fullName}?`,
      suspend:  `Suspend ${fullName}? They won't be able to accept new jobs.`,
      reset:    `Reset password for ${fullName}?`,
      delete:   `Permanently delete ${fullName}? This cannot be undone.`,
    };
    onConfirmRequest({ type: action, message: msgs[action], workerId: wId });
  };

  return (
    <tr style={{ borderBottom: "1px solid #f3f4f6", transition: "all 0.2s", cursor: "pointer" }}
      onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
      onMouseLeave={e => e.currentTarget.style.background = "white"}
      onClick={() => onSelect(worker)}
    >
      <td style={{ padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Avatar worker={worker} />
          <div>
            <div style={{ fontWeight: "600", color: "#111827", fontSize: "15px", marginBottom: "4px" }}>{fullName}</div>
            <div style={{ fontSize: "13px", color: "#6b7280", display: "flex", alignItems: "center", gap: "4px" }}><Mail size={12} />{worker.email}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: "16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <AvailBadge isAvailable={worker.isAvailable} />
          <div style={{ display: "flex", gap: "4px" }}>
            {worker.skill_verified && <span style={{ background: "#ecfdf5", color: "#059669", padding: "2px 8px", borderRadius: "10px", fontSize: "10px", fontWeight: "600" }}>Skill ✓</span>}
            {worker.face_verified  && <span style={{ background: "#ecfdf5", color: "#059669", padding: "2px 8px", borderRadius: "10px", fontSize: "10px", fontWeight: "600" }}>Face ✓</span>}
          </div>
        </div>
      </td>
      <td style={{ padding: "16px" }}>
        <RatingStars rating={worker.ratings || 0} count={worker.reviewCount || 0} />
      </td>
      <td style={{ padding: "16px" }}>
        <div style={{ fontSize: "14px", fontWeight: "600", color: "#111827" }}>Rs. {worker.basePrice || 0}</div>
        <div style={{ fontSize: "11px", color: "#6b7280" }}>{worker.noOfCompletedTask || 0} jobs done</div>
      </td>
      <td style={{ padding: "16px" }}><StatusBadge status={worker.status || "active"} /></td>
      <td style={{ padding: "16px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "flex-end" }}>
          <button onClick={() => onToggleAvailability(wId, !worker.isAvailable)}
            title={worker.isAvailable ? "Mark Unavailable" : "Mark Available"}
            style={{ padding: "8px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", cursor: "pointer", color: worker.isAvailable ? "#059669" : "#6b7280", display: "flex", alignItems: "center" }}
            onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
            onMouseLeave={e => e.currentTarget.style.background = "white"}
          >
            {worker.isAvailable ? <Unlock size={15} /> : <Lock size={15} />}
          </button>
          <div style={{ position: "relative" }}>
            <button onClick={() => setMenuOpen(v => !v)}
              style={{ padding: "8px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", cursor: "pointer", color: "#6b7280", display: "flex", alignItems: "center" }}
              onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
              onMouseLeave={e => e.currentTarget.style.background = "white"}
            >
              <MoreVertical size={15} />
            </button>
            {menuOpen && <ContextMenu worker={worker} onAction={handleAction} onClose={() => setMenuOpen(false)} />}
          </div>
        </div>
      </td>
    </tr>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function WorkerManagement() {
  const [workers,       setWorkers]   = useState([]);
  const [loading,       setLoading]   = useState(true);
  const [error,         setError]     = useState(null);
  const [search,        setSearch]    = useState("");
  const [filterStatus,  setFStatus]   = useState("all");
  const [filterAvail,   setFAvail]    = useState("all");
  const [filterTask,    setFTask]     = useState("all");
  const [selected,      setSelect]    = useState(null);
  const [toast,         setToast]     = useState(null);
  const [showFilters,   setShowF]     = useState(false);
  const [confirm,       setConfirm]   = useState(null);
  const [currentPage,   setPage]      = useState(1);
  const [totalWorkers,  setTotal]     = useState(0);
  const PAGE_SIZE = 50;

  const showToast = (msg, type = "success") => setToast({ msg, type });

  const fetchPage = async (page, q) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE });
      if (q?.trim()) params.append("search", q.trim());
      const res  = await fetch(`${BASE}/workers/all?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const batch = data.workers ?? (Array.isArray(data) ? data : []);
      setWorkers(batch);
      setTotal(data.total ?? batch.length);
      setPage(page);
    } catch (e) { setError(`Failed to load workers: ${e.message}`); }
    finally     { setLoading(false); }
  };

  const isFirst = useRef(true);
  useEffect(() => { fetchPage(1, ""); }, []);
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    const t = setTimeout(() => fetchPage(1, search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleDelete = async (id) => {
    try { const res = await deleteWorker(id); if (!res.ok) throw new Error(); setWorkers(p => p.filter(w => getId(w) !== id)); setSelect(null); showToast("Worker deleted"); }
    catch { showToast("Failed to delete", "error"); }
  };

  const handleStatus = async (id, status) => {
    try { const res = await updateWorkerStatus(id, status); if (!res.ok) throw new Error(); setWorkers(p => p.map(w => getId(w) === id ? { ...w, status } : w)); setSelect(p => getId(p) === id ? { ...p, status } : p); showToast(`Worker ${status === "active" ? "activated" : "suspended"}`); }
    catch { showToast("Failed to update status", "error"); }
  };

  const handleToggleAvail = async (id, isAvailable) => {
    try { const res = await toggleAvailability(id, isAvailable); if (!res.ok) throw new Error(); setWorkers(p => p.map(w => getId(w) === id ? { ...w, isAvailable } : w)); setSelect(p => getId(p) === id ? { ...p, isAvailable } : p); showToast(`Marked as ${isAvailable ? "available" : "unavailable"}`); }
    catch { showToast("Failed to update availability", "error"); }
  };

  const handleReset = async (id) => {
    try { const res = await resetWorkerPassword(id); if (!res.ok) throw new Error(); const data = await res.json(); showToast("Password reset"); return data?.temp_password ?? null; }
    catch { showToast("Failed to reset password", "error"); return null; }
  };

  const handleVerifySkill = async (id) => {
    try { const res = await verifyWorkerSkill(id); if (!res.ok) throw new Error(); setWorkers(p => p.map(w => getId(w) === id ? { ...w, skill_verified: true } : w)); setSelect(p => getId(p) === id ? { ...p, skill_verified: true } : p); showToast("Skills verified"); }
    catch { showToast("Failed to verify skills", "error"); }
  };

  const handleVerifyFace = async (id) => {
    try { const res = await verifyWorkerFace(id); if (!res.ok) throw new Error(); setWorkers(p => p.map(w => getId(w) === id ? { ...w, face_verified: true } : w)); setSelect(p => getId(p) === id ? { ...p, face_verified: true } : p); showToast("Face verified"); }
    catch { showToast("Failed to verify face", "error"); }
  };

  const handleConfirm = async () => {
    const { type, workerId } = confirm; setConfirm(null);
    if (type === "activate") await handleStatus(workerId, "active");
    if (type === "suspend")  await handleStatus(workerId, "suspended");
    if (type === "reset")    await handleReset(workerId);
    if (type === "delete")   await handleDelete(workerId);
  };

  const taskTypes = ["all", ...new Set(workers.map(w => w.taskType).filter(Boolean))];

  const filtered = workers.filter(w => {
    const matchStatus = filterStatus === "all" || (w.status ?? "active") === filterStatus;
    const matchAvail  = filterAvail  === "all" || (filterAvail === "available" ? w.isAvailable : !w.isAvailable);
    const matchTask   = filterTask   === "all" || w.taskType === filterTask;
    return matchStatus && matchAvail && matchTask;
  });

  const stats = {
    total:     workers.length,
    active:    workers.filter(w => (w.status ?? "active") === "active").length,
    available: workers.filter(w => w.isAvailable).length,
    avgRating: workers.length ? (workers.reduce((a, w) => a + (w.ratings || 0), 0) / workers.length).toFixed(1) : "0.0",
  };

  const totalPages = Math.ceil(totalWorkers / PAGE_SIZE);
  const pageBtn = (disabled) => ({ padding: "6px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", background: disabled ? "#f9fafb" : "white", color: disabled ? "#9ca3af" : "#374151", cursor: disabled ? "default" : "pointer", fontSize: "13px", fontWeight: "500" });

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", paddingLeft: "25px", paddingRight: "20px", paddingTop: "20px", paddingBottom: "20px", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <h1 style={{ margin: "0 0 8px", fontSize: "28px", fontWeight: "600", color: "#111827" }}>Worker Management</h1>
            <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>Manage service providers, verify credentials, and monitor performance</p>
          </div>
          <button onClick={() => setShowF(v => !v)}
            style={{ padding: "10px 20px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: "14px", fontWeight: "500", color: "#374151", display: "flex", alignItems: "center", gap: "8px" }}
            onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
            onMouseLeave={e => e.currentTarget.style.background = "white"}
          >
            <Filter size={16} /> Filters
            <ChevronDown size={16} style={{ transform: showFilters ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
          <StatCard label="Total Workers" value={stats.total} />
          <StatCard label="Active"        value={stats.active} />
          <StatCard label="Available Now" value={stats.available} />
          <StatCard label="Avg Rating"    value={stats.avgRating} suffix="★" />
        </div>

        {/* Search + Filters */}
        <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e5e7eb", padding: "16px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 1, position: "relative", minWidth: "250px" }}>
              <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input type="text" placeholder="Search by name, email or service..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: "100%", padding: "12px 12px 12px 42px", borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "14px", outline: "none", background: "#f9fafb", boxSizing: "border-box" }}
                onFocus={e => { e.target.style.borderColor = O[400]; e.target.style.background = "white"; }}
                onBlur={e  => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#f9fafb"; }}
              />
            </div>
            {showFilters && (
              <>
                {[
                  { val: filterStatus, set: setFStatus, opts: [["all","All Status"],["active","Active"],["pending","Pending"],["suspended","Suspended"],["inactive","Inactive"]] },
                  { val: filterAvail,  set: setFAvail,  opts: [["all","All Availability"],["available","Available"],["unavailable","Unavailable"]] },
                ].map(({ val, set, opts }, i) => (
                  <select key={i} value={val} onChange={e => set(e.target.value)} style={{ padding: "12px 16px", borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "14px", outline: "none", background: "#f9fafb", cursor: "pointer", minWidth: "150px" }}>
                    {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ))}
                <select value={filterTask} onChange={e => setFTask(e.target.value)} style={{ padding: "12px 16px", borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "14px", outline: "none", background: "#f9fafb", cursor: "pointer", minWidth: "150px" }}>
                  <option value="all">All Services</option>
                  {taskTypes.filter(t => t !== "all").map(t => <option key={t} value={t}>{t}</option>)}
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
            <p style={{ color: "#6b7280", margin: 0 }}>Loading workers...</p>
          </div>
        ) : error ? (
          <div style={{ padding: "80px", textAlign: "center" }}>
            <AlertTriangle size={40} style={{ color: "#dc2626", marginBottom: "16px" }} />
            <p style={{ color: "#dc2626", margin: 0 }}>{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "80px", textAlign: "center" }}>
            <Users size={48} style={{ color: "#9ca3af", marginBottom: "16px" }} />
            <h3 style={{ margin: "0 0 8px", color: "#111827" }}>No workers found</h3>
            <p style={{ color: "#6b7280", margin: 0 }}>Try adjusting your search or filters</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                {["Worker", "Availability", "Rating", "Rate", "Status", "Actions"].map((h, i) => (
                  <th key={h} style={{ padding: "16px", textAlign: i === 5 ? "right" : "left", fontSize: "12px", fontWeight: "600", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((worker, i) => (
                <WorkerRow
                  key={getId(worker) ?? i}
                  worker={worker}
                  onSelect={setSelect}
                  onStatusUpdate={handleStatus}
                  onToggleAvailability={handleToggleAvail}
                  onDelete={handleDelete}
                  onResetPassword={handleReset}
                  onConfirmRequest={setConfirm}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && totalWorkers > PAGE_SIZE && (
        <div style={{ marginTop: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "13px", color: "#6b7280" }}>
            Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, totalWorkers)} of {totalWorkers} workers
          </div>
          <div style={{ display: "flex", gap: "5px" }}>
            <button onClick={() => fetchPage(currentPage - 1, search)} disabled={currentPage === 1} style={pageBtn(currentPage === 1)}>‹ Prev</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx - 1] > 1) acc.push("..."); acc.push(p); return acc; }, [])
              .map((p, i) => p === "..." ? (
                <span key={`d${i}`} style={{ padding: "6px 4px", fontSize: "13px", color: "#9ca3af" }}>…</span>
              ) : (
                <button key={p} onClick={() => fetchPage(p, search)}
                  style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", background: currentPage === p ? "#111827" : "white", color: currentPage === p ? "white" : "#374151", cursor: "pointer", fontSize: "13px", fontWeight: currentPage === p ? "700" : "500" }}>{p}</button>
              ))}
            <button onClick={() => fetchPage(currentPage + 1, search)} disabled={currentPage >= totalPages} style={pageBtn(currentPage >= totalPages)}>Next ›</button>
          </div>
        </div>
      )}

      {!loading && !error && totalWorkers <= PAGE_SIZE && filtered.length > 0 && (
        <div style={{ marginTop: "16px", fontSize: "13px", color: "#6b7280", textAlign: "right" }}>
          Showing {filtered.length} of {workers.length} workers
        </div>
      )}

      {confirm  && <ConfirmDialog message={confirm.message} danger={confirm.type === "delete" || confirm.type === "suspend"} onConfirm={handleConfirm} onCancel={() => setConfirm(null)} />}
      {selected && (
        <WorkerDetailModal
          worker={selected}
          onClose={() => setSelect(null)}
          onDelete={handleDelete}
          onStatusUpdate={handleStatus}
          onToggleAvailability={handleToggleAvail}
          onResetPassword={handleReset}
          onVerifySkill={handleVerifySkill}
          onVerifyFace={handleVerifyFace}
        />
      )}

      <style>{`
        @keyframes fadeIn  { from { opacity: 0; }               to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin    { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}