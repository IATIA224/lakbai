const sgMail = require('@sendgrid/mail');

console.log('🔧 Mailer initializing...');
console.log('📧 SENDGRID_API_KEY available:', !!process.env.SENDGRID_API_KEY);

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendInterestsEmail = async (userEmail, interests) => {
  try {
    console.log('🚀 sendInterestsEmail called');
    console.log('   To:', userEmail);
    console.log('   From:', process.env.EMAIL_FROM || 'noreply@sendgrid.net');
    
    const interestsList = interests.length > 0 
      ? interests.map(i => `• ${i}`).join('\n')
      : '(No interests selected)';

    const msg = {
      to: userEmail,
      from: process.env.EMAIL_FROM || 'noreply@sendgrid.net',
      subject: 'Your Travel Interests Updated - LakbAI',
      html: `<div>Test email</div>`, // Simple test
    };

    console.log('📨 Message object created');
    await sgMail.send(msg);
    console.log('✅ EMAIL SENT VIA SENDGRID');
  } catch (error) {
    console.error('❌ SENDGRID ERROR:', error.message);
    console.error('   Status:', error.code);
    console.error('   Response:', error.response?.body);
    throw error;
  }
};

module.exports = { sendInterestsEmail };