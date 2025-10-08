import React, { useState } from "react";
import "./info_delete.css";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  deleteUser,
  signOut,
  reauthenticateWithCredential,
  EmailAuthProvider,
  reauthenticateWithPopup
} from "firebase/auth";
import { doc, deleteDoc, collection, getDocs, query, where } from "firebase/firestore";

async function deleteAllUserData(uid) {
  try {
    console.log("Starting deletion for user:", uid);

    // 1. Delete subcollections under /users/{uid}
    const userSubCollections = ["bookmarks", "trips", "notifications", "ratings", "friends"];
    for (const col of userSubCollections) {
      try {
        const colRef = collection(db, "users", uid, col);
        const snap = await getDocs(colRef);
        for (const docItem of snap.docs) {
          await deleteDoc(docItem.ref);
        }
        console.log(`Deleted ${col} subcollection`);
      } catch (err) {
        console.log(`No ${col} to delete:`, err.message);
      }
    }

    // 2. Delete itinerary items under /itinerary/{uid}/items
    try {
      const itnItemsRef = collection(db, "itinerary", uid, "items");
      const itnSnap = await getDocs(itnItemsRef);
      for (const docItem of itnSnap.docs) {
        await deleteDoc(docItem.ref);
      }
      console.log("Deleted itinerary items");
    } catch (err) {
      console.log("No itinerary items to delete:", err.message);
    }

    // 3. Delete main itinerary document /itinerary/{uid}
    try {
      await deleteDoc(doc(db, "itinerary", uid));
      console.log("Deleted itinerary document");
    } catch (err) {
      console.log("No itinerary document to delete:", err.message);
    }

    // 4. Delete userBookmarks
    try {
      await deleteDoc(doc(db, "userBookmarks", uid));
      console.log("Deleted userBookmarks");
    } catch (err) {
      console.log("No userBookmarks to delete:", err.message);
    }

    // 5. Delete photos where userId matches
    try {
      const photosRef = collection(db, "photos");
      const photosQuery = query(photosRef, where("userId", "==", uid));
      const photosSnap = await getDocs(photosQuery);
      for (const photoDoc of photosSnap.docs) {
        await deleteDoc(photoDoc.ref);
      }
      console.log("Deleted photos");
    } catch (err) {
      console.log("No photos to delete:", err.message);
    }

    // 6. Delete activities where userId matches
    try {
      const activitiesRef = collection(db, "activities");
      const activitiesQuery = query(activitiesRef, where("userId", "==", uid));
      const activitiesSnap = await getDocs(activitiesQuery);
      for (const activityDoc of activitiesSnap.docs) {
        await deleteDoc(activityDoc.ref);
      }
      console.log("Deleted activities");
    } catch (err) {
      console.log("No activities to delete:", err.message);
    }

    // 7. Delete travel_map where userId matches
    try {
      const travelMapRef = collection(db, "travel_map");
      const travelMapQuery = query(travelMapRef, where("userId", "==", uid));
      const travelMapSnap = await getDocs(travelMapQuery);
      for (const mapDoc of travelMapSnap.docs) {
        await deleteDoc(mapDoc.ref);
      }
      console.log("Deleted travel_map");
    } catch (err) {
      console.log("No travel_map to delete:", err.message);
    }

    // 8. Delete notifications where userId matches
    try {
      const notificationsRef = collection(db, "notifications");
      const notificationsQuery = query(notificationsRef, where("userId", "==", uid));
      const notificationsSnap = await getDocs(notificationsQuery);
      for (const notifDoc of notificationsSnap.docs) {
        await deleteDoc(notifDoc.ref);
      }
      console.log("Deleted notifications");
    } catch (err) {
      console.log("No notifications to delete:", err.message);
    }

    // 9. Delete community posts where authorId matches
    try {
      const communityRef = collection(db, "community");
      const communityQuery = query(communityRef, where("authorId", "==", uid));
      const communitySnap = await getDocs(communityQuery);
      for (const postDoc of communitySnap.docs) {
        await deleteDoc(postDoc.ref);
      }
      console.log("Deleted community posts");
    } catch (err) {
      console.log("No community posts to delete:", err.message);
    }

    // 10. Delete comments where userId matches
    try {
      const commentsRef = collection(db, "comments");
      const commentsQuery = query(commentsRef, where("userId", "==", uid));
      const commentsSnap = await getDocs(commentsQuery);
      for (const commentDoc of commentsSnap.docs) {
        await deleteDoc(commentDoc.ref);
      }
      console.log("Deleted comments");
    } catch (err) {
      console.log("No comments to delete:", err.message);
    }

    // 11. Delete sharedItineraries where user is sharedBy
    try {
      const sharedRef = collection(db, "sharedItineraries");
      const sharedQuery = query(sharedRef, where("sharedBy", "==", uid));
      const sharedSnap = await getDocs(sharedQuery);
      for (const sharedDoc of sharedSnap.docs) {
        // Delete items subcollection first
        const itemsRef = collection(db, "sharedItineraries", sharedDoc.id, "items");
        const itemsSnap = await getDocs(itemsRef);
        for (const itemDoc of itemsSnap.docs) {
          await deleteDoc(itemDoc.ref);
        }
        // Then delete parent
        await deleteDoc(sharedDoc.ref);
      }
      console.log("Deleted sharedItineraries");
    } catch (err) {
      console.log("No sharedItineraries to delete:", err.message);
    }

    // 12. Finally, delete main user document /users/{uid}
    try {
      await deleteDoc(doc(db, "users", uid));
      console.log("Deleted main user document");
    } catch (err) {
      console.log("No user document to delete:", err.message);
    }

    console.log("All user data deleted successfully");
  } catch (error) {
    console.error("Error deleting user data:", error);
    throw error;
  }
}

