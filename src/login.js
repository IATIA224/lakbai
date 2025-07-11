import React, { useState } from "react";
import Header2 from "./header_2";
import "./login.css";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "./firebase";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, FacebookAuthProvider } from "firebase/auth";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [popup, setPopup] = useState({ show: false, type: "", message: "" });
  const navigate = useNavigate();

  const handleSignupClick = () => {
    navigate("/register");
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard"); // Redirect to dashboard or home page
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
      await signInWithPopup(auth, provider);
      navigate("/dashboard");
    } catch (err) {
      setPopup({ show: true, type: "error", message: "Google login failed. Please try again." });
    }
  };

  const handleFacebookLogin = async () => {
    try {
      const provider = new FacebookAuthProvider();
      await signInWithPopup(auth, provider);
      navigate("/dashboard");
    } catch (err) {
      setPopup({ show: true, type: "error", message: "Facebook login failed. Please try again." });
    }
  };

  const handleClosePopup = () => {
    setPopup({ show: false, type: "", message: "" });
  };

  return (
    <>
      <Header2 />
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
                <input type="checkbox" /> Remember me
              </label>
              <a href="#" className="login-forgot">Forgot password?</a>
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
              src="/warning(1).png"
              alt="Error"
              style={{ width: 48, marginBottom: 12 }}
            />
            <h3 style={{ margin: 0, color: "#b97b7b" }}>
              Error
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