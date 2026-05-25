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
      const parsed = JSON.parse(userData);
      setUser(parsed);
      fetchLeases(parsed.role);
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const fetchLeases = async (role) => {
    try {
      setLoading(true);
      setError('');
      const response = role === 'landlord'
        ? await leaseAPI.getLandlordLeases()
        : await leaseAPI.getMyLeases();

      if (response.data.status === 'success') {
        setLeases(response.data.data.leases || []);
      } else {
        setError('Failed to load leases');
      }
    } catch (err) {
      console.error('Error fetching leases:', err);
      setError('Failed to load leases. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleContactTenant = (lease) => {
    navigate('/messages', {
      state: {
        contactUser: {
          id: lease.tenant_id,
          name: `${lease.tenant_name} ${lease.tenant_last_name}`,
          role: 'tenant',
          phone: lease.tenant_phone,
        },
        property: { id: lease.property_id, title: lease.property_title },
      },
    });
  };

  const handleContactLandlord = (lease) => {
    navigate('/messages', {
      state: {
        contactUser: {
          id: lease.landlord_id,
          name: lease.landlord_name,
          role: 'landlord',
          phone: lease.landlord_phone,
        },
        property: { id: lease.property_id, title: lease.property_title },
      },
    });
  };

  const handleMakePayment = () => {
    navigate('/payments');
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

  const calculateProgress = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    return Math.min(Math.max(((today - start) / (end - start)) * 100, 0), 100);
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
    const cfg = {
      active: { class: 'status-active', label: '🟢 Active' },
      expired: { class: 'status-expired', label: '🔴 Expired' },
      terminated: { class: 'status-terminated', label: '⚫ Terminated' },
      inactive: { class: 'status-inactive', label: '⚪ Inactive' },
    };
    return cfg[status] || { class: 'status-unknown', label: status };
  };

  const handleLogout = () => {
    localStorage.removeItem('kwetupay_token');
    localStorage.removeItem('kwetupay_user');
    navigate('/login');
  };

  if (!user) return <div>Loading...</div>;

  const isLandlord = user.role === 'landlord';

  return (
    <PropertiesLayout user={user} onLogout={handleLogout}>
      <div className="leases-page">
        <div className="leases-content">
          {/* Page Header */}
          <div className="leases-page-header">
            <img src="/images/logo.png" alt="Kwetupay Logo" className="leases-page-header-logo" />
            <div className="leases-page-header-content">
              <h1>{isLandlord ? '👥 Active Tenants' : '📄 My Leases'}</h1>
              <p>{isLandlord ? 'Tenants currently renting your properties' : 'Manage your rental agreements and track lease details'}</p>
            </div>
          </div>

          {error && (
            <div className="error-banner">
              {error}
              <button onClick={() => setError('')} className="close-error">&times;</button>
            </div>
          )}

          {loading ? (
            <div className="loading-section">
              <div className="loading-spinner"></div>
              <p>Loading {isLandlord ? 'tenants' : 'leases'}...</p>
            </div>
          ) : leases.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <h3>{isLandlord ? 'No active tenants' : 'No active leases'}</h3>
              <p>
                {isLandlord
                  ? 'You have no active tenants at the moment. Tenants will appear here once they complete their first payment.'
                  : 'You don\'t have any active leases yet. Once your booking is approved and payment is made, your lease will appear here.'}
              </p>
              {!isLandlord && (
                <button onClick={() => navigate('/properties/find')} className="browse-properties-btn">
                  🔍 Browse Properties
                </button>
              )}
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
                        <span className={`status-badge ${statusInfo.class}`}>{statusInfo.label}</span>
                        {lease.is_expiring_soon && (
                          <span className="expiring-soon-badge">⚠️ Expiring soon</span>
                        )}
                      </div>
                    </div>

                    {/* Landlord view: tenant info */}
                    {isLandlord && (
                      <div className="tenant-info-row">
                        <div className="tenant-avatar">
                          {lease.tenant_name?.charAt(0) || 'T'}
                        </div>
                        <div className="tenant-details">
                          <strong>{lease.tenant_name} {lease.tenant_last_name}</strong>
                          {lease.tenant_phone && <span>📞 {lease.tenant_phone}</span>}
                          {lease.tenant_email && <span>✉️ {lease.tenant_email}</span>}
                        </div>
                      </div>
                    )}

                    {/* Lease progress bar */}
                    <div className="lease-progress">
                      <div className="progress-header">
                        <span>Lease Duration</span>
                        <span>{Math.round(progress)}% Complete</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                      </div>
                      <div className="progress-dates">
                        <span>Start: {formatDate(lease.start_date)}</span>
                        <span>Expires: {formatDate(lease.end_date)}</span>
                      </div>
                    </div>

                    <div className="lease-details">
                      <div className="detail-row">
                        <div className="detail-item">
                          <span className="detail-label">Monthly Rent</span>
                          <span className="detail-value">{formatPrice(lease.monthly_rent)}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Days Remaining</span>
                          <span className="detail-value">{lease.days_remaining > 0 ? `${lease.days_remaining} days` : 'Expired'}</span>
                        </div>
                        {isLandlord ? (
                          <div className="detail-item">
                            <span className="detail-label">Last Rent Payment</span>
                            <span className="detail-value">
                              {lease.last_payment_date ? formatDate(lease.last_payment_date) : 'Not yet paid'}
                            </span>
                          </div>
                        ) : (
                          <div className="detail-item">
                            <span className="detail-label">Next Payment</span>
                            <span className="detail-value">{formatDate(lease.next_payment_date)}</span>
                          </div>
                        )}
                      </div>

                      {isLandlord && (
                        <div className="detail-row">
                          <div className="detail-item">
                            <span className="detail-label">Total Collected</span>
                            <span className="detail-value">{formatPrice(lease.total_paid)}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Security Deposit</span>
                            <span className="detail-value">{formatPrice(lease.security_deposit)}</span>
                          </div>
                        </div>
                      )}

                      {/* Tenant view: landlord info */}
                      {!isLandlord && (
                        <div className="landlord-info">
                          <h4>Landlord</h4>
                          <div className="landlord-details">
                            <span className="landlord-name">{lease.landlord_name}</span>
                            {lease.landlord_phone && <span className="landlord-phone">📞 {lease.landlord_phone}</span>}
                            {lease.landlord_email && <span className="landlord-email">✉️ {lease.landlord_email}</span>}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="lease-actions">
                      {isLandlord ? (
                        <button onClick={() => handleContactTenant(lease)} className="contact-landlord-btn">
                          💬 Contact Tenant
                        </button>
                      ) : (
                        <>
                          <button onClick={() => navigate(`/properties/${lease.property_id}`)} className="view-property-btn">
                            🏠 View Property
                          </button>
                          <button onClick={() => handleContactLandlord(lease)} className="contact-landlord-btn">
                            💬 Contact Landlord
                          </button>
                          {status === 'active' && (
                            <button onClick={handleMakePayment} className="make-payment-btn">
                              💳 Make Payment
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Stats summary */}
          {leases.length > 0 && (
            <div className="leases-stats">
              <h3>{isLandlord ? 'Tenant Summary' : 'Lease Summary'}</h3>
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-number">{leases.length}</span>
                  <span className="stat-label">{isLandlord ? 'Active Tenants' : 'Total Leases'}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-number">
                    {formatPrice(leases.reduce((sum, l) => sum + (parseFloat(l.monthly_rent) || 0), 0))}
                  </span>
                  <span className="stat-label">Monthly Total</span>
                </div>
                {isLandlord && (
                  <div className="stat-card">
                    <span className="stat-number">
                      {formatPrice(leases.reduce((sum, l) => sum + (parseFloat(l.total_paid) || 0), 0))}
                    </span>
                    <span className="stat-label">Total Collected</span>
                  </div>
                )}
                {!isLandlord && (
                  <div className="stat-card">
                    <span className="stat-number">
                      {leases.filter(l => getLeaseStatus(l) === 'active').length}
                    </span>
                    <span className="stat-label">Active</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </PropertiesLayout>
  );
};

export default Leases;
