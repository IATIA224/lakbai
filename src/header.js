import React, { useContext, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./header.css";
import { ChatContext } from './dashboard'; // Import ChatContext

const navTabs = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Destinations", path: "/bookmarks2" }, // <-- Redirect Destinations to /bookmarks2
  { label: "Bookmarks", path: "/bookmark" },
  { label: "My Trips", path: "/mytrips" },
  { label: "Community", path: "/community" },
  { label: "Admin", path: "/admin" }
];

const StickyHeader = () => {
  const { showChat, setShowChat } = useContext(ChatContext); // Use context
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
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

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      setMessages([
        ...messages,
        { type: "user", text: inputMessage },
        { type: "ai", text: "Hello! I'm your AI assistant. How can I help you today?" },
      ]);
      setInputMessage("");
    }
  };

  const handleTabClick = (tab) => {
    navigate(tab.path);
    // activeTab will update automatically via useEffect
  };

  return (
    <>
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
          <button className="ai-assistant-btn" onClick={() => setShowChat(!showChat)}>
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
      {showChat && (
        <div
          className="chatbox"
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px", // <-- Change 'left' to 'right'
            width: "300px",
            height: "400px",
            backgroundColor: "white",
            border: "1px solid #ddd",
            borderRadius: "12px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "15px",
              borderBottom: "1px solid #eee",
              backgroundColor: "#6c63ff",
              color: "white",
              borderRadius: "12px 12px 0 0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <img
                src="/lakbai-logo.png" // Place your logo image in public folder as lakbai-logo.png
                alt="LakbAI Logo"
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  background: "#fff"
                }}
              />
              <span style={{ fontWeight: "bold" }}>AI Assistant</span>
            </div>
            <button
              onClick={() => setShowChat(false)}
              style={{
                background: "none",
                border: "none",
                color: "white",
                fontSize: "18px",
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
          <div
            style={{
              flex: 1,
              padding: "10px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {messages.length === 0 ? (
              <div style={{ color: "#666", textAlign: "center", marginTop: "20px" }}>
                Hi! I'm your AI assistant. Ask me anything!
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    maxWidth: "80%",
                    alignSelf: msg.type === "user" ? "flex-end" : "flex-start",
                    backgroundColor: msg.type === "user" ? "#6c63ff" : "#f0f0f0",
                    color: msg.type === "user" ? "white" : "#333",
                    fontSize: "14px",
                  }}
                >
                  {msg.text}
                </div>
              ))
            )}
          </div>
          <div
            style={{
              padding: "10px",
              borderTop: "1px solid #eee",
              display: "flex",
              gap: "8px",
            }}
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Type your message..."
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: "20px",
                outline: "none",
                fontSize: "14px",
              }}
            />
            <button
              onClick={handleSendMessage}
              style={{
                backgroundColor: "#6c63ff",
                color: "white",
                border: "none",
                borderRadius: "6px", // Changed from "50%" to "6px" for rectangle shape
                width: "70px",       // Wider for rectangle
                height: "36px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold"
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default StickyHeader;