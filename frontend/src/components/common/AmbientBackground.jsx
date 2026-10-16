import React, { useEffect, useState, useRef } from 'react';
import LivingCostTopology from '../backgrounds/LivingCostTopology';

/**
 * AmbientBackground
 * 
 * Multi-layered atmospheric environment for ZORVEX:
 * - Living Cost Topology: architectural stepped contour planes & living telemetry streams
 * - Diffused ambient illumination in Ivory & Forest palette
 * - Interactive smoothed pointer luminescence on desktop
 * - Full dark/light mode coordination using Ivory (#F3F0E7) and Forest (#49664D / #AFC69B)
 * - Hardware accelerated & respects prefers-reduced-motion
 */
export default function AmbientBackground({ darkMode }) {
  const [mousePos, setMousePos] = useState({ x: -500, y: -500 });
  const [isPointerActive, setIsPointerActive] = useState(false);
  const targetPos = useRef({ x: -500, y: -500 });
  const currentPos = useRef({ x: -500, y: -500 });
  const animFrameId = useRef(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) return;

    const handleMouseMove = (e) => {
      targetPos.current = { x: e.clientX, y: e.clientY };
      if (!isPointerActive) setIsPointerActive(true);
    };

    const handleMouseLeave = () => {
      setIsPointerActive(false);
      targetPos.current = { x: -500, y: -500 };
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    const lerp = (start, end, factor) => start + (end - start) * factor;
    const animate = () => {
      currentPos.current.x = lerp(currentPos.current.x, targetPos.current.x, 0.08);
      currentPos.current.y = lerp(currentPos.current.y, targetPos.current.y, 0.08);
      setMousePos({ x: currentPos.current.x, y: currentPos.current.y });
      animFrameId.current = requestAnimationFrame(animate);
    };

    animFrameId.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [isPointerActive]);

  return (
    <div 
      aria-hidden="true" 
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none transition-colors duration-500"
    >
      {/* Primary Architectural Landscape: Living Cost Topology */}
      <div className="absolute inset-0 opacity-85 dark:opacity-90 transition-opacity duration-700">
        <LivingCostTopology 
          darkMode={darkMode} 
          interactive={true} 
          speed={0.8}
          density="normal"
        />
      </div>

      {/* Layer 1: Ambient Radial Specular Orb (Top-Left: 135° Azimuth Highlight) */}
      <div 
        className="absolute -top-16 -left-16 sm:-top-24 sm:-left-24 md:-top-32 md:-left-32 w-[320px] h-[320px] sm:w-[480px] sm:h-[480px] md:w-[650px] md:h-[650px] max-w-[90vw] max-h-[90vw] rounded-full blur-[80px] sm:blur-[100px] md:blur-[120px] opacity-25 dark:opacity-25 transition-all duration-700 pointer-events-none"
        style={{
          background: darkMode 
            ? 'radial-gradient(circle, rgba(175, 198, 155, 0.22) 0%, rgba(37, 46, 38, 0.12) 50%, transparent 75%)'
            : 'radial-gradient(circle, rgba(73, 102, 77, 0.12) 0%, rgba(230, 233, 221, 0.35) 45%, transparent 75%)'
        }}
      />

      {/* Layer 2: Interactive Pointer Luminescence (Desktop) */}
      {isPointerActive && (
        <div 
          className="absolute w-[450px] h-[450px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px] opacity-20 dark:opacity-20 transition-opacity duration-300 pointer-events-none will-change-transform"
          style={{
            transform: `translate3d(${mousePos.x}px, ${mousePos.y}px, 0)`,
            background: darkMode
              ? 'radial-gradient(circle, rgba(175, 198, 155, 0.2) 0%, rgba(37, 46, 38, 0.1) 50%, transparent 70%)'
              : 'radial-gradient(circle, rgba(73, 102, 77, 0.08) 0%, rgba(230, 233, 221, 0.3) 50%, transparent 70%)'
          }}
        />
      )}

      {/* Layer 3: Subtle Architectural Vignette */}
      <div 
        className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/[0.03] dark:to-black/[0.15] pointer-events-none"
      />
    </div>
  );
}
