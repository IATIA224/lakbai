import React, { useEffect, useMemo, useState } from 'react';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import ViewAuditLogModal from './viewauditlog-cms'; // NEW

// Colors & badge presets (tuned to screenshot)
const CATEGORY_STYLES = {
  AUTHENTICATION: { bg: '#e0f2fe', fg: '#0369a1' },
  'USER MANAGEMENT': { bg: '#d1fae5', fg: '#065f46' }, // green background
  'CONTENT DELETION': { bg: '#fee2e2', fg: '#b91c1c' }, // <-- Red background for CONTENT DELETION
  'CONTENT CREATION': { bg: '#ede9fe', fg: '#5b21b6' },
  MODERATION: { bg: '#fef3c7', fg: '#b45309' },
  'DATA ACCESS': { bg: '#cffafe', fg: '#155e75' },
  'SYSTEM ADMINISTRATION': { bg: '#f1f5f9', fg: '#334155' },
  SECURITY: { bg: '#ffe4e6', fg: '#be123c' },
  'ACCESS CONTROL': { bg: '#fef9c3', fg: '#92400e' },
  'SYSTEM MAINTENANCE': { bg: '#ede9fe', fg: '#4c1d95' },
  'DESTINATION IMAGE': { bg: '#fee0efff', fg: '#ff3c9dff' }, // <-- Blue background for IMAGE UPLOAD
  'DEST. IMAGE DELETE': { bg: '#fee2e2', fg: '#b91c1c' }, // <-- Red background for IMAGE DELETE
  'DESTINATION IMPORT': { bg: '#d1fae5', fg: '#3eaaaaff' }, // <-- Green background for IMPORT
  'UPDATE DESTINATION': { bg: '#feffdcff', fg: '#5e5f06ff' } // green background
};

const OUTCOME_STYLES = {
  SUCCESS: { bg: '#dcfce7', fg: '#166534' },
  FAILURE: { bg: '#fee2e2', fg: '#b91c1c' }
};

const ROLE_STYLES = {
  admin: { fg: '#111827' },
  moderator: { fg: '#4f46e5' },
  system: { fg: '#334155' },
  user: { fg: '#475569' },
  anonymous: { fg: '#6b7280' }
};

const ACTION_ICONS = {
  login: '🔐',
  'login failed': '❌',
  'user update': '✏️',
  'photo upload': '📷',
  'content delete': '🗑️',
  'data export': '📤',
  'config change': '⚙️',
  'suspicious activity': '🚨',
  'permission change': '🔑',
  'rate limit exceeded': '⏱️',
  'review create': '⭐',
  'backup create': '💾',
  'destination import': '🛫'
};

// NEW: sizing / typography scale (adjust numbers to taste)
const FS = {
  h1: 26,
  base: 15,
  tableCell: 15,
  tableHeader: 14,
  badge: 12,
  small: 13,
  tiny: 11.5
};

// NEW: shared UI styles (fixes 'UI is not defined')
const UI = {
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 16,
    boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
  },
  softBorder: '1px solid #dbe1e7'
};

// CHANGE weights: make everything "regular" (normal) in rows/modal
const W = { primary: 400, secondary: 400, subtle: 400 }; // was {600,400,400}

function Badge({ text, palette, mono = false }) {
  const sty = palette || { bg: '#f1f5f9', fg: '#334155' };
  return (
    <span
      style={{
        background: mono ? 'transparent' : sty.bg,
        color: sty.fg,
        fontWeight: 600,
        fontSize: FS.badge,            // CHANGED
        padding: '6px 12px',           // CHANGED
        borderRadius: 999,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        lineHeight: 1.05,
        letterSpacing: .25,
        boxShadow: mono ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,.35)'
      }}
    >
      {text}
    </span>
  );
}

function tiny(ts) {
  if (!ts) return '';
  // Firestore Timestamp object
  if (ts.toDate) return ts.toDate().toLocaleString();
  // Milliseconds number fallback
  if (typeof ts === "number") return new Date(ts).toLocaleString();
  // ISO string fallback
  if (typeof ts === "string") return new Date(ts).toLocaleString();
  return '';
}

