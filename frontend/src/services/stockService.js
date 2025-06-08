import { apiService } from './api';

export const stockService = {
  // Fetch all stocks
  getStocks: async (filters = {}) => {
    try {
      const response = await apiService.get('/stocks', filters);
      return response.stocks;
    } catch (error) {
      console.error('Failed to fetch stocks:', error);
      throw error;
    }
  },

  // Get stock details by ID
  getStockById: async (stockId) => {
    try {
      const response = await apiService.get(`/stocks/${stockId}`);
      return response.stock;
    } catch (error) {
      console.error(`Failed to fetch stock ${stockId}:`, error);
      throw error;
    }
  },

  // Get stock historical data
  getStockHistory: async (stockId, timeframe = '1H') => {
    try {
      const response = await apiService.get(`/stocks/${stockId}/history`, { timeframe });
      return response.history;
    } catch (error) {
      console.error(`Failed to fetch stock history for ${stockId}:`, error);
      throw error;
    }
  },

  // Add stock to favorites
  addToFavorites: async (stockId) => {
    try {
      const response = await apiService.post('/favorites', { stockId });
      return response;
    } catch (error) {
      console.error(`Failed to add stock ${stockId} to favorites:`, error);
      throw error;
    }
  },

  // Remove stock from favorites
  removeFromFavorites: async (stockId) => {
    try {
      const response = await apiService.delete(`/favorites/${stockId}`);
      return response;
    } catch (error) {
      console.error(`Failed to remove stock ${stockId} from favorites:`, error);
      throw error;
    }
  },

  // Set price alert
  setAlert: async (stockId, alertData) => {
    try {
      const response = await apiService.post('/alerts', { 
        stockId, 
        ...alertData 
      });
      return response;
    } catch (error) {
      console.error(`Failed to set alert for stock ${stockId}:`, error);
      throw error;
    }
  },

  // Fetch market overview
  getMarketOverview: async () => {
    try {
      const response = await apiService.get('/market');
      return response;
    } catch (error) {
      console.error('Failed to fetch market overview:', error);
      throw error;
    }
  }
};