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

// Run idempotent DB migrations at startup
(async () => {
  try {
    await pool.query(`
      ALTER TABLE properties ADD COLUMN IF NOT EXISTS location_details JSONB DEFAULT '{}'::jsonb
    `);
    console.log('✅ DB: location_details column ready');
  } catch (err) {
    console.warn('⚠️ DB migration warning:', err.message);
  }

  // Add landlord bank details column
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_details JSONB DEFAULT NULL`);
    console.log('✅ DB: bank_details column ready');
  } catch (err) {
    console.warn('⚠️ DB bank_details warning:', err.message);
  }

  // Add email verification columns
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMPTZ`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT`);
    console.log('✅ DB: auth columns ready');
  } catch (err) {
    console.warn('⚠️ DB auth column warning:', err.message);
  }

  // Fix check_property_availability trigger to check per-unit, not per-property.
  // The old trigger blocked approving multiple bookings for different units in the same property.
  try {
    await pool.query(`
      CREATE OR REPLACE FUNCTION check_property_availability()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.booking_status = 'approved' AND (OLD.booking_status IS DISTINCT FROM 'approved') THEN
          IF NEW.unit_id IS NOT NULL THEN
            IF EXISTS (
              SELECT 1 FROM bookings
              WHERE unit_id = NEW.unit_id
                AND booking_status = 'approved'
                AND booking_id != NEW.booking_id
            ) THEN
              RAISE EXCEPTION 'Unit already has an approved booking';
            END IF;
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ DB: check_property_availability trigger updated to unit-level');
  } catch (err) {
    console.warn('⚠️ DB trigger update warning:', err.message);
  }
})();

// Start server
app.listen(PORT, () => {
  console.log(`🎯 Kwetupay Server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
});