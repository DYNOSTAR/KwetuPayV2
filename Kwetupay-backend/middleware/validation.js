const validateUserRegistration = (req, res, next) => {
  const { first_name, last_name, email, phone_number, password, role } = req.body;

  if (!first_name || !last_name || !email || !phone_number || !password || !role) {
    return res.status(400).json({
      status: 'error',
      message: 'All fields are required'
    });
  }

  if (!['landlord', 'tenant'].includes(role)) {
    return res.status(400).json({
      status: 'error',
      message: 'Role must be either "landlord" or "tenant"'
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      status: 'error',
      message: 'Password must be at least 6 characters long'
    });
  }

  next();
};

const validatePropertyCreation = (req, res, next) => {
  const { title, description, property_type, rent_amount, address, city } = req.body;

  if (!title || !property_type || !rent_amount || !address || !city) {
    return res.status(400).json({
      status: 'error',
      message: 'Title, property type, rent amount, address, and city are required'
    });
  }

  if (Number(rent_amount) <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Rent amount must be positive'
    });
  }

  next();
};

const validateBookingCreation = (req, res, next) => {
  const { property_id, start_date, end_date } = req.body;

  if (!property_id || !start_date || !end_date) {
    return res.status(400).json({
      status: 'error',
      message: 'Property ID, start date, and end date are required'
    });
  }

  const startDate = new Date(start_date);
  const endDate = new Date(end_date);
  
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid date format'
    });
  }

  if (startDate >= endDate) {
    return res.status(400).json({
      status: 'error',
      message: 'End date must be after start date'
    });
  }

  if (startDate < new Date()) {
    return res.status(400).json({
      status: 'error',
      message: 'Start date cannot be in the past'
    });
  }

  next();
};

module.exports = {
  validateUserRegistration,
  validatePropertyCreation,
  validateBookingCreation
};