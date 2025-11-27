const express = require('express');
const router = express.Router();
const { sendInterestsEmail } = require('./mailer');

router.post('/send-interests-email', async (req, res) => {
  try {
    console.log('[emailRoutes] headers:', req.headers);
    console.log('[emailRoutes] body:', req.body);

    const interests = req.body.interests ?? req.body?.data?.interests;
    const userEmail = req.body.userEmail ?? req.body.email;

    if (!interests || !Array.isArray(interests)) {
      console.warn('[emailRoutes] missing/invalid interests:', interests);
      return res.status(400).json({ error: 'Missing or invalid "interests" array' });
    }

    const info = await sendInterestsEmail({ interests, userEmail });
    return res.json({ ok: true, info });
  } catch (err) {
    console.error('[emailRoutes] error sending email:', err.stack || err.message || err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

module.exports = router;