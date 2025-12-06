// backend/test-email.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

async function testEmail() {
  console.log('📧 Testing email configuration...');
  console.log('EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Missing');
  console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Set' : '❌ Missing');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    // Test email
    const info = await transporter.sendMail({
      from: `"Lovculator Test" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // Send to yourself
      subject: '📧 Lovculator Email Test',
      text: 'If you receive this, email setup is working!',
      html: '<h1>✅ Email Test Successful!</h1><p>Lovculator email system is working.</p>',
    });

    console.log('✅ Email sent successfully:', info.messageId);
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    
    // Common error troubleshooting
    if (error.code === 'EAUTH') {
      console.log('\n🔧 Troubleshooting steps:');
      console.log('1. Verify EMAIL_USER is correct');
      console.log('2. Verify EMAIL_PASS is correct (16 characters, no spaces)');
      console.log('3. Ensure 2FA is enabled on the Gmail account');
      console.log('4. Regenerate App Password if needed');
    }
  }
}

testEmail();