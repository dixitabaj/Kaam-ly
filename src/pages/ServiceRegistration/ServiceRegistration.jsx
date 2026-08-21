// ServiceRegistration.jsx
import React, { useState } from 'react';
import ProgressBar from '../../components/ProgressBar/ProgressBar';
import RegistrationForm from '../../components/RegistrationForm/RegistrationForm';
import LivenessCheck from '../../components/FaceVerification/LivenessCheck';
import './registration.css';
import { checkEmailExists, registerWorker, uploadSkillEvidence, checkPhoneExists, sendOtp, verifyOtp } from '../../api/api';
import WhatsAppSupport from '../../components/WhatsApp/WhatsApp';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

const DEFAULT_START = '09:00';
const DEFAULT_END   = '17:00';

const EVIDENCE_ACCEPT = 'image/*,video/*,application/pdf,.pdf';

const makeAvailability = () =>
  DAYS.reduce((acc, day) => ({
    ...acc,
    [day]: { enabled: false, start: DEFAULT_START, end: DEFAULT_END },
  }), {});

const getFileIcon = (file) => {
  if (!file) return '📁';
  const t = file.type;
  if (t.startsWith('image/'))  return '🖼️';
  if (t.startsWith('video/'))  return '🎬';
  if (t === 'application/pdf') return '📄';
  return '📋';
};

