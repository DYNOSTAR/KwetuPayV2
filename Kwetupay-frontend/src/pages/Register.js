import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { authAPI } from '../services/api';
import './Login.css';

const Register = () => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    password: '',
    role: 'tenant',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // Google new-user role modal
  const [googlePending, setGooglePending] = useState(null);
  const [googleRole, setGoogleRole] = useState('tenant');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const storeAndRedirect = (token, user) => {
    localStorage.setItem('kwetupay_token', token);
    localStorage.setItem('kwetupay_user', JSON.stringify(user));
    navigate('/dashboard', { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await authAPI.register(formData);
      const data = response.data;
      if (data.status === 'success') {
        storeAndRedirect(data.data.token, data.data.user);
        // Show email verification notice (user is already navigated but we can set it before)
        setSuccess('Account created! Please check your email to verify your address.');
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setGoogleLoading(true);
    setError('');
    try {
      const response = await authAPI.googleLogin(credentialResponse.credential, null);
      const data = response.data;
      if (data.status === 'success') {
        storeAndRedirect(data.data.token, data.data.user);
      } else if (data.status === 'needs_role') {
        setGooglePending({ credential: credentialResponse.credential, ...data.data });
      } else {
        setError(data.message || 'Google sign-up failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-up failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleRoleSubmit = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const response = await authAPI.googleLogin(googlePending.credential, googleRole);
      const data = response.data;
      if (data.status === 'success') {
        setGooglePending(null);
        storeAndRedirect(data.data.token, data.data.user);
      } else {
        setError(data.message || 'Account creation failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Account creation failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div
      className="auth-container register-container"
      style={{
        backgroundImage: `url('/images/apartment.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="auth-overlay">
        <div className="auth-box">
          <div className="auth-header">
            <div className="form-logo-large">
              <img src="/images/logo.png" alt="Kwetupay Logo" className="form-logo-img-large" />
              <span className="brand-name-large">Kwetupay</span>
            </div>
            <h2>Create Your Account</h2>
            <p>Join thousands of satisfied users</p>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="google-btn-wrapper" style={{ marginBottom: '16px' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google sign-up failed')}
              useOneTap={false}
              theme="outline"
              size="large"
              width="100%"
              text="signup_with"
            />
          </div>

          <div className="auth-divider">
            <span>or sign up with email</span>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  placeholder="First name"
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                  placeholder="Last name"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="Enter your email"
              />
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleChange}
                required
                placeholder="254712345678"
              />
            </div>

            <div className="form-group">
              <label>I am a</label>
              <select name="role" value={formData.role} onChange={handleChange} className="role-select">
                <option value="tenant">Tenant — looking for a place</option>
                <option value="landlord">Landlord — listing properties</option>
              </select>
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength="6"
                  placeholder="Create a password (min 6 chars)"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading || googleLoading} className="login-btn">
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>

          <div className="register-link">
            <p>
              Already have an account?{' '}
              <span onClick={() => navigate('/login')}>Sign in</span>
            </p>
          </div>
        </div>
      </div>

      {/* Google new-user role selection modal */}
      {googlePending && (
        <div className="auth-modal-overlay">
          <div className="auth-modal">
            <h3>One last step!</h3>
            <p>Welcome, <strong>{googlePending.google_name}</strong>! How will you use Kwetupay?</p>
            <div className="role-choice-btns">
              <button
                className={`role-choice-btn ${googleRole === 'tenant' ? 'selected' : ''}`}
                onClick={() => setGoogleRole('tenant')}
              >
                🏠 I'm looking for a place
                <span>Tenant</span>
              </button>
              <button
                className={`role-choice-btn ${googleRole === 'landlord' ? 'selected' : ''}`}
                onClick={() => setGoogleRole('landlord')}
              >
                🏢 I'm listing properties
                <span>Landlord</span>
              </button>
            </div>
            {error && <div className="error-message">{error}</div>}
            <button
              className="login-btn"
              onClick={handleGoogleRoleSubmit}
              disabled={googleLoading}
            >
              {googleLoading ? 'Creating account...' : 'Complete Sign Up'}
            </button>
            <button
              className="btn-link"
              onClick={() => { setGooglePending(null); setError(''); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Register;
