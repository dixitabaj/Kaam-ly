import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User, Star, CheckCircle, Briefcase,
  MapPin, Clock, Award, MessageCircle, ChevronRight,
  TrendingUp, TrendingDown, Filter, Tag
} from 'lucide-react';
import { fetchWorkerById, getReviewsById, getPriceByTask, fetchCustomerById } from '../../api/api';
import FacebookChatBox from '../../components/MessageBox/MessageBox';
import BookingNavbar from '../../components/Navbar/Navbar';
import './WorkerDescription.css';

export default function WorkerDescription() {
  const { id } = useParams();
  const workerId = id;
  const [worker,             setWorker]             = useState(null);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState('');
  const [showChat,           setShowChat]           = useState(false);
  const [showAllReviews,     setShowAllReviews]     = useState(false);
  const [reviewFilter,       setReviewFilter]       = useState('all');
  const [filteredReviews,    setFilteredReviews]    = useState([]);
  const [expandedReviews,    setExpandedReviews]    = useState({});
  const [selectedSkillIndex, setSelectedSkillIndex] = useState(0);

  const navigate    = useNavigate();
  const storedUser  = localStorage.getItem('user');
  const currentUser = storedUser ? JSON.parse(storedUser) : null;
  const senderId    = currentUser?.id;

  /* ── Navigate to chat ── */
  const handleSendMessage = () => {
    navigate(`/chat/${encodeURIComponent(senderId)}/${encodeURIComponent(workerId)}`);
  };

  /* ── Send booking request ── */
  const handleSendBookingRequest = () => {
    if (!worker) return;
    const workerData = {
      id:           workerId,
      name:         worker.name,
      email:        worker.email || '',
      rating:       worker.rating,
      reviews:      worker.reviews.length,
      hourlyRate:   displayPrice !== '-' ? Number(displayPrice) : 0,
      minHours:     worker.minHours || 1,
      taskType:     worker.taskType,
      description:  worker.description,
      profileImage: worker.profileImage,
      avatar:       getInitials(worker.name),
    };
    localStorage.setItem('selectedWorker', JSON.stringify(workerData));
    navigate('/taskDescription');
  };

  /* ── Fetch worker data ── */
  useEffect(() => {
    const fetchWorkerData = async () => {
      try {
        setLoading(true);
        const data       = await fetchWorkerById(workerId);
        const review     = await getReviewsById(workerId);
        const taskPrices = await getPriceByTask(data.taskType, workerId);

        const reviewsData   = Array.isArray(review) ? review : (review.reviews || []);
        const sortedReviews = reviewsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // ── Enrich reviews with customer names ──
        const enrichedReviews = await Promise.all(
          sortedReviews.map(async (rev) => {
            try {
              const customer = await fetchCustomerById(rev.user_id);
              const name = `${customer.firstName || customer.first_name || ''} ${customer.lastName || customer.last_name || ''}`.trim();
              return { ...rev, displayName: name || `User ${(rev.user_id || '').substring(0, 6).toUpperCase()}` };
            } catch {
              return { ...rev, displayName: `User ${(rev.user_id || '').substring(0, 6).toUpperCase()}` };
            }
          })
        );

        const rawSkills        = data.skills || [];
        const normalizedSkills = rawSkills.map((skill) => {
          if (typeof skill === 'object' && skill !== null) {
            return {
              name:  skill.name  || 'Unnamed Skill',
              price: skill.price ?? skill.basePrice ?? taskPrices?.price ?? data.basePrice ?? '-',
            };
          }
          return {
            name:  String(skill),
            price: taskPrices?.price ?? data.basePrice ?? '-',
          };
        });

        setWorker({
          name:          `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown',
          email:         data.email         || '',
          verified:      data.face_verified  || false,
          skillVerified: data.skill_verified || false,
          rating:        data.ratings        ?? 0,
          taskType:      data.taskType       || 'Task',
          skills:        normalizedSkills,
          basePrice:     data.basePrice      || '-',
          minHours:      data.minHours       || 1,
          completedJobs: data.noOfCompletedTask ?? 0,
          description:   data.description   || 'No description available.',
          serviceArea: {
            primaryCity: data.serviceArea?.primaryCity || '',
            cities:      data.serviceArea?.cities      || [],
          },
          responseTime:  data.responseTime  || '-',
          repeatClients: data.repeatClients || 0,
          reviews:       enrichedReviews,
          profileImage:  data.profileImage  || null,
          joinedOn:      data.joinedOn      || '-',
        });
        setFilteredReviews(enrichedReviews);
      } catch {
        setError('Failed to fetch worker data.');
      } finally {
        setLoading(false);
      }
    };

    if (workerId) fetchWorkerData();
  }, [workerId]);

  /* ── Filter reviews ── */
  useEffect(() => {
    if (!worker?.reviews) return;
    const filtered = [...worker.reviews];
    if (reviewFilter === 'highest')     filtered.sort((a, b) => (b.stars || 0) - (a.stars || 0));
    else if (reviewFilter === 'lowest') filtered.sort((a, b) => (a.stars || 0) - (b.stars || 0));
    else                                filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setFilteredReviews(filtered);
  }, [reviewFilter, worker?.reviews]);

  const toggleReviewExpansion = (reviewId) =>
    setExpandedReviews(prev => ({ ...prev, [reviewId]: !prev[reviewId] }));

  const truncateText = (text, maxLength = 250) => {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength) + '...';
  };

  const getInitials = (name) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  /* ── Derived price from selected skill ── */
  const selectedSkill    = worker?.skills?.[selectedSkillIndex] ?? null;
  const displayPrice     = selectedSkill?.price ?? worker?.basePrice ?? '-';
  const displaySkillName = selectedSkill?.name  ?? null;

  /* ── Loading / Error ── */
  if (loading) return (
    <div className="worker-description-page">
      <BookingNavbar />
      <div className="worker-description-loading">
        <div className="loading-spinner" />
        <p>Loading worker profile...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="worker-description-page">
      <BookingNavbar />
      <div className="worker-description-error">
        <p>{error}</p>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    </div>
  );

  if (!worker) return (
    <div className="worker-description-page">
      <BookingNavbar />
      <div className="worker-description-notfound">
        <p>Worker not found.</p>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    </div>
  );

  return (
    <div className="worker-description-page">
      <BookingNavbar />

      <div className="worker-description-container">
        <div className="worker-description-grid">

          {/* ══ LEFT COLUMN ══ */}
          <div className="worker-description-left">

            {/* Profile Header */}
            <div className="worker-profile-card">
              <div className="worker-profile-banner" />
              <div className="worker-profile-body">
                <div className="worker-profile-header">
                  <div className="worker-avatar-wrapper">
                    <div className="worker-avatar-cus">
                      {worker.profileImage
                        ? <img src={worker.profileImage} alt={worker.name} />
                        : <span className="worker-avatar-initials">{getInitials(worker.name)}</span>
                      }
                    </div>
                  </div>
                  <div className="worker-profile-info">
                    <div className="worker-profile-top">
                      <div>
                        <h1 className="worker-profile-name">{worker.name}</h1>
                        <p className="worker-profile-title">{worker.taskType}</p>
                      </div>
                      {worker.verified && (
                        <div className="worker-verified-badge">
                          <CheckCircle size={16} />
                          <span>Verified Pro</span>
                        </div>
                      )}
                    </div>
                    <div className="worker-stats-row">
                      <div className="worker-stat-item">
                        <Star size={18} fill="#FFB800" color="#FFB800" />
                        <span className="worker-stat-value">{worker.rating}</span>
                        <span className="worker-stat-label">({worker.reviews.length} reviews)</span>
                      </div>
                      <div className="worker-stat-divider" />
                      <div className="worker-stat-item">
                        <Briefcase size={18} />
                        <span className="worker-stat-value">{worker.completedJobs}</span>
                        <span className="worker-stat-label">jobs completed</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* About */}
            <div className="worker-info-card">
              <h2 className="worker-section-title">About Me</h2>
              <p className="worker-description-text">{worker.description}</p>
            </div>

            {/* Skills */}
            <div className="worker-info-card">
              <h2 className="worker-section-title">Skills & Expertise</h2>
              <p className="worker-skills-hint">
                <Tag size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Select a skill to see its rate
              </p>
              <div className="worker-skills-grid">
                {worker.skills.length > 0 ? (
                  worker.skills.map((skill, i) => (
                    <button
                      key={i}
                      className={`worker-skill-badge worker-skill-selectable${selectedSkillIndex === i ? ' worker-skill-selected' : ''}`}
                      onClick={() => setSelectedSkillIndex(i)}
                      title={skill.price !== '-' ? `Rs. ${skill.price}/hr` : 'Rate not specified'}
                    >
                      {skill.name}
                      {skill.price !== '-' && (
                        <span className="worker-skill-price-tag">Rs. {skill.price}</span>
                      )}
                    </button>
                  ))
                ) : (
                  <span className="worker-no-skills">No skills listed</span>
                )}
              </div>
            </div>

            {/* Reviews */}
            <div className="worker-info-card">
              <div className="worker-reviews-header">
                <h2 className="worker-section-title">Reviews</h2>
                <div className="worker-reviews-controls">
                  {worker.reviews.length > 0 && (
                    <>
                      <span className="worker-reviews-count">{worker.reviews.length} reviews</span>
                      <div className="review-filter-buttons">
                        {[
                          { key: 'all',     label: 'All',     Icon: Filter       },
                          { key: 'highest', label: 'Highest', Icon: TrendingUp   },
                          { key: 'lowest',  label: 'Lowest',  Icon: TrendingDown },
                        ].map(({ key, label, Icon }) => (
                          <button
                            key={key}
                            className={`review-filter-btn ${reviewFilter === key ? 'active' : ''}`}
                            onClick={() => setReviewFilter(key)}
                          >
                            <Icon size={14} /> {label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="worker-reviews">
                {filteredReviews.length === 0 ? (
                  <div className="no-reviews">
                    <MessageCircle size={48} className="no-reviews-icon" />
                    <p className="no-reviews-text">No reviews yet. Be the first to hire!</p>
                  </div>
                ) : (
                  <>
                    {filteredReviews.slice(0, showAllReviews ? undefined : 3).map((review, i) => {
                      const reviewId    = review.id || i;
                      const isExpanded  = expandedReviews[reviewId];
                      const reviewText  = review.text || '';
                      const isLong      = reviewText.length > 250;
                      const displayText = isExpanded ? reviewText : truncateText(reviewText);

                      return (
                        <div key={i} className="worker-review-item">
                          <div className="worker-review-content">
                            <div className="worker-review-avatar">
                              <User size={18} />
                            </div>
                            <div className="worker-review-body">
                              <div className="worker-review-header">
                                <div className="worker-reviewer-info">
                                  {/* ── Fixed: use enriched displayName ── */}
                                  <span className="worker-reviewer-name">
                                    {review.displayName || `User ${(review.user_id || '').substring(0, 6).toUpperCase()}` || 'Anonymous'}
                                  </span>
                                  <span className="worker-review-date">
                                    {review.createdAt
                                      ? new Date(review.createdAt).toLocaleDateString()
                                      : 'Recent'}
                                  </span>
                                </div>
                                <div className="worker-review-rating">
                                  <Star size={14} fill="#FFB800" color="#FFB800" />
                                  <span className="worker-review-score">{review.stars || '5.0'}</span>
                                </div>
                              </div>
                              <div className="worker-review-text-container">
                                <p className="worker-review-text">{displayText}</p>
                                {isLong && (
                                  <button
                                    className="worker-review-readmore"
                                    onClick={() => toggleReviewExpansion(reviewId)}
                                  >
                                    {isExpanded ? 'Read less' : 'Read more'}
                                  </button>
                                )}
                              </div>
                              {review.taskType && (
                                <span className="worker-review-task">{review.taskType}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {worker.reviews.length > 3 && (
                      <button
                        className="worker-view-all-btn"
                        onClick={() => setShowAllReviews(!showAllReviews)}
                      >
                        {showAllReviews ? 'Show less' : `View all ${worker.reviews.length} reviews`}
                        <ChevronRight size={16} style={{
                          transform: showAllReviews ? 'rotate(90deg)' : 'none',
                          transition: 'transform 0.2s',
                        }} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ══ RIGHT COLUMN ══ */}
          <div className="worker-description-right">
            <div className="worker-sidebar">

              {/* Pricing */}
              <div className="worker-sidebar-card">
                <div className="worker-pricing">
                  <span className="worker-price-label">
                    {displaySkillName ? `Rate for ${displaySkillName}` : 'Starting at'}
                  </span>
                  <div className="worker-price">
                    Rs. {typeof displayPrice === 'object' ? displayPrice.price || 'N/A' : displayPrice}
                    <span className="worker-price-unit">/hr</span>
                  </div>
                  <span className="worker-price-note">
                    {displaySkillName ? 'Per-skill rate' : 'Base rate'}
                  </span>
                </div>
                <button className="worker-btn-primary" onClick={handleSendBookingRequest}>
                  Send Booking Request
                </button>
                <button className="worker-btn-secondary" onClick={handleSendMessage}>
                  Message Worker
                </button>
              </div>

              {/* Details */}
              <div className="worker-sidebar-card">
                <h3 className="worker-sidebar-title">Details</h3>
                <div className="worker-details-list">
                  <div className="worker-detail-item">
                    <MapPin size={18} className="worker-detail-icon" />
                    <div>
                      <p className="worker-detail-label">Location</p>
                      <p className="worker-detail-value">
                        {worker.serviceArea?.cities.join(', ') || '-'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="worker-detail-item">
                    <Award size={18} className="worker-detail-icon" />
                    <div>
                      <p className="worker-detail-label">Joined On</p>
                      <p className="worker-detail-value">{worker.joinedOn}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trust & Safety */}
              <div className="worker-trust-card">
                <h3 className="worker-trust-title">
                  <CheckCircle size={18} className="worker-trust-icon" />
                  Trust & Safety
                </h3>
                <ul className="worker-trust-list">
                  <li className="worker-trust-item">
                    <CheckCircle size={16} className="worker-check-icon" />
                    Identity verified
                  </li>
                  <li className="worker-trust-item">
                    <CheckCircle size={16} className="worker-check-icon" />
                    Esrow payment protection
                  </li>
                </ul>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Floating Chat */}
      {showChat && senderId && (
        <div className="worker-floating-chat">
          <FacebookChatBox
            senderId={senderId}
            receiverId={workerId}
            onClose={() => setShowChat(false)}
          />
        </div>
      )}
    </div>
  );
}