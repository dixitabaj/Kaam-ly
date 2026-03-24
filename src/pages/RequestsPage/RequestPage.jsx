import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Search, Calendar, MapPin, Clock, ChevronRight, Star,
  Phone, Mail, MessageCircle, XCircle, CheckCircle,
  Flag, User, X
} from "lucide-react";
import BookingNavbar from "../../components/Navbar/Navbar";
import { useNavigate } from "react-router-dom";
import ReportModal from "../../components/Report/ReportSection";

// ── No top-level firebase imports — use dynamic imports inside useEffect ───────
// This prevents the "does not provide an export named 'messaging'" crash.

const API_BASE = "http://127.0.0.1:8000/api";

// ── Toast ─────────────────────────────────────────────────────────────────────
const makeToast = (status, taskName) => {
  const label = taskName ? `"${taskName}"` : "Your task";
  const map = {
    confirmed:   { color: "#6d28d9", message: `${label} has been confirmed.` },
    in_progress: { color: "#1e40af", message: `A worker has started ${label}.` },
    completed:   { color: "#065f46", message: `${label} has been completed.` },
    cancelled:   { color: "#991b1b", message: `${label} was cancelled.` },
    declined:    { color: "#991b1b", message: `${label} was declined.` },
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

const formatDate = (dateStr) => {
  if (!dateStr) return "Date not set";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch { return dateStr; }
};

// ── Rate & Review Modal ───────────────────────────────────────────────────────
const RateReviewModal = ({ task, worker, customerId, onClose, onSubmitted }) => {
  const [rating, setRating]     = useState(0);
  const [hover, setHover]       = useState(0);
  const [comment, setComment]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState(null);

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

// ── Task Card ─────────────────────────────────────────────────────────────────
const TaskCard = ({ activeTab, task, worker, handleViewDetails, navigateToPayment, releasePayment, customerId, navigateToChat, onRateReview, onReport }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div onClick={()=>handleViewDetails(task)} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      style={{ background:"white", borderRadius:"14px", border:`1px solid ${hovered?"#f6a623":"#ece6d9"}`, padding:"1.25rem 1.5rem", marginBottom:"12px", transition:"all 0.18s ease", cursor:"pointer", boxShadow:hovered?"0 6px 20px rgba(246,166,35,0.12)":"0 1px 6px rgba(0,0,0,0.05)", transform:hovered?"translateY(-1px)":"none" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"10px" }}>
        <div style={{ width:"52px", height:"52px", background:"linear-gradient(135deg,#f6a623,#e8890c)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", color:"white", fontWeight:"800", flexShrink:0, boxShadow:"0 3px 10px rgba(246,166,35,0.3)" }}>
          {worker?.firstName?.charAt(0)||<User size={18} color="white"/>}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:"800", fontSize:"18px", color:"#1c1008", marginBottom:"2px" }}>
            {worker?`${worker.firstName} ${worker.lastName}`:"Worker"}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"5px" }}>
            <Star size={16} fill="#f59e0b" color="#f59e0b"/>
            <span style={{ fontSize:"13px", fontWeight:"700", color:"#1c1008" }}>{worker?.ratings??0}</span>
            <span style={{ fontSize:"13px", color:"#a8a29e" }}>({worker?.noOfCompletedTask||0} jobs)</span>
            {worker?.specialization&&<span style={{ fontSize:"12px", color:"#a8a29e" }}>· {worker.specialization}</span>}
          </div>
        </div>
        <StatusBadge status={task.status}/>
      </div><span style={{ fontSize: "12px", fontWeight: "700", color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 4px 60px" }}>
  Task Details
</span>
{task.taskDescrip && (
  <p style={{
    fontSize: "13px", color: "#78716c", lineHeight: "1.55",
    margin: "0 0 12px 60px", fontStyle: "italic",
  }}>
    {task.taskDescrip}
  </p>
)}
      <div style={{ paddingLeft:"64px", marginBottom:"12px" }}>
  <div style={{ marginBottom:"8px" }}>
    <MetaItem icon={<MapPin size={13} color="#f6a623"/>} value={task.address||"Location not set"}/>
  </div>
  <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:"16px" }}>
    <MetaItem icon={<Calendar size={13} color="#f6a623"/>} value={formatDate(task.serviceDate)}/>
    <div>
    <MetaItem icon={<Clock size={13} color="#f6a623"/>} value={task.completionTime ? `${task.completionTime} hours` : "Not set"}/>
    </div>
   {task.totalCost > 0 && <span style={{ marginLeft:"auto", fontSize:"22px", fontWeight:"900", color:"#1c1008", letterSpacing:"-0.02em" }}>NPR {task.totalCost}</span>}
  </div>
