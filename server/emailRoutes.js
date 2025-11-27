const express = require('express');
const router = express.Router();
const { sendInterestsEmail } = require('./mailer');

// Optional: verify Firebase token if you use it:
let admin;
try { admin = require('firebase-admin'); } catch (e) { admin = null; }

router.post('/send-interests-email', async (req, res) => {
  console.log('[EMAIL] Incoming', {
    path: req.path,
    origin: req.headers.origin,
    body: req.body,
    userAgent: req.headers['user-agent'],
  });

  // Optional token verification if you require protected calls
  const authHeader = req.headers.authorization || '';
  let uid = null;
  if (authHeader.startsWith('Bearer ') && admin) {
    const token = authHeader.replace('Bearer ', '');
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      uid = decoded.uid;
      console.log('[EMAIL] Verified uid:', uid);
    } catch (err) {
      console.warn('[EMAIL] Token verify failed:', err.message || err);
      return res.status(401).json({ ok: false, message: 'Invalid token' });
    }
  }

  try {
    const { interests } = req.body;
    if (!Array.isArray(interests)) {
      return res.status(400).json({ ok: false, message: 'interests must be an array' });
    }

    // Optionally include user id/email in the message if available
    const meta = { uid: uid || 'anonymous', interestsCount: interests.length };

    console.log('[EMAIL] Sending. meta=', meta);
    await sendInterestsEmail({ interests, meta });
    console.log('[EMAIL] Sent OK');
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[EMAIL] Error: ', err?.message || err);
    return res.status(500).json({ ok: false, message: err.message || 'Failed to send email' });
  }
});

module.exports = router;