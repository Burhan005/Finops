import React from 'react';

/**
 * ZorvexLogo
 * 
 * Official ZORVEX Claymorphic Brand Identity:
 * - Volumetric 3D tactile Z emblem with sculpted ivory & forest folds and glowing forest highlight seam
 * - Soft-touch bespoke typography matching the official identity system
 * - Supports sizes: 'sm' (header/navbar), 'md' (standard), 'lg' (showcases), 'xl' (hero)
 * - Contrast-aware: seamlessly adapts to light/dark themes with optional forceLightText
 */
export default function ZorvexLogo({ 
  size = 'md', 
  showWordmark = true, 
  showTagline = true,
  className = '',
  forceLightText = false,
  variant = '3d' // '3d' | 'tile' | 'flat'
}) {
  // Dimensions based on size
  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20'
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl'
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Official Volumetric Claymorphic 3D Emblem */}
      <div 
        className={`${iconSizes[size] || iconSizes.md} relative flex items-center justify-center flex-shrink-0 group select-none`}
      >
        {variant === 'tile' ? (
          <img 
            src="/favicon_exact_tile.png?v=4" 
            alt="ZORVEX App Tile" 
            className="w-full h-full object-contain rounded-2xl shadow-lg transition-transform duration-300 group-hover:scale-105" 
          />
        ) : (
          <img 
            src="/zorvex_emblem_3d_transparent.png?v=5" 
            alt="ZORVEX 3D Emblem" 
            className="w-full h-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.3)] transition-transform duration-300 group-hover:scale-105" 
          />
        )}
      </div>

      {/* Bespoke Soft-Touch Wordmark */}
      {showWordmark && (
        <div className="flex flex-col select-none">
          <div className="flex items-center gap-2">
            <span 
              className={`${textSizes[size] || textSizes.md} font-black tracking-tight leading-none ${
                forceLightText ? 'text-[#FFFCF5]' : 'text-zorvex-text dark:text-zorvex-dark-text'
              }`}
              style={{
                letterSpacing: '-0.02em',
                fontFeatureSettings: '"cv02", "cv03", "cv04"'
              }}
            >
              ZORVEX
            </span>
            <span className={`hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-black tracking-widest rounded-md uppercase leading-none ${
              forceLightText 
                ? 'bg-zorvex-forest-soft/30 text-[#FFFCF5] border border-zorvex-forest/40' 
                : 'bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-dark-forest-soft dark:text-zorvex-dark-forest border border-zorvex-forest/20'
            }`}>
              ENTERPRISE
            </span>
          </div>
          {showTagline && (
            <p className={`hidden sm:block text-[11px] font-semibold mt-0.5 tracking-tight ${
              forceLightText ? 'text-zorvex-dark-text-secondary' : 'text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary'
            }`}>
              See Beyond Spend.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
