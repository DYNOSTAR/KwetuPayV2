import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { adminAPI } from '../../services/api';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentActivities, setRecentActivities] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      if (parsedUser.role !== 'admin' && parsedUser.role !== 'super_admin') {
        navigate('/login');
        return;
      }
      setUser(parsedUser);
      fetchDashboardData();
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getDashboardStats();
      
      if (response.data.status === 'success') {
        setStats(response.data.data.stats);
        setRecentActivities(response.data.data.recentActivities);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('kwetupay_token');
    localStorage.removeItem('kwetupay_user');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner"></div>
        <p>Loading admin dashboard...</p>
      </div>
    );
  }

  const StatCard = ({ title, value, icon, color, onClick }) => (
    <div className={`stat-card ${color}`} onClick={onClick}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <h3>{value?.toLocaleString() || '0'}</h3>
        <p>{title}</p>
      </div>
    </div>
  );

  const dashboardContent = (
    <div className="admin-dashboard">
      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard
          title="Total Properties"
          value={stats?.totalProperties}
          icon="🏠"
          color="blue"
          onClick={() => navigate('/admin/properties')}
        />
        <StatCard
          title="Total Users"
          value={stats?.totalUsers}
          icon="👥"
          color="green"
          onClick={() => navigate('/admin/users')}
        />
        <StatCard
          title="Total Landlords"
          value={stats?.totalLandlords}
          icon="👨‍💼"
          color="purple"
          onClick={() => navigate('/admin/users?role=landlord')}
        />
        <StatCard
          title="Total Tenants"
          value={stats?.totalTenants}
          icon="👨‍💼"
          color="orange"
          onClick={() => navigate('/admin/users?role=tenant')}
        />
        <StatCard
          title="Total Bookings"
          value={stats?.totalBookings}
          icon="📅"
          color="red"
          onClick={() => navigate('/admin/bookings')}
        />
        <StatCard
          title="Pending Bookings"
          value={stats?.pendingBookings}
          icon="⏳"
          color="yellow"
          onClick={() => navigate('/admin/bookings?status=pending')}
        />
      </div>

      {/* Recent Activities */}
      <div className="activities-grid">
        {/* Recent Properties */}
        <div className="activity-section">
          <h3>📋 Recent Properties</h3>
          <div className="activity-list">
            {recentActivities?.properties?.map((property) => (
              <div key={property._id} className="activity-item">
                <div className="activity-info">
                  <strong>{property.title}</strong>
                  <span>by {property.landlord?.name}</span>
                </div>
                <span className="activity-time">
                  {new Date(property.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
            {(!recentActivities?.properties || recentActivities.properties.length === 0) && (
              <p className="no-data">No recent properties</p>
            )}
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="activity-section">
          <h3>📅 Recent Bookings</h3>
          <div className="activity-list">
            {recentActivities?.bookings?.map((booking) => (
              <div key={booking._id} className="activity-item">
                <div className="activity-info">
                  <strong>{booking.property?.title}</strong>
                  <span>by {booking.tenant?.name}</span>
                </div>
                <span className={`status-badge ${booking.status}`}>
                  {booking.status}
                </span>
              </div>
            ))}
            {(!recentActivities?.bookings || recentActivities.bookings.length === 0) && (
              <p className="no-data">No recent bookings</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3>⚡ Quick Actions</h3>
        <div className="action-buttons">
          <button 
            className="action-btn primary"
            onClick={() => navigate('/admin/properties')}
          >
            🏠 Manage Properties
          </button>
          <button 
            className="action-btn secondary"
            onClick={() => navigate('/admin/users')}
          >
            👥 Manage Users
          </button>
          <button 
            className="action-btn tertiary"
            onClick={() => navigate('/admin/bookings')}
          >
            📅 Manage Bookings
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <AdminLayout user={user} onLogout={handleLogout}>
      {dashboardContent}
    </AdminLayout>
  );
};

export default AdminDashboard;