import { useState, useEffect, useRef } from "react";
import BookingNavbar from "../components/Navbar/Navbar";
import { fetchCustomerById } from "../api/api";

const C = {
  orange:       "#f6ad56", orangeDark:   "#e59a3d", orangeDeep:   "#c97c20",
  orangeLight:  "#fff7ed", orangeBorder: "#fde8c8", bg:           "#f8f5f0",
  surface:      "#ffffff", border:       "#e2e8f0", divider:      "#f1f5f9",
  text:         "#0f172a", textMid:      "#475569", textLight:    "#94a3b8",
  green:        "#10b981", greenLight:   "#ecfdf5", greenBorder:  "#a7f3d0",
  red:          "#ef4444", redLight:     "#fef2f2", redBorder:    "#fecaca",
  blue:         "#3b82f6", blueLight:    "#eff6ff", blueBorder:   "#bfdbfe",
  amber:        "#f59e0b", amberLight:   "#fffbeb", amberBorder:  "#fde68a",
  purple:       "#8b5cf6", purpleLight:  "#f5f3ff", purpleBorder: "#e9d5ff",
};

const BASE = "http://127.0.0.1:8000";

const CATEGORY_SKILLS_MAP = {
  Plumbing:          ["Pipe Repair","Drain Cleaning","Sewer Repair","Fixture Installation","Water Heater Repair"],
  Moving:            ["Packing","Loading & Unloading","Furniture Moving","Relocation Support"],
  Cleaning:          ["House Cleaning","Office Cleaning","Carpet Cleaning","Window Cleaning","Laundry & Ironing"],
  Gardening:         ["Lawn Care","Landscaping","Tree Service","Plant Care","Garden Maintenance"],
  Painting:          ["Interior Painting","Exterior Painting","Wall Painting","Touch-ups & Patching"],
  Carpentry:         ["Furniture Repair","Cabinet Making","Shelving & Storage","Woodwork","Joinery"],
  "Appliance Repair":["Washer Repair","Dryer Repair","Fridge Repair","Oven Repair"],
  Electrical:        ["Wiring & Rewiring","Lighting Installation","Circuit Repair","Outlet & Switch Repair"],
  HVAC:              ["Heating Repair","Air Conditioning","Ventilation","Furnace Repair","Cooling Systems"],
  Assembly:          ["Furniture Assembly","Flat-pack Assembly","TV Mounting","Shelving Installation"],
};
const ALL_CATEGORIES = Object.keys(CATEGORY_SKILLS_MAP);

const SUB_TO_CATEGORY = {};
for (const [cat, subs] of Object.entries(CATEGORY_SKILLS_MAP)) {
  for (const sub of subs) SUB_TO_CATEGORY[sub] = cat;
}

const cityCoordinates = {
  'Kathmandu':  { lat: 27.7172, lng: 85.3240 }, 'Lalitpur':   { lat: 27.6667, lng: 85.3167 },
  'Bhaktapur':  { lat: 27.6710, lng: 85.4298 }, 'Pokhara':    { lat: 28.2096, lng: 83.9856 },
  'Chitwan':    { lat: 27.5291, lng: 84.3542 }, 'Butwal':     { lat: 27.7000, lng: 83.4500 },
  'Biratnagar': { lat: 26.4525, lng: 87.2718 }, 'Dharan':     { lat: 26.8145, lng: 87.2847 },
  'Nepalgunj':  { lat: 28.0500, lng: 81.6167 }, 'Dhangadhi':  { lat: 28.6944, lng: 80.5897 },
  'Hetauda':    { lat: 27.4281, lng: 85.0324 }, 'Janakpur':   { lat: 26.7288, lng: 85.9244 },
  'Bharatpur':  { lat: 27.6767, lng: 84.4333 }, 'Itahari':    { lat: 26.6708, lng: 87.2847 },
  'Birgunj':    { lat: 27.0000, lng: 84.8800 },
};
const serviceAreasList = Object.keys(cityCoordinates);

function parseApiSkills(rawSkills = [], skillVerify = {}) {
  const categoryMap = {};
  for (const skill of rawSkills) {
    const subName = skill.name;
    const price   = parseFloat(skill.price) || 0;
    const cat     = SUB_TO_CATEGORY[subName] || "Other";
    if (!categoryMap[cat]) categoryMap[cat] = { name: cat, subSkills: [] };
    categoryMap[cat].subSkills.push({ name: subName, price });
  }
  return Object.values(categoryMap).map(cat => ({
    ...cat,
    verify: skillVerify[cat.name] || null,
  }));
}

function computeOverallSkillStatus(skillVerify = {}) {
  const statuses = Object.values(skillVerify).map(v => v.status);
  if (!statuses.length) return "unverified";
  if (statuses.every(s => s === "accepted")) return "verified";
  if (statuses.some(s => s === "rejected"))  return "rejected";
  return "pending";
}

function loadWorker() {
  try { const raw = sessionStorage.getItem("user") || localStorage.getItem("user"); if (raw) return JSON.parse(raw); } catch {}
  return null;
}
function loadToken() {
  for (const store of [sessionStorage, localStorage]) {
    const t = store.getItem("token") || store.getItem("accessToken") || store.getItem("authToken");
    if (t) return t;
  }
  return null;
}
function saveWorkerToStore(updated) {
  for (const store of [localStorage, sessionStorage]) {
    if (store.getItem("worker")) store.setItem("worker", JSON.stringify(updated));
  }
}

const initials    = (f = "", l = "") => `${f[0] || ""}${l[0] || ""}`.toUpperCase() || "W";
const formatBytes = (b) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;
const fmtDate     = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const inputSx = {
  width: "100%", padding: "9px 13px", borderRadius: 8, fontSize: 13.5,
  border: `1.5px solid ${C.border}`, outline: "none", background: "#fafbfc",
  color: C.text, fontFamily: "inherit", boxSizing: "border-box",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const EmptyState = ({ title, sub }) => (
  <div style={{ padding: "56px 24px", textAlign: "center" }}>
    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>{title}</div>
    <div style={{ fontSize: 13, color: C.textLight, lineHeight: 1.75, maxWidth: 300, margin: "0 auto" }}>{sub}</div>
  </div>
);

const Toast = ({ toast }) => toast ? (
  <div style={{
    position: "fixed", top: 20, right: 20, zIndex: 9999,
    background: toast.ok ? "#065f46" : "#7f1d1d",
    color: "white", padding: "13px 20px", borderRadius: 12,
    fontSize: 13.5, fontWeight: 500, boxShadow: "0 10px 32px rgba(0,0,0,0.2)",
    display: "flex", alignItems: "center", gap: 10, animation: "slideIn 0.22s ease",
  }}>
    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,0.5)", flexShrink: 0 }} />
    {toast.msg}
  </div>
) : null;

