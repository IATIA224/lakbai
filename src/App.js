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

// Authentication helpers (unchanged)
function isAuthenticated() {
  const token = localStorage.getItem('token');
  return typeof token === 'string' && token.trim().length > 0;
}
function isAdminAuthenticated() {
  const adminToken = localStorage.getItem('adminToken');
  return typeof adminToken === 'string' && adminToken.trim().length > 0;
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

  return (
    <UserProvider>
      <Routes>
        {/* Public / auth routes (no header/footer) */}
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

        {/* Admin routes (no main header/footer) */}
        <Route path="/admin/login" element={<LoginCMS />} />
        <Route
          path="/admin/ContentManagement"
          element={
            <ProtectedRoute>
              <ContentManagement />
            </ProtectedRoute>
          }
        />
        <Route path="/admin/*" element={<Navigate to="/admin/login" replace />} />

        {/* Protected routes that should include header + footer */}
        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard setShowAIModal={setShowAIModal} />} />
          <Route path="/ai" element={<ChatbaseAI />} />
          <Route path="/bookmark" element={<Bookmark />} />
          <Route path="/bookmarks2" element={<Bookmarks2 />} />
          <Route path="/community" element={<Community />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/itinerary" element={<Itinerary />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
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


