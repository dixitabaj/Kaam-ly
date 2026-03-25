import React, { useState, useEffect, useRef } from "react";
import BookingNavbar from "../components/Navbar/Navbar";
import {
  getAvailability,
  updateDayHours,
  toggleAvailability,
  getTasksByWorker,
} from "../api/api";

const API_BASE = "http://127.0.0.1:8000";

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
  greenDark:    "#16a34a",
  blue:         "#3b82f6",
  blueLight:    "#eff6ff",
  blueDark:     "#1d4ed8",
  gray:         "#9ca3af",
  grayLight:    "#f3f4f6",
};

const FontLink = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; }
    .hour-row { transition: background 0.1s; cursor: pointer; }
    .hour-row:hover { background: ${T.orangeLight} !important; }
    .slot-block { transition: opacity 0.15s; cursor: pointer; }
    .slot-block:hover { opacity: 0.82; }
    .booking-block { transition: opacity 0.15s; cursor: pointer; }
    .booking-block:hover { opacity: 0.85; }
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
    @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes toastIn  { from { transform: translateX(110%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes toastOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(110%); opacity: 0; } }
    @keyframes stripe   { from { background-position: 0 0; } to { background-position: 28px 0; } }
    .pending-stripe {
      background-image: repeating-linear-gradient(45deg, rgba(59,130,246,0.18) 0px, rgba(59,130,246,0.18) 6px, rgba(59,130,246,0.06) 6px, rgba(59,130,246,0.06) 14px);
      animation: stripe 1.2s linear infinite;
      background-size: 28px 28px;
    }
    .modal-sheet { animation: slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1); }
    .toast-in  { animation: toastIn  0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; }
    .toast-out { animation: toastOut 0.3s ease-in forwards; }
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

const BOOKING_STATUS = {
  pending: {
    label: "Requested", icon: "⏳",
    bg: T.blueLight, border: T.blue, textColor: T.blueDark, stripe: true,
  },
  confirmed_unpaid: {
    label: "Unpaid", icon: "🟡",
    bg: T.orangeLight, border: T.orange, textColor: T.orangeDark, stripe: false,
  },
  confirmed_paid: {
    label: "Confirmed", icon: "✓",
    bg: T.greenLight, border: T.green, textColor: T.greenDark, stripe: false,
  },
};

function getBookingStyle(task) {
  if (task.status === "cancelled") return null;
  if (task.status === "confirmed" && task.payment_status === "paid") return BOOKING_STATUS.confirmed_paid;
  if (task.status === "confirmed") return BOOKING_STATUS.confirmed_unpaid;
  return BOOKING_STATUS.pending;
}

function fmt12(h, m = 0) {
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
}
function toMins(str) {
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}
const START_HOUR = HOURS[0]; // dynamic (7)

function toOffset(str) {
  const [h, m] = str.split(":").map(Number);
  return h + m / 60 - START_HOUR;
}
function padTime(t) {
  const [h, m] = t.split(":").map(Number);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}
