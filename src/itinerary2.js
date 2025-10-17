import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom"; // ADD THIS IMPORT
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  query,
  where,
  limit,
  arrayRemove
} from "firebase/firestore";
import { db, auth } from "./firebase";
import './itinerary2.css';
import ItineraryHotelsModal from "./itineraryHotels";
import ItineraryCostEstimationModal from "./itineraryCostEstimation";
import ItineraryAgencyModal from "./itineraryAgency";
import { unlockAchievement } from "./profile";
import {
  trackDestinationAdded,
  trackDestinationCompleted,
  trackDestinationUncompleted,
  trackDestinationRemoved,
} from "./itinerary_Stats";

// Helper function to ensure collections exist
async function ensureCollectionExists(path) {
  try {
    const tempDoc = doc(collection(db, path));
    await setDoc(tempDoc, { _temp: true });
    await deleteDoc(tempDoc);
    console.log(`Ensured collection exists: ${path}`);
    return true;
  } catch (err) {
    console.error(`Failed to ensure collection: ${path}`, err);
    return false;
  }
}

// Share Modal Component with Portal
export function ShareItineraryModal({ items, friends, selected, onToggleItem, onShare, onClose }) {
  const [selectedFriends, setSelectedFriends] = useState(new Set());
  const [itemsFilter, setItemsFilter] = useState("");
  const [friendsFilter, setFriendsFilter] = useState("");
  const [loading, setLoading] = useState(false);
  
  const filteredItems = useMemo(() => {
    const q = itemsFilter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) => (it.name || "").toLowerCase().includes(q) || 
              (it.region || "").toLowerCase().includes(q)
    );
  }, [items, itemsFilter]);
  
  const filteredFriends = useMemo(() => {
    const q = friendsFilter.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) => (f.name || "").toLowerCase().includes(q)
    );
  }, [friends, friendsFilter]);

  const handleToggleFriend = (friendId) => {
    setSelectedFriends(prev => {
      const next = new Set(prev);
      if (next.has(friendId)) next.delete(friendId);
      else next.add(friendId);
      return next;
    });
  };
  
  const handleShare = async () => {
    if (!selected.size || !selectedFriends.size) return;
    setLoading(true);
    try {
      console.log("Sharing items", [...selected], "with friends", [...selectedFriends]);
      await onShare([...selected], [...selectedFriends]);
      onClose();
    } catch (err) {
      console.error("Share failed:", err);
      alert(`Failed to share itinerary: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };
  
  const modalContent = (
    <div className="itn-modal-backdrop" onClick={onClose}>
      <div className="itn-modal" onClick={(e) => e.stopPropagation()}>
        <div className="itn-modal-header">
          <div className="itn-modal-title">
            <span role="img" aria-label="share">🔗</span> 
            Share Your Travel Plans
          </div>
          <button className="itn-close" onClick={onClose}>×</button>
        </div>
        
        <div className="itn-share-modal-body">
          <div className="itn-share-grid">
            {/* Left section - Destinations */}
            <div className="itn-share-column">
              <h3 className="itn-share-heading">
                <span className="itn-share-heading-icon">📍</span> Step 1: Select destinations to share
              </h3>
              
              <div className="itn-share-search">
                <input
                  className="itn-input"
                  placeholder="Filter destinations..."
                  value={itemsFilter}
                  onChange={(e) => setItemsFilter(e.target.value)}
                />
              </div>
              
              <div className="itn-share-list-container">
                {filteredItems.length > 0 ? (
                  filteredItems.map((it) => {
                    const isChecked = selected.has(it.id);
                    return (
                      <div 
                        key={it.id} 
                        className={`itn-share-item ${isChecked ? 'selected' : ''}`}
                        onClick={() => onToggleItem(it.id)}
                      >
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          onChange={() => {}} 
                          className="itn-share-checkbox" 
                        />
                        <div className="itn-share-destination-info">
                          <div className="itn-share-destination-name">{it.name || "Destination"}</div>
                          <div className="itn-share-destination-meta">
                            {it.region} • {it.status}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="itn-share-empty">
                    {items.length === 0 ? (
                      <div>
                        <div className="itn-share-empty-icon">🧳</div>
                        <div>No destinations in your itinerary</div>
                      </div>
                    ) : (
                      <div>No destinations match your filter</div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="itn-share-count">
                Selected: <span className="itn-share-count-value">{selected.size}</span> destinations
              </div>
            </div>
            
            {/* Right section - Friends */}
            <div className="itn-share-column">
              <h3 className="itn-share-heading">
                <span className="itn-share-heading-icon">👥</span> Step 2: Choose friends to share with
              </h3>
              
              <div className="itn-share-search">
                <input
                  className="itn-input"
                  placeholder="Search friends..."
                  value={friendsFilter}
                  onChange={(e) => setFriendsFilter(e.target.value)}
                />
              </div>
              
              <div className="itn-share-list-container">
                {filteredFriends.length > 0 ? (
                  filteredFriends.map((friend) => {
                    const isChecked = selectedFriends.has(friend.id);
                    return (
                      <div 
                        key={friend.id} 
                        className={`itn-share-item ${isChecked ? 'selected' : ''}`}
                        onClick={() => handleToggleFriend(friend.id)}
                      >
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          onChange={() => {}} 
                          className="itn-share-checkbox" 
                        />
                        <img 
                          src={friend.profilePicture || "/user.png"} 
                          alt={friend.name}
                          className="itn-share-friend-avatar"
                        />
                        <div className="itn-share-friend-name">{friend.name}</div>
                      </div>
                    );
                  })
                ) : (
                  <div className="itn-share-empty">
                    {friends.length === 0 ? (
                      <div>
                        <div className="itn-share-empty-icon">👥</div>
                        <div>You don't have any friends yet</div>
                      </div>
                    ) : (
                      <div>No friends match your search</div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="itn-share-count">
                Selected: <span className="itn-share-count-value">{selectedFriends.size}</span> friends
              </div>
            </div>
          </div>
        </div>
        
        <div className="itn-modal-footer">
          <div className="itn-selection-count">
            <span className="itn-share-count-value">{selected.size}</span> destinations • 
            <span className="itn-share-count-value">{selectedFriends.size}</span> friends
          </div>
          <div className="itn-button-group">
            <button 
              className="itn-btn ghost" 
              onClick={onClose} 
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              className="itn-btn primary" 
              onClick={handleShare}
              disabled={loading || !selected.size || !selectedFriends.size}
            >
              {loading ? (
                <>
                  <span className="itn-spinner"></span>
                  Sharing...
                </>
              ) : (
                <>
                  Share Itinerary
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Render to body using Portal
  return ReactDOM.createPortal(modalContent, document.body);
}

// Enhanced DestinationCard that supports read-only mode for shared itineraries
export function SharedDestinationCard({ 
  item, 
  index, 
  onEdit, 
  onRemove, 
  onToggleStatus, 
  readOnly = false,
  isOwner = false,
  setEditing,
  setSharedItineraryId,
  sharedId
}) {
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showHotels, setShowHotels] = useState(false);
  const [showCostEstimation, setShowCostEstimation] = useState(false);
  const [showAgency, setShowAgency] = useState(false); // ADD THIS
  const [showToolsMenu, setShowToolsMenu] = useState(false); // ADD THIS

  const days =
    item.arrival && item.departure
      ? Math.max(
          1,
          Math.ceil(
            (new Date(item.departure).getTime() - new Date(item.arrival).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : 0;

  const activities = item.activities || [];
  const showToggle = activities.length > 3;

  // ADD THIS - Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowToolsMenu(false);
    if (showToolsMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showToolsMenu]);

  return (
    <>
      <div className="itn-card" style={{ overflow: 'visible' }}>
        <div className="itn-card-head">
          <div className="itn-card-title">
            <span className="itn-step">{index + 1}</span>
            <div>
              <div className="itn-name">{item.name || "Destination"}</div>
              <div className="itn-sub">{item.region}</div>
              {/* ADD THIS - Show location */}
              {item.location && (
                <div className="itn-location" style={{ 
                  fontSize: '0.85rem', 
                  color: '#94a3b8',
                  marginTop: '2px'
                }}>
                  📌 {item.location}
                </div>
              )}
            </div>
          </div>
          <div className="itn-actions">
            <span className={`itn-badge ${item.status.toLowerCase()}`}>{item.status}</span>
            
            {!readOnly && (
              <>
                <button className="itn-btn" onClick={() => onToggleStatus(sharedId, item.id)}>
                  Toggle Status
                </button>
                <button className="itn-btn" onClick={() => onEdit(sharedId, item)}>
                  Edit
                </button>
                <button className="itn-btn danger" onClick={() => onRemove(sharedId, item.id)}>
                  Remove
                </button>
              </>
            )}
          </div>
        </div>

        <div className="itn-stats">
          <div className="itn-stat blue">
            <div className="itn-stat-title">Dates</div>
            <div className="itn-stat-body">
              {item.arrival || item.departure ? (
                <>
                  <div>{item.arrival || "—"}</div>
                  <div>{item.departure || "—"}</div>
                  <div className="itn-muted">{days} {days === 1 ? "day" : "days"} total</div>
                </>
              ) : (
                <div className="itn-muted">Not set</div>
              )}
            </div>
          </div>

          <div className="itn-stat green">
            <div className="itn-stat-title">Estimated expenditure</div>
            <div className="itn-stat-body">
              <div>₱{Number(item.estimatedExpenditure ?? item.budget ?? 0).toLocaleString()}</div>
              <div className="itn-muted">Estimated total cost for this trip</div>
            </div>
          </div>

          <div className="itn-stat purple">
            <div className="itn-stat-title">Stay</div>
            <div className="itn-stat-body">
              <div>{item.accomType || "Not planned"}</div>
              <div className="itn-muted">{item.accomName || "No details"}</div>
            </div>
          </div>

          <div className="itn-stat orange">
            <div className="itn-stat-title">Activities</div>
            <div className="itn-stat-body">
              <div>{activities.length} planned</div>
              {activities.length ? (
                <>
                  <div className="itn-muted" style={{ wordBreak: "break-word" }}>
                    {showAllActivities
                      ? activities.join(", ")
                      : activities.slice(0, 3).join(", ")}
                    {showToggle && !showAllActivities && "…"}
                  </div>
                  {showToggle && (
                    <button
                      className="itn-btn ghost"
                      style={{ marginTop: 4, fontSize: 12, padding: "2px 8px" }}
                      onClick={() => setShowAllActivities((v) => !v)}
                    >
                      {showAllActivities ? "Show Less" : "Show All"}
                    </button>
                  )}
                </>
              ) : (
                <div className="itn-muted">—</div>
              )}
            </div>
          </div>
        </div>

        {/* UPDATED Tools dropdown - now opens UPWARD */}
        <div style={{ 
          textAlign: "right", 
          marginTop: 12, 
          display: "flex", 
          gap: 8, 
          justifyContent: "flex-end",
          position: "relative",
          zIndex: 10
        }}>
          <button
            className="itn-btn primary"
            onClick={(e) => {
              e.stopPropagation();
              setShowToolsMenu(!showToolsMenu);
            }}
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 6,
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              color: "#fff",
              border: "none",
              padding: "10px 18px",
              borderRadius: "10px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: showToolsMenu ? "0 4px 12px rgba(99, 102, 241, 0.3)" : "none"
            }}
          >
            🛠️ Tools
            <span style={{ 
              fontSize: "10px",
              transform: showToolsMenu ? "rotate(0deg)" : "rotate(180deg)", // CHANGED: Flip rotation
              transition: "transform 0.2s"
            }}>▲</span> {/* CHANGED: Changed from ▼ to ▲ */}
          </button>

          {/* Tools Dropdown Menu - CHANGED: Now opens upward */}
          {showToolsMenu && (
            <div 
              className="itn-tools-menu"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                bottom: "calc(100% + 8px)", // CHANGED: from 'top' to 'bottom'
                right: 0,
                background: "#fff",
                border: "2px solid #6366f1",
                borderRadius: 12,
                boxShadow: "0 10px 40px rgba(99, 102, 241, 0.25)",
                zIndex: 9999,
                minWidth: 240,
                overflow: "hidden",
                animation: "slideUp 0.2s ease-out" // CHANGED: from slideDown to slideUp
              }}
            >
              <button
                onClick={() => {
                  setShowSummary(true);
                  setShowToolsMenu(false);
                }}
                className="itn-tools-menu-item"
              >
                <span style={{ fontSize: "18px" }}>📋</span>
                <span>View Summary</span>
              </button>

              <button
                onClick={() => {
                  setShowCostEstimation(true);
                  setShowToolsMenu(false);
                }}
                className="itn-tools-menu-item"
              >
                <span style={{ fontSize: "18px" }}>🚗</span>
                <span>Estimate Transport Cost</span>
              </button>

              <button
                onClick={() => {
                  setShowHotels(true);
                  setShowToolsMenu(false);
                }}
                className="itn-tools-menu-item"
              >
                <span style={{ fontSize: "18px" }}>🏨</span>
                <span>View Accredited Hotels</span>
              </button>

              <div style={{ 
                height: "1px", 
                background: "linear-gradient(90deg, transparent, #e5e7eb, transparent)",
                margin: "4px 0"
              }}></div>

              <button
                onClick={() => {
                  setShowAgency(true);
                  setShowToolsMenu(false);
                }}
                className="itn-tools-menu-item"
              >
                <span style={{ fontSize: "18px" }}>✈️</span>
                <span>Travel Agencies</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Render modals using Portal */}
      {showSummary && (
        <ItinerarySummaryModal
          item={item}
          onClose={() => setShowSummary(false)}
        />
      )}

      {showHotels && (
        <ItineraryHotelsModal
          open={showHotels}
          onClose={() => setShowHotels(false)}
          onSelect={(hotel) => {
            setShowHotels(false);
            if (setEditing && setSharedItineraryId) {
              setEditing({
                ...item,
                accomType: hotel.type,
                accomName: hotel.name,
                accomNotes: hotel.address,
              });
              setSharedItineraryId(sharedId);
            }
          }}
        />
      )}

      {showCostEstimation && (
        <ItineraryCostEstimationModal
          onClose={() => setShowCostEstimation(false)}
        />
      )}

      {/* ADD THIS - Travel Agency Modal */}
      {showAgency && (
        <ItineraryAgencyModal
          open={showAgency}
          onClose={() => setShowAgency(false)}
          onSelect={(agency) => {
            setShowAgency(false);
            if (setEditing && setSharedItineraryId && !readOnly) {
              setEditing({
                ...item,
                transportNotes: `${agency.name} - ${agency.phone || ''} ${agency.website || ''}`.trim(),
              });
              setSharedItineraryId(sharedId);
            }
          }}
        />
      )}
    </>
  );
}

// EditDestinationModal component for shared itineraries with Portal
export function SharedEditModal({ initial, onSave, onClose }) {
  const [notif, setNotif] = useState("");
  const [form, setForm] = useState({
    name: initial?.name || "",
    region: initial?.region || "",
    status: initial?.status || "Upcoming",
    arrival: initial?.arrival || "",
    departure: initial?.departure || "",
    transport: initial?.transport || "",
    estimatedExpenditure: initial?.estimatedExpenditure ?? initial?.budget ?? 0,
    accomType: initial?.accomType || "",
    accomName: initial?.accomName || "",
    accomNotes: initial?.accomNotes || "",
    activities: initial?.activities || [],
    activityDraft: "",
    transportNotes: initial?.transportNotes || "",
    notes: initial?.notes || "",
  });

  const addActivity = React.useCallback(() => {
    const v = form.activityDraft.trim();
    if (!v) return;
    setForm((f) => ({ ...f, activities: [...f.activities, v], activityDraft: "" }));
  }, [form.activityDraft]);
  
  const removeActivity = (i) =>
    setForm((f) => ({ ...f, activities: f.activities.filter((_, idx) => idx !== i) }));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onSave({
        ...initial,
        ...form,
        estimatedExpenditure: Number(form.estimatedExpenditure) || 0,
      });
      setNotif("Itinerary item updated successfully!");
      setTimeout(() => {
        setNotif("");
        onClose();
      }, 1200);
    } catch (err) {
      setNotif("Itinerary item update failed.");
      setTimeout(() => setNotif(""), 2000);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && document.activeElement?.id === "shared-activity-draft") {
        e.preventDefault();
        addActivity();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addActivity, onClose]);

  const modalContent = (
    <div className="itn-modal-backdrop" onClick={onClose}>
      <form className="itn-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="itn-modal-header">
          <div className="itn-modal-title">Edit Shared Destination</div>
          <button type="button" className="itn-close" onClick={onClose}>×</button>
        </div>

        <div className="itn-modal-body">
          <div className="itn-form-grid">
            <div className="itn-form-col">
              <div className="itn-grid">
                <label className="itn-field">
                  <span className="itn-label">Destination Name</span>
                  <input
                    className="itn-input"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="City or place name"
                  />
                </label>
                <label className="itn-field">
                  <span className="itn-label">Country/Region</span>
                  <input
                    className="itn-input"
                    name="region"
                    value={form.region}
                    onChange={handleChange}
                    placeholder="Region"
                  />
                </label>
              </div>

              <div className="itn-grid">
                <label className="itn-field">
                  <span className="itn-label">Arrival Date</span>
                  <input
                    type="date"
                    className="itn-input"
                    name="arrival"
                    value={form.arrival}
                    onChange={handleChange}
                  />
                </label>
                <label className="itn-field">
                  <span className="itn-label">Departure Date</span>
                  <input
                    type="date"
                    className="itn-input"
                    name="departure"
                    value={form.departure}
                    onChange={handleChange}
                  />
                </label>
                <label className="itn-field">
                  <span className="itn-label">Trip Status</span>
                  <select
                    className="itn-input"
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                  >
                    <option>Upcoming</option>
                    <option>Ongoing</option>
                    <option>Completed</option>
                    <option>Cancelled</option>
                  </select>
                </label>
              </div>

              <div className="itn-grid">
                <label className="itn-field">
                  <span className="itn-label">Estimated Expenditure (₱)</span>
                  <input
                    className="itn-input"
                    name="estimatedExpenditure"
                    type="number"
                    value={form.estimatedExpenditure}
                    onChange={handleChange}
                  />
                </label>
              </div>

              <div className="itn-field">
                <span className="itn-label">Activities & Things to Do</span>
                <div className="itn-grid-2">
                  <input
                    id="shared-activity-draft"
                    className="itn-input"
                    placeholder="e.g., Snorkeling, Hiking..."
                    value={form.activityDraft}
                    onChange={(e) => setForm({ ...form, activityDraft: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addActivity())}
                  />
                  <button type="button" className="itn-btn primary" onClick={addActivity}>
                    Add Activity
                  </button>
                </div>
                {form.activities.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {form.activities.map((act, i) => (
                      <div
                        key={i}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "linear-gradient(90deg, #a084ee 60%, #6c63ff 100%)",
                          color: "#fff",
                          borderRadius: 16,
                          padding: "4px 12px",
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        <span>{act}</span>
                        <button
                          type="button"
                          onClick={() => removeActivity(i)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#fff",
                            cursor: "pointer",
                            fontSize: 16,
                            lineHeight: 1,
                            padding: 0,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="itn-form-col">
              <div className="itn-field">
                <span className="itn-label">Accommodation Details</span>
                <div className="itn-grid-2">
                  <select
                    className="itn-input"
                    name="accomType"
                    value={form.accomType}
                    onChange={handleChange}
                  >
                    <option value="">Select type...</option>
                    <option>Hotel</option>
                    <option>Hostel</option>
                    <option>Apartment</option>
                    <option>Resort</option>
                    <option>Homestay</option>
                  </select>
                  <input
                    className="itn-input"
                    placeholder="Hotel/Place name"
                    name="accomName"
                    value={form.accomName}
                    onChange={handleChange}
                  />
                </div>
                <textarea
                  rows={2}
                  className="itn-input"
                  name="accomNotes"
                  placeholder="Address, booking details..."
                  value={form.accomNotes}
                  onChange={handleChange}
                />
              </div>

              <div className="itn-field">
                <span className="itn-label">Transport</span>
                <div className="itn-grid-2">
                  <select
                    className="itn-input"
                    name="transport"
                    value={form.transport}
                    onChange={handleChange}
                  >
                    <option value="">Select transportation...</option>
                    <option>Flight</option>
                    <option>Train</option>
                    <option>Bus</option>
                    <option>Car</option>
                    <option>Ferry</option>
                  </select>
                </div>
                <textarea
                  rows={2}
                  className="itn-input"
                  name="transportNotes"
                  placeholder="Transport notes..."
                  value={form.transportNotes}
                  onChange={handleChange}
                />
              </div>

              <div className="itn-field">
                <span className="itn-label">Additional Notes</span>
                <textarea
                  rows={3}
                  className="itn-input"
                  name="notes"
                  placeholder="Any other important details..."
                  value={form.notes}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="itn-modal-footer">
          <button type="button" className="itn-btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="itn-btn primary">Save Details</button>
        </div>
        {notif && (
          <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", background: "#6c63ff", color: "#fff", padding: "8px 16px", borderRadius: 8, zIndex: 10001 }}>
            {notif}
          </div>
        )}
      </form>
    </div>
  );

  // Render to body using Portal
  return ReactDOM.createPortal(modalContent, document.body);
}

// Summary Modal with Portal
export function ItinerarySummaryModal({ item, onClose }) {
  if (!item) return null;

  const totalDays = item.arrival && item.departure 
    ? Math.ceil((new Date(item.departure) - new Date(item.arrival)) / (1000 * 60 * 60 * 24)) 
    : 0;

  const modalContent = (
    <div className="itn-modal-backdrop itn-summary-backdrop" onClick={onClose}>
      <div className="itn-modal" onClick={(e) => e.stopPropagation()}>
        <div className="itn-modal-header">
          <div className="itn-modal-title">📋 Trip Summary</div>
          <button className="itn-close" onClick={onClose}>×</button>
        </div>

        <div className="itn-modal-body">
          <div className="itn-summary-content">
            <div className="itn-summary-section">
              <h3 className="itn-summary-heading">📍 Destination</h3>
              <div className="itn-summary-item">
                <strong>{item.name}</strong>
                {item.region && <span className="itn-summary-region">{item.region}</span>}
                {/* ADD THIS - Display location */}
                {item.location && (
                  <div style={{ marginTop: 8, fontSize: '0.95rem', color: '#64748b' }}>
                    <span className="itn-summary-label">📌 Location: </span>
                    <span>{item.location}</span>
                  </div>
                )}
              </div>
            </div>

            {(item.arrival || item.departure) && (
              <div className="itn-summary-section">
                <h3 className="itn-summary-heading">📅 Travel Dates</h3>
                <div className="itn-summary-grid">
                  {item.arrival && (
                    <div className="itn-summary-item">
                      <span className="itn-summary-label">Arrival:</span>
                      <span>{new Date(item.arrival).toLocaleDateString()}</span>
                    </div>
                  )}
                  {item.departure && (
                    <div className="itn-summary-item">
                      <span className="itn-summary-label">Departure:</span>
                      <span>{new Date(item.departure).toLocaleDateString()}</span>
                    </div>
                  )}
                  {totalDays > 0 && (
                    <div className="itn-summary-item">
                      <span className="itn-summary-label">Duration:</span>
                      <span>{totalDays} day{totalDays !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {item.estimatedExpenditure > 0 && (
              <div className="itn-summary-section">
                <h3 className="itn-summary-heading">💰 Budget</h3>
                <div className="itn-summary-item">
                  <span className="itn-summary-amount">
                    ₱{Number(item.estimatedExpenditure).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {item.activities && item.activities.length > 0 && (
              <div className="itn-summary-section">
                <h3 className="itn-summary-heading">🎯 Activities</h3>
                <div className="itn-summary-tags">
                  {item.activities.map((activity, idx) => (
                    <span key={idx} className="itn-summary-tag">{activity}</span>
                  ))}
                </div>
              </div>
            )}

            {(item.accomType || item.accomName) && (
              <div className="itn-summary-section">
                <h3 className="itn-summary-heading">🏨 Accommodation</h3>
                <div className="itn-summary-item">
                  {item.accomType && <span className="itn-summary-badge">{item.accomType}</span>}
                  {item.accomName && <strong>{item.accomName}</strong>}
                  {item.accomNotes && <p className="itn-summary-notes">{item.accomNotes}</p>}
                </div>
              </div>
            )}

            {item.transport && (
              <div className="itn-summary-section">
                <h3 className="itn-summary-heading">🚗 Transportation</h3>
                <div className="itn-summary-item">
                  <span className="itn-summary-badge">{item.transport}</span>
                  {item.transportNotes && <p className="itn-summary-notes">{item.transportNotes}</p>}
                </div>
              </div>
            )}

            {item.notes && (
              <div className="itn-summary-section">
                <h3 className="itn-summary-heading">📝 Notes</h3>
                <div className="itn-summary-item">
                  <p className="itn-summary-notes">{item.notes}</p>
                </div>
              </div>
            )}

            <div className="itn-summary-section">
              <h3 className="itn-summary-heading">✅ Status</h3>
              <div className="itn-summary-item">
                <span className={`itn-summary-status ${item.status.toLowerCase()}`}>
                  {item.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="itn-modal-footer">
          <button className="itn-btn primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );

  // Render to body using Portal
  return ReactDOM.createPortal(modalContent, document.body);
}

// Enhanced function to share itineraries with friends
export async function shareItinerary(user, items, itemIds, friendIds) {
  if (!user || !itemIds.length || !friendIds.length) {
    console.error("Missing required data for sharing:", { user: !!user, itemsCount: itemIds.length, friendsCount: friendIds.length });
    return;
  }
  
  console.log("Starting share operation:", { itemIds, friendIds });
  
  try {
    await ensureCollectionExists("sharedItineraries");
    await ensureCollectionExists("notifications");
    
    const itemsToShare = items.filter(item => itemIds.includes(item.id));
    const sharedDocRef = doc(collection(db, "sharedItineraries"));
    const timestamp = serverTimestamp();
    const sharedWithAll = Array.from(new Set([...friendIds, user.uid]));

    await setDoc(sharedDocRef, {
      sharedBy: user.uid,
      sharedWith: sharedWithAll,
      sharedAt: timestamp,
      name: `Shared by ${user.displayName || user.email || 'a friend'}`,
      itemCount: itemIds.length,
      collaborative: true,
      lastUpdated: timestamp,
      owner: {
        uid: user.uid,
        name: user.displayName || user.email || 'Unknown',
        photoURL: user.photoURL || null
      }
    });

    const batch = writeBatch(db);
    const idMap = [];
    for (const item of itemsToShare) {
      const { id: originalId, ...rest } = item;
      const itemRef = doc(collection(db, "sharedItineraries", sharedDocRef.id, "items"));
      idMap.push({ originalId, sharedItemId: itemRef.id });
      batch.set(itemRef, {
        ...rest,
        originalId,
        sharedAt: timestamp,
        lastEditedBy: user.uid,
        lastEditedByName: user.displayName || user.email || 'Owner',
        updatedAt: timestamp
      });
    }
    await batch.commit();

    const delBatch = writeBatch(db);
    for (const m of idMap) {
      delBatch.delete(doc(db, "itinerary", user.uid, "items", m.originalId));
    }
    await delBatch.commit();
    console.log("Moved items to shared itinerary and removed personal copies");
    
    // Log activity for sharing itinerary
    await logActivity(
      `Shared itinerary with ${friendIds.length} friend${friendIds.length > 1 ? 's' : ''} (${itemIds.length} destination${itemIds.length > 1 ? 's' : ''})`,
      "🔗"
    );
    
    await checkMiniPlannerAchievement(user);
    
    const notificationBatch = writeBatch(db);
    for (const friendId of friendIds) {
      try {
        const notifRef = doc(collection(db, "notifications"));
        notificationBatch.set(notifRef, {
          userId: friendId,
          type: "ITINERARY_SHARED",
          message: `${user.displayName || user.email || 'A friend'} shared an itinerary with you`,
          read: false,
          createdAt: timestamp,
          data: {
            sharedBy: user.uid,
            sharedByName: user.displayName || user.email || 'Friend',
            sharedById: user.uid,
            itemCount: itemIds.length,
            itineraryId: sharedDocRef.id
          }
        });
      } catch (notifErr) {
        console.error(`Error preparing notification: ${notifErr.message}`, notifErr);
      }
    }
    
    await notificationBatch.commit();
    console.log(`Created notifications for ${friendIds.length} friends`);
    console.log("Share operation completed successfully");
    return sharedDocRef.id;
  } catch (err) {
    console.error("Error sharing itinerary:", err);
    throw err;
  }
}

// REPLACE the current useSharedItineraries implementation with this
export function useSharedItineraries(user) {
  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setSharedWithMe([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const sharedRef = collection(db, "sharedItineraries");
    const qy = query(sharedRef, where("sharedWith", "array-contains", user.uid));

    const itemUnsubs = new Map();

    const unSubParent = onSnapshot(
      qy,
      (snap) => {
        const currentIds = new Set(snap.docs.map(d => d.id));
        for (const [id, fn] of itemUnsubs.entries()) {
          if (!currentIds.has(id)) {
            try { fn(); } catch {}
            itemUnsubs.delete(id);
          }
        }

        const bases = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            sharedBy: {
              id: data.sharedBy,
              name: data.owner?.name || "Traveler",
              profilePicture: data.owner?.photoURL || "/user.png",
            },
            sharedAt: data.sharedAt?.toDate?.() || new Date(),
            lastUpdated: data.lastUpdated?.toDate?.() || data.sharedAt?.toDate?.() || new Date(),
            collaborative: !!data.collaborative,
            sharedWith: data.sharedWith || [],
            items: []
          };
        });

        // Attach/refresh item listeners
        for (const d of snap.docs) {
          if (itemUnsubs.has(d.id)) continue;
          const itemsRef = collection(db, "sharedItineraries", d.id, "items");
          const itemsUnsub = onSnapshot(itemsRef, (itemsSnap) => {
            const sortedItems = itemsSnap.docs
              .map(x => ({ ...x.data(), id: x.id }))
              .sort((a, b) => (a.arrival || "").localeCompare(b.arrival || ""));

            // If no items remain, drop the group immediately (no residue)
            if (sortedItems.length === 0) {
              setSharedWithMe(prev => prev.filter(s => s.id !== d.id));
              return;
            }

            setSharedWithMe(prev => {
              const arr = prev.slice();
              const idx = arr.findIndex(s => s.id === d.id);
              if (idx >= 0) {
                arr[idx] = { ...arr[idx], items: sortedItems, lastUpdated: new Date() };
              } else {
                arr.push({
                  id: d.id,
                  sharedBy: { id: "", name: "Traveler", profilePicture: "/user.png" },
                  sharedAt: new Date(),
                  lastUpdated: new Date(),
                  collaborative: true,
                  sharedWith: [],
                  items: sortedItems
                });
              }
              return arr;
            });
          });
          itemUnsubs.set(d.id, itemsUnsub);
        }

        // Merge bases with previous items, but only keep docs in current snapshot
        setSharedWithMe(prev => {
          const merged = bases.map(b => {
            const existing = prev.find(p => p.id === b.id);
            return { ...b, items: existing?.items || [] };
          });
          merged.sort((a, b) => {
            const ta = a.lastUpdated instanceof Date ? a.lastUpdated.getTime() : new Date(a.lastUpdated).getTime();
            const tb = b.lastUpdated instanceof Date ? b.lastUpdated.getTime() : new Date(b.lastUpdated).getTime();
            return tb - ta;
          });
          return merged;
        });

        setLoading(false);
      },
      (err) => {
        console.error("Shared itineraries parent listener error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      try { unSubParent(); } catch {}
      for (const fn of itemUnsubs.values()) {
        try { fn(); } catch {}
      }
      itemUnsubs.clear();
    };
  }, [user]);

  return { sharedWithMe, loading, error };
}

// Make sure useFriendsList is defined BEFORE any component that might use it
export function useFriendsList(user) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setFriends([]);
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    console.log("Fetching friends list for user:", user.uid);

    const friendsRef = collection(db, "users", user.uid, "friends");
    
    const unsubscribe = onSnapshot(
      friendsRef,
      async (snapshot) => {
        try {
          const friendsList = [];
          
          // FIX: rename loop variable to avoid shadowing Firestore doc()
          for (const friendDoc of snapshot.docs) {
            const friendData = friendDoc.data();
            const friendId = friendData.userId || friendDoc.id;
            
            try {
              const userSnap = await getDoc(doc(db, "users", friendId));
              if (userSnap.exists()) {
                const userData = userSnap.data();
                friendsList.push({
                  id: friendId,
                  name: userData.displayName || userData.name || "User",
                  email: userData.email || "",
                  profilePicture: userData.photoURL || userData.profilePicture || "/user.png",
                  status: friendData.status || "active",
                  addedAt: friendData.addedAt?.toDate() || new Date()
                });
              } else {
                friendsList.push({
                  id: friendId,
                  name: friendData.name || "Unknown User",
                  email: friendData.email || "",
                  profilePicture: "/user.png",
                  status: friendData.status || "active",
                  addedAt: friendData.addedAt?.toDate() || new Date()
                });
              }
            } catch (err) {
              console.error(`Error fetching friend user data for ${friendId}:`, err);
            }
          }

          friendsList.sort((a, b) => a.name.localeCompare(b.name));
          setFriends(friendsList);
          setLoading(false);
        } catch (err) {
          console.error("Error processing friends data:", err);
          setError(err);
          setLoading(false);
        }
      },
      (err) => {
        console.error("Error in friends list listener:", err);
        setError(err);
        setLoading(false);
      }
    );
    
    return () => unsubscribe();
  }, [user]);

  return friends;
}

// Enhanced SharedItinerariesTab component that shows loading state
export function SharedItinerariesTab({ user }) {
  const [editing, setEditing] = useState(null);
  const [sharedItineraryId, setSharedItineraryId] = useState(null);
  const { sharedWithMe, loading, error } = useSharedItineraries(user);
  const [copyingId, setCopyingId] = useState(null); // <-- ADD THIS LINE
  
  // ADD THESE NEW STATES
  const [groupBy, setGroupBy] = useState('none');
  const [filterStatus, setFilterStatus] = useState('all');

  const visibleShared = useMemo(
    () => sharedWithMe.filter(s => Array.isArray(s.items) && s.items.length > 0),
    [sharedWithMe]
  );

  // ADD THIS HELPER FUNCTION
  const groupedSharedItems = useMemo(() => {
    const allItems = visibleShared.flatMap(shared => 
      shared.items.map(item => ({ ...item, sharedId: shared.id, sharedBy: shared.sharedBy }))
    );
    
    let filtered = allItems;
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(item => 
        (item.status || 'upcoming').toLowerCase() === filterStatus.toLowerCase()
      );
    }
    
    if (groupBy === 'status') {
      const groups = { upcoming: [], ongoing: [], completed: [], cancelled: [] };
      filtered.forEach(item => {
        const status = (item.status || 'upcoming').toLowerCase();
        if (groups[status]) groups[status].push(item);
      });
      return Object.entries(groups).filter(([_, items]) => items.length > 0);
    } else if (groupBy === 'date') {
      const groups = {};
      filtered.forEach(item => {
        const year = item.arrival ? new Date(item.arrival).getFullYear() : 'No Date';
        if (!groups[year]) groups[year] = [];
        groups[year].push(item);
      });
      return Object.entries(groups).sort((a, b) => {
        if (a[0] === 'No Date') return 1;
        if (b[0] === 'No Date') return -1;
        return Number(b[0]) - Number(a[0]);
      });
    } else if (groupBy === 'owner') {
      const groups = {};
      filtered.forEach(item => {
        const owner = item.sharedBy?.name || 'Unknown';
        if (!groups[owner]) groups[owner] = [];
        groups[owner].push(item);
      });
      return Object.entries(groups);
    }
    
    return [['all', filtered]];
  }, [visibleShared, groupBy, filterStatus]);

  const canEditShared = (shared) =>
    !!user &&
    shared.collaborative &&
    (shared.sharedBy.id === user.uid || (shared.sharedWith || []).includes(user.uid));

  const handleCopyToMyItinerary = async (shared) => {
    if (!user || !shared) return;
    if (!shared.items || shared.items.length === 0) return;
    try {
      setCopyingId(shared.id);
      const batch = writeBatch(db);
      for (const it of shared.items) {
        const { id: sharedItemId, ...payload } = it;
        const destRef = doc(collection(db, "itinerary", user.uid, "items"));
        batch.set(destRef, {
          ...payload,
          importedAt: serverTimestamp(),
          isShared: false,
          sharedFrom: shared.id
        });
      }
      await batch.commit();
      await updateDoc(doc(db, "sharedItineraries", shared.id), {
        lastUpdated: serverTimestamp()
      });
    } catch (e) {
      console.error("Copy to My Itinerary failed:", e);
      alert("Failed to copy. Please try again.");
    } finally {
      setCopyingId(null);
    }
  };

  const handleToggleStatus = async (sharedId, itemId) => {
    const shared = sharedWithMe.find(s => s.id === sharedId);
    if (!shared || !canEditShared(shared)) return;
    
    try {
      const item = shared.items.find(i => i.id === itemId);
      if (!item) return;
      
      const statusFlow = {
        'Upcoming': 'Ongoing',
        'Ongoing': 'Completed',
        'Completed': 'Cancelled',
        'Cancelled': 'Upcoming'
      };
      
      const currentStatus = item.status || 'Upcoming';
      const nextStatus = statusFlow[currentStatus] || 'Upcoming';
      
      // CONFIRMATION DIALOG WITH EMOJIS
      const statusEmojis = {
        'Upcoming': '🔜',
        'Ongoing': '⏳',
        'Completed': '✅',
        'Cancelled': '❌'
      };
      
      const confirmMessage = `Are you sure you want to change the status for "${item.name}"?\n\n` +
        `${statusEmojis[currentStatus]} Current: ${currentStatus}\n` +
        `${statusEmojis[nextStatus]} Next: ${nextStatus}`;
      
      if (!window.confirm(confirmMessage)) {
        return; // User cancelled
      }
      
      await updateDoc(doc(db, "sharedItineraries", sharedId, "items", itemId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
        lastEditedBy: user.uid,
        lastEditedByName: user.displayName || user.email || 'User'
      });
      
      await updateDoc(doc(db, "sharedItineraries", sharedId), {
        lastUpdated: serverTimestamp()
      });

      // Track completion stats
      if (nextStatus === "Completed" && currentStatus !== "Completed") {
        await trackDestinationCompleted(user.uid, {
          id: item.id,
          name: item.name,
          region: item.region,
          arrival: item.arrival,
          departure: item.departure,
        });
        
        try {
          await unlockAchievement(8, "Checklist Champ");
        } catch (error) {
          console.error("Error unlocking Checklist Champ achievement:", error);
        }
      } else if (currentStatus === "Completed" && nextStatus !== "Completed") {
        await trackDestinationUncompleted(user.uid, {
          id: item.id,
          name: item.name,
          region: item.region,
        });
      }
    } catch (e) {
      console.error("Toggle status failed:", e);
      alert("Failed to update status. Please try again.");
    }
  };

  const handleSaveEdit = async (data) => {
    if (!sharedItineraryId) return;
    const shared = sharedWithMe.find(s => s.id === sharedItineraryId);
    if (!shared || !canEditShared(shared)) return;
    try {
      await updateDoc(doc(db, "sharedItineraries", sharedItineraryId, "items", data.id), {
        ...data,
        updatedAt: serverTimestamp(),
        lastEditedBy: user.uid,
        lastEditedByName: user.displayName || user.email || 'User'
      });
      await updateDoc(doc(db, "sharedItineraries", sharedItineraryId), {
        lastUpdated: serverTimestamp()
      });
      
      await checkMiniPlannerAchievement(user);
      
      setEditing(null);
      setSharedItineraryId(null);
    } catch (e) {
      console.error("Edit save failed:", e);
    }
  };

  const handleRemoveItem = async (sharedId, itemId) => {
    const shared = sharedWithMe.find(s => s.id === sharedId);
    if (!shared || !canEditShared(shared)) return;
    if (!window.confirm("Remove this destination?")) return;

    try {
      await deleteDoc(doc(db, "sharedItineraries", sharedId, "items", itemId));

      const remainingSnap = await getDocs(collection(db, "sharedItineraries", sharedId, "items"));
      if (remainingSnap.empty) {
        if (shared.sharedBy.id === user.uid) {
          await deleteSharedItinerary(sharedId);
        } else {
          await updateDoc(doc(db, "sharedItineraries", sharedId), {
            sharedWith: arrayRemove(user.uid)
          });
        }
      } else {
        await updateDoc(doc(db, "sharedItineraries", sharedId), {
          lastUpdated: serverTimestamp(),
          itemCount: remainingSnap.size
        });
      }
    } catch (e) {
      console.error("Remove failed:", e);
    }
  };

  const handleEditItem = (sharedId, item) => {
    setEditing(item);
    setSharedItineraryId(sharedId);
  };

  // Add this effect to check achievement when shared itineraries change
  useEffect(() => {
    const checkAchievement = async () => {
      if (!user || loading) return;
      
      try {
        // Count personal items
        const personalSnap = await getDocs(
          collection(db, "itinerary", user.uid, "items")
        );
        const personalCount = personalSnap.size;
        
        // Count shared items
        const sharedCount = sharedWithMe.reduce(
          (sum, s) => sum + (s.items?.length || 0),
          0
        );
        
        const totalDestinations = personalCount + sharedCount;
        
        if (totalDestinations >= 3) {
          await unlockAchievement(6, "Mini Planner");
        }
      } catch (error) {
        console.error("Error checking achievement:", error);
      }
    };
    
    checkAchievement();
  }, [user, sharedWithMe, loading]);

  if (loading) {
    return (
      <div className="itn-loading">
        <div className="itn-spinner"></div>
        <div>Loading shared itineraries...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="itn-error">
        <div className="itn-error-icon">❌</div>
        <div className="itn-error-message">Failed to load shared itineraries.</div>
      </div>
    );
  }

  if (visibleShared.length === 0) {
    return (
      <div className="itn-empty-state">
        <div className="itn-empty-icon">📭</div>
        <div className="itn-empty-title">No Shared Itineraries</div>
        <div className="itn-empty-description">
          You don't have any shared itineraries yet.
        </div>
      </div>
    );
  }

  const totalItems = visibleShared.reduce((sum, s) => sum + (s.items?.length || 0), 0);

  return (
    <div className="itn-shared-itineraries-tab">
      {/* Grouping & Filter Controls */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 16,
        flexWrap: 'wrap',
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
        borderRadius: 12,
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
            Group By
          </label>
          <select className="itn-input" value={groupBy} onChange={(e) => setGroupBy(e.target.value)} 
            style={{ fontSize: 14, padding: '8px 12px', background: '#fff' }}>
            <option value="none">No Grouping</option>
            <option value="status">Status</option>
            <option value="date">Year</option>
            <option value="owner">Shared By</option>
          </select>
        </div>
        
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
            Filter Status
          </label>
          <select className="itn-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            style={{ fontSize: 14, padding: '8px 12px', background: '#fff' }}>
            <option value="all">All ({totalItems})</option>
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Grouped Items */}
      {groupedSharedItems.every(([_, items]) => items.length === 0) ? (
        <div className="itn-empty-state">
          <div className="itn-empty-icon">🔍</div>
          <div className="itn-empty-title">No destinations match your filter</div>
        </div>
      ) : (
        groupedSharedItems.map(([groupName, groupItems]) => (
          <div key={groupName} style={{ marginBottom: 24 }}>
            {groupBy !== 'none' && (
              <div style={{
                padding: '12px 16px',
                background: 'linear-gradient(135deg, #6c63ff 0%, #a084ee 100%)',
                color: '#fff',
                borderRadius: 12,
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontWeight: 700,
                fontSize: 16,
                boxShadow: '0 4px 12px rgba(108, 99, 255, 0.3)'
              }}>
                {groupBy === 'status' && (
                  <>
                    {groupName === 'upcoming' && '🔜'}
                    {groupName === 'ongoing' && '⏳'}
                    {groupName === 'completed' && '✅'}
                    {groupName === 'cancelled' && '❌'}
                  </>
                )}
                {groupBy === 'date' && '📅'}
                {groupBy === 'owner' && '👤'}
                <span style={{ textTransform: 'capitalize' }}>{groupName}</span>
                <span style={{ 
                  marginLeft: 'auto', 
                  background: 'rgba(255,255,255,0.2)',
                  padding: '4px 12px',
                  borderRadius: 16,
                  fontSize: 14
                }}>{groupItems.length}</span>
              </div>
            )}
            
            {groupItems.map((item) => {
              const shared = visibleShared.find(s => s.id === item.sharedId);
              const canEdit = canEditShared(shared);
              
              return (
                <div key={item.id} style={{ marginBottom: 12 }}>
                  <SharedDestinationCard
                    item={item}
                    index={0}
                    onEdit={handleEditItem}
                    onRemove={handleRemoveItem}
                    onToggleStatus={handleToggleStatus}
                    readOnly={!canEdit}
                    isOwner={shared.sharedBy.id === user.uid}
                    setEditing={setEditing}
                    setSharedItineraryId={setSharedItineraryId}
                    sharedId={item.sharedId}
                  />
                </div>
              );
            })}
          </div>
        ))
      )}

      {editing && sharedItineraryId && (
        <SharedEditModal
          initial={editing}
          onSave={handleSaveEdit}
          onClose={() => {
            setEditing(null);
            setSharedItineraryId(null);
          }}
        />
      )}
    </div>
  );
}

// Add these helper functions after the checkMiniPlannerAchievement function

async function checkMiniPlannerAchievement(user) {
  if (!user) return;
  
  try {
    // Count personal itinerary items
    const personalSnap = await getDocs(
      collection(db, "itinerary", user.uid, "items")
    );
    const personalCount = personalSnap.size;
    
    // Count shared items
    const sharedCount = sharedWithMe.reduce(
      (sum, s) => sum + (s.items?.length || 0),
      0
    );
    
    const totalDestinations = personalCount + sharedCount;
    
    if (totalDestinations >= 3) {
      await unlockAchievement(6, "Mini Planner");
    }
  } catch (error) {
    console.error("Error checking Mini Planner achievement:", error);
  }
}

// Add these new export functions
export async function deleteTripDestination(user, itemId) {
  if (!user || !itemId) return;
  
  try {
    // Delete from personal itinerary
    await deleteDoc(doc(db, "itinerary", user.uid, "items", itemId));
    console.log("Deleted trip destination:", itemId);
  } catch (error) {
    console.error("Error deleting trip destination:", error);
    throw error;
  }
}

export async function clearAllTripDestinations(user) {
  if (!user) return;
  
  try {
    // Get all items from personal itinerary
    const itemsRef = collection(db, "itinerary", user.uid, "items");
    const snapshot = await getDocs(itemsRef);
    
    // Delete all items in a batch
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log("Cleared all trip destinations");
  } catch (error) {
    console.error("Error clearing all trip destinations:", error);
    throw error;
  }
}

// Add this helper function to delete a shared itinerary
async function deleteSharedItinerary(sharedId) {
  if (!sharedId) return;
  
  try {
    // Delete all items in the shared itinerary
    const itemsRef = collection(db, "sharedItineraries", sharedId, "items");
    const itemsSnap = await getDocs(itemsRef);
    
    const batch = writeBatch(db);
    itemsSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    // Delete the shared itinerary document itself
    batch.delete(doc(db, "sharedItineraries", sharedId));
    
    await batch.commit();
    console.log("Deleted shared itinerary:", sharedId);
  } catch (error) {
    console.error("Error deleting shared itinerary:", error);
    throw error;
  }
}

// Add this helper function after the imports
async function logActivity(text, icon = "🔵") {
  try {
    const user = auth.currentUser;
    if (!user) return;

    await addDoc(collection(db, "activities"), {
      userId: user.uid,
      text,
      icon,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}