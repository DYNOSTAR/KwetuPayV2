const { query, getClient } = require('../config/database');

// Create a new booking for a SPECIFIC UNIT
exports.createBooking = async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const { unit_id, start_date, end_date, total_rent, special_terms } = req.body;
    const tenant_id = req.user.user_id;

    // Validate required fields
    if (!unit_id || !start_date || !end_date || !total_rent) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        status: 'error',
        message: 'Unit ID, start date, end date, and total rent are required'
      });
    }

    // Check if unit exists, is available, and get property/landlord info
    const unitQuery = `
      SELECT 
        pu.*, 
        p.property_id, p.title as property_title, p.address, p.city,
        u.user_id as landlord_id, u.email as landlord_email, u.phone_number as landlord_phone
      FROM property_units pu
      JOIN properties p ON pu.property_id = p.property_id
      JOIN users u ON p.landlord_id = u.user_id 
      WHERE pu.unit_id = $1 AND pu.status = 'available' AND pu.is_active = true
    `;
    
    const unitResult = await client.query(unitQuery, [unit_id]);
    
    if (unitResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        message: 'Unit not found or not available for booking'
      });
    }

    const unit = unitResult.rows[0];

    // Check if tenant already has a pending booking for this unit
    const existingBookingResult = await client.query(
      `SELECT * FROM bookings 
       WHERE unit_id = $1 AND tenant_id = $2 AND booking_status IN ('pending', 'approved')`,
      [unit_id, tenant_id]
    );
    
    if (existingBookingResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        status: 'error',
        message: 'You already have an active or pending booking for this unit'
      });
    }

    // Check if unit is already booked by someone else
    const unitBookedResult = await client.query(
      `SELECT * FROM bookings 
       WHERE unit_id = $1 AND booking_status IN ('pending', 'approved')`,
      [unit_id]
    );
    
    if (unitBookedResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        status: 'error',
        message: 'This unit is already booked by another tenant'
      });
    }

    // Create booking
    const insertResult = await client.query(
      `INSERT INTO bookings (property_id, unit_id, tenant_id, landlord_id, start_date, end_date, total_rent, special_terms, booking_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING *`,
      [unit.property_id, unit_id, tenant_id, unit.landlord_id, start_date, end_date, total_rent, special_terms || null]
    );

    const booking = insertResult.rows[0];

    // Update unit status to pending
    await client.query(
      'UPDATE property_units SET status = $1 WHERE unit_id = $2',
      ['pending', unit_id]
    );

    // Create notification for landlord
    await client.query(
      `INSERT INTO notifications (user_id, title, message, notification_type, related_entity_type, related_entity_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        unit.landlord_id,
        'New Booking Request',
        `New booking request for Unit ${unit.unit_number} at ${unit.property_title}`,
        'booking',
        'booking',
        booking.booking_id
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      status: 'success',
      message: 'Booking request submitted successfully! The landlord has been notified.',
      data: { booking }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Booking creation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  } finally {
    client.release();
  }
};

// Get bookings for tenant
exports.getMyBookings = async (req, res) => {
  try {
    const tenant_id = req.user.user_id;
    
    const result = await query(
      `SELECT 
        b.*, 
        p.title, p.city, p.neighborhood, p.images, 
        u.first_name as landlord_name,
        pu.unit_number, pu.unit_type, pu.rent_amount as unit_rent
      FROM bookings b
      JOIN properties p ON b.property_id = p.property_id
      JOIN users u ON b.landlord_id = u.user_id
      LEFT JOIN property_units pu ON b.unit_id = pu.unit_id
      WHERE b.tenant_id = $1
      ORDER BY b.created_at DESC`,
      [tenant_id]
    );
    
    res.json({
      status: 'success',
      data: { bookings: result.rows }
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get bookings for landlord's properties
exports.getLandlordBookings = async (req, res) => {
  try {
    const landlord_id = req.user.user_id;
    
    const result = await query(
      `SELECT 
        b.*, 
        p.title, p.city, p.neighborhood, p.images, 
        u.first_name as tenant_name, u.phone_number as tenant_phone,
        pu.unit_number, pu.unit_type
      FROM bookings b
      JOIN properties p ON b.property_id = p.property_id
      JOIN users u ON b.tenant_id = u.user_id
      LEFT JOIN property_units pu ON b.unit_id = pu.unit_id
      WHERE b.landlord_id = $1
      ORDER BY b.created_at DESC`,
      [landlord_id]
    );
    
    res.json({
      status: 'success',
      data: { bookings: result.rows }
    });
  } catch (error) {
    console.error('Get landlord bookings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Update booking status
exports.updateBookingStatus = async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { status } = req.body;
    const user_id = req.user.user_id;

    // Validate status
    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        status: 'error',
        message: 'Invalid status'
      });
    }

    // Check if booking exists
    const bookingResult = await client.query(
      `SELECT b.*, p.landlord_id, p.title
       FROM bookings b 
       JOIN properties p ON b.property_id = p.property_id 
       WHERE b.booking_id = $1`,
      [id]
    );
    
    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    const booking = bookingResult.rows[0];

    // Check permissions
    if (status === 'cancelled' && booking.tenant_id !== user_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        status: 'error',
        message: 'Only the tenant can cancel this booking'
      });
    }

    if (['approved', 'rejected'].includes(status) && booking.landlord_id !== user_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        status: 'error',
        message: 'Only the landlord can approve or reject bookings'
      });
    }

    // Update booking status
    await client.query(
      'UPDATE bookings SET booking_status = $1, updated_at = NOW() WHERE booking_id = $2',
      [status, id]
    );

    // Update unit status
    let unitStatus = 'available';
    if (status === 'approved') unitStatus = 'occupied';
    else if (status === 'rejected' || status === 'cancelled') unitStatus = 'available';

    if (booking.unit_id) {
      await client.query(
        'UPDATE property_units SET status = $1 WHERE unit_id = $2',
        [unitStatus, booking.unit_id]
      );
    }

    // Create notification
    const notificationUserId = status === 'cancelled' ? booking.landlord_id : booking.tenant_id;
    
    await client.query(
      `INSERT INTO notifications (user_id, title, message, notification_type, related_entity_type, related_entity_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        notificationUserId,
        'Booking Status Updated',
        `Your booking for "${booking.title}" has been ${status}`,
        'booking_update',
        'booking',
        id
      ]
    );

    await client.query('COMMIT');

    res.json({
      status: 'success',
      message: `Booking ${status} successfully`
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update booking status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  } finally {
    client.release();
  }
};

// Get booking by ID
exports.getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;

    const result = await query(
      `SELECT b.*, p.title, p.city, p.neighborhood, p.images, 
             landlord.first_name as landlord_name, landlord.phone_number as landlord_phone,
             tenant.first_name as tenant_name, tenant.phone_number as tenant_phone
      FROM bookings b
      JOIN properties p ON b.property_id = p.property_id
      JOIN users landlord ON b.landlord_id = landlord.user_id
      JOIN users tenant ON b.tenant_id = tenant.user_id
      WHERE b.booking_id = $1 AND (b.tenant_id = $2 OR b.landlord_id = $2)`,
      [id, user_id]
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
    console.error('Get booking error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};