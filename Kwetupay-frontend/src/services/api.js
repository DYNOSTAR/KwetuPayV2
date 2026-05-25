import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('kwetupay_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('kwetupay_token');
      localStorage.removeItem('kwetupay_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API methods
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  googleLogin: (credential, role) => api.post('/auth/google', { credential, role }),
  changePassword: (data) => api.post('/auth/change-password', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, new_password) => api.post('/auth/reset-password', { token, new_password }),
  resendVerification: () => api.post('/auth/resend-verification'),
  verifyEmail: (token) => api.get(`/auth/verify-email?token=${token}`),
};

export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (profileData) => api.put('/users/profile', profileData),
  updateBankDetails: (data) => api.put('/users/bank-details', data),
};

// In src/services/api.js - Replace propertyAPI section with this:

export const propertyAPI = {
  // Get available properties with filters
  getAvailable: (filters = {}) => {
    const params = new URLSearchParams();
    
    if (filters.city) params.append('city', filters.city);
    if (filters.min_price) params.append('min_price', filters.min_price);
    if (filters.max_price) params.append('max_price', filters.max_price);
    if (filters.property_type) params.append('property_type', filters.property_type);
    
    return api.get(`/properties/available?${params.toString()}`);
  },
  
  // Property CRUD operations
  create: (propertyData) => api.post('/properties', propertyData),
  getById: (propertyId) => api.get(`/properties/${propertyId}`),
  update: (propertyId, propertyData) => api.put(`/properties/${propertyId}`, propertyData),
  delete: (propertyId) => api.delete(`/properties/${propertyId}`),
  
  // Landlord property management
  getMyProperties: () => api.get('/properties/my-properties'),
  toggleAvailability: (propertyId) => api.put(`/properties/${propertyId}/toggle-availability`),
  
  // Unit management (landlord)
  getPropertyUnitsLandlord: (propertyId) => api.get(`/units/property/${propertyId}`),
  createUnit: (propertyId, data) => api.post(`/units/property/${propertyId}`, data),
  updateUnit: (unitId, data) => api.patch(`/units/${unitId}`, data),
  deleteUnit: (unitId) => api.delete(`/units/${unitId}`),

  // Image upload
  uploadImage: (formData) => api.post('/properties/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  // Tenant: properties with available unit counts
  getAvailableWithUnits: (filters = {}) => {
    const queryString = new URLSearchParams(filters).toString();
    return api.get(`/properties/tenant/available?${queryString}`);
  },

  // Tenant: available units for a specific property
  getPropertyUnits: (propertyId) => api.get(`/properties/${propertyId}/units/available`),
};

export const tenantAPI = {
  // Get landlord's tenants
  getLandlordTenants: () => api.get('/tenants/landlord/tenants'),
  
  // Get tenant statistics
  getTenantStatistics: () => api.get('/tenants/landlord/statistics'),
  
  // Get tenant details
  getTenantDetails: (tenantId) => api.get(`/tenants/landlord/tenants/${tenantId}`),
};

export const bookingAPI = {
  // Tenant
  create: (bookingData) => api.post('/bookings', bookingData),
  getMyBookings: () => api.get('/bookings/my-bookings'),
  cancel: (bookingId) => api.put(`/bookings/${bookingId}/cancel`),
  // Landlord
  getLandlordRequests: () => api.get('/bookings/landlord-requests'),   // pending only
  getLandlordBookings: () => api.get('/bookings/landlord/bookings'),   // all statuses
  updateStatus: (bookingId, status) => api.put(`/bookings/${bookingId}/status`, { status }),
};

export const healthCheck = () => api.get('/health');

// Public (no auth) — used by the landing page
export const publicAPI = {
  getAvailableProperties: () => axios.get(`${API_BASE_URL}/properties/public/available`),
};

export const messageAPI = {
  getConversations: () => api.get('/messages/conversations'),
  getWithUser: (otherUserId) => api.get(`/messages/with/${otherUserId}`),
  getUnreadCount: () => api.get('/messages/unread-count'),
  send: ({ recipient_id, property_id, content }) => api.post('/messages', { recipient_id, property_id, content }),
  markAsRead: (sender_id) => api.put('/messages/read', { sender_id }),
  getOnlineStatus: (userId) => api.get(`/messages/online-status/${userId}`)
};

export const leaseAPI = {
  getMyLeases: () => api.get('/leases/my-leases'),
  getLandlordLeases: () => api.get('/leases/landlord/active'),
  getLeaseById: (leaseId) => api.get(`/leases/${leaseId}`),
  getLeasePayments: (leaseId) => api.get(`/leases/${leaseId}/payments`),
};
export const paymentAPI = {
  // Tenant payments
  getMyPayments: () => api.get('/payments/my-payments'),
  getApprovedBookings: () => api.get('/payments/approved-bookings'),
  getBankDetails: (params) => api.get('/payments/bank-details', { params }),
  initiateMpesa: (paymentData) => api.post('/payments/mpesa', paymentData),
  processBookingPayment: (bookingId, data) => api.post(`/payments/booking/${bookingId}/process`, data),

  // Landlord payments
  getLandlordPayments: () => api.get('/payments/landlord/payments'),
  getPendingBankPayments: () => api.get('/payments/landlord/pending-bank'),
  confirmBankPayment: (paymentId, action) => api.patch(`/payments/${paymentId}/confirm`, { action }),
};
export const maintenanceAPI = {
  // Tenant methods
  createRequest: (requestData) => api.post('/maintenance', requestData),
  getMyRequests: () => api.get('/maintenance/my-requests'),
  
  // Landlord methods
  getLandlordRequests: () => api.get('/maintenance/landlord/requests'),
  updateRequestStatus: (requestId, updateData) => api.put(`/maintenance/${requestId}/status`, updateData),
  getRequestById: (requestId) => api.get(`/maintenance/${requestId}`),
};

export const adminAPI = {
  getDashboardStats: () => api.get('/admin/dashboard/stats'),
  getUsers: (params) => api.get('/admin/users', { params }),
  updateUserStatus: (userId, isActive) => api.patch(`/admin/users/${userId}/status`, { isActive }),
  getProperties: (params) => api.get('/admin/properties', { params }),
  updatePropertyStatus: (id, status) => api.patch(`/admin/properties/${id}/status`, { status }),
  deleteProperty: (id) => api.delete(`/admin/properties/${id}`),
  getBookings: (params) => api.get('/admin/bookings', { params }),
  updateBookingStatus: (id, status) => api.patch(`/admin/bookings/${id}/status`, { status }),
};

export default api;