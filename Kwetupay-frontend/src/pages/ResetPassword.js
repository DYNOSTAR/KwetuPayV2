import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import './Login.css';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const [passwords, setPasswords] = useState({ newPass: '', confirm: '' });
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (passwords.newPass !== passwords.confirm) {
      setError('Passwords do not match');
      return;
    }
    if (passwords.newPass.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!token) {
      setError('Invalid reset link. Please request a new one.');
      return;
    }
    setLoading(true);
    try {
      const response = await authAPI.resetPassword(token, passwords.newPass);
      if (response.data.status === 'success') {
        setDone(true);
      } else {
        setError(response.data.message || 'Reset failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="auth-container"
      style={{
        backgroundImage: `url('/images/apartment.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="auth-overlay">
        <div className="auth-box">
          <div className="auth-header">
            <div className="form-logo-large">
              <img src="/images/logo.png" alt="Kwetupay" className="form-logo-img-large" />
              <span className="brand-name-large">Kwetupay</span>
            </div>
            <h2>Set New Password</h2>
            <p>Enter your new password below</p>
          </div>

          {done ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
              <h3 style={{ color: '#10b981', marginBottom: '12px' }}>Password Reset!</h3>
              <p style={{ color: '#374151', marginBottom: '24px' }}>
                Your password has been updated. You can now log in with your new password.
              </p>
              <button className="login-btn" onClick={() => navigate('/login')}>
                Go to Login
              </button>
            </div>
          ) : (
            <>
              {!token && (
                <div className="error-message">Invalid reset link. Please request a new password reset.</div>
              )}
              {error && <div className="error-message">{error}</div>}
              {token && (
                <form onSubmit={handleSubmit} className="auth-form">
                  <div className="form-group">
                    <label>New Password</label>
                    <div className="password-input-wrapper">
                      <input
                        type={showNew ? 'text' : 'password'}
                        value={passwords.newPass}
                        onChange={e => { setPasswords(p => ({ ...p, newPass: e.target.value })); setError(''); }}
                        required
                        minLength="6"
                        placeholder="New password (min 6 characters)"
                        autoFocus
                      />
                      <button type="button" className="password-toggle-btn" onClick={() => setShowNew(!showNew)} tabIndex={-1}>
                        {showNew ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Confirm New Password</label>
                    <div className="password-input-wrapper">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={passwords.confirm}
                        onChange={e => { setPasswords(p => ({ ...p, confirm: e.target.value })); setError(''); }}
                        required
                        placeholder="Repeat new password"
                      />
                      <button type="button" className="password-toggle-btn" onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1}>
                        {showConfirm ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="login-btn">
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </form>
              )}
              <div className="register-link">
                <p>
                  <span onClick={() => navigate('/login')}>Back to Login</span>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
