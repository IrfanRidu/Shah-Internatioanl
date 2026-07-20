'use client';
import { forwardRef } from 'react';

const Input = forwardRef(({ label, error, hint, icon: Icon, iconRight, className = '', required, ...props }, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />}
        <input
          ref={ref}
          className={`input-field ${Icon ? 'pl-10' : ''} ${iconRight ? 'pr-10' : ''} ${error ? 'border-red-400 focus:ring-red-300' : ''} ${className}`}
          {...props}
        />
        {iconRight && <iconRight className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
});
Input.displayName = 'Input';
export default Input;
