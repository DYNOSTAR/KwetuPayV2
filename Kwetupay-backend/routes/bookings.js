const express = require('express');
const { query, getClient } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { emitToUser } = require('../services/socketService');

const router = express.Router();

// Input validation middleware
const validateBookingId = (req, res, next) => {
  const { bookingId } = req.params;
  if (bookingId && isNaN(parseInt(bookingId))) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid booking ID. Must be a valid number.'
    });
  }
  next();
};

// Debug middleware
router.use((req, res, next) => {
  console.log('📨 Booking route hit:', req.method, req.originalUrl);
  next();
});

// Create booking request (Tenants only)
router.post('/', authenticateToken, authorizeRoles('tenant'), async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    const { unit_id, property_id, start_date, end_date, total_rent, special_terms } = req.body;

    // Validate property exists
    const propertyResult = await client.query(
      'SELECT landlord_id, rent_amount, is_available FROM properties WHERE property_id = $1',
      [property_id]
    );

    if (propertyResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        message: 'Property not found'
      });
    }

    const property = propertyResult.rows[0];

    if (!property.is_available) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        status: 'error',
        message: 'Property is not available for booking'
      });
    }

    const landlord_id = property.landlord_id;
    const calculatedRent = total_rent || property.rent_amount;

    // Create booking
    const bookingResult = await client.query(
      `INSERT INTO bookings (
        property_id, unit_id, tenant_id, landlord_id, start_date, end_date,
        total_rent, booking_status, special_terms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        property_id,
        unit_id || null,
        req.user.user_id,
        landlord_id,
        start_date,
        end_date,
        calculatedRent,
        'pending',
        special_terms || null
      ]
    );

    await client.query('COMMIT');

    const booking = bookingResult.rows[0];

    // Notify landlord
    emitToUser(landlord_id, 'booking:new', {
      booking: {
        ...booking,
        tenant_name: `${req.user.first_name} ${req.user.last_name}`,
        tenant_email: req.user.email,
        tenant_phone: req.user.phone_number
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Booking request submitted successfully',
      data: { booking }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Booking creation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error creating booking'
    });
  } finally {
    client.release();
  }
});

// Get landlord's ALL bookings
router.get('/landlord/bookings', authenticateToken, authorizeRoles('landlord'), async (req, res) => {
  try {
    console.log('🏠 Fetching ALL landlord bookings for user:', req.user.user_id);
    
    const result = await query(
      `SELECT 
        b.booking_id, b.property_id, b.tenant_id, b.start_date, b.end_date,
        b.total_rent, b.booking_status, b.special_terms, b.created_at,
        p.title as property_title, p.address, p.city, p.property_type,
        u.first_name as tenant_name, u.last_name as tenant_last_name,
        u.email as tenant_email, u.phone_number as tenant_phone,
        pu.unit_number, pu.unit_type
       FROM bookings b
       JOIN properties p ON b.property_id = p.property_id
       JOIN users u ON b.tenant_id = u.user_id
       LEFT JOIN property_units pu ON b.unit_id = pu.unit_id
       WHERE p.landlord_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.user_id]
    );

    res.json({
      status: 'success',
      data: {
        bookings: result.rows,
        count: result.rows.length
      }
    });

  } catch (error) {
    console.error('Landlord bookings fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error fetching bookings'
    });
  }
});

// Get landlord pending requests
router.get('/landlord-requests', authenticateToken, authorizeRoles('landlord'), async (req, res) => {
  try {
    console.log('📋 Fetching landlord requests for user:', req.user.user_id);
    
    const result = await query(
      `SELECT 
        b.booking_id, b.property_id, b.tenant_id, b.start_date, b.end_date,
        b.total_rent, b.booking_status, b.special_terms, b.created_at,
        p.title as property_title, p.address, p.city, p.property_type,
        u.first_name as tenant_name, u.last_name as tenant_last_name,
        u.email as tenant_email, u.phone_number as tenant_phone,
        pu.unit_number, pu.unit_type
       FROM bookings b
       JOIN properties p ON b.property_id = p.property_id
       JOIN users u ON b.tenant_id = u.user_id
       LEFT JOIN property_units pu ON b.unit_id = pu.unit_id
       WHERE p.landlord_id = $1 AND b.booking_status = 'pending'
       ORDER BY b.created_at DESC`,
      [req.user.user_id]
    );

    res.json({
      status: 'success',
      data: {
        bookings: result.rows,
        count: result.rows.length
      }
    });

  } catch (error) {
    console.error('Landlord requests fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error fetching landlord requests'
    });
  }
});

// Get tenant's bookings
router.get('/my-bookings', authenticateToken, authorizeRoles('tenant'), async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        b.booking_id, b.property_id, b.unit_id, b.start_date, b.end_date,
        b.total_rent, b.booking_status, b.special_terms, b.created_at,
        p.title as property_title, p.address, p.city, p.property_type,
        p.images,
        pu.unit_number, pu.unit_type,
        ld.first_name as landlord_name, ld.phone_number as landlord_phone
       FROM bookings b
       JOIN properties p ON b.property_id = p.property_id
       JOIN users ld ON p.landlord_id = ld.user_id
       LEFT JOIN property_units pu ON b.unit_id = pu.unit_id
       WHERE b.tenant_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.user_id]
    );

    res.json({
      status: 'success',
      data: {
        bookings: result.rows,
        count: result.rows.length
      }
    });

  } catch (error) {
    console.error('My bookings fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error fetching my bookings'
    });
  }
});

// Update booking status (Landlords only)
router.put('/:bookingId/status', authenticateToken, authorizeRoles('landlord'), validateBookingId, async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    const { bookingId } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        status: 'error',
        message: 'Invalid status. Must be: approved, rejected, or cancelled'
      });
    }

    // Verify booking belongs to landlord
    const bookingCheck = await client.query(
      `SELECT b.booking_id, b.tenant_id, b.property_id, b.start_date, b.end_date, b.total_rent
       FROM bookings b
       WHERE b.booking_id = $1 AND b.landlord_id = $2`,
      [parseInt(bookingId), req.user.user_id]
    );

    if (bookingCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found or access denied'
      });
    }

    const booking = bookingCheck.rows[0];

    // Update booking status
    const bookingResult = await client.query(
      'UPDATE bookings SET booking_status = $1, updated_at = NOW() WHERE booking_id = $2 RETURNING *',
      [status, parseInt(bookingId)]
    );

    // If approved, create lease
    if (status === 'approved') {
      const leaseResult = await client.query(
        `INSERT INTO leases (
          booking_id, lease_number, start_date, end_date, monthly_rent, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          parseInt(bookingId),
          `LEASE-${Date.now()}`,
          booking.start_date,
          booking.end_date,
          booking.total_rent,
          'active'
        ]
      );

      await client.query('COMMIT');

      // Notify tenant
      emitToUser(booking.tenant_id, 'booking:updated', {
        booking_id: booking.booking_id,
        status: status,
        lease_id: leaseResult.rows[0].lease_id,
        message: 'Your booking has been approved and lease created'
      });

      res.json({
        status: 'success',
        message: 'Booking approved and lease created successfully',
        data: {
          booking: bookingResult.rows[0],
          lease: leaseResult.rows[0]
        }
      });
    } else {
      await client.query('COMMIT');

      // Notify tenant
      emitToUser(booking.tenant_id, 'booking:updated', {
        booking_id: booking.booking_id,
        status: status,
        message: `Your booking request has been ${status}`
      });

      res.json({
        status: 'success',
        message: `Booking ${status} successfully`,
        data: {
          booking: bookingResult.rows[0]
        }
      });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Booking status update error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error updating booking status'
    });
  } finally {
    client.release();
  }
});

// Cancel booking (Tenants only)
router.put('/:bookingId/cancel', authenticateToken, authorizeRoles('tenant'), validateBookingId, async (req, res) => {
  try {
    const { bookingId } = req.params;

    // Verify booking belongs to tenant
    const bookingCheck = await query(
      'SELECT booking_id, booking_status FROM bookings WHERE booking_id = $1 AND tenant_id = $2',
      [parseInt(bookingId), req.user.user_id]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found or access denied'
      });
    }

    if (bookingCheck.rows[0].booking_status !== 'pending') {
      return res.status(400).json({
        status: 'error',
        message: 'Only pending bookings can be cancelled'
      });
    }

    const result = await query(
      'UPDATE bookings SET booking_status = $1, updated_at = NOW() WHERE booking_id = $2 RETURNING *',
      ['cancelled', parseInt(bookingId)]
    );

    res.json({
      status: 'success',
      message: 'Booking cancelled successfully',
      data: { booking: result.rows[0] }
    });

  } catch (error) {
    console.error('Booking cancellation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get booking by ID
router.get('/:bookingId', authenticateToken, validateBookingId, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const result = await query(
      `SELECT 
        b.*,
        p.title as property_title, p.address, p.city, p.property_type,
        u.first_name as tenant_name, u.last_name as tenant_last_name,
        u.email as tenant_email, u.phone_number as tenant_phone,
        pu.unit_number, pu.unit_type,
        ld.first_name as landlord_name, ld.phone_number as landlord_phone
       FROM bookings b
       JOIN properties p ON b.property_id = p.property_id
       JOIN users u ON b.tenant_id = u.user_id
       JOIN users ld ON b.landlord_id = ld.user_id
       LEFT JOIN property_units pu ON b.unit_id = pu.unit_id
       WHERE b.booking_id = $1 AND (b.tenant_id = $2 OR b.landlord_id = $2)`,
      [parseInt(bookingId), req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    res.json({
      status: 'success',
      data: { booking: result.rows[0] }
    });

  } catch (error) {
    console.error('Booking fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error fetching booking'
    });
  }
});

module.exports = router;