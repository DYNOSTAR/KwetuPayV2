const { query, getClient } = require('../config/database');

/**
 * Helper function to safely convert to number or null
 */
const safeNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
};

const unitController = {
  // Get all units for a property
  getPropertyUnits: async (req, res) => {
    try {
      const { propertyId } = req.params;
      
      const result = await query(
        `SELECT 
          unit_id, property_id, unit_number, unit_type, 
          rent_amount, currency, bedrooms, bathrooms, area_sqft,
          status, specifications, amenities, is_active,
          created_at, updated_at
         FROM property_units 
         WHERE property_id = $1 AND is_active = true
         ORDER BY unit_number`,
        [propertyId]
      );

      res.json({
        status: 'success',
        data: {
          units: result.rows
        }
      });
    } catch (error) {
      console.error('Error fetching property units:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch property units'
      });
    }
  },

  // Create a new unit - FIXED: Added safeNumber conversion
  createUnit: async (req, res) => {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');

      const { propertyId } = req.params;
      const {
        unit_number,
        unit_type = 'apartment',
        rent_amount,
        bedrooms,
        bathrooms,
        area_sqft,
        specifications = {},
        amenities = {}
      } = req.body;

      // Check if property exists and belongs to landlord
      const propertyCheck = await client.query(
        'SELECT property_id FROM properties WHERE property_id = $1 AND landlord_id = $2',
        [propertyId, req.user.user_id]
      );

      if (propertyCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          status: 'error',
          message: 'Property not found or access denied'
        });
      }

      // Check if unit number already exists for this property
      const unitExists = await client.query(
        'SELECT unit_id FROM property_units WHERE property_id = $1 AND unit_number = $2',
        [propertyId, unit_number]
      );

      if (unitExists.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          status: 'error',
          message: 'Unit number already exists for this property'
        });
      }

      // Insert new unit with safe number conversion
      const result = await client.query(
        `INSERT INTO property_units (
          property_id, unit_number, unit_type, rent_amount,
          bedrooms, bathrooms, area_sqft, specifications, amenities
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          propertyId,
          unit_number,
          unit_type,
          safeNumber(rent_amount),
          safeNumber(bedrooms),    // FIX: Convert empty strings to null
          safeNumber(bathrooms),   // FIX: Convert empty strings to null
          safeNumber(area_sqft),   // FIX: Convert empty strings to null
          JSON.stringify(specifications),
          JSON.stringify(amenities)
        ]
      );

      await client.query('COMMIT');

      res.status(201).json({
        status: 'success',
        data: {
          unit: result.rows[0]
        },
        message: 'Unit created successfully'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating unit:', error);
      
      if (error.code === '22P02') { // Invalid input syntax
        return res.status(400).json({
          status: 'error',
          message: 'Invalid number format. Please check bedroom, bathroom, and area values.'
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Failed to create unit'
      });
    } finally {
      client.release();
    }
  },

  // Update a unit - FIXED: Added safe number handling
  updateUnit: async (req, res) => {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');

      const { unitId } = req.params;
      const updateFields = req.body;

      // Check if unit exists and belongs to landlord's property
      const unitCheck = await client.query(
        `SELECT pu.unit_id 
         FROM property_units pu
         JOIN properties p ON pu.property_id = p.property_id
         WHERE pu.unit_id = $1 AND p.landlord_id = $2`,
        [unitId, req.user.user_id]
      );

      if (unitCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          status: 'error',
          message: 'Unit not found or access denied'
        });
      }

      // Build dynamic update query with safe number conversion
      const setClause = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updateFields).forEach(key => {
        if (key === 'specifications' || key === 'amenities') {
          setClause.push(`${key} = $${paramCount}::jsonb`);
          values.push(JSON.stringify(updateFields[key]));
        } else if (['bedrooms', 'bathrooms', 'area_sqft', 'rent_amount'].includes(key)) {
          setClause.push(`${key} = $${paramCount}`);
          values.push(safeNumber(updateFields[key])); // FIX: Convert numbers safely
        } else {
          setClause.push(`${key} = $${paramCount}`);
          values.push(updateFields[key]);
        }
        paramCount++;
      });

      values.push(unitId);

      const result = await client.query(
        `UPDATE property_units 
         SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE unit_id = $${paramCount}
         RETURNING *`,
        values
      );

      await client.query('COMMIT');

      res.json({
        status: 'success',
        data: {
          unit: result.rows[0]
        },
        message: 'Unit updated successfully'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating unit:', error);
      
      if (error.code === '22P02') {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid number format in update data'
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Failed to update unit'
      });
    } finally {
      client.release();
    }
  },

  // Delete a unit (soft delete)
  deleteUnit: async (req, res) => {
    try {
      const { unitId } = req.params;

      // Check if unit exists and belongs to landlord's property
      const unitCheck = await query(
        `SELECT pu.unit_id
         FROM property_units pu
         JOIN properties p ON pu.property_id = p.property_id
         WHERE pu.unit_id = $1 AND p.landlord_id = $2`,
        [unitId, req.user.user_id]
      );

      if (unitCheck.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Unit not found or access denied'
        });
      }

      // Soft delete the unit
      await query(
        'UPDATE property_units SET is_active = false WHERE unit_id = $1',
        [unitId]
      );

      res.json({
        status: 'success',
        message: 'Unit deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting unit:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete unit'
      });
    }
  }
};

module.exports = unitController;