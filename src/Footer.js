import React from "react";
import "./footer.css";
import Bookmarks from "./bookmarks2";
import Itinerary from "./Itinerary";

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
          <a href="https://twitter.com" target="_blank" rel="noopener noreferrer"><i className="fab fa-twitter"></i></a>
          <a href="https://facebook.com" target="_blank" rel="noopener noreferrer"><i className="fab fa-facebook"></i></a>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"><i className="fab fa-instagram"></i></a>
          <a href="https://youtube.com" target="_blank" rel="noopener noreferrer"><i className="fab fa-youtube"></i></a>
        </div>
      </div>
      <div className="footer-links">
        <div className="footer-section">
          <div className="footer-heading">Quick Links</div>
          <a href="/itinerary">Create Itinerary</a>
          <a href="/bookmarks2">Browse Destinations</a>
          <a href="/travel-guides">Travel Guides</a>
          <a href="/popular-routes">Popular Routes</a>
          <a href="/travel-tips">Travel Tips</a>
        </div>
        <div className="footer-section">
          <div className="footer-heading">Support</div>
          <a href="/help-center">Help Center</a>
          <a href="/contact-us">Contact Us</a>
          <a href="/faq">FAQ</a>
          <a href="/live-chat">Live Chat</a>
          <a href="/feedback">Feedback</a>
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
        <a href="/privacy-policy">Privacy Policy</a> &nbsp;|&nbsp;
        <a href="/terms-of-service">Terms of Service</a> &nbsp;|&nbsp;
        <a href="/cookie-policy">Cookie Policy</a> &nbsp;|&nbsp;
        <a href="/accessibility">Accessibility</a>
      </span>
    </div>
    <Bookmarks />
    <Itinerary />
  </footer>
);

export default Footer;