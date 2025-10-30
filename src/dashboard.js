import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, getDocs, query as fsQuery, limit, doc, getDoc, onSnapshot, deleteDoc, serverTimestamp,
  where as fsWhere, setDoc, arrayUnion, arrayRemove, runTransaction
} from 'firebase/firestore';
import { db, auth } from './firebase';
import './dashboardBanner.css';
import { fetchCloudinaryImages, getImageForDestination as getCloudImageForDestination } from "./image-router";
import destImages from './dest-images.json';

import DashboardBanner from './components/DashboardBanner';
import DashboardStats from './components/DashboardStats';
import TripsPreview from './components/TripsPreview';
import BookmarksPreview from './components/BookmarksPreview';
import { breakdown } from './rules';


// Helper to get image URL by destination name
function getImageForDestination(name) {
  if (!name) return undefined;
  const found = destImages.find(img => img.name.trim().toLowerCase() === name.trim().toLowerCase());
  return found ? found.url : undefined;
}

function formatPeso(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return '₱' + v.toLocaleString();
  if (typeof v === 'string') {
    if (v.trim().startsWith('₱')) return v;
    const digits = v.replace(/[^\d]/g, '');
    return digits ? '₱' + Number(digits).toLocaleString() : v;
  }
  return '—';
}

// This card is only used by the personalized section, so we keep it here.
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
            {formatPeso(price)}
          </span>
          <button className="details-btn" onClick={onDetails}>
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}

const INTEREST_RULES = {
  "Surfer": ["Beach"],
  "Backpacker": ["Mountain", "Tourist", "Natural"],
  "Foodie Traveler": ["Cultural", "Tourist", "Heritage"],
  "Culture Seeker": ["Cultural", "Heritage", "Museums"],
  "Adventure Junkie": ["Mountain", "Waterfalls", "Caves"],
  "Nature Enthusiast": ["Natural", "Parks", "Lakes"],
  "Digital Nomad": ["City Explorer", "Tourist", "Landmarks"],
  "Road Tripper": ["Landmarks", "Tourist", "Natural"],
  "Beach Lover": ["Beach"],
  "City Explorer": ["Tourist", "Museums", "Cultural"],
  "Photographer": ["Landmarks", "Natural", "Heritage"],
  "Historian": ["Historical", "Heritage", "Museums"],
  "Festival Hopper": ["Cultural", "Tourist", "Heritage"],
  "Hiker": ["Mountain"],
  "Luxury Traveler": ["Islands", "Beach", "Heritage"],
  "Eco-Traveler": ["Parks", "Natural", "Caves"],
  "Cruise Lover": ["Islands", "Beach", "Lakes"],
  "Winter Sports Enthusiast": [],
  "Solo Wanderer": ["Tourist", "Cultural", "Landmarks"]
};

const INTEREST_RULES_LC = Object.fromEntries(
  Object.entries(INTEREST_RULES).map(([k, v]) => [k.toLowerCase(), v])
);

function getFirebaseImageForDestination(firebaseImages, destName) {
  if (!destName) return null;
  const normalized = destName.trim().toLowerCase();
  const found = (firebaseImages || []).find(img =>
    (img.name && img.name.trim().toLowerCase() === normalized) ||
    (img.publicId && img.publicId.trim().toLowerCase() === normalized)
  );
  return found && found.url ? found.url : null;
}

function Dashboard({ setShowAIModal }) {
  const navigate = useNavigate();
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [personalizedSort, setPersonalizedSort] = useState('rating-desc');
  const [personalizedBookmarks, setPersonalizedBookmarks] = useState({});

  const [recommendedDestinations, setRecommendedDestinations] = useState([]);
  const [userInterests, setUserInterests] = useState([]);
  const [recoLoading, setRecoLoading] = useState(false);
  const [cloudImages, setCloudImages] = useState([]);
  const [firebaseImages, setFirebaseImages] = useState([]);
  
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedFares, setSelectedFares] = useState([]);
  const [personalizedRatingsByDest, setPersonalizedRatingsByDest] = useState({});
  const [personalizedRatingsCountByDest, setPersonalizedRatingsCountByDest] = useState({});
  const [userReviewsCountByDest, setUserReviewsCountByDest] = useState({});
  const [personalizedUserRating, setPersonalizedUserRating] = useState(0);
  const [personalizedSavingRating, setPersonalizedSavingRating] = useState(false);
  const [addingTripId, setAddingTripId] = useState(null);
  const [addedTripId, setAddedTripId] = useState(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setCurrentUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    fetchCloudinaryImages().then(setCloudImages).catch(() => setCloudImages([]));
    async function fetchFirebaseImages() {
      try {
        const snap = await getDocs(collection(db, 'photos'));
        const imgs = snap.docs.map(doc => ({
          name: doc.data().name,
          publicId: doc.data().publicId,
          url: doc.data().url
        })).filter(img => img.name && img.url);
        setFirebaseImages(imgs);
      } catch {
        setFirebaseImages([]);
      }
    }
    fetchFirebaseImages();
  }, []);

  const pickCardImage = (name) =>
    getCloudImageForDestination(cloudImages, name) ||
    getFirebaseImageForDestination(firebaseImages, name) ||
    getImageForDestination(name) ||
    '/placeholder.png';

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((u) => {
      if (!u) { setUserInterests([]); return; }
      const uref = doc(db, 'users', u.uid);
      const unsubUser = onSnapshot(uref, (snap) => {
        const raw = Array.isArray(snap.data()?.interests) ? snap.data().interests : [];
        const arr = raw.map(v => (typeof v === 'string' ? v : v?.label)).filter(Boolean);
        setUserInterests(arr);
      });
      return () => unsubUser();
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const canon = (s) => {
      let t = (s || '').toString().trim().toLowerCase();
      if (t.endsWith('s')) t = t.slice(0, -1);
      return t;
    };

    const run = async () => {
      if (userInterests.length === 0) {
        setRecommendedDestinations([]);
        return;
      }
      setRecoLoading(true);
      try {
        const mappedExact = userInterests.flatMap((i) => INTEREST_RULES[i] || INTEREST_RULES_LC[i.toLowerCase()] || []);
        const targetCatsExact = [...new Set(mappedExact)];
        if (targetCatsExact.length === 0) {
          setRecommendedDestinations([]);
          setRecoLoading(false);
          return;
        }

        const queryTerms = [...new Set(targetCatsExact.flatMap(t => [t, t.toLowerCase(), t.toUpperCase()]))];
        const all = new Map();
        const chunkSize = 10;

        const fetchByArrayField = async (field) => {
          for (let i = 0; i < queryTerms.length; i += chunkSize) {
            const chunk = queryTerms.slice(i, i + chunkSize);
            const q = fsQuery(
              collection(db, 'destinations'),
              fsWhere(field, 'array-contains-any', chunk),
              limit(50)
            );
            const snap = await getDocs(q);
            snap.forEach((d) => { if (!all.has(d.id)) all.set(d.id, { id: d.id, ...d.data() }); });
          }
        };

        const fetchByStringField = async (field) => {
          for (let i = 0; i < queryTerms.length; i += chunkSize) {
            const chunk = queryTerms.slice(i, i + chunkSize);
            const q = fsQuery(
              collection(db, 'destinations'),
              fsWhere(field, 'in', chunk),
              limit(50)
            );
            const snap = await getDocs(q);
            snap.forEach((d) => { if (!all.has(d.id)) all.set(d.id, { id: d.id, ...d.data() }); });
          }
        };

        await Promise.all([
          fetchByStringField('category'),
          fetchByArrayField('categories'),
          fetchByArrayField('Category'),
          fetchByArrayField('tags')
        ]);

        const allowedCanon = new Set(targetCatsExact.map(canon));

        const scored = Array.from(all.values()).map((d) => {
          const catsArr = Array.isArray(d.categories) ? d.categories
                        : Array.isArray(d.Category) ? d.Category
                        : Array.isArray(d.category) ? d.category
                        : (typeof d.category === 'string' ? [d.category] : []);

          const score = catsArr.reduce((acc, c) => acc + (allowedCanon.has(canon(c)) ? 1 : 0), 0);
          return { ...d, _matchScore: score };
        });

        const results = scored
          .filter((d) => d._matchScore > 0)
          .sort((a, b) => {
            if (b._matchScore !== a._matchScore) return b._matchScore - a._matchScore;
            return (b.rating || 0) - (a.rating || 0);
          })
          .map((d) => ({
            id: d.id,
            name: d.name || d.title || '',
            region: d.region || d.locationRegion || '',
            description: d.description || d.desc || '',
            rating: d.rating || 0,
            price: d.price || '',
            priceTier: d.priceTier || null,
            tags: Array.isArray(d.tags) ? d.tags : [],
            category: Array.isArray(d.category) ? d.category : [],
            location: d.location || '',
            image: d.image || d.imageUrl || '',
            bestTime: d.bestTime || '',
          }));

        setRecommendedDestinations(results);
      } catch (e) {
        console.error('recommendation fetch failed', e);
        setRecommendedDestinations([]);
      } finally {
        setRecoLoading(false);
      }
    };

    run();
  }, [userInterests]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) { setPersonalizedBookmarks({}); return; }
      try {
        const [subsSnap, listSnap] = await Promise.all([
          getDocs(collection(db, 'users', u.uid, 'bookmarks')),
          getDoc(doc(db, 'userBookmarks', u.uid)).catch(() => null)
        ]);
        const map = {};
        subsSnap.forEach(d => { map[d.id] = true; });
        if (listSnap && listSnap.exists()) {
          const arr = Array.isArray(listSnap.data()?.bookmarks) ? listSnap.data().bookmarks : [];
          arr.forEach(id => { map[String(id)] = true; });
        }
        setPersonalizedBookmarks(map);
      } catch {
        setPersonalizedBookmarks({});
      }
    });
    return () => unsub();
  }, []);

  const handlePersonalizedBookmark = async (id) => {
    const user = auth.currentUser;
    if (!user) { alert('Please sign in to use bookmarks.'); return; }

    const next = !personalizedBookmarks[id];
    setPersonalizedBookmarks(prev => ({ ...prev, [id]: next }));

    try {
      const d = recommendedDestinations.find(x => String(x.id) === String(id)) || {};
      const ref = doc(db, 'users', user.uid, 'bookmarks', String(id));
      const listRef = doc(db, 'userBookmarks', user.uid);

      if (next) {
        const payload = {
          id: d.id || String(id),
          name: d.name || '',
          description: d.description || '',
          region: d.region || '',
          rating: d.rating || 0,
          price: d.price || '',
          priceTier: d.priceTier || null,
          tags: Array.isArray(d.tags) ? d.tags : [],
          category: Array.isArray(d.category) ? d.category : [],
          location: d.location || '',
          image: d.image || pickCardImage(d.name) || '',
          bestTime: d.bestTime || '',
          createdAt: serverTimestamp()
        };
        await setDoc(ref, payload, { merge: true });
        await setDoc(listRef, { userId: user.uid, updatedAt: serverTimestamp(), bookmarks: arrayUnion(String(id)) }, { merge: true });
      } else {
        await deleteDoc(ref);
        await setDoc(listRef, { userId: user.uid, updatedAt: serverTimestamp(), bookmarks: arrayRemove(String(id)) }, { merge: true });
      }
    } catch (e) {
      console.error('bookmark toggle failed', e);
      setPersonalizedBookmarks(prev => ({ ...prev, [id]: !next }));
      alert('Failed to update bookmark. Please try again.');
    }
  };

  const handlePersonalizedDetails = (card) => {
    setSelectedCard(card);
    setDetailsModalOpen(true);
  };

  const closeDetailsModal = () => {
    setDetailsModalOpen(false);
    setSelectedCard(null);
  };

  const sortedRecommendedDestinations = [...recommendedDestinations].sort((a, b) => {
    const ra = Number(a.rating) || 0;
    const rb = Number(b.rating) || 0;
    if (personalizedSort === 'rating-asc') return ra - rb;
    return rb - ra;
  });
  
    function getBreakdown(price) {
    if (!price) return [];
    const digits = String(price).replace(/[^\d]/g, '');
    if (!digits) return [];
    const key = `P${digits}`;
    return breakdown[key] || [];
  }

    const fareOptions = [
    { type: 'sea', label: '₱500 - ₱850+ (Sea Travel: short routes)', value: 'sea-short' },
    { type: 'sea', label: '₱1,100 - ₱7,100+ (Sea Travel: long routes)', value: 'sea-long' },
    { type: 'air', label: '₱1,500 - ₱4,000+ (Air Travel: short routes)', value: 'air-short' },
    { type: 'air', label: '₱2,500 - ₱8,600+ (Air Travel: long routes)', value: 'air-long' },
    ];

  const getFareLabel = (val) => fareOptions.find(f => f.value === val)?.label || '';

  const selectedFareAmounts = selectedFares
    .map(val => {
        const label = getFareLabel(val);
        return parseFareRange(label);
    })
    .filter(Boolean);

    const totalSelectedFare = selectedFareAmounts.length > 0
    ? selectedFareAmounts.reduce((sum, v) => sum + v, 0)
    : 0;

    const getTotalPrice = (basePrice) => {
    let base = 0;
    if (typeof basePrice === 'number') base = basePrice;
    else if (typeof basePrice === 'string') {
        const digits = basePrice.replace(/[^\d]/g, '');
        base = digits ? Number(digits) : 0;
    }
    return base + totalSelectedFare;
    };

    function parseFareRange(str) {
    const match = str.match(/₱([\d,]+)\s*-\s*₱([\d,]+)/);
    if (!match) return 0;
    return Number(match[2].replace(/,/g, ''));
    }
    
    const onAddToTrip = async (dest) => {
        const u = auth.currentUser;
        if (!u) { alert('Please sign in to add to My Trips.'); return; }
        setAddingTripId(dest.id);
        try {
        const destinationData = {
            id: dest.id,
            name: dest.name || '',
            display_name: dest.name || '',
            region: dest.region || dest.locationRegion || '',
            location: dest.location || '',
            description: dest.description || '',
            rating: dest.rating || 0,
            price: dest.price || '',
            priceTier: dest.priceTier || null,
            tags: Array.isArray(dest.tags) ? dest.tags : [],
            category: Array.isArray(dest.category) ? dest.category : [],
            bestTime: dest.bestTime || dest.best_time || '',
            image: dest.image || dest.imageUrl || getImageForDestination(dest.name) || '',
        };

        navigate('/itinerary', { state: { prefill: destinationData } });

        setAddedTripId(dest.id);
        setTimeout(() => setAddedTripId(null), 1200);
        } catch (e) {
        console.error('Failed to add to My Trips:', e);
        alert('Failed to add to My Trips.');
        } finally {
        setAddingTripId(null);
        }
  };
  
    const ratePersonalizedSelected = async (value) => {
    const u = auth.currentUser;
    if (!u) { alert('Please sign in to rate.'); return; }
    if (!selectedCard) return;
    const v = Math.max(1, Math.min(5, Number(value) || 0));
    setPersonalizedSavingRating(true);
    try {
        const ref = doc(db, 'destinations', String(selectedCard.id), 'ratings', u.uid);
        await setDoc(ref, {
        value: v,
        userId: u.uid,
        updatedAt: serverTimestamp(),
        name: selectedCard.name || '',
        }, { merge: true });

        setPersonalizedUserRating(v);

        const userRatingRef = doc(db, 'users', u.uid, 'ratings', String(selectedCard.id));
        await setDoc(
        userRatingRef,
        {
            destId: String(selectedCard.id),
            value: v,
            updatedAt: serverTimestamp(),
            name: selectedCard.name || '',
        },
        { merge: true }
        );

        const rsnap = await getDocs(collection(db, 'destinations', String(selectedCard.id), 'ratings'));
        let sum = 0, count = 0;
        rsnap.forEach((r) => { const val = Number(r.data()?.value) || 0; if (val > 0) { sum += val; count += 1; } });
        const avg = count ? sum / count : 0;

        setPersonalizedRatingsByDest((m) => ({ ...m, [selectedCard.id]: { avg, count } }));
    } catch (e) {
        console.error('Save rating failed:', e);
        alert('Failed to save rating.');
    } finally {
        setPersonalizedSavingRating(false);
    }
    };

  return (
    <>
      <DashboardBanner setShowAIModal={setShowAIModal} />
      <DashboardStats />

      <div className="dashboard-preview-row">
        <TripsPreview setShowAIModal={setShowAIModal} />
        <BookmarksPreview onOpenDetails={handlePersonalizedDetails} />
      </div>

      <div className="personalized-section-dashboard">
        <div className="personalized-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <span>Personalized for You</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label htmlFor="personalized-sort" style={{ fontSize: 15, color: '#64748b' }}>Sort by:</label>
            <select
              id="personalized-sort"
              value={personalizedSort}
              onChange={e => setPersonalizedSort(e.target.value)}
              style={{ borderRadius: 8, border: '1px solid #e5e7eb', padding: '4px 10px', fontSize: 14, background: '#f8fafc', color: '#334155' }}
            >
              <option value="rating-desc" className='description'>Highest Rating</option>
              <option value="rating-asc" className='description'>Lowest Rating</option>
            </select>
          </div>
        </div>

        {recoLoading && (
          <div className="dashboard-preview-empty">Finding destinations based on your interests…</div>
        )}

        {!recoLoading && sortedRecommendedDestinations.length === 0 && (
          <div className="dashboard-preview-empty">
            No personalized destinations yet. Add interests on your profile to get recommendations.
          </div>
        )}

        <div className="personalized-cards-grid">
          {sortedRecommendedDestinations.map((d) => (
            <DestinationCard
              key={d.id}
              id={d.id}
              name={d.name}
              region={d.region}
              rating={Number(d.rating || 0).toFixed(1)}
              price={d.price}
              priceTier={d.priceTier}
              description={d.description}
              tags={(d.tags || d.categories || []).slice(0, 8)}
              image={pickCardImage(d.name)}
              isBookmarked={!!personalizedBookmarks[d.id]}
              onBookmarkClick={() => handlePersonalizedBookmark(d.id)}
              onDetails={() => handlePersonalizedDetails(d)}
            />
          ))}
        </div>
      </div>

      {detailsModalOpen && selectedCard && (
        <div
          className="modal-overlay active"
          onClick={(e) => e.target.classList.contains('modal-overlay') && closeDetailsModal()}
        >
          <div className="modal-content details-modal">
            <button className="modal-close-floating" onClick={closeDetailsModal} aria-label="Close">
              ✕
            </button>

            <div className="details-hero1">
              <div className="details-hero-image">
                {cloudImages.length === 0 ? (
                  <div style={{ width: "100%", height: 240, background: "#e0e7ef", borderRadius: 16 }} />
                ) : (
                  <img
                    src={pickCardImage(selectedCard.name)}
                    alt={selectedCard.name}
                    style={{
                      width: "100%",
                      height: 240,
                      objectFit: "cover",
                      objectPosition: "center",
                      borderRadius: "16px 16px 0 0",
                      marginBottom: 8,
                      background: "#e0e7ef"
                    }}
                  />
                )}
              </div>
            </div>

            <div className="details-body1">
              <div className="details-head-row">
                <div className="details-title-col">
                  <div className="details-grid">
                    <h2 className="details-title">{selectedCard.name}</h2>
                      <div className="trip-item">
                        <span
                          className={`pill small ${
                            selectedCard.priceTier === 'less' ? 'pill-green' : 'pill-gray'
                          }`}
                          title={selectedCard.priceTier === 'less' ? 'Less Expensive tier' : 'Expensive tier'}
                        >
                          {selectedFares.length > 0
                            ? `₱${getTotalPrice(selectedCard.price).toLocaleString()}`
                            : formatPeso(selectedCard.price)}
                        </span>
                        {selectedCard.category ? (
                          <span className="badge purple">{selectedCard.category}</span>
                        ) : (
                          <span className="badge purple">No category</span>
                        )}
                    </div>
                  </div>

                  <div className='details-grid'>
                    <div className="section-title1">
                      {selectedCard.location ? (
                        <span className="badge blue">{selectedCard.location}</span>
                      ) : (
                        <span className="badge blue">No location  </span>
                      )}
                      <a href="https://maps.google.com" className="details-region" onClick={(e) => e.preventDefault()}>
                        {selectedCard.region}
                      </a>
                    </div>
                    <div className="section-title1">
                      <div className="trip-label">Best Time to Visit</div>
                      <div className="trip-text">{selectedCard.bestTime}</div>
                    </div>  
                  </div>

                  <div className="details-rating-row">
                    <span className="star">⭐</span>
                    <span className="muted">
                      {(personalizedRatingsByDest[selectedCard.id]?.count ?? 0) > 0
                        ? (personalizedRatingsByDest[selectedCard.id].avg).toFixed(1)
                        : '0'}
                    </span>
                    <span className="muted"> (Average Rating)</span>
                    <span className="muted">
                      ({personalizedRatingsCountByDest[selectedCard.id] !== undefined
                        ? personalizedRatingsCountByDest[selectedCard.id]
                        : 0} ratings)
                    </span>
                    <span className="muted sep">Rating:</span>
                    <div className="your-stars">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          className={`star-btn ${personalizedUserRating >= n ? 'filled' : ''}`}
                          onClick={() => ratePersonalizedSelected(n)}
                          disabled={personalizedSavingRating}
                          aria-label={`${n} star${n > 1 ? 's' : ''}`}
                          title={`${n} star${n > 1 ? 's' : ''}`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <span className="muted sep">
                      Reviews: {
                        userReviewsCountByDest[selectedCard.id] !== undefined
                          ? userReviewsCountByDest[selectedCard.id]
                          : 0
                      }
                    </span>
                  </div>
                </div>

                <div className="details-actions1">
                  <button 
                    className={`btn-outline ${personalizedBookmarks[selectedCard.id] ? 'active' : ''}`}
                    onClick={() => handlePersonalizedBookmark(selectedCard.id)}
                  >
                    <span className="icon">{personalizedBookmarks[selectedCard.id] ? '❤️' : '🤍'}</span>
                    {personalizedBookmarks[selectedCard.id] ? 'Bookmarked' : 'Bookmark'}
                  </button>
                  <button
                    className={`btn-green ${addedTripId === selectedCard.id ? 'btn-success' : ''}`}
                    onClick={() => onAddToTrip(selectedCard)}
                    disabled={addingTripId === selectedCard.id}
                    aria-busy={addingTripId === selectedCard.id}
                  >
                    <span className="icon">
                      {addedTripId === selectedCard.id ? '✔' : '＋'}
                    </span>
                    {addingTripId === selectedCard.id
                      ? 'Adding…'
                      : addedTripId === selectedCard.id
                      ? 'Added!'
                      : 'Add to Trip'}
                  </button>
                </div>
              </div>

                <div className="details-left">
                  <div className="section-title">Description</div>
                  <p className="details-paragraph">{selectedCard.description}</p>

                  <div className="section-title">Tags</div>
                  <div className="badge-row">
                    {(selectedCard.tags || selectedCard.categories || []).map((t, i) => (
                      <span key={i} className="badge">{t}</span>
                    ))}
                  </div>

                  <div className="section-title">Price Breakdown:</div>
                    <div style={{ fontWeight: '300', fontStyle: 'italic', justifyContent: 'left', textAlign: 'left', marginBottom: '10px' }}>Price may vary on different factors</div>
                    <div className="breakdown-box">
                    {(() => {
                      const budgetOrPrice = selectedCard.budget || selectedCard.price;
                      if (!budgetOrPrice) return null;

                      const breakdownArr = getBreakdown(budgetOrPrice);
                      if (!breakdownArr.length) return <span>No breakdown available.</span>;
                      return (
                        <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6', justifyContent: 'left', textAlign: 'left' }}>
                          {breakdownArr.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      );
                    })()}
                    </div>

                  <div className="section-title">Additional Fees:</div>
                  <div style={{ fontWeight: '300', fontStyle: 'italic', justifyContent: 'left', textAlign: 'left', marginBottom: '10px' }}>Price may vary on different class</div>
                  <div className="breakdown-box" style={{textAlign: 'left'}}>
                    <div style={{ marginBottom: 10 }}>
                      {fareOptions.map(opt => (
                        <label key={opt.value} style={{ display: 'block', marginBottom: 2, fontWeight: 'normal', fontSize: 14 }}>
                          <input
                            type="checkbox"
                            checked={selectedFares.includes(opt.value)}
                            onChange={e => {
                              setSelectedFares(prev => {
                                if (e.target.checked) return [...prev, opt.value];
                                return prev.filter(v => v !== opt.value);
                              });
                            }}
                          />
                          <span style={{ marginLeft: 6 }}>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {selectedCard && (
                    <div style={{ marginBottom: 24 }}>
                      <div className="section-title" style={{ marginBottom: 8 }}>User Reviews</div>
                      <ReviewsList destId={selectedCard.id} currentUser={currentUser} />
                    </div>
                  )}
                  
                  <div className="section-title">Write a Review</div>
                  <div
                    className="review-box"
                    style={{
                      width: '100%',
                      gridColumn: '1 / -1',
                      marginBottom: 18,
                      zIndex: 1
                    }}
                  >
                    <WriteReview
                      destId={selectedCard.id}
                      user={auth.currentUser || currentUser}
                      onReviewSaved={() => {
                        (async () => {
                          try {
                            const reviewsSnap = await getDocs(collection(db, 'destinations', selectedCard.id, 'reviews'));
                            setUserReviewsCountByDest(prev => ({
                              ...prev,
                              [selectedCard.id]: reviewsSnap.size || 0
                            }));
                          } catch (e) {}
                        })();
                      }}
                    />
                  </div>

                  <div className="section-title">Packing Suggestions</div>
                  <div className="packing-box">
                    {(() => {
                      if (!selectedCard) return <div className="packing-empty">No packing suggestions available.</div>;

                      let raw = selectedCard.packingSuggestions || selectedCard.packing || "";
                      if (Array.isArray(raw) && raw.length > 0) {
                        return (
                          <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6', textAlign: 'left' }}>
                            {raw.map((s, i) => <li key={i}>{s}</li>)}
                          </ul>
                        );
                      }
                      if (typeof raw === "string" && raw.trim().length > 0) {
                        const lines = raw.split(/[\n•\-*]/).map(l => l.trim()).filter(Boolean);
                        if (lines.length > 0) {
                          return (
                            <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6', textAlign: 'left' }}>
                              {lines.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                          );
                        }
                      }

                      const { category: packingCategory } = require('./rules');
                      let cats = 
                        Array.isArray(selectedCard.category)
                          ? selectedCard.category
                          : Array.isArray(selectedCard.categories)
                          ? selectedCard.categories
                          : typeof selectedCard.category === "string"
                          ? [selectedCard.category]
                          : typeof selectedCard.categories === "string"
                          ? [selectedCard.categories]
                          : [];

                      let found = [];
                      for (let c of cats) {
                        if (!c) continue;
                        const key = c.trim().toLowerCase();
                        if (packingCategory[key]) {
                          found = packingCategory[key];
                          break;
                        }
                        const singular = key.endsWith("s") ? key.slice(0, -1) : key;
                        if (packingCategory[singular]) {
                          found = packingCategory[singular];
                          break;
                        }
                      }
                      if (found.length > 0) {
                        return (
                          <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6', textAlign: 'left' }}>
                            {found.map((s, i) => <li key={i}>{s}</li>)}
                          </ul>
                        );
                      }

                      return <div className="packing-empty">No packing suggestions available.</div>;
                    })()}
                  </div>
                </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function WriteReview({ destId, user, onReviewSaved }) {
  const [review, setReview] = useState('');
  const [star, setStar] = useState(0);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [checkingReview, setCheckingReview] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function checkExistingReview() {
      if (!user || !destId) {
        if (!ignore) { setAlreadyReviewed(false); setCheckingReview(false); }
        return;
      }
      try {
        setCheckingReview(true);
        const reviewDoc = await getDoc(doc(db, "destinations", String(destId), "reviews", user.uid));
        if (!ignore) setAlreadyReviewed(reviewDoc.exists());
      } catch {
        if (!ignore) setAlreadyReviewed(false);
      } finally {
        if (!ignore) setCheckingReview(false);
      }
    }
    checkExistingReview();
    return () => { ignore = true; };
  }, [user, destId, success]);

  useEffect(() => {
    if (!user || !destId) return;
    let ignore = false;
    async function fetchUserRating() {
      try {
        const ratingDoc = await getDoc(doc(db, "destinations", String(destId), "ratings", user.uid));
        if (!ignore) setStar(Number(ratingDoc.data()?.value) || 0);
      } catch {
        if (!ignore) setStar(0);
      }
    }
    fetchUserRating();
    return () => { ignore = true; };
  }, [user, destId, success]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (!user) throw new Error("You must be signed in to write a review.");
      if (!review.trim()) throw new Error("Review cannot be empty.");
      if (star < 1 || star > 5) throw new Error("Please select a star rating.");

      await runTransaction(db, async (tx) => {
        const reviewRef = doc(db, "destinations", String(destId), "reviews", user.uid);
        const snap = await tx.get(reviewRef);
        if (snap.exists()) {
          throw new Error("You have already submitted a review for this destination.");
        }
        const reviewData = {
          userId: user.uid,
          userName: user.displayName || user.email || "Anonymous",
          review: review.trim(),
          rating: star,
          createdAt: new Date().toISOString(),
        };
        tx.set(reviewRef, reviewData);

        const ratingRef = doc(db, "destinations", String(destId), "ratings", user.uid);
        tx.set(
          ratingRef,
          {
            value: star,
            userId: user.uid,
            updatedAt: serverTimestamp(),
            name: user.displayName || user.email || "Anonymous",
          },
          { merge: true }
        );
      });

      setSuccess("Review submitted!");
      setAlreadyReviewed(true);
      setReview('');
      setStar(0);
      if (onReviewSaved) onReviewSaved();
    } catch (err) {
      setError(err.message || "Failed to submit review.");
      console.error("Firestore error:", err);
    } finally {
      setSaving(false);
    }
  };
  
  if (checkingReview) {
    return <div style={{ color: "#64748b", marginBottom: 8 }}>Checking existing review…</div>;
  }
  if (alreadyReviewed && !success) {
    return (
      <div
        role="status"
        style={{
          width: '100%',
          textAlign: 'center',
          color: '#0862ea',
          fontWeight: 600,
          fontSize: 14,
          lineHeight: 1.35,
          padding: '8px 0',
          margin: '2px 0 10px 0'
        }}
      >
        You have already submitted a review for this destination.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ fontWeight: 500, fontSize: 13 }}>Your Rating:</span>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setStar(n)}
            style={{
              background: 'none',
              border: 'none',
              cursor: alreadyReviewed || saving ? 'not-allowed' : 'pointer',
              fontSize: 18,
              color: n <= star ? '#ffb300' : '#d1d5db',
              padding: 0,
              marginRight: 2,
              transition: 'color 0.15s',
              outline: 'none'
            }}
            disabled={alreadyReviewed || saving}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            ★
          </button>
        ))}
      </div>
      <div style={{ position: 'relative' }}>
        <textarea
          value={review}
          onChange={e => setReview(e.target.value)}
          placeholder={alreadyReviewed ? "You have already submitted a review." : "Write your review here..."}
          rows={3}
          style={{
            width: '100%',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            padding: 12,
            paddingRight: 50,
            fontSize: 15,
            resize: 'vertical'
          }}
          disabled={checkingReview || saving || alreadyReviewed}
        />
        <button
          type="submit"
          aria-label="Submit review"
          disabled={checkingReview || saving || !review.trim() || alreadyReviewed || star < 1}
          style={{
            position: 'absolute',
            right: 8,
            bottom: 8,
            width: 36,
            height: 36,
            borderRadius: '999px',
            background: 'transparent',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: saving || !review.trim() || alreadyReviewed || star < 1 ? 'not-allowed' : 'pointer',
            opacity: saving || !review.trim() || alreadyReviewed || star < 1 ? 0.6 : 1
          }}
        >
          <img src="send.png" alt="Send" style={{ width: 18, height: 18 }} />
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {success && <span style={{ color: "#22c55e" }}>{success}</span>}
        {error && <span style={{ color: "#e74c3c" }}>{error}</span>}
      </div>
    </form>
  );
}

function ReviewsList({ destId, currentUser }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState(null);

  useEffect(() => {
    let ignore = false;
    async function fetchReviews() {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "destinations", String(destId), "reviews"));
        let arr = [];
        snap.forEach(docSnap => {
          const data = docSnap.data() || {};
          const parsedRating = Number(data.rating ?? data.value ?? data.stars ?? data.rate ?? 0) || 0;

          arr.push({
            id: docSnap.id,
            userName: data.userName || "Anonymous",
            review: data.review || "",
            createdAt: data.createdAt,
            userId: data.userId,
            rating: parsedRating,
          });
        });

        arr = await Promise.all(
          arr.map(async (r) => {
            if (r.rating > 0) return r;
            try {
              const rSnap = await getDoc(doc(db, "destinations", String(destId), "ratings", r.id));
              const v = Number(rSnap.data()?.value) || 0;
              return { ...r, rating: v };
            } catch {
              return r;
            }
          })
        );

        arr.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        if (!ignore) setReviews(arr);
      } catch {
        if (!ignore) setReviews([]);
      }
      setLoading(false);
    }
    if (destId) fetchReviews();
    return () => { ignore = true; };
  }, [destId]);


  useEffect(() => {
    if (!currentUser || !destId) { setUserRating(null); return; }
    let ignore = false;
    async function fetchUserRating() {
      try {
        const ratingDoc = await getDoc(doc(db, "destinations", String(destId), "ratings", currentUser.uid));
        if (!ignore) setUserRating(Number(ratingDoc.data()?.value) || null);
      } catch {
        if (!ignore) setUserRating(null);
      }
    }
    fetchUserRating();
    return () => { ignore = true; };
  }, [currentUser, destId]);

  if (loading) return <div style={{ color: "#888", fontSize: 14 }}>Loading reviews…</div>;
  if (!reviews.length) return <div style={{ color: "#888", fontSize: 14 }}>No user reviews yet.</div>;

  let userReview = null;
  let otherReviews = reviews;
  if (currentUser) {
    userReview = reviews.find(r => r.id === currentUser.uid);
    otherReviews = reviews.filter(r => r.id !== currentUser.uid);
  }

  const renderStars = (rating) => (
    <span style={{ marginLeft: 8, marginRight: 8 }}>
      {Array.from({ length: 5 }).map((_, idx) => (
        <span
          key={idx}
          style={{
            color: idx < rating ? "#ffb300" : "#d1d5db",
            fontSize: 18,
            marginRight: 2,
            verticalAlign: "middle",
            fontFamily: "Arial, sans-serif",
          }}
        >
          ★
        </span>
      ))}
    </span>
  );

  const userStars = (userReview && Number(userReview.rating) > 0)
  ? Number(userReview.rating)
  : Number(userRating || 0);

  const cardStyle = {
    background: "#e0f7fa",
    border: "2px solid #38bdf8",
    borderRadius: 16,
    padding: "12px 16px",
    fontSize: 18,
    boxShadow: "0 1px 2px rgba(0,0,0,.03)",
    marginBottom: 0,
    marginTop: 0,
    marginLeft: 0,
    marginRight: 0,
    minWidth: 220,
    maxWidth: 600,
    width: "100%",
    boxSizing: "border-box"
  };

  const nameStyle = {
    fontWeight: 700,
    color: "#2196f3",
    fontSize: 14,
    marginRight: 10,
    marginBottom: 0,
    display: "inline-block"
  };

  const dateStyle = {
    color: "#6b7280",
    fontSize: 12,
    marginBottom: 0,
    display: "block",
    textAlign: "left",
  };

  const reviewTextStyle = {
    marginTop: 10,
    marginLeft: 15,
    marginBottom: 10,
    fontSize: 14,
    color: "#222",
    textAlign: "left",
    fontFamily: "inherit",
    fontWeight: 400,
    wordBreak: "break-word"
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {userReview && (
        <div key={userReview.id} style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 0, flexWrap: "wrap" }}>
            <span style={nameStyle}>
              {userReview.userName} (You)
            </span>
            {renderStars(userStars, 24)}
          </div>
          <span style={dateStyle}>
            {userReview.createdAt ? new Date(userReview.createdAt).toLocaleString() : ""}
          </span>
          <div style={reviewTextStyle}>{userReview.review}</div>
        </div>
      )}
      {otherReviews.map((r) => (
        <div key={r.id} style={{ ...cardStyle, background: "#f8fafc", border: "1.5px solid #b6c7d6", color: "#222" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 0, flexWrap: "wrap" }}>
            <span style={{ ...nameStyle, color: "#0d47a1" }}>{r.userName}</span>
            {renderStars(Number(r.rating) || 0, 22)}
          </div>
          <span style={dateStyle}>{r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}</span>
          <div style={reviewTextStyle}>{r.review}</div>
        </div>
      ))}
    </div>
  );
}

export default Dashboard;