const InfoDelete = ({ onClose }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState({ show: false, type: "", message: "" });
  const [confirmModal, setConfirmModal] = useState(false);
  const [deleteType, setDeleteType] = useState("");
  const [userToDelete, setUserToDelete] = useState(null);
  const [userCredentials, setUserCredentials] = useState(null);

  const ConfirmModal = ({ onConfirm, onCancel }) => (
    <div className="info-popup-overlay">
      <div className="info-popup improved-confirm">
        <img 
          src={`${process.env.PUBLIC_URL}/warning.png`}
          alt="Warning" 
          className="info-confirm-icon"
          style={{ width: 48, height: 48, marginBottom: 12 }}
          onError={(e) => {
            console.error("Failed to load warning icon");
            e.target.style.display = 'none';
          }}
        />
        <h3 className="info-confirm-title">Confirm Account Deletion</h3>
        <p className="info-confirm-desc">
          Are you sure you want to permanently delete your account and all associated data?<br />
          <span style={{ color: "#b91c1c", fontWeight: 500 }}>This action cannot be undone.</span>
        </p>
        <div className="info-confirm-actions">
          <button className="info-btn info-btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? "Deleting..." : "Yes, Delete My Account"}
          </button>
          <button className="info-btn info-btn-cancel" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  const handleManualDelete = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setUserToDelete(userCredential.user);
      setUserCredentials({ email, password });
      setDeleteType("manual");
      setConfirmModal(true);
    } catch (err) {
      let errorMessage = err.message;
      
      // Check for permission errors
      if (err.code === 'permission-denied' || errorMessage.includes('permission')) {
        errorMessage = "Missing or insufficient permissions. Please contact support.";
      }
      
      setPopup({ show: true, type: "error", message: errorMessage });
    }
    setLoading(false);
  };

  const handleGoogleDelete = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setUserToDelete(result.user);
      setDeleteType("google");
      setConfirmModal(true);
    } catch (err) {
      let errorMessage = err.message;
      
      // Check for permission errors
      if (err.code === 'permission-denied' || errorMessage.includes('permission')) {
        errorMessage = "Missing or insufficient permissions. Please contact support.";
      }
      
      setPopup({ show: true, type: "error", message: errorMessage });
    }
    setLoading(false);
  };

  const handleFacebookDelete = async () => {
    setLoading(true);
    try {
      const provider = new FacebookAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setUserToDelete(result.user);
      setDeleteType("facebook");
      setConfirmModal(true);
    } catch (err) {
      let errorMessage = err.message;
      
      // Check for permission errors
      if (err.code === 'permission-denied' || errorMessage.includes('permission')) {
        errorMessage = "Missing or insufficient permissions. Please contact support.";
      }
      
      setPopup({ show: true, type: "error", message: errorMessage });
    }
    setLoading(false);
  };

  const handleConfirmDelete = async () => {
    setLoading(true);
    try {
      if (userToDelete) {
        // Re-authenticate user before deletion
        if (deleteType === "manual" && userCredentials) {
          const credential = EmailAuthProvider.credential(
            userCredentials.email,
            userCredentials.password
          );
          await reauthenticateWithCredential(userToDelete, credential);
        } else if (deleteType === "google") {
          const provider = new GoogleAuthProvider();
          await reauthenticateWithPopup(userToDelete, provider);
        } else if (deleteType === "facebook") {
          const provider = new FacebookAuthProvider();
          await reauthenticateWithPopup(userToDelete, provider);
        }

        // Delete all user data from Firestore
        await deleteAllUserData(userToDelete.uid);

        // Delete Firebase Auth user
        await deleteUser(userToDelete);

        // Sign out
        await signOut(auth);

        setPopup({
          show: true,
          type: "success",
          message: "Your account and all data have been deleted successfully. You have been logged out."
        });

        setConfirmModal(false);
        setUserToDelete(null);
        setUserCredentials(null);
      }
    } catch (err) {
      console.error("Delete error:", err);
      
      let errorMessage = err.message || "Failed to delete account. Please try again.";
      
      // Check for specific Firebase permission errors
      if (err.code === 'permission-denied' || 
          err.code === 'insufficient-permission' ||
          errorMessage.includes('Missing or insufficient permissions') ||
          errorMessage.includes('permission-denied')) {
        errorMessage = "Missing or insufficient permissions. Unable to delete account data. Please contact support.";
      }
      
      setPopup({ 
        show: true, 
        type: "error", 
        message: errorMessage
      });
      setConfirmModal(false);
    }
    setLoading(false);
  };

  const handleClosePopup = () => {
    setPopup({ show: false, type: "", message: "" });
    if (popup.type === "success" && onClose) {
      onClose();
      window.location.reload();
    }
  };

  return (
    <div className="info-modal-overlay">
      <div className="info-modal">
        <div className="info-modal-header">
          <span className="info-modal-title">
            <span style={{ color: "#7c3aed", fontWeight: 700, marginRight: 8 }}>▸</span> Account Management
          </span>
          <button className="info-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="info-modal-content">
          <div className="info-alert">
            <span className="info-alert-icon">&#9432;</span>
            <span>
              To delete your account, please log in using your registered method. All your data will be permanently removed.
            </span>
          </div>
          <form className="info-form" onSubmit={handleManualDelete}>
            <label className="info-label">
              Email
              <input
                type="email"
                className="info-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="info-label">
              Password
              <input
                type="password"
                className="info-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </label>
            <div className="info-options">
              <label className="info-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                /> Remember me
              </label>
              <span className="info-forgot" style={{ cursor: "pointer", color: "#3b5fff" }}>Forgot password?</span>
            </div>
            <button className="info-btn" type="submit" disabled={loading}>
              {loading ? "Processing..." : "Delete Account"}
            </button>
          </form>
          <div className="info-divider">
            <span>Or delete with</span>
          </div>
          <div className="info-socials">
            <button className="info-social-btn info-fb" onClick={handleFacebookDelete} type="button" disabled={loading}>
              <span className="info-social-icon-wrapper">
                <img src="/facebook.png" alt="Facebook" className="info-social-icon" />
              </span>
              Facebook
            </button>
            <button className="info-social-btn info-google" onClick={handleGoogleDelete} type="button" disabled={loading}>
              <span className="info-social-icon-wrapper">
                <img src="/google.png" alt="Google" className="info-social-icon" />
              </span>
              Google
            </button>
          </div>
          <div style={{ marginTop: 18, fontSize: "0.95rem", color: "#b91c1c", textAlign: "center" }}>
            <strong>Warning:</strong> This action is irreversible. All your trips, bookmarks, and profile data will be deleted.
          </div>
        </div>
        {confirmModal && (
          <ConfirmModal
            onConfirm={handleConfirmDelete}
            onCancel={() => {
              setConfirmModal(false);
              setUserToDelete(null);
              setDeleteType("");
              setUserCredentials(null);
            }}
          />
        )}
        {popup.show && (
          <div className="info-popup-overlay">
            <div className="info-popup" data-testid="success-popup">
              <img
                src={popup.type === "success" ? "/star.png" : `${process.env.PUBLIC_URL}/warning.png`}
                alt={popup.type === "success" ? "Success" : "Warning"}
                style={{ width: 48, height: 48, marginBottom: 12 }}
                onError={(e) => {
                  console.error("Failed to load popup icon");
                  e.target.style.display = 'none';
                }}
              />
              <h3 style={{ margin: 0, color: popup.type === "success" ? "#3b5fff" : "#b91c1c" }}>
                {popup.type === "success" ? "Success!" : "Error"}
              </h3>
              <p style={{ margin: "8px 0 16px 0" }}>{popup.message}</p>
              <button className="info-btn" onClick={handleClosePopup} style={{ width: "100%" }}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InfoDelete;
