import { useState } from 'react'
import { GoogleLogin, googleLogout } from '@react-oauth/google'
import { jwtDecode } from 'jwt-decode'
import { useNavigate } from 'react-router-dom'
import { loginUsingGoogle } from "../api/api"

// ── Phone Modal ───────────────────────────────────────────────────────────────
const PhoneModal = ({ email, token, onDone }) => {
  const [phone,   setPhone]   = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const cleaned = phone.replace(/\s+/g, '')
    if (!/^\+?[0-9]{7,15}$/.test(cleaned)) {
      setError('Please enter a valid phone number.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('http://localhost:8000/api/customer/update-phone', {
        method:  'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ email, phone: cleaned }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.detail || 'Failed to save phone number.')
        setLoading(false)
        return
      }

      onDone(cleaned)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    // Backdrop
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      {/* Card */}
      <div style={{
        background: '#fff', borderRadius: 20, padding: '40px 36px',
        width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        animation: 'slideUp 0.25s ease',
      }}>
        {/* Icon */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, margin: '0 auto 20px',
        }}>
          📱
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', textAlign: 'center', margin: '0 0 8px' }}>
          One last thing
        </h2>
        <p style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', margin: '0 0 28px', lineHeight: 1.6 }}>
          Add your phone number so workers can reach you about bookings.
        </p>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Phone Number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={e => { setPhone(e.target.value); setError('') }}
            placeholder="e.g. 98XXXXXXXX"
            autoFocus
            style={{
              width: '100%', padding: '11px 14px', fontSize: 15,
              border: `1.5px solid ${error ? '#ef4444' : '#e5e7eb'}`,
              borderRadius: 10, background: '#f9fafb', color: '#111827',
              outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
            onFocus={e  => e.target.style.borderColor = '#111827'}
            onBlur={e   => e.target.style.borderColor = error ? '#ef4444' : '#e5e7eb'}
          />

          {error && (
            <p style={{ fontSize: 13, color: '#dc2626', marginTop: 6, marginBottom: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', marginTop: 20, padding: '12px',
              background: loading ? '#9ca3af' : '#111827',
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 15, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s',
            }}
          >
            {loading ? 'Saving…' : 'Continue'}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ── Landing ───────────────────────────────────────────────────────────────────
export function Landing() {
  const navigate = useNavigate()
  const [pendingUser, setPendingUser] = useState(null) // holds user data while awaiting phone

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential)
      const result  = await loginUsingGoogle(decoded)

      const userData = {
        id:      result.user_id,
        token:   result.access_token,
        role:    result.role,
        name:    result.first_name,
        email:   result.email,
        picture: result.picture,
        phone:   result.phone || null,
      }

      // New user — no phone on file → show phone modal before navigating
      if (!userData.phone) {
        setPendingUser(userData)
        return
      }

      // Existing user with phone → go straight to home
      localStorage.setItem('user', JSON.stringify(userData))
      navigate('/home')

    } catch (err) {
      console.error('Google login failed', err)
    }
  }

  // Called when phone modal succeeds
  const handlePhoneDone = (phone) => {
    const userData = { ...pendingUser, phone }
    localStorage.setItem('user', JSON.stringify(userData))
    setPendingUser(null)
    navigate('/home')
  }

  return (
    <>
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={() => console.log('Login through google is unsuccessful')}
        shape="pill"
      />

      {/* Phone modal — only shown for new users */}
      {pendingUser && (
        <PhoneModal
          email={pendingUser.email}
          token={pendingUser.token}
          onDone={handlePhoneDone}
        />
      )}
    </>
  )
}