import { useState, useEffect } from "react";
import { workerStats } from "../api/api";
import BookingNavbar from "../components/Navbar/Navbar";
import Sidebar from "./sidebar";

const FontLink = () => (
  <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
);

/* ─── Helpers ──────────────────────────────────────────────────── */
const workerName = (w) => w?.full_name || `${w?.first_name || ""} ${w?.last_name || ""}`.trim() || "Worker";

const normaliseTask = (t) => ({
  id:          t._id || t.id,
  name:        t.customer_name || t.clientName || t.taskName || "—",
  serviceType: t.task_type || t.taskType || t.selectedService || "—",
  date:        t.serviceDate ? new Date(t.serviceDate).toLocaleDateString("en-CA") : "—",
  status:      t.status || "pending",
  amount:      Number(t.totalCost || t.budget || 0),
});

/* ─── Components ───────────────────────────────────────────────── */
const StatusPill = ({ status }) => (
  <span style={{
    padding: "4px 14px", borderRadius: 20, fontSize: "0.78rem", fontWeight: 500,
    border: "1.5px solid #ddd", background: "#ffffff", color: "#555",
    textTransform: "capitalize", fontFamily: "'DM Sans', sans-serif",
  }}>
    {status}
  </span>
);

const formatDateTime = (dateString) => {
  if (!dateString) return "—";

  const date = new Date(dateString);

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
};

