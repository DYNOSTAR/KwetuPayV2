const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { pool } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Safe route loader
const safeRequire = (name, path) => {
  try {
    return require(path);
  } catch (error) {
    console.warn(`⚠️ Could not load ${name} routes:`, error.message);
    const { Router } = require('express');
    const router = Router();
    return router;
  }
};

// Use routes
app.use('/api/auth', safeRequire('auth', './routes/auth'));
app.use('/api/users', safeRequire('users', './routes/users'));
app.use('/api/properties', safeRequire('properties', './routes/properties'));
app.use('/api/bookings', safeRequire('bookings', './routes/bookings'));
app.use('/api/tenants', safeRequire('tenants', './routes/tenants'));
app.use('/api/messages', safeRequire('messages', './routes/messages'));
app.use('/api/leases', safeRequire('leases', './routes/leases'));
app.use('/api/payments', safeRequire('payments', './routes/payments'));
app.use('/api/maintenance', safeRequire('maintenance', './routes/maintenance'));
app.use('/api/units', safeRequire('units', './routes/units'));
app.use('/api/admin', safeRequire('admin', './routes/admin'));

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT NOW()');
    res.json({
      status: 'success',
      message: '🚀 Kwetupay API is running!',
      timestamp: new Date().toISOString(),
      database: 'Connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed'
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('🔥 Error:', err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong!'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎯 Kwetupay Server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
});