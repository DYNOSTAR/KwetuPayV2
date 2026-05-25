import React from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../dashboard/components/Sidebar';
import Header from '../dashboard/components/Header';

const PropertiesLayout = ({ user, children, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    if (onLogout) onLogout();
    else {
      localStorage.removeItem('kwetupay_token');
      localStorage.removeItem('kwetupay_user');
      navigate('/login');
    }
  };

  return (
    <div className="properties-layout">
      {/* Sticky header with notification bell */}
      {user ? (
        <Header user={user} onLogout={handleLogout} />
      ) : (
        <nav className="landing-nav">
          <div className="nav-brand">
            <a href="/" className="logo-link">
              <img src="/images/logo.png" alt="Kwetupay Logo" className="logo-img" />
              <span className="brand-name">Kwetupay</span>
            </a>
          </div>
        </nav>
      )}

      {/* Main layout: sidebar + content, with top offset for fixed header */}
      <div className="properties-layout-container">
        <div className="properties-sidebar">
          <Sidebar user={user} />
        </div>
        <main className="properties-main-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default PropertiesLayout;
