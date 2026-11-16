import React from 'react';

/**
 * ServerlessLambdaIcon: Authentic Vector Lambda (λ) Symbol for Serverless Cloud Compute
 * 
 * The universally recognized industry symbol for AWS Lambda, serverless functions, and event-driven compute.
 * Matches Lucide 24x24 monochrome stroke aesthetic (strokeWidth=2.2, round caps, geometric precision).
 */
export default function ServerlessLambdaIcon({
  className = "w-5 h-5",
  size,
  strokeWidth = 2.2,
  ...props
}) {
  const dimensionProps = size ? { width: size, height: size } : {};

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{
        shapeRendering: 'geometricPrecision',
        vectorEffect: 'non-scaling-stroke',
        display: 'inline-block',
        verticalAlign: 'middle'
      }}
      {...dimensionProps}
      {...props}
    >
      {/* Primary Diagonal Stem (Top-Left to Bottom-Right) */}
      <line x1="9.5" y1="4.5" x2="18.5" y2="19.5" stroke="currentColor" strokeWidth={strokeWidth} />
      
      {/* Left Supporting Arm (Bottom-Left connecting to trunk) */}
      <path
        d="M 5.5 19.5 C 7.5 17 10 14 13.3 11.2"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}
