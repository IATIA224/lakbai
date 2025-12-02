const nodemailer = require('nodemailer');

console.log('=== MAILER DEBUG ===');
console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS exists:', !!process.env.EMAIL_PASS);
console.log('EMAIL_PASS length:', process.env.EMAIL_PASS?.length || 0);
console.log('EMAIL_SECURE:', process.env.EMAIL_SECURE);
console.log('===================');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((err, success) => {
  if (err) {
    console.error('❌ Mailer verify error (startup):', err.message);
    console.error('   Code:', err.code);
    console.error('   Command:', err.command);
  } else {
    console.log('✅ Mailer: SMTP ready');
  }
});

const sendMail = async (mailOptions) => {
  return transporter.sendMail(mailOptions);
};

module.exports = { sendMail, transporter };