const express = require('express');
const path = require('path');
const router = express.Router();
const admin = require('firebase-admin');
const { sendMail } = require('./mailer');

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
    const idToken = getIdTokenFromHeader(req);
    if (!idToken) return res.status(401).json({ error: "Missing token" });
    const decoded = await admin.auth().verifyIdToken(idToken);
    const interests = req.body.interests || [];
    if (!decoded.email) return res.status(400).json({ error: "No email" });

    await sendMail({
      to: decoded.email,
      subject: 'Your LakbAI preferences were updated',
      text: `Hi ${decoded.name || 'traveler'},\n\nYou have successfully updated your travel preferences on LakbAI.\n\nBe sure to check your dashboard to discover new personalized destinations and experiences that match your latest interests:\n\n${interests.join(', ')}\n\nThank you for using LakbAI!`,
      html: `
        <div style="max-width:480px;margin:0 auto;padding:24px 18px;background:#f8f9ff;border-radius:12px;font-family:'Inter',Arial,sans-serif;color:#3d246c;">
          <div style="text-align:center;margin-bottom:18px;">
            <h2 style="margin:0;font-size:1.5rem;color:#6c63ff;">LakbAI</h2>
          </div>
          <p style="font-size:1.08rem;margin-bottom:12px;">Hi <b>${decoded.name || 'traveler'}</b>,</p>
          <p style="margin-bottom:14px;">You have <b>successfully updated your travel preferences</b> on LakbAI.</p>
          <div style="background:#fff6e5;border-radius:8px;padding:12px 14px;margin-bottom:18px;border:1px solid #ffe6b3;">
            <span style="font-weight:600;color:#a084ee;">Your updated interests:</span>
            <ul style="margin:8px 0 0 18px;padding:0;">
              ${interests.map(i => `<li style="margin-bottom:3px;">${i}</li>`).join('')}
            </ul>
          </div>
          <p style="margin-bottom:18px;">
            <b>Check your dashboard</b> to discover new personalized destinations and experiences that match your latest interests!
          </p>
          <a href="https://lakbai.onrender.com/dashboard" style="display:inline-block;background:#6c63ff;color:#fff;text-decoration:none;padding:10px 22px;border-radius:7px;font-weight:600;font-size:1rem;margin-bottom:18px;">Go to Dashboard</a>
          <p style="font-size:0.97rem;color:#888;margin-top:24px;">Thank you for using <b>LakbAI</b>!<br><span style="font-size:0.93rem;">Travel smarter, travel happier.</span></p>
        </div>
      `
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('/send-interests-email error:', err && (err.stack || err.message || err));
    res.status(500).json({ error: 'Failed to send', message: err?.message });
  }
});

module.exports = router;