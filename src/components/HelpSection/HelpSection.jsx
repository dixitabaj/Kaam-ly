// components/HelpSection/HelpSection.jsx

import { useState, useRef, useEffect } from "react";
import './HelpSection.css';
import { sendChatMessage } from "../../api/api";
import botImg from '../../images/AiBot.png';
import ReportModal from '../Report/ReportSection';

function getTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const QUICK_REPLIES = [
  { label: "📅 Book a worker",  text: "How do I book a worker?" },
  { label: "🔧 Services",       text: "What services are available?" },
  { label: "💰 Pricing",        text: "How much does it cost?" },
  { label: "📍 Track booking",  text: "Track my booking" },
  { label: "🚨 Report a User",  text: "__report_user__" },
  { label: "📞 Contact Support",text: "__contact_support__" },
];

const LOCAL_RESPONSES = {
  __contact_support__: {
    text: "Need help? Reach our support team directly and we'll get back to you as soon as possible.",
    buttons: [
      { label: "📧 Email us", href: "mailto:kaamly7@gmail.com" },
      { label: "📞 Call us",  href: "tel:+977-9742893770" },
    ],
  },
};

const LOCAL_LABELS = {
  __report_user__:     "Report a User",
  __contact_support__: "Contact Support",
};

const CHAT_ENDPOINTS = {
  customer: "/api/chatbot",
  worker:   "/api/worker/chatbot",
};

function getChatEndpoint() {
  try {
    const stored = localStorage.getItem("user");
    const role   = stored ? JSON.parse(stored)?.role : null;
    return CHAT_ENDPOINTS[role] ?? CHAT_ENDPOINTS.customer;
  } catch {
    return CHAT_ENDPOINTS.customer;
  }
}

function renderText(text) {
  return text.split("\n").map((line, i, arr) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <span key={i}>
        {parts.map((part, j) =>
          j % 2 === 1 ? <strong key={j}>{part}</strong> : part
        )}
        {i < arr.length - 1 && <br />}
      </span>
    );
  });
}

export default function ChatWidget() {
  const [isOpen,           setIsOpen]           = useState(false);
  const [showLabel,        setShowLabel]        = useState(true);
  const [showReportModal,  setShowReportModal]  = useState(false);
  const [messages,         setMessages]         = useState([{
    id: 1, role: "bot", time: getTime(), buttons: null,
    text: "Welcome to Kaam-ly! I can help you find and book trusted workers for any task. What do you need today?",
  }]);
  const [input,            setInput]            = useState("");
  const [isTyping,         setIsTyping]         = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [hasUnread]                             = useState(true);

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  const addMessage = (text, role, buttons = null) => {
    setMessages(prev => [...prev, { id: Date.now(), role, text, time: getTime(), buttons }]);
  };

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput("");
    setShowQuickReplies(false);

    const msgLower        = msg.toLowerCase();
    const reportKeywords  = ["report", "report a user", "report user", "report worker", "misconduct"];
    const supportKeywords = ["contact support", "contact us", "email support", "reach support"];
    const isReport        = msg === "__report_user__"     || reportKeywords.some(k => msgLower.includes(k));
    const isSupport       = msg === "__contact_support__" || (!isReport && supportKeywords.some(k => msgLower.includes(k)));

    if (isReport) {
      addMessage(LOCAL_LABELS["__report_user__"], "user");
      setIsTyping(true);
      await new Promise(r => setTimeout(r, 400));
      setIsTyping(false);
      addMessage("Sure! Please fill out the report form below.", "bot");
      setTimeout(() => setShowReportModal(true), 300);
      return;
    }

    if (isSupport) {
      addMessage(LOCAL_LABELS["__contact_support__"], "user");
      setIsTyping(true);
      await new Promise(r => setTimeout(r, 500));
      setIsTyping(false);
      const { text: botText, buttons } = LOCAL_RESPONSES["__contact_support__"];
      addMessage(botText, "bot", buttons);
      return;
    }

    addMessage(msg, "user");
    setIsTyping(true);

    try {
      const endpoint = getChatEndpoint();
      const response = await sendChatMessage(msg, endpoint);
      setIsTyping(false);
      addMessage(response, "bot");
    } catch {
      setIsTyping(false);
      addMessage("I'm having trouble connecting right now. Please try again shortly.", "bot");
    }
  };

  return (
    <>
      {showReportModal && (
        <ReportModal
          task={null}
          customerId={null}
          onClose={() => setShowReportModal(false)}
          onSubmitted={() => addMessage(
            "✅ Your report has been submitted. Our team will review it within 24 hours. Thank you for helping keep Kaam-ly safe.",
            "bot"
          )}
        />
      )}

      <div className="chat-widget">

        {/* ── Launcher + label ── */}
        <div className="launcher-wrap">
          {!isOpen && showLabel && (
            <div className="need-help-label">
              Need help?
              <button
                className="need-help-close"
                onClick={(e) => { e.stopPropagation(); setShowLabel(false); }}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          )}

          <button
            className="launcher-btn"
            onClick={() => { setIsOpen(v => !v); setShowLabel(false); }}
            aria-label="Toggle chat"
          >
            {hasUnread && !isOpen && <span className="unread-badge">1</span>}
            {isOpen ? (
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="34" height="34" fill="none" viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>

        {/* ── Chat panel ── */}
        <div className={`chat-panel ${isOpen ? "open" : "closed"}`}>

          <div className="chat-header">
            <div className="chat-header-top">
              <div className="chat-brand">
                <div className="chat-avatar">
                  <img src={botImg} width="60" height="60" alt="Kaami" />
                </div>
                <div>
                  <div className="chat-brand-name">Kaam-ly Support</div>
                  <div className="chat-status">
                    <span className="status-dot" />
                    Online · Replies instantly
                  </div>
                </div>
              </div>
              <button className="header-close-btn" onClick={() => setIsOpen(false)} aria-label="Close">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="chat-header-sub">Hi there! Ask me anything about booking workers or our services.</div>
          </div>

          <div className="messages-list">
            {messages.map(msg => (
              <div key={msg.id} className={`msg-row ${msg.role}`}>
                {msg.role === "bot" && (
                  <div className="msg-avatar">
                    <img src={botImg} width="40" height="40" alt="Kaami" />
                  </div>
                )}
                <div>
                  <div className="msg-bubble">{renderText(msg.text)}</div>
                  {msg.buttons && (
                    <div className="msg-buttons">
                      {msg.buttons.map(btn =>
                        btn.onClick ? (
                          <button key={btn.label} onClick={btn.onClick} className={`msg-action-btn ${btn.className || ""}`}>
                            {btn.label}
                          </button>
                        ) : (
                          <a key={btn.label} href={btn.href} className="msg-action-btn">{btn.label}</a>
                        )
                      )}
                    </div>
                  )}
                  <div className="msg-time">{msg.time}</div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="typing-row">
                <div className="msg-avatar">
                  <img src={botImg} width="40" height="40" alt="Kaami" />
                </div>
                <div className="typing-bubble">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {showQuickReplies && (
            <div className="quick-replies">
              {QUICK_REPLIES.map(qr => (
                <button
                  key={qr.text}
                  className={`quick-reply-btn ${qr.text === "__report_user__" ? "danger" : ""}`}
                  onClick={() => sendMessage(qr.text)}
                >
                  {qr.label}
                </button>
              ))}
            </div>
          )}

          <div className="input-bar">
            <input
              ref={inputRef}
              className="chat-input"
              type="text"
              placeholder="Type a message…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              autoComplete="off"
            />
            <button className="send-btn" onClick={() => sendMessage()} aria-label="Send">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="powered-by">Powered by Kaam-ly AI</div>
        </div>
      </div>
    </>
  );
}