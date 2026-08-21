import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchCustomerById, createTask } from '../../api/api';
import { Camera, Upload } from "lucide-react";
import BookingNavbar from '../../components/Navbar/Navbar';
import Timer from '../../images/image.png';
import ChatWidget from '../../components/HelpSection/HelpSection'

// ── Toast System ──────────────────────────────────────────────────────────────
const TOAST_DURATION = 5000;

const toastIcons = {
  success: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-5" />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
  warning: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

const toastColors = {
  success: { bg: '#f0fdf4', border: '#86efac', icon: '#16a34a', title: '#14532d', text: '#166534', bar: '#22c55e' },
  error:   { bg: '#fef2f2', border: '#fca5a5', icon: '#dc2626', title: '#7f1d1d', text: '#991b1b', bar: '#ef4444' },
  info:    { bg: '#eff6ff', border: '#93c5fd', icon: '#2563eb', title: '#1e3a8a', text: '#1d4ed8', bar: '#3b82f6' },
  warning: { bg: '#fffbeb', border: '#fcd34d', icon: '#d97706', title: '#78350f', text: '#92400e', bar: '#f59e0b' },
};

const Toast = ({ id, type = 'info', title, message, onRemove, recipient }) => {
  const [visible, setVisible]   = useState(false);
  const [removing, setRemoving] = useState(false);
  const c = toastColors[type];

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => dismiss(), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setRemoving(true);
    setTimeout(() => onRemove(id), 350);
  };

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'relative', overflow: 'hidden',
        background: c.bg, border: `1px solid ${c.border}`,
        borderRadius: '14px', padding: '14px 16px 14px 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
        cursor: 'pointer', maxWidth: '380px', width: '100%',
        display: 'flex', gap: '12px', alignItems: 'flex-start',
        transform: visible && !removing ? 'translateX(0) scale(1)' : 'translateX(110%) scale(0.95)',
        opacity: visible && !removing ? 1 : 0,
        transition: removing
          ? 'transform 0.35s cubic-bezier(0.4,0,1,1), opacity 0.35s ease'
          : 'transform 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.4s ease',
        marginBottom: '10px',
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: c.bar, borderRadius: '14px 0 0 14px' }} />
      <div style={{ color: c.icon, flexShrink: 0, marginTop: '1px', marginLeft: '4px' }}>
        {toastIcons[type]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {recipient && (
          <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.icon, marginBottom: '3px', opacity: 0.8 }}>
            {recipient}
          </div>
        )}
        <div style={{ fontSize: '13px', fontWeight: '700', color: c.title, marginBottom: message ? '3px' : 0, lineHeight: '1.3' }}>
          {title}
        </div>
        {message && (
          <div style={{ fontSize: '12px', color: c.text, lineHeight: '1.5' }}>
            {message}
          </div>
        )}
      </div>
      <button
        onClick={e => { e.stopPropagation(); dismiss(); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.icon, opacity: 0.6, padding: '0', marginTop: '-2px', flexShrink: 0, lineHeight: 1 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <div style={{
        position: 'absolute', bottom: 0, left: 0,
        height: '3px', background: c.bar, opacity: 0.4,
        borderRadius: '0 0 14px 14px',
        animation: `toastProgress ${TOAST_DURATION}ms linear forwards`,
      }} />
    </div>
  );
};

const ToastContainer = ({ toasts, removeToast }) => (
  <>
    <style>{`
      @keyframes toastProgress {
        from { width: 100%; }
        to   { width: 0%; }
      }
    `}</style>
    <div style={{
      position: 'fixed', top: '80px', right: '20px',
      zIndex: 9999, display: 'flex', flexDirection: 'column',
      alignItems: 'flex-end', pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'all', width: '380px' }}>
          <Toast {...t} onRemove={removeToast} />
        </div>
      ))}
    </div>
  </>
);

const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((opts) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, ...opts }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
};

