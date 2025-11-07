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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { unlockAchievement } from "./profile";
import {
  ShareItineraryModal, 
  useFriendsList,
  useSharedItineraries,
  shareItinerary as shareItineraryWithFriends,
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

  const estimated = parseEstimatedFromPrice(dest?.price ?? dest?.priceTier ?? dest?.budget ?? dest?.estimatedExpenditure);

  const payload = {
    name: dest?.name || "Untitled destination",
    region: dest?.region || "",
    location: dest?.location || "",
    display_name:
      dest?.display_name || `${dest?.name || ""}${dest?.region ? `, ${dest.region}` : ""}`,
    categories: dest?.categories || dest?.tags || [],
    priceTier: dest?.priceTier || null,
    bestTime: dest?.bestTime || "",
    image: dest?.image || "",
    status: dest?.status || "Upcoming",
    estimatedExpenditure: estimated,
    createdAt: now,
    updatedAt: now,
  };

  console.log("[Itinerary] Saving trip with location:", payload.location); // DEBUG LOG

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
              <option>Cancelled</option>
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
              👁️ View Summary
            </button>
            <button
              className="itn-card-menu-item"
              onClick={() => {
                setShowCostEstimation(true);
                setShowMenu(false);
              }}
            >
              💰 Estimate Transport Cost
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
                <button className="itn-btn" onClick={() => onRemove(item.id)}>Remove</button>
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

// ADD THIS - Mobile detection hook at the top level
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

function ExportPDFModal({ items, selected, onToggle, onSelectAll, onExport, onClose }) {
  const [isSelectingAll, setIsSelectingAll] = useState(false);

  const handleSelectAllClick = () => {
    setIsSelectingAll(!isSelectingAll);
    onSelectAll();
  };

  const modalContent = (
    <div className="itn-modal-backdrop" onClick={onClose}>
      <div className="itn-modal itn-modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="itn-modal-header">
          <div className="itn-modal-title">Export to PDF</div>
          <button className="itn-close" onClick={onClose}>×</button>
        </div>

        <div className="itn-modal-body">
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
              Select destinations to export ({selected.size} of {items.length} selected)
            </p>
            <button 
              className="itn-btn ghost" 
              onClick={handleSelectAllClick}
              style={{ fontSize: "13px", padding: "6px 12px" }}
            >
              {selected.size === items.length && items.length > 0 ? "Deselect All" : "Select All"}
            </button>
          </div>

          <div style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
            {items.map((item) => (
              <div
                key={item.id}
                className={`itn-export-item ${selected.has(item.id) ? "selected" : ""}`}
                onClick={() => onToggle(item.id)}
                style={{
                  padding: "14px 16px",
                  borderBottom: "1px solid #f1f5f9",
                  cursor: "pointer",
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                  background: selected.has(item.id) ? "#f0f4ff" : "#fff",
                  transition: "all 0.2s"
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => onToggle(item.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ marginTop: "3px", cursor: "pointer" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#1e293b" }}>{item.name}</div>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: "4px" }}>{item.region}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: "6px", lineHeight: 1.5 }}>
                    {item.arrival && <>Arrival: {item.arrival} • </>}
                    {item.departure && <>Departure: {item.departure} • </>}
                    {item.status && <>Status: {item.status}</>}
                    {item.estimatedExpenditure && <> • Budget: ₱{Number(item.estimatedExpenditure).toLocaleString()}</>}
                    {item.location && <> • Location: {item.location}</>}
                  </div>
                </div>
                <span 
                  className={`itn-badge ${item.status.toLowerCase()}`}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="itn-modal-footer">
          <button className="itn-btn ghost" onClick={onClose}>Cancel</button>
          <button 
            className="itn-btn primary" 
            onClick={onExport}
            disabled={selected.size === 0}
          >
            Export {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}

// UPDATE the openExport function
const openExport = () => {
  setShowExport(true);
  setExportSelected(new Set(items.map(i => i.id)));
};

export default function Itinerary() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);

  const [showExport, setShowExport] = useState(false);
  const [exportSelected, setExportSelected] = useState(new Set());
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareSelected, setShareSelected] = useState(new Set());
  const [activeTab, setActiveTab] = useState("personal");

  const [user, setUser] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const friends = useFriendsList(user);
  const { sharedWithMe } = useSharedItineraries(user);

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
      console.log('✅ Using cached itinerary items');
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
        console.error('Itinerary listener error:', error);
        const cachedData = itineraryCache.get(user.uid);
        if (cachedData) {
          setItems(cachedData);
        }
      }
    );
    
    return () => unsub();
  }, [user]);

  const onSearch = async () => {
    setSearching(true);
    try {
      const data = await searchPlace(query);
      setResults(data.slice(0, 5));
      setSelected(data[0] || null);
    } finally {
      setSearching(false);
    }
  };

  const openAddModal = () => {
    if (!selected) return;
    setEditing({
      ...selected,
      name: selected.display_name?.split(",")[0] || selected.name || "",
      region: selected.display_name?.split(",").slice(1).join(",").trim() || selected.region || "",
      location: selected.display_name || "",
      status: "Upcoming",
    });
  };

  // ==================== OPTIMIZED: Save with optimistic updates ====================
  const saveItem = async (data) => {
    if (!user) {
      alert("Please sign in to save your itinerary.");
      return;
    }

    if (!data.name) data.name = "Untitled destination";
    
    // Optimistic update
    if (data.id) {
      // Update existing item optimistically
      setItems(prev => prev.map(item => 
        item.id === data.id ? { ...item, ...data } : item
      ));
    } else {
      // Add new item optimistically with temporary ID
      const tempId = `temp_${Date.now()}`;
      const tempItem = { ...data, id: tempId, createdAt: new Date() };
      setItems(prev => [...prev, tempItem]);
    }
    
    try {
      if (data.id) {
        const itemRef = doc(db, "itinerary", user.uid, "items", data.id);
        await updateDoc(itemRef, { 
          ...data, 
          updatedAt: serverTimestamp() 
        });
        console.log("Updated existing itinerary item:", data.id);
      } else {
        const colRef = collection(db, "itinerary", user.uid, "items");
        const newDocRef = await addDoc(colRef, { 
          ...data, 
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp() 
        });
        
        // Replace temp item with real ID
        setItems(prev => prev.map(item => 
          item.id?.startsWith('temp_') && item.name === data.name 
            ? { ...item, id: newDocRef.id, createdAt: serverTimestamp() }
            : item
        ));
        
        await trackDestinationAdded(user.uid, {
          id: newDocRef.id,
          name: data.name,
          region: data.region,
          arrival: data.arrival,
          departure: data.departure,
        });
        
        await logActivity(`Added "${data.name}" to your trip itinerary`, "📍");
        
        const snap = await getDocs(colRef);
        if (snap.size === 1) {
          await unlockAchievement(1, "First Step");
        }
        
        console.log("Created new itinerary item");
      }
    } catch (e) {
      console.error("[Itinerary] saveItem write failed:", e);
      // Rollback optimistic update on error
      const cached = itineraryCache.get(user.uid);
      if (cached) {
        setItems(cached);
      }
      alert(`Failed to save itinerary item: ${e?.code || e?.message || e}`);
    }
  };

  const toggleShareItem = (id) => {
    setShareSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleShareItinerary = async (itemIds, friendIds) => {
    if (!user) return;
    try {
      console.log("Starting share with:", { itemIds, friendIds });
      
      if (!itemIds.length) {
        alert("Please select at least one destination to share");
        return;
      }
      
      if (!friendIds.length) {
        alert("Please select at least one friend to share with");
        return;
      }
      
      const itemsToShare = items.filter(item => itemIds.includes(item.id));
      
      if (!itemsToShare.length) {
        alert("Could not find the selected destinations");
        return;
      }
      
      await shareItineraryWithFriends(user, items, itemIds, friendIds);
      
      await logActivity(
        `Shared itinerary with ${friendIds.length} friend${friendIds.length > 1 ? 's' : ''} (${itemIds.length} destination${itemIds.length > 1 ? 's' : ''})`,
        "🔗"
      );
      
      alert(`Itinerary shared with ${friendIds.length} friend${friendIds.length > 1 ? 's' : ''}!`);
      setShowShareModal(false);
      setShareSelected(new Set());
    } catch (err) {
      console.error("Share failed:", err);
      alert(`Failed to share itinerary: ${err.message || "Unknown error"}`);
    }
  };

  useEffect(() => {
    const checkMiniPlannerAchievement = async () => {
      if (!user) return;
      
      try {
        const personalCount = items.length;
        let sharedCount = 0;
        
        const sharedQuery = fsQuery(
          collection(db, "sharedItineraries"),
          where("sharedWith", "array-contains", user.uid)
        );
        const sharedSnap = await getDocs(sharedQuery);
        
        for (const docSnap of sharedSnap.docs) {
          const itemsSnap = await getDocs(
            collection(db, "sharedItineraries", docSnap.id, "items")
          );
          sharedCount += itemsSnap.size;
        }
        
        const totalDestinations = personalCount + sharedCount;
        
        if (totalDestinations >= 3) {
          await unlockAchievement(6, "Mini Planner");
        }
      } catch (error) {
        console.error("Error checking Mini Planner achievement:", error);
      }
    };
    
    checkMiniPlannerAchievement();
  }, [user, items]);

  const openExport = () => {
    setShowExport(true);
    setExportSelected(new Set(items.map(i => i.id)));
  };

  const toggleExportItem = (id) => {
    setExportSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllExport = () => {
    setExportSelected(prevSelected => {
      // If all items are already selected, deselect all
      if (prevSelected.size === items.length && items.length > 0) {
        console.log("Deselecting all");
        return new Set();
      }
      // Otherwise, select all items
      console.log("Selecting all");
      return new Set(items.map(i => i.id));
    });
  };

  const handleExport = async () => {
    const toExport = items.filter(it => exportSelected.has(it.id));
    if (!toExport.length) {
      alert("No items selected for export");
      return;
    }

    try {
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.setTextColor(99, 102, 241);
      doc.text("My Travel Itinerary", 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 14, 28);
      
      let currentY = 36;
      const pageHeight = doc.internal.pageSize.height;
      const pageWidth = doc.internal.pageSize.width;
      const margin = 14;
      const maxWidth = pageWidth - (2 * margin);

      toExport.forEach((item, itemIndex) => {
        if (currentY > pageHeight - 40) {
          doc.addPage();
          currentY = 14;
        }

        doc.setFontSize(14);
        doc.setTextColor(41, 128, 185);
        doc.setFont(undefined, "bold");
        doc.text(`${itemIndex + 1}. ${item.name || "Untitled"}`, margin, currentY);
        currentY += 7;

        if (item.region || item.location) {
          doc.setFontSize(10);
          doc.setTextColor(100, 116, 139);
          doc.setFont(undefined, "normal");
          
          if (item.region) {
            doc.text(`Region: ${item.region}`, margin + 5, currentY);
            currentY += 5;
          }
          
          if (item.location) {
            doc.text(`Location: ${item.location}`, margin + 5, currentY);
            currentY += 5;
          }
        }

        currentY += 2;

        const detailsData = [];

        if (item.arrival || item.departure) {
          detailsData.push([
            "Dates",
            `${item.arrival || "—"} to ${item.departure || "—"}`
          ]);
        }

        if (item.arrival && item.departure) {
          const days = Math.max(
            1,
            Math.ceil(
              (new Date(item.departure).getTime() - new Date(item.arrival).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          );
          detailsData.push([
            "Duration",
            `${days} day${days !== 1 ? "s" : ""}`
          ]);
        }

        detailsData.push([
          "Status",
          item.status || "Upcoming"
        ]);

        if (item.estimatedExpenditure) {
          detailsData.push([
            "Budget",
            `₱${Number(item.estimatedExpenditure).toLocaleString()}`
          ]);
        }

        if (item.transport) {
          detailsData.push([
            "Transport",
            item.transport + (item.transportNotes ? ` (${item.transportNotes})` : "")
          ]);
        }

        if (item.accomType || item.accomName) {
          const accomInfo = [];
          if (item.accomType) accomInfo.push(item.accomType);
          if (item.accomName) accomInfo.push(item.accomName);
          if (item.accomNotes) accomInfo.push(item.accomNotes);
          
          detailsData.push([
            "Accommodation",
            accomInfo.join(" | ")
          ]);
        }

        if (item.agency) {
          detailsData.push([
            "Agency",
            item.agency
          ]);
        }

        if (item.activities && item.activities.length > 0) {
          detailsData.push([
            "Activities",
            item.activities.join(", ")
          ]);
        }

        if (item.notes) {
          detailsData.push([
            "Notes",
            item.notes
          ]);
        }

        if (detailsData.length > 0) {
          autoTable(doc, {
            startY: currentY,
            head: [["Field", "Details"]],
            body: detailsData,
            theme: "grid",
            headStyles: {
              fillColor: [99, 102, 241],
              textColor: [255, 255, 255],
              fontStyle: "bold",
              fontSize: 10,
              halign: "left"
            },
            bodyStyles: {
              fontSize: 9,
              textColor: [50, 50, 50],
              halign: "left",
              cellPadding: 3
            },
            columnStyles: {
              0: {
                cellWidth: 40,
                fontStyle: "bold",
                textColor: [41, 128, 185]
              },
              1: {
                cellWidth: maxWidth - 40
              }
            },
            margin: margin
          });

          currentY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : currentY + 20;
        }

        currentY += 5;
      });

      if (toExport.length > 1) {
        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(99, 102, 241);
        doc.setFont(undefined, "bold");
        doc.text("Summary", 14, 20);

        const summaryData = [];
        
        summaryData.push(["Total Destinations", toExport.length.toString()]);

        const totalBudget = toExport.reduce((sum, item) => sum + (Number(item.estimatedExpenditure) || 0), 0);
        if (totalBudget > 0) {
          summaryData.push(["Total Estimated Budget", `₱${totalBudget.toLocaleString()}`]);
        }

        let totalDays = 0;
        toExport.forEach(item => {
          if (item.arrival && item.departure) {
            const days = Math.max(
              1,
              Math.ceil(
                (new Date(item.departure).getTime() - new Date(item.arrival).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            );
            totalDays += days;
          }
        });
        if (totalDays > 0) {
          summaryData.push(["Total Trip Duration", `${totalDays} days`]);
        }

        const statusCounts = {
          upcoming: toExport.filter(i => (i.status || "upcoming").toLowerCase() === "upcoming").length,
          ongoing: toExport.filter(i => i.status?.toLowerCase() === "ongoing").length,
          completed: toExport.filter(i => i.status?.toLowerCase() === "completed").length,
          cancelled: toExport.filter(i => i.status?.toLowerCase() === "cancelled").length,
        };

        summaryData.push([
          "Status Breakdown",
          `Upcoming: ${statusCounts.upcoming} | Ongoing: ${statusCounts.ongoing} | Completed: ${statusCounts.completed} | Cancelled: ${statusCounts.cancelled}`
        ]);

        const accommodations = toExport
          .filter(i => i.accomName || i.accomType)
          .map(i => `${i.name}: ${i.accomType || ""} ${i.accomName || ""}`.trim());
        if (accommodations.length > 0) {
          summaryData.push([
            "Accommodations Booked",
            accommodations.join("\n")
          ]);
        }

        const agencies = toExport
          .filter(i => i.agency)
          .map(i => `${i.name}: ${i.agency}`.trim());
        if (agencies.length > 0) {
          summaryData.push([
            "Travel Agencies",
            agencies.join("\n")
          ]);
        }

        autoTable(doc, {
          startY: 30,
          head: [["Metric", "Details"]],
          body: summaryData,
          theme: "grid",
          headStyles: {
            fillColor: [99, 102, 241],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 11
          },
          bodyStyles: {
            fontSize: 10,
            textColor: [50, 50, 50],
            cellPadding: 3
          },
          columnStyles: {
            0: {
              cellWidth: 50,
              fontStyle: "bold",
              textColor: [41, 128,185]
            },
            1: {
              cellWidth: maxWidth - 50
            }
          },
          margin: margin
        });
      }

      doc.save("itinerary.pdf");
      setShowExport(false);
      setExportSelected(new Set());
    } catch (error) {
      console.error("PDF Export Error:", error);
      alert(`Failed to export PDF: ${error.message || "Unknown error"}`);
    }
  };

  // ==================== OPTIMIZED: Toggle status with optimistic update ====================
  const toggleStatus = async (id) => {
    if (!user) return;
    const current = items.find((i) => i.id === id);
    if (!current) return;
    
    const statusFlow = {
      'Upcoming': 'Ongoing',
      'Ongoing': 'Completed',
      'Completed': 'Cancelled',
      'Cancelled': 'Upcoming'
    };
    
    const nextStatus = statusFlow[current.status] || 'Upcoming';
    
    // CONFIRMATION DIALOG WITH EMOJIS
    const statusEmojis = {
      'Upcoming': '🔜',
      'Ongoing': '⏳',
      'Completed': '✅',
      'Cancelled': '❌'
    };
    
    const confirmMessage = `Are you sure you want to change the status?\n\n` +
      `${statusEmojis[current.status]} Current: ${current.status}\n` +
      `${statusEmojis[nextStatus]} Next: ${nextStatus}`;
    
    if (!window.confirm(confirmMessage)) {
      return; // User cancelled
    }
    
    // Optimistic update
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, status: nextStatus } : item
    ));
    
    try {
      await updateDoc(doc(db, "itinerary", user.uid, "items", id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });

      if (nextStatus === "Completed" && current.status !== "Completed") {
        await trackDestinationCompleted(user.uid, {
          id: current.id,
          name: current.name,
          region: current.region,
          location: current.location, // ADD THIS LINE
          arrival: current.arrival,
          departure: current.departure,
        });
        
        try {
          await unlockAchievement(8, "Checklist Champ");
        } catch (error) {
          console.error("Error unlocking Checklist Champ achievement:", error);
        }
      } else if (current.status === "Completed" && nextStatus !== "Completed") {
        await trackDestinationUncompleted(user.uid, {
          id: current.id,
          name: current.name,
                   region: current.region,
          location: current.location,
        });
      }
    } catch (e) {
      console.error("Toggle status failed:", e);
      // Rollback on error
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, status: current.status } : item
      ));
      alert("Failed to update status. Please try again.");
    }
  };

  // ==================== OPTIMIZED: Remove with optimistic update ====================
  const removeItem = async (id) => {
    if (!user) return;
    if (!window.confirm("Remove this destination?")) return;
    
    const itemToRemove = items.find((i) => i.id === id);
    
    // Optimistic update
    setItems(prev => prev.filter(item => item.id !== id));
    
    try {
      await deleteDoc(doc(db, "itinerary", user.uid, "items", id));
      
      if (itemToRemove) {
        await trackDestinationRemoved(
          user.uid,
          {
            id: itemToRemove.id,
            name: itemToRemove.name,
            region: itemToRemove.region,
          },
          itemToRemove.status === "Completed"
        );
      }
    } catch (e) {
      console.error("Remove failed:", e);
      // Rollback on error
      if (itemToRemove) {
        setItems(prev => [...prev, itemToRemove]);
      }
    }
  };

  // ==================== OPTIMIZED: Batch operations ====================
  const markAllComplete = async () => {
    if (!user || !items.length) return;
    
    // Optimistic update
    const previousItems = [...items];
    setItems(prev => prev.map(item => ({ ...item, status: "Completed" })));
    
    try {
      const promises = items.map(async (it) => {
        await updateDoc(doc(db, "itinerary", user.uid, "items", it.id), {
          status: "Completed",
          updatedAt: serverTimestamp(),
        });
        
        if (it.status !== "Completed") {
          await trackDestinationCompleted(user.uid, {
            id: it.id,
            name: it.name,
            region: it.region,
            location: it.location, // ADD THIS LINE
            arrival: it.arrival,
            departure: it.departure,
          });
        }
      });
      
      await Promise.all(promises);
      console.log("[Itinerary] Marked all complete for", user.uid);
      
      try {
        await unlockAchievement(8, "Checklist Champ");
      } catch (error) {
        console.error("Error unlocking Checklist Champ achievement:", error);
      }
    } catch (e) {
      console.error("Mark All Complete failed:", e);
      // Rollback on error
      setItems(previousItems);
      alert("Failed to mark all complete. Please try again.");
    }
  };

  const clearAll = async () => {
    if (!user || !items.length) return;
    if (!window.confirm("Clear ALL destinations? This cannot be undone.")) return;
    
    // Optimistic update
    const previousItems = [...items];
    setItems([]);
    itineraryCache.clear();
    
    try {
      await Promise.all(
        previousItems.map((it) => deleteDoc(doc(db, "itinerary", user.uid, "items", it.id)))
      );
      console.log("[Itinerary] Cleared all for", user.uid);
    } catch (e) {
      console.error("Clear All failed:", e);
      // Rollback on error
      setItems(previousItems);
      itineraryCache.set(previousItems, user.uid);
      alert("Failed to clear all. Please try again.");
    }
  };

  const onAddToTrip = async (dest) => {
    const u = auth.currentUser;
    if (!u) { alert('Please sign in to add to My Trips.'); return; }
    setAddingTripId(dest.id);
    try {
      // Prepare the destination object with all required fields INCLUDING LOCATION
      const destinationData = {
        id: dest.id,
        name: dest.name || '',
        display_name: dest.name || '', // Itinerary expects display_name
        region: dest.region || dest.locationRegion || '',
        location: dest.location || '', // ADD THIS - Include location
        description: dest.description || '',
        lat: dest.lat || dest.latitude,
        lon: dest.lon || dest.longitude,
        place_id: dest.place_id || dest.id,
        rating: dest.rating || 0,
        price: dest.price || '',
        priceTier: dest.priceTier || null,
        tags: Array.isArray(dest.tags) ? dest.tags : [],
        categories: Array.isArray(dest.categories) ? dest.categories : [],
        bestTime: dest.bestTime || dest.best_time || '',
        image: dest.image || '',
      };

      await addTripForCurrentUser(destinationData);
      
      // Track destination added to itinerary
      await trackDestinationAdded(u.uid, {
        id: dest.id,
        name: dest.name,
        region: dest.region,
        location: dest.location, // ALSO ADD HERE
        latitude: dest.lat || dest.latitude,
        longitude: dest.lon || dest.longitude,
      });
      
      // Log activity for adding to trip
      await logActivity(`Added "${dest.name}" to your trip itinerary`, "🗺️");
      
      setAddedTripId(dest.id);
      setTimeout(() => setAddedTripId(null), 1200);

      // parse estimated expenditure from price and save to users/{uid}/trips
      const parseEstimatedFromPrice = (p) => {
        if (p == null) return 0;
        if (typeof p === "number") return p;
        const s = String(p).replace(/\s/g, "").replace(/₱/g, "").replace(/,/g, "");
        const nums = s.match(/\d+/g);
        if (!nums || nums.length === 0) return 0;
        const numbers = nums.map(Number).filter(Number.isFinite);
        const sum = numbers.reduce((a, b) => a + b, 0);
        return Math.round(sum / numbers.length);
      };
      const estimated = parseEstimatedFromPrice(dest?.price ?? dest?.priceTier ?? dest?.estimatedExpenditure ?? dest?.budget);

      try {
        await setDoc(
          doc(db, 'users', u.uid, 'trips', String(dest.id)),
          {
            destId: String(dest.id),
            name: dest.name || '',
            region: dest.region || dest.locationRegion || '',
            location: dest.location || '', // ADD THIS - Save location to trips collection too
            rating: dest.rating ?? null,
            price: dest.price || '',
            priceTier: dest.priceTier || null,
            estimatedExpenditure: estimated,
            tags: Array.isArray(dest.tags) ? dest.tags : [],
            categories: Array.isArray(dest.categories) ? dest.categories : [],
            bestTime: dest.bestTime || dest.best_time || '',
            image: dest.image || '',
            addedBy: u.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('users/{uid}/trips write skipped:', e.code || e.message);
      }
    } catch (e) {
      console.error('Failed to add to My Trips:', e);
      alert(`Failed to add to My Trips: ${e.message || 'Unknown error'}`);
    } finally {
      setAddingTripId(null);
    }
  };

  return (
    <div className="itn-page">
      {/* Animated background layers */}
      <div className="itn-bg-dots" />
      <div className="itn-bg-wave" />
      <div className="itn-bg-circle c1" />
      <div className="itn-bg-circle c2" />
      <div className="itn-bg-circle c3" />
      <div className="itn-bg-circle c4" />
      <div className="itn-bg-shapes">
        <div className="itn-bg-shape s1" />
        <div className="itn-bg-shape s2" />
        <div className="itn-bg-shape s3" />
      </div>

      <div className="itn-hero">
        <div className="itn-hero-title">🗺️ My Travel Itineraries</div>
        <div className="itn-hero-sub">Plan, organize, and share your perfect journey</div>
        <div className="itn-hero-actions">
          <button 
            className="itn-btn ghost"
            onClick={() => setShowShareModal(true)} 
            disabled={!items.length}
            title={!items.length ? "No itineraries to share" : "Share with friends"}
          >
             Share Itinerary
          </button>
          <button 
            className="itn-btn ghost"
            onClick={openExport}
            disabled={!items.length}
            title={!items.length ? "No items to export" : "Export to PDF"}
          >
             Export PDF
          </button>
          <button 
            className="itn-btn ghost"
            onClick={markAllComplete}
            disabled={!items.length}

          >
             Mark All Complete
          </button>
          <button 
            className="itn-btn ghost"
            onClick={clearAll}
            disabled={!items.length}
          >
             Clear All
          </button>
        </div>
      </div>

      <div className="itn-container-full">
        {/* Itinerary Section - Full Width */}
        <section className="itn-itinerary-full">
          <div className="itn-tabs">
            <div 
              className={`itn-tab ${activeTab === 'personal' ? 'active' : ''}`} 
              onClick={() => setActiveTab('personal')}
            >
              📋 My Itineraries
              {items.length > 0 && <span style={{ marginLeft: 8, fontWeight: 800 }}>({items.length})</span>}
            </div>
            <div 
              className={`itn-tab ${activeTab === 'shared' ? 'active' : ''}`}
              onClick={() => setActiveTab('shared')}
            >
              👥 Shared With Me
              {sharedWithMe.length > 0 && <span style={{ marginLeft: 8, fontWeight: 800 }}>({sharedWithMe.length})</span>}
            </div>
          </div>
          
          <div className="itn-panel itn-panel-full-width">
            {activeTab === 'personal' ? (
              <>
                {/* Filter Status */}
                {items.length > 0 && (
                  <div style={{
                    display: 'flex',
                    gap: 12,
                    marginBottom: 20,
                    padding: '16px 20px',
                    background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
                    borderRadius: '14px',
                    border: '2px solid #e5e7eb',
                    alignItems: 'center'
                  }}>
                    <label style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>
                      🔽 Filter by Status:
                    </label>
                    <select
                      className="itn-input"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      style={{
                        fontSize: 14,
                        padding: '10px 14px',
                        background: '#fff',
                        flex: 1,
                        maxWidth: 300
                      }}
                    >
                      <option value="all">All ({items.length})</option>
                      <option value="upcoming">🔜 Upcoming ({items.filter(i => (i.status || 'upcoming').toLowerCase() === 'upcoming').length})</option>
                      <option value="ongoing">⏳ Ongoing ({items.filter(i => i.status?.toLowerCase() === 'ongoing').length})</option>
                      <option value="completed">✅ Completed ({items.filter(i => i.status?.toLowerCase() === 'completed').length})</option>
                      <option value="cancelled">❌ Cancelled ({items.filter(i => i.status?.toLowerCase() === 'cancelled').length})</option>
                    </select>
                  </div>
                )}

                {/* Itinerary Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {!items.length ? (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '60px 20px',
                      textAlign: 'center',
                      background: 'linear-gradient(135deg, rgba(108, 99, 255, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)',
                      borderRadius: '20px',
                      border: '2px dashed rgba(108, 99, 255, 0.3)',
                      minHeight: '400px',
                      gap: '24px'
                    }}>
                      <div style={{
                        fontSize: '80px',
                        animation: 'float 3s ease-in-out infinite'
                      }}>
                        ✈️
                      </div>
                      
                      <div>
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
                          margin: '0 0 8px 0',
                          lineHeight: '1.6'
                        }}>
                          Start building your perfect journey! Browse destinations and add them to your itinerary.
                        </p>
                        <p style={{
                          fontSize: '13px',
                          color: '#94a3b8',
                          margin: 0
                        }}>
                          Once you add destinations, you'll be able to organize, plan, and share your trips.
                        </p>
                      </div>

                      <button
                        onClick={() => window.location.href = '/bookmark2'}
                        style={{
                          padding: '14px 32px',
                          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '12px',
                          fontWeight: '700',
                          fontSize: '15px',
                          cursor: 'pointer',
                          transition: 'all 0.3s',
                          boxShadow: '0 4px 12px rgba(99, 102,241, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          margin: '0 auto'
                        }}
                        onMouseEnter={(e) => {
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
                        }}
                      >
                        <span style={{ fontSize: '18px' }}>🗺️</span>
                        Explore Destinations
                      </button>
                    </div>
                  ) : (
                    items
                      .filter(item => filterStatus === 'all' || (item.status || 'upcoming').toLowerCase() === filterStatus.toLowerCase())
                      .map((item, index) => (
                        <DestinationCard
                          key={item.id}
                          item={item}
                          index={index}
                          onEdit={(it) => setEditing(it)}
                          onRemove={removeItem}
                          onToggleStatus={toggleStatus}
                          setEditing={setEditing}
                        />
                      ))
                  )}
                </div>
              </>
            ) : (
              <SharedItinerariesTab user={user} />
            )
          }
          </div>
        </section>
      </div>
      
      {/* Modals remain the same */}
      {editing && (
        <EditDestinationModal
          initial={editing}
          onSave={saveItem}
          onClose={() => setEditing(null)}
        />

      )}

      {showExport && (
        <ExportPDFModal
          items={items}
          selected={exportSelected}
          onToggle={toggleExportItem}
          onSelectAll={selectAllExport}
          onExport={handleExport}
          onClose={() => setShowExport(false)}
        />
      )}

      {showShareModal && (
        <ShareItineraryModal
          items={items}
          friends={friends}
          selected={shareSelected}
          onToggleItem={toggleShareItem}
          onShare={handleShareItinerary}
          onClose={() => {
            setShowShareModal(false);
            setShareSelected(new Set());
          }}
        />
      )}
    </div>
  );
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