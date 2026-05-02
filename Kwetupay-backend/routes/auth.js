const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { validateUserRegistration } = require('../middleware/validation');

const router = express.Router();

// User Registration
router.post('/register', validateUserRegistration, async (req, res) => {
  try {
    const { first_name, last_name, email, phone_number, password, role } = req.body;

    // Check if user already exists
    const existingUser = await query(
      'SELECT user_id FROM users WHERE email = $1 OR phone_number = $2',
      [email, phone_number]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'User with this email or phone number already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await query(
      `INSERT INTO users (first_name, last_name, email, phone_number, password_hash, role) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING user_id, first_name, last_name, email, phone_number, role, created_at`,
      [first_name, last_name, email, phone_number, passwordHash, role]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: result.rows[0].user_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        user: result.rows[0],
        token
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error during registration'
    });
  }
});

// User Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required'
      });
    }

    // Find user
    const result = await query(
      'SELECT user_id, first_name, last_name, email, phone_number, role, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.user_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Remove password hash from response
    delete user.password_hash;

    res.json({
      status: 'success',
      message: 'Login successful',
      data: {
        user,
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error during login'
    });
  }
});

module.exports = router;