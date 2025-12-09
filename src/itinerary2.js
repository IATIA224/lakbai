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
import { db, auth } from "./firebase";
// REMOVE: import './itinerary2.css';
// REMOVE: import ItineraryHotelsModal from "./itineraryHotels";
// REMOVE: import ItineraryCostEstimationModal from "./itineraryCostEstimation";
// REMOVE: import ItineraryAgencyModal from "./itineraryAgency";
import { unlockAchievement, logActivity } from "./profile"; // ADDED logActivity
import {
  trackDestinationAdded,
  trackDestinationCompleted,
  trackDestinationUncompleted,
  trackDestinationRemoved,
} from "./itinerary_Stats";
// REMOVE: import { SuggestionView, HotelSuggestion, AgencySuggestion } from "./ItinerarySuggestion";

// Mobile detection hook
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);
  
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
}

// Helper function to ensure collections exist - FIXED
async function ensureCollectionExists(path) {
  try {
    const tempDoc = doc(db, path, "_temp");
    await setDoc(tempDoc, { _temp: true });
    await deleteDoc(tempDoc);
    return true;
  } catch (err) {
    // Only log if it's not a permission error on delete (which is expected)
    if (!err.message.includes("PERMISSION_DENIED")) {
      console.error(`Failed to ensure collection: ${path}`, err);
    }
    return false;
  }
}

// Enhanced function to share itineraries with friends - FIXED
export async function shareItinerary(user, items, itemIds, friendIds) {
  if (!user || !itemIds.length || !friendIds.length) {
    console.error("Missing required data for sharing");
    throw new Error("Missing required data for sharing");
  }
  
  try {
    // Don't wait for collection checks - they might fail but sharing can still work
    ensureCollectionExists("sharedItineraries").catch(() => {});
    ensureCollectionExists("notifications").catch(() => {});
    
    const itemsToShare = items.filter(item => itemIds.includes(item.id));
    if (itemsToShare.length === 0) {
      throw new Error("No valid items to share");
    }

    const sharedDocRef = doc(collection(db, "sharedItineraries"));
    const timestamp = serverTimestamp();
    const sharedWithAll = Array.from(new Set([...friendIds, user.uid]));

    // Create shared itinerary document with edit permissions
    // add name/photo for friends so UI can show editors
    const friendProfiles = {};
    await Promise.all(friendIds.map(async (fid) => {
      try {
        const s = await getDoc(doc(db, "users", fid));
        if (s.exists()) friendProfiles[fid] = s.data();
      } catch (e) {
        friendProfiles[fid] = null;
      }
    }));

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
      },
      editPermissions: {
        [user.uid]: {
          role: "owner",
          canEdit: true,
          name: user.displayName || user.email || 'Owner',
          photoURL: user.photoURL || null,
          grantedAt: timestamp
        },
        ...Object.fromEntries(
          friendIds.map(friendId => [
            friendId,
            {
              role: "member",
              canEdit: true,
              name: friendProfiles[friendId]?.displayName || friendProfiles[friendId]?.name || null,
              photoURL: friendProfiles[friendId]?.photoURL || null,
              grantedAt: timestamp
            }
          ])
        )
      }
    });

    // Add items to shared itinerary
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

    // Remove items from personal itinerary
    const delBatch = writeBatch(db);
    for (const m of idMap) {
      delBatch.delete(doc(db, "itinerary", user.uid, "items", m.originalId));
    }
    await delBatch.commit();
    
    // Log activity
    try {
      await logActivity(
        `Shared itinerary with ${friendIds.length} friend${friendIds.length > 1 ? 's' : ''} (${itemIds.length} destination${itemIds.length > 1 ? 's' : ''})`,
        "🔗"
      );
    } catch (err) {
      console.error("Failed to log activity:", err);
    }
    
    // Check achievement
    try {
      await checkMiniPlannerAchievement(user);
    } catch (err) {
      console.error("Failed to check achievement:", err);
    }
    
    // Create notifications
    const notificationBatch = writeBatch(db);
    for (const friendId of friendIds) {
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
    }
    
    await notificationBatch.commit();
    return sharedDocRef.id;
  } catch (err) {
    console.error("Error sharing itinerary:", err.message);
    throw err;
  }
}

