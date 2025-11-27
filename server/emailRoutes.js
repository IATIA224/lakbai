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
      console.warn('[emailRoutes] missing/invalid interests:', JSON.stringify(interests));
      return res.status(400).json({ error: 'Missing or invalid "interests" array' });
    }

    // optional: if auth middleware is used, include Authorization in tests
    const info = await sendInterestsEmail({ interests, userEmail });
    console.log('[emailRoutes] mail send info:', info);
    return res.json({ ok: true, info });
  } catch (err) {
    console.error('[emailRoutes] error:', err.stack || err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

module.exports = router;