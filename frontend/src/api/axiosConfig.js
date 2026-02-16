import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true, // Important: Send cookies with requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // Server responded with error
      const { status, data } = error.response;
      
      // Don't redirect to login on every 401 - let components handle it
      if (status === 401) {
        // Only log, don't redirect automatically
        // The login page will show if isAuthenticated is false
        console.log('Authentication required');
      } else {
        console.error('API Error:', data.message || 'Something went wrong');
      }
    } else if (error.request) {
      // Request made but no response
      console.error('Network Error:', 'No response from server');
    } else {
      // Something else happened
      console.error('Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default api;