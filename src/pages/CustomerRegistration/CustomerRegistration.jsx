import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { registerCustomer, checkEmailExists, checkPhoneExists } from '../../api/api';
import eyeOpenIcon from "../../images/open.png";
import eyeCloseIcon from "../../images/closed.png";
import logo from "../../images/logo.png";
import './customerRegistration.css';

const CustomerRegistration = () => {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const [successMessage, setSuccessMessage] = useState('');
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }

  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    password: '', confirmPassword: '', address: '', province: '',
    agreeToTerms: false,
  });

  const [verificationCode, setVerificationCode] = useState('');
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = async () => {
    const newErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    } else {
      try {
        const emailExists = await checkEmailExists(formData.email);
        if (emailExists) newErrors.email = 'This email is already registered';
      } catch (err) { console.error(err); }
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Phone number must be 10 digits';
    } else {
      try {
        const phoneExists = await checkPhoneExists(formData.phone);
        if (phoneExists) newErrors.phone = 'This phone number is already registered';
      } catch (err) { console.error(err); }
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (!formData.agreeToTerms) newErrors.agreeToTerms = 'You must agree to the terms and conditions';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    const isValid = await validateForm();
    if (!isValid) { setIsSubmitting(false); return; }
    try {
      const res = await fetch("http://localhost:8000/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to send verification code");
      setStep(2);
      setErrors({});
    } catch (err) {
      setErrors({ general: err.message || 'Failed to send verification code. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!verificationCode.trim()) { setErrors({ verification: 'Please enter the verification code' }); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch("http://localhost:8000/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, otp: verificationCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors({ verification: data.detail || "Invalid verification code. Please try again." });
        setIsSubmitting(false);
        return;
      }
      const payload = {
        first_name: formData.firstName, last_name: formData.lastName,
        email: formData.email, password: formData.password,
        phoneNo: formData.phone, address: formData.address,
        province: formData.province, role: "customer"
      };
      await registerCustomer(payload);
      setSuccessMessage("Registration successful! Redirecting to sign in...");
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setErrors({ general: err.message || 'Registration failed. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email }),
      });
      if (!res.ok) throw new Error("Failed to resend code");
      setErrors({});
      showToast('Verification code resent to your email!', 'success');
    } catch (err) {
      showToast('Failed to resend code. Please try again.', 'error');
    }
  };

  const handleBackToForm = () => { setStep(1); setVerificationCode(''); setErrors({}); };

  const benefits = [
    { icon: '✔', title: 'Verified Professionals', desc: 'All taskers are verified for a safe, reliable experience.' },
    { icon: '✔', title: 'Simple Booking', desc: 'Post a task in minutes and connect with nearby providers.' },
    { icon: '✔', title: 'Clear Communication', desc: 'Direct messaging and transparent updates at every step.' },
    { icon: '✔', title: 'Fair & Transparent', desc: 'No hidden fees. Honest pricing agreed before work begins.' },
  ];

  const InfoPanel = ({ children }) => (
    <div className="cr-info-panel">
      <div className="cr-panel-inner">
        <div className="cr-logo-block">
          <div>
            <img src={logo} alt="Kaam-ly" width="170px" height="70px" />
            <div className="cr-tagline">Your trusted task marketplace</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={`cr-toast cr-toast--${toast.type}`}>
          <span className="cr-toast-icon">{toast.type === 'success' ? '✓' : '✕'}</span>
          {toast.message}
        </div>
      )}

      {step === 2 ? (
        <div className="cr-container">
          <div className="cr-wrapper">
            <InfoPanel>
              <div className="cr-verify-content">
                <div className="cr-verify-icon">@</div>
                <div className="cr-verify-title">Check your inbox</div>
                <p className="cr-verify-sub">
                  We sent a 4-digit code to<br />
                  <strong>{formData.email}</strong>
                </p>
              </div>
            </InfoPanel>

            <div className="cr-form-panel">
              <div className="cr-form-header">
                <h1 className="cr-form-title">Verify your email</h1>
                <p className="cr-form-subtitle">Enter the code we sent to complete registration</p>
              </div>

              <form className="cr-form" onSubmit={handleVerifyCode}>
                {errors.general && <div className="cr-error-box">{errors.general}</div>}
                {successMessage && <div className="cr-success-box">{successMessage}</div>}

                <div className="cr-form-group">
                  <label className="cr-label">Verification Code</label>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => { setVerificationCode(e.target.value); if (errors.verification) setErrors((p) => ({ ...p, verification: '' })); }}
                    placeholder="• • • • "
                    maxLength="4"
                    className={`cr-input cr-input--otp${errors.verification ? ' cr-input--error' : ''}`}
                  />
                  {errors.verification && <span className="cr-error-text">{errors.verification}</span>}
                </div>

                <button type="submit" className="cr-submit-btn" disabled={isSubmitting}>
                  {isSubmitting ? <span className="cr-spinner" /> : 'Verify & Create Account'}
                </button>

                <div className="cr-footer">
                  <p className="cr-footer-text">
                    Didn't receive the code?{' '}
                    <button type="button" onClick={handleResendCode} className="cr-link-btn">Resend Code</button>
                  </p>
                  <p className="cr-footer-text">
                    <button type="button" onClick={handleBackToForm} className="cr-link-btn">← Back to registration</button>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : (
        <div className="cr-container">
          <div className="cr-wrapper">
            <InfoPanel>
              <div className="cr-benefits">
                {benefits.map((b) => (
                  <div className="cr-benefit-item" key={b.title}>
                    <div className="cr-benefit-icon">{b.icon}</div>
                    <div>
                      <div className="cr-benefit-heading">{b.title}</div>
                      <div className="cr-benefit-desc">{b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </InfoPanel>

            <div className="cr-form-panel">
              <div className="cr-form-header">
                <h1 className="cr-form-title">Create your account</h1>
                <p className="cr-form-subtitle">Join thousands of customers getting things done</p>
              </div>

              <form className="cr-form" onSubmit={handleSubmit}>
                {errors.general && <div className="cr-error-box">{errors.general}</div>}

                <div className="cr-form-row">
                  <div className="cr-form-group">
                    <label className="cr-label">First Name<span className="cr-req">*</span></label>
                    <input type="text" name="firstName" value={formData.firstName} onChange={handleChange}
                      placeholder="John" className={`cr-input${errors.firstName ? ' cr-input--error' : ''}`} />
                    {errors.firstName && <span className="cr-error-text">{errors.firstName}</span>}
                  </div>
                  <div className="cr-form-group">
                    <label className="cr-label">Last Name<span className="cr-req">*</span></label>
                    <input type="text" name="lastName" value={formData.lastName} onChange={handleChange}
                      placeholder="Doe" className={`cr-input${errors.lastName ? ' cr-input--error' : ''}`} />
                    {errors.lastName && <span className="cr-error-text">{errors.lastName}</span>}
                  </div>
                </div>

                <div className="cr-form-group">
                  <label className="cr-label">Email Address<span className="cr-req">*</span></label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange}
                    placeholder="john@example.com" className={`cr-input${errors.email ? ' cr-input--error' : ''}`} />
                  {errors.email && <span className="cr-error-text">{errors.email}</span>}
                </div>

                <div className="cr-form-group">
                  <label className="cr-label">Phone Number<span className="cr-req">*</span></label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                    placeholder="9800000000" className={`cr-input${errors.phone ? ' cr-input--error' : ''}`} />
                  {errors.phone && <span className="cr-error-text">{errors.phone}</span>}
                </div>

                <div className="cr-form-row">
                  <div className="cr-form-group">
                    <label className="cr-label">Address</label>
                    <input type="text" name="address" value={formData.address} onChange={handleChange}
                      placeholder="Street address" className={`cr-input${errors.address ? ' cr-input--error' : ''}`} />
                    {errors.address && <span className="cr-error-text">{errors.address}</span>}
                  </div>
                  <div className="cr-form-group">
                    <label className="cr-label">Province</label>
                    <input type="text" name="province" value={formData.province} onChange={handleChange}
                      placeholder="e.g. Bagmati" className={`cr-input${errors.province ? ' cr-input--error' : ''}`} />
                    {errors.province && <span className="cr-error-text">{errors.province}</span>}
                  </div>
                </div>

                <div className="cr-form-row">
                  <div className="cr-form-group">
                    <label className="cr-label">Password<span className="cr-req">*</span></label>
                    <div className="cr-pw-wrap">
                      <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password}
                        onChange={handleChange} placeholder="Min. 8 characters"
                        className={`cr-input${errors.password ? ' cr-input--error' : ''}`} />
                      <button type="button" className="cr-eye-btn" onClick={() => setShowPassword(!showPassword)}>
                        <img src={showPassword ? eyeOpenIcon : eyeCloseIcon} alt="Toggle" className="cr-eye-icon" />
                      </button>
                    </div>
                    {errors.password && <span className="cr-error-text">{errors.password}</span>}
                  </div>
                  <div className="cr-form-group">
                    <label className="cr-label">Confirm Password<span className="cr-req">*</span></label>
                    <div className="cr-pw-wrap">
                      <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword"
                        value={formData.confirmPassword} onChange={handleChange} placeholder="Repeat password"
                        className={`cr-input${errors.confirmPassword ? ' cr-input--error' : ''}`} />
                      <button type="button" className="cr-eye-btn" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                        <img src={showConfirmPassword ? eyeOpenIcon : eyeCloseIcon} alt="Toggle" className="cr-eye-icon" />
                      </button>
                    </div>
                    {errors.confirmPassword && <span className="cr-error-text">{errors.confirmPassword}</span>}
                  </div>
                </div>

                <div className="cr-checkbox-group">
                  <label className="cr-checkbox-label">
                    <input type="checkbox" name="agreeToTerms" checked={formData.agreeToTerms}
                      onChange={handleChange} className="cr-checkbox" />
                    <span className="cr-checkbox-text">
                      I agree to the <a href="#" className="cr-link">Terms & Conditions</a> and{' '}
                      <a href="#" className="cr-link">Privacy Policy</a>
                    </span>
                  </label>
                  {errors.agreeToTerms && <span className="cr-error-text">{errors.agreeToTerms}</span>}
                </div>

                <button type="submit" className="cr-submit-btn" disabled={isSubmitting}>
                  {isSubmitting ? <span className="cr-spinner" /> : 'Continue →'}
                </button>

                <div className="cr-footer">
                  <p className="cr-footer-text">
                    Already have an account? <Link to="/login" className="cr-link">Sign in</Link>
                  </p>
                  <p className="cr-footer-text">
                    Want to earn money? <Link to="/register-worker" className="cr-link">Become a Tasker</Link>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CustomerRegistration;