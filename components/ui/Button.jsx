'use client';
import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const variants = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  accent: 'btn-accent',
  ghost: 'inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition-all duration-200',
  danger: 'inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 transition-all duration-200',
  outline: 'inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold border border-gray-300 text-gray-700 hover:border-gray-400 transition-all duration-200',
};

const sizes = {
  xs: 'px-3 py-1.5 text-xs',
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
};

const Button = forwardRef(({ children, variant = 'primary', size = 'md', loading = false, disabled = false, className = '', icon: Icon, iconRight, ...props }, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`${variants[variant]} ${sizes[size]} ${className} ${disabled || loading ? 'opacity-60 cursor-not-allowed' : ''} gap-2`}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : Icon && <Icon className="w-4 h-4" />}
      {children}
      {iconRight && !loading && <iconRight className="w-4 h-4" />}
    </button>
  );
});
Button.displayName = 'Button';
export default Button;
