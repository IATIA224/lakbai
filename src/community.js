import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom"; // <-- ADD THIS
import { Link } from "react-router-dom";
import {
  addDoc, collection, serverTimestamp, getDocs, query, where, doc, getDoc,
  updateDoc, setDoc, arrayUnion, arrayRemove, onSnapshot, increment, deleteDoc,
  documentId
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./firebase";
import { CLOUDINARY_CONFIG } from "./profile";
import FriendPopup from "./friend";
import "./community.css";
import { emitAchievement } from "./achievementsBus";
import { logCommunityShareAdventure, logCommunityDeleteAdventure } from "./community-log"; // Add this import
import { filterPostsByView, loadAllPosts, loadUserFriends, loadUserSavedPosts } from "./communityNav";

// Simple in-memory cache for user photos to avoid repeated Firestore reads
const userPhotoCache = new Map();

// Helper to upload images to Cloudinary
async function uploadToCloudinary(file) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
  const res = await fetch(url, { method: "POST", body: formData });
  const data = await res.json();
  return data.secure_url;
}

const initialPosts = []; // Start empty to show the placeholder

function ShareTripModal({ onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [location, setLocation] = useState("");
  const [duration, setDuration] = useState("");
  const [budget, setBudget] = useState("");
  const [highlights, setHighlights] = useState("");
  const [visibility, setVisibility] = useState("Public");
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setUploading(true);
    const uploaded = [];

    for (const file of files) {
      try {
        const url = await uploadToCloudinary(file);
        uploaded.push(url);
      } catch (err) {
        console.error("Upload failed:", err);
        alert(`Failed to upload ${file.name}`);
      }
    }

    setImages((prev) => [...prev, ...uploaded]);
    setUploading(false);
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setCurrentImageIndex(0);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert("Please enter a title for your trip");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert("Please sign in to share a trip");
      return;
    }

    setUploading(true);

    try {
      const postData = {
        title: title.trim(),
        details: details.trim() || "",
        location: location.trim() || "",
        duration: duration.trim() || "",
        budget: budget.trim() || "",
        highlights: highlights.trim() || "",
        visibility,
        images: images || [],
        authorId: currentUser.uid,
        author: {
          name: currentUser.displayName || currentUser.email || "Anonymous",
          uid: currentUser.uid
        },
        likes: 0,
        likedBy: [],
        comments: 0,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "community"), postData);

      // Log the share adventure activity
      await logCommunityShareAdventure({
        title: postData.title,
        location: postData.location,
        user: currentUser
      });

      // Unlock achievement if first post
      await unlockHelloWorldAchievement();

      onCreate(postData);
      onClose();

      alert("Trip shared successfully! 🎉");
    } catch (err) {
      console.error("Failed to create post:", err);
      alert("Failed to share trip. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="community-modal-backdrop" onClick={onClose}>
      <div className="community-modal share-trip-modal" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-header">
          <h3>✈️ Share Your Travel Experience</h3>
          <p style={{ margin: "8px 0 0", opacity: 0.95, fontSize: "0.95rem" }}>
            Share your amazing journey with the community
          </p>
        </div>

        <div className="modal-form">
          {/* Title */}
          <label className="modal-label">
            <span className="field-title">Trip Title *</span>
            <input
              className="modal-input"
              placeholder="e.g., Amazing Weekend in Baguio"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </label>

          {/* Location - Manual Input */}
          <label className="modal-label">
            <span className="field-title">Location</span>
            <input
              className="modal-input"
              placeholder="e.g., Baguio City, Benguet"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={100}
            />
          </label>

          {/* Duration & Budget */}
          <div className="modal-row">
            <label className="modal-label">
              <span className="field-title">Duration</span>
              <input
                className="modal-input"
                placeholder="e.g., 3 Days"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </label>

            <label className="modal-label">
              <span className="field-title">Budget (PHP)</span>
              <input
                className="modal-input"
                type="number"
                placeholder="e.g., 5000"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </label>
          </div>

          {/* Details */}
          <label className="modal-label">
            <span className="field-title">Trip Details</span>
            <textarea
              className="modal-textarea"
              placeholder="Share your experience, tips, and recommendations..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={2000}
              rows={5}
            />
            <div style={{ textAlign: "right", fontSize: "0.85rem", color: "#6b7280", marginTop: 4 }}>
              {details.length}/2000
            </div>
          </label>

          {/* Highlights */}
          <label className="modal-label">
            <span className="field-title">Highlights</span>
            <textarea
              className="modal-textarea"
              placeholder="e.g., Day 1: Burnham Park, Day 2: Botanical Garden, Day 3: Night Market"
              value={highlights}
              onChange={(e) => setHighlights(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </label>

          {/* Visibility */}
          <label className="modal-label">
            <span className="field-title">Who can see this?</span>
            <div className="segmented">
              <button
                type="button"
                className={`seg-btn ${visibility === "Public" ? "is-active" : ""}`}
                onClick={() => setVisibility("Public")}
              >
                🌍 Public
              </button>
              <button
                type="button"
                className={`seg-btn ${visibility === "Friends" ? "is-active" : ""}`}
                onClick={() => setVisibility("Friends")}
              >
                👥 Friends
              </button>
              <button
                type="button"
                className={`seg-btn ${visibility === "Only Me" ? "is-active" : ""}`}
                onClick={() => setVisibility("Only Me")}
              >
                🔒 Only Me
              </button>
            </div>
          </label>

          {/* Image Upload */}
          <label className="modal-label">
            <span className="field-title">Photos</span>
            <div className="upload-row">
              <label className="btn-secondary btn-upload" style={{ cursor: "pointer", margin: 0 }}>
                <span className="btn-upload-icon">📷</span>
                <span>Choose Photos</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  style={{ display: "none" }}
                  disabled={uploading}
                />
              </label>
              <span className="upload-hint">
                {uploading ? "Uploading..." : `${images.length} photo(s) selected`}
              </span>
            </div>

            {images.length > 0 && (
              <div className="thumbs">
                <div className="thumb-community">
                  <img src={images[currentImageIndex]} alt="Preview" />
                  <button
                    className="thumb-remove"
                    onClick={() => removeImage(currentImageIndex)}
                    title="Remove photo"
                  >
                    ×
                  </button>
                  {images.length > 1 && (
                    <>
                      <button
                        className="thumb-arrow left"
                        onClick={() =>
                          setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
                        }
                      >
                        ‹
                      </button>
                      <button
                        className="thumb-arrow right"
                        onClick={() =>
                          setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
                        }
                      >
                        ›
                      </button>
                      <div className="thumb-carousel-indicator">
                        {currentImageIndex + 1} / {images.length}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </label>

          {/* wtions */}
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose} disabled={uploading}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={uploading || !title.trim()}
            >
              {uploading ? "Sharing..." : "Share Trip"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ReportSuccessPopup({ onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2200);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <div className="report-success-backdrop">
      <div className="report-success-popup">
        <span className="report-success-icon">✅</span>
        <div className="report-success-title">Report Submitted</div>
        <div className="report-success-desc">Thank you for helping keep the community safe.</div>
      </div>
    </div>
  );
}

function ReportPostModal({ post, onClose }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const reasons = [
    { value: "inappropriate", label: "Inappropriate Content", priority: "High" },
    { value: "spam", label: "Spam/Promotional Content", priority: "Medium" },
    { value: "harassment", label: "Harassment/Bullying", priority: "High" },
    { value: "fake", label: "Fake/Misleading Content", priority: "Medium" },
    { value: "hate", label: "Hate Speech", priority: "High" },
    { value: "violence", label: "Violence/Threats", priority: "High" },
    { value: "copyright", label: "Copyright Violation", priority: "Medium" },
    { value: "privacy", label: "Privacy Violation", priority: "High" },
    { value: "other", label: "Other", priority: "Low" }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) {
      alert("Please select a reason for reporting.");
      return;
    }
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert("You must be signed in to report content.");
      return;
    }
    
    setLoading(true);
    try {
      const selected = reasons.find(r => r.value === reason);
      
      const reportData = {
        reporterId: currentUser.uid,
        reporterName: currentUser.displayName || "Anonymous user",
        reportedUserId: post.authorId || "unknown",
        reportedUserName: post.author?.name || "Unknown user",
        postId: post.id,
        contentType: "post",
        contentSnapshot: {
          title: post.title || "",
          details: post.details || "",
          location: post.location || "",
        },
        reason,
        reasonLabel: selected?.label || reason,
        details: details || "",
        priority: selected?.priority || "Low",
        status: "pending",
        reviewedBy: null,
        reviewNotes: null,
        reviewedAt: null,
        createdAt: serverTimestamp(),
      };
      
      console.log("Submitting report:", reportData);
      
      // Add the report to Firestore
      const docRef = await addDoc(collection(db, "report"), reportData);
      console.log("Report submitted with ID:", docRef.id);
      
      setShowSuccess(true);
      
      // Also log this action for moderation history (non-blocking)
      try {
        await addDoc(collection(db, "moderationLogs"), {
          action: "report_submitted",
          contentType: "post",
          contentId: post.id,
          reporterId: currentUser.uid,
          reportedUserId: post.authorId,
          reason: selected?.label || reason,
          timestamp: serverTimestamp()
        });
        console.log("Moderation log created");
      } catch (logErr) {
        console.error("Failed to log moderation action:", logErr);
      }
      
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 2200);
    } catch (err) {
      console.error("Failed to submit report:", err);
      console.error("Error details:", {
        code: err.code,
        message: err.message,
        stack: err.stack
      });
      alert(`Failed to submit report: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="community-modal-backdrop" onClick={onClose}>
        <div className="community-modal" onClick={e => e.stopPropagation()}>
          <div className="share-modal-header">
            <h3>Report Post</h3>
          </div>
          <form className="modal-form" onSubmit={handleSubmit}>
            <label className="modal-label">
              <span className="field-title">Reason</span>
              <select
                className="modal-input"
                value={reason}
                onChange={e => setReason(e.target.value)}
                required
              >
                <option value="">Select reason</option>
                {reasons.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </label>
            <label className="modal-label">
              <span className="field-title">Details</span>
              <textarea
                className="modal-textarea"
                rows={3}
                placeholder="Describe the issue (optional)"
                value={details}
                onChange={e => setDetails(e.target.value)}
                maxLength={500}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={!reason || loading}>
                {loading ? "Reporting..." : "Submit Report"}
              </button>
            </div>
          </form>
        </div>
      </div>
      {showSuccess && <ReportSuccessPopup onClose={() => setShowSuccess(false)} />}
    </>
  );
}

function ReportCommentModal({ comment, post, onClose }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const reasons = [
    { value: "inappropriate", label: "Inappropriate Content", priority: "High" },
    { value: "spam", label: "Spam/Promotional Content", priority: "Medium" },
    { value: "harassment", label: "Harassment/Bullying", priority: "High" },
    { value: "fake", label: "Fake/Misleading Content", priority: "Medium" },
    { value: "hate", label: "Hate Speech", priority: "High" },
    { value: "violence", label: "Violence/Threats", priority: "High" },
    { value: "copyright", label: "Copyright Violation", priority: "Medium" },
    { value: "privacy", label: "Privacy Violation", priority: "High" },
    { value: "other", label: "Other", priority: "Low" }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) {
      alert("Please select a reason for reporting.");
      return;
    }
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert("You must be signed in to report content.");
      return;
    }
    
    setLoading(true);
    try {
      const selected = reasons.find(r => r.value === reason);
      
      const reportData = {
        reporterId: currentUser.uid,
        reporterName: currentUser.displayName || "Anonymous user",
        reportedUserId: comment.userId || "unknown",
        reportedUserName: comment.userName || "Unknown user",
        postId: post.id,
        commentId: comment.id,
        contentType: "comment",
        contentSnapshot: {
          text: comment.text || "",
          createdAt: comment.createdAt || null,
        },
        reason,
        reasonLabel: selected?.label || reason,
        details: details || "",
        priority: selected?.priority || "Low",
        status: "pending",
        reviewedBy: null,
        reviewNotes: null,
        reviewedAt: null,
        createdAt: serverTimestamp(),
      };
      
      console.log("Submitting comment report:", reportData);
      
      // Add the report to Firestore
      const docRef = await addDoc(collection(db, "report"), reportData);
      console.log("Comment report submitted with ID:", docRef.id);
      
      setShowSuccess(true);
      
      // Also log this action for moderation history (non-blocking)
      try {
        await addDoc(collection(db, "moderationLogs"), {
          action: "report_submitted",
          contentType: "comment",
          contentId: comment.id,
          postId: post.id,
          reporterId: currentUser.uid,
          reportedUserId: comment.userId,
          reason: selected?.label || reason,
          timestamp: serverTimestamp()
        });
        console.log("Comment moderation log created");
      } catch (logErr) {
        console.error("Failed to log moderation action:", logErr);
      }
      
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 2200);
    } catch (err) {
      console.error("Failed to submit comment report:", err);
      console.error("Error details:", {
        code: err.code,
        message: err.message,
        stack: err.stack
      });
      alert(`Failed to submit report: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="community-modal-backdrop" onClick={onClose}>
        <div className="community-modal" onClick={e => e.stopPropagation()}>
          <div className="share-modal-header">
            <h3>Report Comment</h3>
          </div>
          <form className="modal-form" onSubmit={handleSubmit}>
            <label className="modal-label">
              <span className="field-title">Reason</span>
              <select
                className="modal-input"
                value={reason}
                onChange={e => setReason(e.target.value)}
                required
              >
                <option value="">Select reason</option>
                {reasons.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </label>
            <label className="modal-label">
              <span className="field-title">Details</span>
              <textarea
                className="modal-textarea"
                rows={3}
                placeholder="Describe the issue (optional)"
                value={details}
                onChange={e => setDetails(e.target.value)}
                maxLength={500}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={!reason || loading}>
                {loading ? "Reporting..." : "Submit Report"}
              </button>
            </div>
          </form>
        </div>
      </div>
      {showSuccess && <ReportSuccessPopup onClose={() => setShowSuccess(false)} />}
    </>
  );
}

function CommentModal({ post, onClose, onCountChange }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [reportingComment, setReportingComment] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState("");
  const textareaRef = useRef(null);
  const editTextareaRef = useRef(null);
  const commentListRef = useRef(null);

  const getInitials = (name = "User") =>
    name.trim().split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase();

  const timeAgo = (ms) => {
    if (!ms) return "just now";
    const s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
  };

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "0px";
      el.style.height = Math.min(el.scrollHeight, 180) + "px";
    };
    fit();
    el.addEventListener("input", fit);
    return () => el.removeEventListener("input", fit);
  }, []);

  // Realtime comments listener with caching
  useEffect(() => {
    const q = query(
      collection(db, "comments"), 
      where("postId", "==", post.id)
    );
    
    const unsub = onSnapshot(
      q,
      async (snap) => {
        let items = snap.docs.map(d => {
          const data = d.data();
          return { 
            id: d.id, 
            ...data,
            createdAt: data.createdAt || null,
            createdAtClient: data.createdAtClient || null
          };
        });
        
        // Sort by timestamp
        items.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? a.createdAtClient ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? b.createdAtClient ?? 0;
          return ta - tb;
        });

        // Batch fetch user photos
        const uidsToFetch = [...new Set(
          items.filter(c => !c.userPhoto && c.userId).map(c => c.userId)
        )].filter(uid => !userPhotoCache.has(uid));
        
        if (uidsToFetch.length) {
          for (let i = 0; i < uidsToFetch.length; i += 10) {
            const chunk = uidsToFetch.slice(i, i + 10);
            try {
              const userDocs = await Promise.all(
                chunk.map(uid => getDoc(doc(db, "users", uid)))
              );
              
              userDocs.forEach((snap, idx) => {
                const uid = chunk[idx];
                const photo = snap.exists() ? (snap.data()?.profilePicture || null) : null;
                userPhotoCache.set(uid, photo);
              });
            } catch (err) {
              console.error("Failed to fetch user photos:", err);
              chunk.forEach(uid => userPhotoCache.set(uid, null));
            }
          }
        }

        // Apply cached photos
        items = items.map(c => {
          if (c.userPhoto) return c;
          const cachedPhoto = userPhotoCache.get(c.userId);
          return { ...c, userPhoto: cachedPhoto ?? null };
        });

        setComments(items);
        setFetching(false);
        onCountChange?.(items.length);

        // Auto-scroll to bottom for new comments
        setTimeout(() => {
          if (commentListRef.current) {
            commentListRef.current.scrollTop = commentListRef.current.scrollHeight;
          }
        }, 100);
      },
      (err) => {
        console.error("Comments listener error:", err);
        setComments([]);
        setFetching(false);
        onCountChange?.(0);
      }
    );
    
    return () => unsub();
  }, [post.id, onCountChange]);

  // Optimized submit with instant feedback
  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (!text.trim() || loading) return;
    
    const user = auth.currentUser;
    if (!user) {
      alert("Please sign in to comment.");
      return;
    }

    const commentText = text.trim();
    setText(""); // Clear immediately
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }

    // Get user photo from cache
    let userPhoto = userPhotoCache.get(user.uid);
    if (userPhoto === undefined) {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        userPhoto = userDoc.exists() ? (userDoc.data()?.profilePicture || null) : null;
        userPhotoCache.set(user.uid, userPhoto);
      } catch (err) {
        userPhoto = null;
        userPhotoCache.set(user.uid, null);
      }
    }

    // Optimistic UI: add immediately
    const nowMs = Date.now();
    const tempId = `temp-${nowMs}`;
    const optimistic = {
      id: tempId,
      postId: post.id,
      userId: user.uid,
      userName: user.displayName || user.email || "Anonymous",
      userPhoto: userPhoto,
      text: commentText,
      hearts: 0,
      heartedBy: [],
      createdAtClient: nowMs,
      pending: true
    };
    
    setComments(prev => [...prev, optimistic]);
    onCountChange?.((comments?.length || 0) + 1);

    // Scroll to bottom
    setTimeout(() => {
      if (commentListRef.current) {
        commentListRef.current.scrollTop = commentListRef.current.scrollHeight;
      }
    }, 50);

    // Background Firestore write
    try {
      const commentData = {
        postId: post.id,
        userId: user.uid,
        userName: user.displayName || user.email || "Anonymous",
        userPhoto: userPhoto,
        text: commentText,
        hearts: 0,
        heartedBy: [],
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, "comments"), commentData);

      // Update post's comment count
      updateDoc(doc(db, "community", post.id), { 
        comments: increment(1) 
      }).catch(err => console.error("Failed to update post comment count:", err));

    } catch (err) {
      console.error("Failed to post comment:", err);
      alert("Failed to post comment. Please try again.");
      // Remove optimistic comment on error
      setComments(prev => prev.filter(c => c.id !== tempId));
    }
  }

  async function handleHeart(c) {
    const user = auth.currentUser;
    if (!user) return;
    
    const hasHeart = c.heartedBy?.includes(user.uid);
    
    // Optimistic update
    setComments(prev => prev.map(comment => 
      comment.id === c.id 
        ? {
            ...comment,
            hearts: Math.max((comment.hearts || 0) + (hasHeart ? -1 : 1), 0),
            heartedBy: hasHeart 
              ? (comment.heartedBy || []).filter(uid => uid !== user.uid)
              : [...(comment.heartedBy || []), user.uid]
          }
        : comment
    ));

    try {
      const ref = doc(db, "comments", c.id);
      await updateDoc(ref, hasHeart
        ? { hearts: Math.max((c.hearts || 1) - 1, 0), heartedBy: arrayRemove(user.uid) }
        : { hearts: (c.hearts || 0) + 1, heartedBy: arrayUnion(user.uid) }
      );
    } catch (err) {
      console.error("Failed to update heart:", err);
      // Rollback on error
      setComments(prev => prev.map(comment => comment.id === c.id ? c : comment));
    }
  }

  const onComposerKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  async function handleDeleteComment(commentId) {
    if (!window.confirm("Delete this comment?")) return;
    
    // Optimistic update
    setComments(prev => prev.filter(c => c.id !== commentId));
    onCountChange?.(comments.length - 1);
    
    try {
      await deleteDoc(doc(db, "comments", commentId));
      await updateDoc(doc(db, "community", post.id), { comments: increment(-1) });
    } catch (err) {
      console.error("Failed to delete comment:", err);
      alert("Failed to delete comment.");
    }
  }
  
  async function handleEditComment(comment) {
    if (editText.trim() === comment.text || !editText.trim() || loading) return;
    setLoading(true);
    
    // Optimistic update
    setComments(prev => prev.map(c => 
      c.id === comment.id 
        ? { ...c, text: editText.trim(), edited: true }
        : c
    ));
    setEditingComment(null);
    setEditText("");
    
    try {
      await updateDoc(doc(db, "comments", comment.id), {
        text: editText.trim(),
        edited: true,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to edit comment:", err);
      // Rollback
      setComments(prev => prev.map(c => c.id === comment.id ? comment : c));
    } finally {
      setLoading(false);
    }
  }
  
  useEffect(() => {
    if (editingComment) {
      setEditText(editingComment.text);
    }
  }, [editingComment]);
  
  useEffect(() => {
    const el = editTextareaRef.current;
    if (!el) return;
    
    const fit = () => {
      el.style.height = "0px";
      el.style.height = Math.min(el.scrollHeight, 180) + "px";
    };
    
    fit();
    el.addEventListener("input", fit);
    return () => el.removeEventListener("input", fit);
  }, [editingComment]);

  return (
    <>
      <div className="community-modal-backdrop" onClick={onClose}>
        <div className="community-modal cmt-modal-enhanced" onClick={(e) => e.stopPropagation()}>
          <div className="cmt-header-enhanced">
            <h3>
              💬 Comments <span className="cmt-count-enhanced">({comments.length})</span>
            </h3>
            <button className="cmt-close-enhanced" onClick={onClose} aria-label="Close">×</button>
          </div>

          <div className="cmt-list-enhanced" ref={commentListRef}>
            {fetching ? (
              <div className="cmt-skeleton-enhanced">
                {[1, 2, 3].map(i => (
                  <div key={i} className="cmt-skel-item">
                    <div className="cmt-skel-avatar"></div>
                    <div className="cmt-skel-content">
                      <div className="cmt-skel-line" style={{ width: '60%' }}></div>
                      <div className="cmt-skel-line" style={{ width: '90%' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <div className="cmt-empty-enhanced">
                <div className="cmt-empty-icon">💭</div>
                <div className="cmt-empty-text">No comments yet. Be the first!</div>
              </div>
            ) : (
              comments.map((c) => (
                <div 
                  key={c.id} 
                  className={`cmt-item-enhanced ${c.pending ? 'pending' : ''}`}
                >
                  <div className="cmt-avatar-enhanced">
                    {c.userPhoto ? 
                      <img src={c.userPhoto} alt={c.userName || "User"} /> : 
                      <div className="cmt-avatar-initials">{getInitials(c.userName)}</div>
                    }
                  </div>
                  <div className="cmt-bubble">
                    <div className="cmt-meta-enhanced">
                      <span className="cmt-name-enhanced">{c.userName}</span>
                      <span className="cmt-time-enhanced">{timeAgo(c.createdAt?.toMillis?.() ?? c.createdAtClient)}</span>
                      {c.edited && <span className="cmt-edited-badge">edited</span>}
                    </div>
                    
                    {editingComment?.id === c.id ? (
                      <div className="cmt-edit-form-enhanced">
                        <textarea
                          ref={editTextareaRef}
                          className="cmt-edit-input"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          maxLength={500}
                        />
                        <div className="cmt-edit-actions">
                          <button
                            type="button"
                            className="btn-cancel"
                            onClick={() => setEditingComment(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn-save"
                            onClick={() => handleEditComment(c)}
                            disabled={!editText.trim() || editText.trim() === c.text || loading}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="cmt-text-enhanced">{c.text}</div>
                    )}
                    
                    <div className="cmt-actions-enhanced">
                      <button
                        type="button"
                        className={`cmt-heart-btn ${c.heartedBy?.includes(auth.currentUser?.uid) ? "active" : ""}`}
                        onClick={() => handleHeart(c)}
                      >
                        ❤️ {c.hearts > 0 && <span>{c.hearts}</span>}
                      </button>
                      
                      {auth.currentUser && auth.currentUser.uid === c.userId && (
                        <div className="cmt-owner-actions">
                          <button
                            type="button"
                            className="cmt-action-btn"
                            onClick={() => setEditingComment(c)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="cmt-action-btn delete"
                            onClick={() => handleDeleteComment(c.id)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                      
                      {auth.currentUser && auth.currentUser.uid !== c.userId && (
                        <button
                          type="button"
                          className="cmt-report-btn"
                          onClick={() => setReportingComment(c)}
                        >
                          Report
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <form className="cmt-composer-enhanced" onSubmit={handleSubmit}>
            <div className="cmt-composer-wrap">
              <textarea
                ref={textareaRef}
                className="cmt-input-enhanced"
                rows={1}
                placeholder="Write a comment..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onComposerKeyDown}
                maxLength={500}
                required
              />
              <button 
                type="submit" 
                className="cmt-send-btn" 
                disabled={!text.trim() || loading}
                aria-label="Send comment"
              >
                ➤
              </button>
            </div>
            <div className="cmt-char-count">{text.length}/500</div>
          </form>
        </div>
      </div>

      {reportingComment && (
        <ReportCommentModal
          comment={reportingComment}
          post={post}
          onClose={() => setReportingComment(null)}
        />
      )}
    </>
  );
}

function PostActionMenu({ post, onEdit, onDelete }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const currentUser = auth.currentUser;
  const isOwner = currentUser && post.authorId === currentUser.uid;
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  if (!isOwner) return null;
  
  return (
    <div className="action-menu" ref={dropdownRef}>
      <button 
        className="action-dots" 
        onClick={() => setShowDropdown(!showDropdown)}
        aria-label="Post options"
      >
        •••
      </button>
      
      {showDropdown && (
        <div className="action-dropdown">
          <div className="action-item" onClick={() => { onEdit(); setShowDropdown(false); }}>
            <span className="action-item-icon">✏️</span> Edit
          </div>
          <div className="action-item delete" onClick={() => { onDelete(); setShowDropdown(false); }}>
            <span className="action-item-icon">🗑️</span> Delete
          </div>
        </div>
      )}
    </div>
  );
}

// Add this function:
async function getUserPostCount(uid) {
  const q = query(collection(db, "community"), where("authorId", "==", uid));
  const snap = await getDocs(q);
  return snap.size;
}

// Add this helper function near the top:
async function getUserLikesCount(uid) {
  // Likes on posts
  const postSnap = await getDocs(query(collection(db, "community"), where("authorId", "==", uid)));
  let postLikes = 0;
  postSnap.forEach(doc => { postLikes += doc.data().likes || 0; });

  // Likes on comments
  const commentSnap = await getDocs(query(collection(db, "comments"), where("userId", "==", uid)));
  let commentLikes = 0;
  commentSnap.forEach(doc => { commentLikes += doc.data().hearts || 0; });

  return postLikes + commentLikes;
}

function CommunitySidebar(props) {
  const [postCount, setPostCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [friendCount, setFriendCount] = useState(0); // <-- Add this state

  useEffect(() => {
    if (props.user?.uid) {
      getUserPostCount(props.user.uid).then(setPostCount);
      getUserLikesCount(props.user.uid).then(setLikeCount);

      // Fetch friend count from Firestore
      getDocs(collection(db, "users", props.user.uid, "friends"))
        .then(snap => setFriendCount(snap.size))
        .catch(() => setFriendCount(0));
    }
  }, [props.user]);

  const menuItems = [
    { id: 'feed', icon: '🏠', label: 'Home Feed', view: 'feed' },
    { id: 'trending', icon: '🔥', label: 'Trending', view: 'trending' },
    { id: 'friends', icon: '👥', label: 'Friends Only', view: 'friends' },
    { id: 'saved', icon: '🔖', label: 'Saved Posts', view: 'saved' },
    { id: 'my-posts', icon: '📝', label: 'My Posts', view: 'my-posts' },
  ];

  const quickLinks = [
    { id: 'profile', icon: '👤', label: 'My Profile', path: '/profile' },
  ];

  return (
    <div className="community-left">
      {/* Title */}
      <div className="community-title">
        <span className="title-emoji">🌍</span>
        Community Feed
      </div>

      {/* Action Buttons */}
      <div className="sidebar-actions">
        <button className="sidebar-btn sidebar-btn-primary" onClick={props.onShareTrip}>
          ✈️ Share Trip
        </button>
        <button className="sidebar-btn sidebar-btn-secondary" onClick={props.onFriendSettings}>
          👥 Friend Settings
        </button>
      </div>

      {/* Navigation Menu */}
      <div className="sidebar-section">
        <div className="sidebar-title">Navigation</div>
        <div className="sidebar-menu">
          {menuItems.map(item => (
            <div
              key={item.id}
              className={`sidebar-item ${props.activeView === item.view ? 'active' : ''}`}
              onClick={() => props.onNavigate(item.view)}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-divider"></div>

      {/* Quick Links */}
      <div className="sidebar-section">
        <div className="sidebar-title">Quick Links</div>
        <div className="sidebar-menu">
          {quickLinks.map(item => (
            <div
              key={item.id}
              className="sidebar-item"
              onClick={() => window.location.href = item.path}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* User Profile */}
      {props.user && (
        <>
          <div className="sidebar-divider"></div>
          <div className="sidebar-section">
            <div className="sidebar-title">Your Profile</div>
            <div className="sidebar-user-card">
              <div className="sidebar-user-header">
                <div className="sidebar-user-avatar">
                  {(props.user.displayName || props.user.email || 'U')[0].toUpperCase()}
                </div>
                <div className="sidebar-user-info">
                  <div className="sidebar-user-name">
                    {props.user.displayName || 'Traveler'}
                  </div>
                  <div className="sidebar-user-email">
                    {props.user.email}
                  </div>
                </div>
              </div>
              <div className="sidebar-user-stats">
                <div className="sidebar-stat">
                  <div className="sidebar-stat-value">{postCount}</div>
                  <div className="sidebar-stat-label">Posts</div>
                </div>
                <div className="sidebar-stat">
                  <div className="sidebar-stat-value">{friendCount}</div>
                  <div className="sidebar-stat-label">Friends</div>
                </div>
                <div className="sidebar-stat">
                  <div className="sidebar-stat-value">{likeCount}</div>
                  <div className="sidebar-stat-label">Likes</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Community() {
  const [posts, setPosts] = useState([]);
  const [allPosts, setAllPosts] = useState([]); // <-- Add this to store all posts
  const [showShareModal, setShowShareModal] = useState(false);
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commenting, setCommenting] = useState(null);
  const [reporting, setReporting] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [activeView, setActiveView] = useState('feed');
  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState(new Set());
  const [addingFriendId, setAddingFriendId] = useState(null);
  const [savedSet, setSavedSet] = useState(new Set());

  // Track current user and load data
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoading(true);
        const [friendsSet, savedPostsSet] = await Promise.all([
          loadUserFriends(currentUser),
          loadUserSavedPosts(currentUser)
        ]);
        setFriends(friendsSet);
        setSavedSet(savedPostsSet);
        
        const loadedPosts = await loadAllPosts(currentUser, friendsSet);
        setAllPosts(loadedPosts);
        setLoading(false);
      } else {
        setFriends(new Set());
        setSavedSet(new Set());
        const loadedPosts = await loadAllPosts(null, new Set());
        setAllPosts(loadedPosts);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  // Filter posts whenever activeView, allPosts, friends, or savedSet changes
  useEffect(() => {
    const filtered = filterPostsByView(activeView, allPosts, user, friends, savedSet);
    setPosts(filtered);
  }, [activeView, allPosts, user, friends, savedSet]);

  // Update handleCreatePost to reload all posts
  const handleCreatePost = async () => {
    if (user) {
      const friendsSet = await loadUserFriends(user);
      const loadedPosts = await loadAllPosts(user, friendsSet);
      setAllPosts(loadedPosts);
    }
  };

  // Handle post like
  async function handleLike(post) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert("Please sign in to like posts.");
      return;
    }

    const postRef = doc(db, "community", post.id);
    const liked = post.likedBy?.includes(currentUser.uid);

    try {
      await updateDoc(postRef, liked
        ? { likes: increment(-1), likedBy: arrayRemove(currentUser.uid) }
        : { likes: increment(1), likedBy: arrayUnion(currentUser.uid) }
      );

      // Optimistic UI update
      setPosts(prev => prev.map(p => p.id === post.id
        ? {
            ...p,
            likes: Math.max((p.likes || 0) + (liked ? -1 : 1), 0),
            likedBy: liked
              ? (p.likedBy || []).filter(uid => uid !== currentUser.uid)
              : [...(p.likedBy || []), currentUser.uid]
          }
        : p
      ));
    } catch (err) {
      console.error("Failed to toggle like:", err);
    }
  }

  // Handle adding friend
  async function handleAddFriend(targetUid) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert("Please sign in to add friends.");
      return;
    }
    if (!targetUid || targetUid === currentUser.uid || friends.has(targetUid)) return;

    try {
      setAddingFriendId(targetUid);
      const targetRef = doc(db, "users", targetUid);
      await updateDoc(targetRef, { friendRequests: arrayUnion(currentUser.uid) });

      setPosts(prev => prev.map(p => 
        p.authorId === targetUid ? { ...p, requestedByMe: true } : p
      ));
    } catch (err) {
      console.error("Failed to send friend request:", err);
      alert("Failed to send friend request.");
    } finally {
      setAddingFriendId(null);
    }
  }

  // Handle deleting post
  const handleDeletePost = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;

    try {
      await deleteDoc(doc(db, "community", postId));
      
      // Log the deletion
      await logCommunityDeleteAdventure({
        postId,
        user: auth.currentUser
      });

      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err) {
      console.error("Failed to delete post:", err);
      alert("Failed to delete post.");
    }
  };

  // Handle updating post
  const handleUpdatePost = (updatedPost) => {
    setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
  };

  // Add handleSavePost
  async function handleSavePost(post) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert("Please sign in to save posts.");
      return;
    }
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        savedPosts: arrayUnion(post.id)
      });
      setSavedSet(prev => new Set([...prev, post.id]));
    } catch (err) {
      console.error("Failed to save post:", err);
      alert("Failed to save post.");
    }
  }

  // Add handleUnsavePost
  async function handleUnsavePost(postId) {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        savedPosts: arrayRemove(postId)
      });
      setSavedSet(prev => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    } catch (err) {
      console.error("Failed to unsave post:", err);
      alert("Failed to unsave post.");
    }
  }

  // Add EditPostModal (minimal version)
  function EditPostModal({ post, onClose, onUpdate }) {
    const [title, setTitle] = useState(post.title || "");
    const [details, setDetails] = useState(post.details || "");
    const [location, setLocation] = useState(post.location || "");
    const [duration, setDuration] = useState(post.duration || "");
    const [budget, setBudget] = useState(post.budget || "");
    const [highlights, setHighlights] = useState(post.highlights || "");
    const [visibility, setVisibility] = useState(post.visibility || "Public");
    const [uploading, setUploading] = useState(false);

    const handleSubmit = async () => {
      if (!title.trim()) {
        alert("Please enter a title for your trip");
        return;
      }
      setUploading(true);
      try {
        const updatedData = {
          title: title.trim(),
          details: details.trim() || "",
          location: location.trim() || "",
          duration: duration.trim() || "",
          budget: budget.trim() || "",
          highlights: highlights.trim() || "",
          visibility,
          updatedAt: serverTimestamp()
        };
        await updateDoc(doc(db, "community", post.id), updatedData);
        onUpdate({ ...post, ...updatedData });
        onClose();
        alert("Post updated successfully! ✨");
      } catch (err) {
        console.error("Failed to update post:", err);
        alert("Failed to update post. Please try again.");
      } finally {
        setUploading(false);
      }
    };

    return ReactDOM.createPortal(
      <div className="community-modal-backdrop" onClick={onClose}>
        <div className="community-modal share-trip-modal" onClick={(e) => e.stopPropagation()}>
          <div className="share-modal-header">
            <h3>✏️ Edit Your Travel Story</h3>
          </div>
          <div className="modal-form">
            <label className="modal-label">
              <span className="field-title">Trip Title *</span>
              <input
                className="modal-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </label>
            <label className="modal-label">
              <span className="field-title">Location</span>
              <input
                className="modal-input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={100}
              />
            </label>
            <div className="modal-row">
              <label className="modal-label">
                <span className="field-title">Duration</span>
                <input
                  className="modal-input"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </label>
              <label className="modal-label">
                <span className="field-title">Budget (PHP)</span>
                <input
                  className="modal-input"
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </label>
            </div>
            <label className="modal-label">
              <span className="field-title">Trip Details</span>
              <textarea
                className="modal-textarea"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={2000}
                rows={5}
              />
            </label>
            <label className="modal-label">
              <span className="field-title">Highlights</span>
              <textarea
                className="modal-textarea"
                value={highlights}
                onChange={(e) => setHighlights(e.target.value)}
                maxLength={500}
                rows={3}
              />
            </label>
            <label className="modal-label">
              <span className="field-title">Who can see this?</span>
              <div className="segmented">
                <button
                  type="button"
                  className={`seg-btn ${visibility === "Public" ? "is-active" : ""}`}
                  onClick={() => setVisibility("Public")}
                >
                  🌍 Public
                </button>
                <button
                  type="button"
                  className={`seg-btn ${visibility === "Friends" ? "is-active" : ""}`}
                  onClick={() => setVisibility("Friends")}
                >
                  👥 Friends
                </button>
                <button
                  type="button"
                  className={`seg-btn ${visibility === "Only Me" ? "is-active" : ""}`}
                  onClick={() => setVisibility("Only Me")}
                >
                  🔒 Only Me
                </button>
              </div>
            </label>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={onClose} disabled={uploading}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSubmit}
                disabled={uploading || !title.trim()}
              >
                {uploading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className="com-page">
      {/* Animated background layers */}
      <div className="com-bg-dots" />
      <div className="com-bg-wave" />
      <div className="com-bg-circle c1" />
      <div className="com-bg-circle c2" />
      <div className="com-bg-circle c3" />
      <div className="com-bg-circle c4" />
      <div className="com-bg-shapes">
        <div className="com-bg-shape s1" />
        <div className="com-bg-shape s2" />
        <div className="com-bg-shape s3" />
      </div>

      <div className="community-grid-main">
        <CommunitySidebar 
          activeView={activeView}
          onNavigate={setActiveView}
          user={user}
          onShareTrip={() => setShowShareModal(true)}
          onFriendSettings={() => setShowFriendModal(true)}
        />

        <div className="community-right">
          <div className="community-right-title">
            {activeView === 'feed' && '🏠 Home Feed'}
            {activeView === 'trending' && '🔥 Trending Stories'}
            {activeView === 'friends' && '👥 Friends Only'}
            {activeView === 'saved' && '🔖 Saved Posts'}
            {activeView === 'my-posts' && '📝 My Posts'}
          </div>

          <div className="community-container">
            {loading ? (
              <div className="cm-loading-backdrop">
                <div className="cm-loading-card">
                  <div className="cm-spinner"></div>
                  <div className="cm-loading-title">Loading amazing travel stories...</div>
                  <div className="cm-skeleton-row">
                    <div className="cm-skel-card"></div>
                    <div className="cm-skel-card"></div>
                    <div className="cm-skel-card"></div>
                  </div>
                </div>
              </div>
            ) : posts.length === 0 ? (
              <div className="community-empty">
                <div className="empty-badge">✈️</div>
                <h3>No travel stories yet</h3>
                <p>Be the first to share your adventure!</p>
                <button className="btn-primary" onClick={() => setShowShareModal(true)}>
                  Share Your Trip
                </button>
              </div>
            ) : (
              <div className="community-list">
                {posts.map((post) => (
                  <article key={post.id} className="community-card card-popup">
                    <header className="card-head">
                      <div className="avatar" style={{
                        width: 40, height: 40, borderRadius: "50%", overflow: "hidden", background: "#f3f4f6"
                      }}>
                        <img
                          src={post.profilePicture || "/user.png"}
                          alt={post.author?.name || "User"}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>
                      <div className="meta">
                        <div className="name">{post.author?.name || "Anonymous"}</div>
                        <div className="sub">
                          {post.location ? <>📍 {post.location}</> : "Shared a trip"}
                          {post.budget && <><span className="dot">•</span>Budget: {post.budget}</>}
                          {post.duration && <><span className="dot">•</span>{post.duration}</>}
                          {post.visibility && <><span className="dot">•</span>{post.visibility}</>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <PostActionMenu 
                          post={post} 
                          onEdit={() => setEditingPost(post)} 
                          onDelete={() => handleDeletePost(post.id)}
                        />
                        <button
                          className="add-friend"
                          onClick={() => handleAddFriend(post.authorId)}
                          disabled={
                            !user ||
                            user.uid === post.authorId ||
                            friends.has(post.authorId) ||
                            post.requestedByMe ||
                            addingFriendId === post.authorId
                          }
                        >
                          {user?.uid === post.authorId
                            ? "You"
                            : friends.has(post.authorId)
                              ? "Friends"
                              : post.requestedByMe
                                ? "Requested"
                                : addingFriendId === post.authorId
                                  ? "Sending..."
                                  : "+ Add Friend"}
                        </button>
                        <button className="report-btn" onClick={() => setReporting(post)}>
                          Report
                        </button>
                      </div>
                    </header>

                    {post.images?.length ? (
                      <div className="card-banner">
                        <img src={post.images[0]} alt={post.title} />
                      </div>
                    ) : (
                      <div className="card-banner">
                        <div className="banner-gradient">
                          <h4>{post.title}</h4>
                        </div>
                      </div>
                    )}

                    <div className="card-body">
                      <p>{post.details}</p>
                      {post.highlights && (
                        <div className="highlights">
                          <strong>Highlights: </strong>{post.highlights}
                        </div>
                      )}
                    </div>

                    <footer className="card-actions">
                      <button
                        className="act"
                        onClick={() => handleLike(post)}
                        style={{
                          color: post.likedBy?.includes(user?.uid) ? "#ef4444" : undefined,
                          fontWeight: 700
                        }}
                      >
                        <span>❤️</span> {post.likes || 0}
                      </button>
                      <button className="act" onClick={() => setCommenting(post)}>
                        <span>💬</span> {post.comments || 0}
                      </button>
                      {/* Save/Unsave button */}
                      {savedSet.has(post.id) ? (
                        <button
                          className="act"
                          onClick={() => handleUnsavePost(post.id)}
                          title="Remove from saved posts"
                        >
                          <span>💾</span> Saved
                        </button>
                      ) : (
                        <button
                          className="act"
                          onClick={() => handleSavePost(post)}
                          title="Save this post"
                        >
                          <span>💾</span> Save
                        </button>
                      )}
                    </footer>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showShareModal && (
        <ShareTripModal
          onClose={() => setShowShareModal(false)}
          onCreate={handleCreatePost}
        />
      )}

      {showFriendModal && (
        <FriendPopup onClose={() => setShowFriendModal(false)} />
      )}

      {commenting && (
        <CommentModal
          post={commenting}
          onClose={() => setCommenting(null)}
          onCountChange={(count) => {
            setPosts(prev => prev.map(p => 
              p.id === commenting.id ? { ...p, comments: count } : p
            ));
          }}
        />
      )}

      {reporting && (
        <ReportPostModal
          post={reporting}
          onClose={() => setReporting(null)}
        />
      )}

      {editingPost && (
        <EditPostModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onUpdate={handleUpdatePost}
        />
      )}
    </div>
  );
};

// Achievement and activity functions
async function unlockHelloWorldAchievement() {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await updateDoc(doc(db, "users", user.uid), { ["achievements.4"]: true });
    await addActivity(user.uid, "You posted in the community!", "💬");
    emitAchievement("Hello, World! Achievement Unlocked! 🎉");
  } catch (err) {
    console.error("Failed to unlock Hello World achievement:", err);
  }
}

// Helper to add activity for a user
async function addActivity(userId, text, icon = "🔵") {
  try {
    const activityData = {
      userId,
      text,
      icon,
      timestamp: new Date().toISOString()
    };
    await addDoc(collection(db, "activities"), activityData);
  } catch (error) {
    console.error("Error adding activity:", error);
  }
}

// New helper to truncate long post/comment text with "Read more"
function ReadMore({ text, maxChars = 300 }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  if (text.length <= maxChars) return <p className="card-body-text">{text}</p>;
  return (
    <div className="card-body-text">
      {expanded ? text : text.slice(0, maxChars) + "…"}
      <button
        type="button"
        className="readmore-btn"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? "Show less" : "Read more"}
      </button>
    </div>
  );
}

// New mobile-specific loader: bouncing dots animation
function BouncingDotsLoader({ text = "Loading community feed…" }) {
  return (
    <div className="bouncing-dots-loader" role="status" aria-live="polite" aria-busy="true">
      <div className="dots-container">
        <div className="dot dot-1" aria-hidden="true"></div>
        <div className="dot dot-2" aria-hidden="true"></div>
        <div className="dot dot-3" aria-hidden="true"></div>
      </div>
      <div className="loader-text">{text}</div>
    </div>
  );
}