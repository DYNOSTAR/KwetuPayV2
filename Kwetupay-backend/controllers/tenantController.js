const { query } = require('../config/database');

/**
 * 👥 Get landlord's tenants
 */
const getLandlordTenants = async (req, res) => {
  try {
    const landlordId = req.user.user_id;

    // Get tenants from bookings that are approved/active
    const result = await query(
      `
      SELECT 
        b.booking_id,
        b.property_id,
        b.tenant_id,
        b.start_date,
        b.end_date,
        b.total_rent,
        b.booking_status,
        b.special_terms,
        b.created_at as booking_date,
        p.title as property_title,
        p.address as property_address,
        p.city as property_city,
        u.first_name,
        u.last_name,
        u.phone_number as contact_phone,
        u.email as contact_email
      FROM bookings b
      JOIN properties p ON b.property_id = p.property_id
      JOIN users u ON b.tenant_id = u.user_id
      WHERE p.landlord_id = $1 
        AND b.booking_status IN ('approved', 'active')
      ORDER BY b.created_at DESC
      `,
      [landlordId]
    );

    const tenants = result.rows.map(tenant => ({
      booking_id: tenant.booking_id,
      property: {
        id: tenant.property_id,
        title: tenant.property_title,
        address: tenant.property_address,
        city: tenant.property_city
      },
      tenant: {
        id: tenant.tenant_id,
        first_name: tenant.first_name,
        last_name: tenant.last_name,
        contact_phone: tenant.contact_phone, // Only show if tenant agreed to share
        contact_email: tenant.contact_email  // Only show if tenant agreed to share
      },
      lease: {
        start_date: tenant.start_date,
        end_date: tenant.end_date,
        total_rent: tenant.total_rent,
        status: tenant.booking_status
      },
      special_terms: tenant.special_terms,
      booking_date: tenant.booking_date
    }));

    res.json({
      status: 'success',
      data: {
        tenants,
        count: tenants.length
      }
    });
  } catch (error) {
    console.error('Get landlord tenants error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error fetching tenants'
    });
  }
};

/**
 * 📊 Get tenant statistics for landlord
 */
const getTenantStatistics = async (req, res) => {
  try {
    const landlordId = req.user.user_id;

    const statsResult = await query(
      `
      SELECT 
        COUNT(DISTINCT b.tenant_id) as total_tenants,
        COUNT(DISTINCT b.property_id) as occupied_properties,
        COUNT(CASE WHEN b.booking_status = 'active' THEN 1 END) as active_leases,
        COUNT(CASE WHEN b.booking_status = 'approved' THEN 1 END) as upcoming_leases,
        AVG(b.total_rent) as average_rent
      FROM bookings b
      JOIN properties p ON b.property_id = p.property_id
      WHERE p.landlord_id = $1 
        AND b.booking_status IN ('approved', 'active')
      `,
      [landlordId]
    );

    const paymentStats = await query(
      `
      SELECT 
        COUNT(*) as total_payments,
        SUM(amount) as total_collected,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments
      FROM payments 
      WHERE landlord_id = $1 
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      `,
      [landlordId]
    );

    const stats = {
      ...statsResult.rows[0],
      ...paymentStats.rows[0]
    };

    res.json({
      status: 'success',
      data: { stats }
    });
  } catch (error) {
    console.error('Get tenant statistics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error fetching statistics'
    });
  }
};

/**
 * 🔍 Get tenant details (limited information for privacy)
 */
const getTenantDetails = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const landlordId = req.user.user_id;

    // Verify the tenant is actually renting from this landlord
    const tenantCheck = await query(
      `
      SELECT 1 FROM bookings b
      JOIN properties p ON b.property_id = p.property_id
      WHERE b.tenant_id = $1 AND p.landlord_id = $2
      LIMIT 1
      `,
      [tenantId, landlordId]
    );

    if (tenantCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Tenant not found or access denied'
      });
    }

    const tenantResult = await query(
      `
      SELECT 
        u.user_id,
        u.first_name,
        u.last_name,
        u.phone_number as contact_phone,
        u.email as contact_email,
        u.created_at as member_since,
        p.title as current_property,
        p.address as property_address,
        b.start_date,
        b.end_date,
        b.total_rent,
        b.booking_status,
        b.special_terms
      FROM users u
      JOIN bookings b ON u.user_id = b.tenant_id
      JOIN properties p ON b.property_id = p.property_id
      WHERE u.user_id = $1 AND p.landlord_id = $2
        AND b.booking_status IN ('approved', 'active')
      ORDER BY b.created_at DESC
      LIMIT 1
      `,
      [tenantId, landlordId]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Tenant details not found'
      });
    }

    const tenant = tenantResult.rows[0];

    // Get payment history (last 6 months)
    const paymentHistory = await query(
      `
      SELECT 
        payment_id,
        amount,
        payment_method,
        status,
        due_date,
        paid_date,
        created_at
      FROM payments 
      WHERE tenant_id = $1 AND landlord_id = $2
        AND created_at >= CURRENT_DATE - INTERVAL '6 months'
      ORDER BY created_at DESC
      `,
      [tenantId, landlordId]
    );

    // Get maintenance requests
    const maintenanceRequests = await query(
      `
      SELECT 
        request_id,
        title,
        description,
        urgency,
        status,
        created_at,
        resolved_at
      FROM maintenance_requests 
      WHERE tenant_id = $1 AND property_id IN (
        SELECT property_id FROM properties WHERE landlord_id = $2
      )
      ORDER BY created_at DESC
      LIMIT 10
      `,
      [tenantId, landlordId]
    );

    const tenantDetails = {
      basic_info: {
        first_name: tenant.first_name,
        last_name: tenant.last_name,
        contact_phone: tenant.contact_phone,
        contact_email: tenant.contact_email,
        member_since: tenant.member_since
      },
      current_lease: {
        property: tenant.current_property,
        address: tenant.property_address,
        start_date: tenant.start_date,
        end_date: tenant.end_date,
        rent_amount: tenant.total_rent,
        status: tenant.booking_status,
        special_terms: tenant.special_terms
      },
      payment_history: paymentHistory.rows,
      maintenance_requests: maintenanceRequests.rows
    };

    res.json({
      status: 'success',
      data: { tenant: tenantDetails }
    });
  } catch (error) {
    console.error('Get tenant details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error fetching tenant details'
    });
  }
};

module.exports = {
  getLandlordTenants,
  getTenantStatistics,
  getTenantDetails
};