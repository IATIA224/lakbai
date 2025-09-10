import React, { useState } from "react";
import PrivacyPolicy from "./privacy_policy";
import "./register.css";
import Header2 from "./header_2";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

// Simple password strength checker
function getPasswordStrength(password) {
  if (!password) return { label: "", color: "" };
  if (password.length < 6) return { label: "Weak", color: "#b97b7b" };
  if (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  ) {
    return { label: "Strong", color: "#4caf50" };
  }
  return { label: "Medium", color: "#ff9800" };
}

// Email format checker
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Generate 6-digit OTP
//function generateOTP() {
//  return Math.floor(100000 + Math.random() * 900000).toString();
//}

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [popup, setPopup] = useState({ show: false, type: "", message: "" });
  const [showPrivacy, setShowPrivacy] = useState(false);
  const navigate = useNavigate();

  const strength = getPasswordStrength(password);

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/[^\d+]/g, "");
    setPhone(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!agreed) {
      setPopup({ show: true, type: "error", message: "You must agree to the Terms of Service and Privacy Policy." });
      return;
    }
    if (!isValidEmail(email)) {
      setPopup({ show: true, type: "error", message: "Please enter a valid email" });
      return;
    }
    if (password.length < 8) {
      setPopup({ show: true, type: "error", message: "Password must be at least 8 characters long." });
      return;
    }
    if (password !== confirmPassword) {
      setPopup({ show: true, type: "error", message: "Passwords do not match." });
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setPopup({ show: true, type: "error", message: "Please enter your first and last name." });
      return;
    }
    if (!phone.match(/^\+\d{12}$/)) {
      setPopup({ show: true, type: "error", message: "Please enter a valid phone number." });
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Save extra data to Firestore
      await setDoc(doc(db, "users", userCredential.user.uid), {
        firstName,
        lastName,
        phone,
        email
      });

      // Send email verification
      await sendEmailVerification(userCredential.user);

      // Show success popup immediately
      setPopup({
        show: true,
        type: "success",
        message: "Registration successful! Please check your email and verify your account before logging in."
      });

    } catch (err) {
      let errorMessage = err.message;
      if (err.code === "auth/email-already-in-use") {
        errorMessage = "This email is already registered. Please use a different email or sign in.";
      }
      setPopup({ show: true, type: "error", message: errorMessage });
    }
  };

  const handleClosePopup = () => {
    const wasSuccess = popup.type === "success";
    setPopup({ show: false, type: "", message: "" });
    if (wasSuccess) {
      navigate("/"); // Redirect to login page after success
    }
  };

  return (
    <>
      <Header2 />
      {showPrivacy && <PrivacyPolicy onClose={() => setShowPrivacy(false)} />}
      <div className="register-bg">
        <div className="register-container minimized">
          <img src="/star.png" alt="Join LakbAI" className="register-logo" />
          <h2 className="register-title">Join LakbAI</h2>
          <p className="register-subtitle">Start your Philippine travel journey today</p>
          <form className="register-form" onSubmit={handleSubmit}>
            <div className="register-row">
              <label className="register-label">
                First Name
                <input
                  type="text"
                  className="register-input"
                  placeholder="Juan"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  maxLength={30}
                />
              </label>
              <label className="register-label">
                Last Name
                <input
                  type="text"
                  className="register-input"
                  placeholder="Dela Cruz"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  maxLength={30}
                />
              </label>
            </div>
            <label className="register-label">
              Email Address
              <input
                type="email"
                className="register-input"
                placeholder="your@email.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={50}
              />
            </label>
            <label className="register-label">
              Phone Number
              <input
                type="tel"
                className="register-input"
                placeholder="+639XXXXXXXXX"
                autoComplete="tel"
                value={phone}
                onChange={handlePhoneChange}
                maxLength={13}
              />
            </label>
            <label className="register-label">
              Password
              <div className="register-password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  className="register-input"
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ minWidth: 0 }}
                  autoComplete="new-password"
                  maxLength={30}
                />
                <span
                  className="register-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={0}
                  role="button"
                  aria-label="Show password"
                >
                  <img
                    src={showPassword ? "/hide.png" : "/show.png"}
                    alt={showPassword ? "Hide password" : "Show password"}
                    style={{ width: 20, height: 20 }}
                  />
                </span>
              </div>
              <div
                className="register-password-strength"
                style={{ color: strength.color }}
              >
                {strength.label}
              </div>
            </label>
            <label className="register-label">
              Confirm Password
              <div className="register-password-wrapper">
                <input
                  type={showConfirm ? "text" : "password"}
                  className="register-input"
                  placeholder="Confirm your password"
                  style={{ minWidth: 0 }}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  maxLength={30}
                />
                <span
                  className="register-eye"
                  onClick={() => setShowConfirm((v) => !v)}
                  tabIndex={0}
                  role="button"
                  aria-label="Show password"
                >
                  <img
                    src={showConfirm ? "/hide.png" : "/show.png"}
                    alt={showConfirm ? "Hide password" : "Show password"}
                    style={{ width: 20, height: 20 }}
                  />
                </span>
              </div>
            </label>
            <div className="register-options">
              <label className="register-checkbox">
                <input
                  type="checkbox"
                  style={{ marginRight: 6 }}
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                />
                <span>
                  I agree to the{" "}
                  <a href="https://www.messenger.com/t/8823197721118010/" className="register-link" onClick={e => { e.preventDefault(); window.tempInfoDelete = window.tempInfoDelete || (() => { const root = document.createElement('div'); document.body.appendChild(root); import('./info_delete').then(({ default: InfoDelete }) => { const close = () => { root.remove(); window.tempInfoDelete = null; }; import('react-dom').then(ReactDOM => { ReactDOM.createRoot(root).render(<InfoDelete onClose={close} />); }); }); }); window.tempInfoDelete(); }}>Terms of Service</a> and{" "}
                  <a href="https://www.messenger.com/t/8823197721118010/" className="register-link" onClick={e => { e.preventDefault(); setShowPrivacy(true); }}>Privacy Policy</a>
                </span>
              </label>
            </div>
            <button
              className="register-btn"
              type="submit"
              disabled={!agreed}
              style={{
                opacity: agreed ? 1 : 0.6,
                cursor: agreed ? "pointer" : "not-allowed"
              }}
            >
              Create LakbAI Account
            </button>
          </form>
          <div className="register-signin">
            Already have an account? <Link to="/">Sign in here</Link>
          </div>
        </div>
      </div>
      {popup.show && (
        <div className="register-popup-overlay">
          <div className="register-popup">
            <img
              src={popup.type === "success" ? "/star.png" : "/warning (1).png"}
              alt={popup.type === "success" ? "Success" : "Error"}
              style={{ width: 48, marginBottom: 12 }}
            />
            <h3 style={{ margin: 0, color: popup.type === "success" ? "#3b5fff" : "#b97b7b" }}>
              {popup.type === "success" ? "Success!" : "Error"}
            </h3>
            <p style={{ margin: "8px 0 16px 0" }}>{popup.message}</p>
            <button className="register-btn" onClick={handleClosePopup} style={{ width: "100%" }}>
              {popup.type === "success" ? "Go to Login" : "Close"}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Register;
