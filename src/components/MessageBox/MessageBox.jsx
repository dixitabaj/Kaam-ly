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
    <span className="mp-status-badge" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
};

// ── Avatar helper ─────────────────────────────────────────────────────────────
const AvatarImage = ({ src, alt, size = 40, style = {} }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    overflow: 'hidden', flexShrink: 0, background: '#f0ece8',
    ...style,
  }}>
    <img
      src={src}
      alt={alt || ''}
      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
      onError={e => { e.target.style.display = 'none'; }}
    />
  </div>
);

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
      position: 'absolute', top: '3rem', right: '0.5rem',
      background: '#fff', border: '1px solid #e8e3df', borderRadius: '0.75rem',
      boxShadow: '0 0.5rem 2rem rgba(0,0,0,0.13)', zIndex: 300, minWidth: '11.875rem',
      overflow: 'hidden',
    }}>
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick?.(); onClose(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.625rem',
            width: '100%', padding: '0.6875rem 1rem', border: 'none',
            background: 'none', cursor: 'pointer', fontSize: '0.84375rem',
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
      {isMobile && (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 399 }} />
      )}
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100%',
        width: isMobile ? '85vw' : '20vw', maxWidth: '22.5rem',
        minWidth: isMobile ? 'auto' : '16rem',
        background: '#fff', borderLeft: '1px solid #e8e3df',
        boxShadow: '-0.5rem 0 2rem rgba(0,0,0,0.08)', zIndex: 400,
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.25rem', borderBottom: '1px solid #e8e3df',
          position: 'sticky', top: 0, background: '#fff', zIndex: 1,
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1a1512' }}>Contact Info</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', borderRadius: '0.375rem', display: 'flex' }}>
            <X size={18} style={{ color: '#8a8179' }} />
          </button>
        </div>

        <div style={{ padding: '1.75rem 1.25rem 1.25rem', textAlign: 'center', borderBottom: '1px solid #e8e3df' }}>
          <div style={{
            width: '4.5rem', height: '4.5rem', borderRadius: '50%',
            background: '#f6ad56', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.625rem', fontWeight: 700, color: '#fff',
            margin: '0 auto 0.75rem',
          }}>
            {otherUser?.profilePhoto ? (
              <img src={otherUser.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }} />
            ) : getInitials(otherUser?.name)}
          </div>
          <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: '#1a1512', marginBottom: '0.25rem' }}>{otherUser?.name || 'Unknown'}</div>
          <div style={{ fontSize: '0.75rem', color: '#8a8179', background: '#f8f5f2', display: 'inline-block', padding: '0.1875rem 0.625rem', borderRadius: '1.25rem' }}>
            {otherUser?.taskType || 'User'}
          </div>
        </div>

        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e8e3df' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#b0a99f', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.625rem' }}>Contact</div>
          {otherUser?.email && <div style={{ fontSize: '0.84375rem', color: '#1a1512', marginBottom: '0.5rem' }}><span style={{ color: '#8a8179', fontSize: '0.75rem' }}>Email · </span>{otherUser.email}</div>}
          {otherUser?.phone && <div style={{ fontSize: '0.84375rem', color: '#1a1512', marginBottom: '0.5rem' }}><span style={{ color: '#8a8179', fontSize: '0.75rem' }}>Phone · </span>{otherUser.phone}</div>}
          {otherUser?.address && <div style={{ fontSize: '0.84375rem', color: '#1a1512' }}><span style={{ color: '#8a8179', fontSize: '0.75rem' }}>Location · </span>{otherUser.address}</div>}
          {!otherUser?.email && !otherUser?.phone && !otherUser?.address && (
            <div style={{ fontSize: '0.8125rem', color: '#b0a99f' }}>No contact details available</div>
          )}
        </div>

        <div style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#b0a99f', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.625rem' }}>
            Shared Bookings ({sharedTasks?.length || 0})
          </div>
          {(sharedTasks || []).length === 0 ? (
            <div style={{ fontSize: '0.8125rem', color: '#b0a99f' }}>No shared bookings</div>
          ) : (
            sharedTasks.map((task, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.625rem 0', borderBottom: i < sharedTasks.length - 1 ? '1px solid #f1f0ee' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: '0.84375rem', fontWeight: 600, color: '#1a1512' }}>{task.taskName || task.title || 'Task'}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#b0a99f', marginTop: '0.125rem' }}>#{(task._id || task.id || '').slice(-6).toUpperCase()}</div>
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
  const [recording, setRecording] = useState(false);
  const [duration, setDuration]   = useState(0);
  const mediaRecorderRef          = useRef(null);
  const chunksRef                 = useRef([]);
  const timerRef                  = useRef(null);

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
          const payload = JSON.stringify({ type: 'media', mediaUrl: base64, mediaType: 'audio/webm', fileName: `voice_${Date.now()}.webm` });
          const newMsg = {
            sender_id: actualUserId, message: payload,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: new Date().toDateString(),
          };
          setMessages(prev => [...prev, newMsg]);
          setConversations(prev => prev.map(c =>
            (c.otherUser === (otherUser?.id) || c.otherUser === otherId)
              ? { ...c, lastMessage: payload, lastMessageTime: Date.now() / 1000 } : c
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
      <div style={{ borderRadius: '0.75rem', overflow: 'hidden', maxWidth: '100%', cursor: 'pointer' }} onClick={() => window.open(mediaUrl, '_blank')}>
        <img src={mediaUrl} alt={fileName || 'image'} style={{ width: '100%', display: 'block', maxHeight: '17.5rem', objectFit: 'cover' }} />
      </div>
    );
  }
  if (isVideo) {
    return (
      <div style={{ borderRadius: '0.75rem', overflow: 'hidden', maxWidth: '100%', background: '#000' }}>
        <video controls style={{ width: '100%', maxHeight: '17.5rem', display: 'block' }}>
          <source src={mediaUrl} type={mediaType} />
        </video>
      </div>
    );
  }
  if (isAudio) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.875rem', background: '#f1f5f9', borderRadius: '0.75rem', maxWidth: '100%' }}>
        <Mic size={16} style={{ color: '#f6ad56', flexShrink: 0 }} />
        <audio controls style={{ height: '2rem', flex: 1, minWidth: 0 }}>
          <source src={mediaUrl} type={mediaType} />
        </audio>
      </div>
    );
  }
  return (
    <a href={mediaUrl} target="_blank" rel="noopener noreferrer" style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5625rem 0.8125rem',
      background: '#f1f5f9', borderRadius: '0.625rem', textDecoration: 'none',
      color: '#1a1512', fontSize: '0.8125rem', fontWeight: 600,
    }}>
      <File size={17} style={{ color: '#8a8179', flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{fileName || 'File'}</span>
    </a>
  );
};

// ── Offer Card ────────────────────────────────────────────────────────────────
const OfferCard = ({ offer, isMyMessage, isWorker, onAccept, onReject }) => {
  const isPending   = offer.status === 'pending';
  const isAccepted  = offer.status === 'accepted';
  const isRejected  = offer.status === 'rejected';
  const isStatusMsg = offer.type === 'offer_accepted' || offer.type === 'offer_rejected';
  const cardClass   = isStatusMsg
    ? `mp-offer-card ${offer.type === 'offer_accepted' ? 'accepted' : 'rejected'}`
    : 'mp-offer-card pending';

  return (
    <div className={cardClass}>
      <div style={{ marginBottom: '0.625rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <div style={{ fontSize: '0.84375rem', fontWeight: 700, color: '#1a1512' }}>{offer.taskName || 'Task'}</div>
        <div style={{ fontSize: '0.6875rem', color: '#8a8179', marginTop: '0.125rem' }}>
          Booking #{offer.taskId ? offer.taskId.slice(-6).toUpperCase() : 'N/A'}
        </div>
      </div>
      <div style={{
        fontSize: '0.6875rem', fontWeight: 700, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em',
        color: isStatusMsg ? (offer.type === 'offer_accepted' ? '#059669' : '#dc2626') : '#f6ad56',
      }}>
        {isStatusMsg ? (offer.type === 'offer_accepted' ? 'Offer Accepted' : 'Offer Rejected') : 'Service Offer'}
      </div>

      <div className="mp-offer-row">
        <span className="mp-offer-label">Estimated Hours</span>
        <span className="mp-offer-value">{offer.hours} hrs</span>
      </div>
      <div className="mp-offer-row">
        <span className="mp-offer-label">Additional charges</span>
        <span className="mp-offer-value">Rs. {Number(offer.additionalCost || 0).toLocaleString()}</span>
      </div>
      {offer.platformFee != null && (
        <div className="mp-offer-row">
          <span className="mp-offer-label">Platform fee (5%)</span>
          <span className="mp-offer-value" style={{ color: '#f6ad56' }}>Rs. {Number(offer.platformFee).toLocaleString()}</span>
        </div>
      )}
      {offer.totalCost && (
        <div className="mp-offer-total">
          <span className="mp-offer-label" style={{ fontWeight: 700 }}>Total</span>
          <span className="mp-offer-value" style={{ color: '#059669' }}>Rs. {Number(offer.totalCost).toLocaleString()}</span>
        </div>
      )}

      {isAccepted && !isStatusMsg && (
        <div style={{ background: '#d1fae5', color: '#059669', padding: '0.4375rem', borderRadius: '0.5rem', textAlign: 'center', fontWeight: 600, fontSize: '0.8125rem', marginTop: '0.625rem' }}>
          Offer Accepted
        </div>
      )}
      {isRejected && !isStatusMsg && (
        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '0.4375rem', borderRadius: '0.5rem', textAlign: 'center', fontWeight: 600, fontSize: '0.8125rem', marginTop: '0.625rem' }}>
          Offer Rejected
        </div>
      )}
      {isStatusMsg && (
        <div style={{ marginTop: '0.625rem', fontSize: '0.78125rem', fontWeight: 600, textAlign: 'center', color: offer.type === 'offer_accepted' ? '#059669' : '#dc2626' }}>
          {offer.type === 'offer_accepted' ? 'The worker will arrive on the scheduled date.' : 'You can negotiate a new offer.'}
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
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    if (!ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    setPos({ x: Math.min(x, window.innerWidth - width - 8), y: Math.min(y, window.innerHeight - height - 8) });
  }, [x, y]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'fixed', top: pos.y, left: pos.x,
      background: '#fff', border: '1px solid #e8e3df', borderRadius: '0.625rem',
      boxShadow: '0 0.375rem 1.5rem rgba(0,0,0,0.12)', zIndex: 500, minWidth: '9.375rem', overflow: 'hidden',
    }}>
      <button
        onClick={() => { onCopy(message); onClose(); }}
        style={{ display: 'flex', alignItems: 'center', gap: '0.5625rem', width: '100%', padding: '0.625rem 0.875rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.84375rem', fontWeight: 500, color: '#1a1512' }}
        onMouseEnter={e => e.currentTarget.style.background = '#f8f5f2'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <Copy size={14} style={{ color: '#8a8179' }} /> Copy
      </button>
      {isMyMessage && (
        <button
          onClick={() => { onDelete(); onClose(); }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5625rem', width: '100%', padding: '0.625rem 0.875rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.84375rem', fontWeight: 500, color: '#dc2626' }}
          onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <Trash2 size={14} style={{ color: '#dc2626' }} /> Delete
        </button>
      )}
    </div>
  );
};

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = ({ message, onDone, duration = 5000 }) => {
  useEffect(() => { const t = setTimeout(onDone, duration); return () => clearTimeout(t); }, [onDone, duration]);
  return (
    <div style={{
      position: 'fixed', bottom: '5.625rem', left: '50%', transform: 'translateX(-50%)',
      background: '#1a1512', color: '#fff', padding: '0.625rem 1.25rem', borderRadius: '1.5rem',
      fontSize: '0.84375rem', fontWeight: 600, boxShadow: '0 0.25rem 1rem rgba(0,0,0,0.18)',
      zIndex: 600, whiteSpace: 'nowrap', pointerEvents: 'none',
      animation: 'mp-toast-in 0.2s ease', maxWidth: 'calc(100vw - 2rem)', textAlign: 'center',
    }}>
      {message.text}
    </div>
  );
};

const resolveConvoName = (c) =>
  c.name || c.other_user_name || c.participant_name || c.display_name || c.fullName || c.full_name || c.username || null;

const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
};

const getSkillPrice = (skills, taskType) => {
  if (!Array.isArray(skills) || !taskType) return 0;
  const match = skills.find(s =>
    s?.name?.toLowerCase().trim() === taskType.toLowerCase().trim()
  );
  return Number(match?.price || 0);
};

// ── Main Component ────────────────────────────────────────────────────────────
const MessagesPage = () => {
  const { senderId, recieverId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const storedUser  = localStorage.getItem('user') || sessionStorage.getItem('user');
  const currentUser = storedUser ? JSON.parse(storedUser) : null;
  const actualUserId = currentUser?.id || currentUser?._id || currentUser?.userId || null;
  const isWorker     = currentUser?.role === 'worker' || currentUser?.type === 'worker';
  const otherId      = recieverId;

  const [otherUser,          setOtherUser]         = useState(null);
  const [messages,           setMessages]          = useState([]);
  const [conversations,      setConversations]     = useState([]);
  const [sharedTasks,        setSharedTasks]       = useState([]);
  const [messageInput,       setMessageInput]      = useState('');
  const [searchQuery,        setSearchQuery]       = useState('');
  const [loading,            setLoading]           = useState(true);
  const [error,              setError]             = useState(null);
  const [showSidebar,        setShowSidebar]       = useState(!isMobile || !otherId);
  const [showOfferModal,     setShowOfferModal]    = useState(false);
  const [offerData,          setOfferData]         = useState({ hours: '', additionalCost: '' });
  const [offerErrors,        setOfferErrors]       = useState({ hours: '', additionalCost: '' });
  const [selectedOfferTask,  setSelectedOfferTask] = useState(null);
  const [myBasePrice,        setMyBasePrice]       = useState(null);
  const [activeTab,          setActiveTab]         = useState('chat');
  const [sidebarWidth,       setSidebarWidth]      = useState(22); // now in %
  const [convosLoading,      setConvosLoading]     = useState(true);
  const [mediaPreview,       setMediaPreview]      = useState(null);
  const [uploading,          setUploading]         = useState(false);
  const [showMoreMenu,       setShowMoreMenu]      = useState(false);
  const [showInfoPanel,      setShowInfoPanel]     = useState(false);
  const [toastMsg,           setToastMsg]          = useState(null);
  const [contextMenu,        setContextMenu]       = useState(null);

  const messagesEndRef      = useRef(null);
  const handleNewMessageRef = useRef(null);
  const sidebarRef          = useRef(null);
  const isResizing          = useRef(false);
  const imageInputRef       = useRef(null);
  const fileInputRef        = useRef(null);
  const inputBarRef         = useRef(null);
  const longPressTimer      = useRef(null);
  const { addToast }        = useToast();

  const otherUserRef = useRef(null);
  useEffect(() => { otherUserRef.current = otherUser; }, [otherUser]);

  useEffect(() => {
    if (isMobile) setShowSidebar(!otherId);
    else setShowSidebar(true);
  }, [isMobile, otherId]);

  const { recording, duration, startRecording, stopRecording } = useVoiceRecorder({
    actualUserId, otherUser, setMessages, setConversations, otherId,
  });

  const showToast = (text) => setToastMsg({ text, id: Date.now() });

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }, []);

  const startResizing = (e) => {
    if (isMobile) return;
    e.preventDefault();
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
  };
  const handleMouseMove = (e) => {
    if (!isResizing.current) return;
    // Convert pixel position to percentage of viewport
    const pct = (e.clientX / window.innerWidth) * 100;
    if (pct >= 14 && pct <= 38) setSidebarWidth(pct);
  };
  const stopResizing = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
  };

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
        return p.mediaType?.startsWith('image/') ? '📷 Photo'
             : p.mediaType?.startsWith('video/') ? '🎥 Video'
             : p.mediaType?.startsWith('audio/') ? '🎤 Voice message' : '📎 File';
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

  handleNewMessageRef.current = (msg) => {
    if (actualUserId && msg.sender_id === actualUserId) return;
    if (!msg || typeof msg !== 'object') return;

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
        ? { ...c, lastMessage: msg.message || '', lastMessageTime: Date.now() / 1000 } : c
    ));

    const senderName = otherUserRef.current?.name?.split(' ')[0] || msg.senderName || 'New message';
    let preview = msg.message || '';
    try {
      const p = JSON.parse(preview);
      if (p.type === 'media') preview = p.mediaType?.startsWith('image/') ? '📷 Photo' : p.mediaType?.startsWith('audio/') ? '🎤 Voice message' : '📎 File';
      else if (p.type === 'offer') preview = '📋 Sent a service offer';
      else if (p.type === 'offer_accepted') preview = '✅ Accepted your offer';
      else if (p.type === 'offer_rejected') preview = '❌ Rejected your offer';
    } catch {}


    if (document.hidden && Notification.permission === 'granted') {
      new Notification(`${senderName} sent you a message`, {
        body: preview.length > 90 ? preview.slice(0, 90) + '…' : preview,
        icon: '/icon-192.png', badge: '/icon-192.png', tag: msg.sender_id, renotify: true,
      });
    }
  };

  useEffect(() => { setActiveTab('chat'); }, [senderId, recieverId]);

  useEffect(() => {
    if (!actualUserId) return;
    setConvosLoading(true);
    fetchConversations(actualUserId)
      .then(async (convos) => {
        const mapped = (convos || []).map(c => ({
          id:              c.room_id || c.id,
          otherUser:       c.other_user,
          name:            resolveConvoName(c),
          lastMessage:     c.last_message || c.lastMessage || '',
          lastMessageTime: c.last_time || c.lastMessageTime || '',
          unreadCount:     c.unreadCount || 0,
          profilePhoto:    c.profilePhoto || c.profile_image || null,
        }));
        const enriched = await Promise.all(
          mapped.map(async (c) => {
            if (c.name && !c.name.includes('@') && c.name.length < 30) return c;
            try {
              try {
                const res = await fetchCustomerById(c.otherUser);
                const d = Array.isArray(res) ? res[0] : res;
                if (d && (d._id || d.id)) {
                  const name = `${d.first_name || ''} ${d.last_name || ''}`.trim();
                  if (name) return { ...c, name, profilePhoto: c.profilePhoto || d.profilePhoto || null };
                }
              } catch {}
              const res = await fetchWorkerById(c.otherUser);
              const d = Array.isArray(res) ? res[0] : res;
              if (d) {
                const name = `${d.firstName || ''} ${d.lastName || ''}`.trim() || d.email || c.name;
                return { ...c, name, profilePhoto: c.profilePhoto || d.profilePhoto || null };
              }
            } catch {}
            return c;
          })
        );
        setConversations(enriched);
      })
      .catch(() => setConversations([]))
      .finally(() => setConvosLoading(false));
  }, [actualUserId]);

  useEffect(() => {
    if (!otherUser?.id || !otherUser?.name) return;
    setConversations(prev => prev.map(c => {
      const parts = (c.id || '').split('__');
      const otherInRoom = parts.find(p => p !== actualUserId) || '';
      if (otherInRoom !== otherUser.id && c.otherUser !== otherUser.id) return c;
      const looksLikeId = !c.name || c.name === c.otherUser || c.name === otherInRoom;
      return looksLikeId ? { ...c, name: otherUser.name, profilePhoto: c.profilePhoto || otherUser.profilePhoto } : c;
    }));
  }, [otherUser, actualUserId]);

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
          setMyBasePrice(me?.skills || []);
        }
        setLoading(false);
      } catch (err) { setError(err.message || 'Failed to load user'); setLoading(false); }
    };
    init();
  }, [otherId, isWorker, actualUserId]);

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

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMediaPreview({ file, url: URL.createObjectURL(file), type: file.type, name: file.name });
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
      const payload = JSON.stringify({ type: 'media', mediaUrl: base64, mediaType: mediaPreview.type, fileName: mediaPreview.name });
      const newMsg = {
        sender_id: actualUserId, message: payload,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toDateString(),
      };
      setMessages(prev => [...prev, newMsg]);
      setConversations(prev => prev.map(c =>
        (c.otherUser === otherUser.id || c.otherUser === otherId)
          ? { ...c, lastMessage: payload, lastMessageTime: Date.now() / 1000 } : c
      ));
      sendMessageWS(actualUserId, otherUser.id, payload);
      cancelMediaPreview();
    } catch (err) {
      console.error('Media send failed:', err);
      alert('Failed to send media. Please try again.');
    } finally { setUploading(false); }
  };

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

  const closeOfferModal = () => {
    setShowOfferModal(false);
    setOfferData({ hours: '', additionalCost: '' });
    setOfferErrors({ hours: '', additionalCost: '' });
    setSelectedOfferTask(null);
  };

  const sendOffer = () => {
    if (!selectedOfferTask) return alert('Please select a task first.');

    const hours          = Number(offerData.hours);
    const additionalCost = Number(offerData.additionalCost || 0);

    if (!offerData.hours || isNaN(hours) || hours <= 0) {
      setOfferErrors(p => ({ ...p, hours: 'Cannot be negative or zero' }));
      return;
    }
    if (offerData.additionalCost && (isNaN(additionalCost) || additionalCost < 0)) {
      setOfferErrors(p => ({ ...p, additionalCost: 'Cannot be negative' }));
      return;
    }
    
    const taskStatus = (selectedOfferTask.status || '').toLowerCase();
    if (taskStatus === 'in_progress') { alert('Cannot send an offer — this task is already in progress.'); return; }
    if (!['pending', 'confirmed'].includes(taskStatus)) { alert('Offers can only be sent for Pending or Confirmed tasks.'); return; }
    const taskId = selectedOfferTask._id || selectedOfferTask.id;
    if (hasPendingOfferForTask(taskId)) { alert('This task already has a pending offer. Wait for the customer to respond first.'); return; }

    const basePrice = getSkillPrice(myBasePrice, selectedOfferTask?.taskType || selectedOfferTask?.taskName);
    const subtotal  = basePrice ? (hours * basePrice) + additionalCost : additionalCost;
    const platformFee = Math.round(subtotal * 0.05 * 100) / 100;
    const totalCost   = Math.round((subtotal + platformFee) * 100) / 100;

    const payload = JSON.stringify({
      type:           'offer',
      hours:          offerData.hours,
      status:         'pending',
      taskId,
      taskName:       selectedOfferTask.taskName || selectedOfferTask.title || 'Task',
      additionalCost: additionalCost,
      subtotal:       subtotal,
      platformFee:    platformFee,
      totalCost:      totalCost,
    });

    setMessages(prev => [...prev, {
      sender_id: actualUserId, message: payload,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toDateString(),
    }]);
    sendMessageWS(actualUserId, otherUser.id, payload);
    setConversations(prev => prev.map(c =>
      (c.otherUser === otherUser.id || c.otherUser === otherId)
        ? { ...c, lastMessage: payload, lastMessageTime: Date.now() / 1000 } : c
    ));
    closeOfferModal();
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
        offerStatus:    'accepted',
      });
    }
    const confirmPayload = JSON.stringify({
      type:           status === 'accepted' ? 'offer_accepted' : 'offer_rejected',
      hours:          parsedOffer.hours,
      additionalCost: parsedOffer.additionalCost,
      platformFee:    parsedOffer.platformFee,
      totalCost:      parsedOffer.totalCost,
      taskId:         parsedOffer.taskId,
      taskName:       parsedOffer.taskName,
      status,
    });
    setMessages(prev => [...prev, {
      sender_id: actualUserId, message: confirmPayload,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toDateString(),
    }]);
    sendMessageWS(actualUserId, otherUser.id, confirmPayload);
    setConversations(prev => prev.map(c =>
      (c.otherUser === otherUser.id || c.otherUser === otherId)
        ? { ...c, lastMessage: confirmPayload, lastMessageTime: Date.now() / 1000 } : c
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
        ? { ...c, lastMessage: newMsg.message, lastMessageTime: Date.now() / 1000 } : c
    ));
    try { sendMessageWS(actualUserId, otherUser.id, messageInput); } catch (err) { console.error(err); }
    setMessageInput('');
  };

  const handleReportUser = () => {
    if (window.confirm(`Report ${otherUser?.name} for inappropriate behaviour?`)) showToast('User reported. Thank you.');
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

  const handleTouchStart = (e, index) => {
    longPressTimer.current = setTimeout(() => {
      const touch = e.touches[0];
      setContextMenu({ x: touch.clientX, y: touch.clientY, msgIndex: index });
    }, 500);
  };
  const handleTouchEnd = () => clearTimeout(longPressTimer.current);

  const handleMobileBack = () => {
    if (isMobile) navigate(`/chat/${actualUserId}`);
    else navigate(-1);
  };

  const filteredConversations = conversations.filter(c =>
    (c.name || c.otherUser || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const SidebarJSX = (
    <>
      {isMobile && showSidebar && otherId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 198 }} onClick={() => setShowSidebar(false)} />
      )}
      <div
        ref={sidebarRef}
        className="mp-sidebar"
        style={{
          width: isMobile ? '100%' : `${sidebarWidth}%`,
          minWidth: isMobile ? 'auto' : '13rem',
          maxWidth: isMobile ? '100%' : '31.25rem',
          ...(isMobile && otherId ? {
            position: 'fixed', left: showSidebar ? 0 : '-100%', top: 0, bottom: 0,
            zIndex: 199, transition: 'left 0.25s ease', width: '85vw', maxWidth: '21.25rem',
          } : {}),
        }}
      >
        <div className="mp-sidebar-header">
          <h2 className="mp-sidebar-title">Messages</h2>
          {otherId && <button className="mp-icon-btn" onClick={() => setShowSidebar(false)}><X size={18} /></button>}
        </div>
        <div className="mp-search-wrap">
          <Search size={14} className="mp-search-icon" />
          <input type="text" placeholder="Search conversations…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="mp-search-input" />
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
              const displayName  = isActive && otherUser?.name ? otherUser.name : convo.name || otherInRoom;
              const displayImage = isActive && otherUser?.profilePhoto ? otherUser.profilePhoto : convo.profilePhoto;
              return (
                <div
                  key={i}
                  className={`mp-convo-item${isActive ? ' active' : ''}`}
                  onClick={() => { navigate(`/chat/${actualUserId}/${otherInRoom}`); if (isMobile) setShowSidebar(false); }}
                >
                  <div className="mp-conv-avatar">
                    {displayImage ? (
                      <img src={displayImage} alt="" className="mp-avatar-img"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', borderRadius: '50%' }}
                      />
                    ) : <span>{getInitials(displayName)}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.125rem' }}>
                      <span className="mp-conv-name">{displayName}</span>
                      <span className="mp-conv-time">
                        {convo.lastMessageTime ? new Date(convo.lastMessageTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
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

  if (!otherId) {
    return (
      <>
        <BookingNavbar />
        <div className="mp-container">
          {SidebarJSX}
          <div className="mp-no-convo">
            <div className="mp-no-convo-icon"><MessageSquare size={32} style={{ color: '#f6ad56' }} /></div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: 'clamp(1rem, 2.5vw, 1.125rem)', fontWeight: 700, color: '#1a1512', margin: '0 0 0.375rem' }}>No conversation selected</h3>
              <p style={{ fontSize: 'clamp(0.8125rem, 1.8vw, 0.84375rem)', color: '#8a8179', margin: 0, lineHeight: 1.6 }}>Click a conversation from the list<br />or book a worker to start chatting</p>
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
        <div className="mp-center"><div className="mp-spinner" /><p style={{ color: '#8a8179', margin: 0, fontSize: '0.875rem' }}>Loading…</p></div>
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
          <h3 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>{error || 'User not found'}</h3>
          <button onClick={() => navigate(-1)} style={{ padding: '0.5625rem 1.25rem', background: '#f6ad56', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>Go Back</button>
        </div>
      </div>
      <div className="mp-chat-widget-wrapper"><ChatWidget /></div>
    </>
  );

  const activeTaskObj = activeTab !== 'chat' ? sharedTasks.find(t => (t._id || t.id) === activeTab) : null;

  // ── Live offer preview calculation ────────────────────────────────────────
  const liveHrs         = Number(offerData.hours || 0);
  const liveAddl        = Number(offerData.additionalCost || 0);
  const basePrice       = getSkillPrice(myBasePrice, selectedOfferTask?.taskType || selectedOfferTask?.taskName);
  const liveSubtotal    = basePrice ? (liveHrs * basePrice) + liveAddl : liveAddl;
  const livePlatformFee = Math.round(liveSubtotal * 0.05 * 100) / 100;
  const liveTotal       = Math.round((liveSubtotal + livePlatformFee) * 100) / 100;
  const showLiveCalc    = liveHrs > 0 && basePrice > 0;

  return (
    <>
      <BookingNavbar />
      <div className="mp-container">
        <input ref={imageInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFileSelect} />
        <input ref={fileInputRef}  type="file" accept="*/*"             style={{ display: 'none' }} onChange={handleFileSelect} />

        {SidebarJSX}

        <div className="mp-chat-pane" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

          {/* ── Header ── */}
          <div className="mp-header" style={{ position: 'relative' }}>
            <div className="mp-header-left">
              <button className="mp-icon-btn" onClick={() => { if (isMobile) setShowSidebar(true); else setShowSidebar(prev => !prev); }}>
                <Menu size={18} />
              </button>
              <button className="mp-icon-btn" onClick={handleMobileBack}><ArrowLeft size={18} /></button>
              <div className="mp-header-avatar" style={{ position: 'relative', overflow: 'hidden', borderRadius: '50%' }}>
                {otherUser.profilePhoto ? (
                  <img src={otherUser.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block', borderRadius: '50%' }} />
                ) : <span>{getInitials(otherUser.name)}</span>}
                <span className="mp-status-dot" style={{ backgroundColor: otherUser.status === 'online' ? '#10b981' : '#b0a99f' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 className="mp-header-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{otherUser.name}</h3>
                <p className="mp-header-role">{otherUser.taskType}</p>
              </div>
            </div>
            <div className="mp-header-right">
              <button className="mp-icon-btn" title="Contact info" onClick={() => setShowInfoPanel(prev => !prev)} style={{ color: showInfoPanel ? '#f6ad56' : undefined }}>
                <Info size={17} />
              </button>
              <button className="mp-icon-btn" title="More options" onClick={() => setShowMoreMenu(prev => !prev)}>
                <MoreVertical size={17} />
              </button>
              {showMoreMenu && <MoreMenu onClose={() => setShowMoreMenu(false)} onReportUser={handleReportUser} />}
            </div>
          </div>

          {/* ── Tab Bar ── */}
          <div className="mp-tab-bar" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <button className={`mp-tab${activeTab === 'chat' ? ' active' : ''}`} onClick={() => setActiveTab('chat')}>
              <MessageSquare size={12} /> Chat
            </button>
            {sharedTasks.map((task, i) => {
              const taskId = task._id || task.id;
              return (
                <button key={taskId} className={`mp-tab${activeTab === taskId ? ' active' : ''}`} onClick={() => setActiveTab(taskId)} style={{ whiteSpace: 'nowrap' }}>
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
                    <div style={{ fontSize: '2.75rem', opacity: 0.2, marginBottom: '0.5rem' }}>💬</div>
                    <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#1a1512', margin: '0 0 0.3125rem' }}>Start the conversation</h3>
                    <p style={{ fontSize: '0.84375rem', color: '#8a8179', margin: 0 }}>Send a message to {otherUser.name.split(' ')[0]}</p>
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
                              <div className="mp-date-divider"><span className="mp-date-chip">{msg.date || 'Today'}</span></div>
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
                                  {otherUser.profilePhoto ? (
                                    <img src={otherUser.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', borderRadius: '50%', display: 'block' }} />
                                  ) : <span>{getInitials(otherUser.name)}</span>}
                                </div>
                              )}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1875rem', minWidth: 0, maxWidth: '100%' }}>
                                {!isMyMessage && <span className="mp-msg-sender">{otherUser.name}</span>}
                                {parsedOffer ? (
                                  <OfferCard
                                    offer={parsedOffer} isMyMessage={isMyMessage} isWorker={isWorker}
                                    onAccept={() => handleOfferResponse(index, 'accepted')}
                                    onReject={() => handleOfferResponse(index, 'rejected')}
                                  />
                                ) : parsedMedia ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <MediaMessage mediaUrl={parsedMedia.mediaUrl} mediaType={parsedMedia.mediaType} fileName={parsedMedia.fileName} />
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.1875rem', paddingRight: '0.125rem' }}>
                                      <span style={{ fontSize: '0.625rem', color: '#b0a99f' }}>{msg.time || ''}</span>
                                      {isMyMessage && <CheckCheck size={12} style={{ opacity: 0.65, color: '#b0a99f' }} />}
                                    </div>
                                  </div>
                                ) : (
                                  <div className={`mp-bubble ${isMyMessage ? 'mp-bubble-mine' : 'mp-bubble-theirs'}`}>
                                    <span className="mp-bubble-text">{msg.message || ''}</span>
                                    <div className="mp-bubble-meta">
                                      <span className="mp-bubble-time">{msg.time || ''}</span>
                                      {isMyMessage && <CheckCheck size={12} style={{ marginLeft: '0.125rem', opacity: 0.7 }} />}
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

              {mediaPreview && (
                <div className="mp-media-preview">
                  <div className="mp-media-thumb">
                    {mediaPreview.type?.startsWith('image/') ? (
                      <img src={mediaPreview.url} alt="preview" style={{ width: '3.5rem', height: '3.5rem', objectFit: 'cover', borderRadius: '0.5rem', border: '2px solid #f6ad56' }} />
                    ) : (
                      <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '0.5rem', border: '2px solid #f6ad56', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {mediaPreview.type?.startsWith('video/') ? <Play size={18} style={{ color: '#8a8179' }} /> : <File size={18} style={{ color: '#8a8179' }} />}
                      </div>
                    )}
                    <button className="mp-media-cancel" onClick={cancelMediaPreview}>✕</button>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1a1512', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mediaPreview.name}</div>
                    <div style={{ fontSize: '0.6875rem', color: '#b0a99f', marginTop: '0.125rem' }}>
                      {mediaPreview.type?.startsWith('image/') ? 'Image' : mediaPreview.type?.startsWith('video/') ? 'Video' : 'File'}
                      {' · '}{(mediaPreview.file.size / 1024 / 1024).toFixed(1)} MB
                    </div>
                  </div>
                  <button onClick={sendMedia} disabled={uploading} style={{ padding: '0.4375rem 1rem', background: '#f6ad56', color: 'white', border: 'none', borderRadius: '0.5625rem', fontWeight: 700, fontSize: '0.8125rem', cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1, flexShrink: 0 }}>
                    {uploading ? 'Sending…' : 'Send'}
                  </button>
                </div>
              )}

              {recording && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 1rem', background: '#fef3e2', borderTop: '1px solid #fde68a', fontSize: '0.84375rem', fontWeight: 600, color: '#92400e', flexWrap: 'wrap' }}>
                  <span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1s infinite', flexShrink: 0 }} />
                  Recording… {Math.floor(duration / 60).toString().padStart(2,'0')}:{(duration % 60).toString().padStart(2,'0')}
                  <button onClick={stopRecording} style={{ marginLeft: 'auto', padding: '0.3125rem 0.875rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.78125rem' }}>
                    <StopCircle size={13} /> Stop & Send
                  </button>
                </div>
              )}

              <div className="mp-input-bar" ref={inputBarRef} style={{ position: 'relative' }}>
                <button className="mp-icon-btn" onClick={() => fileInputRef.current?.click()} title="Attach file"><Paperclip size={17} /></button>
                <button className="mp-icon-btn" onClick={() => imageInputRef.current?.click()} title="Send image/video"><Image size={17} /></button>
                {isWorker && <button className="mp-offer-btn" onClick={openOfferModal}>{isMobile ? 'Offer' : 'Send Offer'}</button>}
                <input
                  type="text" className="mp-text-input"
                  placeholder={`Message ${otherUser.name.split(' ')[0]}…`}
                  value={messageInput} onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                  style={{ fontSize: '1rem' }}
                />
                <button className="mp-icon-btn" title={recording ? 'Stop recording' : 'Record voice message'} onClick={recording ? stopRecording : startRecording} style={{ color: recording ? '#ef4444' : undefined }}>
                  {recording ? <StopCircle size={17} /> : <Mic size={17} />}
                </button>
                <button className="mp-send-btn" onClick={handleSendMessage} disabled={!messageInput.trim()} style={{ opacity: messageInput.trim() ? 1 : 0.45 }}>
                  <Send size={16} />
                </button>
              </div>
            </>
          )}

          {activeTab !== 'chat' && activeTaskObj && (
            <div className="mp-task-pane">
              <div className="mp-task-pane-header">
                <ClipboardList size={15} style={{ color: '#f6ad56' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1a1512', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {activeTaskObj.taskName || 'Task Details'}
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: '#b0a99f' }}>#{activeTab.slice(-6).toUpperCase()}</span>
                </div>
                <StatusBadge status={activeTaskObj.status} />
              </div>
              <div style={{ padding: isMobile ? '0.75rem' : '1.25rem' }}><TaskDetails taskId={activeTab} /></div>
            </div>
          )}
        </div>

        {showInfoPanel && <InfoPanel otherUser={otherUser} sharedTasks={sharedTasks} onClose={() => setShowInfoPanel(false)} isMobile={isMobile} />}

        {contextMenu && (
          <MessageContextMenu
            x={contextMenu.x} y={contextMenu.y}
            message={messages[contextMenu.msgIndex]}
            isMyMessage={messages[contextMenu.msgIndex]?.sender_id === actualUserId || messages[contextMenu.msgIndex]?.sender === actualUserId}
            onCopy={(msg) => handleCopyMessage(msg)}
            onDelete={() => handleDeleteMessage(contextMenu.msgIndex)}
            onClose={() => setContextMenu(null)}
          />
        )}

        {/* ── Offer Modal ── */}
        {showOfferModal && (
          <div className="mp-modal-overlay">
            <div className="mp-modal" style={{ width: isMobile ? '92vw' : 'clamp(20rem, 35vw, 30rem)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.4rem' }}>
                <h3 className="mp-modal-title">Send a Service Offer</h3>
                <button className="mp-modal-close" onClick={closeOfferModal}>✕</button>
              </div>

              <label className="mp-label">Select Booking</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4375rem', marginBottom: '1.1rem' }}>
                {offerEligibleTasks.map(task => {
                  const taskId     = task._id || task.id;
                  const isSelected = (selectedOfferTask?._id || selectedOfferTask?.id) === taskId;
                  const hasPending = hasPendingOfferForTask(taskId);
                  return (
                    <button key={taskId} disabled={hasPending} onClick={() => !hasPending && setSelectedOfferTask(task)} className={`mp-task-select-btn${isSelected ? ' selected' : ''}`}>
                      <div>
                        <div style={{ fontSize: '0.84375rem', fontWeight: 600, color: '#1a1512' }}>{task.taskName || task.title || 'Unnamed Task'}</div>
                        <div style={{ fontSize: '0.6875rem', color: '#b0a99f', marginTop: '0.125rem' }}>
                          #{taskId.slice(-6).toUpperCase()}
                          {hasPending && <span style={{ color: '#f6ad56', marginLeft: '0.375rem' }}>· Offer pending</span>}
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
                placeholder="e.g. 3"
                value={offerData.hours}
                onChange={e => {
                  const val = e.target.value;
                  setOfferErrors(p => ({ ...p, hours: val !== '' && Number(val) <= 0 ? 'Cannot be negative or zero' : '' }));
                  setOfferData(p => ({ ...p, hours: val }));
                }}
                className="mp-modal-input"
                inputMode="numeric"
                style={{ borderColor: offerErrors.hours ? '#dc2626' : '' }}
              />
              <div style={{ minHeight: 0, marginBottom: '0.5rem' }}>
                {offerErrors.hours && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{offerErrors.hours}</span>}
              </div>

              <label className="mp-label">Additional Cost <span style={{ textTransform: 'none', opacity: 0.6 }}>(optional)</span></label>
              <input
                type="number"
                placeholder="e.g. 500"
                value={offerData.additionalCost}
                onChange={e => {
                  const val = e.target.value;
                  setOfferErrors(p => ({ ...p, additionalCost: val !== '' && Number(val) < 0 ? 'Cannot be negative' : '' }));
                  setOfferData(p => ({ ...p, additionalCost: val }));
                }}
                className="mp-modal-input"
                inputMode="numeric"
                style={{ borderColor: offerErrors.additionalCost ? '#dc2626' : '' }}
              />
              <div style={{ minHeight: 0, marginBottom: '0.5rem' }}>
                {offerErrors.additionalCost && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{offerErrors.additionalCost}</span>}
              </div>

              {/* ── Live price breakdown with platform fee ── */}
              {showLiveCalc && (
                <div style={{ background: '#f8f5f2', borderRadius: '0.625rem', padding: '0.75rem 0.875rem', marginBottom: '0.875rem', fontSize: '0.8125rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3125rem', color: '#57534e' }}>
                    <span>Base cost ({liveHrs}hrs × Rs.{basePrice})</span>
<span>Rs. {(liveHrs * basePrice).toLocaleString()}</span>
                  </div>
                  {liveAddl > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3125rem', color: '#57534e' }}>
                      <span>Additional charges</span>
                      <span>Rs. {liveAddl.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3125rem', color: '#f6ad56', fontWeight: 600 }}>
                    <span>Platform fee (5%)</span>
                    <span>Rs. {livePlatformFee.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e8e3df', paddingTop: '0.5rem', marginTop: '0.25rem', fontWeight: 700, color: '#059669', fontSize: '0.875rem' }}>
                    <span>Total</span>
                    <span>Rs. {liveTotal.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.625rem', marginTop: '0.75rem' }}>
                <button className="mp-cancel-btn" onClick={closeOfferModal}>Cancel</button>
                <button className="mp-confirm-btn" onClick={sendOffer} disabled={!selectedOfferTask}>Send Offer</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {toastMsg && <Toast key={toastMsg.id} message={toastMsg} onDone={() => setToastMsg(null)} />}

      <div className="mp-chat-widget-wrapper"><ChatWidget /></div>

      <style>{`
        @keyframes mp-toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(0.5rem); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        .mp-tab-bar { scrollbar-width: none; -ms-overflow-style: none; }
        .mp-tab-bar::-webkit-scrollbar { display: none; }
        .mp-header-avatar, .mp-msg-avatar, .mp-conv-avatar { overflow: hidden !important; }

        @media (max-width: 768px) {
          .mp-container { position: relative; overflow: hidden; }
          .mp-chat-pane { width: 100% !important; }
          .mp-header { padding: 0.625rem 0.75rem !important; }
          .mp-header-name { font-size: clamp(0.8125rem, 3.5vw, 0.875rem) !important; max-width: 40vw; }
          .mp-bubble { max-width: 82vw !important; }
          .mp-offer-card { max-width: 85vw !important; }
          .mp-input-bar { padding: 0.5rem 0.625rem !important; gap: 0.375rem !important; }
          .mp-messages { padding-bottom: env(safe-area-inset-bottom, 0px); }
          .mp-input-bar { padding-bottom: max(0.5rem, env(safe-area-inset-bottom)) !important; }
          .mp-modal { border-radius: 1rem !important; }
          .mp-media-preview { padding: 0.5rem 0.75rem !important; }
          .mp-no-convo { width: 100% !important; }
          .mp-task-pane { padding: 0 !important; }
        }
        @media (max-width: 360px) {
          .mp-header-name { max-width: 30vw; }
          .mp-offer-btn { font-size: 0.6875rem !important; padding: 0.3125rem 0.5rem !important; }
          .mp-icon-btn { padding: 0.3125rem !important; }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          .mp-sidebar { min-width: 13.75rem !important; }
        }
      `}</style>
    </>
  );
};

export default MessagesPage;