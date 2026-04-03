import React, { useState } from 'react';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { reviews } from '../mock/data';

const Reviews = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const reviewsPerPage = 3;

  const nextReviews = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, reviews.length - reviewsPerPage));
  };

  const prevReviews = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const visibleReviews = reviews.slice(currentIndex, currentIndex + reviewsPerPage);

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
    '@media (min-width: 768px)': { gridTemplateColumns: 'repeat(3, 1fr)' },
  };

  const cardStyle = {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  };

  return (
    <section style={sectionStyle}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>
            What Our <span style={{ color: '#F6AD56' }}>Customers Say</span>
          </h2>
          <p style={{ marginTop: '16px', color: '#475569', maxWidth: '672px', marginLeft: 'auto', marginRight: 'auto' }}>
            Join thousands of satisfied customers who found trusted professionals
          </p>
        </div>

        <div style={{ position: 'relative' }}>
          <div style={gridStyle}>
            {visibleReviews.map((review) => (
              <div key={review.id} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                  <img
                    src={review.avatar}
                    alt={review.name}
                    style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div style={{ marginLeft: '12px' }}>
                    <h4 style={{ fontWeight: '600', color: '#0F172A' }}>{review.name}</h4>
                    <p style={{ fontSize: '14px', color: '#94A3B8' }}>{review.service}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', marginBottom: '12px' }}>
                  {[...Array(review.rating)].map((_, i) => (
                    <Star key={i} size={16} color="#FBBF24" fill="#FBBF24" />
                  ))}
                </div>
                <p style={{ color: '#475569', fontSize: '14px', marginBottom: '12px' }}>{review.comment}</p>
                <p style={{ fontSize: '12px', color: '#94A3B8' }}>{review.date}</p>
              </div>
            ))}
          </div>

          {reviews.length > reviewsPerPage && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px', gap: '16px' }}>
              <button
                onClick={prevReviews}
                disabled={currentIndex === 0}
                style={{
                  padding: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                  opacity: currentIndex === 0 ? 0.5 : 1,
                }}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={nextReviews}
                disabled={currentIndex >= reviews.length - reviewsPerPage}
                style={{
                  padding: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  cursor: currentIndex >= reviews.length - reviewsPerPage ? 'not-allowed' : 'pointer',
                  opacity: currentIndex >= reviews.length - reviewsPerPage ? 0.5 : 1,
                }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Reviews;