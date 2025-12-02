const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendInterestsEmail = async (userEmail, interests) => {
  try {
    const interestsList = interests.length > 0 
      ? interests.map(i => `• ${i}`).join('\n')
      : '(No interests selected)';

    const msg = {
      to: userEmail,
      from: process.env.EMAIL_FROM || 'lakbaiitineraries@gmail.com',
      subject: 'Your Travel Interests Updated - LakbAI',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6c63ff;">Your Travel Preferences Updated!</h2>
          <p>Hi there,</p>
          <p>Your travel interests have been successfully updated. Here's what you're interested in:</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <pre style="white-space: pre-wrap; color: #1f2937;">${interestsList}</pre>
          </div>
          <p>We'll use these preferences to personalize your travel recommendations and itineraries.</p>
          <p>Happy travels!<br><strong>LakbAI Team</strong></p>
        </div>
      `,
    };

    await sgMail.send(msg);
    console.log('Interests email sent successfully to:', userEmail);
  } catch (error) {
    console.error('SendGrid email error:', error);
    throw error;
  }
};

module.exports = { sendInterestsEmail };