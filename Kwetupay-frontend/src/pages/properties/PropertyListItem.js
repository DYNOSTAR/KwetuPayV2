import React, { useState } from 'react';
import { propertyAPI } from '../../services/api';

const PropertyListItem = ({ property, index, userRole, onUpdate }) => {
  const [loading, setLoading] = useState(false);

  const handleToggleAvailability = async (propertyId) => {
    setLoading(true);
    try {
      const response = await propertyAPI.toggleAvailability(propertyId);
      if (response.data.status === 'success') {
        onUpdate();
      }
    } catch (error) {
      console.error('Error toggling availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(price);
  };

  return (
    <div className={`property-list-item ${!property.is_available ? 'unavailable' : ''}`}>
      <div className="property-number">
        {index + 1}
      </div>
      <div className="property-content">
        <div className="property-main-info">
          <h4 className="property-title">{property.title}</h4>
          <div className="property-location">
            <span>📍</span>
            {property.city}{property.neighborhood && `, ${property.neighborhood}`}
          </div>
          <div className="property-details">
            {property.bedrooms && <span>🛏️ {property.bedrooms} bed</span>}
            {property.bathrooms && <span>🚿 {property.bathrooms} bath</span>}
            {property.area_sqft && <span>📐 {property.area_sqft} sqft</span>}
          </div>
        </div>
        
        <div className="property-price">
          {formatPrice(property.rent_amount)}
          <span>per month</span>
        </div>
        
        <div className="property-status">
          <span className={`status-badge ${property.is_available ? 'status-available' : 'status-rented'}`}>
            {property.is_available ? 'Available' : 'Rented'}
          </span>
        </div>
        
        <div className="property-actions">
          {userRole === 'landlord' ? (
            <>
              <button 
                onClick={() => handleToggleAvailability(property.property_id)}
                className={`availability-btn ${property.is_available ? 'make-unavailable' : 'make-available'}`}
                disabled={loading}
              >
                {loading ? '...' : (property.is_available ? 'Mark Rented' : 'Mark Available')}
              </button>
              <button className="edit-btn">
                ✏️ Edit
              </button>
            </>
          ) : userRole === 'tenant' ? (
            <>
              <button className="contact-btn">
                💬 Contact
              </button>
              <button className="book-btn">
                📝 Book
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PropertyListItem;