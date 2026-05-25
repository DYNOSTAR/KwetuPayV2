import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = ({ user }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path) => {
    if (path === '/dashboard') return currentPath === '/dashboard' || currentPath.startsWith('/dashboard/');
    return currentPath === path || currentPath.startsWith(path + '/');
  };

  if (!user) {
    return (
      <aside className="dashboard-sidebar">
        <div className="sidebar-header"><h3>Navigation</h3></div>
        <nav className="sidebar-nav">
          <div className="nav-item"><span className="nav-text">Loading...</span></div>
        </nav>
      </aside>
    );
  }

  const landlordTabs = [
    { path: '/dashboard',          icon: '📊', label: 'Dashboard' },
    { path: '/properties',         icon: '🏠', label: 'My Properties' },
    { path: '/bookings/requests',  icon: '📝', label: 'Bookings' },
    { path: '/tenants',            icon: '👥', label: 'Tenants' },
    { path: '/leases',             icon: '📄', label: 'Leases' },
    { path: '/payments/overview',  icon: '💰', label: 'Payments' },
    { path: '/maintenance/overview', icon: '🛠️', label: 'Maintenance' },
    { path: '/reports',            icon: '📈', label: 'Reports' },
  ];

  const tenantTabs = [
    { path: '/dashboard',          icon: '📊', label: 'Dashboard' },
    { path: '/properties/find',    icon: '🔍', label: 'Find Properties' },
    { path: '/bookings',           icon: '📝', label: 'My Bookings' },
    { path: '/leases',             icon: '📄', label: 'My Leases' },
    { path: '/payments',           icon: '💰', label: 'Payments' },
    { path: '/maintenance',        icon: '🛠️', label: 'Maintenance' },
  ];

  const commonTabs = [
    { path: '/messages', icon: '💬', label: 'Messages' },
    { path: '/profile',  icon: '👤', label: 'Profile' },
    { path: '/settings', icon: '⚙️', label: 'Settings' },
  ];

  const tabs = user.role === 'landlord' ? landlordTabs : tenantTabs;

  return (
    <aside className="dashboard-sidebar">
      <div className="sidebar-header">
        <h3>Navigation</h3>
      </div>
      <nav className="sidebar-nav">
        {tabs.map((tab) => (
          <Link
            key={tab.path}
            to={tab.path}
            className={`nav-item ${isActive(tab.path) ? 'active' : ''}`}
            title={tab.label}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-text">{tab.label}</span>
            {tab.badge && <span className="badge">{tab.badge}</span>}
          </Link>
        ))}

        <div className="nav-divider"></div>

        {commonTabs.map((tab) => (
          <Link
            key={tab.path}
            to={tab.path}
            className={`nav-item ${isActive(tab.path) ? 'active' : ''}`}
            title={tab.label}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-text">{tab.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
