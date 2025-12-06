// backend/routes/emailService.js - EmailJS Version (Updated)
import dotenv from 'dotenv';
dotenv.config();

/**
 * Send verification email using EmailJS
 */
export const sendVerificationEmail = async (to, token, username) => {
  try {
    // Validate environment variables
    if (!process.env.EMAILJS_SERVICE_ID || !process.env.EMAILJS_TEMPLATE_ID || !process.env.EMAILJS_PUBLIC_KEY) {
      console.error('❌ EmailJS credentials missing. Check Railway variables.');
      console.log('Service ID present:', !!process.env.EMAILJS_SERVICE_ID);
      console.log('Template ID present:', !!process.env.EMAILJS_TEMPLATE_ID);
      console.log('Public Key present:', !!process.env.EMAILJS_PUBLIC_KEY);
      return false;
    }
    
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
    console.log('📧 EmailJS Response Status:', response.status);
    console.log('📧 EmailJS Response:', result);
    
    if (response.ok) {
      console.log(`✅ Verification email sent to ${to}`);
      return true;
    } else {
      console.error(`❌ EmailJS failed: ${result}`);
      
      // Log specific error details
      if (result.includes('insufficient authentication scopes')) {
        console.error('⚠️  Gmail API scope issue. Reconnect Gmail in EmailJS dashboard.');
      } else if (result.includes('Template not found')) {
        console.error('⚠️  Template ID incorrect. Check EmailJS template.');
      } else if (result.includes('Service not found')) {
        console.error('⚠️  Service ID incorrect. Check EmailJS connected service.');
      }
      
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
  try {
    // Validate credentials
    if (!process.env.EMAILJS_SERVICE_ID || !process.env.EMAILJS_PUBLIC_KEY) {
      console.error('❌ EmailJS credentials missing for password reset');
      return false;
    }
    
    const templateId = process.env.EMAILJS_PASSWORD_TEMPLATE_ID || process.env.EMAILJS_TEMPLATE_ID;
    
    if (!templateId) {
      console.error('❌ No EmailJS template ID found for password reset');
      return false;
    }
    
    const resetLink = `https://lovculator.com/reset-password.html?token=${token}`;
    
    const templateParams = {
      to_email: to,
      reset_link: resetLink,
      reply_to: 'support@lovculator.com'
    };
    
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        service_id: process.env.EMAILJS_SERVICE_ID,
        template_id: templateId,
        user_id: process.env.EMAILJS_PUBLIC_KEY,
        template_params: templateParams
      })
    });
    
    const result = await response.text();
    
    if (response.ok) {
      console.log(`✅ Password reset email sent to ${to}`);
      return true;
    } else {
      console.error(`❌ EmailJS password reset failed: ${result}`);
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
  // For now, just log. You can create a welcome template later.
  console.log(`📧 Welcome email would be sent to ${to} (username: ${username})`);
  return true;
};

/**
 * Test EmailJS connection (for debugging)
 */
export const testEmailJSConnection = async () => {
  try {
    console.log('🔍 Testing EmailJS connection...');
    console.log('Service ID:', process.env.EMAILJS_SERVICE_ID ? '✅ Present' : '❌ Missing');
    console.log('Template ID:', process.env.EMAILJS_TEMPLATE_ID ? '✅ Present' : '❌ Missing');
    console.log('Public Key:', process.env.EMAILJS_PUBLIC_KEY ? '✅ Present' : '❌ Missing');
    
    if (!process.env.EMAILJS_SERVICE_ID || !process.env.EMAILJS_TEMPLATE_ID || !process.env.EMAILJS_PUBLIC_KEY) {
      return { success: false, message: 'Missing credentials' };
    }
    
    // Simple test request
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: process.env.EMAILJS_SERVICE_ID,
        template_id: process.env.EMAILJS_TEMPLATE_ID,
        user_id: process.env.EMAILJS_PUBLIC_KEY,
        template_params: {
          to_email: 'test@example.com',
          username: 'TestUser',
          verification_link: 'https://lovculator.com/test',
          year: '2024'
        }
      })
    });
    
    const result = await response.text();
    return {
      success: response.ok,
      status: response.status,
      message: result
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  testEmailJSConnection
};