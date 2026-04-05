import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Info, MoreVertical, Send, Paperclip, Smile, Image, Mic,
  ArrowLeft, CheckCheck, Search, Menu, X, ClipboardList, MessageSquare,
  Play, File, Copy, Trash2, BellOff, UserX, Flag, ChevronRight,
  Phone, Video, Star, Download, StopCircle,
} from 'lucide-react';
import {
  connectWebSocket, closeWebSocket, sendMessageWS,
  fetchWorkerById, fetchMessages, fetchConversations,
  fetchCustomerById, updateOfferDetails, fetchSharedTasks,
} from '../../api/api';
import { TaskDetails } from '../../pages-worker/taskDetails';
import BookingNavbar from '../NavBar/NavBar';
import './MessagesPage.css';
import ChatWidget from '../HelpSection/HelpSection';
import { useToast } from "../Toast/ToastContext";

// ── Status Badge ──────────────────────────────────────────────────────────────
const STATUS_MAP = {
  pending:     { bg: '#fef9c3', color: '#854d0e', label: 'Pending' },
  accepted:    { bg: '#dbeafe', color: '#1e40af', label: 'Accepted' },
  in_progress: { bg: '#fde68a', color: '#92400e', label: 'In Progress' },
  completed:   { bg: '#d1fae5', color: '#065f46', label: 'Completed' },
  cancelled:   { bg: '#fee2e2', color: '#991b1b', label: 'Cancelled' },
  worker_done: { bg: '#ede9fe', color: '#5b21b6', label: 'Worker Done' },
  paid:        { bg: '#d1fae5', color: '#065f46', label: 'Paid' },
  confirmed:   { bg: '#dbeafe', color: '#1e40af', label: 'Confirmed' },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[(status || '').toLowerCase()] || {
    bg: '#f1f5f9', color: '#64748b', label: status || 'Unknown',
  };
  return (
    <span
      className="mp-status-badge"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
};

// ── More Menu ─────────────────────────────────────────────────────────────────
const MoreMenu = ({ onClose, onReportUser }) => {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items = [
    { icon: <Flag size={15} />, label: 'Report', onClick: onReportUser, danger: true },
  ];

  return (
    <div ref={ref} style={{
      position: 'absolute', top: '48px', right: 8,
      background: '#fff', border: '1px solid #e8e3df', borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.13)', zIndex: 300, minWidth: 190,
      overflow: 'hidden',
    }}>
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick?.(); onClose(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', padding: '11px 16px', border: 'none',
            background: 'none', cursor: 'pointer', fontSize: 13.5,
            fontWeight: 500, color: item.danger ? '#dc2626' : '#1a1512',
            transition: 'background 0.12s', textAlign: 'left',
          }}
          onMouseEnter={e => e.currentTarget.style.background = item.danger ? '#fef2f2' : '#f8f5f2'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <span style={{ color: item.danger ? '#dc2626' : '#8a8179' }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
};

// ── Info Panel ────────────────────────────────────────────────────────────────
const InfoPanel = ({ otherUser, sharedTasks, onClose, isMobile }) => {
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isMobile && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 399,
          }}
        />
      )}
      <div style={{
        position: 'fixed', top: 0, right: 0,
        height: '100%',
        width: isMobile ? '85vw' : 320,
        maxWidth: 360,
        background: '#fff', borderLeft: '1px solid #e8e3df',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.08)', zIndex: 400,
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid #e8e3df',
          position: 'sticky', top: 0, background: '#fff', zIndex: 1,
        }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1512' }}>Contact Info</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}
          >
            <X size={18} style={{ color: '#8a8179' }} />
          </button>
        </div>

        <div style={{ padding: '28px 20px 20px', textAlign: 'center', borderBottom: '1px solid #e8e3df' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', background: '#f6ad56',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 700, color: '#fff', margin: '0 auto 12px',
            overflow: 'hidden',
          }}>
            {otherUser?.profileImage
              ? <img src={otherUser.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : getInitials(otherUser?.name)}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1512', marginBottom: 4 }}>
            {otherUser?.name || 'Unknown'}
          </div>
          <div style={{
            fontSize: 12, color: '#8a8179', background: '#f8f5f2',
            display: 'inline-block', padding: '3px 10px', borderRadius: 20,
          }}>
            {otherUser?.taskType || 'User'}
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8e3df' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#b0a99f', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Contact
          </div>
          {otherUser?.email && (
            <div style={{ fontSize: 13.5, color: '#1a1512', marginBottom: 8 }}>
              <span style={{ color: '#8a8179', fontSize: 12 }}>Email · </span>
              {otherUser.email}
            </div>
          )}
          {otherUser?.phone && (
            <div style={{ fontSize: 13.5, color: '#1a1512', marginBottom: 8 }}>
              <span style={{ color: '#8a8179', fontSize: 12 }}>Phone · </span>
              {otherUser.phone}
            </div>
          )}
          {otherUser?.address && (
            <div style={{ fontSize: 13.5, color: '#1a1512' }}>
              <span style={{ color: '#8a8179', fontSize: 12 }}>Location · </span>
              {otherUser.address}
            </div>
          )}
          {!otherUser?.email && !otherUser?.phone && !otherUser?.address && (
            <div style={{ fontSize: 13, color: '#b0a99f' }}>No contact details available</div>
          )}
        </div>

        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#b0a99f', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Shared Bookings ({sharedTasks?.length || 0})
          </div>
          {(sharedTasks || []).length === 0 ? (
            <div style={{ fontSize: 13, color: '#b0a99f' }}>No shared bookings</div>
          ) : (
            sharedTasks.map((task, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: i < sharedTasks.length - 1 ? '1px solid #f1f0ee' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1a1512' }}>
                    {task.taskName || task.title || 'Task'}
                  </div>
                  <div style={{ fontSize: 11, color: '#b0a99f', marginTop: 2 }}>
                    #{(task._id || task.id || '').slice(-6).toUpperCase()}
                  </div>
                </div>
                <StatusBadge status={task.status} />
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

// ── Voice Recorder ────────────────────────────────────────────────────────────
const useVoiceRecorder = ({ onSend, actualUserId, otherUser, setMessages, setConversations, otherId }) => {
  const [recording, setRecording]   = useState(false);
  const [duration,  setDuration]    = useState(0);
  const mediaRecorderRef            = useRef(null);
  const chunksRef                   = useRef([]);
  const timerRef                    = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result;
          const payload = JSON.stringify({
            type: 'media', mediaUrl: base64,
            mediaType: 'audio/webm', fileName: `voice_${Date.now()}.webm`,
          });
          const newMsg = {
            sender_id: actualUserId, message: payload,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: new Date().toDateString(),
          };
          setMessages(prev => [...prev, newMsg]);
          setConversations(prev => prev.map(c =>
            (c.otherUser === (otherUser?.id) || c.otherUser === otherId)
              ? { ...c, lastMessage: payload, lastMessageTime: Date.now() / 1000 }
              : c
          ));
          sendMessageWS(actualUserId, otherUser?.id, payload);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
        clearInterval(timerRef.current);
        setDuration(0);
      };
      mr.start();
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      alert('Microphone access denied. Please allow microphone access to send voice messages.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return { recording, duration, startRecording, stopRecording };
};

// ── Media Message ─────────────────────────────────────────────────────────────
const MediaMessage = ({ mediaUrl, mediaType, fileName }) => {
  const isImage = mediaType?.startsWith('image/');
  const isVideo = mediaType?.startsWith('video/');
  const isAudio = mediaType?.startsWith('audio/');

  if (isImage) {
    return (
      <div
        style={{ borderRadius: 12, overflow: 'hidden', maxWidth: '100%', cursor: 'pointer' }}
        onClick={() => window.open(mediaUrl, '_blank')}
      >
        <img
          src={mediaUrl}
          alt={fileName || 'image'}
          style={{ width: '100%', display: 'block', maxHeight: 280, objectFit: 'cover' }}
        />
      </div>
    );
  }

  if (isVideo) {
    return (
      <div style={{ borderRadius: 12, overflow: 'hidden', maxWidth: '100%', background: '#000' }}>
        <video controls style={{ width: '100%', maxHeight: 280, display: 'block' }}>
          <source src={mediaUrl} type={mediaType} />
        </video>
      </div>
    );
  }

  if (isAudio) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
        background: '#f1f5f9', borderRadius: 12, maxWidth: '100%',
      }}>
        <Mic size={16} style={{ color: '#f6ad56', flexShrink: 0 }} />
        <audio controls style={{ height: 32, flex: 1, minWidth: 0 }}>
          <source src={mediaUrl} type={mediaType} />
        </audio>
      </div>
    );
  }

  return (
    <a
      href={mediaUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px',
        background: '#f1f5f9', borderRadius: 10, textDecoration: 'none',
        color: '#1a1512', fontSize: 13, fontWeight: 600,
      }}
    >
      <File size={17} style={{ color: '#8a8179', flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
        {fileName || 'File'}
      </span>
    </a>
  );
};

// ── Offer Card ────────────────────────────────────────────────────────────────
const OfferCard = ({ offer, isMyMessage, isWorker, onAccept, onReject }) => {
  const isPending  = offer.status === 'pending';
  const isAccepted = offer.status === 'accepted';
  const isRejected = offer.status === 'rejected';

  const isStatusMsg =
    offer.type === 'offer_accepted' || offer.type === 'offer_rejected';

  const cardClass = isStatusMsg
    ? `mp-offer-card ${offer.type === 'offer_accepted' ? 'accepted' : 'rejected'}`
    : 'mp-offer-card pending';

  return (
    <div className={cardClass}>
      <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1a1512' }}>
          {offer.taskName || 'Task'}
        </div>
        <div style={{ fontSize: 11, color: '#8a8179', marginTop: 2 }}>
          Booking #{offer.taskId ? offer.taskId.slice(-6).toUpperCase() : 'N/A'}
        </div>
      </div>

      <div style={{
        fontSize: 11, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: isStatusMsg
          ? (offer.type === 'offer_accepted' ? '#059669' : '#dc2626')
          : '#f6ad56',
      }}>
        {isStatusMsg
          ? (offer.type === 'offer_accepted' ? 'Offer Accepted' : 'Offer Rejected')
          : 'Service Offer'}
      </div>

      <div className="mp-offer-row">
        <span className="mp-offer-label">Estimated Hours</span>
        <span className="mp-offer-value">{offer.hours} hrs</span>
      </div>
      <div className="mp-offer-row">
        <span className="mp-offer-label">Additional charges</span>
        <span className="mp-offer-value">Rs. {Number(offer.additionalCost).toLocaleString()}</span>
      </div>
      {offer.totalCost && (
        <div className="mp-offer-total">
          <span className="mp-offer-label" style={{ fontWeight: 700 }}>Total</span>
          <span className="mp-offer-value" style={{ color: '#059669' }}>
            Rs. {Number(offer.totalCost).toLocaleString()}
          </span>
        </div>
      )}

      {isAccepted && !isStatusMsg && (
        <div style={{ background: '#d1fae5', color: '#059669', padding: '7px', borderRadius: 8, textAlign: 'center', fontWeight: 600, fontSize: 13, marginTop: 10 }}>
          Offer Accepted
        </div>
      )}
      {isRejected && !isStatusMsg && (
        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '7px', borderRadius: 8, textAlign: 'center', fontWeight: 600, fontSize: 13, marginTop: 10 }}>
          Offer Rejected
        </div>
      )}

      {isStatusMsg && (
        <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 600, textAlign: 'center',
          color: offer.type === 'offer_accepted' ? '#059669' : '#dc2626' }}>
          {offer.type === 'offer_accepted'
            ? 'The worker will arrive on the scheduled date.'
            : 'You can negotiate a new offer.'}
        </div>
      )}

      {isPending && !isMyMessage && !isStatusMsg && !isWorker && (
        <div className="mp-offer-actions">
          <button className="mp-offer-reject" onClick={onReject}>Reject</button>
          <button className="mp-offer-accept" onClick={onAccept}>Accept</button>
        </div>
      )}
    </div>
  );
};

