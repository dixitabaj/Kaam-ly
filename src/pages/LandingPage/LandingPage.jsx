// LandingPage.jsx
// Matches Kaam-ly's exact design: white bg, #F59E0B orange, leaf logo,
// Plus Jakarta Sans, clean minimal. Includes login/signup modal.

import React, { useState } from "react";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --orange:     #F59E0B;
    --orange-lt:  #FEF3C7;
    --orange-dk:  #D97706;
    --fg:         #111827;
    --fg2:        #6B7280;
    --fg3:        #9CA3AF;
    --border:     #E5E7EB;
    --bg:         #FFFFFF;
    --bg2:        #F9FAFB;
    --font:       'Plus Jakarta Sans', system-ui, sans-serif;
    --radius:     12px;
  }

  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--fg);
    overflow-x: hidden;
  }

  /* ── Navbar ── */
  .nav {
    position: sticky; top: 0; z-index: 100;
    background: rgba(255,255,255,0.96);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border);
    height: 60px;
    padding: 0 5%;
    display: flex; align-items: center; justify-content: space-between;
  }
  .nav-brand {
    display: flex; align-items: center; gap: 8px;
    text-decoration: none; color: inherit;
  }
  .leaf-icon {
    width: 26px; height: 26px; position: relative;
  }
  .leaf-icon svg { width: 26px; height: 26px; }
  .nav-name { font-size: 1.1rem; font-weight: 700; color: var(--fg); letter-spacing: -0.3px; }
  .nav-links {
    display: flex; align-items: center; gap: 2rem;
    list-style: none;
  }
  .nav-links a {
    font-size: 0.875rem; font-weight: 500;
    color: var(--fg2); text-decoration: none;
    transition: color 0.15s;
  }
  .nav-links a:hover { color: var(--fg); }
  .nav-right { display: flex; align-items: center; gap: 0.75rem; }
  .btn-outline {
    background: none;
    border: 1.5px solid var(--border);
    border-radius: 8px;
    padding: 7px 18px;
    font-family: var(--font);
    font-size: 0.82rem; font-weight: 600;
    color: var(--fg); cursor: pointer;
    transition: all 0.15s;
  }
  .btn-outline:hover { border-color: var(--orange); color: var(--orange-dk); }
  .btn-orange {
    background: var(--orange);
    border: none; border-radius: 8px;
    padding: 8px 20px;
    font-family: var(--font);
    font-size: 0.82rem; font-weight: 600;
    color: white; cursor: pointer;
    transition: background 0.15s;
  }
  .btn-orange:hover { background: var(--orange-dk); }
  .nav-avatar {
    width: 34px; height: 34px; border-radius: 50%;
    border: 1.5px solid var(--border);
    background: var(--bg2);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: border-color 0.15s;
  }
  .nav-avatar:hover { border-color: var(--orange); }
  .nav-avatar svg { width: 17px; height: 17px; color: var(--fg2); }

  /* ── Hero ── */
  .hero {
    padding: 5rem 5% 3.5rem;
    text-align: center;
  }
  .hero h1 {
    font-size: clamp(1.9rem, 4vw, 2.8rem);
    font-weight: 800; letter-spacing: -0.75px;
    color: var(--fg); line-height: 1.2;
    margin-bottom: 1.75rem;
  }
  .search-wrap {
    max-width: 520px; margin: 0 auto;
    position: relative;
  }
  .search-input {
    width: 100%; height: 52px;
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 0 50px 0 18px;
    font-family: var(--font); font-size: 0.9rem;
    color: var(--fg); background: var(--bg); outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .search-input::placeholder { color: var(--fg3); }
  .search-input:focus {
    border-color: var(--orange);
    box-shadow: 0 0 0 3px rgba(245,158,11,0.1);
  }
  .search-cam {
    position: absolute; right: 14px; top: 50%;
    transform: translateY(-50%);
    color: var(--fg3); cursor: pointer;
  }
  .search-cam svg { width: 20px; height: 20px; display: block; }

  /* ── Category tabs ── */
  .cats-bar {
    border-bottom: 1px solid var(--border);
    padding: 0 5%;
  }
  .cats-scroll {
    display: flex; overflow-x: auto;
    scrollbar-width: none; gap: 0;
  }
  .cats-scroll::-webkit-scrollbar { display: none; }
  .cat-tab {
    display: flex; flex-direction: column;
    align-items: center; gap: 5px;
    padding: 14px 20px 11px;
    border: none; background: none;
    font-family: var(--font); cursor: pointer;
    color: var(--fg2); flex-shrink: 0;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px; transition: color 0.15s;
  }
  .cat-tab:hover { color: var(--fg); }
  .cat-tab.active { color: var(--orange); border-bottom-color: var(--orange); }
  .cat-tab-icon { font-size: 1.25rem; line-height: 1; }
  .cat-tab-label { font-size: 0.7rem; font-weight: 500; white-space: nowrap; text-align: center; }

  /* ── Subcategory pills ── */
  .subcats-bar {
    padding: 0.875rem 5%;
    display: flex; gap: 0.5rem;
    overflow-x: auto; scrollbar-width: none;
    border-bottom: 1px solid var(--border);
  }
  .subcats-bar::-webkit-scrollbar { display: none; }
  .subcat-pill {
    padding: 6px 16px; border-radius: 99px;
    border: 1.5px solid var(--border);
    background: var(--bg); font-family: var(--font);
    font-size: 0.8rem; font-weight: 500;
    color: var(--fg); cursor: pointer; white-space: nowrap;
    flex-shrink: 0; transition: all 0.15s;
  }
  .subcat-pill:hover { border-color: var(--orange); color: var(--orange-dk); }
  .subcat-pill.active { background: var(--orange-lt); border-color: var(--orange); color: var(--orange-dk); }

  /* ── Workers ── */
  .section { padding: 2.5rem 5%; }
  .section-title { font-size: 1.2rem; font-weight: 700; color: var(--fg); margin-bottom: 1.25rem; letter-spacing: -0.3px; }
  .workers-row { display: flex; gap: 1rem; overflow-x: auto; padding-bottom: 0.5rem; scrollbar-width: none; }
  .workers-row::-webkit-scrollbar { display: none; }
  .worker-card {
    background: var(--bg); border: 1.5px solid var(--border);
    border-radius: 16px; padding: 1.25rem;
    min-width: 210px; max-width: 210px;
    cursor: pointer; transition: all 0.2s; flex-shrink: 0;
  }
  .worker-card:hover { border-color: var(--orange); box-shadow: 0 4px 18px rgba(245,158,11,0.1); transform: translateY(-2px); }
  .w-avatar {
    width: 48px; height: 48px; border-radius: 50%;
    background: var(--orange-lt); display: flex; align-items: center;
    justify-content: center; font-size: 1.3rem;
    margin-bottom: 0.75rem; position: relative;
  }
  .w-badge {
    position: absolute; bottom: 0; right: 0;
    width: 16px; height: 16px; background: var(--orange);
    border-radius: 50%; border: 2px solid white;
    display: flex; align-items: center; justify-content: center;
  }
  .w-badge svg { width: 7px; height: 7px; color: white; }
  .w-name { font-size: 0.88rem; font-weight: 700; color: var(--fg); margin-bottom: 2px; }
  .w-role { font-size: 0.73rem; color: var(--fg2); margin-bottom: 7px; }
  .w-stars { display: flex; align-items: center; gap: 2px; margin-bottom: 5px; }
  .star { color: var(--orange); font-size: 0.72rem; }
  .star-n { font-size: 0.72rem; color: var(--fg2); margin-left: 3px; }
  .w-rate { font-size: 0.76rem; color: var(--fg2); margin-bottom: 0.875rem; }
  .w-rate strong { color: var(--fg); }
  .btn-book {
    width: 100%; background: var(--orange-lt);
    border: 1.5px solid var(--orange); border-radius: 8px;
    padding: 7px; font-family: var(--font);
    font-size: 0.75rem; font-weight: 700;
    color: var(--orange-dk); cursor: pointer;
    transition: all 0.15s; letter-spacing: 0.03em;
  }
  .btn-book:hover { background: var(--orange); color: white; }

  /* ── Browse more ── */
  .browse-center { text-align: center; padding: 0.5rem 5% 2.5rem; }
  .btn-browse {
    background: none; border: 1.5px solid var(--border);
    border-radius: 99px; padding: 9px 28px;
    font-family: var(--font); font-size: 0.83rem; font-weight: 600;
    color: var(--fg); cursor: pointer; transition: all 0.15s;
  }
  .btn-browse:hover { border-color: var(--orange); color: var(--orange-dk); }

  /* ── How it works ── */
  .hiw-wrap {
    background: var(--bg2); border-radius: 20px;
    margin: 0 5% 3rem; padding: 2.5rem 3rem;
    border: 1px solid var(--border);
  }
  .hiw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: center; margin-top: 1.75rem; }
  .hiw-steps { display: flex; flex-direction: column; gap: 1.5rem; }
  .hiw-step { display: flex; gap: 0.875rem; }
  .hiw-num {
    width: 30px; height: 30px; border-radius: 50%;
    background: var(--orange-lt); border: 1.5px solid var(--orange);
    color: var(--orange-dk); font-size: 0.8rem; font-weight: 700;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .hiw-step-t { font-size: 0.88rem; font-weight: 700; color: var(--fg); margin-bottom: 3px; }
  .hiw-step-d { font-size: 0.78rem; color: var(--fg2); line-height: 1.55; }
  .hiw-img {
    background: var(--border); border-radius: 12px;
    aspect-ratio: 4/3; display: flex; align-items: center;
    justify-content: center; color: var(--fg3); font-size: 0.8rem;
  }

  /* ── Reviews ── */
  .review-list { display: flex; flex-direction: column; gap: 0.875rem; max-width: 600px; }
  .review-card {
    background: var(--orange-lt); border: 1px solid #FCD34D;
    border-radius: var(--radius); padding: 1.25rem 1.5rem;
  }
  .review-text { font-size: 0.875rem; color: var(--fg); line-height: 1.65; margin-bottom: 0.875rem; }
  .review-author { display: flex; align-items: center; gap: 0.6rem; }
  .review-av {
    width: 32px; height: 32px; border-radius: 50%;
    background: white; border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center; font-size: 0.9rem;
  }
  .review-name { font-size: 0.8rem; font-weight: 600; color: var(--fg); }
  .review-loc  { font-size: 0.7rem; color: var(--fg2); }

  /* ── Auth Modal ── */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 500;
    background: rgba(0,0,0,0.45);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    padding: 1rem;
  }
  .modal {
    background: var(--bg); border-radius: 20px;
    padding: 2rem; width: 100%; max-width: 400px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.15);
    animation: modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1);
  }
  @keyframes modalIn {
    from { transform: scale(0.92) translateY(16px); opacity: 0; }
    to   { transform: scale(1) translateY(0); opacity: 1; }
  }
  .modal-top {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 1.5rem;
  }
  .modal-title { font-size: 1.2rem; font-weight: 800; color: var(--fg); letter-spacing: -0.3px; }
  .modal-close {
    width: 30px; height: 30px; border-radius: 50%;
    border: 1.5px solid var(--border); background: none;
    cursor: pointer; font-size: 1rem; color: var(--fg2);
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
  }
  .modal-close:hover { border-color: var(--fg); color: var(--fg); }
  .modal-tabs {
    display: flex; background: var(--bg2);
    border-radius: 8px; padding: 3px;
    margin-bottom: 1.5rem; gap: 3px;
  }
  .modal-tab {
    flex: 1; padding: 8px; border: none; background: none;
    border-radius: 6px; font-family: var(--font);
    font-size: 0.82rem; font-weight: 600;
    color: var(--fg2); cursor: pointer; transition: all 0.15s;
  }
  .modal-tab.active { background: var(--bg); color: var(--fg); box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
  .form-group { margin-bottom: 1rem; }
  .form-label { display: block; font-size: 0.78rem; font-weight: 600; color: var(--fg); margin-bottom: 5px; }
  .form-input {
    width: 100%; height: 42px;
    border: 1.5px solid var(--border); border-radius: 8px;
    padding: 0 14px; font-family: var(--font);
    font-size: 0.875rem; color: var(--fg); outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .form-input:focus { border-color: var(--orange); box-shadow: 0 0 0 3px rgba(245,158,11,0.1); }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .btn-submit {
    width: 100%; height: 44px;
    background: var(--orange); border: none; border-radius: 8px;
    font-family: var(--font); font-size: 0.9rem; font-weight: 700;
    color: white; cursor: pointer; margin-top: 0.5rem;
    transition: background 0.15s;
  }
  .btn-submit:hover { background: var(--orange-dk); }
  .modal-divider {
    display: flex; align-items: center; gap: 0.75rem;
    margin: 1rem 0; color: var(--fg3); font-size: 0.75rem;
  }
  .modal-divider::before, .modal-divider::after {
    content: ''; flex: 1; height: 1px; background: var(--border);
  }
  .btn-google {
    width: 100%; height: 42px;
    background: var(--bg); border: 1.5px solid var(--border); border-radius: 8px;
    font-family: var(--font); font-size: 0.83rem; font-weight: 600;
    color: var(--fg); cursor: pointer; display: flex; align-items: center;
    justify-content: center; gap: 8px; transition: border-color 0.15s;
  }
  .btn-google:hover { border-color: var(--orange); }
  .modal-footer-text {
    text-align: center; font-size: 0.75rem; color: var(--fg2); margin-top: 1rem;
  }
  .modal-footer-text button {
    background: none; border: none; color: var(--orange-dk);
    font-weight: 600; cursor: pointer; font-size: 0.75rem;
    font-family: var(--font);
  }
  .role-select {
    display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; margin-bottom: 1rem;
  }
  .role-card {
    border: 1.5px solid var(--border); border-radius: 8px;
    padding: 0.75rem; text-align: center; cursor: pointer;
    transition: all 0.15s;
  }
  .role-card:hover { border-color: var(--orange); }
  .role-card.active { border-color: var(--orange); background: var(--orange-lt); }
  .role-card-icon { font-size: 1.3rem; margin-bottom: 3px; }
  .role-card-label { font-size: 0.75rem; font-weight: 600; color: var(--fg); }

  /* ── Chat bubble ── */
  .chat-bubble { position: fixed; bottom: 22px; left: 18px; z-index: 200; }
  .chat-label-row { display: flex; align-items: center; gap: 6px; margin-bottom: 7px; }
  .chat-label-pill {
    background: var(--fg); color: white; border-radius: 99px;
    padding: 4px 12px; font-size: 0.72rem; font-weight: 500;
    display: flex; align-items: center; gap: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
  .chat-x { cursor: pointer; opacity: 0.6; transition: opacity 0.15s; }
  .chat-x:hover { opacity: 1; }
  .chat-btn {
    width: 46px; height: 46px; border-radius: 50%;
    background: var(--orange); border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 14px rgba(245,158,11,0.35);
    transition: transform 0.2s; position: relative;
  }
  .chat-btn:hover { transform: scale(1.08); }
  .chat-btn svg { width: 20px; height: 20px; color: white; }
  .chat-badge {
    position: absolute; top: -2px; right: -2px;
    width: 15px; height: 15px; background: #EF4444;
    border-radius: 50%; border: 2px solid white;
    font-size: 0.58rem; font-weight: 700; color: white;
    display: flex; align-items: center; justify-content: center;
  }

  /* ── Footer ── */
  .footer {
    background: var(--fg); color: rgba(255,255,255,0.5);
    padding: 2rem 5%; margin-top: 3rem;
    display: flex; justify-content: space-between;
    align-items: center; flex-wrap: wrap; gap: 1rem;
  }
  .footer-brand { font-size: 1rem; font-weight: 700; color: white; }
  .footer-brand span { color: var(--orange); }
  .footer-links { display: flex; gap: 1.5rem; flex-wrap: wrap; }
  .footer-links a { font-size: 0.78rem; color: rgba(255,255,255,0.45); text-decoration: none; transition: color 0.15s; }
  .footer-links a:hover { color: white; }
  .footer-copy { width: 100%; text-align: center; font-size: 0.72rem; padding-top: 1.25rem; border-top: 1px solid rgba(255,255,255,0.08); margin-top: 0.5rem; }

  @media (max-width: 640px) {
    .nav-links { display: none; }
    .hiw-grid { grid-template-columns: 1fr; }
    .hiw-img { display: none; }
    .hiw-wrap { padding: 1.75rem; margin: 0 4% 2.5rem; }
    .form-row { grid-template-columns: 1fr; }
  }
`;

const CATEGORIES = [
  { id: "carpentry",  icon: "🪚", label: "Carpentry"        },
  { id: "appliance",  icon: "🔧", label: "Appliance Repair"  },
  { id: "plumbing",   icon: "🚿", label: "Plumbing"          },
  { id: "moving",     icon: "📦", label: "Moving"            },
  { id: "cleaning",   icon: "🧹", label: "Cleaning"          },
  { id: "outdoor",    icon: "🌿", label: "Outdoor Help"      },
  { id: "painting",   icon: "🖌️", label: "Painting"          },
  { id: "trending",   icon: "🔥", label: "Trending"          },
];

const SUBCATS = {
  carpentry:  ["Furniture Repair", "Flooring Installation", "Custom Built-ins", "Refinishing", "Trim Work"],
  appliance:  ["AC Repair", "Washer Repair", "Dryer Repair", "Refrigerator Repair", "Oven Repair"],
  plumbing:   ["Drain Cleaning", "Faucet Repair", "Toilet Repair", "Water Heater Repair", "Pipe Repair"],
  moving:     ["Furniture Moving", "Box Moving", "Specialty Moving", "Equipment Moving"],
  cleaning:   ["House Cleaning", "Deep Cleaning", "Move-in/Move-out"],
  outdoor:    ["Lawn Mowing", "Tree Trimming", "Plant Care", "Weed Control"],
  painting:   ["Interior Painting", "Exterior Painting"],
  trending:   ["Handyman", "Assembly", "Electrical", "HVAC"],
};

const WORKERS = [
  { name: "Ram Sharma",   role: "Master Plumber",       rating: 4.9, reviews: 128, rate: "Rs. 600", emoji: "👨‍🔧" },
  { name: "Sita Thapa",   role: "House Cleaner",        rating: 4.8, reviews: 94,  rate: "Rs. 450", emoji: "👩‍💼" },
  { name: "Bikash Karki", role: "Licensed Electrician", rating: 5.0, reviews: 61,  rate: "Rs. 800", emoji: "👨‍🏭" },
  { name: "Maya Gurung",  role: "Carpenter",            rating: 4.7, reviews: 47,  rate: "Rs. 550", emoji: "👩‍🔧" },
];

const REVIEWS = [
  { text: "Ram fixed our burst pipe in under two hours on a Sunday. Reliable, fast, and the price was exactly as quoted. Highly recommend!", name: "Priya Shrestha", loc: "Homeowner, Kathmandu" },
  { text: "Sita did an incredible deep clean before our house guests arrived. Thorough, professional, and left everything spotless.", name: "Anuj Maharjan", loc: "Homeowner, Lalitpur" },
];

function WorkerCard({ w }) {
  return (
    <div className="worker-card" onClick={() => window.location.href = `/worker/${w.name.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="w-avatar">
        {w.emoji}
        <div className="w-badge">
          <svg viewBox="0 0 10 8" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 4l3 3 5-6" /></svg>
        </div>
      </div>
      <div className="w-name">{w.name}</div>
      <div className="w-role">{w.role}</div>
      <div className="w-stars">
        {[1,2,3,4,5].map(i => <span key={i} className="star" style={{ opacity: i <= Math.round(w.rating) ? 1 : 0.2 }}>★</span>)}
        <span className="star-n">{w.rating.toFixed(1)}</span>
      </div>
      <div className="w-rate"><strong>{w.rate}/hr</strong> · {w.reviews} reviews</div>
      <button className="btn-book" onClick={e => { e.stopPropagation(); window.location.href = `/book/${w.name.toLowerCase().replace(/\s+/g, "-")}`; }}>
        BOOK NOW
      </button>
    </div>
  );
}

// ── Auth Modal ────────────────────────────────────────────────────────────────
function AuthModal({ onClose }) {
  const [tab,  setTab]  = useState("login");    // login | signup
  const [role, setRole] = useState("customer"); // customer | worker
  const [form, setForm] = useState({ firstName:"", lastName:"", email:"", phone:"", password:"", confirmPassword:"" });

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (tab === "login") {
      window.location.href = "/login";
    } else {
      window.location.href = role === "worker" ? "/register/worker" : "/register/customer";
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>

        <div className="modal-top">
          <div className="modal-title">{tab === "login" ? "Welcome back" : "Create account"}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Login / Signup tabs */}
        <div className="modal-tabs">
          <button className={`modal-tab ${tab === "login"  ? "active" : ""}`} onClick={() => setTab("login")}>Log in</button>
          <button className={`modal-tab ${tab === "signup" ? "active" : ""}`} onClick={() => setTab("signup")}>Sign up</button>
        </div>

        <form onSubmit={handleSubmit}>

          {/* Role picker — signup only */}
          {tab === "signup" && (
            <>
              <div style={{ fontSize:"0.75rem", fontWeight:600, color:"var(--fg)", marginBottom:"0.5rem" }}>I want to</div>
              <div className="role-select">
                {[
                  { id:"customer", icon:"🏠", label:"Hire a worker" },
                  { id:"worker",   icon:"🔨", label:"Offer services" },
                ].map(r => (
                  <div key={r.id} className={`role-card ${role === r.id ? "active" : ""}`} onClick={() => setRole(r.id)}>
                    <div className="role-card-icon">{r.icon}</div>
                    <div className="role-card-label">{r.label}</div>
                  </div>
                ))}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First name</label>
                  <input className="form-input" placeholder="Ram" value={form.firstName} onChange={e => set("firstName", e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Last name</label>
                  <input className="form-input" placeholder="Sharma" value={form.lastName} onChange={e => set("lastName", e.target.value)} required />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Phone number</label>
                <input className="form-input" placeholder="+977 98XXXXXXXX" value={form.phone} onChange={e => set("phone", e.target.value)} />
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Email address</label>
            <input className="form-input" type="email" placeholder="you@email.com" value={form.email} onChange={e => set("email", e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={e => set("password", e.target.value)} required />
          </div>

          {tab === "signup" && (
            <div className="form-group">
              <label className="form-label">Confirm password</label>
              <input className="form-input" type="password" placeholder="••••••••" value={form.confirmPassword} onChange={e => set("confirmPassword", e.target.value)} required />
            </div>
          )}

          <button type="submit" className="btn-submit">
            {tab === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <div className="modal-divider">or</div>

        <button className="btn-google">
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="modal-footer-text">
          {tab === "login"
            ? <>Don't have an account? <button onClick={() => setTab("signup")}>Sign up</button></>
            : <>Already have an account? <button onClick={() => setTab("login")}>Log in</button></>
          }
        </div>

      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [activeCat,    setActiveCat]    = useState("carpentry");
  const [activeSubcat, setActiveSubcat] = useState("Furniture Repair");
  const [query,        setQuery]        = useState("");
  const [showAuth,     setShowAuth]     = useState(false);
  const [chatLabel,    setChatLabel]    = useState(true);

  const subcats = SUBCATS[activeCat] || [];

  return (
    <>
      <style>{styles}</style>

      {/* Auth Modal */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      {/* ── Navbar ── */}
      <nav className="nav">
        <a href="/" className="nav-brand">
          <div className="leaf-icon">
            <svg viewBox="0 0 26 26" fill="none">
              <path d="M13 2C7 2 3 8 3 14c0 4 2.5 7.5 6.5 9 0-4 1-8 3.5-11C15.5 9 18 6.5 23 5c-2-2-5-3-10-3z" fill="#F59E0B"/>
              <path d="M13 24c0-5 2-10 5-13" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="nav-name">Kaam-ly</span>
        </a>

        <ul className="nav-links">
          <li><a href="/" style={{ color:"var(--fg)", fontWeight:600 }}>Home</a></li>
          <li><a href="/requests">My Requests</a></li>
          <li><a href="/messages">Messages</a></li>
        </ul>

        <div className="nav-right">
          <button className="btn-outline" onClick={() => { setShowAuth(true); }}>
            Become a Tasker
          </button>
          <button className="btn-orange" onClick={() => setShowAuth(true)}>
            Log in / Sign up
          </button>
          <div className="nav-avatar" onClick={() => setShowAuth(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        <h1>Book a Trusted Worker for Any Task</h1>
        <div className="search-wrap">
          <input
            className="search-input"
            type="text"
            placeholder="Search products..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (window.location.href = `/search?q=${encodeURIComponent(query)}`)}
          />
          <div className="search-cam">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
        </div>
      </section>

      {/* ── Category Tabs ── */}
      <div className="cats-bar">
        <div className="cats-scroll">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              className={`cat-tab ${activeCat === c.id ? "active" : ""}`}
              onClick={() => { setActiveCat(c.id); setActiveSubcat(SUBCATS[c.id]?.[0] || ""); }}
            >
              <span className="cat-tab-icon">{c.icon}</span>
              <span className="cat-tab-label">{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Subcategory Pills ── */}
      <div className="subcats-bar">
        {subcats.map(s => (
          <button
            key={s}
            className={`subcat-pill ${activeSubcat === s ? "active" : ""}`}
            onClick={() => setActiveSubcat(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ── Workers for selected subcat ── */}
      <section className="section">
        <h2 className="section-title">{activeSubcat || "All Workers"}</h2>
        <div className="workers-row">
          {WORKERS.map(w => <WorkerCard key={w.name} w={w} />)}
        </div>
      </section>

      <div className="browse-center">
        <button className="btn-browse" onClick={() => window.location.href="/workers"}>Browse more</button>
      </div>

      {/* ── How it works ── */}
      <div className="hiw-wrap">
        <h2 className="section-title" style={{ marginBottom:0 }}>How it works?</h2>
        <div className="hiw-grid">
          <div className="hiw-steps">
            {[
              { n:1, t:"Tell Us What You Need",         d:"From a leaky faucet to a full repaint — just share what's needed and where, and we'll handle the rest." },
              { n:2, t:"Receive Quotes & Chat",          d:"Workers review your request and send clear quotes. Compare profiles, check ratings, and chat directly in the app." },
              { n:3, t:"Service Completed & Pay Safely", d:"Once the job is done to your satisfaction. All work is covered by our fixed-price guarantee." },
            ].map(s => (
              <div key={s.n} className="hiw-step">
                <div className="hiw-num">{s.n}</div>
                <div>
                  <div className="hiw-step-t">{s.t}</div>
                  <div className="hiw-step-d">{s.d}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="hiw-img">IMAGE</div>
        </div>
      </div>

      {/* ── Top rated ── */}
      <section className="section">
        <h2 className="section-title">Our top rated service providers</h2>
        <div className="workers-row">
          {WORKERS.map(w => <WorkerCard key={w.name + "-top"} w={w} />)}
        </div>
      </section>

      <div className="browse-center">
        <button className="btn-browse" onClick={() => window.location.href="/workers"}>Browse more</button>
      </div>

      {/* ── Reviews ── */}
      <section className="section">
        <h2 className="section-title">Trusted reviews</h2>
        <div className="review-list">
          {REVIEWS.map((r, i) => (
            <div key={i} className="review-card">
              <p className="review-text">"{r.text}"</p>
              <div className="review-author">
                <div className="review-av">😊</div>
                <div>
                  <div className="review-name">{r.name}</div>
                  <div className="review-loc">{r.loc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Chatbot bubble ── */}
      <div className="chat-bubble">
        {chatLabel && (
          <div className="chat-label-row">
            <div className="chat-label-pill">
              Need help?
              <span className="chat-x" onClick={() => setChatLabel(false)}>✕</span>
            </div>
          </div>
        )}
        <button className="chat-btn" onClick={() => window.location.href="/chat"}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <div className="chat-badge">1</div>
        </button>
      </div>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-brand">Kaam<span>.</span>ly</div>
        <div className="footer-links">
          <a href="/about">About</a>
          <a href="/services">Services</a>
          <a href="/register/worker">Become a Tasker</a>
          <a href="/contact">Contact</a>
          <a href="/privacy">Privacy</a>
        </div>
        <div className="footer-copy">© {new Date().getFullYear()} Kaam.ly · Built for Nepal</div>
      </footer>
    </>
  );
}