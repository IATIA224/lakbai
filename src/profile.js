import React, { useState, useEffect, useMemo, useRef } from "react";
import ReactDOM from "react-dom";
// fix: use react-leaflet, not "react-g"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import EditProfile from "./EditProfile";
import InfoDelete from "./info_delete";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import "./profile.css";
import { v4 as uuidv4 } from "uuid"; // Install with: npm install uuid
import { useUser } from "./UserContext";
import { emitAchievement } from "./achievementsBus";
import { onAuthStateChanged } from "firebase/auth";
import { getUserCompletionStats } from './itinerary_Stats';

export const CLOUDINARY_CONFIG = {
  cloudName: "dxvewejox",
  uploadPreset: "dxvewejox",
};

// Helper: fix EXIF orientation + square crop for Cloudinary assets
const transformCloudinary = (url, { w = 120, h = 120 } = {}) => {
  if (!url) return "/placeholder.png";
  if (typeof url !== "string") return url;                   // guard against objects
  if (!url.includes("res.cloudinary.com")) return url;
  return url.replace(
    "/upload/",
    `/upload/c_fill,w_${w},h_${h},q_auto,f_auto,a_auto,g_auto/`
  );
};

const LABELS = {
  ALL_PHOTOS: "All Photos",
};

// Simple stats cache (5 minutes)
const PROFILE_STATS_CACHE_KEY = "lakbai_profile_stats";
const PROFILE_STATS_CACHE_MS = 5 * 60 * 1000;

function getCachedStats(userId) {
  try {
    const raw = localStorage.getItem(`${PROFILE_STATS_CACHE_KEY}_${userId}`);
    if (!raw) return null;
    const { ts, stats } = JSON.parse(raw);
    if (!ts || Date.now() - ts > PROFILE_STATS_CACHE_MS) {
      localStorage.removeItem(`${PROFILE_STATS_CACHE_KEY}_${userId}`);
      return null;
    }
    return stats;
  } catch {
    return null;
  }
}

function setCachedStats(userId, stats) {
  try {
    localStorage.setItem(
      `${PROFILE_STATS_CACHE_KEY}_${userId}`,
      JSON.stringify({ ts: Date.now(), stats })
    );
  } catch {}
}

