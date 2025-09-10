import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';
import './dashboardBanner.css';
import useUserDashboardStats from './dashboard-stats-row';

function Dashboard({ setShowAIModal }) {
  const navigate = useNavigate();

  // Firestore-backed dashboard stats
  const { loading: statsLoading, error: statsError, stats } = useUserDashboardStats();
  const destinationsCount = stats?.destinations ?? 0;
  const bookmarkedCount = stats?.bookmarked ?? 0;
  const tripsPlannedCount = stats?.tripsPlanned ?? 0;
  const avgRatingVal = Number.isFinite(stats?.avgRating) ? stats.avgRating : 0;

  // Sample trips and bookmarks (replace with Firestore fetch)
  const [trips, setTrips] = useState([
    {
      id: 1,
      title: "Trip to Philippines",
      date: "Sep 4 - 5",
      places: 1,
      image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80",
      user: "https://randomuser.me/api/portraits/men/32.jpg",
      soon: true
    },
    {
      id: 2,
      title: "Trip to Tokyo",
      date: "Sep 2 – Oct 2",
      places: 1,
      image: "https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=80",
      user: "https://randomuser.me/api/portraits/men/32.jpg",
      soon: false
    }
  ]);
  const [bookmarks, setBookmarks] = useState([
    {
      id: 1,
      title: "El Nido, Palawan",
      desc: "Perfect for beach lovers",
      image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80"
    },
    {
      id: 2,
      title: "Chocolate Hills, Bohol",
      desc: "Adventure & nature",
      image: "https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=80"
    }
  ]);

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
      <div
        className="dashboard-banner"
        style={{
          background: `url("/dashboardBanner.jpg") center/cover no-repeat`
        }}
      >
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
        <div className="dashboard-stat" title={statsError ? String(statsError) : undefined}>
          <span className="dashboard-stat-number blue">
            {statsLoading ? '–' : destinationsCount}
          </span>
          <span className="dashboard-stat-label">Destinations</span>
        </div>
        <div className="dashboard-stat" title={statsError ? String(statsError) : undefined}>
          <span className="dashboard-stat-number green">
            {statsLoading ? '–' : bookmarkedCount}
          </span>
          <span className="dashboard-stat-label">Bookmarked</span>
        </div>
        <div className="dashboard-stat" title={statsError ? String(statsError) : undefined}>
          <span className="dashboard-stat-number purple">
            {statsLoading ? '–' : tripsPlannedCount}
          </span>
          <span className="dashboard-stat-label">Trips Planned</span>
        </div>
        <div className="dashboard-stat" title={statsError ? String(statsError) : undefined}>
          <span className="dashboard-stat-number orange">
            {statsLoading ? '–' : avgRatingVal.toFixed(1)}
          </span>
          <span className="dashboard-stat-label">Avg Rating</span>
        </div>
      </div>

      {/* Your trips and bookmarks section */}
      <div className="dashboard-preview-row">
        <div className="dashboard-preview-col">
          <div className="dashboard-preview-title">Your trips</div>
          <button className="dashboard-preview-btn">+ Plan new trip</button>
          <div className="dashboard-preview-list">
            {trips.map(trip => (
              <div className="dashboard-preview-trip" key={trip.id}>
                <img src={trip.image} alt={trip.title} className="dashboard-preview-img" />
                <div className="dashboard-preview-info">
                  {trip.soon && <span className="dashboard-preview-soon">In 1 day</span>}
                  <div className="dashboard-preview-trip-title">{trip.title}</div>
                  <div className="dashboard-preview-trip-meta">
                    <img src={trip.user} alt="user" className="dashboard-preview-user" />
                    <span>{trip.date} • {trip.places} place</span>
                  </div>
                </div>
                <span className="dashboard-preview-dots">⋯</span>
              </div>
            ))}
          </div>
        </div>
        <div className="dashboard-preview-col">
          <div className="dashboard-preview-title">Bookmarks</div>
          <button className="dashboard-preview-btn">+ Add new bookmark</button>
          <div className="dashboard-preview-list">
            {bookmarks.length === 0 ? (
              <div className="dashboard-preview-empty">
                You don’t have any bookmarks yet. <span style={{ color: "#e74c3c" }}>Add a new bookmark.</span>
              </div>
            ) : (
              bookmarks.map(bm => (
                <div className="dashboard-preview-bookmark" key={bm.id}>
                  <img src={bm.image} alt={bm.title} className="dashboard-preview-img" />
                  <div className="dashboard-preview-bookmark-info">
                    <div className="dashboard-preview-bookmark-title">{bm.title}</div>
                    <div className="dashboard-preview-bookmark-desc">{bm.desc}</div>
                  </div>
                  <span className="dashboard-preview-dots">⋯</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <div className="personalized-section-dashboard">
        <div className="personalized-title">
          Personalized for You
        </div>
        <div className="personalized-cards-grid">
          {/* Example cards, replace with dynamic data if needed */}
          {[
            {
              id: 'el-nido',
              name: 'El Nido, Palawan',
              region: 'Region IV-B - MIMAROPA',
              rating: 4.9,
              price: '₱15,000',
              priceTier: 'expensive',
              description: 'Perfect for beach lovers • ₱15,000 budget',
              tags: ['Beach', 'Water Sports', 'Island Hopping'],
              categories: ['Beaches', 'Islands'],
              bestTime: 'November to May',
              image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80'
            },
            {
              id: 'chocolate-hills',
              name: 'Chocolate Hills, Bohol',
              region: 'Region VII - Central Visayas',
              rating: 4.7,
              price: '₱12,000',
              priceTier: 'less',
              description: 'Adventure & nature • ₱12,000 budget',
              tags: ['Geological Wonder', 'View', 'Photography'],
              categories: ['Landmarks', 'Natural'],
              bestTime: 'December to May',
              image: 'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=80'
            },
            {
              id: 'cloud-9',
              name: 'Cloud 9, Siargao',
              region: 'CARAGA - Region XIII',
              rating: 4.8,
              price: '₱18,000',
              priceTier: 'expensive',
              description: 'Surfing paradise • ₱18,000 budget',
              tags: ['Surfing', 'Beach'],
              categories: ['Beaches', 'Parks'],
              bestTime: 'March to October',
              image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80'
            }
          ].map(card => (
            <div className="personalized-card-grid" key={card.id}>
              <div className="personalized-card-image">
                <img src={card.image} alt={card.name} />
              </div>
              <div className="personalized-card-content">
                <h2>{card.name}</h2>
                <div className="personalized-card-rating">
                  <span>⭐</span> {card.rating}
                </div>
                <div className="personalized-card-region">{card.region}</div>
                <p className="personalized-card-desc">{card.description}</p>
                <div className="personalized-card-tags">
                  {card.tags.map((tag, i) => (
                    <span key={i} className="personalized-card-tag">{tag}</span>
                  ))}
                </div>
                <div className="personalized-card-footer">
                  <span className={`personalized-card-pill ${card.priceTier === 'less' ? 'pill-green' : 'pill-gray'}`}>
                    {card.priceTier === 'less' ? 'Less Expensive' : 'Expensive'}
                  </span>
                  <span className="personalized-card-besttime">{card.bestTime}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default Dashboard;