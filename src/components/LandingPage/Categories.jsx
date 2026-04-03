import React from 'react';
import { Hammer, Drill, Wrench, Truck, Sparkles, Trees, Paintbrush, Zap, Armchair, Leaf } from 'lucide-react';
import { categories } from '../mock/data';

const iconMap = {
  'Hammer': Hammer,
  'Drill': Drill,
  'Wrench': Wrench,
  'Truck': Truck,
  'Sparkles': Sparkles,
  'Trees': Trees,
  'Paintbrush': Paintbrush,
  'Zap': Zap,
  'Armchair': Armchair,
  'Leaf': Leaf,
};

const Categories = () => {
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

  const subtitleStyle = {
    marginTop: '16px',
    color: '#475569',
    maxWidth: '672px',
    marginLeft: 'auto',
    marginRight: 'auto',
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
    '@media (min-width: 640px)': { gridTemplateColumns: 'repeat(3, 1fr)' },
    '@media (min-width: 768px)': { gridTemplateColumns: 'repeat(4, 1fr)' },
    '@media (min-width: 1024px)': { gridTemplateColumns: 'repeat(5, 1fr)' },
  };

  const categoryButtonStyle = {
    padding: '16px',
    backgroundColor: '#F8FAFC',
    borderRadius: '8px',
    textAlign: 'center',
    transition: 'all 0.2s',
    cursor: 'pointer',
    border: 'none',
  };

  return (
    <section style={sectionStyle}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>
            Browse by <span style={{ color: '#F6AD56' }}>Category</span>
          </h2>
          <p style={subtitleStyle}>
            Find the right professional for your specific needs across our wide range of service categories
          </p>
        </div>

        <div style={gridStyle}>
          {categories.slice(0, 10).map((category) => {
            const IconComponent = iconMap[category.icon] || Hammer;
            return (
              <button
                key={category.id}
                style={categoryButtonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#FEF3C7';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#F8FAFC';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                  <IconComponent size={32} color="#F6AD56" />
                </div>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#475569' }}>
                  {category.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Categories;