import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';
import './dashboardBanner.css';
import DestinationCard from './components/DestinationCard';
import useUserDashboardStats from './dashboard-stats-row';

function Dashboard({ setShowAIModal }) {
  // Demo data for missing variables
  const tripsPlannedCount = 2; // Example value
  const avgRatingVal = 4.7; // Example value
  const trips = [
    {
      id: 'trip1',
      title: 'Baguio Adventure',
      image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80',
      user: '/user.png',
      date: 'Sep 15',
      places: 3,
      soon: true
    },
    {
      id: 'trip2',
      title: 'Palawan Escape',
      image: 'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=80',
      user: '/user.png',
      date: 'Oct 2',
      places: 5,
      soon: false
    }
  ];
  const bookmarks = [
    {
      id: 'bm1',
      title: 'Chocolate Hills',
      image: 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=400&q=80',
      desc: 'Unique geological formation in Bohol.'
    },
    {
      id: 'bm2',
      title: 'Taal Volcano',
      image: 'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=80',
      desc: 'Active volcano with a scenic lake.'
    }
  ];
  const navigate = useNavigate();

  // Firestore-backed dashboard stats
  const { loading: statsLoading, error: statsError, stats } = useUserDashboardStats();
  const destinationsCount = stats?.destinations ?? 0;
  const bookmarkedCount = stats?.bookmarked ?? 0;
  // Demo: local state for bookmarks for personalized cards
  const [personalizedBookmarks, setPersonalizedBookmarks] = useState({});

  // Handler for toggling bookmark for personalized cards
  const handlePersonalizedBookmark = (id) => {
    setPersonalizedBookmarks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Modal state for personalized details
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  // Handler for view details (open modal)
  const handlePersonalizedDetails = (card) => {
    setSelectedCard(card);
    setDetailsModalOpen(true);
  };

  // Handler to close modal
  const closeDetailsModal = () => {
    setDetailsModalOpen(false);
    setSelectedCard(null);
  };

  const personalizedCards = [
    {
      id: 'banaue',
      name: 'Banaue Rice Terraces',
      region: 'CAR - Cordillera Administrative Region',
      rating: 5.0,
      price: '₱1,800',
      priceTier: 'less',
      description: 'Ancient rice terraces carved into mountains, often called the “Eighth Wonder of the World.”',
      tags: ['UNESCO', 'Cultural', 'Hiking'],
      image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'el-nido',
      name: 'El Nido',
      region: 'Region IV-B - MIMAROPA',
      rating: 4.8,
      price: '₱3,200',
      priceTier: 'expensive',
      description: 'Dramatic limestone cliffs and turquoise lagoons.',
      tags: ['Islands', 'Snorkeling', 'Boat Tour'],
      image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'mayon',
      name: 'Mayon Volcano',
      region: 'Region V - Bicol Region',
      rating: 4.5,
      price: '₱1,200',
      priceTier: 'less',
      description: 'Perfect cone-shaped active volcano, considered the most beautiful volcano in the Philippines.',
      tags: ['Volcano', 'Hiking', 'Photography'],
      image: 'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=80'
    }
  ];

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
            {trips && trips.map(trip => (
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
            {bookmarks && bookmarks.length === 0 ? (
              <div className="dashboard-preview-empty">
                You don’t have any bookmarks yet. <span style={{ color: "#e74c3c" }}>Add a new bookmark.</span>
              </div>
            ) : (
              bookmarks && bookmarks.map(bm => (
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
        <div className="personalized-title">Personalized for You</div>
        <div className="personalized-cards-grid">
          {personalizedCards.map(card => (
            <DestinationCard
              key={card.id}
              {...card}
              isBookmarked={!!personalizedBookmarks[card.id]}
              onBookmarkClick={() => handlePersonalizedBookmark(card.id)}
              onDetails={() => handlePersonalizedDetails(card)}
            />
          ))}
        </div>
      </div>

      {/* Details Modal for Personalized Cards (accurate structure from image) */}
      {detailsModalOpen && selectedCard && (
        <div
          className="modal-overlay active"
          onClick={(e) => e.target.classList.contains('modal-overlay') && closeDetailsModal()}
        >
          <div className="modal-content details-modal">
            <button className="modal-close-floating" onClick={closeDetailsModal} aria-label="Close">
              ✕
            </button>
            <div className="details-hero">
              <div className="details-hero-art">
                {/* Decorative hero art, can be replaced with an image or SVG if needed */}
                <div className="hero-art-bg">
                  <div className="hero-green-bar" />
                  <div className="hero-blue-bar" />
                  <div className="hero-yellow-bar" />
                </div>
              </div>
            </div>
            <div className="details-body">
              <div className="details-head-row">
                <div className="details-title-col">
                  <h2 className="details-title">{selectedCard.name}</h2>
                  <a href="#" className="details-region" onClick={(e) => e.preventDefault()}>
                    {selectedCard.region}
                  </a>
                  <div className="details-rating-row">
                    <span>⭐</span>
                    <span>{selectedCard.rating}</span>
                    <span className="muted">(Average Rating)</span>
                    <span className="sep">Your Rating:</span>
                    <span className="your-stars">★ ★ ★ ★ ★</span>
                  </div>
                </div>
                <div className="details-actions">
                  <button className="btn-outline active">
                    <span>❤️</span> Bookmarked
                  </button>
                  <button className="btn-green">
                    <span>＋</span> Add to Trip
                  </button>
                </div>
              </div>
              <div className="details-grid">
                <div className="details-left">
                  <div className="section-title">Description</div>
                  <p className="details-paragraph">{selectedCard.description}</p>
                  <div className="section-title">Tags</div>
                  <div className="badge-row">
                    {(selectedCard.tags || []).map((t, i) => (
                      <span key={i} className="badge">{t}</span>
                    ))}
                  </div>
                  <div className="section-title">Packing Suggestions</div>
                  <div className="packing-box">
                    Swimwear, sunscreen, light clothing, waterproof bag, snorkeling gear
                  </div>
                </div>
                <aside className="trip-info-box">
                  <div className="trip-title">Trip Information</div>
                  <div className="trip-item">
                    <div className="trip-label">Price</div>
                    <span className={`pill small ${selectedCard.priceTier === 'less' ? 'pill-green' : 'pill-gray'}`}>{selectedCard.price}</span>
                  </div>
                  <div className="trip-item">
                    <div className="trip-label">Best Time to Visit</div>
                    <div className="trip-text">December to May</div>
                  </div>
                  <div className="trip-item">
                    <div className="trip-label">Categories</div>
                    <div className="badge-row">
                      {/* Hardcoded for demo, you can add categories to personalizedCards if needed */}
                      <span className="badge purple">Mountains</span>
                      <span className="badge purple">Cultural</span>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Dashboard;