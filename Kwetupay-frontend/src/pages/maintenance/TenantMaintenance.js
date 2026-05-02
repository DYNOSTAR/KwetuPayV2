import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertiesLayout from '../properties/PropertiesLayout';
import { maintenanceAPI, leaseAPI } from '../../services/api';
import './Maintenance.css';

const TenantMaintenance = () => {
  const [user, setUser] = useState(null);
  const [leases, setLeases] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    unit_id: '',
    issue_type: '',
    title: '',
    description: '',
    urgency: 'medium',
    preferred_date: ''
  });

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      setUser(JSON.parse(userData));
      fetchTenantData();
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const fetchTenantData = async () => {
    try {
      setLoading(true);
      
      // Fetch active leases (to get units)
      const leasesResponse = await leaseAPI.getMyLeases();
      const activeLeases = (leasesResponse.data.data?.leases || []).filter(
        lease => lease.is_active
      );
      setLeases(activeLeases);

      // Fetch maintenance requests
      const requestsResponse = await maintenanceAPI.getMyRequests();
      setRequests(requestsResponse.data.data?.requests || []);

    } catch (error) {
      console.error('Error fetching tenant data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    
    if (!formData.unit_id || !formData.issue_type || !formData.title || !formData.description) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      
      const response = await maintenanceAPI.createRequest(formData);
      
      if (response.data.status === 'success') {
        alert('Maintenance request submitted successfully!');
        setShowRequestModal(false);
        setFormData({
          unit_id: '',
          issue_type: '',
          title: '',
          description: '',
          urgency: 'medium',
          preferred_date: ''
        });
        fetchTenantData(); // Refresh requests list
      } else {
        alert(response.data.message || 'Failed to submit request');
      }
    } catch (error) {
      console.error('Submit request error:', error);
      const errorMessage = error.response?.data?.message || 'Error submitting request. Please try again.';
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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
      pending: { class: 'status-pending', label: '⏳ Pending', description: 'Waiting for landlord response' },
      in_progress: { class: 'status-progress', label: '🔧 In Progress', description: 'Work is being done' },
      completed: { class: 'status-completed', label: '✅ Completed', description: 'Request has been resolved' },
      cancelled: { class: 'status-cancelled', label: '❌ Cancelled', description: 'Request was cancelled' }
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
              <h1>🛠️ Maintenance Requests</h1>
              <p>Report and track maintenance issues in your rental unit</p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="action-bar">
            <div className="requests-info">
              <h3>My Requests ({requests.length})</h3>
            </div>
            
            <button 
              onClick={() => setShowRequestModal(true)}
              className="new-request-btn"
              disabled={leases.length === 0}
            >
              ➕ New Request
            </button>
          </div>

          {leases.length === 0 && (
            <div className="info-banner">
              <p>You need an active lease to submit maintenance requests.</p>
            </div>
          )}

          {/* Requests List */}
          {loading ? (
            <div className="loading-section">
              <div className="loading-spinner"></div>
              <p>Loading your requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🛠️</div>
              <h3>No maintenance requests</h3>
              <p>
                You haven't submitted any maintenance requests yet. 
                {leases.length > 0 ? ' Click "New Request" to report an issue.' : ' You need an active lease to submit requests.'}
              </p>
            </div>
          ) : (
            <div className="requests-list">
              {requests.map(request => {
                const statusInfo = getStatusBadge(request.status);
                const urgencyInfo = getUrgencyBadge(request.urgency);
                
                return (
                  <div key={request.request_id} className="request-card">
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
                          <span className="detail-label">Landlord Notes:</span>
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

                    <div className="request-contact">
                      <span>Contact: {request.landlord_name} 📞 {request.landlord_phone}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* New Request Modal */}
        {showRequestModal && (
          <div className="modal-overlay">
            <div className="maintenance-modal">
              <div className="modal-header">
                <h3>🛠️ New Maintenance Request</h3>
                <button 
                  onClick={() => setShowRequestModal(false)}
                  className="close-modal"
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleSubmitRequest} className="modal-content">
                <div className="form-group">
                  <label>Select Unit *</label>
                  <select
                    name="unit_id"
                    value={formData.unit_id}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Choose your unit</option>
                    {leases.map(lease => (
                      <option key={lease.unit_id} value={lease.unit_id}>
                        {lease.property_title} - Unit {lease.unit_number}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Issue Type *</label>
                  <select
                    name="issue_type"
                    value={formData.issue_type}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select issue type</option>
                    <option value="plumbing">🚰 Plumbing</option>
                    <option value="electrical">💡 Electrical</option>
                    <option value="appliance">🔌 Appliance</option>
                    <option value="heating_cooling">❄️ Heating/Cooling</option>
                    <option value="structural">🏗️ Structural</option>
                    <option value="pest_control">🐜 Pest Control</option>
                    <option value="other">🔧 Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Title *</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="Brief description of the issue"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Description *</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Please provide detailed information about the issue..."
                    rows="4"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Urgency Level</label>
                    <select
                      name="urgency"
                      value={formData.urgency}
                      onChange={handleInputChange}
                    >
                      <option value="low">🟢 Low - Minor issue</option>
                      <option value="medium">🟡 Medium - Needs attention</option>
                      <option value="high">🔴 High - Urgent repair needed</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Preferred Date (Optional)</label>
                    <input
                      type="date"
                      name="preferred_date"
                      value={formData.preferred_date}
                      onChange={handleInputChange}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>

                <div className="modal-actions">
                  <button 
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="submit-request-btn"
                  >
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PropertiesLayout>
  );
};

export default TenantMaintenance;