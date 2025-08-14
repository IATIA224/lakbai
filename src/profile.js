import React from 'react';
import StickyHeader from './header';
import './profile.css';

const activities = [
  { icon: "🟣", text: "Shared 5 new photos from El Nido", time: "2 hours ago" },
  { icon: "🟢", text: 'Reviewed "Amazing sunset at Boracay White Beach"', time: "1 day ago" },
  { icon: "🟣", text: "Created new trip plan for Bohol Adventure", time: "3 days ago" },
  { icon: "🟠", text: 'Joined discussion about "Best budget hostels in Palawan"', time: "1 week ago" },
];

const achievements = [
  { icon: "🏝️", title: "Island Hopper", desc: "Visited 10+ islands", color: "#fffbe6", border: "#ffe58f" },
  { icon: "📸", title: "Photo Master", desc: "Shared 100+ photos", color: "#e6f7ff", border: "#91d5ff" },
  { icon: "⭐", title: "Review Expert", desc: "Written 50+ reviews", color: "#f6ffed", border: "#b7eb8f" },
  { icon: "🗺️", title: "Route Planner", desc: "Created 20+ trip plans", color: "#f9f0ff", border: "#d3adf7" },
];

const gallery = [
  { emoji: "🏖️", color: "#5b8efc" },
  { emoji: "⛰️", color: "#22c55e" },
  { emoji: "🌅", color: "#fd7e14" },
  { emoji: "🏝️", color: "#a084ee" },
  { emoji: "🌊", color: "#f472b6" },
  { emoji: "🦋", color: "#6366f1" },
];

const Profile = () => {
  return (
    <>
      <StickyHeader />
      <div className="profile-main">
        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-avatar">JD</div>
          <div className="profile-info">
            <div className="profile-title-row">
              <h2>Juan Dela Cruz</h2>
              <button className="profile-edit-btn">Edit Profile</button>
            </div>
            <div className="profile-meta">
              <span>🌟 Explorer</span>
              <span>• 📍 Manila, Philippines</span>
              <span>• 🎂 Joined March 2023</span>
            </div>
            <div className="profile-badges">
              <span className="badge badge-yellow">🏝️ Island Hopper</span>
              <span className="badge badge-blue">📸 Photo Master</span>
              <span className="badge badge-purple">🗺️ Route Planner</span>
            </div>
            <div className="profile-bio">
              "Passionate about exploring the hidden gems of the Philippines. Love sharing travel tips and discovering new adventures with fellow travelers!"
            </div>
          </div>
        </div>
        {/* Stats */}
        <div className="profile-stats-row">
          <div className="profile-stat"><span>47</span><div>Places Visited</div></div>
          <div className="profile-stat"><span>156</span><div>Photos Shared</div></div>
          <div className="profile-stat"><span>89</span><div>Reviews Written</div></div>
          <div className="profile-stat"><span>234</span><div>Followers</div></div>
        </div>
        <div className="profile-content-row">
          {/* Left column */}
          <div className="profile-content-main">
            {/* Travel Map */}
            <div className="profile-card">
              <div className="profile-card-title">🗺️ My Travel Map</div>
              <div className="profile-map">
                <span className="profile-map-ph">PH</span>
                <span className="profile-map-dot" style={{ left: "30%", top: "40%" }}></span>
                <span className="profile-map-dot" style={{ left: "60%", top: "60%" }}></span>
                <span className="profile-map-dot" style={{ left: "50%", top: "30%" }}></span>
                <span className="profile-map-dot" style={{ left: "70%", top: "50%" }}></span>
                <div className="profile-map-caption">47 destinations explored across the Philippines</div>
              </div>
            </div>
            {/* Recent Activity */}
            <div className="profile-card">
              <div className="profile-card-title">📝 Recent Activity</div>
              <div className="profile-activity-list">
                {activities.map((a, i) => (
                  <div className="profile-activity-item" key={i}>
                    <span className="profile-activity-icon">{a.icon}</span>
                    <span className="profile-activity-text">{a.text}</span>
                    <span className="profile-activity-time">{a.time}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Photo Gallery */}
            <div className="profile-card">
              <div className="profile-card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>📷 Photo Gallery</span>
                <a href="#" className="profile-gallery-link">View All (156)</a>
              </div>
              <div className="profile-gallery-scroll">
                {gallery.map((g, i) => (
                  <div className="profile-gallery-photo" key={i} style={{ background: g.color }}>
                    <span style={{ fontSize: 36 }}>{g.emoji}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Right column */}
          <div className="profile-content-side">
            {/* Achievements */}
            <div className="profile-card profile-achievements">
              <div className="profile-card-title">🏆 Achievements</div>
              <div className="profile-achievements-list">
                {achievements.map((a, i) => (
                  <div
                    className="profile-achievement"
                    key={i}
                    style={{ background: a.color, border: `1.5px solid ${a.border}` }}
                  >
                    <span className="profile-achievement-icon">{a.icon}</span>
                    <span>
                      <b>{a.title}</b>
                      <div className="profile-achievement-desc">{a.desc}</div>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {/* Quick Actions */}
            <div className="profile-card profile-actions">
              <div className="profile-card-title">⚡ Quick Actions</div>
              <button className="profile-action-btn plan">📌 Plan New Trip</button>
              <button className="profile-action-btn share">🗂️ Share Profile</button>
              <button className="profile-action-btn export">💾 Export My Data</button>
              <button className="profile-action-btn settings">⚙️ Account Settings</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Profile;