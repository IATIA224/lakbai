const express = require('express');
const router = express.Router();
const { sendInterestsEmail } = require('./mailer');

router.post('/send-interests-email', async (req, res) => {
  try {
    console.log('[emailRoutes] headers:', req.headers);
    console.log('[emailRoutes] body:', req.body);

    // Accept either email or userEmail
    const interests = req.body.interests ?? req.body?.data?.interests;
    const userEmail = req.body.userEmail ?? req.body.email ?? req.body?.data?.email;

    if (!interests) {
      console.error('[emailRoutes] missing interests');
      return res.status(400).json({ error: 'Missing field: interests (array)' });
    }
    if (!Array.isArray(interests)) {
      console.error('[emailRoutes] interests not array:', typeof interests);
      return res.status(400).json({ error: 'interests must be an array' });
    }
    if (!userEmail) {
      console.warn('[emailRoutes] missing userEmail — continuing (optional)');
      // decide whether you want to require userEmail — if not, continue
      // return res.status(400).json({ error: 'Missing field: userEmail (string)' });
    }

    // optional: log the parsed shape to clarify expectations
    console.log('[emailRoutes] parsed interests length:', interests.length);

    const info = await sendInterestsEmail({ interests, userEmail });
    return res.json({ ok: true, info });
  } catch (err) {
    console.error('[emailRoutes] send-interests-email error:', err.stack || err.message || err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

module.exports = router;