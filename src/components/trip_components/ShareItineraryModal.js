import React, { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, writeBatch, serverTimestamp, query, where, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../firebase";
import "./ShareItineraryModal.css";

function ShareItineraryModal({ items = [], groups = [], onClose }) {
  const user = auth.currentUser;
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set(items.map(i => i.id)));
  const [selectedGroups, setSelectedGroups] = useState(new Set(groups.map(g => g.id)));
  const [shareMode, setShareMode] = useState("destinations"); // 'destinations' or 'groups'
  const [loading, setLoading] = useState(false);
  const [selectAll, setSelectAll] = useState(true);

  // Helper to fetch profile snapshots for a set of userIds
  const fetchProfiles = async (ids) => {
    if (!ids || ids.length === 0) return [];
    const profiles = await Promise.all(
      ids.map(async (id) => {
        try {
          const snap = await doc(db, "users", id);
          const docSnap = await getDocs(collection(db, "users")).then(col => 
            col.docs.find(d => d.id === id)
          );
          if (docSnap && docSnap.exists()) {
            const d = docSnap.data();
            return {
              uid: id,
              name: d.travelerName || d.name || d.displayName || "Traveler",
              email: d.email || "",
              photoURL: d.profilePicture || d.photoURL || "/user.png"
            };
          }
        } catch (_) {}
        return null;
      })
    );
    return profiles.filter(Boolean);
  };

  // Fetch actual friends from subcollection (like friend.js does)
  useEffect(() => {
    if (!user) return;

    // Listen for friends from subcollection
    const friendsRef = collection(db, "users", user.uid, "friends");
    const friendsUnsub = onSnapshot(friendsRef, async (snap) => {
      if (!snap || snap.empty) {
        setFriends([]);
        return;
      }

      const friendIds = snap.docs.map(d => d.id);
      const friendProfiles = await fetchProfiles(friendIds);
      setFriends(friendProfiles);
    });

    return () => {
      friendsUnsub();
    };
  }, [user]);

  // Handle select all
  const handleSelectAllItems = () => {
    if (selectAll) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(i => i.id)));
    }
    setSelectAll(!selectAll);
  };

  // Handle item selection
  const toggleItemSelection = (itemId) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  // Handle group selection
  const toggleGroupSelection = (groupId) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
    } else {
      newSelected.add(groupId);
    }
    setSelectedGroups(newSelected);
  };

  // Handle friend selection
  const toggleFriendSelection = (friendId) => {
    const newSelected = selectedFriends.includes(friendId)
      ? selectedFriends.filter(id => id !== friendId)
      : [...selectedFriends, friendId];
    setSelectedFriends(newSelected);
  };

  // Share function
  const handleShare = async () => {
    if (selectedFriends.length === 0) {
      alert("Please select at least one friend to share with");
      return;
    }

    if (shareMode === "destinations" && selectedItems.size === 0) {
      alert("Please select at least one destination to share");
      return;
    }

    if (shareMode === "groups" && selectedGroups.size === 0) {
      alert("Please select at least one trip group to share");
      return;
    }

    setLoading(true);
    try {
      if (shareMode === "destinations") {
        await shareDestinations();
      } else {
        await shareGroups();
      }
      alert("Itinerary shared successfully!");
      onClose();
    } catch (err) {
      console.error("[ShareItineraryModal] Share failed:", err);
      alert("Failed to share itinerary: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Share individual destinations
  const shareDestinations = async () => {
    const sharedDocRef = doc(collection(db, "sharedItineraries"));
    const timestamp = serverTimestamp();
    const sharedWithAll = Array.from(new Set([...selectedFriends, user.uid]));

    const itemsToShare = items.filter(item => selectedItems.has(item.id));

    // Get friend profiles from our friends list
    const friendProfiles = {};
    selectedFriends.forEach(friendId => {
      const friendData = friends.find(f => f.uid === friendId);
      if (friendData) {
        friendProfiles[friendId] = friendData;
      }
    });

    // Create shared itinerary document
    await setDoc(sharedDocRef, {
      sharedBy: user.uid,
      sharedWith: sharedWithAll,
      sharedAt: timestamp,
      name: `Shared Itinerary by ${user.displayName || user.email}`,
      itemCount: itemsToShare.length,
      collaborative: true,
      lastUpdated: timestamp,
      isGroupedItinerary: false,
      owner: {
        uid: user.uid,
        name: user.displayName || user.email || "Unknown",
        photoURL: user.photoURL || null
      },
      editPermissions: {
        [user.uid]: {
          role: "owner",
          canEdit: true,
          name: user.displayName || user.email || "Owner",
          photoURL: user.photoURL || null,
          grantedAt: timestamp
        },
        ...Object.fromEntries(
          selectedFriends.map(friendId => {
            const friendData = friendProfiles[friendId];
            return [
              friendId,
              {
                role: "member",
                canEdit: true,
                name: friendData?.name || "Friend",
                photoURL: friendData?.photoURL || null,
                grantedAt: timestamp
              }
            ];
          })
        )
      }
    });

    // Add items to shared itinerary
    const batch = writeBatch(db);
    for (const item of itemsToShare) {
      const itemRef = doc(collection(db, "sharedItineraries", sharedDocRef.id, "items"));
      batch.set(itemRef, {
        ...item,
        originalId: item.id,
        sharedAt: timestamp,
        lastEditedBy: user.uid,
        lastEditedByName: user.displayName || user.email,
        updatedAt: timestamp
      });
    }
    await batch.commit();
  };

  // Share grouped itineraries
  const shareGroups = async () => {
    const groupsToShare = groups.filter(group => selectedGroups.has(group.id));

    for (const group of groupsToShare) {
      const sharedDocRef = doc(collection(db, "sharedItineraries"));
      const timestamp = serverTimestamp();
      const sharedWithAll = Array.from(new Set([...selectedFriends, user.uid]));

      // Get group items
      const groupItems = items.filter(item => group.items?.includes(item.id));

      // Get friend profiles from our friends list
      const friendProfiles = {};
      selectedFriends.forEach(friendId => {
        const friendData = friends.find(f => f.uid === friendId);
        if (friendData) {
          friendProfiles[friendId] = friendData;
        }
      });

      // Create shared itinerary document
      await setDoc(sharedDocRef, {
        sharedBy: user.uid,
        sharedWith: sharedWithAll,
        sharedAt: timestamp,
        name: `${group.name} (Shared by ${user.displayName || user.email})`,
        itemCount: groupItems.length,
        collaborative: true,
        lastUpdated: timestamp,
        isGroupedItinerary: true,
        groupName: group.name,
        owner: {
          uid: user.uid,
          name: user.displayName || user.email || "Unknown",
          photoURL: user.photoURL || null
        },
        editPermissions: {
          [user.uid]: {
            role: "owner",
            canEdit: true,
            name: user.displayName || user.email || "Owner",
            photoURL: user.photoURL || null,
            grantedAt: timestamp
          },
          ...Object.fromEntries(
            selectedFriends.map(friendId => {
              const friendData = friendProfiles[friendId];
              return [
                friendId,
                {
                  role: "member",
                  canEdit: true,
                  name: friendData?.name || "Friend",
                  photoURL: friendData?.photoURL || null,
                  grantedAt: timestamp
                }
              ];
            })
          )
        }
      });

      // Add items to shared itinerary
      const batch = writeBatch(db);
      for (const item of groupItems) {
        const itemRef = doc(collection(db, "sharedItineraries", sharedDocRef.id, "items"));
        batch.set(itemRef, {
          ...item,
          originalId: item.id,
          sharedAt: timestamp,
          lastEditedBy: user.uid,
          lastEditedByName: user.displayName || user.email,
          updatedAt: timestamp
        });
      }
      await batch.commit();

      // Create shared group document
      const groupRef = doc(collection(db, "sharedItineraries", sharedDocRef.id, "groups"));
      await setDoc(groupRef, {
        id: group.id,
        name: group.name,
        startDate: group.startDate,
        endDate: group.endDate,
        assignments: group.assignments,
        customActivities: group.customActivities || [],
        sharedAt: timestamp,
        lastEditedBy: user.uid,
        lastEditedByName: user.displayName || user.email,
        updatedAt: timestamp
      });
    }
  };

  return (
    <div className="share-modal-overlay" onClick={onClose} style={{ zIndex: 100010 }}>
      <div className="share-modal-container" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="share-modal-header">
          <h2>Share Your Itinerary</h2>
          <button className="share-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Content */}
        <div className="share-modal-content">
          {/* Share Mode Tabs */}
          <div className="share-mode-tabs">
            <button
              className={`share-mode-tab ${shareMode === "destinations" ? "active" : ""}`}
              onClick={() => setShareMode("destinations")}
            >
              📍 Individual Destinations ({items.length})
            </button>
            {groups.length > 0 && (
              <button
                className={`share-mode-tab ${shareMode === "groups" ? "active" : ""}`}
                onClick={() => setShareMode("groups")}
              >
                📅 Trip Groups ({groups.length})
              </button>
            )}
          </div>

          {/* Friends Section */}
          <div className="share-friends-section">
            <h3>Select Friends to Share With</h3>
            {friends.length === 0 ? (
              <p className="share-no-friends">
                👥 No friends yet. Add friends first to share itineraries. 
                <br/>
                <span style={{ fontSize: '12px' }}>Go to Friends → Add a friend using their share code</span>
              </p>
            ) : (
              <div className="share-friends-grid">
                {friends.map(friend => (
                  <div key={friend.uid} className="share-friend-card">
                    <input
                      type="checkbox"
                      id={`friend-${friend.uid}`}
                      checked={selectedFriends.includes(friend.uid)}
                      onChange={() => toggleFriendSelection(friend.uid)}
                      className="share-friend-checkbox"
                    />
                    <label htmlFor={`friend-${friend.uid}`} className="share-friend-label">
                      {friend.photoURL && (
                        <img src={friend.photoURL} alt={friend.name} className="share-friend-avatar" />
                      )}
                      <div className="share-friend-info">
                        <span className="share-friend-name">{friend.name}</span>
                        <span className="share-friend-email">{friend.email}</span>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Destinations/Groups Selection */}
          <div className="share-items-section">
            <div className="share-items-header">
              <h3>
                {shareMode === "destinations" ? "Select Destinations" : "Select Trip Groups"}
              </h3>
              {shareMode === "destinations" && (
                <button className="share-select-all-btn" onClick={handleSelectAllItems}>
                  {selectAll ? "Deselect All" : "Select All"}
                </button>
              )}
            </div>

            <div className="share-items-list">
              {shareMode === "destinations" ? (
                items.length === 0 ? (
                  <p className="share-no-items">No destinations to share</p>
                ) : (
                  items.map(item => (
                    <div key={item.id} className="share-item-card">
                      <input
                        type="checkbox"
                        id={`item-${item.id}`}
                        checked={selectedItems.has(item.id)}
                        onChange={() => toggleItemSelection(item.id)}
                        className="share-item-checkbox"
                      />
                      <label htmlFor={`item-${item.id}`} className="share-item-label">
                        <div className="share-item-content">
                          <span className="share-item-name">{item.name}</span>
                          <span className="share-item-meta">
                            {item.region && <span className="share-item-region">{item.region}</span>}
                            {item.estimatedExpenditure && (
                              <span className="share-item-budget">₱{item.estimatedExpenditure}</span>
                            )}
                          </span>
                        </div>
                      </label>
                    </div>
                  ))
                )
              ) : (
                groups.length === 0 ? (
                  <p className="share-no-items">No trip groups to share</p>
                ) : (
                  groups.map(group => (
                    <div key={group.id} className="share-group-card">
                      <input
                        type="checkbox"
                        id={`group-${group.id}`}
                        checked={selectedGroups.has(group.id)}
                        onChange={() => toggleGroupSelection(group.id)}
                        className="share-item-checkbox"
                      />
                      <label htmlFor={`group-${group.id}`} className="share-item-label">
                        <div className="share-item-content">
                          <span className="share-item-name">📅 {group.name}</span>
                          <span className="share-item-meta">
                            <span className="share-item-dates">
                              {group.startDate && new Date(group.startDate).toLocaleDateString()} - {group.endDate && new Date(group.endDate).toLocaleDateString()}
                            </span>
                            <span className="share-item-count">
                              {group.items?.length || 0} destination{group.items?.length !== 1 ? 's' : ''}
                            </span>
                          </span>
                        </div>
                      </label>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="share-modal-footer">
          <button className="share-btn-cancel" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button 
            className="share-btn-share" 
            onClick={handleShare} 
            disabled={loading || selectedFriends.length === 0}
          >
            {loading ? "Sharing..." : "Share Itinerary"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ShareItineraryModal;