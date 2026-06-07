import { useState, useEffect } from "react";
import {
  CheckCircle, XCircle, Clock, Search,
  ChevronLeft, ChevronRight,
  RefreshCw, AlertTriangle, BadgeCheck, Ban,
  Star, MapPin, Briefcase, Phone,
  Mail, Shield, ShieldCheck, Eye, X
} from "lucide-react";
import BookingNavbar from "../../components/Navbar/Navbar";

const BASE = "http://localhost:8000/api";

// ── API ───────────────────────────────────────────────────────────────────────
const fetchEvidence  = (id) => fetch(`${BASE}/upload/skill-evidence/${id}`).then(r => r.json());
const fetchWorker    = (id) => fetch(`${BASE}/worker/${id}`).then(r => r.json());

// Now sends { decision, category, reason } — category-level review
const reviewEvidence = (workerId, category, decision, reason) =>
  fetch(`${BASE}/upload/skill-evidence/${workerId}/review`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ category, decision, reason }),
  });

const verifyFace = (id) =>
  fetch(`${BASE}/worker/verify-face/${id}`, { method: "PATCH" });

// ── Theme ─────────────────────────────────────────────────────────────────────
const T = {
  brand:    "#E8843A", brandDim: "#E8843A22", brandMid: "#E8843A55",
  bg:       "#FAF8F5", surface:  "#FFFFFF",   border:   "#EDE8DF",
  text:     "#1C1410", textSec:  "#7A6E65",   textMute: "#B0A89E",
  green:    "#3D9E6E", greenBg:  "#3D9E6E15",
  red:      "#D94F3D", redBg:    "#D94F3D12",
  amber:    "#C9883A", amberBg:  "#C9883A15",
  blue:     "#3D7EC9", blueBg:   "#3D7EC915",
};

