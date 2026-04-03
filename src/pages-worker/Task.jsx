import React, { useState, useEffect } from "react";
import Sidebar from "./sidebar";
import BookingNavbar from "../components/Navbar/Navbar";

const FontLink = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; }
    .task-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08) !important; }
    .task-card { transition: transform 0.2s, box-shadow 0.2s; }
  `}</style>
);

const parseDate = (str) => {
  if (!str) return null;
  const match = str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) return new Date(`${match[3]}-${match[2]}-${match[1]}`);
  const d = new Date(str);
  return isNaN(d) ? null : d;
};

const formatDateShort = (str) => {
  const d = parseDate(str);
  if (!d) return str || "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const Sparkline = ({ color = "#22c55e", up = true }) => (
  <svg width="60" height="28" viewBox="0 0 60 28" fill="none">
    <polyline
      points={up ? "0,22 10,18 20,20 30,12 40,14 50,6 60,4" : "0,4 10,8 20,6 30,14 40,12 50,20 60,22"}
      stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"
    />
  </svg>
);

const StatCard = ({ label, value, sub, trendUp, sparkColor }) => (
  <div className="task-card" style={{ flex: 1, minWidth: 150, background: "#fff", border: "1px solid #ebebeb", borderRadius: 14, padding: "1rem 1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
         <div style={{ fontSize: "11px", color: "#888",   marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
    <div style={{ fontSize: "22px", fontWeight: 700, fontFamily: "'inter'", color: "#1a1a1a" }}>{value}</div>
  
        {sub && <div style={{ fontSize: "0.72rem", color: trendUp ? "#16a34a" : "#dc2626", marginTop: 4 }}>{trendUp ? "↑" : "↓"} {sub}</div>}
      </div>
      <Sparkline color={sparkColor} up={trendUp} />
    </div>
  </div>
);


const ProgressBar = ({ label, value, total, color }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginBottom: "1.15rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: "0.78rem", color: "#555", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: "0.78rem", color: "#999" }}>{value} <span style={{ color: "#ddd" }}>/ {total}</span></span>
      </div>
      <div style={{ height: 7, background: "#f0efea", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99 }} />
      </div>
    </div>
  );
};

const statusMap = {
  completed:   { bg: "#dcfce7", color: "#15803d", dot: "#15803d" },
  pending:     { bg: "#fef9c3", color: "#a16207", dot: "#ca8a04" },
  accepted:    { bg: "#dbeafe", color: "#1d4ed8", dot: "#2563eb" },
  in_progress: { bg: "#ede9fe", color: "#6d28d9", dot: "#7c3aed" },
  cancelled:   { bg: "#fee2e2", color: "#b91c1c", dot: "#dc2626" },
};

const StatusDot = ({ status }) => {
  const s = statusMap[status?.toLowerCase()] || { bg: "#f0f0f0", color: "#666", dot: "#999" };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 99, padding: "3px 10px", fontSize: "0.7rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, textTransform: "capitalize" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
      {(status || "unknown").replace("_", " ")}
    </span>
  );
};

export default function Tasks() {
  const [stats, setStats]     = useState(null);
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);

  const userString =  localStorage.getItem("user") || sessionStorage.getItem("user");
  const workerId   = userString ? JSON.parse(userString)?.id || JSON.parse(userString)?.email : null;

  useEffect(() => {
    if (!workerId) { 
        setLoading(false); return; }
    fetch(`http://localhost:8000/api/stats/${encodeURIComponent(workerId)}`)
      .then(r => r.json())
      .then(data => {
        setStats(data);
        const all = [...(data.tasksToday || []), ...(data.tasksTomorrow || []), ...(data.tasksNextWeek || [])];
        const seen = new Set();
        const unique = all.filter(t => { if (seen.has(t._id)) return false; seen.add(t._id); return true; });
        setTasks([...unique].reverse());
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [workerId]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "DM Sans", color: "#999" }}>Loading…</div>
  );

  const total        = stats?.totalTasks      ?? tasks.length;
  const completed    = stats?.tasksCompleted  ?? tasks.filter(t => t.status === "completed").length;
  const pending      = stats?.tasksPending    ?? tasks.filter(t => t.status === "pending").length;
  const inProgress   = stats?.tasksInProgress ?? tasks.filter(t => t.status === "in_progress").length;
  const cancelled    = stats?.tasksCancelled  ?? tasks.filter(t => t.status === "cancelled").length;
  const accepted     = tasks.filter(t => t.status === "accepted").length;
  const compRate     = total > 0 ? Math.round((completed / total) * 100) : 0;
  const totalRevenue = tasks.reduce((s, t) => s + (t.totalCost || t.basePrice || 0), 0);
  const avgCost      = total > 0 ? Math.round(totalRevenue / total) : 0;



  const upcoming = tasks
    .filter(t => !["completed", "cancelled"].includes(t.status?.toLowerCase()))
    .slice(0, 8);

  return (
    <>
      <FontLink />
      <BookingNavbar />
      <div style={{ display: "flex", minHeight: "100vh", background: "#F7F5EF", fontFamily: "'DM Sans', sans-serif", }}>
        <Sidebar workerId={workerId} />
        <main style={{ flex: 1, padding: "2rem", maxWidth: 1100, margin: "0 auto", backgroundColor: "#F7F5EF", minHeight: "100vh" }}>

          {/* HEADER */}
          <div style={{ marginBottom: "1.75rem" }}>
            <h1 style={{ fontFamily: "'inter', serif", fontSize: "1.75rem", margin: 0,   marginTop: "10px"  }}>Task Overview</h1>
            <p style={{ margin: "0px 0 0", fontSize: "0.83rem", color: "#aaa" }}>Your task performance and upcoming schedule</p>
          </div>

          {/* STAT CARDS */}
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap",  marginTop: "20px"  }}>
            <StatCard label="Total Tasks"    value={total}      sub={`${compRate}% completion rate`}  trendUp={true}         sparkColor="#6366f1" />
            <StatCard label="Completed"      value={completed}  sub="tasks done"                      trendUp={true}         sparkColor="#22c55e" />
            <StatCard label="Pending"        value={pending}    sub="awaiting start"                  trendUp={false}        sparkColor="#f59e0b" />
            <StatCard label="In Progress"    value={inProgress} sub="currently active"                trendUp={inProgress>0} sparkColor="#0ea5e9" />
            <StatCard label="Avg Task Value" value={`Rs. ${avgCost.toLocaleString()}`} sub="per task" trendUp={true}        sparkColor="#8b5cf6" />
          </div>

          {/* MAIN ROW: Left = Upcoming Tasks (wide), Right = stacked panels */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem", alignItems: "start", marginTop: "20px" }}>

            {/* ── LEFT: Upcoming Tasks ── */}
            <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 16, overflow: "hidden", height: "405px" }}>
              <div style={{ padding: "1.1rem 1.5rem", borderBottom: "1px solid #f0efea", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Upcoming Tasks</div>
                <span style={{ background: "#f0efea", borderRadius: 99, padding: "2px 8px", fontSize: "0.7rem", color: "#666" }}>
                  {upcoming.length} active
                </span>
              </div>
              {upcoming.length === 0 ? (
                <div style={{ padding: "4rem", textAlign: "center", color: "#ccc", fontSize: "0.85rem" }}>No upcoming tasks 🎉</div>
              ) : upcoming.map((task, i) => (
                <div key={task._id || i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "1rem 1.5rem",
                  borderBottom: i < upcoming.length - 1 ? "1px solid #f5f5f3" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: "#f0efea", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>
                      🔧
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.86rem", color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {task.title || task.taskName || "Untitled"}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#bbb", marginTop: 3 }}>
                        {task.address ? `📍 ${task.address}` : `📅 ${formatDateShort(task.serviceDate)}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginLeft: 12 }}>
                    <StatusDot status={task.status} />
                    {(task.totalCost || task.basePrice) ? (
                      <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#111", minWidth: 70, textAlign: "right" }}>
                        Rs. {(task.totalCost || task.basePrice).toLocaleString()}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {/* ── RIGHT: Stacked panels ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>


              {/* Task Progress */}
              <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 16, padding: "1.25rem", height:"405px" }}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Task Progress</div>
                <div style={{ fontSize: "0.72rem", color: "#bbb", marginBottom: "1.45rem", marginTop: 2 }}>Breakdown by status</div>
                <ProgressBar label="Completed"   value={completed}  total={total} color="#22c55e"  />
                <ProgressBar label="In Progress" value={inProgress} total={total} color="#6366f1" />
                <ProgressBar label="Pending"     value={pending}    total={total} color="#f59e0b" />
                <ProgressBar label="Accepted"    value={accepted}   total={total} color="#0ea5e9" />
                <ProgressBar label="Cancelled"   value={cancelled}  total={total} color="#ef4444" />
                <div style={{
                  marginTop: "1.6rem", padding: "0.75rem",
                  background: compRate >= 70 ? "#dcfce7" : compRate >= 40 ? "#fef9c3" : "#fee2e2",
                  borderRadius: 12, display: "flex", alignItems: "center", gap: 10, 
                }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: compRate >= 70 ? "#15803d" : compRate >= 40 ? "#a16207" : "#b91c1c" }}>
                    {compRate}%
                  </div>
                  <div>
                    <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#333"  }}>Completion Rate</div>
                    <div style={{ fontSize: "0.68rem", color: "#999" }}>
                      {compRate >= 70 ? "Great job! 🎉" : compRate >= 40 ? "Keep it up 💪" : "Needs attention ⚠️"}
                    </div>
                  </div>
                </div>
              </div>

             

            </div>
            {/* END RIGHT */}

          </div>
        </main>
      </div>
    </>
  );
}