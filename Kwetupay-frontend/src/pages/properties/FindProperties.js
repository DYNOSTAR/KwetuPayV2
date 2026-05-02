import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertiesLayout from './PropertiesLayout';
import { propertyAPI, messageAPI, bookingAPI } from '../../services/api';
import './FindProperties.css';

const FindProperties = () => {
  const [user, setUser] = useState(null);
  const [properties, setProperties] = useState([]);
  const [selectedPropertyUnits, setSelectedPropertyUnits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingLoading, setBookingLoading] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [filters, setFilters] = useState({
    city: '',
    minPrice: '',
    maxPrice: '',
    propertyType: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      fetchAvailableProperties();
    } else {
      navigate('/login');
    }
  }, [navigate]);

  // NEW: Fetch properties with their available units
  const fetchAvailableProperties = async (filterParams = {}) => {
    try {
      setLoading(true);
      setError('');
      
      const apiFilters = {};
      if (filterParams.city) apiFilters.city = filterParams.city;
      if (filterParams.minPrice) apiFilters.min_price = filterParams.minPrice;
      if (filterParams.maxPrice) apiFilters.max_price = filterParams.maxPrice;
      if (filterParams.propertyType) apiFilters.property_type = filterParams.propertyType;

      // Use the new endpoint that includes units
      const response = await propertyAPI.getAvailableWithUnits(apiFilters);
      
      if (response.data.status === 'success') {
        setProperties(response.data.data.properties || []);
      } else {
        setError('Failed to load properties');
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
      setError('Failed to load available properties. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // NEW: Fetch detailed units for a specific property
  const fetchPropertyUnits = async (propertyId) => {
    try {
      setUnitsLoading(true);
      setError('');
      
      const response = await propertyAPI.getPropertyUnits(propertyId);
      
      if (response.data.status === 'success') {
        setSelectedPropertyUnits(response.data.data);
      } else {
        setError('Failed to load unit details');
      }
    } catch (error) {
      console.error('Error fetching property units:', error);
      setError('Failed to load unit details. Please try again.');
    } finally {
      setUnitsLoading(false);
    }
  };

  // UPDATED: Book a specific unit instead of the whole property
  const handleBookUnit = async (unit, property) => {
    if (!window.confirm(`Are you sure you want to book Unit ${unit.unit_number} at "${property.title}"?\n\nRent: ${formatPrice(unit.rent_amount)}/month\nLocation: ${property.city}${property.neighborhood ? `, ${property.neighborhood}` : ''}`)) {
      return;
    }

    try {
      setBookingLoading(unit.unit_id);
      setError('');
      setSuccessMessage('');

      // Calculate dates
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);

      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1);

      const formatDateLocal = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const bookingData = {
        unit_id: unit.unit_id,
        start_date: formatDateLocal(startDate),
        end_date: formatDateLocal(endDate),
        total_rent: unit.rent_amount,
        special_terms: `Interested in viewing Unit ${unit.unit_number}. Please contact me to discuss further details.`
      };

      console.log('Booking data:', bookingData);

      const response = await bookingAPI.createBooking(bookingData);
      
      if (response.data.status === 'success') {
        setSuccessMessage(`Booking request submitted for Unit ${unit.unit_number}!`);
        
        // Close units modal and refresh properties to update availability
        setSelectedPropertyUnits(null);
        fetchAvailableProperties(filters);
        
        // Notify landlord
        (async () => {
          try {
            const tenantName = user?.name || user?.email || 'A tenant';
            const messageContent = `${tenantName} has submitted a booking request for Unit ${unit.unit_number} at "${property.title}" from ${bookingData.start_date} to ${bookingData.end_date}. Please review the booking.`;
            await messageAPI.send({
              recipient_id: property.landlord_id,
              property_id: property.property_id,
              content: messageContent,
            });
          } catch (msgErr) {
            console.error('Failed to notify landlord:', msgErr);
          }
        })();
        
        setTimeout(() => {
          setSuccessMessage('');
        }, 5000);
      } else {
        setError(response.data.message || 'Booking failed. Please try again.');
      }
    } catch (error) {
      console.error('Booking error:', error);
      const errorMessage = error.response?.data?.message || 'Error creating booking. Please try again.';
      setError(errorMessage);
    } finally {
      setBookingLoading(null);
    }
  };

  // NEW: View available units for a property
  const handleViewUnits = async (property) => {
    await fetchPropertyUnits(property.property_id);
  };

  // NEW: Close units modal
  const handleCloseUnits = () => {
    setSelectedPropertyUnits(null);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleApplyFilters = (e) => {
    e.preventDefault();
    fetchAvailableProperties(filters);
  };

  const handleClearFilters = () => {
    setFilters({
      city: '',
      minPrice: '',
      maxPrice: '',
      propertyType: ''
    });
    fetchAvailableProperties();
  };

  const handleViewDetails = (propertyId) => {
    navigate(`/properties/${propertyId}`);
  };

  const handleContactLandlord = (property) => {
    navigate('/messages', { 
      state: { 
        contactUser: {
          id: property.landlord_id,
          name: property.landlord_name,
          role: 'landlord',
          phone: property.landlord_phone
        },
        property: {
          id: property.property_id,
          title: property.title
        }
      }
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('kwetupay_token');
    localStorage.removeItem('kwetupay_user');
    navigate('/login');
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(price);
  };

  const getAmenitiesList = (amenities) => {
    if (!amenities) return [];
    return Object.entries(amenities)
      .filter(([_, available]) => available)
      .map(([amenity]) => amenity);
  };

  // NEW: Render unit specifications
  const renderUnitSpecifications = (specifications) => {
    if (!specifications) return null;
    
    const specs = [];
    if (specifications.bedrooms) specs.push(`🛏️ ${specifications.bedrooms} bed`);
    if (specifications.bathrooms) specs.push(`🚿 ${specifications.bathrooms} bath`);
    if (specifications.area_sqft) specs.push(`📐 ${specifications.area_sqft} sqft`);
    
    return specs.join(' • ');
  };

  if (loading) {
    return (
      <PropertiesLayout user={user} onLogout={handleLogout}>
        <div className="find-properties-page">
          <div className="loading-section">
            <div className="loading-spinner"></div>
            <p>Loading available properties...</p>
          </div>
        </div>
      </PropertiesLayout>
    );
  }

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <PropertiesLayout user={user} onLogout={handleLogout}>
      <div className="find-properties-page">
        
        {/* Page Header */}
        <div className="find-properties-header">
          <img 
            src="/images/logo.png" 
            alt="Kwetupay Logo" 
            className="find-properties-header-logo"
          />
          <div className="find-properties-header-content">
            <h1>🔍 Find Properties</h1>
            <p>Discover amazing rental properties and choose your preferred unit</p>
          </div>
        </div>

        {/* Find Properties Content */}
        <div className="find-properties-content">
          {/* Success Message */}
          {successMessage && (
            <div className="success-banner">
              ✅ {successMessage}
              <button onClick={() => setSuccessMessage('')} className="close-success">&times;</button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="error-banner">
              {error}
              <button onClick={() => setError('')} className="close-error">&times;</button>
            </div>
          )}

          {/* Search Filters */}
          <div className="filters-section">
            <h3>🔍 Search Filters</h3>
            <form onSubmit={handleApplyFilters} className="filters-form">
              <div className="filter-group">
                <label>City</label>
                <input
                  type="text"
                  name="city"
                  value={filters.city}
                  onChange={handleFilterChange}
                  placeholder="e.g., Nairobi, Mombasa"
                />
              </div>

              <div className="filter-group">
                <label>Min Price (KES)</label>
                <input
                  type="number"
                  name="minPrice"
                  value={filters.minPrice}
                  onChange={handleFilterChange}
                  placeholder="0"
                  min="0"
                />
              </div>

              <div className="filter-group">
                <label>Max Price (KES)</label>
                <input
                  type="number"
                  name="maxPrice"
                  value={filters.maxPrice}
                  onChange={handleFilterChange}
                  placeholder="100000"
                  min="0"
                />
              </div>

              <div className="filter-group">
                <label>Property Type</label>
                <select
                  name="propertyType"
                  value={filters.propertyType}
                  onChange={handleFilterChange}
                >
                  <option value="">All Types</option>
                  <option value="apartment">Apartment</option>
                  <option value="house">House</option>
                  <option value="studio">Studio</option>
                  <option value="commercial">Commercial</option>
                  <option value="plot">Plot</option>
                </select>
              </div>

              <div className="filter-buttons">
                <button type="submit" className="apply-btn">
                  Apply Filters
                </button>
                <button type="button" onClick={handleClearFilters} className="clear-btn">
                  Clear
                </button>
              </div>
            </form>
          </div>

          {/* Results Header */}
          <div className="results-header">
            <h3>Available Properties ({properties.length})</h3>
            <div className="results-info">
              {filters.city && <span>📍 {filters.city}</span>}
              {filters.minPrice && <span>💰 From {formatPrice(filters.minPrice)}</span>}
              {filters.maxPrice && <span>💰 To {formatPrice(filters.maxPrice)}</span>}
              {filters.propertyType && <span>🏠 {filters.propertyType}</span>}
            </div>
          </div>

          {/* Properties List */}
          {properties.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <h3>No properties found</h3>
              <p>
                {Object.values(filters).some(filter => filter) 
                  ? "No properties match your search criteria. Try adjusting your filters."
                  : "No available properties at the moment. Please check back later."
                }
              </p>
              {Object.values(filters).some(filter => filter) && (
                <button onClick={handleClearFilters} className="clear-filters-btn">
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <div className="properties-list">
              {properties.map(property => (
                <div key={property.property_id} className="property-list-item">
                  {/* Property Image */}
                  <div className="property-list-image">
                    {property.images && property.images.length > 0 ? (
                      <img 
                        src={property.images[0]} 
                        alt={property.title} 
                        onClick={() => handleViewDetails(property.property_id)}
                        style={{cursor: 'pointer'}}
                      />
                    ) : (
                      <div 
                        className="property-list-image-placeholder"
                        onClick={() => handleViewDetails(property.property_id)}
                        style={{cursor: 'pointer'}}
                      >
                        🏠
                      </div>
                    )}
                  </div>

                  {/* Property Details */}
                  <div className="property-list-details">
                    <div className="property-list-header">
                      <h4 
                        className="property-list-title"
                        onClick={() => handleViewDetails(property.property_id)}
                        style={{cursor: 'pointer'}}
                      >
                        {property.title}
                      </h4>
                      <div className="property-list-price">
                        {formatPrice(property.rent_amount)}<span>/month</span>
                      </div>
                    </div>

                    <div className="property-list-meta">
                      <div className="property-list-location">
                        <span className="location-icon">📍</span>
                        {property.city}{property.neighborhood && `, ${property.neighborhood}`}
                      </div>

                      <div className="property-list-type">
                        <span className="type-badge">{property.property_type}</span>
                      </div>
                    </div>

                    <div className="property-list-features">
                      {property.bedrooms && (
                        <span className="feature">🛏️ {property.bedrooms} bed</span>
                      )}
                      {property.bathrooms && (
                        <span className="feature">🚿 {property.bathrooms} bath</span>
                      )}
                      {property.area_sqft && (
                        <span className="feature">📐 {property.area_sqft} sqft</span>
                      )}
                    </div>

                    {/* NEW: Available Units Summary */}
                    <div className="property-units-summary">
                      <div className="units-count">
                        <strong>🏘️ Available Units: {property.available_units || 0}</strong>
                      </div>
                      
                      {/* Show quick unit preview if available */}
                      {property.available_units_data && property.available_units_data.length > 0 && (
                        <div className="units-preview">
                          {property.available_units_data.slice(0, 3).map(unit => (
                            <div key={unit.unit_id} className="unit-preview-item">
                              <span className="unit-number">Unit {unit.unit_number}</span>
                              <span className="unit-price">{formatPrice(unit.rent_amount)}</span>
                              <span className="unit-type">{unit.unit_type}</span>
                            </div>
                          ))}
                          {property.available_units_data.length > 3 && (
                            <div className="unit-preview-more">
                              +{property.available_units_data.length - 3} more units
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <p className="property-list-description">
                      {property.description ? 
                        (property.description.length > 150 
                          ? `${property.description.substring(0, 150)}...` 
                          : property.description)
                        : 'No description available.'
                      }
                    </p>

                    {property.amenities && getAmenitiesList(property.amenities).length > 0 && (
                      <div className="property-list-amenities">
                        <strong>Amenities:</strong>
                        <div className="amenities-list">
                          {getAmenitiesList(property.amenities).slice(0, 4).map(amenity => (
                            <span key={amenity} className="amenity-tag">{amenity}</span>
                          ))}
                          {getAmenitiesList(property.amenities).length > 4 && (
                            <span className="amenity-tag more">+{getAmenitiesList(property.amenities).length - 4} more</span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="property-list-footer">
                      <div className="property-list-landlord">
                        <small>Listed by: {property.landlord_name || 'Landlord'}</small>
                      </div>
                      
                      <div className="property-list-actions">
                        <button 
                          onClick={() => handleContactLandlord(property)}
                          className="contact-btn"
                        >
                          💬 Contact
                        </button>
                        <button 
                          onClick={() => handleViewUnits(property)}
                          className="view-units-btn"
                          disabled={!property.available_units || property.available_units === 0}
                        >
                          🏘️ View Units ({property.available_units || 0})
                        </button>
                        <button 
                          onClick={() => handleViewDetails(property.property_id)}
                          className="view-details-btn"
                        >
                          👁️ Details
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* NEW: Units Modal */}
        {selectedPropertyUnits && (
          <div className="units-modal-overlay">
            <div className="units-modal">
              <div className="units-modal-header">
                <h3>Available Units - {selectedPropertyUnits.property.title}</h3>
                <button onClick={handleCloseUnits} className="close-modal">&times;</button>
              </div>
              
              <div className="units-modal-content">
                {unitsLoading ? (
                  <div className="loading-section">
                    <div className="loading-spinner"></div>
                    <p>Loading available units...</p>
                  </div>
                ) : selectedPropertyUnits.units.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🏘️</div>
                    <h3>No units available</h3>
                    <p>All units in this property are currently occupied or under maintenance.</p>
                  </div>
                ) : (
                  <div className="units-list">
                    {selectedPropertyUnits.units.map(unit => (
                      <div key={unit.unit_id} className="unit-card">
                        <div className="unit-header">
                          <h4>Unit {unit.unit_number}</h4>
                          <div className="unit-price">
                            {formatPrice(unit.rent_amount)}<span>/month</span>
                          </div>
                        </div>
                        
                        <div className="unit-details">
                          <div className="unit-type">
                            <span className="type-badge">{unit.unit_type}</span>
                          </div>
                          
                          {renderUnitSpecifications(unit.specifications) && (
                            <div className="unit-specs">
                              {renderUnitSpecifications(unit.specifications)}
                            </div>
                          )}
                          
                          {unit.amenities && Object.keys(unit.amenities).length > 0 && (
                            <div className="unit-amenities">
                              <strong>Unit Amenities:</strong>
                              <div className="amenities-list">
                                {Object.entries(unit.amenities)
                                  .filter(([_, available]) => available)
                                  .slice(0, 5)
                                  .map(([amenity]) => (
                                    <span key={amenity} className="amenity-tag small">{amenity}</span>
                                  ))
                                }
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="unit-actions">
                          <button 
                            onClick={() => handleBookUnit(unit, selectedPropertyUnits.property)}
                            className="book-unit-btn"
                            disabled={bookingLoading === unit.unit_id}
                          >
                            {bookingLoading === unit.unit_id ? (
                              <>⏳ Booking...</>
                            ) : (
                              <>📝 Book This Unit</>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PropertiesLayout>
  );
};

export default FindProperties;