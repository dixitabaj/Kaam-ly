import React, { useState, useEffect, useRef, useCallback } from "react";
import BookingNavbar from "../components/Navbar/Navbar";
import {
  fetchWorkerAvailability,
  fetchFreeSlotRange,
  updateDayHours,
  saveDateOverride as apiSaveDateOverride,
  toggleAvailability,
  getTasksByWorker,
} from "../api/api";
import { HelpCircle } from "lucide-react";
import ChatWidget from "../components/HelpSection/HelpSection";
import ReactDOM from "react-dom"

// ── Design tokens ─────────────────────────────────────────────────────────────
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

// ── Constants ─────────────────────────────────────────────────────────────────
const DAYS      = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const HOURS     = Array.from({ length: 24 }, (_, i) => i + 1);
const DAY_NAMES = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const DAY_CAPS  = {
  sunday:"Sunday", monday:"Monday", tuesday:"Tuesday",
  wednesday:"Wednesday", thursday:"Thursday", friday:"Friday", saturday:"Saturday",
};
const START_HOUR = 1;

const BOOKING_STATUS = {
  pending: {
    label: "Requested", icon: "",
    bg: T.blueLight,
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

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  if (!str || !str.includes(":")) return 0;
  const [h, m] = str.split(":").map(Number);
  return h * 60 + (m || 0);
}
function toOffset(str) {
  if (!str || !str.includes(":")) return 0;
  let [h, m] = str.split(":").map(Number);
  if (h === 0) h = 24;
  return (h + (m || 0) / 60) - START_HOUR;
}
function padTime(t) {
  if (!t) return "00:00";
  const [h, m] = t.split(":").map(Number);
  return `${String(h).padStart(2,"0")}:${String(m || 0).padStart(2,"0")}`;
}
function addHours(timeStr, hrs) {
  if (!timeStr) return "00:00";
  const [h, m] = timeStr.split(":").map(Number);
  const totalMins = h * 60 + (m || 0) + Math.round(hrs * 60);
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
  return addHours(start, 2);
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

// ── useWindowSize hook ────────────────────────────────────────────────────────
function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const handler = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return size;
}

function useBreakpoint() {
  const { width } = useWindowSize();
  if (width >= 1600) return "tv";
  if (width >= 1024) return "desktop";
  if (width >= 640)  return "tablet";
  return "mobile";
}

// ── Global styles ─────────────────────────────────────────────────────────────
const FontLink = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; }

    html { font-size: 16px; }
    @media (min-width: 1600px) { html { font-size: 20px; } }
    @media (min-width: 2000px) { html { font-size: 24px; } }

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
    .toggle-track { position:relative; width:2.375rem; height:1.3125rem; border-radius:99px; cursor:pointer; transition:background 0.2s; flex-shrink:0; }
    .toggle-thumb { position:absolute; top:0.15625rem; left:0.15625rem; width:1rem; height:1rem; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,0.2); transition:transform 0.2s; }
    .toggle-on .toggle-thumb { transform:translateX(1.0625rem); }
    @media (min-width:1600px) {
      .toggle-track { width:3.125rem; height:1.75rem; }
      .toggle-thumb { width:1.375rem; height:1.375rem; }
      .toggle-on .toggle-thumb { transform:translateX(1.375rem); }
    }
    @keyframes slideUp  { from { transform: translateY(1.5rem); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes toastIn  { from { transform: translateX(110%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes toastOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(110%); opacity: 0; } }
    @keyframes toastBar { from { width: 100%; } to { width: 0%; } }
    @keyframes stripe   { from { background-position: 0 0; } to { background-position: 1.75rem 0; } }
    .pending-stripe {
      background-image: repeating-linear-gradient(45deg, rgba(59,130,246,0.18) 0px, rgba(59,130,246,0.18) 6px, rgba(59,130,246,0.06) 6px, rgba(59,130,246,0.06) 14px);
      animation: stripe 1.2s linear infinite;
      background-size: 1.75rem 1.75rem;
    }
    .modal-sheet { animation: slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1); }
    .toast-slide-in { animation: toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; }
    .tab-btn { transition: all 0.15s; }
    .tab-btn:hover { background: ${T.orangeLight} !important; }
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-thumb { background: ${T.orangeBorder}; border-radius: 3px; }

    .grid-scroll { -webkit-overflow-scrolling: touch; scroll-snap-type: x mandatory; }
    .grid-scroll > * { scroll-snap-align: start; }

    /* ── Calendar page layout ── */
    .cal-page {
      display: flex;
      flex-direction: column;
      min-height: calc(100vh - var(--navbar-height, 64px));
      background: ${T.bg};
      font-family: 'DM Sans', sans-serif;
    }
    .cal-main {
      flex: 1;
      padding: clamp(1rem, 3vw, 2rem) clamp(1rem, 4vw, 2rem);
      max-width: 1120px;
      width: 100%;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    @media (min-width: 1600px) {
      .cal-main { max-width: 1800px; padding: 3rem 4rem; }
    }

    /* Calendar grid container — fills remaining vertical space */
    .cal-grid-wrap {
      background: ${T.white};
      border: 1px solid ${T.border};
      border-radius: 1rem;
      overflow: hidden;
      box-shadow: 0 2px 12px rgba(0,0,0,0.05);
      transition: opacity 0.25s;
      display: flex;
      flex-direction: column;
      /* grow to fill available space, with a sensible min/max */
      flex: 1;
      min-height: clamp(18rem, 45vh, 40rem);
      max-height: clamp(22rem, 60vh, 56rem);
    }
    @media (max-width: 639px) {
      .cal-grid-wrap {
        min-height: clamp(14rem, 50vw, 24rem);
        max-height: clamp(18rem, 55vw, 28rem);
      }
    }

    /* Hour scroll area inside the grid */
    .cal-hour-scroll {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
    }
  `}</style>
);

// ── Sub-components ────────────────────────────────────────────────────────────
function BookingBlock({ task, hourH }) {
  const [hovered, setHovered]       = useState(false);
  const [tooltipPos, setTooltipPos] = useState(null);
  const blockRef = useRef(null);
  const bs = getBookingStyle(task);
  if (!bs) return null;

  const start  = task.serviceTime || "09:00";
  const end    = getBookingEndTime(task);
  const top    = toOffset(start) * hourH;
  const height = Math.max((toOffset(end) - toOffset(start)) * hourH, 50);
  if (top < 0) return null;

  const handleMouseEnter = () => {
    if (blockRef.current) {
      const rect       = blockRef.current.getBoundingClientRect();
      const tooltipH   = 130;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow >= tooltipH + 8) {
        setTooltipPos({ top: rect.bottom + 6, left: rect.left });
      } else if (spaceAbove >= tooltipH + 8) {
        setTooltipPos({ top: rect.top - tooltipH - 6, left: rect.left });
      } else {
        setTooltipPos({ top: rect.top, left: rect.right + 8 });
      }
    }
    setHovered(true);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    setTooltipPos(null);
  };

  return (
    <>
      <div
        ref={blockRef}
        className="booking-block"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          position:"absolute", top, left:3, right:3,
          background:bs.bg, border:`1.5px solid ${bs.border}`,
          borderRadius:"0.5rem", padding:"5px 7px", zIndex:100,
          display:"flex", flexDirection:"column", justifyContent:"center",
          overflow:"visible", fontFamily:"'DM Sans', sans-serif",
        }}
      >
        {bs.stripe && (
          <div className="pending-stripe" style={{ position:"absolute", inset:0, borderRadius:"0.5rem" }} />
        )}
        <div style={{ position:"relative", zIndex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:2 }}>
            <span style={{ fontSize:"0.65rem" }}>{bs.icon}</span>
            <span style={{ fontWeight:700, fontSize:"0.7rem", color:bs.textColor }}>{bs.label}</span>
          </div>
          <div style={{ fontSize:"0.68rem", fontWeight:600, color:bs.textColor, whiteSpace:"normal" }}>{task.taskName}</div>
          <div style={{ fontSize:"0.65rem", color:bs.textColor, opacity:0.8, marginTop:1 }}>
            {fmt12(...start.split(":").map(Number))} → {fmt12(...end.split(":").map(Number))}
          </div>
          {task.totalCost > 0 && (
            <div style={{ fontSize:"0.65rem", color:bs.textColor, opacity:0.75, marginTop:1 }}>
              Rs. {task.totalCost.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {hovered && tooltipPos && ReactDOM.createPortal(
        <div style={{
          position:"fixed", top:tooltipPos.top, left:tooltipPos.left,
          zIndex:9999, background:"#fff", border:`1px solid #ebe8e2`,
          borderRadius:"0.625rem", padding:"0.625rem 0.875rem",
          boxShadow:"0 8px 24px rgba(0,0,0,0.12)", minWidth:200,
          fontFamily:"'DM Sans', sans-serif", pointerEvents:"none",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
            <span style={{ fontSize:"0.75rem" }}>{bs.icon}</span>
            <span style={{ fontWeight:700, fontSize:"0.82rem", color:bs.textColor }}>{bs.label}</span>
          </div>
          <div style={{ fontSize:"0.75rem", color:"#1a1512", fontWeight:600, marginBottom:3 }}>{task.taskName}</div>
          <div style={{ fontSize:"0.7rem", color:"#6b6460", marginBottom:2 }}>
            {fmt12(...(task.serviceTime||"09:00").split(":").map(Number))}
            {task.estimatedHours
              ? ` → ${fmt12(...addHours(task.serviceTime||"09:00", task.estimatedHours).split(":").map(Number))} (${task.estimatedHours}h)`
              : " · Duration TBD"}
          </div>
          {task.totalCost > 0 && (
            <div style={{ fontSize:"0.7rem", color:"#6b6460" }}>
              Rs. {task.totalCost.toLocaleString()} · {task.payment_method || "—"}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toast, onRemove }) {
  const isOff = toast.type === "unavailable";
  const dotColor = isOff ? T.red : T.green;
  return (
    <div className="toast-slide-in" style={{
      display:"flex", alignItems:"center", gap:"0.75rem",
      padding:"0.75rem 1rem", borderRadius:"0.75rem",
      position:"relative", overflow:"hidden",
      minWidth:"16.25rem", maxWidth:"21.25rem",
      background:T.white, border:`1px solid ${T.border}`,
      color:T.text, fontSize:"0.8125rem", fontWeight:600,
      boxShadow:"0 8px 24px rgba(0,0,0,0.10)",
      fontFamily:"'DM Sans', sans-serif",
    }}>
      <div style={{ width:"0.5rem", height:"0.5rem", borderRadius:"50%", background:dotColor, flexShrink:0 }} />
      <div style={{ flex:1, lineHeight:1.5 }}>
        <div style={{ fontWeight:700, fontSize:"0.88rem", marginBottom:"0.125rem", color:T.text }}>
          {isOff ? "You're now unavailable" : "You're now available"}
        </div>
        <div style={{ fontSize:"0.78rem", color:T.textMid }}>
          {isOff ? "Clients won't be able to book you." : "Your schedule has been restored."}
        </div>
      </div>
      <button onClick={() => onRemove(toast.id)} style={{ background:"none", border:"none", cursor:"pointer", color:T.textLight, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1rem", padding:0, lineHeight:1, flexShrink:0 }}>×</button>
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"0.125rem", background:T.grayLight }}>
        <div style={{ height:"100%", opacity:0.65, background:dotColor, animation:"toastBar 3.5s linear forwards" }} />
      </div>
    </div>
  );
}

function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position:"fixed", top:"1.75rem", right:"1.5rem", zIndex:2000, display:"flex", flexDirection:"column", gap:"0.625rem", alignItems:"flex-end", pointerEvents:"none" }}>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents:"auto" }}>
          <Toast toast={t} onRemove={onRemove} />
        </div>
      ))}
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
  const isPM   = h >= 12;
  const dH     = h % 12 === 0 ? 12 : h % 12;
  const emit   = (newH, newM, pm) => {
    const actual = pm ? (newH === 12 ? 12 : newH + 12) : (newH === 12 ? 0 : newH);
    onChange(`${String(actual).padStart(2,"0")}:${String(newM).padStart(2,"0")}`);
  };
  const sel = {
    padding:"7px 3px", border:"none", background:"transparent",
    fontSize:"0.88rem", fontWeight:600, color:T.text,
    cursor:"pointer", outline:"none", fontFamily:"'DM Sans', sans-serif",
  };
  return (
    <div style={{ display:"flex", alignItems:"center", gap:2, background:T.bg, borderRadius:"0.5rem", padding:"0 6px", border:`1px solid ${T.border}` }}>
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
function Modal({ day, dateKey: specificDate, daySlots, onSave, onSaveDate, onDelete, onClose }) {
  const [tab,   setTab]   = useState(specificDate ? "date" : "weekly");
  const [slots, setSlots] = useState(
    daySlots?.length ? daySlots : [{ start:"09:00", end:"17:00", enabled:true }]
  );
  const [error, setError] = useState("");
  const bad = overlaps(slots);

  const update = (i, field, val) => {
    const next = [...slots]; next[i] = { ...next[i], [field]:val };
    setSlots(next); setError("");
  };
  const addSlot = () => {
    const last = [...slots].filter(s => s.enabled).sort((a,b) => toMins(b.end)-toMins(a.end))[0];
    let start="09:00", end="10:00";
    if (last) {
      const s = toMins(last.end)+30, e = s+60;
      if (s < 1320 && e <= 1320) {
        start=`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
        end  =`${String(Math.floor(e/60)).padStart(2,"0")}:${String(e%60).padStart(2,"0")}`;
      }
    }
    setSlots([...slots,{ start, end, enabled:true }]);
  };
  const save = () => {
    if (bad.size > 0) { setError("Fix overlapping slots first."); return; }
    for (let i = 0; i < slots.length; i++) {
      if (slots[i].enabled && toMins(slots[i].end) <= toMins(slots[i].start)) {
        setError(`Slot ${i+1}: end time must be after start time.`); return;
      }
    }
    const enabled = slots.filter(s => s.enabled).sort((a,b) => toMins(a.start)-toMins(b.start));
    if (tab === "date" && specificDate) onSaveDate(specificDate, enabled);
    else onSave(enabled);
  };

  const displayDate = specificDate
    ? new Date(specificDate + "T00:00:00").toLocaleDateString("en-US",{ weekday:"long", month:"long", day:"numeric" })
    : null;

  return (
    <div
      style={{ position:"fixed", inset:0, background:"rgba(26,21,18,0.45)", backdropFilter:"blur(3px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:"1rem" }}
      onClick={onClose}
    >
      <div className="modal-sheet" onClick={e => e.stopPropagation()}
        style={{
          background:T.white, borderRadius:"1.25rem",
          padding:"clamp(1.25rem, 3vw, 2.5rem)",
          width:"100%", maxWidth:"min(27.5rem, 95vw)", maxHeight:"85vh",
          overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontWeight:700, fontSize:"clamp(1rem,2vw,1.15rem)", color:T.text, fontFamily:"'DM Serif Display', serif" }}>
              Edit Availability
            </div>
            <div style={{ fontSize:"0.78rem", color:T.textLight, textTransform:"capitalize", marginTop:2 }}>{day}</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"0.625rem" }}>
            {daySlots?.length > 0 && tab==="weekly" && (
              <button onClick={onDelete} style={{ background:"none", border:"none", color:T.red, fontSize:"0.78rem", cursor:"pointer", fontWeight:600 }}>Clear day</button>
            )}
            <button onClick={onClose} style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:"0.5rem", width:"1.75rem", height:"1.75rem", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:T.textMid, fontSize:"1rem" }}>×</button>
          </div>
        </div>

        {specificDate && (
          <div style={{ display:"flex", gap:4, background:T.bg, borderRadius:"0.625rem", padding:4, marginBottom:"1.1rem" }}>
            {[{ key:"weekly", label:"Weekly schedule" },{ key:"date", label:`Override ${displayDate}` }].map(t => (
              <button key={t.key} className="tab-btn"
                onClick={() => { setTab(t.key); setSlots(daySlots?.length?daySlots:[{start:"09:00",end:"17:00",enabled:true}]); setError(""); }}
                style={{
                  flex:1, padding:"0.4375rem 0.625rem", border:"none", borderRadius:"0.5rem", cursor:"pointer",
                  fontFamily:"'DM Sans', sans-serif", fontWeight:600, fontSize:"0.78rem",
                  background:tab===t.key?T.white:"transparent",
                  color:tab===t.key?T.orangeDark:T.textMid,
                  boxShadow:tab===t.key?"0 1px 4px rgba(0,0,0,0.08)":"none",
                }}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {tab==="date" && specificDate && (
          <div style={{ background:T.blueLight, border:`1px solid ${T.blue}`, borderRadius:"0.625rem", padding:"0.625rem 0.875rem", marginBottom:"1rem", fontSize:"0.78rem", color:T.blueDark, lineHeight:1.5 }}>
            📅 These slots apply <strong>only on {displayDate}</strong> and override the weekly schedule.
          </div>
        )}

        {error && (
          <div style={{ fontSize:"0.78rem", color:T.red, marginBottom:"0.75rem", fontWeight:500, background:T.redLight, padding:"0.5rem 0.75rem", borderRadius:"0.5rem" }}>⚠ {error}</div>
        )}

        {slots.map((slot, i) => (
          <div key={i} style={{ marginBottom:"0.75rem", padding:"0.85rem", background:bad.has(i)?T.redLight:T.bg, borderRadius:"0.75rem", border:`1px solid ${bad.has(i)?"#fca5a5":T.border}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.65rem" }}>
              <span style={{ fontSize:"0.75rem", color:T.textLight, fontWeight:600, letterSpacing:"0.04em", textTransform:"uppercase" }}>
                Slot {i+1} {bad.has(i) && <span style={{ color:T.red }}>· overlaps</span>}
              </span>
              <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
                <Toggle on={slot.enabled} onChange={v => update(i,"enabled",v)} />
                {slots.length > 1 && (
                  <button onClick={() => setSlots(slots.filter((_,idx) => idx!==i))}
                    style={{ background:"none", border:"none", color:T.textLight, fontSize:"1.1rem", cursor:"pointer" }}>×</button>
                )}
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", flexWrap:"wrap", opacity:slot.enabled?1:0.35, pointerEvents:slot.enabled?"auto":"none" }}>
              <TimePicker value={slot.start} onChange={v => update(i,"start",v)} />
              <span style={{ color:T.textLight, fontSize:"0.8rem" }}>–</span>
              <TimePicker value={slot.end} onChange={v => update(i,"end",v)} />
            </div>
          </div>
        ))}

        <button onClick={addSlot}
          style={{ width:"100%", padding:"0.65rem", background:"none", border:`1.5px dashed ${T.orange}`, borderRadius:"0.625rem", color:T.orange, fontWeight:700, fontSize:"0.85rem", cursor:"pointer", marginBottom:"1rem", fontFamily:"'DM Sans', sans-serif" }}
          onMouseEnter={e => e.currentTarget.style.background=T.orangeLight}
          onMouseLeave={e => e.currentTarget.style.background="none"}>
          + Add time slot
        </button>

        <button onClick={save}
          style={{ width:"100%", padding:"0.85rem", background:bad.size>0?T.border:`linear-gradient(135deg,${T.orange},${T.orangeDark})`, color:bad.size>0?T.textLight:"#fff", border:"none", borderRadius:"0.75rem", fontWeight:700, fontSize:"0.95rem", cursor:bad.size>0?"not-allowed":"pointer", marginBottom:"0.5rem", fontFamily:"'DM Sans', sans-serif" }}>
          {tab==="date" ? `Save for ${displayDate}` : "Save weekly schedule"}
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
      style={{ display:"flex", alignItems:"center", gap:"0.4375rem", padding:"0.4375rem 0.875rem", borderRadius:"1.875rem", border:`1.5px solid ${active?T.orange:T.border}`, background:active?T.orangeLight:T.bg, cursor:"pointer", marginLeft:"0.75rem", fontFamily:"'DM Sans', sans-serif" }}>
      <div style={{ width:"0.5625rem", height:"0.5625rem", borderRadius:"50%", background:active?T.orange:T.textLight, transition:"background 0.2s" }} />
      <span style={{ fontWeight:600, fontSize:"0.82rem", color:active?T.orangeDark:T.textMid }}>
        {active?"Available":"Unavailable"}
      </span>
    </button>
  );
}

function Legend({ bp }) {
  const items = [
    { color:T.orange, label:"Free slot" },
    { color:T.blue,   label:"Requested" },
    { color:T.orange, label:"Unpaid", faded:true },
    { color:T.green,  label:"Confirmed & paid" },
  ];
  const isSmall = bp === "mobile";
  return (
    <div style={{ display:"flex", gap:isSmall?"0.5rem":"0.875rem", flexWrap:"wrap" }}>
      {items.map(({ color, label, stripe, faded }) => (
        <div key={label} style={{ display:"flex", alignItems:"center", gap:"0.3125rem", fontSize:"0.7rem", color:T.textMid }}>
          <div style={{
            width:"0.75rem", height:"0.75rem", borderRadius:"0.1875rem", border:`1.5px solid ${color}`,
            background: stripe
              ? `repeating-linear-gradient(45deg,rgba(59,130,246,0.2) 0px,rgba(59,130,246,0.2) 4px,rgba(59,130,246,0.05) 4px,rgba(59,130,246,0.05) 8px)`
              : faded ? T.orangeLight
              : color===T.orange ? `linear-gradient(135deg,${T.orange},${T.orangeDark})`
              : color===T.green  ? T.greenLight : T.blueLight,
          }} />
          {label}
        </div>
      ))}
    </div>
  );
}

