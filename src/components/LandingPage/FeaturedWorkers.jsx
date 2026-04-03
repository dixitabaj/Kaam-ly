import React from 'react';
import { Star, Clock, CheckCircle } from 'lucide-react';
import { Button } from './button';
import { Badge } from './badge';
import { workers } from '../mock/data';

const FeaturedWorkers = () => {
  const sectionStyle = {
    padding: '64px 24px',
    backgroundColor: '#F8FAFC',
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

  const cardStyle = {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
    transition: 'box-shadow 0.2s',
  };

  return (
    <section style={sectionStyle}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>
            Featured <span style={{ color: '#F6AD56' }}>Professionals</span>
          </h2>
          <p style={{ marginTop: '16px', color: '#475569', maxWidth: '672px', marginLeft: 'auto', marginRight: 'auto' }}>
            Highly-rated service providers ready to help with your next project
          </p>
        </div>

        <div style={gridStyle}>
          {workers.map((worker) => (
            <div key={worker.id} style={cardStyle}>
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <img
                    src={worker.image}
                    alt={worker.name}
                    style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontWeight: '600', fontSize: '18px', color: '#0F172A' }}>{worker.name}</h3>
                      {worker.verified && <CheckCircle size={20} color="#F6AD56" />}
                    </div>
                    <p style={{ fontSize: '14px', color: '#F6AD56', fontWeight: '500' }}>{worker.service}</p>
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '4px' }}>
                      <Star size={16} color="#FBBF24" fill="#FBBF24" />
                      <span style={{ marginLeft: '4px', fontSize: '14px', fontWeight: '500' }}>{worker.rating}</span>
                      <span style={{ marginLeft: '4px', fontSize: '14px', color: '#94A3B8' }}>({worker.reviews} reviews)</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {worker.skills.map((skill, idx) => (
                    <Badge key={idx} variant="secondary">{skill}</Badge>
                  ))}
                </div>

                <div style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', color: '#475569' }}>Completed Jobs:</span>
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>{worker.completedJobs}+</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', color: '#475569' }}>Hourly Rate:</span>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#F6AD56' }}>${worker.hourlyRate}/hr</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', color: '#475569' }}>
                    <Clock size={16} style={{ marginRight: '4px' }} />
                    <span>Response: {worker.responseTime}</span>
                  </div>
                </div>

                <Button style={{ width: '100%', marginTop: '16px' }}>Hire Now</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedWorkers;