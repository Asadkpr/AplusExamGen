import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: string[];
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({ label, error, options, placeholder = "Select an option", className = '', ...props }) => {
  return (
    <div className="mb-4 w-full">
      {label && (
        <label className="block text-sm font-bold text-theme-text-main mb-1 uppercase tracking-tight">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          className={`w-full px-4 py-2 border rounded-lg appearance-none bg-gray-800 text-theme-text-main focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 transition-colors ${
            error ? 'border-red-500' : 'border-gray-700'
          } ${className}`}
          {...props}
        >
          <option value="" disabled className="text-gray-500">{placeholder}</option>
          {options.map((option) => (
            <option key={option} value={option} className="text-theme-text-main bg-gray-800">
              {option}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gold-500">
          <ChevronDown size={18} />
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
};