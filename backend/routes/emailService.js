import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// 1. Create the Transporter
// This handles the connection to your email provider
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can use 'gmail', 'outlook', or provide host/port for others
  auth: {
    user: process.env.EMAIL_USER,     // Your email address
    pass: process.env.EMAIL_PASS      // Your email password or App Password
  }
});

// 2. Define the Verification Email Function
export const sendVerificationEmail = async (to, token, username) => {
  const verificationLink = `https://lovculator.com/verify-email.html?token=${token}`;

  const mailOptions = {
    from: `"Lovculator Team" <${process.env.EMAIL_USER}>`,
    to: to,
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
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return false;
  }
};

// 3. Define Welcome Email Function
export const sendWelcomeEmail = async (to, username) => {
  const mailOptions = {
    from: `"Lovculator Team" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: 'Welcome to Lovculator!',
    html: `
      <h3>Hi ${username},</h3>
      <p>Your email has been verified successfully. You now have full access to all features!</p>
      <p>Have fun calculating love!</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    return false;
  }
};

// 4. Define Password Reset Email Function
export const sendPasswordResetEmail = async (to, token) => {
  // Use a frontend page URL that handles the reset logic
  const resetLink = `https://lovculator.com/reset-password.html?token=${token}`;

  const mailOptions = {
    from: `"Lovculator Support" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: 'Reset Your Password',
    html: `
      <h3>Password Reset Request</h3>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <a href="${resetLink}">Reset Password</a>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('❌ Error sending reset email:', error);
    return false;
  }
};