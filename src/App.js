import React, { useState, useEffect } from 'react';
import { Routes, Route, BrowserRouter, useLocation, useInRouterContext, Navigate, Outlet } from 'react-router-dom';
import StickyHeader from './header';
import Login from './login';
import Register from './register';
import Dashboard from './dashboard';
import Bookmark from './bookmark';
import Bookmarks2 from './bookmarks2';
import Community from './community';
import Profile from './profile';
import ChatbaseAI, { ChatbaseAIModal } from './Ai';
import './App.css';
import { UserProvider } from "./UserContext";
import AchievementToast from "./AchievementToast";
import Itinerary from "./Itinerary";
import Footer from './Footer';
import LoginCMS from './login-cms';
import ContentManagement from './ContentManagement';
import ProtectedRoute from "./ProtectedRoute";
import { ToastContainer } from 'react-toastify';
import { getAuth, signOut } from "firebase/auth";

// Authentication helpers (unchanged)
function isAuthenticated() {
  const token = localStorage.getItem('token');
  const user = getAuth().currentUser;
  return (typeof token === 'string' && token.trim().length > 0) || !!user;
}

function AppInner() {
  const [showAIModal, setShowAIModal] = useState(false);
  const location = useLocation();
  useEffect(() => {
    const handler = () => setShowAIModal(true);
    window.addEventListener('lakbai:open-ai', handler);
    return () => window.removeEventListener('lakbai:open-ai', handler);
  }, []);

  // MainLayout used only for pages that should have header + footer.
  // Footer is keyed by location so it remounts on navigation.
  function MainLayout() {
    const loc = useLocation();
    return (
      <>
        <StickyHeader setShowAIModal={setShowAIModal} />
        <main id="main-content">
          <Outlet />
        </main>
        <Footer key={loc.pathname + (loc.search || '')} />
      </>
    );
  }

  // GLOBAL SCROLL TO TOP ON ROUTE CHANGE
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);

  const handleLogout = async () => {
    localStorage.removeItem('token');
    await signOut(getAuth());
    window.location.href = "/dashboard"; // Force reload to clear state
  };

  return (
    <UserProvider>
      <Routes>
        {/* Redirect root to dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* MainLayout for all pages with header/footer */}
        <Route element={<MainLayout />}>
          {/* Public pages */}
          <Route path="/dashboard" element={<Dashboard setShowAIModal={setShowAIModal} />} />
          <Route path="/bookmarks2" element={<Bookmarks2 />} />

          {/* Protected pages */}
          <Route
            path="/bookmark"
            element={isAuthenticated() ? <Bookmark /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/community"
            element={isAuthenticated() ? <Community /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/profile"
            element={isAuthenticated() ? <Profile /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/itinerary"
            element={isAuthenticated() ? <Itinerary /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/ai"
            element={isAuthenticated() ? <ChatbaseAI /> : <Navigate to="/login" replace />}
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      {showAIModal && <ChatbaseAIModal onClose={() => setShowAIModal(false)} />}
      <AchievementToast />
      <ToastContainer />
    </UserProvider>
  );
}

// Export wrapped by BrowserRouter if not already in a Router context
export default function App() {
  const inRouter = useInRouterContext();
  if (inRouter) return <AppInner />;

  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}


