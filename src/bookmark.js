import React, { useState, useEffect } from 'react';
import './Styles/bookmark.css';
import { useNavigate } from 'react-router-dom';
import { db, auth } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

function Bookmark() {
  const navigate = useNavigate();
  const [bookmarkedDestinations, setBookmarkedDestinations] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchBookmarkedDestinations(user.uid);
      } else {
        setBookmarkedDestinations([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchBookmarkedDestinations = async (userId) => {
    try {
      const bookmarksRef = doc(db, 'userBookmarks', userId);
      const bookmarksDoc = await getDoc(bookmarksRef);

      if (!bookmarksDoc.exists()) {
        setBookmarkedDestinations([]);
        return;
      }

      const bookmarkIds = bookmarksDoc.data().bookmarks || [];
      const destinationPromises = bookmarkIds.map(async (id) => {
        const destRef = doc(db, 'destinations', id);
        const destDoc = await getDoc(destRef);
        if (destDoc.exists()) {
          return { id: destDoc.id, ...destDoc.data() };
        }
        return null;
      });

      const destinations = await Promise.all(destinationPromises);
      setBookmarkedDestinations(destinations.filter(dest => dest !== null));
    } catch (error) {
      console.error('Error fetching bookmarked destinations:', error);
      setBookmarkedDestinations([]);
    }
  };

  const handleExploreClick = () => {
    navigate('/bookmarks2');
  };

  const removeBookmark = async (destinationId) => {
    try {
      if (!currentUser) {
        alert('Please login to manage bookmarks');
        return;
      }

      const userBookmarksRef = doc(db, 'userBookmarks', currentUser.uid);
      const bookmarksDoc = await getDoc(userBookmarksRef);

      if (bookmarksDoc.exists()) {
        const currentBookmarks = bookmarksDoc.data().bookmarks || [];
        const updatedBookmarks = currentBookmarks.filter(id => id !== destinationId);

        await updateDoc(userBookmarksRef, {
          bookmarks: updatedBookmarks,
          updatedAt: new Date().toISOString()
        });

        setBookmarkedDestinations(prev => 
          prev.filter(dest => dest.id !== destinationId)
        );
      }
    } catch (error) {
      console.error('Error removing bookmark:', error);
      alert('Failed to remove bookmark. Please try again.');
    }
  };

  return (
    <div className="App">
      <div className="bookmark-section">
        <h2 className="bookmark-title">
          <span role="img" aria-label="pin">📌</span> My Bookmarks
        </h2>
        {bookmarkedDestinations.length > 0 ? (
          <div className="bookmarks-grid">
            {bookmarkedDestinations.map((destination) => (
              <div key={destination.id} className="bookmark-card">
                <img 
                  src={destination.image} 
                  alt={destination.name}
                  className="bookmark-image"
                />
                <div className="bookmark-content">
                  <h3>{destination.name}</h3>
                  <button 
                    className="heart-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBookmark(destination.id);
                    }}
                  >
                    ❤️
                  </button>
                  <p className="description">{destination.description}</p>
                  <div className="bookmark-details">
                    <span className="rating">⭐ {destination.rating}</span>
                    <span className="price">{destination.price}</span>
                  </div>
                  <div className="tag-container">
                    {destination.tags && destination.tags.map((tag, index) => (
                      <span key={index} className="tag">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bookmark-card empty-state">
            <div className="pin-icon">📍</div>
            <h3>No bookmarks yet</h3>
            <p>Start exploring destinations and bookmark your favorites!</p>
            <button className="explore-btn" onClick={handleExploreClick}>
              Explore Destinations
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Bookmark;
