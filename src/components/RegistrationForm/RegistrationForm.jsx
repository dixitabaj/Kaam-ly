// Step1BasicInfo.jsx
import React from 'react';
import './registration.css';

const RegistrationForm = ({ formData, handleChange, errors }) => {
  return (
    <div className="step-content">
      <h2 className="step-title">Join Our Community of Taskers</h2>
      <p className="step-description">
        Start earning money by helping neighbors with tasks they need done
      </p>

      <div className="form-grid">
        {/* First Name & Last Name Row */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">First Name*</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="Your first name"
              className={`form-input ${errors.firstName ? 'error-input' : ''}`}
              required
            />
            <span className="error-message">{errors.firstName || '\u00A0'}</span>
          </div>
          <div className="form-group">
            <label className="form-label">Last Name*</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Your last name"
              className={`form-input ${errors.lastName ? 'error-input' : ''}`}
              required
            />
            <span className="error-message">{errors.lastName || '\u00A0'}</span>
          </div>
        </div>

        {/* Email & Phone Number Row */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Email Address*</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className={`form-input ${errors.email ? 'error-input' : ''}`}
              required
            />
            <span className="error-message">{errors.email || '\u00A0'}</span>
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number*</label>
            <div className="phone-input-wrapper">
              <div className="country-code">+977</div>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="9876543212"
                className={`phone-input ${errors.phone ? 'error-input' : ''}`}
                required
              />
            </div>
            <span className="error-message">{errors.phone || '\u00A0'}</span>
          </div>
        </div>

        {/* Password & Confirm Password Row */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Password*</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a strong password"
              className={`form-input ${errors.password ? 'error-input' : ''}`}
              required
            />
            <span className="error-message">{errors.password || '\u00A0'}</span>
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password*</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              className={`form-input ${errors.confirmPassword ? 'error-input' : ''}`}
              required
            />
            <span className="error-message">{errors.confirmPassword || '\u00A0'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationForm;
