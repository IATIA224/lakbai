import React from "react";
import ReactDOM from "react-dom";

export default function ExportPDFModal({ items, selected, onToggle, onSelectAll, onExport, onClose, exporting = false }) {
  const isAllSelected = items.length > 0 && selected.size === items.length;

  return ReactDOM.createPortal(
    <div className="itn-modal-backdrop" onClick={onClose}>
      <div className="itn-modal itn-modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="itn-modal-header itn-gradient">
          <div className="itn-modal-title">📄 Export to PDF</div>
          <button className="itn-close" onClick={onClose}>×</button>
        </div>

        <div className="itn-modal-body">
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
                  className={`itn-badge ${item.status?.toLowerCase() || ''}`} 
                  style={{ whiteSpace: "nowrap" }}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="itn-modal-footer">
          <button 
            className="itn-btn ghost" 
            onClick={onClose} 
            disabled={exporting}
          >
            Cancel
          </button>
          <button
            className="itn-btn primary"
            onClick={() => {
              console.log("[ExportPDFModal] Export clicked. Selected:", Array.from(selected));
              onExport();
            }}
            disabled={selected.size === 0 || exporting}
            aria-busy={exporting}
          >
            {exporting ? "Exporting..." : `Export ${selected.size > 0 ? `(${selected.size})` : ""}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}