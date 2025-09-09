import React, { useState } from 'react';
import { Routes, Route, BrowserRouter, useLocation, useInRouterContext } from 'react-router-dom';
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
// import { AuthProvider } from "./AuthContext";  // REMOVE THIS
import { UserProvider } from "./UserContext";  // ADD THIS
import AchievementToast from "./AchievementToast";
import Itinerary from "./Itinerary";
import DestinationManager from "./DestinationManager";
import UserManagement from "./components/UserManagement";
import ContentManagement from './ContentManagement';
import Footer from './Footer';

// New: place all UI that depends on useLocation in this inner component
function AppInner() {
  const [showAIModal, setShowAIModal] = useState(false);
  // Safe access to pathname when running in tests
  const location = useLocation();
  const hideHeaderRoutes = ['/', '/register', '/admin/ContentManagement'];
  const showHeader = !hideHeaderRoutes.includes(location?.pathname || '/');

  return (
    <UserProvider>  {/* CHANGE THIS FROM AuthProvider TO UserProvider */}
      {showHeader && <StickyHeader setShowAIModal={setShowAIModal} />}

      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard setShowAIModal={setShowAIModal} />} />
        <Route path="/bookmark" element={<Bookmark />} />
        <Route path="/bookmarks2" element={<Bookmarks2 />} />
        <Route path="/community" element={<Community />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/itinerary" element={<Itinerary />} />
        <Route path="/DestinationManager" element={<DestinationManager />} />
        <Route path="/UserManagement" element={<UserManagement />} />
        {/* Admin aliases to match console navigation */}
        <Route path="/admin/user" element={<UserManagement />} />
        <Route path="/admin/destinations" element={<DestinationManager />} />
        <Route path="/admin/ContentManagement" element={<ContentManagement />} />
      </Routes>

      {showAIModal && <ChatbaseAIModal onClose={() => setShowAIModal(false)} />}
      <AchievementToast />

      {/* Footer: hide on login/register */}
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

