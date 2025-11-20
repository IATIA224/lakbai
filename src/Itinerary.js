import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom"; // ADD THIS IMPORT
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./itinerary.css";
import { db, auth } from "./firebase";
import {
  addDoc,
  collection,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query as fsQuery,
  getDocs,
  setDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { unlockAchievement } from "./profile";
import {
  useFriendsList,
  useSharedItineraries,
  shareItineraryWithFriends,
  SharedItinerariesTab,
  deleteTripDestination,
  clearAllTripDestinations,
} from './itinerary2';
import ItineraryHotelsModal from "./itineraryHotels";
import ItineraryCostEstimationModal from "./itineraryCostEstimation";
import ItineraryAgencyModal from "./itineraryAgency"; // ADD THIS IMPORT
import {
  trackDestinationAdded,
  trackDestinationCompleted,
  trackDestinationUncompleted,
  trackDestinationRemoved,
} from "./itinerary_Stats";
import { logActivity } from "./profile"; // ADD THIS IMPORT

// NEW: import UpdateCSV component
import UpdateCSV from "./updatecsv";
import { 
  SuggestionView,
  HotelSuggestion,
  AgencySuggestion 
} from "./ItinerarySuggestion";
import ItineraryCard from "./components/trip_components/ItineraryCard"; // ADD THIS LINE
import ExportPDFModal from "./components/trip_components/ExportPDFModal";
import { markAllCompleted } from "./components/trip_components/MarkCompleteButton";
import { deleteAllItinerary } from "./components/trip_components/DeleteAllButton";
import ShareItineraryModal from "./components/trip_components/ShareItineraryModal";
import { exportItineraryToPDF } from "./components/trip_components/ExportPDFButton";

// ==================== ADD TO TRIP HELPER (moved to top) ====================
export async function addTripForCurrentUser(dest) {
  const u = auth.currentUser;
  if (!u) throw new Error("AUTH_REQUIRED");

  const parseEstimatedFromPrice = (p) => {
    if (p == null) return 0;
    if (typeof p === "number") return p;
    const s = String(p).replace(/\s/g, "").replace(/₱/g, "").replace(/,/g, "");
    const nums = s.match(/\d+/g);
    if (!nums || nums.length === 0) return 0;
    const numbers = nums.map(Number).filter(Number.isFinite);
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((a, b) => a + b, 0);
    return Math.round(sum / numbers.length);
  };

  await setDoc(
    doc(db, "itinerary", u.uid),
    { owner: u.uid, updatedAt: serverTimestamp() },
    { merge: true }
  );

  const id = String(dest?.id || dest?.place_id || dest?.name || Date.now())
    .replace(/[^\w-]/g, "_");
  const ref = doc(db, "itinerary", u.uid, "items", id);
  const now = serverTimestamp();

  const estimated = parseEstimatedFromPrice(
    dest?.price ?? dest?.priceTier ?? dest?.budget ?? dest?.estimatedExpenditure
  );

  const payload = {
    id: dest?.id || "",
    name: dest?.name || "Untitled destination",
    display_name: dest?.display_name || `${dest?.name || ""}${dest?.region ? `, ${dest.region}` : ""}`,
    region: dest?.region || "",
    location: dest?.location || "",
    description: dest?.description || "",
    lat: dest?.lat || dest?.latitude || "",
    lon: dest?.lon || dest?.longitude || "",
    place_id: dest?.place_id || dest?.id || "",
    rating: dest?.rating || 0,
    price: dest?.price || "",
    priceTier: dest?.priceTier || null,
    tags: Array.isArray(dest?.tags) ? dest.tags : [],
    categories: Array.isArray(dest?.categories) ? dest.categories : [],
    bestTime: dest?.bestTime || "",
    image: dest?.image || "",
    status: dest?.status || "Upcoming",
    estimatedExpenditure: estimated,
    packingSuggestions: dest?.packingSuggestions || dest?.packing || "",
    packingCategory: dest?.packingCategory || null,
    budget: dest?.budget || null,
    breakdown: dest?.breakdown || [], // CAPTURE THIS FROM DETAILS
    arrival: dest?.arrival || "",
    departure: dest?.departure || "",
    accomType: dest?.accomType || "",
    accomName: dest?.accomName || "",
    accomNotes: dest?.accomNotes || "",
    activities: Array.isArray(dest?.activities) ? dest.activities : [],
    transport: dest?.transport || "",
    transportNotes: dest?.transportNotes || "",
    notes: dest?.notes || "",
    agency: dest?.agency || "",
    createdAt: now,
    updatedAt: now,
  };

  console.log("[Itinerary] Saving trip with all details:", payload);

  try {
    await setDoc(ref, payload, { merge: true });
    console.log("[Itinerary] Added trip:", payload);
    return id;
  } catch (err) {
    console.error("[Itinerary] Failed to add trip:", err);
    throw err;
  }
}

// ==================== CACHING LAYER ====================
const ITINERARY_CACHE_DURATION = 3 * 60 * 1000; // 3 minutes
const itineraryCache = {
  data: null,
  timestamp: null,
  userId: null,
  isValid(uid) {
    return (
      this.data &&
      this.userId === uid &&
      this.timestamp &&
      Date.now() - this.timestamp < ITINERARY_CACHE_DURATION
    );
  },
  set(data, uid) {
    this.data = data;
    this.userId = uid;
    this.timestamp = Date.now();
    // Cache to localStorage for persistence
    try {
      localStorage.setItem('itinerary_cache', JSON.stringify({
        data,
        userId: uid,
        timestamp: this.timestamp
      }));
    } catch (e) {
      console.warn('Failed to cache itinerary to localStorage:', e);
    }
  },
  get(uid) {
    // Try memory cache first
    if (this.isValid(uid)) return this.data;
    
    // Try localStorage cache
    try {
      const cached = localStorage.getItem('itinerary_cache');
      if (cached) {
        const { data, userId, timestamp } = JSON.parse(cached);
        if (userId === uid && Date.now() - timestamp < ITINERARY_CACHE_DURATION) {
          this.data = data;
          this.userId = userId;
          this.timestamp = timestamp;
          return data;
        }
      }
    } catch (e) {
      console.warn('Failed to read itinerary cache from localStorage:', e);
    }
    
    return null;
  },
  clear() {
    this.data = null;
    this.userId = null;
    this.timestamp = null;
    try {
      localStorage.removeItem('itinerary_cache');
    } catch (e) {}
  }
};

// Simple place search via OpenStreetMap Nominatim
async function searchPlace(q) {
  if (!q?.trim()) {
    return [];
  }
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  return res.ok ? res.json() : [];
}

function EditDestinationModal({ initial, onSave, onClose }) {
  const isMobile = useIsMobile();
  const [form, setForm] = useState(() => ({
    name: initial?.display_name?.split(",")[0] || initial?.name || "",
    region:
      initial?.display_name?.split(",").slice(1).join(",").trim() ||
      initial?.region ||
      "",
    location: initial?.location || "",
    arrival: initial?.arrival || "",
    departure: initial?.departure || "",
    status: initial?.status || "Upcoming",
    estimatedExpenditure: initial?.estimatedExpenditure ?? initial?.budget ?? 0,
    accomType: initial?.accomType || "",
    accomName: initial?.accomName || "",
    accomNotes: initial?.accomNotes || "",
    activities: initial?.activities || [],
    activityDraft: "",
    transport: initial?.transport || "",
    transportNotes: initial?.transportNotes || "",
    notes: initial?.notes || "",
    agency: initial?.agency || "",
  }));

  const [notif, setNotif] = useState("");
  const [mobileViewMode, setMobileViewMode] = useState("form");

  const addActivity = React.useCallback(() => {
    const v = form.activityDraft.trim();
    if (!v) return;
    setForm((f) => ({ ...f, activities: [...f.activities, v], activityDraft: "" }));
  }, [form.activityDraft]);
  
  const removeActivity = (i) =>
    setForm((f) => ({ ...f, activities: f.activities.filter((_, idx) => idx !== i) }));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSave = async () => {
    try {
      await onSave({
        ...initial,
        ...form,
        estimatedExpenditure: Number(form.estimatedExpenditure) || 0,
      });
      setNotif("Itinerary item updated successfully!");
      setTimeout(() => {
        setNotif("");
        onClose();
      }, 1200);
    } catch (err) {
      setNotif("Itinerary item update failed.");
      setTimeout(() => setNotif(""), 2000);
    }
  };

  const handleSelectHotel = (hotel) => {
    setForm(prev => ({
      ...prev,
      accomType: hotel.type,
      accomName: hotel.name,
      accomNotes: hotel.address,
    }));
    if (isMobile) setMobileViewMode("form");
  };

  const handleSelectAgency = (agency) => {
    setForm(prev => ({
      ...prev,
      agency: `${agency.name} - ${agency.phone || ''} ${agency.website || ''}`.trim(),
    }));
    if (isMobile) setMobileViewMode("form");
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && document.activeElement?.id === "itn-activity-draft") {
        e.preventDefault();
        addActivity();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addActivity, onClose]);

  const formContent = (
    <div className="itn-form-grid">
      <div className="itn-form-col">
        <div className="itn-field">
          <span className="itn-label">Destination Name</span>
          <input
            className="itn-input"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="City or place name (required)"
          />
        </div>

        <div className="itn-field">
          <span className="itn-label">Country/Region</span>
          <input
            className="itn-input"
            name="region"
            value={form.region}
            onChange={handleChange}
            placeholder="Region (e.g., Metro Manila)"
          />
        </div>

        <div className="itn-field">
          <span className="itn-label">Location</span>
          <input
            className="itn-input"
            name="location"
            value={form.location}
            onChange={handleChange}
            placeholder="Full address or location"
          />
        </div>

        <div className="itn-grid-2">
          <div className="itn-field">
            <span className="itn-label">Arrival Date</span>
            <input
              type="date"
              className="itn-input"
              name="arrival"
              value={form.arrival}
              onChange={handleChange}
            />
          </div>
          <div className="itn-field">
            <span className="itn-label">Departure Date</span>
            <input
              type="date"
              className="itn-input"
              name="departure"
              value={form.departure}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="itn-grid-2">
          <div className="itn-field">
            <span className="itn-label">Trip Status</span>
            <select
              className="itn-input"
              name="status"
              value={form.status}
              onChange={handleChange}
            >
              <option>Upcoming</option>
              <option>Ongoing</option>
              <option>Completed</option>
            </select>
          </div>
          <div className="itn-field">
            <span className="itn-label">Estimated Expenditure (₱)</span>
            <input
              className="itn-input"
              name="estimatedExpenditure"
              type="number"
              value={form.estimatedExpenditure}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="itn-field">
          <span className="itn-label">Activities & Things to Do</span>
          <div className="itn-grid-2">
            <input
              id="itn-activity-draft"
              className="itn-input"
              placeholder="e.g., Snorkeling, Hiking..."
              value={form.activityDraft}
              onChange={(e) => setForm({ ...form, activityDraft: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addActivity())}
            />
            <button type="button" className="itn-btn primary" onClick={addActivity}>
              Add Activity
            </button>
          </div>
          {form.activities.length > 0 && (
            <div className="itn-activities-wrapper" style={{ marginTop: 8 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {form.activities.map((act, i) => (
                  <div key={i} className="itn-activity-tag">
                    <span>{act}</span>
                    <button
                      type="button"
                      onClick={() => removeActivity(i)}
                      className="itn-activity-remove-btn"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="itn-form-col">
        <div className="itn-field">
          <span className="itn-label">Accommodation Details</span>
          <div className="itn-grid-2">
            <select
              className="itn-input"
              name="accomType"
              value={form.accomType}
              onChange={handleChange}
            >
              <option value="">Select type...</option>
              <option>Hotel</option>
              <option>Hostel</option>
              <option>Apartment</option>
              <option>Resort</option>
              <option>Homestay</option>
            </select>
            <input
              className="itn-input"
              placeholder="Hotel/Place name"
              name="accomName"
              value={form.accomName}
              onChange={handleChange}
            />
          </div>
          <textarea
            rows={2}
            className="itn-input"
            name="accomNotes"
            placeholder="Address, booking details, special notes..."
            value={form.accomNotes}
            onChange={handleChange}
          />
        </div>

        <div className="itn-field">
          <span className="itn-label">Transport</span>
          <div className="itn-grid-2">
            <select
              className="itn-input"
              name="transport"
              value={form.transport}
              onChange={handleChange}
            >
              <option value="">Select transportation...</option>
              <option>Flight</option>
              <option>Train</option>
              <option>Bus</option>
              <option>Car</option>
              <option>Ferry</option>
            </select>
          </div>
          <textarea
            rows={2}
            className="itn-input"
            name="transportNotes"
            placeholder="Transport notes..."
            value={form.transportNotes}
            onChange={handleChange}
          />
        </div>

        <div className="itn-field">
          <span className="itn-label">Travel Agency</span>
          <input
            className="itn-input"
            placeholder="Agency name or details"
            name="agency"
            value={form.agency}
            onChange={handleChange}
          />
        </div>

        <div className="itn-field">
          <span className="itn-label">Additional Notes</span>
          <textarea
            rows={3}
            className="itn-input"
            name="notes"
            placeholder="Any other important details..."
            value={form.notes}
            onChange={handleChange}
          />
        </div>
      </div>
    </div>
  );

  // MOBILE: Bottom sheet
  if (isMobile) {
    const mobileContent = (
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'slideUp 0.3s ease-out'
        }}
        onClick={onClose}
      >
        <div 
          style={{
            background: '#fff',
            borderRadius: '20px 20px 0 0',
            width: '100%',
            maxHeight: '95vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            color: '#fff',
            padding: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>
              Edit Details
            </h2>
            <button 
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: '#fff',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '0 8px',
                borderRadius: '8px'
              }}
            >
              ×
            </button>
          </div>

          {/* Mobile Tabs */}
          <div style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            gap: '8px',
            flexShrink: 0
          }}>
            <button
              onClick={() => setMobileViewMode("form")}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '8px',
                border: mobileViewMode === "form" ? '2px solid #6366f1' : '1px solid #e5e7eb',
                background: mobileViewMode === "form" ? '#eef2ff' : '#fff',
                color: mobileViewMode === "form" ? '#6366f1' : '#64748b',
                fontWeight: mobileViewMode === "form" ? '700' : '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              ✏️ Details
            </button>
            <button
              onClick={() => setMobileViewMode("hotels")}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '8px',
                border: mobileViewMode === "hotels" ? '2px solid #10b981' : '1px solid #e5e7eb',
                background: mobileViewMode === "hotels" ? '#ecfdf5' : '#fff',
                color: mobileViewMode === "hotels" ? '#10b981' : '#64748b',
                fontWeight: mobileViewMode === "hotels" ? '700' : '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              🏨 Hotels
            </button>
            <button
              onClick={() => setMobileViewMode("agencies")}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '8px',
                border: mobileViewMode === "agencies" ? '2px solid #f59e0b' : '1px solid #e5e7eb',
                background: mobileViewMode === "agencies" ? '#fffbeb' : '#fff',
                color: mobileViewMode === "agencies" ? '#f59e0b' : '#64748b',
                fontWeight: mobileViewMode === "agencies" ? '700' : '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              🛫 Agencies
            </button>
          </div>

          {/* Content */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '16px'
          }}>
            {mobileViewMode === "form" && formContent}
            {mobileViewMode === "hotels" && (
              <HotelSuggestion details={initial} onSelect={handleSelectHotel} />
            )}
            {mobileViewMode === "agencies" && (
              <AgencySuggestion details={initial} onSelect={handleSelectAgency} />
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            flexShrink: 0,
            background: '#f8fafc'
          }}>
            <button 
              onClick={onClose}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                background: '#fff',
                color: '#374151',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            {mobileViewMode === "form" && (
              <button 
                onClick={handleSave}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#fff',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Save Details
              </button>
            )}
          </div>

          {notif && (
            <div style={{
              position: "fixed",
              top: 20,
              right: 20,
              background: "#6c63ff",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: 8,
              zIndex: 10001,
            }}>
              {notif}
            </div>
          )}
        </div>
      </div>
    );
    return ReactDOM.createPortal(mobileContent, document.body);
  }

  // DESKTOP: SuggestionView with form in center
  const desktopContent = (
    <SuggestionView 
      item={initial} 
      onClose={onClose}
      onSelectHotel={handleSelectHotel}
      onSelectAgency={handleSelectAgency}
    >
      <form className="itn-modal" onClick={(e) => e.stopPropagation()}>
        <div className="itn-modal-header">
          <div className="itn-modal-title">Edit Destination Details</div>
          <button type="button" className="itn-close" onClick={onClose}>×</button>
        </div>

        <div className="itn-modal-body">
          {formContent}
        </div>

        <div className="itn-modal-footer">
          <button type="button" className="itn-btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="itn-btn primary" onClick={handleSave}>Save Details</button>
        </div>
        
        {notif && (
          <div className="itn-notification">
            {notif}
          </div>
        )}
      </form>
    </SuggestionView>
  );

  return ReactDOM.createPortal(desktopContent, document.body);
}
function DestinationCard({ item, index, onEdit, onRemove, onToggleStatus, setEditing }) {
  const isMobile = useIsMobile();
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showCostEstimation, setShowCostEstimation] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // ADD THIS - Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.itn-card-settings') && !e.target.closest('.itn-card-menu')) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showMenu]);

  const days =
    item.arrival && item.departure
      ? Math.max(
          1,
          Math.ceil(
            (new Date(item.departure).getTime() - new Date(item.arrival).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : 0;

  const activities = item.activities || [];
  const showToggle = activities.length > 3;

  return (
    <>
      <div className={`itn-card`} style={{ overflow: 'visible', position: 'relative' }}>
        {/* ADD THIS - Settings button for mobile only */}
        <button
          className="itn-card-settings"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          title="Options"
        >
          ⚙️
        </button>

        {/* ADD THIS - Settings menu (mobile only) */}
        {showMenu && (
          <div className="itn-card-menu">
            <button
              className="itn-card-menu-item"
              onClick={() => {
                setShowSummary(true);
                setShowMenu(false);
              }}
            >
               View Summary
            </button>
            <button
              className="itn-card-menu-item"
              onClick={() => {
                setShowCostEstimation(true);
                setShowMenu(false);
              }}
            >
               Estimate Transport Cost
            </button>
          </div>
        )}

        <div className="itn-card-head">
          <div className="itn-card-title">
            <span className="itn-step">{index + 1}</span>
            <div>
              <div className="itn-name">{item.name || "Destination"}</div>
              <div className="itn-sub">{item.region}</div>
              {item.location && (
                <div className="itn-location" style={{ 
                  fontSize: '0.85rem', 
                  color: '#94a3b8',
                  marginTop: '2px'
                }}>
                  📌 {item.location}
                </div>
              )}
            </div>
          </div>
          
          <div className="itn-actions" style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 6 : 8,
            minWidth: isMobile ? 'auto' : '240px'
          }}>
            <span className={`itn-badge ${item.status.toLowerCase()}`}>{item.status}</span>
            {!isMobile && (
              <>
                <button className="itn-btn" onClick={() => onToggleStatus(item.id)}>Toggle</button>
                <button className="itn-btn" onClick={() => setEditing(item)}>Edit</button>
                {/* CHANGE THIS LINE: add 'danger' class */}
                <button className="itn-btn danger" onClick={() => onRemove(item.id)}>Remove</button>
              </>
            )}
          </div>
        </div>

        <div className="itn-stats">
          <div className="itn-stat blue">
            <div className="itn-stat-title">Dates</div>
            <div className="itn-stat-body">
              {item.arrival || item.departure ? (
                <>
                  <div>{item.arrival || "—"}</div>
                  <div>{item.departure || "—"}</div>
                  <div className="itn-muted">{days} {days === 1 ? "day" : "days"} total</div>
                </>
              ) : (
                <div className="itn-muted">Not set</div>
              )}
            </div>
          </div>

          <div className="itn-stat green">
            <div className="itn-stat-title">Estimated expenditure</div>
            <div className="itn-stat-body">
              <div>₱{Number(item.estimatedExpenditure ?? item.budget ?? 0).toLocaleString()}</div>
              <div className="itn-muted">Estimated total cost for this trip</div>
            </div>
          </div>

          <div className="itn-stat purple">
            <div className="itn-stat-title">Stay</div>
            <div className="itn-stat-body">
              <div>{item.accomType || "Not planned"}</div>
              <div className="itn-muted">{item.accomName || "No details"}</div>
            </div>
          </div>

          <div className="itn-stat purple">
            <div className="itn-stat-title">Agency</div>
            <div className="itn-stat-body">
              <div>{item.agency || "Not planned"}</div>
            </div>
          </div>

          <div className="itn-stat orange">
            <div className="itn-stat-title">Activities</div>
            <div className="itn-stat-body">
              <div>{activities.length} planned</div>
              {activities.length ? (
                <>
                  <div className="itn-muted" style={{ wordBreak: "break-word" }}>
                    {showAllActivities
                      ? activities.join(", ")
                      : activities.slice(0, 3).join(", ")}
                    {showToggle && !showAllActivities && "…"}
                  </div>
                  {showToggle && (
                    <button
                      className="itn-btn ghost"
                      style={{ marginTop: 4, fontSize: 12, padding: "2px 8px" }}
                      onClick={() => setShowAllActivities((v) => !v)}
                    >
                      {showAllActivities ? "Show Less" : "Show All"}
                    </button>
                  )}
                </>
              ) : (
                <div className="itn-muted">—</div>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons - full width stacked (MOBILE ONLY) */}
        {isMobile && (
          <div style={{ 
            marginTop: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            width: '100%'
          }}>
            <button 
              onClick={() => onToggleStatus(item.id)}
              style={{ 
                width: '100%',
                padding: '12px 16px',
                fontSize: '15px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                borderRadius: '10px',
                border: '1px solid #e5e7eb',
                background: '#f3f4f6',
                color: '#374151',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#f3f4f6';
              }}
            >
              ☑️ Toggle
            </button>
            
            <button 
              onClick={() => setEditing(item)}
              style={{ 
                width: '100%',
                padding: '12px 16px',
                fontSize: '15px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(99, 102,241, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
              }}
            >
              ✏️ Edit
            </button>
            
            <button 
              onClick={() => onRemove(item.id)}
              style={{ 
                width: '100%',
                padding: '12px 16px',
                fontSize: '15px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                borderRadius: '10px',
                background: '#fee2e2',
                color: '#991b1b',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#fecaca';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#fee2e2';
              }}
            >
              🗑️ Remove
            </button>
          </div>
        )}
      </div>

      {/* Render modals OUTSIDE the card */}
      {showSummary && (
        <ItinerarySummaryModal item={item} onClose={() => setShowSummary(false)} />
      )}

      {showCostEstimation && (
        <ItineraryCostEstimationModal
          onClose={() => setShowCostEstimation(false)}
        />
      )}
    </>
  );
}

// ADD: Mobile detection hook at the top level
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
}

function ItinerarySummaryModal({ item, onClose }) {
  const days =
    item && item.arrival && item.departure
      ? Math.max(
          1,
          Math.ceil(
            (new Date(item.departure).getTime() - new Date(item.arrival).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : 0;

  const modalContent = (
    <div className="itn-modal-backdrop" onClick={onClose}>
      <div className="itn-modal" onClick={(e) => e.stopPropagation()}>
        <div className="itn-modal-header">
          <div className="itn-modal-title"> Trip Summary</div>
          <button className="itn-close" onClick={onClose}>×</button>
        </div>

        <div className="itn-modal-body" style={{ flex: 1, overflowY: 'auto' }}>
          <div className="itn-summary-content">
            <div className="itn-summary-section">
              <h3 className="itn-summary-heading"> Destination</h3>
              <div className="itn-summary-item">
                <strong>{item.name}</strong>
                {item.region && <span className="itn-summary-region">{item.region}</span>}
              </div>
              {item.location && (
                <div className="itn-summary-item" style={{ marginTop: '12px' }}>
                  <span className="itn-summary-label" style={{ color: '#64748b', fontSize: '0.9rem' }}>
                     Location: 
                  </span>
                  <span style={{ marginLeft: '8px', color: '#475569' }}>
                    {item.location}
                  </span>
                </div>
              )}
            </div>

            {(item.arrival || item.departure) && (
              <div className="itn-summary-section">
                <h3 className="itn-summary-heading"> Travel Dates</h3>
                <div className="itn-summary-grid">
                  {item.arrival && (
                    <div className="itn-summary-item">
                      <span className="itn-summary-label">Arrival:</span>
                      <span>{new Date(item.arrival).toLocaleDateString()}</span>
                    </div>
                  )}
                  {item.departure && (
                    <div className="itn-summary-item">
                      <span className="itn-summary-label">Departure:</span>
                      <span>{new Date(item.departure).toLocaleDateString()}</span>
                    </div>
                  )}
                  {days > 0 && (
                    <div className="itn-summary-item">
                      <span className="itn-summary-label">Duration:</span>
                      <span>{days} day{days !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {item.estimatedExpenditure > 0 && (
              <div className="itn-summary-section">
                <h3 className="itn-summary-heading"> Budget</h3>
                <div className="itn-summary-item">
                  <span className="itn-summary-amount">
                    ₱{Number(item.estimatedExpenditure).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {item.activities && item.activities.length > 0 && (
              <div className="itn-summary-section">
                <h3 className="itn-summary-heading"> Activities</h3>
                <div className="itn-summary-tags">
                  {item.activities.map((activity, idx) => (
                    <span key={idx} className="itn-summary-tag">{activity}</span>
                  ))}
                </div>
              </div>
            )}

            {(item.accomType || item.accomName) && (
              <div className="itn-summary-section">
                <h3 className="itn-summary-heading"> Accommodation</h3>
                <div className="itn-summary-item">
                  {item.accomType && <span className="itn-summary-badge">{item.accomType}</span>}
                  {item.accomName && <strong>{item.accomName}</strong>}
                  {item.accomNotes && <p className="itn-summary-notes">{item.accomNotes}</p>}
                </div>
              </div>
            )}

            {item.transport && (
              <div className="itn-summary-section">
                <h3 className="itn-summary-heading"> Transportation</h3>
                <div className="itn-summary-item">
                  <span className="itn-summary-badge">{item.transport}</span>
                  {item.transportNotes && <p className="itn-summary-notes">{item.transportNotes}</p>}
                </div>
              </div>
            )}

            {item.agency && (
              <div className="itn-summary-section">
                <h3 className="itn-summary-heading"> Agency</h3>
                <div className="itn-summary-item">
                  <p className="itn-summary-notes">{item.agency}</p>
                </div>
              </div>
            )}

            {item.notes && (
              <div className="itn-summary-section">
                <h3 className="itn-summary-heading"> Notes</h3>
                <div className="itn-summary-item">
                  <p className="itn-summary-notes">{item.notes}</p>
                </div>
              </div>
            )}

            <div className="itn-summary-section">
              <h3 className="itn-summary-heading"> Status</h3>
              <div className="itn-summary-item">
                <span className={`itn-summary-status ${item.status.toLowerCase()}`}>
                  {item.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="itn-modal-footer">
          <button className="itn-btn primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>);

  return ReactDOM.createPortal(modalContent, document.body);
}

// Custom confirmation dialog for remove
function showCustomConfirm({ icon, title, items, body, confirmText = "Confirm", cancelText = "Cancel", danger = false }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'itn-confirm-backdrop';
    backdrop.innerHTML = `
      <div class="itn-confirm-dialog">
        <div class="itn-confirm-header">
          <div class="itn-confirm-icon">${icon}</div>
          <h2 class="itn-confirm-title">${title}</h2>
        </div>
        <div class="itn-confirm-content">
          ${items || ""}
          ${body ? `<div style="color:#ef4444; text-align:center; margin:10px 0;">${body}</div>` : ""}
        </div>
        <div class="itn-confirm-footer">
          <button class="itn-confirm-btn cancel" id="confirm-cancel">${cancelText}</button>
          <button class="itn-confirm-btn confirm${danger ? " itn-confirm-btn--danger" : ""}" id="confirm-ok">${confirmText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    document.getElementById('confirm-ok').addEventListener('click', () => {
      document.body.removeChild(backdrop);
      resolve(true);
    });
    document.getElementById('confirm-cancel').addEventListener('click', () => {
      document.body.removeChild(backdrop);
      resolve(false);
    });
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        document.body.removeChild(backdrop);
        resolve(false);
      }
    });
  });
}

// ==================== EXPORT FUNCTIONS ====================
export async function removeTripForAllUsers(itemId) {
  const u = auth.currentUser;
  if (!u) throw new Error("AUTH_REQUIRED");
  // Deletes users/*/trips/<itemId> for every user. Does not touch itinerary/sharedItineraries.
  await deleteTripDestination(u, itemId);
}

export async function clearAllTripsForAllUsers() {
  const u = auth.currentUser;
  if (!u) throw new Error("AUTH_REQUIRED");
  // Clears users/*/trips for every user. Does not touch itinerary/sharedItineraries.
  await clearAllTripDestinations(u);
}

// UPDATE: Main Itinerary component
export default function Itinerary() {
  const [user, setUser] = useState(null); // moved up to be available to hooks
  const [items, setItems] = useState([]);
  const [showExport, setShowExport] = useState(false);
  const [exportSelected, setExportSelected] = useState(new Set());
  const [exportLoading, setExportLoading] = useState(false); // NEW
  const [showCostEstimator, setShowCostEstimator] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false); // NEW
  const [activeTab, setActiveTab] = useState("personal"); // NEW
  const { sharedWithMe, loading: sharedLoading } = useSharedItineraries(auth.currentUser);

  // Export selection helpers
  const toggleExportSelection = React.useCallback((id) => {
    setExportSelected(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }, [setExportSelected]);

  const selectAllExport = React.useCallback(() => {
    setExportSelected(prev => {
      if (prev.size === items.length) return new Set();
      return new Set(items.map(i => i.id));
    });
  }, [items]);

  const handleExport = async () => {
    const selectedItems = items.filter((i) => exportSelected.has(i.id));
    
    if (!selectedItems.length) {
      alert("Select at least one destination to export.");
      return;
    }

    // Ensure all items have complete data from ItineraryCard fields
    const enrichedItems = selectedItems.map(item => ({
      ...item,
      accomType: item.accomType || "",
      accomName: item.accomName || "",
      accomNotes: item.accomNotes || "",
      activities: Array.isArray(item.activities) ? item.activities : (item.activities ? String(item.activities).split(",").map(a => a.trim()) : []),
      packingSuggestions: Array.isArray(item.packingSuggestions) ? item.packingSuggestions : (item.packingSuggestions ? String(item.packingSuggestions).split(",").map(p => p.trim()) : []),
      notes: item.notes || "",
      agency: item.agency || "",
      transport: item.transport || "",
      transportNotes: item.transportNotes || "",
      arrival: item.arrival || "",
      departure: item.departure || "",
      estimatedExpenditure: item.estimatedExpenditure || item.price || 0,
      status: item.status || "upcoming",
    }));

    try {
      console.log("[Itinerary] Starting export for", enrichedItems.length);
      setExportLoading(true);
      await exportItineraryToPDF(enrichedItems);
      console.log("[Itinerary] Export finished");
      setShowExport(false);
      setExportSelected(new Set());
    } catch (err) {
      console.error("[Itinerary] export failed:", err);
      alert("Export failed. Check console.");
    } finally {
      setExportLoading(false);
    }
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => {
      if (typeof unsubAuth === "function") unsubAuth();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setItems([]);
      itineraryCache.clear();
      return;
    }

    const cached = itineraryCache.get(user.uid);
    if (cached) {
      setItems(cached);
    }

    const colRef = collection(db, "itinerary", user.uid, "items");
    const q = fsQuery(colRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        itineraryCache.set(list, user.uid);
        setItems(list);
      },
      (error) => {
        const cachedData = itineraryCache.get(user.uid);
        if (cachedData) {
          setItems(cachedData);
        }
      }
    );

    return () => unsub();
  }, [user]);

  return (
    <div className="itn-page">
      <div className="itn-hero">
        <div className="itn-hero-title">🗺️ My Travel Itineraries</div>
        <div className="itn-hero-sub">Plan, organize, and share your perfect journey</div>
      </div>
      <div className="itn-container-full">
        {/* ADD THIS - Action buttons bar */}
        {items.length > 0 && (
          <div className="itn-actions-bar">
            <div className="itn-actions-bar-title">Quick Actions</div>
            
            <button 
              className="itn-action-btn export"
              onClick={() => setShowExport(true)} // open modal so user can select items
              title="Export selected destinations to PDF"
            >
              <span className="itn-action-btn-icon">📄</span>
              <span className="itn-action-btn-text">Export to PDF</span>
            </button>

            <button 
              className="itn-action-btn route"
              onClick={() => setShowCostEstimator(true)} // open cost estimator
              title="Estimate commute routes and times"
            >
              <span className="itn-action-btn-icon">🚗</span>
              <span className="itn-action-btn-text">Route Estimator</span>
            </button>

            <button 
              className="itn-action-btn share"
              onClick={() => {
                console.log("Share button clicked, showShareModal:", true);
                setShowShareModal(true);
              }}
              title="Share your itinerary with friends"
            >
              <span className="itn-action-btn-icon">👥</span>
              <span className="itn-action-btn-text">Share Itinerary</span>
            </button>

            <button 
              className="itn-action-btn complete"
              onClick={() => markAllCompleted(items, user)}
              title="Mark all destinations as completed"
            >
              <span className="itn-action-btn-icon">✅</span>
              <span className="itn-action-btn-text">Mark All Complete</span>
            </button>

            <button 
              className="itn-action-btn delete"
              onClick={() => deleteAllItinerary(items, user)}
              title="Delete all destinations permanently"
            >
              <span className="itn-action-btn-icon">🗑️</span>
              <span className="itn-action-btn-text">Delete All</span>
            </button>
          </div>
        )}

        <section className="itn-itinerary-full">
          <div className="itn-tabs">
            <div
              className={`itn-tab ${activeTab === 'personal' ? 'active' : ''}`}
              onClick={() => setActiveTab('personal')}
            >
              📋 My Itineraries
            </div>
            <div
              className={`itn-tab ${activeTab === 'shared' ? 'active' : ''}`}
              onClick={() => setActiveTab('shared')}
            >
              👥 Shared With Me
            </div>
          </div>
          <div className="itn-panel itn-panel-full-width">
            {activeTab === 'personal' && (
              items.length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '400px',
                  textAlign: 'center'
                }}>
                  <div style={{
                    fontSize: '80px',
                    animation: 'float 3s ease-in-out infinite'
                  }}>
                    ✈️
                  </div>
                  <h3 style={{
                    fontSize: '24px',
                    fontWeight: '800',
                    color: '#1e293b',
                    margin: '0 0 12px 0'
                  }}>
                    Your Itinerary is Empty
                  </h3>
                  <p style={{
                    fontSize: '15px',
                    color: '#64748b',
                    margin: '0',
                    lineHeight: '1.6'
                  }}>
                    No destinations added yet. Start planning your next adventure!
                  </p>
                </div>
              ) : (
                <div className="itn-destination-list">
                  {items.map((item, idx) => (
                    <ItineraryCard 
                      key={item.id} 
                      item={item} 
                      index={idx}
                      onEdit={async (updatedItem) => {
                        if (!user) return;
                        try {
                          const ref = doc(db, "itinerary", user.uid, "items", updatedItem.id);
                          await updateDoc(ref, updatedItem);
                        } catch (err) {
                          console.error("[Itinerary] Failed to update item:", err);
                        }
                      }}
                      onRemove={(itemId) => {
                        deleteDoc(doc(db, "itinerary", user.uid, "items", itemId));
                      }}
                    />
                  ))}
                </div>
              )
            )}

            {activeTab === 'shared' && (
              <div className="itn-shared-list">
                {sharedLoading ? (
                  <div style={{textAlign:'center', padding:20}}>Loading shared itineraries…</div>
                ) : sharedWithMe.length === 0 ? (
                  <div style={{textAlign:'center', padding:20}}>No itineraries shared with you.</div>
                ) : (
                  sharedWithMe.map((shared) => (
                    <div key={shared.id} className="shared-card">
          <div className="shared-card-header">
            <div>
              <strong>{shared.name || `Shared by ${shared.sharedBy.name}`}</strong>
              <div style={{fontSize:12, color:'#64748b', marginTop:3}}>
                {shared.sharedBy?.name || "Traveler"} • {shared.items.length} destinations
              </div>
            </div>
          </div>

          <div className="itn-destination-list">
            {shared.items.map((item, idx) => (
              <ItineraryCard
                key={item.id}
                item={item}
                index={idx}
                isShared={true}              // ADD THIS
                sharedId={shared.id}         // ADD THIS
                // Update item in the shared collection instead of personal itinerary
                onEdit={async (updatedItem) => {
                  try {
                    const sharedRef = doc(db, "sharedItineraries", shared.id, "items", updatedItem.id);
                    await updateDoc(sharedRef, updatedItem);
                  } catch (err) {
                    console.error("[SharedItinerary] Failed to update item:", err);
                  }
                }}
                // Delete item inside shared itinerary (anyone can remove if collaborative)
                onRemove={async (itemId) => {
                  try {
                    await deleteDoc(doc(db, "sharedItineraries", shared.id, "items", itemId));
                  } catch (err) {
                    console.error("[SharedItinerary] Failed to delete shared item:", err);
                  }
                }}
              />
            ))}
          </div>
        </div>
      ))
    )}
  </div>
)}
          </div>
        </section>
      </div>

      {/* Modals */}
      {showExport && (
        <ExportPDFModal
          items={items}
          selected={exportSelected}
          onToggle={toggleExportSelection}
          onSelectAll={selectAllExport}
          onExport={handleExport}
          onClose={() => setShowExport(false)}
          exporting={exportLoading} // pass loading flag
        />
      )}
      {showCostEstimator && (
        <ItineraryCostEstimationModal onClose={() => setShowCostEstimator(false)} />
      )}
      {showShareModal && (
        <ShareItineraryModal items={items} onClose={() => setShowShareModal(false)} />
      )}
      { items.length === 0 && (
  <button
    className="itn-action-btn share"
    onClick={() => setShowShareModal(true)}
  >
    Test Share (no items)
  </button>
)}
    </div>
  );
}