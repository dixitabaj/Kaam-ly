import React, { useState, useEffect, useRef } from "react";
import BookingNavbar from "../components/Navbar/Navbar";
import {
  getAvailability,
  updateDayHours,
  toggleAvailability,
} from "../api/api";

const T = {
  orange:       "#f6ad56",
  orangeDark:   "#e8943a",
  orangeLight:  "#fff8f0",
  orangeBorder: "#fde8c8",
  text:         "#1a1512",
  textMid:      "#6b6460",
  textLight:    "#b0a99f",
  border:       "#ebe8e2",
  bg:           "#faf9f7",
  white:        "#ffffff",
  red:          "#ef4444",
  redLight:     "#fef2f2",
  green:        "#22c55e",
  greenLight:   "#f0fdf4",
};

const FontLink = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; }
    .hour-row { transition: background 0.1s; cursor: pointer; }
    .hour-row:hover { background: ${T.orangeLight} !important; }
    .slot-block { transition: opacity 0.15s; cursor: pointer; }
    .slot-block:hover { opacity: 0.82; }
    .day-col { transition: background 0.12s; }
    .day-col:hover { background: ${T.orangeLight}; }
    .day-num { transition: background 0.15s, color 0.15s; }
    .day-num:hover { background: ${T.orangeBorder} !important; }
    .summary-card { transition: all 0.15s; cursor: pointer; }
    .summary-card:hover { transform: translateY(-2px); box-shadow: 0 4px 14px rgba(246,173,86,0.18); }
    .nav-btn { transition: all 0.12s; }
    .nav-btn:hover { border-color: ${T.orange} !important; color: ${T.orange} !important; }
    .status-btn { transition: all 0.2s; }
    .status-btn:hover { box-shadow: 0 3px 10px rgba(246,173,86,0.25); }
    .toggle-track { position:relative; width:38px; height:21px; border-radius:99px; cursor:pointer; transition:background 0.2s; flex-shrink:0; }
    .toggle-thumb { position:absolute; top:2.5px; left:2.5px; width:16px; height:16px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,0.2); transition:transform 0.2s; }
    .toggle-on .toggle-thumb { transform:translateX(17px); }
    @keyframes slideUp {
      from { transform: translateY(24px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    @keyframes slideDown {
      from { transform: translateY(0);    opacity: 1; }
      to   { transform: translateY(24px); opacity: 0; }
    }
    @keyframes toastIn {
      from { transform: translateX(110%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    @keyframes toastOut {
      from { transform: translateX(0);    opacity: 1; }
      to   { transform: translateX(110%); opacity: 0; }
    }
    .modal-sheet { animation: slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1); }
    .toast-in  { animation: toastIn  0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; }
    .toast-out { animation: toastOut 0.3s  ease-in forwards; }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-thumb { background: ${T.orangeBorder}; border-radius: 2px; }
  `}</style>
);

const DAYS      = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const HOURS     = Array.from({ length: 14 }, (_, i) => i + 7);
const DAY_NAMES = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const DAY_CAPS  = {
  sunday:"Sunday", monday:"Monday", tuesday:"Tuesday",
  wednesday:"Wednesday", thursday:"Thursday", friday:"Friday", saturday:"Saturday",
};
const HOUR_H = 60;

function fmt12(h, m = 0) {
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
}
function toMins(str) {
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}
function toOffset(str) {
  const [h, m] = str.split(":").map(Number);
  return h + m / 60 - 7;
}
function padTime(t) {
  const [h, m] = t.split(":").map(Number);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

function overlaps(slots) {
  const active = slots.map((s, i) => ({ ...s, i })).filter(s => s.enabled);
  const bad = new Set();
  for (let a = 0; a < active.length; a++) {
    for (let b = a + 1; b < active.length; b++) {
      if (toMins(active[a].start) < toMins(active[b].end) &&
          toMins(active[b].start) < toMins(active[a].end)) {
        bad.add(active[a].i); bad.add(active[b].i);
      }
    }
  }
  return bad;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  const isOff = toast.type === "unavailable";
  const bg    = isOff ? "#1a1512" : T.white;
  const color = isOff ? "#fff"    : T.text;
  const icon  = isOff ? "🔴" : "🟢";
  return (
    <div className={toast.exiting ? "toast-out" : "toast-in"}
      style={{
        position:     "fixed",
        bottom:       28,
        right:        24,
        zIndex:       2000,
        background:   bg,
        color:        color,
        borderRadius: 14,
        padding:      "14px 18px",
        minWidth:     280,
        maxWidth:     340,
        boxShadow:    "0 8px 32px rgba(0,0,0,0.18)",
        display:      "flex",
        alignItems:   "flex-start",
        gap:          12,
        fontFamily:   "'DM Sans', sans-serif",
        border:       `1px solid ${isOff ? "#333" : T.border}`,
      }}>
      <span style={{ fontSize: "1.1rem", marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: 3 }}>
          {isOff ? "You're now unavailable" : "You're now available"}
        </div>
        <div style={{ fontSize: "0.78rem", opacity: 0.72, lineHeight: 1.45 }}>
          {isOff
            ? "Clients won't be able to book you. Your schedule is saved and will be restored when you turn availability back on."
            : "Your previous schedule has been restored. Clients can now book you again."}
        </div>
      </div>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <div className={`toggle-track ${on ? "toggle-on" : ""}`}
      style={{ background: on ? T.orange : T.border }}
      onClick={e => { e.stopPropagation(); onChange(!on); }}>
      <div className="toggle-thumb" />
    </div>
  );
}

// ── Time Picker ───────────────────────────────────────────────────────────────
function TimePicker({ value, onChange }) {
  const [h, m] = value.split(":").map(Number);
  const isPM = h >= 12;
  const dH   = h % 12 === 0 ? 12 : h % 12;
  const emit = (newH, newM, pm) => {
    const actual = pm ? (newH === 12 ? 12 : newH + 12) : (newH === 12 ? 0 : newH);
    onChange(`${String(actual).padStart(2,"0")}:${String(newM).padStart(2,"0")}`);
  };
  const sel = { padding:"7px 3px", border:"none", background:"transparent", fontSize:"0.88rem", fontWeight:600, color:T.text, cursor:"pointer", outline:"none", fontFamily:"'DM Sans', sans-serif" };
  return (
    <div style={{ display:"flex", alignItems:"center", gap:2, background:T.bg, borderRadius:8, padding:"0 6px", border:`1px solid ${T.border}` }}>
      <select value={dH} onChange={e => emit(+e.target.value, m, isPM)} style={sel}>
        {[1,2,3,4,5,6,7,8,9,10,11,12].map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      <span style={{ color:T.textLight, fontWeight:700, fontSize:"0.8rem" }}>:</span>
      <select value={m} onChange={e => emit(dH, +e.target.value, isPM)} style={sel}>
        {[0,15,30,45].map(v => <option key={v} value={v}>{String(v).padStart(2,"0")}</option>)}
      </select>
      <select value={isPM ? "PM" : "AM"} onChange={e => emit(dH, m, e.target.value === "PM")} style={sel}>
        <option>AM</option><option>PM</option>
      </select>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ day, daySlots, onSave, onDelete, onClose }) {
  const [slots, setSlots] = useState(
    daySlots?.length ? daySlots : [{ start:"09:00", end:"17:00", enabled:true }]
  );
  const [error, setError] = useState("");
  const bad = overlaps(slots);

  const update = (i, field, val) => {
    const next = [...slots]; next[i] = { ...next[i], [field]: val };
    setSlots(next); setError("");
  };

  const addSlot = () => {
    const last = [...slots].filter(s => s.enabled).sort((a,b) => toMins(b.end) - toMins(a.end))[0];
    let start = "09:00", end = "10:00";
    if (last) {
      const s = toMins(last.end) + 30, e = s + 60;
      if (s < 1200 && e <= 1200) {
        start = `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
        end   = `${String(Math.floor(e/60)).padStart(2,"0")}:${String(e%60).padStart(2,"0")}`;
      }
    }
    setSlots([...slots, { start, end, enabled:true }]);
  };

  const save = () => {
    if (bad.size > 0) { setError("Fix overlapping slots first."); return; }
    for (let i = 0; i < slots.length; i++) {
      if (slots[i].enabled && toMins(slots[i].end) <= toMins(slots[i].start)) {
        setError(`Slot ${i+1}: end time must be after start time.`); return;
      }
    }
    onSave(slots.filter(s => s.enabled).sort((a,b) => toMins(a.start) - toMins(b.start)));
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(26,21,18,0.45)", backdropFilter:"blur(3px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:"1rem" }}
      onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}
        style={{ background:T.white, borderRadius:20, padding:"1.5rem", width:"100%", maxWidth:420, maxHeight:"80vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.18)" }}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.25rem" }}>
          <div>
            <div style={{ fontWeight:700, fontSize:"1.05rem", color:T.text, fontFamily:"'DM Serif Display', serif" }}>Edit Availability</div>
            <div style={{ fontSize:"0.78rem", color:T.textLight, textTransform:"capitalize", marginTop:2 }}>{day}</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {daySlots?.length > 0 && (
              <button onClick={onDelete} style={{ background:"none", border:"none", color:T.red, fontSize:"0.78rem", cursor:"pointer", fontWeight:600, padding:"4px 0" }}>Clear day</button>
            )}
            <button onClick={onClose} style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:T.textMid, fontSize:"1rem", lineHeight:1 }}>×</button>
          </div>
        </div>

        {error && (
          <div style={{ fontSize:"0.78rem", color:T.red, marginBottom:"0.75rem", fontWeight:500, background:T.redLight, padding:"8px 12px", borderRadius:8 }}>⚠ {error}</div>
        )}

        {slots.map((slot, i) => (
          <div key={i} style={{ marginBottom:"0.75rem", padding:"0.85rem", background:bad.has(i)?T.redLight:T.bg, borderRadius:12, border:`1px solid ${bad.has(i)?"#fca5a5":T.border}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.65rem" }}>
              <span style={{ fontSize:"0.75rem", color:T.textLight, fontWeight:600, letterSpacing:"0.04em", textTransform:"uppercase" }}>
                Slot {i+1} {bad.has(i) && <span style={{ color:T.red }}>· overlaps</span>}
              </span>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <Toggle on={slot.enabled} onChange={v => update(i,"enabled",v)} />
                {slots.length > 1 && (
                  <button onClick={() => setSlots(slots.filter((_,idx) => idx!==i))}
                    style={{ background:"none", border:"none", color:T.textLight, fontSize:"1.1rem", cursor:"pointer", lineHeight:1, padding:"0 2px" }}>×</button>
                )}
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, opacity:slot.enabled?1:0.35, pointerEvents:slot.enabled?"auto":"none" }}>
              <TimePicker value={slot.start} onChange={v => update(i,"start",v)} />
              <span style={{ color:T.textLight, fontSize:"0.8rem", fontWeight:500 }}>–</span>
              <TimePicker value={slot.end} onChange={v => update(i,"end",v)} />
            </div>
          </div>
        ))}

        <button onClick={addSlot}
          style={{ width:"100%", padding:"0.65rem", background:"none", border:`1.5px dashed ${T.orange}`, borderRadius:10, color:T.orange, fontWeight:700, fontSize:"0.85rem", cursor:"pointer", marginBottom:"1rem", fontFamily:"'DM Sans', sans-serif", transition:"background 0.12s" }}
          onMouseEnter={e => e.currentTarget.style.background=T.orangeLight}
          onMouseLeave={e => e.currentTarget.style.background="none"}>
          + Add time slot
        </button>

        <button onClick={save}
          style={{ width:"100%", padding:"0.85rem", background:bad.size>0?T.border:`linear-gradient(135deg,${T.orange},${T.orangeDark})`, color:bad.size>0?T.textLight:"#fff", border:"none", borderRadius:12, fontWeight:700, fontSize:"0.95rem", cursor:bad.size>0?"not-allowed":"pointer", marginBottom:"0.5rem", fontFamily:"'DM Sans', sans-serif", boxShadow:bad.size>0?"none":"0 4px 14px rgba(246,173,86,0.35)" }}>
          Save availability
        </button>

        <button onClick={onClose}
          style={{ width:"100%", padding:"0.6rem", background:"none", border:"none", color:T.textLight, fontSize:"0.85rem", cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Status Pill ───────────────────────────────────────────────────────────────
function StatusPill({ active, onToggle }) {
  return (
    <button className="status-btn" onClick={onToggle}
      style={{ display:"flex", alignItems:"center", gap:7, padding:"7px 14px", borderRadius:30, border:`1.5px solid ${active?T.orange:T.border}`, background:active?T.orangeLight:T.bg, cursor:"pointer", marginLeft:12, fontFamily:"'DM Sans', sans-serif" }}>
      <div style={{ width:9, height:9, borderRadius:"50%", background:active?T.orange:T.textLight, transition:"background 0.2s" }} />
      <span style={{ fontWeight:600, fontSize:"0.82rem", color:active?T.orangeDark:T.textMid }}>
        {active ? "Available" : "Unavailable"}
      </span>
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CalendarAvailability() {
  const userString = localStorage.getItem("user") || sessionStorage.getItem("user");
  const workerIdFromStorage = userString
    ? (() => { try { const p = JSON.parse(userString); return p?.id || p?.email; } catch { return null; } })()
    : null;
  const workerIdFromUrl = window.location.pathname.split("/").filter(Boolean).pop();
  const workerId = workerIdFromStorage || workerIdFromUrl || null;

  const today = new Date();
  const [weekOffset,         setWeekOffset]         = useState(0);
  const [availability,       setAvailability]       = useState({});
  const [globalAvailability, setGlobalAvailability] = useState(true);
  const [loading,            setLoading]            = useState(true);
  const [saving,             setSaving]             = useState(false);
  const [modal,              setModal]              = useState(null);
  const [toast,              setToast]              = useState(null);

  // ✅ Ref to preserve the schedule when going unavailable.
  // We never wipe availability state — the schedule stays in memory and in DB.
  // The calendar just visually dims and blocks interaction via pointer-events.
  const toastTimerRef = useRef(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay() + i + weekOffset * 7);
    return d;
  });

  function parseDay(value) {
    if (Array.isArray(value)) {
      return value
        .filter(s => s && s.start && s.end)
        .map(s => ({ enabled: true, start: padTime(s.start), end: padTime(s.end) }));
    }
    if (typeof value === "string" && value.includes("-")) {
      const [startRaw = "0:0", endRaw = "0:0"] = value.split("-");
      const [sh=0, sm=0] = startRaw.split(":").map(Number);
      const [eh=0, em=0] = endRaw.split(":").map(Number);
      if (sh===0 && sm===0 && eh===0 && em===0) return [];
      return [{ enabled: true, start: padTime(startRaw), end: padTime(endRaw) }];
    }
    return [];
  }

  useEffect(() => {
    if (!workerId) { setLoading(false); return; }
    getAvailability(workerId)
      .then(data => {
        if (!data) return;
        if (data.hours && typeof data.hours === "object") {
          const parsed = {};
          for (const [key, value] of Object.entries(data.hours)) {
            const slots = parseDay(value);
            if (slots.length > 0) parsed[key.toLowerCase()] = slots;
          }
          setAvailability(parsed);
        }
        if (typeof data.isAvailable === "boolean") {
          setGlobalAvailability(data.isAvailable);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [workerId]);

  // ── Show toast helper ─────────────────────────────────────────────────────
  const showToast = (type) => {
    // Clear any existing timer
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

    setToast({ type, exiting: false });

    // Start exit animation after 3.5s, remove after 3.8s
    toastTimerRef.current = setTimeout(() => {
      setToast(prev => prev ? { ...prev, exiting: true } : null);
      setTimeout(() => setToast(null), 300);
    }, 3500);
  };

  // ── Toggle global availability ────────────────────────────────────────────
  // ✅ KEY CHANGE: We do NOT touch `availability` state at all here.
  // The schedule is preserved in state AND in DB regardless of this toggle.
  // Going "unavailable" only changes the isAvailable flag — not the hours.
  // When you come back online, your full schedule is already there.
  const toggleGlobal = async () => {
    const next = !globalAvailability;
    setGlobalAvailability(next);
    showToast(next ? "available" : "unavailable");
    setSaving(true);
    try {
      await toggleAvailability(workerId, next);
    } catch(e) {
      console.error("Toggle failed:", e);
      // Revert on failure
      setGlobalAvailability(!next);
      setToast(null);
    } finally {
      setSaving(false);
    }
  };

  const save = async (dayName, slots) => {
    setSaving(true);
    setAvailability(prev => ({ ...prev, [dayName]: slots }));
    try {
      await updateDayHours(
        workerId,
        DAY_CAPS[dayName],
        slots.map(({ start, end }) => ({ start, end })),
      );
    } catch(e) { console.error("Save failed:", e); }
    finally { setSaving(false); setModal(null); }
  };

  const clearDay = async (dayName) => {
    setSaving(true);
    setAvailability(prev => { const n={...prev}; delete n[dayName]; return n; });
    try {
      await updateDayHours(workerId, DAY_CAPS[dayName], []);
    } catch(e) { console.error("Clear failed:", e); }
    finally { setSaving(false); setModal(null); }
  };

  if (loading) return (
    <div style={{ padding:60, fontFamily:"'DM Sans', sans-serif", color:T.textLight, textAlign:"center" }}>Loading…</div>
  );

  return (
    <>
      <FontLink />
      <BookingNavbar />

      {/* ✅ Toast notification — renders outside main layout, bottom-right */}
      <Toast toast={toast} />

      <div style={{ minHeight:"calc(100vh - 64px)", background:T.bg, fontFamily:"'DM Sans', sans-serif" }}>
        <main style={{ padding:"2rem 2rem 3rem", maxWidth:1120, margin:"0 auto" }}>

          {/* Header */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.75rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              <h1 style={{ fontFamily:"'DM Serif Display', serif", fontSize:"1.8rem", color:T.text, margin:0, letterSpacing:"-0.5px" }}>Availability</h1>
              <StatusPill active={globalAvailability} onToggle={toggleGlobal} />
            </div>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              {saving && <span style={{ fontSize:"0.72rem", color:T.orange, fontWeight:600 }}>Saving…</span>}
              <button className="nav-btn" onClick={() => setWeekOffset(w => w-1)}
                style={{ background:T.white, border:`1px solid ${T.border}`, borderRadius:8, padding:"6px 13px", cursor:"pointer", fontSize:"0.82rem", color:T.textMid, fontFamily:"'DM Sans', sans-serif" }}>← Prev</button>
              <button className="nav-btn" onClick={() => setWeekOffset(0)}
                style={{ background:weekOffset===0?T.orange:T.white, color:weekOffset===0?"#fff":T.textMid, border:`1px solid ${weekOffset===0?T.orange:T.border}`, borderRadius:8, padding:"6px 13px", cursor:"pointer", fontSize:"0.82rem", fontWeight:600, fontFamily:"'DM Sans', sans-serif" }}>This Week</button>
              <button className="nav-btn" onClick={() => setWeekOffset(w => w+1)}
                style={{ background:T.white, border:`1px solid ${T.border}`, borderRadius:8, padding:"6px 13px", cursor:"pointer", fontSize:"0.82rem", color:T.textMid, fontFamily:"'DM Sans', sans-serif" }}>Next →</button>
            </div>
          </div>

          {/* ✅ Unavailable banner — shown below header when off */}
          {!globalAvailability && (
            <div style={{
              display:      "flex",
              alignItems:   "center",
              gap:          10,
              background:   "#1a1512",
              color:        "#fff",
              borderRadius: 12,
              padding:      "12px 18px",
              marginBottom: "1.25rem",
              fontSize:     "0.85rem",
              fontWeight:   500,
            }}>
              <span style={{ fontSize:"1rem" }}>🔴</span>
              <span>You're currently <strong>unavailable</strong>. Clients cannot book you. Your schedule is saved — toggle available to restore it.</span>
            </div>
          )}

          {/* Calendar grid */}
          <div style={{
            background:     T.white,
            border:         `1px solid ${T.border}`,
            borderRadius:   16,
            overflow:       "hidden",
            boxShadow:      "0 2px 12px rgba(0,0,0,0.05)",
            // ✅ When unavailable: dim the calendar but keep schedule visible
            // pointer-events blocked so user can't edit while unavailable
            opacity:        globalAvailability ? 1 : 0.45,
            pointerEvents:  globalAvailability ? "auto" : "none",
            transition:     "opacity 0.25s",
            position:       "relative",
          }}>

            {/* Day headers */}
            <div style={{ display:"flex", borderBottom:`1px solid ${T.border}` }}>
              <div style={{ width:52, flexShrink:0 }} />
              {weekDays.map((date, i) => {
                const dayName  = DAY_NAMES[date.getDay()];
                const isToday  = date.toDateString() === today.toDateString();
                const hasSlots = (availability[dayName]||[]).some(s => s.enabled);
                return (
                  <div key={i} className="day-col" style={{ flex:1, textAlign:"center", padding:"0.8rem 0.25rem", borderLeft:`1px solid ${T.border}` }}>
                    <div style={{ fontSize:"0.65rem", color:T.textLight, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:600 }}>{DAYS[date.getDay()]}</div>
                    <div className="day-num" onClick={() => setModal({ dayName, daySlots:availability[dayName]||[] })}
                      style={{ width:32, height:32, borderRadius:"50%", background:isToday?T.orange:"transparent", color:isToday?"#fff":T.text, display:"flex", alignItems:"center", justifyContent:"center", margin:"4px auto 0", fontWeight:isToday?700:500, fontSize:"0.87rem", cursor:"pointer", position:"relative" }}>
                      {date.getDate()}
                      {hasSlots && <span style={{ position:"absolute", bottom:1, width:4, height:4, borderRadius:"50%", background:isToday?"#fff":T.orange }} />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Hour grid */}
            <div style={{ display:"flex", overflowY:"auto", maxHeight:420 }}>
              <div style={{ width:52, flexShrink:0 }}>
                {HOURS.map(h => (
                  <div key={h} style={{ height:HOUR_H, display:"flex", alignItems:"flex-start", paddingTop:6, paddingRight:8, justifyContent:"flex-end", fontSize:"0.63rem", color:T.textLight, userSelect:"none" }}>
                    {h%12===0?12:h%12}{h>=12?"p":"a"}
                  </div>
                ))}
              </div>
              {weekDays.map((date, i) => {
                const dayName = DAY_NAMES[date.getDay()];
                const slots   = (availability[dayName]||[]).filter(s => s.enabled);
                return (
                  <div key={i} style={{ flex:1, position:"relative", borderLeft:`1px solid ${T.border}` }}>
                    {HOURS.map(h => (
                      <div key={h} className="hour-row" style={{ height:HOUR_H, borderTop:`1px solid ${T.border}` }}
                        onClick={() => setModal({ dayName, daySlots:availability[dayName]||[] })} />
                    ))}
                    {slots.map((slot, si) => (
                      <div key={si} className="slot-block"
                        onClick={() => setModal({ dayName, daySlots:availability[dayName]||[] })}
                        style={{ position:"absolute", top:toOffset(slot.start)*HOUR_H, left:3, right:3, height:Math.max((toOffset(slot.end)-toOffset(slot.start))*HOUR_H,24), background:`linear-gradient(160deg,${T.orange}dd,${T.orangeDark}dd)`, borderRadius:8, padding:"5px 7px", zIndex:2, border:`1px solid ${T.orange}`, boxShadow:"0 2px 8px rgba(246,173,86,0.25)" }}>
                        <div style={{ fontSize:"0.6rem", color:"#fff", fontWeight:700 }}>{fmt12(...slot.start.split(":").map(Number))}</div>
                        <div style={{ fontSize:"0.56rem", color:"rgba(255,255,255,0.8)" }}>{fmt12(...slot.end.split(":").map(Number))}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary cards */}
          <div style={{ display:"flex", gap:"0.5rem", marginTop:"1rem", flexWrap:"wrap" }}>
            {DAY_NAMES.map(day => {
              const slots   = (availability[day]||[]).filter(s => s.enabled);
              const hasData = (availability[day]||[]).length > 0;
              return (
                <div key={day} className="summary-card"
                  onClick={() => globalAvailability && setModal({ dayName:day, daySlots:availability[day]||[] })}
                  style={{ flex:1, minWidth:100, background:slots.length?T.orangeLight:T.white, border:`1px solid ${slots.length?T.orangeBorder:T.border}`, borderRadius:12, padding:"0.75rem", opacity:globalAvailability?1:0.5, cursor:globalAvailability?"pointer":"default", transition:"opacity 0.25s" }}>
                  <div style={{ fontSize:"0.65rem", color:T.textLight, textTransform:"capitalize", marginBottom:5, fontWeight:600, letterSpacing:"0.04em" }}>{day.slice(0,3).toUpperCase()}</div>
                  {slots.length > 0 ? (
                    <>
                      <div style={{ fontSize:"0.75rem", color:T.orangeDark, fontWeight:700, marginBottom:3 }}>{slots.length} slot{slots.length>1?"s":""}</div>
                      {slots.slice(0,2).map((s,i) => (
                        <div key={i} style={{ fontSize:"0.6rem", color:T.textMid, marginTop:2 }}>
                          {fmt12(...s.start.split(":").map(Number))} – {fmt12(...s.end.split(":").map(Number))}
                        </div>
                      ))}
                    </>
                  ) : (
                    <div style={{ fontSize:"0.7rem", color:T.textLight }}>{hasData?"Off":"Not set"}</div>
                  )}
                </div>
              );
            })}
          </div>

        </main>
      </div>

      {modal && globalAvailability && (
        <Modal
          day={modal.dayName}
          daySlots={modal.daySlots}
          onSave={slots => save(modal.dayName, slots)}
          onDelete={() => clearDay(modal.dayName)}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}