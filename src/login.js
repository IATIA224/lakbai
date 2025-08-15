import React, { useState, useEffect } from "react";
import Header2 from "./header_2";
import "./login.css";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "./firebase";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, FacebookAuthProvider, sendPasswordResetEmail, getRedirectResult } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
// Function to save user data to Firestore
const saveUserToFirestore = async (user) => {
  if (!user) return;

  try {
    const userRef = doc(db, 'users', user.uid);

    // Always create or update user data
    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || '', // <-- user's name from Google/Facebook
      photoURL: user.photoURL || '',
      phoneNumber: user.phoneNumber || '',
      providerId: user.providerData[0]?.providerId || 'email',
      lastLogin: new Date()
    };

    // Save only name and email for Google/Facebook
    if (user.providerData[0]?.providerId === "google.com" || user.providerData[0]?.providerId === "facebook.com") {
      userData.name = user.displayName || '';
      userData.email = user.email || '';
    }

    // Check if user document already exists
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      userData.createdAt = new Date();
    }

    await setDoc(userRef, userData, { merge: true });
    console.log("User data saved successfully:", user.uid);
  } catch (error) {
    console.error("Error saving user data:", error);
  }
};

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
  
  // Handle redirect result from social logins
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        setLoading(true);
        const result = await getRedirectResult(auth);
        
        if (result) {
          // User successfully authenticated with a provider
          const user = result.user;
          console.log("Social login successful:", user.email);
          
          // Save user data to Firestore and wait for it to finish
          await saveUserToFirestore(user);
          
          // Use SPA navigation
          navigate("/dashboard");
        }
      } catch (error) {
        console.error("Authentication error:", error);
        setPopup({ 
          show: true, 
          type: "error", 
          message: "Authentication failed. Please try again." 
        });
      } finally {
        setLoading(false);
      }
    };
    handleRedirectResult();
  }, [navigate]);

  const handleSignupClick = () => {
    navigate("/register");
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Save user data to Firestore
      await saveUserToFirestore(userCredential.user);
      
      // Handle remember me
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }
      
      // Use window.location.href for consistent navigation behavior
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 500);
    } catch (err) {
      let errorMessage = "Login failed. Please try again.";
      if (err.code === "auth/user-not-found") {
        errorMessage = "No account found with this email.";
      } else if (err.code === "auth/wrong-password") {
        errorMessage = "Incorrect password.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Please enter a valid email address.";
      }
      setPopup({ show: true, type: "error", message: errorMessage });
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      await saveUserToFirestore(user);
      navigate("/dashboard");
    } catch (err) {
      setPopup({ show: true, type: "error", message: "Google login failed. Please try again." });
    }
  };

  const handleFacebookLogin = async () => {
    try {
      const provider = new FacebookAuthProvider();
      provider.addScope('email');
      provider.addScope('public_profile');
      provider.setCustomParameters({ display: 'popup' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      await saveUserToFirestore(user);
      navigate("/dashboard");
    } catch (err) {
      setPopup({ show: true, type: "error", message: "Facebook login failed. Please try again." });
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
        <div className="login-container">
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
              src={popup.type === "success" ? "/coconut-tree.png" : "/warning(1).png"}
              alt={popup.type === "success" ? "Success" : "Error"}
              style={{ width: 48, marginBottom: 12 }}
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