const Profile = () => {
  // Replace this:
  // const { profile } = useUser();

  // With this local state that mirrors context (no context setter needed)
  const userContext = useUser();
  const ctxProfile = userContext?.profile ?? null;
  const [profile, setProfile] = useState(ctxProfile);
  useEffect(() => {
    setProfile(ctxProfile ?? null);
  }, [ctxProfile]);

  // Custom marker icon
  const customIcon = new L.Icon({
    iconUrl: "/placeholder.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [showInfoDelete, setShowInfoDelete] = useState(false);
  const [showShareCode, setShowShareCode] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [unlockedAchievements, setUnlockedAchievements] = useState(new Set());
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [activities, setActivities] = useState([]);
  // initialize friends as 0 so UI shows 0 immediately on refresh
  const [stats, setStats] = useState({
    placesVisited: 0,
    photosShared: 0,
    reviewsWritten: 0,
    friends: 0, // show 0 immediately, update later when authoritative count arrives
  });
  const [shareCode, setShareCode] = useState("");
  const [completedDestinations, setCompletedDestinations] = useState([]);
  const [friends, setFriends] = useState([]);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [moderationNotices, setModerationNotices] = useState([]); // ADD STATE (near other useState declarations)

  // Map state - simplified (no search)
  const [mapCenter, setMapCenter] = useState([12.8797, 121.774]);
  const [mapZoom, setMapZoom] = useState(6);

  // Function to fetch profile data
  const fetchProfile = async (uidParam, userObj) => {
    try {
      const uid = uidParam || userObj?.uid || auth.currentUser?.uid;
      if (!uid) return;

      const user = userObj || auth.currentUser || null;

      // Get Firestore profile
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      let data = docSnap.exists() ? docSnap.data() : {};

      // Joined date from Auth if available
      const joined =
        user?.metadata?.creationTime
          ? new Date(user.metadata.creationTime).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
            })
          : (data.joined || ""); // fallback to existing

      setProfile((prev) => ({
        ...prev,
        name: data.travelerName ?? prev?.travelerName ?? "",
        bio: data.bio ?? prev?.bio ?? "",
        profilePicture: data.profilePicture ?? prev?.profilePicture ?? "/user.png",
        // LIVE interests from 'interests' (fallback to legacy 'likes')
        interests: Array.isArray(data.interests)
          ? data.interests
          : (Array.isArray(data.likes) ? data.likes : (prev?.interests || [])),
        likes: Array.isArray(data.likes) ? data.likes : prev?.likes || [],
        dislikes: Array.isArray(data.dislikes) ? data.dislikes : prev?.dislikes || [],
      }));

      setShareCode(data.shareCode || "");

      // DON'T include reviewsWritten here - let the real-time listener handle it
      setStats((prev) => ({
        placesVisited: data.stats?.placesVisited || 0,
        photosShared: data.stats?.photosShared || 0,
        reviewsWritten: prev.reviewsWritten ?? 0,  // Keep existing value
        friends: prev.friends ?? 0,
      }));

      // Heavy reads in parallel (photos, activities)
      await Promise.all([
        (async () => {
          try {
            const photosQuery = query(collection(db, "photos"), where("userId", "==", uid));
            const photosSnapshot = await getDocs(photosQuery);
            setPhotos(photosSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
          } catch { setPhotos([]); }
        })(),
        (async () => {
          try {
            const activitiesQuery = query(collection(db, "activities"), where("userId", "==", uid));
            const activitiesSnapshot = await getDocs(activitiesQuery);
            setActivities(
              activitiesSnapshot.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 10)
            );
          } catch { setActivities([]); }
        })(),
      ]);

      // Replace friends count with subcollection size (authoritative)
      let friendsCount = undefined; // <-- define before use to avoid no-undef
      try {
        const friendsSnap = await getDocs(collection(db, "users", uid, "friends"));
        friendsCount = friendsSnap.size;
      } catch (e) {
        console.warn("Failed to read friends subcollection count:", e);
      }

      setStats((prev) => ({
        placesVisited: data.stats?.placesVisited || prev.placesVisited || 0,
        photosShared: data.stats?.photosShared || prev.photosShared || 0,
        reviewsWritten: prev.reviewsWritten ?? 0,  // Don't overwrite
        friends: typeof friendsCount === "number" ? friendsCount : prev.friends ?? 0,
      }));
    } catch (error) {
      console.error("Error fetching profile data:", error);
    }
  };

  // Add userId state and subscribe to auth state (critical for refresh)
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        fetchProfile(user.uid, user); // initial load as soon as Firebase restores session
      } else {
        setUserId(null);
        setProfile(null);
        setPhotos([]);
        setActivities([]);
        setStats({ placesVisited: 0, photosShared: 0, reviewsWritten: 0, friends: 0 });
        setShareCode("");
      }
    });
    return unsub;
  }, []);

  // Remove the old "Initial load (no overlay)" effect that used auth.currentUser
  // and replace it with a simple refetch whenever userId changes.
  useEffect(() => {
    if (userId) fetchProfile(userId);
  }, [userId]);

  // Real-time listener now depends on userId (not auth.currentUser?.uid)
  useEffect(() => {
    if (!userId) return;
    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();

      setProfile((prev) => ({
        ...prev,
        name: data.travelerName ?? prev?.travelerName ?? "",
        bio: data.bio ?? prev?.bio ?? "",
        profilePicture: data.profilePicture ?? prev?.profilePicture ?? "/user.png",
        likes: Array.isArray(data.likes) ? data.likes : prev?.likes || [],
        dislikes: Array.isArray(data.dislikes) ? data.dislikes : prev?.dislikes || [],
      }));

      // do NOT set friends here — preserve null/authoritative value from friends listener
      setStats((prev) => ({
        placesVisited: data.stats?.placesVisited ?? prev.placesVisited,
        photosShared: data.stats?.photosShared ?? prev.photosShared,
        reviewsWritten: data.stats?.reviewsWritten ?? prev.reviewsWritten,
        friends: prev.friends,
      }));
    });

    return () => unsubscribe();
  }, [userId]);

  // authoritative friends count from the friends subcollection, with cleanup
  useEffect(() => {
    if (!userId) return;
    const friendsCol = collection(db, "users", userId, "friends");
    const unsubscribe = onSnapshot(friendsCol, async (snap) => {
      const friends = snap.docs;
      const friendIds = friends.map(doc => doc.id);
      
      // Verify each friend still exists
      const userDocsPromises = friendIds.map(id => getDoc(doc(db, "users", id)));
      const userDocsSnaps = await Promise.all(userDocsPromises);
      
      const staleFriendIds = [];
      let validFriendsCount = 0;

      userDocsSnaps.forEach((userSnap, index) => {
        if (userSnap.exists()) {
          validFriendsCount++;
        } else {
          staleFriendIds.push(friendIds[index]);
        }
      });

      // Update the UI immediately with the valid count
      setStats((prev) => ({ ...prev, friends: validFriendsCount }));

      // Clean up stale friend references in the background
      if (staleFriendIds.length > 0) {
        const deletePromises = staleFriendIds.map(id => deleteDoc(doc(db, "users", userId, "friends", id)));
        await Promise.all(deletePromises);
        console.log(`Cleaned up ${staleFriendIds.length} stale friend(s).`);
      }
    });
    return () => unsubscribe();
  }, [userId]);

  // After editing profile, refetch using userId (auth.currentUser may still be null briefly on hard refresh)
  useEffect(() => {
    if (userId) fetchProfile(userId);
  }, [showEditProfile, userId]);

  const navigate = useNavigate();

  // Achievements data
  const ACHIEVEMENTS_DATA = {
    1: { title: "First Step", description: "Create your very first itinerary.", icon: "🎯", category: "Getting Started" },
    2: { title: "First Bookmark", description: "Save your first place to your favorites.", icon: "⭐", category: "Getting Started" },
    3: { title: "Say Cheese!", description: "Upload your first travel photo.", icon: "📸", category: "Getting Started" },
    4: { title: "Hello, World!", description: "Post your first comment on any itinerary or location.", icon: "💬", category: "Getting Started" },
    5: { title: "Profile Pioneer", description: "Complete your profile with a photo and bio.", icon: "👤", category: "Getting Started" },
    6: { title: "Mini Planner", description: "Add at least 3 places to a single itinerary.", icon: "🗺️", category: "Exploration & Planning" },
    7: { title: "Explorer at Heart", description: "View 10 different destinations in the app.", icon: "✈️", category: "Exploration & Planning" },
    8: { title: "Checklist Champ", description: 'Mark your first place as "visited".', icon: "✅", category: "Exploration & Planning" },
  };

  // Notification helper
  const showAchievementNotification = (message) => {
    emitAchievement(message);
  };

  // Unlock achievement (generic)
  const unlockAchievement = async (achievementId, achievementName) => {
    // Get current user
    const user = auth.currentUser;
    if (!user) return;

    // Check if already unlocked
    const snap = await getDoc(doc(db, "users", user.uid));
    const already =
      snap.exists() &&
      snap.data().achievements &&
      snap.data().achievements[achievementId] === true;

    if (!already) {
      // Save to Firestore
      await updateDoc(doc(db, "users", user.uid), {
        [`achievements.${achievementId}`]: true,
      });
      // Optionally show notification
      emitAchievement(`${achievementName} Achievement Unlocked! 🎉`);
    }
  };

  // Ensure an achievement is unlocked (checks Firestore to prevent duplicate toast)
  const ensureAchievementUnlocked = async (achievementId, achievementName) => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      const already =
        snap.exists() &&
        snap.data().achievements &&
        snap.data().achievements[achievementId] === true;

      if (!already) {
        await unlockAchievement(achievementId, achievementName);
      }
    } catch (e) {
      console.error("Error ensuring achievement:", e);
    }
  };

  // Cloudinary upload
  const uploadToCloudinary = async (file) => {
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);

    const response = await fetch(url, { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Upload failed");
    return data.secure_url;
  };

  // Upload photo
  const handlePhotoUpload = async (e) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const user = auth.currentUser;
        if (!user) throw new Error("No user logged in");

        const photoUrl = await uploadToCloudinary(e.target.files[0]);

        const photoData = {
          userId: user.uid,
          url: photoUrl,
          timestamp: new Date().toISOString(),
        };

        const photoDocRef = await addDoc(collection(db, "photos"), photoData);
        const newPhoto = { id: photoDocRef.id, ...photoData };

        // Prepend the new photo so the preview shows the most recent first
        const updatedPhotos = [newPhoto, ...(photos || [])];

        setPhotos(updatedPhotos);
        setStats((prevStats) => ({
          ...prevStats,
          photosShared: prevStats.photosShared + 1,
        }));

        await updateDoc(doc(db, "users", user.uid), {
          "stats.photosShared": updatedPhotos.length,
        });

        // Unlock "Say Cheese!" when uploading a photo (with toast)
        await ensureAchievementUnlocked(3, "Say Cheese!");

        await trackActivity.uploadPhoto();
      } catch (err) {
        console.error("Failed to upload photo: ", err);
        alert("Failed to upload photo: " + err.message);
      }
    }
  };

  // Delete photo
  const handleDeletePhoto = async (photoId) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No user logged in");

      await deleteDoc(doc(db, "photos", photoId));
      const updatedPhotos = photos.filter((photo) => photo.id !== photoId);

      setPhotos(updatedPhotos);
      setStats((prevStats) => ({
        ...prevStats,
        photosShared: Math.max(0, prevStats.photosShared - 1),
      }));

      await updateDoc(doc(db, "users", user.uid), {
        "stats.photosShared": updatedPhotos.length,
      });
    } catch (err) {
      console.error("Failed to delete photo: ", err);
      alert("Failed to delete photo: " + err.message);
    }
  };

  // Photo interactions
  const handlePhotoClick = (photo) => {
    // If user clicked from the "All Photos" modal, close it so the viewer sits on top of the viewport
    setShowAllPhotos(false);

    // open centered viewer
    setSelectedPhoto(photo);

    // ensure top of page so viewer shows centered
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {}
  };
  // central scroll lock for any open overlay/modal (viewer, all-photos, edit, share)
  useEffect(() => {
    const anyModalOpen = !!selectedPhoto || showAllPhotos || showEditProfile || showShareCode;
    try {
      document.body.style.overflow = anyModalOpen ? "hidden" : "";
    } catch {}
    return () => {
      try {
        document.body.style.overflow = "";
      } catch {}
    };
  }, [selectedPhoto, showAllPhotos, showEditProfile, showShareCode]);
  const closePhotoView = () => setSelectedPhoto(null);
  // close viewer on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setSelectedPhoto(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Render selected photo into document.body via portal to avoid stacking/transform issues
  const SelectedPhotoPortal = ({ photo, onClose }) => {
    if (!photo) return null;
    return ReactDOM.createPortal(
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.65)",
          display: "flex",
          alignItems: "flex-start",   // push down so header remains visible
          justifyContent: "center",
          zIndex: 20000,
          paddingTop: "88px",         // leave header space
          paddingLeft: 20,
          paddingRight: 20,
          boxSizing: "border-box",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            width: "min(900px, 92vw)",               // smaller width
            maxHeight: "calc(100vh - 160px)",       // leave room above and below
            borderRadius: 12,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0b0b0b",
            padding: 12,
            boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          }}
        >
           <img
             src={transformCloudinary(photo.url, { w: 1600, h: 1600 })}
             alt="Expanded"
             style={{
               width: "auto",
               height: "auto",
               maxWidth: "100%",
               maxHeight: "calc(100vh - 200px)",   // ensure it fits the smaller modal
               display: "block",
               objectFit: "contain",
               imageOrientation: "from-image",
             }}
           />
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: "rgba(255,255,255,0.9)",
              border: "none",
              borderRadius: "50%",
              width: 34,
              height: 34,
              cursor: "pointer",
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1,
            }}
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>
      </div>,
      document.body
    );
  };

  // All Photos modal via portal so it's centered on the viewport (not inside a transformed parent)
  const AllPhotosPortal = ({ open, photosList = [], onClose, onPhotoClick, onDelete }) => {
    if (!open) return null;
    return ReactDOM.createPortal(
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.85)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 15000,
          padding: 24,
          boxSizing: "border-box",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            width: "min(1200px, 94vw)",
            height: "min(84vh, 900px)",
            background: "white",
            borderRadius: 16,
            padding: 24,
            overflowY: "auto",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>All Photos</h2>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer" }}>×</button>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 16,
            alignItems: "start",
          }}>
            {photosList.map((photo) => (
              <div
                key={photo.id}
                onClick={() => onPhotoClick(photo)}
                style={{ position: "relative", width: "100%", paddingTop: "100%", borderRadius: 14, overflow: "hidden", cursor: "pointer" }}
              >
                <img
                  src={transformCloudinary(photo.url, { w: 600, h: 600 })}
                  alt="Gallery"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", imageOrientation: "from-image" }}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(photo.id); }}
                  style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.9)", cursor: "pointer" }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // Share Code modal rendered in a portal so it centers on the viewport (not inside transformed container)
  const ShareCodePortal = ({ open, shareCode, onClose, onCopy, onGenerate }) => {
    if (!open) return null;
    return ReactDOM.createPortal(
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 14000,
          padding: 20,
          boxSizing: "border-box",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "min(700px, 96vw)",
            maxHeight: "84vh",
            overflow: "auto",
            borderRadius: 20,
            background: "linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            padding: 22,
            boxSizing: "border-box",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ fontSize: 24 }}>🔗</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>Share Your Profile</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>Invite friends to connect with you</div>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" title="Close" style={{ border: "none", background: "transparent", fontSize: 24, cursor: "pointer" }}>×</button>
          </div>

          {/* Body */}
          <div style={{ paddingTop: 8 }}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#a855f7", textTransform: "uppercase", marginBottom: 8 }}>Your Share Code</div>
              <div style={{ background: "linear-gradient(135deg,#f8f9ff 0%,#fff 100%)", border: "2px solid rgba(168,85,247,0.15)", padding: 16, borderRadius: 12, textAlign: "center", fontFamily: "monospace", fontSize: 28, color: "#6c63ff" }}>
                {shareCode || "--------"}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, flexDirection: "column" }}>
              <button onClick={onCopy} style={{ padding: "12px 14px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#a855f7 0%, #7c3aed 100%)", color: "white", fontWeight: 700, cursor: "pointer" }}>
                📋 Copy Code
              </button>
              <button onClick={onGenerate} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(168,85,247,0.15)", background: "transparent", color: "#6c63ff", fontWeight: 700, cursor: "pointer" }}>
                🔄 Generate New Code
              </button>
            </div>

            <div style={{ marginTop: 16, fontSize: 12, color: "#64748b", background: "rgba(168,85,247,0.04)", padding: 10, borderRadius: 8 }}>
              💡 Friends can add you via Community → Friends → Enter Code
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // Activities
  const addActivity = async (text, icon = "🔵") => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const activityData = {
        userId: user.uid,
        text,
        icon,
        timestamp: new Date().toISOString(),
      };

      await addDoc(collection(db, "activities"), activityData);
      setActivities((prev) => [activityData, ...prev.slice(0, 9)]);
    } catch (error) {
      console.error("Error adding activity:", error);
    }
  };

  const trackActivity = {
    uploadPhoto: () => addActivity("You have uploaded a photo.", "📸"),
    uploadVideo: () => addActivity("You have uploaded a video.", "🎥"),
    sharePost: () => addActivity("You have shared a post.", "📤"),
    createItinerary: () => addActivity("You have created a new itinerary.", "🗺️"),
    addLocation: () => addActivity("You have added a location to your itinerary.", "📍"),
    removeLocation: () => addActivity("You have removed a location from your itinerary.", "❌"),
    completeItinerary: () => addActivity("You have completed an itinerary.", "✅"),
    bookmarkPlace: () => addActivity("You have bookmarked a place.", "⭐"),
    removeBookmark: () => addActivity("You have removed a bookmark.", "💔"),
    completeAchievement: (name) => addActivity(`You have completed an achievement: ${name}`, "🏆"),
    unlockBadge: () => addActivity("You have unlocked a new badge.", "🎖️"),
    likePost: () => addActivity("You have liked a post.", "❤️"),
    commentPost: () => addActivity("You have commented on a post.", "💬"),
    updateProfile: () => addActivity("You have updated your profile.", "👤"),
    changePreferences: () => addActivity("You have changed your travel preferences.", "⚙️"),
    followTraveler: () => addActivity("You have followed a traveler.", "👥"),
    unfollowTraveler: () => addActivity("You have unfollowed a traveler.", "👋"),
    shareItinerary: () => addActivity("You have shared an itinerary.", "🔗"),
  };

  // Generate and save share code
  const handleShareProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const code = uuidv4().slice(0, 8).toUpperCase();
      await updateDoc(doc(db, "users", user.uid), { shareCode: code });

      setShareCode(code);
      setShowShareCode(true);
    } catch (error) {
      alert("Failed to generate share code.");
      console.error(error);
    }
  };

  const copyShareCode = async () => {
    try {
      if (!shareCode) return;
      await navigator.clipboard.writeText(shareCode);
      alert("Code copied to clipboard");
    } catch {
      alert("Failed to copy");
    }
  };

  const handleLogout = async () => {
    try {
      if (userId) localStorage.removeItem(`${PROFILE_STATS_CACHE_KEY}_${userId}`);
      localStorage.removeItem('token');
      await signOut(auth);
      navigate("/dashboard");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Only keep newest first and a preview of 6
  const sortedPhotos = useMemo(() => {
    const ts = (p) => {
      if (!p) return 0;
      // Firestore Timestamp
      if (p?.createdAt?.toMillis) return p.createdAt.toMillis();
      // numeric timestamps
      if (typeof p?.createdAt === "number") return p.createdAt;
      if (typeof p?.uploadedAt === "number") return p.uploadedAt;
      // ISO string timestamp (e.g. new Date().toISOString())
      if (p?.timestamp) {
        const parsed = typeof p.timestamp === "number" ? p.timestamp : Date.parse(p.timestamp);
        if (!Number.isNaN(parsed)) return parsed;
      }
      return 0;
    };
    return [...(photos || [])].sort((a, b) => ts(b) - ts(a));
  }, [photos]);

  const previewPhotos = useMemo(() => sortedPhotos.slice(0, 14), [sortedPhotos]);

  // Pick the 2 most recent completed achievements from activities
  const recentCompletedAchievements = useMemo(() => {
    const toMs = (x) =>
      x?.toMillis?.() ??
      (typeof x === "number" ? x : (x ? Date.parse(x) : 0));
    return (activities || [])
      .filter(
        (a) =>
          a?.icon === "🏆" ||
          /completed an achievement/i.test(a?.text || "") ||
          /achievement/i.test(a?.text || "")
      )
      .sort(
        (a, b) =>
          toMs(b.completedAt || b.createdAt || b.timestamp || b.date) -
          toMs(a.completedAt || a.createdAt || a.timestamp || a.date)
      );
  }, [activities]);

  // Helper to extract the achievement name from the activity text
  const extractAchievementName = (text = "") => {
    const m = /completed an achievement:\s*(.+)$/i.exec(text);
    return (m && m[1]?.trim()) || "";
  };

  // Build render-ready cards for the 2 most recent completed achievements
  const recentAchievementCards = useMemo(() => {
    const cards = [];
    const seen = new Set();

    for (const a of recentCompletedAchievements) {
      const name =
        extractAchievementName(a.text) || a.title || a.name || "Achievement";
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      // FIX: Change achievementsData to ACHIEVEMENTS_DATA
      const meta =
        Object.values(ACHIEVEMENTS_DATA).find(
          (x) => x.title.toLowerCase() === key
        ) || undefined;

      const when =
        a?.completedAt?.toMillis?.() ||
        a?.createdAt?.toMillis?.() ||
        (a?.timestamp ? Date.parse(a.timestamp) : undefined) ||
        (a?.date ? Date.parse(a.date) : undefined) ||
        Date.now();

      cards.push({
        title: name,
        description: meta?.description || a.text || "Achievement completed",
        icon: meta?.icon || a.icon || "🏆",
        when,
      });

      if (cards.length === 2) break;
    }
    return cards;
  }, [recentCompletedAchievements]); // Also removed achievementsData from dependency array

  // Sync unlocked achievements from Firestore
  useEffect(() => {
    if (!userId) {
      setUnlockedAchievements(new Set());
      return;
    }
    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (!docSnap.exists()) {
        setUnlockedAchievements(new Set());
        return;
      }
      const achievements = docSnap.data().achievements || {};
      const unlocked = Object.entries(achievements)
        .filter(([_, v]) => v === true)
        .map(([k]) => Number(k));
      setUnlockedAchievements(new Set(unlocked));
    });
    return () => unsubscribe();
  }, [userId]);

  // Add real-time listener for ratings (similar to dashboard.js)
  useEffect(() => {
    if (!userId) return;
    const ratingsCol = collection(db, "users", userId, "ratings");
    const unsubscribe = onSnapshot(ratingsCol, (snap) => {
      setStats((prev) => ({
        ...prev,
        reviewsWritten: snap.size,
      }));
    });
    return () => unsubscribe();
  }, [userId]);

  // Fetch user's completed destinations from Stats collection
  useEffect(() => {
    const fetchCompletedDestinations = async () => {
      if (!userId) {
        setCompletedDestinations([]);
        return;
      }

      try {
        // Try to get from Stats collection first
        const statsRef = doc(db, "Stats", `completed_${userId}`);
        const statsSnap = await getDoc(statsRef);
        
        if (statsSnap.exists()) {
          const data = statsSnap.data();
          const destinations = data.destinations || {};
          
          const destinationsArray = Object.entries(destinations).map(([id, dest]) => ({
            id,
            name: dest.name || 'Unknown',
            region: dest.region || '',
            completedAt: dest.completedAt,
            latitude: dest.latitude,
            longitude: dest.longitude,
          }));

          const withCoordinates = destinationsArray.filter(
            dest => dest.latitude && dest.longitude
          );

          setCompletedDestinations(withCoordinates);

          // Update stats count
          const count = destinationsArray.length;
          await updateDoc(doc(db, "users", userId), { 
            "stats.placesVisited": count 
          }).catch(e => console.warn("Failed to sync placesVisited:", e));

          // Auto-center map
          if (withCoordinates.length > 0) {
            const avgLat = withCoordinates.reduce((sum, d) => sum + d.latitude, 0) / withCoordinates.length;
            const avgLng = withCoordinates.reduce((sum, d) => sum + d.longitude, 0) / withCoordinates.length;
            setMapCenter([avgLat, avgLng]);
            setMapZoom(7);
          }
        } else {
          setCompletedDestinations([]);
        }
      } catch (error) {
        console.error('Error fetching completed destinations:', error);
        setCompletedDestinations([]);
      }
    };

    fetchCompletedDestinations();
  }, [userId, showEditProfile]); // <-- add showEditProfile here

  // Cache stats to localStorage on userId and stats changes
  useEffect(() => {
    if (userId) setCachedStats(userId, stats);
  }, [userId, stats]);

  const [activeTab, setActiveTab] = useState("statistics");

  // Add this helper function near the top (after imports)
  const fetchProfiles = async (ids) => {
    if (!ids || ids.length === 0) return [];
    const profiles = await Promise.all(
      ids.map(async (id) => {
        try {
          const snap = await getDoc(doc(db, "users", id));
          if (snap.exists()) {
            const d = snap.data();
            return {
              id,
              name: d.travelerName || d.displayName || d.name || "Traveler",
              profilePicture: d.profilePicture || d.photoURL || "/user.png",
              interests: Array.isArray(d.interests) ? d.interests : (Array.isArray(d.likes) ? d.likes : [])
            };
          }
        } catch (e) {
          console.warn("Failed to fetch profile:", id, e);
        }
        return null;
      })
    );
    return profiles.filter(Boolean);
  };

  // Then update the friends useEffect (replace the existing one):
  useEffect(() => {
    if (!userId) {
      setFriends([]);
      return;
    }

    const friendsRef = collection(db, "users", userId, "friends");
    const unsubscribe = onSnapshot(friendsRef, async (snap) => {
      if (!snap || snap.empty) {
        setFriends([]);
        return;
      }

      const friendIds = snap.docs.map((doc) => doc.id);
      
      // Verify each friend still exists and fetch their profiles
      const friendProfiles = await fetchProfiles(friendIds);
      
      // Update friends state with profiles
      setFriends(friendProfiles);

      // Update friends count in stats
      setStats((prev) => ({
        ...prev,
        friends: friendProfiles.length,
      }));
    });

    return () => unsubscribe();
  }, [userId]);

  // Add this ref for the dropdown
  const settingsDropdownRef = useRef(null);

  // Add this useEffect to close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(event.target)) {
        setShowSettingsDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ADD EFFECT (after existing userRef snapshot effects)
  useEffect(() => {
    if (!userId) {
      setModerationNotices([]);
      return;
    }
    const ref = doc(db, 'users', userId);
    const unsub = onSnapshot(ref, snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      const mod = data.moderation || {};
      const notices = [];

      if (Array.isArray(mod.warnings)) {
        for (const w of mod.warnings.slice(-3)) {
          notices.push({
            type: 'warning',
            text: w.message || w.reason || 'Warning issued',  // prefer message
            at: w.at?.toMillis?.() ? new Date(w.at.toMillis()) : new Date()
          });
        }
      }

      if (Array.isArray(mod.removals)) {
        for (const r of mod.removals.slice(-3)) {
          notices.push({
            type: 'removal',
            text: `Content removed (${r.reason})`,
            at: r.at?.toMillis?.() ? new Date(r.at.toMillis()) : new Date()
          });
        }
      }

      if (mod.status === 'suspended') {
        const untilMs = mod.suspensionEnds?.toMillis?.() ?? (mod.suspensionEnds ? Date.parse(mod.suspensionEnds) : 0);
        if (untilMs && Date.now() < untilMs) {
          notices.push({
            type: 'suspended',
            text: `Suspended until ${new Date(untilMs).toLocaleString()}`,
            at: Date.now()
          });
        }
      }
      if (mod.status === 'banned') {
        notices.push({
          type: 'banned',
          text: 'Account banned',
          at: Date.now()
        });
      }

      setModerationNotices(notices);
    });
    return () => unsub();
  }, [userId]);

  return (
    <>
      {/* Animated background elements - MORE VISIBLE */}
      <div className="profile-bg-circle"></div>
      <div className="profile-bg-circle"></div>
      <div className="profile-bg-circle"></div>
      <div className="profile-bg-circle"></div>
      <div className="profile-bg-dots"></div>
      <div className="profile-bg-wave"></div>
      <div className="profile-bg-shapes">
        <div className="profile-bg-shape"></div>
        <div className="profile-bg-shape"></div>
        <div className="profile-bg-shape"></div>
      </div>

      <div className="profile-main">
        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-avatar">
            {profile?.profilePicture && profile.profilePicture !== "/user.png" ? (
              <img
                src={profile.profilePicture}
                alt="Profile"
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  objectFit: "cover", // This ensures the image fills the circle properly
                  objectPosition: "center", // Centers the image within the crop
                  background: "#f3f4f6",
                  border: "4px solid #fff", // Match the EditProfile border
                  boxShadow: "0 2px 12px rgba(108,99,255,0.13)", // Match the CSS
                  display: "block", // Ensure proper display
                }}
              />
            ) : (
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  background: "#a084ee",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2.5rem",
                  fontWeight: "700",
                  border: "4px solid #fff",
                  boxShadow: "0 2px 12px rgba(108,99,255,0.13)",
                }}
              >
                {(profile?.name || "U").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="profile-info">
            <div className="profile-title-row">
              <h2>{profile?.name || "Your Name"}</h2>
              {/* Make Edit Profile look like the other buttons */}
              <div style={{ position: "relative" }} ref={settingsDropdownRef}>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  ⚙️ Settings
                </button>

                {/* Dropdown Menu */}
                {showSettingsDropdown && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      marginTop: "8px",
                      background: "white",
                      border: "1px solid rgba(168, 85, 247, 0.2)",
                      borderRadius: "12px",
                      boxShadow: "0 8px 24px rgba(168, 85, 247, 0.2)",
                      zIndex: 1000,
                      minWidth: "200px",
                      overflow: "hidden",
                      animation: "slideDown 0.2s ease",
                    }}
                  >
                    <button
                      onClick={() => {
                        setShowEditProfile(true);
                        setShowSettingsDropdown(false);
                      }}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        border: "none",
                        background: "transparent",
                        textAlign: "left",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "#475569",
                        transition: "all 0.2s ease",
                        borderBottom: "1px solid rgba(168, 85, 247, 0.1)",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(168, 85, 247, 0.08)";
                        e.currentTarget.style.color = "#a855f7";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "#475569";
                      }}
                    >
                       Edit Profile
                    </button>

                    <button
                      onClick={() => {
                        handleShareProfile();
                        setShowSettingsDropdown(false);
                      }}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        border: "none",
                        background: "transparent",
                        textAlign: "left",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "#475569",
                        transition: "all 0.2s ease",
                        borderBottom: "1px solid rgba(168, 85, 247, 0.1)",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(168, 85, 247, 0.08)";
                        e.currentTarget.style.color = "#a855f7";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "#475569";
                      }}
                    >
                       Share Profile
                    </button>

                    <button
                      onClick={() => {
                        handleLogout();
                        setShowSettingsDropdown(false);
                      }}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        border: "none",
                        background: "transparent",
                        textAlign: "left",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "#dc2626",
                        transition: "all 0.2s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(220, 38, 38, 0.08)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                        Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="profile-meta">
              <span>🌟 Explorer</span>
              <span>• 🎂 Joined {profile?.joined || ""}</span>   {/* null-safe */}
            </div>
            <div className="profile-badges">
              {( (profile?.interests && profile.interests.length > 0 ? profile.interests : (profile?.likes || [])) ).map((interest) => (
                <div className="profile-interest profile-interest-like" key={interest}>
                  <span className="profile-interest-label">{interest}</span>
                </div>
              ))}
              {(profile?.dislikes || []).map((dislike) => (
                <div className="profile-interest profile-interest-dislike" key={dislike}>
                  <span className="profile-interest-label">{dislike}</span>
                </div>
              ))}
            </div>
            <div className="profile-bio">{profile?.bio || "No bio yet."}</div>
            {moderationNotices.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {moderationNotices.map((n, i) => (
                  <div
                    key={i}
                    style={{
                      background: n.type === 'warning' ? '#fef3c7' : '#fee2e2',
                      border: `1px solid ${n.type === 'warning' ? '#fde68a' : '#fecaca'}`,
                      padding: '8px 12px',
                      borderRadius: 8,
                      fontSize: 13,
                      color: n.type === 'warning' ? '#92400e' : '#7f1d1d',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <span>{n.type === 'warning' ? '⚠️' : n.type === 'removal' ? '🗑️' : n.type === 'suspended' ? '⏸️' : n.type === 'banned' ? '⛔' : 'ℹ️'}</span>
                    <span style={{ flex: 1 }}>{n.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="profile-nav">
          <button
            className={`profile-nav-btn${activeTab === "statistics" ? " active" : ""}`}
            onClick={() => setActiveTab("statistics")}
          >
              Statistics
          </button>
          <button
            className={`profile-nav-btn${activeTab === "activity" ? " active" : ""}`}
            onClick={() => setActiveTab("activity")}
          >
              Activity
          </button>
          <button
            className={`profile-nav-btn${activeTab === "photos" ? " active" : ""}`}
            onClick={() => setActiveTab("photos")}
          >
              Photos
          </button>
          <button
            className={`profile-nav-btn${activeTab === "achievements" ? " active" : ""}`}
            onClick={() => setActiveTab("achievements")}
          >
              Achievements
          </button>
          <button
            className={`profile-nav-btn${activeTab === "friends" ? " active" : ""}`}
            onClick={() => setActiveTab("friends")}
          >
             Friends
          </button>
        </div>

        {/* Tab Content */}
        {/* Statistics Tab */}
        <div className={`profile-content-section${activeTab === "statistics" ? " active" : ""}`}>
          <div className="profile-stats-row">
            <div className="profile-stat">
              <span>{stats.placesVisited}</span>
              <div>Places Visited</div>
            </div>
            <div className="profile-stat">
              <span>{stats.photosShared}</span>
              <div>Photos Shared</div>
            </div>
            <div className="profile-stat">
              <span>{stats.reviewsWritten}</span>
              <div>Reviews Written</div>
            </div>
            <div className="profile-stat">
              <span>{stats.friends}</span>
              <div>Friends</div>
            </div>
          </div>

          {/* Map Section Under Stats */}
          <div className="profile-card">
            <div className="profile-card-title">🗺️ My Completed Destinations</div>
            <div style={{ height: 2, background: "#e2e8f0", marginBottom: 20, borderRadius: 2 }} />
            
            {completedDestinations.length > 0 ? (
              <div style={{ width: "100%", height: "auto" }}>
                <div style={{ position: "relative", width: "100%", height: "400px", borderRadius: "0 0 16px 16px", overflow: "hidden", boxShadow: "0 4px 12px rgba(102, 126, 234, 0.15)" }}>
                  <MapContainer
                    center={mapCenter}
                    zoom={mapZoom}
                    style={{ width: "100%", height: "100%" }}
                    key={`map-${mapCenter[0]}-${mapCenter[1]}-${mapZoom}`}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    {completedDestinations.map((dest) => (
                      <Marker
                        key={dest.id}
                        position={[dest.latitude, dest.longitude]}
                        icon={customIcon}
                      >
                        <Popup>
                          <div style={{ fontSize: "14px", fontWeight: "600", color: "#1e293b" }}>
                            {dest.name}
                          </div>
                          {dest.region && (
                            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                              {dest.region}
                            </div>
                          )}
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </div>
            ) : (
              <div style={{
                textAlign: "center",
                color: "#999",
                padding: "60px 40px",
                borderRadius: "16px",
                background: "linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)",
                border: "2px dashed rgba(102, 126, 234, 0.2)",
              }}>
                <div style={{ fontSize: "64px", marginBottom: "16px" }}>🗺️</div>
                <div style={{ fontWeight: "700", fontSize: "18px", marginBottom: "8px", color: "#475569" }}>
                  No completed destinations yet
                </div>
                <div style={{ fontSize: "14px", color: "#999" }}>
                  Mark destinations as completed in your itinerary to see them here
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Activity Tab */}
        <div className={`profile-content-section${activeTab === "activity" ? " active" : ""}`}>
          <div className="profile-card">
            <div className="profile-card-title">📝 Recent Activity</div>
            <div style={{ height: 2, background: "#e2e8f0", marginBottom: 16, borderRadius: 2 }} />
            <div className="profile-activity-list" style={{ gap: 16 }}>
              {activities.length > 0 ? (
                activities.slice(0, 5).map((a, i) => (
                  <div
                    className="profile-activity-item"
                    key={a.id || i}
                    style={{
                      background: `linear-gradient(135deg, ${[
                        "#667eea",
                        "#764ba2",
                        "#f093fb",
                        "#f5576c",
                        "#4facfe",
                      ][i % 5]} 0%, ${[
                        "#764ba2",
                        "#667eea",
                        "#f5576c",
                        "#f093fb",
                        "#00f2fe",
                      ][i % 5]} 100%)`,
                      color: "white",
                      padding: "16px 20px",
                      borderRadius: "14px",
                      margin: 0,
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      transition: "all 0.3s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateX(8px)";
                      e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateX(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <span style={{ fontSize: "24px", flexShrink: 0 }}>
                      {a.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          fontWeight: "500",
                          display: "block",
                          marginBottom: "4px",
                          fontSize: "15px",
                        }}
                      >
                        {a.text}
                      </span>
                      <span
                        style={{
                          fontSize: "13px",
                          opacity: 0.7,
                          display: "block",
                        }}
                      >
                        {new Date(a.timestamp).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    color: "#999",
                    padding: "40px 20px",
                    borderRadius: "14px",
                    background: "linear-gradient(135deg, rgba(108, 99, 255, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)",
                    border: "2px dashed rgba(108, 99, 255, 0.2)",
                  }}
                >
                  <div style={{ fontSize: "48px", marginBottom: "12px" }}>📭</div>
                  <div style={{ fontWeight: "600", marginBottom: "8px" }}>No activities yet</div>
                  <div style={{ fontSize: "14px", color: "#999" }}>
                    Your activities will appear here when you explore
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Photos Tab */}
        <div className={`profile-content-section${activeTab === "photos" ? " active" : ""}`}>
          <div className="profile-card">
            <div className="profile-card-title">📷 Photo Gallery</div>
            <div className="profile-gallery-actions">
              <label
                htmlFor="photo-upload"
                className="btn btn-primary"
                style={{ cursor: "pointer" }}
              >
                + Upload Photo
              </label>
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handlePhotoUpload}
              />
              {photos.length > 0 && (
                <button
                  className="btn btn-primary"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowAllPhotos(true);
                  }}
                >
                  View All ({photos.length})
                </button>
              )}
            </div>
            <div style={{ height: 2, background: "#e2e8f0", marginBottom: 20, borderRadius: 2 }} />
            <div className="profile-gallery-scroll">
              {previewPhotos.length > 0 ? (
                previewPhotos.map((photo) => (
                  <div
                    className="profile-gallery-photo"
                    key={photo.id || photo.url}
                    onClick={() => handlePhotoClick(photo)}
                  >
                    <img
                      src={transformCloudinary(photo.url, { w: 140, h: 140 })}
                      alt="Gallery"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        imageOrientation: "from-image",
                        background: "#f3f4f6",
                      }}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePhoto(photo.id);
                      }}
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        background: "rgba(255,255,255,0.95)",
                        border: "none",
                        borderRadius: "50%",
                        width: 32,
                        height: 32,
                        cursor: "pointer",
                        fontSize: 18,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s ease",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                        fontWeight: "bold",
                        color: "#333",
                      }}
                      aria-label="Delete photo"
                      title="Delete"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(239,68,68,0.95)";
                        e.currentTarget.style.color = "white";
                        e.currentTarget.style.transform = "scale(1.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.95)";
                        e.currentTarget.style.color = "#333";
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 140,
                    height: 140,
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    borderRadius: 16,
                    color: "white",
                    textAlign: "center",
                    padding: 12,
                    boxSizing: "border-box",
                    border: "2px dashed rgba(255,255,255,0.3)",
                    boxShadow: "0 4px 12px rgba(108, 99, 255, 0.15)",
                  }}
                >
                  <div style={{ fontSize: 40, marginBottom: 8 }}>📸</div>
                  <div style={{ fontSize: 13, fontWeight: "600", lineHeight: 1.2 }}>
                    Upload Photo
                  </div>
                </div>
              )}
            </div>
            {photos.length > 0 && (
              <div
                style={{
                  marginTop: "16px",
                  fontSize: "13px",
                  color: "#999",
                  textAlign: "center",
                }}
              >
                ✨ {photos.length} photo{photos.length !== 1 ? "s" : ""} total
              </div>
            )}
          </div>
        </div>

        {/* Achievements Tab */}
        <div className={`profile-content-section${activeTab === "achievements" ? " active" : ""}`}>
          <div className="profile-card">
            <div className="profile-card-title">🏆 Achievements</div>
            <div style={{ height: 2, background: "#e2e8f0", marginBottom: 20, borderRadius: 2 }} />
            
            {unlockedAchievements.size > 0 ? (
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#6c63ff", marginBottom: "16px" }}>
                  Unlocked Achievements
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
                  {Array.from(unlockedAchievements).map((achvId) => {
                    const achv = ACHIEVEMENTS_DATA[achvId];
                    if (!achv) return null;
                    return (
                      <div
                        key={achvId}
                        style={{
                          padding: "20px",
                          borderRadius: "16px",
                          background: "linear-gradient(135deg, rgba(108, 99, 255, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)",
                          border: "2px solid rgba(108, 99, 255, 0.3)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                          transition: "all 0.3s ease",
                          cursor: "pointer",
                          position: "relative",
                          overflow: "hidden",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-8px)";
                          e.currentTarget.style.boxShadow = "0 12px 24px rgba(108, 99, 255, 0.2)";
                          e.currentTarget.style.borderColor = "#6c63ff";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "none";
                          e.currentTarget.style.borderColor = "rgba(108, 99, 255, 0.3)";
                        }}
                      >
                        {/* Animated background glow */}
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            right: 0,
                            width: "150px",
                            height: "150px",
                            background: "radial-gradient(circle, rgba(108, 99, 255, 0.2) 0%, transparent 70%)",
                            borderRadius: "50%",
                            transform: "translate(50%, -50%)",
                            pointerEvents: "none",
                          }}
                        />

                        <div style={{ display: "flex", alignItems: "center", gap: "12px", position: "relative", zIndex: 1 }}>
                          <div style={{ fontSize: "32px" }}>{achv.icon}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: "700", fontSize: "15px", color: "#1e293b", marginBottom: "2px" }}>
                              {achv.title}
                            </div>
                            <div style={{ fontSize: "12px", color: "#64748b" }}>
                              {achv.category}
                            </div>
                          </div>
                          <div
                            style={{
                              background: "linear-gradient(135deg, #6c63ff 0%, #764ba2 100%)",
                              color: "white",
                              padding: "4px 12px",
                              borderRadius: "16px",
                              fontSize: "11px",
                              fontWeight: "700",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Unlocked ✓
                          </div>
                        </div>

                        <div style={{ fontSize: "13px", color: "#64748b", lineHeight: "1.4", position: "relative", zIndex: 1 }}>
                          {achv.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Locked Achievements */}
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#6c63ff", marginBottom: "16px" }}>
                Available Achievements
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
                {Object.entries(ACHIEVEMENTS_DATA)
                  .filter(([id]) => !unlockedAchievements.has(Number(id)))
                  .map(([id, achv]) => (
                    <div
                      key={id}
                      style={{
                        padding: "20px",
                        borderRadius: "16px",
                        background: "linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%)",
                        border: "2px solid rgba(108, 99, 255, 0.1)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        opacity: 0.7,
                        transition: "all 0.3s ease",
                        position: "relative",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = "1";
                        e.currentTarget.style.transform = "translateY(-4px)";
                        e.currentTarget.style.borderColor = "rgba(108, 99, 255, 0.2)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = "0.7";
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.borderColor = "rgba(108, 99, 255, 0.1)";
                      }}
                    >
                      {/* Locked overlay */}
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          right: 0,
                          width: "100%",
                          height: "100%",
                          background: "radial-gradient(circle at right, rgba(0, 0, 0, 0.05) 0%, transparent 70%)",
                          borderRadius: "16px",
                          pointerEvents: "none",
                        }}
                      />

                      <div style={{ display: "flex", alignItems: "center", gap: "12px", position: "relative", zIndex: 1 }}>
                        <div style={{ fontSize: "32px", opacity: 0.5, filter: "grayscale(100%)" }}>
                          {achv.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "700", fontSize: "15px", color: "#1e293b", marginBottom: "2px" }}>
                            {achv.title}
                          </div>
                          <div style={{ fontSize: "12px", color: "#64748b" }}>
                            {achv.category}
                          </div>
                        </div>
                        <div
                          style={{
                            background: "#e2e8f0",
                            color: "#64748b",
                            padding: "4px 12px",
                            borderRadius: "16px",
                            fontSize: "11px",
                            fontWeight: "700",
                            whiteSpace: "nowrap",
                          }}
                        >
                          🔒 Locked
                        </div>
                      </div>

                      <div style={{ fontSize: "13px", color: "#64748b", lineHeight: "1.4", position: "relative", zIndex: 1 }}>
                        {achv.description}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Friends Tab */}
        <div className={`profile-content-section${activeTab === "friends" ? " active" : ""}`}>
          <div className="profile-card">
            <div className="profile-card-title">👥 Friends</div>
            <div style={{ height: 2, background: "#e2e8f0", marginBottom: 20, borderRadius: 2 }} />
            
            {friends.length > 0 ? (
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#6c63ff", marginBottom: "16px" }}>
                  Your Friends ({friends.length})
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {friends.map((friend, i) => (
                    <div
                      key={friend.id}
                      style={{
                        padding: "20px",
                        borderRadius: "16px",
                        background: `linear-gradient(135deg, ${[
                          "#667eea",
                          "#764ba2",
                          "#f093fb",
                          "#f5576c",
                          "#4facfe",
                        ][i % 5]} 0%, ${[
                          "#764ba2",
                          "#667eea",
                          "#f5576c",
                          "#f093fb",
                          "#00f2fe",
                        ][i % 5]} 100%)`,
                        color: "white",
                        textAlign: "center",
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                        boxShadow: "0 4px 12px rgba(108, 99, 255, 0.15)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "12px",
                        position: "relative",
                        overflow: "hidden",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-8px)";
                        e.currentTarget.style.boxShadow = "0 12px 24px rgba(108, 99, 255, 0.25)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(108, 99, 255, 0.15)";
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          right: 0,
                          width: "200px",
                          height: "200px",
                          background: "radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, transparent 70%)",
                          borderRadius: "50%",
                          transform: "translate(50%, -50%)",
                          pointerEvents: "none",
                        }}
                      />

                      <img
                        src={friend.profilePicture}
                        alt={friend.name}
                        style={{
                          width: "72px",
                          height: "72px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "3px solid rgba(255, 255, 255, 0.4)",
                          position: "relative",
                          zIndex: 1,
                          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
                        }}
                      />

                      <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
                        <div style={{ fontWeight: "700", fontSize: "16px", marginBottom: "4px" }}>
                          {friend.name}
                        </div>
                        <div style={{ fontSize: "12px", opacity: 0.9 }}>
                          Traveler
                        </div>
                      </div>

                      {friend.interests && friend.interests.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "6px",
                            justifyContent: "center",
                            width: "100%",
                            marginTop: "8px",
                            position: "relative",
                            zIndex: 1,
                          }}
                        >
                          {friend.interests.slice(0, 2).map((interest) => (
                            <span
                              key={interest}
                              style={{
                                fontSize: "11px",
                                background: "rgba(255, 255, 255, 0.25)",
                                padding: "4px 10px",
                                borderRadius: "12px",
                                whiteSpace: "nowrap",
                                zIndex: 9999,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {interest}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  color: "#999",
                  padding: "60px 40px",
                  borderRadius: "16px",
                                   background: "linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)",
                  border: "2px dashed rgba(102, 126, 234, 0.2)",
                }}
              >
                <div style={{ fontSize: "64px", marginBottom: "16px" }}>👥</div>
                <div style={{ fontWeight: "700", fontSize: "18px", marginBottom: "8px", color: "#475569" }}>
                  No friends yet
                </div>
                <div style={{ fontSize: "14px", color: "#999" }}>
                  Connect with other travelers to see them here
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Edit Profile Modal */}
        {showEditProfile && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(2px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10000,
              animation: "fadeIn 0.3s ease",
            }}
            onClick={() => setShowEditProfile(false)}
          >
            <div
              style={{
                position: "relative",
                maxWidth: "90vw",
                maxHeight: "90vh",
                width: "600px",
                background: "white",
                borderRadius: "24px",
                boxShadow: "0 20px 60px rgba(168, 85, 247, 0.3)",
                animation: "slideUp 0.3s ease",
                overflow: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowEditProfile(false)}
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  width: "36px",
                  height: "36px",
                  border: "none",
                  borderRadius: "50%",
                  background: "rgba(168, 85, 247, 0.1)",
                  color: "#a855f7",
                  fontSize: "24px",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1001,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#a855f7";
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(168, 85, 247, 0.1)";
                  e.currentTarget.style.color = "#a855f7";
                }}
             
              >
                ×
              </button>
              <EditProfile
                onClose={() => setShowEditProfile(false)}
                onProfileUpdate={() => unlockAchievement(5, "Profile Pioneer")}
                initialData={{
                  name: profile?.name || "",
                  bio: profile?.bio || "",
                  profilePicture: profile?.profilePicture || "/user.png",
                  likes: profile?.likes || [],
                  dislikes: profile?.dislikes || []
                }}
              />
            </div>
          </div>
        )}

        {/* Info / Delete Modal */}
        {showInfoDelete && <InfoDelete onClose={() => setShowInfoDelete(false)} />}

        {/* Selected Photo Viewer (rendered via portal to avoid stacking context issues) */}
        <SelectedPhotoPortal photo={selectedPhoto} onClose={closePhotoView} />
        {/* All Photos Modal (portal) */}
        <AllPhotosPortal
          open={showAllPhotos}
          photosList={photos}
          onClose={() => setShowAllPhotos(false)}
          onPhotoClick={(p) => handlePhotoClick(p)}
          onDelete={(id) => handleDeletePhoto(id)}
        />
        {/* Share Code Portal (centers on the viewport) */}
        <ShareCodePortal
          open={showShareCode}
          shareCode={shareCode}
          onClose={() => setShowShareCode(false)}
          onCopy={copyShareCode}
          onGenerate={handleShareProfile}
        />
      </div>
    </>
  );
};

export async function unlockAchievement(achievementId, achievementName) {
  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const already =
    snap.exists() &&
    snap.data().achievements &&
    snap.data().achievements[achievementId] === true;

  if (!already) {
    await updateDoc(userRef, {
      [`achievements.${achievementId}`]: true,
    });
    emitAchievement(`${achievementName} Achievement Unlocked! 🎉`);
  }
}

export async function logActivity(text, icon = "🔵") {
  try {
    const user = auth.currentUser;
    if (!user) return;

    await addDoc(collection(db, "activities"), {
      userId: user.uid,
      text,
      icon,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

export default Profile;