const formatBytes = (bytes) => {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const ServiceRegistration = () => {
  const [step,   setStep]   = useState(1);
  const [errors, setErrors] = useState({});

  const [faceVerified,     setFaceVerified]     = useState(false);
  const [faceVerifyResult, setFaceVerifyResult] = useState(null);
  const [showLiveness,     setShowLiveness]     = useState(false);

  const [fileErrors, setFileErrors] = useState({});
  const [otpSent,      setOtpSent]      = useState(false);
  const [otpVerified,  setOtpVerified]  = useState(false);
  const [otpCode,      setOtpCode]      = useState('');
  const [otpError,     setOtpError]     = useState('');
  const [otpLoading,   setOtpLoading]   = useState(false);
  const [otpResendMsg, setOtpResendMsg] = useState('');
  const [toast, setToast] = useState(null);
  const [submitError, setSubmitError] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const [formData, setFormData] = useState({
    firstName:        '',
    lastName:         '',
    email:            '',
    phone:            '',
    password:         '',
    confirmPassword:  '',
    taskTypes:        [],
    skills:           [],
    primaryCity:      '',
    secondaryCities:  [],
    profilePhoto:     '',
    description:      '',
    // ✅ One file per CATEGORY (e.g. { "Plumbing": File, "Electrical": File })
    categoryProofFiles: {},
    availability:     makeAvailability(),
    minHours:         1,
    paymentMethod: '',
    paymentId:     ''
  });

  const [isValidating, setIsValidating] = useState(false);

  // ── Data ───────────────────────────────────────────────────────────────────
  const serviceCategories = [
    { id: 'Plumbing',         label: 'Plumbing'         },
    { id: 'Moving',           label: 'Moving'           },
    { id: 'Cleaning',         label: 'Cleaning'         },
    { id: 'Gardening',        label: 'Gardening'        },
    { id: 'Painting',         label: 'Painting'         },
    { id: 'Carpentry',        label: 'Carpentry'        },
    { id: 'Appliance Repair', label: 'Appliance Repair' },
    { id: 'Electrical',       label: 'Electrical'       },
    { id: 'HVAC',             label: 'HVAC'             },
    { id: 'Assembly',         label: 'Assembly'         },
    { id: 'General',          label: 'General' },
  ];

  const categorySkillsMap = {
    Plumbing:          ['Pipe Repair','Drain Cleaning','Sewer Repair','Fixture Installation','Water Heater Repair'],
    Moving:            ['Packing','Loading & Unloading','Furniture Moving','Relocation Support'],
    Cleaning:          ['House Cleaning','Office Cleaning','Carpet Cleaning','Window Cleaning','Laundry & Ironing'],
    Gardening:         ['Lawn Care','Landscaping','Tree Service','Plant Care','Garden Maintenance'],
    Painting:          ['Interior Painting','Exterior Painting','Wall Painting','Touch-ups & Patching'],
    Carpentry:         ['Furniture Repair','Cabinet Making','Shelving & Storage','Woodwork','Joinery'],
    'Appliance Repair':['Washer Repair','Dryer Repair','Fridge Repair','Oven Repair'],
    Electrical:        ['Wiring & Rewiring','Lighting Installation','Circuit Repair','Outlet & Switch Repair'],
    HVAC:              ['Heating Repair','Air Conditioning','Ventilation','Furnace Repair','Cooling Systems'],
    Assembly:          ['Furniture Assembly','Flat-pack Assembly','TV Mounting','Shelving Installation'],
    'General':         ['General Carpentry','Basic Repairs','Handyman Services','Small Fixes','Maintenance Work'],
  };

  const cityCoordinates = {
    'Kathmandu':   { lat: 27.7172, lng: 85.3240 },
    'Lalitpur':    { lat: 27.6667, lng: 85.3167 },
    'Bhaktapur':   { lat: 27.6710, lng: 85.4298 },
    'Pokhara':     { lat: 28.2096, lng: 83.9856 },
    'Chitwan':     { lat: 27.5291, lng: 84.3542 },
    'Butwal':      { lat: 27.7000, lng: 83.4500 },
    'Biratnagar':  { lat: 26.4525, lng: 87.2718 },
    'Dharan':      { lat: 26.8145, lng: 87.2847 },
    'Nepalgunj':   { lat: 28.0500, lng: 81.6167 },
    'Dhangadhi':   { lat: 28.6944, lng: 80.5897 },
    'Hetauda':     { lat: 27.4281, lng: 85.0324 },
    'Janakpur':    { lat: 26.7288, lng: 85.9244 },
    'Bharatpur':   { lat: 27.6767, lng: 84.4333 },
    'Itahari':     { lat: 26.6708, lng: 87.2847 },
    'Birgunj':     { lat: 27.0000, lng: 84.8800 },
  };

  const serviceAreasList = Object.keys(cityCoordinates);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleCategoryToggle = (catId) => {
    setFormData(prev => {
      const isSelected = prev.taskTypes.includes(catId);
      if (isSelected) {
        const remainingSkills = prev.skills.filter(skill => skill.taskType !== catId);
        const remainingFiles  = { ...prev.categoryProofFiles };
        delete remainingFiles[catId]; // ✅ remove by category key
        return {
          ...prev,
          taskTypes: prev.taskTypes.filter(t => t !== catId),
          skills: remainingSkills,
          categoryProofFiles: remainingFiles,
        };
      }
      return { ...prev, taskTypes: [...prev.taskTypes, catId] };
    });
    if (errors.taskTypes) setErrors(prev => ({ ...prev, taskTypes: '' }));
  };

  const handleSkillToggle = (skillName, taskType) => {
    setFormData(prev => {
      const existingSkill = prev.skills.find(s => s.name === skillName);
      if (existingSkill) {
        return { ...prev, skills: prev.skills.filter(s => s.name !== skillName) };
      }
      return { ...prev, skills: [...prev.skills, { name: skillName, price: 0, taskType }] };
    });
    if (errors.skills) setErrors(prev => ({ ...prev, skills: '' }));
  };

  const handleSkillPriceChange = (skillName, price) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.map(s => s.name === skillName ? { ...s, price: parseFloat(price) || 0 } : s),
    }));
    if (errors.skillPrices) setErrors(prev => ({ ...prev, skillPrices: '' }));
  };

  const handlePrimaryCitySelect = (city) => {
    setFormData(prev => ({
      ...prev,
      primaryCity: city,
      secondaryCities: prev.secondaryCities.filter(c => c !== city),
    }));
    if (errors.primaryCity) setErrors(prev => ({ ...prev, primaryCity: '' }));
  };

  const handleSecondaryCityToggle = (city) => {
    setFormData(prev => {
      if (prev.primaryCity === city) return prev;
      return {
        ...prev,
        secondaryCities: prev.secondaryCities.includes(city)
          ? prev.secondaryCities.filter(c => c !== city)
          : [...prev.secondaryCities, city],
      };
    });
  };

  const handleDayToggle = (day) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: { ...prev.availability[day], enabled: !prev.availability[day].enabled },
      },
    }));
    if (errors.availability) setErrors(prev => ({ ...prev, availability: '' }));
  };

  const handleTimeChange = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: { ...prev.availability[day], [field]: value },
      },
    }));
    if (errors.availability) setErrors(prev => ({ ...prev, availability: '' }));
  };

  // ✅ Evidence handlers keyed by CATEGORY
  const handleCategoryEvidenceFile = (categoryName, file) => {
    if (!file) return;
    const isPdf   = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isPdf && !isImage && !isVideo) {
      setFileErrors(prev => ({ ...prev, [categoryName]: 'Only PDF, image, or video files are allowed.' }));
      return;
    }
    setFileErrors(prev => { const n = { ...prev }; delete n[categoryName]; return n; });
    setFormData(p => ({ ...p, categoryProofFiles: { ...p.categoryProofFiles, [categoryName]: file } }));
  };

  const removeCategoryEvidenceFile = (categoryName) => {
    setFormData(p => {
      const updated = { ...p.categoryProofFiles };
      delete updated[categoryName];
      return { ...p, categoryProofFiles: updated };
    });
    setFileErrors(prev => { const n = { ...prev }; delete n[categoryName]; return n; });
  };

  const sendOtpHandler = async () => {
    setOtpLoading(true); setOtpError(''); setOtpResendMsg('');
    try {
      await sendOtp(formData.email);
      setOtpSent(true);
    } catch (err) {
      setOtpError(err.message);
    } finally { setOtpLoading(false); }
  };

  const resendOtpHandler = async () => {
    setOtpLoading(true); setOtpError(''); setOtpResendMsg('');
    try {
      await sendOtp(formData.email);
      setOtpResendMsg('A new code has been sent.'); setOtpCode('');
    } catch (err) {
      setOtpError(err.message);
    } finally { setOtpLoading(false); }
  };

  const verifyOtpHandler = async () => {
    if (!otpCode.trim()) { setOtpError('Please enter the code.'); return; }
    setOtpLoading(true); setOtpError('');
    try {
      await verifyOtp(formData.email, otpCode);
      setOtpVerified(true);
      setSubmitError('');
    } catch (err) {
      setOtpError(err.message);
    } finally { setOtpLoading(false); }
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateStep = async () => {
    const e = {};

    if (step === 1) {
      if (!formData.firstName.trim())    e.firstName       = 'First name is required';
      if (!formData.lastName.trim())     e.lastName        = 'Last name is required';
      if (!formData.email.trim())        e.email           = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = 'Enter a valid email';
      else {
        try {
          const emailExists = await checkEmailExists(formData.email);
          if (emailExists) e.email = 'This email is already registered';
        } catch { console.error('Email check failed'); }
      }
      if (!formData.phone.trim())        e.phone           = 'Phone is required';
      else if (!/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) e.phone = 'Phone must be 10 digits';
      else {
        try {
          const phoneExists = await checkPhoneExists(formData.phone);
          if (phoneExists) e.phone = 'This phone number is already registered';
        } catch { console.error('Phone check failed'); }
      }
      if (!formData.password)            e.password        = 'Password is required';
      else if (formData.password.length < 6) e.password    = 'At least 6 characters';
      if (formData.password !== formData.confirmPassword)   e.confirmPassword = 'Passwords do not match';
    }

    if (step === 2) {
      if (formData.taskTypes.length < 1) e.taskTypes   = 'Please select at least one task type';
      if (formData.skills.length < 1)    e.skills      = 'Select at least one skill';
      const missingPrices = formData.skills.some(skill => !skill.price || skill.price <= 100);
      const overPriced    = formData.skills.some(skill => skill.price > 10000);
      if (missingPrices)   e.skillPrices = 'Set appropriate rate for each selected skill. Minimum rate is 100 NPR per hour';
      else if (overPriced) e.skillPrices = 'Rate seems too high (max 10,000 NPR)';
    }

    if (step === 3) {
      if (!formData.primaryCity) e.primaryCity = 'Please select your primary service area';
    }

    if (step === 4) {
      if (!formData.profilePhoto)                  e.profilePhoto  = 'Profile photo is required';
      if (!formData.description.trim())             e.description   = 'Write a short description';
      else if (formData.description.length > 500)   e.description   = 'Keep it under 500 characters';
      if (!formData.paymentMethod)                  e.paymentMethod = 'Please select a payment method';
      else if (!formData.paymentId.trim())           e.paymentMethod = 'Please enter your payment ID';
      else if (!/^\d{10}$/.test(formData.paymentId.replace(/\D/g, ''))) e.paymentMethod = 'Payment ID must be a 10-digit phone number';
    }

    if (step === 5) {
      const anyEnabled = DAYS.some(d => formData.availability[d].enabled);
      if (!anyEnabled) {
        e.availability = 'Enable at least one day';
      } else {
        const badTime = DAYS.some(d => {
          const { enabled, start, end } = formData.availability[d];
          return enabled && start >= end;
        });
        if (badTime) e.availability = 'End time must be after start time for each day';
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = async () => {
    setIsValidating(true);
    const valid = await validateStep();
    setIsValidating(false);
    if (valid) {
      setStep(p => Math.min(p + 1, 7));
    } else {
      setTimeout(() => {
        const firstError = document.querySelector('.reg-error');
        if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  };
  const prevStep = () => setStep(p => Math.max(p - 1, 1));

  const buildHoursPayload = () => {
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const hours = {};
    DAYS.forEach(day => {
      const { enabled, start, end } = formData.availability[day];
      hours[cap(day)] = enabled ? [{ start, end }] : [];
    });
    return hours;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!await validateStep()) return;

    if (!faceVerified) { setSubmitError('face'); setStep(6); return; }
    if (!otpVerified)  { setSubmitError('otp');  setStep(7); return; }
    setSubmitError('');

    const primaryCoords = cityCoordinates[formData.primaryCity] || { lat: 0, lng: 0 };
    const allCities     = [formData.primaryCity, ...formData.secondaryCities].filter(Boolean);

    const payload = {
      firstName:      formData.firstName,
      lastName:       formData.lastName,
      phoneNo:        formData.phone,
      email:          formData.email,
      password:       formData.password,
      taskType:       formData.taskTypes.join(', '), // ✅ string
      skills:         formData.skills.map(s => ({ name: s.name, price: s.price, taskType: s.taskType })),
      minHours:       parseInt(formData.minHours, 10) || 1,
      isAvailable:    true,
      face_verified:  faceVerified,
      skill_verified: false,
      serviceArea:    { primaryCity: formData.primaryCity, coordinates: primaryCoords, cities: allCities },
      profilePhoto:   formData.profilePhoto,
      description:    formData.description,
      role:           'worker',
      hours:          buildHoursPayload(),
      paymentMethod:  formData.paymentMethod,
      paymentId:      formData.paymentId,
    };

    try {
      await registerWorker(payload);

      // ✅ Upload one evidence file per CATEGORY — optional, silently skipped on failure
      for (const [categoryName, file] of Object.entries(formData.categoryProofFiles)) {
        try {
          await uploadSkillEvidence(formData.email, categoryName, file);
        } catch {
          console.warn(`Evidence upload failed for category "${categoryName}", worker still registered.`);
        }
      }

      showToast('Registration successful! Redirecting…');
      setTimeout(() => { window.location.href = '/login'; }, 2000);
    } catch (err) {
      showToast(err.message || 'Something went wrong. Please try again.', 'error');
    }
  };

  const Err = ({ field }) =>
    errors[field] ? <span className="reg-error">{errors[field]}</span> : null;

  // ── STEP 2 ─────────────────────────────────────────────────────────────────
  const renderStep2 = () => (
    <div className="reg-step">
      <h2 className="reg-step-title">What do you offer?</h2>
      <p className="reg-step-sub">Select the services you provide and set your rates</p>

      <div className="reg-field-group">
        <label className="reg-label">Service categories (select one or more)</label>
        <Err field="taskTypes" />
        <div className="reg-category-grid">
          {serviceCategories.map(cat => (
            <label key={cat.id} className="reg-category-option">
              <input
                type="checkbox"
                value={cat.id}
                checked={formData.taskTypes.includes(cat.id)}
                onChange={() => handleCategoryToggle(cat.id)}
              />
              <span className={`reg-category-pill ${formData.taskTypes.includes(cat.id) ? 'active' : ''}`}>
                {cat.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {formData.taskTypes.length > 0 && (
        <div className="reg-field-group">
          <label className="reg-label">Skills & rates</label>
          <p className="reg-hint-text">Select the skills you offer under each category and set your hourly rate.</p>
          <Err field="skills" />
          <Err field="skillPrices" />

          {formData.taskTypes.map(taskType => {
            const availableSkills   = categorySkillsMap[taskType] || [];
            const skillsForThisType = formData.skills.filter(s => s.taskType === taskType);
            return (
              <div key={taskType} className="reg-task-section">
                <div className="reg-task-header">
                  <h3 className="reg-task-title">{taskType}</h3>
                  
                </div>
                <div className="reg-skill-list">
                  {availableSkills.map(skillName => {
                    const skillObj   = formData.skills.find(s => s.name === skillName);
                    const isSelected = !!skillObj;
                    return (
                      <div key={skillName} className={`reg-skill-card ${isSelected ? 'active' : ''}`}>
                        <label className="reg-skill-toggle">
                          <input type="checkbox" checked={isSelected} onChange={() => handleSkillToggle(skillName, taskType)} />
                          <div className="reg-skill-check">
                            {isSelected && <span className="reg-checkmark">✓</span>}
                          </div>
                          <span className="reg-skill-name">{skillName}</span>
                        </label>
                        {isSelected && (
                          <div className="reg-sub-wrap">
                            <p className="reg-sub-label">Set your hourly rate for {skillName}:</p>
                            <div className="reg-rate-input-wrap">
                              <span className="reg-rate-prefix">NPR</span>
                              <input
                                type="number" min="0" step="50" placeholder="500"
                                value={skillObj.price || ''}
                                onChange={e => handleSkillPriceChange(skillName, e.target.value)}
                                className={`reg-rate-input ${errors.skillPrices ? 'has-error' : ''}`}
                              />
                              <span className="reg-rate-suffix">/ hr</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── STEP 3 ─────────────────────────────────────────────────────────────────
  const renderStep3 = () => (
    <div className="reg-step">
      <h2 className="reg-step-title">Where do you work?</h2>
      <p className="reg-step-sub">Tell clients where you can provide your services</p>
      <div className="reg-field-group">
        <label className="reg-label">Primary service area</label>
        <p className="reg-hint-text">Where do you mainly work? This is your home base.</p>
        <Err field="primaryCity" />
        <div className="reg-chips" style={{ marginTop: 8 }}>
          {serviceAreasList.map(city => (
            <label key={city} className="reg-chip-label">
              <input type="radio" name="primaryCity" checked={formData.primaryCity === city} onChange={() => handlePrimaryCitySelect(city)} />
              <span className={`reg-chip ${formData.primaryCity === city ? 'active green' : ''}`}>{city}</span>
            </label>
          ))}
        </div>
      </div>
      {formData.primaryCity && (
        <div className="reg-field-group">
          <label className="reg-label">Additional service areas (optional)</label>
          <p className="reg-hint-text">Select other cities where you also work.</p>
          <div className="reg-chips" style={{ marginTop: 8 }}>
            {serviceAreasList.filter(city => city !== formData.primaryCity).map(city => (
              <label key={city} className="reg-chip-label">
                <input type="checkbox" checked={formData.secondaryCities.includes(city)} onChange={() => handleSecondaryCityToggle(city)} />
                <span className={`reg-chip ${formData.secondaryCities.includes(city) ? 'active' : ''}`}>{city}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── STEP 4 ─────────────────────────────────────────────────────────────────
  const renderStep4 = () => (
    <div className="reg-step">
      <h2 className="reg-step-title">Your profile</h2>
      <p className="reg-step-sub">Help clients know who they're booking</p>
      <div className="reg-field-group">
        <label className="reg-label">Profile photo</label>
        <p className="reg-hint-text">Use a clear photo of your face — it'll also be used to verify your identity.</p>
        <Err field="profilePhoto" />
        <div className="reg-photo-row">
          <div className={`reg-photo-circle ${errors.profilePhoto ? 'has-error' : ''}`}>
            {formData.profilePhoto
              ? <img src={formData.profilePhoto} alt="Profile" className="reg-photo-img" />
              : <span className="reg-photo-placeholder">Photo</span>}
          </div>
          <div className="reg-photo-actions">
            <input type="file" id="photoInput" accept="image/*" style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  setFormData(p => ({ ...p, profilePhoto: reader.result }));
                  setFaceVerified(false); setFaceVerifyResult(null);
                  if (errors.profilePhoto) setErrors(p => ({ ...p, profilePhoto: '' }));
                };
                reader.readAsDataURL(file);
              }} />
            <button type="button" className="reg-outline-btn" onClick={() => document.getElementById('photoInput').click()}>
              {formData.profilePhoto ? 'Change photo' : 'Upload photo'}
            </button>
            {formData.profilePhoto && (
              <p className="reg-success-note">
                <strong>Profile Photo:</strong> Please upload a clear, well-lit photo of your full face.
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="reg-field-group">
        <label className="reg-label">About you</label>
        <textarea name="description" value={formData.description} onChange={handleChange}
          placeholder="Tell clients a bit about your experience and what you do best..."
          className={`reg-textarea ${errors.description ? 'has-error' : ''}`} rows={4} />
        <div className="reg-char-count">
          <span className={formData.description.length > 500 ? 'over' : ''}>{formData.description.length}</span> / 500
        </div>
        <Err field="description" />
      </div>
      <div className="reg-field-group">
        <label className="reg-label">Payment method</label>
        <p className="reg-hint-text">How would you like to receive payments?</p>
        <Err field="paymentMethod" />
        <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          {['eSewa', 'Khalti'].map(method => (
            <label key={method} className="reg-chip-label">
              <input type="radio" name="paymentMethod" value={method} checked={formData.paymentMethod === method} onChange={handleChange} />
              <span className={`reg-chip ${formData.paymentMethod === method ? 'active green' : ''}`}>{method}</span>
            </label>
          ))}
        </div>
        {(formData.paymentMethod === 'eSewa' || formData.paymentMethod === 'Khalti') && (
          <div style={{ marginTop: 14, position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              fontSize: 13, fontWeight: 600, color: '#fff',
              background: formData.paymentMethod === 'eSewa' ? '#3BB54A' : '#5C2D91',
              padding: '3px 8px', borderRadius: 6,
            }}>
              {formData.paymentMethod === 'eSewa' ? 'eSewa' : 'Khalti'}
            </span>
            <input type="text" name="paymentId" placeholder="98XXXXXXXX"
              value={formData.paymentId || ''} onChange={handleChange}
              style={{
                width: '100%', paddingLeft: 90, paddingRight: 16,
                paddingTop: 12, paddingBottom: 12,
                border: `2px solid ${formData.paymentMethod === 'eSewa' ? '#3BB54A40' : '#5C2D9140'}`,
                borderRadius: 10, fontSize: 15, outline: 'none',
                background: '#fff', boxSizing: 'border-box', color: '#1a1a1a', fontWeight: 500,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );

  // ── STEP 5 ─────────────────────────────────────────────────────────────────
  const renderStep5 = () => {
    const enabledDays = DAYS.filter(d => formData.availability[d].enabled);
    return (
      <div className="reg-step">
        <h2 className="reg-step-title">Your availability</h2>
        <p className="reg-step-sub">Turn on the days you work, then set your hours for each one</p>
        <Err field="availability" />
        <div className="reg-avail-list">
          {DAYS.map(day => {
            const { enabled, start, end } = formData.availability[day];
            const label = day.charAt(0).toUpperCase() + day.slice(1);
            const timeError = enabled && start >= end;
            return (
              <div key={day} className={`reg-avail-day-row ${enabled ? 'enabled' : ''}`}>
                <div className="reg-avail-day-left">
                  <button type="button" className={`reg-avail-toggle ${enabled ? 'on' : ''}`}
                    onClick={() => handleDayToggle(day)} aria-pressed={enabled}>
                    <span className="reg-avail-toggle-knob" />
                  </button>
                  <span className="reg-avail-day-label">{label}</span>
                </div>
                {enabled ? (
                  <div className="reg-avail-times">
                    <div className="reg-avail-time-wrap">
                      <label className="reg-avail-time-label">From</label>
                      <input type="time" value={start}
                        onChange={e => handleTimeChange(day, 'start', e.target.value)}
                        className={`reg-avail-time-input ${timeError ? 'has-error' : ''}`} />
                    </div>
                    <span className="reg-avail-time-sep">—</span>
                    <div className="reg-avail-time-wrap">
                      <label className="reg-avail-time-label">To</label>
                      <input type="time" value={end}
                        onChange={e => handleTimeChange(day, 'end', e.target.value)}
                        className={`reg-avail-time-input ${timeError ? 'has-error' : ''}`} />
                    </div>
                    {timeError && <span className="reg-avail-time-error">End must be after start</span>}
                  </div>
                ) : (
                  <span className="reg-avail-off-label">Not available</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="reg-field-group" style={{ marginTop: 24 }}>
          <label className="reg-label">Minimum booking duration</label>
          <p className="reg-hint-text">Shortest job you'll accept (in hours)</p>
          <div className="reg-rate-input-wrap" style={{ maxWidth: 180 }}>
            <input type="number" name="minHours" min="1" max="24" step="1"
              value={formData.minHours} onChange={handleChange} className="reg-rate-input" />
            <span className="reg-rate-suffix">hr{parseInt(formData.minHours, 10) !== 1 ? 's' : ''} min</span>
          </div>
        </div>
        <div className="reg-avail-quick">
          <span className="reg-avail-quick-label">Quick fill:</span>
          <button type="button" className="reg-avail-quick-btn"
            onClick={() => setFormData(prev => ({
              ...prev,
              availability: DAYS.reduce((acc, d) => ({
                ...acc,
                [d]: { enabled: !['saturday','sunday'].includes(d), start: '09:00', end: '17:00' },
              }), {}),
            }))}>Mon – Fri, 9am – 5pm</button>
          <button type="button" className="reg-avail-quick-btn"
            onClick={() => setFormData(prev => ({
              ...prev,
              availability: DAYS.reduce((acc, d) => ({
                ...acc,
                [d]: { enabled: true, start: '08:00', end: '18:00' },
              }), {}),
            }))}>Every day, 8am – 6pm</button>
          <button type="button" className="reg-avail-quick-btn"
            onClick={() => setFormData(prev => ({ ...prev, availability: makeAvailability() }))}>
            Clear all
          </button>
        </div>
    
      </div>
    );
  };

  // ── STEP 6 ─────────────────────────────────────────────────────────────────
  const renderStep6 = () => {
    if (showLiveness) {
      return (
        <LivenessCheck
          workerId={formData.email}
          referencePhoto={formData.profilePhoto}
          onComplete={result => {
            setFaceVerified(true); setFaceVerifyResult(result);
            setShowLiveness(false); setSubmitError('');
          }}
          onSkip={() => setShowLiveness(false)}
        />
      );
    }

    return (
      <div className="reg-step">
        <h2 className="reg-step-title">Almost done</h2>

        {submitError === 'face' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, marginBottom: 16, background: '#FFF1F0', border: '1.5px solid #D94F3D80' }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ fontSize: 14, color: '#D94F3D', fontWeight: 500 }}>
              Identity not verified — please complete the verification below before registering.
            </span>
          </div>
        )}

        {!faceVerified && (
          <div className="reg-face-required-banner">
            <span className="reg-face-required-icon">⚠️</span>
            <span>Identity verification is required to complete registration.</span>
          </div>
        )}
        <p className="reg-step-sub">Two final steps to build client trust</p>

        {/* Identity verification */}
        <div className="reg-verify-card">
          <div className="reg-verify-header">
            <div>
              <div className="reg-verify-title">
                Identity verification
                <span className="reg-required-badge">Required</span>
              </div>
              <div className="reg-verify-sub">We compare a live selfie to your profile photo — takes about 10 seconds.</div>
            </div>
            {faceVerified && <span className="reg-verified-badge">Verified ✓</span>}
          </div>
          {faceVerified ? (
            <div className="reg-verified-row">
              <img src={formData.profilePhoto} alt="Profile" className="reg-verify-thumb" />
              <span className="reg-verify-arrow">→</span>
              {faceVerifyResult?.selfiePhoto
                ? <img src={faceVerifyResult.selfiePhoto} alt="Selfie" className="reg-verify-thumb" />
                : <div className="reg-verify-thumb reg-verify-placeholder">Selfie</div>}
              <div className="reg-verified-info">
                <span className="reg-verified-label">Identity confirmed</span>
                {faceVerifyResult?.confidence && (
                  <span className="reg-verified-conf">Matched</span>
                )}
              </div>
              <button type="button" className="reg-text-btn"
                onClick={() => { setFaceVerified(false); setFaceVerifyResult(null); }}>Redo</button>
            </div>
          ) : (
            <div className="reg-verify-action">
              {!formData.profilePhoto ? (
                <p className="reg-warn-text">Go back to Step 4 and upload your profile photo first.</p>
              ) : (
                <>
                  <div className="reg-verify-photos">
                    <div className="reg-verify-photo-wrap">
                      <img src={formData.profilePhoto} alt="Profile" className="reg-verify-thumb-lg" />
                      <span className="reg-verify-photo-label">Your photo</span>
                    </div>
                    <span className="reg-verify-arrow-lg">→</span>
                    <div className="reg-verify-photo-wrap">
                      <div className="reg-verify-thumb-lg reg-verify-camera-placeholder">Camera</div>
                      <span className="reg-verify-photo-label">Live selfie</span>
                    </div>
                  </div>
                  <button type="button" className="reg-primary-btn"
                    style={{ width: 'auto', padding: '11px 28px' }}
                    onClick={() => setShowLiveness(true)}>Verify now</button>
                  <span className="reg-optional-note">You must verify your identity to complete registration</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* ✅ Skill evidence — ONE file per CATEGORY, optional */}
        <div className="reg-verify-card" style={{ marginTop: 16 }}>
          <div className="reg-verify-title">
            Skill evidence{' '}
            <span className="reg-required-badge" style={{ background: '#ffffff', border: '1px solid #D1D5DB' }}>Optional</span>
          </div>
          <div className="reg-verify-sub" style={{ marginBottom: 4 }}>
            Upload one proof document per service category to speed up your skill verification.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: '#F0F9FF', border: '1px solid #BAE6FD', marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: '#7A6E65' }}>
              Accepted formats: <strong>PDF, Image, Video</strong>. One file per category.
            </span>
          </div>

          {/* ✅ One row per CATEGORY */}
          <div className="reg-skill-evidence-list">
            {formData.taskTypes.map(categoryName => {
              const file      = formData.categoryProofFiles[categoryName];
              const fileError = fileErrors[categoryName];
              return (
                <div key={categoryName} className="reg-skill-evidence-row">
                  <div className="reg-skill-evidence-label">
                    <span className="reg-skill-evidence-name">{categoryName}</span>
                    {file
                      ? <span className="reg-skill-evidence-status ready">✓ Uploaded</span>
                      : <span className="reg-skill-evidence-status" style={{ color: '#6B7280', background: '#F3F4F6' }}>Optional</span>}
                  </div>
                  {fileError && (
                    <div style={{ padding: '8px 12px', borderRadius: 8, background: '#D94F3D12', border: '1px solid #D94F3D30', fontSize: 12, color: '#D94F3D', marginBottom: 8 }}>
                      ⚠️ {fileError}
                    </div>
                  )}
                  {file ? (
                    <div className="reg-upload-preview">
                      <span className="reg-upload-preview-icon">{getFileIcon(file)}</span>
                      <div className="reg-upload-preview-info">
                        <div className="reg-upload-preview-name">{file.name}</div>
                        <div className="reg-upload-preview-meta">{formatBytes(file.size)} · Ready to upload</div>
                      </div>
                      <button type="button" className="reg-upload-remove-btn"
                        onClick={() => removeCategoryEvidenceFile(categoryName)}>✕</button>
                    </div>
                  ) : (
                    <label className="reg-skill-evidence-upload-label">
                      <input type="file" accept={EVIDENCE_ACCEPT} style={{ display: 'none' }}
                        onChange={e => {
                          if (e.target.files[0]) handleCategoryEvidenceFile(categoryName, e.target.files[0]);
                          e.target.value = '';
                        }} />
                      <span className="reg-skill-evidence-upload-btn">Upload proof for {categoryName}</span>
                      <span className="reg-skill-evidence-upload-hint">PDF · Image · Video · Optional</span>
                    </label>
                  )}
                </div>
              );
            })}
          </div>

          {formData.taskTypes.length > 0 && (
            <div className="reg-skill-evidence-summary">
              {Object.keys(formData.categoryProofFiles).length} of {formData.taskTypes.length} categor{formData.taskTypes.length !== 1 ? 'ies' : 'y'} have evidence attached
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── STEP 7 ─────────────────────────────────────────────────────────────────
  const renderStep7 = () => (
    <div className="reg-step">
      <h2 className="reg-step-title">Verify your email</h2>
      <p className="reg-step-sub">One last step — confirm your email address</p>
      {submitError === 'otp' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, marginBottom: 16, background: '#FFF1F0', border: '1.5px solid #D94F3D80' }}>
   
          <span style={{ fontSize: 14, color: '#D94F3D', fontWeight: 500 }}>
            Please verify your email below before completing registration.
          </span>
        </div>
      )}
      {otpVerified ? (
        <div className="reg-verified-row">
          <span className="reg-verified-label">✓ Email verified</span>
          <button type="button" className="reg-text-btn"
            onClick={() => { setOtpVerified(false); setOtpSent(false); setOtpCode(''); setOtpError(''); setOtpResendMsg(''); }}>
            Redo
          </button>
        </div>
      ) : !otpSent ? (
        <div className="reg-verify-action">
          {otpError && <p className="reg-error" style={{ marginBottom: 8 }}>{otpError}</p>}
          <button type="button" className="reg-primary-btn" style={{ width: 'auto', padding: '11px 28px' }}
            onClick={sendOtpHandler} disabled={otpLoading}>
            {otpLoading ? 'Sending…' : 'Send verification code'}
          </button>
        </div>
      ) : (
        <div className="reg-verify-action">
          <p style={{ fontSize: 13, color: '#7A6E65', marginBottom: 10 }}>
            Enter the 4-digit code sent to <strong>{formData.email}</strong>
          </p>
          {otpError     && <p className="reg-error"        style={{ marginBottom: 8 }}>{otpError}</p>}
          {otpResendMsg && <p className="reg-success-note" style={{ marginBottom: 8 }}>{otpResendMsg}</p>}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="text" maxLength="4" placeholder="• • • •" value={otpCode}
              onChange={e => { setOtpCode(e.target.value); setOtpError(''); }}
              style={{
                width: 120, textAlign: 'center', letterSpacing: '0.3em',
                fontSize: 22, fontWeight: 600, padding: '10px 12px',
                border: `2px solid ${otpError ? '#D94F3D' : '#E0D8D0'}`,
                borderRadius: 10, outline: 'none',
              }}
            />
            <button type="button" className="reg-primary-btn" style={{ width: 'auto', padding: '11px 24px' }}
              onClick={verifyOtpHandler} disabled={otpLoading}>
              {otpLoading ? 'Verifying…' : 'Verify'}
            </button>
          </div>
          <button type="button" className="reg-text-btn" style={{ marginTop: 10 }}
            onClick={resendOtpHandler} disabled={otpLoading}>
            Resend code
          </button>
        </div>
      )}
    </div>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────────
  const stepLabels = ['Account','Skills & Services','Service Areas','Profile','Availability','Verification','Email Verification'];

  return (
    <div className="reg-root">
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 20px', borderRadius: 12,
          background: toast.type === 'success' ? '#1a1a1a' : '#D94F3D',
          color: '#fff', fontSize: 14, fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          animation: 'slideIn 0.25s ease',
        }}>
          <span style={{ fontSize: 18 }}>{toast.type === 'success' ? '✓' : '✕'}</span>
          {toast.message}
        </div>
      )}
      <div className="reg-card">
        <ProgressBar steps={stepLabels} currentStep={step} marginBottom="124px" />
        <form onSubmit={handleSubmit} className="reg-form">
          {step === 1 && <RegistrationForm formData={formData} handleChange={handleChange} errors={errors} />}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
          {step === 6 && renderStep6()}
          {step === 7 && renderStep7()}

          {!showLiveness && (
            <div className="reg-nav">
              {step > 1 && (
                <button type="button" onClick={prevStep} className="reg-back-btn">Back</button>
              )}
              {step < 7
                ? <button type="button" onClick={nextStep} className="reg-next-btn" disabled={isValidating}>Continue</button>
                : (
                  <button type="submit" className="reg-submit-btn"
                    style={!faceVerified || !otpVerified ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>
                    Complete registration
                  </button>
                )
              }
            </div>
          )}
        </form>
        <p className="reg-signin-note">
          Already have an account?{' '}
          <button type="button" className="reg-text-btn" onClick={() => window.location.href = '/login'}>Sign in</button>
        </p>
      </div>
      <WhatsAppSupport />
    </div>
  );
};

export default ServiceRegistration;