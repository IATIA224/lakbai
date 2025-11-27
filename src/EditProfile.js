import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import axios from "axios";
import "./EditProfile.css";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from './firebase'; // ensure available
import { doc as fsDoc, getDoc, updateDoc as fsUpdateDoc, arrayRemove } from 'firebase/firestore';


const interestsList = [
  { icon: "🏄‍♂️", label: "Surfer", color: "rgba(99,102,241,0.12)" },
  { icon: "🎒", label: "Backpacker", color: "rgba(96,165,250,0.10)" },
  { icon: "🍜", label: "Foodie Traveler", color: "rgba(250,204,21,0.12)" },
  { icon: "🏛️", label: "Culture Seeker", color: "rgba(124,58,237,0.10)" },
  { icon: "⚡", label: "Adventure Junkie", color: "rgba(34,197,94,0.08)" },
  { icon: "🌿", label: "Nature Enthusiast", color: "rgba(16,185,129,0.08)" },
  { icon: "💻", label: "Digital Nomad", color: "rgba(99,102,241,0.07)" },
  { icon: "🚗", label: "Road Tripper", color: "rgba(234,88,12,0.07)" },
  { icon: "🏖️", label: "Beach Lover", color: "rgba(56,189,248,0.08)" },
  { icon: "🏙️", label: "City Explorer", color: "rgba(168,85,247,0.08)" },
  { icon: "📸", label: "Photographer", color: "rgba(245,158,11,0.08)" },
  { icon: "🏺", label: "Historian", color: "rgba(94,234,212,0.06)" },
  { icon: "🎉", label: "Festival Hopper", color: "rgba(236,72,153,0.07)" },
  { icon: "🥾", label: "Hiker", color: "rgba(34,197,94,0.07)" },
  { icon: "💎", label: "Luxury Traveler", color: "rgba(99,102,241,0.07)" },
  { icon: "🌱", label: "Eco-Traveler", color: "rgba(34,197,94,0.06)" },
  { icon: "🛳️", label: "Cruise Lover", color: "rgba(56,189,248,0.07)" },
  { icon: "🧳", label: "Solo Wanderer", color: "rgba(168,85,247,0.06)" }
];

const MAX_BIO = 300;

