import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './login';
import Register from './register';
import Dashboard, { ChatContext } from './dashboard'; // Import ChatContext
import Profile from './profile';
import Bookmark from './bookmark';
import Bookmarks2 from './bookmarks2';
import StickyHeader from './header';
import './App.css';

function App() {
  const [showChat, setShowChat] = useState(false);

  return (
    <ChatContext.Provider value={{ showChat, setShowChat }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/bookmark" element={<Bookmark />} />
          <Route path="/bookmarks2" element={<Bookmarks2 />} />
          <Route path="/header" element={<StickyHeader />} />
        </Routes>
      </BrowserRouter>
    </ChatContext.Provider>
  );
}

export default App;

// In your Profile component file, make the following change
// Replace
// <a href="#" className="profile-gallery-link">View All (156)</a>
// With
// <button className="profile-gallery-link" onClick={() => {/* your handler */}}>View All (156)</button>

// Also, replace
// <a href="#">Some text</a>
// With
// <button type="button">Some text</button>
