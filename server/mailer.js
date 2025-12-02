const sgMail = require('@sendgrid/mail');
require('dotenv').config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (to, subject, html) => {
  const msg = {
    to,
    from: process.env.EMAIL_FROM || 'LakbAI <lakbaiitineraries@gmail.com>',
    subject,
    html,
  };

  try {
    await sgMail.send(msg);
    console.log('✅ Email sent to:', to);
    return { success: true };
  } catch (error) {
    console.error('❌ SendGrid Error:', error.response?.body || error.message);
    throw error;
  }
};

module.exports = { sendEmail };