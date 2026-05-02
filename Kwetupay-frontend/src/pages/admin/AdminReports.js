import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { adminAPI } from '../../services/api';
import './AdminReports.css';

const AdminReports = () => {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [timeRange, setTimeRange] = useState('month');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      if (parsedUser.role !== 'admin' && parsedUser.role !== 'super_admin') {
        navigate('/properties');
        return;
      }
      setUser(parsedUser);
      fetchReports();
    } else {
      navigate('/login');
    }
  }, [navigate, timeRange]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getDashboardStats();
      
      if (response.data.status === 'success') {
        setStats(response.data.data.stats);
        // In a real app, you'd have more detailed analytics here
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('kwetupay_token');
    localStorage.removeItem('kwetupay_user');
    navigate('/login');
  };

  const StatCard = ({ title, value, change, icon, color }) => (
    <div className={`stat-card ${color}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <h3>{value?.toLocaleString() || '0'}</h3>
        <p>{title}</p>
        {change && <span className={`change ${change > 0 ? 'positive' : 'negative'}`}>
          {change > 0 ? '↑' : '↓'} {Math.abs(change)}%
        </span>}
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <AdminLayout user={user} onLogout={handleLogout}>
      <div className="admin-reports">
        <div className="page-header">
          <div className="header-content">
            <h1>📈 Analytics & Reports</h1>
            <p>Comprehensive insights into your platform</p>
          </div>
          
          <div className="time-filter">
            <label>Time Range:</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="time-select"
            >
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="quarter">Last Quarter</option>
              <option value="year">Last Year</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading analytics...</p>
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="metrics-grid">
              <StatCard
                title="Total Revenue"
                value={stats?.totalBookings * 5000} // Example calculation
                change={12}
                icon="💰"
                color="green"
              />
              <StatCard
                title="Active Properties"
                value={stats?.totalProperties}
                change={8}
                icon="🏠"
                color="blue"
              />
              <StatCard
                title="New Users"
                value={45} // Example data
                change={15}
                icon="👥"
                color="purple"
              />
              <StatCard
                title="Booking Rate"
                value={`${Math.round((stats?.activeBookings / stats?.totalProperties) * 100) || 0}%`}
                change={5}
                icon="📊"
                color="orange"
              />
            </div>

            {/* Charts Section */}
            <div className="charts-grid">
              <div className="chart-card">
                <div className="chart-header">
                  <h3>📅 Bookings Overview</h3>
                  <span>Last {timeRange}</span>
                </div>
                <div className="chart-placeholder">
                  <div className="placeholder-content">
                    <span>📈</span>
                    <p>Booking trends chart will appear here</p>
                    <small>Integration with charts library needed</small>
                  </div>
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-header">
                  <h3>🏠 Property Performance</h3>
                  <span>By status</span>
                </div>
                <div className="chart-placeholder">
                  <div className="placeholder-content">
                    <span>🥧</span>
                    <p>Property status distribution chart</p>
                    <small>Pie chart visualization</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Reports */}
            <div className="reports-grid">
              <div className="report-card">
                <h3>📋 Platform Summary</h3>
                <div className="report-list">
                  <div className="report-item">
                    <span>Total Properties Listed</span>
                    <strong>{stats?.totalProperties}</strong>
                  </div>
                  <div className="report-item">
                    <span>Active Landlords</span>
                    <strong>{stats?.totalLandlords}</strong>
                  </div>
                  <div className="report-item">
                    <span>Registered Tenants</span>
                    <strong>{stats?.totalTenants}</strong>
                  </div>
                  <div className="report-item">
                    <span>Completed Bookings</span>
                    <strong>{stats?.activeBookings}</strong>
                  </div>
                  <div className="report-item">
                    <span>Pending Approvals</span>
                    <strong>{stats?.pendingBookings}</strong>
                  </div>
                </div>
              </div>

              <div className="report-card">
                <h3>🚀 Quick Actions</h3>
                <div className="action-list">
                  <button className="report-action-btn">
                    📥 Export Data
                  </button>
                  <button className="report-action-btn">
                    📧 Send Report
                  </button>
                  <button className="report-action-btn">
                    🔔 Generate Alerts
                  </button>
                  <button className="report-action-btn">
                    📊 View Detailed Analytics
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="activity-card">
              <h3>🕒 Recent Platform Activity</h3>
              <div className="activity-list">
                <div className="activity-item">
                  <div className="activity-icon">🏠</div>
                  <div className="activity-content">
                    <p><strong>New property listed</strong> in Westlands</p>
                    <span>2 hours ago</span>
                  </div>
                </div>
                <div className="activity-item">
                  <div className="activity-icon">📅</div>
                  <div className="activity-content">
                    <p><strong>Booking confirmed</strong> for apartment in Kilimani</p>
                    <span>5 hours ago</span>
                  </div>
                </div>
                <div className="activity-item">
                  <div className="activity-icon">👥</div>
                  <div className="activity-content">
                    <p><strong>New tenant registered</strong> on the platform</p>
                    <span>1 day ago</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminReports;