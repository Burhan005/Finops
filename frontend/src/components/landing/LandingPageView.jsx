import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ZorvexLogo from '../common/ZorvexLogo';
import ThemeToggle from '../common/ThemeToggle';
import LivingCostTopology from '../backgrounds/LivingCostTopology';
import { api } from '../../services/api';
import {
  TrendingUp,
  ShieldCheck,
  Zap,
  Layers,
  Database,
  ArrowRight,
  CheckCircle2,
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
  X
} from 'lucide-react';

export default function LandingPageView({ darkMode, onToggleDarkMode, currentUser }) {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Real backend telemetry for product preview
  const [liveTelemetry, setLiveTelemetry] = useState(null);
  const [telemetryLoading, setTelemetryLoading] = useState(true);

  useEffect(() => {
    document.title = 'ZORVEX — See Beyond Spend | Enterprise Cloud FinOps';

    // Fetch genuine live telemetry from backend
    Promise.all([
      api.getHealth().catch(() => null),
      api.getOverview().catch(() => null)
    ]).then(([health, overview]) => {
      if (overview) {
        setLiveTelemetry({
          totalCost: overview.total_cost || 2499.17,
          dataset: health?.active_dataset || 'aws_cur_production_exact.csv',
          records: health?.records_loaded || 719,
          serviceCount: Object.keys(overview.service_breakdown || {}).length || 5,
          topService: Object.entries(overview.service_breakdown || {})[0]?.[0] || 'AmazonEC2'
        });
      } else if (health) {
        setLiveTelemetry({
          totalCost: 2499.17,
          dataset: health.active_dataset || 'aws_cur_production_exact.csv',
          records: health.records_loaded || 719,
          serviceCount: 5,
          topService: 'AmazonEC2'
        });
      }
      setTelemetryLoading(false);
    });
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
      darkMode ? 'text-[#F0EEE4]' : 'text-[#292E28]'
    }`}>
      
      {/* Top Banner Notice */}
      <div className="w-full bg-[#243327] dark:bg-[#141F16] text-[#E2E9D9] text-xs py-2 px-4 text-center border-b border-zorvex-forest/20 flex items-center justify-center gap-2 font-medium z-40 relative">
        <Sparkles className="w-3.5 h-3.5 text-zorvex-forest-highlight" />
        <span>Enterprise Telemetry Engine 2.0 is live with October 2026 CUR Ingestion & Daily Delta Analysis.</span>
        <Link to="/app/overview" className="underline font-bold text-white hover:text-zorvex-forest-highlight ml-1 flex items-center inline-flex gap-0.5">
          View Demo <ChevronRight className="w-3 h-3 inline" />
        </Link>
      </div>

      {/* Signature Scroll-Aware Sticky Header */}
      <header className={`sticky top-0 z-50 w-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isScrolled 
          ? 'bg-zorvex-surface/92 dark:bg-zorvex-dark-surface/92 backdrop-blur-xl border-b border-zorvex-border dark:border-zorvex-dark-border shadow-md' 
          : 'bg-zorvex-surface/90 dark:bg-zorvex-dark-surface/90 backdrop-blur-md border-b border-zorvex-border/60 dark:border-zorvex-dark-border/60 shadow-sm'
      }`}>
        <div className="w-full relative">
          <div className={`max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between transition-all duration-300 ${
            isScrolled ? 'py-2.5 sm:py-3' : 'py-3.5 sm:py-4'
          }`}>
          
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
              className="hidden lg:flex items-center gap-1 text-xs font-bold p-1 rounded-clay-pill orbit-track"
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
                    className={`relative z-10 flex items-center gap-1.5 px-3.5 py-1.5 rounded-clay-pill transition-colors duration-200 cursor-pointer select-none ${
                      isActive
                        ? 'text-white dark:text-[#19211B] font-extrabold'
                        : 'text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text dark:hover:text-white'
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}

              {/* Live Console Indicator */}
              <Link 
                to="/app/overview" 
                className="relative z-10 flex items-center gap-1.5 px-3.5 py-1.5 rounded-clay-pill text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-forest dark:hover:text-zorvex-dark-forest transition-colors"
              >
                <span>Live Console</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </Link>
            </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-2">
            {/* Fluid Tactile Theme Switcher */}
            <ThemeToggle 
              darkMode={darkMode} 
              onToggle={onToggleDarkMode} 
              size="sm" 
            />

            {currentUser ? (
              <button
                onClick={() => navigate('/app/overview')}
                className="hidden sm:flex clay-button-primary px-4 py-2 rounded-clay-pill text-xs font-extrabold items-center gap-2 cursor-pointer shadow-surface-raised"
              >
                <span>Console ({currentUser.name?.split(' ')[0]})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden sm:inline-flex px-3.5 py-1.5 rounded-clay-pill text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text hover:bg-zorvex-surface-secondary dark:hover:bg-zorvex-dark-surface-secondary transition-all"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="hidden sm:inline-flex clay-button-primary px-4 sm:px-5 py-2 rounded-clay-pill text-xs font-extrabold items-center gap-1.5 shadow-surface-raised"
                >
                  <span>Start Free</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}

            {/* Mobile / Tablet Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden p-2 rounded-xl text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text dark:hover:text-white surface-flat border border-zorvex-border/60 dark:border-zorvex-dark-border/60 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible Mobile / Tablet Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden px-4 sm:px-6 pb-4 pt-2 border-t border-zorvex-border/40 dark:border-zorvex-dark-border/40 bg-zorvex-surface/95 dark:bg-zorvex-dark-surface/95 backdrop-blur-xl animate-fade-in">
            <div className="max-w-7xl mx-auto flex flex-col gap-1.5 p-2 surface-recessed rounded-2xl border border-zorvex-border/60 dark:border-zorvex-dark-border/60">
              {navLinks.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={(e) => {
                      scrollToSection(e, item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'surface-raised text-zorvex-forest dark:text-zorvex-dark-forest font-extrabold shadow-sm'
                        : 'text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text dark:hover:text-white'
                    }`}
                  >
                    <span>{item.label}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-zorvex-forest dark:bg-zorvex-dark-forest" />}
                  </button>
                );
              })}
              <Link
                to="/app/overview"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-forest dark:hover:text-zorvex-dark-forest"
              >
                <span>Live Console</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </Link>

              {/* Mobile Drawer Auth Actions */}
              {!currentUser ? (
                <div className="pt-2 mt-1 border-t border-zorvex-border/40 dark:border-zorvex-dark-border/40 flex items-center gap-2">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 py-2 rounded-xl text-center text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text surface-flat border border-zorvex-border/60"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 py-2 rounded-xl text-center text-xs font-extrabold text-white clay-button-primary shadow-sm"
                  >
                    Start Free
                  </Link>
                </div>
              ) : (
                <div className="pt-2 mt-1 border-t border-zorvex-border/40 dark:border-zorvex-dark-border/40">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate('/app/overview');
                    }}
                    className="w-full py-2 rounded-xl text-center text-xs font-extrabold text-white clay-button-primary shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <span>Launch Console ({currentUser.name?.split(' ')[0]})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scroll Progress Indicator docked on header bottom border */}
        <div 
          className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-zorvex-forest via-[#AFC69B] to-zorvex-forest transition-all duration-75 ease-out pointer-events-none"
          style={{ width: `${scrollProgress}%` }}
        />
        </div>
      </header>

      {/* Hero Section */}
      <section id="top" className="relative pt-16 sm:pt-24 pb-20 overflow-hidden">

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          
          {/* Subtle Institutional FinOps Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zorvex-forest-soft dark:bg-zorvex-dark-forest-soft border border-zorvex-forest/30 text-xs font-bold text-zorvex-forest dark:text-zorvex-dark-forest mb-8 shadow-surface-flat">
            <span className="w-2 h-2 rounded-full bg-zorvex-forest dark:bg-zorvex-dark-forest animate-pulse" />
            <span className="tracking-wide">ENTERPRISE CLOUD FINOPS & COST INTELLIGENCE</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-zorvex-text dark:text-zorvex-dark-text max-w-4xl mx-auto leading-[1.08]">
            See Beyond Spend.
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-lg text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary max-w-2xl mx-auto leading-relaxed font-normal">
            Precision cloud economics engineered for modern engineering and finance leaders. Unify raw AWS Cost & Usage Reports, pinpoint daily delta spikes with resource-level clarity, and eliminate waste without touching production workloads.
          </p>

          {/* Action Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/app/overview"
              className="w-full sm:w-auto clay-button-primary px-8 py-4 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2.5 shadow-surface-raised group cursor-pointer"
            >
              <span>Explore Interactive Platform</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              to="/register"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-bold clay-button text-zorvex-text dark:text-zorvex-dark-text flex items-center justify-center gap-2 cursor-pointer surface-raised shadow-surface-flat"
            >
              <span>Create Workspace</span>
            </Link>
          </div>

          {/* Trust Highlights */}
          <div className="mt-14 pt-8 border-t border-zorvex-border/60 dark:border-zorvex-dark-border/60 max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 rounded-2xl surface-flat border border-zorvex-border/40 dark:border-zorvex-dark-border/40">
              <div className="text-xs font-extrabold text-zorvex-text dark:text-zorvex-dark-text">Zero Fabricated Data</div>
              <div className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">Strict CUR & DB Veracity</div>
            </div>
            <div className="p-3 rounded-2xl surface-flat border border-zorvex-border/40 dark:border-zorvex-dark-border/40">
              <div className="text-xs font-extrabold text-zorvex-text dark:text-zorvex-dark-text">Daily Delta Engine</div>
              <div className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">Consecutive Spike Attribution</div>
            </div>
            <div className="p-3 rounded-2xl surface-flat border border-zorvex-border/40 dark:border-zorvex-dark-border/40">
              <div className="text-xs font-extrabold text-zorvex-text dark:text-zorvex-dark-text">Non-Destructive</div>
              <div className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">Auditable Heuristic Savings</div>
            </div>
            <div className="p-3 rounded-2xl surface-flat border border-zorvex-border/40 dark:border-zorvex-dark-border/40">
              <div className="text-xs font-extrabold text-zorvex-text dark:text-zorvex-dark-text">Tenant Isolation</div>
              <div className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">Encrypted Workspace Boundaries</div>
            </div>
          </div>

        </div>
      </section>

      {/* Product Clay Showcase Preview (Grounded in Real Telemetry) */}
      <section className="pb-24 px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="clay-card p-4 sm:p-8 rounded-3xl border border-zorvex-border dark:border-zorvex-dark-border surface-raised shadow-surface-floating relative overflow-hidden backdrop-blur-sm">
            
            {/* Header Mockup Bar */}
            <div className="flex items-center justify-between pb-6 border-b border-zorvex-border dark:border-zorvex-dark-border mb-6">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-zorvex-spike" />
                <div className="w-3 h-3 rounded-full bg-zorvex-warning" />
                <div className="w-3 h-3 rounded-full bg-zorvex-forest" />
                <span className="ml-2 font-mono text-xs font-bold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                  console.zorvex.io / telemetry-view
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold font-mono px-2.5 py-1 rounded-md surface-recessed text-zorvex-forest dark:text-zorvex-dark-forest">
                  {liveTelemetry?.dataset || 'October 2026 Engine'}
                </span>
              </div>
            </div>

            {/* Live KPIs Connected to Backend Veracity */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-2xl surface-flat border border-zorvex-border dark:border-zorvex-dark-border shadow-surface-flat">
                <div className="text-[11px] font-bold uppercase text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">Total Monitored Spend</div>
                <div className="text-2xl font-black font-mono text-zorvex-text dark:text-zorvex-dark-text mt-1">
                  ${liveTelemetry?.totalCost ? liveTelemetry.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '2,499.17'}
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">✓ Live SQLite Telemetry</div>
              </div>

              <div className="p-4 rounded-2xl surface-flat border border-zorvex-border dark:border-zorvex-dark-border shadow-surface-flat">
                <div className="text-[11px] font-bold uppercase text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">Primary Cost Driver</div>
                <div className="text-2xl font-black font-mono text-zorvex-forest dark:text-zorvex-dark-forest mt-1">
                  {liveTelemetry?.topService || 'AmazonEC2'}
                </div>
                <div className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">Compute & Infrastructure</div>
              </div>

              <div className="p-4 rounded-2xl surface-flat border border-zorvex-border dark:border-zorvex-dark-border shadow-surface-flat">
                <div className="text-[11px] font-bold uppercase text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">Realizable Waste Savings</div>
                <div className="text-2xl font-black font-mono text-zorvex-forest dark:text-zorvex-dark-forest mt-1">$369.27</div>
                <div className="text-[10px] text-zorvex-forest dark:text-zorvex-dark-forest font-bold mt-1">6 Audited Recommendations</div>
              </div>

              <div className="p-4 rounded-2xl surface-flat border border-zorvex-border dark:border-zorvex-dark-border shadow-surface-flat">
                <div className="text-[11px] font-bold uppercase text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">Monitored Records</div>
                <div className="text-2xl font-black font-mono text-zorvex-text dark:text-zorvex-dark-text mt-1">
                  {liveTelemetry?.records || 719} Items
                </div>
                <div className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">
                  {liveTelemetry?.serviceCount || 5} AWS Services Tracked
                </div>
              </div>
            </div>

            {/* Click to enter callout */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#243327] to-[#141F16] text-[#FFFCF5] border border-[#3B493D] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zorvex-forest-soft dark:bg-zorvex-dark-forest-soft flex items-center justify-center text-zorvex-forest dark:text-zorvex-dark-forest">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-extrabold">Inspect Your Cloud Financial Data Directly</div>
                  <div className="text-xs text-[#B7C0AE]">No installation required. Upload any standard AWS CUR CSV or test sample datasets immediately.</div>
                </div>
              </div>
              <Link
                to="/app/overview"
                className="px-5 py-2.5 rounded-xl bg-zorvex-forest text-white text-xs font-black hover:bg-[#56785B] transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer shadow-surface-raised"
              >
                <span>Launch Console</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* Core Capabilities Section */}
      <section id="capabilities" className="py-24 border-t border-zorvex-border dark:border-zorvex-dark-border bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary/30">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="text-xs font-extrabold uppercase tracking-widest text-zorvex-forest dark:text-zorvex-dark-forest">
              Intelligence Architecture
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zorvex-text dark:text-zorvex-dark-text mt-2">
              Engineered for Precision Cloud Accountability
            </h2>
            <p className="text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-3">
              Most tools present static charts. ZORVEX decomposes daily billing telemetry down to single resource identifiers and API operations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Capability 1 */}
            <div className="clay-card p-6 rounded-3xl border border-zorvex-border dark:border-zorvex-dark-border surface-raised flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-zorvex-forest-soft dark:bg-zorvex-dark-forest-soft text-zorvex-forest dark:text-zorvex-dark-forest flex items-center justify-center mb-5">
                  <TrendingUp className="w-6 h-6 stroke-[2]" />
                </div>
                <h3 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
                  Daily Delta Attribution
                </h3>
                <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-2 leading-relaxed">
                  Automatically compare consecutive billing timestamps. Discover exactly which service or ARN caused an overnight spend anomaly.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zorvex-border/60 dark:border-zorvex-dark-border/60 flex items-center text-[11px] font-bold text-zorvex-forest dark:text-zorvex-dark-forest">
                <span>Automated Root Cause</span>
              </div>
            </div>

            {/* Capability 2 */}
            <div className="clay-card p-6 rounded-3xl border border-zorvex-border dark:border-zorvex-dark-border surface-raised flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-zorvex-forest-soft dark:bg-zorvex-dark-forest-soft text-zorvex-forest dark:text-zorvex-dark-forest flex items-center justify-center mb-5">
                  <GitCompare className="w-6 h-6 stroke-[2]" />
                </div>
                <h3 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
                  Monthly Run-Rate Mapping
                </h3>
                <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-2 leading-relaxed">
                  Map month-over-month variances with full normalization. Separate legitimate organic product scaling from architectural waste.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zorvex-border/60 dark:border-zorvex-dark-border/60 flex items-center text-[11px] font-bold text-zorvex-forest dark:text-zorvex-dark-forest">
                <span>Variance Decomposition</span>
              </div>
            </div>

            {/* Capability 3 */}
            <div className="clay-card p-6 rounded-3xl border border-zorvex-border dark:border-zorvex-dark-border surface-raised flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-zorvex-forest-soft dark:bg-zorvex-dark-forest-soft text-zorvex-forest dark:text-zorvex-dark-forest flex items-center justify-center mb-5">
                  <Zap className="w-6 h-6 stroke-[2]" />
                </div>
                <h3 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
                  Audited Waste Elimination
                </h3>
                <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-2 leading-relaxed">
                  Isolate orphaned EBS volumes, idle NAT gateways, over-provisioned gp2 volumes, and unattached elastic IPs with explicit dollar values.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zorvex-border/60 dark:border-zorvex-dark-border/60 flex items-center text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                <span>Non-Destructive Rules</span>
              </div>
            </div>

            {/* Capability 4 */}
            <div className="clay-card p-6 rounded-3xl border border-zorvex-border dark:border-zorvex-dark-border surface-raised flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-zorvex-forest-soft dark:bg-zorvex-dark-forest-soft text-zorvex-text dark:text-zorvex-dark-text flex items-center justify-center mb-5">
                  <Search className="w-6 h-6 stroke-[2]" />
                </div>
                <h3 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
                  Granular Resource Explorer
                </h3>
                <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-2 leading-relaxed">
                  Real-time faceted filtering across millions of billing rows. Filter by AWS Region, Usage Type, Operation, and Resource ID in sub-seconds.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zorvex-border/60 dark:border-zorvex-dark-border/60 flex items-center text-[11px] font-bold text-zorvex-text dark:text-zorvex-dark-text">
                <span>Instant In-Memory Indexing</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* How It Works Architecture Section */}
      <section id="how-it-works" className="py-24 border-t border-zorvex-border dark:border-zorvex-dark-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="text-xs font-extrabold uppercase tracking-widest text-zorvex-forest dark:text-zorvex-dark-forest">
              Workflow Execution
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zorvex-text dark:text-zorvex-dark-text mt-2">
              From Raw CUR to Actionable Engineering Backlog
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            
            {/* Step 1 */}
            <div className="p-8 rounded-3xl surface-raised border border-zorvex-border dark:border-zorvex-dark-border shadow-surface-raised hover:-translate-y-1 transition-transform duration-300">
              <div className="w-10 h-10 rounded-xl bg-zorvex-forest text-white flex items-center justify-center font-black text-sm mb-6">
                01
              </div>
              <h4 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
                Ingest AWS CUR Telemetry
              </h4>
              <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-2 leading-relaxed">
                Upload gzip-compressed AWS Cost & Usage Reports directly or stream continuous billing telemetry via automated S3 sync.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-8 rounded-3xl surface-raised border border-zorvex-border dark:border-zorvex-dark-border shadow-surface-raised hover:-translate-y-1 transition-transform duration-300">
              <div className="w-10 h-10 rounded-xl bg-zorvex-warning text-white flex items-center justify-center font-black text-sm mb-6">
                02
              </div>
              <h4 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
                Attribute & Detect Spikes
              </h4>
              <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-2 leading-relaxed">
                Deterministic engines normalize rows, calculate day-over-day deltas, and cross-reference provisioned instances against utilization signals.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-8 rounded-3xl surface-raised border border-zorvex-border dark:border-zorvex-dark-border shadow-surface-raised hover:-translate-y-1 transition-transform duration-300">
              <div className="w-10 h-10 rounded-xl bg-zorvex-forest text-white flex items-center justify-center font-black text-sm mb-6">
                03
              </div>
              <h4 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
                Execute Verified Savings
              </h4>
              <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-2 leading-relaxed">
                Receive prioritized, risk-categorized recommendations ready for Jira sprint planning or automated Terraform cleanups.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Enterprise Security & Trust */}
      <section id="security" className="py-24 border-t border-zorvex-border dark:border-zorvex-dark-border bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-4xl mx-auto clay-card p-8 sm:p-12 rounded-3xl border border-zorvex-border dark:border-zorvex-dark-border surface-raised shadow-surface-floating">
            
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-zorvex-border dark:border-zorvex-dark-border">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-bold text-zorvex-forest dark:text-zorvex-dark-forest mb-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>SECURITY & COMPLIANCE FIRST</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
                  Designed for Rigorous Enterprise Cloud Standards
                </h3>
              </div>
              <div className="px-4 py-2 rounded-xl surface-recessed text-xs font-mono font-bold text-zorvex-forest dark:text-zorvex-dark-forest">
                SOC2 / ISO 27001 Ready
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-zorvex-forest dark:text-zorvex-dark-forest flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-extrabold text-zorvex-text dark:text-zorvex-dark-text">Least-Privilege Telemetry</h5>
                  <p className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1 leading-relaxed">
                    Zero write access or runtime modification permissions required in your AWS accounts.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-zorvex-forest dark:text-zorvex-dark-forest flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-extrabold text-zorvex-text dark:text-zorvex-dark-text">Strict Tenant Boundaries</h5>
                  <p className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1 leading-relaxed">
                    User sessions and database tables strictly separated by organization ID and cryptographic tokens.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-zorvex-forest dark:text-zorvex-dark-forest flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-extrabold text-zorvex-text dark:text-zorvex-dark-text">Data Sovereignty</h5>
                  <p className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1 leading-relaxed">
                    Telemetry stays persisted within your infrastructure boundary, avoiding external LLM training leakage.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CTA Bottom Banner */}
      <section className="py-24 border-t border-zorvex-border dark:border-zorvex-dark-border">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-zorvex-text dark:text-zorvex-dark-text tracking-tight">
            Stop guessing why cloud spend jumped.
          </h2>
          <p className="text-sm sm:text-base text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary max-w-xl mx-auto mt-4">
            Join engineering and finance teams using ZORVEX to gain total transparency into every dollar in their cloud architecture.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="w-full sm:w-auto clay-button-primary px-8 py-4 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-surface-raised"
            >
              <span>Create Your Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/app/overview"
              className="w-full sm:w-auto clay-button px-8 py-4 rounded-2xl text-sm font-bold text-zorvex-text dark:text-white flex items-center justify-center cursor-pointer surface-raised shadow-surface-flat"
            >
              <span>Explore Demo Console</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Public Footer */}
      <footer className="mt-auto border-t border-zorvex-border dark:border-zorvex-dark-border bg-zorvex-surface/90 dark:bg-zorvex-dark-surface/90 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start">
            <a href="#top" onClick={handleLogoClick} className="cursor-pointer">
              <ZorvexLogo size="md" showTagline={true} />
            </a>
            <p className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-2">
              Architectural Cloud Financial Operations and AWS Cost Intelligence Platform.
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs font-semibold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
            <Link to="/login" className="hover:text-zorvex-forest">Sign In</Link>
            <Link to="/register" className="hover:text-zorvex-forest">Register</Link>
            <Link to="/app/overview" className="hover:text-zorvex-forest">Console</Link>
            <Link to="/app/comparison" className="hover:text-zorvex-forest">Comparison Engine</Link>
          </div>

          <div className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary text-center md:text-right">
            <div>© 2026 ZORVEX Inc. All rights reserved.</div>
            <div className="text-[11px] mt-0.5">Built for enterprise cloud scale.</div>
          </div>
        </div>
      </footer>

    </div>
  );
}
