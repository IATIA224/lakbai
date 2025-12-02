const nodemailer = require('nodemailer');
const sgTransport = require('nodemailer-sendgrid-transport');

console.log('=== MAILER DEBUG ===');
console.log('SENDGRID_API_KEY exists:', !!process.env.SENDGRID_API_KEY);
console.log('===================');

const transporter = nodemailer.createTransport(
  sgTransport({
    service: 'SendGrid',
    auth: {
      api_key: process.env.SENDGRID_API_KEY
    }
  })
);

transporter.verify((err, success) => {
  if (err) {
    console.error('❌ Mailer verify error:', err.message);
  } else {
    console.log('✅ Mailer: SendGrid ready');
  }
});

const sendMail = async (mailOptions) => {
  return transporter.sendMail(mailOptions);
};

module.exports = { sendMail, transporter };