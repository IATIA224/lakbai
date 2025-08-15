import React from "react";
import { useNavigate } from "react-router-dom";
import "./header_2.css";

const Header2 = () => {
  const navigate = useNavigate();
  
  return (
  <header className="header2-sticky">
    <div className="header2-left">
      <img src="/coconut-tree.png" alt="LakbAI Logo" className="header2-logo" />
      <span className="header2-title">LakbAi</span>
      <span className="header2-subtitle">Your Philippine Travel Companion</span>
    </div>
    <div className="header2-right">
      <span className="header2-signin" onClick={() => navigate('/register')} style={{ cursor: 'pointer' }}>Sign In</span>
      <button className="header2-getstarted" onClick={() => navigate('/')}>Get Started</button>
    </div>
  </header>
  );
};

export default Header2;