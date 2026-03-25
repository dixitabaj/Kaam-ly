import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { recommendWorker, getPriceByTask } from '../../api/api';
import BookingNavbar from "../../components/Navbar/Navbar";
import ChatWidget from '../../components/HelpSection/HelpSection';

const SUBCATEGORY_TO_MAIN = {
  "ac installation": "appliance repair", "ac repair": "appliance repair",
  "dishwasher repair": "appliance repair", "dryer repair": "appliance repair",
  "oven repair": "appliance repair", "refrigerator repair": "appliance repair",
  "stove repair": "appliance repair", "washer repair": "appliance repair",
  "water heater repair": "appliance repair",
  "equipment assembly": "assembly", "furniture assembly": "assembly", "outdoor assembly": "assembly",
  "furniture repair": "carpentry", "custom built-ins": "carpentry",
  "flooring installation": "carpentry", "trim work": "carpentry", "refinishing": "carpentry",
  "deep cleaning": "cleaning", "house cleaning": "cleaning", "move-in/move-out cleaning": "cleaning",
  "lighting installation": "electrical", "socket repair": "electrical", "switch repair": "electrical",
  "fertilization": "gardening", "lawn mowing": "gardening", "plant care": "gardening",
  "tree trimming": "gardening", "weed control": "gardening",
  "hvac maintenance": "hvac",
  "box moving": "moving", "equipment moving": "moving", "furniture moving": "moving", "specialty moving": "moving",
  "interior": "painting", "exterior": "painting",
  "drain cleaning": "plumbing", "faucet repair": "plumbing", "pipe repair": "plumbing", "toilet repair": "plumbing",
};

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const toMinutes = (str) => {
  if (!str) return 0;
  const [h, m] = str.split(':').map(Number);
  return h * 60 + (m || 0);
};

const TIME_RANGES = {
  morning:   { start: 8 * 60,     end: 12 * 60 },
  afternoon: { start: 12 * 60,    end: 17 * 60 },
  evening:   { start: 17 * 60,    end: 21 * 60 + 30 },
};

const BrowseTaskers = () => {
  const navigate = useNavigate();
  const userAdjustedPrice = useRef(false);

  const [selectedDate, setSelectedDate]   = useState('any');
  const [customDate, setCustomDate]       = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTime, setSelectedTime]   = useState([]);
  const [specificTime, setSpecificTime]   = useState('flexible');
  const [priceRange, setPriceRange]       = useState([0, 99999]);
  const [sortBy, setSortBy]               = useState('recommended');
  const [minPrice, setMinPrice]           = useState(0);
  const [maxPrice, setMaxPrice]           = useState(99999);
  const [hoveredButton, setHoveredButton] = useState(null);
  const [taskers, setTaskers]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [pricesLoaded, setPricesLoaded]   = useState(false);

  /* ── 1. Load workers ─────────────────────────────────────── */
  useEffect(() => {
    const loadWorkers = async () => {
      try {
        setLoading(true);
        const savedTask     = localStorage.getItem('pendingTaskRequest');
        const savedCategory = localStorage.getItem('predictedCategory');
        if (!savedCategory) { console.warn("No predicted category found"); return; }

        const parsedCategory  = JSON.parse(savedCategory);
        const parsedTask      = JSON.parse(savedTask);
        const firstPrediction = parsedCategory.all_predictions?.[0];
        if (!firstPrediction) { console.warn("No predictions available"); return; }

        const normalize    = (s) => (s || "").toLowerCase().trim();
        const subCategory  = normalize(firstPrediction.label);
        const mainCategory = SUBCATEGORY_TO_MAIN[subCategory] || "general";
        const lat          = parsedTask?.lat  || parsedTask?.latitude  || 0;
        const lng          = parsedTask?.lng  || parsedTask?.longitude || 0;

        const response = await recommendWorker({ taskType: mainCategory, lat, lng, subCategory, top_k: 50 });

        const processed = (response || []).map(worker => {
          const matchingSkill = worker.skills?.find(s => normalize(s.name) === subCategory);
          let displayPrice, priceRangeLabel = null;

          if (matchingSkill) {
            displayPrice = matchingSkill.price;
          } else if (worker.skills?.length) {
            const prices = worker.skills.map(s => s.price || 0);
            displayPrice    = Math.min(...prices);
            priceRangeLabel = `${Math.min(...prices)} - ${Math.max(...prices)}`;
          } else {
            displayPrice = worker.basePrice || 0;
          }

          return {
            ...worker,
            displayPrice,
            priceRangeLabel,
            activeSkillName: matchingSkill?.name || worker.skills?.[0]?.name || mainCategory,
          };
        });

        setTaskers(processed);

        if (processed.length > 0 && !userAdjustedPrice.current) {
          const prices = processed.map(w => w.displayPrice || 0).filter(p => p > 0);
          if (prices.length) {
            const minP = Math.min(...prices);
            const maxP = Math.max(...prices) + 50;
            setMinPrice(minP);
            setMaxPrice(maxP);
            setPriceRange([minP, maxP]);
          }
        }
      } catch (err) {
        console.error("Error loading workers:", err);
      } finally {
        setLoading(false);
      }
    };
    loadWorkers();
  }, []);

  /* ── 2. Fetch per-worker prices ONCE after initial load ──── */
  const pricesFetchedRef = useRef(false);

  useEffect(() => {
    if (taskers.length === 0 || pricesFetchedRef.current) return;
    pricesFetchedRef.current = true; // ← set immediately, before async call

    const fetchPrices = async () => {
      try {
        const savedCategory = localStorage.getItem("predictedCategory");
        if (!savedCategory) return;
        const categoryObj = JSON.parse(savedCategory);
        const taskName = categoryObj?.all_predictions?.[0]?.label || categoryObj?.predicted_label || "General";

        const updated = await Promise.all(
          taskers.map(async (worker) => {
            try {
              const priceData = await getPriceByTask(taskName, worker._id);
              const newPrice = priceData?.price;
              return { ...worker, displayPrice: (newPrice && newPrice > 0) ? newPrice : worker.displayPrice };
            } catch {
              return worker;
            }
          })
        );

        setTaskers(updated);

        if (!userAdjustedPrice.current) {
          const prices = updated.map(w => w.displayPrice || 0).filter(p => p > 0);
          if (prices.length) {
            const minP = Math.min(...prices);
            const maxP = Math.max(...prices) + 50;
            setMinPrice(minP);
            setMaxPrice(maxP);
            setPriceRange([minP, maxP]);
          }
        }
      } catch (err) {
        console.error("Error fetching prices:", err);
      }
    };

    fetchPrices();
  }, [taskers.length]); // ← remove pricesLoaded from deps entirely

  /* ── Filter + sort ───────────────────────────────────────── */
  const getFilteredAndSortedTaskers = () => {
    let filtered = [...taskers];

    // 1. Price
    filtered = filtered.filter(t => {
      const p = t.displayPrice ?? 0;
      return p >= priceRange[0] && p <= priceRange[1];
    });

    // 2. Date
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const availableOn = (worker, date) => {
      if (!worker.hours) return true;
      const slots = worker.hours[DAY_NAMES[date.getDay()]];
      return Array.isArray(slots) && slots.length > 0;
    };

    if (selectedDate === 'today') {
      filtered = filtered.filter(t => availableOn(t, today));
    } else if (selectedDate === 'within3') {
      filtered = filtered.filter(t =>
        [0,1,2].some(i => { const d = new Date(today); d.setDate(today.getDate()+i); return availableOn(t,d); })
      );
    } else if (selectedDate === 'week') {
      filtered = filtered.filter(t =>
        [0,1,2,3,4,5,6].some(i => { const d = new Date(today); d.setDate(today.getDate()+i); return availableOn(t,d); })
      );
    } else if (selectedDate === 'choose' && customDate) {
      filtered = filtered.filter(t => availableOn(t, customDate));
    }

    // 3. Time of day
    if (selectedTime.length > 0) {
      const refDay = DAY_NAMES[(customDate || today).getDay()];
      filtered = filtered.filter(t => {
        if (!t.hours) return true;
        const slots = t.hours[refDay];
        if (!Array.isArray(slots)) return true;
        return selectedTime.some(slotName => {
          const range = TIME_RANGES[slotName];
          return slots.some(slot => {
            const s = toMinutes(slot.start);
            const e = toMinutes(slot.end);
            return s < range.end && e > range.start;
          });
        });
      });
    }

    // 4. Specific time
    if (specificTime !== 'flexible') {
      const target = toMinutes(specificTime);
      const refDay = DAY_NAMES[(customDate || today).getDay()];
      filtered = filtered.filter(t => {
        if (!t.hours) return true;
        const slots = t.hours[refDay];
        if (!Array.isArray(slots)) return true;
        return slots.some(slot => target >= toMinutes(slot.start) && target < toMinutes(slot.end));
      });
    }

    // 5. Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':  return (a.displayPrice||0) - (b.displayPrice||0);
        case 'price-high': return (b.displayPrice||0) - (a.displayPrice||0);
        case 'rating':     return (b.ratings||0) - (a.ratings||0);
        case 'reviews':    return (b.noOfCompletedTask||0) - (a.noOfCompletedTask||0);
        default:           return 0;
      }
    });

    return filtered;
  };

  const filteredTaskers = getFilteredAndSortedTaskers();

  const averagePrice = filteredTaskers.length > 0
    ? Math.round(filteredTaskers.reduce((sum, t) => sum + (t.displayPrice||0), 0) / filteredTaskers.length)
    : 0;

  /* ── Handlers ────────────────────────────────────────────── */
  const handleTimeToggle = (time) =>
    setSelectedTime(prev => prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]);

  const handleChooseDates = () => { setSelectedDate('choose'); setShowDatePicker(true); };
  const handleDateChange  = (date) => { setCustomDate(date); setShowDatePicker(false); };

  const handleTaskerSelect = (taskerId) => {
    const t = filteredTaskers.find(t => t._id === taskerId);
    if (!t) return;
    const workerData = {
      id: t._id, firstName: t.firstName, lastName: t.lastName,
      name: `${t.firstName} ${t.lastName}`, rating: t.ratings,
      reviews: t.noOfCompletedTask, hourlyRate: t.displayPrice,
      minHours: t.minHours || 1, taskType: t.taskType,
      description: t.description, profilePhoto: t.profilePhoto,
      address: t.address,
      avatar: `${t.firstName?.[0]}${t.lastName?.[0]}`.toUpperCase(),
    };
    localStorage.setItem('selectedWorker', JSON.stringify(workerData));
    navigate('/taskDescription', { state: workerData });
  };

  const handleViewProfile  = (id) => navigate(`/workers/${encodeURIComponent(id)}`);

  const handleSendMessage = (taskerId) => {
    const user   = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user.id || user._id;
    navigate(`/chat/${encodeURIComponent(userId)}/${encodeURIComponent(taskerId)}`);
  };

  /* ── Styles ──────────────────────────────────────────────── */
  const styles = {
    container:        { minHeight: '100vh', background: '#FFFDF2', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#333' },
    content:          { display: 'flex', gap: '24px', padding: '24px', maxWidth: '1200px', margin: '0 auto' },
    sidebar:          { flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: '24px' },
    filterSection:    { background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e8e8e8' },
    filterTitle:      { fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#2d3748', textTransform: 'uppercase', letterSpacing: '0.5px' },
    dateButtonGroup:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' },
    filterButton:     { padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#f9fafb', fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s', color: '#4b5563' },
    filterButtonActive: { background: '#f6ad56', color: 'white', border: 'none', fontSize: '14px', fontWeight: '500' },
    checkboxLabel:    { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', fontSize: '14px', color: '#4a5568', cursor: 'pointer' },
    checkbox:         { width: '16px', height: '16px', cursor: 'pointer', accentColor: '#f6ad56' },
    dividerText:      { textAlign: 'center', fontSize: '13px', color: '#718096', margin: '12px 0', position: 'relative' },
    dividerTextLine:  { position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: '#e2e8f0', zIndex: 1 },
    dividerTextContent: { position: 'relative', zIndex: 2, background: '#fff', padding: '0 10px' },
    select:           { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', background: 'white', cursor: 'pointer', color: '#4a5568' },
    priceChart:       { display: 'flex', alignItems: 'flex-end', gap: '4px', height: '50px', marginBottom: '16px' },
    priceBar:         { flex: 1, background: '#f6ad56', borderRadius: '2px', opacity: 0.7 },
    slider:           { width: '100%', marginBottom: '8px', cursor: 'pointer', accentColor: '#f6ad56' },
    priceLabels:      { display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '500', color: '#f6ad56', marginBottom: '8px' },
    averagePrice:     { fontSize: '12px', color: '#718096', textAlign: 'center' },
    mainContent:      { flex: 1 },
    sortHeader:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' },
    resultsCount:     { fontSize: '16px', fontWeight: '600', color: '#2d3748' },
    sortLabel:        { fontSize: '14px', fontWeight: '500', color: '#4a5568' },
    sortSelect:       { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', background: 'white', minWidth: '180px', cursor: 'pointer', color: '#4a5568' },
    taskerList:       { display: 'flex', flexDirection: 'column', gap: '20px' },
    taskerCard:       { background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #edf2f7', display: 'flex', flexDirection: 'column', gap: '16px' },
    cardHeader:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
    taskerInfo:       { display: 'flex', gap: '16px' },
    avatarContainer:  { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
    avatar:           { width: '64px', height: '64px', borderRadius: '50%', background: 'rgb(246,173,86)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '600', flexShrink: 0 },
    viewProfileBtn:   { background: 'none', border: 'none', color: 'black', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: '4px 8px', textDecoration: 'underline', textUnderlineOffset: '2px', whiteSpace: 'nowrap' },
    taskerDetails:    { display: 'flex', flexDirection: 'column', gap: '6px' },
    taskerNameRow:    { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
    taskerName:       { fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: 0 },
    eliteBadge:       { background: 'rgb(246,173,86)', color: 'white', padding: '4px 10px', borderRadius: '16px', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' },
    minHoursBadge:    { background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '16px', fontSize: '11px', fontWeight: '600' },
    ratingContainer:  { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' },
    stars:            { display: 'flex', alignItems: 'center', gap: '2px' },
    starFilled:       { color: '#FFB800', fontSize: '14px' },
    starEmpty:        { color: '#e2e8f0', fontSize: '14px' },
    priceRow:         { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' },
    price:            { fontSize: '18px', fontWeight: '700', color: '#0f172a' },
    priceUnit:        { fontSize: '14px', color: '#64748b' },
    reviewSection:    { background: '#F8FAFD', padding: '16px', borderRadius: '12px', marginTop: '8px', marginBottom: '10px', marginLeft: '100px' },
    reviewHeader:     { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
    reviewIcon:       { width: '28px', height: '28px', borderRadius: '50%', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#475569' },
    reviewText:       { fontSize: '14px', color: '#475569', lineHeight: '1.5', margin: 0, fontStyle: 'italic' },
    reviewService:    { fontSize: '13px', color: '#94a3b8', marginTop: '6px' },
    actionButtons:    { display: 'flex', gap: '20px', alignItems: 'center', marginLeft: '100px' },
    sendRequestBtn:   { padding: '12px 22px', background: 'rgb(246,173,86)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
    chatNowBtn:       { padding: '12px 22px', background: 'white', color: 'rgb(246,173,86)', border: '1px solid rgb(246,173,86)', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
    selectedDateDisplay: { marginTop: '12px', padding: '10px', background: '#f8fafc', borderRadius: '6px', fontSize: '14px', color: '#475569', textAlign: 'center' },
    datePickerContainer: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', zIndex: 1000 },
  };

  const renderStars = (rating) => {
    const r     = rating || 0;
    const full  = Math.floor(r);
    const half  = r % 1 >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);
    return (
      <span style={styles.stars}>
        {[...Array(full)].map((_,i)  => <span key={`f${i}`} style={styles.starFilled}>★</span>)}
        {half                         && <span style={styles.starFilled}>½</span>}
        {[...Array(empty)].map((_,i) => <span key={`e${i}`} style={styles.starEmpty}>★</span>)}
      </span>
    );
  };

  /* ── JSX ─────────────────────────────────────────────────── */
  return (
    <div style={styles.container}>
      <BookingNavbar />
      <div style={styles.content}>

        {/* Sidebar */}
        <div style={styles.sidebar}>

          {/* Date */}
          <div style={styles.filterSection}>
            <h3 style={styles.filterTitle}>Date</h3>
            <div style={styles.dateButtonGroup}>
              <button style={{...styles.filterButton,...(selectedDate==='any'?styles.filterButtonActive:{})}} onClick={()=>{setSelectedDate('any');setCustomDate(null);}}>Any Day</button>
              <button style={{...styles.filterButton,...(selectedDate==='today'?styles.filterButtonActive:{})}} onClick={()=>{setSelectedDate('today');setCustomDate(null);}}>Today</button>
            </div>
            <div style={styles.dateButtonGroup}>
              <button style={{...styles.filterButton,...(selectedDate==='within3'?styles.filterButtonActive:{})}} onClick={()=>{setSelectedDate('within3');setCustomDate(null);}}>Within 3 Days</button>
              <button style={{...styles.filterButton,...(selectedDate==='week'?styles.filterButtonActive:{})}} onClick={()=>{setSelectedDate('week');setCustomDate(null);}}>Within A Week</button>
            </div>
            <button style={{...styles.filterButton,width:'100%',marginTop:'4px',...(selectedDate==='choose'?styles.filterButtonActive:{})}} onClick={handleChooseDates}>Choose Date</button>
            {selectedDate==='choose' && customDate && (
              <div style={styles.selectedDateDisplay}>
                {customDate.toLocaleDateString('en-US',{weekday:'short',year:'numeric',month:'short',day:'numeric'})}
              </div>
            )}
          </div>

          {/* Time of day */}
          <div style={styles.filterSection}>
            <h3 style={styles.filterTitle}>Time of Day</h3>
            {[['morning','Morning (8am – 12pm)'],['afternoon','Afternoon (12pm – 5pm)'],['evening','Evening (5pm – 9:30pm)']].map(([val,label])=>(
              <label key={val} style={styles.checkboxLabel}>
                <input type="checkbox" checked={selectedTime.includes(val)} onChange={()=>handleTimeToggle(val)} style={styles.checkbox}/>
                <span>{label}</span>
              </label>
            ))}
            <div style={styles.dividerText}>
              <div style={styles.dividerTextLine}/>
              <div style={styles.dividerTextContent}>or choose a specific time</div>
            </div>
            <select style={styles.select} value={specificTime} onChange={e=>setSpecificTime(e.target.value)}>
              <option value="flexible">I'm Flexible</option>
              <option value="9:00">9:00 AM</option>
              <option value="10:00">10:00 AM</option>
              <option value="11:00">11:00 AM</option>
              <option value="12:00">12:00 PM</option>
              <option value="13:00">1:00 PM</option>
              <option value="14:00">2:00 PM</option>
            </select>
          </div>

          {/* Price */}
          <div style={styles.filterSection}>
            <h3 style={styles.filterTitle}>Price</h3>
            <div style={styles.priceChart}>
              {[20,35,45,60,50,40,25,15,10,8].map((h,i)=>(
                <div key={i} style={{...styles.priceBar,height:`${h}%`,opacity:i>=2&&i<=7?0.9:0.3}}/>
              ))}
            </div>
            <label style={{fontSize:'12px',color:'#718096'}}>Min: NPR {priceRange[0]}</label>
            <input
              type="range" min={minPrice} max={maxPrice} value={priceRange[0]}
              onChange={e=>{
                userAdjustedPrice.current=true;
                const val=parseInt(e.target.value);
                if(val<priceRange[1]-10) setPriceRange([val,priceRange[1]]);
              }}
              style={styles.slider}
            />
            <label style={{fontSize:'12px',color:'#718096'}}>Max: NPR {priceRange[1]}</label>
            <input
              type="range" min={minPrice} max={maxPrice} value={priceRange[1]}
              onChange={e=>{
                userAdjustedPrice.current=true;
                const val=parseInt(e.target.value);
                if(val>priceRange[0]+10) setPriceRange([priceRange[0],val]);
              }}
              style={styles.slider}
            />
            <div style={styles.priceLabels}>
              <span>NPR {priceRange[0]}</span>
              <span>NPR {priceRange[1]}+</span>
            </div>
            <div style={styles.averagePrice}>Average rate: <strong>NPR {averagePrice}/hr</strong></div>
          </div>

        </div>

        {/* Main list */}
        <div style={styles.mainContent}>
          <div style={styles.sortHeader}>
            <span style={styles.resultsCount}>{filteredTaskers.length} tasker{filteredTaskers.length!==1?'s':''} available</span>
            <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
              <span style={styles.sortLabel}>Sorted by:</span>
              <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={styles.sortSelect}>
                <option value="recommended">Recommended</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
                <option value="reviews">Most Reviews</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{textAlign:'center',padding:'48px'}}>
              <span style={{fontSize:'24px'}}>⏳</span>
              <p style={{color:'#718096',marginTop:'12px'}}>Loading taskers...</p>
            </div>
          ) : (
            <div style={styles.taskerList}>
              {filteredTaskers.length > 0 ? filteredTaskers.map((tasker, index) => (
                <div key={`${tasker._id}-${index}`} style={styles.taskerCard}>

                  <div style={styles.cardHeader}>
                    <div style={styles.taskerInfo}>
                      <div style={styles.avatarContainer}>
                        <div style={styles.avatar}>{tasker.firstName?.[0]}{tasker.lastName?.[0]}</div>
                        <button style={styles.viewProfileBtn} onClick={()=>handleViewProfile(tasker._id)}>View Profile</button>
                      </div>
                      <div style={styles.taskerDetails}>
                        <div style={styles.taskerNameRow}>
                          <h3 style={styles.taskerName}>{tasker.firstName} {tasker.lastName}</h3>
                          {tasker.ratings>=4.5 && <span style={styles.eliteBadge}>ELITE</span>}
                          <span style={styles.minHoursBadge}>{tasker.minHours||1}hr min</span>
                        </div>
                        <div style={{fontSize:'14px',color:'#475569',marginTop:'4px'}}>📍 {tasker.address||'Location not specified'}</div>
                        <div style={styles.ratingContainer}>
                          {renderStars(tasker.ratings)}
                          <span style={{fontSize:'14px',fontWeight:'600',color:'#0f172a'}}>{(tasker.ratings||0).toFixed(1)}</span>
                          <span style={{fontSize:'13px',color:'#64748b'}}>({tasker.noOfCompletedTask||0} reviews)</span>
                        </div>
                      </div>
                    </div>
                    <div style={styles.priceRow}>
                      <span style={styles.price}>Rs. {tasker.displayPrice}</span>
                      <span style={styles.priceUnit}>/hr</span>
                    </div>
                  </div>

                  <div style={styles.reviewSection}>
                    <div style={styles.reviewHeader}>
                      <div style={styles.reviewIcon}>💬</div>
                      <span style={{fontSize:'14px',fontWeight:'600',color:'#0f172a'}}>{tasker.activeSkillName||tasker.taskType||'Service provider'}</span>
                    </div>
                    <p style={styles.reviewText}>"{tasker.description||'Professional and reliable service.'}"</p>
                    <div style={styles.reviewService}>🔧 Service: {tasker.taskType||'General'}</div>
                  </div>

                  <div style={styles.actionButtons}>
                    <button
                      style={{...styles.sendRequestBtn,...(hoveredButton===`send-${tasker._id}`?{background:'#e09535'}:{})}}
                      onClick={()=>handleTaskerSelect(tasker._id)}
                      onMouseEnter={()=>setHoveredButton(`send-${tasker._id}`)}
                      onMouseLeave={()=>setHoveredButton(null)}
                    >Send Request</button>
                    <button
                      style={{...styles.chatNowBtn,...(hoveredButton===`chat-${tasker._id}`?{background:'#FFF1EB',borderColor:'#e09535',color:'#e09535'}:{})}}
                      onClick={()=>handleSendMessage(tasker._id)}
                      onMouseEnter={()=>setHoveredButton(`chat-${tasker._id}`)}
                      onMouseLeave={()=>setHoveredButton(null)}
                    >Chat Now</button>
                  </div>

                </div>
              )) : (
                <div style={{textAlign:'center',padding:'48px',background:'white',borderRadius:'12px',border:'1px solid #e8e8e8'}}>
                  <span style={{fontSize:'48px',display:'block',marginBottom:'16px'}}>🔍</span>
                  <h3 style={{color:'#2d3748',marginBottom:'8px'}}>No taskers found</h3>
                  <p style={{color:'#718096'}}>Try adjusting your filters</p>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {showDatePicker && (
        <>
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',zIndex:999}} onClick={()=>setShowDatePicker(false)}/>
          <div style={styles.datePickerContainer}>
            <h4 style={{margin:'0 0 16px 0',fontSize:'16px',fontWeight:'600'}}>Select a Date</h4>
            <DatePicker selected={customDate} onChange={handleDateChange} inline minDate={new Date()} calendarClassName="custom-calendar"/>
            <button style={{width:'100%',marginTop:'12px',padding:'10px',background:'#f6ad56',color:'white',border:'none',borderRadius:'6px',fontSize:'14px',fontWeight:'600',cursor:'pointer'}} onClick={()=>setShowDatePicker(false)}>Cancel</button>
          </div>
        </>
      )}

      <ChatWidget />

      <style>{`
        .react-datepicker { border: none !important; box-shadow: none !important; }
        .react-datepicker__day--selected,
        .react-datepicker__day--keyboard-selected { background-color: #f6ad56 !important; }
        .react-datepicker__day:hover { background-color: #ffd4a8 !important; }
        .react-datepicker__header { background-color: #f8fafc !important; border-bottom: 1px solid #e2e8f0 !important; }
      `}</style>
    </div>
  );
};

export default BrowseTaskers;