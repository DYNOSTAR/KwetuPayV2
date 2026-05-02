const Admin = require('../models/Admin');

const adminAuth = async (req, res, next) => {
  try {
    // Check if user is admin (you can modify this based on your user model)
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin privileges required.'
      });
    }
    next();
  } catch (error) {
    res.status(401).json({
      status: 'error',
      message: 'Not authorized to access this resource'
    });
  }
};

module.exports = { adminAuth };