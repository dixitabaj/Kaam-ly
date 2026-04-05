import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
// ── Local assets (same as your home page + login page) ───────────────────────
import logo        from "../../images/logo.png";
import assemblyImg from "../../images/assembly.png";
import repairImg   from "../../images/plumbing.png";
import movingImg   from "../../images/moving.png";
import cleaningImg from "../../images/cleaning.png";
import outdoorImg  from "../../images/gardening.png";
import paintingImg from "../../images/painting.png";
import trendingImg from "../../images/trending.png";
import mountingImg from "../../images/repair.png";

/* ─── Global Styles ──────────────────────────────────────────────────────────*/
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,700;0,800;1,700&display=swap');
    
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --orange:       #F6AD56;
      --orange-dark:  #E59D40;
      --orange-light: #FEF3C7;
      --navy:         #0F172A;
      --slate:        #475569;
      --light-slate:  #94A3B8;
      --border:       #E2E8F0;
      --bg:           #F8FAFC;
      --white:        #FFFFFF;
      --font:         'Inter', sans-serif;
      --font-display: 'Playfair Display', serif;
    }

    html { scroll-behavior: smooth; }
    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--navy);
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
    }

    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: var(--orange); border-radius: 3px; }

    @keyframes float {
      0%,100% { transform: translateY(0px); }
      50%      { transform: translateY(-10px); }
    }
    @keyframes fadeUp {
      from { opacity:0; transform:translateY(24px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes slideDown {
      from { opacity:0; transform:translateY(-10px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes slideIn {
      from { opacity:0; transform:translateX(-12px); }
      to   { opacity:1; transform:translateX(0); }
    }

    .float-anim { animation: float 6s ease-in-out infinite; }
    .fade-up-1  { animation: fadeUp 0.65s 0.05s ease both; }
    .fade-up-2  { animation: fadeUp 0.65s 0.15s ease both; }
    .fade-up-3  { animation: fadeUp 0.65s 0.25s ease both; }

    .scroll-reveal {
      opacity:0; transform:translateY(22px);
      transition: opacity .55s ease, transform .55s ease;
    }
    .scroll-reveal.visible { opacity:1; transform:translateY(0); }

    /* Buttons */
    .btn-primary {
      background:var(--orange); color:#fff; border:none; cursor:pointer;
      font-size:14px; font-weight:600; padding:11px 22px; border-radius:10px;
      font-family:var(--font); letter-spacing:-0.01em;
      transition: background .2s, transform .15s, box-shadow .2s;
      box-shadow:0 2px 10px rgba(246,173,86,.38);
    }
    .btn-primary:hover  { background:var(--orange-dark); transform:translateY(-1px); box-shadow:0 6px 20px rgba(246,173,86,.42); }
    .btn-primary:active { transform:translateY(0); }

    .btn-outline {
      background:transparent; color:var(--navy); border:1.5px solid var(--border);
      cursor:pointer; font-size:14px; font-weight:600; padding:11px 22px;
      border-radius:10px; font-family:var(--font); letter-spacing:-0.01em;
      transition: border-color .2s, background .2s, transform .15s;
    }
    .btn-outline:hover { border-color:var(--orange); background:var(--orange-light); transform:translateY(-1px); }

    .btn-ghost {
      background:none; border:none; cursor:pointer; color:var(--slate);
      font-size:14px; font-weight:500; padding:9px 14px; border-radius:9px;
      font-family:var(--font); transition: background .2s, color .2s;
    }
    .btn-ghost:hover { background:var(--bg); color:var(--navy); }

    /* Search */
    .search-bar {
      display:flex; background:white; border:1.5px solid var(--border);
      border-radius:14px; overflow:hidden;
      box-shadow:0 4px 28px rgba(0,0,0,.08);
      transition: border-color .2s, box-shadow .2s;
    }
    .search-bar:focus-within { border-color:var(--orange); box-shadow:0 4px 28px rgba(246,173,86,.22); }
    .search-bar input {
      flex:1; border:none; outline:none; padding:15px 16px 15px 46px;
      font-size:15px; font-family:var(--font); color:var(--navy); background:transparent;
    }
    .search-bar input::placeholder { color:var(--light-slate); }
    .search-bar .btn-primary { border-radius:0 12px 12px 0; padding:15px 28px; font-size:15px; box-shadow:none; }

    /* Category card */
    .cat-card {
      display:flex; flex-direction:column; align-items:center; gap:8px;
      padding:16px 10px; border-radius:16px; cursor:pointer;
      border:1.5px solid transparent; background:var(--bg);
      transition: all .22s ease; text-align:center; width:100%;
      font-family:var(--font);
    }
    .cat-card:hover, .cat-card.active {
      background:var(--orange-light); border-color:var(--orange);
      transform:translateY(-4px); box-shadow:0 8px 24px rgba(246,173,86,.18);
    }
    .cat-icon {
      width:58px; height:58px; background:var(--white); border-radius:14px;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 2px 10px rgba(0,0,0,.07); overflow:hidden; transition:background .22s;
    }
    .cat-card:hover .cat-icon, .cat-card.active .cat-icon { background:rgba(246,173,86,.15); }
    .cat-img { width:34px; height:34px; object-fit:contain; }
    .cat-name { font-size:12px; font-weight:600; color:var(--slate); letter-spacing:-0.01em; line-height:1.3; }
    .cat-card:hover .cat-name, .cat-card.active .cat-name { color:var(--orange-dark); }

    /* Subcategory dropdown */
    .subcat-wrap {
      animation: slideDown .3s ease both;
      background:var(--white); border:1.5px solid var(--border);
      border-radius:16px; padding:18px 20px; margin-top:14px;
      box-shadow:0 8px 32px rgba(0,0,0,.07);
    }
    .subcat-pill {
      display:inline-flex; align-items:center;
      padding:7px 16px; border-radius:100px;
      border:1.5px solid var(--border);
      background:var(--bg); color:var(--slate);
      font-size:13px; font-weight:500; cursor:pointer;
      font-family:var(--font); letter-spacing:-0.01em;
      transition: all .18s ease; white-space:nowrap;
    }
    .subcat-pill:hover, .subcat-pill.active {
      background:var(--orange); border-color:var(--orange);
      color:white; transform:translateY(-1px);
      box-shadow:0 4px 12px rgba(246,173,86,.35);
    }

    /* Worker / step / review / guarantee cards */
    .worker-card {
      background:var(--white); border-radius:18px; overflow:hidden;
      border:1.5px solid var(--border); transition:transform .22s, box-shadow .22s;
    }
    .worker-card:hover { transform:translateY(-6px); box-shadow:0 20px 52px rgba(0,0,0,.11); }

    .step-card {
      padding:28px; border-radius:18px; border:1.5px solid var(--border);
      background:var(--white); transition:transform .22s, box-shadow .22s;
      position:relative; overflow:hidden;
    }
    .step-card:hover { transform:translateY(-4px); box-shadow:0 14px 40px rgba(0,0,0,.09); }

    .review-card {
      background:var(--white); border-radius:18px; padding:26px;
      border:1.5px solid var(--border); transition:transform .22s, box-shadow .22s;
    }
    .review-card:hover { transform:translateY(-4px); box-shadow:0 14px 40px rgba(0,0,0,.09); }

    .guarantee-card {
      text-align:center; padding:30px 20px; border-radius:18px;
      background:var(--bg); border:1.5px solid var(--border); transition:all .22s;
    }
    .guarantee-card:hover {
      background:var(--white); transform:translateY(-4px);
      box-shadow:0 14px 40px rgba(0,0,0,.09); border-color:var(--orange);
    }
    .guarantee-card:hover .g-icon-wrap { background:var(--orange) !important; }
    .guarantee-card:hover .g-icon-wrap svg { stroke:white !important; }

    /* Stat pill */
    .stat-pill {
      display:flex; align-items:center; gap:10px;
      background:white; border-radius:14px; padding:13px 16px;
      box-shadow:0 8px 32px rgba(0,0,0,.13);
      animation: slideIn .5s ease both;
    }

    /* Social */
    .social-btn {
      width:36px; height:36px; background:#1E293B; border-radius:9px;
      display:flex; align-items:center; justify-content:center;
      cursor:pointer; transition:background .2s;
    }
    .social-btn:hover { background:var(--orange); }
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    /* ── Responsive ── */
    @media (max-width:1024px) {
      .workers-grid   { grid-template-columns:repeat(2,1fr) !important; }
      .guarantee-grid { grid-template-columns:repeat(2,1fr) !important; }
      .steps-grid     { grid-template-columns:repeat(2,1fr) !important; }
      .cats-grid      { grid-template-columns:repeat(4,1fr) !important; }
    }
    @media (max-width:768px) {
      .hero-img-col   { display:none !important; }
      .hero-grid      { grid-template-columns:1fr !important; }
      .cats-grid      { grid-template-columns:repeat(3,1fr) !important; }
      .workers-grid   { grid-template-columns:1fr !important; }
      .steps-grid     { grid-template-columns:1fr !important; }
      .reviews-grid   { grid-template-columns:1fr !important; }
      .guarantee-grid { grid-template-columns:1fr 1fr !important; }
      .desktop-nav    { display:none !important; }
      .desktop-btns   { display:none !important; }
      .hamburger-btn  { display:flex !important; }
      .footer-grid    { grid-template-columns:1fr 1fr !important; gap:28px !important; }
      .subcat-wrap    { padding:14px; }
    }
    @media (max-width:480px) {
      .cats-grid      { grid-template-columns:repeat(2,1fr) !important; }
      .guarantee-grid { grid-template-columns:1fr !important; }
      .footer-grid    { grid-template-columns:1fr !important; }
      .hero-badges    { flex-direction:column !important; gap:10px !important; }
    }
  `}</style>
);

/* ─── Scroll reveal hook ─────────────────────────────────────────────────────*/
function useScrollReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add("scroll-reveal");
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) el.classList.add("visible"); },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* ─── Tiny atoms ─────────────────────────────────────────────────────────────*/
const StarIcon = ({ size = 14 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="#FBBF24" viewBox="0 0 24 24">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const Stars = () => (
  <div style={{ display:"flex", gap:2 }}>
    {[...Array(5)].map((_,i) => <StarIcon key={i} size={13} />)}
  </div>
);

/* ─── Data ───────────────────────────────────────────────────────────────────*/
const CATEGORY_DATA = [
  { id:"Carpentry",        label:"Carpentry",        image:assemblyImg,  subcategories:["Furniture Repair","Flooring Installation","Custom Built-ins","Refinishing","Trim Work"] },
  { id:"Appliance Repair", label:"Appliance Repair", image:repairImg,    subcategories:["AC Installation","AC Repair","Dryer Repair","Washer Repair","Refrigerator Repair","Dishwasher Repair","Oven Repair"] },
  { id:"Plumbing",         label:"Plumbing",         image:mountingImg,  subcategories:["Drain Cleaning","Faucet Repair","Toilet Repair","Water Heater Repair","Pipe Repair"] },
  { id:"Moving",           label:"Moving",           image:movingImg,    subcategories:["Furniture Moving","Box Moving","Specialty Moving","Equipment Moving"] },
  { id:"Cleaning",         label:"Cleaning",         image:cleaningImg,  subcategories:["House Cleaning","Deep Cleaning","Move-in/Move-out Cleaning"] },
  { id:"Outdoor Help",     label:"Outdoor Help",     image:outdoorImg,   subcategories:["Lawn Mowing","Tree Trimming","Plant Care","Weed Control","Fertilization"] },
  { id:"Painting",         label:"Painting",         image:paintingImg,  subcategories:["Interior","Exterior"] },
  { id:"Trending",         label:"Trending",         image:trendingImg,  subcategories:["Popular Services","Top Rated","Emergency Services","New Services"] },
];

const WORKERS = [
  { name:"Michael Rodriguez", service:"Furniture Repair", rating:4.9, reviews:127, img:"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop", skills:["Wood Repair","Refinishing","Assembly"],       jobs:"245+", rate:"Rs. 1,200/hr", response:"2 hours" },
  { name:"Sarah Chen",        service:"Lawn Care",        rating:5.0, reviews:203, img:"https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop", skills:["Mowing","Landscaping","Fertilization"],        jobs:"412+", rate:"Rs. 900/hr",   response:"1 hour"  },
  { name:"James Patterson",   service:"Plumbing",         rating:4.8, reviews:189, img:"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop", skills:["Leak Repair","Installation","Emergency"],      jobs:"356+", rate:"Rs. 1,800/hr", response:"30 min"  },
  { name:"Emily Thompson",    service:"House Cleaning",   rating:4.9, reviews:312, img:"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop", skills:["Deep Cleaning","Organizing","Move-out"],        jobs:"589+", rate:"Rs. 1,000/hr", response:"3 hours" },
  { name:"David Kim",         service:"Electrical Work",  rating:4.7, reviews:156, img:"https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop", skills:["Wiring","Panel Upgrade","Lighting"],           jobs:"298+", rate:"Rs. 2,000/hr", response:"1 hour"  },
  { name:"Lisa Martinez",     service:"Painting",         rating:5.0, reviews:178, img:"https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=200&h=200&fit=crop", skills:["Interior","Exterior","Cabinet"],                jobs:"267+", rate:"Rs. 1,400/hr", response:"2 hours" },
];

const STEPS = [
  { num:1, title:"Send a Request",    desc:"Describe your project and what you need. Be detailed for the best matches.",          stripe:"#E0E7FF" },
  { num:2, title:"Negotiate Pricing", desc:"Chat with workers and agree on fair pricing that works for both parties.",             stripe:"#FEF3C7" },
  { num:3, title:"Worker Accepts",    desc:"Worker commits to your timeline and agreed scope of work.",                           stripe:"#D1FAE5" },
  { num:4, title:"Pay in Escrow",     desc:"Your payment is held securely in escrow until you're satisfied with the work.",       stripe:"#DBEAFE" },
  { num:5, title:"Work Completed",    desc:"Worker completes the job to your satisfaction. Review the work before approving.",    stripe:"#FCE7F3" },
  { num:6, title:"Escrow Released",   desc:"Once you approve the work, payment is released to the worker automatically.",        stripe:"#D5F5E3" },
];

const REVIEWS = [
  { name:"Jennifer Wilson", service:"Electrical Help",  img:"https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop",  text:"The electrician arrived exactly on time and knew exactly what to do. Professional, clean, and efficient. 100% would hire again!", date:"March 15, 2026" },
  { name:"Mark Stevens",    service:"Plumbing",         img:"https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop", text:"Had an emergency leak late at night. He was prompt, communicative, and fixed it faster than I expected. Highly recommend!",    date:"March 10, 2026" },
  { name:"Rebecca Moore",   service:"General Mounting", img:"https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop", text:"Patient and willing to help figure it out with us. Great communication throughout the whole process. Thank you!",              date:"March 5, 2026"  },
];

const GUARANTEES = [
  { title:"Background Checked", desc:"All professionals undergo thorough background verification before joining our platform.", icon:<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
  { title:"24/7 Support",       desc:"Our support team is available around the clock to help with any questions or issues.",   icon:<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { title:"Quality Guaranteed", desc:"Not satisfied? We'll make it right or refund your money — no questions asked.",         icon:<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="1.8"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg> },
  { title:"Secure Payments",    desc:"Your payments are protected with bank-grade escrow protection on every job.",           icon:<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
];

/* ─── Header ─────────────────────────────────────────────────────────────────*/
function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const links = [
    { href:"#categories",   label:"Find Services" },
    { href:"#workers",      label:"For Workers"   },
    { href:"#how-it-works", label:"How It Works"  },
    { href:"#reviews",      label:"Reviews"       },
  ];

  const scrollTo = (href) => {
    document.querySelector(href)?.scrollIntoView({ behavior:"smooth", block:"start" });
    setMenuOpen(false);
  };

  return (
    <header style={{ position:"sticky", top:0, zIndex:100, background:"rgba(255,255,255,0.94)", backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", borderBottom:"1px solid var(--border)" }}>
      <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 clamp(16px,4vw,32px)", display:"flex", alignItems:"center", justifyContent:"space-between", height:66 }}>

        {/* Logo */}
        <button onClick={() => navigate("/")} style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", alignItems:"center" }}>
          <img src={logo} alt="Kaam-ly" style={{ height:40, objectFit:"contain" }} />
        </button>

        {/* Desktop nav */}
        <nav className="desktop-nav" style={{ display:"flex", gap:4 }}>
          {links.map(l => (
            <button key={l.href} onClick={() => scrollTo(l.href)} className="btn-ghost">{l.label}</button>
          ))}
        </nav>

        {/* Desktop buttons */}
        <div className="desktop-btns" style={{ display:"flex", gap:10, alignItems:"center" }}>
          <button className="btn-ghost" onClick={() => navigate("/login")}>Sign In</button>
          <button className="btn-primary" onClick={() => navigate("/register-worker")}>Become a Pro</button>
        </div>

        {/* Hamburger */}
        <button className="hamburger-btn"
          style={{ display:"none", alignItems:"center", justifyContent:"center", background:"none", border:"none", cursor:"pointer", padding:6 }}
          onClick={() => setMenuOpen(o => !o)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth="2">
            {menuOpen
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ background:"white", borderTop:"1px solid var(--border)", padding:"12px 20px 20px" }}>
          {links.map(l => (
            <button key={l.href} onClick={() => scrollTo(l.href)}
              style={{ display:"block", width:"100%", textAlign:"left", padding:"12px 0", background:"none", border:"none", borderBottom:"1px solid var(--border)", color:"var(--slate)", fontWeight:500, cursor:"pointer", fontFamily:"Inter", fontSize:14 }}>
              {l.label}
            </button>
          ))}
          <div style={{ display:"flex", gap:10, marginTop:16 }}>
            <button className="btn-outline" style={{ flex:1 }} onClick={() => { navigate("/login"); setMenuOpen(false); }}>Sign In</button>
            <button className="btn-primary" style={{ flex:1 }} onClick={() => { navigate("/register-worker"); setMenuOpen(false); }}>Become a Pro</button>
          </div>
        </div>
      )}
    </header>
  );
}

/* ─── Hero ───────────────────────────────────────────────────────────────────*/
function Hero() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const handleSearch = () => navigate("/login");

  return (
    <section style={{ background:"linear-gradient(135deg,#FFFBF5 0%,#FFF7ED 45%,#FFFFFF 100%)", padding:"clamp(56px,10vw,100px) 0 clamp(56px,8vw,88px)", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:-80, right:-80, width:480, height:480, background:"radial-gradient(circle,rgba(246,173,86,.13) 0%,transparent 70%)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", bottom:-60, left:-60, width:300, height:300, background:"radial-gradient(circle,rgba(246,173,86,.07) 0%,transparent 70%)", pointerEvents:"none" }} />

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 clamp(16px,4vw,32px)" }}>
        <div className="hero-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"clamp(32px,6vw,72px)", alignItems:"center" }}>

          <div>

            <h1 className="fade-up-2" style={{ fontFamily:"Inter", fontSize:"clamp(30px,5vw,56px)", fontWeight:800, lineHeight:1.1, color:"var(--navy)", letterSpacing:"-0.02em" }}>
              Find trusted local{" "}
              <em style={{ fontStyle:"italic", color:"var(--orange)" }}>professionals</em>{" "}
              near you
            </h1>

            <p className="fade-up-2" style={{ marginTop:20, fontSize:"clamp(14px,2vw,17px)", color:"var(--slate)", lineHeight:1.7, maxWidth:480, letterSpacing:"-0.01em" }}>
              Connect with verified, background-checked service providers. From home repairs to professional services — get quality work done fast.
            </p>

            <div className="search-bar fade-up-3" style={{ marginTop:34, maxWidth:520 }}>
              <div style={{ position:"relative", flex:1, display:"flex", alignItems:"center" }}>
                <svg style={{ position:"absolute", left:14 }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#94A3B8" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input type="text" placeholder="What service do you need?"
                  value={query} onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && handleSearch()} />
              </div>
              <button className="btn-primary" onClick={handleSearch}>Search</button>
            </div>

            <div className="hero-badges fade-up-3" style={{ display:"flex", gap:"clamp(14px,3vw,28px)", marginTop:26, flexWrap:"wrap" }}>
              {[
                { icon:<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, text:"Skill Checked" },
                { icon:<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>, text:"Instant Booking" },
                { icon:<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>, text:"Secure Payments" },
              ].map((s,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:7 }}>
                  {s.icon}
                  <span style={{ fontSize:13, color:"var(--slate)", fontWeight:500, letterSpacing:"-0.01em" }}>{s.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right image */}
          <div className="hero-img-col float-anim" style={{ position:"relative" }}>
            <img
              src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=640&h=480&fit=crop"
              alt="Professional at work"
              style={{ width:"100%", borderRadius:22, boxShadow:"0 28px 72px rgba(0,0,0,.15)", objectFit:"cover", aspectRatio:"4/3", display:"block" }}
            />
            <div className="stat-pill" style={{ position:"absolute", bottom:-18, left:-18, animationDelay:"0.1s" }}>
              <div style={{ width:38, height:38, background:"var(--orange-light)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="2.2"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <div style={{ fontSize:10, color:"var(--light-slate)", fontWeight:600, letterSpacing:"0.04em", textTransform:"uppercase" }}>Availability</div>
                <div style={{ fontSize:15, fontWeight:800, color:"var(--navy)", letterSpacing:"-0.03em" }}>24/7 Service</div>
              </div>
            </div>
            <div className="stat-pill" style={{ position:"absolute", top:20, right:-16, animationDelay:"0.3s" }}>
              <div style={{ width:38, height:38, background:"#D1FAE5", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Sparkles size={17} />
              </div>
              <div>
                <div style={{ fontSize:10, color:"var(--light-slate)", fontWeight:600, letterSpacing:"0.04em", textTransform:"uppercase" }}>Pricing</div>
                <div style={{ fontSize:15, fontWeight:800, color:"var(--navy)", letterSpacing:"-0.03em" }}>Free to Start</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Categories with subcategory dropdown ───────────────────────────────────*/
function Categories() {
  const navigate = useNavigate();
  const ref = useScrollReveal();
  const [activeCat, setActiveCat] = useState(null);
  const [activeSub, setActiveSub] = useState(null);

  const handleCategoryClick = (cat) => {
    if (activeCat?.id === cat.id) {
      setActiveCat(null);
      setActiveSub(null);
    } else {
      setActiveCat(cat);
      setActiveSub(cat.subcategories[0]);
    }
  };

  const handleGo = () => navigate("/login");

  return (
    <section id="categories" style={{ padding:"clamp(56px,8vw,88px) 0", background:"var(--white)" }}>
      <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 clamp(16px,4vw,32px)" }}>

        <div ref={ref} style={{ textAlign:"center", marginBottom:52 }}>
          <h2 style={{ fontSize:"clamp(24px,4vw,40px)", fontWeight:800, color:"var(--navy)", letterSpacing:"-0.02em", fontFamily:"Inter, sans-serif" }}>
            Browse by <span style={{ color:"var(--orange)" }}>Category</span>
          </h2>
          <p style={{ marginTop:12, color:"var(--slate)", fontSize:"clamp(14px,2vw,16px)", maxWidth:520, margin:"12px auto 0", letterSpacing:"-0.01em", fontFamily:"Inter, sans-serif" }}>
            Tap a category to explore services, then pick a subcategory to find the right professional
          </p>
        </div>

        {/* Grid */}
        <div className="cats-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
          {CATEGORY_DATA.map(cat => (
            <button
              key={cat.id}
              className={`cat-card ${activeCat?.id === cat.id ? "active" : ""}`}
              onClick={() => handleCategoryClick(cat)}
            >
              <div className="cat-icon">
                <img src={cat.image} alt={cat.label} className="cat-img" />
              </div>
              <span className="cat-name">{cat.label}</span>
              {/* chevron */}
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24"
                stroke={activeCat?.id === cat.id ? "var(--orange)" : "var(--light-slate)"} strokeWidth="2.5"
                style={{ transition:"transform .22s", transform: activeCat?.id === cat.id ? "rotate(180deg)" : "rotate(0deg)", flexShrink:0 }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          ))}
        </div>

        {/* Subcategory dropdown */}
        {activeCat && (
          <div className="subcat-wrap">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:10 }}>
              <span style={{ fontSize:14, fontWeight:700, color:"var(--navy)", letterSpacing:"-0.02em" }}>
                {activeCat.label} — choose a service
              </span>
              <button className="btn-primary" style={{ fontSize:13, padding:"8px 18px" }} onClick={handleGo}>
                Browse {activeSub} →
              </button>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {activeCat.subcategories.map(sub => (
                <button
                  key={sub}
                  className={`subcat-pill ${activeSub === sub ? "active" : ""}`}
                  onClick={() => setActiveSub(sub)}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── Workers ────────────────────────────────────────────────────────────────*/
function WorkerCard({ w }) {
  const ref = useScrollReveal();
  const navigate = useNavigate();
  return (
    <div ref={ref} className="worker-card">
      <div style={{ padding:"clamp(16px,3vw,24px)" }}>
        <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
          <img src={w.img} alt={w.name} style={{ width:56, height:56, borderRadius:"50%", objectFit:"cover", border:"2.5px solid var(--orange-light)", flexShrink:0 }} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:4 }}>
              <span style={{ fontSize:"clamp(13px,2vw,15px)", fontWeight:700, color:"var(--navy)", letterSpacing:"-0.02em", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{w.name}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#F6AD56" strokeWidth="2" style={{ flexShrink:0 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div style={{ fontSize:12, color:"var(--orange)", fontWeight:600, marginTop:2 }}>{w.service}</div>
            <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:4 }}>
              <StarIcon size={12}/>
              <span style={{ fontWeight:700, fontSize:12 }}>{w.rating}</span>
              <span style={{ color:"var(--light-slate)", fontSize:11 }}>({w.reviews} reviews)</span>
            </div>
          </div>
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:14 }}>
          {w.skills.map(s => (
            <span key={s} style={{ fontSize:11, fontWeight:500, padding:"3px 9px", borderRadius:100, background:"var(--bg)", color:"var(--slate)", border:"1px solid var(--border)" }}>{s}</span>
          ))}
        </div>
        <div style={{ marginTop:14, display:"flex", flexDirection:"column", gap:7 }}>
          {[["Completed Jobs",w.jobs],["Hourly Rate",w.rate],["Response Time",w.response]].map(([label,val]) => (
            <div key={label} style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:12, color:"var(--light-slate)", fontWeight:500 }}>{label}</span>
              <span style={{ fontSize:12, fontWeight:700, color:label==="Hourly Rate"?"var(--orange)":"var(--navy)" }}>{val}</span>
            </div>
          ))}
        </div>
        <button className="btn-primary" style={{ width:"100%", marginTop:16, padding:"11px 0", fontSize:13 }}
          onClick={() => navigate("/login")}>Hire Now</button>
      </div>
    </div>
  );
}

function Workers() {
  const ref = useScrollReveal();
  return (
    <section id="workers" style={{ padding:"clamp(56px,8vw,88px) 0", background:"var(--bg)" }}>
      <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 clamp(16px,4vw,32px)" }}>
        <div ref={ref} style={{ textAlign:"center", marginBottom:52 }}>
          <h2 style={{ fontFamily:"Inter, sans-serif", fontSize:"clamp(24px,4vw,40px)", fontWeight:800, color:"var(--navy)", letterSpacing:"-0.02em" }}>
            Featured <span style={{ color:"var(--orange)" }}>Professionals</span>
          </h2>
          <p style={{ marginTop:12, color:"var(--slate)", fontSize:"clamp(14px,2vw,16px)", maxWidth:520, margin:"12px auto 0", letterSpacing:"-0.01em" }}>
            Highly-rated service providers ready to help with your next project
          </p>
        </div>
        <div className="workers-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20 }}>
          {WORKERS.map((w,i) => <WorkerCard key={i} w={w} />)}
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works ───────────────────────────────────────────────────────────*/
function HowItWorks() {
  const ref = useScrollReveal();
  return (
    <section id="how-it-works" style={{ padding:"clamp(56px,8vw,88px) 0", background:"var(--white)" }}>
      <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 clamp(16px,4vw,32px)" }}>
        <div ref={ref} style={{ textAlign:"center", marginBottom:52 }}>
          <h2 style={{ fontFamily:"Inter, sans-serif", fontSize:"clamp(24px,4vw,40px)", fontWeight:800, color:"var(--navy)", letterSpacing:"-0.02em" }}>
            How <span style={{ color:"var(--orange)" }}>Kaam-ly</span> Works
          </h2>
          <p style={{ marginTop:12, color:"var(--slate)", fontSize:"clamp(14px,2vw,16px)", maxWidth:520, margin:"12px auto 0", letterSpacing:"-0.01em" }}>
            Simple, transparent process to get your projects done
          </p>
        </div>
        <div className="steps-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:18 }}>
          {STEPS.map(s => {
            const r = useScrollReveal();
            return (
              <div key={s.num} ref={r} className="step-card">
                <div style={{ position:"absolute", top:0, left:0, right:0, height:4, background:s.stripe, borderRadius:"18px 18px 0 0" }} />
                <div style={{ width:44, height:44, background:"var(--orange)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"var(--font-display)", fontSize:18, fontWeight:800, color:"white", marginBottom:16, boxShadow:"0 4px 14px rgba(246,173,86,.38)" }}>{s.num}</div>
                <div style={{ fontSize:"clamp(13px,2vw,15px)", fontWeight:700, color:"var(--navy)", marginBottom:8, letterSpacing:"-0.02em" }}>{s.title}</div>
                <div style={{ fontSize:"clamp(12px,1.5vw,13px)", color:"var(--slate)", lineHeight:1.65, letterSpacing:"-0.01em" }}>{s.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Reviews ────────────────────────────────────────────────────────────────*/
function Reviews() {
  const ref = useScrollReveal();
  return (
    <section id="reviews" style={{ padding:"clamp(56px,8vw,88px) 0", background:"var(--bg)" }}>
      <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 clamp(16px,4vw,32px)" }}>
        <div ref={ref} style={{ textAlign:"center", marginBottom:52 }}>
          <h2 style={{ fontFamily:"Inter, sans-serif", fontSize:"clamp(24px,4vw,40px)", fontWeight:800, color:"var(--navy)", letterSpacing:"-0.02em" }}>
            What Our <span style={{ color:"var(--orange)" }}>Customers Say</span>
          </h2>
          <p style={{ marginTop:12, color:"var(--slate)", fontSize:"clamp(14px,2vw,16px)", maxWidth:520, margin:"12px auto 0", letterSpacing:"-0.01em" }}>
            Join thousands of satisfied customers who found trusted professionals
          </p>
        </div>
        <div className="reviews-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20 }}>
          {REVIEWS.map((r,i) => {
            const r2 = useScrollReveal();
            return (
              <div key={i} ref={r2} className="review-card">
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                  <img src={r.img} alt={r.name} style={{ width:44, height:44, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:"var(--navy)", letterSpacing:"-0.02em" }}>{r.name}</div>
                    <div style={{ fontSize:11, color:"var(--light-slate)", marginTop:1, fontWeight:500 }}>{r.service}</div>
                  </div>
                </div>
                <Stars />
                <p style={{ fontSize:"clamp(12px,1.6vw,14px)", color:"var(--slate)", lineHeight:1.7, margin:"10px 0 12px", letterSpacing:"-0.01em" }}>
                  <span style={{ fontFamily:"var(--font-display)", fontSize:42, lineHeight:1, color:"var(--orange-light)", float:"left", marginRight:4, marginTop:-4 }}>"</span>
                  {r.text}
                </p>
                <p style={{ fontSize:11, color:"var(--light-slate)", fontWeight:500 }}>{r.date}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Guarantee ──────────────────────────────────────────────────────────────*/
function Guarantee() {
  const ref = useScrollReveal();
  return (
    <section style={{ padding:"clamp(56px,8vw,88px) 0", background:"var(--white)" }}>
      <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 clamp(16px,4vw,32px)" }}>
        <div ref={ref} style={{ textAlign:"center", marginBottom:52 }}>
          <h2 style={{ fontFamily:"Inter, sans-serif", fontSize:"clamp(24px,4vw,40px)", fontWeight:800, color:"var(--navy)", letterSpacing:"-0.02em" }}>
            Our <span style={{ color:"var(--orange)" }}>Guarantee</span>
          </h2>
          <p style={{ marginTop:12, color:"var(--slate)", fontSize:"clamp(14px,2vw,16px)", maxWidth:520, margin:"12px auto 0", letterSpacing:"-0.01em" }}>
            We stand behind every booking with our comprehensive guarantees
          </p>
        </div>
        <div className="guarantee-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:20 }}>
          {GUARANTEES.map((g,i) => {
            const r = useScrollReveal();
            return (
              <div key={i} ref={r} className="guarantee-card">
                <div className="g-icon-wrap" style={{ width:62, height:62, background:"var(--orange-light)", borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 18px", transition:"background .22s" }}>
                  {g.icon}
                </div>
                <div style={{ fontSize:"clamp(13px,2vw,15px)", fontWeight:700, color:"var(--navy)", marginBottom:8, letterSpacing:"-0.02em" }}>{g.title}</div>
                <div style={{ fontSize:"clamp(12px,1.5vw,13px)", color:"var(--slate)", lineHeight:1.65, letterSpacing:"-0.01em" }}>{g.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA ────────────────────────────────────────────────────────────────────*/
function CTABanner() {
  const navigate = useNavigate();
  const ref = useScrollReveal();
  return (
    <section style={{ padding:"clamp(48px,8vw,80px) 0", background:"var(--navy)" }}>
      <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 clamp(16px,4vw,32px)", textAlign:"center" }}>
        <div ref={ref}>
          <div style={{ fontFamily:"Inter, sans-serif", display:"inline-flex", alignItems:"center", gap:6, background:"rgba(246,173,86,.15)", color:"var(--orange)", fontSize:11, fontWeight:700, padding:"5px 12px", borderRadius:100, letterSpacing:"0.05em", textTransform:"uppercase", marginBottom:20, border:"1px solid rgba(246,173,86,.25)" }}>
            <StarIcon size={11}/> Join our growing community
          </div>
          <h2 style={{ fontFamily:"var(--font-display)", fontSize:"clamp(24px,4vw,44px)", fontWeight:800, color:"white", letterSpacing:"-0.02em", marginBottom:16 }}>
            Ready to get started?
          </h2>
          <p style={{ color:"#94A3B8", fontSize:"clamp(14px,2vw,17px)", maxWidth:440, margin:"0 auto 36px", lineHeight:1.7, letterSpacing:"-0.01em" }}>
            Join thousands of customers and professionals already using Kaam-ly today.
          </p>
          <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap" }}>
            <button className="btn-primary" style={{ fontSize:15, padding:"13px 28px" }} onClick={() => navigate("/login")}>
              Find a Professional
            </button>
            <button onClick={() => navigate("/register-worker")}
              style={{ background:"rgba(255,255,255,.08)", color:"white", border:"1.5px solid rgba(255,255,255,.18)", cursor:"pointer", fontSize:15, fontWeight:600, padding:"13px 28px", borderRadius:10, fontFamily:"var(--font)", letterSpacing:"-0.01em", transition:"background .2s, transform .15s" }}
              onMouseOver={e => { e.currentTarget.style.background="rgba(255,255,255,.14)"; e.currentTarget.style.transform="translateY(-1px)"; }}
              onMouseOut={e => { e.currentTarget.style.background="rgba(255,255,255,.08)"; e.currentTarget.style.transform="translateY(0)"; }}>
              Become a Pro
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ─────────────────────────────────────────────────────────────────*/
function Footer() {
  const navigate = useNavigate();

  const socialIcons = [
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="#94A3B8" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>,
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/></svg>,
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>,
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>,
  ];

  const lStyle = { display:"block", width:"100%", textAlign:"left", fontSize:13, color:"#94A3B8", background:"none", border:"none", cursor:"pointer", padding:"0 0 10px", fontFamily:"var(--font)", letterSpacing:"-0.01em", transition:"color .2s" };

  return (
    <footer style={{ background:"var(--navy)", color:"#CBD5E1", padding:"clamp(48px,8vw,72px) 0 32px" }}>
      <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 clamp(16px,4vw,32px)" }}>
        <div className="footer-grid" style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1.5fr", gap:"clamp(20px,4vw,52px)", marginBottom:48 }}>

          <div>
            <button onClick={() => navigate("/")} style={{ background:"none", border:"none", cursor:"pointer", padding:0, marginBottom:16, display:"block" }}>
              <img src={logo} alt="Kaam-ly" style={{ height:38, objectFit:"contain", filter:"brightness(0) invert(1)" }} />
            </button>
            <p style={{ fontSize:13, lineHeight:1.75, color:"#94A3B8", marginBottom:20, letterSpacing:"-0.01em" }}>
              Connecting you with trusted local service professionals for all your home and business needs.
            </p>
            <div style={{ display:"flex", gap:10 }}>
              {socialIcons.map((icon,i) => <div key={i} className="social-btn">{icon}</div>)}
            </div>
          </div>

          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"white", marginBottom:16 }}>Quick Links</div>
            {[
              { label:"Find Services",  fn:() => navigate("/login") },
              { label:"For Workers",    fn:() => navigate("/register-worker") },
              { label:"How It Works",   fn:() => document.querySelector("#how-it-works")?.scrollIntoView({ behavior:"smooth" }) },
              { label:"Reviews",        fn:() => document.querySelector("#reviews")?.scrollIntoView({ behavior:"smooth" }) },
              { label:"Become a Pro",   fn:() => navigate("/register-worker") },
            ].map(l => (
              <button key={l.label} onClick={l.fn} style={lStyle}
                onMouseOver={e => e.currentTarget.style.color="var(--orange)"}
                onMouseOut={e => e.currentTarget.style.color="#94A3B8"}>{l.label}</button>
            ))}
          </div>

          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"white", marginBottom:16 }}>Support</div>
            {[
              { label:"Help Center",      fn:() => navigate("/helpSection") },
              { label:"Safety Center",    fn:() => {} },
              { label:"Terms of Service", fn:() => {} },
              { label:"Privacy Policy",   fn:() => {} },
              { label:"Cookie Settings",  fn:() => {} },
            ].map(l => (
              <button key={l.label} onClick={l.fn} style={lStyle}
                onMouseOver={e => e.currentTarget.style.color="var(--orange)"}
                onMouseOut={e => e.currentTarget.style.color="#94A3B8"}>{l.label}</button>
            ))}
          </div>

          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"white", marginBottom:16 }}>Contact Us</div>
            {[
              { icon:<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>, text:"support@kaam-ly.com" },
              { icon:<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.08 6.08l1.95-1.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>, text:"1-800-KAAMLY" },
              { icon:<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>, text:"Kathmandu, Nepal 44600" },
            ].map((item,i) => (
              <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:12, fontSize:13, color:"#94A3B8", letterSpacing:"-0.01em" }}>
                <span style={{ flexShrink:0, marginTop:1 }}>{item.icon}</span>{item.text}
              </div>
            ))}
          </div>
        </div>

        <hr style={{ border:"none", borderTop:"1px solid #1E293B", marginBottom:24 }} />
        <p style={{ textAlign:"center", fontSize:12, color:"#475569", letterSpacing:"-0.01em" }}>
          © 2026 Kaam-ly. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

/* ─── Root ───────────────────────────────────────────────────────────────────*/
export default function LandingPage() {
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
      <CTABanner />
      <Footer />
    </>
  );
}