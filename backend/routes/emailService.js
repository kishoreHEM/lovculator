import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Sends a verification email to new users
 * @param {string} to - Recipient's email address
 * @param {string} token - Verification token
 * @param {string} username - User's username
 */
export const sendVerificationEmail = async (to, token, username) => {
    const verificationUrl = `https://lovculator.com/verify-email.html?token=${token}`;
    
    const mailOptions = {
        from: `💖 Lovculator <${process.env.EMAIL_USER}>`,
        to: to,
        subject: `Welcome to Lovculator, ${username}! Please Verify Your Email`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { text-align: center; padding: 20px 0; }
                    .logo { color: #ff4b8d; font-size: 24px; font-weight: bold; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 10px; }
                    .btn { 
                        display: inline-block; 
                        background: linear-gradient(135deg, #ff4b8d, #ff8e53); 
                        color: white; 
                        padding: 14px 28px; 
                        text-decoration: none; 
                        border-radius: 25px; 
                        font-weight: bold; 
                        margin: 20px 0; 
                    }
                    .footer { 
                        text-align: center; 
                        margin-top: 30px; 
                        color: #666; 
                        font-size: 12px; 
                    }
                    .highlight { color: #ff4b8d; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">💖 Lovculator</div>
                    </div>
                    
                    <div class="content">
                        <h2>Welcome aboard, ${username}! 🎉</h2>
                        <p>Thank you for joining our community of love and relationship enthusiasts.</p>
                        
                        <p>To complete your registration and start using all features, please verify your email address:</p>
                        
                        <div style="text-align: center;">
                            <a href="${verificationUrl}" class="btn">Verify My Email</a>
                        </div>
                        
                        <p>Or copy and paste this link in your browser:</p>
                        <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 5px;">
                            ${verificationUrl}
                        </p>
                        
                        <p><strong>Important:</strong> This verification link will expire in <span class="highlight">24 hours</span>.</p>
                        
                        <p>If you didn't create an account with Lovculator, please ignore this email.</p>
                        
                        <p>Happy calculating!<br>
                        The Lovculator Team 💖</p>
                    </div>
                    
                    <div class="footer">
                        <p>This email was sent to ${to}</p>
                        <p>© ${new Date().getFullYear()} Lovculator. All rights reserved.</p>
                        <p><a href="https://lovculator.com" style="color: #ff4b8d;">Visit our website</a></p>
                    </div>
                </div>
            </body>
            </html>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Verification email sent to ${to}`);
        return true;
    } catch (error) {
        console.error(`❌ Error sending verification email to ${to}:`, error);
        return false;
    }
};

/**
 * Sends a password reset email
 * @param {string} to - Recipient's email address
 * @param {string} token - Reset token
 */
export const sendPasswordResetEmail = async (to, token) => {
    const resetUrl = `https://lovculator.com/reset-password.html?token=${token}`;

    const mailOptions = {
        from: `💖 Lovculator <${process.env.EMAIL_USER}>`,
        to: to,
        subject: 'Password Reset Request for Lovculator',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { text-align: center; padding: 20px 0; }
                    .logo { color: #ff4b8d; font-size: 24px; font-weight: bold; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 10px; }
                    .btn { 
                        display: inline-block; 
                        background: linear-gradient(135deg, #ff4b8d, #ff8e53); 
                        color: white; 
                        padding: 14px 28px; 
                        text-decoration: none; 
                        border-radius: 25px; 
                        font-weight: bold; 
                        margin: 20px 0; 
                    }
                    .warning { 
                        background: #fff3cd; 
                        border-left: 4px solid #ffc107; 
                        padding: 10px; 
                        margin: 15px 0; 
                    }
                    .footer { 
                        text-align: center; 
                        margin-top: 30px; 
                        color: #666; 
                        font-size: 12px; 
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">💖 Lovculator</div>
                    </div>
                    
                    <div class="content">
                        <h2>Password Reset Request</h2>
                        
                        <p>We received a request to reset your Lovculator account password.</p>
                        
                        <div style="text-align: center;">
                            <a href="${resetUrl}" class="btn">Reset My Password</a>
                        </div>
                        
                        <p>Or copy and paste this link:</p>
                        <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 5px;">
                            ${resetUrl}
                        </p>
                        
                        <div class="warning">
                            <p><strong>⚠️ Important:</strong> 
                            This link will expire in <strong>1 hour</strong>.
                            If you didn't request this reset, please ignore this email or contact support.</p>
                        </div>
                        
                        <p>For security reasons, never share this link with anyone.</p>
                        
                        <p>Best regards,<br>
                        The Lovculator Security Team 🔒</p>
                    </div>
                    
                    <div class="footer">
                        <p>This email was sent in response to a password reset request.</p>
                        <p>© ${new Date().getFullYear()} Lovculator. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Password reset email sent to ${to}`);
        return true;
    } catch (error) {
        console.error(`❌ Error sending password reset email to ${to}:`, error);
        return false;
    }
};

/**
 * Sends a verification reminder email
 * @param {string} to - Recipient's email address
 * @param {string} token - Verification token
 */
export const sendVerificationReminder = async (to, token, username) => {
    const verificationUrl = `https://lovculator.com/verify-email.html?token=${token}`;
    
    const mailOptions = {
        from: `💖 Lovculator <${process.env.EMAIL_USER}>`,
        to: to,
        subject: `Reminder: Verify Your Lovculator Account`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { text-align: center; padding: 20px 0; }
                    .logo { color: #ff4b8d; font-size: 24px; font-weight: bold; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 10px; }
                    .btn { 
                        display: inline-block; 
                        background: linear-gradient(135deg, #ff4b8d, #ff8e53); 
                        color: white; 
                        padding: 14px 28px; 
                        text-decoration: none; 
                        border-radius: 25px; 
                        font-weight: bold; 
                        margin: 20px 0; 
                    }
                    .reminder { 
                        background: #e7f3ff; 
                        border-left: 4px solid #2196F3; 
                        padding: 15px; 
                        margin: 20px 0; 
                    }
                    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">💖 Lovculator</div>
                    </div>
                    
                    <div class="content">
                        <h2>Hey ${username}!</h2>
                        
                        <p>We noticed you haven't verified your email address yet.</p>
                        
                        <div class="reminder">
                            <p><strong>💡 Did you know?</strong> 
                            Verified users get access to all features including:</p>
                            <ul>
                                <li>Post unlimited questions</li>
                                <li>Like and comment on answers</li>
                                <li>Follow other users</li>
                                <li>Personalized recommendations</li>
                            </ul>
                        </div>
                        
                        <div style="text-align: center;">
                            <a href="${verificationUrl}" class="btn">Verify Now & Unlock Features</a>
                        </div>
                        
                        <p>Verification link (expires in 24 hours from original signup):</p>
                        <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 5px;">
                            ${verificationUrl}
                        </p>
                        
                        <p>If you're having trouble, <a href="https://lovculator.com/help">visit our help center</a>.</p>
                    </div>
                    
                    <div class="footer">
                        <p>This is an automated reminder. Please do not reply to this email.</p>
                        <p>© ${new Date().getFullYear()} Lovculator</p>
                    </div>
                </div>
            </body>
            </html>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Verification reminder sent to ${to}`);
        return true;
    } catch (error) {
        console.error(`❌ Error sending verification reminder to ${to}:`, error);
        return false;
    }
};

/**
 * Sends a welcome email after successful verification
 * @param {string} to - Recipient's email address
 * @param {string} username - User's username
 */
export const sendWelcomeEmail = async (to, username) => {
    const mailOptions = {
        from: `💖 Lovculator <${process.env.EMAIL_USER}>`,
        to: to,
        subject: `Welcome to Lovculator! Your account is now verified 🎉`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { text-align: center; padding: 20px 0; }
                    .logo { color: #ff4b8d; font-size: 24px; font-weight: bold; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 10px; text-align: center; }
                    .celebration { font-size: 48px; margin: 20px 0; }
                    .features { 
                        display: grid; 
                        grid-template-columns: repeat(2, 1fr); 
                        gap: 15px; 
                        margin: 30px 0; 
                    }
                    .feature { 
                        background: white; 
                        padding: 15px; 
                        border-radius: 8px; 
                        text-align: center; 
                    }
                    .feature-icon { font-size: 24px; margin-bottom: 10px; }
                    .cta-button { 
                        display: inline-block; 
                        background: linear-gradient(135deg, #ff4b8d, #ff8e53); 
                        color: white; 
                        padding: 14px 28px; 
                        text-decoration: none; 
                        border-radius: 25px; 
                        font-weight: bold; 
                        margin: 20px 0; 
                    }
                    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">💖 Lovculator</div>
                    </div>
                    
                    <div class="content">
                        <div class="celebration">🎉</div>
                        
                        <h2>Welcome to Lovculator, ${username}!</h2>
                        <p>Your email has been successfully verified. You now have full access to all features!</p>
                        
                        <div class="features">
                            <div class="feature">
                                <div class="feature-icon">💬</div>
                                <h4>Ask Questions</h4>
                                <p>Get relationship advice from our community</p>
                            </div>
                            <div class="feature">
                                <div class="feature-icon">💖</div>
                                <h4>Share Insights</h4>
                                <p>Help others with your experiences</p>
                            </div>
                            <div class="feature">
                                <div class="feature-icon">👥</div>
                                <h4>Connect</h4>
                                <p>Follow users and build connections</p>
                            </div>
                            <div class="feature">
                                <div class="feature-icon">🔒</div>
                                <h4>Privacy Control</h4>
                                <p>Control what you share</p>
                            </div>
                        </div>
                        
                        <a href="https://lovculator.com/explore" class="cta-button">Start Exploring →</a>
                        
                        <p>Need help getting started? <a href="https://lovculator.com/guide">Check out our user guide</a>.</p>
                    </div>
                    
                    <div class="footer">
                        <p>We're excited to have you as part of our community!</p>
                        <p>© ${new Date().getFullYear()} Lovculator. Spread love, not drama 💕</p>
                    </div>
                </div>
            </body>
            </html>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Welcome email sent to ${to}`);
        return true;
    } catch (error) {
        console.error(`❌ Error sending welcome email to ${to}:`, error);
        return false;
    }
};

// Export all email functions
export default {
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendVerificationReminder,
    sendWelcomeEmail
};