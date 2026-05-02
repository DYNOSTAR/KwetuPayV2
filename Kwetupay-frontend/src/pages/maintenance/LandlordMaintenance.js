import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertiesLayout from '../properties/PropertiesLayout';
import { maintenanceAPI } from '../../services/api';
import './Maintenance.css';

const LandlordMaintenance = () => {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateNotes, setUpdateNotes] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      setUser(JSON.parse(userData));
      fetchLandlordRequests();
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const fetchLandlordRequests = async () => {
    try {
      setLoading(true);
      
      const response = await maintenanceAPI.getLandlordRequests();
      setRequests(response.data.data?.requests || []);

    } catch (error) {
      console.error('Error fetching landlord requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (requestId, status) => {
    try {
      setActionLoading(requestId);
      
      const updateData = { status };
      if (updateNotes) {
        updateData.landlord_notes = updateNotes;
      }

      const response = await maintenanceAPI.updateRequestStatus(requestId, updateData);
      
      if (response.data.status === 'success') {
        alert(`Request marked as ${status}`);
        setShowUpdateModal(false);
        setSelectedRequest(null);
        setUpdateNotes('');
        fetchLandlordRequests(); // Refresh list
      } else {
        alert(response.data.message || 'Failed to update request');
      }
    } catch (error) {
      console.error('Update status error:', error);
      const errorMessage = error.response?.data?.message || 'Error updating request. Please try again.';
      alert(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenUpdateModal = (request, status) => {
    setSelectedRequest(request);
    setUpdateNotes(request.landlord_notes || '');
    // For completed status, show notes modal
    if (status === 'completed') {
      setShowUpdateModal(true);
    } else {
      handleUpdateStatus(request.request_id, status);
    }
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
      pending: { class: 'status-pending', label: '⏳ Pending' },
      in_progress: { class: 'status-progress', label: '🔧 In Progress' },
      completed: { class: 'status-completed', label: '✅ Completed' },
      cancelled: { class: 'status-cancelled', label: '❌ Cancelled' }
    };
    return statusConfig[status] || { class: 'status-unknown', label: status };
  };

  const getUrgencyBadge = (urgency) => {
    const urgencyConfig = {
      high: { class: 'urgency-high', label: '🔴 High' },
      medium: { class: 'urgency-medium', label: '🟡 Medium' },
      low: { class: 'urgency-low', label: '🟢 Low' }
    };
    return urgencyConfig[urgency] || { class: 'urgency-unknown', label: urgency };
  };

  const handleLogout = () => {
    localStorage.removeItem('kwetupay_token');
    localStorage.removeItem('kwetupay_user');
    navigate('/login');
  };

  // Group requests by status for better organization
  const groupedRequests = {
    pending: requests.filter(r => r.status === 'pending'),
    in_progress: requests.filter(r => r.status === 'in_progress'),
    completed: requests.filter(r => r.status === 'completed'),
    cancelled: requests.filter(r => r.status === 'cancelled')
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <PropertiesLayout user={user} onLogout={handleLogout}>
      <div className="maintenance-page">
        <div className="maintenance-content">
          {/* Page Header */}
          <div className="maintenance-page-header">
            <img 
              src="/images/logo.png" 
              alt="Kwetupay Logo" 
              className="maintenance-page-header-logo"
            />
            <div className="maintenance-page-header-content">
              <h1>🛠️ Maintenance Management</h1>
              <p>Manage maintenance requests from your tenants</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="maintenance-stats">
            <div className="stats-grid">
              <div className="stat-card total">
                <span className="stat-number">{requests.length}</span>
                <span className="stat-label">Total Requests</span>
              </div>
              <div className="stat-card pending">
                <span className="stat-number">{groupedRequests.pending.length}</span>
                <span className="stat-label">Pending</span>
              </div>
              <div className="stat-card progress">
                <span className="stat-number">{groupedRequests.in_progress.length}</span>
                <span className="stat-label">In Progress</span>
              </div>
              <div className="stat-card completed">
                <span className="stat-number">{groupedRequests.completed.length}</span>
                <span className="stat-label">Completed</span>
              </div>
            </div>
          </div>

          {/* Requests by Status */}
          {loading ? (
            <div className="loading-section">
              <div className="loading-spinner"></div>
              <p>Loading maintenance requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🛠️</div>
              <h3>No maintenance requests</h3>
              <p>Maintenance requests from your tenants will appear here.</p>
            </div>
          ) : (
            <div className="requests-by-status">
              {/* Pending Requests */}
              {groupedRequests.pending.length > 0 && (
                <section className="status-section">
                  <h3>⏳ Pending Requests ({groupedRequests.pending.length})</h3>
                  <div className="requests-grid">
                    {groupedRequests.pending.map(request => (
                      <RequestCard 
                        key={request.request_id}
                        request={request}
                        onUpdateStatus={handleOpenUpdateModal}
                        actionLoading={actionLoading}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* In Progress Requests */}
              {groupedRequests.in_progress.length > 0 && (
                <section className="status-section">
                  <h3>🔧 In Progress ({groupedRequests.in_progress.length})</h3>
                  <div className="requests-grid">
                    {groupedRequests.in_progress.map(request => (
                      <RequestCard 
                        key={request.request_id}
                        request={request}
                        onUpdateStatus={handleOpenUpdateModal}
                        actionLoading={actionLoading}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Completed Requests */}
              {groupedRequests.completed.length > 0 && (
                <section className="status-section">
                  <h3>✅ Completed ({groupedRequests.completed.length})</h3>
                  <div className="requests-grid">
                    {groupedRequests.completed.map(request => (
                      <RequestCard 
                        key={request.request_id}
                        request={request}
                        onUpdateStatus={handleOpenUpdateModal}
                        actionLoading={actionLoading}
                        showActions={false}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Update Status Modal */}
        {showUpdateModal && selectedRequest && (
          <div className="modal-overlay">
            <div className="update-modal">
              <div className="modal-header">
                <h3>Update Request Status</h3>
                <button 
                  onClick={() => setShowUpdateModal(false)}
                  className="close-modal"
                >
                  ×
                </button>
              </div>
              
              <div className="modal-content">
                <div className="request-preview">
                  <h4>{selectedRequest.title}</h4>
                  <p>{selectedRequest.property_title} • Unit {selectedRequest.unit_number}</p>
                </div>

                <div className="form-group">
                  <label>Completion Notes (Optional)</label>
                  <textarea
                    value={updateNotes}
                    onChange={(e) => setUpdateNotes(e.target.value)}
                    placeholder="Add any notes about the repair work completed..."
                    rows="3"
                  />
                </div>

                <div className="modal-actions">
                  <button 
                    onClick={() => setShowUpdateModal(false)}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(selectedRequest.request_id, 'completed')}
                    disabled={actionLoading === selectedRequest.request_id}
                    className="complete-btn"
                  >
                    {actionLoading === selectedRequest.request_id ? 'Updating...' : 'Mark as Completed'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PropertiesLayout>
  );
};

// Request Card Component for Landlord
const RequestCard = ({ request, onUpdateStatus, actionLoading, showActions = true }) => {
  const statusInfo = getStatusBadge(request.status);
  const urgencyInfo = getUrgencyBadge(request.urgency);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="request-card landlord">
      <div className="request-header">
        <div className="request-title-section">
          <h3>{request.title}</h3>
          <div className="request-meta">
            <span className="property-info">
              {request.property_title} • Unit {request.unit_number}
            </span>
            <span className="request-date">
              Submitted: {formatDate(request.created_at)}
            </span>
          </div>
        </div>
        
        <div className="request-status">
          <span className={`status-badge ${statusInfo.class}`}>
            {statusInfo.label}
          </span>
          <span className={`urgency-badge ${urgencyInfo.class}`}>
            {urgencyInfo.label}
          </span>
        </div>
      </div>

      <div className="request-details">
        <div className="tenant-info">
          <span className="detail-label">Tenant:</span>
          <span className="detail-value">
            {request.tenant_name} {request.tenant_last_name}
          </span>
          <span className="contact-info">
            📞 {request.tenant_phone} • ✉️ {request.tenant_email}
          </span>
        </div>

        <div className="detail-row">
          <div className="detail-item">
            <span className="detail-label">Issue Type:</span>
            <span className="detail-value">{request.issue_type}</span>
          </div>
          {request.preferred_date && (
            <div className="detail-item">
              <span className="detail-label">Preferred Date:</span>
              <span className="detail-value">{formatDate(request.preferred_date)}</span>
            </div>
          )}
        </div>

        <div className="description-section">
          <span className="detail-label">Description:</span>
          <p className="description-text">{request.description}</p>
        </div>

        {request.landlord_notes && (
          <div className="landlord-notes">
            <span className="detail-label">Your Notes:</span>
            <p className="notes-text">{request.landlord_notes}</p>
          </div>
        )}

        {request.resolution_date && (
          <div className="resolution-info">
            <span className="detail-label">Resolved on:</span>
            <span className="detail-value">{formatDate(request.resolution_date)}</span>
          </div>
        )}
      </div>

      {showActions && (
        <div className="request-actions">
          {request.status === 'pending' && (
            <>
              <button 
                onClick={() => onUpdateStatus(request, 'in_progress')}
                disabled={actionLoading === request.request_id}
                className="action-btn progress-btn"
              >
                {actionLoading === request.request_id ? 'Updating...' : 'Start Work'}
              </button>
              <button 
                onClick={() => onUpdateStatus(request, 'completed')}
                disabled={actionLoading === request.request_id}
                className="action-btn complete-btn"
              >
                {actionLoading === request.request_id ? 'Updating...' : 'Complete'}
              </button>
            </>
          )}
          
          {request.status === 'in_progress' && (
            <button 
              onClick={() => onUpdateStatus(request, 'completed')}
              disabled={actionLoading === request.request_id}
              className="action-btn complete-btn"
            >
              {actionLoading === request.request_id ? 'Updating...' : 'Mark Complete'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default LandlordMaintenance;