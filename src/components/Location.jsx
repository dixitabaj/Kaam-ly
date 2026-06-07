import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icon
const customIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to handle map events and center changes
const MapController = ({ position, onPositionChange }) => {
  const map = useMap();

  useMapEvents({
    click(e) {
      onPositionChange([e.latlng.lat, e.latlng.lng]);
    },
    dragend() {
      const center = map.getCenter();
      onPositionChange([center.lat, center.lng]);
    }
  });

  // Update map center when position changes
  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom());
    }
  }, [position, map]);

  return null;
};

// Draggable marker component
const DraggableMarker = ({ position, onPositionChange }) => {
  const markerRef = useRef(null);

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (marker != null) {
        const newPos = marker.getLatLng();
        onPositionChange([newPos.lat, newPos.lng]);
      }
    },
  };

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={customIcon}
    />
  );
};

const LocationPicker = ({ onLocationSelect }) => {
  // Default to Kathmandu, Nepal
  const [position, setPosition] = useState([27.7172, 85.3240]);
  const [locationName, setLocationName] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Reverse geocoding - get address from coordinates
  const getAddressFromCoordinates = async (lat, lng) => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      
      if (data && data.display_name) {
        setLocationName(data.display_name);
        setSearchQuery(data.display_name);
        
        if (onLocationSelect) {
          onLocationSelect({
            lat,
            lng,
            address: data.display_name,
            city: data.address?.city || data.address?.town || data.address?.village || '',
            country: data.address?.country || ''
          });
        }
      }
    } catch (error) {
      console.error('Error getting address:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle position change
  const handlePositionChange = (newPosition) => {
    setPosition(newPosition);
    getAddressFromCoordinates(newPosition[0], newPosition[1]);
  };

  // Get current location
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newPos = [position.coords.latitude, position.coords.longitude];
          setPosition(newPos);
          getAddressFromCoordinates(newPos[0], newPos[1]);
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Unable to get your location. Please check your browser permissions.');
          setLoading(false);
        }
      );
    } else {
      alert('Geolocation is not supported by your browser');
    }
  };

  // Search location by name
  const searchLocation = async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const newPos = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        setPosition(newPos);
        setLocationName(data[0].display_name);
        
        if (onLocationSelect) {
          onLocationSelect({
            lat: newPos[0],
            lng: newPos[1],
            address: data[0].display_name,
            city: data[0].address?.city || data[0].address?.town || '',
            country: data[0].address?.country || ''
          });
        }
      } else {
        alert('Location not found. Please try a different search.');
      }
    } catch (error) {
      console.error('Error searching location:', error);
      alert('Error searching location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.controls}>
        <div style={styles.searchBar}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchLocation()}
            placeholder="Search for a location..."
            style={styles.input}
            disabled={loading}
          />
          <button 
            onClick={searchLocation} 
            style={styles.searchBtn}
            disabled={loading}
          >
             Search
          </button>
        </div>

        <button 
          onClick={getCurrentLocation} 
          style={styles.currentLocationBtn}
          disabled={loading}
        >
           Use My Current Location
        </button>

        {loading && <div style={styles.loadingText}>Loading...</div>}
        
        {locationName && (
          <div style={styles.selectedLocation}>
            <strong>Selected Location:</strong>
            <p style={styles.locationText}>{locationName}</p>
          </div>
        )}
      </div>

      <div style={styles.mapContainer}>
        <MapContainer
          center={position}
          zoom={13}
          style={styles.map}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <DraggableMarker 
            position={position} 
            onPositionChange={handlePositionChange}
          />
          <MapController 
            position={position} 
            onPositionChange={handlePositionChange}
          />
        </MapContainer>
      </div>

      <div style={styles.instructions}>
        <p> <strong>Tip:</strong> Drag the marker or click anywhere on the map to select a location</p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    width: '100%',
    maxWidth: '800px',
    margin: '0 auto',
    fontFamily: 'Arial, sans-serif',
  },
  controls: {
    marginBottom: '16px',
    padding: '16px',
    background: '#f9fafb',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
  },
  searchBar: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  searchBtn: {
    padding: '12px 24px',
    background: '#000',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  currentLocationBtn: {
    width: '100%',
    padding: '12px',
    background: '#F6AD56',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  loadingText: {
    marginTop: '12px',
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '14px',
  },
  selectedLocation: {
    marginTop: '12px',
    padding: '12px',
    background: 'white',
    borderRadius: '8px',
    border: '2px solid #F6AD56',
  },
  locationText: {
    margin: '8px 0 0 0',
    color: '#374151',
    fontSize: '14px',
    lineHeight: '1.5',
  },
  mapContainer: {
    position: 'relative',
    width: '100%',
    height: '500px',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '2px solid #e5e7eb',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    zIndex: '0'

  },
  map: {
    width: '100%',
    height: '100%',
    zIndex: '0'
  },
  instructions: {
    marginTop: '16px',
    padding: '12px',
    background: '#fffbeb',
    border: '1px solid #fbbf24',
    borderRadius: '8px',
    textAlign: 'center',
  },
};

export default LocationPicker;