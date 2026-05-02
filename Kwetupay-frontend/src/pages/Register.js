import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Register = () => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    password: '',
    role: 'tenant'
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

    try {
      const response = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.status === 'success') {
        // Store token and user data
        localStorage.setItem('kwetupay_token', data.data.token);
        localStorage.setItem('kwetupay_user', JSON.stringify(data.data.user));
        
        // Redirect to dashboard
        navigate('/dashboard');
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="auth-container register-container"
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
            <h2>Create Your Account</h2>
            <p>Join thousands of satisfied users</p>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
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
                  placeholder="Enter your first name"
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
                  placeholder="Enter your last name"
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
                placeholder="Enter your phone number"
              />
            </div>

            <div className="form-group">
              <label>I am a</label>
              <select 
                name="role" 
                value={formData.role} 
                onChange={handleChange}
                className="role-select"
              >
                <option value="tenant">Tenant</option>
                <option value="landlord">Landlord</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength="6"
                placeholder="Create a password"
              />
            </div>
            
            <button type="submit" disabled={loading} className="login-btn">
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
    </div>
  );
};

export default Register;