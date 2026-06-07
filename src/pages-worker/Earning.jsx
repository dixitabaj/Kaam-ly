import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { workerStats, workerEarnings, getRecentPayouts } from "../api/api";
import Sidebar from "./sidebar";
import BookingNavbar from "../components/Navbar/Navbar";

import ChatWidget from "../components/HelpSection/HelpSection";

const FontLink = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; }
    .earn-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08) !important; }
    .earn-card { transition: transform 0.2s, box-shadow 0.2s; }

    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .middle-row {
      display: grid;
      grid-template-columns: 3fr 1fr;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .chart-panel {
      background: #fff;
      border: 1px solid #ebebeb;
      border-radius: 16px;
      padding: 1.25rem;
      min-height: 60px;

      min-width: 500px;
    }

    .status-panel {
      background: #fff;
      border: 1px solid #ebebeb;
      border-radius: 16px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;

      min-width: 500px;
    }


    .summary-cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    @media (min-width: 900px) {
      .middle-row {
        grid-template-columns: 3fr 1fr;
      }
    }

    @media (max-width: 600px) {
      .stat-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      main {
        padding: 1rem !important;
      }
    }

    /* ── TV / large display (1600px+) ── */
    @media (min-width: 1600px) {
      .tv-main {
        padding: 3rem 4rem !important;
        max-width: 1800px !important;
      }
      .tv-heading {
        font-size: 38px !important;
      }
      .tv-subheading {
        font-size: 1rem !important;
      }
      .stat-grid {
        gap: 1.25rem;
        margin-bottom: 2rem;
      }
      .earn-card {
        padding: 1.5rem 1.75rem !important;
      }
      .earn-card .card-label {
        font-size: 13px !important;
      }
      .earn-card .card-value {
        font-size: 28px !important;
      }
      .earn-card .card-sub {
        font-size: 0.85rem !important;
      }
      .middle-row {
        gap: 1.5rem;
      }
      .chart-panel {
        padding: 2rem !important;
        min-height: 520px;
        border-radius: 22px !important;
      }
      .status-panel {
        padding: 2rem !important;
        border-radius: 22px !important;
      }
      .chart-height {
        height: 380px !important;
      }
      .panel-title {
        font-size: 1.2rem !important;
      }
      .panel-sub {
        font-size: 0.85rem !important;
      }
      .payout-row-label {
        font-size: 0.95rem !important;
      }
      .payout-row-date {
        font-size: 0.82rem !important;
      }
      .payout-row-amount {
        font-size: 1rem !important;
      }
      .comp-rate-value {
        font-size: 2.2rem !important;
      }
    }
  `}</style>
);

/* ─── Sparkline ──────────────────────────────────────────────── */
const Sparkline = ({ color = "#22c55e", up = true }) => (
  <svg width="60" height="28" viewBox="0 0 60 28" fill="none" style={{ flexShrink: 0 }}>
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
const StatCard = ({ label, value, sub, trendUp, sparkColor }) => (
  <div className="earn-card" style={{
    background: "#fff",
    border: "1px solid #ebebeb",
    borderRadius: 14,
    padding: "0.85rem 1rem",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="card-label" style={{ fontSize: "10px", color: "#888", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>
          {label}
        </div>
        <div className="card-value" style={{ fontSize: "clamp(14px, 2vw, 20px)", fontWeight: 700, color: "#1a1a1a", wordBreak: "break-word" }}>
          {value}
        </div>
        {sub && (
          <div className="card-sub" style={{ fontSize: "0.68rem", color: trendUp ? "#16a34a" : "#dc2626", marginTop: 3 }}>
            {trendUp ? "↑" : "↓"} {sub}
          </div>
        )}
      </div>
      <Sparkline color={sparkColor} up={trendUp} />
    </div>
  </div>
);

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
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
          background: isReceived ? "#dcfce7" : "#fef9c3",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
        }}>
          {isReceived ? "✓" : "⏳"}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {label}
          </div>
          <div style={{ fontSize: "0.68rem", color: "#aaa", marginTop: 1 }}>{date}</div>
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: isReceived ? "#15803d" : "#a16207" }}>
          Rs. {amount.toLocaleString()}
        </div>
        <div style={{
          fontSize: "0.62rem", fontWeight: 600, marginTop: 2,
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
  const [stats, setStats]                 = useState(null);
  const [earnings, setEarnings]           = useState(null);
  const [loading, setLoading]             = useState(true);
  const [chartFilter, setChartFilter]     = useState("month");
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
        if (statsRes.status === "fulfilled")         setStats(statsRes.value);
        if (earningsRes.status === "fulfilled")      setEarnings(earningsRes.value);
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#999" }}>
      Loading…
    </div>
  );

  if (!stats && !earnings) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#999" }}>
      No data available.
    </div>
  );

  const totalEarnings  = stats?.totalEarnings    ?? 0;
  const todayEarnings  = earnings?.todayEarnings  ?? 0;
  const weekEarnings   = earnings?.weekEarnings   ?? 0;
  const monthEarnings  = earnings?.monthEarnings  ?? 0;
  const pendingAmount  = earnings?.pendingAmount  ?? stats?.pendingEarnings  ?? Math.round(totalEarnings * 0.07);
  const receivedAmount = earnings?.receivedAmount ?? stats?.receivedEarnings ?? (totalEarnings - pendingAmount);

  const totalTasks = stats?.totalTasks     ?? 0;
  const completed  = stats?.tasksCompleted ?? 0;
  const avgPerTask = completed > 0 ? Math.round(totalEarnings / completed) : 0;
  const compRate   = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

  const now          = new Date();
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
    if (chartFilter === "month")
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (chartFilter === "year")
      return d.getFullYear() === now.getFullYear();
    return true;
  });

  const chartTotal = chartData.reduce((s, d) => s + d.income, 0);

  const displayPayouts = recentPayouts.length > 0 ? recentPayouts : [
    { label: "AC Repair – Patan",             date: "Mar 28, 2026", amount: 1200, status: "received" },
    { label: "Wiring Fix – Bhaktapur",        date: "Mar 25, 2026", amount: 800,  status: "received" },
    { label: "Electrical Install – Lalitpur", date: "Mar 22, 2026", amount: 1500, status: "received" },
    { label: "AC Service – Kathmandu",        date: "Apr 01, 2026", amount: 950,  status: "pending"  },
    { label: "Wiring Check – Bhaktapur",      date: "Apr 03, 2026", amount: 600,  status: "pending"  },
  ];

  return (
    <>
      <FontLink />
      <BookingNavbar />
      <ChatWidget/>
      <div style={{ display: "flex", backgroundColor: "rgb(247,245,239)", minHeight: "calc(100vh - 89px)" }}>
        <Sidebar workerId={workerId} />

        <main className="tv-main" style={{ flex: 1, padding: "2rem", width: "100%", maxWidth: 1200, marginLeft: 320, overflowX: "hidden" }}>

          {/* Header */}
          <div style={{ marginBottom: "1.75rem" }}>
            <h1 className="tv-heading" style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 700, color: "#1a1310", margin: 0 }}>
              Earnings Dashboard
            </h1>
            <p className="tv-subheading" style={{ fontSize: "0.82rem", color: "#a89f97", margin: "4px 0 0" }}>
              Your income overview and performance
            </p>
          </div>

          {/* ── STAT CARDS ── */}
          <div className="stat-grid">
            <StatCard label="Today"        value={`Rs. ${todayEarnings.toLocaleString()}`}  sub="today's income"   trendUp={todayEarnings > 0}  sparkColor="#0ea5e9" />
            <StatCard label="This Week"    value={`Rs. ${weekEarnings.toLocaleString()}`}   sub="last 7 days"      trendUp={weekEarnings > 0}   sparkColor="#6366f1" />
            <StatCard label="This Month"   value={`Rs. ${monthEarnings.toLocaleString()}`}  sub="current month"    trendUp={monthEarnings > 0}  sparkColor="#f59e0b" />
            <StatCard label="Total Earned" value={`Rs. ${totalEarnings.toLocaleString()}`}  sub="all time"         trendUp={true}               sparkColor="#22c55e" />
            <StatCard label="Avg per Task" value={`Rs. ${avgPerTask.toLocaleString()}`}     sub={`${completed} tasks`} trendUp={avgPerTask > 0} sparkColor="#8b5cf6" />
          </div>

          {/* ── MIDDLE ROW ── */}
          <div className="middle-row">

            {/* Earnings Chart */}
            <div className="chart-panel">
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", marginBottom: "1.5rem" }}>
                <div>
                  <div className="panel-title" style={{ fontWeight: 600, fontSize: "0.9rem" }}>Earnings Over Time</div>
                  <div className="panel-sub" style={{ fontSize: "0.72rem", color: "#bbb" }}>
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
                <div className="chart-height" style={{ height: 340, marginTop: 60 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barSize={24} >
                    <CartesianGrid vertical={false} stroke="#f0efea" />
                    <XAxis
                      dataKey="date" axisLine={true} tickLine={false}
                      tick={{ fontSize: 10, fill: "#bbb" }}
                      interval="preserveStartEnd"
                      label={{ value: "Date", position: "insideBottom", offset: -2, fontSize: 11, fill: "#aaa" }}
                    />
                    <YAxis
                      axisLine={true} tickLine={false}
                      tick={{ fontSize: 10, fill: "#bbb" }}
                      width={45}
                      label={{ value: "Income", angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: "#aaa" }}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f7f7f5" }} />
                    <Bar dataKey="income" fill="#1a1a1a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Income Status Panel */}
            <div className="status-panel">
              <div className="panel-title" style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.25rem" }}>Income Status</div>
              <div className="panel-sub" style={{ fontSize: "0.72rem", color: "#bbb", marginBottom: "0.75rem" }}>Received vs pending payouts</div>

              {/* Summary cards */}
              <div className="summary-cards">
                <div style={{ background: "#dcfce7", borderRadius: 10, padding: "0.6rem 0.75rem" }}>
                  <div style={{ fontSize: "0.68rem", color: "#16a34a", marginBottom: 3 }}>Received</div>
                  <div style={{ fontSize: "clamp(14px, 2.5vw, 22px)", fontWeight: 700, color: "#15803d" }}>
                    Rs. {receivedAmount.toLocaleString()}
                  </div>
                </div>
                <div style={{ background: "#fef9c3", borderRadius: 10, padding: "0.6rem 0.75rem" }}>
                  <div style={{ fontSize: "0.68rem", color: "#ca8a04", marginBottom: 3 }}>Pending</div>
                  <div style={{ fontSize: "clamp(14px, 2.5vw, 22px)", fontWeight: 700, color: "#a16207" }}>
                    Rs. {pendingAmount.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Ratio bar */}
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ height: 8, background: "#f0efea", borderRadius: 99, overflow: "hidden", display: "flex" }}>
                  <div style={{
                    height: "100%",
                    width: `${totalEarnings > 0 ? Math.round((receivedAmount / totalEarnings) * 100) : 0}%`,
                    background: "#22c55e", transition: "width 0.5s",
                  }} />
                  <div style={{
                    height: "100%",
                    width: `${totalEarnings > 0 ? Math.round((pendingAmount / totalEarnings) * 100) : 0}%`,
                    background: "#fbbf24", transition: "width 0.5s",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                  <span style={{ fontSize: "0.65rem", color: "#16a34a" }}>● Received</span>
                  <span style={{ fontSize: "0.65rem", color: "#ca8a04" }}>● Pending</span>
                </div>
              </div>

              <div style={{ height: 1, background: "#f0efea", marginBottom: "0.75rem" }} />

              {/* Recent transactions */}
              <div style={{ fontWeight: 600, fontSize: "0.78rem", color: "#555", marginBottom: "0.5rem" }}>Recent Transactions</div>
              <div style={{ flex: 1, overflowY: "auto", maxHeight: 180, paddingRight: 6 }}>
                {displayPayouts.map((p, i) => <PayoutRow key={i} {...p} />)}
              </div>

              {/* Completion rate */}
              <div style={{ marginTop: "0.75rem" }}>
                <div style={{
                  padding: "0.75rem", borderRadius: 12,
                  background: compRate >= 70 ? "#dcfce7" : compRate >= 40 ? "#fef9c3" : "#fee2e2",
                }}>
                  <div style={{ fontSize: "0.7rem", color: "#999", marginBottom: 2 }}>Completion Rate</div>
                  <div className="comp-rate-value" style={{
                    fontSize: "clamp(18px, 3vw, 26px)", fontWeight: 800,
                    color: compRate >= 70 ? "#15803d" : compRate >= 40 ? "#a16207" : "#b91c1c",
                  }}>
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