import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './AdminLayout.css';

const AdminLayout = ({ children, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/admin', label: 'Dashboard', icon: '📊' },
    { path: '/admin/users', label: 'Users', icon: '👥' },
    { path: '/admin/properties', label: 'Properties', icon: '🏠' },
    { path: '/admin/bookings', label: 'Bookings', icon: '📅' },
    { path: '/admin/reports', label: 'Reports', icon: '📈' },
  ];

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <div className="admin-sidebar">
        <div className="sidebar-header">
          <h2>🏠 Kwetupay</h2>
          <p>Admin Panel</p>
        </div>
        
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <strong>{user?.name}</strong>
              <span>{user?.role}</span>
            </div>
          </div>
          <button onClick={onLogout} className="logout-btn">
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="admin-main">
        <div className="admin-header">
          <h1>
            {menuItems.find(item => item.path === location.pathname)?.label || 'Admin Dashboard'}
          </h1>
          <div className="header-actions">
            <span>Welcome back, {user?.name}!</span>
          </div>
        </div>
        
        <div className="admin-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;