// Add alias for compatibility
export const shareItineraryWithFriends = shareItinerary;

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
    let pendingUpdates = new Map();

    const unSubParent = onSnapshot(
      qy,
      async (snap) => {
        const currentIds = new Set(snap.docs.map(d => d.id));
        
        for (const [id, fn] of itemUnsubs.entries()) {
          if (!currentIds.has(id)) {
            try { fn(); } catch {}
            itemUnsubs.delete(id);
            pendingUpdates.delete(id);
          }
        }

        for (const d of snap.docs) {
          if (itemUnsubs.has(d.id)) continue;
          
          const itemsRef = collection(db, "sharedItineraries", d.id, "items");
          
          const itemsUnsub = onSnapshot(
            itemsRef,
<<<<<<< HEAD
            (itemsSnap) => {
=======
            async (itemsSnap) => {
>>>>>>> f1d6feb7a9f1cc032ac6cc07aa0a7a9db71801c1
              const sortedItems = itemsSnap.docs
                .map(x => ({ ...x.data(), id: x.id }))
                .sort((a, b) => (a.arrival || "").localeCompare(b.arrival || ""));

<<<<<<< HEAD
              const data = d.data() || {};
              
              // Get edit permissions for current user
=======
              // FETCH GROUPS if it's a grouped itinerary
              let groups = [];
              if (d.data()?.isGroupedItinerary) {
                const groupsRef = collection(db, "sharedItineraries", d.id, "groups");
                try {
                  const groupsSnap = await getDocs(groupsRef);
                  groups = groupsSnap.docs.map(gd => ({ id: gd.id, ...gd.data() }));
                } catch (err) {
                  console.error(`Error fetching groups for shared itinerary ${d.id}:`, err);
                }
              }

              const data = d.data() || {};
              
>>>>>>> f1d6feb7a9f1cc032ac6cc07aa0a7a9db71801c1
              const editPermsMap = data.editPermissions || {};
              const editPermForUser = editPermsMap[user.uid] || {};
              const canEdit = (data.sharedBy === user.uid) || (editPermForUser.canEdit === true);

              const editors = Object.entries(editPermsMap).map(([uid, perm]) => ({
                uid,
                name: perm.name || (uid === data.sharedBy ? data.owner?.name : "Unknown"),
                photoURL: perm.photoURL || (uid === data.sharedBy ? data.owner?.photoURL : "/user.png"),
                role: perm.role || (uid === data.sharedBy ? "owner" : "member"),
                canEdit: perm.canEdit === true
              }));

              pendingUpdates.set(d.id, {
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
                items: sortedItems,
<<<<<<< HEAD
                itemCount: sortedItems.length,
                // ADD THIS: Permission info
                canEdit,
                userRole: editPermForUser.role || (data.sharedBy === user.uid ? "owner" : "member"),
                editors
=======
                groups: groups,
                isGroupedItinerary: data.isGroupedItinerary || false,
                itemCount: sortedItems.length,
                canEdit,
                userRole: editPermForUser.role || (data.sharedBy === user.uid ? "owner" : "member"),
                editors,
                name: data.name
>>>>>>> f1d6feb7a9f1cc032ac6cc07aa0a7a9db71801c1
              });

              setSharedWithMe(prev => {
                const updated = [];
                for (const [id, itinerary] of pendingUpdates) {
                  if (itinerary.items.length > 0) {
                    updated.push(itinerary);
                  }
                }
                return updated;
              });
            },
            (itemsErr) => {
              console.error(`Items listener error for shared itinerary ${d.id}:`, itemsErr);
              pendingUpdates.delete(d.id);
              setSharedWithMe(prev => prev.filter(s => s.id !== d.id));
            }
          );
          
          itemUnsubs.set(d.id, itemsUnsub);
        }

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
      pendingUpdates.clear();
    };
  }, [user]);

  return { sharedWithMe, loading, error };
}

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

    const friendsRef = collection(db, "users", user.uid, "friends");
    
    const unsubscribe = onSnapshot(
      friendsRef,
      async (snapshot) => {
        try {
          const friendsList = [];
          
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

function formatDate(dateString) {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric" 
    });
  } catch {
    return "—";
  }
}

function getTotalDays(item) {
  if (!item.arrival || !item.departure) return 0;
  try {
    const arrival = new Date(item.arrival).getTime();
    const departure = new Date(item.departure).getTime();
    return Math.max(1, Math.ceil((departure - arrival) / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

async function checkMiniPlannerAchievement(user) {
  if (!user) return;
  
  try {
    const personalSnap = await getDocs(
      collection(db, "itinerary", user.uid, "items")
    );
    const personalCount = personalSnap.size;
    
    const sharedQuery = query(
      collection(db, "sharedItineraries"),
      where("sharedWith", "array-contains", user.uid)
    );
    const sharedSnap = await getDocs(sharedQuery);
    
    let sharedCount = 0;
    for (const sharedDoc of sharedSnap.docs) {
      const itemsSnap = await getDocs(
        collection(db, "sharedItineraries", sharedDoc.id, "items")
      );
      sharedCount += itemsSnap.size;
    }
    
    const totalDestinations = personalCount + sharedCount;
    
    if (totalDestinations >= 3) {
      await unlockAchievement(6, "Mini Planner");
    }
  } catch (error) {
    console.error("Error checking Mini Planner achievement:", error);
  }
}

export async function clearAllTripDestinations(user) {
  if (!user) throw new Error("AUTH_REQUIRED");
  try {
    const colRef = collection(db, "itinerary", user.uid, "items");
    const snap = await getDocs(colRef);
    const batch = writeBatch(db);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } catch (err) {
    console.error("Error clearing trip destinations:", err);
    throw err;
  }
}

// ADD: Missing export function
export async function deleteTripDestination(user, itemId) {
  if (!user) throw new Error("AUTH_REQUIRED");
  try {
    const ref = doc(db, "itinerary", user.uid, "items", itemId);
    await deleteDoc(ref);
    console.log("[itinerary2] Deleted trip destination:", itemId);
  } catch (err) {
    console.error("Error deleting trip destination:", err);
    throw err;
  }
}

