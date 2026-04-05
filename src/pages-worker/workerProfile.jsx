import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
// import BookingNavbar from "../components/NavBar/NavBar";
// import { getWorker, getWorkerTasks, getWorkerReviews, getWorkerReports, updateWorkerName, updateWorkerBio, updateWorkerPhoto, updateWorkerAddress } from "../api/api";

/* ─── DESIGN TOKENS (mirror of CustomerProfile) ───────────── */
const C = {
  orange:       "#f6ad56",
  orangeDark:   "#e59a3d",
  orangeDeep:   "#c97c20",
  orangeLight:  "#fff7ed",
  orangeBorder: "#fde8c8",
  bg:           "#f8f5f0",
  surface:      "#ffffff",
  border:       "#e2e8f0",
  divider:      "#f1f5f9",
  text:         "#0f172a",
  textMid:      "#475569",
  textLight:    "#94a3b8",
  green:        "#10b981",
  greenLight:   "#ecfdf5",
  greenBorder:  "#a7f3d0",
  red:          "#ef4444",
  redLight:     "#fef2f2",
  redBorder:    "#fecaca",
  blue:         "#3b82f6",
  blueLight:    "#eff6ff",
  blueBorder:   "#bfdbfe",
  purple:       "#8b5cf6",
  purpleLight:  "#f5f3ff",
  purpleBorder: "#ddd6fe",
};

/* ─── HELPERS ─────────────────────────────────────────────── */
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtMonth = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

/* ─── SHARED UI ───────────────────────────────────────────── */
const inputSx = {
  width: "100%", padding: "9px 13px", borderRadius: 8, fontSize: "clamp(12px,1.2vw,13.5px)",
  border: `1.5px solid ${C.border}`, outline: "none", background: "#fafbfc",
  color: C.text, fontFamily: "inherit", boxSizing: "border-box",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const EmptyState = ({ title, sub }) => (
  <div style={{ padding: "clamp(32px,5vw,56px) 24px", textAlign: "center" }}>
    <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.orangeLight, border: `1.5px solid ${C.orangeBorder}`, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.orange }} />
    </div>
    <div style={{ fontSize: "clamp(13px,1.3vw,14px)", fontWeight: 600, color: C.text, marginBottom: 6 }}>{title}</div>
    <div style={{ fontSize: "clamp(12px,1.2vw,13px)", color: C.textLight, lineHeight: 1.75, maxWidth: 300, margin: "0 auto" }}>{sub}</div>
  </div>
);

