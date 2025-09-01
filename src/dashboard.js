import React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';
import './dashboardBanner.css';
import { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

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

const [stats, setStats] = useState({
  destinations: 0,
  bookmarked: 0,
  tripsPlanned: 0,
  avgRating: 0
});

useEffect(() => {
  async function fetchStats() {
    // Destinations count
    const destinationsSnap = await getDocs(collection(db, 'destinations'));
    const destinationsCount = destinationsSnap.size;

    // Bookmarked count (from userBookmarks collection)
    let bookmarkedCount = 0;
    let tripsCount = 0;
    let avgRating = 0;

    const user = auth.currentUser;
    if (user) {
      const userBookmarksRef = doc(db, 'userBookmarks', user.uid);
      const userBookmarksSnap = await getDoc(userBookmarksRef);
      if (userBookmarksSnap.exists()) {
        const bookmarksArr = userBookmarksSnap.data().bookmarks || [];
        bookmarkedCount = bookmarksArr.length;
      }

      // Trips Planned (example: users/{uid}/trips)
      const tripsSnap = await getDocs(collection(db, 'users', user.uid, 'trips'));
      tripsCount = tripsSnap.size;
    }

    // Avg Rating (average of all destination ratings)
    let totalRating = 0;
    let ratingCount = 0;
    destinationsSnap.forEach(doc => {
      const data = doc.data();
      if (data.rating) {
        totalRating += data.rating;
        ratingCount++;
      }
    });
    if (ratingCount > 0) avgRating = (totalRating / ratingCount).toFixed(1);

    setStats({
      destinations: destinationsCount,
      bookmarked: bookmarkedCount,
      tripsPlanned: tripsCount,
      avgRating: avgRating
    });
  }

  fetchStats();
}, []);

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
          <span className="dashboard-stat-number blue">{stats.destinations}</span>
          <span className="dashboard-stat-label">Destinations</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat-number green">{stats.bookmarked}</span>
          <span className="dashboard-stat-label">Bookmarked</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat-number purple">{stats.tripsPlanned}</span>
          <span className="dashboard-stat-label">Trips Planned</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat-number orange">{stats.avgRating}</span>
          <span className="dashboard-stat-label">Avg Rating</span>
        </div>
      </div>
      <div className="personalized-section">
        <div className="personalized-title">
          <span role="img" aria-label="target">🎯</span> Personalized for You
        </div>
        <div className="personalized-cards-dashboard">
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