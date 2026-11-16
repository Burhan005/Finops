import React from 'react';

/**
 * ClusterMeshIcon: Enterprise High-Precision Vector Distributed Cluster Symbol
 * 
 * Represents an authentic multi-node cloud computing cluster (Kubernetes, EKS, OpenSearch, ECS, DB Clusters):
 * - Central Master/Coordinator node with core consensus pulse
 * - 4 Orbiting Worker/Data Nodes with dedicated telemetry bus interconnects
 * - Perimeter data synchronization mesh
 * - 100% crisp vector precision (zero blurring, non-scaling stroke, geometric precision)
 */
export default function ClusterMeshIcon({
  className = "w-5 h-5",
  size,
  strokeWidth = 2,
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
      {/* Outer Data Synchronization Ring / Bus Mesh */}
      <polygon
        points="12,3.5 20.5,12 12,20.5 3.5,12"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2 2"
        opacity="0.45"
      />

      {/* Primary Interconnect Trunks (Connecting Master Node to Worker Nodes) */}
      <line x1="12" y1="5.5" x2="12" y2="9.5" stroke="currentColor" strokeWidth={strokeWidth} />
      <line x1="12" y1="14.5" x2="12" y2="18.5" stroke="currentColor" strokeWidth={strokeWidth} />
      <line x1="5.5" y1="12" x2="9.5" y2="12" stroke="currentColor" strokeWidth={strokeWidth} />
      <line x1="14.5" y1="12" x2="18.5" y2="12" stroke="currentColor" strokeWidth={strokeWidth} />

      {/* Central Coordinator / Master Quorum Node */}
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth={strokeWidth} fill="currentColor" fillOpacity="0.25" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />

      {/* Satellite Compute / Data Worker Nodes */}
      <circle cx="12" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.8" fill="currentColor" fillOpacity="0.2" />
      <circle cx="20.5" cy="12" r="2" stroke="currentColor" strokeWidth="1.8" fill="currentColor" fillOpacity="0.2" />
      <circle cx="12" cy="20.5" r="2" stroke="currentColor" strokeWidth="1.8" fill="currentColor" fillOpacity="0.2" />
      <circle cx="3.5" cy="12" r="2" stroke="currentColor" strokeWidth="1.8" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}
