import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { adminAPI } from '../../services/api';
import './AdminProperties.css';

const AdminProperties = () => {
  const [user, setUser] = useState(null);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    total: 0
  });
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    search: searchParams.get('search') || ''
  });
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
      fetchProperties();
    } else {
      navigate('/login');
    }
  }, [navigate, searchParams]);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const page = searchParams.get('page') || 1;
      const response = await adminAPI.getProperties({
        page,
        status: filters.status,
        search: filters.search
      });
      
      if (response.data.status === 'success') {
        setProperties(response.data.data.properties);
        setPagination({
          currentPage: response.data.data.currentPage,
          totalPages: response.data.data.totalPages,
          total: response.data.data.total
        });
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    const params = new URLSearchParams();
    if (newFilters.status) params.set('status', newFilters.status);
    if (newFilters.search) params.set('search', newFilters.search);
    setSearchParams(params);
  };

  const handleStatusChange = async (propertyId, newStatus) => {
    try {
      await adminAPI.updatePropertyStatus(propertyId, newStatus);
      fetchProperties(); // Refresh the list
    } catch (error) {
      console.error('Error updating property status:', error);
    }
  };

  const handleDeleteProperty = async (propertyId) => {
    if (window.confirm('Are you sure you want to delete this property?')) {
      try {
        await adminAPI.deleteProperty(propertyId);
        fetchProperties(); // Refresh the list
      } catch (error) {
        console.error('Error deleting property:', error);
      }
    }
  };

  const handlePageChange = (page) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page);
    setSearchParams(params);
  };

  const handleLogout = () => {
    localStorage.removeItem('kwetupay_token');
    localStorage.removeItem('kwetupay_user');
    navigate('/login');
  };

  const StatusBadge = ({ status }) => {
    const statusConfig = {
      available: { label: 'Available', class: 'available' },
      occupied: { label: 'Occupied', class: 'occupied' },
      unavailable: { label: 'Unavailable', class: 'unavailable' }
    };
    
    const config = statusConfig[status] || { label: status, class: 'default' };
    
    return <span className={`status-badge ${config.class}`}>{config.label}</span>;
  };

  if (!user) return null;

  return (
    <AdminLayout user={user} onLogout={handleLogout}>
      <div className="admin-properties">
        <div className="page-header">
          <div className="header-content">
            <h1>🏠 Property Management</h1>
            <p>Manage all properties in the system</p>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-section">
          <div className="filter-group">
            <label>Search Properties:</label>
            <input
              type="text"
              placeholder="Search by title, address, or city..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filter-group">
            <label>Filter by Status:</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="status-filter"
            >
              <option value="">All Status</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>
        </div>

        {/* Properties Table */}
        <div className="properties-table-container">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading properties...</p>
            </div>
          ) : (
            <>
              <div className="table-header">
                <span>Showing {properties.length} of {pagination.total} properties</span>
              </div>
              
              <div className="properties-table">
                <div className="table-row header">
                  <div className="col property-info">Property</div>
                  <div className="col landlord">Landlord</div>
                  <div className="col details">Details</div>
                  <div className="col rent">Rent</div>
                  <div className="col status">Status</div>
                  <div className="col actions">Actions</div>
                </div>
                
                {properties.map((property) => (
                  <div key={property._id} className="table-row">
                    <div className="col property-info">
                      <div className="property-image">
                        {property.images?.[0] ? (
                          <img src={property.images[0].url} alt={property.title} />
                        ) : (
                          <div className="image-placeholder">🏠</div>
                        )}
                      </div>
                      <div className="property-details">
                        <strong>{property.title}</strong>
                        <span>{property.address}</span>
                        <small>{property.city}</small>
                      </div>
                    </div>
                    
                    <div className="col landlord">
                      <div className="landlord-info">
                        <strong>{property.landlord?.name}</strong>
                        <span>{property.landlord?.email}</span>
                      </div>
                    </div>
                    
                    <div className="col details">
                      <div className="property-specs">
                        <span>🛏️ {property.bedrooms || 'N/A'} beds</span>
                        <span>🚿 {property.bathrooms || 'N/A'} baths</span>
                        <span>📏 {property.area_sqft || 'N/A'} sqft</span>
                      </div>
                    </div>
                    
                    <div className="col rent">
                      <strong>KES {property.rent_amount?.toLocaleString()}</strong>
                      <span>/month</span>
                    </div>
                    
                    <div className="col status">
                      <StatusBadge status={property.status} />
                    </div>
                    
                    <div className="col actions">
                      <div className="action-buttons">
                        <select
                          value={property.status}
                          onChange={(e) => handleStatusChange(property._id, e.target.value)}
                          className="status-select"
                        >
                          <option value="available">Available</option>
                          <option value="occupied">Occupied</option>
                          <option value="unavailable">Unavailable</option>
                        </select>
                        
                        <button
                          onClick={() => handleDeleteProperty(property._id)}
                          className="delete-btn"
                          title="Delete property"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {properties.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">🏠</div>
                  <h3>No properties found</h3>
                  <p>Try adjusting your search or filters</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="pagination">
            <button
              disabled={pagination.currentPage === 1}
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              className="pagination-btn"
            >
              Previous
            </button>
            
            <div className="page-numbers">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`page-btn ${page === pagination.currentPage ? 'active' : ''}`}
                >
                  {page}
                </button>
              ))}
            </div>
            
            <button
              disabled={pagination.currentPage === pagination.totalPages}
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              className="pagination-btn"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminProperties;