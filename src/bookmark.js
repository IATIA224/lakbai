import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from './firebase';
import {
  doc, getDoc, setDoc, deleteDoc, collection, getDocs,
  orderBy, query as fsQuery, onSnapshot, addDoc, serverTimestamp,
  where, limit,
} from 'firebase/firestore';
import './Styles/bookmark.css';

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

  // clear pending confirm timer on unmount
  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
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
  }, []);

  // NEW: live count of itinerary items for current user
  useEffect(() => {
    if (!currentUser) { setInTripCount(0); return; }
    const colRef = collection(db, 'itinerary', currentUser.uid, 'items');
    const unsub = onSnapshot(colRef, (snap) => setInTripCount(snap.size));
    return () => unsub();
  }, [currentUser]);

  // Read ONLY current user's bookmarks collection and merge with destination data if needed
  const fetchBookmarkedDestinations = async (uid) => {
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
      console.error('Error fetching current user bookmarks:', e);
      setItems([]);
    }
  };

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

  // Remove bookmark from users/{uid}/bookmarks and keep legacy array in sync
  const removeBookmark = async (destinationId) => {
    try {
      if (!currentUser) {
        alert('Please login to manage bookmarks');
        return;
      }
      // Delete per-user bookmark doc
      await deleteDoc(doc(db, 'users', currentUser.uid, 'bookmarks', destinationId)).catch(() => {});

      // Keep legacy list in sync if present
      const legacyRef = doc(db, 'userBookmarks', currentUser.uid);
      const legacyDoc = await getDoc(legacyRef);
      if (legacyDoc.exists()) {
        const list = legacyDoc.data().bookmarks || [];
        const updated = list.filter((id) => id !== destinationId);
        await setDoc(legacyRef, { bookmarks: updated, updatedAt: new Date().toISOString() }, { merge: true });
      }

      setItems((prev) => prev.filter((d) => d.id !== destinationId));
    } catch (error) {
      console.error('Error removing bookmark:', error);
      alert('Failed to remove bookmark. Please try again.');
    }
  };

  const clearAllBookmarks = async () => {
    if (!currentUser) {
      alert('Please login to manage bookmarks');
      return;
    }
    if (!window.confirm('Clear all bookmarks?')) return;
    try {
      // Clear subcollection
      const colRef = collection(db, 'users', currentUser.uid, 'bookmarks');
      const snap = await getDocs(colRef);
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      // Clear legacy array
      await setDoc(
        doc(db, 'userBookmarks', currentUser.uid),
        { bookmarks: [], updatedAt: new Date().toISOString() },
        { merge: true }
      );
      setItems([]);
    } catch (e) {
      console.error(e);
      alert('Failed to clear bookmarks.');
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
  const clean = (obj) => {
    const out = {};
    Object.entries(obj || {}).forEach(([k, v]) => {
      if (v === undefined) return;              // Firestore rejects undefined
      if (Array.isArray(v)) out[k] = v.filter((x) => x !== undefined && x !== null && x !== '');
      else out[k] = v;
    });
    return out;
  };

  const onAddToTrip = async (dest) => {
    try {
      const u = auth.currentUser;
      if (!u) { alert('Please sign in to add to My Trips.'); return; }

      const destId = String(dest?.id || dest?.destId || '').trim();
      if (!destId) { alert('Invalid destination.'); return; }

      setAddingTripId(dest.id);

      // ensure parent user doc (some rulesets require the parent to exist)
      await setDoc(doc(db, 'users', u.uid), { uid: u.uid, lastTripAdd: serverTimestamp() }, { merge: true });

      const itemsCol = collection(db, 'itinerary', u.uid, 'items');

      // Check if this destination is already in My Trips
      const existsQ = fsQuery(itemsCol, where('destId', '==', destId), limit(1));
      const existsSnap = await getDocs(existsQ);

      if (existsSnap.empty) {
        // Prepare and add
        const payload = {
          destId,
          name: dest?.name || 'Untitled destination',
          region: dest?.region || dest?.locationRegion || '',
          categories: (dest?.categories || dest?.tags || []).filter(Boolean),
          rating: typeof dest?.rating === 'number' ? dest.rating : null,
          priceTier: dest?.priceTier ?? null,
          description: dest?.description || '',
          status: 'Upcoming',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await addDoc(itemsCol, payload);
      }
      // Remove from Bookmarks after being added or if it already exists in My Trips
      await removeBookmark(dest.id).catch(() => {});

      setAddedTripId(dest.id);
      setTimeout(() => setAddedTripId(null), 1200);
    } catch (e) {
      console.error('Add to trip failed:', e);
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
        console.error('Load selected avg failed', e);
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
      console.error('Save rating failed:', e);
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
      console.error('Remove bookmark failed:', e);
      setConfirmingUnbookmark(false);
      alert('Failed to remove bookmark. Please try again.');
    }
  };

  return (
    <div className="App">
      <div className="bookmark-section">
        <h2 className="bookmark-title">
          <span role="img" aria-label="pin">📌</span> My Bookmarks
        </h2>
        {bookmarkedDestinations.length > 0 ? (
          <div className="bookmarks-grid">
            {bookmarkedDestinations.map((destination) => (
              <div key={destination.id} className="bookmark-card">
                <img 
                  src={destination.image} 
                  alt={destination.name}
                  className="bookmark-image"
                />
                <div className="bookmark-content">
                  <h3>{destination.name}</h3>
                  <button 
                    className="heart-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBookmark(destination.id);
                    }}
                  >
                    ❤️
                  </button>
                  <p className="description">{destination.description}</p>
                  <div className="bookmark-details">
                    <span className="rating">⭐ {destination.rating}</span>
                    <span className="price">{destination.price}</span>
                  </div>
                  <div className="tag-container">
                    {destination.tags && destination.tags.map((tag, index) => (
                      <span key={index} className="tag">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bookmark-card empty-state">
            <div className="pin-icon">📍</div>
            <h3>No bookmarks yet</h3>
            <p>Start exploring destinations and bookmark your favorites!</p>
            <button className="explore-btn" onClick={handleExploreClick}>
              Explore Destinations
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Bookmark;
