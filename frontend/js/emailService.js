// frontend/js/emailService.js
import emailjs from '@emailjs/browser';

// Initialize with your Public Key
emailjs.init(process.env.EMAILJS_PUBLIC_KEY || 'your-public-key-here');

export const sendVerificationEmail = async (to, token, username) => {
  try {
    const response = await emailjs.send(
      process.env.EMAILJS_SERVICE_ID || 'your-service-id',
      process.env.EMAILJS_TEMPLATE_ID || 'your-template-id',
      {
        to_email: to,
        username: username,
        verification_link: `https://lovculator.com/verify-email.html?token=${token}`,
        year: new Date().getFullYear().toString(),
      }
    );
    
    console.log('✅ Email sent via frontend:', response);
    return true;
  } catch (error) {
    console.error('❌ Frontend email error:', error);
    return false;
  }
};