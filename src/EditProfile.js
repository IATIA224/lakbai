import React, { useState } from "react";
import axios from "axios";
import "./EditProfile.css";
import { doc, updateDoc } from "firebase/firestore";
import { db, auth } from "./firebase"; // Make sure db and auth are exported from firebase.js

const interestsList = [
  { icon: "🏄‍♂️", label: "Surfer", color: "#e0f7fa" },
  { icon: "🎒", label: "Backpacker", color: "#f3e8ff" },
  { icon: "🍜", label: "Foodie Traveler", color: "#fffbe6" },
  { icon: "🏛️", label: "Culture Seeker", color: "#ede9fe" },
  { icon: "⚡", label: "Adventure Junkie", color: "#fee2e2" },
  { icon: "🌿", label: "Nature Enthusiast", color: "#e7fbe7" },
  { icon: "💻", label: "Digital Nomad", color: "#e0f2fe" },
  { icon: "🚗", label: "Road Tripper", color: "#fef3c7" },
  { icon: "🏖️", label: "Beach Lover", color: "#e0e7ff" },
  { icon: "🏙️", label: "City Explorer", color: "#f7f8fa" },
  { icon: "📸", label: "Photographer", color: "#f3f4f6" },
  { icon: "🏺", label: "Historian", color: "#e6fffa" },
  { icon: "🎉", label: "Festival Hopper", color: "#ffe4e6" },
  { icon: "🥾", label: "Hiker", color: "#dcfce7" },
  { icon: "💎", label: "Luxury Traveler", color: "#f0f5ff" },
  { icon: "🌱", label: "Eco-Traveler", color: "#e6fffa" },
  { icon: "🛳️", label: "Cruise Lover", color: "#e0e7ff" },
  { icon: "⛷️", label: "Winter Sports Enthusiast", color: "#e0f2fe" },
  { icon: "🧳", label: "Solo Wanderer", color: "#fef3c7" }
];

const MAX_BIO = 300;

const EditProfile = ({ onClose, onProfileUpdate, initialData = {} }) => {
  const [photo, setPhoto] = useState(null);
  const [photoFile, setPhotoFile] = useState(null); // <-- store file
  const [name, setName] = useState(initialData.name || "");
  const [bio, setBio] = useState(initialData.bio || "");
  const [interests, setInterests] = useState(
    initialData.interests ||
      interestsList.map(i => ({ ...i, status: null }))
  );
  const [saving, setSaving] = useState(false);

  // Toggle status: null -> like (green) -> dislike (red) -> null
  const handleInterestClick = (idx) => {
    setInterests(interests =>
      interests.map((i, iIdx) => {
        if (iIdx !== idx) return i;
        if (i.status === null) return { ...i, status: "like" };
        if (i.status === "like") return { ...i, status: "dislike" };
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

      // Likes and dislikes
      const likes = interests.filter(i => i.status === "like").map(i => i.label);
      const dislikes = interests.filter(i => i.status === "dislike").map(i => i.label);

      // Build update object with only changed fields
      const updateData = {};

      // Only update name if it's changed and not empty
      if (name && name.trim() !== (initialData.name || "")) {
        updateData.name = name.trim();
      }

      // Only update bio if it's changed
      if (bio !== (initialData.bio || "")) {
        updateData.bio = bio;
      }

      // Only update profile picture if a new file was selected
      if (photoFile) {
        updateData.profilePicture = await uploadToCloudinary(photoFile);
      }

      // Only update interests if they changed
      if (JSON.stringify(likes) !== JSON.stringify(initialData.likes || [])) {
        updateData.likes = likes;
      }
      if (JSON.stringify(dislikes) !== JSON.stringify(initialData.dislikes || [])) {
        updateData.dislikes = dislikes;
      }

      // If no changes, just close
      if (Object.keys(updateData).length === 0) {
        if (onClose) onClose();
        setSaving(false);
        return;
      }

      await updateDoc(doc(db, "users", user.uid), updateData);

      // Call the profile update callback to trigger achievement
      if (onProfileUpdate) onProfileUpdate();

      if (onClose) onClose();
    } catch (err) {
      alert("Failed to save profile: " + err.message);
    }
    setSaving(false);
  };

  return (
    <div className="edit-profile-modal">
      <div className="edit-profile-header">
        <span>Edit Travel Profile</span>
        <button className="edit-profile-close" onClick={onClose}>×</button>
        <div className="edit-profile-sub">Customize your adventure identity</div>
      </div>
      <div className="edit-profile-content">
        <div className="edit-profile-left">
          <div className="edit-profile-avatar">
            <label htmlFor="profile-photo-upload" className="edit-profile-avatar-label">
              {photo ? (
                <img src={photo} alt="Profile" className="edit-profile-avatar-img" />
              ) : (
                <img
                  src="/user.png"
                  alt="Profile"
                  className="edit-profile-avatar-img"
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: "50%",
                    objectFit: "cover",
                    background: "#f3f4f6"
                  }}
                />
              )}
              <input
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
            Travel Name
            <input
              type="text"
              className="edit-profile-input"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={40}
              placeholder="John Doe"
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
          </div>
          <div className="edit-profile-interests-list" style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", overflowX: "hidden"}}>
            {interests.map((interest, idx) => {
              let bgColor = interest.color;
              if (interest.status === "like") bgColor = "#d1fae5"; // green
              if (interest.status === "dislike") bgColor = "#fee2e2"; // red
              return (
                <div
                  key={interest.label}
                  className="edit-profile-interest"
                  style={{
                    background: bgColor,
                    cursor: "pointer",
                    transition: "background 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    border: interest.status ? "2px solid #6c63ff" : "2px solid transparent",
                    minHeight: "48px",
                    borderRadius: "12px",
                    padding: "12px 16px",
                    fontSize: "1.08rem",
                    fontWeight: "500",
                    boxShadow: "0 2px 8px rgba(108,99,255,0.07)",
                    userSelect: "none"
                  }}
                  onClick={() => handleInterestClick(idx)}
                >
                  <span className="edit-profile-interest-icon">{interest.icon}</span>
                  <span className="edit-profile-interest-label">{interest.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="edit-profile-actions">
        <button className="edit-profile-cancel" onClick={onClose}>Cancel</button>
        <button className="edit-profile-save" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </div>
    </div>
  );
};

export default EditProfile;