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

// Get payment details for approved booking
router.get('/booking/:bookingId/details', authenticateToken, authorizeRoles('tenant'), validateBookingId, async (req, res) => {
  try {
    const { bookingId } = req.params;

    // Get booking details with unit and property info
    const result = await query(
      `SELECT 
        b.booking_id,
        b.unit_id,
        b.total_rent as monthly_rent,
        b.special_terms,
        u.unit_number,
        u.unit_type,
        u.specifications,
        p.title as property_title,
        p.address,
        p.city,
        ld.first_name as landlord_name,
        ld.phone_number as landlord_phone
       FROM bookings b
       JOIN property_units u ON b.unit_id = u.unit_id
       JOIN properties p ON u.property_id = p.property_id
       JOIN users ld ON p.landlord_id = ld.user_id
       WHERE b.booking_id = $1 AND b.tenant_id = $2 AND b.booking_status = 'approved'`,
      [parseInt(bookingId), req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Approved booking not found or access denied'
      });
    }

    const booking = result.rows[0];
    const monthlyRent = parseFloat(booking.monthly_rent);
    const securityDeposit = monthlyRent; // Deposit equals one month's rent
    const totalAmount = monthlyRent + securityDeposit;

    const paymentDetails = {
      booking_id: booking.booking_id,
      property_title: booking.property_title,
      unit_info: `Unit ${booking.unit_number} - ${booking.unit_type}`,
      address: booking.address,
      city: booking.city,
      landlord_name: booking.landlord_name,
      breakdown: {
        monthly_rent: monthlyRent,
        security_deposit: securityDeposit,
        total_amount: totalAmount
      },
      due_date: new Date().toISOString().split('T')[0], // Payment due immediately
      payment_types: [
        {
          type: 'rent',
          amount: monthlyRent,
          description: 'First month rent'
        },
        {
          type: 'deposit',
          amount: securityDeposit,
          description: 'Security deposit (refundable)'
        }
      ]
    };

    res.json({
      status: 'success',
      data: {
        payment_details: paymentDetails
      }
    });

  } catch (error) {
    console.error('Payment details fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch payment details'
    });
  }
});

// Process payment for approved booking
router.post('/booking/:bookingId/process', authenticateToken, authorizeRoles('tenant'), validateBookingId, async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    const { bookingId } = req.params;
    const { 
      payment_method, 
      transaction_id, 
      phone_number, 
      mpesa_code 
    } = req.body;

    console.log('💰 Processing payment for booking:', bookingId);

    // Verify booking exists and is approved
    const bookingCheck = await client.query(
      `SELECT b.*, u.unit_number, p.title as property_title, p.landlord_id
       FROM bookings b
       JOIN property_units u ON b.unit_id = u.unit_id
       JOIN properties p ON u.property_id = p.property_id
       WHERE b.booking_id = $1 AND b.tenant_id = $2 AND b.booking_status = 'approved'`,
      [parseInt(bookingId), req.user.user_id]
    );

    if (bookingCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        message: 'Approved booking not found or access denied'
      });
    }

    const booking = bookingCheck.rows[0];
    const monthlyRent = parseFloat(booking.total_rent);
    const securityDeposit = monthlyRent; // Deposit equals one month's rent
    const totalAmount = monthlyRent + securityDeposit;

    // Check if unit is already occupied
    const unitCheck = await client.query(
      'SELECT is_occupied FROM property_units WHERE unit_id = $1',
      [booking.unit_id]
    );
    
    if (unitCheck.rows.length > 0 && unitCheck.rows[0].is_occupied) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        status: 'error',
        message: 'This unit is already occupied'
      });
    }

    // Generate lease number
    const leaseNumber = 'LEASE-' + Date.now();

    // Create lease first
    const leaseResult = await client.query(
      `INSERT INTO leases (
        booking_id, 
        lease_number, 
        start_date, 
        end_date, 
        monthly_rent, 
        security_deposit,
        status,
        terms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        parseInt(bookingId),
        leaseNumber,
        booking.start_date,
        booking.end_date,
        monthlyRent,
        securityDeposit,
        'active',
        booking.special_terms || 'Standard lease terms apply'
      ]
    );

    const lease = leaseResult.rows[0];

    // Create payment records for rent and deposit
    const rentPaymentResult = await client.query(
      `INSERT INTO payments (
        lease_id,
        booking_id,
        tenant_id,
        amount,
        payment_method,
        transaction_id,
        payment_type,
        description,
        status,
        due_date,
        payment_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        lease.lease_id,
        parseInt(bookingId),
        req.user.user_id,
        monthlyRent,
        payment_method || 'mpesa',
        transaction_id,
        'rent',
        'First month rent payment',
        'completed',
        new Date(),
        new Date()
      ]
    );

    const depositPaymentResult = await client.query(
      `INSERT INTO payments (
        lease_id,
        booking_id,
        tenant_id,
        amount,
        payment_method,
        transaction_id,
        payment_type,
        description,
        status,
        due_date,
        payment_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        lease.lease_id,
        parseInt(bookingId),
        req.user.user_id,
        securityDeposit,
        payment_method || 'mpesa',
        transaction_id,
        'deposit',
        'Security deposit payment',
        'completed',
        new Date(),
        new Date()
      ]
    );

    // Store M-Pesa transaction if provided
    if (mpesa_code && phone_number) {
      await client.query(
        `INSERT INTO mpesa_transactions (
          payment_id,
          mpesa_code,
          phone_number
        ) VALUES ($1, $2, $3)`,
        [rentPaymentResult.rows[0].payment_id, mpesa_code, phone_number]
      );
    }

    // Update booking status to 'paid'
    await client.query(
      'UPDATE bookings SET booking_status = $1, updated_at = NOW() WHERE booking_id = $2',
      ['paid', parseInt(bookingId)]
    );

    // Mark unit as occupied
    await client.query(
      'UPDATE property_units SET is_occupied = true WHERE unit_id = $1',
      [booking.unit_id]
    );

    await client.query('COMMIT');

    const rentPayment = rentPaymentResult.rows[0];
    const depositPayment = depositPaymentResult.rows[0];

    console.log('✅ Payment processed successfully for lease:', lease.lease_id);

    // Notify landlord
    emitToUser(booking.landlord_id, 'booking:paid', {
      booking_id: booking.booking_id,
      lease_id: lease.lease_id,
      tenant_name: `${req.user.first_name} ${req.user.last_name}`,
      amount: totalAmount,
      message: 'Booking has been paid and lease activated'
    });

    // Notify tenant
    emitToUser(req.user.user_id, 'payment:completed', {
      lease_id: lease.lease_id,
      amount: totalAmount,
      lease_number: lease.lease_number,
      message: 'Payment completed successfully. Your lease is now active.'
    });

    res.json({
      status: 'success',
      message: 'Payment processed successfully and lease created',
      data: {
        lease: {
          ...lease,
          lease_number: lease.lease_number
        },
        payments: {
          rent: rentPayment,
          deposit: depositPayment
        },
        total_paid: totalAmount,
        next_steps: [
          'Your lease agreement is now active',
          'You can move in on the start date',
          'Security deposit will be refunded at lease end',
          'View your lease details in the My Leases section'
        ]
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Payment processing error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// Get approved bookings ready for payment
router.get('/approved-bookings', authenticateToken, authorizeRoles('tenant'), async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        b.booking_id,
        b.unit_id,
        b.start_date,
        b.end_date,
        b.total_rent as monthly_rent,
        b.special_terms,
        b.created_at,
        u.unit_number,
        u.unit_type,
        u.specifications,
        p.title as property_title,
        p.address,
        p.city,
        ld.first_name as landlord_name,
        ld.phone_number as landlord_phone
       FROM bookings b
       JOIN property_units u ON b.unit_id = u.unit_id
       JOIN properties p ON u.property_id = p.property_id
       JOIN users ld ON p.landlord_id = ld.user_id
       WHERE b.tenant_id = $1 AND b.booking_status = 'approved'
       ORDER BY b.created_at DESC`,
      [req.user.user_id]
    );

    // Calculate payment amounts for each approved booking
    const bookings = result.rows.map(booking => {
      const monthlyRent = parseFloat(booking.monthly_rent);
      const securityDeposit = monthlyRent;
      const totalAmount = monthlyRent + securityDeposit;

      return {
        ...booking,
        payment_required: {
          monthly_rent: monthlyRent,
          security_deposit: securityDeposit,
          total_amount: totalAmount,
          breakdown: [
            { type: 'rent', amount: monthlyRent, description: 'First month rent' },
            { type: 'deposit', amount: securityDeposit, description: 'Security deposit' }
          ]
        }
      };
    });

    res.json({
      status: 'success',
      data: {
        bookings,
        count: bookings.length
      }
    });

  } catch (error) {
    console.error('Approved bookings fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch approved bookings'
    });
  }
});

module.exports = router;