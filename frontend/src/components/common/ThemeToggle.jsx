import React from 'react';
import { Sun, Moon } from 'lucide-react';

/**
 * ThemeToggle
 * 
 * Signature tactile theme switcher for ZORVEX:
 * - Fluid rotational & scale morphing between Sun and Moon
 * - Smooth transition without layout shift or white halos
 * - Tactile clay feedback with active compression state
 * - Canonical Ivory & Forest styling
 */
export default function ThemeToggle({ 
  darkMode, 
  onToggle, 
  size = 'md',
  className = '' 
}) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-9 h-9 sm:w-10 sm:h-10 text-sm',
    lg: 'w-11 h-11 text-base'
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4 sm:w-[18px] sm:h-[18px]',
    lg: 'w-5 h-5'
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex items-center justify-center rounded-xl sm:rounded-2xl transition-all duration-300 ease-out select-none cursor-pointer group active:scale-90 active:rotate-6 ${sizeClasses[size] || sizeClasses.md} ${
        darkMode 
          ? 'bg-[#252E26] hover:bg-[#2D382D] border border-[#3B493D] shadow-md shadow-black/40 text-[#AFC69B]' 
          : 'bg-[#FFFCF5] hover:bg-[#E6E9DD] border border-[#E3DCCB] shadow-sm shadow-[#292E28]/10 text-[#49664D]'
      } ${className}`}
      title={darkMode ? 'Switch to Ivory Canvas mode' : 'Switch to Dark Forest mode'}
      aria-label={darkMode ? 'Switch to Ivory Canvas mode' : 'Switch to Dark Forest mode'}
    >
      {/* Gentle ambient halo glow behind icon */}
      <span 
        className={`absolute inset-1 rounded-xl transition-opacity duration-500 opacity-0 group-hover:opacity-100 pointer-events-none blur-sm ${
          darkMode ? 'bg-[#AFC69B]/20' : 'bg-[#49664D]/15'
        }`}
      />

      {/* Sun Icon (Light Mode) */}
      <span
        className={`absolute transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex items-center justify-center text-[#49664D] group-hover:text-[#3B533E] ${
          darkMode 
            ? 'rotate-90 scale-0 opacity-0 pointer-events-none' 
            : 'rotate-0 scale-100 opacity-100 group-hover:rotate-45'
        }`}
      >
        <Sun className={`${iconSizes[size] || iconSizes.md} stroke-[2.2]`} />
      </span>

      {/* Moon Icon (Dark Mode) */}
      <span
        className={`absolute transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex items-center justify-center text-[#AFC69B] group-hover:text-[#F0EEE4] ${
          darkMode 
            ? 'rotate-0 scale-100 opacity-100 group-hover:-rotate-12' 
            : '-rotate-90 scale-0 opacity-0 pointer-events-none'
        }`}
      >
        <Moon className={`${iconSizes[size] || iconSizes.md} stroke-[2.2]`} />
      </span>
    </button>
  );
}
