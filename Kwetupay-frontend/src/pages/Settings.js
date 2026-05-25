import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertiesLayout from './properties/PropertiesLayout';
import { userAPI, authAPI } from '../services/api';
import './Profile.css';
import './payments/Payments.css';

const Settings = () => {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', phone_number: '', email: '' });
  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, newPass: false, confirm: false });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState({ text: '', type: '' });
  const [bankForm, setBankForm] = useState({ bank_name: '', account_name: '', account_number: '', branch: '', paybill_number: '', paybill_account: '' });
  const [bankSaving, setBankSaving] = useState(false);
  const [bankMsg, setBankMsg] = useState({ text: '', type: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      setForm({
        first_name: parsed.first_name || '',
        last_name: parsed.last_name || '',
        phone_number: parsed.phone_number || '',
        email: parsed.email || '',
      });
      if (parsed.bank_details) {
        setBankForm({ bank_name: '', account_name: '', account_number: '', branch: '', paybill_number: '', paybill_account: '', ...parsed.bank_details });
      }
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg({ text: '', type: '' });
    try {
      const response = await userAPI.updateProfile(form);
      if (response.data.status === 'success') {
        const updated = { ...user, ...form };
        localStorage.setItem('kwetupay_user', JSON.stringify(updated));
        setUser(updated);
        setMsg({ text: 'Profile updated successfully!', type: 'success' });
      } else {
        setMsg({ text: response.data.message || 'Update failed', type: 'error' });
      }
    } catch (err) {
      setMsg({ text: err.response?.data?.message || 'Error saving changes', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwMsg({ text: '', type: '' });
    if (passwords.newPass !== passwords.confirm) {
      setPwMsg({ text: 'New passwords do not match', type: 'error' });
      return;
    }
    if (passwords.newPass.length < 6) {
      setPwMsg({ text: 'Password must be at least 6 characters', type: 'error' });
      return;
    }
    setPwSaving(true);
    try {
      const response = await authAPI.changePassword({
        current_password: passwords.current,
        new_password: passwords.newPass,
      });
      if (response.data.status === 'success') {
        setPasswords({ current: '', newPass: '', confirm: '' });
        setPwMsg({ text: 'Password changed successfully!', type: 'success' });
      } else {
        setPwMsg({ text: response.data.message || 'Failed to change password', type: 'error' });
      }
    } catch (err) {
      setPwMsg({ text: err.response?.data?.message || 'Error changing password', type: 'error' });
    } finally {
      setPwSaving(false);
    }
  };

  const handleSaveBankDetails = async (e) => {
    e.preventDefault();
    setBankMsg({ text: '', type: '' });
    setBankSaving(true);
    try {
      const res = await userAPI.updateBankDetails(bankForm);
      if (res.data.status === 'success') {
        const updated = { ...user, bank_details: res.data.data.bank_details };
        localStorage.setItem('kwetupay_user', JSON.stringify(updated));
        setUser(updated);
        setBankMsg({ text: 'Bank details saved! Tenants will see these when paying.', type: 'success' });
      } else {
        setBankMsg({ text: res.data.message || 'Save failed', type: 'error' });
      }
    } catch (err) {
      setBankMsg({ text: err.response?.data?.message || 'Error saving bank details', type: 'error' });
    } finally {
      setBankSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('kwetupay_token');
    localStorage.removeItem('kwetupay_user');
    navigate('/login');
  };

  if (!user) return <div>Loading...</div>;

  return (
    <PropertiesLayout user={user} onLogout={handleLogout}>
      <div className="profile-page">
        <div className="profile-content">
          <div className="profile-page-header">
            <h1>⚙️ Account Settings</h1>
            <p>Manage your account preferences and personal information</p>
          </div>

          {msg.text && (
            <div className={`profile-message ${msg.type}`}>
              {msg.type === 'success' ? '✅' : '❌'} {msg.text}
            </div>
          )}

          <div className="settings-grid">
            {/* Profile Information */}
            <div className="settings-card">
              <h2>👤 Personal Information</h2>
              <form onSubmit={handleSave}>
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name</label>
                    <input
                      type="text"
                      value={form.first_name}
                      onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input
                      type="text"
                      value={form.last_name}
                      onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    value={form.phone_number}
                    onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
                    placeholder="254712345678"
                  />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <input type="text" value={user.role} readOnly className="readonly-input" />
                </div>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>

            {/* Change Password */}
            <div className="settings-card">
              <h2>🔒 Change Password</h2>
              {pwMsg.text && (
                <div className={`profile-message ${pwMsg.type}`}>
                  {pwMsg.type === 'success' ? '✅' : '❌'} {pwMsg.text}
                </div>
              )}
              <form onSubmit={handleChangePassword}>
                {user?.google_id && !user?.password_hash && (
                  <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '12px' }}>
                    Your account uses Google Sign-In. You can set a password to also log in with email.
                  </p>
                )}
                {(!user?.google_id || user?.password_hash) && (
                  <div className="form-group">
                    <label>Current Password</label>
                    <div className="password-input-wrapper">
                      <input
                        type={showPw.current ? 'text' : 'password'}
                        value={passwords.current}
                        onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))}
                        placeholder="Enter current password"
                        required
                      />
                      <button type="button" className="password-toggle-btn" onClick={() => setShowPw(s => ({ ...s, current: !s.current }))} tabIndex={-1}>
                        {showPw.current ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label>New Password</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showPw.newPass ? 'text' : 'password'}
                      value={passwords.newPass}
                      onChange={e => setPasswords(p => ({ ...p, newPass: e.target.value }))}
                      placeholder="New password (min 6 characters)"
                      required
                      minLength="6"
                    />
                    <button type="button" className="password-toggle-btn" onClick={() => setShowPw(s => ({ ...s, newPass: !s.newPass }))} tabIndex={-1}>
                      {showPw.newPass ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showPw.confirm ? 'text' : 'password'}
                      value={passwords.confirm}
                      onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                      placeholder="Repeat new password"
                      required
                    />
                    <button type="button" className="password-toggle-btn" onClick={() => setShowPw(s => ({ ...s, confirm: !s.confirm }))} tabIndex={-1}>
                      {showPw.confirm ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
                <button type="submit" className="btn-primary" disabled={pwSaving}>
                  {pwSaving ? 'Saving...' : 'Change Password'}
                </button>
              </form>
            </div>

            {/* Bank Details — landlord only */}
            {user.role === 'landlord' && (
              <div className="settings-card">
                <h2>🏦 Bank / Payment Details</h2>
                <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
                  Tenants will see these details when choosing to pay by bank transfer.
                </p>
                {bankMsg.text && (
                  <div className={`profile-message ${bankMsg.type}`}>
                    {bankMsg.type === 'success' ? '✅' : '❌'} {bankMsg.text}
                  </div>
                )}
                <form onSubmit={handleSaveBankDetails}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Bank Name *</label>
                      <input
                        type="text"
                        value={bankForm.bank_name}
                        onChange={e => setBankForm(f => ({ ...f, bank_name: e.target.value }))}
                        placeholder="e.g. Equity Bank, KCB, NCBA"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Account Name *</label>
                      <input
                        type="text"
                        value={bankForm.account_name}
                        onChange={e => setBankForm(f => ({ ...f, account_name: e.target.value }))}
                        placeholder="Name on the account"
                        required
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Account Number *</label>
                      <input
                        type="text"
                        value={bankForm.account_number}
                        onChange={e => setBankForm(f => ({ ...f, account_number: e.target.value }))}
                        placeholder="Bank account number"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Branch (optional)</label>
                      <input
                        type="text"
                        value={bankForm.branch}
                        onChange={e => setBankForm(f => ({ ...f, branch: e.target.value }))}
                        placeholder="e.g. Nairobi CBD"
                      />
                    </div>
                  </div>
                  <div style={{ borderTop: '1px dashed #e5e7eb', margin: '12px 0 16px', paddingTop: '12px' }}>
                    <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '12px' }}>
                      Optional: M-Pesa Paybill details (if different from above)
                    </p>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Paybill Number</label>
                        <input
                          type="text"
                          value={bankForm.paybill_number}
                          onChange={e => setBankForm(f => ({ ...f, paybill_number: e.target.value }))}
                          placeholder="e.g. 220001"
                        />
                      </div>
                      <div className="form-group">
                        <label>Account Reference</label>
                        <input
                          type="text"
                          value={bankForm.paybill_account}
                          onChange={e => setBankForm(f => ({ ...f, paybill_account: e.target.value }))}
                          placeholder="e.g. Unit 3A or your name"
                        />
                      </div>
                    </div>
                  </div>
                  <button type="submit" className="btn-primary" disabled={bankSaving}>
                    {bankSaving ? 'Saving...' : 'Save Bank Details'}
                  </button>
                </form>
              </div>
            )}

            {/* Notification Preferences */}
            <div className="settings-card">
              <h2>🔔 Notifications</h2>
              <div className="settings-toggle-list">
                <div className="settings-toggle-item">
                  <div>
                    <strong>Booking Updates</strong>
                    <p>Get notified when your booking status changes</p>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <div className="settings-toggle-item">
                  <div>
                    <strong>New Messages</strong>
                    <p>Receive alerts for new direct messages</p>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <div className="settings-toggle-item">
                  <div>
                    <strong>Payment Reminders</strong>
                    <p>Get reminded before rent is due</p>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>

            {/* Account Actions */}
            <div className="settings-card danger-zone">
              <h2>⚠️ Account</h2>
              <div className="account-actions">
                <div className="account-action-item">
                  <div>
                    <strong>Sign Out</strong>
                    <p>Log out from this device</p>
                  </div>
                  <button className="btn-danger-outline" onClick={handleLogout}>
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PropertiesLayout>
  );
};

export default Settings;
