import React from "react";
import "./friend.css";

const FriendPopup = ({ onClose }) => (
  <div className="friend-modal-backdrop" onClick={onClose}>
    <div className="friend-modal" onClick={e => e.stopPropagation()}>
      {/* Colorful header for "Your Friends" section */}
      <div className="friend-modal-header">
        <span className="friend-modal-title">
          <span role="img" aria-label="friends">👥</span> Your Friends
        </span>
      </div>
      <div className="friend-section">
        <div className="friend-list">
          <div className="friend-card">
            <div className="friend-avatar" style={{background:"#fb7185"}}>MA</div>
            <div>
              <div className="friend-name">Maria Santos</div>
              <div className="friend-location">From Cebu City</div>
            </div>
            <button className="friend-view">View</button>
          </div>
          <div className="friend-card">
            <div className="friend-avatar" style={{background:"linear-gradient(90deg,#818cf8,#38bdf8)"}}>RC</div>
            <div>
              <div className="friend-name">Rico Cruz</div>
              <div className="friend-location">From Manila</div>
            </div>
            <button className="friend-view">View</button>
          </div>
        </div>
      </div>
      <div className="friend-section">
        <div className="friend-title">
          <span role="img" aria-label="requests">📨</span> Friend Requests
        </div>
        <div className="friend-list">
          <div className="friend-card">
            <div className="friend-avatar" style={{background:"#4ade80"}}>AL</div>
            <div>
              <div className="friend-name">Anna Lopez</div>
              <div className="friend-location">From Davao City</div>
            </div>
            <div className="friend-actions">
              <button className="friend-accept">Accept</button>
              <button className="friend-decline">Decline</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default FriendPopup;