import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatsCard from './StatsCard';
import { bookingAPI, messageAPI } from '../../../services/api';

const TenantDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState({
    activeLease: null,
    nextPayment: null,
    unreadMessages: 0,
    pendingBookings: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch tenant bookings
      const bookingsResponse = await bookingAPI.getMyBookings();
      const bookings = bookingsResponse.data.data?.bookings || [];
      
      // Fetch unread messages count
      const messagesResponse = await messageAPI.getUnreadCount();
      const unreadCount = messagesResponse.data.data?.unreadCount || 0;
      
      // Find active lease (approved booking with lease)
      const activeLease = bookings.find(booking => 
        booking.booking_status === 'approved' && booking.lease_id
      );
      
      // Calculate next payment
      let nextPayment = null;
      if (activeLease) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30); // Next month same date
        nextPayment = {
          amount: activeLease.total_rent || activeLease.rent_amount,
          dueDate: dueDate.toISOString().split('T')[0],
          daysUntil: Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24))
        };
      }

      setDashboardData({
        activeLease,
        nextPayment,
        unreadMessages: unreadCount,
        pendingBookings: bookings.filter(b => b.booking_status === 'pending').length
      });
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { 
      title: 'Current Lease', 
      value: dashboardData.activeLease ? 'Active' : 'None', 
      icon: '📄', 
      color: dashboardData.activeLease ? 'success' : 'secondary',
      subtitle: dashboardData.activeLease ? dashboardData.activeLease.property_title : 'No active lease'
    },
    { 
      title: 'Next Payment', 
      value: dashboardData.nextPayment ? `KES ${dashboardData.nextPayment.amount}` : 'KES 0', 
      icon: '💰', 
      color: 'primary',
      subtitle: dashboardData.nextPayment ? `Due in ${dashboardData.nextPayment.daysUntil} days` : 'No payment due'
    },
    { 
      title: 'Messages', 
      value: dashboardData.unreadMessages, 
      icon: '💬', 
      color: dashboardData.unreadMessages > 0 ? 'warning' : 'info',
      subtitle: dashboardData.unreadMessages > 0 ? 'Unread messages' : 'All caught up'
    },
    { 
      title: 'Pending Bookings', 
      value: dashboardData.pendingBookings, 
      icon: '⏳', 
      color: 'secondary',
      subtitle: 'Awaiting approval'
    },
  ];

  const quickActions = [
    { 
      label: 'Browse Properties', 
      icon: '🔍', 
      onClick: () => navigate('/properties/find'),
      description: 'Find your next home',
      primary: true 
    },
    { 
      label: 'My Bookings', 
      icon: '📝', 
      onClick: () => navigate('/bookings'),
      description: 'View booking requests'
    },
    { 
      label: 'Messages', 
      icon: '💬', 
      onClick: () => navigate('/messages'),
      description: 'Chat with landlords'
    },
    { 
      label: 'Payment History', 
      icon: '💳', 
      onClick: () => alert('Payment history coming soon!'),
      description: 'View past payments'
    },
  ];

  if (loading) {
    return (
      <div className="tenant-dashboard">
        <div className="loading-section">
          <div className="loading-spinner"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tenant-dashboard">
      {/* Welcome Section */}
      <section className="welcome-section">
        <h2>Welcome back, {user.first_name} {user.last_name}! 🎉</h2>
        <p>
          {dashboardData.activeLease 
            ? `You're currently renting ${dashboardData.activeLease.property_title}`
            : 'Find your perfect home and manage your rentals easily'
          }
        </p>
      </section>

      {/* Stats Grid */}
      <section className="stats-section">
        <h3>Your Overview</h3>
        <div className="stats-grid">
          {stats.map((stat, index) => (
            <StatsCard 
              key={index} 
              {...stat}
              onClick={stat.title === 'Messages' && stat.value > 0 ? () => navigate('/messages') : undefined}
            />
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="actions-section">
        <h3>Quick Actions</h3>
        <div className="quick-actions-grid">
          {quickActions.map((action, index) => (
            <button
              key={index}
              className={`action-btn ${action.primary ? 'primary' : 'secondary'}`}
              onClick={action.onClick}
            >
              <span className="action-icon">{action.icon}</span>
              <span className="action-label">{action.label}</span>
              <span className="action-description">{action.description}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Recent Activity */}
      <section className="recent-activity">
        <h3>Recent Activity</h3>
        <div className="activity-list">
          {dashboardData.pendingBookings > 0 ? (
            <div className="activity-item new">
              <span className="activity-icon">⏳</span>
              <div className="activity-content">
                <p>You have {dashboardData.pendingBookings} pending booking{dashboardData.pendingBookings !== 1 ? 's' : ''}</p>
                <small>Waiting for landlord approval</small>
              </div>
              <button 
                onClick={() => navigate('/bookings')}
                className="view-btn"
              >
                View
              </button>
            </div>
          ) : (
            <div className="activity-item">
              <span className="activity-icon">📝</span>
              <div className="activity-content">
                <p>No recent activity</p>
                <small>Your activity will appear here</small>
              </div>
            </div>
          )}
          
          {dashboardData.unreadMessages > 0 && (
            <div className="activity-item new">
              <span className="activity-icon">💬</span>
              <div className="activity-content">
                <p>You have {dashboardData.unreadMessages} unread message{dashboardData.unreadMessages !== 1 ? 's' : ''}</p>
                <small>From landlords</small>
              </div>
              <button 
                onClick={() => navigate('/messages')}
                className="view-btn"
              >
                View
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default TenantDashboard;