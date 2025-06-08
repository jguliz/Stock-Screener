/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  darkMode: 'class', // This enables the 'dark' variant for class-based dark mode
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EEF2FF',
          100: '#1F2937', // Light dark
          200: '#1A202C', // Medium dark
          300: '#111827', // Darker
          400: '#0F172A', // Very dark
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
        success: {
          light: '#10B981', // Green for positive price changes
          dark: '#047857',
        },
        danger: {
          light: '#EF4444', // Red for negative price changes
          dark: '#B91C1C',
        },
        dark: {
          100: '#1F2937',
          200: '#1A202C',
          300: '#111827',
          400: '#0F172A',
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'dark-card': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.18)',
      },
    },
  },
  plugins: [],
}