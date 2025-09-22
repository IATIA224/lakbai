import React, { useState } from 'react';
import { Routes, Route, BrowserRouter, useLocation, useInRouterContext, Navigate } from 'react-router-dom';
import StickyHeader from './header';
import Login from './login';
import Register from './register';
import Dashboard from './dashboard';
import Bookmark from './bookmark';
import Bookmarks2 from './bookmarks2';
import Community from './community';
import Profile from './profile';
import { ChatbaseAIModal } from './Ai';
import './App.css';
import { UserProvider } from "./UserContext";
import AchievementToast from "./AchievementToast";
import Itinerary from "./Itinerary";
import Footer from './Footer';
import LoginCMS from './login-cms';
import ContentManagement from './ContentManagement';
import ProtectedRoute from "./ProtectedRoute";
import Destinations from './bookmarks2'; // <-- Add this import at the top

// New: place all UI that depends on useLocation in this inner component
function isAuthenticated() {
  // Example: check for a token in localStorage (customize as needed)
  return !!localStorage.getItem('token');
}

function AppInner() {
  const [showAIModal, setShowAIModal] = useState(false);
  const location = useLocation();

  // normalize path to avoid flashes on refresh (trailing slash, case, query/hash)
  const normalizePath = (p = '/') => {
    const noQuery = String(p).split('?')[0].split('#')[0];
    const trimmed = noQuery.replace(/\/+$/, '');
    return (trimmed === '' ? '/' : trimmed).toLowerCase();
  };

  const hideHeaderRoutes = [
    '/', '/login', '/register', '/ContentManagement', '/admin/login'
  ];

  const currentPath = normalizePath(location?.pathname || '/');
  const showHeader = !hideHeaderRoutes.includes(currentPath);

  return (
    <UserProvider>
      {showHeader && <StickyHeader setShowAIModal={setShowAIModal} />}

      <Routes>
        {/* ensure root opens login first */}
        <Route
          path="/"
          element={
            isAuthenticated() ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard setShowAIModal={setShowAIModal} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookmark"
          element={
            <ProtectedRoute>
              <Bookmark />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookmarks2"
          element={
            <ProtectedRoute>
              <Bookmarks2 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/community"
          element={
            <ProtectedRoute>
              <Community />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/itinerary"
          element={
            <ProtectedRoute>
              <Itinerary />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ContentManagement"
          element={
            <ProtectedRoute>
              <ContentManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/destinations"
          element={
            <ProtectedRoute>
              <Destinations />
            </ProtectedRoute>
          }
        />
        <Route path="/admin/login" element={<LoginCMS />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>

      {showAIModal && <ChatbaseAIModal onClose={() => setShowAIModal(false)} />}
      <AchievementToast />
      {showHeader && <Footer />}
    </UserProvider>
  );
}

// Replace default export body to mount a Router only if needed
export default function App() {
  // Was: typeof check that caused a conditional hook call lint error
  const inRouter = useInRouterContext(); // safe: returns false if no Router

  if (inRouter) {
    // Already wrapped (e.g., tests use <MemoryRouter>)
    return <AppInner />;
  }

  // Normal app run: provide BrowserRouter
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}


