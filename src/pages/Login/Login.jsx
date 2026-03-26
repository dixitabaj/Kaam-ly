import React, { useState } from 'react';
import './login.css';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { loginUsingGoogle } from "../../api/api";
import logo from "../../images/logo.png";
import eyeOpenIcon  from "../../images/open.png";
import eyeCloseIcon from "../../images/closed.png";

const VAPID_KEY = "BFID2OKKVjuBAh3Q0DyC8IpdgythnwvDa_55_gZwqGJIJVcufyrLS_zK92bODBdV525zC-C39QCRtU9siSEOVvc";

// ── Storage helpers ───────────────────────────────────────────────────────────
export const getStoredUser = () => {
  const raw = localStorage.getItem('user') ?? sessionStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
};

export const getStoredToken = () =>
  localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token');

export const clearStorage = () => {
  ['access_token', 'user'].forEach(key => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
};

// ── FCM token registration ────────────────────────────────────────────────────
const registerFCMToken = async (userId) => {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const { initMessaging } = await import("../../api/firebase");
    const { getToken }      = await import("firebase/messaging");

    const messaging = await initMessaging();
    if (!messaging) return;

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return;

    await fetch("http://localhost:8000/api/notifications/save-token", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ userId, token }),
    });

    console.log("[FCM] Token registered after login ✓");
  } catch (err) {
    console.warn("[FCM] Registration failed (non-critical):", err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email:           '',
    password:        '',
    otp:             '',
    newPassword:     '',
    confirmPassword: '',
    rememberMe:      false,
  });

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showOtpForm,        setShowOtpForm]        = useState(false);
  const [showResetForm,      setShowResetForm]      = useState(false);
  const [showResetSuccess,   setShowResetSuccess]   = useState(false);
  const [error,              setError]              = useState('');
  const [showPassword,        setShowPassword]        = useState(false);
  const [showNewPassword,     setShowNewPassword]     = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const resetForgotFlow = () => {
    setShowForgotPassword(false);
    setShowOtpForm(false);
    setShowResetForm(false);
    setShowResetSuccess(false);
    setError('');
  };

  // ── Google login ────────────────────────────────────────────────────────────
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      const result  = await loginUsingGoogle(decoded);

      const storage = sessionStorage;
      const firstName = result.first_name ?? result.firstName ?? "";
      const lastName  = result.last_name  ?? result.lastName  ?? "";
      const user = {
        token: result.access_token,
        role: result.role,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        email: result.email || decoded.email,
        picture: result.picture || decoded.picture,
        id: result._id || result.id,
        phoneNo: result.phoneNo || null,
      };
      console.log("RESULT:", result);
      console.log("DECODED:", decoded);


      storage.setItem('access_token', result.access_token);
      storage.setItem('user', JSON.stringify(user));

      await registerFCMToken(user.id);

      // ── Route based on role first, then phone check for customers only ──
      if (result.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (result.role === 'worker') {
        navigate(`/worker/dashboard/overview/${encodeURIComponent(result._id)}`);
      } else {
        // customer — check if phone is missing
        if (!user.phoneNo) {
          navigate('/complete-profile');
        } else {
          navigate('/home');
        }
      }

    } catch (err) {
      console.error("Google login failed:", err);
      // Shows backend error message e.g. "This email is registered as a worker account"
      setError(err.message || "Google login failed. Please try again.");
    }
  };

  // ── Email / password login ──────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res  = await fetch("http://localhost:8000/api/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          email:       formData.email,
          password:    formData.password,
          remember_me: formData.rememberMe,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        const storage = formData.rememberMe ? localStorage : sessionStorage;

        storage.setItem('access_token', data.access_token);
        storage.setItem('user', JSON.stringify({
          id:        data._id,
          token:     data.access_token,
          role:      data.role,
          firstName: data.first_name ?? data.firstName ?? "",
          lastName:  data.last_name  ?? data.lastName ?? '',
          name:      `${data.first_name || ''} ${data.last_name || ''}`.trim(),
          email:     data.email,
          phoneNo:   data.phoneNo || null,
        }));

        console.log(data);

        await registerFCMToken(data._id);

        if      (data.role === "worker")   navigate(`/worker/dashboard/overview/${encodeURIComponent(data._id)}`);
        else if (data.role === "customer") navigate("/home");
        else if (data.role === "admin")    navigate("/admin/dashboard");
      } else {
        setError("The email or password you entered is incorrect.");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    }
  };

  // ── Forgot password ─────────────────────────────────────────────────────────
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res  = await fetch("http://localhost:8000/api/send-otp", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: formData.email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "Failed to send OTP"); return; }
      setShowOtpForm(true);
    } catch {
      setError("Something went wrong. Please try again later.");
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res  = await fetch("http://localhost:8000/api/verify-otp", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: formData.email, otp: formData.otp }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "Invalid OTP"); return; }
      setShowOtpForm(false);
      setShowResetForm(true);
    } catch {
      setError("Something went wrong. Please try again later.");
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.newPassword !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (formData.newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    try {
      const res  = await fetch("http://localhost:8000/api/reset-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          email:        formData.email,
          new_password: formData.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "Failed to reset password"); return; }
      setShowResetForm(false);
      setShowResetSuccess(true);
    } catch {
      setError("Something went wrong. Please try again later.");
    }
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    setShowOtpForm(false);
    setShowResetForm(false);
    setShowResetSuccess(false);
    setShowForgotPassword(true);
    setError('');
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="auth-container">
      <div className="auth-wrapper">
        <div className="form-panel">

          <div className="logo-section">
            <div className="logo">
              <img src={logo} alt="Kaam-ly" />
            </div>
          </div>

          <div className="form-header">
            <h1 className="form-title">
              {!showForgotPassword
                ? "Sign in to your account"
                : showResetSuccess
                ? "Password Reset!"
                : showResetForm
                ? "Set New Password"
                : showOtpForm
                ? "Enter Verification Code"
                : "Reset Password"}
            </h1>
            <p className="form-subtitle">
              {!showForgotPassword
                ? "Welcome back! Please enter your details."
                : showResetSuccess
                ? "Your password has been reset. You can now log in."
                : showResetForm
                ? "Enter your new password below."
                : showOtpForm
                ? "Enter the 4-digit code sent to your email."
                : "Enter your email and we'll send you a reset code."}
            </p>
          </div>

          {/* ── Sign In ── */}
          {!showForgotPassword && (
            <form onSubmit={handleLogin} className="auth-form">
              <div className="form-group-login">
                <label className="form-label-login">Email Address</label>
                <input
                  type="email" name="email" value={formData.email}
                  onChange={handleChange} className="form-input1" required
                />
              </div>
              <div className="form-group-login">
              <label className="form-label-login">Password</label>
              <div className="cr-pw-wrap">
                <input
                  type={showPassword ? 'text' : 'password'} name="password"
                  value={formData.password} onChange={handleChange}
                  className="form-input1" required
                />
                <button type="button" className="cr-eye-btn" onClick={() => setShowPassword(p => !p)}>
                  <img src={showPassword ? eyeOpenIcon : eyeCloseIcon} alt="Toggle" className="cr-eye-icon" />
                </button>
              </div>
            </div>
              {error && <div className="error-message">{error}</div>}
              <div className="form-options">
                <label className="checkbox-option">
                  <input type="checkbox" name="rememberMe" checked={formData.rememberMe} onChange={handleChange} />
                  <span className="checkbox-text">Remember me</span>
                </label>
                <button type="button" className="forgot-link" onClick={handleForgotPassword}>
                  Forgot password?
                </button>
              </div>
              <button type="submit" className="auth-btn primary">Sign In</button>
              <p className="continue-with">or continue with</p>
              <div className="social-login">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError("Google login failed. Please try again.")}
                  shape="pill"
                  width="400"
                />
              </div>
              <div className="auth-footer">
                <p className="auth-text">
                  Don't have an account?{' '}
                  <Link to="/register-customer" className="auth-link">Sign up here</Link>
                </p>
                <p className="auth-text">
                  <Link to="/register-worker" className="auth-link">Become a Tasker</Link>
                </p>
              </div>
            </form>
          )}

          {/* ── Forgot Password ── */}
          {showForgotPassword && !showOtpForm && !showResetForm && !showResetSuccess && (
            <form onSubmit={handleRequestOtp} className="forgot-password-form">
              <div className="form-group-login">
                <label className="form-label-login">Email Address</label>
                <input type="email" name="email" value={formData.email}
                  onChange={handleChange} className="form-input1" required />
              </div>
              {error && <div className="error-message">{error}</div>}
              <button type="submit" className="auth-btn primary">Send OTP</button>
              <div className="back-link">
                <button type="button" className="auth-link" onClick={resetForgotFlow}>← Back to login</button>
              </div>
            </form>
          )}

          {/* ── OTP ── */}
          {showOtpForm && (
            <form onSubmit={handleVerifyOtp} className="forgot-password-form">
              <div className="form-group-login">
                <label className="form-label-login">Verification Code</label>
                <input type="text" name="otp" value={formData.otp}
                  onChange={handleChange} className="form-input1" maxLength={6} required />
              </div>
              {error && <div className="error-message">{error}</div>}
              <button type="submit" className="auth-btn primary">Verify OTP</button>
              <div className="back-link">
                <button type="button" className="auth-link" onClick={resetForgotFlow}>← Back to login</button>
              </div>
            </form>
          )}

          {/* ── New Password ── */}
          {showResetForm && (
  <form onSubmit={handleResetPassword} className="forgot-password-form">
    <div className="form-group-login">
      <label className="form-label-login">New Password</label>
      <div className="cr-pw-wrap">
        <input
          type={showNewPassword ? 'text' : 'password'} name="newPassword"
          value={formData.newPassword} onChange={handleChange}
          className="form-input1" required
        />
        <button type="button" className="cr-eye-btn" onClick={() => setShowNewPassword(p => !p)}>
          <img src={showNewPassword ? eyeOpenIcon : eyeCloseIcon} alt="Toggle" className="cr-eye-icon" />
        </button>
      </div>
    </div>
    <div className="form-group-login">
      <label className="form-label-login">Confirm Password</label>
      <div className="cr-pw-wrap">
        <input
          type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword"
          value={formData.confirmPassword} onChange={handleChange}
          className="form-input1" required
        />
        <button type="button" className="cr-eye-btn" onClick={() => setShowConfirmPassword(p => !p)}>
          <img src={showConfirmPassword ? eyeOpenIcon : eyeCloseIcon} alt="Toggle" className="cr-eye-icon" />
        </button>
      </div>
    </div>
    {error && <div className="error-message">{error}</div>}
    <button type="submit" className="auth-btn primary">Reset Password</button>
  </form>
)}

          {/* ── Success ── */}
          {showResetSuccess && (
            <div className="success-message">
              <div className="success-icon">✓</div>
              <p>Your password has been reset successfully!</p>
              <div className="back-link">
                <button type="button" className="auth-link" onClick={resetForgotFlow}>← Back to login</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Login;