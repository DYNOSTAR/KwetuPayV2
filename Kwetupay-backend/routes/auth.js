const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validateUserRegistration } = require('../middleware/validation');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const makeJwt = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '30d' });

const safeUser = (u) => {
  const { password_hash, verification_token, reset_token, ...safe } = u;
  return safe;
};

// ── Register ────────────────────────────────────────────────────────────────
router.post('/register', validateUserRegistration, async (req, res) => {
  try {
    const { first_name, last_name, email, phone_number, password, role } = req.body;

    const existing = await query(
      'SELECT user_id FROM users WHERE email = $1 OR phone_number = $2',
      [email, phone_number]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ status: 'error', message: 'Email or phone number already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

    const result = await query(
      `INSERT INTO users (first_name, last_name, email, phone_number, password_hash, role,
         email_verified, verification_token, verification_token_expires)
       VALUES ($1,$2,$3,$4,$5,$6,false,$7,$8)
       RETURNING *`,
      [first_name, last_name, email, phone_number, passwordHash, role, verificationToken, tokenExpires]
    );

    const user = result.rows[0];

    // Send verification email (non-blocking)
    sendVerificationEmail(email, first_name, verificationToken).catch(err =>
      console.warn('⚠️ Verification email failed:', err.message)
    );

    const token = makeJwt(user.user_id);
    res.status(201).json({
      status: 'success',
      message: 'Account created! Check your email to verify your address.',
      data: { user: safeUser(user), token }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error during registration' });
  }
});

// ── Login ───────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ status: 'error', message: 'Email and password are required' });
    }

    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Google-only accounts have no password hash
    if (!user.password_hash) {
      return res.status(401).json({ status: 'error', message: 'This account uses Google Sign-In. Please use the Google button.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    const token = makeJwt(user.user_id);
    res.json({ status: 'success', message: 'Login successful', data: { user: safeUser(user), token } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error during login' });
  }
});

// ── Google OAuth ─────────────────────────────────────────────────────────────
router.post('/google', async (req, res) => {
  try {
    const { credential, role } = req.body;

    if (!credential) {
      return res.status(400).json({ status: 'error', message: 'Google credential is required' });
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, given_name: firstName, family_name: lastName, email_verified } = payload;

    // Check if user exists
    let userRow = await query('SELECT * FROM users WHERE email = $1 OR google_id = $2', [email, googleId]);

    if (userRow.rows.length > 0) {
      // Existing user — update google_id if missing, then log in
      const user = userRow.rows[0];
      if (!user.google_id) {
        await query('UPDATE users SET google_id = $1, email_verified = true WHERE user_id = $2', [googleId, user.user_id]);
      }
      const token = makeJwt(user.user_id);
      return res.json({ status: 'success', message: 'Login successful', data: { user: safeUser({ ...user, google_id: googleId }), token } });
    }

    // New user — role is required
    if (!role || !['tenant', 'landlord'].includes(role)) {
      return res.status(200).json({
        status: 'needs_role',
        message: 'Please select your role to complete sign-up',
        data: { google_email: email, google_name: `${firstName} ${lastName}` }
      });
    }

    // Create new user
    const phone_number = `G-${googleId.slice(0, 10)}`; // placeholder — user can update in Settings
    const result = await query(
      `INSERT INTO users (first_name, last_name, email, phone_number, role, google_id, email_verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [firstName || 'User', lastName || '', email, phone_number, role, googleId, email_verified ?? true]
    );

    const newUser = result.rows[0];
    const token = makeJwt(newUser.user_id);
    res.status(201).json({ status: 'success', message: 'Account created via Google', data: { user: safeUser(newUser), token } });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ status: 'error', message: 'Google authentication failed' });
  }
});

// ── Verify email ─────────────────────────────────────────────────────────────
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ status: 'error', message: 'Token is required' });

    const result = await query(
      `SELECT user_id, verification_token_expires FROM users
       WHERE verification_token = $1 AND email_verified = false`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid or already used verification link' });
    }

    const user = result.rows[0];
    if (new Date(user.verification_token_expires) < new Date()) {
      return res.status(400).json({ status: 'error', message: 'Verification link has expired. Please request a new one.' });
    }

    await query(
      `UPDATE users SET email_verified = true, verification_token = NULL, verification_token_expires = NULL
       WHERE user_id = $1`,
      [user.user_id]
    );

    res.json({ status: 'success', message: 'Email verified successfully! You can now log in.' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ status: 'error', message: 'Email verification failed' });
  }
});

// ── Resend verification email ─────────────────────────────────────────────────
router.post('/resend-verification', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM users WHERE user_id = $1', [req.user.user_id]);
    const user = result.rows[0];

    if (!user || user.email_verified) {
      return res.status(400).json({ status: 'error', message: 'Email is already verified' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await query(
      'UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE user_id = $3',
      [token, expires, user.user_id]
    );

    await sendVerificationEmail(user.email, user.first_name, token);
    res.json({ status: 'success', message: 'Verification email sent' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to resend verification email' });
  }
});

// ── Change password (authenticated) ──────────────────────────────────────────
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ status: 'error', message: 'New password must be at least 6 characters' });
    }

    const result = await query('SELECT password_hash FROM users WHERE user_id = $1', [req.user.user_id]);
    const user = result.rows[0];

    // For Google-only accounts, current_password is not required
    if (user.password_hash) {
      if (!current_password) {
        return res.status(400).json({ status: 'error', message: 'Current password is required' });
      }
      const valid = await bcrypt.compare(current_password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ status: 'error', message: 'Current password is incorrect' });
      }
    }

    const hash = await bcrypt.hash(new_password, 12);
    await query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [hash, req.user.user_id]);

    res.json({ status: 'success', message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to change password' });
  }
});

// ── Forgot password ───────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ status: 'error', message: 'Email is required' });

    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      return res.json({ status: 'success', message: 'If that email exists, a reset link has been sent' });
    }

    const user = result.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE user_id = $3',
      [token, expires, user.user_id]
    );

    await sendPasswordResetEmail(user.email, user.first_name, token);
    res.json({ status: 'success', message: 'If that email exists, a reset link has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to process request' });
  }
});

// ── Reset password (via email link) ──────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) {
      return res.status(400).json({ status: 'error', message: 'Token and new password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters' });
    }

    const result = await query(
      'SELECT user_id, reset_token_expires FROM users WHERE reset_token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid or expired reset link' });
    }

    const user = result.rows[0];
    if (new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({ status: 'error', message: 'Reset link has expired. Please request a new one.' });
    }

    const hash = await bcrypt.hash(new_password, 12);
    await query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE user_id = $2',
      [hash, user.user_id]
    );

    res.json({ status: 'success', message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to reset password' });
  }
});

// ── Create admin (secret-protected) ──────────────────────────────────────────
router.post('/create-admin', async (req, res) => {
  try {
    const { first_name, last_name, email, phone_number, password, admin_secret, role = 'admin' } = req.body;

    if (!process.env.ADMIN_SECRET || admin_secret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ status: 'error', message: 'Invalid admin secret' });
    }
    if (!['admin', 'super_admin'].includes(role)) {
      return res.status(400).json({ status: 'error', message: 'Role must be admin or super_admin' });
    }
    if (!first_name || !last_name || !email || !phone_number || !password) {
      return res.status(400).json({ status: 'error', message: 'All fields are required' });
    }

    const existing = await query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ status: 'error', message: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (first_name, last_name, email, phone_number, password_hash, role, email_verified)
       VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING user_id, first_name, last_name, email, phone_number, role, created_at`,
      [first_name, last_name, email, phone_number, hash, role]
    );

    res.status(201).json({
      status: 'success',
      message: `${role} account created. They can log in at /login.`,
      data: { user: result.rows[0] }
    });
  } catch (error) {
    console.error('Admin creation error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

module.exports = router;