</div>
      <div style={{ display:"flex", alignItems:"center", gap:"8px", paddingLeft:"64px", flexWrap:"wrap" }}>
        {activeTab==="confirmed"&&(<>
          <SmallBtn onClick={e=>{e.stopPropagation();navigateToPayment(task._id,task.assignedWorkerId,customerId);}} color="#f6a623" bg="#fffbf2" border="#fde68a">Make Payment</SmallBtn>
          <SmallBtn onClick={e=>{e.stopPropagation();navigateToChat(task._id,task.assignedWorkerId);}} color="#f6a623" bg="#fffbf2" border="#fde68a">Chat</SmallBtn>
        </>)}
        {activeTab==="in_progress"&&<SmallBtn onClick={e=>{e.stopPropagation();navigateToPayment(task._id,task.assignedWorkerId,customerId);}} color="#1e40af" bg="#eff6ff" border="#bfdbfe">View Payment</SmallBtn>}
        {activeTab==="completed"&&<SmallBtn onClick={e=>{e.stopPropagation();releasePayment(task._id);}} color="#065f46" bg="#f0fdf4" border="#a7f3d0">Release Payment</SmallBtn>}
        {activeTab==="completed"&&<SmallBtn onClick={e=>{e.stopPropagation();onRateReview(task);}} color="#b45309" bg="#fffbf2" border="#fde68a"><Star size={11} fill="#f59e0b" color="#f59e0b"/> Rate</SmallBtn>}
        {activeTab==="completed"&&<SmallBtn onClick={e=>{e.stopPropagation();onReport(task);}} color="#991b1b" bg="#fef2f2" border="#fecaca"><Flag size={11}/> Report</SmallBtn>}
        <button onClick={e=>{e.stopPropagation();handleViewDetails(task);}}
          style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:"4px", fontSize:"13px", fontWeight:"700", color:hovered?"#f6a623":"#78716c", background:"none", border:"none", cursor:"pointer", transition:"color 0.15s", padding:0 }}>
          View Details <ChevronRight size={14}/>
        </button>
      </div>
    </div>
  );
};

const MetaItem = ({ icon, value }) => (
  <div style={{ display:"flex", alignItems:"center", gap:"5px", fontSize:"15px", color:"#57534e", fontWeight:"500" }}>{icon} {value}</div>
);

