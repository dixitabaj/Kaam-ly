import React, { useState, useEffect, useRef } from 'react';
import { User, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './navbar.css';
import logo from '../../images/logo.png';

const BASE = 'http://localhost:8000/api';

const fmtTime = (iso) => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const BookingNavbar = () => {
  const navigate = useNavigate();
  const [currentUser,   setCurrentUser]   = useState(null);
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [notifOpen,     setNotifOpen]     = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [notifLoading,  setNotifLoading]  = useState(false);

  const dropdownRef = useRef(null);
  const notifRef    = useRef(null);

  // ── Load user ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (storedUser) {
      try { setCurrentUser(JSON.parse(storedUser)); }
      catch { localStorage.removeItem('user'); sessionStorage.removeItem('user'); }
    }
  }, []);

  // ── Poll unread count every 30s ────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id) return;
    const fetchCount = () => {
      fetch(`${BASE}/notifications/unread/${currentUser.id}`)
        .then(r => r.json())
        .then(d => setUnreadCount((d.notifications || []).filter(n => !n.read).length))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  // ── Fetch notifications ────────────────────────────────────────────────────
  const fetchNotifications = async () => {
    if (!currentUser?.id) return;
    setNotifLoading(true);
    try {
      const res  = await fetch(`${BASE}/notifications/${currentUser.id}`);
      const data = await res.json();
      const all  = Array.isArray(data.notifications) ? data.notifications : [];
      setNotifications(all);
      setUnreadCount(all.filter(n => !n.read).length);
    } catch {
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  };

  // ── Open / toggle notification panel ──────────────────────────────────────
  const openNotifications = async (forceOpen = false) => {
    const opening = forceOpen ? true : !notifOpen;
    setNotifOpen(opening);
    setDropdownOpen(false);
    if (opening) await fetchNotifications();
  };

  // ── Listen for toast click event ───────────────────────────────────────────
  useEffect(() => {
    const handler = () => openNotifications(true);
    window.addEventListener('open-notif-panel', handler);
    return () => window.removeEventListener('open-notif-panel', handler);
  }, [currentUser?.id]);

  const markRead = async (notif) => {
    if (notif.link) { navigate(notif.link); setNotifOpen(false); }
  };

  const markAllRead = () => {
    if (!currentUser?.id) return;
    fetch(`${BASE}/notifications/mark-read/${currentUser.id}`, { method: 'POST' }).catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  // ── Close on outside click ─────────────────────────────────────────────────
  useEffect(() => {
    const handle = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
      if (notifRef.current    && !notifRef.current.contains(e.target))    setNotifOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const senderId = currentUser?.id;
  const role     = currentUser?.role;

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
      if (token) {
        await fetch('http://localhost:8000/api/logout', {
          method: 'POST', headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {}
    finally {
      localStorage.clear(); sessionStorage.clear();
      setCurrentUser(null); setDropdownOpen(false);
      navigate('/login');
    }
  };

  const handleProfile = () => {
    setDropdownOpen(false);
    if (role === 'worker')   return navigate(`/worker/profile/${senderId}`);
    if (role === 'customer') return navigate(`/profile/${senderId}`);
    if (role === 'admin')    return navigate('/admin/settings');
    navigate('/profile');
  };

  const initials = currentUser
    ? `${currentUser.firstName?.[0] || currentUser.first_name?.[0] || ''}${currentUser.lastName?.[0] || currentUser.last_name?.[0] || ''}`.toUpperCase()
    : null;

  return (
    <nav className="booking-navbar">
      <div className="booking-nav-content">

        {/* Logo */}
        <div className="booking-logo" onClick={() => navigate('/home')} style={{ cursor: 'pointer' }}>
          <img src={logo} alt="Kaam-ly Logo" />
        </div>

        <div className="booking-nav-links">

          {/* Worker links */}
          {role === 'worker' && (
            <>
              <div className="booking-nav-link" onClick={() => navigate(`/worker/dashboard/overview/${senderId}`)}>Dashboard</div>
              <div className="booking-nav-link" onClick={() => navigate(`/workerRequestPage/${senderId}`)}>Requests</div>
              <div className="booking-nav-link" onClick={() => senderId ? navigate(`/chat/${senderId}`) : alert('Please log in again.')}>Messages</div>
              <div className="booking-nav-link" onClick={() => senderId ? navigate(`/worker/calendar/${senderId}`) : alert('Please log in again.')}>Calendar</div>
            </>
          )}

          {/* Customer links */}
          {role === 'customer' && (
            <>
              <div className="booking-nav-link" onClick={() => navigate('/home')}>Home</div>
              <div className="booking-nav-link" onClick={() => senderId ? navigate(`/tasks/user/${senderId}`) : alert('Please log in again.')}>My Requests</div>
              <div className="booking-nav-link" onClick={() => navigate(`/chat/${senderId}`)}>Messages</div>
            </>
          )}

          {/* Admin links */}
          {role === 'admin' && (
            <>
              <div className="booking-nav-link" onClick={() => navigate('/admin/dashboard')}>Dashboard</div>
              <div className="booking-nav-link" onClick={() => navigate('/admin/payouts')}>Payouts</div>
              <div className="booking-nav-link" onClick={() => navigate('/workerVerification')}>Worker Verification</div>
              <div className="booking-nav-link" onClick={() => navigate('/refund')}>Refunds</div>
            </>
          )}

          {/* ── Notification Bell ── */}
          {currentUser && (
            <div className="notif-wrapper" ref={notifRef}>
              <button className="notif-bell-btn" onClick={() => openNotifications()} aria-label="Notifications">
                <Bell size={22} />
                {unreadCount > 0 && (
                  <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </button>

              {notifOpen && (
                <div className="notif-panel">
                  {/* Header */}
                  <div className="notif-panel-header">
                    <div className="notif-panel-title-wrap">
                      <span className="notif-panel-title">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="notif-panel-count">{unreadCount} new</span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button className="notif-mark-all" onClick={markAllRead}>
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* List */}
                  <div className="notif-list">
                    {notifLoading ? (
                      <div className="notif-empty">
                        <div className="notif-spinner" />
                        <span>Loading…</span>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="notif-empty">
                        <Bell size={28} style={{ opacity: 0.25, marginBottom: 8 }} />
                        <span>No notifications yet</span>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n._id}
                          className={`notif-item ${n.read ? 'read' : 'unread'}`}
                          onClick={() => markRead(n)}
                        >
                          <div className="notif-body">
                            <div className="notif-title">{n.title}</div>
                            <div className="notif-message">{n.body}</div>
                            <div className="notif-time">{fmtTime(n.createdAt)}</div>
                          </div>
                          {!n.read && <div className="notif-dot" />}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Profile button + dropdown ── */}
          <div className="booking-profile-wrapper" ref={dropdownRef}>
            <button
              className="booking-user-button"
              onClick={() => { setDropdownOpen(v => !v); setNotifOpen(false); }}
              aria-expanded={dropdownOpen}
            >
              {initials
                ? <span className="booking-user-initials">{initials}</span>
                : <User size={22} />}
            </button>

            {dropdownOpen && (
              <div className="booking-dropdown">
                {currentUser && (
                  <div className="booking-dropdown-header">
                    <div className="booking-dropdown-avatar">{initials || <User size={16} />}</div>
                    <div>
                      <div className="booking-dropdown-name">
                        {currentUser.firstName || currentUser.first_name || currentUser.name || 'User'}
                      </div>
                      <div className="booking-dropdown-email">{currentUser.email}</div>
                    </div>
                  </div>
                )}
                <div className="booking-dropdown-divider" />
                <button className="booking-dropdown-item" onClick={handleProfile}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  Profile
                </button>
                <button className="booking-dropdown-item booking-dropdown-item--danger" onClick={handleLogout}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Log out
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
};

export default BookingNavbar;