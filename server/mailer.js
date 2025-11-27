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

// Setup send function without throwing at module load
let sendInterestsEmail;
let transporter;
let usingSendgrid = false;

if (process.env.SENDGRID_API_KEY) {
  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    usingSendgrid = true;

    sendInterestsEmail = async ({ interests, name, meta = {} }) => {
      if (!process.env.MAIL_TO || !process.env.MAIL_FROM) {
        console.warn('[MAILER] SENDGRID required MAIL_TO/MAIL_FROM env vars missing');
        throw new Error('Mailer not configured: missing MAIL_TO or MAIL_FROM');
      }
      const text = `Interests: ${JSON.stringify(interests)}\nName: ${name}\nMeta: ${JSON.stringify(meta)}`;
      const msg = {
        to: process.env.MAIL_TO,
        from: process.env.MAIL_FROM,
        subject: 'Interests updated',
        text,
      };
      try {
        const resp = await sgMail.send(msg);
        console.log('[MAILER] SendGrid send success', resp?.[0]?.statusCode);
        return resp;
      } catch (err) {
        console.error('[MAILER] SendGrid error', err?.message || err);
        throw err;
      }
    };

    console.log('[MAILER] configured to use SendGrid');
  } catch (err) {
    console.error('[MAILER] SendGrid module not installed or init failed', err?.message || err);
    // keep trying SMTP fallback below
  }
}

// SMTP fallback (only if configured)
if (!usingSendgrid && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: (process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Optional verify to show connection problems, but catch errors to not crash
  transporter.verify().then(() => {
    console.log('[MAILER] SMTP transporter verified');
  }).catch(err => {
    console.warn('[MAILER] SMTP verify warning (non-fatal):', err?.message || err);
  });

  sendInterestsEmail = async ({ interests, name, meta = {} }) => {
    if (!process.env.MAIL_TO || !process.env.MAIL_FROM) {
      console.warn('[MAILER] SMTP required MAIL_TO/MAIL_FROM env vars missing');
      throw new Error('Mailer not configured: missing MAIL_TO or MAIL_FROM');
    }
    const mail = {
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: process.env.MAIL_TO,
      subject: `Interests updated (${name || 'unknown'})`,
      text: `Interests: ${JSON.stringify(interests)}\nMeta: ${JSON.stringify(meta)}`,
    };
    try {
      const info = await transporter.sendMail(mail);
      console.log('[MAILER] nodemailer success', info.messageId || info);
      return info;
    } catch (err) {
      console.error('[MAILER] sendMail error:', err?.message || err);
      throw err;
    }
  };
}

// If neither SendGrid nor SMTP initialized, create a failing function (non-fatal at require)
if (!sendInterestsEmail) {
  console.warn('[MAILER] No send method configured (SENDGRID_API_KEY or SMTP_* envs). Mail sends will fail until configured.');
  sendInterestsEmail = async () => {
    throw new Error('Mailer not configured. Set SENDGRID_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS');
  };
}

// Export the function
module.exports = {
  sendInterestsEmail,
};