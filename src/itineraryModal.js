// src/components/ItineraryModal.js
import React from 'react';

function ItineraryModal({ itinerary, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>{itinerary.title}</h2>
        <p>{itinerary.description}</p>
        <hr />
        <ul>
          {itinerary.days.map((day, idx) => (
            <li key={idx}>
              <strong>{day.day}:</strong>
              <ul>
                {day.places.map((place, i) => (
                  <li key={i}>{place}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default ItineraryModal;