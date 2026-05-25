const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendVerificationEmail = async (toEmail, firstName, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'KwetuPay <noreply@kwetupay.com>',
    to: toEmail,
    subject: 'Verify your KwetuPay email address',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f8fafc;padding:32px;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#10b981;margin:0;font-size:28px;">KwetuPay</h1>
          <p style="color:#6b7280;margin:8px 0 0;">Property Management Platform</p>
        </div>
        <div style="background:white;border-radius:12px;padding:28px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <h2 style="color:#1f2937;margin:0 0 12px;">Hi ${firstName}!</h2>
          <p style="color:#374151;line-height:1.6;">Thanks for signing up. Please verify your email address to activate your account.</p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${verifyUrl}" style="background:#10b981;color:white;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px;display:inline-block;">
              Verify Email Address
            </a>
          </div>
          <p style="color:#6b7280;font-size:13px;">Or copy this link: <a href="${verifyUrl}" style="color:#10b981;">${verifyUrl}</a></p>
          <p style="color:#9ca3af;font-size:12px;margin-top:20px;">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>
        </div>
      </div>
    `,
  });
};

const sendPasswordResetEmail = async (toEmail, firstName, token) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'KwetuPay <noreply@kwetupay.com>',
    to: toEmail,
    subject: 'Reset your KwetuPay password',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f8fafc;padding:32px;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#10b981;margin:0;font-size:28px;">KwetuPay</h1>
        </div>
        <div style="background:white;border-radius:12px;padding:28px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <h2 style="color:#1f2937;margin:0 0 12px;">Hi ${firstName},</h2>
          <p style="color:#374151;line-height:1.6;">We received a request to reset your password. Click the button below — this link expires in 1 hour.</p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${resetUrl}" style="background:#ef4444;color:white;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px;display:inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color:#9ca3af;font-size:12px;margin-top:20px;">If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
      </div>
    `,
  });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
