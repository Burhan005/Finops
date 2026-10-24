import React from 'react';

/**
 * ZorvexLogo
 * 
 * Official ZORVEX Identity System (Synchronized with downloaded brand kit):
 * - variant="mark" (Default): Clean horizontal brand lockup using the official Zorvex Mark
 *   - Light Mode: Amber #FF9A1A + Charcoal #23272C
 *   - Dark Mode: Amber #FF9A1A + Pure White #FFFFFF
 * - variant="stacked": High-resolution vertical lockup for Hero sections & landing showcases
 *   - Light Mode: /zorvex-logo-stacked.png
 *   - Dark Mode: /zorvex-logo-stacked-reversed.png
 * - Fully vector-sharp, zero green artifacts, seamless light/dark mode adaptation.
 */
export default function ZorvexLogo({ 
  size = 'md', 
  showWordmark = true, 
  showTagline = true,
  className = '',
  forceLightText = false,
  variant = 'mark' // 'mark' | 'stacked'
}) {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    '2xl': 'w-20 h-20'
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-3xl'
  };

  // Stacked Logo Variant (for Landing Page Hero / High-Impact Showcases)
  if (variant === 'stacked') {
    const stackedWidths = {
      sm: 'max-w-[140px]',
      md: 'max-w-[180px]',
      lg: 'max-w-[240px]',
      xl: 'max-w-[320px]',
      hero: 'max-w-[380px] sm:max-w-[440px]'
    };

    return (
      <div className={`flex flex-col items-center select-none ${className}`}>
        {forceLightText ? (
          <img 
            src="/zorvex-logo-stacked-reversed.png" 
            alt="ZORVEX - See Beyond Spend." 
            className={`w-full h-auto object-contain ${stackedWidths[size] || stackedWidths.md}`}
          />
        ) : (
          <>
            <img 
              src="/zorvex-logo-stacked.png" 
              alt="ZORVEX - See Beyond Spend." 
              className={`w-full h-auto object-contain block dark:hidden ${stackedWidths[size] || stackedWidths.md}`}
            />
            <img 
              src="/zorvex-logo-stacked-reversed.png" 
              alt="ZORVEX - See Beyond Spend." 
              className={`w-full h-auto object-contain hidden dark:block ${stackedWidths[size] || stackedWidths.md}`}
            />
          </>
        )}
      </div>
    );
  }

  // Horizontal Mark & Typography Variant (for Navbars, Headers, Modals)
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Official Zorvex Adaptive Vector Mark */}
      <div 
        className={`${iconSizes[size] || iconSizes.md} relative flex items-center justify-center flex-shrink-0 select-none transition-transform duration-200 group-hover:scale-105`}
      >
        <svg 
          viewBox="5 -20 240 240" 
          fill="none" 
          className="w-full h-full filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.12)]"
          style={{ shapeRendering: 'geometricPrecision' }}
        >
          {/* Top Amber Sweep (Universal) */}
          <path 
            fill="#FF9A1A" 
            d="M 22 78 C 62 44 130 30 226 30 C 205 56 152 100 103 128 L 160 71 Q 167 64 152 64 C 132 64 80 64 22 78 Z"
          />
          {/* Bottom Sweep: Adapts to Dark Mode / Light Mode */}
          <path 
            className={forceLightText ? "fill-white" : "fill-[#23272C] dark:fill-white"}
            d="M 228 122 C 188 156 120 170 24 170 C 45 144 98 100 147 72 L 90 129 Q 83 136 98 136 C 118 136 170 136 228 122 Z"
          />
        </svg>
      </div>

      {/* Official Typography Wordmark & Tagline */}
      {showWordmark && (
        <div className="flex flex-col select-none">
          <div className="flex items-center gap-1.5">
            <span 
              className={`${textSizes[size] || textSizes.md} font-black tracking-tight leading-none ${
                forceLightText ? 'text-white' : 'text-zorvex-text dark:text-zorvex-dark-text'
              }`}
              style={{
                letterSpacing: '-0.025em'
              }}
            >
              ZORVEX
            </span>
          </div>
          {showTagline && (
            <p className={`hidden sm:block text-[10px] font-semibold mt-0.5 tracking-tight ${
              forceLightText ? 'text-slate-400' : 'text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary'
            }`}>
              See Beyond Spend.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
