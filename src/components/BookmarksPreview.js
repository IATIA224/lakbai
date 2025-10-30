import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useBookmarks } from '../hooks/useBookmarks';

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

  const computeAndSetPos = (anchorEl) => {
    if (!anchorEl || !bookmarksContainerRef.current) return;
    const anchorRect = anchorEl.getBoundingClientRect();
    const parent = bookmarksContainerRef.current;
    const parentRect = parent.getBoundingClientRect();
    const popup = actionsRef.current;
    const margin = 8;

    let left = margin + parent.scrollLeft;
    let top = anchorRect.top - parentRect.top + parent.scrollTop;

    if (popup) {
      const popupRect = popup.getBoundingClientRect();
      const popupW = popupRect.width || 160;
      const popupH = popupRect.height || 120;
      left = Math.max(margin, parentRect.width - popupW - margin) + parent.scrollLeft;
      const anchorCenter = anchorRect.top + (anchorRect.height / 2);
      top = Math.round(anchorCenter - parentRect.top - popupH / 2 + parent.scrollTop);
      const maxTop = Math.max(margin, parentRect.height - popupH - margin) + parent.scrollTop;
      top = Math.min(Math.max(margin + parent.scrollTop, top), maxTop);
    }
    setActionsPos({ top, left });
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

  const addBookmarkToTrip = (bm) => {
    navigate('/itinerary', { state: { prefill: bm } });
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
      <div className="dashboard-preview-list" ref={bookmarksContainerRef} style={{ position: 'relative' }}>
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
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
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

                {openActionsId === bm.id && (
                  <div
                    ref={actionsRef}
                    className="dashboard-preview-actions"
                    style={{
                      position: 'absolute',
                      top: actionsPos.top,
                      left: actionsPos.left,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      background: '#fff',
                      borderRadius: 8,
                      padding: 8,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      zIndex: 2000,
                      minWidth: 160
                    }}
                  >
                    <button
                      className="dashboard-preview-btn"
                      onClick={() => { onOpenDetails(bm); setOpenActionsId(null); }}
                      style={{ padding: '6px 10px', textAlign: 'left' }}
                    >
                      🔎 View
                    </button>
                    <button
                      className={`itn-btn success`}
                      onClick={() => { addBookmarkToTrip(bm); setOpenActionsId(null); }}
                      style={{ padding: '6px 10px', textAlign: 'left' }}
                    >
                      ✅ Add to Trip
                    </button>
                    <button
                      className="dashboard-preview-btn"
                      onClick={() => { removeBookmarkPreview(bm.id); setOpenActionsId(null); }}
                      style={{ padding: '6px 10px', background: '#ffecec', textAlign: 'left' }}
                    >
                      🗑️ Remove
                    </button>
                  </div>
                )}
              </div>
              </div>
            ))
          )}
        </div>
      </div>
  );
}

export default BookmarksPreview;
