import React, { useEffect, useRef } from 'react';

/**
 * LivingCostTopology (Definitive Production Background — Concept A + B + C Synthesis)
 * 
 * An art-directed fusion of all three FinOps dimensional concepts:
 * - Concept C (Resource Terrain): Parametric strata ribbons rolling across the lower viewport with harmonic wave physics and upper-rim specular bevel highlights.
 * - Concept B (Computational Cost Topology): Stepped isometric contour terraces, architectural grid, benchmark crosshairs (+), and central apex nexus.
 * - Concept A (Living Intelligence Field): Interconnected cloud resource nodes (Compute, Storage, Database, Network) with flowing Bezier curves and animated photon telemetry packets.
 * 
 * Hardware-accelerated High-DPI Canvas, 60 FPS delta-time physics, pointer perspective parallax,
 * respecting prefers-reduced-motion, with full Ivory (#F3F0E7) and Obsidian Forest (#19211B) parity.
 */
export default function LivingCostTopology({
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

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
      document.removeEventListener('mouseleave', handlePointerLeave);
    }

    // Geometry counts scaled by density
    const nodeCount = density === 'low' ? 18 : density === 'high' ? 42 : 28;
    const contourCount = density === 'low' ? 6 : density === 'high' ? 12 : 8;
    const terrainRibbonCount = density === 'low' ? 5 : density === 'high' ? 10 : 7;

    // Concept A: Resource Nodes Archetypes
    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      const angle = (i / nodeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const distRatio = 0.22 + (i % 4) * 0.22 + Math.random() * 0.12;
      nodes.push({
        baseAngle: angle,
        distRatio,
        radius: 3.5 + (i % 4) * 1.5,
        type: i % 4 === 0 ? 'compute' : i % 4 === 1 ? 'db' : i % 4 === 2 ? 'storage' : 'net',
        packetPos: Math.random(),
        packetSpeed: (0.12 + Math.random() * 0.18) * speed,
        pulseOffset: Math.random() * Math.PI * 2
      });
    }

    // Color Palette Tokens
    const getColors = () => {
      if (darkMode) {
        return {
          bg: '#19211B',
          // Concept B: Isometric Contours
          planeFill: 'rgba(37, 46, 38, 0.38)',
          planeDeep: 'rgba(29, 38, 31, 0.65)',
          contourLine: 'rgba(175, 198, 155, 0.32)',
          contourMajor: 'rgba(175, 198, 155, 0.65)',
          gridLine: 'rgba(59, 73, 61, 0.35)',
          benchMark: 'rgba(183, 192, 174, 0.5)',
          // Concept A: Nodes & Flow
          nexus: '#AFC69B',
          nexusGlow: 'rgba(175, 198, 155, 0.45)',
          flowLine: 'rgba(175, 198, 155, 0.32)',
          packet: 'rgba(240, 238, 228, 0.95)',
          nodeFill: 'rgba(37, 46, 38, 0.95)',
          nodeStroke: 'rgba(175, 198, 155, 0.65)',
          // Concept C: Terrain Ribbons
          terrainBase: [37, 46, 38], // #252E26
          terrainValley: [25, 33, 27], // #19211B
          terrainEdge: 'rgba(175, 198, 155, 0.45)',
          terrainEdgeBright: 'rgba(175, 198, 155, 0.85)'
        };
      } else {
        return {
          bg: '#F3F0E7',
          // Concept B: Isometric Contours
          planeFill: 'rgba(255, 252, 245, 0.62)',
          planeDeep: 'rgba(230, 233, 221, 0.45)',
          contourLine: 'rgba(73, 102, 77, 0.18)',
          contourMajor: 'rgba(73, 102, 77, 0.42)',
          gridLine: 'rgba(227, 220, 203, 0.55)',
          benchMark: 'rgba(101, 107, 95, 0.35)',
          // Concept A: Nodes & Flow
          nexus: '#49664D',
          nexusGlow: 'rgba(73, 102, 77, 0.22)',
          flowLine: 'rgba(73, 102, 77, 0.18)',
          packet: 'rgba(73, 102, 77, 0.95)',
          nodeFill: 'rgba(255, 252, 245, 0.95)',
          nodeStroke: 'rgba(73, 102, 77, 0.5)',
          // Concept C: Terrain Ribbons
          terrainBase: [255, 252, 245], // #FFFCF5
          terrainValley: [230, 233, 221], // #E6E9DD
          terrainEdge: 'rgba(73, 102, 77, 0.35)',
          terrainEdgeBright: 'rgba(73, 102, 77, 0.75)'
        };
      }
    };

    let phase = 0;

    const render = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      if (!width || !height || width <= 10 || height <= 10 || !Number.isFinite(width) || !Number.isFinite(height)) {
        animId = requestAnimationFrame(render);
        return;
      }

      if (!prefersReducedMotion) {
        phase += dt * 0.35 * speed;
      }

      // Smooth pointer lerp
      pointerPos.current.x += (pointerPos.current.targetX - pointerPos.current.x) * 0.05;
      pointerPos.current.y += (pointerPos.current.targetY - pointerPos.current.y) * 0.05;

      ctx.clearRect(0, 0, width, height);

      const colors = getColors();
      const centerX = width * 0.5;
      const centerY = height * 0.44;

      // Parallax tilt angles from cursor (guarded against division by zero)
      const tiltX = (width > 0 && pointerPos.current.x > 0) ? ((pointerPos.current.x - centerX) / width) * 26 : 0;
      const tiltY = (height > 0 && pointerPos.current.y > 0) ? ((pointerPos.current.y - centerY) / height) * 26 : 0;
      const safeTiltX = Number.isFinite(tiltX) ? tiltX : 0;
      const safeTiltY = Number.isFinite(tiltY) ? tiltY : 0;

      // =========================================================================
      // 1. CONCEPT B: Architectural Coordinate Grid & Benchmark Crosshairs (+)
      // =========================================================================
      const gridSize = 56;
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = colors.gridLine;

      for (let x = (centerX % gridSize); x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = (centerY % gridSize); y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Benchmark crosshairs at major grid intersections
      const crossStep = gridSize * 3;
      ctx.lineWidth = 1;
      ctx.strokeStyle = colors.benchMark;
      for (let x = (centerX % crossStep); x < width; x += crossStep) {
        for (let y = (centerY % crossStep); y < height; y += crossStep) {
          ctx.beginPath();
          ctx.moveTo(x - 3.5, y);
          ctx.lineTo(x + 3.5, y);
          ctx.moveTo(x, y - 3.5);
          ctx.lineTo(x, y + 3.5);
          ctx.stroke();
        }
      }

      // =========================================================================
      // 2. CONCEPT C: Parametric Terrain Ribbons (Rolling along bottom horizon)
      // =========================================================================
      for (let r = 0; r < terrainRibbonCount; r++) {
        const factor = r / (terrainRibbonCount - 1);
        const startY = height * 0.62 + factor * height * 0.38;
        const amp = 14 + factor * 32;
        const freq = 0.003 - factor * 0.001;
        const phaseOffset = r * 0.5 + phase * 0.7;

        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, startY);

        const segments = 40;
        const pts = [];
        for (let s = 0; s <= segments; s++) {
          const x = (s / segments) * width;
          const h1 = Math.sin(x * freq + phaseOffset) * amp;
          const h2 = Math.cos(x * freq * 2.2 - phaseOffset * 0.5) * (amp * 0.35);
          const y = startY + h1 + h2;
          pts.push({ x, y });
          ctx.lineTo(x, y);
        }

        ctx.lineTo(width, height);
        ctx.closePath();

        // Strata gradient fill
        const [rB, gB, bB] = colors.terrainBase;
        const [rV, gV, bV] = colors.terrainValley;
        const alpha = 0.25 + factor * 0.45;
        const strataGrad = ctx.createLinearGradient(0, startY - amp, 0, startY + amp * 1.5);
        strataGrad.addColorStop(0, `rgba(${rB}, ${gB}, ${bB}, ${alpha})`);
        strataGrad.addColorStop(1, `rgba(${rV}, ${gV}, ${bV}, ${Math.min(1, alpha + 0.15)})`);
        ctx.fillStyle = strataGrad;
        ctx.fill();

        // Upper-edge specular rim lighting bevel
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
          else ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.strokeStyle = factor > 0.5 ? colors.terrainEdgeBright : colors.terrainEdge;
        ctx.lineWidth = 1.0 + factor * 1.2;
        ctx.stroke();
      }

      // =========================================================================
      // 3. CONCEPT B: Stepped Isometric Contour Terraces
      // =========================================================================
      const baseRadiusX = width * 0.42;
      const baseRadiusY = height * 0.32;

      for (let i = contourCount; i >= 1; i--) {
        const factor = i / contourCount;
        const rx = baseRadiusX * factor;
        const ry = baseRadiusY * factor;
        const elevation = (1 - factor) * 95;

        const offX = centerX + tiltX * (1 - factor);
        const offY = centerY - elevation + tiltY * (1 - factor);

        const isMajor = i % 3 === 0;

        ctx.beginPath();
        const steps = 60;
        for (let s = 0; s <= steps; s++) {
          const theta = (s / steps) * Math.PI * 2;
          const harmonic = Math.sin(theta * 3 + phase + i * 0.25) * 0.06;
          const rCurX = rx * (1 + harmonic);
          const rCurY = ry * (1 + harmonic);

          const px = offX + Math.cos(theta) * rCurX;
          const py = offY + Math.sin(theta) * rCurY;

          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();

        ctx.fillStyle = i % 2 === 0 ? colors.planeFill : colors.planeDeep;
        ctx.fill();

        ctx.strokeStyle = isMajor ? colors.contourMajor : colors.contourLine;
        ctx.lineWidth = isMajor ? 1.5 : 0.8;
        ctx.stroke();
      }

      // =========================================================================
      // 4. CONCEPT B: Focal Institutional Apex Nexus
      // =========================================================================
      const apexElevation = 115;
      const apexX = centerX + safeTiltX * 1.1;
      const apexY = centerY - apexElevation + safeTiltY * 1.1;

      if (Number.isFinite(apexX) && Number.isFinite(apexY)) {
        const apexGlow = ctx.createRadialGradient(apexX, apexY, 2, apexX, apexY, 70);
        apexGlow.addColorStop(0, colors.nexusGlow);
        apexGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(apexX, apexY, 70, 0, Math.PI * 2);
        ctx.fillStyle = apexGlow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(apexX, apexY, 8.5, 0, Math.PI * 2);
        ctx.fillStyle = colors.nexus;
        ctx.shadowColor = colors.nexus;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // =========================================================================
      // 5. CONCEPT A: Interconnected Resource Nodes & Flowing Bezier Telemetry
      // =========================================================================
      for (const node of nodes) {
        const curAngle = node.baseAngle + (prefersReducedMotion ? 0 : Math.sin(phase + node.distRatio * 4) * 0.08);
        const curDistX = baseRadiusX * node.distRatio;
        const curDistY = baseRadiusY * node.distRatio;

        const nx = centerX + Math.cos(curAngle) * curDistX + tiltX * node.distRatio;
        const ny = centerY + Math.sin(curAngle) * curDistY + tiltY * node.distRatio;

        // Curved Bezier pathway to Apex Nexus
        const midX = (nx + apexX) * 0.5 + Math.sin(node.baseAngle) * 35;
        const midY = (ny + apexY) * 0.5 - 20;

        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.quadraticCurveTo(midX, midY, apexX, apexY);
        ctx.strokeStyle = colors.flowLine;
        ctx.lineWidth = 1.0;
        ctx.stroke();

        // Flowing photon telemetry packet along the curve
        if (!prefersReducedMotion) {
          node.packetPos = (node.packetPos + node.packetSpeed * dt) % 1.0;
          const t = node.packetPos;
          const omt = 1 - t;
          const px = omt * omt * nx + 2 * omt * t * midX + t * t * apexX;
          const py = omt * omt * ny + 2 * omt * t * midY + t * t * apexY;

          ctx.beginPath();
          ctx.arc(px, py, 2.0, 0, Math.PI * 2);
          ctx.fillStyle = colors.packet;
          ctx.fill();
        }

        // Tactile Clay Resource Node with ambient glow
        const pulse = Math.sin(timestamp * 0.002 * speed + node.pulseOffset);
        ctx.beginPath();
        ctx.arc(nx, ny, node.radius * (1 + pulse * 0.15), 0, Math.PI * 2);
        ctx.fillStyle = colors.nodeFill;
        ctx.strokeStyle = colors.nodeStroke;
        ctx.lineWidth = 1.2;
        ctx.fill();
        ctx.stroke();

        // Luminous core dot
        ctx.beginPath();
        ctx.arc(nx, ny, node.radius * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = colors.nexus;
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
