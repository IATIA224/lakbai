const express = require('express');
const router = express.Router();
const { sendEmail } = require('./mailer');
const admin = require('firebase-admin');

// Init Firebase admin (if available)
try {
  if (!admin.apps.length) {
    const sa = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
    admin.initializeApp({ credential: admin.credential.cert(sa) });
    console.log('Firebase admin initialized');
  }
} catch (e) {
  console.warn('Firebase admin init warning: serviceAccountKey.json not found or invalid; route will require dev header for testing', e.message || e);
}

const getIdTokenFromHeader = (req) => {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const parts = header.split(' ');
  return parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : null;
};

// Dev-only test route so you can exercise the mailer without token (only on dev)
router.post('/send-interests-email-dev', async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Not allowed in production' });
  try {
    const to = req.body.to || req.query.to;
    const interests = req.body.interests || [];
    const name = req.body.name || 'traveler';
    if (!to || !Array.isArray(interests)) return res.status(400).json({ error: 'Missing to or interests' });

    await sendMail({
      to,
      subject: 'Dev test — interests updated',
      text: `Interests: ${interests.join(', ')}`,
      html: `<p>Interests: ${interests.map(i => `<b>${i}</b>`).join(', ')}</p>`,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('/send-interests-email-dev error:', err && (err.stack || err.message || err));
    res.status(500).json({ error: 'Failed to send', message: process.env.NODE_ENV === 'production' ? undefined : (err && (err.message || err.stack)) });
  }
});

// Main route: send a single email with all saved interests
router.post('/send-interests-email', async (req, res) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const userEmail = decodedToken.email;

    const { interests } = req.body;

    const html = `
      <h2>Your Travel Preferences Have Been Updated</h2>
      <p>Hello!</p>
      <p>Your travel interests have been updated to:</p>
      <ul>
        ${interests.map(i => `<li>${i}</li>`).join('')}
      </ul>
      <p>Start planning your next adventure with LakbAI!</p>
    `;

    // Now sends to the actual user's email!
    await sendEmail(userEmail, 'LakbAI - Preferences Updated', html);

    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Email route error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

module.exports = router;