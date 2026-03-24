import { Underline } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { recommendWorker, getPriceByTask} from '../../api/api'
import BookingNavbar from "../../components/Navbar/Navbar";
import ChatWidget from '../../components/HelpSection/HelpSection';

const BrowseTaskers = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState('today');
  const [customDate, setCustomDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState([]);
  const [specificTime, setSpecificTime] = useState('flexible');
  const [priceRange, setPriceRange] = useState([10, 950]);
  const [sortBy, setSortBy] = useState('recommended');
  const [minPrice, setMinPrice] = useState(10);
  const [maxPrice, setMaxPrice] = useState(950);
  const [hoveredButton, setHoveredButton] = useState(null);
  

  const [taskers, setTaskers] = useState([]);

  // ... existing imports
  // ... existing filter states
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWorkers = async () => {
      try {
        setLoading(true);
  
        const savedCategory = localStorage.getItem('predictedCategory');
        const savedRequest = localStorage.getItem('pendingTaskRequest');
  
        let categoryObj = null;
        let requestObj = null;
  
        try {
          categoryObj = savedCategory ? JSON.parse(savedCategory) : null;
          requestObj = savedRequest ? JSON.parse(savedRequest) : null;
        } catch (e) {
          console.error("Parsing error:", e);
        }
  
        const lat = requestObj?.lat || requestObj?.latitude || requestObj?.coords?.lat || 0;
        const lng = requestObj?.lng || requestObj?.longitude || requestObj?.coords?.lng || 0;
  
        // Extract values for the matching logic
        const taskType = categoryObj?.broad?.[0]?.label || "General";
        const subCategory = categoryObj?.sub?.[0]?.label || "";
  
        const response = await recommendWorker({
          taskType,
          lat: lat,
          lng: lng,
          subCategory: subCategory,
          top_k: 50
        });
  
        // ✅ The Fix: Map workers to extract the specific skill price
       const processedWorkers = (response || []).map(worker => {
  const matchingSkill = worker.skills?.find(
    s => s.name?.toLowerCase().trim() === subCategory.toLowerCase().trim()
  );

  let displayPrice;
  let priceRangeLabel = null;

  if (matchingSkill) {
    // ✅ Exact match: show that skill’s price
    displayPrice = matchingSkill.price;
  } else if (worker.skills?.length) {
    // ❌ No match: show min-max range of all skills
    const skillPrices = worker.skills.map(s => s.price || 0);
    const minPrice = Math.min(...skillPrices);
    const maxPrice = Math.max(...skillPrices);
    displayPrice = minPrice; // For sorting/filtering, pick min as representative
    priceRangeLabel = `${minPrice} - ${maxPrice}`; // Display in UI
  } else {
    // No skills: fallback to basePrice
    displayPrice = worker.basePrice || 0;
  }

  return {
    ...worker,
    displayPrice,
    priceRangeLabel, // optional: if you want to show the range in UI
    activeSkillName: matchingSkill?.name || worker.skills?.[0]?.name || taskType
  };
});

setTaskers(processedWorkers);
  
        if (processedWorkers.length > 0) {
          const prices = processedWorkers.map(w => w.displayPrice);
          const maxP = Math.max(...prices);
          const minP = Math.min(...prices);
          setMinPrice(minP);
          setMaxPrice(maxP + 50);
          setPriceRange([minP, maxP + 50]);
        }
      } catch (error) {
        console.error("Error loading recommended workers:", error);
      } finally {
        setLoading(false);
      }
    };
  
    loadWorkers();
  }, []);

  useEffect(() => {
  const fetchPrices = async () => {
    try {
      const savedCategory = localStorage.getItem("predictedCategory");
      if (!savedCategory) return;

      const categoryObj = JSON.parse(savedCategory);
      const taskName =
        categoryObj?.sub?.[0]?.label ||
        categoryObj?.broad?.[0]?.label ||
        "General";

      const updatedWorkers = await Promise.all(
        taskers.map(async (worker) => {
          const priceData = await getPriceByTask(taskName, worker._id);

          return {
            ...worker,
            displayPrice: priceData?.price || worker.displayPrice || worker.basePrice
          };
        })
      );

      setTaskers(updatedWorkers);

    } catch (err) {
      console.error("Error fetching worker task prices:", err);
    }
  };

  if (taskers.length > 0) {
    fetchPrices();
  }
}, []);


  // ... rest of your handle functions
  
  const handleTimeToggle = (time) => {
    setSelectedTime(prev =>
      prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]
    );
  };

  const handlePriceRangeChange = (e) => {
    const value = parseInt(e.target.value);
    setPriceRange([minPrice, value]);
  };

  const handleTaskerSelect = (taskerId) => {
  // Get the selected tasker data
  const selectedTasker = filteredTaskers.find(t => t._id === taskerId);
  
  if (selectedTasker) {
    // Store selected worker in localStorage
    const workerData = {
      id: selectedTasker._id,
      firstName: selectedTasker.firstName,
      lastName: selectedTasker.lastName,
      name: `${selectedTasker.firstName} ${selectedTasker.lastName}`,
      rating: selectedTasker.ratings,
      reviews: selectedTasker.noOfCompletedTask,
      hourlyRate: selectedTasker.basePrice,
      minHours: selectedTasker.minHours || 1,
      taskType: selectedTasker.taskType,
      description: selectedTasker.description,
      profilePhoto: selectedTasker.profilePhoto,
      address: selectedTasker.address,
      avatar: `${selectedTasker.firstName?.[0]}${selectedTasker.lastName?.[0]}`.toUpperCase()
    };
    
    localStorage.setItem('selectedWorker', JSON.stringify(workerData));
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user.id || user._id;
    
    // Navigate to task description page
    navigate('/taskDescription');
  }
};

  const handleViewProfile = (taskerId) => {
    navigate(`/workers/${encodeURIComponent(taskerId)}`);
  };

  const handleHelpClick = () => {
    navigate('/helpSection');
  };

  const handleSpecificTimeChange = (e) => {
    setSpecificTime(e.target.value);
  };

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
  };

  const handleSendMessage = (taskerId, userId) => {
    const encodedWorkerId = encodeURIComponent(taskerId);
    const encodedSenderId = encodeURIComponent(userId);
    navigate(`/chat/${encodedSenderId}/${encodedWorkerId}`);
  };

  const handleChooseDates = () => {
    setSelectedDate('choose');
    setShowDatePicker(true);
  };

  const handleDateChange = (date) => {
    setCustomDate(date);
    setShowDatePicker(false);
  };

  // FILTER AND SORT LOGIC
  const getFilteredAndSortedTaskers = () => {
    let filtered = [...taskers];

    // 1. PRICE FILTER
    filtered = filtered.filter(
      tasker => (tasker.basePrice || 0) >= priceRange[0] && (tasker.basePrice || 0) <= priceRange[1]
    );

    // 2. TIME OF DAY FILTER
    if (selectedTime.length > 0) {
      filtered = filtered.filter(tasker => {
        const hours = tasker.hours;
        if (!hours) return true;
        
        return selectedTime.some(timeSlot => {
          if (timeSlot === 'morning') {
            return true;
          }
          if (timeSlot === 'afternoon') {
            return true;
          }
          if (timeSlot === 'evening') {
            return true;
          }
          return true;
        });
      });
    }

    // 3. SPECIFIC TIME FILTER
    if (specificTime !== 'flexible') {
      console.log('Filtering by specific time:', specificTime);
    }

    // 4. SORT
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return (a.basePrice || 0) - (b.basePrice || 0);
        case 'price-high':
          return (b.basePrice || 0) - (a.basePrice || 0);
        case 'rating':
          return (b.ratings || 0) - (a.ratings || 0);
        case 'reviews':
          return (b.noOfCompletedTask || 0) - (a.noOfCompletedTask || 0);
        
      }
    });

    return filtered;
  };

  const filteredTaskers = getFilteredAndSortedTaskers();

  const averagePrice = filteredTaskers.length > 0
    ? Math.round(filteredTaskers.reduce((sum, t) => sum + (t.basePrice || 0), 0) / filteredTaskers.length)
    : 600;

  const styles = {
    container: {
      minHeight: '100vh',
      background: '#FFFDF2',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#333'
    },
    content: {
      display: 'flex',
      gap: '24px',
      padding: '24px',
      maxWidth: '1200px',
      margin: '0 auto'
    },
    sidebar: {
      flex: '0 0 280px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    },
    filterSection: {
      background: '#fff',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      border: '1px solid #e8e8e8'
    },
    filterTitle: {
      fontSize: '16px',
      fontWeight: '600',
      marginBottom: '16px',
      color: '#2d3748',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    dateButtonGroup: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '8px',
      marginBottom: '8px'
    },
    filterButton: {
      padding: '10px 12px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      background: '#f9fafb',
      fontSize: '13px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s',
      color: '#4b5563'
    },
    filterButtonActive: {
      background: '#f6ad56',
      color: 'white',
      border: 'none',
      fontSize: '14px',
      fontWeight: '500',
    },
    checkboxLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '12px',
      fontSize: '14px',
      color: '#4a5568',
      cursor: 'pointer'
    },
    checkbox: {
      width: '16px',
      height: '16px',
      cursor: 'pointer',
      accentColor: '#f6ad56'
    },
    dividerText: {
      textAlign: 'center',
      fontSize: '13px',
      color: '#718096',
      margin: '12px 0',
      position: 'relative'
    },
    dividerTextLine: {
      position: 'absolute',
      top: '50%',
      left: 0,
      right: 0,
      height: '1px',
      background: '#e2e8f0',
      zIndex: 1
    },
    dividerTextContent: {
      position: 'relative',
      zIndex: 2,
      background: '#fff',
      padding: '0 10px'
    },
    select: {
      width: '100%',
      padding: '10px 12px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '14px',
      background: 'white',
      cursor: 'pointer',
      color: '#4a5568'
    },
    priceChart: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: '4px',
      height: '50px',
      marginBottom: '16px'
    },
    priceBar: {
      flex: 1,
      background: '#f6ad56',
      borderRadius: '2px',
      opacity: 0.7
    },
    slider: {
      width: '100%',
      height: '4px',
      marginBottom: '16px',
      cursor: 'pointer',
      borderRadius: '2px',
      background: '#fcf3c7',
      outline: 'none',
      WebkitAppearance: 'none',
      appearance: 'none'
    },
    priceLabels: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '13px',
      fontWeight: '500',
      color: '#f6ad56',
      marginBottom: '8px'
    },
    averagePrice: {
      fontSize: '12px',
      color: '#718096',
      textAlign: 'center'
    },
    mainContent: {
      flex: 1
    },
    sortHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '20px'
    },
    resultsCount: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#2d3748'
    },
    sortLabel: {
      fontSize: '14px',
      fontWeight: '500',
      color: '#4a5568'
    },
    sortSelect: {
      padding: '8px 12px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '14px',
      background: 'white',
      minWidth: '180px',
      cursor: 'pointer',
      color: '#4a5568'
    },
    taskerList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    },
    taskerCard: {
      background: '#fff',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      border: '1px solid #edf2f7',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    },
    cardHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    },
    taskerInfo: {
      display: 'flex',
      gap: '16px'
    },
    avatarContainer: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px'
    },
    avatar: {
      width: '64px',
      height: '64px',
      borderRadius: '50%',
      background: 'rgb(246, 173, 86)',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '24px',
      fontWeight: '600',
      flexShrink: 0
    },
    viewProfileUnderAvatar: {
      background: 'none',
      border: 'none',
      color: 'black',
      fontSize: '12px',
      fontWeight: '600',
      cursor: 'pointer',
      padding: '4px 8px',
      textDecoration: 'underline',
      textUnderlineOffset: '2px',
      whiteSpace: 'nowrap'
    },
    taskerDetails: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    },
    taskerNameRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      flexWrap: 'wrap'
    },
    taskerName: {
      fontSize: '20px',
      fontWeight: '700',
      color: '#0f172a',
      margin: 0
    },
    eliteBadge: {
      background: 'rgb(246, 173, 86)',
      color: 'white',
      padding: '4px 10px',
      borderRadius: '16px',
      fontSize: '11px',
      fontWeight: '700',
      letterSpacing: '0.5px',
      textTransform: 'uppercase'
    },
    minHours: {
      background: '#f1f5f9',
      color: '#475569',
      padding: '4px 10px',
      borderRadius: '16px',
      fontSize: '11px',
      fontWeight: '600',
      letterSpacing: '0.5px'
    },
    ratingContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '2px'
    },
    stars: {
      display: 'flex',
      alignItems: 'center',
      gap: '2px'
    },
    starFilled: {
      color: '#FFB800',
      fontSize: '14px'
    },
    starEmpty: {
      color: '#e2e8f0',
      fontSize: '14px'
    },
    ratingValue: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#0f172a'
    },
    ratingCount: {
      fontSize: '13px',
      color: '#64748b'
    },
    priceRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '4px'
    },
    price: {
      fontSize: '18px',
      fontWeight: '700',
      color: '#0f172a'
    },
    priceLabel: {
      fontSize: '14px',
      fontWeight: '400',
      color: '#64748b'
    },
    actionButtons: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      marginLeft: '100px'
    },
    mainButtons: {
      display: 'flex',
      gap: '20px',
      alignItems: 'center'
    },
    sendRequestBtn: {
      padding: '12px 22px',
      background: 'rgb(246, 173, 86)',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'background 0.2s'
    },
    chatNowBtn: {
      padding: '12px 22px',
      background: 'white',
      color: 'rgb(246, 173, 86)',
      border: '1px solid rgb(246, 173, 86)',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    reviewSection: {
      background: '#F8FAFD',
      padding: '16px',
      borderRadius: '12px',
      marginTop: '8px',
      marginBottom: '10px',
      marginLeft: '100px'
    },
    reviewHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '8px'
    },
    reviewIcon: {
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      background: '#E2E8F0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      color: '#475569'
    },
    reviewText: {
      fontSize: '14px',
      color: '#475569',
      lineHeight: '1.5',
      margin: 0,
      fontStyle: 'italic'
    },
    reviewService: {
      fontSize: '13px',
      color: '#94a3b8',
      marginTop: '6px',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    },
    helpButton: {
      position: 'fixed',
      bottom: '24px',
      left: '24px',
      padding: '12px 20px',
      background: '#F6AD56',
      color: 'white',
      border: 'none',
      borderRadius: '24px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(66, 153, 225, 0.3)',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      zIndex: 100
    },
    helpIcon: {
      width: '18px',
      height: '18px',
      borderRadius: '50%',
      background: 'white',
      color: '#F6AD56',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      fontWeight: '700'
    },
    selectedDateDisplay: {
      marginTop: '12px',
      padding: '10px',
      background: '#f8fafc',
      borderRadius: '6px',
      fontSize: '14px',
      color: '#475569',
      textAlign: 'center'
    },
    datePickerOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.3)',
      zIndex: 999,
      display: showDatePicker ? 'block' : 'none'
    },
    datePickerContainer: {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      zIndex: 1000
    }
  };

  const renderStars = (rating) => {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    
    return (
      <span style={styles.stars}>
        {[...Array(fullStars)].map((_, i) => (
          <span key={`full-${i}`} style={styles.starFilled}>★</span>
        ))}
        {halfStar && <span style={styles.starFilled}>½</span>}
        {[...Array(emptyStars)].map((_, i) => (
          <span key={`empty-${i}`} style={styles.starEmpty}>★</span>
        ))}
      </span>
    );
  };

  return (
    <div style={styles.container}>
      <BookingNavbar/>

      <div style={styles.content}>
        {/* Left Sidebar - Filters */}
        <div style={styles.sidebar}>
          {/* Date Filter */}
          <div style={styles.filterSection}>
            <h3 style={styles.filterTitle}>Date</h3>
            <div style={styles.dateButtonGroup}>
              <button
                style={{
                  ...styles.filterButton,
                  ...(selectedDate === 'today' ? styles.filterButtonActive : {})
                }}
                onClick={() => {
                  setSelectedDate('today');
                  setShowDatePicker(false);
                  setCustomDate(null);
                }}
              >
                Today
              </button>
              <button
                style={{
                  ...styles.filterButton,
                  ...(selectedDate === 'within3' ? styles.filterButtonActive : {})
                }}
                onClick={() => {
                  setSelectedDate('within3');
                  setShowDatePicker(false);
                  setCustomDate(null);
                }}
              >
                Within 3 Days
              </button>
            </div>
            <div style={styles.dateButtonGroup}>
              <button
                style={{
                  ...styles.filterButton,
                  ...(selectedDate === 'week' ? styles.filterButtonActive : {})
                }}
                onClick={() => {
                  setSelectedDate('week');
                  setShowDatePicker(false);
                  setCustomDate(null);
                }}
              >
                Within A Week
              </button>
              <button
                style={{
                  ...styles.filterButton,
                  ...(selectedDate === 'choose' ? styles.filterButtonActive : {})
                }}
                onClick={handleChooseDates}
              >
                Choose Dates
              </button>
            </div>

            {/* Show selected custom date */}
            {selectedDate === 'choose' && customDate && (
              <div style={styles.selectedDateDisplay}>
                Selected: {customDate.toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
            )}
          </div>

          {/* Time Filter */}
          <div style={styles.filterSection}>
            <h3 style={styles.filterTitle}>Time of day</h3>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={selectedTime.includes('morning')}
                onChange={() => handleTimeToggle('morning')}
                style={styles.checkbox}
              />
              <span>Morning (8am - 12pm)</span>
            </label>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={selectedTime.includes('afternoon')}
                onChange={() => handleTimeToggle('afternoon')}
                style={styles.checkbox}
              />
              <span>Afternoon (12pm - 5pm)</span>
            </label>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={selectedTime.includes('evening')}
                onChange={() => handleTimeToggle('evening')}
                style={styles.checkbox}
              />
              <span>Evening (5pm - 9:30pm)</span>
            </label>
            
            <div style={styles.dividerText}>
              <div style={styles.dividerTextLine}></div>
              <div style={styles.dividerTextContent}>or choose a specific time</div>
            </div>
            
            <select 
              style={styles.select}
              value={specificTime}
              onChange={handleSpecificTimeChange}
            >
              <option value="flexible">I'm Flexible</option>
              <option value="9:00">9:00 AM</option>
              <option value="10:00">10:00 AM</option>
              <option value="11:00">11:00 AM</option>
              <option value="12:00">12:00 PM</option>
              <option value="13:00">1:00 PM</option>
              <option value="14:00">2:00 PM</option>
            </select>
          </div>

          {/* Price Filter */}
          <div style={styles.filterSection}>
            <h3 style={styles.filterTitle}>Price</h3>
            <div style={styles.priceChart}>
              {[20, 35, 45, 60, 50, 40, 25, 15, 10, 8].map((height, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.priceBar,
                    height: `${height}%`,
                    opacity: i >= 2 && i <= 7 ? 0.9 : 0.3
                  }}
                />
              ))}
            </div>
            <input
              type="range"
              min={minPrice}
              max={maxPrice}
              value={priceRange[1]}
              onChange={handlePriceRangeChange}
              style={styles.slider}
            />
            <div style={styles.priceLabels}>
              <span>NPR {priceRange[0]}</span>
              <span>NPR {priceRange[1]}+</span>
            </div>
            <div style={styles.averagePrice}>
              The average hourly rate is <strong>NPR {averagePrice}/hr</strong>
            </div>
          </div>
        </div>

        {/* Right Content - Tasker List */}
        <div style={styles.mainContent}>
          <div style={styles.sortHeader}>
            <span style={styles.resultsCount}>
              {filteredTaskers.length} tasker{filteredTaskers.length !== 1 ? 's' : ''} available
            </span>
            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
              <span style={styles.sortLabel}>Sorted by:</span>
              <select
                value={sortBy}
                onChange={handleSortChange}
                style={styles.sortSelect}
              >
                <option value="recommended">Recommended</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
                <option value="reviews">Most Reviews</option>
              </select>
            </div>
          </div>

          {/* Tasker Cards */}
          <div style={styles.taskerList}>
            {filteredTaskers.length > 0 ? (
              filteredTaskers.map((tasker) => (
                <div key={tasker._id} style={styles.taskerCard}>
                  <div style={styles.cardHeader}>
                    <div style={styles.taskerInfo}>
                      <div style={styles.avatarContainer}>
                        <div style={styles.avatar}>
                          {tasker.firstName?.[0]}{tasker.lastName?.[0]}
                        </div>
                        <button
                          style={styles.viewProfileUnderAvatar}
                          onClick={() => handleViewProfile(tasker._id)}
                          onMouseEnter={() => setHoveredButton(`view-${tasker._id}`)}
                          onMouseLeave={() => setHoveredButton(null)}
                        >
                          View Profile
                        </button>
                      </div>
                     
                      <div style={styles.taskerDetails}>
                        <div style={styles.taskerNameRow}>
                          <h3 style={styles.taskerName}>
                            {tasker.firstName} {tasker.lastName}
                          </h3>
                          {tasker.ratings >= 4.5 && (
                            <span style={styles.eliteBadge}>ELITE</span>
                          )}
                          <span style={styles.minHours}>{tasker.minHours || 1}hr min</span>
                        </div>
                        
                        <div style={{ fontSize: '14px', color: '#475569', marginTop: '4px' }}>
                          📍 {tasker.address || 'Location not specified'}
                        </div>
                        
                        <div style={styles.ratingContainer}>
                          {renderStars(tasker.ratings || 4.5)}
                          <span style={styles.ratingValue}>
                            {tasker.ratings?.toFixed(1) || '4.5'}
                          </span>
                          <span style={styles.ratingCount}>
                            ({tasker.noOfCompletedTask || 0} reviews)
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={styles.priceRow}>
                      <span style={styles.price}>Rs. Rs. {tasker.displayPrice}</span>
                      <span style={styles.priceLabel}>/hr</span>
                    </div>
                  </div>

                  <div style={styles.reviewSection}>
                    <div style={styles.reviewHeader}>
                      <div style={styles.reviewIcon}>💬</div>
                      <span style={{fontSize: '14px', fontWeight: '600', color: '#0f172a'}}>
                        {tasker.description || 'Service provider'}
                      </span>
                    </div>
                    <p style={styles.reviewText}>
                      "{tasker.description || 'Professional and reliable service.'}"
                    </p>
                    <div style={styles.reviewService}>
                      <span>🔧 Service: {tasker.taskType || 'General'}</span>
                    </div>
                  </div>

                  <div style={styles.actionButtons}>
                    <div style={styles.mainButtons}>
                      <button
                        style={{
                          ...styles.sendRequestBtn,
                          ...(hoveredButton === `send-${tasker._id}` ? { background: '#e05a2b' } : {})
                        }}
                        onClick={() => handleTaskerSelect(tasker._id)}
                        onMouseEnter={() => setHoveredButton(`send-${tasker._id}`)}
                        onMouseLeave={() => setHoveredButton(null)}
                      >
                        Send Request
                      </button>
                      <button
                        style={{
                          ...styles.chatNowBtn,
                          ...(hoveredButton === `chat-${tasker._id}` ? { background: '#FFF1EB', borderColor: '#e05a2b', color: '#e05a2b' } : {})
                        }}
                       onClick={() => 
                       
    handleSendMessage(tasker._id, userId)}
                        onMouseEnter={() => setHoveredButton(`chat-${tasker._id}`)}
                        onMouseLeave={() => setHoveredButton(null)}
                      >
                        Chat Now
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '48px',
                background: 'white',
                borderRadius: '12px',
                border: '1px solid #e8e8e8'
              }}>
                <span style={{fontSize: '48px', marginBottom: '16px', display: 'block'}}>🔍</span>
                <h3 style={{color: '#2d3748', marginBottom: '8px'}}>No taskers found</h3>
                <p style={{color: '#718096'}}>Try adjusting your filters</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <>
          <div 
            style={styles.datePickerOverlay}
            onClick={() => setShowDatePicker(false)}
          />
          <div style={styles.datePickerContainer}>
            <h4 style={{margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600'}}>
              Select a Date
            </h4>
            <DatePicker
              selected={customDate}
              onChange={handleDateChange}
              inline
              minDate={new Date()}
              dateFormat="MMMM d, yyyy"
              calendarClassName="custom-calendar"
            />
            <button
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '10px',
                background: '#f6ad56',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
              onClick={() => setShowDatePicker(false)}
            >
              Cancel
            </button>
          </div>
        </>
      )}

     <ChatWidget/>

      {/* Custom CSS for date picker styling */}
      <style>{`
        .custom-calendar {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .react-datepicker {
          border: none !important;
          box-shadow: none !important;
        }
        .react-datepicker__day--selected {
          background-color: #f6ad56 !important;
        }
        .react-datepicker__day--keyboard-selected {
          background-color: #f6ad56 !important;
        }
        .react-datepicker__day:hover {
          background-color: #ffd4a8 !important;
        }
        .react-datepicker__header {
          background-color: #f8fafc !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }
      `}</style>
    </div>
  );
};

export default BrowseTaskers;