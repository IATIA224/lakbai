const nodemailer = require('nodemailer');
require('dotenv').config();

const masked = (s = '') => (s.length > 4 ? `${s.slice(0, 2)}...${s.slice(-2)}` : s);

console.log('Mailer config:', {
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE,
  user: masked(process.env.EMAIL_USER),
  pass: process.env.EMAIL_PASS ? '***' : '(none)',
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

transporter.verify()
  .then(() => console.log('Mailer: SMTP ready'))
  .catch(err => console.error('Mailer verify error (startup):', err && (err.message || err)));

async function sendMail({ to, subject, text, html, from }) {
  try {
    const mailOptions = {
      from: from || process.env.EMAIL_FROM,
      to,
      subject,
      text,
      html,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log('Mailer: sent', info.messageId);
    return info;
  } catch (err) {
    console.error('Mailer send error:', err && (err.stack || err.message || err));
    throw err;
  }
}

async function sendInterestsEmail(interests) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[MAILER] Missing SMTP_* env vars; cannot send');
    throw new Error('SMTP configuration missing');
  }
  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || 'no-reply@yourapp.com',
      to: process.env.MAIL_TO || 'admin@yourapp.com',
      subject: 'Updated Interests',
      text: `Interests: ${JSON.stringify(interests)}`,
      html: `<p>Interests: ${JSON.stringify(interests)}</p>`
    });
    console.log('[MAILER] sent', info);
    return info;
  } catch (err) {
    console.error('[MAILER] error', err);
    throw err;
  }
}

module.exports = { sendMail, sendInterestsEmail };