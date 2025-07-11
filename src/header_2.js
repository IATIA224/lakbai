import React from "react";
import "./header_2.css";

const Header2 = () => (
  <header className="header2-sticky">
    <div className="header2-left">
      <img src="/coconut-tree.png" alt="LakbAI Logo" className="header2-logo" />
      <span className="header2-title">LakbAI</span>
      <span className="header2-subtitle">Your Philippine Travel Companion</span>
    </div>
    <div className="header2-right">
      <a href="#" className="header2-signin">Sign In</a>
      <button className="header2-getstarted">Get Started</button>
    </div>
  </header>
);

export default Header2;