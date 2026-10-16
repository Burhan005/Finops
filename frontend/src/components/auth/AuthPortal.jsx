import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  Lock, 
  Mail, 
  User, 
  Building, 
  ArrowRight, 
  ArrowLeft, 
  AlertCircle, 
  Loader2, 
  ShieldCheck, 
  Zap, 
  Database,
  TrendingUp,
  TrendingDown,
  Sparkles,
  CheckCircle2,
  Activity,
  Layers
} from 'lucide-react';
import { api } from '../../services/api';
import ZorvexLogo from '../common/ZorvexLogo';
import ThemeToggle from '../common/ThemeToggle';

export default function AuthPortal({ initialMode = 'login', onAuthSuccess, darkMode, onToggleDarkMode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  
  // Form fields
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync mode with route
  useEffect(() => {
    if (location.pathname === '/register') {
      setMode('register');
      document.title = 'Create Workspace — ZORVEX | See Beyond Spend.';
    } else {
      setMode('login');
      document.title = 'Sign In — ZORVEX | See Beyond Spend.';
    }
    setError('');
  }, [location.pathname]);

  const handleTabChange = (newMode) => {
    setMode(newMode);
    setError('');
    navigate(newMode === 'register' ? '/register' : '/login', { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const data = await api.login(email, password);
        if (onAuthSuccess) onAuthSuccess(data.user);
        navigate('/app/overview');
      } else {
        const data = await api.register(name, company, email, password);
        if (onAuthSuccess) onAuthSuccess(data.user);
        navigate('/app/overview');
      }
    } catch (err) {
      setError(err.message || (mode === 'login' ? 'Invalid email or password' : 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`h-screen w-full flex flex-col lg:flex-row overflow-hidden transition-colors duration-300 font-sans selection:bg-zorvex-forest-soft selection:text-zorvex-forest ${
      darkMode ? 'text-[#F0EEE4]' : 'text-[#292E28]'
    }`}>
      
      {/* ========================================================================= */}
      {/* LEFT 50%: Theme-Aware FinOps Visual Telemetry Showcase                    */}
      {/* ========================================================================= */}
      <div className={`hidden lg:flex lg:w-1/2 h-full p-8 xl:p-12 2xl:p-14 flex-col justify-between relative overflow-hidden shrink-0 transition-colors duration-300 border-r z-10 ${
        darkMode 
          ? 'bg-[#141F16] text-[#F0EEE4] border-[#3B493D]' 
          : 'bg-[#E6E9DD] text-[#292E28] border-[#E3DCCB]'
      }`}>
        
        {/* Atmospheric Warm Volumetric Ambient Lights */}
        <div 
          className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full blur-[140px] pointer-events-none transition-all duration-700"
          style={{
            background: darkMode 
              ? 'radial-gradient(circle, rgba(73, 102, 77, 0.28) 0%, rgba(20, 31, 22, 0.1) 70%, transparent 100%)'
              : 'radial-gradient(circle, rgba(73, 102, 77, 0.15) 0%, rgba(230, 233, 221, 0.5) 70%, transparent 100%)'
          }}
        />
        <div 
          className="absolute top-1/2 -right-36 w-[500px] h-[500px] rounded-full blur-[130px] pointer-events-none transition-all duration-700"
          style={{
            background: darkMode
              ? 'radial-gradient(circle, rgba(175, 198, 155, 0.16) 0%, rgba(37, 46, 38, 0.1) 60%, transparent 100%)'
              : 'radial-gradient(circle, rgba(255, 252, 245, 0.8) 0%, rgba(230, 233, 221, 0.4) 60%, transparent 100%)'
          }}
        />

        {/* Top Header: Brand Logo + Telemetry Engine Badge */}
        <div className="relative z-10 flex items-center justify-between">
          <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <ZorvexLogo size="md" showWordmark={true} showTagline={false} forceLightText={darkMode} />
          </Link>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full surface-recessed border border-zorvex-border dark:border-zorvex-dark-border text-zorvex-forest dark:text-zorvex-dark-forest text-[10px] font-extrabold uppercase tracking-wider shadow-surface-flat">
            <Sparkles className="w-3 h-3 text-zorvex-forest dark:text-zorvex-dark-forest" />
            <span>FinOps Telemetry v2.0</span>
          </div>
        </div>

        {/* Center: Hero Headline & Sculpted Live Telemetry Mockup */}
        <div className="relative z-10 my-auto py-3 space-y-5 max-w-xl">
          
          <div>
            <h1 className="text-3xl xl:text-4xl 2xl:text-5xl font-black tracking-tight text-zorvex-text dark:text-zorvex-dark-text leading-[1.12]">
              See Beyond Spend<span className="text-zorvex-forest dark:text-zorvex-dark-forest">.</span>
            </h1>
            <p className="text-xs xl:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-2 font-medium leading-relaxed">
              Autonomous AWS billing analytics, sub-second delta anomaly drilldowns, and auditable non-destructive cost elimination.
            </p>
          </div>

          {/* Signature 3D Sculptural Clay Telemetry Console Card */}
          <div className="rounded-[28px] surface-raised border border-zorvex-border dark:border-zorvex-dark-border shadow-surface-raised p-5 xl:p-6 space-y-4">
            
            {/* Console Header: Cluster Status Beacon & Live Badge */}
            <div className="flex items-center justify-between pb-3 border-b border-zorvex-border/60 dark:border-zorvex-dark-border/60">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <div>
                  <div className="text-xs font-black tracking-wide text-zorvex-text dark:text-zorvex-dark-text leading-none">
                    AWS-PRODUCTION-FLEET
                  </div>
                  <div className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5 leading-none">
                    us-east-1 • eu-west-1 • 3 Accounts Connected
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono font-extrabold text-zorvex-forest dark:text-zorvex-dark-forest bg-zorvex-forest-soft dark:bg-zorvex-dark-forest-soft border border-zorvex-forest/30 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-zorvex-forest dark:bg-zorvex-dark-forest animate-pulse" />
                CUR Ingestion Live
              </span>
            </div>

            {/* Metrics Dual-Pod */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-2xl surface-recessed border border-zorvex-border/60 dark:border-zorvex-dark-border/60 shadow-surface-recessed">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary uppercase tracking-wider">Overnight Delta</span>
                  <div className="w-5 h-5 rounded-full bg-zorvex-spike/20 text-zorvex-spike flex items-center justify-center">
                    <TrendingUp className="w-3 h-3" />
                  </div>
                </div>
                <div className="text-lg xl:text-xl font-black text-zorvex-text dark:text-zorvex-dark-text mt-1.5 tracking-tight font-mono">
                  +$1,420.80
                </div>
                <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zorvex-spike/15 border border-zorvex-spike/30 text-[10px] text-zorvex-spike font-bold font-mono">
                  <span>+14.2%</span>
                  <span>•</span>
                  <span>NAT Egress</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl surface-recessed border border-zorvex-border/60 dark:border-zorvex-dark-border/60 shadow-surface-recessed">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary uppercase tracking-wider">Audited Savings</span>
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <TrendingDown className="w-3 h-3" />
                  </div>
                </div>
                <div className="text-lg xl:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5 tracking-tight font-mono">
                  -$18,340<span className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary font-normal font-sans">/mo</span>
                </div>
                <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                  <span>14 Heuristics</span>
                  <span>•</span>
                  <span>Non-destructive</span>
                </div>
              </div>
            </div>

            {/* Smooth Bezier Cost Wave Chart */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-[10px] font-bold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mb-2">
                <span>Normalized Spend Trajectory (Last 30 Days)</span>
                <span className="text-zorvex-text dark:text-zorvex-dark-text font-mono font-bold">Accuracy: 99.98%</span>
              </div>
              <div className="relative">
                <svg viewBox="0 0 450 60" className="w-full h-12 stroke-current text-zorvex-forest dark:text-zorvex-dark-forest" fill="none">
                  <defs>
                    <linearGradient id="spendFlowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={darkMode ? "#AFC69B" : "#49664D"} stopOpacity="0.35" />
                      <stop offset="60%" stopColor={darkMode ? "#AFC69B" : "#49664D"} stopOpacity="0.1" />
                      <stop offset="100%" stopColor={darkMode ? "#AFC69B" : "#49664D"} stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Subtle Grid Horizon */}
                  <line x1="0" y1="52" x2="450" y2="52" stroke={darkMode ? "#3B493D" : "#E3DCCB"} strokeWidth="1" strokeDasharray="4 4" />
                  
                  {/* Smooth Area Fill */}
                  <path 
                    d="M 0 45 C 50 42, 90 20, 150 25 C 210 30, 250 48, 310 14 C 360 -4, 400 12, 450 8 L 450 55 L 0 55 Z" 
                    fill="url(#spendFlowGrad)" 
                  />
                  
                  {/* Smooth Trajectory Stroke */}
                  <path 
                    d="M 0 45 C 50 42, 90 20, 150 25 C 210 30, 250 48, 310 14 C 360 -4, 400 12, 450 8" 
                    stroke={darkMode ? "#AFC69B" : "#49664D"} 
                    strokeWidth="2.75" 
                    strokeLinecap="round" 
                  />
                  
                  {/* Highlight Nodes */}
                  <circle cx="150" cy="25" r="3.5" fill={darkMode ? "#AFC69B" : "#49664D"} />
                  <circle cx="310" cy="14" r="4.5" fill="#C45A4A" stroke={darkMode ? "#F0EEE4" : "#FFFCF5"} strokeWidth="1.5" />
                </svg>

                {/* Micro Spike Callout Tag */}
                <div className="absolute right-24 top-0 -translate-y-1/2 px-2 py-0.5 rounded-md surface-recessed border border-zorvex-spike/40 text-zorvex-spike text-[9px] font-extrabold shadow-sm font-mono">
                  Spike Peak: +$1,420
                </div>
              </div>
            </div>

          </div>

          {/* 3 Tactile Micro-Badges Row */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div className="p-2.5 rounded-2xl surface-flat border border-zorvex-border/60 dark:border-zorvex-dark-border/60 text-center">
              <div className="text-[10px] font-black text-zorvex-text dark:text-zorvex-dark-text">Sub-Second Delta</div>
              <div className="text-[9px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">Resource-level drilldown</div>
            </div>
            <div className="p-2.5 rounded-2xl surface-flat border border-zorvex-border/60 dark:border-zorvex-dark-border/60 text-center">
              <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">Zero-Agent CUR</div>
              <div className="text-[9px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">Read-only billing files</div>
            </div>
            <div className="p-2.5 rounded-2xl surface-flat border border-zorvex-border/60 dark:border-zorvex-dark-border/60 text-center">
              <div className="text-[10px] font-black text-zorvex-forest dark:text-zorvex-dark-forest">Isolated SQLite DB</div>
              <div className="text-[9px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">Zero runtime leakage</div>
            </div>
          </div>

        </div>

        {/* Bottom Trust Line */}
        <div className="relative z-10 pt-3 border-t border-zorvex-border/60 dark:border-zorvex-dark-border/60 flex items-center justify-between text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
          <span className="font-semibold">SOC-2 Type II Isolation Ready</span>
          <span>© 2026 ZORVEX Inc.</span>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* RIGHT 50%: Interactive Tactile Clay Authentication Suite                  */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-1/2 h-full flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16 relative overflow-y-auto">
        
        {/* Top Controls: Back Pill (Left) & Animated Theme Toggle (Right) */}
        <header className="flex items-center justify-between w-full relative z-20">
          <Link
            to="/"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full clay-button text-xs font-extrabold text-zorvex-text dark:text-zorvex-dark-text hover:text-zorvex-forest dark:hover:text-zorvex-dark-forest transition-all cursor-pointer shadow-surface-flat surface-raised"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block text-[11px] font-extrabold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
              Console Access
            </span>
            {onToggleDarkMode && (
              <ThemeToggle darkMode={darkMode} onToggle={onToggleDarkMode} size="sm" />
            )}
          </div>
        </header>

        {/* Protected Solid 3D Clay Form Card (Shielded from background lines) */}
        <main className="max-w-md w-full mx-auto my-auto p-6 sm:p-8 rounded-3xl surface-floating border border-zorvex-border dark:border-zorvex-dark-border shadow-surface-floating bg-[#FFFCF5] dark:bg-[#252E26] space-y-5 relative z-10">
          
          {/* Header Title */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zorvex-text dark:text-zorvex-dark-text">
              {mode === 'login' ? 'Welcome back' : 'Create Workspace'}
            </h2>
            <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1.5 font-medium">
              {mode === 'login' 
                ? 'Enter your credentials to access your cloud billing telemetry.'
                : 'Initialize an isolated organization environment for your FinOps team.'
              }
            </p>
          </div>

          {/* Interactive Sliding Clay Mode Selector */}
          <div className="p-1 rounded-2xl surface-recessed border border-zorvex-border dark:border-zorvex-dark-border flex items-center relative">
            <button
              type="button"
              onClick={() => handleTabChange('login')}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer ${
                mode === 'login'
                  ? 'surface-raised text-zorvex-text dark:text-zorvex-dark-text shadow-surface-flat border border-zorvex-border dark:border-zorvex-dark-border'
                  : 'text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('register')}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer ${
                mode === 'register'
                  ? 'surface-raised text-zorvex-text dark:text-zorvex-dark-text shadow-surface-flat border border-zorvex-border dark:border-zorvex-dark-border'
                  : 'text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text dark:hover:text-white'
              }`}
            >
              Create Workspace
            </button>
          </div>

          {/* Session Expired Notification */}
          {new URLSearchParams(location.search).get('expired') && !error && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-400 font-bold flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Your session has expired. Please sign in again.</span>
            </div>
          )}

          {/* Error Notification */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-zorvex-spike-soft dark:bg-red-950/40 border border-zorvex-spike/30 text-xs text-zorvex-spike font-bold flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Inputs Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <>
                <div>
                  <label htmlFor="auth-full-name" className="block text-[10px] font-extrabold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-zorvex-forest dark:text-zorvex-dark-forest absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-full-name"
                      name="fullName"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Burhan Kapasi"
                      aria-label="Full Name"
                      className="w-full pl-10 pr-4 py-2.5 clay-input text-xs font-semibold text-zorvex-text dark:text-zorvex-dark-text placeholder:text-zorvex-text-secondary/60 dark:placeholder:text-zorvex-dark-text-secondary/60"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="auth-organization" className="block text-[10px] font-extrabold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mb-1">
                    Organization / Company
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-zorvex-forest dark:text-zorvex-dark-forest absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-organization"
                      name="organization"
                      type="text"
                      required
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="e.g. Cloud Infrastructure Org"
                      aria-label="Organization or Company"
                      className="w-full pl-10 pr-4 py-2.5 clay-input text-xs font-semibold text-zorvex-text dark:text-zorvex-dark-text placeholder:text-zorvex-text-secondary/60 dark:placeholder:text-zorvex-dark-text-secondary/60"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-[10px] font-extrabold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mb-1">
                Workspace Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zorvex-forest dark:text-zorvex-dark-forest absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  aria-label="Workspace Email"
                  className="w-full pl-10 pr-4 py-2.5 clay-input text-xs font-semibold text-zorvex-text dark:text-zorvex-dark-text placeholder:text-zorvex-text-secondary/60 dark:placeholder:text-zorvex-dark-text-secondary/60"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="auth-password" className="block text-[10px] font-extrabold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                  Master Password
                </label>
                {mode === 'login' && (
                  <Link
                    to="/forgot-password"
                    className="text-[11px] font-extrabold text-zorvex-forest dark:text-zorvex-dark-forest hover:underline"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-zorvex-forest dark:text-zorvex-dark-forest absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'At least 6 characters' : 'Enter your password'}
                  aria-label="Master Password"
                  className="w-full pl-10 pr-4 py-2.5 clay-input text-xs font-semibold text-zorvex-text dark:text-zorvex-dark-text placeholder:text-zorvex-text-secondary/60 dark:placeholder:text-zorvex-dark-text-secondary/60"
                />
              </div>
            </div>

            {/* 3D Tactile Clay Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 clay-button-primary text-xs font-black tracking-wider uppercase flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-surface-raised hover:-translate-y-0.5 active:translate-y-0 transition-all"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In to Console' : 'Initialize Workspace'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Footer Links */}
          <div className="pt-3 border-t border-zorvex-border dark:border-zorvex-dark-border text-center text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
            {mode === 'login' ? (
              <span>
                Need a new organization?{' '}
                <button
                  type="button"
                  onClick={() => handleTabChange('register')}
                  className="font-extrabold text-zorvex-forest dark:text-zorvex-dark-forest hover:underline cursor-pointer"
                >
                  Create Workspace
                </button>
              </span>
            ) : (
              <span>
                Already have a workspace?{' '}
                <button
                  type="button"
                  onClick={() => handleTabChange('login')}
                  className="font-extrabold text-zorvex-forest dark:text-zorvex-dark-forest hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </span>
            )}
          </div>

        </main>

        {/* Security Trust Seal */}
        <footer className="text-center text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary py-1 relative z-20">
          Protected by enterprise tenant encryption • Zero runtime mock data
        </footer>

      </div>

    </div>
  );
}
