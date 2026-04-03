import React, { useEffect, useState, useRef } from "react";
import {
  Search, Filter, ChevronDown, X, AlertTriangle, CheckCircle,
  XCircle, Clock, Trash2, Eye, User, Briefcase,
  RefreshCw, Flag, Sparkles, ShieldAlert, MessageSquare,
  TrendingUp, ChevronRight, Shield, UserCheck, UserX,
  AlertCircle, FileText, Calendar, MoreVertical, Info,
  Ban, Check, AlertOctagon, HelpCircle, Brain,
  ThumbsUp, ThumbsDown, Scale, Gavel, Zap, PenTool, RotateCcw,
  Star, MessageCircle, Layers, History, ShoppingBag, Award,
  DollarSign, CreditCard, MapPin, Phone, Mail, CalendarIcon, 
} from "lucide-react";
import BookingNavbar from "../../components/Navbar/Navbar";

const BASE = "http://localhost:8000/api";

const O = {
  50:     "#fff7ed",
  100:    "#ffedd5",
  200:    "#fed7aa",
  300:    "#fdba74",
  400:    "#fb923c",
  500:    "#f97316",
  600:    "#ea580c",
  700:    "#c2410c",
  header: "#fba452",
  bg:     "#F7F5EF",
  border: "#ebe9e3",
};

const C = {
  brand:       "#E8843A",
  brandLight:  "#E8843A18",
  brandHover:  "#D4712A",
  bg:          "#F7F5EF",
  surface:     "#FFFFFF",
  border:      "#EDE8DF",
  divider:     "#FAF7F2",
  textPrimary: "#1C1410",
  textSecond:  "#7A6E65",
  textMuted:   "#B0A89E",
  green:       "#3D9E6E",
  greenLight:  "#3D9E6E18",
  red:         "#D94F3D",
  redLight:    "#D94F3D15",
  blue:        "#3D7EC9",
  blueLight:   "#3D7EC918",
  purple:      "#7C5CBF",
  purpleLight: "#7C5CBF18",
  aiAccent:    "#6C3FFF",
  aiLight:     "#6C3FFF12",
  aiMid:       "#6C3FFF30",
};

const REASON_COLORS = {
  "Fraud / Scam":           { bg: "white", color: C.red,        icon: AlertOctagon  },
  "Harassment":             { bg: "white", color: C.red,        icon: AlertTriangle },
  "No show":                { bg: "white", color: C.brandHover, icon: Clock         },
  "Poor quality work":      { bg: "white", color: C.brandHover, icon: AlertCircle   },
  "Fake profile":           { bg: "white", color: C.red,        icon: UserX         },
  "Inappropriate behavior": { bg: "white", color: C.red,        icon: Ban           },
};

const SEV_CONFIG = {
  Critical: { color: "#D94F3D", bg: "#D94F3D12", bar: 95, icon: AlertOctagon  },
  High:     { color: "#E8843A", bg: "#E8843A12", bar: 70, icon: AlertTriangle },
  Medium:   { color: "#C9A83D", bg: "#C9A83D12", bar: 45, icon: HelpCircle    },
  Low:      { color: "#3D9E6E", bg: "#3D9E6E12", bar: 20, icon: Check         },
};

const ACTION_COLORS = {
  "Warn user":       { color: "#C9A83D",   bg: "#C9A83D12", icon: AlertCircle },
  "Suspend account": { color: C.red,       bg: C.redLight,  icon: Ban         },
  "Permanent ban":   { color: "#B02020",   bg: "#B0202012", icon: XCircle     },
  "Dismiss report":  { color: C.textMuted, bg: "#B0A89E12", icon: Check       },
};

const CRED_COLORS = {
  High:   { color: C.green, bg: C.greenLight, icon: Shield     },
  Medium: { color: C.brand, bg: C.brandLight, icon: Info       },
  Low:    { color: C.red,   bg: C.redLight,   icon: AlertCircle},
};