// ── Message Context Menu ──────────────────────────────────────────────────────
const MessageContextMenu = ({ x, y, message, isMyMessage, onCopy, onDelete, onClose }) => {
  const ref = useRef(null);

  // Clamp position so it never goes offscreen
  const [pos, setPos] = useState({ x, y });
  useEffect(() => {
    if (!ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setPos({
      x: Math.min(x, vw - width - 8),
      y: Math.min(y, vh - height - 8),
    });
  }, [x, y]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'fixed', top: pos.y, left: pos.x,
      background: '#fff', border: '1px solid #e8e3df', borderRadius: 10,
      boxShadow: '0 6px 24px rgba(0,0,0,0.12)', zIndex: 500, minWidth: 150,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => { onCopy(message); onClose(); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          width: '100%', padding: '10px 14px', border: 'none',
          background: 'none', cursor: 'pointer', fontSize: 13.5,
          fontWeight: 500, color: '#1a1512',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#f8f5f2'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <Copy size={14} style={{ color: '#8a8179' }} /> Copy
      </button>
      {isMyMessage && (
        <button
          onClick={() => { onDelete(); onClose(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            width: '100%', padding: '10px 14px', border: 'none',
            background: 'none', cursor: 'pointer', fontSize: 13.5,
            fontWeight: 500, color: '#dc2626',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <Trash2 size={14} style={{ color: '#dc2626' }} /> Delete
        </button>
      )}
    </div>
  );
};

// ── Toast Notification ────────────────────────────────────────────────────────
const Toast = ({ message, onDone, duration = 5000 }) => {
  useEffect(() => {
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, [onDone, duration]);
  return (
    <div style={{
      position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
      background: '#1a1512', color: '#fff', padding: '10px 20px',
      borderRadius: 24, fontSize: 13.5, fontWeight: 600,
      boxShadow: '0 4px 16px rgba(0,0,0,0.18)', zIndex: 600,
      whiteSpace: 'nowrap', pointerEvents: 'none',
      animation: 'mp-toast-in 0.2s ease',
      maxWidth: 'calc(100vw - 32px)',
      textAlign: 'center',
    }}>
      {message.text}
    </div>
  );
};

// ── helpers ───────────────────────────────────────────────────────────────────
const resolveConvoName = (c) =>
  c.name ||
  c.other_user_name ||
  c.participant_name ||
  c.display_name ||
  c.fullName ||
  c.full_name ||
  c.username ||
  null;

// ── useIsMobile hook ──────────────────────────────────────────────────────────
const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
};

// ── Main Component ────────────────────────────────────────────────────────────
const MessagesPage = () => {
  const { senderId, recieverId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
  const currentUser = storedUser ? JSON.parse(storedUser) : null;
  const actualUserId =
    currentUser?.id || currentUser?._id || currentUser?.userId || null;
  const isWorker =
    currentUser?.role === 'worker' || currentUser?.type === 'worker';
  const otherId = recieverId;

  const [otherUser,          setOtherUser]         = useState(null);
  const [messages,           setMessages]          = useState([]);
  const [conversations,      setConversations]     = useState([]);
  const [sharedTasks,        setSharedTasks]       = useState([]);
  const [messageInput,       setMessageInput]      = useState('');
  const [searchQuery,        setSearchQuery]       = useState('');
  const [loading,            setLoading]           = useState(true);
  const [error,              setError]             = useState(null);
  // On mobile: sidebar hidden when a chat is open; on desktop: always visible
  const [showSidebar,        setShowSidebar]       = useState(!isMobile || !otherId);
  const [showOfferModal,     setShowOfferModal]    = useState(false);
  const [offerData,          setOfferData]         = useState({ hours: '', additionalCost: '' });
  const [selectedOfferTask,  setSelectedOfferTask] = useState(null);
  const [myBasePrice,        setMyBasePrice]       = useState(null);
  const [activeTab,          setActiveTab]         = useState('chat');
  const [sidebarWidth,       setSidebarWidth]      = useState(280);
  const [convosLoading,      setConvosLoading]     = useState(true);
  const [mediaPreview,       setMediaPreview]      = useState(null);
  const [uploading,          setUploading]         = useState(false);

  const [showMoreMenu,       setShowMoreMenu]       = useState(false);
  const [showInfoPanel,      setShowInfoPanel]      = useState(false);
  const [toastMsg,           setToastMsg]           = useState(null);
  const [contextMenu,        setContextMenu]        = useState(null);

  const messagesEndRef      = useRef(null);
  const handleNewMessageRef = useRef(null);
  const sidebarRef          = useRef(null);
  const isResizing          = useRef(false);
  const imageInputRef       = useRef(null);
  const fileInputRef        = useRef(null);
  const inputBarRef         = useRef(null);
  const { addToast } = useToast();

  const otherUserRef = useRef(null);
  useEffect(() => { otherUserRef.current = otherUser; }, [otherUser]);

  // ── Sync sidebar visibility with mobile/route changes ────────────────────
  useEffect(() => {
    // On mobile: show sidebar only when no conversation is open
    if (isMobile) {
      setShowSidebar(!otherId);
    } else {
      // On desktop: always show sidebar
      setShowSidebar(true);
    }
  }, [isMobile, otherId]);

  // ── Voice recorder ─────────────────────────────────────────────────────────
  const { recording, duration, startRecording, stopRecording } = useVoiceRecorder({
    actualUserId, otherUser, setMessages, setConversations, otherId,
  });

  const showToast = (text) => setToastMsg({ text, id: Date.now() });

  // ── Request browser notification permission on mount ───────────────────────
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ── Resize (desktop only) ──────────────────────────────────────────────────
  const startResizing  = (e) => {
    if (isMobile) return;
    e.preventDefault();
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
  };
  const handleMouseMove = (e) => {
    if (!isResizing.current) return;
    const w = e.clientX;
    if (w >= 200 && w <= 500) setSidebarWidth(w);
  };
  const stopResizing = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const isOfferResponseMsg = (msg) => {
    try {
      const p = JSON.parse(msg?.message || msg?.text || '');
      if (p?.type === 'offer_response') return { yes: true, status: p.status };
    } catch {}
    if (msg?.type === 'offer_response') return { yes: true, status: msg.status };
    return { yes: false };
  };

  const parseOfferMessage = (msg) => {
    try {
      const p = JSON.parse(msg?.message || '');
      if (['offer', 'offer_accepted', 'offer_rejected'].includes(p?.type)) return p;
    } catch {}
    return null;
  };

  const parseMediaMessage = (msg) => {
    try {
      const p = JSON.parse(msg?.message || '');
      if (p?.type === 'media') return p;
    } catch {}
    return null;
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const formatLastMessage = (rawMessage) => {
    try {
      const p = JSON.parse(rawMessage || '');
      if (p.type === 'offer') return isWorker ? 'You sent a service offer' : `${otherUser?.name || 'Worker'} sent a service offer`;
      if (p.type === 'offer_accepted') return isWorker ? `${otherUser?.name || 'Customer'} accepted the offer` : 'You accepted the offer';
      if (p.type === 'offer_rejected') return isWorker ? `${otherUser?.name || 'Customer'} rejected the offer` : 'You rejected the offer';
      if (p.type === 'media') {
        const isImage = p.mediaType?.startsWith('image/');
        const isVideo = p.mediaType?.startsWith('video/');
        const isAudio = p.mediaType?.startsWith('audio/');
        return isImage ? '📷 Photo' : isVideo ? '🎥 Video' : isAudio ? '🎤 Voice message' : '📎 File';
      }
    } catch {}
    return rawMessage || 'No messages yet';
  };

  const hasPendingOfferForTask = (taskId) => {
    const relevant = messages.filter(m => {
      try { const p = JSON.parse(m.message || ''); return p?.type === 'offer' && p?.taskId === taskId; } catch { return false; }
    });
    const last = [...relevant].reverse()[0];
    if (!last) return false;
    const lastIdx = messages.indexOf(last);
    return !messages.slice(lastIdx + 1).some(m => {
      try { const p = JSON.parse(m.message || ''); return (p?.type === 'offer_accepted' || p?.type === 'offer_rejected') && p?.taskId === taskId; } catch { return false; }
    });
  };

  // ── handleNewMessageRef ────────────────────────────────────────────────────
  handleNewMessageRef.current = (msg) => {
    console.log('🔔 WS handler called:', msg, typeof msg);
    console.log('👤 actualUserId:', actualUserId, '| msg.sender_id:', msg.sender_id, '| match:', msg.sender_id === actualUserId);
    if (actualUserId && msg.sender_id === actualUserId) return;
    if (!msg || typeof msg !== 'object') return;
    if (actualUserId && msg.sender_id === actualUserId) return;

    const { yes, status } = isOfferResponseMsg(msg);
    if (yes) {
      setMessages(prev => prev.map(m => {
        try {
          const p = JSON.parse(m.message || '');
          if (p.type === 'offer' && p.status === 'pending')
            return { ...m, message: JSON.stringify({ ...p, status }) };
        } catch {}
        return m;
      }));
    }

    setMessages(prev => [...prev, msg]);
    setConversations(prev => prev.map(c =>
      (c.otherUser === msg.sender_id || c.otherUser === otherId)
        ? { ...c, lastMessage: msg.message || '', lastMessageTime: Date.now() / 1000 }
        : c
    ));

    const senderName =
      otherUserRef.current?.name?.split(' ')[0] ||
      msg.senderName ||
      'New message';

    let preview = msg.message || '';
    try {
      const p = JSON.parse(preview);
      if (p.type === 'media')
        preview = p.mediaType?.startsWith('image/') ? '📷 Photo'
                : p.mediaType?.startsWith('audio/') ? '🎤 Voice message'
                : '📎 File';
      else if (p.type === 'offer')          preview = '📋 Sent a service offer';
      else if (p.type === 'offer_accepted') preview = '✅ Accepted your offer';
      else if (p.type === 'offer_rejected') preview = '❌ Rejected your offer';
    } catch {}

    const shortPreview = preview.length > 90 ? preview.slice(0, 90) + '…' : preview;

    addToast("New message from " + senderName);

    if (document.hidden && Notification.permission === 'granted') {
      new Notification(`${senderName} sent you a message`, {
        body: shortPreview,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: msg.sender_id,
        renotify: true,
      });
    }
  };

  useEffect(() => { setActiveTab('chat'); }, [senderId, recieverId]);

  // ── Fetch conversations ────────────────────────────────────────────────────
  useEffect(() => {
    if (!actualUserId) return;
    setConvosLoading(true);
    fetchConversations(actualUserId)
      .then(convos => setConversations((convos || []).map(c => ({
        id:              c.room_id || c.id,
        otherUser:       c.other_user,
        name:            resolveConvoName(c),
        lastMessage:     c.last_message || c.lastMessage || '',
        lastMessageTime: c.last_time || c.lastMessageTime || '',
        unreadCount:     c.unreadCount || 0,
        profileImage:    c.profileImage || c.profile_image || null,
      }))))
      .catch(() => setConversations([]))
      .finally(() => setConvosLoading(false));
  }, [actualUserId]);

  // ── When otherUser resolves, patch matching conversation name ──────────────
  useEffect(() => {
    if (!otherUser?.id || !otherUser?.name) return;
    setConversations(prev => prev.map(c => {
      const parts       = (c.id || '').split('__');
      const otherInRoom = parts.find(p => p !== actualUserId) || '';
      if (otherInRoom !== otherUser.id && c.otherUser !== otherUser.id) return c;
      const looksLikeId = !c.name || c.name === c.otherUser || c.name === otherInRoom;
      return looksLikeId ? { ...c, name: otherUser.name, profileImage: c.profileImage || otherUser.profileImage } : c;
    }));
  }, [otherUser, actualUserId]);

  // ── Fetch other user ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!otherId) { setLoading(false); return; }
    if (!actualUserId) { setError('You are not logged in.'); setLoading(false); return; }
    const init = async () => {
      try {
        setLoading(true); setError(null);
        let data = null, resolvedAsWorker = false;
        const isEmailId = otherId.includes('@');
        if (isEmailId) {
          const result = await fetchWorkerById(otherId);
          data = Array.isArray(result) ? result[0] : result;
          resolvedAsWorker = true;
        } else {
          try {
            const result = await fetchCustomerById(otherId);
            const c = Array.isArray(result) ? result[0] : result;
            if (c && (c._id || c.id)) { data = c; resolvedAsWorker = false; }
          } catch {}
          if (!data) {
            const result = await fetchWorkerById(otherId);
            data = Array.isArray(result) ? result[0] : result;
            resolvedAsWorker = true;
          }
        }
        if (!data) throw new Error('Could not find the other user');
        setOtherUser({
          ...data,
          id: data._id || data.id || otherId,
          name: resolvedAsWorker
            ? `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email || 'Unknown'
            : `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.email || 'Unknown',
          taskType: resolvedAsWorker ? (data.taskType || 'Worker') : 'Customer',
        });
        if (isWorker) {
          const myData = await fetchWorkerById(actualUserId);
          const me = Array.isArray(myData) ? myData[0] : myData;
          setMyBasePrice(me?.basePrice || null);
        }
        setLoading(false);
      } catch (err) { setError(err.message || 'Failed to load user'); setLoading(false); }
    };
    init();
  }, [otherId, isWorker, actualUserId]);

  // ── Messages + WebSocket ───────────────────────────────────────────────────
  useEffect(() => {
    if (!otherUser?.id || !actualUserId) return;
    const load = async () => {
      try {
        const old = await fetchMessages(actualUserId, otherUser.id);
        setMessages((Array.isArray(old) ? old : []).filter(m => !isOfferResponseMsg(m).yes));
      } catch { setMessages([]); }
    };
    load();
    const stableHandler = (msg) => handleNewMessageRef.current(msg);
    try { connectWebSocket(actualUserId, otherUser.id, stableHandler); } catch (err) { console.error('WS connect failed:', err); }
    return () => closeWebSocket();
  }, [otherUser?.id, actualUserId]);

  // ── Shared tasks ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!actualUserId || !otherId) return;
    const workerParam   = isWorker ? actualUserId : otherId;
    const customerParam = isWorker ? otherId      : actualUserId;
    fetchSharedTasks(workerParam, customerParam)
      .then(tasks => setSharedTasks(
        (Array.isArray(tasks) ? tasks : []).filter(t =>
          !['completed', 'cancelled', 'paid'].includes((t.status || '').toLowerCase())
        )
      ))
      .catch(() => setSharedTasks([]));
  }, [actualUserId, otherId, isWorker]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── File select ────────────────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setMediaPreview({ file, url, type: file.type, name: file.name });
    e.target.value = '';
  };

  const cancelMediaPreview = () => {
    if (mediaPreview?.url) URL.revokeObjectURL(mediaPreview.url);
    setMediaPreview(null);
  };

  const sendMedia = async () => {
    if (!mediaPreview) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(mediaPreview.file);
      });
      const payload = JSON.stringify({
        type: 'media', mediaUrl: base64,
        mediaType: mediaPreview.type, fileName: mediaPreview.name,
      });
      const newMsg = {
        sender_id: actualUserId, message: payload,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toDateString(),
      };
      setMessages(prev => [...prev, newMsg]);
      setConversations(prev => prev.map(c =>
        (c.otherUser === otherUser.id || c.otherUser === otherId)
          ? { ...c, lastMessage: payload, lastMessageTime: Date.now() / 1000 }
          : c
      ));
      sendMessageWS(actualUserId, otherUser.id, payload);
      cancelMediaPreview();
    } catch (err) {
      console.error('Media send failed:', err);
      alert('Failed to send media. Please try again.');
    } finally { setUploading(false); }
  };

  // ── Offer ──────────────────────────────────────────────────────────────────
  const offerEligibleTasks = sharedTasks.filter(t =>
    ['pending', 'confirmed'].includes((t.status || '').toLowerCase())
  );

  const openOfferModal = () => {
    if (offerEligibleTasks.length === 0) {
      alert('No tasks available for an offer. Tasks must be Pending or Confirmed.');
      return;
    }
    const preselect = offerEligibleTasks.find(t => (t._id || t.id) === activeTab) || offerEligibleTasks[0];
    setSelectedOfferTask(preselect);
    setShowOfferModal(true);
  };

  const sendOffer = () => {
    if (!selectedOfferTask) return alert('Please select a task first.');
    const taskStatus = (selectedOfferTask.status || '').toLowerCase();
    if (taskStatus === 'in_progress') { alert('Cannot send an offer — this task is already in progress.'); return; }
    if (!['pending', 'confirmed'].includes(taskStatus)) { alert('Offers can only be sent for Pending or Confirmed tasks.'); return; }
    const taskId = selectedOfferTask._id || selectedOfferTask.id;
    if (hasPendingOfferForTask(taskId)) { alert('This task already has a pending offer. Wait for the customer to respond first.'); return; }
    if (!offerData.hours) return alert('Fill in estimated hours');
    const payload = JSON.stringify({
      type: 'offer', hours: offerData.hours, status: 'pending', taskId,
      taskName: selectedOfferTask.taskName || selectedOfferTask.title || 'Task',
      additionalCost: offerData.additionalCost ? Number(offerData.additionalCost) : 0,
      totalCost: myBasePrice
        ? (offerData.hours * myBasePrice) + (Number(offerData.additionalCost) || 0)
        : null,
    });
    setMessages(prev => [...prev, {
      sender_id: actualUserId, message: payload,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toDateString(),
    }]);
    sendMessageWS(actualUserId, otherUser.id, payload);
    setConversations(prev => prev.map(c =>
      (c.otherUser === otherUser.id || c.otherUser === otherId)
        ? { ...c, lastMessage: payload, lastMessageTime: Date.now() / 1000 }
        : c
    ));
    setShowOfferModal(false);
    setOfferData({ hours: '', additionalCost: '' });
    setSelectedOfferTask(null);
  };

  const handleOfferResponse = async (msgIndex, status) => {
    const msg = messages[msgIndex];
    let parsedOffer;
    try { parsedOffer = JSON.parse(msg.message); } catch { return; }
    if (!isWorker) {
      setMessages(prev => {
        const u = [...prev];
        u[msgIndex] = { ...u[msgIndex], message: JSON.stringify({ ...parsedOffer, status }) };
        return u;
      });
    }
    const offerTaskId = parsedOffer.taskId || (activeTab !== 'chat' ? activeTab : null);
    if (status === 'accepted' && offerTaskId) {
      await updateOfferDetails(offerTaskId, {
        estimatedHours: Number(parsedOffer.hours) || 0,
        additionalCost: Number(parsedOffer.additionalCost) || 0,
        offerStatus: 'accepted',
      });
    }
    const confirmPayload = JSON.stringify({
      type: status === 'accepted' ? 'offer_accepted' : 'offer_rejected',
      hours: parsedOffer.hours, additionalCost: parsedOffer.additionalCost,
      totalCost: parsedOffer.totalCost, taskId: parsedOffer.taskId,
      taskName: parsedOffer.taskName, status,
    });
    setMessages(prev => [...prev, {
      sender_id: actualUserId, message: confirmPayload,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toDateString(),
    }]);
    sendMessageWS(actualUserId, otherUser.id, confirmPayload);
    setConversations(prev => prev.map(c =>
      (c.otherUser === otherUser.id || c.otherUser === otherId)
        ? { ...c, lastMessage: confirmPayload, lastMessageTime: Date.now() / 1000 }
        : c
    ));
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    const newMsg = {
      sender_id: actualUserId, message: messageInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toDateString(),
    };
    setMessages(prev => [...prev, newMsg]);
    setConversations(prev => prev.map(c =>
      (c.otherUser === newMsg.sender_id || c.otherUser === otherUser.id)
        ? { ...c, lastMessage: newMsg.message, lastMessageTime: Date.now() / 1000 }
        : c
    ));
    try { sendMessageWS(actualUserId, otherUser.id, messageInput); } catch (err) { console.error(err); }
    setMessageInput('');
  };

  const handleReportUser = () => {
    if (window.confirm(`Report ${otherUser?.name} for inappropriate behaviour?`)) {
      showToast('User reported. Thank you.');
    }
  };

  const handleCopyMessage = (msg) => {
    let text = msg.message || '';
    try {
      const p = JSON.parse(text);
      if (p.type === 'media') text = p.fileName || 'Media file';
      else if (p.type === 'offer') text = `Service Offer: ${p.hours}hrs, Rs.${p.additionalCost} additional`;
      else if (p.type === 'offer_accepted') text = 'Offer Accepted';
      else if (p.type === 'offer_rejected') text = 'Offer Rejected';
    } catch {}
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard'));
  };

  const handleDeleteMessage = (index) => {
    setMessages(prev => prev.filter((_, i) => i !== index));
    showToast('Message deleted');
  };

  const handleMessageContextMenu = (e, index) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, msgIndex: index });
  };

  // Long-press for touch devices (context menu equivalent)
  const longPressTimer = useRef(null);
  const handleTouchStart = (e, index) => {
    longPressTimer.current = setTimeout(() => {
      const touch = e.touches[0];
      setContextMenu({ x: touch.clientX, y: touch.clientY, msgIndex: index });
    }, 500);
  };
  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
  };

  const filteredConversations = conversations.filter(c =>
    (c.name || c.otherUser || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Mobile: navigate back to sidebar ──────────────────────────────────────
  const handleMobileBack = () => {
    if (isMobile) {
      navigate(`/chat/${actualUserId}`);
    } else {
      navigate(-1);
    }
  };

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const SidebarJSX = (
    <>
      {/* Mobile overlay backdrop */}
      {isMobile && showSidebar && otherId && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 198 }}
          onClick={() => setShowSidebar(false)}
        />
      )}
      <div
        ref={sidebarRef}
        className="mp-sidebar"
        style={{
          width: isMobile ? '100%' : sidebarWidth + 'px',
          // On mobile with a chat open, sidebar slides in from left as overlay
          ...(isMobile && otherId ? {
            position: 'fixed',
            left: showSidebar ? 0 : '-100%',
            top: 0,
            bottom: 0,
            zIndex: 199,
            transition: 'left 0.25s ease',
            width: '85vw',
            maxWidth: 340,
          } : {}),
        }}
      >
        <div className="mp-sidebar-header">
          <h2 className="mp-sidebar-title">Messages</h2>
          {otherId && (
            <button className="mp-icon-btn" onClick={() => setShowSidebar(false)}>
              <X size={18} />
            </button>
          )}
        </div>

        <div className="mp-search-wrap">
          <Search size={14} className="mp-search-icon" />
          <input
            type="text"
            placeholder="Search conversations…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="mp-search-input"
          />
        </div>

        <div className="mp-convo-list">
          {convosLoading ? (
            <div className="mp-empty">Loading…</div>
          ) : filteredConversations.length === 0 ? (
            <div className="mp-empty">No conversations yet</div>
          ) : (
            filteredConversations.map((convo, i) => {
              const parts       = (convo.id || '').split('__');
              const otherInRoom = parts.find(p => p !== actualUserId) || '';
              const isActive    = otherInRoom === otherId;

              const displayName  = isActive && otherUser?.name
                ? otherUser.name
                : convo.name || otherInRoom;
              const displayImage = isActive && otherUser?.profileImage
                ? otherUser.profileImage
                : convo.profileImage;

              return (
                <div
                  key={i}
                  className={`mp-convo-item${isActive ? ' active' : ''}`}
                  onClick={() => {
                    navigate(`/chat/${actualUserId}/${otherInRoom}`);
                    if (isMobile) setShowSidebar(false);
                  }}
                >
                  <div className="mp-conv-avatar">
                    {displayImage
                      ? <img src={displayImage} alt="" className="mp-avatar-img" />
                      : <span>{getInitials(displayName)}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span className="mp-conv-name">{displayName}</span>
                      <span className="mp-conv-time">
                        {convo.lastMessageTime
                          ? new Date(convo.lastMessageTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="mp-conv-last">{formatLastMessage(convo.lastMessage)}</span>
                      {convo.unreadCount > 0 && <span className="mp-badge">{convo.unreadCount}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!isMobile && <div className="mp-resize-handle" onMouseDown={startResizing} />}
      </div>
    </>
  );

  // ── Empty / Loading / Error states ────────────────────────────────────────
  if (!otherId) {
    return (
      <>
        <BookingNavbar />
        <div className="mp-container">
          {SidebarJSX}
          <div className="mp-no-convo">
            <div className="mp-no-convo-icon">
              <MessageSquare size={32} style={{ color: '#f6ad56' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a1512', margin: '0 0 6px', letterSpacing: '-0.3px' }}>
                No conversation selected
              </h3>
              <p style={{ fontSize: 13.5, color: '#8a8179', margin: 0, lineHeight: 1.6 }}>
                Click a conversation from the list<br />or book a worker to start chatting
              </p>
            </div>
          </div>
        </div>
        <div className="mp-chat-widget-wrapper"><ChatWidget /></div>
      </>
    );
  }

  if (loading) return (
    <>
      <BookingNavbar />
      <div className="mp-container">
        {!isMobile && SidebarJSX}
        <div className="mp-center">
          <div className="mp-spinner" />
          <p style={{ color: '#8a8179', margin: 0, fontSize: 14 }}>Loading…</p>
        </div>
      </div>
      <div className="mp-chat-widget-wrapper"><ChatWidget /></div>
    </>
  );

  if (error || !otherUser) return (
    <>
      <BookingNavbar />
      <div className="mp-container">
        {!isMobile && SidebarJSX}
        <div className="mp-center">
          <h3 style={{ color: '#ef4444', marginBottom: 8 }}>{error || 'User not found'}</h3>
          <button
            onClick={() => navigate(-1)}
            style={{ padding: '9px 20px', background: '#f6ad56', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
          >
            Go Back
          </button>
        </div>
      </div>
      <div className="mp-chat-widget-wrapper"><ChatWidget /></div>
    </>
  );

  const activeTaskObj = activeTab !== 'chat'
    ? sharedTasks.find(t => (t._id || t.id) === activeTab)
    : null;

  return (
    <>
      <BookingNavbar />
      <div className="mp-container">
        {/* Hidden inputs */}
        <input ref={imageInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFileSelect} />
        <input ref={fileInputRef}  type="file" accept="*/*"             style={{ display: 'none' }} onChange={handleFileSelect} />

        {/* Sidebar: always render; visibility controlled above */}
        {SidebarJSX}

        <div
          className="mp-chat-pane"
          style={{
            // On mobile the chat pane fills the full width
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >

          {/* ── Header ── */}
          <div className="mp-header" style={{ position: 'relative' }}>
            <div className="mp-header-left">
              {/* On mobile: hamburger opens sidebar; on desktop: toggles it */}
              <button
                className="mp-icon-btn"
                onClick={() => {
                  if (isMobile) {
                    setShowSidebar(true);
                  } else {
                    setShowSidebar(prev => !prev);
                  }
                }}
              >
                <Menu size={18} />
              </button>
              <button className="mp-icon-btn" onClick={handleMobileBack}>
                <ArrowLeft size={18} />
              </button>
              <div className="mp-header-avatar">
                {otherUser.profileImage
                  ? <img src={otherUser.profileImage} alt="" className="mp-avatar-img" />
                  : <span>{getInitials(otherUser.name)}</span>}
                <span
                  className="mp-status-dot"
                  style={{ backgroundColor: otherUser.status === 'online' ? '#10b981' : '#b0a99f' }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 className="mp-header-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {otherUser.name}
                </h3>
                <p className="mp-header-role">{otherUser.taskType}</p>
              </div>
            </div>
            <div className="mp-header-right">
              <button
                className="mp-icon-btn"
                title="Contact info"
                onClick={() => setShowInfoPanel(prev => !prev)}
                style={{ color: showInfoPanel ? '#f6ad56' : undefined }}
              >
                <Info size={17} />
              </button>

              <button
                className="mp-icon-btn"
                title="More options"
                onClick={() => setShowMoreMenu(prev => !prev)}
              >
                <MoreVertical size={17} />
              </button>

              {showMoreMenu && (
                <MoreMenu
                  onClose={() => setShowMoreMenu(false)}
                  onReportUser={handleReportUser}
                />
              )}
            </div>
          </div>

          {/* ── Tab Bar ── */}
          <div className="mp-tab-bar" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <button
              className={`mp-tab${activeTab === 'chat' ? ' active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare size={12} /> Chat
            </button>
            {sharedTasks.map((task, i) => {
              const taskId = task._id || task.id;
              return (
                <button
                  key={taskId}
                  className={`mp-tab${activeTab === taskId ? ' active' : ''}`}
                  onClick={() => setActiveTab(taskId)}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <ClipboardList size={12} style={{ flexShrink: 0 }} />
                  <span>{task.taskName || task.title || `Task ${i + 1}`}</span>
                  <StatusBadge status={task.status} />
                </button>
              );
            })}
          </div>

          {/* ── Chat Tab ── */}
          {activeTab === 'chat' && (
            <>
              <div className="mp-messages">
                {messages.length === 0 ? (
                  <div className="mp-empty-chat">
                    <div style={{ fontSize: 44, opacity: 0.2, marginBottom: 8 }}>💬</div>
                    <h3 style={{ fontSize: 17, fontWeight: 600, color: '#1a1512', margin: '0 0 5px', letterSpacing: '-0.2px' }}>
                      Start the conversation
                    </h3>
                    <p style={{ fontSize: 13.5, color: '#8a8179', margin: 0 }}>
                      Send a message to {otherUser.name.split(' ')[0]}
                    </p>
                  </div>
                ) : (
                  <>
                    {messages
                      .filter(msg => msg && typeof msg === 'object' && !isOfferResponseMsg(msg).yes)
                      .map((msg, index) => {
                        const showDate    = index === 0 || msg.date !== messages[index - 1]?.date;
                        const isMyMessage = msg.sender_id === actualUserId || msg.sender === actualUserId;
                        const parsedOffer = parseOfferMessage(msg);
                        const parsedMedia = parseMediaMessage(msg);

                        return (
                          <React.Fragment key={index}>
                            {showDate && (
                              <div className="mp-date-divider">
                                <span className="mp-date-chip">{msg.date || 'Today'}</span>
                              </div>
                            )}
                            <div
                              className={isMyMessage ? 'mp-my-msg' : 'mp-their-msg'}
                              onContextMenu={(e) => handleMessageContextMenu(e, index)}
                              onTouchStart={(e) => handleTouchStart(e, index)}
                              onTouchEnd={handleTouchEnd}
                              onTouchMove={handleTouchEnd}
                            >
                              {!isMyMessage && (
                                <div className="mp-msg-avatar">
                                  {otherUser.profileImage
                                    ? <img src={otherUser.profileImage} alt="" className="mp-avatar-img" />
                                    : <span>{getInitials(otherUser.name)}</span>}
                                </div>
                              )}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, maxWidth: '100%' }}>
                                {!isMyMessage && (
                                  <span className="mp-msg-sender">{otherUser.name}</span>
                                )}
                                {parsedOffer ? (
                                  <OfferCard
                                    offer={parsedOffer}
                                    isMyMessage={isMyMessage}
                                    isWorker={isWorker}
                                    onAccept={() => handleOfferResponse(index, 'accepted')}
                                    onReject={() => handleOfferResponse(index, 'rejected')}
                                  />
                                ) : parsedMedia ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <MediaMessage
                                      mediaUrl={parsedMedia.mediaUrl}
                                      mediaType={parsedMedia.mediaType}
                                      fileName={parsedMedia.fileName}
                                    />
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, paddingRight: 2 }}>
                                      <span style={{ fontSize: 10, color: '#b0a99f' }}>{msg.time || ''}</span>
                                      {isMyMessage && <CheckCheck size={12} style={{ opacity: 0.65, color: '#b0a99f' }} />}
                                    </div>
                                  </div>
                                ) : (
                                  <div className={`mp-bubble ${isMyMessage ? 'mp-bubble-mine' : 'mp-bubble-theirs'}`}>
                                    <span className="mp-bubble-text">{msg.message || ''}</span>
                                    <div className="mp-bubble-meta">
                                      <span className="mp-bubble-time">{msg.time || ''}</span>
                                      {isMyMessage && <CheckCheck size={12} style={{ marginLeft: 2, opacity: 0.7 }} />}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Media preview */}
              {mediaPreview && (
                <div className="mp-media-preview">
                  <div className="mp-media-thumb">
                    {mediaPreview.type?.startsWith('image/') ? (
                      <img src={mediaPreview.url} alt="preview" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '2px solid #f6ad56' }} />
                    ) : (
                      <div style={{ width: 56, height: 56, borderRadius: 8, border: '2px solid #f6ad56', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {mediaPreview.type?.startsWith('video/') ? <Play size={18} style={{ color: '#8a8179' }} /> : <File size={18} style={{ color: '#8a8179' }} />}
                      </div>
                    )}
                    <button className="mp-media-cancel" onClick={cancelMediaPreview}>✕</button>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1512', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mediaPreview.name}</div>
                    <div style={{ fontSize: 11, color: '#b0a99f', marginTop: 2 }}>
                      {mediaPreview.type?.startsWith('image/') ? 'Image' : mediaPreview.type?.startsWith('video/') ? 'Video' : 'File'}
                      {' · '}{(mediaPreview.file.size / 1024 / 1024).toFixed(1)} MB
                    </div>
                  </div>
                  <button
                    onClick={sendMedia}
                    disabled={uploading}
                    style={{ padding: '7px 16px', background: '#f6ad56', color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1, flexShrink: 0 }}
                  >
                    {uploading ? 'Sending…' : 'Send'}
                  </button>
                </div>
              )}

              {/* Voice recording indicator */}
              {recording && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px', background: '#fef3e2',
                  borderTop: '1px solid #fde68a', fontSize: 13.5, fontWeight: 600, color: '#92400e',
                  flexWrap: 'wrap',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1s infinite', flexShrink: 0 }} />
                  Recording… {Math.floor(duration / 60).toString().padStart(2,'0')}:{(duration % 60).toString().padStart(2,'0')}
                  <button
                    onClick={stopRecording}
                    style={{ marginLeft: 'auto', padding: '5px 14px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
                  >
                    <StopCircle size={13} /> Stop & Send
                  </button>
                </div>
              )}

              {/* Input bar */}
              <div className="mp-input-bar" ref={inputBarRef} style={{ position: 'relative' }}>
                <button className="mp-icon-btn" onClick={() => fileInputRef.current?.click()} title="Attach file">
                  <Paperclip size={17} />
                </button>
                <button className="mp-icon-btn" onClick={() => imageInputRef.current?.click()} title="Send image/video">
                  <Image size={17} />
                </button>
                {isWorker && (
                  <button className="mp-offer-btn" onClick={openOfferModal}>
                    {isMobile ? 'Offer' : 'Send Offer'}
                  </button>
                )}
                <input
                  type="text"
                  className="mp-text-input"
                  placeholder={`Message ${otherUser.name.split(' ')[0]}…`}
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                  // Prevent iOS zoom on focus
                  style={{ fontSize: 16 }}
                />
                <button
                  className="mp-icon-btn"
                  title={recording ? 'Stop recording' : 'Record voice message'}
                  onClick={recording ? stopRecording : startRecording}
                  style={{ color: recording ? '#ef4444' : undefined }}
                >
                  {recording ? <StopCircle size={17} /> : <Mic size={17} />}
                </button>
                <button
                  className="mp-send-btn"
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  style={{ opacity: messageInput.trim() ? 1 : 0.45 }}
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          )}

          {/* Task detail tab */}
          {activeTab !== 'chat' && activeTaskObj && (
            <div className="mp-task-pane">
              <div className="mp-task-pane-header">
                <ClipboardList size={15} style={{ color: '#f6ad56' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1512', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {activeTaskObj.taskName || 'Task Details'}
                  </span>
                  <span style={{ fontSize: 11, color: '#b0a99f', marginLeft: 0 }}>
                    #{activeTab.slice(-6).toUpperCase()}
                  </span>
                </div>
                <StatusBadge status={activeTaskObj.status} />
              </div>
              <div style={{ padding: isMobile ? 12 : 20 }}>
                <TaskDetails taskId={activeTab} />
              </div>
            </div>
          )}
        </div>

        {/* ── Info Panel ── */}
        {showInfoPanel && (
          <InfoPanel
            otherUser={otherUser}
            sharedTasks={sharedTasks}
            onClose={() => setShowInfoPanel(false)}
            isMobile={isMobile}
          />
        )}

        {/* ── Message Context Menu ── */}
        {contextMenu && (
          <MessageContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            message={messages[contextMenu.msgIndex]}
            isMyMessage={
              messages[contextMenu.msgIndex]?.sender_id === actualUserId ||
              messages[contextMenu.msgIndex]?.sender === actualUserId
            }
            onCopy={(msg) => handleCopyMessage(msg)}
            onDelete={() => handleDeleteMessage(contextMenu.msgIndex)}
            onClose={() => setContextMenu(null)}
          />
        )}

        {/* ── Offer Modal ── */}
        {showOfferModal && (
          <div className="mp-modal-overlay">
            <div
              className="mp-modal"
              style={{
                width: isMobile ? '92vw' : undefined,
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.4rem' }}>
                <h3 className="mp-modal-title">Send a Service Offer</h3>
                <button className="mp-modal-close" onClick={() => setShowOfferModal(false)}>✕</button>
              </div>

              <label className="mp-label">Select Booking</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: '1.1rem' }}>
                {offerEligibleTasks.map(task => {
                  const taskId   = task._id || task.id;
                  const isSelected = (selectedOfferTask?._id || selectedOfferTask?.id) === taskId;
                  const hasPending = hasPendingOfferForTask(taskId);
                  return (
                    <button
                      key={taskId}
                      disabled={hasPending}
                      onClick={() => !hasPending && setSelectedOfferTask(task)}
                      className={`mp-task-select-btn${isSelected ? ' selected' : ''}`}
                    >
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1a1512' }}>
                          {task.taskName || task.title || 'Unnamed Task'}
                        </div>
                        <div style={{ fontSize: 11, color: '#b0a99f', marginTop: 2 }}>
                          #{taskId.slice(-6).toUpperCase()}
                          {hasPending && <span style={{ color: '#f6ad56', marginLeft: 6 }}>· Offer pending</span>}
                        </div>
                      </div>
                      <StatusBadge status={task.status} />
                    </button>
                  );
                })}
              </div>

              <label className="mp-label">Estimated Hours</label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 3"
                value={offerData.hours}
                onChange={e => setOfferData(p => ({ ...p, hours: e.target.value }))}
                className="mp-modal-input"
                inputMode="numeric"
              />
              {offerData.hours && myBasePrice && (
                <div className="mp-calc-green">
                  Base Cost: Rs. {(offerData.hours * myBasePrice).toLocaleString()} (Rs. {myBasePrice}/hr × {offerData.hours} hrs)
                </div>
              )}

              <label className="mp-label">Additional Cost <span style={{ textTransform: 'none', opacity: 0.6 }}>(optional)</span></label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 500"
                value={offerData.additionalCost}
                onChange={e => setOfferData(p => ({ ...p, additionalCost: e.target.value }))}
                className="mp-modal-input"
                inputMode="numeric"
              />
              {offerData.hours && myBasePrice && offerData.additionalCost && (
                <div className="mp-calc-yellow">
                  Total: Rs. {((offerData.hours * myBasePrice) + Number(offerData.additionalCost)).toLocaleString()}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: '0.75rem' }}>
                <button className="mp-cancel-btn" onClick={() => setShowOfferModal(false)}>Cancel</button>
                <button
                  className="mp-confirm-btn"
                  onClick={sendOffer}
                  disabled={!selectedOfferTask}
                >
                  Send Offer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {toastMsg && (
        <Toast
          key={toastMsg.id}
          message={toastMsg}
          onDone={() => setToastMsg(null)}
        />
      )}

      <div className="mp-chat-widget-wrapper"><ChatWidget /></div>

      <style>{`
        @keyframes mp-toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }

        /* ── Responsive overrides ── */

        /* Tab bar: hide scrollbar but keep scrollable */
        .mp-tab-bar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .mp-tab-bar::-webkit-scrollbar { display: none; }

        /* Mobile layout: full-width chat pane, no sidebar shown inline */
        @media (max-width: 768px) {
          .mp-container {
            position: relative;
            overflow: hidden;
          }

          /* Chat pane fills screen on mobile */
          .mp-chat-pane {
            width: 100% !important;
          }

          /* Tighten header on small screens */
          .mp-header {
            padding: 10px 12px !important;
          }
          .mp-header-name {
            font-size: 14px !important;
            max-width: 140px;
          }

          /* Wider bubbles on mobile */
          .mp-bubble {
            max-width: 82vw !important;
          }

          /* Offer card full-width */
          .mp-offer-card {
            max-width: 85vw !important;
          }

          /* Input bar compact */
          .mp-input-bar {
            padding: 8px 10px !important;
            gap: 6px !important;
          }

          /* Message area: account for mobile bottom chrome */
          .mp-messages {
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }

          /* Input bar: account for iOS home bar */
          .mp-input-bar {
            padding-bottom: max(8px, env(safe-area-inset-bottom)) !important;
          }

          /* Modal full-width on mobile */
          .mp-modal {
            border-radius: 16px !important;
          }

          /* Media preview compact */
          .mp-media-preview {
            padding: 8px 12px !important;
          }

          /* No-convo screen */
          .mp-no-convo {
            width: 100% !important;
          }

          /* Task pane fills screen */
          .mp-task-pane {
            padding: 0 !important;
          }
        }

        /* Very small screens (< 360px) */
        @media (max-width: 360px) {
          .mp-header-name {
            max-width: 100px;
          }
          .mp-offer-btn {
            font-size: 11px !important;
            padding: 5px 8px !important;
          }
          .mp-icon-btn {
            padding: 5px !important;
          }
        }

        /* Tablet (769px – 1024px): slightly narrower sidebar */
        @media (min-width: 769px) and (max-width: 1024px) {
          .mp-sidebar {
            min-width: 220px !important;
          }
        }
      `}</style>
    </>
  );
};

export default MessagesPage;