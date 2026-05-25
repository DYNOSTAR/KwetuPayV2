const { query, getClient } = require('../config/database');

/**
 * 🛠️ Helper function to safely parse JSON
 */
const safeJSON = (data) => {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  return data || {};
};

/**
 * 🏘️ Get all available properties
 */
const getAvailableProperties = async (req, res) => {
  try {
    const { city, min_price, max_price, property_type } = req.query;

    let baseQuery = `
      SELECT 
        p.property_id, p.landlord_id, p.title, p.description, p.property_type, 
        p.rent_amount, p.currency, p.bedrooms, p.bathrooms, p.area_sqft,
        p.address, p.city, p.neighborhood, p.latitude, p.longitude,
        p.amenities, p.images, p.location_details, p.is_available, p.created_at,
        u.first_name AS landlord_name, u.phone_number AS landlord_phone,
        u.email AS landlord_email,
        COUNT(pu.unit_id) as total_units,
        COUNT(CASE WHEN pu.status = 'available' THEN 1 END) as available_units
      FROM properties p
      JOIN users u ON p.landlord_id = u.user_id
      LEFT JOIN property_units pu ON p.property_id = pu.property_id
      WHERE p.is_available = true
    `;

    const queryParams = [];
    let paramCount = 0;

    if (city) {
      paramCount++;
      baseQuery += ` AND p.city ILIKE $${paramCount}`;
      queryParams.push(`%${city}%`);
    }

    if (property_type) {
      paramCount++;
      baseQuery += ` AND p.property_type = $${paramCount}`;
      queryParams.push(property_type);
    }

    if (min_price) {
      paramCount++;
      baseQuery += ` AND p.rent_amount >= $${paramCount}`;
      queryParams.push(parseFloat(min_price));
    }

    if (max_price) {
      paramCount++;
      baseQuery += ` AND p.rent_amount <= $${paramCount}`;
      queryParams.push(parseFloat(max_price));
    }

    baseQuery += ' GROUP BY p.property_id, u.user_id ORDER BY p.created_at DESC';

    const result = await query(baseQuery, queryParams);

    const properties = result.rows.map((property) => ({
      ...property,
      amenities: safeJSON(property.amenities),
      images: safeJSON(property.images),
      location_details: safeJSON(property.location_details)
    }));

    res.json({
      status: 'success',
      data: {
        properties,
        count: properties.length
      }
    });
  } catch (error) {
    console.error('Properties fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error fetching properties'
    });
  }
};

/**
 * 🏘️ Get all available properties WITH their available units (FOR TENANTS)
 */
const getAvailablePropertiesWithUnits = async (req, res) => {
  try {
    const { city, min_price, max_price, property_type } = req.query;

    let baseQuery = `
      SELECT
        p.property_id, p.landlord_id, p.title, p.description, p.property_type,
        p.rent_amount, p.currency, p.bedrooms, p.bathrooms, p.area_sqft,
        p.address, p.city, p.neighborhood, p.latitude, p.longitude,
        p.amenities, p.images, p.location_details, p.is_available, p.created_at,
        u.first_name AS landlord_name, u.phone_number AS landlord_phone,
        u.email AS landlord_email,
        COUNT(pu.unit_id) as total_units,
        COUNT(CASE WHEN pu.status = 'available' THEN 1 END) as available_units
      FROM properties p
      JOIN users u ON p.landlord_id = u.user_id
      LEFT JOIN property_units pu ON p.property_id = pu.property_id
      WHERE p.is_available = true
    `;

    const queryParams = [];
    let paramCount = 0;

    if (city) {
      paramCount++;
      baseQuery += ` AND p.city ILIKE $${paramCount}`;
      queryParams.push(`%${city}%`);
    }

    if (property_type) {
      paramCount++;
      baseQuery += ` AND p.property_type = $${paramCount}`;
      queryParams.push(property_type);
    }

    if (min_price) {
      paramCount++;
      baseQuery += ` AND p.rent_amount >= $${paramCount}`;
      queryParams.push(parseFloat(min_price));
    }

    if (max_price) {
      paramCount++;
      baseQuery += ` AND p.rent_amount <= $${paramCount}`;
      queryParams.push(parseFloat(max_price));
    }

    baseQuery += ` GROUP BY p.property_id, u.user_id
      HAVING COUNT(CASE WHEN pu.status = 'available' THEN 1 END) > 0
      ORDER BY p.created_at DESC`;

    const result = await query(baseQuery, queryParams);

    const properties = result.rows.map((property) => ({
      ...property,
      amenities: safeJSON(property.amenities),
      images: safeJSON(property.images),
      location_details: safeJSON(property.location_details)
    }));

    res.json({
      status: 'success',
      data: {
        properties,
        count: properties.length
      }
    });
  } catch (error) {
    console.error('Properties with units fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error fetching properties with units'
    });
  }
};

