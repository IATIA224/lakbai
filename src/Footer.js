import React from "react";
import "./footer.css";

const Footer = () => (
  <footer className="global-footer">
    <div className="footer-main">
      <div className="footer-brand">
        <div className="footer-logo">
          <img src="/coconut-tree.png" alt="LakbAI logo" style={{height: "32px", marginRight: "8px"}} />
          <span className="footer-title">LakbAI</span>
        </div>
        <div className="footer-desc">
          Create perfect itineraries for your dream trips. Plan, organize, and discover amazing destinations with ease.
        </div>
        <div className="footer-social">
          <a href="#"><i className="fab fa-twitter"></i></a>
          <a href="#"><i className="fab fa-facebook"></i></a>
          <a href="#"><i className="fab fa-instagram"></i></a>
          <a href="#"><i className="fab fa-youtube"></i></a>
        </div>
      </div>
      <div className="footer-links">
        <div className="footer-section">
          <div className="footer-heading">Quick Links</div>
          <a href="#">Create Itinerary</a>
          <a href="#">Browse Destinations</a>
          <a href="#">Travel Guides</a>
          <a href="#">Popular Routes</a>
          <a href="#">Travel Tips</a>
        </div>
        <div className="footer-section">
          <div className="footer-heading">Support</div>
          <a href="#">Help Center</a>
          <a href="#">Contact Us</a>
          <a href="#">FAQ</a>
          <a href="#">Live Chat</a>
          <a href="#">Feedback</a>
        </div>
        <div className="footer-section">
          <div className="footer-heading">Stay Updated</div>
          <div className="footer-desc">
            Get travel inspiration and planning tips delivered to your inbox.
          </div>
          <form className="footer-subscribe" onSubmit={e => e.preventDefault()}>
            <input type="email" placeholder="Enter your email" />
            <button type="submit">Subscribe</button>
          </form>
        </div>
      </div>
    </div>
    <div className="footer-bottom">
      <span>© 2025 LakbAI. All rights reserved.</span>
      <span>
        <a href="#">Privacy Policy</a> &nbsp;|&nbsp;
        <a href="#">Terms of Service</a> &nbsp;|&nbsp;
        <a href="#">Cookie Policy</a> &nbsp;|&nbsp;
        <a href="#">Accessibility</a>
      </span>
    </div>
  </footer>
);

export default Footer;