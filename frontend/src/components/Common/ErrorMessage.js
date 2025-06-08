import React from 'react';

const ErrorMessage = ({ message }) => {
  if (!message) return null;
  
  return (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative dark:bg-red-900 dark:bg-opacity-30 dark:text-red-200 dark:border-red-800 mb-4" role="alert">
      <span className="block sm:inline">{message}</span>
    </div>
  );
};

export default ErrorMessage;