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
import { ToastContainer } from 'react-toastify';

// New: place all UI that depends on useLocation in this inner component
function isAuthenticated() {
  // Only treat as authenticated if token is a non-empty string
  const token = localStorage.getItem('token');
  return typeof token === 'string' && token.trim().length > 0;
}

// Add a separate admin authentication check
function isAdminAuthenticated() {
  const adminToken = localStorage.getItem('adminToken');
  return typeof adminToken === 'string' && adminToken.trim().length > 0;
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
    '/', '/login', '/register', '/admin/login'
  ];

  const currentPath = normalizePath(location?.pathname || '/');
  // Hide header for all /admin routes
  const isAdminRoute = currentPath.startsWith('/admin');
  const showHeader = !hideHeaderRoutes.includes(currentPath) && !isAdminRoute;

  return (
    <UserProvider>
      {showHeader && <StickyHeader setShowAIModal={setShowAIModal} />}

      <Routes>
        {/* User routes */}
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
        {/* Admin routes */}
        <Route path="/admin/login" element={<LoginCMS />} />
        <Route path="/admin/ContentManagement" element={<ContentManagement />} />
        {/* Fallback for unknown user routes */}
        <Route path="/admin/*" element={<Navigate to="/admin/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>

      {showAIModal && <ChatbaseAIModal onClose={() => setShowAIModal(false)} />}
      <AchievementToast />
      {showHeader && <Footer />}
      <ToastContainer />
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


