import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PropertiesLayout from './PropertiesLayout';
import { propertyAPI } from '../../services/api';
import './Properties.css';

const AddUnit = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { propertyId } = useParams();

  const [formData, setFormData] = useState({
    unit_number: '',
    unit_type: 'apartment',
    rent_amount: '',
    bedrooms: '',
    bathrooms: '',
    area_sqft: '',
    specifications: {
      floor: '',
      facing: ''
    },
    amenities: {
      wifi: false,
      parking: false,
      furnished: false
    }
  });

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('specifications.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        specifications: {
          ...prev.specifications,
          [field]: value
        }
      }));
    } else if (name.startsWith('amenities.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        amenities: {
          ...prev.amenities,
          [field]: checked
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Basic validation
    if (!formData.unit_number || !formData.rent_amount) {
      setError('Unit number and rent amount are required');
      setLoading(false);
      return;
    }

    try {
      await propertyAPI.createUnit(propertyId, formData);
      alert('Unit created successfully!');
      navigate(`/properties`);
    } catch (error) {
      console.error('Error creating unit:', error);
      setError(error.response?.data?.message || 'Failed to create unit');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/properties');
  };

  const handleLogout = () => {
    localStorage.removeItem('kwetupay_token');
    localStorage.removeItem('kwetupay_user');
    navigate('/login');
  };

  const content = (
    <div className="create-property-page">
      <div className="create-property-content">
        <div className="properties-page-header">
          <img src="/images/logo.png" alt="Kwetupay Logo" className="properties-page-header-logo" />
          <div className="properties-page-header-content">
            <h1>➕ Add New Unit</h1>
            <p>Add a new unit to your property</p>
          </div>
        </div>

        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError('')} className="close-error">&times;</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="create-property-form">
          <div className="form-section">
            <h3>Unit Information</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Unit Number *</label>
                <input
                  type="text"
                  name="unit_number"
                  value={formData.unit_number}
                  onChange={handleChange}
                  placeholder="e.g., A1, 101, Ground Floor"
                  required
                />
              </div>

              <div className="form-group">
                <label>Unit Type *</label>
                <select
                  name="unit_type"
                  value={formData.unit_type}
                  onChange={handleChange}
                  required
                >
                  <option value="apartment">Apartment</option>
                  <option value="studio">Studio</option>
                  <option value="shop">Shop</option>
                  <option value="office">Office</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Monthly Rent (KES) *</label>
              <input
                type="number"
                name="rent_amount"
                value={formData.rent_amount}
                onChange={handleChange}
                placeholder="15000"
                min="1"
                required
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Unit Specifications</h3>
            
            <div className="form-row triple">
              <div className="form-group">
                <label>Bedrooms</label>
                <input
                  type="number"
                  name="bedrooms"
                  value={formData.bedrooms}
                  onChange={handleChange}
                  placeholder="2"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label>Bathrooms</label>
                <input
                  type="number"
                  name="bathrooms"
                  value={formData.bathrooms}
                  onChange={handleChange}
                  placeholder="1"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label>Area (sqft)</label>
                <input
                  type="number"
                  name="area_sqft"
                  value={formData.area_sqft}
                  onChange={handleChange}
                  placeholder="800"
                  min="0"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Floor</label>
                <input
                  type="text"
                  name="specifications.floor"
                  value={formData.specifications.floor}
                  onChange={handleChange}
                  placeholder="e.g., 2nd Floor, Ground Floor"
                />
              </div>

              <div className="form-group">
                <label>Facing Direction</label>
                <input
                  type="text"
                  name="specifications.facing"
                  value={formData.specifications.facing}
                  onChange={handleChange}
                  placeholder="e.g., North, South, Pool View"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Amenities</h3>
            <div className="amenities-grid">
              <label className="amenity-checkbox">
                <input
                  type="checkbox"
                  name="amenities.wifi"
                  checked={formData.amenities.wifi}
                  onChange={handleChange}
                />
                <span>WiFi</span>
              </label>
              <label className="amenity-checkbox">
                <input
                  type="checkbox"
                  name="amenities.parking"
                  checked={formData.amenities.parking}
                  onChange={handleChange}
                />
                <span>Parking</span>
              </label>
              <label className="amenity-checkbox">
                <input
                  type="checkbox"
                  name="amenities.furnished"
                  checked={formData.amenities.furnished}
                  onChange={handleChange}
                />
                <span>Furnished</span>
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={handleCancel} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Creating Unit...' : 'Create Unit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <PropertiesLayout user={user} onLogout={handleLogout}>
      {content}
    </PropertiesLayout>
  );
};

export default AddUnit;