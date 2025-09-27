import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import './Styles/contentManager.css';
import './Styles/images-cms.css';
import { FiCopy } from "react-icons/fi"; // Add this if using react-icons, or use your preferred icon
import destImages from './dest-images.json'; // Import for local use

const CLOUDINARY_CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'dcv3eqmde';

const fs = window.require ? window.require('fs') : null; // For Electron/Node context

export default function ImagesCMS() {
    const [images, setImages] = useState([]);
    const [selectedImages, setSelectedImages] = useState([]);
    const [activeImage, setActiveImage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const [openDetails, setOpenDetails] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');

    // New state for delete confirmation and error
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

    useEffect(() => {
        loadImages();
    }, []);

    const loadImages = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/cloudinary-images');
            const data = await response.json();
            setImages(
                data.map(img => ({
                    id: img.public_id,
                    url: img.secure_url,
                    publicId: img.public_id,
                    name: img.public_id.split('/').pop().replace(/_/g, ' ').replace('.jpg', ''),
                    createdBy: img.uploaded_by || 'Unknown',
                    createdAt: img.created_at
                }))
            );
        } catch (err) {
            console.error('Error loading images:', err);
        }
        setLoading(false);
    };

    const getPublicIdFromUrl = (url) => {
        try {
            // Extract everything after '/upload/' and before file extension
            const match = url.match(/\/upload\/([^\.]+)\./);
            return match ? match[1] : url;
        } catch (e) {
            return 'unknown';
        }
    };

    // Select all handler
    const handleSelectAll = () => {
        if (selectedImages.length === images.length) {
            setSelectedImages([]);
        } else {
            setSelectedImages(images.map(img => img.id));
        }
    };

    // Checkbox handler
    const handleImageSelect = (image) => {
        setSelectedImages(prev => 
            prev.includes(image.id)
                ? prev.filter(id => id !== image.id)
                : [...prev, image.id]
        );
    };

    // Copy single image URL handler
    const copyImageUrl = (url) => {
        navigator.clipboard.writeText(url).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 1800);
        });
    };

    const copySelectedUrls = () => {
        const urls = images
            .filter(img => selectedImages.includes(img.id))
            .map(img => img.url)
            .join('\n');
        if (urls) {
            navigator.clipboard.writeText(urls).then(() => {
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 1800);
            });
        }
    };

    const getCloudinaryUrl = (urlOrPublicId) => {
        // If it's already a full URL, return as is
        if (urlOrPublicId.startsWith('http')) return urlOrPublicId;

        // If it's a versioned path (v1234/filename.ext), prepend Cloudinary base URL
        if (/^v\d+\/[^\/]+\.\w+$/.test(urlOrPublicId)) {
            return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${urlOrPublicId}`;
        }

        // If it's just a public ID (no slash, no version), fallback to 'destinations' folder and .jpg
        if (!urlOrPublicId.includes('/')) {
            return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/destinations/${urlOrPublicId}.jpg`;
        }

        // Otherwise, fallback to placeholder
        return '/placeholder.jpg';
    };

    // Chunking logic
    const chunkSize = 3;
    const chunkedImages = [];
    for (let i = 0; i < images.length; i += chunkSize) {
        chunkedImages.push(images.slice(i, i + chunkSize));
    }

    // --- Upload Handler ---
    const handleUploadClick = () => {
        document.getElementById('cloudinary-upload-input').click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.jpg') && !file.name.toLowerCase().endsWith('.jpeg')) {
            alert('Only JPG images are allowed.');
            return;
        }
        // Check for duplicate name (case-insensitive, ignore .jpg)
        const newName = file.name.replace(/\.jpe?g$/i, '').trim().toLowerCase();
        const isDuplicate = images.some(img => img.name.trim().toLowerCase() === newName);
        if (isDuplicate) {
            setUploadError('Image with this name already exists.');
            setTimeout(() => setUploadError(''), 3000);
            e.target.value = '';
            return;
        }
        setUploading(true);
        setUploadError('');
        try {
            // Upload to Cloudinary
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || 'lakbai_uploads');
            // Use the actual file name (without extension) as public_id
            const actualName = file.name.replace(/\.jpe?g$/i, '');
            formData.append('public_id', actualName);

            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (!data.secure_url) throw new Error('Upload failed');

            // Use the actual file name (without extension) as the image name
            // (Cloudinary will use this as the public_id as well)
            // Save to Firestore (or your DB) with the actual name
            await addDoc(collection(db, 'photos'), {
                name: actualName,
                url: data.secure_url,
                publicId: data.public_id,
                createdBy: 'Admin',
                createdAt: Date.now(),
            });

            // Also update dest-images.json if needed (see previous logic)
            if (fs) {
                try {
                    const jsonPath = require('path').join(__dirname, 'dest-images.json');
                    let current = [];
                    try {
                        current = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                    } catch {}
                    const url = data.secure_url;
                    if (!current.some(img => img.url === url)) {
                        current.push({ name: actualName, url });
                        fs.writeFileSync(jsonPath, JSON.stringify(current, null, 2), 'utf8');
                    }
                } catch (err) {
                    // Silent fail for browser context
                }
            } else {
                // If not Node/Electron, you may POST to a backend API to update dest-images.json
                // Example:
                // await fetch('/api/update-dest-images', {
                //   method: 'POST',
                //   headers: { 'Content-Type': 'application/json' },
                //   body: JSON.stringify({ name: actualName, url: data.secure_url })
                // });
            }

            // Write Audit Log to Firebase
            const auditLog = {
                eventId: `#${Date.now()}`,
                timestamp: new Date().toISOString(),
                action: 'photo upload',
                category: 'IMAGE UPLOAD',
                target: `photo (${data.public_id})`,
                request: `POST https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
                outcome: data.secure_url ? 'success (201)' : 'failure',
                user: {
                    name: 'Aclan Jeremy',
                    username: 'aclanjeremy432@gmail.com',
                    role: 'Admin',
                    userId: 'cuuEceXHEmOMa37xQeSTFbixeqt2',
                    _session: 'unknown',
                    get session() { return this._session; },
                    set session(value) { this._session = value; },
                },
                source: {
                    device: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
                    browser: navigator.userAgent,
                    os: navigator.platform,
                },
                securityFlags: 'None',
                eventDetails: {
                    filename: file.name,
                    size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
                    location: data.public_id.split('/')[0] || 'unknown',
                },
                userAgent: navigator.userAgent,
                dataChanges: {
                    filename: file.name,
                    size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
                    location: data.public_id.split('/')[0] || 'unknown',
                },
                createdAt: serverTimestamp(),
            };
            await addDoc(collection(db, 'auditLogs'), auditLog);

            // Reload images
            await loadImages();
        } catch (err) {
            setUploadError('Image upload failed. Please try again.');
            console.error(err);
            setTimeout(() => setUploadError(''), 3000);
        }
        setUploading(false);
        e.target.value = '';
    };

    // Delete handler
    const handleDeleteImages = async () => {
        setDeleting(true);
        setDeleteError('');
        try {
            const toDelete = images.filter(img => selectedImages.includes(img.id));
            for (const img of toDelete) {
                // Delete from Cloudinary
                const publicId = img.publicId;
                if (publicId) {
                    // Call your backend endpoint to delete from Cloudinary
                    const res = await fetch('http://localhost:3002/api/cloudinary/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ publicId })
                    });
                    if (!res.ok) throw new Error('Cloudinary delete failed');
                }
                // Delete from Firestore
                await deleteDoc(doc(db, 'photos', img.id));
            }
            setImages(prev => prev.filter(img => !selectedImages.includes(img.id)));
            setSelectedImages([]);
            setDeleteConfirmOpen(false);
        } catch (err) {
            setDeleteError('Failed to delete image(s). Please try again.');
        }
        setDeleting(false);
    };

    return (
        <div className="content-section">
            <div className="section-header">
                <div>
                    <h2 className="title">Images</h2>
                    <p className="muted">Manage destination images</p>
                </div>
                <div className="images-cms-actions">
                    <button 
                        className="btn-primary-cms"
                        onClick={handleUploadClick}
                        disabled={uploading}
                        style={{ minWidth: 120 }}
                    >
                        {uploading ? 'Uploading...' : 'Upload Image'}
                    </button>
                    <button
                        className="btn-secondary"
                        style={{ minWidth: 120 }}
                        onClick={handleSelectAll}
                    >
                        {selectedImages.length === images.length && images.length > 0 ? 'Unselect All' : 'Select All'}
                    </button>
                    <input
                        id="cloudinary-upload-input"
                        type="file"
                        accept=".jpg,.jpeg"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />
                    {selectedImages.length === 1 && (
                        <button 
                            className="btn-danger"
                            onClick={() => setDeleteConfirmOpen(true)}
                        >
                            Delete
                        </button>
                    )}
                    {selectedImages.length > 1 && (
                        <button 
                            className="btn-danger"
                            onClick={() => setDeleteConfirmOpen(true)}
                        >
                            Delete All
                        </button>
                    )}
                    {selectedImages.length > 0 && (
                        <button 
                            className="btn-secondary"
                            onClick={copySelectedUrls}
                        >
                            Copy Selected URLs
                        </button>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirmOpen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.45)',
                        zIndex: 2000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    onClick={e => { if (e.target === e.currentTarget) setDeleteConfirmOpen(false); }}
                >
                    <div
                        style={{
                            background: '#fff',
                            borderRadius: 12,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                            padding: 32,
                            minWidth: 340,
                            maxWidth: '90vw',
                            textAlign: 'center'
                        }}
                    >
                        <h3 style={{ marginBottom: 16 }}>
                            {selectedImages.length === 1 ? 'Delete Image' : 'Delete Images'}
                        </h3>
                        <div style={{ marginBottom: 18 }}>
                            Are you sure you want to delete {selectedImages.length === 1 ? 'this image' : 'these images'}?
                        </div>
                        {deleteError && (
                            <div style={{ color: '#b91c1c', marginBottom: 12 }}>{deleteError}</div>
                        )}
                        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                            <button
                                className="btn-danger"
                                style={{ padding: '8px 22px', borderRadius: 8, fontWeight: 700 }}
                                disabled={deleting}
                                onClick={handleDeleteImages}
                            >
                                {deleting ? 'Deleting...' : 'Yes'}
                            </button>
                            <button
                                className="btn-secondary"
                                style={{ padding: '8px 22px', borderRadius: 8, fontWeight: 700 }}
                                disabled={deleting}
                                onClick={() => setDeleteConfirmOpen(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Search Bar */}
            <div className="content-card" style={{ padding: 16, borderRadius: 12, display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                <span className="search-icon" style={{ position: 'absolute', left: 14, top: 22, opacity: 0.6 }}>🔎</span>
                <input
                    className="form-input"
                    type="text"
                    style={{ width: '100%', paddingLeft: 40 }}
                    placeholder="Search images by name..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                </div>
                <select
                    className="images-cms-status-dropdown"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    style={{ width: 160 }}
                >
                    <option value="all">Region</option>
                    <option value="CAR">CAR - Cordillera Administrative Region</option>
                    <option value="CARAGA">CARAGA - Region XIII</option>
                    <option value="ILOCOS">Ilocos Region</option>
                    <option value="NCR">NCR - National Capital Region</option>
                    <option value="REGION_I">Region I - Ilocos Region</option>
                    <option value="REGION_IV_B">Region IV-B - MIMAROPA</option>
                    <option value="REGION_V">Region V - Bicol Region</option>
                    <option value="REGION_VI">Region VI - Western Visayas</option>
                    <option value="REGION_VII">Region VII - Central Visayas</option>
                </select>
            </div>

            <div className="images-cms-rows-container">
                <div className="images-cms-row-box">
                    <div className="images-cms-grid">
                        {loading ? (
                            <div style={{ gridColumn: '1/-1', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 60 }}>
                                <div className="loading-spinner" />
                                <div style={{ color: '#64748b', marginTop: 18, fontSize: 16 }}>Loading images...</div>
                            </div>
                        ) : (
                            images
                                .filter(img => img.name.toLowerCase().includes(search.toLowerCase()))
                                .map(image => (
                                    <div className={`image-card${selectedImages.includes(image.id) ? ' active' : ''}`} key={image.id}>
                                        <div className="image-card-content" style={{ position: 'relative' }}>
                                            {/* Checkbox top-left */}
                                            <input
                                                type="checkbox"
                                                className="images-cms-checkbox"
                                                checked={selectedImages.includes(image.id)}
                                                onChange={() => handleImageSelect(image)}
                                                style={{
                                                    position: 'absolute',
                                                    top: 10,
                                                    left: 10,
                                                    zIndex: 2,
                                                    width: 22,
                                                    height: 22
                                                }}
                                            />
                                            {/* Copy link icon top-right */}
                                            <button
                                                className="images-cms-copy-btn"
                                                title="Copy image URL"
                                                style={{
                                                    position: 'absolute',
                                                    top: 10,
                                                    right: 10,
                                                    background: '#fff',
                                                    border: '1px solid #e0e7ef',
                                                    borderRadius: 6,
                                                    padding: 4,
                                                    fontSize: 18,
                                                    cursor: 'pointer',
                                                    zIndex: 2,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                onClick={() => copyImageUrl(image.url)}
                                            >
                                                {/* Use react-icons or fallback to emoji */}
                                                <FiCopy style={{ color: '#2563eb', fontSize: 18 }} />
                                            </button>
                                            <img src={image.url} alt={image.name} />
                                        </div>
                                        <div className="image-card-footer">
                                            {
                                                // Remove a trailing 6-character ID if separated by space, else show full name
                                                (() => {
                                                    const match = image.name.match(/^(.*)\s([a-zA-Z0-9]{6})$/);
                                                    return match ? match[1] : image.name;
                                                })()
                                            }
                                        </div>
                                        <div className="image-card-details">
                                            <div className="image-details">
                                                <div className="detail-row">
                                                    <span className="detail-label">Name:</span>
                                                    <span>{image.name}</span>
                                                </div>
                                                <div className="detail-row">
                                                    <span className="detail-label">Public ID:</span>
                                                    <span>{image.publicId}</span>
                                                </div>
                                                <div className="detail-row">
                                                    <span className="detail-label">Created By:</span>
                                                    <span>{image.createdBy}</span>
                                                </div>
                                                <div className="detail-row">
                                                    <span className="detail-label">Created At:</span>
                                                    <span>{new Date(image.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <div className="detail-row">
                                                    <span className="detail-label">URL:</span>
                                                    <span className="url-text">{image.url}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                        )}
                    </div>
                </div>
            </div>

            {/* On-screen confirmation for copy */}
            {copySuccess && (
                <div
                    style={{
                        position: 'fixed',
                        top: 32,
                        right: 32,
                        background: '#22c55e',
                        color: '#fff',
                        padding: '12px 28px',
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: 16,
                        boxShadow: '0 2px 12px rgba(34,197,94,0.12)',
                        zIndex: 3000,
                        transition: 'opacity 0.3s'
                    }}
                >
                    URLs copied!
                </div>
            )}

            {/* On-screen error for upload */}
            {uploadError && (
                <div
                    style={{
                        position: 'fixed',
                        top: 32,
                        right: 32,
                        background: '#ef4444',
                        color: '#fff',
                        padding: '12px 28px',
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: 16,
                        boxShadow: '0 2px 12px rgba(239,68,68,0.12)',
                        zIndex: 3000,
                        transition: 'opacity 0.3s',
                        animation: 'fadeOut 0.5s ease-in-out 3s forwards'
                    }}
                >
                    {uploadError}
                </div>
            )}
        </div>
    );
}