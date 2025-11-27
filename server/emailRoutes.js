const express = require('express');
const router = express.Router();
const { sendInterestsEmail } = require('./mailer'); // or whatever mailer export

router.post('/send-interests-email', async (req, res) => {
  console.log('[EMAIL] incoming', { path: req.path, headers: req.headers, body: req.body });
  try {
    const { interests } = req.body;
    // optionally validate token here (if present)
    await sendInterestsEmail(interests); // ensure this function catches and throws for logging
    console.log('[EMAIL] sent OK');
    res.json({ ok: true });
  } catch (err) {
    console.error('[EMAIL] send failed:', err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;