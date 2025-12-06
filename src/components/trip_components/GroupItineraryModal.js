import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { db, auth } from "../../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query as fsQuery,
  serverTimestamp,
} from "firebase/firestore";
import "./GroupItineraryModal.css";

// Hook to get grouped itineraries
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
    const q = fsQuery(groupsRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setGroups(list);
        setLoading(false);
      },
      (err) => {
        console.error("[useGroupedItineraries] Error:", err);
        setGroups([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [userId]);

  return { groups, loading };
}

export default function GroupItineraryModal({ open, onClose, onSave, group, allDestinations = [] }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(group?.name || "");
  const [startDate, setStartDate] = useState(group?.startDate || "");
  const [endDate, setEndDate] = useState(group?.endDate || "");
  const [selectedDestinations, setSelectedDestinations] = useState(
    group?.destinationIds || []
  );
  const [assignments, setAssignments] = useState(group?.assignments || {});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset state when modal opens/closes or group changes
  useEffect(() => {
    if (open) {
      setStep(1);
      setName(group?.name || "");
      setStartDate(group?.startDate || "");
      setEndDate(group?.endDate || "");
      setSelectedDestinations(group?.destinationIds || []);
      setAssignments(group?.assignments || {});
      setError("");
      setSaving(false);
    }
  }, [open, group]);

  // Ensure allDestinations is always an array
  const destinations = Array.isArray(allDestinations) ? allDestinations : [];

  // Calculate number of days
  const getDayCount = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diff);
  };

  const dayCount = getDayCount();

  // Generate day labels
  const getDayLabels = () => {
    if (!startDate || dayCount === 0) return [];
    const labels = [];
    const start = new Date(startDate);
    for (let i = 0; i < dayCount; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      labels.push({
        day: i + 1,
        date: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        fullDate: date.toISOString().split("T")[0],
      });
    }
    return labels;
  };

  const dayLabels = getDayLabels();

  // Get unassigned items
  const getUnassignedItems = () => {
    if (!Array.isArray(selectedDestinations)) return [];
    return selectedDestinations.filter((id) => !assignments[id]);
  };

  const toggleDestination = (id) => {
    setSelectedDestinations((prev) => {
      const prevArray = Array.isArray(prev) ? prev : [];
      return prevArray.includes(id) 
        ? prevArray.filter((x) => x !== id) 
        : [...prevArray, id];
    });
  };

  const assignToDay = (destId, dayNum) => {
    setAssignments((prev) => ({
      ...prev,
      [destId]: dayNum,
    }));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!name.trim()) {
        setError("Please enter a trip name");
        return;
      }
      if (!startDate || !endDate) {
        setError("Please select start and end dates");
        return;
      }
      if (new Date(endDate) < new Date(startDate)) {
        setError("End date must be after start date");
        return;
      }
      setError("");
      setStep(2);
    } else if (step === 2) {
      if (!selectedDestinations || selectedDestinations.length === 0) {
        setError("Please select at least one destination");
        return;
      }
      setError("");
      setStep(3);
    }
  };

  const handleBack = () => {
    setError("");
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      setError("You must be logged in to save.");
      return;
    }

    setSaving(true);
    setError("");

    const groupData = {
      name: name.trim(),
      startDate,
      endDate,
      dayCount,
      destinationIds: selectedDestinations || [],
      assignments: assignments || {},
      updatedAt: serverTimestamp(),
    };

    try {
      if (group?.id) {
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
      if (onSave) onSave();
      onClose();
    } catch (err) {
      console.error("[GroupItineraryModal] Save error:", err);
      setError("Failed to save group: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!group?.id) return;
    const user = auth.currentUser;
    if (!user) return;

    if (!window.confirm("Are you sure you want to delete this trip group?")) return;

    setSaving(true);
    try {
      await deleteDoc(doc(db, "itinerary", user.uid, "groups", group.id));
      if (onSave) onSave();
      onClose();
    } catch (err) {
      console.error("[GroupItineraryModal] Delete error:", err);
      setError("Failed to delete group: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const modalContent = (
    <div className="group-modal-backdrop" onClick={onClose}>
      <div className="group-modal" onClick={(e) => e.stopPropagation()}>
        <div className="group-modal-header">
          <h2>
            {group ? "✏️ Edit Trip Group" : "📅 Create Trip Group"}
          </h2>
          <button className="group-modal-close" onClick={onClose}>×</button>
        </div>

        {/* Progress Steps */}
        <div className="group-modal-steps">
          <div className={`group-step ${step >= 1 ? "active" : ""} ${step > 1 ? "completed" : ""}`}>
            <span className="step-number">1</span>
            <span className="step-label">Trip Details</span>
          </div>
          <div className="step-connector" />
          <div className={`group-step ${step >= 2 ? "active" : ""} ${step > 2 ? "completed" : ""}`}>
            <span className="step-number">2</span>
            <span className="step-label">Select Destinations</span>
          </div>
          <div className="step-connector" />
          <div className={`group-step ${step >= 3 ? "active" : ""}`}>
            <span className="step-number">3</span>
            <span className="step-label">Assign Days</span>
          </div>
        </div>

        <div className="group-modal-body">
          {error && <div className="group-error">{error}</div>}

          {/* Step 1: Trip Details */}
          {step === 1 && (
            <div className="group-step-content">
              <div className="group-field">
                <label>Trip Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Summer Vacation 2024"
                  autoFocus
                />
              </div>
              <div className="group-field-row">
                <div className="group-field">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="group-field">
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
                <div className="group-duration-preview">
                  🗓️ {dayCount} day{dayCount !== 1 ? "s" : ""} trip
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Destinations */}
          {step === 2 && (
            <div className="group-step-content">
              <p className="group-instruction">
                Select destinations to include in this trip ({selectedDestinations?.length || 0} selected)
              </p>
              <div className="group-destinations-list">
                {destinations.length === 0 ? (
                  <div className="group-empty">
                    No destinations available. Add some destinations first!
                  </div>
                ) : (
                  destinations.map((dest) => (
                    <div
                      key={dest.id}
                      className={`group-destination-item ${
                        selectedDestinations?.includes(dest.id) ? "selected" : ""
                      }`}
                      onClick={() => toggleDestination(dest.id)}
                    >
                      <div className="group-dest-checkbox">
                        {selectedDestinations?.includes(dest.id) ? "✓" : ""}
                      </div>
                      <div className="group-dest-info">
                        <div className="group-dest-name">{dest.name || "Untitled"}</div>
                        <div className="group-dest-region">{dest.region || dest.location || ""}</div>
                      </div>
                      <div className={`group-dest-status ${(dest.status || "upcoming").toLowerCase()}`}>
                        {dest.status || "Upcoming"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Step 3: Assign to Days */}
          {step === 3 && (
            <div className="group-step-content">
              <p className="group-instruction">
                Assign each destination to a specific day
              </p>
              
              <div className="group-assignment-container">
                {/* Day columns */}
                <div className="group-days-grid">
                  {dayLabels.map((dayInfo) => (
                    <div key={dayInfo.day} className="group-day-column">
                      <div className="group-day-header">
                        <span className="day-number">Day {dayInfo.day}</span>
                        <span className="day-date">{dayInfo.date}</span>
                      </div>
                      <div className="group-day-destinations">
                        {(selectedDestinations || [])
                          .filter((id) => assignments[id] === dayInfo.day)
                          .map((id) => {
                            const dest = destinations.find((d) => d.id === id);
                            return dest ? (
                              <div key={id} className="group-assigned-dest">
                                <span>{dest.name}</span>
                                <button
                                  className="group-unassign-btn"
                                  onClick={() => assignToDay(id, null)}
                                  type="button"
                                >
                                  ×
                                </button>
                              </div>
                            ) : null;
                          })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Unassigned destinations */}
                <div className="group-unassigned-section">
                  <h4>Unassigned Destinations</h4>
                  <div className="group-unassigned-list">
                    {getUnassignedItems().map((id) => {
                      const dest = destinations.find((d) => d.id === id);
                      return dest ? (
                        <div key={id} className="group-unassigned-dest">
                          <span>{dest.name}</span>
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                assignToDay(id, parseInt(e.target.value));
                              }
                            }}
                          >
                            <option value="">Assign to day...</option>
                            {dayLabels.map((d) => (
                              <option key={d.day} value={d.day}>
                                Day {d.day} - {d.date}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null;
                    })}
                    {getUnassignedItems().length === 0 && (
                      <div className="group-all-assigned">
                        ✅ All destinations assigned!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="group-modal-footer">
          {group && (
            <button 
              className="group-btn delete" 
              onClick={handleDelete}
              disabled={saving}
            >
              🗑️ Delete Group
            </button>
          )}
          <div className="group-footer-actions">
            {step > 1 && (
              <button className="group-btn secondary" onClick={handleBack} disabled={saving}>
                ← Back
              </button>
            )}
            {step < 3 ? (
              <button className="group-btn primary" onClick={handleNext} disabled={saving}>
                Next →
              </button>
            ) : (
              <button className="group-btn primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : (group ? "Update" : "Create")} Trip
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}