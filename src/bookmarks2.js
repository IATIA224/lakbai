import React, { useEffect, useMemo, useState } from 'react';
import './Styles/bookmark2.css';
import { db, auth } from './firebase';
import {
  addDoc,
  collection,
  serverTimestamp,
  setDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  query as fsQuery,
  arrayUnion,
  arrayRemove,
  deleteDoc,
} from 'firebase/firestore';

const initialDestinations = [
  {
    id: 'boracay',
    name: 'Boracay Island',
    region: 'Region VI - Western Visayas',
    rating: 4.8,
    price: '₱3,500',
    priceTier: 'expensive',
    description:
      'World-famous white sand beach destination with crystal clear waters and vibrant nightlife. Perfect for water sports, beach relaxation, and island hopping adventures.',
    tags: ['Beach', 'Water Sports', 'Nightlife', 'Island Hopping'],
    categories: ['Beaches', 'Islands', 'Tourist'],
    bestTime: 'November to April',
  },
  {
    id: 'banaue',
    name: 'Banaue Rice Terraces',
    region: 'CAR - Cordillera Administrative Region',
    rating: 4.7,
    price: '₱1,800',
    priceTier: 'less',
    description:
      'Ancient rice terraces carved into mountains, often called the “Eighth Wonder of the World.”',
    tags: ['UNESCO', 'Cultural', 'Hiking'],
    categories: ['Mountains', 'Cultural'],
    bestTime: 'December to May',
  },
  {
    id: 'palawan-underground',
    name: 'Palawan Underground River',
    region: 'Region IV-B - MIMAROPA',
    rating: 4.6,
    price: '₱2,500',
    priceTier: 'expensive',
    description:
      'Subterranean river flowing through a spectacular limestone karst landscape.',
    tags: ['UNESCO', 'Cave', 'Boat Tour'],
    categories: ['Caves', 'Islands'],
    bestTime: 'November to May',
  },
  {
    id: 'mayon',
    name: 'Mayon Volcano',
    region: 'Region V - Bicol Region',
    rating: 4.5,
    price: '₱1,200',
    priceTier: 'less',
    description:
      'Perfect cone-shaped active volcano, considered the most beautiful volcano in the Philippines.',
    tags: ['Volcano', 'Hiking', 'Photography'],
    categories: ['Mountains', 'Parks'],
    bestTime: 'February to April',
  },
  {
    id: 'chocolate-hills',
    name: 'Chocolate Hills',
    region: 'Region VII - Central Visayas',
    rating: 4.4,
    price: '₱1,300',
    priceTier: 'less',
    description:
      'Unique geological formation of over 1,200 hills that turn chocolate brown in dry season.',
    tags: ['Geological Wonder', 'View', 'Photography'],
    categories: ['Landmarks', 'Natural'],
    bestTime: 'December to May',
  },
  {
    id: 'intramuros',
    name: 'Intramuros',
    region: 'NCR - National Capital Region',
    rating: 4.3,
    price: '₱800',
    priceTier: 'less',
    description:
      'Historic walled city built during Spanish colonial period. Features museums, churches, and cobbled streets.',
    tags: ['Historical', 'Colonial', 'Museums'],
    categories: ['Historical', 'Museums'],
    bestTime: 'All year',
  },
  // Add more items to approach “12 destinations” UI
  { id: 'el-nido', name: 'El Nido', region: 'Region IV-B - MIMAROPA', rating: 4.8, price: '₱3,200', priceTier: 'expensive', description: 'Dramatic limestone cliffs and turquoise lagoons.', tags: ['Islands', 'Snorkeling', 'Boat Tour'], categories: ['Islands'], bestTime: 'November to May' },
  { id: 'siargao', name: 'Siargao', region: 'CARAGA - Region XIII', rating: 4.7, price: '₱2,200', priceTier: 'expensive', description: 'Surfing capital with laid-back island vibes.', tags: ['Surfing', 'Beach'], categories: ['Beaches', 'Parks'], bestTime: 'March to October' },
  { id: 'vigan', name: 'Vigan', region: 'Region I - Ilocos Region', rating: 4.5, price: '₱1,500', priceTier: 'less', description: 'Well-preserved Spanish colonial town.', tags: ['UNESCO', 'Cultural'], categories: ['Historical', 'Cultural'], bestTime: 'December to March' },
  { id: 'puerto-galera', name: 'Puerto Galera', region: 'Region IV-B - MIMAROPA', rating: 4.2, price: '₱1,600', priceTier: 'less', description: 'Diving spots and beaches close to Manila.', tags: ['Diving', 'Beach'], categories: ['Beaches'], bestTime: 'November to May' },
  { id: 'pagudpud', name: 'Pagudpud', region: 'Region I - Ilocos Region', rating: 4.4, price: '₱1,400', priceTier: 'less', description: 'Northern white-sand beaches and windmills.', tags: ['Beach', 'View'], categories: ['Beaches'], bestTime: 'December to April' },
  { id: 'bohol', name: 'Bohol Countryside', region: 'Region VII - Central Visayas', rating: 4.6, price: '₱1,900', priceTier: 'less', description: 'Countryside tour with tarsiers and rivers.', tags: ['River Cruise', 'Wildlife'], categories: ['Natural'], bestTime: 'November to May' },
];

export default function Bookmarks2() {
  // Firestore-backed destinations and bookmarks
  const [destinations, setDestinations] = useState([]);
  const [bookmarks, setBookmarks] = useState(new Set());
  const [currentUser, setCurrentUser] = useState(null);
  // NEW: page loading state
  const [isLoading, setIsLoading] = useState(true);

  // UI state
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('name'); // name | rating | price
  const [selectedRegions, setSelectedRegions] = useState(new Set());
  const [selectedPrice, setSelectedPrice] = useState(null); // less | expensive | null
  const [selectedCats, setSelectedCats] = useState(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [addingTripId, setAddingTripId] = useState(null);
  const [addedTripId, setAddedTripId] = useState(null); // NEW: show ✔ after success

  // NEW: ratings state
  const [ratingsByDest, setRatingsByDest] = useState({}); // { [destId]: { avg, count } }
  const [userRating, setUserRating] = useState(0);        // current user's rating for selected
  const [savingRating, setSavingRating] = useState(false);

  // NEW: bookmark toggle pending (modal)
  const [bookmarking, setBookmarking] = useState(false);

  // NEW: pagination
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // 1) Ensure destinations exist in Firestore, then fetch them
  useEffect(() => {
    const seedAndFetch = async () => {
      try {
        setIsLoading(true);
        for (const d of initialDestinations) {
          const ref = doc(db, 'destinations', d.id);
          const snap = await getDoc(ref);
          if (!snap.exists()) {
            // Start with zero rating/aggregate fields
            await setDoc(ref, {
              ...d,
              rating: 0,
              ratingSum: 0,
              ratingCount: 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }

        const q = fsQuery(collection(db, 'destinations'));
        const snap = await getDocs(q);
        const items = snap.docs.map((x) => ({ id: x.id, ...x.data() }));
        setDestinations(items);
      } catch (e) {
        console.error('Seed/fetch destinations failed:', e);
        setDestinations(initialDestinations.map(i => ({ ...i, rating: 0 })));
      } finally {
        setIsLoading(false);
      }
    };

    seedAndFetch();
  }, []);

  // 2) Listen to auth and the current user's bookmarks
  useEffect(() => {
    let unsubUserDoc = null;
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user || null);
      if (user) {
        const userRef = doc(db, 'userBookmarks', user.uid);
        // Create doc if not exists (so updateDoc won’t fail later)
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(userRef, { bookmarks: [], createdAt: serverTimestamp() }, { merge: true });
        }
        unsubUserDoc = onSnapshot(userRef, (s) => {
          const ids = (s.exists() ? s.data().bookmarks : []) || [];
          setBookmarks(new Set(ids));
        });
      } else {
        setBookmarks(new Set());
        if (unsubUserDoc) unsubUserDoc();
      }
    });
    return () => {
      if (unsubUserDoc) unsubUserDoc();
      unsubAuth();
    };
  }, []);

  // Regions/Categories derived from Firestore data
  const regions = useMemo(
    () => [...new Set(destinations.map((d) => d.region).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [destinations]
  );
  const categories = useMemo(() => {
    const s = new Set();
    destinations.forEach((d) => (d.categories || []).forEach((c) => s.add(c)));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [destinations]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = destinations.filter((d) => {
      const q = query.trim().toLowerCase();
      const matchesQ =
        !q ||
        d.name?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        d.region?.toLowerCase().includes(q);
      const matchesRegion = !selectedRegions.size || selectedRegions.has(d.region);
      const matchesPrice = !selectedPrice || selectedPrice === d.priceTier;
      const matchesCat = !selectedCats.size || (d.categories || []).some((c) => selectedCats.has(c));
      return matchesQ && matchesRegion && matchesPrice && matchesCat;
    });

    if (sortBy === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'rating') list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    if (sortBy === 'price') {
      const n = (x) => parseInt((x.price || '0').replace(/[^\d]/g, ''), 10) || 0;
      list = [...list].sort((a, b) => n(a) - n(b));
    }
    return list;
  }, [destinations, query, selectedRegions, selectedPrice, selectedCats, sortBy]);

  // NEW: clamp/reset page when filters/sort change
  useEffect(() => {
    setPage(1);
  }, [query, selectedRegions, selectedPrice, selectedCats, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, filtered.length);
  const pageItems = useMemo(() => filtered.slice(start, end), [filtered, start, end]);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  const Pager = () => (
    <div className="bp2-pager" style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', margin: '12px 0' }}>
      <div className="bp2-pager-info" style={{ color: '#475569', fontSize: 14 }}>
        {filtered.length ? `Showing ${start + 1}–${end} of ${filtered.length}` : 'No destinations found'}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="next-page-btn" onClick={() => setPage(1)} disabled={!canPrev} aria-label="First page">« First</button>
        <button className="next-page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!canPrev} aria-label="Previous page">‹ Prev</button>
        <span style={{ padding: '6px 10px', fontSize: 14 }}>{page} / {totalPages}</span>
        <button className="next-page-btn  " onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={!canNext} aria-label="Next page">Next ›</button>
        <button className="next-page-btn" onClick={() => setPage(totalPages)} disabled={!canNext} aria-label="Last page">Last »</button>
      </div>
    </div>
  );

  // Helpers
  const toggleSet = (setter, value) =>
    setter((prev) => {
      const n = new Set(prev);
      n.has(value) ? n.delete(value) : n.add(value);
      return n;
    });

  // 3) Toggle bookmark in Firestore for current user
  const toggleBookmark = async (dest) => {
    const user = auth.currentUser;
    if (!user) {
      alert('Please sign in to bookmark destinations.');
      return;
    }
    try {
      // A. Maintain your existing array of ids for bookmark.js
      const listRef = doc(db, 'userBookmarks', user.uid);
      const listSnap = await getDoc(listRef);
      if (!listSnap.exists()) {
        await setDoc(listRef, { bookmarks: [], createdAt: serverTimestamp() }, { merge: true });
      }

      // B. Also store a full copy under users/{uid}/bookmarks/{destId}
      const userDocRef = doc(db, 'users', user.uid);
      const bookmarkDocRef = doc(db, 'users', user.uid, 'bookmarks', dest.id);

      if (bookmarks.has(dest.id)) {
        // Unbookmark: remove id and delete the per-user bookmark doc
        await Promise.all([
          updateDoc(listRef, {
            bookmarks: arrayRemove(dest.id),
            updatedAt: serverTimestamp(),
          }),
          deleteDoc(bookmarkDocRef),
          setDoc(userDocRef, { updatedAt: serverTimestamp() }, { merge: true }),
        ]);
      } else {
        // Bookmark: add id and upsert the per-user bookmark doc with details
        await Promise.all([
          updateDoc(listRef, {
            bookmarks: arrayUnion(dest.id),
            updatedAt: serverTimestamp(),
          }),
          setDoc(
            userDocRef,
            { updatedAt: serverTimestamp() }, // ensure parent user doc exists
            { merge: true }
          ),
          setDoc(
            bookmarkDocRef,
            {
              destId: dest.id,
              name: dest.name,
              region: dest.region || '',
              rating: dest.rating ?? null,
              price: dest.price || '',
              priceTier: dest.priceTier || null,
              tags: dest.tags || [],
              categories: dest.categories || [],
              bestTime: dest.bestTime || '',
              image: dest.image || '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          ),
        ]);
      }
      // onSnapshot on userBookmarks will update local state automatically
    } catch (e) {
      console.error('Toggle bookmark failed:', e);
      alert('Could not update bookmark. Please try again.');
    }
  };

  // Average ratings loader for current page
  useEffect(() => {
    let cancelled = false;
    async function loadAverages() {
      try {
        const entries = await Promise.all(
          pageItems.map(async (d) => {
            const rsnap = await getDocs(collection(db, 'destinations', d.id, 'ratings'));
            let sum = 0;
            let count = 0;
            rsnap.forEach((r) => {
              const v = Number(r.data()?.value) || 0;
              if (v > 0) { sum += v; count += 1; }
            });
            const avg = count ? sum / count : 0;
            return [d.id, { avg, count }];
          })
        );
        if (!cancelled) setRatingsByDest((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      } catch (e) {
        console.error('Load averages failed', e);
      }
    }
    if (pageItems.length) loadAverages();
    return () => { cancelled = true; };
  }, [pageItems]);

  const avgText = (id) => {
    const r = ratingsByDest[id];
    return r && r.count > 0 ? r.avg.toFixed(1) : '—';
  };

  const openDetails = async (d) => {
    setSelected(d);
    setModalOpen(true);

    // Load user's rating for this destination
    try {
      const u = auth.currentUser;
      if (!u) { setUserRating(0); return; }
      const rref = doc(db, 'destinations', d.id, 'ratings', u.uid);
      const rsnap = await getDoc(rref);
      setUserRating(Number(rsnap.data()?.value || 0));
    } catch {
      setUserRating(0);
    }

    // Ensure we have averages for this selected item
    if (!ratingsByDest[d.id]) {
      try {
        const rsnap = await getDocs(collection(db, 'destinations', d.id, 'ratings'));
        let sum = 0, count = 0;
        rsnap.forEach((r) => {
          const v = Number(r.data()?.value) || 0;
          if (v > 0) { sum += v; count += 1; }
        });
        const avg = count ? sum / count : 0;
        setRatingsByDest((m) => ({ ...m, [d.id]: { avg, count } }));
      } catch (e) {
        console.error('Load selected avg failed', e);
      }
    }
  };

  const closeDetails = () => {
    setModalOpen(false);
    setSelected(null);
    setUserRating(0);
  };

// NEW: modal bookmark click with optimistic UI + rollback on error
  const handleModalBookmarkClick = async () => {
    const user = auth.currentUser;
    if (!user) { alert('Please sign in to bookmark destinations.'); return; }
    if (!selected) return;

    const id = selected.id;
    const wasBookmarked = bookmarks.has(id);

    // Optimistic UI
    setBookmarks((prev) => {
      const n = new Set(prev);
      wasBookmarked ? n.delete(id) : n.add(id);
      return n;
    });

    setBookmarking(true);
    try {
      await toggleBookmark(selected); // persists to Firestore
      // onSnapshot will keep state in sync afterward
    } catch (e) {
      // Rollback on failure
      setBookmarks((prev) => {
        const n = new Set(prev);
        wasBookmarked ? n.add(id) : n.delete(id);
        return n;
      });
      console.error('Bookmark toggle from modal failed:', e);
      alert('Could not update bookmark. Please try again.');
    } finally {
      setBookmarking(false);
    }
  };

  // NEW: save rating for current user and refresh average
  const rateSelected = async (value) => {
    const u = auth.currentUser;
    if (!u) { alert('Please sign in to rate.'); return; }
    if (!selected) return;
    const v = Math.max(1, Math.min(5, Number(value) || 0));
    setSavingRating(true);
    try {
      const ref = doc(db, 'destinations', String(selected.id), 'ratings', u.uid);
      await setDoc(ref, { value: v, userId: u.uid, updatedAt: serverTimestamp() }, { merge: true });
      setUserRating(v);

      // Recompute average
      const rsnap = await getDocs(collection(db, 'destinations', String(selected.id), 'ratings'));
      let sum = 0, count = 0;
      rsnap.forEach((r) => { const val = Number(r.data()?.value) || 0; if (val > 0) { sum += val; count += 1; } });
      const avg = count ? sum / count : 0;

      setRatingsByDest((m) => ({ ...m, [selected.id]: { avg, count } }));
      setDestinations((prev) => prev.map((x) => (x.id === selected.id ? { ...x, rating: avg } : x)));
    } catch (e) {
      console.error('Save rating failed:', e.code, e.message);
      alert('Failed to save rating.');
    } finally {
      setSavingRating(false);
    }
  };

  // Add to Trip handler (stub implementation)
  const addToTripFromBookmarks = async (dest) => {
    setAddingTripId(dest.id);
    try {
      // TODO: Implement actual logic to add destination to user's trip
      // For now, just simulate success
      await new Promise((resolve) => setTimeout(resolve, 800));
      setAddedTripId(dest.id);
      setTimeout(() => setAddedTripId(null), 1200);
    } catch (e) {
      alert('Failed to add to trip.');
    } finally {
      setAddingTripId(null);
    }
  };

  return (
    <div className="App">
      {isLoading && (
        <div className="bm2-loading-backdrop" role="status" aria-live="polite">
          <div className="lb-card">
            <div className="lb-scene">
              <svg className="lb-globe" viewBox="0 0 200 200" aria-hidden="true">
                <defs>
                  <radialGradient id="lbOcean" cx="50%" cy="45%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#e8f1ff" />
                  </radialGradient>
                  <linearGradient id="lbIsland" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#16a34a" />
                  </linearGradient>
                  <filter id="lbShadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(2,6,23,.25)" />
                  </filter>
                </defs>

                <circle cx="100" cy="100" r="92" fill="url(#lbOcean)" />
                <circle cx="100" cy="100" r="92" fill="none" stroke="#fff" strokeWidth="8" />
                <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(2,6,23,.06)" strokeWidth="1" />

                {/* Stylized PH islands (vector, no image) */}
                <g filter="url(#lbShadow)" fill="url(#lbIsland)">
                  <path d="M70 40 l18 -10 18 8 -6 22 -14 10 -16 -8 z" />
                  <path d="M92 63 l6 -6 8 2 5 6 -6 6 -9 -2 z" />
                  <path d="M102 82 l8 -6 10 2 6 10 -8 8 -12 -3 z" />
                  <circle cx="96" cy="96" r="3.2" />
                  <circle cx="108" cy="96" r="3.2" />
                  <circle cx="100" cy="108" r="3" />
                  <path d="M120 120 l20 -10 22 12 2 14 -10 12 -22 4 -12 -10 z" />
                </g>

                <g className="lb-sheen">
                  <path d="M12,128 C60,152 140,152 188,128" stroke="rgba(37,99,235,.18)" strokeWidth="12" fill="none" strokeLinecap="round" />
                </g>
              </svg>

              <div className="lb-orbit" />
              <div className="lb-plane" />
            </div>

            <h2 className="lb-title">Discover Philippines</h2>
            <p className="lb-sub">Loading destinations…</p>
            <div className="lb-progress"><span /></div>
          </div>
        </div>
      )}

      <div className="bp2-page-layout">
        {/* Filters */}
        <aside className="bp2-filters">
          <div className="bp2-filters-header">Filters</div>

          <div className="bp2-filter-group">
            <label className="bp2-label">Search Destinations</label>
            <input
              type="text"
              className="bp2-input"
              placeholder="Search by name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="bp2-filter-group">
            <div className="bp2-group-title">Region</div>
            <div className="bp2-checklist">
              {regions.map((r) => (
                <label key={r} className="bp2-check">
                  <input
                    type="checkbox"
                    checked={selectedRegions.has(r)}
                    onChange={() => toggleSet(setSelectedRegions, r)}
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="bp2-filter-group">
            <div className="bp2-group-title">Price Range</div>
            <label className="bp2-radio">
              <input
                type="radio"
                name="priceTier"
                checked={selectedPrice === 'less'}
                onChange={() => setSelectedPrice(selectedPrice === 'less' ? null : 'less')}
              />
              <span>Less Expensive (₱500–2,000)</span>
            </label>
            <label className="bp2-radio">
              <input
                type="radio"
                name="priceTier"
                checked={selectedPrice === 'expensive'}
                onChange={() =>
                  setSelectedPrice(selectedPrice === 'expensive' ? null : 'expensive')
                }
              />
              <span>Expensive (₱2,000+)</span>
            </label>
          </div>

          <div className="bp2-filter-group">
            <div className="bp2-group-title">Category</div>
            <div className="bp2-checklist">
              {categories.map((c) => (
                <label key={c} className="bp2-check">
                  <input
                    type="checkbox"
                    checked={selectedCats.has(c)}
                    onChange={() => toggleSet(setSelectedCats, c)}
                  />
                  <span>{c}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            className="bp2-clear-btn"
            onClick={() => {
              setQuery('');
              setSelectedRegions(new Set());
              setSelectedPrice(null);
              setSelectedCats(new Set());
              setSortBy('name');
            }}
          >
            Clear All Filters
          </button>
        </aside>

        {/* Main Content */}
        <main className="bp2-content">
          <div className="bp2-header-row">
            <h1 className="bp2-title">
              Discover Philippines <span className="bp2-count-link">({filtered.length} destinations)</span>
            </h1>
            <div className="bp2-sort">
              <label htmlFor="bp2-sort-select">Sort by</label>
              <select
                id="bp2-sort-select"
                className="bp2-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="name">Name</option>
                <option value="rating">Rating</option>
                <option value="price">Price</option>
              </select>
            </div>
          </div>

          {/* NEW: top pager */}
          <Pager />

          <div className="grid-container">
            {pageItems.map((d) => (
              <div className="grid-card" key={d.id}>
                <div className="card-image">
                  <div className="sun-decoration" />
                  <div className="wave-decoration" />
                  <button
                    className={`bookmark-bubble ${bookmarks.has(d.id) ? 'active' : ''}`}
                    onClick={() => toggleBookmark(d)}
                    aria-label="Toggle bookmark"
                    title="Bookmark"
                  >
                    {bookmarks.has(d.id) ? '❤️' : '🤍'}
                  </button>
                </div>

                <div className="card-header">
                  <h2>{d.name}</h2>
                  <div className="mini-rating" title="Average Rating">
                    <span>⭐</span> {avgText(d.id)}
                    </div>
                </div>

                <div className="bp2-region-line">{d.region}</div>
                <p className="description">{d.description}</p>

                <div className="tag-container">
                  {(d.tags || []).map((t, i) => (
                    <span key={i} className="tag">
                      {t}
                    </span>
                  ))}
                </div>

                <div className="card-footer">
                  <div className={`price-pill ${d.priceTier === 'less' ? 'pill-green' : 'pill-gray'}`}>
                    {d.priceTier === 'less' ? 'Less Expensive' : 'Expensive'}
                  </div>
                  <button className="details-btn" onClick={() => openDetails(d)}>
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* NEW: bottom pager */}
          <Pager />
        </main>
      </div>

      {/* Details Modal */}
      {modalOpen && selected && (
        <div
          className="modal-overlay active"
          onClick={(e) => e.target.classList.contains('modal-overlay') && closeDetails()}
        >
          <div className="modal-content details-modal">
            <button className="modal-close-floating" onClick={closeDetails} aria-label="Close">
              ✕
            </button>

            <div className="details-hero">
              <div className="details-hero-art">
                <div className="hero-water" />
                <div className="hero-sand" />
                <div className="hero-curve" />
              </div>
            </div>

            <div className="details-body">
              <div className="details-head-row">
                <div className="details-title-col">
                  <h2 className="details-title">{selected.name}</h2>
                  <a href="#" className="details-region" onClick={(e) => e.preventDefault()}>
                    {selected.region}
                  </a>

                  <div className="details-rating-row">
                    <span className="star">⭐</span>
                    <span className="avg">
                      {(ratingsByDest[selected.id]?.count ?? 0) > 0
                        ? (ratingsByDest[selected.id].avg).toFixed(1)
                        : '—'}
                    </span>
                    <span className="muted"> (Average Rating)</span>
                    <span className="muted sep">Your Rating:</span>
                    <div className="your-stars">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          className={`star-btn ${userRating >= n ? 'filled' : ''}`}
                          onClick={() => rateSelected(n)}
                          disabled={savingRating}
                          aria-label={`${n} star${n > 1 ? 's' : ''}`}
                          title={`${n} star${n > 1 ? 's' : ''}`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="details-actions">
                  <button
                    className={`btn-outline ${bookmarks.has(selected.id) ? 'active' : ''}`}
                    onClick={handleModalBookmarkClick}
                    disabled={bookmarking}
                    aria-pressed={bookmarks.has(selected.id)}
                    aria-label={bookmarks.has(selected.id) ? 'Remove bookmark' : 'Add bookmark'}
                  >
                    <span className="icon">{bookmarks.has(selected.id) ? '❤️' : '🤍'}</span>
                    {bookmarks.has(selected.id) ? 'Bookmarked' : 'Bookmark'}
                  </button>
                  <button
                    className={`btn-green ${addedTripId === selected.id ? 'btn-success' : ''}`}  // NEW: success style 
                    onClick={() => addToTripFromBookmarks(selected)}
                    disabled={addingTripId === selected.id}
                    aria-busy={addingTripId === selected.id}
                  >
                    <span className="icon">
                      {addedTripId === selected.id ? '✔' : '＋'}  {/* NEW: + -> ✔ */}
                    </span>
                    {addingTripId === selected.id
                      ? 'Adding…'
                      : addedTripId === selected.id
                      ? 'Added!'
                      : 'Add to Trip'}
                  </button>
                </div>
              </div>

              <div className="details-grid">
                <div className="details-left">
                  <div className="section-title">Description</div>
                  <p className="details-paragraph">{selected.description}</p>

                  <div className="section-title">Tags</div>
                  <div className="badge-row">
                    {(selected.tags || []).map((t, i) => (
                      <span key={i} className="badge">
                        {t}
                      </span>
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
                    <div className="trip-label">Price Range</div>
                    <span className="pill small pill-green">
                      {selected.priceTier === 'less' ? 'Less Expensive' : 'Expensive'}
                    </span>
                  </div>

                  <div className="trip-item">
                    <div className="trip-label">Best Time to Visit</div>
                    <div className="trip-text">{selected.bestTime}</div>
                  </div>

                  <div className="trip-item">
                    <div className="trip-label">Categories</div>
                    <div className="badge-row">
                      {(selected.categories || []).map((c, i) => (
                        <span key={i} className="badge purple">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
