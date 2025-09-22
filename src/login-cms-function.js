import React, { useState, useEffect } from "react";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import ContentManagement from "./ContentManagement";
import "./Styles/login-cms.css";

export default function LoginCMS() {
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [showDemo, setShowDemo] = useState(true);
const [error, setError] = useState("");
const [loading, setLoading] = useState(false);
const [isAdmin, setIsAdmin] = useState(false);
const [checking, setChecking] = useState(true);

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
    // eslint-disable-next-line
}, []);

const handleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
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
    <div className="login-cms-logo">
        <span className="login-cms-logo-icon" role="img" aria-label="logo">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="16" fill="#fff"/>
            <rect x="10" y="14" width="12" height="2" rx="1" fill="#4f2da8"/>
            <rect x="12" y="16" width="8" height="7" rx="1" fill="#4f2da8"/>
            <rect x="14" y="10" width="4" height="4" rx="1" fill="#4f2da8"/>
        </svg>
        </span>
    </div>
    <div className="login-cms-title">TravelCMS Pro</div>
    <div className="login-cms-subtitle">Admin Content Management System</div>
    <div className="login-cms-card">
        <h2>Admin Login</h2>
        <form className="login-cms-form" autoComplete="off" onSubmit={handleSignIn}>
        <label className="login-cms-label" htmlFor="email">Email Address</label>
        <input
            className="login-cms-input"
            id="email"
            type="email"
            placeholder="admin@travelcms.com"
            autoComplete="username"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
        />
        <label className="login-cms-label" htmlFor="password">Password</label>
        <input
            className="login-cms-input"
            id="password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
        />
        <button className="login-cms-btn" type="submit" disabled={loading}>
            <span role="img" aria-label="lock">🔒</span> {loading ? "Signing In..." : "Sign In"}
        </button>
        {error && (
            <div style={{ color: "#d32f2f", marginTop: 8, textAlign: "center", fontSize: "1rem" }}>
            {error}
            </div>
        )}
        </form>
        <div className="login-cms-demo-toggle" style={{ marginTop: 8 }}>
        <input
            type="checkbox"
            id="show-demo"
            checked={showDemo}
            onChange={() => setShowDemo(!showDemo)}
            style={{ accentColor: "#4f2da8" }}
        />
        <label htmlFor="show-demo" style={{ cursor: "pointer" }}>
            Show Demo Credentials
        </label>
        </div>
        {showDemo && (
        <div style={{ color: "#6e3fc6", fontSize: "0.98rem", marginTop: 8, textAlign: "center" }}>
            <b>Demo:</b> admin@travelcms.com / password123
        </div>
        )}
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
        © 2023 TravelCMS Pro. All rights reserved.<br />
        <span style={{ color: "#bdb6e2" }}>Secure Admin Portal v2.1</span>
    </div>
    </div>
);
}