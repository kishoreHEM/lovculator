// backend/routes/emailService.js - EmailJS Version
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Send verification email using EmailJS
 */
export const sendVerificationEmail = async (to, token, username) => {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const userId = process.env.EMAILJS_PUBLIC_KEY;
  
  if (!serviceId || !templateId || !userId) {
    console.error('❌ EmailJS credentials missing');
    return false;
  }
  
  const verificationLink = `${process.env.CLIENT_URL || 'https://lovculator.com'}/verify-email.html?token=${token}`;
  
  const templateParams = {
    to_email: to,
    username: username,
    verification_link: verificationLink,
    reply_to: 'noreply@lovculator.com'
  };
  
  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': process.env.CLIENT_URL || 'https://lovculator.com'
      },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: userId,
        template_params: templateParams,
        accessToken: process.env.EMAILJS_PRIVATE_KEY // Optional for private templates
      })
    });
    
    if (response.ok) {
      console.log(`✅ EmailJS: Verification email sent to ${to}`);
      return true;
    } else {
      const error = await response.text();
      console.error(`❌ EmailJS failed for ${to}:`, error);
      return false;
    }
  } catch (error) {
    console.error(`❌ EmailJS network error for ${to}:`, error.message);
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