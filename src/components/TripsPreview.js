import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useTrips } from '../hooks/useTrips';
import ItinerarySummaryModal from './ItinerarySummaryModal';
import EditDestinationModal from './EditDestinationModal';

// Helper to get image URL by destination name from a local JSON
// In a real app, this might be part of a larger utility library.
import destImages from '../dest-images.json';
function getImageForDestination(name) {
  if (!name) return undefined;
  const found = destImages.find(img => img.name.trim().toLowerCase() === name.trim().toLowerCase());
  return found ? found.url : undefined;
}

function TripsPreview({ setShowAIModal }) {
  const navigate = useNavigate();
  const { trips, loading: tripsLoading } = useTrips();
  const [showTripSummaryModal, setShowTripSummaryModal] = useState(false);
  const [summaryTrip, setSummaryTrip] = useState(null);
  const [showEditTripModal, setShowEditTripModal] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);

  const tripsContainerRef = useRef(null);
  const tripActionsRef = useRef(null);
  const tripAnchorRef = useRef(null);
  const [openTripActionsId, setOpenTripActionsId] = useState(null);
  const [tripActionsPos, setTripActionsPos] = useState({ top: 0, left: 0 });

  const computeAndSetTripPos = (anchorEl) => {
    if (!anchorEl || !tripsContainerRef.current) return;
    const anchorRect = anchorEl.getBoundingClientRect();
    const parent = tripsContainerRef.current;
    const parentRect = parent.getBoundingClientRect();
    const popup = tripActionsRef.current;
    const margin = 8;

    let left = Math.max(margin, parentRect.width - 160 - margin) + parent.scrollLeft;
    let top = anchorRect.top - parentRect.top + parent.scrollTop;

    if (popup) {
      const popupRect = popup.getBoundingClientRect();
      const popupW = popupRect.width || 160;
      const popupH = popupRect.height || 120;
      left = Math.max(margin, parentRect.width - popupW - margin) + parent.scrollLeft;
      const anchorCenter = anchorRect.top + anchorRect.height / 2;
      top = Math.round(anchorCenter - parentRect.top - popupH / 2 + parent.scrollTop);
      const maxTop = Math.max(margin, parentRect.height - popupH - margin) + parent.scrollTop;
      top = Math.min(Math.max(margin + parent.scrollTop, top), maxTop);
    }
    setTripActionsPos({ top, left });
  };

  const toggleTripActions = (e, id) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    if (openTripActionsId === id) {
      setOpenTripActionsId(null);
      tripAnchorRef.current = null;
    } else {
      tripAnchorRef.current = btn;
      computeAndSetTripPos(btn);
      setOpenTripActionsId(id);
    }
  };

  useEffect(() => {
    const handleDocClick = (ev) => {
      if (tripActionsRef.current && !tripActionsRef.current.contains(ev.target) && tripAnchorRef.current && !tripAnchorRef.current.contains(ev.target)) {
        setOpenTripActionsId(null);
        tripAnchorRef.current = null;
      }
    };
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

  const openTripSummary = (trip) => {
    setSummaryTrip(trip);
    setShowTripSummaryModal(true);
    setOpenTripActionsId(null);
  };

  const editTrip = (trip) => {
    setEditingTrip(trip);
    setShowEditTripModal(true);
    setOpenTripActionsId(null);
  };

  const removeTrip = async (trip) => {
    if (!auth.currentUser || !window.confirm('Remove this destination from your itinerary?')) {
      setOpenTripActionsId(null);
      return;
    }
    try {
      await deleteDoc(doc(db, 'itinerary', auth.currentUser.uid, 'items', trip.id));
    } catch (err) {
      console.error('remove trip failed', err);
      alert('Failed to remove trip');
    } finally {
      setOpenTripActionsId(null);
    }
  };

  const saveTripEdit = async (data) => {
    if (!auth.currentUser) { alert('Please sign in'); return; }
    try {
      const ref = doc(db, 'itinerary', auth.currentUser.uid, 'items', String(data.id));
      const payload = {
        name: data.name || '',
        region: data.region || '',
        arrival: data.arrival || '',
        departure: data.departure || '',
        status: data.status || 'Upcoming',
        estimatedExpenditure: Number(data.estimatedExpenditure) || 0,
        accomType: data.accomType || '',
        accomName: data.accomName || '',
        accomNotes: data.accomNotes || '',
        activities: Array.isArray(data.activities) ? data.activities : [],
        transport: data.transport || '',
        transportNotes: data.transportNotes || '',
        notes: data.notes || '',
        updatedAt: serverTimestamp(),
      };
      await updateDoc(ref, payload);
      setShowEditTripModal(false);
    } catch (err) {
      console.error('Edit save failed', err);
      alert('Failed to save trip');
    }
  };

  return (
    <>
      <div className="dashboard-preview-col">
        <div className="dashboard-preview-title">Your trips</div>
        <button 
          className="dashboard-preview-btn"
          onClick={() => navigate('/itinerary')}
        >
          + Plan new trip
        </button>
        <div className="dashboard-preview-list" ref={tripsContainerRef} style={{ position: 'relative' }}>
          {tripsLoading ? (
            <div className="dashboard-preview-empty">Loading trips…</div>
          ) : trips && trips.length > 0 ? (
            trips.slice(0, 2).map(trip => (
              <div className="dashboard-preview-trip" key={trip.id || trip.name}>
                <img src={trip.image || getImageForDestination(trip.name) || '/placeholder.png'} alt={trip.name || trip.title} className="dashboard-preview-img" />
                <div className="dashboard-preview-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="dashboard-preview-trip-title">{trip.name || trip.title}</div>
                    {trip.status && (
                      <span className={`dashboard-preview-status ${String(trip.status).toLowerCase()}`}>
                        {trip.status}
                      </span>
                    )}
                  </div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    className="dashboard-trip-dots"
                    aria-label="Trip actions"
                    title="Actions"
                    onClick={(e) => toggleTripActions(e, trip.id)}
                    style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', padding: '6px' }}
                  >
                    ⋯
                  </button>
                  {openTripActionsId === trip.id && (
                    <div
                      ref={tripActionsRef}
                      className="dashboard-trip-actions dashboard-preview-actions"
                      style={{
                        position: 'absolute',
                        top: tripActionsPos.top,
                        left: tripActionsPos.left,
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
                        onClick={() => openTripSummary(trip)}
                        style={{ padding: '6px 10px', textAlign: 'left' }}
                      >
                        🔎 View Summary
                      </button>
                      <button
                        className="dashboard-preview-btn"
                        onClick={() => editTrip(trip)}
                        style={{ padding: '6px 10px', textAlign: 'left' }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="dashboard-preview-btn"
                        onClick={() => removeTrip(trip)}
                        style={{ padding: '6px 10px', background: '#ffecec', textAlign: 'left' }}
                      >
                        🗑️ Remove
                      </button>
                    </div>
                  )}
                </div>
                </div>
              ))
            ) : (
              <div className="dashboard-preview-empty">No trips found. Start planning your first trip!</div>
            )}
          </div>
        </div>

      {showTripSummaryModal && summaryTrip && (
        <ItinerarySummaryModal item={summaryTrip} onClose={() => setShowTripSummaryModal(false)} />
      )}

      {showEditTripModal && editingTrip && (
        <EditDestinationModal
          initial={editingTrip}
          onSave={saveTripEdit}
          onClose={() => setShowEditTripModal(false)}
        />
      )}
    </>
  );
}

export default TripsPreview;
