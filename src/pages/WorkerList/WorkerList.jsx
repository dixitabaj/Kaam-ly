import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { getWorkerByCategory, getPriceByTask } from '../../api/api';
import BookingNavbar from "../../components/Navbar/Navbar";

const BrowseTaskers = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Get category and task details from location state (passed from previous page)
  const { category, taskDetails } = location.state || { 
    category: "carpentry", 
    taskDetails: { 
      taskType: "carpentry",
      description: "",
      estimatedHours: 1
    } 
  };

  // State
  const [selectedDate, setSelectedDate] = useState('today');
  const [customDate, setCustomDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState([]);
  const [specificTime, setSpecificTime] = useState('flexible');
  const [priceRange, setPriceRange] = useState([0, 2000]);
  const [sortBy, setSortBy] = useState('recommended');
  const [taskers, setTaskers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get category from location or use default
  const currentCategory = category || "carpentry";

  useEffect(() => {
  const loadWorkers = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch recommended workers
      const recommendationData = {
        taskType: category, // e.g., 'appliance repair'
        subCategory: taskDetails?.subCategory || taskDetails?.taskType, // e.g., 'ac repair'
        lat: coordinates?.lat,
        lng: coordinates?.lng,
        top_k: 50
      };
      
      const workersData = await getRecommendedWorkers(recommendationData);
      const activeWorkers = (workersData || []).filter(w => w.status !== "suspended");

      // 2. Map and fetch specific prices
      const workersWithPrices = await Promise.all(
        activeWorkers.map(async (worker) => {
          try {
            // CRITICAL: Use the subcategory (e.g., "ac repair") for the price lookup, not the category
            const targetTask = taskDetails?.subCategory || taskDetails?.taskType || category;
            
            const priceData = await getPriceByTask(targetTask, worker.email || worker._id);
            
            return {
              ...worker,
              // If the specialized API returns a price, use it. 
              // Otherwise, look manually inside the skills array.
              taskPrice: priceData?.price || null 
            };
          } catch (err) {
            // Manual fallback: Find the skill in the array if API call fails
            const manualSkill = worker.skills?.find(s => 
              s.name?.toLowerCase().includes((taskDetails?.subCategory || "").toLowerCase())
            );

            return {
              ...worker,
              taskPrice: manualSkill?.price || null
            };
          }
        })
      );

      setTaskers(workersWithPrices);
    } catch (err) {
      setError("Failed to load taskers.");
    } finally {
      setLoading(false);
    }
  };

  loadWorkers();
}, [category, taskDetails]);


