// src/pages/TermsAndConditions/TermsAndConditions.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import BookingNavbar from '../../components/Navbar/Navbar';

const TermsAndCondition = () => {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#FFFBEB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <BookingNavbar />
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        <button
          onClick={() => navigate(-1)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#666', background: 'none', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', marginBottom: '1.5rem' }}
        >
          ← Back
        </button>

        <h1 style={{ fontSize: '28px', fontWeight: '600', color: '#1a1a1a', marginBottom: '4px' }}>Terms & Conditions</h1>
        <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '2rem' }}>Last updated: April 2025 · Applies to all bookings on the platform</p>

        <div style={{ background: '#fff7ed', borderLeft: '3px solid #f6ad56', borderRadius: '0 8px 8px 0', padding: '12px 16px', marginBottom: '2rem', fontSize: '14px', color: '#92400e', lineHeight: '1.6' }}>
          By confirming a booking, you agree to pay the agreed amount directly to the worker and accept all the terms below.
        </div>

        {[
          {
            title: '1. Booking & payment',
            content: 'All prices are quoted in NPR and include a 5% platform fee. The minimum charge is one hour at the worker\'s hourly rate. Final pricing may be adjusted after the worker assesses the task on-site.',
            bullets: [
              'Payment is made directly to the worker unless otherwise specified.',
              'The platform fee is non-refundable once a booking is confirmed.',
              'You are responsible for ensuring the quoted scope of work is accurate.',
            ],
          },
          {
            title: '2. Cancellation policy',
            content: 'You may cancel a booking at any time before the service date. The following penalties apply:',
            bullets: [
              'More than 4 hours before service: Full refund.',
              'Less than 4 hours before service: 25% cancellation fee. Refund of 75% of total cost.',
              'No-show: No refund.',
            ],
          },
          {
            title: '3. Worker conduct',
            content: 'Workers on this platform are independent contractors. The platform does not employ them directly. We verify worker identities but are not liable for the quality of work performed.',
            bullets: [
              'Workers are expected to arrive on time and complete the agreed task.',
              'Any disputes must be reported within 24 hours of service completion.',
            ],
          },
          {
            title: '4. User responsibilities',
            bullets: [
              'Provide accurate task details, address, and contact information.',
              'Ensure safe working conditions for the worker.',
              'Do not request services outside the agreed scope without renegotiating payment.',
            ],
          },
          {
            title: '5. Liability',
            content: 'The platform acts as a marketplace only. We are not liable for property damage, injury, or disputes arising from the service. We strongly recommend reviewing a worker\'s ratings before booking.',
          },
          {
            title: '6. Privacy',
            content: 'Your personal information (name, phone, email, address) is shared with the assigned worker solely to facilitate the booking. We do not sell your data to third parties.',
          },
          {
            title: '7. Changes to these terms',
            content: 'We may update these terms at any time. Continued use of the platform after changes constitutes acceptance of the updated terms.',
          },
        ].map(({ title, content, bullets }) => (
          <div key={title} style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a1a', marginBottom: '8px' }}>{title}</h2>
            {content && <p style={{ fontSize: '14px', color: '#555', lineHeight: '1.7', marginBottom: '8px' }}>{content}</p>}
            {bullets && (
              <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                {bullets.map((b, i) => (
                  <li key={i} style={{ fontSize: '14px', color: '#555', lineHeight: '1.7', marginBottom: '4px' }}>{b}</li>
                ))}
              </ul>
            )}
            <div style={{ height: '1px', background: '#f1f5f9', marginTop: '1.5rem' }} />
          </div>
        ))}

        <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '12px', fontSize: '13px', color: '#666' }}>
          Questions? Contact us at <strong>kaamly7@gmail.com</strong>
        </div>
      </div>
    </div>
  );
};

export default TermsAndCondition;