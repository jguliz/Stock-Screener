// In frontend/src/components/Common/ConnectionError.js
// Modify the component to provide better error information

import React from 'react';
import { AlertTriangle, RefreshCw, Server, Database } from 'lucide-react';
import Button from '../UI/Button';
import Card from '../UI/Card';
import Header from './Header';
import Footer from './Footer';

const ConnectionError = ({ 
  onRetry, 
  message = "Could not connect to the server", 
  showHeader = true,
  showFooter = true
}) => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-dark-300">
      {showHeader && <Header />}
      
      <main className="flex-grow py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <div className="text-center py-10">
              <div className="bg-amber-100 dark:bg-amber-900 dark:bg-opacity-20 p-3 rounded-full inline-flex mx-auto mb-4">
                <AlertTriangle className="h-12 w-12 text-amber-500 dark:text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Connection Error
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                {message}. Please check your connection and try again.
              </p>
              <Button 
                onClick={onRetry} 
                icon={<RefreshCw className="h-4 w-4" />}
                variant="primary"
              >
                Retry Connection
              </Button>
              
              <div className="mt-8 p-6 bg-gray-50 dark:bg-dark-200 rounded-md text-left max-w-2xl mx-auto">
                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4 flex items-center">
                  <Server className="h-5 w-5 mr-2" />
                  Troubleshooting Tips
                </h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Server Issues:</h4>
                    <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <li>Make sure the backend server is running at <code className="bg-gray-100 dark:bg-dark-300 px-1 py-0.5 rounded">http://localhost:5000</code></li>
                      <li>Check the server console for any error messages</li>
                      <li>Try restarting the server with <code className="bg-gray-100 dark:bg-dark-300 px-1 py-0.5 rounded">npm run dev</code> in the backend directory</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">API Issues:</h4>
                    <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <li>The Yahoo Finance API might be experiencing issues</li>
                      <li>There could be rate limiting if too many requests are made</li>
                      <li>Check your internet connection and firewall settings</li>
                    </ul>
                  </div>
                </div>
                
                <div className="mt-6 p-3 border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900 dark:bg-opacity-10 rounded-md">
                  <div className="flex items-start">
                    <Database className="h-5 w-5 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="ml-2 text-sm text-amber-700 dark:text-amber-300">
                      <strong>Note:</strong> The application requires a working connection to the stock data API. Please try again when the connection is restored.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </main>
      
      {showFooter && <Footer />}
    </div>
  );
};

export default ConnectionError;