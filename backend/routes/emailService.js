import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
    // Use 'smtp' for a standard provider like Gmail
    service: 'gmail', 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    // For services other than Gmail, you might need host/port/secure settings
});

/**
 * Sends a password reset email to the user.
 * @param {string} to - The recipient's email address.
 * @param {string} token - The unique reset token.
 */
export const sendPasswordResetEmail = async (to, token) => {
    const resetUrl = `https://lovculator.com/reset-password.html?token=${token}`;

    const mailOptions = {
        from: `💖 Lovculator <${process.env.EMAIL_USER}>`,
        to: to,
        subject: 'Password Reset Request for Lovculator',
        html: `
            <p>You requested a password reset for your Lovculator account.</p>
            <p>Please click this link to reset your password:</p>
            <a href="${resetUrl}" style="color: #ff4b8d; font-weight: bold;">Reset Password</a>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request this, please ignore this email.</p>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${to}`);
    } catch (error) {
        console.error(`Error sending email to ${to}:`, error);
        // It's generally safer to log the error and proceed, rather than crash the request
    }
};