function addHours(timeStr, hrs) {
  const [h, m] = timeStr.split(":").map(Number);
  const totalMins = h * 60 + m + Math.round(hrs * 60);
  return `${String(Math.floor(totalMins/60)).padStart(2,"0")}:${String(totalMins%60).padStart(2,"0")}`;
}
function dateKey(dateObj) {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,"0")}-${String(dateObj.getDate()).padStart(2,"0")}`;
}
function toLocalDateKey(isoString) {
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function getBookingEndTime(task) {
  const start = task.serviceTime || "09:00";
  if (task.estimatedHours) return addHours(start, task.estimatedHours);
  return addHours(start, 2); // default 2h if no estimate
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

// ── Booking Tooltip ───────────────────────────────────────────────────────────
function BookingTooltip({ task, style }) {
  const bookingStyle = getBookingStyle(task);
  if (!bookingStyle) return null;
  return (
    <div style={{
      position: "absolute", zIndex: 100, background: T.white,
      border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 200,
      fontFamily: "'DM Sans', sans-serif", pointerEvents: "none", ...style,
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
        <span style={{ fontSize:"0.75rem" }}>{bookingStyle.icon}</span>
        <span style={{ fontWeight:700, fontSize:"0.82rem", color:bookingStyle.textColor }}>{bookingStyle.label}</span>
      </div>
      <div style={{ fontSize:"0.75rem", color:T.text, fontWeight:600, marginBottom:3 }}>{task.taskName}</div>
      <div style={{ fontSize:"0.7rem", color:T.textMid, marginBottom:2 }}>
        {fmt12(...(task.serviceTime||"09:00").split(":").map(Number))}
        {task.estimatedHours
          ? ` → ${fmt12(...addHours(task.serviceTime||"09:00", task.estimatedHours).split(":").map(Number))} (${task.estimatedHours}h)`
          : " · Duration TBD"}
      </div>
      {task.totalCost > 0 && (
        <div style={{ fontSize:"0.7rem", color:T.textMid }}>
          Rs. {task.totalCost.toLocaleString()} · {task.payment_method || "—"}
        </div>
      )}
    </div>
  );
}

// ── Booking Block ─────────────────────────────────────────────────────────────
function BookingBlock({ task }) {
  const [hovered, setHovered] = useState(false);
  const bookingStyle = getBookingStyle(task);
  if (!bookingStyle) return null;

  const start = task.serviceTime || "09:00";
  const end = getBookingEndTime(task);
  const top = toOffset(start) * HOUR_H;
  const height = Math.max((toOffset(end) - toOffset(start)) * HOUR_H, 50); // min height 50px

  // Tooltip position
  const tooltipStyle = top > 260
    ? { bottom: height + 6, left: 0 }
    : { top: height + 6, left: 0 };

  return (
    <div
      className="booking-block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute",
        top,
        left: 3,
        right: 3,
        height,
        background: bookingStyle.bg,
        border: `1.5px solid ${bookingStyle.border}`,
        borderRadius: 8,
        padding: "5px 7px",
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        overflow: "visible",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Pending stripe */}
      {bookingStyle.stripe && (
        <div
          className="pending-stripe"
          style={{ position: "absolute", inset: 0, borderRadius: 8 }}
        />
      )}

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
          <span style={{ fontSize: "0.65rem" }}>{bookingStyle.icon}</span>
          <span style={{ fontWeight: 700, fontSize: "0.7rem", color: bookingStyle.textColor }}>
            {bookingStyle.label}
          </span>
        </div>

        <div style={{ fontSize: "0.68rem", fontWeight: 600, color: bookingStyle.textColor, whiteSpace: "normal" }}>
          {task.taskName}
        </div>

        <div style={{ fontSize: "0.65rem", color: bookingStyle.textColor, opacity: 0.8, marginTop: 1 }}>
          {fmt12(...start.split(":").map(Number))} → {fmt12(...end.split(":").map(Number))}
        </div>

        {task.totalCost > 0 && (
          <div style={{ fontSize: "0.65rem", color: bookingStyle.textColor, opacity: 0.75, marginTop: 1 }}>
            Rs. {task.totalCost.toLocaleString()} · {task.payment_method || "—"}
          </div>
        )}
      </div>

      {/* Tooltip on hover */}
      {hovered && <BookingTooltip task={task} style={tooltipStyle} />}
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  const isOff = toast.type === "unavailable";
  return (
    <div className={toast.exiting ? "toast-out" : "toast-in"}
      style={{
        position: "fixed", bottom: 28, right: 24, zIndex: 2000,
        background: isOff ? "#1a1512" : T.white, color: isOff ? "#fff" : T.text,
        borderRadius: 14, padding: "14px 18px", minWidth: 280, maxWidth: 340,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)", display: "flex",
        alignItems: "flex-start", gap: 12, fontFamily: "'DM Sans', sans-serif",
        border: `1px solid ${isOff ? "#333" : T.border}`,
      }}>
      <span style={{ fontSize:"1.1rem", marginTop:1 }}>{isOff ? "🔴" : "🟢"}</span>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:700, fontSize:"0.88rem", marginBottom:3 }}>
          {isOff ? "You're now unavailable" : "You're now available"}
        </div>
        <div style={{ fontSize:"0.78rem", opacity:0.72, lineHeight:1.45 }}>
          {isOff
            ? "Clients won't be able to book you."
            : "Your schedule has been restored. Clients can book you again."}
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <div className={`toggle-track ${on ? "toggle-on" : ""}`}
      style={{ background: on ? T.orange : T.border }}
      onClick={e => { e.stopPropagation(); onChange(!on); }}>
      <div className="toggle-thumb" />
    </div>
  );
}

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
              <button onClick={onDelete} style={{ background:"none", border:"none", color:T.red, fontSize:"0.78rem", cursor:"pointer", fontWeight:600 }}>Clear day</button>
            )}
            <button onClick={onClose} style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:T.textMid, fontSize:"1rem" }}>×</button>
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
                    style={{ background:"none", border:"none", color:T.textLight, fontSize:"1.1rem", cursor:"pointer" }}>×</button>
                )}
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, opacity:slot.enabled?1:0.35, pointerEvents:slot.enabled?"auto":"none" }}>
              <TimePicker value={slot.start} onChange={v => update(i,"start",v)} />
              <span style={{ color:T.textLight, fontSize:"0.8rem" }}>–</span>
              <TimePicker value={slot.end} onChange={v => update(i,"end",v)} />
            </div>
          </div>
        ))}
        <button onClick={addSlot}
          style={{ width:"100%", padding:"0.65rem", background:"none", border:`1.5px dashed ${T.orange}`, borderRadius:10, color:T.orange, fontWeight:700, fontSize:"0.85rem", cursor:"pointer", marginBottom:"1rem", fontFamily:"'DM Sans', sans-serif" }}
          onMouseEnter={e => e.currentTarget.style.background=T.orangeLight}
          onMouseLeave={e => e.currentTarget.style.background="none"}>
          + Add time slot
        </button>
        <button onClick={save}
          style={{ width:"100%", padding:"0.85rem", background:bad.size>0?T.border:`linear-gradient(135deg,${T.orange},${T.orangeDark})`, color:bad.size>0?T.textLight:"#fff", border:"none", borderRadius:12, fontWeight:700, fontSize:"0.95rem", cursor:bad.size>0?"not-allowed":"pointer", marginBottom:"0.5rem", fontFamily:"'DM Sans', sans-serif" }}>
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

function Legend() {
  const items = [
    { color: T.orange, label: "Free slot" },
    { color: T.blue,   label: "Requested (pending)", stripe: true },
    { color: T.orange, label: "Confirmed (unpaid)",  faded: true },
    { color: T.green,  label: "Confirmed & paid" },
  ];
  return (
    <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginTop:"0.75rem" }}>
      {items.map(({ color, label, stripe, faded }) => (
        <div key={label} style={{ display:"flex", alignItems:"center", gap:5, fontSize:"0.7rem", color:T.textMid }}>
          <div style={{
            width:12, height:12, borderRadius:3, border:`1.5px solid ${color}`,
            background: stripe
              ? `repeating-linear-gradient(45deg,rgba(59,130,246,0.2) 0px,rgba(59,130,246,0.2) 4px,rgba(59,130,246,0.05) 4px,rgba(59,130,246,0.05) 8px)`
              : faded ? T.orangeLight
              : color === T.orange ? `linear-gradient(135deg,${T.orange},${T.orangeDark})`
              : color === T.green  ? T.greenLight : T.blueLight,
          }} />
          {label}
        </div>
      ))}
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function CalendarAvailability() {
  const userString = localStorage.getItem("user") || sessionStorage.getItem("user");
  const workerId = userString
    ? (() => {
        try {
          const p = JSON.parse(userString);
          return p?.email || p?.id || p?._id || null;
        } catch { return null; }
      })()
    : null;

  const today = new Date();
  const [weekOffset,         setWeekOffset]         = useState(0);
  const [availability,       setAvailability]       = useState({});
  // ✅ freeSlots: { "2026-03-29": [{start, end}] }  — already has bookings subtracted
  const [freeSlots,          setFreeSlots]          = useState({});
  const [bookings,           setBookings]           = useState([]);
  const [globalAvailability, setGlobalAvailability] = useState(true);
  const [loading,            setLoading]            = useState(true);
  const [saving,             setSaving]             = useState(false);
  const [modal,              setModal]              = useState(null);
  const [toast,              setToast]              = useState(null);
  const toastTimerRef = useRef(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay() + i + weekOffset * 7);
    return d;
  });

  const bookingsByDate = bookings.reduce((acc, task) => {
    if (task.status === "cancelled") return acc;
    if (!task.serviceDate) return acc;
    const key = toLocalDateKey(task.serviceDate);
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});

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

  // ✅ NEW: fetch free slots from /worker/free-slots/{workerId}/{date}
  // Backend does: general slots (worker.hours) MINUS booked slots (tasks collection)
  // Result has zero overlap with booking blocks — guaranteed
  const fetchFreeSlotsForWeek = async (days, wId) => {
  const sorted = [...days].sort((a, b) => a - b);
  const startDate = dateKey(sorted[0]);
  const endDate   = dateKey(sorted[sorted.length - 1]);

  try {
    const res = await fetch(
  `${API_BASE}/api/worker/free-slots-range/${encodeURIComponent(wId)}?start_date=${startDate}&end_date=${endDate}`
);
    if (!res.ok) throw new Error("Failed to fetch free slots");
    const data = await res.json();
    // data.freeSlots is already { "2026-03-25": [{start, end}, ...], ... }
    setFreeSlots(data.freeSlots || {});
  } catch (e) {
    console.error("fetchFreeSlotsForWeek error:", e);
    setFreeSlots({});
  }
};

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!workerId) { setLoading(false); return; }

    Promise.all([
      fetch(`${API_BASE}/worker/availability/${encodeURIComponent(workerId)}`)
        .then(r => r.json()).catch(() => ({})),
      getTasksByWorker(workerId),
    ])
      .then(async ([availData, tasksData]) => {
        // Parse weekly availability for modal + summary cards
        if (availData?.hours && typeof availData.hours === "object") {
          const parsed = {};
          for (const [key, value] of Object.entries(availData.hours)) {
            const slots = parseDay(value);
            if (slots.length > 0) parsed[key.toLowerCase()] = slots;
          }
          setAvailability(parsed);
        }
        if (typeof availData?.isAvailable === "boolean") {
          setGlobalAvailability(availData.isAvailable);
        }

        if (Array.isArray(tasksData)) {
          setBookings(tasksData.filter(t => t.status !== "cancelled"));
        } else if (Array.isArray(tasksData?.tasks)) {
          setBookings(tasksData.tasks.filter(t => t.status !== "cancelled"));
        }

        // ✅ Fetch free slots (backend subtracts bookings from general hours)
        await fetchFreeSlotsForWeek(weekDays, workerId);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [workerId]);

  // ── Re-fetch when week changes ──────────────────────────────────────────────
  useEffect(() => {
    if (!workerId || loading) return;
    fetchFreeSlotsForWeek(weekDays, workerId);
  }, [weekOffset]);

  const showToast = (type) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, exiting: false });
    toastTimerRef.current = setTimeout(() => {
      setToast(prev => prev ? { ...prev, exiting: true } : null);
      setTimeout(() => setToast(null), 300);
    }, 3500);
  };

  const toggleGlobal = async () => {
    const next = !globalAvailability;
    setGlobalAvailability(next);
    showToast(next ? "available" : "unavailable");
    setSaving(true);
    try {
      await toggleAvailability(workerId, next);
    } catch(e) {
      console.error("Toggle failed:", e);
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
      await fetchFreeSlotsForWeek(weekDays, workerId);
    } catch(e) { console.error("Save failed:", e); }
    finally { setSaving(false); setModal(null); }
  };

  const clearDay = async (dayName) => {
    setSaving(true);
    setAvailability(prev => { const n={...prev}; delete n[dayName]; return n; });
    try {
      await updateDayHours(workerId, DAY_CAPS[dayName], []);
      await fetchFreeSlotsForWeek(weekDays, workerId);
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
      <Toast toast={toast} />

      <div style={{ background:T.bg, fontFamily:"'DM Sans', sans-serif" }}>
        <main style={{ padding:"2rem 2rem 3rem", maxWidth:1120, margin:"0 auto", height:"550px" }}>

          {/* Header */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
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

          {/* Unavailable banner */}
          {!globalAvailability && (
            <div style={{ display:"flex", alignItems:"center", gap:10, background:"#1a1512", color:"#fff", borderRadius:12, padding:"12px 18px", marginBottom:"1.25rem", fontSize:"0.85rem", fontWeight:500 }}>
              <span>🔴</span>
              <span>You're currently <strong>unavailable</strong>. Clients cannot book you. Toggle available to restore.</span>
            </div>
          )}

          {/* Calendar grid */}
          <div style={{
            background: T.white, border: `1px solid ${T.border}`, borderRadius: 16,
            overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
            opacity: globalAvailability ? 1 : 0.45,
            pointerEvents: globalAvailability ? "auto" : "none",
            transition: "opacity 0.25s",
          }}>
            {/* Day headers */}
            <div style={{ display:"flex", borderBottom:`1px solid ${T.border}` }}>
              <div style={{ width:52, flexShrink:0 }} />
              {weekDays.map((date, i) => {
                const dayName     = DAY_NAMES[date.getDay()];
                const isToday     = date.toDateString() === today.toDateString();
                const key         = dateKey(date);
                const dayBooks    = bookingsByDate[key] || [];
                const hasFree     = (freeSlots[key] || []).length > 0;
                const hasPending  = dayBooks.some(t => t.status === "pending");
                const hasConfirmed = dayBooks.some(t => t.status === "confirmed");
                return (
                  <div key={i} className="day-col" style={{ flex:1, textAlign:"center", padding:"0.8rem 0.25rem", borderLeft:`1px solid ${T.border}` }}>
                    <div style={{ fontSize:"0.65rem", color:T.textLight, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:600 }}>{DAYS[date.getDay()]}</div>
                    <div className="day-num"
                      onClick={() => setModal({ dayName, daySlots: availability[dayName] || [] })}
                      style={{ width:32, height:32, borderRadius:"50%", background:isToday?T.orange:"transparent", color:isToday?"#fff":T.text, display:"flex", alignItems:"center", justifyContent:"center", margin:"4px auto 0", fontWeight:isToday?700:500, fontSize:"0.87rem", cursor:"pointer", position:"relative" }}>
                      {date.getDate()}
                      <div style={{ position:"absolute", bottom:1, display:"flex", gap:2, justifyContent:"center" }}>
                        {hasFree      && <span style={{ width:4, height:4, borderRadius:"50%", background:isToday?"#fff":T.orange, display:"block" }} />}
                        {hasPending   && <span style={{ width:4, height:4, borderRadius:"50%", background:T.blue,  display:"block" }} />}
                        {hasConfirmed && <span style={{ width:4, height:4, borderRadius:"50%", background:T.green, display:"block" }} />}
                      </div>
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
                const dayName  = DAY_NAMES[date.getDay()];
                const key      = dateKey(date);
                const dayBooks = bookingsByDate[key] || [];

                // ✅ freeSlots[key] = general hours MINUS booked time (computed by backend)
                // These will NEVER overlap with booking blocks below
                const dayFreeSlots = freeSlots[key] || [];

                return (
                  <div key={i} style={{ flex:1, position:"relative", borderLeft:`1px solid ${T.border}` }}>

                    {/* Hour row backgrounds */}
                    {HOURS.map(h => (
                      <div key={h} className="hour-row"
                        style={{ height:HOUR_H, borderTop:`1px solid ${T.border}` }}
                        onClick={() => setModal({ dayName, daySlots: availability[dayName] || [] })} />
                    ))}

                    {/* ✅ FREE slots — orange blocks, gaps already cut out for bookings */}
                    {dayFreeSlots.map((slot, si) => {
                      const topPx    = toOffset(slot.start) * HOUR_H;
                      const heightPx = Math.max(
                        (toOffset(slot.end) - toOffset(slot.start)) * HOUR_H,
                        4
                      );
                      if (heightPx < 8) return null;
                      return (
                        <div key={si} className="slot-block"
                          onClick={() => setModal({ dayName, daySlots: availability[dayName] || [] })}
                          style={{
                            position:   "absolute",
                            top:        topPx,
                            left:       3,
                            right:      3,
                            height:     heightPx,
                            background: `linear-gradient(160deg,${T.orange}dd,${T.orangeDark}dd)`,
                            borderRadius: 8,
                            padding:    heightPx > 28 ? "5px 7px" : "2px 5px",
                            zIndex:     2,
                            border:     `1px solid ${T.orange}`,
                            boxShadow:  "0 2px 8px rgba(246,173,86,0.2)",
                            overflow:   "hidden",
                          }}>
                          {heightPx > 28 && (
                            <>
                              <div style={{ fontSize:"0.6rem", color:"#fff", fontWeight:700 }}>
                                {fmt12(...slot.start.split(":").map(Number))}
                              </div>
                              <div style={{ fontSize:"0.56rem", color:"rgba(255,255,255,0.8)" }}>
                                {fmt12(...slot.end.split(":").map(Number))}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}

                    {/* ✅ BOOKING blocks — sit in the gaps left by free slots, zIndex 4 */}
                    {dayBooks.map((task, bi) => (
                      <BookingBlock
                        key={task._id || task.id || bi}
                        task={task}
                      />
                    ))}

                  </div>
                );
              })}
            </div>
          </div>

          <Legend />

          {/* Summary cards */}
          <div style={{ display:"flex", gap:"0.5rem", marginTop:"1rem", flexWrap:"wrap" }}>
            {DAY_NAMES.map(day => {
              const slots    = (availability[day]||[]).filter(s => s.enabled);
              const hasData  = (availability[day]||[]).length > 0;
              const dayBookCount = bookings.filter(t => {
                if (!t.serviceDate) return false;
                const d = new Date(t.serviceDate);
                return DAY_NAMES[d.getDay()] === day && t.status !== "cancelled";
              }).length;
              return (
                <div key={day} className="summary-card"
                  onClick={() => globalAvailability && setModal({ dayName:day, daySlots:availability[day]||[] })}
                  style={{ flex:1, minWidth:100, background:slots.length?T.orangeLight:T.white, border:`1px solid ${slots.length?T.orangeBorder:T.border}`, borderRadius:12, padding:"0.75rem", opacity:globalAvailability?1:0.5, cursor:globalAvailability?"pointer":"default" }}>
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
                  {dayBookCount > 0 && (
                    <div style={{ fontSize:"0.62rem", color:T.blue, fontWeight:600, marginTop:4 }}>
                      {dayBookCount} booking{dayBookCount>1?"s":""}
                    </div>
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