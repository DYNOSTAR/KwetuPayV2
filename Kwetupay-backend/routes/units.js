const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unitController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Get all units for a property
router.get('/property/:propertyId', unitController.getPropertyUnits);

// Create a new unit (landlords only)
router.post('/property/:propertyId', authorizeRoles('landlord'), unitController.createUnit);

// Update a unit (landlords only)
router.patch('/:unitId', authorizeRoles('landlord'), unitController.updateUnit);

// Delete a unit (landlords only)
router.delete('/:unitId', authorizeRoles('landlord'), unitController.deleteUnit);

module.exports = router;