import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import PropertiesLayout from './PropertiesLayout';
import { propertyAPI, bookingAPI } from '../../services/api';
import './Properties.css';

const PropertyDetails = () => {
  const [user, setUser] = useState(null);
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [availableUnits, setAvailableUnits] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [bookingUnitId, setBookingUnitId] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState('');
  const { propertyId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      fetchProperty();
      if (parsedUser.role === 'tenant') {
        fetchAvailableUnits();
      }
    }
  }, [propertyId]);

  const fetchProperty = async () => {
    try {
      setLoading(true);
      const response = await propertyAPI.getById(propertyId);
      
      if (response.data.status === 'success') {
        setProperty(response.data.data.property);
      } else {
        alert('Failed to load property details');
        navigate('/properties');
      }
    } catch (error) {
      console.error('Error fetching property:', error);
      alert('Error loading property details');
      navigate('/properties');
    } finally {
      setLoading(false);
    }
  };

  const handleContact = () => {
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

  const fetchAvailableUnits = async () => {
    try {
      setUnitsLoading(true);
      const response = await propertyAPI.getPropertyUnits(propertyId);
      if (response.data.status === 'success') {
        setAvailableUnits(response.data.data.units || []);
      }
    } catch (error) {
      console.error('Error fetching units:', error);
    } finally {
      setUnitsLoading(false);
    }
  };

  const handleBookUnit = async (unit) => {
    if (!window.confirm(`Book Unit ${unit.unit_number} at "${property.title}"?\n\nRent: ${formatPrice(unit.rent_amount)}/month`)) {
      return;
    }

    setBookingUnitId(unit.unit_id);
    setBookingSuccess('');

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);
      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1);

      const fmt = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const response = await bookingAPI.create({
        property_id: property.property_id,
        unit_id: unit.unit_id,
        start_date: fmt(startDate),
        end_date: fmt(endDate),
        total_rent: unit.rent_amount,
        special_terms: `Booking request for Unit ${unit.unit_number}`
      });

      if (response.data.status === 'success') {
        setBookingSuccess(`Booking request sent for Unit ${unit.unit_number}! The landlord will review and respond.`);
        fetchAvailableUnits();
      } else {
        alert(response.data.message || 'Booking failed. Please try again.');
      }
    } catch (error) {
      console.error('Booking error:', error);
      alert(error.response?.data?.message || 'Error creating booking. Please try again.');
    } finally {
      setBookingUnitId(null);
    }
  };

  const handleToggleAvailability = async () => {
    setActionLoading('availability');
    
    try {
      const response = await propertyAPI.toggleAvailability(property.property_id);
      
      if (response.data.status === 'success') {
        fetchProperty(); // Refresh property data
      } else {
        alert(response.data.message || 'Failed to update property');
      }
    } catch (error) {
      console.error('Toggle availability error:', error);
      const errorMessage = error.response?.data?.message || 'Error updating property. Please try again.';
      alert(errorMessage);
    } finally {
      setActionLoading('');
    }
  };

  const handleEdit = () => {
    navigate(`/properties/edit/${property.property_id}`);
  };

  const handleLogout = () => {
    localStorage.removeItem('kwetupay_token');
    localStorage.removeItem('kwetupay_user');
    navigate('/login');
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: property?.currency || 'KES'
    }).format(price);
  };

  const getAmenitiesList = () => {
    if (!property?.amenities) return [];
    return Object.entries(property.amenities)
      .filter(([_, available]) => available)
      .map(([amenity]) => amenity);
  };

  if (loading) {
    return (
      <PropertiesLayout user={user} onLogout={handleLogout}>
        <div className="properties-page">
          <div className="loading-section">
            <div className="loading-spinner"></div>
            <p>Loading property details...</p>
          </div>
        </div>
      </PropertiesLayout>
    );
  }

  if (!property) {
    return (
      <PropertiesLayout user={user} onLogout={handleLogout}>
        <div className="properties-page">
          <div className="empty-state">
            <div className="empty-icon">❌</div>
            <h3>Property Not Found</h3>
            <p>The property you're looking for doesn't exist or has been removed.</p>
            <button onClick={() => navigate('/properties')} className="create-first-btn">
              Back to Properties
            </button>
          </div>
        </div>
      </PropertiesLayout>
    );
  }

  const propertyDetailsContent = (
    <div className="properties-page">
      <div className="properties-content">
        {/* Page Header */}
        <div className="properties-page-header">
          <img 
            src="/images/logo.png" 
            alt="Kwetupay Logo" 
            className="properties-page-header-logo"
          />
          <div className="properties-page-header-content">
            <h1>🏠 Property Details</h1>
            <p>Complete information about this property</p>
          </div>
        </div>

        {/* Property Details Card */}
        <div className="property-details-card">
          {/* Image Gallery */}
          <div className="property-images-section">
            {property.images && property.images.length > 0 ? (
              <>
                <div className="property-main-image">
                  <img 
                    src={property.images[activeImage]} 
                    alt={property.title} 
                  />
                </div>
                {property.images.length > 1 && (
                  <div className="property-image-thumbnails">
                    {property.images.map((image, index) => (
                      <img
                        key={index}
                        src={image}
                        alt={`${property.title} ${index + 1}`}
                        className={index === activeImage ? 'active' : ''}
                        onClick={() => setActiveImage(index)}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="property-no-images">
                <div className="property-image-placeholder-large">🏠</div>
                <p>No images available for this property</p>
              </div>
            )}
          </div>

          {/* Property Information */}
          <div className="property-info-section">
            <div className="property-header-details">
              <h2>{property.title}</h2>
              <div className="property-price-large">
                {formatPrice(property.rent_amount)}<span>/month</span>
              </div>
            </div>

            <div className={`property-status-large ${property.is_available ? 'available' : 'rented'}`}>
              {property.is_available ? '🟢 Available' : '🔴 Rented'}
            </div>

            <div className="property-location-details">
              <span className="location-icon">📍</span>
              <div>
                <strong>{property.address}</strong>
                <p>{property.city}{property.neighborhood && `, ${property.neighborhood}`}</p>
              </div>
            </div>

            {/* Extended Location Info */}
            {(property.location_details?.shopping_centre || property.location_details?.nearby_roads) && (
              <div className="property-location-extra">
                {property.location_details.shopping_centre && (
                  <div className="location-extra-item">
                    <span>🏬</span>
                    <span><strong>Shopping:</strong> {property.location_details.shopping_centre}</span>
                  </div>
                )}
                {property.location_details.nearby_roads && (
                  <div className="location-extra-item">
                    <span>🛣️</span>
                    <span><strong>Near:</strong> {property.location_details.nearby_roads}</span>
                  </div>
                )}
              </div>
            )}

            {/* Google Maps */}
            {property.latitude && property.longitude && (
              <div className="property-map-section">
                <div className="map-header">
                  <h3>📍 Location on Map</h3>
                  <a
                    href={`https://www.google.com/maps?q=${property.latitude},${property.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="open-maps-btn"
                  >
                    Open in Google Maps ↗
                  </a>
                </div>
                <iframe
                  title="Property location"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${property.longitude - 0.01},${property.latitude - 0.01},${property.longitude + 0.01},${property.latitude + 0.01}&layer=mapnik&marker=${property.latitude},${property.longitude}`}
                  style={{ width: '100%', height: '280px', border: 'none', borderRadius: '8px' }}
                  loading="lazy"
                />
              </div>
            )}

            <div className="property-description-details">
              <h3>Description</h3>
              <p>{property.description || 'No description provided.'}</p>
            </div>

            {/* Property Features */}
            <div className="property-features-details">
              <h3>Property Features</h3>
              <div className="features-grid">
                {property.bedrooms && (
                  <div className="feature-item">
                    <span className="feature-icon">🛏️</span>
                    <span className="feature-label">Bedrooms</span>
                    <span className="feature-value">{property.bedrooms}</span>
                  </div>
                )}
                {property.bathrooms && (
                  <div className="feature-item">
                    <span className="feature-icon">🚿</span>
                    <span className="feature-label">Bathrooms</span>
                    <span className="feature-value">{property.bathrooms}</span>
                  </div>
                )}
                {property.area_sqft && (
                  <div className="feature-item">
                    <span className="feature-icon">📐</span>
                    <span className="feature-label">Area</span>
                    <span className="feature-value">{property.area_sqft} sqft</span>
                  </div>
                )}
                <div className="feature-item">
                  <span className="feature-icon">🏠</span>
                  <span className="feature-label">Type</span>
                  <span className="feature-value">{property.property_type}</span>
                </div>
              </div>
            </div>

            {/* Amenities */}
            {getAmenitiesList().length > 0 && (
              <div className="property-amenities-details">
                <h3>Amenities</h3>
                <div className="amenities-grid-details">
                  {getAmenitiesList().map(amenity => (
                    <div key={amenity} className="amenity-item">
                      <span className="amenity-check">✓</span>
                      <span>{amenity.charAt(0).toUpperCase() + amenity.slice(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Landlord Information */}
            <div className="property-landlord-details">
              <h3>Landlord Information</h3>
              <div className="landlord-info">
                <div className="landlord-avatar">
                  {property.landlord_name?.charAt(0) || 'L'}
                </div>
                <div className="landlord-details">
                  <strong>{property.landlord_name || 'Landlord'}</strong>
                  {property.landlord_phone && <p>📞 {property.landlord_phone}</p>}
                  {property.landlord_email && <p>✉️ {property.landlord_email}</p>}
                </div>
              </div>
            </div>

            {/* Tenant Contact Button */}
            {user?.role === 'tenant' && (
              <div className="property-actions-details">
                <button onClick={handleContact} className="contact-btn-large">
                  💬 Contact Landlord
                </button>
                <button onClick={() => navigate(-1)} className="back-btn">
                  ← Back
                </button>
              </div>
            )}

            {/* Landlord Controls */}
            {user?.role === 'landlord' && user.user_id === property.landlord_id && (
              <div className="property-actions-details">
                <button
                  onClick={handleToggleAvailability}
                  className={`availability-btn-large ${property.is_available ? 'make-unavailable' : 'make-available'}`}
                  disabled={actionLoading === 'availability'}
                >
                  {actionLoading === 'availability' ? 'Updating...' :
                    (property.is_available ? 'Mark as Rented' : 'Mark Available')}
                </button>
                <button onClick={handleEdit} className="edit-btn-large">
                  ✏️ Edit Property
                </button>
                <button onClick={() => navigate(-1)} className="back-btn">
                  ← Back
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Available Units — tenant view */}
        {user?.role === 'tenant' && (
          <div className="available-units-section">
            <h3>🏘️ Available Units</h3>

            {bookingSuccess && (
              <div className="units-booking-success">
                ✅ {bookingSuccess}
                <button onClick={() => setBookingSuccess('')} className="close-success">×</button>
              </div>
            )}

            {unitsLoading ? (
              <div className="loading-section">
                <div className="loading-spinner"></div>
                <p>Loading available units...</p>
              </div>
            ) : availableUnits.length === 0 ? (
              <div className="no-units-available">
                <p>No units are currently available in this property.</p>
              </div>
            ) : (
              <div className="units-booking-grid">
                {availableUnits.map(unit => (
                  <div key={unit.unit_id} className="unit-booking-card">
                    <div className="unit-booking-header">
                      <div>
                        <h4>Unit {unit.unit_number}</h4>
                        <span className="unit-type-badge">{unit.unit_type}</span>
                      </div>
                      <div className="unit-booking-price">
                        {formatPrice(unit.rent_amount)}<span>/month</span>
                      </div>
                    </div>

                    <div className="unit-booking-specs">
                      {unit.specifications?.bedrooms && <span>🛏️ {unit.specifications.bedrooms} bed</span>}
                      {unit.specifications?.bathrooms && <span>🚿 {unit.specifications.bathrooms} bath</span>}
                      {unit.specifications?.area_sqft && <span>📐 {unit.specifications.area_sqft} sqft</span>}
                    </div>

                    {unit.amenities && Object.values(unit.amenities).some(Boolean) && (
                      <div className="unit-booking-amenities">
                        {Object.entries(unit.amenities)
                          .filter(([, v]) => v)
                          .slice(0, 4)
                          .map(([key]) => (
                            <span key={key} className="amenity-chip">{key}</span>
                          ))}
                      </div>
                    )}

                    <button
                      className="book-unit-btn-large"
                      onClick={() => handleBookUnit(unit)}
                      disabled={bookingUnitId === unit.unit_id}
                    >
                      {bookingUnitId === unit.unit_id ? '⏳ Sending...' : '📝 Book This Unit'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <PropertiesLayout user={user} onLogout={handleLogout}>
      {propertyDetailsContent}
    </PropertiesLayout>
  );
};


export default PropertyDetails;