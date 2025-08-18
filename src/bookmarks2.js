import React from 'react';
import StickyHeader from './header'; // Add header.js
import './Styles/bookmark2.css';

const destinations = [
  {
    name: "Boracay Island",
    description: "Famous white sand beaches and vibrant nightlife",
    rating: 4.8,
    price: "₱8,000 - ₱25,000",
    image: "/assets/boracay.jpg"
  },
  {
    name: "Banaue Rice Terraces",
    description: "UNESCO World Heritage Site with stunning terraces",
    rating: 4.6,
    price: "₱5,000 - ₱15,000",
    image: "/assets/banaue.jpg"
  },
  {
    name: "Mayon Volcano",
    description: "Perfect cone-shaped active volcano in Albay",
    rating: 4.5,
    price: "₱3,000 - ₱10,000",
    image: "/assets/mayon.jpg"
  }
];

function Bookmarks2() {
  return (
    <>
      
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
              <img 
                src={dest.image} 
                alt={dest.name} 
                style={{ width: "100%", borderRadius: "8px", marginBottom: "12px", objectFit: "cover", height: "140px" }} 
              />
              <h2>{dest.name}</h2>
              <p className="description">{dest.description}</p>
              <div className="rating">⭐ {dest.rating}</div>
              <div className="price">{dest.price}</div>
              <button className="details-btn">View Details</button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default Bookmarks2;