const Toggle = ({ checked, onChange, disabled = false }) => (
  <div onClick={() => !disabled && onChange(!checked)} style={{
    width: 44, height: 24, borderRadius: 12, flexShrink: 0,
    background: checked ? C.orange : C.border,
    position: "relative", cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 0.2s", opacity: disabled ? 0.5 : 1,
  }}>
    <div style={{ position: "absolute", top: 3, left: checked ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.2)", transition: "left 0.2s" }} />
  </div>
);

const Btn = ({ children, onClick, variant = "primary", disabled = false, size = "md" }) => {
  const variants = {
    primary: { bg: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`, color: "white" },
    outline: { bg: "transparent", color: C.orange, border: `1.5px solid ${C.orange}` },
    ghost:   { bg: "transparent", color: C.textMid, border: `1.5px solid ${C.border}` },
    danger:  { bg: C.red, color: "white" },
  };
  const v = variants[variant] || variants.primary;
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      padding: size === "sm" ? "6px 14px" : "9px 20px", borderRadius: 8,
      fontSize: size === "sm" ? 12 : 13, fontWeight: 600, fontFamily: "inherit",
      cursor: disabled ? "not-allowed" : "pointer", background: v.bg, color: v.color,
      border: v.border || "none", opacity: disabled ? 0.6 : 1, transition: "all 0.15s",
    }}>
      {children}
    </button>
  );
};

const Spinner = ({ size = 14, color = "white" }) => (
  <div style={{ width: size, height: size, border: `2px solid ${color}40`, borderTopColor: color, borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
);

const PriceInput = ({ value, onChange, highlight }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ fontSize: 11, color: C.textLight, fontWeight: 700 }}>NPR</span>
      <input type="number" min="1" step="50" placeholder="500" value={value || ""}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: 86, padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${highlight ? C.red : focused ? C.orange : C.border}`, fontSize: 13, outline: "none", textAlign: "right", fontFamily: "inherit", transition: "border-color 0.15s" }}
      />
      <span style={{ fontSize: 11, color: C.textLight }}>/hr</span>
    </div>
  );
};

