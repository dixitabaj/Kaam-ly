// ProgressBar.jsx
import React from 'react';
import './progressBar.css';

const ProgressBar = ({ step, totalSteps = 4 }) => {
  const steps = [
    { number: 1, label: 'Account' },
    { number: 2, label: 'Skills' },
    { number: 3, label: 'Profile' },
    { number: 4, label: 'Availability' },
    {number: 5, label:'Verification'}
  ];

  return (
    <div className="progress-container">
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${(step / totalSteps) * 100}%` }}
        ></div>
      </div>
      <div className="step-indicators">
        {steps.map((stepItem) => (
          <div 
            key={stepItem.number} 
            className={`step-indicator ${step >= stepItem.number ? 'active' : ''}`}
          >
            <div className="step-number">{stepItem.number}</div>
            <div className="step-label">{stepItem.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgressBar;