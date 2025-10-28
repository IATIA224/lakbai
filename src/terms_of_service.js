import React, { useState } from "react";
import ReactDOM from "react-dom";
import "./terms.css";

const TermsOfService = ({ onClose }) => {
  const [activeSection, setActiveSection] = useState(null);

  const toggleSection = (section) => {
    setActiveSection(activeSection === section ? null : section);
  };

  const modalContent = (
    <div className="terms-modal-overlay" onClick={onClose}>
      <div className="terms-modal" onClick={(e) => e.stopPropagation()}>
        <div className="terms-modal-header">
          <div className="terms-header-content">
            <span className="terms-icon">📜</span>
            <div>
              <h2 className="terms-modal-title">Terms of Service</h2>
              <p className="terms-subtitle">Please read carefully before using LakbAI</p>
            </div>
          </div>
          <button className="terms-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="terms-modal-content">
          <div className="terms-intro">
            <p><strong>Effective Date:</strong> October 8, 2025</p>
            <p>Welcome to <strong>LakbAI</strong>! By accessing or using our AI-driven travel planning platform, you agree to be bound by these Terms of Service. If you disagree with any part of these terms, please do not use our services.</p>
          </div>

          <div className="terms-sections">
            {/* Section 1 */}
            <div className={`terms-accordion ${activeSection === 1 ? 'active' : ''}`}>
              <button className="terms-accordion-header" onClick={() => toggleSection(1)}>
                <span className="terms-accordion-icon">📱</span>
                <span className="terms-accordion-title">1. Acceptance of Terms</span>
                <span className="terms-accordion-arrow">{activeSection === 1 ? '−' : '+'}</span>
              </button>
              {activeSection === 1 && (
                <div className="terms-accordion-content">
                  <p>By creating an account or using LakbAI, you acknowledge that you:</p>
                  <ul>
                    <li>Are at least 18 years old or have parental/guardian consent</li>
                    <li>Agree to comply with these Terms and our Privacy Policy</li>
                    <li>Will provide accurate and complete registration information</li>
                    <li>Will maintain the security of your account credentials</li>
                    <li>Accept responsibility for all activities under your account</li>
                  </ul>
                  <div className="terms-highlight">
                    💡 <strong>Tip:</strong> Keep your password secure and never share it with others.
                  </div>
                </div>
              )}
            </div>

            {/* Section 2 */}
            <div className={`terms-accordion ${activeSection === 2 ? 'active' : ''}`}>
              <button className="terms-accordion-header" onClick={() => toggleSection(2)}>
                <span className="terms-accordion-icon">🤖</span>
                <span className="terms-accordion-title">2. AI-Powered Services</span>
                <span className="terms-accordion-arrow">{activeSection === 2 ? '−' : '+'}</span>
              </button>
              {activeSection === 2 && (
                <div className="terms-accordion-content">
                  <p><strong>What We Provide:</strong></p>
                  <ul>
                    <li>AI-generated travel itineraries and recommendations</li>
                    <li>Destination discovery and trip planning tools</li>
                    <li>Personalized suggestions based on your preferences</li>
                    <li>Cost estimation and budget planning features</li>
                    <li>Community features for sharing itineraries</li>
                  </ul>
                  <div className="terms-warning">
                    ⚠️ <strong>Important:</strong> AI recommendations are suggestions only. Always verify information with official sources before making travel decisions or bookings.
                  </div>
                  <p><strong>Limitations:</strong></p>
                  <ul>
                    <li>AI suggestions may contain inaccuracies or outdated information</li>
                    <li>We are not responsible for third-party content or services</li>
                    <li>Travel conditions, prices, and availability can change</li>
                    <li>Always confirm details directly with service providers</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Section 3 */}
            <div className={`terms-accordion ${activeSection === 3 ? 'active' : ''}`}>
              <button className="terms-accordion-header" onClick={() => toggleSection(3)}>
                <span className="terms-accordion-icon">✅</span>
                <span className="terms-accordion-title">3. User Responsibilities</span>
                <span className="terms-accordion-arrow">{activeSection === 3 ? '−' : '+'}</span>
              </button>
              {activeSection === 3 && (
                <div className="terms-accordion-content">
                  <p><strong>You agree to:</strong></p>
                  <ul>
                    <li>Use the service for lawful purposes only</li>
                    <li>Respect other users and community guidelines</li>
                    <li>Not upload malicious code, viruses, or harmful content</li>
                    <li>Not attempt to hack, scrape, or reverse-engineer the platform</li>
                    <li>Not impersonate others or create fake accounts</li>
                    <li>Not spam, harass, or abuse other users</li>
                    <li>Not use automated bots or scripts without permission</li>
                  </ul>
                  <p><strong>Content You Post:</strong></p>
                  <ul>
                    <li>You retain ownership of your content (reviews, photos, itineraries)</li>
                    <li>You grant LakbAI a license to use, display, and share your content</li>
                    <li>You must have rights to any content you upload</li>
                    <li>We may remove content that violates these terms</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Section 4 */}
            <div className={`terms-accordion ${activeSection === 4 ? 'active' : ''}`}>
              <button className="terms-accordion-header" onClick={() => toggleSection(4)}>
                <span className="terms-accordion-icon">💳</span>
                <span className="terms-accordion-title">4. Payments & Subscriptions</span>
                <span className="terms-accordion-arrow">{activeSection === 4 ? '−' : '+'}</span>
              </button>
              {activeSection === 4 && (
                <div className="terms-accordion-content">
                  <p><strong>Free Tier:</strong></p>
                  <ul>
                    <li>Basic itinerary planning and AI assistance</li>
                    <li>Limited destinations and features</li>
                    <li>Ad-supported experience</li>
                  </ul>
                  <p><strong>Premium Features (Future):</strong></p>
                  <ul>
                    <li>Unlimited itineraries and AI conversations</li>
                    <li>Advanced customization and priority support</li>
                    <li>Ad-free experience and early feature access</li>
                    <li>Subscription fees are non-refundable unless required by law</li>
                    <li>You can cancel anytime; access continues until period end</li>
                  </ul>
                  <div className="terms-highlight">
                    🎁 <strong>Note:</strong> Currently, all features are free during beta. Premium tiers may be introduced in the future.
                  </div>
                </div>
              )}
            </div>

            {/* Section 5 */}
            <div className={`terms-accordion ${activeSection === 5 ? 'active' : ''}`}>
              <button className="terms-accordion-header" onClick={() => toggleSection(5)}>
                <span className="terms-accordion-icon">🚫</span>
                <span className="terms-accordion-title">5. Prohibited Activities</span>
                <span className="terms-accordion-arrow">{activeSection === 5 ? '−' : '+'}</span>
              </button>
              {activeSection === 5 && (
                <div className="terms-accordion-content">
                  <p><strong>You may NOT:</strong></p>
                  <ul>
                    <li>Use LakbAI for illegal activities or to promote violence</li>
                    <li>Post false, misleading, or fraudulent content</li>
                    <li>Infringe on intellectual property rights</li>
                    <li>Collect user data without consent</li>
                    <li>Interfere with platform security or operations</li>
                    <li>Sell or transfer your account to others</li>
                    <li>Create multiple accounts to abuse free trials or promotions</li>
                  </ul>
                  <div className="terms-warning">
                    🚨 <strong>Violations may result in:</strong> Account suspension, termination, and legal action if necessary.
                  </div>
                </div>
              )}
            </div>

            {/* Section 6 */}
            <div className={`terms-accordion ${activeSection === 6 ? 'active' : ''}`}>
              <button className="terms-accordion-header" onClick={() => toggleSection(6)}>
                <span className="terms-accordion-icon">📚</span>
                <span className="terms-accordion-title">6. Intellectual Property</span>
                <span className="terms-accordion-arrow">{activeSection === 6 ? '−' : '+'}</span>
              </button>
              {activeSection === 6 && (
                <div className="terms-accordion-content">
                  <p><strong>Our Content:</strong></p>
                  <ul>
                    <li>LakbAI logo, trademarks, and branding are our property</li>
                    <li>Platform code, design, and AI models are protected</li>
                    <li>You may not copy, reproduce, or redistribute our content</li>
                  </ul>
                  <p><strong>Your Content:</strong></p>
                  <ul>
                    <li>You own your itineraries, reviews, and photos</li>
                    <li>By posting, you grant us a worldwide, royalty-free license to display and share it</li>
                    <li>We may use anonymized data for AI training and analytics</li>
                  </ul>
                  <p><strong>Third-Party Content:</strong></p>
                  <ul>
                    <li>Destination images and data may be sourced from APIs and public databases</li>
                    <li>Proper attribution is provided where required</li>
                    <li>Report copyright violations to <a href="mailto:dmca@lakbai.com">dmca@lakbai.com</a></li>
                  </ul>
                </div>
              )}
            </div>

            {/* Section 7 */}
            <div className={`terms-accordion ${activeSection === 7 ? 'active' : ''}`}>
              <button className="terms-accordion-header" onClick={() => toggleSection(7)}>
                <span className="terms-accordion-icon">⚖️</span>
                <span className="terms-accordion-title">7. Disclaimers & Limitations</span>
                <span className="terms-accordion-arrow">{activeSection === 7 ? '−' : '+'}</span>
              </button>
              {activeSection === 7 && (
                <div className="terms-accordion-content">
                  <p><strong>Service "As Is":</strong></p>
                  <ul>
                    <li>LakbAI is provided "as is" without warranties of any kind</li>
                    <li>We do not guarantee uptime, accuracy, or error-free operation</li>
                    <li>We are not liable for travel disruptions, losses, or damages</li>
                    <li>Use at your own risk; always verify information independently</li>
                  </ul>
                  <p><strong>Limitation of Liability:</strong></p>
                  <ul>
                    <li>We are not responsible for third-party services (hotels, flights, tours)</li>
                    <li>Maximum liability is limited to the amount you paid us (if any)</li>
                    <li>We are not liable for indirect, incidental, or consequential damages</li>
                  </ul>
                  <div className="terms-warning">
                    ⚠️ <strong>Travel at Your Own Risk:</strong> LakbAI provides planning tools only. We do not book or guarantee any travel services.
                  </div>
                </div>
              )}
            </div>

            {/* Section 8 */}
            <div className={`terms-accordion ${activeSection === 8 ? 'active' : ''}`}>
              <button className="terms-accordion-header" onClick={() => toggleSection(8)}>
                <span className="terms-accordion-icon">🔄</span>
                <span className="terms-accordion-title">8. Changes to Terms</span>
                <span className="terms-accordion-arrow">{activeSection === 8 ? '−' : '+'}</span>
              </button>
              {activeSection === 8 && (
                <div className="terms-accordion-content">
                  <p>We may update these Terms at any time. When we do:</p>
                  <ul>
                    <li>We will notify you via email or in-app notification</li>
                    <li>The "Effective Date" at the top will be updated</li>
                    <li>Continued use constitutes acceptance of new terms</li>
                    <li>If you disagree, you must stop using LakbAI</li>
                  </ul>
                  <p>We encourage you to review these Terms periodically.</p>
                </div>
              )}
            </div>

            {/* Section 9 */}
            <div className={`terms-accordion ${activeSection === 9 ? 'active' : ''}`}>
              <button className="terms-accordion-header" onClick={() => toggleSection(9)}>
                <span className="terms-accordion-icon">🚪</span>
                <span className="terms-accordion-title">9. Termination</span>
                <span className="terms-accordion-arrow">{activeSection === 9 ? '−' : '+'}</span>
              </button>
              {activeSection === 9 && (
                <div className="terms-accordion-content">
                  <p><strong>You can:</strong></p>
                  <ul>
                    <li>Delete your account anytime from settings</li>
                    <li>Stop using LakbAI without notice</li>
                    <li>Request data deletion (within 30 days)</li>
                  </ul>
                  <p><strong>We can:</strong></p>
                  <ul>
                    <li>Suspend or terminate accounts that violate these Terms</li>
                    <li>Remove content that violates policies</li>
                    <li>Discontinue the service with reasonable notice</li>
                  </ul>
                  <p>Upon termination, your right to use LakbAI ends immediately.</p>
                </div>
              )}
            </div>

            {/* Section 10 */}
            <div className={`terms-accordion ${activeSection === 10 ? 'active' : ''}`}>
              <button className="terms-accordion-header" onClick={() => toggleSection(10)}>
                <span className="terms-accordion-icon">📞</span>
                <span className="terms-accordion-title">10. Contact & Dispute Resolution</span>
                <span className="terms-accordion-arrow">{activeSection === 10 ? '−' : '+'}</span>
              </button>
              {activeSection === 10 && (
                <div className="terms-accordion-content">
                  <p><strong>Questions or Issues?</strong></p>
                  <ul>
                    <li>Email: <a href="mailto:support@lakbai.com">support@lakbai.com</a></li>
                    <li>Report bugs or feature requests in-app</li>
                    <li>Legal inquiries: <a href="mailto:legal@lakbai.com">legal@lakbai.com</a></li>
                  </ul>
                  <p><strong>Dispute Resolution:</strong></p>
                  <ul>
                    <li>We encourage informal resolution first</li>
                    <li>If unresolved, disputes will be settled by binding arbitration</li>
                    <li>Governed by the laws of the Philippines</li>
                    <li>Venue: Metro Manila courts</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="terms-footer">
            <div className="terms-acceptance">
              <div className="terms-acceptance-icon">✔️</div>
              <div>
                <strong>By using LakbAI, you agree to these Terms of Service.</strong>
                <p>If you have questions, contact us at <a href="mailto:legal@lakbai.com">legal@lakbai.com</a></p>
              </div>
            </div>
            <p className="terms-update">Last updated: October 8, 2025 | Version 1.0</p>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default TermsOfService;