// Token management
export const getToken = () => localStorage.getItem('kwetupay_token');
export const setToken = (token) => localStorage.setItem('kwetupay_token', token);
export const removeToken = () => localStorage.removeItem('kwetupay_token');

// User management
export const getUser = () => {
  const user = localStorage.getItem('kwetupay_user');
  return user ? JSON.parse(user) : null;
};

export const setUser = (user) => localStorage.setItem('kwetupay_user', JSON.stringify(user));
export const removeUser = () => localStorage.removeItem('kwetupay_user');

// Check if user is authenticated
export const isAuthenticated = () => {
  const token = getToken();
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch (error) {
    return false;
  }
};

// Logout function
export const logout = () => {
  removeToken();
  removeUser();
  window.location.href = '/login';
};