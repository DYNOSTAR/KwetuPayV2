import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertiesLayout from '../properties/PropertiesLayout';
import { leaseAPI, paymentAPI } from '../../services/api';
import './Payments.css';

const fmt = (n) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n || 0);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

const statusBadge = (status) => ({
  completed: { cls: 'status-completed', label: '✅ Paid' },
  pending: { cls: 'status-pending', label: '⏳ Pending' },
  failed: { cls: 'status-failed', label: '❌ Failed' },
  cancelled: { cls: 'status-cancelled', label: '🚫 Cancelled' },
}[status] || { cls: '', label: status });

const TenantPayments = () => {
  const [user, setUser] = useState(null);
  const [leases, setLeases] = useState([]);
  const [approvedBookings, setApprovedBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modal, setModal] = useState(null); // { type: 'first'|'recurring', item: ... }
  const [payMethod, setPayMethod] = useState('mpesa'); // 'mpesa' | 'bank'
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [bankRef, setBankRef] = useState('');
  const [bankDetails, setBankDetails] = useState(null);
  const [bankDetailsLoading, setBankDetailsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalMsg, setModalMsg] = useState({ text: '', type: '' });

  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (!userData) { navigate('/login'); return; }
    const u = JSON.parse(userData);
    setUser(u);
    setPhone(u.phone_number || '');
  }, [navigate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [leasesRes, bookingsRes, paymentsRes] = await Promise.all([
        leaseAPI.getMyLeases(),
        paymentAPI.getApprovedBookings(),
        paymentAPI.getMyPayments(),
      ]);
      setLeases((leasesRes.data.data?.leases || []).filter(l => l.is_active || l.status === 'active'));
      setApprovedBookings(bookingsRes.data.data?.bookings || []);
      setPayments(paymentsRes.data.data?.payments || []);
    } catch (err) {
      console.error('Error fetching payment data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) fetchData(); }, [user, fetchData]);

  const openModal = (type, item) => {
    setModal({ type, item });
    setPayMethod('mpesa');
    setBankRef('');
    setBankDetails(null);
    setModalMsg({ text: '', type: '' });
    setAmount(type === 'first' ? String(item.payment_required.total_amount) : String(item.monthly_rent));
  };

  const closeModal = () => {
    setModal(null);
    setSubmitting(false);
    setModalMsg({ text: '', type: '' });
  };

  const loadBankDetails = async () => {
    if (bankDetails || bankDetailsLoading || !modal) return;
    setBankDetailsLoading(true);
    try {
      const params = modal.type === 'first'
        ? { booking_id: modal.item.booking_id }
        : { lease_id: modal.item.lease_id };
      const res = await paymentAPI.getBankDetails(params);
      setBankDetails(res.data.data);
    } catch {
      setBankDetails({ error: true });
    } finally {
      setBankDetailsLoading(false);
    }
  };

  const switchMethod = (m) => {
    setPayMethod(m);
    if (m === 'bank') loadBankDetails();
  };

  const handlePay = async () => {
    setModalMsg({ text: '', type: '' });
    if (payMethod === 'mpesa' && !phone) {
      setModalMsg({ text: 'Enter your M-Pesa phone number', type: 'error' }); return;
    }
    if (payMethod === 'bank' && !bankRef.trim()) {
      setModalMsg({ text: 'Enter your bank transfer reference number', type: 'error' }); return;
    }

    setSubmitting(true);
    try {
      let res;
      if (modal.type === 'first') {
        res = await paymentAPI.processBookingPayment(modal.item.booking_id, {
          payment_method: payMethod,
          phone_number: phone,
          bank_reference: bankRef,
        });
      } else {
        if (parseFloat(amount) < modal.item.monthly_rent) {
          setModalMsg({ text: `Amount must be at least ${fmt(modal.item.monthly_rent)}`, type: 'error' });
          setSubmitting(false); return;
        }
        res = await paymentAPI.initiateMpesa({
          lease_id: modal.item.lease_id,
          amount: parseFloat(amount),
          phone_number: phone,
          payment_method: payMethod,
          bank_reference: bankRef,
        });
      }

      if (res.data.status === 'success') {
        setModalMsg({ text: res.data.message, type: 'success' });
        setTimeout(() => { closeModal(); fetchData(); }, 2500);
      } else {
        setModalMsg({ text: res.data.message || 'Payment failed', type: 'error' });
      }
    } catch (err) {
      setModalMsg({ text: err.response?.data?.message || 'Payment failed. Please try again.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('kwetupay_token');
    localStorage.removeItem('kwetupay_user');
    navigate('/login');
  };

  if (!user) return <div>Loading...</div>;

  const minAmt = modal?.type === 'first'
    ? modal.item.payment_required.total_amount
    : modal?.item.monthly_rent;

  return (
    <PropertiesLayout user={user} onLogout={handleLogout}>
      <div className="payments-page">
        <div className="payments-content">

          <div className="payments-page-header">
            <img src="/images/logo.png" alt="Kwetupay" className="payments-page-header-logo" />
            <div className="payments-page-header-content">
              <h1>💰 Rent Payments</h1>
              <p>Pay via M-Pesa or bank transfer — fast, secure, traceable</p>
            </div>
          </div>

          {loading ? (
            <div className="loading-section">
              <div className="loading-spinner"></div>
              <p>Loading your payments...</p>
            </div>
          ) : (
            <>
              {/* ── First Payment Due ─────────────────── */}
              {approvedBookings.length > 0 && (
                <section className="leases-section">
                  <h2>🔔 First Payment Required</h2>
                  <p className="section-subtitle">
                    Your booking is approved. Pay to activate your lease.
                  </p>
                  <div className="leases-grid">
                    {approvedBookings.map(bk => (
                      <div key={bk.booking_id} className="lease-card first-payment-card">
                        <div className="lease-header">
                          <h3>{bk.property_title}</h3>
                          <span className="unit-number">Unit {bk.unit_number} · {bk.unit_type}</span>
                        </div>
                        <div className="first-payment-breakdown">
                          <div className="breakdown-row">
                            <span>First Month Rent</span>
                            <span>{fmt(bk.payment_required.monthly_rent)}</span>
                          </div>
                          <div className="breakdown-row">
                            <span>Security Deposit</span>
                            <span>{fmt(bk.payment_required.security_deposit)}</span>
                          </div>
                          <div className="breakdown-row breakdown-total">
                            <span>Total Due Now</span>
                            <span>{fmt(bk.payment_required.total_amount)}</span>
                          </div>
                        </div>
                        <div className="lease-details">
                          <div className="detail-item">
                            <span className="label">Landlord</span>
                            <span className="value">{bk.landlord_name}</span>
                          </div>
                          <div className="detail-item">
                            <span className="label">Move-in</span>
                            <span className="value">{fmtDate(bk.start_date)}</span>
                          </div>
                          <div className="detail-item">
                            <span className="label">Location</span>
                            <span className="value">{bk.city}</span>
                          </div>
                        </div>
                        <button className="pay-now-btn first-payment-btn" onClick={() => openModal('first', bk)}>
                          💳 Pay {fmt(bk.payment_required.total_amount)}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Active Leases ─────────────────────── */}
              <section className="leases-section">
                <h2>📄 Active Leases</h2>
                {leases.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📄</div>
                    <h3>No active leases</h3>
                    <p>Active lease payment options will appear here.</p>
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
                            <span className="label">Monthly Rent</span>
                            <span className="value">{fmt(lease.monthly_rent)}</span>
                          </div>
                          <div className="detail-item">
                            <span className="label">Next Due</span>
                            <span className="value">{fmtDate(lease.next_payment_date)}</span>
                          </div>
                          <div className="detail-item">
                            <span className="label">Lease Expires</span>
                            <span className="value">{fmtDate(lease.end_date)}</span>
                          </div>
                        </div>
                        <button className="pay-now-btn" onClick={() => openModal('recurring', lease)}>
                          💳 Pay Rent
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── Payment History ───────────────────── */}
              <section className="payment-history-section">
                <h2>📋 Payment History</h2>
                {payments.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">💰</div>
                    <h3>No payment history</h3>
                    <p>Your payments will appear here.</p>
                  </div>
                ) : (
                  <div className="payments-table">
                    <div className="table-header">
                      <span>Date</span>
                      <span>Property</span>
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
                          <span>{p.property_title}{p.unit_number ? ` · ${p.unit_number}` : ''}</span>
                          <span className="payment-type-label">
                            {p.payment_type === 'deposit' ? '🔒 Deposit' : '🏠 Rent'}
                          </span>
                          <span>
                            {p.payment_method === 'mpesa' ? '📱 M-Pesa' : '🏦 Bank'}
                          </span>
                          <span>{fmt(p.amount)}</span>
                          <span className={`status-badge ${s.cls}`}>{s.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {/* ── Payment Modal ───────────────────────────────────── */}
      {modal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="payment-modal pay-modal-wide">
            <div className="modal-header">
              <h3>{modal.type === 'first' ? '🔑 First Payment' : '💳 Pay Rent'}</h3>
              <button className="close-modal" onClick={closeModal}>×</button>
            </div>

            <div className="modal-content">
              {/* Summary */}
              <div className="pay-modal-summary">
                <div className="pay-modal-property">
                  <strong>{modal.item.property_title}</strong>
                  {modal.item.unit_number && <span> · Unit {modal.item.unit_number}</span>}
                </div>
                {modal.type === 'first' ? (
                  <div className="first-payment-breakdown compact">
                    <div className="breakdown-row">
                      <span>First Month Rent</span>
                      <span>{fmt(modal.item.payment_required.monthly_rent)}</span>
                    </div>
                    <div className="breakdown-row">
                      <span>Security Deposit</span>
                      <span>{fmt(modal.item.payment_required.security_deposit)}</span>
                    </div>
                    <div className="breakdown-row breakdown-total">
                      <span>Total</span>
                      <span>{fmt(modal.item.payment_required.total_amount)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="amount-due">
                    <span>Monthly Rent</span>
                    <strong>{fmt(modal.item.monthly_rent)}</strong>
                  </div>
                )}
              </div>

              {/* Method tabs */}
              <div className="pay-method-tabs">
                <button
                  className={`pay-method-tab ${payMethod === 'mpesa' ? 'active' : ''}`}
                  onClick={() => switchMethod('mpesa')}
                >
                  <span className="tab-icon">📱</span>
                  <span>M-Pesa</span>
                </button>
                <button
                  className={`pay-method-tab ${payMethod === 'bank' ? 'active' : ''}`}
                  onClick={() => switchMethod('bank')}
                >
                  <span className="tab-icon">🏦</span>
                  <span>Bank Transfer</span>
                </button>
              </div>

              {/* M-Pesa panel */}
              {payMethod === 'mpesa' && (
                <div className="pay-panel">
                  <div className="mpesa-how">
                    <div className="mpesa-step">
                      <span className="step-num">1</span>
                      <span>Enter your Safaricom number below</span>
                    </div>
                    <div className="mpesa-step">
                      <span className="step-num">2</span>
                      <span>Click "Send M-Pesa Prompt"</span>
                    </div>
                    <div className="mpesa-step">
                      <span className="step-num">3</span>
                      <span>Enter your M-Pesa PIN on your phone</span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Safaricom Number</label>
                    <div className="phone-input-row">
                      <span className="phone-prefix">+254</span>
                      <input
                        type="tel"
                        value={phone.replace(/^254/, '').replace(/^\+254/, '')}
                        onChange={e => setPhone('254' + e.target.value.replace(/\D/g, ''))}
                        placeholder="7XXXXXXXX"
                        maxLength="9"
                      />
                    </div>
                  </div>

                  {modal.type === 'recurring' && (
                    <div className="form-group">
                      <label>Amount (KES)</label>
                      <input
                        type="number"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        min={minAmt}
                        placeholder={String(minAmt)}
                      />
                      <small>Minimum: {fmt(minAmt)}</small>
                    </div>
                  )}

                  <div className="mpesa-note">
                    📌 You will receive a push notification on your phone. Enter your PIN to complete.
                  </div>
                </div>
              )}

              {/* Bank Transfer panel */}
              {payMethod === 'bank' && (
                <div className="pay-panel">
                  {bankDetailsLoading ? (
                    <div className="loading-inline">Loading bank details...</div>
                  ) : bankDetails?.error ? (
                    <div className="bank-details-unavailable">
                      ⚠️ Landlord hasn't set up bank details yet. Use M-Pesa or contact your landlord directly.
                    </div>
                  ) : bankDetails?.bank_details ? (
                    <div className="bank-details-card">
                      <h4>Transfer to this account:</h4>
                      <div className="bank-detail-row">
                        <span>Bank</span>
                        <strong>{bankDetails.bank_details.bank_name}</strong>
                      </div>
                      <div className="bank-detail-row">
                        <span>Account Name</span>
                        <strong>{bankDetails.bank_details.account_name}</strong>
                      </div>
                      <div className="bank-detail-row">
                        <span>Account Number</span>
                        <strong className="copyable">{bankDetails.bank_details.account_number}</strong>
                      </div>
                      {bankDetails.bank_details.branch && (
                        <div className="bank-detail-row">
                          <span>Branch</span>
                          <strong>{bankDetails.bank_details.branch}</strong>
                        </div>
                      )}
                      {bankDetails.bank_details.paybill_number && (
                        <>
                          <div className="bank-detail-divider">— or via M-Pesa Paybill —</div>
                          <div className="bank-detail-row">
                            <span>Paybill Number</span>
                            <strong>{bankDetails.bank_details.paybill_number}</strong>
                          </div>
                          {bankDetails.bank_details.paybill_account && (
                            <div className="bank-detail-row">
                              <span>Account Ref</span>
                              <strong>{bankDetails.bank_details.paybill_account}</strong>
                            </div>
                          )}
                        </>
                      )}
                      <div className="bank-amount-row">
                        <span>Amount to send</span>
                        <strong className="bank-amount">
                          {fmt(modal.type === 'first' ? modal.item.payment_required.total_amount : parseFloat(amount) || minAmt)}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div className="bank-details-unavailable">
                      ⚠️ Landlord hasn't added bank details yet. Please use M-Pesa or contact them directly.
                    </div>
                  )}

                  {modal.type === 'recurring' && (
                    <div className="form-group" style={{ marginTop: '12px' }}>
                      <label>Amount (KES)</label>
                      <input
                        type="number"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        min={minAmt}
                        placeholder={String(minAmt)}
                      />
                      <small>Minimum: {fmt(minAmt)}</small>
                    </div>
                  )}

                  <div className="form-group">
                    <label>Bank Transfer Reference / Transaction ID</label>
                    <input
                      type="text"
                      value={bankRef}
                      onChange={e => setBankRef(e.target.value)}
                      placeholder="e.g. EQ2025120045678"
                    />
                    <small>Enter the reference number from your bank receipt</small>
                  </div>

                  <div className="mpesa-note">
                    📌 Transfer the amount above to the bank account, then enter your reference number. Your landlord will confirm the payment.
                  </div>
                </div>
              )}

              {/* Messages */}
              {modalMsg.text && (
                <div className={`modal-message ${modalMsg.type}`}>
                  {modalMsg.text}
                </div>
              )}

              {/* Actions */}
              <div className="modal-actions">
                <button className="cancel-btn" onClick={closeModal} disabled={submitting}>
                  Cancel
                </button>
                <button
                  className="confirm-payment-btn"
                  onClick={handlePay}
                  disabled={submitting}
                >
                  {submitting
                    ? 'Processing...'
                    : payMethod === 'mpesa'
                    ? `📱 Send M-Pesa Prompt`
                    : `🏦 Submit Transfer`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PropertiesLayout>
  );
};

export default TenantPayments;
