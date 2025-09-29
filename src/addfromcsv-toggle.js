import React, { useState } from 'react';

// A simple toggle switch component for ignoring columns (no checkbox)
const AddFromCsvToggle = ({ label, checked, onChange }) => (
  <label
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      cursor: 'pointer',
      fontSize: 14,
      width: '100%',
      marginBottom: 6,
    }}
  >
    <span>{label.replace(/^Ignore\s+/, '')}</span>
    <span
      onClick={() => onChange(!checked)}
      style={{
        width: 36,
        height: 20,
        background: checked ? '#10b981' : '#d1d5db',
        borderRadius: 12,
        display: 'inline-block',
        position: 'relative',
        transition: 'background 0.2s',
        marginLeft: 4,
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: checked ? 18 : 2,
          top: 2,
          width: 16,
          height: 16,
          background: '#fff',
          borderRadius: '50%',
          boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
          transition: 'left 0.2s',
        }}
      />
    </span>
  </label>
);

// Dropdown menu for toggles
export const IgnoreColumnsDropdown = ({ columns, ignored, onToggle, presentColumns = [], disabled = false }) => {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'inline-block'}}>
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        style={{
          padding: '8px 16px',
          borderRadius: 6,
          border: '1px solid #d1d5db',
          background: disabled ? '#f3f4f6' : '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontWeight: 500,
          color: disabled ? '#9ca3af' : 'inherit',
        }}
      >
        Ignore Columns
      </button>
      {open && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: '110%',
            left: 0,
            background: '#fff',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            zIndex: 100,
            minWidth: 220,
            padding: 12,
          }}
        >
          {columns
            // Only show toggles for columns NOT present in CSV (i.e., missing columns)
            .filter(col => !presentColumns.includes(col))
            // Only show toggles for columns that are actually missing in the data (not just not present in headers)
            .map(col => (
              <AddFromCsvToggle
                key={col}
                label={`"${col}"`}
                checked={ignored.includes(col)}
                onChange={() => onToggle(col)}
              />
            ))}
        </div>
      )}
    </div>
  );
};

export default AddFromCsvToggle;