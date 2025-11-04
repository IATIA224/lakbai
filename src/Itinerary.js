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
import { SuggestionView } from "./ItinerarySuggestion";

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

  const addActivity = React.useCallback(() => {
    const v = form.activityDraft.trim();
    if (!v) return;
    setForm((f) => ({ ...f, activities: [...f.activities, v], activityDraft: "" }));
  }, [form.activityDraft]);
  
  const removeActivity = (i) =>
    setForm((f) => ({ ...f, activities: f.activities.filter((_, idx) => idx !== i) }));

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
    } catch (e) {
      setNotif("Failed to update itinerary item.");
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
  };

  const handleSelectAgency = (agency) => {
    setForm(prev => ({
      ...prev,
      agency: `${agency.name} - ${agency.phone || ''} ${agency.website || ''}`.trim(),
    }));
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

  // CHANGED: Render SuggestionView directly to body with proper structure
  const modalContent = (
    <SuggestionView 
      item={initial} 
      onClose={onClose}
      onSelectHotel={handleSelectHotel}
      onSelectAgency={handleSelectAgency}
    >
      <div className="itn-modal" onClick={(e) => e.stopPropagation()}>
        <div className="itn-modal-header">
          <div className="itn-modal-title">Edit Destination Details</div>
          <button className="itn-close" onClick={onClose}>×</button>
        </div>

        <div className="itn-modal-body">
          <div className="itn-form-grid">
            <div className="itn-form-col">
              <div className="itn-grid">
                <label className="itn-field">
                  <span className="itn-label">Destination Name</span>
                  <input
                    className="itn-input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="City or place name (required)"
                    required
                  />
                </label>
                <label className="itn-field">
                  <span className="itn-label">Country/Region</span>
                  <input
                    className="itn-input"
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                    placeholder="Region (e.g., Metro Manila)"
                  />
                </label>
                <label className="itn-field">
                  <span className="itn-label">Location</span>
                  <input
                    className="itn-input"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="Full address or location"
                  />
                </label>
              </div>

              <div className="itn-grid">
                <label className="itn-field">
                  <span className="itn-label">Arrival Date</span>
                  <input
                    type="date"
                    className="itn-input"
                    value={form.arrival}
                    onChange={(e) => setForm({ ...form, arrival: e.target.value })}
                  />
                </label>
                <label className="itn-field">
                  <span className="itn-label">Departure Date</span>
                  <input
                    type="date"
                    className="itn-input"
                    value={form.departure}
                    onChange={(e) => setForm({ ...form, departure: e.target.value })}
                  />
                </label>
                <label className="itn-field">
                  <span className="itn-label">Trip Status</span>
                  <select
                    className="itn-input"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option>Upcoming</option>
                    <option>Ongoing</option>
                    <option>Completed</option>
                    <option>Cancelled</option>
                  </select>
                </label>
              </div>

              <div className="itn-grid">
                <label className="itn-field">
                  <span className="itn-label">Estimated Expenditure (₱)</span>
                  <input
                    className="itn-input"
                    type="number"
                    value={form.estimatedExpenditure}
                    onChange={(e) => setForm({ ...form, estimatedExpenditure: e.target.value })}
                  />
                </label>
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
                  <button className="itn-btn primary" onClick={addActivity}>
                    Add Activity
                  </button>
                </div>
                {form.activities.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {form.activities.map((act, i) => (
                      <div
                        key={i}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "linear-gradient(90deg, #a084ee 60%, #6c63ff 100%)",
                          color: "#fff",
                          borderRadius: 16,
                          padding: "4px 12px",
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        <span>{act}</span>
                        <button
                          onClick={() => removeActivity(i)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#fff",
                            cursor: "pointer",
                            fontSize: 16,
                            lineHeight: 1,
                            padding: 0,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
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
                    value={form.accomType}
                    onChange={(e) => setForm({ ...form, accomType: e.target.value })}
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
                    value={form.accomName}
                    onChange={(e) => setForm({ ...form, accomName: e.target.value })}
                  />
                </div>
                <textarea
                  rows={2}
                  className="itn-input"
                  placeholder="Address, booking details, special notes..."
                  value={form.accomNotes}
                  onChange={(e) => setForm({ ...form, accomNotes: e.target.value })}
                />
              </div>

              <div className="itn-field">
                <span className="itn-label">Transport</span>
                <div className="itn-grid-2">
                  <select
                    className="itn-input"
                    value={form.transport}
                    onChange={(e) => setForm({ ...form, transport: e.target.value })}
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
                  placeholder="Transport notes..."
                  value={form.transportNotes}
                  onChange={(e) => setForm({ ...form, transportNotes: e.target.value })}
                />
              </div>

              <div className="itn-field">
                <span className="itn-label">Additional Notes</span>
                <textarea
                  rows={3}
                  className="itn-input"
                  placeholder="Any other important details..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div className="itn-field">
                <span className="itn-label">Travel Agency</span>
                <input
                  className="itn-input"
                  placeholder="Agency name or details"
                  value={form.agency}
                  onChange={(e) => setForm({ ...form, agency: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="itn-modal-footer">
          <button className="itn-btn ghost" onClick={onClose}>Cancel</button>
          <button className="itn-btn primary" onClick={handleSave}>Save Details</button>
        </div>

        {notif && (
          <div
            style={{
              position: "fixed",
              top: 20,
              right: 20,
              background: "#6c63ff",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: 8,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              zIndex: 10000,
            }}
          >
            {notif}
          </div>
        )}
      </div>
    </SuggestionView>
  );

  // Render to body using Portal
  return ReactDOM.createPortal(modalContent, document.body);
}

function DestinationCard({ item, index, onEdit, onRemove, onToggleStatus, setEditing }) {
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showHotels, setShowHotels] = useState(false);
  const [showCostEstimation, setShowCostEstimation] = useState(false);
  const [showAgency, setShowAgency] = useState(false); // ADD THIS
  const [showToolsMenu, setShowToolsMenu] = useState(false); // ADD THIS

  // NEW: Update CSV modal state
  const [showUpdateCsv, setShowUpdateCsv] = useState(false);
  
  // ADD THIS - Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowToolsMenu(false);
    if (showToolsMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showToolsMenu]);

  // NEW: Add/remove a class to body when summary is open to prevent background scroll
  useEffect(() => {
    if (showSummary) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
  }, [showSummary]);

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

  // Pick a color class based on index (cycle through 5 colors)
  const colorClass = `color-${index % 5}`;
  const statColors = [
    "stat-color-0",
    "stat-color-1",
    "stat-color-2",
    "stat-color-3",
    "stat-color-4"
  ];

  return (
    <>
      <div className={`itn-card ${colorClass}`} style={{ overflow: 'visible' }}>
        <div className="itn-card-head">
          <div className="itn-card-title">
            <span className="itn-step">{index + 1}</span>
            <div>
              <div className="itn-name">{item.name || "Destination"}</div>
              <div className="itn-sub">{item.region}</div>
              {/* ADD THIS - Show location below region */}
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
          <div className="itn-actions">
            <span className={`itn-badge ${item.status.toLowerCase()}`}>{item.status}</span>
            <button className="itn-btn" onClick={() => onToggleStatus(item.id)}>Toggle Status</button>
            <button className="itn-btn" onClick={() => onEdit(item)}>Edit</button>
            <button className="itn-btn danger" onClick={() => onRemove(item.id)}>Remove</button>
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

          {/* Agency is TEAL (distinct color from Stay) */}
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

        {/* REPLACE the buttons section with this Tools dropdown */}
        <div style={{ 
          textAlign: "right", 
          marginTop: 12, 
          display: "flex", 
          gap: 8, 
          justifyContent: "flex-end",
          position: "relative",
          zIndex: 10
        }}>
          <button
            className="itn-btn primary"
            onClick={(e) => {
              e.stopPropagation();
              setShowToolsMenu(!showToolsMenu);
            }}
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 6,
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              color: "#fff",
              border: "none",
              padding: "10px 18px",
              borderRadius: "10px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: showToolsMenu ? "0 4px 12px rgba(99, 102, 241, 0.3)" : "none"
            }}
          >
            🛠️ Tools
            <span style={{ 
              fontSize: "10px",
              transform: showToolsMenu ? "rotate(0deg)" : "rotate(180deg)", // CHANGED: Flip rotation
              transition: "transform 0.2s"
            }}>▲</span> {/* CHANGED: Changed from ▼ to ▲ */}
          </button>

          {/* Tools Dropdown Menu - CHANGED: Now opens upward */}
          {showToolsMenu && (
            <div 
              className="itn-tools-menu"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                bottom: "calc(100% + 8px)", // CHANGED: from 'top' to 'bottom'
                right: 0,
                background: "#fff",
                border: "2px solid #6366f1",
                borderRadius: 12,
                boxShadow: "0 10px 40px rgba(99, 102, 241, 0.25)",
                zIndex: 9999,
                minWidth: 240,
                overflow: "hidden",
                animation: "slideUp 0.2s ease-out" // CHANGED: from slideDown to slideUp
              }}
            >
              <button
                onClick={() => {
                  setShowSummary(true);
                  setShowToolsMenu(false);
                }}
                className="itn-tools-menu-item"
              >
                <span style={{ fontSize: "18px" }}>📋</span>
                <span>View Summary</span>
              </button>

              <button
                onClick={() => {
                  setShowCostEstimation(true);
                  setShowToolsMenu(false);
                }}
                className="itn-tools-menu-item"
              >
                <span style={{ fontSize: "18px" }}>🚗</span>
                <span>Estimate Transport Cost</span>
              </button>

              <button
                onClick={() => {
                  setShowHotels(true);
                  setShowToolsMenu(false);
                }}
                className="itn-tools-menu-item"
              >
                <span style={{ fontSize: "18px" }}>🏨</span>
                <span>View Accredited Hotels</span>
              </button>

              <div style={{ 
                height: "1px", 
                background: "linear-gradient(90deg, transparent, #e5e7eb, transparent)",
                margin: "4px 0"
              }}></div>

              <button
                onClick={() => {
                  setShowAgency(true);
                  setShowToolsMenu(false);
                }}
                className="itn-tools-menu-item"
              >
                <span style={{ fontSize: "18px" }}>✈️</span>
                <span>Travel Agencies</span>
              </button>

              {/* NEW: Update CSV menu item */}
              <button
                onClick={() => {
                  setShowUpdateCsv(true);
                  setShowToolsMenu(false);
                }}
                className="itn-tools-menu-item"
              >
                <span style={{ fontSize: "18px" }}>🗄️</span>
                <span>Update CSV</span>
              </button>
            </div>
          )}
        </div>
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

      {showHotels && (
        <ItineraryHotelsModal
          open={showHotels}
          onClose={() => setShowHotels(false)}
          onSelect={(hotel) => {
            setShowHotels(false);
            setEditing({
              ...item,
              accomType: hotel.type,
              accomName: hotel.name,
              accomNotes: hotel.address,
            });
          }}
        />
      )}

      {/* ADD THIS - Travel Agency Modal (guarded) */}
      {showAgency &&
        (typeof ItineraryAgencyModal === "function" ? (
          <ItineraryAgencyModal
            open={showAgency}
            onClose={() => setShowAgency(false)}
            onSelect={(agency) => {
              setShowAgency(false);
              setEditing({
                ...item,
                transportNotes: `${agency.name} - ${agency.phone || ""} ${
                  agency.website || ""
                }`.trim(),
              });
            }}
          />
        ) : (
          ReactDOM.createPortal(
            <div className="itn-modal-backdrop" onClick={() => setShowAgency(false)}>
              <div className="itn-modal itn-modal-md" onClick={(e) => e.stopPropagation()}>
                <div className="itn-modal-header">
                  <div className="itn-modal-title">Travel Agencies</div>
                  <button className="itn-close" onClick={() => setShowAgency(false)}>×</button>
                </div>
                <div className="itn-modal-body">
                  <div style={{ padding: 12, color: "#374151" }}>
                    Travel agency UI is currently unavailable (component not found).
                  </div>
                </div>
                <div className="itn-modal-footer">
                  <button className="itn-btn ghost" onClick={() => setShowAgency(false)}>Close</button>
                </div>
              </div>
            </div>,
            document.body
          )
        )
      )}

      {/* NEW: Update CSV modal - mounts UpdateCSV component inside existing modal UI (guarded) */}
      {showUpdateCsv && (
        typeof UpdateCSV === "function" ? (
          ReactDOM.createPortal(
            <div className="itn-modal-backdrop" onClick={() => setShowUpdateCsv(false)}>
              <div className="itn-modal itn-modal-md" onClick={(e) => e.stopPropagation()}>
                <div className="itn-modal-header">
                  <div className="itn-modal-title">Update CSV</div>
                  <button className="itn-close" onClick={() => setShowUpdateCsv(false)}>×</button>
                </div>
                <div className="itn-modal-body" style={{ maxHeight: '60vh', overflow: 'auto' }}>
                  <UpdateCSV />
                </div>
                <div className="itn-modal-footer">
                  <button className="itn-btn ghost" onClick={() => setShowUpdateCsv(false)}>Close</button>
                </div>
              </div>
            </div>,
            document.body
          )
        ) : (
          ReactDOM.createPortal(
            <div className="itn-modal-backdrop" onClick={() => setShowUpdateCsv(false)}>
              <div className="itn-modal itn-modal-md" onClick={(e) => e.stopPropagation()}>
                <div className="itn-modal-header">
                  <div className="itn-modal-title">Update CSV</div>
                  <button className="itn-close" onClick={() => setShowUpdateCsv(false)}>×</button>
                </div>
                <div className="itn-modal-body">
                  <div style={{ padding: 12, color: "#374151" }}>
                    Update CSV UI is not available — the UpdateCSV component could not be imported.
                    Check ./updatecsv.js exports (should be "export default UpdateCSV").
                  </div>
                </div>
                <div className="itn-modal-footer">
                  <button className="itn-btn ghost" onClick={() => setShowUpdateCsv(false)}>Close</button>
                </div>
              </div>
            </div>,
            document.body
          )
        )
      )}
    </>
  );
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
          <div className="itn-modal-title">📋 Trip Summary</div>
          <button className="itn-close" onClick={onClose}>×</button>
        </div>

        <div className="itn-modal-body" style={{ flex: 1, overflowY: 'auto' }}>
          <div className="itn-summary-content">
            <div className="itn-summary-section">
              <h3 className="itn-summary-heading">📍 Destination</h3>
              <div className="itn-summary-item">
                <strong>{item.name}</strong>
                {item.region && <span className="itn-summary-region">{item.region}</span>}
              </div>
              {item.location && (
                <div className="itn-summary-item" style={{ marginTop: '12px' }}>
                  <span className="itn-summary-label" style={{ color: '#64748b', fontSize: '0.9rem' }}>
                    📌 Location: 
                  </span>
                  <span style={{ marginLeft: '8px', color: '#475569' }}>
                    {item.location}
                  </span>
                </div>
              )}
            </div>

            {(item.arrival || item.departure) && (
              <div className="itn-summary-section">
                <h3 className="itn-summary-heading">📅 Travel Dates</h3>
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
                <h3 className="itn-summary-heading">💰 Budget</h3>
                <div className="itn-summary-item">
                  <span className="itn-summary-amount">
                    ₱{Number(item.estimatedExpenditure).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {item.activities && item.activities.length > 0 && (
              <div className="itn-summary-section">
                <h3 className="itn-summary-heading">🎯 Activities</h3>
                <div className="itn-summary-tags">
                  {item.activities.map((activity, idx) => (
                    <span key={idx} className="itn-summary-tag">{activity}</span>
                  ))}
                </div>
              </div>
            )}

            {(item.accomType || item.accomName) && (
              <div className="itn-summary-section">
                <h3 className="itn-summary-heading">🏨 Accommodation</h3>
                <div className="itn-summary-item">
                  {item.accomType && <span className="itn-summary-badge">{item.accomType}</span>}
                  {item.accomName && <strong>{item.accomName}</strong>}
                  {item.accomNotes && <p className="itn-summary-notes">{item.accomNotes}</p>}
                </div>
              </div>
            )}

            {item.transport && (
              <div className="itn-summary-section">
                <h3 className="itn-summary-heading">🚗 Transportation</h3>
                <div className="itn-summary-item">
                  <span className="itn-summary-badge">{item.transport}</span>
                  {item.transportNotes && <p className="itn-summary-notes">{item.transportNotes}</p>}
                </div>
              </div>
            )}

            {item.agency && (
              <div className="itn-summary-section">
                <h3 className="itn-summary-heading">✈️ Agency</h3>
                <div className="itn-summary-item">
                  <p className="itn-summary-notes">{item.agency}</p>
                </div>
              </div>
            )}

            {item.notes && (
              <div className="itn-summary-section">
                <h3 className="itn-summary-heading">📝 Notes</h3>
                <div className="itn-summary-item">
                  <p className="itn-summary-notes">{item.notes}</p>
                </div>
              </div>
            )}

            <div className="itn-summary-section">
              <h3 className="itn-summary-heading">✅ Status</h3>
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
  const modalContent = (
    <div className="itn-modal-backdrop" onClick={onClose}>
      <div className="itn-modal itn-modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="itn-modal-header">
          <div className="itn-modal-title">📄 Export to PDF</div>
          <button className="itn-close" onClick={onClose}>×</button>
        </div>

        <div className="itn-modal-body">
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ margin: 0, color: "#64748b" }}>
              Select destinations to export ({selected.size} of {items.length} selected)
            </p>
            <button className="itn-btn ghost" onClick={onSelectAll}>
              {selected.size === items.length ? "Deselect All" : "Select All"}
            </button>
          </div>

          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            {items.map((item) => (
              <div
                key={item.id}
                className={`itn-export-item ${selected.has(item.id) ? "selected" : ""}`}
                onClick={() => onToggle(item.id)}
              >
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => onToggle(item.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: 14, color: "#64748b" }}>{item.region}</div>
                  {/* Show more details for export */}
                  <div style={{ fontSize: 13, color: "#888" }}>
                    {item.arrival && <>Arrival: {item.arrival} &nbsp;</>}
                    {item.departure && <>Departure: {item.departure} &nbsp;</>}
                    {item.status && <>Status: {item.status} &nbsp;</>}
                    {item.estimatedExpenditure && <>Budget: ₱{Number(item.estimatedExpenditure).toLocaleString()} &nbsp;</>}
                    {item.activities && item.activities.length > 0 && (
                      <>Activities: {item.activities.join(", ")} &nbsp;</>
                    )}
                    {item.location && <>Location: {item.location} &nbsp;</>}
                  </div>
                </div>
                <span className={`itn-badge ${item.status.toLowerCase()}`}>{item.status}</span>
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

  // Render to body using Portal
  return ReactDOM.createPortal(modalContent, document.body);
}

export default function Itinerary() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);

  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);

  const [showExport, setShowExport] = useState(false);
  const [exportSelected, setExportSelected] = useState(new Set());
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareSelected, setShareSelected] = useState(new Set());
  const [activeTab, setActiveTab] = useState("personal");

  const [addingTripId, setAddingTripId] = useState(null);
  const [addedTripId, setAddedTripId] = useState(null);

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
    setExportSelected(new Set(items.map(i => i.id)));
  };

  const handleExport = async () => {
    const toExport = items.filter(it => exportSelected.has(it.id));
    if (!toExport.length) {
      alert("No items selected for export");
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("My Itinerary", 14, 20);

    // Improved table data with more details
    const tableData = toExport.map(item => [
      item.name || "",
      item.region || "",
      item.location || "",
      item.arrival || "",
      item.departure || "",
      item.status || "",
      `₱${Number(item.estimatedExpenditure || 0).toLocaleString()}`,
      (item.activities && item.activities.length > 0) ? item.activities.join(", ") : ""
    ]);

    autoTable(doc, {
      head: [["Destination", "Region", "Location", "Arrival", "Departure", "Status", "Budget (₱)", "Activities"]],
      body: tableData,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 9 }
    });

    doc.save("itinerary.pdf");
    setShowExport(false);
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
          location: current.location,
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
            🔗 Share Itinerary
          </button>
          <button 
            className="itn-btn ghost"
            onClick={openExport}
            disabled={!items.length}
            title={!items.length ? "No items to export" : "Export to PDF"}
          >
            📄 Export PDF
          </button>
          <button 
            className="itn-btn ghost"
            onClick={markAllComplete}
            disabled={!items.length}
          >
            ✅ Mark All Complete
          </button>
          <button 
            className="itn-btn ghost"
            onClick={clearAll}
            disabled={!items.length}
          >
            🗑️ Clear All
          </button>
        </div>
      </div>

      {/* UPDATED: Removed left panel with map, single column layout */}
      <div className="itn-container-full">
        {/* Quick Search Section */}
        <section className="itn-search-section">
          <div className="itn-panel">
            <div className="itn-panel-title">
              <span>🔍</span>
              Quick Add Destination
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input
                className="itn-input"
                placeholder="Search for destinations (e.g., Boracay, Palawan, Cebu)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
                style={{ flex: 1 }}
              />
              <button
                className="itn-btn primary"
                onClick={onSearch}
                disabled={searching}
              >
                {searching ? "🔄 Searching..." : "🔍 Search"}
              </button>
            </div>

            {/* Search Results Grid */}
            {results.length > 0 && (
              <div className="itn-search-results">
                <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 600, color: '#64748b' }}>
                  Found {results.length} result{results.length !== 1 ? 's' : ''}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                  {results.map((result, idx) => (
                    <div
                      key={idx}
                      className={`itn-search-result-card ${selected?.place_id === result.place_id ? 'selected' : ''}`}
                      onClick={() => setSelected(result)}
                      style={{
                        padding: 14,
                        border: selected?.place_id === result.place_id ? '2px solid #6c63ff' : '2px solid #e5e7eb',
                        borderRadius: 12,
                        cursor: 'pointer',
                        background: selected?.place_id === result.place_id ? '#f0f0ff' : '#fff',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ fontSize: 18, marginBottom: 8 }}>📍</div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>
                        {result.display_name?.split(",")[0] || result.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {result.display_name?.split(",").slice(1, 2).join(",").trim()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Place Card */}
            {selected && results.length === 0 && (
              <div style={{
                background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
                border: "2px solid #6c63ff",
                borderRadius: 14,
                padding: "18px",
                marginTop: 12,
                boxShadow: "0 4px 16px rgba(108, 99, 255, 0.15)",
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16
              }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>
                    {selected.display_name?.split(",")[0] || selected.name}
                  </div>
                  <div style={{ fontSize: 14, color: "#64748b" }}>
                    {selected.display_name?.split(",").slice(1).join(",").trim()}
                  </div>
                </div>
                <button 
                  className="itn-btn success" 
                  onClick={openAddModal}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  ➕ Add to Itinerary
                </button>
              </div>
            )}
          </div>
        </section>

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
                    borderRadius: 14,
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
                    <div className="itn-empty">
                      <div className="itn-empty-icon">🧳</div>
                      <div className="itn-empty-title">No destinations planned yet</div>
                      <div className="itn-muted">
                        Search for places above to start building your dream itinerary!
                      </div>
                      <button 
                        className="itn-btn primary"
                        onClick={() => document.querySelector('.itn-input')?.focus()}
                        style={{ marginTop: 16 }}
                      >
                        🔍 Start Searching
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

// Add these named exports near the bottom (outside components) so "My Trips" UI can call them.
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