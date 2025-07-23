const nodemailer = require('nodemailer');
const emailTemplateManager = require('./emailTemplateManager');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const sendPasswordResetEmail = async (to, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: 'Reset Your Krealgram Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <img src="https://krealgram.com/logo.png" alt="Krealgram Logo" style="max-width: 150px; margin-bottom: 20px;" />
        <h2 style="color: #262626;">Reset Your Password</h2>
        <p>You recently requested to reset your password for your Krealgram account. Click the button below to reset it.</p>
        <a href="${resetUrl}" style="display: inline-block; background-color: #0095f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">Reset Password</a>
        <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
        <p>This password reset link is only valid for 15 minutes.</p>
        <hr style="border: none; border-top: 1px solid #dbdbdb; margin: 20px 0;">
        <p style="color: #8e8e8e; font-size: 12px;">This is an automated email, please do not reply.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send password reset email');
  }
};

const sendEmailVerificationEmail = async (to, verificationToken, username) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: 'Verify Your Krealgram Account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <img src="https://krealgram.com/logo.png" alt="Krealgram Logo" style="max-width: 150px; margin-bottom: 20px;" />
        <h2 style="color: #262626;">Welcome to Krealgram, ${username}!</h2>
        <p>Thank you for creating your Krealgram account. To complete your registration and start using all features, please verify your email address.</p>
        <a href="${verificationUrl}" style="display: inline-block; background-color: #0095f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">Verify Email Address</a>
        <p>If you did not create a Krealgram account, please ignore this email.</p>
        <p>This verification link is valid for 24 hours.</p>
        <hr style="border: none; border-top: 1px solid #dbdbdb; margin: 20px 0;">
        <p style="color: #8e8e8e; font-size: 12px;">This is an automated email, please do not reply.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send email verification email');
  }
};

const sendNewMessageNotification = async (recipientEmail, message, sender, recipient) => {
  try {
    // Подготавливаем данные для шаблона
    const templateData = emailTemplateManager.prepareMessageNotificationData(message, sender, recipient);
    
    // Рендерим HTML шаблон
    const htmlContent = await emailTemplateManager.renderTemplate('new-message-notification', templateData);
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: `New message from ${sender.username} on Krealgram`,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending new message notification email:', error);
    throw new Error('Failed to send new message notification email');
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
  sendNewMessageNotification
}; 