const EditProfile = ({ onClose, onProfileUpdate, initialData = {} }) => {
  const [photo, setPhoto] = useState(null);
  const [photoFile, setPhotoFile] = useState(null); // <-- store file
  const [name, setName] = useState(initialData.name || "");
  const [randomPlaceholder] = useState(() => `User${Math.floor(10000 + Math.random() * 90000)}`);
  const [bio, setBio] = useState(initialData.bio || "");
  // if initialData.interests is an empty array, fall back to default interestsList
  const [interests, setInterests] = useState(
    Array.isArray(initialData.interests) && initialData.interests.length
      ? initialData.interests
      : interestsList.map(i => ({ ...i, status: null }))
  );

  // ADD: active interests from Firestore (used only for border + one-click removal)
  const [activeInterests, setActiveInterests] = useState(() => {
    const arr = Array.isArray(initialData.interests) ? initialData.interests : [];
    const labels = arr.map(v => (typeof v === 'string' ? v : v?.label)).filter(Boolean);
    return new Set(labels);
  });
  const [saving, setSaving] = useState(false);

  // Toggle status: null -> like -> dislike -> null
  // UPDATED: if the clicked interest is already active (has border), remove it from Firestore
  const handleInterestClick = async (idx) => {
    const clicked = interests[idx];
    const label = clicked?.label;
    if (!label) return;

    // If this interest is active from Firestore, clicking removes it
    if (activeInterests.has(label)) {
      try {
        const u = auth.currentUser;
        if (!u) throw new Error('No user');
        await fsUpdateDoc(fsDoc(db, 'users', u.uid), { interests: arrayRemove(label) });
        setActiveInterests(prev => {
          const next = new Set(prev);
          next.delete(label);
          return next;
        });
      } catch (err) {
        console.error('Remove interest failed:', err);
        alert('Failed to remove interest. Please try again.');
      }
      return; // do not alter like/dislike when removing active
    }

    // Otherwise keep your existing like/dislike cycling
    setInterests(cur =>
      cur.map((i, iIdx) => {
        if (iIdx !== idx) return i;
        if (i.status === null) return { ...i, status: 'like' };
        if (i.status === 'like') return { ...i, status: 'dislike' };
        return { ...i, status: null };
      })
    );
  };

  // Update handlePhotoChange to store file
  const handlePhotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setPhoto(URL.createObjectURL(e.target.files[0]));
      setPhotoFile(e.target.files[0]);
    }
  };

  // Cloudinary upload function
  const uploadToCloudinary = async (file) => {
    const url = "https://api.cloudinary.com/v1_1/dxvewejox/image/upload";
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "dxvewejox"); // use your unsigned preset name

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Upload failed");
    return data.secure_url;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No user logged in");

      // Likes and dislikes from the UI
      const likes = interests.filter(i => i.status === "like").map(i => i.label);
      const dislikes = interests.filter(i => i.status === "dislike").map(i => i.label);

      // FINAL interests to store
      const finalInterests = Array.from(new Set([
        ...Array.from(activeInterests),
        ...likes
      ]));

      const updateData = {};

      // Only add fields that have actual values and have changed
      if (name && name.trim() !== (initialData.name || "")) {
        updateData.travelerName = name.trim();
      }
      if (bio !== (initialData.bio || "")) {
        updateData.bio = bio;
      }

      // profile picture
      if (photoFile) {
        updateData.profilePicture = await uploadToCloudinary(photoFile);
      }

      // interests
      const initialInterests = Array.isArray(initialData.interests) ? initialData.interests : [];
      if (JSON.stringify(finalInterests.sort()) !== JSON.stringify(initialInterests.sort())) {
        updateData.interests = finalInterests;
      }

      // dislikes
      if (JSON.stringify(dislikes.sort()) !== JSON.stringify((initialData.dislikes || []).sort())) {
        updateData.dislikes = dislikes;
      }

      // Filter out any undefined values (safety check)
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      if (Object.keys(updateData).length === 0) {
        if (onClose) onClose();
        setSaving(false);
        return;
      }

      // Use updateDoc to only update specified fields
      await updateDoc(doc(db, "users", user.uid), updateData);

      // Send updated interests to the email API
      await axios.post("/api/send-interests-email", {
        interests: finalInterests, // or the current interests array
      }, {
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
        }
      });

      if (onProfileUpdate) onProfileUpdate();
      if (onClose) onClose();
    } catch (err) {
      console.error("Save profile error:", err);
      alert("Failed to save profile: " + err.message);
    }
    setSaving(false);
  };

  // ADD: load the current user's interests once (keeps other logic untouched)
  React.useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return;
      try {
        const snap = await getDoc(fsDoc(db, 'users', u.uid));
        const raw = Array.isArray(snap.data()?.interests) ? snap.data().interests : [];
        const labels = raw.map(v => (typeof v === 'string' ? v : v?.label)).filter(Boolean);
        setActiveInterests(new Set(labels));
      } catch (e) {
        console.warn('Failed to load interests:', e);
      }
    });
    return () => typeof unsub === 'function' && unsub();
  }, []);

  // Lock body scroll while modal is open (same pattern as itinerary modal)
  useEffect(() => {
    document.body.classList.add("profile-modal-open");
    return () => {
      document.body.classList.remove("profile-modal-open");
    };
  }, []);

  // Close on Esc key
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Handler to clear all interests (likes/dislikes and active)
  const handleClearAllInterests = async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No user logged in");
      await updateDoc(doc(db, "users", user.uid), {
        interests: [],
        dislikes: [],
      });
      setActiveInterests(new Set());
      setInterests(interestsList.map(i => ({ ...i, status: null })));

      // --- SEND EMAIL NOTIFICATION ---
      await axios.post("/api/send-interests-email", {
        interests: [], // all cleared
      }, {
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
        }
      });
      // --- END EMAIL NOTIFICATION ---

      alert("All preferences cleared!");
      if (onProfileUpdate) onProfileUpdate();
    } catch (err) {
      console.error("Clear interests error:", err);
      alert("Failed to clear preferences: " + err.message);
    }
  };

  const modal = (
    <div className="edit-profile-backdrop" onClick={() => onClose?.()}>
      <div className="edit-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="edit-profile-header">
          <span>Edit Travel Profile</span>
          <div className="edit-profile-sub">Customize your adventure identity</div>
        </div>
        <div className="edit-profile-content">
          <div className="edit-profile-left">
            <div className="edit-profile-avatar">
              <label htmlFor="profile-photo-upload" className="edit-profile-avatar-label">
                {photo ? (
                  <img 
                    src={photo} 
                    alt="Profile" 
                    className="edit-profile-avatar-img"
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: "50%",
                      objectFit: "cover",
                      background: "#f3f4f6",
                      border: "3px solid #e5e7eb",
                      cursor: "pointer"
                    }}
                  />
                ) : initialData.profilePicture && initialData.profilePicture !== "/user.png" ? (
                  <img
                    src={initialData.profilePicture}
                    alt="Profile"
                    className="edit-profile-avatar-img"
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: "50%",
                      objectFit: "cover",
                      background: "#f3f4f6",
                      border: "3px solid #e5e7eb",
                      cursor: "pointer"
                    }}
                  />
                ) : (
                  <img
                    src="/prof.png"
                    alt="Default avatar"
                    className="edit-profile-avatar-img"
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: "50%",
                      objectFit: "cover",
                      background: "#f3f4f6",
                      border: "3px solid #e5e7eb",
                      cursor: "pointer"
                    }}
                  />
                )}
                <input
                  data-testid="photo-input"
                  id="profile-photo-upload"
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handlePhotoChange}
                />
              </label>
              <div className="edit-profile-avatar-change">Click to change photo</div>
            </div>
            <label className="edit-profile-label">
              Traveler Name
              <input
                type="text"
                className="edit-profile-input"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={40}
                placeholder={randomPlaceholder}
              />
            </label>
            <label className="edit-profile-label">
              Travel Bio
              <textarea
                className="edit-profile-textarea"
                value={bio}
                onChange={e => setBio(e.target.value.slice(0, MAX_BIO))}
                maxLength={MAX_BIO}
                rows={4}
                placeholder="Share something about your travel style..."
              />
              <div className="edit-profile-bio-count">
                {bio.length}/{MAX_BIO} characters
              </div>
            </label>
          </div>
          <div className="edit-profile-right">
            <div style={{ height: 12 }} /> {/* spacing between left and right */}
            <div className="edit-profile-interests-title">
              Travel Interests
              <div className="edit-profile-interests-sub">
                Click each interest to like (green) or dislike (red)
              </div>
              <button
                type="button"
                style={{
                  marginTop: 10,
                  marginBottom: 8,
                  background: "#f3f4f6",
                  color: "#6c63ff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "0.98rem",
                  float: "right"
                }}
                onClick={handleClearAllInterests}
              >
                Clear All Preferences
              </button>
            </div>
            <div className="edit-profile-interests-list" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', overflowX: 'hidden' }}>
              {interests.map((interest, idx) => {
                const active = interest.status === "like" || interest.status === "dislike";
                const background =
                  interest.status === "like"
                    ? "#d1fae5"
                    : interest.status === "dislike"
                    ? "#fee2e2"
                    : interest.color || "rgba(243,246,249,0.8)";

                return (
                  <div
                    key={interest.label}
                    className="edit-profile-interest"
                    data-colored={Boolean(interest.color)}
                    onClick={() => handleInterestClick(idx)}
                    style={{
                      background,
                      border: active ? "2px solid #6c63ff" : "1px solid rgba(16,24,40,0.04)",
                      boxShadow: active ? "0 6px 18px rgba(99,102,241,0.12)" : undefined,
                    }}
                  >
                    <span className="edit-profile-interest-dot" style={{ background: interest.color || "rgba(0,0,0,0.06)" }} />
                    <span className="edit-profile-interest-icon">{interest.icon}</span>
                    <span className="edit-profile-interest-label">{interest.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="edit-profile-actions">
          <button className="edit-profile-save" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </button>
          <button className="edit-profile-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
};

export default EditProfile;