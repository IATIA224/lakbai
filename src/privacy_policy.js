import React, { useState } from "react";
import "./privacy_policy.css";

const PrivacyPolicy = ({ onClose }) => {
  const [preferences, setPreferences] = useState({
    marketing: false,
    analytics: false,
    thirdParty: false,
  });

  const handleChange = (e) => {
    setPreferences({
      ...preferences,
      [e.target.name]: e.target.checked,
    });
  };

  const handleSave = (e) => {
    e.preventDefault();
    // You can add logic to save preferences here
    if (onClose) onClose();
  };

  return (
    <div className="privacy-modal-overlay">
      <div className="privacy-modal">
        <div className="privacy-modal-header">
          <span className="privacy-modal-title">
            <span style={{ color: "#7c3aed", fontWeight: 700, marginRight: 8 }}>▸</span> Privacy Policy
          </span>
          <button className="privacy-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="privacy-modal-content">
          <div className="privacy-section">
            <b>1. Information We Collect</b>
            <p>We collect information you provide directly to us when you create an account, update your profile, or communicate with us. This may include your name, email address, phone number, and other contact information.</p>
          </div>
          <div className="privacy-section">
            <b>2. How We Use Your Information</b>
            <p>We use the information we collect to provide, maintain, and improve our services, communicate with you, and for security purposes. We may also use your information to personalize your experience and to develop new features.</p>
          </div>
          <div className="privacy-section">
            <b>3. Information Sharing</b>
            <p>We do not sell your personal information. We may share your information with third-party service providers who perform services on our behalf, such as payment processing and data analysis.</p>
          </div>
          <div className="privacy-section">
            <b>4. Your Choices</b>
            <p>You can access, update, or delete your account information at any time through your account settings. You can also opt out of receiving promotional communications from us by following the instructions in those communications.</p>
          </div>
          <div className="privacy-section">
            <b>5. Data Retention</b>
            <p>We retain your information for as long as your account is active or as needed to provide you services. We may also retain and use your information as necessary to comply with our legal obligations, resolve disputes, and enforce our agreements.</p>
          </div>
          <hr className="privacy-divider" />
          <div className="privacy-section">
            <b>Privacy Preferences</b>
            <form className="privacy-preferences-form" onSubmit={handleSave}>
              <label className="privacy-checkbox">
                <input
                  type="checkbox"
                  name="marketing"
                  checked={preferences.marketing}
                  onChange={handleChange}
                />
                Receive marketing emails
              </label>
              <label className="privacy-checkbox">
                <input
                  type="checkbox"
                  name="analytics"
                  checked={preferences.analytics}
                  onChange={handleChange}
                />
                Allow data analytics
              </label>
              <label className="privacy-checkbox">
                <input
                  type="checkbox"
                  name="thirdParty"
                  checked={preferences.thirdParty}
                  onChange={handleChange}
                />
                Share data with third parties
              </label>
              <button className="privacy-save-btn" type="submit">
                Save Preferences
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
