const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  // Parse the port as a number (Render sends it as a string)
  port: parseInt(process.env.EMAIL_PORT || '465'),
  // Convert the string "true" to a real boolean
  secure: process.env.EMAIL_SECURE === 'true', 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Add this verification block to see errors in Render Logs
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email Transporter Error:", error);
  } else {
    console.log("✅ Server is ready to send emails");
  }
});

module.exports = transporter;