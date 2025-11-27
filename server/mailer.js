const nodemailer = require('nodemailer');

console.log('[MAILER] env check', {
  SMTP_HOST: !!process.env.SMTP_HOST,
  SMTP_PORT: !!process.env.SMTP_PORT,
  SMTP_USER: !!process.env.SMTP_USER,
  SMTP_PASS: !!process.env.SMTP_PASS,
  SENDGRID_API_KEY: !!process.env.SENDGRID_API_KEY,
  MAIL_TO: !!process.env.MAIL_TO,
  MAIL_FROM: !!process.env.MAIL_FROM,
});

let sendViaSendgrid = false;
if (process.env.SENDGRID_API_KEY) {
  sendViaSendgrid = true;
}

if (sendViaSendgrid) {
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  module.exports.sendInterestsEmail = async ({ interests, name, meta }) => {
    const text = `Interests: ${JSON.stringify(interests)}\nName: ${name}\nMeta: ${JSON.stringify(meta)}`;
    const msg = {
      to: process.env.MAIL_TO,
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      subject: 'Interests updated',
      text,
    };
    try {
      console.log('[MAILER] Using SendGrid to send', { to: msg.to, from: msg.from });
      const response = await sgMail.send(msg);
      console.log('[MAILER] SendGrid response', response?.[0]?.statusCode);
      return response;
    } catch (err) {
      console.error('[MAILER] SendGrid error', err);
      throw err;
    }
  };
} else {
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: (process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  module.exports.sendInterestsEmail = async ({ interests, name, meta = {} }) => {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('[MAILER] SMTP credentials not set; aborting');
      throw new Error('SMTP credentials missing');
    }
    const mail = {
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: process.env.MAIL_TO,
      subject: `Interests updated (${name || 'unknown'})`,
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