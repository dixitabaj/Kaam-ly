import React, { useState, useEffect } from "react";
import {
  getAdminStats,
  getUserGrowth,
  getAdminAlerts,
  getTopLocations,
  pendingActivities,
} from "../../api/api";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  Users, Briefcase, DollarSign, CheckCircle, XCircle,
  TrendingUp, Filter, MoreVertical,
  Star, MapPin, AlertTriangle, ClipboardList, AlertCircle,
  ShieldAlert, FileWarning, Clock, Wallet, ChevronRight,
} from "lucide-react";
import WorkerManagement from "./workerManagement";
import AdminSidebar from "./AdminSidebar";
import ReportManagement from "./ReportDashboard";
import TaskManagement from "./taskPage";
import BookingNavbar from "../../components/Navbar/Navbar";
import CustomerManagement from "./customerManagement";
import FraudDetectionBoard from "./FraudDetectionBoard";
import "./adminDashboard.css";

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ background: `${color}15`, color }}>
      <Icon size={22} />
    </div>
    <div className="stat-content">
      <h3>{title}</h3>
      <div className="stat-value">{value}</div>
    </div>
  </div>
);

// ── User Row ──────────────────────────────────────────────────────────────────
const UserRow = ({ user, onStatusUpdate }) => (
  <tr className="user-row">
    <td>
      <div className="user-cell">
        <div className="user-avatar">{user.name?.[0]}</div>
        <div>
          <div className="user-name">{user.name}</div>
          <div className="user-email">{user.email}</div>
        </div>
      </div>
    </td>
    <td>{user.type}</td>
    <td>{user.tasks || 0}</td>
    <td><span className={`status-badge ${user.status}`}>{user.status}</span></td>
    <td>
      <div className="action-buttons">
        <button className="action-btn approve" onClick={() => onStatusUpdate(user.id, "active")}><CheckCircle size={15} /></button>
        <button className="action-btn reject"  onClick={() => onStatusUpdate(user.id, "suspended")}><XCircle size={15} /></button>
        <button className="action-btn more"><MoreVertical size={15} /></button>
      </div>
    </td>
  </tr>
);

// ── Revenue by Location ───────────────────────────────────────────────────────
const SalesByLocation = ({ data }) => (
  <div className="sales-location-card">
    <div className="card-heading">
      <MapPin size={15} />
      <h3>Revenue by Location</h3>
    </div>
    <div className="location-list">
      {data.map((location, index) => (
        <div key={index} className="location-item">
          <div className="location-info">
            <div className="location-dot" style={{ background: location.color }} />
            <span className="location-name">{location.name}</span>
          </div>
          <div className="location-bar-wrap">
            <div className="location-bar">
              <div className="location-bar-fill" style={{ width: `${location.percent}%`, background: location.color }} />
            </div>
            <span className="location-amount">NPR {location.amount}</span>
          </div>
        </div>
      ))}
    </div>
    <div className="location-footer">
      <span>Total Revenue</span>
      <strong>NPR {data.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0).toLocaleString()}</strong>
    </div>
  </div>
);

