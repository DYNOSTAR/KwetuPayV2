import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertiesLayout from './PropertiesLayout';
import { propertyAPI } from '../../services/api';
import './Properties.css';

const Properties = () => {
  const [user, setUser] = useState(null);
  const [properties, setProperties] = useState([]);
  const [propertyUnits, setPropertyUnits] = useState({});
  const [expandedProperty, setExpandedProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unitsLoading, setUnitsLoading] = useState({});
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      fetchProperties();
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await propertyAPI.getMyProperties();
      
      if (response.data.status === 'success') {
        const propertiesData = response.data.data.properties || [];
        setProperties(propertiesData);
        
        // Initialize empty units for each property
        const initialUnits = {};
        propertiesData.forEach(property => {
          initialUnits[property.property_id] = [];
        });
        setPropertyUnits(initialUnits);
      } else {
        setError('Failed to load properties');
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
      setError('Failed to load properties. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPropertyUnits = async (propertyId) => {
    try {
      setUnitsLoading(prev => ({ ...prev, [propertyId]: true }));
      
      const response = await propertyAPI.getPropertyUnits(propertyId);
      
      if (response.data.status === 'success') {
        setPropertyUnits(prev => ({
          ...prev,
          [propertyId]: response.data.data.units || []
        }));
      }
    } catch (error) {
      console.error(`Error fetching units for property ${propertyId}:`, error);
      // Don't show error to user for units loading
    } finally {
      setUnitsLoading(prev => ({ ...prev, [propertyId]: false }));
    }
  };

  const togglePropertyExpansion = async (propertyId) => {
    if (expandedProperty === propertyId) {
      setExpandedProperty(null);
    } else {
      setExpandedProperty(propertyId);
      // Fetch units if not already loaded
      if (!propertyUnits[propertyId] || propertyUnits[propertyId].length === 0) {
        await fetchPropertyUnits(propertyId);
      }
    }
  };

  const handleToggleAvailability = async (propertyId) => {
    try {
      const response = await propertyAPI.toggleAvailability(propertyId);
      if (response.data.status === 'success') {
        fetchProperties();
      }
    } catch (error) {
      console.error('Error toggling availability:', error);
      alert('Failed to update property availability');
    }
  };

  const handleToggleUnitStatus = async (unitId, currentStatus, propertyId) => {
    try {
      const newStatus = currentStatus === 'available' ? 'occupied' : 'available';
      await propertyAPI.updateUnit(unitId, { status: newStatus });
      
      // Refresh units for this property
      await fetchPropertyUnits(propertyId);
    } catch (error) {
      console.error('Error updating unit status:', error);
      alert('Failed to update unit status');
    }
  };

  const handleEditProperty = (propertyId) => {
    navigate(`/properties/edit/${propertyId}`);
  };

  const handleDeleteProperty = async (propertyId, propertyTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${propertyTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await propertyAPI.delete(propertyId);
      
      if (response.data.status === 'success') {
        alert('Property deleted successfully!');
        fetchProperties();
      } else {
        alert(response.data.message || 'Failed to delete property');
      }
    } catch (error) {
      console.error('Delete property error:', error);
      const errorMessage = error.response?.data?.message || 'Error deleting property. Please try again.';
      alert(errorMessage);
    }
  };

  const handleViewDetails = (propertyId) => {
    navigate(`/properties/${propertyId}`);
  };

  const handleCreateProperty = () => {
    navigate('/properties/create');
  };

  const handleAddUnit = (propertyId) => {
    navigate(`/properties/${propertyId}/add-unit`);
  };

  const handleManageUnits = (propertyId) => {
    navigate(`/properties/${propertyId}/units`);
  };

  const handleLogout = () => {
    localStorage.removeItem('kwetupay_token');
    localStorage.removeItem('kwetupay_user');
    navigate('/login');
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(price);
  };

  const getUnitStatusColor = (status) => {
    const statusColors = {
      available: 'success',
      occupied: 'warning',
      maintenance: 'danger'
    };
    return statusColors[status] || 'secondary';
  };

  const getUnitStatusText = (status) => {
    const statusTexts = {
      available: 'Available',
      occupied: 'Occupied',
      maintenance: 'Maintenance'
    };
    return statusTexts[status] || status;
  };

  const calculateOccupancyRate = (property) => {
    if (!property.total_units || property.total_units === 0) return 0;
    return Math.round((property.occupied_units / property.total_units) * 100);
  };

  // Properties content that will be passed to Layout
  const propertiesContent = (
    <div className="properties-page">
      <div className="properties-content">
        {/* Page Header with Logo */}
        <div className="properties-page-header">
          <img 
            src="/images/logo.png" 
            alt="Kwetupay Logo" 
            className="properties-page-header-logo"
          />
          <div className="properties-page-header-content">
            <h1>🏠 Manage My Properties</h1>
            <p>Manage your rental properties and track units</p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError('')} className="close-error">&times;</button>
          </div>
        )}

        {/* Action Bar */}
        <div className="action-bar">
          <div className="results-info">
            <h3>My Properties ({properties.length})</h3>
          </div>
          
          <button 
            onClick={handleCreateProperty}
            className="create-property-btn"
          >
            ➕ Add New Property
          </button>
        </div>

        {/* Properties List */}
        {loading ? (
          <div className="loading-section">
            <div className="loading-spinner"></div>
            <p>Loading your properties...</p>
          </div>
        ) : properties.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏠</div>
            <h3>No properties found</h3>
            <p>
              You haven't listed any properties yet. Create your first property to get started!
            </p>
            <button 
              onClick={handleCreateProperty}
              className="create-first-btn"
            >
              Create Your First Property
            </button>
          </div>
        ) : (
          <div className="properties-list">
            {properties.map((property, index) => (
              <div key={property.property_id} className="property-card">
                {/* Property Header */}
                <div 
                  className={`property-header ${!property.is_available ? 'unavailable' : ''}`}
                  onClick={() => togglePropertyExpansion(property.property_id)}
                >
                  <div className="property-main">
                    <div className="property-number">
                      {index + 1}
                    </div>
                    <div className="property-basic-info">
                      <h4 className="property-title">
                        {property.title}
                      </h4>
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
                  </div>
                  
                  <div className="property-stats">
                    <div className="property-price">
                      {formatPrice(property.rent_amount)}
                      <span>base rent</span>
                    </div>
                    
                    <div className="unit-stats">
                      <div className="stat-item">
                        <span className="stat-value">{property.total_units || 0}</span>
                        <span className="stat-label">Total Units</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{property.available_units || 0}</span>
                        <span className="stat-label">Available</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{calculateOccupancyRate(property)}%</span>
                        <span className="stat-label">Occupancy</span>
                      </div>
                    </div>

                    <div className="property-status">
                      <span className={`status-badge ${property.is_available ? 'status-available' : 'status-rented'}`}>
                        {property.is_available ? 'Available' : 'Rented'}
                      </span>
                    </div>

                    <div className="expand-indicator">
                      {expandedProperty === property.property_id ? '▼' : '►'}
                    </div>
                  </div>
                </div>

                {/* Expanded Units Section */}
                {expandedProperty === property.property_id && (
                  <div className="property-units-section">
                    <div className="units-header">
                      <h5>🏘️ Property Units</h5>
                      <div className="units-actions">
                        <button 
                          onClick={() => handleAddUnit(property.property_id)}
                          className="add-unit-btn"
                        >
                          ➕ Add Unit
                        </button>
                        <button 
                          onClick={() => handleManageUnits(property.property_id)}
                          className="manage-units-btn"
                        >
                          🛠️ Manage Units
                        </button>
                      </div>
                    </div>

                    {unitsLoading[property.property_id] ? (
                      <div className="units-loading">
                        <div className="loading-spinner-small"></div>
                        <span>Loading units...</span>
                      </div>
                    ) : propertyUnits[property.property_id] && propertyUnits[property.property_id].length > 0 ? (
                      <div className="units-grid">
                        {propertyUnits[property.property_id].map((unit) => (
                          <div key={unit.unit_id} className="unit-card">
                            <div className="unit-header">
                              <div className="unit-info">
                                <h6 className="unit-number">{unit.unit_number}</h6>
                                <span className="unit-type">{unit.unit_type}</span>
                              </div>
                              <div className="unit-status">
                                <span className={`status-badge status-${getUnitStatusColor(unit.status)}`}>
                                  {getUnitStatusText(unit.status)}
                                </span>
                              </div>
                            </div>
                            
                            <div className="unit-details">
                              <div className="unit-price">
                                {formatPrice(unit.rent_amount)}
                                <span>/month</span>
                              </div>
                              
                              <div className="unit-specs">
                                {unit.specifications?.bedrooms && (
                                  <span className="spec">🛏️ {unit.specifications.bedrooms} bed</span>
                                )}
                                {unit.specifications?.bathrooms && (
                                  <span className="spec">🚿 {unit.specifications.bathrooms} bath</span>
                                )}
                                {unit.specifications?.area_sqft && (
                                  <span className="spec">📐 {unit.specifications.area_sqft} sqft</span>
                                )}
                              </div>

                              {unit.tenant_name && (
                                <div className="tenant-info">
                                  <small>Tenant: {unit.tenant_name}</small>
                                </div>
                              )}
                            </div>

                            <div className="unit-actions">
                              <button 
                                onClick={() => handleToggleUnitStatus(unit.unit_id, unit.status, property.property_id)}
                                className={`unit-status-btn ${unit.status === 'available' ? 'make-occupied' : 'make-available'}`}
                              >
                                {unit.status === 'available' ? 'Mark Occupied' : 'Mark Available'}
                              </button>
                              {unit.status === 'maintenance' && (
                                <button className="maintenance-btn">
                                  🛠️ In Maintenance
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="no-units-message">
                        <div className="empty-icon">🏠</div>
                        <p>No units found for this property</p>
                        <p className="empty-description">
                          Add units to start managing individual rental spaces
                        </p>
                        <button 
                          onClick={() => handleAddUnit(property.property_id)}
                          className="add-first-unit-btn"
                        >
                          Add First Unit
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Property Actions */}
                <div className="property-actions">
                  {user?.role === 'landlord' ? (
                    <>
                      <button 
                        onClick={() => handleToggleAvailability(property.property_id)}
                        className={`availability-btn ${property.is_available ? 'make-unavailable' : 'make-available'}`}
                      >
                        {property.is_available ? 'Mark Rented' : 'Mark Available'}
                      </button>
                      <button 
                        onClick={() => handleEditProperty(property.property_id)}
                        className="edit-btn"
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        onClick={() => handleViewDetails(property.property_id)}
                        className="view-details-btn"
                      >
                        👁️ Details
                      </button>
                      <button 
                        onClick={() => handleDeleteProperty(property.property_id, property.title)}
                        className="delete-btn"
                      >
                        🗑️ Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="contact-btn">
                        💬 Contact
                      </button>
                      <button className="book-btn">
                        📝 Book
                      </button>
                      <button 
                        onClick={() => handleViewDetails(property.property_id)}
                        className="view-details-btn"
                      >
                        👁️ Details
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
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
      {propertiesContent}
    </PropertiesLayout>
  );
};

export default Properties;