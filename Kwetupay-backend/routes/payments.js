const express = require('express');
const { query, getClient } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { emitToUser } = require('../services/socketService');
const { stkPush, isConfigured, formatPhone } = require('../services/mpesaService');

const router = express.Router();

const fmt = (n) => `KES ${parseFloat(n).toLocaleString('en-KE')}`;

// ── Get payment details for an approved booking ─────────────────────────────
router.get('/booking/:bookingId/details', authenticateToken, authorizeRoles('tenant'), async (req, res) => {
  try {
    const { bookingId } = req.params;
    const result = await query(
      `SELECT b.booking_id, b.unit_id, b.total_rent as monthly_rent, b.special_terms,
              u.unit_number, u.unit_type,
              p.title as property_title, p.address, p.city,
              ld.first_name as landlord_name, ld.phone_number as landlord_phone
       FROM bookings b
       JOIN property_units u ON b.unit_id = u.unit_id
       JOIN properties p ON u.property_id = p.property_id
       JOIN users ld ON p.landlord_id = ld.user_id
       WHERE b.booking_id = $1 AND b.tenant_id = $2 AND b.booking_status = 'approved'`,
      [parseInt(bookingId), req.user.user_id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ status: 'error', message: 'Approved booking not found or access denied' });

    const bk = result.rows[0];
    const rent = parseFloat(bk.monthly_rent);
    const deposit = rent;

    res.json({
      status: 'success',
      data: {
        payment_details: {
          booking_id: bk.booking_id,
          property_title: bk.property_title,
          unit_info: `Unit ${bk.unit_number} – ${bk.unit_type}`,
          address: bk.address,
          city: bk.city,
          landlord_name: bk.landlord_name,
          breakdown: { monthly_rent: rent, security_deposit: deposit, total_amount: rent + deposit },
        },
      },
    });
  } catch (error) {
    console.error('Payment details error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch payment details' });
  }
});

// ── Get approved bookings awaiting first payment ─────────────────────────────
router.get('/approved-bookings', authenticateToken, authorizeRoles('tenant'), async (req, res) => {
  try {
    const result = await query(
      `SELECT b.booking_id, b.unit_id, b.start_date, b.end_date,
              b.total_rent as monthly_rent, b.special_terms, b.created_at,
              u.unit_number, u.unit_type,
              p.title as property_title, p.address, p.city,
              ld.first_name as landlord_name, ld.phone_number as landlord_phone, ld.user_id as landlord_id
       FROM bookings b
       JOIN property_units u ON b.unit_id = u.unit_id
       JOIN properties p ON u.property_id = p.property_id
       JOIN users ld ON p.landlord_id = ld.user_id
       WHERE b.tenant_id = $1 AND b.booking_status = 'approved'
       ORDER BY b.created_at DESC`,
      [req.user.user_id]
    );

    const bookings = result.rows.map(bk => {
      const rent = parseFloat(bk.monthly_rent);
      const deposit = rent;
      return {
        ...bk,
        payment_required: {
          monthly_rent: rent,
          security_deposit: deposit,
          total_amount: rent + deposit,
          breakdown: [
            { type: 'rent', amount: rent, description: 'First month rent' },
            { type: 'deposit', amount: deposit, description: 'Security deposit (refundable)' },
          ],
        },
      };
    });

    res.json({ status: 'success', data: { bookings, count: bookings.length } });
  } catch (error) {
    console.error('Approved bookings error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch approved bookings' });
  }
});

// ── Get landlord bank details for a booking or lease ─────────────────────────
// Used by tenant payment modal to display where to send bank transfer
router.get('/bank-details', authenticateToken, authorizeRoles('tenant'), async (req, res) => {
  try {
    const { booking_id, lease_id } = req.query;

    let result;
    if (booking_id) {
      result = await query(
        `SELECT ld.bank_details, ld.first_name, ld.last_name, ld.phone_number
         FROM bookings b
         JOIN property_units u ON b.unit_id = u.unit_id
         JOIN properties p ON u.property_id = p.property_id
         JOIN users ld ON p.landlord_id = ld.user_id
         WHERE b.booking_id = $1 AND b.tenant_id = $2`,
        [parseInt(booking_id), req.user.user_id]
      );
    } else if (lease_id) {
      result = await query(
        `SELECT ld.bank_details, ld.first_name, ld.last_name, ld.phone_number
         FROM leases l
         JOIN bookings b ON l.booking_id = b.booking_id
         JOIN properties p ON b.property_id = p.property_id
         JOIN users ld ON p.landlord_id = ld.user_id
         WHERE l.lease_id = $1 AND b.tenant_id = $2`,
        [parseInt(lease_id), req.user.user_id]
      );
    } else {
      return res.status(400).json({ status: 'error', message: 'booking_id or lease_id required' });
    }

    if (result.rows.length === 0)
      return res.status(404).json({ status: 'error', message: 'Not found or access denied' });

    const landlord = result.rows[0];
    res.json({
      status: 'success',
      data: {
        bank_details: landlord.bank_details || null,
        landlord_name: `${landlord.first_name} ${landlord.last_name}`,
        landlord_phone: landlord.phone_number,
      },
    });
  } catch (error) {
    console.error('Bank details error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch bank details' });
  }
});

// ── Process first payment for an approved booking ────────────────────────────
// payment_method: 'mpesa' | 'bank'
// mpesa: triggers STK push, creates active lease + completed payment
// bank:  stores reference, creates active lease + pending payment (landlord confirms)
router.post('/booking/:bookingId/process', authenticateToken, authorizeRoles('tenant'), async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { bookingId } = req.params;
    const { payment_method = 'mpesa', phone_number, bank_reference, bank_name } = req.body;

    if (!['mpesa', 'bank'].includes(payment_method))
      return res.status(400).json({ status: 'error', message: 'payment_method must be mpesa or bank' });

    if (payment_method === 'mpesa' && !phone_number)
      return res.status(400).json({ status: 'error', message: 'phone_number is required for M-Pesa' });
    if (payment_method === 'bank' && !bank_reference)
      return res.status(400).json({ status: 'error', message: 'bank_reference is required for bank transfer' });

    // Verify booking
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
      return res.status(404).json({ status: 'error', message: 'Approved booking not found or access denied' });
    }

    const booking = bookingCheck.rows[0];
    const rent = parseFloat(booking.total_rent);
    const deposit = rent;
    const total = rent + deposit;

    // Check unit not already occupied
    const unitCheck = await client.query(
      'SELECT is_occupied FROM property_units WHERE unit_id = $1',
      [booking.unit_id]
    );
    if (unitCheck.rows[0]?.is_occupied) {
      await client.query('ROLLBACK');
      return res.status(400).json({ status: 'error', message: 'This unit is already occupied' });
    }

    // Initiate M-Pesa STK push if needed
    let stkResult = null;
    let checkoutRequestId = null;

    if (payment_method === 'mpesa') {
      try {
        stkResult = await stkPush(
          phone_number,
          total,
          `BK-${bookingId}`,
          'Kwetupay Rent'
        );
        checkoutRequestId = stkResult.CheckoutRequestID;

        if (stkResult.ResponseCode && stkResult.ResponseCode !== '0') {
          await client.query('ROLLBACK');
          return res.status(400).json({
            status: 'error',
            message: `M-Pesa request failed: ${stkResult.ResponseDescription}`,
          });
        }
      } catch (mpesaErr) {
        await client.query('ROLLBACK');
        return res.status(502).json({ status: 'error', message: 'Failed to reach M-Pesa. Try again.' });
      }
    }

    // Determine payment status and lease status based on method
    const paymentStatus = payment_method === 'mpesa' ? 'completed' : 'pending';
    const transactionId =
      payment_method === 'mpesa'
        ? checkoutRequestId || `MPESA-${Date.now()}`
        : bank_reference;

    // Create lease
    const leaseResult = await client.query(
      `INSERT INTO leases (booking_id, lease_number, start_date, end_date, monthly_rent,
         security_deposit, status, terms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        parseInt(bookingId),
        'LEASE-' + Date.now(),
        booking.start_date,
        booking.end_date,
        rent,
        deposit,
        'active',
        booking.special_terms || 'Standard lease terms apply',
      ]
    );
    const lease = leaseResult.rows[0];

    // Create rent payment
    const rentPay = await client.query(
      `INSERT INTO payments (lease_id, booking_id, tenant_id, amount, payment_method,
         transaction_id, payment_type, description, status, due_date, payment_date)
       VALUES ($1,$2,$3,$4,$5,$6,'rent','First month rent',$7,$8,$9) RETURNING *`,
      [lease.lease_id, parseInt(bookingId), req.user.user_id, rent, payment_method,
       transactionId, paymentStatus, new Date(), new Date()]
    );

    // Create deposit payment
    const depositPay = await client.query(
      `INSERT INTO payments (lease_id, booking_id, tenant_id, amount, payment_method,
         transaction_id, payment_type, description, status, due_date, payment_date)
       VALUES ($1,$2,$3,$4,$5,$6,'deposit','Security deposit',$7,$8,$9) RETURNING *`,
      [lease.lease_id, parseInt(bookingId), req.user.user_id, deposit, payment_method,
       transactionId, paymentStatus, new Date(), new Date()]
    );

    // Update booking to paid and mark unit occupied
    await client.query(
      "UPDATE bookings SET booking_status = 'paid', updated_at = NOW() WHERE booking_id = $1",
      [parseInt(bookingId)]
    );
    await client.query(
      "UPDATE property_units SET is_occupied = true, status = 'occupied' WHERE unit_id = $1",
      [booking.unit_id]
    );

    await client.query('COMMIT');

    // Notify landlord
    emitToUser(booking.landlord_id, 'booking:paid', {
      booking_id: booking.booking_id,
      lease_id: lease.lease_id,
      amount: total,
      payment_method,
      message: payment_method === 'bank'
        ? `Bank transfer submitted for ${booking.property_title} — awaiting your confirmation`
        : `Rent payment received for ${booking.property_title}`,
    });

    const simulated = stkResult?.simulated;
    res.json({
      status: 'success',
      message:
        payment_method === 'mpesa'
          ? simulated
            ? '✅ Payment recorded (simulated — configure M-Pesa credentials for real STK push).'
            : '📱 M-Pesa prompt sent to your phone! Complete the payment there.'
          : '⏳ Bank transfer recorded. Your landlord will confirm the payment shortly.',
      data: {
        lease: { lease_id: lease.lease_id, lease_number: lease.lease_number, status: lease.status },
        payment_method,
        total_paid: total,
        payment_status: paymentStatus,
        simulated: simulated || false,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Booking payment error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to process payment' });
  } finally {
    client.release();
  }
});

// ── Recurring rent payment (M-Pesa or bank) ──────────────────────────────────
router.post('/mpesa', authenticateToken, authorizeRoles('tenant'), async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { lease_id, amount, phone_number, payment_method = 'mpesa', bank_reference } = req.body;

    if (!lease_id || !amount)
      return res.status(400).json({ status: 'error', message: 'lease_id and amount are required' });
    if (payment_method === 'mpesa' && !phone_number)
      return res.status(400).json({ status: 'error', message: 'phone_number is required for M-Pesa' });
    if (payment_method === 'bank' && !bank_reference)
      return res.status(400).json({ status: 'error', message: 'bank_reference is required for bank transfer' });

    // Verify active lease
    const leaseCheck = await client.query(
      `SELECT l.lease_id, l.monthly_rent, l.booking_id, b.property_id, p.landlord_id,
              p.title as property_title
       FROM leases l
       JOIN bookings b ON l.booking_id = b.booking_id
       JOIN properties p ON b.property_id = p.property_id
       WHERE l.lease_id = $1 AND b.tenant_id = $2 AND l.status = 'active'`,
      [lease_id, req.user.user_id]
    );

    if (leaseCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ status: 'error', message: 'Active lease not found or access denied' });
    }

    const lease = leaseCheck.rows[0];
    const minRent = parseFloat(lease.monthly_rent);

    if (parseFloat(amount) < minRent) {
      await client.query('ROLLBACK');
      return res.status(400).json({ status: 'error', message: `Amount must be at least ${fmt(minRent)}` });
    }

    // M-Pesa STK push
    let stkResult = null;
    let transactionId;

    if (payment_method === 'mpesa') {
      try {
        stkResult = await stkPush(phone_number, amount, `LS-${lease_id}`, 'Kwetupay Rent');
        if (stkResult.ResponseCode && stkResult.ResponseCode !== '0') {
          await client.query('ROLLBACK');
          return res.status(400).json({ status: 'error', message: stkResult.ResponseDescription });
        }
        transactionId = stkResult.CheckoutRequestID || `MPESA-${Date.now()}`;
      } catch {
        await client.query('ROLLBACK');
        return res.status(502).json({ status: 'error', message: 'Failed to reach M-Pesa. Try again.' });
      }
    } else {
      transactionId = bank_reference;
    }

    const paymentStatus = payment_method === 'mpesa' ? 'completed' : 'pending';
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);

    const paymentResult = await client.query(
      `INSERT INTO payments (lease_id, booking_id, tenant_id, amount, payment_method,
         transaction_id, payment_type, description, status, due_date, payment_date)
       VALUES ($1,$2,$3,$4,$5,$6,'rent','Monthly rent',$7,$8,$9) RETURNING *`,
      [lease_id, lease.booking_id, req.user.user_id, parseFloat(amount), payment_method,
       transactionId, paymentStatus, nextMonth.toISOString().split('T')[0], new Date()]
    );

    await client.query('COMMIT');

    emitToUser(lease.landlord_id, 'payment:received', {
      lease_id,
      amount,
      payment_method,
      message: payment_method === 'bank'
        ? 'Bank transfer submitted — please verify and confirm'
        : 'Rent payment received',
    });

    res.json({
      status: 'success',
      message:
        payment_method === 'mpesa'
          ? stkResult?.simulated
            ? '✅ Payment recorded (simulated M-Pesa).'
            : '📱 M-Pesa prompt sent! Complete on your phone.'
          : '⏳ Bank transfer recorded. Awaiting landlord confirmation.',
      data: { payment: paymentResult.rows[0], payment_status: paymentStatus },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Recurring payment error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to process payment' });
  } finally {
    client.release();
  }
});

// ── Daraja STK push callback ─────────────────────────────────────────────────
router.post('/mpesa/callback', async (req, res) => {
  try {
    const { Body } = req.body;
    if (!Body?.stkCallback) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

    const { ResultCode, ResultDesc, CallbackMetadata, CheckoutRequestID } = Body.stkCallback;
    console.log('📲 M-Pesa callback:', { ResultCode, CheckoutRequestID });

    if (ResultCode === 0 && CheckoutRequestID) {
      // Find payment by transaction_id (CheckoutRequestID)
      const items = CallbackMetadata?.Item || [];
      const get = (name) => items.find(i => i.Name === name)?.Value;
      const mpesaCode = get('MpesaReceiptNumber');

      await query(
        `UPDATE payments SET status = 'completed', transaction_id = COALESCE($1, transaction_id)
         WHERE transaction_id = $2 AND status != 'completed'`,
        [mpesaCode || null, CheckoutRequestID]
      );
    } else if (ResultCode !== 1032) {
      // 1032 = user cancelled — mark as failed
      await query(
        `UPDATE payments SET status = 'failed' WHERE transaction_id = $1 AND status = 'completed'`,
        [CheckoutRequestID]
      );
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('M-Pesa callback error:', error);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

// ── Landlord: get pending bank payments for confirmation ─────────────────────
router.get('/landlord/pending-bank', authenticateToken, authorizeRoles('landlord'), async (req, res) => {
  try {
    const result = await query(
      `SELECT pay.payment_id, pay.amount, pay.payment_type, pay.transaction_id as bank_reference,
              pay.created_at, pay.description,
              p.title as property_title, pu.unit_number,
              t.first_name as tenant_name, t.last_name as tenant_last_name,
              t.phone_number as tenant_phone, t.email as tenant_email
       FROM payments pay
       JOIN leases l ON pay.lease_id = l.lease_id
       JOIN bookings b ON l.booking_id = b.booking_id
       JOIN properties p ON b.property_id = p.property_id
       LEFT JOIN property_units pu ON b.unit_id = pu.unit_id
       JOIN users t ON pay.tenant_id = t.user_id
       WHERE p.landlord_id = $1 AND pay.payment_method = 'bank' AND pay.status = 'pending'
       ORDER BY pay.created_at DESC`,
      [req.user.user_id]
    );

    res.json({ status: 'success', data: { payments: result.rows } });
  } catch (error) {
    console.error('Pending bank payments error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch pending payments' });
  }
});

// ── Landlord: confirm or reject a bank payment ───────────────────────────────
router.patch('/:paymentId/confirm', authenticateToken, authorizeRoles('landlord'), async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { action } = req.body; // 'confirm' | 'reject'

    if (!['confirm', 'reject'].includes(action))
      return res.status(400).json({ status: 'error', message: 'action must be confirm or reject' });

    // Verify this payment belongs to landlord's property
    const check = await query(
      `SELECT pay.payment_id, pay.tenant_id, pay.amount, pay.payment_type
       FROM payments pay
       JOIN leases l ON pay.lease_id = l.lease_id
       JOIN bookings b ON l.booking_id = b.booking_id
       JOIN properties p ON b.property_id = p.property_id
       WHERE pay.payment_id = $1 AND p.landlord_id = $2 AND pay.payment_method = 'bank'`,
      [parseInt(paymentId), req.user.user_id]
    );

    if (check.rows.length === 0)
      return res.status(404).json({ status: 'error', message: 'Payment not found or access denied' });

    const payment = check.rows[0];
    const newStatus = action === 'confirm' ? 'completed' : 'failed';

    await query(
      `UPDATE payments SET status = $1, payment_date = NOW() WHERE payment_id = $2`,
      [newStatus, parseInt(paymentId)]
    );

    // Notify tenant
    emitToUser(payment.tenant_id, action === 'confirm' ? 'payment:confirmed' : 'payment:rejected', {
      payment_id: payment.payment_id,
      amount: payment.amount,
      message: action === 'confirm'
        ? `Your bank transfer of KES ${payment.amount} has been confirmed.`
        : `Your bank transfer of KES ${payment.amount} was not confirmed. Please contact your landlord.`,
    });

    res.json({
      status: 'success',
      message: action === 'confirm' ? 'Payment confirmed' : 'Payment rejected',
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update payment' });
  }
});

// ── Tenant: payment history ──────────────────────────────────────────────────
router.get('/my-payments', authenticateToken, authorizeRoles('tenant'), async (req, res) => {
  try {
    const result = await query(
      `SELECT pay.payment_id, pay.amount, pay.payment_method, pay.payment_type, pay.transaction_id,
              pay.status, pay.due_date, pay.payment_date, pay.created_at,
              p.title as property_title, pu.unit_number
       FROM payments pay
       JOIN leases l ON pay.lease_id = l.lease_id
       JOIN bookings b ON l.booking_id = b.booking_id
       JOIN properties p ON b.property_id = p.property_id
       LEFT JOIN property_units pu ON b.unit_id = pu.unit_id
       WHERE pay.tenant_id = $1
       ORDER BY pay.created_at DESC`,
      [req.user.user_id]
    );

    res.json({ status: 'success', data: { payments: result.rows } });
  } catch (error) {
    console.error('My payments error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch payments' });
  }
});

// ── Landlord: all payment history ────────────────────────────────────────────
router.get('/landlord/payments', authenticateToken, authorizeRoles('landlord'), async (req, res) => {
  try {
    const result = await query(
      `SELECT pay.payment_id, pay.amount, pay.payment_method, pay.payment_type,
              pay.status, pay.due_date, pay.payment_date, pay.created_at,
              p.title as property_title, pu.unit_number,
              t.first_name as tenant_name, t.last_name as tenant_last_name, t.email as tenant_email
       FROM payments pay
       JOIN leases l ON pay.lease_id = l.lease_id
       JOIN bookings b ON l.booking_id = b.booking_id
       JOIN properties p ON b.property_id = p.property_id
       LEFT JOIN property_units pu ON b.unit_id = pu.unit_id
       JOIN users t ON pay.tenant_id = t.user_id
       WHERE p.landlord_id = $1
       ORDER BY pay.created_at DESC`,
      [req.user.user_id]
    );

    res.json({ status: 'success', data: { payments: result.rows } });
  } catch (error) {
    console.error('Landlord payments error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch payments' });
  }
});

module.exports = router;
