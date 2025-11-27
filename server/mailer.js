const nodemailer = require('nodemailer');

console.log('[MAILER] env check', {
  SMTP_HOST: !!process.env.SMTP_HOST,
  SMTP_PORT: !!process.env.SMTP_PORT,
  SMTP_USER: !!process.env.SMTP_USER,
  SENDGRID_API_KEY: !!process.env.SENDGRID_API_KEY,
});

// Prefer SendGrid API in production if API key is set
let sendViaSendgrid = false;
try {
  if (process.env.SENDGRID_API_KEY) {
    sendViaSendgrid = true;
    // Use @sendgrid/mail if installed, otherwise fallback to nodemailer SMTP
  }
} catch (e) { /* ignore */ }

let transport;
if (sendViaSendgrid) {
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  module.exports.sendInterestsEmail = async ({ interests, meta }) => {
    const text = `Interests: ${JSON.stringify(interests)}\nMeta: ${JSON.stringify(meta)}`;
    const msg = {
      to: process.env.MAIL_TO,
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      subject: 'User interest updates',
      text,
    };
    try {
      console.log('[MAILER] Using SendGrid to send', { to: msg.to, from: msg.from });
      const response = await sgMail.send(msg);
      console.log('[MAILER] sendgrid response', response?.[0]?.statusCode);
      return response;
    } catch (err) {
      console.error('[MAILER] SendGrid error', err);
      throw err;
    }
  };
} else {
  // SMTP via nodemailer
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: (process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  module.exports.sendInterestsEmail = async ({ interests, meta = {} }) => {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('[MAILER] SMTP credentials missing; email will not be sent.');
      throw new Error('SMTP credentials missing');
    }
    const mail = {
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: process.env.MAIL_TO,
      subject: `Interests update (${meta.uid || 'anonymous'})`,
      text: `Interests: ${JSON.stringify(interests)}\nMeta: ${JSON.stringify(meta)}`,
    };
    try {
      const info = await transport.sendMail(mail);
      console.log('[MAILER] nodemailer success', info.messageId || info);
      return info;
    } catch (err) {
      console.error('[MAILER] nodemailer error', err);
      throw err;
    }
  };
}