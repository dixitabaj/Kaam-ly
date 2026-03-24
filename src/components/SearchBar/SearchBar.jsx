import React, { useState, useRef, useEffect } from "react";
import { getSearchRecommendations, classifyImage, predictTask } from "../../api/api";
import camera from "../../images/camera.png";
import { useNavigate } from "react-router-dom";
import FeedbackNudge from "../FeedbackNudge/FeedbackNudge";

export default function SearchBar({ onItemSelect, onImageClassified }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showCameraMenu, setShowCameraMenu] = useState(false);
  const [classifiedLabel, setClassifiedLabel] = useState(null); // ← new
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);
  const cameraMenuRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimeout = useRef(null);

  // Close dropdown and camera menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedInsideSearch = searchRef.current?.contains(event.target);
      const clickedInsideDropdown = dropdownRef.current?.contains(event.target);
      const clickedInsideCamera = cameraMenuRef.current?.contains(event.target);

      if (!clickedInsideSearch && !clickedInsideDropdown && !clickedInsideCamera) {
        setIsDropdownOpen(false);
        setSelectedIndex(-1);
        setShowCameraMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search input change with debounce
  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedIndex(-1);
    setClassifiedLabel(null); // ← clear nudge when user types again

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    if (value.length < 1) {
      setSuggestions([]);
      setIsDropdownOpen(false);
      return;
    }

    debounceTimeout.current = setTimeout(async () => {
      try {
        setLoading(true);
        setIsDropdownOpen(true);

        const results = await getSearchRecommendations(value);
        const transformedResults = results.map(item => ({
          id: item.id,
          label: item.name,
          category: item.category,
          keywords: item.keywords
        }));

        setSuggestions(transformedResults);
      } catch (err) {
        console.error("Search failed:", err);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  // Select search suggestion
  const handleItemClick = (item) => {
    setQuery(item.label || item.name || query);
    setIsDropdownOpen(false);
    setSelectedIndex(-1);
    setClassifiedLabel(null); // ← clear nudge on selection
    if (onItemSelect) onItemSelect(item);
  };

  // Keyboard navigation
  const handleKeyDown = async (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
      return;
    }
    if (e.key === "Escape") {
      setIsDropdownOpen(false);
      setSelectedIndex(-1);
      return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();

    try {
      setLoading(true);

      if (selectedIndex >= 0 && isDropdownOpen && suggestions[selectedIndex]) {
        handleItemClick(suggestions[selectedIndex]);
        return;
      }

      const prediction = await predictTask(query);
      console.log("FULL RESPONSE RECEIVED:", prediction);

      if (prediction) {
        const storageValue = typeof prediction === 'object'
          ? JSON.stringify(prediction)
          : prediction;
        localStorage.setItem("predictedCategory", storageValue);
      }

      const taskType = prediction?.taskType || prediction?.category || "General";
      handleItemClick({ label: query, category: taskType });

    } catch (err) {
      console.error("API Error in predictTask:", err);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  // Reopen dropdown when focusing/clicking input
  const handleInputFocus = () => {
    if (query.length > 0 && suggestions.length > 0) {
      setIsDropdownOpen(true);
    }
  };

  // Camera menu toggle
  const handleCameraClick = () => {
    setShowCameraMenu(prev => !prev);
  };

  // Take a photo
  const handleTakePhoto = () => {
    setShowCameraMenu(false);
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.click();
    }
  };

  // Upload from device
  const handleUpload = () => {
    setShowCameraMenu(false);
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.click();
    }
  };

  // Handle file selection
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setIsDropdownOpen(false);
      setClassifiedLabel(null); // ← reset before new classification

      const result = await classifyImage(file);
      if (
        result.rejected === true ||
        result.rejected === 'true' ||
        (result.message && result.message.includes("Rejected - Not a Valid Service Image"))
      ) {
        alert("Image doesn't match any service category");
        return;
      }

      let className = '';
      if (result.class_name) {
        className = result.class_name;
      } else if (result.label) {
        if (typeof result.label === 'string') {
          try {
            const parsed = JSON.parse(result.label.replace(/'/g, '"').replace(/False/g, 'false').replace(/True/g, 'true'));
            className = parsed.class_name;
          } catch {
            const match = result.label.match(/'class_name':\s*'([^']+)'/);
            if (match) className = match[1];
          }
        } else if (typeof result.label === 'object' && result.label.class_name) {
          className = result.label.class_name;
        }
      }

      if (!className) {
        alert("Failed to classify image. Please try again.");
        return;
      }

      setQuery(className);
      setClassifiedLabel(className);   // ← show nudge
      onImageClassified?.(className);  // ← lift up to parent if needed

      const searchResults = await getSearchRecommendations(className);
      const transformedResults = searchResults.map(item => ({
        id: item.id,
        label: item.name,
        category: item.category,
        keywords: item.keywords
      }));
      setSuggestions(transformedResults);
      setIsDropdownOpen(true);

    } catch (error) {
      console.error('Image classification failed:', error);
      alert('Failed to classify image. Please try again.');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="search-container" ref={searchRef}>
      <div className="search-box">
        <div className="search-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onFocus={handleInputFocus}
            onClick={handleInputFocus}
            onKeyDown={handleKeyDown}
            placeholder="Search products..."
            className="search-input"
            aria-expanded={isDropdownOpen}
            aria-controls="suggestions-dropdown"
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          <button
            className="clear-button"
            onClick={handleCameraClick}
            aria-label="Camera options"
            disabled={loading}
          >
            {loading ? (
              <div className="loading-spinner-small"></div>
            ) : (
              <img className="cameraImg" src={camera} alt="Camera" />
            )}
          </button>

          {showCameraMenu && !loading && (
            <div className="camera-menu" ref={cameraMenuRef}>
              <button onClick={handleTakePhoto}>Take a Photo</button>
              <button onClick={handleUpload}>Upload from device</button>
            </div>
          )}
        </div>

        {isDropdownOpen && (
          <div id="suggestions-dropdown" className="dropdown" ref={dropdownRef} role="listbox">
            {loading ? (
              <div className="dropdown-loading">
                <div className="loading-spinner"></div>
                {query ? 'Searching...' : 'Processing image...'}
              </div>
            ) : suggestions.length > 0 ? (
              suggestions.map((item, i) => (
                <div
                  key={i}
                  className={`dropdown-item ${i === selectedIndex ? "selected" : ""}`}
                  onClick={() => handleItemClick(item)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  role="option"
                  aria-selected={i === selectedIndex}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && handleItemClick(item)}
                >
                  <div className="item-content">
                    <span className="item-label">{item.label}</span>
                  </div>
                </div>
              ))
            ) : query.length >= 1 ? (
              <div className="dropdown-empty">No products found for "{query}"</div>
            ) : null}
          </div>
        )}

        {/* ← FeedbackNudge appears here, below dropdown, only after image classification */}
        {classifiedLabel && (
          <FeedbackNudge
            message={`We detected "${classifiedLabel}" — does that look right?`}
            onCorrect={() => setClassifiedLabel(null)}
            onWrong={(correction) => {
              console.log('User says it should be:', correction);
              // swap console.log for an API call to log feedback if you want
              setClassifiedLabel(null);
            }}
          />
        )}
      </div>

      <style jsx>{`
        .search-container {
          position: relative;
          width: 100%;
          max-width: 100%;
          margin-top: 50px;
          padding: 0 16px;
        }
        .cameraImg {
          width: 40px;
          height: 40px;
          object-fit: contain;
          pointer-events: none;
        }
        .search-box {
          position: relative;
          width: 100%;
        }
        .search-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
        }
        .search-input {
          width: 100%;
          max-width: 900px;
          padding: 20px 80px 20px 64px;
          font-size: 18px;
          border: 2px solid #e0e0e0;
          border-radius: 12px;
          outline: none;
          box-sizing: border-box;
          background: white;
          height: 64px;
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .search-input:focus {
          border-color: #4a90e2;
          box-shadow: 0 4px 20px rgba(74, 144, 226, 0.15);
        }
        .search-input::placeholder {
          color: #aaa;
        }
        .clear-button {
          position: absolute;
          right: 16px;
          background: none;
          border: none;
          cursor: pointer;
          z-index: 3;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.2s ease;
        }
        .clear-button:hover:not(:disabled) {
          background: #f5f5f5;
        }
        .clear-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .loading-spinner-small {
          width: 32px;
          height: 32px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #4a90e2;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        .camera-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: white;
          border: 2px solid #e0e0e0;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          z-index: 1001;
          overflow: hidden;
          min-width: 220px;
          animation: slideDown 0.2s ease-out;
        }
        .camera-menu button {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 16px 20px;
          background: white;
          border: none;
          cursor: pointer;
          text-align: left;
          font-size: 15px;
          color: #333;
          transition: background 0.2s ease;
        }
        .camera-menu button:hover {
          background-color: #f8fafd;
        }
        .camera-menu button:not(:last-child) {
          border-bottom: 1px solid #f0f0f0;
        }
        .dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          background: white;
          border: 2px solid #e0e0e0;
          border-radius: 12px;
          max-height: 500px;
          overflow-y: auto;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
          z-index: 1000;
        }
        .dropdown-item {
          padding: 18px 24px;
          cursor: pointer;
          border-bottom: 1px solid #f0f0f0;
          transition: background 0.2s ease;
        }
        .dropdown-item:last-child {
          border-bottom: none;
        }
        .dropdown-item.selected,
        .dropdown-item:hover {
          background-color: #f8fafd;
        }
        .dropdown-empty {
          padding: 32px;
          text-align: center;
          color: #666;
        }
        .dropdown-loading {
          padding: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #666;
        }
        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #4a90e2;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}