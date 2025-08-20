import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import EditProfile from './EditProfile';
import Achievements from './achievements';
import InfoDelete from './info_delete';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs, deleteDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "./firebase";
import './profile.css';
import { v4 as uuidv4 } from 'uuid'; // Install with: npm install uuid
import { useUser } from "./UserContext";
import { emitAchievement } from "./achievementsBus";

export const CLOUDINARY_CONFIG = {
  cloudName: "dxvewejox",
  uploadPreset: "dxvewejox"
};

const LABELS = {
  ALL_PHOTOS: 'All Photos'
};

const Profile = () => {
  const { profile, setProfile } = useUser();

  // Custom marker icon
  const customIcon = new L.Icon({
    iconUrl: '/placeholder.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [showInfoDelete, setShowInfoDelete] = useState(false);
  const [showShareCode, setShowShareCode] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [unlockedAchievements, setUnlockedAchievements] = useState(new Set());
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [visitedLocations, setVisitedLocations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapCenter, setMapCenter] = useState([12.8797, 121.7740]);
  const [mapZoom, setMapZoom] = useState(6);
  const [searchMarker, setSearchMarker] = useState(null);
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState({
    placesVisited: 0,
    photosShared: 0,
    reviewsWritten: 0,
    friends: 0
  });
  const [shareCode, setShareCode] = useState("");

  // Function to fetch profile data
  const fetchProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Get Firestore profile
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      let data = docSnap.exists() ? docSnap.data() : {};

      // Get joined date from Auth
      const joined = user.metadata?.creationTime
        ? new Date(user.metadata.creationTime).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
        : "";

      setProfile(prev => ({
        ...prev,
        name: data.name || user.displayName || "",
        bio: data.bio || "",
        profilePicture: data.profilePicture || "/user.png",
        likes: Array.isArray(data.likes) ? data.likes : [],
        dislikes: Array.isArray(data.dislikes) ? data.dislikes : [],
        joined,
      }));
      setShareCode(data.shareCode || "");

      // Fetch stats, achievements, etc. (lightweight)
      const friendsCount =
        Array.isArray(data.friends) ? data.friends.length
        : (typeof data.friendsCount === "number" ? data.friendsCount : 0);

      setStats({
        placesVisited: data.stats?.placesVisited || 0,
        photosShared: data.stats?.photosShared || 0,
        reviewsWritten: data.stats?.reviewsWritten || 0,
        friends: friendsCount,            // <- use array length
      });

      // Achievements
      const achievementsObj = data.achievements || {};
      const unlocked = new Set(
        Object.entries(achievementsObj)
          .filter(([_, v]) => v === true)
          .map(([id]) => Number(id))
      );
      setUnlockedAchievements(unlocked);

      // Heavy data: fetch in parallel, update each section as ready
      await Promise.all([
        (async () => {
          try {
            const photosQuery = query(collection(db, "photos"), where("userId", "==", user.uid));
            const photosSnapshot = await getDocs(photosQuery);
            setPhotos(photosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          } catch { setPhotos([]); }
        })(),
        (async () => {
          try {
            const locationsQuery = query(collection(db, "travel_map"), where("userId", "==", user.uid));
            const locationsSnapshot = await getDocs(locationsQuery);
            setVisitedLocations(locationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          } catch { setVisitedLocations([]); }
        })(),
        (async () => {
          try {
            const activitiesQuery = query(collection(db, "activities"), where("userId", "==", user.uid));
            const activitiesSnapshot = await getDocs(activitiesQuery);
            setActivities(
              activitiesSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 10)
            );
          } catch { setActivities([]); }
        })()
      ]);
    } catch (error) {
      console.error("Error fetching profile data:", error);
    }
  };

  // Initial load (no overlay)
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time listener for profile changes
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();

      // Update only fields that can change often
      setProfile(prev => ({
        ...prev,
        name: data.name ?? prev.name,
        bio: data.bio ?? prev.bio,
        profilePicture: data.profilePicture ?? prev.profilePicture,
        likes: Array.isArray(data.likes) ? data.likes : prev.likes,
        dislikes: Array.isArray(data.dislikes) ? data.dislikes : prev.dislikes,
      }));

      const friendsCount =
        Array.isArray(data.friends) ? data.friends.length
        : (typeof data.friendsCount === "number" ? data.friendsCount
        : (data.stats?.friends || 0));

      setStats(prev => ({ ...prev, friends: friendsCount }));
    });

    const handleUserDataChange = (event) => {
      if (user && event.detail.userId === user.uid) {
        // Optional: refresh heavy sections (photos/activities) without touching friends
        fetchProfile();
      }
    };
    window.addEventListener('userDataChanged', handleUserDataChange);

    return () => {
      unsubscribe();
      window.removeEventListener('userDataChanged', handleUserDataChange);
    };
  }, [auth.currentUser?.uid]);

  // Initial fetch + after editing profile
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      fetchProfile();
    }
  }, [showEditProfile]);

  const navigate = useNavigate();

  // Achievements data
  const achievementsData = [
    { id: 1, category: 'Getting Started', title: 'First Step', description: 'Create your very first itinerary.', icon: '🎯', unlocked: unlockedAchievements.has(1) },
    { id: 2, category: 'Getting Started', title: 'First Bookmark', description: 'Save your first place to your favorites.', icon: '⭐', unlocked: unlockedAchievements.has(2) },
    { id: 3, category: 'Getting Started', title: 'Say Cheese!', description: 'Upload your first travel photo.', icon: '📸', unlocked: unlockedAchievements.has(3) },
    { id: 4, category: 'Getting Started', title: 'Hello, World!', description: 'Post your first comment on any itinerary or location.',
      icon: '💬', unlocked: unlockedAchievements.has(4) },
    { id: 5, category: 'Getting Started', title: 'Profile Pioneer', description: 'Complete your profile with a photo and bio.', icon: '👤', unlocked: unlockedAchievements.has(5) },
    { id: 6, category: 'Exploration & Planning', title: 'Mini Planner', description: 'Add at least 3 places to a single itinerary.', icon: '🗺️', unlocked: unlockedAchievements.has(6) },
    { id: 7, category: 'Exploration & Planning', title: 'Explorer at Heart', description: 'View 10 different destinations in the app.', icon: '✈️', unlocked: unlockedAchievements.has(7) },
    { id: 8, category: 'Exploration & Planning', title: 'Checklist Champ', description: 'Mark your first place as "visited".', icon: '✅', unlocked: unlockedAchievements.has(8) }
  ];

  // Notification helper
  const showAchievementNotification = (message) => {
    emitAchievement(message);
  };

  // Unlock achievement (generic)
  const unlockAchievement = async (achievementId, achievementName) => {
    if (!unlockedAchievements.has(achievementId)) {
      setUnlockedAchievements(prev => new Set(prev).add(achievementId));
      showAchievementNotification(`${achievementName} Achievement Unlocked! 🎉`);
      try {
        const user = auth.currentUser;
        if (user) {
          await updateDoc(doc(db, "users", user.uid), {
            [`achievements.${achievementId}`]: true
          });
        }
      } catch (error) {
        console.error("Error saving achievement:", error);
      }
      await trackActivity.completeAchievement(achievementName);
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
          timestamp: new Date().toISOString()
        };

        const photoDocRef = await addDoc(collection(db, "photos"), photoData);
        const newPhoto = { id: photoDocRef.id, ...photoData };
        const updatedPhotos = [...photos, newPhoto];

        setPhotos(updatedPhotos);
        setStats(prevStats => ({
          ...prevStats,
          photosShared: prevStats.photosShared + 1
        }));

        await updateDoc(doc(db, "users", user.uid), {
          "stats.photosShared": updatedPhotos.length
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
      const updatedPhotos = photos.filter(photo => photo.id !== photoId);

      setPhotos(updatedPhotos);
      setStats(prevStats => ({
        ...prevStats,
        photosShared: Math.max(0, prevStats.photosShared - 1)
      }));

      await updateDoc(doc(db, "users", user.uid), {
        "stats.photosShared": updatedPhotos.length
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
        timestamp: new Date().toISOString()
      };

      await addDoc(collection(db, "activities"), activityData);
      setActivities(prev => [activityData, ...prev.slice(0, 9)]);
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
    shareItinerary: () => addActivity("You have shared an itinerary.", "🔗")
  };

  // Search
  const handleSearch = async (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ', Philippines')}&limit=1`
        );
        const data = await response.json();
        if (data.length > 0) {
          const { lat, lon, display_name } = data[0];
          const position = [parseFloat(lat), parseFloat(lon)];
          setMapCenter(position);
          setMapZoom(12);
          setSearchMarker({ position, name: display_name });
        }
      } catch (error) {
        console.error('Search error:', error);
      }
    }
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
      await signOut(auth);
      navigate('/');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <>
      <div className="profile-main">
        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-avatar">
            <img
              src={profile.profilePicture || "/user.png"}
              alt="Profile"
              style={{
                width: 96, height: 96, borderRadius: "50%", objectFit: "cover",
                background: "#f3f4f6", border: "3px solid #e5e7eb"
              }}
            />
          </div>
          <div className="profile-info">
            <div className="profile-title-row">
              <h2>{profile.name || "Your Name"}</h2>
              <button className="profile-edit-btn" onClick={() => setShowEditProfile(true)}>Edit Profile</button>
            </div>
            <div className="profile-meta">
              <span>🌟 Explorer</span>
              <span>• 🎂 Joined {profile.joined}</span>
            </div>
            <div className="profile-badges">
              {profile.likes.map(like => (
                <div className="profile-interest profile-interest-like" key={like}>
                  <span className="profile-interest-label">{like}</span>
                </div>
              ))}
              {profile.dislikes.map(dislike => (
                <div className="profile-interest profile-interest-dislike" key={dislike}>
                  <span className="profile-interest-label">{dislike}</span>
                </div>
              ))}
            </div>
            <div className="profile-bio">{profile.bio || "No bio yet."}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="profile-stats-row">
          <div className="profile-stat"><span>{stats.placesVisited}</span><div>Places Visited</div></div>
          <div className="profile-stat"><span>{stats.photosShared}</span><div>Photos Shared</div></div>
          <div className="profile-stat"><span>{stats.reviewsWritten}</span><div>Reviews Written</div></div>
          <div className="profile-stat"><span>{stats.friends}</span><div>Friends</div></div>
        </div>

        <div className="profile-content-row">
          {/* Left column */}
          <div className="profile-content-main">
            {/* Travel Map */}
            <div className="profile-card">
              <div className="profile-card-title">🗺️ My Travel Map</div>
              <div style={{ height: '300px', position: 'relative' }}>
                <div style={{ marginBottom: '16px', padding: '0 4px' }}>
                  <input
                    type="text"
                    placeholder="Search for a destination in the Philippines..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleSearch}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '8px',
                      border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
                <MapContainer
                  center={mapCenter}
                  zoom={mapZoom}
                  style={{ height: '250px', width: '100%', borderRadius: '12px', zIndex: 1 }}
                  key={`${mapCenter[0]}-${mapCenter[1]}-${mapZoom}`}
                  attributionControl={false}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  {visitedLocations.map((location) => (
                    <Marker key={location.id} position={[location.latitude, location.longitude]}>
                      <Popup>
                        <div>
                          <h3>{location.name}</h3>
                          <p>{location.description || "Visited location"}</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                  {searchMarker && (
                    <Marker position={searchMarker.position} icon={customIcon}>
                      <Popup>
                        <div>
                          <h3>Search Result</h3>
                          <p>{searchMarker.name}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                </MapContainer>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="profile-card">
              <div className="profile-card-title">📝 Recent Activity</div>
              <div className="profile-activity-list" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                {activities.length > 0 ? activities.slice(0, 10).map((a, i) => (
                  <div
                    className="profile-activity-item"
                    key={a.id || i}
                    style={{
                      background: `linear-gradient(135deg, ${['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'][i % 6]} 0%, ${['#764ba2', '#667eea', '#f5576c', '#f093fb', '#00f2fe', '#4facfe'][i % 6]} 100%)`,
                      color: 'white', padding: '12px 16px', borderRadius: '12px',
                      margin: '8px 0', backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}
                  >
                    <span className="profile-activity-icon" style={{ marginRight: '12px', fontSize: '18px' }}>{a.icon}</span>
                    <span className="profile-activity-text" style={{ flex: 1, fontWeight: '500' }}>{a.text}</span>
                    <span className="profile-activity-time" style={{ fontSize: '12px', opacity: 0.6 }}>
                      {new Date(a.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                )) : (
                  <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                    No recent activities
                  </div>
                )}
              </div>
            </div>

            {/* Photo Gallery */}
            <div className="profile-card">
              <div className="profile-card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>📷 Photo Gallery</span>
                <div>
                  <label htmlFor="photo-upload" className="profile-gallery-link" style={{ cursor: 'pointer' }}>
                    Upload Photo
                  </label>
                  <input id="photo-upload" type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoUpload} />
                  {photos.length > 6 && (
                    <a
                      href="#"
                      className="profile-gallery-link"
                      style={{ marginLeft: '16px' }}
                      onClick={(e) => { e.preventDefault(); setShowAllPhotos(true); }}
                    >
                      View All ({photos.length})
                    </a>
                  )}
                </div>
              </div>
              <div className="profile-gallery-scroll">
                {photos.length > 0 ? (
                  photos.slice(0, 6).map((photo) => (
                    <div
                      className="profile-gallery-photo"
                      key={photo.id}
                      style={{ position: 'relative', width: '120px', height: '120px', cursor: 'pointer' }}
                      onClick={() => handlePhotoClick(photo)}
                    >
                      <img src={photo.url} alt="Gallery" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '14px' }} />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id); }}
                        style={{
                          position: 'absolute', top: '4px', right: '4px',
                          background: 'rgba(255, 255, 255, 0.8)', border: 'none',
                          borderRadius: '50%', width: '24px', height: '24px',
                          cursor: 'pointer', fontSize: '14px', display: 'flex',
                          alignItems: 'center', justifyContent: 'center'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    width: '120px', height: '120px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '14px', color: 'white', textAlign: 'center',
                    padding: '12px', boxSizing: 'border-box', border: '2px dashed rgba(255, 255, 255, 0.3)'
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>📸</div>
                    <div style={{ fontSize: '11px', fontWeight: '500', lineHeight: '1.2' }}>Upload your first photo!</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="profile-content-side">
            {/* Achievements */}
            <div className="profile-card profile-achievements">
              <div className="profile-card-title">🏆 Achievements</div>
              <div className="profile-achievements-list">
                <button className="achievements-trigger" onClick={() => setShowAchievements(true)} style={{ width: '100%', padding: '12px', marginBottom: '16px' }}>
                  View All Achievements
                </button>
                <div className="achievements-preview">
                  <div className={`achievement-item ${unlockedAchievements.has(1) ? 'achievement-unlocked' : 'achievement-locked'}`}
                    style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', margin: '6px 0', borderRadius: '8px', background: unlockedAchievements.has(1) ? '#f0f9ff' : '#f9fafb', border: `1px solid ${unlockedAchievements.has(1) ? '#0ea5e9' : '#e5e7eb'}`, minHeight: '50px' }}>
                    <div className="achievement-icon" style={{ fontSize: '20px', marginRight: '10px' }}>🎯</div>
                    <div className="achievement-details" style={{ flex: 1 }}>
                      <h4 className="achievement-title" style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: '600' }}>First Step</h4>
                      <p className="achievement-description" style={{ margin: 0, fontSize: '12px', color: '#666', lineHeight: '1.3' }}>Create your very first itinerary</p>
                    </div>
                  </div>
                  <div className={`achievement-item ${unlockedAchievements.has(5) ? 'achievement-unlocked' : 'achievement-locked'}`}
                    style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', margin: '6px 0', borderRadius: '8px', background: unlockedAchievements.has(5) ? '#f0f9ff' : '#f9fafb', border: `1px solid ${unlockedAchievements.has(5) ? '#0ea5e9' : '#e5e7eb'}`, minHeight: '50px' }}>
                    <div className="achievement-icon" style={{ fontSize: '20px', marginRight: '10px' }}>👤</div>
                    <div className="achievement-details" style={{ flex: 1 }}>
                      <h4 className="achievement-title" style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: '600' }}>Profile Pioneer</h4>
                      <p className="achievement-description" style={{ margin: 0, fontSize: '12px', color: '#666', lineHeight: '1.3' }}>Complete your profile with photo and bio</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="profile-card profile-actions">
              <div className="profile-card-title">⚡ Quick Actions</div>
              <button className="profile-action-btn plan">📌 Plan New Trip</button>
              <button
                className="profile-action-btn share"
                onClick={handleShareProfile}
              >
                🗂️ Share Profile
              </button>
              <button className="profile-action-btn export">💾 Export My Data</button>
              <button className="profile-action-btn settings" onClick={() => setShowInfoDelete(true)}>⚙️ Account Settings</button>
              <button className="profile-action-btn logout" style={{ background: '#3b5fff', marginTop: '8px' }} onClick={handleLogout}>🚪 Logout</button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
            background: "rgba(44, 44, 84, 0.25)", zIndex: 9999, display: "flex",
            alignItems: "center", justifyContent: "center"
          }}
        >
          <EditProfile onClose={() => setShowEditProfile(false)} onProfileUpdate={() => unlockAchievement(5, 'Profile Pioneer')} />
        </div>
      )}

      {/* Achievements Modal */}
      {showAchievements && (
        <Achievements isOpen={showAchievements} onClose={() => setShowAchievements(false)} achievementsData={achievementsData} />
      )}

      {/* Info / Delete Modal */}
      {showInfoDelete && <InfoDelete onClose={() => setShowInfoDelete(false)} />}

      {/* Selected Photo Viewer */}
      {selectedPhoto && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0, 0, 0, 0.9)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 10000
          }}
          onClick={closePhotoView}
        >
          <div
            style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedPhoto.url}
              alt="Expanded"
              style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }}
            />
            <button
              onClick={closePhotoView}
              style={{
                position: 'absolute', top: '10px', right: '10px',
                background: 'rgba(255, 255, 255, 0.8)', border: 'none',
                borderRadius: '50%', width: '32px', height: '32px',
                cursor: 'pointer', fontSize: '20px', display: 'flex',
                alignItems: 'center', justifyContent: 'center'
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
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0, 0, 0, 0.9)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 10001
          }}
          onClick={() => setShowAllPhotos(false)}
        >
          <div
            style={{
              position: 'relative', width: '90%', height: '90%',
              background: 'white', borderRadius: '16px', padding: '24px',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0 }}>{LABELS.ALL_PHOTOS}</h2>
              <button
                onClick={() => setShowAllPhotos(false)}
                style={{
                  background: 'none', border: 'none', fontSize: '24px',
                  cursor: 'pointer', padding: 0, width: '32px', height: '32px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '16px'
              }}
            >
              {photos
                .slice()
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .map((photo) => (
                  <div
                    key={photo.id}
                    style={{
                      position: 'relative',
                      width: '100%',
                      paddingTop: '100%',
                      borderRadius: '14px',
                      overflow: 'hidden',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setSelectedPhoto(photo);
                      setShowAllPhotos(false);
                    }}
                  >
                    <img
                      src={photo.url}
                      alt="Gallery"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePhoto(photo.id);
                      }}
                      style={{
                        position: 'absolute', top: '4px', right: '4px',
                        background: 'rgba(255, 255, 255, 0.8)', border: 'none',
                        borderRadius: '50%', width: '24px', height: '24px',
                        cursor: 'pointer', fontSize: '14px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center'
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
        <div className="sharecode-backdrop" onClick={() => setShowShareCode(false)}>
          <div className="sharecode-card" onClick={(e) => e.stopPropagation()}>
            <div className="sharecode-header">
              <div className="sharecode-title">Share Profile Code</div>
              <button className="sharecode-close" onClick={() => setShowShareCode(false)}>×</button>
            </div>

            <div className="sharecode-body">
              <div className="sharecode-box">{shareCode || "--------"}</div>
              <div className="sharecode-actions">
                <button className="sharecode-btn primary" onClick={copyShareCode}>Copy Code</button>
                <button className="sharecode-btn ghost" onClick={handleShareProfile}>Regenerate</button>
              </div>
              <div className="sharecode-hint">
                Friends can add you by entering this code in Community → Friends.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Profile;