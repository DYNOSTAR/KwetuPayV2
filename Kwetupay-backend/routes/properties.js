const express = require('express');
const {
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
} = require('../controllers/propertyController');

const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { upload, uploadImage } = require('../controllers/uploadController');
const { validatePropertyCreation } = require('../middleware/validation');

const router = express.Router();

/**
 * Property Routes
 * IMPORTANT: Static routes MUST come before dynamic routes (/:propertyId)
 */

// Public available properties (no auth required — used by landing page)
router.get('/public/available', async (req, res) => {
  const { query: dbQuery } = require('../config/database');
  try {
    const result = await dbQuery(`
      SELECT
        p.property_id, p.title, p.property_type, p.rent_amount, p.currency,
        p.address, p.city, p.neighborhood, p.images, p.bedrooms, p.bathrooms,
        u.first_name AS landlord_name,
        COUNT(pu.unit_id) AS total_units,
        COUNT(CASE WHEN pu.status = 'available' THEN 1 END) AS available_units
      FROM properties p
      JOIN users u ON p.landlord_id = u.user_id
      LEFT JOIN property_units pu ON p.property_id = pu.property_id
      WHERE p.is_available = true
      GROUP BY p.property_id, u.user_id
      HAVING COUNT(CASE WHEN pu.status = 'available' THEN 1 END) > 0
      ORDER BY p.created_at DESC
      LIMIT 12
    `);

    const properties = result.rows.map(p => ({
      ...p,
      images: typeof p.images === 'string' ? (() => { try { return JSON.parse(p.images); } catch { return []; } })() : (p.images || [])
    }));

    res.json({ status: 'success', data: { properties, count: properties.length } });
  } catch (error) {
    console.error('Public properties fetch error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch properties' });
  }
});

// Upload property image (static route)
router.post(
  '/upload-image',
  authenticateToken,
  upload.single('image'),
  uploadImage
);

// Saved properties (static route)
router.get('/saved', authenticateToken, async (req, res) => {
  try {
    res.json({
      status: 'success',
      data: {
        properties: [],
        count: 0
      }
    });
  } catch (error) {
    console.error('Saved properties fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error fetching saved properties'
    });
  }
});

// Get available properties (static route)
router.get('/available', authenticateToken, getAvailableProperties);

// Get available properties with units (static route)
router.get(
  '/tenant/available',
  authenticateToken,
  authorizeRoles('tenant', 'landlord', 'admin'),
  getAvailablePropertiesWithUnits
);

// Get landlord's own properties (static route)
router.get(
  '/my-properties',
  authenticateToken,
  authorizeRoles('landlord'),
  getMyProperties
);

// Create property (static route)
router.post(
  '/',
  authenticateToken,
  authorizeRoles('landlord'),
  validatePropertyCreation,
  createProperty
);

// Get available units for a property (dynamic route)
router.get(
  '/:propertyId/units/available',
  authenticateToken,
  authorizeRoles('tenant', 'landlord', 'admin'),
  getAvailableUnitsByProperty
);

// Toggle property availability (dynamic route)
router.put(
  '/:propertyId/toggle-availability',
  authenticateToken,
  authorizeRoles('landlord'),
  toggleAvailability
);

// Get property units (dynamic route)
router.get(
  '/:propertyId/units',
  authenticateToken,
  authorizeRoles('landlord'),
  getPropertyUnits
);

// Create unit (dynamic route)
router.post(
  '/:propertyId/units',
  authenticateToken,
  authorizeRoles('landlord'),
  createUnit
);

// Update unit (dynamic route)
router.put(
  '/units/:unitId',
  authenticateToken,
  authorizeRoles('landlord'),
  updateUnit
);

// Get single property (dynamic route - MUST be last among GET /:propertyId routes)
router.get('/:propertyId', authenticateToken, getPropertyById);

// Update property (dynamic route)
router.put(
  '/:propertyId',
  authenticateToken,
  authorizeRoles('landlord'),
  updateProperty
);

// Delete property (dynamic route)
router.delete(
  '/:propertyId',
  authenticateToken,
  authorizeRoles('landlord'),
  deleteProperty
);

module.exports = router;