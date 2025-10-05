import React, { useEffect, useRef, useState, useMemo } from "react";
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
  query as fsQuery,  // Keep this alias
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
import {
  trackDestinationAdded,
  trackDestinationCompleted,
  trackDestinationUncompleted,
  trackDestinationRemoved,
} from "./itinerary_Stats";

// Add this helper function after the imports
async function logActivity(text, icon = "🔵") {
  try {
    const user = auth.currentUser;
    if (!user) return;

    await addDoc(collection(db, "activities"), {
      userId: user.uid,
      text,
      icon,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

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

  // Allow Enter to add activity and Esc to close
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

  return (
    <div className="itn-modal-backdrop" onClick={onClose}>
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
                    placeholder="City or place name"
                  />
                </label>
                <label className="itn-field">
                  <span className="itn-label">Country/Region</span>
                  <input
                    className="itn-input"
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                    placeholder="Region"
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
                  <span className="itn-label">Estimated Expenditure ($)</span>
                  <input
                    className="itn-input"
                    type="number"
                    value={form.estimatedExpenditure}
                    onChange={(e) => setForm({ ...form, estimatedExpenditure: e.target.value })}
                  />
                </label>
              </div>

              {/* Activities Section - RESTORED */}
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
    </div>
  );
}

function DestinationCard({ item, index, onEdit, onRemove, onToggleStatus, setEditing }) {
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showHotels, setShowHotels] = useState(false);
  const [showCostEstimation, setShowCostEstimation] = useState(false); // <-- Add state
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
    <div className="itn-card">
      <div className="itn-card-head">
        <div className="itn-card-title">
          <span className="itn-step">{index + 1}</span>
          <div>
            <div className="itn-name">{item.name || "Destination"}</div>
            <div className="itn-sub">{item.region}</div>
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
            <div>${Number(item.estimatedExpenditure ?? item.budget ?? 0).toLocaleString()}</div>
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

      {/* View Summary + View Cost Estimation + View Accredited Hotels buttons */}
      <div style={{ textAlign: "right", marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          className="itn-btn ghost"
          onClick={() => setShowSummary(true)}
        >
          View Summary
        </button>
        <button
          className="itn-btn ghost"
          onClick={() => setShowCostEstimation(true)}
          title="Estimate transportation cost"
        >
          Estimate Transport Cost
        </button>
        <button
          className="itn-btn ghost"
          onClick={() => setShowHotels(true)}
          title="Show DOT-accredited hotels and accommodations"
        >
          View accredited hotels
        </button>
      </div>

      {showSummary && (
        <ItinerarySummaryModal
          item={item}
          onClose={() => setShowSummary(false)}
        />
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
    </div>
  );
}

function ExportPDFModal({ items, selected, onToggle, onSelectAll, onExport, onClose }) {
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        (it.name || "").toLowerCase().includes(q) ||
        (it.region || "").toLowerCase().includes(q)
    );
  }, [items, filter]);

  const allChecked = selected.size === items.length && items.length > 0;

  return (
    <div className="itn-modal-backdrop" onClick={onClose}>
      <div className="itn-modal itn-modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="itn-modal-header itn-gradient">
          <div className="itn-modal-title">Export Itinerary to PDF</div>
          <button className="itn-close" onClick={onClose}>×</button>
        </div>

        <div className="itn-modal-body">
          <div className="itn-toolbar">
            <input
              className="itn-input"
              placeholder="Search destinations to include..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="itn-toolbar-right">
              <span className="itn-muted">
                Selected {selected.size}/{items.length}
              </span>
              <button className="itn-btn ghost" onClick={onSelectAll}>
                {allChecked ? "Clear all" : "Select all"}
              </button>
            </div>
          </div>

          <div className="itn-results">
            {filtered.map((it) => {
              const checked = selected.has(it.id);
              return (
                <label key={it.id} className={`itn-result ${checked ? "is-checked" : ""}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(it.id)}
                  />
                  <div className="itn-result-main">
                    <div className="itn-result-title">{it.name || "Destination"}</div>
                    <div className="itn-result-sub">
                      {(it.region || "—")} • {(it.arrival || "—")} → {(it.departure || "—")} • {(it.status || "Upcoming")}
                    </div>
                  </div>
                </label>
              );
            })}
            {!items.length && <div className="itn-empty-sm">No destinations available.</div>}
            {items.length > 0 && filtered.length === 0 && (
              <div className="itn-empty-sm">No matches for "{filter}".</div>
            )}
          </div>
        </div>

        <div className="itn-modal-footer">
          <button className="itn-btn ghost" onClick={onClose}>Cancel</button>
          <button className="itn-btn primary" onClick={onExport} disabled={!selected.size}>
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// Update the summary modal to accept a single item
function ItinerarySummaryModal({ item, onClose }) {
  // compute days here (was missing -> caused 'days' not defined)
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

  return (
    <div className="itn-modal-backdrop" onClick={onClose}>
      <div
        className="itn-modal itn-modal-lg"
        onClick={e => e.stopPropagation()}
        style={{
          background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)",
          borderRadius: 18,
          boxShadow: "0 8px 32px rgba(108,99,255,0.13)",
          padding: 0,
          maxWidth: 520,
        }}
      >
        <div
          className="itn-modal-header"
          style={{
            background: "linear-gradient(90deg, #6c63ff 60%, #a084ee 100%)",
            color: "#fff",
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            padding: "24px 32px 16px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28, marginRight: 4 }}>📝</span>
            <span className="itn-modal-title" style={{ fontWeight: 700, fontSize: 22 }}>
              Itinerary Summary
            </span>
          </div>
          <button className="itn-close" onClick={onClose} style={{ color: "#fff" }}>
            ×
          </button>
        </div>
        <div
          className="itn-modal-body"
          style={{
            padding: "28px 32px 18px 32px",
            background: "transparent",
            maxHeight: 500,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              boxShadow: "0 2px 8px rgba(108,99,255,0.06)",
              padding: "24px 20px 18px 20px",
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6, color: "#6c63ff" }}>
              {item.name || "—"}
            </div>
            <div style={{ color: "#64748b", fontSize: 15, marginBottom: 12 }}>
              <span style={{ marginRight: 16 }}>
                <span style={{ fontWeight: 500 }}>Region:</span> {item.region || "—"}
              </span>
              <span>
                <span style={{ fontWeight: 500 }}>Status:</span> {item.status || "—"}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 18,
                marginBottom: 10,
                fontSize: 15,
              }}
            >
              <div>
                <span style={{ color: "#6c63ff", fontWeight: 500 }}>Dates:</span>{" "}
                {item.arrival || "—"} {item.departure ? `– ${item.departure}` : ""}
                {days ? (
                  <span style={{ marginLeft: 8, color: "#888" }}>
                    ({days} {days === 1 ? "day" : "days"})
                  </span>
                ) : ""}
              </div>
              <div>
                <span style={{ color: "#6c63ff", fontWeight: 500 }}>Estimated Expenditure:</span>{" "}
                <span style={{ fontWeight: 600 }}>
                  ${Number(item.estimatedExpenditure ?? item.budget ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
            <div style={{ margin: "14px 0 0 0" }}>
              <div style={{ fontWeight: 500, color: "#6c63ff", marginBottom: 2 }}>
                Accommodation
              </div>
              <div style={{ color: "#444", fontSize: 15 }}>
                {item.accomType || "Not planned"}
                {item.accomName ? (
                  <span style={{ color: "#888", marginLeft: 8 }}>
                    ({item.accomName})
                  </span>
                ) : null}
              </div>
              {item.accomNotes && (
                <div style={{ color: "#888", fontSize: 13, marginTop: 2 }}>
                  {item.accomNotes}
                </div>
              )}
            </div>
            <div style={{ margin: "18px 0 0 0" }}>
              <div style={{ fontWeight: 500, color: "#6c63ff", marginBottom: 2 }}>
                Activities
              </div>
              <div style={{ minHeight: 28 }}>
                {Array.isArray(item.activities) && item.activities.length ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {item.activities.map((a, i) => (
                      <span
                        key={i}
                        style={{
                          display: "inline-block",
                          background: "linear-gradient(90deg, #a084ee 60%, #6c63ff 100%)",
                          color: "#fff",
                          borderRadius: 16,
                          padding: "4px 14px",
                          fontSize: 14,
                          fontWeight: 500,
                          boxShadow: "0 1px 4px rgba(108,99,255,0.07)",
                        }}
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ color: "#888" }}>—</span>
                )}
              </div>
            </div>
            <div style={{ margin: "18px 0 0 0" }}>
              <div style={{ fontWeight: 500, color: "#6c63ff", marginBottom: 2 }}>
                Transport
              </div>
              <div style={{ color: "#444", fontSize: 15 }}>
                {item.transport || "—"}
              </div>
              {item.transportNotes && (
                <div style={{ color: "#888", fontSize: 13, marginTop: 2 }}>
                  {item.transportNotes}
                </div>
              )}
            </div>
            <div style={{ margin: "18px 0 0 0" }}>
              <div style={{ fontWeight: 500, color: "#6c63ff", marginBottom: 2 }}>
                Notes
              </div>
              <div style={{ color: "#444", fontSize: 15 }}>
                {item.notes || <span style={{ color: "#888" }}>—</span>}
              </div>
            </div>
          </div>
        </div>
        <div
          className="itn-modal-footer"
          style={{
            borderBottomLeftRadius: 18,
            borderBottomRightRadius: 18,
            background: "#f8fafc",
            padding: "18px 32px",
            textAlign: "right",
          }}
        >
          <button className="itn-btn primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Itinerary() {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [map, setMap] = useState(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);

  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);

  // Export and Share modal states - DECLARE ONLY ONCE
  const [showExport, setShowExport] = useState(false);
  const [exportSelected, setExportSelected] = useState(new Set());
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareSelected, setShareSelected] = useState(new Set());
  const [activeTab, setActiveTab] = useState("personal");
  const [showSummary, setShowSummary] = useState(false);

  // NEW: current user
  const [user, setUser] = useState(null);

  // Friends and shared itineraries
  const friends = useFriendsList(user);
  const { sharedWithMe } = useSharedItineraries(user);

  // NEW: watch auth, then subscribe to user's itinerary
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => {
      if (typeof unsubAuth === "function") unsubAuth();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    const colRef = collection(db, "itinerary", user.uid, "items");
    const q = fsQuery(colRef, orderBy("createdAt", "asc")); // use aliased function
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setItems(list);
    });
    return () => unsub();
  }, [user]);

  // Init Leaflet map
  useEffect(() => {
    if (map) return;
    // Create map without default zoom control and without attribution watermark
    const m = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView(
      [14.5995, 120.9842],
      11
    );
    // Add tiles with empty attribution to avoid the watermark
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "",
    }).addTo(m);
    setMap(m);
  }, [map]);

  // Center map on selected place and show custom pin icon
  useEffect(() => {
    if (!map || !selected) return;
    const lat = Number(selected.lat);
    const lon = Number(selected.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const pinIcon = L.icon({
      iconUrl: `${process.env.PUBLIC_URL || ""}/placeholder.png`,
      iconSize: [40, 40],
      iconAnchor: [20, 38],   // tip near bottom-center
      popupAnchor: [0, -38],
    });

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
      markerRef.current.setIcon(pinIcon);
    } else {
      markerRef.current = L.marker([lat, lon], { icon: pinIcon }).addTo(map);
    }
    map.setView([lat, lon], 13);
  }, [map, selected]);

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

  // Open the form using the selected place
  const openAddModal = () => {
    if (!selected) return;
    setEditing({
      ...selected,
      status: "Upcoming",
      // no id here; Firestore will assign one
    });
  };

  // Update the saveItem function
  const saveItem = async (data) => {
    if (!user) {
      alert("Please sign in to save your itinerary.");
      return;
    }

    if (!data.name) data.name = "Untitled destination";
    
    try {
      if (data.id) {
        // It's an edit - update the existing document
        const itemRef = doc(db, "itinerary", user.uid, "items", data.id);
        await updateDoc(itemRef, { 
          ...data, 
          updatedAt: serverTimestamp() 
        });
        console.log("Updated existing itinerary item:", data.id);
      } else {
        // It's a new item - create a new document
        const colRef = collection(db, "itinerary", user.uid, "items");
        const newDocRef = await addDoc(colRef, { 
          ...data, 
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp() 
        });
        
        // Track destination added in Stats
        await trackDestinationAdded(user.uid, {
          id: newDocRef.id,
          name: data.name,
          region: data.region,
          arrival: data.arrival,
          departure: data.departure,
        });
        
        // Log activity for creating new destination
        await logActivity(`Added "${data.name}" to your itinerary`, "📍");
        
        // Check if this is the user's first itinerary item
        const snap = await getDocs(colRef);
        if (snap.size === 1) {
          await unlockAchievement(1, "First Step");
        }
        
        console.log("Created new itinerary item");
      }
    } catch (e) {
      console.error("[Itinerary] saveItem write failed:", e);
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

  // KEEP THIS ONE - Update the handleShareItinerary function
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
      
      // Log activity for sharing itinerary
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

  // Fix the checkMiniPlannerAchievement effect (around line 1050)
  useEffect(() => {
    const checkMiniPlannerAchievement = async () => {
      if (!user) return;
      
      try {
        // Count personal itinerary items
        const personalCount = items.length;
        
        // Count shared itinerary items where user is a participant
        let sharedCount = 0;
        
        // FIX: Use fsQuery instead of query
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
        
        // Unlock Mini Planner achievement if user has 3 or more destinations
        if (totalDestinations >= 3) {
          await unlockAchievement(6, "Mini Planner");
        }
      } catch (error) {
        console.error("Error checking Mini Planner achievement:", error);
      }
    };
    
    checkMiniPlannerAchievement();
  }, [user, items]); // Re-check whenever user or items change

  // Make sure you have this state for export moda

  // Export functions - KEEP ONLY THESE
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
    
    const tableData = toExport.map(item => [
      item.name || "",
      item.region || "",
      item.arrival || "",
      item.departure || "",
      item.status || "",
      `$${Number(item.estimatedExpenditure || 0).toLocaleString()}`
    ]);

    autoTable(doc, {
      head: [["Destination", "Region", "Arrival", "Departure", "Status", "Budget"]],
      body: tableData,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 9 }
    });

    doc.save("itinerary.pdf");
    setShowExport(false);
  };

  const removeItem = async (id) => {
    if (!user) return;
    if (!window.confirm("Remove this destination?")) return;
    
    const itemToRemove = items.find((i) => i.id === id);
    
    try {
      await deleteDoc(doc(db, "itinerary", user.uid, "items", id));
      
      // Track removal in stats
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
    }
  };

  const toggleStatus = async (id) => {
    if (!user) return;
    const current = items.find((i) => i.id === id);
    if (!current) return;
    
    const next =
      current.status === "Upcoming"
        ? "Ongoing"
        : current.status === "Ongoing"
        ? "Completed"
        : "Upcoming";
    
    await updateDoc(doc(db, "itinerary", user.uid, "items", id), {
      status: next,
      updatedAt: serverTimestamp(),
    });

    // Track completion stats
    if (next === "Completed" && current.status !== "Completed") {
      // Changed to Completed
      await trackDestinationCompleted(user.uid, {
        id: current.id,
        name: current.name,
        region: current.region,
        arrival: current.arrival,
        departure: current.departure,
      });
      
      try {
        await unlockAchievement(8, "Checklist Champ");
      } catch (error) {
        console.error("Error unlocking Checklist Champ achievement:", error);
      }
    } else if (current.status === "Completed" && next !== "Completed") {
      // Changed from Completed to something else
      await trackDestinationUncompleted(user.uid, {
        id: current.id,
        name: current.name,
        region: current.region,
      });
    }
  };

  const markAllComplete = async () => {
    if (!user || !items.length) return;
    try {
      // Track each incomplete item as completed
      const promises = items.map(async (it) => {
        await updateDoc(doc(db, "itinerary", user.uid, "items", it.id), {
          status: "Completed",
          updatedAt: serverTimestamp(),
        });
        
        // Only track if it wasn't already completed
        if (it.status !== "Completed") {
          await trackDestinationCompleted(user.uid, {
            id: it.id,
            name: it.name,
            region: it.region,
            arrival: it.arrival,
            departure: it.departure,
          });
        }
      });
      
      await Promise.all(promises);
      console.log("[Itinerary] Marked all complete for", user.uid);

      // Unlock Checklist Champ achievement when marking all as complete
      try {
        await unlockAchievement(8, "Checklist Champ");
      } catch (error) {
        console.error("Error unlocking Checklist Champ achievement:", error);
      }
    } catch (e) {
      console.error("Mark All Complete failed:", e);
      alert("Failed to mark all complete. Please try again.");
    }
  };

  const clearAll = async () => {
    if (!user || !items.length) return;
    if (!window.confirm("Clear ALL destinations? This cannot be undone.")) return;
    try {
      await Promise.all(
        items.map((it) => deleteDoc(doc(db, "itinerary", user.uid, "items", it.id)))
      );
      console.log("[Itinerary] Cleared all for", user.uid);
    } catch (e) {
      console.error("Clear All failed:", e);
      alert("Failed to clear all. Please try again.");
    }
  };

  return (
    <div className="itn-page">
      <div className="itn-hero">
        <div className="itn-hero-title">LakbAI: Your AI Travel Assistant</div>
        <div className="itn-hero-sub">Plan every aspect of your perfect journey</div>
        <div className="itn-hero-actions">
          <button 
            className="itn-btn ghost" 
            onClick={() => setShowShareModal(true)} 
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
          {/* Removed unused View Summary button */}
        </div>
      </div>

      <div className="itn-grid-main">
        <section className="itn-left">
          <div className="itn-panel">
            <div className="itn-panel-title">Find Destination</div>

            <div className="itn-row">
              <input
                className="itn-input"
                placeholder="Search destinations..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
              />
              <button className="itn-btn primary" onClick={onSearch} disabled={searching}>
                {searching ? "Searching..." : "Search"}
              </button>
            </div>

            {/* Map container (remove the CSS dot element) */}
            <div className="itn-map-wrap">
              <div className="itn-map" ref={mapRef} />
            </div>

            {selected ? (
              <>
                <div className="itn-place-line">{selected.display_name}</div>
                <button className="itn-btn success block" onClick={openAddModal}>
                  + Add to Itinerary
                </button>
              </>
            ) : (
              <div className="itn-muted">Search for places on the map to start planning.</div>
            )}
            
            {results.length > 1 && (
              <div className="itn-results">
                {results.map((r) => (
                  <div
                    key={r.place_id || `${r.lat}-${r.lon}`}
                    className="itn-result"
                  >
                    <div className="itn-result-title">{r.display_name}</div>
                    <div className="itn-result-coords">
                      {r.lat && r.lon ? `Lat: ${r.lat}, Lon: ${r.lon}` : "Coordinates not found"}
                    </div>
                    <button
                      className="itn-btn success itn-result-add"
                      onClick={() => setSelected(r)}
                    >
                      Add to Itinerary
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="itn-right">
          <div className="itn-tabs">
            <div 
              className={`itn-tab ${activeTab === 'personal' ? 'active' : ''}`} 
              onClick={() => setActiveTab('personal')}
            >
              My Itineraries
            </div>
            <div 
              className={`itn-tab ${activeTab === 'shared' ? 'active' : ''}`}
              onClick={() => setActiveTab('shared')}
            >
              Shared With Me {sharedWithMe.length > 0 && `(${sharedWithMe.length})`}
            </div>
          </div>
          
          <div className="itn-panel">
            <div className="itn-panel-title">
              {activeTab === 'personal' ? 'Your Detailed Itinerary' : 'Itineraries Shared With You'}
            </div>
            
            {activeTab === 'personal' ? (
              <>
                <div className="itn-head-actions">
                  <button
                    className="itn-btn primary"
                    onClick={() => setShowShareModal(true)}
                    disabled={!items.length}
                  >
                    Share
                  </button>
                  <button
                    className="itn-btn success"
                    onClick={markAllComplete}
                    disabled={!items.length}
                  >
                    Mark All Complete
                  </button>
                  <button
                    className="itn-btn danger"
                    onClick={clearAll}
                    disabled={!items.length}
                  >
                    Clear All
                  </button>
                </div>

                {!items.length ? (
                  <div className="itn-empty">
                    <div className="itn-empty-icon">🧳</div>
                    <div className="itn-empty-title">No destinations planned yet</div>
                    <div className="itn-muted">
                      Search for places on the map to start building your itinerary!
                    </div>
                  </div>
                ) : 
                  items.map((item, idx) => (
                    <DestinationCard
                      key={item.id}
                      item={item}
                      index={idx}
                      onEdit={(it) => setEditing(it)}
                      onRemove={removeItem}
                      onToggleStatus={toggleStatus}
                      setEditing={setEditing} // <-- ADD THIS LINE
                    />
                  ))
                }
              </>
            ) : (
              <SharedItinerariesTab user={user} />
            )}
            
          </div>
        </section>
      </div>

      {editing && (
        <EditDestinationModal
          initial={editing}
          onSave={saveItem}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Export PDF Modal */}
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

      {/* Share Modal */}
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

      {showSummary && (
        <ItinerarySummaryModal
          item={items}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}


// Add this named export near the bottom (outside components)
export async function addTripForCurrentUser(dest) {
  const u = auth.currentUser;
  if (!u) throw new Error("AUTH_REQUIRED");

  // small helper: parse price-like strings (₱1,200 or "500–2,000" etc) -> number (average if range)
  const parseEstimatedFromPrice = (p) => {
    if (p == null) return 0;
    if (typeof p === "number") return p;
    const s = String(p).replace(/\s/g, "").replace(/₱/g, "").replace(/,/g, "");
    // capture number groups
    const nums = s.match(/\d+/g);
    if (!nums || nums.length === 0) return 0;
    const numbers = nums.map(Number).filter(Number.isFinite);
    if (numbers.length === 0) return 0;
    // if a range (two+ numbers) return average, otherwise return first
    const sum = numbers.reduce((a, b) => a + b, 0);
    return Math.round(sum / numbers.length);
  };

  // Ensure parent doc exists
  await setDoc(
    doc(db, "itinerary", u.uid),
    { owner: u.uid, updatedAt: serverTimestamp() },
    { merge: true }
  );

  const id = String(dest?.id || dest?.place_id || dest?.name || Date.now())
    .replace(/[^\w-]/g, "_");

  const ref = doc(db, "itinerary", u.uid, "items", id);
  const now = serverTimestamp();

  // compute estimatedExpenditure from dest.price if available
  const estimated = parseEstimatedFromPrice(dest?.price ?? dest?.priceTier ?? dest?.budget ?? dest?.estimatedExpenditure);

  const payload = {
    name: dest?.name || "Untitled destination",
    region: dest?.region || "",
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

  try {
    await setDoc(ref, payload, { merge: true });
    console.log("[Itinerary] Added trip:", payload);
    return id;
  } catch (err) {
    console.error("[Itinerary] Failed to add trip:", err);
    throw err;
  }
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