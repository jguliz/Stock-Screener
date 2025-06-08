// Validation utilities
export const validators = {
  // Email validation
  isValidEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Password strength validation
  isStrongPassword: (password) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  },

  // Required field validation
  isRequired: (value) => {
    return value !== null && value !== undefined && value.toString().trim() !== '';
  },

  // Minimum length validation
  minLength: (value, min) => {
    return value.length >= min;
  },

  // Maximum length validation
  maxLength: (value, max) => {
    return value.length <= max;
  },

  // Number validation
  isNumber: (value) => {
    return !isNaN(parseFloat(value)) && isFinite(value);
  },

  // Positive number validation
  isPositive: (value) => {
    return validators.isNumber(value) && parseFloat(value) > 0;
  },

  // Validate stock symbol
  isValidStockSymbol: (symbol) => {
    // Allow 1-5 uppercase letters
    const symbolRegex = /^[A-Z]{1,5}$/;
    return symbolRegex.test(symbol);
  },

  // Validate phone number (basic US format)
  isValidPhoneNumber: (phone) => {
    const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
    return phoneRegex.test(phone);
  }
};