import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

// Initialize Resend with your API Key
const resend = new Resend(process.env.RESEND_API_KEY);

// Define the "From" address
// MUST use a verified domain (e.g., 'noreply@lovculator.com')
// For testing (before domain verification), use: 'onboarding@resend.dev'
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

export const sendVerificationEmail = async (to, token, username) => {
  const verificationLink = `https://lovculator.com/verify-email.html?token=${token}`;

  try {
    const data = await resend.emails.send({
      from: FROM_EMAIL,
      to: to, // In testing mode, this MUST be your own account email
      subject: 'Verify your email for Lovculator',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ff4b8d;">Welcome to Lovculator, ${username}!</h2>
          <p>Thank you for signing up. Please verify your email address to get full access.</p>
          <div style="margin: 30px 0;">
            <a href="${verificationLink}" style="background-color: #ff4b8d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Verify Email Now</a>
          </div>
          <p>Or click this link: <a href="${verificationLink}">${verificationLink}</a></p>
          <p style="color: #777; font-size: 12px;">This link will expire in 24 hours.</p>
        </div>
      `
    });

    console.log('✅ Email sent via Resend:', data);
    return true;
  } catch (error) {
    console.error('❌ Resend API Error:', error);
    return false;
  }
};

export const sendWelcomeEmail = async (to, username) => {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: to,
      subject: 'Welcome to Lovculator!',
      html: `
        <h3>Hi ${username},</h3>
        <p>Your email has been verified successfully. You now have full access to all features!</p>
        <p>Have fun calculating love!</p>
      `
    });
    return true;
  } catch (error) {
    console.error('❌ Resend Welcome Error:', error);
    return false;
  }
};

export const sendPasswordResetEmail = async (to, token) => {
  const resetLink = `https://lovculator.com/reset-password.html?token=${token}`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: to,
      subject: 'Reset Your Password',
      html: `
        <h3>Password Reset Request</h3>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        <a href="${resetLink}">Reset Password</a>
      `
    });
    return true;
  } catch (error) {
    console.error('❌ Resend Reset Error:', error);
    return false;
  }
};