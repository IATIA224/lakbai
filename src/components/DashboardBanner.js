import React from 'react';

function DashboardBanner({ setShowAIModal }) {
  return (
    <div
      className="dashboard-banner"
      style={{
        background: `url("/dashboardBanner.jpg") center/cover no-repeat`
      }}
    >
      <h2>Discover the Philippines with AI-Powered Travel Planning</h2>
      <p>
        Get personalized recommendations, smart packing tips, and connect with fellow travelers to explore the beautiful islands of the Philippines.
      </p>
      <button
        className="dashboard-banner-btn"
        onClick={() => setShowAIModal(true)}
      >
        Start Planning with AI
      </button>
    </div>
  );
}

export default DashboardBanner;
