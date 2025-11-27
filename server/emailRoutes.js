const express = require('express');
const router = express.Router();
const { sendInterestsEmail } = require('./mailer');

router.post('/send-interests-email', async (req, res) => {
  console.log('[emailRoutes] incoming headers:', req.headers);
  console.log('[emailRoutes] incoming body:', req.body);
  try {
    const interests = req.body?.interests ?? req.body?.data?.interests;
    const userEmail = req.body?.userEmail ?? req.body?.email;

    if (!interests || !Array.isArray(interests)) {
      console.warn('[emailRoutes] Validation failed — interests:', interests);
      return res.status(400).json({ error: 'Missing or invalid "interests" array' });
    }

    const info = await sendInterestsEmail({ interests, userEmail });
    return res.json({ ok: true, info });
  } catch (err) {
    console.error('[emailRoutes] handler error:', err && (err.stack || err.message));
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;