import React, { useEffect, useState, useRef } from 'react';
import './Styles/contentManager.css';
import { db, auth, storage } from './firebase';
import { collection, getDocs, doc, setDoc, updateDoc, addDoc, deleteDoc, getCountFromServer, onSnapshot, query, where, orderBy, limit, serverTimestamp, collectionGroup, documentId, getDoc } from 'firebase/firestore';
import { CloudinaryContext, Image, Video } from './cloudinary';
import EditProfileCMS from './editprofile-cms'; // <-- add this import
import { getFunctions, httpsCallable } from 'firebase/functions';

// Cloudinary config
const CLOUDINARY_UPLOAD_PRESET = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || 'lakbai_preset';
const CLOUDINARY_CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'dxvewejox';

// Helper to get Cloudinary publicId from URL
function getCloudinaryPublicId(url) {
    if (!url || typeof url !== 'string') return null;
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    let publicId = parts[1].split('?')[0];
    // Remove file extension
    publicId = publicId.replace(/\.[^/.]+$/, "");
    return publicId;
}

// Helper to delete image from Cloudinary
async function deleteCloudinaryImage(publicId) {
    if (!publicId) return;
    const base = window.location.origin;
    const endpoints = [
        `${base}/admin/api/cloudinary/delete`,
        `${base}/api/cloudinary/delete`,
    ];
    let lastErr;
    for (const url of endpoints) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ publicId })
            });
            if (res.ok) return; // success on first working endpoint
            lastErr = new Error((await res.text()) || `HTTP ${res.status}`);
        } catch (e) {
            lastErr = e;
        }
    }
    // If we got here, none of the endpoints worked
    alert('Cloudinary image delete failed: ' + (lastErr?.message || 'Unknown error'));
    console.warn('Cloudinary image delete failed:', lastErr);
}

const TagInput = ({ tags, onChange, placeholder }) => {
const [val, setVal] = useState('');
const add = (t) => {
    const v = t.trim();
    if (!v) return;
    if (!tags.includes(v)) onChange([...tags, v]);
    setVal('');
};
return (
    <div className="tag-input">
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {tags.map((t) => (
        <span key={t} className="tag-item">
            {t}
            <button type="button" className="tag-remove" onClick={() => onChange(tags.filter((x) => x !== t))}>
            ×
            </button>
        </span>
        ))}
    </div>
    <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(val);
        }
        }}
        onBlur={() => val && add(val)}
        placeholder={placeholder}
        className="form-input"
    />
    </div>
    );
};


const RichTextEditor = ({ value, onChange, placeholder }) => {
const ref = useRef(null);
useEffect(() => {
    if (ref.current && value !== ref.current.innerHTML) ref.current.innerHTML = value || '';
}, [value]);
return (
    <div>
    <div className="rich-controls" style={{ marginBottom: 8 }}>
        <button type="button" onClick={() => document.execCommand('bold')} className="btn-small">B</button>
        <button type="button" onClick={() => document.execCommand('italic')} className="btn-small">I</button>
        <button type="button" onClick={() => document.execCommand('underline')} className="btn-small">U</button>
    </div>
    <div
        ref={ref}
        contentEditable
        className="rich-editor"
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        data-placeholder={placeholder}
        style={{ minHeight: 140, borderRadius: 6, background: '#fff', padding: 12, border: '1px solid #eef2f7' }}
    />
    </div>
);
};

/* DestinationForm used in modal - matches screenshot layout */
const DestinationForm = ({ initial = null, onCancel, onSave, existingNames = [], ignoreId = null }) => {
  const [data, setData] = useState(() => {
    const base = {
      name: '',
      category: '',
      description: '',
      content: '',
      tags: [],
      location: '',
      priceRange: '',
      bestTime: '',
      rating: 0,
      media: { featuredImage: '', gallery: [] },
      status: 'draft',
    };
    if (!initial) return base;
    // Ensure media and gallery are always defined
    return {
      ...base,
      ...initial,
      media: {
        featuredImage: initial?.media?.featuredImage || '',
        gallery: Array.isArray(initial?.media?.gallery) ? initial.media.gallery : [],
      }
    };
  });
  const [nameError, setNameError] = useState('');
  // live duplicate check against provided names (case-insensitive)
  useEffect(() => {
    const n = (data.name || '').trim().toLowerCase();
    if (!n) { setNameError(''); return; }
    // existingNames should NOT include the current record when editing
    if (existingNames.includes(n)) {
      setNameError('A destination with this name already exists.');
    } else {
      setNameError('');
    }
  }, [data.name, existingNames]);

  const [activeTab, setActiveTab] = useState('content');
  const [uploading, setUploading] = useState(false);
  const handleImageAdd = () => {
    // Use Cloudinary for image upload
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = async () => {
        const f = inp.files[0];
        if (!f) return;
        setUploading(true);
        // Upload to Cloudinary
        const formData = new FormData();
        formData.append('file', f);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        try {
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: 'POST',
                body: formData
            });
            const dataRes = await res.json();
            if (!dataRes.secure_url) {
                throw new Error('Cloudinary upload failed');
            }
            setData((d) => {
                // If featuredImage is not set, set it to the first uploaded image
                const newGallery = [...(d.media.gallery || []), dataRes.secure_url];
                const newFeatured = d.media.featuredImage || dataRes.secure_url;
                return {
                    ...d,
                    media: {
                        ...d.media,
                        gallery: newGallery,
                        featuredImage: newFeatured
                    }
                };
            });
        } catch (err) {
            alert('Image upload failed');
            console.error('Cloudinary error:', err);
        }
        setUploading(false);
    };
    inp.click();
};

const submit = (e) => {
    e?.preventDefault();
    // minimal validation
    if (!data.name.trim()) return alert('Please enter a destination name');
    if (nameError) return alert(nameError);
    onSave({ ...data, updatedAt: new Date().toISOString(), createdAt: initial?.createdAt || new Date().toISOString() });
};

return (
    <form className="content-form" onSubmit={submit}>
      <div className="tabs" style={{ borderBottom: '1px solid #eef2f7', marginBottom: 16}}>
        {['content', 'media', 'seo', 'settings'].map((t) => (
            <button
                type="button"
                key={t}
                className={activeTab === t ? 'active' : ''}
                onClick={() => setActiveTab(t)}
                style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '12px 14px',
                    cursor: 'pointer',
                    color: activeTab === t ? '#2563eb' : '#6b7280',
                    fontWeight: activeTab === t ? 600 : 500,
                }}
            >
                {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
        ))}
      </div>

      {activeTab === 'content' && (
        <div className="grid two-col">
          <div>
            <label>Destination Name *</label>
            {/* <input required value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} className="form-input" /> */}
            <input
              required
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              className="form-input"
              style={nameError ? { borderColor: '#f87171' } : undefined}
            />
            {nameError && (
              <div className="muted" style={{ color: '#b91c1c', fontSize: 12, marginTop: 6 }}>
                {nameError}
              </div>
            )}
          </div>
          <div>
            <label>Category</label>
            <select value={data.category} onChange={(e) => setData({ ...data, category: e.target.value })} className="form-input">
            <option value="">Select category</option>
                <option>Beach</option>
                <option>Mountain</option>
                <option>Tourist</option>
                <option>Waterfalls</option>
                <option>Historical</option>
                <option>Parks</option>
                <option>Museums</option>
                <option>Natural</option>
                <option>Landmarks</option>
                <option>Cultural</option>
                <option>Caves</option>
                <option>Islands</option>
                <option>Lakes</option>
                <option>Heritage</option>
            </select>
          </div>

          <div className="full">
            <label>Description</label>
            <textarea value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} className="form-input" />
          </div>

          <div className="full">
            <label>Content</label>
            <RichTextEditor value={data.content} onChange={(v) => setData({ ...data, content: v })} placeholder="Write rich content..." />
          </div>

          <div className="full">
            <label>Tags</label>
            <TagInput tags={data.tags} onChange={(tags) => setData({ ...data, tags })} placeholder="Add tags..." />
          </div>

          <div>
            <label>Location</label>
            <input value={data.location} onChange={(e) => setData({ ...data, location: e.target.value })} className="form-input" />
          </div>
          <div>
            <label>Price Range</label>
            <select value={data.priceRange} onChange={(e) => setData({ ...data, priceRange: e.target.value })} className="form-input">
            <option value="">Select price range</option>
            <option>$</option>
            <option>$$</option>
            <option>$$$</option>
            <option>$$$$</option>
            </select>
          </div>

          <div>
            <label>Best Time to Visit</label>
            <input value={data.bestTime} onChange={(e) => setData({ ...data, bestTime: e.target.value })} className="form-input" placeholder="e.g., March to May" />
          </div>
          <div>
            <label>Rating</label>
            <select value={data.rating} onChange={(e) => setData({ ...data, rating: Number(e.target.value) })} className="form-input">
            <option value={0}>☆☆☆☆☆ (0/5)</option>
            <option value={1}>★☆☆☆☆ (1/5)</option>
            <option value={2}>★★☆☆☆ (2/5)</option>
            <option value={3}>★★★☆☆ (3/5)</option>
            <option value={4}>★★★★☆ (4/5)</option>
            <option value={5}>★★★★★ (5/5)</option>
            </select>
            </div>
        </div>
    )}

    {activeTab === 'media' && (
        <div style={{ paddingBottom: 6 }}>
            <label style={{ display: 'block', marginBottom: 8, color: '#6b7280', fontSize: 12 }}>Featured Image</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <button
                type="button"
                onClick={handleImageAdd}
                disabled={uploading}
                style={{
                    background: 'linear-gradient(90deg,#2b6ef6,#4aa8ff)',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 14px',
                    borderRadius: 8,
                    boxShadow: '0 8px 30px rgba(43,110,246,0.18)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    fontWeight: 700,
                }}
            >
                <span style={{ fontSize: 16 }}>📸</span>
                <span>{uploading ? 'Uploading...' : 'Upload Featured Image'}</span>
            </button>

            {data.media?.featuredImage ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CloudinaryContext cloudName={CLOUDINARY_CLOUD_NAME}>
                        <Image 
                            publicId={getCloudinaryPublicId(data.media.featuredImage)} 
                            width="140" 
                            height="96" 
                            crop="fill" 
                            style={{ borderRadius: 6, border: '1px solid #eef2f7' }} 
                        />
                    </CloudinaryContext>
                </div>
            ) : null}
            </div>

            <label style={{ display: 'block', marginBottom: 8, marginTop: 6, color: '#6b7280', fontSize: 12 }}>Gallery Images</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <button
                type="button"
                onClick={handleImageAdd}
                disabled={uploading}
                style={{
                background: 'linear-gradient(90deg,#10b981,#059669)',
                color: '#fff',
                border: 'none',
                padding: '10px 14px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 700,
                }}
            >
                <span style={{ fontSize: 14 }}>🖼️</span>
                <span>{uploading ? 'Uploading...' : 'Add to Gallery'}</span>
            </button>

            {(data.media.gallery || []).length > 0 ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <CloudinaryContext cloudName={CLOUDINARY_CLOUD_NAME}>
                        {(data.media.gallery || []).map((g, i) => (
                            <div key={i} style={{ position: 'relative' }}>
                                <Image 
                                    publicId={getCloudinaryPublicId(g)} 
                                    width="92" 
                                    height="64" 
                                    crop="fill" 
                                    style={{ borderRadius: 6, border: '1px solid #eef2f7' }} 
                                />
                                <button
                                    type="button"
                                    onClick={() => setData((d) => ({ ...d, media: { ...d.media, gallery: (d.media.gallery || []).filter((_, idx) => idx !== i) } }))}
                                    style={{
                                        position: 'absolute',
                                        right: 6,
                                        top: 6,
                                        background: 'rgba(0,0,0,0.5)',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 4,
                                        padding: '2px 6px',
                                        cursor: 'pointer',
                                        fontSize: 12,
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </CloudinaryContext>
                </div>
            ) : (
            <div style={{ color: '#9ca3af', fontSize: 13 }}>No gallery images added</div>
            )}
        </div>

        <div style={{ borderTop: '1px solid #eef2f7', marginTop: 10, paddingTop: 12 }} />


        </div>
    )}

    {activeTab === 'seo' && (
        <div>
        <label>Meta Title</label>
        <input value={data.seo?.metaTitle || ''} onChange={(e) => setData({ ...data, seo: { ...(data.seo || {}), metaTitle: e.target.value } })} className="form-input" />
        <label>Meta Description</label>
        <textarea value={data.seo?.metaDescription || ''} onChange={(e) => setData({ ...data, seo: { ...(data.seo || {}), metaDescription: e.target.value } })} className="form-input" />
        <label>Keywords</label>
        <TagInput tags={(data.seo && data.seo.keywords) || []} onChange={(k) => setData({ ...data, seo: { ...(data.seo || {}), keywords: k } })} placeholder="Add keywords..." />
        </div>
    )}

    {activeTab === 'settings' && (
        <div>
        <label>Status</label>
        <select value={data.status} onChange={(e) => setData({ ...data, status: e.target.value })} className="form-input">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
        </select>

        <label style={{ display: 'block', marginTop: 12 }}>
            <input type="checkbox" checked={data.featured || false} onChange={(e) => setData({ ...data, featured: e.target.checked })} /> Featured
        </label>
        </div>
    )}

    <div className="form-actions" style={{ marginTop: 18 }}>
        <button
          type="submit"
          className="btn-primary"
          disabled={!!nameError}
          style={{ padding: '10px 18px', borderRadius: 8, opacity: nameError ? 0.7 : 1, cursor: nameError ? 'not-allowed' : 'pointer' }}
        >
        {initial ? 'Update destination' : 'Create destination'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} style={{ padding: '10px 18px', borderRadius: 8 }}>
        Cancel
        </button>
    </div>
    </form>
);
};

function fmtDate(v) {
  const d = toDateSafe(v);
  return d ? d.toLocaleDateString() : '—';
}
function fmtDateTime(v) {
  const d = toDateSafe(v);
  return d ? d.toLocaleString() : '—';
}

// Helper date formatters (fixes fmtDate / fmtDateTime no-undef)
const toDateSafe = (v) => (v?.toDate ? v.toDate() : (v ? new Date(v) : null));

// REPLACE normalizeInterests with a more robust version
const normalizeInterests = (src) => {
  // turn any supported shape into a string array
  const toList = (val) => {
    if (!val && val !== 0) return [];
    if (Array.isArray(val)) return val.map((x) => String(x).trim()).filter(Boolean);
    if (typeof val === 'string') return val.split(',').map((s) => s.trim()).filter(Boolean);
    if (typeof val === 'object') {
      // boolean map -> keys with truthy values
      return Object.keys(val || {})
        .filter((k) => !!val[k])
        .map((k) => String(k).trim())
        .filter(Boolean);
    }
    return [];
  };

  // collect from many possible fields/paths
  const candidates = [
    src?.interests,
    src?.travelInterests,
    src?.interestTags,
    src?.tags,
    src?.badges,
    src?.traits,
    src?.roles,
    src?.personas,
    src?.interestMap,
    src?.interest_map,

    // nested
    src?.profile?.interests,
    src?.profile?.tags,
    src?.profile?.badges,
    src?.preferences?.interests,
    src?.preferences?.tags,
    src?.settings?.interests,
    src?.settings?.tags,
  ];

  // flatten + dedupe case-insensitively
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    for (const s of toList(c)) {
      const key = s.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(s);
      }
    }
  }
  return out;
};

// Helper: try alternate docs if top-level users/{uid} has no interests
async function loadAdditionalUserInterests(db, uid) {
  const tryDocs = [
    doc(db, 'users', uid, 'profile', 'meta'),
    doc(db, 'users', uid, 'settings', 'profile'),
    doc(db, 'profiles', uid),
    doc(db, 'userProfiles', uid),
    doc(db, 'userSettings', uid),
    doc(db, 'userPreferences', uid),
  ];
  let merged = {};
  for (const ref of tryDocs) {
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) merged = { ...merged, ...(snap.data() || {}) };
    } catch {}
  }
  return normalizeInterests(merged);
}

// Helper to update a user's password via admin function or HTTP fallback
async function adminUpdatePassword(uid, newPassword) {
  if (!uid || !newPassword) return;

  // Try Firebase Callable Function first
  try {
    const functions = getFunctions();
    const fn = httpsCallable(functions, 'adminUpdateUserPassword');
    await fn({ uid, newPassword });
    return;
  } catch (err) {
    console.warn('Callable password update failed, falling back to HTTP:', err?.message);
  }

  // Fallback to your API endpoints if available
  const base = window.location.origin;
  const endpoints = [
    `${base}/admin/api/auth/updatePassword`,
    `${base}/api/auth/updatePassword`,
  ];
  let lastErr;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ uid, newPassword }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('All password update endpoints failed.');
}

