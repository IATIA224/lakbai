import React, { useEffect, useMemo, useRef, useState } from 'react';
import './Styles/contentManager.css';
import { CloudinaryContext, Image } from './cloudinary';

// Cloudinary config (same defaults used elsewhere)
const CLOUDINARY_UPLOAD_PRESET = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || 'lakbai_preset';
const CLOUDINARY_CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'dxvewejox';

// Helper to get Cloudinary publicId from URL
function getCloudinaryPublicId(url) {
  if (!url || typeof url !== 'string') return null;
  const parts = url.split('/upload/');
  if (parts.length < 2) return null;
  let publicId = parts[1].split('?')[0];
  publicId = publicId.replace(/\.[^/.]+$/, ''); // remove extension
  return publicId;
}

// Simple TagInput
const TagInput = ({ tags = [], onChange, placeholder }) => {
  const [val, setVal] = useState('');
  const add = (t) => {
    const v = (t || '').trim();
    if (!v) return;
    if (!tags.includes(v)) onChange([...(tags || []), v]);
    setVal('');
  };
  return (
    <div className="tag-input">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {(tags || []).map((t) => (
          <span key={t} className="tag-item">
            {t}
            <button
              type="button"
              className="tag-remove"
              onClick={() => onChange((tags || []).filter((x) => x !== t))}
            >
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

// Simple RichTextEditor
const RichTextEditor = ({ value, onChange, placeholder }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && (value || '') !== ref.current.innerHTML) {
      ref.current.innerHTML = value || '';
    }
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

// ADD: packing suggestion templates
const PACKING_TEMPLATES = (() => {
  const toLines = (arr) => arr.map(i => `• ${i}`).join('\n');

  return {
    beach: toLines([
      'Swimwear (multiple sets)',
      'Rash guard / quick-dry shirt',
      'Flip-flops or aqua shoes',
      'Beach towel or sarong',
      'Snorkeling gear (optional if not renting)',
      'Waterproof dry bag (phone, wallet, camera)',
      'Reef-safe sunscreen & after-sun (aloe vera)',
      'Sunglasses & hat/cap',
      'Portable hammock or mat',
      'Light cover-up / beach dress / shorts'
    ]),
    caves: toLines([
      'Headlamp / reliable flashlight (extra batteries)',
      'Helmet (if required / available)',
      'Sturdy non-slip footwear',
      'Gloves for grip (optional)',
      'Quick-dry clothes (avoid cotton)',
      'Small waterproof pouch (valuables)',
      'Insect repellent',
      'Drinking water & light snacks'
    ]),
    cultural: toLines([
      'Modest clothing (long pants/skirt, sleeves)',
      'Light scarf / shawl',
      'Comfortable walking sandals / shoes',
      'Reusable shopping bag',
      'Notebook / pen',
      'Small tokens / gifts (optional)',
      'Camera / phone (extra storage)',
      'Offline translation app'
    ]),
    historical: toLines([
      'Lightweight modest clothing',
      'Comfortable walking shoes',
      'Sun protection (cap / umbrella / sunscreen)',
      'Camera / phone (wide-angle if possible)',
      'Guidebook / printed notes',
      'Reusable water bottle'
    ]),
    islands: toLines([
      'Dry bag (boat rides splashy)',
      'Waterproof phone case',
      'Swimwear & rash guard',
      'Snorkeling gear (or rent on site)',
      'Powerbank',
      'Insect repellent (sandflies / mosquitoes)',
      'Cash (small bills, fees/vendors)',
      'Refillable water bottle'
    ]),
    landmarks: toLines([
      'Comfortable casual wear',
      'Walking shoes / sandals',
      'Hat / cap',
      'Camera / phone',
      'Small umbrella (sudden rain)',
      'Notebook / pen'
    ]),
    mountains: toLines([
      'Trekking shoes / trail sandals',
      'Trekking pole (optional)',
      'Quick-dry clothes + extra layer',
      'Cap / hat & sunglasses',
      'Headlamp (sunrise hikes)',
      'Small backpack (10–20L)',
      'Snacks (trail mix, energy bars)',
      'Drinking water (bottles / bladder)',
      'Raincoat / poncho',
      'First aid kit + blister patches'
    ]),
    museums: toLines([
      'Smart casual clothing',
      'Lightweight jacket (strong AC)',
      'Notebook / sketchpad + pen',
      'Smartphone / camera (if allowed)',
      'ID card (entry requirement sometimes)',
      'Reusable water bottle (may stay outside)'
    ]),
    parks: toLines([
      'Sturdy shoes (trek/hike trails)',
      'Hat, sunglasses, sunscreen',
      'Insect repellent',
      'Light raincoat / poncho',
      'Binoculars (birdwatching)',
      'Refillable water bottle & snacks',
      'Camera with zoom lens',
      'Picnic mat',
      'Trash bags (Leave No Trace)'
    ]),
    tourist: toLines([
      'Casual breathable clothing',
      'Comfortable walking shoes',
      'Small backpack / daypack',
      'Sunglasses, hat, sunscreen',
      'Reusable water bottle',
      'Portable fan / handkerchief',
      'Powerbank & cables',
      'Local SIM / pocket WiFi',
      'Copies of ID & travel documents',
      'Cash (small bills) + ATM/credit card'
    ])
  };
})();

// Utility to map a selected category to a template key
function packingKey(cat = '') {
  const c = cat.trim().toLowerCase();
  if (!c) return 'tourist';
  if (c.includes('beach')) return 'beach';
  if (c.includes('cave')) return 'caves';
  if (c.includes('cultur')) return 'cultural';
  if (c.includes('histor') || c.includes('heritage')) return 'historical';
  if (c.includes('island')) return 'islands';
  if (c.includes('landmark')) return 'landmarks';
  if (c.includes('mountain')) return 'mountains';
  if (c.includes('museum')) return 'museums';
  if (c.includes('park') || c.includes('natural') || c.includes('waterfall') || c.includes('lake')) return 'parks';
  if (c.includes('tour')) return 'tourist';
  return 'tourist';
}

const DestinationForm = ({ initial = null, onCancel, onSave, existingNames = [], ignoreId = null }) => {
  const [data, setData] = useState(() => {
    const base = {
      name: '',
      category: '',
      description: '',
      content: '',                // legacy (kept, not removed)
      packingSuggestions: '',     // NEW FIELD
      tags: [],
      location: '',
      price: '',
      bestTime: '',
      rating: 0,
      media: { featuredImage: '', gallery: [] },
      status: 'draft',
    };
    if (!initial) return base;
    return {
      ...base,
      ...initial,
      // prefer existing packingSuggestions field; fallback to legacy content
      packingSuggestions: initial.packingSuggestions || initial.packing_suggestions || initial.packing || initial.content || '',
      media: {
        featuredImage: initial?.media?.featuredImage || '',
        gallery: Array.isArray(initial?.media?.gallery) ? initial.media.gallery : [],
      },
    };
  });

  // normalize existing names; support array of strings or {id,name}
  const normalizedExisting = useMemo(() => {
    const out = [];
    for (const item of existingNames || []) {
      if (!item) continue;
      if (typeof item === 'string') {
        out.push(item.toLowerCase());
      } else if (typeof item === 'object') {
        if (ignoreId && (item.id === ignoreId || item.docId === ignoreId)) continue;
        const nm = item.name || item.title;
        if (nm) out.push(String(nm).toLowerCase());
      }
    }
    return out;
  }, [existingNames, ignoreId]);

  const [nameError, setNameError] = useState('');
  useEffect(() => {
    const n = (data.name || '').trim().toLowerCase();
    if (!n) { setNameError(''); return; }
    setNameError(normalizedExisting.includes(n) ? 'A destination with this name already exists.' : '');
  }, [data.name, normalizedExisting]);

  const [activeTab, setActiveTab] = useState('content');
  const [uploading, setUploading] = useState(false);

  const handleImageAdd = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return;
      setUploading(true);

      const formData = new FormData();
      formData.append('file', f);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: formData,
        });
        const dataRes = await res.json();
        if (!dataRes.secure_url) throw new Error('Cloudinary upload failed');

        setData((d) => {
          const newGallery = [...(d.media.gallery || []), dataRes.secure_url];
          const newFeatured = d.media.featuredImage || dataRes.secure_url;
          return {
            ...d,
            media: {
              ...d.media,
              gallery: newGallery,
              featuredImage: newFeatured,
            },
          };
        });
      } catch (err) {
        console.error('Cloudinary error:', err);
        alert('Image upload failed');
      } finally {
        setUploading(false);
      }
    };
    inp.click();
  };

  // NEW: track if user manually edited packing suggestions
  const userEditedPackingRef = useRef(false);
  const lastAutoRef = useRef('');

  // AUTO-GENERATE packing suggestions when category changes (non-destructive if user edited)
  useEffect(() => {
    const key = packingKey(data.category);
    const template = PACKING_TEMPLATES[key];
    if (!template) return;
    const current = data.packingSuggestions?.trim();
    const lastAuto = lastAutoRef.current;
    // Replace if empty OR still equal to previous auto template
    if (!userEditedPackingRef.current && (!current || current === lastAuto)) {
      setData(d => ({ ...d, packingSuggestions: template }));
      lastAutoRef.current = template;
    }
  }, [data.category]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    const n = (data.name || '').trim().toLowerCase();
    if (!n) { setNameError(''); return; }
    setNameError(normalizedExisting.includes(n) ? 'A destination with this name already exists.' : '');
  }, [data.name, normalizedExisting]);

  const submit = (e) => {
    e?.preventDefault();
    if (!data.name.trim()) return alert('Please enter a destination name');
    if (nameError) return alert(nameError);

    const payload = {
      ...data,
      // Keep legacy "content" (do not remove) & also store new dedicated field
      packingSuggestions: data.packingSuggestions,
      content: data.content || data.packingSuggestions, // legacy fallback
      updatedAt: new Date().toISOString(),
      createdAt: initial?.createdAt || new Date().toISOString(),
    };
    onSave?.(payload);
  };

  return (
    <form className="content-form" onSubmit={submit}>
      <div className="tabs" style={{ borderBottom: '1px solid #eef2f7', marginBottom: 16 }}>
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
            <select
              value={data.category}
              onChange={(e) => setData({ ...data, category: e.target.value })}
              className="form-input"
            >
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
            <textarea
              value={data.description}
              onChange={(e) => setData({ ...data, description: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="full">
            <label>Packing Suggestions</label>
            <textarea
              value={data.packingSuggestions}
              onChange={(e) => {
                userEditedPackingRef.current = true;
                setData({ ...data, packingSuggestions: e.target.value });
              }}
              placeholder="Auto-generated based on category (you can edit)..."
              className="form-input"
              style={{ minHeight: 220, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}
            />
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Auto-fills when you pick a category. Click regenerate to refresh.
              <button
                type="button"
                onClick={() => {
                  const key = packingKey(data.category);
                  const template = PACKING_TEMPLATES[key];
                  if (template) {
                    setData(d => ({ ...d, packingSuggestions: template }));
                    lastAutoRef.current = template;
                    userEditedPackingRef.current = false;
                  }
                }}
                style={{
                  marginLeft: 8,
                  background: '#eef2f7',
                  border: '1px solid #d1d5db',
                  padding: '2px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  cursor: 'pointer'
                }}
              >
                Regenerate
              </button>
            </div>
          </div>

          <div className="full">
            <label>Tags</label>
            <TagInput
              tags={data.tags}
              onChange={(tags) => setData({ ...data, tags })}
              placeholder="Add tags..."
            />
          </div>

          <div>
            <label>Location</label>
            <input
              value={data.location}
              onChange={(e) => setData({ ...data, location: e.target.value })}
              className="form-input"
            />
          </div>

          <div>
            <label>Price Range</label>
            {/* REPLACED: select -> numeric input with static Peso sign */}
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#6b7280',
                  fontWeight: 600
                }}
              >
                ₱
              </span>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                placeholder="Enter amount"
                value={(() => {
                  const v = data.price;
                  if (v === null || v === undefined) return '';
                  // If legacy values like '$$' exist, strip non-digits
                  if (typeof v === 'string' && /\D/.test(v)) {
                    const digits = v.replace(/[^\d]/g, '');
                    return digits;
                  }
                  return v;
                })()}
                onChange={(e) =>
                  setData({
                    ...data,
                    price: e.target.value.replace(/[^\d]/g, '')
                  })
                }
                className="form-input"
                style={{ paddingLeft: 32 }}
              />
            </div>
          </div>

          <div>
            <label>Best Time to Visit</label>
            <input
              value={data.bestTime}
              onChange={(e) => setData({ ...data, bestTime: e.target.value })}
              className="form-input"
              placeholder="e.g., March to May"
            />
          </div>
          
        </div>
      )}

      {activeTab === 'media' && (
        <div style={{ paddingBottom: 6 }}>
          <label style={{ display: 'block', marginBottom: 8, color: '#6b7280', fontSize: 12 }}>
            Featured Image
          </label>
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
        </div>
      )}

      {activeTab === 'seo' && (
        <div>
          <label>Meta Title</label>
          <input
            value={data.seo?.metaTitle || ''}
            onChange={(e) =>
              setData({ ...data, seo: { ...(data.seo || {}), metaTitle: e.target.value } })
            }
            className="form-input"
          />
          <label>Meta Description</label>
          <textarea
            value={data.seo?.metaDescription || ''}
            onChange={(e) =>
              setData({ ...data, seo: { ...(data.seo || {}), metaDescription: e.target.value } })
            }
            className="form-input"
          />
          <label>Keywords</label>
          <TagInput
            tags={(data.seo && data.seo.keywords) || []}
            onChange={(k) => setData({ ...data, seo: { ...(data.seo || {}), keywords: k } })}
            placeholder="Add keywords..."
          />
        </div>
      )}

      {activeTab === 'settings' && (
        <div>
          <label>Status</label>
          <select
            value={data.status}
            onChange={(e) => setData({ ...data, status: e.target.value })}
            className="form-input"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>

          <label style={{ display: 'block', marginTop: 12 }}>
            <input
              type="checkbox"
              checked={data.featured || false}
              onChange={(e) => setData({ ...data, featured: e.target.checked })}
            />{' '}
            Featured
          </label>
        </div>
      )}

      <div className="form-actions" style={{ marginTop: 18 }}>
        <button
          type="submit"
          className="btn-primary"
          disabled={!!nameError}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            opacity: nameError ? 0.7 : 1,
            cursor: nameError ? 'not-allowed' : 'pointer',
          }}
        >
          {initial ? 'Update destination' : 'Create destination'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={onCancel}
          style={{ padding: '10px 18px', borderRadius: 8 }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default DestinationForm;