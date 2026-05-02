const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Apply authentication to all admin routes
router.use(authenticateToken);
router.use(authorizeRoles('admin', 'super_admin'));

// Admin Dashboard Stats
router.get('/dashboard/stats', async (req, res) => {
  try {
    const statsResult = await query(`
      SELECT 
        (SELECT COUNT(*) FROM properties) as total_properties,
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE role = 'landlord') as total_landlords,
        (SELECT COUNT(*) FROM users WHERE role = 'tenant') as total_tenants,
        (SELECT COUNT(*) FROM bookings) as total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE booking_status = 'pending') as pending_bookings,
        (SELECT COUNT(*) FROM bookings WHERE booking_status = 'approved') as active_bookings,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'completed') as total_revenue
    `);

    const recentProperties = await query(`
      SELECT p.property_id, p.title, p.created_at, u.first_name as landlord_name
      FROM properties p
      JOIN users u ON p.landlord_id = u.user_id
      ORDER BY p.created_at DESC
      LIMIT 5
    `);

    const recentBookings = await query(`
      SELECT b.booking_id, p.title as property_title, 
             t.first_name as tenant_name, b.booking_status, b.created_at
      FROM bookings b
      JOIN properties p ON b.property_id = p.property_id
      JOIN users t ON b.tenant_id = t.user_id
      ORDER BY b.created_at DESC
      LIMIT 5
    `);

    res.json({
      status: 'success',
      data: {
        stats: statsResult.rows[0],
        recentActivities: {
          properties: recentProperties.rows,
          bookings: recentBookings.rows
        }
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch dashboard data'
    });
  }
});

// User Management
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;
    const offset = (page - 1) * limit;

    let queryText = `
      SELECT user_id, first_name, last_name, email, phone_number, role, 
             is_active, is_verified, created_at
      FROM users
      WHERE 1=1
    `;
    const queryParams = [];
    let paramCount = 0;

    if (role) {
      paramCount++;
      queryText += ` AND role = $${paramCount}`;
      queryParams.push(role);
    }

    if (search) {
      paramCount++;
      queryText += ` AND (first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    // Get total count
    const countResult = await query(
      queryText.replace('SELECT user_id, first_name, last_name, email, phone_number, role, is_active, is_verified, created_at', 'SELECT COUNT(*)'),
      queryParams
    );
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    paramCount++;
    queryText += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
    queryParams.push(limit);
    paramCount++;
    queryText += ` OFFSET $${paramCount}`;
    queryParams.push(offset);

    const result = await query(queryText, queryParams);

    res.json({
      status: 'success',
      data: {
        users: result.rows,
        pagination: {
          total,
          totalPages: Math.ceil(total / limit),
          currentPage: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch users'
    });
  }
});

// Update user status
router.patch('/users/:userId/status', async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_active } = req.body;

    const result = await query(
      'UPDATE users SET is_active = $1, updated_at = NOW() WHERE user_id = $2 RETURNING user_id, is_active',
      [is_active, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.json({
      status: 'success',
      data: { user: result.rows[0] }
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update user status'
    });
  }
});

module.exports = router;