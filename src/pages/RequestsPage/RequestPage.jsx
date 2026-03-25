import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Search, Calendar, MapPin, Clock, ChevronRight, Star,
  MessageCircle, XCircle, CheckCircle,
  Flag, User, X
} from "lucide-react";
import BookingNavbar from "../../components/Navbar/Navbar";
import { useNavigate } from "react-router-dom";
import ReportModal from "../../components/Report/ReportSection";
import { autoCancelExpiredTasks, autoCancelConfirmedUnpaidTasks } from "../../api/api";
import PaymentFlow from "../../components/payment/Payment";

const API_BASE = "http://127.0.0.1:8000/api";

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatCurrency = (amount) =>
  amount != null ? `NPR ${Number(amount).toFixed(2)}` : "—";

// ── Toast ─────────────────────────────────────────────────────────────────────
const makeToast = (status, taskName) => {
  const label = taskName ? `"${taskName}"` : "Your task";
  const map = {
    confirmed:        { color: "#6d28d9", message: `${label} has been confirmed.` },
    in_progress:      { color: "#1e40af", message: `A worker has started ${label}.` },
    completed:        { color: "#065f46", message: `${label} has been completed.` },
    cancelled:        { color: "#991b1b", message: `${label} was cancelled.` },
    declined:         { color: "#991b1b", message: `${label} was declined.` },
    accepted:         { color: "#b45309", message: `${label} has been accepted by the worker.` },
    payment_reminder: { color: "#c2410c", message: `⏰ 1 hour left to pay for ${label} before auto-cancellation!` },
  };
  return map[status] || null;
};

const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const add = (toast) => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, ...toast }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 10000);
  };
  const remove = id => setToasts(p => p.filter(t => t.id !== id));
  return { toasts, add, remove };
};

const ToastContainer = ({ toasts, removeToast }) => (
  <div style={{
    position: "fixed", top: "90px", right: "20px", zIndex: 9999,
    display: "flex", flexDirection: "column", gap: "12px",
    alignItems: "flex-end", pointerEvents: "none",
  }}>
    {toasts.map(t => (
      <div key={t.id} style={{
        pointerEvents: "auto", position: "relative",
        display: "flex", alignItems: "center", gap: "12px",
        padding: "14px 18px", borderRadius: "16px",
        minWidth: "260px", maxWidth: "340px",
        background: "white", border: "1px solid #e8dfd0", color: "#1c1008",
        fontSize: "14px", fontWeight: "600",
        boxShadow: "0 10px 25px rgba(0,0,0,0.09)",
        animation: "toastSlideRight 0.35s ease", overflow: "hidden",
      }}>
        <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: t.color, flexShrink: 0 }}/>
        <div style={{ flex: 1, lineHeight: "1.45" }}>{t.message}</div>
        <button onClick={() => removeToast(t.id)} style={{
          background: "#f5efe6", border: "none", cursor: "pointer",
          color: "#78716c", borderRadius: "50%", width: "22px", height: "22px",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <X size={12} />
        </button>
        <div style={{ position:"absolute", bottom:0, left:0, height:"3px", width:"100%", background:"#f5efe6" }}>
          <div style={{ height:"100%", background: t.color, opacity: 0.5, animation:"toastProgress 10s linear forwards" }}/>
        </div>
      </div>
    ))}
    <style>{`
      @keyframes toastSlideRight { from { opacity:0; transform:translateX(40px); } to { opacity:1; transform:translateX(0); } }
      @keyframes toastProgress   { from { width:100%; } to { width:0%; } }
    `}</style>
  </div>
);

const getPaymentStatus = (task) => String(task?.paymentStatus || task?.payment_status || "pending").toLowerCase();
const isPaid = (task) => getPaymentStatus(task) === "paid";

// ── Auto-reconnecting WebSocket ───────────────────────────────────────────────
const useReconnectingWebSocket = (url, onMessage) => {
  const wsRef        = useRef(null);
  const retryRef     = useRef(0);
  const timerRef     = useRef(null);
  const activeRef    = useRef(true);
  const onMessageRef = useRef(onMessage);

  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  const connect = useCallback(() => {
    if (!activeRef.current || !url) return;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen    = () => { retryRef.current = 0; };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type !== "ping") onMessageRef.current(data);
      } catch {}
    };
    ws.onclose = () => {
      if (!activeRef.current) return;
      const delay = Math.min(1000 * 2 ** retryRef.current, 30000);
      retryRef.current += 1;
      timerRef.current = setTimeout(connect, delay);
    };
    ws.onerror = () => ws.close();
  }, [url]);

  useEffect(() => {
    if (!url) return;
    activeRef.current = true;
    connect();
    return () => {
      activeRef.current = false;
      clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [url, connect]);
};

// ── Status Badge ──────────────────────────────────────────────────────────────
const STATUS = {
  pending:     { color: "#b45309", bg: "#fef9ee", border: "#fde68a", text: "Pending" },
  confirmed:   { color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe", text: "Confirmed" },
  in_progress: { color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe", text: "In Progress" },
  completed:   { color: "#065f46", bg: "#f0fdf4", border: "#a7f3d0", text: "Completed" },
  cancelled:   { color: "#991b1b", bg: "#fef2f2", border: "#fecaca", text: "Cancelled" },
  declined:    { color: "#991b1b", bg: "#fef2f2", border: "#fecaca", text: "Declined" },
};

const StatusBadge = ({ status }) => {
  const c = STATUS[status] || STATUS.pending;
  return (
    <span style={{ padding:"4px 12px", borderRadius:"9999px", fontSize:"12px", fontWeight:"700", background:c.bg, color:c.color, border:`1px solid ${c.border}`, whiteSpace:"nowrap" }}>
      {c.text}
    </span>
  );
};

// ── Live payment countdown for confirmed+unpaid tasks ─────────────────────────
const PaymentDeadlineBadge = ({ confirmedAt }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!confirmedAt) return;
    const deadline = new Date(confirmedAt).getTime() + 24 * 60 * 60 * 1000;
    const tick = () => {
      const diff = deadline - Date.now();
      if (diff <= 0) { setTimeLeft("Expired"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [confirmedAt]);

  if (!timeLeft) return null;

  const expired = timeLeft === "Expired";
  const urgent  = !expired && parseInt(timeLeft) < 2;

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      borderRadius: "9999px", fontSize: "11px", fontWeight: "700",
      background: expired ? "#fef2f2" : urgent ? "#fff7ed" : "#f0fdf4",
      color:      expired ? "#991b1b" : urgent ? "#c2410c" : "#065f46",
      border:     `1px solid ${expired ? "#fecaca" : urgent ? "#fed7aa" : "#a7f3d0"}`,
      whiteSpace: "nowrap",
      marginTop: "100px",
      width:"150px",
      paddingLeft: "8px",
      paddingRight: "4px",
      paddingTop: "4px",
      paddingBottom: "4px"
    }}>
       {expired ? "Payment overdue" : `Pay within: ${timeLeft}`}
    </span>
  );
};

const formatDate = (dateStr) => {
  if (!dateStr) return "Date not set";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch { return dateStr; }
};

// ── Release Payment Confirm Modal ─────────────────────────────────────────────
const ReleasePaymentModal = ({ task, onClose, onConfirm, releasing }) => (
  <div
    style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, backdropFilter:"blur(4px)" }}
    onClick={onClose}
  >
    <div
      style={{ background:"white", borderRadius:"20px", padding:"1.8rem", maxWidth:"400px", width:"90%", boxShadow:"0 24px 60px rgba(0,0,0,0.15)" }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
        <h2 style={{ fontSize:"18px", fontWeight:"800", margin:0, color:"#1c1008" }}>Release Payment</h2>
        <button onClick={onClose} style={{ background:"#f5efe6", border:"none", width:"30px", height:"30px", borderRadius:"50%", cursor:"pointer", color:"#78716c", fontSize:"16px", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
      </div>
      <div style={{ background:"#f0fdf4", border:"1px solid #a7f3d0", borderRadius:"12px", padding:"14px 16px", marginBottom:"1.25rem" }}>
        <p style={{ margin:0, fontSize:"13px", fontWeight:"700", color:"#065f46" }}>✅ Confirm completion</p>
        <p style={{ margin:"6px 0 0", fontSize:"13px", color:"#064e3b", lineHeight:"1.6" }}>
          This will release <strong>NPR {task?.totalCost?.toFixed ? task.totalCost.toFixed(2) : task?.totalCost}</strong> to the worker. Only do this once you're satisfied the work is done — this cannot be undone.
        </p>
      </div>
      <div style={{ display:"flex", gap:"8px" }}>
        <button onClick={onClose} disabled={releasing} style={{ flex:1, padding:"10px", borderRadius:"10px", border:"1.5px solid #e8dfd0", background:"white", cursor:"pointer", fontSize:"14px", fontWeight:"600", color:"#78716c" }}>
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={releasing}
          style={{ flex:2, padding:"10px", borderRadius:"10px", border:"none", background:"linear-gradient(135deg,#059669,#047857)", color:"white", fontWeight:"700", cursor:releasing?"default":"pointer", opacity:releasing?0.7:1, fontSize:"14px", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }}
        >
          {releasing ? (
            <><div style={{ width:"14px", height:"14px", border:"2px solid rgba(255,255,255,0.4)", borderTop:"2px solid white", borderRadius:"50%", animation:"spin 0.75s linear infinite" }}/> Releasing…</>
          ) : (
            <><CheckCircle size={14}/> Yes, Release Payment</>
          )}
        </button>
      </div>
    </div>
  </div>
);

// ── Rate & Review Modal ───────────────────────────────────────────────────────
const RateReviewModal = ({ task, worker, customerId, onClose, onSubmitted }) => {
  const [rating, setRating]         = useState(0);
  const [hover, setHover]           = useState(0);
  const [comment, setComment]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);

  const handleSubmit = async () => {
    if (!rating) { setError("Please select a rating."); return; }
    setSubmitting(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/reviews`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task._id, workerId: task.assignedWorkerId, customerId, rating, comment }),
      });
      if (!res.ok) throw new Error("Failed to submit review");
      onSubmitted(); onClose();
    } catch (e) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, backdropFilter:"blur(4px)" }} onClick={onClose}>
      <div style={{ background:"white", borderRadius:"20px", padding:"2rem", maxWidth:"400px", width:"90%", boxShadow:"0 24px 60px rgba(0,0,0,0.15)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
          <h2 style={{ fontSize:"18px", fontWeight:"800", color:"#1c1008", margin:0 }}>Rate & Review</h2>
          <button onClick={onClose} style={{ background:"#f5efe6", border:"none", width:"30px", height:"30px", borderRadius:"50%", cursor:"pointer", color:"#78716c", fontSize:"16px", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"12px", background:"#fffbf2", borderRadius:"12px", marginBottom:"1.25rem", border:"1px solid #fde68a" }}>
          <div style={{ width:"40px", height:"40px", background:"linear-gradient(135deg,#f6a623,#e8890c)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:"800", fontSize:"18px", flexShrink:0 }}>
            {worker?.firstName?.charAt(0)||"W"}
          </div>
          <div>
            <div style={{ fontWeight:"700", fontSize:"14px", color:"#1c1008" }}>{worker?.firstName} {worker?.lastName}</div>
            <div style={{ fontSize:"12px", color:"#a8601a" }}>{task.taskName}</div>
          </div>
        </div>
        <div style={{ textAlign:"center", marginBottom:"1.25rem" }}>
          <p style={{ fontSize:"12px", color:"#a8a29e", fontWeight:"600", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"10px" }}>Your experience</p>
          <div style={{ display:"flex", justifyContent:"center", gap:"6px" }}>
            {[1,2,3,4,5].map(i=>(
              <Star key={i} size={32} fill={(hover||rating)>=i?"#f59e0b":"none"} color={(hover||rating)>=i?"#f59e0b":"#e2d9cc"}
                style={{ cursor:"pointer", transition:"transform 0.1s", transform:(hover||rating)>=i?"scale(1.12)":"scale(1)" }}
                onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(0)} onClick={()=>setRating(i)} />
            ))}
          </div>
          {rating>0&&<p style={{ fontSize:"13px", color:"#f59e0b", fontWeight:"700", marginTop:"6px" }}>{["","Poor","Fair","Good","Very Good","Excellent"][rating]}</p>}
        </div>
        <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Share details of your experience…" rows={3}
          style={{ width:"100%", padding:"11px 13px", borderRadius:"10px", border:"1.5px solid #e8dfd0", fontSize:"14px", outline:"none", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box", marginBottom:"14px", background:"#fffdf9", transition:"border-color 0.2s" }}
          onFocus={e=>e.target.style.borderColor="#f6a623"} onBlur={e=>e.target.style.borderColor="#e8dfd0"} />
        {error&&<p style={{ color:"#dc2626", fontSize:"12px", marginBottom:"10px" }}>{error}</p>}
        <div style={{ display:"flex", gap:"8px" }}>
          <button onClick={onClose} style={{ flex:1, padding:"11px", borderRadius:"10px", border:"1.5px solid #e8dfd0", background:"white", cursor:"pointer", fontSize:"14px", fontWeight:"600", color:"#78716c" }}>Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} style={{ flex:2, padding:"11px", borderRadius:"10px", border:"none", background:"linear-gradient(135deg,#f6a623,#e8890c)", color:"white", fontSize:"14px", fontWeight:"700", cursor:submitting?"default":"pointer", opacity:submitting?0.7:1 }}>
            {submitting?"Submitting…":"Submit Review"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Small Button ──────────────────────────────────────────────────────────────
const SmallBtn = ({ onClick, color, bg, border, children }) => (
  <button
    onClick={onClick}
    style={{ display:"inline-flex", alignItems:"center", gap:"4px", padding:"6px 13px", borderRadius:"9999px", fontSize:"12px", fontWeight:"700", color, background:bg, border:`1px solid ${border}`, cursor:"pointer", transition:"opacity 0.15s", whiteSpace:"nowrap" }}
    onMouseEnter={e=>e.currentTarget.style.opacity="0.8"}
    onMouseLeave={e=>e.currentTarget.style.opacity="1"}
  >
    {children}
  </button>
);

// ── Task Card ─────────────────────────────────────────────────────────────────
const TaskCard = ({ activeTab, task, worker, handleViewDetails, openPaymentModal, releasePayment, customerId, navigateToChat, onRateReview, onReport, setCancelTaskData }) => {
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();

  const showDeadline   = task.status === "confirmed" && task.escrow_status !== "held" && task.confirmedAt;
  const estimatedHours = task.estimatedHours || task.completionTime;
  const isReleased     = task.escrow_status === "released";

  return (
    <div
      onClick={() => handleViewDetails(task)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "white", width: "1200px", 
        borderRadius: "14px", border: `1px solid ${hovered ? "#f6a623" : "#ece6d9"}`,
        padding: "1.25rem 1.5rem", marginBottom: "12px",
        transition: "all 0.18s ease", cursor: "pointer",
        boxShadow: hovered ? "0 6px 20px rgba(246,166,35,0.12)" : "0 1px 6px rgba(0,0,0,0.05)",
        transform: hovered ? "translateY(-1px)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>

        {/* ── Left: Worker info ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", flexShrink: 0, width: "230px", marginTop: "10px" }}>

          {/* Avatar + Name side by side */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "52px", height: "52px",
              background: "linear-gradient(135deg,#f6a623,#e8890c)",
              borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "20px", color: "white", fontWeight: "800",
              boxShadow: "0 3px 10px rgba(246,166,35,0.3)",
            }}>
              {worker?.firstName?.charAt(0) || <User size={18} color="white" />}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: "800", fontSize: "16px", color: "#1c1008", marginBottom: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {worker ? `${worker.firstName} ${worker.lastName}` : "Worker"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                <Star size={13} fill="#f59e0b" color="#f59e0b" />
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#1c1008" }}>{worker?.ratings ?? 0}</span>
                <span style={{ fontSize: "12px", color: "#a8a29e" }}>({worker?.noOfCompletedTask || 0} jobs)</span>
              </div>
              {worker?.specialization && (
                <div style={{ fontSize: "11px", color: "#a8a29e", marginTop: "1px" }}>{worker.specialization}</div>
              )}
              {worker && (
                <button
                  onClick={e => { e.stopPropagation(); navigate(`/worker/${worker._id || worker.id}`); }}
                  style={{ fontSize: "11px", color: "#f6a623", background: "none", border: "none", cursor: "pointer", fontWeight: "700", padding: 0, textDecoration: "underline", whiteSpace: "nowrap", marginTop: "2px" }}
                >
                  View Profile
                </button>
              )}
            </div>
          </div>

          {showDeadline && <PaymentDeadlineBadge confirmedAt={task.confirmedAt} />}
        </div>

        {/* ── Middle: Task details ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ paddingLeft: "18px", marginBottom: "10px", marginTop: "20px", width: "700px", borderRight: "1px solid rgb(243,244,246)", borderLeft: "1px solid rgb(243,244,246)" }}>
            <div style={{ fontSize: "15px", color: "#57534e", marginBottom: "10px" }}>
              <span style={{ fontWeight: "700", color: "#1c1008" }}>Task details: </span>
              <span>{task.taskName || task.taskDescrip || "—"}</span>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "8px",  marginTop: "28px" }}>
              <MapPin size={15} color="#78716c" marginTop="20px"/>
              <span style={{ fontSize: "14px", color: "#57534e", lineHeight: "1.55" }}>{task.address || "Location not set"}</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
              <Calendar size={14} color="#78716c" />
              <span style={{ fontSize: "14px", color: "#57534e" }}>
                Scheduled: {task.serviceDate
                  ? new Date(`${task.serviceDate.split("T")[0]}T${task.serviceTime || "00:00"}`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
                    " at " + (task.serviceTime || "—")
                  : "Date not set"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "28px" }}>
              <Clock size={14} color="#78716c" />
              <span style={{ fontSize: "14px", color: "#57534e" }}>
                Duration: {estimatedHours + " hrs" || "Not set"}
              </span>
            </div>

          <div style={{ fontSize: "14px", color: "#57534e", marginBottom: "4px" }}>
  {(task.status === "cancelled" || task.status === "declined") ? (
    <>
      {task.status === "cancelled" ? "Cancellation reason: " : "Decline reason: "}
      <span style={{ fontWeight: "700", color: "#991b1b" }}>
        {task.cancelReason || task.declineReason || "No reason provided"}
      </span>
    </>
  ) : (
    <>
      Payment status:{" "}
      <span style={{ fontWeight: "700", color: isPaid(task) ? "#065f46" : "#b45309" }}>
        {isPaid(task) ? "paid" : (task.payment_status || task.paymentStatus || "pending")}
      </span>
    </>
  )}
</div>

            {/* Action buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "30px" }}>
              {activeTab === "confirmed" && (
                <>
                  {isPaid(task) ? (
                    <SmallBtn onClick={e => { e.stopPropagation(); openPaymentModal(task._id, task.assignedWorkerId, customerId); }} color="#1e40af" bg="#eff6ff" border="#bfdbfe">
                      View Payment
                    </SmallBtn>
                  ) : (
                    <SmallBtn onClick={e => { e.stopPropagation(); openPaymentModal(task._id, task.assignedWorkerId, customerId); }} color="#f6a623" bg="#fffbf2" border="#fde68a">
                      Make Payment
                    </SmallBtn>
                  )}
                  <SmallBtn onClick={e => { e.stopPropagation(); navigateToChat(task._id, task.assignedWorkerId); }} color="#f6a623" bg="#fffbf2" border="#fde68a">
                    Chat
                  </SmallBtn>
                </>
              )}
              {activeTab === "in_progress" && (
                <SmallBtn onClick={e => { e.stopPropagation(); openPaymentModal(task._id, task.assignedWorkerId, customerId); }} color="#1e40af" bg="#eff6ff" border="#bfdbfe">
                  View Payment
                </SmallBtn>
              )}
              {activeTab === "completed" && (
                <>
                  {isReleased ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 13px", borderRadius: "9999px", fontSize: "12px", fontWeight: "700", color: "#065f46", background: "#f0fdf4", border: "1px solid #a7f3d0", whiteSpace: "nowrap" }}>
                      <CheckCircle size={11} /> Released
                    </span>
                  ) : (
                    <SmallBtn onClick={e => { e.stopPropagation(); releasePayment(task._id, task); }} color="#065f46" bg="#f0fdf4" border="#a7f3d0">
                      Release Payment
                    </SmallBtn>
                  )}
                  <SmallBtn onClick={e => { e.stopPropagation(); onRateReview(task); }} color="#b45309" bg="#fffbf2" border="#fde68a">
                    <Star size={11} fill="#f59e0b" color="#f59e0b" /> Rate
                  </SmallBtn>
                  <SmallBtn onClick={e => { e.stopPropagation(); onReport(task); }} color="#991b1b" bg="#fef2f2" border="#fecaca">
                    <Flag size={11} /> Report
                  </SmallBtn>
                </>
              )}
              {!["completed", "cancelled", "declined"].includes(task.status) && (
                <SmallBtn onClick={e => { e.stopPropagation(); setCancelTaskData(task); }} color="#991b1b" bg="#fef2f2" border="#fecaca">
                  Cancel
                </SmallBtn>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Pricing ── */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "5px", flexShrink: 0, width: "180px" }}>
          <div style={{ paddingLeft: 0, marginTop: 8, width: "100%" }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Estimated price</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{formatCurrency(task.workerEarnings || task.totalCost)}</div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Estimated hours</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: task.estimatedHours ? "#374151" : "#f59e0b" }}>
                {task.estimatedHours || "Not set yet"}
              </div>
            </div>
            <div style={{ borderTop: "1px dashed #e5e7eb", paddingTop: 10 }}>
              <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Total cost</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: task.totalCost ? "#f59e0b" : "#9ca3af" }}>
                {task.totalCost ? formatCurrency(task.totalCost) : "Pending"}
              </div>
            </div>
          </div>

          <button
            onClick={e => { e.stopPropagation(); handleViewDetails(task); }}
            style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", fontWeight: "700", color: hovered ? "#f6a623" : "#78716c", background: "none", border: "none", cursor: "pointer", transition: "color 0.15s", padding: 0, marginTop: "80px" }}
          >
            View Details <ChevronRight size={14} />
          </button>
        </div>

      </div>
    </div>
  );
};

// ── Task Detail Modal ─────────────────────────────────────────────────────────
const TaskModal = ({ task, worker, setShowDetailsModal }) => {
  const navigate = useNavigate();

  const timelineSteps = [
    { label: "Created",   field: "createdAt",   color: "#a8a29e" },
    { label: "Accepted",  field: "acceptedAt",  color: "#b45309" },
    { label: "Confirmed", field: "confirmedAt", color: "#6d28d9" },
    { label: "Started",   field: "startedAt",   color: "#1e40af" },
    { label: "Completed", field: "completedAt", color: "#065f46" },
    { label: "Declined",  field: "declinedAt",  color: "#991b1b" },
    { label: "Cancelled", field: "cancelledAt", color: "#991b1b" },
  ].filter(step => task[step.field]);

  const hourlyRate    = worker?.basePrice ?? worker?.hourlyRate ?? worker?.skills?.[0]?.price ?? null;
  const estimatedHours = task.estimatedHours || task.completionTime;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}
      onClick={() => setShowDetailsModal(false)}
    >
      <div
        style={{ background: "white", borderRadius: "20px", padding: "2rem", maxWidth: "520px", width: "90%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.15)" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "19px", fontWeight: "800", color: "#1c1008", margin: 0 }}>Task Details</h2>
          <button onClick={() => setShowDetailsModal(false)} style={{ background: "#f5efe6", border: "none", width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer", color: "#78716c", fontSize: "18px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "1.25rem" }}>
          <div style={{ width: "52px", height: "52px", background: "linear-gradient(135deg,#f6a623,#e8890c)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: "white", fontWeight: "800", flexShrink: 0, boxShadow: "0 3px 10px rgba(246,166,35,0.3)" }}>
            {worker?.firstName?.charAt(0) || "W"}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: "800", fontSize: "18px", color: "#1c1008" }}>
              {worker ? `${worker.firstName} ${worker.lastName}` : "Worker"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "2px" }}>
              <Star size={12} fill="#f59e0b" color="#f59e0b" />
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#1c1008" }}>{worker?.ratings ?? 0}</span>
              <span style={{ fontSize: "13px", color: "#a8a29e" }}>· {worker?.noOfCompletedTask || 0} jobs</span>
            </div>
            {worker && (
              <button
                onClick={() => { setShowDetailsModal(false); navigate(`/worker/${worker._id || worker.id}`); }}
                style={{ marginTop: "5px", fontSize: "12px", color: "#f6a623", background: "none", border: "none", cursor: "pointer", fontWeight: "700", padding: 0, textDecoration: "underline" }}
              >
                View Profile →
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "5px", flexShrink: 0 }}>
            <StatusBadge status={task.status} />
            {task.status === "confirmed" && task.paymentStatus !== "paid" && task.confirmedAt && (
              <PaymentDeadlineBadge confirmedAt={task.confirmedAt} />
            )}
          </div>
        </div>

        {(task.taskDescrip || task.taskName) && (
          <p style={{ fontSize: "14px", color: "#57534e", lineHeight: "1.7", margin: "0 0 1.5rem 0", fontStyle: "italic" }}>
            {task.taskDescrip || task.taskName}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", marginBottom: "1.25rem" }}>
          {[
            { icon: <Calendar size={15} color="#f6a623" />, label: "Date",            value: formatDate(task.serviceDate) },
            { icon: <Clock    size={15} color="#f6a623" />, label: "Est. Hours",      value: estimatedHours ? `${estimatedHours} hrs` : "Not set" },
            { icon: <MapPin   size={15} color="#f6a623" />, label: "Location",        value: task.address || "Not specified" },
            { icon: <Star     size={15} color="#f6a623" />, label: "Hourly Rate",     value: hourlyRate ? `NPR ${hourlyRate}/hr` : "Not set" },
            { icon: <Star     size={15} color="#f6a623" />, label: "Additional Cost", value: task.additionalCost != null && task.additionalCost > 0 ? `NPR ${task.additionalCost}` : "None" },
          ].map(({ icon, label, value }, i, arr) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "12px", paddingTop: "11px", paddingBottom: "11px", borderBottom: i < arr.length - 1 ? "1px solid #f5efe6" : "none" }}>
              <div style={{ width: "22px", display: "flex", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#a8a29e", width: "100px", flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
              <span style={{ fontSize: "14px", color: "#1c1008", fontWeight: "600" }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#fffbf2", borderRadius: "10px", border: "1px solid #fde68a", marginBottom: "1.25rem" }}>
          <span style={{ fontSize: "13px", fontWeight: "700", color: "#a8601a" }}>Total Amount</span>
          <span style={{ fontSize: "22px", fontWeight: "900", color: "#f6a623", letterSpacing: "-0.02em" }}>
            {task.totalCost ? `NPR ${task.totalCost}` : "NPR —"}
          </span>
        </div>

        {task.actualHours && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
            <span style={{ fontSize: "13px", fontWeight: "700", color: "#065f46" }}>Actual Hours Worked</span>
            <span style={{ fontSize: "15px", fontWeight: "800", color: "#065f46" }}>{task.actualHours} hrs</span>
          </div>
        )}

        {timelineSteps.length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <p style={{ fontSize: "11px", fontWeight: "700", color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 14px 0" }}>Timeline</p>
            <div style={{ position: "relative" }}>
              {timelineSteps.length > 1 && (
                <div style={{ position: "absolute", left: "5px", top: "10px", bottom: "10px", width: "2px", background: "#f5efe6", borderRadius: "2px" }} />
              )}
              {timelineSteps.map((step, i) => (
                <div key={i} style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: "14px", paddingLeft: "24px", marginBottom: i < timelineSteps.length - 1 ? "14px" : 0 }}>
                  <div style={{ position: "absolute", left: "0px", top: "4px", width: "12px", height: "12px", borderRadius: "50%", background: step.color, border: "2px solid white", boxShadow: `0 0 0 2px ${step.color}`, flexShrink: 0 }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: step.color }}>{step.label}</span>
                      <span style={{ fontSize: "12px", color: "#a8a29e" }}>
                        {new Date(task[step.field]).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {step.field === "cancelledAt" && task.cancelReason && (
                      <span style={{ fontSize: "12px", color: "#991b1b", background: "#fef2f2", padding: "4px 8px", borderRadius: "6px", border: "1px solid #fecaca", fontStyle: "italic" }}>
                        {task.cancelReason}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1.5px solid #e8dfd0", background: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", fontSize: "14px", fontWeight: "600", color: "#57534e", cursor: "pointer", transition: "all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "#f6a623"; e.currentTarget.style.color = "#f6a623"; e.currentTarget.style.background = "#fffbf2"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "#e8dfd0"; e.currentTarget.style.color = "#57534e"; e.currentTarget.style.background = "white"; }}
        >
          <MessageCircle size={15} /> Message Worker
        </button>
      </div>
    </div>
  );
};

// ── Cancel Task Modal ─────────────────────────────────────────────────────────
const CancelTaskModal = ({ task, onClose, onSubmit }) => {
  const [reason, setReason]         = useState("");
  const [photo, setPhoto]           = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);

  const taskIsPaid       = task.paymentStatus === "paid";
  const taskDatetime     = task.serviceDate
    ? new Date(`${task.serviceDate.split("T")[0]}T${task.serviceTime || "00:00"}`)
    : null;
  const hoursLeft        = taskDatetime ? (taskDatetime - Date.now()) / 3600000 : null;
  const penaltyWillApply = taskIsPaid && hoursLeft !== null && hoursLeft < 4;
  const totalCost        = task.totalCost || 0;

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Photo must be under 5 MB."); return; }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!reason.trim()) { setError("Please provide a reason."); return; }
    setSubmitting(true); setError(null);
    try {
      await onSubmit(reason, photo);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to cancel task");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, backdropFilter:"blur(4px)" }} onClick={onClose}>
      <div style={{ background:"white", borderRadius:"20px", padding:"1.8rem", maxWidth:"420px", width:"90%", boxShadow:"0 24px 60px rgba(0,0,0,0.15)", maxHeight:"90vh", overflowY:"auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
          <h2 style={{ fontSize:"18px", fontWeight:"800", margin:0, color:"#1c1008" }}>Cancel Task</h2>
          <button onClick={onClose} style={{ background:"#f5efe6", border:"none", width:"30px", height:"30px", borderRadius:"50%", cursor:"pointer", color:"#78716c", fontSize:"16px", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>

        {penaltyWillApply && (
          <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:"12px", padding:"12px 14px", marginBottom:"14px" }}>
            <p style={{ margin:0, fontSize:"13px", fontWeight:"700", color:"#991b1b" }}>⚠️ Cancellation Fee Applies</p>
            <p style={{ margin:"6px 0 0", fontSize:"13px", color:"#7f1d1d", lineHeight:"1.55" }}>
              Cancelling within 4 hours of the scheduled time. A <strong>25% penalty (NPR {(totalCost * 0.25).toFixed(2)})</strong> will be paid to the worker.
              You'll receive a <strong>75% refund (NPR {(totalCost * 0.75).toFixed(2)})</strong>.
            </p>
          </div>
        )}

        {taskIsPaid && !penaltyWillApply && (
          <div style={{ background:"#f0fdf4", border:"1px solid #a7f3d0", borderRadius:"12px", padding:"12px 14px", marginBottom:"14px" }}>
            <p style={{ margin:0, fontSize:"13px", fontWeight:"700", color:"#065f46" }}>✅ Full Refund</p>
            <p style={{ margin:"6px 0 0", fontSize:"13px", color:"#064e3b", lineHeight:"1.55" }}>
              Cancelling more than 4 hours before the scheduled time — a <strong>full refund of NPR {totalCost.toFixed(2)}</strong> will be processed.
            </p>
          </div>
        )}

        <p style={{ fontSize:"12px", fontWeight:"700", color:"#a8a29e", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"6px" }}>Reason for cancellation</p>
        <textarea
          value={reason} onChange={e => setReason(e.target.value)} rows={3}
          placeholder="Describe why you're cancelling…"
          style={{ width:"100%", padding:"10px", borderRadius:"10px", border:"1.5px solid #e8dfd0", fontSize:"14px", outline:"none", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box", marginBottom:"14px", transition:"border-color 0.2s" }}
          onFocus={e => e.target.style.borderColor = "#f6a623"}
          onBlur={e  => e.target.style.borderColor = "#e8dfd0"}
        />

        <p style={{ fontSize:"12px", fontWeight:"700", color:"#a8a29e", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"6px" }}>Photo evidence <span style={{ fontWeight:"400", textTransform:"none" }}>(optional)</span></p>

        {photoPreview ? (
          <div style={{ position:"relative", marginBottom:"12px" }}>
            <img src={photoPreview} alt="evidence" style={{ width:"100%", maxHeight:"140px", objectFit:"cover", borderRadius:"10px", border:"1px solid #e8dfd0" }} />
            <button
              onClick={() => { setPhoto(null); setPhotoPreview(null); }}
              style={{ position:"absolute", top:"6px", right:"6px", background:"rgba(0,0,0,0.55)", border:"none", borderRadius:"50%", width:"24px", height:"24px", cursor:"pointer", color:"white", fontSize:"14px", display:"flex", alignItems:"center", justifyContent:"center" }}
            >×</button>
          </div>
        ) : (
          <label style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"6px", padding:"18px 12px", borderRadius:"10px", border:"1.5px dashed #e8dfd0", cursor:"pointer", marginBottom:"12px", fontSize:"13px", color:"#a8a29e", textAlign:"center", transition:"border-color 0.2s", boxSizing:"border-box", width:"100%" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#f6a623"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "#e8dfd0"}
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M3 16v3a2 2 0 002 2h14a2 2 0 002-2v-3M12 3v13M8 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Tap to upload a photo
            <span style={{ fontSize:"11px", opacity:0.6 }}>JPG, PNG — max 5 MB</span>
            <input type="file" accept="image/*" style={{ display:"none" }} onChange={handlePhotoChange} />
          </label>
        )}

        {error && <p style={{ color:"#dc2626", fontSize:"12px", marginBottom:"10px" }}>{error}</p>}

        <div style={{ display:"flex", gap:"8px", marginTop:"4px" }}>
          <button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:"10px", border:"1.5px solid #e8dfd0", background:"white", cursor:"pointer", fontSize:"14px", fontWeight:"600", color:"#78716c" }}>
            Keep Task
          </button>
          <button
            onClick={handleSubmit} disabled={submitting}
            style={{ flex:2, padding:"10px", borderRadius:"10px", border:"none", background: penaltyWillApply ? "linear-gradient(135deg,#dc2626,#b91c1c)" : "#dc2626", color:"white", fontWeight:"700", cursor:submitting?"default":"pointer", opacity:submitting?0.7:1, fontSize:"14px" }}
          >
            {submitting ? "Cancelling…" : penaltyWillApply ? `Cancel (NPR ${(totalCost * 0.25).toFixed(2)} fee)` : "Confirm Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
};



// ── Main Page ─────────────────────────────────────────────────────────────────
const CustomerTaskPage = () => {
  const navigate = useNavigate();
  const [tasks, setTasks]               = useState([]);
  const [workers, setWorkers]           = useState({});
  const [loading, setLoading]           = useState(true);
  const [releasing, setReleasing]       = useState(false);
  const [error, setError]               = useState(null);
  const [searchQuery, setSearchQuery]   = useState("");
  const [activeTab, setActiveTab]       = useState("pending");
  const [selectedTask, setSelectedTask] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [hoveredButton, setHoveredButton]       = useState(null);
  const [rateReviewTask, setRateReviewTask]     = useState(null);
  const [reportTask, setReportTask]             = useState(null);
  const [successMsg, setSuccessMsg]             = useState(null);
  const [cancelTaskData, setCancelTaskData]     = useState(null);
  const [releaseTaskData, setReleaseTaskData]   = useState(null);
  const [paymentModal, setPaymentModal]         = useState(null);

  const { toasts, add: addToast, remove: removeToast } = useToast();

  const storedUser  = localStorage.getItem("user") || sessionStorage.getItem("user");
  const currentUser = storedUser ? JSON.parse(storedUser) : null;
  const customerId  = currentUser?.id || currentUser?._id;

  const showSuccess = msg => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3500); };

  const openPaymentModal  = (taskId, workerId, cid) => setPaymentModal({ taskId, userId: cid, role: "customer" });
  const navigateToChat    = (taskId, workerId)      => navigate(`/chat/${workerId}/${taskId}`);

  const fetchTasks = useCallback(async (opts = {}) => {
    if (!customerId) return;
    try {
      await Promise.all([autoCancelExpiredTasks(), autoCancelConfirmedUnpaidTasks()]);

      const res  = await fetch(`${API_BASE}/tasks/user/${customerId}`);
      if (!res.ok) throw new Error(`Failed to fetch tasks (${res.status})`);
      const data = await res.json();
      const fetched = (data.tasks || []).map(t => ({ ...t, _id: String(t._id || t.id || "") }));
      setTasks([...fetched].reverse());

      if (opts.syncSelected) {
        setSelectedTask(prev => {
          if (!prev) return prev;
          return fetched.find(t => t._id === prev._id) || prev;
        });
      }

      const ids = [...new Set(fetched.map(t => t.assignedWorkerId).filter(Boolean))];
      const map = {};
      await Promise.all(ids.map(async id => {
        try {
          const r = await fetch(`${API_BASE}/worker/${id}`);
          const w = await r.json();
          map[id] = w.worker || w;
        } catch {}
      }));
      setWorkers(prev => ({ ...prev, ...map }));
    } catch (err) {
      if (opts.initial) setError(err.message);
    } finally {
      if (opts.initial) setLoading(false);
    }
  }, [customerId]);
  
  useEffect(() => { fetchTasks({ initial: true }); }, [fetchTasks]);

  useEffect(() => {
    const handle = () => { if (document.visibilityState === "visible") fetchTasks({ syncSelected: true }); };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, [fetchTasks]);

  const handleWsMessage = useCallback((data) => {
    if (data.type !== "task_status") return;
    fetchTasks({ syncSelected: true });
    const toast = makeToast(data.status, data.taskName || null);
    if (toast) addToast(toast);
  }, [fetchTasks, addToast]);

  const wsUrl = customerId ? `ws://127.0.0.1:8000/ws/task-updates/${customerId}` : null;
  useReconnectingWebSocket(wsUrl, handleWsMessage);

  useEffect(() => {
    let unsubscribe = () => {};
    const setup = async () => {
      try {
        const { initMessaging } = await import("../../api/notification");
        const { onMessage }     = await import("firebase/messaging");
        const messaging = await initMessaging();
        if (!messaging) return;
        unsubscribe = onMessage(messaging, (payload) => {
          fetchTasks({ syncSelected: true });
          const status   = payload.data?.status   || null;
          const taskName = payload.data?.taskName || payload.notification?.title || null;
          if (status) {
            const toast = makeToast(status, taskName);
            if (toast) addToast(toast);
          } else {
            addToast({ color: "#f6a623", message: payload.notification?.body || "You have a new notification." });
          }
        });
      } catch (err) {
        console.error("[FCM] Foreground listener setup failed:", err);
      }
    };
    setup();
    return () => unsubscribe();
  }, [fetchTasks, addToast]);

  const releasePayment = (taskId, task) => {
    setReleaseTaskData(task || tasks.find(t => t._id === taskId) || { _id: taskId });
  };

  const confirmReleasePayment = async () => {
    if (!releaseTaskData) return;
    setReleasing(true);
    try {
      const res  = await fetch(`http://localhost:8000/customer/release/${releaseTaskData._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentUser?.token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to release payment");
      setReleaseTaskData(null);
      await fetchTasks({ syncSelected: true });
      addToast({ color: "#065f46", message: `Payment released! Reference: ${data.esewa_ref_id}` });
    } catch (err) {
      addToast({ color: "#991b1b", message: "Error: " + err.message });
    } finally {
      setReleasing(false);
    }
  };

  const cancelTask = async (taskId, reason, photo) => {
  let evidenceUrl = null;

  // Upload photo first if provided
  if (photo) {
    const form = new FormData();
    form.append("file", photo);
    try {
      const uploadRes = await fetch(`${API_BASE}/upload`, { method: "POST", body: form });
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        evidenceUrl = uploadData.url || uploadData.file_url || null;
      }
    } catch { /* proceed without photo */ }
  }

  const res = await fetch(`${API_BASE}/task/${taskId}/cancel`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cancelled_by: "customer",
      reason: reason,
      ...(evidenceUrl ? { evidenceUrl } : {}),
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to cancel task");
  await fetchTasks({ syncSelected: true });

  if (data.penaltyAmount > 0) addToast({ color: "#991b1b", message: `Task cancelled. Refund: NPR ${data.refundAmount?.toFixed(2)} (penalty: NPR ${data.penaltyAmount?.toFixed(2)}).` });
  else if (data.refundAmount > 0) addToast({ color: "#065f46", message: `Task cancelled. Full refund of NPR ${data.refundAmount?.toFixed(2)} will be processed.` });
  else addToast({ color: "#991b1b", message: "Task cancelled successfully." });
};

  const handleViewDetails = task => { setSelectedTask(task); setShowDetailsModal(true); };

  const filteredTasks = tasks.filter(t => {
  const q = searchQuery.toLowerCase();
  const escrowStatus = String(t?.escrow_status || "").toLowerCase().trim();

  const worker = workers[t.assignedWorkerId];

  const workerName = worker
    ? `${worker.firstName || ""} ${worker.lastName || ""}`.toLowerCase()
    : "";

  const matchesSearch =
    t.taskName?.toLowerCase().includes(q) ||
    t.taskDescrip?.toLowerCase().includes(q) ||
    workerName.includes(q);
    if (activeTab === "released") {
      return matchesSearch && t.status === "completed" && escrowStatus === "released";
    }
    return matchesSearch && (activeTab === "all" || (t.status || "pending") === activeTab);
  });

  const taskCounts = tasks.reduce((acc, t) => {
    const s = t.status || "pending";
    acc[s] = (acc[s] || 0) + 1;
    const escrowStatus = String(t?.escrow_status || "").toLowerCase().trim();
    if (t.status === "completed" && escrowStatus === "released") {
      acc["released"] = (acc["released"] || 0) + 1;
    }
    return acc;
  }, {});

  const TABS = [
    { id: "all",         label: "All"         },
    { id: "pending",     label: "Pending"     },
    { id: "confirmed",   label: "Confirmed"   },
    { id: "in_progress", label: "In Progress" },
    { id: "completed",   label: "Completed"   },
    { id: "released",    label: "Released"    },
    { id: "cancelled",   label: "Cancelled"   },
    { id: "declined",    label: "Declined"    },
  ];

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#faf7ee" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: "40px", height: "40px", border: "3px solid #ece6d9", borderTop: "3px solid #f6a623", borderRadius: "50%", animation: "spin 0.75s linear infinite", margin: "0 auto" }} />
        <p style={{ marginTop: "12px", color: "#a8a29e", fontWeight: "600", fontSize: "14px" }}>Loading your tasks…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#faf7ee" }}>
      <div style={{ background: "white", borderRadius: "14px", padding: "2rem", maxWidth: "340px", textAlign: "center", border: "1px solid #ece6d9" }}>
        <XCircle size={44} color="#ef4444" />
        <h3 style={{ marginTop: "1rem", fontWeight: "800", color: "#1c1008" }}>Something went wrong</h3>
        <p style={{ color: "#78716c", marginTop: "6px", fontSize: "14px" }}>{error}</p>
        <button onClick={() => navigate("/login")} style={{ marginTop: "1rem", padding: "10px 20px", background: "#f6a623", color: "white", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer", fontSize: "14px" }}>
          Go to Login
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#faf7ee", fontFamily: '"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <BookingNavbar />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {successMsg && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 9999, background: "#1c1008", color: "white", padding: "12px 18px", borderRadius: "12px", fontSize: "13px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
          <CheckCircle size={15} color="#34d399" /> {successMsg}
        </div>
      )}

      {releasing && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "white", borderRadius: "16px", padding: "2rem", textAlign: "center", boxShadow: "0 24px 48px rgba(0,0,0,0.2)" }}>
            <div style={{ width: "36px", height: "36px", border: "3px solid #ece6d9", borderTop: "3px solid #f6a623", borderRadius: "50%", animation: "spin 0.75s linear infinite", margin: "0 auto" }} />
            <p style={{ marginTop: "1rem", fontWeight: "800", color: "#1c1008" }}>Releasing payment…</p>
            <p style={{ color: "#a8a29e", fontSize: "13px", marginTop: "4px" }}>Please don't close this page</p>
          </div>
        </div>
      )}

      <main style={{ maxWidth: "1250px", margin: "0 auto", padding: "2.5rem 1.5rem" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "900", color: "#1c1008", marginBottom: "4px", letterSpacing: "-0.02em" }}>My Tasks</h1>
        <p style={{ fontSize: "14px", color: "#a8a29e", fontWeight: "500", marginBottom: "1.75rem" }}>View and manage your service requests</p>

        <div style={{ position: "relative", maxWidth: "320px", marginBottom: "1.25rem" }}>
          <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#a8a29e" }} />
          <input
            type="text" placeholder="Search tasks…" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: "650px", padding: "10px 14px 10px 36px", borderRadius: "9px", border: "1.5px solid #e8dfd0", fontSize: "14px", outline: "none", background: "white", boxSizing: "border-box", color: "#1c1008", transition: "border-color 0.2s" }}
            onFocus={e => e.target.style.borderColor = "#f6a623"}
            onBlur={e  => e.target.style.borderColor = "#e8dfd0"}
          />
        </div>

        <div style={{ display: "flex", gap: "6px", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            const count  = tab.id !== "all" ? taskCounts[tab.id] : null;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ padding: "7px 16px", borderRadius: "9999px", fontWeight: "700", fontSize: "13px", border: active ? "none" : "1.5px solid #e8dfd0", background: active ? "#1c1008" : "white", color: active ? "white" : "#78716c", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", transition: "all 0.15s" }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = "#f6a623"; e.currentTarget.style.color = "#f6a623"; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = "#e8dfd0"; e.currentTarget.style.color = "#78716c"; } }}
              >
                {tab.label}
                {count > 0 && (
                  <span style={{ background: active ? "rgba(255,255,255,0.18)" : "#f5efe6", borderRadius: "9999px", padding: "1px 7px", fontSize: "11px", fontWeight: "800", color: active ? "white" : "#b45309" }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {filteredTasks.length === 0 ? (
          <div style={{ textAlign: "center", padding: "56px 24px", background: "white", borderRadius: "14px", border: "1px dashed #e8dfd0" }}>
            <p style={{ color: "#a8a29e", fontWeight: "600", fontSize: "14px" }}>No tasks found for this filter.</p>
          </div>
        ) : (
          filteredTasks.map(task => (
            <TaskCard
              key={String(task._id || task.id)}
              activeTab={activeTab}
              task={task}
              worker={workers[task.assignedWorkerId]}
              handleViewDetails={handleViewDetails}
              openPaymentModal={openPaymentModal}
              navigateToChat={navigateToChat}
              releasePayment={releasePayment}
              customerId={customerId}
              onRateReview={setRateReviewTask}
              onReport={setReportTask}
              setCancelTaskData={setCancelTaskData}
            />
          ))
        )}
      </main>

      {paymentModal && (
        <PaymentFlow
          taskIdProp={paymentModal.taskId}
          userIdProp={paymentModal.userId}
          roleProp={paymentModal.role}
          onClose={() => { setPaymentModal(null); fetchTasks({ syncSelected: true }); }}
        />
      )}

      {showDetailsModal && selectedTask && (
        <TaskModal
          task={selectedTask}
          worker={workers[selectedTask.assignedWorkerId]}
          setShowDetailsModal={setShowDetailsModal}
          hoveredButton={hoveredButton}
          setHoveredButton={setHoveredButton}
        />
      )}
      {rateReviewTask && (
        <RateReviewModal
          task={rateReviewTask}
          worker={workers[rateReviewTask.assignedWorkerId]}
          customerId={customerId}
          onClose={() => setRateReviewTask(null)}
          onSubmitted={() => showSuccess("Review submitted!")}
        />
      )}
      {reportTask && (
        <ReportModal
          task={reportTask}
          worker={workers[reportTask.assignedWorkerId]}
          customerId={customerId}
          onClose={() => setReportTask(null)}
          onSubmitted={() => showSuccess("Report submitted. We'll review it.")}
        />
      )}
      {cancelTaskData && (
        <CancelTaskModal
  task={cancelTaskData}
  onClose={() => setCancelTaskData(null)}
  onSubmit={(reason, photo) => cancelTask(cancelTaskData._id, reason, photo)}
/>
      )}
      {releaseTaskData && (
        <ReleasePaymentModal
          task={releaseTaskData}
          releasing={releasing}
          onClose={() => setReleaseTaskData(null)}
          onConfirm={confirmReleasePayment}
        />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

export default CustomerTaskPage;