// ── Mobile day picker ─────────────────────────────────────────────────────────
function MobileDayPicker({ weekDays, selectedIdx, onSelect, today, bookingsByDate, freeSlots }) {
  return (
    <div style={{ display:"flex", gap:"0.375rem", overflowX:"auto", paddingBottom:"0.25rem" }}>
      {weekDays.map((date, i) => {
        const key        = dateKey(date);
        const isToday    = date.toDateString() === today.toDateString();
        const isSelected = i === selectedIdx;
        const hasFree    = (freeSlots[key]||[]).length > 0;
        const dayBooks   = bookingsByDate[key]||[];
        return (
          <button key={i} onClick={() => onSelect(i)}
            style={{
              display:"flex", flexDirection:"column", alignItems:"center", gap:"0.1875rem",
              padding:"0.5rem 0.75rem", borderRadius:"0.75rem", border:`1.5px solid ${isSelected?T.orange:T.border}`,
              background:isSelected?T.orangeLight:T.white, cursor:"pointer", flexShrink:0,
              fontFamily:"'DM Sans', sans-serif",
            }}>
            <span style={{ fontSize:"0.62rem", color:isSelected?T.orangeDark:T.textLight, fontWeight:600, textTransform:"uppercase" }}>
              {DAYS[date.getDay()]}
            </span>
            <span style={{
              width:"1.875rem", height:"1.875rem", borderRadius:"50%", background:isToday?T.orange:isSelected?T.orangeBorder:"transparent",
              color:isToday?"#fff":T.text, display:"flex", alignItems:"center", justifyContent:"center",
              fontWeight:isToday?700:500, fontSize:"0.85rem",
            }}>
              {date.getDate()}
            </span>
            <div style={{ display:"flex", gap:"0.125rem" }}>
              {hasFree && <span style={{ width:"0.25rem", height:"0.25rem", borderRadius:"50%", background:T.orange }} />}
              {dayBooks.some(t=>t.status==="pending") && <span style={{ width:"0.25rem", height:"0.25rem", borderRadius:"50%", background:T.blue }} />}
              {dayBooks.some(t=>t.status==="confirmed") && <span style={{ width:"0.25rem", height:"0.25rem", borderRadius:"50%", background:T.green }} />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function CalendarAvailability() {
  const bp        = useBreakpoint();
  const isMobile  = bp === "mobile";
  const isTablet  = bp === "tablet";
  const isTV      = bp === "tv";

  // Hour height scales with breakpoint — all relative to rem base
  const HOUR_H = isMobile ? 48 : isTablet ? 52 : isTV ? 80 : 60;

  const userString = localStorage.getItem("user") || sessionStorage.getItem("user");
  const workerId   = userString
    ? (() => { try { const p = JSON.parse(userString); return p?.email||p?.id||p?._id||null; } catch { return null; } })()
    : null;

  const today = new Date();
  const [weekOffset,         setWeekOffset]         = useState(0);
  const [availability,       setAvailability]       = useState({});
  const [freeSlots,          setFreeSlots]          = useState({});
  const [bookings,           setBookings]           = useState([]);
  const [globalAvailability, setGlobalAvailability] = useState(true);
  const [loading,            setLoading]            = useState(true);
  const [saving,             setSaving]             = useState(false);
  const [modal,              setModal]              = useState(null);
  const [selectedDayIdx,     setSelectedDayIdx]     = useState(today.getDay());
  const [toasts,             setToasts]             = useState([]);

  const weekDays = Array.from({ length:7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay() + i + weekOffset * 7);
    return d;
  });

  const bookingsByDate = bookings.reduce((acc, task) => {
    if (task.status === "cancelled" || !task.serviceDate) return acc;
    const key = toLocalDateKey(task.serviceDate);
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});

  const doFetchFreeSlots = useCallback(async (days, wId) => {
    const sorted    = [...days].sort((a,b) => a-b);
    const startDate = dateKey(sorted[0]);
    const endDate   = dateKey(sorted[sorted.length-1]);
    try {
      const slots = await fetchFreeSlotRange(wId, startDate, endDate);
      setFreeSlots(slots);
    } catch(e) {
      console.error("fetchFreeSlots error:", e);
      setFreeSlots({});
    }
  }, []);

  function parseDay(value) {
    if (Array.isArray(value)) {
      return value.filter(s => s?.start && s?.end)
        .map(s => ({ enabled:true, start:padTime(s.start), end:padTime(s.end) }));
    }
    if (typeof value === "string" && value.includes("-")) {
      const [startRaw="0:0", endRaw="0:0"] = value.split("-");
      const [sh=0,sm=0] = startRaw.split(":").map(Number);
      const [eh=0,em=0] = endRaw.split(":").map(Number);
      if (sh===0&&sm===0&&eh===0&&em===0) return [];
      return [{ enabled:true, start:padTime(startRaw), end:padTime(endRaw) }];
    }
    return [];
  }

  useEffect(() => {
    if (!workerId) { setLoading(false); return; }
    Promise.all([
      fetchWorkerAvailability(workerId).catch(() => ({})),
      getTasksByWorker(workerId).catch(() => []),
    ])
      .then(async ([availData, tasksData]) => {
        if (availData?.hours && typeof availData.hours === "object") {
          const parsed = {};
          for (const [key, value] of Object.entries(availData.hours)) {
            const slots = parseDay(value);
            if (slots.length > 0) parsed[key.toLowerCase()] = slots;
          }
          setAvailability(parsed);
        }
        if (typeof availData?.isAvailable === "boolean") setGlobalAvailability(availData.isAvailable);

        const tasks = Array.isArray(tasksData) ? tasksData
          : Array.isArray(tasksData?.tasks) ? tasksData.tasks : [];
        setBookings(tasks.filter(t => t.status !== "cancelled"));

        await doFetchFreeSlots(weekDays, workerId);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [workerId]);

  useEffect(() => {
    if (!workerId || loading) return;
    doFetchFreeSlots(weekDays, workerId);
  }, [weekOffset]);

  const showToast = (type) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  const toggleGlobal = async () => {
    const next = !globalAvailability;
    setGlobalAvailability(next);
    showToast(next ? "available" : "unavailable");
    setSaving(true);
    try { await toggleAvailability(workerId, next); }
    catch(e) { console.error(e); setGlobalAvailability(!next); }
    finally { setSaving(false); }
  };

  const saveWeekly = async (dayName, slots) => {
    setSaving(true);
    setAvailability(prev => ({ ...prev, [dayName]:slots }));
    try {
      await updateDayHours(workerId, DAY_CAPS[dayName], slots.map(({start,end}) => ({start,end})));
      await doFetchFreeSlots(weekDays, workerId);
      showToast("available");
    } catch(e) { console.error(e); }
    finally { setSaving(false); setModal(null); }
  };

  const saveDateOverride = async (dateStr, slots) => {
    setSaving(true);
    try {
      await apiSaveDateOverride(workerId, dateStr, slots);
      await doFetchFreeSlots(weekDays, workerId);
      showToast("available");
    } catch(e) { console.error("saveDateOverride error:", e); }
    finally { setSaving(false); setModal(null); }
  };

  const clearDay = async (dayName) => {
    setSaving(true);
    setAvailability(prev => { const n={...prev}; delete n[dayName]; return n; });
    try {
      await updateDayHours(workerId, DAY_CAPS[dayName], []);
      await doFetchFreeSlots(weekDays, workerId);
    } catch(e) { console.error(e); }
    finally { setSaving(false); setModal(null); }
  };

  if (loading) return (
    <div style={{ padding:"3.75rem", fontFamily:"'DM Sans', sans-serif", color:T.textLight, textAlign:"center" }}>Loading…</div>
  );

  const timeColW    = isMobile ? "2.5rem" : isTV ? "10.75rem" : "3.25rem";
  const titleSize   = isTV ? "2.4rem" : "clamp(1.4rem, 3vw, 1.8rem)";
  const summaryMinW = isMobile ? "5rem" : isTV ? "9.375rem" : "6.25rem";

  const visibleDays = isMobile
    ? [weekDays[selectedDayIdx]]
    : isTablet
    ? weekDays.slice(Math.max(0, selectedDayIdx - 1), Math.max(0, selectedDayIdx - 1) + 3)
    : weekDays;

  return (
    <>
      <FontLink />
      <BookingNavbar />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="cal-page">
        <main className="cal-main">

          {/* ── Header ── */}
          <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"space-between", alignItems:"center", gap:"0.625rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"0.25rem", flexWrap:"wrap" }}>
              <h1 style={{ fontFamily:"inter", fontSize:titleSize, color:T.text, margin:0, letterSpacing:"-0.5px" }}>
                Availability
              </h1>
              <StatusPill active={globalAvailability} onToggle={toggleGlobal} />
            </div>

            <div style={{ display:"flex", gap:"0.375rem", alignItems:"center", flexWrap:"wrap" }}>
              {saving && <span style={{ fontSize:"0.72rem", color:T.orange, fontWeight:600 }}>Saving…</span>}
              <button className="nav-btn" onClick={() => setWeekOffset(w => w-1)}
                style={{ background:T.white, border:`1px solid ${T.border}`, borderRadius:"0.5rem", padding:isMobile?"0.3125rem 0.625rem":"0.375rem 0.8125rem", cursor:"pointer", fontSize:"0.82rem", color:T.textMid, fontFamily:"'DM Sans', sans-serif" }}>
                ← {isMobile ? "" : "Prev"}
              </button>
              <button className="nav-btn" onClick={() => setWeekOffset(0)}
                style={{ background:weekOffset===0?T.orange:T.white, color:weekOffset===0?"#fff":T.textMid, border:`1px solid ${weekOffset===0?T.orange:T.border}`, borderRadius:"0.5rem", padding:isMobile?"0.3125rem 0.625rem":"0.375rem 0.8125rem", cursor:"pointer", fontSize:"0.82rem", fontWeight:600, fontFamily:"'DM Sans', sans-serif" }}>
                {isMobile ? "Now" : "This Week"}
              </button>
              <button className="nav-btn" onClick={() => setWeekOffset(w => w+1)}
                style={{ background:T.white, border:`1px solid ${T.border}`, borderRadius:"0.5rem", padding:isMobile?"0.3125rem 0.625rem":"0.375rem 0.8125rem", cursor:"pointer", fontSize:"0.82rem", color:T.textMid, fontFamily:"'DM Sans', sans-serif" }}>
                {isMobile ? "" : "Next"} →
              </button>
            </div>
          </div>

          {!globalAvailability && (
            <div style={{ display:"flex", alignItems:"center", gap:"0.625rem", background:T.redLight, color:T.red, border:`1px solid #fecaca`, borderRadius:"0.75rem", padding:"0.75rem 1.125rem", fontSize:"0.85rem", fontWeight:500 }}>
              <div style={{ width:"0.5rem", height:"0.5rem", borderRadius:"50%", background:T.red, flexShrink:0 }} />
              <span>You're currently <strong>unavailable</strong>. Clients cannot book you.</span>
            </div>
          )}

          {/* ── Mobile / Tablet day picker ── */}
          {(isMobile || isTablet) && (
            <MobileDayPicker
              weekDays={weekDays}
              selectedIdx={selectedDayIdx}
              onSelect={setSelectedDayIdx}
              today={today}
              bookingsByDate={bookingsByDate}
              freeSlots={freeSlots}
            />
          )}

          {/* ── Calendar grid ── */}
          <div
            className="cal-grid-wrap"
            style={{ opacity:globalAvailability?1:0.45, pointerEvents:globalAvailability?"auto":"none" }}
          >
            {/* Day headers */}
            {!isMobile && (
              <div style={{ display:"flex", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
                <div style={{ width:timeColW, flexShrink:0 }} />
                {visibleDays.map((date, i) => {
                  const dayName      = DAY_NAMES[date.getDay()];
                  const isToday      = date.toDateString() === today.toDateString();
                  const key          = dateKey(date);
                  const dayBooks     = bookingsByDate[key]||[];
                  const hasFree      = (freeSlots[key]||[]).length > 0;
                  const hasPending   = dayBooks.some(t => t.status==="pending");
                  const hasConfirmed = dayBooks.some(t => t.status==="confirmed");
                  return (
                    <div key={i} className="day-col"
                      style={{ flex:1, textAlign:"center", padding:isTV?"1rem 0.25rem":"0.8rem 0.25rem", borderLeft:`1px solid ${T.border}` }}>
                      <div style={{ fontSize:isTV?"0.75rem":"0.65rem", color:T.textLight, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:600 }}>
                        {DAYS[date.getDay()]}
                      </div>
                      <div className="day-num"
                        onClick={() => setModal({ dayName, dateKey:key, daySlots:availability[dayName]||[] })}
                        style={{
                          width:isTV?"2.625rem":"2rem", height:isTV?"2.625rem":"2rem", borderRadius:"50%",
                          background:isToday?T.orange:"transparent", color:isToday?"#fff":T.text,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          margin:"0.25rem auto 0", fontWeight:isToday?700:500, fontSize:isTV?"1rem":"0.87rem", cursor:"pointer", position:"relative",
                        }}>
                        {date.getDate()}
                        <div style={{ position:"absolute", bottom:1, display:"flex", gap:"0.125rem", justifyContent:"center" }}>
                          {hasFree      && <span style={{ width:"0.25rem", height:"0.25rem", borderRadius:"50%", background:isToday?"#fff":T.orange, display:"block" }} />}
                          {hasPending   && <span style={{ width:"0.25rem", height:"0.25rem", borderRadius:"50%", background:T.blue,  display:"block" }} />}
                          {hasConfirmed && <span style={{ width:"0.25rem", height:"0.25rem", borderRadius:"50%", background:T.green, display:"block" }} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Hour grid — fills remaining height */}
            <div className="cal-hour-scroll">
              <div style={{ display:"flex", height: `${HOURS.length * HOUR_H}px` }}>
                {/* Time labels */}
                <div style={{ width:timeColW, flexShrink:0 }}>
                  {HOURS.map(h => (
                    <div key={h} style={{ height:HOUR_H, display:"flex", alignItems:"flex-start", paddingTop:"0.375rem", paddingRight:"0.5rem", justifyContent:"flex-end", fontSize:isTV?"0.75rem":"0.63rem", color:T.textLight, userSelect:"none" }}>
                      {h%12===0?12:h%12}{h>=12?"P.M.":"A.M."}
                    </div>
                  ))}
                </div>

                {visibleDays.map((date, i) => {
                  const dayName      = DAY_NAMES[date.getDay()];
                  const key          = dateKey(date);
                  const dayBooks     = bookingsByDate[key]||[];
                  const dayFreeSlots = freeSlots[key]||[];

                  return (
                    <div key={i} style={{ flex:1, position:"relative", borderLeft:`1px solid ${T.border}` }}>
                      {HOURS.map(h => (
                        <div key={h} className="hour-row"
                          style={{ height:HOUR_H, border:`1px solid ${T.border}` }}
                          onClick={() => setModal({ dayName, dateKey:key, daySlots:availability[dayName]||[] })} />
                      ))}

                      {dayFreeSlots.map((slot, si) => {
                        const offsetStart  = toOffset(slot.start);
                        const offsetEnd    = toOffset(slot.end);
                        const gridHours    = HOURS.length;
                        if (offsetEnd <= 0 || offsetStart >= gridHours) return null;
                        const clampedStart = Math.max(offsetStart, 0);
                        const clampedEnd   = Math.min(offsetEnd, gridHours);
                        const topPx        = clampedStart * HOUR_H;
                        const heightPx     = Math.max((clampedEnd - clampedStart) * HOUR_H, 6);
                        if (heightPx < 6) return null;
                        return (
                          <div key={si} className="slot-block"
                            onClick={() => setModal({ dayName, dateKey:key, daySlots:availability[dayName]||[] })}
                            style={{
                              position:"absolute", top:topPx, left:3, right:3, height:heightPx,
                              background:`linear-gradient(160deg,${T.orange}dd,${T.orangeDark}dd)`,
                              borderRadius:"0.5rem", padding:heightPx>28?"5px 7px":"2px 5px",
                              zIndex:2, border:`1px solid ${T.orange}`,
                              boxShadow:"0 2px 8px rgba(246,173,86,0.2)", overflow:"clip",
                            }}>
                            {heightPx > 28 && (
                              <>
                                <div style={{ fontSize:isTV?"0.7rem":"0.6rem", color:"#fff", fontWeight:700 }}>
                                  {fmt12(...slot.start.split(":").map(Number))}
                                </div>
                                <div style={{ fontSize:isTV?"0.65rem":"0.56rem", color:"rgba(255,255,255,0.8)" }}>
                                  {fmt12(...slot.end.split(":").map(Number))}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}

                      {dayBooks.map((task, bi) => (
                        <BookingBlock key={task._id||task.id||bi} task={task} hourH={HOUR_H} />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <Legend bp={bp} />

          {/* ── Summary cards ── */}
          <div style={{
            display:"flex", gap:isMobile?"0.375rem":"0.5rem",
            flexWrap:isMobile?"nowrap":"wrap",
            overflowX:isMobile?"auto":"visible",
            paddingBottom:isMobile?"0.375rem":0,
          }}>
            {DAY_NAMES.map(day => {
              const slots        = (availability[day]||[]).filter(s => s.enabled);
              const hasData      = (availability[day]||[]).length > 0;
              const weekDay      = weekDays.find(d => DAY_NAMES[d.getDay()] === day);
              const weekDayKey   = weekDay ? dateKey(weekDay) : null;
              const dayBookCount = weekDayKey ? (bookingsByDate[weekDayKey]||[]).length : 0;
              const isActiveDay  = weekDay && weekDays[selectedDayIdx]?.toDateString() === weekDay?.toDateString();

              return (
                <div key={day} className="summary-card"
                  onClick={() => globalAvailability && setModal({ dayName:day, dateKey:null, daySlots:availability[day]||[] })}
                  style={{
                    flex:isMobile?"0 0 auto":1,
                    minWidth:summaryMinW,
                    width:isMobile?"5.625rem":undefined,
                    background:slots.length?T.orangeLight:T.white,
                    border:`1.5px solid ${isActiveDay&&isMobile?T.orange:slots.length?T.orangeBorder:T.border}`,
                    borderRadius:"0.75rem", padding:isTV?"1rem":"0.75rem",
                    opacity:globalAvailability?1:0.5,
                    cursor:globalAvailability?"pointer":"default",
                  }}>
                  <div style={{ fontSize:isTV?"0.75rem":"0.65rem", color:T.textLight, textTransform:"capitalize", marginBottom:"0.3125rem", fontWeight:600, letterSpacing:"0.04em" }}>
                    {day.slice(0,3).toUpperCase()}
                  </div>
                  {slots.length > 0 ? (
                    <>
                      <div style={{ fontSize:isTV?"0.85rem":"0.75rem", color:T.orangeDark, fontWeight:700, marginBottom:"0.1875rem" }}>
                        {slots.length} slot{slots.length>1?"s":""}
                      </div>
                      {slots.slice(0,2).map((s,i) => (
                        <div key={i} style={{ fontSize:isTV?"0.7rem":"0.6rem", color:T.textMid, marginTop:"0.125rem" }}>
                          {fmt12(...s.start.split(":").map(Number))} – {fmt12(...s.end.split(":").map(Number))}
                        </div>
                      ))}
                    </>
                  ) : (
                    <div style={{ fontSize:"0.7rem", color:T.textLight }}>{hasData?"Off":"Not set"}</div>
                  )}
                  {dayBookCount > 0 && (
                    <div style={{ fontSize:"0.62rem", color:T.blue, fontWeight:600, marginTop:"0.25rem" }}>
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
          dateKey={modal.dateKey}
          daySlots={modal.daySlots}
          onSave={slots => saveWeekly(modal.dayName, slots)}
          onSaveDate={(dateStr, slots) => saveDateOverride(dateStr, slots)}
          onDelete={() => clearDay(modal.dayName)}
          onClose={() => setModal(null)}
        />
      )}
      <ChatWidget />
    </>
  );
}