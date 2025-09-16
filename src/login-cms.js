import React, { useState, useEffect } from "react";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import ContentManagement from "./ContentManagement";
import "./Styles/login-cms.css";
import { FaEye, FaEyeSlash } from "react-icons/fa"; // Add this line if using react-icons

export default function LoginCMS() {
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [error, setError] = useState("");
const [loading, setLoading] = useState(false);
const [isAdmin, setIsAdmin] = useState(false);
const [checking, setChecking] = useState(true);
const [showPassword, setShowPassword] = useState(false);
const [emailError, setEmailError] = useState(""); // New state for email error

const auth = getAuth();
const db = getFirestore();

// Check auth state and admin status
useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
    if (user) {
        const adminDoc = await getDoc(doc(db, "Admin", user.uid));
        if (adminDoc.exists() && adminDoc.data().role === "admin") {
        setIsAdmin(true);
        } else {
        setIsAdmin(false);
        setError("Access denied: You are not an admin.");
        }
    } else {
        setIsAdmin(false);
    }
    setChecking(false);
    });
    return () => unsub();
}, [auth, db]);

const handleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setEmailError(""); // Clear email error on submit
    try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    const user = userCred.user;
    const adminDoc = await getDoc(doc(db, "Admin", user.uid));
    if (!adminDoc.exists() || adminDoc.data().role !== "admin") {
        setError("Access denied: You are not an admin.");
        setLoading(false);
        return;
    }
    setIsAdmin(true);
    } catch (err) {
    setError(
        err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credentials"
        ? "Error Logging In: Invalid Credential."
        : err.message
    );
    setLoading(false);
    }
};

if (checking) {
    return (
    <div className="login-cms-container">
        <div className="login-cms-card">
        <div style={{ textAlign: "center", fontSize: 18, color: "#4f2da8" }}>Checking authentication...</div>
        </div>
    </div>
    );
}

if (isAdmin) {
    return <ContentManagement />;
}

return (
    <div className="login-cms-container">
    <div className="login-cms-bg">
    <div className="login-cms-title">LakbAI</div>
    <div className="login-cms-subtitle">Content Management System</div>
    <div className="login-cms-card">
        <h2>Admin Login</h2>
        <form className="login-cms-form" autoComplete="off" onSubmit={handleSignIn}>
        <label className="login-cms-label" htmlFor="email">Email Address</label>
        <input
            className="login-cms-input"
            id="email"
            type="email"
            placeholder="admin@gmail.com"
            autoComplete="username"
            value={email}
            onChange={e => {
            setEmail(e.target.value);
            setEmailError(""); // clear error on change
            }}
            onBlur={e => {
            // Simple email validation
            if (e.target.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value)) {
                setEmailError("Please enter a valid email address.");
            }
            }}
            required
        />
        {emailError && (
        <div style={{
            color: "#d32f2f",
            marginTop: 4,
            marginBottom: 2,
            fontSize: "0.98rem",
            textAlign: "left",
            width: "100%"
        }}>
            {emailError}
        </div>
        )}
        <label className="login-cms-label" htmlFor="password">Password</label>
        <div className="login-cms-password-wrapper">
        <input
            className="login-cms-input"
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
        />
        <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((v) => !v)}
            className="login-cms-password-eye-btn"
            tabIndex={-1}
        >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
        </button>
        </div>
        <button className="login-cms-btn" type="submit" disabled={loading}>
            <span role="img" aria-label="lock">🔒</span> {loading ? "Signing In..." : "Sign In"}
        </button>
        {error && (
            <div style={{ color: "#d32f2f", marginTop: 8, textAlign: "center", fontSize: "1rem" }}>
            {error}
            </div>
        )}
        </form>
        <div className="login-cms-security" style={{ marginTop: 18 }}>
        <span className="icon" role="img" aria-label="security">🔒</span>
        <span>
            <b>Security Notice</b>
            <br />
            <span style={{ fontWeight: 400 }}>
            This is a demo system. In production, use strong passwords and enable two-factor authentication.
            </span>
        </span>
        </div>
    </div>
    <div className="login-cms-footer">
        © 2025 LakbAI. All rights reserved.<br />
        <span style={{ color: "#bdb6e2" }}>Secure Admin Portal v2.1</span>
    </div>
    </div>
    </div>
);
}