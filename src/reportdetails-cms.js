import React, { useEffect, useState } from 'react';

// Fallback badges (kept simple and self-contained)
const Badge = ({ bg, color, children }) => (
  <span style={{ background: bg, color, fontWeight: 700, fontSize: 12, padding: '2px 8px', borderRadius: 8 }}>
    {children}
  </span>
);

const PriorityBadge = ({ v }) => {
  const val = String(v || 'low').toLowerCase();
  if (val === 'high') return <Badge bg="#fee2e2" color="#b91c1c">High</Badge>;
  if (val === 'medium') return <Badge bg="#fef3c7" color="#b45309">Medium</Badge>;
  return <Badge bg="#dcfce7" color="#166534">Low</Badge>;
};

const StatusBadge = ({ v }) => {
  const val = String(v || 'pending').toLowerCase();
  if (val === 'resolved') return <Badge bg="#dcfce7" color="#166534">Resolved</Badge>;
  if (val === 'under_review') return <Badge bg="#e0f2fe" color="#0369a1">Under Review</Badge>;
  if (val === 'escalated') return <Badge bg="#fee2e2" color="#b91c1c">Escalated</Badge>;
  if (val === 'pending') return <Badge bg="#fef3c7" color="#b45309">Pending</Badge>;
  return <Badge bg="#e5e7eb" color="#374151">{val}</Badge>;
};

// Normalize the reported content payload into a consistent shape
function normalizeReportedContent(report) {
  const src = report?.content || report || {};
  const images = Array.isArray(src.images)
    ? src.images
    : Array.isArray(src.media?.images)
    ? src.media.images
    : src.image
    ? [src.image]
    : [];

  return {
    title: src.title || src.postTitle || report?.title || '',
    body: src.body || src.text || src.message || report?.body || '',
    location: src.location || report?.location || '',
    images,
    createdAt: src.createdAt || report?.contentCreatedAt || report?.createdAt || null,
  };
}

const ReportDetailModal = ({ report, onClose, onTakeAction, userNameCache = {} }) => {
  // Always call hooks; attach listeners only when report exists
  useEffect(() => {
    if (!report) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [report, onClose]);

  if (!report) return null;

  const typeStr = String(report.contentType || '').toLowerCase();
  const content = normalizeReportedContent(report);

  const toDateTime = (v) => {
    const d = v instanceof Date ? v : (v?.toDate ? v.toDate() : v ? new Date(v) : null);
    return d ? d.toLocaleString() : '—';
  };

  // resolve reported user's display name with broad fallbacks
  const ruId =
    report.reportedUserId ??
    report.reportedUserID ??
    report.reportedID ??
    (typeof report.reportedUser === 'string'
      ? report.reportedUser
      : report.reportedUser?.id) ??
    null;

  const ruName =
    report.reportedUserName ??                   // preferred
    report.reportedUsernName ??                  // typo fallback
    report.reported_user_name ??                 // snake_case fallback
    (typeof report.reportedUser === 'object' &&
      (report.reportedUser?.name || report.reportedUser?.displayName)) ??
    (ruId ? userNameCache[ruId] : null) ??       // cache from parent (if provided)
    '—';

  const avatarInitial = (ruName || 'U').trim().charAt(0).toUpperCase();

  const hasAnyContent =
    !!content.title ||
    !!content.body ||
    !!content.location ||
    (content.images && content.images.length > 0) ||
    !!content.createdAt;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ width: 'min(920px,96vw)', background: '#fff', borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,.25)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Report Details</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: '#111827' }} aria-label="Close">×</button>
        </div>

        {/* Two cards row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, padding: 18 }}>
          {/* Report Information */}
          <div style={{ background: '#fff', border: '1px solid #eef2f7', borderRadius: 12, padding: 16, boxShadow: '0 1px 2px rgba(0,0,0,.03)' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Report Information</div>
            <div style={{ fontSize: 13, color: '#111827' }}>
              <div style={{ marginBottom: 6 }}>
                <div style={{ color: '#6b7280', fontSize: 12 }}>Reported by:</div>
                <div style={{ fontWeight: 600 }}>{report.reporterName || '—'}</div>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ color: '#6b7280', fontSize: 12 }}>Reason:</div>
                <div style={{ textTransform: 'lowercase' }}>{(report.reason || '—').toLowerCase()}</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '8px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>Priority:</div>
                  <PriorityBadge v={report.priority} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>Status:</div>
                  <StatusBadge v={report.status} />
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ color: '#6b7280', fontSize: 12 }}>Reported:</div>
                <div>{toDateTime(report.createdAt)}</div>
              </div>
              {report.description && (
                <div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>Description:</div>
                  <div style={{ color: '#374151' }}>{report.description}</div>
                </div>
              )}
            </div>
          </div>

          {/* Reported User */}
          <div style={{ background: '#fff', border: '1px solid #eef2f7', borderRadius: 12, padding: 16, boxShadow: '0 1px 2px rgba(0,0,0,.03)' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Reported User</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 600 }}>
                {avatarInitial}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{ruName}</div>
                <div className="muted small">ID: {ruId || '—'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Reported Content (only if provided) */}
        <div style={{ padding: '0 18px 18px 18px' }}>
          <div style={{ background: '#fff', border: '1px solid #eef2f7', borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,.03)', overflow: 'hidden' }}>
            <div style={{ padding: 14, borderBottom: '1px solid #eef2f7', fontWeight: 700 }}>Reported Content</div>
            <div style={{ padding: 16 }}>
              {!hasAnyContent ? (
                <div className="muted" style={{ padding: 8 }}>No content attached to this report.</div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280', fontSize: 13, marginBottom: 8 }}>
                    <span role="img" aria-label={typeStr}>
                      {typeStr === 'comment' ? '💬' : typeStr === 'message' ? '✉️' : '📰'}
                    </span>
                    <span style={{ textTransform: 'capitalize' }}>{typeStr || 'content'}</span>
                    {content.createdAt && (<><span>•</span><span>{toDateTime(content.createdAt)}</span></>)}
                  </div>

                  {content.title && (
                    <div style={{ fontWeight: 800, marginBottom: 8, color: '#111827' }}>{content.title}</div>
                  )}
                  {content.body && (
                    <div style={{ color: '#374151', lineHeight: 1.6, marginBottom: 12 }}>{content.body}</div>
                  )}
                  {content.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280', marginBottom: 10 }}>
                      <span role="img" aria-label="pin">📍</span>
                      <span>{content.location}</span>
                    </div>
                  )}
                  {Array.isArray(content.images) && content.images.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {content.images.slice(0, 6).map((src, i) => (
                        <img key={i} src={src} alt="" style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #eef2f7' }} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer action */}
        <div style={{ padding: 18, display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e5e7eb' }}>
          <button
            type="button"
            onClick={() => onTakeAction?.(report)}
            style={{ background: 'linear-gradient(90deg,#2563eb,#3b82f6)', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 700 }}
          >
            Take Action
          </button>
        </div>
      </div>
    </div>
  );
};

// Take Action modal (self-contained)
const TakeActionModal = ({ report, onClose, onSubmit }) => {
  const [typeVal, setTypeVal] = useState('');
  const [reasonVal, setReasonVal] = useState('');
  const [notesVal, setNotesVal] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const disabled = !typeVal || !reasonVal || actionSubmitting;
  const name = report?.reportedUser?.name || 'the user';

  // Close on Esc
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleTakeAction = async (payload) => {
    try {
      setActionSubmitting(true);
      await Promise.resolve(onSubmit?.({ report, ...payload }));
      onClose?.();
    } catch (e) {
      console.warn('TakeAction error:', e?.message || e);
    } finally {
      setActionSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ width: 'min(640px,96vw)', background: '#fff', borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,.25)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Take Action on Report</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer' }} aria-label="Close">×</button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Alert banner */}
          <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: 12, display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ fontSize: 18, lineHeight: 1, marginTop: 2 }}>⚠️</div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Account Action Required</div>
              <div style={{ color: '#7f1d1d' }}>
                You are about to take action against <strong style={{ color: '#7f1d1d' }}>{name}</strong> for violating community guidelines.
              </div>
            </div>
          </div>

          {/* Action Type */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Action Type *</div>
            <select className="form-input" value={typeVal} onChange={(e) => setTypeVal(e.target.value)}>
              <option value="">Select an action</option>
              <option>Send Warning</option>
              <option>Remove Content Only</option>
              <option>Suspend Account</option>
              <option>Ban Account</option>
              <option>Permanently Delete Account</option>
              <option>Dismiss Report</option>
            </select>
          </div>

          {/* Reason */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Reason for Action *</div>
            <select className="form-input" value={reasonVal} onChange={(e) => setReasonVal(e.target.value)}>
              <option value="">Select reason</option>
              <option>Inappropriate Content</option>
              <option>Spam/Promotional Content</option>
              <option>Harassment/Bullying</option>
              <option>Fake/Misleading Content</option>
              <option>Hate Speech</option>
              <option>Violence/Threats</option>
              <option>Copyright Violation</option>
              <option>Privacy Violation</option>
              <option>Other</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Additional Notes</div>
            <textarea
              className="form-input"
              placeholder="Add any additional context or notes about this action..."
              value={notesVal}
              onChange={(e) => setNotesVal(e.target.value)}
              style={{ minHeight: 110 }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 10 }}>Cancel</button>
          <button
            className="btn-primary"
            disabled={disabled}
            onClick={() => handleTakeAction({ actionType: typeVal, reason: reasonVal, notes: notesVal })}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              background: disabled ? '#fcae7b' : 'linear-gradient(90deg,#f97316,#fb923c)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              opacity: disabled ? 0.8 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer'
            }}
          >
            {actionSubmitting ? 'Taking Action...' : 'Take Action'}
          </button>
        </div>
      </div>
    </div>
  );
};

export { ReportDetailModal, TakeActionModal };
export default ReportDetailModal;