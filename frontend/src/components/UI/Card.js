import React from 'react';

const Card = ({ 
  children, 
  title, 
  subtitle, 
  className = '', 
  footer = null,
  elevated = false,
  noPadding = false
}) => {
  return (
    <div className={`bg-white dark:bg-dark-100 rounded-lg shadow-card dark:shadow-dark-card overflow-hidden ${elevated ? 'shadow-lg' : 'shadow'} ${className}`}>
      {(title || subtitle) && (
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          {title && <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">{title}</h3>}
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
      )}
      
      <div className={noPadding ? '' : 'px-4 py-5 sm:p-6'}>
        {children}
      </div>
      
      {footer && (
        <div className="px-4 py-4 sm:px-6 bg-gray-50 dark:bg-dark-200 border-t border-gray-200 dark:border-gray-700">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;