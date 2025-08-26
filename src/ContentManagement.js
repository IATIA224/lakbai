import React, { useEffect, useState, useRef } from 'react';
import './Styles/contentManager.css';
import { db, auth, storage } from './firebase';
import { collection, getDocs, doc, setDoc, updateDoc, addDoc, deleteDoc, getCountFromServer, onSnapshot } from 'firebase/firestore';
import { CloudinaryContext, Image, Video } from './cloudinary';
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
const DestinationForm = ({ initial = null, onCancel, onSave, existingNames = [] }) => {
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
        // rating: 0,
        region: '', // CHANGED: use region instead of rating
        packingSuggestions: [], // NEW: support packing suggestions (also used by CSV import)
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
const [activeTab, setActiveTab] = useState('content');
const [uploading, setUploading] = useState(false);
const [nameError, setNameError] = useState(''); // NEW: live duplicate error
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
    const nameTrim = (data.name || '').trim();
    if (!nameTrim) return alert('Please enter a destination name');
    // Duplicate check (only for "Add New destination")
    if (!initial) {
      const normalized = nameTrim.toLowerCase();
      if (existingNames.includes(normalized)) {
        alert('Destination already exists. Please use a different name.');
        return;
      }
    }
    onSave({
      ...data,
      name: nameTrim,
      updatedAt: new Date().toISOString(),
      createdAt: initial?.createdAt || new Date().toISOString()
    });
};

// NEW: live duplicate validation for "Add New" only
useEffect(() => {
  if (initial) { setNameError(''); return; }
  const v = (data.name || '').trim().toLowerCase();
  if (!v) { setNameError(''); return; }
  setNameError(existingNames.includes(v) ? 'Destination already exists.' : '');
}, [data.name, existingNames, initial]);

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
            <input
              required
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              className="form-input"
              style={nameError ? { borderColor: '#ef4444', background: '#fef2f2' } : undefined}
            />
            {nameError && (
              <div className="muted" style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>
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
            <label>Region</label> {/* CHANGED: was Rating */}
            <select
              value={data.region}  // CHANGED
              onChange={(e) => setData({ ...data, region: e.target.value })} // CHANGED
              className="form-input"
            >
              <option value="">Select region</option>
              <option value="CAR - Cordillera Administrative Region">CAR - Cordillera Administrative Region</option>
              <option value="CARAGA - Region XIII">CARAGA - Region XIII</option>
              <option value="NCR - National Capital Region">NCR - National Capital Region</option>
              <option value="Region I - Ilocos Region">Region I - Ilocos Region</option>
              <option value="Region IV-B - MIMAROPA">Region IV-B - MIMAROPA</option>
              <option value="Region V - Bicol Region">Region V - Bicol Region</option>
              <option value="Region VI - Western Visayas">Region VI - Western Visayas</option>
              <option value="Region VII - Central Visayas">Region VII - Central Visayas</option>
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
          style={{ padding: '10px 18px', borderRadius: 8, opacity: (!data.name.trim() || nameError) ? 0.6 : 1, cursor: (!data.name.trim() || nameError) ? 'not-allowed' : 'pointer' }}
          disabled={!data.name.trim() || !!nameError}
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
  const [importingCsv, setImportingCsv] = useState(false); // Added state for importingCsv
  const csvInputRef = useRef(null); // Define csvInputRef using useRef

  const handleCsvFile = async (file) => {
    if (!file) return;
    setImportingCsv(true);
    try {
      const text = await file.text();

      // CSV parser that supports quoted fields and escaped quotes
      const splitCsvLine = (line) => {
        const out = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
            else { inQuotes = !inQuotes; }
          } else if (ch === ',' && !inQuotes) {
            out.push(cur);
            cur = '';
          } else {
            cur += ch;
          }
        }
        out.push(cur);
        return out;
      };

      const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim().length);
      if (lines.length < 2) {
        alert('CSV must contain a header row and at least one data row.');
        return;
      }

      const headers = splitCsvLine(lines[0]).map(h => (h || '').trim().toLowerCase());

      // Required columns and accepted aliases
      const headerAliases = {
        name: ['destination name', 'name', 'title'],
        category: ['category'],
        description: ['description', 'desc'],
        tags: ['tags', 'tag'],
        location: ['location', 'address', 'place'],
        priceRange: ['price range', 'pricerange', 'price'],
        bestTime: ['best time to visit', 'best time', 'season'],
        region: ['region'],
        packingSuggestions: ['packing suggestions', 'packing', 'suggestions'],
      };

      const headerIndex = {};
      const missingHeaders = [];
      Object.entries(headerAliases).forEach(([key, aliases]) => {
        const idx = headers.findIndex(h => aliases.includes(h));
        if (idx === -1) missingHeaders.push(aliases[0]);
        else headerIndex[key] = idx;
      });

      if (missingHeaders.length) {
        alert(
          'Missing required column(s): ' +
          missingHeaders.join(', ') +
          '\nPlease include these headers (or their aliases) in the CSV.'
        );
        return;
      }

      const toArray = (v) => (v || '')
        .split(/[,;|]/)
        .map(x => x.trim())
        .filter(Boolean);

      const existing = new Set(destinations.map(d => (d.name || '').trim().toLowerCase()));
      const toCreate = [];
      const errors = [];
      let dupes = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = splitCsvLine(lines[i]).map(c => c.trim());
        if (cols.every(c => !c)) continue;

        const get = (key) => cols[headerIndex[key]] || '';

        const name = get('name');
        if (!name) {
          errors.push(`Row ${i + 1}: Missing Destination Name`);
          continue;
        }
        if (existing.has(name.toLowerCase())) { dupes++; continue; }

        const item = {
          name,
          category: get('category'),
          description: get('description'),
          content: '',
          tags: toArray(get('tags')),
          location: get('location'),
          priceRange: get('priceRange'),
          bestTime: get('bestTime'),
          region: get('region'),
          packingSuggestions: toArray(get('packingSuggestions')),
          media: { featuredImage: '', gallery: [] },
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Validate required values and report missing ones
        const requiredValues = ['category', 'description', 'tags', 'location', 'priceRange', 'bestTime', 'region', 'packingSuggestions'];
        const missingVals = requiredValues.filter((k) => {
          const v = item[k];
          return Array.isArray(v) ? v.length === 0 : !v;
        });
        if (missingVals.length) {
          errors.push(`Row ${i + 1}: Missing ${missingVals.join(', ')}`);
          continue;
        }

        existing.add(name.toLowerCase());
        toCreate.push(item);
      }

      if (!toCreate.length) {
        let msg = 'No new destinations to import.';
        if (dupes) msg += ` Skipped ${dupes} duplicate name(s).`;
        if (errors.length) msg += `\nIssues:\n- ${errors.join('\n- ')}`;
        alert(msg);
        return;
      }

      const created = [];
      for (const item of toCreate) {
        try {
          const ref = await addDoc(collection(db, 'destinations'), item);
          created.push({ ...item, id: ref.id });
        } catch (e) {
          errors.push(`Failed to import "${item.name}": ${e.message || e}`);
        }
      }

      if (created.length) {
        setDestinations((prev) => [...created, ...prev]);
        setAnalytics((a) => ({ ...a, totalDestinations: (a.totalDestinations || 0) + created.length }));
        // NEW: log bulk import summary
        addActivity({ action: 'imported', subject: 'destination', count: created.length });
      }

      let summary = `Import complete. Added ${created.length} destination(s).`;
      if (dupes) summary += ` Skipped ${dupes} duplicate name(s).`;
      if (errors.length) summary += `\nProblems:\n- ${errors.join('\n- ')}`;
      alert(summary);
    } catch (e) {
      alert('Failed to import CSV: ' + (e.message || 'Unknown error'));
    } finally {
      setImportingCsv(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  // USERS state + fetch (added)
  const [users, setUsers] = useState([]);
  const [searchUser, setSearchUser] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userStatusFilter, setUserStatusFilter] = useState('all');

  // NEW: User Profile modal state
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [userProfileTab, setUserProfileTab] = useState('overview');

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

  useEffect(() => {
    (async () => {
      try {
        const [dSnap, uSnap, aSnap] = await Promise.all([
          getDocs(collection(db, 'destinations')),
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'articles')),
        ]);
        const destinations = dSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const users = uSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const articles = aSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const published =
          (destinations.filter((x) => x.status === 'published').length || 0) +
          (articles.filter((x) => x.status === 'published').length || 0);
        const recent = [
          ...destinations.slice(-5).map((d) => ({ ...d, type: 'destination' })),
          ...articles.slice(-5).map((a) => ({ ...a, type: 'article' })),
        ]
          .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
          .slice(0, 10);

        // Do NOT set totalDestinations/totalUsers here; live counters below own them
        setAnalytics((a) => ({
          ...a,
          totalArticles: articles.length,
          publishedContent: published,
          recentActivity: recent,
        }));

        setDestinations(destinations);
        setUsers(users);
      } catch (e) {
        // fallback to localStorage
        const localDest = JSON.parse(localStorage.getItem('destinations') || '[]');
        const localUsers = JSON.parse(localStorage.getItem('users') || '[]');
        const localArticles = JSON.parse(localStorage.getItem('articles') || '[]');

        setAnalytics((a) => ({
          ...a,
          totalArticles: localArticles.length,
          publishedContent:
            (localDest.filter((d) => d.status === 'published').length || 0) +
            (localArticles.filter((x) => x.status === 'published').length || 0),
          recentActivity: [...localDest.slice(-5), ...localArticles.slice(-5)].slice(0, 10),
        }));

        setDestinations(localDest);
        setUsers(localUsers);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

const openCreate = () => {
    console.log('openCreate called');
    setEditing(null);
    setShowForm(true);
};

const closeForm = () => {
    setShowForm(false);
    setEditing(null);
};

// prevent body scroll when modal is open and close on ESC
useEffect(() => {
    document.body.style.overflow = showForm ? 'hidden' : '';
    const onKey = (e) => {
        if (e.key === 'Escape' && showForm) closeForm();
    };
    window.addEventListener('keydown', onKey);
    return () => {
        window.removeEventListener('keydown', onKey);
        document.body.style.overflow = '';
    };
}, [showForm]);

// NEW: prevent body scroll for Edit User modal and close on ESC
useEffect(() => {
  const prev = document.body.style.overflow;
  if (userEditOpen) document.body.style.overflow = 'hidden';
  const onKey = (e) => {
    if (e.key === 'Escape' && userEditOpen) {
      setUserEditOpen(false);
      setEditingUser(null);
    }
  };
  window.addEventListener('keydown', onKey);
  return () => {
    window.removeEventListener('keydown', onKey);
    document.body.style.overflow = prev || '';
  };
}, [userEditOpen]);

// fallback removed — rely on the React portal (createPortal) to render the modal

const handleSaveDestination = (saved) => {
  // Remove undefined fields before saving
  // Deep clean: remove undefined and empty string recursively
  function deepClean(obj) {
    if (Array.isArray(obj)) {
        return obj.filter((v) => v !== undefined && v !== '');
    } else if (typeof obj === 'object' && obj !== null) {
        return Object.fromEntries(
            Object.entries(obj)
                .filter(([_, v]) => v !== undefined && v !== '')
                .map(([k, v]) => [k, deepClean(v)])
        );
    }
    return obj;
  }
  const clean = deepClean(saved);
  if (editing) {
    const docRef = doc(db, 'destinations', editing.id);
    setDoc(docRef, clean, { merge: true });
    setDestinations((s) => s.map((it) => (it.id === editing.id ? { ...it, ...clean } : it)));
    // NEW: log edit destination
    addActivity({ action: 'updated', subject: 'destination', id: editing.id, name: clean.name || editing.name });
  } else {
    addDoc(collection(db, 'destinations'), clean).then((docRef) => {
      setDestinations((s) => [{ ...clean, id: docRef.id }, ...s]);
      setAnalytics((a) => ({ ...a, totalDestinations: (a.totalDestinations || 0) + 1 }));
      // NEW: log create destination
      addActivity({ action: 'created', subject: 'destination', id: docRef.id, name: clean.name });
    });
    return;
  }
  setShowForm(false);
  setEditing(null);
  setAnalytics((a) => ({ ...a, totalDestinations: a.totalDestinations || 0 }));
};

  // Live total destinations counter for the Dashboard
  useEffect(() => {
    let unsub;
    (async () => {
      try {
        const coll = collection(db, 'destinations');
        const snapCount = await getCountFromServer(coll);
        setAnalytics((a) => ({ ...a, totalDestinations: snapCount.data().count || 0 }));
        unsub = onSnapshot(
          coll,
          (snap) => setAnalytics((a) => ({ ...a, totalDestinations: snap.size })),
          (err) => console.warn('destinations snapshot error:', err)
        );
      } catch (e) {
        console.error('Failed to load destinations count:', e);
      }
    })();
    return () => unsub && unsub();
  }, []);

  // NEW: Live total users counter for the Dashboard
  useEffect(() => {
    let unsub;
    (async () => {
      try {
        const coll = collection(db, 'users');
        const snapCount = await getCountFromServer(coll);
        setAnalytics((a) => ({ ...a, totalUsers: snapCount.data().count || 0 }));
        unsub = onSnapshot(
          coll,
          (snap) => setAnalytics((a) => ({ ...a, totalUsers: snap.size })),
          (err) => console.warn('users snapshot error:', err)
        );
      } catch (e) {
        console.error('Failed to load users count:', e);
      }
    })();
    return () => unsub && unsub();
  }, []);

  // NEW helpers for the user modal
  const openUserProfile = (u) => {
    setUserProfile(u);
    setUserProfileTab('overview');
    setUserProfileOpen(true);
  };
  const closeUserProfile = () => {
    setUserProfileOpen(false);
    setTimeout(() => setUserProfile(null), 200);
  };
  const fmtDate = (d) => {
    if (!d) return '';
    const dt = d?.toDate ? d.toDate() : (typeof d === 'number' ? new Date(d) : new Date(d));
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString();
  };
  const fmtDateTime = (d) => {
    if (!d) return '';
    const dt = d?.toDate ? d.toDate() : (typeof d === 'number' ? new Date(d) : new Date(d));
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleString();
  };

  // lock scroll when profile modal is open
  useEffect(() => {
    if (userProfileOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    const onEsc = (e) => e.key === 'Escape' && userProfileOpen && closeUserProfile();
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [userProfileOpen]);

  // Add this helper to open the Edit User modal with seeded data
  const openEditUserModal = (u, tab = 'basic') => {
    const defaultInterests = ['Adventure', 'Photography', 'Cultural Sites', 'Mountain Hiking', 'Local Cuisine'];
    const defaultPlaces = ['Paris, France', 'Tokyo, Japan', 'Machu Picchu, Peru', 'Santorini, Greece', 'Bali, Indonesia', 'New York, USA'];

    setEditingUser(u);
    setUserEditTab(tab);

    const interests = Array.isArray(u?.interests) && u.interests.length ? [...u.interests] : defaultInterests;
    setEditInterests(interests);
    setInterestInput(''); // reset interests input

    const places = Array.isArray(u?.places) && u.places.length
      ? u.places.map(p => (typeof p === 'string' ? p : (p?.name || p?.title || 'Unknown')))
      : defaultPlaces;
    setEditPlaces(places);

    setEditStatus(String(u?.status || 'active').toLowerCase()); // NEW: seed status
    setPlaceInput('');
    setUserEditOpen(true);
  };

  // Activity persistence helpers (local cache survives restarts)
  const ACTIVITY_LOCAL_KEY = 'activity';
  const saveActivityLocal = (arr) => {
    try {
      localStorage.setItem(ACTIVITY_LOCAL_KEY, JSON.stringify(arr.slice(0, 500)));
    } catch {}
  };
  const appendActivityLocal = (evt) => {
    try {
      const arr = JSON.parse(localStorage.getItem(ACTIVITY_LOCAL_KEY) || '[]');
      arr.unshift(evt);
      saveActivityLocal(arr);
    } catch {}
  };

 // Add a helper to push activity entries (also updates dashboard immediately)
const addActivity = async (evt) => {
  const item = {
    ...evt,                      // { action, subject, id?, name?, count? }
    by: (auth?.currentUser?.email || 'admin'),
    at: new Date().toISOString(),
  };
  // Update UI immediately
  setAnalytics((a) => ({
    ...a,
    recentActivity: [item, ...(a.recentActivity || [])].slice(0, 20),
  }));
  // Always persist to local cache
  appendActivityLocal(item);
  // Try to persist to Firestore (non-blocking)
  try { await addDoc(collection(db, 'activity'), item); } catch {}
};

  // Subscribe to the activity collection to keep Recent Activity live
  useEffect(() => {
    let unsub;
    // Prefill from local cache so activity appears even before Firestore loads
    try {
      const cached = JSON.parse(localStorage.getItem(ACTIVITY_LOCAL_KEY) || '[]');
      if (cached.length) {
        setAnalytics((a) => ({ ...a, recentActivity: cached.slice(0, 20) }));
      }
    } catch {}
    try {
      const coll = collection(db, 'activity');
      unsub = onSnapshot(
        coll,
        (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          rows.sort((a, b) => new Date(b.at) - new Date(a.at));
          setAnalytics((a) => ({ ...a, recentActivity: rows.slice(0, 20) }));
          // Mirror Firestore to local cache so history survives restarts/offline
          saveActivityLocal(rows);
        },
        (err) => console.warn('activity snapshot error:', err)
      );
    } catch (e) {
      try {
        const arr = JSON.parse(localStorage.getItem(ACTIVITY_LOCAL_KEY) || '[]');
        setAnalytics((a) => ({ ...a, recentActivity: arr.slice(0, 20) }));
      } catch {}
    }
    return () => unsub && unsub();
  }, []);

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
        <button className={`sidebar-item ${active === 'articles' ? 'active' : ''}`} onClick={() => setActive('articles')}>
            <span className="icon">📝</span> <span>Articles</span>
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
                <div style={{ fontWeight: 700, color: '#fff' }}>Total Articles</div>
                <div className="stat-value" style={{ color: '#fff' }}>{analytics.totalArticles}</div>
                <div className="muted" style={{ opacity: 0.9 }}>Published content</div>
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
                  analytics.recentActivity.map((it, i) => {
                    // NEW: render activity feed entries
                    if (it.action) {
                      const action = String(it.action).toLowerCase();
                      const subject = (it.subject || 'item').toLowerCase();
                      const icon = subject === 'destination' ? '🏖️' : subject === 'user' ? '👤' : '📝';
                      const badgeMap = {
                        created: { bg: '#dcfce7', color: '#166534' },
                        updated: { bg: '#e0e7ff', color: '#2563eb' },
                        deleted: { bg: '#fee2e2', color: '#b91c1c' },
                        imported: { bg: '#d1fae5', color: '#065f46' },
                      };
                      const badge = badgeMap[action] || { bg: '#e5e7eb', color: '#374151' };
                      const title = `${action.charAt(0).toUpperCase() + action.slice(1)} ${subject}${it.name ? `: ${it.name}` : it.count ? ` (${it.count})` : ''}`;
                      const when = new Date(it.at || Date.now()).toLocaleString();
                      return (
                        <div key={i} className="activity-row">
                          <div className="activity-icon">{icon}</div>
                          <div className="activity-body">
                            <strong>{title}</strong>
                            <div className="muted small">{when} • {it.by || 'system'}</div>
                          </div>
                          <div
                            className="status-badge"
                            style={{ background: badge.bg, color: badge.color, fontWeight: 700 }}
                          >
                            {action.toUpperCase()}
                          </div>
                        </div>
                      );
                    }

                    // Fallback for legacy items
                    return (
                      <div key={i} className="activity-row">
                        <div className="activity-icon">{it.type === 'destination' ? '🏖️' : '📝'}</div>
                        <div className="activity-body">
                          <strong>{it.name || it.title}</strong>
                          <div className="muted small">{it.type} • Updated {new Date(it.updatedAt || it.createdAt || Date.now()).toLocaleDateString()}</div>
                        </div>
                        <div className={`status-badge status-${it.status || 'draft'}`}>{(it.status || 'draft').toUpperCase()}</div>
                      </div>
                    );
                  })
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
                        {/* NEW: Import from CSV button (left of Add New) */}
                        <button
                          className="btn-secondary"
                          onClick={() => csvInputRef.current?.click()}
                          disabled={importingCsv}
                          style={{ padding: '10px 16px', borderRadius: 12, background: '#eef2ff', color: '#1f2937' }}
                          title="Import multiple destinations from a CSV exported from Excel"
                        >
                          {importingCsv ? 'Importing...' : 'Import from CSV (Excel file)'}
                        </button>
                        <input
                          ref={csvInputRef}
                          type="file"
                          accept=".csv"
                          hidden
                          onChange={(e) => handleCsvFile(e.target.files?.[0])}
                        />
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
                        existingNames={destinations.map(d => (d.name || '').trim().toLowerCase())} // pass existing names
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
                                                                // NEW: log delete destination
                                                                addActivity({ action: 'deleted', subject: 'destination', id: d.id, name: d.name });
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
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 2fr 1.2fr 1.2fr 1.8fr 1.4fr 1.6fr', gap: 0, background: '#f6f8fa', color: '#6b7280', fontWeight: 700, fontSize: 14 }}>
                {['User', 'Email', 'Provider', 'Status', 'Travel Stats', 'Join Date', 'Actions'].map((h, i) => (
                  <div key={h} style={{ padding: '14px 16px', borderBottom: '1px solid #eef2f7' }}>{h}</div>
                ))}
              </div>

              {loadingUsers ? (
                <div className="centered" style={{ padding: 40 }}><div className="loading-spinner" /></div>
              ) : (
                (() => {
                  const q = searchUser.trim().toLowerCase();
                  const filtered = users.filter((u) => {
                    const okQ = !q || ((u.travelerName || u.name || '') + ' ' + (u.email || '')).toLowerCase().includes(q);
                    const s = (u.status || 'active').toLowerCase();
                    const okS = userStatusFilter === 'all' || s === userStatusFilter;
                    return okQ && okS;
                  });
                  if (!filtered.length) {
                    return <div className="muted" style={{ padding: 24 }}>No users found</div>;
                  }
                  const rowStyle = { display: 'grid', gridTemplateColumns: '2.4fr 2fr 1.2fr 1.2fr 1.8fr 1.4fr 1.6fr', alignItems: 'center' };
                  return (
                    <div>
                      {filtered.map((u, i) => {
                        const name = u.travelerName || u.name || 'Unnamed';
                        const initial = name.charAt(0).toUpperCase();
                        const provider = u.provider || u.providerId || 'Email';
                        const status = (u.status || 'ACTIVE').toUpperCase();
                        const places = u.placesCount ?? (Array.isArray(u.places) ? u.places.length : 0);
                        const photos = u.photosShared || 0;
                        const reviews = u.reviewsWritten || 0;
                        const createdAt = u.createdAt?.toDate ? u.createdAt.toDate() : (u.createdAt ? new Date(u.createdAt) : null);
                        const joinDate = createdAt ? createdAt.toLocaleDateString() : '';
                        return (
                          <div key={u.id || i} style={{ ...rowStyle, background: i % 2 ? '#fff' : '#fafbfc', borderBottom: '1px solid #eef2f7' }}>
                            {/* User */}
                            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                              {u.profilePictureUrl ? (
                                <img src={u.profilePictureUrl} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{
                                  width: 36, height: 36, borderRadius: '50%', background: '#6366f1',
                                  color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 500, fontSize: 24
                                }}>
                                  {(u.travelerName || u.name || 'U').charAt(0).toUpperCase()
                                  }
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
                              <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 999, padding: '4px 10px', fontWeight: 700, fontSize: 12 }}>{status}</span>
                            </div>
                            {/* Travel Stats */}
                            <div style={{ padding: '14px 16px' }}>
                              <div style={{ fontWeight: 700 }}>{places} places</div>
                              <div className="muted small" style={{ fontWeight: 400 }}>{photos} photos, {reviews} reviews</div>
                            </div>
                            {/* Join Date */}
                            <div style={{ padding: '14px 16px' }}>{joinDate}</div>
                            {/* Actions */}
                            <div style={{ padding: '14px 16px', display: 'flex', gap: 8 }}>
                              <button
                                className="btn-view"
                                style={{
                                      background: '#e0e7ff',
                                      color: '#2563eb',
                                      border: 'none',
                                      padding: '6px 18px',
                                      borderRadius: 8,
                                      fontWeight: 700,
                                      marginRight: 8,
                                      fontSize: 14,
                                      boxShadow: 'none'
                                }}
                                onClick={() => openUserProfile(u)}
                              >
                                View
                              </button>
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
                                    openEditUserModal(u, 'basic');
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
                                    if (!u.id) return;
                                    if (!window.confirm('Delete this user?')) return;
                                    try {
                                        await deleteDoc(doc(db, 'users', u.id));
                                        setUsers((arr) => arr.filter((x) => x.id !== u.id));
                                        // NEW: log delete user
                                        addActivity({ action: 'deleted', subject: 'user', id: u.id, name: u.travelerName || u.name || u.email });
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
                    </div>
                  );
                })()
              )}
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
                    <div style={{ fontSize: 26, fontWeight: 600 }}>User Profile</div>
                    <button onClick={closeUserProfile} style={{
                      background: 'transparent', border: 'none', fontSize: 28, cursor: 'pointer', color: '#222'
                    }}>×</button>
                  </div>
                  {/* Profile Section */}
                  <div style={{
                    background: 'linear-gradient(90deg,#4f46e5,#3b82f6)', padding: '24px 28px',
                    display: 'flex', alignItems: 'center', gap: 22
                  }}>
                    {userProfile.profilePictureUrl ? (
                      <img src={userProfile.profilePictureUrl} alt="" style={{
                        width: 56, height: 56, borderRadius: '50%', objectFit: 'cover',
                        background: '#fff', border: '3px solid rgba(255,255,255,.35)'
                      }} />
                    ) : (
                      <div style={{
                        width: 56, height: 56, borderRadius: '50%', background: '#6366f1',
                        color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 500, fontSize: 24
                      }}>
                        {(userProfile.travelerName || userProfile.name || 'U').charAt(0).toUpperCase()
                        }
                      </div>
                    )}
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
                            {userProfile.travelerBio || userProfile.bio || 'Adventure seeker and photography enthusiast.'}
                          </div>
                          <div style={{ color: '#6b7280', fontSize: 13 }}>Sign Provider:</div>
                          <div style={{ marginBottom: 10, fontWeight: 400 }}>{userProfile.provider || userProfile.providerId || 'Email'}</div>
                          <div style={{ color: '#6b7280', fontSize: 13 }}>Last Login:</div>
                          <div style={{ fontWeight: 400 }}>{fmtDateTime(userProfile.lastLogin)}</div>
                        </div>

                        {/* Travel Stats card */}
                        <div style={{
                          background: '#fff', borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,.04)', padding: 18
                        }}>
                          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 16 }}>Travel Stats</div>
                          <div style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 14, columnGap: 12
                          }}>
                            <div>
                              <div style={{ color: '#2563eb', fontWeight: 500, fontSize: 22 }}>
                                {userProfile.placesCount ?? (Array.isArray(userProfile.places) ? userProfile.places.length : 0)}
                              </div>
                              <div className="muted small" style={{ fontWeight: 400 }}>Places Visited</div>
                            </div>
                            <div>
                              <div style={{ color: '#22c55e', fontWeight: 500, fontSize: 22 }}>
                                {userProfile.photosShared || 0}
                              </div>
                              <div className="muted small" style={{ fontWeight: 400 }}>Photos Shared</div>
                            </div>
                            <div>
                              <div style={{ color: '#6366f1', fontWeight: 500, fontSize: 22 }}>
                                {userProfile.reviewsWritten || 0}
                              </div>
                              <div className="muted small" style={{ fontWeight: 400 }}>Reviews Written</div>
                            </div>
                            <div>
                              <div style={{ color: '#f97316', fontWeight: 500, fontSize: 22 }}>
                                {userProfile.friendsCount ?? (Array.isArray(userProfile.friends) ? userProfile.friends.length : 0)}
                              </div>
                              <div className="muted small" style={{ fontWeight: 400 }}>Friends</div>
                            </div>
                          </div>
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
                            {(userProfile.interests && userProfile.interests.length ? userProfile.interests : ['Adventure', 'Photography', 'Cultural Sites', 'Mountain Hiking', 'Local Cuisine']).map((t, idx) => (
                              <span key={idx} style={{
                                background: '#e0e7ff',
                                color: '#2563eb',
                                borderRadius: 999,
                                padding: '7px 16px',
                                fontWeight: 500,
                                fontSize: 14
                              }}>{t}</span>
                            ))}
                          </div>
                        </div>

                        {/* Places Visited */}
                        <div style={{
                          background: '#fff', borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,.04)', padding: 18
                        }}>
                          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 16 }}>Places Visited</div>
                          <ul style={{
                            listStyle: 'none', padding: 0, margin: 0, display: 'grid', rowGap: 10
                          }}>
                            {((Array.isArray(userProfile.places) && userProfile.places.length ? userProfile.places : [
                              'Paris, France', 'Tokyo, Japan', 'Machu Picchu, Peru', 'Santorini, Greece', 'Bali, Indonesia', 'New York, USA'
                            ])).slice(0, 8).map((p, idx) => (
                              <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ color: '#ec4899', fontSize: 18 }}>📍</span>
                                <span style={{ fontSize: 15, fontWeight: 400 }}>{typeof p === 'string' ? p : (p.name || p.title || 'Unknown')}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {userProfileTab !== 'overview' && (
                    <div style={{ padding: 40, background: '#f8fafc', color: '#6b7280', textAlign: 'center', fontSize: 17 }}>
                      <em>“{userProfileTab.charAt(0).toUpperCase() + userProfileTab.slice(1)}” view is coming soon.</em>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Edit User Modal */}
            {userEditOpen && editingUser && (
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
                onClick={(e) => { if (e.target === e.currentTarget) { setUserEditOpen(false); setEditingUser(null); } }}
              >
                <div
                  style={{
                    width: 'min(980px, 98vw)',
                    background: '#fff',
                    borderRadius: 16,
                    boxShadow: '0 20px 60px rgba(0,0,0,.25)',
                    padding: 0,
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {/* Modal header with title */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 24px',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 600, color: '#111827' }}>Edit User</div>
                    <button
                      onClick={() => { setUserEditOpen(false); setEditingUser(null); }}
                      style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: '#111' }}
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>

                  {/* Tabs header (clickable) */}
                  <div style={{
                    display: 'flex',
                    gap: 24,
                    borderBottom: '1px solid #e5e7eb',
                    background: '#fff',
                    padding: '10px 24px 0 24px',
                    position: 'sticky',
                    top: 0,
                    zIndex: 2
                  }}>
                    {['basic', 'profile', 'travel', 'settings'].map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setUserEditTab(tab)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '12px 0 10px 0',
                          color: userEditTab === tab ? '#2563eb' : '#6b7280',
                          fontWeight: 500,
                          fontSize: 15,
                          borderBottom: userEditTab === tab ? '3px solid #2563eb' : '3px solid transparent'
                        }}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>

                  <form
                    style={{
                      padding: '24px',
                      background: '#fff',
                      borderRadius: 16,
                      fontSize: 15,
                      color: '#222',
                      flex: 1
                    }}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      // NEW: log edit user (UI-only edit for now)
                      addActivity({ action: 'updated', subject: 'user', id: editingUser.id, name: editingUser.travelerName || editingUser.name || editingUser.email });
                      setUserEditOpen(false);
                      setEditingUser(null);
                    }}
                  >
                    {/* BASIC tab (existing content) */}
                    {userEditTab === 'basic' && (
                      <>
                        {/* Personal Information */}
                        <div style={{ marginBottom: 24 }}>
                          <div style={{ fontSize: 17, marginBottom: 18 }}>Personal Information</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                            <div>
                              <label style={{ color: '#374151', fontSize: 13 }}>Email Address *</label>
                              <input className="form-input" type="email" value={editingUser.email || ''} disabled style={{ background: '#f3f4f6' }} />
                            </div>
                            <div>
                              <label style={{ color: '#374151', fontSize: 13 }}>Password</label>
                              <input className="form-input" type="password" value="**********" disabled style={{ background: '#f3f4f6' }} />
                            </div>
                            <div>
                              <label style={{ color: '#374151', fontSize:  13 }}>Sign-in Provider</label>
                              <input className="form-input" value={editingUser.provider || editingUser.providerId || 'Email'} disabled style={{ background: '#f3f4f6' }} />
                            </div>
                            <div>
                              <label style={{ color: '#374151', fontSize: 13 }}>Traveler Name *</label>
                              <input className="form-input" value={editingUser.travelerName || editingUser.name || ''} disabled style={{ background: '#f3f4f6' }} />
                            </div>
                          </div>
                        </div>

                        {/* Travel Statistics */}
                        <div style={{ marginBottom: 24 }}>
                          <div style={{ fontSize: 17, marginBottom: 18 }}>Travel Statistics</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
                            <div>
                              <label style={{ color: '#374151', fontSize: 13 }}>Places Visited</label>
                              <input className="form-input" value={editingUser.placesCount ?? (Array.isArray(editingUser.places) ? editingUser.places.length : 0)} disabled style={{ background: '#fff' }} />
                            </div>
                            <div>
                              <label style={{ color: '#374151', fontSize: 13 }}>Photos Shared</label>
                              <input className="form-input" value={editingUser.photosShared || 0} disabled style={{ background: '#fff' }} />
                            </div>
                            <div>
                              <label style={{ color: '#374151', fontSize: 13 }}>Reviews Written</label>
                              <input className="form-input" value={editingUser.reviewsWritten || 0} disabled style={{ background: '#fff' }} />
                            </div>
                            <div>
                              <label style={{ color: '#374151', fontSize: 13 }}>Total Friends</label>
                              <input className="form-input" value={editingUser.friendsCount ?? (Array.isArray(editingUser.friends) ? editingUser.friends.length : 0)} disabled style={{ background: '#fff' }} />
                            </div>
                          </div>
                        </div>

                        {/* Travel Interests (chips) */}
                        <div style={{ marginBottom: 24 }}>
                          <div style={{ fontSize: 17, marginBottom: 12 }}>Travel Interests</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {(editingUser.interests && editingUser.interests.length ? editingUser.interests : ['Adventure', 'Photography', 'Cultural Sites', 'Mountain Hiking', 'Local Cuisine']).map((t, idx) => (
                              <span key={idx} style={{
                                background: '#2563eb',
                                color: '#fff',
                                borderRadius: 999,
                                padding: '7px 16px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                fontWeight: 600,
                                fontSize: 14
                              }}>
                                {t}
                                <button
                                  type="button"
                                  onClick={() => setEditInterests(editInterests.filter((_, i) => i !== idx))}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#ffffff',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    lineHeight: 1
                                  }}
                                  aria-label={`Remove ${t}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                            <input
                              value={interestInput}
                              onChange={(e) => setInterestInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ',') {
                                  e.preventDefault();
                                  const v = interestInput.trim();
                                  if (v && !editInterests.includes(v)) setEditInterests([...editInterests, v]);
                                  setInterestInput('');
                                } else if (e.key === 'Backspace' && !interestInput && editInterests.length) {
                                  // remove last chip when input is empty
                                  setEditInterests(editInterests.slice(0, -1));
                                }
                              }}
                              onBlur={() => {
                                const v = interestInput.trim();
                                if (v && !editInterests.includes(v)) setEditInterests([...editInterests, v]);
                                setInterestInput('');
                              }}
                              placeholder="Add travel interests (Adventure, Food, Culture, etc.)"
                              style={{
                                border: 'none',
                                outline: 'none',
                                flex: 1,
                                minWidth: 220,
                                fontSize: 14,
                                color: '#111827',
                                padding: '6px 4px',
                                background: 'transparent'
                              }}
                            />
                          </div>
                        </div>

                        {/* Achievements (moved from Travel to match screenshot) */}
                        <div style={{ marginBottom: 24 }}>
                          <div style={{ fontSize: 17, marginBottom: 18 }}>Achievements</div>
                          <div style={{
                            display: 'grid', gridTemplateColumns: '40px 1.2fr 1.2fr 1fr 110px', gap: 12, alignItems: 'center', background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                              <span style={{ fontSize: 20, color: '#06b6d4', textAlign: 'center' }}>🌐</span>
                              <input className="form-input" value="Globe Trotter" disabled style={{ background: '#fff' }} />
                              <input className="form-input" value="Visited 10+ countries" disabled style={{ background: '#fff' }} />
                              <input className="form-input" value="15/08/2023" disabled style={{ background: '#fff' }} />
                              <button type="button" className="btn-danger" style={{ padding: '8px 16px', borderRadius: 8 }}>Remove</button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '40px 1.2fr 1.2fr 1fr 110px', gap: 12, alignItems: 'center', background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                              <span style={{ fontSize: 20, color: '#6366f1', textAlign: 'center' }}>🖼️</span>
                              <input className="form-input" value="Photo Master" disabled style={{ background: '#fff' }} />
                              <input className="form-input" value="Shared 200+ photos" disabled style={{ background: '#fff' }} />
                              <input className="form-input" value="20/09/2023" disabled style={{ background: '#fff' }} />
                              <button type="button" className="btn-danger" style={{ padding: '8px 16px', borderRadius: 8 }}>Remove</button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '40px 1.2fr 1.2fr 1fr 110px', gap: 12, alignItems: 'center', background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                              <span style={{ fontSize: 20, color: '#f59e42', textAlign: 'center' }}>⭐</span>
                              <input className="form-input" value="Review Expert" disabled style={{ background: '#fff' }} />
                              <input className="form-input" value="Written 25+ reviews" disabled style={{ background: '#fff' }} />
                              <input className="form-input" value="05/10/2023" disabled style={{ background: '#fff' }} />
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

                        {/* Recent Activity (moved from Travel to match screenshot) */}
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

                        <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 0 }} />
                      </>
                    )}

                    {/* PROFILE tab (matches screenshot) */}
                    {userEditTab === 'profile' && (
                      <>
                        {/* top divider like in the screenshot */}
                        <div style={{ borderTop: '1px solid #e5e7eb', margin: '0 -24px 24px -24px' }} />

                        <div style={{ marginBottom: 18 }}>
                          <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>
                            Profile Picture
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            {editingUser.profilePictureUrl ? (
                              <img
                                src={editingUser.profilePictureUrl}
                                alt=""
                                style={{
                                  width: 56, height: 56, borderRadius: '50%',
                                  objectFit: 'cover', boxShadow: '0 2px 10px rgba(0,0,0,.08)'
                                }}
                              />
                            ) : (
                              <div style={{
                                width: 56, height: 56, borderRadius: '50%',
                                background: '#4f46e5', color: '#fff',
                                display: 'grid', placeItems: 'center',
                                fontWeight: 600, fontSize: 22,
                                boxShadow: '0 2px 10px rgba(0,0,0,.08)'
                              }}>
                                {(editingUser.travelerName || editingUser.name || editingUser.email || 'U')
                                  .trim().charAt(0).toUpperCase()}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => document.getElementById('editUserUploadInput')?.click()}
                              style={{
                                background: '#10b981',
                                color: '#fff',
                                border: 'none',
                                padding: '10px 16px',
                                borderRadius: 8,
                                fontWeight: 700,
                                boxShadow: '0 2px 8px rgba(16,185,129,.25)',
                                cursor: 'pointer'
                              }}
                            >
                              Upload Photo
                            </button>
                            <input
                              id="editUserUploadInput"
                              type="file"
                              accept="image/*"
                              hidden
                              onChange={() => alert('Upload Photo coming soon')}
                            />
                          </div>
                        </div>

                        <div style={{ marginTop: 18 }}>
                          <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>
                            Traveler Bio
                          </div>
                          <textarea
                            className="form-input"
                            style={{ minHeight: 130 }}
                            defaultValue={
                              editingUser.travelerBio ||
                              editingUser.bio ||
                              'Adventure seeker and photography enthusiast. Love exploring hidden gems around the world and sharing travel tips with fellow wanderers.'
                            }
                          />
                        </div>

                        <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 24 }} />
                      </>
                    )}

                    {/* TRAVEL tab (matches screenshot) */}
                    {userEditTab === 'travel' && (
                      <>
                        <div style={{ borderTop: '1px solid #e5e7eb', margin: '0 -24px 24px -24px' }} />

                        {/* Travel Interests */}
                        <div style={{ marginBottom: 18 }}>
                          <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>Travel Interests</div>
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 8,
                              alignItems: 'center',
                              background: '#fff',
                              border: '1px solid #e5e7eb',
                              borderRadius: 8,
                              padding: '8px 10px',
                              minHeight: 42
                            }}
                          >
                            {editInterests.map((t, idx) => (
                              <span key={idx} style={{
                                background: '#2563eb',
                                color: '#fff',
                                borderRadius: 999,
                                padding: '7px 12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                fontWeight: 600,
                                fontSize: 14
                              }}>
                                {t}
                                <button
                                  type="button"
                                  onClick={() => setEditInterests(editInterests.filter((_, i) => i !== idx))}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#ffffff',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    lineHeight: 1
                                  }}
                                  aria-label={`Remove ${t}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                            <input
                              value={interestInput}
                              onChange={(e) => setInterestInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ',') {
                                  e.preventDefault();
                                  const v = interestInput.trim();
                                  if (v && !editInterests.includes(v)) setEditInterests([...editInterests, v]);
                                  setInterestInput('');
                                } else if (e.key === 'Backspace' && !interestInput && editInterests.length) {
                                  // remove last chip when input is empty
                                  setEditInterests(editInterests.slice(0, -1));
                                }
                              }}
                              onBlur={() => {
                                const v = interestInput.trim();
                                if (v && !editInterests.includes(v)) setEditInterests([...editInterests, v]);
                                setInterestInput('');
                              }}
                              placeholder="Add travel interests (Adventure, Food, Culture, etc.)"
                              style={{
                                border: 'none',
                                outline: 'none',
                                flex: 1,
                                minWidth: 220,
                                fontSize: 14,
                                color: '#111827',
                                padding: '6px 4px',
                                background: 'transparent'
                              }}
                            />
                          </div>
                        </div>

                        {/* Places Visited */}
                        <div style={{ marginBottom: 18 }}>
                          <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>Places Visited</div>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <input
                              className="form-input"
                              placeholder="Add a place you've visited"
                              value={placeInput}
                              onChange={(e) => setPlaceInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const v = placeInput.trim();
                                  if (v && !editPlaces.includes(v)) setEditPlaces([...editPlaces, v]);
                                  setPlaceInput('');
                                }
                              }}
                              style={{ flex: 1 }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const v = placeInput.trim();
                                if (v && !editPlaces.includes(v)) setEditPlaces([...editPlaces, v]);
                                setPlaceInput('');
                              }}
                              style={{
                                background: 'linear-gradient(90deg,#10b981,#059669)',
                                color: '#fff',
                                border: 'none',
                                padding: '10px 18px',
                                borderRadius: 8,
                                fontWeight: 700,
                                boxShadow: '0 2px 8px rgba(16,185,129,.25)',
                                cursor: 'pointer'
                              }}
                            >
                              Add
                            </button>
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                            {editPlaces.map((p, idx) => (
                              <span key={idx} style={{
                                background: '#2563eb',
                                color: '#fff',
                                borderRadius: 999,
                                padding: '7px 12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                fontWeight: 600,
                                fontSize: 14
                              }}>
                                {p}
                                <button
                                  type="button"
                                  onClick={() => setEditPlaces(editPlaces.filter((_, i) => i !== idx))}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#ffffff',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    lineHeight: 1
                                  }}
                                  aria-label={`Remove ${p}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid #e5e7eb', margin: '0 -24px 0 -24px' }} />
                      </>
                    )}

                    {/* SETTINGS tab (matches screenshot) */}
                    {userEditTab === 'settings' && (
                      <>
                        <div style={{ borderTop: '1px solid #e5e7eb', margin: '0 -24px 24px -24px' }} />

                        <div style={{ marginBottom: 18 }}>
                          <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>Account Status</div>
                          <select
                            className="form-input"
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                          >
                            <option value="active">Active</option>
                            <option value="disabled">Disabled</option>
                            <option value="banned">Banned</option>
                          </select>
                        </div>

                        <div style={{ borderTop: '1px solid #e5e7eb', margin: '0 -24px 0 -24px' }} />
                      </>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 18 }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => { setUserEditOpen(false); setEditingUser(null); }}
                        style={{ padding: '10px 18px', borderRadius: 8 }}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn-primary" style={{ padding: '10px 18px', borderRadius: 8 }}>
                        Update User
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
        </div>
        )}
      </main>
    </div>
)}
export default ContentManagement;