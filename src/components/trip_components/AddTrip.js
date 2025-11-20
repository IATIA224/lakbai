import React, { useState, useEffect } from 'react';
import { db, auth } from '../../firebase';
import {
  collection,
  query as fsQuery,
  where,
  getDocs,
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import './AddTrip.css';

/**
 * AddTrip Component
 * Handles adding destinations from bookmarks to itineraries
 * Allows users to create new itineraries or add to existing ones
 */
export default function AddTrip({ destination, onClose, onSuccess }) {
  const [itineraries, setItineraries] = useState([]);
  const [selectedItinerary, setSelectedItinerary] = useState(null);
  const [newItineraryName, setNewItineraryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('select'); // 'select' or 'create'
  const [error, setError] = useState('');

  const user = auth.currentUser;

  // Load existing itineraries
  useEffect(() => {
    const loadItineraries = async () => {
      if (!user) return;

      try {
        setLoading(true);
        const q = fsQuery(
          collection(db, 'itineraries'),
          where('userId', '==', user.uid)
        );
        const snap = await getDocs(q);
        const items = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setItineraries(items);
        setError('');
      } catch (err) {
        console.error('Failed to load itineraries:', err);
        setError('Failed to load itineraries');
      } finally {
        setLoading(false);
      }
    };

    loadItineraries();
  }, [user]);

  const handleAddToExisting = async () => {
    if (!user || !selectedItinerary || !destination) {
      setError('Please select an itinerary');
      return;
    }

    setSaving(true);
    try {
      // Create the destination item with all details except comments and ratings
      const destinationItem = {
        id: `${destination.id}_${Date.now()}`,
        destId: destination.id,
        name: destination.name || '',
        region: destination.region || '',
        location: destination.location || '',
        description: destination.description || '',
        lat: destination.lat || destination.latitude || null,
        lon: destination.lon || destination.longitude || null,
        image: destination.image || '',
        price: destination.price || '',
        priceTier: destination.priceTier || null,
        categories: destination.categories || destination.tags || [],
        bestTime: destination.bestTime || '',
        rating: destination.rating || 0,
        tags: destination.tags || [],
        
        // Trip planning fields
        status: 'Upcoming',
        arrival: null,
        departure: null,
        estimatedExpenditure: parseEstimatedFromPrice(
          destination.price || destination.priceTier || destination.estimatedExpenditure
        ),
        
        // Accommodation fields
        accomType: null,
        accomName: null,
        accomNotes: null,
        
        // Transport fields
        transport: null,
        transportNotes: null,
        
        // Activity and notes
        activities: [],
        notes: '',
        
        // Metadata
        addedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Add to the destinations subcollection of the selected itinerary
      const destRef = doc(
        db,
        'itineraries',
        selectedItinerary.id,
        'destinations',
        destinationItem.id
      );

      await setDoc(destRef, destinationItem);

      // Update itinerary's lastUpdated timestamp
      await updateDoc(doc(db, 'itineraries', selectedItinerary.id), {
        updatedAt: serverTimestamp(),
        destinationCount: (selectedItinerary.destinationCount || 0) + 1,
      });

      if (onSuccess) {
        onSuccess({
          itineraryId: selectedItinerary.id,
          itineraryName: selectedItinerary.name,
          destination: destination.name,
        });
      }

      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error('Failed to add to itinerary:', err);
      setError(`Failed to add to itinerary: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNew = async () => {
    if (!user || !newItineraryName.trim() || !destination) {
      setError('Please enter an itinerary name');
      return;
    }

    setSaving(true);
    try {
      // Create new itinerary
      const itineraryRef = await addDoc(collection(db, 'itineraries'), {
        userId: user.uid,
        name: newItineraryName.trim(),
        description: '',
        status: 'Active',
        destinationCount: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create the destination item
      const destinationItem = {
        id: `${destination.id}_${Date.now()}`,
        destId: destination.id,
        name: destination.name || '',
        region: destination.region || '',
        location: destination.location || '',
        description: destination.description || '',
        lat: destination.lat || destination.latitude || null,
        lon: destination.lon || destination.longitude || null,
        image: destination.image || '',
        price: destination.price || '',
        priceTier: destination.priceTier || null,
        categories: destination.categories || destination.tags || [],
        bestTime: destination.bestTime || '',
        rating: destination.rating || 0,
        tags: destination.tags || [],
        
        // Trip planning fields
        status: 'Upcoming',
        arrival: null,
        departure: null,
        estimatedExpenditure: parseEstimatedFromPrice(
          destination.price || destination.priceTier || destination.estimatedExpenditure
        ),
        
        // Accommodation fields
        accomType: null,
        accomName: null,
        accomNotes: null,
        
        // Transport fields
        transport: null,
        transportNotes: null,
        
        // Activity and notes
        activities: [],
        notes: '',
        
        // Metadata
        addedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Add destination to new itinerary
      const destRef = doc(
        db,
        'itineraries',
        itineraryRef.id,
        'destinations',
        destinationItem.id
      );

      await setDoc(destRef, destinationItem);

      if (onSuccess) {
        onSuccess({
          itineraryId: itineraryRef.id,
          itineraryName: newItineraryName,
          destination: destination.name,
          isNew: true,
        });
      }

      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error('Failed to create itinerary:', err);
      setError(`Failed to create itinerary: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'select') {
      await handleAddToExisting();
    } else {
      await handleCreateNew();
    }
  };

  if (!user) {
    return (
      <div className="add-trip-modal-overlay" onClick={onClose}>
        <div className="add-trip-modal" onClick={(e) => e.stopPropagation()}>
          <h2>Please Sign In</h2>
          <p>You need to be signed in to add destinations to your itineraries.</p>
          <button className="add-trip-btn-close" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="add-trip-modal-overlay" onClick={onClose}>
      <div className="add-trip-modal" onClick={(e) => e.stopPropagation()}>
        <button className="add-trip-close-btn" onClick={onClose}>×</button>
        
        <h2 className="add-trip-title">
          Add to Itinerary
        </h2>
        <p className="add-trip-subtitle">
          Adding: <strong>{destination?.name}</strong>
        </p>

        {error && (
          <div className="add-trip-error">
            {error}
          </div>
        )}

        {/* Mode Toggle */}
        <div className="add-trip-mode-toggle">
          <button
            className={`toggle-btn ${mode === 'select' ? 'active' : ''}`}
            onClick={() => {
              setMode('select');
              setError('');
            }}
          >
            Add to Existing
          </button>
          <button
            className={`toggle-btn ${mode === 'create' ? 'active' : ''}`}
            onClick={() => {
              setMode('create');
              setError('');
            }}
          >
            Create New
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'select' ? (
            <div className="add-trip-form-section">
              <label className="add-trip-label">Select Itinerary</label>
              
              {loading ? (
                <div className="add-trip-loading">Loading itineraries...</div>
              ) : itineraries.length === 0 ? (
                <div className="add-trip-empty">
                  <p>No itineraries found.</p>
                  <p style={{ fontSize: '14px', color: '#666' }}>
                    Switch to "Create New" to create your first itinerary.
                  </p>
                </div>
              ) : (
                <div className="add-trip-list">
                  {itineraries.map((itin) => (
                    <label key={itin.id} className="add-trip-option">
                      <input
                        type="radio"
                        name="itinerary"
                        value={itin.id}
                        checked={selectedItinerary?.id === itin.id}
                        onChange={() => setSelectedItinerary(itin)}
                      />
                      <div className="add-trip-option-content">
                        <div className="add-trip-option-name">{itin.name}</div>
                        <div className="add-trip-option-meta">
                          {itin.destinationCount || 0} destination{itin.destinationCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="add-trip-form-section">
              <label className="add-trip-label">Itinerary Name</label>
              <input
                type="text"
                className="add-trip-input"
                placeholder="e.g., Summer 2024 Trip, Asia Adventure"
                value={newItineraryName}
                onChange={(e) => setNewItineraryName(e.target.value)}
                autoFocus
              />
            </div>
          )}

          <div className="add-trip-actions">
            <button
              type="button"
              className="add-trip-btn add-trip-btn-cancel"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="add-trip-btn add-trip-btn-primary"
              disabled={
                saving ||
                (mode === 'select' && !selectedItinerary) ||
                (mode === 'create' && !newItineraryName.trim())
              }
            >
              {saving ? (
                <>
                  <span className="add-trip-spinner"></span>
                  Adding...
                </>
              ) : (
                `Add to ${mode === 'select' ? 'Itinerary' : 'New Itinerary'}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Helper function to parse estimated expenditure from price
 */
function parseEstimatedFromPrice(price) {
  if (price == null) return 0;
  if (typeof price === 'number') return price;
  
  const str = String(price)
    .replace(/\s/g, '')
    .replace(/₱/g, '')
    .replace(/,/g, '');
  
  const nums = str.match(/\d+/g);
  if (!nums || nums.length === 0) return 0;
  
  const numbers = nums.map(Number).filter(Number.isFinite);
  if (numbers.length === 0) return 0;
  
  const sum = numbers.reduce((a, b) => a + b, 0);
  return Math.round(sum / numbers.length);
}