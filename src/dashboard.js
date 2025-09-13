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
          <div className="modal-content details-modal" style={{ maxWidth: 600, width: '90%', borderRadius: 16, overflow: 'hidden', background: '#fff', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <button className="modal-close-floating" onClick={closeDetailsModal} aria-label="Close" style={{ position: 'absolute', top: 18, right: 18, fontSize: 24, background: 'none', border: 'none', cursor: 'pointer', zIndex: 2 }}>
              ✕
            </button>
            <div className="details-hero" style={{ background: '#f3f7fd', padding: '32px 0 0 0', borderBottom: '1px solid #e5e7eb', minHeight: 90 }}>
              <div className="details-hero-art" style={{ width: '100%', height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <div style={{ width: '80%', maxWidth: 320, height: 80, background: 'linear-gradient(180deg,#aee2ff 60%,#6ec1e4 100%)', borderRadius: 24, position: 'relative', overflow: 'hidden', margin: '0 auto' }}>
                  <div style={{ position: 'absolute', top: 24, left: '12%', width: '76%', height: 6, background: '#22c55e', borderRadius: 3 }} />
                  <div style={{ position: 'absolute', bottom: 18, left: '12%', width: '76%', height: 18, background: '#4f9cf9', borderRadius: 9 }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 10, background: '#fcd34d', borderRadius: '0 0 24px 24px' }} />
                </div>
              </div>
            </div>
            <div className="details-body" style={{ padding: '0 24px 24px 24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div className="details-head-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 0 }}>
                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
                  <div className="details-title-col" style={{ minWidth: 220 }}>
                    <h2 className="details-title" style={{ fontSize: 26, fontWeight: 700, margin: '20px 0 0 0', lineHeight: 1.2 }}>{selectedCard.name}</h2>
                    <a href="#" className="details-region" style={{ color: '#2563eb', fontWeight: 500, fontSize: 15, textDecoration: 'underline', marginBottom: 8, display: 'inline-block' }} onClick={(e) => e.preventDefault()}>
                      {selectedCard.region}
                    </a>
                    <div className="details-rating-row" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 0 0', fontSize: 15, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 18 }}>⭐</span>
                      <span style={{ fontWeight: 600 }}>{selectedCard.rating}</span>
                      <span style={{ color: '#6b7280', marginLeft: 6 }}>(Average Rating)</span>
                      <span style={{ color: '#6b7280', marginLeft: 18 }}>Your Rating:</span>
                      <span style={{ color: '#e5e7eb', fontSize: 18, marginLeft: 6 }}>★ ★ ★ ★ ★</span>
                    </div>
                  </div>
                  <div className="details-actions" style={{ display: 'flex', gap: 10, marginLeft: 32, alignItems: 'center' }}>
                    <button className="btn-outline active" style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c', fontWeight: 500, fontSize: 13, borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, width: '107px', height: '51px' }}>
                      <span style={{ fontSize: 18 }}>❤️</span> Bookmarked
                    </button>
                    <button className="btn-green" style={{ background: '#d1fae5', border: '1px solid #a7f3d0', color: '#059669', fontWeight: 500, fontSize: 13, borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, width: '107px', height: '51px'}}>
                      <span style={{ fontSize: 18 }}>＋</span> Add to Trip
                    </button>
                  </div>
                </div>
              </div>
              <div className="details-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginTop: 24, alignItems: 'start' }}>
                <div className="details-left" style={{ minWidth: 0 }}>
                  <div className="section-title" style={{ fontWeight: 700, marginBottom: 8 }}>Description</div>
                  <p className="details-paragraph" style={{ color: '#4b5563', lineHeight: 1.6, marginBottom: 16 }}>{selectedCard.description}</p>
                  <div className="section-title" style={{ fontWeight: 700, marginBottom: 8 }}>Tags</div>
                  <div className="badge-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    {(selectedCard.tags || []).map((t, i) => (
                      <span key={i} className="badge" style={{ background: '#e0e7ef', color: '#2563eb', borderRadius: 8, padding: '4px 12px', fontSize: 14, fontWeight: 500 }}>{t}</span>
                    ))}
                  </div>
                  <div className="section-title" style={{ fontWeight: 700, marginBottom: 8 }}>Packing Suggestions</div>
                  <div className="packing-box" style={{ background: '#f3f4f6', borderRadius: 8, padding: '10px 14px', color: '#374151', fontSize: 14, fontWeight: 400 }}>
                    Swimwear, sunscreen, light clothing, waterproof bag, snorkeling gear
                  </div>
                </div>
                <aside className="trip-info-box" style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 14px', minWidth: 140 }}>
                  <div className="trip-title" style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Trip Information</div>
                  <div className="trip-item" style={{ marginBottom: 14 }}>
                    <div className="trip-label" style={{ fontWeight: 600, color: '#374151', marginBottom: 6 }}>Price</div>
                    <span className={`pill small ${selectedCard.priceTier === 'less' ? 'pill-green' : 'pill-gray'}`} style={{ background: selectedCard.priceTier === 'less' ? '#bbf7d0' : '#e5e7eb', color: selectedCard.priceTier === 'less' ? '#059669' : '#6b7280', borderRadius: 8, padding: '4px 10px', fontWeight: 500, fontSize: 14 }}>{selectedCard.price}</span>
                  </div>
                  <div className="trip-item" style={{ marginBottom: 14 }}>
                    <div className="trip-label" style={{ fontWeight: 600, color: '#374151', marginBottom: 6 }}>Best Time to Visit</div>
                    <div className="trip-text" style={{ color: '#475569', fontSize: 14 }}>December to May</div>
                  </div>
                  <div className="trip-item">
                    <div className="trip-label" style={{ fontWeight: 600, color: '#374151', marginBottom: 6 }}>Categories</div>
                    <div className="badge-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {/* Hardcoded for demo, you can add categories to personalizedCards if needed */}
                      <span className="badge purple" style={{ background: '#ede9fe', color: '#6d28d9', borderRadius: 8, padding: '4px 12px', fontSize: 14, fontWeight: 500 }}>Mountains</span>
                      <span className="badge purple" style={{ background: '#ede9fe', color: '#6d28d9', borderRadius: 8, padding: '4px 12px', fontSize: 14, fontWeight: 500 }}>Cultural</span>
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