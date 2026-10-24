import React, { useState, useEffect, useRef } from 'react';

/**
 * AnimatedCounter — Smooth 60 FPS Ease-Out Number Ticker
 * Seamlessly transitions numbers from 0 to target on load,
 * and interpolates from old to new value on filter / currency change.
 */
export default function AnimatedCounter({
  value = 0,
  prefix = '',
  suffix = '',
  decimals = 2,
  duration = 850,
  locale = 'en-US',
  className = ''
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);
  const animFrameRef = useRef(null);

  useEffect(() => {
    const prefersReducedMotion = typeof window !== 'undefined' && 
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const startVal = Number(prevValueRef.current) || 0;
    const endVal = Number(value) || 0;
    prevValueRef.current = endVal;

    if (prefersReducedMotion || duration <= 0) {
      setDisplayValue(endVal);
      return;
    }

    let startTime = null;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic curve (snappy acceleration, soft glide into final number)
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * ease;

      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endVal);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [value, duration]);

  const formattedNumber = typeof displayValue === 'number' && Number.isFinite(displayValue)
    ? displayValue.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })
    : '0';

  return (
    <span className={`inline-block tabular-nums font-mono ${className}`}>
      {prefix}{formattedNumber}{suffix}
    </span>
  );
}
