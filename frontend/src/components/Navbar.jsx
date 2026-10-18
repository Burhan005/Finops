import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  GitCompare, 
  Coins, 
  Server, 
  Settings, 
  Upload, 
  Database,
  LogIn,
  UserPlus,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Globe,
  ShieldAlert,
  Layers,
  Bot,
  Cloud,
  Sparkles,
  Edit3
} from 'lucide-react';
import ClayDropdown from './common/ClayDropdown';
import ZorvexLogo from './common/ZorvexLogo';
import ThemeToggle from './common/ThemeToggle';
import { api } from '../services/api';

const NAV_ITEMS = [
  { to: '/app/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/app/services', label: 'Services', icon: Cloud },
  { to: '/app/resources', label: 'Resources', icon: Server },
  { to: '/app/comparison', label: 'Cost Changes', icon: GitCompare },
  { to: '/app/recommendations', label: 'Commitments & Waste', icon: Coins },
  { to: '/app/anomalies', label: 'Anomalies & Budgets', icon: ShieldAlert },
  { to: '/app/ledger', label: 'Savings Ledger', icon: Layers },
  { to: '/app/ai', label: 'Ask ZORVEX', icon: Bot },
  { to: '/app/settings', label: 'Settings', icon: Settings }
];

export default function Navbar({ 
  datasets, 
  activeDataset, 
  onSelectDataset, 
  onRefreshDatasets,
  onOpenUpload,
  darkMode,
  onToggleDarkMode,
  currentUser,
  onLogout
}) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const location = useLocation();

  const userName = currentUser?.name || 'Burhan Kapasi';
  const userEmail = currentUser?.email || 'cloudops@finopsclay.io';
  const userInitials = userName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'BK';

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // Close account dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // =========================================================================
  // EFFECT 1 & 4: SCROLL STATE MACHINE (Floating Clay Dock + Depth Shift)
  // Hysteresis: Enter floating dock at >28px, return to top at <12px
  // =========================================================================
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

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

          // Accurate document scroll progress
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          const progress = docHeight > 0 ? (scrollY / docHeight) * 100 : 0;
          setScrollProgress(Math.min(100, Math.max(0, progress)));
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Clean sample labels dictionary for professional display
  const SAMPLE_LABELS = {
    'aws_cur_production_exact.csv': 'AWS Production Telemetry (Demo)',
    'aws_cur_ultimate_master.csv': 'AWS Multi-Service Master (Demo)',
    'comprehensive_cur_4months.csv': 'AWS 4-Month Historical (Demo)',
    'CUR-Report-Daily-00001.csv.gz': 'AWS Daily CUR — Part 1 (Demo)',
    'CUR-Report-Daily-00002.csv.gz': 'AWS Daily CUR — Part 2 (Demo)',
    'sample_cur_test.csv': 'AWS Baseline Test (Demo)'
  };

  const cleanDisplayName = (raw) => {
    if (!raw) return '';
    return raw.replace(/^cur_org_\d+_[a-f0-9]+_(?:merged_|part\d+_)?/, '');
  };

  // Account Rename Modal State
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameAccountName, setRenameAccountName] = useState('');
  const [renamePropagate, setRenamePropagate] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState('');

  // Dataset Options (Uploads strictly visible only to authenticated users)
  const uploads = currentUser ? (datasets?.uploads || []) : [];
  const uploadedFilenames = new Set(uploads.map((u) => u.filename));
  const samples = (datasets?.samples || []).filter((s) => !uploadedFilenames.has(s.filename));

  const allFiles = [...uploads, ...samples];

  const datasetOptions = allFiles.map((file) => {
    let displayLabel = '';
    const usageAcc = file.usage_account_id || file.payer_account_id;

    // 1. Account Name has absolute top priority
    if (file.account_name && file.account_name.trim()) {
      displayLabel = file.account_name.trim();
    } else if (file.type === 'demo_fixture' || file.type === 'sample') {
      displayLabel = SAMPLE_LABELS[file.filename] || cleanDisplayName(file.filename);
    } else if (usageAcc) {
      displayLabel = `AWS Account ${usageAcc}`;
    } else {
      displayLabel = cleanDisplayName(file.filename).replace(/\.csv(?:\.gz)?$/i, '');
    }

    const billingPeriod = file.billing_period_start ? ` • ${file.billing_period_start.substring(0, 7)}` : '';
    const cleanFn = cleanDisplayName(file.filename).replace(/\.csv(?:\.gz)?$/i, '');
    const accLabel = usageAcc ? `AWS ${usageAcc}` : '';
    const subtext = [accLabel, cleanFn, `${file.size_kb} KB${billingPeriod}`].filter(Boolean).join(' • ');

    return {
      value: file.filename,
      label: displayLabel,
      subtext: subtext,
      account_name: file.account_name || null,
      usage_account_id: usageAcc || null,
      type: file.type || 'upload',
      id: file.id || null
    };
  });

  const activeOption = datasetOptions.find((o) => o.value === activeDataset);
  let activePlaceholder = activeOption ? activeOption.label : '';
  if (!activePlaceholder) {
    const found = datasets?.uploads?.find((u) => u.filename === activeDataset);
    if (found?.account_name && found.account_name.trim()) {
      activePlaceholder = found.account_name.trim();
    } else if (found?.usage_account_id) {
      activePlaceholder = `AWS Account ${found.usage_account_id}`;
    } else if (!currentUser) {
      activePlaceholder = SAMPLE_LABELS[activeDataset] || 'AWS Production Telemetry (Demo)';
    } else {
      activePlaceholder = 'Select CUR Dataset';
    }
  }

  const handleOpenRename = () => {
    const activeObj = datasetOptions.find(o => o.value === activeDataset);
    setRenameAccountName(activeObj?.account_name || '');
    setRenameError('');
    setRenamePropagate(true);
    setRenameModalOpen(true);
  };

  const handleSaveRename = async (e) => {
    if (e) e.preventDefault();
    if (!renameAccountName.trim()) {
      setRenameError('Please enter a friendly account name (e.g. evital-prod)');
      return;
    }
    setRenaming(true);
    setRenameError('');
    try {
      await api.renameDatasetAccount(activeDataset, renameAccountName.trim(), renamePropagate);
      setRenameModalOpen(false);
      if (onRefreshDatasets) {
        onRefreshDatasets();
      }
    } catch (err) {
      setRenameError(err.message || 'Failed to update account alias');
    } finally {
      setRenaming(false);
    }
  };

  // =========================================================================
  // EFFECT 3: ORBIT-INSPIRED ACTIVE NAVIGATION INDICATOR
  // Glides smoothly underneath the active navigation tab across route shifts
  // =========================================================================
  const navContainerRef = useRef(null);
  const itemRefs = useRef({});
  const [orbitStyle, setOrbitStyle] = useState({ left: 0, width: 0, opacity: 0 });

  const updateOrbit = useCallback(() => {
    const container = navContainerRef.current;
    if (!container) return;

    // Find active route item matching location.pathname
    const activeItem = NAV_ITEMS.find((item) => {
      if (item.to === '/app/overview') {
        return location.pathname === '/app' || location.pathname === '/app/' || location.pathname === '/app/overview';
      }
      return location.pathname.startsWith(item.to);
    });

    if (!activeItem) {
      setOrbitStyle((prev) => (prev.opacity === 0 ? prev : { ...prev, opacity: 0 }));
      return;
    }

    const activeEl = itemRefs.current[activeItem.to];
    if (!activeEl) return;

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
  }, [location.pathname]);

  // Recalculate orbit position on route change and scroll state toggle
  useLayoutEffect(() => {
    updateOrbit();
  }, [updateOrbit, isScrolled]);

  useEffect(() => {
    window.addEventListener('resize', updateOrbit);
    const container = navContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateOrbit, { passive: true });
    }
    return () => {
      window.removeEventListener('resize', updateOrbit);
      if (container) {
        container.removeEventListener('scroll', updateOrbit);
      }
    };
  }, [updateOrbit]);

  return (
    <header 
      className={`sticky top-0 z-50 w-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isScrolled 
          ? 'bg-zorvex-surface/92 dark:bg-zorvex-dark-surface/92 backdrop-blur-xl border-b border-zorvex-border dark:border-zorvex-dark-border shadow-md' 
          : 'bg-zorvex-surface/95 dark:bg-zorvex-dark-surface/95 backdrop-blur-md border-b border-zorvex-border/70 dark:border-zorvex-dark-border/70 shadow-sm'
      }`}
    >
      {/* ========================================================================= */}
      {/* DOCK CONTAINER: Edge-to-edge flush header with embedded progress bar     */}
      {/* ========================================================================= */}
      <div className="w-full relative">
        {/* Scroll Progress Indicator Line (Docked to bottom border) */}
        <div 
          className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-zorvex-forest via-[#5B7A60] to-zorvex-forest transition-all duration-75 ease-out opacity-90 z-20 pointer-events-none"
          style={{ width: `${scrollProgress}%` }}
        />
        
        {/* ========================================================================= */}
        {/* TIER 1: BRAND IDENTITY & ACTION CONTROLS                                  */}
        {/* Morphs padding and brand density based on scroll state                     */}
        {/* ========================================================================= */}
        <div className={`transition-all duration-300 px-4 sm:px-6 ${isScrolled ? 'py-1.5 sm:py-2' : 'py-2.5'}`}>
          <div className="max-w-7xl xl:max-w-[1400px] 2xl:max-w-[1600px] mx-auto flex items-center justify-between gap-3">
            
            {/* Brand Logo & Live Telemetry Emblem */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <NavLink 
                to="/" 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex items-center flex-shrink-0 cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]" 
                title="Go to ZORVEX Landing Page"
              >
                <ZorvexLogo 
                  size="sm" 
                  showWordmark={true} 
                  showTagline={!isScrolled} 
                />
              </NavLink>

              {/* Live Telemetry Pill (Visible on lg+) */}
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zorvex-forest-soft dark:bg-zorvex-dark-forest-soft border border-zorvex-forest/20 text-zorvex-forest dark:text-zorvex-dark-forest text-[10px] font-black uppercase tracking-wider select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-zorvex-forest dark:bg-zorvex-dark-forest animate-pulse" />
                <span>Live Engine</span>
              </div>
            </div>

            {/* Right Action Utilities Bar */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
              
              {/* Dataset Dropdown (Desktop & Laptop) */}
              <div className="hidden md:flex items-center gap-1.5">
                <ClayDropdown
                  options={datasetOptions}
                  value={activeDataset}
                  onChange={onSelectDataset}
                  placeholder={activePlaceholder}
                  searchable={datasetOptions.length > 4}
                  icon={Database}
                  width={isScrolled ? "w-44 lg:w-56" : "w-52 lg:w-64"}
                />
                {currentUser && activeOption && activeOption.type === 'upload' && (
                  <button
                    type="button"
                    onClick={handleOpenRename}
                    className="p-2 rounded-clay-pill clay-button text-zorvex-text-secondary hover:text-zorvex-forest dark:hover:text-zorvex-dark-forest transition-colors cursor-pointer flex-shrink-0"
                    title={`Rename Account Alias (${activeOption.usage_account_id ? 'AWS ' + activeOption.usage_account_id : 'Dataset'})`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Tactile Light / Dark Mode Toggle */}
              <ThemeToggle 
                darkMode={darkMode} 
                onToggle={onToggleDarkMode} 
                size="sm" 
              />

              {/* User Account / Auth Dropdown */}
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 rounded-clay-pill clay-button text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text transition-all hover:border-zorvex-forest/50 flex-shrink-0 cursor-pointer ${
                    isScrolled ? 'py-1 sm:py-1.5' : 'py-1.5 sm:py-2'
                  }`}
                  title="User Account & Auth"
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-zorvex-forest to-[#5B7A60] text-zorvex-surface flex items-center justify-center text-[10px] font-extrabold shadow-sm flex-shrink-0">
                    {userInitials}
                  </div>
                  <span className="hidden xl:inline text-xs font-extrabold whitespace-nowrap">{userName}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl surface-floating z-50 p-2 animate-fade-in border border-zorvex-border dark:border-zorvex-dark-border">
                    <div className="px-3 py-2 border-b border-zorvex-border dark:border-zorvex-dark-border mb-1">
                      <p className="text-xs font-extrabold text-zorvex-text dark:text-zorvex-dark-text truncate">{userName}</p>
                      <p className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary truncate">{userEmail}</p>
                    </div>

                    <NavLink
                      to="/"
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text hover:bg-zorvex-surface-secondary dark:hover:bg-zorvex-dark-surface-secondary transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-dark-forest" />
                      <span>Public Landing Page</span>
                    </NavLink>

                    <NavLink
                      to="/login"
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text hover:bg-zorvex-surface-secondary dark:hover:bg-zorvex-dark-surface-secondary transition-colors"
                    >
                      <LogIn className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-dark-forest" />
                      <span>Sign In</span>
                    </NavLink>

                    <NavLink
                      to="/register"
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text hover:bg-zorvex-surface-secondary dark:hover:bg-zorvex-dark-surface-secondary transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-dark-forest" />
                      <span>Create Workspace</span>
                    </NavLink>

                    <div className="border-t border-zorvex-border dark:border-zorvex-dark-border my-1 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          if (onLogout) onLogout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-zorvex-spike hover:bg-zorvex-spike-soft dark:hover:bg-red-950/30 transition-colors text-left cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload CTA Button (Visible on sm+) */}
              <div className="hidden sm:block">
                <button
                  type="button"
                  onClick={onOpenUpload}
                  className={`flex items-center gap-1.5 px-3.5 clay-button-primary text-xs font-extrabold tracking-wide flex-shrink-0 cursor-pointer ${
                    isScrolled ? 'py-1.5' : 'py-2'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5 stroke-[2.2]" />
                  <span className="whitespace-nowrap">Upload CUR</span>
                </button>
              </div>

              {/* Mobile / Tablet Hamburger Toggle Button (Hidden on md+) */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-xl clay-button text-zorvex-text dark:text-zorvex-dark-text hover:text-zorvex-forest transition-all flex items-center justify-center cursor-pointer flex-shrink-0"
                aria-label="Toggle Navigation Menu"
              >
                {mobileMenuOpen ? (
                  <X className="w-4 h-4 text-zorvex-spike" />
                ) : (
                  <Menu className="w-4 h-4 text-zorvex-text dark:text-zorvex-dark-text" />
                )}
              </button>

            </div>

          </div>
        </div>

        {/* ========================================================================= */}
        {/* TIER 2: COMMAND NAVIGATION STRIP (Houses Orbit Gliding Capsule)           */}
        {/* ========================================================================= */}
        <div 
          className={`hidden md:block border-t border-zorvex-border/60 dark:border-zorvex-dark-border/60 px-4 sm:px-6 transition-all duration-300 ${
            isScrolled 
              ? 'py-1 bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary/30' 
              : 'py-1.5 bg-zorvex-surface-secondary/70 dark:bg-zorvex-dark-surface-secondary/50'
          }`}
        >
          <div className="max-w-7xl xl:max-w-[1400px] 2xl:max-w-[1600px] mx-auto flex items-center justify-between">
            
            {/* Orbit Navigation Track */}
            <div className="relative w-full overflow-x-auto scrollbar-none py-0.5">
              <nav 
                ref={navContainerRef}
                className="orbit-track flex items-center gap-1 p-1 w-max min-w-full"
                aria-label="Module Navigation"
              >
                {/* Smoothly Gliding Orbit Capsule with Pulsing Satellite Beacon */}
                <div 
                  className="orbit-capsule"
                  style={{
                    transform: `translateX(${orbitStyle.left}px)`,
                    width: `${orbitStyle.width}px`,
                    opacity: orbitStyle.opacity
                  }}
                  aria-hidden="true"
                >
                  {/* Orbital Micro-Satellite Beacon Dot */}
                  <span className="orbit-beacon" />
                </div>

                {/* Navigation Links */}
                {NAV_ITEMS.map((item) => {
                  const isActive = item.to === '/app/overview'
                    ? location.pathname === '/app' || location.pathname === '/app/' || location.pathname === '/app/overview'
                    : location.pathname.startsWith(item.to);

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      ref={(el) => {
                        if (el) itemRefs.current[item.to] = el;
                      }}
                      className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-clay-pill text-xs whitespace-nowrap flex-shrink-0 select-none transition-colors duration-200 cursor-pointer ${
                        isActive
                          ? 'font-extrabold text-white dark:text-[#19211B]'
                          : 'font-bold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text dark:hover:text-zorvex-dark-text hover:bg-zorvex-surface-recessed/40 dark:hover:bg-zorvex-dark-surface-recessed/40'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>

          </div>
        </div>

        {/* ========================================================================= */}
        {/* MOBILE & TABLET SLIDE-DOWN DRAWER                                         */}
        {/* ========================================================================= */}
        {mobileMenuOpen && (
          <div className="md:hidden px-4 pb-4 pt-2 border-t border-zorvex-border dark:border-zorvex-dark-border bg-zorvex-surface dark:bg-zorvex-dark-surface animate-fade-in space-y-3">
            
            {/* Mobile Navigation Links */}
            <nav className="grid grid-cols-1 gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = item.to === '/app/overview'
                  ? location.pathname === '/app' || location.pathname === '/app/' || location.pathname === '/app/overview'
                  : location.pathname.startsWith(item.to);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'clay-pill-active text-white font-extrabold shadow-sm'
                        : 'text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text dark:hover:text-zorvex-dark-text hover:bg-zorvex-surface-secondary dark:hover:bg-zorvex-dark-surface-secondary'
                    }`}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="ml-auto flex items-center gap-1.5 text-[10px] text-white/90">
                        <Sparkles className="w-3 h-3" />
                        Active
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* Mobile Dataset Selector & Upload button */}
            <div className="pt-2 border-t border-zorvex-border dark:border-zorvex-dark-border space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <ClayDropdown
                    options={datasetOptions}
                    value={activeDataset}
                    onChange={onSelectDataset}
                    placeholder={activePlaceholder}
                    searchable={datasetOptions.length > 4}
                    icon={Database}
                    width="w-full"
                  />
                </div>
                {currentUser && activeOption && activeOption.type === 'upload' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleOpenRename();
                    }}
                    className="p-2.5 rounded-xl clay-button text-zorvex-text-secondary hover:text-zorvex-forest flex-shrink-0 cursor-pointer"
                    title="Rename Account Alias"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenUpload();
                }}
                className="sm:hidden w-full flex items-center justify-center gap-2 py-2.5 clay-button-primary text-xs font-extrabold tracking-wide cursor-pointer"
              >
                <Upload className="w-4 h-4 stroke-[2.2]" />
                <span>Upload CUR Report</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onLogout) onLogout();
                }}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-zorvex-spike hover:bg-zorvex-spike-soft dark:hover:bg-red-950/30 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>

          </div>
        )}

      </div>

      {/* Account Alias Rename Modal */}
      {renameModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="surface-floating border border-zorvex-border dark:border-zorvex-dark-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zorvex-border dark:border-zorvex-dark-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-zorvex-forest-soft dark:bg-zorvex-dark-forest-soft text-zorvex-forest dark:text-zorvex-dark-forest flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
                    Rename Account Alias
                  </h3>
                  <p className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                    Set a recognizable friendly name for this AWS Account
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRenameModalOpen(false)}
                className="p-1 rounded-lg text-zorvex-text-secondary hover:text-zorvex-text dark:hover:text-zorvex-dark-text transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRename} className="space-y-4">
              {activeOption?.usage_account_id && (
                <div className="px-3 py-2 rounded-xl bg-zorvex-surface-secondary/70 dark:bg-zorvex-dark-surface-secondary/50 border border-zorvex-border/60 dark:border-zorvex-dark-border/60 text-xs">
                  <span className="font-semibold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">AWS Account ID: </span>
                  <span className="font-mono font-bold text-zorvex-forest dark:text-zorvex-dark-forest">{activeOption.usage_account_id}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text mb-1.5">
                  Account Friendly Name / Alias
                </label>
                <input
                  type="text"
                  value={renameAccountName}
                  onChange={(e) => setRenameAccountName(e.target.value)}
                  placeholder="e.g. evital-prod, billing-master, prod-workloads"
                  className="w-full px-3.5 py-2.5 rounded-xl clay-input text-xs font-semibold text-zorvex-text dark:text-zorvex-dark-text focus:outline-none"
                  autoFocus
                />
              </div>

              {activeOption?.usage_account_id && (
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary select-none">
                  <input
                    type="checkbox"
                    checked={renamePropagate}
                    onChange={(e) => setRenamePropagate(e.target.checked)}
                    className="rounded text-zorvex-forest focus:ring-zorvex-forest"
                  />
                  <span>Apply alias to all CUR files with Account {activeOption.usage_account_id}</span>
                </label>
              )}

              {renameError && (
                <div className="text-xs font-semibold text-zorvex-spike bg-zorvex-spike-soft/30 p-2.5 rounded-xl border border-zorvex-spike/20">
                  {renameError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={renaming}
                  onClick={() => setRenameModalOpen(false)}
                  className="px-4 py-2 rounded-xl clay-button text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renaming}
                  className="px-4 py-2 rounded-xl clay-button-primary text-xs font-bold text-white tracking-wide cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {renaming ? 'Saving...' : 'Save Alias'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