/**
 * 🏠 Get available units for a specific property
 */
const getAvailableUnitsByProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;

    // Get property basic info
    const propertyResult = await query(
      `
      SELECT
        p.property_id, p.title, p.property_type, p.address, p.city,
        p.latitude, p.longitude, p.location_details,
        u.first_name AS landlord_name, u.phone_number AS landlord_phone
      FROM properties p
      JOIN users u ON p.landlord_id = u.user_id
      WHERE p.property_id = $1 AND p.is_available = true
      `,
      [propertyId]
    );

    if (propertyResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Property not found or not available'
      });
    }

    // Get available units for this property
    const unitsResult = await query(
      `
      SELECT 
        unit_id, unit_number, unit_type, rent_amount, currency,
        bedrooms, bathrooms, area_sqft, specifications, amenities,
        status, created_at
      FROM property_units 
      WHERE property_id = $1 
        AND status = 'available'
        AND is_active = true
      ORDER BY unit_number
      `,
      [propertyId]
    );

    const units = unitsResult.rows.map(unit => ({
      ...unit,
      specifications: safeJSON(unit.specifications),
      amenities: safeJSON(unit.amenities)
    }));

    const property = propertyResult.rows[0];
    property.location_details = safeJSON(property.location_details);

    res.json({
      status: 'success',
      data: {
        property,
        units: units,
        units_count: units.length
      }
    });
  } catch (error) {
    console.error('Available units fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error fetching available units'
    });
  }
};

/**
 * 🏗️ Create new property with optional units
 */
