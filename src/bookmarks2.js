import React, { useState, useEffect } from 'react';
import StickyHeader from './header';
import './Styles/bookmark2.css';

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

// Add your Firebase imports here if needed:
// import { db, auth } from './firebase';
// import { collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

function Bookmarks2() {
  const [destinations, setDestinations] = useState(initialDestinations);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [bookmarkedDestinations, setBookmarkedDestinations] = useState([]);

  // Example: handle bookmark locally (replace with Firebase logic if needed)
  const handleBookmark = (destination) => {
    setBookmarkedDestinations((prev) =>
      prev.includes(destination.name)
        ? prev.filter((name) => name !== destination.name)
        : [...prev, destination.name]
    );
  };

  const handleViewDetails = (destination) => {
    setSelectedDestination(destination);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDestination(null);
  };

  if (isLoading) {
    return <div>Loading...</div>;
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
          {destinations.map((destination, index) => (
            <div className="grid-card" key={index}>
              <div className="image-container">
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
                  {bookmarkedDestinations.includes(destination.name) ? '❤️' : '🤍'}
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
