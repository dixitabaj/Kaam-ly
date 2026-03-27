import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Info, MoreVertical, Send, Paperclip, Smile, Image, Mic,
  ArrowLeft, CheckCheck, Search, Menu, X, ClipboardList, MessageSquare,
  Play, File,
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

// ── Media Message ─────────────────────────────────────────────────────────────
const MediaMessage = ({ mediaUrl, mediaType, fileName }) => {
  const isImage = mediaType?.startsWith('image/');
  const isVideo = mediaType?.startsWith('video/');

  if (isImage) {
    return (
      <div
        style={{ borderRadius: 12, overflow: 'hidden', maxWidth: 260, cursor: 'pointer' }}
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
      <div style={{ borderRadius: 12, overflow: 'hidden', maxWidth: 260, background: '#000' }}>
        <video controls style={{ width: '100%', maxHeight: 280, display: 'block' }}>
          <source src={mediaUrl} type={mediaType} />
        </video>
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
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
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
      {/* Booking info */}
      <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1a1512' }}>
          {offer.taskName || 'Task'}
        </div>
        <div style={{ fontSize: 11, color: '#8a8179', marginTop: 2 }}>
          Booking #{offer.taskId ? offer.taskId.slice(-6).toUpperCase() : 'N/A'}
        </div>
      </div>

      {/* Type label */}
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

      {/* Rows */}
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

      {/* Status indicators */}
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

      {/* Note for accepted/rejected type msgs */}
      {isStatusMsg && (
        <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 600, textAlign: 'center',
          color: offer.type === 'offer_accepted' ? '#059669' : '#dc2626' }}>
          {offer.type === 'offer_accepted'
            ? 'The worker will arrive on the scheduled date.'
            : 'You can negotiate a new offer.'}
        </div>
      )}

      {/* Accept/Reject buttons */}
      {isPending && !isMyMessage && !isStatusMsg && !isWorker && (
  <div className="mp-offer-actions">
    <button className="mp-offer-reject" onClick={onReject}>Reject</button>
    <button className="mp-offer-accept" onClick={onAccept}>Accept</button>
  </div>
)}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const MessagesPage = () => {
  const { senderId, recieverId } = useParams();
  const navigate = useNavigate();

  const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
  const currentUser = storedUser ? JSON.parse(storedUser) : null;
  const actualUserId =
  currentUser?.id || currentUser?._id || currentUser?.userId || null;
  const isWorker =
    currentUser?.role === 'worker' || currentUser?.type === 'worker';
  const otherId = recieverId;

  const [otherUser,         setOtherUser]        = useState(null);
  const [messages,          setMessages]         = useState([]);
  const [conversations,     setConversations]    = useState([]);
  const [sharedTasks,       setSharedTasks]      = useState([]);
  const [messageInput,      setMessageInput]     = useState('');
  const [searchQuery,       setSearchQuery]      = useState('');
  const [loading,           setLoading]          = useState(true);
  const [error,             setError]            = useState(null);
  const [showSidebar,       setShowSidebar]      = useState(true);
  const [showOfferModal,    setShowOfferModal]   = useState(false);
  const [offerData,         setOfferData]        = useState({ hours: '', additionalCost: '' });
  const [selectedOfferTask, setSelectedOfferTask] = useState(null);
  const [myBasePrice,       setMyBasePrice]      = useState(null);
  const [activeTab,         setActiveTab]        = useState('chat');
  const [sidebarWidth,      setSidebarWidth]     = useState(280);
  const [convosLoading,     setConvosLoading]    = useState(true);
  const [mediaPreview,      setMediaPreview]     = useState(null);
  const [uploading,         setUploading]        = useState(false);

  const messagesEndRef      = useRef(null);
  const handleNewMessageRef = useRef(null);
  const sidebarRef          = useRef(null);
  const isResizing          = useRef(false);
  const imageInputRef       = useRef(null);
  const fileInputRef        = useRef(null);

  // ── Resize ─────────────────────────────────────────────────────────────────
  const startResizing  = (e) => {
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
        return isImage ? '📷 Photo' : isVideo ? '🎥 Video' : '📎 File';
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
    if (!msg || typeof msg !== 'object') return;
    if (msg.sender_id === actualUserId) return;
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
  };

  useEffect(() => { setActiveTab('chat'); }, [senderId, recieverId]);

  // ── Fetch conversations ────────────────────────────────────────────────────
  useEffect(() => {
    if (!actualUserId) return;
    setConvosLoading(true);
    fetchConversations(actualUserId)
      .then(convos => setConversations((convos || []).map(c => ({
        id: c.room_id || c.id, otherUser: c.other_user,
        name: c.name || c.other_user,
        lastMessage: c.last_message || c.lastMessage || '',
        lastMessageTime: c.last_time || c.lastMessageTime || '',
        unreadCount: c.unreadCount || 0,
        profileImage: c.profileImage || null,
      }))))
      .catch(() => setConversations([]))
      .finally(() => setConvosLoading(false));
  }, [actualUserId]);

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

 
  const handleFileSelect = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  setMediaPreview({
    file,
    url,
    type: file.type,
    name: file.name,
  });
  // reset input so same file can be re-selected
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

  const filteredConversations = conversations.filter(c =>
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const SidebarJSX = (
    <div ref={sidebarRef} className="mp-sidebar" style={{ width: sidebarWidth + 'px' }}>
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
            const parts = (convo.id || '').split('__');
            const otherInRoom = parts.find(p => p !== actualUserId) || '';
            return (
              <div
                key={i}
                className={`mp-convo-item${otherInRoom === otherId ? ' active' : ''}`}
                onClick={() => navigate(`/chat/${actualUserId}/${otherInRoom}`)}
              >
                <div className="mp-conv-avatar">
                  {convo.profileImage
                    ? <img src={convo.profileImage} alt="" className="mp-avatar-img" />
                    : <span>{getInitials(convo.name || convo.otherUser)}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span className="mp-conv-name">{convo.name || convo.otherUser}</span>
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

      <div
        className="mp-resize-handle"
        onMouseDown={startResizing}
      />
    </div>
  );

  // ── Empty state ────────────────────────────────────────────────────────────
  // REPLACE the empty state return with:
if (!otherId) {
  return (
    <>
      <BookingNavbar />                    {/* ← add here */}
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
      
<div className="mp-chat-widget-wrapper">
  <ChatWidget />
</div>
    </>
  );
}

// REPLACE the loading return with:
if (loading) return (
  <>
    <BookingNavbar />                      {/* ← add here */}
    <div className="mp-container">
      {SidebarJSX}
      <div className="mp-center">
        <div className="mp-spinner" />
        <p style={{ color: '#8a8179', margin: 0, fontSize: 14 }}>Loading…</p>
      </div>
    </div>
    <div className="mp-chat-widget-wrapper">
  <ChatWidget />
</div>
  </>
);

// REPLACE the error return with:
if (error || !otherUser) return (
  <>
    <BookingNavbar />                      {/* ← add here */}
    <div className="mp-container">
      {SidebarJSX}
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
   <div className="mp-chat-widget-wrapper">
  <ChatWidget />
</div>
  </>
);

  if (loading) return (
    <div className="mp-container">
      {SidebarJSX}
      <div className="mp-center">
        <div className="mp-spinner" />
        <p style={{ color: '#8a8179', margin: 0, fontSize: 14 }}>Loading…</p>
      </div>
    </div>
  );

  if (error || !otherUser) return (
    <div className="mp-container">
      {SidebarJSX}
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

        {showSidebar && SidebarJSX}

        <div className="mp-chat-pane">

          {/* ── Header ── */}
          <div className="mp-header">
            <div className="mp-header-left">
              {!showSidebar && (
                <button className="mp-icon-btn" onClick={() => setShowSidebar(true)}>
                  <Menu size={18} />
                </button>
              )}
              <button className="mp-icon-btn" onClick={() => navigate(-1)}>
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
              <div>
                <h3 className="mp-header-name">{otherUser.name}</h3>
                <p className="mp-header-role">{otherUser.taskType}</p>
              </div>
            </div>
            <div className="mp-header-right">
              <button className="mp-icon-btn"><Info size={17} /></button>
              <button className="mp-icon-btn"><MoreVertical size={17} /></button>
            </div>
          </div>

          {/* ── Tab Bar ── */}
          <div className="mp-tab-bar">
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
                            <div className={isMyMessage ? 'mp-my-msg' : 'mp-their-msg'}>
                              {!isMyMessage && (
                                <div className="mp-msg-avatar">
                                  {otherUser.profileImage
                                    ? <img src={otherUser.profileImage} alt="" className="mp-avatar-img" />
                                    : <span>{getInitials(otherUser.name)}</span>}
                                </div>
                              )}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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
                    style={{ padding: '7px 16px', background: '#f6ad56', color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}
                  >
                    {uploading ? 'Sending…' : 'Send'}
                  </button>
                </div>
              )}

              {/* Input bar */}
              <div className="mp-input-bar">
                <button className="mp-icon-btn" onClick={() => fileInputRef.current?.click()} title="Attach file">
                  <Paperclip size={17} />
                </button>
                <button className="mp-icon-btn" onClick={() => imageInputRef.current?.click()} title="Send image/video">
                  <Image size={17} />
                </button>
                {isWorker && (
                  <button className="mp-offer-btn" onClick={openOfferModal}>
                    Send Offer
                  </button>
                )}
                <input
                  type="text"
                  className="mp-text-input"
                  placeholder={`Message ${otherUser.name.split(' ')[0]}…`}
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                />
                <button className="mp-icon-btn"><Smile size={17} /></button>
                <button className="mp-icon-btn"><Mic size={17} /></button>
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
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1512' }}>
                    {activeTaskObj.taskName || 'Task Details'}
                  </span>
                  <span style={{ fontSize: 11, color: '#b0a99f', marginLeft: 8 }}>
                    #{activeTab.slice(-6).toUpperCase()}
                  </span>
                </div>
                <StatusBadge status={activeTaskObj.status} />
              </div>
              <div style={{ padding: 20 }}>
                <TaskDetails taskId={activeTab} />
              </div>
            </div>
          )}
        </div>

        {/* ── Offer Modal ── */}
        {showOfferModal && (
          <div className="mp-modal-overlay">
            <div className="mp-modal">
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
      <div className="mp-chat-widget-wrapper">
  <ChatWidget />
</div>
    </>
  );
};

export default MessagesPage;