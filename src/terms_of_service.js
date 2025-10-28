import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import "./terms_of_service.css";

const TermsOfService = ({ onClose }) => {
  const [activeSection, setActiveSection] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, []);

  const handleClose = () => {
    if (typeof onClose === "function") {
      onClose();
      return;
    }
    if (location.pathname === "/terms-of-service" || location.pathname === "/terms") {
      navigate(-1);
      return;
    }
    if (window.history.length > 1) window.history.back();
  };

  const toggleSection = (id) => {
    setActiveSection((s) => (s === id ? null : id));
  };

  const Section = ({ id, title, children, icon = "▪️" }) => (
    <div className={`terms-accordion${activeSection === id ? " active" : ""}`}>
      <button
        className="terms-accordion-header"
        onClick={() => toggleSection(id)}
        aria-expanded={activeSection === id}
      >
        <span className="terms-accordion-icon" aria-hidden>
          {icon}
        </span>
        <span className="terms-accordion-title">{title}</span>
        <span className="terms-accordion-arrow">{activeSection === id ? "−" : "+"}</span>
      </button>
      {activeSection === id && <div className="terms-accordion-content">{children}</div>}
    </div>
  );

  const modalContent = (
    <div className="terms-modal-overlay" onClick={handleClose}>
      <div className="terms-modal" onClick={(e) => e.stopPropagation()}>
        <div className="terms-modal-header">
          <div className="terms-header-content">
            <span className="terms-icon">📄</span>
            <div>
              <h2 className="terms-modal-title">Terms of Service</h2>
              <div className="terms-subtitle">The rules and regulations for using LakbAI</div>
            </div>
          </div>
          <button className="terms-modal-close" onClick={handleClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="terms-modal-content">
          <div className="terms-intro">
            <h3 style={{ margin: 0, fontSize: "1.05rem" }}>Terms of Service</h3>
            <div style={{ fontWeight: 600, marginTop: 6 }}>Effective Date: [Insert Date]</div>
            <div style={{ fontWeight: 600, marginTop: 4 }}>Last Updated: [Insert Date]</div>
            <p style={{ marginTop: 10 }}>
              Welcome to <strong>LakbAI</strong> (“we,” “our,” or “us”). These Terms of Service (“Terms”) govern your
              access to and use of the <strong>LakbAI website</strong> and its related services (the “Service”).
              By using our Service, you agree to comply with and be bound by these Terms. If you do not agree,
              please discontinue using the website immediately.
            </p>
          </div>

          <Section id={1} title="1. Acceptance of Terms" icon="✅">
            <p>By accessing or using <strong>LakbAI</strong>, you acknowledge that you:</p>
            <ul>
              <li>Are at least 18 years old or have obtained parental or guardian consent;</li>
              <li>Have read, understood, and agree to these Terms; and</li>
              <li>Will comply with all applicable laws and regulations of the <strong>Republic of the Philippines</strong>.</li>
            </ul>
          </Section>

          <Section id={2} title="2. Description of Service" icon="🧭">
            <p>
              <strong>LakbAI</strong> is an <strong>AI-driven travel itinerary planner</strong> designed to help users
              discover destinations and plan personalized trips across the Philippines.
            </p>
            <p>Our Service may include:</p>
            <ul>
              <li>AI-generated travel itineraries and recommendations;</li>
              <li>Destination guides and local insights;</li>
              <li>Budget and time management tools;</li>
              <li>Integration with third-party travel services (e.g., maps, bookings).</li>
            </ul>
            <p>We may modify, suspend, or discontinue parts of the Service at any time without prior notice.</p>
          </Section>

          <Section id={3} title="3. User Accounts" icon="👤">
            <h5 style={{ marginTop: 0 }}>A. Registration</h5>
            <p>When registering you agree to provide <strong>accurate, current, and complete information</strong>.</p>
            <h5>B. Responsibility</h5>
            <ul>
              <li>Maintain confidentiality of your credentials;</li>
              <li>Be responsible for all activities under your account;</li>
              <li>Report unauthorized use promptly to LakbAI.</li>
            </ul>
          </Section>

          <Section id={4} title="4. Acceptable Use" icon="🚫">
            <p>You agree <strong>not to:</strong></p>
            <ol>
              <li>Use the Service for unlawful, harmful, or fraudulent activity;</li>
              <li>Interfere with or disrupt the website;</li>
              <li>Use bots/scrapers to extract data;</li>
              <li>Upload viruses or malicious code;</li>
              <li>Misuse or redistribute AI-generated itineraries for deceptive/commercial purposes.</li>
            </ol>
          </Section>

          <Section id={5} title="5. AI-Generated Content Disclaimer" icon="🤖">
            <p>
              AI-generated recommendations are <strong>for informational and planning purposes only</strong>. We do not guarantee
              accuracy, safety, or availability of suggested destinations. Verify details before travel.
            </p>
          </Section>

          <Section id={6} title="6. User Content and Feedback" icon="💬">
            <p>
              By submitting content you grant LakbAI a <strong>non-exclusive, royalty-free, worldwide license</strong> to use it
              for service-related purposes. Do not submit unlawful or infringing content.
            </p>
          </Section>

          <Section id={7} title="7. Third-Party Services" icon="🔗">
            <p>We are not responsible for third-party content, policies, or transactions. Interaction with third parties is at your own risk.</p>
          </Section>

          <Section id={8} title="8. Intellectual Property Rights" icon="©️">
            <p>All materials on LakbAI are owned by LakbAI or licensors and protected under Philippine IP law. Do not reproduce without permission.</p>
          </Section>

          <Section id={9} title="9. Payment and Subscription (If Applicable)" icon="💳">
            <p>Paid/premium features (if any) will have disclosed pricing, billing, and refund policies. Payments processed via third-party gateways.</p>
          </Section>

          <Section id={10} title="10. Limitation of Liability" icon="⚖️">
            <p>To the fullest extent permitted by law, LakbAI is not liable for damages resulting from use of the Service. Use at your own risk.</p>
          </Section>

          <Section id={11} title="11. Indemnification" icon="🛡️">
            <p>You agree to indemnify and hold LakbAI harmless from claims arising from your use or misuse of the Service or breach of these Terms.</p>
          </Section>

          <Section id={12} title="12. Termination" icon="🔒">
            <p>We may suspend or terminate access for violations, fraud, or as required by law. Access ends on termination.</p>
          </Section>

          <Section id={13} title="13. Privacy" icon="🔎">
            <p>Your use is governed by our Privacy Policy (Data Privacy Act of 2012 - RA 10173).</p>
          </Section>

          <Section id={14} title="14. Governing Law and Dispute Resolution" icon="⚖️">
            <p>These Terms are governed by the laws of the Republic of the Philippines. Disputes will be resolved in Taguig City courts if not amicably settled.</p>
          </Section>

          <Section id={15} title="15. Amendments to These Terms" icon="✏️">
            <p>We may revise these Terms. Continued use after updates constitutes acceptance.</p>
          </Section>

          <Section id={16} title="16. Contact Us" icon="📬">
            <p>
              For questions: <br />
              <strong>LakbAI</strong><br />
              Email: [Insert Contact Email]<br />
              Address: [Insert Office or Business Address]<br />
              Phone: [Insert Contact Number]
            </p>
          </Section>

          <div className="terms-actions" style={{ marginTop: 18 }}>
            <button className="terms-close-btn" onClick={handleClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default TermsOfService;