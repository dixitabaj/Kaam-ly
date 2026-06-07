import React, { useState, useEffect } from 'react';
import './homePage.css';
import { getWorkerByCategory, getWorkerBySubcategory, getReviewsById, getPopularServices, getTopRated, getEmergencyWorkers, getPriceByTask } from '../../api/api';
import { useNavigate } from 'react-router-dom';
import BookingNavbar from "../../components/Navbar/Navbar";
import SearchBar from "../../components/SearchBar/SearchBar";
import assemblyImg from '../../images/assembly.png';
import repairImg from '../../images/plumbing.png';
import movingImg from '../../images/moving.png';
import cleaningImg from '../../images/cleaning.png';
import outdoorImg from '../../images/gardening.png';
import paintingImg from '../../images/painting.png';
import trendingImg from '../../images/trending.png';
import mountingImg from '../../images/repair.png';
import reviewImg from '../../images/reviews.png';
import ChatWidget from "../../components/HelpSection/HelpSection";

/* =========================
   WorkerCard Component
========================= */
const WorkerCard = ({
  id, name, rating, reviews, completedJobs, price,
  profileImage, recentReview, reviewCount, responseTime, serviceArea, skills
}) => {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const handleViewProfile = () => navigate(`/workers/${encodeURIComponent(id)}`);

  const safeRating = (() => {
    if (!rating && rating !== 0) return 4.5;
    const numRating = typeof rating === 'string' ? parseFloat(rating) : rating;
    return !isNaN(numRating) && numRating > 0 ? numRating : 4.5;
  })();

  const displayRating = (() => {
    if (reviews && reviews.length > 0) {
      const sum = reviews.reduce((acc, r) => acc + (parseFloat(r.stars) || 0), 0);
      const avg = sum / reviews.length;
      return !isNaN(avg) ? avg.toFixed(1) : safeRating.toFixed(1);
    }
    return safeRating.toFixed(1);
  })();

  const latestReview = (() => {
    if (recentReview) return recentReview;
    if (reviews && reviews.length > 0) {
      return reviews.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB - dateA;
      })[0];
    }
    return null;
  })();

  const reviewText = latestReview?.text
    ? latestReview.text.length > 100
      ? latestReview.text.substring(0, 100) + '...'
      : latestReview.text
    : 'Responded quickly and completed the job on time. Very professional.';

  const safeReviewCount   = reviewCount || (reviews?.length || 0);
  const safeCompletedJobs = completedJobs || 0;

  const formattedResponseRate = responseTime
    ? (typeof responseTime === 'number' ? responseTime : parseInt(responseTime)) + '%'
    : '98%';

  const formattedServiceArea = serviceArea
    ? serviceArea.primaryCity || serviceArea.cities?.[0] || serviceArea || '5 km'
    : '5 km';

  const formattedServiceTaskType =
    skills && skills.length > 0
      ? skills.map(s => s.name || s).join(", ")
      : "General";

  return (
    <div className="worker-card-horizontal-scroll">
      <div className="worker-description">
        {/* ── Header: avatar + name | price ── */}
        <div className="worker-header">
          <div className="worker-header-left">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div className="profile-photo-home">
                {profileImage && !imgError ? (
                  <img
                    src={profileImage}
                    alt={name}
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <span className="profile-initials">
                    {name?.split(' ').map(n => n[0]).join('') || '?'}
                  </span>
                )}
              </div>
              <button className="view-profile-btn" onClick={handleViewProfile}>View Profile</button>
            </div>
            <div className="worker-name-wrapper">
              <div className="worker-name">{name || 'Unknown Worker'}</div>
            </div>
          </div>
          <div className="priceHome">Rs. {price || 'N/A'}</div>
        </div>

        {/* ── Details: rating + stats ── */}
        <div className="worker-details">
          <div className="rating-row">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className="star-icon">★</span>
              <span className="rating-value">{displayRating}</span>
              <span className="reviews-count">
                ({safeReviewCount} {safeReviewCount === 1 ? 'review' : 'reviews'})
              </span>
            </div>
            {safeRating >= 4.5 && safeCompletedJobs > 10 && (
              <div className="elite-badge">ELITE</div>
            )}
          </div>

          <div className="tasks-list">
            <div className="task-item">
              <div className="task-label">Jobs Done:</div>
              <div className="task-number">{safeCompletedJobs}</div>
            </div>
            <div className="task-item">
              <div className="task-label">Response Rate:</div>
              <div className="task-number">{formattedResponseRate}</div>
            </div>
            <div className="task-item">
              <div className="task-label">Service Area:</div>
              <div className="task-number">{formattedServiceArea}</div>
            </div>
            <div className="task-item">
              <div className="task-label">Task Type:</div>
              <div className="task-number">{formattedServiceTaskType}</div>
            </div>
          </div>
        </div>

        {/* ── Review snippet ── */}
        {latestReview ? (
          <div className="review-section">
            <div className="review-header">
              <div className="review-icon">
                <img src={reviewImg} alt="Review" width="20px" height="20px" />
              </div>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>Recent review:</span>
            </div>
            <p className="review-text">"{reviewText}"</p>
          </div>
        ) : (
          <div className="review-section">
            <p className="review-text">No reviews yet. Be the first to hire!</p>
          </div>
        )}
      </div>

      <div className="divider"></div>
      <button className="select-btn" onClick={handleViewProfile}>View Profile &amp; Book</button>
    </div>
  );
};

