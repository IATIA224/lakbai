import React, { useState } from "react";
import "./info_delete.css";
import { auth, db } from "./firebase";
import { signInWithEmailAndPassword, GoogleAuthProvider, FacebookAuthProvider, signInWithPopup, deleteUser } from "firebase/auth";
import { doc, deleteDoc } from "firebase/firestore";

const InfoDelete = ({ onClose }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState({ show: false, type: "", message: "" });

  const handleEmailDelete = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      // Delete Firestore user data
      await deleteDoc(doc(db, "users", user.uid));
      // Delete Auth user
      await deleteUser(user);
      setPopup({ show: true, type: "success", message: "Account deleted successfully." });
    } catch (err) {
      setPopup({ show: true, type: "error", message: err.message });
    }
    setLoading(false);
  };

  const handleGoogleDelete = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      await deleteDoc(doc(db, "users", user.uid));
      await deleteUser(user);
      setPopup({ show: true, type: "success", message: "Google account deleted successfully." });
    } catch (err) {
      setPopup({ show: true, type: "error", message: err.message });
    }
    setLoading(false);
  };

  const handleFacebookDelete = async () => {
    setLoading(true);
    try {
      const provider = new FacebookAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      await deleteDoc(doc(db, "users", user.uid));
      await deleteUser(user);
      setPopup({ show: true, type: "success", message: "Facebook account deleted successfully." });
    } catch (err) {
      setPopup({ show: true, type: "error", message: err.message });
    }
    setLoading(false);
  };

  const handleClosePopup = () => {
    setPopup({ show: false, type: "", message: "" });
    if (popup.type === "success" && onClose) onClose();
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
            <span>Please log in to manage your account settings or delete your account.</span>
          </div>
          <form className="info-form" onSubmit={handleEmailDelete}>
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
              {loading ? "Processing..." : "Sign in"}
            </button>
          </form>
          <div className="info-divider">
            <span>Or continue with</span>
          </div>
          <div className="info-socials">
            <button className="info-social-btn info-fb" onClick={handleFacebookDelete} type="button">
              <span className="info-social-icon-wrapper">
                <img src="/facebook.png" alt="Facebook" className="info-social-icon" />
              </span>
              Facebook
            </button>
            <button className="info-social-btn info-google" onClick={handleGoogleDelete} type="button">
              <span className="info-social-icon-wrapper">
                <img src="/google.png" alt="Google" className="info-social-icon" />
              </span>
              Google
            </button>
          </div>
        </div>
        {popup.show && (
          <div className="info-popup-overlay">
            <div className="info-popup">
              <img
                src={popup.type === "success" ? "/star.png" : "/warning (1).png"}
                alt={popup.type === "success" ? "Success" : "Error"}
                style={{ width: 48, marginBottom: 12 }}
              />
              <h3 style={{ margin: 0, color: popup.type === "success" ? "#3b5fff" : "#b97b7b" }}>
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