const fmt = (d) => {
  try { return d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"; }
  catch { return "—"; }
};
const fmtTime = (d) => {
  try { return d ? new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : ""; }
  catch { return ""; }
};
const shortId = (id) => id ? `#${id.slice(-6).toUpperCase()}` : "—";

const apiCall = async (url, options = {}) => {
  const token = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[API] ${options.method ?? "GET"} ${url} → ${res.status}`, body);
  }
  return res;
};

// ── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = ({ type, size = 38 }) => {
  const Icon = type === "worker" ? Briefcase : User;
  const color = type === "worker" ? C.blue : C.purple;
  const bg    = type === "worker" ? C.blueLight : C.purpleLight;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "2px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      <Icon size={size * 0.5} />
    </div>
  );
};

// ── Badges ────────────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    pending:  { bg: "white", color: C.brand, icon: Clock,       label: "Pending"  },
    resolved: { bg: "white", color: C.green, icon: CheckCircle, label: "Resolved" },
    declined: { bg: "white", color: C.red,   icon: XCircle,     label: "Declined" },
  };
  const c = map[status] ?? map.pending;
  const Icon = c.icon;
  return (
    <span style={{ background: c.bg, color: c.color, borderRadius: 100, padding: "4px 10px 4px 8px", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", border: `1px solid ${c.color}25` }}>
      <Icon size={12} />{c.label}
    </span>
  );
};

const TypeBadge = ({ type }) => {
  const isWorker = type === "worker";
  const Icon = isWorker ? Briefcase : User;
  return (
    <span style={{ background: isWorker ? C.blueLight : C.purpleLight, color: isWorker ? C.blue : C.purple, borderRadius: 100, padding: "2px 8px", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Icon size={11} />{isWorker ? "Worker" : "Customer"}
    </span>
  );
};

const ReasonBadge = ({ reason }) => {
  const config = REASON_COLORS[reason] ?? { bg: "#F0ECE7", color: C.textSecond, icon: AlertCircle };
  const Icon = config.icon;
  return (
    <span style={{ background: config.bg, color: config.color, borderRadius: 100, padding: "4px 10px 4px 8px", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", border: `1px solid ${config.color}25` }}>
      <Icon size={12} />{reason}
    </span>
  );
};

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const bg   = type === "error" ? C.red : type === "warning" ? C.brand : C.green;
  const Icon = type === "error" ? XCircle : type === "warning" ? AlertTriangle : CheckCircle;
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 99999, background: bg, color: "white", padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 500, boxShadow: "0 10px 25px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: 8, maxWidth: 320, animation: "slideUp 0.2s ease" }}>
      <Icon size={18} />{message}
    </div>
  );
};

// ── Confirm Dialog ────────────────────────────────────────────────────────────
const ConfirmDialog = ({ message, onConfirm, onCancel, danger = false }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(28,20,16,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.2s ease" }}>
    <div style={{ background: C.surface, borderRadius: 24, padding: 28, width: 380, boxShadow: "0 25px 50px rgba(0,0,0,0.3)", animation: "scaleIn 0.2s ease" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: danger ? C.redLight : C.brandLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <AlertTriangle size={24} color={danger ? C.red : C.brand} />
      </div>
      <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: C.textPrimary }}>Confirm Action</h3>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: C.textSecond, lineHeight: 1.5 }}>{message}</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button onClick={onCancel}  style={{ padding: "10px 20px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", fontSize: 14, color: C.textSecond, fontFamily: "inherit" }}>Cancel</button>
        <button onClick={onConfirm} style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: danger ? C.red : C.green, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "white", fontFamily: "inherit" }}>Confirm</button>
      </div>
    </div>
  </div>
);

// ── Context Menu ──────────────────────────────────────────────────────────────
const ContextMenu = ({ report, onAction, onClose }) => {
  const menuRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const actions = [
    { label: "View Details", icon: Eye,         action: "view",    color: C.blue  },
    ...(report.status === "pending" ? [
      { label: "Resolve",    icon: CheckCircle, action: "resolve", color: C.green },
      { label: "Decline",    icon: XCircle,     action: "decline", color: C.red   },
    ] : []),
    { label: "Delete",       icon: Trash2,      action: "delete",  color: C.red   },
  ];

  return (
    <div ref={menuRef} style={{ position: "absolute", right: 0, top: "100%", zIndex: 100000, background: "white", borderRadius: 14, boxShadow: "0 10px 40px rgba(0,0,0,0.15)", border: `1px solid ${C.border}`, minWidth: 180, marginTop: 4, animation: "scaleIn 0.1s ease" }}>
      {actions.map(({ label, icon: Icon, action, color }) => (
        <button key={action} onClick={() => { onAction(action); onClose(); }}
          style={{ width: "100%", padding: "12px 16px", border: "none", background: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontSize: 13, fontWeight: 500, color, textAlign: "left", borderBottom: `1px solid ${C.divider}` }}
          onMouseEnter={e => e.currentTarget.style.background = C.bg}
          onMouseLeave={e => e.currentTarget.style.background = "white"}
        >
          <Icon size={16} />{label}
        </button>
      ))}
    </div>
  );
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, color, icon: Icon, sub }) => (
  <div style={{ background: C.surface, borderRadius: 16, padding: 20, border: `1px solid ${color}25` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
      <div style={{ fontSize: 13, color, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={18} color={color} />
      </div>
    </div>
    <div style={{ fontSize: 28, fontWeight: 700, color: C.textPrimary, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>{sub}</div>}
  </div>
);

// ── Customer History Panel ────────────────────────────────────────────────────
// ── Customer History Panel ────────────────────────────────────────────────────
const CustomerHistoryPanel = ({ customerId, customerEmail }) => {
  const [customer, setCustomer] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!customerId && !customerEmail) return;
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch customer details
        const customerRes = await fetch(`${BASE}/customer/${customerId}`);
        if (customerRes.ok) {
          const customerData = await customerRes.json();
          setCustomer(customerData);
        }
        
        // Fetch customer's tasks
        const tasksRes = await fetch(`${BASE}/tasks/user/${customerId}`);
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          setTasks(tasksData.tasks || []);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [customerId, customerEmail]);

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>Loading customer history...</div>;
  if (error) return <div style={{ padding: 40, textAlign: "center", color: C.red }}>Error: {error}</div>;
  if (!customer) return <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>No customer history available</div>;

  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const cancelledTasks = tasks.filter(t => t.status === "cancelled").length;
  const totalSpent = tasks.reduce((sum, t) => sum + (t.totalCost || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Customer Profile Summary */}
      <div style={{ background: C.surface, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: C.purpleLight, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {customer.profile_picture ? (
              <img src={customer.profile_picture} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <User size={30} color={C.purple} />
            )}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.textPrimary }}>
              {customer.first_name} {customer.last_name}
            </h3>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <TypeBadge type="customer" />
              <StatusBadge status={customer.status || "active"} />
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {[
            ["Email", customer.email, Mail],
            ["Phone", customer.phoneNo || "—", Phone],
            ["Address", customer.address || "—", MapPin],
            ["Member Since", fmt(customer.createdAt), CalendarIcon],
            ["Date of Birth", fmt(customer.date_of_birth), CalendarIcon],
            ["Gender", customer.gender || "—", User],
          ].map(([label, value, Icon]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: C.bg, borderRadius: 10 }}>
              <Icon size={16} color={C.textMuted} />
              <div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{value || "—"}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Statistics Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          ["Total Tasks", tasks.length, C.brand, ShoppingBag],
          ["Completed", completedTasks, C.green, CheckCircle],
          ["Cancelled", cancelledTasks, C.red, XCircle],
          ["Total Spent", `NPR ${totalSpent.toLocaleString()}`, C.purple, DollarSign],
        ].map(([label, value, color, Icon]) => (
          <div key={label} style={{ background: C.surface, borderRadius: 12, padding: 14, textAlign: "center", border: `1px solid ${C.border}` }}>
            <Icon size={18} color={color} style={{ marginBottom: 6 }} />
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Task History List */}
      <div style={{ background: C.surface, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <History size={18} color={C.brand} />
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.textPrimary }}>Task History ({tasks.length})</h4>
        </div>
        {tasks.length === 0 ? (
          <p style={{ textAlign: "center", color: C.textMuted, padding: 20 }}>No tasks found</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 400, overflowY: "auto" }}>
            {tasks.map((task, idx) => (
              <div key={idx} style={{ padding: 14, background: C.bg, borderRadius: 12, border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: C.textPrimary }}>{task.taskName || "Untitled Task"}</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>ID: {shortId(task._id)}</div>
                  </div>
                  <StatusBadge status={task.status} />
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                  {[
                    ["Date", task.serviceDate ? fmt(task.serviceDate) : "—"],
                    ["Time", task.serviceTime || "—"],
                    ["Amount", `NPR ${task.totalCost?.toLocaleString() || 0}`],
                    ["Worker", task.assignedWorkerId ? shortId(task.assignedWorkerId) : "—"],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, color: C.textMuted }}>{label}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.textSecond }}>{val}</div>
                    </div>
                  ))}
                </div>
                {task.cancelReason && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.divider}`, fontSize: 11, color: C.red }}>
                    Cancelled: {task.cancelReason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// const RefundAmountModal = ({ report, onClose, onConfirm }) => {
//   const [workerAmount, setWorkerAmount] = useState("");
//   const [customerAmount, setCustomerAmount] = useState("");
//   const [loading, setLoading] = useState(false);

//   const totalAmount = report.totalCost || report.amount || 0;
  
//   const handleSubmit = async () => {
//     const workerAmt = parseFloat(workerAmount) || 0;
//     const customerAmt = parseFloat(customerAmount) || 0;
    
//     if (workerAmt + customerAmt > totalAmount) {
//       alert("Total refund amount cannot exceed the task amount!");
//       return;
//     }
    
//     setLoading(true);
//     try {
//       // Call your refund API here
//       const response = await apiCall(`${BASE}/refunds/create`, {
//         method: "POST",
//         body: JSON.stringify({
//           reportId: report.id,
//           taskId: report.taskId,
//           workerRefundAmount: workerAmt,
//           customerRefundAmount: customerAmt,
//           totalAmount: totalAmount,
//         }),
//       });
      
//       if (response.ok) {
//         onConfirm({ workerAmount: workerAmt, customerAmount: customerAmt });
//         onClose();
//       } else {
//         alert("Failed to create refund");
//       }
//     } catch (err) {
//       alert("Error: " + err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div style={{ position: "fixed", inset: 0, zIndex: 100000, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
//       <div style={{ background: C.surface, borderRadius: 24, padding: 28, width: 450, maxWidth: "90%", boxShadow: "0 25px 50px rgba(0,0,0,0.3)" }}>
//         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
//           <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.textPrimary }}>Request Refund</h3>
//           <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
//             <X size={20} color={C.textMuted} />
//           </button>
//         </div>
        
//         <div style={{ background: C.bg, borderRadius: 12, padding: 16, marginBottom: 20 }}>
//           <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
//             <span style={{ fontSize: 13, color: C.textMuted }}>Total Task Amount:</span>
//             <span style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>NPR {totalAmount.toLocaleString()}</span>
//           </div>
//         </div>
        
//         <div style={{ marginBottom: 20 }}>
//           <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>
//             <Briefcase size={14} style={{ display: "inline", marginRight: 6 }} />
//             Refund to Worker
//           </label>
//           <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
//             <span style={{ fontSize: 14, color: C.textSecond }}>NPR</span>
//             <input
//               type="number"
//               value={workerAmount}
//               onChange={(e) => setWorkerAmount(e.target.value)}
//               placeholder="Enter amount"
//               min="0"
//               max={totalAmount}
//               style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, outline: "none", fontFamily: "inherit" }}
//               onFocus={e => e.target.style.borderColor = C.brand}
//               onBlur={e => e.target.style.borderColor = C.border}
//             />
//           </div>
//         </div>
        
//         <div style={{ marginBottom: 24 }}>
//           <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>
//             <User size={14} style={{ display: "inline", marginRight: 6 }} />
//             Refund to Customer
//           </label>
//           <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
//             <span style={{ fontSize: 14, color: C.textSecond }}>NPR</span>
//             <input
//               type="number"
//               value={customerAmount}
//               onChange={(e) => setCustomerAmount(e.target.value)}
//               placeholder="Enter amount"
//               min="0"
//               max={totalAmount}
//               style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, outline: "none", fontFamily: "inherit" }}
//               onFocus={e => e.target.style.borderColor = C.brand}
//               onBlur={e => e.target.style.borderColor = C.border}
//             />
//           </div>
//         </div>
        
//         <div style={{ background: C.aiLight, borderRadius: 10, padding: 12, marginBottom: 24 }}>
//           <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
//             <span style={{ color: C.textMuted }}>Total Refund:</span>
//             <span style={{ fontWeight: 700, color: C.aiAccent }}>
//               NPR {(parseFloat(workerAmount || 0) + parseFloat(customerAmount || 0)).toLocaleString()}
//             </span>
//           </div>
//           <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 6 }}>
//             <span style={{ color: C.textMuted }}>Remaining:</span>
//             <span style={{ color: totalAmount - (parseFloat(workerAmount || 0) + parseFloat(customerAmount || 0)) < 0 ? C.red : C.green }}>
//               NPR {(totalAmount - (parseFloat(workerAmount || 0) + parseFloat(customerAmount || 0))).toLocaleString()}
//             </span>
//           </div>
//         </div>
        
//         <div style={{ display: "flex", gap: 12 }}>
//           <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", fontSize: 14, color: C.textSecond, fontFamily: "inherit" }}>
//             Cancel
//           </button>
//           <button onClick={handleSubmit} disabled={loading} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: C.green, color: "white", fontWeight: 600, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}>
//             {loading ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Processing...</> : "Confirm Refund"}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// ── Worker History Panel ────────────────────────────────────────────────────
const WorkerHistoryPanel = ({ workerId, workerEmail }) => {
  const [worker, setWorker] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!workerId && !workerEmail) return;
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch worker details by email (since workerId is email)
        const workerRes = await apiCall(`${BASE}/worker/${workerId}`);
        if (workerRes.ok) {
          const workerData = await workerRes.json();
          setWorker(workerData);
        }
        
        // Fetch worker's tasks
        const tasksRes = await apiCall(`${BASE}/tasks/worker/${workerId}`);
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          setTasks(tasksData.tasks || []);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [workerId, workerEmail]);

  // Helper function to safely get skill name from object or string
  const getSkillName = (skill) => {
    if (!skill) return "";
    if (typeof skill === 'string') return skill;
    if (typeof skill === 'object') {
      return skill.name || skill.skillName || JSON.stringify(skill);
    }
    return String(skill);
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>Loading worker history...</div>;
  if (error) return <div style={{ padding: 40, textAlign: "center", color: C.red }}>Error: {error}</div>;
  if (!worker) return <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>No worker history available</div>;

  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const cancelledTasks = tasks.filter(t => t.status === "cancelled").length;
  const totalEarned = tasks.reduce((sum, t) => sum + (t.totalCost || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Worker Profile Summary */}
      <div style={{ background: C.surface, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: C.blueLight, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {worker.profilePhoto ? (
              <img src={worker.profilePhoto} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <Briefcase size={30} color={C.blue} />
            )}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.textPrimary }}>
              {worker.firstName} {worker.lastName}
            </h3>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <TypeBadge type="worker" />
              <StatusBadge status={worker.status || "active"} />
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {[
            ["Email", worker.email, Mail],
            ["Phone", worker.phoneNo || worker.phone_no ||  "—", Phone],
            ["Task Type", worker.taskType || "—", Briefcase],
            ["Base Price", `NPR ${worker.basePrice?.toLocaleString() || 0}`, DollarSign],
            ["Rating", `⭐ ${worker.rating || worker.ratings || 0}`, Star],
            ["Completed Tasks", worker.noOfCompletedTask || 0, CheckCircle],
            ["Total Earnings", `NPR ${worker.total_earnings?.toLocaleString() || 0}`, DollarSign],
            ["Status", worker.status || "active", User],
          ].map(([label, value, Icon]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: C.bg, borderRadius: 10 }}>
              <Icon size={16} color={C.textMuted} />
              <div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{value}</div>
              </div>
            </div>
          ))}
        </div>
        {worker.skills && worker.skills.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.divider}` }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>Skills</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {worker.skills.map((skill, idx) => (
                <span key={idx} style={{ padding: "4px 10px", background: C.blueLight, color: C.blue, borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                  {getSkillName(skill)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          ["Total Tasks", tasks.length, C.brand, ShoppingBag],
          ["Completed", completedTasks, C.green, CheckCircle],
          ["Cancelled", cancelledTasks, C.red, XCircle],
          ["Total Earned", `NPR ${totalEarned.toLocaleString()}`, C.green, DollarSign],
        ].map(([label, value, color, Icon]) => (
          <div key={label} style={{ background: C.surface, borderRadius: 12, padding: 14, textAlign: "center", border: `1px solid ${C.border}` }}>
            <Icon size={18} color={color} style={{ marginBottom: 6 }} />
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Task History List */}
      <div style={{ background: C.surface, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <History size={18} color={C.brand} />
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.textPrimary }}>Assigned Tasks ({tasks.length})</h4>
        </div>
        {tasks.length === 0 ? (
          <p style={{ textAlign: "center", color: C.textMuted, padding: 20 }}>No tasks assigned</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 400, overflowY: "auto" }}>
            {tasks.map((task, idx) => (
              <div key={idx} style={{ padding: 14, background: C.bg, borderRadius: 12, border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: C.textPrimary }}>{task.taskName || "Untitled Task"}</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>ID: {shortId(task._id)}</div>
                  </div>
                  <StatusBadge status={task.status} />
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                  {[
                    ["Date", task.serviceDate ? fmt(task.serviceDate) : "—"],
                    ["Time", task.serviceTime || "—"],
                    ["Amount", `NPR ${task.totalCost?.toLocaleString() || 0}`],
                    ["Customer", task.userId ? shortId(task.userId) : "—"],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, color: C.textMuted }}>{label}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.textSecond }}>{val}</div>
                    </div>
                  ))}
                </div>
                {task.payment_status && (
                  <div style={{ marginTop: 8, fontSize: 11, color: task.payment_status === "paid" ? C.green : C.brand }}>
                    Payment: {task.payment_status} · Escrow: {task.escrow_status}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Task History Panel ──────────────────────────────────────────────────────
const TaskHistoryPanel = ({ taskId }) => {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!taskId) return;
    const loadTask = async () => {
      setLoading(true);
      try {
        const res = await apiCall(`${BASE}/task/${taskId}`);
        if (res.ok) {
          const data = await res.json();
          setTask(data);
        } else {
          setError("Failed to load task details");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadTask();
  }, [taskId]);

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>Loading task details...</div>;
  if (error) return <div style={{ padding: 40, textAlign: "center", color: C.red }}>Error: {error}</div>;
  if (!task) return <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>No task details available</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Task Header */}
      <div style={{ background: C.surface, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.textPrimary }}>{task.taskName || "Task Details"}</h3>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>ID: {shortId(task._id)}</div>
          </div>
          <StatusBadge status={task.status} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {[
            ["Task Type", task.taskType || "—", Briefcase],
            ["Service", task.selectedService || "—", Award],
            ["Description", task.taskDescrip || "—", FileText],
            ["Address", task.address || "—", MapPin],
            ["Scheduled Date", task.serviceDate ? fmt(task.serviceDate) : "—", CalendarIcon],
            ["Scheduled Time", task.serviceTime || "—", Clock],
            ["Customer", task.userId ? shortId(task.userId) : "—", User],
            ["Worker", task.assignedWorkerId ? shortId(task.assignedWorkerId) : "—", Briefcase],
          ].map(([label, value, Icon]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: C.bg, borderRadius: 10 }}>
              <Icon size={16} color={C.textMuted} />
              <div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing Section */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          ["Base Price", `NPR ${task.basePrice?.toLocaleString() || 0}`, C.brand],
          ["Additional Cost", `NPR ${task.additionalCost?.toLocaleString() || 0}`, C.purple],
          ["Total Cost", `NPR ${task.totalCost?.toLocaleString() || 0}`, C.green],
        ].map(([label, value, color]) => (
          <div key={label} style={{ background: C.surface, borderRadius: 12, padding: 14, textAlign: "center", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Cancellation/Refund Info */}
      {task.cancelledAt && (
        <div style={{ background: C.redLight, borderRadius: 16, padding: 20, border: `1px solid ${C.red}30` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <XCircle size={18} color={C.red} />
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.red }}>Cancellation Details</h4>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {[
              ["Cancelled At", task.cancelledAt ? fmt(task.cancelledAt) : "—"],
              ["Cancelled By", task.cancelledBy || "—"],
              ["Refund Amount", `NPR ${task.refundAmount?.toLocaleString() || 0}`],
              ["Penalty", `NPR ${task.penaltyAmount?.toLocaleString() || 0}`],
              ["Refund Status", task.refundStatus || "—"],
              ["Cancel Reason", task.cancelReason || "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: C.textMuted }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: label === "Refund Status" && value === "approved" ? C.green : C.textPrimary }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Details */}
      {task.payment_method && (
        <div style={{ background: C.surface, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <CreditCard size={18} color={C.brand} />
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.textPrimary }}>Payment Details</h4>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {[
              ["Method", task.payment_method || "—"],
              ["Transaction UUID", task.esewa_transaction_uuid || "—"],
              ["Reference ID", task.esewa_ref_id || "—"],
              ["Status", task.payment_status || "—"],
              ["Escrow Status", task.escrow_status || "—"],
              ["Paid At", task.paid_at ? fmt(task.paid_at) : "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: C.textMuted }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: value === "paid" ? C.green : value === "held" ? C.brand : C.textPrimary }}>
                  {value || "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Note */}
      {task.note && (
        <div style={{ background: C.surface, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
          <h4 style={{ margin: 0, marginBottom: 12, fontSize: 15, fontWeight: 700, color: C.textPrimary }}>Note</h4>
          <p style={{ margin: 0, fontSize: 14, color: C.textSecond, lineHeight: 1.6 }}>{task.note}</p>
        </div>
      )}
    </div>
  );
};

// ── AI Analysis Panel ─────────────────────────────────────────────────────────
const AIAnalysisPanel = ({ report }) => {
  const [aiResult,        setAiResult]        = useState(null);
  const [context,         setContext]         = useState(null);
  const [loading,         setLoading]         = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [showHistory,     setShowHistory]     = useState(false);
  const [apiError,        setApiError]        = useState(null);
  const [innerTab,        setInnerTab]        = useState("analysis");

  async function runAnalysis() {
    setLoading(true);
    setAiResult(null);
    setContext(null);
    setApiError(null);
    setInnerTab("analysis");

    try {
      const token = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
      const response = await fetch(`${BASE}/reports/${report.id}/ai-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const result = data.aiResult ?? data.analysis ?? data.data ?? data;
      const ctx    = data.context ?? null;

      setAiResult(result);
      setContext(ctx);
      setAnalysisHistory(prev => [...prev, { timestamp: new Date().toISOString(), result, context: ctx }]);
    } catch (err) {
      setApiError(err.message);
      setAiResult({ error: `AI analysis failed: ${err.message}` });
    } finally {
      setLoading(false);
    }
  }

  const getSeverityConfig = (s) => {
    const l = s?.toLowerCase?.() || "medium";
    if (l.includes("critical")) return SEV_CONFIG.Critical;
    if (l.includes("high"))     return SEV_CONFIG.High;
    if (l.includes("medium"))   return SEV_CONFIG.Medium;
    return SEV_CONFIG.Low;
  };
  const getActionColor = (a) => {
    if (!a) return ACTION_COLORS["Dismiss report"];
    const l = a.toLowerCase();
    if (l.includes("warn"))                            return ACTION_COLORS["Warn user"];
    if (l.includes("suspend"))                         return ACTION_COLORS["Suspend account"];
    if (l.includes("permanent") || l.includes("ban")) return ACTION_COLORS["Permanent ban"];
    return ACTION_COLORS["Dismiss report"];
  };
  const getCredColor = (c) => {
    if (!c) return CRED_COLORS.Medium;
    const l = c.toLowerCase();
    if (l.includes("high"))   return CRED_COLORS.High;
    if (l.includes("medium")) return CRED_COLORS.Medium;
    return CRED_COLORS.Low;
  };

  const sev  = aiResult?.severity            ? getSeverityConfig(aiResult.severity)      : null;
  const act  = aiResult?.suggestedAction     ? getActionColor(aiResult.suggestedAction)  : null;
  const cred = aiResult?.reporterCredibility ? getCredColor(aiResult.reporterCredibility): null;

  const Shimmer = ({ w = "100%", h = 13 }) => (
    <div style={{ width: w, height: h, borderRadius: 6, background: "linear-gradient(90deg,#EDE8DF 25%,#F7F5EF 50%,#EDE8DF 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
  );
  const MiniLabel = ({ children }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{children}</div>
  );

  return (
    <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.aiMid}`, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.aiAccent} 0%, ${C.aiAccent}dd 100%)`, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Brain size={20} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "white" }}>AI Deep Analysis</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>Powered by AI · Comprehensive case analysis</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {analysisHistory.length > 0 && (
            <button onClick={() => setShowHistory(!showHistory)}
              style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.2)", color: "white", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
              <Clock size={14} /> History ({analysisHistory.length})
            </button>
          )}
          <button onClick={runAnalysis} disabled={loading}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: loading ? "rgba(255,255,255,0.3)" : "white", color: loading ? "white" : C.aiAccent, fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
            {loading
              ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Analyzing…</>
              : aiResult && !aiResult.error ? <><RefreshCw size={14} /> Re-analyze</> : <><Zap size={14} /> Run Deep Analysis</>}
          </button>
        </div>
      </div>

      {showHistory && analysisHistory.length > 0 && (
        <div style={{ borderBottom: `1px solid ${C.aiMid}`, background: C.aiLight, padding: "12px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.aiAccent, marginBottom: 8 }}>Previous Analyses</div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {analysisHistory.map((item, idx) => (
              <button key={idx} onClick={() => { setAiResult(item.result); setContext(item.context); }}
                style={{ padding: "6px 12px", borderRadius: 20, border: `1px solid ${C.aiMid}`, background: "white", fontSize: 11, color: C.textSecond, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}>
                Analysis {idx + 1} • {new Date(item.timestamp).toLocaleTimeString()}
              </button>
            ))}
          </div>
        </div>
      )}

      {apiError && (
        <div style={{ margin: 16, padding: "12px 16px", background: C.redLight, border: `1px solid ${C.red}30`, borderRadius: 8, fontSize: 13, color: C.red }}>
          <strong>Error:</strong> {apiError}
        </div>
      )}

      {!aiResult && !loading && !apiError && (
        <div style={{ padding: "48px 20px", textAlign: "center" }}>
          <Brain size={48} style={{ color: C.aiAccent, opacity: 0.3, marginBottom: 16 }} />
          <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: C.textPrimary }}>AI-Powered Analysis</h3>
          <p style={{ margin: "0 auto", fontSize: 14, color: C.textMuted, lineHeight: 1.6, maxWidth: 400 }}>
            Click "Run Deep Analysis" to get comprehensive insights, credibility assessment, and recommended actions.
          </p>
        </div>
      )}

      {loading && (
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          <Shimmer w="100%" h={20} />
          <Shimmer w="90%"  h={16} />
          <Shimmer w="95%"  h={16} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
            <Shimmer w="100%" h={120} />
            <Shimmer w="100%" h={120} />
          </div>
          <Shimmer w="100%" h={80} />
        </div>
      )}

      {aiResult?.error && (
        <div style={{ margin: 20, padding: "16px 20px", background: C.redLight, border: `1px solid ${C.red}30`, borderRadius: 12, fontSize: 14, color: C.red, display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={20} />{aiResult.error}
        </div>
      )}

      {aiResult && !aiResult.error && (
        <>
          <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, background: C.bg }}>
            {[
              { key: "analysis", icon: ShieldAlert, label: "Analysis" },
              { key: "context",  icon: Layers,      label: "Context"  },
            ].map(({ key, icon: Icon, label }) => (
              <button key={key} onClick={() => setInnerTab(key)}
                style={{ flex: 1, padding: "12px 0", border: "none", background: innerTab === key ? C.surface : "transparent", color: innerTab === key ? C.aiAccent : C.textMuted, fontSize: 13, fontWeight: innerTab === key ? 700 : 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit", borderBottom: innerTab === key ? `2px solid ${C.aiAccent}` : "2px solid transparent", transition: "all 0.15s" }}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>

          {innerTab === "analysis" && (
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.2s ease" }}>
              {aiResult.summary && (
                <div style={{ background: C.aiLight, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.aiAccent, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                    <FileText size={14} /> Summary
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: C.textSecond, lineHeight: 1.6 }}>{aiResult.summary}</p>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {aiResult.severity && (
                  <div style={{ background: sev?.bg || C.aiLight, borderRadius: 12, padding: 16 }}>
                    <MiniLabel>Severity</MiniLabel>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      {sev?.icon && <sev.icon size={20} color={sev.color} />}
                      <span style={{ fontSize: 18, fontWeight: 800, color: sev?.color || C.textPrimary }}>{aiResult.severity}</span>
                    </div>
                    {aiResult.severityReason && <p style={{ margin: 0, fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>{aiResult.severityReason}</p>}
                  </div>
                )}
                {aiResult.suggestedAction && (
                  <div style={{ background: act?.bg || C.aiLight, borderRadius: 12, padding: 16 }}>
                    <MiniLabel>Suggested Action</MiniLabel>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      {act?.icon && <act.icon size={20} color={act.color} />}
                      <span style={{ fontSize: 16, fontWeight: 700, color: act?.color || C.textPrimary }}>{aiResult.suggestedAction}</span>
                    </div>
                    {aiResult.actionReason && <p style={{ margin: 0, fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>{aiResult.actionReason}</p>}
                  </div>
                )}
              </div>
              {aiResult.keyEvidence && (
                <div style={{ background: C.bg, borderRadius: 12, padding: 16 }}>
                  <MiniLabel>Key Evidence</MiniLabel>
                  <p style={{ margin: 0, fontSize: 14, color: C.textPrimary, fontWeight: 500 }}>{aiResult.keyEvidence}</p>
                </div>
              )}
              {aiResult.redFlags?.length > 0 && (
                <div style={{ background: C.surface, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
                  <MiniLabel>Red Flags</MiniLabel>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {aiResult.redFlags.map((flag, idx) => (
                      <span key={idx} style={{ padding: "4px 12px", background: C.redLight, color: C.red, borderRadius: 20, fontSize: 12, fontWeight: 500 }}>⚑ {flag}</span>
                    ))}
                  </div>
                </div>
              )}
              {aiResult.reporterCredibility && (
                <div style={{ background: cred?.bg || C.bg, borderRadius: 12, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    {cred?.icon && <cred.icon size={16} color={cred.color} />}
                    <span style={{ fontSize: 13, fontWeight: 700, color: cred?.color || C.textPrimary }}>
                      Reporter Credibility: {aiResult.reporterCredibility}
                    </span>
                  </div>
                  {aiResult.credibilityNote && <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>{aiResult.credibilityNote}</p>}
                </div>
              )}
              {aiResult.profileInsight && (
                <div style={{ background: C.bg, borderRadius: 12, padding: 16 }}>
                  <MiniLabel>Profile Insight</MiniLabel>
                  <p style={{ margin: 0, fontSize: 13, color: C.textSecond }}>{aiResult.profileInsight}</p>
                </div>
              )}
              {aiResult.chatInsight && aiResult.chatInsight !== "N/A" && (
                <div style={{ background: C.bg, borderRadius: 12, padding: 16 }}>
                  <MiniLabel>Chat Insight</MiniLabel>
                  <p style={{ margin: 0, fontSize: 13, color: C.textSecond }}>{aiResult.chatInsight}</p>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={() => {
                  const blob = new Blob([JSON.stringify(aiResult, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url;
                  a.download = `analysis-${report.id}-${new Date().toISOString().slice(0,10)}.json`;
                  a.click();
                }} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.textSecond, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
                  <FileText size={12} /> Export JSON
                </button>
                <button onClick={() => {
                  const text = `AI Analysis\n${"=".repeat(30)}\nReport: ${shortId(report.id)}\nDate: ${new Date().toLocaleString()}\n\nSummary: ${aiResult.summary || "N/A"}\nSeverity: ${aiResult.severity || "N/A"}\nAction: ${aiResult.suggestedAction || "N/A"}\nEvidence: ${aiResult.keyEvidence || "N/A"}\nRed Flags: ${aiResult.redFlags?.join(", ") || "None"}\nCredibility: ${aiResult.reporterCredibility || "N/A"}`;
                  navigator.clipboard?.writeText(text);
                  alert("Copied to clipboard!");
                }} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.textSecond, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
                  <PenTool size={12} /> Copy Summary
                </button>
              </div>
            </div>
          )}

          {innerTab === "context" && (
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.2s ease" }}>
              {!context ? (
                <div style={{ padding: "32px 0", textAlign: "center" }}>
                  <Layers size={36} style={{ color: C.textMuted, opacity: 0.4, marginBottom: 10 }} />
                  <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>No context data returned from the API.</p>
                </div>
              ) : (
                <>
                  {context.reportedProfile && (
                    <div style={{ background: C.surface, borderRadius: 14, padding: 18, border: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: C.redLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <UserX size={15} color={C.red} />
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Reported User</div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {[
                          ["Name",       context.reportedProfile.name],
                          ["Email",      context.reportedProfile.email],
                          ["Role",       context.reportedProfile.role],
                          ["Status",     context.reportedProfile.status],
                          ["Rating",     context.reportedProfile.ratings != null ? `⭐ ${context.reportedProfile.ratings}` : "—"],
                          ["Jobs Done",  context.reportedProfile.completedTasks ?? "—"],
                          ["Base Price", context.reportedProfile.basePrice != null ? `NPR ${context.reportedProfile.basePrice}` : "—"],
                          ["Task Type",  context.reportedProfile.taskType ?? "—"],
                        ].map(([label, value]) => (
                          <div key={label} style={{ padding: "7px 0", borderBottom: `1px solid ${C.divider}` }}>
                            <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
                            <div style={{ fontSize: 12, color: C.textPrimary, fontWeight: 600, wordBreak: "break-all" }}>{String(value ?? "—")}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 10, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.divider}` }}>
                        {[
                          ["Face Verified",  context.reportedProfile.faceVerified],
                          ["Skill Verified", context.reportedProfile.skillVerified],
                        ].map(([label, yes]) => (
                          <div key={label} style={{ flex: 1, textAlign: "center", padding: "10px", borderRadius: 10, background: yes ? C.greenLight : C.redLight, border: `1px solid ${yes ? C.green : C.red}25` }}>
                            <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, marginBottom: 6 }}>{label.toUpperCase()}</div>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: yes ? C.green : C.red }}>
                              {yes ? <CheckCircle size={13} /> : <XCircle size={13} />}{yes ? "Yes" : "No"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {context.reporterProfile && (
                    <div style={{ background: C.surface, borderRadius: 14, padding: 18, border: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: C.blueLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <User size={15} color={C.blue} />
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Reporter</div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {[
                          ["Name",   context.reporterProfile.name],
                          ["Role",   context.reporterProfile.role],
                          ["Status", context.reporterProfile.status],
                          ["Email",  context.reporterProfile.email ?? "—"],
                        ].map(([label, value]) => (
                          <div key={label} style={{ padding: "7px 0", borderBottom: `1px solid ${C.divider}` }}>
                            <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
                            <div style={{ fontSize: 12, color: C.textPrimary, fontWeight: 600, wordBreak: "break-all" }}>{String(value ?? "—")}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {context.priorReports && (
                    <div style={{ background: context.priorReports.total > 0 ? C.redLight : C.greenLight, borderRadius: 14, padding: 18, border: `1px solid ${context.priorReports.total > 0 ? C.red : C.green}25` }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Prior Reports Against Reported User</div>
                      <div style={{ display: "flex", gap: 20 }}>
                        {[
                          ["Total",    context.priorReports.total],
                          ["Pending",  context.priorReports.pending],
                          ["Resolved", context.priorReports.resolved],
                          ["Declined", context.priorReports.declined],
                        ].map(([label, val]) => (
                          <div key={label} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 22, fontWeight: 800, color: context.priorReports.total > 0 ? C.red : C.green }}>{val ?? 0}</div>
                            <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {context.jobs?.length > 0 && (
                    <div style={{ background: C.surface, borderRadius: 14, padding: 18, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Job History ({context.jobs.length})</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                        {context.jobs.map((job, i) => {
                          const sc = job.status === "completed" ? C.green  : job.status === "pending" ? C.brand    : C.textMuted;
                          const sb = job.status === "completed" ? C.greenLight : job.status === "pending" ? C.brandLight : "#B0A89E15";
                          return (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 10, background: C.bg }}>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary, textTransform: "capitalize", marginBottom: 2 }}>{job.taskType}</div>
                                {job.paymentStatus && (
                                  <div style={{ fontSize: 11, color: C.textMuted }}>
                                    Payment: <span style={{ color: job.paymentStatus === "paid" ? C.green : C.red, fontWeight: 600 }}>{job.paymentStatus}</span>
                                    {job.escrowStatus && <> · Escrow: <span style={{ fontWeight: 600 }}>{job.escrowStatus}</span></>}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600, background: sb, color: sc, textTransform: "capitalize" }}>{job.status}</span>
                                <span style={{ color: C.green, fontWeight: 700, fontSize: 12 }}>NPR {job.totalCost}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {(() => {
                        const completed = context.jobs.filter(j => j.status === "completed").length;
                        const totalNPR  = context.jobs.reduce((s, j) => s + (j.totalCost || 0), 0);
                        const paid      = context.jobs.filter(j => j.paymentStatus === "paid").length;
                        return (
                          <div style={{ display: "flex", gap: 12, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.divider}` }}>
                            {[
                              ["Completed", completed, C.green],
                              [`NPR ${totalNPR.toLocaleString()}`, "Total Value", C.brand],
                              ["Paid", paid, C.blue],
                            ].map(([val, label, color]) => (
                              <div key={label} style={{ flex: 1, textAlign: "center" }}>
                                <div style={{ fontSize: 16, fontWeight: 800, color }}>{val}</div>
                                <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {context.reviews?.filter(r => r.text || r.stars != null).length > 0 && (
                    <div style={{ background: C.surface, borderRadius: 14, padding: 18, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Reviews</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto" }}>
                        {context.reviews.filter(r => r.text || r.stars != null).map((rev, i) => (
                          <div key={i} style={{ padding: "10px 12px", borderRadius: 10, background: C.bg }}>
                            {rev.stars != null && (
                              <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
                                {[1,2,3,4,5].map(s => (
                                  <Star key={s} size={12} fill={s <= rev.stars ? "#C9A83D" : "none"} color={s <= rev.stars ? "#C9A83D" : C.textMuted} />
                                ))}
                              </div>
                            )}
                            {rev.text && <p style={{ margin: 0, fontSize: 12, color: C.textSecond }}>{rev.text}</p>}
                            {rev.createdAt && rev.createdAt !== "None" && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{fmt(rev.createdAt)}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {context.chat && (
                    <div style={{ background: C.surface, borderRadius: 14, padding: 18, border: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <MessageCircle size={15} color={C.aiAccent} />
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Chat History</div>
                        </div>
                        <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: C.aiLight, color: C.aiAccent }}>
                          {context.chat.total} messages
                        </span>
                      </div>
                      {context.chat.total === 0 ? (
                        <p style={{ margin: 0, fontSize: 13, color: C.textMuted, fontStyle: "italic" }}>No chat messages between the parties.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                          {context.chat.messages?.map((msg, i) => (
                            <div key={i} style={{ padding: "8px 12px", borderRadius: 10, background: C.aiLight, fontSize: 12, color: C.textSecond }}>
                              <div style={{ fontWeight: 600, color: C.aiAccent, marginBottom: 2 }}>{msg.sender ?? "Unknown"}</div>
                              <div>{msg.text ?? msg.content ?? JSON.stringify(msg)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── Report Detail Modal ───────────────────────────────────────────────────────
// ── Refund Amount Modal ──────────────────────────────────────────────────────────────
const RefundAmountModal = ({ report, onClose, onConfirm }) => {
  // Initialize with existing amounts if available, otherwise empty
  const [workerAmount, setWorkerAmount] = useState(report.amount_worker || "");
  const [customerAmount, setCustomerAmount] = useState(report.amount_customer || "");
  const [loading, setLoading] = useState(false);

  const totalAmount = report.totalCost || report.amount || 0;
  
  const handleSubmit = async () => {
    const workerAmt = parseFloat(workerAmount) || 0;
    const customerAmt = parseFloat(customerAmount) || 0;
    
    if (workerAmt + customerAmt > totalAmount) {
      alert("Total refund amount cannot exceed the task amount!");
      return;
    }
    
    setLoading(true);
    try {
      // Changed to a single "upsert" or "update" endpoint
      // Using taskId ensures we only ever have ONE record for this task
      const response = await apiCall(`${BASE}/refunds/upsert/${report.taskId}`, {
  method: "PATCH",
  body: JSON.stringify({
    // ENSURE THESE NAMES MATCH THE PYTHON SCHEMA ABOVE
    amount_customer: parseFloat(customerAmount) || 0,
    amount_worker: parseFloat(workerAmount) || 0,
    reason: report.reason || "Adjustment",
    requested_by: "admin",
    status: "refund_in_progress" 
  }),
});
      
      if (response.ok) {
        const updatedDoc = await response.json();
        onConfirm(updatedDoc); // Pass the updated document back to parent
        onClose();
      } else {
        alert("Failed to update refund record");
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100000, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: C.surface, borderRadius: 24, padding: 28, width: 450, maxWidth: "90%", boxShadow: "0 25px 50px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.textPrimary }}>Adjust Refund</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={20} color={C.textMuted} />
          </button>
        </div>
        
        <div style={{ background: C.bg, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: C.textMuted }}>Total Task Amount:</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>NPR {totalAmount.toLocaleString()}</span>
          </div>
        </div>
        
        {/* Input for Worker */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>
            <Briefcase size={14} style={{ display: "inline", marginRight: 6 }} />
            Adjustment: Worker Payout
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, color: C.textSecond }}>NPR</span>
            <input
              type="number"
              value={workerAmount}
              onChange={(e) => setWorkerAmount(e.target.value)}
              placeholder="0.00"
              style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14 }}
            />
          </div>
        </div>
        
        {/* Input for Customer */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>
            <User size={14} style={{ display: "inline", marginRight: 6 }} />
            Adjustment: Customer Refund
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, color: C.textSecond }}>NPR</span>
            <input
              type="number"
              value={customerAmount}
              onChange={(e) => setCustomerAmount(e.target.value)}
              placeholder="0.00"
              style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14 }}
            />
          </div>
        </div>
        
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: C.green, color: "white", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Updating..." : "Update Amount"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ReportDetailModal = ({ report, onClose, onResolve, onDecline, onDelete, onRefundCreated }) => {
  const [adminNote,       setAdminNote]       = useState(report.adminNote || "");
  const [confirm,         setConfirm]         = useState(null);
  const [activeTab,       setActiveTab]       = useState("details");
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundCount,     setRefundCount]     = useState(0);
  const backdropRef = useRef(null);

  // Fetch how many refunds are already linked to this report
  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiCall(`${BASE}/refunds?report_id=${report.id}&limit=1`);
        if (res.ok) {
          const d = await res.json();
          setRefundCount(d.total ?? 0);
        }
      } catch {}
    };
    load();
  }, [report.id]);

  const handleRefundConfirm = async (refundData) => {
    setRefundCount(prev => prev + 1);
    if (onRefundCreated) {
      onRefundCreated(refundData);
    }
    setShowRefundModal(false);
  };

  const DetailRow = ({ icon: Icon, label, value }) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.divider}` }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={14} color={C.textSecond} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  );

  return (
    <>
      <div ref={backdropRef}
        onClick={e => { if (e.target === backdropRef.current) onClose(); }}
        style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(28,20,16,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div onClick={e => e.stopPropagation()}
          style={{ background: C.surface, borderRadius: 28, width: 900, height: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 60px rgba(0,0,0,0.3)", animation: "scaleIn 0.2s ease", overflow: "hidden" }}>

          {/* Header */}
          <div style={{ background: O.header, paddingTop: "20px", paddingLeft: "28px", paddingRight: "28px", flexShrink: 0, position: "relative" }}>
            <button onClick={onClose} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
              <X size={16} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Flag size={22} color="white" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 600, marginBottom: 4 }}>{shortId(report.id)}</div>
                <h2 style={{ color: "white", margin: 0, fontSize: 20, fontWeight: 700 }}>Report Details</h2>
              </div>
              {/* Linked refund indicator */}
              {refundCount > 0 && (
                <div style={{ marginLeft: "auto", background: "rgba(255,255,255,0.2)", borderRadius: 20, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                  <RotateCcw size={14} color="white" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "white" }}>{refundCount} refund{refundCount > 1 ? "s" : ""} linked</span>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <StatusBadge status={report.status} />
              <ReasonBadge reason={report.reason} />
            </div>
            <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
              {[
                { key: "details",       icon: FileText,     label: "Details" },
                { key: "customer-history", icon: User,      label: "Customer History" },
                { key: "worker-history",  icon: Briefcase,  label: "Worker History" },
                { key: "task-history",    icon: TrendingUp, label: "Task History" },
                { key: "ai-analysis",     icon: Brain,      label: "AI Analysis" },
              ].map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  style={{ padding: "8px 16px", borderRadius: "20px 20px 0 0", border: "none", background: activeTab === key ? "white" : "rgba(255,255,255,0.15)", color: activeTab === key ? O[600] : "white", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", transition: "all 0.15s", whiteSpace: "nowrap" }}>
                  <Icon size={14} />{label}
                </button>
              ))}
            </div>
          </div>

          {/* Action strip */}
          {report.status === "pending" && activeTab === "details" && (
            <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}`, background: C.bg, display: "flex", gap: 10, flexShrink: 0 }}>
              <button
                onClick={() => setConfirm({ type: "resolve", message: "Resolve this report? This will mark it as resolved." })}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: C.green, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
                <CheckCircle size={16} /> Resolve
              </button>
              <button
                onClick={() => setConfirm({ type: "decline", message: "Decline this report?", danger: true })}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: C.red, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
                <XCircle size={16} /> Decline
              </button>

              {/* Request Refund — opens refund amount modal */}
              <button
                onClick={() => setShowRefundModal(true)}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "#2E9E8E", color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit", position: "relative" }}>
                <RotateCcw size={16} />
                Request Refund
                {refundCount > 0 && (
                  <span style={{ position: "absolute", top: -6, right: -6, background: C.brand, color: "white", borderRadius: "50%", width: 18, height: 18, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {refundCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setConfirm({ type: "delete", message: "Permanently delete this report? This cannot be undone.", danger: true })}
                style={{ padding: "10px 14px", borderRadius: 10, background: C.redLight, color: C.red, border: `1px solid ${C.red}30`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Trash2 size={16} />
              </button>
            </div>
          )}

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px", background: C.bg }}>
            {activeTab === "details" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {[
                    { label: "Filed By", id: report.reporterId, type: report.reporterType, email: report.reporterEmail },
                    { label: "Reported", id: report.reportedId,  type: report.reportedType, email: report.reportedEmail },
                  ].map(({ label, id, type, email }) => (
                    <div key={label} style={{ background: C.surface, borderRadius: 16, padding: 18, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>{label}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Avatar type={type} size={44} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, wordBreak: "break-all", marginBottom: 4 }}>{id || email || "—"}</div>
                          <TypeBadge type={type} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ background: C.surface, borderRadius: 16, padding: 18, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>Description</div>
                  <p style={{ margin: 0, fontSize: 14, color: C.textSecond, lineHeight: 1.6 }}>{report.description || "No description provided."}</p>
                </div>

                <div style={{ background: C.surface, borderRadius: 16, padding: 18, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>Timeline</div>
                  <DetailRow icon={Calendar} label="Filed on" value={`${fmt(report.createdAt)} at ${fmtTime(report.createdAt)}`} />
                  {report.resolvedAt && <DetailRow icon={CheckCircle} label="Resolved on" value={`${fmt(report.resolvedAt)} at ${fmtTime(report.resolvedAt)}`} />}
                </div>

                {/* Show linked refunds summary */}
                {refundCount > 0 && (
                  <div style={{ background: "#2E9E8E15", borderRadius: 16, padding: 16, border: "1px solid #2E9E8E30", display: "flex", alignItems: "center", gap: 12 }}>
                    <RotateCcw size={18} color="#2E9E8E" />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#2E9E8E", marginBottom: 2 }}>
                        {refundCount} refund request{refundCount > 1 ? "s" : ""} linked to this report
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>View in Refund Management page</div>
                    </div>
                  </div>
                )}

                {report.status === "pending" && (
                  <div style={{ background: C.surface, borderRadius: 16, padding: 18, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>Admin Note (optional)</div>
                    <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)}
                      placeholder="Add a note about this decision..." rows={3}
                      style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", background: C.bg, color: C.textPrimary }}
                      onFocus={e => { e.target.style.borderColor = C.brand; e.target.style.background = C.surface; }}
                      onBlur={e  => { e.target.style.borderColor = C.border; e.target.style.background = C.bg; }}
                    />
                  </div>
                )}

                {report.adminNote && report.status !== "pending" && (
                  <div style={{ background: C.brandLight, borderRadius: 16, padding: 16, border: `1px solid ${C.brand}30` }}>
                    <div style={{ fontSize: 11, color: C.brand, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Admin Note</div>
                    <p style={{ margin: 0, fontSize: 13, color: C.textSecond }}>{report.adminNote}</p>
                  </div>
                )}

                {report.status !== "pending" && (
                  <button onClick={() => setConfirm({ type: "delete", message: "Permanently delete this report? This cannot be undone.", danger: true })}
                    style={{ padding: "12px", borderRadius: 12, border: `1px solid ${C.red}30`, background: C.redLight, color: C.red, fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}>
                    <Trash2 size={16} /> Delete Report
                  </button>
                )}
              </div>
            ) : activeTab === "customer-history" ? (
              <CustomerHistoryPanel customerId={report.reporterId} customerEmail={report.reporterEmail} />
            ) : activeTab === "worker-history" ? (
              <WorkerHistoryPanel workerId={report.reportedId} workerEmail={report.reportedEmail} />
            ) : activeTab === "task-history" ? (
              <TaskHistoryPanel taskId={report.taskId} />
            ) : (
              <AIAnalysisPanel report={report} />
            )}
          </div>
        </div>
      </div>

      {/* Refund Amount Modal */}
      {showRefundModal && (
        <RefundAmountModal
          report={{
            ...report,
            totalCost: report.totalCost || report.amount || 0,
          }}
          onClose={() => setShowRefundModal(false)}
          onConfirm={handleRefundConfirm}
        />
      )}

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          danger={confirm.danger}
          onConfirm={() => {
            if (confirm.type === "resolve") onResolve(report.id, adminNote);
            if (confirm.type === "decline") onDecline(report.id, adminNote);
            if (confirm.type === "delete")  onDelete(report.id);
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
};

// ── Report Table Row ──────────────────────────────────────────────────────────
const ReportRow = ({ report, onSelect, onResolve, onDecline, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const handleAction = (action) => {
    if (action === "view")    onSelect(report);
    if (action === "resolve") onResolve(report.id, "");
    if (action === "decline") onDecline(report.id, "");
    if (action === "delete")  onDelete(report.id);
  };
  return (
    <tr style={{ borderBottom: `1px solid ${C.divider}`, transition: "background 0.2s", cursor: "pointer" }}
      onClick={() => onSelect(report)}
      onMouseEnter={e => e.currentTarget.style.background = C.bg}
      onMouseLeave={e => e.currentTarget.style.background = C.surface}
    >
      <td style={{ padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar type={report.reporterType} size={38} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>{shortId(report.reporterId)}</div>
            <TypeBadge type={report.reporterType} />
          </div>
        </div>
      </td>
      <td style={{ padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar type={report.reportedType} size={38} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>{shortId(report.reportedId)}</div>
            <TypeBadge type={report.reportedType} />
          </div>
        </div>
      </td>
      <td style={{ padding: "16px" }}><ReasonBadge reason={report.reason} /></td>
      <td style={{ padding: "16px" }}><StatusBadge status={report.status} /></td>
      <td style={{ padding: "16px" }}>
        <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 500 }}>{fmt(report.createdAt)}</div>
        <div style={{ fontSize: 11, color: C.textMuted }}>{fmtTime(report.createdAt)}</div>
      </td>
      <td style={{ padding: "16px" }} onClick={e => e.stopPropagation()}>
        <div style={{ position: "relative", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => setMenuOpen(v => !v)}
            style={{ padding: "8px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", color: C.textMuted, display: "flex", alignItems: "center" }}
            onMouseEnter={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.textPrimary; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.surface; e.currentTarget.style.color = C.textMuted; }}
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && <ContextMenu report={report} onAction={handleAction} onClose={() => setMenuOpen(false)} />}
        </div>
      </td>
    </tr>
    
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function ReportManagement() {
  const [reports,            setReports]            = useState([]);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState(null);
  const [stats,              setStats]              = useState({ total: 0, pending: 0, resolved: 0, declined: 0 });
  const [searchQuery,        setSearch]             = useState("");
  const [filterStatus,       setFilterStatus]       = useState("all");
  const [filterReporterType, setFilterReporterType] = useState("all");
  const [filterReportedType, setFilterReportedType] = useState("all");
  const [showFilters,        setShowFilters]        = useState(false);
  const [selectedReport,     setSelectedReport]     = useState(null);
  const [toast,              setToast]              = useState(null);
  const [confirm,            setConfirm]            = useState(null);
  const [currentPage,        setCurrentPage]        = useState(1);
  const [totalReports,       setTotalReports]       = useState(0);
  const PAGE_SIZE = 50;

  const isFirstRender = useRef(true);
  const showToast = (msg, type = "success") => setToast({ msg, type });

  const fetchPage = async (page, search = searchQuery) => {
    try {
      setLoading(true);
      const skip = (page - 1) * PAGE_SIZE;
      const params = new URLSearchParams({ skip, limit: PAGE_SIZE });
      if (search?.trim())             params.append("search", search.trim());
      if (filterStatus !== "all")     params.append("status", filterStatus);
      if (filterReporterType !== "all") params.append("reporterType", filterReporterType);
      if (filterReportedType !== "all") params.append("reportedType", filterReportedType);
      const res = await apiCall(`${BASE}/reports?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReports(data.reports ?? []);
      setTotalReports(data.total ?? 0);
      setCurrentPage(page);
    } catch (e) {
      setError(`Failed to load reports: ${e.message}`);
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try { const res = await fetch(`${BASE}/reports/stats`); if (res.ok) setStats(await res.json()); }
    catch {}
  };

  useEffect(() => { fetchPage(1, ""); fetchStats(); }, []);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const t = setTimeout(() => fetchPage(1, searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (!isFirstRender.current) fetchPage(1, searchQuery);
  }, [filterStatus, filterReporterType, filterReportedType]);

  const handleResolve = async (reportId, adminNote) => {
  // Try JSON format first (most REST APIs expect this)
  let res = await apiCall(`${BASE}/reports/${reportId}/status`, { 
    method: "PATCH", 
    body: JSON.stringify({ status: "resolved", adminNote }),
    headers: {
      "Content-Type": "application/json"
    }
  });
  
  // If JSON fails with 422, try form-urlencoded (like Swagger)
  if (res.status === 422) {
    const formData = new URLSearchParams();
    formData.append("status", "resolved");
    if (adminNote) formData.append("adminNote", adminNote);
    
    res = await fetch(`${BASE}/reports/${reportId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(localStorage.getItem("access_token") ? { Authorization: `Bearer ${localStorage.getItem("access_token")}` } : {})
      },
      body: formData
    });
  }
  
  if (!res.ok) { 
    const errorText = await res.text();
    console.error("Failed to resolve:", errorText);
    showToast("Failed to resolve", "error"); 
    return; 
  }
  
  setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: "resolved", adminNote } : r));
  if (selectedReport?.id === reportId) setSelectedReport(p => ({ ...p, status: "resolved", adminNote }));
  setStats(p => ({ ...p, pending: p.pending - 1, resolved: p.resolved + 1 }));
  showToast("Report resolved");
};

  const handleDecline = async (reportId, adminNote) => {
    // Try JSON format first
    let res = await apiCall(`${BASE}/reports/${reportId}/status`, { 
      method: "PATCH", 
      body: JSON.stringify({ status: "declined", adminNote }),
      headers: {
        "Content-Type": "application/json"
      }
    });
    
    // If JSON fails with 422, try form-urlencoded (like Swagger)
    if (res.status === 422) {
      const formData = new URLSearchParams();
      formData.append("status", "declined");
      if (adminNote) formData.append("adminNote", adminNote);
      
      res = await fetch(`${BASE}/reports/${reportId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...(localStorage.getItem("access_token") ? { Authorization: `Bearer ${localStorage.getItem("access_token")}` } : {})
        },
        body: formData
      });
    }
    
    if (!res.ok) { 
      const errorText = await res.text();
      console.error("Failed to decline:", errorText);
      showToast("Failed to decline", "error"); 
      return; 
    }
    
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: "declined", adminNote } : r));
    if (selectedReport?.id === reportId) setSelectedReport(p => ({ ...p, status: "declined", adminNote }));
    setStats(p => ({ ...p, pending: p.pending - 1, declined: p.declined + 1 }));
    showToast("Report declined");
  };

 

  const handleDelete = async (reportId) => {
    setConfirm({
      message: "Permanently delete this report? This cannot be undone.",
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        const res = await apiCall(`${BASE}/reports/${reportId}`, { method: "DELETE" });
        if (!res.ok) { showToast("Failed to delete", "error"); return; }
        setReports(prev => prev.filter(r => r.id !== reportId));
        setTotalReports(p => p - 1);
        if (selectedReport?.id === reportId) setSelectedReport(null);
        showToast("Report deleted");
      },
    });
  };

  const totalPages = Math.ceil(totalReports / PAGE_SIZE);

  const Pill = ({ active, onClick, label }) => (
    <button onClick={onClick} style={{ padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12, border: `1px solid ${active ? C.brand + "50" : C.border}`, background: active ? C.brandLight : C.surface, color: active ? C.brand : C.textSecond, fontWeight: active ? 600 : 500, transition: "all 0.15s", fontFamily: "inherit" }}>{label}</button>
  );
  const pageBtn = (disabled) => ({ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: disabled ? C.bg : C.surface, color: disabled ? C.textMuted : C.textSecond, cursor: disabled ? "default" : "pointer", fontSize: 13, fontFamily: "inherit" });

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: C.bg, minHeight: "100vh", padding: 24 }}>
      {toast   && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {confirm && <ConfirmDialog message={confirm.message} danger={confirm.danger} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}

      <style>{`
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 700, color: C.textPrimary, letterSpacing: "-0.01em" }}>Reports Management</h1>
          <p style={{ margin: 0, fontSize: 14, color: C.textMuted }}>Review and manage reports filed by customers and workers</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { fetchPage(1, searchQuery); fetchStats(); }}
            style={{ padding: "10px 18px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", fontSize: 14, color: C.textSecond, display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}
            onMouseEnter={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.brand; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.surface; e.currentTarget.style.color = C.textSecond; }}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={() => setShowFilters(v => !v)}
            style={{ padding: "10px 18px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", fontSize: 14, fontWeight: 500, color: C.textSecond, display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}
            onMouseEnter={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.brand; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.surface; e.currentTarget.style.color = C.textSecond; }}>
            <Filter size={16} /> Filters
            <ChevronDown size={14} style={{ transform: showFilters ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Reports" value={stats.total}    color={C.brand} icon={Flag}        />
        <StatCard label="Pending"       value={stats.pending}  color={C.brand} icon={Clock}        sub="Awaiting review" />
        <StatCard label="Resolved"      value={stats.resolved} color={C.green} icon={CheckCircle}  />
        <StatCard label="Declined"      value={stats.declined} color={C.red}   icon={XCircle}      />
      </div>

      <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: showFilters ? 16 : 0 }}>
          <div style={{ flex: 2, position: "relative", minWidth: 280 }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted }} />
            <input type="text" placeholder="Search by ID, reason, description..."
              value={searchQuery} onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "10px 12px 10px 38px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, outline: "none", background: C.bg, boxSizing: "border-box", color: C.textPrimary, fontFamily: "inherit" }}
              onFocus={e => { e.target.style.borderColor = C.brand; e.target.style.background = C.surface; }}
              onBlur={e  => { e.target.style.borderColor = C.border; e.target.style.background = C.bg; }}
            />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Pill active={filterStatus === "all"}      onClick={() => setFilterStatus("all")}      label="All"      />
            <Pill active={filterStatus === "pending"}  onClick={() => setFilterStatus("pending")}  label="Pending"  />
            <Pill active={filterStatus === "resolved"} onClick={() => setFilterStatus("resolved")} label="Resolved" />
            <Pill active={filterStatus === "declined"} onClick={() => setFilterStatus("declined")} label="Declined" />
          </div>
        </div>
        {showFilters && (
          <div style={{ display: "flex", gap: 12, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
            <select value={filterReporterType} onChange={e => setFilterReporterType(e.target.value)}
              style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", background: C.bg, cursor: "pointer", minWidth: 160, color: C.textSecond, fontFamily: "inherit" }}>
              <option value="all">All Reporters</option>
              <option value="customer">Customers</option>
              <option value="worker">Workers</option>
            </select>
            <select value={filterReportedType} onChange={e => setFilterReportedType(e.target.value)}
              style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", background: C.bg, cursor: "pointer", minWidth: 160, color: C.textSecond, fontFamily: "inherit" }}>
              <option value="all">All Reported</option>
              <option value="customer">Customers</option>
              <option value="worker">Workers</option>
            </select>
          </div>
        )}
      </div>

      <div style={{ background: C.surface, borderRadius: 20, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
        {loading ? (
          <div style={{ padding: 80, textAlign: "center" }}>
            <RefreshCw size={40} style={{ color: C.brand, marginBottom: 16, animation: "spin 1s linear infinite" }} />
            <p style={{ color: C.textSecond, margin: 0, fontSize: 15 }}>Loading reports...</p>
          </div>
        ) : error ? (
          <div style={{ padding: 80, textAlign: "center" }}>
            <AlertTriangle size={40} style={{ color: C.red, marginBottom: 16 }} />
            <p style={{ color: C.red, margin: 0, fontSize: 15 }}>{error}</p>
          </div>
        ) : reports.length === 0 ? (
          <div style={{ padding: 80, textAlign: "center" }}>
            <Flag size={48} style={{ color: C.textMuted, marginBottom: 16 }} />
            <h3 style={{ margin: "0 0 8px", color: C.textPrimary, fontSize: 18 }}>No reports found</h3>
            <p style={{ color: C.textMuted, margin: 0, fontSize: 14 }}>
              {searchQuery || filterStatus !== "all" ? "Try adjusting your filters" : "No reports have been filed yet"}
            </p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `2px solid ${C.border}` }}>
                {["Reporter", "Reported", "Reason", "Status", "Date", ""].map((h, i) => (
                  <th key={h} style={{ padding: "14px 16px", textAlign: i === 5 ? "right" : "left", fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map(report => (
                <ReportRow key={report.id} report={report} onSelect={setSelectedReport} onResolve={handleResolve} onDecline={handleDecline} onDelete={handleDelete} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && !error && totalReports > 0 && (
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>
            Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, totalReports)} of {totalReports} reports
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => fetchPage(1, searchQuery)} disabled={currentPage === 1} style={pageBtn(currentPage === 1)}>«</button>
            <button onClick={() => fetchPage(currentPage - 1, searchQuery)} disabled={currentPage === 1} style={pageBtn(currentPage === 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx-1] > 1) acc.push("..."); acc.push(p); return acc; }, [])
              .map((p, i) => p === "..." ? (
                <span key={`d${i}`} style={{ padding: "6px 8px", fontSize: 13, color: C.textMuted }}>…</span>
              ) : (
                <button key={p} onClick={() => fetchPage(p, searchQuery)}
                  style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: currentPage === p ? C.textPrimary : C.surface, color: currentPage === p ? "white" : C.textSecond, cursor: "pointer", fontSize: 13, fontWeight: currentPage === p ? 700 : 500, fontFamily: "inherit" }}>{p}
                </button>
              ))}
            <button onClick={() => fetchPage(currentPage + 1, searchQuery)} disabled={currentPage >= totalPages} style={pageBtn(currentPage >= totalPages)}>›</button>
            <button onClick={() => fetchPage(totalPages, searchQuery)} disabled={currentPage >= totalPages} style={pageBtn(currentPage >= totalPages)}>»</button>
          </div>
        </div>
      )}

      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onResolve={handleResolve}
          onDecline={handleDecline}
          onDelete={handleDelete}
          onRefundCreated={(refund) => {
            showToast("Refund request created ✓", "success");
          }}
        />
      )}
    </div>
  );
}