import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertiesLayout from '../properties/PropertiesLayout';
import { leaseAPI } from '../../services/api';
import './Leases.css';

const Leases = () => {
  const [user, setUser] = useState(null);
  const [leases, setLeases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      setUser(JSON.parse(userData));
      fetchMyLeases();
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const fetchMyLeases = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await leaseAPI.getMyLeases();
      
      if (response.data.status === 'success') {
        setLeases(response.data.data.leases || []);
      } else {
        setError('Failed to load leases');
      }
    } catch (error) {
      console.error('Error fetching leases:', error);
      setError('Failed to load your leases. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewLeaseDetails = (leaseId) => {
    navigate(`/leases/${leaseId}`);
  };

  const handleViewProperty = (propertyId) => {
    navigate(`/properties/${propertyId}`);
  };

  const handleContactLandlord = (lease) => {
    navigate('/messages', { 
      state: { 
        contactUser: {
          id: lease.landlord_id,
          name: lease.landlord_name,
          role: 'landlord',
          phone: lease.landlord_phone
        },
        property: {
          id: lease.property_id,
          title: lease.property_title
        }
      }
    });
  };

  const handleMakePayment = (lease) => {
    alert(`Payment system for ${lease.lease_number} coming soon!`);
    // navigate(`/payments/make?lease=${lease.lease_id}`);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(price);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculateProgress = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    
    const totalDuration = end - start;
    const elapsedDuration = today - start;
    
    return Math.min(Math.max((elapsedDuration / totalDuration) * 100, 0), 100);
  };

  const getLeaseStatus = (lease) => {
    const today = new Date();
    const endDate = new Date(lease.end_date);
    
    if (lease.status === 'terminated') return 'terminated';
    if (endDate < today) return 'expired';
    if (lease.status === 'active') return 'active';
    return 'inactive';
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { class: 'status-active', label: '🟢 Active', description: 'Lease is currently active' },
      expired: { class: 'status-expired', label: '🔴 Expired', description: 'Lease has ended' },
      terminated: { class: 'status-terminated', label: '⚫ Terminated', description: 'Lease was terminated' },
      inactive: { class: 'status-inactive', label: '⚪ Inactive', description: 'Lease is not active' }
    };
    
    return statusConfig[status] || { class: 'status-unknown', label: status, description: '' };
  };

  const handleLogout = () => {
    localStorage.removeItem('kwetupay_token');
    localStorage.removeItem('kwetupay_user');
    navigate('/login');
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  const leasesContent = (
    <div className="leases-page">
      <div className="leases-content">
        {/* Page Header */}
        <div className="leases-page-header">
          <img 
            src="/images/logo.png" 
            alt="Kwetupay Logo" 
            className="leases-page-header-logo"
          />
          <div className="leases-page-header-content">
            <h1>📄 My Leases</h1>
            <p>Manage your rental agreements and track lease details</p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError('')} className="close-error">&times;</button>
          </div>
        )}

        {/* Leases List */}
        {loading ? (
          <div className="loading-section">
            <div className="loading-spinner"></div>
            <p>Loading your leases...</p>
          </div>
        ) : leases.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <h3>No active leases</h3>
            <p>
              You don't have any active leases yet. Once your booking is approved by a landlord, 
              your lease agreement will appear here.
            </p>
            <button 
              onClick={() => navigate('/properties/find')}
              className="browse-properties-btn"
            >
              🔍 Browse Properties
            </button>
          </div>
        ) : (
          <div className="leases-list">
            {leases.map((lease) => {
              const status = getLeaseStatus(lease);
              const statusInfo = getStatusBadge(status);
              const progress = calculateProgress(lease.start_date, lease.end_date);
              
              return (
                <div key={lease.lease_id} className="lease-card">
                  <div className="lease-header">
                    <div className="lease-basic-info">
                      <h3 className="lease-title">
                        {lease.property_title}
                        <span className="lease-number">#{lease.lease_number}</span>
                      </h3>
                      <div className="lease-location">
                        <span className="location-icon">📍</span>
                        {lease.city}
                        {lease.unit_number && ` • Unit ${lease.unit_number}`}
                        {lease.unit_type && ` • ${lease.unit_type}`}
                      </div>
                    </div>
                    
                    <div className="lease-status">
                      <span className={`status-badge ${statusInfo.class}`}>
                        {statusInfo.label}
                      </span>
                      <p className="status-description">{statusInfo.description}</p>
                    </div>
                  </div>

                  {/* Lease Progress */}
                  <div className="lease-progress">
                    <div className="progress-header">
                      <span>Lease Duration</span>
                      <span>{Math.round(progress)}% Complete</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <div className="progress-dates">
                      <span>Start: {formatDate(lease.start_date)}</span>
                      <span>End: {formatDate(lease.end_date)}</span>
                    </div>
                  </div>

                  <div className="lease-details">
                    <div className="detail-row">
                      <div className="detail-item">
                        <span className="detail-label">Monthly Rent</span>
                        <span className="detail-value">{formatPrice(lease.monthly_rent)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Time Remaining</span>
                        <span className="detail-value">{lease.days_remaining} days</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Next Payment</span>
                        <span className="detail-value">{formatDate(lease.next_payment_date)}</span>
                      </div>
                    </div>

                    {/* Unit Specifications */}
                    {lease.specifications && Object.keys(lease.specifications).length > 0 && (
                      <div className="unit-specs">
                        <h4>Unit Specifications</h4>
                        <div className="specs-grid">
                          {lease.specifications.bedrooms && (
                            <div className="spec-item">
                              <span className="spec-icon">🛏️</span>
                              <span>{lease.specifications.bedrooms} Bedrooms</span>
                            </div>
                          )}
                          {lease.specifications.bathrooms && (
                            <div className="spec-item">
                              <span className="spec-icon">🚿</span>
                              <span>{lease.specifications.bathrooms} Bathrooms</span>
                            </div>
                          )}
                          {lease.specifications.area_sqft && (
                            <div className="spec-item">
                              <span className="spec-icon">📐</span>
                              <span>{lease.specifications.area_sqft} sqft</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Landlord Information */}
                    <div className="landlord-info">
                      <h4>Landlord</h4>
                      <div className="landlord-details">
                        <span className="landlord-name">{lease.landlord_name}</span>
                        {lease.landlord_phone && (
                          <span className="landlord-phone">📞 {lease.landlord_phone}</span>
                        )}
                        {lease.landlord_email && (
                          <span className="landlord-email">✉️ {lease.landlord_email}</span>
                        )}
                      </div>
                    </div>

                    {lease.special_terms && (
                      <div className="special-terms">
                        <h4>Special Terms</h4>
                        <p>{lease.special_terms}</p>
                      </div>
                    )}
                  </div>

                  <div className="lease-actions">
                    <button 
                      onClick={() => handleViewLeaseDetails(lease.lease_id)}
                      className="view-lease-btn"
                    >
                      📄 View Full Lease
                    </button>
                    
                    <button 
                      onClick={() => handleViewProperty(lease.property_id)}
                      className="view-property-btn"
                    >
                      🏠 View Property
                    </button>

                    <button 
                      onClick={() => handleContactLandlord(lease)}
                      className="contact-landlord-btn"
                    >
                      💬 Contact Landlord
                    </button>

                    {status === 'active' && (
                      <button 
                        onClick={() => handleMakePayment(lease)}
                        className="make-payment-btn"
                      >
                        💳 Make Payment
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Stats */}
        {leases.length > 0 && (
          <div className="leases-stats">
            <h3>Lease Summary</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-number">{leases.length}</span>
                <span className="stat-label">Total Leases</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">
                  {leases.filter(l => getLeaseStatus(l) === 'active').length}
                </span>
                <span className="stat-label">Active</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">
                  {leases.filter(l => getLeaseStatus(l) === 'expired').length}
                </span>
                <span className="stat-label">Expired</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">
                  {formatPrice(leases.reduce((sum, lease) => sum + (lease.monthly_rent || 0), 0))}
                </span>
                <span className="stat-label">Monthly Total</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <PropertiesLayout user={user} onLogout={handleLogout}>
      {leasesContent}
    </PropertiesLayout>
  );
};

export default Leases;