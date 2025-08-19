import React, { useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
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

function App() {
  const [showAIModal, setShowAIModal] = useState(false);
  const location = useLocation();

  // Hide StickyHeader on login/register pages
  const hideHeaderRoutes = ['/', '/register'];
  const showHeader = !hideHeaderRoutes.includes(location.pathname);

  return (
    <UserProvider>
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
      </Routes>

      {showAIModal && <ChatbaseAIModal onClose={() => setShowAIModal(false)} />}
      <AchievementToast />
    </UserProvider>
  );
}

export default App;

