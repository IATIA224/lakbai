import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./header.css";

const navTabs = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Destinations", path: "/bookmarks2" }, // <-- Redirect Destinations to /bookmarks2
  { label: "Bookmarks", path: "/bookmark" },
  { label: "My Trips", path: "/mytrips" },
  { label: "Community", path: "/community" },
  { label: "Admin", path: "/admin" }
];

const StickyHeader = () => {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const navigate = useNavigate();
  const location = useLocation();

  // Sync activeTab with current route
  useEffect(() => {
    const currentTab = navTabs.find(tab => tab.path === location.pathname);
    if (currentTab) {
      setActiveTab(currentTab.label);
    }
  }, [location.pathname]);

  const handleTabClick = (tab) => {
    navigate(tab.path);
    // activeTab will update automatically via useEffect
  };

  // Redirect to AI Assistant page
  const handleAIAssistantClick = () => {
    navigate("/ai");
  };

  return (
    <header className="sticky-header">
      <div className="header-left">
        <img src="/coconut-tree.png" alt="LakbAI Logo" className="logo-icon" />
        <span className="logo-text">LakbAI</span>
      </div>
      <nav className="header-nav">
        {navTabs.map(tab => (
          <span
            key={tab.label}
            onClick={() => handleTabClick(tab)}
            style={{
              cursor: 'pointer',
              borderBottom: activeTab === tab.label ? '3px solid #2962ff' : 'none',
              color: activeTab === tab.label ? '#2962ff' : 'inherit',
              paddingBottom: '4px',
              marginRight: '18px',
              fontWeight: activeTab === tab.label ? 'bold' : 'normal'
            }}
          >
            {tab.label}
          </span>
        ))}
      </nav>
      <div className="header-right">
        <button className="ai-assistant-btn" onClick={handleAIAssistantClick}>
          <span className="dot"></span> AI Assistant
        </button>
        <img
          src="/user.png"
          alt="User"
          className="user-icon"
          onClick={() => navigate('/profile')}
          style={{ cursor: "pointer" }}
        />
      </div>
    </header>
  );
};

export default StickyHeader;