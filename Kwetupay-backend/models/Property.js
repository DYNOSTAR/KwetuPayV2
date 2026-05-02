const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  public_id: {
    type: String,
    required: true
  },
  isPrimary: {
    type: Boolean,
    default: false
  }
});

const unitSchema = new mongoose.Schema({
  unit_number: {
    type: String,
    required: true
  },
  unit_type: {
    type: String,
    enum: ['apartment', 'shop', 'office', 'other'],
    default: 'apartment'
  },
  rent_amount: {
    type: Number,
    required: true
  },
  specifications: {
    bedrooms: Number,
    bathrooms: Number,
    area_sqft: Number,
    amenities: {
      wifi: { type: Boolean, default: false },
      parking: { type: Boolean, default: false },
      water: { type: Boolean, default: false },
      electricity: { type: Boolean, default: false },
      security: { type: Boolean, default: false },
      furnished: { type: Boolean, default: false }
    }
  },
  status: {
    type: String,
    enum: ['available', 'occupied', 'maintenance'],
    default: 'available'
  }
}, { timestamps: true });

const propertySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  property_type: {
    type: String,
    enum: ['apartment', 'house', 'studio', 'commercial', 'plot'],
    required: true
  },
  rent_amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'KES'
  },
  bedrooms: Number,
  bathrooms: Number,
  area_sqft: Number,
  address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  neighborhood: String,
  latitude: Number,
  longitude: Number,
  amenities: {
    wifi: { type: Boolean, default: false },
    parking: { type: Boolean, default: false },
    water: { type: Boolean, default: false },
    electricity: { type: Boolean, default: false },
    security: { type: Boolean, default: false },
    furnished: { type: Boolean, default: false },
    gym: { type: Boolean, default: false },
    pool: { type: Boolean, default: false },
    garden: { type: Boolean, default: false },
    balcony: { type: Boolean, default: false }
  },
  images: [imageSchema],
  units: [unitSchema],
  landlord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['available', 'occupied', 'unavailable'],
    default: 'available'
  }
}, { timestamps: true });

module.exports = mongoose.model('Property', propertySchema);