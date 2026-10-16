import React, { useEffect, useRef, useState } from 'react';

/**
 * LivingIntelligenceField (Concept A)
 * 
 * A dimensional computational field of interconnected cloud resource pathways,
 * flowing data streams, and hierarchical nodes (Compute, Storage, Database, Network).
 * 
 * Technical attributes:
 * - High-DPI Canvas rendering (60 FPS optimized with delta time)
 * - Multi-tier depth projection (Z-coordinates with perspective scale and atmospheric falloff)
 * - Bezier cost-allocation trajectories with animated photon packets
 * - Interactive pointer parallax & node luminescence
 * - Respects prefers-reduced-motion & tab visibility
 * - Strictly bounded to Ivory & Forest palette
 */
export default function LivingIntelligenceField({
  darkMode = false,
  interactive = true,
  speed = 1.0,
  density = 'normal',
  className = ''
}) {
  const canvasRef = useRef(null);
  const pointerPos = useRef({ x: -1000, y: -1000, targetX: -1000, targetY: -1000 });
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = window.devicePixelRatio || 1;

    // Check reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Node count based on density
    const nodeCount = density === 'low' ? 24 : density === 'high' ? 56 : 38;

    // Cloud resource archetypes with categorical weights
    const archetypes = [
      { type: 'compute', weight: 4, radius: 5.5, label: 'EC2/ECS' },
      { type: 'storage', weight: 3, radius: 4.5, label: 'S3/EBS' },
      { type: 'database', weight: 2, radius: 6.0, label: 'RDS/Aurora' },
      { type: 'network', weight: 3, radius: 4.0, label: 'VPC/NAT' },
      { type: 'gateway', weight: 1, radius: 7.0, label: 'Nexus' }
    ];

    // Seeded initial nodes with 3D coordinates (x: -0.5..0.5, y: -0.5..0.5, z: 0.2..1.0)
    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      const arch = archetypes[i % archetypes.length];
      nodes.push({
        x: (Math.random() - 0.5) * 1.8,
        y: (Math.random() - 0.5) * 1.6,
        z: 0.25 + Math.random() * 0.75, // 0.25 (distant) to 1.0 (near)
        baseRadius: arch.radius,
        type: arch.type,
        pulseOffset: Math.random() * Math.PI * 2,
        driftSpeedX: (Math.random() - 0.5) * 0.04 * speed,
        driftSpeedY: (Math.random() - 0.5) * 0.03 * speed,
        connections: []
      });
    }

    // Connect nodes with proximity-based hierarchical edges
    for (let i = 0; i < nodes.length; i++) {
      const n1 = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const n2 = nodes[j];
        const dx = n1.x - n2.x;
        const dy = n1.y - n2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.42 && n1.connections.length < 4 && n2.connections.length < 4) {
          n1.connections.push({
            targetIdx: j,
            dist,
            curvature: (Math.random() - 0.5) * 0.15,
            packetPos: Math.random(),
            packetSpeed: (0.15 + Math.random() * 0.25) * speed
          });
        }
      }
    }

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      width = canvas.parentElement ? canvas.parentElement.clientWidth : window.innerWidth;
      height = canvas.parentElement ? canvas.parentElement.clientHeight : window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const handlePointerMove = (e) => {
      if (!interactive) return;
      const rect = canvas.getBoundingClientRect();
      pointerPos.current.targetX = e.clientX - rect.left;
      pointerPos.current.targetY = e.clientY - rect.top;
    };

    const handlePointerLeave = () => {
      pointerPos.current.targetX = -1000;
      pointerPos.current.targetY = -1000;
    };

    if (interactive) {
      window.addEventListener('mousemove', handlePointerMove, { passive: true });
      document.addEventListener('mouseleave', handlePointerLeave);
    }

    // Palette tokens
    const getColors = () => {
      if (darkMode) {
        return {
          forestStroke: 'rgba(175, 198, 155, 0.24)',
          forestHighlight: 'rgba(175, 198, 155, 0.95)',
          forestGlow: 'rgba(73, 102, 77, 0.35)',
          nodeFill: 'rgba(37, 46, 38, 0.9)',
          nodeCore: 'rgba(175, 198, 155, 0.85)',
          packet: 'rgba(240, 238, 228, 0.95)',
          ambientHaze: 'rgba(73, 102, 77, 0.08)'
        };
      } else {
        return {
          forestStroke: 'rgba(73, 102, 77, 0.22)',
          forestHighlight: 'rgba(73, 102, 77, 0.85)',
          forestGlow: 'rgba(73, 102, 77, 0.18)',
          nodeFill: 'rgba(255, 252, 245, 0.95)',
          nodeCore: 'rgba(73, 102, 77, 0.9)',
          packet: 'rgba(73, 102, 77, 0.95)',
          ambientHaze: 'rgba(230, 233, 221, 0.45)'
        };
      }
    };

    const render = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      // Pointer lerp
      pointerPos.current.x += (pointerPos.current.targetX - pointerPos.current.x) * 0.08;
      pointerPos.current.y += (pointerPos.current.targetY - pointerPos.current.y) * 0.08;

      ctx.clearRect(0, 0, width, height);

      const colors = getColors();
      const centerX = width * 0.5;
      const centerY = height * 0.5;

      // Dynamic tilt offset based on pointer position (-20px to +20px)
      const tiltX = pointerPos.current.x > 0 ? ((pointerPos.current.x - centerX) / width) * 28 : 0;
      const tiltY = pointerPos.current.y > 0 ? ((pointerPos.current.y - centerY) / height) * 28 : 0;

      // Step nodes position & compute screen coordinates
      const projected = nodes.map((n) => {
        if (!prefersReducedMotion) {
          n.x += n.driftSpeedX * dt;
          n.y += n.driftSpeedY * dt;

          // Boundary rebound
          if (n.x < -0.9 || n.x > 0.9) n.driftSpeedX *= -1;
          if (n.y < -0.8 || n.y > 0.8) n.driftSpeedY *= -1;
        }

        // Perspective projection
        const scale = 0.5 + n.z * 0.7;
        const sx = centerX + (n.x * width * 0.48) + (tiltX * n.z);
        const sy = centerY + (n.y * height * 0.44) + (tiltY * n.z);

        // Distance to pointer
        const pdx = pointerPos.current.x - sx;
        const pdy = pointerPos.current.y - sy;
        const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
        const isHovered = pDist < 120;
        const hoverStrength = isHovered ? (1 - pDist / 120) : 0;

        return {
          sx,
          sy,
          scale,
          z: n.z,
          radius: (n.baseRadius * scale) + (hoverStrength * 3.5),
          hoverStrength,
          pulse: Math.sin(timestamp * 0.002 * speed + n.pulseOffset),
          node: n
        };
      });

      // Draw Connection Pathways (Curved Beziers)
      ctx.lineWidth = 1.0;
      for (let i = 0; i < projected.length; i++) {
        const p1 = projected[i];
        for (const conn of p1.node.connections) {
          const p2 = projected[conn.targetIdx];
          if (!p2) continue;

          // Midpoint with natural arch
          const midX = (p1.sx + p2.sx) * 0.5 + conn.curvature * width;
          const midY = (p1.sy + p2.sy) * 0.5 - Math.abs(conn.curvature) * height * 0.3;

          const edgeHover = Math.max(p1.hoverStrength, p2.hoverStrength);
          const alpha = (0.12 + p1.z * 0.16) + (edgeHover * 0.45);

          ctx.beginPath();
          ctx.moveTo(p1.sx, p1.sy);
          ctx.quadraticCurveTo(midX, midY, p2.sx, p2.sy);
          ctx.strokeStyle = edgeHover > 0.2 ? colors.forestHighlight : colors.forestStroke;
          ctx.lineWidth = (0.8 + p1.z * 0.8) + (edgeHover * 1.2);
          ctx.stroke();

          // Cost allocation packet telemetry
          if (!prefersReducedMotion) {
            conn.packetPos = (conn.packetPos + conn.packetSpeed * dt) % 1.0;
            const t = conn.packetPos;
            // Quadratic Bezier interpolation: B(t) = (1-t)^2*P0 + 2(1-t)t*P1 + t^2*P2
            const omt = 1 - t;
            const px = omt * omt * p1.sx + 2 * omt * t * midX + t * t * p2.sx;
            const py = omt * omt * p1.sy + 2 * omt * t * midY + t * t * p2.sy;

            ctx.beginPath();
            ctx.arc(px, py, 1.8 + p1.z * 1.2, 0, Math.PI * 2);
            ctx.fillStyle = colors.packet;
            ctx.shadowColor = colors.forestHighlight;
            ctx.shadowBlur = 6;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }

      // Draw Hierarchical Nodes (Z-sorted for correct depth)
      projected.sort((a, b) => a.z - b.z);

      for (const p of projected) {
        // Outer halo glow
        const glowRadius = p.radius * (2.2 + p.pulse * 0.3 + p.hoverStrength * 1.2);
        const grad = ctx.createRadialGradient(p.sx, p.sy, p.radius * 0.5, p.sx, p.sy, glowRadius);
        grad.addColorStop(0, colors.forestGlow);
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.beginPath();
        ctx.arc(p.sx, p.sy, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Node base surface (Tactile Clay appearance with bevel)
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = colors.nodeFill;
        ctx.strokeStyle = p.hoverStrength > 0.2 ? colors.forestHighlight : colors.forestStroke;
        ctx.lineWidth = 1.4;
        ctx.fill();
        ctx.stroke();

        // Inner luminous core
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, p.radius * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = colors.nodeCore;
        ctx.fill();
      }

      if (!prefersReducedMotion) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      if (interactive) {
        window.removeEventListener('mousemove', handlePointerMove);
        document.removeEventListener('mouseleave', handlePointerLeave);
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [darkMode, interactive, speed, density]);

  return (
    <div className={`relative w-full h-full overflow-hidden pointer-events-none select-none ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ transform: 'translateZ(0)' }}
      />
    </div>
  );
}
