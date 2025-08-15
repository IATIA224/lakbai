import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import cloudinary from './cloudinary';
import { Image } from 'cloudinary-react';
import './Styles/bookmark2.css';
import StickyHeader from './header';

// Move destinations data to a separate function that will handle Firebase storage
const initialDestinations = [
  {
    name: "Boracay Island",
    description: "Famous white sand beaches and vibrant nightlife",
    rating: 4.8,
    price: "₱8,000 - ₱25,000",
    image: "/assets/boracay.jpg",
    location: "Malay, Aklan, Philippines",
    bestTime: "Nov - May",
    tags: ["Beaches", "Nightlife", "Water Sports", "Luxury"]
  },
  {
    name: "Banaue Rice Terraces",
    description: "UNESCO World Heritage Site with stunning terraces",
    rating: 4.6,
    price: "₱5,000 - ₱15,000",
    image: "/assets/banaue.jpg",
    location: "Ifugao, Philippines",
    bestTime: "Dec - Mar",
    tags: ["Heritage", "Nature", "Culture", "Hiking"]
  },
  {
    name: "Mayon Volcano",
    description: "Perfect cone-shaped active volcano in Albay",
    rating: 4.5,
    price: "₱3,000 - ₱10,000",
    image: "/assets/mayon.jpg",
    location: "Albay, Philippines",
    bestTime: "Feb - Apr",
    tags: ["Volcano", "Adventure", "Nature", "Photography"]
  },
  {
    name: "Chocolate Hills",
    description: "Unique geological formation with conical hills",
    rating: 4.7,
    price: "₱2,000 - ₱8,000",
    image: "/assets/chocolate_hills.jpg",
    location: "Bohol, Philippines",
    bestTime: "Nov - May",
    tags: ["Nature", "Adventure", "Photography"]
  }
];

