import React from 'react';
import { Shield, Clock, ThumbsUp, DollarSign } from 'lucide-react';

const Guarantee = () => {
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
    gap: '32px',
    '@media (min-width: 768px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
    '@media (min-width: 1024px)': { gridTemplateColumns: 'repeat(4, 1fr)' },
  };

  const cardStyle = {
    textAlign: 'center',
    padding: '24px',
  };

  const guarantees = [
    {
      icon: Shield,
      title: 'Background Checked',
      description: 'All professionals undergo thorough background verification'
    },
    {
      icon: Clock,
      title: '24/7 Support',
      description: 'Our support team is available around the clock'
    },
    {
      icon: ThumbsUp,
      title: 'Quality Guaranteed',
      description: 'Not satisfied? We\'ll make it right or refund your money'
    },
    {
      icon: DollarSign,
      title: 'Secure Payments',
      description: 'Your payments are protected with escrow protection'
    }
  ];

  return (
    <section style={sectionStyle}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>
            Our <span style={{ color: '#F6AD56' }}>Guarantee</span>
          </h2>
          <p style={{ marginTop: '16px', color: '#475569', maxWidth: '672px', marginLeft: 'auto', marginRight: 'auto' }}>
            We stand behind every booking with our comprehensive guarantees
          </p>
        </div>

        <div style={gridStyle}>
          {guarantees.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={index} style={cardStyle}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '64px',
                  height: '64px',
                  backgroundColor: '#FEF3C7',
                  borderRadius: '50%',
                  margin: '0 auto 16px'
                }}>
                  <Icon size={32} color="#F6AD56" />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#0F172A', marginBottom: '8px' }}>
                  {item.title}
                </h3>
                <p style={{ color: '#475569', fontSize: '14px' }}>
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Guarantee;