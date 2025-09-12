import React, { useEffect, useMemo, useRef, useState } from "react";
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
  const [location, setLocation] = useState("");
  const [caption, setCaption] = useState("");
  const [duration, setDuration] = useState("");
  const [budget, setBudget] = useState("");
  const [highlights, setHighlights] = useState("");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [visibility, setVisibility] = useState("Public");
  const [loading, setLoading] = useState(false);

  const inputRef = useRef(null);

  const handleFiles = (fileList) => {
    const arr = Array.from(fileList || []);
    const filtered = arr.filter(f => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024);
    const urls = filtered.map(f => URL.createObjectURL(f));
    setFiles(prev => [...prev, ...filtered]);
    setPreviews(prev => [...prev, ...urls]);
  };

  const onBrowse = (e) => handleFiles(e.target.files);

  const removePreview = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const canPost = location && (caption.trim().length > 0 || previews.length > 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canPost) return;
    const user = auth.currentUser;
    console.log("DEBUG: auth.currentUser =", user);

    if (!user) {
      alert("Please sign in to share a trip.");
      return;
    }

    setLoading(true);
    try {
      const imageUrls = [];
      for (const file of files) {
        const url = await uploadToCloudinary(file);
        imageUrls.push(url);
      }

      const postPayload = {
        authorId: user.uid,
        author: {
          name: user.displayName || "You",
          initials: (user.displayName || "You")
            .split(" ")
            .map(n => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
        },
        location,
        title: caption.split("\n")[0].slice(0, 80) || "Shared Adventure",
        details: caption || "",
        budget: budget || "",
        duration: duration || "",
        highlights: highlights || "",
        visibility,
        likes: 0,
        comments: 0,
        createdAt: serverTimestamp()
      };
      if (imageUrls.length > 0) postPayload.images = imageUrls;
      if (visibility === "Friends") postPayload.allowedUids = []; // put friend UIDs here

      console.log("DEBUG: Posting payload (authorId, visibility, createdAt sentinel):", {
        authorId: postPayload.authorId,
        visibility: postPayload.visibility,
        createdAt: "serverTimestamp()",
        allowedUids: postPayload.allowedUids,
        imagesCount: postPayload.images?.length || 0
      });

      await addDoc(collection(db, "community"), postPayload);

      // Unlock Hello World achievement and add activity
      await unlockHelloWorldAchievement();

      onCreate();
      onClose();
    } catch (err) {
      console.error("Firestore write failed:", err);
      alert("Failed to share trip: " + (err.code || err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="community-modal-backdrop" onClick={onClose}>
      <div className="community-modal" onClick={e => e.stopPropagation()}>
        {/* Colorful header like EditProfile */}
        <div className="share-modal-header">
          <h3>Share Your Philippines Adventure</h3>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="modal-label">
            <span className="field-title">📍 Location</span>
            <select
              className="modal-input"
              value={location}
              onChange={e => setLocation(e.target.value)}
            >
              <option value="">Select Province/City</option>
              <option>Metro Manila</option>
              <option>Cebu</option>
              <option>Bohol</option>
              <option>Palawan</option>
              <option>Siargao</option>
              <option>Baguio</option>
              <option>Davao</option>
            </select>
          </label>

          {/* Upload Photos as a button matching Share */}
          <label className="modal-label">
            <span className="field-title">📷 Photos</span>
            <div className="upload-row">
              <button
                type="button"
                className="btn-primary btn-upload"
                onClick={() => inputRef.current?.click()}
              >
                <span className="btn-upload-icon">📷</span>
                Upload Photos
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={onBrowse}
              />
              <div className="upload-hint">JPG, PNG up to 10MB each</div>
            </div>

            {previews.length > 0 && (
              <div className="thumbs">
                {previews.map((src, i) => (
                  <div className="thumb" key={src}>
                    <img src={src} alt={`upload ${i + 1}`} />
                    <button
                      type="button"
                      className="thumb-remove"
                      onClick={() => removePreview(i)}
                      aria-label="Remove photo"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </label>

          {/* NEW: Visibility */}
          <label className="modal-label">
            <span className="field-title">Who can see this?</span>
            <div className="segmented" role="group" aria-label="Post visibility">
              {["Public", "Friends", "Only Me"].map(opt => (
                <button
                  key={opt}
                  type="button"
                  className={`seg-btn${visibility === opt ? " is-active" : ""}`}
                  onClick={() => setVisibility(opt)}
                >
                  {opt === "Public" ? "🌐 Public" : opt === "Friends" ? "👥 Friends" : "🔒 Only Me"}
                </button>
              ))}
            </div>
          </label>

          <label className="modal-label">
            <span className="field-title">📝 Caption</span>
            <textarea
              className="modal-textarea"
              rows={4}
              placeholder="Share your experience... What made this trip special?"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              maxLength={1000}
            />
          </label>

          <div className="modal-row">
            <label className="modal-label">
              <span className="field-title">📅 Duration</span>
              <input
                className="modal-input"
                placeholder="e.g., 3 days"
                value={duration}
                onChange={e => setDuration(e.target.value)}
              />
            </label>
            <label className="modal-label">
              <span className="field-title">💰 Budget</span>
              <input
                className="modal-input"
                placeholder="e.g., ₱15,000"
                value={budget}
                onChange={e => setBudget(e.target.value)}
              />
            </label>
          </div>

          <label className="modal-label">
            <span className="field-title">🗺️ Itinerary Highlights</span>
            <textarea
              className="modal-textarea"
              rows={3}
              placeholder="Day 1: Arrival, Day 2: Island hopping, etc."
              value={highlights}
              onChange={e => setHighlights(e.target.value)}
              maxLength={1000}
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={!canPost || loading}>
              {loading ? "Sharing..." : "Share Adventure"}
            </button>
          </div>
        </form>
      </div>
    </div>
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
    if (!reason) return;
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert("You must be signed in to report content.");
      return;
    }
    
    setLoading(true);
    try {
      const selected = reasons.find(r => r.value === reason);
      await addDoc(collection(db, "report"), {
        reporterId: currentUser.uid,           // ID of the user submitting the report
        reporterName: currentUser.displayName || "Anonymous user", // Name of reporter
        reportedUserId: post.authorId,         // ID of the user who created the reported content
        reportedUserName: post.author?.name || "Unknown user", // Name of reported user
        postId: post.id,
        contentType: "post",
        contentSnapshot: {                     // Save snapshot of reported content
          title: post.title || "",
          details: post.details || "",
          location: post.location || "",
        },
        reason,
        reasonLabel: selected?.label || reason,
        details,
        priority: selected?.priority || "Low",
        status: "pending",
        reviewedBy: null,                      // Admin who reviews this report
        reviewNotes: null,                     // Admin review notes
        reviewedAt: null,                      // When review happened
        createdAt: serverTimestamp(),          // When report was created
      });
      setShowSuccess(true);
      
      // Also log this action for moderation history
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
      } catch (logErr) {
        console.error("Failed to log moderation action:", logErr);
        // Non-blocking error - main report was still created
      }
      
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 2200);
    } catch (err) {
      alert("Failed to submit report.");
      console.error(err);
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

function CommentActionMenu({ comment, onEdit, onDelete }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const currentUser = auth.currentUser;
  const isOwner = currentUser && comment.userId === currentUser.uid;
  
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
        aria-label="Comment options"
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

function CommentModal({ post, onClose, onCountChange }) {
  // Existing states
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [reportingComment, setReportingComment] = useState(null);
  // Add these new states
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState("");
  const textareaRef = useRef(null);
  const editTextareaRef = useRef(null);

  const getInitials = (name = "User") =>
    name.trim().split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase();

  const timeAgo = (ms) => {
    if (!ms) return "just now";
    const s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  };

  // NEW: absolute time formatter
  const formatAbsolute = (ms) => {
    if (!ms) return "";
    const d = new Date(ms);
    return d.toLocaleString();
  };

  // autosize textarea
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

  // realtime comments + hydrate missing user photos
  useEffect(() => {
    const q = query(collection(db, "comments"), where("postId", "==", post.id));
    const unsub = onSnapshot(
      q,
      async (snap) => {
        let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        items.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return ta - tb;
        });

        // fetch profile pictures for comments missing userPhoto (with cache), batched by 10
        const uidsAll = [...new Set(items.filter(c => !c.userPhoto && c.userId).map(c => c.userId))];
        const uidsToFetch = uidsAll.filter(uid => !userPhotoCache.has(uid));
        if (uidsToFetch.length) {
          const userCol = collection(db, "users");
          for (let i = 0; i < uidsToFetch.length; i += 10) {
            const chunk = uidsToFetch.slice(i, i + 10);
            const qUsers = query(userCol, where(documentId(), "in", chunk));
            const snap2 = await getDocs(qUsers);
            const seen = new Set();
            snap2.forEach(s => {
              seen.add(s.id);
              userPhotoCache.set(s.id, s.data()?.profilePicture || null);
            });
            chunk.forEach(uid => {
              if (!seen.has(uid)) userPhotoCache.set(uid, null);
            });
          }
        }

        items = items.map(c =>
          c.userPhoto ? c : { ...c, userPhoto: userPhotoCache.get(c.userId) ?? null }
        );

        setComments(items);
        setFetching(false);
        onCountChange?.(items.length);
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

  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        console.warn("Sign-in required to comment.");
        return;
      }

      // Quick photo: avoid extra Firestore read on submit
      const userPhoto = user.photoURL || null;

      // Optimistic UI: append immediately
      const nowMs = Date.now();
      const optimistic = {
        id: `temp-${nowMs}`,
        postId: post.id,
        userId: user.uid,
        userName: user.displayName || "Anonymous",
        userPhoto,
        text: text.trim(),
        hearts: 0,
        heartedBy: [],
        createdAtClient: nowMs,
        pending: true
      };
      setComments(prev => [...prev, optimistic]);
      onCountChange?.((comments?.length || 0) + 1);

      // Firestore write
      await addDoc(collection(db, "comments"), {
        postId: post.id,
        userId: user.uid,
        userName: user.displayName || "Anonymous",
        userPhoto,
        text: text.trim(),
        hearts: 0,
        heartedBy: [],
        createdAt: serverTimestamp()
      });

      // Bump post's comment count (non-blocking)
      updateDoc(doc(db, "community", post.id), { comments: increment(1) }).catch(() => {});

      // Reset composer fast
      setText("");
      textareaRef.current?.focus();
    } catch (err) {
      console.error("Failed to post comment:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleHeart(c) {
    const user = auth.currentUser;
    if (!user) {
      console.warn("Sign-in required to heart comments.");
      return;
    }
    try {
      const ref = doc(db, "comments", c.id);
      const hasHeart = c.heartedBy?.includes(user.uid);
      await updateDoc(ref, hasHeart
        ? { hearts: Math.max((c.hearts || 1) - 1, 0), heartedBy: arrayRemove(user.uid) }
        : { hearts: (c.hearts || 0) + 1, heartedBy: arrayUnion(user.uid) }
      );
    } catch (err) {
      console.error("Failed to update heart:", err);
    }
  }

  const onComposerKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Add delete comment function
  async function handleDeleteComment(commentId) {
    try {
      await deleteDoc(doc(db, "comments", commentId));
      await updateDoc(doc(db, "community", post.id), { comments: increment(-1) });
      setComments(prev => prev.filter(c => c.id !== commentId));
      onCountChange?.(comments.length - 1);
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  }
  
  // Add edit comment function
  async function handleEditComment(comment) {
    if (editText.trim() === comment.text || !editText.trim() || loading) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "comments", comment.id), {
        text: editText.trim(),
        edited: true,
        updatedAt: serverTimestamp()
      });
      setEditingComment(null);
      setEditText("");
    } catch (err) {
      console.error("Failed to edit comment:", err);
    } finally {
      setLoading(false);
    }
  }
  
  // When a comment is set for editing, set the text
  useEffect(() => {
    if (editingComment) {
      setEditText(editingComment.text);
    }
  }, [editingComment]);
  
  // Setup autosize for edit textarea
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
        <div className="community-modal cmt-modal" onClick={(e) => e.stopPropagation()}>
          <div className="share-modal-header cmt-header">
            <h3>
              Comments <span className="cmt-count">({comments.length})</span>
            </h3>
            <button className="cmt-close" onClick={onClose} aria-label="Close" type="button">×</button>
          </div>

          <div className="cmt-list">
            {fetching ? (
              <div className="cmt-skeleton">
                <div className="cmt-skel-row" />
                <div className="cmt-skel-row" />
                <div className="cmt-skel-row" />
              </div>
            ) : comments.length === 0 ? (
              <div className="cmt-empty">No comments yet.</div>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="cmt-item">
                  <div className="cmt-avatar" aria-hidden="true">
                    {c.userPhoto ? <img src={c.userPhoto} alt={c.userName || "User"} /> : getInitials(c.userName)}
                  </div>
                  <div className="cmt-content">
                    <div className="cmt-meta">
                      <span className="cmt-name">{c.userName}</span>
                      <span className="cmt-dot">•</span>
                      <span className="cmt-time">
                        {timeAgo(c.createdAt?.toMillis?.() ?? c.createdAtClient)}
                        <span className="cmt-time-abs"> • {formatAbsolute(c.createdAt?.toMillis?.() ?? c.createdAtClient)}</span>
                        {c.edited && <span className="cmt-edited"> (edited)</span>}
                      </span>
                    </div>
                    
                    {editingComment?.id === c.id ? (
                      <div className="cmt-edit-form">
                        <textarea
                          ref={editTextareaRef}
                          className="cmt-input"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          maxLength={500}
                        />
                        <div className="cmt-edit-actions">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setEditingComment(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => handleEditComment(c)}
                            disabled={!editText.trim() || editText.trim() === c.text || loading}
                          >
                            {loading ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="cmt-text">{c.text}</div>
                    )}
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CommentActionMenu
                      comment={c}
                      onEdit={() => setEditingComment(c)}
                      onDelete={() => handleDeleteComment(c.id)}
                    />
                    <button
                      type="button"
                      className={`cmt-heart ${c.heartedBy?.includes(auth.currentUser?.uid) ? "is-on" : ""}`}
                      onClick={() => handleHeart(c)}
                      title="Heart this comment"
                    >
                      <span>❤️</span>
                      <b>{c.hearts || 0}</b>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <form className="cmt-composer" onSubmit={handleSubmit}>
            <textarea
              ref={textareaRef}
              className="cmt-input"
              rows={1}
              placeholder="Write a comment… (Enter to send, Shift+Enter for newline)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onComposerKeyDown}
              maxLength={500}
              required
            />
            <div className="cmt-actions">
              <span className="cmt-countdown">{text.length}/500</span>
              <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
              <button type="submit" className="btn-primary" disabled={!text.trim() || loading}>
                {loading ? "Posting…" : "Post"}
              </button>
            </div>
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
    if (!reason) return;
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert("You must be signed in to report content.");
      return;
    }
    
    setLoading(true);
    try {
      const selected = reasons.find(r => r.value === reason);
      await addDoc(collection(db, "report"), {
        reporterId: currentUser.uid,           // ID of user submitting report
        reporterName: currentUser.displayName || "Anonymous user", // Name of reporter
        reportedUserId: comment.userId,        // ID of user who created reported content
        reportedUserName: comment.userName || "Unknown user", // Name of reported user
        postId: post.id,                       // Parent post ID
        commentId: comment.id,
        contentType: "comment",
        contentSnapshot: {                     // Save snapshot of reported content
          text: comment.text || "",
          createdAt: comment.createdAt || null,
        },
        reason,
        reasonLabel: selected?.label || reason,
        details,
        priority: selected?.priority || "Low",
        status: "pending",
        reviewedBy: null,                      // Admin who reviews this report
        reviewNotes: null,                     // Admin review notes
        reviewedAt: null,                      // When review happened
        createdAt: serverTimestamp(),          // When report was created
      });
      setShowSuccess(true);
      
      // Also log this action for moderation history
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
      } catch (logErr) {
        console.error("Failed to log moderation action:", logErr);
        // Non-blocking error - main report was still created
      }
      
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 2200);
    } catch (err) {
      alert("Failed to submit report.");
      console.error(err);
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

// Add this component for editing a post
function EditPostModal({ post, onClose, onUpdate }) {
  const [caption, setCaption] = useState(post.details || "");
  const [location, setLocation] = useState(post.location || "");
  const [duration, setDuration] = useState(post.duration || "");
  const [budget, setBudget] = useState(post.budget || "");
  const [highlights, setHighlights] = useState(post.highlights || "");
  const [loading, setLoading] = useState(false);
  const [visibility, setVisibility] = useState(post.visibility || "Public");

  const canSave = caption.trim().length > 0 || location;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave || loading) return;
    
    setLoading(true);
    try {
      const postRef = doc(db, "community", post.id);
      
      await updateDoc(postRef, {
        details: caption.trim(),
        location,
        duration,
        budget,
        highlights,
        visibility,
        title: caption.split("\n")[0].slice(0, 80) || "Shared Adventure",
        updatedAt: serverTimestamp()
      });
      
      onUpdate({
        ...post,
        details: caption.trim(),
        location,
        duration,
        budget,
        highlights,
        visibility,
        title: caption.split("\n")[0].slice(0, 80) || "Shared Adventure"
      });
      
      onClose();
    } catch (err) {
      console.error("Failed to update post:", err);
      alert("Failed to update post: " + (err.code || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="community-modal-backdrop" onClick={onClose}>
      <div className="community-modal" onClick={e => e.stopPropagation()}>
        <div className="share-modal-header">
          <h3>Edit Your Post</h3>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="modal-label">
            <span className="field-title">📍 Location</span>
            <select
              className="modal-input"
              value={location}
              onChange={e => setLocation(e.target.value)}
            >
              <option value="">Select Province/City</option>
              <option>Metro Manila</option>
              <option>Cebu</option>
              <option>Bohol</option>
              <option>Palawan</option>
              <option>Siargao</option>
              <option>Baguio</option>
              <option>Davao</option>
            </select>
          </label>

          <label className="modal-label">
            <span className="field-title">Who can see this?</span>
            <div className="segmented" role="group" aria-label="Post visibility">
              {["Public", "Friends", "Only Me"].map(opt => (
                <button
                  key={opt}
                  type="button"
                  className={`seg-btn${visibility === opt ? " is-active" : ""}`}
                  onClick={() => setVisibility(opt)}
                >
                  {opt === "Public" ? "🌐 Public" : opt === "Friends" ? "👥 Friends" : "🔒 Only Me"}
                </button>
              ))}
            </div>
          </label>

          <label className="modal-label">
            <span className="field-title">📝 Caption</span>
            <textarea
              className="modal-textarea"
              rows={4}
              placeholder="Share your experience... What made this trip special?"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              maxLength={1000}
            />
          </label>

          <div className="modal-row">
            <label className="modal-label">
              <span className="field-title">📅 Duration</span>
              <input
                className="modal-input"
                placeholder="e.g., 3 days"
                value={duration}
                onChange={e => setDuration(e.target.value)}
              />
            </label>
            <label className="modal-label">
              <span className="field-title">💰 Budget</span>
              <input
                className="modal-input"
                placeholder="e.g., ₱15,000"
                value={budget}
                onChange={e => setBudget(e.target.value)}
              />
            </label>
          </div>

          <label className="modal-label">
            <span className="field-title">🗺️ Itinerary Highlights</span>
            <textarea
              className="modal-textarea"
              rows={3}
              placeholder="Day 1: Arrival, Day 2: Island hopping, etc."
              value={highlights}
              onChange={e => setHighlights(e.target.value)}
              maxLength={1000}
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={!canSave || loading}>
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const Community = () => {
  const [posts, setPosts] = useState(initialPosts);
  const [open, setOpen] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // NEW: track current user's friends and add-in-progress
  const [friends, setFriends] = useState(new Set());
  const [addingFriendId, setAddingFriendId] = useState(null);
  const [reportingPost, setReportingPost] = useState(null);
  const [commentingPost, setCommentingPost] = useState(null); // NEW
  const [editingPost, setEditingPost] = useState(null);
  const [deletingPost, setDeletingPost] = useState(null);
  
  // NEW: load current user's friends
  async function loadFriendsForUser(user) {
    if (!user) {
      setFriends(new Set());
      return;
    }
    const snap = await getDocs(collection(db, "users", user.uid, "friends"));
    setFriends(new Set(snap.docs.map(d => d.id)));
  }

  async function loadPostsForUser(user) {
    setIsLoading(true);
    try {
      const col = collection(db, "community");
      const [pubSnap, ownSnap, friendsSnap] = await Promise.all([
        getDocs(query(col, where("visibility", "==", "Public"))),
        user ? getDocs(query(col, where("authorId", "==", user.uid))) : Promise.resolve({ docs: [] }),
        user ? getDocs(query(col, where("visibility", "==", "Friends"), where("allowedUids", "array-contains", user.uid))) : Promise.resolve({ docs: [] }),
      ]);

      const map = new Map();
      [...pubSnap.docs, ...ownSnap.docs, ...friendsSnap.docs].forEach(d => {
        map.set(d.id, { id: d.id, ...d.data() });
      });
      const postsArr = Array.from(map.values());

      const authorIds = [...new Set(postsArr.map(p => p.authorId).filter(Boolean))];

      const authorProfiles = {};
      const requestedByMe = {};

      if (authorIds.length > 0) {
        const userCol = collection(db, "users");
        for (let i = 0; i < authorIds.length; i += 10) {
          const chunk = authorIds.slice(i, i + 10);
          const qUsers = query(userCol, where(documentId(), "in", chunk));
          const snap = await getDocs(qUsers);

          const seen = new Set();
          snap.forEach((s) => {
            const data = s.data() || {};
            const uid = s.id;
            const photo = data.profilePicture || "/user.png";
            authorProfiles[uid] = photo;
            userPhotoCache.set(uid, photo);
            if (user) {
              requestedByMe[uid] = Array.isArray(data.friendRequests) && data.friendRequests.includes(user.uid);
            }
            seen.add(uid);
          });

          // Defaults for any IDs not returned (deleted/missing)
          chunk.forEach(uid => {
            if (!seen.has(uid)) {
              authorProfiles[uid] = "/user.png";
              if (user) requestedByMe[uid] = false;
            }
          });
        }
      }

      const postsWithMeta = postsArr.map(post => ({
        ...post,
        profilePicture: authorProfiles[post.authorId] || "/user.png",
        requestedByMe: user ? !!requestedByMe[post.authorId] : false,
      }));

      postsWithMeta.sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });

      setPosts(postsWithMeta);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let unsubFriends = null;
    const unsub = onAuthStateChanged(auth, (user) => {
      loadPostsForUser(user);

      if (unsubFriends) {
        unsubFriends();
        unsubFriends = null;
      }

      if (user) {
        const friendsRef = collection(db, "users", user.uid, "friends");
        unsubFriends = onSnapshot(friendsRef, (snap) => {
          setFriends(new Set(snap.docs.map(d => d.id)));
        });
      } else {
        setFriends(new Set());
      }
    });
    return () => {
      unsub();
      if (unsubFriends) unsubFriends();
    };
  }, []);

  const handleCreate = () => loadPostsForUser(auth.currentUser);

  const hasPosts = useMemo(() => posts.length > 0, [posts]);

  // NEW: add friend (mutual)
  async function handleAddFriend(targetUid) {
    const me = auth.currentUser;
    if (!me) {
      alert("Please sign in to add friends.");
      return;
    }
    if (!targetUid || targetUid === me.uid || friends.has(targetUid)) return;

    try {
      setAddingFriendId(targetUid);
      const targetRef = doc(db, "users", targetUid);
      await updateDoc(targetRef, { friendRequests: arrayUnion(me.uid) });
      // Fallback if user doc missing
      // await setDoc(targetRef, { friendRequests: [me.uid] }, { merge: true });

      // Reflect locally
      setPosts(prev => prev.map(p => p.authorId === targetUid ? { ...p, requestedByMe: true } : p));
    } catch (e) {
      console.error("Send request failed:", e);
      alert("Failed to send friend request.");
    } finally {
      setAddingFriendId(null);
    }
  }

  // NEW: like toggle for posts (saves count and who liked)
  async function handleLike(post) {
    const user = auth.currentUser;
    if (!user) {
      alert("Please sign in to like posts.");
      return;
    }
    const postRef = doc(db, "community", post.id);
    const liked = post.likedBy?.includes?.(user.uid);
    try {
      await updateDoc(postRef, liked
        ? { likes: increment(-1), likedBy: arrayRemove(user.uid) }
        : { likes: increment(1), likedBy: arrayUnion(user.uid) }
      );
      // local optimistic update
      setPosts(prev => prev.map(p => p.id === post.id
        ? {
            ...p,
            likes: Math.max((p.likes || 0) + (liked ? -1 : 1), 0),
            likedBy: liked
              ? (p.likedBy || []).filter(uid => uid !== user.uid)
              : ([...(p.likedBy || []), user.uid])
          }
        : p));
    } catch (e) {
      console.error("Failed to toggle like:", e);
      alert("Failed to like the post.");
    }
  }

  // Add delete post function
  const handleDeletePost = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post? This cannot be undone.")) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, "community", postId));
      // Remove from local state
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err) {
      console.error("Failed to delete post:", err);
      alert("Failed to delete post. Please try again.");
    }
  };
  
  // Add update post function
  const handleUpdatePost = (updatedPost) => {
    setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
  };
  
  return (
    <>
      {/* Loading Overlay */}
      {isLoading && (
        <div className="cm-loading-backdrop">
          <div className="cm-loading-card">
            <div className="cm-spinner" />
            <div className="cm-loading-title">Loading community feed…</div>
            <div className="cm-skeleton-row">
              <div className="cm-skel-card" />
              <div className="cm-skel-card" />
              <div className="cm-skel-card" />
            </div>
          </div>
        </div>
      )}

      <div className="community-bg">
        <div className="community-container">
          <div className="community-header">
            <div className="community-title">
              <span className="title-emoji">🌍</span> Community Feed
            </div>
            <div className="header-actions">
              <button className="btn-friend" onClick={() => setShowFriends(true)}>
                Friend Settings
              </button>
              <button className="btn-primary" onClick={() => setOpen(true)}>
                Share Trip
              </button>
            </div>
          </div>

          {!hasPosts && (
            <div className="community-empty">
              <div className="empty-badge">🗺️</div>
              <h3>No trips yet</h3>
              <p>Be the first to inspire others. Share your travel highlights and tips.</p>
            </div>
          )}

          {hasPosts && (
            <div className="community-list">
              {posts.map(post => (
                <article className="community-card card-popup" key={post.id}>
                  <header className="card-head">
                    <div className="avatar" style={{
                      width: 40, height: 40, borderRadius: "50%", overflow: "hidden", background: "#f3f4f6"
                    }}>
                      <img
                        src={post.profilePicture || "/user.png"}
                        alt={post.authorName || "User"}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <div className="meta">
                      <div className="name">{post.author?.name || "Anonymous"}</div>
                      <div className="sub">
                        {post.location ? <>📍 {post.location}</> : "Shared a trip"}
                        {post.budget ? <span className="dot">•</span> : null}
                        {post.budget ? <>Budget: {post.budget}</> : null}
                        {post.duration ? <span className="dot">•</span> : null}
                        {post.duration ? <>{post.duration}</> : null}
                        {post.visibility ? <span className="dot">•</span> : null}
                        {post.visibility ? <>{post.visibility}</> : null}
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
                          !auth.currentUser ||
                          auth.currentUser.uid === post.authorId ||
                          friends.has(post.authorId) ||
                          post.requestedByMe ||
                          addingFriendId === post.authorId
                        }
                      >
                        {auth.currentUser?.uid === post.authorId
                          ? "You"
                          : friends.has(post.authorId)
                            ? "Friends"
                            : post.requestedByMe
                              ? "Requested"
                              : addingFriendId === post.authorId
                                ? "Sending..."
                                : "+ Add Friend"}
                      </button>
                      <button
                        className="report-btn"
                        onClick={() => setReportingPost(post)}
                      >
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
                        color: post.likedBy?.includes?.(auth.currentUser?.uid) ? "#ef4444" : undefined,
                        fontWeight: 700
                      }}
                    >
                      <span>❤️</span> {post.likes || 0}
                    </button>
                    <button
                      className="act"
                      onClick={() => setCommentingPost(post)}
                    >
                      <span>💬</span> {post.comments || 0}
                    </button>
                    <button className="act"><span>📌</span> Save</button>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </div>

        {open && (
          <ShareTripModal onClose={() => setOpen(false)} onCreate={handleCreate} />
        )}
        {showFriends && (
          <FriendPopup onClose={() => setShowFriends(false)} />
        )}
        {reportingPost && (
          <ReportPostModal
            post={reportingPost}
            onClose={() => setReportingPost(null)}
          />
        )}
        {commentingPost && (
          <CommentModal
            post={commentingPost}
            onClose={() => setCommentingPost(null)}
            onCountChange={(count) =>
              setPosts(prev =>
                prev.map(p => p.id === commentingPost.id ? { ...p, comments: count } : p)
              )
            }
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
    </>
  );
};

export default Community;

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