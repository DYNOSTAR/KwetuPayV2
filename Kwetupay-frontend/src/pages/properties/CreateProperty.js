import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertiesLayout from './PropertiesLayout';
import { propertyAPI } from '../../services/api';
import './Properties.css';

const CreateProperty = () => {
  const [user, setUser] = useState(null);
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
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [images, setImages] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [mapLocation, setMapLocation] = useState(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    
    // Initialize Google Maps
    if (window.google) {
      initMap();
    } else {
      // Load Google Maps script if not already loaded
      loadGoogleMapsScript();
    }
  }, []);

  const multiUnitPropertyTypes = ['apartment', 'commercial'];
  const shouldShowMultiUnit = multiUnitPropertyTypes.includes(formData.property_type);

  const loadGoogleMapsScript = () => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = initMap;
    document.head.appendChild(script);
  };

  const initMap = () => {
    // Map will be initialized when needed in step 3
    console.log('Google Maps loaded');
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
      setIsMultiUnit(multiUnitPropertyTypes.includes(value));
      if (!multiUnitPropertyTypes.includes(value)) {
        setUnits([]);
      }
    }
  };

  // Image Upload Functions
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingImages(true);

    try {
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
          setError(`Image ${file.name} is too large. Maximum size is 5MB.`);
          continue;
        }

        if (!file.type.startsWith('image/')) {
          setError(`File ${file.name} is not an image.`);
          continue;
        }

        const formData = new FormData();
        formData.append('image', file);

        const response = await propertyAPI.uploadImage(formData);
        
        if (response.data.status === 'success') {
          setImages(prev => [...prev, {
            url: response.data.data.imageUrl,
            public_id: response.data.data.publicId,
            isPrimary: prev.length === 0 // First image is primary
          }]);
        }
      }
    } catch (error) {
      console.error('Image upload error:', error);
      setError('Failed to upload some images. Please try again.');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    // If we remove the primary image, set the first image as primary
    if (index === 0 && images.length > 1) {
      setImages(prev => prev.map((img, i) => ({ ...img, isPrimary: i === 0 })));
    }
  };

  const setPrimaryImage = (index) => {
    setImages(prev => prev.map((img, i) => ({ 
      ...img, 
      isPrimary: i === index 
    })));
  };

  // Location and Map Functions
  const handleAddressSearch = () => {
    if (!window.google || !formData.address) return;

    const geocoder = new window.google.maps.Geocoder();
    
    geocoder.geocode({ address: formData.address }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const location = results[0].geometry.location;
        setMapLocation({
          lat: location.lat(),
          lng: location.lng()
        });
        
        // Update form data with coordinates
        setFormData(prev => ({
          ...prev,
          latitude: location.lat(),
          longitude: location.lng()
        }));

        // Extract city and neighborhood from address components
        const addressComponents = results[0].address_components;
        let city = '';
        let neighborhood = '';

        addressComponents.forEach(component => {
          if (component.types.includes('locality')) {
            city = component.long_name;
          }
          if (component.types.includes('sublocality') || component.types.includes('neighborhood')) {
            neighborhood = component.long_name;
          }
        });

        if (city && !formData.city) {
          setFormData(prev => ({ ...prev, city }));
        }
        if (neighborhood && !formData.neighborhood) {
          setFormData(prev => ({ ...prev, neighborhood }));
        }

      } else {
        setError('Could not find location. Please check the address and try again.');
      }
    });
  };

  const handleMapClick = (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    
    setMapLocation({ lat, lng });
    setFormData(prev => ({
      ...prev,
      latitude: lat,
      longitude: lng
    }));

    // Reverse geocode to get address
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results[0]) {
        setFormData(prev => ({
          ...prev,
          address: results[0].formatted_address
        }));
      }
    });
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
        return { ...unit, [field]: value };
      }
      return unit;
    }));
  };

  const nextStep = () => {
    // Validate current step before proceeding
    if (currentStep === 1 && (!formData.title || !formData.rent_amount)) {
      setError('Please fill in all required fields in Basic Information');
      return;
    }
    
    if (currentStep === 2 && isMultiUnit && units.length > 0) {
      const invalidUnit = units.find(unit => !unit.unit_number || !unit.rent_amount);
      if (invalidUnit) {
        setError('All units must have a unit number and rent amount');
        return;
      }
    }

    setCurrentStep(prev => prev + 1);
    window.scrollTo(0, 0);
    setError('');
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
    window.scrollTo(0, 0);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
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

    if (images.length === 0) {
      setError('Please upload at least one property image');
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
        units: isMultiUnit ? units : [],
        images: images
      };

      ['bedrooms', 'bathrooms', 'area_sqft', 'latitude', 'longitude'].forEach((key) => {
        if (submitData[key] === '') submitData[key] = null;
      });

      const response = await propertyAPI.create(submitData);

      if (response.data.status === 'success') {
        const message = isMultiUnit && units.length > 0 
          ? `Property created successfully with ${units.length} units!` 
          : 'Property created successfully!';
        
        alert(message);
        navigate('/properties');
      } else {
        setError(response.data.message || 'Failed to create property');
      }
    } catch (error) {
      console.error('Create property error:', error);
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
        <div className="step-indicator">Step 1 of 4</div>
        <h3>🏠 Basic Information</h3>
        <p>Tell us about your property</p>
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
              ? 'You can add individual units with their own rent and specifications in the next step.'
              : 'A single unit will be created automatically for this property.'
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
        <div className="step-indicator">Step 2 of 4</div>
        <h3>📊 Property Details</h3>
        <p>Add property specifications and units</p>
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
            <p>Add individual units for your property. Each unit can have different specifications and rent.</p>
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
                          value={unit.specifications.bedrooms || ''}
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
                          value={unit.specifications.bathrooms || ''}
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
                          value={unit.specifications.area_sqft || ''}
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

  // Step 3: Images
  const renderStep3 = () => (
    <div className="form-section">
      <div className="section-header">
        <div className="step-indicator">Step 3 of 4</div>
        <h3>📸 Property Images</h3>
        <p>Upload photos of your property</p>
      </div>

      <div className="images-section">
        <div className="upload-area">
          <input
            type="file"
            id="property-images"
            multiple
            accept="image/*"
            onChange={handleImageUpload}
            className="file-input"
            disabled={uploadingImages}
          />
          <label htmlFor="property-images" className="upload-label">
            <div className="upload-icon">📷</div>
            <div className="upload-text">
              <h4>Upload Property Images</h4>
              <p>Click to browse or drag and drop</p>
              <p className="upload-hint">Supports JPG, PNG, WEBP • Max 5MB per image</p>
            </div>
          </label>
        </div>

        {uploadingImages && (
          <div className="uploading-overlay">
            <div className="loading-spinner"></div>
            <p>Uploading images...</p>
          </div>
        )}

        {images.length > 0 && (
          <div className="images-preview">
            <h4>Uploaded Images ({images.length})</h4>
            <p className="images-hint">First image will be used as the main property photo</p>
            
            <div className="images-grid">
              {images.map((image, index) => (
                <div key={index} className={`image-card ${image.isPrimary ? 'primary' : ''}`}>
                  <img src={image.url} alt={`Property ${index + 1}`} />
                  <div className="image-actions">
                    {image.isPrimary ? (
                      <span className="primary-badge">Primary</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPrimaryImage(index)}
                        className="set-primary-btn"
                      >
                        Set Primary
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="remove-image-btn"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Step 4: Location & Amenities
  const renderStep4 = () => (
    <div className="form-section">
      <div className="section-header">
        <div className="step-indicator">Step 4 of 4</div>
        <h3>📍 Location & Amenities</h3>
        <p>Where is your property and what does it offer?</p>
      </div>

      <div className="location-section">
        <h4>Location Details</h4>
        
        <div className="form-group">
          <label className="required">Full Address</label>
          <div className="address-search">
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="e.g., 123 Main Street, Westlands"
              required
              className="form-input"
            />
            <button 
              type="button" 
              onClick={handleAddressSearch}
              className="search-location-btn"
              disabled={!formData.address}
            >
              🔍
            </button>
          </div>
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

        {/* Google Maps Integration */}
        <div className="map-section">
          <h5>📍 Property Location on Map</h5>
          <p>Click on the map to set the exact location or use the address search above</p>
          
          <div className="map-container">
            {window.google ? (
              <div 
                id="property-map"
                style={{ height: '300px', width: '100%', borderRadius: '8px' }}
                ref={(mapElement) => {
                  if (mapElement && window.google) {
                    const map = new window.google.maps.Map(mapElement, {
                      center: mapLocation || { lat: -1.2921, lng: 36.8219 }, // Nairobi coordinates
                      zoom: 12,
                    });

                    let marker = mapLocation ? new window.google.maps.Marker({
                      position: mapLocation,
                      map: map,
                      draggable: true
                    }) : null;

                    map.addListener('click', (event) => {
                      handleMapClick(event);
                      
                      if (marker) {
                        marker.setMap(null);
                      }
                      
                      marker = new window.google.maps.Marker({
                        position: event.latLng,
                        map: map,
                        draggable: true
                      });
                    });

                    if (marker) {
                      marker.addListener('dragend', (event) => {
                        const lat = event.latLng.lat();
                        const lng = event.latLng.lng();
                        setMapLocation({ lat, lng });
                        setFormData(prev => ({
                          ...prev,
                          latitude: lat,
                          longitude: lng
                        }));
                      });
                    }
                  }
                }}
              />
            ) : (
              <div className="map-loading">
                <div className="loading-spinner"></div>
                <p>Loading map...</p>
              </div>
            )}
          </div>

          <div className="coordinates-display">
            <div className="coordinate">
              <label>Latitude:</label>
              <span>{formData.latitude || 'Not set'}</span>
            </div>
            <div className="coordinate">
              <label>Longitude:</label>
              <span>{formData.longitude || 'Not set'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="amenities-section">
        <h4>🏋️ Amenities & Features</h4>
        <p>Select all amenities available in your property</p>
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

  const createPropertyContent = (
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
            <span className="step-label">Images</span>
          </div>
          <div className="progress-connector" data-active={currentStep >= 4}></div>
          <div className="progress-step" data-active={currentStep >= 4}>
            <div className="step-number">4</div>
            <span className="step-label">Location</span>
          </div>
        </div>

        {/* Page Header */}
        <div className="page-header">
          <div className="header-content">
            <h1>➕ Add New Property</h1>
            <p>Fill in the details to list your property for rent</p>
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
          {currentStep === 4 && renderStep4()}

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
                
                {currentStep < 4 ? (
                  <button type="button" onClick={nextStep} className="nav-btn next-btn">
                    Next →
                  </button>
                ) : (
                  <button type="submit" disabled={loading} className="nav-btn submit-btn">
                    {loading ? (
                      <>
                        <div className="loading-spinner-small"></div>
                        Creating...
                      </>
                    ) : (
                      'Create Property'
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

  if (!user) {
    return (
      <div className="loading-fullscreen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <PropertiesLayout user={user} onLogout={handleLogout}>
      {createPropertyContent}
    </PropertiesLayout>
  );
};

export default CreateProperty;