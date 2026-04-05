// ServiceRegistration.jsx
import React, { useState } from 'react';
import ProgressBar from '../../components/ProgressBar/ProgressBar';
import RegistrationForm from '../../components/RegistrationForm/RegistrationForm';
import LivenessCheck from '../../components/FaceVerification/LivenessCheck';
import './registration.css';
import { checkEmailExists, checkPhoneExists } from '../../api/api';
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

  const [formData, setFormData] = useState({
    firstName:        '',
    lastName:         '',
    email:            '',
    phone:            '',
    password:         '',
    confirmPassword:  '',
    serviceCategories: [],   // ← now an array (was serviceCategory: '')
    skills:           [],
    subSkills:        {},
    hourlyRates:      {},
    serviceAreas:     [],
    profilePhoto:     '',
    description:      '',
    skillProofFiles:  {},
    availability:     makeAvailability(),
    minHours:         1,
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
  ];

  const categorySkillsMap = {
    Plumbing:          { Plumbing:          ['Pipe Repair','Drain Cleaning','Sewer Repair','Fixture Installation','Water Heater Repair'] },
    Moving:            { Moving:            ['Packing','Loading & Unloading','Furniture Moving','Relocation Support'] },
    Cleaning:          { Cleaning:          ['House Cleaning','Office Cleaning','Carpet Cleaning','Window Cleaning','Laundry & Ironing'] },
    Gardening:         { Gardening:         ['Lawn Care','Landscaping','Tree Service','Plant Care','Garden Maintenance'] },
    Painting:          { Painting:          ['Interior Painting','Exterior Painting','Wall Painting','Touch-ups & Patching'] },
    Carpentry:         { Carpentry:         ['Furniture Repair','Cabinet Making','Shelving & Storage','Woodwork','Joinery'] },
    'Appliance Repair':{ 'Appliance Repair':['Washer Repair','Dryer Repair','Fridge Repair','Oven Repair'] },
    Electrical:        { Electrical:        ['Wiring & Rewiring','Lighting Installation','Circuit Repair','Outlet & Switch Repair'] },
    HVAC:              { HVAC:              ['Heating Repair','Air Conditioning','Ventilation','Furnace Repair','Cooling Systems'] },
    Assembly:          { Assembly:          ['Furniture Assembly','Flat-pack Assembly','TV Mounting','Shelving Installation'] },
  };

  const serviceAreasList = [
    'Kathmandu','Lalitpur','Bhaktapur','Pokhara','Chitwan',
    'Butwal','Biratnagar','Dharan','Nepalgunj','Dhangadhi',
    'Hetauda','Janakpur','Bharatpur','Itahari','Birgunj',
  ];

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // ── NEW: toggle a category on/off (multi-select) ───────────────────────────
  const handleCategoryToggle = (catId) => {
    setFormData(prev => {
      const already = prev.serviceCategories.includes(catId);

      if (already) {
        // Remove all skills/subSkills/rates/files that belong to this category
        const skillsToRemove = Object.keys(categorySkillsMap[catId] || {});
        const newSkills  = prev.skills.filter(s => !skillsToRemove.includes(s));
        const newSub     = { ...prev.subSkills };
        const newRates   = { ...prev.hourlyRates };
        const newFiles   = { ...prev.skillProofFiles };
        skillsToRemove.forEach(s => {
          delete newSub[s];
          delete newFiles[s];
          Object.keys(newRates).forEach(k => {
            if (k.startsWith(`${s}::`)) delete newRates[k];
          });
        });
        return {
          ...prev,
          serviceCategories: prev.serviceCategories.filter(c => c !== catId),
          skills:            newSkills,
          subSkills:         newSub,
          hourlyRates:       newRates,
          skillProofFiles:   newFiles,
        };
      }

      // Add category
      return { ...prev, serviceCategories: [...prev.serviceCategories, catId] };
    });

    if (errors.serviceCategory) setErrors(prev => ({ ...prev, serviceCategory: '' }));
  };

  const handleSkillToggle = (skill) => {
    setFormData(prev => {
      if (prev.skills.includes(skill)) {
        const newSub   = { ...prev.subSkills };
        const newRates = { ...prev.hourlyRates };
        const newFiles = { ...prev.skillProofFiles };
        delete newSub[skill];
        delete newFiles[skill];
        Object.keys(newRates).forEach(key => {
          if (key.startsWith(`${skill}::`)) delete newRates[key];
        });
        return { ...prev, skills: prev.skills.filter(s => s !== skill), subSkills: newSub, hourlyRates: newRates, skillProofFiles: newFiles };
      }
      return { ...prev, skills: [...prev.skills, skill], subSkills: { ...prev.subSkills, [skill]: [] } };
    });
    if (errors.skills) setErrors(prev => ({ ...prev, skills: '' }));
  };

  const handleSubSkillToggle = (parent, sub) => {
    setFormData(prev => {
      const cur     = prev.subSkills[parent] || [];
      const newSubs = cur.includes(sub) ? cur.filter(s => s !== sub) : [...cur, sub];
      const newRates = { ...prev.hourlyRates };
      if (cur.includes(sub)) delete newRates[`${parent}::${sub}`];
      return {
        ...prev,
        subSkills:   { ...prev.subSkills, [parent]: newSubs },
        hourlyRates: newRates,
      };
    });
  };

  const handleHourlyRateChange = (skill, subSkill, value) => {
    setFormData(prev => ({
      ...prev,
      hourlyRates: { ...prev.hourlyRates, [`${skill}::${subSkill}`]: value },
    }));
    if (errors.hourlyRates) setErrors(prev => ({ ...prev, hourlyRates: '' }));
  };

  const handleServiceAreaToggle = (area) => {
    setFormData(prev => ({
      ...prev,
      serviceAreas: prev.serviceAreas.includes(area)
        ? prev.serviceAreas.filter(a => a !== area)
        : [...prev.serviceAreas, area],
    }));
    if (errors.serviceAreas) setErrors(prev => ({ ...prev, serviceAreas: '' }));
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

  const handleEvidenceFile = (skill, file) => {
    if (!file) return;
    const isPdf   = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isPdf && !isImage && !isVideo) {
      setFileErrors(prev => ({ ...prev, [skill]: 'Only PDF, image, or video files are allowed.' }));
      return;
    }
    setFileErrors(prev => { const n = { ...prev }; delete n[skill]; return n; });
    setFormData(p => ({ ...p, skillProofFiles: { ...p.skillProofFiles, [skill]: file } }));
  };

  const removeEvidenceFile = (skill) => {
    setFormData(p => {
      const updated = { ...p.skillProofFiles };
      delete updated[skill];
      return { ...p, skillProofFiles: updated };
    });
    setFileErrors(prev => { const n = { ...prev }; delete n[skill]; return n; });
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
      // ← updated: check array length instead of single value
      if (formData.serviceCategories.length === 0) e.serviceCategory = 'Pick at least one category';
      if (formData.skills.length < 1)              e.skills          = 'Select at least one skill';

      const missingSubs = formData.skills.some(skill =>
        (formData.subSkills[skill] || []).length === 0
      );
      if (missingSubs) e.skills = 'Select at least one job type for each skill';

      const missingRates = formData.skills.some(skill =>
        (formData.subSkills[skill] || []).some(sub =>
          !formData.hourlyRates[`${skill}::${sub}`] ||
          parseFloat(formData.hourlyRates[`${skill}::${sub}`]) <= 0
        )
      );
      const over = Object.values(formData.hourlyRates).some(v => parseFloat(v) > 10000);
      if (missingRates)  e.hourlyRates = 'Set a rate for each selected job type';
      else if (over)     e.hourlyRates = 'Rate seems too high (max 10,000 NPR)';
    }

    if (step === 3) {
      if (!formData.profilePhoto)                  e.profilePhoto = 'Profile photo is required';
      if (!formData.description.trim())             e.description  = 'Write a short description';
      else if (formData.description.length > 500)   e.description  = 'Keep it under 500 characters';
      if (formData.serviceAreas.length === 0)       e.serviceAreas = 'Pick at least one area';
    }

    if (step === 4) {
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

  // ── nextStep blocks if validation fails ────────────────────────────────────
  const nextStep = async () => {
    setIsValidating(true);
    const valid = await validateStep();
    setIsValidating(false);
    if (valid) {
      setStep(p => Math.min(p + 1, 5));
    } else {
      setTimeout(() => {
        const firstError = document.querySelector('.reg-error');
        if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  };
  const prevStep = () => setStep(p => Math.max(p - 1, 1));

  // ── Build hours payload ────────────────────────────────────────────────────
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

    if (!faceVerified) {
      alert('Please complete identity verification before registering.');
      return;
    }

    const skillsPayload = formData.skills.map(skillName => ({
      name:      skillName,
      subSkills: (formData.subSkills[skillName] || []).map(sub => ({
        name:  sub,
        price: parseFloat(formData.hourlyRates[`${skillName}::${sub}`]) || 0,
      })),
    }));

    const payload = {
      firstName:      formData.firstName,
      lastName:       formData.lastName,
      phoneNo:        formData.phone,
      email:          formData.email,
      password:       formData.password,
      taskType:       formData.serviceCategories.join(', '), // ← joined array
      skills:         skillsPayload,
      minHours:       parseInt(formData.minHours, 10) || 1,
      isAvailable:    true,
      face_verified:  faceVerified,
      skill_verified: false,
      serviceAreas:   formData.serviceAreas,
      profilePhoto:   formData.profilePhoto,
      description:    formData.description,
      role:           'worker',
      hours:          buildHoursPayload(),
    };

    try {
      const res  = await fetch('http://localhost:8000/api/worker', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        alert('Error: ' + (data.detail || data.message || 'Something went wrong'));
        return;
      }

      const evidenceEntries = Object.entries(formData.skillProofFiles);
      if (evidenceEntries.length > 0) {
        for (const [skill, file] of evidenceEntries) {
          try {
            const fd = new FormData();
            fd.append('file',      file);
            fd.append('worker_id', formData.email);
            fd.append('skill',     skill);
            await fetch('http://localhost:8000/api/upload/skill-evidence', { method: 'POST', body: fd });
          } catch {
            console.warn(`Skill evidence upload failed for ${skill}, worker still registered.`);
          }
        }
      }

      alert('Registration successful!');
      window.location.href = '/login';

    } catch {
      alert('Something went wrong. Please try again.');
    }
  };

  const Err = ({ field }) =>
    errors[field] ? <span className="reg-error">{errors[field]}</span> : null;

  // ── STEP 2 ─────────────────────────────────────────────────────────────────
  const renderStep2 = () => {
    // ← Merge skills from ALL selected categories
    const skillMap = formData.serviceCategories.reduce((acc, cat) => ({
      ...acc, ...(categorySkillsMap[cat] || {}),
    }), {});

    return (
      <div className="reg-step">
        <h2 className="reg-step-title">What do you offer?</h2>
        <p className="reg-step-sub">Pick one or more categories, then select your skills and set rates per job type</p>

        <div className="reg-field-group">
          <label className="reg-label">Service category</label>
          <Err field="serviceCategory" />
          {/* ← checkboxes instead of radio buttons */}
          <div className="reg-category-grid">
            {serviceCategories.map(cat => (
              <label key={cat.id} className="reg-category-option">
                <input
                  type="checkbox"
                  value={cat.id}
                  checked={formData.serviceCategories.includes(cat.id)}
                  onChange={() => handleCategoryToggle(cat.id)}
                />
                <span className={`reg-category-pill ${formData.serviceCategories.includes(cat.id) ? 'active' : ''}`}>
                  {cat.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {formData.serviceCategories.length > 0 && (
          <div className="reg-field-group">
            <label className="reg-label">Skills & rates</label>
            <p className="reg-hint-text">
              Select a skill, pick the job types you do, then set your hourly rate for each one.
            </p>
            <Err field="skills" />
            <Err field="hourlyRates" />

            <div className="reg-skill-list">
              {Object.keys(skillMap).map(skill => {
                const subs       = skillMap[skill];
                const isSelected = formData.skills.includes(skill);
                const selSubs    = formData.subSkills[skill] || [];

                return (
                  <div key={skill} className={`reg-skill-card ${isSelected ? 'active' : ''}`}>
                    <label className="reg-skill-toggle">
                      <input type="checkbox" checked={isSelected} onChange={() => handleSkillToggle(skill)} />
                      <div className="reg-skill-check">
                        {isSelected && <span className="reg-checkmark">✓</span>}
                      </div>
                      <span className="reg-skill-name">{skill}</span>
                      {subs.length > 0 && <span className="reg-skill-hint">{subs.length} job types</span>}
                    </label>

                    {isSelected && subs.length > 0 && (
                      <div className="reg-sub-wrap">
                        <p className="reg-sub-label">Select job types and set your rate for each:</p>
                        <div className="reg-sub-rate-list">
                          {subs.map(sub => {
                            const isSubSelected = selSubs.includes(sub);
                            return (
                              <div key={sub} className={`reg-sub-rate-row ${isSubSelected ? 'selected' : ''}`}>
                                <label className="reg-sub-rate-check">
                                  <input type="checkbox" checked={isSubSelected}
                                    onChange={() => handleSubSkillToggle(skill, sub)} />
                                  <span className={`reg-sub-rate-name ${isSubSelected ? 'active' : ''}`}>{sub}</span>
                                </label>

                                {isSubSelected && (
                                  <div className="reg-rate-input-wrap">
                                    <span className="reg-rate-prefix">NPR</span>
                                    <input
                                      type="number" min="0" step="50" placeholder="500"
                                      value={formData.hourlyRates[`${skill}::${sub}`] || ''}
                                      onChange={e => handleHourlyRateChange(skill, sub, e.target.value)}
                                      className={`reg-rate-input ${errors.hourlyRates ? 'has-error' : ''}`}
                                    />
                                    <span className="reg-rate-suffix">/ hr</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── STEP 3 ─────────────────────────────────────────────────────────────────
  const renderStep3 = () => (
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
                  setFaceVerified(false);
                  setFaceVerifyResult(null);
                  if (errors.profilePhoto) setErrors(p => ({ ...p, profilePhoto: '' }));
                };
                reader.readAsDataURL(file);
              }} />
            <button type="button" className="reg-outline-btn"
              onClick={() => document.getElementById('photoInput').click()}>
              {formData.profilePhoto ? 'Change photo' : 'Upload photo'}
            </button>
            {formData.profilePhoto && (
              <p className="reg-success-note">Your selfie in the last step will be matched against this photo.</p>
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
        <label className="reg-label">Where do you work?</label>
        <Err field="serviceAreas" />
        <div className="reg-chips" style={{ marginTop: 8 }}>
          {serviceAreasList.map(area => (
            <label key={area} className="reg-chip-label">
              <input type="checkbox" checked={formData.serviceAreas.includes(area)}
                onChange={() => handleServiceAreaToggle(area)} />
              <span className={`reg-chip ${formData.serviceAreas.includes(area) ? 'active green' : ''}`}>{area}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  // ── STEP 4 ─────────────────────────────────────────────────────────────────
  const renderStep4 = () => {
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
            <span className="reg-rate-suffix">
              hr{parseInt(formData.minHours, 10) !== 1 ? 's' : ''} min
            </span>
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

        {enabledDays.length > 0 && (
          <div className="reg-avail-summary">
            <span className="reg-avail-summary-title">
              {enabledDays.length} day{enabledDays.length !== 1 ? 's' : ''} selected
            </span>
            <div className="reg-avail-summary-rows">
              {enabledDays.map(day => {
                const { start, end } = formData.availability[day];
                const fmt = t => {
                  const [h, m] = t.split(':');
                  const hr = parseInt(h, 10);
                  return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
                };
                return (
                  <div key={day} className="reg-avail-summary-row">
                    <span className="reg-avail-summary-day">{day.charAt(0).toUpperCase() + day.slice(1)}</span>
                    <span className="reg-avail-summary-time">{fmt(start)} – {fmt(end)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── STEP 5 ─────────────────────────────────────────────────────────────────
  const renderStep5 = () => {
    if (showLiveness) {
      return (
        <LivenessCheck
          workerId={formData.email}
          referencePhoto={formData.profilePhoto}
          onComplete={result => { setFaceVerified(true); setFaceVerifyResult(result); setShowLiveness(false); }}
          onSkip={() => setShowLiveness(false)}
        />
      );
    }

    return (
      <div className="reg-step">
        <h2 className="reg-step-title">Almost done</h2>
        {!faceVerified && (
          <div className="reg-face-required-banner">
            <span className="reg-face-required-icon">⚠️</span>
            <span>Identity verification is required to complete registration.</span>
          </div>
        )}
        <p className="reg-step-sub">Two final steps to build client trust</p>

        <div className="reg-verify-card">
          <div className="reg-verify-header">
            <div>
              <div className="reg-verify-title">
                Identity verification
                <span className="reg-required-badge">Required</span>
              </div>
              <div className="reg-verify-sub">
                We compare a live selfie to your profile photo — takes about 10 seconds.
              </div>
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
                  <span className="reg-verified-conf">{faceVerifyResult.confidence}% match</span>
                )}
              </div>
              <button type="button" className="reg-text-btn"
                onClick={() => { setFaceVerified(false); setFaceVerifyResult(null); }}>Redo</button>
            </div>
          ) : (
            <div className="reg-verify-action">
              {!formData.profilePhoto
                ? <p className="reg-warn-text">Go back to Step 3 and upload your profile photo first.</p>
                : (
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
                    <span className="reg-optional-note">
                      You must verify your identity to complete registration
                    </span>
                  </>
                )}
            </div>
          )}
        </div>

        <div className="reg-verify-card" style={{ marginTop: 16 }}>
          <div className="reg-verify-title">
            Skill evidence <span className="reg-optional-tag">(optional)</span>
          </div>
          <div className="reg-verify-sub" style={{ marginBottom: 4 }}>
            Upload proof for each skill — photo, video, or PDF certificate.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: '#FFF8F0', border: '1px solid #E8843A30', marginBottom: 16 }}>
            <span style={{ fontSize: 13 }}>ℹ️</span>
            <span style={{ fontSize: 12, color: '#7A6E65' }}>
              Accepted formats: <strong>PDF, Image, Video</strong>. Word documents (.docx) are not supported.
            </span>
          </div>

          <div className="reg-skill-evidence-list">
            {formData.skills.map(skill => {
              const file      = formData.skillProofFiles[skill];
              const fileError = fileErrors[skill];
              return (
                <div key={skill} className="reg-skill-evidence-row">
                  <div className="reg-skill-evidence-label">
                    <span className="reg-skill-evidence-name">{skill}</span>
                    {file
                      ? <span className="reg-skill-evidence-status ready">✓ Ready</span>
                      : <span className="reg-skill-evidence-status empty">No file</span>}
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
                        onClick={() => removeEvidenceFile(skill)}>✕</button>
                    </div>
                  ) : (
                    <label className="reg-skill-evidence-upload-label">
                      <input type="file" accept={EVIDENCE_ACCEPT} style={{ display: 'none' }}
                        onChange={e => { if (e.target.files[0]) handleEvidenceFile(skill, e.target.files[0]); e.target.value = ''; }} />
                      <span className="reg-skill-evidence-upload-btn">⬆️ Upload for {skill}</span>
                      <span className="reg-skill-evidence-upload-hint">PDF · Image · Video</span>
                    </label>
                  )}
                </div>
              );
            })}
          </div>

          {formData.skills.length > 0 && (
            <div className="reg-skill-evidence-summary">
              {Object.keys(formData.skillProofFiles).length} of {formData.skills.length} skill{formData.skills.length !== 1 ? 's' : ''} have evidence attached
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  const stepLabels = ['Account','Skills','Profile','Availability','Verify'];

  return (
    <div className="reg-root">
      <div className="reg-card">
        <ProgressBar steps={stepLabels} currentStep={step} marginBottom="124px" />
        <form onSubmit={handleSubmit} className="reg-form">
          {step === 1 && <RegistrationForm formData={formData} handleChange={handleChange} errors={errors} />}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}

          {!showLiveness && (
            <div className="reg-nav">
              {step > 1 && (
                <button type="button" onClick={prevStep} className="reg-back-btn">Back</button>
              )}
              {step < 5
                ? <button type="button" onClick={nextStep} className="reg-next-btn" disabled={isValidating}>
                    {'Continue'}
                  </button>
                : (
                  <button type="submit" className="reg-submit-btn"
                    style={!faceVerified ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>
                    Complete registration
                  </button>
                )
              }
            </div>
          )}
        </form>

        <p className="reg-signin-note">
          Already have an account?{' '}
          <button type="button" className="reg-text-btn"
            onClick={() => window.location.href = '/login'}>Sign in</button>
        </p>
      </div>
      <WhatsAppSupport/>
    </div>
  );
};

export default ServiceRegistration;