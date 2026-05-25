import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import './Login.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authAPI.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Request failed. Please try again.');
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
            <h2>Reset Your Password</h2>
            <p>Enter your email and we'll send you a reset link</p>
          </div>

          {sent ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
              <h3 style={{ color: '#10b981', marginBottom: '12px' }}>Check your inbox</h3>
              <p style={{ color: '#374151', marginBottom: '24px' }}>
                If <strong>{email}</strong> is registered, a reset link has been sent. Check your email (and spam folder).
              </p>
              <button className="login-btn" onClick={() => navigate('/login')}>
                Back to Login
              </button>
            </div>
          ) : (
            <>
              {error && <div className="error-message">{error}</div>}
              <form onSubmit={handleSubmit} className="auth-form">
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    required
                    placeholder="Enter your registered email"
                    autoFocus
                  />
                </div>
                <button type="submit" disabled={loading} className="login-btn">
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
              <div className="register-link">
                <p>
                  Remember your password?{' '}
                  <span onClick={() => navigate('/login')}>Sign in</span>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
