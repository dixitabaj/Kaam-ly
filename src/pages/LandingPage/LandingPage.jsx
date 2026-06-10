import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';
import {
  getWorkerByCategory,
  getWorkerBySubcategory,
  getReviewsById,
  getTopRated,
  getEmergencyWorkers,
} from '../../api/api';

import logo from '../../images/logo.png';
import assemblyImg from '../../images/assembly.png';
import repairImg from '../../images/plumbing.png';
import movingImg from '../../images/moving.png';
import cleaningImg from '../../images/cleaning.png';
import outdoorImg from '../../images/gardening.png';
import paintingImg from '../../images/painting.png';
import trendingImg from '../../images/trending.png';
import mountingImg from '../../images/repair.png';
import ChatWidget from '../../components/HelpSection/HelpSection';
import worker from "../../images/worker1.png"

/* ── static data ── */
const CATEGORIES = [
  { id: 'Carpentry', label: 'Carpentry', image: assemblyImg },
  { id: 'Appliance Repair', label: 'Appliance Repair', image: repairImg },
  { id: 'Plumbing', label: 'Plumbing', image: mountingImg },
  { id: 'Moving', label: 'Moving', image: movingImg },
  { id: 'Cleaning', label: 'Cleaning', image: cleaningImg },
  { id: 'Outdoor Help', label: 'Outdoor Help', image: outdoorImg },
  { id: 'Painting', label: 'Painting', image: paintingImg },
  { id: 'Trending', label: 'Trending', image: trendingImg },
];

const SUBCATEGORIES = {
  'Carpentry': ['Furniture Repair', 'Flooring Installation', 'Custom Built-ins', 'Refinishing', 'Trim Work'],
  'Plumbing': ['Drain Cleaning', 'Faucet Repair', 'Toilet Repair', 'Water Heater Repair', 'Pipe Repair'],
  'Appliance Repair': ['AC Installation', 'AC Repair', 'Dryer Repair', 'Washer Repair', 'Refrigerator Repair', 'Dishwasher Repair', 'Oven Repair'],
  'Moving': ['Furniture Moving', 'Box Moving', 'Specialty Moving', 'Equipment Moving'],
  'Cleaning': ['House Cleaning', 'Deep Cleaning', 'Move-in/Move-out Cleaning'],
  'Outdoor Help': ['Lawn Mowing', 'Tree Trimming', 'Plant Care', 'Weed Control', 'Fertilization'],
  'Painting': ['Interior', 'Exterior'],
  'Trending': ['Emergency Services', 'Top Rated'],
};

const STEPS = [
  { num: 1, title: 'Send a Request', desc: 'Describe your project and what you need. Be detailed for the best matches.' },
  { num: 2, title: 'Negotiate Pricing', desc: 'Chat with workers and agree on fair pricing that works for both parties.' },
  { num: 3, title: 'Worker Accepts', desc: 'Worker commits to your timeline and agreed scope of work.' },
  { num: 4, title: 'Pay in Escrow', desc: 'Your payment is held securely in escrow until you\'re satisfied.' },
  { num: 5, title: 'Work Completed', desc: 'Worker completes the job. Review the work before approving.' },
  { num: 6, title: 'Escrow Released', desc: 'Once you approve, payment is released to the worker automatically.' },
];