function ContentManagement() {
  const [analytics, setAnalytics] = useState({
    totalDestinations: 0,
    totalUsers: 0,
    totalArticles: 0,
    publishedContent: 0,
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState('dashboard');

  // DESTINATIONS state + fetch
  const [destinations, setDestinations] = useState([]);
  const [searchDest, setSearchDest] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loadingDest, setLoadingDest] = useState(false);

  // USERS state + fetch (added)
  const [users, setUsers] = useState([]);
  const [searchUser, setSearchUser] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userStatusFilter, setUserStatusFilter] = useState('all');

  // NEW: per-user travel stats loaded from Firestore
  const [userStats, setUserStats] = useState({});

  // NEW: User Profile modal state
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [userProfileTab, setUserProfileTab] = useState('overview');

  // Activity state for User Profile
  const [userActivity, setUserActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // NEW: Photos state for User Profile
  const [userPhotos, setUserPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // ADD: Activity state for User Profile (fixes no-undef)

  // Modal state (was missing -> caused no-undef ESLint errors)
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  // NEW: Edit User modal state
  const [userEditOpen, setUserEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userEditTab, setUserEditTab] = useState('profile'); // active tab for Edit User modal

  // Travel tab local state
  const [editInterests, setEditInterests] = useState([]);
  const [editPlaces, setEditPlaces] = useState([]);
  const [placeInput, setPlaceInput] = useState('');
  const [editStatus, setEditStatus] = useState('active'); // NEW: settings tab state
  const [interestInput, setInterestInput] = useState('');  // NEW: inline input for Travel Interests

  // Settings state (persisted to localStorage)
  const [cmsSettings, setCmsSettings] = useState(() => {
    const s = localStorage.getItem('cms-settings');
    return s
    ? JSON.parse(s)
    : {
        siteName: 'LakbAI CMS',
        siteDescription: 'Professional Travel Content Management System',
        contactEmail: 'admin@travelcms.com',
        socialMedia: { facebook: '', twitter: '', instagram: '' },
        seo: {
            defaultMetaTitle: 'TravelCMS Pro',
            defaultMetaDescription: 'Discover amazing travel destinations',
            googleAnalytics: '',
        },
        notifications: { emailNotifications: true, pushNotifications: false },
        };
});

const saveSettings = () => {
    localStorage.setItem('cms-settings', JSON.stringify(cmsSettings));
    alert('Settings saved');
};

// Add these at the top of ContentManagement function:
const [actionOpen, setActionOpen] = useState(false);
const [actionReport, setActionReport] = useState(null);
const [actionSubmitting, setActionSubmitting] = useState(false);

// Define userNameCache as a React state (used by Reports -> Reported User names)
const [userNameCache, setUserNameCache] = useState({});

const openActionModal = (report) => {
  setActionReport(report);
  setActionOpen(true);
};

// ADD: handleTakeAction (used by TakeActionModal)
const handleTakeAction = async ({ actionType, reason, notes }) => {
  if (!actionReport) return;
  setActionSubmitting(true);
  try {
    const actorUid = auth.currentUser?.uid || 'system';
    const targetUserId = actionReport?.reportedUser?.id || null;
    const reportId = actionReport?.id || null;

    // 1) Log moderation action
    await addDoc(collection(db, 'moderationActions'), {
      reportId,
      targetUserId,
      contentType: actionReport?.contentType || 'Post',
      actionType,
      reason,
      notes: notes || '',
      actorUid,
      createdAt: serverTimestamp(),
      status: 'queued',
    });

    const act = (actionType || '').toLowerCase();

    // 2) Remove Content Only
    if (act === 'remove content only') {
      const contentId = actionReport?.contentId || actionReport?.reportedContent?.id || null;
      if (contentId) {
        try { await deleteDoc(doc(db, 'posts', contentId)); } catch {}
        try { await deleteDoc(doc(db, 'communityPosts', contentId)); } catch {}
        try { await updateDoc(doc(db, 'content', contentId), { removed: true, removedAt: serverTimestamp(), removedBy: actorUid }); } catch {}
      }
    }

    // 3) Account actions (Suspend, Ban, Permanently Delete)
    if (targetUserId && (act === 'suspend account' || act === 'ban account' || act === 'permanently delete account')) {
      const userRef = doc(db, 'users', targetUserId);
      try {
        if (act === 'suspend account') {
          await updateDoc(userRef, { status: 'disabled', statusReason: reason, statusUpdatedAt: serverTimestamp(), statusBy: actorUid });
        } else if (act === 'ban account') {
          await updateDoc(userRef, { status: 'banned', statusReason: reason, statusUpdatedAt: serverTimestamp(), statusBy: actorUid });
        } else if (act === 'permanently delete account') {
          await updateDoc(userRef, { status: 'deleted', deletedAt: serverTimestamp(), deletedBy: actorUid, deleteReason: reason });
          await addDoc(collection(db, 'accountDeletionRequests'), { userId: targetUserId, requestedBy: actorUid, reason, createdAt: serverTimestamp() });
        }
      } catch {}
    }

    // 4) Mark report resolved
    try { if (reportId) await updateDoc(doc(db, 'reports', reportId), { status: 'resolved', resolvedAt: serverTimestamp() }); } catch {}
    try { if (reportId) await updateDoc(doc(db, 'report',  reportId), { status: 'resolved', resolvedAt: serverTimestamp() }); } catch {}

    setActionOpen(false);
    setActionReport(null);
    alert('Action submitted.');
  } catch (e) {
    console.error('Take action failed:', e);
    alert('Failed to submit action.');
  } finally {
    setActionSubmitting(false);
  }
};

  useEffect(() => {
    (async () => {
      try {
        const countReports = async () => {
          let total = 0;
          // report (singular)
          try {
            const c1 = await getCountFromServer(collection(db, 'report'));
            total += c1.data().count || 0;
          } catch {
            try { const s1 = await getDocs(collection(db, 'report')); total += s1.size || 0; } catch {}
          }
          // reports (plural)
          try {
            const c2 = await getCountFromServer(collection(db, 'reports'));
            total += c2.data().count || 0;
          } catch {
            try { const s2 = await getDocs(collection(db, 'reports')); total += s2.size || 0; } catch {}
          }
          return total;
        };

        const [dSnap, uSnap, aSnap, reportsCount] = await Promise.all([
          getDocs(collection(db, 'destinations')),
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'articles')), // kept for compatibility
          countReports(),
        ]);
        const destinations = dSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const users = uSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const articles = aSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const publishedDestinations =
          destinations.filter((x) => String(x.status || '').toLowerCase() === 'published').length;

        const recent = [
          ...destinations.slice(-5).map((d) => ({ ...d, type: 'destination' })),
          ...articles.slice(-5).map((a) => ({ ...a, type: 'article' })),
        ]
          .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
          .slice(0, 10);

        setAnalytics((a) => ({
          ...a,
          totalArticles: reportsCount,          // show number of submitted reports
          publishedContent: publishedDestinations,
          recentActivity: recent,
        }));

        setDestinations(destinations);
        setUsers(users);
      } catch (e) {
        // fallback to local caches + best-effort report count
        let reportsCount = 0;
        try { const s1 = await getDocs(collection(db, 'report')); reportsCount += s1.size || 0; } catch {}
        try { const s2 = await getDocs(collection(db, 'reports')); reportsCount += s2.size || 0; } catch {}

        const localDest = JSON.parse(localStorage.getItem('destinations') || '[]');
        const localUsers = JSON.parse(localStorage.getItem('users') || '[]');
        const localArticles = JSON.parse(localStorage.getItem('articles') || '[]');

        setAnalytics((a) => ({
          ...a,
          totalArticles: reportsCount // reports from Firestore (or 0)
          ,
          publishedContent: localDest.filter((d) => String(d.status || '').toLowerCase() === 'published').length,
          recentActivity: [...localDest.slice(-5), ...localArticles.slice(-5)].slice(0, 10),
        }));

        setDestinations(localDest);
        setUsers(localUsers);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // LIVE: dashboard counters from Firestore (destinations + users + published destinations)
  useEffect(() => {
    if (active !== 'dashboard') return;

    let unsubDest = null;
    let unsubUsers = null;
    let unsubPubDest = null;
    let unsubRep1 = null;
    let unsubRep2 = null;
    let r1 = 0, r2 = 0; // live sizes for report/reports

    const destColl = collection(db, 'destinations');
    const usersColl = collection(db, 'users');
    const pubQ = query(destColl, where('status', 'in', ['published', 'PUBLISHED']));

    (async () => {
      try {
        const [dc, uc, pc] = await Promise.all([
          getCountFromServer(destColl),
          getCountFromServer(usersColl),
          getCountFromServer(pubQ),
        ]);

        // count reports from both collections
        const sumCounts = async () => {
          let total = 0;
          try { const c = await getCountFromServer(collection(db, 'report')); total += c.data().count || 0; } catch {
            try { const s = await getDocs(collection(db, 'report')); total += s.size || 0; } catch {}
          }
          try { const c = await getCountFromServer(collection(db, 'reports')); total += c.data().count || 0; } catch {
            try { const s = await getDocs(collection(db, 'reports')); total += s.size || 0; } catch {}
          }
          return total;
        };
        const reportsCount = await sumCounts();

        setAnalytics((a) => ({
          ...a,
          totalDestinations: dc.data().count || 0,
          totalUsers: uc.data().count || 0,
          publishedContent: pc.data().count || 0,
          totalArticles: reportsCount // live number of reports
        }));
      } catch {
        // keep previous values
      }

      // Real-time updates
      try {
        unsubDest = onSnapshot(destColl, (snap) =>
          setAnalytics((a) => ({ ...a, totalDestinations: snap.size }))
        );
        unsubUsers = onSnapshot(usersColl, (snap) =>
          setAnalytics((a) => ({ ...a, totalUsers: snap.size }))
        );
        unsubPubDest = onSnapshot(pubQ, (snap) =>
          setAnalytics((a) => ({ ...a, publishedContent: snap.size }))
        );

        // Listen to both collections for reports
        try {
          unsubRep1 = onSnapshot(collection(db, 'report'), (snap) => {
            r1 = snap.size; setAnalytics((a) => ({ ...a, totalArticles: r1 + r2 }));
          });
        } catch {}
        try {
          unsubRep2 = onSnapshot(collection(db, 'reports'), (snap) => {
            r2 = snap.size; setAnalytics((a) => ({ ...a, totalArticles: r1 + r2 }));
          });
        } catch {}
      } catch (e) {
        console.warn('onSnapshot counters error:', e);
      }
    })();

    return () => {
      if (typeof unsubDest === 'function') unsubDest();
      if (typeof unsubUsers === 'function') unsubUsers();
      if (typeof unsubPubDest === 'function') unsubPubDest();
      if (typeof unsubRep1 === 'function') unsubRep1();
      if (typeof unsubRep2 === 'function') unsubRep2();
    };
  }, [active]);

useEffect(() => {
    if (active !== 'destinations') return;
    (async () => {
    setLoadingDest(true);
    try {
        // Use Firestore from firebase.js
    const snap = await getDocs(collection(db, 'destinations'));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setDestinations(items);
    } catch (e) {
        setDestinations([]);
    } finally {
        setLoadingDest(false);
    }
    })();
}, [active]);

useEffect(() => {
    if (active !== 'users') return;
    (async () => {
    setLoadingUsers(true);
    try {
        // Use Firestore from firebase.js
    const snap = await getDocs(collection(db, 'users'));
    setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
        setUsers([]);
    } finally {
        setLoadingUsers(false);
    }
    })();
}, [active]);

// NEW: fetch Travel Stats (places, photos, reviews) for users from Firestore
useEffect(() => {
  if (active !== 'users' || !users?.length) return;
  let cancelled = false;

  const safeCount = async (refOrQuery) => {
    try {
      const c = await getCountFromServer(refOrQuery);
      return c.data().count || 0;
    } catch {
      try {
        const snap = await getDocs(refOrQuery);
        return snap.size || 0;
      } catch {
        return 0;
      }
    }
  };

  const tallyDestinationsFromTripDocs = async (tripDocs) => {
    let total = 0;
    for (const d of tripDocs) {
      const data = d.data();
      if (Array.isArray(data?.destinations)) {
        total += data.destinations.length;
      } else if (typeof data?.destinationsCount === 'number') {
        total += data.destinationsCount;
      } else {
        // subcollection users/{uid}/(myTrips|trips)/{tripId}/destinations
        try {
          const sub = collection(d.ref, 'destinations');
          total += await safeCount(sub);
        } catch {}
      }
    }
    return total;
  };

  const countPlaces = async (uid) => {
    // Try top-level myTrips with userId, then trips, then user subcollections, then itinerary items
    // 1) myTrips (top-level)
    try {
      const q1 = query(collection(db, 'myTrips'), where('userId', '==', uid));
      const s1 = await getDocs(q1);
      if (!s1.empty) return await tallyDestinationsFromTripDocs(s1.docs);
    } catch {}

    // 2) trips (top-level)
    try {
      const q2 = query(collection(db, 'trips'), where('userId', '==', uid));
      const s2 = await getDocs(q2);
      if (!s2.empty) return await tallyDestinationsFromTripDocs(s2.docs);
    } catch {}

    // 3) users/{uid}/myTrips
    try {
      const s3 = await getDocs(collection(db, 'users', uid, 'myTrips'));
      if (!s3.empty) return await tallyDestinationsFromTripDocs(s3.docs);
    } catch {}

    // 4) users/{uid}/trips
    try {
      const s4 = await getDocs(collection(db, 'users', uid, 'trips'));
      if (!s4.empty) return await tallyDestinationsFromTripDocs(s4.docs);
    } catch {}

    // 5) itinerary/{uid}/items
    try {
      const s5 = await safeCount(collection(db, 'itinerary', uid, 'items'));
      if (s5) return s5;
    } catch {}

    return 0;
  };

  const countPhotos = async (uid) => {
    // Prefer top-level photos with userId
    const cTop = await (async () => {
      try {
        const qref = query(collection(db, 'photos'), where('userId', '==', uid));
        return await safeCount(qref);
      } catch { return 0; }
    })();
    if (cTop) return cTop;

    // Fallback: users/{uid}/photos
    try {
      return await safeCount(collection(db, 'users', uid, 'photos'));
    } catch { return 0; }
  };

  const countReviews = async (uid) => {
    // Preferred: collection group over destinations/*/ratings with userId
    try {
      const q1 = query(collectionGroup(db, 'ratings'), where('userId', '==', uid));
      const c1 = await safeCount(q1);
      if (c1) return c1;
    } catch {}

    // If ratings docs are keyed by UID (no userId field), match by documentId
    try {
      const q2 = query(collectionGroup(db, 'ratings'), where(documentId(), '==', uid));
      const c2 = await safeCount(q2);
      if (c2) return c2;
    } catch {}

    // Fallbacks: top-level reviews or users/{uid}/reviews
    try {
      const q3 = query(collection(db, 'reviews'), where('userId', '==', uid));
      const c3 = await safeCount(q3);
      if (c3) return c3;
    } catch {}
    try {
      return await safeCount(collection(db, 'users', uid, 'reviews'));
    } catch { return 0; }
  };

  // NEW: count friends
  const countFriends = async (uid) => {
    // Try collectionGroup 'friends' with userId field
    try {
      const q1 = query(collectionGroup(db, 'friends'), where('userId', '==', uid));
      const c1 = await safeCount(q1);
      if (c1) return c1;
    } catch {}
    // Top-level friendships with array-contains uid
    try {
      const q2 = query(collection(db, 'friendships'), where('participants', 'array-contains', uid));
      const c2 = await safeCount(q2);
      if (c2) return c2;
    } catch {}
    // Fallback: users/{uid}/friends
    try {
      return await safeCount(collection(db, 'users', uid, 'friends'));
    } catch { return 0; }
  };

  (async () => {
    const ids = users.map(u => u.id).filter(Boolean);
    const pending = ids.filter(id => userStats[id] === undefined);
    if (!pending.length) return;

    const entries = await Promise.all(pending.map(async (uid) => {
      const [places, photos, reviews, friends] = await Promise.all([
        countPlaces(uid),
        countPhotos(uid),
        countReviews(uid),
        countFriends(uid),
      ]);
      return [uid, { places, photos, reviews, friends }];
    }));

    if (!cancelled) {
      setUserStats((prev) => {
        const next = { ...prev };
        for (const [uid, stats] of entries) next[uid] = stats;
        return next;
      });
    }
  })();

  return () => { cancelled = true; };
}, [active, users, userStats]);

  // Handlers for Destination modal (fixes openCreate/closeForm/handleSaveDestination)
  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const handleSaveDestination = async (payload) => {
    try {
      if (editing?.id) {
        await updateDoc(doc(db, 'destinations', editing.id), payload);
        setDestinations((prev) => prev.map((d) => (d.id === editing.id ? { ...d, ...payload, id: editing.id } : d)));
      } else {
        const ref = await addDoc(collection(db, 'destinations'), payload);
        const newDoc = { ...payload, id: ref.id };
        setDestinations((prev) => [...prev, newDoc]);
        setAnalytics((a) => ({ ...a, totalDestinations: (a.totalDestinations || 0) + 1 }));
      }
      // optional localStorage fallback sync
      try {
        localStorage.setItem('destinations', JSON.stringify((prev => prev)(destinations)));
      } catch {}
      closeForm();
    } catch (err) {
      console.error('Save destination failed:', err);
      alert('Failed to save destination.');
    }
  };

  // User Profile modal handlers (fixes openUserProfile/closeUserProfile)
  const openUserProfile = (u) => {
    const seeded = { ...u, interests: normalizeInterests(u) };
    setUserProfile(seeded);
    setUserProfileTab('overview');
    setUserProfileOpen(true);
  };
  const closeUserProfile = () => { setUserProfileOpen(false); setUserProfile(null); };

  // LIVE: hydrate userProfile from Firestore while modal is open (ensures interests match)
  useEffect(() => {
    if (!userProfileOpen || !userProfile?.id) return;
    const ref = doc(db, 'users', userProfile.id);
    const unsub = onSnapshot(ref, async (snap) => {
      if (!snap.exists()) return; // FIX: early return when no doc
      const data = snap.data() || {};
      const normalized = normalizeInterests(data);
      setUserProfile((prev) => ({
        ...(prev || {}),
        ...data,
        interests: normalized.length ? normalized : (prev?.interests || []),
      }));

      // If still empty, probe alternate docs once
      if (!normalized.length) {
        try {
          const extra = await loadAdditionalUserInterests(db, userProfile.id);
          if (extra.length) {
            setUserProfile((prev) => ({ ...(prev || {}), interests: extra }));
          }
        } catch {}
      }
    });
    return () => unsub();
  }, [userProfileOpen, userProfile?.id]);

  // Edit User modal handler (fixes openEditUserModal)
  const openEditUserModal = (u, tab = 'basic') => { // <-- default to 'profile'
    setEditingUser(u);
    setUserEditOpen(true);
    setUserEditTab(tab);
    // seed from normalized interests
    setEditInterests(normalizeInterests(u));
    setEditPlaces(Array.isArray(u?.places) ? u.places : []);
    setEditStatus((u?.status || 'active').toLowerCase());
  };

  // Save handler for EditProfileCMS
  const handleSaveUser = async (payload) => {
    if (!editingUser?.id) return;
    const uid = editingUser.id;

    // separate password from profile update
    const { password, ...profile } = {
      email: payload.email ?? editingUser.email ?? '',
      travelerName: payload.travelerName ?? editingUser.travelerName ?? '',
      provider: payload.provider ?? editingUser.provider ?? 'Email',
      photoURL: payload.photoURL ?? editingUser.photoURL ?? '',
      travelerBio: payload.travelerBio ?? editingUser.travelerBio ?? editingUser.bio ?? '',
      status: payload.status ?? editingUser.status ?? 'active',
      stats: { ...(editingUser.stats || {}), ...(payload.stats || {}) },
      interests: Array.isArray(payload.interests) ? payload.interests : [],
      updatedAt: serverTimestamp(),
    };

    try {
      // update Firestore profile first
      await updateDoc(doc(db, 'users', uid), profile);

      // optionally update password via admin
      if (password && typeof password === 'string') {
        await adminUpdatePassword(uid, password);
      }

      // reflect changes locally (never store password in state)
      setUsers((prev) =>
        prev.map((u) => (u.id === uid ? { ...u, ...profile, id: uid } : u))
      );
      setUserEditOpen(false);
      setEditingUser(null);
    } catch (e) {
      console.error('Update user failed:', e);
      alert('Failed to update user.');
    }
  };

  // NEW: Reports state + fetch
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportSearch, setReportSearch] = useState('');
  const [reportStatus, setReportStatus] = useState('all');     // all | pending | under_review | resolved | escalated
  const [reportPriority, setReportPriority] = useState('all'); // all | low | medium | high
  const [reportType, setReportType] = useState('all');         // all | Post | Comment | Review | Message
  const [viewReport, setViewReport] = useState(null);

  // Load Reports (Firestore -> fallback to sample)
  useEffect(() => {
    if (active !== 'reports') return;

    setLoadingReports(true);
    let unsub = null;

    const tryLoadFrom = async (collName) => {
      try {
        const collRef = collection(db, collName);
        const fields = ['date', 'createdAt', 'timestamp'];

        // Try ordered queries by several possible date fields
        for (const f of fields) {
          try {
            const qref = query(collRef, orderBy(f, 'desc'), limit(200));
            const snap = await getDocs(qref);
            if (!snap.empty) {
              setReports(snap.docs.map((doc) => normalizeReportDoc(doc)));
              unsub = onSnapshot(qref, (s) => setReports(s.docs.map((doc) => normalizeReportDoc(doc))));
              return true;
            }
          } catch {
            // ignore (index may not exist)
          }
        }

        // Unordered fallback
        const snap = await getDocs(collRef);
        if (!snap.empty) {
          setReports(snap.docs.map((doc) => normalizeReportDoc(doc)));
          try {
            unsub = onSnapshot(collRef, (s) => setReports(s.docs.map((doc) => normalizeReportDoc(doc))));
          } catch {}
          return true;
        }
      } catch {}
      return false;
    };

    (async () => {
      try {
        const ok = (await tryLoadFrom('report')) || (await tryLoadFrom('reports'));
        if (!ok) {
          setReports([]); // nothing found
        }
      } finally {
        setLoadingReports(false);
      }
    })();

    return () => { if (typeof unsub === 'function') unsub(); };
  }, [active]);

  // Helpers for badges (styles match screenshot)
  const PriorityBadge = ({ v }) => {
    const t = (v || '').toString().toLowerCase();
    const map = {
      low:    { bg: '#dcfce7', fg: '#166534', text: 'LOW' },
      medium: { bg: '#fef3c7', fg: '#b45309', text: 'MEDIUM' },
      high:   { bg: '#fee2e2', fg: '#b91c1c', text: 'HIGH' },
    };
    const s = map[t] || map.low;
    return (
      <span style={{ background: s.bg, color: s.fg, fontWeight: 700, fontSize: 12, padding: '6px 10px', borderRadius: 999 }}>
        {s.text}
      </span>
    );
  };
  const StatusBadge = ({ v }) => {
    const t = (v || '').toString().toLowerCase();
    const map = {
      pending:      { bg: '#fef9c3', fg: '#a16207', text: 'PENDING' },
      under_review: { bg: '#dbeafe', fg: '#1d4ed8', text: 'UNDER REVIEW' },
      resolved:     { bg: '#dcfce7', fg: '#166534', text: 'RESOLVED' },
      escalated:    { bg: '#fee2e2', fg: '#b91c1c', text: 'ESCALATED' },
    };
    const s = map[t] || map.pending;
    return (
      <span style={{ background: s.bg, color: s.fg, fontWeight: 700, fontSize: 12, padding: '6px 10px', borderRadius: 999 }}>
        {s.text}
      </span>
    );
  };

  // NEW: normalize the "reportedContent" payload from Firestore without templates
  const normalizeReportedContent = (report) => {
    const d = report?.reportedContent || {};
    const type = String(report?.contentType || d.contentType || d.type || '').toLowerCase();

    const toDate = (v) => (v?.toDate?.() ? v.toDate() : (v ? new Date(v) : null));
    const createdAt =
      toDate(d.contentCreatedAt) ||
      toDate(d.createdAt) ||
      toDate(d.timestamp) ||
      toDate(d.date) ||
      null;

    const title =
      d.contentTitle ||
      d.title ||
      d.postTitle ||
      d.subject ||
      null;

    const body =
      d.contentBody ||
      d.body ||
      d.text ||
      d.caption ||
      d.message ||
      null;

    const location =
      report.location ||
      report.place ||
      report.city ||
      report.address ||
      null;

    const images = Array.isArray(report.images)
      ? report.images
      : Array.isArray(report.photos)
      ? report.photos
      : Array.isArray(report.mediaUrls)
      ? report.mediaUrls
      : Array.isArray(report.media)
      ? report.media
      : report.image
      ? [report.image]
      : [];

    return { type, title, body, location, createdAt, images };
  };

  // NEW: Report Details modal (shows only Firestore content; no templates)
  const ReportDetailModal = ({ report, onClose, onTakeAction }) => {
    if (!report) return null;

    const typeStr = String(report.contentType || '').toLowerCase();
    const content = normalizeReportedContent(report);

    const toDateTime = (v) => {
      const d = v instanceof Date ? v : (v?.toDate ? v.toDate() : v ? new Date(v) : null);
      return d ? d.toLocaleString() : '—';
    };

    // NEW: resolve reported user's display name from cache if missing
    const ruId = typeof report.reportedUser === 'string'
      ? report.reportedUser
      : report.reportedUser?.id || null;
    const ruName = (typeof report.reportedUser === 'object' && report.reportedUser?.name)
      ? report.reportedUser.name
      : (ruId ? userNameCache[ruId] : null) || '—';

    const avatarInitial = (ruName || 'U').trim().charAt(0).toUpperCase();

    const hasAnyContent =
      !!content.title || !!content.body || !!content.location || (content.images && content.images.length) || !!content.createdAt;

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

  // NEW: Take Action modal (100% like screenshot)
  const TakeActionModal = ({ report, onClose }) => {
    const [typeVal, setTypeVal] = useState('');
    const [reasonVal, setReasonVal] = useState('');
    const [notesVal, setNotesVal] = useState('');

    const disabled = !typeVal || !reasonVal || actionSubmitting;

    const name = report?.reportedUser?.name || 'the user';

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

  // Filtered reports (used by count + table)
  const filteredReports = React.useMemo(() => {
    const q = (reportSearch || '').trim().toLowerCase();
    return reports.filter((r) => {
      const okQ = !q || [r.title, r.reporterName, r.reportedUser?.name, r.reason]
        .some((v) => (v || '').toString().toLowerCase().includes(q));
      const okStatus   = reportStatus === 'all'   || (r.status || '').toLowerCase() === reportStatus;
      const okPriority = reportPriority === 'all' || (r.priority || '').toLowerCase() === reportPriority;
      const okType     = reportType === 'all'     || (r.contentType || '').toLowerCase() === reportType.toLowerCase();
      return okQ && okStatus && okPriority && okType;
    });
  }, [reports, reportSearch, reportStatus, reportPriority, reportType]);

  // NEW: helper to normalize a report document
  const normalizeReportDoc = (d) => {
    const data = typeof d.data === 'function' ? d.data() : d;

    const rep = data.reporter || {};
    const rawReported = data.reportedUser;
    const statusRaw = (data.status || 'pending').toString().toLowerCase().replace(/\s+/g, '_');
    const priorityRaw = (data.priority || 'low').toString().toLowerCase();

    const created =
      data.createdAt?.toDate?.() ||
      data.date?.toDate?.() ||
      data.timestamp?.toDate?.() ||
      data.createdAt || data.date || data.timestamp || null;

    return {
      id: d.id || data.id,
      title: data.title || data.subject || data.reason || 'Report',
      reporterName: data.reporterName || rep.name || rep.displayName || '—',
      reportedUser:
        typeof rawReported === 'string'
          ? { id: rawReported || data.reportedUserId || '—', name: data.reportedUserName || '—', avatarUrl: null }
          : {
              id: rawReported?.id || data.reportedUserId || '—',
              name: rawReported?.name || rawReported?.displayName || data.reportedUserName || '—',
              avatarUrl: rawReported?.avatarUrl || rawReported?.photoURL || null,
            },
      contentType: data.contentType || data.type || 'Post',
      reason: data.reason || '—',
      priority: priorityRaw,
      status: statusRaw,
      createdAt: created ? new Date(created) : null,
      reportedContent: data.reportedContent || null,
      contentId: data.contentId || data.postId || null,
      __coll: d.ref?.parent?.id || null,
    };
  };

  // NEW: the id of the report currently viewed
  const [viewReportId, setViewReportId] = useState(null);

  // Subscribe to the selected report doc while the modal is open
 
  useEffect(() => {
    if (!viewReportId) return;
   

   
    let unsub;

    const trySub = (collName) => {
      try {
        const ref = doc(db, collName, viewReportId);
        return onSnapshot(ref, (snap) => {
          if (snap.exists()) setViewReport(normalizeReportDoc(snap));
        });
      } catch {
        return null;
      }
    };

    unsub = trySub('report') || trySub('reports');

    return () => { if (typeof unsub === 'function') unsub(); };
  }, [viewReportId]);

  // Seed cache from loaded Users list
  useEffect(() => {
    if (!Array.isArray(users) || users.length === 0) return;
    const updates = {};
    for (const u of users) {
      if (!u?.id || userNameCache[u.id]) continue;
      updates[u.id] = u.travelerName || u.name || u.displayName || u.username || u.email || '—';
    }
    if (Object.keys(updates).length) {
      setUserNameCache((prev) => ({ ...prev, ...updates }));
    }
  }, [users, userNameCache]);

  // Resolve missing names for Reported User IDs from Firestore
  useEffect(() => {
    if (!Array.isArray(reports) || reports.length === 0) return;

    const ids = Array.from(
      new Set(
        reports
          .map((r) => (typeof r?.reportedUser === 'string' ? r.reportedUser : r?.reportedUser?.id))
          .filter(Boolean)
      )
    ).filter((id) => !userNameCache[id]);

    if (ids.length === 0) return;

    const chunks = (arr, size = 10) => {
      const out = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };

    (async () => {
      const updates = {};
      for (const group of chunks(ids, 10)) {
        try {
          const qref = query(collection(db, 'users'), where(documentId(), 'in', group));
          const snap = await getDocs(qref);
          snap.forEach((ds) => {
            const data = ds.data() || {};
            updates[ds.id] = data.travelerName || data.name || data.displayName || data.username || data.email || '—';
          });
        } catch {
          for (const uid of group) {
            try {
              const ds = await getDoc(doc(db, 'users', uid));
              if (ds.exists()) {
                const data = ds.data() || {};
                updates[uid] = data.travelerName || data.name || data.displayName || data.username || data.email || '—';
              }
            } catch (err) {
              // Handle error or ignore
            }
          }
        }
      }
      if (Object.keys(updates).length) setUserNameCache((prev) => ({ ...prev, ...updates }));
   
    })();
  }, [reports, userNameCache]);

  return (
    <div className="cms-root">
      <aside className="sidebar">
        <div className="brand">
          <h2>LakbAI</h2>
          <div className="muted">Content Management System</div>
        </div>


        <nav>
          <button className={`sidebar-item ${active === 'dashboard' ? 'active' : ''}`} onClick={() => setActive('dashboard')}>
            <span className="icon">📊</span> <span>Dashboard</span>
          </button>
          <button className={`sidebar-item ${active === 'destinations' ? 'active' : ''}`} onClick={() => setActive('destinations')}>
            <span className="icon">🏖️</span> <span>Destinations</span>
          </button>
          <button className={`sidebar-item ${active === 'reports' ? 'active' : ''}`} onClick={() => setActive('reports')}>
            <span className="icon">📝</span> <span>Reports</span>
          </button>
          <button className={`sidebar-item ${active === 'users' ? 'active' : ''}`} onClick={() => setActive('users')}>
            <span className="icon">👥</span> <span>Users</span>
          </button>
          <button className={`sidebar-item ${active === 'settings' ? 'active' : ''}`} onClick={() => setActive('settings')}>
            <span className="icon">⚙️</span> <span>Settings</span>
          </button>
        </nav>

        <div className="sidebar-footer">
        <div className="muted small">jeremyjohnaclan@gmail.com</div>
        <button className="btn-danger-signout" style={{ marginTop: 8 }}>Sign Out</button>
        </div>
      </aside>
      <main className="main-content">
        <div className="page-wrap">
        {active === 'dashboard' && (
            <div className="dashboard">
            <header style={{ marginBottom: 18 }}>
                <h1 style={{ margin: 0 }}>Dashboard</h1>
                <p className="muted">LakbAI - content management overview</p>
            </header>

            <div className="stats-grid" style={{ marginBottom: 20 }}>
                <div className="stat-card content-card gradient-1" style={{ padding: 20 }}>
                  <div style={{ fontWeight: 700, color: '#fff' }}>Total Destinations</div>
                  <div className="stat-value" style={{ color: '#fff' }}>
                    {Number(analytics.totalDestinations || 0).toLocaleString()}
                  </div>
                  <div className="muted" style={{ opacity: 0.9 }}>Active travel destinations</div>
                </div>

                <div className="stat-card content-card gradient-2" style={{ padding: 20 }}>
                  <div style={{ fontWeight: 700, color: '#fff' }}>Total Users</div>
                  <div className="stat-value" style={{ color: '#fff' }}>
                    {Number(analytics.totalUsers || 0).toLocaleString()}
                  </div>
                  <div className="muted" style={{ opacity: 0.9 }}>Registered travelers</div>
                </div>

                <div className="stat-card content-card gradient-3" style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, color: '#fff' }}>Total Reports</div>
                <div className="stat-value" style={{ color: '#fff' }}>{analytics.totalArticles}</div>
                <div className="muted" style={{ opacity: 0.9 }}>Reported Contents</div>
                </div>

                <div className="stat-card content-card gradient-4" style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, color: '#fff' }}>Published Content</div>
                <div className="stat-value" style={{ color: '#fff' }}>{analytics.publishedContent}</div>
                <div className="muted" style={{ opacity: 0.9 }}>Live content pieces</div>
                </div>
            </div>

            <div className="content-card" style={{ padding: 20, borderRadius: 12 }}>
                <h2 style={{ marginTop: 0 }}>Recent Activity</h2>
                <div style={{ minHeight: 120 }}>
                {loading ? (
                    <div className="centered"><div className="loading-spinner" /></div>
                ) : analytics.recentActivity.length ? (
                    analytics.recentActivity.map((it, i) => (
                    <div key={i} className="activity-row">
                        <div className="activity-icon">{it.type === 'destination' ? '🏖️' : '📝'}</div>
                        <div className="activity-body">
                        <strong>{it.name || it.title}</strong>
                        <div className="muted small">{it.type} • Updated {new Date(it.updatedAt || it.createdAt || Date.now()).toLocaleDateString()}</div>
                        </div>
                        <div className={`status-badge status-${it.status || 'draft'}`}>{(it.status || 'draft').toUpperCase()}</div>
                    </div>
                    ))
                ) : (
                    <div className="muted" style={{ padding: 24 }}>No recent activity</div>
                )}
                </div>
            </div>
            </div>
        )}
        </div>

        {active === 'destinations' && (
            <div className="content-section">
                <div className="section-header" style={{ alignItems: 'flex-start' }}>
                    <div>
                        <h2 className="title">Destinations</h2>
                        <p className="muted">Manage your destinations content</p>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <button className="btn-primary-cms" onClick={openCreate} style={{ padding: '10px 16px', borderRadius: 12 }}>
                            + Add New destination
                        </button>
                    </div>
                </div>

                {/* Destination modal */}
                {showForm && (
                  <div
                    role="dialog"
                    aria-modal="true"
                    style={{
                      position: 'fixed',
                      inset: 0,
                      background: 'rgba(0,0,0,0.55)',
                      zIndex: 1000,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}
                  >
                    <div
                      style={{
                        width: 'min(980px, 98vw)',
                        background: '#fff',
                        borderRadius: 16,
                        boxShadow: '0 20px 60px rgba(0,0,0,.25)',
                        maxHeight: '92vh',
                        overflow: 'auto',
                        padding: 20
                      }}
                    >
                      <DestinationForm
                        initial={editing}
                        onCancel={closeForm}
                        onSave={handleSaveDestination}
                        // Pass current destination names (excluding the record being edited)
                        existingNames={(destinations || [])
                          .filter((d) => d?.id !== (editing?.id || null))
                          .map((d) => ((d?.name || '').trim().toLowerCase()))
                          .filter(Boolean)}
                        ignoreId={editing?.id || null}
                      />
                    </div>
                  </div>
                )}

                <div className="filters content-card" style={{ display: 'flex', gap: 12, padding: 16, alignItems: 'center', marginBottom: 18 }}>
                    <div className="search-bar" style={{ position: 'relative', flex: 1 }}>
                    <span className="search-icon">🔍</span>
                    <input
                        className="form-input"
                        style={{ width: '100%', paddingLeft: 48 }}
                        placeholder="Search content..."
                        value={searchDest}
                        onChange={(e) => setSearchDest(e.target.value)}
                    />
                    </div>

                    <select className="form-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 160 }}>
                    <option value="">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                    </select>

                    <select className="form-input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ width: 200 }}>
                    <option value="">All Categories</option>
                    <option>Beach</option>
                    <option>Mountain</option>
                    <option>Tourist</option>
                    <option>Waterfalls</option>
                    <option>Historical</option>
                    <option>Parks</option>
                    <option>Museums</option>
                    <option>Natural</option>
                    <option>Landmarks</option>
                    <option>Cultural</option>
                    <option>Caves</option>
                    <option>Islands</option>
                    <option>Lakes</option>
                    <option>Heritage</option>
                    </select>

                    <button
                    className="btn-secondary"
                    onClick={async () => {
                        setLoadingDest(true);
                        try {
                        if (window.firebase && window.firebase.firestore) {
                            const db = window.firebase.firestore();
                            const snap = await db.collection('destinations').get();
                            setDestinations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
                        } else {
                            setDestinations(JSON.parse(localStorage.getItem('destinations') || '[]'));
                        }
                        } catch {
                        setDestinations([]);
                        } finally {
                        setLoadingDest(false);
                        }
                    }}
                    style={{ background: 'linear-gradient(90deg,#10b981,#059669)', color: '#fff', borderRadius: 10, padding: '10px 18px' }}
                    >
                    🔄 Refresh
                    </button>
                </div>

                <div className="content-card" style={{ padding: 40, borderRadius: 12, minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    {loadingDest ? (
                        <div className="centered"><div className="loading-spinner" /></div>
                    ) : destinations.length === 0 ? (
                        <>
                            <div className="muted" style={{ marginBottom: 18 }}>No destinations found</div>
                            <button className="btn-primary-cms" onClick={openCreate} style={{ padding: '10px 20px', borderRadius: 12 }}>
                                Create your first destination
                            </button>
                        </>
                    ) : (
                        <div style={{ width: '100%' }}>
                            <table style={{
                                width: '100%',
                                borderCollapse: 'separate',
                                borderSpacing: 0,
                                background: 'transparent',
                                fontSize: 15,
                                color: '#222',
                                borderRadius: 12,
                                overflow: 'hidden',
                                boxShadow: 'none'
                            }}>
                                <thead>
                                    <tr style={{ background: '#f6f8fa', color: '#6b7280', fontWeight: 600 }}>
                                        <th style={{ padding: '14px 16px', textAlign: 'left', borderTopLeftRadius: 12 }}>Title</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'left' }}>Category</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'left' }}>Status</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'left' }}>Updated</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'left', borderTopRightRadius: 12 }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {destinations.map((d, i) => (
                                        <tr key={d.id || i} style={{
                                            background: i % 2 === 0 ? '#fff' : '#f9fafb',
                                            borderBottom: '1px solid #f1f5f9'
                                        }}>
                                            <td style={{ padding: '14px 16px', verticalAlign: 'top', minWidth: 120 }}>
                                                <div style={{ fontWeight: 600 }}>{d.name}</div>
                                                <div style={{ color: '#6b7280', fontSize: 13 }}>{d.description}</div>
                                            </td>
                                            <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                                                <span style={{
                                                    background: '#e0f2fe',
                                                    color: '#2563eb',
                                                    fontWeight: 600,
                                                    fontSize: 13,
                                                    padding: '4px 14px',
                                                    borderRadius: 8,
                                                    display: 'inline-block'
                                                }}>
                                                    {d.category || 'Adventure'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                                                <span style={{
                                                    background: '#fef3c7',
                                                    color: '#b45309',
                                                    fontWeight: 600,
                                                    fontSize: 13,
                                                    padding: '4px 14px',
                                                    borderRadius: 8,
                                                    display: 'inline-block'
                                                }}>
                                                    {(d.status || 'draft').toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 16px', verticalAlign: 'top', fontSize: 14 }}>
                                                {d.updatedAt ? new Date(d.updatedAt).toLocaleDateString() : new Date().toLocaleDateString()}
                                            </td>
                                            <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                                                <button
                                                    className="btn-primary-cms"
                                                    style={{
                                                        background: '#dcfce7',      // same as Users "Edit"
                                                        color: '#166534',
                                                        border: 'none',
                                                        padding: '6px 18px',
                                                        borderRadius: 8,
                                                        fontWeight: 700,
                                                        marginRight: 8,
                                                        fontSize: 14,
                                                        boxShadow: 'none'
                                                    }}
                                                    onClick={() => {
                                                        setEditing(d);
                                                        setShowForm(true);
                                                    }}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="btn-danger"
                                                    style={{
                                                        background: '#fee2e2',     // same as Users "Delete"
                                                        color: '#b91c1c',
                                                        border: 'none',
                                                        padding: '6px 18px',
                                                        borderRadius: 8,
                                                        fontWeight: 700,
                                                        fontSize: 14,
                                                        boxShadow: 'none'
                                                    }}
                                                    onClick={async () => {
                                                         if (window.confirm('Delete this destination?')) {
                                                             // Delete from Firestore
                                                             try {
                                                                 await import('firebase/firestore').then(({ deleteDoc, doc }) =>
                                                                     deleteDoc(doc(db, 'destinations', d.id))
                                                                 );
                                                             } catch (err) {
                                                                 console.error('Firestore delete failed:', err);
                                                             }
                                                             // Delete featured image from Cloudinary
                                                             const featuredId = getCloudinaryPublicId(d.media?.featuredImage);
                                                             if (featuredId) await deleteCloudinaryImage(featuredId);
                                                                
                                                             // Delete gallery images from Cloudinary
                                                             if (Array.isArray(d.media?.gallery)) {
                                                                 for (const img of d.media.gallery) {
                                                                     const imgId = getCloudinaryPublicId(img);
                                                                     if (imgId) await deleteCloudinaryImage(imgId);
                                                                 }
                                                             }
                                                             // Remove from local state
                                                             setDestinations((s) => s.filter((x) => x.id !== d.id));
                                                             // Remove from localStorage fallback
                                                             const stored = JSON.parse(localStorage.getItem('destinations') || '[]');
                                                             localStorage.setItem('destinations', JSON.stringify(stored.filter((x) => x.id !== d.id)));
                                                             // set analytics state
                                                             setAnalytics((a) => ({ ...a, totalDestinations: Math.max(0, (a.totalDestinations || 1) - 1) }));
                                                         }
                                                     }}
                                                 >
                                                     Delete
                                                 </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            
        )}
        {active === 'articles' && <div className="content-section"><h2>Articles</h2></div>}
        {active === 'reports' && (
          <div className="content-section">
            <div className="section-header" style={{ alignItems: 'center' }}>
              <div>
                <h2 className="title" style={{ margin: 0 }}>Content Reports</h2>
                <p className="muted" style={{ marginTop: 4 }}>Review and moderate reported community content</p>
              </div>
              <div className="muted small" style={{ marginLeft: 'auto' }}>{filteredReports.length} reports</div>
            </div>

            {/* Filters row */}
            <div className="content-card" style={{ padding: 16, borderRadius: 12, display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span className="search-icon" style={{ position: 'absolute', left: 14, top: 22, opacity: 0.6 }}>🔎</span>
                <input
                  className="form-input"
                  style={{ width: '100%', paddingLeft: 40 }}
                  placeholder="Search reports..."
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                />
              </div>
              <select className="form-input" value={reportStatus} onChange={(e) => setReportStatus(e.target.value)} style={{ width: 160 }}>
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="resolved">Resolved</option>
                <option value="escalated">Escalated</option>
              </select>

              <select className="form-input" value={reportPriority} onChange={(e) => setReportPriority(e.target.value)} style={{ width: 160 }}>
                <option value="all">All Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>

              <select className="form-input" value={reportType} onChange={(e) => setReportType(e.target.value)} style={{ width: 160 }}>
                <option value="all">All Types</option>
                <option value="Post">Post</option>
                <option value="Comment">Comment</option>
                <option value="Review">Review</option>
                <option value="Message">Message</option>
              </select>
            </div>

            {/* Table */}
            <div className="content-card" style={{ padding: 0, borderRadius: 12, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.6fr 1.2fr 1.6fr 1fr 1.2fr 1.2fr 1.2fr', gap: 0, background: '#f6f8fa', color: '#6b7280', fontWeight: 700, fontSize: 14 }}>
                {['Report Details', 'Reported User', 'Content Type', 'Reason', 'Priority', 'Status', 'Reported Date', 'Actions'].map((h) => (
                  <div key={h} style={{ padding: '14px 16px', borderBottom: '1px solid #eef2f7' }}>
                    {h}
                  </div>
                ))}
              </div>

              {loadingReports ? (
                <div className="centered" style={{ padding: 40 }}><div className="loading-spinner" /></div>
              ) : filteredReports.length === 0 ? (
                <div className="muted" style={{ padding: 24 }}>No reports found</div>
              ) : (
                filteredReports.map((r, i) => (
                  <div key={r.id || i} style={{ display: 'grid', gridTemplateColumns: '3fr 1.6fr 1.2fr 1.6fr 1fr 1.2fr 1.2fr 1.2fr', alignItems: 'center', background: i % 2 ? '#fff' : '#fafbfc', borderBottom: '1px solid #eef2f7' }}>
                    {/* Report Details */}
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700 }}>{r.title}</div>
                      <div className="muted small">By: {r.reporterName}</div>
                    </div>
                    {/* Reported User */}
                    {(() => {
                      const ruId = typeof r.reportedUser === 'string'
                        ? r.reportedUser
                        : r?.reportedUser?.id || '';
                      const ruName = (typeof r.reportedUser === 'object' && r.reportedUser?.name)
                        ? r.reportedUser.name
                        : (ruId ? userNameCache[ruId] : null) || '—';
                      const initial = (ruName || 'U').trim().charAt(0).toUpperCase();
                      return (
                        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 600 }}>
                            {initial}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{ruName}</div>
                            <div className="muted small">ID: {ruId || '—'}</div>
                          </div>
                        </div>
                      );
                    })()}
                    {/* Content Type */}
                    <div style={{ padding: '14px 16px' }}>{r.contentType}</div>
                    {/* Reason */}
                    <div style={{ padding: '14px 16px' }}>{r.reason}</div>
                    {/* Priority */}
                    <div style={{ padding: '14px 16px' }}><PriorityBadge v={r.priority} /></div>
                    {/* Status */}
                    <div style={{ padding: '14px 16px' }}><StatusBadge v={r.status} /></div>
                    {/* Date */}
                    <div style={{ padding: '14px 16px' }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</div>
                    {/* Actions */}
                    <div style={{ padding: '14px 16px', display: 'flex', gap: 8 }}>
                      <button
                        className="btn-view"
                        style={{ background: '#e0e7ff', color: '#2563eb', border: 'none', padding: '6px 18px', borderRadius: 8, fontWeight: 700, fontSize: 14 }}
                        onClick={() => { setViewReport(r); setViewReportId(r.id); }}
                      >
                        View
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', padding: '6px 18px', borderRadius: 8, fontWeight: 700, fontSize: 14 }}
                        onClick={() => openActionModal(r)}
                      >
                        Action
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* View modal */}
            {viewReport && (
              <ReportDetailModal
                report={viewReport}
                onClose={() => { setViewReport(null); setViewReportId(null); }}
                onTakeAction={(r) => { setViewReport(null); setViewReportId(null); openActionModal(r); }}
              />
            )}
          </div>
        )}

        {/* NEW: Take Action modal mount */}
        {actionOpen && actionReport && (
          <TakeActionModal
            report={actionReport}
            onClose={() => { if (!actionSubmitting) { setActionOpen(false); setActionReport(null); } }}
          />
        )}

        {active === 'users' && (
          <div className="content-section">
            <div className="section-header" style={{ alignItems: 'center' }}>
              <div>
                <h2 className="title" style={{ margin: 0 }}>User Management</h2>
                <p className="muted" style={{ marginTop: 4 }}>Manage traveler accounts and profiles</p>
              </div>
              <button
                className="btn-primary-cms"
                style={{ padding: '10px 16px', borderRadius: 12, background: 'linear-gradient(90deg,#2563eb,#3b82f6)' }}
                onClick={() => alert('Add New User (admin flow TBD)')}
              >
                + Add New User
              </button>
            </div>

            {/* Search + Status filter row */}
            <div className="content-card" style={{ padding: 16, borderRadius: 12, display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span className="search-icon" style={{ position: 'absolute', left: 14, top: 22, opacity: 0.6 }}>🔎</span>
                <input
                  className="form-input"
                  style={{ width: '100%', paddingLeft: 40 }}
                  placeholder="Search users by name or email..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                />
              </div>
              <select
                className="form-input"
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                style={{ width: 160 }}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
                <option value="banned">Banned</option>
              </select>
            </div>

            <div className="content-card" style={{ padding: 0, borderRadius: 12, overflow: 'hidden' }}>
              {/* Define a consistent 6-column grid (User, Email, Provider, Status, Join Date, Actions) */}
              {(() => {
                const userGridCols = '2.6fr 2fr 1.2fr 1.2fr 1.4fr 1.6fr';

                // Table header
                const header = (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: userGridCols,
                      gap: 0,
                      background: '#f6f8fa',
                      color: '#6b7280',
                      fontWeight: 700,
                      fontSize: 14,
                      justifyItems: 'start',
                      textAlign: 'left'
                    }}
                  >
                    {['User', 'Email', 'Provider', 'Status', 'Join Date', 'Actions'].map((h) => (
                      <div key={h} style={{ padding: '14px 16px', borderBottom: '1px solid #eef2f7' }}>
                        {h}
                      </div>
                    ))}
                  </div>
                );

                if (loadingUsers) {
                  return (
                    <>
                      {header}
                      <div className="centered" style={{ padding: 40 }}>
                        <div className="loading-spinner" />
                      </div>
                    </>
                  );
                }

                const q = searchUser.trim().toLowerCase();
                const filtered = (users || []).filter((u) => {
                  if (!u) return false; // guard against null entries
                  const okQ =
                    !q || ((u.travelerName || u.name || '') + ' ' + (u.email || '')).toLowerCase().includes(q);
                  const s = (u.status || 'active').toLowerCase();
                  const okS = userStatusFilter === 'all' || s === userStatusFilter;
                  return okQ && okS;
                });

                if (!filtered.length) {
                  return (
                    <>
                      {header}
                      <div className="muted" style={{ padding: 24 }}>
                        No users found
                      </div>
                    </>
                  );
                }

                const rowStyle = {
                  display: 'grid',
                  gridTemplateColumns: userGridCols,
                  alignItems: 'center',
                  justifyItems: 'start',
                  textAlign: 'left'
                };

                return (
                  <>
                    {header}
                    {filtered.map((u, i) => {
                      const name = u.travelerName || u.name || 'Unnamed';
                      const initial = name.charAt(0).toUpperCase();
                      const provider = u.provider || u.providerId || 'Email';
                      const status = (u.status || 'ACTIVE').toUpperCase();
                      const createdAt = u.createdAt?.toDate
                        ? u.createdAt.toDate()
                        : u.createdAt
                        ? new Date(u.createdAt)
                        : null;
                      const joinDate = createdAt ? createdAt.toLocaleDateString() : '';
                      const pUrl =
                        u.profilePictureUrl ||
                        u.photoURL ||
                        u.photoUrl ||
                        u.avatarUrl ||
                        u.avatar ||
                        u.photo;
                      const pid = getCloudinaryPublicId(pUrl);

                      return (
                        <div
                          key={u.id || i}
                          style={{
                            ...rowStyle,
                            background: i % 2 ? '#fff' : '#fafbfc',
                            borderBottom: '1px solid #eef2f7'
                          }}
                        >
                          {/* User */}
                          <div
                            style={{
                              padding: '14px 16px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12
                            }}
                          >
                            {pid ? (
                              <CloudinaryContext cloudName={CLOUDINARY_CLOUD_NAME}>
                                <Image
                                  publicId={pid}
                                  width="36"
                                  height="36"
                                  crop="fill"
                                  gravity="face"
                                  radius="max"
                                  alt=""
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    objectFit: 'cover'
                                  }}
                                />
                              </CloudinaryContext>
                            ) : pUrl ? (
                              <img
                                src={pUrl}
                                alt=""
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: '50%',
                                  objectFit: 'cover'
                                }}
                              />
                            ) : (
                              <div style={{
                                width: 36, height: 36, borderRadius: '50%',
                                background: '#6366f1', color: '#fff',
                                display: 'grid', placeItems: 'center',
                                fontWeight: 700, fontSize: 16
                              }}>
                                {initial} {/* use current row's initial, not userProfile */}
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: 700 }}>{name}</div>
                              <div className="muted small">ID: {u.id}</div>
                            </div>
                          </div>

                          {/* Email */}
                          <div style={{ padding: '14px 16px' }}>{u.email || '—'}</div>

                          {/* Provider */}
                          <div style={{ padding: '14px 16px' }}>{provider}</div>

                          {/* Status */}
                          <div style={{ padding: '14px 16px' }}>
                            <span
                              style={{
                                background: '#dcfce7',
                                color: '#166534',
                                borderRadius: 999,
                                padding: '4px 10px',
                                fontWeight: 700,
                                fontSize: 12
                              }}
                            >
                              {status}
                            </span>
                          </div>

                          {/* Join Date */}
                          <div style={{ padding: '14px 16px' }}>{joinDate}</div>

                          {/* Actions */}
                          <div
                            style={{
                              padding: '14px 16px',
                              display: 'flex',
                              gap: 8,
                              justifyContent: 'flex-start'
                            }}
                          >
                            <button
                              className="btn-view"
                              style={{
                                background: '#e0e7ff',
                                color: '#2563eb',
                                border: 'none',
                                padding: '6px 18px',
                                borderRadius: 8,
                                fontWeight: 700,
                                fontSize: 14
                              }}
                              onClick={() => openUserProfile(u)}
                            >
                              View
                            </button>

                            <button
                              className="btn-primary-cms"
                              style={{
                                background: '#dcfce7',
                                color: '#166534',
                                border: 'none',
                                padding: '6px 18px',
                                borderRadius: 8,
                                fontWeight: 700,
                                marginRight: 8,
                                fontSize: 14,
                                boxShadow: 'none'
                              }}
                              onClick={() => openEditUserModal(u, 'basic')}
                            >
                              Edit
                            </button>

                            <button
                              className="btn-danger"
                              style={{
                                background: '#fee2e2',
                                color: '#b91c1c',
                                border: 'none',
                                padding: '6px 18px',
                                borderRadius: 8,
                                fontWeight: 700,
                                fontSize: 14,
                                boxShadow: 'none'
                              }}
                              onClick={async () => {
                                if (!u.id) return;
                                if (!window.confirm('Delete this user?')) return;
                                try {
                                  await deleteDoc(doc(db, 'users', u.id));
                                  setUsers((arr) => arr.filter((x) => x.id !== u.id));
                                } catch (err) {
                                  console.error('Delete user failed', err);
                                  alert('Failed to delete user.');
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>

            {/* User Profile Modal */}
            {userProfileOpen && userProfile && (
              <div
                role="dialog"
                aria-modal="true"
                style={{
                  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}
                onClick={(e) => { if (e.target === e.currentTarget) closeUserProfile(); }}
              >
                <div style={{
                  width: 'min(980px, 96vw)', background: '#fff', borderRadius: 16,
                  boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden'
                }}>
                  {/* Header */}
                  <div style={{
                    padding: '22px 28px 22px 28px', background: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}>
                    <div style={{ fontSize: 26, fontWeight: 600, color: '#111827' }}>User Profile</div>
                    <button onClick={closeUserProfile} style={{
                      background: 'transparent', border: 'none', fontSize: 28, cursor: 'pointer', color: '#111'
                    }}>×</button>
                  </div>
                  {/* Profile Section */}
                  <div style={{
                    background: 'linear-gradient(90deg,#4f46e5,#3b82f6)', padding: '24px 28px',
                    display: 'flex', alignItems: 'center', gap: 22
                  }}>
                    {(() => {
                      const pUrl = userProfile.profilePictureUrl || userProfile.photoURL || userProfile.photoUrl || userProfile.avatarUrl || userProfile.avatar || userProfile.photo;
                      const pid = getCloudinaryPublicId(pUrl);
                      if (pid) {
                        return (
                          <CloudinaryContext cloudName={CLOUDINARY_CLOUD_NAME}>
                            <Image
                              publicId={pid}
                              width="56"
                              height="56"
                              crop="fill"
                              gravity="face"
                              radius="max"
                              alt=""
                              style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 10px rgba(0,0,0,.08)' }}
                            />
                          </CloudinaryContext>
                        );
                      }
                      if (pUrl) {
                        return (
                          <img
                            src={pUrl}
                            alt=""
                            style={{
                              width: 56, height: 56, borderRadius: '50%', objectFit: 'cover',
                              boxShadow: '0 2px 10px rgba(0,0,0,.08)'
                            }}
                          />
                        );
                      }
                      return (
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: '#6366f1', color: '#fff',
                          display: 'grid', placeItems: 'center',
                          fontWeight: 700, fontSize: 16
                        }}>
                          {(userProfile.travelerName || userProfile.name || userProfile.email || 'U')
                            .toString().trim().charAt(0).toUpperCase()}
                        </div>
                      );
                    })()}
                    <div style={{ color: '#fff', flex: 1 }}>
                      <div style={{ fontSize: 22, fontWeight: 500 }}>{userProfile.travelerName || userProfile.name || 'Unnamed'}</div>
                      <div style={{ opacity: .95, fontWeight: 400 }}>{userProfile.email || ''}</div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 10, alignItems: 'center' }}>
                        <span style={{
                          background: '#34d399', color: '#fff', fontSize: 13, fontWeight: 500,
                          borderRadius: 999, padding: '7px 18px'
                        }}>ACTIVE</span>
                        <span style={{ color: '#e0e7ff', fontWeight: 400 }}>Joined {fmtDate(userProfile.createdAt)}</span>
                      </div>
                    </div>
                    <button
                      style={{
                        background: '#22c55e', color: '#fff', border: 'none', padding: '10px 22px',
                        fontWeight: 500, borderRadius: 8, fontSize: 16, boxShadow: '0 2px 8px rgba(34,197,94,.15)'
                      }}
                      onClick={() => openEditUserModal(userProfile, 'basic')}
                    >Edit Profile
                    </button>
                  </div>
                  {/* Tabs */}
                  <div style={{
                    display: 'flex', gap: 40, padding: '0 28px', borderBottom: '1px solid #e5e7eb', marginBottom: 0, marginTop: 0
                  }}>
                    {['overview', 'activity', 'photos', 'achievements'].map(t => (
                      <button
                        key={t}
                        onClick={() => setUserProfileTab(t)}
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer', padding: '24px 0 12px 0',
                          color: userProfileTab === t ? '#2563eb' : '#6b7280', fontWeight: 500,
                          fontSize: 15,
                          borderBottom: userProfileTab === t ? '3px solid #2563eb' : '3px solid transparent'
                        }}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                  {/* Body */}
                  {userProfileTab === 'overview' && (
                    <div style={{ padding: '28px', background: '#f8fafc' }}>
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18
                      }}>
                        {/* Profile Information card */}
                        <div style={{
                          background: '#fff', borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,.04)', padding: 18
                        }}>
                          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 16 }}>Profile Information</div>
                          <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 4 }}>Bio:</div>
                          <div style={{ marginBottom: 12, fontWeight: 400 }}>
                            {userProfile.travelerBio || userProfile.bio || '—'}
                          </div>
                          <div style={{ color: '#6b7280', fontSize: 13 }}>Sign Provider:</div>
                          <div style={{ marginBottom: 10, fontWeight: 400 }}>{userProfile.provider || userProfile.providerId || 'Email'}</div>
                          <div style={{ color: '#6b7280', fontSize: 13 }}>Last Login:</div>
                          <div style={{ fontWeight: 400 }}>{fmtDateTime(userProfile.lastLogin)}</div>
                        </div>

                        {/* Travel Stats card (from Firestore) */}
                        <div style={{
                          background: '#fff', borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,.04)', padding: 18
                        }}>
                          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 16 }}>Travel Stats</div>
                          {(() => {
                            const s = userStats[userProfile.id] || { places: 0, photos: 0, reviews: 0, friends: 0 };
                            const cell = (val, label, color) => (
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 24, fontWeight: 800, color }}>{Number(val || 0).toLocaleString()}</div>
                                <div className="muted small" style={{ marginTop: 4 }}>{label}</div>
                              </div>
                            );
                            return (
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4,1fr)',
                                gap: 12,
                                alignItems: 'center'
                              }}>
                                {cell(s.places, 'Places Visited', '#2563eb')}
                                {cell(s.photos, 'Photos Shared', '#16a34a')}
                                {cell(s.reviews, 'Reviews Written', '#7c3aed')}
                                {cell(s.friends, 'Friends', '#f97316')}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18
                      }}>
                        {/* Travel Interests */}
                        <div style={{
                          background: '#fff', borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,.04)', padding: 18
                        }}>
                          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 16 }}>Travel Interests</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {Array.isArray(userProfile.interests) && userProfile.interests.length > 0 ? (
                              userProfile.interests.map((t, idx) => (
                                <span key={idx} style={{
                                  background: '#e0f2fe',
                                  color: '#2563eb',
                                  fontWeight: 600,
                                  fontSize: 13,
                                  padding: '4px 14px',
                                  borderRadius: 8,
                                  display: 'inline-block'
                                }}>
                                  {t}
                                </span>
                              ))
                            ) : (
                              <span className="muted" style={{ fontSize: 13 }}>No interests set</span>
                            )}
                          </div>
                        </div>

                        {/* Places Visited (matches screenshot) */}
                        <div style={{
                          background: '#fff', borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,.04)', padding: 18
                        }}>
                          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 16 }}>Places Visited</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {Array.isArray(userProfile.places) && userProfile.places.length > 0 ? (
                              userProfile.places.map((p, idx) => (
                                <span key={idx} style={{
                                  background: '#e0f2fe',
                                  color: '#2563eb',
                                  fontWeight: 600,
                                  fontSize: 13,
                                  padding: '4px 14px',
                                  borderRadius: 8,
                                  display: 'inline-block'
                                }}>
                                  {p}
                                </span>
                              ))
                            ) : (
                              <div className="muted" style={{ fontSize: 13 }}>No places visited</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 0 }} />
                    </div>
                  )}

                  {/* Activity tab (live data) */}
                  {userProfileTab === 'activity' && (
                    <div style={{ padding: '28px', background: '#f8fafc' }}>
                      <div style={{ fontSize: 17, marginBottom: 18 }}>Recent Activity</div>

                      {loadingActivity ? (
                        <div className="centered" style={{ padding: 40 }}><div className="loading-spinner" /></div>
                      ) : userActivity.length === 0 ? (
                        <div className="muted" style={{ padding: 24 }}>No activity found</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {userActivity.map((a, idx) => (
                            <div key={idx} style={{
                              background: '#fff',
                              borderRadius: 12,
                              padding: 16,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              boxShadow: '0 2px 10px rgba(0,0,0,.04)'
                            }}>
                              <div style={{ fontSize: 28, lineHeight: 1, color: '#2563eb' }}>
                                {a.type === 'destination' ? '🏖️' : a.type === 'article' ? '📝' : '📅'}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 500, color: '#111827', marginBottom: 4 }}>
                                  {a.name || a.title}
                                </div>
                                <div className="muted small" style={{ marginBottom: 6 }}>
                                  {a.type} • {fmtDateTime(a.createdAt)}
                                </div>
                                <div style={{ fontSize: 14, color: '#374151' }}>
                                  {a.description || 'No description available.'}
                                </div>
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 500, color: '#4ade80' }}>
                                {a.status === 'completed' ? '✔️' : a.status === 'pending' ? '⏳' : '❌'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* PHOTOS tab (matches screenshot) */}
                  {userProfileTab === 'photos' && (
                    <div style={{ padding: '28px', background: '#f8fafc' }}>
                      <div style={{ fontSize: 17, marginBottom: 18 }}>Photos Shared by {userProfile.travelerName}</div>

                      {loadingPhotos ? (
                        <div className="centered" style={{ padding: 40 }}><div className="loading-spinner" /></div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 12 }}>
                          {userPhotos.length > 0 ? (
                            userPhotos.map((photo, idx) => (
                              <div key={idx} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
                                <CloudinaryContext cloudName={CLOUDINARY_CLOUD_NAME}>
                                  <Image
                                    publicId={getCloudinaryPublicId(photo)}
                                    width="120"
                                    height="90"
                                    crop="fill"
                                    style={{ borderRadius: 12, display: 'block', width: '100%', height: 'auto' }}
                                  />
                                </CloudinaryContext>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUserPhotos((prev) => prev.filter((_, i) => i !== idx));
                                    // Also remove from Firestore
                                    const photoId = getCloudinaryPublicId(photo);
                                    if (photoId) deleteCloudinaryImage(photoId);
                                  }}
                                  style={{
                                    position: 'absolute',
                                    right: 8,
                                    top: 8,
                                    background: 'rgba(0,0,0,0.6)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 4,
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="muted" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 24 }}>
                              No photos shared yet
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ACHIEVEMENTS tab (matches screenshot) */}
                  {userProfileTab === 'achievements' && (
                    <div style={{ padding: '28px', background: '#f8fafc' }}>
                      <div style={{ fontSize: 17, marginBottom: 18 }}>Achievements</div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '40px 1.2fr 1.2fr 1fr 110px',
                          gap: 12,
                          alignItems: 'center',
                          background: '#f8fafc',
                          borderRadius: 8,
                          padding: '10px 12px'
                        }}>
                          <span style={{ fontSize: 20, color: '#06b6d4', textAlign: 'center' }}>🌐</span>
                          <input className="form-input" value="Globe Trotter" disabled style={{ background: '#fff' }} />
                          <input className="form-input" value="Visited 10+ countries" disabled style={{ background: '#fff' }} />
                          <input className="form-input" value="15/08/2023" disabled style={{ background: '#fff' }} />
                          <button type="button" className="btn-danger" style={{ padding: '8px 16px', borderRadius: 8 }}>Remove</button>
                        </div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '40px 1.2fr 1.2fr 1fr 110px',
                          gap: 12,
                          alignItems: 'center',
                          background: '#f8fafc',
                          borderRadius: 8,
                          padding: '10px 12px'
                        }}>
                          <span style={{ fontSize: 20, color: '#6366f1', textAlign: 'center' }}>🖼️</span>
                          <input className="form-input" value="Photo Master" disabled style={{ background: '#fff' }} />
                          <input className="form-input" value="Shared 200+ photos" disabled style={{ background: '#fff' }} />
                          <input className="form-input" value="20/09/2023" disabled style={{ background: '#fff' }} />
                          <button type="button" className="btn-danger" style={{ padding: '8px 16px', borderRadius: 8 }}>Remove</button>
                        </div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '40px 1.2fr 1.2fr 1fr 110px',
                          gap: 12,
                          alignItems: 'center',
                          background: '#f8fafc',
                          borderRadius: 8,
                          padding: '10px 12px'
                        }}>
                          <span style={{ fontSize: 20, color: '#f59e42', textAlign: 'center' }}>⭐</span>
                          <input className="form-input" value="Review Expert" disabled style={{ background: '#fff' }} />
                          <input className="form-input" value="Written 25+ reviews" disabled style={{ background: '#fff' }} />
                          <input className="form-input" value="05/10/2023" disabled style={{ background: '#fff' }} />
                          <button type="button" className="btn-danger" style={{ padding: '8px 16px', borderRadius: 8 }}>Remove</button>
                        </div>
                      </div>
                      <button type="button" style={{
                        marginTop: 14,
                        background: '#22c55e',
                        color: '#fff',
                        border: 'none',
                        padding: '10px 18px',
                        borderRadius: 8,
                        fontWeight: 500,
                        fontSize: 15
                      }}>+ Add Achievement</button>
                    </div>
                  )}

                  {/* Recent Activity (moved from Travel to match screenshot) */}
                  {userEditOpen && editingUser && userEditTab === 'travel' && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 17, marginBottom: 12 }}>Recent Activity</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '40px 1.2fr 1.2fr 1fr 110px', gap: 12, alignItems: 'center', background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                          <select className="form-input" disabled style={{ width: 38 }}>
                            <option>Photo</option>
                          </select>
                          <input className="form-input" value="Shared photos from Bali sunset" disabled style={{ background: '#fff' }} />
                          <input className="form-input" value="15/11/2023" disabled style={{ background: '#fff' }} />
                          <button type="button" className="btn-danger" style={{ padding: '8px 16px', borderRadius: 8 }}>Remove</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '40px 1.2fr 1.2fr 1fr 110px', gap: 12, alignItems: 'center', background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                          <select className="form-input" disabled style={{ width: 38 }}>
                            <option>Review</option>
                          </select>
                          <input className="form-input" value='Reviewed "Sunset Villa Resort"' disabled style={{ background: '#fff' }} />
                          <input className="form-input" value="14/11/2023" disabled style={{ background: '#fff' }} />
                          <button type="button" className="btn-danger" style={{ padding: '8px 16px', borderRadius: 8 }}>Remove</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '40px 1.2fr 1.2fr 1fr 110px', gap: 12, alignItems: 'center', background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                          <select className="form-input" disabled style={{ width: 38 }}>
                            <option>Visit</option>
                          </select>
                          <input className="form-input" value="Checked in at Ubud, Bali" disabled style={{ background: '#fff' }} />
                          <input className="form-input" value="13/11/2023" disabled style={{ background: '#fff' }} />
                          <button type="button" className="btn-danger" style={{ padding: '8px 16px', borderRadius: 8 }}>Remove</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '40px 1.2fr 1.2fr 1fr 110px', gap: 12, alignItems: 'center', background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                          <select className="form-input" disabled style={{ width: 38 }}>
                            <option>Friend</option>
                          </select>
                          <input className="form-input" value="Connected with Mike Chen" disabled style={{ background: '#fff' }} />
                          <input className="form-input" value="12/11/2023" disabled style={{ background: '#fff' }} />
                          <button type="button" className="btn-danger" style={{ padding: '8px 16px', borderRadius: 8 }}>Remove</button>
                        </div>
                      </div>
                      <button type="button" style={{
                        marginTop: 14,
                        background: '#22c55e',
                        color: '#fff',
                        border: 'none',
                        padding: '10px 18px',
                        borderRadius: 8,
                        fontWeight: 500,
                        fontSize: 15
                      }}>+ Add Activity</button>
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 0 }} />
                </div>
              </div>
            )}
        </div>
        )}
      </main>
      <EditProfileCMS
        open={userEditOpen}
        user={editingUser}
        initialTab={userEditTab || 'basic'}
        onClose={() => { setUserEditOpen(false); setEditingUser(null); }}
        onSave={handleSaveUser}
      />
    </div>
    );
}
export default ContentManagement;