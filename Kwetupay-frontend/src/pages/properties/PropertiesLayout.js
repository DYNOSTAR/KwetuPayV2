import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Sidebar from '../dashboard/components/Sidebar';

const PropertiesLayout = ({ user, children, onLogout }) => {
  const navigate = useNavigate();

  return (
    <div className="properties-layout">
      {/* Landing Page Style Header */}
      <nav className="landing-nav">
        <div className="nav-brand">
          <Link to="/" className="logo-link">
            <img src="/images/logo.png" alt="Kwetupay Logo" className="logo-img" />
            <span className="brand-name">Kwetupay</span>
          </Link>
        </div>
        <div className="nav-actions">
          {user ? (
            <div className="user-welcome">
              Welcome, {user.first_name}!
              <span className="user-role">({user.role})</span>
              <button onClick={onLogout} className="nav-btn login-btn">
                Logout
              </button>
            </div>
          ) : (
            <>
              <button onClick={() => navigate('/login')} className="nav-btn login-btn">
                Sign In
              </button>
              <button onClick={() => navigate('/register')} className="nav-btn register-btn">
                Sign Up
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Main Content with Sidebar */}
      <div className="properties-layout-container">
        {/* Dashboard Sidebar */}
        <div className="properties-sidebar">
          <Sidebar user={user} />
        </div>
        
        {/* Page Content */}
        <main className="properties-main-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default PropertiesLayout;