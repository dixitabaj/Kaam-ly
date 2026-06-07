import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import {
  getWorkerByCategory,
  getWorkerBySubcategory,
  getReviewsById,
  getTopRated,
  getEmergencyWorkers,
} from '../../api/api';

import logo        from '../../images/logo.png';
import assemblyImg from '../../images/assembly.png';
import repairImg   from '../../images/plumbing.png';
import movingImg   from '../../images/moving.png';
import cleaningImg from '../../images/cleaning.png';
import outdoorImg  from '../../images/gardening.png';
import paintingImg from '../../images/painting.png';
import trendingImg from '../../images/trending.png';
import mountingImg from '../../images/repair.png';
import reviewImg   from '../../images/reviews.png';
import ChatWidget from '../../components/HelpSection/HelpSection';

/* ─────────────────────────────────────────
   Global styles — all class names kept
   identical to homePage.css so the cards,
   categories, hero look exactly the same.
───────────────────────────────────────── */
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

    :root {
      --orange: #F6AD56;
      --orange-dark: #E59D40;
      --orange-light: #FEF3C7;
      --navy: #0F172A;
      --slate: #475569;
      --light-slate: #94A3B8;
      --border: #E2E8F0;
      --font: 'Inter', sans-serif;
    }

    html { scroll-behavior: smooth; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
                   'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      background-color: #F8FAFC;
      color: #0f172a;
    }

    /* ── shell ── */
    .lp-app-container { min-height: 100vh; background: #F8FAFC; }

    /* ── navbar ── */
    .lp-navbar {
      position: sticky; top: 0; z-index: 100;
      background: rgba(255,255,255,0.97);
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border);
      padding: 10px 0 0 0;
    }
    .lp-navbar-inner {
      max-width: 1200px; margin: 0 auto;
      padding: 2px clamp(16px,4vw,48px);
      display: flex; align-items: center; height: 66px; position: relative;
    }
    .lp-logo-btn { background: none; border: none; cursor: pointer; padding: 0; flex-shrink: 0; }
    .lp-logo-btn img { height: 60px; object-fit: contain; }
    .lp-desktop-nav {
      display: flex; gap: 2px;
      position: absolute; left: 50%; transform: translateX(-50%);
      
    }
    .lp-nav-link {
      background: none; border: none; cursor: pointer; color: var(--slate);
      font-size: 15px; font-weight: 500; padding: 8px 16px; border-radius: 8px;
      font-family: var(--font); transition: color .2s, background .2s;
      letter-spacing: -0.01em; white-space: nowrap;
    }
    .lp-nav-link:hover { color: var(--navy); background: rgba(0,0,0,.04); }
    .lp-desktop-btns {
      display: flex; gap: 8px; align-items: center;
      margin-left: auto; flex-shrink: 0;
    }
    .lp-btn-primary {
      background: var(--orange); color: #fff; border: none; cursor: pointer;
      font-size: 14px; font-weight: 600; padding: 11px 22px; border-radius: 10px;
      font-family: var(--font); letter-spacing: -0.01em;
      transition: background .2s, transform .15s, box-shadow .2s;
      box-shadow: 0 2px 10px rgba(246,173,86,.38);
    }
    .lp-btn-primary:hover {
      background: var(--orange-dark); transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(246,173,86,.42);
    }
    .lp-btn-outline {
      background: transparent; color: var(--navy);
      border: 1.5px solid var(--border); cursor: pointer;
      font-size: 14px; font-weight: 600; padding: 11px 22px; border-radius: 10px;
      font-family: var(--font); transition: border-color .2s, background .2s;
    }
    .lp-btn-outline:hover { border-color: var(--orange); background: var(--orange-light); }
    .lp-hamburger-btn {
      display: none; align-items: center; justify-content: center;
      background: none; border: none; cursor: pointer; padding: 6px; margin-left: auto;
    }
    .lp-mobile-menu {
      background: white; border-top: 1px solid var(--border); padding: 12px 20px 20px;
    }
    .lp-mobile-menu-link {
      display: block; width: 100%; text-align: left; padding: 12px 0;
      background: none; border: none; border-bottom: 1px solid var(--border);
      color: var(--slate); font-weight: 500; cursor: pointer;
      font-family: var(--font); font-size: 14px;
    }
    .lp-mobile-menu-btns { display: flex; gap: 10px; margin-top: 16px; }

    /* ── HERO — identical to homePage.css ── */
    .hero-section { background: white; padding: 4rem 2rem 3rem; }
    .hero-content {
      max-width: 56rem; margin: 0 auto;
      text-align: center; margin-bottom: 20px;
    }
    .hero-title {
      margin-top: 100px; font-size: 3rem; font-weight: bold;
      color: #000000; margin-bottom: 1.5rem; line-height: 1.2;
      margin-bottom: 54px;
    }

    /* mimics SearchBar component */
    .lp-search-bar {
      display: flex; align-items: center; background: white;
      border: 1.5px solid var(--border); border-radius: 14px;
      padding: 4px 16px; max-width: 640px; margin: 0 auto;
      box-shadow: 0 2px 12px rgba(0,0,0,.07);
      transition: border-color .2s, box-shadow .2s;
    }
    .lp-search-bar:focus-within {
      border-color: var(--orange); box-shadow: 0 4px 20px rgba(246,173,86,.18);
    }
    .lp-search-bar input {
      flex: 1; border: none; outline: none; padding: 14px 10px;
      font-size: 15px; font-family: var(--font); color: #0f172a; background: transparent;
    }
    .lp-search-bar input::placeholder { color: var(--light-slate); }
    .lp-camera-btn {
      background: none; border: none; cursor: pointer; padding: 8px;
      display: flex; align-items: center; color: var(--light-slate);
      transition: color .2s; flex-shrink: 0;
    }
    .lp-camera-btn:hover { color: var(--orange); }

    /* ── CATEGORIES — same as homePage.css ── */
    .categories-icons-section {
      background: white; padding: 2rem 2rem 0;
      border-bottom: 1px solid var(--border);
    }
    .categories-icons-content {
      max-width: 1280px; margin: 0 auto;
      display: flex; justify-content: space-around;
      align-items: center; gap: 2rem; flex-wrap: wrap;
    }
    .category-icon-item {
      display: flex; flex-direction: column; align-items: center;
      gap: 0.75rem; cursor: pointer; transition: all 0.2s;
      padding: 5px; width: 120px; margin-bottom: 20px;
    }
    .category-icon-item:hover { box-shadow: 0 8px 30px -15px #f6ad56; border-radius: 20px; }
    .icon-label { font-size: 0.875rem; color: #475569; font-weight: 600; text-align: center; margin-top: -15px; margin-bottom: 20px; }
    .icon-label.active { position: relative; color: #f6ad56; }
    .icon-label.active::after {
      content: ''; position: absolute; bottom: -8px; left: 25%;
      width: 50%; height: 3px; background: #f6ad56; border-radius: 2px;
    }
    .icon-circle { width: 70px; height: 70px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .category-img { width: 60px; height: 60px; object-fit: contain; }

    /* ── SUBCATEGORIES ── */
    .subcategories-section { border-top: 1px solid #a9abab; padding: 20px 0 10px 0; }
    .subcategories-content {
      width: 1200px; margin: 0 auto; padding: 0 20px;
      display: flex; flex-wrap: wrap; gap: 20px; justify-content: center;
    }
    .subcategory-item {
      padding: 10px 30px; background-color: white; border: 1px solid #e1ab71;
      border-radius: 20px; font-size: 18px; font-weight: 550; color: #444444;
      cursor: pointer; transition: all 0.2s ease; white-space: nowrap;
    }
    .subcategory-item:hover { background-color: #fdebd9; border-color: #e1ab71; }
    .subcategory-item.active { background-color: rgb(255,253,242); border-color: #e1ab71; color: rgb(54,54,54); }

    /* ── WORKERS SECTION ── */
    .workers-section { padding: 3rem 2rem; background: #FFFDF2; }
    .workers-content { max-width: 1280px; margin: 0 auto; }
    .section-title { font-size: 1.75rem; font-weight: 700; color: #0f172a; margin-bottom: 1.5rem; }
    .workers-horizontal-scroll {
      display: flex; gap: 20px; width: 100%;
      overflow-x: auto; padding-bottom: 10px;
      scrollbar-width: thin; margin-bottom: 50px;
    }
    .no-workers-message { color: var(--slate); font-size: 14px; }
    .error-message { color: #e53e3e; font-size: 14px; }

    /* ── WORKER CARD — compact version ── */
    .worker-card-horizontal-scroll {
      background: white; border-radius: 14px; padding: 20px;
      max-width: 340px; min-width: 340px; border: 1px solid #edf2f7;
      display: flex; flex-direction: column; gap: 12px;
      transition: transform .2s, box-shadow .2s;
    }
    .worker-card-horizontal-scroll:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,0,0,.08);
    }
    .worker-header { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 8px; }
    .profile-photo-home {
      width: 56px; height: 56px; border-radius: 50%;
      background: rgb(246,173,86); color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; font-weight: 600; flex-shrink: 0;
    }
    .profile-photo-home img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
    .profile-initials { color: white; font-size: 18px; font-weight: 600; text-transform: uppercase; }
    .worker-info-compact { flex: 1; min-width: 0; }
    .worker-name { font-size: 18px; font-weight: 700; color: #000000; margin: 0 0 4px 0; line-height: 1.3; }
    .rating-row { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
    .star-icon { color: #FFB800; font-size: 16px; }
    .rating-value { font-size: 15px; font-weight: 600; color: #000000; margin-left: 2px; }
    .reviews-count { font-size: 13px; color: #5e5e5e; font-weight: 400; margin-left: 4px; }
    .elite-badge {
      background: rgb(246,173,86); color: white; padding: 3px 10px; border-radius: 16px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase;
      display: inline-block;
    }
    .worker-stats-compact { 
      display: flex; flex-direction: column; gap: 6px; 
      padding: 12px; background: #F8FAFC; border-radius: 10px;
      margin-bottom: 8px;
    }
    .stat-item-compact { 
      display: flex; justify-content: space-between; align-items: center;
      font-size: 13px; 
    }
    .stat-label-compact { color: #64748b; font-weight: 500; }
    .stat-value-compact { color: #0f172a; font-weight: 600; }
    .select-btn {
      width: 100%; padding: 12px 18px; background: rgb(246,173,86); color: white;
      border: none; border-radius: 8px; font-size: 14px; font-weight: 600;
      cursor: pointer; transition: background .2s;
    }
    .select-btn:hover { background: var(--orange-dark); }

    /* ── BELOW-FOLD SECTIONS ── */
    .lp-how-section    { padding: clamp(56px,8vw,88px) 0; background: #FFFDF2; }
    .lp-guarantee-section { padding: clamp(56px,8vw,88px) 0; background: #FFFDF2; }
    .lp-section-inner  { max-width: 1200px; margin: 0 auto; padding: 0 clamp(16px,4vw,48px); }
    .lp-section-heading {
      font-family: var(--font); font-size: clamp(24px,4vw,40px); font-weight: 800;
      color: var(--navy); letter-spacing: -0.02em; text-align: center; margin-bottom: 8px;
    }
    .lp-section-sub {
      color: var(--slate); font-size: clamp(14px,2vw,16px);
      max-width: 520px; margin: 0 auto 52px; text-align: center;
    }
    .lp-steps-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 18px; }
    .lp-step-card {
      padding: 28px; border-radius: 18px; border: 1.5px solid var(--border); background: white;
      transition: transform .22s, box-shadow .22s; position: relative; overflow: hidden;
    }
    .lp-step-card:hover { transform: translateY(-4px); box-shadow: 0 14px 40px rgba(0,0,0,.09); }
    .lp-step-num {
      width: 44px; height: 44px; background: var(--orange); border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; font-weight: 800; color: white; margin-bottom: 16px;
      box-shadow: 0 4px 14px rgba(246,173,86,.38);
    }
    .lp-step-title { font-size: 15px; font-weight: 700; color: var(--navy); margin-bottom: 8px; }
    .lp-step-desc  { font-size: 13px; color: var(--slate); line-height: 1.65; }
    .lp-guarantee-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 20px; }
    .lp-guarantee-card {
      text-align: center; padding: 30px 20px; border-radius: 18px;
      background: #F8FAFC; border: 1.5px solid var(--border); transition: all .22s;
    }
    .lp-guarantee-card:hover {
      background: white; transform: translateY(-4px);
      box-shadow: 0 14px 40px rgba(0,0,0,.09); border-color: var(--orange);
    }
    .lp-guarantee-title { font-size: 15px; font-weight: 700; color: var(--navy); margin-bottom: 8px; }
    .lp-guarantee-desc  { font-size: 13px; color: var(--slate); line-height: 1.65; }

  
    /* ── FOOTER ── */
    .lp-footer { background: var(--navy); color: #CBD5E1; padding: clamp(48px,8vw,72px) 0 32px; }
    .lp-footer-inner { max-width: 1200px; margin: 0 auto; padding: 0 clamp(16px,4vw,48px); }
    .lp-footer-grid {
      display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr;
      gap: clamp(20px,4vw,52px); margin-bottom: 48px;
    }
    .lp-footer-col-title { font-size: 13px; font-weight: 700; color: white; margin-bottom: 16px; }
    .lp-footer-link {
      display: block; width: 100%; text-align: left; font-size: 13px;
      color: #94A3B8; background: none; border: none; cursor: pointer;
      padding: 0 0 10px; font-family: var(--font); transition: color .2s;
    }
    .lp-footer-link:hover { color: var(--orange); }
    .lp-footer-hr   { border: none; border-top: 1px solid #1E293B; margin-bottom: 24px; }
    .lp-footer-copy { text-align: center; font-size: 12px; color: #475569; }

    /* ── NEED HELP ── */
    .lp-need-help-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 99;
      background: var(--navy); color: white; border: none; border-radius: 40px;
      padding: 12px 20px; display: flex; align-items: center; gap: 8px;
      font-weight: 600; font-size: 14px; cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,.15); transition: transform .2s; font-family: var(--font);
    }
    .lp-need-help-btn:hover { transform: scale(1.02); background: #1E293B; }
    .lp-modal-overlay {
      position: fixed; top:0; left:0; right:0; bottom:0;
      background: rgba(0,0,0,0.5); display: flex;
      align-items: center; justify-content: center; z-index: 200;
    }
    .lp-modal { background: white; border-radius: 20px; max-width: 400px; width: 90%; padding: 24px; position: relative; }
    .lp-modal-close { position: absolute; top: 16px; right: 16px; background: none; border: none; cursor: pointer; }
    .lp-modal-title { font-size: 20px; font-weight: 700; margin-bottom: 16px; }
    .lp-modal-btns  { display: flex; flex-direction: column; gap: 12px; }

    /* ── SCROLL REVEAL ── */
    .scroll-reveal { opacity:0; transform:translateY(22px); transition:opacity .55s ease,transform .55s ease; }
    .scroll-reveal.visible { opacity:1; transform:translateY(0); }

    /* ── RESPONSIVE ── */
    @media(max-width:768px){
      .lp-desktop-nav{ display:none!important }
      .lp-desktop-btns{ display:none!important }
      .lp-hamburger-btn{ display:flex!important }
      .lp-steps-grid{ grid-template-columns:1fr 1fr!important }
      .lp-guarantee-grid{ grid-template-columns:1fr 1fr!important }
      .lp-footer-grid{ grid-template-columns:1fr 1fr!important }
      .subcategories-content{ width:100% }
      .workers-horizontal-scroll{ width:100% }
      .worker-card-horizontal-scroll{ min-width:280px; max-width:100% }
      .hero-title{ font-size:2rem }
      .categories-icons-content{ gap:0.5rem }
    }
    @media(max-width:480px){
      .icon-label{ font-size:11px }
      .category-icon-item{ width:72px }
      .category-img{ width:40px; height:40px }
      .lp-steps-grid{ grid-template-columns:1fr!important }
      .lp-guarantee-grid{ grid-template-columns:1fr!important }
    }
  `}</style>
);

/* ─── scroll reveal hook ─── */
function useScrollReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.classList.add('scroll-reveal');
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) el.classList.add('visible'); },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* ─── static data ─── */
const CATEGORIES = [
  { id:'Carpentry',        label:'Carpentry',        image:assemblyImg },
  { id:'Appliance Repair', label:'Appliance Repair', image:repairImg   },
  { id:'Plumbing',         label:'Plumbing',         image:mountingImg },
  { id:'Moving',           label:'Moving',           image:movingImg   },
  { id:'Cleaning',         label:'Cleaning',         image:cleaningImg },
  { id:'Outdoor Help',     label:'Outdoor Help',     image:outdoorImg  },
  { id:'Painting',         label:'Painting',         image:paintingImg },
  { id:'Trending',         label:'Trending',         image:trendingImg },
];

const CATEGORY_SUBCATEGORIES = {
  'Carpentry':        ['Furniture Repair','Flooring Installation','Custom Built-ins','Refinishing','Trim Work'],
  'Plumbing':         ['Drain Cleaning','Faucet Repair','Toilet Repair','Water Heater Repair','Pipe Repair'],
  'Appliance Repair': ['AC Installation','AC Repair','Dryer Repair','Washer Repair','Refrigerator Repair','Dishwasher Repair','Oven Repair'],
  'Moving':           ['Furniture Moving','Box Moving','Specialty Moving','Equipment Moving'],
  'Cleaning':         ['House Cleaning','Deep Cleaning','Move-in/Move-out Cleaning'],
  'Outdoor Help':     ['Lawn Mowing','Tree Trimming','Plant Care','Weed Control','Fertilization'],
  'Painting':         ['Interior','Exterior'],
  'Trending':         ['Emergency Services','Top Rated'],
};

const STEPS = [
  { num:1, title:'Send a Request',    desc:'Describe your project and what you need. Be detailed for the best matches.',   stripe:'#E0E7FF' },
  { num:2, title:'Negotiate Pricing', desc:'Chat with workers and agree on fair pricing that works for both parties.',      stripe:'#FEF3C7' },
  { num:3, title:'Worker Accepts',    desc:'Worker commits to your timeline and agreed scope of work.',                    stripe:'#D1FAE5' },
  { num:4, title:'Pay in Escrow',     desc:'Your payment is held securely in escrow until you\'re satisfied.',            stripe:'#DBEAFE' },
  { num:5, title:'Work Completed',    desc:'Worker completes the job. Review the work before approving.',                 stripe:'#FCE7F3' },
  { num:6, title:'Escrow Released',   desc:'Once you approve, payment is released to the worker automatically.',          stripe:'#D5F5E3' },
];

const GUARANTEES = [
  { title:'Background Checked', desc:'All professionals undergo thorough background verification before joining our platform.' },
  { title:'24/7 Support',       desc:'Our support team is available around the clock to help with any questions or issues.'   },
  { title:'Quality Guaranteed', desc:'Not satisfied? We\'ll make it right or refund your money — no questions asked.'        },
  { title:'Secure Payments',    desc:'Your payments are protected with bank-grade escrow protection on every job.'            },
];

/* ─────────────────────────────────────────
   WorkerCard — compact version with only important info
───────────────────────────────────────── */
const WorkerCard = ({
  id, name, rating, reviews, completedJobs,
  profileImage, reviewCount, responseTime, serviceArea, skills,
}) => {
  const navigate = useNavigate();
  const handleViewProfile = () => navigate('/login');

  const safeRating = (() => {
    if (!rating && rating !== 0) return 4.5;
    const n = typeof rating === 'string' ? parseFloat(rating) : rating;
    return !isNaN(n) && n > 0 ? n : 4.5;
  })();

  const displayRating = (() => {
    if (reviews && reviews.length > 0) {
      const sum = reviews.reduce((acc, r) => acc + (parseFloat(r.stars) || 0), 0);
      const avg = sum / reviews.length;
      return !isNaN(avg) ? avg.toFixed(1) : safeRating.toFixed(1);
    }
    return safeRating.toFixed(1);
  })();

  const safeReviewCount   = reviewCount || (reviews?.length || 0);
  const safeCompletedJobs = completedJobs || 0;
  const [imgError, setImgError] = useState(false); 

  const formattedResponseRate = responseTime
    ? (typeof responseTime === 'number' ? responseTime : parseInt(responseTime)) + '%'
    : '98%';

  const formattedServiceArea = serviceArea
    ? serviceArea.primaryCity || serviceArea.cities?.[0] || serviceArea || '5 km'
    : '5 km';

  return (
    <div className="worker-card-horizontal-scroll">
      <div className="worker-header">
        <div className="profile-photo-home">
          {profileImage && !imgError                           // ← add !imgError check
  ? <img src={profileImage} alt={name} onError={() => setImgError(true)} />  // ← add onError
  : <span className="profile-initials">{name?.split(' ').map(n => n[0]).join('') || '?'}</span>
}
        </div>
        <div className="worker-info-compact">
          <div className="worker-name">{name || 'Unknown Worker'}</div>
          <div className="rating-row">
            <span className="star-icon">★</span>
            <span className="rating-value">{displayRating}</span>
            <span className="reviews-count">({safeReviewCount})</span>
          </div>
          {safeRating >= 4.5 && safeCompletedJobs > 10 && (
            <div className="elite-badge">ELITE</div>
          )}
        </div>
      </div>

      <div className="worker-stats-compact">
        <div className="stat-item-compact">
          <span className="stat-label-compact">Jobs Completed</span>
          <span className="stat-value-compact">{safeCompletedJobs}</span>
        </div>
        <div className="stat-item-compact">
          <span className="stat-label-compact">Response Rate</span>
          <span className="stat-value-compact">{formattedResponseRate}</span>
        </div>
        <div className="stat-item-compact">
          <span className="stat-label-compact">Service Area</span>
          <span className="stat-value-compact">{formattedServiceArea}</span>
        </div>
      </div>

      <button className="select-btn" onClick={handleViewProfile}>View Profile</button>
    </div>
  );
};

/* ─── CategoryIcon ─── */
const CategoryIcon = ({ image, label, active, onClick }) => (
  <div className={`category-icon-item ${active ? 'active' : ''}`} onClick={onClick}>
    <div className="icon-circle">
      <img src={image} alt={label} className="category-img" />
    </div>
    <span className={`icon-label ${active ? 'active' : ''}`}>{label}</span>
  </div>
);

/* ─── SubcategoryItem ─── */
const SubcategoryItem = ({ label, active, onClick }) => (
  <div className={`subcategory-item ${active ? 'active' : ''}`} onClick={onClick}>
    {label}
  </div>
);

/* ─── formatHomeWorker helper ─── */
const formatHomeWorker = (w) => ({
  id:           w.id || w.email,
  name:         w.name || 'Unknown Worker',
  rating:       w.rating || 4.5,
  reviews:      [],
  recentReview: null,
  reviewCount:  w.review_count || 0,
  completedJobs:w.completed_tasks || 0,
  price:        w.base_price || 1000,
  profileImage: w.profile_pic || null,
  responseTime: w.response_time || null,
  serviceArea:  w.area || '5 km',
  category:     w.service_type || '',
  subcategory:  w.service_type || '',
  skills:       [],
});

/* ─────────────────────────────────────────
   Navbar
───────────────────────────────────────── */
function LandingNavbar() {
  const navigate  = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollTo  = (id) => {
    document.querySelector(id)?.scrollIntoView({ behavior:'smooth', block:'start' });
    setMenuOpen(false);
  };

  return (
    <header className="lp-navbar">
      <div className="lp-navbar-inner">
        <button className="lp-logo-btn" onClick={() => navigate('/')}>
          <img src={logo} alt="Kaam-ly" />
        </button>


        <div className="lp-desktop-btns">
          <button className="lp-nav-link" onClick={() => navigate('/login')}>Sign In</button>
          <button className="lp-btn-primary" onClick={() => navigate('/register-worker')}>Become a Tasker</button>
        </div>

        <button className="lp-hamburger-btn" onClick={() => setMenuOpen(o => !o)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth="2">
            {menuOpen
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
            }
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="lp-mobile-menu">
          <button className="lp-mobile-menu-link" onClick={() => scrollTo('#how-it-works')}>How It Works</button>
          <button className="lp-mobile-menu-link" onClick={() => scrollTo('#guarantees')}>Our Guarantee</button>
          <div className="lp-mobile-menu-btns">
            <button className="lp-btn-outline" style={{ flex:1 }} onClick={() => { navigate('/login'); setMenuOpen(false); }}>Sign In</button>
            <button className="lp-btn-primary" style={{ flex:1 }} onClick={() => { navigate('/register-worker'); setMenuOpen(false); }}>Become a Tasker</button>
          </div>
        </div>
      )}
    </header>
  );
}

/* ─────────────────────────────────────────
   Hero — identical layout to homePage hero
───────────────────────────────────────── */
function Hero() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  return (
    <section className="hero-section">
      <div className="hero-content">
        <h1 className="hero-title">Book a Trusted Worker for Any Task</h1>
        <div className="lp-search-bar">
          <input
            type="text"
            placeholder="Search products..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && navigate('/login')}
          />
          <button className="lp-camera-btn" onClick={() => navigate('/login')} title="Search by image">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Categories + Workers
   Logic mirrors homePage.jsx exactly.
   Renders ONLY "Highest Rated" section.
───────────────────────────────────────── */
function CategoriesAndWorkers() {
  const [workers,             setWorkers]             = useState([]);
  const [loading,             setLoading]             = useState(true);
  const [error,               setError]               = useState('');
  const [selectedCategory,    setSelectedCategory]    = useState('Carpentry');
  const [selectedSubcategory, setSelectedSubcategory] = useState('Furniture Repair');
  const [topRatedWorkers,     setTopRatedWorkers]     = useState([]);
  const [emergencyWorkers,    setEmergencyWorkers]    = useState([]);
  const [trendingLoading,     setTrendingLoading]     = useState(false);

  /* ── trending ── */
  useEffect(() => {
    if (selectedCategory !== 'Trending') return;
    setTrendingLoading(true);
    (async () => {
      try {
        if (selectedSubcategory === 'Top Rated') {
          const data = await getTopRated();
          setTopRatedWorkers((Array.isArray(data) ? data : []).map(formatHomeWorker));
        } else {
          const data = await getEmergencyWorkers();
          setEmergencyWorkers((Array.isArray(data) ? data : []).map(formatHomeWorker));
        }
      } catch (err) { console.error('Trending error:', err); }
      finally { setTrendingLoading(false); }
    })();
  }, [selectedCategory, selectedSubcategory]);

  /* ── regular workers ── */
  useEffect(() => {
    if (selectedCategory === 'Trending') return;
    setLoading(true); setError('');
    (async () => {
      try {
        let data;
        if (selectedSubcategory && selectedSubcategory !== 'All') {
          data = await getWorkerBySubcategory(selectedCategory.toLowerCase(), selectedSubcategory);
        } else {
          data = await getWorkerByCategory(selectedCategory.toLowerCase());
        }

        if (!data || !Array.isArray(data) || data.length === 0) {
          setWorkers([]); setError('No workers found for this category'); setLoading(false); return;
        }

        const enriched = await Promise.all(
          data.map(async (worker) => {
            try {
              const reviews     = await getReviewsById(worker._id || worker.id);
              const reviewsData = Array.isArray(reviews) ? reviews : (reviews.reviews || []);
              const avgRating   = reviewsData.length > 0
                ? reviewsData.reduce((sum, r) => sum + (r.stars || 0), 0) / reviewsData.length
                : (worker.ratings || 4.5);
              const sorted      = [...reviewsData].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
              const taskSkill   = worker.skills?.find(s => s.name?.toLowerCase() === selectedSubcategory.toLowerCase());
              return {
                id:           worker._id || worker.id,
                name:         `${worker.firstName || ''} ${worker.lastName || ''}`.trim() || 'Unknown Worker',
                rating:       avgRating, reviews: reviewsData, recentReview: sorted[0],
                reviewCount:  reviewsData.length, completedJobs: worker.noOfCompletedTask || 0,
                price:        taskSkill?.price || worker.basePrice || 1000,
                profileImage: worker.profilePhoto || worker.profileImage || null,
                category:     worker.taskType || selectedCategory, skills: worker.skills || [],
                subcategory:  worker.skills?.[0]?.name || 'General',
                serviceArea:  worker.serviceArea, responseTime: worker.responseTime,
              };
            } catch {
              const taskSkill = worker.skills?.find(s => s.name?.toLowerCase() === selectedSubcategory.toLowerCase());
              return {
                id:           worker._id || worker.id,
                name:         `${worker.firstName || ''} ${worker.lastName || ''}`.trim() || 'Unknown Worker',
                rating:       worker.ratings || 4.5, reviews: [], recentReview: null, reviewCount: 0,
                completedJobs:worker.noOfCompletedTask || 0,
                price:        taskSkill?.price || worker.basePrice || 1000,
                profileImage: worker.profilePhoto || null,
                category:     worker.taskType || selectedCategory, skills: worker.skills || [],
                subcategory:  worker.skills?.[0]?.name || 'General',
              };
            }
          })
        );
        setWorkers(enriched);
      } catch (err) {
        setError(`Failed to load workers: ${err.message}`); setWorkers([]);
      } finally { setLoading(false); }
    })();
  }, [selectedCategory, selectedSubcategory]);

  const handleCategoryClick = (categoryId) => {
    setSelectedCategory(categoryId);
    const subs = CATEGORY_SUBCATEGORIES[categoryId];
    if (subs?.length > 0) setSelectedSubcategory(subs[0]);
  };

  const isTrending = selectedCategory === 'Trending';
  const isLoading  = isTrending ? trendingLoading : loading;

  /* top 8 by rating */
  const highestRatedWorkers = isTrending
    ? (selectedSubcategory === 'Top Rated' ? topRatedWorkers : emergencyWorkers).slice(0, 8)
    : [...workers].sort((a, b) => b.rating - a.rating).slice(0, 8);

  return (
    <section id="categories">
      {/* Category icons — identical to homePage */}
      <section className="categories-icons-section">
        <div className="categories-icons-content">
          {CATEGORIES.map(cat => (
            <CategoryIcon
              key={cat.id} image={cat.image} label={cat.label}
              active={selectedCategory === cat.id}
              onClick={() => handleCategoryClick(cat.id)}
            />
          ))}
        </div>

        {CATEGORY_SUBCATEGORIES[selectedCategory] && (
          <section className="subcategories-section">
            <div className="subcategories-content">
              {CATEGORY_SUBCATEGORIES[selectedCategory].map(sub => (
                <SubcategoryItem
                  key={sub} label={sub}
                  active={selectedSubcategory === sub}
                  onClick={() => setSelectedSubcategory(sub)}
                />
              ))}
            </div>
          </section>
        )}
      </section>

      {/* Highest Rated — only section shown */}
      <section className="workers-section">
        <div className="workers-content">
          <div className="workers-horizontal-scroll">
            {isLoading && <p>Loading workers...</p>}
            {!isLoading && error && <p className="error-message">{error}</p>}
            {!isLoading && !error && highestRatedWorkers.length > 0 &&
              highestRatedWorkers.map(w => <WorkerCard key={`hr-${w.id}`} {...w} />)
            }
            {!isLoading && !error && highestRatedWorkers.length === 0 && (
              <p className="no-workers-message">No workers found for {selectedCategory}.</p>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}

/* ─────────────────────────────────────────
   How It Works
───────────────────────────────────────── */
function HowItWorks() {
  const ref = useScrollReveal();
  return (
    <section id="how-it-works" className="lp-how-section">
      <div className="lp-section-inner">
        <div ref={ref}>
          <h2 className="lp-section-heading">How <span style={{ color:'var(--orange)' }}>Kaam-ly</span> Works</h2>
          <p className="lp-section-sub">Simple, transparent process to get your projects done</p>
        </div>
        <div className="lp-steps-grid">
          {STEPS.map(s => {
            const r = useScrollReveal();
            return (
              <div key={s.num} ref={r} className="lp-step-card">
                <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:s.stripe, borderRadius:'18px 18px 0 0' }} />
                <div className="lp-step-num">{s.num}</div>
                <div className="lp-step-title">{s.title}</div>
                <div className="lp-step-desc">{s.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Guarantee
───────────────────────────────────────── */
function Guarantee() {
  const ref = useScrollReveal();
  return (
    <section id="guarantees" className="lp-guarantee-section">
      <div className="lp-section-inner">
        <div ref={ref}>
          <h2 className="lp-section-heading">Our <span style={{ color:'var(--orange)' }}>Guarantee</span></h2>
          <p className="lp-section-sub">We stand behind every booking with our comprehensive guarantees</p>
        </div>
        <div className="lp-guarantee-grid">
          {GUARANTEES.map((g, i) => {
            const r = useScrollReveal();
            return (
              <div key={i} ref={r} className="lp-guarantee-card">
                <div className="lp-guarantee-title">{g.title}</div>
                <div className="lp-guarantee-desc">{g.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   CTA Banner
───────────────────────────────────────── */


/* ─────────────────────────────────────────
   Footer
───────────────────────────────────────── */
function Footer() {
  const navigate = useNavigate();
  return (
    <footer className="lp-footer">
      <div className="lp-footer-inner">
        <div className="lp-footer-grid">
          <div>
            <button onClick={() => navigate('/')} style={{ background:'none', border:'none', cursor:'pointer', padding:0, marginBottom:16, display:'block' }}>
              <img src={logo} alt="Kaam-ly" style={{ height:38, objectFit:'contain', filter:'brightness(0) invert(1)' }} />
            </button>
            <p style={{ fontSize:13, lineHeight:1.75, color:'#94A3B8' }}>
              Connecting you with trusted local service professionals for all your home and business needs.
            </p>
          </div>
          <div>
            <div className="lp-footer-col-title">Quick Links</div>
            {[
              { label:'Find Services',  fn:() => navigate('/login') },
              { label:'For Workers',    fn:() => navigate('/register-worker') },
              { label:'How It Works',   fn:() => document.querySelector('#how-it-works')?.scrollIntoView({ behavior:'smooth' }) },
              { label:'Become a Pro',   fn:() => navigate('/register-worker') },
            ].map(l => <button key={l.label} onClick={l.fn} className="lp-footer-link">{l.label}</button>)}
          </div>
        
          <div>
            <div className="lp-footer-col-title">Contact Us</div>
            {['kaamly7@gmail.com','9812345672','Kathmandu, Nepal 44600'].map((t, i) => (
              <div key={i} style={{ marginBottom:12, fontSize:13, color:'#94A3B8' }}>{t}</div>
            ))}
          </div>
        </div>
        <hr className="lp-footer-hr" />
        <p className="lp-footer-copy">© 2026 Kaam-ly. All rights reserved.</p>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────
   Need Help button + modal
───────────────────────────────────────── */


/* ─────────────────────────────────────────
   Root export
───────────────────────────────────────── */
export default function LandingPage() {
  return (
    <>
      <GlobalStyles />
      <div className="lp-app-container">
        <LandingNavbar />
        <Hero />
        <CategoriesAndWorkers />
        <HowItWorks />
        <Guarantee />
        <Footer />
        <ChatWidget />
      </div>
    </>
  );
}