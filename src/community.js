import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { addDoc, collection, serverTimestamp, getDocs, query, where, doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./firebase";
import { CLOUDINARY_CONFIG } from "./profile";
import FriendPopup from "./friend";
import "./community.css";
import { emitAchievement } from "./achievementsBus";

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
        imagesCount: postPayload.images.length
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

const Community = () => {
  const [posts, setPosts] = useState(initialPosts);
  const [open, setOpen] = useState(false);
  const [showFriends, setShowFriends] = useState(false);

  async function loadPostsForUser(user) {
    const col = collection(db, "community");

    // Fetch all posts in parallel
    const [pubSnap, ownSnap, friendsSnap] = await Promise.all([
      getDocs(query(col, where("visibility", "==", "Public"))),
      user ? getDocs(query(col, where("authorId", "==", user.uid))) : Promise.resolve({ docs: [] }),
      user ? getDocs(query(col, where("visibility", "==", "Friends"), where("allowedUids", "array-contains", user.uid))) : Promise.resolve({ docs: [] }),
    ]);

    // Combine and deduplicate posts
    const map = new Map();
    [...pubSnap.docs, ...ownSnap.docs, ...friendsSnap.docs].forEach(d => {
      map.set(d.id, { id: d.id, ...d.data() });
    });
    const postsArr = Array.from(map.values());

    // Collect all unique authorIds
    const authorIds = [...new Set(postsArr.map(post => post.authorId).filter(Boolean))];

    // Batch fetch all author profiles
    const authorProfiles = {};
    if (authorIds.length > 0) {
      const userCol = collection(db, "users");
      const authorSnaps = await Promise.all(
        authorIds.map(uid => getDoc(doc(userCol, uid)))
      );
      authorSnaps.forEach((snap, i) => {
        authorProfiles[authorIds[i]] = snap.exists() && snap.data().profilePicture
          ? snap.data().profilePicture
          : "/user.png";
      });
    }

    // Attach profilePicture to each post
    const postsWithPics = postsArr.map(post => ({
      ...post,
      profilePicture: authorProfiles[post.authorId] || "/user.png"
    }));

    // Sort by date
    postsWithPics.sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });

    setPosts(postsWithPics);
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      loadPostsForUser(user);
    });
    return () => unsub();
  }, []);

  const handleCreate = () => loadPostsForUser(auth.currentUser);

  const hasPosts = useMemo(() => posts.length > 0, [posts]);

  return (
    <>
      <div className="community-bg">
        <div className="community-container">
          <div className="community-header">
            <div className="community-title">
              <span className="title-emoji">🌍</span> Community Feed
            </div>
            <div className="header-actions">
              <button className="btn-friend" onClick={() => setShowFriends(true)}>
                + Add Friend
              </button>
              <button className="btn-primary" onClick={() => setOpen(true)}>
                + Share Trip
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
                <article className="community-card" key={post.id}>
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
                    <button className="add-friend">+ Add Friend</button>
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
                    <button className="act"><span>❤️</span> {post.likes}</button>
                    <button className="act"><span>💬</span> {post.comments}</button>
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

// anywhere in the app when an achievement is unlocked
emitAchievement("Say Cheese! Achievement Unlocked! 🎉");