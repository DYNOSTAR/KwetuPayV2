import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { adminAPI } from '../../services/api';
import './AdminUsers.css';

const AdminUsers = () => {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    total: 0
  });
  const [filters, setFilters] = useState({
    role: searchParams.get('role') || '',
    search: searchParams.get('search') || ''
  });
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
      fetchUsers();
    } else {
      navigate('/login');
    }
  }, [navigate, searchParams]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const page = searchParams.get('page') || 1;
      const response = await adminAPI.getUsers({
        page,
        role: filters.role,
        search: filters.search
      });
      
      if (response.data.status === 'success') {
        setUsers(response.data.data.users);
        setPagination({
          currentPage: response.data.data.currentPage,
          totalPages: response.data.data.totalPages,
          total: response.data.data.total
        });
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    const params = new URLSearchParams();
    if (newFilters.role) params.set('role', newFilters.role);
    if (newFilters.search) params.set('search', newFilters.search);
    setSearchParams(params);
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

  const UserRoleBadge = ({ role }) => {
    const roleConfig = {
      landlord: { label: 'Landlord', class: 'landlord' },
      tenant: { label: 'Tenant', class: 'tenant' },
      admin: { label: 'Admin', class: 'admin' }
    };
    
    const config = roleConfig[role] || { label: role, class: 'default' };
    
    return <span className={`role-badge ${config.class}`}>{config.label}</span>;
  };

  if (!user) return null;

  return (
    <AdminLayout user={user} onLogout={handleLogout}>
      <div className="admin-users">
        <div className="page-header">
          <div className="header-content">
            <h1>👥 User Management</h1>
            <p>Manage all users in the system</p>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-section">
          <div className="filter-group">
            <label>Search Users:</label>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filter-group">
            <label>Filter by Role:</label>
            <select
              value={filters.role}
              onChange={(e) => handleFilterChange('role', e.target.value)}
              className="role-filter"
            >
              <option value="">All Roles</option>
              <option value="landlord">Landlords</option>
              <option value="tenant">Tenants</option>
              <option value="admin">Admins</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="users-table-container">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading users...</p>
            </div>
          ) : (
            <>
              <div className="table-header">
                <span>Showing {users.length} of {pagination.total} users</span>
              </div>
              
              <div className="users-table">
                <div className="table-row header">
                  <div className="col user-info">User</div>
                  <div className="col role">Role</div>
                  <div className="col contact">Contact</div>
                  <div className="col joined">Joined</div>
                  <div className="col status">Status</div>
                </div>
                
                {users.map((user) => (
                  <div key={user._id} className="table-row">
                    <div className="col user-info">
                      <div className="user-avatar">
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="user-details">
                        <strong>{user.name}</strong>
                        <span>{user.email}</span>
                      </div>
                    </div>
                    
                    <div className="col role">
                      <UserRoleBadge role={user.role} />
                    </div>
                    
                    <div className="col contact">
                      <span>{user.phone || 'Not provided'}</span>
                    </div>
                    
                    <div className="col joined">
                      <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="col status">
                      <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              {users.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">👥</div>
                  <h3>No users found</h3>
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

export default AdminUsers;