function Bookmarks2() {
  const [destinations, setDestinations] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [bookmarkedDestinations, setBookmarkedDestinations] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // Function to store initial data in Firebase
  const storeInitialData = async () => {
    try {
      const destinationsRef = collection(db, 'destinations');
      
      for (const destination of initialDestinations) {
        // Upload image to Cloudinary first
        const imageResponse = await fetch(process.env.PUBLIC_URL + destination.image);
        const blob = await imageResponse.blob();
        const imageUrl = await uploadImage(blob);
        
        // Store destination data with Cloudinary URL
        await addDoc(destinationsRef, {
          ...destination,
          image: imageUrl,  // Use Cloudinary URL instead of local path
          createdAt: new Date()
        });
      }
    } catch (error) {
      console.error("Error storing initial data: ", error);
    }
  };

  // Function to fetch destinations from Firebase
  const fetchDestinations = async () => {
    try {
      const destinationsRef = collection(db, 'destinations');
      const snapshot = await getDocs(destinationsRef);
      const destinationsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDestinations(destinationsList);
    } catch (error) {
      console.error("Error fetching destinations: ", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add useEffect for auth state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
      if (user) {
        fetchUserBookmarks(user.uid);
      }
    });

    return () => unsubscribe();
  }, []);

  // Add function to fetch user's bookmarks
  const fetchUserBookmarks = async (userId) => {
    if (!userId) {
      console.log('No user ID provided');
      setBookmarkedDestinations([]);
      return;
    }

    try {
      console.log('Fetching bookmarks for user:', userId);
      const bookmarksRef = doc(db, 'userBookmarks', userId);
      const bookmarksDoc = await getDoc(bookmarksRef);
      
      if (bookmarksDoc.exists()) {
        const bookmarks = bookmarksDoc.data().bookmarks || [];
        console.log('Bookmarks found:', bookmarks);
        setBookmarkedDestinations(bookmarks);
      } else {
        console.log('No bookmarks document found');
        setBookmarkedDestinations([]);
      }
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
      setBookmarkedDestinations([]);
    }
  };

  // Add bookmark handler function
  const handleBookmark = async (destination) => {
    try {
      if (!currentUser) {
        alert('Please login to bookmark destinations');
        return;
      }

      const userBookmarksRef = doc(db, 'userBookmarks', currentUser.uid);

      try {
        const bookmarkDoc = await getDoc(userBookmarksRef);
        const newBookmarks = bookmarkDoc.exists()
          ? bookmarkDoc.data().bookmarks || []
          : [];

        const isBookmarked = newBookmarks.includes(destination.id);

        if (isBookmarked) {
          // Remove bookmark
          await updateDoc(userBookmarksRef, {
            bookmarks: arrayRemove(destination.id),
            updatedAt: serverTimestamp()
          });
          setBookmarkedDestinations(prev => prev.filter(id => id !== destination.id));
        } else {
          // Add bookmark
          if (!bookmarkDoc.exists()) {
            // Create new document
            await setDoc(userBookmarksRef, {
              userId: currentUser.uid,
              bookmarks: [destination.id],
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          } else {
            // Update existing document
            await updateDoc(userBookmarksRef, {
              bookmarks: arrayUnion(destination.id),
              updatedAt: serverTimestamp()
            });
          }
          setBookmarkedDestinations(prev => [...prev, destination.id]);
        }

        // Show success message
        alert(isBookmarked ? 'Removed from bookmarks' : 'Added to bookmarks');

      } catch (error) {
        console.error('Firestore operation failed:', error);
        throw error;
      }

    } catch (error) {
      console.error('Bookmark operation failed:', error);
      alert('Failed to update bookmark. Please try again.');
    }
  };

  // Function to upload image to Cloudinary
  const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'lakbai_preset'); // Replace with your preset name
    formData.append('cloud_name', 'dxvewejox');

    try {
      const response = await fetch(
        'https://api.cloudinary.com/v1_1/dxvewejox/image/upload',
        {
          method: 'POST',
          body: formData
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Upload successful:', data); // Add this to debug
      return data.secure_url;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  useEffect(() => {
    // Check if data exists in Firebase, if not, store initial data
    const initializeData = async () => {
      const destinationsRef = collection(db, 'destinations');
      const snapshot = await getDocs(destinationsRef);
      
      if (snapshot.empty) {
        await storeInitialData();
      }
      
      fetchDestinations();
    };

    initializeData();
  }, []);

  const handleViewDetails = (destination) => {
    setSelectedDestination(destination);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDestination(null);
  };

  if (isLoading) {
    return <div>Loading destinations...</div>;
  }

  return (
    <>
      <StickyHeader />
      <div className="App">
        <h1 className="title">Philippine Destinations</h1>
        <div className="search-filter-wrapper">
          <input type="text" className="search-input" placeholder="Search destinations..." />
          <div className="filters">
            <select className="filter-select"><option>All Regions</option></select>
            <select className="filter-select"><option>All Activities</option></select>
          </div>
        </div>
        <div className="grid-container">
          {destinations.map((dest, index) => (
            <div className="grid-card" key={index}>
              <div className="image-container">
                <img 
                  src={dest.image}
                  alt={dest.name} 
                  style={{ width: "100%", borderRadius: "8px", marginBottom: "12px", objectFit: "cover", height: "140px" }} 
                />
                <button 
                  className={`bookmark-btn ${bookmarkedDestinations.includes(dest.id) ? 'bookmarked' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBookmark(dest);
                  }}
                >
                  {bookmarkedDestinations.includes(dest.id) ? '★' : '☆'}
                </button>
              </div>
              <h2>{dest.name}</h2>
              <p className="description">{dest.description}</p>
              <div className="rating">⭐ {dest.rating}</div>
              <div className="price">{dest.price}</div>
              <button 
                className="details-btn"
                onClick={() => handleViewDetails(dest)}
              >
                View Details
              </button>
            </div>
          ))}
        </div>

        {/* Update Modal Markup */}
        <div 
          className={`modal-overlay ${isModalOpen ? 'active' : ''}`}
          onClick={(e) => {
            if (e.target.classList.contains('modal-overlay')) {
              handleCloseModal();
            }
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h2>Destination Details</h2>
              <button 
                className="modal-close-btn"
                onClick={handleCloseModal}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              {selectedDestination && (
                <>
                  <img 
                    src={selectedDestination.image} 
                    alt={selectedDestination.name} 
                    className="destination-image" 
                  />
                  <div className="destination-info">
                    <div className="destination-details">
                      <h1>{selectedDestination.name}</h1>
                      <p>{selectedDestination.description}</p>
                      
                      <div className="tag-container">
                        {selectedDestination.tags && selectedDestination.tags.map((tag, index) => (
                          <span className="tag" key={index}>{tag}</span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="sidebar">
                      <div className="info-box">
                        <h3>Quick Info</h3>
                        <div className="info-item">
                          <span>⭐️ Rating:</span>
                          <span>{selectedDestination.rating}/5</span>
                        </div>
                        <div className="info-item">
                          <span>💰 Price Range:</span>
                          <span>{selectedDestination.price}</span>
                        </div>
                        <div className="info-item">
                          <span>⏰ Best Time:</span>
                          <span>{selectedDestination.bestTime}</span>
                        </div>
                      </div>
                      
                      <div className="info-box">
                        <h3>Location</h3>
                        <p>{selectedDestination.location}</p>
                      </div>
                      
                      <button className="book-now-btn">Book Now</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Bookmarks2;
