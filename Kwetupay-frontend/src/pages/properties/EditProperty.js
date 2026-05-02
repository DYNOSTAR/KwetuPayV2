import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PropertiesLayout from './PropertiesLayout';
import { propertyAPI } from '../../services/api';
import './Properties.css';

const EditProperty = () => {
  const [user, setUser] = useState(null);
  const [property, setProperty] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    property_type: 'apartment',
    rent_amount: '',
    currency: 'KES',
    bedrooms: '',
    bathrooms: '',
    area_sqft: '',
    address: '',
    city: '',
    neighborhood: '',
    latitude: '',
    longitude: '',
    amenities: {
      wifi: false,
      parking: false,
      water: false,
      electricity: false,
      security: false,
      furnished: false,
      gym: false,
      pool: false,
      garden: false,
      balcony: false
    }
  });
  const [units, setUnits] = useState([]);
  const [isMultiUnit, setIsMultiUnit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const navigate = useNavigate();
  const { propertyId } = useParams();

  const multiUnitPropertyTypes = ['apartment', 'commercial'];
  const shouldShowMultiUnit = multiUnitPropertyTypes.includes(formData.property_type);

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      fetchProperty();
    } else {
      navigate('/login');
    }
  }, [propertyId, navigate]);

  const fetchProperty = async () => {
    try {
      setFetchLoading(true);
      const response = await propertyAPI.getById(propertyId);
      
      if (response.data.status === 'success') {
        const propertyData = response.data.data.property;
        setProperty(propertyData);
        
        // Check if property has units and set multi-unit mode accordingly
        const hasUnits = propertyData.units && propertyData.units.length > 0;
        const shouldBeMultiUnit = hasUnits || multiUnitPropertyTypes.includes(propertyData.property_type);
        
        setIsMultiUnit(shouldBeMultiUnit);
        
        // Pre-fill form with existing data
        setFormData({
          title: propertyData.title || '',
          description: propertyData.description || '',
          property_type: propertyData.property_type || 'apartment',
          rent_amount: propertyData.rent_amount || '',
          currency: propertyData.currency || 'KES',
          bedrooms: propertyData.bedrooms || '',
          bathrooms: propertyData.bathrooms || '',
          area_sqft: propertyData.area_sqft || '',
          address: propertyData.address || '',
          city: propertyData.city || '',
          neighborhood: propertyData.neighborhood || '',
          latitude: propertyData.latitude || '',
          longitude: propertyData.longitude || '',
          amenities: propertyData.amenities || {
            wifi: false, parking: false, water: false,
            electricity: false, security: false, furnished: false,
            gym: false, pool: false, garden: false, balcony: false
          }
        });

        // Set units if they exist
        if (propertyData.units && propertyData.units.length > 0) {
          setUnits(propertyData.units);
        }
      } else {
        setError('Failed to load property details');
      }
    } catch (error) {
      console.error('Error fetching property:', error);
      setError('Failed to load property details');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('amenities.')) {
      const amenityName = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        amenities: {
          ...prev.amenities,
          [amenityName]: checked
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value
      }));
    }

    if (name === 'property_type') {
      const newIsMultiUnit = multiUnitPropertyTypes.includes(value);
      setIsMultiUnit(newIsMultiUnit);
      if (!newIsMultiUnit) {
        setUnits([]);
      }
    }
  };

  // Unit Management Functions
  const addUnit = () => {
    const newUnit = {
      unit_number: `UNIT-${units.length + 1}`,
      unit_type: formData.property_type,
      rent_amount: formData.rent_amount || '',
      specifications: {
        bedrooms: formData.bedrooms || '',
        bathrooms: formData.bathrooms || '',
        area_sqft: formData.area_sqft || '',
        amenities: { ...formData.amenities }
      }
    };
    setUnits(prev => [...prev, newUnit]);
  };

  const removeUnit = (index) => {
    setUnits(prev => prev.filter((_, i) => i !== index));
  };

  const updateUnit = (index, field, value) => {
    setUnits(prev => prev.map((unit, i) => {
      if (i === index) {
        if (field.startsWith('specifications.')) {
          const specField = field.split('.')[1];
          return {
            ...unit,
            specifications: {
              ...unit.specifications,
              [specField]: value
            }
          };
        }
        if (field.startsWith('amenities.')) {
          const amenityField = field.split('.')[1];
          return {
            ...unit,
            specifications: {
              ...unit.specifications,
              amenities: {
                ...unit.specifications.amenities,
                [amenityField]: value
              }
            }
          };
        }
        return { ...unit, [field]: value };
      }
      return unit;
    }));
  };

  const nextStep = () => {
    setCurrentStep(prev => prev + 1);
    window.scrollTo(0, 0);
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
    window.scrollTo(0, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.title || !formData.rent_amount || !formData.address || !formData.city) {
      setError('Please fill in all required fields (Title, Rent Amount, Address, City)');
      setLoading(false);
      return;
    }

    if (formData.rent_amount <= 0) {
      setError('Rent amount must be greater than 0');
      setLoading(false);
      return;
    }

    // Validate units if multi-unit is enabled
    if (isMultiUnit && units.length > 0) {
      for (const unit of units) {
        if (!unit.unit_number || !unit.rent_amount) {
          setError('All units must have a unit number and rent amount');
          setLoading(false);
          return;
        }
        if (unit.rent_amount <= 0) {
          setError('Unit rent amount must be greater than 0');
          setLoading(false);
          return;
        }
      }

      const unitNumbers = units.map(u => u.unit_number);
      const uniqueUnitNumbers = new Set(unitNumbers);
      if (unitNumbers.length !== uniqueUnitNumbers.size) {
        setError('Unit numbers must be unique');
        setLoading(false);
        return;
      }
    }

    try {
      const submitData = {
        ...formData,
        bedrooms: formData.bedrooms || null,
        bathrooms: formData.bathrooms || null,
        area_sqft: formData.area_sqft || null,
        neighborhood: formData.neighborhood || '',
        latitude: formData.latitude || null,
        longitude: formData.longitude || null,
        description: formData.description || '',
        rent_amount: parseFloat(formData.rent_amount),
        amenities: formData.amenities || {},
        units: isMultiUnit ? units : []
      };

      ['bedrooms', 'bathrooms', 'area_sqft', 'latitude', 'longitude'].forEach((key) => {
        if (submitData[key] === '') submitData[key] = null;
      });

      const response = await propertyAPI.update(propertyId, submitData);

      if (response.data.status === 'success') {
        const message = isMultiUnit && units.length > 0 
          ? `Property updated successfully with ${units.length} units!` 
          : 'Property updated successfully!';
        
        alert(message);
        navigate('/properties');
      } else {
        setError(response.data.message || 'Failed to update property');
      }
    } catch (error) {
      console.error('Update property error:', error);
      const errorMessage = error.response?.data?.message || 'Network error. Please try again.';
      setError(`Error: ${errorMessage}`);
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

  // Step 1: Basic Information
  const renderStep1 = () => (
    <div className="form-section">
      <div className="section-header">
        <div className="step-indicator">Step 1 of 3</div>
        <h3>🏠 Basic Information</h3>
        <p>Update your property information</p>
      </div>
      
      <div className="form-group">
        <label className="required">Property Title</label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder="e.g., Beautiful 2-bedroom apartment in Westlands"
          required
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label>Description</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Describe your property... (features, location advantages, nearby amenities, etc.)"
          rows="4"
          className="form-textarea"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="required">Property Type</label>
          <select
            name="property_type"
            value={formData.property_type}
            onChange={handleChange}
            required
            className="form-select"
          >
            <option value="apartment">Apartment Building</option>
            <option value="house">House</option>
            <option value="studio">Studio</option>
            <option value="commercial">Commercial Building</option>
            <option value="plot">Plot</option>
          </select>
        </div>

        <div className="form-group">
          <label className="required">Monthly Rent (KES)</label>
          <div className="input-with-currency">
            <span className="currency-symbol">KES</span>
            <input
              type="number"
              name="rent_amount"
              value={formData.rent_amount}
              onChange={handleChange}
              placeholder="15000"
              min="1"
              required
              className="form-input with-currency"
            />
          </div>
        </div>
      </div>

      {/* Multi-Unit Toggle */}
      {shouldShowMultiUnit && (
        <div className="toggle-section">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={isMultiUnit}
              onChange={(e) => setIsMultiUnit(e.target.checked)}
              className="toggle-input"
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">This property has multiple units</span>
          </label>
          <div className="toggle-description">
            {isMultiUnit 
              ? `You can manage ${units.length} units with their own rent and specifications in the next step.`
              : 'A single unit will be used for this property.'
            }
          </div>
        </div>
      )}
    </div>
  );

  // Step 2: Property Details & Units
  const renderStep2 = () => (
    <div className="form-section">
      <div className="section-header">
        <div className="step-indicator">Step 2 of 3</div>
        <h3>📊 Property Details</h3>
        <p>Update property specifications and units</p>
      </div>

      {/* Property Details for Single Units */}
      {!isMultiUnit && (
        <div className="details-section">
          <h4>Property Specifications</h4>
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
                className="form-input"
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
                className="form-input"
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
                className="form-input"
              />
            </div>
          </div>
        </div>
      )}

      {/* Unit Management for Multi-Unit Properties */}
      {isMultiUnit && (
        <div className="units-section">
          <div className="units-header">
            <h4>🏘️ Property Units</h4>
            <p>Manage individual units for your property. Each unit can have different specifications and rent.</p>
            <button type="button" onClick={addUnit} className="add-unit-btn">
              ➕ Add New Unit
            </button>
          </div>

          {units.length === 0 ? (
            <div className="no-units-message">
              <div className="empty-state-icon">🏠</div>
              <p>No units added yet</p>
              <p className="empty-state-description">Click "Add New Unit" to create your first unit</p>
            </div>
          ) : (
            <div className="units-list">
              {units.map((unit, index) => (
                <div key={index} className="unit-card">
                  <div className="unit-header">
                    <div className="unit-title">
                      <h5>Unit {index + 1}</h5>
                      <span className="unit-number-badge">{unit.unit_number}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => removeUnit(index)}
                      className="remove-unit-btn"
                      title="Remove unit"
                    >
                      🗑️
                    </button>
                  </div>
                  
                  <div className="unit-form">
                    <div className="form-row triple">
                      <div className="form-group">
                        <label className="required">Unit Number</label>
                        <input
                          type="text"
                          value={unit.unit_number}
                          onChange={(e) => updateUnit(index, 'unit_number', e.target.value)}
                          placeholder="e.g., A1, 101, Ground Floor"
                          required
                          className="form-input"
                        />
                      </div>

                      <div className="form-group">
                        <label>Unit Type</label>
                        <select
                          value={unit.unit_type}
                          onChange={(e) => updateUnit(index, 'unit_type', e.target.value)}
                          className="form-select"
                        >
                          <option value="apartment">Apartment</option>
                          <option value="shop">Shop</option>
                          <option value="office">Office</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="required">Monthly Rent (KES)</label>
                        <div className="input-with-currency">
                          <span className="currency-symbol">KES</span>
                          <input
                            type="number"
                            value={unit.rent_amount}
                            onChange={(e) => updateUnit(index, 'rent_amount', e.target.value)}
                            placeholder="15000"
                            min="1"
                            required
                            className="form-input with-currency"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-row triple">
                      <div className="form-group">
                        <label>Bedrooms</label>
                        <input
                          type="number"
                          value={unit.specifications?.bedrooms || ''}
                          onChange={(e) => updateUnit(index, 'specifications.bedrooms', e.target.value)}
                          placeholder="2"
                          min="0"
                          className="form-input"
                        />
                      </div>

                      <div className="form-group">
                        <label>Bathrooms</label>
                        <input
                          type="number"
                          value={unit.specifications?.bathrooms || ''}
                          onChange={(e) => updateUnit(index, 'specifications.bathrooms', e.target.value)}
                          placeholder="1"
                          min="0"
                          className="form-input"
                        />
                      </div>

                      <div className="form-group">
                        <label>Area (sqft)</label>
                        <input
                          type="number"
                          value={unit.specifications?.area_sqft || ''}
                          onChange={(e) => updateUnit(index, 'specifications.area_sqft', e.target.value)}
                          placeholder="800"
                          min="0"
                          className="form-input"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Step 3: Location & Amenities
  const renderStep3 = () => (
    <div className="form-section">
      <div className="section-header">
        <div className="step-indicator">Step 3 of 3</div>
        <h3>📍 Location & Amenities</h3>
        <p>Update location and amenities for your property</p>
      </div>

      <div className="location-section">
        <h4>Location Details</h4>
        <div className="form-group">
          <label className="required">Full Address</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="e.g., 123 Main Street, Westlands"
            required
            className="form-input"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="required">City</label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              placeholder="e.g., Nairobi"
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Neighborhood/Area</label>
            <input
              type="text"
              name="neighborhood"
              value={formData.neighborhood}
              onChange={handleChange}
              placeholder="e.g., Westlands, Kilimani"
              className="form-input"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Latitude</label>
            <input
              type="number"
              name="latitude"
              value={formData.latitude}
              onChange={handleChange}
              placeholder="e.g., -1.2921"
              step="any"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Longitude</label>
            <input
              type="number"
              name="longitude"
              value={formData.longitude}
              onChange={handleChange}
              placeholder="e.g., 36.8219"
              step="any"
              className="form-input"
            />
          </div>
        </div>
      </div>

      <div className="amenities-section">
        <h4>🏋️ Amenities & Features</h4>
        <p>Update amenities available in your property</p>
        <div className="amenities-grid">
          {Object.entries(formData.amenities).map(([key, value]) => (
            <label key={key} className="amenity-checkbox">
              <input
                type="checkbox"
                name={`amenities.${key}`}
                checked={value}
                onChange={handleChange}
                className="amenity-input"
              />
              <span className="amenity-custom-checkbox"></span>
              <span className="amenity-label">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  if (!user || fetchLoading) {
    return (
      <div className="properties-page">
        <div className="loading-section">
          <div className="loading-spinner"></div>
          <p>Loading property details...</p>
        </div>
      </div>
    );
  }

  const editPropertyContent = (
    <div className="create-property-page">
      <div className="create-property-container">
        {/* Progress Bar */}
        <div className="progress-bar">
          <div className="progress-step" data-active={currentStep >= 1}>
            <div className="step-number">1</div>
            <span className="step-label">Basic Info</span>
          </div>
          <div className="progress-connector" data-active={currentStep >= 2}></div>
          <div className="progress-step" data-active={currentStep >= 2}>
            <div className="step-number">2</div>
            <span className="step-label">Details</span>
          </div>
          <div className="progress-connector" data-active={currentStep >= 3}></div>
          <div className="progress-step" data-active={currentStep >= 3}>
            <div className="step-number">3</div>
            <span className="step-label">Location</span>
          </div>
        </div>

        {/* Page Header */}
        <div className="page-header">
          <div className="header-content">
            <h1>✏️ Edit Property</h1>
            <p>Update your property information and units</p>
          </div>
        </div>

        {error && (
          <div className="error-banner">
            <div className="error-content">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="close-error">&times;</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="create-property-form">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}

          {/* Navigation Buttons */}
          <div className="form-navigation">
            <div className="nav-buttons">
              {currentStep > 1 && (
                <button type="button" onClick={prevStep} className="nav-btn prev-btn">
                  ← Previous
                </button>
              )}
              
              <div className="right-buttons">
                <button type="button" onClick={handleCancel} className="nav-btn cancel-btn">
                  Cancel
                </button>
                
                {currentStep < 3 ? (
                  <button type="button" onClick={nextStep} className="nav-btn next-btn">
                    Next →
                  </button>
                ) : (
                  <button type="submit" disabled={loading} className="nav-btn submit-btn">
                    {loading ? (
                      <>
                        <div className="loading-spinner-small"></div>
                        Updating...
                      </>
                    ) : (
                      'Update Property'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <PropertiesLayout user={user} onLogout={handleLogout}>
      {editPropertyContent}
    </PropertiesLayout>
  );
};

export default EditProperty;