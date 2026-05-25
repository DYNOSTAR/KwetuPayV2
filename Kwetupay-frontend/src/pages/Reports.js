import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertiesLayout from './properties/PropertiesLayout';
import { paymentAPI, bookingAPI, tenantAPI } from '../services/api';
import './payments/Payments.css';

const Reports = () => {
  const [user, setUser] = useState(null);
  const [payments, setPayments] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      fetchData();
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [paymentsRes, bookingsRes] = await Promise.all([
        paymentAPI.getLandlordPayments(),
        bookingAPI.getLandlordBookings(),
      ]);
      setPayments(paymentsRes.data.data?.payments || []);
      setBookings(bookingsRes.data.data?.bookings || []);
    } catch (err) {
      console.error('Reports fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('kwetupay_token');
    localStorage.removeItem('kwetupay_user');
    navigate('/login');
  };

  const formatPrice = (p) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(p || 0);

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  const totalRevenue = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  const completedBookings = bookings.filter(b => b.booking_status === 'paid' || b.booking_status === 'approved').length;
  const pendingBookings = bookings.filter(b => b.booking_status === 'pending').length;

  if (!user) return <div>Loading...</div>;

  return (
    <PropertiesLayout user={user} onLogout={handleLogout}>
      <div className="payments-page">
        <div className="payments-content">
          <div className="payments-page-header">
            <img src="/images/logo.png" alt="Kwetupay Logo" className="payments-page-header-logo" />
            <div className="payments-page-header-content">
              <h1>📈 Reports & Analytics</h1>
              <p>Overview of your property performance and revenue</p>
            </div>
          </div>

          {loading ? (
            <div className="loading-section">
              <div className="loading-spinner"></div>
              <p>Loading reports...</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="reports-summary-grid">
                <div className="report-stat-card revenue">
                  <div className="report-stat-icon">💰</div>
                  <div className="report-stat-info">
                    <span className="report-stat-value">{formatPrice(totalRevenue)}</span>
                    <span className="report-stat-label">Total Revenue</span>
                  </div>
                </div>
                <div className="report-stat-card bookings">
                  <div className="report-stat-icon">📝</div>
                  <div className="report-stat-info">
                    <span className="report-stat-value">{bookings.length}</span>
                    <span className="report-stat-label">Total Bookings</span>
                  </div>
                </div>
                <div className="report-stat-card active">
                  <div className="report-stat-icon">✅</div>
                  <div className="report-stat-info">
                    <span className="report-stat-value">{completedBookings}</span>
                    <span className="report-stat-label">Active/Completed</span>
                  </div>
                </div>
                <div className="report-stat-card pending">
                  <div className="report-stat-icon">⏳</div>
                  <div className="report-stat-info">
                    <span className="report-stat-value">{pendingBookings}</span>
                    <span className="report-stat-label">Pending Requests</span>
                  </div>
                </div>
              </div>

              {/* Payment History */}
              <section className="leases-section">
                <h2>💳 Payment History</h2>
                {payments.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">💰</div>
                    <h3>No payments yet</h3>
                    <p>Payment records will appear here once tenants complete payments.</p>
                  </div>
                ) : (
                  <div className="payments-table">
                    <div className="table-header reports-table-header">
                      <span>Date</span>
                      <span>Tenant</span>
                      <span>Property / Unit</span>
                      <span>Type</span>
                      <span>Amount</span>
                      <span>Status</span>
                    </div>
                    {payments.map(p => (
                      <div key={p.payment_id} className="table-row reports-table-row">
                        <span>{formatDate(p.payment_date || p.created_at)}</span>
                        <span>{p.tenant_name} {p.tenant_last_name}</span>
                        <span>{p.property_title}{p.unit_number ? ` · Unit ${p.unit_number}` : ''}</span>
                        <span className="payment-type-label">
                          {p.payment_type === 'deposit' ? '🔒 Deposit' : '🏠 Rent'}
                        </span>
                        <span style={{ fontWeight: 700, color: '#28a745' }}>{formatPrice(p.amount)}</span>
                        <span className={`status-badge ${p.status === 'completed' ? 'status-completed' : 'status-pending'}`}>
                          {p.status === 'completed' ? '✅ Paid' : '⏳ Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Bookings History */}
              <section className="leases-section">
                <h2>📋 Booking History</h2>
                {bookings.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📝</div>
                    <h3>No bookings yet</h3>
                  </div>
                ) : (
                  <div className="payments-table">
                    <div className="table-header reports-table-header">
                      <span>Date</span>
                      <span>Tenant</span>
                      <span>Property</span>
                      <span>Move-in</span>
                      <span>Status</span>
                    </div>
                    {bookings.map(b => (
                      <div key={b.booking_id} className="table-row reports-table-row">
                        <span>{formatDate(b.created_at)}</span>
                        <span>{b.tenant_name}</span>
                        <span>{b.property_title}</span>
                        <span>{formatDate(b.start_date)}</span>
                        <span className={`status-badge status-${b.booking_status === 'approved' || b.booking_status === 'paid' ? 'completed' : b.booking_status === 'pending' ? 'pending' : 'cancelled'}`}>
                          {b.booking_status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </PropertiesLayout>
  );
};

export default Reports;
