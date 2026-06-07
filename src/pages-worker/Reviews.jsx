import React, { useState, useEffect } from "react";
import BookingNavbar from "../components/Navbar/Navbar";
import Sidebar from "./Sidebar";
import { getReviewsById, getTaskById, fetchCustomerById } from "../api/api";
import ChatWidget from "../components/HelpSection/HelpSection";

const FontLink = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; }
    body { background: #faf9f7; }
    .review-row:hover { background: #fdf8f4 !important; cursor: pointer; }
    .filter-tab:hover { background: #f5f0eb !important; }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    .drawer { animation: slideIn 0.25s cubic-bezier(0.22,1,0.36,1); }
    textarea:focus { outline: none; border-color: #f97316 !important; }
    input:focus    { outline: none; border-color: #f97316 !important; }

    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 1rem;
      margin-bottom: 1.75rem;
    }

    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #ede9e4;
      flex-wrap: wrap;
      gap: 10px;
    }
    .toolbar-right {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }

    .review-grid {
      display: grid;
      grid-template-columns: 2fr 1.6fr 1fr 100px 90px 110px;
      padding: 0.55rem 1.5rem;
      align-items: center;
    }

    .review-drawer {
      width: min(440px, 95vw);
    }

    @media (max-width: 900px) {
      .review-grid {
        grid-template-columns: 2fr 1fr 90px 90px;
      }
      .col-task-completed,
      .col-date { display: none; }
      .toolbar { flex-direction: column; align-items: flex-start; }
      .toolbar-right { width: 100%; }
    }

    @media (max-width: 600px) {
      .review-grid {
        grid-template-columns: 1fr 80px 80px;
      }
      .col-task, .col-task-completed, .col-date { display: none; }
      main { padding: 1rem !important; }
      .stat-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (min-width: 1600px) {
      .tv-main {
        padding: 3rem 4rem !important;
        max-width: 1800px !important;
      }
      .tv-title    { font-size: 38px !important; }
      .tv-subtitle { font-size: 1rem !important; }
      .stat-grid   { gap: 1.5rem; margin-bottom: 2.5rem; }
      .stat-label  { font-size: 0.85rem !important; margin-bottom: 20px !important; }
      .stat-value  { font-size: 2rem !important; }
      .stat-sub    { font-size: 0.85rem !important; }
      .toolbar     { padding: 1.5rem 2rem; }
      .toolbar-title { font-size: 1.1rem !important; }
      .review-grid {
        grid-template-columns: 2fr 1.8fr 1.2fr 130px 110px 140px;
        padding: 1.1rem 2rem;
      }
      .col-header  { font-size: 0.8rem !important; }
      .reviewer-name { font-size: 1rem !important; }
      .task-name   { font-size: 0.95rem !important; }
      .date-cell   { font-size: 0.92rem !important; }
      .review-drawer { width: 580px !important; }
      .drawer-header { font-size: 1.1rem !important; }
      .drawer-section-label { font-size: 0.82rem !important; }
      .drawer-comment { font-size: 1rem !important; }
      .info-label  { font-size: 0.88rem !important; width: 150px !important; }
      .info-value  { font-size: 0.95rem !important; }
      .reply-textarea { font-size: 1rem !important; }
      .reply-btn   { font-size: 1rem !important; padding: 1rem !important; }
      .filter-btn  { font-size: 0.88rem !important; padding: 7px 16px !important; }
      .search-input { width: 280px !important; height: 40px !important; font-size: 0.9rem !important; }
      .avatar-circle { width: 44px !important; height: 44px !important; font-size: 0.85rem !important; }
      .avatar-circle-lg { width: 58px !important; height: 58px !important; font-size: 1.1rem !important; }
      .stars-cell  { font-size: 1rem !important; }
      .badge-text  { font-size: 0.8rem !important; padding: 3px 12px !important; }
    }
  `}</style>
);

/* ─── Helpers ─────────────────────────────────────────────────── */
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
const formatDateLong = (str) => {
  const d = parseDate(str);
  if (!d) return str || "—";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

/* ─── Stat Card ───────────────────────────────────────────────── */
const StatCard = ({ label, value, sub }) => (
  <div style={{
    background: "#fff", border: "1px solid #ede9e4",
    borderRadius: 14, padding: "1.1rem 1.25rem",
    display: "flex", alignItems: "center", gap: 14,
  }}>
    <div>
      <div className="stat-label" style={{ fontSize: "0.7rem", color: "#a89f97", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 15 }}>{label}</div>
      <div className="stat-value" style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1a1310", lineHeight: 1 }}>{value}</div>
      {sub && <div className="stat-sub" style={{ fontSize: "0.72rem", color: "#a89f97", marginTop: 3 }}>{sub}</div>}
    </div>
  </div>
);

/* ─── Stars ───────────────────────────────────────────────────── */
const Stars = ({ count, max = 5, size = "0.82rem" }) => (
  <span className="stars-cell" style={{ fontSize: size, letterSpacing: 1 }}>
    {Array.from({ length: max }, (_, i) => (
      <span key={i} style={{ color: i < Math.round(count) ? "#f97316" : "#e5ddd6" }}>&#9733;</span>
    ))}
  </span>
);

/* ─── Badge ───────────────────────────────────────────────────── */
const Badge = ({ rating }) => {
  const map = {
    5: { bg: "#f0fdf4", color: "#16a34a", label: "Excellent" },
    4: { bg: "#eff6ff", color: "#2563eb", label: "Good"      },
    3: { bg: "#fffbeb", color: "#d97706", label: "Average"   },
    2: { bg: "#fff7ed", color: "#ea580c", label: "Poor"      },
    1: { bg: "#fef2f2", color: "#dc2626", label: "Bad"       },
  };
  const s = map[Math.round(rating)] || map[3];
  return (
    <span className="badge-text" style={{
      background: s.bg, color: s.color,
      borderRadius: 99, padding: "2px 9px",
      fontSize: "0.68rem", fontWeight: 600,
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.color, display: "inline-block" }} />
      {s.label}
    </span>
  );
};

/* ─── Info Row ────────────────────────────────────────────────── */
const InfoRow = ({ label, value }) => (
  <div style={{
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    padding: "0.55rem 0", borderBottom: "1px solid #f5f0eb",
  }}>
    <span className="info-label" style={{ fontSize: "0.75rem", color: "#b0a89f", flexShrink: 0, width: 120 }}>{label}</span>
    <span className="info-value" style={{ fontSize: "0.82rem", color: "#2d2420", fontWeight: 500, textAlign: "right" }}>{value || "—"}</span>
  </div>
);

/* ─── Drawer ──────────────────────────────────────────────────── */
function ReviewDrawer({ review, task, userName, onClose, onReplySubmit }) {
  const [replyText, setReplyText] = useState(review.workerReply || "");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(!!review.workerReply);

  // Use fetched userName, fallback to user_id if name not available
  const displayName = userName || review.user_id || "Unknown";
  const rating = review.rating || review.stars || 0;

  const avatarColors = ["#f97316","#3b82f6","#22c55e","#a855f7","#ef4444","#0ea5e9","#eab308"];
  const avatarBg = avatarColors[displayName.charCodeAt(0) % avatarColors.length];
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleSubmit = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`http://localhost:8000/api/reviews/${review._id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: replyText }),
      });
      if (res.ok) { setSubmitted(true); onReplySubmit(review._id, replyText); }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: 1900 }} />
      <div className="drawer review-drawer" style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        background: "#fff",
        boxShadow: "-6px 0 32px rgba(0,0,0,0.08)",
        zIndex: 11000, overflowY: "auto",
        display: "flex", flexDirection: "column",
        fontFamily: "'Inter', sans-serif",
      }}>
        {/* Header */}
        <div style={{
          padding: "1.1rem 1.5rem", borderBottom: "1px solid #ede9e4",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div className="drawer-header" style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1a1310" }}>Review Detail</div>
          <button onClick={onClose} style={{
            background: "#f5f0eb", border: "none", borderRadius: 8,
            width: 30, height: 30, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#6b6460", fontSize: "0.85rem", fontFamily: "'Inter', sans-serif",
          }}>&#10005;</button>
        </div>

        <div style={{ flex: 1, padding: "1.5rem" }}>
          {/* Reviewer */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem" }}>
            <div className="avatar-circle-lg" style={{
              width: 46, height: 46, borderRadius: "50%",
              background: avatarBg, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: "0.95rem", flexShrink: 0,
            }}>{initials}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1a1310" }}>{displayName}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <Stars count={rating} size="1rem" />
                <Badge rating={rating} />
              </div>
            </div>
            <div style={{ marginLeft: "auto", fontSize: "0.72rem", color: "#b0a89f" }}>
              {formatDateShort(review.createdAt)}
            </div>
          </div>

          {/* Comment */}
          <div style={{ background: "#fdf8f4", borderRadius: 10, padding: "1rem", marginBottom: "1.5rem", border: "1px solid #ede9e4" }}>
            <div className="drawer-section-label" style={{ fontSize: "0.68rem", color: "#b0a89f", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Comment</div>
            <p className="drawer-comment" style={{ margin: 0, fontSize: "0.88rem", color: "#3d3530", lineHeight: 1.65 }}>
              {review.text || review.comment || "No comment left."}
            </p>
          </div>

          {/* Task Details */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div className="drawer-section-label" style={{ fontSize: "0.68rem", color: "#b0a89f", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: "0.75rem" }}>Task Details</div>
            <div style={{ background: "#fdf8f4", borderRadius: 10, padding: "0.2rem 1rem", border: "1px solid #ede9e4" }}>
              <InfoRow label="Task Name"    value={task?.taskName || task?.title} />
              <InfoRow label="Task Type"    value={task?.taskType} />
              <InfoRow label="Address"      value={task?.address} />
              <InfoRow label="Service Date" value={task?.serviceDate ? formatDateLong(task.serviceDate) : null} />
              <InfoRow label="Completed At" value={task?.completedAt ? formatDateLong(task.completedAt) : task?.completionTime ? `${task.completionTime} hrs` : null} />
              <InfoRow label="Total Cost"   value={task?.totalCost ? `Rs. ${task.totalCost.toLocaleString()}` : null} />
              <InfoRow label="Status"       value={task?.status} />
            </div>
          </div>

        
        </div>
      </div>
    </>
  );
}

/* ─── MAIN ────────────────────────────────────────────────────── */
export default function Reviews() {
  const [reviews, setReviews]         = useState([]);
  const [taskDetails, setTaskDetails] = useState({});
  const [userNames, setUserNames]     = useState({});   // ← NEW: user_id → display name
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState(0);
  const [search, setSearch]           = useState("");
  const [selected, setSelected]       = useState(null);

  const userString = localStorage.getItem("user") || sessionStorage.getItem("user");
  const workerId   = userString
    ? JSON.parse(userString)?.id || JSON.parse(userString)?.email
    : null;

  useEffect(() => {
    if (!workerId) { setLoading(false); return; }
    const fetchData = async () => {
      try {
        const data = await getReviewsById(workerId);
        setReviews([...data].reverse());

        const details = {};
        const names   = {};

        for (const r of data) {
          // Fetch task details
          if (r.taskId && !details[r.taskId]) {
            try { details[r.taskId] = await getTaskById(r.taskId); }
            catch { details[r.taskId] = null; }
          }

          // Fetch user name by user_id
          if (r.user_id && !names[r.user_id]) {
            try {
              const user = await fetchCustomerById(r.user_id);
              // Adjust the field name below to match your User schema
              // e.g. user.fullName, user.name, user.firstName + user.lastName
              names[r.user_id] = user?.fullName || user?.name
                || (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : null)
                || user?.email
                || r.user_id;
            } catch {
              names[r.user_id] = r.user_id;
            }
          }
        }

        setTaskDetails(details);
        setUserNames(names);
      } catch (err) {
        console.error("Error fetching reviews:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [workerId]);

  const handleReplySubmit = (reviewId, reply) =>
    setReviews(prev => prev.map(r => r._id === reviewId ? { ...r, workerReply: reply } : r));

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#b0a89f", fontSize: "0.9rem", background: "#faf9f7" }}>
      Loading reviews...
    </div>
  );

  const total     = reviews.length;
  const avg       = total > 0 ? reviews.reduce((s, r) => s + (r.rating || r.stars || 0), 0) / total : 0;
  const fiveStars = reviews.filter(r => Math.round(r.rating || r.stars) === 5).length;
  const oneStars  = reviews.filter(r => Math.round(r.rating || r.stars) === 1).length;

  const displayed = reviews
    .filter(r => filter === 0 || Math.round(r.rating || r.stars) === filter)
    .filter(r => {
      if (!search) return true;
      const name = userNames[r.user_id] || "";
      return (
        name.toLowerCase().includes(search.toLowerCase()) ||
        (r.text || r.comment || "").toLowerCase().includes(search.toLowerCase())
      );
    });

  const avatarColors = ["#f97316","#3b82f6","#22c55e","#a855f7","#ef4444","#0ea5e9","#eab308"];
  const getAvatarColor = (str = "") => avatarColors[str.charCodeAt(0) % avatarColors.length];
  const getInitials    = (str = "") => str.slice(0, 2).toUpperCase();

  return (
    <>
      <FontLink />
      <BookingNavbar />

              <ChatWidget/>
      <div style={{ display: "flex", minHeight: "100vh", background: "#F7F5EF", fontFamily: "'Inter', sans-serif" }}>
        <Sidebar workerId={workerId} />

        <main className="tv-main" style={{ flex: 1, padding: "2rem 2.5rem", maxWidth: 1200, marginLeft: "320px", width: "100%" }}>

          {/* Page Title */}
          <div style={{ marginBottom: "1.75rem", marginLeft: "5px" }}>
            <h1 className="tv-title" style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 700, color: "#1a1310", margin: 0 }}>Reviews</h1>
            <p className="tv-subtitle" style={{ fontSize: "0.82rem", color: "#a89f97", margin: "4px 0 0" }}>Monitor and respond to customer feedback</p>
          </div>

          {/* Stat Cards */}
          <div className="stat-grid">
            <StatCard label="Average Rating"    value={avg.toFixed(1)} sub="out of 5.0" />
            <StatCard label="Five-Star Reviews" value={fiveStars}      sub={`out of ${total} total`} />
            <StatCard label="Total Reviews"     value={total}          sub="all time" />
            <StatCard label="1-Star Reviews"    value={oneStars}       sub={`out of ${total} total`} />
          </div>

          {/* Table Card */}
          <div style={{ background: "#fff", border: "1px solid #ede9e4", borderRadius: 16, overflow: "hidden" }}>

            {/* Toolbar */}
            <div className="toolbar">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="toolbar-title" style={{ fontWeight: 600, fontSize: "0.92rem", color: "#1a1310" }}>All Reviews</span>
              </div>
              <div className="toolbar-right">
                {/* Search */}
                <div style={{ position: "relative" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}>
                    <circle cx="11" cy="11" r="8" stroke="#b0a89f" strokeWidth="2"/>
                    <path d="m21 21-4.35-4.35" stroke="#b0a89f" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <input
                    className="search-input"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search reviews..."
                    style={{
                      paddingLeft: 30, paddingRight: 12, height: 34,
                      border: "1px solid #ede9e4", borderRadius: 8,
                      fontSize: "0.8rem", background: "#fdf8f4",
                      color: "#2d2420", width: 200,
                      fontFamily: "'Inter', sans-serif",
                      transition: "border-color 0.15s",
                    }}
                  />
                </div>
                {/* Filter tabs */}
                {[0,5,4,3,2,1].map(f => (
                  <button key={f} className="filter-tab filter-btn"
                    onClick={() => setFilter(f)}
                    style={{
                      padding: "5px 12px", borderRadius: 8,
                      fontSize: "0.76rem", cursor: "pointer",
                      fontWeight: filter === f ? 600 : 400,
                      background: filter === f ? "#f97316" : "#fdf8f4",
                      color: filter === f ? "#fff" : "#7a6f68",
                      border: `1px solid ${filter === f ? "#f97316" : "#ede9e4"}`,
                      transition: "all 0.15s", fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    {f === 0 ? "All" : `${f} ★`}
                  </button>
                ))}
              </div>
            </div>

            {/* Column Headers */}
            <div className="review-grid" style={{ borderBottom: "1px solid #ede9e4", fontSize: "0.68rem", color: "#b0a89f", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <div className="col-header">Reviewer</div>
              <div className="col-header col-task">Task</div>
              <div className="col-header col-task-completed">Completed</div>
              <div className="col-header">Rating</div>
              <div className="col-header">Status</div>
              <div className="col-header col-date">Date</div>
            </div>

            {/* Rows */}
            {displayed.length === 0 ? (
              <div style={{ textAlign: "center", color: "#c5bdb6", padding: "4rem 0", fontSize: "0.88rem" }}>
                {reviews.length === 0 ? "No reviews yet." : "No reviews match this filter."}
              </div>
            ) : displayed.map((review, i) => {
              const displayName = userNames[review.user_id] || review.user_id || "Unknown";
              const rating      = review.rating || review.stars || 0;
              const task        = taskDetails[review.taskId];
              const hasReply    = !!review.workerReply;

              return (
                <div key={review._id || i} className="review-row review-grid"
                  onClick={() => setSelected({ review, task: task || null })}
                  style={{
                    borderBottom: i < displayed.length - 1 ? "1px solid #f5f0eb" : "none",
                    transition: "background 0.1s",
                  }}
                >
                  {/* Reviewer — shows name instead of ID */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="avatar-circle" style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: getAvatarColor(displayName), color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.68rem", fontWeight: 700, flexShrink: 0,
                    }}>
                      {getInitials(displayName)}
                    </div>
                    <div>
                      <div className="reviewer-name" style={{ fontSize: "0.83rem", color: "#2d2420", fontWeight: 500, marginBottom: 3 }}>{displayName}</div>
                      <Badge rating={rating} />
                    </div>
                  </div>

                  {/* Task */}
                  <div className="col-task task-name" style={{
                    fontSize: "0.82rem", color: "#4a403a", fontWeight: 500,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    textTransform: "capitalize",
                  }}>
                    {task?.taskName || task?.title || "—"}
                  </div>

                  {/* Completed */}
                  <div className="col-task-completed date-cell" style={{ fontSize: "0.8rem", color: "#a89f97" }}>
                    {task?.completedAt ? formatDateShort(task.completedAt) : task?.completionTime ? `${task.completionTime} hrs` : "—"}
                  </div>

                  {/* Stars */}
                  <div><Stars count={rating} /></div>

                  {/* Reply status */}
                  <div>
                    {hasReply ? (
                      <span style={{ background: "#f0fdf4", color: "#16a34a", borderRadius: 99, padding: "2px 9px", fontSize: "0.68rem", fontWeight: 600 }}>Replied</span>
                    ) : (
                      <span style={{ background: "#fff4ed", color: "#f97316", borderRadius: 99, padding: "2px 9px", fontSize: "0.68rem", fontWeight: 600 }}>Pending</span>
                    )}
                  </div>

                  {/* Date */}
                  <div className="col-date date-cell" style={{ fontSize: "0.8rem", color: "#a89f97" }}>
                    {formatDateShort(review.createdAt)}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {selected && (
        <ReviewDrawer
          review={selected.review}
          task={selected.task}
          userName={userNames[selected.review.user_id]}
          onClose={() => setSelected(null)}
          onReplySubmit={handleReplySubmit}
        />
      )}
    </>
  );
}