// ── Growth Chart ──────────────────────────────────────────────────────────────
const WorkerCustomerChart = ({ data, period, onPeriodChange }) => (
  <div className="chart-card">
    <div className="chart-card-header">
      <div className="card-heading">
        <TrendingUp size={15} />
        <h3>Workers vs Customers Growth</h3>
      </div>
      <div className="period-group">
        {["day", "week", "month", "year"].map(p => (
          <button key={p} onClick={() => onPeriodChange(p)} className={`period-btn ${period === p ? "active" : ""}`}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
    </div>
    {data.length === 0 ? (
      <div className="chart-empty">No data available for this period</div>
    ) : (
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDE8DF" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#B0A89E" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#B0A89E" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ backgroundColor: "white", border: "1px solid #EDE8DF", borderRadius: "8px", fontSize: "12px", boxShadow: "0 4px 12px rgba(100,60,20,0.10)" }} />
          <Line type="monotone" dataKey="workers"   stroke="#E8843A" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Workers" />
          <Line type="monotone" dataKey="customers" stroke="#3D7EC9" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Customers" />
        </LineChart>
      </ResponsiveContainer>
    )}
    <div className="chart-legend">
      <div className="legend-item"><span className="legend-dot" style={{ background: "#E8843A" }} /><span>Workers</span></div>
      <div className="legend-item"><span className="legend-dot" style={{ background: "#3D7EC9" }} /><span>Customers</span></div>
    </div>
  </div>
);

// ── Report Pie Chart ──────────────────────────────────────────────────────────
const ReportPieChart = ({ pending, resolved, declined }) => {
  const data = [
    { name: "Pending",  value: pending  || 0 },
    { name: "Resolved", value: resolved || 0 },
    { name: "Declined", value: declined || 0 },
  ]

  const COLORS = { Pending: "#E8843A", Resolved: "#3D9E6E", Declined: "#D94F3D" };

  return (
    <div className="pie-chart-card">
      <div className="card-heading">
        <AlertCircle size={15} />
        <h3>Reports by Status</h3>
      </div>
      {data.length === 0 ? (
        <div className="chart-empty">No report data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={data} cx="50%" cy="45%" innerRadius={60} outerRadius={95} dataKey="value" nameKey="name" paddingAngle={3}>
              {data.map(entry => <Cell key={entry.name} fill={COLORS[entry.name]} />)}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: "white", border: "1px solid #EDE8DF", borderRadius: "8px", fontSize: "12px", boxShadow: "0 4px 12px rgba(100,60,20,0.10)" }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

// ── Pending Actions Card ──────────────────────────────────────────────────────
const PENDING_CONFIG = [
  {
    key:     "pending_verifications",
    icon:    ShieldAlert,
    color:   "#E8843A",
    bg:      "#E8843A14",
    label:   (n) => `${n} worker${n !== 1 ? "s" : ""} waiting for verification`,
    sub:     "Review submitted ID & skill certificates",
    tab:     "workers",
    action:  "Verify",
  },
  {
    key:     "pending_reports",
    icon:    FileWarning,
    color:   "#D94F3D",
    bg:      "#D94F3D11",
    label:   (n) => `${n} report${n !== 1 ? "s" : ""} awaiting admin review`,
    sub:     "Users or workers have been reported",
    tab:     "reports",
    action:  "Review",
  },
  {
    key:     "overdue_tasks",
    icon:    Clock,
    color:   "#C9883A",
    bg:      "#C9883A14",
    label:   (n) => `${n} task${n !== 1 ? "s" : ""} exceeding estimated time`,
    sub:     "Ongoing jobs past their estimated completion",
    tab:     "tasks",
    action:  "View",
  },
  {
    key:     "pending_worker_payments",
    icon:    Wallet,
    color:   "#3D7EC9",
    bg:      "#3D7EC914",
    label:   (n) => `${n} completed task${n !== 1 ? "s" : ""} with held escrow`,
    sub:     "Payment not yet released to worker",
    tab:     "tasks",
    action:  "Release",
  },
];

const PendingActionsCard = ({ data, onNavigate }) => {
  const activeItems  = PENDING_CONFIG.filter(cfg => (data?.[cfg.key] ?? 0) > 0);
  const totalActions = PENDING_CONFIG.reduce((sum, cfg) => sum + (data?.[cfg.key] ?? 0), 0);

  return (
    <div style={{ background: "white", borderRadius: 20, border: "1px solid #EDE8DF", overflow: "hidden", boxShadow: "0 2px 12px rgba(100,60,20,0.06)" }}>

      {/* Header */}
      <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #F7F4EF", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ClipboardList size={15} color="#E8843A" />
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1C1410" }}>Pending Actions</h3>
        </div>
        {totalActions > 0 ? (
          <span style={{ background: "#D94F3D", color: "white", fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "2px 9px" }}>
            {totalActions}
          </span>
        ) : (
          <CheckCircle size={16} color="#3D9E6E" />
        )}
      </div>

      {/* Items */}
      <div style={{ padding: "10px 12px 12px" }}>
        {activeItems.length === 0 ? (
          <div style={{ padding: "24px 0", textAlign: "center" }}>
            <CheckCircle size={28} color="#3D9E6E" style={{ marginBottom: 8, opacity: 0.6 }} />
            <p style={{ margin: 0, fontSize: 13, color: "#7A6E65" }}>All clear — nothing needs attention</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {activeItems.map(cfg => {
              const count = data[cfg.key];
              const Icon  = cfg.icon;
              return (
                <div
                  key={cfg.key}
                  onClick={() => onNavigate?.(cfg.tab)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: cfg.bg, border: `1px solid ${cfg.color}25`, cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateX(2px)"; e.currentTarget.style.borderColor = `${cfg.color}55`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateX(0)";   e.currentTarget.style.borderColor = `${cfg.color}25`; }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 2px 8px ${cfg.color}22` }}>
                    <Icon size={17} color={cfg.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1C1410", marginBottom: 2, lineHeight: 1.3 }}>{cfg.label(count)}</div>
                    <div style={{ fontSize: 11, color: "#7A6E65" }}>{cfg.sub}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span style={{ background: cfg.color, color: "white", fontSize: 12, fontWeight: 700, borderRadius: 8, padding: "2px 9px", minWidth: 24, textAlign: "center" }}>{count}</span>
                    <ChevronRight size={14} color={cfg.color} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {activeItems.length > 0 && (
        <div style={{ padding: "10px 20px 14px", borderTop: "1px solid #F7F4EF", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "#B0A89E" }}>{activeItems.length} categor{activeItems.length !== 1 ? "ies" : "y"} need attention</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#D94F3D" }}>{totalActions} total items</span>
        </div>
      )}
    </div>
  );
};

// ── Alerts Card ───────────────────────────────────────────────────────────────
const AlertsCard = ({ alerts }) => (
  <div className="alerts-card">
    <div className="card-heading">
      <AlertTriangle size={15} />
      <h3>System Alerts</h3>
    </div>
    <div className="alerts-list">
      {alerts.length === 0
        ? <div className="alert-item info"><span className="alert-dot" /><span>No active alerts</span></div>
        : alerts.map(alert => (
          <div key={alert.id} className={`alert-item ${alert.type}`}>
            <span className="alert-dot" />
            <span>{alert.message}</span>
          </div>
        ))}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [activeTab,      setActiveTab]      = useState("dashboard");
  const [loading,        setLoading]        = useState(true);

  const [adminStats,     setAdminStats]     = useState(null);
  const [growthData,     setGrowthData]     = useState([]);
  const [growthPeriod,   setGrowthPeriod]   = useState("month");
  const [alertsList,     setAlertsList]     = useState([]);
  const [salesByLocation,setSalesByLocation]= useState([]);

  // pendingData holds raw API response:
  // { pending_verifications, pending_reports, overdue_tasks, pending_worker_payments }
  const [pendingData,    setPendingData]    = useState(null);

  // ── Admin stats ──
  useEffect(() => {
    const fetch_ = async () => {
      try {
        const stats = await getAdminStats();
        if (stats) setAdminStats(stats);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch_();
    const id = setInterval(fetch_, 30000);
    return () => clearInterval(id);
  }, []);

  // ── Pending activities ──
  useEffect(() => {
    const fetchPending = async () => {
      try {
        const data = await pendingActivities();
        console.log("Pending activities:", data);
        if (!data) return;
        // Pass raw API response directly — PendingActionsCard handles display logic
        setPendingData(data);
      } catch (err) { console.error(err); }
    };
    fetchPending();
    const id = setInterval(fetchPending, 30000);
    return () => clearInterval(id);
  }, []);

  // ── Growth ──
  useEffect(() => {
    const fetch_ = async () => {
      try {
        const data = await getUserGrowth(growthPeriod);
        if (Array.isArray(data)) setGrowthData(data);
      } catch (err) { console.error(err); }
    };
    fetch_();
    const id = setInterval(fetch_, 30000);
    return () => clearInterval(id);
  }, [growthPeriod]);

  // ── Alerts ──
  useEffect(() => {
    const fetch_ = async () => {
      try {
        const data = await getAdminAlerts();
        console.log("Raw alerts data:", data);
        if (!data) return;
        const mapped = [
          data["pending verification process"] > 0 && { id: 1, type: "warning", message: `${data["pending verification process"]} workers pending verification` },
          data["flagged_workers"]              > 0 && { id: 2, type: "high",    message: `${data["flagged_workers"]} workers flagged by reports` },
          data["declined task"]                > 0 && { id: 3, type: "info",    message: `${data["declined task"]} tasks declined` },
          data["pending payment"]              > 0 && { id: 4, type: "warning", message: `${data["pending payment"]} pending payments` },
          data["overdue tasks"]                > 0 && { id: 5, type: "high",    message: `${data["overdue tasks"]} tasks ongoing over 7 days` },
          data["low rated workers"]            > 0 && { id: 6, type: "warning", message: `${data["low rated workers"]} workers rated below 2.0` },
          data["unassigned tasks"]             > 0 && { id: 7, type: "info",    message: `${data["unassigned tasks"]} tasks waiting for a worker` },
          data["stuck escrow"]                 > 0 && { id: 8, type: "high",    message: `${data["stuck escrow"]} escrow payments stuck over 3 days` },
        ].filter(Boolean);
        console.log("Fetched alerts:", mapped);
        setAlertsList(mapped);
      } catch (err) { console.error(err); }
    };
    fetch_();
    const id = setInterval(fetch_, 30000);
    return () => clearInterval(id);
  }, []);

  // ── Locations ──
  useEffect(() => {
    const fetch_ = async () => {
      try {
        const data = await getTopLocations();
        if (Array.isArray(data)) setSalesByLocation(data);
      } catch {
        setSalesByLocation([
          { name: "Kathmandu", percent: 40, amount: "12000", color: "#E8843A" },
          { name: "Lalitpur",  percent: 25, amount: "7500",  color: "#3D7EC9" },
          { name: "Bhaktapur", percent: 20, amount: "6000",  color: "#3D9E6E" },
          { name: "Pokhara",   percent: 15, amount: "4500",  color: "#9B6FD4" },
        ]);
      }
    };
    fetch_();
  }, []);

  if (loading) return (
    <div className="admin-loading">
      <div className="loading-spinner" />
      <p>Loading dashboard...</p>
    </div>
  );

  return (
    <>
      <BookingNavbar />
      <div className="admin-dashboard">
        <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="admin-main">
          <div className="admin-content">

            {activeTab === "dashboard" && (
              <>
                {/* Stat cards */}
                <div className="stats-grid">
                  <StatCard title="Total Workers"   value={adminStats?.["total worker"]         ?? "—"} icon={Briefcase}   color="#E8843A" />
                  <StatCard title="Total Customers"  value={adminStats?.["total customer"]        ?? "—"} icon={Users}       color="#3D7EC9" />
                  <StatCard title="Completed Tasks"  value={adminStats?.["total completed task"]  ?? "—"} icon={CheckCircle} color="#3D9E6E" />
                  <StatCard title="Platform Fees"    value={`NPR ${adminStats?.["platform_fees"]?.toFixed(0) ?? "—"}`} icon={DollarSign} color="#9B6FD4" />
                </div>

                {/* Growth chart + Report pie */}
                <div className="chart-row">
                  <WorkerCustomerChart data={growthData} period={growthPeriod} onPeriodChange={setGrowthPeriod} />
                  <ReportPieChart
                    pending={adminStats?.["pending reports"]}
                    resolved={adminStats?.["resolved report"]}
                    declined={adminStats?.["declined report"]}
                  />
                </div>

                {/* Alerts + Pending Actions + Location */}
                <div className="dashboard-grid">
                  <div className="dashboard-left">
                    <div className="alerts-activity-row">
                      <AlertsCard alerts={alertsList} />
                      <PendingActionsCard
                        data={pendingData}
                        onNavigate={(tab) => setActiveTab(tab)}
                      />
                    </div>
                  </div>
                  <div className="dashboard-right">
                    <SalesByLocation data={salesByLocation} />
                  </div>
                </div>
              </>
            )}

           

            {activeTab === "workers"   && <WorkerManagement />}
            {activeTab === "tasks"     && <TaskManagement />}
            {activeTab === "reports"   && <ReportManagement />}
            {activeTab === "customers" && <CustomerManagement />}
            {activeTab === "fraud"     && <FraudDetectionBoard />}



          </div>
        </main>
      </div>
    </>
  );
}