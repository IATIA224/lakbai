import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { signOut } from 'firebase/auth';
import { 
  collection, getDocs, orderBy, query as fsQuery, limit, doc, getDoc, onSnapshot
} from 'firebase/firestore';
import { db, auth } from './firebase';
import './dashboardBanner.css';
import useUserDashboardStats from './dashboard-stats-row'; // <-- Add this import at the top

// DestinationCard Component - moved to top to avoid conflicts
function DestinationCard({ 
  id, 
  name, 
  region, 
  rating, 
  price, 
  priceTier, 
  description, 
  tags, 
  image, 
  isBookmarked, 
  onBookmarkClick, 
  onDetails 
}) {
  return (
    <div className="grid-card">
      <div className="card-image" style={{ backgroundImage: `url(${image})` }}>
        <div className="sun-decoration"></div>
        <div className="wave-decoration"></div>
        <button 
          className={`bookmark-bubble ${isBookmarked ? 'active' : ''}`}
          onClick={onBookmarkClick}
          aria-label="Toggle bookmark"
          title="Bookmark"
        >
          {isBookmarked ? '❤️' : '🤍'}
        </button>
      </div>
      <div className="card-content">
        <div className="card-header">
          <h2>{name}</h2>
          <div className="mini-rating">
            ⭐ {rating}
          </div>
        </div>
        <div className="bp2-region-line">{region}</div>
        <p className="description">{description}</p>
        <div className="tag-container">
          {tags.map((tag, index) => (
            <span key={index} className="tag">{tag}</span>
          ))}
        </div>
        <div className="card-footer">
          <span className={`pill ${priceTier === 'less' ? 'pill-green' : 'pill-gray'}`}>
            {price}
          </span>
          <button className="details-btn" onClick={onDetails}>
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ setShowAIModal }) {
  const navigate = useNavigate();

  // Fetch trips from Firestore (itinerary/{userId}/items) for the current user, real-time
  const [trips, setTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  useEffect(() => {
    let unsubscribeAuth;
    let unsubscribeTrips;
    setTripsLoading(true);
    unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const colRef = collection(db, 'itinerary', user.uid, 'items');
        unsubscribeTrips = onSnapshot(
          fsQuery(colRef, orderBy('createdAt', 'desc')),
          (snap) => {
            const rows = snap.docs.map((doc) => {
              const data = doc.data() || {};
              return {
                id: doc.id,
                ...data,
              };
            });
            setTrips(rows);
            setTripsLoading(false);
          },
          (error) => {
            setTrips([]);
            setTripsLoading(false);
          }
        );
      } else {
        setTrips([]);
        setTripsLoading(false);
        if (unsubscribeTrips) unsubscribeTrips();
      }
    });
    return () => {
      if (typeof unsubscribeAuth === 'function') unsubscribeAuth();
      if (typeof unsubscribeTrips === 'function') unsubscribeTrips();
    };
  }, []);

  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarksLoading, setBookmarksLoading] = useState(true);

  // Fetch 2 most recent bookmarks for the current user
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setBookmarksLoading(true);
        try {
          const colRef = collection(db, 'users', user.uid, 'bookmarks');
          const snap = await getDocs(fsQuery(colRef, orderBy('createdAt', 'desc'), limit(2)));
          const rows = await Promise.all(
            snap.docs.map(async (b) => {
              const data = b.data() || {};
              // Prefer data stored on the bookmark doc
              if (data.name && data.description) {
                return {
                  id: b.id,
                  ...data,
                  savedAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
                };
              }
              // Fallback: merge with source destination doc
              const dref = doc(db, 'destinations', b.id);
              const ddoc = await getDoc(dref);
              return {
                id: b.id,
                ...(ddoc.exists() ? ddoc.data() : {}),
                ...data,
                savedAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
              };
            })
          );
          setBookmarks(rows.filter(Boolean));
        } catch (e) {
          setBookmarks([]);
        } finally {
          setBookmarksLoading(false);
        }
      } else {
        setBookmarks([]);
        setBookmarksLoading(false);
      }
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  // Use the custom hook for live stats
  const { loading: statsLoading, error: statsError, stats } = useUserDashboardStats();

  // Demo: local state for bookmarks for personalized cards
  const [personalizedBookmarks, setPersonalizedBookmarks] = useState({});

  // Modal state for personalized details
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  // Handler for toggling bookmark for personalized cards
  const handlePersonalizedBookmark = (id) => {
    setPersonalizedBookmarks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
      description: 'Ancient rice terraces carved into mountains, often called the "Eighth Wonder of the World."',
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
      {/* Hero Banner */}
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

      {/* Dashboard Stats */}
      <div className="dashboard-stats-row">
        <div className="dashboard-stat" title={statsError ? String(statsError) : undefined}>
          <span className="dashboard-stat-number blue">
            {statsLoading ? '–' : stats.destinations}
          </span>
          <span className="dashboard-stat-label">Destinations</span>
        </div>
        <div className="dashboard-stat" title={statsError ? String(statsError) : undefined}>
          <span className="dashboard-stat-number green">
            {statsLoading ? '–' : stats.bookmarked}
          </span>
          <span className="dashboard-stat-label">Bookmarked</span>
        </div>
        <div className="dashboard-stat" title={statsError ? String(statsError) : undefined}>
          <span className="dashboard-stat-number purple">
            {statsLoading ? '–' : stats.tripsPlanned}
          </span>
          <span className="dashboard-stat-label">Trips Planned</span>
        </div>
        <div className="dashboard-stat" title={statsError ? String(statsError) : undefined}>
          <span className="dashboard-stat-number orange">
            {statsLoading ? '–' : stats.ratedCount}
          </span>
          <span className="dashboard-stat-label">Rated Destinations</span>
        </div>
      </div>

      {/* Your trips and bookmarks section */}
      <div className="dashboard-preview-row">
        <div className="dashboard-preview-col">
          <div className="dashboard-preview-title">Your trips</div>
          <button 
            className="dashboard-preview-btn"
            onClick={() => navigate('/itinerary')}
          >
            + Plan new trip
          </button>
          <div className="dashboard-preview-list">
            {tripsLoading ? (
              <div className="dashboard-preview-empty">Loading trips…</div>
            ) : trips && trips.length > 0 ? (
              trips.map(trip => (
                <div className="dashboard-preview-trip" key={trip.id || trip.name}>
                  <img src={trip.image || '/placeholder.png'} alt={trip.name || trip.title} className="dashboard-preview-img" />
                  <div className="dashboard-preview-info">
                    {trip.status === 'Upcoming' && trip.arrival && (
                      <span className="dashboard-preview-soon">Upcoming</span>
                    )}
                    <div className="dashboard-preview-trip-title">{trip.name || trip.title}</div>
                    <div className="dashboard-preview-trip-meta">
                      <span>
                        {trip.arrival ? `${trip.arrival}` : ''}
                        {trip.departure ? ` – ${trip.departure}` : ''}
                        {trip.activities && Array.isArray(trip.activities)
                          ? ` • ${trip.activities.length} activit${trip.activities.length === 1 ? 'y' : 'ies'}`
                          : ''}
                      </span>
                    </div>
                  </div>
                  <span className="dashboard-preview-dots">⋯</span>
                </div>
              ))
            ) : (
              <div className="dashboard-preview-empty">No trips found. Start planning your first trip!</div>
            )}
          </div>
        </div>
        <div className="dashboard-preview-col">
          <div className="dashboard-preview-title">Bookmarks</div>
          <button 
            className="dashboard-preview-btn"
            onClick={() => navigate('/bookmarks2')}
          >
            + Add new bookmark
          </button>
          <div className="dashboard-preview-list">
            {bookmarksLoading ? (
              <div className="dashboard-preview-empty">Loading bookmarks…</div>
            ) : bookmarks.length === 0 ? (
              <div className="dashboard-preview-empty">
                You don't have any bookmarks yet. <span style={{ color: "#e74c3c" }}>Add a new bookmark.</span>
              </div>
            ) : (
              bookmarks.map(bm => (
                <div className="dashboard-preview-bookmark" key={bm.id}>
                  <img src={bm.image} alt={bm.title || bm.name} className="dashboard-preview-img" />
                  <div className="dashboard-preview-bookmark-info">
                    <div className="dashboard-preview-bookmark-title">{bm.title || bm.name}</div>
                    <div className="dashboard-preview-bookmark-desc">{bm.desc || bm.description}</div>
                  </div>
                  <span className="dashboard-preview-dots">⋯</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Personalized Section */}
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

      {/* Details Modal for Personalized Cards */}
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
                  <button 
                    className={`btn-outline ${personalizedBookmarks[selectedCard.id] ? 'active' : ''}`}
                    onClick={() => handlePersonalizedBookmark(selectedCard.id)}
                  >
                    <span>❤️</span> {personalizedBookmarks[selectedCard.id] ? 'Bookmarked' : 'Bookmark'}
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
                    <span className={`pill small ${selectedCard.priceTier === 'less' ? 'pill-green' : 'pill-gray'}`}>
                      {selectedCard.price}
                    </span>
                  </div>
                  <div className="trip-item">
                    <div className="trip-label">Best Time to Visit</div>
                    <div className="trip-text">December to May</div>
                  </div>
                  <div className="trip-item">
                    <div className="trip-label">Categories</div>
                    <div className="badge-row">
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