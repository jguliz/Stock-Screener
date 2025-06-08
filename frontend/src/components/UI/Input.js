import React from 'react';

const Input = ({
  type = 'text',
  id,
  name,
  label,
  value,
  onChange,
  placeholder = '',
  required = false,
  error = '',
  className = '',
  icon = null,
  autoComplete = 'on',
  disabled = false
}) => {
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label 
          htmlFor={id} 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          {label}
          {required && <span className="text-danger-light ml-1">*</span>}
        </label>
      )}
      <div className="relative rounded-md shadow-sm">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 dark:text-gray-400 sm:text-sm">
              {icon}
            </span>
          </div>
        )}
        <input
          type={type}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          className={`form-input block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm
                    dark:bg-dark-100 dark:border-gray-700 dark:text-white dark:placeholder-gray-500
                    ${icon ? 'pl-10' : ''}
                    ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}
                    ${disabled ? 'bg-gray-100 cursor-not-allowed dark:bg-dark-200' : ''}
                    `}
        />
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
};

export default Input;