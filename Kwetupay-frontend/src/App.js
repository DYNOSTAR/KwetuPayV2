import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Landing from './pages/landing';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/dashboard/Dashboard';
import Properties from './pages/properties/Properties';
import CreateProperty from './pages/properties/CreateProperty';
import AddUnit from './pages/properties/AddUnit'; // Added missing import
import './App.css';
import './design-system.css';
import EditProperty from './pages/properties/EditProperty';
import PropertyDetails from './pages/properties/PropertyDetails';
import Tenants from './pages/tenants/Tenants';
import FindProperties from './pages/properties/FindProperties';
import EnhancedMessages from './pages/messages/EnhancedMessages';
import Bookings from './pages/bookings/Bookings';
import Leases from './pages/leases/Leases';
import LandlordBookings from './pages/bookings/LandlordBookings';
import TenantPayments from './pages/payments/TenantPayments';
import LandlordPayments from './pages/payments/LandlordPayments';
import TenantMaintenance from './pages/maintenance/TenantMaintenance';
import LandlordMaintenance from './pages/maintenance/LandlordMaintenance';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminProperties from './pages/admin/AdminProperties';
import AdminBookings from './pages/admin/AdminBookings';
import AdminReports from './pages/admin/AdminReports';
import ManageUnits from './pages/properties/ManageUnits';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Reports from './pages/Reports';

function App() {
  const isAuthenticated = () => localStorage.getItem('kwetupay_token') !== null;

  const getRole = () => {
    try {
      const u = JSON.parse(localStorage.getItem('kwetupay_user') || '{}');
      return u.role || null;
    } catch {
      return null;
    }
  };

  const ProtectedRoute = ({ children }) =>
    isAuthenticated() ? children : <Navigate to="/login" />;

  // Redirect tenants away from landlord-only pages and vice versa
  const LandlordRoute = ({ children }) => {
    if (!isAuthenticated()) return <Navigate to="/login" />;
    if (getRole() !== 'landlord') return <Navigate to="/dashboard" />;
    return children;
  };

  const TenantRoute = ({ children }) => {
    if (!isAuthenticated()) return <Navigate to="/login" />;
    if (getRole() !== 'tenant') return <Navigate to="/dashboard" />;
    return children;
  };

  const AdminRoute = ({ children }) => {
    if (!isAuthenticated()) return <Navigate to="/login" />;
    const role = getRole();
    if (role !== 'admin' && role !== 'super_admin') return <Navigate to="/login" />;
    return children;
  };

  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || ''}>
    <Router>
      <div className="App">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Admin Routes — admin/super_admin only */}
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
          <Route path="/admin/properties" element={<AdminRoute><AdminProperties /></AdminRoute>} />
          <Route path="/admin/bookings" element={<AdminRoute><AdminBookings /></AdminRoute>} />
          <Route path="/admin/reports" element={<AdminRoute><AdminReports /></AdminRoute>} />
      
          {/* Protected Routes */}
          <Route 
            path="/dashboard/*" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Properties Routes — landlord manages, tenant browses */}
          <Route
            path="/properties"
            element={<LandlordRoute><Properties /></LandlordRoute>}
          />
          <Route
            path="/properties/create"
            element={<LandlordRoute><CreateProperty /></LandlordRoute>}
          />
          <Route
            path="/properties/edit/:propertyId"
            element={<LandlordRoute><EditProperty /></LandlordRoute>}
          />
          <Route
            path="/properties/:propertyId"
            element={<ProtectedRoute><PropertyDetails /></ProtectedRoute>}
          />
          <Route
            path="/properties/find"
            element={<TenantRoute><FindProperties /></TenantRoute>}
          />
          
          {/* Unit Management Routes — landlord only */}
          <Route
            path="/properties/:propertyId/add-unit"
            element={<LandlordRoute><AddUnit /></LandlordRoute>}
          />
          <Route
            path="/properties/:propertyId/units"
            element={<LandlordRoute><ManageUnits /></LandlordRoute>}
          />

          {/* Tenants Route — landlord only */}
          <Route
            path="/tenants"
            element={<LandlordRoute><Tenants /></LandlordRoute>}
          />
          
          {/* Messages Route */}
          <Route 
            path="/messages" 
            element={
              <ProtectedRoute>
                <EnhancedMessages />
              </ProtectedRoute>
            } 
          />
          
          {/* Bookings Routes */}
          <Route
            path="/bookings/requests"
            element={<LandlordRoute><LandlordBookings /></LandlordRoute>}
          />
          <Route
            path="/bookings"
            element={<TenantRoute><Bookings /></TenantRoute>}
          />
          
          {/* Leases Route */}
          <Route 
            path="/leases" 
            element={
              <ProtectedRoute>
                <Leases />
              </ProtectedRoute>
            } 
          />
          
          {/* Payments Routes */}
          <Route
            path="/payments"
            element={<TenantRoute><TenantPayments /></TenantRoute>}
          />
          <Route
            path="/payments/overview"
            element={<LandlordRoute><LandlordPayments /></LandlordRoute>}
          />

          {/* Maintenance Routes */}
          <Route
            path="/maintenance"
            element={<TenantRoute><TenantMaintenance /></TenantRoute>}
          />
          <Route
            path="/maintenance/overview"
            element={<LandlordRoute><LandlordMaintenance /></LandlordRoute>}
          />

          {/* Profile & Settings — all authenticated users */}
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

          {/* Reports — landlord only */}
          <Route path="/reports" element={<LandlordRoute><Reports /></LandlordRoute>} />

          {/* Saved Properties — tenant stub (handled in FindProperties) */}
          <Route path="/properties/saved" element={<TenantRoute><FindProperties /></TenantRoute>} />

          {/* Auth utility pages */}
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
    </GoogleOAuthProvider>
  );
}

export default App;