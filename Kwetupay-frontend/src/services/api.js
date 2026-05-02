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
};

export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (profileData) => api.put('/users/profile', profileData),
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
  
  // Unit management
  getPropertyUnits: (propertyId) => api.get(`/units/property/${propertyId}`),
  createUnit: (propertyId, data) => api.post(`/units/property/${propertyId}`, data),
  updateUnit: (unitId, data) => api.patch(`/units/${unitId}`, data),
  deleteUnit: (unitId) => api.delete(`/units/${unitId}`),
  
  // Image upload
  uploadImage: (formData) => {
    return api.post('/properties/upload-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
   getAvailableWithUnits: (filters = {}) => {
    const queryString = new URLSearchParams(filters).toString();
    return api.get(`/properties/tenant/available?${queryString}`);
  },
  
  getPropertyUnits: (propertyId) => {
    return api.get(`/properties/${propertyId}/units/available`);
  }
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
  // Create booking request (tenants only)
  create: (bookingData) => api.post('/bookings', bookingData),
  
  // Get tenant's bookings
  getMyBookings: () => api.get('/bookings/my-bookings'),
  
  // Get landlord's booking requests
  getLandlordRequests: () => api.get('/bookings/landlord-requests'),
  
  // Update booking status (landlords only)
  updateStatus: (bookingId, status) => api.put(`/bookings/${bookingId}/status`, { status }),

   getMyBookings: () => api.get('/bookings/my-bookings'),
  cancel: (bookingId) => api.put(`/bookings/${bookingId}/cancel`),


  
  // Cancel booking (tenants only)
  cancel: (bookingId) => api.put(`/bookings/${bookingId}/cancel`),
};

export const healthCheck = () => api.get('/health');

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
  getLeaseById: (leaseId) => api.get(`/leases/${leaseId}`),
  getLeasePayments: (leaseId) => api.get(`/leases/${leaseId}/payments`),
};
export const paymentAPI = {
  // Tenant payments
  getMyPayments: () => api.get('/payments/my-payments'),
  initiateMpesa: (paymentData) => api.post('/payments/mpesa', paymentData),
  
  // Landlord payments
  getLandlordPayments: () => api.get('/payments/landlord/payments'),
  
  // Webhook for M-Pesa callback
  mpesaWebhook: (webhookData) => api.post('/payments/mpesa-webhook', webhookData),
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

// Add to your existing api.js
export const adminAPI = {
  getDashboardStats: () => api.get('/admin/dashboard/stats'),
  getUsers: (params) => api.get('/admin/users', { params }),
  getProperties: (params) => api.get('/admin/properties', { params }),
  getBookings: (params) => api.get('/admin/bookings', { params }),
  updateBookingStatus: (id, status) => api.patch(`/admin/bookings/${id}/status`, { status }),
  updatePropertyStatus: (id, status) => api.patch(`/admin/properties/${id}/status`, { status }),
  deleteProperty: (id) => api.delete(`/admin/properties/${id}`),
};

export default api;