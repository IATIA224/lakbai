const nodemailer = require('nodemailer');

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
  EMAIL_TO
} = process.env;

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.warn('[mailer] Missing SMTP env vars: SMTP_HOST/SMTP_USER/SMTP_PASS may be undefined');
}

console.log('[mailer] SMTP settings', {
  SMTP_HOST: !!process.env.SMTP_HOST,
  SMTP_PORT: !!process.env.SMTP_PORT,
  SMTP_USER: !!process.env.SMTP_USER,
});

console.log('[mailer] env:', {
  SMTP_HOST: !!process.env.SMTP_HOST,
  SMTP_PORT: !!process.env.SMTP_PORT,
  SMTP_USER: !!process.env.SMTP_USER,
  EMAIL_TO: !!process.env.EMAIL_TO,
  EMAIL_FROM: !!process.env.EMAIL_FROM
});

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: parseInt(SMTP_PORT || '587', 10),
  secure: SMTP_PORT == 465, // true for 465, false for 587
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

async function sendInterestsEmail({ interests, userEmail }) {
  const to = EMAIL_TO || userEmail || SMTP_USER;
  const from = EMAIL_FROM || SMTP_USER;
  const html = `<p>User ${userEmail || 'unknown'} updated interests: ${JSON.stringify(interests)}</p>`;
  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: 'Interests updated',
      html,
    });
    console.log('[mailer] Sent:', info.messageId, 'to', to);
    return info;
  } catch (err) {
    console.error('[mailer] sendMail error:', err);
    throw err;
  }
}

module.exports = { sendInterestsEmail };