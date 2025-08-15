import React, { useState } from 'react';
import './achievements.css';

const Achievements = ({ isOpen, onClose, achievementsData }) => {
  // Use passed achievements data or default to empty array
  const achievements = achievementsData || [];

  // Group achievements by category
  const groupedAchievements = achievements.reduce((acc, achievement) => {
    if (!acc[achievement.category]) {
      acc[achievement.category] = [];
    }
    acc[achievement.category].push(achievement);
    return acc;
  }, {});

  // If not used as a modal, just render the achievements list
  if (typeof isOpen === 'undefined') {
    return (
      <div className="achievements-list">
        {Object.entries(groupedAchievements).map(([category, achievements]) => (
          <div key={category} className="achievements-category">
            <h3 className="achievements-category-title">{category}</h3>
            <div className="achievements-grid">
              {achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className={`achievement-item ${achievement.unlocked ? 'achievement-unlocked' : 'achievement-locked'}`}
                >
                  <div className="achievement-icon">{achievement.icon}</div>
                  <div className="achievement-details">
                    <h4 className="achievement-title">{achievement.title}</h4>
                    <p className="achievement-description">{achievement.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // If used as a modal, render the full modal
  if (!isOpen) return null;

  return (
    <div className="achievements-overlay" onClick={onClose}>
      <div className="achievements-modal" onClick={(e) => e.stopPropagation()}>
        <div className="achievements-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/achievement.png" alt="Achievement" style={{ width: '32px', height: '32px' }} />
            <h2 style={{ margin: 0 }}>Achievements</h2>
          </div>
          <button className="achievements-close" onClick={onClose}>×</button>
        </div>
        <div className="achievements-content">
          {Object.entries(groupedAchievements).map(([category, achievements]) => (
            <div key={category} className="achievements-category">
              <h3 className="achievements-category-title">{category}</h3>
              <div className="achievements-grid">
                {achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className={`achievement-item ${achievement.unlocked ? 'achievement-unlocked' : 'achievement-locked'}`}
                  >
                    <div className="achievement-icon">{achievement.icon}</div>
                    <div className="achievement-details">
                      <h4 className="achievement-title">{achievement.title}</h4>
                      <p className="achievement-description">{achievement.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Achievements;