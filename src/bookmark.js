import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  doc, getDoc, setDoc, serverTimestamp,
  deleteDoc, collection, getDocs,
  orderBy, query as fsQuery, onSnapshot
} from 'firebase/firestore';
import { db, auth } from './firebase';
import './Styles/bookmark.css';
import { unlockAchievement } from './profile';
import { addTripForCurrentUser } from './Itinerary';

function Bookmark() {
  const navigate = useNavigate();

  // Core state (soriano priority)
  const [items, setItems] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('recent');

  // Trip related
  const [addingTripId, setAddingTripId] = useState(null);
  const [addedTripId, setAddedTripId] = useState(null);
  const [inTripCount, setInTripCount] = useState(0);

  // Details / ratings
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [userRating, setUserRating] = useState(0);
  const [savingRating, setSavingRating] = useState(false);
  const [ratingsByDest, setRatingsByDest] = useState({});

  // Two‑step unbookmark confirm
  const [confirmingUnbookmark, setConfirmingUnbookmark] = useState(false);
  const confirmTimerRef = useRef(null);

  useEffect(() => () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
  }, []);

  // Auth + initial load
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

  // Live itinerary count
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

  // Fetch bookmarks (user subcollection first; merge fallback)
  const fetchBookmarkedDestinations = async (uid) => {
    try {
      const colRef = collection(db, 'users', uid, 'bookmarks');
      const snap = await getDocs(fsQuery(colRef, orderBy('createdAt', 'desc')));
      const rows = await Promise.all(
        snap.docs.map(async (b) => {
          const data = b.data() || {};
            if (data.name && data.description) {
              return {
                id: b.id,
                ...data,
                savedAt: toDateSafe(data.createdAt || data.updatedAt),
              };
            }
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
      console.error('Fetch bookmarks failed:', e);
      setItems([]);
    }
  };

  const toDateSafe = (ts) => {
    try {
      if (ts && typeof ts.toDate === 'function') return ts.toDate();
      if (typeof ts === 'string') return new Date(ts);
    } catch {}
    return null;
  };

  const handleExploreClick = () => navigate('/bookmarks2');

  // Remove one bookmark
  const removeBookmark = async (destinationId) => {
    try {
      if (!currentUser) { alert('Login first'); return; }
      // Delete modern doc
      await deleteDoc(doc(db, 'users', currentUser.uid, 'bookmarks', destinationId)).catch(() => {});
      // Update legacy aggregate doc
      const legacyRef = doc(db, 'userBookmarks', currentUser.uid);
      const legacyDoc = await getDoc(legacyRef);
      if (legacyDoc.exists()) {
        const list = legacyDoc.data().bookmarks || [];
        const updated = list.filter(id => id !== destinationId);
        await setDoc(
          legacyRef,
            { userId: currentUser.uid, bookmarks: updated, updatedAt: serverTimestamp() },
            { merge: true }
        );
      }
      setItems(prev => prev.filter(d => d.id !== destinationId));
    } catch (e) {
      console.error('Remove bookmark error:', e);
      alert('Failed to remove bookmark.');
    }
  };

  const clearAllBookmarks = async () => {
    if (!currentUser) { alert('Login first'); return; }
    if (!window.confirm('Clear all bookmarks?')) return;
    try {
      const colRef = collection(db, 'users', currentUser.uid, 'bookmarks');
      const snap = await getDocs(colRef);
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      await setDoc(
        doc(db, 'userBookmarks', currentUser.uid),
        { userId: currentUser.uid, bookmarks: [], updatedAt: serverTimestamp() },
        { merge: true }
      );
      setItems([]);
    } catch (e) {
      console.error(e);
      alert('Failed to clear bookmarks.');
    }
  };

  // Stats + sorting
  const stats = useMemo(() => {
    const total = items.length;
    const regions = new Set(items.map(d => d.region || d.locationRegion || '').filter(Boolean));
    const avg = total === 0 ? 0 : items.reduce((s, d) => s + (Number(d.rating) || 0), 0) / total;
    return { total, regions: regions.size, avgRating: Number(avg.toFixed(1)), inTrip: inTripCount };
  }, [items, inTripCount]);

  const sorted = useMemo(() => {
    const list = [...items];
    if (sortBy === 'name') return list.sort((a,b)=> (a.name||'').localeCompare(b.name||''));
    if (sortBy === 'rating') return list.sort((a,b)=> (Number(b.rating)||0) - (Number(a.rating)||0));
    // recent
    return list.sort((a,b)=>{
      const at = a.savedAt ? a.savedAt.getTime() : 0;
      const bt = b.savedAt ? b.savedAt.getTime() : 0;
      return bt - at;
    });
  }, [items, sortBy]);

  // Legacy compatibility (master used bookmarkedDestinations)
  const bookmarkedDestinations = sorted;

  const onAddToTrip = async (dest) => {
    const u = auth.currentUser;
    if (!u) { alert('Login to add to My Trips'); return; }
    setAddingTripId(dest.id);
    try {
      await addTripForCurrentUser(dest);
      setAddedTripId(dest.id);
      setTimeout(()=> setAddedTripId(null), 1200);
    } catch (e) {
      console.error('Add to trip failed:', e);
      alert('Failed to add.');
    } finally {
      setAddingTripId(null);
    }
  };

  const openDetails = async (dest) => {
    setSelected(dest);
    setModalOpen(true);
    try {
      const u = auth.currentUser;
      if (!u) { setUserRating(0); return; }
      const rref = doc(db, 'destinations', dest.id, 'ratings', u.uid);
      const rsnap = await getDoc(rref);
      setUserRating(Number(rsnap.data()?.value || 0));
    } catch { setUserRating(0); }

    if (!ratingsByDest[dest.id]) {
      try {
        const rsnap = await getDocs(collection(db, 'destinations', dest.id, 'ratings'));
        let sum=0,count=0;
        rsnap.forEach(r=>{
          const v = Number(r.data()?.value)||0;
          if (v>0){ sum+=v; count++; }
        });
        setRatingsByDest(m=>({...m,[dest.id]:{avg: count? sum/count:0, count}}));
      } catch(e){ console.error(e); }
    }
  };

  const closeDetails = () => {
    setModalOpen(false);
    setSelected(null);
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
      await setDoc(
        doc(db, 'destinations', String(selected.id), 'ratings', u.uid),
        { value: v, userId: u.uid, updatedAt: serverTimestamp() },
        { merge: true }
      );
      await setDoc(
        doc(db, 'users', u.uid, 'ratings', String(selected.id)),
        { value: v, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setUserRating(v);
      const rsnap = await getDocs(collection(db, 'destinations', String(selected.id), 'ratings'));
      let sum=0,count=0;
      rsnap.forEach(r=>{
        const val = Number(r.data()?.value)||0;
        if (val>0){ sum+=val; count++; }
      });
      setRatingsByDest(m=>({...m,[selected.id]:{avg: count? sum/count:0, count}}));
    } catch(e){
      console.error('Save rating failed', e);
      alert('Failed to save rating.');
    } finally {
      setSavingRating(false);
    }
  };

  const handleBookmarkedClick = async () => {
    if (!currentUser || !selected) return;
    if (!confirmingUnbookmark) {
      setConfirmingUnbookmark(true);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(()=> setConfirmingUnbookmark(false), 2500);
      return;
    }
    try {
      await removeBookmark(selected.id);
      setConfirmingUnbookmark(false);
      closeDetails();
    } catch(e){
      console.error('Remove failed', e);
      setConfirmingUnbookmark(false);
      alert('Failed to remove.');
    }
  };

  // Toggle bookmark (adds if missing, removes if present)
  const toggleBookmark = async (destinationId) => {
    try {
      if (!currentUser) { alert('Login first'); return; }
      const userRef = doc(db, 'userBookmarks', currentUser.uid);
      const snap = await getDoc(userRef);
      const list = new Set(snap.exists() ? (snap.data().bookmarks || []) : []);
      const isFirstBookmark = list.size === 0;
      if (list.has(destinationId)) {
        // remove
        list.delete(destinationId);
        await deleteDoc(doc(db, 'users', currentUser.uid, 'bookmarks', destinationId)).catch(()=>{});
      } else {
        // add (minimal doc)
        list.add(destinationId);
        await setDoc(
          doc(db, 'users', currentUser.uid, 'bookmarks', destinationId),
          { createdAt: serverTimestamp(), name: selected?.name || '', description: selected?.description || '' },
          { merge: true }
        );
        if (isFirstBookmark) {
          await unlockAchievement(2, "First Bookmark");
        }
      }
      await setDoc(
        userRef,
        { userId: currentUser.uid, bookmarks: Array.from(list), updatedAt: serverTimestamp() },
        { merge: true }
      );
      // Refresh list
      await fetchBookmarkedDestinations(currentUser.uid);
    } catch(e){
      console.error('Toggle bookmark error:', e);
    }
  };

  return (
    <div className="App">
      <div className="bookmark-section">
        <h2 className="bookmark-title">
          <span role="img" aria-label="pin">📌</span> My Bookmarks
        </h2>

        {/* Controls */}
        <div className="bm-toolbar">
          <div className="bm-left">
            <select value={sortBy} onChange={e=> setSortBy(e.target.value)}>
              <option value="recent">Recent</option>
              <option value="name">Name</option>
              <option value="rating">Rating</option>
            </select>
          </div>
          <div className="bm-right">
            {items.length > 0 && (
              <button className="bm-clear" onClick={clearAllBookmarks}>Clear All</button>
            )}
            <button onClick={handleExploreClick}>Explore Destinations</button>
          </div>
        </div>

        {bookmarkedDestinations.length > 0 ? (
          <div className="bookmarks-grid">
            {bookmarkedDestinations.map(destination => (
              <div
                key={destination.id}
                className="bookmark-card"
                onClick={()=> openDetails(destination)}
              >
                {destination.image && (
                  <img
                    src={destination.image}
                    alt={destination.name}
                    className="bookmark-image"
                  />
                )}
                <div className="bookmark-content">
                  <h3>{destination.name || 'Untitled'}</h3>
                  <button
                    className="heart-btn"
                    title="Remove bookmark"
                    onClick={(e)=>{
                      e.stopPropagation();
                      removeBookmark(destination.id);
                    }}
                  >
                    ❤️
                  </button>
                  {destination.description && (
                    <p className="description">{destination.description}</p>
                  )}
                  <div className="bookmark-details">
                    <span className="rating">⭐ {destination.rating || ratingsByDest[destination.id]?.avg?.toFixed?.(1) || '—'}</span>
                    {destination.price && <span className="price">{destination.price}</span>}
                  </div>
                  {destination.tags && destination.tags.length > 0 && (
                    <div className="tag-container">
                      {destination.tags.map((tag,i)=>(
                        <span key={i} className="tag">{tag}</span>
                      ))}
                    </div>
                  )}
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