// 5. Simplified Helper (Uses the 'taskPrice' we just fetched)
const getWorkerPrice = (worker) => {
  // 1. Highest priority: The price we fetched from getPriceByTask
  if (worker.taskPrice && worker.taskPrice > 0) {
    return worker.taskPrice;
  }

  // 2. Second priority: Look inside the skills array for a name match
  if (worker.skills && worker.skills.length > 0) {
    const subCat = (taskDetails?.subCategory || "").toLowerCase();
    const matchingSkill = worker.skills.find(s => 
      s.name?.toLowerCase().includes(subCat)
    );
    if (matchingSkill?.price) return matchingSkill.price;
    
    // 3. Third priority: First skill's price
    if (worker.skills[0].price) return worker.skills[0].price;
  }

  // 4. Last resort: The root basePrice (only if nothing else exists)
  return worker.basePrice || 0;
};

  // Helper: get the best available price (task-specific price first, then base price)
 

  // Calculate estimated total for display
  const getEstimatedTotal = (price) => {
    const hours = taskDetails?.estimatedHours || 1;
    return price * hours;
  };

  const handleTaskerSelect = (tasker) => {
    const price = getWorkerPrice(tasker);
    const estimatedTotal = getEstimatedTotal(price);

    const workerData = {
      id: tasker._id,
      firstName: tasker.firstName,
      lastName: tasker.lastName,
      name: `${tasker.firstName || ''} ${tasker.lastName || ''}`.trim(),
      rating: tasker.ratings || 0,
      reviews: tasker.noOfCompletedTask || tasker.reviewCount || 0,
      hourlyRate: price,
      estimatedTotal: estimatedTotal,
      estimatedHours: taskDetails?.estimatedHours || 1,
      minHours: tasker.minHours || 1,
      taskType: currentCategory,
      description: tasker.description || "Professional service provider",
      profilePhoto: tasker.profilePhoto || "",
      address: tasker.address || "Location not specified",
      avatar: `${tasker.firstName?.[0] || ''}${tasker.lastName?.[0] || ''}`.toUpperCase() || "?"
    };

    localStorage.setItem('selectedWorker', JSON.stringify(workerData));
    
    // Navigate to task description with worker and task details
    navigate('/taskDescription', { 
      state: { 
        worker: workerData,
        taskDetails: taskDetails 
      } 
    });
  };

  const handleViewProfile = (taskerId) => {
    navigate(`/workers/${encodeURIComponent(taskerId)}`, {
      state: { category: currentCategory }
    });
  };

  const handleChatNow = (taskerId, taskerName) => {
    navigate('/messages', {
      state: { 
        recipientId: taskerId,
        recipientName: taskerName 
      }
    });
  };

  // Filter + Sort logic
  const getFilteredAndSortedTaskers = () => {
    let filtered = [...taskers];

    // Price filter
    filtered = filtered.filter(tasker => {
      const price = getWorkerPrice(tasker);
      return price >= priceRange[0] && price <= priceRange[1];
    });

    // Time filter (placeholder - implement with real availability data)
    if (selectedTime.length > 0) {
      // For now just keep all - implement actual availability filtering later
      filtered = filtered.filter(() => true);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return getWorkerPrice(a) - getWorkerPrice(b);
        case 'price-high':
          return getWorkerPrice(b) - getWorkerPrice(a);
        case 'rating':
          return (b.ratings || 0) - (a.ratings || 0);
        case 'reviews':
          return (b.noOfCompletedTask || b.reviewCount || 0) - (a.noOfCompletedTask || a.reviewCount || 0);
        case 'recommended':
        default:
          const scoreA = (a.ratings || 0) * 0.65 + (a.noOfCompletedTask || a.reviewCount || 0) * 0.35;
          const scoreB = (b.ratings || 0) * 0.65 + (b.noOfCompletedTask || b.reviewCount || 0) * 0.35;
          return scoreB - scoreA;
      }
    });

    return filtered;
  };

  const filteredTaskers = getFilteredAndSortedTaskers();

  const averagePrice = filteredTaskers.length > 0
    ? Math.round(
        filteredTaskers.reduce((sum, t) => sum + getWorkerPrice(t), 0) / 
        filteredTaskers.length
      )
    : 0;

  // ────────────────────────────────────────────────────────────────
  //  Render
  // ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h2>Loading taskers...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'red' }}>
        <h2>{error}</h2>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FFFDF2' }}>
      <BookingNavbar />

      {/* Main content */}
      <div style={{ display: 'flex', gap: '24px', padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Sidebar Filters */}
        <div style={{ width: 300, flexShrink: 0 }}>
          {/* Date */}
          <div style={{ background: 'white', padding: 20, borderRadius: 12, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>When do you need help?</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {['today', 'tomorrow', 'this-week', 'custom'].map(option => (
                <button
                  key={option}
                  onClick={() => {
                    setSelectedDate(option);
                    setShowDatePicker(option === 'custom');
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 20,
                    border: '1px solid #ddd',
                    background: selectedDate === option ? '#f6ad56' : 'white',
                    color: selectedDate === option ? 'white' : '#333',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500
                  }}
                >
                  {option === 'today' ? 'Today' : 
                   option === 'tomorrow' ? 'Tomorrow' : 
                   option === 'this-week' ? 'This Week' : 'Custom'}
                </button>
              ))}
            </div>
            {showDatePicker && (
              <DatePicker
                selected={customDate}
                onChange={(date) => setCustomDate(date)}
                minDate={new Date()}
                placeholderText="Select date"
                inline
              />
            )}
          </div>

          {/* Time */}
          <div style={{ background: 'white', padding: 20, borderRadius: 12, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Time of day</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {['Morning (8am-12pm)', 'Afternoon (12pm-4pm)', 'Evening (4pm-8pm)'].map(time => (
                <label key={time} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    value={time}
                    checked={selectedTime.includes(time)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTime([...selectedTime, time]);
                      } else {
                        setSelectedTime(selectedTime.filter(t => t !== time));
                      }
                    }}
                  />
                  {time}
                </label>
              ))}
            </div>
            <select
              value={specificTime}
              onChange={(e) => setSpecificTime(e.target.value)}
              style={{ width: '100%', marginTop: 12, padding: '8px', borderRadius: 6, border: '1px solid #ddd' }}
            >
              <option value="flexible">I'm flexible</option>
              <option value="specific">Specific time</option>
            </select>
          </div>

          {/* Price */}
          <div style={{ background: 'white', padding: 20, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Hourly rate</h3>
            <input
              type="range"
              min={priceRange[0]}
              max={priceRange[1]}
              value={priceRange[1]}
              onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 14 }}>
              <span>NPR {priceRange[0]}</span>
              <span>NPR {priceRange[1]}+</span>
            </div>
            {averagePrice > 0 && (
              <div style={{ marginTop: 12, fontSize: 13, color: '#666', textAlign: 'center' }}>
                Average: <strong>NPR {averagePrice}/hr</strong>
              </div>
            )}
          </div>
        </div>

        {/* Main content – Taskers list */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 24 }}>
                {filteredTaskers.length} {currentCategory} taskers available
              </h2>
              {taskDetails?.estimatedHours && (
                <p style={{ margin: '4px 0 0', color: '#666', fontSize: 14 }}>
                  Estimated job duration: {taskDetails.estimatedHours} hour(s)
                </p>
              )}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd' }}
            >
              <option value="recommended">Recommended</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
              <option value="reviews">Most Reviews</option>
            </select>
          </div>

          {filteredTaskers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 12 }}>
              <h3>No taskers found</h3>
              <p>Try adjusting your filters</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 24 }}>
              {filteredTaskers.map((tasker) => {
                const price = getWorkerPrice(tasker);
                const estimatedTotal = getEstimatedTotal(price);
                const name = `${tasker.firstName || ''} ${tasker.lastName || ''}`.trim() || "Service Pro";
                const hasTaskPrice = tasker.taskPrice !== null && tasker.taskPrice > 0;

                return (
                  <div
                    key={tasker._id}
                    style={{
                      background: 'white',
                      borderRadius: 12,
                      padding: 24,
                      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                      display: 'flex',
                      gap: 24
                    }}
                  >
                    {/* Avatar */}
                    <div style={{ flexShrink: 0 }}>
                      {tasker.profilePhoto ? (
                        <img
                          src={tasker.profilePhoto}
                          alt={name}
                          style={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            objectFit: 'cover'
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            background: '#f6ad56',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 28,
                            fontWeight: 'bold'
                          }}
                        >
                          {name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Main info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h3 style={{ margin: '0 0 4px', fontSize: 20 }}>
                            {name}
                          </h3>
                          <div style={{ color: '#666', fontSize: 14, marginBottom: 8 }}>
                             {tasker.address || tasker.serviceArea?.primaryCity || 'Nepal'}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <span style={{ color: '#f6ad56', fontSize: 18, fontWeight: 'bold' }}>★</span>
                            <span style={{ fontWeight: 'bold' }}>{tasker.ratings?.toFixed(1) || 'New'}</span>
                            <span style={{ color: '#888', fontSize: 14 }}>
                              ({tasker.noOfCompletedTask || tasker.reviewCount || 0} jobs)
                            </span>
                            {hasTaskPrice && (
                              <span style={{ 
                                background: '#e8f5e9', 
                                color: '#2e7d32', 
                                padding: '2px 8px', 
                                borderRadius: 12, 
                                fontSize: 11,
                                fontWeight: 600 
                              }}>
                                Specialized Rate
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 22, fontWeight: 'bold', color: '#0f172a' }}>
                            NPR {price}
                            <span style={{ fontSize: 14, fontWeight: 'normal', color: '#666' }}>/hr</span>
                          </div>
                          <div style={{ color: '#2e7d32', fontSize: 14, fontWeight: 500, marginTop: 4 }}>
                            Starting at NPR {estimatedTotal} total
                            {taskDetails?.estimatedHours > 1 && ` for ${taskDetails.estimatedHours} hrs`}
                          </div>
                          {tasker.minHours > 1 && (
                            <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                              Min. {tasker.minHours} hours
                            </div>
                          )}
                        </div>
                      </div>

                      <p style={{ color: '#444', lineHeight: 1.5, margin: '12px 0' }}>
                        {tasker.description || "Reliable and experienced professional."}
                      </p>

                      {/* Skills/Tags */}
                      {tasker.skills?.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                          {tasker.skills.slice(0, 3).map((skill, idx) => (
                            <span
                              key={idx}
                              style={{
                                background: '#f0f0f0',
                                padding: '4px 12px',
                                borderRadius: 20,
                                fontSize: 12,
                                color: '#555'
                              }}
                            >
                              {skill.name || skill.taskType || skill}
                            </span>
                          ))}
                          {tasker.skills.length > 3 && (
                            <span style={{ color: '#888', fontSize: 12, alignSelf: 'center' }}>
                              +{tasker.skills.length - 3} more
                            </span>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                        <button
                          onClick={() => handleTaskerSelect(tasker)}
                          style={{
                            background: '#f6ad56',
                            color: 'white',
                            border: 'none',
                            padding: '10px 24px',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#e5943c'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#f6ad56'}
                        >
                          Send Request
                        </button>
                        <button
                          onClick={() => handleChatNow(tasker._id, name)}
                          style={{
                            background: 'white',
                            color: '#f6ad56',
                            border: '1px solid #f6ad56',
                            padding: '10px 24px',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f6ad56';
                            e.currentTarget.style.color = 'white';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'white';
                            e.currentTarget.style.color = '#f6ad56';
                          }}
                        >
                          Chat Now
                        </button>
                        <button
                          onClick={() => handleViewProfile(tasker._id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#f6ad56',
                            fontWeight: 500,
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            padding: '10px 16px'
                          }}
                        >
                          View Profile
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BrowseTaskers;