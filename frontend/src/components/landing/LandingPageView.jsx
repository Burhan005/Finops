import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ZorvexLogo from '../common/ZorvexLogo';
import ThemeToggle from '../common/ThemeToggle';
import {
  TrendingUp,
  ShieldCheck,
  Zap,
  Layers,
  Database,
  ArrowRight,
  CheckCircle2,
  Check,
  Lock,
  Search,
  Sparkles,
  GitCompare,
  BarChart3,
  Sun,
  Moon,
  ChevronRight,
  Server,
  Activity,
  Sliders,
  Menu,
  X,
  Clock,
  Coins,
  AlertTriangle,
  Cpu
} from 'lucide-react';

export default function LandingPageView({ darkMode, onToggleDarkMode, currentUser }) {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Interactive Product Showcase State (100% Curated Static Benchmarks - ZERO live backend queries)
  const [simulationMode, setSimulationMode] = useState('optimized'); // 'unoptimized' | 'optimized'
  const [activeShowcaseTab, setActiveShowcaseTab] = useState('overview'); // 'overview' | 'anomalies' | 'commitments'

  const scenarioData = {
    optimized: {
      totalCost: 2499.17,
      waste: 369.27,
      wasteSubtitle: '6 Audited Recommendations Applied',
      topService: 'AmazonEC2',
      records: 719,
      statusLabel: '✓ Auto-Remediated • Non-Destructive',
      statusClass: 'text-emerald-600 dark:text-emerald-400',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    },
    unoptimized: {
      totalCost: 4120.80,
      waste: 1621.63,
      wasteSubtitle: '8 Unpruned Waste Items Detected',
      topService: 'AmazonEC2 (Over-provisioned)',
      records: 719,
      statusLabel: '⚠️ 39.3% Capital Inefficiency',
      statusClass: 'text-amber-600 dark:text-amber-400',
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    }
  };

  const currentScenario = scenarioData[simulationMode];

  useEffect(() => {
    document.title = 'ZORVEX — See Beyond Spend | Enterprise Cloud FinOps';
  }, []);

  // =========================================================================
  // ORBIT-INSPIRED NAVIGATION INDICATOR & HYSTERESIS SCROLL STATE
  // =========================================================================
  const landingNavRef = useRef(null);
  const landingItemRefs = useRef({});
  const [orbitStyle, setOrbitStyle] = useState({ left: 0, width: 0, opacity: 0 });

  const updateOrbit = useCallback(() => {
    const container = landingNavRef.current;
    if (!container) return;

    const activeEl = landingItemRefs.current[activeSection];
    if (!activeEl) {
      setOrbitStyle((prev) => ({ ...prev, opacity: 0 }));
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const itemRect = activeEl.getBoundingClientRect();

    const left = Math.round(itemRect.left - containerRect.left + container.scrollLeft);
    const width = Math.round(itemRect.width);

    setOrbitStyle((prev) => {
      if (
        Math.abs(prev.left - left) < 1 &&
        Math.abs(prev.width - width) < 1 &&
        prev.opacity === 1
      ) {
        return prev;
      }
      return { left, width, opacity: 1 };
    });
  }, [activeSection]);

  useLayoutEffect(() => {
    updateOrbit();
  }, [updateOrbit, isScrolled]);

  useEffect(() => {
    window.addEventListener('resize', updateOrbit);
    return () => window.removeEventListener('resize', updateOrbit);
  }, [updateOrbit]);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;

          // Hysteresis boundary check to prevent toggling flicker
          setIsScrolled((prev) => {
            if (!prev && scrollY > 28) return true;
            if (prev && scrollY < 12) return false;
            return prev;
          });

          // Scroll progress
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          const progress = docHeight > 0 ? (scrollY / docHeight) * 100 : 0;
          setScrollProgress(Math.min(100, Math.max(0, progress)));

          // Detect active section
          const sections = ['security', 'how-it-works', 'capabilities'];
          for (const id of sections) {
            const el = document.getElementById(id);
            if (el) {
              const rect = el.getBoundingClientRect();
              if (rect.top <= 260) {
                setActiveSection(id);
                ticking = false;
                return;
              }
            }
          }
          setActiveSection('hero');
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogoClick = (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      const offsetTop = el.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: offsetTop, behavior: 'smooth' });
    }
  };

  const navLinks = [
    { id: 'capabilities', label: 'Capabilities' },
    { id: 'how-it-works', label: 'Architecture' },
    { id: 'security', label: 'Enterprise Trust' }
  ];

  return (
    <div className={`min-h-screen transition-colors duration-300 flex flex-col font-sans selection:bg-zorvex-forest-soft selection:text-zorvex-forest bg-transparent ${
      darkMode ? 'text-[#F8FAFC]' : 'text-[#0F172A]'
    }`}>
      
      {/* Signature Scroll-Aware Sticky Header */}
      <header className={`sticky top-0 z-50 w-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isScrolled 
          ? 'bg-white/95 dark:bg-[#0E0F12]/95 backdrop-blur-xl border-b border-zorvex-border/80 dark:border-white/[0.08] shadow-md py-2.5 sm:py-3' 
          : 'bg-white/80 dark:bg-[#0E0F12]/80 backdrop-blur-md border-b border-zorvex-border/40 dark:border-white/[0.04] shadow-sm py-3.5 sm:py-4'
      }`}>
        <div className="w-full relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          
            {/* Brand Logo */}
            <a 
              href="#top" 
              onClick={handleLogoClick}
              className="flex items-center gap-2.5 cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]" 
              title="ZORVEX Home"
            >
              <ZorvexLogo size={isScrolled ? "sm" : "md"} showTagline={!isScrolled} />
            </a>

            {/* Nav Tabs with Recessed Orbit Track */}
            <nav 
              ref={landingNavRef}
              className="hidden lg:flex items-center gap-1 text-xs font-bold p-1 rounded-clay-pill orbit-track surface-recessed"
            >
              {/* Sliding Orbit Capsule with Micro-Beacon */}
              <div 
                className="orbit-capsule"
                style={{
                  transform: `translateX(${orbitStyle.left}px)`,
                  width: `${orbitStyle.width}px`,
                  opacity: orbitStyle.opacity
                }}
                aria-hidden="true"
              >
                <span className="orbit-beacon" />
              </div>

              {navLinks.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    ref={(el) => {
                      if (el) landingItemRefs.current[item.id] = el;
                    }}
                    onClick={(e) => scrollToSection(e, item.id)}
                    className={`relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-clay-pill transition-colors duration-200 cursor-pointer select-none font-bold ${
                      isActive
                        ? 'text-white'
                        : 'text-zorvex-text-secondary hover:text-zorvex-text dark:text-zorvex-dark-text-secondary dark:hover:text-white'
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Right Action Cluster */}
            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle darkMode={darkMode} onToggle={onToggleDarkMode} />

              {currentUser ? (
                <Link
                  to="/app/overview"
                  className="px-5 py-2.5 rounded-clay-pill clay-button-primary text-white text-xs font-extrabold flex items-center gap-1.5 shadow-surface-raised cursor-pointer"
                >
                  <span>Open Console</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="hidden sm:inline-flex px-4 py-2 rounded-clay-pill text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Sign In
                  </Link>

                  <Link
                    to="/register"
                    className="px-5 py-2.5 rounded-clay-pill clay-button-primary text-white text-xs font-extrabold flex items-center gap-1.5 shadow-surface-raised cursor-pointer"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {/* Mobile Menu Trigger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-clay-pill surface-raised text-zorvex-text dark:text-white"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>

          {/* Mobile Navigation Drawer */}
          {mobileMenuOpen && (
            <div className="lg:hidden mt-3 px-4 pb-4 pt-2 border-t border-zorvex-border/40 dark:border-white/[0.04] bg-white/95 dark:bg-[#0E0F12]/95 backdrop-blur-xl">
              <div className="flex flex-col gap-2">
                {navLinks.map((item) => (
                  <button
                    key={item.id}
                    onClick={(e) => {
                      scrollToSection(e, item.id);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold text-zorvex-text dark:text-white hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    {item.label}
                  </button>
                ))}
                {!currentUser && (
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary"
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Scroll Progress Indicator */}
          <div 
            className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-zorvex-forest via-[#FF9900] to-emerald-500 transition-all duration-75 ease-out pointer-events-none"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 1. HERO SECTION: Clean, Authoritative, Genuine Claymorphism                */}
      {/* ========================================================================= */}
      <section id="top" className="relative pt-16 sm:pt-24 pb-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          
          {/* Subtle Institutional FinOps Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-clay-pill surface-raised border border-zorvex-border/60 dark:border-zorvex-dark-border/60 text-xs font-bold text-zorvex-forest dark:text-zorvex-dark-forest mb-8 shadow-surface-flat">
            <span className="w-2 h-2 rounded-full bg-zorvex-forest dark:bg-zorvex-dark-forest animate-pulse" />
            <span className="tracking-wide uppercase text-[11px]">Enterprise Cloud FinOps &amp; Cost Intelligence</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-zorvex-text dark:text-white max-w-4xl mx-auto leading-[1.08]">
            See Beyond Spend.
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-lg text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary max-w-2xl mx-auto leading-relaxed font-normal">
            Precision cloud economics engineered for modern engineering and finance leaders. Unify raw AWS Cost &amp; Usage Reports, pinpoint daily delta spikes with resource-level clarity, and eliminate waste without touching production workloads.
          </p>

          {/* Action Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/app/overview"
              className="w-full sm:w-auto clay-button-primary px-8 py-4 rounded-clay-pill text-sm font-extrabold flex items-center justify-center gap-2.5 shadow-surface-raised group cursor-pointer active:scale-[0.98] transition-all"
            >
              <span>Explore Interactive Platform</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              to="/register"
              className="w-full sm:w-auto px-8 py-4 rounded-clay-pill text-sm font-bold clay-button text-zorvex-text dark:text-zorvex-dark-text flex items-center justify-center gap-2 cursor-pointer surface-raised shadow-surface-flat active:scale-[0.98] transition-all"
            >
              <span>Create Workspace</span>
            </Link>
          </div>

          {/* Trust Highlights */}
          <div className="mt-14 pt-8 border-t border-zorvex-border/60 dark:border-zorvex-dark-border/60 max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 rounded-2xl surface-flat border border-zorvex-border/60 dark:border-zorvex-dark-border/60 shadow-surface-flat hover:-translate-y-0.5 hover:shadow-surface-raised transition-all cursor-default">
              <ShieldCheck className="w-4 h-4 text-emerald-500 mx-auto mb-1.5" />
              <div className="text-xs font-extrabold text-zorvex-text dark:text-white">Zero Fabricated Data</div>
              <div className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">Strict CUR &amp; DB Veracity</div>
            </div>
            <div className="p-4 rounded-2xl surface-flat border border-zorvex-border/60 dark:border-zorvex-dark-border/60 shadow-surface-flat hover:-translate-y-0.5 hover:shadow-surface-raised transition-all cursor-default">
              <TrendingUp className="w-4 h-4 text-zorvex-forest dark:text-zorvex-dark-forest mx-auto mb-1.5" />
              <div className="text-xs font-extrabold text-zorvex-text dark:text-white">Daily Delta Engine</div>
              <div className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">Consecutive Spike Attribution</div>
            </div>
            <div className="p-4 rounded-2xl surface-flat border border-zorvex-border/60 dark:border-zorvex-dark-border/60 shadow-surface-flat hover:-translate-y-0.5 hover:shadow-surface-raised transition-all cursor-default">
              <Lock className="w-4 h-4 text-amber-500 mx-auto mb-1.5" />
              <div className="text-xs font-extrabold text-zorvex-text dark:text-white">Non-Destructive</div>
              <div className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">Auditable Heuristic Savings</div>
            </div>
            <div className="p-4 rounded-2xl surface-flat border border-zorvex-border/60 dark:border-zorvex-dark-border/60 shadow-surface-flat hover:-translate-y-0.5 hover:shadow-surface-raised transition-all cursor-default">
              <Database className="w-4 h-4 text-sky-500 mx-auto mb-1.5" />
              <div className="text-xs font-extrabold text-zorvex-text dark:text-white">Tenant Isolation</div>
              <div className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">Encrypted Workspace Boundaries</div>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. PRODUCT CLAY SHOWCASE PREVIEW (Interactive Static Benchmark Showcase)  */}
      {/* ========================================================================= */}
      <section className="pb-24 px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="clay-card p-6 sm:p-8 rounded-3xl border border-zorvex-border dark:border-zorvex-dark-border surface-raised shadow-surface-floating relative overflow-hidden">
            
            {/* Header Mockup Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-zorvex-border dark:border-zorvex-dark-border mb-6 gap-3">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-xs font-bold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                  console.zorvex.io / telemetry-view
                </span>
                <span className="hidden md:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-clay-pill surface-recessed text-zorvex-forest dark:text-zorvex-dark-forest">
                  FOCUS 1.0 Aligned
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold font-mono px-3 py-1 rounded-clay-pill surface-recessed text-zorvex-forest dark:text-zorvex-dark-forest">
                  aws-production-demo.cur
                </span>
              </div>
            </div>

            {/* Interactive Tactile Simulation Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-2xl surface-recessed border border-zorvex-border/50 dark:border-white/[0.05] mb-6">
              
              {/* Simulation Mode Toggle */}
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                  Simulation:
                </span>
                <div className="inline-flex p-1 rounded-clay-pill surface-flat border border-zorvex-border/40 dark:border-white/[0.06]">
                  <button
                    onClick={() => setSimulationMode('unoptimized')}
                    className={`px-3 py-1 text-xs font-bold rounded-clay-pill transition-all cursor-pointer ${
                      simulationMode === 'unoptimized'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-sm'
                        : 'text-zorvex-text-secondary hover:text-zorvex-text dark:text-zorvex-dark-text-secondary dark:hover:text-white'
                    }`}
                  >
                    Unmanaged Baseline
                  </button>
                  <button
                    onClick={() => setSimulationMode('optimized')}
                    className={`px-3 py-1 text-xs font-bold rounded-clay-pill transition-all flex items-center gap-1.5 cursor-pointer ${
                      simulationMode === 'optimized'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-sm'
                        : 'text-zorvex-text-secondary hover:text-zorvex-text dark:text-zorvex-dark-text-secondary dark:hover:text-white'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Zorvex Autonomous Engine
                  </button>
                </div>
              </div>

              {/* View Selector Tabs */}
              <div className="inline-flex items-center gap-1 p-1 rounded-clay-pill surface-flat border border-zorvex-border/40 dark:border-white/[0.06]">
                {[
                  { id: 'overview', label: 'Cost Overview' },
                  { id: 'anomalies', label: 'Spike Radar' },
                  { id: 'commitments', label: 'Savings Plan ROI' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveShowcaseTab(tab.id)}
                    className={`px-3 py-1 text-xs font-bold rounded-clay-pill transition-all cursor-pointer ${
                      activeShowcaseTab === tab.id
                        ? 'clay-button-primary text-white shadow-sm'
                        : 'text-zorvex-text-secondary hover:text-zorvex-text dark:text-zorvex-dark-text-secondary dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

            </div>

            {/* TAB CONTENT: 1. Cost Overview */}
            {activeShowcaseTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl surface-flat border border-zorvex-border/60 dark:border-zorvex-dark-border/60 shadow-surface-flat">
                    <div className="text-[11px] font-bold uppercase text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">Total Monitored Spend</div>
                    <div className="text-2xl font-black font-mono text-zorvex-text dark:text-white mt-1">
                      ${currentScenario.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={`text-[10px] font-bold mt-1 ${currentScenario.statusClass}`}>
                      {currentScenario.statusLabel}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl surface-flat border border-zorvex-border/60 dark:border-zorvex-dark-border/60 shadow-surface-flat">
                    <div className="text-[11px] font-bold uppercase text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">Primary Cost Driver</div>
                    <div className="text-2xl font-black font-mono text-zorvex-forest dark:text-zorvex-dark-forest mt-1">
                      {currentScenario.topService}
                    </div>
                    <div className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">Compute &amp; Infrastructure</div>
                  </div>

                  <div className="p-4 rounded-2xl surface-flat border border-zorvex-border/60 dark:border-zorvex-dark-border/60 shadow-surface-flat">
                    <div className="text-[11px] font-bold uppercase text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                      {simulationMode === 'optimized' ? 'Realized Waste Savings' : 'Identified Capital Leakage'}
                    </div>
                    <div className="text-2xl font-black font-mono text-zorvex-forest dark:text-zorvex-dark-forest mt-1">
                      ${currentScenario.waste.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={`text-[10px] font-bold mt-1 ${currentScenario.statusClass}`}>
                      {currentScenario.wasteSubtitle}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl surface-flat border border-zorvex-border/60 dark:border-zorvex-dark-border/60 shadow-surface-flat">
                    <div className="text-[11px] font-bold uppercase text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">Monitored Records</div>
                    <div className="text-2xl font-black font-mono text-zorvex-text dark:text-white mt-1">
                      {currentScenario.records} Items
                    </div>
                    <div className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">
                      5 AWS Services Tracked
                    </div>
                  </div>
                </div>

                {/* Tactile Service Distribution Breakdown Bar */}
                <div className="p-4 rounded-2xl surface-recessed border border-zorvex-border/50 dark:border-white/[0.05]">
                  <div className="flex items-center justify-between text-xs font-bold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mb-2">
                    <span>Enterprise Service Cost Breakdown (FOCUS Normalized)</span>
                    <span className="font-mono text-zorvex-forest dark:text-zorvex-dark-forest">100% Attributed</span>
                  </div>
                  <div className="h-3 w-full rounded-full overflow-hidden flex bg-black/10 dark:bg-white/5 p-0.5">
                    <div style={{ width: '54%' }} className="h-full bg-zorvex-forest rounded-l-full" title="AmazonEC2 (54%)" />
                    <div style={{ width: '26%' }} className="h-full bg-[#0284C7]" title="AmazonRDS (26%)" />
                    <div style={{ width: '12%' }} className="h-full bg-emerald-500" title="AmazonS3 (12%)" />
                    <div style={{ width: '8%' }} className="h-full bg-amber-500 rounded-r-full" title="CloudWatch & Other (8%)" />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] font-bold">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-zorvex-forest" /> AmazonEC2 (54%)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#0284C7]" /> AmazonRDS (26%)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> AmazonS3 (12%)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> CloudWatch &amp; VPC (8%)</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 2. Spike Radar / Anomalies */}
            {activeShowcaseTab === 'anomalies' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl surface-flat border border-rose-500/20 shadow-surface-flat">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-clay-pill bg-rose-500/10 text-rose-600 dark:text-rose-400">
                      CRITICAL SPIKE
                    </span>
                    <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">+$240.00 / day</span>
                  </div>
                  <h4 className="text-sm font-extrabold text-zorvex-text dark:text-white mt-2.5">Amazon RDS Storage Auto-scale</h4>
                  <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">
                    Unplanned log runaway on production postgres replica. Detected in 3.2s via Day-over-Day delta engine.
                  </p>
                </div>

                <div className="p-4 rounded-2xl surface-flat border border-amber-500/20 shadow-surface-flat">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-clay-pill bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      IDLE ASSET
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">-$50.00 / mo</span>
                  </div>
                  <h4 className="text-sm font-extrabold text-zorvex-text dark:text-white mt-2.5">Unattached EBS gp2 Volume</h4>
                  <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">
                    500GB volume left detached after Kubernetes cluster scale-down. Flagged for zero-risk snapshot &amp; delete.
                  </p>
                </div>

                <div className="p-4 rounded-2xl surface-flat border border-sky-500/20 shadow-surface-flat">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-clay-pill bg-sky-500/10 text-sky-600 dark:text-sky-400">
                      EGRESS DRIFT
                    </span>
                    <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">+$118.40 / mo</span>
                  </div>
                  <h4 className="text-sm font-extrabold text-zorvex-text dark:text-white mt-2.5">Cross-AZ NAT Gateway Drift</h4>
                  <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">
                    Inter-zone traffic routing imbalance between us-east-1a and us-east-1b attributed to latency routing misconfiguration.
                  </p>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 3. Commitments ROI */}
            {activeShowcaseTab === 'commitments' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl surface-flat border border-emerald-500/20 shadow-surface-flat">
                  <div className="text-[11px] font-bold uppercase text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                    Compute Savings Plans Coverage
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                    84.2%
                  </div>
                  <div className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">
                    Target Enterprise Band (80% - 90%)
                  </div>
                </div>

                <div className="p-4 rounded-2xl surface-flat border border-zorvex-border/60 dark:border-zorvex-dark-border/60 shadow-surface-flat">
                  <div className="text-[11px] font-bold uppercase text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                    Blended Commitment Rate
                  </div>
                  <div className="text-2xl font-black font-mono text-zorvex-forest dark:text-zorvex-dark-forest mt-1">
                    $0.038 / hr
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                    34% Effective Discount vs On-Demand
                  </div>
                </div>

                <div className="p-4 rounded-2xl surface-flat border border-zorvex-border/60 dark:border-zorvex-dark-border/60 shadow-surface-flat">
                  <div className="text-[11px] font-bold uppercase text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                    Breakeven Horizon
                  </div>
                  <div className="text-2xl font-black font-mono text-zorvex-text dark:text-white mt-1">
                    42 Days
                  </div>
                  <div className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">
                    Full Commitment Capital Recovery
                  </div>
                </div>
              </div>
            )}

            {/* Click to enter callout */}
            <div className="mt-6 p-5 rounded-2xl surface-recessed border border-zorvex-border/60 dark:border-zorvex-dark-border/60 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl surface-raised flex items-center justify-center text-zorvex-forest dark:text-zorvex-dark-forest shadow-surface-flat flex-shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-zorvex-text dark:text-white">Inspect Your Cloud Financial Data Directly</div>
                  <div className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">No installation required. Upload any standard AWS CUR CSV or test sample datasets immediately.</div>
                </div>
              </div>
              <Link
                to="/app/overview"
                className="px-6 py-3 rounded-clay-pill clay-button-primary text-white text-xs font-extrabold hover:brightness-105 active:scale-[0.98] transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer shadow-surface-raised"
              >
                <span>Launch Console</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. CORE CAPABILITIES SECTION                                              */}
      {/* ========================================================================= */}
      <section id="capabilities" className="py-24 border-t border-zorvex-border dark:border-zorvex-dark-border bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary/30">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold font-mono tracking-wider text-zorvex-forest dark:text-zorvex-dark-forest uppercase">
              Deterministic Architecture
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-zorvex-text dark:text-white mt-2 tracking-tight">
              Three Pillars of High-Velocity FinOps
            </h2>
            <p className="text-sm sm:text-base text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-3">
              Engineered from the ground up for cloud reliability engineers, platform architects, and engineering leadership.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Pillar 1 */}
            <div className="clay-card p-8 rounded-3xl border border-zorvex-border dark:border-zorvex-dark-border surface-raised shadow-surface-raised hover:-translate-y-1.5 hover:shadow-surface-floating transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl surface-recessed flex items-center justify-center text-zorvex-forest dark:text-zorvex-dark-forest shadow-surface-recessed mb-6">
                  <Database className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-mono font-bold text-zorvex-forest dark:text-zorvex-dark-forest">01 // INGESTION &amp; NORMALIZATION</span>
                <h3 className="text-xl font-extrabold text-zorvex-text dark:text-white mt-2">
                  Deterministic FOCUS 1.0 &amp; CUR Pipeline
                </h3>
                <p className="text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-3 leading-relaxed">
                  ZORVEX consumes millions of billing records with sub-second in-memory indexing. Converts disparate AWS CUR 2.0, Azure Cost Export, and GCP BigQuery billing into the unified FinOps FOCUS standard with zero data dropping.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zorvex-border/40 dark:border-zorvex-dark-border/40 text-xs font-bold text-zorvex-text dark:text-white flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Zero Database Desynchronization</span>
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="clay-card p-8 rounded-3xl border border-zorvex-border dark:border-zorvex-dark-border surface-raised shadow-surface-raised hover:-translate-y-1.5 hover:shadow-surface-floating transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl surface-recessed flex items-center justify-center text-[#0284C7] shadow-surface-recessed mb-6">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-mono font-bold text-[#0284C7]">02 // VARIANCE &amp; ANOMALY RADAR</span>
                <h3 className="text-xl font-extrabold text-zorvex-text dark:text-white mt-2">
                  Sub-Hour Delta Surge Attribution
                </h3>
                <p className="text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-3 leading-relaxed">
                  Pinpoint overnight billing surprises directly down to specific Kubernetes deployments, PR releases, and engineer tags. Correlates Day-over-Day spending deltas without noisy false-positives.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zorvex-border/40 dark:border-zorvex-dark-border/40 text-xs font-bold text-zorvex-text dark:text-white flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Line-Item Root Cause Tracing</span>
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="clay-card p-8 rounded-3xl border border-zorvex-border dark:border-zorvex-dark-border surface-raised shadow-surface-raised hover:-translate-y-1.5 hover:shadow-surface-floating transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl surface-recessed flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-surface-recessed mb-6">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">03 // 100% READ-ONLY PRIVILEGE</span>
                <h3 className="text-xl font-extrabold text-zorvex-text dark:text-white mt-2">
                  Non-Destructive Zero-Agent Security
                </h3>
                <p className="text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-3 leading-relaxed">
                  Never install invasive daemons on production EC2 or Kubernetes clusters. Strict read-only AWS Cross-Account Role with STS External ID verification guarantees zero runtime interference.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zorvex-border/40 dark:border-zorvex-dark-border/40 text-xs font-bold text-zorvex-text dark:text-white flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Audited Non-Destructive Ingestion</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. ARCHITECTURE / HOW IT WORKS SECTION (Connected Pipeline)              */}
      {/* ========================================================================= */}
      <section id="how-it-works" className="py-24 border-t border-zorvex-border dark:border-zorvex-dark-border">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold font-mono tracking-wider text-zorvex-forest dark:text-zorvex-dark-forest uppercase">
              Engineered Simplicity
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-zorvex-text dark:text-white mt-2 tracking-tight">
              From Raw Invoices to Boardroom Clarity in Seconds
            </h2>
          </div>

          <div className="relative">
            {/* Desktop Horizontal Connecting Track */}
            <div className="hidden md:block absolute top-1/2 left-[12%] right-[12%] -translate-y-8 h-[2px] pointer-events-none z-0">
              <svg className="w-full h-4 overflow-visible" preserveAspectRatio="none">
                <line 
                  x1="0" y1="2" x2="100%" y2="2" 
                  stroke="currentColor" 
                  className="text-zorvex-border dark:text-zorvex-dark-border opacity-50" 
                  strokeWidth="2"
                />
                <line 
                  x1="0" y1="2" x2="100%" y2="2" 
                  stroke="#FF9900" 
                  className="pipeline-stream-line opacity-90" 
                  strokeWidth="2.5" 
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
              <div className="clay-card p-8 rounded-3xl border border-zorvex-border dark:border-zorvex-dark-border surface-raised shadow-surface-raised hover:-translate-y-1.5 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl surface-recessed flex items-center justify-center text-zorvex-forest dark:text-zorvex-dark-forest shadow-surface-recessed">
                    <Database className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-black font-mono px-3 py-1 rounded-clay-pill surface-recessed text-zorvex-forest dark:text-zorvex-dark-forest">
                    01 // INGEST
                  </span>
                </div>
                <h4 className="text-lg font-extrabold text-zorvex-text dark:text-white mt-3">Upload or Sync Cost Exports</h4>
                <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-2 leading-relaxed">
                  Connect your AWS S3 bucket for automatic daily CUR delivery or drag-and-drop raw CSV billing exports directly.
                </p>
                <div className="mt-4 pt-3 border-t border-zorvex-border/40 dark:border-zorvex-dark-border/40 text-[11px] font-mono text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                  ✓ AWS CUR 2.0 • FOCUS 1.0 Ready
                </div>
              </div>

              <div className="clay-card p-8 rounded-3xl border border-zorvex-border dark:border-zorvex-dark-border surface-raised shadow-surface-raised hover:-translate-y-1.5 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl surface-recessed flex items-center justify-center text-[#0284C7] shadow-surface-recessed">
                    <Activity className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-black font-mono px-3 py-1 rounded-clay-pill surface-recessed text-[#0284C7]">
                    02 // ANALYZE
                  </span>
                </div>
                <h4 className="text-lg font-extrabold text-zorvex-text dark:text-white mt-3">Deterministic Variance Analysis</h4>
                <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-2 leading-relaxed">
                  Our database engine attributes every penny of Day-over-Day variance to specific AWS services, resource IDs, and usage types.
                </p>
                <div className="mt-4 pt-3 border-t border-zorvex-border/40 dark:border-zorvex-dark-border/40 text-[11px] font-mono text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                  ✓ Day-over-Day Spike Radar
                </div>
              </div>

              <div className="clay-card p-8 rounded-3xl border border-zorvex-border dark:border-zorvex-dark-border surface-raised shadow-surface-raised hover:-translate-y-1.5 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl surface-recessed flex items-center justify-center text-amber-500 shadow-surface-recessed">
                    <Coins className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-black font-mono px-3 py-1 rounded-clay-pill surface-recessed text-amber-500">
                    03 // RECLAIM
                  </span>
                </div>
                <h4 className="text-lg font-extrabold text-zorvex-text dark:text-white mt-3">Reclaim Waste &amp; Model Growth</h4>
                <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-2 leading-relaxed">
                  Review heuristic waste recommendations, export boardroom-ready reports in USD, EUR, or INR, and simulate commitment ROI.
                </p>
                <div className="mt-4 pt-3 border-t border-zorvex-border/40 dark:border-zorvex-dark-border/40 text-[11px] font-mono text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                  ✓ Audited Savings Ledger
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. ENTERPRISE TRUST & SECURITY SECTION                                    */}
      {/* ========================================================================= */}
      <section id="security" className="py-24 border-t border-zorvex-border dark:border-zorvex-dark-border bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary/30">
        <div className="max-w-5xl mx-auto px-6 text-center">
          
          <div className="w-14 h-14 rounded-2xl surface-recessed flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-6 shadow-surface-recessed">
            <Lock className="w-7 h-7" />
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-zorvex-text dark:text-white tracking-tight">
            Enterprise Security &amp; Institutional Trust
          </h2>
          <p className="text-sm sm:text-base text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-4 max-w-2xl mx-auto leading-relaxed">
            ZORVEX is designed for regulated industries. We never request write permissions, execute automated destructive infrastructure changes, or access application database contents.
          </p>

          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div className="p-5 rounded-2xl surface-raised border border-zorvex-border/60 dark:border-zorvex-dark-border/60 shadow-surface-raised hover:-translate-y-1 transition-all">
              <Lock className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
              <h4 className="text-xs font-bold text-zorvex-text dark:text-white">SOC 2 Type II</h4>
              <p className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">Audited security controls</p>
            </div>
            <div className="p-5 rounded-2xl surface-raised border border-zorvex-border/60 dark:border-zorvex-dark-border/60 shadow-surface-raised hover:-translate-y-1 transition-all">
              <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
              <h4 className="text-xs font-bold text-zorvex-text dark:text-white">Zero-Agent IAM</h4>
              <p className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">Read-only STS validation</p>
            </div>
            <div className="p-5 rounded-2xl surface-raised border border-zorvex-border/60 dark:border-zorvex-dark-border/60 shadow-surface-raised hover:-translate-y-1 transition-all">
              <Database className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
              <h4 className="text-xs font-bold text-zorvex-text dark:text-white">Tenant Isolation</h4>
              <p className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">Air-gapped encryption</p>
            </div>
            <div className="p-5 rounded-2xl surface-raised border border-zorvex-border/60 dark:border-zorvex-dark-border/60 shadow-surface-raised hover:-translate-y-1 transition-all">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
              <h4 className="text-xs font-bold text-zorvex-text dark:text-white">FOCUS 1.0</h4>
              <p className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">Open FinOps Foundation</p>
            </div>
          </div>

          <div className="mt-16">
            <Link
              to="/register"
              className="inline-flex px-8 py-4 rounded-clay-pill text-sm font-extrabold items-center gap-2.5 clay-button-primary shadow-surface-raised hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>Begin Your Zero-Agent Cloud Audit</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. ARCHITECTURAL FOOTER (Institutional Governance & Legal Policies)        */}
      {/* ========================================================================= */}
      <footer className="py-16 border-t border-zorvex-border dark:border-zorvex-dark-border bg-zorvex-surface dark:bg-zorvex-dark-surface relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          
          {/* Main Footer Multi-Column Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 pb-12 border-b border-zorvex-border/60 dark:border-zorvex-dark-border/60">
            
            {/* Brand Column */}
            <div className="col-span-2">
              <ZorvexLogo size="md" showTagline={true} />
              <p className="mt-4 text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary max-w-sm leading-relaxed">
                Deterministic cloud cost intelligence and FinOps telemetry platform. Unify raw AWS CUR reports, pinpoint daily delta surges, and automate waste reclamation with zero production interference.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-clay-pill surface-recessed border border-zorvex-border/50 dark:border-white/[0.05]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-mono font-bold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                  Telemetry Engine: 100% Operational
                </span>
              </div>
            </div>

            {/* Platform & Solutions */}
            <div>
              <h5 className="text-xs font-bold font-mono uppercase tracking-wider text-zorvex-forest dark:text-zorvex-dark-forest mb-3">
                Platform
              </h5>
              <ul className="space-y-2 text-xs font-medium text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                <li>
                  <a href="#capabilities" className="hover:text-zorvex-text dark:hover:text-white transition-colors">
                    Core Capabilities
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-zorvex-text dark:hover:text-white transition-colors">
                    Pipeline Architecture
                  </a>
                </li>
                <li>
                  <Link to="/app/overview" className="hover:text-zorvex-text dark:hover:text-white transition-colors">
                    Interactive Console
                  </Link>
                </li>
                <li>
                  <Link to="/app/comparison" className="hover:text-zorvex-text dark:hover:text-white transition-colors">
                    Variance &amp; Delta Explorer
                  </Link>
                </li>
                <li>
                  <Link to="/app/recommendations" className="hover:text-zorvex-text dark:hover:text-white transition-colors">
                    Autonomous Waste Ledger
                  </Link>
                </li>
              </ul>
            </div>

            {/* Trust & Compliance */}
            <div>
              <h5 className="text-xs font-bold font-mono uppercase tracking-wider text-zorvex-forest dark:text-zorvex-dark-forest mb-3">
                Trust &amp; Security
              </h5>
              <ul className="space-y-2 text-xs font-medium text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                <li>
                  <a href="#security" className="hover:text-zorvex-text dark:hover:text-white transition-colors">
                    Security Architecture
                  </a>
                </li>
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>SOC 2 Type II Certified</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Zero-Agent Read-Only</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Air-Gapped Tenant DB</span>
                </li>
              </ul>
            </div>

            {/* Legal & Governance */}
            <div>
              <h5 className="text-xs font-bold font-mono uppercase tracking-wider text-zorvex-forest dark:text-zorvex-dark-forest mb-3">
                Legal &amp; Policy
              </h5>
              <ul className="space-y-2 text-xs font-bold">
                <li>
                  <Link to="/privacy" className="text-zorvex-text-secondary hover:text-zorvex-forest dark:text-zorvex-dark-text-secondary dark:hover:text-zorvex-dark-forest transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-zorvex-text-secondary hover:text-zorvex-forest dark:text-zorvex-dark-text-secondary dark:hover:text-zorvex-dark-forest transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link to="/privacy#cur-data" className="text-zorvex-text-secondary hover:text-zorvex-text dark:text-zorvex-dark-text-secondary dark:hover:text-white transition-colors font-medium">
                    CUR Processing Terms
                  </Link>
                </li>
                <li>
                  <Link to="/privacy#cookies" className="text-zorvex-text-secondary hover:text-zorvex-text dark:text-zorvex-dark-text-secondary dark:hover:text-white transition-colors font-medium">
                    Cookie Policy
                  </Link>
                </li>
              </ul>
            </div>

          </div>

          {/* Bottom Copyright & Legal Links */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
            <div>
              © {new Date().getFullYear()} ZORVEX Inc. All rights reserved. Precision Cloud Economics &amp; FOCUS 1.0 Aligned.
            </div>
            <div className="flex items-center gap-6 font-bold">
              <Link to="/privacy" className="hover:text-zorvex-forest dark:hover:text-zorvex-dark-forest transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-zorvex-forest dark:hover:text-zorvex-dark-forest transition-colors">
                Terms of Service
              </Link>
              <Link to="/register" className="text-zorvex-forest dark:text-zorvex-dark-forest hover:underline">
                Create Workspace
              </Link>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}
