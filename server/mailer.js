const nodemailer = require('nodemailer');

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
  EMAIL_TO
} = process.env;

const MAIL_DISABLED = !SMTP_HOST || !SMTP_USER || !SMTP_PASS;

console.log('[mailer] SMTP envs:', {
  SMTP_HOST: !!SMTP_HOST, SMTP_PORT: !!SMTP_PORT, SMTP_USER: !!SMTP_USER,
  EMAIL_FROM: !!EMAIL_FROM, EMAIL_TO: !!EMAIL_TO, MAIL_DISABLED
});

// create transporter if possible
let transporter;
if (!MAIL_DISABLED) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT || 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  transporter.verify()
    .then(() => console.log('[mailer] SMTP connection succeeded'))
    .catch(err => console.error('[mailer] SMTP verify error', err && (err.stack || err.message || err)));
} else {
  console.warn('[mailer] Mailer disabled: missing SMTP credentials');
}

// send function
async function sendInterestsEmail({ interests = [], userEmail }) {
  if (MAIL_DISABLED) {
    const msg = '[mailer] disabled — email not sent';
    console.warn(msg, { interests, userEmail });
    // for debug return info or throw to show error in logs
    return { debug: true, message: 'Mailer disabled' };
  }

  const to = userEmail || process.env.EMAIL_TO || SMTP_USER;
  const from = process.env.EMAIL_FROM || SMTP_USER;

  const html = `<p>User ${userEmail || 'unknown'} updated interests: ${JSON.stringify(interests)}</p>`;
  const mailOptions = { from, to, subject: 'Interests updated', html };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('[mailer] sent', info.messageId);
    return info;
  } catch (err) {
    console.error('[mailer] send error', err && (err.stack || err.message || err));
    throw err; // let route handler handle and log
  }
}

module.exports = { sendInterestsEmail };