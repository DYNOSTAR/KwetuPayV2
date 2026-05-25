import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertiesLayout from './properties/PropertiesLayout';
import { userAPI } from '../services/api';
import './Profile.css';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    first_name: '', last_name: '', phone_number: '',
    date_of_birth: '', occupation: '', emergency_contact_name: '', emergency_contact_phone: ''
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      setForm(f => ({
        ...f,
        first_name: parsed.first_name || '',
        last_name: parsed.last_name || '',
        phone_number: parsed.phone_number || '',
      }));
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
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
      setMsg({ text: err.response?.data?.message || 'Error saving profile', type: 'error' });
    } finally {
      setSaving(false);
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
            <div className="profile-avatar-large">
              {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
            </div>
            <div>
              <h1>{user.first_name} {user.last_name}</h1>
              <span className="profile-role-badge">{user.role}</span>
              <p>{user.email}</p>
            </div>
          </div>

          {msg.text && (
            <div className={`profile-message ${msg.type}`}>
              {msg.type === 'success' ? '✅' : '❌'} {msg.text}
            </div>
          )}

          <div className="settings-grid">
            <div className="settings-card">
              <h2>👤 Personal Details</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name</label>
                    <input type="text" name="first_name" value={form.first_name} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input type="text" name="last_name" value={form.last_name} onChange={handleChange} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input type="email" value={user.email} readOnly className="readonly-input" />
                  <small>Email cannot be changed</small>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input type="tel" name="phone_number" value={form.phone_number} onChange={handleChange} placeholder="254712345678" />
                  </div>
                  <div className="form-group">
                    <label>Occupation</label>
                    <input type="text" name="occupation" value={form.occupation} onChange={handleChange} placeholder="e.g. Engineer" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Date of Birth</label>
                  <input type="date" name="date_of_birth" value={form.date_of_birth} onChange={handleChange} />
                </div>
                <h3 style={{ marginTop: '20px', marginBottom: '12px', fontSize: '1rem', color: '#495057' }}>Emergency Contact</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Name</label>
                    <input type="text" name="emergency_contact_name" value={form.emergency_contact_name} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input type="tel" name="emergency_contact_phone" value={form.emergency_contact_phone} onChange={handleChange} />
                  </div>
                </div>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>

            <div className="settings-card">
              <h2>📊 Account Summary</h2>
              <div className="account-info-list">
                <div className="account-info-item">
                  <span className="info-label">Role</span>
                  <span className="profile-role-badge">{user.role}</span>
                </div>
                <div className="account-info-item">
                  <span className="info-label">User ID</span>
                  <span className="info-value">#{user.user_id}</span>
                </div>
                {user.created_at && (
                  <div className="account-info-item">
                    <span className="info-label">Member Since</span>
                    <span className="info-value">{new Date(user.created_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'long' })}</span>
                  </div>
                )}
              </div>

              <div className="profile-quick-links">
                <h3>Quick Links</h3>
                {user.role === 'landlord' ? (
                  <>
                    <button className="quick-link-btn" onClick={() => navigate('/properties')}>🏠 My Properties</button>
                    <button className="quick-link-btn" onClick={() => navigate('/bookings/requests')}>📝 Booking Requests</button>
                    <button className="quick-link-btn" onClick={() => navigate('/reports')}>📈 Reports</button>
                  </>
                ) : (
                  <>
                    <button className="quick-link-btn" onClick={() => navigate('/properties/find')}>🔍 Find Properties</button>
                    <button className="quick-link-btn" onClick={() => navigate('/bookings')}>📝 My Bookings</button>
                    <button className="quick-link-btn" onClick={() => navigate('/payments')}>💳 Payments</button>
                  </>
                )}
                <button className="quick-link-btn" onClick={() => navigate('/messages')}>💬 Messages</button>
                <button className="quick-link-btn" onClick={() => navigate('/settings')}>⚙️ Settings</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PropertiesLayout>
  );
};

export default Profile;