/* =========================
   Category Icon Component
========================= */
const CategoryIcon = ({ image, label, active, onClick }) => (
  <div className={`category-icon-item ${active ? 'active' : ''}`} onClick={onClick}>
    <div className="icon-circle">
      <img src={image} alt={label} className="category-img" />
    </div>
    <span className={`icon-label ${active ? 'active' : ''}`}>{label}</span>
  </div>
);

/* =========================
   Subcategory Item Component
========================= */
const SubcategoryItem = ({ label, active, onClick }) => (
  <div className={`subcategory-item ${active ? 'active' : ''}`} onClick={onClick}>
    {label}
  </div>
);

/* =========================
   Helper — format workers from home endpoints
========================= */
const formatHomeWorker = (w) => ({
  id:           w.id || w.email,
  name:         w.name || 'Unknown Worker',
  rating:       w.rating || 4.5,
  reviews:      [],
  recentReview: null,
  reviewCount:  w.review_count || 0,
  completedJobs:w.completed_tasks || 0,
  price:        w.base_price || 1000,
  profileImage: w.profile_pic || null,
  responseTime: w.response_time || null,
  serviceArea:  w.area || '5 km',
  category:     w.service_type || '',
  subcategory:  w.service_type || '',
  skills:       [],
});

/* =========================
   Main Page Component
========================= */
export default function TaskBookingUI() {
  const navigate = useNavigate();

  const [workers,             setWorkers]          = useState([]);
  const [filteredWorkers,     setFilteredWorkers]  = useState([]);
  const [loading,             setLoading]          = useState(true);
  const [error,               setError]            = useState('');
  const [selectedCategory,    setSelectedCategory]    = useState('Carpentry');
  const [selectedSubcategory, setSelectedSubcategory] = useState('Furniture Repair');

  const [popularWorkers,   setPopularWorkers]   = useState([]);
  const [topRatedWorkers,  setTopRatedWorkers]  = useState([]);
  const [emergencyWorkers, setEmergencyWorkers] = useState([]);
  const [trendingLoading,  setTrendingLoading]  = useState(false);
  const [basePrice,        setBasePrice]        = useState(null);

  const categorySubcategories = {
    'Carpentry':       ["Furniture Repair", "Flooring Installation", "Custom Built-ins", "Refinishing", "Trim Work"],
    'Plumbing':        ["Drain Cleaning", "Faucet Repair", "Toilet Repair", "Water Heater Repair", "Pipe Repair"],
    'Appliance Repair':["AC Installation", "AC Repair", "Dryer Repair", "Washer Repair", "Refrigerator Repair", "Dishwasher Repair", "Oven Repair"],
    'Moving':          ["Furniture Moving", "Box Moving", "Specialty Moving", "Equipment Moving"],
    'Cleaning':        ["House Cleaning", "Deep Cleaning", "Move-in/Move-out Cleaning"],
    'Outdoor Help':    ["Lawn Mowing", "Tree Trimming", "Plant Care", "Weed Control", "Fertilization"],
    'Painting':        ["Interior", "Exterior"],
    'Trending':        ['Emergency Services', 'Top Rated'],
  };

  const categories = [
    { id: 'Carpentry',        label: 'Carpentry',        image: assemblyImg  },
    { id: 'Appliance Repair', label: 'Appliance Repair', image: repairImg    },
    { id: 'Plumbing',         label: 'Plumbing',         image: mountingImg  },
    { id: 'Moving',           label: 'Moving',           image: movingImg    },
    { id: 'Cleaning',         label: 'Cleaning',         image: cleaningImg  },
    { id: 'Outdoor Help',     label: 'Outdoor Help',     image: outdoorImg   },
    { id: 'Painting',         label: 'Painting',         image: paintingImg  },
    { id: 'Trending',         label: 'Trending',         image: trendingImg  },
  ];

  /* ── Load trending data ── */
  useEffect(() => {
    if (selectedCategory !== 'Trending') return;

    const loadTrending = async () => {
      setTrendingLoading(true);
      try {
        if (selectedSubcategory === 'Popular Services') {
          const data = await getPopularServices();
          const allPopular = (data.categories || data || [])
            .flatMap(cat => (cat.workers || []).map(w => formatHomeWorker(w)));
          setPopularWorkers(allPopular);
        } else if (selectedSubcategory === 'Top Rated') {
          const data = await getTopRated();
          setTopRatedWorkers((Array.isArray(data) ? data : []).map(formatHomeWorker));
        } else if (selectedSubcategory === 'Emergency Services') {
          const data = await getEmergencyWorkers();
          setEmergencyWorkers((Array.isArray(data) ? data : []).map(formatHomeWorker));
        } else {
          const data = await getTopRated();
          setTopRatedWorkers((Array.isArray(data) ? data : []).map(formatHomeWorker));
        }
      } catch (err) {
        console.error('Trending load error:', err);
      } finally {
        setTrendingLoading(false);
      }
    };

    loadTrending();
  }, [selectedCategory, selectedSubcategory]);

  /* ── Load regular category workers ── */
  useEffect(() => {
    if (selectedCategory === 'Trending') return;

    const loadWorkers = async () => {
      try {
        setLoading(true);
        setError('');

        let data;
        if (selectedSubcategory && selectedSubcategory !== 'All') {
          data = await getWorkerBySubcategory(selectedCategory.toLowerCase(), selectedSubcategory);
        } else {
          data = await getWorkerByCategory(selectedCategory.toLowerCase());
        }

        if (!data || !Array.isArray(data) || data.length === 0) {
          setWorkers([]);
          setFilteredWorkers([]);
          setError('No workers found for this category');
          setLoading(false);
          return;
        }

        const workersWithReviews = await Promise.all(
          data.map(async (worker) => {
            try {
              const reviews = await getReviewsById(worker._id || worker.id);
              const reviewsData = Array.isArray(reviews) ? reviews : (reviews.reviews || []);
              const avgRating = reviewsData.length > 0
                ? reviewsData.reduce((sum, r) => sum + (r.stars || 0), 0) / reviewsData.length
                : (worker.ratings || 4.5);
              const sortedReviews = reviewsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

              const taskSkill = worker.skills?.find(
                skill => skill.name?.toLowerCase() === selectedSubcategory.toLowerCase()
              );
              const taskPrice = taskSkill?.price || worker.basePrice || 1000;

              return {
                id:           worker._id || worker.id,
                name:         `${worker.firstName || ''} ${worker.lastName || ''}`.trim() || 'Unknown Worker',
                rating:       avgRating,
                reviews:      reviewsData,
                recentReview: sortedReviews[0],
                reviewCount:  reviewsData.length,
                completedJobs:worker.noOfCompletedTask || 0,
                price:        taskPrice,
                profileImage: worker.profilePhoto || worker.profileImage || null,
                category:     worker.taskType || selectedCategory,
                skills:       worker.skills || [],
                subcategory:  worker.skills?.[0]?.name || 'General',
                serviceArea:  worker.serviceArea,
                responseTime: worker.responseTime,
              };
            } catch (err) {
              const taskSkill = worker.skills?.find(
                skill => skill.name?.toLowerCase() === selectedSubcategory.toLowerCase()
              );
              const taskPrice = taskSkill?.price || worker.basePrice || 1000;

              return {
                id:           worker._id || worker.id,
                name:         `${worker.firstName || ''} ${worker.lastName || ''}`.trim() || 'Unknown Worker',
                rating:       worker.ratings || 4.5,
                reviews:      [],
                recentReview: null,
                reviewCount:  0,
                completedJobs:worker.noOfCompletedTask || 0,
                price:        taskPrice,
                profileImage: worker.profilePhoto || null,
                category:     worker.taskType || selectedCategory,
                skills:       worker.skills || [],
                subcategory:  worker.skills?.[0]?.name || 'General',
              };
            }
          })
        );

        setWorkers(workersWithReviews);
        setFilteredWorkers(workersWithReviews);
      } catch (err) {
        setError(`Failed to load workers: ${err.message}`);
        setWorkers([]);
        setFilteredWorkers([]);
      } finally {
        setLoading(false);
      }
    };

    loadWorkers();
  }, [selectedCategory, selectedSubcategory]);

  /* ── Fetch base price ── */
  useEffect(() => {
    const fetchBasePrice = async () => {
      try {
        const data = await getPriceByTask();
        setBasePrice(data?.base_price || null);
      } catch (error) {
        console.error("Error fetching base price:", error);
      }
    };
    fetchBasePrice();
  }, []);

  /* ── Filter workers by subcategory ── */
  useEffect(() => {
    if (selectedCategory === 'Trending' || workers.length === 0) return;

    const filtered = workers.filter(worker =>
      worker.subcategory && worker.subcategory.toLowerCase().includes(selectedSubcategory.toLowerCase())
    );
    setFilteredWorkers(filtered.length > 0 ? filtered : workers.filter(w => w.category === selectedCategory));
  }, [selectedSubcategory, workers, selectedCategory]);

  const handleCategoryClick = (categoryId) => {
    setSelectedCategory(categoryId);
    const subs = categorySubcategories[categoryId];
    if (subs?.length > 0) setSelectedSubcategory(subs[0]);
  };

  const highestRatedWorkers = [...workers].sort((a, b) => b.rating - a.rating).slice(0, 8);

  /* ── Trending section renderer ── */
  const renderTrendingSection = () => {
    if (trendingLoading) return <p>Loading...</p>;

    if (selectedSubcategory === 'Popular Services') {
      if (popularWorkers.length === 0) return <p className="no-workers-message">No popular workers found.</p>;
      return popularWorkers.map(worker => <WorkerCard key={worker.id} {...worker} />);
    }
    if (selectedSubcategory === 'Top Rated') {
      if (topRatedWorkers.length === 0) return <p className="no-workers-message">No top rated workers found.</p>;
      return topRatedWorkers.map(worker => <WorkerCard key={worker.id} {...worker} />);
    }
    if (selectedSubcategory === 'Emergency Services') {
      if (emergencyWorkers.length === 0) return <p className="no-workers-message">No available emergency workers right now.</p>;
      return emergencyWorkers.map(worker => <WorkerCard key={worker.id} {...worker} />);
    }
  };

  return (
    <div className="app-container">
      <BookingNavbar />

      {/* Hero */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">Book a Trusted Worker for Any Task</h1>
          <SearchBar
            onItemSelect={(item) => {
              navigate("/task-request", {
                state: { taskCategory: item.label, confidence: item.confidence, originalText: item.text }
              });
            }}
            onImageClassified={(label) => {
              console.log("Image classified as:", label);
            }}
          />
        </div>
      </section>

      {/* Categories */}
      <section className="categories-icons-section">
        <div className="categories-icons-content">
          {categories.map((category) => (
            <CategoryIcon
              key={category.id}
              image={category.image}
              label={category.label}
              active={selectedCategory === category.id}
              onClick={() => handleCategoryClick(category.id)}
            />
          ))}
        </div>
        {selectedCategory && categorySubcategories[selectedCategory] && (
          <section className="subcategories-section">
            <div className="subcategories-content">
              {categorySubcategories[selectedCategory].map((subcategory) => (
                <SubcategoryItem
                  key={subcategory}
                  label={subcategory}
                  active={selectedSubcategory === subcategory}
                  onClick={() => setSelectedSubcategory(subcategory)}
                />
              ))}
            </div>
          </section>
        )}
      </section>

      {/* Workers */}
      <section className="workers-section">
        <div className="workers-content">
          <h2 className="section-title">{selectedSubcategory || selectedCategory}</h2>

          <div className="workers-horizontal-scroll">
            {selectedCategory === 'Trending' ? (
              renderTrendingSection()
            ) : (
              <>
                {loading && <p>Loading workers...</p>}
                {error   && <p className="error-message">{error}</p>}
                {!loading && !error && filteredWorkers.length > 0
                  ? filteredWorkers.map(worker => <WorkerCard key={worker.id} {...worker} />)
                  : !loading && !error && <p className="no-workers-message">No workers found for {selectedSubcategory}</p>
                }
              </>
            )}
          </div>

          {/* Highest Rated — only for non-Trending */}
          {selectedCategory !== 'Trending' && highestRatedWorkers.length > 0 && (
            <>
              <h2 className="section-title">Highest Rated</h2>
              <div className="workers-horizontal-scroll">
                {highestRatedWorkers.map(worker => (
                  <WorkerCard key={`highest-${worker.id}`} {...worker} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <ChatWidget />
    </div>
  );
}