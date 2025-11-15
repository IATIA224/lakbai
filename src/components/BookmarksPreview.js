import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useBookmarks } from '../hooks/useBookmarks';
import { addTripForCurrentUser } from '../Itinerary'; // <-- import this
import { trackDestinationAdded } from '../itinerary_Stats'; // <-- import this
import { createPortal } from 'react-dom';

// Helper to get image URL by destination name from a local JSON
import destImages from '../dest-images.json';
function getImageForDestination(name) {
  if (!name) return undefined;
  const found = destImages.find(img => img.name.trim().toLowerCase() === name.trim().toLowerCase());
  return found ? found.url : undefined;
}

function BookmarksPreview({ onOpenDetails }) {
  const { bookmarks, loading: bookmarksLoading, setBookmarks } = useBookmarks();
  const navigate = useNavigate();

  const bookmarksContainerRef = useRef(null);
  const actionsRef = useRef(null);
  const anchorRef = useRef(null);
  const [openActionsId, setOpenActionsId] = useState(null);
  const [actionsPos, setActionsPos] = useState({ top: 0, left: 0 });
  const [portalPos, setPortalPos] = useState({ top: 0, left: 0 });

  const computeAndSetPos = (anchorEl) => {
    if (!anchorEl) return;
    const anchorRect = anchorEl.getBoundingClientRect();
    const margin = 4;
    setPortalPos({
      top: anchorRect.bottom + window.scrollY + margin,
      left: anchorRect.left + window.scrollX
    });
  };

  const toggleBookmarkActions = (e, id) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    if (openActionsId === id) {
      setOpenActionsId(null);
      anchorRef.current = null;
    } else {
      anchorRef.current = btn;
      computeAndSetPos(btn);
      setOpenActionsId(id);
    }
  };

  useEffect(() => {
    const handleDocClick = (ev) => {
      if (actionsRef.current && !actionsRef.current.contains(ev.target) && anchorRef.current && !anchorRef.current.contains(ev.target)) {
        setOpenActionsId(null);
        anchorRef.current = null;
      }
    };
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

  const addBookmarkToTrip = async (bm) => {
    const u = auth.currentUser;
    if (!u) { alert('Please sign in to add to My Trips.'); return; }
    // Prepare the destination object (copy from Bookmark.js)
    const destinationData = {
      id: bm.id,
      name: bm.name || '',
      display_name: bm.name || '',
      region: bm.region || bm.locationRegion || '',
      location: bm.location || '',
      description: bm.description || '',
      lat: bm.lat || bm.latitude,
      lon: bm.lon || bm.longitude,
      place_id: bm.place_id || bm.id,
      rating: bm.rating || 0,
      price: bm.price || '',
      priceTier: bm.priceTier || null,
      tags: Array.isArray(bm.tags) ? bm.tags : [],
      categories: Array.isArray(bm.categories) ? bm.categories : [],
      bestTime: bm.bestTime || bm.best_time || '',
      image: bm.image || '',
    };
    await addTripForCurrentUser(destinationData);
    await trackDestinationAdded(u.uid, {
      id: bm.id,
      name: bm.name,
      region: bm.region || bm.locationRegion,
      location: bm.location,
      latitude: bm.lat || bm.latitude,
      longitude: bm.lon || bm.longitude,
    });
    // Optionally show feedback or navigate
    navigate('/itinerary');
  };

  const removeBookmarkPreview = async (id) => {
    setBookmarks(prev => prev.filter(b => b.id !== id)); // Optimistic update
    if (auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'bookmarks', id));
      } catch (err) {
        console.error('removeBookmarkPreview error', err);
        // Revert on error if needed, though useBookmarks will refetch
      }
    }
  };

  return (
    <div className="dashboard-preview-col">
      <div className="dashboard-preview-title">Bookmarks</div>
      <button 
        className="dashboard-preview-btn"
        onClick={() => navigate('/bookmarks2')}
      >
        + Add new bookmark
      </button>
      <div className="dashboard-preview-list" ref={bookmarksContainerRef} style={{ position: 'relative', overflow: 'visible' }}>
        {bookmarksLoading ? (
          <div className="dashboard-preview-empty">Loading bookmarks…</div>
        ) : bookmarks.length === 0 ? (
          <div className="dashboard-preview-empty">
            You don't have any bookmarks yet. <span style={{ color: "#e74c3c" }}>Add a new bookmark.</span>
          </div>
        ) : (
          bookmarks.map(bm => (
            <div
              className="dashboard-preview-bookmark"
              key={bm.id}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <img
                  src={bm.image || getImageForDestination(bm.name) || '/placeholder.png'}
                  alt={bm.title || bm.name}
                  className="dashboard-preview-img"
                />
                <div className="dashboard-preview-bookmark-info">
                  <div className="dashboard-preview-bookmark-title">{bm.title || bm.name}</div>
                  <div className="dashboard-preview-bookmark-desc">{bm.desc || bm.description}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
                <button
                  className="dashboard-preview-dots"
                  aria-label="Actions"
                  title="Actions"
                  onClick={(e) => toggleBookmarkActions(e, bm.id)}
                  style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', padding: '6px' }}
                >
                  ⋯
                </button>
              </div>
              {openActionsId === bm.id && createPortal(
                <div
                  ref={actionsRef}
                  className="dashboard-preview-actions"
                  style={{
                    position: 'absolute',
                    left: portalPos.left,
                    top: portalPos.top,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    background: '#fff',
                    borderRadius: 8,
                    padding: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    zIndex: 999999,
                    minWidth: 160
                  }}
                >
                  <button
                    className="dashboard-preview-btn"
                    onClick={() => { onOpenDetails(bm); setOpenActionsId(null); }}
                    style={{ padding: '6px 10px', textAlign: 'left', background: 'transparent', border: 'none', fontWeight: 500, fontSize: 15, borderRadius: 6, cursor: 'pointer' }}
                  >
                    View
                  </button>
                  <button
                    className="dashboard-preview-btn"
                    onClick={async () => {
                      await addBookmarkToTrip(bm);
                      setOpenActionsId(null);
                    }}
                    style={{ padding: '6px 10px', textAlign: 'left', background: 'transparent', border: 'none', fontWeight: 500, fontSize: 15, borderRadius: 6, cursor: 'pointer' }}
                  >
                    Add to Trip
                  </button>
                  <button
                    className="dashboard-preview-btn"
                    onClick={() => { removeBookmarkPreview(bm.id); setOpenActionsId(null); }}
                    style={{ padding: '6px 10px', background: '#ffecec', textAlign: 'left', border: 'none', fontWeight: 500, fontSize: 15, borderRadius: 6, cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </div>,
                document.body
              )}
            </div>
          )))}
      </div>
    </div>
  );
}

export default BookmarksPreview;