const StatCard = ({ label, value }) => (
  <div style={{ background: "#ffffff", borderRadius: 16, padding: "1.25rem 1.5rem", border: "1px solid #e8e6df", flex: 1, minWidth: 0 }}>
    <div style={{ fontSize: "12px", color: "#888",   marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
    <div style={{ fontSize: "1.9rem", fontWeight: 700, fontFamily: "'inter'", color: "#1a1a1a" }}>{value}</div>
  </div>
);

const MilestoneBadge = ({ label }) => (
  <div style={{ textAlign: "center", flex: 1 }}>
    <div style={{ width: 52, height: 52, borderRadius: "50%", border: "2.5px solid #1a1a1a", margin: "0 auto 8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", background: "#fff" }}>
      🏅
    </div>
    <div style={{ fontSize: "0.72rem", color: "#444", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{label}</div>
  </div>
);

const DonutChart = ({ segments, size = 130 }) => {
  const r = 48, cx = 65, cy = 65;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 130 130">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ede9df" strokeWidth="18" />
      {total === 0
        ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ffffff" strokeWidth="18" />
        : segments.map((seg, i) => {
            const dash = (seg.value / total) * circumference;
            const gap  = circumference - dash;
            const el = (
              <circle key={i} cx={cx} cy={cy} r={r}
                fill="none" stroke={seg.color} strokeWidth="18"
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
                style={{ transform: "rotate(-90deg)", transformOrigin: "65px 65px" }}
              />
            );
            offset += dash;
            return el;
          })
      }
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize="18" fontWeight="700" fill="#1a1a1a" fontFamily="DM Serif Display, serif">{total}</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize="9" fill="#aaa" fontFamily="DM Sans, sans-serif">Total</text>
    </svg>
  );
};

/* ─── MAIN ─────────────────────────────────────────────────────── */
export default function WorkerDashboard() {
  const [stats,   setStats]   = useState(null);
  const [worker,  setWorker]  = useState({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [expandedReviewId, setExpandedReviewId] = useState(null);

  const userString = localStorage.getItem("user") || sessionStorage.getItem("user");
  const workerId   = userString ? JSON.parse(userString)?.id : null;

  useEffect(() => {
    if (!workerId) { 
      setError("No worker ID found. Please log in again."); setLoading(false); return; }
    workerStats(workerId)
      .then(data => { setStats(data); setWorker(data.worker || {}); })
      .catch(() => setError("Failed to load dashboard. Please try again."))
      .finally(() => setLoading(false));
  }, [workerId]);

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", color: "#888" }}>Loading your dashboard…</div>;
  if (error)   return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", color: "#e53e3e" }}>{error}</div>;

  /* ── Derived ── */
  const allTasks       = (stats?.tasksToday || []).map(normaliseTask);
  const tasks          = allTasks.slice(0, 3); // top 3 recent tasks
  const totalEarnings  = stats?.totalEarnings || 0;
  const monthlyEarning = Math.round(totalEarnings / 12);
  const todayEarning   = allTasks.filter(t => t.status === "completed").reduce((s, t) => s + t.amount, 0);
  const stars          = Math.round(stats?.averageRating || 0);

  const completed  = stats?.tasksCompleted  ?? 0;
  const pending    = stats?.tasksPending    ?? 0;
  const inProgress = stats?.tasksInProgress ?? 0;
  const cancelled  = stats?.tasksCancelled  ?? 0;
  const accepted   = stats?.tasksAccepted   ?? 0;

  const donutSegments = [
    { label: "Completed",   value: completed,  color: "#5a8a6a" },
    { label: "In Progress", value: inProgress, color: "#7b7fc4" },
    { label: "Pending",     value: pending,    color: "#c4a55a" },
    { label: "Accepted",    value: accepted,   color: "#5aabc4" },
    { label: "Cancelled",   value: cancelled,  color: "#c47070" },
  ].filter(s => s.value > 0);

  const allReviews    = stats?.recentReviews || stats?.recent_review || [];
  const recentReviews = allReviews.slice(0, 3); // top 3 recent reviews

  return (
    <>
      <FontLink />
      <div>
        <BookingNavbar />
        <div style={{ display: "flex", backgroundColor:"rgb(247, 245, 239)" }}>
          <Sidebar workerId={worker} />
          <div style={{ flex: 2 }}>
            <main style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem" }}>

              <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "2rem", fontWeight: 400, marginBottom: "0.25rem", letterSpacing: "-0.02em" }}>
                Dashboard
              </h1>
              <p style={{ color: "#888", fontSize: "0.88rem", marginBottom: "1.5rem" }}>
                Welcome back, {worker?.first_name || workerName(worker).split(" ")[0]}!
              </p>

              {/* STAT CARDS */}
              <div style={{ display: "flex", gap: "1rem", marginBottom: "1.75rem", flexWrap: "wrap" }}>
                <StatCard label="Tasks Completed" value={stats?.tasksCompleted || 0} />
                <StatCard label="Tasks Pending"   value={stats?.tasksPending   || 0} />
                <StatCard label="Task Requests"   value={stats?.tasksAccepted  || 0} />
                <StatCard label="Completion Rate" value={`${stats?.completionRate || 0}%`} />
                <StatCard label="Total Earning"   value={`Rs. ${totalEarnings.toLocaleString()}`} />
              </div>

              {/* MAIN GRID */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.5rem" }}>

                {/* LEFT */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                  {/* 2×2 Grid: Donut + Earnings */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gridTemplateRows: "auto auto",
                    gap: "1rem",
                  }}>
                    {/* Donut Chart — spans full height on the left */}
                    <div style={{
                      background: "#ffffff", borderRadius: 16, padding: "1.5rem",
                      border: "1px solid #e8e6df", gridRow: "1 / 3",
                      display: "flex", flexDirection: "column",
                      height: "400px"
                    }}>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "1.25rem", paddingBottom: "0.75rem", borderBottom: "1px solid #e8e6df" }}>
                        Status Breakdown
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem", flex: 1, justifyContent: "center" }}>
                        <DonutChart segments={donutSegments} size={140} />
                        <div style={{ width: "100%" }}>
                          {[
                            { label: "Completed",   value: completed,  color: "#5a8a6a" },
                            { label: "In Progress", value: inProgress, color: "#7b7fc4" },
                            { label: "Pending",     value: pending,    color: "#c4a55a" },
                            { label: "Accepted",    value: accepted,   color: "#5aabc4" },
                            { label: "Cancelled",   value: cancelled,  color: "#c47070" },
                          ].map(s => (
                            <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block", flexShrink: 0 }} />
                                <span style={{ fontSize: "0.78rem", color: "#666", fontFamily: "'DM Sans', sans-serif" }}>{s.label}</span>
                              </div>
                              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1a1a1a", fontFamily: "'DM Serif Display', serif" }}>{s.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Today's Earning — top right */}
                    <div style={{ 
  display: "flex", 
  flexDirection: "column", 

}}>

  {/* Today's Earning */}
  <div style={{ 
    background: "#ffffff",
    borderRadius: 16,
    padding: "1.4rem 1.5rem",
    border: "1px solid #e8e6df",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    height: "120px"
  }}>
    <div style={{ 
      fontSize: "0.78rem", 
      color: "#888", 
      fontFamily: "'DM Sans', sans-serif",
     
    }}>
      Today's Earning
    </div>
    <div style={{ 
      fontSize: "1.75rem",
      fontWeight: 700,
      fontFamily: "'DM Serif Display', serif",
      color: "#1a1a1a"
    }}>
      Rs. {todayEarning?.toLocaleString() || 0}
    </div>
  </div>

  {/* Weekly Earning */}
  <div style={{ 
    background: "#ffffff",
    borderRadius: 16,
    padding: "1.4rem 1.5rem",
    border: "1px solid #e8e6df",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    height: "120px",
      marginTop:"20px"
  }}>
    <div style={{ 
      fontSize: "0.78rem", 
      color: "#888", 
      fontFamily: "'DM Sans', sans-serif",
      marginBottom: 10 
    }}>
      Weekly Earning
    </div>
    <div style={{ 
      fontSize: "1.75rem",
      fontWeight: 700,
      fontFamily: "'DM Serif Display', serif",
      color: "#1a1a1a"
    }}>
      Rs. {monthlyEarning?.toLocaleString() || 0}
    </div>
  </div>

  {/* Monthly Earning */}
  <div style={{ 
    background: "#ffffff",
    borderRadius: 16,
    padding: "1.4rem 1.5rem",
    border: "1px solid #e8e6df",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    height: "120px",
      marginTop:"20px"
  }}>
    <div style={{ 
      fontSize: "0.78rem", 
      color: "#888", 
      fontFamily: "'DM Sans', sans-serif",
      marginBottom: 10 
    }}>
      Monthly Earning
    </div>
    <div style={{ 
      fontSize: "1.75rem",
      fontWeight: 700,
      fontFamily: "'DM Serif Display', serif",
      color: "#1a1a1a"
    }}>
      Rs. {monthlyEarning?.toLocaleString() || 0}
    </div>
  </div>

</div>
                   
                  
                  </div>
                  

                  {/* Task Table — top 3 recent tasks */}
                  <div style={{ background: "#ffffff", borderRadius: 16, padding: "1.5rem", border: "1px solid #e8e6df", height: "328px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Recent Tasks</div>
                      <span style={{ fontSize: "0.75rem", color: "#aaa", fontFamily: "'DM Sans', sans-serif" }}>Showing latest 3</span>
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
                          <tr><td colSpan={6} style={{ padding: "1.5rem", color: "#aaa", textAlign: "center" }}>No tasks available</td></tr>
                        ) : tasks.map((t, i) => (
                          <tr key={t.id || i} style={{ borderBottom: "1px solid #f0ede4" }}>
                            <td style={{ padding: "0.75rem" }}>{t.name}</td>
                            <td style={{ padding: "0.75rem", color: "#666" }}>{t.serviceType}</td>
                            <td style={{ padding: "0.75rem", color: "#666" }}>{t.date}</td>
                            <td style={{ padding: "0.75rem" }}><StatusPill status={t.status} /></td>
                            <td style={{ padding: "0.75rem", fontWeight: 600 }}>Rs. {t.amount.toLocaleString()}</td>
                            <td style={{ padding: "0.75rem" }}>
                              <button style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 8, padding: "4px 12px", cursor: "pointer", fontSize: "0.75rem", fontFamily: "'DM Sans', sans-serif", color: "#555" }}>
                                View more
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* RIGHT */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                  {/* Achievement Progress */}
                  <div style={{ background: "#ffffff", borderRadius: 16, padding: "1.5rem", border: "1px solid #e8e6df" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "1.25rem", paddingBottom: "0.75rem", borderBottom: "1px solid #e8e6df" }}>
                      Achievement Progress
                    </div>
                    <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                      <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 8 }}>My Rating</div>
                      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "3rem", fontWeight: 400, lineHeight: 1.1 }}>
                        {stats?.averageRating?.toFixed(1) || "0.0"}
                      </div>
                      <div style={{ fontSize: "1.3rem", color: "#f0a500", margin: "4px 0" }}>
                        {"★".repeat(stars)}{"☆".repeat(5 - stars)}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "#888" }}>
                        Based on {stats?.totalReviews || 0} reviews
                      </div>
                    </div>
                    <div style={{ borderTop: "1px solid #e8e6df", paddingTop: "1.25rem" }}>
                      <div style={{ fontSize: "0.82rem", color: "#888", marginBottom: "1rem" }}>Milestones</div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <MilestoneBadge label="10 Jobs Completed" />
                        <MilestoneBadge label="Top Rated" />
                        <MilestoneBadge label="Skill Expert" />
                      </div>
                    </div>
                  </div>

                  {/* Recent Reviews — top 3 only */}
                  <div style={{ background: "#ffffff", borderRadius: 16, padding: "1.5rem", border: "1px solid #e8e6df",     minHeight: "327px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Recent Reviews</div>
                      <span style={{ fontSize: "0.75rem", color: "#aaa", fontFamily: "'DM Sans', sans-serif" }}>Showing latest 3</span>
                    </div>
                    {recentReviews.map((r, i, arr) => {
  const reviewId = r._id || i;
  const fullText = r.text || r.comment || r.review || "";
  const isExpanded = expandedReviewId === reviewId;

  const shortText =
    fullText.length > 80
      ? fullText.slice(0, 80) + "..."
      : fullText;

  return (
    <div
      key={reviewId}
      style={{
        borderBottom: i < arr.length - 1 ? "1px solid #e8e6df" : "none",
        paddingBottom: "0.75rem",
        marginBottom: "0.75rem"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
          {r.reviewer_name || r.user_id || "Anonymous"}
        </span>

        <span style={{ color: "#f0a500", fontSize: "0.82rem" }}>
          {"★".repeat(Math.round(r.stars || r.rating || 0))}
          {"☆".repeat(5 - Math.round(r.stars || r.rating || 0))}
        </span>
      </div>

      <p style={{ fontSize: "0.78rem", color: "#666", margin: "4px 0 0" }}>
        {isExpanded ? fullText : shortText}
      </p>

      {fullText.length > 80 && (
        <button
          onClick={() =>
            setExpandedReviewId(isExpanded ? null : reviewId)
          }
          style={{
            background: "none",
            border: "none",
            color: "gray",
            fontSize: "0.72rem",
            cursor: "pointer",
            padding: 0,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight:600,
            marginTop: "10px"
          }}
        >
          {isExpanded ? "View less" : "View more"}
        </button>
      )}

<span style={{ fontSize: "0.72rem", color: "#aaa", marginLeft:"110px" }}>
  {formatDateTime(r.createdAt || r.date)}
</span>
    </div>
  );
})}
                  </div>

                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </>
  );
}