const express = require('express');
const router = express.Router();
const { sendInterestsEmail } = require('./mailer');
const admin = require('firebase-admin');

// Middleware to verify Firebase token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    console.log('🔍 Token received:', token ? 'Yes' : 'No');
    
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ error: 'No token provided' });
    }
    
    req.user = await admin.auth().verifyIdToken(token);
    console.log('✅ Token verified for:', req.user.email);
    next();
  } catch (err) {
    console.error('❌ Token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// POST endpoint to send interests email
router.post('/send-interests-email', verifyToken, async (req, res) => {
  try {
    console.log('═══════════════════════════════════════');
    console.log('📧 SEND INTERESTS EMAIL REQUEST');
    console.log('═══════════════════════════════════════');
    
    const { interests } = req.body;
    const userEmail = req.user.email;

    console.log('📧 User email:', userEmail);
    console.log('📧 Interests:', interests);
    console.log('📧 SENDGRID_API_KEY exists:', !!process.env.SENDGRID_API_KEY);
    console.log('📧 EMAIL_FROM:', process.env.EMAIL_FROM);

    if (!userEmail) {
      console.log('❌ User email not found');
      return res.status(400).json({ error: 'User email not found' });
    }

    console.log('📧 Calling sendInterestsEmail...');
    await sendInterestsEmail(userEmail, interests || []);
    
    console.log('✅ EMAIL SENT SUCCESSFULLY');
    console.log('═══════════════════════════════════════');
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('═══════════════════════════════════════');
    console.error('❌ ERROR IN SEND-INTERESTS-EMAIL');
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    console.error('═══════════════════════════════════════');
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
});

module.exports = router;