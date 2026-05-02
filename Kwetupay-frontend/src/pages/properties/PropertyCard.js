import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { propertyAPI, bookingAPI } from '../../services/api';

const PropertyCard = ({ property, userRole, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const navigate = useNavigate();

  // ✅ Contact Handler
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

  // ✅ Book Property
  const handleBook = async () => {
    if (!window.confirm(`Are you sure you want to book "${property.title}"?`)) {
      return;
    }

    setLoading(true);
    setActionLoading('booking');
    
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);

      const bookingData = {
        property_id: property.property_id,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        total_rent: property.rent_amount,
        special_terms: 'Interested in viewing the property'
      };

      const response = await bookingAPI.create(bookingData);
      
      if (response.data.status === 'success') {
        alert('🎉 Booking request sent successfully! The landlord will contact you soon.');
      } else {
        alert(response.data.message || 'Booking failed. Please try again.');
      }
    } catch (error) {
      console.error('Booking error:', error);
      const errorMessage = error.response?.data?.message || 'Error creating booking. Please try again.';
      alert(errorMessage);
    } finally {
      setLoading(false);
      setActionLoading('');
    }
  };

  // ✅ Toggle Availability
  const handleToggleAvailability = async () => {
    setLoading(true);
    setActionLoading('availability');
    
    try {
      const response = await propertyAPI.toggleAvailability(property.property_id);
      
      if (response.data.status === 'success') {
        onUpdate(); // Refresh the list
      } else {
        alert(response.data.message || 'Failed to update property');
      }
    } catch (error) {
      console.error('Toggle availability error:', error);
      const errorMessage = error.response?.data?.message || 'Error updating property. Please try again.';
      alert(errorMessage);
    } finally {
      setLoading(false);
      setActionLoading('');
    }
  };

  // ✅ Edit Property
  const handleEdit = () => {
    navigate(`/properties/edit/${property.property_id}`);
  };

  // ✅ Delete Property
  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${property.title}"? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    setActionLoading('delete');
    
    try {
      const response = await propertyAPI.delete(property.property_id);
      
      if (response.data.status === 'success') {
        alert('Property deleted successfully!');
        onUpdate(); // Refresh the list
      } else {
        alert(response.data.message || 'Failed to delete property');
      }
    } catch (error) {
      console.error('Delete property error:', error);
      const errorMessage = error.response?.data?.message || 'Error deleting property. Please try again.';
      alert(errorMessage);
    } finally {
      setLoading(false);
      setActionLoading('');
    }
  };

  // ✅ View Property Details
  const handleViewDetails = () => {
    navigate(`/properties/${property.property_id}`);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: property.currency || 'KES'
    }).format(price);
  };

  const getAmenitiesList = () => {
    if (!property.amenities) return [];
    return Object.entries(property.amenities)
      .filter(([_, available]) => available)
      .map(([amenity]) => amenity);
  };

  return (
    <div className={`property-card ${!property.is_available ? 'property-unavailable' : ''}`}>
      <div className="property-image">
        {property.images && property.images.length > 0 ? (
          <img src={property.images[0]} alt={property.title} onClick={handleViewDetails} style={{cursor: 'pointer'}} />
        ) : (
          <div className="property-image-placeholder" onClick={handleViewDetails} style={{cursor: 'pointer'}}>🏠</div>
        )}
        <div className="property-badge">
          {property.property_type}
        </div>
        {!property.is_available && (
          <div className="property-status-badge">Rented</div>
        )}
      </div>

      <div className="property-content">
        <div className="property-header">
          <h3 className="property-title" onClick={handleViewDetails} style={{cursor: 'pointer'}}>
            {property.title}
          </h3>
          <p className="property-price">
            {formatPrice(property.rent_amount)}<span>/month</span>
          </p>
        </div>

        <div className="property-location">
          <span className="location-icon">📍</span>
          {property.city}{property.neighborhood && `, ${property.neighborhood}`}
        </div>

        <div className="property-details">
          <div className="property-features">
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
        </div>

        <p className="property-description">
          {property.description || 'No description available.'}
        </p>

        {property.amenities && getAmenitiesList().length > 0 && (
          <div className="property-amenities">
            <strong>Amenities:</strong>
            <div className="amenities-list">
              {getAmenitiesList().map(amenity => (
                <span key={amenity} className="amenity-tag">{amenity}</span>
              ))}
            </div>
          </div>
        )}

        <div className="property-actions">
          {userRole === 'tenant' ? (
            <>
              <button 
                onClick={handleContact}
                className="contact-btn"
                disabled={!property.is_available || loading}
              >
                💬 Contact
              </button>
              <button 
                onClick={handleBook}
                className="book-btn"
                disabled={!property.is_available || loading}
              >
                {actionLoading === 'booking' ? 'Booking...' : '📝 Book Now'}
              </button>
              <button 
                onClick={handleViewDetails}
                className="view-details-btn"
              >
                👁️ View Details
              </button>
            </>
          ) : userRole === 'landlord' ? (
            <>
              <button 
                onClick={handleToggleAvailability}
                className={`availability-btn ${property.is_available ? 'make-unavailable' : 'make-available'}`}
                disabled={loading}
              >
                {actionLoading === 'availability' ? 'Updating...' : 
                 (property.is_available ? 'Mark as Rented' : 'Mark Available')}
              </button>
              <button 
                onClick={handleEdit}
                className="edit-btn"
                disabled={loading}
              >
                {actionLoading === 'edit' ? 'Loading...' : '✏️ Edit'}
              </button>
              <button 
                onClick={handleDelete}
                className="delete-btn"
                disabled={loading}
              >
                {actionLoading === 'delete' ? 'Deleting...' : '🗑️ Delete'}
              </button>
            </>
          ) : null}
        </div>

        {property.landlord_name && (
          <div className="property-landlord">
            <small>Listed by: {property.landlord_name}</small>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyCard;