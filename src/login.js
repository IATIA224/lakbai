import React, { useState, useEffect } from "react";
import Header2 from "./header_2";
import "./login.css";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  sendPasswordResetEmail,
  signInWithRedirect,
} from "firebase/auth";
import { doc, setDoc, getDoc, collection, addDoc, getDocs, query, limit, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useUser } from './UserContext';

// CHANGED: Updated icon path
const ERROR_ICON = "/warning.png";

// Function to save user data to Firestore
const saveUserToFirestore = async (user) => {
  if (!user) return;
  try {
    const userRef = doc(db, "users", user.uid);

    const userData = {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      phoneNumber: user.phoneNumber || "",
      providerId: user.providerData?.[0]?.providerId || "email",
      lastLogin: new Date(),
    };

    const snap = await getDoc(userRef); // no .catch here
    if (!snap || !snap.exists?.()) {
      userData.createdAt = new Date();
    }

    await setDoc(userRef, userData, { merge: true });
    console.log("User data saved successfully:", user.uid);
  } catch (error) {
    console.error("Error saving user data:", error);
  }
};

function mapAuthError(code) {
  switch (code) {
    case "auth/user-not-found":
      return "No account found with this email.";
    case "auth/wrong-password":
      return "Incorrect password. Please try again.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/network-request-failed":
      return "Network issue. Check your connection and retry.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/popup-closed-by-user":
      return "Sign-in popup was closed before finishing.";
    default:
      return "Login failed. Please try again.";
  }
}

