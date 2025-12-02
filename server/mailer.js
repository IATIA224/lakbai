const sgMail = require('@sendgrid/mail');
require('dotenv').config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (to, subject, html) => {
  const msg = {
    to,
    from: process.env.EMAIL_FROM, // Must be verified in SendGrid
    subject,
    html,
  };

  try {
    await sgMail.send(msg);
    console.log('✅ Email sent successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ SendGrid Error:', error);
    throw error;
  }
};

module.exports = { sendEmail };