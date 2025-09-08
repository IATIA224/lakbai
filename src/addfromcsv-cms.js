import React, { useEffect, useMemo, useState } from 'react';
import { db } from './firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

// ---- Parsing helpers ----
function parseCsv(text) {
  // Robust CSV parser with quotes support
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;

  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { rows.push(row); row = []; };

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; } // escaped quote
        inQuotes = false; i++; continue;
      } else {
        field += ch; i++; continue;
      }
    } else {
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ',') { pushField(); i++; continue; }
      if (ch === '\n') { pushField(); pushRow(); i++; continue; }
      if (ch === '\r') { // handle CRLF
        if (text[i + 1] === '\n') i++;
        pushField(); pushRow(); i++; continue;
      }
      field += ch; i++;
    }
  }
  // last field/row
  pushField();
  if (row.length > 1 || (row.length === 1 && row[0].trim() !== '')) pushRow();

  return rows;
}

const XLSX_CDN = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

function loadXlsxLib() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const s = document.createElement('script');
    s.src = XLSX_CDN;
    s.async = true;
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error('Failed to load XLSX library'));
    document.head.appendChild(s);
  });
}

function fileExt(name = '') {
  const m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/i);
  return m ? m[1] : '';
}

async function readGridFromFile(file) {
  const ext = fileExt(file.name);
  const isExcel = /xlsx|xls/.test(ext) || /sheet|excel/.test(file.type);
  if (!isExcel) {
    // CSV
    const text = await file.text();
    return parseCsv(text);
  }
  // Excel
  const ab = await file.arrayBuffer();
  const XLSX = await loadXlsxLib();
  const wb = XLSX.read(ab, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  return grid;
}

function toCamelKey(s) {
  return String(s || '')
    .trim()
    .replace(/^[\W_]+|[\W_]+$/g, '')
    .toLowerCase()
    .replace(/[\W_]+(\w)/g, (_, c) => (c || '').toUpperCase());
}

// ---- Validation helpers ----

// Canonical required columns and their user-facing labels
const REQUIRED = {
  name: 'Destination Name',
  region: 'Region',
  category: 'Category',
  description: 'Description',
  tags: 'Tags',
  location: 'Location',
  bestTime: 'Best Time to Visit',
};

// Aliases that map incoming headers to canonical keys
const ALIASES = {
  name: ['name', 'destinationname', 'destination', 'title'],
  region: ['region', 'province', 'area', 'state'],
  category: ['category', 'type', 'segment'],
  description: ['description', 'summary', 'details'],
  tags: ['tags', 'keywords', 'labels'],
  location: ['location', 'city', 'place'],
  bestTime: ['besttime', 'besttimetovisit', 'season'],
};

// Build a quick lookup set of normalized header keys
function headerKeySet(headers) {
  const set = new Set();
  for (const h of headers) set.add(toCamelKey(h).toLowerCase());
  return set;
}

// For a given row object and an alias list, return the first non-empty value
function getFirstValue(row, aliases) {
  for (const k of aliases) {
    const v = row[k];
    if (v !== undefined && String(v).trim() !== '') return v;
  }
  return '';
}

function normalizeRowObject(rowArray, headersRaw) {
  const obj = {};
  headersRaw.forEach((h, idx) => {
    obj[toCamelKey(h).toLowerCase()] = rowArray[idx] ?? '';
  });
  return obj;
}

// ---- Row -> Destination mapping ----
function rowToDestination(raw) {
  // Helper: read using aliases and defaults
  const g = (keys, def = '') => {
    const v = getFirstValue(raw, keys);
    return v === '' ? def : v;
  };

  const name = g(ALIASES.name);
  if (!name) return null;

  const tagsRaw = g(ALIASES.tags, '');
  const tags = String(tagsRaw)
    .split(/[|,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const galleryRaw = raw.gallery || raw.galleryImages || raw.mediaGallery || '';
  const gallery = String(galleryRaw)
    .split(/[|,; ]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const ratingStr = raw.rating || raw.stars || '0';
  const rating = Math.max(0, Math.min(5, Number(ratingStr) || 0));

  const status = String(raw.status ?? 'draft').toLowerCase();

  const dest = {
    name: String(name).trim(),
    category: g(ALIASES.category, ''),
    description: g(ALIASES.description, ''),
    content: raw.content || raw.body || raw.html || '',
    tags,
    location: g(ALIASES.location, ''),
    region: g(ALIASES.region, ''), // keep region if provided
    priceRange: raw.pricerange || raw.price || raw.budget || '',
    bestTime: g(ALIASES.bestTime, ''),
    rating,
    media: {
      featuredImage: raw.featuredimage || raw.image || raw.cover || '',
      gallery
    },
    status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const featured = String(raw.featured ?? raw.isfeatured ?? '').toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(featured)) dest.featured = true;

  return dest;
}

const AddFromCsvCMS = ({ open, onClose, onImported }) => {
  const [rows, setRows] = useState([]);           // array of normalized row objects (keys = normalized headers)
  const [headers, setHeaders] = useState([]);     // raw headers as strings
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [missingColumns, setMissingColumns] = useState([]); // array of user-facing labels
  const [rowIssues, setRowIssues] = useState([]);           // [{ row: 2, missing: ['Destination Name', ...] }]

  // NEW: helper to reset modal state when it closes
  const resetModal = () => {
    setRows([]);
    setHeaders([]);
    setError('');
    setMissingColumns([]);
    setRowIssues([]);
    setBusy(false);
  };

  // NEW: when modal closes (open -> false), clear previous content
  useEffect(() => {
    if (!open) resetModal();
  }, [open]);

  // Replace the preview memo to show ALL rows (scrollable container will limit the height)
  const preview = useMemo(() => rows, [rows]);

  // NEW: close on Esc key while open
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!busy) onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onClose]);

  useEffect(() => {
    if (!headers.length) {
      setMissingColumns([]);
      setRowIssues([]);
      return;
    }
    // Header validation
    const setKeys = headerKeySet(headers);
    const missing = [];
    for (const [canon, label] of Object.entries(REQUIRED)) {
      const aliases = ALIASES[canon] || [canon];
      const present = aliases.some((k) => setKeys.has(k));
      if (!present) missing.push(label);
    }
    setMissingColumns(missing);

    // Row validation
    if (rows.length) {
      const issues = [];
      rows.forEach((r, idx) => {
        const miss = [];
        for (const [canon, label] of Object.entries(REQUIRED)) {
          const aliases = ALIASES[canon] || [canon];
          const val = getFirstValue(r, aliases);
          if (String(val).trim() === '') miss.push(label);
        }
        if (miss.length) issues.push({ row: idx + 2, missing: miss }); // +2 to account for header row
      });
      setRowIssues(issues);
    } else {
      setRowIssues([]);
    }
  }, [headers, rows]);

  if (!open) return null;

  const handleGrid = (grid) => {
    if (!grid || !grid.length) throw new Error('No data found in file.');
    const hdrs = grid[0];
    const body = grid.slice(1).filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''));
    const normalizedRows = body.map((r) => normalizeRowObject(r, hdrs));
    setHeaders(hdrs);
    setRows(normalizedRows);
  };

  const handleFile = async (file) => {
    setError('');
    try {
      const grid = await readGridFromFile(file);
      handleGrid(grid);
    } catch (e) {
      console.error(e);
      setRows([]);
      setHeaders([]);
      setError(e?.message || 'Failed to read file.');
    }
  };

  const handlePaste = (e) => {
    const text = e.clipboardData?.getData('text') || '';
    if (!text) return;
    e.preventDefault();
    try {
      const grid = parseCsv(text);
      handleGrid(grid);
      setError('');
    } catch {
      setError('Failed to parse pasted CSV.');
    }
  };

  const downloadTemplate = () => {
    const template =
      'Destination Name,Region,Category,Description,Content,Tags,Location,Price Range,Best Time to Visit,Rating,Status,Featured Image,Gallery\n' +
      'Boracay,Aklan,Beach,"White sand beach","<p>Paradise</p>","beach, island",Aklan,$$$,Dec-May,5,published,https://res.cloudinary.com/.../boracay.jpg,https://.../1.jpg|https://.../2.jpg';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'destinations-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importNow = async () => {
    if (!rows.length) return;
    if (missingColumns.length) return alert('Please include all required columns before importing.');
    if (rowIssues.length) return alert('Please fill all required cells before importing.');

    setBusy(true);
    try {
      // Map rows to destination docs
      const toCreate = [];
      for (const raw of rows) {
        const dest = rowToDestination(raw);
        if (dest) toCreate.push(dest);
      }
      if (!toCreate.length) {
        alert('No valid rows to import.');
        return;
      }

      // Create in Firestore (destinations)
      const now = new Date();
      const created = [];
      for (const item of toCreate) {
        try {
          const ref = await addDoc(collection(db, 'destinations'), item);
          created.push({ ...item, id: ref.id, createdAt: now, updatedAt: now });
        } catch (e) {
          console.warn('Failed to create a row:', e?.message);
        }
      }

      if (created.length) {
        onImported?.(created);
        alert(`Imported ${created.length} destination(s).`);
        onClose?.();
      } else {
        alert('No rows were imported.');
      }
    } catch (e) {
      console.error(e);
      alert('Import failed.');
    } finally {
      setBusy(false);
    }
  };

  const disableImport = busy || rows.length === 0 || missingColumns.length > 0 || rowIssues.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose?.(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ width: 'min(2000px,98vw)', height: 'min(900px,95vh)', background: '#fff', borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,.25)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Add Destinations from CSV/Excel</div>
          <button onClick={() => !busy && onClose?.()} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1 }} aria-label="Close">×</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'grid', gap: 12 }}>
          <div className="muted" style={{ fontSize: 13 }}>
            Required columns: Destination Name, Region, Category, Description, Tags, Location, Best Time to Visit
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              disabled={busy}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={downloadTemplate}
              disabled={busy}
              style={{ padding: '8px 14px', borderRadius: 8 }}
            >
              Download Template
            </button>
          </div>

          <div
            onPaste={handlePaste}
            style={{ padding: 12, border: '1px dashed #cbd5e1', borderRadius: 8, color: '#475569', fontSize: 13, background: '#f8fafc' }}
            title="Click here and paste CSV content (Ctrl/Cmd + V)"
            tabIndex={0}
          >
            Click here and paste CSV content (Ctrl/Cmd + V) or use the file picker above.
          </div>

          {error && <div style={{ color: '#b91c1c', fontSize: 13 }}>{error}</div>}

          {missingColumns.length > 0 && (
            <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 8, padding: 12 }}>
              Missing required column(s): {missingColumns.join(', ')}
            </div>
          )}

          {rowIssues.length > 0 && (
            <div style={{ background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa', borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                {rowIssues.length} row{rowIssues.length > 1 ? 's' : ''} have missing required values:
              </div>
              <div style={{ maxHeight: 180, overflow: 'auto', fontSize: 13 }}>
                {rowIssues.slice(0, 100).map((it, i) => (
                  <div key={i}>Row {it.row}: {it.missing.join(', ')}</div>
                ))}
                {rowIssues.length > 100 && <div>…and {rowIssues.length - 100} more</div>}
              </div>
            </div>
          )}

          {rows.length > 0 && (
            <div style={{ borderTop: '1px solid #eef2f7', paddingTop: 12 }}>
              <div style={{ marginBottom: 8, fontWeight: 700 }}>
                Preview ({rows.length} row{rows.length > 1 ? 's' : ''})
              </div>
              <div
                style={{
                  overflow: 'auto',
                  border: '1px solid #eef2f7',
                  borderRadius: 8,
                  maxHeight: 295, // keep preview area size steady and scroll within
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f6f8fa', color: '#6b7280', fontWeight: 700 }}>
                      {headers.map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '8px 10px',
                            textAlign: 'left',
                            position: 'sticky',  // keep header visible while scrolling
                            top: 0,
                            background: '#f6f8fa',
                            zIndex: 1,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 ? '#fff' : '#fafbfc' }}>
                        {headers.map((h) => {
                          const k = toCamelKey(h).toLowerCase();
                          return (
                            <td key={h} style={{ padding: '8px 10px', fontSize: 13 }}>
                              {String(r[k] ?? '')}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="muted small" style={{ marginTop: 6 }}>
                Scroll to view all rows.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn-secondary" onClick={() => !busy && onClose?.()} disabled={busy} style={{ padding: '10px 18px', borderRadius: 10 }}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={importNow}
            disabled={disableImport}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              background: disableImport ? '#9ca3af' : 'linear-gradient(90deg,#10b981,#059669)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              opacity: busy ? 0.85 : 1,
              cursor: disableImport ? 'not-allowed' : 'pointer'
            }}
          >
            {busy ? 'Importing...' : `Import ${rows.length} row${rows.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddFromCsvCMS;