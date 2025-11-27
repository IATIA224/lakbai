const express = require('express');
const router = express.Router();
const { sendInterestsEmail } = require('./mailer');

router.post('/send-interests-email', async (req, res) => {
  console.log('[emailRoutes] body:', req.body);
  try {
    const { interests, name } = req.body;
    if (!Array.isArray(interests)) return res.status(400).json({ ok: false, message: 'interests must be an array' });
    await sendInterestsEmail({ interests, name, meta: { origin: req.headers.origin } });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[emailRoutes] error:', err?.message || err);
    return res.status(500).json({ ok: false, message: err?.message || 'send failed' });
  }
});

// debug test route (no auth)
router.get('/test-send-email', async (req, res) => {
  try {
    await sendInterestsEmail({ interests: ['Debug interest'], name: 'Debug Test', meta: { origin: req.headers.origin } });
    return res.json({ ok: true, message: 'Test send attempted' });
  } catch (err) {
    console.error('[emailRoutes] test send error:', err?.message || err);
    return res.status(500).json({ ok: false, message: err?.message || 'test failed' });
  }
});

module.exports = router;