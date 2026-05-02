import React from 'react';
import { useNavigate } from 'react-router-dom';
import './footer.css';

const Footer = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('kwetupay_user') || 'null');

  return (
    <footer className="app-footer">
      <div className="footer-content">
        {/* Brand Section */}
        <div className="footer-brand">
          <div className="brand-logo" onClick={() => navigate('/')}>
            <span className="logo">🏠</span>
            <span className="brand-name">Kwetupay</span>
          </div>
          <p className="brand-tagline">
            Making rental management simple and efficient for everyone.
          </p>
          <div className="social-links">
            <span className="social-text">Follow us:</span>
            <div className="social-icons">
              <span className="social-icon">📘</span>
              <span className="social-icon">🐦</span>
              <span className="social-icon">📷</span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="footer-links">
          <div className="link-group">
            <h4>For Tenants</h4>
            <button onClick={() => navigate('/properties')}>Browse Properties</button>
            <button onClick={() => navigate(user ? '/dashboard' : '/register')}>
              Create Account
            </button>
            <button onClick={() => navigate('/how-it-works')}>How It Works</button>
          </div>

          <div className="link-group">
            <h4>For Landlords</h4>
            <button onClick={() => navigate(user ? '/properties' : '/register')}>
              List Property
            </button>
            <button onClick={() => navigate(user ? '/dashboard' : '/register')}>
              Manage Properties
            </button>
            <button onClick={() => navigate('/pricing')}>Pricing</button>
          </div>

          <div className="link-group">
            <h4>Support</h4>
            <button onClick={() => navigate('/help')}>Help Center</button>
            <button onClick={() => navigate('/contact')}>Contact Us</button>
            <button onClick={() => navigate('/faq')}>FAQ</button>
          </div>

          <div className="link-group">
            <h4>Legal</h4>
            <button onClick={() => navigate('/privacy')}>Privacy Policy</button>
            <button onClick={() => navigate('/terms')}>Terms of Service</button>
            <button onClick={() => navigate('/cookies')}>Cookie Policy</button>
          </div>
        </div>

        {/* Contact Info */}
        <div className="footer-contact">
          <h4>Contact Info</h4>
          <div className="contact-item">
            <span className="contact-icon">📧</span>
            <span>support@kwetupay.com</span>
          </div>
          <div className="contact-item">
            <span className="contact-icon">📞</span>
            <span>+254 700 000 000</span>
          </div>
          <div className="contact-item">
            <span className="contact-icon">📍</span>
            <span>Nairobi, Kenya</span>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="footer-bottom">
        <div className="footer-bottom-content">
          <p>&copy; 2024 Kwetupay. All rights reserved.</p>
          <div className="footer-bottom-links">
            <button onClick={() => navigate('/sitemap')}>Sitemap</button>
            <button onClick={() => navigate('/accessibility')}>Accessibility</button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;