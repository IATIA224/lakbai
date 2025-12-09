import React, { useState } from "react";
import { doc, updateDoc, deleteDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { db, auth } from "../../firebase";
import ItineraryCard from "./ItineraryCard";
import "./GroupedItineraryView.css";

function GroupedItineraryView({ group, items, onEditGroup, onDeleteGroup, onRefresh, onExportGroup }) {
  const [expandedDays, setExpandedDays] = useState({ 0: true });
  const [showTimeEditor, setShowTimeEditor] = useState(null);
  const [showActivityForm, setShowActivityForm] = useState(null); // dayIndex that's adding activity
  const [activityFormData, setActivityFormData] = useState({ title: "", time: "" });

  // Parse dates
  const startDate = group.startDate ? new Date(group.startDate) : null;
  const endDate = group.endDate ? new Date(group.endDate) : null;
  
  // Calculate days
  const getDaysBetween = () => {
    if (!startDate || !endDate) return 1;
    const diffTime = Math.abs(endDate - startDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const totalDays = getDaysBetween();
  
  // Get items for each day based on assignments
  const getItemsForDay = (dayIndex) => {
    if (!group.assignments) return [];
    
    const dayItems = [];
    Object.entries(group.assignments).forEach(([itemId, assignedDay]) => {
      if (Number(assignedDay) === Number(dayIndex)) {
        const item = items.find(i => i.id === itemId);
        if (item) {
          dayItems.push(item);
        }
      }
    });
    
    return dayItems;
  };

  // Get custom activities for a day from group data
  const getCustomActivitiesForDay = (dayIndex) => {
    if (!group.customActivities) return [];
    return group.customActivities.filter(activity => activity.day === dayIndex) || [];
  };

  // Combine and sort items + activities by time
  const getItemsAndActivitiesForDay = (dayIndex) => {
    const destinations = getItemsForDay(dayIndex);
    const customActivities = getCustomActivitiesForDay(dayIndex);

    // Create combined array with type identifier
    const combined = [
      ...destinations.map(item => ({
        type: 'destination',
        data: item,
        sortTime: item.arrivalTime || "23:59"
      })),
      ...customActivities.map(activity => ({
        type: 'activity',
        data: activity,
        sortTime: activity.time || "23:59"
      }))
    ];

    // Sort by time
    return combined.sort((a, b) => {
      const timeA = a.sortTime.replace(":", "");
      const timeB = b.sortTime.replace(":", "");
      return parseInt(timeA) - parseInt(timeB);
    });
  };

  // Calculate day date
  const getDayDate = (dayIndex) => {
    if (!startDate) return null;
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayIndex);
    return date;
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return "";
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Calculate total budget
  const getTotalBudget = () => {
    let total = 0;
    Object.keys(group.assignments || {}).forEach(itemId => {
      const item = items.find(i => i.id === itemId);
      if (item) {
        total += Number(item.estimatedExpenditure || item.budget || 0);
      }
    });
    return total;
  };

  // Get total destinations count
  const getTotalDestinations = () => {
    return Object.keys(group.assignments || {}).length;
  };

  // Toggle day expansion
  const toggleDay = (dayIndex) => {
    setExpandedDays(prev => ({
      ...prev,
      [dayIndex]: !prev[dayIndex]
    }));
  };

  // Get day budget
  const getDayBudget = (dayIndex) => {
    const dayItems = getItemsForDay(dayIndex);
    return dayItems.reduce((sum, item) => 
      sum + Number(item?.estimatedExpenditure || item?.budget || 0), 0
    );
  };

  // Handle item edit
  const handleItemEdit = async (updatedItem) => {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
      const ref = doc(db, "itinerary", user.uid, "items", updatedItem.id);
      await updateDoc(ref, {
        ...updatedItem,
        updatedAt: serverTimestamp()
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("[GroupedItineraryView] Failed to update item:", err);
    }
  };

  // Handle item remove
  const handleItemRemove = async (itemId) => {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
      await deleteDoc(doc(db, "itinerary", user.uid, "items", itemId));
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("[GroupedItineraryView] Failed to remove item:", err);
    }
  };

  // Handle time save
  const handleTimeSave = async (itemId, arrivalTime, departureTime) => {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
      const ref = doc(db, "itinerary", user.uid, "items", itemId);
      await updateDoc(ref, {
        arrivalTime: arrivalTime || null,
        departureTime: departureTime || null,
        updatedAt: serverTimestamp()
      });
      
      setShowTimeEditor(null);
      
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("[GroupedItineraryView] Failed to save times:", err);
    }
  };

  // Handle add custom activity
  const handleAddActivity = async (dayIndex) => {
    if (!activityFormData.title.trim()) {
      alert("Please enter an activity title");
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    try {
      const groupRef = doc(db, "itinerary", user.uid, "groups", group.id);
      const newActivity = {
        id: Date.now().toString(),
        title: activityFormData.title.trim(),
        time: activityFormData.time,
        day: dayIndex,
        createdAt: new Date().toISOString()
      };

      const currentActivities = group.customActivities || [];
      await updateDoc(groupRef, {
        customActivities: [...currentActivities, newActivity],
        updatedAt: serverTimestamp()
      });

      setActivityFormData({ title: "", time: "" });
      setShowActivityForm(null);
      
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("[GroupedItineraryView] Failed to add activity:", err);
    }
  };

  // Handle delete custom activity
  const handleDeleteActivity = async (activityId, dayIndex) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const groupRef = doc(db, "itinerary", user.uid, "groups", group.id);
      const updatedActivities = (group.customActivities || []).filter(
        activity => activity.id !== activityId
      );

      await updateDoc(groupRef, {
        customActivities: updatedActivities,
        updatedAt: serverTimestamp()
      });

      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("[GroupedItineraryView] Failed to delete activity:", err);
    }
  };

  // Handle update custom activity time
  const handleUpdateActivityTime = async (activityId, newTime) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const groupRef = doc(db, "itinerary", user.uid, "groups", group.id);
      const updatedActivities = (group.customActivities || []).map(activity => 
        activity.id === activityId ? { ...activity, time: newTime } : activity
      );

      await updateDoc(groupRef, {
        customActivities: updatedActivities,
        updatedAt: serverTimestamp()
      });

      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("[GroupedItineraryView] Failed to update activity:", err);
    }
  };

  return (
    <div className="grouped-itinerary-card">
      {/* Header */}
      <div className="grouped-itinerary-header">
        <div className="grouped-itinerary-info">
          <h3 className="grouped-itinerary-name">{group.name || "Untitled Trip"}</h3>
          <div className="grouped-itinerary-meta">
            {startDate && endDate && (
              <span className="grouped-itinerary-dates">
                📅 {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
              </span>
            )}
            <span className="grouped-itinerary-days">
              📆 {totalDays} day{totalDays !== 1 ? 's' : ''}
            </span>
            <span className="grouped-itinerary-destinations">
              📍 {getTotalDestinations()} destination{getTotalDestinations() !== 1 ? 's' : ''}
            </span>
            <span className="grouped-itinerary-budget">
              💰 ₱{getTotalBudget().toLocaleString()}
            </span>
          </div>
        </div>
        <div className="group-actions">
          <button 
            className="btn edit-trip"
            onClick={() => onEditGroup && onEditGroup(group)}
          >
            ✏️ Edit Trip
          </button>
        </div>
      </div>

      {/* Days */}
      <div className="grouped-itinerary-days-container">
        {Array.from({ length: totalDays }, (_, dayIndex) => {
          const itemsAndActivities = getItemsAndActivitiesForDay(dayIndex);
          const dayDate = getDayDate(dayIndex);
          const isExpanded = expandedDays[dayIndex] !== false;
          const dayBudget = getDayBudget(dayIndex);

          return (
            <div key={dayIndex} className="grouped-day-section">
              <div 
                className="grouped-day-header"
                onClick={() => toggleDay(dayIndex)}
              >
                <div className="grouped-day-info">
                  <span className="grouped-day-badge">Day {dayIndex + 1}</span>
                  <span className="grouped-day-date">{formatDate(dayDate)}</span>
                </div>
                <div className="grouped-day-summary">
                  <span className="grouped-day-stops">
                    {itemsAndActivities.length} item{itemsAndActivities.length !== 1 ? 's' : ''}
                  </span>
                  {dayBudget > 0 && (
                    <span className="grouped-day-budget">
                      ₱{dayBudget.toLocaleString()}
                    </span>
                  )}
                  <span className={`grouped-day-toggle ${isExpanded ? 'expanded' : ''}`}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="grouped-day-items">
                  {itemsAndActivities.length === 0 ? (
                    <div className="grouped-day-empty">
                      No activities planned for this day
                    </div>
                  ) : (
                    <>
                      {itemsAndActivities.map((item, idx) => (
                        <div key={`${item.type}-${item.data.id}`} className="grouped-destination-wrapper">
                          {item.type === 'destination' ? (
                            <>
                              <TimeDisplayBar
                                item={item.data}
                                onEdit={() => setShowTimeEditor(item.data.id)}
                              />
                              <ItineraryCard
                                item={item.data}
                                index={idx}
                                onEdit={handleItemEdit}
                                onRemove={handleItemRemove}
                                isShared={false}
                                sharedId={null}
                              />
                            </>
                          ) : (
                            <CustomActivityItem
                              activity={item.data}
                              onUpdateTime={(newTime) => handleUpdateActivityTime(item.data.id, newTime)}
                              onDelete={() => handleDeleteActivity(item.data.id, dayIndex)}
                            />
                          )}

                          {showTimeEditor === item.data.id && item.type === 'destination' && (
                            <TimeEditorBar
                              item={item.data}
                              onSave={handleTimeSave}
                              onCancel={() => setShowTimeEditor(null)}
                            />
                          )}
                        </div>
                      ))}
                    </>
                  )}

                  {/* Add Activity Form */}
                  {showActivityForm === dayIndex ? (
                    <ActivityFormBar
                      onAdd={() => handleAddActivity(dayIndex)}
                      onCancel={() => setShowActivityForm(null)}
                      formData={activityFormData}
                      onFormChange={setActivityFormData}
                    />
                  ) : (
                    <button 
                      className="grouped-add-activity-btn"
                      onClick={() => setShowActivityForm(dayIndex)}
                    >
                      + Add Activity/Note
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Time Display Component
function TimeDisplayBar({ item, onEdit }) {
  const timeDisplay = (() => {
    if (item.arrivalTime || item.departureTime) {
      const arrival = item.arrivalTime ? item.arrivalTime : "—";
      const departure = item.departureTime ? item.departureTime : "—";
      return `${arrival} → ${departure}`;
    }
    return null;
  })();

  return (
    <div className="grouped-destination-time-bar">
      <div className="grouped-time-info">
        <span className="grouped-time-icon">🕐</span>
        {timeDisplay ? (
          <span className="grouped-time-display">{timeDisplay}</span>
        ) : (
          <span className="grouped-time-placeholder">No time set</span>
        )}
      </div>
      <button 
        className="grouped-time-edit-btn"
        onClick={onEdit}
        title="Set arrival and departure times"
      >
        ⏱️ Set Time
      </button>
    </div>
  );
}

// Time Editor Component
function TimeEditorBar({ item, onSave, onCancel }) {
  const [arrivalTime, setArrivalTime] = useState(item.arrivalTime || "");
  const [departureTime, setDepartureTime] = useState(item.departureTime || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(item.id, arrivalTime, departureTime);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grouped-destination-time-editor">
      <div className="grouped-time-editor-fields">
        <div className="grouped-time-field">
          <label>Arrival Time</label>
          <input
            type="time"
            value={arrivalTime}
            onChange={(e) => setArrivalTime(e.target.value)}
            placeholder="HH:MM"
          />
        </div>
        <div className="grouped-time-field">
          <label>Departure Time</label>
          <input
            type="time"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            placeholder="HH:MM"
          />
        </div>
      </div>
      <div className="grouped-time-editor-actions">
        <button 
          className="grouped-time-btn cancel"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button 
          className="grouped-time-btn save"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Time"}
        </button>
      </div>
    </div>
  );
}

// Custom Activity Component
function CustomActivityItem({ activity, onUpdateTime, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [time, setTime] = useState(activity.time || "");

  const handleSave = () => {
    onUpdateTime(time);
    setIsEditing(false);
  };

  return (
    <div className="grouped-custom-activity">
      <div className="grouped-activity-time-section">
        {isEditing ? (
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="grouped-activity-time-input"
          />
        ) : (
          <span className="grouped-activity-time">
            {activity.time || "—"}
          </span>
        )}
      </div>

      <div className="grouped-activity-content">
        <span className="grouped-activity-icon">📝</span>
        <span className="grouped-activity-title">{activity.title}</span>
      </div>

      <div className="grouped-activity-actions">
        {isEditing ? (
          <>
            <button 
              className="grouped-activity-btn save"
              onClick={handleSave}
              title="Save time"
            >
              ✓
            </button>
            <button 
              className="grouped-activity-btn cancel"
              onClick={() => setIsEditing(false)}
              title="Cancel"
            >
              ✕
            </button>
          </>
        ) : (
          <>
            <button 
              className="grouped-activity-btn edit"
              onClick={() => setIsEditing(true)}
              title="Edit time"
            >
              ⏱️
            </button>
            <button 
              className="grouped-activity-btn delete"
              onClick={onDelete}
              title="Delete activity"
            >
              🗑️
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Activity Form Component
function ActivityFormBar({ onAdd, onCancel, formData, onFormChange }) {
  return (
    <div className="grouped-activity-form-bar">
      <div className="grouped-activity-form-fields">
        <input
          type="text"
          value={formData.title}
          onChange={(e) => onFormChange({ ...formData, title: e.target.value })}
          placeholder="e.g., Eat at Jollibee, Rest at hotel, Shopping..."
          className="grouped-activity-form-title"
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
        />
        <input
          type="time"
          value={formData.time}
          onChange={(e) => onFormChange({ ...formData, time: e.target.value })}
          className="grouped-activity-form-time"
        />
      </div>
      <div className="grouped-activity-form-actions">
        <button 
          className="grouped-form-btn cancel"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button 
          className="grouped-form-btn add"
          onClick={onAdd}
        >
          Add Activity
        </button>
      </div>
    </div>
  );
}

export default GroupedItineraryView;