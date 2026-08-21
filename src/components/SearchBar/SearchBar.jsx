import React, { useState, useRef, useEffect } from "react";
import { getSearchRecommendations, classifyImage, predictTask } from "../../api/api";
import camera from "../../images/camera.png";
import { useNavigate } from "react-router-dom";
import FeedbackNudge from "../FeedbackNudge/FeedbackNudge";
import "./SearchBar.css";

// ── Gibberish detection helper ─────────────────────────────────────────────
const isGibberish = (text) => {
  const trimmed = text.trim();
  if (!trimmed) return false; // handled separately as "empty"

  const hasLetter = /[a-zA-Z]/.test(trimmed);
  const hasVowel = /[aeiouAEIOU]/.test(trimmed);
  const consonantClusters = trimmed.match(/[^aeiou\s]{5,}/gi) || [];
  const clusterRatio = consonantClusters.join("").length / trimmed.length;

  if (!hasLetter) return true;                              // e.g. "12345", "!!!"
  if (!hasVowel && trimmed.length > 3) return true;        // e.g. "xzqwrt", "asdfgh"
  if (clusterRatio > 0.6 && trimmed.length > 4) return true; // heavy consonant clusters
  return false;
};
// ──────────────────────────────────────────────────────────────────────────

export default function SearchBar({ onItemSelect, onImageClassified }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showCameraMenu, setShowCameraMenu] = useState(false);
  const [classifiedLabel, setClassifiedLabel] = useState(null);
  const [inputError, setInputError] = useState(null); // ← new error state

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
    setClassifiedLabel(null);
    setInputError(null); // ← clear error whenever user types

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
  const handleItemClick = async (item) => {
    const displayValue = item.label || item.name || query;

    setQuery(displayValue);
    setIsDropdownOpen(false);
    setSelectedIndex(-1);
    setClassifiedLabel(null);
    setInputError(null); // ← clear error on item select

    try {
      const prediction = await predictTask(displayValue);

      localStorage.setItem(
        "predictedCategory",
        JSON.stringify({
          predicted_label: prediction?.predicted_label || displayValue,
          text: displayValue,
          all_predictions: prediction?.all_predictions || [{ label: displayValue, confidence: "manual" }]
        })
      );
    } catch (err) {
      console.error("predictTask failed on item click:", err);
      localStorage.setItem(
        "predictedCategory",
        JSON.stringify({
          predicted_label: displayValue,
          text: displayValue,
          all_predictions: [{ label: displayValue, confidence: "manual" }]
        })
      );
    }

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

    // ── Validation ────────────────────────────────────────
    if (!query.trim()) {
      setInputError("Please enter a search term.");
      return;
    }
    if (isGibberish(query)) {
      setInputError("Please enter a valid product or service name.");
      return;
    }
    setInputError(null);
    // ──────────────────────────────────────────────────────

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
      setClassifiedLabel(null);
      setInputError(null);

      const result = await classifyImage(file);
      console.log("Raw classification result:", result);

      // ── Parse the result correctly ─────────────────────────────────────────
      let parsedResult = result;

      // If result has a 'label' field that's a string, parse it
      if (result.label && typeof result.label === 'string') {
        try {
          // Replace Python-style quotes with JSON quotes
          const jsonStr = result.label
            .replace(/'/g, '"')
            .replace(/False/g, 'false')
            .replace(/True/g, 'true');
          parsedResult = JSON.parse(jsonStr);
          console.log("Parsed result:", parsedResult);
        } catch (parseError) {
          console.error("Failed to parse result:", parseError);
          // Try regex extraction as fallback
          const classMatch = result.label.match(/'class_name':\s*'([^']+)'/);
          const rejectedMatch = result.label.match(/'rejected':\s*(True|False)/i);
          const confMatch = result.label.match(/'confidence':\s*([0-9.]+)/);
          if (classMatch) {
            parsedResult = {
              class_name: classMatch[1],
              rejected: rejectedMatch ? rejectedMatch[1] === 'True' : false,
              confidence: confMatch ? parseFloat(confMatch[1]) : 0
            };
          }
        }
      }

      // ── CHECK REJECTION PROPERLY ──────────────────────────────────────────
      const isRejected = parsedResult.rejected === true ||
                         parsedResult.rejected === 'true' ||
                         parsedResult.class_name === "Couldn't Classify" ||
                         parsedResult.class_index === -1;

      if (isRejected) {
        let errorMessage = "Couldn't classify this image. Please use the search bar.";

        // Check for specific rejection reasons
        if (parsedResult.rejection_reason === "image_quality_check") {
          errorMessage = "Image quality too low. Please upload a clearer photo of the service issue.";
        } else if (parsedResult.rejection_reason === "low_confidence") {
          errorMessage = "Could not identify the service with confidence. Please use the search bar or upload a clearer photo.";
        } else if (parsedResult.message) {
          errorMessage = parsedResult.message;
        }

        setQuery("");
        setInputError(errorMessage);
        setClassifiedLabel(null);
        setSuggestions([]);
        setIsDropdownOpen(false);
        return;
      }

      // ── Get the classified service name ────────────────────────────────────
      let className = parsedResult.class_name;

      // Also check top_predictions if available
      if (!className && parsedResult.top_predictions && parsedResult.top_predictions.length > 0) {
        className = parsedResult.top_predictions[0].class_name;
      }

      if (!className || className === "Couldn't Classify") {
        setQuery("");
        setInputError("Could not identify the service. Please use the search bar.");
        return;
      }

      // ── SUCCESS - Set the classified service ───────────────────────────────
      setQuery(className);
      setClassifiedLabel(className);
      setInputError(null);

      // Notify parent component
      if (onImageClassified) {
        onImageClassified(className);
      }

      // Get search recommendations for the classified service
      const searchResults = await getSearchRecommendations(className);
      const transformedResults = searchResults.map(item => ({
        id: item.id,
        label: item.name,
        category: item.category,
        keywords: item.keywords
      }));
      setSuggestions(transformedResults);
      setIsDropdownOpen(true);

      // Optional: Show success feedback
      const confidence = parsedResult.confidence ? Math.round(parsedResult.confidence * 100) : null;
      if (confidence) {
        console.log(`✅ Classified as: ${className} (${confidence}% confidence)`);
      }

    } catch (error) {
      console.error('Image classification failed:', error);
      setQuery("");
      setInputError("Failed to analyze image. Please use the search bar or try again.");
      setSuggestions([]);
      setIsDropdownOpen(false);
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
            placeholder="Search services..."
            className={`search-input${inputError ? " search-input--error" : ""}`}
            aria-expanded={isDropdownOpen}
            aria-controls="suggestions-dropdown"
            aria-describedby={inputError ? "search-error" : undefined}
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
            </div>
          )}
        </div>

        {/* ── Error message ─────────────────────────────── */}
        {inputError && (
          <div id="search-error" className="input-error" role="alert">
            <span className="input-error__icon">!</span>
            {inputError}
          </div>
        )}
        {/* ─────────────────────────────────────────────── */}

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
      </div>
    </div>
  );
}