const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (to, subject, html) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Lakbai <lakbaiitineraries@gmail.com>', // Now this will work!
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('❌ Resend Error:', error);
      throw error;
    }

    console.log('✅ Email sent successfully:', data);
    return { success: true };
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    throw error;
  }
};

module.exports = { sendEmail };