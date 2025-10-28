import React, { useState } from "react";
import "./footer.css";
import { Link } from "react-router-dom";
import TermsOfService from "./terms_of_service";
import PrivacyPolicy from "./privacy_policy";

const Footer = () => {
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  return (
    <>
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
              <Link to="/itinerary">Create Itinerary</Link>
              <Link to="/bookmarks2">Browse Destinations</Link>
              <a href="#">Travel Guides</a>
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
            <button
              type="button"
              onClick={() => setShowPrivacy(true)}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, font: 'inherit' }}
            >
              Privacy Policy
            </button>
            &nbsp;|&nbsp;
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, font: 'inherit' }}
            >
              Terms of Service
            </button>
            &nbsp;|&nbsp;
            <a href="#">Cookie Policy</a> &nbsp;|&nbsp;
            <a href="#">Accessibility</a>
          </span>
        </div>
      </footer>

      {showPrivacy && <PrivacyPolicy onClose={() => setShowPrivacy(false)} />}
      {showTerms && <TermsOfService onClose={() => setShowTerms(false)} />}
    </>
  );
};

export default Footer;