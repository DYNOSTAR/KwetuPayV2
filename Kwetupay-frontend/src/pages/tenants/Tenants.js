import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertiesLayout from '../properties/PropertiesLayout';
import { tenantAPI } from '../../services/api';
import './Tenants.css';

const Tenants = () => {
  const [user, setUser] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      fetchTenantsData();
    }
  }, []);

  const fetchTenantsData = async () => {
    try {
      setLoading(true);
      setError('');

      const [tenantsResponse, statsResponse] = await Promise.all([
        tenantAPI.getLandlordTenants(),
        tenantAPI.getTenantStatistics()
      ]);

      if (tenantsResponse.data.status === 'success') {
        setTenants(tenantsResponse.data.data.tenants);
      }

      if (statsResponse.data.status === 'success') {
        setStatistics(statsResponse.data.data.stats);
      }
    } catch (error) {
      console.error('Error fetching tenants data:', error);
      setError('Failed to load tenants data');
    } finally {
      setLoading(false);
    }
  };

  const handleViewTenantDetails = (tenantId) => {
    navigate(`/tenants/${tenantId}`);
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-KE');
  };

  if (loading) {
    return (
      <PropertiesLayout user={user} onLogout={handleLogout}>
        <div className="tenants-page">
          <div className="loading-section">
            <div className="loading-spinner"></div>
            <p>Loading tenants data...</p>
          </div>
        </div>
      </PropertiesLayout>
    );
  }

  const tenantsContent = (
    <div className="tenants-page">
      <div className="tenants-content">
        {/* Page Header */}
        <div className="tenants-page-header">
          <img 
            src="/images/logo.png" 
            alt="Kwetupay Logo" 
            className="tenants-page-header-logo"
          />
          <div className="tenants-page-header-content">
            <h1>👥 My Tenants</h1>
            <p>Manage your tenants and track their information</p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError('')} className="close-error">&times;</button>
          </div>
        )}

        {/* Statistics Cards */}
        {statistics && (
          <div className="statistics-section">
            <h3>📊 Overview</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <div className="stat-value">{statistics.total_tenants || 0}</div>
                  <div className="stat-label">Total Tenants</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🏠</div>
                <div className="stat-info">
                  <div className="stat-value">{statistics.occupied_properties || 0}</div>
                  <div className="stat-label">Occupied Properties</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📄</div>
                <div className="stat-info">
                  <div className="stat-value">{statistics.active_leases || 0}</div>
                  <div className="stat-label">Active Leases</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-info">
                  <div className="stat-value">
                    {statistics.average_rent ? formatPrice(statistics.average_rent) : 'KES 0'}
                  </div>
                  <div className="stat-label">Average Rent</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tenants List */}
        <div className="tenants-section">
          <div className="section-header">
            <h3>Current Tenants ({tenants.length})</h3>
          </div>

          {tenants.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <h3>No Tenants Found</h3>
              <p>You don't have any active tenants at the moment.</p>
            </div>
          ) : (
            <div className="tenants-list">
              {tenants.map((tenant) => (
                <div key={tenant.booking_id} className="tenant-card">
                  <div className="tenant-header">
                    <div className="tenant-avatar">
                      {tenant.tenant.first_name?.charAt(0) || 'T'}
                    </div>
                    <div className="tenant-info">
                      <h4 className="tenant-name">
                        {tenant.tenant.first_name} {tenant.tenant.last_name}
                      </h4>
                      <div className="tenant-contact">
                        {tenant.tenant.contact_phone && (
                          <span className="contact-item">📞 {tenant.tenant.contact_phone}</span>
                        )}
                        {tenant.tenant.contact_email && (
                          <span className="contact-item">✉️ {tenant.tenant.contact_email}</span>
                        )}
                      </div>
                    </div>
                    <div className="lease-status">
                      <span className={`status-badge ${tenant.lease.status}`}>
                        {tenant.lease.status === 'active' ? '🟢 Active' : '🟡 Upcoming'}
                      </span>
                    </div>
                  </div>

                  <div className="tenant-details">
                    <div className="detail-row">
                      <span className="detail-label">Property:</span>
                      <span className="detail-value">{tenant.property.title}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Address:</span>
                      <span className="detail-value">{tenant.property.address}, {tenant.property.city}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Lease Period:</span>
                      <span className="detail-value">
                        {formatDate(tenant.lease.start_date)} - {formatDate(tenant.lease.end_date)}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Monthly Rent:</span>
                      <span className="detail-value rent-amount">
                        {formatPrice(tenant.lease.total_rent)}
                      </span>
                    </div>
                  </div>

                  {tenant.special_terms && (
                    <div className="special-terms">
                      <strong>Special Terms:</strong>
                      <p>{tenant.special_terms}</p>
                    </div>
                  )}

                  <div className="tenant-actions">
                    <button 
                      onClick={() => handleViewTenantDetails(tenant.tenant.id)}
                      className="view-details-btn"
                    >
                      👁️ View Details
                    </button>
                    <button className="contact-btn">
                      💬 Contact
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <PropertiesLayout user={user} onLogout={handleLogout}>
      {tenantsContent}
    </PropertiesLayout>
  );
};

export default Tenants;