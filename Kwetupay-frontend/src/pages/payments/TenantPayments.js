import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertiesLayout from '../properties/PropertiesLayout';
import { leaseAPI, paymentAPI } from '../../services/api';
import './Payments.css';

const TenantPayments = () => {
  const [user, setUser] = useState(null);
  const [leases, setLeases] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedLease, setSelectedLease] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      const userObj = JSON.parse(userData);
      setUser(userObj);
      setPhoneNumber(userObj.phone_number || '');
      fetchTenantData();
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const fetchTenantData = async () => {
    try {
      setLoading(true);
      
      // Fetch active leases
      const leasesResponse = await leaseAPI.getMyLeases();
      const activeLeases = (leasesResponse.data.data?.leases || []).filter(
        lease => lease.is_active
      );
      setLeases(activeLeases);

      // Fetch payment history
      const paymentsResponse = await paymentAPI.getMyPayments();
      setPayments(paymentsResponse.data.data?.payments || []);

    } catch (error) {
      console.error('Error fetching tenant data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMakePayment = (lease) => {
    setSelectedLease(lease);
    setAmount(lease.monthly_rent.toString());
    setShowPaymentModal(true);
  };

  const handleProcessPayment = async () => {
    if (!phoneNumber || !amount || !selectedLease) {
      alert('Please fill in all required fields');
      return;
    }

    if (parseFloat(amount) < selectedLease.monthly_rent) {
      alert(`Payment amount must be at least ${formatPrice(selectedLease.monthly_rent)}`);
      return;
    }

    try {
      setPaymentLoading(selectedLease.lease_id);
      
      const paymentData = {
        lease_id: selectedLease.lease_id,
        amount: parseFloat(amount),
        phone_number: phoneNumber,
        payment_method: 'mpesa'
      };

      const response = await paymentAPI.initiateMpesa(paymentData);
      
      if (response.data.status === 'success') {
        alert('✅ M-Pesa prompt sent to your phone! Please complete the payment.');
        setShowPaymentModal(false);
        setSelectedLease(null);
        setAmount('');
        
        // Refresh data after successful payment
        setTimeout(() => {
          fetchTenantData();
        }, 3000);
      } else {
        alert(response.data.message || 'Failed to initiate payment');
      }
    } catch (error) {
      console.error('Payment error:', error);
      const errorMessage = error.response?.data?.message || 'Error processing payment. Please try again.';
      alert(errorMessage);
    } finally {
      setPaymentLoading(null);
    }
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

  const getPaymentStatus = (status) => {
    const statusConfig = {
      completed: { class: 'status-completed', label: '✅ Paid' },
      pending: { class: 'status-pending', label: '⏳ Processing' },
      failed: { class: 'status-failed', label: '❌ Failed' },
      cancelled: { class: 'status-cancelled', label: '🚫 Cancelled' }
    };
    return statusConfig[status] || { class: 'status-unknown', label: status };
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
      <div className="payments-page">
        <div className="payments-content">
          {/* Page Header */}
          <div className="payments-page-header">
            <img 
              src="/images/logo.png" 
              alt="Kwetupay Logo" 
              className="payments-page-header-logo"
            />
            <div className="payments-page-header-content">
              <h1>💰 Rent Payments</h1>
              <p>Manage your rental payments securely via M-Pesa</p>
            </div>
          </div>

          {/* Active Leases Section */}
          <section className="leases-section">
            <h2>📄 Active Leases</h2>
            {loading ? (
              <div className="loading-section">
                <div className="loading-spinner"></div>
                <p>Loading your leases...</p>
              </div>
            ) : leases.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📄</div>
                <h3>No active leases</h3>
                <p>You don't have any active leases requiring payment.</p>
              </div>
            ) : (
              <div className="leases-grid">
                {leases.map(lease => (
                  <div key={lease.lease_id} className="lease-card">
                    <div className="lease-header">
                      <h3>{lease.property_title}</h3>
                      {lease.unit_number && <span className="unit-number">Unit {lease.unit_number}</span>}
                    </div>
                    
                    <div className="lease-details">
                      <div className="detail-item">
                        <span className="label">Monthly Rent:</span>
                        <span className="value">{formatPrice(lease.monthly_rent)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Next Payment Due:</span>
                        <span className="value">{formatDate(lease.next_payment_date)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Landlord:</span>
                        <span className="value">{lease.landlord_name}</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleMakePayment(lease)}
                      className="pay-now-btn"
                      disabled={paymentLoading === lease.lease_id}
                    >
                      {paymentLoading === lease.lease_id ? 'Processing...' : '💳 Pay Now'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Payment History Section */}
          <section className="payment-history-section">
            <h2>📋 Payment History</h2>
            {payments.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💰</div>
                <h3>No payment history</h3>
                <p>Your payment history will appear here after making payments.</p>
              </div>
            ) : (
              <div className="payments-table">
                <div className="table-header">
                  <span>Date</span>
                  <span>Property</span>
                  <span>Amount</span>
                  <span>Method</span>
                  <span>Status</span>
                </div>
                {payments.map(payment => {
                  const statusInfo = getPaymentStatus(payment.status);
                  return (
                    <div key={payment.payment_id} className="table-row">
                      <span>{formatDate(payment.payment_date || payment.created_at)}</span>
                      <span>{payment.property_title}</span>
                      <span>{formatPrice(payment.amount)}</span>
                      <span className="payment-method">
                        {payment.payment_method === 'mpesa' ? '📱 M-Pesa' : payment.payment_method}
                      </span>
                      <span className={`status-badge ${statusInfo.class}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && selectedLease && (
          <div className="modal-overlay">
            <div className="payment-modal">
              <div className="modal-header">
                <h3>💳 Make Payment</h3>
                <button 
                  onClick={() => setShowPaymentModal(false)}
                  className="close-modal"
                >
                  ×
                </button>
              </div>
              
              <div className="modal-content">
                <div className="payment-details">
                  <h4>{selectedLease.property_title}</h4>
                  {selectedLease.unit_number && <p>Unit {selectedLease.unit_number}</p>}
                  <div className="amount-due">
                    <span>Monthly Rent:</span>
                    <span>{formatPrice(selectedLease.monthly_rent)}</span>
                  </div>
                </div>

                <div className="payment-form">
                  <div className="form-group">
                    <label>Phone Number (M-Pesa)</label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="254712345678"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Amount (KES)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Enter amount"
                      min={selectedLease.monthly_rent}
                      required
                    />
                    <small>Minimum: {formatPrice(selectedLease.monthly_rent)}</small>
                  </div>
                </div>

                <div className="modal-actions">
                  <button 
                    onClick={() => setShowPaymentModal(false)}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleProcessPayment}
                    disabled={paymentLoading === selectedLease.lease_id}
                    className="confirm-payment-btn"
                  >
                    {paymentLoading === selectedLease.lease_id ? 'Processing...' : 'Confirm Payment'}
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

export default TenantPayments;