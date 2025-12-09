import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom";

<<<<<<< HEAD
export default function ExportPDFModal({ items = [], selected = new Set(), onToggle, onSelectAll, onExport, onClose, exporting }) {
  const isAllSelected = items.length > 0 && selected.size === items.length;

  return (
    <div className="confirmation-overlay" onClick={onClose}>
      <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
=======
export default function ExportPDFModal({ 
  items = [], 
  groups = [], 
  selected = new Set(), 
  onToggle, 
  onSelectAll, 
  onExport, 
  onClose, 
  exporting,
  viewMode = "list"
}) {
  const isAllSelected = items.length > 0 && selected.size === items.length;
  const [activeView, setActiveView] = useState(viewMode);

  // Get items organized by groups
  const groupedItems = useMemo(() => {
    if (!groups || groups.length === 0) return [];
    
    return groups.map(group => {
      const groupItemIds = group.destinationIds || Object.keys(group.assignments || {});
      const groupItems = items.filter(item => groupItemIds.includes(item.id));
      
      if (group.assignments) {
        groupItems.sort((a, b) => {
          const dayA = group.assignments[a.id] || 999;
          const dayB = group.assignments[b.id] || 999;
          return dayA - dayB;
        });
      }
      
      return {
        ...group,
        items: groupItems
      };
    });
  }, [groups, items]);

  // Get ungrouped items
  const ungroupedItems = useMemo(() => {
    if (!groups || groups.length === 0) return items;
    
    const groupedIds = new Set();
    groups.forEach(g => {
      const ids = g.destinationIds || Object.keys(g.assignments || {});
      ids.forEach(id => groupedIds.add(id));
    });
    
    return items.filter(item => !groupedIds.has(item.id));
  }, [groups, items]);

  // Select all items in a group
  const selectAllInGroup = (groupItems) => {
    const allSelected = groupItems.every(item => selected.has(item.id));
    groupItems.forEach(item => {
      if (allSelected) {
        if (selected.has(item.id)) onToggle(item.id);
      } else {
        if (!selected.has(item.id)) onToggle(item.id);
      }
    });
  };

  return ReactDOM.createPortal(
    <div className="confirmation-overlay" onClick={onClose} style={{ zIndex: 100005 }}>
      <div className="confirmation-modal export-pdf-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
>>>>>>> f1d6feb7a9f1cc032ac6cc07aa0a7a9db71801c1
        <div className="confirmation-header">
          <div className="confirmation-title">Export destinations to PDF</div>
        </div>

        <div className="confirmation-body">
          <div style={{ marginBottom: 12, color: "#64748b" }}>
            Select destinations to include in the PDF. Use Select All to quickly choose all items.
          </div>

<<<<<<< HEAD
=======
          {/* View Toggle for groups */}
          {groups && groups.length > 0 && (
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              marginBottom: '16px',
              background: '#f1f5f9',
              borderRadius: '8px',
              padding: '4px'
            }}>
              <button
                className={`itn-btn ${activeView === 'list' ? 'primary' : 'ghost'}`}
                onClick={() => setActiveView('list')}
                style={{ flex: 1, fontSize: '13px', padding: '8px 12px' }}
              >
                All Items
              </button>
              <button
                className={`itn-btn ${activeView === 'grouped' ? 'primary' : 'ghost'}`}
                onClick={() => setActiveView('grouped')}
                style={{ flex: 1, fontSize: '13px', padding: '8px 12px' }}
              >
                By Trip Group
              </button>
            </div>
          )}

>>>>>>> f1d6feb7a9f1cc032ac6cc07aa0a7a9db71801c1
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
<<<<<<< HEAD
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
=======
            {activeView === 'grouped' && groups && groups.length > 0 ? (
              // Grouped View
              <>
                {groupedItems.map(group => (
                  <div key={group.id} style={{ borderBottom: '2px solid #e5e7eb' }}>
                    {/* Group Header */}
                    <div 
                      style={{
                        padding: '12px 16px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        color: '#fff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        position: 'sticky',
                        top: 0,
                        zIndex: 10
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '15px' }}>
                          {group.name || 'Untitled Trip'}
                        </div>
                        <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>
                          {group.items.length} destination{group.items.length !== 1 ? 's' : ''}
                          {group.startDate && ` | ${new Date(group.startDate).toLocaleDateString()}`}
                          {group.endDate && ` - ${new Date(group.endDate).toLocaleDateString()}`}
                        </div>
                      </div>
                      <button
                        onClick={() => selectAllInGroup(group.items)}
                        style={{
                          background: 'rgba(255,255,255,0.2)',
                          border: 'none',
                          color: '#fff',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        {group.items.every(item => selected.has(item.id)) ? 'Deselect Group' : 'Select Group'}
                      </button>
                    </div>

                    {/* Group Items */}
                    {group.items.map(item => (
                      <ExportItem 
                        key={item.id} 
                        item={item} 
                        selected={selected} 
                        onToggle={onToggle}
                        dayNumber={group.assignments?.[item.id]}
                      />
                    ))}

                    {group.items.length === 0 && (
                      <div style={{ padding: '16px', color: '#94a3b8', textAlign: 'center', fontSize: '14px' }}>
                        No destinations in this group
                      </div>
                    )}
                  </div>
                ))}

                {/* Ungrouped Items */}
                {ungroupedItems.length > 0 && (
                  <div>
                    <div 
                      style={{
                        padding: '12px 16px',
                        background: '#64748b',
                        color: '#fff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        position: 'sticky',
                        top: 0,
                        zIndex: 10
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '15px' }}>
                          Ungrouped Destinations
                        </div>
                        <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>
                          {ungroupedItems.length} destination{ungroupedItems.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => selectAllInGroup(ungroupedItems)}
                        style={{
                          background: 'rgba(255,255,255,0.2)',
                          border: 'none',
                          color: '#fff',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        {ungroupedItems.every(item => selected.has(item.id)) ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    {ungroupedItems.map(item => (
                      <ExportItem 
                        key={item.id} 
                        item={item} 
                        selected={selected} 
                        onToggle={onToggle}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              // List View (default)
              items.map(item => (
                <ExportItem 
                  key={item.id} 
                  item={item} 
                  selected={selected} 
                  onToggle={onToggle}
                />
              ))
            )}
>>>>>>> f1d6feb7a9f1cc032ac6cc07aa0a7a9db71801c1
          </div>
        </div>

        <div className="confirmation-footer">
          <button className="itn-btn ghost" onClick={onClose}>Cancel</button>
<<<<<<< HEAD
          <button className="itn-btn primary" onClick={onExport} disabled={exporting}>
            {exporting ? "Exporting…" : "Export to PDF"}
          </button>
        </div>
      </div>
=======
          <button 
            className="itn-btn primary" 
            onClick={onExport} 
            disabled={exporting || selected.size === 0}
          >
            {exporting ? "Exporting..." : `Export ${selected.size} to PDF`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Separate component for each export item
function ExportItem({ item, selected, onToggle, dayNumber }) {
  // Format activities for display
  const activities = Array.isArray(item.activities) ? item.activities : 
                     (item.activities ? String(item.activities).split(",").map(a => a.trim()).filter(a => a) : []);
  
  // Check what details are available
  const hasAccom = item.accomType || item.accomName;
  const hasBudget = item.estimatedExpenditure || item.budget;
  const hasPacking = item.packingSuggestions && (Array.isArray(item.packingSuggestions) ? item.packingSuggestions.length > 0 : item.packingSuggestions);

  return (
    <div
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {dayNumber && (
            <span style={{
              background: '#6366f1',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '700'
            }}>
              Day {dayNumber}
            </span>
          )}
          <div style={{ fontWeight: 700, color: "#0f172a" }}>{item.name}</div>
        </div>
        
        {item.region && (
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{item.region}</div>
        )}
        
        {/* Dates and Status */}
        <div style={{ marginTop: 8, fontSize: 12, color: "#475569", display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {item.arrival && <span>Arrival: {item.arrival}</span>}
          {item.departure && <span>Departure: {item.departure}</span>}
          {item.status && <span>Status: {item.status}</span>}
        </div>

        {/* Budget */}
        {hasBudget && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#059669", fontWeight: 600 }}>
            Budget: P{Number(item.estimatedExpenditure || item.budget).toLocaleString()}
          </div>
        )}

        {/* Accommodation */}
        {hasAccom && (
          <div style={{ marginTop: 4, fontSize: 11, color: "#64748b" }}>
            Accommodation: {item.accomType}{item.accomType && item.accomName ? ' - ' : ''}{item.accomName}
          </div>
        )}

        {/* Activities */}
        {activities.length > 0 && (
          <div style={{ marginTop: 4, fontSize: 11, color: "#64748b" }}>
            Activities: {activities.slice(0, 3).join(", ")}{activities.length > 3 ? ` (+${activities.length - 3} more)` : ''}
          </div>
        )}

        {/* Packing indicator */}
        {hasPacking && (
          <div style={{ marginTop: 4, fontSize: 11, color: "#64748b" }}>
            Packing list included
          </div>
        )}

        {/* Transport */}
        {item.transport && (
          <div style={{ marginTop: 4, fontSize: 11, color: "#64748b" }}>
            Transport: {item.transport}
          </div>
        )}
      </div>
      <span
        className={`itn-badge ${item.status?.toLowerCase() || ""}`}
        style={{ whiteSpace: "nowrap" }}
      >
        {item.status}
      </span>
>>>>>>> f1d6feb7a9f1cc032ac6cc07aa0a7a9db71801c1
    </div>
  );
}