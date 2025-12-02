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
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify()
  .then(() => console.log('Mailer: SMTP ready'))
  .catch(err => {
    console.error('Mailer verify error (startup):', err && (err.message || err));
    console.warn('⚠️  Email service unavailable. Check EMAIL_* environment variables.');
  });

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

module.exports = { sendMail };