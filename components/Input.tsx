import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, error, icon, className = '', ...props }) => {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gold-100 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          className={`w-full px-4 py-2 bg-gray-800 border rounded-lg focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 transition-colors text-white placeholder-gray-500 ${
            error ? 'border-red-500 focus:border-red-500' : 'border-gray-600'
          } ${className}`}
          {...props}
        />
        {icon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 cursor-pointer hover:text-gold-500">
            {icon}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
};