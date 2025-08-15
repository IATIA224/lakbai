import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './login';
import Register from './register';
import Dashboard from './dashboard';
import Profile from './profile';
import Bookmark from './bookmark';
import Bookmarks2 from './bookmarks2'; // Import your bookmarks2 component
import StickyHeader from './header';
import logo from './logo.svg';
import './App.css';
import DestinationManager from './DestinationManager';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/bookmark" element={<Bookmark />} />
        <Route path="/bookmarks2" element={<Bookmarks2 />} /> {/* Fixed */}
        <Route path="/header" element={<StickyHeader />} />
        <Route path="/admin/destinations" element={<DestinationManager />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
