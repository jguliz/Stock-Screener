import { apiService } from './api';

export const authService = {
  // Login method
  login: async (email, password) => {
    try {
      const response = await apiService.post('/login', { email, password });
      
      // Store user token and info
      if (response.token) {
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
      }
      
      return response.user;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  },

  // Register method
  register: async (name, email, password) => {
    try {
      const response = await apiService.post('/register', { 
        name, 
        email, 
        password 
      });
      
      return response.user;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  },

  // Logout method
  logout: () => {
    // Remove user token and info from local storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  // Get current user profile
  getProfile: async () => {
    try {
      const response = await apiService.get('/profile');
      return response.user;
    } catch (error) {
      console.error('Fetching profile failed:', error);
      throw error;
    }
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },

  // Refresh token method (if your backend supports it)
  refreshToken: async () => {
    try {
      const response = await apiService.post('/refresh-token');
      
      if (response.token) {
        localStorage.setItem('token', response.token);
      }
      
      return response.token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }
};