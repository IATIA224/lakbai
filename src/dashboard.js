import React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';
import './dashboardBanner.css';

function Dashboard({ setShowAIModal }) {
  const navigate = useNavigate();

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
      <div className="dashboard-banner">
        <h2>Discover the Philippines with AI-Powered Travel Planning</h2>
        <p>
          Get personalized recommendations, smart packing tips, and connect with fellow travelers to explore the beautiful islands of the Philippines.
        </p>
        <button
          className="dashboard-banner-btn"
          onClick={() => setShowAIModal(true)}
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
      <div className="trips-preview-section">
        <div className="trips-preview-title">
          <span role="img" aria-label="plane">✈️</span> Your Trip's Preview
        </div>
        <div className="trips-preview-cards">
          {/* Card 1 */}
          <div className="trips-preview-card gradient-blue">
            <div className="trips-preview-status confirmed">Confirmed</div>
            <div className="trips-preview-main">
              <div className="trips-preview-place">Tokyo, Japan</div>
              <div className="trips-preview-date">
                <span role="img" aria-label="calendar">📅</span> March 15-22, 2024
              </div>
            </div>
            <div className="trips-preview-details">
              <div>
                <div className="trips-preview-companions">
                  <span style={{ color: "#888" }}>Companions</span>
                  <div className="trips-preview-names">Sarah, Mike, Emma</div>
                </div>
                <div className="trips-preview-meta">
                  7 days • Cherry Blossom Season
                </div>
              </div>
              <a href="#" className="trips-preview-link">View Details →</a>
            </div>
          </div>
          {/* Card 2 */}
          <div className="trips-preview-card gradient-orange">
            <div className="trips-preview-status pending">Pending</div>
            <div className="trips-preview-main">
              <div className="trips-preview-place">Santorini, Greece</div>
              <div className="trips-preview-date">
                <span role="img" aria-label="calendar">📅</span> June 10-17, 2024
              </div>
            </div>
            <div className="trips-preview-details">
              <div>
                <div className="trips-preview-companions">
                  <span style={{ color: "#888" }}>Companions</span>
                  <div className="trips-preview-names">Alex, Lisa</div>
                </div>
                <div className="trips-preview-meta">
                  7 days • Summer Getaway
                </div>
              </div>
              <a href="#" className="trips-preview-link">View Details →</a>
            </div>
          </div>
          {/* Card 3 */}
          <div className="trips-preview-card gradient-green">
            <div className="trips-preview-status confirmed">Confirmed</div>
            <div className="trips-preview-main">
              <div className="trips-preview-place">Bali, Indonesia</div>
              <div className="trips-preview-date">
                <span role="img" aria-label="calendar">📅</span> August 5-12, 2024
              </div>
            </div>
            <div className="trips-preview-details">
              <div>
                <div className="trips-preview-companions">
                  <span style={{ color: "#888" }}>Companions</span>
                  <div className="trips-preview-names">John, Mia</div>
                </div>
                <div className="trips-preview-meta">
                  8 days • Beach & Culture
                </div>
              </div>
              <a href="#" className="trips-preview-link">View Details →</a>
            </div>
          </div>
        </div>
      </div>
      <div className="personalized-section">
        <div className="personalized-title">
          <span role="img" aria-label="target">🎯</span> Personalized for You
        </div>
        <div className="personalized-cards">
          <div className="personalized-card">
            <div className="personalized-img" style={{ background: '#5ec6fa' }}>
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