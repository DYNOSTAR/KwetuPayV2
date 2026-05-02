const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

/**
 * Authentication middleware - verifies JWT token
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Access token required'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const userResult = await query(
      'SELECT user_id, email, first_name, last_name, role, phone_number FROM users WHERE user_id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'User not found'
      });
    }
    req.user = userResult.rows[0];
    next();
  } catch (error) {
    return res.status(403).json({
      status: 'error',
      message: 'Invalid or expired token'
    });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Insufficient permissions'
      });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRoles
};