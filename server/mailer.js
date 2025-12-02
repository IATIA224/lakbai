const sgMail = require('@sendgrid/mail');
require('dotenv').config();

const apiKey = process.env.SENDGRID_API_KEY;
if (!apiKey) {
  console.warn('Warning: SENDGRID_API_KEY not set in environment variables');
}

sgMail.setApiKey(apiKey);

async function sendMail({ to, subject, text, html, from }) {
  try {
    const msg = {
      to,
      from: from || process.env.EMAIL_FROM || 'noreply@lakbai.com',
      subject,
      text,
      html,
    };
    const info = await sgMail.send(msg);
    console.log('SendGrid: email sent', info[0].statusCode);
    return info;
  } catch (err) {
    console.error('SendGrid send error:', err?.message || err);
    throw err;
  }
}

module.exports = { sendMail };