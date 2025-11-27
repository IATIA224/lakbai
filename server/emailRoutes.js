const express = require('express');
const router = express.Router();
const { sendInterestsEmail } = require('./mailer');

// route should be '/send-interests-email'
router.post('/send-interests-email', async (req, res) => {
  console.log('[EMAIL] Incoming', { origin: req.headers.origin, path: req.path, body: req.body });
  try {
    const { interests, name } = req.body;
    if (!Array.isArray(interests)) {
      return res.status(400).json({ ok: false, message: 'interests must be an array' });
    }

    await sendInterestsEmail({ interests, name, meta: { origin: req.headers.origin } });
    console.log('[EMAIL] sent OK');
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[EMAIL] send failed:', err);
    return res.status(500).json({ ok: false, message: err.message || 'send failed' });
  }
});

module.exports = router;