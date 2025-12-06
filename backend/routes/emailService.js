// backend/routes/emailService.js - EmailJS Version
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Send verification email using EmailJS
 */
export const sendVerificationEmail = async (to, token, username) => {
  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: process.env.EMAILJS_SERVICE_ID,      // Your SERVICE ID
        template_id: process.env.EMAILJS_TEMPLATE_ID,    // Your TEMPLATE ID
        user_id: process.env.EMAILJS_PUBLIC_KEY,         // Your PUBLIC KEY
        template_params: {
          to_email: to,                                  // Recipient email
          username: username,                            // User's name
          verification_link: `https://lovculator.com/verify-email.html?token=${token}`,
          year: new Date().getFullYear().toString(),     // Current year
          reply_to: 'support@lovculator.com'             // Optional
        }
      })
    });

    const result = await response.text();
    console.log('📧 EmailJS Response:', result);
    
    if (response.ok) {
      console.log(`✅ Verification email sent to ${to}`);
      return true;
    } else {
      console.error(`❌ EmailJS failed: ${result}`);
      return false;
    }
  } catch (error) {
    console.error('❌ EmailJS network error:', error.message);
    return false;
  }
};

/**
 * Send password reset email using EmailJS
 */
export const sendPasswordResetEmail = async (to, token) => {
  // Create a separate template in EmailJS for password reset
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_PASSWORD_TEMPLATE_ID || process.env.EMAILJS_TEMPLATE_ID;
  const userId = process.env.EMAILJS_PUBLIC_KEY;
  
  const resetLink = `${process.env.CLIENT_URL || 'https://lovculator.com'}/reset-password.html?token=${token}`;
  
  const templateParams = {
    to_email: to,
    reset_link: resetLink,
    reply_to: 'noreply@lovculator.com'
  };
  
  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: userId,
        template_params: templateParams
      })
    });
    
    if (response.ok) {
      console.log(`✅ EmailJS: Password reset email sent to ${to}`);
      return true;
    } else {
      console.error(`❌ EmailJS password reset failed for ${to}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ EmailJS network error for ${to}:`, error.message);
    return false;
  }
};

/**
 * Send welcome email after verification
 */
export const sendWelcomeEmail = async (to, username) => {
  // Optional: Create welcome email template in EmailJS
  console.log(`✅ Welcome email would be sent to ${to} (username: ${username})`);
  return true;
};

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail
};