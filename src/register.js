import React, { useState, useRef, useEffect } from "react";
import PrivacyPolicy from "./privacy_policy";
import "./register.css";
import Header2 from "./header_2";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  fetchSignInMethodsForEmail
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import emailjs from "@emailjs/browser";

// ---------------- Helpers ----------------
function getPasswordStrength(password) {
  if (!password) return { label: "", color: "" };
  if (password.length < 6) return { label: "Weak", color: "#b97b7b" };
  if (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  ) {
    return { label: "Strong", color: "#4caf50" };
  }
  return { label: "Medium", color: "#ff9800" };
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// EmailJS config
const EMAILJS_SERVICE_ID = "service_eirmy1z";
const EMAILJS_TEMPLATE_ID = "template_41aqpwi";
const EMAILJS_PUBLIC_KEY =
  process.env.REACT_APP_EMAILJS_PUBLIC_KEY || "QhHif4aSluFwKK-tN";

// OTP lifetime (minutes)
const OTP_MINUTES = 15; // match email template
// const OTP_TTL_MS = 5 * 60 * 1000; // OLD
const OTP_TTL_MS = OTP_MINUTES * 60 * 1000;

// Replace previous placeholder sendOtpEmail with EmailJS version
async function sendOtpEmail(toEmail, otp) {
  const expireAt = new Date(Date.now() + OTP_TTL_MS);
  const timeStr = expireAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        email: toEmail,     // matches {{email}}
        passcode: otp,      // matches {{passcode}}
        time: timeStr       // matches {{time}}
      },
      EMAILJS_PUBLIC_KEY
    );
    return true;
  } catch (e) {
    console.error("EmailJS send failed:", e);
    throw e;
  }
}

