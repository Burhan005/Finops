import React from 'react';
import LivingCostTopology from '../backgrounds/LivingCostTopology';

/**
 * AmbientBackground
 * 
 * Multi-layered atmospheric environment for ZORVEX:
 * - Living Cost Topology: architectural stepped contour planes & living telemetry streams
 * - Subtle, calm, non-intrusive ambient illumination in high-contrast Obsidian & Alabaster
 * - Zero fiery cursor halos, zero mouse tether shadows (engineered for zero eye strain)
 * - Hardware accelerated & respects prefers-reduced-motion
 */
export default function AmbientBackground({ darkMode }) {
  return (
    <div 
      aria-hidden="true" 
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none transition-colors duration-500"
    >
      {/* Primary Architectural Landscape: Living Cost Topology */}
      <div className="absolute inset-0 opacity-80 dark:opacity-85 transition-opacity duration-700">
        <LivingCostTopology 
          darkMode={darkMode} 
          interactive={false} 
          speed={0.8}
          density="high"
        />
      </div>

      {/* Layer 1: Ambient Radial Specular Orb (Top-Left: 135° Azimuth Subtle Highlight) */}
      <div 
        className="absolute -top-16 -left-16 sm:-top-24 sm:-left-24 md:-top-32 md:-left-32 w-[320px] h-[320px] sm:w-[480px] sm:h-[480px] md:w-[650px] md:h-[650px] max-w-[90vw] max-h-[90vw] rounded-full blur-[80px] sm:blur-[100px] md:blur-[120px] opacity-15 dark:opacity-15 transition-all duration-700 pointer-events-none"
        style={{
          background: darkMode 
            ? 'radial-gradient(circle, rgba(255, 255, 255, 0.05) 0%, transparent 75%)'
            : 'radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(238, 242, 246, 0.45) 45%, transparent 75%)'
        }}
      />

      {/* Layer 2: Subtle Architectural Vignette */}
      <div 
        className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/[0.02] dark:to-black/[0.12] pointer-events-none"
      />
    </div>
  );
}
