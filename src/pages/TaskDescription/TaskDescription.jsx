import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCustomerById, createTask } from '../../api/api';
import { Camera, Upload } from "lucide-react";
import BookingNavbar from '../../components/Navbar/Navbar';

// ── Validation ────────────────────────────────────────────────────────────────
const validate = (booking, task, terms) => {
  const errs = {};

  if (!(task.taskType || '').trim())
    errs.taskType = 'Task type is required.';
  else if ((task.taskType || '').trim().length < 3)
    errs.taskType = 'Task type must be at least 3 characters.';

  if ((task.taskName || '').trim() && (task.taskName || '').trim().length < 5)
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

// ── Field Error Display ───────────────────────────────────────────────────────
const FieldError = ({ errors, touched, submitted, field }) =>
  (touched[field] || submitted) && errors[field] ? (
    <span style={styles.errorMsg}>{errors[field]}</span>
  ) : null;

// ── Input style helper ────────────────────────────────────────────────────────
const inputStyle = (field, errors, touched, submitted, base = 'input') => {
  const hasError = (touched[field] || submitted) && errors[field];
  return hasError ? styles[`${base}Error`] : styles[base];
};

// ─────────────────────────────────────────────────────────────────────────────
const TaskDescriptionPage = ({ worker }) => {
  const navigate = useNavigate();

  const storedTaskRequest = localStorage.getItem('pendingTaskRequest');
  const taskDetails       = storedTaskRequest ? JSON.parse(storedTaskRequest) : {};

  const storedWorker   = localStorage.getItem('selectedWorker');
  const selectedTasker = worker || (storedWorker ? JSON.parse(storedWorker) : null);

  // ── Fix 1: safe read from localStorage with sessionStorage fallback ──
  const rawUser      = localStorage.getItem('user') || sessionStorage.getItem('user') || '{}';
  const user         = JSON.parse(rawUser);
  const userId       = user.id || user._id;
  const userFullName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim();
  const userPhone    = user.phoneNo || '';
  const userEmail    = user.email   || '';

  // ── Prefilled immediately from localStorage — no flicker ──
  const [bookingDetails, setBookingDetails] = useState({
    date:         '',
    time:         '',
    customerName: userFullName,
    phone:        userPhone,
    email:        userEmail,
  });

  // ── Fix 2: taskName no longer prefills from worker description ──
  const [editableTask, setEditableTask] = useState({
    taskType: taskDetails.taskType || selectedTasker?.taskType || '',
    taskName: taskDetails.taskName || '',
    address:  taskDetails.address  || '',
  });

  const [acceptTerms,   setAcceptTerms]   = useState(false);
  const [bookingStatus, setBookingStatus] = useState('form');
  const [photos,        setPhotos]        = useState([]);
  const [note,          setNote]          = useState('');
  const [errors,        setErrors]        = useState({});
  const [touched,       setTouched]       = useState({});
  const [submitted,     setSubmitted]     = useState(false);
  const [isSubmitting,  setIsSubmitting]  = useState(false);

  const noWorker = !selectedTasker;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  const maxDateObj = new Date();
  maxDateObj.setMonth(maxDateObj.getMonth() + 3);
  const maxDate = maxDateObj.toISOString().split('T')[0];

  // ── Clear stale pendingTaskRequest on unmount ──
  useEffect(() => {
    return () => localStorage.removeItem('pendingTaskRequest');
  }, []);

  // ── API call as fallback — only overwrites if localStorage value was empty ──
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

  // ── Live re-validate only after first submit attempt ──
  useEffect(() => {
    if (submitted) setErrors(validate(bookingDetails, editableTask, acceptTerms));
  }, [bookingDetails, editableTask, acceptTerms, submitted]);

  /* ── Handlers ── */
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
    setErrors(validate(bookingDetails, editableTask, acceptTerms));
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    const remaining = 5 - photos.length;
    if (remaining <= 0) { alert('Maximum 5 photos allowed.'); return; }
    const validFiles = files.filter(f => {
      if (!f.type.startsWith('image/')) { alert(`${f.name} is not an image.`); return false; }
      if (f.size > 5 * 1024 * 1024)    { alert(`${f.name} exceeds 5MB limit.`); return false; }
      return true;
    });
    setPhotos(prev => [...prev, ...validFiles.slice(0, remaining)]);
  };

  const calculateTotal = () => {
    const subtotal    = selectedTasker?.hourlyRate * (selectedTasker?.minHours || 1);
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

  /* ── Submit ── */
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
      formData.append('assignedWorker',  selectedTasker.email || selectedTasker.id || '');
      formData.append('serviceDate',     bookingDetails.date || '');
      formData.append('serviceTime',     bookingDetails.time || '');
      formData.append('note',            note || '');
      photos.forEach((photo, i) => formData.append(`photo_${i}`, photo));

      await createTask(formData);
      setBookingStatus('pending');
    } catch (err) {
      console.error(err);
      alert('Failed to create task: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const errorCount      = Object.keys(errors).length;
  const showErrorBanner = submitted && errorCount > 0;

  /* ── No worker guard ── */
  if (noWorker) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ color: '#ef4444' }}>No worker selected</h2>
      <p style={{ color: '#666', fontSize: 14 }}>Please go back and select a worker first.</p>
      <button onClick={() => navigate(-1)} style={{ padding: '10px 24px', background: '#f6ad56', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Go Back</button>
    </div>
  );

  /* ── Render ── */
  const renderForm = () => (
    <>
      <div style={styles.formHeader}>
        <h1 style={styles.formTitle}>Confirm Your Booking</h1>
        <p style={styles.formSubtitle}>
          Complete the details below to book <strong>{selectedTasker.name}</strong>
        </p>
      </div>

      {showErrorBanner && (
        <div style={styles.errorBanner}>
          <strong>⚠️ Please fix {errorCount} error{errorCount > 1 ? 's' : ''} before submitting:</strong>
          <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
            {Object.values(errors).map((err, i) => (
              <li key={i} style={{ fontSize: 13, marginTop: 4 }}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Tasker Summary */}
      <div style={styles.taskerSummary}>
        <div style={styles.taskerAvatar}>{selectedTasker.avatar}</div>
        <div style={styles.taskerInfo}>
          <h3 style={styles.taskerName}>{selectedTasker.name}</h3>
          <div style={styles.taskerMeta}>
            <span style={styles.rating}>★ {selectedTasker.rating}</span>
            <span style={styles.reviews}>({selectedTasker.reviews} reviews)</span>
            {selectedTasker.isElite && <span style={styles.eliteBadge}>ELITE</span>}
          </div>
          <div style={styles.taskerRate}>
            NPR {selectedTasker.hourlyRate}/hour • {selectedTasker.minHours} hour minimum
          </div>
          <p style={styles.taskerDescription}>{selectedTasker.description}</p>
        </div>
      </div>

      {/* ── Task Details ── */}
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

      {/* ── Photos ── */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          Add Photos{' '}
          <span style={{ fontWeight: 400, fontSize: 14, color: '#9ca3af' }}>(optional — max 5, 5MB each)</span>
        </h3>
        <div style={styles.photoOptions}>
          <label style={{
            ...styles.photoOption,
            opacity: photos.length >= 5 ? 0.5 : 1,
            cursor:  photos.length >= 5 ? 'not-allowed' : 'pointer',
          }}>
            <input type="file" accept="image/*" capture="environment"
              onChange={handlePhotoUpload} style={styles.hiddenInput}
              disabled={photos.length >= 5} />
            <Camera size={24} />
            <span>Take Photo</span>
          </label>
          <label style={{
            ...styles.photoOption,
            opacity: photos.length >= 5 ? 0.5 : 1,
            cursor:  photos.length >= 5 ? 'not-allowed' : 'pointer',
          }}>
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

      {/* ── Schedule ── */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Schedule</h3>
        <div style={{ ...styles.formRow, gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Date *</label>
            <input
              type="date" name="date"
              value={bookingDetails.date}
              onChange={handleChange} onBlur={handleBlur}
              min={minDate} max={maxDate}
              style={inputStyle('date', errors, touched, submitted)}
            />
            <FieldError field="date" errors={errors} touched={touched} submitted={submitted} />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Start Time *</label>
            <select
              name="time"
              value={bookingDetails.time}
              onChange={handleChange} onBlur={handleBlur}
              style={inputStyle('time', errors, touched, submitted)}
            >
              <option value="">Select time</option>
              {['9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'].map(t => (
                <option key={t} value={t}>{formatTime(t)}</option>
              ))}
            </select>
            <FieldError field="time" errors={errors} touched={touched} submitted={submitted} />
          </div>
        </div>
      </div>

      {/* ── Contact ── */}
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

      {/* ── Notes ── */}
      <div style={styles.section}>
        <label style={styles.label}>
          Additional Notes{' '}
          <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          style={{
            ...styles.textarea,
            borderColor: note.length > 500 ? '#ef4444' : '#e0e0e0',
          }}
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

      {/* ── Terms ── */}
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
            I agree to pay <strong>NPR {totals.total.toFixed(2)}</strong> and accept the{' '}
            <span style={{ color: '#f6ad56', textDecoration: 'underline', cursor: 'pointer' }}>
              terms and conditions
            </span>
          </span>
        </label>
        <FieldError field="terms" errors={errors} touched={touched} submitted={submitted} />
      </div>

      {/* ── Actions ── */}
      <div style={styles.buttonGroup}>
        <button type="button" style={styles.cancelButton} onClick={() => navigate(-1)}>
          Cancel
        </button>
        <button
          type="submit"
          style={{
            ...styles.submitButton,
            opacity: isSubmitting ? 0.7 : 1,
            cursor:  isSubmitting ? 'not-allowed' : 'pointer',
          }}
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
            <div style={styles.pendingIcon}>⏳</div>
            <h2 style={styles.statusTitle}>Waiting for {selectedTasker.name}</h2>
            <p style={styles.statusMessage}>
              We've sent your booking request to <strong>{selectedTasker.name}</strong>.
              They usually respond within a few minutes.
            </p>
            <div style={styles.bookingDetailsSummary}>
              <h4 style={styles.summaryHeading}>Your Booking Details</h4>
              <div style={styles.detailGrid}>
                {[
                  { label: 'Task Type',    value: editableTask.taskType || 'N/A' },
                  { label: 'Date',         value: bookingDetails.date },
                  { label: 'Time',         value: formatTime(bookingDetails.time) },
                  { label: 'Location',     value: editableTask.address || 'N/A' },
                  { label: 'Total Amount', value: `NPR ${totals.total.toFixed(2)}` },
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
                onClick={() => window.confirm('Are you sure you want to cancel?') && setBookingStatus('declined')}
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
      <button style={styles.backButton} onClick={() => navigate(-1)}>← Back</button>
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
                    NPR {selectedTasker.hourlyRate}<span style={styles.perHr}>/hr</span>
                  </span>
                </div>

                <div style={styles.priceRow}>
                  <span style={styles.priceRowLabel}>Platform fee</span>
                  <span style={{ ...styles.priceRowValue, color: '#f6ad56' }}>5%</span>
                </div>

                <div style={styles.summaryDivider} />

                <div style={styles.marketBlock}>
                  <span style={styles.marketLabel}>Market price for {selectedTasker.taskType || 'this service'}</span>
                  <span style={styles.marketRange}>NPR 400 – 700 / hr</span>
                </div>

                <div style={styles.summaryDivider} />

                <div style={styles.rangeBlock}>
                  <span style={styles.rangeLabel}>Estimated range</span>
                  <div style={styles.rangeValues}>
                    <div style={styles.rangeItem}>
                      <span style={styles.rangeCaption}>Min</span>
                      <span style={styles.rangeAmount}>NPR {Math.round(totals.total * 0.85).toLocaleString()}</span>
                    </div>
                    <span style={styles.rangeDash}>–</span>
                    <div style={styles.rangeItem}>
                      <span style={styles.rangeCaption}>Max</span>
                      <span style={styles.rangeAmount}>NPR {Math.round(totals.total * 1.15).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <p style={styles.summaryNote}>Final price confirmed after worker assessment</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  container: {
    minHeight: '100vh',
    background: '#f8f9fa',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  contentWrapper: {
    maxWidth: '1200px', padding: '20px',
    marginTop: '-40px', marginLeft: '120px',
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
  rangeLabel:   { fontSize: '12px', color: '#92400e', fontWeight: '600', display: 'block', marginBottom: '10px' },
  rangeValues:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  rangeItem:    { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  rangeCaption: { fontSize: '11px', color: '#94a3b8' },
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
    width: '100%', maxWidth: '500px', background: '#f8f9fa',
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