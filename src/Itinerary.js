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
  query as fsQuery,
  getDocs,
  setDoc,
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
  // add:
  deleteTripDestination,
  clearAllTripDestinations,
} from './itinerary2';

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
    budget: initial?.budget ?? 0,
    accomBudget: initial?.accomBudget ?? 0,
    activityBudget: initial?.activityBudget ?? 0,
    accomType: initial?.accomType || "",
    accomName: initial?.accomName || "",
    accomNotes: initial?.accomNotes || "",
    activities: initial?.activities || [],
    activityDraft: "",
    transport: initial?.transport || "",
    transportCost: initial?.transportCost ?? 0,
    transportNotes: initial?.transportNotes || "",
    notes: initial?.notes || "",
  }));

  const [notif, setNotif] = useState("");

  const addActivity = () => {
    const v = form.activityDraft.trim();
    if (!v) return;
    setForm((f) => ({ ...f, activities: [...f.activities, v], activityDraft: "" }));
  };
  const removeActivity = (i) =>
    setForm((f) => ({ ...f, activities: f.activities.filter((_, idx) => idx !== i) }));

  const handleSave = async () => {
    try {
      await onSave({
        ...initial, // This ensures we're keeping the ID and other metadata
        ...form,
        budget: Number(form.budget) || 0,
        accomBudget: Number(form.accomBudget) || 0,
        activityBudget: Number(form.activityBudget) || 0,
        transportCost: Number(form.transportCost) || 0,
      });
      setNotif("Itinerary item updated successfully!"); // Changed "created" to "updated"
      setTimeout(() => {
        setNotif("");
        onClose(); // Close the modal after showing popup
      }, 1200); // 1.2 seconds
    } catch (e) {
      setNotif("Failed to update itinerary item."); // Changed "create" to "update"
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
  }, []);

  return (
    <div className="itn-modal-backdrop" onClick={onClose}>
      <div
        className="itn-modal"
        style={{
          maxWidth: 700,
          boxShadow: "0 8px 32px rgba(108,99,255,0.12)",
          borderRadius: 16,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          maxHeight: "80vh",
          background: "#fff",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="itn-modal-header" style={{ padding: "24px 32px 12px 32px" }}>
          <div className="itn-modal-title">Edit Destination Details</div>
          <button className="itn-close" onClick={onClose}>×</button>
        </div>

        <div
          className="itn-modal-body"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 32px 24px 32px",
            background: "#fafaff",
          }}
        >
          <div className="itn-form-grid" style={{ gap: 32 }}>
            <div className="itn-form-col">
              {/* ...left column fields... */}
              {/* (same as your previous code) */}
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
                  <span className="itn-label">Total Budget ($)</span>
                  <input
                    type="number"
                    className="itn-input"
                    value={form.budget}
                    onChange={(e) => setForm({ ...form, budget: e.target.value })}
                  />
                </label>
                <label className="itn-field">
                  <span className="itn-label">Accommodation ($)</span>
                  <input
                    type="number"
                    className="itn-input"
                    value={form.accomBudget}
                    onChange={(e) => setForm({ ...form, accomBudget: e.target.value })}
                  />
                </label>
                <label className="itn-field">
                  <span className="itn-label">Activities ($)</span>
                  <input
                    type="number"
                    className="itn-input"
                    value={form.activityBudget}
                    onChange={(e) => setForm({ ...form, activityBudget: e.target.value })}
                  />
                </label>
              </div>
            </div>

            <div className="itn-form-col">
              {/* ...right column fields... */}
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
                <span className="itn-label">Planned Activities</span>
                <div className="itn-row">
                  <input
                    id="itn-activity-draft"
                    className="itn-input"
                    placeholder="Add an activity..."
                    value={form.activityDraft}
                    onChange={(e) => setForm({ ...form, activityDraft: e.target.value })}
                  />
                  <button type="button" className="itn-btn success" onClick={addActivity}>
                    Add
                  </button>
                </div>
                {form.activities.length > 0 && (
                  <ul className="itn-chips">
                    {form.activities.map((a, i) => (
                      <li key={`${a}-${i}`} className="itn-chip">
                        {a}
                        <button onClick={() => removeActivity(i)}>×</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="itn-field">
                <span className="itn-label">Transportation</span>
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
                  <input
                    type="number"
                    className="itn-input"
                    placeholder="0"
                    value={form.transportCost}
                    onChange={(e) => setForm({ ...form, transportCost: e.target.value })}
                  />
                </div>
                <textarea
                  rows={2}
                  className="itn-input"
                  placeholder="Flight numbers, booking details, pickup times..."
                  value={form.transportNotes}
                  onChange={(e) => setForm({ ...form, transportNotes: e.target.value })}
                />
              </div>

              <label className="itn-field">
                <span className="itn-label">Additional Notes</span>
                <textarea
                  rows={2}
                  className="itn-input"
                  placeholder="Important information, reminders, contacts..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="itn-modal-footer" style={{
          padding: "16px 32px",
          borderTop: "1px solid #eee",
          background: "#fff",
          position: "sticky",
          bottom: 0,
          zIndex: 2,
        }}>
          <button className="itn-btn ghost" onClick={onClose}>Cancel</button>
          <button className="itn-btn primary" onClick={handleSave}>Save Details</button>
        </div>

        {/* Notification popup */}
        {notif && (
          <div
            style={{
              position: "absolute",
              top: 16,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#6c63ff",
              color: "#fff",
              padding: "10px 24px",
              borderRadius: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              fontWeight: 500,
              zIndex: 10,
            }}
          >
            {notif}
          </div>
        )}
      </div>
    </div>
  );
}

function DestinationCard({ item, index, onEdit, onRemove, onToggleStatus }) {
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
          <div className="itn-stat-title">Budget</div>
          <div className="itn-stat-body">
            <div>${item.budget || 0}</div>
            <div className="itn-muted">Hotel: ${item.accomBudget || 0}</div>
            <div className="itn-muted">Activities: ${item.activityBudget || 0}</div>
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
            <div>{item.activities?.length || 0} planned</div>
            {item.activities?.length ? (
              <div className="itn-muted">{item.activities.slice(0, 3).join(", ")}</div>
            ) : (
              <div className="itn-muted">—</div>
            )}
          </div>
        </div>
      </div>
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

  // ADD THESE
  const [showExport, setShowExport] = useState(false);
  const [exportSelected, setExportSelected] = useState(new Set());
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareSelected, setShareSelected] = useState(new Set());
  const [activeTab, setActiveTab] = useState("personal");

  // NEW: current user
  const [user, setUser] = useState(null);

  // NEW: watch auth, then subscribe to user's itinerary
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsubAuth();
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
    const m = L.map(mapRef.current, { zoomControl: true }).setView([14.5995, 120.9842], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
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

  // Replace saveItem with the parent-doc ensure before writing
  const saveItem = async (data) => {
    if (!user) {
      alert("Please sign in to save your itinerary.");
      return;
    }

    if (!data.name) data.name = "Untitled destination";
    
    try {
      // Check if this is an edit (has an id) or a new item
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
        await addDoc(colRef, { 
          ...data, 
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp() 
        });
        
        // Check if this is the user's first itinerary item
        const snap = await getDocs(colRef);
        if (snap.size === 1) {
          // Unlock "First Step" achievement (id: 1)
          await unlockAchievement(1, "First Step");
        }
        
        console.log("Created new itinerary item");
      }
    } catch (e) {
      console.error("[Itinerary] saveItem write failed:", e);
      alert(`Failed to save itinerary item: ${e?.code || e?.message || e}`);
    }
  };

  // NEW: delete from Firestore
  const removeItem = async (id) => {
    if (!user) return;
    // delete from itinerary (existing behavior)
    await deleteDoc(doc(db, "itinerary", user.uid, "items", id));

    // also delete from My Trips (all users)
    try {
      await removeTripForAllUsers(id);
    } catch (e) {
      console.warn("[Trips] Failed to delete from trips across users:", e);
    }
  };

  // NEW: toggle status in Firestore
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
  };

  const markAllComplete = async () => {
    if (!user || !items.length) return;
    try {
      await Promise.all(
        items.map((it) =>
          updateDoc(doc(db, "itinerary", user.uid, "items", it.id), {
            status: "Completed",
            updatedAt: serverTimestamp(),
          })
        )
      );
      console.log("[Itinerary] Marked all complete for", user.uid);
    } catch (e) {
      console.error("Mark All Complete failed:", e);
      alert("Failed to mark all complete. Please try again.");
    }
  };

  const clearAll = async () => {
    if (!user || !items.length) return;
    if (!window.confirm("Remove all destinations from your itinerary?")) return;
    try {
      // clear itinerary (existing behavior)
      const colRef = collection(db, "itinerary", user.uid, "items");
      const snap = await getDocs(colRef);
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      console.log("[Itinerary] Cleared itinerary for", user.uid);

      // also clear My Trips (all users)
      try {
        await clearAllTripsForAllUsers();
      } catch (e) {
        console.warn("[Trips] Failed to clear trips across users:", e);
      }
    } catch (e) {
      console.error("Clear All failed:", e);
      alert("Failed to clear your itinerary. Please try again.");
    }
  };

  // Open export dialog (preselect all) 
  const openExport = () => {
    setExportSelected(new Set(items.map(i => i.id)));
    setShowExport(true);
  };

  const toggleSelected = (id) => {
    setExportSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setExportSelected(prev => {
      if (prev.size === items.length) return new Set();
      return new Set(items.map(i => i.id));
    });
  };

  const exportToPDF = async () => {
    if (!exportSelected.size) return;

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const pad = 40;
    const contentW = w - pad * 2;

    // Sort by arrival date, newest first, then name
    const toMs = (d) => (d ? new Date(d).getTime() : 0);
    const sel = [...items]
      .filter((i) => exportSelected.has(i.id))
      .sort((a, b) => (toMs(b.arrival) - toMs(a.arrival)) || (a.name || "").localeCompare(b.name || ""));

    const totals = sel.reduce(
      (acc, it) => {
        const days =
          it.arrival && it.departure
            ? Math.max(1, Math.ceil((new Date(it.departure) - new Date(it.arrival)) / 86400000))
            : 0;
        acc.days += days;
        acc.budget += Number(it.budget || 0);
        return acc;
      },
      { days: 0, budget: 0 }
    );

    // Header + footer via didDrawPage
    const drawHeader = () => {
      doc.setFillColor(246, 247, 255);
      doc.rect(0, 0, w, 64, "F");
      doc.setFontSize(18);
      doc.setTextColor(28, 28, 30);
      doc.text("LakbAI Itinerary", pad, 32);
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 100);
      doc.text(
        `Exported: ${new Date().toLocaleString()} • Destinations: ${sel.length} • Total days: ${totals.days} • Total budget: $${totals.budget.toLocaleString()}`,
        pad,
        50
      );
    };
    const drawFooter = () => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 130);
      doc.text(`Page ${page}`, w - pad, h - 16, { align: "right" });
    };

    // Build table rows
    const rows = sel.map((it, idx) => {
      const days =
        it.arrival && it.departure
          ? Math.max(1, Math.ceil((new Date(it.departure) - new Date(it.arrival)) / 86400000))
          : "";
      const dates = [it.arrival || "—", it.departure ? `– ${it.departure}` : ""].join(" ");
      const budget = `$${Number(it.budget || 0).toLocaleString()}`;
      return [
        idx + 1,
        it.name || "Destination",
        it.region || "—",
        dates,
        String(days || "—"),
        it.status || "—",
        budget,
      ];
    });

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 90);
    doc.text(`Destinations: ${sel.length}`, pad + 12, 80);
    doc.text(`Total days: ${totals.days}`, pad + 160, 80);
    doc.text(`Total budget: $${totals.budget.toLocaleString()}`, pad + 280, 80);

    // when adding a table:
    const addTable = (opts) => {
      // works with both plugin styles
      if (typeof doc.autoTable === 'function') {
        doc.autoTable(opts);
      } else {
        autoTable(doc, opts);
      }
    };

    addTable({
      startY: 92,
      margin: { left: pad, right: pad },
      head: [["#", "Destination", "Region", "Dates", "Days", "Status", "Budget"]],
      body: rows,
      styles: {
        fontSize: 9,
        cellPadding: 6,
        overflow: "linebreak",
        lineColor: [230, 230, 242],
        lineWidth: 0.2,
        valign: "middle",
      },
      headStyles: { fillColor: [108, 99, 255], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 248, 255] },
      columnStyles: {
        0: { cellWidth: contentW * 0.06, halign: "right" },
        1: { cellWidth: contentW * 0.32 },
        2: { cellWidth: contentW * 0.16 },
        3: { cellWidth: contentW * 0.20 },
        4: { cellWidth: contentW * 0.08, halign: "right" },
        5: { cellWidth: contentW * 0.10 },
        6: { cellWidth: contentW * 0.08, halign: "right" },
      },
      didDrawPage: () => {
        drawHeader();
        drawFooter();
      },
    });

    // Summary box after table
    let y = (doc.lastAutoTable?.finalY || 72) + 18;
    if (y + 80 > h - pad) {
      doc.addPage();
      drawHeader();
      drawFooter();
      y = 72;
    }
    doc.setDrawColor(108, 99, 255);
    doc.setLineWidth(0.8);
    doc.roundedRect(pad, y, contentW, 60, 8, 8);
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text("Summary", pad + 12, y + 20);
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 90);
    doc.text(`Destinations: ${sel.length}`, pad + 12, y + 40);
    doc.text(`Total days: ${totals.days}`, pad + 160, y + 40);
    doc.text(`Total budget: $${totals.budget.toLocaleString()}`, pad + 280, y + 40);

    const filename = `itinerary-${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
    setShowExport(false);
  };

  const friends = useFriendsList(user);
  const { sharedWithMe, loading: loadingShared } = useSharedItineraries(user);

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
      
      // First check that we have the data we need
      if (!itemIds.length) {
        alert("Please select at least one destination to share");
        return;
      }
      
      if (!friendIds.length) {
        alert("Please select at least one friend to share with");
        return;
      }
      
      // Get the actual items to be shared
      const itemsToShare = items.filter(item => itemIds.includes(item.id));
      
      if (!itemsToShare.length) {
        alert("Could not find the selected destinations");
        return;
      }
      
      // Now call the share function
      await shareItineraryWithFriends(user, items, itemIds, friendIds);
      alert(`Itinerary shared with ${friendIds.length} friend${friendIds.length > 1 ? 's' : ''}!`);
    } catch (err) {
      console.error("Share failed:", err);
      alert(`Failed to share itinerary: ${err.message || "Unknown error"}`);
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
                ) : (
                  items.map((item, idx) => (
                    <DestinationCard
                      key={item.id}
                      item={item}
                      index={idx}
                      onEdit={(it) => setEditing(it)}
                      onRemove={removeItem}
                      onToggleStatus={toggleStatus}
                    />
                  ))
                )}
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

      {showExport && (
        <ExportPDFModal
          items={items}
          selected={exportSelected}
          onToggle={toggleSelected}
          onSelectAll={toggleSelectAll}
          onExport={exportToPDF}
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
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}

function Trips() {
  const [user, setUser] = useState(null);
  const [addingId, setAddingId] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  // Call this when the "Add to Trip" button is clicked
  const addToMyTrips = async (dest) => {
    try {
      await addTripForCurrentUser(dest);
    } catch (e) {
      if (e.message === "AUTH_REQUIRED") {
        alert("Please sign in to add to My Trips.");
      } else {
        console.error("Add to My Trips failed:", e);
        alert("Failed to add. Please try again.");
      }
    }
  };

  return (
    <div>
      {/* Example usage inside your card/list render:
      <button
        className="add-trip-btn"
        onClick={() => addToMyTrips(destination)}
        disabled={addingId === (destination.id || destination.name)}
        aria-busy={addingId === (destination.id || destination.name)}

     

      >
        {addingId === (destination.id || destination.name) ? 'Adding…' : '+ Add to Trip'}
      </button>
      */}
    </div>
  );
}

// Add this named export near the bottom (outside components)
export async function addTripForCurrentUser(dest) {
  const u = auth.currentUser;
  if (!u) throw new Error("AUTH_REQUIRED");

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