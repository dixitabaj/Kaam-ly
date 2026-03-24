import React, { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

// ── Sub-components from your current dashboard
const StatusPill = ({ status }) => {
  const s = status?.toLowerCase();
  const styles = {
    pending:      { bg: "#f5f5f5", color: "#555", border: "#ddd" },
    accepted:     { bg: "#f5f5f5", color: "#555", border: "#ddd" },
    completed:    { bg: "#f5f5f5", color: "#555", border: "#ddd" },
    in_progress:  { bg: "#f5f5f5", color: "#555", border: "#ddd" },
  };
  const st = styles[s] || styles.pending;
  return (
    <span style={{
      padding: "4px 14px", borderRadius: 20, fontSize: "0.78rem",
      fontWeight: 500, border: `1.5px solid ${st.border}`,
      background: st.bg, color: st.color, textTransform: "capitalize",
      fontFamily: "'DM Sans', sans-serif",
    }}>{status}</span>
  );
};

const StatCard = ({ label, value }) => (
  <div style={{
    background: "#f7f6f2", borderRadius: 16, padding: "1.25rem 1.5rem",
    border: "1px solid #e8e6df", flex: 1, minWidth: 0,
  }}>
    <div style={{ fontSize: "0.82rem", color: "#888", fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: "1.9rem", fontWeight: 700, fontFamily: "'DM Serif Display', serif", color: "#1a1a1a" }}>{value}</div>
  </div>
);

const EarningCard = ({ label, value, change, positive = true }) => (
  <div style={{
    background: "#f7f6f2", borderRadius: 16, padding: "1.1rem 1.4rem",
    border: "1px solid #e8e6df", flex: 1,
  }}>
    <div style={{ fontSize: "0.78rem", color: "#888", fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: "1.45rem", fontWeight: 700, fontFamily: "'DM Serif Display', serif", color: "#1a1a1a" }}>{value}</div>
    {change && (
      <div style={{ fontSize: "0.75rem", color: positive ? "#22a06b" : "#e53e3e", marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
        {positive ? "▲" : "▼"} {change}
      </div>
    )}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: "#fff", border: "1px solid #e8e6df", borderRadius: 10,
        padding: "8px 14px", fontFamily: "'DM Sans', sans-serif", fontSize: "0.82rem",
      }}>
        <div style={{ color: "#888", marginBottom: 2 }}>{label}</div>
        <div style={{ fontWeight: 700, color: "#1a1a1a" }}>Rs. {payload[0].value?.toLocaleString()}</div>
      </div>
    );
  }
  return null;
};

export default function Overview({ stats, tasks, chartData, chartFilter, setChartFilter, todayEarning, monthlyEarning, totalEarnings }) {
  return (
    <>
      {/* ── STAT CARDS ─────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.75rem", flexWrap: "wrap" }}>
        <StatCard label="Tasks Completed"      value={stats?.tasksCompleted  || 0} />
        <StatCard label="Tasks Pending"        value={stats?.tasksPending    || 0} />
        <StatCard label="Task Requests"        value={stats?.tasksAccepted   || 0} />
        <StatCard label="Completion Rate"      value={`${stats?.completionRate || 0}%`} />
      </div>

      {/* ── MAIN GRID ──────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.5rem" }}>
        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Income Chart */}
          <div style={{
            background: "#f7f6f2", borderRadius: 16, padding: "1.5rem",
            border: "1px solid #e8e6df",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.85rem", color: "#888" }}>Yearly Income Progress</div>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                {[
                  { key: "10days", label: "10 Days" },
                  { key: "month",  label: "Month"   },
                  { key: "year",   label: "Year"    },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setChartFilter(opt.key)}
                    style={{
                      padding: "4px 14px", borderRadius: 20, fontSize: "0.78rem",
                      fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                      fontWeight: chartFilter === opt.key ? 600 : 400,
                      background: chartFilter === opt.key ? "#1a1a1a" : "#fff",
                      color: chartFilter === opt.key ? "#fff" : "#888",
                      border: `1.5px solid ${chartFilter === opt.key ? "#1a1a1a" : "#ddd"}`,
                      transition: "all 0.15s ease",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {chartData.length === 0 ? (
              <div style={{ color: "#aaa", fontSize: "0.85rem", textAlign: "center", padding: "3rem 0" }}>
                No earnings data for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barSize={36}>
                  <CartesianGrid vertical={false} stroke="#e8e6df" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#888" }} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "#e8e6df55" }} />
                  <Bar dataKey="income" fill="#b0a99a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Earning Cards */}
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <EarningCard label="Today's Earning" value={`Rs. ${todayEarning.toLocaleString()}`} positive />
            <EarningCard label="Monthly Earning (avg)" value={`Rs. ${monthlyEarning.toLocaleString()}`} positive />
            <EarningCard label="Total Earning" value={`Rs. ${totalEarnings.toLocaleString()}`} positive />
          </div>

          {/* Task Overview */}
          <div style={{
            background: "#f7f6f2", borderRadius: 16, padding: "1.5rem",
            border: "1px solid #e8e6df",
          }}>
            <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "1rem" }}>
              Today's Task Overview
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e8e6df" }}>
                  {["Name", "Service Type", "Date", "Status", "Amount", ""].map(h => (
                    <th key={h} style={{ padding: "0.5rem 0.75rem", color: "#888", fontWeight: 500, textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "1.5rem", color: "#aaa", textAlign: "center" }}>
                      No tasks scheduled for today
                    </td>
                  </tr>
                ) : tasks.map((t, i) => (
                  <tr key={t.id || i} style={{ borderBottom: "1px solid #f0ede4" }}>
                    <td style={{ padding: "0.75rem" }}>{t.name}</td>
                    <td style={{ padding: "0.75rem", color: "#666" }}>{t.serviceType}</td>
                    <td style={{ padding: "0.75rem", color: "#666" }}>{t.date}</td>
                    <td style={{ padding: "0.75rem" }}><StatusPill status={t.status} /></td>
                    <td style={{ padding: "0.75rem", fontWeight: 600 }}>Rs. {t.amount.toLocaleString()}</td>
                    <td style={{ padding: "0.75rem" }}>
                      <button style={{
                        background: "#fff", border: "1px solid #ddd",
                        borderRadius: 8, padding: "4px 12px", cursor: "pointer",
                        fontSize: "0.75rem", fontFamily: "'DM Sans', sans-serif", color: "#555",
                      }}>View more</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Achievement Progress + Reviews can remain in WorkerDashboard or be further separated */}
        </div>
      </div>
    </>
  );
}