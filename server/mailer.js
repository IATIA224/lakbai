const nodemailer = require('nodemailer');

console.log('[MAILER] env check', {
  SMTP_HOST: !!process.env.SMTP_HOST,
  SMTP_PORT: !!process.env.SMTP_PORT,
  SMTP_USER: !!process.env.SMTP_USER,
  SMTP_PASS: !!process.env.SMTP_PASS,
  SENDGRID_API_KEY: !!process.env.SENDGRID_API_KEY,
  MAIL_FROM: !!process.env.MAIL_FROM,
  MAIL_TO: !!process.env.MAIL_TO,
});

// Use SendGrid API if key provided (recommended)
if (process.env.SENDGRID_API_KEY) {
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
      console.log('[MAILER] Using SendGrid:', { to: msg.to, from: msg.from });
      const resp = await sgMail.send(msg);
      console.log('[MAILER] sendgrid resp status:', resp?.[0]?.statusCode);
      return resp;
    } catch (err) {
      console.error('[MAILER] SendGrid error', err);
      throw err;
    }
  };
} else {
  // require SMTP envs and fail early if missing
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('[MAILER] SMTP is not configured, please set env vars or use SendGrid');
    throw new Error('SMTP credentials missing. Use SENDGRID_API_KEY or SMTP_ envs');
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: (process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // verify transporter at startup
  transport.verify().then(() => {
    console.log('[MAILER] SMTP transporter verified');
  }).catch(err => {
    console.error('[MAILER] verify error (startup):', err && (err.message || err));
  });

  module.exports.sendInterestsEmail = async ({ interests, name, meta = {} }) => {
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
      console.error('[MAILER] sendMail error:', err);
      throw err;
    }
  };
}