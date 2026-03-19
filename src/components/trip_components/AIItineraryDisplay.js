import React, { useState } from 'react';
import './AIItineraryDisplay.css';

export default function AIItineraryDisplay({ data }) {
  const [expandedDay, setExpandedDay] = useState(null);

  if (!data) return null;

  const { 
    title = 'Trip', 
    location = '', 
    totalBudget = 0, 
    accommodation = '', 
    days = [], 
    breakdown = [] 
  } = data;

  return (
    <div className="ai-itn-display">
      {/* Header */}
      <div className="ai-itn-display-header">
        <div className="ai-itn-display-hero">
          <h2 className="ai-itn-display-title">🗺️ {title}</h2>
          {location && (
            <p className="ai-itn-display-location">📍 {location}</p>
          )}
        </div>
        <div className="ai-itn-display-stats">
          <div className="ai-itn-display-stat">
            <span className="ai-itn-display-stat-label">Days</span>
            <span className="ai-itn-display-stat-value">{days.length || 0}</span>
          </div>
          <div className="ai-itn-display-stat">
            <span className="ai-itn-display-stat-label">Budget</span>
            <span className="ai-itn-display-stat-value">₱{(totalBudget || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Days Section */}
      {Array.isArray(days) && days.length > 0 && (
        <div className="ai-itn-display-section">
          <h3 className="ai-itn-display-section-title">📅 Daily Itinerary</h3>
          <div className="ai-itn-display-days">
            {days.map((day, idx) => (
              <div
                key={idx}
                className={`ai-itn-display-day ${expandedDay === idx ? 'expanded' : ''}`}
                onClick={() => setExpandedDay(expandedDay === idx ? null : idx)}
              >
                <div className="ai-itn-display-day-header">
                  <span className="ai-itn-display-day-badge">Day {day.day || idx + 1}</span>
                  <span className="ai-itn-display-day-activities">
                    {Array.isArray(day.activities) ? day.activities.length : 0} activities
                  </span>
                  <span className="ai-itn-display-toggle">▼</span>
                </div>

                {expandedDay === idx && Array.isArray(day.activities) && day.activities.length > 0 && (
                  <div className="ai-itn-display-day-activities-list">
                    {day.activities.map((activity, aIdx) => (
                      <div key={aIdx} className="ai-itn-display-activity">
                        <span className="ai-itn-display-activity-bullet">•</span>
                        <span>{String(activity)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget Section */}
      {Array.isArray(breakdown) && breakdown.length > 0 && (
        <div className="ai-itn-display-section">
          <h3 className="ai-itn-display-section-title">💰 Budget Breakdown</h3>
          <div className="ai-itn-display-breakdown">
            {breakdown.map((item, idx) => (
              <div key={idx} className="ai-itn-display-breakdown-row">
                <span className="ai-itn-display-breakdown-label">{item.category || 'Item'}</span>
                <span className="ai-itn-display-breakdown-value">₱{(item.amount || 0).toLocaleString()}</span>
              </div>
            ))}
            <div className="ai-itn-display-breakdown-divider"></div>
            <div className="ai-itn-display-breakdown-total">
              <span className="ai-itn-display-breakdown-label">Total</span>
              <span className="ai-itn-display-breakdown-total-value">₱{(totalBudget || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Accommodation */}
      {accommodation && (
        <div className="ai-itn-display-section">
          <h3 className="ai-itn-display-section-title">🏨 Accommodation</h3>
          <div className="ai-itn-display-accommodation">
            <p>{accommodation}</p>
          </div>
        </div>
      )}
    </div>
  );
}