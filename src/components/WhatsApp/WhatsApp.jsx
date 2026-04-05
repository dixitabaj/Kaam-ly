// WhatsAppSupport.jsx
import React, { useState, useEffect } from 'react';

const WhatsAppSupport = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Phone number (replace with your actual WhatsApp number, include country code without +)
  const whatsappNumber = "9742893770"; // Replace with your Nepal number (e.g., 97798XXXXXXXX)
  const message = encodeURIComponent("Hello, I need help with login/registration on your platform.");
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=${message}`;

  // Auto-hide after 10 seconds? Optional
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMinimized(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="whatsapp-support" style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 1000,
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: '#25D366',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.47 3.45 1.35 4.95L2 22l5.91-1.61c1.45.79 3.1 1.21 4.8 1.21 5.46 0 9.91-4.45 9.91-9.91C22.09 6.45 17.5 2 12.04 2zM12 20.23c-1.5 0-2.96-.4-4.24-1.16l-.3-.18-3.51.96.94-3.42-.2-.31c-.8-1.3-1.22-2.8-1.22-4.32 0-4.54 3.7-8.24 8.24-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.54-3.7 8.24-8.24 8.24zm4.52-6.12c-.25-.12-1.47-.73-1.7-.81-.23-.08-.4-.12-.57.12-.17.24-.66.81-.81.98-.15.17-.3.19-.55.07-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.38-.44.12-.15.16-.25.24-.42.08-.17.04-.31-.02-.44-.06-.12-.57-1.38-.78-1.89-.21-.5-.42-.42-.57-.42-.15 0-.32-.02-.49-.02-.17 0-.45.06-.69.31-.24.25-.91.89-.91 2.17 0 1.28.93 2.52 1.06 2.69.13.17 1.83 2.79 4.43 3.91.62.26 1.1.42 1.48.54.62.2 1.19.17 1.64.1.5-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.22-.16-.47-.28z"/>
          </svg>
        </button>
      ) : (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          width: '300px',
          maxWidth: 'calc(100vw - 40px)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            backgroundColor: '#075E54',
            color: 'white',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.47 3.45 1.35 4.95L2 22l5.91-1.61c1.45.79 3.1 1.21 4.8 1.21 5.46 0 9.91-4.45 9.91-9.91C22.09 6.45 17.5 2 12.04 2zM12 20.23c-1.5 0-2.96-.4-4.24-1.16l-.3-.18-3.51.96.94-3.42-.2-.31c-.8-1.3-1.22-2.8-1.22-4.32 0-4.54 3.7-8.24 8.24-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.54-3.7 8.24-8.24 8.24z"/>
              </svg>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>Need Help?</div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>Usually replies within minutes</div>
              </div>
            </div>
            <button
              onClick={() => setIsMinimized(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '4px 8px'
              }}
            >
              ✕
            </button>
          </div>
          
          {/* Body */}
          <div style={{ padding: '20px' }}>
            <div style={{
              backgroundColor: '#f0f0f0',
              borderRadius: '12px',
              padding: '12px',
              marginBottom: '16px',
              fontSize: '14px',
              color: '#333'
            }}>
              Having trouble with login or registration? 
              <strong> Contact us on WhatsApp</strong> and we'll help you right away.
            </div>
            
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                backgroundColor: '#25D366',
                color: 'white',
                textDecoration: 'none',
                padding: '12px',
                borderRadius: '40px',
                fontWeight: 'bold',
                fontSize: '14px',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.47 3.45 1.35 4.95L2 22l5.91-1.61c1.45.79 3.1 1.21 4.8 1.21 5.46 0 9.91-4.45 9.91-9.91C22.09 6.45 17.5 2 12.04 2zM12 20.23c-1.5 0-2.96-.4-4.24-1.16l-.3-.18-3.51.96.94-3.42-.2-.31c-.8-1.3-1.22-2.8-1.22-4.32 0-4.54 3.7-8.24 8.24-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.54-3.7 8.24-8.24 8.24z"/>
              </svg>
              Chat on WhatsApp
            </a>
          </div>
          
          {/* Footer */}
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid #eee',
            fontSize: '11px',
            color: '#999',
            textAlign: 'center'
          }}>
            Support available 9 AM - 6 PM, Mon - Fri
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppSupport;