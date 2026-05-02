const express = require('express');
const { query, getClient } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { emitToUser } = require('../services/socketService');

const router = express.Router();

// Input validation middleware
const validateLeaseId = (req, res, next) => {
  const { leaseId } = req.params;
  if (leaseId && isNaN(parseInt(leaseId))) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid lease ID'
    });
  }
  next();
};

// Get tenant's leases with comprehensive details
router.get('/my-leases', authenticateToken, authorizeRoles('tenant'), async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE b.tenant_id = $1';
    let queryParams = [req.user.user_id];
    let paramCount = 1;

    if (status && status !== 'all') {
      paramCount++;
      whereClause += ` AND l.status = $${paramCount}`;
      queryParams.push(status);
    }

    const result = await query(
      `SELECT 
        l.lease_id, l.lease_number, l.start_date, l.end_date, l.monthly_rent,
        l.security_deposit, l.status, l.terms, l.created_at, l.updated_at,
        b.booking_id, b.unit_id, b.special_terms,
        u.unit_number, u.unit_type, u.specifications, u.furnishing_status,
        p.property_id, p.title as property_title, p.address, p.city, p.state, 
        p.zip_code, p.property_type, p.bedrooms, p.bathrooms, p.area_sqft, p.amenities,
        p.latitude, p.longitude,
        ld.user_id as landlord_id, ld.first_name as landlord_name, 
        ld.last_name as landlord_last_name, ld.phone_number as landlord_phone,
        ld.email as landlord_email, ld.profile_picture as landlord_avatar,
        COUNT(*) OVER() as total_count,
        
        -- Payment summary
        (SELECT COALESCE(SUM(amount), 0) 
         FROM payments 
         WHERE lease_id = l.lease_id AND status = 'completed') as total_paid,
         
        -- Next payment info
        (SELECT amount FROM payments 
         WHERE lease_id = l.lease_id AND status = 'pending'
         ORDER BY due_date ASC LIMIT 1) as next_payment_amount,
         
        (SELECT due_date FROM payments 
         WHERE lease_id = l.lease_id AND status = 'pending'
         ORDER BY due_date ASC LIMIT 1) as next_payment_date

       FROM leases l
       JOIN bookings b ON l.booking_id = b.booking_id
       JOIN property_units u ON b.unit_id = u.unit_id
       JOIN properties p ON u.property_id = p.property_id
       JOIN users ld ON p.landlord_id = ld.user_id
       ${whereClause}
       ORDER BY 
         CASE WHEN l.status = 'active' THEN 1
              WHEN l.status = 'pending' THEN 2
              WHEN l.status = 'expired' THEN 3
              ELSE 4 END,
         l.created_at DESC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, parseInt(limit), offset]
    );

    const today = new Date();
    const leases = result.rows.map(lease => {
      const startDate = new Date(lease.start_date);
      const endDate = new Date(lease.end_date);
      
      // Calculate lease metrics
      const totalMonths = Math.ceil((endDate - startDate) / (30 * 24 * 60 * 60 * 1000));
      const monthsCompleted = Math.max(0, Math.floor((today - startDate) / (30 * 24 * 60 * 60 * 1000)));
      const monthsRemaining = Math.max(0, totalMonths - monthsCompleted);
      const daysRemaining = Math.ceil((endDate - today) / (24 * 60 * 60 * 1000));
      
      // Parse JSON fields
      const specifications = typeof lease.specifications === 'string' 
        ? JSON.parse(lease.specifications) 
        : lease.specifications || {};
      
      const amenities = typeof lease.amenities === 'string'
        ? JSON.parse(lease.amenities)
        : lease.amenities || {};

      return {
        ...lease,
        specifications,
        amenities,
        total_months: totalMonths,
        months_completed: monthsCompleted,
        months_remaining: monthsRemaining,
        days_remaining: daysRemaining,
        progress_percentage: totalMonths > 0 ? Math.round((monthsCompleted / totalMonths) * 100) : 0,
        is_active: lease.status === 'active' && daysRemaining > 0,
        is_expiring_soon: daysRemaining > 0 && daysRemaining <= 30,
        total_paid: parseFloat(lease.total_paid) || 0,
        next_payment_amount: parseFloat(lease.next_payment_amount) || lease.monthly_rent,
        next_payment_date: lease.next_payment_date || calculateNextPaymentDate(startDate),
        total_count: parseInt(lease.total_count) || 0
      };
    });

    res.json({
      status: 'success',
      data: {
        leases: leases.map(({ total_count, ...lease }) => lease),
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil((leases[0]?.total_count || 0) / limit),
          total_items: leases[0]?.total_count || 0,
          items_per_page: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('My leases fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch leases',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get lease by ID with comprehensive details
router.get('/:leaseId', authenticateToken, validateLeaseId, async (req, res) => {
  const client = await getClient();
  
  try {
    const { leaseId } = req.params;

    const result = await query(
      `SELECT 
        l.lease_id, l.lease_number, l.start_date, l.end_date, 
        l.monthly_rent, l.security_deposit, l.status, l.terms, 
        l.created_at, l.updated_at,
        b.booking_id, b.unit_id, b.special_terms,
        u.unit_number, u.unit_type, u.specifications, u.furnishing_status,
        p.property_id, p.title as property_title, p.address, p.city, p.state, 
        p.zip_code, p.property_type, p.bedrooms, p.bathrooms, p.area_sqft, 
        p.amenities, p.description, p.latitude, p.longitude,
        ld.user_id as landlord_id, ld.first_name as landlord_name, 
        ld.last_name as landlord_last_name, ld.phone_number as landlord_phone,
        ld.email as landlord_email, ld.profile_picture as landlord_avatar,
        t.user_id as tenant_id, t.first_name as tenant_name, 
        t.last_name as tenant_last_name, t.phone_number as tenant_phone,
        t.email as tenant_email, t.profile_picture as tenant_avatar
       FROM leases l
       JOIN bookings b ON l.booking_id = b.booking_id
       JOIN property_units u ON b.unit_id = u.unit_id
       JOIN properties p ON u.property_id = p.property_id
       JOIN users ld ON p.landlord_id = ld.user_id
       JOIN users t ON b.tenant_id = t.user_id
       WHERE l.lease_id = $1`,
      [parseInt(leaseId)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Lease not found'
      });
    }

    const lease = result.rows[0];
    
    // Verify access
    if (req.user.role === 'tenant' && lease.tenant_id !== req.user.user_id) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied to this lease'
      });
    }

    if (req.user.role === 'landlord' && lease.landlord_id !== req.user.user_id) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied to this lease'
      });
    }

    // Get payment history
    const paymentsResult = await client.query(
      `SELECT 
        payment_id, amount, payment_method, status, due_date,
        payment_date, transaction_id, created_at
       FROM payments 
       WHERE lease_id = $1 
       ORDER BY created_at DESC`,
      [leaseId]
    );

    // Calculate lease analytics
    const today = new Date();
    const startDate = new Date(lease.start_date);
    const endDate = new Date(lease.end_date);
    
    const totalMonths = Math.ceil((endDate - startDate) / (30 * 24 * 60 * 60 * 1000));
    const monthsCompleted = Math.max(0, Math.floor((today - startDate) / (30 * 24 * 60 * 60 * 1000)));
    const monthsRemaining = Math.max(0, totalMonths - monthsCompleted);
    const daysRemaining = Math.ceil((endDate - today) / (24 * 60 * 60 * 1000));
    
    const totalPaid = paymentsResult.rows
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);
    
    const pendingPayments = paymentsResult.rows.filter(p => p.status === 'pending');

    // Parse JSON fields
    const specifications = typeof lease.specifications === 'string' 
      ? JSON.parse(lease.specifications) 
      : lease.specifications || {};
    
    const amenities = typeof lease.amenities === 'string'
      ? JSON.parse(lease.amenities)
      : lease.amenities || {};

    const leaseDetails = {
      ...lease,
      specifications,
      amenities,
      total_months: totalMonths,
      months_completed: monthsCompleted,
      months_remaining: monthsRemaining,
      days_remaining: daysRemaining,
      progress_percentage: totalMonths > 0 ? Math.round((monthsCompleted / totalMonths) * 100) : 0,
      is_active: lease.status === 'active' && daysRemaining > 0,
      is_expiring_soon: daysRemaining > 0 && daysRemaining <= 30,
      financial_summary: {
        total_paid: totalPaid,
        total_expected: lease.monthly_rent * monthsCompleted,
        security_deposit: parseFloat(lease.security_deposit) || 0,
        pending_payments: pendingPayments.length,
        next_payment: pendingPayments[0] || calculateNextPayment(lease)
      },
      payment_history: paymentsResult.rows,
      documents: await getLeaseDocuments(client, leaseId)
    };

    res.json({
      status: 'success',
      data: {
        lease: leaseDetails
      }
    });

  } catch (error) {
    console.error('Lease fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch lease details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// Get lease payments with filtering
router.get('/:leaseId/payments', authenticateToken, validateLeaseId, async (req, res) => {
  try {
    const { leaseId } = req.params;
    const { status, year, month, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Verify lease access
    const accessCheck = await query(
      `SELECT b.tenant_id, p.landlord_id 
       FROM leases l
       JOIN bookings b ON l.booking_id = b.booking_id
       JOIN properties p ON b.property_id = p.property_id
       WHERE l.lease_id = $1`,
      [leaseId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Lease not found'
      });
    }

    const lease = accessCheck.rows[0];
    if (req.user.role === 'tenant' && lease.tenant_id !== req.user.user_id) {
      return res.status(403).json({ status: 'error', message: 'Access denied' });
    }
    if (req.user.role === 'landlord' && lease.landlord_id !== req.user.user_id) {
      return res.status(403).json({ status: 'error', message: 'Access denied' });
    }

    // Build query with filters
    let whereClause = 'WHERE p.lease_id = $1';
    let queryParams = [leaseId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      whereClause += ` AND p.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (year) {
      paramCount++;
      whereClause += ` AND EXTRACT(YEAR FROM p.due_date) = $${paramCount}`;
      queryParams.push(parseInt(year));
    }

    if (month) {
      paramCount++;
      whereClause += ` AND EXTRACT(MONTH FROM p.due_date) = $${paramCount}`;
      queryParams.push(parseInt(month));
    }

    const result = await query(
      `SELECT 
        p.payment_id, p.amount, p.payment_method, p.status,
        p.due_date, p.payment_date, p.transaction_id, p.created_at,
        m.mpesa_code, m.phone_number, m.receipt_number,
        i.invoice_number, i.items, i.due_amount,
        COUNT(*) OVER() as total_count
       FROM payments p
       LEFT JOIN mpesa_transactions m ON p.payment_id = m.payment_id
       LEFT JOIN invoices i ON p.payment_id = i.payment_id
       ${whereClause}
       ORDER BY p.due_date DESC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, parseInt(limit), offset]
    );

    const payments = result.rows.map(payment => ({
      ...payment,
      items: typeof payment.items === 'string' ? JSON.parse(payment.items) : payment.items,
      total_count: parseInt(payment.total_count) || 0
    }));

    // Payment summary
    const summaryResult = await query(
      `SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_amount
       FROM payments 
       WHERE lease_id = $1
       GROUP BY status`,
      [leaseId]
    );

    const summary = summaryResult.rows.reduce((acc, row) => {
      acc[row.status] = {
        count: parseInt(row.count),
        amount: parseFloat(row.total_amount)
      };
      return acc;
    }, {});

    res.json({
      status: 'success',
      data: {
        payments: payments.map(({ total_count, ...payment }) => payment),
        summary,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil((payments[0]?.total_count || 0) / limit),
          total_items: payments[0]?.total_count || 0,
          items_per_page: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Lease payments fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch payments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Generate lease agreement PDF
router.get('/:leaseId/agreement', authenticateToken, validateLeaseId, async (req, res) => {
  try {
    const { leaseId } = req.params;

    // Verify access and get lease data
    const result = await query(
      `SELECT 
        l.*, b.*, u.*, p.*,
        ld.first_name as landlord_name, ld.last_name as landlord_last_name,
        ld.phone_number as landlord_phone, ld.email as landlord_email,
        t.first_name as tenant_name, t.last_name as tenant_last_name,
        t.phone_number as tenant_phone, t.email as tenant_email,
        t.id_number as tenant_id_number
       FROM leases l
       JOIN bookings b ON l.booking_id = b.booking_id
       JOIN property_units u ON b.unit_id = u.unit_id
       JOIN properties p ON u.property_id = p.property_id
       JOIN users ld ON p.landlord_id = ld.user_id
       JOIN users t ON b.tenant_id = t.user_id
       WHERE l.lease_id = $1`,
      [leaseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Lease not found' });
    }

    const lease = result.rows[0];

    // Verify access
    if (req.user.role === 'tenant' && lease.tenant_id !== req.user.user_id) {
      return res.status(403).json({ status: 'error', message: 'Access denied' });
    }

    // Generate PDF (you can use libraries like pdfkit, puppeteer, or a service)
    const agreementData = {
      lease_number: lease.lease_number,
      generated_date: new Date().toLocaleDateString(),
      landlord: {
        name: `${lease.landlord_name} ${lease.landlord_last_name}`,
        phone: lease.landlord_phone,
        email: lease.landlord_email
      },
      tenant: {
        name: `${lease.tenant_name} ${lease.tenant_last_name}`,
        phone: lease.tenant_phone,
        email: lease.tenant_email,
        id_number: lease.tenant_id_number
      },
      property: {
        title: lease.property_title,
        address: `${lease.address}, ${lease.city}, ${lease.state} ${lease.zip_code}`,
        unit: `Unit ${lease.unit_number} - ${lease.unit_type}`,
        specifications: typeof lease.specifications === 'string' 
          ? JSON.parse(lease.specifications) 
          : lease.specifications
      },
      terms: {
        start_date: new Date(lease.start_date).toLocaleDateString(),
        end_date: new Date(lease.end_date).toLocaleDateString(),
        monthly_rent: `KSh ${lease.monthly_rent.toLocaleString()}`,
        security_deposit: `KSh ${lease.security_deposit.toLocaleString()}`,
        special_terms: lease.special_terms
      }
    };

    // For now, return the data - you can implement PDF generation later
    res.json({
      status: 'success',
      data: {
        agreement: agreementData,
        download_url: `/api/leases/${leaseId}/agreement/pdf` // Implement this endpoint separately
      }
    });

  } catch (error) {
    console.error('Lease agreement error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate agreement'
    });
  }
});

// Renew lease request
router.post('/:leaseId/renew', authenticateToken, authorizeRoles('tenant'), validateLeaseId, async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    const { leaseId } = req.params;
    const { end_date, new_rent } = req.body;

    // Check if lease exists and is active
    const leaseCheck = await client.query(
      `SELECT l.*, b.tenant_id, b.unit_id
       FROM leases l
       JOIN bookings b ON l.booking_id = b.booking_id
       WHERE l.lease_id = $1 AND l.status = 'active'`,
      [leaseId]
    );

    if (leaseCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        message: 'Active lease not found'
      });
    }

    const lease = leaseCheck.rows[0];

    if (lease.tenant_id !== req.user.user_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ status: 'error', message: 'Access denied' });
    }

    // Create renewal request
    const renewalResult = await client.query(
      `INSERT INTO lease_renewals (
        lease_id, current_end_date, requested_end_date, 
        current_rent, requested_rent, status, requested_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        leaseId,
        lease.end_date,
        end_date,
        lease.monthly_rent,
        new_rent || lease.monthly_rent,
        'pending',
        'tenant'
      ]
    );

    await client.query('COMMIT');

    // Notify landlord
    const landlordResult = await client.query(
      'SELECT landlord_id FROM properties p JOIN property_units u ON p.property_id = u.property_id WHERE u.unit_id = $1',
      [lease.unit_id]
    );

    if (landlordResult.rows.length > 0) {
      emitToUser(landlordResult.rows[0].landlord_id, 'lease:renewal_requested', {
        lease_id: leaseId,
        renewal_id: renewalResult.rows[0].renewal_id,
        tenant_name: `${req.user.first_name} ${req.user.last_name}`
      });
    }

    res.json({
      status: 'success',
      message: 'Lease renewal request submitted',
      data: {
        renewal: renewalResult.rows[0]
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Lease renewal error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to submit renewal request'
    });
  } finally {
    client.release();
  }
});

// Helper functions
function calculateNextPaymentDate(startDate) {
  const next = new Date(startDate);
  next.setMonth(next.getMonth() + 1);
  next.setDate(1);
  return next.toISOString().split('T')[0];
}

function calculateNextPayment(lease) {
  const today = new Date();
  const nextPaymentDate = calculateNextPaymentDate(lease.start_date);
  
  return {
    amount: lease.monthly_rent,
    due_date: nextPaymentDate,
    days_until_due: Math.ceil((new Date(nextPaymentDate) - today) / (24 * 60 * 60 * 1000))
  };
}

async function getLeaseDocuments(client, leaseId) {
  try {
    const result = await client.query(
      `SELECT document_id, document_type, file_name, file_url, 
              uploaded_by, created_at
       FROM lease_documents 
       WHERE lease_id = $1 
       ORDER BY created_at DESC`,
      [leaseId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching lease documents:', error);
    return [];
  }
}

module.exports = router;