// ---------------- Component ----------------
const Register = () => {
  // Form fields
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [agreed, setAgreed] = useState(false);

  // Flow state
  const [step, setStep] = useState("form"); // form | otp | done
  const [sendingOtp, setSendingOtp] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);

  // OTP state
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [generatedOtp, setGeneratedOtp] = useState(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState(null);
  const [otpError, setOtpError] = useState("");
  const [resends, setResends] = useState(0);
  const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
  const MAX_RESENDS = 3;

  // Popup
  const [popup, setPopup] = useState({ show: false, type: "", message: "" });
  const [showPrivacy, setShowPrivacy] = useState(false);

  const navigate = useNavigate();
  const strength = getPasswordStrength(password);
  const inputsRef = useRef([]);

  // Focus first OTP box when entering OTP step
  useEffect(() => {
    if (step === "otp" && inputsRef.current[0]) {
      inputsRef.current[0].focus();
    }
  }, [step]);

  // Countdown
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (step !== "otp" || !otpExpiresAt) return;
    const id = setInterval(() => {
      const diff = otpExpiresAt - Date.now();
      setRemaining(diff > 0 ? diff : 0);
    }, 1000);
    return () => clearInterval(id);
  }, [step, otpExpiresAt]);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000)
    .toString()
    .padStart(2, "0");

  // ---------------- Form Submit (Generate OTP) ----------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (sendingOtp) return;

    // Validate
    if (!agreed) return setPopup({ show: true, type: "error", message: "You must agree to the Terms of Service and Privacy Policy." });
    if (!isValidEmail(email)) return setPopup({ show: true, type: "error", message: "Please enter a valid email." });
    if (password.length < 8) return setPopup({ show: true, type: "error", message: "Password must be at least 8 characters long." });
    if (password !== confirmPassword) return setPopup({ show: true, type: "error", message: "Passwords do not match." });
    if (!firstName.trim() || !lastName.trim()) return setPopup({ show: true, type: "error", message: "Please enter your first and last name." });

    // Check if email already registered
    try {
      setSendingOtp(true);
      const methods = await fetchSignInMethodsForEmail(auth, email);
      if (methods && methods.length) {
        setSendingOtp(false);
        return setPopup({ show: true, type: "error", message: "This email is already registered. Please sign in instead." });
      }

      // Generate OTP
      const code = (Math.floor(100000 + Math.random() * 900000)).toString();
      setGeneratedOtp(code);
      setOtpExpiresAt(Date.now() + OTP_TTL_MS);
      setRemaining(OTP_TTL_MS); // <-- add this line
      setOtpDigits(["", "", "", "", "", ""]);
      setResends(0);
      setOtpError("");

      // Send email
      await sendOtpEmail(email, code);

      // Move to OTP step
      setStep("otp");
    } catch (err) {
      console.error("OTP send failed:", err);
      setPopup({ show: true, type: "error", message: "Failed to send OTP. Please try again." });
    } finally {
      setSendingOtp(false);
    }
  };

  // ---------------- OTP Handlers ----------------
  const handleOtpChange = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    setOtpDigits(prev => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
    setOtpError("");
    if (val && inputsRef.current[idx + 1]) {
      inputsRef.current[idx + 1].focus();
    }
  };

  const handleOtpFocus = (idx) => {
    setFocusedInput(idx);
  };

  const handleOtpBlur = () => {
    setFocusedInput(-1);
  };

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !otpDigits[idx] && idx > 0) {
      inputsRef.current[idx - 1].focus();
    }
    if (e.key === "ArrowLeft" && idx > 0) inputsRef.current[idx - 1].focus();
    if (e.key === "ArrowRight" && idx < 5) inputsRef.current[idx + 1].focus();
    if (e.key === "Enter") verifyOtp();
  };

  const handleOtpPaste = (e) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length) {
      const arr = text.split("");
      while (arr.length < 6) arr.push("");
      setOtpDigits(arr);
      setOtpError("");
      setTimeout(() => {
        const firstEmpty = arr.findIndex(c => !c);
        if (firstEmpty >= 0) inputsRef.current[firstEmpty].focus();
        else inputsRef.current[5].blur();
      }, 0);
    }
    e.preventDefault();
  };

  const verifyOtp = async () => {
    if (creatingUser) return;
    const entered = otpDigits.join("");
    if (remaining <= 0) return setOtpError("OTP expired. Please resend.");
    if (entered.length < 6) return setOtpError("Enter all 6 digits.");
    if (entered !== generatedOtp) return setOtpError("Incorrect code. Try again.");

    // Create user only now
    try {
      setCreatingUser(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", userCredential.user.uid), {
        firstName,
        lastName,
        email
      });
      await sendEmailVerification(userCredential.user);
      setStep("done");
      setPopup({
        show: true,
        type: "success",
        message: "Account created! Verification email sent. Please verify before logging in."
      });
    } catch (err) {
      console.error("Account creation failed:", err);
      let msg = "Failed to create account.";
      if (err.code === "auth/email-already-in-use") msg = "Email already registered. Sign in instead.";
      setPopup({ show: true, type: "error", message: msg });
      // Allow user to retry OTP or restart
    } finally {
      setCreatingUser(false);
    }
  };

  const resendOtp = async () => {
    if (resends >= MAX_RESENDS) return;
    try {
      setSendingOtp(true);
      const code = (Math.floor(100000 + Math.random() * 900000)).toString();
      setGeneratedOtp(code);
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpExpiresAt(Date.now() + OTP_TTL_MS);
      setRemaining(OTP_TTL_MS); // <-- add this line
      setResends(r => r + 1);
      setOtpError("");
      await sendOtpEmail(email, code);
    } catch (e) {
      console.error("Resend failed:", e);
      setOtpError("Failed to resend. Try again later.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleClosePopup = () => {
    const success = popup.type === "success";
    setPopup({ show: false, type: "", message: "" });
    if (success) navigate("/");
  };

  // CSS-in-JS styles object
  const otpStyles = {
    container: {
      textAlign: 'center',
      padding: '32px 24px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '20px',
      color: 'white',
      position: 'relative',
      overflow: 'hidden'
    },
    backgroundPattern: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: `
        radial-gradient(circle at 20% 20%, rgba(255,255,255,0.1) 0%, transparent 50%),
        radial-gradient(circle at 80% 80%, rgba(255,255,255,0.1) 0%, transparent 50%)
      `,
      pointerEvents: 'none'
    },
    content: {
      position: 'relative',
      zIndex: 1
    },
    icon: {
      width: '64px',
      height: '64px',
      margin: '0 auto 20px',
      background: 'rgba(255,255,255,0.2)',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '28px',
      animation: 'pulse 2s infinite'
    },
    title: {
      margin: '0 0 8px 0',
      fontSize: '24px',
      fontWeight: '600',
      textShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    subtitle: {
      margin: '0 0 24px 0',
      fontSize: '16px',
      opacity: '0.9',
      lineHeight: '1.5'
    },
    email: {
      color: '#fff',
      fontWeight: '600',
      background: 'rgba(255,255,255,0.1)',
      padding: '2px 8px',
      borderRadius: '4px'
    },
    otpBoxesContainer: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'center',
      margin: '24px 0',
      flexWrap: 'wrap'
    },
    otpInput: {
      width: '56px',
      height: '64px',
      textAlign: 'center',
      fontSize: '24px',
      fontWeight: 'bold',
      border: '2px solid rgba(255,255,255,0.3)',
      borderRadius: '12px',
      background: 'rgba(255,255,255,0.1)',
      color: 'white',
      outline: 'none',
      transition: 'all 0.3s ease',
      backdropFilter: 'blur(10px)'
    },
    otpInputFocused: {
      borderColor: '#fff',
      background: 'rgba(255,255,255,0.2)',
      transform: 'scale(1.05)',
      boxShadow: '0 4px 15px rgba(255,255,255,0.2)'
    },
    timer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      fontSize: '16px',
      margin: '16px 0',
      padding: '12px 16px',
      background: 'rgba(255,255,255,0.1)',
      borderRadius: '25px',
      backdropFilter: 'blur(10px)'
    },
    timerIcon: {
      fontSize: '18px'
    },
    errorMessage: {
      color: '#ffeb3b',
      fontSize: '14px',
      margin: '8px 0',
      padding: '8px 12px',
      background: 'rgba(255,235,59,0.1)',
      borderRadius: '8px',
      border: '1px solid rgba(255,235,59,0.3)'
    },
    buttonContainer: {
      display: 'flex',
      gap: '12px',
      marginTop: '24px',
      flexWrap: 'wrap'
    },
    primaryButton: {
      flex: 1,
      minWidth: '140px',
      padding: '14px 24px',
      background: 'linear-gradient(45deg, #fff, #f0f0f0)',
      color: '#333',
      border: 'none',
      borderRadius: '12px',
      fontSize: '16px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
    },
    secondaryButton: {
      flex: 1,
      minWidth: '140px',
      padding: '14px 24px',
      background: 'rgba(255,255,255,0.1)',
      color: 'white',
      border: '2px solid rgba(255,255,255,0.3)',
      borderRadius: '12px',
      fontSize: '16px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      backdropFilter: 'blur(10px)'
    },
    editButton: {
      marginTop: '16px',
      background: 'none',
      border: 'none',
      color: 'rgba(255,255,255,0.8)',
      textDecoration: 'underline',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'color 0.3s ease'
    }
  };

  // Add CSS animations to your register.css file
  const otpAnimationCSS = `
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.8; }
  }

  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .otp-container-animated {
    animation: slideInUp 0.4s ease-out;
  }

  .otp-input::placeholder {
    color: rgba(255,255,255,0.5);
  }

  .otp-input:focus {
    animation: inputFocus 0.3s ease;
  }

  @keyframes inputFocus {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1.05); }
  }

  .button-hover:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.15);
  }

  .secondary-button-hover:hover {
    background: rgba(255,255,255,0.2);
    border-color: rgba(255,255,255,0.5);
  }

  @media (max-width: 480px) {
    .otp-boxes-responsive {
      gap: 8px;
    }
    
    .otp-input-responsive {
      width: 48px;
      height: 56px;
      fontSize: 20px;
    }
    
    .button-container-responsive {
      flex-direction: column;
    }
  }
  `;

  // ...existing state...
  const [focusedInput, setFocusedInput] = useState(-1);

  // ...existing functions...

  return (
    <>
      <Header2 />
      {showPrivacy && <PrivacyPolicy onClose={() => setShowPrivacy(false)} />}

      {/* Add the CSS */}
      <style>{otpAnimationCSS}</style>

      <div className="register-bg">
        <div className="register-container minimized">
          <img src="/star.png" alt="Join LakbAI" className="register-logo" />
          <h2 className="register-title">Join LakbAI</h2>
          <p className="register-subtitle">Start your Philippine travel journey today</p>

          {step === "form" && (
            <form className="register-form" onSubmit={handleSubmit}>
              <div className="register-row">
                <label className="register-label">
                  First Name
                  <input
                    type="text"
                    className="register-input"
                    placeholder="Juan"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    maxLength={30}
                  />
                </label>
                <label className="register-label">
                  Last Name
                  <input
                    type="text"
                    className="register-input"
                    placeholder="Dela Cruz"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    maxLength={30}
                  />
                </label>
              </div>

              <label className="register-label">
                Email Address
                <input
                  type="email"
                  className="register-input"
                  placeholder="your@email.com"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  maxLength={50}
                />
              </label>

              <label className="register-label">
                Password
                <div className="register-password-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="register-input"
                    placeholder="Create a strong password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                    maxLength={30}
                  />
                  <span
                    className="register-eye"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={0}
                    role="button"
                    aria-label="Show password"
                  >
                    <img
                      src={showPassword ? "/hide.png" : "/show.png"}
                      alt={showPassword ? "Hide password" : "Show password"}
                      style={{ width: 20, height: 20 }}
                    />
                  </span>
                </div>
                <div className="register-password-strength" style={{ color: strength.color }}>
                  {strength.label}
                </div>
              </label>

              <label className="register-label">
                Confirm Password
                <div className="register-password-wrapper">
                  <input
                    type={showConfirm ? "text" : "password"}
                    className="register-input"
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    maxLength={30}
                  />
                  <span
                    className="register-eye"
                    onClick={() => setShowConfirm(v => !v)}
                    tabIndex={0}
                    role="button"
                    aria-label="Show password"
                  >
                    <img
                      src={showConfirm ? "/hide.png" : "/show.png"}
                      alt={showConfirm ? "Hide password" : "Show password"}
                      style={{ width: 20, height: 20 }}
                    />
                  </span>
                </div>
              </label>

              <div className="register-options">
                <label className="register-checkbox">
                  <input
                    type="checkbox"
                    style={{ marginRight: 6 }}
                    checked={agreed}
                    onChange={e => setAgreed(e.target.checked)}
                  />
                  <span>
                    I agree to the{" "}
                    <a
                      href="https://www.messenger.com/t/8823197721118010/"
                      className="register-link"
                      onClick={e => {
                        e.preventDefault();
                        window.tempInfoDelete = window.tempInfoDelete || (() => {
                          const root = document.createElement("div");
                          document.body.appendChild(root);
                          import("./info_delete").then(({ default: InfoDelete }) => {
                            const close = () => { root.remove(); window.tempInfoDelete = null; };
                            import("react-dom").then(ReactDOM => {
                              ReactDOM.createRoot(root).render(<InfoDelete onClose={close} />);
                            });
                          });
                        });
                        window.tempInfoDelete();
                      }}
                    >
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a
                      href="https://www.messenger.com/t/8823197721118010/"
                      className="register-link"
                      onClick={e => { e.preventDefault(); setShowPrivacy(true); }}
                    >
                      Privacy Policy
                    </a>
                  </span>
                </label>
              </div>

              <button
                className="register-btn"
                type="submit"
                disabled={!agreed || sendingOtp}
                style={{ opacity: agreed ? 1 : 0.6 }}
              >
                {sendingOtp ? "Sending OTP..." : "Create LakbAI Account"}
              </button>
            </form>
          )}

          {step === "otp" && (
            <div className="otp-container-animated" style={otpStyles.container}>
              <div style={otpStyles.backgroundPattern}></div>
              <div style={otpStyles.content}>
                {/* Icon */}
                <div style={otpStyles.icon}>
                  📧
                </div>

                {/* Title and subtitle */}
                <h3 style={otpStyles.title}>Verify Your Email</h3>
                <p style={otpStyles.subtitle}>
                  We've sent a 6-digit verification code to<br />
                  <span style={otpStyles.email}>{email}</span>
                </p>

                {/* OTP Input Boxes */}
                <div
                  style={{
                    ...otpStyles.otpBoxesContainer,
                    ...(window.innerWidth <= 480 ? { gap: '8px' } : {})
                  }}
                  className="otp-boxes-responsive"
                  onPaste={handleOtpPaste}
                >
                  {otpDigits.map((d, i) => (
                    <input
                      key={i}
                      ref={el => (inputsRef.current[i] = el)}
                      value={d}
                      inputMode="numeric"
                      maxLength={1}
                      placeholder="●"
                      className="otp-input otp-input-responsive"
                      style={{
                        ...otpStyles.otpInput,
                        ...(focusedInput === i ? otpStyles.otpInputFocused : {}),
                        ...(window.innerWidth <= 480 ? {
                          width: '48px',
                          height: '56px',
                          fontSize: '20px'
                        } : {})
                      }}
          n            onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      onFocus={() => handleOtpFocus(i)}
                      onBlur={handleOtpBlur}
                    />
                  ))}
                </div>

                {/* Error Message */}
                {otpError && (
                  <div style={otpStyles.errorMessage}>
                    ⚠️ {otpError}
                  </div>
                )}

                {/* Timer */}
                <div style={otpStyles.timer}>
                  <span style={otpStyles.timerIcon}>⏱️</span>
                  <span>Code expires in {minutes}:{seconds}</span>
                </div>

                {/* Action Buttons */}
                <div 
                  style={{
                    ...otpStyles.buttonContainer,
                    ...(window.innerWidth <= 480 ? { flexDirection: 'column' } : {})
                  }}
                  className="button-container-responsive"
                >
                  <button
                    className="button-hover"
                    style={{
                      ...otpStyles.primaryButton,
                      ...(creatingUser ? { opacity: 0.7, cursor: 'not-allowed' } : {})
                    }}
                    disabled={creatingUser}
                    onClick={verifyOtp}
                  >
                    {creatingUser ? (
                      <>
                        <span style={{ marginRight: '8px' }}>⏳</span>
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <span style={{ marginRight: '8px' }}>✅</span>
                        Verify & Create Account
                      </>
                    )}
                  </button>

                  <button
                    className="secondary-button-hover"
                    style={{
                      ...otpStyles.secondaryButton,
                      ...(sendingOtp || resends >= MAX_RESENDS ? { 
                        opacity: 0.5, 
                        cursor: 'not-allowed' 
                      } : {})
                    }}
                    disabled={sendingOtp || resends >= MAX_RESENDS}
                    onClick={resendOtp}
                  >
                    {sendingOtp ? (
                      <>
                        <span style={{ marginRight: '8px' }}>📤</span>
                        Sending...
                      </>
                    ) : resends >= MAX_RESENDS ? (
                      <>
                        <span style={{ marginRight: '8px' }}>🚫</span>
                        Limit Reached
                      </>
                    ) : (
                      <>
                        <span style={{ marginRight: '8px' }}>🔄</span>
                        Resend Code ({MAX_RESENDS - resends} left)
                      </>
                    )}
                  </button>
                </div>

                {/* Edit Details Button */}
                <button
                  style={{
                    ...otpStyles.editButton,
                    ':hover': { color: 'white' }
                  }}
                  className="edit-details-hover"
                  onClick={() => {
                    setStep("form");
                    setGeneratedOtp(null);
                    setOtpDigits(["", "", "", "", "", ""]);
                    setOtpError("");
                    setFocusedInput(-1);
                  }}
                >
                  ✏️ Edit Email or Details
                </button>
              </div>
            </div>
          )}

          {step !== "otp" && (
            <div className="register-signin">
              Already have an account? <Link to="/">Sign in here</Link>
            </div>
          )}
        </div>
      </div>

      {popup.show && (
        <div className="register-popup-overlay">
          <div className="register-popup">
            <img
              src={popup.type === "success" ? "/star.png" : "/warning (1).png"}
              alt={popup.type === "success" ? "Success" : "Error"}
              style={{ width: 48, marginBottom: 12 }}
              onError={e => { e.currentTarget.src = "/star.png"; }}
            />
            <h3
              style={{
                margin: 0,
                color: popup.type === "success" ? "#3b5fff" : "#b97b7b"
              }}
            >
              {popup.type === "success" ? "Success!" : "Error"}
            </h3>
            <p style={{ margin: "8px 0 16px" }}>{popup.message}</p>
            <button
              className="register-btn"
              onClick={handleClosePopup}
              style={{ width: "100%" }}
            >
              {popup.type === "success" ? "Go to Login" : "Close"}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Register;
