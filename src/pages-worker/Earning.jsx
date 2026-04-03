import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { workerStats, workerEarnings, getRecentPayouts } from "../api/api";
import Sidebar from "./sidebar";
import BookingNavbar from "../components/Navbar/Navbar";

const FontLink = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; }
    .earn-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08) !important; }
    .earn-card { transition: transform 0.2s, box-shadow 0.2s; }
  `}</style>
);

/* ─── Sparkline ──────────────────────────────────────────────── */
const Sparkline = ({ color = "#22c55e", up = true }) => (
  <svg width="60" height="28" viewBox="0 0 60 28" fill="none">
    <polyline
      points={up
        ? "0,22 10,18 20,20 30,12 40,14 50,6 60,4"
        : "0,4 10,8 20,6 30,14 40,12 50,20 60,22"}
      stroke={color} strokeWidth="1.8" fill="none"
      strokeLinecap="round" strokeLinejoin="round"
    />
  </svg>
);

/* ─── Stat Card ──────────────────────────────────────────────── */
const StatCard = ({  label, value, sub, trendUp, sparkColor }) => (
  <div className="earn-card" style={{
    flex: 1, minWidth: 160,
    background: "#fff", border: "1px solid #ebebeb",
    borderRadius: 14, padding: "1rem 1.25rem",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
         <div style={{ fontSize: "11px", color: "#888",   marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: "22px", fontWeight: 700, fontFamily: "'inter'", color: "#1a1a1a" }}>{value}</div>
  
        {sub && (
          <div style={{ fontSize: "0.72rem", color: trendUp ? "#16a34a" : "#dc2626", marginTop: 4 }}>
            {trendUp ? "↑" : "↓"} {sub}
          </div>
        )}
      </div>
      <Sparkline color={sparkColor} up={trendUp} />
    </div>
  </div>
);

/* ─── Progress Bar ───────────────────────────────────────────── */
const ProgressBar = ({ label, value, max, color, prefix = "Rs." }) => {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: "0.8rem", color: "#555", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: "0.8rem", color: "#999" }}>{prefix} {value.toLocaleString()}</span>
      </div>
      <div style={{ height: 7, background: "#f0efea", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.5s" }} />
      </div>
    </div>
  );
};

/* ─── Custom Tooltip ─────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: "#fff", border: "1px solid #ebebeb", borderRadius: 10,
        padding: "8px 14px", fontSize: "0.82rem",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      }}>
        <div style={{ color: "#aaa", marginBottom: 2 }}>{label}</div>
        <div style={{ fontWeight: 700, color: "#111" }}>Rs. {payload[0].value?.toLocaleString()}</div>
      </div>
    );
  }
  return null;
};

/* ─── Payout Row ─────────────────────────────────────────────── */
const PayoutRow = ({ label, date, amount, status }) => {
  const isReceived = status === "received";
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 0", borderBottom: "1px solid #f5f4f0",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
          background: isReceived ? "#dcfce7" : "#fef9c3",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14,
        }}>
          {isReceived ? "✓" : "⏳"}
        </div>
        <div>
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1a1a1a" }}>{label}</div>
          <div style={{ fontSize: "0.7rem", color: "#aaa", marginTop: 1 }}>{date}</div>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: isReceived ? "#15803d" : "#a16207" }}>
          Rs. {amount.toLocaleString()}
        </div>
        <div style={{
          fontSize: "0.65rem", fontWeight: 600, marginTop: 2,
          color: isReceived ? "#16a34a" : "#ca8a04",
          background: isReceived ? "#dcfce7" : "#fef9c3",
          padding: "1px 6px", borderRadius: 100, display: "inline-block",
        }}>
          {isReceived ? "Received" : "Pending"}
        </div>
      </div>
    </div>
  );
};

/* ─── MAIN ───────────────────────────────────────────────────── */
export default function EarningDashboard() {
  const [stats, setStats]             = useState(null);
  const [earnings, setEarnings]       = useState(null);
  const [loading, setLoading]         = useState(true);
  const [chartFilter, setChartFilter] = useState("month");
  const [recentPayouts, setRecentPayouts] = useState([]);

  const userString = localStorage.getItem("user") || sessionStorage.getItem("user");
  const workerId   = userString
    ? JSON.parse(userString)?.id || JSON.parse(userString)?.email
    : null;

  useEffect(() => {
    if (!workerId) { setLoading(false); return; }

    const fetchAll = async () => {
      try {
        const [statsRes, earningsRes, recentPayoutsRes] = await Promise.allSettled([
          workerStats(workerId),
          workerEarnings(workerId),
          getRecentPayouts(workerId),
        ]);
        if (statsRes.status === "fulfilled")    setStats(statsRes.value);
        if (earningsRes.status === "fulfilled") setEarnings(earningsRes.value);
        if (recentPayoutsRes.status === "fulfilled") setRecentPayouts(recentPayoutsRes.value || []);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [workerId]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "DM Sans", color: "#999" }}>
      Loading…
    </div>
  );

  if (!stats && !earnings) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "DM Sans", color: "#999" }}>
      No data available.
    </div>
  );

  const totalEarnings = stats?.totalEarnings  ?? 0;
  const todayEarnings = earnings?.todayEarnings ?? 0;
  const weekEarnings  = earnings?.weekEarnings  ?? 0;
  const monthEarnings = earnings?.monthEarnings ?? 0;
  // Pending = not yet transferred to wallet; received = already paid out
  const pendingAmount  = earnings?.pendingAmount  ?? stats?.pendingEarnings  ?? Math.round(totalEarnings * 0.07);
  const receivedAmount = earnings?.receivedAmount ?? stats?.receivedEarnings ?? (totalEarnings - pendingAmount);

  // Derived stats
  const totalTasks = stats?.totalTasks     ?? 0;
  const completed  = stats?.tasksCompleted ?? 0;
  const avgPerTask = completed > 0 ? Math.round(totalEarnings / completed) : 0;
  const compRate   = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

  // Chart data
  const now = new Date();
  const allGraphData = (stats?.earningsGraph || []).map(item => ({
    date:   new Date(item.date).toLocaleDateString("en-CA"),
    income: item.earned,
  }));

  const chartData = allGraphData.filter(item => {
    const d = new Date(item.date);
    if (chartFilter === "week") {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo;
    }
    if (chartFilter === "month") {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (chartFilter === "year") {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const chartTotal = chartData.reduce((s, d) => s + d.income, 0);

  // Use API data if available, fall back to illustrative data only if empty
  const displayPayouts = recentPayouts.length > 0 ? recentPayouts : [
    { label: "AC Repair – Patan",          date: "Mar 28, 2026", amount: 1200, status: "received" },
    { label: "Wiring Fix – Bhaktapur",     date: "Mar 25, 2026", amount: 800,  status: "received" },
    { label: "Electrical Install – Lalitpur", date: "Mar 22, 2026", amount: 1500, status: "received" },
    { label: "AC Service – Kathmandu",     date: "Apr 01, 2026", amount: 950,  status: "pending"  },
    { label: "Wiring Check – Bhaktapur",   date: "Apr 03, 2026", amount: 600,  status: "pending"  },
  ];

  return (
    <>
      <FontLink />
      <BookingNavbar />
      <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "rgb(247, 245, 239)" }}>
        <Sidebar workerId={workerId} />

        <main style={{ flex: 1, padding: "2rem", maxWidth: 1200, margin: "0 auto" }}>

           <div style={{ marginBottom: "1.75rem", marginLeft: "5px" }}>
            <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#1a1310", margin: 0, fontFamily: "'Inter', sans-serif" }}>Earnings Dashboard</h1>
            <p style={{ fontSize: "0.82rem", color: "#a89f97",  }}>Your income overview and performance</p>
          </div>


          {/* ── STAT CARDS ── */}
          <div style={{ display: "flex", gap: "1rem", marginBottom: "30px", flexWrap: "wrap" }}>
            <StatCard label="Today"        value={`Rs. ${todayEarnings.toLocaleString()}`} sub="today's income"  trendUp={todayEarnings > 0}  sparkColor="#0ea5e9" />
            <StatCard label="This Week"    value={`Rs. ${weekEarnings.toLocaleString()}`}  sub="last 7 days"    trendUp={weekEarnings > 0}   sparkColor="#6366f1" />
            <StatCard  label="This Month"   value={`Rs. ${monthEarnings.toLocaleString()}`} sub="current month"  trendUp={monthEarnings > 0}  sparkColor="#f59e0b" />
            <StatCard  label="Total Earned" value={`Rs. ${totalEarnings.toLocaleString()}`} sub="all time"       trendUp={true}               sparkColor="#22c55e" />
            <StatCard  label="Avg per Task" value={`Rs. ${avgPerTask.toLocaleString()}`}    sub={`${completed} tasks`} trendUp={avgPerTask > 0} sparkColor="#8b5cf6" />
          </div>

          {/* ── MIDDLE ROW: Chart + Payout Panel ── */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem", marginBottom: "0.95rem" }}>

            {/* Earnings Chart */}
            <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 16, padding: "1.5rem", height: "420px", width: "620px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "80px" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", marginTop: 2 }}>Earnings Over Time</div>
                  <div style={{ fontSize: "0.72rem", color: "#bbb" }}>
                    {chartFilter === "week" ? "Last 7 days" : chartFilter === "month" ? "This month" : "This year"} · Rs. {chartTotal.toLocaleString()} total
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["week", "month", "year"].map(f => (
                    <button key={f} onClick={() => setChartFilter(f)} style={{
                      padding: "5px 12px", borderRadius: 8, fontSize: "0.78rem", cursor: "pointer",
                      fontWeight: chartFilter === f ? 600 : 400,
                      background: chartFilter === f ? "#1a1a1a" : "#fafaf8",
                      color: chartFilter === f ? "#fff" : "#666",
                      border: `1px solid ${chartFilter === f ? "#1a1a1a" : "#e5e5e5"}`,
                      transition: "all 0.15s",
                    }}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {chartData.length === 0 ? (
                <div style={{ textAlign: "center", color: "#ccc", padding: "3rem 0", fontSize: "0.85rem" }}>
                  No earnings data for this period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250} >
                  <BarChart data={chartData} barSize={28} >
                    <CartesianGrid vertical={false} stroke="#f0efea" />
                    <XAxis dataKey="date" axisLine={true} tickLine={false} tick={{ fontSize: 10, fill: "#bbb" }}
                      label={{ value: "Date", position: "insideBottom", offset: -2, fontSize: 12, fill: "#aaa" }} />
                    <YAxis axisLine={true} tickLine={false} tick={{ fontSize: 10, fill: "#bbb" }}
                      label={{ value: "Income", angle: -90, position: "insideLeft", offset: 10, fontSize: 12, fill: "#aaa" }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f7f7f5" }} />
                    <Bar dataKey="income" fill="#1a1a1a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* ── Pending vs Received Panel ── */}
            <div style={{ background: "#fff", width: "400px", border: "1px solid #ebebeb", borderRadius: 16, padding: "1.25rem", display: "flex", flexDirection: "column" }}>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.25rem" }}>Income Status</div>
              <div style={{ fontSize: "0.72rem", color: "#bbb", marginBottom: "1rem" }}>Received vs pending payouts</div>

              {/* Summary cards */}
              

              {/* Visual ratio bar */}
              <div style={{ marginBottom: "1.25rem" }}>
                <div style={{ height: 8, background: "#f0efea", borderRadius: 99, overflow: "hidden", display: "flex" }}>
                  <div style={{
                    height: "100%",
                    width: `${totalEarnings > 0 ? Math.round((receivedAmount / totalEarnings) * 100) : 0}%`,
                    background: "#22c55e", borderRadius: "99px 0 0 99px", transition: "width 0.5s",
                  }} />
                  <div style={{
                    height: "100%",
                    width: `${totalEarnings > 0 ? Math.round((pendingAmount / totalEarnings) * 100) : 0}%`,
                    background: "#fbbf24", borderRadius: "0 99px 99px 0", transition: "width 0.5s",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, padding: "0 4px" }}>
                  <span style={{ fontSize: "0.65rem", color: "#16a34a" }}>● Received</span>
                  <span style={{ fontSize: "0.65rem", color: "#ca8a04" }}>● Pending</span>
                </div>
              </div>

              <div style={{ margin: "0 0 0.75rem", height: 1, background: "#f0efea" }} />

              {/* Recent payout list */}
              <div style={{ fontWeight: 600, fontSize: "0.78rem", color: "#555", marginBottom: "0.5rem" }}>Recent Transactions</div>
              <div style={{ flex: 1, overflowY: "auto", maxHeight: 160, paddingRight: 10 }}>
                {displayPayouts.map((p, i) => (
                  <PayoutRow key={i} {...p} />
                ))}
              </div>

              {/* Completion rate at bottom */}
              <div style={{ marginTop: "0.75rem" }}>
                <div style={{
                  padding: "0.75rem",
                  background: compRate >= 70 ? "#dcfce7" : compRate >= 40 ? "#fef9c3" : "#fee2e2",
                  borderRadius: 12,
                }}>
                  <div style={{ fontSize: "0.7rem", color: "#999", marginBottom: 2 }}>Completion Rate</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: compRate >= 70 ? "#15803d" : compRate >= 40 ? "#a16207" : "#b91c1c" }}>
                    {compRate}%
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "#aaa", marginTop: 1 }}>
                    {completed} of {totalTasks} tasks completed
                  </div>
                </div>
              </div>
            </div>
          </div>

        </main>
      </div>
    </>
  );
}