const CAT_STATUS = {
  pending:  { label: "Pending",  color: T.amber, bg: T.amberBg },
  accepted: { label: "Accepted", color: T.green, bg: T.greenBg },
  rejected: { label: "Rejected", color: T.red,   bg: T.redBg   },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const fileTypeIcon = (type) => {
  if (type === "video") return "🎬";
  if (type === "image") return "🖼️";
  if (type === "raw")   return "📄";
  return "📁";
};

// Derive overall skill status from skillVerify map
function overallSkillStatus(skillVerify = {}) {
  const vals = Object.values(skillVerify);
  if (!vals.length) return "unverified";
  if (vals.every(v => v.status === "accepted")) return "accepted";
  if (vals.some(v  => v.status === "rejected")) return "rejected";
  return "pending";
}

const Avatar = ({ worker, size = 44 }) => {
  const displayName = worker.name || `${worker.firstName ?? ""} ${worker.lastName ?? ""}`.trim();
  const initials    = displayName.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2) || "?";
  const colors      = ["#E8843A", "#3D9E6E", "#3D7EC9", "#9B59B6", "#D94F3D"];
  const color       = colors[(displayName.charCodeAt(0) ?? 0) % colors.length];
  if (worker.profilePhoto?.startsWith("http"))
    return <img src={worker.profilePhoto} alt={displayName} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: `2px solid ${T.border}` }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg,${color},${color}bb)`, color: "white", fontWeight: 700, fontSize: size * 0.35, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid white", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", flexShrink: 0 }}>
      {initials}
    </div>
  );
};

const VerBadge = ({ verified, label }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: verified ? T.greenBg : T.amberBg, color: verified ? T.green : T.amber, border: `1px solid ${verified ? T.green + "30" : T.amber + "30"}` }}>
    {verified ? <ShieldCheck size={11} /> : <Clock size={11} />}
    {label}: {verified ? "Verified" : "Pending"}
  </span>
);

const Stars = ({ rating }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
    {Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} size={11} fill={i < Math.round(rating) ? T.brand : "none"} color={i < Math.round(rating) ? T.brand : T.textMute} />
    ))}
    <span style={{ fontSize: 12, color: T.textSec, marginLeft: 2 }}>{rating?.toFixed(1) ?? "N/A"}</span>
  </div>
);

const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const colors = { success: [T.green, "#fff"], error: [T.red, "#fff"], warning: [T.amber, "#fff"] };
  const [bg, color] = colors[type] ?? colors.success;
  return (
    <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 10000, background: bg, color, padding: "12px 20px", borderRadius: 14, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 30px rgba(0,0,0,0.18)", display: "flex", alignItems: "center", gap: 8 }}>
      {type === "success" && <CheckCircle size={16} />}
      {type === "error"   && <XCircle size={16} />}
      {type === "warning" && <AlertTriangle size={16} />}
      {message}
    </div>
  );
};

// ── Lightbox ──────────────────────────────────────────────────────────────────
const Lightbox = ({ images, startIndex, onClose }) => {
  const [idx, setIdx] = useState(startIndex);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <button onClick={e => { e.stopPropagation(); setIdx(i => Math.max(0, i - 1)); }} style={{ position: "absolute", left: 24, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 44, height: 44, color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft size={20} /></button>
      <img onClick={e => e.stopPropagation()} src={images[idx]} alt="" style={{ maxWidth: "85vw", maxHeight: "85vh", borderRadius: 12, objectFit: "contain", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} />
      <button onClick={e => { e.stopPropagation(); setIdx(i => Math.min(images.length - 1, i + 1)); }} style={{ position: "absolute", right: 24, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 44, height: 44, color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight size={20} /></button>
      <button onClick={onClose} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 36, height: 36, color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} /></button>
      <div style={{ position: "absolute", bottom: 24, color: "rgba(255,255,255,0.5)", fontSize: 13 }}>{idx + 1} / {images.length}</div>
    </div>
  );
};

// ── Category Evidence Card (replaces SkillEvidenceCard) ───────────────────────
// ev: { category, status, evidenceUrl, evidenceType, evidenceName, evidenceThumbnail,
//       evidenceUpdatedAt, skillVerifyReason }
const CategoryEvidenceCard = ({ ev, onAccept, onReject, loading }) => {
  const st = CAT_STATUS[ev.status] || CAT_STATUS.pending;
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [reason, setReason]               = useState("");

  return (
    <div style={{ background: T.bg, borderRadius: 14, border: `1px solid ${T.border}`, overflow: "hidden", marginBottom: 12 }}>
      {/* Category header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{ev.category}</div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color, display: "inline-block" }} />
          {st.label}
        </span>
      </div>

      <div style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          {/* Thumbnail */}
          <div style={{ width: 72, height: 72, borderRadius: 10, border: `1px solid ${T.border}`, overflow: "hidden", flexShrink: 0, background: "#f8f9fa", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {ev.evidenceType === "image" ? (
              <img src={ev.evidenceThumbnail || ev.evidenceUrl} alt={ev.category} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 28 }}>{fileTypeIcon(ev.evidenceType)}</span>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: T.textMute, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ev.evidenceName || "Uploaded file"}
            </div>
            <div style={{ fontSize: 11, color: T.textMute, marginBottom: 8 }}>
              {fileTypeIcon(ev.evidenceType)} {ev.evidenceType === "video" ? "Video" : ev.evidenceType === "image" ? "Image" : "Document"} · Uploaded {fmt(ev.evidenceUpdatedAt)}
            </div>
            <a href={ev.evidenceUrl} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: T.brand, fontWeight: 600, textDecoration: "none" }}>
              ↗ Open file
            </a>
            {ev.status === "rejected" && ev.skillVerifyReason && (
              <div style={{ marginTop: 8, padding: "8px 10px", background: T.redBg, borderRadius: 8, fontSize: 12, color: T.red }}>
                <strong>Reason:</strong> {ev.skillVerifyReason}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled={loading === ev.category || ev.status === "accepted"}
              onClick={() => onAccept(ev.category)}
              style={{ flex: 1, padding: "9px", borderRadius: 10, border: "none", cursor: ev.status === "accepted" || loading === ev.category ? "not-allowed" : "pointer", background: ev.status === "accepted" ? T.greenBg : T.green, color: ev.status === "accepted" ? T.green : "white", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, opacity: ev.status === "accepted" ? 0.7 : 1 }}
            >
              {loading === ev.category ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <BadgeCheck size={13} />}
              {ev.status === "accepted" ? "Accepted" : "Accept"}
            </button>
            <button
              disabled={loading === ev.category || ev.status === "rejected"}
              onClick={() => setShowRejectBox(v => !v)}
              style={{ flex: 1, padding: "9px", borderRadius: 10, border: `1px solid ${T.red}40`, cursor: ev.status === "rejected" || loading === ev.category ? "not-allowed" : "pointer", background: T.redBg, color: T.red, fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, opacity: ev.status === "rejected" ? 0.7 : 1 }}
            >
              <Ban size={13} />
              {ev.status === "rejected" ? "Rejected" : "Reject"}
            </button>
          </div>

          {showRejectBox && ev.status !== "rejected" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Reason for rejection (optional)..."
                rows={2}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, fontFamily: "inherit", resize: "none", outline: "none", boxSizing: "border-box", color: T.text, background: T.surface }}
                onFocus={e => e.target.style.borderColor = T.red}
                onBlur={e  => e.target.style.borderColor = T.border}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setShowRejectBox(false)} style={{ flex: 1, padding: "7px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: T.textSec, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                <button
                  onClick={() => { onReject(ev.category, reason); setShowRejectBox(false); setReason(""); }}
                  style={{ flex: 1, padding: "7px", borderRadius: 8, border: "none", background: T.red, color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Confirm Reject
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Worker Detail Modal ───────────────────────────────────────────────────────
const WorkerModal = ({ worker, onClose, onFaceVerify, onToast }) => {
  const [tab,          setTab]         = useState("profile");
  const [categories,   setCategories]  = useState([]);   // normalized from skillVerify
  const [evLoading,    setEvLoading]   = useState(true);
  const [actionLoad,   setActionLoad]  = useState(null);
  const [faceLoading,  setFaceLoad]    = useState(false);
  const [lightbox,     setLB]          = useState(null);
  const [profile,      setProfile]     = useState(null);
  const [profileLoad,  setProfileLoad] = useState(true);

  const workerId = worker.worker_id || worker._id || worker.email;

  // ── Full worker profile ───────────────────────────────────────────────────
  useEffect(() => {
    setProfileLoad(true);
    fetchWorker(workerId)
      .then(data => { const w = data?.worker ?? data; if (w && !w.detail) setProfile(w); })
      .catch(() => {})
      .finally(() => setProfileLoad(false));
  }, [workerId]);

  // ── Evidence — now reads skillVerify map from /skill-evidence/{id} ─────────
  useEffect(() => {
    setEvLoading(true);
    fetchEvidence(workerId)
      .then(data => {
        if (!data || data.detail) { setCategories([]); return; }
        // Backend returns { worker_id, name, categories: [...] }
        const normalized = (data.categories || []).map(cat => ({
          category:          cat.category,
          status:            cat.status || "pending",
          evidenceUrl:       cat.evidenceUrl || "",
          evidenceType:      cat.evidenceType || "raw",
          evidenceName:      cat.evidenceName || "",
          evidenceThumbnail: cat.evidenceThumbnail || "",
          evidenceUpdatedAt: cat.evidenceUpdatedAt,
          skillVerifyReason: cat.skillVerifyReason || "",
        }));
        setCategories(normalized);
      })
      .catch(() => setCategories([]))
      .finally(() => setEvLoading(false));
  }, [workerId]);

  const w        = { ...worker, ...(profile || {}) };
  const fullName = `${w.firstName ?? ""} ${w.lastName ?? ""}`.trim() || w.name || "Worker";

  const pendingCount  = categories.filter(c => c.status === "pending").length;
  const acceptedCount = categories.filter(c => c.status === "accepted").length;

  const handleAccept = async (category) => {
    setActionLoad(category);
    try {
      const res = await reviewEvidence(workerId, category, "accepted", "");
      if (!res.ok) throw new Error();
      setCategories(prev => prev.map(c => c.category === category ? { ...c, status: "accepted" } : c));
      onToast(`✓ ${category} accepted`, "success");
    } catch { onToast("Action failed", "error"); }
    setActionLoad(null);
  };

  const handleReject = async (category, reason) => {
    setActionLoad(category);
    try {
      const res = await reviewEvidence(workerId, category, "rejected", reason);
      if (!res.ok) throw new Error();
      setCategories(prev => prev.map(c => c.category === category ? { ...c, status: "rejected", skillVerifyReason: reason } : c));
      onToast(`✗ ${category} rejected`, "warning");
    } catch { onToast("Action failed", "error"); }
    setActionLoad(null);
  };

  const handleFaceApprove = async () => {
    setFaceLoad(true);
    try {
      const res = await verifyFace(workerId);
      if (!res.ok) throw new Error();
      onFaceVerify(workerId);
      setProfile(p => p ? { ...p, face_verified: true } : p);
      onToast("Face verified ✓", "success");
    } catch { onToast("Failed to verify face", "error"); }
    setFaceLoad(false);
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, zIndex: 100000, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: T.surface, borderRadius: 24, width: 600, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.25)", animation: "scaleIn 0.2s ease" }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#2D1810,#1C0F08)", padding: "24px 28px", flexShrink: 0, position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}><X size={16} /></button>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <Avatar worker={w} size={60} />
            <div>
              <h2 style={{ color: "white", margin: "0 0 6px", fontSize: 20, fontWeight: 700 }}>{fullName}</h2>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)", fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 500 }}>{w.taskType}</span>
                <VerBadge verified={w.face_verified} label="Face" />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: acceptedCount > 0 ? T.greenBg : T.amberBg, color: acceptedCount > 0 ? T.green : T.amber, border: `1px solid ${acceptedCount > 0 ? T.green + "30" : T.amber + "30"}` }}>
                  <BadgeCheck size={11} />
                  Categories: {acceptedCount}/{categories.length} verified
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 2, borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
            {["profile", "face", "skill"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, textTransform: "capitalize", borderRadius: "8px 8px 0 0", marginBottom: -1, background: tab === t ? T.surface : "transparent", color: tab === t ? T.text : "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 6 }}>
                {t}
                {t === "skill" && pendingCount > 0 && (
                  <span style={{ background: T.amber, color: "white", borderRadius: 999, fontSize: 10, fontWeight: 700, padding: "1px 6px" }}>{pendingCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24, background: T.bg }}>

          {/* ── Profile Tab ── */}
          {tab === "profile" && (
            profileLoad ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: T.textMute }}>
                <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 13 }}>Loading profile...</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: T.surface, borderRadius: 16, padding: 20, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.textMute, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>Worker Info</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                      [Mail,        "Email",         w.email],
                      [Phone,       "Phone",         w.phoneNo],
                      [MapPin,      "Service Areas", w.serviceArea?.cities?.join(", ") || w.serviceArea?.primaryCity || "—"],
                      [Briefcase,   "Task Type",     w.taskType],
                      [Star,        "Rating",        `${w.ratings?.toFixed(2) ?? "N/A"}`],
                      [CheckCircle, "Jobs Done",     w.noOfCompletedTask ?? 0],
                    ].map(([Icon, label, value]) => (
                      <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: T.brandDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={14} color={T.brand} />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: T.textMute, fontWeight: 600, marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{String(value ?? "—")}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {w.description && (
                  <div style={{ background: T.surface, borderRadius: 16, padding: 20, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.textMute, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Bio</div>
                    <p style={{ margin: 0, fontSize: 13, color: T.textSec, lineHeight: 1.7 }}>{w.description}</p>
                  </div>
                )}

                {/* Skills list — shows sub-skills with category label */}
                {w.skills?.length > 0 && (
                  <div style={{ background: T.surface, borderRadius: 16, padding: 20, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.textMute, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Skills & Rates</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {w.skills.map((s, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 10, background: T.bg, border: `1px solid ${T.border}` }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{s.name || s}</span>
                          {s.price && <span style={{ fontSize: 12, color: T.brand, fontWeight: 600 }}>NPR {s.price}/hr</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* skillVerify summary */}
                {w.skillVerify && Object.keys(w.skillVerify).length > 0 && (
                  <div style={{ background: T.surface, borderRadius: 16, padding: 20, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.textMute, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Category Verifications</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {Object.entries(w.skillVerify).map(([cat, data]) => {
                        const st = CAT_STATUS[data.status] || CAT_STATUS.pending;
                        return (
                          <div key={cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 10, background: st.bg, border: `1px solid ${st.color}30` }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{cat}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {/* ── Face Tab ── */}
          {tab === "face" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: T.surface, borderRadius: 16, padding: 20, border: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.textMute, letterSpacing: 1, textTransform: "uppercase" }}>Face Verification</div>
                  <VerBadge verified={w.face_verified} label="Face" />
                </div>
                {w.profilePhoto ? (
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
                    <img src={w.profilePhoto} alt="Profile" onClick={() => setLB({ images: [w.profilePhoto], index: 0 })}
                      style={{ width: 100, height: 100, borderRadius: 12, objectFit: "cover", cursor: "pointer", border: `1px solid ${T.border}` }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>Profile Photo</div>
                      <div style={{ fontSize: 12, color: T.textMute }}>Used for liveness check during registration</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "24px 0", textAlign: "center", color: T.textMute }}>
                    <Shield size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
                    <p style={{ margin: 0, fontSize: 13 }}>No face verification documents.</p>
                  </div>
                )}
                <button onClick={handleFaceApprove} disabled={faceLoading || w.face_verified}
                  style={{ width: "100%", padding: "11px", borderRadius: 12, border: "none", background: w.face_verified ? T.greenBg : T.green, color: w.face_verified ? T.green : "white", fontWeight: 600, fontSize: 13, cursor: w.face_verified || faceLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: w.face_verified ? 0.7 : 1 }}>
                  {faceLoading ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <ShieldCheck size={14} />}
                  {w.face_verified ? "Face Already Verified" : "Approve Face Verification"}
                </button>
              </div>
            </div>
          )}

          {/* ── Skill Tab — now shows category cards ── */}
          {tab === "skill" && (
            <div>
              {evLoading ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: T.textMute }}>
                  <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
                  <p style={{ margin: 0, fontSize: 13 }}>Loading evidence...</p>
                </div>
              ) : categories.length === 0 ? (
                <div style={{ background: T.surface, borderRadius: 16, padding: 32, border: `1px solid ${T.border}`, textAlign: "center" }}>
                  <Briefcase size={32} style={{ color: T.textMute, opacity: 0.4, marginBottom: 12 }} />
                  <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: T.text }}>No skill evidence submitted</p>
                  <p style={{ margin: 0, fontSize: 13, color: T.textSec }}>This worker hasn't uploaded any verification files yet.</p>
                </div>
              ) : (
                <>
                  {/* Status pills */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                    {[
                      ["pending",  T.amber, categories.filter(c => c.status === "pending").length],
                      ["accepted", T.green, categories.filter(c => c.status === "accepted").length],
                      ["rejected", T.red,   categories.filter(c => c.status === "rejected").length],
                    ].map(([label, color, count]) => count > 0 && (
                      <span key={label} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: `${color}18`, color, border: `1px solid ${color}30` }}>
                        {count} {label}
                      </span>
                    ))}
                  </div>

                  {categories.map(ev => (
                    <CategoryEvidenceCard
                      key={ev.category}
                      ev={ev}
                      onAccept={handleAccept}
                      onReject={handleReject}
                      loading={actionLoad}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {lightbox && <Lightbox images={lightbox.images} startIndex={lightbox.index} onClose={() => setLB(null)} />}
    </div>
  );
};

// ── Worker Card ───────────────────────────────────────────────────────────────
const WorkerCard = ({ worker, onClick }) => {
  const fullName = worker.name || `${worker.firstName ?? ""} ${worker.lastName ?? ""}`.trim();
  const skillStatus = overallSkillStatus(worker.skillVerify || {});
  const bothVerified = skillStatus === "accepted" && worker.face_verified;
  const noneVerified = skillStatus === "unverified" && !worker.face_verified;

  return (
    <div onClick={onClick} style={{ background: T.surface, borderRadius: 18, border: `1px solid ${T.border}`, padding: 20, cursor: "pointer", transition: "all 0.2s", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 24px rgba(232,132,58,0.12)`; e.currentTarget.style.borderColor = T.brandMid; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)";   e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";           e.currentTarget.style.borderColor = T.border; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar worker={worker} size={46} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 3 }}>{fullName}</div>
            <div style={{ fontSize: 12, color: T.textMute }}>{worker.taskType}</div>
          </div>
        </div>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: bothVerified ? T.green : noneVerified ? T.red : T.amber, boxShadow: `0 0 0 3px ${bothVerified ? T.greenBg : noneVerified ? T.redBg : T.amberBg}`, flexShrink: 0, marginTop: 4 }} />
      </div>

      <Stars rating={worker.ratings} />

      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        <VerBadge verified={worker.face_verified} label="Face" />
        {/* Skill badge derived from skillVerify map */}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: skillStatus === "accepted" ? T.greenBg : T.amberBg, color: skillStatus === "accepted" ? T.green : T.amber, border: `1px solid ${skillStatus === "accepted" ? T.green + "30" : T.amber + "30"}` }}>
          {skillStatus === "accepted" ? <ShieldCheck size={11} /> : <Clock size={11} />}
          Skills: {skillStatus === "accepted" ? "Verified" : skillStatus === "pending" ? "Pending" : skillStatus === "rejected" ? "Rejected" : "Not Uploaded"}
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{worker.noOfCompletedTask ?? 0}</div>
          <div style={{ fontSize: 10, color: T.textMute }}>Jobs</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{worker.reviewCount ?? 0}</div>
          <div style={{ fontSize: 10, color: T.textMute }}>Reviews</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.brand }}>
            {worker.skills?.[0]?.price ? `Rs. ${worker.skills[0].price}` : "—"}
          </div>
          <div style={{ fontSize: 10, color: T.textMute }}>Rate/hr</div>
        </div>
      </div>

      <button style={{ width: "100%", marginTop: 14, padding: "10px", borderRadius: 10, border: `1px solid ${T.brandMid}`, background: T.brandDim, color: T.brand, fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <Eye size={14} /> Review Worker
      </button>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WorkerVerification() {
  const [workers,  setWorkers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");
  const [selected, setSelected] = useState(null);
  const [toast,    setToast]    = useState(null);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  const load = (status = "all") => {
    setLoading(true);
    const url = status === "all"
      ? `${BASE}/upload/skill-evidence/all?limit=200`
      : `${BASE}/upload/skill-evidence/all?status=${status}&limit=200`;

    fetch(url)
      .then(r => r.json())
      .then(async d => {
        const evidenceList = d?.evidence ?? [];

        const enriched = await Promise.all(
          evidenceList.map(async w => {
            const workerId = w.worker_id || w._id || w.email;
            try {
              const [workerData, statsData] = await Promise.all([
                fetchWorker(workerId),
                fetch(`${BASE}/stats/${workerId}`).then(r => r.json()).catch(() => ({})),
              ]);
              const full = workerData?.worker ?? workerData ?? {};
              const skillVerify = full.skillVerify || {};
              return {
                ...w,
                ...full,
                skillVerify,
                noOfCompletedTask: statsData.tasksCompleted ?? 0,
                reviewCount:       statsData.totalReviews   ?? 0,
                ratings:           full.ratings             ?? 0,
                face_verified:     full.face_verified ?? w.face_verified ?? false,
              };
            } catch {
              return { ...w, skillVerify: {}, face_verified: w.face_verified ?? false };
            }
          })
        );

        setWorkers(enriched);
        setLoading(false);
      })
      .catch(() => { showToast("Failed to load workers", "error"); setLoading(false); });
  };

  useEffect(() => { load(filter); }, [filter]);

  const handleFaceVerify = (workerId) => {
    setWorkers(prev => prev.map(w =>
      (w.worker_id === workerId || w._id === workerId || w.email === workerId)
        ? { ...w, face_verified: true } : w
    ));
  };

  const filtered = workers.filter(w => {
    const name = (w.name || `${w.firstName ?? ""} ${w.lastName ?? ""}`.trim()).toLowerCase();
    return (
      name.includes(search.toLowerCase()) ||
      w.worker_id?.toLowerCase().includes(search.toLowerCase()) ||
      w.taskType?.toLowerCase().includes(search.toLowerCase())
    );
  });

  // Stats based on category counts across all workers
  const allCategories = workers.flatMap(w => Object.values(w.skillVerify || {}));
  const stats = {
    total:    workers.length,
    verified: allCategories.filter(c => c.status === "accepted").length,
    pending:  allCategories.filter(c => c.status === "pending").length,
    rejected: allCategories.filter(c => c.status === "rejected").length,
  };

  return (
    <>
      <BookingNavbar />
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'DM Sans', system-ui, sans-serif" }}>

        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

        {/* Page Header */}
        <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "24px 40px", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 1300, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800, color: T.text }}>Worker Verification</h1>
                <p style={{ margin: 0, fontSize: 13, color: T.textSec }}>Review category evidence and approve face & skill verification</p>
              </div>
              <button onClick={() => load(filter)} style={{ padding: "10px 18px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface, color: T.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
              {[
                ["Total Workers",       stats.total,    T.blue,  T.blueBg,  "all"],
                ["Categories Verified", stats.verified, T.green, T.greenBg, "accepted"],
                ["Categories Pending",  stats.pending,  T.amber, T.amberBg, "pending"],
                ["Categories Rejected", stats.rejected, T.red,   T.redBg,   "rejected"],
              ].map(([label, val, color, bg, f]) => (
                <div key={label} onClick={() => setFilter(f)} style={{ background: filter === f ? bg : T.bg, borderRadius: 14, padding: "14px 18px", cursor: "pointer", border: `1px solid ${filter === f ? color + "40" : T.border}`, transition: "all 0.15s" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: filter === f ? color : T.textMute, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: filter === f ? color : T.text, lineHeight: 1 }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: 1300, margin: "0 auto", padding: "32px 40px" }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 28, alignItems: "center" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.textMute }} />
              <input type="text" placeholder="Search by name, ID, or task type…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: "100%", padding: "12px 14px 12px 42px", borderRadius: 14, border: `1px solid ${T.border}`, fontSize: 13, outline: "none", background: T.surface, color: T.text, boxSizing: "border-box", fontFamily: "inherit" }}
                onFocus={e => e.target.style.borderColor = T.brand}
                onBlur={e  => e.target.style.borderColor = T.border}
              />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[["All", "all"], ["Pending", "pending"], ["Accepted", "accepted"], ["Rejected", "rejected"]].map(([label, f]) => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding: "10px 16px", borderRadius: 12, border: `1px solid ${filter === f ? T.brand : T.border}`, background: filter === f ? T.brandDim : T.surface, color: filter === f ? T.brand : T.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <RefreshCw size={36} style={{ color: T.brand, animation: "spin 1s linear infinite", marginBottom: 12 }} />
              <p style={{ color: T.textSec, margin: 0 }}>Loading workers…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <Shield size={48} style={{ color: T.textMute, opacity: 0.4, marginBottom: 16 }} />
              <h3 style={{ margin: "0 0 8px", color: T.text }}>No workers found</h3>
              <p style={{ margin: 0, color: T.textSec, fontSize: 13 }}>Try adjusting your search or filter</p>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: T.textMute, marginBottom: 16 }}>Showing {filtered.length} of {workers.length} workers</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {filtered.map(w => (
                  <WorkerCard key={w.worker_id || w._id || w.email} worker={w} onClick={() => setSelected(w)} />
                ))}
              </div>
            </>
          )}
        </div>

        {selected && (
          <WorkerModal worker={selected} onClose={() => setSelected(null)} onFaceVerify={handleFaceVerify} onToast={showToast} />
        )}

        <style>{`
          @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
          @keyframes spin     { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </>
  );
}