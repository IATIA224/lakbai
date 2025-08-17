import React from 'react';
import './Styles/bookmark.css';
import { useNavigate } from 'react-router-dom';
import StickyHeader from './header'; // Add header.js

function Bookmark() {
  const navigate = useNavigate();

  const handleExploreClick = () => {
    navigate('/bookmarks2');
  };

  return (
    <>
      <StickyHeader />
      <div className="App">
        <div className="bookmark-section">
          <h2 className="bookmark-title">
            <span role="img" aria-label="pin">📌</span> My Bookmarks
          </h2>
          <div className="bookmark-card">
            <div className="pin-icon">📍</div>
            <h3>No bookmarks yet</h3>
            <p>Start exploring destinations and bookmark your favorites!</p>
            <button className="explore-btn" onClick={handleExploreClick}>
              Explore Destinations
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default Bookmark;