const createProperty = async (req, res) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const {
      title,
      description,
      property_type,
      rent_amount,
      currency,
      bedrooms,
      bathrooms,
      area_sqft,
      address,
      city,
      neighborhood,
      latitude,
      longitude,
      amenities,
      location_details,
      units = []
    } = req.body;

    // ✅ Helper to safely convert to number or null
    const safeNumber = (value) => {
      if (value === '' || value === null || value === undefined) return null;
      const num = Number(value);
      return isNaN(num) ? null : num;
    };

    // ✅ Prepare clean parameters
    const queryParams = [
      req.user.user_id,
      title || 'Untitled Property',
      description || '',
      property_type || 'Unknown',
      safeNumber(rent_amount),
      currency || 'KES',
      safeNumber(bedrooms),
      safeNumber(bathrooms),
      safeNumber(area_sqft),
      address || '',
      city || '',
      neighborhood || '',
      safeNumber(latitude),
      safeNumber(longitude),
      amenities ? JSON.stringify(amenities) : null,
      location_details ? JSON.stringify(location_details) : '{}'
    ];

    const propertyResult = await client.query(
      `
      INSERT INTO properties (
        landlord_id, title, description, property_type, rent_amount, currency,
        bedrooms, bathrooms, area_sqft, address, city, neighborhood,
        latitude, longitude, amenities, location_details
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *
      `,
      queryParams
    );

    const property = propertyResult.rows[0];
    const propertyId = property.property_id;

    // ✅ Create units if provided
    if (units && units.length > 0) {
      for (const unit of units) {
        await client.query(
          `
          INSERT INTO property_units (
            property_id, unit_number, unit_type, rent_amount, specifications
          )
          VALUES ($1, $2, $3, $4, $5)
          `,
          [
            propertyId,
            unit.unit_number,
            unit.unit_type || 'apartment',
            unit.rent_amount || rent_amount,
            unit.specifications ? JSON.stringify(unit.specifications) : null
          ]
        );
      }
    } else {
      // ✅ Create a default unit for single-unit properties
      await client.query(
        `
        INSERT INTO property_units (
          property_id, unit_number, unit_type, rent_amount, specifications
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          propertyId,
          'UNIT-1',
          property_type,
          rent_amount,
          JSON.stringify({
            bedrooms: bedrooms,
            bathrooms: bathrooms,
            area_sqft: area_sqft,
            amenities: amenities
          })
        ]
      );
    }

    await client.query('COMMIT');

    // ✅ Fetch the complete property with units
    const completeProperty = await getPropertyWithUnits(client, propertyId);

    res.status(201).json({
      status: 'success',
      message: units && units.length > 0 
        ? `Property created successfully with ${units.length} units` 
        : 'Property created successfully with default unit',
      data: { property: completeProperty }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Property creation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error during property creation: ' + error.message
    });
  } finally {
    client.release();
  }
};

/**
 * 🧱 Get landlord's properties with unit statistics
 */
const getMyProperties = async (req, res) => {
  try {
    const result = await query(
      `
      SELECT 
        p.property_id, p.title, p.property_type, p.rent_amount, p.currency,
        p.bedrooms, p.bathrooms, p.area_sqft, p.address, p.city, p.neighborhood,
        p.amenities, p.images, p.is_available, p.created_at,
        COUNT(pu.unit_id) as total_units,
        COUNT(CASE WHEN pu.status = 'available' THEN 1 END) as available_units,
        COUNT(CASE WHEN pu.status = 'occupied' THEN 1 END) as occupied_units,
        COUNT(CASE WHEN pu.status = 'maintenance' THEN 1 END) as maintenance_units
      FROM properties p
      LEFT JOIN property_units pu ON p.property_id = pu.property_id
      WHERE p.landlord_id = $1 
      GROUP BY p.property_id
      ORDER BY p.created_at DESC
      `,
      [req.user.user_id]
    );

    const properties = result.rows.map((property) => ({
      ...property,
      amenities: safeJSON(property.amenities),
      images: safeJSON(property.images)
    }));

    res.json({
      status: 'success',
      data: { properties, count: properties.length }
    });
  } catch (error) {
    console.error('My properties fetch error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

/**
 * 🏠 Get property units
 */
const getPropertyUnits = async (req, res) => {
  try {
    const { propertyId } = req.params;

    // Verify property belongs to landlord
    const propertyCheck = await query(
      'SELECT property_id FROM properties WHERE property_id = $1 AND landlord_id = $2',
      [propertyId, req.user.user_id]
    );

    if (propertyCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Property not found or access denied'
      });
    }

    const unitsResult = await query(
      `
      SELECT 
        pu.*,
        t.first_name as tenant_name,
        t.phone_number as tenant_phone,
        b.booking_status,
        l.lease_status
      FROM property_units pu
      LEFT JOIN bookings b ON pu.property_id = b.property_id AND b.booking_status = 'approved'
      LEFT JOIN leases l ON b.booking_id = l.booking_id
      LEFT JOIN users t ON b.tenant_id = t.user_id
      WHERE pu.property_id = $1
      ORDER BY pu.unit_number
      `,
      [propertyId]
    );

    const units = unitsResult.rows.map(unit => ({
      ...unit,
      specifications: safeJSON(unit.specifications)
    }));

    res.json({
      status: 'success',
      data: { units }
    });
  } catch (error) {
    console.error('Get property units error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

/**
 * ➕ Create new unit for existing property
 */
const createUnit = async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    const { propertyId } = req.params;
    const { unit_number, unit_type, rent_amount, specifications } = req.body;

    // Verify property belongs to landlord
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
    const unitCheck = await client.query(
      'SELECT unit_id FROM property_units WHERE property_id = $1 AND unit_number = $2',
      [propertyId, unit_number]
    );

    if (unitCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        status: 'error',
        message: 'Unit number already exists for this property'
      });
    }

    const unitResult = await client.query(
      `
      INSERT INTO property_units (
        property_id, unit_number, unit_type, rent_amount, specifications
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        propertyId,
        unit_number,
        unit_type || 'apartment',
        rent_amount,
        specifications ? JSON.stringify(specifications) : null
      ]
    );

    await client.query('COMMIT');

    const unit = unitResult.rows[0];
    unit.specifications = safeJSON(unit.specifications);

    res.status(201).json({
      status: 'success',
      message: 'Unit created successfully',
      data: { unit }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Unit creation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error creating unit'
    });
  } finally {
    client.release();
  }
};

