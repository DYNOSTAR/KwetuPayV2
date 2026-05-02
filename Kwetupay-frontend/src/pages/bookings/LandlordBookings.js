import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertiesLayout from '../properties/PropertiesLayout';
import { bookingAPI } from '../../services/api';
import './LandlordBookings.css';

const LandlordBookings = () => {
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      setUser(JSON.parse(userData));
      fetchLandlordBookings();
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const fetchLandlordBookings = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await bookingAPI.getLandlordRequests();
      
      if (response.data.status === 'success') {
        setBookings(response.data.data.bookings || []);
      } else {
        setError('Failed to load booking requests');
      }
    } catch (error) {
      console.error('Error fetching landlord bookings:', error);
      setError('Failed to load booking requests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to approve this booking?')) return;

    try {
      setActionLoading(bookingId);
      
      const response = await bookingAPI.updateStatus(bookingId, 'approved');
      
      if (response.data.status === 'success') {
        alert('Booking approved successfully! A lease has been created.');
        fetchLandlordBookings(); // Refresh the list
      } else {
        alert(response.data.message || 'Failed to approve booking');
      }
    } catch (error) {
      console.error('Approve booking error:', error);
      const errorMessage = error.response?.data?.message || 'Error approving booking. Please try again.';
      alert(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to reject this booking?')) return;

    try {
      setActionLoading(bookingId);
      
      const response = await bookingAPI.updateStatus(bookingId, 'rejected');
      
      if (response.data.status === 'success') {
        alert('Booking rejected successfully.');
        fetchLandlordBookings(); // Refresh the list
      } else {
        alert(response.data.message || 'Failed to reject booking');
      }
    } catch (error) {
      console.error('Reject booking error:', error);
      const errorMessage = error.response?.data?.message || 'Error rejecting booking. Please try again.';
      alert(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleContactTenant = (booking) => {
    navigate('/messages', { 
      state: { 
        contactUser: {
          id: booking.tenant_id,
          name: booking.tenant_name,
          role: 'tenant',
          phone: booking.tenant_phone
        },
        property: {
          id: booking.property_id,
          title: booking.property_title
        }
      }
    });
  };

  const handleViewProperty = (propertyId) => {
    navigate(`/properties/${propertyId}`);
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

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { class: 'status-pending', label: '⏳ Pending', description: 'Waiting for your approval' },
      approved: { class: 'status-approved', label: '✅ Approved', description: 'Booking confirmed' },
      rejected: { class: 'status-rejected', label: '❌ Rejected', description: 'Booking declined' },
      cancelled: { class: 'status-cancelled', label: '🚫 Cancelled', description: 'Booking cancelled by tenant' }
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

  const landlordBookingsContent = (
    <div className="landlord-bookings-page">
      <div className="bookings-content">
        {/* Page Header */}
        <div className="bookings-page-header">
          <img 
            src="/images/logo.png" 
            alt="Kwetupay Logo" 
            className="bookings-page-header-logo"
          />
          <div className="bookings-page-header-content">
            <h1>📝 Booking Requests</h1>
            <p>Manage booking requests for your properties</p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError('')} className="close-error">&times;</button>
          </div>
        )}

        {/* Bookings List */}
        {loading ? (
          <div className="loading-section">
            <div className="loading-spinner"></div>
            <p>Loading booking requests...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h3>No booking requests</h3>
            <p>
              You don't have any pending booking requests. 
              Tenants will appear here when they book your properties.
            </p>
          </div>
        ) : (
          <div className="bookings-list">
            {bookings.map((booking) => {
              const statusInfo = getStatusBadge(booking.booking_status);
              
              return (
                <div key={booking.booking_id} className="booking-card">
                  <div className="booking-header">
                    <div className="booking-property-info">
                      <h3 className="booking-property-title">
                        {booking.property_title}
                        {booking.unit_number && <span className="unit-info"> • Unit {booking.unit_number}</span>}
                      </h3>
                      <div className="booking-location">
                        <span className="location-icon">📍</span>
                        {booking.city}{booking.address && `, ${booking.address}`}
                      </div>
                    </div>
                    
                    <div className="booking-status">
                      <span className={`status-badge ${statusInfo.class}`}>
                        {statusInfo.label}
                      </span>
                      <p className="status-description">{statusInfo.description}</p>
                    </div>
                  </div>

                  <div className="booking-details">
                    {/* Tenant Information */}
                    <div className="tenant-section">
                      <h4>Tenant Information</h4>
                      <div className="tenant-details">
                        <div className="tenant-avatar">
                          {booking.tenant_name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="tenant-info">
                          <strong>{booking.tenant_name}</strong>
                          <div className="tenant-contact">
                            {booking.tenant_phone && <span>📞 {booking.tenant_phone}</span>}
                            {booking.tenant_email && <span>✉️ {booking.tenant_email}</span>}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Booking Dates */}
                    <div className="booking-dates">
                      <div className="date-item">
                        <span className="date-label">Move-in Date:</span>
                        <span className="date-value">{formatDate(booking.start_date)}</span>
                      </div>
                      <div className="date-item">
                        <span className="date-label">Move-out Date:</span>
                        <span className="date-value">{formatDate(booking.end_date)}</span>
                      </div>
                    </div>

                    {/* Financial Information */}
                    <div className="booking-financial">
                      <div className="rent-amount">
                        <span className="rent-label">Monthly Rent:</span>
                        <span className="rent-value">{formatPrice(booking.total_rent)}</span>
                      </div>
                    </div>

                    {/* Unit Specifications */}
                    {booking.specifications && Object.keys(booking.specifications).length > 0 && (
                      <div className="unit-specs">
                        <h4>Unit Specifications</h4>
                        <div className="specs-grid">
                          {booking.specifications.bedrooms && (
                            <div className="spec-item">
                              <span className="spec-icon">🛏️</span>
                              <span>{booking.specifications.bedrooms} bed</span>
                            </div>
                          )}
                          {booking.specifications.bathrooms && (
                            <div className="spec-item">
                              <span className="spec-icon">🚿</span>
                              <span>{booking.specifications.bathrooms} bath</span>
                            </div>
                          )}
                          {booking.specifications.area_sqft && (
                            <div className="spec-item">
                              <span className="spec-icon">📐</span>
                              <span>{booking.specifications.area_sqft} sqft</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {booking.special_terms && (
                      <div className="special-terms">
                        <span className="terms-label">Special Terms:</span>
                        <p className="terms-content">{booking.special_terms}</p>
                      </div>
                    )}

                    <div className="booking-meta">
                      <div className="meta-item">
                        <span className="meta-label">Requested:</span>
                        <span className="meta-value">{formatDate(booking.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="booking-actions">
                    <button 
                      onClick={() => handleContactTenant(booking)}
                      className="contact-tenant-btn"
                    >
                      💬 Contact Tenant
                    </button>
                    
                    <button 
                      onClick={() => handleViewProperty(booking.property_id)}
                      className="view-property-btn"
                    >
                      🏠 View Property
                    </button>

                    {/* Only show approve/reject for pending bookings */}
                    {booking.booking_status === 'pending' && (
                      <>
                        <button 
                          onClick={() => handleApproveBooking(booking.booking_id)}
                          className="approve-btn"
                          disabled={actionLoading === booking.booking_id}
                        >
                          {actionLoading === booking.booking_id ? 'Approving...' : '✅ Approve'}
                        </button>
                        <button 
                          onClick={() => handleRejectBooking(booking.booking_id)}
                          className="reject-btn"
                          disabled={actionLoading === booking.booking_id}
                        >
                          {actionLoading === booking.booking_id ? 'Rejecting...' : '❌ Reject'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Stats */}
        {bookings.length > 0 && (
          <div className="bookings-stats">
            <h3>Requests Summary</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-number">{bookings.length}</span>
                <span className="stat-label">Total Requests</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">
                  {bookings.filter(b => b.booking_status === 'pending').length}
                </span>
                <span className="stat-label">Pending</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">
                  {bookings.filter(b => b.booking_status === 'approved').length}
                </span>
                <span className="stat-label">Approved</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">
                  {bookings.filter(b => b.booking_status === 'rejected').length}
                </span>
                <span className="stat-label">Rejected</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <PropertiesLayout user={user} onLogout={handleLogout}>
      {landlordBookingsContent}
    </PropertiesLayout>
  );
};

export default LandlordBookings;