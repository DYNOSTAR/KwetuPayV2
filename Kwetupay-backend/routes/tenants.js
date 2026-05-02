const express = require('express');
const { 
  getLandlordTenants, 
  getTenantStatistics, 
  getTenantDetails 
} = require('../controllers/tenantController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Landlord-only routes
router.get('/landlord/tenants', authenticateToken, authorizeRoles('landlord'), getLandlordTenants);
router.get('/landlord/statistics', authenticateToken, authorizeRoles('landlord'), getTenantStatistics);
router.get('/landlord/tenants/:tenantId', authenticateToken, authorizeRoles('landlord'), getTenantDetails);

module.exports = router;