function EvidenceSection({ categoryName, verify, pending, err, loading, onFile, onUpload, onClear }) {
  const hasEvidence = verify?.evidenceUrl;
  const status      = verify?.status;
  const isAccepted  = status === "accepted";
  const isRejected  = status === "rejected";

  const badgeBg    = isAccepted ? C.green : isRejected ? C.red : C.amber;
  const badgeLabel = isAccepted ? "✓ Verified" : isRejected ? "✗ Rejected" : "Under Review";
  const rowBg      = isAccepted ? C.greenLight : isRejected ? C.redLight : C.amberLight;
  const rowBorder  = isAccepted ? C.greenBorder : isRejected ? C.redBorder : C.amberBorder;

  return (
    <div style={{ borderTop: `1px solid ${C.divider}`, padding: "12px 16px", background: "#FDFCFA" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
        Category Evidence
        {hasEvidence && (
          <span style={{ marginLeft: 8, background: C.greenLight, color: C.green, border: `1px solid ${C.greenBorder}`, borderRadius: 100, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>
            uploaded
          </span>
        )}
      </div>

      {err && <div style={{ fontSize: 12, color: C.red, background: C.redLight, borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>{err}</div>}

      {hasEvidence && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, marginBottom: 8, background: rowBg, border: `1px solid ${rowBorder}` }}>
          <span style={{ fontSize: 12, flex: 1, fontWeight: 500, color: C.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {verify.evidenceName || "Uploaded file"}
            <span style={{ marginLeft: 6, fontSize: 10.5, color: C.textLight }}>· {verify.evidenceType}</span>
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "2px 8px", flexShrink: 0, background: badgeBg, color: "white" }}>
            {badgeLabel}
          </span>
          <a href={verify.evidenceUrl} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, color: C.blue, textDecoration: "none", fontWeight: 600, flexShrink: 0 }}>
            View
          </a>
        </div>
      )}

      {isRejected && verify.skillVerifyReason && (
        <div style={{ fontSize: 12, color: C.red, background: C.redLight, border: `1px solid ${C.redBorder}`, borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>
          <strong>Reason:</strong> {verify.skillVerifyReason}
        </div>
      )}

      {isAccepted ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: C.greenLight, border: `1px solid ${C.greenBorder}`, borderRadius: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.green }}>✓ Verified — no further upload needed</span>
        </div>
      ) : pending ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: C.orangeLight, border: `1px solid ${C.orangeBorder}`, borderRadius: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pending.name}</div>
            <div style={{ fontSize: 11, color: C.textLight }}>{formatBytes(pending.size)}</div>
          </div>
          <button onClick={onUpload} disabled={loading}
            style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: C.orange, color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
            {loading ? "Uploading..." : "Upload"}
          </button>
          <button onClick={onClear} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, fontSize: 14, padding: "4px 6px" }}>✕</button>
        </div>
      ) : (
        <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", border: `2px dashed ${C.border}`, borderRadius: 8, cursor: "pointer", transition: "border-color 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = C.orange}
          onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
          <input type="file" accept="image/*,video/*,application/pdf,.pdf" style={{ display: "none" }}
            onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = ""; }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid }}>
              {hasEvidence ? `Re-upload evidence for ${categoryName}` : `Attach evidence for ${categoryName}`}
            </div>
            <div style={{ fontSize: 11, color: C.textLight }}>PDF, Image, or Video · Max 50MB</div>
          </div>
        </label>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function WorkerSettings() {
  const fileRef = useRef(null);
  const [worker, setWorker]     = useState(null);
  const [token, setToken]       = useState(null);
  const [tab, setTab]           = useState("profile");
  const [toast, setToast]       = useState(null);
  const [loading, setLoading]   = useState(true);

  const [firstName, setFirstName]             = useState("");
  const [lastName, setLastName]               = useState("");
  const [description, setDescription]         = useState("");
  const [basePrice, setBasePrice]             = useState("");
  const [isAvailable, setIsAvailable]         = useState(false);
  const [avatar, setAvatar]                   = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [phoneNo, setPhoneNo]                 = useState("");
  const [email, setEmail]                     = useState("");
  const [ratings, setRatings]                 = useState(0);
  const [totalEarnings, setTotalEarnings]     = useState(0);
  const [completedTasks, setCompletedTasks]   = useState(0);

  const [primaryCity, setPrimaryCity]         = useState("");
  const [secondaryCities, setSecondaryCities] = useState([]);

  const [editSkills, setEditSkills]     = useState([]);
  const [savedSkills, setSavedSkills]   = useState([]);
  const [skillsDirty, setSkillsDirty]   = useState(false);
  const [addingSkill, setAddingSkill]   = useState(false);
  const [newSkillCat, setNewSkillCat]   = useState("");
  const [newSubSels, setNewSubSels]     = useState([]);
  const [newSubPrices, setNewSubPrices] = useState({});
  const [addSkillErr, setAddSkillErr]   = useState("");

  const [evidenceFiles, setEvidenceFiles]     = useState({});
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceErrors, setEvidenceErrors]   = useState({});

  const [availData, setAvailData]       = useState(null);
  const [availLoading, setAvailLoading] = useState(false);

  const [reviews, setReviews]               = useState([]);
  const [reports, setReports]               = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);

  // ── Customer names fetched by user_id ──────────────────────────────────────
  const [customerNames, setCustomerNames]           = useState({});
  const [customerNamesLoading, setCustomerNamesLoading] = useState(false);

  const [saving, setSaving] = useState({});
  const [saved, setSaved]   = useState({});
  const [errors, setErrors] = useState({});

  const showToast    = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };
  const triggerSaved = (k) => { setSaved(p => ({ ...p, [k]: true })); setTimeout(() => setSaved(p => ({ ...p, [k]: false })), 2500); };
  const setError     = (k, m) => setErrors(p => ({ ...p, [k]: m }));
  const clearErr     = (k)    => setErrors(p => ({ ...p, [k]: "" }));
  const authH        = (t)    => ({ "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) });

  // ── Load all data on mount ──────────────────────────────────────────────────
  useEffect(() => {
    const loadAllData = async () => {
      const storedWorker = loadWorker();
      const t = loadToken();
      if (!storedWorker?.email) { setLoading(false); return; }
      setToken(t);
      try {
        const workerRes = await fetch(`${BASE}/api/worker/${encodeURIComponent(storedWorker.email)}`, { headers: authH(t) });
        if (workerRes.ok) {
          const w = await workerRes.json();
          setWorker(w);
          setFirstName(w.firstName || "");
          setLastName(w.lastName || "");
          if (w.serviceArea) {
            setPrimaryCity(w.serviceArea.primaryCity || "");
            setSecondaryCities(w.serviceArea.cities?.filter(c => c !== w.serviceArea.primaryCity) || []);
          }
          setDescription(w.description || "");
          setBasePrice(String(w.basePrice || ""));
          setIsAvailable(w.isAvailable ?? true);
          setAvatar(w.profilePhoto || null);
          setPhoneNo(w.phoneNo || "");
          setEmail(w.email || "");

          const formattedSkills = parseApiSkills(w.skills || [], w.skillVerify || {});
          setEditSkills(formattedSkills);
          setSavedSkills(JSON.parse(JSON.stringify(formattedSkills)));

          if (w.hours) {
            const weeklyHours = {};
            ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].forEach(day => {
              const slots = w.hours[day];
              weeklyHours[day] = slots?.length > 0
                ? { enabled: true, start: slots[0].start, end: slots[slots.length - 1].end, slots }
                : { enabled: false, slots: [] };
            });
            setAvailData({ weekly_hours: weeklyHours, unavailable_dates: [] });
          }
        }
        await fetchStats(storedWorker.email, t);
        await fetchReviews(storedWorker.email, t);
        await fetchReports(storedWorker.email, t);
      } catch (err) { console.error(err); showToast("Failed to load profile data", false); }
      finally { setLoading(false); }
    };
    loadAllData();
  }, []);

  // ── Fetch customer names whenever reviews change ────────────────────────────
  useEffect(() => {
    if (!reviews.length) return;
    const fetchNames = async () => {
      setCustomerNamesLoading(true);
      const names = {};
      await Promise.all(
        reviews.map(async (rev) => {
          const id = rev.user_id;
          if (!id || names[id]) return;
          try {
            const customer = await fetchCustomerById(id);
            names[id] =
              customer?.first_name
                ? `${customer.first_name} ${customer.last_name || ""}`.trim()
                : customer?.name || customer?.full_name || null;
          } catch {
            names[id] = null;
          }
        })
      );
      setCustomerNames(names);
      setCustomerNamesLoading(false);
    };
    fetchNames();
  }, [reviews]);

  const fetchStats = async (id, t) => {
    try {
      const res = await fetch(`${BASE}/api/stats/${id}`, { headers: authH(t) });
      if (res.ok) { const d = await res.json(); setCompletedTasks(d.tasksCompleted ?? 0); setTotalEarnings(d.totalEarnings ?? 0); setRatings(d.averageRating ?? 0); }
    } catch {}
  };
  const fetchReviews = async (id, t) => {
    setReviewsLoading(true);
    try { const res = await fetch(`${BASE}/api/reviews/worker/${id}`, { headers: authH(t) }); if (res.ok) { const d = await res.json(); setReviews(Array.isArray(d) ? d : d.reviews || []); } }
    catch {} finally { setReviewsLoading(false); }
  };
  const fetchReports = async (id, t) => {
    setReportsLoading(true);
    try { const res = await fetch(`${BASE}/api/reports/user/${id}`, { headers: authH(t) }); if (res.ok) { const d = await res.json(); setReports(Array.isArray(d) ? d : d.reports || []); } }
    catch {} finally { setReportsLoading(false); }
  };

  const refreshSkills = async () => {
    if (!worker?.email) return;
    try {
      const res = await fetch(`${BASE}/api/worker/${encodeURIComponent(worker.email)}`, { headers: authH(token) });
      if (res.ok) {
        const w = await res.json();
        setWorker(w);
        const f = parseApiSkills(w.skills || [], w.skillVerify || {});
        setEditSkills(f);
        setSavedSkills(JSON.parse(JSON.stringify(f)));
      }
    } catch {}
  };

  // ── Profile ─────────────────────────────────────────────────────────────────
  const handleProfileSave = async () => {
    if (!worker?.email) return;
    clearErr("profile"); setSaving(p => ({ ...p, profile: true }));
    try {
      const updateData = { firstName, lastName, description, basePrice: Number(basePrice) };
      const res = await fetch(`${BASE}/api/worker/${encodeURIComponent(worker.email)}`, { method: "PATCH", headers: authH(token), body: JSON.stringify(updateData) });
      if (res.ok) {
        await fetch(`${BASE}/api/worker/${worker.email}/availability/toggle`, { method: "PATCH", headers: authH(token), body: JSON.stringify({ isAvailable }) });
        triggerSaved("profile");
        const updated = { ...worker, ...updateData, isAvailable };
        setWorker(updated); saveWorkerToStore(updated);
        showToast("Profile updated successfully");
      } else { setError("profile", "Failed to save changes"); showToast("Failed to save changes", false); }
    } catch { setError("profile", "Network error"); showToast("Network error", false); }
    setSaving(p => ({ ...p, profile: false }));
  };

  // ── Service Areas ────────────────────────────────────────────────────────────
  const handleServiceAreasSave = async () => {
    if (!worker?.email) return;
    if (!primaryCity) { setError("serviceAreas", "Please select a primary city"); return; }
    clearErr("serviceAreas"); setSaving(p => ({ ...p, serviceAreas: true }));
    try {
      const allCities  = [primaryCity, ...secondaryCities].filter(Boolean);
      const updateData = { serviceArea: { primaryCity, coordinates: cityCoordinates[primaryCity] || { lat: 0, lng: 0 }, cities: allCities } };
      const res = await fetch(`${BASE}/api/worker/${encodeURIComponent(worker.email)}`, { method: "PATCH", headers: authH(token), body: JSON.stringify(updateData) });
      if (res.ok) {
        triggerSaved("serviceAreas");
        const updated = { ...worker, ...updateData };
        setWorker(updated); saveWorkerToStore(updated);
        showToast("Service areas updated successfully");
      } else { setError("serviceAreas", "Failed to save service areas"); showToast("Failed to save service areas", false); }
    } catch { setError("serviceAreas", "Network error"); showToast("Network error", false); }
    setSaving(p => ({ ...p, serviceAreas: false }));
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !worker?.email) return;
    const reader = new FileReader(); reader.onload = ev => setAvatar(ev.target.result); reader.readAsDataURL(file);
    setAvatarUploading(true);
    try {
      const fd = new FormData(); fd.append("photo", file); fd.append("worker_id", worker.email);
      const res = await fetch(`${BASE}/api/worker/upload-photo/${worker.email}`, { method: "POST", body: fd });
      if (res.ok) { const data = await res.json(); setAvatar(data.photo_url); const updated = { ...worker, profilePhoto: data.photo_url }; setWorker(updated); saveWorkerToStore(updated); showToast("Photo updated"); }
      else throw new Error();
    } catch { showToast("Upload failed", false); }
    finally { setAvatarUploading(false); }
  };

  const handleToggleAvailability = async () => {
    const next = !isAvailable; setIsAvailable(next);
    if (worker?.email) {
      try { await fetch(`${BASE}/api/worker/${worker.email}/availability/toggle`, { method: "PATCH", headers: authH(token), body: JSON.stringify({ isAvailable: next }) }); showToast(next ? "You are now available for work" : "You are now unavailable"); }
      catch { showToast("Failed to update availability", false); }
    }
  };

  const handlePrimaryCitySelect   = (city) => { setPrimaryCity(city); setSecondaryCities(prev => prev.filter(c => c !== city)); if (errors.serviceAreas) setErrors(p => ({ ...p, serviceAreas: "" })); };
  const handleSecondaryCityToggle = (city) => setSecondaryCities(prev => prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]);

  // ── Skills ───────────────────────────────────────────────────────────────────
  const markDirty = () => setSkillsDirty(true);

  const updateSubPrice = (si, bi, price) => {
    setEditSkills(prev => { const c = JSON.parse(JSON.stringify(prev)); c[si].subSkills[bi].price = price; return c; });
    markDirty();
  };
  const toggleSub = (si, subName) => {
    setEditSkills(prev => { const c = JSON.parse(JSON.stringify(prev)); const subs = c[si].subSkills; const idx = subs.findIndex(s => s.name === subName); if (idx >= 0) subs.splice(idx, 1); else subs.push({ name: subName, price: 0 }); return c; });
    markDirty();
  };
  const removeSkill = (si) => { setEditSkills(prev => prev.filter((_, i) => i !== si)); markDirty(); };

  const handleSkillsSave = async () => {
    clearErr("skills");
    for (const sk of editSkills) {
      if (!sk.subSkills?.length) { setError("skills", `"${sk.name}" needs at least one job type`); return; }
      if (sk.subSkills.some(s => !s.price || parseFloat(s.price) <= 0)) { setError("skills", `Set a price > 0 for every job type under "${sk.name}"`); return; }
    }
    if (!worker?.email) return;
    setSaving(p => ({ ...p, skills: true }));
    try {
      const skillsForApi = editSkills.flatMap(sk => sk.subSkills.map(sub => ({ name: sub.name, price: sub.price })));
      const res = await fetch(`${BASE}/api/worker/${encodeURIComponent(worker.email)}`, { method: "PATCH", headers: authH(token), body: JSON.stringify({ skills: skillsForApi }) });
      if (res.ok) {
        setSkillsDirty(false); triggerSaved("skills");
        setEvidenceFiles({});
        await refreshSkills();
        showToast("Skills saved successfully");
      } else { setError("skills", "Failed to save skills"); showToast("Failed to save skills", false); }
    } catch { setError("skills", "Network error"); showToast("Network error", false); }
    setSaving(p => ({ ...p, skills: false }));
  };

  const cancelAdd = () => { setAddingSkill(false); setNewSkillCat(""); setNewSubSels([]); setNewSubPrices({}); setAddSkillErr(""); };
  const confirmAddSkill = () => {
    setAddSkillErr("");
    if (!newSkillCat) { setAddSkillErr("Choose a category"); return; }
    if (!newSubSels.length) { setAddSkillErr("Select at least one job type"); return; }
    if (newSubSels.some(s => !newSubPrices[s] || parseFloat(newSubPrices[s]) <= 0)) { setAddSkillErr("Set a price > 0 for each job type"); return; }
    if (editSkills.some(s => s.name === newSkillCat)) { setAddSkillErr("This skill is already added"); return; }
    setEditSkills(prev => [{ name: newSkillCat, subSkills: newSubSels.map(s => ({ name: s, price: parseFloat(newSubPrices[s]) })), verify: null }, ...prev]);
    markDirty(); cancelAdd();
  };

  const handleEvidenceFile = (categoryName, file) => {
    const ok = file.type.startsWith("image/") || file.type.startsWith("video/") || file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!ok) { setEvidenceErrors(p => ({ ...p, [categoryName]: "Only PDF, image, or video" })); return; }
    setEvidenceErrors(p => { const n = { ...p }; delete n[categoryName]; return n; });
    setEvidenceFiles(p => ({ ...p, [categoryName]: file }));
  };

  const uploadEvidenceNow = async (categoryName) => {
    const file = evidenceFiles[categoryName];
    if (!file || !worker?.email) return;
    setEvidenceLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("worker_id", worker.email);
      fd.append("skill_name", categoryName);
      const res = await fetch(`${BASE}/api/upload/skill-evidence`, { method: "POST", body: fd });
      if (res.ok) {
        setEvidenceFiles(p => { const n = { ...p }; delete n[categoryName]; return n; });
        await refreshSkills();
        showToast(`Evidence for ${categoryName} uploaded`);
      } else {
        let msg = "Upload failed";
        try { const d = await res.json(); msg = d.detail || d.message || "Upload failed"; } catch {}
        setEvidenceErrors(p => ({ ...p, [categoryName]: msg })); showToast(msg, false);
      }
    } catch { setEvidenceErrors(p => ({ ...p, [categoryName]: "Network error" })); showToast("Network error", false); }
    setEvidenceLoading(false);
  };

  // ── Availability ─────────────────────────────────────────────────────────────
  const handleDayToggle = async (day, cur) => {
    if (!worker?.email) return;
    setAvailLoading(true);
    try {
      await fetch(`${BASE}/api/worker/${worker.email}/availability/hours/day`, { method: "PATCH", headers: authH(token), body: JSON.stringify({ day, enabled: !cur }) });
      const res = await fetch(`${BASE}/api/worker/${worker.email}`, { headers: authH(token) });
      if (res.ok) {
        const w = await res.json();
        if (w.hours) {
          const weeklyHours = {};
          ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].forEach(d => {
            const slots = w.hours[d];
            weeklyHours[d] = slots?.length > 0 ? { enabled: true, start: slots[0].start, end: slots[slots.length - 1].end, slots } : { enabled: false, slots: [] };
          });
          setAvailData({ weekly_hours: weeklyHours, unavailable_dates: [] });
        }
      }
    } catch {} finally { setAvailLoading(false); }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 28, height: 28, border: `2px solid ${C.orangeBorder}`, borderTopColor: C.orange, borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 16px" }} />
        <div style={{ fontSize: 14, color: C.textLight }}>Loading profile...</div>
      </div>
    </div>
  );

  if (!worker) return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>No worker session found</div>
      <div style={{ fontSize: 13, color: C.textLight }}>Please log in as a worker first</div>
    </div>
  );

  const displayName = `${firstName} ${lastName}`.trim() || worker.email;
  const initialsVal = initials(firstName, lastName);
  const avgRating   = ratings ? Number(ratings).toFixed(1) : "0.0";

  const overallSkillStatus = computeOverallSkillStatus(worker.skillVerify || {});

  const TABS = [
    { key: "profile",      label: "Profile" },
    { key: "skills",       label: "Skills", badge: skillsDirty },
    { key: "serviceAreas", label: "Service Areas" },
    { key: "availability", label: "Availability" },
    { key: "reviews",      label: "Reviews",  count: reviews.length },
    { key: "reports",      label: "Reports",  count: reports.length },
  ];

  const infoRows = [
    { key: "name",  label: "Full Name", value: displayName },
    { key: "email", label: "Email",     value: email },
    { key: "phone", label: "Phone",     value: phoneNo || "Not added" },
  ];

  const availSubs = newSkillCat ? (CATEGORY_SKILLS_MAP[newSkillCat] || []) : [];

  const skillStatusColor = overallSkillStatus === "verified" ? C.green : overallSkillStatus === "rejected" ? C.red : C.orangeDeep;
  const skillStatusBg    = overallSkillStatus === "verified" ? C.greenLight : overallSkillStatus === "rejected" ? C.redLight : C.orangeLight;
  const skillStatusLabel = overallSkillStatus === "verified" ? "Verified" : overallSkillStatus === "rejected" ? "Rejected" : overallSkillStatus === "pending" ? "Under Review" : "Not Verified";

  return (
    <>
      <BookingNavbar />
      <Toast toast={toast} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
        * { box-sizing: border-box; }
        .cp-root { font-family: 'DM Sans', -apple-system, sans-serif; }
        .cp-tab:hover { background: ${C.orangeLight} !important; color: ${C.orangeDeep} !important; }
        .cp-photo:hover .cp-overlay { opacity: 1 !important; }
        .cp-row:hover { background: ${C.orangeLight}66; }
        input:focus, textarea:focus, select:focus { border-color: ${C.orange} !important; box-shadow: 0 0 0 3px ${C.orange}22 !important; outline: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideIn { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
        .cp-panel { animation: fadeIn 0.18s ease; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        .city-chip { transition: all 0.15s; cursor: pointer; }
        .city-chip:hover { border-color: ${C.orange} !important; color: ${C.orangeDeep} !important; }
      `}</style>

      <div className="cp-root" style={{ background: C.bg, minHeight: "100vh", padding: "28px 32px 60px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>

          {/* ════ LEFT SIDEBAR ════ */}
          <div style={{ width: 272, flexShrink: 0, position: "sticky", top: 108, alignSelf: "flex-start" }}>
            <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
              <div style={{ height: 76, background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)`, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, opacity: 0.1, backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 20px 22px" }}>
                <div className="cp-photo" style={{ position: "relative", cursor: "pointer", marginTop: -48 }} onClick={() => fileRef.current?.click()}>
                  <div style={{ width: 96, height: 96, borderRadius: "50%", background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 800, color: "white", overflow: "hidden", border: "3px solid white", boxShadow: `0 4px 20px ${C.orange}55` }}>
                    {avatar ? <img src={avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initialsVal}
                  </div>
                  <div className="cp-overlay" style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,0.42)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.18s", border: "3px solid white" }}>
                    {avatarUploading ? <div style={{ width: 18, height: 18, border: "2.5px solid white", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> : <span style={{ fontSize: 11, color: "white", fontWeight: 600 }}>Change</span>}
                  </div>
                </div>
                <div style={{ marginTop: 12, fontSize: 17, fontWeight: 700, color: C.text, textAlign: "center", lineHeight: 1.3 }}>{displayName}</div>
                {email && <div style={{ fontSize: 12.5, color: C.textLight, marginTop: 4, textAlign: "center" }}>{email}</div>}
                <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
                <div onClick={handleToggleAvailability}
                  style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 40, cursor: "pointer", background: isAvailable ? C.greenLight : C.redLight, border: `1.5px solid ${isAvailable ? C.green : C.red}` }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: isAvailable ? C.green : C.red }} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: isAvailable ? C.green : C.red }}>{isAvailable ? "Available for work" : "Unavailable"}</span>
                </div>
              </div>
              <div style={{ height: 1, background: C.divider }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
                {[{ label: "Tasks", value: completedTasks, color: C.orange }, { label: "Rating", value: avgRating, color: C.green }, { label: "Reviews", value: reviews.length, color: C.orangeDark }].map((s, i) => (
                  <div key={s.label} style={{ textAlign: "center", padding: "16px 0", borderRight: i < 2 ? `1px solid ${C.divider}` : "none" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: C.textLight, marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: C.divider }} />
              <div style={{ padding: "16px 20px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Total Earnings</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>NPR {totalEarnings.toLocaleString()}</div>
              </div>
              <div style={{ height: 1, background: C.divider }} />
              <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: C.textMid }}>Face Verification</span>
                  <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: worker.face_verified ? C.greenLight : C.orangeLight, color: worker.face_verified ? C.green : C.orangeDeep }}>
                    {worker.face_verified ? "Verified" : "Pending"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: C.textMid }}>Skill Verification</span>
                  <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: skillStatusBg, color: skillStatusColor }}>
                    {skillStatusLabel}
                  </span>
                </div>
                {Object.entries(worker.skillVerify || {}).length > 0 && (
                  <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
                    {Object.entries(worker.skillVerify).map(([cat, data]) => {
                      const c = data.status === "accepted" ? C.green : data.status === "rejected" ? C.red : C.amber;
                      const l = data.status === "accepted" ? "✓" : data.status === "rejected" ? "✗" : "…";
                      return (
                        <div key={cat} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 11, color: C.textLight }}>{cat}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: c }}>{l} {data.status}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {worker.status === "suspended" && <div style={{ marginTop: 8, padding: "8px 12px", background: C.redLight, borderRadius: 8, fontSize: 12, color: C.red, textAlign: "center" }}>Account Suspended</div>}
              </div>
            </div>
          </div>

          {/* ════ RIGHT PANEL ════ */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", overflow: "hidden" }}>

              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, padding: "0 6px", background: "#fafaf9", gap: 2, overflowX: "auto" }}>
                {TABS.map(t => (
                  <button key={t.key} className="cp-tab" onClick={() => setTab(t.key)} style={{
                    padding: "14px 18px", background: "none", border: "none",
                    borderBottom: `2.5px solid ${tab === t.key ? C.orange : "transparent"}`,
                    cursor: "pointer", fontSize: 13.5, fontWeight: tab === t.key ? 700 : 500,
                    color: tab === t.key ? C.orangeDeep : C.textMid, fontFamily: "inherit",
                    whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 7,
                    marginBottom: -1, borderRadius: "6px 6px 0 0",
                  }}>
                    {t.label}
                    {t.badge && <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.orange, display: "inline-block" }} />}
                    {t.count > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: tab === t.key ? C.orange : C.border, color: tab === t.key ? "white" : C.textMid, padding: "0 5px" }}>{t.count}</span>}
                  </button>
                ))}
              </div>

              {/* ── PROFILE TAB ── */}
              {tab === "profile" && (
                <div className="cp-panel">
                  <div style={{ padding: "30px 28px 22px", fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.09em" }}>Personal Information</div>
                  {errors.profile && <div style={{ margin: "0 28px 16px", padding: "10px 14px", background: C.redLight, border: `1px solid ${C.redBorder}`, borderRadius: 8, fontSize: 13, color: C.red }}>{errors.profile}</div>}
                  {infoRows.map((row, i, arr) => (
                    <div key={row.key}>
                      <div className="cp-row" style={{ padding: "15px 28px", display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ width: 136, flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: C.textLight }}>{row.label}</div>
                        <div style={{ flex: 1 }}>
                          {row.key === "name" ? (
                            <div style={{ display: "flex", gap: 8 }}>
                              <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" style={{ ...inputSx, flex: 1 }} />
                              <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" style={{ ...inputSx, flex: 1 }} />
                            </div>
                          ) : row.key === "basePrice" ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 13, color: C.textLight }}>NPR</span>
                              <input type="number" value={basePrice} onChange={e => setBasePrice(e.target.value)} style={{ ...inputSx, width: 120 }} placeholder="Rate per hour" />
                              <span style={{ fontSize: 13, color: C.textLight }}>/hr</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 13.5, color: row.value === "Not added" ? C.textLight : C.text, fontStyle: row.value === "Not added" ? "italic" : "normal" }}>
                              {row.value}
                              {row.key === "email" && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: C.green, background: C.greenLight, border: `1px solid ${C.greenBorder}`, borderRadius: 10, padding: "1px 7px" }}>Verified</span>}
                            </span>
                          )}
                        </div>
                      </div>
                      {i < arr.length - 1 && <div style={{ height: 1, background: C.divider, margin: "0 28px" }} />}
                    </div>
                  ))}
                  <div style={{ padding: "20px 28px", borderTop: `1px solid ${C.divider}` }}>
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.textLight, marginBottom: 8 }}>Bio / Description</div>
                      <textarea value={description} onChange={e => setDescription(e.target.value)} rows={6} style={{ ...inputSx, resize: "vertical" }} placeholder="Describe your experience, skills, and what makes you a great worker..." />
                      <div style={{ fontSize: 11, color: C.textLight, marginTop: 4, textAlign: "right" }}>{description.length}/500</div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <Btn onClick={handleProfileSave} disabled={saving.profile}>{saving.profile ? <Spinner /> : saved.profile ? "Saved!" : "Save Changes"}</Btn>
                    </div>
                  </div>
                </div>
              )}

              {/* ── SKILLS TAB ── */}
              {tab === "skills" && (
                <div className="cp-panel">
                  <div style={{ padding: "18px 28px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>Your Skills & Services</div>
                      <div style={{ fontSize: 12.5, color: C.textLight }}>Manage your service categories and upload evidence per category</div>
                    </div>
                    {!addingSkill && <button onClick={() => setAddingSkill(true)} style={{ padding: "9px 20px", borderRadius: 9, background: C.orangeLight, color: C.orangeDeep, border: `1.5px solid ${C.orangeBorder}`, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Add Skill</button>}
                  </div>

                  {errors.skills && <div style={{ margin: "16px 28px", padding: "10px 14px", background: C.redLight, border: `1px solid ${C.redBorder}`, borderRadius: 8, fontSize: 13, color: C.red }}>{errors.skills}</div>}

                  {addingSkill && (
                    <div style={{ padding: "24px 28px", borderBottom: `1px solid ${C.border}`, background: C.orangeLight }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.orangeDeep, marginBottom: 16 }}>Add New Skill</div>
                      {addSkillErr && <div style={{ marginBottom: 16, padding: "10px 14px", background: C.redLight, border: `1px solid ${C.redBorder}`, borderRadius: 8, fontSize: 13, color: C.red }}>{addSkillErr}</div>}
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.textLight, marginBottom: 8 }}>Service Category</div>
                        <select value={newSkillCat} onChange={e => { setNewSkillCat(e.target.value); setNewSubSels([]); setNewSubPrices({}); }} style={{ ...inputSx, width: "100%" }}>
                          <option value="">Select a category...</option>
                          {ALL_CATEGORIES.filter(c => !editSkills.some(s => s.name === c)).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      {newSkillCat && (
                        <>
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: C.textLight, marginBottom: 8 }}>Select Service Types</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {availSubs.map(sub => { const on = newSubSels.includes(sub); return <button key={sub} type="button" onClick={() => { setNewSubSels(p => p.includes(sub) ? p.filter(s => s !== sub) : [...p, sub]); }} style={{ padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12.5, border: `1.5px solid ${on ? C.orange : C.border}`, background: on ? C.orangeLight : C.surface, color: on ? C.orangeDeep : C.textMid, fontFamily: "inherit" }}>{sub}</button>; })}
                            </div>
                          </div>
                          {newSubSels.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: C.textLight, marginBottom: 8 }}>Set Your Rates (NPR/hr)</div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {newSubSels.map(sub => (
                                  <div key={sub} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, flexWrap: "wrap", gap: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{sub}</span>
                                    <PriceInput value={newSubPrices[sub]} onChange={v => setNewSubPrices(p => ({ ...p, [sub]: v }))} highlight={!newSubPrices[sub] || newSubPrices[sub] <= 0} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                        <Btn onClick={cancelAdd} variant="ghost">Cancel</Btn>
                        <Btn onClick={confirmAddSkill}>Add Skill</Btn>
                      </div>
                    </div>
                  )}

                  {editSkills.length === 0 && !addingSkill && <EmptyState title="No skills added yet" sub="Add your skills so customers can find you and book your services" />}

                  {editSkills.map((sk, si) => {
                    const catSubs     = CATEGORY_SKILLS_MAP[sk.name] || [];
                    const selSubNames = sk.subSkills?.map(s => s.name) || [];
                    const isVerified  = sk.verify?.status === "accepted";
                    return (
                      <div key={si} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ padding: "18px 28px", background: C.bg }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.orange }} />
                              <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{sk.name}</span>
                              <span style={{ fontSize: 12, color: C.textLight, background: C.surface, padding: "2px 10px", borderRadius: 20, border: `1px solid ${C.border}` }}>{sk.subSkills?.length || 0} service{sk.subSkills?.length !== 1 ? "s" : ""}</span>
                              {isVerified && <span style={{ fontSize: 11, fontWeight: 700, color: C.green, background: C.greenLight, border: `1px solid ${C.greenBorder}`, borderRadius: 20, padding: "2px 10px" }}>✓ Verified</span>}
                            </div>
                            <Btn onClick={() => removeSkill(si)} variant="ghost" size="sm">Remove</Btn>
                          </div>
                          {catSubs.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Service Types</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {catSubs.map(sub => { const on = selSubNames.includes(sub); return <button key={sub} onClick={() => toggleSub(si, sub)} style={{ padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12.5, fontWeight: on ? 600 : 400, border: `1.5px solid ${on ? C.orange : C.border}`, background: on ? C.orangeLight : C.surface, color: on ? C.orangeDeep : C.textMid, fontFamily: "inherit" }}>{sub}</button>; })}
                              </div>
                            </div>
                          )}
                          {sk.subSkills?.length > 0 && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Set Your Rates (NPR/hr)</div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {sk.subSkills.map((sub, bi) => (
                                  <div key={bi} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, flexWrap: "wrap", gap: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{sub.name}</span>
                                    <PriceInput value={sub.price} onChange={v => updateSubPrice(si, bi, v)} highlight={!sub.price || sub.price <= 0} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <EvidenceSection
                            categoryName={sk.name}
                            verify={sk.verify}
                            pending={evidenceFiles[sk.name]}
                            err={evidenceErrors[sk.name]}
                            loading={evidenceLoading}
                            onFile={f => handleEvidenceFile(sk.name, f)}
                            onUpload={() => uploadEvidenceNow(sk.name)}
                            onClear={() => setEvidenceFiles(p => { const n = { ...p }; delete n[sk.name]; return n; })}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {editSkills.length > 0 && (
                    <div style={{ padding: "20px 28px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                      {skillsDirty ? <span style={{ fontSize: 12, color: C.orangeDeep, fontWeight: 600 }}>Unsaved changes</span> : <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>All skills saved</span>}
                      <Btn onClick={handleSkillsSave} disabled={saving.skills || !skillsDirty}>{saving.skills ? <><Spinner /> Saving...</> : saved.skills ? "Saved!" : "Save Skills"}</Btn>
                    </div>
                  )}
                </div>
              )}

              {/* ── SERVICE AREAS TAB ── */}
              {tab === "serviceAreas" && (
                <div className="cp-panel">
                  <div style={{ padding: "18px 28px", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>Service Areas</div>
                    <div style={{ fontSize: 12.5, color: C.textLight }}>Set the cities where you are available to take bookings</div>
                  </div>
                  {errors.serviceAreas && <div style={{ margin: "16px 28px 0", padding: "10px 14px", background: C.redLight, border: `1px solid ${C.redBorder}`, borderRadius: 8, fontSize: 13, color: C.red }}>{errors.serviceAreas}</div>}
                  <div style={{ padding: "24px 28px" }}>
                    <div style={{ marginBottom: 28 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.orange }} />
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>Primary Service Area <span style={{ color: C.red }}>*</span></span>
                      </div>
                      <div style={{ fontSize: 12.5, color: C.textLight, marginBottom: 14, paddingLeft: 16 }}>Your main city — used to match you with nearby customers first</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {serviceAreasList.map(city => (
                          <div key={city} className="city-chip" onClick={() => handlePrimaryCitySelect(city)}
                            style={{ padding: "8px 18px", borderRadius: 24, fontSize: 13, fontWeight: primaryCity === city ? 700 : 400, background: primaryCity === city ? C.orange : C.surface, border: `1.5px solid ${primaryCity === city ? C.orange : C.border}`, color: primaryCity === city ? "white" : C.textMid, userSelect: "none", boxShadow: primaryCity === city ? `0 2px 8px ${C.orange}55` : "none" }}>
                            {primaryCity === city && <span style={{ marginRight: 6 }}>✓</span>}{city}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginBottom: 28 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.border }} />
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>Additional Service Areas <span style={{ fontSize: 12, fontWeight: 400, color: C.textLight, marginLeft: 6 }}>(optional)</span></span>
                      </div>
                      <div style={{ fontSize: 12.5, color: C.textLight, marginBottom: 14, paddingLeft: 16 }}>You can also accept bookings from these cities</div>
                      {!primaryCity ? (
                        <div style={{ padding: "14px 18px", background: C.amberLight, border: `1px solid ${C.amberBorder}`, borderRadius: 10, fontSize: 13, color: C.amber }}>Please select a primary city first</div>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {serviceAreasList.filter(city => city !== primaryCity).map(city => (
                            <div key={city} className="city-chip" onClick={() => handleSecondaryCityToggle(city)}
                              style={{ padding: "8px 18px", borderRadius: 24, fontSize: 13, fontWeight: secondaryCities.includes(city) ? 600 : 400, background: secondaryCities.includes(city) ? C.orangeLight : C.surface, border: `1.5px solid ${secondaryCities.includes(city) ? C.orange : C.border}`, color: secondaryCities.includes(city) ? C.orangeDeep : C.textMid, userSelect: "none" }}>
                              {secondaryCities.includes(city) && <span style={{ marginRight: 6 }}>✓</span>}{city}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {primaryCity && (
                      <div style={{ padding: "16px 20px", background: C.orangeLight, border: `1px solid ${C.orangeBorder}`, borderRadius: 12, marginBottom: 24 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.orangeDeep, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Coverage Summary</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.orangeDeep, background: C.orange + "22", borderRadius: 6, padding: "2px 8px", flexShrink: 0 }}>PRIMARY</span>
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{primaryCity}</span>
                          </div>
                          {secondaryCities.length > 0 && (
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: C.textLight, background: C.border, borderRadius: 6, padding: "2px 8px", flexShrink: 0, marginTop: 1 }}>ALSO</span>
                              <span style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6 }}>{secondaryCities.join(" · ")}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <Btn onClick={handleServiceAreasSave} disabled={saving.serviceAreas || !primaryCity}>{saving.serviceAreas ? <Spinner /> : saved.serviceAreas ? "Saved!" : "Save Service Areas"}</Btn>
                    </div>
                  </div>
                </div>
              )}

              {/* ── AVAILABILITY TAB ── */}
              {tab === "availability" && (
                <div className="cp-panel">
                  <div style={{ padding: "18px 28px", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>Weekly Availability</div>
                    <div style={{ fontSize: 12.5, color: C.textLight }}>Toggle the days you are available for work. Changes sync immediately.</div>
                  </div>
                  {availLoading && <div style={{ margin: "16px 28px", padding: "10px 14px", background: C.orangeLight, border: `1px solid ${C.orangeBorder}`, borderRadius: 8, fontSize: 13, color: C.orangeDeep }}>Updating availability...</div>}
                  {availData?.weekly_hours ? (
                    <div style={{ padding: "20px 28px" }}>
                      {Object.entries(availData.weekly_hours).map(([day, info]) => (
                        <div key={day} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 16px", background: info.enabled ? C.greenLight : C.bg, borderRadius: 10, border: `1px solid ${info.enabled ? C.greenBorder : C.border}`, marginBottom: 8, gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: info.enabled ? C.green : C.textMid }}>{day}</span>
                            {info.enabled && info.slots?.length > 0 && (
                              <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                                {info.slots.map((slot, idx) => <span key={idx} style={{ fontSize: 12, color: C.textLight }}>{slot.start} – {slot.end}</span>)}
                              </div>
                            )}
                          </div>
                          <Toggle checked={info.enabled} onChange={() => handleDayToggle(day, info.enabled)} />
                        </div>
                      ))}
                    </div>
                  ) : <EmptyState title="No schedule set" sub="Set your weekly availability to start receiving booking requests" />}
                </div>
              )}

              {/* ── REVIEWS TAB ── */}
              {tab === "reviews" && (
                <div className="cp-panel">
                  {reviewsLoading ? (
                    <div style={{ padding: "40px", textAlign: "center" }}><Spinner size={24} color={C.orange} /></div>
                  ) : reviews.length > 0 ? (
                    <>
                      <div style={{ padding: "20px 28px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 20, background: C.orangeLight }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 40, fontWeight: 800, color: C.orange, lineHeight: 1 }}>{avgRating}</div>
                          <div style={{ fontSize: 10.5, color: C.textLight, marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>avg rating</div>
                        </div>
                        <div style={{ width: 1, height: 44, background: C.orangeBorder }} />
                        <div style={{ fontSize: 13.5, color: C.textMid, lineHeight: 1.8 }}>
                          You have received <strong style={{ color: C.text }}>{reviews.length} review{reviews.length > 1 ? "s" : ""}</strong> from customers
                        </div>
                      </div>

                      {customerNamesLoading && (
                        <div style={{ padding: "10px 28px", fontSize: 12, color: C.textLight, display: "flex", alignItems: "center", gap: 8 }}>
                          <Spinner size={12} color={C.textLight} /> Loading customer details...
                        </div>
                      )}

                      {reviews.map((rev, i) => {
                        const rating = rev.stars || rev.rating || 0;

                        // ── Resolve customer name: fetched first, fallback to embedded data ──
                        const customerName =
                          customerNames[rev.user_id]
                          || (rev.first_name ? `${rev.first_name} ${rev.last_name || ""}`.trim() : null)
                          || rev.customerName
                          || "Customer";

                        return (
                          <div key={i}>
                            {i > 0 && <div style={{ height: 1, background: C.divider, margin: "0 28px" }} />}
                            <div className="cp-row" style={{ padding: "18px 28px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                <div>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>{customerName}</div>
                                  <div style={{ fontSize: 12, color: C.textLight }}>{fmtDate(rev.createdAt)}</div>
                                </div>
                                <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                                  {[1,2,3,4,5].map(n => (
                                    <div key={n} style={{ width: 10, height: 10, borderRadius: "50%", background: n <= rating ? C.orange : C.border }} />
                                  ))}
                                  <span style={{ marginLeft: 6, fontSize: 12.5, fontWeight: 700, color: C.orangeDeep }}>{rating}/5</span>
                                </div>
                              </div>
                              {(rev.text || rev.comment) && (
                                <p style={{ margin: 0, fontSize: 13.5, color: C.textMid, lineHeight: 1.75 }}>{rev.text || rev.comment}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <EmptyState title="No reviews yet" sub="Reviews from customers will appear here once you complete tasks" />
                  )}
                </div>
              )}

              {/* ── REPORTS TAB ── */}
              {tab === "reports" && (
                <div className="cp-panel">
                  <div style={{ padding: "18px 28px", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>Reports & Complaints</div>
                    <div style={{ fontSize: 12.5, color: C.textLight }}>Any reports filed will appear here</div>
                  </div>
                  {reportsLoading ? (
                    <div style={{ padding: "40px", textAlign: "center" }}><Spinner size={24} color={C.orange} /></div>
                  ) : reports.length === 0 ? (
                    <EmptyState title="No reports filed" sub="No complaints have been filed against you. Keep up the good work!" />
                  ) : reports.map((r, i) => {
                    const statusColor  = r.status === "resolved" ? C.green : r.status === "declined" ? C.red : C.orangeDeep;
                    const statusBg     = r.status === "resolved" ? C.greenLight : r.status === "declined" ? C.redLight : C.orangeLight;
                    const statusBorder = r.status === "resolved" ? C.greenBorder : r.status === "declined" ? C.redBorder : C.orangeBorder;
                    return (
                      <div key={i}>
                        {i > 0 && <div style={{ height: 1, background: C.divider, margin: "0 28px" }} />}
                        <div className="cp-row" style={{ padding: "18px 28px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{r.reason || "Report"}</div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, background: statusBg, border: `1px solid ${statusBorder}`, padding: "3px 10px", borderRadius: 20 }}>
                              {r.status === "resolved" ? "Resolved" : r.status === "declined" ? "Declined" : "Under Review"}
                            </span>
                          </div>
                          {r.description && <p style={{ margin: "0 0 10px", fontSize: 13.5, color: C.textMid, lineHeight: 1.7 }}>{r.description}</p>}
                          <div style={{ fontSize: 12, color: C.textLight }}>Filed {fmtDate(r.createdAt)}</div>
                          {r.adminNote && (
                            <div style={{ marginTop: 12, padding: "12px 16px", background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Response from Kaam-ly</div>
                              <div style={{ fontSize: 13.5, color: C.textMid, lineHeight: 1.65 }}>{r.adminNote}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  );
}