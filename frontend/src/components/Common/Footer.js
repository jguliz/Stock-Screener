import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-white dark:bg-dark-100 shadow">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              © {currentYear} StockScreener. All rights reserved.
            </p>
          </div>
          
          <div className="flex space-x-6">
            <Link
              to="/terms"
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <span className="sr-only">Terms</span>
              <span className="text-sm">Terms of Service</span>
            </Link>
            <Link
              to="/privacy"
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <span className="sr-only">Privacy</span>
              <span className="text-sm">Privacy Policy</span>
            </Link>
            <Link
              to="/support"
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <span className="sr-only">Support</span>
              <span className="text-sm">Support</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;