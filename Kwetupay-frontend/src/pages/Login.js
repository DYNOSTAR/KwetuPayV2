import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    console.log('🔐 [DEBUG] Starting login process...');

    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      console.log('📡 [DEBUG] Response status:', response.status);
      const data = await response.json();
      console.log('📦 [DEBUG] Full response data:', data);

      if (data.status === 'success') {
        console.log('✅ [DEBUG] Login successful!');
        localStorage.setItem('kwetupay_token', data.data.token);
        localStorage.setItem('kwetupay_user', JSON.stringify(data.data.user));
        console.log('💾 [DEBUG] Data stored in localStorage');

        // Navigate to dashboard in dashboard folder
        navigate('/dashboard', { replace: true });

        setTimeout(() => {
          console.log('⏰ [DEBUG] Fallback navigation attempt');
          window.location.href = '/dashboard';
        }, 1000);
      } else {
        console.log('❌ [DEBUG] Login failed:', data.message);
        setError(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('💥 [DEBUG] Login error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="auth-container login-container"
      style={{ 
        backgroundImage: `url('/images/apartment.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="auth-overlay">
        <div className="auth-box">
          <div className="auth-header">
            {/* Large Logo */}
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
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Enter your password"
              />
            </div>

            <button type="submit" disabled={loading} className="login-btn">
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="register-link">
            <p>
              Don't have an account?{' '}
              <span onClick={() => navigate('/register')}>Sign up</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;