import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import cloudinary from './cloudinary';
import { Image } from 'cloudinary-react';
import './Styles/bookmark2.css';

// Initial destinations data
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
  const [authChecked, setAuthChecked] = useState(false);

  // Upload image to Cloudinary
  const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'lakbai_preset'); // Replace with your preset name
    formData.append('cloud_name', 'dxvewejox');
    try {
      const response = await fetch(
        'https://api.cloudinary.com/v1_1/dxvewejox/image/upload',
        { method: 'POST', body: formData }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  // Store initial data in Firebase if not present
  const storeInitialData = async () => {
    try {
      const destinationsRef = collection(db, 'destinations');
      for (const destination of initialDestinations) {
        // Upload image to Cloudinary
        const imageResponse = await fetch(process.env.PUBLIC_URL + destination.image);
        const blob = await imageResponse.blob();
        const imageUrl = await uploadImage(blob);
        await addDoc(destinationsRef, {
          ...destination,
          image: imageUrl,
          createdAt: new Date()
        });
      }
    } catch (error) {
      console.error("Error storing initial data: ", error);
    }
  };

  // Fetch destinations from Firebase
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

  // Fetch user bookmarks from Firebase
  const fetchUserBookmarks = async (userId) => {
    if (!userId) return;
    try {
      const bookmarksRef = doc(db, 'userBookmarks', userId);
      const bookmarksSnap = await getDoc(bookmarksRef);
      if (bookmarksSnap.exists()) {
        const bookmarks = bookmarksSnap.data().bookmarks || [];
        setBookmarkedDestinations(bookmarks);
      } else {
        await setDoc(bookmarksRef, {
          userId,
          bookmarks: [],
          createdAt: serverTimestamp()
        });
        setBookmarkedDestinations([]);
      }
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
      setBookmarkedDestinations([]);
    }
  };

  // Add/remove bookmark for current user
  const handleBookmark = async (destination) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        alert('Please login to bookmark destinations');
        return;
      }
      const userBookmarksRef = doc(db, 'userBookmarks', user.uid);
      const bookmarkDoc = await getDoc(userBookmarksRef);
      let updatedBookmarks = [];
      if (!bookmarkDoc.exists()) {
        updatedBookmarks = [destination.id];
        await setDoc(userBookmarksRef, {
          userId: user.uid,
          bookmarks: updatedBookmarks,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else {
        const currentBookmarks = bookmarkDoc.data().bookmarks || [];
        const isBookmarked = currentBookmarks.includes(destination.id);
        updatedBookmarks = isBookmarked
          ? currentBookmarks.filter(id => id !== destination.id)
          : [...currentBookmarks, destination.id];
        await updateDoc(userBookmarksRef, {
          bookmarks: updatedBookmarks,
          updatedAt: serverTimestamp()
        });
      }
      setBookmarkedDestinations(updatedBookmarks);
      alert(updatedBookmarks.includes(destination.id)
        ? 'Added to bookmarks'
        : 'Removed from bookmarks');
    } catch (error) {
      console.error('Error handling bookmark:', error);
      alert('Failed to update bookmark. Please try again.');
    }
  };

  // Auth state and bookmarks
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserBookmarks(user.uid);
      } else {
        setBookmarkedDestinations([]);
      }
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  // Initialize data and fetch destinations
  useEffect(() => {
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

  if (!authChecked || isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      {/* <StickyHeader /> */} {/* removed to avoid duplicate header */}
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
          {destinations.map((destination, index) => (
            <div className="grid-card" key={index}>
              <div className="image-container">
                {/* If you want to use Cloudinary's <Image> component, replace <img> below */}
                <img
                  src={destination.image}
                  alt={destination.name}
                  className="destination-image"
                />
              </div>
              <div className="card-header">
                <h2>{destination.name}</h2>
                <button
                  className="heart-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBookmark(destination);
                  }}
                >
                  {bookmarkedDestinations.includes(destination.id) ? '❤️' : '🤍'}
                </button>
              </div>
              <p className="description">{destination.description}</p>
              <div className="card-footer">
                <div className="rating">⭐ {destination.rating}</div>
                <div className="price">{destination.price}</div>
              </div>
              <button
                className="details-btn"
                onClick={() => handleViewDetails(destination)}
              >
                View Details
              </button>
            </div>
          ))}
        </div>

        {/* Modal Markup */}
        {isModalOpen && (
          <div
            className="modal-overlay active"
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
                          {selectedDestination.tags && selectedDestination.tags.map((tag, idx) => (
                            <span className="tag" key={idx}>{tag}</span>
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
        )}
      </div>
    </>
  );
}

export default Bookmarks2;
