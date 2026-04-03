import { useState, useEffect, useRef } from "react";

// ── Inline styles via CSS injection ──────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --orange: #F6AD56;
      --orange-dark: #E59D40;
      --orange-light: #FEF3C7;
      --navy: #0F172A;
      --slate: #475569;
      --light-slate: #94A3B8;
      --border: #E2E8F0;
      --bg: #F8FAFC;
      --white: #FFFFFF;
      --yellow: #FBBF24;
    }

    body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--navy); overflow-x: hidden; }

    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: var(--orange); border-radius: 3px; }

    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-8px); }
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes toastProgress {
      from { width: 100%; } to { width: 0%; }
    }

    .float-anim { animation: float 5s ease-in-out infinite; }
    .fade-up-1  { animation: fadeUp 0.6s 0.1s ease both; }
    .fade-up-2  { animation: fadeUp 0.6s 0.2s ease both; }

    .btn-primary {
      background: var(--orange); color: white; border: none; cursor: pointer;
      font-size: 14px; font-weight: 600; padding: 10px 20px; border-radius: 8px;
      font-family: 'DM Sans', sans-serif;
      transition: background 0.2s, transform 0.15s;
      box-shadow: 0 2px 8px rgba(246,173,86,0.35);
    }
    .btn-primary:hover { background: var(--orange-dark); transform: translateY(-1px); }
    .btn-primary:active { transform: translateY(0); }

    .btn-ghost {
      background: none; border: none; cursor: pointer;
      color: var(--slate); font-size: 14px; font-weight: 500;
      padding: 8px 16px; border-radius: 8px;
      font-family: 'DM Sans', sans-serif;
      transition: background 0.2s, color 0.2s;
    }
    .btn-ghost:hover { background: var(--bg); color: var(--navy); }

    .cat-card {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 22px 12px;
      background: var(--bg);
      border: 1.5px solid transparent;
      border-radius: 14px;
      cursor: pointer;
      transition: all 0.22s ease;
    }
    .cat-card:hover {
      background: var(--orange-light);
      border-color: var(--orange);
      transform: translateY(-4px);
      box-shadow: 0 8px 20px rgba(246,173,86,0.18);
    }
    .cat-card .cat-icon {
      width: 52px; height: 52px; background: var(--white); border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: background 0.22s;
    }
    .cat-card:hover .cat-icon { background: var(--orange); }
    .cat-card:hover .cat-icon svg { color: white !important; stroke: white !important; }
    .cat-card .cat-name { font-size: 13px; font-weight: 500; color: var(--slate); text-align: center; }
    .cat-card:hover .cat-name { color: var(--orange-dark); }

    .worker-card {
      background: var(--white); border-radius: 16px; overflow: hidden;
      border: 1.5px solid var(--border);
      transition: transform 0.22s, box-shadow 0.22s;
    }
    .worker-card:hover { transform: translateY(-6px); box-shadow: 0 16px 48px rgba(0,0,0,0.10); }

    .step-card {
      padding: 28px; border-radius: 16px; border: 1.5px solid var(--border);
      background: var(--white); transition: transform 0.22s, box-shadow 0.22s;
      position: relative; overflow: hidden;
    }
    .step-card:hover { transform: translateY(-4px); box-shadow: 0 12px 36px rgba(0,0,0,0.08); }

    .review-card {
      background: var(--white); border-radius: 16px; padding: 26px;
      border: 1.5px solid var(--border);
      transition: transform 0.22s, box-shadow 0.22s;
    }
    .review-card:hover { transform: translateY(-4px); box-shadow: 0 12px 36px rgba(0,0,0,0.08); }

    .guarantee-card {
      text-align: center; padding: 32px 20px; border-radius: 16px;
      background: var(--bg); border: 1.5px solid var(--border);
      transition: all 0.22s;
    }
    .guarantee-card:hover {
      background: var(--white); transform: translateY(-4px);
      box-shadow: 0 12px 36px rgba(0,0,0,0.08); border-color: var(--orange);
    }
    .guarantee-card:hover .g-icon-wrap { background: var(--orange) !important; }
    .guarantee-card:hover .g-icon-wrap svg { stroke: white !important; }

    .social-btn {
      width: 36px; height: 36px; background: #1E293B; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: background 0.2s;
    }
    .social-btn:hover { background: var(--orange); }

    .scroll-reveal {
      opacity: 0; transform: translateY(20px);
      transition: opacity 0.5s ease, transform 0.5s ease;
    }
    .scroll-reveal.visible { opacity: 1; transform: translateY(0); }

    .search-bar {
      display: flex; background: white; border: 1.5px solid var(--border);
      border-radius: 12px; overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .search-bar:focus-within {
      border-color: var(--orange);
      box-shadow: 0 4px 24px rgba(246,173,86,0.2);
    }
    .search-bar input {
      flex: 1; border: none; outline: none; padding: 14px 16px 14px 44px;
      font-size: 15px; font-family: 'DM Sans', sans-serif;
      color: var(--navy); background: transparent;
    }
    .search-bar .btn-primary { border-radius: 0 10px 10px 0; padding: 14px 28px; font-size: 15px; }

    @media (max-width: 768px) {
      .hero-img-col { display: none !important; }
      .hero-grid { grid-template-columns: 1fr !important; }
      .cats-grid { grid-template-columns: repeat(3, 1fr) !important; }
      .workers-grid { grid-template-columns: 1fr !important; }
      .steps-grid { grid-template-columns: 1fr !important; }
      .reviews-grid { grid-template-columns: 1fr !important; }
      .guarantee-grid { grid-template-columns: 1fr 1fr !important; }
      .desktop-nav { display: none !important; }
      .desktop-btns { display: none !important; }
      .hamburger-btn { display: block !important; }
      .footer-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
    }
    @media (max-width: 480px) {
      .cats-grid { grid-template-columns: repeat(2, 1fr) !important; }
      .guarantee-grid { grid-template-columns: 1fr !important; }
    }
  `}</style>
);

// ── Scroll reveal hook ────────────────────────────────────────────────────────
function useScrollReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add("scroll-reveal");
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) el.classList.add("visible"); },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

// ── Small shared components ───────────────────────────────────────────────────
const StarIcon = ({ size = 14, filled = true }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size}
    fill={filled ? "#FBBF24" : "none"} viewBox="0 0 24 24"
    stroke={filled ? "none" : "#FBBF24"} strokeWidth="1.5">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const Stars = ({ count = 5 }) => (
  <div style={{ display: "flex", gap: 2 }}>
    {Array.from({ length: count }).map((_, i) => <StarIcon key={i} size={15} />)}
  </div>
);

const VerifiedIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="#F6AD56" strokeWidth="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const Badge = ({ children, orange }) => (
  <span style={{
    display: "inline-flex", alignItems: "center",
    padding: "3px 10px",
    background: orange ? "var(--orange-light)" : "var(--bg)",
    borderRadius: 100,
    fontSize: 11, fontWeight: 500,
    color: orange ? "var(--orange-dark)" : "var(--slate)",
    border: `1px solid ${orange ? "rgba(246,173,86,0.3)" : "var(--border)"}`,
  }}>{children}</span>
);

// ── Header ───────────────────────────────────────────────────────────────────
function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [
    { href: "#categories", label: "Find Services" },
    { href: "#workers",    label: "For Workers" },
    { href: "#how-it-works", label: "How It Works" },
    { href: "#reviews",    label: "Reviews" },
  ];
  const scrollTo = (href) => {
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMenuOpen(false);
  };
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 68 }}>
        <a href="#" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 36, height: 36, background: "var(--orange)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            </svg>
          </div>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "var(--navy)" }}>ServiceHub</span>
        </a>

        <nav className="desktop-nav" style={{ display: "flex", gap: 32 }}>
          {links.map(l => (
            <button key={l.href} onClick={() => scrollTo(l.href)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--slate)", fontSize: 14, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", transition: "color 0.2s" }}
              onMouseOver={e => e.target.style.color = "var(--orange)"}
              onMouseOut={e => e.target.style.color = "var(--slate)"}
            >{l.label}</button>
          ))}
        </nav>

        <div className="desktop-btns" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button className="btn-ghost">Sign In</button>
          <button className="btn-primary">Become a Pro</button>
        </div>

        <button className="hamburger-btn btn-ghost" style={{ display: "none", padding: 4 }} onClick={() => setMenuOpen(o => !o)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div style={{ background: "white", borderTop: "1px solid var(--border)", padding: "16px 24px 24px" }}>
          {links.map(l => (
            <button key={l.href} onClick={() => scrollTo(l.href)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 0", background: "none", border: "none", borderBottom: "1px solid var(--border)", color: "var(--slate)", fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}
            >{l.label}</button>
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="btn-ghost" style={{ flex: 1 }}>Sign In</button>
            <button className="btn-primary" style={{ flex: 1 }}>Become a Pro</button>
          </div>
        </div>
      )}
    </header>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{ background: "linear-gradient(135deg, #FFFBF5 0%, #FFF7ED 40%, #FFFFFF 100%)", padding: "96px 0 80px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -100, right: -100, width: 500, height: 500, background: "radial-gradient(circle, rgba(246,173,86,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          <div className="fade-up-1">
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--orange-light)", color: "var(--orange-dark)", fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 100, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 20 }}>
              <StarIcon size={12} /> Trusted by 50,000+ customers
            </div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(36px,5vw,58px)", fontWeight: 800, lineHeight: 1.1, color: "var(--navy)" }}>
              Find trusted local <em style={{ fontStyle: "italic", color: "var(--orange)" }}>professionals</em> near you
            </h1>
            <p style={{ marginTop: 20, fontSize: 17, color: "var(--slate)", lineHeight: 1.65 }}>
              Connect with skilled service providers in your area. From home repairs to professional services — get quality work done quickly and securely.
            </p>
            <div className="search-bar" style={{ marginTop: 36 }}>
              <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
                <svg style={{ position: "absolute", left: 14, color: "var(--light-slate)" }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input type="text" placeholder="What service do you need?" />
              </div>
              <button className="btn-primary">Search</button>
            </div>
            <div style={{ display: "flex", gap: 28, marginTop: 28, flexWrap: "wrap" }}>
              {[
                { icon: <StarIcon size={18} />, text: "4.9/5 from 50k+ reviews" },
                { icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>, text: "Background checked" },
                { icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>, text: "24/7 support" },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {s.icon}
                  <span style={{ fontSize: 14, color: "var(--slate)" }}>{s.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-img-col float-anim fade-up-2" style={{ position: "relative" }}>
            <img src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&h=450&fit=crop" alt="Service professional"
              style={{ width: "100%", borderRadius: 20, boxShadow: "0 24px 64px rgba(0,0,0,0.14)", objectFit: "cover", aspectRatio: "4/3" }} />
            <div style={{ position: "absolute", bottom: -16, left: -20, background: "white", borderRadius: 14, padding: "14px 18px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, background: "var(--orange-light)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--light-slate)" }}>Jobs Completed</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>12,400+</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { name: "Carpentry", icon: <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="1.8"><path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9" /><path d="M17.64 15 22 10.64" /><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91" /></svg> },
  { name: "Appliance Repair", icon: <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="1.8"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg> },
  { name: "Plumbing", icon: <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="1.8"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg> },
  { name: "Moving", icon: <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="1.8"><rect width="16" height="13" x="6" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg> },
  { name: "Cleaning", icon: <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="1.8"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg> },
  { name: "Outdoor Help", icon: <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="1.8"><path d="M17 14c0 4-2.5 6-5 8" /><path d="M12 22c-2.5-2-5-4-5-8 0-3.5 2.5-6 5-6s5 2.5 5 6" /><path d="M7 5c0 3-1 4.5-2 6" /><path d="M5 11C3 9.5 2 8 2 5c2 0 3.5 1 5 3" /><path d="M17 5c0 3 1 4.5 2 6" /><path d="M19 11c2-1.5 3-3 3-6-2 0-3.5 1-5 3" /></svg> },
  { name: "Painting", icon: <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="1.8"><path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" /><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" /></svg> },
  { name: "Electrical", icon: <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="1.8"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> },
  { name: "Furniture Repair", icon: <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="1.8"><path d="M20 9V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2" /><circle cx="17" cy="16" r="3" /><path d="M17 12V9" /><path d="m21 20-2.1-2.1" /></svg> },
  { name: "Lawn Care", icon: <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="1.8"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></svg> },
];

function Categories() {
  const ref = useScrollReveal();
  return (
    <section id="categories" style={{ padding: "80px 0", background: "var(--white)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div ref={ref} style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px,4vw,40px)", fontWeight: 800, color: "var(--navy)" }}>
            Browse by <span style={{ color: "var(--orange)" }}>Category</span>
          </h2>
          <p style={{ marginTop: 12, color: "var(--slate)", fontSize: 16, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
            Find the right professional for your specific needs across our wide range of service categories
          </p>
        </div>
        <div className="cats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
          {CATEGORIES.map((c, i) => {
            const r = useScrollReveal();
            return (
              <button key={i} ref={r} className="cat-card">
                <div className="cat-icon">{c.icon}</div>
                <span className="cat-name">{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Workers ───────────────────────────────────────────────────────────────────
const WORKERS = [
  { name: "Michael Rodriguez", service: "Furniture Repair", rating: 4.9, reviews: 127, img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop", skills: ["Wood Repair", "Refinishing", "Assembly"], jobs: "245+", rate: "$45/hr", response: "2 hours" },
  { name: "Sarah Chen",        service: "Lawn Care",        rating: 5.0, reviews: 203, img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop", skills: ["Mowing", "Landscaping", "Fertilization"], jobs: "412+", rate: "$35/hr", response: "1 hour" },
  { name: "James Patterson",   service: "Plumbing",         rating: 4.8, reviews: 189, img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop", skills: ["Leak Repair", "Installation", "Emergency"], jobs: "356+", rate: "$65/hr", response: "30 minutes" },
  { name: "Emily Thompson",    service: "House Cleaning",   rating: 4.9, reviews: 312, img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop", skills: ["Deep Cleaning", "Organizing", "Move-out"], jobs: "589+", rate: "$40/hr", response: "3 hours" },
  { name: "David Kim",         service: "Electrical Work",  rating: 4.7, reviews: 156, img: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop", skills: ["Wiring", "Panel Upgrade", "Lighting"], jobs: "298+", rate: "$70/hr", response: "1 hour" },
  { name: "Lisa Martinez",     service: "Painting",         rating: 5.0, reviews: 178, img: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=200&h=200&fit=crop", skills: ["Interior", "Exterior", "Cabinet"], jobs: "267+", rate: "$50/hr", response: "2 hours" },
];

function WorkerCard({ w }) {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className="worker-card">
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <img src={w.img} alt={w.name} style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover", border: "2.5px solid var(--orange-light)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: "var(--navy)" }}>{w.name}</span>
              <VerifiedIcon />
            </div>
            <div style={{ fontSize: 13, color: "var(--orange)", fontWeight: 500, marginTop: 2 }}>{w.service}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <StarIcon size={14} />
              <span style={{ fontWeight: 600, fontSize: 13 }}>{w.rating}</span>
              <span style={{ color: "var(--light-slate)", fontSize: 12 }}>({w.reviews} reviews)</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
          {w.skills.map(s => <Badge key={s}>{s}</Badge>)}
        </div>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {[["Completed Jobs", w.jobs], ["Hourly Rate", w.rate], ["Response Time", w.response]].map(([label, val]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--light-slate)" }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: label === "Hourly Rate" ? "var(--orange)" : "var(--navy)" }}>{val}</span>
            </div>
          ))}
        </div>
        <button className="btn-primary" style={{ width: "100%", marginTop: 18, padding: 12, fontSize: 14 }}>Hire Now</button>
      </div>
    </div>
  );
}

function Workers() {
  const ref = useScrollReveal();
  return (
    <section id="workers" style={{ padding: "80px 0", background: "var(--bg)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div ref={ref} style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px,4vw,40px)", fontWeight: 800, color: "var(--navy)" }}>
            Featured <span style={{ color: "var(--orange)" }}>Professionals</span>
          </h2>
          <p style={{ marginTop: 12, color: "var(--slate)", fontSize: 16, maxWidth: 560, margin: "12px auto 0" }}>
            Highly-rated service providers ready to help with your next project
          </p>
        </div>
        <div className="workers-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {WORKERS.map((w, i) => <WorkerCard key={i} w={w} />)}
        </div>
      </div>
    </section>
  );
}

// ── How It Works ──────────────────────────────────────────────────────────────
const STEPS = [
  { num: 1, title: "Send a Request", desc: "Describe your project and what you need help with. Be as detailed as possible for the best matches.", stripe: "#E0E7FF" },
  { num: 2, title: "Negotiate Pricing", desc: "Chat with workers and agree on fair pricing that works for both parties.", stripe: "#FEF3C7" },
  { num: 3, title: "Worker Accepts", desc: "Worker accepts the job and commits to your timeline and agreed scope of work.", stripe: "#D1FAE5" },
  { num: 4, title: "Pay in Escrow", desc: "Your payment is held securely in escrow until you're satisfied with the work.", stripe: "#DBEAFE" },
  { num: 5, title: "Work Completed", desc: "Worker completes the job to your satisfaction. Review the work before approving.", stripe: "#FCE7F3" },
  { num: 6, title: "Escrow Released", desc: "Once you approve the work, payment is released to the worker automatically.", stripe: "#D5F5E3" },
];

function HowItWorks() {
  const ref = useScrollReveal();
  return (
    <section id="how-it-works" style={{ padding: "80px 0", background: "var(--white)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div ref={ref} style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px,4vw,40px)", fontWeight: 800, color: "var(--navy)" }}>
            How <span style={{ color: "var(--orange)" }}>ServiceHub</span> Works
          </h2>
          <p style={{ marginTop: 12, color: "var(--slate)", fontSize: 16, maxWidth: 560, margin: "12px auto 0" }}>
            Simple, transparent process to get your projects done
          </p>
        </div>
        <div className="steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {STEPS.map(s => {
            const r = useScrollReveal();
            return (
              <div key={s.num} ref={r} className="step-card">
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: s.stripe, borderRadius: "16px 16px 0 0" }} />
                <div style={{ width: 46, height: 46, background: "var(--orange)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800, color: "white", marginBottom: 16, boxShadow: "0 4px 12px rgba(246,173,86,0.35)" }}>{s.num}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--navy)", marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: "var(--slate)", lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Reviews ───────────────────────────────────────────────────────────────────
const REVIEWS = [
  { name: "Jennifer Wilson", service: "Electrical Help", img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop", text: "The electrician arrived exactly on time and knew exactly what to do. Professional, clean, and efficient. 100% would hire again!", date: "March 15, 2026" },
  { name: "Mark Stevens",    service: "Plumbing",        img: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop", text: "Had an emergency leak late at night. He was prompt, communicative, and fixed it faster than I expected. Highly recommend!", date: "March 10, 2026" },
  { name: "Rebecca Moore",   service: "General Mounting",img: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop", text: "Patient and willing to help figure it out with us. Great communication throughout the whole process. Thank you!", date: "March 5, 2026" },
];

function Reviews() {
  const ref = useScrollReveal();
  return (
    <section id="reviews" style={{ padding: "80px 0", background: "var(--bg)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div ref={ref} style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px,4vw,40px)", fontWeight: 800, color: "var(--navy)" }}>
            What Our <span style={{ color: "var(--orange)" }}>Customers Say</span>
          </h2>
          <p style={{ marginTop: 12, color: "var(--slate)", fontSize: 16, maxWidth: 560, margin: "12px auto 0" }}>
            Join thousands of satisfied customers who found trusted professionals
          </p>
        </div>
        <div className="reviews-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {REVIEWS.map((r, i) => {
            const ref2 = useScrollReveal();
            return (
              <div key={i} ref={ref2} className="review-card">
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <img src={r.img} alt={r.name} style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover" }} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--navy)" }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: "var(--light-slate)", marginTop: 1 }}>{r.service}</div>
                  </div>
                </div>
                <Stars />
                <p style={{ fontSize: 14, color: "var(--slate)", lineHeight: 1.65, margin: "10px 0 12px" }}>
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 48, lineHeight: 1, color: "var(--orange-light)", float: "left", marginRight: 4, marginTop: -4 }}>"</span>
                  {r.text}
                </p>
                <p style={{ fontSize: 12, color: "var(--light-slate)" }}>{r.date}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Guarantee ─────────────────────────────────────────────────────────────────
const GUARANTEES = [
  { title: "Background Checked", desc: "All professionals undergo thorough background verification before joining our platform.", icon: <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> },
  { title: "24/7 Support",       desc: "Our support team is available around the clock to help with any questions or issues.", icon: <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> },
  { title: "Quality Guaranteed", desc: "Not satisfied? We'll make it right or refund your money — no questions asked.", icon: <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="1.8"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" /><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" /></svg> },
  { title: "Secure Payments",    desc: "Your payments are protected with bank-grade escrow protection on every job.", icon: <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg> },
];

function Guarantee() {
  const ref = useScrollReveal();
  return (
    <section style={{ padding: "80px 0", background: "var(--white)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div ref={ref} style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px,4vw,40px)", fontWeight: 800, color: "var(--navy)" }}>
            Our <span style={{ color: "var(--orange)" }}>Guarantee</span>
          </h2>
          <p style={{ marginTop: 12, color: "var(--slate)", fontSize: 16, maxWidth: 560, margin: "12px auto 0" }}>
            We stand behind every booking with our comprehensive guarantees
          </p>
        </div>
        <div className="guarantee-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
          {GUARANTEES.map((g, i) => {
            const r = useScrollReveal();
            return (
              <div key={i} ref={r} className="guarantee-card">
                <div className="g-icon-wrap" style={{ width: 64, height: 64, background: "var(--orange-light)", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", transition: "background 0.22s" }}>
                  {g.icon}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--navy)", marginBottom: 8 }}>{g.title}</div>
                <div style={{ fontSize: 13, color: "var(--slate)", lineHeight: 1.6 }}>{g.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  const socialIcons = [
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#94A3B8" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>,
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" /></svg>,
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>,
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>,
  ];
  return (
    <footer style={{ background: "var(--navy)", color: "#CBD5E1", padding: "64px 0 32px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.5fr", gap: 48, marginBottom: 48 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, background: "var(--orange)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>
              </div>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "white" }}>ServiceHub</span>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "#94A3B8", marginBottom: 20 }}>Connecting you with trusted local service professionals for all your home and business needs.</p>
            <div style={{ display: "flex", gap: 14 }}>
              {socialIcons.map((icon, i) => <div key={i} className="social-btn">{icon}</div>)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "white", marginBottom: 16 }}>Quick Links</div>
            {["Find Services", "For Workers", "How It Works", "Reviews", "Become a Pro"].map(l => (
              <a key={l} href="#" style={{ display: "block", fontSize: 13, color: "#94A3B8", textDecoration: "none", marginBottom: 10, transition: "color 0.2s" }}
                onMouseOver={e => e.target.style.color = "var(--orange)"} onMouseOut={e => e.target.style.color = "#94A3B8"}>{l}</a>
            ))}
          </div>

          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "white", marginBottom: 16 }}>Support</div>
            {["Help Center", "Safety Center", "Terms of Service", "Privacy Policy", "Cookie Settings"].map(l => (
              <a key={l} href="#" style={{ display: "block", fontSize: 13, color: "#94A3B8", textDecoration: "none", marginBottom: 10, transition: "color 0.2s" }}
                onMouseOver={e => e.target.style.color = "var(--orange)"} onMouseOut={e => e.target.style.color = "#94A3B8"}>{l}</a>
            ))}
          </div>

          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "white", marginBottom: 16 }}>Contact Us</div>
            {[
              { icon: <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>, text: "support@servicehub.com" },
              { icon: <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.08 6.08l1.95-1.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>, text: "1-800-SERVICE" },
              { icon: <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>, text: "123 Service St, Suite 100, San Francisco, CA 94105" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12, fontSize: 13, color: "#94A3B8" }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </div>
        <hr style={{ border: "none", borderTop: "1px solid #1E293B", marginBottom: 24 }} />
        <p style={{ textAlign: "center", fontSize: 13, color: "#475569" }}>© 2026 ServiceHub Marketplace. All rights reserved.</p>
      </div>
    </footer>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function ServiceHub() {
  return (
    <>
      <GlobalStyles />
      <Header />
      <Hero />
      <Categories />
      <Workers />
      <HowItWorks />
      <Reviews />
      <Guarantee />
      <Footer />
    </>
  );
}