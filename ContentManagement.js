import React, { useEffect, useState, useRef } from 'react';
import './Styles/contentManager.css';
import { db, auth, storage } from './firebase';
import { collection, getDocs, doc, setDoc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
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
const DestinationForm = ({ initial = null, onCancel, onSave }) => {
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
            <input required value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} className="form-input" />
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
        <button type="submit" className="btn-primary" style={{ padding: '10px 18px', borderRadius: 8 }}>
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

  // USERS state + fetch (added)
const [users, setUsers] = useState([]);
const [searchUser, setSearchUser] = useState('');
const [loadingUsers, setLoadingUsers] = useState(false);

  // Settings state (persisted to localStorage)
const [cmsSettings, setCmsSettings] = useState(() => {
    const s = localStorage.getItem('cms-settings');
    return s
    ? JSON.parse(s)
    : {
        siteName: 'TravelCMS Pro',
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

  // Modal state (was missing -> caused no-undef ESLint errors)
const [showForm, setShowForm] = useState(false);
const [editing, setEditing] = useState(null);

useEffect(() => {
    (async () => {
        try {
            // Use Firestore from firebase.js
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
            setAnalytics({
                totalDestinations: destinations.length,
                totalUsers: users.length,
                totalArticles: articles.length,
                publishedContent: published,
                recentActivity: recent,
            });
            setDestinations(destinations);
        } catch (e) {
            // fallback to localStorage
            const localDest = JSON.parse(localStorage.getItem('destinations') || '[]');
            const localUsers = JSON.parse(localStorage.getItem('users') || '[]');
            const localArticles = JSON.parse(localStorage.getItem('articles') || '[]');
            setAnalytics({
                totalDestinations: localDest.length,
                totalUsers: localUsers.length,
                totalArticles: localArticles.length,
                publishedContent:
                    (localDest.filter((d) => d.status === 'published').length || 0) +
                    (localArticles.filter((a) => a.status === 'published').length || 0),
                recentActivity: [...localDest.slice(-5), ...localArticles.slice(-5)].slice(0, 10),
            });
            setDestinations(localDest);
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
    } else {
        addDoc(collection(db, 'destinations'), clean).then((docRef) => {
            setDestinations((s) => [{ ...clean, id: docRef.id }, ...s]);
        });
    }
    setShowForm(false);
    setEditing(null);
    setAnalytics((a) => ({ ...a, totalDestinations: (a.totalDestinations || 0) + (editing ? 0 : 1) }));
};

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

return (
    <div className="cms-root">
    <aside className="sidebar">
        <div className="brand">
        <h2>TravelCMS</h2>
        <div className="muted">Professional</div>
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
        <div className="muted small">demo@travelcms.com</div>
        <button className="btn-danger" style={{ marginTop: 8 }}>Sign Out</button>
        </div>
    </aside>

    <main className="main-content">
        <div className="page-wrap">
        {active === 'dashboard' && (
            <div className="dashboard">
            <header style={{ marginBottom: 18 }}>
                <h1 style={{ margin: 0 }}>Dashboard</h1>
                <p className="muted">Welcome to TravelCMS Pro - Your content management overview</p>
            </header>

            <div className="stats-grid" style={{ marginBottom: 20 }}>
                <div className="stat-card content-card gradient-1" style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, color: '#fff' }}>Total Destinations</div>
                <div className="stat-value" style={{ color: '#fff' }}>{analytics.totalDestinations}</div>
                <div className="muted" style={{ opacity: 0.9 }}>Active travel destinations</div>
                </div>

                <div className="stat-card content-card gradient-2" style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, color: '#fff' }}>Total Users</div>
                <div className="stat-value" style={{ color: '#fff' }}>{analytics.totalUsers}</div>
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
                        <button className="btn-primary" onClick={openCreate} style={{ padding: '10px 16px', borderRadius: 12 }}>
                            + Add New destination
                        </button>
                    </div>
                </div>

                {/* Inline DestinationForm (not modal) */}
                {showForm && (
                    <div className="content-card" style={{ marginBottom: 24, padding: 32, borderRadius: 12 }}>
                        <DestinationForm
                            initial={editing}
                            onCancel={closeForm}
                            onSave={(saved) => {
                                handleSaveDestination(saved);
                                setShowForm(false);
                            }}
                        />
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
                            <button className="btn-primary" onClick={openCreate} style={{ padding: '10px 20px', borderRadius: 12 }}>
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
                                                    className="btn-primary"
                                                    style={{
                                                        background: 'linear-gradient(90deg,#2563eb,#2563eb 80%)',
                                                        color: '#fff',
                                                        border: 'none',
                                                        padding: '6px 18px',
                                                        borderRadius: 8,
                                                        fontWeight: 600,
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
                                                        background: 'linear-gradient(90deg,#ef4444,#ef4444 80%)',
                                                        color: '#fff',
                                                        border: 'none',
                                                        padding: '6px 18px',
                                                        borderRadius: 8,
                                                        fontWeight: 600,
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
            <div className="section-header" style={{ alignItems: 'flex-start' }}>
                <div>
                <h2 className="title">User Management</h2>
                <p className="muted">Manage registered users and their profiles</p>
                </div>
                <div />
            </div>

            <div className="filters content-card" style={{ display: 'flex', gap: 12, padding: 16, alignItems: 'center', marginBottom: 18 }}>
                <div className="search-bar" style={{ position: 'relative', flex: 1 }}>
                <span className="search-icon">🔍</span>
                <input
                    className="form-input"
                    style={{ width: '100%', paddingLeft: 48 }}
                    placeholder="Search users..."
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                />
                </div>

                <button
                className="btn-secondary"
                onClick={async () => {
                    setLoadingUsers(true);
                    try {
                    if (window.firebase && window.firebase.firestore) {
                        const db = window.firebase.firestore();
                        const snap = await db.collection('users').get();
                        setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
                    } else {
                        setUsers(JSON.parse(localStorage.getItem('users') || '[]'));
                    }
                    } catch {
                    setUsers([]);
                    } finally {
                    setLoadingUsers(false);
                    }
                }}
                style={{ background: 'linear-gradient(90deg,#10b981,#059669)', color: '#fff', borderRadius: 10, padding: '10px 18px' }}
                >
                🔄 Refresh
                </button>
            </div>

            <div className="content-card" style={{ padding: 24, borderRadius: 12, minHeight: 280 }}>
                {loadingUsers ? (
                <div className="centered"><div className="loading-spinner" /></div>
                ) : (
                (() => {
                    const q = searchUser.trim().toLowerCase();
                    const filtered = users.filter((u) => {
                    if (!q) return true;
                    return ((u.travelerName || u.name || '') + ' ' + (u.email || '')).toLowerCase().includes(q);
                    });
                    if (!filtered.length) {
                    return (
                        <div className="centered" style={{ flexDirection: 'column' }}>
                        <div className="muted" style={{ marginBottom: 18 }}>No users found</div>
                        </div>
                    );
                    }
                    return (
                    <div className="grid users-grid">
                        {filtered.map((u) => (
                        <div key={u.id} className="user-card">
                            <div className="user-header">
                            {u.profilePictureUrl ? (
                                <img src={u.profilePictureUrl} alt="" className="avatar" />
                            ) : (
                                <div className="avatar-placeholder">{(u.travelerName || u.name || 'U').charAt(0)}</div>
                            )}
                            <div>
                                <strong>{u.travelerName || u.name || 'Unnamed'}</strong>
                                <div className="muted small">{u.email}</div>
                            </div>
                            </div>
                            <p className="muted small" style={{ minHeight: 36 }}>{u.travelerBio || u.bio || ''}</p>
                            <div className="user-stats">
                            <div>Photos: {u.photosShared || 0}</div>
                            <div>Reviews: {u.reviewsWritten || 0}</div>
                            <div>Status: <span className={`status-badge status-${u.status || 'active'}`}>{u.status || 'active'}</span></div>
                            </div>
                        </div>
                        ))}
                    </div>
                    );
                })()
                )}
            </div>
            </div>
        )}
        {active === 'settings' && (
        <div className="content-section">
            <div className="section-header" style={{ alignItems: 'flex-start' }}>
                <div>
                <h2 className="title">Settings</h2>
                <p className="muted">Configure your CMS settings and preferences</p>
                </div>
            </div>

            <div className="grid two-col" style={{ gap: 16 }}>
                <div className="content-card p-4">
                <h3 style={{ marginTop: 0 }}>General Settings</h3>
                <label>Site Name</label>
                <input className="form-input" value={cmsSettings.siteName} onChange={(e) => setCmsSettings({ ...cmsSettings, siteName: e.target.value })} />
                <label>Site Description</label>
                <textarea className="form-input" value={cmsSettings.siteDescription} onChange={(e) => setCmsSettings({ ...cmsSettings, siteDescription: e.target.value })} />
                <label>Contact Email</label>
                <input className="form-input" value={cmsSettings.contactEmail} onChange={(e) => setCmsSettings({ ...cmsSettings, contactEmail: e.target.value })} />
                </div>

                <div className="content-card p-4">
                <h3 style={{ marginTop: 0 }}>SEO Settings</h3>
                <label>Default Meta Title</label>
                <input className="form-input" value={cmsSettings.seo.defaultMetaTitle} onChange={(e) => setCmsSettings({ ...cmsSettings, seo: { ...cmsSettings.seo, defaultMetaTitle: e.target.value } })} />
                <label>Default Meta Description</label>
                <textarea className="form-input" value={cmsSettings.seo.defaultMetaDescription} onChange={(e) => setCmsSettings({ ...cmsSettings, seo: { ...cmsSettings.seo, defaultMetaDescription: e.target.value } })} />
                <label>Google Analytics ID</label>
                <input className="form-input" placeholder="GA-XXXXXXXXX-X" value={cmsSettings.seo.googleAnalytics} onChange={(e) => setCmsSettings({ ...cmsSettings, seo: { ...cmsSettings.seo, googleAnalytics: e.target.value } })} />
                </div>

                <div className="content-card p-4">
                <h3 style={{ marginTop: 0 }}>Social Media</h3>
                <label>Facebook URL</label>
                <input className="form-input" value={cmsSettings.socialMedia.facebook} onChange={(e) => setCmsSettings({ ...cmsSettings, socialMedia: { ...cmsSettings.socialMedia, facebook: e.target.value } })} />
                <label>Twitter URL</label>
                <input className="form-input" value={cmsSettings.socialMedia.twitter} onChange={(e) => setCmsSettings({ ...cmsSettings, socialMedia: { ...cmsSettings.socialMedia, twitter: e.target.value } })} />
                <label>Instagram URL</label>
                <input className="form-input" value={cmsSettings.socialMedia.instagram} onChange={(e) => setCmsSettings({ ...cmsSettings, socialMedia: { ...cmsSettings.socialMedia, instagram: e.target.value } })} />
                </div>

                <div className="content-card p-4">
                <h3 style={{ marginTop: 0 }}>Notifications</h3>
                <label style={{ display: 'block', marginBottom: 10 }}>
                    <input type="checkbox" checked={!!cmsSettings.notifications.emailNotifications} onChange={(e) => setCmsSettings({ ...cmsSettings, notifications: { ...cmsSettings.notifications, emailNotifications: e.target.checked } })} /> Email Notifications
                </label>
                <label style={{ display: 'block', marginBottom: 10 }}>
                    <input type="checkbox" checked={!!cmsSettings.notifications.pushNotifications} onChange={(e) => setCmsSettings({ ...cmsSettings, notifications: { ...cmsSettings.notifications, pushNotifications: e.target.checked } })} /> Push Notifications
                </label>
                </div>
            </div>

            <div className="flex-end" style={{ marginTop: 18 }}>
                <button className="btn-primary" onClick={saveSettings} style={{ padding: '10px 18px', borderRadius: 8 }}>💾 Save Settings</button>
            </div>
            {active === 'settings' && (
                <div className="content-card p-4">
                    <h3 style={{ marginTop: 0 }}>Settings</h3>
                    <label>Site Name</label>
                    <input className="form-input" value={cmsSettings.siteName} onChange={(e) => setCmsSettings({ ...cmsSettings, siteName: e.target.value })} />
                    <label>Site Description</label>
                    <textarea className="form-input" value={cmsSettings.siteDescription} onChange={(e) => setCmsSettings({ ...cmsSettings, siteDescription: e.target.value })} />
                    <label>Contact Email</label>
                    <input className="form-input" value={cmsSettings.contactEmail} onChange={(e) => setCmsSettings({ ...cmsSettings, contactEmail: e.target.value })} />
                </div>
            )}
        </div>
        )};
    </main>
    </div>
    );   
}

export default ContentManagement;