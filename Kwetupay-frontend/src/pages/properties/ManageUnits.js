import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PropertiesLayout from './PropertiesLayout';
import { propertyAPI } from '../../services/api';
import './Properties.css';

const ManageUnits = () => {
  const [user, setUser] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { propertyId } = useParams();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      setUser(JSON.parse(userData));
      fetchUnits();
    }
  }, [propertyId]);

  const fetchUnits = async () => {
    try {
      setLoading(true);
      const response = await propertyAPI.getPropertyUnits(propertyId);
      
      if (response.data.status === 'success') {
        setUnits(response.data.data.units || []);
      }
    } catch (error) {
      console.error('Error fetching units:', error);
      setError('Failed to load units');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUnit = () => {
    navigate(`/properties/${propertyId}/add-unit`);
  };

  const handleBackToProperties = () => {
    navigate('/properties');
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

  const content = (
    <div className="properties-page">
      <div className="properties-content">
        <div className="properties-page-header">
          <img src="/images/logo.png" alt="Kwetupay Logo" className="properties-page-header-logo" />
          <div className="properties-page-header-content">
            <h1>🏘️ Manage Units</h1>
            <p>Manage all units for this property</p>
          </div>
        </div>

        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError('')} className="close-error">&times;</button>
          </div>
        )}

        <div className="action-bar">
          <button onClick={handleBackToProperties} className="back-btn">
            ← Back to Properties
          </button>
          <button onClick={handleAddUnit} className="create-property-btn">
            ➕ Add New Unit
          </button>
        </div>

        {loading ? (
          <div className="loading-section">
            <div className="loading-spinner"></div>
            <p>Loading units...</p>
          </div>
        ) : units.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏠</div>
            <h3>No units found</h3>
            <p>This property doesn't have any units yet.</p>
            <button onClick={handleAddUnit} className="create-first-btn">
              Add First Unit
            </button>
          </div>
        ) : (
          <div className="units-grid">
            {units.map((unit) => (
              <div key={unit.unit_id} className="unit-card">
                <div className="unit-header">
                  <h4>{unit.unit_number}</h4>
                  <span className={`status-badge status-${unit.status}`}>
                    {unit.status}
                  </span>
                </div>
                <div className="unit-details">
                  <div className="unit-price">
                    {formatPrice(unit.rent_amount)}
                    <span>/month</span>
                  </div>
                  <div className="unit-specs">
                    {unit.bedrooms && <span>🛏️ {unit.bedrooms} bed</span>}
                    {unit.bathrooms && <span>🚿 {unit.bathrooms} bath</span>}
                    {unit.area_sqft && <span>📐 {unit.area_sqft} sqft</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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

export default ManageUnits;