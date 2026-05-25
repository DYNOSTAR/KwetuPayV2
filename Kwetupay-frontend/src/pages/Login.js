import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { authAPI } from '../services/api';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  // Google new-user role modal
  const [googlePending, setGooglePending] = useState(null); // { credential, email, name }
  const [googleRole, setGoogleRole] = useState('tenant');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const storeAndRedirect = (token, user) => {
    localStorage.setItem('kwetupay_token', token);
    localStorage.setItem('kwetupay_user', JSON.stringify(user));
    if (user.role === 'admin' || user.role === 'super_admin') {
      navigate('/admin', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await authAPI.login(formData);
      const data = response.data;
      if (data.status === 'success') {
        storeAndRedirect(data.data.token, data.data.user);
      } else {
        setError(data.message || 'Login failed');
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
        setError(data.message || 'Google login failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Google login failed');
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
      className="auth-container login-container"
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
            <h2>Sign In to Your Account</h2>
            <p>Welcome back! Please enter your details</p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
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
              <label>Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="Enter your password"
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

            <div className="auth-forgot-link">
              <Link to="/forgot-password">Forgot password?</Link>
            </div>

            <button type="submit" disabled={loading || googleLoading} className="login-btn">
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <div className="google-btn-wrapper">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google login failed')}
              useOneTap={false}
              theme="outline"
              size="large"
              width="100%"
              text="signin_with"
            />
          </div>

          <div className="register-link">
            <p>
              Don't have an account?{' '}
              <span onClick={() => navigate('/register')}>Sign up</span>
            </p>
          </div>
        </div>
      </div>

      {/* Google new-user role selection modal */}
      {googlePending && (
        <div className="auth-modal-overlay">
          <div className="auth-modal">
            <h3>Almost there!</h3>
            <p>Welcome, <strong>{googlePending.google_name}</strong>! Please tell us how you'll use Kwetupay.</p>
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

export default Login;