const GUARANTEE_ICONS = {
  search: (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  ),
  clock: (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  check: (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  lock: (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
};

const GUARANTEES = [
  { iconKey: 'search', title: 'Background Checked', desc: 'All professionals undergo thorough background verification before joining.' },
  { iconKey: 'clock',  title: '24/7 Support',       desc: 'Our support team is available around the clock for any questions.' },
  { iconKey: 'check',  title: 'Quality Guaranteed',  desc: "Not satisfied? We'll make it right or refund your money." },
  { iconKey: 'lock',   title: 'Secure Payments',     desc: 'Payments protected with bank-grade escrow on every job.' },
];

const formatWorker = (w) => ({
  id: w.id || w.email,
  name: w.name || 'Unknown Worker',
  rating: w.rating || 4.5,
  reviews: [],
  reviewCount: w.review_count || 0,
  completedJobs: w.completed_tasks || 0,
  profileImage: w.profile_pic || null,
  responseTime: w.response_time || null,
  serviceArea: w.area || '5 km',
});

/* ── scroll reveal hook ── */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('visible'); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* ══════════════════════════════════════
   NAVBAR
══════════════════════════════════════ */
function Navbar() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    document.querySelector(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMenuOpen(false);
  };

  return (
    <header className={`nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="nav-inner">
        <button className="nav-logo" onClick={() => navigate('/')}>
          <img src={logo} alt="Kaam-ly" />
        </button>

        <nav className="nav-links">
          <button className="nav-link" onClick={() => scrollTo('#categories')}>Services</button>
          <button className="nav-link" onClick={() => scrollTo('#how-it-works')}>How It Works</button>
          <button className="nav-link" onClick={() => scrollTo('#guarantees')}>Guarantee</button>
        </nav>

        <div className="nav-actions">
          <button className="btn-ghost" onClick={() => navigate('/login')}>Sign In</button>
          <button className="btn-orange" onClick={() => navigate('/register-worker')}>Become a Tasker</button>
        </div>

        <button className="nav-hamburger" onClick={() => setMenuOpen(o => !o)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round">
            {menuOpen
              ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
              : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
            }
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="nav-mobile-menu">
          {['#categories', '#how-it-works', '#guarantees'].map((id, i) => (
            <button key={id} className="nav-mobile-link" onClick={() => scrollTo(id)}>
              {['Services', 'How It Works', 'Guarantee'][i]}
            </button>
          ))}
          <div className="nav-mobile-btns">
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => { navigate('/login'); setMenuOpen(false); }}>Sign In</button>
            <button className="btn-orange" style={{ flex: 1 }} onClick={() => { navigate('/register-worker'); setMenuOpen(false); }}>Become a Tasker</button>
          </div>
        </div>
      )}
    </header>
  );
}

/* ══════════════════════════════════════
   HERO — Bold split with floating cards
══════════════════════════════════════ */
function Hero() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  /* decorative grid dots */
  const dots = Array.from({ length: 30 });

  return (
    <section className="hero">
      <div className="hero-inner">
        {/* LEFT */}
        <div className="hero-left">
         

          <h1 className="hero-home-title">
            <span className="hero-home-title-line">Every task,</span>
            <span className="hero--hometitle-line hero-home-title-accent">a trusted master</span>
          </h1>

          <p className="hero-sub">
            Connect with verified local professionals for home repairs, cleaning, moving, and more — all with secure escrow payments.
          </p>

          <div className="hero-search-wrap">
            <div className="hero-search">
              <input
                type="text"
                placeholder="What do you need help with?"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && navigate('/login')}
              />
              <button className="hero-search-cam" title="Search by image" onClick={() => navigate('/login')}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
              <button className="hero-search-btn" onClick={() => navigate('/login')}>
                Find Workers
              </button>
            </div>
          </div>

         
        </div>

        {/* RIGHT — decorative panel */}
        <div className="hero-right">
         <img src={worker} alt="Worker" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 20 }} />

        </div>
      </div>

    </section>
  );
}

/* ══════════════════════════════════════
   MARQUEE
══════════════════════════════════════ */

/* ══════════════════════════════════════
   WORKER CARD
══════════════════════════════════════ */
/* ══════════════════════════════════════
   WORKER CARD - SERVICE STYLE (Like Reference Image)
══════════════════════════════════════ */
/* ══════════════════════════════════════
   WORKER CARD - WITH PROFILE IMAGE
══════════════════════════════════════ */

const AVATAR_COLORS = [
  { bg: '#FEF3C7', color: '#92400E' },
  { bg: '#DBEAFE', color: '#1E40AF' },
  { bg: '#D1FAE5', color: '#065F46' },
  { bg: '#EDE9FE', color: '#5B21B6' },
  { bg: '#FCE7F3', color: '#9D174D' },
];

function WorkerCard({
  id,
  name,
  rating,
  reviews,
  reviewCount,
  completedJobs,
  profileImage,
  responseTime,
  serviceArea,
  selectedSub,
}) {
  const navigate = useNavigate();
  const [imgErr, setImgErr] = useState(false);

  const displayRating = useMemo(() => {
    if (reviews?.length > 0) {
      const sum = reviews.reduce((a, r) => a + (parseFloat(r.stars) || 0), 0);
      const avg = sum / reviews.length;
      return isNaN(avg) ? 4.5 : parseFloat(avg.toFixed(1));
    }
    const n = typeof rating === 'string' ? parseFloat(rating) : rating;
    return !isNaN(n) && n > 0 ? n : 4.5;
  }, [reviews, rating]);

  const safeReviews  = reviewCount || reviews?.length || 0;
  const safeJobs     = completedJobs || 0;
  const responseRate = responseTime
    ? `${typeof responseTime === 'number' ? responseTime : parseInt(responseTime)}%`
    : '98%';
  const area         = serviceArea?.primaryCity || serviceArea?.cities?.[0] || serviceArea || 'Kathmandu';
  const taskType     = selectedSub || 'Service';
  const initials     = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const isTopRated   = displayRating >= 4.8 && safeJobs > 15;
  const avatarColor  = AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

  const recentReview = reviews?.[0]?.text
    || (safeReviews > 0 ? 'Great service, very professional and timely.' : 'Reliable and skilled — would recommend.');

  const fullStars  = Math.floor(displayRating);
  const hasHalf    = displayRating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  // Replace with real price from API
  const price = useMemo(() => Math.floor(Math.random() * (150 - 40 + 1) + 40), [id]);

  return (
    <div className="worker-card">
      {isTopRated && <div className="wc-badge">⚡ Top Rated</div>}

      <div
        className="wc-avatar"
        style={{ background: avatarColor.bg, color: avatarColor.color }}
      >
        {profileImage && !imgErr
          ? <img src={profileImage} alt={name} onError={() => setImgErr(true)} />
          : initials}
      </div>

      <div className="wc-name" title={name}>{name || 'Unknown Worker'}</div>
      <div className="wc-location">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a8 8 0 0 0-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 0 0-8-8z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        {String(area).split(',')[0]}
      </div>

      <div className="wc-price">
        Rs. {price}<span>/hr</span>
      </div>


      <div className="wc-stars-row">
        {[...Array(fullStars)].map((_, i)  => <span key={`f${i}`} className="wc-star-fill">★</span>)}
        {hasHalf                            && <span className="wc-star-fill">½</span>}
        {[...Array(emptyStars)].map((_, i) => <span key={`e${i}`} className="wc-star-empty">★</span>)}
        <span className="wc-rating-val">{displayRating.toFixed(1)}</span>
        <span className="wc-rating-count">({safeReviews})</span>
      </div>

      <div className="wc-stats-grid">
        <div className="wc-stat">
          <div className="wc-stat-label">Jobs done</div>
          <div className="wc-stat-val">{safeJobs}</div>
        </div>
        <div className="wc-stat">
          <div className="wc-stat-label">Response</div>
          <div className="wc-stat-val">{responseRate}</div>
        </div>
      </div>

      <div className="wc-review-box">
        <div className="wc-review-label">Recent review</div>
        <div className="wc-review-text">
          "{recentReview.length > 70 ? recentReview.slice(0, 70) + '…' : recentReview}"
        </div>
      </div>

      <button className="wc-book-btn" onClick={() => navigate('/login')}>
        View Profile & Book
      </button>
    </div>
  );
}


/* ══════════════════════════════════════
   CATEGORIES + WORKERS
══════════════════════════════════════ */
function CategoriesAndWorkers() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCat, setSelectedCat] = useState('Carpentry');
  const [selectedSub, setSelectedSub] = useState('Furniture Repair');
  const [topRated, setTopRated] = useState([]);
  const [emergency, setEmergency] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(false);

  useEffect(() => {
    if (selectedCat !== 'Trending') return;
    setTrendingLoading(true);
    (async () => {
      try {
        if (selectedSub === 'Top Rated') {
          const d = await getTopRated();
          setTopRated((Array.isArray(d) ? d : []).map(formatWorker));
        } else {
          const d = await getEmergencyWorkers();
          setEmergency((Array.isArray(d) ? d : []).map(formatWorker));
        }
      } catch (e) { console.error(e); }
      finally { setTrendingLoading(false); }
    })();
  }, [selectedCat, selectedSub]);

  useEffect(() => {
    if (selectedCat === 'Trending') return;
    setLoading(true); setError('');
    (async () => {
      try {
        let data = selectedSub && selectedSub !== 'All'
          ? await getWorkerBySubcategory(selectedCat.toLowerCase(), selectedSub)
          : await getWorkerByCategory(selectedCat.toLowerCase());

        if (!data || !Array.isArray(data) || !data.length) {
          setWorkers([]); setError('No workers found for this category'); setLoading(false); return;
        }

        const enriched = await Promise.all(data.map(async (w) => {
          try {
            const revData = await getReviewsById(w._id || w.id);
            const revs = Array.isArray(revData) ? revData : (revData.reviews || []);
            const avgRating = revs.length > 0
              ? revs.reduce((s, r) => s + (r.stars || 0), 0) / revs.length
              : (w.ratings || 4.5);
            return {
              id: w._id || w.id,
              name: `${w.firstName || ''} ${w.lastName || ''}`.trim() || 'Unknown Worker',
              rating: avgRating, reviews: revs,
              reviewCount: revs.length, completedJobs: w.noOfCompletedTask || 0,
              profileImage: w.profilePhoto || null,
              serviceArea: w.serviceArea, responseTime: w.responseTime,
            };
          } catch {
            return {
              id: w._id || w.id,
              name: `${w.firstName || ''} ${w.lastName || ''}`.trim() || 'Unknown Worker',
              rating: w.ratings || 4.5, reviews: [], reviewCount: 0,
              completedJobs: w.noOfCompletedTask || 0, profileImage: w.profilePhoto || null,
            };
          }
        }));
        setWorkers(enriched);
      } catch (e) {
        setError(`Failed to load workers: ${e.message}`); setWorkers([]);
      } finally { setLoading(false); }
    })();
  }, [selectedCat, selectedSub]);

  const handleCatClick = (id) => {
    setSelectedCat(id);
    const subs = SUBCATEGORIES[id];
    if (subs?.length) setSelectedSub(subs[0]);
  };

  const isTrending = selectedCat === 'Trending';
  const isLoading = isTrending ? trendingLoading : loading;
  const displayed = isTrending
    ? (selectedSub === 'Top Rated' ? topRated : emergency).slice(0, 8)
    : [...workers].sort((a, b) => b.rating - a.rating).slice(0, 8);

  const titleRef = useReveal();

  return (
    <section id="categories">
      <div className="categories-section">
        <div className="categories-inner">
          <div className="categories-grid">
            {CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                className={`category-item ${selectedCat === cat.id ? 'active' : ''}`}
                onClick={() => handleCatClick(cat.id)}
              >
                <div className="category-img-wrap">
                  <img src={cat.image} alt={cat.label} className="category-img" />
                </div>
                <span className="category-label">{cat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {SUBCATEGORIES[selectedCat] && (
          <div className="subcategories-bar">
            <div className="subcategories-inner">
              {SUBCATEGORIES[selectedCat].map(sub => (
                <button
                  key={sub}
                  className={`subcategory-pill ${selectedSub === sub ? 'active' : ''}`}
                  onClick={() => setSelectedSub(sub)}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

     <div className="workers-section">
  <div className="workers-inner">
    <div className="workers-header reveal" ref={titleRef}>
      <h2 className="section-landing-title">
        Top Workers in <span>{selectedSub || selectedCat}</span>
      </h2>
      <div className="scroll-hint">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
        Scroll to see more →
      </div>
    </div>

    <div className="workers-scroll-wrapper">
      <div className="workers-scroll">
        {isLoading && <p className="no-workers">Loading workers…</p>}
        {!isLoading && error && <p className="workers-error">{error}</p>}
        {!isLoading && !error && displayed.length > 0 &&
          displayed.map(w => <WorkerCard key={w.id} {...w} />)
        }
        {!isLoading && !error && !displayed.length && (
          <p className="no-workers">No workers found for {selectedCat}.</p>
        )}
      </div>
    </div>
  </div>
</div>
    </section>
  );
}

/* ══════════════════════════════════════
   HOW IT WORKS — Split layout with image
══════════════════════════════════════ */
function HowItWorks() {
  const headRef = useReveal();
  return (
    <section id="how-it-works" className="how-section">
      <div className="how-inner">
        <div className="how-layout">
          {/* LEFT — steps */}
          <div className="how-left">
            <div ref={headRef}>
              <p className="section-eyebrow">Simple Process</p>
              <h2 className="section-heading">How <span>Kaam-ly</span> Works</h2>
              <p className="section-sub">A transparent, secure process from request to payment — designed to protect everyone.</p>
            </div>

            <div className="steps-list">
              {STEPS.map((s) => {
                const ref = useReveal();
                return (
                  <div key={s.num} className="step-card reveal" ref={ref} style={{ transitionDelay: `${(s.num - 1) * 55}ms` }}>
                    <div className="step-num">{s.num}</div>
                    <div className="step-body">
                      <div className="step-title">{s.title}</div>
                      <div className="step-desc">{s.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT — decorative image panel */}
          <div className="how-right">
            <div className="how-img-container">
              {/* Replace src with an actual image import if desired */}
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: 'url(https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=600&q=80)',
                backgroundSize: 'cover', backgroundPosition: 'center',
                opacity: 0.5,
              }} />
            </div>

            <div className="how-img-overlay-card">
              <div className="how-overlay-title">Quick overview</div>
              <div className="how-overlay-steps">
                {[
                  { n: 1, text: 'Choose a Tasker by skills & reviews' },
                  { n: 2, text: 'Agree on price, book immediately' },
                  { n: 3, text: 'Pay, review, and release securely' },
                ].map(item => (
                  <div key={item.n} className="how-overlay-step">
                    <div className="how-overlay-dot"><span>{item.n}</span></div>
                    <p>{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════
   GUARANTEES
══════════════════════════════════════ */
function Guarantees() {
  const headRef = useReveal();
  return (
    <section id="guarantees" className="guarantee-section">
      <div className="guarantee-inner">
        <div ref={headRef}>
          <p className="section-eyebrow">Why Choose Us</p>
          <h2 className="section-heading">Our <span>Guarantee</span></h2>
          <p className="section-sub">We stand behind every booking with our comprehensive guarantees.</p>
        </div>

        <div className="guarantee-grid">
          {GUARANTEES.map((g, i) => {
            const ref = useReveal();
            return (
              <div key={i} className="guarantee-card reveal" ref={ref} style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="guarantee-icon">{GUARANTEE_ICONS[g.iconKey]}</div>
                <div className="guarantee-title">{g.title}</div>
                <div className="guarantee-desc">{g.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════
   FOOTER
══════════════════════════════════════ */
function Footer() {
  const navigate = useNavigate();
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-grid">
          <div>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 16, display: 'block' }}>
              <img src={logo} alt="Kaam-ly" style={{ height: 36, filter: 'brightness(0) invert(0.45)' }} />
            </button>
            <p style={{ fontSize: 13, lineHeight: 1.8, color: 'rgba(255,255,255,0.3)', maxWidth: 240 }}>
              Connecting you with trusted local service professionals for all your home and business needs.
            </p>
          </div>

          <div>
            <div className="footer-col-title">Quick Links</div>
            {[
              { label: 'Find Services', fn: () => navigate('/login') },
              { label: 'For Workers', fn: () => navigate('/register-worker') },
              { label: 'How It Works', fn: () => document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' }) },
            ].map(l => <button key={l.label} className="footer-link" onClick={l.fn}>{l.label}</button>)}
          </div>

          <div>
            <div className="footer-col-title">Contact</div>
            {['kaamly7@gmail.com', '9812345672', 'Kathmandu, Nepal'].map((t, i) => (
              <div key={i} className="footer-contact-item">{t}</div>
            ))}
          </div>
        </div>

        <hr className="footer-hr" />
        <div className="footer-bottom">
          <p className="footer-copy">© 2026 Kaam-ly. All rights reserved.</p>
          <p className="footer-copy">Built with care in Kathmandu.</p>
        </div>
      </div>
    </footer>
  );
}

/* ══════════════════════════════════════
   ROOT
══════════════════════════════════════ */
export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <Hero />
      <CategoriesAndWorkers />
      <HowItWorks />
      <Guarantees />
      <Footer />
      <ChatWidget />
    </div>
  );
}

