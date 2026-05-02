import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertiesLayout from '../properties/PropertiesLayout';
import { bookingAPI } from '../../services/api';
import './Bookings.css';

const Bookings = () => {
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      setUser(JSON.parse(userData));
      fetchMyBookings();
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const fetchMyBookings = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await bookingAPI.getMyBookings();
      
      if (response.data.status === 'success') {
        setBookings(response.data.data.bookings || []);
      } else {
        setError('Failed to load bookings');
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setError('Failed to load your bookings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId, propertyTitle) => {
    if (!window.confirm(`Are you sure you want to cancel your booking for "${propertyTitle}"?`)) {
      return;
    }

    try {
      const response = await bookingAPI.cancel(bookingId);
      
      if (response.data.status === 'success') {
        alert('Booking cancelled successfully!');
        fetchMyBookings(); // Refresh the list
      } else {
        alert(response.data.message || 'Failed to cancel booking');
      }
    } catch (error) {
      console.error('Cancel booking error:', error);
      const errorMessage = error.response?.data?.message || 'Error cancelling booking. Please try again.';
      alert(errorMessage);
    }
  };

  const handleViewProperty = (propertyId) => {
    navigate(`/properties/${propertyId}`);
  };

  const handleContactLandlord = (booking) => {
    navigate('/messages', { 
      state: { 
        contactUser: {
          id: booking.landlord_id,
          name: booking.landlord_name,
          role: 'landlord',
          phone: booking.landlord_phone
        },
        property: {
          id: booking.property_id,
          title: booking.property_title
        }
      }
    });
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
      pending: { class: 'status-pending', label: '⏳ Pending', description: 'Waiting for landlord approval' },
      approved: { class: 'status-approved', label: '✅ Approved', description: 'Booking confirmed' },
      rejected: { class: 'status-rejected', label: '❌ Rejected', description: 'Booking declined' },
      cancelled: { class: 'status-cancelled', label: '🚫 Cancelled', description: 'Booking cancelled' }
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

  const bookingsContent = (
    <div className="bookings-page">
      <div className="bookings-content">
        {/* Page Header */}
        <div className="bookings-page-header">
          <img 
            src="/images/logo.png" 
            alt="Kwetupay Logo" 
            className="bookings-page-header-logo"
          />
          <div className="bookings-page-header-content">
            <h1>📝 My Booking Requests</h1>
            <p>Track and manage your property booking requests</p>
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
            <p>Loading your bookings...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h3>No booking requests</h3>
            <p>
              You haven't made any booking requests yet. Browse properties to find your perfect home!
            </p>
            <button 
              onClick={() => navigate('/properties/find')}
              className="browse-properties-btn"
            >
              🔍 Browse Properties
            </button>
          </div>
        ) : (
          <div className="bookings-list">
            {bookings.map((booking) => {
              const statusInfo = getStatusBadge(booking.booking_status);
              
              return (
                <div key={booking.booking_id} className="booking-card">
                  <div className="booking-header">
                    <div className="booking-property-info">
                      <h3 
                        className="booking-property-title"
                        onClick={() => handleViewProperty(booking.property_id)}
                        style={{cursor: 'pointer'}}
                      >
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

                    <div className="booking-financial">
                      <div className="rent-amount">
                        <span className="rent-label">Monthly Rent:</span>
                        <span className="rent-value">{formatPrice(booking.total_rent || booking.rent_amount)}</span>
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
                        <span className="meta-label">Submitted:</span>
                        <span className="meta-value">{formatDate(booking.created_at)}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Landlord:</span>
                        <span className="meta-value">{booking.landlord_name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="booking-actions">
                    <button 
                      onClick={() => handleContactLandlord(booking)}
                      className="contact-landlord-btn"
                    >
                      💬 Contact Landlord
                    </button>
                    
                    <button 
                      onClick={() => handleViewProperty(booking.property_id)}
                      className="view-property-btn"
                    >
                      🏠 View Property
                    </button>

                    {booking.booking_status === 'pending' && (
                      <button 
                        onClick={() => handleCancelBooking(booking.booking_id, booking.property_title)}
                        className="cancel-booking-btn"
                      >
                        🚫 Cancel Request
                      </button>
                    )}

                    {booking.booking_status === 'approved' && booking.lease_id && (
                      <button 
                        onClick={() => navigate(`/leases/${booking.lease_id}`)}
                        className="view-lease-btn"
                      >
                        📄 View Lease
                      </button>
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
            <h3>Booking Summary</h3>
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
      {bookingsContent}
    </PropertiesLayout>
  );
};

export default Bookings;