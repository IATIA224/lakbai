import React, { useState } from "react";
import ReactDOM from "react-dom";
import "./privacy_policy.css";

const PrivacyPolicy = ({ onClose }) => {
  const [preferences, setPreferences] = useState({
    marketing: false,
    analytics: true,
    thirdParty: false,
  });

  const [activeSection, setActiveSection] = useState(null);

  const handleChange = (e) => {
    setPreferences({
      ...preferences,
      [e.target.name]: e.target.checked,
    });
  };

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem('privacyPreferences', JSON.stringify(preferences));
    alert('Privacy preferences saved successfully!');
    if (onClose) onClose();
  };

  const toggleSection = (section) => {
    setActiveSection(activeSection === section ? null : section);
  };

  const modalContent = (
    <div className="privacy-modal-overlay" onClick={onClose}>
      <div className="privacy-modal" onClick={(e) => e.stopPropagation()}>
        <div className="privacy-modal-header">
          <div className="privacy-header-content">
            <span className="privacy-icon">🔒</span>
            <div>
              <h2 className="privacy-modal-title">Privacy Policy</h2>
              <p className="privacy-subtitle">How we protect and use your data</p>
            </div>
          </div>
          <button className="privacy-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="privacy-modal-content">
          <div className="privacy-intro">
            <p><strong>Effective Date:</strong> October 8, 2025</p>
            <p>At <strong>LakbAI</strong>, we value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your data when you use our AI-driven travel planning services.</p>
          </div>

          <div className="privacy-sections">
            {/* Section 1 */}
            <div className={`privacy-accordion ${activeSection === 1 ? 'active' : ''}`}>
              <button className="privacy-accordion-header" onClick={() => toggleSection(1)}>
                <span className="privacy-accordion-icon">📊</span>
                <span className="privacy-accordion-title">1. Information We Collect</span>
                <span className="privacy-accordion-arrow">{activeSection === 1 ? '−' : '+'}</span>
              </button>
              {activeSection === 1 && (
                <div className="privacy-accordion-content">
                  <p><strong>Personal Information:</strong></p>
                  <ul>
                    <li>Name, email address, phone number</li>
                    <li>Profile photo and preferences</li>
                    <li>Travel history and saved destinations</li>
                  </ul>
                  <p><strong>Usage Data:</strong></p>
                  <ul>
                    <li>Search queries and itinerary preferences</li>
                    <li>Device information (browser, OS, IP address)</li>
                    <li>Location data (with your permission)</li>
                  </ul>
                  <p><strong>AI Interactions:</strong></p>
                  <ul>
                    <li>Chat conversations with our AI assistant</li>
                    <li>Preferences and recommendations</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Section 2 */}
            <div className={`privacy-accordion ${activeSection === 2 ? 'active' : ''}`}>
              <button className="privacy-accordion-header" onClick={() => toggleSection(2)}>
                <span className="privacy-accordion-icon">⚙️</span>
                <span className="privacy-accordion-title">2. How We Use Your Information</span>
                <span className="privacy-accordion-arrow">{activeSection === 2 ? '−' : '+'}</span>
              </button>
              {activeSection === 2 && (
                <div className="privacy-accordion-content">
                  <ul>
                    <li><strong>Personalized Recommendations:</strong> AI-powered itinerary suggestions based on your preferences</li>
                    <li><strong>Service Improvement:</strong> Enhance features, fix bugs, and develop new capabilities</li>
                    <li><strong>Communication:</strong> Send booking confirmations, updates, and promotional offers (opt-out available)</li>
                    <li><strong>Security:</strong> Detect fraud, prevent abuse, and protect user accounts</li>
                    <li><strong>Analytics:</strong> Understand usage patterns to improve user experience</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Section 3 */}
            <div className={`privacy-accordion ${activeSection === 3 ? 'active' : ''}`}>
              <button className="privacy-accordion-header" onClick={() => toggleSection(3)}>
                <span className="privacy-accordion-icon">🔐</span>
                <span className="privacy-accordion-title">3. Data Sharing & Third Parties</span>
                <span className="privacy-accordion-arrow">{activeSection === 3 ? '−' : '+'}</span>
              </button>
              {activeSection === 3 && (
                <div className="privacy-accordion-content">
                  <p><strong>We do NOT sell your personal data.</strong> We may share information with:</p>
                  <ul>
                    <li><strong>Service Providers:</strong> Cloud hosting (Firebase), payment processors, analytics tools</li>
                    <li><strong>AI Partners:</strong> OpenAI/Claude for conversational features (anonymized data)</li>
                    <li><strong>Legal Compliance:</strong> When required by law or to protect our rights</li>
                    <li><strong>Business Transfers:</strong> In case of merger or acquisition (you'll be notified)</li>
                  </ul>
                  <div className="privacy-highlight">
                    <strong>🛡️ Your Control:</strong> You can opt out of third-party analytics and marketing below.
                  </div>
                </div>
              )}
            </div>

            {/* Section 4 */}
            <div className={`privacy-accordion ${activeSection === 4 ? 'active' : ''}`}>
              <button className="privacy-accordion-header" onClick={() => toggleSection(4)}>
                <span className="privacy-accordion-icon">🎛️</span>
                <span className="privacy-accordion-title">4. Your Privacy Rights</span>
                <span className="privacy-accordion-arrow">{activeSection === 4 ? '−' : '+'}</span>
              </button>
              {activeSection === 4 && (
                <div className="privacy-accordion-content">
                  <ul>
                    <li><strong>Access:</strong> Request a copy of your data</li>
                    <li><strong>Correction:</strong> Update inaccurate information</li>
                    <li><strong>Deletion:</strong> Request account and data deletion ("right to be forgotten")</li>
                    <li><strong>Portability:</strong> Export your itineraries and preferences</li>
                    <li><strong>Opt-Out:</strong> Unsubscribe from marketing emails anytime</li>
                  </ul>
                  <p>To exercise these rights, email us at <a href="mailto:privacy@lakbai.com">privacy@lakbai.com</a></p>
                </div>
              )}
            </div>

            {/* Section 5 */}
            <div className={`privacy-accordion ${activeSection === 5 ? 'active' : ''}`}>
              <button className="privacy-accordion-header" onClick={() => toggleSection(5)}>
                <span className="privacy-accordion-icon">🗄️</span>
                <span className="privacy-accordion-title">5. Data Retention & Security</span>
                <span className="privacy-accordion-arrow">{activeSection === 5 ? '−' : '+'}</span>
              </button>
              {activeSection === 5 && (
                <div className="privacy-accordion-content">
                  <p><strong>How Long We Keep Data:</strong></p>
                  <ul>
                    <li>Active accounts: Until you delete your account</li>
                    <li>Inactive accounts: Up to 3 years, then anonymized</li>
                    <li>Legal obligations: As required by law</li>
                  </ul>
                  <p><strong>Security Measures:</strong></p>
                  <ul>
                    <li>Encrypted data transmission (HTTPS/TLS)</li>
                    <li>Secure Firebase authentication</li>
                    <li>Regular security audits and updates</li>
                    <li>Access controls and monitoring</li>
                  </ul>
                  <div className="privacy-warning">
                    ⚠️ <strong>Note:</strong> No system is 100% secure. Please use strong passwords and enable two-factor authentication.
                  </div>
                </div>
              )}
            </div>

            {/* Section 6 */}
            <div className={`privacy-accordion ${activeSection === 6 ? 'active' : ''}`}>
              <button className="privacy-accordion-header" onClick={() => toggleSection(6)}>
                <span className="privacy-accordion-icon">🍪</span>
                <span className="privacy-accordion-title">6. Cookies & Tracking</span>
                <span className="privacy-accordion-arrow">{activeSection === 6 ? '−' : '+'}</span>
              </button>
              {activeSection === 6 && (
                <div className="privacy-accordion-content">
                  <p>We use cookies and similar technologies to:</p>
                  <ul>
                    <li><strong>Essential Cookies:</strong> Keep you logged in, remember preferences</li>
                    <li><strong>Analytics Cookies:</strong> Understand how you use the app (Google Analytics)</li>
                    <li><strong>Marketing Cookies:</strong> Show relevant ads (opt-out available)</li>
                  </ul>
                  <p>Manage cookie preferences in your browser settings or use the options below.</p>
                </div>
              )}
            </div>
          </div>

          <hr className="privacy-divider" />

          {/* Privacy Preferences */}
          <div className="privacy-preferences">
            <h3 className="privacy-preferences-title">
              <span className="privacy-icon">⚙️</span> Privacy Preferences
            </h3>
            <p className="privacy-preferences-desc">Customize how we use your data</p>
            
            <form className="privacy-preferences-form" onSubmit={handleSave}>
              <label className="privacy-toggle">
                <div className="privacy-toggle-info">
                  <strong>📧 Marketing Communications</strong>
                  <span>Receive travel tips, deals, and feature updates</span>
                </div>
                <input
                  type="checkbox"
                  className="privacy-checkbox-input"
                  name="marketing"
                  checked={preferences.marketing}
                  onChange={handleChange}
                />
                <span className="privacy-toggle-slider"></span>
              </label>

              <label className="privacy-toggle">
                <div className="privacy-toggle-info">
                  <strong>📊 Analytics & Performance</strong>
                  <span>Help us improve with usage data (recommended)</span>
                </div>
                <input
                  type="checkbox"
                  className="privacy-checkbox-input"
                  name="analytics"
                  checked={preferences.analytics}
                  onChange={handleChange}
                />
                <span className="privacy-toggle-slider"></span>
              </label>

              <label className="privacy-toggle">
                <div className="privacy-toggle-info">
                  <strong>🤝 Third-Party Sharing</strong>
                  <span>Share with trusted partners for enhanced features</span>
                </div>
                <input
                  type="checkbox"
                  className="privacy-checkbox-input"
                  name="thirdParty"
                  checked={preferences.thirdParty}
                  onChange={handleChange}
                />
                <span className="privacy-toggle-slider"></span>
              </label>

              <button className="privacy-save-btn" type="submit">
                💾 Save Preferences
              </button>
            </form>
          </div>

          <div className="privacy-footer">
            <p>Questions? Contact us at <a href="mailto:privacy@lakbai.com">privacy@lakbai.com</a></p>
            <p className="privacy-update">Last updated: October 8, 2025</p>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default PrivacyPolicy;
