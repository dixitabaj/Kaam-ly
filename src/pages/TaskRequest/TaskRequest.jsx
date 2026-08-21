import React, { useState } from 'react';
import { Camera, Upload, ChevronRight, Check, AlertCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import BookingNavbar from "../../components/Navbar/Navbar";
import LocationPicker from '../../components/Location';
import ChatWidget from '../../components/HelpSection/HelpSection';

/* ─────────────────────────────────────────────
   VALIDATION HELPERS
───────────────────────────────────────────── */
const validateStep1 = (taskDescription) => {
  if (!taskDescription.trim())
    return 'Please describe your task.';
  if (taskDescription.trim().length < 5)
    return 'Please provide more detail (at least 5 characters).';
  if (taskDescription.trim().length > 1000)
    return 'Description is too long (max 1000 characters).';
  return null;
};

const validateStep2 = (selectedDate) => {
  if (!selectedDate)
    return 'Please select when you need the service.';
  return null;
};

const validateStep3 = (locationData) => {
  if (!locationData)
    return 'Please select your location on the map.';
  if (!locationData.address)
    return 'Could not determine address. Please pick a more specific location.';
  return null;
};

/* ─────────────────────────────────────────────
   ERROR MESSAGE COMPONENT
───────────────────────────────────────────── */
const ErrorMsg = ({ message }) => {
  if (!message) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: '#fef2f2', border: '1px solid #fecaca',
      borderRadius: 8, padding: '10px 14px',
      marginTop: 10, color: '#dc2626', fontSize: 13, fontWeight: 500,
    }}>
      <AlertCircle size={15} style={{ flexShrink: 0 }} />
      {message}
    </div>
  );
};

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
const TaskBookingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const predictedUserService = localStorage.getItem('predictedCategory');
  const predictedService = predictedUserService? JSON.parse(predictedUserService).predicted_label
 : null;

  const preSelectedService =  predictedService || location.state?.taskCategory || '';

  const [currentStep,        setCurrentStep]        = useState(1);
  const [taskDescription,    setTaskDescription]    = useState('');
  const [selectedDate,       setSelectedDate]       = useState('');
  const [locationData,       setLocationData]       = useState(null);
  const [stepErrors,         setStepErrors]         = useState({ 1: null, 2: null, 3: null });
  const [isSubmitting,       setIsSubmitting]       = useState(false);

  const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
  const userId     = storedUser ? JSON.parse(storedUser).id : null;

  const timeOptions = [
    { id: 'today',     label: 'Today' },
    { id: 'tomorrow',  label: 'Tomorrow' },
    { id: 'this_week', label: 'This week' },
    { id: 'next_week', label: 'Next week' },
  ];

  const setError = (step, msg) =>
    setStepErrors(prev => ({ ...prev, [step]: msg }));

  const clearError = (step) =>
    setStepErrors(prev => ({ ...prev, [step]: null }));

  /* ── Step navigation with validation ── */
  const goToStep2 = () => {
    const err = validateStep1(taskDescription);
    if (err) { setError(1, err); return; }
    clearError(1);
    setCurrentStep(2);
  };

  const goToStep3 = () => {
    const err = validateStep2(selectedDate);
    if (err) { setError(2, err); return; }
    clearError(2);
    setCurrentStep(3);
  };

  const handleLocationSelect = (data) => {
    setLocationData(data);
    clearError(3);
  };

  /* ── Submit ── */
  const handleSubmit = async () => {
    const err = validateStep3(locationData);
    if (err) { setError(3, err); return; }
    clearError(3);

    if (!userId) {
      setError(3, 'You must be logged in to submit a task.');
      return;
    }

    setIsSubmitting(true);
    try {
      const taskRequest = {
        taskName:          taskDescription,
        taskType:          preSelectedService,
        completionTime:    selectedDate,
        address:           locationData.address,
        lat:               locationData.lat,
        lng:               locationData.lng,
        userId,
        createdAt:         new Date().toISOString(),
      };

      localStorage.setItem('pendingTaskRequest', JSON.stringify(taskRequest));

      // Reset
      setCurrentStep(1);
      setTaskDescription('');
      setSelectedDate('');
      setLocationData(null);

      navigate('/workerList');
    } catch (err) {
      setError(3, 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Character count color ── */
  const descLen     = taskDescription.length;
  const descColor   = descLen > 1000 ? '#ef4444' : descLen > 800 ? '#f6ad56' : '#94a3b8';

  /* ── Steps ── */
  const renderStep = () => {
    switch (currentStep) {

      /* ── STEP 1: Description ── */
      case 1:
        return (
          <div className="step-content">
            
            <h2 className="step-title">What do you need help with?</h2>
            <p className="step-description">Describe your task in detail so workers understand what's needed.</p>

            <textarea
              className="task-description-input"
              placeholder="e.g., I need help fixing a leaking pipe under the kitchen sink. The pipe has been dripping for 2 days..."
              value={taskDescription}
              onChange={(e) => {
                setTaskDescription(e.target.value);
                // Clear error as user types past minimum
                if (e.target.value.trim().length >= 5) clearError(1);
              }}
              rows={6}
              style={{
                borderColor: stepErrors[1] ? '#ef4444' : descLen > 1000 ? '#ef4444' : '#e5e7eb',
              }}
            />

            {/* Character count */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
             
              <span style={{ fontSize: 12, color: descColor, marginLeft: 'auto' }}>
                {descLen} / 1000
              </span>
            </div>

            <ErrorMsg message={stepErrors[1]} />

            <div className="step-actions">
              <div /> {/* spacer */}
              <button className="next-button" onClick={goToStep2}>
                Next <ChevronRight size={20} />
              </button>
            </div>
          </div>
        );

      /* ── STEP 2: Timing ── */
      case 2:
        return (
          <div className="step-content">
            <h2 className="step-title">When do you need the service?</h2>
            <p className="step-description">Choose your preferred timing.</p>

            <div className="time-options">
              {timeOptions.map((option) => (
                <label
                  key={option.id}
                  className={`time-option ${selectedDate === option.id ? 'selected' : ''}`}
                  onClick={() => { setSelectedDate(option.id); clearError(2); }}
                >
                  <div className="time-option-content">
                    <input
                      type="radio"
                      name="time"
                      value={option.id}
                      checked={selectedDate === option.id}
                      onChange={() => {}}
                    />
                    <span className="time-label">{option.label}</span>
                  </div>
                  {selectedDate === option.id && <Check size={20} className="check-icon" />}
                </label>
              ))}
            </div>

            <ErrorMsg message={stepErrors[2]} />

            <div className="step-actions">
              <button className="back-button" onClick={() => setCurrentStep(1)}>Back</button>
              <button className="next-button" onClick={goToStep3}>
                Next <ChevronRight size={20} />
              </button>
            </div>
          </div>
        );

      /* ── STEP 3: Location ── */
      case 3:
        return (
          <div className="step-content">
            <h2 className="step-title">Where do you need the service?</h2>
            <p className="step-description">Pin your location so we can find workers nearby.</p>

            <LocationPicker onLocationSelect={handleLocationSelect} />

           

            <ErrorMsg message={stepErrors[3]} />

            <div className="step-actions">
              <button className="back-button" onClick={() => setCurrentStep(2)}>Back</button>
              <button
                className="submit-button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{ opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
              >
                {isSubmitting ? 'Submitting...' : 'Find Workers'}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="task-booking-page">
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }

        .task-booking-page {
          min-height: 100vh;
          background-color: #f9fafb;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        .progress-steps {
          background-color: white;
          padding: 2rem 0;
          border-bottom: 1px solid #e5e7eb;
        }

        .progress-steps > div {
          max-width: 48rem;
          margin: 0 auto;
          padding: 0 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .step-indicator { display: flex; align-items: center; flex: 1; }

        .step-number {
          width: 2.5rem; height: 2.5rem; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-weight: 600; background-color: #e5e7eb; color: #6b7280;
          transition: all 0.3s;
        }
        .step-number.active { background-color: #F6AD56; color: white; }

        .step-connector { flex: 1; }
        .connector-line {
          height: 2px; background-color: #e5e7eb;
          margin: 0 0.5rem; transition: background-color 0.3s;
        }
        .connector-line.active { background-color: #F6AD56; }

        .booking-container {
          max-width: 64rem; margin: 0 auto; padding: 3rem 1rem;
        }

        .booking-card {
          background-color: white; border-radius: 0.75rem;
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.07); padding: 2rem;
        }

        .step-content { animation: fadeIn 0.25s ease; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .step-title {
          font-size: 1.5rem; font-weight: 700;
          margin-bottom: 0.4rem; color: #111827;
        }
        .step-description { color: #6b7280; margin-bottom: 1.5rem; font-size: 14px; }

        .task-description-input {
          width: 100%; padding: 1rem;
          border: 2px solid #e5e7eb; border-radius: 0.5rem;
          font-size: 1rem; font-family: inherit; resize: vertical;
          transition: border-color 0.2s; outline: none;
        }
        .task-description-input:focus { border-color: #F6AD56; }

        .time-options {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .time-option {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          border: 2px solid #e5e7eb;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .time-option:hover {
          background-color: #f9fafb;
        }


        .time-option-content {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .time-label {
          font-weight: 500;
        }

        .time-option input[type="radio"] {
          width: 1.25rem;
          height: 1.25rem;
          cursor: pointer;
        }
        .check-icon { color: #F6AD56; }

        .step-actions {
          display: flex; justify-content: space-between;
          align-items: center; margin-top: 1.5rem;
        }

        .back-button, .next-button, .submit-button {
          padding: 0.75rem 1.5rem; border-radius: 0.5rem;
          font-weight: 600; cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; gap: 0.5rem;
          border: none; font-size: 1rem;
        }
        .back-button {
          border: 2px solid #d1d5db; background-color: white; color: #374151;
        }
        .back-button:hover { background-color: #f9fafb; }

        .next-button { background-color: #F6AD56; color: white; }
        .next-button:hover { background-color: #e59a3d; }

        .submit-button { background-color: #F6AD56; color: white; }
        .submit-button:hover { background-color: #e59a3d; }

        @media (max-width: 768px) {
          .booking-card { padding: 1.25rem; }
          .step-title { font-size: 1.2rem; }
        }
      `}</style>

      <BookingNavbar />

      {/* Progress bar */}
      <div className="progress-steps">
        <div>
          {[1, 2, 3].map((step) => (
            <div key={step} className="step-indicator">
              <div className={`step-number ${currentStep >= step ? 'active' : ''}`}>
                {currentStep > step ? <Check size={16} /> : step}
              </div>
              {step < 3 && (
                <div className="step-connector">
                  <div className={`connector-line ${currentStep > step ? 'active' : ''}`} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="booking-container">
        <div className="booking-card">
          {renderStep()}
        </div>
      </div>
      <ChatWidget/>
    </div>
  );
};

export default TaskBookingPage;