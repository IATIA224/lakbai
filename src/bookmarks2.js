import React, { useState } from 'react';
import StickyHeader from './header';
import './Styles/bookmark2.css';

// Local sample data
const initialDestinations = [
  {
    name: "Boracay Island",
    description: "Famous white sand beaches and vibrant nightlife",
    rating: 4.8,
    price: "₱8,000 - ₱25,000",
    image: "/assets/boracay.jpg",
    tags: ["Beach", "Nightlife"],
    bestTime: "Nov–May",
    location: "Aklan, Western Visayas"
  },
  {
    name: "Banaue Rice Terraces",
    description: "UNESCO World Heritage Site with stunning terraces",
    rating: 4.6,
    price: "₱5,000 - ₱15,000",
    image: "/assets/banaue.jpg",
    tags: ["Heritage", "Hiking"],
    bestTime: "Nov–Apr",
    location: "Ifugao, Cordillera"
  },
  {
    name: "Mayon Volcano",
    description: "Perfect cone-shaped active volcano in Albay",
    rating: 4.5,
    price: "₱3,000 - ₱10,000",
    image: "/assets/mayon.jpg",
    tags: ["Volcano", "Sightseeing"],
    bestTime: "Dec–May",
    location: "Albay, Bicol"
  }
];

function Bookmarks2() {
  const [destinations] = useState(initialDestinations);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bookmarkedDestinations, setBookmarkedDestinations] = useState([]);
  const [query, setQuery] = useState("");

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

  const filtered = destinations.filter(d =>
    d.name.toLowerCase().includes(query.toLowerCase()) ||
    d.description.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <StickyHeader />
      <div className="App">
        <h1 className="title">Philippine Destinations</h1>

        <div className="search-filter-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Search destinations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="filters">
            <select className="filter-select"><option>All Regions</option></select>
            <select className="filter-select"><option>All Activities</option></select>
          </div>
        </div>

        <div className="grid-container">
          {filtered.map((destination, index) => (
            <div className="grid-card" key={`${destination.name}-${index}`}>
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
                  title={bookmarkedDestinations.includes(destination.name)
                    ? "Remove bookmark" : "Add to bookmarks"}
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

        {isModalOpen && (
          <div
            className="modal-overlay active"
            onClick={(e) => {
              if (e.target.classList.contains('modal-overlay')) handleCloseModal();
            }}
          >
            <div className="modal-content">
              <div className="modal-header">
                <h2>Destination Details</h2>
                <button className="modal-close-btn" onClick={handleCloseModal}>
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
                          {(selectedDestination.tags || []).map((tag, idx) => (
                            <span className="tag" key={`${tag}-${idx}`}>{tag}</span>
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
                            <span>{selectedDestination.bestTime || '—'}</span>
                          </div>
                        </div>

                        <div className="info-box">
                          <h3>Location</h3>
                          <p>{selectedDestination.location || '—'}</p>
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