const SmallBtn = ({ onClick, color, bg, border, children }) => (
  <button onClick={onClick}
    style={{ display:"inline-flex", alignItems:"center", gap:"4px", padding:"6px 13px", borderRadius:"9999px", fontSize:"12px", fontWeight:"700", color, background:bg, border:`1px solid ${border}`, cursor:"pointer", transition:"opacity 0.15s", whiteSpace:"nowrap" }}
    onMouseEnter={e=>e.currentTarget.style.opacity="0.8"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
    {children}
  </button>
);

// ── Task Detail Modal ─────────────────────────────────────────────────────────
// ── Task Card ─────────────────────────────────────────────────────────────────


// ── Task Detail Modal ─────────────────────────────────────────────────────────
const TaskModal = ({ task, worker, setShowDetailsModal }) => (
  <div
    style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}
    onClick={() => setShowDetailsModal(false)}
  >
    <div
      style={{ background: "white", borderRadius: "20px", padding: "2rem", maxWidth: "520px", width: "90%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.15)" }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "19px", fontWeight: "800", color: "#1c1008", margin: 0 }}>Task Details</h2>
        <button
          onClick={() => setShowDetailsModal(false)}
          style={{ background: "#f5efe6", border: "none", width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer", color: "#78716c", fontSize: "16px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}
        >×</button>
      </div>

      {/* Worker info */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "1.25rem" }}>
        <div style={{ width: "52px", height: "52px", background: "linear-gradient(135deg,#f6a623,#e8890c)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: "white", fontWeight: "800", flexShrink: 0, boxShadow: "0 3px 10px rgba(246,166,35,0.3)" }}>
          {worker?.firstName?.charAt(0) || "W"}
        </div>
        <div>
          <div style={{ fontWeight: "800", fontSize: "18px", color: "#1c1008" }}>{worker ? `${worker.firstName} ${worker.lastName}` : "Worker"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "2px" }}>
            <Star size={12} fill="#f59e0b" color="#f59e0b" />
            <span style={{ fontSize: "13px", fontWeight: "700", color: "#1c1008" }}>{worker?.ratings ?? 0}</span>
            <span style={{ fontSize: "13px", color: "#a8a29e" }}>· {worker?.noOfCompletedTask || 0} jobs</span>
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}><StatusBadge status={task.status} /></div>
      </div>

      {/* Description */}
      <p style={{ fontSize: "14px", color: "#57534e", lineHeight: "1.7", marginBottom: "1.5rem" }}>
        {task.taskDescrip || task.taskName || "No description provided"}
      </p>

      {/* Details — inline list, no grid boxes */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "1.5rem" }}>
        {[
          { icon: <Calendar size={14} color="#f6a623" />, label: "Date", value: formatDate(task.serviceDate) },
{ icon: <Clock size={14} color="#f6a623" />, label: "Est. Hours", value: task.completionTime ? `${task.completionTime} hours` : "Not set" },
{ icon: <MapPin size={14} color="#f6a623" />, label: "Location", value: task.address || "Not specified" },
{ icon: <Star size={14} color="#f6a623" />, label: "Hourly Rate", value: worker?.hourlyRate ? `NPR ${worker.hourlyRate}/hr` : "Not set" },
].map(({ icon, label, value }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {icon}
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#a8a29e", width: "64px", flexShrink: 0 }}>{label}</span>
            <span style={{ fontSize: "14px", color: "#1c1008", fontWeight: "600" }}>{value}</span>
          </div>
        ))}
        {/* Amount highlighted separately */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "6px", padding: "12px 16px", background: "#fffbf2", borderRadius: "10px", border: "1px solid #fde68a" }}>
          <span style={{ fontSize: "13px", fontWeight: "700", color: "#a8601a" }}>Total Amount</span>
          <span style={{ fontSize: "20px", fontWeight: "900", color: "#f6a623", letterSpacing: "-0.02em" }}>NPR {task.totalCost || "—"}</span>
        </div>
      </div>

      {/* Single action — Message only */}
      <button
        style={{ width: "100%", padding: "11px", borderRadius: "10px", border: "1.5px solid #e8dfd0", background: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", fontSize: "14px", fontWeight: "600", color: "#57534e", cursor: "pointer", transition: "all 0.15s" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#f6a623"; e.currentTarget.style.color = "#f6a623"; e.currentTarget.style.background = "#fffbf2"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#e8dfd0"; e.currentTarget.style.color = "#57534e"; e.currentTarget.style.background = "white"; }}
      >
        <MessageCircle size={15} /> Message Worker
      </button>
    </div>
  </div>
);

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

  const { toasts, add: addToast, remove: removeToast } = useToast();

  const storedUser  = localStorage.getItem("user") || sessionStorage.getItem("user");
  const currentUser = storedUser ? JSON.parse(storedUser) : null;
  const customerId  = currentUser?.id || currentUser?._id;

  const showSuccess       = msg => { setSuccessMsg(msg); setTimeout(()=>setSuccessMsg(null), 3500); };
  const navigateToPayment = (taskId,workerId,cid) => navigate(`/customer/pay/${taskId}/${workerId}/${cid}/customer`);
  const navigateToChat    = (taskId, workerId)    => navigate(`/chat/${workerId}/${taskId}`);

  // ── Fetch tasks ───────────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async (opts = {}) => {
    if (!customerId) return;
    try {
      const res  = await fetch(`${API_BASE}/tasks/user/${customerId}`);
      if (!res.ok) throw new Error(`Failed to fetch tasks (${res.status})`);
      const data = await res.json();
      const fetched = (data.tasks || []).map(t => ({ ...t, _id: String(t._id || t.id || "") }));
      setTasks(fetched);
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

  // Re-fetch when tab becomes visible
  useEffect(() => {
    const handle = () => {
      if (document.visibilityState === "visible") fetchTasks({ syncSelected: true });
    };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, [fetchTasks]);

  // ── WebSocket ─────────────────────────────────────────────────────────────────
  const handleWsMessage = useCallback((data) => {
    if (data.type !== "task_status") return;
    fetchTasks({ syncSelected: true });
    const toast = makeToast(data.status, data.taskName || null);
    if (toast) addToast(toast);
  }, [fetchTasks, addToast]);

  const wsUrl = customerId ? `ws://127.0.0.1:8000/ws/task-updates/${customerId}` : null;
  useReconnectingWebSocket(wsUrl, handleWsMessage);

  // ── Firebase foreground listener (dynamic import — no top-level messaging) ────
  // SW handles background/closed-tab automatically.
  useEffect(() => {
    let unsubscribe = () => {};

    const setup = async () => {
      try {
        const { initMessaging } = await import("../../api/firebase");
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
            addToast({
              color:   "#f6a623",
              message: payload.notification?.body || "You have a new notification.",
            });
          }
        });
      } catch (err) {
        console.error("[FCM] Foreground listener setup failed:", err);
      }
    };

    setup();
    return () => unsubscribe();
  }, [fetchTasks, addToast]);

  // ── Release payment ───────────────────────────────────────────────────────────
  const releasePayment = async (taskId) => {
    if (!window.confirm("Confirm the work is done? This will release payment to the worker.")) return;
    setReleasing(true);
    try {
      const res  = await fetch(`http://localhost:8000/customer/release/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentUser?.token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to release payment");
      await fetchTasks({ syncSelected: true });
      alert(`Payment released!\nReference: ${data.esewa_ref_id}`);
    } catch(err) {
      alert("Error: " + err.message);
    } finally {
      setReleasing(false);
    }
  };

  const handleViewDetails = task => { setSelectedTask(task); setShowDetailsModal(true); };

  const filteredTasks = tasks.filter(t => {
    const q = searchQuery.toLowerCase();
    return (t.taskName?.toLowerCase().includes(q) || t.taskDescrip?.toLowerCase().includes(q)) &&
           (activeTab === "all" || (t.status || "pending") === activeTab);
  });

  const taskCounts = tasks.reduce((acc, t) => {
    const s = t.status || "pending";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const TABS = [
    { id:"all",         label:"All"         },
    { id:"pending",     label:"Pending"     },
    { id:"confirmed",   label:"Confirmed"   },
    { id:"in_progress", label:"In Progress" },
    { id:"completed",   label:"Completed"   },
    { id:"cancelled",   label:"Cancelled"   },
    { id:"declined",    label:"Declined"    },
  ];

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#faf7ee"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:"40px",height:"40px",border:"3px solid #ece6d9",borderTop:"3px solid #f6a623",borderRadius:"50%",animation:"spin 0.75s linear infinite",margin:"0 auto"}}/>
        <p style={{marginTop:"12px",color:"#a8a29e",fontWeight:"600",fontSize:"14px"}}>Loading your tasks…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#faf7ee"}}>
      <div style={{background:"white",borderRadius:"14px",padding:"2rem",maxWidth:"340px",textAlign:"center",border:"1px solid #ece6d9"}}>
        <XCircle size={44} color="#ef4444"/>
        <h3 style={{marginTop:"1rem",fontWeight:"800",color:"#1c1008"}}>Something went wrong</h3>
        <p style={{color:"#78716c",marginTop:"6px",fontSize:"14px"}}>{error}</p>
        <button onClick={()=>navigate("/login")}
          style={{marginTop:"1rem",padding:"10px 20px",background:"#f6a623",color:"white",border:"none",borderRadius:"8px",fontWeight:"700",cursor:"pointer",fontSize:"14px"}}>
          Go to Login
        </button>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#faf7ee",fontFamily:'"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'}}>
      <BookingNavbar/>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {successMsg && (
        <div style={{position:"fixed",bottom:"24px",right:"24px",zIndex:9999,background:"#1c1008",color:"white",padding:"12px 18px",borderRadius:"12px",fontSize:"13px",fontWeight:"600",display:"flex",alignItems:"center",gap:"8px",boxShadow:"0 8px 24px rgba(0,0,0,0.18)"}}>
          <CheckCircle size={15} color="#34d399"/> {successMsg}
        </div>
      )}

      {releasing && (
        <div style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(15,23,42,0.55)",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}}>
          <div style={{background:"white",borderRadius:"16px",padding:"2rem",textAlign:"center",boxShadow:"0 24px 48px rgba(0,0,0,0.2)"}}>
            <div style={{width:"36px",height:"36px",border:"3px solid #ece6d9",borderTop:"3px solid #f6a623",borderRadius:"50%",animation:"spin 0.75s linear infinite",margin:"0 auto"}}/>
            <p style={{marginTop:"1rem",fontWeight:"800",color:"#1c1008"}}>Releasing payment…</p>
            <p style={{color:"#a8a29e",fontSize:"13px",marginTop:"4px"}}>Please don't close this page</p>
          </div>
        </div>
      )}

      <main style={{maxWidth:"1300px",margin:"0 auto",padding:"2.5rem 1.5rem"}}>
        <h1 style={{fontSize:"28px",fontWeight:"900",color:"#1c1008",marginBottom:"4px",letterSpacing:"-0.02em"}}>My Tasks</h1>
        <p style={{fontSize:"14px",color:"#a8a29e",fontWeight:"500",marginBottom:"1.75rem"}}>View and manage your service requests</p>

        <div style={{position:"relative",maxWidth:"320px",marginBottom:"1.25rem"}}>
          <Search size={14} style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"#a8a29e"}}/>
          <input type="text" placeholder="Search tasks…" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
            style={{width:"100%",padding:"10px 14px 10px 36px",borderRadius:"9px",border:"1.5px solid #e8dfd0",fontSize:"14px",outline:"none",background:"white",boxSizing:"border-box",color:"#1c1008",transition:"border-color 0.2s"}}
            onFocus={e=>e.target.style.borderColor="#f6a623"} onBlur={e=>e.target.style.borderColor="#e8dfd0"}/>
        </div>

        <div style={{display:"flex",gap:"6px",marginBottom:"1.5rem",flexWrap:"wrap"}}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            const count  = tab.id !== "all" ? taskCounts[tab.id] : null;
            return (
              <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
                style={{padding:"7px 16px",borderRadius:"9999px",fontWeight:"700",fontSize:"13px",border:active?"none":"1.5px solid #e8dfd0",background:active?"#1c1008":"white",color:active?"white":"#78716c",cursor:"pointer",display:"flex",alignItems:"center",gap:"5px",transition:"all 0.15s"}}
                onMouseEnter={e=>{if(!active){e.currentTarget.style.borderColor="#f6a623";e.currentTarget.style.color="#f6a623";}}}
                onMouseLeave={e=>{if(!active){e.currentTarget.style.borderColor="#e8dfd0";e.currentTarget.style.color="#78716c";}}}>
                {tab.label}
                {count>0&&<span style={{background:active?"rgba(255,255,255,0.18)":"#f5efe6",borderRadius:"9999px",padding:"1px 7px",fontSize:"11px",fontWeight:"800",color:active?"white":"#b45309"}}>{count}</span>}
              </button>
            );
          })}
        </div>

        {filteredTasks.length === 0 ? (
          <div style={{textAlign:"center",padding:"56px 24px",background:"white",borderRadius:"14px",border:"1px dashed #e8dfd0"}}>
            <p style={{color:"#a8a29e",fontWeight:"600",fontSize:"14px"}}>No tasks found for this filter.</p>
          </div>
        ) : (
          filteredTasks.map(task => (
            <TaskCard key={String(task._id||task.id)} activeTab={activeTab} task={task}
              worker={workers[task.assignedWorkerId]} handleViewDetails={handleViewDetails}
              navigateToPayment={navigateToPayment} navigateToChat={navigateToChat} releasePayment={releasePayment}
              customerId={customerId} onRateReview={setRateReviewTask} onReport={setReportTask}/>
          ))
        )}

        {showDetailsModal && selectedTask && (
          <TaskModal task={selectedTask} worker={workers[selectedTask.assignedWorkerId]}
            setShowDetailsModal={setShowDetailsModal} hoveredButton={hoveredButton} setHoveredButton={setHoveredButton}/>
        )}
        {rateReviewTask && (
          <RateReviewModal task={rateReviewTask} worker={workers[rateReviewTask.assignedWorkerId]}
            customerId={customerId} onClose={()=>setRateReviewTask(null)} onSubmitted={()=>showSuccess("Review submitted!")}/>
        )}
        {reportTask && (
          <ReportModal task={reportTask} worker={workers[reportTask.assignedWorkerId]}
            customerId={customerId} onClose={()=>setReportTask(null)} onSubmitted={()=>showSuccess("Report submitted. We'll review it.")}/>
        )}
      </main>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

export default CustomerTaskPage;