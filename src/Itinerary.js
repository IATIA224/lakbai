import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./itinerary.css";

// Simple place search via OpenStreetMap Nominatim
async function searchPlace(q) {
  if (!q?.trim()) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    q
  )}`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en" },
  });
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

  const addActivity = () => {
    const v = form.activityDraft.trim();
    if (!v) return;
    setForm((f) => ({ ...f, activities: [...f.activities, v], activityDraft: "" }));
  };
  const removeActivity = (i) =>
    setForm((f) => ({ ...f, activities: f.activities.filter((_, idx) => idx !== i) }));

  const handleSave = () => {
    onSave({
      ...initial,
      ...form,
      budget: Number(form.budget) || 0,
      accomBudget: Number(form.accomBudget) || 0,
      activityBudget: Number(form.activityBudget) || 0,
      transportCost: Number(form.transportCost) || 0,
    });
  };

  return (
    <div className="itn-modal-backdrop" onClick={onClose}>
      <div className="itn-modal" onClick={(e) => e.stopPropagation()}>
        <div className="itn-modal-header">
          <div className="itn-modal-title">Edit Destination Details</div>
          <button className="itn-close" onClick={onClose}>×</button>
        </div>

        <div className="itn-modal-body">
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

          <div className="itn-grid">
            <label className="itn-field">
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
                rows={3}
                className="itn-input"
                placeholder="Address, booking details, special notes..."
                value={form.accomNotes}
                onChange={(e) => setForm({ ...form, accomNotes: e.target.value })}
              />
            </label>
          </div>

          <div className="itn-field">
            <span className="itn-label">Planned Activities</span>
            <div className="itn-row">
              <input
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

          <div className="itn-grid">
            <label className="itn-field">
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
            </label>
          </div>

          <label className="itn-field">
            <span className="itn-label">Additional Notes</span>
            <textarea
              rows={3}
              className="itn-input"
              placeholder="Important information, reminders, contacts..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
        </div>

        <div className="itn-modal-footer">
          <button className="itn-btn ghost" onClick={onClose}>Cancel</button>
          <button className="itn-btn primary" onClick={handleSave}>Save Details</button>
        </div>
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

  // Init Leaflet map
  useEffect(() => {
    if (map) return;
    const m = L.map(mapRef.current, { zoomControl: true }).setView([14.5995, 120.9842], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(m);
    setMap(m);
  }, [map]);

  // Update marker for selected place
  useEffect(() => {
    if (!map || !selected) return;
    const lat = Number(selected.lat);
    const lon = Number(selected.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
    } else {
      markerRef.current = L.marker([lat, lon]).addTo(map);
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

  const openAddModal = () => {
    if (!selected) return;
    setEditing({
      ...selected,
      id: Date.now(),
      status: "Upcoming",
    });
  };

  const saveItem = (data) => {
    setItems((prev) => {
      const exists = prev.some((p) => p.id === data.id);
      return exists ? prev.map((p) => (p.id === data.id ? data : p)) : [...prev, data];
    });
    setEditing(null);
  };

  const removeItem = (id) => setItems((prev) => prev.filter((p) => p.id !== id));

  const toggleStatus = (id) =>
    setItems((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status:
                p.status === "Upcoming"
                  ? "Ongoing"
                  : p.status === "Ongoing"
                  ? "Completed"
                  : p.status === "Completed"
                  ? "Upcoming"
                  : "Upcoming",
            }
          : p
      )
    );

  return (
    <div className="itn-page">
      <div className="itn-hero">
        <div className="itn-hero-title">LakbAI: Your AI Travel Assistant</div>
        <div className="itn-hero-sub">Plan every aspect of your perfect journey</div>
        <div className="itn-hero-actions">
          <button className="itn-btn ghost">Share Itinerary</button>
          <button className="itn-btn ghost">Export PDF</button>
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

            <div className="itn-map" ref={mapRef} />

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
                  <button
                    key={r.place_id}
                    className={`itn-result ${selected?.place_id === r.place_id ? "sel" : ""}`}
                    onClick={() => setSelected(r)}
                  >
                    {r.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="itn-right">
          <div className="itn-panel">
            <div className="itn-panel-title">Your Detailed Itinerary</div>
            <div className="itn-head-actions">
              <button
                className="itn-btn success"
                onClick={() =>
                  setItems((prev) => prev.map((p) => ({ ...p, status: "Completed" })))
                }
                disabled={!items.length}
              >
                Mark All Complete
              </button>
              <button
                className="itn-btn danger"
                onClick={() => setItems([])}
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
    </div>
  );
}