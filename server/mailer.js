const nodemailer = require('nodemailer');

if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.warn('[MAILER] no SMTP credentials found in env');
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  }
});

async function sendInterestsEmail({ interests, name }) {
  if (!process.env.SMTP_USER) {
    throw new Error('SMTP not configured');
  }
  return transporter.sendMail({
    from: process.env.MAIL_FROM || 'no-reply@yourapp.com',
    to: process.env.MAIL_TO || 'your@email.com',
    subject: `New interests from ${name || 'unknown'}`,
    text: `Interests: ${JSON.stringify(interests)}`
  });
}

module.exports = { sendInterestsEmail };