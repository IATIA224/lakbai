import React, { useEffect, useMemo, useState } from "react";

/**
 * GroupCard - editable breakdown list (name + price) with live total.
 *
 * Props:
 * - breakdown: Array<{ id?, name, price }>
 * - onChange(updatedBreakdown, total) // called on every edit (optional)
 * - onSave(updatedBreakdown, total) // persist change (e.g. update firestore)
 * - readOnly: boolean (show-only)
 */
export default function GroupCard({ breakdown = [], onChange, onSave, readOnly = false }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    // Normalize input data
    const mapped = (breakdown || []).map((r, idx) => ({
      id: r.id ?? `${Date.now()}-${idx}`,
      name: r.name ?? "",
      price: Number(r.price ?? 0),
    }));
    setRows(mapped);
  }, [breakdown]);

  const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.price) || 0), 0), [rows]);

  useEffect(() => {
    if (typeof onChange === "function") onChange(rows, total);
  }, [rows, total, onChange]);

  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    const newRow = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: "", price: 0 };
    setRows((prev) => [...prev, newRow]);
  };

  const removeRow = (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSave = async () => {
    if (typeof onSave === "function") {
      try {
        await onSave(rows, total);
      } catch (err) {
        console.error("GroupCard:onSave failed", err);
      }
    }
  };

  return (
    <div className="group-card">
      <div className="group-card-header">
        <div className="group-card-title">Breakdown</div>
        {!readOnly && (
          <div className="group-card-actions">
            <button className="itn-btn ghost" type="button" onClick={addRow}>Add</button>
            <button className="itn-btn primary" type="button" onClick={handleSave}>Save</button>
          </div>
        )}
      </div>

      <div className="group-card-list">
        {rows.length === 0 && <div className="group-card-empty">No items yet. Click Add to create one.</div>}
        {rows.map((r) => (
          <div className="group-card-row" key={r.id}>
            <div className="group-card-col name">
              {readOnly ? (
                <div className="group-card-text">{r.name || "—"}</div>
              ) : (
                <input
                  value={r.name}
                  onChange={(e) => updateRow(r.id, { name: e.target.value })}
                  placeholder="Item name"
                  className="group-card-input"
                />
              )}
            </div>

            <div className="group-card-col price">
              {readOnly ? (
                <div className="group-card-text">PHP {Number(r.price || 0).toLocaleString()}</div>
              ) : (
                <input
                  inputMode="decimal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={r.price}
                  onChange={(e) => updateRow(r.id, { price: Number(e.target.value || 0) })}
                  className="group-card-input"
                />
              )}
            </div>

            <div className="group-card-col action">
              {!readOnly && (
                <button className="itn-btn ghost sm danger" onClick={() => removeRow(r.id)} aria-label="Remove">
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="group-card-footer">
        <div className="group-card-total-label">Estimated Expenditure</div>
        <div className="group-card-total-value">PHP {total.toLocaleString()}</div>
      </div>
    </div>
  );
}