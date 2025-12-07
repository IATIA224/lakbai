import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import "./ItineraryDetailModal.css";

// Mobile detection hook
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
}

function ItineraryDetailModal({ item, onClose, onSave, onRemove }) {
  const isMobile = useIsMobile();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(() => ({
    name: item?.name || "",
    region: item?.region || "",
    location: item?.location || "",
    arrival: item?.arrival || "",
    departure: item?.departure || "",
    status: item?.status || "Upcoming",
    estimatedExpenditure: item?.estimatedExpenditure ?? item?.budget ?? 0,
    accomType: item?.accomType || "",
    accomName: item?.accomName || "",
    accomNotes: item?.accomNotes || "",
    activities: item?.activities || [],
    activityDraft: "",
    transport: item?.transport || "",
    transportNotes: item?.transportNotes || "",
    notes: item?.notes || "",
    agency: item?.agency || "",
  }));
  const [notif, setNotif] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Calculate days
  const days = item?.arrival && item?.departure
    ? Math.max(1, Math.ceil(
        (new Date(item.departure).getTime() - new Date(item.arrival).getTime()) /
        (1000 * 60 * 60 * 24)
      ))
    : 0;

  // Handle escape key
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const addActivity = useCallback(() => {
    const v = form.activityDraft.trim();
    if (!v) return;
    setForm(f => ({ ...f, activities: [...f.activities, v], activityDraft: "" }));
  }, [form.activityDraft]);

  const removeActivity = (i) => {
    setForm(f => ({ ...f, activities: f.activities.filter((_, idx) => idx !== i) }));
  };

  const handleSave = async () => {
    try {
      await onSave({
        ...item,
        ...form,
        estimatedExpenditure: Number(form.estimatedExpenditure) || 0,
      });
      setNotif("Saved successfully!");
      setTimeout(() => {
        setNotif("");
        setIsEditing(false);
      }, 1000);
    } catch (err) {
      setNotif("Failed to save.");
      setTimeout(() => setNotif(""), 2000);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await onRemove(item.id);
      onClose();
    } catch (err) {
      setNotif("Failed to delete.");
      setTimeout(() => setNotif(""), 2000);
    }
  };

  // View Mode Content
  const viewContent = (
    <div className="itinerary-detail-content">
      {/* Header Info */}
      <div className="detail-section detail-header-section">
        <div className="detail-destination-name">{item.name || "Untitled"}</div>
        <div className="detail-destination-region">📍 {item.region || "Unknown"}</div>
        {item.location && (
          <div className="detail-destination-location">{item.location}</div>
        )}
        <span className={`detail-status-badge ${(item.status || 'upcoming').toLowerCase()}`}>
          {item.status || "Upcoming"}
        </span>
      </div>

      {/* Description */}
      {item.description && (
        <div className="detail-section">
          <h4 className="detail-section-title">📝 Description</h4>
          <p className="detail-description">{item.description}</p>
        </div>
      )}

      {/* Dates */}
      {(item.arrival || item.departure) && (
        <div className="detail-section">
          <h4 className="detail-section-title">📅 Dates</h4>
          <div className="detail-dates-grid">
            {item.arrival && (
              <div className="detail-date-item">
                <span className="detail-date-label">From</span>
                <span className="detail-date-value">
                  {new Date(item.arrival).toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                  })}
                </span>
              </div>
            )}
            {item.departure && (
              <div className="detail-date-item">
                <span className="detail-date-label">Until</span>
                <span className="detail-date-value">
                  {new Date(item.departure).toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                  })}
                </span>
              </div>
            )}
            {days > 0 && (
              <div className="detail-date-duration">
                {days} day{days !== 1 ? 's' : ''} total
              </div>
            )}
          </div>
        </div>
      )}

      {/* Budget */}
      <div className="detail-section">
        <h4 className="detail-section-title">💰 Estimated Expenditure</h4>
        <div className="detail-budget">
          ₱{Number(item.estimatedExpenditure || item.budget || 0).toLocaleString()}
        </div>
        {item.breakdown && item.breakdown.length > 0 && (
          <div className="detail-breakdown">
            {item.breakdown.map((b, i) => (
              <div key={i} className="detail-breakdown-item">
                <span>{b.label || b.category}</span>
                <span>₱{Number(b.amount || b.value || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Accommodation */}
      {(item.accomType || item.accomName) && (
        <div className="detail-section">
          <h4 className="detail-section-title">🏨 Accommodation</h4>
          <div className="detail-accommodation">
            {item.accomType && <span className="detail-accom-type">{item.accomType}</span>}
            {item.accomName && <div className="detail-accom-name">{item.accomName}</div>}
            {item.accomNotes && <p className="detail-accom-notes">{item.accomNotes}</p>}
          </div>
        </div>
      )}

      {/* Activities */}
      {item.activities && item.activities.length > 0 && (
        <div className="detail-section">
          <h4 className="detail-section-title">🎯 Activities</h4>
          <div className="detail-activities">
            {item.activities.map((act, i) => (
              <span key={i} className="detail-activity-tag">{act}</span>
            ))}
          </div>
        </div>
      )}

      {/* Transport */}
      {item.transport && (
        <div className="detail-section">
          <h4 className="detail-section-title">🚗 Transportation</h4>
          <div className="detail-transport">
            <span className="detail-transport-type">{item.transport}</span>
            {item.transportNotes && <p className="detail-transport-notes">{item.transportNotes}</p>}
          </div>
        </div>
      )}

      {/* Agency */}
      {item.agency && (
        <div className="detail-section">
          <h4 className="detail-section-title">🏢 Travel Agency</h4>
          <p className="detail-agency">{item.agency}</p>
        </div>
      )}

      {/* Best Time */}
      {item.bestTime && (
        <div className="detail-section">
          <h4 className="detail-section-title">🌤️ Best Time to Visit</h4>
          <p className="detail-best-time">{item.bestTime}</p>
        </div>
      )}

      {/* Packing Suggestions */}
      {item.packingSuggestions && (
        <div className="detail-section">
          <h4 className="detail-section-title">🎒 Packing Suggestions</h4>
          <div className="detail-packing">
            {Array.isArray(item.packingSuggestions) 
              ? item.packingSuggestions.map((p, i) => (
                  <span key={i} className="detail-packing-tag">• {p}</span>
                ))
              : <p>{item.packingSuggestions}</p>
            }
          </div>
        </div>
      )}

      {/* Notes */}
      {item.notes && (
        <div className="detail-section">
          <h4 className="detail-section-title">📋 Notes</h4>
          <p className="detail-notes">{item.notes}</p>
        </div>
      )}
    </div>
  );

  // Edit Mode Content
  const editContent = (
    <div className="itinerary-detail-edit">
      <div className="detail-edit-grid">
        <div className="detail-edit-field">
          <label>Destination Name</label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Enter destination name"
          />
        </div>

        <div className="detail-edit-field">
          <label>Region</label>
          <input
            type="text"
            name="region"
            value={form.region}
            onChange={handleChange}
            placeholder="Region or province"
          />
        </div>

        <div className="detail-edit-field full-width">
          <label>Location</label>
          <input
            type="text"
            name="location"
            value={form.location}
            onChange={handleChange}
            placeholder="Full address or location"
          />
        </div>

        <div className="detail-edit-field">
          <label>Arrival Date</label>
          <input
            type="date"
            name="arrival"
            value={form.arrival}
            onChange={handleChange}
          />
        </div>

        <div className="detail-edit-field">
          <label>Departure Date</label>
          <input
            type="date"
            name="departure"
            value={form.departure}
            onChange={handleChange}
          />
        </div>

        <div className="detail-edit-field">
          <label>Status</label>
          <select name="status" value={form.status} onChange={handleChange}>
            <option>Upcoming</option>
            <option>Ongoing</option>
            <option>Completed</option>
          </select>
        </div>

        <div className="detail-edit-field">
          <label>Estimated Expenditure (₱)</label>
          <input
            type="number"
            name="estimatedExpenditure"
            value={form.estimatedExpenditure}
            onChange={handleChange}
          />
        </div>

        <div className="detail-edit-field">
          <label>Accommodation Type</label>
          <select name="accomType" value={form.accomType} onChange={handleChange}>
            <option value="">Select type...</option>
            <option>Hotel</option>
            <option>Hostel</option>
            <option>Apartment</option>
            <option>Resort</option>
            <option>Homestay</option>
          </select>
        </div>

        <div className="detail-edit-field">
          <label>Accommodation Name</label>
          <input
            type="text"
            name="accomName"
            value={form.accomName}
            onChange={handleChange}
            placeholder="Hotel/Place name"
          />
        </div>

        <div className="detail-edit-field full-width">
          <label>Accommodation Notes</label>
          <textarea
            name="accomNotes"
            value={form.accomNotes}
            onChange={handleChange}
            placeholder="Address, booking details..."
            rows={2}
          />
        </div>

        <div className="detail-edit-field">
          <label>Transportation</label>
          <select name="transport" value={form.transport} onChange={handleChange}>
            <option value="">Select...</option>
            <option>Flight</option>
            <option>Train</option>
            <option>Bus</option>
            <option>Car</option>
            <option>Ferry</option>
          </select>
        </div>

        <div className="detail-edit-field">
          <label>Travel Agency</label>
          <input
            type="text"
            name="agency"
            value={form.agency}
            onChange={handleChange}
            placeholder="Agency name"
          />
        </div>

        <div className="detail-edit-field full-width">
          <label>Activities</label>
          <div className="detail-activity-input">
            <input
              type="text"
              value={form.activityDraft}
              onChange={(e) => setForm({ ...form, activityDraft: e.target.value })}
              placeholder="Add an activity..."
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addActivity())}
            />
            <button type="button" onClick={addActivity}>Add</button>
          </div>
          {form.activities.length > 0 && (
            <div className="detail-activities-list">
              {form.activities.map((act, i) => (
                <span key={i} className="detail-activity-tag editable">
                  {act}
                  <button onClick={() => removeActivity(i)}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="detail-edit-field full-width">
          <label>Additional Notes</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            placeholder="Any other details..."
            rows={3}
          />
        </div>
      </div>
    </div>
  );

  const modalContent = (
    <div className="itinerary-detail-backdrop" onClick={onClose}>
      <div 
        className={`itinerary-detail-modal ${isMobile ? 'mobile' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="itinerary-detail-header">
          <h2>{isEditing ? "Edit Destination" : "Destination Details"}</h2>
          <button className="detail-close-btn" onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className="itinerary-detail-body">
          {isEditing ? editContent : viewContent}
        </div>

        {/* Footer */}
        <div className="itinerary-detail-footer">
          {isEditing ? (
            <>
              <button 
                className="detail-btn cancel" 
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
              <button 
                className="detail-btn save" 
                onClick={handleSave}
              >
                Save Changes
              </button>
            </>
          ) : (
            <>
              <button 
                className={`detail-btn delete ${confirmDelete ? 'confirm' : ''}`}
                onClick={handleDelete}
              >
                {confirmDelete ? "Confirm Delete?" : "🗑️ Remove"}
              </button>
              <button 
                className="detail-btn edit" 
                onClick={() => setIsEditing(true)}
              >
                ✏️ Edit Details
              </button>
            </>
          )}
        </div>

        {/* Notification */}
        {notif && (
          <div className="itinerary-detail-notif">{notif}</div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}

export default ItineraryDetailModal;