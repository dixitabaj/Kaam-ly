import React from 'react';
import { howItWorksSteps } from '../mock/data';

const HowItWorks = () => {
  const sectionStyle = {
    padding: '64px 24px',
    backgroundColor: '#FFFFFF',
  };

  const containerStyle = {
    maxWidth: '1280px',
    margin: '0 auto',
  };

  const headerStyle = {
    textAlign: 'center',
    marginBottom: '48px',
  };

  const titleStyle = {
    fontSize: '30px',
    fontWeight: 'bold',
    color: '#0F172A',
    '@media (min-width: 768px)': { fontSize: '36px' },
  };

  const gridStyle = {
    display: 'grid',
    gap: '24px',
    '@media (min-width: 768px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
    '@media (min-width: 1024px)': { gridTemplateColumns: 'repeat(3, 1fr)' },
  };

  const cardStyle = (color) => ({
    padding: '24px',
    borderRadius: '8px',
    border: '1px solid #F1F5F9',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    backgroundColor: color + '20',
    transition: 'box-shadow 0.2s',
  });

  return (
    <section style={sectionStyle}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>
            How <span style={{ color: '#F6AD56' }}>ServiceHub</span> Works
          </h2>
          <p style={{ marginTop: '16px', color: '#475569', maxWidth: '672px', marginLeft: 'auto', marginRight: 'auto' }}>
            Simple, transparent process to get your projects done
          </p>
        </div>

        <div style={gridStyle}>
          {howItWorksSteps.map((step) => (
            <div key={step.step} style={cardStyle(step.color)}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#F6AD56',
                color: '#FFFFFF',
                fontWeight: 'bold',
                fontSize: '20px',
                marginBottom: '16px'
              }}>
                {step.step}
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#0F172A', marginBottom: '8px' }}>
                {step.title}
              </h3>
              <p style={{ color: '#475569' }}>
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;