import api from './axiosConfig';

export const authService = {
  // Register new user
  register: async (username, email, password) => {
    const response = await api.post('/api/users/register', {
      username,
      email,
      password,
    });
    return response.data;
  },

  // Login user
  login: async (identifier, password) => {
    const response = await api.post('/api/users/login', {
      identifier, // Can be username or email
      password,
    });
    return response.data;
  },

  // Logout user
  logout: async () => {
    const response = await api.post('/api/users/logout');
    return response.data;
  },

  // Get current user profile
  getProfile: async () => {
    const response = await api.get('/api/users/profile');
    return response.data;
  },

  // Update user profile
  updateProfile: async (userData) => {
    const response = await api.put('/api/users/profile', userData);
    return response.data;
  },
};