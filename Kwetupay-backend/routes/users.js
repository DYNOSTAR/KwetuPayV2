const express = require('express');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Test route
router.get('/test', (req, res) => {
  res.json({
    status: 'success',
    message: 'Users route is working!'
  });
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userResult = await query(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, u.phone_number, u.role, 
              u.profile_image_url, u.is_verified, u.created_at,
              up.date_of_birth, up.emergency_contact_name, up.emergency_contact_phone, up.occupation
       FROM users u
       LEFT JOIN user_profiles up ON u.user_id = up.user_id
       WHERE u.user_id = $1`,
      [req.user.user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.json({
      status: 'success',
      data: {
        user: userResult.rows[0]
      }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      phone_number,
      date_of_birth,
      emergency_contact_name,
      emergency_contact_phone,
      occupation
    } = req.body;

    // Update users table
    await query(
      `UPDATE users 
       SET first_name = $1, last_name = $2, phone_number = $3, updated_at = NOW() 
       WHERE user_id = $4`,
      [first_name, last_name, phone_number, req.user.user_id]
    );

    // Check if profile exists
    const profileResult = await query(
      'SELECT profile_id FROM user_profiles WHERE user_id = $1',
      [req.user.user_id]
    );

    if (profileResult.rows.length > 0) {
      await query(
        `UPDATE user_profiles
         SET date_of_birth = $1,
             emergency_contact_name = $2,
             emergency_contact_phone = $3,
             occupation = $4
         WHERE user_id = $5`,
        [
          date_of_birth,
          emergency_contact_name,
          emergency_contact_phone,
          occupation,
          req.user.user_id
        ]
      );
    } else {
      await query(
        `INSERT INTO user_profiles
         (user_id, date_of_birth, emergency_contact_name, emergency_contact_phone, occupation)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.user_id,
          date_of_birth,
          emergency_contact_name,
          emergency_contact_phone,
          occupation
        ]
      );
    }

    res.json({
      status: 'success',
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

module.exports = router;