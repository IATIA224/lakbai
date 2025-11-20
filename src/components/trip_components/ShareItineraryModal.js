import React, { useMemo, useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { auth } from "../../firebase";
import { useFriendsList, shareItineraryWithFriends } from "../../itinerary2";
import ItineraryCard from "./ItineraryCard";
import "./ShareItineraryModal.css"; // optional styles - create if you want

export default function ShareItineraryModal({ items = [], onClose = () => {} }) {
  const u = auth.currentUser;
  const friends = useFriendsList(u);
  const [selectedFriendIds, setSelectedFriendIds] = useState(new Set());
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const toggleFriend = (id) => {
    setSelectedFriendIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleItem = (id) => {
    setSelectedItemIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const canShare = selectedFriendIds.size > 0 && selectedItemIds.size > 0;

  const handleShare = async () => {
    if (!u) {
      alert("You need to be signed in to share itineraries.");
      return;
    }
    if (!canShare) {
      alert("Choose at least one friend and one itinerary item to share.");
      return;
    }
    setLoading(true);
    try {
      await shareItineraryWithFriends(u, items, Array.from(selectedItemIds), Array.from(selectedFriendIds));
      alert("Itinerary shared successfully.");
      onClose();
    } catch (err) {
      console.error("Share failed:", err);
      alert("Share failed. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const friendList = useMemo(() => (Array.isArray(friends) ? friends : []), [friends]);

  useEffect(() => {
    console.log("ShareItineraryModal mounted", { itemsCount: items.length, friendsCount: friendList.length });
  }, []); // one-time log

  useEffect(() => {
    console.log("Friend list updated", friendList);
  }, [friendList]);

  const body = (
    <div className="share-modal-backdrop" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-header">
          <h3>Share Itinerary</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="share-modal-body">
          <section className="share-section">
            <h4>Choose Friends</h4>
            {friendList.length === 0 ? (
              <div className="empty">No friends found. Add friends to share itineraries.</div>
            ) : (
              <div className="friend-list">
                {friendList.map(f => (
                  <label key={f.id} className="friend-row">
                    <input
                      type="checkbox"
                      checked={selectedFriendIds.has(f.id)}
                      onChange={() => toggleFriend(f.id)}
                    />
                    <img src={f.profilePicture || "/user.png"} alt={f.name} className="friend-avatar" />
                    <span className="friend-name">{f.name}</span>
                    <span className="friend-email">{f.email}</span>
                  </label>
                ))}
              </div>
            )}
          </section>

          <section style={{ marginTop: 12 }} className="share-section">
            <h4>Select Items to Share</h4>
            {items.length === 0 ? (
              <div className="empty">No items to share.</div>
            ) : (
              <div className="items-list">
                {items.map(it => (
                  <div key={it.id} className="share-item-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedItemIds.has(it.id)}
                        onChange={() => toggleItem(it.id)}
                      />
                      <strong style={{ marginLeft: 8 }}>{it.name}</strong>
                      <span style={{ marginLeft: 8, color: "#6b7280" }}>{it.region}</span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="share-modal-footer">
          <button className="btn ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn primary" onClick={handleShare} disabled={!canShare || loading}>
            {loading ? "Sharing…" : "Share"}
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(body, document.body);
}