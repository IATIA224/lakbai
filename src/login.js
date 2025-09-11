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
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

// Use this path if the image is in public/ as "warning (1).png"
// If yours is in public/assets/, change to "/assets/warning%20(1).png"
const ERROR_ICON = "/warning%20(1).png";

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

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(localStorage.getItem('rememberedEmail') || "");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem('rememberedEmail'));
  const [popup, setPopup] = useState({ show: false, type: "", message: "" });
  const [forgotPopup, setForgotPopup] = useState({ show: false });
  const [resetEmail, setResetEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await saveUserToFirestore(userCredential.user);

      if (rememberMe) localStorage.setItem("rememberedEmail", email);
      else localStorage.removeItem("rememberedEmail");

      // Navigate directly (no timers)
      navigate("/dashboard");
    } catch (err) {
      console.error("Email login error:", err);
      const errorMessage = mapAuthError(err.code);
      setPopup({ show: true, type: "error", message: errorMessage });
    }
    // removed setLoading(false); loading is controlled by mount effect
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("profile");
      provider.addScope("email");
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      await saveUserToFirestore(result.user);
      navigate("/dashboard");
    } catch (err) {
      console.error("Google login error:", err);
      const msg = mapAuthError(err.code);
      setPopup({ show: true, type: "error", message: msg });
    }
    // removed setLoading(false)
  };

  const handleFacebookLogin = async () => {
    try {
      const provider = new FacebookAuthProvider();
      provider.addScope("email");
      provider.addScope("public_profile");
      provider.setCustomParameters({ display: "popup" });
      const result = await signInWithPopup(auth, provider);
      await saveUserToFirestore(result.user);
      navigate("/dashboard");
    } catch (err) {
      console.error("Facebook login error:", err);
      const msg = mapAuthError(err.code);
      setPopup({ show: true, type: "error", message: msg });
    }
    // removed setLoading(false)
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

  return (
    <>
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
            <button className="login-social-btn" onClick={handleGoogleLogin} type="button">
              <span className="login-social-icon-wrapper">
                <img src="/google.png" alt="Google" className="login-social-icon" />
              </span>
              Google
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