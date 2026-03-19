import React, { useState, useEffect } from "react";
import SharedItineraryCard from "./components/trip_components/SharedItineraryCard";
import EditDestinationModal from "./Itinerary";

export default function SharedItinerariesTab({ userId, items, loading, onEdit, onRemove }) {
  const [editing, setEditing] = useState(null);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '300px',
        color: '#94a3b8'
      }}>
        ⏳ Loading shared itineraries...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '60px' }}>🤝</div>
        <h3 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#1e293b',
          margin: 0
        }}>
          No Shared Itineraries Yet
        </h3>
        <p style={{
          fontSize: '14px',
          color: '#64748b',
          margin: 0
        }}>
          Ask a friend to share their itinerary with you!
        </p>
      </div>
    );
  }

  return (
    <div className="itn-shared-itineraries">
      {items.map((shared) => (
        <div key={shared.id} style={{ marginBottom: '32px' }}>
          <div style={{
            padding: '16px',
            background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
            borderRadius: '12px 12px 0 0',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700' }}>
                👤 {shared.sharedBy.name}'s Itinerary
              </h3>
              <p style={{ margin: 0, fontSize: '13px', opacity: 0.9 }}>
                {shared.items.length} destination{shared.items.length !== 1 ? 's' : ''}
              </p>
            </div>
            <span style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              Shared
            </span>
          </div>

          <div style={{
            background: '#f8fafc',
            borderRadius: '0 0 12px 12px',
            padding: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px'
          }}>
            {shared.items.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '32px 16px',
                color: '#94a3b8'
              }}>
                📭 No destinations in this itinerary
              </div>
            ) : (
              shared.items.map((item, idx) => (
                <SharedItineraryCard
                  key={item.id}
                  item={item}
                  index={idx}
                  isOwner={false}
                  sharedBy={shared.sharedBy.name}
                  onEdit={(item) => setEditing(item)}
                  onRemove={(itemId) => onRemove(itemId)}
                />
              ))
            )}
          </div>
        </div>
      ))}

      {editing && (
        <EditDestinationModal
          initial={editing}
          onSave={async (updatedItem) => {
            await onEdit(editing.id, updatedItem);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}