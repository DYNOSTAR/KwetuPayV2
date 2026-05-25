const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Apply authentication and admin role check to ALL routes
router.use(authenticateToken);
router.use(authorizeRoles('admin', 'super_admin'));

// ==================== DASHBOARD STATS ====================
router.get('/dashboard/stats', async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM properties) as "totalProperties",
        (SELECT COUNT(*) FROM users) as "totalUsers",
        (SELECT COUNT(*) FROM users WHERE role = 'landlord') as "totalLandlords",
        (SELECT COUNT(*) FROM users WHERE role = 'tenant') as "totalTenants",
        (SELECT COUNT(*) FROM bookings) as "totalBookings",
        (SELECT COUNT(*) FROM bookings WHERE booking_status = 'pending') as "pendingBookings",
        (SELECT COUNT(*) FROM bookings WHERE booking_status = 'approved') as "activeBookings",
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_status = 'completed') as "totalRevenue"
    `);

    const recentProperties = await query(`
      SELECT p.property_id, p.title, p.city, p.created_at,
             u.first_name || ' ' || u.last_name as landlord_name
      FROM properties p
      JOIN users u ON p.landlord_id = u.user_id
      ORDER BY p.created_at DESC
      LIMIT 5
    `);

    const recentBookings = await query(`
      SELECT b.booking_id, p.title as property_title, 
             t.first_name || ' ' || t.last_name as tenant_name, 
             b.booking_status, b.created_at
      FROM bookings b
      JOIN properties p ON b.property_id = p.property_id
      JOIN users t ON b.tenant_id = t.user_id
      ORDER BY b.created_at DESC
      LIMIT 5
    `);

    res.json({
      status: 'success',
      data: {
        stats: stats.rows[0],
        recentActivities: {
          properties: recentProperties.rows,
          bookings: recentBookings.rows
        }
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch dashboard data' });
  }
});

// ==================== USER MANAGEMENT ====================
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (role) {
      paramCount++;
      whereClause += ` AND u.role = $${paramCount}`;
      params.push(role);
    }

    if (search) {
      paramCount++;
      whereClause += ` AND (u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM users u ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated users
    paramCount++;
    params.push(limit);
    paramCount++;
    params.push(offset);

    const usersResult = await query(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, u.phone_number, 
              u.role, u.is_active, u.is_verified, u.created_at
       FROM users u ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
      params
    );

    // Transform to match frontend expectations
    const users = usersResult.rows.map(u => ({
      _id: u.user_id,
      name: `${u.first_name} ${u.last_name}`,
      email: u.email,
      phone: u.phone_number,
      role: u.role,
      isActive: u.is_active,
      isVerified: u.is_verified,
      createdAt: u.created_at
    }));

    res.json({
      status: 'success',
      data: {
        users,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch users' });
  }
});

// Update user status
router.patch('/users/:userId/status', async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    const result = await query(
      'UPDATE users SET is_active = $1, updated_at = NOW() WHERE user_id = $2 RETURNING user_id, is_active',
      [isActive, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    res.json({
      status: 'success',
      data: { user: result.rows[0] }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update user' });
  }
});

// ==================== PROPERTY MANAGEMENT ====================
router.get('/properties', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      whereClause += ` AND p.is_available = $${paramCount}`;
      params.push(status === 'available');
    }

    if (search) {
      paramCount++;
      whereClause += ` AND (p.title ILIKE $${paramCount} OR p.address ILIKE $${paramCount} OR p.city ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM properties p ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    paramCount++;
    params.push(limit);
    paramCount++;
    params.push(offset);

    const propertiesResult = await query(
      `SELECT p.property_id, p.title, p.description, p.property_type,
              p.rent_amount, p.bedrooms, p.bathrooms, p.area_sqft,
              p.address, p.city, p.neighborhood, p.is_available,
              p.images, p.created_at,
              u.first_name || ' ' || u.last_name as landlord_name,
              u.email as landlord_email, u.user_id as landlord_id
       FROM properties p
       JOIN users u ON p.landlord_id = u.user_id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
      params
    );

    const properties = propertiesResult.rows.map(p => ({
      _id: p.property_id,
      title: p.title,
      description: p.description,
      property_type: p.property_type,
      rent_amount: p.rent_amount,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      area_sqft: p.area_sqft,
      address: p.address,
      city: p.city,
      neighborhood: p.neighborhood,
      status: p.is_available ? 'available' : 'occupied',
      images: p.images || [],
      createdAt: p.created_at,
      landlord: {
        _id: p.landlord_id,
        name: p.landlord_name,
        email: p.landlord_email
      }
    }));

    res.json({
      status: 'success',
      data: {
        properties,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Admin properties error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch properties' });
  }
});

// Update property status
router.patch('/properties/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const isAvailable = status === 'available';

    const result = await query(
      'UPDATE properties SET is_available = $1, updated_at = NOW() WHERE property_id = $2 RETURNING property_id, is_available',
      [isAvailable, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Property not found' });
    }

    res.json({
      status: 'success',
      data: { property: { _id: result.rows[0].property_id, status: result.rows[0].is_available ? 'available' : 'occupied' } }
    });
  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update property' });
  }
});

// Delete property
router.delete('/properties/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await query('DELETE FROM property_units WHERE property_id = $1', [id]);
    await query('DELETE FROM properties WHERE property_id = $1', [id]);

    res.json({ status: 'success', message: 'Property deleted successfully', deletedId: id });
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete property' });
  }
});

// ==================== BOOKING MANAGEMENT ====================
router.get('/bookings', async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      whereClause = `WHERE b.booking_status = $${paramCount}`;
      params.push(status);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM bookings b ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    paramCount++;
    params.push(limit);
    paramCount++;
    params.push(offset);

    const bookingsResult = await query(
      `SELECT b.booking_id, b.start_date, b.end_date, b.total_rent, b.booking_status, b.created_at,
              p.title as property_title, p.address, p.rent_amount,
              t.first_name || ' ' || t.last_name as tenant_name, t.email as tenant_email, t.phone_number as tenant_phone,
              l.first_name || ' ' || l.last_name as landlord_name
       FROM bookings b
       JOIN properties p ON b.property_id = p.property_id
       JOIN users t ON b.tenant_id = t.user_id
       JOIN users l ON b.landlord_id = l.user_id
       ${whereClause}
       ORDER BY b.created_at DESC
       LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
      params
    );

    const bookings = bookingsResult.rows.map(b => ({
      _id: b.booking_id,
      property: {
        _id: b.booking_id,
        title: b.property_title,
        address: b.address,
        rent_amount: b.rent_amount
      },
      tenant: {
        name: b.tenant_name,
        email: b.tenant_email,
        phone: b.tenant_phone
      },
      landlord: { name: b.landlord_name },
      moveInDate: b.start_date,
      moveOutDate: b.end_date,
      totalAmount: b.total_rent * 12,
      status: b.booking_status,
      paymentStatus: b.booking_status === 'approved' ? 'paid' : 'pending',
      createdAt: b.created_at
    }));

    res.json({
      status: 'success',
      data: {
        bookings,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Admin bookings error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch bookings' });
  }
});

// Update booking status
router.patch('/bookings/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await query(
      'UPDATE bookings SET booking_status = $1, updated_at = NOW() WHERE booking_id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Booking not found' });
    }

    res.json({
      status: 'success',
      data: { booking: { _id: result.rows[0].booking_id, status: result.rows[0].booking_status } }
    });
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update booking' });
  }
});

module.exports = router;