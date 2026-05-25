import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatsCard from './StatsCard';
import { propertyAPI, bookingAPI } from '../../../services/api';

const LandlordDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState({
    totalProperties: 0,
    totalUnits: 0,
    availableUnits: 0,
    occupiedUnits: 0,
    maintenanceUnits: 0,
    activeTenants: 0,
    monthlyRevenue: 0,
    pendingBookings: 0,
    occupancyRate: 0
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [recentProperties, setRecentProperties] = useState([]);
  const [propertyUnits, setPropertyUnits] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      console.log('Starting dashboard data fetch...');

      // Fetch landlord's properties
      let properties = [];
      try {
        const propertiesResponse = await propertyAPI.getMyProperties();
        console.log('Properties response:', propertiesResponse);
        properties = propertiesResponse.data.data?.properties || [];
        console.log('Found properties:', properties.length);
      } catch (propertiesError) {
        console.error('Properties API Error:', propertiesError);
        throw new Error(`Failed to load properties: ${propertiesError.response?.data?.message || propertiesError.message}`);
      }

      setRecentProperties(properties.slice(0, 3));

      // Fetch units for each property
      const unitsMap = {};
      let totalUnits = 0;
      let availableUnits = 0;
      let occupiedUnits = 0;
      let maintenanceUnits = 0;

      for (const property of properties) {
        try {
          const unitsResponse = await propertyAPI.getPropertyUnitsLandlord(property.property_id);
          const units = unitsResponse.data.data?.units || [];
          unitsMap[property.property_id] = units;
          
          totalUnits += units.length;
          availableUnits += units.filter(unit => unit.status === 'available').length;
          occupiedUnits += units.filter(unit => unit.status === 'occupied').length;
          maintenanceUnits += units.filter(unit => unit.status === 'maintenance').length;
        } catch (unitError) {
          console.error(`Error fetching units for property ${property.property_id}:`, unitError);
          unitsMap[property.property_id] = [];
        }
      }

      setPropertyUnits(unitsMap);

      // Fetch landlord's bookings
      let bookings = [];
      try {
        const bookingsResponse = await bookingAPI.getLandlordBookings(); // all statuses
        console.log('Bookings response:', bookingsResponse);
        bookings = bookingsResponse.data.data?.bookings || [];
        console.log('Found bookings:', bookings.length);
      } catch (bookingsError) {
        console.error('Bookings API Error:', bookingsError);
        // Continue without bookings data
      }

      setRecentBookings(bookings.slice(0, 5));

      // Calculate dashboard stats
      const totalProperties = properties.length;
      const activeBookings = bookings.filter(b => b.booking_status === 'approved');
      const activeTenants = [...new Set(activeBookings.map(b => b.tenant_id))].length;
      const pendingBookings = bookings.filter(b => b.booking_status === 'pending').length;
      
      // Calculate monthly revenue from active bookings
      const monthlyRevenue = activeBookings.reduce((sum, booking) => 
        sum + parseFloat(booking.total_rent || 0), 0
      );

      const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

      setDashboardData({
        totalProperties,
        totalUnits,
        availableUnits,
        occupiedUnits,
        maintenanceUnits,
        activeTenants,
        monthlyRevenue,
        pendingBookings,
        occupancyRate
      });

      console.log('Dashboard stats calculated:', {
        totalProperties,
        totalUnits,
        availableUnits,
        occupiedUnits,
        maintenanceUnits,
        monthlyRevenue
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message || 'Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(price);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getBookingStatusColor = (status) => {
    const statusColors = {
      pending: 'warning',
      approved: 'success',
      rejected: 'danger',
      cancelled: 'secondary'
    };
    return statusColors[status] || 'secondary';
  };

  const getUnitStatusColor = (status) => {
    const statusColors = {
      available: 'success',
      occupied: 'warning',
      maintenance: 'danger'
    };
    return statusColors[status] || 'secondary';
  };

  const getUnitStatusText = (status) => {
    const statusTexts = {
      available: 'Available',
      occupied: 'Occupied',
      maintenance: 'Maintenance'
    };
    return statusTexts[status] || status;
  };

  const stats = [
    { 
      title: 'Total Properties', 
      value: dashboardData.totalProperties.toString(), 
      icon: '🏢', 
      color: 'primary', 
      link: '/properties' 
    },
    { 
      title: 'Total Units', 
      value: dashboardData.totalUnits.toString(), 
      icon: '🏠', 
      color: 'secondary', 
      link: '/properties/units' 
    },
    { 
      title: 'Available Units', 
      value: dashboardData.availableUnits.toString(), 
      icon: '🟢', 
      color: 'success', 
      link: '/properties/units?status=available' 
    },
    { 
      title: 'Occupied Units', 
      value: dashboardData.occupiedUnits.toString(), 
      icon: '🔴', 
      color: 'warning', 
      link: '/properties/units?status=occupied' 
    },
    { 
      title: 'Maintenance', 
      value: dashboardData.maintenanceUnits.toString(), 
      icon: '🛠️', 
      color: 'danger', 
      link: '/properties/units?status=maintenance' 
    },
    { 
      title: 'Occupancy Rate', 
      value: `${dashboardData.occupancyRate}%`, 
      icon: '📊', 
      color: 'info', 
      link: '/reports' 
    },
    { 
      title: 'Monthly Revenue', 
      value: formatPrice(dashboardData.monthlyRevenue), 
      icon: '💰', 
      color: 'success', 
      link: '/reports' 
    },
    {
      title: 'Pending Bookings',
      value: dashboardData.pendingBookings.toString(),
      icon: '📋',
      color: 'warning',
      link: '/bookings/requests'
    }
  ];

  const quickActions = [
    { 
      label: 'Add New Property', 
      icon: '🏢', 
      description: 'List a new property with units',
      onClick: () => navigate('/properties/create'),
      color: 'primary'
    },
    {
      label: 'Manage Units',
      icon: '🏠',
      description: 'View and manage all property units',
      onClick: () => navigate('/properties'),
      color: 'secondary'
    },
    {
      label: 'Booking Requests',
      icon: '📋',
      description: 'Manage tenant booking requests',
      onClick: () => navigate('/bookings/requests'),
      color: 'info'
    },
    {
      label: 'Tenant Management',
      icon: '👥',
      description: 'Manage current tenants',
      onClick: () => navigate('/tenants'),
      color: 'success'
    },
    {
      label: 'Maintenance',
      icon: '🛠️',
      description: 'Review maintenance requests from tenants',
      onClick: () => navigate('/maintenance/overview'),
      color: 'warning'
    }
  ];

  const handleBookingAction = async (bookingId, action) => {
    try {
      await bookingAPI.updateStatus(bookingId, action);
      fetchDashboardData();
    } catch (error) {
      console.error('Error updating booking:', error);
      setError('Failed to update booking status.');
    }
  };

  const getPropertyUnitStats = (propertyId) => {
    const units = propertyUnits[propertyId] || [];
    const available = units.filter(u => u.status === 'available').length;
    const occupied = units.filter(u => u.status === 'occupied').length;
    const maintenance = units.filter(u => u.status === 'maintenance').length;
    
    return { total: units.length, available, occupied, maintenance };
  };

  if (loading) {
    return (
      <div className="dashboard-content">
        <div className="loading-section">
          <div className="loading-spinner"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-content">
      {/* Welcome Section */}
      <section className="welcome-section">
        <div className="welcome-content">
          <h1>Welcome back, {user?.name}!</h1>
          <p>Manage your {dashboardData.totalProperties} properties and {dashboardData.totalUnits} units</p>
        </div>
        <div className="welcome-stats">
          <div className="stat-mini">
            <span className="stat-mini-value">{dashboardData.availableUnits}</span>
            <span className="stat-mini-label">Available</span>
          </div>
          <div className="stat-mini">
            <span className="stat-mini-value">{dashboardData.occupiedUnits}</span>
            <span className="stat-mini-label">Occupied</span>
          </div>
          <div className="stat-mini">
            <span className="stat-mini-value">{dashboardData.occupancyRate}%</span>
            <span className="stat-mini-label">Occupancy</span>
          </div>
        </div>
      </section>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError('')} className="close-error">&times;</button>
        </div>
      )}

      {/* Stats Overview */}
      <section className="stats-section">
        <div className="section-header">
          <h2>Property Portfolio Overview</h2>
          <button className="view-all-btn" onClick={() => navigate('/properties')}>
            Manage Portfolio
          </button>
        </div>
        <div className="stats-grid">
          {stats.map((stat, index) => (
            <StatsCard key={index} {...stat} />
          ))}
        </div>
      </section>

      <div className="dashboard-row">
        {/* Quick Actions */}
        <section className="actions-section">
          <div className="section-header">
            <h3>Quick Actions</h3>
          </div>
          <div className="quick-actions-grid">
            {quickActions.map((action, index) => (
              <button
                key={index}
                className={`action-btn action-btn--${action.color}`}
                onClick={action.onClick}
              >
                <span className="action-icon">{action.icon}</span>
                <div className="action-content">
                  <span className="action-label">{action.label}</span>
                  <span className="action-description">{action.description}</span>
                </div>
                <span className="action-arrow">→</span>
              </button>
            ))}
          </div>
        </section>

        {/* Recent Bookings */}
        <section className="activity-section">
          <div className="section-header">
            <h3>Recent Booking Requests</h3>
            <button className="view-all-btn" onClick={() => navigate('/bookings/requests')}>
              View All
            </button>
          </div>
          <div className="activity-list">
            {recentBookings.length === 0 ? (
              <div className="empty-state">
                <p>No recent booking requests</p>
                <small>When tenants book your properties, they'll appear here</small>
              </div>
            ) : (
              recentBookings.map((booking) => (
                <div key={booking.booking_id} className="activity-item">
                  <span className="activity-icon">📋</span>
                  <div className="activity-content">
                    <p className="activity-message">
                      <strong>{booking.tenant_name || 'Tenant'}</strong> requested{' '}
                      <strong>{booking.property_title}</strong>
                    </p>
                    <span className="activity-time">
                      {formatDate(booking.created_at)} • 
                      <span className={`status-badge status-${getBookingStatusColor(booking.booking_status)}`}>
                        {booking.booking_status}
                      </span>
                    </span>
                    {booking.booking_status === 'pending' && (
                      <div className="booking-actions">
                        <button 
                          className="btn-primary btn-sm"
                          onClick={() => handleBookingAction(booking.booking_id, 'approved')}
                        >
                          Approve
                        </button>
                        <button 
                          className="btn-outline btn-sm"
                          onClick={() => handleBookingAction(booking.booking_id, 'rejected')}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Recent Properties with Unit Breakdown */}
      <section className="properties-section">
        <div className="section-header">
          <h3>Your Properties & Units</h3>
          <button className="view-all-btn" onClick={() => navigate('/properties')}>
            Manage All Properties
          </button>
        </div>
        <div className="properties-grid">
          {recentProperties.length === 0 ? (
            <div className="empty-state">
              <p>No properties listed yet</p>
              <button 
                className="btn-primary"
                onClick={() => navigate('/properties/create')}
              >
                Add Your First Property
              </button>
            </div>
          ) : (
            recentProperties.map((property) => {
              const unitStats = getPropertyUnitStats(property.property_id);
              
              return (
                <div key={property.property_id} className="property-summary">
                  <div className="property-info">
                    <h4>{property.title}</h4>
                    <p>📍 {property.city}{property.neighborhood && `, ${property.neighborhood}`}</p>
                    <div className="property-stats">
                      <span className="stat">Total: {unitStats.total} units</span>
                      <span className="stat status-available">Available: {unitStats.available}</span>
                      <span className="stat status-occupied">Occupied: {unitStats.occupied}</span>
                      {unitStats.maintenance > 0 && (
                        <span className="stat status-maintenance">Maintenance: {unitStats.maintenance}</span>
                      )}
                    </div>
                  </div>
                  <div className="property-actions">
                    <button 
                      className="btn-outline"
                      onClick={() => navigate(`/properties/${property.property_id}/units`)}
                    >
                      View Units
                    </button>
                    <button 
                      className="btn-primary"
                      onClick={() => navigate(`/properties/edit/${property.property_id}`)}
                    >
                      Manage
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};

export default LandlordDashboard;