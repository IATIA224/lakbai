const express = require('express');
const router = express.Router();
const { sendInterestsEmail } = require('./mailer');

router.post('/send-interests-email', async (req, res) => {
  console.log('[emailRoutes] body:', req.body);
  try {
    const { interests, name } = req.body;
    await sendInterestsEmail({ interests, name, meta: { origin: req.headers.origin } });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[emailRoutes] error:', err && (err.message || err));
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// Test send route for debug
router.get('/test-send-email', async (req, res) => {
  try {
    await sendInterestsEmail({ interests: ['Debug interest'], name: 'Debug', meta: { origin: req.headers.origin } });
    res.json({ ok: true, message: 'Test send attempted' });
  } catch (err) {
    console.error('[emailRoutes] test send error:', err);
    res.status(500).json({ ok: false, message: err.message || 'test failed' });
  }
});

module.exports = router;