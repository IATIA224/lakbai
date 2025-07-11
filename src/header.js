import React, { useState } from "react";
import "./header.css";

const StickyHeader = () => {
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      setMessages([...messages, 
        { type: 'user', text: inputMessage },
        { type: 'ai', text: 'Hello! I\'m your AI assistant. How can I help you today?' }
      ]);
      setInputMessage("");
    }
  };

  return (
  <header className="sticky-header">
    <div className="header-left">
      <img src="/coconut-tree.png" alt="LakbAI Logo" className="logo-icon" />
      <span className="logo-text">LakbAI</span>
    </div>
    <nav className="header-nav">
      <a href="#" className="active">Dashboard</a>
      <a href="#">Destinations</a>
      <a href="#">Bookmarks</a>
      <a href="#">My Trips</a>
      <a href="#">Community</a>
      <a href="#">Admin</a>
    </nav>
    <div className="header-right">
      <button className="ai-assistant-btn" onClick={() => setShowChat(!showChat)}>
        <span className="dot"></span> AI Assistant
      </button>
      <img src="/user.png" alt="User" className="user-icon" />
    </div>
    {showChat && (
      <div className="chatbox" style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        width: '300px',
        height: '400px',
        backgroundColor: 'white',
        border: '1px solid #ddd',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          padding: '15px',
          borderBottom: '1px solid #eee',
          backgroundColor: '#6c63ff',
          color: 'white',
          borderRadius: '12px 12px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontWeight: 'bold' }}>AI Assistant</span>
          <button 
            onClick={() => setShowChat(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '18px',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>
        <div style={{
          flex: 1,
          padding: '10px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {messages.length === 0 ? (
            <div style={{ color: '#666', textAlign: 'center', marginTop: '20px' }}>
              Hi! I'm your AI assistant. Ask me anything!
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} style={{
                padding: '8px 12px',
                borderRadius: '8px',
                maxWidth: '80%',
                alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: msg.type === 'user' ? '#6c63ff' : '#f0f0f0',
                color: msg.type === 'user' ? 'white' : '#333',
                fontSize: '14px'
              }}>
                {msg.text}
              </div>
            ))
          )}
        </div>
        <div style={{
          padding: '10px',
          borderTop: '1px solid #eee',
          display: 'flex',
          gap: '8px'
        }}>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your message..."
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '20px',
              outline: 'none',
              fontSize: '14px'
            }}
          />
          <button
            onClick={handleSendMessage}
            style={{
              backgroundColor: '#6c63ff',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            →
          </button>
        </div>
      </div>
    )}
  </header>
  );
};

export default StickyHeader;