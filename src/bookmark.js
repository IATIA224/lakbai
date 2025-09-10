import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import {
  deleteDoc, collection, getDocs,
  orderBy, query as fsQuery, onSnapshot // removed: addDoc, where, limit
} from 'firebase/firestore';
import './Styles/bookmark.css';
import { unlockAchievement } from './profile';
import { addTripForCurrentUser } from './Itinerary';

function Bookmark() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('recent');

  // Add-to-Trip state
  const [addingTripId, setAddingTripId] = useState(null);
  const [addedTripId, setAddedTripId] = useState(null);
  const [inTripCount, setInTripCount] = useState(0);

  // NEW: details modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [userRating, setUserRating] = useState(0);
  const [savingRating, setSavingRating] = useState(false);

  // NEW: average ratings loaded from destinations/{id}/ratings
  const [ratingsByDest, setRatingsByDest] = useState({});

  // Confirm “unbookmark”
  const [confirmingUnbookmark, setConfirmingUnbookmark] = useState(false);
  const confirmTimerRef = useRef(null);

  // NEW: UI confirm modal for "Clear All"
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // NEW: app-themed error toast state
  const [errorMsg, setErrorMsg] = useState('');
  const errorTimerRef = useRef(null);
  const showError = (msg) => {
    setErrorMsg(String(msg || 'Something went wrong.'));
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorMsg(''), 4000);
  };

  // clear pending confirm timer on unmount
  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current); // NEW: clear toast timer
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsub = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user || null);
      if (user) {
        await fetchBookmarkedDestinations(user.uid);
      } else {
        setItems([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [fetchBookmarkedDestinations]);

  // NEW: live count of itinerary items for current user
  useEffect(() => {
    if (!currentUser) { setInTripCount(0); return; }
    const colRef = collection(db, 'itinerary', currentUser.uid, 'items');
    const unsub = onSnapshot(
      colRef,
      (snap) => setInTripCount(snap.size),
      () => setInTripCount(0)
    );
    return () => unsub();
  }, [currentUser]);

  // Read ONLY current user's bookmarks collection and merge with destination data if needed
  const fetchBookmarkedDestinations = useCallback(async (uid) => {
    try {
      const colRef = collection(db, 'users', uid, 'bookmarks');
      const snap = await getDocs(fsQuery(colRef, orderBy('createdAt', 'desc')));
      const rows = await Promise.all(
        snap.docs.map(async (b) => {
          const data = b.data() || {};
          // Prefer data stored on the bookmark doc
          if (data.name && data.description) {
            return {
              id: b.id,
              ...data,
              savedAt: toDateSafe(data.createdAt || data.updatedAt),
            };
          }
          // Fallback: merge with source destination doc
          const dref = doc(db, 'destinations', b.id);
          const ddoc = await getDoc(dref);
          return {
            id: b.id,
            ...(ddoc.exists() ? ddoc.data() : {}),
            ...data,
            savedAt: toDateSafe(data.createdAt || data.updatedAt),
          };
        })
      );
      setItems(rows.filter(Boolean));
    } catch (e) {
      // console.error('Error fetching current user bookmarks:', e);
      showError('Failed to load your bookmarks.');
      setItems([]);
    }
  }, []); // no dependencies needed

  const toDateSafe = (ts) => {
    try {
      // Firestore Timestamp -> Date
      if (ts && typeof ts.toDate === 'function') return ts.toDate();
      // ISO string
      if (typeof ts === 'string') return new Date(ts);
    } catch {}
    return null;
  };

  const handleExploreClick = () => navigate('/bookmarks2'); // ensure this exists

  // Remove bookmark (include userId to satisfy your rules)
  const removeBookmark = async (destinationId) => {
    try {
      if (!currentUser) { alert('Please login to manage bookmarks'); return; }
      await deleteDoc(doc(db, 'users', currentUser.uid, 'bookmarks', destinationId)).catch(() => {});
      const legacyRef = doc(db, 'userBookmarks', currentUser.uid);
      const legacyDoc = await getDoc(legacyRef);
      if (legacyDoc.exists()) {
        const list = legacyDoc.data().bookmarks || [];
        const updated = list.filter((id) => id !== destinationId);
        await setDoc(
          legacyRef,
          { userId: currentUser.uid, bookmarks: updated, updatedAt: serverTimestamp() },
          { merge: true }
        );
      }
      setItems((prev) => prev.filter((d) => d.id !== destinationId));
    } catch (error) {
      // console.error('Error removing bookmark:', error);
      showError('Failed to remove bookmark.');
      alert('Failed to remove bookmark. Please try again.'); // keep existing UX
    }
  };

  // Change Clear All to open modal instead of window.confirm
  const clearAllBookmarks = async () => {
    if (!currentUser) { alert('Please login to manage bookmarks'); return; }
    setConfirmClearOpen(true);
  };

  // NEW: run actual clear when user confirms in the modal
  const handleConfirmClear = async () => {
    if (!currentUser) { setConfirmClearOpen(false); alert('Please login to manage bookmarks'); return; }
    setIsClearingAll(true);
    try {
      const colRef = collection(db, 'users', currentUser.uid, 'bookmarks');
      const snap = await getDocs(colRef);
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      await setDoc(
        doc(db, 'userBookmarks', currentUser.uid),
        { userId: currentUser.uid, bookmarks: [], updatedAt: serverTimestamp() },
        { merge: true }
      );
      setItems([]);
      setConfirmClearOpen(false);
    } catch (e) {
      // console.error(e);
      showError('Failed to clear bookmarks.');
      alert('Failed to clear bookmarks.');
    } finally {
      setIsClearingAll(false);
    }
  };

  // Derived stats
  const stats = useMemo(() => {
    const total = items.length;
    const regions = new Set(items.map((d) => d.region || d.locationRegion || '').filter(Boolean));
    const avg = total === 0 ? 0 : items.reduce((s, d) => s + (Number(d.rating) || 0), 0) / total;
    return { total, regions: regions.size, avgRating: Number(avg.toFixed(1)), inTrip: inTripCount }; // <- use live count
  }, [items, inTripCount]);

  // Sorting
  const sorted = useMemo(() => {
    const list = [...items];
    if (sortBy === 'name') return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (sortBy === 'rating') return list.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    // recent: sort by savedAt desc
    return list.sort((a, b) => {
      const at = a.savedAt ? a.savedAt.getTime() : 0;
      const bt = b.savedAt ? b.savedAt.getTime() : 0;
      return bt - at;
    });
  }, [items, sortBy]);

  const fmtSaved = (d) => {
    if (!d) return 'Unknown';
    const mm = d.getMonth() + 1;
    const dd = d.getDate();
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };

  // sanitize object before Firestore write

  // Add to Trip — write via Itinerary helper to itinerary/{uid}/items
  const onAddToTrip = async (dest) => {
    const u = auth.currentUser;
    if (!u) { alert('Please sign in to add to My Trips.'); return; }
    setAddingTripId(dest.id);
    try {
      await addTripForCurrentUser(dest);
      setAddedTripId(dest.id);
      setTimeout(() => setAddedTripId(null), 1200);
    } catch (e) {
      // console.error('Add to trip failed:', e?.code || e?.message, e);
      showError('Failed to add to My Trips.');
      alert('Failed to add to My Trips.');
    } finally {
      setAddingTripId(null);
    }
  };

  const openDetails = async (dest) => {
    setSelected(dest);
    setModalOpen(true);

    // Load user's rating for this destination from destinations/{id}/ratings/{uid}
    try {
      const u = auth.currentUser;
      if (!u) { setUserRating(0); return; }
      const rref = doc(db, 'destinations', dest.id, 'ratings', u.uid);
      const rsnap = await getDoc(rref);
      setUserRating(Number(rsnap.data()?.value || 0));
    } catch {
      setUserRating(0);
    }

    // Ensure we have average for the selected item
    if (!ratingsByDest[dest.id]) {
      try {
        const rsnap = await getDocs(collection(db, 'destinations', dest.id, 'ratings'));
        let sum = 0, count = 0;
        rsnap.forEach((r) => {
          const v = Number(r.data()?.value) || 0;
          if (v > 0) { sum += v; count += 1; }
        });
        const avg = count ? sum / count : 0;
        setRatingsByDest((m) => ({ ...m, [dest.id]: { avg, count } }));
      } catch (e) {
        // console.error('Load selected avg failed', e);
        showError('Failed to load ratings.');
      }
    }
  };

  const closeDetails = () => {
    setModalOpen(false);
    setSelected(null);
    // reset confirm state when modal closes
    setConfirmingUnbookmark(false);
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
  };

  const saveRating = async (value) => {
    const u = auth.currentUser;
    if (!u || !selected) return;
    setSavingRating(true);
    try {
      const v = Math.max(1, Math.min(5, Number(value) || 0));

      // Save under the destination's ratings subcollection (canonical for averages)
      await setDoc(
        doc(db, 'destinations', String(selected.id), 'ratings', u.uid),
        { value: v, userId: u.uid, updatedAt: serverTimestamp() },
        { merge: true }
      );

      // Optional: also keep a user copy (not used for averages)
      await setDoc(
        doc(db, 'users', u.uid, 'ratings', String(selected.id)),
        { value: v, updatedAt: serverTimestamp() },
        { merge: true }
      );

      setUserRating(v);

      // Recompute and update the average for this destination
      const rsnap = await getDocs(collection(db, 'destinations', String(selected.id), 'ratings'));
      let sum = 0, count = 0;
      rsnap.forEach((r) => {
        const val = Number(r.data()?.value) || 0;
        if (val > 0) { sum += val; count += 1; }
      });
      const avg = count ? sum / count : 0;

      setRatingsByDest((m) => ({ ...m, [selected.id]: { avg, count } }));
    } catch (e) {
      // console.error('Save rating failed:', e);
      showError('Failed to save rating.');
      alert('Failed to save rating.');
    } finally {
      setSavingRating(false);
    }
  };

  // Two-step confirm remove for Bookmarked button
  const handleBookmarkedClick = async () => {
    if (!currentUser) { alert('Please login to manage bookmarks'); return; }
    if (!selected) return;
    if (!confirmingUnbookmark) {
      setConfirmingUnbookmark(true);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmingUnbookmark(false), 2500);
      return;
    }
    try {
      await removeBookmark(selected.id);
      setConfirmingUnbookmark(false);
      closeDetails();
    } catch (e) {
      // console.error('Remove bookmark failed:', e);
      showError('Failed to remove bookmark.');
      setConfirmingUnbookmark(false);
      alert('Failed to remove bookmark. Please try again.');
    }
  };

  // Add bookmark or toggle bookmark status

  // NEW: transient pop animation state per card
  const [popIds, setPopIds] = useState({});
  const triggerCardPop = (id, duration = 180) => {
    setPopIds((m) => ({ ...m, [id]: true }));
    setTimeout(() => {
      setPopIds((m) => {
        const n = { ...m };
        delete n[id];
        return n;
      });
    }, duration);
  };

  // NEW: track cards being removed while waiting for server
  const [removingIds, setRemovingIds] = useState({});
  const beginRemove = (id) => setRemovingIds((m) => ({ ...m, [id]: true }));
  const endRemove = (id) =>
    setRemovingIds((m) => {
      const n = { ...m };
      delete n[id];
      return n;
    });

  return (
    <div className="App bm-page" aria-busy={loading}>
      {loading && (
        <div className="bm-loading-backdrop">
          <div className="bm-loading-container">
            <div className="bm-loading-icon-wrapper">
              <svg className="bm-pushpin-svg" viewBox="0 0 100 100" aria-hidden="true">
                <defs>
                  <radialGradient id="pinHeadGradient" cx="0.3" cy="0.3" r="0.7">
                    <stop offset="0%" stopColor="#ff8a8a" />
                    <stop offset="100%" stopColor="#e52e2e" />
                  </radialGradient>
                  <linearGradient id="pinNeedleGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#d1d5db" />
                    <stop offset="50%" stopColor="#9ca3af" />
                    <stop offset="100%" stopColor="#d1d5db" />
                  </linearGradient>
                </defs>
                <g className="bm-pushpin-group">
                  <path fill="url(#pinNeedleGradient)" d="M48 45 L48 85 L52 85 L52 45 Z" />
                  <path fill="#e52e2e" d="M40 20 C25 20 25 45 40 45 L60 45 C75 45 75 20 60 20 Z" />
                  <path fill="url(#pinHeadGradient)" d="M40 20 C25 20 25 45 40 45 L60 45 C75 45 75 20 60 20 Z" />
                  <path fill="rgba(255,255,255,0.3)" d="M42 25 C35 25 35 35 42 35 L58 35 C65 35 65 25 58 25 Z" />
                </g>
              </svg>
              <div className="bm-icon-shadow"></div>
            </div>
            <div className="bm-loading-text">
              Loading Bookmarks
              <span className="bm-loading-dots">...</span>
            </div>
            <div className="bm-loading-bar">
              <div className="bm-loading-progress"></div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bm-header">
        <div className="bm-title-wrap">
          <div className="bm-title-icon">❤️</div>
          <div>
            <h1 className="bm-title">Bookmarks</h1>
            <p className="bm-subtitle">Your saved destinations with quick previews and actions</p>
          </div>
        </div>

        <div className="bm-controls">
          <select className="bm-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="recent">Recently Added</option>
            <option value="name">Name</option>
            <option value="rating">Rating</option>
          </select>
          <button className="bm-clear-btn" onClick={clearAllBookmarks}>
            <span className="bm-clear-icon">🗑️</span>
            Clear All
          </button>
        </div>
      </header>

      {/* Stats */}
      <section className="bm-stats">
        <article className="bm-stat-card">
          <div className="bm-stat-icon heart">❤️</div>
          <div>
            <div className="bm-stat-label">Total Bookmarks</div>
            <div className="bm-stat-value">{stats.total}</div>
          </div>
        </article>
        <article className="bm-stat-card">
          <div className="bm-stat-icon pin">📍</div>
          <div>
            <div className="bm-stat-label">Regions Covered</div>
            <div className="bm-stat-value">{stats.regions}</div>
          </div>
        </article>
        <article className="bm-stat-card">
          <div className="bm-stat-icon star">⭐</div>
          <div>
            <div className="bm-stat-label">Avg Rating</div>
            <div className="bm-stat-value">{stats.avgRating.toFixed(1)}</div>
          </div>
        </article>
        <article className="bm-stat-card">
          <div className="bm-stat-icon route">🔗</div>
          <div>
            <div className="bm-stat-label">In Trip Plan</div>
            <div className="bm-stat-value">{stats.inTrip}</div>
          </div>
        </article>
      </section>

      {/* Grid */}
      {sorted.length === 0 ? (
        <section className="bm-empty" style={{ backdropFilter: 'blur(10px)', background: 'rgba(255, 255, 255, 0.6)', borderRadius: '12px', padding: '16px' }}>
          <div className="bm-empty-heart">
            <span>❤️</span>
          </div>
          <h2 className="bm-empty-title">No bookmarks yet</h2>
          <p className="bm-empty-text">
            Start exploring amazing Philippine destinations and bookmark your favorites to see them here with detailed previews!
          </p>
          <button className="bm-primary" onClick={handleExploreClick}>
            <span className="bm-primary-icon">🔎</span>
            Start Exploring
          </button>
        </section>
      ) : (
        <div className="bookmarks-grid">
          {sorted.map((d) => (
            <article
              key={d.id}
              className={`bm-card ${popIds[d.id] ? 'pop-anim' : ''} ${removingIds[d.id] ? 'removing' : ''}`}
            >
              {/* Top art */}
              <div className="bm-card-hero">
                <div className="sun-decoration" />
                <div className="wave-decoration" />
                <div className="bm-saved-badge">Saved {fmtSaved(d.savedAt)}</div>
                <button
                  className="bm-heart-bubble"
                  onClick={async (e) => {
                    e.stopPropagation();
                    triggerCardPop(d.id);          // quick bump
                    beginRemove(d.id);             // start pulse until server finishes
                    try {
                      await removeBookmark(d.id);  // wait for server
                    } finally {
                      endRemove(d.id);            // stop pulse (card may already unmount)
                    }
                  }}
                  aria-label="Remove from bookmarks"
                  title="Remove"
                >
                  ❤️
                </button>
              </div>

              {/* Content */}
              <div className="bm-card-body">
                <div className="bm-card-head">
                  <h3 className="bm-card-title">{d.name}</h3>
                  <div className="bm-card-rating" title="Average Rating">
                    <span>⭐</span> {ratingsByDest[d.id]?.avg?.toFixed(1) || '—'}
                  </div>
                </div>

                <a className="bm-region-link" onClick={(e) => e.preventDefault()} title="Region">
                  {d.region || d.locationRegion}
                </a>

                <p className="bm-card-desc">{d.description}</p>

                <div className="bm-info-box">
                  <div className="bm-info-item">
                    <div className="bm-info-label">Best Time:</div>
                    <div className="bm-pill">{d.bestTime || d.best_time || '—'}</div>
                  </div>
                  <div className="bm-info-item">
                    <div className="bm-info-label1">Price:</div>
                    <div className="bm-pill">{d.price ?? '—'}</div>
                  </div>
                </div>

                <div className="bm-tags">
                  {(d.tags || d.categories || []).slice(0, 8).map((t, i) => (
                    <span key={i} className="bm-tag">{t}</span>
                  ))}
                </div>

                <div className="bm-actions">
                  <button className="itn-btn primary" onClick={() => openDetails(d)}>
                    <span>🔎</span> View Details
                  </button>
                  <button
                    className={`itn-btn success ${addedTripId === d.id ? 'btn-success' : ''}`}
                    onClick={async () => {
                      setAddingTripId(d.id);
                      try {
                        await addTripForCurrentUser(d);
                        setAddedTripId(d.id);
                        // Wait for the confirmation state to show (same as before)
                        setTimeout(async () => {
                          setAddedTripId(null);
                          // Remove from bookmarks after confirmation
                          triggerCardPop(d.id);       // pop effect
                          beginRemove(d.id);          // start pulse
                          try {
                            await removeBookmark(d.id);
                          } finally {
                            endRemove(d.id);
                          }
                        }, 1200); // matches your confirmation duration
                      } catch (e) {
                        showError('Failed to add to My Trips.');
                        alert('Failed to add to My Trips.');
                      } finally {
                        setAddingTripId(null);
                      }
                    }}
                    disabled={addingTripId === d.id}
                    aria-busy={addingTripId === d.id}
                  >
                    {addedTripId === d.id ? (
                      <>
                        <span>✔</span> Added to Trip
                      </>
                    ) : (
                      <>Add to Trip</>
                    )}
                  </button>
                  <button
                    className="itn-btn danger"
                    onClick={async () => {
                      triggerCardPop(d.id);       // quick bump
                      beginRemove(d.id);          // start pulse
                      try {
                        await removeBookmark(d.id);
                      } finally {
                        endRemove(d.id);
                      }
                    }}
                    disabled={removingIds[d.id] === true}
                    aria-busy={removingIds[d.id] === true}
                  >
                    <span>🗑️</span> Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* NEW: Details modal */}
      {modalOpen && selected && (
        <div className="bm-modal-backdrop" onClick={closeDetails}>
          <div className="bm-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="bm-modal-close" onClick={closeDetails} aria-label="Close details">✕</button>

            <div className="bm-modal-hero">
              <div className="bm-modal-sky" />
              <div className="bm-modal-wave" />
            </div>

            <div className="bm-modal-body">
              <div className="bm-modal-main">
                <h2 className="bm-modal-title">{selected.name}</h2>

                <a className="bm-modal-region" onClick={(e) => e.preventDefault()}>
                  {selected.region || selected.locationRegion}
                </a>

                <div className="bm-modal-ratings">
                  <div className="bm-avg-rating">
                    <span className="star">⭐</span>
                    {(ratingsByDest[selected.id]?.count ?? 0) > 0
                      ? ratingsByDest[selected.id].avg.toFixed(1)
                      : '—'} <span className="muted">(Average Rating)</span>
                  </div>
                  <div className="bm-user-rating">
                    <span className="label">Your Rating:</span>
                    <div className="bm-stars" aria-label="Your Rating">
                      {[1,2,3,4,5].map((v) => (
                        <button
                          key={v}
                          className={`bm-star ${userRating >= v ? 'filled' : ''}`}
                          onClick={() => saveRating(v)}
                          disabled={savingRating}
                          title={`${v} star${v>1?'s':''}`}
                        >★</button>
                      ))}
                    </div>
                  </div>
                </div>

                <section>
                  <h3 className="bm-section-title">Description</h3>
                  <p className="bm-modal-desc">{selected.description}</p>
                </section>

                <section>
                  <h3 className="bm-section-title">Tags</h3>
                  <div className="bm-tags">
                    {(selected.tags || selected.categories || []).map((t, i) => (
                      <span key={i} className="bm-chip">{t}</span>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="bm-section-title">Packing Suggestions</h3>
                  <div className="bm-pack-card">
                    {selected.packing || 'Swimwear, sunscreen, light clothing, waterproof bag, snorkeling gear'}
                  </div>
                </section>
              </div>

              <aside className="bm-modal-aside">
                <div className="bm-info-panel">
                  <h3 className="bm-info-title">Trip Information</h3>

                  <div className="bm-info-row">
                    <div className="bm-info-key">Price:</div>
                    <div className="bm-info-val">
                      <span className="chip-green">{selected.price ?? '—'}</span>
                    </div>
                  </div>

                  <div className="bm-info-row">
                    <div className="bm-info-key">Best Time to Visit:</div>
                    <div className="bm-info-val">{selected.bestTime || selected.best_time || '—'}</div>
                  </div>

                  <div className="bm-info-row">
                    <div className="bm-info-key">Categories:</div>
                    <div className="bm-info-val">
                      {(selected.categories || selected.tags || []).map((c, i) => (
                        <span key={i} className="bm-chip soft">{c}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bm-modal-actions">
                  <button
                    className={`bm-bookmarked ${confirmingUnbookmark ? 'confirm' : ''}`}
                    onClick={handleBookmarkedClick}
                    aria-pressed="true"
                    title={confirmingUnbookmark ? 'Click again to remove' : 'Bookmarked'}
                  >
                    <span className="bm-heart">💗</span>
                    {confirmingUnbookmark ? 'Click again to remove' : 'Bookmarked'}
                  </button>
                  <button
                    className={`itn-btn success ${addedTripId === selected.id ? 'btn-success' : ''}`}
                    onClick={() => onAddToTrip(selected)}
                    disabled={addingTripId === selected.id}
                    aria-busy={addingTripId === selected.id}
                  >
                    <span>{addedTripId === selected.id ? '✔' : '+'}</span>
                    {addingTripId === selected.id ? ' Adding…' : addedTripId === selected.id ? ' Added!' : ' Add to Trip'}
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Confirm Clear All modal (matches existing modal theme) */}
      {confirmClearOpen && (
        <div className="bm-modal-backdrop" onClick={() => setConfirmClearOpen(false)}>
          <div
            className="bm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-all-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 560,
              background: '#ffffff' // removed glass effect
            }}
          >
            <button className="bm-modal-close" onClick={() => setConfirmClearOpen(false)} aria-label="Close">✕</button>
            <div
              className="bm-modal-body"
              // make it a vertical stack: title -> text -> actions
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <h2
                id="clear-all-title"
                className="bm-modal-title"
                style={{ fontSize: '1.25rem', margin: '0 0 4px', lineHeight: 1.2 }}
              >
                Clear all bookmarks?
              </h2>

              <p className="bm-modal-desc" style={{ margin: 0 }}>
                This will remove all saved destinations from your bookmarks. You can add them again later from Explore.
              </p>

              <div className="bm-modal-actions" style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button className="itn-btn" onClick={() => setConfirmClearOpen(false)} disabled={isClearingAll}>
                  Cancel
                </button>
                <button
                  className="itn-btn danger"
                  onClick={handleConfirmClear}
                  disabled={isClearingAll}
                  aria-busy={isClearingAll}
                >
                  {isClearingAll ? 'Clearing…' : 'Clear All'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW: themed error toast (click to dismiss) */}
      {errorMsg && (
        <div
          role="alert"
          className="bm-toast bm-toast-error"
          onClick={() => setErrorMsg('')}
          style={{
            position: 'fixed',
            right: 16,
            bottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 14px',
            borderRadius: 12,
            // glass effect for toast
            background: 'rgba(255, 255, 255, 1)',

            color: '#1f2937',
            border: '1px solid rgba(255,255,255,0.35)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
            zIndex: 1000,
            cursor: 'pointer',
            fontWeight: 500
          }}
          title="Dismiss"
        >
          <span aria-hidden="true">⚠️</span>
          <span>Error:</span>
          <span style={{ opacity: 0.95 }}>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}

export default Bookmark;
