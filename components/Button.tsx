import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "w-full py-2.5 px-4 rounded-lg font-bold transition-all duration-200 flex items-center justify-center uppercase tracking-wider text-sm";
  
  const variants = {
    primary: "bg-[#C29B61] hover:bg-[#B0894F] text-white shadow-sm hover:shadow-md border border-[#B0894F]",
    secondary: "bg-white hover:bg-[#FBF6EE] text-[#0F172A] border border-[#D6CFC2] hover:border-[#C29B61] shadow-sm",
    outline: "bg-transparent border-2 border-[#C29B61] text-[#94703C] hover:bg-[#C29B61] hover:text-white",
    danger: "bg-red-600 hover:bg-red-700 text-white shadow-md"
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${isLoading ? 'opacity-70 cursor-not-allowed' : ''} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing...
        </span>
      ) : children}
    </button>
  );
};