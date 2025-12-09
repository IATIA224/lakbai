import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import "./friend.css";
import { db, auth } from "./firebase";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  addDoc,
  deleteDoc,
  setDoc
} from "firebase/firestore";

const FriendPopup = ({ onClose }) => {
  const [codeInput, setCodeInput] = useState("");
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [removingFriend, setRemovingFriend] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);

  
  // Helper to fetch profile snapshots for a set of userIds
  const fetchProfiles = async (ids) => {
    if (!ids || ids.length === 0) return [];
    const profiles = await Promise.all(
      ids.map(async (id) => {
        try {
          const snap = await getDoc(doc(db, "users", id));
          if (snap.exists()) {
            const d = snap.data();
            return {
              id,
<<<<<<< HEAD
              name: d.name || d.displayName || "Traveler",
=======
              name: d.travelerName || d.name || d.displayName || "Traveler",
>>>>>>> f1d6feb7a9f1cc032ac6cc07aa0a7a9db71801c1
              profilePicture: d.profilePicture || d.photoURL || "/user.png"
            };
          }
        } catch (_) {}
        return null;
      })
    );
    return profiles.filter(Boolean);
  };

  // Live subscribe to my user doc -> requests + friends
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Listen for friend requests (document snapshot)
    const userDocUnsub = onSnapshot(doc(db, "users", user.uid), async (snap) => {
      if (!snap || !snap.exists()) {
        setFriendRequests([]);
        return;
      }
      const data = snap.data();
      const reqIds = data.friendRequests || [];
      const reqProfiles = await fetchProfiles(reqIds);
      setFriendRequests(reqProfiles);
    });

    // Listen for friends from subcollection (collection snapshot)
    const friendsRef = collection(db, "users", user.uid, "friends");
    const friendsUnsub = onSnapshot(friendsRef, async (snap) => {
      // For collection snapshots, use snap.empty to check no docs
      if (!snap || snap.empty) {
        setFriends([]);
        return;
      }

      const friendIds = snap.docs.map(d => d.id);
      const friendProfiles = await fetchProfiles(friendIds);
      setFriends(friendProfiles);
    });

    return () => {
      userDocUnsub();
      friendsUnsub();
    };
  }, []);

  // Send friend request via code
  const handleAddFriend = async () => {
    const user = auth.currentUser;
    const code = codeInput.trim().toUpperCase();
    if (!user || !code) return;

    setLoading(true);
    try {
      const q = query(collection(db, "users"), where("shareCode", "==", code));
      const snap = await getDocs(q);
      if (snap.empty) {
        alert("No user found with that code.");
        setLoading(false);
        return;
      }
      const receiverDoc = snap.docs[0];
      const receiverId = receiverDoc.id;

      if (receiverId === user.uid) {
        alert("You cannot add yourself.");
        setLoading(false);
        return;
      }

      // Only append my UID to their friendRequests
      await updateDoc(doc(db, "users", receiverId), {
        friendRequests: arrayUnion(user.uid)
      });
      setCodeInput("");
    } catch (err) {
      console.error(err);
      alert("Failed to send friend request.");
    }
    setLoading(false);
  };

  // Add activity log
  async function addActivity(userId, text, icon = "🔵") {
    try {
      const activityData = {
        userId,
        text,
        icon,
        timestamp: new Date().toISOString()
      };
      await addDoc(collection(db, "activities"), activityData);
    } catch (error) {
      console.error("Error adding activity:", error);
    }
  }

  const acceptRequest = async (requesterId) => {
    const me = auth.currentUser;
    if (!me) return;
    setLoading(true);
    try {
      const now = Date.now();

      // Create friend documents in both subcollections
      await setDoc(doc(db, "users", me.uid, "friends", requesterId), {
        friendId: requesterId,
        since: now
      });
      await setDoc(doc(db, "users", requesterId, "friends", me.uid), {
        friendId: me.uid,
        since: now
      });

      // Robustly remove requesterId from my friendRequests field (handles string or object entries)
      const myRef = doc(db, "users", me.uid);
      const mySnap = await getDoc(myRef);
      if (mySnap.exists()) {
        const data = mySnap.data();
        const arr = data.friendRequests || [];
        const newArr = arr.filter((item) => {
          if (typeof item === "string") return item !== requesterId;
          if (item && typeof item === "object") {
            return (item.id !== requesterId) && (item.uid !== requesterId);
          }
          return true;
        });
        await updateDoc(myRef, { friendRequests: newArr });
      } else {
        // fallback attempts (harmless if not needed)
        await updateDoc(myRef, { friendRequests: arrayRemove(requesterId) }).catch(()=>{});
        await updateDoc(myRef, { friendRequests: arrayRemove({ id: requesterId }) }).catch(()=>{});
      }

      // Optimistically update local UI: remove request and add to friends list
      setFriendRequests((prev) => prev.filter((p) => p.id !== requesterId));
      const profile = (await fetchProfiles([requesterId]))[0];
      if (profile) {
        setFriends((prev) => {
          // avoid duplicates
          const without = prev.filter((f) => f.id !== profile.id);
          return [...without, profile];
        });
      }

      // Log activity
      await addActivity(me.uid, "You added a friend!", "👥");
      await addActivity(requesterId, "You became friends!", "👥");

      // Show toast with friend's name
      setToastMsg(`Friend request accepted! You are now friends with ${profile?.name || 'your friend'}.`);
      setTimeout(() => setToastMsg(''), 3500);

    } catch (err) {
      console.error("Error accepting friend request:", err);
      alert("Failed to accept request: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const declineRequest = async (requesterId) => {
    const me = auth.currentUser;
    if (!me) return;
    setLoading(true);
    try {
      // Robustly remove requesterId from my friendRequests field
      const myRef = doc(db, "users", me.uid);
      const mySnap = await getDoc(myRef);
      if (mySnap.exists()) {
        const data = mySnap.data();
        const arr = data.friendRequests || [];
        const newArr = arr.filter((item) => {
          if (typeof item === "string") return item !== requesterId;
          if (item && typeof item === "object") {
            return (item.id !== requesterId) && (item.uid !== requesterId);
          }
          return true;
        });
        await updateDoc(myRef, { friendRequests: newArr });
      } else {
        await updateDoc(myRef, { friendRequests: arrayRemove(requesterId) }).catch(()=>{});
        await updateDoc(myRef, { friendRequests: arrayRemove({ id: requesterId }) }).catch(()=>{});
      }

      // Optimistically update local UI
      setFriendRequests((prev) => prev.filter((p) => p.id !== requesterId));
    } catch (err) {
      console.error(err);
      alert("Failed to decline request.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFriend = async  (friendId) => {

    const user = auth.currentUser;
    if (!user) return;

    setRemovingFriend(friendId);

    try {
      // Remove from both user's friend lists
      await deleteDoc(doc(db, "users", user.uid, "friends", friendId));
      await deleteDoc(doc(db, "users", friendId, "friends", user.uid));

      // Also remove from friend requests if present
      await updateDoc(doc(db, "users", user.uid), {
        friendRequests: arrayRemove(friendId)
      });
      await updateDoc(doc(db, "users", friendId), {
        friendRequests: arrayRemove(user.uid)
      });

      // Local state update
      setFriends((prev) => prev.filter((friend) => friend.id !== friendId));
    } catch (err) {
      console.error("Error removing friend:", err);
      alert("Failed to remove friend. Please try again.");
    } finally {
      setRemovingFriend(null);
    }
  };

  // In friend.js, update the return statement to use createPortal
  return ReactDOM.createPortal(
    <div className="community-modal-backdrop" onClick={onClose}>
      <div className="community-modal" onClick={(e) => e.stopPropagation()}>
        <div className="friend-modal-header">
          <div className="friend-modal-title">
            <span role="img" aria-label="friends">👥</span> Your Friends
          </div>
          <button className="friend-close" onClick={onClose}>×</button>
        </div>

        <div className="friend-section">
          <div className="friend-input-row">
            <input
              className="friend-input"
              type="text"
              placeholder="Enter friend's code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              disabled={loading}
            />
            <button
              className="friend-btn friend-btn-primary"
              onClick={handleAddFriend}
              disabled={loading || !codeInput.trim()}
            >
              Add Friend
            </button>
          </div>
          <div className="friend-hint">Ask your friend to share their code from Profile → Share Profile.</div>
        </div>

        <div className="friend-section">
          <div className="friend-title">Friends</div>
          <div className="friend-list">
            {friends.length === 0 ? (
              <div className="friend-empty">No friends yet</div>
            ) : (
              friends.map((f) => (
                <div key={f.id} className="friend-card">
                  <div className="friend-avatar">
                    <img src={f.profilePicture} alt={f.name} />
                  </div>
                  <div className="friend-meta">
                    <div className="friend-name">{f.name}</div>
                  </div>
                    <button
                      className="friend-btn friend-btn-danger"
                      onClick={() => setConfirmRemoveId(f.id)}
                      disabled={removingFriend === f.id}
                    >
                      {removingFriend === f.id ? "Removing..." : "Unfriend"}
                    </button>
                </div>
              )))
            }
          </div>
        </div>

        <div className="friend-section">
          <div className="friend-title">Friend Requests</div>
          <div className="friend-list">
            {friendRequests.length === 0 ? (
              <div className="friend-empty">No friend requests</div>
            ) : (
              friendRequests.map((req) => (
                <div className="friend-card" key={req.id}>
                  <div className="friend-avatar">
                    <img src={req.profilePicture} alt={req.name} />
                  </div>
                  <div className="friend-meta">
                    <div className="friend-name">{req.name}</div>
                    <div className="friend-sub">wants to be your friend</div>
                  </div>
                  <div className="friend-actions">
                    <button
                      className="friend-btn friend-btn-success"
                      onClick={() => acceptRequest(req.id)}
                      disabled={loading}
                    >
                      Accept
                    </button>
                    <button
                      className="friend-btn friend-btn-danger"
                      onClick={() => declineRequest(req.id)}
                      disabled={loading}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )))
            }
          </div>
        </div>

        {toastMsg && (
          <div
            className="friend-toast"
            style={{
              position: 'fixed',
              top: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#2563eb',
              color: '#fff',
              padding: '12px 28px',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 16,
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              zIndex: 9999,
              transition: 'opacity 0.3s'
            }}
          >
            {toastMsg}
          </div>
        )}

        {confirmRemoveId && (
          <div
            className="friend-confirm-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.25)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={() => setConfirmRemoveId(null)}
          >
            <div
              className="friend-confirm-modal"
              style={{
                background: '#fff',
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                padding: 32,
                minWidth: 320,
                maxWidth: '90vw',
                textAlign: 'center'
              }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ marginBottom: 16 }}>Remove Friend</h3>
              <div style={{ marginBottom: 18 }}>
                Are you sure you want to remove <b>{friends.find(f => f.id === confirmRemoveId)?.name || 'this friend'}</b>?
              </div>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                <button
                  className="friend-btn friend-btn-danger"
                  style={{ padding: '8px 22px', borderRadius: 8, fontWeight: 700 }}
                  onClick={async () => {
                    await handleRemoveFriend(confirmRemoveId);
                    setConfirmRemoveId(null);
                  }}
                >
                  Yes, Remove
                </button>
                <button
                  className="friend-btn"
                  style={{ padding: '8px 22px', borderRadius: 8, fontWeight: 700 }}
                  onClick={() => setConfirmRemoveId(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};


export default FriendPopup;