import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertiesLayout from '../properties/PropertiesLayout';
import { paymentAPI } from '../../services/api';
import './Payments.css';

const LandlordPayments = () => {
  const [user, setUser] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingPayments: 0,
    completedPayments: 0
  });
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      setUser(JSON.parse(userData));
      fetchLandlordPayments();
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const fetchLandlordPayments = async () => {
    try {
      setLoading(true);
      
      const response = await paymentAPI.getLandlordPayments();
      const paymentsData = response.data.data?.payments || [];
      setPayments(paymentsData);

      // Calculate stats
      const totalRevenue = paymentsData
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + p.amount, 0);
      
      const pendingPayments = paymentsData.filter(p => p.status === 'pending').length;
      const completedPayments = paymentsData.filter(p => p.status === 'completed').length;

      setStats({
        totalRevenue,
        pendingPayments,
        completedPayments
      });

    } catch (error) {
      console.error('Error fetching landlord payments:', error);
    } finally {
      setLoading(false);
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
      completed: { class: 'status-completed', label: '✅ Paid', description: 'Payment completed' },
      pending: { class: 'status-pending', label: '⏳ Processing', description: 'Payment being processed' },
      failed: { class: 'status-failed', label: '❌ Failed', description: 'Payment failed' }
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
              <h1>💰 Rental Income</h1>
              <p>Track payments from your tenants</p>
            </div>
          </div>

          {/* Stats Overview */}
          <section className="stats-overview">
            <div className="stats-grid">
              <div className="stat-card revenue">
                <div className="stat-icon">💰</div>
                <div className="stat-info">
                  <span className="stat-value">{formatPrice(stats.totalRevenue)}</span>
                  <span className="stat-label">Total Revenue</span>
                </div>
              </div>
              
              <div className="stat-card completed">
                <div className="stat-icon">✅</div>
                <div className="stat-info">
                  <span className="stat-value">{stats.completedPayments}</span>
                  <span className="stat-label">Completed Payments</span>
                </div>
              </div>
              
              <div className="stat-card pending">
                <div className="stat-icon">⏳</div>
                <div className="stat-info">
                  <span className="stat-value">{stats.pendingPayments}</span>
                  <span className="stat-label">Pending Payments</span>
                </div>
              </div>
            </div>
          </section>

          {/* Payments Table */}
          <section className="payments-section">
            <h2>📋 All Payments</h2>
            {loading ? (
              <div className="loading-section">
                <div className="loading-spinner"></div>
                <p>Loading payments...</p>
              </div>
            ) : payments.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💰</div>
                <h3>No payments received</h3>
                <p>Payments from tenants will appear here once they start paying rent.</p>
              </div>
            ) : (
              <div className="payments-table">
                <div className="table-header">
                  <span>Date</span>
                  <span>Tenant</span>
                  <span>Property</span>
                  <span>Unit</span>
                  <span>Amount</span>
                  <span>Method</span>
                  <span>Status</span>
                </div>
                {payments.map(payment => {
                  const statusInfo = getPaymentStatus(payment.status);
                  return (
                    <div key={payment.payment_id} className="table-row">
                      <span>{formatDate(payment.payment_date || payment.created_at)}</span>
                      <span className="tenant-name">{payment.tenant_name}</span>
                      <span>{payment.property_title}</span>
                      <span>{payment.unit_number || 'N/A'}</span>
                      <span className="amount">{formatPrice(payment.amount)}</span>
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
      </div>
    </PropertiesLayout>
  );
};

export default LandlordPayments;