function exportCsv(rows) {
  const headers = [
    'timestamp',
    'userName',
    'userEmail',
    'role',
    'action',
    'category',
    'targetType',
    'userAgent',
    'outcome',
    'details'
  ];
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const csv =
    headers.join(',') +
    '\n' +
    rows
      .map((r) =>
        headers
          .map((h) => {
            if (h === 'timestamp') return esc(new Date(r.timestamp).toISOString());
            return esc(r[h] ?? '');
          })
          .join(',')
      )
      .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'audit_logs.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function AuditLogsCMS({ useFirestore = true, pageSize = 200 }) {
  const db = useMemo(() => {
    try {
      return getFirestore();
    } catch {
      return null;
    }
  }, []);

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [outcome, setOutcome] = useState('All');
  const [role, setRole] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewLog, setViewLog] = useState(null);

  // Load
  useEffect(() => {
    let unsub;
    let cancelled = false;
    async function load() {
      setLoading(true);
      if (db && useFirestore) {
        try {
          // --- CHANGED: Remove limit(pageSize) to fetch all logs ---
          const baseQ = query(
            collection(db, 'auditLogs'),
            orderBy('timestamp', 'desc')
            // No limit here!
          );
          unsub = onSnapshot(
            baseQ,
            (snap) => {
              if (cancelled) return;
              setLogs(
                snap.docs.map((d) => ({
                  id: d.id,
                  ...d.data()
                }))
              );
              setLoading(false);
            },
            () => {
              setLogs([]);
              setLoading(false);
            }
          );
          return;
        } catch {
          try {
            // --- CHANGED: Remove limit(pageSize) to fetch all logs ---
            const snap = await getDocs(
              query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'))
            );
            if (!cancelled) {
              setLogs(
                snap.docs.map((d) => ({
                  id: d.id,
                  ...d.data()
                }))
              );
            }
          } catch {
            if (!cancelled) setLogs([]);
          }
        }
      } else {
        setLogs([]);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
      if (typeof unsub === 'function') unsub();
    };
  }, [db, useFirestore, pageSize]);

  // Only use real categories from logs
  const categoriesList = useMemo(
    () => ['All', ...Array.from(new Set(logs.map((l) => l.category))).sort()],
    [logs]
  );
  const rolesList = ['All', 'admin', 'moderator', 'user', 'system', 'anonymous'];
  const outcomesList = ['All', 'SUCCESS', 'FAILURE'];

  const filtered = useMemo(() => {
    const sTerm = search.trim().toLowerCase();
    const sTs = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
    const eTs = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;
    return logs.filter((l) => {
      if (category !== 'All' && l.category !== category) return false;
      if (outcome !== 'All' && l.outcome !== outcome) return false;
      if (role !== 'All' && l.role !== role) return false;
      if (sTerm) {
        const blob = `${l.userName} ${l.userEmail} ${l.action} ${l.category} ${l.details} ${l.targetType} ${l.targetId}`.toLowerCase();
        if (!blob.includes(sTerm)) return false;
      }
      if (sTs && (!l.timestamp || l.timestamp < sTs)) return false;
      if (eTs && (!l.timestamp || l.timestamp > eTs)) return false;
      return true;
    });
  }, [logs, search, category, outcome, role, startDate, endDate]);

  // NEW: outcome counts (fixes 'totalSuccess/totalFailure is not defined')
  const totalSuccess = filtered.reduce((n, l) => n + (l.outcome === 'SUCCESS' ? 1 : 0), 0);
  const totalFailure = filtered.reduce((n, l) => n + (l.outcome === 'FAILURE' ? 1 : 0), 0);

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', fontSize: FS.base }}> {/* CHANGED */}
      {/* HEADER BAR */}
      <div
        style={{
          background: 'linear-gradient(90deg,#0f172a,#1e3a8a)',
          padding: '26px 30px',                // CHANGED
          borderRadius: 20,                    // CHANGED
          color: '#fff',
            display: 'flex',
          alignItems: 'center',
          gap: 28,
          marginBottom: 26,                    // CHANGED
          boxShadow: '0 10px 28px -6px rgba(0,0,0,0.35)'
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: FS.h1, fontWeight: 700, letterSpacing: .4 }}>Audit Logs</div> {/* CHANGED */}
          <div style={{ fontSize: FS.small, opacity: .78 }}>Monitor system activities and security events</div> {/* CHANGED */}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}> {/* CHANGED */}
          <div style={{ background: '#1e293b', padding: '10px 18px', borderRadius: 12, fontSize: FS.small, fontWeight: 600 }}>
            Total: {filtered.length}
          </div>
          <div style={{ background: OUTCOME_STYLES.SUCCESS.bg, color: OUTCOME_STYLES.SUCCESS.fg, padding: '10px 18px', borderRadius: 12, fontSize: FS.small, fontWeight: 600 }}>
            Success: {totalSuccess}
          </div>
          <div style={{ background: OUTCOME_STYLES.FAILURE.bg, color: OUTCOME_STYLES.FAILURE.fg, padding: '10px 18px', borderRadius: 12, fontSize: FS.small, fontWeight: 600 }}>
            Failures: {totalFailure}
          </div>
          <button
            onClick={() => exportCsv(filtered)}
            style={{
              background: 'linear-gradient(90deg,#059669,#10b981)',
              color: '#fff',
              border: 'none',
              padding: '12px 24px',            // CHANGED
              fontWeight: 700,
              borderRadius: 12,                // CHANGED
              cursor: 'pointer',
              fontSize: FS.small,
              boxShadow: '0 6px 16px -2px rgba(16,185,129,.45)'
            }}
          >
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div
        style={{
          ...UI.card,
          padding: 22,                                        // CHANGED
          display: 'grid',
          gridTemplateColumns: 'minmax(280px,1fr) repeat(3,190px) repeat(2,190px) 140px', // CHANGED
          gap: 18,                                            // CHANGED
          alignItems: 'end',
          marginBottom: 26,
          overflow: 'hidden'
        }}
      >
        {/* search input */}
        <div style={{ position: 'relative' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs..."
            style={{
              width: '100%',
              padding: '14px 16px 14px 50px',                // CHANGED
              borderRadius: 12,                              // CHANGED
              border: UI.softBorder,
              fontSize: FS.base,
              background: '#f1f5f9'
            }}
          />
          <span style={{ position: 'absolute', top: 14, left: 18, fontSize: 22, opacity: .55 }}>🔍</span> {/* CHANGED */}
        </div>
        {/* selects updated via selectStyle() below */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="form-input"
          style={selectStyle()}
        >
          {categoriesList.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          className="form-input"
          style={selectStyle()}
        >
          {outcomesList.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="form-input"
          style={selectStyle()}
        >
          {rolesList.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#6b7280',
                marginBottom: 4
              }}
            >
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={dateInputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#6b7280',
                marginBottom: 4
              }}
            >
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={dateInputStyle}
            />
          </div>
        </div>
      </div>

      {/* TABLE WRAPPER */}
      <div
        style={{
          ...UI.card,
          padding: 0,
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            display: 'grid',
            gridTemplateColumns: '190px 240px 190px 200px 190px 260px 140px 120px', // Balanced columns
            background: 'linear-gradient(90deg,#f1f5f9,#f8fafc)',
            fontSize: FS.tableHeader,
            fontWeight: 700,
            letterSpacing: .5,
            color: '#475569',
            borderBottom: '1px solid #e2e8f0',
            backdropFilter: 'blur(4px)'
          }}
        >
          {['Timestamp', 'User', 'Action', 'Category', 'Target', 'Source', 'Outcome', 'Actions'].map(
            (h) => (
              <div
                key={h}
                style={{ padding: '12px 14px', borderBottom: '1px solid #e5e7eb' }}
              >
                {h}
              </div>
            )
          )}
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 14 }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 14 }}>No logs found.</div>
        ) : (
          filtered.map((l, i) => {
            // Normalize category to uppercase for style lookup and display
            const categoryKey = (l.category || '').toUpperCase();
            const catSty = CATEGORY_STYLES[categoryKey] || CATEGORY_STYLES['SYSTEM ADMINISTRATION'];
            const outSty = OUTCOME_STYLES[l.outcome] || OUTCOME_STYLES.SUCCESS;
            const roleSty = ROLE_STYLES[l.role] || ROLE_STYLES.user;
            const icon = ACTION_ICONS[l.action] || '🗂️';
            const isFailure = l.outcome === 'FAILURE';
            return (
              <div
                key={l.id || i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '190px 240px 190px 200px 190px 260px 140px 120px', // Balanced columns
                  fontSize: FS.tableCell,
                  background: isFailure ? '#fff6f6' : (i % 2 ? '#ffffff' : '#f5f7fa'),
                  borderBottom: '1px solid #eef2f6',
                  transition: 'background .15s'
                }}
                onMouseEnter={e=>e.currentTarget.style.background = isFailure ? '#ffe2e2' : '#e8f2ff'}
                onMouseLeave={e=>e.currentTarget.style.background = isFailure ? '#fff6f6' : (i % 2 ? '#ffffff' : '#f5f7fa')}
              >
                <div style={{ padding:'16px 20px', fontWeight: W.primary }}>{tiny(l.timestamp)}</div> {/* CHANGED padding */}
                {/* User */}
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontWeight: W.primary }}>{l.userName || '—'}</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#64748b',
                      fontWeight: W.secondary,            // CHANGED (was 500/600)
                      marginTop: 2
                    }}
                  >
                    {l.role && (
                      <span style={{ color: roleSty.fg, fontWeight: W.secondary }}>{l.role}</span> // CHANGED
                    )}
                    {l.userEmail && (
                      <>
                        {' • '}
                        <span style={{ fontWeight: W.secondary }}>{l.userEmail}</span>
                      </>
                    )}
                  </div>
                </div>
                {/* Action */}
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{icon}</span>
                    <span style={{ fontWeight: W.primary }}>{l.action}</span>
                  </div>
                  {l.details && (
                    <div
                      style={{
                        fontSize: 10,
                        color: '#be123c',
                        fontWeight: W.subtle,              // CHANGED (remove bold)
                        marginTop: 4,
                        lineHeight: 1.2,
                        textTransform: 'lowercase'
                      }}
                    >
                      {l.details.replace(/_/g, ' ')}
                    </div>
                  )}
                </div>
                {/* Category */}
                <div style={{ padding: '12px 14px' }}>
                  <Badge text={categoryKey} palette={catSty} />
                </div>
                {/* Target */}
                <div style={{ padding: '12px 14px' }}>
                  {l.target || '—'}
                </div>
                {/* Source */}
                <div style={{ padding: '12px 14px', wordBreak: 'break-all', fontSize: 12 }}>
                  {l.userAgent || '—'}
                </div>
                {/* Outcome */}
                <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Badge text={l.outcome} palette={outSty} />
                </div>
                {/* Actions */}
                <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button
                    style={{
                      background: '#e0e7ff',
                      color: '#1d4ed8',
                      border: 'none',
                      padding: '4px 14px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                    onClick={() => setViewLog(l)}
                  >
                    View
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ fontSize: FS.small, marginTop:16, color:'#64748b', fontWeight:500 }}>{filtered.length} entries</div> {/* CHANGED */}

      {/* MODAL size adjustments */}
      <ViewAuditLogModal
        open={!!viewLog}
        log={viewLog}
        onClose={() => setViewLog(null)}
      />
    </div>
  );
}

// UPDATED helper styles
function selectStyle() {
  return {
    padding: '14px 14px',          // CHANGED
    borderRadius: 12,              // CHANGED
    border: '1px solid #dbe1e7',
    background: '#f1f5f9',
    fontSize: FS.base,
    fontWeight: 500,
    outline: 'none'
  };
}
const dateLabelStyle = { fontSize:FS.tiny, textTransform:'uppercase', fontWeight:700, letterSpacing:.8, color:'#64748b', display:'block', marginBottom:6 }; // CHANGED
const dateInputStyle = { padding:'12px 14px', borderRadius:12, border:'1px solid #dbe1e7', background:'#f1f5f9', fontSize:FS.base }; // CHANGED
function ghostBtn(){
  return {
    flex:1,
    background:'#f1f5f9',
    color:'#334155',
    border:'1px solid #dbe1e7',
    padding:'12px 18px',          // CHANGED
    borderRadius:12,              // CHANGED
    fontSize:FS.base,
    fontWeight:600,
    cursor:'pointer'
  };
}

// NEW: log sample (for testing)
async function logSample(user) {
  const db = getFirestore();
  await addDoc(collection(db, "auditLogs"), {
    timestamp: Date.now(),
    userName: user.displayName || "",
    userEmail: user.email,
    role: "admin", // or "user"
    action: "login",
    category: "AUTHENTICATION",
    outcome: "SUCCESS",
    details: "",
  });
}
async function logSample1(user) {
  const db = getFirestore();
  await addDoc(collection(db, "auditLogs"), {
  timestamp: Date.now(),
  userName: user.displayName || "",
  userEmail: user.email,
  role: "admin", // or "user"
  action: "logout",
  category: "AUTHENTICATION",
  outcome: "SUCCESS",
  details: "",
});
}

<AuditLogsCMS useFirestore={true} pageSize={200} />