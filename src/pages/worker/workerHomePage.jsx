import React, { useState, useEffect } from 'react';
import FacebookChatBox from '../../components/MessageBox/MessageBox';
import { useNavigate } from 'react-router-dom';

export default function WorkerChatPage() {
  const navigate = useNavigate();
  const workerId = localStorage.getItem('userId');
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        setLoading(true);
        const res = await fetch(`http://localhost:8000/chat/contacts/${workerId}`);
        const data = await res.json();
        setContacts(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (workerId) {
      fetchContacts();
    }
  }, [workerId]);

  const filteredContacts = contacts.filter(contact => 
    contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const styles = {
    container: {
      display: 'flex',
      height: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#f0f2f5'
    },
    // Left Sidebar - Contacts
    sidebar: {
      width: '320px',
      background: 'white',
      borderRight: '1px solid #e4e6eb',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '2px 0 8px rgba(0,0,0,0.02)'
    },
    sidebarHeader: {
      padding: '20px 16px',
      borderBottom: '1px solid #e4e6eb',
      background: 'white'
    },
    sidebarTitle: {
      fontSize: '20px',
      fontWeight: '700',
      color: '#1a1a1a',
      margin: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    badge: {
      background: '#FF6B35',
      color: 'white',
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '600'
    },
    searchContainer: {
      padding: '12px 16px',
      borderBottom: '1px solid #e4e6eb'
    },
    searchInput: {
      width: '100%',
      padding: '10px 16px',
      border: '1px solid #e4e6eb',
      borderRadius: '24px',
      fontSize: '14px',
      outline: 'none',
      transition: 'border-color 0.2s',
      background: '#f0f2f5',
      ':focus': {
        borderColor: '#FF6B35',
        background: 'white'
      }
    },
    contactsList: {
      flex: 1,
      overflowY: 'auto',
      padding: '8px'
    },
    contactItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px',
      marginBottom: '4px',
      cursor: 'pointer',
      borderRadius: '12px',
      transition: 'all 0.2s',
      background: 'white',
      ':hover': {
        background: '#f5f5f5'
      }
    },
    contactItemActive: {
      background: '#FF6B35',
      color: 'white'
    },
    contactAvatar: {
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      background: '#FF6B35',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '18px',
      fontWeight: '600',
      flexShrink: 0
    },
    contactAvatarActive: {
      background: 'white',
      color: '#FF6B35'
    },
    contactInfo: {
      flex: 1,
      overflow: 'hidden'
    },
    contactName: {
      fontSize: '15px',
      fontWeight: '600',
      marginBottom: '4px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    },
    contactEmail: {
      fontSize: '13px',
      color: '#65676b',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    },
    contactEmailActive: {
      color: 'rgba(255,255,255,0.9)'
    },
    timestamp: {
      fontSize: '11px',
      color: '#65676b',
      alignSelf: 'flex-start'
    },
    timestampActive: {
      color: 'rgba(255,255,255,0.9)'
    },
    // Right Panel - Chat Area
    chatPanel: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'white'
    },
    chatHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 24px',
      borderBottom: '1px solid #e4e6eb',
      background: 'white',
      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
    },
    chatHeaderInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    chatHeaderAvatar: {
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      background: '#FF6B35',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '16px',
      fontWeight: '600'
    },
    chatHeaderDetails: {
      display: 'flex',
      flexDirection: 'column'
    },
    chatHeaderName: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#1a1a1a'
    },
    chatHeaderStatus: {
      fontSize: '13px',
      color: '#10b981',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    },
    closeButton: {
      background: 'none',
      border: 'none',
      color: '#65676b',
      fontSize: '20px',
      cursor: 'pointer',
      padding: '8px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background 0.2s',
      ':hover': {
        background: '#f0f2f5'
      }
    },
    emptyState: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      background: '#fafafa',
      color: '#65676b'
    },
    emptyStateIcon: {
      fontSize: '64px',
      marginBottom: '16px',
      color: '#FF6B35'
    },
    emptyStateTitle: {
      fontSize: '20px',
      fontWeight: '600',
      color: '#1a1a1a',
      marginBottom: '8px'
    },
    emptyStateText: {
      fontSize: '14px',
      color: '#65676b'
    },
    loadingState: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: '#65676b'
    },
    backButton: {
      display: 'none',
      '@media (max-width: 768px)': {
        display: 'block'
      }
    }
  };

  // Get initials from name or email
  const getInitials = (contact) => {
    if (contact.name) {
      return contact.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }
    return contact.email?.substring(0, 2).toUpperCase() || contact.id.substring(0, 2).toUpperCase();
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 86400000) { // Less than 24 hours
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diff < 604800000) { // Less than 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div style={styles.container}>
      {/* Left Sidebar - Contacts */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.sidebarTitle}>
            Messages
            <span style={styles.badge}>{contacts.length}</span>
          </div>
        </div>

        {/* Search Bar */}
        <div style={styles.searchContainer}>
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        {/* Contacts List */}
        <div style={styles.contactsList}>
          {loading ? (
            <div style={styles.loadingState}>
              <p>Loading conversations...</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#65676b' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>💬</div>
              <p style={{ fontSize: '14px' }}>
                {searchTerm ? 'No conversations found' : 'No messages yet'}
              </p>
              {!searchTerm && (
                <p style={{ fontSize: '13px', marginTop: '8px' }}>
                  When customers message you, they'll appear here
                </p>
              )}
            </div>
          ) : (
            filteredContacts.map(contact => {
              const isActive = activeContact?.id === contact.id;
              return (
                <div
                  key={contact.id}
                  onClick={() => setActiveContact(contact)}
                  style={{
                    ...styles.contactItem,
                    ...(isActive ? styles.contactItemActive : {})
                  }}
                >
                  <div style={{
                    ...styles.contactAvatar,
                    ...(isActive ? styles.contactAvatarActive : {})
                  }}>
                    {getInitials(contact)}
                  </div>
                  <div style={styles.contactInfo}>
                    <div style={{
                      ...styles.contactName,
                      ...(isActive ? { color: 'white' } : {})
                    }}>
                      {contact.name || contact.email || `User ${contact.id.substring(0, 6)}`}
                    </div>
                    <div style={{
                      ...styles.contactEmail,
                      ...(isActive ? styles.contactEmailActive : {})
                    }}>
                      {contact.email || 'No email'}
                    </div>
                  </div>
                  {contact.lastMessageTime && (
                    <div style={{
                      ...styles.timestamp,
                      ...(isActive ? styles.timestampActive : {})
                    }}>
                      {formatTime(contact.lastMessageTime)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel - Chat Area */}
      <div style={styles.chatPanel}>
        {activeContact ? (
          <>
            {/* Chat Header */}
            <div style={styles.chatHeader}>
              <div style={styles.chatHeaderInfo}>
                <div style={styles.chatHeaderAvatar}>
                  {getInitials(activeContact)}
                </div>
                <div style={styles.chatHeaderDetails}>
                  <span style={styles.chatHeaderName}>
                    {activeContact.name || activeContact.email || `User ${activeContact.id.substring(0, 6)}`}
                  </span>
                  <span style={styles.chatHeaderStatus}>
                    <span style={{ fontSize: '12px' }}>●</span>
                    Online
                  </span>
                </div>
              </div>
              <button
                style={styles.closeButton}
                onClick={() => setActiveContact(null)}
              >
                ✕
              </button>
            </div>

            {/* Chat Box */}
            <div style={{ flex: 1, position: 'relative' }}>
              <FacebookChatBox
                senderId={workerId}
                receiverId={activeContact.id}
                onClose={() => setActiveContact(null)}
              />
            </div>
          </>
        ) : (
          // Empty State
          <div style={styles.emptyState}>
            <div style={styles.emptyStateIcon}>💬</div>
            <h3 style={styles.emptyStateTitle}>Your Conversations</h3>
            <p style={styles.emptyStateText}>
              Select a contact from the left to start chatting
            </p>
          </div>
        )}
      </div>
    </div>
  );
}