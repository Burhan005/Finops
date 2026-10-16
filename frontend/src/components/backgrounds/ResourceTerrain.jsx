import React, { useEffect, useRef } from 'react';

/**
 * ResourceTerrain (Concept C)
 * 
 * A sculpted landscape of layered topographic forms, restrained directional
 * lighting, subtle depth, and finely detailed resource geometry.
 * 
 * Technical attributes:
 * - Parametric ribbon strata generated via multi-frequency sinusoidal waveforms
 * - Upper-edge rim illumination with directional clay highlights
 * - Atmospheric depth falloff (near ribbons crisp & dimensional; distant ribbons atmospheric)
 * - Gentle undulating wave physics simulating steady-state cloud operations
 * - Strictly bounded to Ivory & Forest palette
 */
export default function ResourceTerrain({
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

    const ribbonCount = density === 'low' ? 12 : density === 'high' ? 24 : 18;

    const getColors = () => {
      if (darkMode) {
        return {
          bg: '#19211B',
          strataBase: [37, 46, 38], // #252E26
          strataValley: [29, 38, 31], // #1D261F
          edgeHighlight: 'rgba(175, 198, 155, 0.75)',
          edgeSubtle: 'rgba(175, 198, 155, 0.25)',
          ambientShadow: 'rgba(0, 0, 0, 0.45)',
          crestDot: 'rgba(240, 238, 228, 0.9)'
        };
      } else {
        return {
          bg: '#F3F0E7',
          strataBase: [255, 252, 245], // #FFFCF5
          strataValley: [230, 233, 221], // #E6E9DD
          edgeHighlight: 'rgba(73, 102, 77, 0.65)',
          edgeSubtle: 'rgba(73, 102, 77, 0.2)',
          ambientShadow: 'rgba(41, 46, 40, 0.1)',
          crestDot: 'rgba(73, 102, 77, 0.85)'
        };
      }
    };

    let phase = 0;

    const render = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      if (!prefersReducedMotion) {
        phase += dt * 0.3 * speed;
      }

      pointerPos.current.x += (pointerPos.current.targetX - pointerPos.current.x) * 0.05;
      pointerPos.current.y += (pointerPos.current.targetY - pointerPos.current.y) * 0.05;

      ctx.clearRect(0, 0, width, height);

      const colors = getColors();
      const pointerNormalizedX = pointerPos.current.x > 0 ? (pointerPos.current.x / width - 0.5) : 0;
      const pointerNormalizedY = pointerPos.current.y > 0 ? (pointerPos.current.y / height - 0.5) : 0;

      // Render ribbons from back to front (horizon to foreground)
      for (let r = 0; r < ribbonCount; r++) {
        const factor = r / (ribbonCount - 1); // 0 (horizon) to 1 (foreground)
        
        // Base baseline Y position
        const startY = height * 0.35 + factor * height * 0.65;
        
        // Amplitude grows towards foreground
        const amp = (18 + factor * 50);
        const freq = 0.003 - factor * 0.0012;
        const phaseOffset = r * 0.45 + phase;

        // Pointer influence
        const mouseShift = Math.sin(pointerNormalizedX * Math.PI) * 22 * factor;

        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, startY);

        const segments = 48;
        const pts = [];
        for (let s = 0; s <= segments; s++) {
          const x = (s / segments) * width;
          
          // Multi-frequency harmonic elevation
          const h1 = Math.sin(x * freq + phaseOffset) * amp;
          const h2 = Math.cos(x * freq * 2.2 - phaseOffset * 0.7) * (amp * 0.35);
          const h3 = Math.sin(x * freq * 4.5 + phaseOffset * 1.2) * (amp * 0.12);
          
          const y = startY + h1 + h2 + h3 + mouseShift;
          pts.push({ x, y });
          ctx.lineTo(x, y);
        }

        ctx.lineTo(width, height);
        ctx.closePath();

        // Interpolated strata color with vertical depth
        const [rB, gB, bB] = colors.strataBase;
        const [rV, gV, bV] = colors.strataValley;
        const mix = factor;
        const red = Math.round(rV + (rB - rV) * mix);
        const green = Math.round(gV + (gB - gV) * mix);
        const blue = Math.round(bV + (bB - bV) * mix);
        const alpha = 0.45 + factor * 0.55;

        const strataGrad = ctx.createLinearGradient(0, startY - amp, 0, startY + amp * 1.5);
        strataGrad.addColorStop(0, `rgba(${red}, ${green}, ${blue}, ${alpha})`);
        strataGrad.addColorStop(1, `rgba(${rV}, ${gV}, ${bV}, ${Math.min(1, alpha + 0.2)})`);

        ctx.fillStyle = strataGrad;
        ctx.fill();

        // Upper rim illumination highlight
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
          else ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.strokeStyle = factor > 0.6 ? colors.edgeHighlight : colors.edgeSubtle;
        ctx.lineWidth = 1.0 + factor * 1.5;
        ctx.stroke();

        // Occasional telemetry crest marker nodes on major foreground ribbons
        if (factor > 0.5 && r % 3 === 0) {
          const crestIndices = [10, 24, 38];
          for (const cIdx of crestIndices) {
            const pt = pts[cIdx];
            if (pt) {
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, 2.5 + factor * 1.5, 0, Math.PI * 2);
              ctx.fillStyle = colors.crestDot;
              ctx.shadowColor = colors.edgeHighlight;
              ctx.shadowBlur = 6;
              ctx.fill();
              ctx.shadowBlur = 0;
            }
          }
        }
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
