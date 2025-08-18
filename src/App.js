import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './login';
import Register from './register';
import Dashboard from './dashboard';
import Profile from './profile';
import Bookmark from './bookmark';
import Bookmarks2 from './bookmarks2';
import StickyHeader from './header';
import ChatbaseAI from './Ai';
import './App.css';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Community from './community'; // Add this at the top with other imports
// filepath: d:\ReactProj\lakbai\src\App.js

// RequireAuth definition (add this to protect routes)
function RequireAuth({ children }) {
  const [ready, setReady] = React.useState(false);
  const [user, setUser] = React.useState(null);
  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setReady(true); });
    return () => unsub();
  }, []);
  if (!ready) return null;
  return user ? children : <Navigate to="/login" replace />;
}

function App() {
  const [showAIModal, setShowAIModal] = useState(false);

  return (
    <>
      <StickyHeader setShowAIModal={setShowAIModal} />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard setShowAIModal={setShowAIModal} />} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/bookmark" element={<RequireAuth><Bookmark /></RequireAuth>} />
        <Route path="/bookmarks2" element={<RequireAuth><Bookmarks2 /></RequireAuth>} />
        <Route path="/community" element={<RequireAuth><Community /></RequireAuth>} />
      </Routes>
      {showAIModal && (
        <ChatbaseAIModal onClose={() => setShowAIModal(false)} />
      )}
    </>
  );
}

// Modal wrapper for AI
function ChatbaseAIModal({ onClose }) {
  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.25)",
      zIndex: 2000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div style={{
        background: "#6c63ff",
        borderRadius: "1px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        width: "60vw",
        minWidth: "340px",
        maxWidth: "700px",
        minHeight: "500px",
        position: "relative",
        padding: "0"
      }}>
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "#6c63ff",
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            fontSize: "1.2rem",
            cursor: "pointer",
            zIndex: 10
          }}
        >×</button>
        <ChatbaseAI />
      </div>
    </div>
  );
}

export default App;
