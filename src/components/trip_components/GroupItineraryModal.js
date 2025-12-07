import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { db, auth } from "../../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import "./GroupItineraryModal.css";

// Hook to fetch grouped itineraries
export function useGroupedItineraries(userId) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const groupsRef = collection(db, "itinerary", userId, "groups");
    const q = query(groupsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const groupList = [];
        snapshot.forEach((doc) => {
          groupList.push({ id: doc.id, ...doc.data() });
        });
        setGroups(groupList);
        setLoading(false);
      },
      (error) => {
        console.error("[useGroupedItineraries] Error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { groups, loading };
}

function GroupItineraryModal({ open, onClose, onSave, group, allDestinations }) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedDestinations, setSelectedDestinations] = useState([]);
  // FIX: assignments maps itemId -> dayIndex (0-based)
  const [assignments, setAssignments] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Initialize form when editing
  useEffect(() => {
    if (group) {
      setName(group.name || "");
      setStartDate(group.startDate || "");
      setEndDate(group.endDate || "");
      setSelectedDestinations(Object.keys(group.assignments || {}));
      setAssignments(group.assignments || {});
    } else {
      setName("");
      setStartDate("");
      setEndDate("");
      setSelectedDestinations([]);
      setAssignments({});
    }
  }, [group, open]);

  // Calculate number of days
  const getDayCount = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const dayCount = getDayCount();

  // Get date for a specific day index
  const getDateForDay = (dayIndex) => {
    if (!startDate) return "";
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayIndex);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Toggle destination selection
  const toggleDestination = (destId) => {
    setSelectedDestinations(prev => {
      if (prev.includes(destId)) {
        // Remove from selections and assignments
        const newAssignments = { ...assignments };
        delete newAssignments[destId];
        setAssignments(newAssignments);
        return prev.filter(id => id !== destId);
      } else {
        return [...prev, destId];
      }
    });
  };

  // FIX: Assign destination to a day (dayIndex is 0-based)
  const assignToDay = (destId, dayIndex) => {
    console.log(`[GroupItineraryModal] Assigning ${destId} to day ${dayIndex}`);
    setAssignments(prev => ({
      ...prev,
      [destId]: dayIndex // Store the 0-based index
    }));
  };

  // Remove from day assignment
  const removeFromDay = (destId) => {
    setAssignments(prev => {
      const newAssignments = { ...assignments };
      delete newAssignments[destId];
      return newAssignments;
    });
  };

  // Get destinations assigned to a specific day
  const getDestinationsForDay = (dayIndex) => {
    return Object.entries(assignments)
      .filter(([_, day]) => Number(day) === Number(dayIndex))
      .map(([destId]) => allDestinations.find(d => d.id === destId))
      .filter(Boolean);
  };

  // Get unassigned selected destinations
  const getUnassignedDestinations = () => {
    return selectedDestinations
      .filter(id => assignments[id] === undefined)
      .map(id => allDestinations.find(d => d.id === id))
      .filter(Boolean);
  };

  // Handle save
  const handleSave = async () => {
    if (!name.trim()) {
      setError("Please enter a trip name");
      return;
    }
    if (!startDate || !endDate) {
      setError("Please select start and end dates");
      return;
    }
    if (selectedDestinations.length === 0) {
      setError("Please select at least one destination");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const groupData = {
        name: name.trim(),
        startDate,
        endDate,
        assignments, // This stores itemId -> dayIndex (0-based)
        updatedAt: serverTimestamp(),
      };

      console.log("[GroupItineraryModal] Saving group:", groupData);

      if (group) {
        // Update existing group
        const groupRef = doc(db, "itinerary", user.uid, "groups", group.id);
        await updateDoc(groupRef, groupData);
      } else {
        // Create new group
        await addDoc(collection(db, "itinerary", user.uid, "groups"), {
          ...groupData,
          createdAt: serverTimestamp(),
        });
      }

      onClose();
    } catch (err) {
      console.error("[GroupItineraryModal] Save error:", err);
      setError("Failed to save group. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Handle delete group
  const handleDelete = async () => {
    if (!group) return;
    
    const confirmed = window.confirm("Are you sure you want to delete this trip group? The destinations will not be deleted.");
    if (!confirmed) return;

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      await deleteDoc(doc(db, "itinerary", user.uid, "groups", group.id));
      onClose();
    } catch (err) {
      console.error("[GroupItineraryModal] Delete error:", err);
      setError("Failed to delete group.");
    }
  };

  if (!open) return null;

  const modalContent = (
    <div className="group-modal-backdrop" onClick={onClose}>
      <div className="group-modal" onClick={(e) => e.stopPropagation()}>
        <div className="group-modal-header">
          <h2>{group ? "Edit Trip Group" : "Create Trip Group"}</h2>
          <button className="group-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="group-modal-body">
          {error && <div className="group-modal-error">{error}</div>}

          {/* Trip Name */}
          <div className="group-modal-field">
            <label>Trip Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Summer Vacation 2025"
            />
          </div>

          {/* Date Range */}
          <div className="group-modal-dates">
            <div className="group-modal-field">
              <label>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="group-modal-field">
              <label>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
              />
            </div>
          </div>

          {dayCount > 0 && (
            <div className="group-modal-days-info">
              📅 {dayCount} day{dayCount !== 1 ? 's' : ''} trip
            </div>
          )}

          {/* Destination Selection */}
          <div className="group-modal-section">
            <h3>Select Destinations</h3>
            <div className="group-modal-destinations">
              {allDestinations.map((dest) => (
                <label key={dest.id} className="group-destination-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedDestinations.includes(dest.id)}
                    onChange={() => toggleDestination(dest.id)}
                  />
                  <span className="group-destination-name">{dest.name}</span>
                  <span className="group-destination-region">{dest.region}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Day Assignment */}
          {dayCount > 0 && selectedDestinations.length > 0 && (
            <div className="group-modal-section">
              <h3>Assign each destination to a specific day</h3>
              
              <div className="group-days-grid">
                {Array.from({ length: dayCount }, (_, dayIndex) => (
                  <div key={dayIndex} className="group-day-column">
                    <div className="group-day-header">
                      <strong>Day {dayIndex + 1}</strong>
                      <span className="group-day-date">{getDateForDay(dayIndex)}</span>
                    </div>
                    <div className="group-day-destinations">
                      {getDestinationsForDay(dayIndex).map((dest) => (
                        <div key={dest.id} className="group-day-destination">
                          <span>{dest.name}</span>
                          <button 
                            className="group-day-remove"
                            onClick={() => removeFromDay(dest.id)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Unassigned destinations */}
              {getUnassignedDestinations().length > 0 && (
                <div className="group-unassigned">
                  <h4>Unassigned Destinations</h4>
                  <p className="group-unassigned-hint">
                    Click on a day column above to assign, or drag destinations
                  </p>
                  <div className="group-unassigned-list">
                    {getUnassignedDestinations().map((dest) => (
                      <div key={dest.id} className="group-unassigned-item">
                        <span>{dest.name}</span>
                        <div className="group-assign-buttons">
                          {Array.from({ length: Math.min(dayCount, 7) }, (_, i) => (
                            <button
                              key={i}
                              className="group-assign-btn"
                              onClick={() => assignToDay(dest.id, i)}
                              title={`Assign to Day ${i + 1}`}
                            >
                              D{i + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="group-modal-footer">
          {group && (
            <button 
              className="group-modal-btn delete" 
              onClick={handleDelete}
              disabled={saving}
            >
              🗑️ Delete Group
            </button>
          )}
          <div className="group-modal-footer-right">
            <button 
              className="group-modal-btn cancel" 
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button 
              className="group-modal-btn save" 
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : (group ? "Update Trip" : "Create Trip")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}

export default GroupItineraryModal;