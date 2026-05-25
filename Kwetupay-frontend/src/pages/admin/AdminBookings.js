import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { adminAPI } from '../../services/api';
import './AdminBookings.css';

const AdminBookings = () => {
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    total: 0
  });
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      if (parsedUser.role !== 'admin' && parsedUser.role !== 'super_admin') {
        navigate('/login');
        return;
      }
      setUser(parsedUser);
      fetchBookings();
    } else {
      navigate('/login');
    }
  }, [navigate, searchParams]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const page = searchParams.get('page') || 1;
      const response = await adminAPI.getBookings({
        page,
        status: filters.status
      });
      
      if (response.data.status === 'success') {
        setBookings(response.data.data.bookings);
        setPagination({
          currentPage: response.data.data.currentPage,
          totalPages: response.data.data.totalPages,
          total: response.data.data.total
        });
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    const params = new URLSearchParams();
    if (newFilters.status) params.set('status', newFilters.status);
    setSearchParams(params);
  };

  const handleStatusChange = async (bookingId, newStatus) => {
    try {
      await adminAPI.updateBookingStatus(bookingId, newStatus);
      fetchBookings(); // Refresh the list
    } catch (error) {
      console.error('Error updating booking status:', error);
    }
  };

  const handlePageChange = (page) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page);
    setSearchParams(params);
  };

  const handleLogout = () => {
    localStorage.removeItem('kwetupay_token');
    localStorage.removeItem('kwetupay_user');
    navigate('/login');
  };

  const StatusBadge = ({ status }) => {
    const statusConfig = {
      pending: { label: 'Pending', class: 'pending' },
      confirmed: { label: 'Confirmed', class: 'confirmed' },
      completed: { label: 'Completed', class: 'completed' },
      cancelled: { label: 'Cancelled', class: 'cancelled' },
      rejected: { label: 'Rejected', class: 'rejected' }
    };
    
    const config = statusConfig[status] || { label: status, class: 'default' };
    
    return <span className={`status-badge ${config.class}`}>{config.label}</span>;
  };

  if (!user) return null;

  return (
    <AdminLayout user={user} onLogout={handleLogout}>
      <div className="admin-bookings">
        <div className="page-header">
          <div className="header-content">
            <h1>📅 Booking Management</h1>
            <p>Manage all property bookings</p>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-section">
          <div className="filter-group">
            <label>Filter by Status:</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="status-filter"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* Bookings Table */}
        <div className="bookings-table-container">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading bookings...</p>
            </div>
          ) : (
            <>
              <div className="table-header">
                <span>Showing {bookings.length} of {pagination.total} bookings</span>
              </div>
              
              <div className="bookings-table">
                <div className="table-row header">
                  <div className="col booking-info">Booking</div>
                  <div className="col property">Property</div>
                  <div className="col tenant">Tenant</div>
                  <div className="col dates">Dates</div>
                  <div className="col amount">Amount</div>
                  <div className="col status">Status</div>
                  <div className="col actions">Actions</div>
                </div>
                
                {bookings.map((booking) => (
                  <div key={booking._id} className="table-row">
                    <div className="col booking-info">
                      <div className="booking-id">
                        <strong>#{booking._id.slice(-8).toUpperCase()}</strong>
                      </div>
                      <div className="booking-date">
                        {new Date(booking.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="col property">
                      <div className="property-info">
                        <strong>{booking.property?.title}</strong>
                        <span>{booking.property?.address}</span>
                        <small>KES {booking.property?.rent_amount?.toLocaleString()}/month</small>
                      </div>
                    </div>
                    
                    <div className="col tenant">
                      <div className="tenant-info">
                        <strong>{booking.tenant?.name}</strong>
                        <span>{booking.tenant?.email}</span>
                        <small>{booking.tenant?.phone}</small>
                      </div>
                    </div>
                    
                    <div className="col dates">
                      <div className="date-range">
                        <div className="date-item">
                          <span>Move-in:</span>
                          <strong>{new Date(booking.moveInDate).toLocaleDateString()}</strong>
                        </div>
                        <div className="date-item">
                          <span>Move-out:</span>
                          <strong>
                            {booking.moveOutDate ? new Date(booking.moveOutDate).toLocaleDateString() : 'Flexible'}
                          </strong>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col amount">
                      <div className="amount-info">
                        <strong>KES {booking.totalAmount?.toLocaleString()}</strong>
                        <span>{booking.paymentStatus || 'Not paid'}</span>
                      </div>
                    </div>
                    
                    <div className="col status">
                      <StatusBadge status={booking.status} />
                    </div>
                    
                    <div className="col actions">
                      <div className="action-buttons">
                        <select
                          value={booking.status}
                          onChange={(e) => handleStatusChange(booking._id, e.target.value)}
                          className="status-select"
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirm</option>
                          <option value="rejected">Reject</option>
                          <option value="cancelled">Cancel</option>
                          <option value="completed">Complete</option>
                        </select>
                        
                        <button
                          onClick={() => navigate(`/properties/${booking.property?._id}`)}
                          className="view-btn"
                          title="View property"
                        >
                          👁️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {bookings.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">📅</div>
                  <h3>No bookings found</h3>
                  <p>Try adjusting your filters</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="pagination">
            <button
              disabled={pagination.currentPage === 1}
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              className="pagination-btn"
            >
              Previous
            </button>
            
            <div className="page-numbers">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`page-btn ${page === pagination.currentPage ? 'active' : ''}`}
                >
                  {page}
                </button>
              ))}
            </div>
            
            <button
              disabled={pagination.currentPage === pagination.totalPages}
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              className="pagination-btn"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminBookings;