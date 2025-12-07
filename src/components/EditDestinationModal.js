import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

function EditDestinationModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    name: initial?.display_name?.split(",")[0] || initial?.name || "",
    region: initial?.display_name?.split(",").slice(1).join(",").trim() || initial?.region || "",
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

  const modalContent = (
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

  return createPortal(modalContent, document.body);
}

export default EditDestinationModal;
