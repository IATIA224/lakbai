import React, { useState, useEffect, useMemo } from "react";
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
  const handlePhotoClick = (photo) => setSelectedPhoto(photo);
  const closePhotoView = () => setSelectedPhoto(null);

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

  const previewPhotos = useMemo(() => sortedPhotos.slice(0, 6), [sortedPhotos]);

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
        const statsData = await getUserCompletionStats(userId);
        if (statsData && statsData.destinations) {
          const destinationsArray = Object.entries(statsData.destinations).map(([id, data]) => ({
            id,
            name: data.name || 'Unknown',
            region: data.region || '',
            completedAt: data.completedAt,
            latitude: data.latitude,
            longitude: data.longitude,
          }));

          const withCoordinates = destinationsArray.filter(
            dest => dest.latitude && dest.longitude
          );

          setCompletedDestinations(withCoordinates);

          // Sync count to Firestore; UI will update via onSnapshot (like other stats)
          const count = destinationsArray.length;
          try {
            await updateDoc(doc(db, "users", userId), { "stats.placesVisited": count });
          } catch (e) {
            console.warn("Failed to sync placesVisited to Firestore:", e);
          }

          // Auto-center map
          if (withCoordinates.length > 0) {
            const avgLat = withCoordinates.reduce((sum, d) => sum + d.latitude, 0) / withCoordinates.length;
            const avgLng = withCoordinates.reduce((sum, d) => sum + d.longitude, 0) / withCoordinates.length;
            setMapCenter([avgLat, avgLng]);
            setMapZoom(7);
          }
        } else {
          // Keep previous stats value; don't force 0 here
          setCompletedDestinations([]);
        }
      } catch (error) {
        console.error('Error fetching completed destinations:', error);
        setCompletedDestinations([]);
        // Keep previous stats value on error
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
              <button
                className="btn btn-primary"
                onClick={() => setShowEditProfile(true)}
              >
                Edit Profile
              </button>
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
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="profile-nav">
          <button
            className={`profile-nav-btn${activeTab === "statistics" ? " active" : ""}`}
            onClick={() => setActiveTab("statistics")}
          >
            📊 Statistics
          </button>
          <button
            className={`profile-nav-btn${activeTab === "activity" ? " active" : ""}`}
            onClick={() => setActiveTab("activity")}
          >
            🔥 Activity
          </button>
          <button
            className={`profile-nav-btn${activeTab === "photos" ? " active" : ""}`}
            onClick={() => setActiveTab("photos")}
          >
            🖼️ Photos
          </button>
          <button
            className={`profile-nav-btn${activeTab === "achievements" ? " active" : ""}`}
            onClick={() => setActiveTab("achievements")}
          >
            🏆 Achievements
          </button>
          <button
            className={`profile-nav-btn${activeTab === "friends" ? " active" : ""}`}
            onClick={() => setActiveTab("friends")}
          >
            👥 Friends
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
              <div style={{ position: "relative", width: "100%", height: "500px", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 12px rgba(102, 126, 234, 0.15)" }}>
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
                  <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
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
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0, 0, 0, 0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10000,
            }}
            onClick={() => setShowEditProfile(false)}
          >
            <div
              style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}
              onClick={(e) => e.stopPropagation()}
            >
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

        {/* Selected Photo Viewer */}
        {selectedPhoto && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0, 0, 0, 0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10000,
            }}
            onClick={closePhotoView}
          >
            <div
              style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={transformCloudinary(selectedPhoto.url, { w: 1600, h: 1600 })}
                alt="Expanded"
                style={{
                  maxWidth: "90vw",
                  maxHeight: "90vh",
                  objectFit: "contain",
                  imageOrientation: "from-image",
                }}
              />
              <button
                onClick={closePhotoView}
                style={{
                  position: "absolute",
                  top: "10px",
                  right: "10px",
                  background: "rgba(255, 255, 255, 0.8)",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  cursor: "pointer",
                  fontSize: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* All Photos Modal */}
        {showAllPhotos && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0, 0, 0, 0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10001,
            }}
            onClick={() => setShowAllPhotos(false)}
          >
            <div
              style={{
                position: "relative",
                width: "90%",
                height: "90%",
                background: "white",
                borderRadius: "16px",
                padding: "24px",
                overflowY: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "24px",
                }}
              >
                <h2 style={{ margin: 0 }}>{LABELS.ALL_PHOTOS}</h2>
                <button
                  onClick={() => setShowAllPhotos(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "24px",
                    cursor: "pointer",
                    padding: 0,
                    width: "32px",
                    height: "32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                  gap: "16px",
                }}
              >
                {photos
                  .slice()
                  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                  .map((photo) => (
                    <div
                      key={photo.id}
                      style={{
                        position: "relative",
                        width: "100%",
                        paddingTop: "100%",
                        borderRadius: "14px",
                        overflow: "hidden",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setSelectedPhoto(photo);
                        setShowAllPhotos(false);
                      }}
                    >
                      <img
                        src={transformCloudinary(photo.url, { w: 600, h: 600 })}
                        alt="Gallery"
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          imageOrientation: "from-image",
                        }}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePhoto(photo.id);
                        }}
                        style={{
                          position: "absolute",
                          top: "4px",
                          right: "4px",
                          background: "rgba(255, 255, 255, 0.8)",
                          border: "none",
                          borderRadius: "50%",
                          width: 24,
                          height: 24,
                          cursor: "pointer",
                          fontSize: 14,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Share Code Popup */}
        {showShareCode && (
          <div
            className="sharecode-backdrop"
            onClick={() => setShowShareCode(false)}
          >
            <div
              className="sharecode-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sharecode-header">
                <div className="sharecode-title">Share Profile Code</div>
                <button
                  className="sharecode-close"
                  onClick={() => setShowShareCode(false)}
                >
                  ×
                </button>
              </div>

              <div className="sharecode-body">
                <div className="sharecode-box">{shareCode || "--------"}</div>
                <div className="sharecode-actions">
                  <button
                    className="sharecode-btn primary"
                    onClick={copyShareCode}
                  >
                    Copy Code
                  </button>
                  <button
                    className="sharecode-btn ghost"
                    onClick={handleShareProfile}
                  >
                    Regenerate
                  </button>
                </div>
                <div className="sharecode-hint">
                  Friends can add you by entering this code in Community → Friends.
                </div>
              </div>
            </div>
          </div>
        )}
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
