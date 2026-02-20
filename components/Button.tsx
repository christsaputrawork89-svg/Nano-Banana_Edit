
import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  isLoading, 
  variant = 'primary', 
  className = '', 
  disabled,
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center px-6 py-3 text-xs font-semibold tracking-wide uppercase transition-all duration-300 focus:outline-none rounded-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]";
  
  const variants = {
    primary: "bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] text-white border border-white/10 shadow-lg",
    secondary: "bg-white/[0.03] hover:bg-white/[0.08] text-gray-200 border border-white/10 backdrop-blur-sm shadow-sm",
    danger: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20",
    ghost: "bg-transparent hover:bg-white/5 text-gray-400 hover:text-white",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
      {children}
    </button>
  );
};
