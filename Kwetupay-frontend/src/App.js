import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/dashboard/Dashboard';
import Properties from './pages/properties/Properties';
import CreateProperty from './pages/properties/CreateProperty';
import AddUnit from './pages/properties/AddUnit'; // Added missing import
import './App.css';
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

function App() {
  const isAuthenticated = () => {
    return localStorage.getItem('kwetupay_token') !== null;
  };

  const ProtectedRoute = ({ children }) => {
    return isAuthenticated() ? children : <Navigate to="/login" />;
  };

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Admin Routes - Consider adding ProtectedRoute for these too */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/properties" element={<AdminProperties />} />
          <Route path="/admin/bookings" element={<AdminBookings />} />
          <Route path="/admin/reports" element={<AdminReports />} />
      
          {/* Protected Routes */}
          <Route 
            path="/dashboard/*" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Properties Routes */}
          <Route 
            path="/properties" 
            element={
              <ProtectedRoute>
                <Properties />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/properties/create" 
            element={
              <ProtectedRoute>
                <CreateProperty />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/properties/edit/:propertyId" 
            element={
              <ProtectedRoute>
                <EditProperty />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/properties/:propertyId" 
            element={
              <ProtectedRoute>
                <PropertyDetails />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/properties/find" 
            element={
              <ProtectedRoute>
                <FindProperties />
              </ProtectedRoute>
            } 
          />
          
          {/* Unit Management Routes */}
          <Route 
            path="/properties/:propertyId/add-unit" 
            element={
              <ProtectedRoute>
                <AddUnit />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/properties/:propertyId/units" 
            element={
              <ProtectedRoute>
                <ManageUnits />
              </ProtectedRoute>
            } 
          />
          
          {/* Tenants Route */}
          <Route 
            path="/tenants" 
            element={
              <ProtectedRoute>
                <Tenants />
              </ProtectedRoute>
            } 
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
            element={
              <ProtectedRoute>
                <LandlordBookings />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/bookings" 
            element={
              <ProtectedRoute>
                <Bookings />
              </ProtectedRoute>
            } 
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
            element={
              <ProtectedRoute>
                <TenantPayments />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/payments/overview" 
            element={
              <ProtectedRoute>
                <LandlordPayments />
              </ProtectedRoute>
            } 
          />
          
          {/* Maintenance Routes */}
          <Route 
            path="/maintenance" 
            element={
              <ProtectedRoute>
                <TenantMaintenance />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/maintenance/overview" 
            element={
              <ProtectedRoute>
                <LandlordMaintenance />
              </ProtectedRoute>
            } 
          />
          
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;