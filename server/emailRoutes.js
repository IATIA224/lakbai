const express = require('express');
const router = express.Router();
const { sendInterestsEmail } = require('./mailer');
const admin = require('firebase-admin');

// Middleware to verify Firebase token
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    req.user = await admin.auth().verifyIdToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// POST endpoint to send interests email
router.post('/send-interests-email', verifyToken, async (req, res) => {
  try {
    const { interests } = req.body;
    const userEmail = req.user.email;

    if (!userEmail) {
      return res.status(400).json({ error: 'User email not found' });
    }

    await sendInterestsEmail(userEmail, interests || []);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error in send-interests-email:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
});

module.exports = router;