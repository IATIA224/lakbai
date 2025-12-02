const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendInterestsEmail = async (userEmail, interests) => {
  try {
    const interestsList = interests.length > 0 
      ? interests.map(i => `• ${i}`).join('\n')
      : '(No interests selected)';

    const msg = {
      to: userEmail,
      from: process.env.EMAIL_FROM || 'noreply@sendgrid.net',
      subject: 'Your Travel Interests Updated - LakbAI',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #6c63ff 0%, #5a4fcf 100%); padding: 40px 20px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 600;">✈️ Your Travel Preferences Updated!</h1>
          </div>

          <!-- Content -->
          <div style="background: white; padding: 40px 30px; margin: 20px;">
            <p style="color: #333; font-size: 16px; line-height: 1.6;">Hi there,</p>
            
            <p style="color: #555; font-size: 15px; line-height: 1.6;">Your travel interests have been successfully updated. Here's what you're interested in:</p>

            <!-- Interests Box -->
            <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 5px solid #6c63ff;">
              <pre style="white-space: pre-wrap; color: #1f2937; font-family: inherit; margin: 0; font-size: 14px;">${interestsList}</pre>
            </div>

            <p style="color: #666; font-size: 15px; line-height: 1.6;">We'll use these preferences to personalize your travel recommendations and itineraries.</p>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 35px 0;">
              <a href="https://lakbai.onrender.com/dashboard" style="display: inline-block; background: linear-gradient(135deg, #6c63ff 0%, #5a4fcf 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(108, 99, 255, 0.3); transition: transform 0.2s ease;">
                Explore Your Dashboard →
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

            <p style="color: #888; font-size: 14px; line-height: 1.6; margin: 0;">Happy travels!<br><strong style="color: #6c63ff;">LakbAI Team</strong></p>
          </div>

          <!-- Footer -->
          <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0;">© 2025 LakbAI. All rights reserved.</p>
            <p style="margin: 5px 0 0 0;">This email was sent to ${userEmail}</p>
          </div>
        </div>
      `,
    };

    await sgMail.send(msg);
    console.log('✅ Interests email sent successfully to:', userEmail);
  } catch (error) {
    console.error('❌ SendGrid email error:', error.response?.body || error.message);
    throw error;
  }
};

module.exports = { sendInterestsEmail };