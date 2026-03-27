import { useEffect, useState } from "react";
import { fetchCustomerById, fetchWorkerById, getTaskById } from "../api/api";
import { format, parseISO } from "date-fns";
import {
  MapPin, Clock, Calendar, DollarSign, Phone, Mail,
  Star, Briefcase, FileText, CheckCircle, ImageIcon,
  X, ChevronLeft, ChevronRight, AlertCircle, RefreshCw,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────── */
const C = {
  orange:      '#f6ad56',
  orangeDark:  '#e59a3d',
  orangeLight: '#fff5eb',
  orangeBorder:'#fde8c8',
  green:       '#10b981',
  greenLight:  '#f0fdf4',
  red:         '#ef4444',
  redLight:    '#fef2f2',
  blue:        '#3b82f6',
  blueLight:   '#eff6ff',
  purple:      '#8b5cf6',
  purpleLight: '#f5f3ff',
  text:        '#0f172a',
  textMid:     '#475569',
  textLight:   '#94a3b8',
  border:      '#e2e8f0',
  bg:          '#f8fafc',
  white:       '#ffffff',
  card:        '#ffffff',
};

/* ─────────────────────────────────────────────
   LIGHTBOX
───────────────────────────────────────────── */
const Lightbox = ({ images, startIndex, onClose }) => {
  const [current, setCurrent] = useState(startIndex);
  const list = Array.isArray(images) ? images : [images];
  const prev = () => setCurrent(i => (i - 1 + list.length) % list.length);
  const next = () => setCurrent(i => (i + 1) % list.length);

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape')      onClose();
      if (e.key === 'ArrowLeft')   prev();
      if (e.key === 'ArrowRight')  next();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <button onClick={onClose} style={lb.closeBtn}><X size={20} /></button>
      {list.length > 1 && <button onClick={prev} style={lb.navBtn('left')}><ChevronLeft size={22} /></button>}
      <div style={{ maxWidth: '90vw', maxHeight: '85vh', position: 'relative' }}>
        <img src={list[current]} alt={`img-${current}`} style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 14, objectFit: 'contain', boxShadow: '0 30px 70px rgba(0,0,0,0.5)' }} />
        {list.length > 1 && (
          <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
            {list.map((_, i) => (
              <div key={i} onClick={() => setCurrent(i)} style={{ width: i === current ? 20 : 8, height: 8, borderRadius: 99, cursor: 'pointer', background: i === current ? C.orange : 'rgba(255,255,255,0.4)', transition: 'all 0.2s' }} />
            ))}
          </div>
        )}
      </div>
      {list.length > 1 && <button onClick={next} style={lb.navBtn('right')}><ChevronRight size={22} /></button>}
    </div>
  );
};
const lb = {
  closeBtn: { position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' },
  navBtn: (side) => ({ position: 'absolute', [side]: 20, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 44, height: 44, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }),
};

/* ─────────────────────────────────────────────
   TASK IMAGES
───────────────────────────────────────────── */
const TaskImages = ({ taskImg }) => {
  const [lbIndex, setLbIndex] = useState(null);
  if (!taskImg) return null;
  const images = Array.isArray(taskImg) ? taskImg : [taskImg];
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <SectionLabel>Task Images</SectionLabel>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
          {images.map((src, i) => (
            <div key={i} onClick={() => setLbIndex(i)} style={{ width: 80, height: 80, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${C.border}`, flexShrink: 0, transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <img src={src} alt={`task-${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
        </div>
      </div>
      {lbIndex !== null && <Lightbox images={images} startIndex={lbIndex} onClose={() => setLbIndex(null)} />}
    </>
  );
};

/* ─────────────────────────────────────────────
   TIMELINE STEPPER
───────────────────────────────────────────── */
const TimelineStepper = ({ task }) => {
  const steps = [
    { key: 'booked',    label: 'Booked',    date: task?.createdAt,   statuses: ['pending','accepted','in_progress','inprogress','worker_done','completed'] },
    { key: 'accepted',  label: 'Accepted',  date: task?.serviceDate, statuses: ['accepted','in_progress','inprogress','worker_done','completed'] },
    { key: 'started',   label: 'Started',   date: task?.started_at,  statuses: ['in_progress','inprogress','worker_done','completed'] },
    { key: 'completed', label: 'Completed', date: task?.released_at, statuses: ['completed'] },
  ];

  const currentStatus = (task?.status ?? 'pending').toLowerCase().replace(/[_\s]/g, '');
  const doneCount = steps.filter(s =>
    s.statuses.map(s => s.replace(/[_\s]/g, '')).includes(currentStatus)
  ).length;

  // progress goes from first dot center to last dot center
  // each dot is 28px wide, spread evenly across 100%
  // segment width = 100% / (steps.length - 1)
  const progressPct = doneCount <= 1 ? 0 : ((doneCount - 1) / (steps.length - 1)) * 100;

  const fmt = (d) => {
    if (!d) return null;
    try { return format(parseISO(d), 'MMM d'); } catch { return null; }
  };

  const DOT = 28; // dot diameter px

  return (
    <div style={{ padding: '4px 0' }}>
      <SectionLabel>Timeline</SectionLabel>
      <div style={{ position: 'relative', padding: '14px 0 0' }}>

        {/* Track — spans between first and last dot centers */}
        <div style={{
          position: 'absolute',
          top: 14 + DOT / 2 - 1.5,           // vertically centered on dots
          left:  `calc(${100 / (steps.length - 1) / 2}%)`,   // center of first dot
          right: `calc(${100 / (steps.length - 1) / 2}%)`,   // center of last dot
          height: 3,
          background: C.border,
          borderRadius: 99,
        }} />

        {/* Progress fill */}
        <div style={{
          position: 'absolute',
          top: 14 + DOT / 2 - 1.5,
          left:  `calc(${100 / (steps.length - 1) / 2}%)`,
          width: `calc(${progressPct}% * ${(steps.length - 2) / (steps.length - 1)})`,
          height: 3,
          background: `linear-gradient(90deg, ${C.orange}, ${C.orangeDark})`,
          borderRadius: 99,
          transition: 'width 0.5s ease',
        }} />

        {/* Dots + labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
          {steps.map((step, i) => {
            const done   = step.statuses.map(s => s.replace(/[_\s]/g, '')).includes(currentStatus);
            const active = doneCount === i + 1;
            return (
              <div key={step.key} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 6, flex: 1,
              }}>
                <div style={{
                  width: DOT, height: DOT, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done
                    ? `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`
                    : C.white,
                  border: done ? 'none' : `2px solid ${active ? C.orange : C.border}`,
                  boxShadow: done || active ? `0 0 0 4px rgba(246,173,86,0.18)` : 'none',
                  transition: 'all 0.3s',
                }}>
                  {done
                    ? <CheckCircle size={15} color="white" strokeWidth={2.5} />
                    : <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? C.orange : C.border }} />
                  }
                </div>
                <span style={{
                  fontSize: 11, fontWeight: done || active ? 700 : 500,
                  color: done ? C.text : active ? C.orange : C.textLight,
                  whiteSpace: 'nowrap', textAlign: 'center',
                }}>
                  {step.label}
                </span>
                <span style={{
                  fontSize: 10, color: done ? C.textMid : C.border,
                  fontWeight: 500, minHeight: 14, textAlign: 'center',
                }}>
                  {fmt(step.date) ?? ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   BADGES
───────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const map = {
    pending:    { color: '#f59e0b', bg: '#fffbeb', label: 'Pending' },
    accepted:   { color: C.blue,   bg: C.blueLight,   label: 'Accepted' },
    inprogress: { color: C.purple, bg: C.purpleLight,  label: 'In Progress' },
    completed:  { color: C.green,  bg: C.greenLight,  label: 'Completed' },
    cancelled:  { color: C.red,    bg: C.redLight,    label: 'Cancelled' },
  };
  const s = map[status?.toLowerCase()] ?? map.pending;
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}33`, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {s.label}
    </span>
  );
};

const OfferStatusBadge = ({ offerStatus }) => {
  if (!offerStatus) return null;
  const map = {
    pending:  { color: '#f59e0b', bg: '#fffbeb',  label: 'Offer Pending' },
    accepted: { color: C.green,  bg: C.greenLight, label: 'Offer Accepted' },
    rejected: { color: C.red,    bg: C.redLight,   label: 'Offer Rejected' },
  };
  const s = map[offerStatus?.toLowerCase()] ?? map.pending;
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}33`, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {s.label}
    </span>
  );
};

/* ─────────────────────────────────────────────
   PERSON CARD
───────────────────────────────────────────── */
const PersonCard = ({ person, isWorker }) => {
  if (!person) return null;
  const firstName  = isWorker ? person.firstName  : person.first_name;
  const lastName   = isWorker ? person.lastName   : person.last_name;
  const phone      = person.phoneNo;
  const email      = person.email;
  const rating     = isWorker ? (person.ratings ?? 0) : 4;
  const reviewCount = isWorker ? (person.reviewCount ?? 0) : 0;
  const fullName   = `${firstName ?? ''} ${lastName ?? ''}`.trim() || 'Unknown';
  const initials   = `${firstName?.[0] ?? '?'}${lastName?.[0] ?? '?'}`.toUpperCase();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      background: C.white, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: '18px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      {/* Avatar */}
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontWeight: 700, fontSize: 20, flexShrink: 0,
        boxShadow: `0 4px 12px rgba(246,173,86,0.35)`,
      }}>{initials}</div>

      {/* Info */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>{fullName}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          {[1,2,3,4,5].map(star => (
            <Star key={star} size={14} fill={star <= Math.round(rating) ? '#FFB800' : 'none'} color="#FFB800" />
          ))}
          <span style={{ fontSize: 12.5, color: C.textMid, marginLeft: 4 }}>{rating} ({reviewCount} reviews)</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.textMid }}>
              <Phone size={13} color={C.orange} /> {phone}
            </div>
          )}
          {email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.textMid }}>
              <Mail size={13} color={C.orange} /> {email}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   PRICE BREAKDOWN
───────────────────────────────────────────── */
const PriceBreakdown = ({ task }) => {
  const hourlyRate     = task?.basePrice ?? 0;
  const estimatedHrs   = task?.estimatedHours ?? 0;
  const additionalCost = task?.additionalCost ?? 0;
  const baseCost       = hourlyRate * estimatedHrs;
  const totalCost      = task?.totalCost ?? (baseCost + additionalCost);

  return (
    <div style={{ marginTop: 16 }}>
      <SectionLabel>Price Breakdown</SectionLabel>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginTop: 8 }}>
        {[
          { label: 'Hourly Rate', value: `Rs. ${hourlyRate.toLocaleString()}/hr` },
          { label: 'Estimated Hours', value: `${estimatedHrs} hrs` },
          { label: `Base Cost (${estimatedHrs} × Rs. ${hourlyRate})`, value: `Rs. ${baseCost.toLocaleString()}` },
          ...(additionalCost > 0 ? [{ label: 'Additional Cost', value: `Rs. ${additionalCost.toLocaleString()}` }] : []),
        ].map((row, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 13.5, color: C.textMid }}>
            <span>{row.label}</span>
            <span style={{ fontWeight: 600, color: C.text }}>{row.value}</span>
          </div>
        ))}
        {/* Total row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 16px', background: C.orangeLight, fontSize: 14 }}>
          <span style={{ fontWeight: 700, color: C.text }}>Total Cost</span>
          <span style={{ fontWeight: 800, color: C.green, fontSize: 15 }}>Rs. {totalCost.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   PAYMENT INFO
───────────────────────────────────────────── */
const PaymentInfo = ({ task }) => {
  if (!task?.payment_status) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <SectionLabel>Payment</SectionLabel>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginTop: 8 }}>
        {[
          { label: 'Method', value: task.payment_method ?? 'N/A', accent: false },
          { label: 'Payment Status', value: task.payment_status, accent: task.payment_status === 'paid' ? C.green : '#f59e0b' },
          { label: 'Escrow Status', value: task.escrow_status ?? 'N/A', accent: task.escrow_status === 'released' ? C.green : '#f59e0b' },
        ].map((row, i, arr) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', fontSize: 13.5, color: C.textMid }}>
            <span>{row.label}</span>
            <span style={{ fontWeight: 700, color: row.accent || C.text, textTransform: 'capitalize' }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   DETAIL CARD (grid item)
───────────────────────────────────────────── */
const DetailCard = ({ icon: Icon, label, value }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    background: C.white, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: '13px 16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  }}>
    <div style={{ width: 36, height: 36, borderRadius: 10, background: C.orangeLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={17} color={C.orange} />
    </div>
    <div>
      <div style={{ fontSize: 11, color: C.textLight, fontWeight: 500, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{value}</div>
    </div>
  </div>
);

/* ─────────────────────────────────────────────
   SECTION HELPERS
───────────────────────────────────────────── */
const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
    {children}
  </div>
);

const Card = ({ children, style = {} }) => (
  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: 14, ...style }}>
    {children}
  </div>
);

/* ─────────────────────────────────────────────
   SKELETON
───────────────────────────────────────────── */
const Skeleton = ({ w = '100%', h = 16, r = 8 }) => (
  <div style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(90deg, #f1f5f9 25%, #e8edf2 50%, #f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
);
const TaskDetailsSkeleton = () => (
  <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
    <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    <Skeleton h={28} w="60%" />
    <Skeleton h={120} />
    <Skeleton h={80} />
    <Skeleton h={160} />
  </div>
);

/* ─────────────────────────────────────────────
   MAIN EXPORT
───────────────────────────────────────────── */
export function TaskDetails({ taskId }) {
  const [customer, setCustomer] = useState(null);
  const [worker,   setWorker]   = useState(null);
  const [taskData, setTaskData] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const storedUser  = localStorage.getItem('user') || sessionStorage.getItem('user');
  const currentUser = storedUser ? JSON.parse(storedUser) : null;
  console.log(currentUser);
  const role        = currentUser?.role ?? currentUser?.type ?? 'customer';
  console.log(role);

  useEffect(() => {
    const fetchData = async () => {
      if (!taskId) return;
      try {
        setLoading(true); setError(null);
        let fetchedTask = null;
        try { fetchedTask = await getTaskById(taskId); } catch {}
        setTaskData(fetchedTask);

        if (fetchedTask?.userId) {
          try { setCustomer(await fetchCustomerById(fetchedTask.userId)); } catch {}
        }
        if (fetchedTask?.assignedWorkerId) {
          try {
            const wr = await fetchWorkerById(fetchedTask.assignedWorkerId);
            setWorker(Array.isArray(wr) ? wr[0] : wr);
          } catch {}
        }
        if (!fetchedTask) setError('Failed to load task details.');
      } catch { setError('Failed to load task details. Please try again.'); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [taskId]);

  const formatDate = (d) => {
    if (!d) return 'Not available';
    try { return format(parseISO(d), 'EEEE - MMMM d, yyyy'); } catch { return d; }
  };

  if (!taskId) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textLight, fontSize: 15 }}>
      Loading task info...
    </div>
  );
  if (loading) return <TaskDetailsSkeleton />;
  if (error) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40, color: C.textMid }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.redLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AlertCircle size={26} color={C.red} />
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>Something went wrong</h3>
      <p style={{ fontSize: 14, margin: 0, textAlign: 'center' }}>{error}</p>
      <button onClick={() => window.location.reload()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: C.orange, color: 'white', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
        <RefreshCw size={15} /> Try Again
      </button>
    </div>
  );

  const taskShortId = (taskData?.id ?? taskData?._id ?? '').slice(-6) || 'N/A';

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #f6ad56; }
      `}</style>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 28px 32px' }}>

        {/* ── HEADER ── */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>
              {taskData?.taskName ?? 'Task Details'}
            </h1>
            <StatusBadge status={taskData?.status} />
            <OfferStatusBadge offerStatus={taskData?.offerStatus} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.textLight, fontSize: 13 }}>
            <span style={{ background: C.border, padding: '2px 8px', borderRadius: 6, fontWeight: 600, color: C.textMid }}>#{taskShortId}</span>
            <span>·</span>
            <Briefcase size={13} />
            <span style={{ textTransform: 'capitalize' }}>{taskData?.taskType ?? taskData?.selectedService ?? 'N/A'}</span>
          </div>
        </div>

        {/* ── TIMELINE ── */}
        <Card>
          <TimelineStepper task={taskData} />
        </Card>

        {/* ── PERSON CARD ── */}
        <div style={{ marginBottom: 14 }}>
          <SectionLabel>{role === 'worker' ? 'Customer' : 'Worker'}</SectionLabel>
          <PersonCard person={role === 'worker' ? customer : worker} isWorker={role !== 'worker'} />
        </div>

        {/* ── DETAILS ── */}
        <Card>
          <SectionLabel>Details</SectionLabel>

          {taskData?.taskDescrip && (
            <div style={{ background: C.bg, borderRadius: 10, padding: '11px 14px', marginBottom: 16, fontSize: 13.5, color: C.textMid, lineHeight: 1.6, border: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
              <FileText size={15} color={C.textLight} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{taskData.taskDescrip}</span>
            </div>
          )}

          <TaskImages taskImg={taskData?.taskImg} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
            <DetailCard icon={Calendar}    label="Date"      value={formatDate(taskData?.serviceDate)} />
            <DetailCard icon={Clock}       label="Time"      value={taskData?.serviceTime ?? 'N/A'} />
            <DetailCard icon={MapPin}      label="Location"  value={taskData?.address ?? 'N/A'} />
            <DetailCard icon={DollarSign}  label="Base Rate" value={`Rs. ${taskData?.basePrice ?? 'N/A'}/hr`} />
          </div>
        </Card>

        {/* ── PRICE BREAKDOWN ── */}
        <Card>
          <PriceBreakdown task={taskData} />
          <PaymentInfo task={taskData} />
        </Card>

        {/* ── NOTES ── */}
        {taskData?.note && (
          <Card>
            <SectionLabel>Notes</SectionLabel>
            <p style={{ fontSize: 13.5, color: C.textMid, lineHeight: 1.7, margin: 0 }}>
              {taskData.note}
            </p>
          </Card>
        )}

        {/* ── FOOTER ACTIONS ── */}
       {/* ── FOOTER ACTIONS ── */}
{(() => {
  const status = (taskData?.status ?? '').toLowerCase();
  const isPaid = (taskData?.payment_status ?? '').toLowerCase() === 'paid';

  // Worker actions
  if (role === 'worker') {
    return (
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
       {status === 'pending' && (
  <>
    {(taskData?.offerStatus ?? '').toLowerCase() === 'accepted' ? (
      <>
        <button style={{
          flex: 1, padding: '13px 0', borderRadius: 12,
          background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
          color: 'white', border: 'none', fontWeight: 700, fontSize: 14,
          cursor: 'pointer', boxShadow: `0 4px 14px rgba(246,173,86,0.4)`,
          transition: 'transform 0.12s, box-shadow 0.12s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          Accept Task
        </button>
        <button
  style={{
    flex: 1, padding: '13px 0', borderRadius: 12,
    background: C.redLight, color: C.red,
    border: `1.5px solid ${C.red}33`, fontWeight: 700, fontSize: 14,
    cursor: 'pointer',
  }}
>
  Reject Task
</button>
      </>
    ) : (
      <>
        <button
          onClick={() => alert('Please discuss the price with the customer first before accepting the task.')}
          style={{
            flex: 1, padding: '13px 0', borderRadius: 12,
            background: '#f1f5f9', color: '#b0bec5',
            border: `1.5px solid #e2e8f0`, fontWeight: 700, fontSize: 14,
            cursor: 'not-allowed', boxShadow: 'none',
          }}
        >
          Accept Task
        </button>
        <button
  style={{
    flex: 1, padding: '13px 0', borderRadius: 12,
    background: C.redLight, color: C.red,
    border: `1.5px solid ${C.red}33`, fontWeight: 700, fontSize: 14,
    cursor: 'pointer',
  }}
>
  Reject Task
</button>
      </>
    )}
  </>
)}
      </div>
    );
  }

  // Customer actions
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
      <button style={{
        flex: 1, padding: '13px 0', borderRadius: 12,
        background: C.white, color: C.textMid,
        border: `1.5px solid ${C.border}`, fontWeight: 600, fontSize: 14,
        cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = C.orange; e.currentTarget.style.color = C.orange; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMid; }}
      >
        Contact Support
      </button>
      {/* Cancel only if not yet paid */}
      {!['completed', 'cancelled'].includes(status) && (
        <button style={{
          flex: 1, padding: '13px 0', borderRadius: 12,
          background: C.redLight, color: C.red,
          border: `1.5px solid ${C.red}33`, fontWeight: 700, fontSize: 14,
          cursor: 'pointer',
        }}>
          Cancel Task
        </button>
      )}
    </div>
  );
})()}

      </div>
    </div>
  );
}