/**
 * 🔄 Update unit
 */
const updateUnit = async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    const { unitId } = req.params;
    const { unit_number, unit_type, rent_amount, status, specifications } = req.body;

    // Verify unit belongs to landlord's property
    const unitCheck = await client.query(
      `
      SELECT pu.unit_id 
      FROM property_units pu
      JOIN properties p ON pu.property_id = p.property_id
      WHERE pu.unit_id = $1 AND p.landlord_id = $2
      `,
      [unitId, req.user.user_id]
    );

    if (unitCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        message: 'Unit not found or access denied'
      });
    }

    const unitResult = await client.query(
      `
      UPDATE property_units SET
        unit_number = COALESCE($1, unit_number),
        unit_type = COALESCE($2, unit_type),
        rent_amount = COALESCE($3, rent_amount),
        status = COALESCE($4, status),
        specifications = COALESCE($5, specifications)
      WHERE unit_id = $6
      RETURNING *
      `,
      [
        unit_number,
        unit_type,
        rent_amount,
        status,
        specifications ? JSON.stringify(specifications) : null,
        unitId
      ]
    );

    await client.query('COMMIT');

    const unit = unitResult.rows[0];
    unit.specifications = safeJSON(unit.specifications);

    res.json({
      status: 'success',
      message: 'Unit updated successfully',
      data: { unit }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Unit update error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error updating unit'
    });
  } finally {
    client.release();
  }
};

/**
 * 🔁 Toggle property availability
 */
const toggleAvailability = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const propertyCheck = await query(
      'SELECT property_id, is_available FROM properties WHERE property_id = $1 AND landlord_id = $2',
      [propertyId, req.user.user_id]
    );

    if (propertyCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Property not found or access denied'
      });
    }

    const currentStatus = propertyCheck.rows[0].is_available;

    const result = await query(
      `
      UPDATE properties 
      SET is_available = $1, updated_at = NOW() 
      WHERE property_id = $2 AND landlord_id = $3 
      RETURNING property_id, title, is_available
      `,
      [!currentStatus, propertyId, req.user.user_id]
    );

    res.json({
      status: 'success',
      message: `Property ${!currentStatus ? 'marked as available' : 'marked as rented'}`,
      data: { property: result.rows[0] }
    });
  } catch (error) {
    console.error('Toggle availability error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

/**
 * 🏠 Get single property details
 */
const getPropertyById = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const result = await query(
      `
      SELECT 
        p.property_id, p.landlord_id, p.title, p.description, p.property_type, 
        p.rent_amount, p.currency, p.bedrooms, p.bathrooms, p.area_sqft,
        p.address, p.city, p.neighborhood, p.latitude, p.longitude,
        p.amenities, p.images, p.location_details, p.is_available, p.created_at,
        u.first_name AS landlord_name, u.phone_number AS landlord_phone,
        u.email AS landlord_email
      FROM properties p
      JOIN users u ON p.landlord_id = u.user_id
      WHERE p.property_id = $1
      `,
      [propertyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Property not found' });
    }

    const property = result.rows[0];
    property.amenities = safeJSON(property.amenities);
    property.images = safeJSON(property.images);
    property.location_details = safeJSON(property.location_details);

    res.json({ status: 'success', data: { property } });
  } catch (error) {
    console.error('Property fetch error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

/**
 * ✏️ Update property
 */
const updateProperty = async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    const { propertyId } = req.params;
    const {
      title,
      description,
      property_type,
      rent_amount,
      bedrooms,
      bathrooms,
      area_sqft,
      address,
      city,
      neighborhood,
      latitude,
      longitude,
      amenities,
      location_details
    } = req.body;

    // Check if property exists and belongs to user
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

    // Helper to safely convert to number or null
    const safeNumber = (value) => {
      if (value === '' || value === null || value === undefined) return null;
      const num = Number(value);
      return isNaN(num) ? null : num;
    };

    const result = await client.query(
      `
      UPDATE properties SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        property_type = COALESCE($3, property_type),
        rent_amount = COALESCE($4, rent_amount),
        bedrooms = COALESCE($5, bedrooms),
        bathrooms = COALESCE($6, bathrooms),
        area_sqft = COALESCE($7, area_sqft),
        address = COALESCE($8, address),
        city = COALESCE($9, city),
        neighborhood = COALESCE($10, neighborhood),
        latitude = COALESCE($11, latitude),
        longitude = COALESCE($12, longitude),
        amenities = COALESCE($13, amenities),
        location_details = COALESCE($14, location_details),
        updated_at = NOW()
      WHERE property_id = $15 AND landlord_id = $16
      RETURNING *
      `,
      [
        title,
        description,
        property_type,
        safeNumber(rent_amount),
        safeNumber(bedrooms),
        safeNumber(bathrooms),
        safeNumber(area_sqft),
        address,
        city,
        neighborhood,
        safeNumber(latitude),
        safeNumber(longitude),
        amenities ? JSON.stringify(amenities) : null,
        location_details ? JSON.stringify(location_details) : null,
        propertyId,
        req.user.user_id
      ]
    );

    await client.query('COMMIT');

    const property = result.rows[0];
    property.amenities = safeJSON(property.amenities);
    property.images = safeJSON(property.images);
    property.location_details = safeJSON(property.location_details);

    res.json({
      status: 'success',
      message: 'Property updated successfully',
      data: { property }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Property update error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error updating property'
    });
  } finally {
    client.release();
  }
};

/**
 * 🗑️ Delete property
 */
const deleteProperty = async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    const { propertyId } = req.params;

    // Check if property exists and belongs to user
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

    // Delete the property
    await client.query(
      'DELETE FROM properties WHERE property_id = $1 AND landlord_id = $2',
      [propertyId, req.user.user_id]
    );

    await client.query('COMMIT');

    res.json({
      status: 'success',
      message: 'Property deleted successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Property deletion error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error deleting property'
    });
  } finally {
    client.release();
  }
};

/**
 * Helper function to get property with units
 */
const getPropertyWithUnits = async (client, propertyId) => {
  const propertyResult = await client.query(
    'SELECT * FROM properties WHERE property_id = $1',
    [propertyId]
  );
  
  const unitsResult = await client.query(
    'SELECT * FROM property_units WHERE property_id = $1 ORDER BY unit_number',
    [propertyId]
  );

  const property = propertyResult.rows[0];
  property.amenities = safeJSON(property.amenities);
  property.images = safeJSON(property.images);
  property.units = unitsResult.rows.map(unit => ({
    ...unit,
    specifications: safeJSON(unit.specifications)
  }));

  return property;
};

module.exports = {
  getAvailableProperties,
  getAvailablePropertiesWithUnits,
  getAvailableUnitsByProperty,
  createProperty,
  getMyProperties,
  toggleAvailability,
  getPropertyById,
  updateProperty,
  deleteProperty,
  getPropertyUnits,
  createUnit,
  updateUnit
};