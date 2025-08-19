import React, { useState, useEffect } from "react";
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
  addDoc
} from "firebase/firestore";

const FriendPopup = ({ onClose }) => {
  const [codeInput, setCodeInput] = useState("");
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);

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
              name: d.name || d.displayName || "Traveler",
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
    const unsub = onSnapshot(doc(db, "users", user.uid), async (snap) => {
      if (!snap.exists()) {
        setFriendRequests([]);
        setFriends([]);
        return;
      }
      const data = snap.data();
      const reqIds = data.friendRequests || [];
      const friendIds = data.friends || [];
      const [reqProfiles, friendProfiles] = await Promise.all([
        fetchProfiles(reqIds),
        fetchProfiles(friendIds)
      ]);
      setFriendRequests(reqProfiles);
      setFriends(friendProfiles);
    });
    return () => unsub();
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

      alert("Friend request sent!");
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
      // Add each other to friends
      await updateDoc(doc(db, "users", me.uid), {
        friends: arrayUnion(requesterId),
        friendRequests: arrayRemove(requesterId)
      });
      await updateDoc(doc(db, "users", requesterId), {
        friends: arrayUnion(me.uid)
      });

      // Log the friendship activity
      await addActivity(me.uid, "You added a friend!", "👥");
      await addActivity(requesterId, "You became friends!", "👥");
    } catch (err) {
      console.error(err);
      alert("Failed to accept request.");
    }
    setLoading(false);
  };

  const declineRequest = async (requesterId) => {
    const me = auth.currentUser;
    if (!me) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", me.uid), {
        friendRequests: arrayRemove(requesterId)
      });
    } catch (err) {
      console.error(err);
      alert("Failed to decline request.");
    }
    setLoading(false);
  };

  return (
    <div className="friend-modal-backdrop" onClick={onClose}>
      <div className="friend-modal" onClick={(e) => e.stopPropagation()}>
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
      </div>
    </div>
  );
};

export default FriendPopup;