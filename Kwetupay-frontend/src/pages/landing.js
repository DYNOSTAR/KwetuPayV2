import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { publicAPI } from '../services/api';
import './landing.css';

const Landing = () => {
  const navigate = useNavigate();
  const images = [
    '/images/apartment1.webp',
    '/images/apartment2.webp',
    '/images/apartment3.jpg',
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [availableProperties, setAvailableProperties] = useState([]);

  // Auto-slide background every 4 seconds with smooth transition
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [images.length]);

  useEffect(() => {
    publicAPI.getAvailableProperties()
      .then(res => {
        if (res.data.status === 'success') {
          setAvailableProperties(res.data.data.properties || []);
        }
      })
      .catch(() => {});
  }, []);

  const formatPrice = (price) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(price);

  return (
    <div className="landing-page">
      {/* Navigation Bar */}
      <nav className="landing-nav">
        <div className="nav-brand">
          <Link to="/" className="logo-link">
            <img src="/images/logo.png" alt="Kwetupay Logo" className="logo-img" />
            <span className="brand-name">Kwetupay</span>
          </Link>
        </div>
        <div className="nav-actions">
          <button onClick={() => navigate('/login')} className="nav-btn login-btn">
            Sign In
          </button>
          <button onClick={() => navigate('/register')} className="nav-btn register-btn">
            Sign Up
          </button>
        </div>
      </nav>

      {/* Hero Section with Image Slideshow */}
      <section className="hero-section">
        <div className="slideshow-container">
          {images.map((img, index) => (
            <div
              key={index}
              className={`slide ${index === currentIndex ? 'active' : ''}`}
              style={{ backgroundImage: `url(${img})` }}
            />
          ))}
        </div>
        <div className="hero-overlay">
          <div className="hero-content">
            <h1>Find Your Perfect Home with Kwetupay</h1>
            <p>
              Discover amazing rental properties, connect with landlords, and manage everything in one place.
            </p>
            <div className="hero-buttons">
              <button onClick={() => navigate('/login')} className="cta-btn primary">
                <span className="btn-icon">🔍</span>
                Browse Properties
              </button>
              <button onClick={() => navigate('/register')} className="cta-btn secondary">
                <span className="btn-icon">🏠</span>
                List Your Property
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Property Gallery Section */}
      <section className="gallery-section">
        <div className="container">
          <h2>Explore Modern Living Spaces</h2>
          <p className="section-subtitle">Discover our curated selection of premium rental properties</p>
          <div className="gallery-grid">
            {images.map((img, index) => (
              <div key={index} className="gallery-item">
                <div className="gallery-image-container">
                  <img src={img} alt={`Apartment ${index + 1}`} />
                  <div className="gallery-overlay">
                    <span className="view-details">View Details</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Available Properties Section */}
      {availableProperties.length > 0 && (
        <section className="landing-properties-section">
          <div className="container">
            <h2>Available Vacancies</h2>
            <p className="section-subtitle">Browse open units — sign in to book your preferred space</p>
            <div className="landing-properties-grid">
              {availableProperties.map(property => (
                <div key={property.property_id} className="landing-property-card">
                  <div className="landing-property-image">
                    {property.images && property.images.length > 0 ? (
                      <img src={property.images[0]} alt={property.title} />
                    ) : (
                      <div className="landing-property-image-placeholder">🏠</div>
                    )}
                    <span className="landing-units-badge">
                      {property.available_units} unit{property.available_units !== 1 ? 's' : ''} available
                    </span>
                  </div>
                  <div className="landing-property-info">
                    <h3>{property.title}</h3>
                    <p className="landing-property-location">📍 {property.city}{property.neighborhood ? `, ${property.neighborhood}` : ''}</p>
                    <div className="landing-property-meta">
                      <span className="landing-property-type">{property.property_type}</span>
                      <span className="landing-property-price">{formatPrice(property.rent_amount)}<small>/mo</small></span>
                    </div>
                    <button
                      className="landing-book-btn"
                      onClick={() => navigate('/login')}
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="landing-properties-cta">
              <button onClick={() => navigate('/login')} className="cta-btn secondary">
                View All Properties
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <h2>Why Choose Kwetupay?</h2>
          <p className="section-subtitle">Experience the future of rental management</p>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🔍</div>
              <h3>Easy Search</h3>
              <p>Find properties with advanced filters and location-based search</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💬</div>
              <h3>Direct Messaging</h3>
              <p>Communicate directly with landlords through our secure platform</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💰</div>
              <h3>Secure Payments</h3>
              <p>Pay rent securely via M-Pesa paypal or Debit card</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Mobile Friendly</h3>
              <p>Access your rental management from any device</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section 
        className="cta-section"
        style={{ backgroundImage: `url(/images/apartment2.webp)` }}
      >
        <div className="cta-overlay">
          <div className="container">
            <div className="cta-content">
              <h2>Ready to Find Your New Home?</h2>
              <p>Join thousands of satisfied tenants and landlords using Kwetupay</p>
              <button onClick={() => navigate('/register')} className="cta-btn primary large">
                Get Started Today
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <Link to="/" className="footer-logo-link">
                <div className="footer-logo">
                  <div className="footer-logo-frame">
                    <img src="/images/logo.png" alt="Kwetupay Logo" className="footer-logo-img" />
                  </div>
                  <span className="footer-brand-name">Kwetupay</span>
                </div>
              </Link>
              <p>Making rental management simple and efficient</p>
              <div className="social-icons">
                <span className="social-icon">📘</span>
                <span className="social-icon">🐦</span>
                <span className="social-icon">📷</span>
                <span className="social-icon">💼</span>
              </div>
            </div>
            <div className="footer-links">
              <div className="link-group">
                <h4>For Tenants</h4>
                <Link to="/login">Search Properties</Link>
                <Link to="/how-it-works">How It Works</Link>
                <Link to="/faq">FAQ</Link>
              </div>
              <div className="link-group">
                <h4>For Landlords</h4>
                <Link to="/register">List Property</Link>
                <Link to="/login">Manage Properties</Link>
                <Link to="/support">Support</Link>
              </div>
              <div className="link-group">
                <h4>Company</h4>
                <Link to="/about">About Us</Link>
                <Link to="/contact">Contact</Link>
                <Link to="/privacy">Privacy Policy</Link>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 Kwetupay. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;