// ── Validation ────────────────────────────────────────────────────────────────
const validate = (booking, task, terms) => {
  const errs = {};

  if (!(task.taskType || '').trim())
    errs.taskType = 'Task type is required.';
  else if ((task.taskType || '').trim().length < 3)
    errs.taskType = 'Task type must be at least 3 characters.';

  if (!(task.taskName || '').trim())
    errs.taskName = 'Description is required.';
  else if ((task.taskName || '').trim().length < 5)
    errs.taskName = 'Description must be at least 5 characters.';
  if (!(task.address || '').trim())
    errs.address = 'Address is required.';
  else if ((task.address || '').trim().length < 10)
    errs.address = 'Please enter a more complete address (min 10 characters).';

  if (!booking.date) {
    errs.date = 'Please select a date.';
  } else {
    const selected = new Date(booking.date);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    if (selected < tomorrow) errs.date = 'Please select a future date (minimum tomorrow).';
  }

  if (!booking.time) errs.time = 'Please select a start time.';

  if (!(booking.customerName || '').trim())
    errs.customerName = 'Full name is required.';
  else if ((booking.customerName || '').trim().length < 3)
    errs.customerName = 'Name must be at least 3 characters.';
  else if (!/^[a-zA-Z\s'-]+$/.test((booking.customerName || '').trim()))
    errs.customerName = 'Name can only contain letters, spaces, hyphens, or apostrophes.';

  const phone = (booking.phone || '').trim();
  if (!phone)
    errs.phone = 'Phone number is required.';
  else if (!/^[9][6-9]\d{8}$/.test(phone))
    errs.phone = 'Enter a valid Nepal number starting with 96–99 (10 digits).';

  const email = (booking.email || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errs.email = 'Enter a valid email address.';

  if (!terms) errs.terms = 'You must accept the terms to proceed.';

  return errs;
};

const FieldError = ({ errors, touched, submitted, field }) =>
  (touched[field] || submitted) && errors[field] ? (
    <span style={styles.errorMsg}>{errors[field]}</span>
  ) : null;

const inputStyle = (field, errors, touched, submitted, base = 'input') => {
  const hasError = (touched[field] || submitted) && errors[field];
  return hasError ? styles[`${base}Error`] : styles[base];
};

// ── Cancel Task Modal ─────────────────────────────────────────────────────────
const CancelTaskModal = ({ task, onClose, onSubmit }) => {
  const [reason, setReason]             = useState("");
  const [photo, setPhoto]               = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState(null);

  const taskIsPaid       = task.paymentStatus === "paid";
  const taskDatetime     = task.serviceDate ? new Date(`${task.serviceDate.split("T")[0]}T${task.serviceTime || "00:00"}`) : null;
  const hoursLeft        = taskDatetime ? (taskDatetime - Date.now()) / 3600000 : null;
  const penaltyWillApply = taskIsPaid && hoursLeft !== null && hoursLeft < 4;
  const totalCost        = task.totalCost || 0;

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Photo must be under 5 MB."); return; }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!reason.trim()) { setError("Please provide a reason."); return; }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(reason, photo);
    } catch (err) {
      setError(err.message || "Failed to cancel task");
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        style={{ background: "white", borderRadius: "20px", padding: "1.8rem", maxWidth: "420px", width: "90%", boxShadow: "0 24px 60px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "800", margin: 0, color: "#1c1008" }}>Cancel Task</h2>
          <button onClick={onClose} style={{ background: "#f5efe6", border: "none", width: "30px", height: "30px", borderRadius: "50%", cursor: "pointer", color: "#78716c", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        {penaltyWillApply && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px", padding: "12px 14px", marginBottom: "14px" }}>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#991b1b" }}>⚠️ Cancellation Fee Applies</p>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#7f1d1d", lineHeight: "1.55" }}>
              A <strong>25% penalty (NPR {(totalCost * 0.25).toFixed(2)})</strong> applies. Refund: <strong>NPR {(totalCost * 0.75).toFixed(2)}</strong>.
            </p>
          </div>
        )}

        {taskIsPaid && !penaltyWillApply && (
          <div style={{ background: "#f0fdf4", border: "1px solid #a7f3d0", borderRadius: "12px", padding: "12px 14px", marginBottom: "14px" }}>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#065f46" }}>✅ Full Refund</p>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#064e3b", lineHeight: "1.55" }}>Full refund of <strong>NPR {totalCost.toFixed(2)}</strong> will be processed.</p>
          </div>
        )}

        <p style={{ fontSize: "11px", fontWeight: "700", color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Reason</p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder="Describe why you're cancelling…"
          style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1.5px solid #e8dfd0", fontSize: "13px", outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", marginBottom: "14px", transition: "border-color 0.2s" }}
          onFocus={e => e.target.style.borderColor = "#f6a623"}
          onBlur={e => e.target.style.borderColor = "#e8dfd0"}
        />

        <p style={{ fontSize: "11px", fontWeight: "700", color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
          Photo <span style={{ fontWeight: "400", textTransform: "none" }}>(optional)</span>
        </p>

        {photoPreview ? (
          <div style={{ position: "relative", marginBottom: "12px" }}>
            <img src={photoPreview} alt="evidence" style={{ width: "100%", maxHeight: "130px", objectFit: "cover", borderRadius: "10px", border: "1px solid #e8dfd0" }} />
            <button
              onClick={() => { setPhoto(null); setPhotoPreview(null); }}
              style={{ position: "absolute", top: "6px", right: "6px", background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%", width: "22px", height: "22px", cursor: "pointer", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}
            >×</button>
          </div>
        ) : (
          <label
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px", padding: "16px 12px", borderRadius: "10px", border: "1.5px dashed #e8dfd0", cursor: "pointer", marginBottom: "12px", fontSize: "12px", color: "#a8a29e", textAlign: "center", transition: "border-color 0.2s", boxSizing: "border-box", width: "100%" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#f6a623"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "#e8dfd0"}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M3 16v3a2 2 0 002 2h14a2 2 0 002-2v-3M12 3v13M8 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Upload photo
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
          </label>
        )}

        {error && <p style={{ color: "#dc2626", fontSize: "12px", marginBottom: "10px" }}>{error}</p>}

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1.5px solid #e8dfd0", background: "white", cursor: "pointer", fontSize: "13px", fontWeight: "600", color: "#78716c" }}
          >
            Keep Task
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ flex: 2, padding: "10px", borderRadius: "10px", border: "none", background: penaltyWillApply ? "linear-gradient(135deg,#dc2626,#b91c1c)" : "#dc2626", color: "white", fontWeight: "700", cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1, fontSize: "13px" }}
          >
            {submitting ? "Cancelling…" : penaltyWillApply ? `Cancel (NPR ${(totalCost * 0.25).toFixed(2)} fee)` : "Confirm Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── All available time slots ──────────────────────────────────────────────────
const ALL_TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

// ── Main Component ────────────────────────────────────────────────────────────
const TaskDescriptionPage = ({ worker }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const { toasts, addToast, removeToast } = useToast();

  const storedTaskRequest = localStorage.getItem('pendingTaskRequest');
  const taskDetails       = storedTaskRequest ? JSON.parse(storedTaskRequest) : {};

  const storedWorker   = localStorage.getItem('selectedWorker');
  const selectedTasker =
    worker ||
    location.state ||
    (storedWorker ? JSON.parse(storedWorker) : null);

  const rawUser      = localStorage.getItem('user') || sessionStorage.getItem('user') || '{}';
  const user         = JSON.parse(rawUser);
  const userId       = user.id || user._id;
  const userFullName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim();
  const userPhone    = user.phoneNo || '';
  const userEmail    = user.email   || '';

  const [bookingDetails, setBookingDetails] = useState({
    date:         '',
    time:         '',
    customerName: userFullName,
    phone:        userPhone,
    email:        userEmail,
  });

  const [editableTask, setEditableTask] = useState({
    taskType: selectedTasker?.taskType?.predicted_label 
              || taskDetails.taskType 
              || selectedTasker?.taskType 
              || '',
    taskName: taskDetails.taskName || '',
    address:  taskDetails.address  || '',
  });

  const [acceptTerms,    setAcceptTerms]    = useState(false);
  const [bookingStatus,  setBookingStatus]  = useState('form');
  const [photos,         setPhotos]         = useState([]);
  const [note,           setNote]           = useState('');
  const [errors,         setErrors]         = useState({});
  const [touched,        setTouched]        = useState({});
  const [submitted,      setSubmitted]      = useState(false);
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [cancelTaskData, setCancelTaskData] = useState(null);
  const [createdTaskId,  setCreatedTaskId]  = useState(null);

  // ── SLOTS STATE ─────────────────────────────────────────────────────────────
  const [slotsCache,   setSlotsCache]   = useState({});
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError,   setSlotsError]   = useState(null);

  const noWorker = !selectedTasker;
  console.log(selectedTasker);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  const maxDateObj = new Date();
  maxDateObj.setMonth(maxDateObj.getMonth() + 3);
  const maxDate = maxDateObj.toISOString().split('T')[0];

  useEffect(() => {
    return () => localStorage.removeItem('pendingTaskRequest');
  }, []);

  useEffect(() => {
    if (!userId) return;
    const fetchCustomer = async () => {
      try {
        const c = await fetchCustomerById(userId);
        setBookingDetails(prev => ({
          ...prev,
          customerName: prev.customerName || `${c.first_name || ''} ${c.last_name || ''}`.trim(),
          phone:        prev.phone        || c.phoneNo || '',
          email:        prev.email        || c.email   || '',
        }));
      } catch (err) {
        console.error('Failed to fetch customer:', err);
      }
    };
    fetchCustomer();
  }, [userId]);

  useEffect(() => {
    if (submitted) setErrors(validate(bookingDetails, editableTask, acceptTerms));
  }, [bookingDetails, editableTask, acceptTerms, submitted]);

  // ── FETCH FREE SLOTS FOR A SPECIFIC DATE (lazy, with cache) ─────────────────
  const fetchSlotsForDate = async (date) => {
    if (slotsCache[date] !== undefined) return slotsCache[date];

    setSlotsLoading(true);
    setSlotsError(null);

    try {
      const workerId = encodeURIComponent(
        selectedTasker.id || selectedTasker._id || selectedTasker.email
      );
      const res = await fetch(
        `http://127.0.0.1:8000/api/worker/free-slots/${workerId}/${date}`
      );
      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const data  = await res.json();
      const slots = data.freeSlots || [];

      setSlotsCache(prev => ({ ...prev, [date]: slots }));
      return slots;
    } catch (err) {
      console.error('Failed to fetch slots for', date, err);
      setSlotsError('Could not load availability. Showing all slots.');
      setSlotsCache(prev => ({ ...prev, [date]: null }));
      return null;
    } finally {
      setSlotsLoading(false);
    }
  };

  const getSlotsForDate = (date) => {
    if (!date) return undefined;
    return slotsCache[date];
  };

  const isTimeAvailable = (date, time) => {
    if (!date || !time) return false;
    const slots = getSlotsForDate(date);
    if (slots === undefined || slots === null) return true;
    if (slots.length === 0) return false;
    return slots.some(slot => time >= slot.start && time < slot.end);
  };

  const getAvailableTimesForDate = (date) => {
    if (!date) return [];
    const slots = getSlotsForDate(date);
    if (slots === undefined || slots === null) return ALL_TIME_SLOTS;
    return ALL_TIME_SLOTS.filter(t => slots.some(s => t >= s.start && t < s.end));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setBookingDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleTaskChange = (e) => {
    const { name, value } = e.target;
    setEditableTask(prev => ({ ...prev, [name]: value }));
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
  };

  const handleDateChange = async (e) => {
    const date = e.target.value;

    setBookingDetails(prev => ({ ...prev, date, time: '' }));
    setTouched(prev => ({ ...prev, date: true }));
    setSlotsError(null);

    if (!date || !selectedTasker) return;

    const slots = await fetchSlotsForDate(date);

    if (slots === null) {
      addToast({
        type: 'warning',
        title: 'Availability Unknown',
        message: 'Could not load slot data. All times are shown — please confirm with the worker.',
      });
      return;
    }

    if (slots.length === 0) {
      addToast({
        type: 'error',
        title: 'Worker Unavailable',
        message: `${selectedTasker?.name || 'The worker'} has no free slots on this date. Please choose another day.`,
      });
      return;
    }

   
  };

  const handleTimeChange = (e) => {
    const time = e.target.value;

    if (!bookingDetails.date) {
      addToast({ type: 'warning', title: 'Select a Date First', message: 'Please choose a date before selecting a time.' });
      return;
    }

    if (!isTimeAvailable(bookingDetails.date, time)) {
      addToast({
        type: 'error',
        title: 'Slot Unavailable',
        message: `${selectedTasker?.name || 'The worker'} is not available at this time. Please pick another slot.`,
      });
      return;
    }

    setBookingDetails(prev => ({ ...prev, time }));
    setTouched(prev => ({ ...prev, time: true }));
  };

  const handlePhotoUpload = (e) => {
    const files     = Array.from(e.target.files);
    const remaining = 5 - photos.length;
    if (remaining <= 0) { addToast({ type: 'warning', title: 'Photo Limit', message: 'Maximum 5 photos allowed.' }); return; }
    const validFiles = files.filter(f => {
      if (!f.type.startsWith('image/')) { addToast({ type: 'error', title: 'Invalid File', message: `${f.name} is not an image.` }); return false; }
      if (f.size > 5 * 1024 * 1024)    { addToast({ type: 'error', title: 'File Too Large', message: `${f.name} exceeds 5MB limit.` }); return false; }
      return true;
    });
    setPhotos(prev => [...prev, ...validFiles.slice(0, remaining)]);
  };

  const calculateTotal = () => {
    const rate        = Number(selectedTasker?.hourlyRate) || 0;
    const hours       = Number(selectedTasker?.minHours)   || 1;
    const subtotal    = rate * hours;
    const platformFee = subtotal * 0.05;
    return { subtotal, platformFee, total: subtotal + platformFee };
  };
  const totals = calculateTotal();

  const formatTime = (time) => {
    if (!time) return '';
    const hour = parseInt(time.split(':')[0]);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12 || 12}:00 ${ampm}`;
  };

  // ── cancelTask ────────────────────────────────────────────────────────────
  const cancelTask = async (_taskId, reason, photo) => {
    const taskType   = editableTask.taskType || 'task';
    const workerName = selectedTasker?.name  || 'Worker';
    const totalCost  = cancelTaskData?.totalCost || 0;

    const taskDatetime     = cancelTaskData?.serviceDate
      ? new Date(`${cancelTaskData.serviceDate.split("T")[0]}T${cancelTaskData.serviceTime || "00:00"}`)
      : null;
    const hoursLeft        = taskDatetime ? (taskDatetime - Date.now()) / 3600000 : null;
    const taskIsPaid       = cancelTaskData?.paymentStatus === 'paid';
    const penaltyWillApply = taskIsPaid && hoursLeft !== null && hoursLeft < 4;
    const currentUserString = localStorage.getItem('user') || sessionStorage.getItem('user');
    const currentUser = currentUserString ? JSON.parse(currentUserString) : null;

    const userId = currentUser?.id || currentUser?._id;
    console.log(userId);
    try {
      const payload = {
        status: 'cancelled',
        reason: reason,
        cancelled_by: userId,
      };

      const res = await fetch(`http://127.0.0.1:8000/api/task/${_taskId}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);

    } catch (err) {
      console.error('Cancel failed:', err);
      addToast({
        type: 'error',
        title: 'Cancellation Failed',
        message: 'Could not cancel the task. Please try again.',
      });
      return;
    }

    setCancelTaskData(null);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const allTouched = {
      taskType: true, taskName: true, address: true,
      date: true, time: true,
      customerName: true, phone: true, email: true, terms: true,
    };
    setTouched(allTouched);
    setSubmitted(true);

    const validationErrors = validate(bookingDetails, editableTask, acceptTerms);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      const firstField = Object.keys(validationErrors)[0];
      const el = document.querySelector(`[name="${firstField}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!isTimeAvailable(bookingDetails.date, bookingDetails.time)) {
      addToast({
        type: 'error',
        title: 'Slot No Longer Available',
        message: 'This time slot was just taken. Please select another time.',
      });
      setErrors(prev => ({ ...prev, time: 'This slot is no longer available.' }));
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('taskName',        editableTask.taskName || '');
      formData.append('taskType',        editableTask.taskType || '');
      formData.append('taskDescrip',     note || editableTask.taskName || '');
      formData.append('estimatedPrice',  '');
      formData.append('selectedService', editableTask.taskType || '');
      formData.append('address',         editableTask.address || '');
      formData.append('lat',             taskDetails.lat?.toString() || '');
      formData.append('lng',             taskDetails.lng?.toString() || '');
      formData.append('userId',          userId?.toString() || '');
      formData.append('assignedWorker',  selectedTasker.id || selectedTasker._id || selectedTasker.email || '');
      formData.append('serviceDate',     bookingDetails.date || '');
      formData.append('serviceTime',     bookingDetails.time || '');
      formData.append('note',            note || '');
      photos.forEach((photo, i) => formData.append(`taskImg`, photo));

      // ✅ Create task and capture the ID
      const createdTask = await createTask(formData);
      
      // ✅ Debug logging to see the response structure
      console.log('Created task response:', createdTask);
      
      // ✅ Try multiple possible paths for the ID
      const taskId = createdTask?.taskId 
        || createdTask?.id 
        || createdTask?.data?._id 
        || createdTask?.data?.id
        || createdTask?.task?._id
        || createdTask?.task?.id;

      
      console.log('Extracted task ID:', taskId);

      if (!taskId) {
        console.error('Failed to extract task ID from response:', createdTask);
        addToast({
          type: 'warning',
          title: 'Warning',
          message: 'Booking created but cancellation may not work. Please refresh if needed.',
        });
      }

      // Store the task ID
      setCreatedTaskId(taskId);

      // Also store it in localStorage as a backup
      if (taskId) {
        localStorage.setItem('lastCreatedTaskId', taskId);
      }

      // Change status to pending
      setBookingStatus('pending');
      
    } catch (err) {
      console.error(err);
      addToast({
        type: 'error',
        title: 'Booking Failed',
        message: err.message || 'Something went wrong. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (noWorker) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ color: '#ef4444' }}>No worker selected</h2>
      <p style={{ color: '#666', fontSize: 14 }}>Please go back and select a worker first.</p>
      <button onClick={() => navigate(-1)} style={{ padding: '10px 24px', background: '#f6ad56', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Go Back</button>
    </div>
  );

  // ── Schedule Section ──────────────────────────────────────────────────────
  const renderScheduleSection = () => {
    const cachedSlots    = getSlotsForDate(bookingDetails.date);
    const dateHasNoSlots = bookingDetails.date && !slotsLoading && Array.isArray(cachedSlots) && cachedSlots.length === 0;
    const availableTimes = getAvailableTimesForDate(bookingDetails.date);
    const slotsReady     = bookingDetails.date && !slotsLoading && Array.isArray(cachedSlots) && cachedSlots.length > 0;

    return (
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Schedule</h3>

        {slotsLoading && (
          <div style={styles.slotsLoadingBanner}>
            <span style={styles.slotsLoadingDot} />
            Checking worker availability…
          </div>
        )}
        {slotsError && (
          <div style={styles.slotsWarningBanner}>
            ⚠️ {slotsError}
          </div>
        )}

        <div style={{ ...styles.formRow, gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {/* DATE */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Date *</label>
            <input
              type="date"
              name="date"
              value={bookingDetails.date}
              onChange={handleDateChange}
              onBlur={handleBlur}
              min={minDate}
              max={maxDate}
              style={{
                ...inputStyle('date', errors, touched, submitted),
                ...(dateHasNoSlots ? { borderColor: '#ef4444', background: '#fff8f8' } : {}),
              }}
            />
            {dateHasNoSlots && (
              <span style={{ ...styles.errorMsg, color: '#ef4444' }}>
                Worker unavailable on this date. Please choose another.
              </span>
            )}
            <FieldError field="date" errors={errors} touched={touched} submitted={submitted} />
          </div>

          {/* TIME */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Start Time *
              {slotsReady && availableTimes.length > 0 && (
                <span style={styles.availableBadge}>
                  {availableTimes.length} available
                </span>
              )}
            </label>
            <select
              name="time"
              value={bookingDetails.time}
              onChange={handleTimeChange}
              onBlur={handleBlur}
              disabled={!bookingDetails.date || slotsLoading || dateHasNoSlots}
              style={{
                ...inputStyle('time', errors, touched, submitted),
                opacity: (!bookingDetails.date || slotsLoading || dateHasNoSlots) ? 0.5 : 1,
                cursor:  (!bookingDetails.date || slotsLoading || dateHasNoSlots) ? 'not-allowed' : 'pointer',
              }}
            >
              <option value="">
                {!bookingDetails.date
                  ? 'Select a date first'
                  : slotsLoading
                    ? 'Loading availability…'
                    : dateHasNoSlots
                      ? 'No slots available'
                      : 'Select time'}
              </option>

              {!slotsLoading && !dateHasNoSlots && ALL_TIME_SLOTS.map(t => {
                const available = isTimeAvailable(bookingDetails.date, t);
                return (
                  <option
                    key={t}
                    value={t}
                    disabled={!available}
                    style={{ color: available ? '#1a1a1a' : '#bbb', fontWeight: available ? '500' : '400' }}
                  >
                    {formatTime(t)}{available ? '' : ' — Unavailable'}
                  </option>
                );
              })}
            </select>
            <FieldError field="time" errors={errors} touched={touched} submitted={submitted} />

            {/* Slot chip buttons */}
            {bookingDetails.date && !slotsLoading && !dateHasNoSlots && (
              <div style={styles.slotChipsWrap}>
                {ALL_TIME_SLOTS.map(t => {
                  const available = isTimeAvailable(bookingDetails.date, t);
                  const selected  = bookingDetails.time === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={!available}
                      onClick={() => {
                        if (!available) {
                          addToast({
                            type: 'error',
                            title: 'Slot Unavailable',
                            message: `${selectedTasker?.name || 'Worker'} is not free at ${formatTime(t)}.`,
                          });
                          return;
                        }
                        setBookingDetails(prev => ({ ...prev, time: t }));
                        setTouched(prev => ({ ...prev, time: true }));
                      }}
                      style={{
                        ...styles.slotChip,
                        ...(selected               ? styles.slotChipSelected    : {}),
                        ...(available && !selected ? styles.slotChipAvailable   : {}),
                        ...(!available             ? styles.slotChipUnavailable : {}),
                      }}
                    >
                      {formatTime(t)}
                    </button>
                  );
                })}
              </div>
            )}

            {slotsReady && availableTimes.length === 0 && (
              <p style={styles.noSlotsMsg}>No standard hourly slots fit the worker's availability today.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderForm = () => (
    <>
      <div style={styles.formHeader}>
        <h1 style={styles.formTitle}>Confirm Your Booking</h1>
        <p style={styles.formSubtitle}>
          Complete the details below to book <strong>{selectedTasker.name}</strong>
        </p>
      </div>

      {/* Tasker Summary */}
      <div style={styles.taskerSummary}>
        <div style={styles.taskerAvatar}>
  {selectedTasker.profilePhoto ? (
    <img 
      src={selectedTasker.profilePhoto} 
      alt={selectedTasker.name}
      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
    />
  ) : (
    selectedTasker.name?.charAt(0) || 'W'
  )}
</div>
        <div style={styles.taskerInfo}>
          <h3 style={styles.taskerName}>{selectedTasker.name}</h3>
          <div style={styles.taskerMeta}>
            <span style={styles.rating}>★ {selectedTasker.rating ?? selectedTasker.ratings ?? 0}</span>
            <span style={styles.reviews}>
              ({selectedTasker.reviews ?? selectedTasker.noOfCompletedTask ?? 0} reviews)
            </span>
            {selectedTasker.isElite && <span style={styles.eliteBadge}>ELITE</span>}
          </div>
          <div style={styles.taskerRate}>
            NPR {selectedTasker.hourlyRate || '—'}/hour • {selectedTasker.minHours || 1} hour minimum
          </div>
          <p style={styles.taskerDescription}>{selectedTasker.description}</p>
        </div>
      </div>

      {/* Task Details */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Task Details</h3>
        <div style={styles.taskRow}>
          <div style={styles.taskGroup}>
            <label style={styles.label}>Task Type *</label>
            <input
              name="taskType"
              value={editableTask.taskType}
              onChange={handleTaskChange}
              onBlur={handleBlur}
              placeholder="e.g. Plumbing, Cleaning..."
              style={inputStyle('taskType', errors, touched, submitted)}
            />
            <FieldError field="taskType" errors={errors} touched={touched} submitted={submitted} />
          </div>
          <div style={styles.taskGroup}>
            <label style={styles.label}>Description</label>
            <input
              name="taskName"
              value={editableTask.taskName}
              onChange={handleTaskChange}
              onBlur={handleBlur}
              placeholder="Brief description of the task"
              style={inputStyle('taskName', errors, touched, submitted)}
            />
            <FieldError field="taskName" errors={errors} touched={touched} submitted={submitted} />
          </div>
        </div>
        <div style={styles.detailRow}>
          <label style={styles.label}>Location *</label>
          <input
            name="address"
            value={editableTask.address}
            onChange={handleTaskChange}
            onBlur={handleBlur}
            placeholder="Enter your full address (street, city)"
            style={inputStyle('address', errors, touched, submitted, 'address')}
          />
          <FieldError field="address" errors={errors} touched={touched} submitted={submitted} />
        </div>
      </div>

      {/* Photos */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          Add Photos{' '}
          <span style={{ fontWeight: 400, fontSize: 14, color: '#9ca3af' }}>(optional — max 5, 5MB each)</span>
        </h3>
        <div style={styles.photoOptions}>
         
          <label style={{ ...styles.photoOption, opacity: photos.length >= 5 ? 0.5 : 1, cursor: photos.length >= 5 ? 'not-allowed' : 'pointer' }}>
            <input type="file" accept="image/*" multiple
              onChange={handlePhotoUpload} style={styles.hiddenInput}
              disabled={photos.length >= 5} />
            <Upload size={24} />
            <span>Upload Photos {photos.length > 0 && `(${photos.length}/5)`}</span>
          </label>
        </div>
        {photos.length > 0 && (
          <div style={styles.uploadedPhotos}>
            <h4 style={styles.photoCount}>Uploaded ({photos.length}/5)</h4>
            <div style={styles.photoGrid}>
              {photos.map((photo, i) => (
                <div key={i} style={styles.photoItem}>
                  <img src={URL.createObjectURL(photo)} alt={`Upload ${i + 1}`} style={styles.photoPreview} />
                  <button style={styles.removePhoto}
                    onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Schedule */}
      {renderScheduleSection()}

      {/* Contact */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Contact Information</h3>
        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Full Name *</label>
            <input
              type="text" name="customerName"
              value={bookingDetails.customerName}
              onChange={handleChange} onBlur={handleBlur}
              placeholder="Enter your full name"
              style={inputStyle('customerName', errors, touched, submitted)}
            />
            <FieldError field="customerName" errors={errors} touched={touched} submitted={submitted} />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Phone Number *</label>
            <input
              type="tel" name="phone"
              value={bookingDetails.phone}
              onChange={handleChange} onBlur={handleBlur}
              placeholder="98XXXXXXXX"
              maxLength={10}
              style={inputStyle('phone', errors, touched, submitted)}
            />
            <FieldError field="phone" errors={errors} touched={touched} submitted={submitted} />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Email{' '}
              <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="email" name="email"
              value={bookingDetails.email}
              onChange={handleChange} onBlur={handleBlur}
              placeholder="you@example.com"
              style={inputStyle('email', errors, touched, submitted)}
            />
            <FieldError field="email" errors={errors} touched={touched} submitted={submitted} />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div style={styles.section}>
        <label style={styles.label}>
          Additional Notes{' '}
          <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          style={{ ...styles.textarea, borderColor: note.length > 500 ? '#ef4444' : '#e0e0e0' }}
          placeholder="Add any special instructions or details..."
          value={note}
          onChange={e => setNote(e.target.value)}
          maxLength={600}
        />
        <span style={{ fontSize: 12, color: note.length > 500 ? '#ef4444' : '#9ca3af', display: 'block', textAlign: 'right' }}>
          {note.length}/500 characters
        </span>
        {note.length > 500 && (
          <span style={styles.errorMsg}>Notes cannot exceed 500 characters.</span>
        )}
      </div>

      {/* Terms */}
      <div style={styles.section}>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={e => {
              setAcceptTerms(e.target.checked);
              setTouched(p => ({ ...p, terms: true }));
            }}
            style={styles.checkbox}
          />
          <span style={styles.checkboxText}>
            I agree to pay the final amount as <strong>agreed with the worker</strong> and accept the{' '}
           <span
  style={{ color: '#f6ad56', textDecoration: 'underline', cursor: 'pointer' }}
  onClick={(e) => {
    e.preventDefault();
    navigate('/terms');
  }}
>
  terms and conditions
</span>
          </span>
        </label>
        <FieldError field="terms" errors={errors} touched={touched} submitted={submitted} />
      </div>

      {/* Actions */}
      <div style={styles.buttonGroup}>
        <button type="button" style={styles.cancelButton} onClick={() => navigate(-1)}>
          Cancel
        </button>
        <button
          type="submit"
          style={{ ...styles.submitButton, opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Confirm Booking'}
        </button>
      </div>
    </>
  );

  const renderContent = () => {
    switch (bookingStatus) {
      case 'pending':
        return (
          <div style={styles.statusContainer}>
            <div style={styles.pendingIcon}><img src={Timer} alt="Timer" width={90} /></div>
            <h2 style={styles.statusTitle}>Waiting for {selectedTasker.name}</h2>
            <p style={styles.statusMessage}>
              We've sent your booking request to <strong>{selectedTasker.name}</strong>.
              They usually respond within a few minutes.
            </p>
            <div style={styles.bookingDetailsSummary}>
              <h4 style={styles.summaryHeading}>Your Booking Details</h4>
              <div style={styles.detailGrid}>
                {[
                  { label: 'Task Type', value: editableTask.taskType || 'N/A' },
                  { label: 'Date',      value: bookingDetails.date },
                  { label: 'Time',      value: formatTime(bookingDetails.time) },
                  { label: 'Location',  value: editableTask.address || 'N/A' },
                ].map(({ label, value }) => (
                  <div key={label} style={styles.detailItem}>
                    <span style={styles.detailLabel}>{label}:</span>
                    <span style={styles.detailValue}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={styles.actionButtons}>
              <button
                style={styles.cancelRequestButton}
                onClick={() => {
                  // ✅ Check if we have a task ID before allowing cancel
                  if (!createdTaskId) {
                    addToast({
                      type: 'error',
                      title: 'Cannot Cancel',
                      message: 'Task ID not found. Please refresh the page and try again.',
                    });
                    return;
                  }
                  
                  setCancelTaskData({
                    _id:           createdTaskId,
                    paymentStatus: 'unpaid',
                    serviceDate:   bookingDetails.date,
                    serviceTime:   bookingDetails.time,
                    totalCost:     totals.total,
                  });
                }}
              >
                Cancel Request
              </button>
              <button style={styles.secondaryButton} onClick={() => navigate(`/tasks/user/${userId}`)}>
                View My Bookings
              </button>
            </div>
          </div>
        );

      case 'confirmed':
        return (
          <div style={styles.statusContainer}>
            <div style={styles.successIcon}>✓</div>
            <h2 style={styles.statusTitle}>Booking Confirmed!</h2>
            <p style={styles.statusMessage}>
              <strong>{selectedTasker.name}</strong> has accepted your request.
            </p>
            <div style={styles.actionButtons}>
              <button style={styles.primaryButton} onClick={() => navigate(`/tasks/user/${userId}`)}>
                View My Bookings
              </button>
            </div>
          </div>
        );

      case 'declined':
        return (
          <div style={styles.statusContainer}>
            <div style={styles.errorIcon}>✕</div>
            <h2 style={styles.statusTitle}>Booking Not Available</h2>
            <p style={styles.statusMessage}>
              <strong>{selectedTasker.name}</strong> is not available for your requested time.
            </p>
            <div style={styles.actionButtons}>
              <button style={styles.secondaryButton} onClick={() => setBookingStatus('form')}>Try Again</button>
              <button style={styles.primaryButton} onClick={() => navigate(-1)}>Find Another Tasker</button>
            </div>
          </div>
        );

      default:
        return renderForm();
    }
  };

  return (
    <div style={styles.container}>
     
      <BookingNavbar />
      <ChatWidget/>
      <span style={styles.backButton} onClick={() => navigate(-1)}></span>
      <div style={styles.contentWrapper}>
        <div style={styles.content}>
          <div style={styles.leftColumn}>
            <div style={styles.formContainer}>
              <form onSubmit={handleSubmit} noValidate>
                {renderContent()}
              </form>
            </div>
          </div>

          {bookingStatus === 'form' && (
            <div style={styles.rightColumn}>
              <div style={styles.summaryCard}>
                <h3 style={styles.summaryTitle}>Price Summary</h3>

                <div style={styles.priceRow}>
                  <span style={styles.priceRowLabel}>Hourly fee</span>
                  <span style={styles.priceRowValue}>
                    NPR {selectedTasker.hourlyRate || '—'}<span style={styles.perHr}>/hr</span>
                  </span>
                </div>

                <div style={styles.priceRow}>
                  <span style={styles.priceRowLabel}>Platform fee</span>
                  <span style={{ ...styles.priceRowValue, color: '#f6ad56' }}>5%</span>
                </div>

                

                <div style={styles.summaryDivider} />

                <div style={styles.rangeBlock}>
                  <span style={styles.rangeLabel}>Minimum price</span>
                  <div style={styles.rangeValues}>
                    <div style={styles.rangeItem}>
                      <span style={styles.rangeCaption}> Starting from </span>
                      <span style={{
 
  
  margin: '0 30px',
  fontSize: '16px',
  color: '#999'
}}>
  –
</span>
                      <span style={styles.rangeAmount}>NPR {Math.round(totals.total ).toLocaleString()}/hr</span>
                    </div>
                   
                  </div>
                </div>

                <p style={styles.summaryNote}>Final price confirmed after worker assessment</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {cancelTaskData && (
        <CancelTaskModal
          task={cancelTaskData}
          onClose={() => setCancelTaskData(null)}
          onSubmit={(reason, photo) => cancelTask(cancelTaskData._id, reason, photo)}
        />
      )}
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  container: {
    minHeight: '100vh',
    background: '#FFFBEB',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  contentWrapper: {
    maxWidth: '1200px', padding: '20px',
    marginTop: '0px', margin: '0 auto',
  },
  backButton: {
    position: 'sticky', top: '120px',
    padding: '8px 16px', background: 'transparent',
    border: 'none', fontSize: '14px', color: '#666',
    cursor: 'pointer', marginBottom: '20px',
  },
  content:     { display: 'flex', gap: '24px' },
  leftColumn:  { flex: 1 },
  rightColumn: { width: '320px', flexShrink: 0 },
  formContainer: {
    background: '#fff', borderRadius: '16px',
    padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  formHeader:   { marginBottom: '32px' },
  formTitle:    { fontSize: '28px', fontWeight: '600', color: '#1a1a1a', marginBottom: '8px' },
  formSubtitle: { fontSize: '16px', color: '#666' },

  errorBanner: {
    background: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: '10px', padding: '14px 18px',
    marginBottom: '24px', color: '#dc2626', fontSize: 14,
  },

  slotsLoadingBanner: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: '#eff6ff', border: '1px solid #bfdbfe',
    borderRadius: '8px', padding: '8px 12px',
    fontSize: '13px', color: '#1d4ed8', marginBottom: '12px',
  },
  slotsLoadingDot: {
    display: 'inline-block', width: '8px', height: '8px',
    borderRadius: '50%', background: '#3b82f6',
  },
  slotsWarningBanner: {
    background: '#fffbeb', border: '1px solid #fcd34d',
    borderRadius: '8px', padding: '8px 12px',
    fontSize: '13px', color: '#92400e', marginBottom: '12px',
  },
  availableBadge: {
    marginLeft: '8px', display: 'inline-block',
    background: '#dcfce7', color: '#166534',
    fontSize: '11px', fontWeight: '600',
    padding: '2px 8px', borderRadius: '20px',
    verticalAlign: 'middle',
  },

  slotChipsWrap: {
    display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px',
  },
  slotChip: {
    padding: '5px 10px', borderRadius: '20px',
    fontSize: '12px', fontWeight: '500',
    border: '1.5px solid #e0e0e0',
    cursor: 'pointer', transition: 'all 0.15s',
    background: 'white', color: '#666',
  },
  slotChipAvailable: {
    borderColor: '#f6ad56', color: '#b45309', background: '#fff7ed',
  },
  slotChipSelected: {
    borderColor: '#f6ad56', background: '#f6ad56',
    color: 'white', fontWeight: '700',
  },
  slotChipUnavailable: {
    borderColor: '#e5e7eb', color: '#d1d5db',
    background: '#f9fafb', cursor: 'not-allowed',
    textDecoration: 'line-through',
  },
  noSlotsMsg: {
    fontSize: '13px', color: '#ef4444',
    marginTop: '8px', fontStyle: 'italic',
  },

  taskerSummary: {
    display: 'flex', gap: '20px', padding: '20px',
    background: '#f8f9fa', borderRadius: '12px', marginBottom: '32px',
  },
  taskerAvatar: {
    width: '64px', height: '64px', borderRadius: '50%',
    background: '#f6ad56', color: 'white',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '24px', fontWeight: '600', flexShrink: 0,
  },
  taskerInfo:        { flex: 1 },
  taskerName:        { fontSize: '20px', fontWeight: '600', color: '#1a1a1a', marginBottom: '8px' },
  taskerMeta:        { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' },
  rating:            { fontSize: '14px', fontWeight: '600', color: '#f6ad56' },
  reviews:           { fontSize: '13px', color: '#666' },
  eliteBadge:        { background: '#f6ad56', color: 'white', padding: '4px 10px', borderRadius: '16px', fontSize: '11px', fontWeight: '600' },
  taskerRate:        { fontSize: '14px', color: '#1a1a1a', fontWeight: '500', marginBottom: '8px' },
  taskerDescription: { fontSize: '14px', color: '#666', lineHeight: '1.5' },

  section:      { marginBottom: '32px' },
  sectionTitle: { fontSize: '18px', fontWeight: '600', color: '#1a1a1a', marginBottom: '16px' },

  photoOptions: { display: 'flex', gap: '16px' },
  photoOption: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '8px', padding: '20px',
    border: '2px dashed #e0e0e0', borderRadius: '12px',
    cursor: 'pointer', color: '#666',
  },
  hiddenInput:    { display: 'none' },
  uploadedPhotos: { marginTop: '20px' },
  photoCount:     { fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '12px' },
  photoGrid:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px' },
  photoItem:      { position: 'relative', borderRadius: '8px', overflow: 'hidden', aspectRatio: '1' },
  photoPreview:   { width: '100%', height: '100%', objectFit: 'cover' },
  removePhoto: {
    position: 'absolute', top: '4px', right: '4px',
    width: '24px', height: '24px', borderRadius: '50%',
    background: 'rgba(0,0,0,0.5)', color: 'white',
    border: 'none', fontSize: '16px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  detailRow:   { padding: '8px 0' },
  detailLabel: { fontSize: '14px', color: '#666' },
  detailValue: { fontSize: '14px', fontWeight: '500', color: '#1a1a1a' },

  formRow:   { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
  taskGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
  taskRow:   { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' },

  label: { fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '4px', display: 'block' },

  input: {
    padding: '12px', border: '1px solid #e0e0e0', borderRadius: '8px',
    fontSize: '14px', outline: 'none', transition: 'border-color 0.2s',
    width: '100%', boxSizing: 'border-box', background: '#fff',
  },
  inputError: {
    padding: '12px', border: '1.5px solid #ef4444', borderRadius: '8px',
    fontSize: '14px', outline: 'none', background: '#fff8f8',
    width: '100%', boxSizing: 'border-box',
  },
  address: {
    marginTop: '8px', padding: '12px', border: '1px solid #e0e0e0',
    borderRadius: '8px', fontSize: '14px', outline: 'none',
    width: '100%', boxSizing: 'border-box', display: 'block',
  },
  addressError: {
    marginTop: '8px', padding: '12px', border: '1.5px solid #ef4444',
    borderRadius: '8px', fontSize: '14px', outline: 'none',
    background: '#fff8f8', width: '100%', boxSizing: 'border-box', display: 'block',
  },
  textarea: {
    marginTop: '8px', display: 'block', width: '100%', boxSizing: 'border-box',
    padding: '12px', border: '1px solid #e0e0e0', borderRadius: '8px',
    fontSize: '14px', minHeight: '100px', resize: 'vertical',
    outline: 'none', fontFamily: 'inherit',
  },

  errorMsg: {
    display: 'block', fontSize: '12px', color: '#ef4444',
    marginTop: '3px', marginBottom: '4px',
  },

  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' },
  checkbox:      { width: '18px', height: '18px', cursor: 'pointer', accentColor: '#f6ad56' },
  checkboxText:  { fontSize: '14px', color: '#1a1a1a' },

  buttonGroup:  { display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '32px' },
  cancelButton: {
    padding: '12px 24px', background: 'white', border: '1px solid #e0e0e0',
    borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', color: '#666',
  },
  submitButton: {
    padding: '12px 32px', background: '#f6ad56', color: 'white',
    border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600',
    cursor: 'pointer', boxShadow: '0 2px 8px rgba(246,173,86,0.4)',
  },

  summaryCard: {
    background: '#fff', borderRadius: '16px', padding: '24px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)', position: 'sticky', top: '120px',
    border: '1px solid #f1f5f9',
  },
  summaryTitle:   { fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '20px' },
  summaryDivider: { height: '1px', background: '#f1f5f9', margin: '16px 0' },

  priceRow:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  priceRowLabel: { fontSize: '14px', color: '#64748b' },
  priceRowValue: { fontSize: '15px', fontWeight: '700', color: '#0f172a' },
  perHr:         { fontSize: '12px', fontWeight: '400', color: '#94a3b8' },

  marketBlock: { display: 'flex', flexDirection: 'column', gap: '4px' },
  marketLabel: { fontSize: '12px', color: '#94a3b8' },
  marketRange: { fontSize: '15px', fontWeight: '700', color: '#0f172a' },

  rangeBlock:   { background: '#fff7ed', borderRadius: '12px', padding: '14px 16px' },
  rangeLabel:   { fontSize: '16px', color: '#92400e', fontWeight: '600', display: 'block', marginBottom: '13px' },
  rangeValues:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  rangeItem:    {  alignItems: 'center', gap: '2px' },
  rangeCaption: { fontSize: '13px', color: '#94a3b8' },
  rangeAmount:  { fontSize: '16px', fontWeight: '700', color: '#f6ad56' },
  rangeDash:    { fontSize: '18px', color: '#e2e8f0', fontWeight: '300' },

  summaryNote: { fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '14px' },
  totalAmount: { color: '#f6ad56' },

  statusContainer: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '20px', padding: '40px 20px', textAlign: 'center',
  },
  pendingIcon: { fontSize: '56px' },
  successIcon: {
    width: '72px', height: '72px', borderRadius: '50%',
    background: '#10b981', color: 'white',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '36px', fontWeight: 'bold',
  },
  errorIcon: {
    width: '72px', height: '72px', borderRadius: '50%',
    background: '#ef4444', color: 'white',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '36px', fontWeight: 'bold',
  },
  statusTitle:   { fontSize: '28px', fontWeight: '600', color: '#1a1a1a' },
  statusMessage: { fontSize: '16px', color: '#666', maxWidth: '500px' },
  bookingDetailsSummary: {
    width: '100%', maxWidth: '500px', background: '#F9F6EF',
    padding: '24px', borderRadius: '12px', textAlign: 'left',
  },
  summaryHeading: { fontSize: '18px', fontWeight: '600', color: '#1a1a1a', marginBottom: '16px' },
  detailGrid:     { display: 'grid', gap: '12px' },
  detailItem:     { display: 'flex', justifyContent: 'space-between' },
  actionButtons:  { display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' },
  primaryButton: {
    padding: '12px 24px', background: '#f6ad56', color: 'white',
    border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer',
  },
  secondaryButton: {
    padding: '12px 24px', background: 'white', border: '1px solid #e0e0e0',
    borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', color: '#666',
  },
  cancelRequestButton: {
    padding: '12px 24px', background: '#ef4444', color: 'white',
    border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer',
  },
};

export default TaskDescriptionPage;