import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertiesLayout from '../properties/PropertiesLayout';
import { paymentAPI } from '../../services/api';
import './Payments.css';

const fmt = (n) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n || 0);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

const LandlordPayments = () => {
  const [user, setUser] = useState(null);
  const [payments, setPayments] = useState([]);
  const [pendingBank, setPendingBank] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (!userData) { navigate('/login'); return; }
    setUser(JSON.parse(userData));
  }, [navigate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [allRes, bankRes] = await Promise.all([
        paymentAPI.getLandlordPayments(),
        paymentAPI.getPendingBankPayments(),
      ]);

      const all = allRes.data.data?.payments || [];
      const bank = bankRes.data.data?.payments || [];

      setPayments(all);
      setPendingBank(bank);

      const total = all.filter(p => p.status === 'completed').reduce((s, p) => s + parseFloat(p.amount), 0);
      setStats({
        total,
        completed: all.filter(p => p.status === 'completed').length,
        pending: all.filter(p => p.status === 'pending').length,
      });
    } catch (err) {
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) fetchData(); }, [user, fetchData]);

  const handleBankAction = async (paymentId, action) => {
    setConfirming(paymentId + action);
    try {
      await paymentAPI.confirmBankPayment(paymentId, action);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    } finally {
      setConfirming(null);
    }
  };

  const methodLabel = (m) =>
    m === 'mpesa' ? '📱 M-Pesa' : m === 'bank' ? '🏦 Bank' : m;

  const statusBadge = (status) => ({
    completed: { cls: 'status-completed', label: '✅ Paid' },
    pending: { cls: 'status-pending', label: '⏳ Pending' },
    failed: { cls: 'status-failed', label: '❌ Failed' },
  }[status] || { cls: '', label: status });

  const handleLogout = () => {
    localStorage.removeItem('kwetupay_token');
    localStorage.removeItem('kwetupay_user');
    navigate('/login');
  };

  if (!user) return <div>Loading...</div>;

  return (
    <PropertiesLayout user={user} onLogout={handleLogout}>
      <div className="payments-page">
        <div className="payments-content">

          <div className="payments-page-header">
            <img src="/images/logo.png" alt="Kwetupay" className="payments-page-header-logo" />
            <div className="payments-page-header-content">
              <h1>💰 Rental Income</h1>
              <p>Track and confirm payments from your tenants</p>
            </div>
          </div>

          {/* Stats */}
          <section className="stats-overview">
            <div className="stats-grid">
              <div className="stat-card revenue">
                <div className="stat-icon">💰</div>
                <div className="stat-info">
                  <span className="stat-value">{fmt(stats.total)}</span>
                  <span className="stat-label">Total Confirmed Revenue</span>
                </div>
              </div>
              <div className="stat-card completed">
                <div className="stat-icon">✅</div>
                <div className="stat-info">
                  <span className="stat-value">{stats.completed}</span>
                  <span className="stat-label">Completed Payments</span>
                </div>
              </div>
              <div className="stat-card pending">
                <div className="stat-icon">⏳</div>
                <div className="stat-info">
                  <span className="stat-value">{stats.pending + pendingBank.length}</span>
                  <span className="stat-label">Pending Payments</span>
                </div>
              </div>
            </div>
          </section>

          {/* Pending Bank Transfers — require confirmation */}
          {pendingBank.length > 0 && (
            <section className="payments-section">
              <h2>🏦 Bank Transfers Awaiting Confirmation</h2>
              <p className="section-subtitle">These tenants have submitted bank transfer references. Verify and confirm.</p>
              <div className="pending-bank-grid">
                {pendingBank.map(p => (
                  <div key={p.payment_id} className="pending-bank-card">
                    <div className="pending-bank-header">
                      <div>
                        <strong>{p.tenant_name} {p.tenant_last_name}</strong>
                        <p>{p.tenant_email} · {p.tenant_phone}</p>
                      </div>
                      <span className="status-badge status-pending">⏳ Pending</span>
                    </div>
                    <div className="pending-bank-details">
                      <div className="bank-info-row">
                        <span>Property</span>
                        <span>{p.property_title}{p.unit_number ? ` · Unit ${p.unit_number}` : ''}</span>
                      </div>
                      <div className="bank-info-row">
                        <span>Type</span>
                        <span>{p.payment_type === 'deposit' ? '🔒 Deposit' : '🏠 Rent'}</span>
                      </div>
                      <div className="bank-info-row">
                        <span>Amount</span>
                        <strong style={{ color: '#10b981' }}>{fmt(p.amount)}</strong>
                      </div>
                      <div className="bank-info-row">
                        <span>Reference</span>
                        <strong className="bank-ref-code">{p.bank_reference}</strong>
                      </div>
                      <div className="bank-info-row">
                        <span>Submitted</span>
                        <span>{fmtDate(p.created_at)}</span>
                      </div>
                    </div>
                    <div className="pending-bank-actions">
                      <button
                        className="btn-confirm-payment"
                        onClick={() => handleBankAction(p.payment_id, 'confirm')}
                        disabled={!!confirming}
                      >
                        {confirming === p.payment_id + 'confirm' ? 'Confirming...' : '✅ Confirm Received'}
                      </button>
                      <button
                        className="btn-reject-payment"
                        onClick={() => handleBankAction(p.payment_id, 'reject')}
                        disabled={!!confirming}
                      >
                        {confirming === p.payment_id + 'reject' ? 'Rejecting...' : '❌ Reject'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* All Payments Table */}
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
                <h3>No payments yet</h3>
                <p>Payments from tenants will appear here.</p>
              </div>
            ) : (
              <div className="payments-table">
                <div className="table-header">
                  <span>Date</span>
                  <span>Tenant</span>
                  <span>Property · Unit</span>
                  <span>Type</span>
                  <span>Method</span>
                  <span>Amount</span>
                  <span>Status</span>
                </div>
                {payments.map(p => {
                  const s = statusBadge(p.status);
                  return (
                    <div key={p.payment_id} className="table-row">
                      <span>{fmtDate(p.payment_date || p.created_at)}</span>
                      <span className="tenant-name">{p.tenant_name} {p.tenant_last_name}</span>
                      <span>{p.property_title}{p.unit_number ? ` · ${p.unit_number}` : ''}</span>
                      <span>{p.payment_type === 'deposit' ? '🔒 Deposit' : '🏠 Rent'}</span>
                      <span>{methodLabel(p.payment_method)}</span>
                      <span className="amount">{fmt(p.amount)}</span>
                      <span className={`status-badge ${s.cls}`}>{s.label}</span>
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
