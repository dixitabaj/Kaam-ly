// CompleteProfile.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CompleteProfile = () => {
  const navigate = useNavigate();
  const [phone, setPhone]   = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const user = JSON.parse(sessionStorage.getItem('user') || '{}');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone.replace(/\D/g, ''))) {
      setError('Phone number must be 10 digits');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/customer/${user.id}/phone`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body:    JSON.stringify({ phoneNo: phone }),
      });
      if (!res.ok) throw new Error('Failed to save phone');

      // Update stored user with phone
      const updated = { ...user, phoneNo: phone };
      sessionStorage.setItem('user', JSON.stringify(updated));

      navigate('/home');
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cr-container">
      <div style={{ maxWidth: 420, width: '100%', background: '#fff', borderRadius: 16, padding: 40, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
        {user.picture && (
          <img src={user.picture} alt="Profile" style={{ width: 64, height: 64, borderRadius: '50%', marginBottom: 16 }} />
        )}
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>One more thing</h1>
        <p style={{ fontSize: 14, color: '#888', marginBottom: 24 }}>
          We need your phone number to complete your account setup.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#333' }}>Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError(''); }}
              placeholder="9800000000"
              style={{ width: '100%', height: 42, padding: '0 13px', border: '1.5px solid #e8e8e8', borderRadius: 10, fontSize: 14, marginTop: 5, outline: 'none' }}
            />
            {error && <span style={{ fontSize: 12, color: '#ef4444' }}>{error}</span>}
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ height: 46, background: '#E8800A', color: '#fff', border: 'none', borderRadius: 11, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}
          >
            {loading ? 'Saving...' : 'Continue →'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CompleteProfile;