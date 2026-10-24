import React, { useEffect, useRef } from 'react';
import { Cpu, Database, Network, ShieldCheck, Layers, Activity } from 'lucide-react';

/**
 * LivingCostTopology (Definitive Master Synthesis — 5-Layer Hybrid FinOps Topology)
 * 
 * An institutional, world-class fusion of all 4 modern concepts + core FinOps anchor:
 * - Layer 1: 3D Isometric Architectural CAD Grid with precision benchmark crosshairs (+)
 * - Layer 2: Aurora Iridescent Streams (AWS Warm Amber, Azure Electric Blue, GCP Emerald Green)
 * - Layer 3: Topographic Vector Wave Matrix (Undulating harmonic Perlin splines)
 * - Layer 4: Stepped Isometric Contours & Focal Apex Nexus (Golden institutional anchor)
 * - Layer 5: Illuminated Telemetry Data Bus Tracks with high-speed pulse gliders
 * - Layer 6: Balanced Tri-Cloud Celestial Beacons with center typography clearance
 * 
 * Hardware-accelerated High-DPI Canvas, 60 FPS delta-time physics, pointer perspective parallax,
 * respecting prefers-reduced-motion, with full Obsidian (#0B0C10) and Alabaster (#F5F7FA) parity.
 */
const CLOUD_CONCEPTS = [
  {
    id: 'compute',
    label: 'COMPUTE',
    Icon: Cpu,
    color: 'text-sky-400',
    dotColor: '#38BDF8',
    borderColor: 'border-sky-500/30',
    bgGlow: 'rgba(56, 189, 248, 0.20)'
  },
  {
    id: 'database',
    label: 'DATABASE',
    Icon: Database,
    color: 'text-emerald-400',
    dotColor: '#34D399',
    borderColor: 'border-emerald-500/30',
    bgGlow: 'rgba(52, 211, 153, 0.20)'
  },
  {
    id: 'network',
    label: 'NETWORK',
    Icon: Network,
    color: 'text-indigo-400',
    dotColor: '#818CF8',
    borderColor: 'border-indigo-500/30',
    bgGlow: 'rgba(129, 140, 248, 0.20)'
  },
  {
    id: 'security',
    label: 'SECURITY',
    Icon: ShieldCheck,
    color: 'text-amber-400',
    dotColor: '#FBBF24',
    borderColor: 'border-amber-500/30',
    bgGlow: 'rgba(251, 191, 36, 0.20)'
  },
  {
    id: 'clusters',
    label: 'CLUSTERS',
    Icon: Layers,
    color: 'text-teal-400',
    dotColor: '#2DD4BF',
    borderColor: 'border-teal-500/30',
    bgGlow: 'rgba(45, 212, 191, 0.20)'
  },
  {
    id: 'telemetry',
    label: 'TELEMETRY',
    Icon: Activity,
    color: 'text-rose-400',
    dotColor: '#F472B6',
    borderColor: 'border-rose-500/30',
    bgGlow: 'rgba(244, 114, 182, 0.20)'
  }
];

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
  const iconDomRefs = useRef([]);

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
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = canvas.parentElement ? canvas.parentElement.clientWidth : window.innerWidth;
      height = canvas.parentElement ? canvas.parentElement.clientHeight : window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
      initEntities();
    };

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

    // Scaled counts: Golden constellation density (Lively, high-tech, balanced)
    const starCount = density === 'low' ? 42 : density === 'high' ? 78 : 64;

    // Entities state
    let ambientStars = [];
    let busPackets = [];

    const initEntities = () => {
      ambientStars = [];
      for (let i = 0; i < starCount; i++) {
        ambientStars.push({
          x: Math.random() * (width || 1400),
          y: Math.random() * (height || 900),
          vx: (Math.random() - 0.5) * 13 * speed,
          vy: (Math.random() - 0.5) * 13 * speed,
          radius: 1.4 + Math.random() * 1.6,
          baseAlpha: 0.50 + Math.random() * 0.45,
          pulseSpeed: 0.8 + Math.random() * 1.6,
          pulseOffset: Math.random() * Math.PI * 2,
          cloud: i % 3 === 0 ? 'azure' : i % 3 === 1 ? 'gcp' : 'aws'
        });
      }

      busPackets = [
        { yRatio: 0.28, colorDark: '#00B0FF', colorLight: '#0284C7', speed: 125, offset: 0 },
        { yRatio: 0.28, colorDark: '#00B0FF', colorLight: '#0284C7', speed: 125, offset: 0.5 },
        { yRatio: 0.46, colorDark: '#FF9900', colorLight: '#F59E0B', speed: -110, offset: 0 },
        { yRatio: 0.46, colorDark: '#FF9900', colorLight: '#F59E0B', speed: -110, offset: 0.52 },
        { yRatio: 0.64, colorDark: '#00E676', colorLight: '#10B981', speed: 145, offset: 0 },
        { yRatio: 0.64, colorDark: '#00E676', colorLight: '#10B981', speed: 145, offset: 0.48 },
        { yRatio: 0.80, colorDark: '#EC7211', colorLight: '#D97706', speed: -95, offset: 0 },
        { yRatio: 0.80, colorDark: '#EC7211', colorLight: '#D97706', speed: -95, offset: 0.54 }
      ];
    };

    resize();
    window.addEventListener('resize', resize);

    let phase = 0;

    const render = (timestamp) => {
      if (typeof document !== 'undefined' && document.hidden) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const elapsed = timestamp - lastTimeRef.current;
      if (elapsed < 16) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }
      const dt = Math.min(elapsed / 1000, 0.1);
      lastTimeRef.current = timestamp;

      if (!width || !height || width <= 10 || height <= 10 || !Number.isFinite(width) || !Number.isFinite(height)) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      if (!prefersReducedMotion) {
        phase += dt * 0.75 * speed;
      }

      // Smooth pointer lerp
      pointerPos.current.x += (pointerPos.current.targetX - pointerPos.current.x) * 0.08;
      pointerPos.current.y += (pointerPos.current.targetY - pointerPos.current.y) * 0.08;

      ctx.clearRect(0, 0, width, height);

      const centerX = width * 0.5;
      const centerY = height * 0.44;

      const tiltX = (width > 0 && pointerPos.current.x > 0) ? ((pointerPos.current.x - centerX) / width) * 22 : 0;
      const tiltY = (height > 0 && pointerPos.current.y > 0) ? ((pointerPos.current.y - centerY) / height) * 22 : 0;
      const safeTiltX = Number.isFinite(tiltX) ? tiltX : 0;
      const safeTiltY = Number.isFinite(tiltY) ? tiltY : 0;

      // =========================================================================
      // 1. LAYER 1: 3D Isometric Architectural CAD Grid (Concept 3)
      // =========================================================================
      const gridSize = 52;
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = darkMode ? 'rgba(255, 255, 255, 0.035)' : 'rgba(100, 116, 139, 0.055)';

      for (let d = -width; d < width * 2; d += gridSize) {
        ctx.beginPath();
        ctx.moveTo(d, 0);
        ctx.lineTo(d + height * 0.6, height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(d, 0);
        ctx.lineTo(d - height * 0.6, height);
        ctx.stroke();
      }

      // Benchmark crosshairs (+) at major intersections
      const crossStep = gridSize * 3;
      ctx.lineWidth = 1;
      ctx.strokeStyle = darkMode ? 'rgba(255, 255, 255, 0.10)' : 'rgba(100, 116, 139, 0.14)';
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
      // 2. LAYER 2: Aurora Iridescent Streams (Concept 1)
      // =========================================================================
      const ribbonCount = 4;
      for (let i = 0; i < ribbonCount; i++) {
        const factor = i / ribbonCount;
        const startY = height * 0.42 + factor * height * 0.45;
        const amp = 35 + factor * 48;
        const freq = 0.0020 + factor * 0.0006;
        const wavePhase = phase * 0.7 + i * 0.8;

        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, startY);

        const segments = 45;
        for (let s = 0; s <= segments; s++) {
          const x = (s / segments) * width;
          const h = Math.sin(x * freq + wavePhase) * amp + Math.cos(x * freq * 1.9 - wavePhase * 0.5) * (amp * 0.35);

          ctx.lineTo(x, startY + h);
        }
        ctx.lineTo(width, height);
        ctx.closePath();

        const ribbonGrad = ctx.createLinearGradient(0, startY - amp, width, startY + amp * 1.8);
        const alpha = 0.030 + factor * 0.035; // Rich visible depth without eye strain
        if (darkMode) {
          // Celestial Ethereal Atmosphere: Deep Azure, Calm Mint, Subtle Indigo (Zero Lava)
          ribbonGrad.addColorStop(0, `rgba(14, 165, 233, ${alpha * 0.85})`);   // Celestial Azure
          ribbonGrad.addColorStop(0.48, `rgba(16, 185, 129, ${alpha * 0.70})`); // Serene Mint
          ribbonGrad.addColorStop(0.82, `rgba(99, 102, 241, ${alpha * 0.55})`); // Calming Indigo
          ribbonGrad.addColorStop(1, 'rgba(14, 15, 18, 0)');
        } else {
          // Luminous Pearlescent Tri-Cloud (Warm Amber, Sky Azure, Mint Emerald)
          ribbonGrad.addColorStop(0, `rgba(245, 158, 11, ${alpha * 0.55})`);
          ribbonGrad.addColorStop(0.45, `rgba(14, 165, 233, ${alpha * 0.45})`);
          ribbonGrad.addColorStop(0.80, `rgba(16, 185, 129, ${alpha * 0.45})`);
          ribbonGrad.addColorStop(1, 'rgba(244, 246, 249, 0)');
        }

        ctx.fillStyle = ribbonGrad;
        ctx.fill();

        ctx.lineWidth = 0.85 + factor * 0.4;
        ctx.strokeStyle = darkMode 
          ? `rgba(255, 255, 255, ${0.05 + factor * 0.06})` 
          : `rgba(148, 163, 184, ${0.10 + factor * 0.10})`;
        ctx.stroke();
      }

      // =========================================================================
      // 3. LAYER 3: Topographic Vector Wave Matrix (Concept 2)
      // =========================================================================
      const topoLines = 12;
      const topoStartY = height * 0.58;
      const topoEndY = height * 0.95;
      const stepY = (topoEndY - topoStartY) / topoLines;

      for (let i = 0; i < topoLines; i++) {
        const factor = i / topoLines;
        const curY = topoStartY + i * stepY;
        const waveAmp = 16 + factor * 24;
        const freq = 0.0032;
        const pOffset = factor * 1.6 + phase * 0.85;

        ctx.beginPath();
        const segments = 45;
        for (let s = 0; s <= segments; s++) {
          const x = (s / segments) * width;
          const h = Math.sin(x * freq + pOffset) * waveAmp;
          const y = curY + h;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        const alpha = 0.025 + factor * 0.045; // Subtle, restful elevation lines
        ctx.strokeStyle = i % 3 === 0 
          ? (darkMode ? `rgba(14, 165, 233, ${alpha})` : `rgba(2, 132, 199, ${alpha * 0.70})`)
          : (i % 3 === 1 
              ? (darkMode ? `rgba(16, 185, 129, ${alpha})` : `rgba(16, 185, 129, ${alpha * 0.65})`) 
              : (darkMode ? `rgba(236, 114, 17, ${alpha * 0.60})` : `rgba(217, 119, 6, ${alpha * 0.65})`));
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // =========================================================================
      // 4. LAYER 4: Stepped Isometric Contours & Focal Apex Nexus (Existing Core)
      // =========================================================================
      const baseRadiusX = width * 0.40;
      const baseRadiusY = height * 0.30;
      const contourCount = 6;

      for (let i = contourCount; i >= 1; i--) {
        const factor = i / contourCount;
        const rx = baseRadiusX * factor;
        const ry = baseRadiusY * factor;
        const elevation = (1 - factor) * 85;

        const offX = centerX + safeTiltX * (1 - factor);
        const offY = centerY - elevation + safeTiltY * (1 - factor);

        ctx.beginPath();
        const steps = 48;
        for (let s = 0; s <= steps; s++) {
          const theta = (s / steps) * Math.PI * 2;
          const harmonic = Math.sin(theta * 3 + phase + i * 0.25) * 0.05;
          const px = offX + Math.cos(theta) * rx * (1 + harmonic);
          const py = offY + Math.sin(theta) * ry * (1 + harmonic);
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = darkMode 
          ? (i % 2 === 0 ? 'rgba(20, 22, 28, 0.40)' : 'rgba(14, 16, 22, 0.55)') 
          : (i % 2 === 0 ? 'rgba(255, 255, 255, 0.18)' : 'rgba(241, 245, 249, 0.10)');
        ctx.fill();

        ctx.strokeStyle = darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(148, 163, 184, 0.18)';
        ctx.lineWidth = darkMode ? 0.9 : 0.75;
        ctx.stroke();
      }

      // The Apex Nexus Star (Golden FinOps Center Anchor)
      const apexX = centerX + safeTiltX * 1.1;
      const apexY = centerY - 105 + safeTiltY * 1.1;

      if (Number.isFinite(apexX) && Number.isFinite(apexY)) {
        const apexGlow = ctx.createRadialGradient(apexX, apexY, 2, apexX, apexY, 55);
        if (darkMode) {
          apexGlow.addColorStop(0, 'rgba(236, 114, 17, 0.14)');
          apexGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
          // Warm luminous golden halo without murky brown tones
          apexGlow.addColorStop(0, 'rgba(245, 158, 11, 0.18)');
          apexGlow.addColorStop(0.55, 'rgba(251, 191, 36, 0.06)');
          apexGlow.addColorStop(1, 'rgba(244, 246, 249, 0)');
        }
        ctx.beginPath();
        ctx.arc(apexX, apexY, 55, 0, Math.PI * 2);
        ctx.fillStyle = apexGlow;
        ctx.fill();

        // Concentric sonar orbit ring around apex
        ctx.beginPath();
        ctx.arc(apexX, apexY, 15 + Math.sin(phase * 2) * 2, 0, Math.PI * 2);
        ctx.strokeStyle = darkMode ? 'rgba(236, 114, 17, 0.35)' : 'rgba(245, 158, 11, 0.30)';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Apex Star Core
        ctx.beginPath();
        ctx.arc(apexX, apexY, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = darkMode ? '#EC7211' : '#F59E0B';
        ctx.shadowColor = darkMode ? '#EC7211' : '#F59E0B';
        ctx.shadowBlur = darkMode ? 12 : 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Specular White Micro-Core for jewel-like finish
        ctx.beginPath();
        ctx.arc(apexX, apexY, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      }

      // Precision Telemetry Constellation Nodes (Razor-sharp, Zero Emojis, Institutional Finish)
      const contourOrbitNodes = [
        { ring: 1, angle: 1.20, color: '#38BDF8', speed: 0.28 },
        { ring: 2, angle: 3.45, color: '#34D399', speed: -0.24 },
        { ring: 3, angle: 0.65, color: '#818CF8', speed: 0.22 },
        { ring: 3, angle: 4.80, color: '#FBBF24', speed: -0.20 },
        { ring: 4, angle: 2.10, color: '#2DD4BF', speed: 0.18 },
        { ring: 5, angle: 3.90, color: '#38BDF8', speed: -0.16 },
        { ring: 5, angle: 0.85, color: '#34D399', speed: 0.15 }
      ];

      for (const cNode of contourOrbitNodes) {
        const factor = cNode.ring / contourCount;
        const rx = baseRadiusX * factor;
        const ry = baseRadiusY * factor;
        const elevation = (1 - factor) * 85;

        const offX = centerX + safeTiltX * (1 - factor);
        const offY = centerY - elevation + safeTiltY * (1 - factor);

        const theta = (phase * cNode.speed + cNode.angle) % (Math.PI * 2);
        const harmonic = Math.sin(theta * 3 + phase + cNode.ring * 0.25) * 0.05;
        const nx = Math.round(offX + Math.cos(theta) * rx * (1 + harmonic));
        const ny = Math.round(offY + Math.sin(theta) * ry * (1 + harmonic));

        if (Number.isFinite(nx) && Number.isFinite(ny)) {
          const nodeColor = darkMode ? cNode.color : '#0F172A';

          // Razor-sharp pinpoint telemetry node
          ctx.beginPath();
          ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = nodeColor;
          ctx.shadowColor = nodeColor;
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;

          // Crisp specular white jewel micro-core
          ctx.beginPath();
          ctx.arc(nx, ny, 1.0, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();

          // Delicate outer sonar orbit ring
          ctx.beginPath();
          ctx.arc(nx, ny, 6, 0, Math.PI * 2);
          ctx.strokeStyle = nodeColor;
          ctx.lineWidth = 0.6;
          ctx.globalAlpha = darkMode ? 0.35 : 0.20;
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        }
      }

      // =========================================================================
      // 5. LAYER 5: Telemetry Data Bus Tracks & Pulse Gliders (Concept 3)
      // =========================================================================
      for (const bus of busPackets) {
        const busY = height * bus.yRatio;
        const busColor = darkMode ? bus.colorDark : bus.colorLight;

        ctx.beginPath();
        ctx.moveTo(0, busY);
        ctx.lineTo(width, busY);
        ctx.strokeStyle = busColor;
        ctx.lineWidth = 0.75;
        ctx.globalAlpha = darkMode ? 0.16 : 0.10;
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        if (!prefersReducedMotion) {
          const trackWidth = width + 240;
          const offsetDist = (bus.offset || 0) * trackWidth;
          const rawX = ((phase * bus.speed * speed + offsetDist) % trackWidth) - 120;
          const normX = rawX < -120 ? trackWidth + rawX : rawX;

          ctx.beginPath();
          ctx.arc(normX, busY, 3.2, 0, Math.PI * 2);
          ctx.fillStyle = busColor;
          ctx.shadowColor = busColor;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.beginPath();
          ctx.moveTo(normX, busY);
          ctx.lineTo(normX - Math.sign(bus.speed) * 38, busY);
          ctx.strokeStyle = busColor;
          ctx.lineWidth = 1.6;
          ctx.globalAlpha = darkMode ? 0.45 : 0.30;
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        }
      }

      // =========================================================================
      // 6. LAYER 6: Tri-Cloud Celestial Beacons & Organic Filaments (Refined)
      // =========================================================================
      if (!prefersReducedMotion) {
        for (const s of ambientStars) {
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          if (s.x < 0) s.x = width;
          else if (s.x > width) s.x = 0;
          if (s.y < 0) s.y = height;
          else if (s.y > height) s.y = 0;
        }
      }

      // Delicate Distance Filaments between close stars
      const maxDistSq = 100 * 100;
      for (let i = 0; i < ambientStars.length; i++) {
        const s1 = ambientStars[i];



        for (let j = i + 1; j < ambientStars.length; j++) {
          const s2 = ambientStars[j];
          const dx = s1.x - s2.x;
          const dy = s1.y - s2.y;
          const dSq = dx * dx + dy * dy;
          if (dSq < maxDistSq) {
            const dist = Math.sqrt(dSq);
            const lineAlpha = (1 - dist / 100) * (darkMode ? 0.20 : 0.12);
            ctx.beginPath();
            ctx.moveTo(s1.x, s1.y);
            ctx.lineTo(s2.x, s2.y);
            ctx.strokeStyle = s1.cloud === 'azure' 
              ? (darkMode ? `rgba(0, 176, 255, ${lineAlpha})` : `rgba(14, 165, 233, ${lineAlpha})`)
              : (s1.cloud === 'gcp' 
                  ? (darkMode ? `rgba(0, 230, 118, ${lineAlpha})` : `rgba(16, 185, 129, ${lineAlpha})`) 
                  : (darkMode ? `rgba(255, 180, 50, ${lineAlpha})` : `rgba(245, 158, 11, ${lineAlpha})`));
            ctx.lineWidth = darkMode ? 0.65 : 0.50;
            ctx.stroke();
          }
        }
      }

      // Draw Beacons with Center Headline Typography Clearance
      for (const s of ambientStars) {
        // Distance from center & Typography clearance box
        const dxText = Math.abs(s.x - centerX);
        const dyText = Math.abs(s.y - centerY);
        let typoMask = 1.0;
        if (dxText < 430 && dyText < 220) {
          const factor = Math.max(dxText / 430, dyText / 220);
          // In light mode: ensure headline typography stays 100% pristine and unblemished by dots
          typoMask = darkMode ? Math.max(0.35, factor) : Math.max(0.08, factor * factor);
        }

        const pulse = Math.sin(phase * s.pulseSpeed + s.pulseOffset);
        const r = s.radius * (1 + pulse * 0.16);
        const alpha = Math.max(0.30, Math.min(0.95, s.baseAlpha * (1 + pulse * 0.22))) * typoMask;

        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        if (s.cloud === 'azure') {
          ctx.fillStyle = darkMode ? `rgba(0, 176, 255, ${alpha})` : `rgba(2, 132, 199, ${alpha * 0.88})`;
        } else if (s.cloud === 'gcp') {
          ctx.fillStyle = darkMode ? `rgba(0, 230, 118, ${alpha})` : `rgba(16, 185, 129, ${alpha * 0.88})`;
        } else {
          ctx.fillStyle = darkMode ? `rgba(255, 153, 0, ${alpha})` : `rgba(245, 158, 11, ${alpha * 0.88})`;
        }
        ctx.fill();

        // Soft specular halo for beacon dots
        if (s.radius > 1.8 && typoMask > 0.30) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, r * (darkMode ? 1.9 : 1.7), 0, Math.PI * 2);
          const haloA = alpha * (darkMode ? 0.22 : 0.16);
          ctx.fillStyle = s.cloud === 'azure'
            ? (darkMode ? `rgba(0, 176, 255, ${haloA})` : `rgba(14, 165, 233, ${haloA})`)
            : (s.cloud === 'gcp' 
                ? (darkMode ? `rgba(0, 230, 118, ${haloA})` : `rgba(16, 185, 129, ${haloA})`) 
                : (darkMode ? `rgba(255, 153, 0, ${haloA})` : `rgba(245, 158, 11, ${haloA})`));
          ctx.fill();
        }
      }

      // Continuous 3D Elliptical Orbit for Universal Cloud Concept Tokens (Auto-adapts to Mobile & Desktop)
      const isMobile = width < 640;
      const orbitRx = isMobile ? Math.min(width * 0.36, 135) : width * 0.38;
      const orbitRy = isMobile ? Math.min(height * 0.18, 85) : height * 0.22;
      const baseSpeed = 0.14 * speed;

      // Draw subtle gossamer constellation mesh connecting the nodes
      ctx.beginPath();
      CLOUD_CONCEPTS.forEach((_, i) => {
        const baseAngle = (i / CLOUD_CONCEPTS.length) * Math.PI * 2;
        const currentAngle = (phase * baseSpeed + baseAngle) % (Math.PI * 2);
        const px = centerX + Math.cos(currentAngle) * orbitRx;
        const py = centerY + Math.sin(currentAngle) * orbitRy;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.strokeStyle = darkMode ? 'rgba(56, 189, 248, 0.08)' : 'rgba(14, 165, 233, 0.08)';
      ctx.lineWidth = 0.75;
      ctx.stroke();

      // Position DOM tokens with hardware-accelerated translate3d and 3D depth scale
      CLOUD_CONCEPTS.forEach((concept, i) => {
        const domEl = iconDomRefs.current[i];
        if (!domEl) return;

        const baseAngle = (i / CLOUD_CONCEPTS.length) * Math.PI * 2;
        const currentAngle = (phase * baseSpeed + baseAngle) % (Math.PI * 2);

        const posX = centerX + Math.cos(currentAngle) * orbitRx - 24; // center of 48px
        const posY = centerY + Math.sin(currentAngle) * orbitRy - 24;

        // 3D Depth scaling & opacity: front is larger/clearer, back is subtle/softer
        const depth = (Math.sin(currentAngle) + 1) / 2; // 0 (far back) to 1 (near front)
        const baseScale = isMobile ? 0.68 : 0.80;
        const scaleRange = isMobile ? 0.22 : 0.32;
        const scale = baseScale + depth * scaleRange;
        const opacity = 0.45 + depth * 0.55; // 0.45 to 1.00
        const zIndex = Math.round(depth * 30);

        domEl.style.transform = `translate3d(${posX.toFixed(1)}px, ${posY.toFixed(1)}px, 0) scale(${scale.toFixed(2)})`;
        domEl.style.opacity = opacity.toFixed(2);
        domEl.style.zIndex = zIndex;
      });

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

      {/* 3D Orbiting Universal Cloud Concept Tokens (Native SVG Icons — 0% Blur, Zero Emojis) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {CLOUD_CONCEPTS.map((concept, i) => {
          const IconComp = concept.Icon;
          return (
            <div
              key={concept.id}
              ref={(el) => {
                iconDomRefs.current[i] = el;
              }}
              className="absolute top-0 left-0 pointer-events-none will-change-transform flex flex-col items-center"
              style={{ transform: 'translate3d(-1000px, -1000px, 0)' }}
            >
              {/* Circular Clay Glass Token */}
              <div 
                className={`w-12 h-12 rounded-full surface-raised border ${concept.borderColor} flex items-center justify-center relative shadow-surface-raised transition-all`}
                style={{
                  background: darkMode ? 'rgba(18, 20, 26, 0.82)' : 'rgba(255, 255, 255, 0.90)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: `0 8px 24px -4px ${concept.bgGlow}`
                }}
              >
                {/* Active Micro-Beacon Orbit Dot */}
                <span 
                  className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full border border-black/40 shadow-sm"
                  style={{ 
                    backgroundColor: concept.dotColor,
                    boxShadow: `0 0 8px ${concept.dotColor}`
                  }}
                />
                
                {/* Crisp 100% Vector Lucide Icon */}
                <IconComp className={`w-5 h-5 ${concept.color} stroke-[1.85]`} />
              </div>

              {/* High-Tech Monospace Tag */}
              <span className="mt-1 text-[9px] font-mono font-extrabold tracking-wider px-2 py-0.5 rounded-clay-pill surface-recessed text-zorvex-text-secondary dark:text-white/80 select-none border border-zorvex-border/40 dark:border-white/10 shadow-sm">
                {concept.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
