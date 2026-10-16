import React, { useEffect, useRef } from 'react';

/**
 * ComputationalCostTopology (Concept B)
 * 
 * An architectural visualization featuring layered geometric surfaces,
 * precise contour lines, dimensional planes, and organized pathways
 * converging into a clear focal structure.
 * 
 * Technical attributes:
 * - Geometric isometric contour slicing with mathematical trigonometric elevation
 * - Upper-left directional illumination (135° azimuth) matching Claymorphism lighting
 * - Convergence nexus of enterprise cost allocation pathways
 * - High-precision benchmark crosshairs & architectural grid
 * - GPU-accelerated canvas with smooth pointer perspective parallax
 */
export default function ComputationalCostTopology({
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

    const contourCount = density === 'low' ? 9 : density === 'high' ? 18 : 14;

    const getColors = () => {
      if (darkMode) {
        return {
          bg: '#19211B',
          planeFill: 'rgba(37, 46, 38, 0.45)',
          planeDeep: 'rgba(29, 38, 31, 0.75)',
          contourLine: 'rgba(175, 198, 155, 0.28)',
          contourMajor: 'rgba(175, 198, 155, 0.65)',
          contourGlow: 'rgba(73, 102, 77, 0.35)',
          gridLine: 'rgba(59, 73, 61, 0.3)',
          nexus: '#AFC69B',
          nexusGlow: 'rgba(175, 198, 155, 0.4)',
          flowBeam: 'rgba(175, 198, 155, 0.75)',
          benchMark: 'rgba(183, 192, 174, 0.45)'
        };
      } else {
        return {
          bg: '#F3F0E7',
          planeFill: 'rgba(255, 252, 245, 0.65)',
          planeDeep: 'rgba(230, 233, 221, 0.55)',
          contourLine: 'rgba(73, 102, 77, 0.22)',
          contourMajor: 'rgba(73, 102, 77, 0.55)',
          contourGlow: 'rgba(73, 102, 77, 0.12)',
          gridLine: 'rgba(227, 220, 203, 0.6)',
          nexus: '#49664D',
          nexusGlow: 'rgba(73, 102, 77, 0.25)',
          flowBeam: 'rgba(73, 102, 77, 0.65)',
          benchMark: 'rgba(101, 107, 95, 0.4)'
        };
      }
    };

    let phase = 0;

    const render = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      if (!prefersReducedMotion) {
        phase += dt * 0.4 * speed;
      }

      // Pointer lerp
      pointerPos.current.x += (pointerPos.current.targetX - pointerPos.current.x) * 0.06;
      pointerPos.current.y += (pointerPos.current.targetY - pointerPos.current.y) * 0.06;

      ctx.clearRect(0, 0, width, height);

      const colors = getColors();
      const centerX = width * 0.5;
      const centerY = height * 0.48;

      // Parallax tilt angles
      const rotX = pointerPos.current.x > 0 ? ((pointerPos.current.x - centerX) / width) * 0.18 : 0;
      const rotY = pointerPos.current.y > 0 ? ((pointerPos.current.y - centerY) / height) * 0.18 : 0;

      // Draw subtle background architectural coordinate grid
      const gridSize = 48;
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
      ctx.lineWidth = 1;
      ctx.strokeStyle = colors.benchMark;
      const crossStep = gridSize * 3;
      for (let x = (centerX % crossStep); x < width; x += crossStep) {
        for (let y = (centerY % crossStep); y < height; y += crossStep) {
          ctx.beginPath();
          ctx.moveTo(x - 4, y);
          ctx.lineTo(x + 4, y);
          ctx.moveTo(x, y - 4);
          ctx.lineTo(x, y + 4);
          ctx.stroke();
        }
      }

      // Draw Layered Contour Strata (From outermost to central peak)
      const baseRadiusX = width * 0.38;
      const baseRadiusY = height * 0.28;

      for (let i = contourCount; i >= 1; i--) {
        const factor = i / contourCount;
        const rx = baseRadiusX * factor;
        const ry = baseRadiusY * factor;
        const elevation = (1 - factor) * 110; // Stepped elevation upwards

        // Elevation displacement with tilt
        const offsetX = centerX + rotX * elevation * 0.8;
        const offsetY = centerY - elevation + rotY * elevation * 0.6;

        const isMajor = i % 3 === 0;

        ctx.beginPath();
        const steps = 64;
        for (let s = 0; s <= steps; s++) {
          const theta = (s / steps) * Math.PI * 2;
          
          // Organic mathematical cost distribution harmonic
          const harmonic = Math.sin(theta * 3 + phase + i * 0.3) * 0.08 +
                           Math.cos(theta * 5 - phase * 0.5) * 0.04;
          
          const rCurX = rx * (1 + harmonic);
          const rCurY = ry * (1 + harmonic);

          const px = offsetX + Math.cos(theta) * rCurX;
          const py = offsetY + Math.sin(theta) * rCurY;

          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();

        // Shading fill
        ctx.fillStyle = i % 2 === 0 ? colors.planeFill : colors.planeDeep;
        ctx.fill();

        // Directional rim lighting: upper-left highlight, lower-right ambient line
        ctx.strokeStyle = isMajor ? colors.contourMajor : colors.contourLine;
        ctx.lineWidth = isMajor ? 1.6 : 0.9;
        ctx.stroke();

        // Minor tick marks on major contour rings
        if (isMajor) {
          ctx.fillStyle = colors.contourMajor;
          for (let m = 0; m < 8; m++) {
            const mTheta = (m / 8) * Math.PI * 2 + (phase * 0.1);
            const tx = offsetX + Math.cos(mTheta) * rx;
            const ty = offsetY + Math.sin(mTheta) * ry;
            ctx.beginPath();
            ctx.arc(tx, ty, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Central Nexus Structure (Institutional Apex)
      const apexElevation = 135;
      const apexX = centerX + rotX * apexElevation * 0.8;
      const apexY = centerY - apexElevation + rotY * apexElevation * 0.6;

      // Glow behind apex
      const apexGlow = ctx.createRadialGradient(apexX, apexY, 2, apexX, apexY, 65);
      apexGlow.addColorStop(0, colors.nexusGlow);
      apexGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(apexX, apexY, 65, 0, Math.PI * 2);
      ctx.fillStyle = apexGlow;
      ctx.fill();

      // Apex faceted polygon
      ctx.beginPath();
      ctx.arc(apexX, apexY, 9, 0, Math.PI * 2);
      ctx.fillStyle = colors.nexus;
      ctx.shadowColor = colors.nexus;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Converging Cost-Flow Pathway Beams
      const beamCount = 6;
      for (let b = 0; b < beamCount; b++) {
        const bTheta = (b / beamCount) * Math.PI * 2 + phase * 0.2;
        const outerX = centerX + Math.cos(bTheta) * baseRadiusX * 1.1;
        const outerY = centerY + Math.sin(bTheta) * baseRadiusY * 1.1;

        ctx.beginPath();
        ctx.moveTo(outerX, outerY);
        ctx.lineTo(apexX, apexY);
        ctx.strokeStyle = colors.flowBeam;
        ctx.lineWidth = 1.0;
        ctx.setLineDash([4, 6]);
        ctx.lineDashOffset = -phase * 20;
        ctx.stroke();
        ctx.setLineDash([]);
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
