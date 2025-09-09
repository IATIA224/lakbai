import React, { useState, useEffect, useMemo } from "react";
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
import { db } from "./firebase";
import './itinerary2.css';

// Helper function to ensure collections exist
async function ensureCollectionExists(path) {
  try {
    // Create a dummy document and immediately delete it
    // This ensures the collection path exists
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

// Share Modal Component
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
  
  return (
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
}

// Enhanced DestinationCard that supports read-only mode for shared itineraries
export function SharedDestinationCard({ 
  item, 
  index, 
  onEdit, 
  onRemove, 
  onToggleStatus, 
  readOnly = false,
  isOwner = false // New prop to track if the user is the original owner
}) {
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

  return (
    <div className="itn-card">
      <div className="itn-card-head">
        <div className="itn-card-title">
          <span className="itn-step">{index + 1}</span>
          <div>
            <div className="itn-name">{item.name || "Destination"}</div>
            <div className="itn-sub">{item.region}</div>
          </div>
        </div>
        <div className="itn-actions">
          <span className={`itn-badge ${item.status.toLowerCase()}`}>{item.status}</span>
          
          {!readOnly && (
            <>
              <button className="itn-btn" onClick={() => onToggleStatus(item.id)}>Toggle Status</button>
              <button className="itn-btn" onClick={() => onEdit(item)}>Edit</button>
              <button className="itn-btn danger" onClick={() => onRemove(item.id)}>Remove</button>
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
          <div className="itn-stat-title">Budget</div>
          <div className="itn-stat-body">
            <div>${item.budget || 0}</div>
            <div className="itn-muted">Hotel: ${item.accomBudget || 0}</div>
            <div className="itn-muted">Activities: ${item.activityBudget || 0}</div>
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
            <div>{item.activities?.length || 0} planned</div>
            {item.activities?.length ? (
              <div className="itn-muted">{item.activities.slice(0, 3).join(", ")}</div>
            ) : (
              <div className="itn-muted">—</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// EditDestinationModal component for shared itineraries
export function SharedEditModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    region: initial?.region || "",
    status: initial?.status || "Upcoming",
    arrival: initial?.arrival || "",
    departure: initial?.departure || "",
    transport: initial?.transport || "",
    transportCost: initial?.transportCost || 0,
    budget: initial?.budget || 0,
    accomName: initial?.accomName || "",
    accomType: initial?.accomType || "",
    accomBudget: initial?.accomBudget || 0,
    activityBudget: initial?.activityBudget || 0,
    notes: initial?.notes || "",
    activities: initial?.activities || [],
    activityDraft: "",
    transportNotes: initial?.transportNotes || "",
    accomNotes: initial?.accomNotes || "",
  });

  const [notif, setNotif] = useState("");

  const addActivity = () => {
    const v = form.activityDraft.trim();
    if (!v) return;
    setForm((prev) => ({ 
      ...prev, 
      activities: [...prev.activities, v], 
      activityDraft: "" 
    }));
  };

  const removeActivity = (i) =>
    setForm((prev) => ({ 
      ...prev, 
      activities: prev.activities.filter((_, idx) => idx !== i) 
    }));

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onSave({
        ...initial,
        ...form,
        budget: Number(form.budget) || 0,
        accomBudget: Number(form.accomBudget) || 0,
        activityBudget: Number(form.activityBudget) || 0,
        transportCost: Number(form.transportCost) || 0,
      });
      setNotif("Itinerary item updated successfully!");
      setTimeout(() => {
        setNotif("");
        onClose();
      }, 1200);
    } catch (err) {
      setNotif("Failed to update itinerary item.");
      console.error("Error updating item:", err);
      setTimeout(() => setNotif(""), 2000);
    }
  };

  // Allow Enter to add activity and Esc to close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && document.activeElement?.id === "itn-activity-draft") {
        e.preventDefault();
        addActivity();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="itn-modal-backdrop" onClick={onClose}>
      <div
        className="itn-modal"
        style={{
          maxWidth: 700,
          boxShadow: "0 8px 32px rgba(108,99,255,0.12)",
          borderRadius: 16,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          maxHeight: "80vh",
          background: "#fff",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="itn-modal-header" style={{ padding: "24px 32px 12px 32px" }}>
          <div className="itn-modal-title">Edit Shared Destination</div>
          <button className="itn-close" onClick={onClose}>×</button>
        </div>

        <div
          className="itn-modal-body"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 32px 24px 32px",
            background: "#fafaff",
          }}
        >
          <div className="itn-form-grid" style={{ gap: 32 }}>
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
                  <span className="itn-label">Total Budget ($)</span>
                  <input
                    type="number"
                    className="itn-input"
                    name="budget"
                    value={form.budget}
                    onChange={handleChange}
                  />
                </label>
                <label className="itn-field">
                  <span className="itn-label">Accommodation ($)</span>
                  <input
                    type="number"
                    className="itn-input"
                    name="accomBudget"
                    value={form.accomBudget}
                    onChange={handleChange}
                  />
                </label>
                <label className="itn-field">
                  <span className="itn-label">Activities ($)</span>
                  <input
                    type="number"
                    className="itn-input"
                    name="activityBudget"
                    value={form.activityBudget}
                    onChange={handleChange}
                  />
                </label>
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
                  placeholder="Address, booking details, special notes..."
                  name="accomNotes"
                  value={form.accomNotes}
                  onChange={handleChange}
                />
              </div>

              <div className="itn-field">
                <span className="itn-label">Planned Activities</span>
                <div className="itn-row">
                  <input
                    id="itn-activity-draft"
                    className="itn-input"
                    placeholder="Add an activity..."
                    value={form.activityDraft}
                    onChange={(e) => setForm({...form, activityDraft: e.target.value})}
                  />
                  <button type="button" className="itn-btn success" onClick={addActivity}>
                    Add
                  </button>
                </div>
                {form.activities.length > 0 && (
                  <ul className="itn-chips">
                    {form.activities.map((a, i) => (
                      <li key={`${a}-${i}`} className="itn-chip">
                        {a}
                        <button onClick={() => removeActivity(i)}>×</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="itn-field">
                <span className="itn-label">Transportation</span>
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
                  <input
                    type="number"
                    className="itn-input"
                    placeholder="0"
                    name="transportCost"
                    value={form.transportCost}
                    onChange={handleChange}
                  />
                </div>
                <textarea
                  rows={2}
                  className="itn-input"
                  placeholder="Flight numbers, booking details, pickup times..."
                  name="transportNotes"
                  value={form.transportNotes}
                  onChange={handleChange}
                />
              </div>

              <label className="itn-field">
                <span className="itn-label">Additional Notes</span>
                <textarea
                  rows={2}
                  className="itn-input"
                  placeholder="Important information, reminders, contacts..."
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="itn-modal-footer" style={{
          padding: "16px 32px",
          borderTop: "1px solid #eee",
          background: "#fff",
          position: "sticky",
          bottom: 0,
          zIndex: 2,
        }}>
          <button className="itn-btn ghost" onClick={onClose}>Cancel</button>
          <button className="itn-btn primary" onClick={handleSubmit}>Save Details</button>
        </div>

        {/* Notification popup */}
        {notif && (
          <div
            style={{
              position: "absolute",
              top: 16,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#6c63ff",
              color: "#fff",
              padding: "10px 24px",
              borderRadius: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              fontWeight: 500,
              zIndex: 10,
            }}
          >
            {notif}
          </div>
        )}
      </div>
    </div>
  );
}

// Enhanced function to share itineraries with friends
export async function shareItinerary(user, items, itemIds, friendIds) {
  if (!user || !itemIds.length || !friendIds.length) {
    console.error("Missing required data for sharing:", { user: !!user, itemsCount: itemIds.length, friendsCount: friendIds.length });
    return;
  }
  
  console.log("Starting share operation:", { itemIds, friendIds });
  
  try {
    // First ensure the required collections exist
    await ensureCollectionExists("sharedItineraries");
    await ensureCollectionExists("notifications");
    
    // Get the items to share
    const itemsToShare = items.filter(item => itemIds.includes(item.id));

    // Create a single shared itinerary document
    const sharedDocRef = doc(collection(db, "sharedItineraries"));
    const timestamp = serverTimestamp();

    // IMPORTANT: include owner uid in sharedWith
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

    // Create shared items + map original -> new id
    const batch = writeBatch(db);
    const idMap = []; // { originalId, sharedItemId }
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

    // DELETE originals so only one canonical copy exists
    const delBatch = writeBatch(db);
    for (const m of idMap) {
      delBatch.delete(doc(db, "itinerary", user.uid, "items", m.originalId));
    }
    await delBatch.commit();
    console.log("Moved items to shared itinerary and removed personal copies");
    
    // Add notification for each friend
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
    
    // Commit all notifications at once
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
    const q = query(sharedRef, where("sharedWith", "array-contains", user.uid));

    // Keep track of per-itinerary item listeners
    const itemUnsubs = new Map();

    const unSubParent = onSnapshot(
      q,
      (snap) => {
        const next = [];

        // Clean up listeners for removed docs
        const currentIds = new Set(snap.docs.map(d => d.id));
        for (const [id, fn] of itemUnsubs.entries()) {
            if (!currentIds.has(id)) {
              fn();
              itemUnsubs.delete(id);
            }
        }

        snap.docs.forEach(sharedDoc => {
          const data = sharedDoc.data();
          // Seed object (items filled/updated by its own listener)
            let existing = sharedWithMe.find(s => s.id === sharedDoc.id);
            const base = {
              id: sharedDoc.id,
              sharedBy: {
                id: data.sharedBy,
                name: data.owner?.name || "Traveler",
                profilePicture: data.owner?.photoURL || "/user.png"
              },
              sharedAt: data.sharedAt?.toDate?.() || new Date(),
              lastUpdated: data.lastUpdated?.toDate?.() || data.sharedAt?.toDate?.() || new Date(),
              collaborative: !!data.collaborative,
              sharedWith: data.sharedWith || [],
              items: existing?.items || []
            };
            next.push(base);

            // Attach / refresh listener for items
            if (!itemUnsubs.has(sharedDoc.id)) {
              const itemsRef = collection(db, "sharedItineraries", sharedDoc.id, "items");
              const itemsUnsub = onSnapshot(itemsRef, itemsSnap => {
                setSharedWithMe(prev => {
                  const clone = [...prev];
                  const idx = clone.findIndex(s => s.id === sharedDoc.id);
                  const sortedItems = itemsSnap.docs
                    .map(d => ({
                      ...d.data(),        // data first
                      id: d.id            // ENSURE doc id wins
                    }))
                    .sort((a,b) => (a.arrival || '').localeCompare(b.arrival || ''));
                  if (idx >= 0) {
                    clone[idx] = { ...clone[idx], items: sortedItems, lastUpdated: new Date() };
                  } else {
                    clone.push({ ...base, items: sortedItems });
                  }
                  return clone;
                });
              });
              itemUnsubs.set(sharedDoc.id, itemsUnsub);
            }
        });

        // Merge structural changes (do not overwrite items already updated by item listeners)
        setSharedWithMe(prev => {
          const map = new Map(prev.map(p => [p.id, p]));
          next.forEach(n => {
            const existing = map.get(n.id);
            if (existing) {
              map.set(n.id, { ...existing, ...n, items: existing.items });
            } else {
              map.set(n.id, n);
            }
          });
          // Remove stale ones already cleaned above
          return Array.from(map.values()).sort((a,b)=> b.lastUpdated - a.lastUpdated);
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
      unSubParent();
      for (const fn of itemUnsubs.values()) fn();
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

  // Helper permission check
  const canEditShared = (shared) =>
    !!user &&
    shared.collaborative &&
    (shared.sharedBy.id === user.uid || (shared.sharedWith || []).includes(user.uid));

  const handleToggleStatus = async (sharedId, itemId) => {
    const shared = sharedWithMe.find(s => s.id === sharedId);
    if (!shared || !canEditShared(shared)) return;
    try {
      const item = shared.items.find(i => i.id === itemId);
      if (!item) return;
      const nextStatus =
        item.status === "Upcoming" ? "Ongoing" :
        item.status === "Ongoing" ? "Completed" : "Upcoming";
      await updateDoc(doc(db, "sharedItineraries", sharedId, "items", itemId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
        lastEditedBy: user.uid,
        lastEditedByName: user.displayName || user.email || 'User'
      });
      await updateDoc(doc(db, "sharedItineraries", sharedId), {
        lastUpdated: serverTimestamp()
      });
    } catch (e) {
      console.error("Toggle status failed:", e);
      alert("Failed to toggle status.");
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
      setEditing(null);
      setSharedItineraryId(null);
    } catch (e) {
      console.error("Edit save failed:", e);
      alert("Failed to save changes.");
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
        // If last item removed: owner deletes; others leave
        await leaveOrDeleteSharedItinerary(shared, user);
      } else {
        await updateDoc(doc(db, "sharedItineraries", sharedId), {
          lastUpdated: serverTimestamp(),
          itemCount: remainingSnap.size
        });
      }
    } catch (e) {
      console.error("Remove failed:", e);
      alert("Failed to remove.");
    }
  };

  const handleEditItem = (sharedId, item) => {
    setEditing(item);
    setSharedItineraryId(sharedId);
  };

  const handleCopyToMyItinerary = async (shared) => {
    if (!user) return;
    try {
      await setDoc(
        doc(db, "itinerary", user.uid),
        { owner: user.uid, updatedAt: serverTimestamp() },
        { merge: true }
      );
      const batch = writeBatch(db);
      shared.items.forEach(it => {
        const newRef = doc(collection(db, "itinerary", user.uid, "items"));
        const { id: _sharedItemId, ...rest } = it;
        batch.set(newRef, {
          ...rest,
          fromShared: {
            sharedItineraryId: shared.id,
            sharedItemId: _sharedItemId,
            sharedBy: shared.sharedBy.id
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
      alert(`Copied ${shared.items.length} items to your itinerary`);
    } catch (e) {
      console.error("Copy failed:", e);
      alert("Failed to copy.");
    }
  };

  const [purging, setPurging] = useState(false);
  const emptyOwned = sharedWithMe.filter(s => s.items.length === 0 && s.sharedBy.id === user?.uid);
  const purgeAll = async () => {
    if (!user) return;
    if (!emptyOwned.length) return;
    if (!window.confirm(`Delete ${emptyOwned.length} empty shared itinerary shell(s)? This removes them for everyone.`)) return;
    setPurging(true);
    try {
      const res = await cleanEmptySharedItinerariesForUser(user, { maxAgeMs: 0 });
      if (!res.removed) alert("No empty itineraries removed (maybe already gone).");
    } finally {
      setPurging(false);
    }
  };

  useEffect(() => {
    // Auto clean once on load
    if (user && !loading) {
      cleanEmptySharedItinerariesForUser(user).then(res => {
        if (res.removed) console.log(`[AUTO CLEAN] Removed ${res.removed} empty itineraries`);
      });
    }
  }, [user, loading]);

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
        <div>Error loading shared itineraries</div>
        <div>{error.message}</div>
        <button className="itn-btn" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <>
      {sharedWithMe.length === 0 ? (
        <div className="itn-empty">
          <div className="itn-empty-icon">🔄</div>
          <div className="itn-empty-title">No shared itineraries</div>
          <div className="itn-muted">
            When friends share their travel plans with you, they will appear here.
          </div>
        </div>
      ) : (
        sharedWithMe.map(shared => (
          <div className="itn-shared-group" key={shared.id}>
            <div className="itn-shared-header">
              <div className="itn-shared-info">
                <img 
                  src={shared.sharedBy.profilePicture || "/user.png"} 
                  alt={shared.sharedBy.name}
                  className="itn-shared-avatar"
                />
                <div>
                  <div className="itn-shared-by">Shared by {shared.sharedBy.name}</div>
                  <div className="itn-shared-date">
                    Shared: {new Date(shared.sharedAt).toLocaleDateString()} • 
                    Updated: {new Date(shared.lastUpdated).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button 
                  className="itn-btn primary"
                  onClick={() => handleCopyToMyItinerary(shared)}
                >
                  Copy to My Itinerary
                </button>
                {shared.items.length === 0 && (
                  <button
                    className="itn-btn danger"
                    onClick={() => {
                      if (window.confirm(
                        shared.sharedBy.id === user.uid
                          ? "Delete this empty shared itinerary for everyone?"
                          : "Leave this empty shared itinerary?"
                      )) {
                        leaveOrDeleteSharedItinerary(shared, user);
                      }
                    }}
                  >
                    {shared.sharedBy.id === user.uid ? "Delete" : "Leave"}
                  </button>
                )}
              </div>
            </div>
            
            {shared.items.length === 0 ? (
              <div className="itn-empty-sm">
                No destinations in this shared itinerary
              </div>
            ) : (
              shared.items.map((item, idx) => (
                <SharedDestinationCard
                  key={item.id}
                  item={item}
                  index={idx}
                  readOnly={!canEditShared(shared)}
                  isOwner={shared.sharedBy.id === user.uid}
                  onEdit={() => canEditShared(shared) && handleEditItem(shared.id, item)}
                  onRemove={() => canEditShared(shared) && handleRemoveItem(shared.id, item.id)}
                  onToggleStatus={() => canEditShared(shared) && handleToggleStatus(shared.id, item.id)}
                />
              ))
            )}

            {shared.items.length === 0 && shared.sharedBy.id === user?.uid && (
              <button
                className="itn-btn danger"
                style={{ marginLeft: 8 }}
                onClick={async () => {
                  if (window.confirm("Delete this empty shared itinerary?")) {
                    try {
                      await deleteSharedItinerary(shared.id);
                    } catch (e) {
                      alert("Failed to delete.");
                    }
                  }
                }}
              >
                Delete
              </button>
            )}
          </div>
        ))
      )}
      
      {editing && (
        <SharedEditModal
          initial={editing}
          onSave={handleSaveEdit}
          onClose={() => {
            setEditing(null);
            setSharedItineraryId(null);
          }}
        />
      )}

      {sharedWithMe.some(s => s.items.length === 0) && (
        <div style={{display:"flex",justifyContent:"flex-end",margin:"8px 0 16px"}}>
          <button
            className="itn-btn ghost"
            onClick={async () => {
              if (!user) return;
              if (!window.confirm("Clear all empty shared itineraries you are in?")) return;
              const empties = sharedWithMe.filter(s => s.items.length === 0);
              for (const sh of empties) {
                await leaveOrDeleteSharedItinerary(sh, user);
              }
            }}
          >
            Clear Empty ({sharedWithMe.filter(s=>s.items.length===0).length})
          </button>
        </div>
      )}
    </>
  );
}

// Make sure these are imported (add if missing):
// import { collection, doc, getDocs, query, limit, writeBatch, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

// >>> Add near top (after other helpers)
async function deleteSharedItinerary(sharedId) {
  try {
    console.log("[CLEAN] Deleting shared itinerary:", sharedId);
    const itemsCol = collection(db, "sharedItineraries", sharedId, "items");
    while (true) {
      const snap = await getDocs(query(itemsCol, limit(400)));
      if (snap.empty) break;
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    await deleteDoc(doc(db, "sharedItineraries", sharedId));
    console.log("[CLEAN] Deleted parent doc:", sharedId);
  } catch (e) {
    console.error("[CLEAN] Failed deleting itinerary:", sharedId, e);
    throw e;
  }
}

export async function cleanEmptySharedItinerariesForUser(user, { maxAgeMs = 2000 } = {}) {
  if (!user) return { scanned: 0, removed: 0 };
  const parentQ = query(collection(db, "sharedItineraries"), where("sharedWith", "array-contains", user.uid));
  const snap = await getDocs(parentQ);
  let removed = 0;
  let scanned = 0;

  for (const d of snap.docs) {
    scanned++;
    const data = d.data() || {};
    // Normalize timestamp
    let updatedMs = 0;
    if (data.lastUpdated?.toMillis) updatedMs = data.lastUpdated.toMillis();
    else if (data.lastUpdated instanceof Date) updatedMs = data.lastUpdated.getTime();

    const age = Date.now() - updatedMs;
    // Only owner can purge
    if (data.sharedBy !== user.uid) {
      console.log(`[CLEAN][SKIP] Not owner ${d.id}`);
      continue;
    }

    // Give a small grace (maxAgeMs) so brand new shares aren't removed too fast
    if (updatedMs && age < maxAgeMs) {
      console.log(`[CLEAN][SKIP] Too new (${age}ms) ${d.id}`);
      continue;
    }

    const itemsSnap = await getDocs(query(collection(db, "sharedItineraries", d.id, "items"), limit(1)));
    if (itemsSnap.empty) {
      try {
        await deleteSharedItinerary(d.id);
        removed++;
      } catch {}
    } else {
      console.log(`[CLEAN][KEEP] Has items ${d.id}`);
    }
  }

  console.log(`[CLEAN] Done. Scanned=${scanned} removed=${removed}`);
  return { scanned, removed };
}

// MOVE / KEEP deleteSharedItinerary (only one copy) then ADD helper:

async function leaveOrDeleteSharedItinerary(shared, user) {
  if (!user) return;
  try {
    if (shared.sharedBy.id === user.uid) {
      // Owner: delete whole doc (items already empty, but still attempt full cleanup)
      await deleteSharedItinerary(shared.id);
      console.log("[LEAVE] Owner deleted empty shared itinerary", shared.id);
    } else {
      // Non‑owner: just remove self from sharedWith
      await updateDoc(doc(db, "sharedItineraries", shared.id), {
        sharedWith: arrayRemove(user.uid)
      });
      console.log("[LEAVE] User left shared itinerary", shared.id);
    }
  } catch (e) {
    console.error("[LEAVE] Failed", e);
  }
}