const Toast = ({ toast }) => toast ? (
  <div style={{
    position: "fixed", top: "clamp(12px,2vw,20px)", right: "clamp(12px,2vw,20px)", zIndex: 9999,
    background: toast.ok ? "#065f46" : "#7f1d1d",
    color: "white", padding: "13px 20px", borderRadius: 12,
    fontSize: "clamp(12px,1.2vw,13.5px)", fontWeight: 500,
    boxShadow: "0 10px 32px rgba(0,0,0,0.2)",
    display: "flex", alignItems: "center", gap: 10,
    animation: "slideIn 0.22s ease", maxWidth: "clamp(260px,40vw,420px)",
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
    <div style={{
      position: "absolute", top: 3, left: checked ? 23 : 3,
      width: 18, height: 18, borderRadius: "50%", background: "white",
      boxShadow: "0 1px 4px rgba(0,0,0,0.2)", transition: "left 0.2s",
    }} />
  </div>
);

/* ─── STATUS BADGE ────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const map = {
    pending:    { label: "Pending",     color: C.orangeDeep, bg: C.orangeLight, bd: C.orangeBorder },
    assigned:   { label: "Assigned",    color: C.blue,       bg: C.blueLight,   bd: C.blueBorder   },
    in_progress:{ label: "In Progress", color: C.purple,     bg: C.purpleLight, bd: C.purpleBorder },
    worker_done:{ label: "Done",        color: C.green,      bg: C.greenLight,  bd: C.greenBorder  },
    completed:  { label: "Completed",   color: C.green,      bg: C.greenLight,  bd: C.greenBorder  },
    paid:       { label: "Paid",        color: C.green,      bg: C.greenLight,  bd: C.greenBorder  },
    cancelled:  { label: "Cancelled",   color: C.red,        bg: C.redLight,    bd: C.redBorder    },
  };
  const s = map[status] || { label: status, color: C.textLight, bg: C.divider, bd: C.border };
  return (
    <span style={{ fontSize: "clamp(10px,1vw,11px)", fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.bd}`, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
};

/* ─── STAR RATING ─────────────────────────────────────────── */
const StarRating = ({ rating, size = 16 }) => (
  <span style={{ display: "inline-flex", gap: 1, alignItems: "center" }}>
    {[1,2,3,4,5].map(n => (
      <span key={n} style={{ fontSize: size, color: n <= Math.round(rating) ? C.orange : C.border, lineHeight: 1 }}>★</span>
    ))}
  </span>
);

/* ─── AVAILABILITY GRID ───────────────────────────────────── */
const AvailabilityGrid = ({ hours }) => {
  if (!hours) return <div style={{ fontSize: "clamp(12px,1.2vw,13px)", color: C.textLight, fontStyle: "italic" }}>No availability set</div>;
  const fmtTime = (t) => {
    if (!t) return "";
    const [h, m] = t.split(":");
    const hr = parseInt(h, 10);
    return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {DAYS.map(day => {
        const slots = hours[day] || [];
        const on = slots.length > 0;
        return (
          <div key={day} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.divider}` }}>
            <div style={{ width: "clamp(70px,8vw,90px)", flexShrink: 0, fontSize: "clamp(12px,1.2vw,13px)", fontWeight: 600, color: on ? C.text : C.textLight }}>{day}</div>
            {on ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {slots.map((slot, i) => (
                  <span key={i} style={{ fontSize: "clamp(11px,1.1vw,12px)", fontWeight: 600, color: C.green, background: C.greenLight, border: `1px solid ${C.greenBorder}`, padding: "3px 10px", borderRadius: 20 }}>
                    {fmtTime(slot.start)} – {fmtTime(slot.end)}
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: "clamp(11px,1.1vw,12px)", color: C.textLight, fontStyle: "italic" }}>Not available</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ─── MOCK DATA (remove when using real API) ──────────────── */
const MOCK_WORKER = {
  _id: "w001",
  firstName: "Rajan", lastName: "Shrestha",
  email: "rajan.shrestha@example.com",
  phoneNo: "9841234567",
  taskType: "Plumbing, Electrical",
  description: "Experienced plumber and electrician with 8+ years serving Kathmandu valley. Certified in residential and commercial work. Fast, reliable, clean.",
  address: "Baneshwor, Kathmandu",
  profilePhoto: null,
  isAvailable: true,
  face_verified: true,
  skill_verified: true,
  rating: 4.7,
  totalReviews: 34,
  serviceAreas: ["Kathmandu","Lalitpur","Bhaktapur"],
  joinedAt: "2022-03-15T00:00:00Z",
  skills: [
    { name: "Plumbing", subSkills: [{ name: "Pipe Repair", price: 800 }, { name: "Drain Cleaning", price: 600 }] },
    { name: "Electrical", subSkills: [{ name: "Wiring & Rewiring", price: 1000 }, { name: "Lighting Installation", price: 700 }] },
  ],
  hours: {
    Monday:    [{ start: "09:00", end: "17:00" }],
    Tuesday:   [{ start: "09:00", end: "17:00" }],
    Wednesday: [{ start: "09:00", end: "17:00" }],
    Thursday:  [{ start: "09:00", end: "17:00" }],
    Friday:    [{ start: "09:00", end: "15:00" }],
    Saturday:  [],
    Sunday:    [],
  },
  minHours: 2,
  completedJobs: 67,
  createdAt: "2022-03-15T00:00:00Z",
};

const MOCK_TASKS = [
  { _id: "t1", selectedService: "Pipe Repair", taskType: "Plumbing", status: "paid", payment_status: "paid", final_price: 1600, serviceDate: "2024-11-10", customerName: "Anita K.", paid_at: "2024-11-10", payment_method: "esewa" },
  { _id: "t2", selectedService: "Drain Cleaning", taskType: "Plumbing", status: "worker_done", payment_status: "pending", final_price: 600, serviceDate: "2024-12-01", customerName: "Bikash M." },
  { _id: "t3", selectedService: "Lighting Installation", taskType: "Electrical", status: "in_progress", payment_status: "escrowed", final_price: 700, serviceDate: "2024-12-05", customerName: "Sita R." },
  { _id: "t4", selectedService: "Wiring & Rewiring", taskType: "Electrical", status: "assigned", payment_status: "escrowed", final_price: 1000, serviceDate: "2024-12-08", customerName: "Dev P." },
];

const MOCK_REVIEWS = [
  { _id: "r1", customerName: "Anita K.", rating: 5, comment: "Rajan was fantastic — arrived on time, fixed the pipe quickly and cleaned up after. Highly recommend!", createdAt: "2024-11-11", taskType: "Pipe Repair" },
  { _id: "r2", customerName: "Pooja S.", rating: 4, comment: "Good work overall. Communication was clear and the job was done well.", createdAt: "2024-10-22", taskType: "Drain Cleaning" },
  { _id: "r3", customerName: "Ramesh T.", rating: 5, comment: "Very professional. Will book again.", createdAt: "2024-09-18", taskType: "Lighting Installation" },
];

const MOCK_REPORTS = [];

/* ─── WORKER PROFILE ──────────────────────────────────────── */
export default function WorkerProfile() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const fileRef  = useRef();

  /* ── State ── */
  const [worker,          setWorker]          = useState(null);
  const [tasks,           setTasks]           = useState([]);
  const [reviews,         setReviews]         = useState([]);
  const [reports,         setReports]         = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);
  const [tab,             setTab]             = useState("info");
  const [toast,           setToast]           = useState(null);
  const [avatar,          setAvatar]          = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [editField,       setEditField]       = useState(null);
  const [fieldVal,        setFieldVal]        = useState("");
  const [fieldSaving,     setFieldSaving]     = useState(false);
  const [available,       setAvailable]       = useState(true);

  /* ── Load ── */
  useEffect(() => {
    const load = async () => {
      setLoading(true); setError(null);
      try {
        // REPLACE with real API calls:
        // const [wRes, tRes, revRes, repRes] = await Promise.all([getWorker(id), getWorkerTasks(id), getWorkerReviews(id), getWorkerReports(id)]);
        await new Promise(r => setTimeout(r, 400)); // simulated delay
        const w = MOCK_WORKER;
        setWorker(w);
        setAvailable(w.isAvailable ?? true);
        const photo = w.profilePhoto || w.avatar || w.profile_photo;
        if (photo) setAvatar(photo);
        setTasks(MOCK_TASKS);
        setReviews(MOCK_REVIEWS);
        setReports(MOCK_REPORTS);
      } catch (e) { setError(e.message || "Failed to load profile"); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const startEdit = (field, val) => { setEditField(field); setFieldVal(val || ""); };

  const saveField = async () => {
    setFieldSaving(true);
    try {
      // REPLACE with real API call e.g. await updateWorkerBio(id, fieldVal)
      await new Promise(r => setTimeout(r, 600));
      setWorker(p => {
        if (editField === "name") {
          const parts = fieldVal.trim().split(" ");
          return { ...p, firstName: parts[0] || "", lastName: parts.slice(1).join(" ") || "" };
        }
        return { ...p, [editField]: fieldVal };
      });
      setEditField(null);
      showToast("Changes saved.");
    } catch { showToast("Failed to save.", false); }
    finally { setFieldSaving(false); }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = ev => setAvatar(ev.target.result);
    r.readAsDataURL(file);
    setAvatarUploading(true);
    try {
      // REPLACE: await updateWorkerPhoto(id, file)
      await new Promise(r => setTimeout(r, 900));
      showToast("Photo updated.");
    } catch { showToast("Upload failed.", false); }
    finally { setAvatarUploading(false); }
  };

  const toggleAvailability = async (v) => {
    setAvailable(v);
    // REPLACE: await updateWorkerAvailability(id, v)
    showToast(v ? "You are now available for bookings." : "You are now set as unavailable.");
  };

  /* ── Derived ── */
  if (!worker && !loading && !error) return null;

  const firstName    = worker?.firstName  || worker?.first_name  || "";
  const lastName     = worker?.lastName   || worker?.last_name   || "";
  const fullName     = `${firstName} ${lastName}`.trim() || "—";
  const email        = worker?.email      || "";
  const phone        = worker?.phoneNo    || worker?.phone       || "";
  const bio          = worker?.description || worker?.bio        || "";
  const address      = worker?.address   || "";
  const joinedAt     = worker?.joinedAt   || worker?.createdAt   || "";
  const taskType     = worker?.taskType   || "";
  const serviceAreas = worker?.serviceAreas || [];
  const skills       = worker?.skills     || [];
  const hours        = worker?.hours;
  const minHours     = worker?.minHours   || 1;
  const initials     = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase() || "?";
  const rating       = worker?.rating     || 0;
  const faceVerified = worker?.face_verified;
  const skillVerified= worker?.skill_verified;

  const completedTasks = tasks.filter(t => ["completed","paid"].includes(t.status));
  const activeTasks    = tasks.filter(t => ["assigned","in_progress","worker_done"].includes(t.status));
  const paidTasks      = tasks.filter(t => t.payment_status === "paid" || t.status === "paid");
  const pendingPay     = tasks.filter(t => t.status === "worker_done" && t.payment_status !== "paid");
  const escrowTasks    = tasks.filter(t => ["assigned","in_progress","worker_done"].includes(t.status) && t.payment_status === "escrowed");
  const totalEarned    = paidTasks.reduce((s, t) => s + (t.final_price || t.totalCost || 0), 0);
  const totalPending   = pendingPay.reduce((s, t) => s + (t.final_price || t.totalCost || 0), 0);
  const totalEscrow    = escrowTasks.reduce((s, t) => s + (t.final_price || t.totalCost || 0), 0);
  const avgRating      = reviews.length
    ? (reviews.reduce((s, rv) => s + (rv.rating || rv.stars || 0), 0) / reviews.length).toFixed(1)
    : null;

  const TABS = [
    { key: "info",         label: "Profile Info"                       },
    { key: "skills",       label: "Skills & Rates"                     },
    { key: "availability", label: "Availability"                        },
    { key: "jobs",         label: "Jobs",       count: tasks.length     },
    { key: "reviews",      label: "Reviews",    count: reviews.length   },
    { key: "earnings",     label: "Earnings"                            },
  ];

  const infoRows = [
    { key: "name",    label: "Full Name",     value: fullName,              rawVal: fullName, editable: true  },
    { key: "email",   label: "Email Address", value: email || "—",          rawVal: email,    editable: false },
    { key: "phone",   label: "Phone Number",  value: phone || "Not added",  rawVal: phone,    editable: false },
    { key: "address", label: "Address",       value: address || "Not added",rawVal: address,  editable: true  },
    { key: "taskType",label: "Service Type",  value: taskType || "Not set", rawVal: taskType, editable: false },
    { key: "description", label: "Bio",       value: bio || "Not added",    rawVal: bio,      editable: true  },
  ];

  /* ── Loading / Error ── */
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "70vh", gap: 12, flexDirection: "column" }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${C.orangeBorder}`, borderTopColor: C.orange, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <div style={{ color: C.textLight, fontSize: "clamp(12px,1.2vw,13px)" }}>Loading profile…</div>
    </div>
  );

  if (error) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "70vh", gap: 12 }}>
      <div style={{ color: C.red, fontSize: "clamp(13px,1.3vw,14px)" }}>{error}</div>
      <button onClick={() => window.location.reload()} style={{ color: C.orangeDeep, background: C.orangeLight, border: `1.5px solid ${C.orangeBorder}`, borderRadius: 9, padding: "9px 20px", cursor: "pointer", fontSize: "clamp(12px,1.2vw,13px)", fontFamily: "inherit" }}>Retry</button>
    </div>
  );

  return (
    <>
      {/* <BookingNavbar /> */}
      <Toast toast={toast} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
        * { box-sizing: border-box; }
        .wp-root { font-family: 'DM Sans', -apple-system, sans-serif; }
        .wp-tab:hover  { background: ${C.orangeLight} !important; color: ${C.orangeDeep} !important; }
        .wp-photo:hover .wp-overlay { opacity: 1 !important; }
        .wp-edit:hover { background: ${C.orangeLight} !important; color: ${C.orangeDeep} !important; border-color: ${C.orange} !important; }
        .wp-row:hover  { background: ${C.orangeLight}66; }
        input:focus, textarea:focus, select:focus { border-color: ${C.orange} !important; box-shadow: 0 0 0 3px ${C.orange}22 !important; outline: none; }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideIn { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
        .wp-panel { animation: fadeIn 0.18s ease; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }

        /* ── Responsive layout ── */
        .wp-layout {
          max-width: min(1080px, 92vw);
          margin: 0 auto;
          display: flex;
          gap: clamp(12px,2vw,22px);
          align-items: flex-start;
        }
        .wp-sidebar {
          width: clamp(220px, 22vw, 292px);
          flex-shrink: 0;
        }
        .wp-main { flex: 1; min-width: 0; }

        /* On very small screens stack vertically */
        @media (max-width: 680px) {
          .wp-layout { flex-direction: column; }
          .wp-sidebar { width: 100%; }
        }

        /* Tab bar scroll on narrow screens */
        .wp-tabbar {
          display: flex;
          border-bottom: 1px solid ${C.border};
          padding: 0 6px;
          background: #fafaf9;
          gap: 2px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .wp-tabbar::-webkit-scrollbar { display: none; }

        /* Stat grid: 3-col on desktop, auto on small */
        .wp-stat-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
        }

        /* Earnings grid: 3-col on desktop */
        .wp-earn-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border-bottom: 1px solid ${C.border};
        }
        @media (max-width: 520px) {
          .wp-earn-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="wp-root" style={{ background: C.bg, minHeight: "100vh", padding: "clamp(16px,3vw,28px) clamp(12px,3vw,32px) 60px" }}>
        <div className="wp-layout">

          {/* ══════════════ SIDEBAR ══════════════ */}
          <div className="wp-sidebar">
            <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>

              {/* Banner */}
              <div style={{ height: "clamp(56px,7vw,76px)", background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)`, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, opacity: 0.1, backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
                {/* Availability pill */}
                <div style={{ position: "absolute", top: 10, right: 12 }}>
                  <span style={{ fontSize: "clamp(9px,1vw,10.5px)", fontWeight: 700, color: available ? C.green : C.textLight, background: available ? C.greenLight : C.divider, border: `1.5px solid ${available ? C.greenBorder : C.border}`, padding: "3px 10px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: available ? C.green : C.textLight, display: "inline-block" }} />
                    {available ? "Available" : "Unavailable"}
                  </span>
                </div>
              </div>

              {/* Avatar + identity */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 clamp(14px,2vw,20px) clamp(16px,2vw,22px)" }}>
                <div className="wp-photo" style={{ position: "relative", cursor: "pointer", marginTop: "clamp(-36px,-5vw,-48px)" }} onClick={() => fileRef.current.click()}>
                  <div style={{ width: "clamp(76px,9vw,96px)", height: "clamp(76px,9vw,96px)", borderRadius: "50%", background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "clamp(22px,3vw,30px)", fontWeight: 800, color: "white", overflow: "hidden", border: "3px solid white", boxShadow: `0 4px 20px ${C.orange}55` }}>
                    {avatar
                      ? <img src={avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : initials}
                  </div>
                  <div className="wp-overlay" style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,0.42)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.18s", border: "3px solid white" }}>
                    {avatarUploading
                      ? <div style={{ width: 18, height: 18, border: "2.5px solid white", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                      : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}
                  </div>
                </div>

                <div style={{ marginTop: 12, fontSize: "clamp(15px,1.8vw,17px)", fontWeight: 700, color: C.text, textAlign: "center", lineHeight: 1.3 }}>{fullName}</div>
                {taskType && <div style={{ fontSize: "clamp(11px,1.1vw,12.5px)", color: C.orange, fontWeight: 600, marginTop: 3, textAlign: "center" }}>{taskType}</div>}
                {email && <div style={{ fontSize: "clamp(11px,1.1vw,12.5px)", color: C.textLight, marginTop: 3, textAlign: "center" }}>{email}</div>}
                {joinedAt && <div style={{ fontSize: "clamp(10.5px,1vw,11.5px)", color: C.textLight, marginTop: 2 }}>Member since {fmtMonth(joinedAt)}</div>}

                {/* Verification badges */}
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", justifyContent: "center" }}>
                  {faceVerified && (
                    <span style={{ fontSize: "clamp(9.5px,1vw,10.5px)", fontWeight: 700, color: C.green, background: C.greenLight, border: `1px solid ${C.greenBorder}`, borderRadius: 10, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ID Verified
                    </span>
                  )}
                  {skillVerified && (
                    <span style={{ fontSize: "clamp(9.5px,1vw,10.5px)", fontWeight: 700, color: C.blue, background: C.blueLight, border: `1px solid ${C.blueBorder}`, borderRadius: 10, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Skill Verified
                    </span>
                  )}
                </div>

                {/* Rating */}
                {avgRating && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
                    <StarRating rating={parseFloat(avgRating)} size={14} />
                    <span style={{ fontSize: "clamp(12px,1.2vw,13px)", fontWeight: 700, color: C.orangeDeep }}>{avgRating}</span>
                    <span style={{ fontSize: "clamp(11px,1.1vw,12px)", color: C.textLight }}>({reviews.length})</span>
                  </div>
                )}

                <button onClick={() => fileRef.current.click()} disabled={avatarUploading}
                  style={{ marginTop: 14, padding: "7px 18px", borderRadius: 8, fontSize: "clamp(11px,1.1vw,12px)", fontWeight: 600, color: C.orangeDeep, background: C.orangeLight, border: `1.5px solid ${C.orangeBorder}`, cursor: avatarUploading ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  {avatarUploading ? "Uploading…" : "Change Photo"}
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
              </div>

              {/* Stats */}
              <div style={{ height: 1, background: C.divider }} />
              <div className="wp-stat-grid">
                {[
                  { label: "Jobs",     value: tasks.length,          color: C.orange     },
                  { label: "Done",     value: completedTasks.length, color: C.green      },
                  { label: "Reviews",  value: reviews.length,        color: C.orangeDark },
                ].map((s, i) => (
                  <div key={s.label} style={{ textAlign: "center", padding: "clamp(12px,1.5vw,16px) 0", borderRight: i < 2 ? `1px solid ${C.divider}` : "none" }}>
                    <div style={{ fontSize: "clamp(18px,2.5vw,22px)", fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: "clamp(9px,1vw,10px)", color: C.textLight, marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Quick info */}
              <div style={{ height: 1, background: C.divider }} />
              <div style={{ padding: "clamp(12px,1.5vw,16px) clamp(14px,2vw,20px)", display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { label: "Email",   value: email        || "—"         },
                  { label: "Phone",   value: phone        || "Not added"  },
                  { label: "Areas",   value: serviceAreas.slice(0,3).join(", ") || "Not added" },
                  { label: "Min. hrs",value: minHours ? `${minHours} hr${minHours > 1 ? "s" : ""}` : "1 hr" },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.orange, marginTop: 7, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "clamp(9.5px,1vw,10.5px)", fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>{row.label}</div>
                      <div style={{ fontSize: "clamp(12px,1.2vw,13px)", color: row.value === "Not added" || row.value === "—" ? C.textLight : C.text, fontStyle: row.value === "Not added" ? "italic" : "normal", wordBreak: "break-word", lineHeight: 1.5 }}>{row.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Availability toggle */}
              <div style={{ height: 1, background: C.divider }} />
              <div style={{ padding: "clamp(12px,1.5vw,16px) clamp(14px,2vw,20px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: "clamp(12px,1.2vw,13px)", fontWeight: 600, color: C.text }}>Available for bookings</div>
                  <div style={{ fontSize: "clamp(11px,1.1vw,12px)", color: C.textLight, marginTop: 2 }}>Toggle to pause new jobs</div>
                </div>
                <Toggle checked={available} onChange={toggleAvailability} />
              </div>
            </div>
          </div>

          {/* ══════════════ MAIN PANEL ══════════════ */}
          <div className="wp-main">
            <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", overflow: "hidden" }}>

              {/* Tab bar */}
              <div className="wp-tabbar">
                {TABS.map(t => (
                  <button key={t.key} className="wp-tab" onClick={() => setTab(t.key)} style={{
                    padding: "clamp(10px,1.5vw,14px) clamp(12px,1.8vw,18px)",
                    background: "none", border: "none",
                    borderBottom: `2.5px solid ${tab === t.key ? C.orange : "transparent"}`,
                    cursor: "pointer",
                    fontSize: "clamp(12px,1.3vw,13.5px)",
                    fontWeight: tab === t.key ? 700 : 500,
                    color: tab === t.key ? C.orangeDeep : C.textMid,
                    fontFamily: "inherit", whiteSpace: "nowrap",
                    display: "flex", alignItems: "center", gap: 7,
                    marginBottom: -1, borderRadius: "6px 6px 0 0",
                    transition: "color 0.15s, background 0.15s",
                  }}>
                    {t.label}
                    {t.count > 0 && (
                      <span style={{ fontSize: "clamp(9.5px,1vw,10.5px)", fontWeight: 700, minWidth: 18, height: 18, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: tab === t.key ? C.orange : C.border, color: tab === t.key ? "white" : C.textMid, padding: "0 5px" }}>{t.count}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* ─── PROFILE INFO ─── */}
              {tab === "info" && (
                <div className="wp-panel">
                  <div style={{ padding: "clamp(14px,2vw,20px) clamp(18px,2.5vw,28px) 12px", fontSize: "clamp(10px,1vw,11px)", fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.09em" }}>
                    Personal & Professional Information
                  </div>
                  {infoRows.map((row, i, arr) => (
                    <div key={row.key}>
                      <div className="wp-row" style={{ padding: "clamp(12px,1.5vw,15px) clamp(18px,2.5vw,28px)", display: "flex", alignItems: "center", gap: "clamp(10px,1.5vw,16px)", transition: "background 0.12s" }}>
                        <div style={{ width: "clamp(100px,12vw,136px)", flexShrink: 0, fontSize: "clamp(11.5px,1.2vw,12.5px)", fontWeight: 600, color: C.textLight }}>{row.label}</div>
                        <div style={{ flex: 1 }}>
                          {editField === row.key ? (
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              {row.key === "description" ? (
                                <textarea value={fieldVal} onChange={e => setFieldVal(e.target.value)} rows={3} autoFocus style={{ ...inputSx, flex: 1, resize: "vertical" }} />
                              ) : (
                                <input value={fieldVal} onChange={e => setFieldVal(e.target.value)} autoFocus style={{ ...inputSx, flex: 1 }} />
                              )}
                              <button onClick={saveField} disabled={fieldSaving}
                                style={{ padding: "9px 16px", borderRadius: 8, background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`, color: "white", border: "none", fontSize: "clamp(12px,1.2vw,13px)", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}>
                                {fieldSaving ? "…" : "Save"}
                              </button>
                              <button onClick={() => setEditField(null)}
                                style={{ width: 34, height: 34, borderRadius: 8, background: "none", border: `1.5px solid ${C.border}`, cursor: "pointer", color: C.textMid, fontSize: 16, fontFamily: "inherit" }}>✕</button>
                            </div>
                          ) : (
                            <span style={{ fontSize: "clamp(12.5px,1.3vw,13.5px)", color: (row.value === "Not added" || row.value === "—" || row.value === "Not set") ? C.textLight : C.text, fontStyle: row.value === "Not added" ? "italic" : "normal", display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              {row.value}
                              {row.key === "email" && email && (
                                <span style={{ fontSize: "clamp(9.5px,1vw,10px)", fontWeight: 700, color: C.green, background: C.greenLight, border: `1px solid ${C.greenBorder}`, borderRadius: 10, padding: "1px 7px" }}>Verified</span>
                              )}
                              {!row.editable && (
                                <span style={{ fontSize: "clamp(9.5px,1vw,10px)", color: C.textLight, background: C.divider, border: `1px solid ${C.border}`, borderRadius: 10, padding: "1px 7px", fontWeight: 500 }}>
                                  Cannot be changed
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        {row.editable && editField !== row.key && (
                          <button className="wp-edit" onClick={() => startEdit(row.key, row.rawVal)}
                            style={{ fontSize: "clamp(11px,1.1vw,12px)", color: C.textMid, background: "none", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "5px 14px", cursor: "pointer", fontFamily: "inherit", fontWeight: 500, transition: "all 0.15s", whiteSpace: "nowrap" }}>
                            {row.value === "Not added" ? "+ Add" : "Edit"}
                          </button>
                        )}
                      </div>
                      {i < arr.length - 1 && <div style={{ height: 1, background: C.divider, margin: `0 clamp(18px,2.5vw,28px)` }} />}
                    </div>
                  ))}

                  {/* Service areas */}
                  <div style={{ padding: "clamp(14px,2vw,18px) clamp(18px,2.5vw,28px)", borderTop: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: "clamp(10px,1vw,11px)", fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 12 }}>Service Areas</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {serviceAreas.length === 0
                        ? <span style={{ fontSize: "clamp(12px,1.2vw,13px)", color: C.textLight, fontStyle: "italic" }}>No areas set</span>
                        : serviceAreas.map(a => (
                          <span key={a} style={{ fontSize: "clamp(11.5px,1.2vw,12.5px)", fontWeight: 600, color: C.orangeDeep, background: C.orangeLight, border: `1px solid ${C.orangeBorder}`, padding: "4px 12px", borderRadius: 20 }}>{a}</span>
                        ))}
                    </div>
                  </div>
                  <div style={{ height: 14 }} />
                </div>
              )}

              {/* ─── SKILLS & RATES ─── */}
              {tab === "skills" && (
                <div className="wp-panel">
                  <div style={{ padding: "clamp(14px,2vw,20px) clamp(18px,2.5vw,28px) 12px", fontSize: "clamp(10px,1vw,11px)", fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.09em" }}>
                    Skills, Specialisations & Rates
                  </div>
                  {skills.length === 0 ? (
                    <EmptyState title="No skills listed" sub="Skills you add during registration will appear here." />
                  ) : skills.map((skill, i) => (
                    <div key={skill.name || i}>
                      {i > 0 && <div style={{ height: 1, background: C.divider, margin: `0 clamp(18px,2.5vw,28px)` }} />}
                      <div style={{ padding: "clamp(14px,2vw,18px) clamp(18px,2.5vw,28px)" }}>
                        <div style={{ fontSize: "clamp(13px,1.4vw,14px)", fontWeight: 700, color: C.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.orange, display: "inline-block", flexShrink: 0 }} />
                          {skill.name}
                        </div>
                        {(skill.subSkills || []).length === 0 ? (
                          <div style={{ fontSize: "clamp(12px,1.2vw,13px)", color: C.textLight, fontStyle: "italic", paddingLeft: 16 }}>No sub-skills listed</div>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 16 }}>
                            {(skill.subSkills || []).map(sub => (
                              <div key={sub.name} style={{ display: "flex", alignItems: "center", gap: 0, background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                                <span style={{ padding: "6px 12px", fontSize: "clamp(11.5px,1.2vw,12.5px)", fontWeight: 500, color: C.textMid, borderRight: `1px solid ${C.divider}` }}>{sub.name}</span>
                                <span style={{ padding: "6px 12px", fontSize: "clamp(11.5px,1.2vw,12.5px)", fontWeight: 700, color: C.orangeDeep, background: C.orangeLight }}>NPR {sub.price}/hr</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div style={{ height: 14 }} />
                </div>
              )}

              {/* ─── AVAILABILITY ─── */}
              {tab === "availability" && (
                <div className="wp-panel">
                  <div style={{ padding: "clamp(14px,2vw,20px) clamp(18px,2.5vw,28px) 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                    <div style={{ fontSize: "clamp(10px,1vw,11px)", fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.09em" }}>Weekly Schedule</div>
                    {minHours && (
                      <span style={{ fontSize: "clamp(11px,1.1vw,12px)", fontWeight: 600, color: C.orangeDeep, background: C.orangeLight, border: `1px solid ${C.orangeBorder}`, padding: "3px 12px", borderRadius: 20 }}>Min. {minHours} hr{minHours > 1 ? "s" : ""} per booking</span>
                    )}
                  </div>
                  <div style={{ padding: "0 clamp(18px,2.5vw,28px) clamp(16px,2vw,20px)" }}>
                    <AvailabilityGrid hours={hours} />
                  </div>
                </div>
              )}

              {/* ─── JOBS ─── */}
              {tab === "jobs" && (
                <div className="wp-panel">
                  {/* Summary strip */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderBottom: `1px solid ${C.border}` }}>
                    {[
                      { label: "Active Jobs",  value: activeTasks.length,           color: C.blue,       bg: "#f8fbff" },
                      { label: "Completed",    value: completedTasks.length,         color: C.green,      bg: "#f8fffe" },
                      { label: "Total Jobs",   value: tasks.length,                  color: C.orangeDeep, bg: C.orangeLight },
                    ].map((s, i) => (
                      <div key={s.label} style={{ padding: "clamp(14px,2vw,20px) clamp(16px,2vw,24px)", background: s.bg, borderRight: i < 2 ? `1px solid ${C.border}` : "none" }}>
                        <div style={{ fontSize: "clamp(10px,1vw,11px)", fontWeight: 600, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{s.label}</div>
                        <div style={{ fontSize: "clamp(18px,2.5vw,22px)", fontWeight: 800, color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Job list */}
                  <div style={{ padding: "clamp(12px,1.5vw,14px) clamp(18px,2.5vw,24px) clamp(10px,1.2vw,10px)", fontSize: "clamp(10px,1vw,11px)", fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.09em" }}>All Jobs</div>
                  {tasks.length === 0 ? (
                    <EmptyState title="No jobs yet" sub="Accepted bookings will appear here." />
                  ) : (
                    <div style={{ maxHeight: "clamp(340px,45vw,500px)", overflowY: "auto" }}>
                      {tasks.map((task, i) => {
                        const tid = task._id || task.id || i;
                        return (
                          <div key={tid} style={{ padding: "clamp(12px,1.5vw,16px) clamp(18px,2.5vw,24px)", borderTop: `1px solid ${C.divider}`, display: "flex", alignItems: "center", gap: "clamp(10px,1.5vw,14px)", flexWrap: "wrap" }} className="wp-row">
                            <div style={{ flex: 1, minWidth: "clamp(120px,15vw,180px)" }}>
                              <div style={{ fontSize: "clamp(13px,1.4vw,14px)", fontWeight: 600, color: C.text, marginBottom: 4 }}>{task.selectedService || task.taskType || "Service"}</div>
                              <div style={{ fontSize: "clamp(11px,1.1vw,12px)", color: C.textLight, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                <span>{fmtDate(task.serviceDate)}</span>
                                {task.customerName && <span style={{ background: C.divider, padding: "1px 8px", borderRadius: 10, fontWeight: 500 }}>{task.customerName}</span>}
                              </div>
                            </div>
                            <StatusBadge status={task.status} />
                            <div style={{ fontSize: "clamp(13px,1.4vw,14px)", fontWeight: 700, color: C.text, flexShrink: 0 }}>NPR {(task.final_price || task.totalCost || 0).toLocaleString()}</div>
                            {task.payment_status === "escrowed" && (
                              <span style={{ fontSize: "clamp(10px,1vw,11px)", fontWeight: 600, color: C.blue, background: C.blueLight, border: `1px solid ${C.blueBorder}`, padding: "3px 10px", borderRadius: 20 }}>In Escrow</span>
                            )}
                            {(task.payment_status === "paid" || task.status === "paid") && (
                              <span style={{ fontSize: "clamp(10px,1vw,11px)", fontWeight: 600, color: C.green, background: C.greenLight, border: `1px solid ${C.greenBorder}`, padding: "3px 10px", borderRadius: 20 }}>Paid</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ height: 16 }} />
                </div>
              )}

              {/* ─── REVIEWS ─── */}
              {tab === "reviews" && (
                <div className="wp-panel">
                  {reviews.length > 0 && avgRating && (
                    <div style={{ padding: "clamp(14px,2vw,20px) clamp(18px,2.5vw,28px)", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: "clamp(14px,2vw,20px)", background: C.orangeLight, flexWrap: "wrap" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "clamp(32px,5vw,40px)", fontWeight: 800, color: C.orange, lineHeight: 1 }}>{avgRating}</div>
                        <div style={{ fontSize: "clamp(9.5px,1vw,10.5px)", color: C.textLight, marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>avg rating</div>
                      </div>
                      <div style={{ width: 1, height: 44, background: C.orangeBorder }} />
                      <div>
                        <StarRating rating={parseFloat(avgRating)} size={18} />
                        <div style={{ fontSize: "clamp(12.5px,1.3vw,13.5px)", color: C.textMid, lineHeight: 1.8, marginTop: 4 }}>
                          Based on <strong style={{ color: C.text }}>{reviews.length} review{reviews.length > 1 ? "s" : ""}</strong> from verified customers.
                        </div>
                      </div>
                    </div>
                  )}
                  {reviews.length === 0 ? (
                    <EmptyState title="No reviews yet" sub="Reviews from customers will appear here after completed jobs." />
                  ) : reviews.map((rev, i) => {
                    const rid    = rev._id || rev.id || i;
                    const rating = rev.rating || rev.stars || 0;
                    return (
                      <div key={rid}>
                        {i > 0 && <div style={{ height: 1, background: C.divider, margin: `0 clamp(18px,2.5vw,28px)` }} />}
                        <div className="wp-row" style={{ padding: "clamp(14px,2vw,18px) clamp(18px,2.5vw,28px)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                            <div>
                              <div style={{ fontSize: "clamp(13px,1.4vw,14px)", fontWeight: 700, color: C.text, marginBottom: 3 }}>{rev.customerName || "Customer"} · {rev.taskType || ""}</div>
                              <div style={{ fontSize: "clamp(11px,1.1vw,12px)", color: C.textLight }}>{fmtDate(rev.createdAt)}</div>
                            </div>
                            <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                              <StarRating rating={rating} size={17} />
                              <span style={{ marginLeft: 6, fontSize: "clamp(11.5px,1.2vw,12.5px)", fontWeight: 700, color: C.orangeDeep }}>{rating}/5</span>
                            </div>
                          </div>
                          {rev.comment && <p style={{ margin: 0, fontSize: "clamp(12.5px,1.3vw,13.5px)", color: C.textMid, lineHeight: 1.75 }}>{rev.comment}</p>}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ height: 12 }} />
                </div>
              )}

              {/* ─── EARNINGS ─── */}
              {tab === "earnings" && (
                <div className="wp-panel">
                  <div className="wp-earn-grid">
                    {[
                      { label: "Total Earned",   value: `NPR ${totalEarned.toLocaleString()}`,  color: C.green,      bg: "#f8fffe" },
                      { label: "Awaiting Release",value: `NPR ${totalPending.toLocaleString()}`, color: C.orangeDeep, bg: C.orangeLight },
                      { label: "In Escrow",       value: `NPR ${totalEscrow.toLocaleString()}`,  color: C.blue,       bg: "#f8fbff" },
                    ].map((s, i, arr) => (
                      <div key={s.label} style={{ padding: "clamp(14px,2vw,20px) clamp(16px,2vw,24px)", background: s.bg, borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <div style={{ fontSize: "clamp(10px,1vw,11px)", fontWeight: 600, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{s.label}</div>
                        <div style={{ fontSize: "clamp(18px,2.5vw,22px)", fontWeight: 800, color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Escrow notice */}
                  {escrowTasks.length > 0 && (
                    <div style={{ borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ padding: "clamp(12px,1.5vw,14px) clamp(18px,2.5vw,24px) 10px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ fontSize: "clamp(10px,1vw,11px)", fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.09em" }}>Active Escrow</div>
                        <span style={{ fontSize: "clamp(10px,1vw,11px)", fontWeight: 600, color: C.blue, background: C.blueLight, border: `1px solid ${C.blueBorder}`, padding: "3px 10px", borderRadius: 20 }}>NPR {totalEscrow.toLocaleString()} held</span>
                      </div>
                      {escrowTasks.map((task, i) => {
                        const tid = task._id || task.id || i;
                        return (
                          <div key={tid} style={{ padding: "clamp(12px,1.5vw,14px) clamp(18px,2.5vw,24px)", borderTop: i > 0 ? `1px solid ${C.divider}` : "none", display: "flex", alignItems: "center", gap: "clamp(10px,1.5vw,14px)", flexWrap: "wrap" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: "clamp(13px,1.4vw,14px)", fontWeight: 600, color: C.text, marginBottom: 3 }}>{task.selectedService || task.taskType || "Service"}</div>
                              <div style={{ fontSize: "clamp(11px,1.1vw,12px)", color: C.textLight }}>{task.customerName || "Customer"} · {fmtDate(task.serviceDate)}</div>
                            </div>
                            <StatusBadge status={task.status} />
                            <div style={{ fontSize: "clamp(13px,1.4vw,14px)", fontWeight: 700, color: C.text }}>NPR {(task.final_price || task.totalCost || 0).toLocaleString()}</div>
                          </div>
                        );
                      })}
                      <div style={{ padding: "clamp(10px,1.2vw,12px) clamp(18px,2.5vw,24px)", background: "#fffbeb", borderTop: `1px solid #fde68a` }}>
                        <div style={{ fontSize: "clamp(11.5px,1.2vw,12.5px)", color: "#92400e", lineHeight: 1.65 }}>Escrow funds are released to you when the customer confirms they are satisfied with your work.</div>
                      </div>
                    </div>
                  )}

                  {/* Payment history */}
                  <div style={{ padding: "clamp(12px,1.5vw,14px) clamp(18px,2.5vw,24px) 10px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ fontSize: "clamp(10px,1vw,11px)", fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.09em" }}>Payment History</div>
                    {paidTasks.length > 0 && (
                      <span style={{ fontSize: "clamp(10px,1vw,11px)", fontWeight: 600, color: C.green, background: C.greenLight, border: `1px solid ${C.greenBorder}`, padding: "3px 10px", borderRadius: 20 }}>{paidTasks.length} payment{paidTasks.length > 1 ? "s" : ""}</span>
                    )}
                  </div>
                  <div style={{ maxHeight: "clamp(280px,35vw,400px)", overflowY: "auto", borderTop: `1px solid ${C.divider}` }}>
                    {paidTasks.length === 0 ? (
                      <EmptyState title="No payments yet" sub="Payments released from escrow will appear here." />
                    ) : paidTasks.map((task, i) => {
                      const tid = task._id || task.id || i;
                      return (
                        <div key={tid} style={{ padding: "clamp(12px,1.5vw,14px) clamp(18px,2.5vw,24px)", borderBottom: `1px solid ${C.divider}`, display: "flex", alignItems: "center", gap: "clamp(10px,1.5vw,14px)", flexWrap: "wrap" }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: "clamp(120px,15vw,180px)" }}>
                            <div style={{ fontSize: "clamp(13px,1.4vw,14px)", fontWeight: 600, color: C.text, marginBottom: 4 }}>{task.selectedService || task.taskType || "Service"}</div>
                            <div style={{ fontSize: "clamp(11px,1.1vw,12px)", color: C.textLight, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                              <span>{fmtDate(task.paid_at || task.updatedAt)}</span>
                              {task.payment_method && <span style={{ textTransform: "capitalize", background: C.divider, padding: "1px 8px", borderRadius: 10, fontWeight: 500 }}>{task.payment_method}</span>}
                              {task.customerName && <span style={{ background: C.divider, padding: "1px 8px", borderRadius: 10, fontWeight: 500 }}>{task.customerName}</span>}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: "clamp(13px,1.4vw,14px)", fontWeight: 700, color: C.text }}>NPR {(task.final_price || task.totalCost || 0).toLocaleString()}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ height: 16 }} />
                </div>
              )}

            </div>
          </div>
          {/* END MAIN */}

        </div>
      </div>
    </>
  );
}