import React from 'react';

const Loading = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-dark-300">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary-600 dark:border-primary-500"></div>
        <p className="mt-4 text-gray-700 dark:text-gray-300 font-medium">Loading...</p>
      </div>
    </div>
  );
};

export default Loading;