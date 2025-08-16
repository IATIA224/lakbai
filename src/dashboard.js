import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';
import StickyHeader from './header';
import './dashboardBanner.css';

// Create a context for chat control (add this at the top of header.js)
export const ChatContext = React.createContext();

function Dashboard() {
  const navigate = useNavigate();
  const { setShowChat } = React.useContext(ChatContext); // Use context to control chat

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <>
      <StickyHeader />
      <div className="dashboard-banner">
        <h2>Discover the Philippines with AI-Powered Travel Planning</h2>
        <p>
          Get personalized recommendations, smart packing tips, and connect with fellow travelers to explore the beautiful islands of the Philippines.
        </p>
        <button
          className="dashboard-banner-btn"
          onClick={() => setShowChat(true)} // Open chat box on click
        >
          Start Planning with AI
        </button>
      </div>
      <div className="dashboard-stats-row">
        <div className="dashboard-stat">
          <span className="dashboard-stat-number blue">0</span>
          <span className="dashboard-stat-label">Destinations</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat-number green">0</span>
          <span className="dashboard-stat-label">Bookmarked</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat-number purple">0</span>
          <span className="dashboard-stat-label">Trips Planned</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat-number orange">0</span>
          <span className="dashboard-stat-label">Avg Rating</span>
        </div>
      </div>
      <div className="personalized-section">
        <div className="personalized-title">
          <span role="img" aria-label="target">🎯</span> Personalized for You
        </div>
        <div className="personalized-cards">
          <div className="personalized-card">
            <div className="personalized-img" style={{ background: '#5ec6fa' }}>
              {/* You can replace with <img src="..." /> if you have images */}
              <svg width="100%" height="80" viewBox="0 0 200 80">
                <circle cx="170" cy="20" r="15" fill="#ffe066" />
                <path d="M20,60 Q60,30 180,60" stroke="#fff" strokeWidth="6" fill="none" />
              </svg>
            </div>
            <div className="personalized-info">
              <div className="personalized-place">El Nido, Palawan</div>
              <div className="personalized-desc">Perfect for beach lovers • ₱15,000 budget</div>
              <div className="personalized-rating">
                <span style={{ color: '#ffc107', fontWeight: 'bold' }}>★</span> 4.9 <span className="personalized-reviews">(2,341 reviews)</span>
              </div>
            </div>
          </div>
          <div className="personalized-card">
            <div className="personalized-img" style={{ background: '#98e49c' }}>
              <svg width="100%" height="80" viewBox="0 0 200 80">
                <circle cx="50" cy="40" r="18" fill="#b7e4c7" />
                <circle cx="120" cy="30" r="10" fill="#b7e4c7" />
                <circle cx="160" cy="50" r="8" fill="#b7e4c7" />
              </svg>
            </div>
            <div className="personalized-info">
              <div className="personalized-place">Chocolate Hills, Bohol</div>
              <div className="personalized-desc">Adventure & nature • ₱12,000 budget</div>
              <div className="personalized-rating">
                <span style={{ color: '#ffc107', fontWeight: 'bold' }}>★</span> 4.7 <span className="personalized-reviews">(1,892 reviews)</span>
              </div>
            </div>
          </div>
          <div className="personalized-card">
            <div className="personalized-img" style={{ background: '#5ec6fa' }}>
              <svg width="100%" height="80" viewBox="0 0 200 80">
                <path d="M0,60 Q40,30 80,60 Q120,90 160,60 Q180,40 200,60" stroke="#fff" strokeWidth="6" fill="none" />
              </svg>
            </div>
            <div className="personalized-info">
              <div className="personalized-place">Cloud 9, Siargao</div>
              <div className="personalized-desc">Surfing paradise • ₱18,000 budget</div>
              <div className="personalized-rating">
                <span style={{ color: '#ffc107', fontWeight: 'bold' }}>★</span> 4.8 <span className="personalized-reviews">(1,567 reviews)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Dashboard;