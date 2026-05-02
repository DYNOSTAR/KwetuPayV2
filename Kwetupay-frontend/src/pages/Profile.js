import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Profile.css';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    date_of_birth: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    occupation: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      setProfile(prev => ({
        ...prev,
        first_name: parsedUser.first_name || '',
        last_name: parsedUser.last_name || '',
        email: parsedUser.email || '',
        phone_number: parsedUser.phone_number || ''
      }));
      // In a real app, you would fetch the complete profile from your API
      fetchUserProfile(parsedUser.user_id);
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const fetchUserProfile = async (userId) => {
    try {
      // This would be replaced with actual API call
      // For now, we'll use mock data
      const mockProfile = {
        date_of_birth: '1990-01-01',
        emergency_contact_name: 'Jane Doe',
        emergency_contact_phone: '+254711222333',
        occupation: 'Software Developer'
      };
      setProfile(prev => ({ ...prev, ...mockProfile }));
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Simulate API call - replace with actual update profile API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update local storage with new user data
      const updatedUser = {
        ...user,
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone_number: profile.phone_number
      };
      
      localStorage.setItem('kwetupay_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      setMessage('Profile updated successfully!');
    } catch (error) {
      setMessage('Error updating profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="profile-page">
        <div className="loading-center">
          <div className="loading-spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>👤 My Profile</h1>
        <p>Manage your personal information and account settings</p>
      </div>

      <div className="profile-content">
        <div className="profile-card">
          <div className="profile-section">
            <h2>Personal Information</h2>
            <form onSubmit={handleSubmit} className="profile-form">
              {message && (
                <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                  {message}
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    name="first_name"
                    value={profile.first_name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    name="last_name"
                    value={profile.last_name}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    value={profile.email}
                    onChange={handleChange}
                    required
                    disabled
                    className="disabled-field"
                  />
                  <small>Email cannot be changed</small>
                </div>

                <div className="form-group">
                  <label>Phone Number *</label>
                  <input
                    type="tel"
                    name="phone_number"
                    value={profile.phone_number}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    name="date_of_birth"
                    value={profile.date_of_birth}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label>Occupation</label>
                  <input
                    type="text"
                    name="occupation"
                    value={profile.occupation}
                    onChange={handleChange}
                    placeholder="e.g., Software Developer"
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Emergency Contact</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Emergency Contact Name</label>
                    <input
                      type="text"
                      name="emergency_contact_name"
                      value={profile.emergency_contact_name}
                      onChange={handleChange}
                      placeholder="Full name of emergency contact"
                    />
                  </div>

                  <div className="form-group">
                    <label>Emergency Contact Phone</label>
                    <input
                      type="tel"
                      name="emergency_contact_phone"
                      value={profile.emergency_contact_phone}
                      onChange={handleChange}
                      placeholder="+254711222333"
                    />
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={() => navigate('/dashboard')}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="save-btn"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          <div className="profile-section">
            <h2>Account Information</h2>
            <div className="account-info">
              <div className="info-item">
                <label>User Role:</label>
                <span className="role-badge">{user.role}</span>
              </div>
              <div className="info-item">
                <label>Account Created:</label>
                <span>{new Date(user.created_at).toLocaleDateString()}</span>
              </div>
              <div className="info-item">
                <label>User ID:</label>
                <span className="user-id">{user.user_id}</span>
              </div>
            </div>
          </div>

          {user.role === 'landlord' && (
            <div className="profile-section">
              <h2>Landlord Tools</h2>
              <div className="landlord-tools">
                <button 
                  onClick={() => navigate('/properties')}
                  className="tool-btn"
                >
                  🏠 Manage Properties
                </button>
                <button 
                  onClick={() => navigate('/bookings')}
                  className="tool-btn"
                >
                  📋 View Booking Requests
                </button>
                <button 
                  onClick={() => alert('Financial reports coming soon!')}
                  className="tool-btn"
                >
                  💰 Financial Reports
                </button>
              </div>
            </div>
          )}

          {user.role === 'tenant' && (
            <div className="profile-section">
              <h2>Tenant Tools</h2>
              <div className="tenant-tools">
                <button 
                  onClick={() => navigate('/properties')}
                  className="tool-btn"
                >
                  🔍 Browse Properties
                </button>
                <button 
                  onClick={() => navigate('/my-bookings')}
                  className="tool-btn"
                >
                  📝 My Bookings
                </button>
                <button 
                  onClick={() => navigate('/messages')}
                  className="tool-btn"
                >
                  💬 My Messages
                </button>
              </div>
            </div>
          )}

          <div className="profile-section danger-zone">
            <h2>Danger Zone</h2>
            <div className="danger-actions">
              <button 
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                    alert('Account deletion would be implemented here');
                  }
                }}
                className="danger-btn"
              >
                🗑️ Delete Account
              </button>
              <small>Permanently delete your account and all associated data</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;