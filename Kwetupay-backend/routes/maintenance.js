const express = require('express');
const { query, getClient } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { emitToUser } = require('../services/socketService');

const router = express.Router();

// Create maintenance request (Tenants only)
router.post('/', authenticateToken, async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    const { property_id, title, description, urgency } = req.body;

    // Verify tenant has access to this property through a booking
    const propertyCheck = await client.query(
      `SELECT p.property_id, p.landlord_id, p.title as property_title,
              b.tenant_id
       FROM properties p
       JOIN bookings b ON p.property_id = b.property_id
       WHERE p.property_id = $1 AND b.tenant_id = $2 AND b.booking_status = 'approved'`,
      [property_id, req.user.user_id]
    );

    if (propertyCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        status: 'error',
        message: 'Property not found or access denied'
      });
    }

    const property = propertyCheck.rows[0];

    // Create maintenance request - USING CORRECT COLUMN NAMES
    const requestResult = await client.query(
      `INSERT INTO maintenance_requests (
        property_id, tenant_id, title, description, urgency, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        property_id,
        req.user.user_id,
        title,
        description,
        urgency || 'medium',
        'pending'
      ]
    );

    await client.query('COMMIT');

    const maintenanceRequest = requestResult.rows[0];

    // Notify landlord in real-time
    emitToUser(property.landlord_id, 'maintenance:new', {
      request: {
        ...maintenanceRequest,
        tenant_name: `${req.user.first_name} ${req.user.last_name}`,
        property_title: property.property_title
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Maintenance request submitted successfully',
      data: {
        request: maintenanceRequest
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Maintenance request creation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  } finally {
    client.release();
  }
});

// Get tenant's maintenance requests
router.get('/my-requests', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        mr.request_id, mr.title, mr.description, mr.urgency,
        mr.status, mr.created_at,
        p.title as property_title, p.address, p.city,
        ld.first_name as landlord_name, ld.phone_number as landlord_phone
       FROM maintenance_requests mr
       JOIN properties p ON mr.property_id = p.property_id
       JOIN users ld ON p.landlord_id = ld.user_id
       WHERE mr.tenant_id = $1
       ORDER BY mr.created_at DESC`,
      [req.user.user_id]
    );

    res.json({
      status: 'success',
      data: {
        requests: result.rows,
        count: result.rows.length
      }
    });

  } catch (error) {
    console.error('My maintenance requests fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get landlord's maintenance requests
router.get('/landlord/requests', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        mr.request_id, mr.title, mr.description, mr.urgency,
        mr.status, mr.created_at,
        p.title as property_title, p.address, p.city,
        t.first_name as tenant_name, t.last_name as tenant_last_name, 
        t.phone_number as tenant_phone, t.email as tenant_email
       FROM maintenance_requests mr
       JOIN properties p ON mr.property_id = p.property_id
       JOIN users t ON mr.tenant_id = t.user_id
       WHERE p.landlord_id = $1  -- Use p.landlord_id instead of mr.landlord_id
       ORDER BY 
         CASE mr.urgency 
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           WHEN 'low' THEN 3
           ELSE 4
         END,
         mr.created_at DESC`,
      [req.user.user_id]
    );

    res.json({
      status: 'success',
      data: {
        requests: result.rows,
        count: result.rows.length
      }
    });

  } catch (error) {
    console.error('Landlord maintenance requests fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Update maintenance request status (Landlords only)
router.put('/:requestId/status', authenticateToken, async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    const { requestId } = req.params;
    const { status, landlord_notes } = req.body;

    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        status: 'error',
        message: 'Invalid status. Must be: pending, in_progress, completed, or cancelled'
      });
    }

    // Verify request belongs to landlord's property
    const requestCheck = await client.query(
      `SELECT mr.request_id, mr.tenant_id 
       FROM maintenance_requests mr
       JOIN properties p ON mr.property_id = p.property_id
       WHERE mr.request_id = $1 AND p.landlord_id = $2`,
      [requestId, req.user.user_id]
    );

    if (requestCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        message: 'Maintenance request not found or access denied'
      });
    }

    const updateData = {
      status,
      updated_at: new Date()
    };

    if (landlord_notes) {
      updateData.landlord_notes = landlord_notes;
    }

    if (status === 'completed') {
      updateData.completed_date = new Date();
    }

    const result = await client.query(
      `UPDATE maintenance_requests 
       SET status = $1, landlord_notes = $2, completed_date = $3
       WHERE request_id = $4
       RETURNING *`,
      [updateData.status, updateData.landlord_notes, updateData.completed_date, requestId]
    );

    await client.query('COMMIT');

    // Notify tenant about status update
    const request = result.rows[0];
    emitToUser(request.tenant_id, 'maintenance:updated', {
      request_id: request.request_id,
      status: request.status,
      landlord_notes: request.landlord_notes
    });

    res.json({
      status: 'success',
      message: `Maintenance request ${status} successfully`,
      data: {
        request: result.rows[0]
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Maintenance status update error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  } finally {
    client.release();
  }
});

// Get maintenance request by ID
router.get('/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;

    const result = await query(
      `SELECT 
        mr.*,
        p.title as property_title, p.address, p.city,
        t.first_name as tenant_name, t.last_name as tenant_last_name, 
        t.phone_number as tenant_phone, t.email as tenant_email,
        ld.first_name as landlord_name, ld.phone_number as landlord_phone
       FROM maintenance_requests mr
       JOIN properties p ON mr.property_id = p.property_id
       JOIN users t ON mr.tenant_id = t.user_id
       JOIN users ld ON p.landlord_id = ld.user_id
       WHERE mr.request_id = $1 AND (mr.tenant_id = $2 OR p.landlord_id = $2)`,
      [requestId, req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Maintenance request not found'
      });
    }

    res.json({
      status: 'success',
      data: {
        request: result.rows[0]
      }
    });

  } catch (error) {
    console.error('Maintenance request fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

module.exports = router;