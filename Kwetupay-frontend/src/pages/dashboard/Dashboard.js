import React, { useState, useEffect } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LandlordDashboard from './components/LandlordDashboard';
import TenantDashboard from './components/TenantDashboard';
import Properties from '../properties/Properties'; // Import Properties component
import './Dashboard.css';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      navigate('/login');
    }
    setLoading(false);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('kwetupay_token');
    localStorage.removeItem('kwetupay_user');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner">🏠</div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="dashboard-layout">
      {/* Your Header component - will show on ALL dashboard pages including Properties */}
      <Header user={user} onLogout={handleLogout} />
      
      <div className="dashboard-container">
        {/* Your Sidebar component - will show on ALL dashboard pages including Properties */}
        <Sidebar user={user} />
        
        <main className="dashboard-main">
          <Routes>
            {/* Dashboard home route */}
            <Route 
              path="/" 
              element={
                user.role === 'landlord' ? 
                <LandlordDashboard user={user} /> : 
                <TenantDashboard user={user} />
              } 
            />
            
            {/* Properties route - This will render within the dashboard layout */}
            <Route 
              path="/properties" 
              element={<Properties user={user} />} 
            />
            
            {/* Add other routes here as needed */}
            {/* <Route path="/payments" element={<Payments />} />
            <Route path="/messages" element={<Messages />} />
            etc... */}
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;