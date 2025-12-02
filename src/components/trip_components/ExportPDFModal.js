import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom";

export default function ExportPDFModal({ items = [], selected = new Set(), onToggle, onSelectAll, onExport, onClose, exporting }) {
  const isAllSelected = items.length > 0 && selected.size === items.length;

  // Use ReactDOM.createPortal to move this modal outside of any parent containers
  return ReactDOM.createPortal(
    <div className="confirmation-overlay" onClick={onClose} style={{ zIndex: 100005 }}>
      <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirmation-header">
          <div className="confirmation-title">Export destinations to PDF</div>
        </div>

        <div className="confirmation-body">
          <div style={{ marginBottom: 12, color: "#64748b" }}>
            Select destinations to include in the PDF. Use Select All to quickly choose all items.
          </div>

          <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: "#64748b", fontWeight: 600 }}>
              {selected.size} of {items.length} selected
            </div>
            <button
              className="itn-btn ghost"
              onClick={() => onSelectAll()}
              style={{ fontSize: "13px", padding: "6px 12px" }}
            >
              {isAllSelected ? "Deselect All" : "Select All"}
            </button>
          </div>

          <div style={{ maxHeight: "420px", overflowY: "auto", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
            {items.map(item => (
              <div
                key={item.id}
                onClick={() => onToggle(item.id)}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #f1f5f9",
                  cursor: "pointer",
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                  background: selected.has(item.id) ? "#f0f4ff" : "#fff",
                  transition: "all 0.12s ease-in-out",
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => onToggle(item.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ marginTop: "6px", cursor: "pointer" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>{item.name}</div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{item.region}</div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "#475569" }}>
                    {item.arrival && <span>Arrival: {item.arrival} • </span>}
                    {item.departure && <span>Departure: {item.departure} • </span>}
                    {item.status && <span>Status: {item.status}</span>}
                    {item.estimatedExpenditure && <span> • Budget: ₱{Number(item.estimatedExpenditure).toLocaleString()}</span>}
                  </div>
                </div>
                <span
                  className={`itn-badge ${item.status?.toLowerCase() || ""}`}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="confirmation-footer">
          <button className="itn-btn ghost" onClick={onClose}>Cancel</button>
          <button className="itn-btn primary" onClick={onExport} disabled={exporting}>
            {exporting ? "Exporting…" : "Export to PDF"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}