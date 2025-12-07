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
import ChatbaseAI from './Ai';
import './App.css';
import { UserProvider } from "./UserContext";
import AchievementToast from "./AchievementToast";
import Itinerary from "./Itinerary";
import Footer from './Footer';
import PrivacyPolicy from './privacy_policy';
import LoginCMS from './login-cms';
import ContentManagement from './ContentManagement';
import ProtectedRoute from "./ProtectedRoute";
import { ToastContainer } from 'react-toastify';
import { getAuth, signOut, signInWithEmailAndPassword } from "firebase/auth";
import JeepneyRouteMap from "./itineraryjeeproute";
import ItineraryCostEstimationModal from "./itineraryCostEstimation";
import EditProfile from './EditProfile'; // <-- Import your EditProfile component
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase"; // adjust path if needed

// FIXED: Better authentication check
function isAuthenticated() {
  const token = localStorage.getItem('token');
  const user = getAuth().currentUser;
  
  // Return true if EITHER token exists OR Firebase user is logged in
  const hasToken = typeof token === 'string' && token.trim().length > 0;
  const hasFirebaseUser = !!user;
  
  return hasToken || hasFirebaseUser;
}

function AppInner() {
  const [showAIModal, setShowAIModal] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editProfileData, setEditProfileData] = useState({});
  const location = useLocation();

  useEffect(() => {
    async function checkShowEditProfile() {
      const auth = getAuth();
      const user = auth.currentUser;
      if (location.pathname === "/dashboard" && user) {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          const data = snap.exists() ? snap.data() : {};
          const interests = Array.isArray(data?.interests) ? data.interests : [];
          if (!interests.length) {
            setEditProfileData(data);
            setShowEditProfile(true);
          } else {
            setShowEditProfile(false);
          }
        } catch (e) {
          setShowEditProfile(false);
        }
      } else {
        setShowEditProfile(false);
      }
    }
    checkShowEditProfile();
  }, [location.pathname]);

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

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);

  const handleLogout = async () => {
    localStorage.removeItem('token');
    await signOut(getAuth());
    window.location.href = "/login";
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

          {/* Protected pages - FIXED: Better auth check */}
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
          <Route path="/jeepney-routes" element={<JeepneyRouteMapWrapper />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />

        {/* Privacy Policy */}
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      </Routes>

      {showAIModal && <ChatbaseAI onClose={() => setShowAIModal(false)} />}

      {/* Show EditProfile modal for new users */}
      {showEditProfile && (
        <EditProfile
          initialData={editProfileData}
          onClose={() => setShowEditProfile(false)}
        />
      )}

      <AchievementToast />
      <ToastContainer />
    </UserProvider>
  );
}

export default function App() {
  const inRouter = useInRouterContext();
  if (inRouter) return <AppInner />;

  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}

function JeepneyRouteMapWrapper() {
  const [showModal, setShowModal] = useState(false);
  return (
    <>
      <JeepneyRouteMap onEstimateClick={() => setShowModal(true)} />
      {showModal && (
        <ItineraryCostEstimationModal onClose={() => setShowModal(false)} />
      )}
    </>
  );
}


