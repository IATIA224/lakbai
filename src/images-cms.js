import React, { useState, useEffect } from "react";
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import './Styles/contentManager.css';
import './Styles/images-cms.css';

const CLOUDINARY_CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'dcv3eqmde';


export default function ImagesCMS() {
    const [images, setImages] = useState([]);
    const [selectedImages, setSelectedImages] = useState([]);
    const [activeImage, setActiveImage] = useState(null);
    const [loading, setLoading] = useState(true);

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

    const handleImageSelect = (image) => {
        setSelectedImages(prev => {
            if (prev.includes(image.id)) {
                return prev.filter(id => id !== image.id);
            }
            return [...prev, image.id];
        });
    };

    const copyImageUrl = (url, e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(url);
    };

    const copySelectedUrls = () => {
        const urls = images
            .filter(img => selectedImages.includes(img.id))
            .map(img => img.url)
            .join('\n');
        navigator.clipboard.writeText(urls);
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

    return (
        <div className="content-section">
            <div className="section-header">
                <div>
                    <h2 className="title">Images</h2>
                    <p className="muted">Manage destination images</p>
                </div>
                <div className="images-cms-actions">
                    {selectedImages.length > 0 && (
                        <>
                            <button 
                                className="btn-secondary"
                                onClick={copySelectedUrls}
                            >
                                Copy Selected URLs
                            </button>
                            <button 
                                className="btn-danger"
                            >
                                Delete Selected
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="images-cms-container">
                <div className="images-cms-grid">
                    {loading ? (
                        <div className="loading-placeholder">Loading images...</div>
                    ) : (
                        images.map(image => (
                            <div 
                                key={image.id}
                                className={`image-card ${activeImage?.id === image.id ? 'active' : ''}`}
                                onClick={() => setActiveImage(image)}
                            >
                                <div className="image-card-content">
                                    <img
                                        src={getCloudinaryUrl(image.url)}
                                        alt={image.name}
                                        onError={e => { e.target.onerror = null; e.target.src = '/placeholder.jpg'; }}
                                    />
                                    <div className="image-card-overlay">
                                        <input
                                            type="checkbox"
                                            checked={selectedImages.includes(image.id)}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                handleImageSelect(image);
                                            }}
                                        />
                                        <button
                                            className="copy-btn"
                                            onClick={(e) => copyImageUrl(image.url, e)}
                                            title="Copy URL"
                                        >
                                            📋
                                        </button>
                                    </div>
                                </div>
                                <div className="image-card-footer">
                                    {image.name}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {activeImage && (
                    <div className="images-cms-sidebar">
                        <h3>Image Details</h3>
                        <div className="image-details">
                            <div className="detail-row">
                                <span className="detail-label">Name:</span>
                                <span>{activeImage.name}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Public ID:</span>
                                <span>{activeImage.publicId}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Created By:</span>
                                <span>{activeImage.createdBy}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Created At:</span>
                                <span>{new Date(activeImage.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">URL:</span>
                                <span className="url-text">{activeImage.url}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}