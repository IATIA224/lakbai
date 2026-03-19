import React, { useState } from 'react';
import './AIItineraryPreview.css';

/**
 * Parse AI itinerary response into structured data
 */
function parseAIItinerary(responseText) {
  if (!responseText) return null;
  
  const text = String(responseText);
  
  // Extract title/location
  let title = 'AI Generated Trip';
  let location = '';
  const titleMatch = text.match(/(?:itinerary|trip|plan)\s+(?:for|to)\s+([^:\n]+)/i);
  if (titleMatch) {
    location = titleMatch[1].trim();
    title = `${location} Trip`;
  }
  
  // Extract budget
  let totalBudget = 0;
  const budgetMatch = text.match(/(?:total|estimated|budget)[:\s]+₱?([\d,]+(?:\.\d{2})?)/i);
  if (budgetMatch) {
    totalBudget = parseInt(budgetMatch[1].replace(/,/g, ''), 10);
  }
  
  // Extract days
  const days = [];
  const dayRegex = /day\s+(\d+)[:\s]*([\s\S]*?)(?=day\s+\d+|accommodation|transportation|budget|estimated|$)/gi;
  let dayMatch;
  
  while ((dayMatch = dayRegex.exec(text)) !== null) {
    const dayNum = parseInt(dayMatch[1], 10);
    const dayContent = dayMatch[2].trim();
    const activities = [];
    const activityLines = dayContent.split(/[\n*•-]+/).filter(l => l.trim());
    
    for (const line of activityLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.toLowerCase().includes('day') && trimmed.length > 3) {
        activities.push(trimmed);
      }
    }
    
    days.push({
      day: dayNum,
      activities: activities,
      content: dayContent
    });
  }
  
  // Extract expense breakdown
  const breakdown = [];
  const breakdownRegex = /^[\s]*([^:]+?):\s*[\s\S]*?₱\s*([\d,]+)/gm;
  let breakdownMatch;
  
  while ((breakdownMatch = breakdownRegex.exec(text)) !== null) {
    const category = breakdownMatch[1].trim();
    const amount = parseInt(breakdownMatch[2].replace(/,/g, ''), 10);
    if (!category.toLowerCase().includes('day') && amount > 0) {
      breakdown.push({ category, amount });
    }
  }
  
  // Extract accommodation
  const accomMatch = text.match(/accommodation[:\s]*([\s\S]*?)(?=transportation|budget|$)/i);
  let accommodation = '';
  if (accomMatch) {
    accommodation = accomMatch[1].trim().split('\n')[0];
  }
  
  return {
    title,
    location,
    days,
    totalBudget,
    accommodation,
    breakdown,
    fullText: text
  };
}

export default function AIItineraryPreview({ content, onAddToTrip, onClose }) {
  const [isAdding, setIsAdding] = useState(false);
  const itinerary = parseAIItinerary(content);
  
  if (!itinerary) return null;
  
  const handleAddToTrip = async () => {
    setIsAdding(true);
    try {
      await onAddToTrip(content);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="ai-itn-preview-wrapper">
      {/* HEADER SECTION */}
      <div className="ai-itn-header">
        <div className="ai-itn-header-content">
          <div className="ai-itn-header-icon">🗺️</div>
          <div className="ai-itn-header-text">
            <h2 className="ai-itn-title">{itinerary.title}</h2>
            <p className="ai-itn-subtitle">
              {itinerary.days.length} Days • ₱{itinerary.totalBudget.toLocaleString()}
            </p>
          </div>
        </div>
        <button className="ai-itn-close-btn" onClick={onClose}>×</button>
      </div>

      {/* MAIN CONTENT */}
      <div className="ai-itn-content">
        
        {/* DAYS SECTION */}
        <section className="ai-itn-section days-section">
          <h3 className="ai-itn-section-title">📅 Daily Itinerary</h3>
          <div className="ai-itn-days-grid">
            {itinerary.days.map((day, idx) => (
              <div key={idx} className="ai-itn-day-card">
                <div className="ai-itn-day-header">
                  <span className="ai-itn-day-number">Day {day.day}</span>
                  <span className="ai-itn-day-count">{day.activities.length} activities</span>
                </div>
                <div className="ai-itn-day-activities">
                  {day.activities.map((activity, aIdx) => (
                    <div key={aIdx} className="ai-itn-activity-item">
                      <span className="ai-itn-activity-dot">•</span>
                      <span className="ai-itn-activity-text">{activity}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* EXPENSES SECTION */}
        <section className="ai-itn-section expenses-section">
          <h3 className="ai-itn-section-title">💰 Budget Breakdown</h3>
          <div className="ai-itn-expenses-container">
            {itinerary.breakdown.length > 0 ? (
              <div className="ai-itn-expense-list">
                {itinerary.breakdown.map((item, idx) => (
                  <div key={idx} className="ai-itn-expense-row">
                    <span className="ai-itn-expense-category">{item.category}</span>
                    <span className="ai-itn-expense-amount">
                      ₱{item.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="ai-itn-expense-divider"></div>
                <div className="ai-itn-expense-row ai-itn-expense-total">
                  <span className="ai-itn-expense-category">Total Budget</span>
                  <span className="ai-itn-expense-amount">
                    ₱{itinerary.totalBudget.toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="ai-itn-expense-empty">
                <p>📊 Budget breakdown not specified</p>
                <small>Total: ₱{itinerary.totalBudget.toLocaleString()}</small>
              </div>
            )}
          </div>
        </section>

        {/* ACCOMMODATION SECTION */}
        {itinerary.accommodation && (
          <section className="ai-itn-section accommodation-section">
            <h3 className="ai-itn-section-title">🏨 Accommodation</h3>
            <div className="ai-itn-accommodation-card">
              <p>{itinerary.accommodation}</p>
            </div>
          </section>
        )}
      </div>

      {/* FOOTER / ACTIONS */}
      <div className="ai-itn-footer">
        <button 
          className="ai-itn-btn ai-itn-btn-secondary"
          onClick={onClose}
        >
          Close
        </button>
        <button 
          className="ai-itn-btn ai-itn-btn-primary"
          onClick={handleAddToTrip}
          disabled={isAdding}
        >
          {isAdding ? '⏳ Adding...' : '📋 Add to My Trips'}
        </button>
      </div>
    </div>
  );
}

export { parseAIItinerary };