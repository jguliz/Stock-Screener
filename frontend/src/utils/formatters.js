// Number formatting utilities
export const formatters = {
  // Format currency
  currency: (value, currency = 'USD', locale = 'en-US') => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency
    }).format(value);
  },

  // Format percentage
  percentage: (value, decimals = 2) => {
    return `${(value * 100).toFixed(decimals)}%`;
  },

  // Format large numbers (billions, millions)
  largeNumber: (num) => {
    if (num >= 1000000000) {
      return `${(num / 1000000000).toFixed(2)}B`;
    }
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    }
    return num.toString();
  },

  // Format date
  date: (date, locale = 'en-US', options = {}) => {
    const defaultOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return new Intl.DateTimeFormat(locale, { 
      ...defaultOptions, 
      ...options 
    }).format(new Date(date));
  },

  // Format time
  time: (date, locale = 'en-US', options = {}) => {
    const defaultOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };
    return new Intl.DateTimeFormat(locale, { 
      ...defaultOptions, 
      ...options 
    }).format(new Date(date));
  }
};