// Add this helper to get device/browser info
function getDeviceInfo() {
  let device = "Unknown";
  let browser = "Unknown";
  let os = "Unknown";
  let userAgent = navigator.userAgent || "";

  // Device
  if (/Mobi|Android/i.test(userAgent)) device = "Mobile";
  else if (/Tablet|iPad/i.test(userAgent)) device = "Tablet";
  else device = "Desktop";

  // Browser
  if (/chrome|crios|crmo/i.test(userAgent)) browser = "Chrome";
  else if (/firefox|fxios/i.test(userAgent)) browser = "Firefox";
  else if (/safari/i.test(userAgent) && !/chrome|crios|crmo/i.test(userAgent)) browser = "Safari";
  else if (/edg/i.test(userAgent)) browser = "Edge";
  else if (/opr\//i.test(userAgent)) browser = "Opera";
  else if (/msie|trident/i.test(userAgent)) browser = "IE";

  // OS
  if (/windows nt/i.test(userAgent)) os = "Windows";
  else if (/android/i.test(userAgent)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = "iOS";
  else if (/macintosh|mac os x/i.test(userAgent)) os = "MacOS";
  else if (/linux/i.test(userAgent)) os = "Linux";

  return { device, browser, os, userAgent };
}

// Helper to generate a session ID
function generateSessionId() {
  return (
    "sess_" +
    Math.random().toString(36).substr(2, 9) +
    "_" +
    Date.now().toString(36)
  );
}

const MAX_LOGIN_ATTEMPTS = 3;
const LOGIN_ATTEMPT_KEY = "lakbai_login_attempts";

// Helper to track login attempts in localStorage
function incrementLoginAttempts(email) {
  const attempts = JSON.parse(localStorage.getItem(LOGIN_ATTEMPT_KEY) || "{}");
  attempts[email] = (attempts[email] || 0) + 1;
  localStorage.setItem(LOGIN_ATTEMPT_KEY, JSON.stringify(attempts));
  return attempts[email];
}
function resetLoginAttempts(email) {
  const attempts = JSON.parse(localStorage.getItem(LOGIN_ATTEMPT_KEY) || "{}");
  attempts[email] = 0;
  localStorage.setItem(LOGIN_ATTEMPT_KEY, JSON.stringify(attempts));
}

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(localStorage.getItem('rememberedEmail') || "");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem('rememberedEmail'));
  const [popup, setPopup] = useState({ show: false, type: "", message: "" });
  const [forgotPopup, setForgotPopup] = useState({ show: false });
  const [resetEmail, setResetEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useUser();

  // Remove: const REDIRECT_FLAG = "pendingSocialRedirect";

  // REMOVE the entire redirect result useEffect block:
  // useEffect(() => { ... getRedirectResult ... }, [navigate]);

  // ADD simple mount effect to end loading sooner:

  // Remove: const REDIRECT_FLAG = "pendingSocialRedirect";

  // REMOVE the entire redirect result useEffect block:
  // useEffect(() => { ... getRedirectResult ... }, [navigate]);

  // ADD simple mount effect to end loading sooner:
  useEffect(() => {
    setLoading(false);
  }, []);

  const handleSignupClick = () => {
    navigate("/register");
  };

  // Helper: after login, set a flag if interests missing
  async function ensureSetupFlag(uid) {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      const data = snap.exists() ? snap.data() : {};
      const interests = Array.isArray(data?.interests) ? data.interests : [];
      if (!interests.length) {
        localStorage.setItem("SHOW_PROFILE_SETUP", "1");
      } else {
        localStorage.removeItem("SHOW_PROFILE_SETUP");
      }
    } catch (e) {
      // Non-fatal
      console.warn("ensureSetupFlag failed:", e);
    }
  }

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await saveUserToFirestore(userCredential.user);

      // Reset login attempts on successful login
      resetLoginAttempts(email);

      // FIXED: Set token for email login (same as Google)
      const token = await userCredential.user.getIdToken();
      localStorage.setItem('token', token);

      // --- Ensure auditLogs collection exists (create a dummy doc if empty) ---
      const auditLogsSnap = await getDocs(query(collection(db, "auditLogs"), limit(1)));
      if (auditLogsSnap.empty) {
        await addDoc(collection(db, "auditLogs"), {
          timestamp: serverTimestamp(),
          userName: "system",
          userEmail: "",
          role: "system",
          action: "init",
          category: "SYSTEM",
          outcome: "SUCCESS",
          details: "Initialized auditLogs collection.",
        });
      }

      // --- Add audit log for email login ---
      const deviceInfo = getDeviceInfo();
      const sessionId = generateSessionId();
      await addDoc(collection(db, "auditLogs"), {
        timestamp: serverTimestamp(),
        userName: userCredential.user.displayName || "",
        userEmail: userCredential.user.email,
        userId: userCredential.user.uid,
        role: "user",
        action: "login",
        category: "AUTHENTICATION",
        outcome: "SUCCESS",
        details: "Email/Password login",
        provider: "email",
        device: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        userAgent: deviceInfo.userAgent,
        ipAddress: "",
        location: "",
        session: sessionId,
        target: "user_session",
        clientTime: Date.now(),
      });

      // Check if interests exist; mark flag if not
      await ensureSetupFlag(userCredential.user.uid);

      if (rememberMe) localStorage.setItem("rememberedEmail", email);
      else localStorage.removeItem("rememberedEmail");

      // FIXED: Set user context (same as Google)
      if (setUser) setUser({ uid: userCredential.user.uid, email: userCredential.user.email });

      navigate("/dashboard");
    } catch (err) {
      // Increment failed login attempts
      const attempts = incrementLoginAttempts(email);

      // Try to get user info for failed login
      let failedUserName = "";
      let failedUserId = "";
      try {
        // Query Firestore users collection by email
        const usersRef = collection(db, "users");
        const q = query(usersRef);
        const snapshot = await getDocs(q);
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.email === email) {
            failedUserName = data.displayName || "";
            failedUserId = data.uid || "";
          }
        });
      } catch (e) {
        // If lookup fails, leave as blank
      }

      // If max attempts reached, log to auditLogs
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        const deviceInfo = getDeviceInfo();
        const sessionId = generateSessionId();
        await addDoc(collection(db, "auditLogs"), {
          timestamp: serverTimestamp(),
          userName: failedUserName,
          userEmail: email,
          userId: failedUserId,
          role: "user",
          action: "login failed",
          category: "AUTHENTICATION",
          outcome: "FAILURE",
          details: "multiple_failed_attempts",
          provider: "email",
          device: deviceInfo.device,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          userAgent: deviceInfo.userAgent,
          ipAddress: "",
          location: "",
          session: sessionId,
          target: "user_session",
        });
        // Optionally, reset attempts after logging
        resetLoginAttempts(email);
      }

      console.error("Email login error:", err);
      const errorMessage = mapAuthError(err.code);
      setPopup({ show: true, type: "error", message: errorMessage });
    }
    // removed setLoading(false); loading is controlled by mount effect
  };

  const handleGoogleLogin = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    
    const provider = new GoogleAuthProvider();
    provider.addScope("profile");
    provider.addScope("email");
    provider.setCustomParameters({ prompt: "select_account" });
    
    try {
      // FIXED: Use signInWithPopup with error handling
      const result = await signInWithPopup(auth, provider);
      
      if (!result || !result.user) {
        throw new Error("No user returned from Google login");
      }
      
      await saveUserToFirestore(result.user);

      // --- Add audit log for Google login ---
      const deviceInfo = getDeviceInfo();
      const sessionId = generateSessionId();
      await addDoc(collection(db, "auditLogs"), {
        timestamp: serverTimestamp(),
        userName: result.user.displayName || "",
        userEmail: result.user.email,
        userId: result.user.uid,
        role: "user",
        action: "login",
        category: "AUTHENTICATION",
        outcome: "SUCCESS",
        details: "Google login",
        provider: "google",
        device: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        userAgent: deviceInfo.userAgent,
        ipAddress: "",
        location: "",
        session: sessionId,
        target: "user_session",
      });

      // Mark flag if interests are missing
      await ensureSetupFlag(result.user.uid);

      const user = result.user;
      const token = await user.getIdToken();
      localStorage.setItem('token', token);

      if (setUser) setUser({ uid: user.uid, email: user.email });

      // Navigate with replace to clear history
      navigate('/dashboard', { replace: true });
      
    } catch (err) {
      console.error("Google login error:", err);
      
      // FIXED: Handle specific errors better
      if (err.code === "auth/popup-closed-by-user") {
        console.warn("User closed the Google sign-in popup");
        // Don't show error - user intentionally closed it
        return;
      } 
      else if (err.code === "auth/cancelled-popup-request") {
        console.warn("Google sign-in popup was cancelled");
        return;
      }
      else if (err.code === "auth/operation-not-supported-in-this-environment") {
        console.warn("Popups blocked in this environment, trying redirect...");
        try {
          await signInWithRedirect(auth, provider);
        } catch (redirectErr) {
          console.error("Redirect also failed:", redirectErr);
          setPopup({ 
            show: true, 
            type: "error", 
            message: "Could not open Google sign-in. Please check your browser settings." 
          });
        }
        return;
      }
      else {
        // Generic error
        const msg = mapAuthError(err.code) || "Google sign-in failed. Please try again.";
        setPopup({ show: true, type: "error", message: msg });
      }
    } finally {
      setIsSigningIn(false);
    }
    // removed setLoading(false)
  };

  const handleFacebookLogin = async () => {
    setIsSigningIn(true);  // ADD THIS LINE
    
    try {
      const provider = new FacebookAuthProvider();
      provider.addScope("email");
      provider.addScope("public_profile");
      provider.setCustomParameters({ display: "popup" });
      
      const result = await signInWithPopup(auth, provider);
      
      if (!result || !result.user) {
        throw new Error("No user returned from Facebook login");
      }
      
      await saveUserToFirestore(result.user);

      // FIXED: Set token for Facebook login
      const token = await result.user.getIdToken();
      localStorage.setItem('token', token);

      // --- Add audit log for Facebook login ---
      const deviceInfo = getDeviceInfo();
      const sessionId = generateSessionId();
      await addDoc(collection(db, "auditLogs"), {
        timestamp: serverTimestamp(),
        userName: result.user.displayName || "",
        userEmail: result.user.email,
        userId: result.user.uid,
        role: "user",
        action: "login",
        category: "AUTHENTICATION",
        outcome: "SUCCESS",
        details: "Facebook login",
        provider: "facebook",
        device: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        userAgent: deviceInfo.userAgent,
        ipAddress: "",
        location: "",
        session: sessionId,
        target: "user_session",
      });

      // Mark flag if interests are missing
      await ensureSetupFlag(result.user.uid);

      // FIXED: Set user context
      if (setUser) setUser({ uid: result.user.uid, email: result.user.email });

      navigate("/dashboard");
    } catch (err) {
      console.error("Facebook login error:", err);
      
      // FIXED: Handle specific errors better
      if (err.code === "auth/popup-closed-by-user") {
        console.warn("User closed the Facebook sign-in popup");
        // Don't show error - user intentionally closed it
        setIsSigningIn(false);  // ADD THIS
        return;
      }
      else if (err.code === "auth/cancelled-popup-request") {
        console.warn("Facebook sign-in popup was cancelled");
        setIsSigningIn(false);  // ADD THIS
        return;
      }
      else if (err.code === "auth/operation-not-supported-in-this-environment") {
        console.warn("Popups blocked in this environment, trying redirect...");
        try {
          await signInWithRedirect(auth, provider);
        } catch (redirectErr) {
          console.error("Redirect also failed:", redirectErr);
          setPopup({ 
            show: true, 
            type: "error", 
            message: "Could not open Facebook sign-in. Please check your browser settings." 
          });
        }
        setIsSigningIn(false);  // ADD THIS
        return;
      }
      else {
        // Generic error
        const msg = mapAuthError(err.code) || "Facebook sign-in failed. Please try again.";
        setPopup({ show: true, type: "error", message: msg });
        setIsSigningIn(false);  // ADD THIS
      }
    }
  };

  const handleClosePopup = () => {
    setPopup({ show: false, type: "", message: "" });
  };

  const handleForgotPassword = () => {
    setForgotPopup({ show: true });
    setResetEmail("");
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setForgotPopup({ show: false });
      setPopup({ 
        show: true, 
        type: "success", 
        message: "Password reset email sent! Check your inbox and follow the instructions." 
      });
    } catch (err) {
      let errorMessage = "Failed to send reset email. Please try again.";
      if (err.code === "auth/user-not-found") {
        errorMessage = "No account found with this email address.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Please enter a valid email address.";
      }
      setPopup({ show: true, type: "error", message: errorMessage });
    }
  };

  const handleCloseForgotPopup = () => {
    setForgotPopup({ show: false });
    setResetEmail("");
  };

  // wherever the component returns JSX, ensure it returns one root element:
  return (
    <>
      {/* page content */}
      <div className="login-container">
        <Header2 />
        {loading ? (
          <div className="login-bg" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <img src="/coconut-tree.png" alt="Loading" className="login-logo" style={{ width: 60, height: 60 }} />
              <p>Loading...</p>
            </div>
          </div>
        ) : (
        <div className="login-bg">
          {/* Animated background elements */}
          <div className="login-bg-circle"></div>
          <div className="login-bg-circle"></div>
          <div className="login-bg-circle"></div>
          <div className="login-bg-wave"></div>
          <div className="login-bg-dots"></div>
          
          <div className="login-container-1">
            <img src="/coconut-tree.png" alt="LakbAI" className="login-logo" />
            <h2 className="login-title">Welcome Back!</h2>
            <p className="login-subtitle">Sign in to continue your Philippine adventure</p>
            <form className="login-form" onSubmit={handleEmailLogin}>
              <label className="login-label">
                Email Address
                <input 
                  type="email" 
                  className="login-input" 
                  placeholder="your@email.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="login-label">
                Password
                <div className="login-password-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="login-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <span
                    className="login-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={0}
                    role="button"
                    aria-label="Show password"
                  >
                    <img
                      src={showPassword ? "/show.png" : "/hide.png"}
                      alt={showPassword ? "Hide password" : "Show password"}
                      style={{ width: 20, height: 20 }}
                    />
                  </span>
                </div>
              </label>
              <div className="login-options">
                <label className="login-remember">
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  /> Remember me
                </label>
                <span className="login-forgot" onClick={handleForgotPassword} style={{ cursor: "pointer" }}>Forgot password?</span>
              </div>
              <button className="login-btn" type="submit">
                Sign In to LakbAI
              </button>
            </form>
            <div className="login-divider">
              <span>Or continue with</span>
            </div>
            <div className="login-socials">
              <button className="login-social-btn" onClick={handleGoogleLogin} type="button" disabled={isSigningIn}>
                <span className="login-social-icon-wrapper">
                  <img src="/google.png" alt="Google" className="login-social-icon" />
                </span>
                {isSigningIn ? "Signing in…" : "Sign in with Google"}
              </button>
              <button className="login-social-btn" onClick={handleFacebookLogin} type="button">
                <span className="login-social-icon-wrapper">
                  <img src="/facebook.png" alt="Facebook" className="login-social-icon" />
                </span>
                Facebook
              </button>
            </div>
            <div className="login-signup">
              Don’t have an account?{" "}
              <span style={{color: "#3b5fff", cursor: "pointer"}} onClick={handleSignupClick}>
                Sign up for free
              </span>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* modals / toasts / other siblings must be inside this fragment */}
      {forgotPopup.show && (
        <div className="login-popup-overlay" style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          animation: "fadeInOverlay 0.3s ease-out"
        }}>
          <div className="login-popup" style={{
            backgroundColor: "white",
            padding: "30px",
            borderRadius: "12px",
            textAlign: "center",
            maxWidth: "400px",
            width: "90%",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
            animation: "fadeInPopup 0.3s ease-out"
          }}>
            <img
              src="/coconut-tree.png"
              alt="Reset Password"
              style={{ width: 48, marginBottom: 12 }}
            />
            <h3 style={{ margin: 0, color: "#3b5fff" }}>
              Reset Password
            </h3>
            <p style={{ margin: "8px 0 16px 0" }}>Enter your email address and we'll send you a link to reset your password.</p>
            <form onSubmit={handlePasswordReset}>
              <input
                type="email"
                className="login-input"
                placeholder="Enter your email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                style={{ marginBottom: 16, width: "100%", boxSizing: "border-box" }}
                required
              />
              <div style={{ display: "flex", gap: 8, width: "100%" }}>
                <button 
                  type="button"
                  className="login-btn" 
                  onClick={handleCloseForgotPopup} 
                  style={{ flex: 1, backgroundColor: "#ccc", color: "#333" }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="login-btn" 
                  style={{ flex: 1 }}
                >
                  Send Reset Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {popup.show && (
        <div className="login-popup-overlay" style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div className="login-popup" style={{
            backgroundColor: "white",
            padding: "30px",
            borderRadius: "12px",
            textAlign: "center",
            maxWidth: "400px",
            width: "90%",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)"
          }}>
            <img
              src={
                popup.type === "success"
                  ? "/coconut-tree.png"
                  : ERROR_ICON
              }
              alt={popup.type === "success" ? "Success" : "Error"}
              style={{ width: 48, marginBottom: 12 }}
              onError={(e) => {
                e.currentTarget.src = ERROR_ICON;
              }}
            />
            <h3 style={{ margin: 0, color: popup.type === "success" ? "#3b5fff" : "#b97b7b" }}>
              {popup.type === "success" ? "Success!" : "Error"}
            </h3>
            <p style={{ margin: "8px 0 16px 0" }}>{popup.message}</p>
            <button 
              className="login-btn" 
              onClick={handleClosePopup} 
              style={{ width: "100%" }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Login;