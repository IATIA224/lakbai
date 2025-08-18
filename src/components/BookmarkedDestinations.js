import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, getDocs, query, where, updateDoc, arrayRemove } from 'firebase/firestore';
import '../Styles/bookmark2.css';

function BookmarkedDestinations() {
  const [bookmarkedDestinations, setBookmarkedDestinations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBookmarkedDestinations = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      const bookmarksRef = doc(db, 'userBookmarks', user.uid);
      const bookmarksDoc = await getDoc(bookmarksRef);

      if (bookmarksDoc.exists()) {
        const bookmarkIds = bookmarksDoc.data().bookmarks || [];
        const destinationsRef = collection(db, 'destinations');
        
        const destinationsSnapshots = await Promise.all(
          bookmarkIds.map(id => getDoc(doc(destinationsRef, id)))
        );

        const destinations = destinationsSnapshots
          .filter(snap => snap.exists())
          .map(snap => ({
            id: snap.id,
            ...snap.data()
          }));

        setBookmarkedDestinations(destinations);
      }
    } catch (error) {
      console.error('Error fetching bookmarked destinations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add remove bookmark function
  const removeBookmark = async (destinationId) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        alert('Please login to remove bookmarks');
        return;
      }

      const bookmarksRef = doc(db, 'userBookmarks', user.uid);
      
      // Remove from Firebase
      await updateDoc(bookmarksRef, {
        bookmarks: arrayRemove(destinationId)
      });

      // Update local state
      setBookmarkedDestinations(prev => 
        prev.filter(dest => dest.id !== destinationId)
      );

      alert('Bookmark removed successfully');
    } catch (error) {
      console.error('Error removing bookmark:', error);
      alert('Failed to remove bookmark');
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        fetchBookmarkedDestinations();
      } else {
        setBookmarkedDestinations([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div className="loading">Loading bookmarks...</div>;

  if (!auth.currentUser) return (
    <div className="login-prompt">
      <h2>Please login to view bookmarks</h2>
      {/* Add your login button/link here */}
    </div>
  );

  return (
    <div className="bookmarked-destinations">
      <h1>My Bookmarked Destinations</h1>
      {bookmarkedDestinations.length === 0 ? (
        <div className="no-bookmarks">
          <p>No bookmarked destinations yet</p>
        </div>
      ) : (
        <div className="grid-container">
          {bookmarkedDestinations.map((dest) => (
            <div className="grid-card" key={dest.id}>
              <div className="image-container">
                <img 
                  src={dest.image}
                  alt={dest.name} 
                  className="destination-image"
                />
                <button 
                  className="remove-bookmark-btn"
                  onClick={() => removeBookmark(dest.id)}
                  title="Remove bookmark"
                >
                  ★
                </button>
              </div>
              <div className="card-content">
                <h2>{dest.name}</h2>
                <p className="description">{dest.description}</p>
                <div className="rating">⭐ {dest.rating}</div>
                <div className="price">{dest.price}</div>
                <button className="details-btn">View Details</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BookmarkedDestinations;