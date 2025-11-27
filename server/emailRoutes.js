const express = require('express');
const router = express.Router();
const { sendInterestsEmail } = require('./mailer');

router.post('/send-interests-email', async (req, res) => {
  console.log('[EMAIL] incoming', { body: req.body });
  try {
    const { interests } = req.body;
    if (!Array.isArray(interests)) return res.status(400).json({ ok: false, message: 'interests must be an array' });
    await sendInterestsEmail({ interests, meta: { origin: req.headers.origin } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[EMAIL] failed', err);
    res.status(500).json({ ok: false, message: err.message || 'send failed' });
  }
});

module.exports = router;