import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import KpiCards from './components/KpiCards';
import SpendingCharts from './components/SpendingCharts';
import GlobalFilterBar from './components/common/GlobalFilterBar';
import AmbientBackground from './components/common/AmbientBackground';
import UnitEconomicsCard from './components/common/UnitEconomicsCard';
import ExecutiveSpendPulse from './components/ExecutiveSpendPulse';
import ErrorBoundary from './components/common/ErrorBoundary';
import { api } from './services/api';
import { Activity, GitCompare, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';

// Code-split dynamic routes for fast initial paint & modular bundle loading
const ComparisonView = lazy(() => import('./components/ComparisonView'));
const RecommendationsView = lazy(() => import('./components/RecommendationsView'));
const ServiceExplorer = lazy(() => import('./components/ServiceExplorer'));
const ResourceExplorer = lazy(() => import('./components/ResourceExplorer'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const AnomaliesBudgetsView = lazy(() => import('./components/AnomaliesBudgetsView'));
const SavingsLedgerView = lazy(() => import('./components/SavingsLedgerView'));
const AskZorvexView = lazy(() => import('./components/AskZorvexView'));
const UploadModal = lazy(() => import('./components/UploadModal'));
const LoginView = lazy(() => import('./components/auth/LoginView'));
const RegisterView = lazy(() => import('./components/auth/RegisterView'));
const ForgotPasswordView = lazy(() => import('./components/auth/ForgotPasswordView'));
const ResetPasswordView = lazy(() => import('./components/auth/ResetPasswordView'));
const LandingPageView = lazy(() => import('./components/landing/LandingPageView'));
const NotFoundView = lazy(() => import('./components/NotFoundView'));
const PrivacyPolicyView = lazy(() => import('./components/legal/PrivacyPolicyView'));
const TermsOfServiceView = lazy(() => import('./components/legal/TermsOfServiceView'));
import CookieConsentBanner from './components/common/CookieConsentBanner';
import { DashboardSkeleton, ViewLoadingFallback } from './components/common/DashboardSkeleton';
import CommandPalette from './components/common/CommandPalette';
import FloatingScopeCapsule from './components/common/FloatingScopeCapsule';
import { ToastProvider, useToast } from './context/ToastContext';
import useSpecularGlow from './hooks/useSpecularGlow';



function DashboardLayout({
  overview,
  trends,
  recommendations,
  datasets,
  activeDataset,
  onSelectDataset,
  onRefreshDatasets,
  onOpenUpload,
  filterStartDate,
  filterEndDate,
  onDateRangeChange,
  filterService,
  onServiceChange,
  filterAccount,
  onAccountChange,
  onResetFilters,
  loading,
  error,
  onRetry,
  darkMode,
  onToggleDarkMode,
  currentUser,
  onLogout,
  forexData,
  masterServices = [],
  masterServiceCosts = {}
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  
  const [currency, setCurrency] = useState(() => {
    try {
      return localStorage.getItem('zorvex_preferred_currency') || 'USD';
    } catch {
      return 'USD';
    }
  });

  const handleSelectCurrency = (c) => {
    setCurrency(c);
    try {
      localStorage.setItem('zorvex_preferred_currency', c);
    } catch {}
  };

  const toggleCurrency = () => {
    handleSelectCurrency(currency === 'USD' ? 'INR' : 'USD');
  };

  const toast = useToast();
  const hasAlertedSpike = useRef(false);

  useEffect(() => {
    if (overview && !hasAlertedSpike.current) {
      const defComp = overview.default_comparison || (overview.comparison_defaults ? {
        delta_cost: overview.comparison_defaults.delta?.delta_cost || 0,
        target_date: overview.comparison_defaults.target_date || ''
      } : {});
      const deltaCost = defComp.delta_cost || 0;
      if (deltaCost > 15) {
        hasAlertedSpike.current = true;
        const targetDate = defComp.target_date || '';
        const timer = setTimeout(() => {
          toast.spikeAlert({
            date: targetDate,
            cost: deltaCost,
            service: 'Telemetry Spike Detected',
            onAction: () => navigate('/app/comparison')
          });
        }, 1600);
        return () => clearTimeout(timer);
      }
    }
  }, [overview, toast, navigate]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const path = location.pathname;
    if (path.includes('overview')) document.title = 'Overview — ZORVEX | See Beyond Spend.';
    else if (path.includes('services')) document.title = 'Service Explorer — ZORVEX | See Beyond Spend.';
    else if (path.includes('anomalies')) document.title = 'Anomalies & Budgets — ZORVEX | See Beyond Spend.';
    else if (path.includes('comparison')) document.title = 'Cost Changes & Root Cause — ZORVEX | See Beyond Spend.';
    else if (path.includes('recommendations')) document.title = 'Commitments & Waste — ZORVEX | See Beyond Spend.';
    else if (path.includes('ledger')) document.title = 'Savings Ledger — ZORVEX | See Beyond Spend.';
    else if (path.includes('resources')) document.title = 'Resource Explorer — ZORVEX | See Beyond Spend.';
    else if (path.includes('ai')) document.title = 'Ask ZORVEX AI — ZORVEX | See Beyond Spend.';
    else if (path.includes('settings')) document.title = 'Settings — ZORVEX | See Beyond Spend.';
  }, [location.pathname]);

  const rawServices = Object.keys(overview?.services || {});
  const rawAccounts = Object.keys(overview?.accounts || {});

  return (
    <div className="min-h-screen w-full bg-transparent text-zorvex-text dark:text-zorvex-dark-text flex flex-col transition-colors duration-200">
      
      {/* Navbar with Clean FinOps Clay identity shielded by ErrorBoundary */}
      <ErrorBoundary 
        title="Navigation Shell Exception"
        message="A rendering anomaly occurred in the navigation bar. Your active cloud telemetry session is completely safe."
        onReset={() => window.location.reload()}
      >
        <Navbar
          datasets={datasets}
          activeDataset={activeDataset}
          onSelectDataset={onSelectDataset}
          onRefreshDatasets={onRefreshDatasets}
          onOpenUpload={onOpenUpload}
          darkMode={darkMode}
          onToggleDarkMode={onToggleDarkMode}
          currentUser={currentUser}
          onLogout={onLogout}
          currency={currency}
          onSelectCurrency={handleSelectCurrency}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />
      </ErrorBoundary>

      {/* Main App Content */}
      <main className="flex-1 max-w-7xl xl:max-w-[1400px] 2xl:max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        
        {/* Error notification if backend offline */}
        {error && (
          <div className="mb-6 p-4 rounded-clay-sm bg-clay-coral-light border border-clay-coral/30 text-clay-coral flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-clay-pill bg-clay-card text-xs font-extrabold shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Global Filter Bar */}
        {(location.pathname.includes('overview') || location.pathname.includes('resources') || location.pathname.includes('services')) && overview && (
          <div className="mb-6 relative z-30">
            <GlobalFilterBar
              startDate={filterStartDate}
              endDate={filterEndDate}
              onDateRangeChange={onDateRangeChange}
              availableDates={overview.dates || []}
              selectedService={filterService}
              onServiceChange={onServiceChange}
              availableServices={masterServices.length > 0 ? masterServices : rawServices}
              selectedAccount={filterAccount}
              onAccountChange={onAccountChange}
              availableAccounts={rawAccounts}
              onResetFilters={onResetFilters}
            />
          </div>
        )}

        {/* Claymorphism 3.0 Dashboard Skeleton */}
        {loading && !overview && (
          <DashboardSkeleton />
        )}

        {/* Nested Route Views */}
        {!loading && overview && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <ErrorBoundary>
              <Routes>
                <Route
                  path="overview"
                  element={
                    <div className="page-transition space-y-8">
                      <KpiCards overview={overview} recommendations={recommendations} forexData={forexData} currency={currency} />
                      <UnitEconomicsCard 
                        totalCost={overview.total_cost}
                        overview={overview}
                        filterStartDate={filterStartDate}
                        filterEndDate={filterEndDate}
                        onDateRangeChange={onDateRangeChange}
                        filterService={filterService}
                        onServiceChange={onServiceChange}
                        availableServices={masterServices}
                        onResetFilters={onResetFilters}
                        forexData={forexData}
                        currency={currency}
                        onToggleCurrency={toggleCurrency}
                      />
                      <SpendingCharts 
                        overview={overview} 
                        trends={trends} 
                        currency={currency} 
                        forexData={forexData}
                        filterService={filterService}
                        onServiceChange={onServiceChange}
                        onDateRangeChange={onDateRangeChange}
                      />
                      <ExecutiveSpendPulse overview={overview} recommendations={recommendations} forexData={forexData} currency={currency} />
                      
                      {/* Action Banner to Cost Comparison */}
                      <div className="clay-card p-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-gradient-to-r from-clay-card via-zorvex-surface-secondary/40 to-clay-surface border border-zorvex-border dark:border-zorvex-dark-border">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-zorvex-forest-soft dark:bg-zorvex-dark-forest-soft flex items-center justify-center text-zorvex-forest dark:text-zorvex-dark-forest shadow-inner">
                            <GitCompare className="w-6 h-6 stroke-[2.5]" />
                          </div>
                          <div>
                            <h4 className="text-sm font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
                              Pinpoint Why Cloud Costs Shifted
                            </h4>
                            <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">
                              Launch our Daily Delta and Monthly Comparison analyzer to isolate exact resource-level spikes.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate('/app/comparison')}
                          className="flex items-center gap-2 px-5 py-2.5 clay-button-primary text-xs font-extrabold flex-shrink-0"
                        >
                          <span>Launch Cost Comparison</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  }
                />

                <Route
                  path="services"
                  element={
                    <div className="page-transition">
                      <ServiceExplorer
                        key={activeDataset || 'empty'}
                        overview={overview}
                        trends={trends}
                        selectedAccount={filterAccount}
                        selectedService={filterService}
                        onServiceChange={onServiceChange}
                        masterServices={masterServices.length > 0 ? masterServices : rawServices}
                        masterServiceCosts={masterServiceCosts}
                        activeDataset={activeDataset}
                        forexData={forexData}
                      />
                    </div>
                  }
                />
                <Route
                  path="services/:serviceId"
                  element={
                    <div className="page-transition">
                      <ServiceExplorer
                        key={activeDataset || 'empty'}
                        overview={overview}
                        trends={trends}
                        selectedAccount={filterAccount}
                        selectedService={filterService}
                        onServiceChange={onServiceChange}
                        masterServices={masterServices.length > 0 ? masterServices : rawServices}
                        masterServiceCosts={masterServiceCosts}
                        activeDataset={activeDataset}
                        forexData={forexData}
                      />
                    </div>
                  }
                />

                <Route path="anomalies" element={<div className="page-transition"><AnomaliesBudgetsView overview={overview} /></div>} />
                <Route path="recommendations" element={<div className="page-transition"><RecommendationsView recommendations={recommendations} /></div>} />
                <Route path="ledger" element={<div className="page-transition"><SavingsLedgerView /></div>} />
                <Route path="comparison" element={<div className="page-transition"><ComparisonView overview={overview} selectedAccount={filterAccount} forexData={forexData} currency={currency} /></div>} />
                <Route
                  path="resources"
                  element={
                    <div className="page-transition">
                      <ResourceExplorer
                        overview={overview}
                        selectedAccount={filterAccount}
                        selectedService={filterService}
                        onServiceChange={onServiceChange}
                        activeDataset={activeDataset}
                        forexData={forexData}
                      />
                    </div>
                  }
                />
                <Route path="ai" element={<div className="page-transition"><AskZorvexView /></div>} />
                <Route
                  path="settings"
                  element={
                    <div className="page-transition">
                      <SettingsView
                        activeDataset={activeDataset}
                        currentUser={currentUser}
                        onRefreshDatasets={onRefreshDatasets}
                        onSelectDataset={onSelectDataset}
                      />
                    </div>
                  }
                />
                <Route path="*" element={<Navigate to="overview" replace />} />
              </Routes>
            </ErrorBoundary>
          </Suspense>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 border-t border-zorvex-border dark:border-zorvex-dark-border bg-zorvex-surface/80 dark:bg-zorvex-dark-surface/80 text-center text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold">
            <span className="font-extrabold text-zorvex-text dark:text-zorvex-dark-text">ZORVEX</span>
            <span>•</span>
            <span className="italic">See Beyond Spend.</span>
          </div>
          <div>
            Active Telemetry: <span className="font-mono font-bold text-zorvex-text dark:text-zorvex-dark-text">{activeDataset}</span>
          </div>
        </div>
      </footer>

      {/* Sticky Floating Scope Capsule when scrolling past 320px */}
      <FloatingScopeCapsule
        activeDatasetName={
          [...(datasets?.samples || []), ...(datasets?.uploads || [])].find((d) => (d.filename || d.id) === activeDataset)?.alias ||
          [...(datasets?.samples || []), ...(datasets?.uploads || [])].find((d) => (d.filename || d.id) === activeDataset)?.name ||
          activeDataset ||
          'Enterprise CUR Benchmark'
        }
        totalCost={overview?.total_cost || 0}
        currency={currency}
        forexRate={forexData?.rate || 95.32}
        servicesCount={rawServices.length}
      />

      {/* Global ⌘K Command Palette Spotlight */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        datasets={[...(datasets?.samples || []), ...(datasets?.uploads || [])]}
        activeDataset={activeDataset}
        onSelectDataset={onSelectDataset}
        currency={currency}
        onToggleCurrency={toggleCurrency}
        darkMode={darkMode}
        onToggleDarkMode={onToggleDarkMode}
        availableServices={masterServices.length > 0 ? masterServices : rawServices}
        onSelectService={(svc) => {
          onServiceChange(svc);
          navigate('/app/services');
        }}
        onResetFilters={onResetFilters}
      />

    </div>
  );
}

export default function App() {
  useSpecularGlow();
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [datasets, setDatasets] = useState({ samples: [], uploads: [] });
  const [activeDataset, setActiveDataset] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Global reporting filter state
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterService, setFilterService] = useState('All');
  const [filterAccount, setFilterAccount] = useState('all');
  const [masterServices, setMasterServices] = useState([]);
  const [masterServiceCosts, setMasterServiceCosts] = useState({});

  // Real-time Forex exchange rate state (dynamic via Open Exchange API)
  const [forexData, setForexData] = useState({
    rate: 95.32,
    formatted: '₹95.32',
    currency_pair: 'USD/INR',
    last_updated_utc: '',
    is_live: true
  });

  useEffect(() => {
    api.getForexRate()
      .then((data) => {
        if (data && data.rate) {
          setForexData(data);
        }
      })
      .catch((err) => console.warn('Forex fetch fallback:', err));
  }, []);

  // Theme control: Light (warm pastel default) / Dark mode
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('finops_clay_theme') === 'dark';
  });

  // Dynamic logged-in user state from DB
  const [currentUser, setCurrentUser] = useState(() => {
    const token = localStorage.getItem('finops_token');
    if (!token) return null;
    try {
      const saved = localStorage.getItem('finops_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [authLoading, setAuthLoading] = useState(() => {
    const token = localStorage.getItem('finops_token');
    const user = localStorage.getItem('finops_user');
    return !!token && !user;
  });

  useEffect(() => {
    const handleAuthExpired = () => {
      setCurrentUser(null);
      localStorage.removeItem('finops_token');
      localStorage.removeItem('finops_user');
      if (window.location.pathname.startsWith('/app')) {
        window.location.href = '/login?expired=1';
      }
    };
    window.addEventListener('finops_auth_expired', handleAuthExpired);

    const token = localStorage.getItem('finops_token');
    if (!token) {
      setCurrentUser(null);
      localStorage.removeItem('finops_user');
      setAuthLoading(false);
      return () => window.removeEventListener('finops_auth_expired', handleAuthExpired);
    }

    let isMounted = true;
    api.getMe()
      .then((res) => {
        if (!isMounted) return;
        if (res && res.user) {
          setCurrentUser(res.user);
          localStorage.setItem('finops_user', JSON.stringify(res.user));
        } else {
          setCurrentUser(null);
          localStorage.removeItem('finops_user');
          localStorage.removeItem('finops_token');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        // Network drop or temporary server reboot must NOT purge credentials
        console.warn('ZORVEX session check transient error:', err);
      })
      .finally(() => {
        if (isMounted) setAuthLoading(false);
      });

    return () => {
      isMounted = false;
      window.removeEventListener('finops_auth_expired', handleAuthExpired);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.error(err);
    }
    localStorage.removeItem('finops_token');
    localStorage.removeItem('finops_user');
    localStorage.removeItem('zorvex_preferred_dataset');
    setCurrentUser(null);
    setActiveDataset('aws_cur_production_exact.csv');
    window.location.href = '/';
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('finops_clay_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('finops_clay_theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  const loadData = async (start = filterStartDate, end = filterEndDate, account = filterAccount, service = filterService, reloadDatasets = false) => {
    setLoading(true);
    setError('');
    try {
      const promises = [
        api.getOverview(start, end, account, service),
        api.getTrends(start, end),
        api.getDatasets()
      ];
      const needsRecs = reloadDatasets || !recommendations;
      if (needsRecs) {
        promises.push(api.getRecommendations());
      }
      const results = await Promise.all(promises);
      const ov = results[0];
      const tr = results[1];
      const dsets = results[2];
      const recs = results[3] || recommendations;

      if (needsRecs && results[3]) {
        setRecommendations(results[3]);
      }

      if (ov) {
        // Defensive enrichment: guarantee potential_savings, total_resources, and default_comparison
        if ((ov.potential_savings === undefined || ov.potential_savings === 0) && recs?.total_potential_savings) {
          ov.potential_savings = recs.total_potential_savings;
        }
        if (!ov.total_resources) {
          ov.total_resources = ov.matching_resources_count || ov.total_rows || 0;
        }
        if (!ov.default_comparison && ov.comparison_defaults) {
          ov.default_comparison = {
            baseline_date: ov.comparison_defaults.baseline_date || '',
            target_date: ov.comparison_defaults.target_date || '',
            delta_cost: ov.comparison_defaults.delta?.delta_cost || 0,
            pct_change: ov.comparison_defaults.delta?.pct_change || 0,
            pct_display: ov.comparison_defaults.delta?.pct_display || '0.0%'
          };
        }
      }
      setOverview(ov);
      setTrends(tr);

      if (dsets) {
        setDatasets(dsets);
        let rawActive = dsets.active_dataset || dsets.active || ov?.filename || '';
        const savedPref = localStorage.getItem('zorvex_preferred_dataset');
        if (savedPref && savedPref !== rawActive) {
          try {
            await api.selectDataset(savedPref);
            rawActive = savedPref;
          } catch (e) {
            console.warn('Auto-sync preferred dataset notice:', e);
          }
        }
        if (!currentUser && (rawActive.includes('cur_org_') || !rawActive)) {
          rawActive = savedPref || 'aws_cur_production_exact.csv';
        }
        setActiveDataset(rawActive);
      } else if (ov?.filename && !activeDataset) {
        let rawActive = ov.filename;
        const savedPref = localStorage.getItem('zorvex_preferred_dataset');
        if (savedPref) {
          rawActive = savedPref;
        } else if (!currentUser && (rawActive.includes('cur_org_') || !rawActive)) {
          rawActive = 'aws_cur_production_exact.csv';
        }
        setActiveDataset(rawActive);
      }

      // Master services catalog preservation: never truncate the global services dropdown
      // when filtering down to a single service!
      if (ov?.services) {
        const sKeys = Object.keys(ov.services);
        const isAllServices = !service || service === 'All';
        const isFullScope = isAllServices && !start && !end && (!account || account === 'all');

        if (isFullScope) {
          setMasterServices(sKeys);
          setMasterServiceCosts(ov.services);
        } else if (isAllServices && masterServices.length <= 1) {
          setMasterServices(sKeys);
          setMasterServiceCosts(ov.services);
        } else if (!isAllServices && masterServices.length <= 1) {
          // If loaded with a service filter before master services were cataloged, fetch complete catalog
          api.getOverview('', '', 'all', 'All').then(allOv => {
            if (allOv?.services) {
              setMasterServices(Object.keys(allOv.services));
              setMasterServiceCosts(allOv.services);
            }
          }).catch(console.warn);
        }
      }
    } catch (err) {
      console.error(err);
      setError('Could not connect to backend engine. Ensure FastAPI server is running on port 8050.');
    } finally {
      setLoading(false);
    }
  };

  const hasMountedRef = useRef(false);
  const loadedUserIdRef = useRef(currentUser?.id || null);

  useEffect(() => {
    const init = async () => {
      const savedPref = localStorage.getItem('zorvex_preferred_dataset');
      if (savedPref) {
        try {
          await api.selectDataset(savedPref);
          setActiveDataset(savedPref);
        } catch (e) {
          console.warn('Initial select dataset notice:', e);
        }
      }
      loadedUserIdRef.current = currentUser?.id || null;
      await loadData(filterStartDate, filterEndDate, filterAccount, filterService, true);
      hasMountedRef.current = true;
    };
    init();
  }, []);

  useEffect(() => {
    // High-Performance Optimization: Only reload data if the user actually switches accounts,
    // eliminating duplicate initial network calls on mount.
    if (hasMountedRef.current && currentUser?.id && loadedUserIdRef.current !== currentUser.id) {
      loadedUserIdRef.current = currentUser.id;
      loadData(filterStartDate, filterEndDate, filterAccount, filterService, true);
    }
  }, [currentUser?.id]);

  const handleSelectDataset = async (filename) => {
    setLoading(true);
    try {
      localStorage.setItem('zorvex_preferred_dataset', filename);
      setActiveDataset(filename);
      // Immediately reset analytical state to prevent old dataset's services/clusters leaking
      setOverview(null);
      setMasterServices([]);
      setMasterServiceCosts({});
      setRecommendations(null);

      await api.selectDataset(filename);
      setFilterStartDate('');
      setFilterEndDate('');
      setFilterService('All');
      setFilterAccount('all');
      await loadData('', '', 'all', 'All', true);
    } catch (err) {
      setError(err.message || 'Failed to switch dataset');
      setLoading(false);
    }
  };

  const handleDateRangeChange = (start, end) => {
    setFilterStartDate(start);
    setFilterEndDate(end);
    loadData(start, end, filterAccount, filterService);
  };

  const handleAccountChange = (acc) => {
    setFilterAccount(acc);
    loadData(filterStartDate, filterEndDate, acc, filterService);
  };

  const handleServiceChange = (svc) => {
    setFilterService(svc);
    loadData(filterStartDate, filterEndDate, filterAccount, svc);
  };

  const handleResetFilters = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterService('All');
    setFilterAccount('all');
    loadData('', '', 'all', 'All');
  };

  const handleAuthSuccess = async (user) => {
    setCurrentUser(user);
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterAccount('all');
    setFilterService('All');
    await loadData('', '', 'all', 'All', true);
  };

  return (
    <BrowserRouter>
      <ToastProvider>
        {/* Living Atmospheric Ambient Lighting (Zero Grids/Checks) */}
        <AmbientBackground darkMode={darkMode} />

      <div className="relative z-10">
        <Suspense fallback={<ViewLoadingFallback />}>
          <Routes>
            <Route path="/" element={<LandingPageView darkMode={darkMode} onToggleDarkMode={toggleDarkMode} currentUser={currentUser} />} />
            <Route path="/login" element={<LoginView onLoginSuccess={handleAuthSuccess} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />} />
            <Route path="/register" element={<RegisterView onRegisterSuccess={handleAuthSuccess} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />} />
            <Route path="/forgot-password" element={<ForgotPasswordView darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />} />
            <Route path="/reset-password" element={<ResetPasswordView darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />} />
            <Route path="/privacy" element={<PrivacyPolicyView />} />
            <Route path="/terms" element={<TermsOfServiceView />} />
            <Route path="/terms-of-service" element={<Navigate to="/terms" replace />} />
            <Route
              path="/app/*"
              element={
                authLoading ? (
                  <ViewLoadingFallback />
                ) : currentUser ? (
                  <ErrorBoundary
                    title="FinOps Dashboard Exception"
                    message="A rendering anomaly occurred in the workspace. Your data and session are safely preserved."
                    onReset={() => window.location.reload()}
                  >
                    <DashboardLayout
                    overview={overview}
                    trends={trends}
                    recommendations={recommendations}
                    datasets={datasets}
                    activeDataset={activeDataset}
                    onSelectDataset={handleSelectDataset}
                    onRefreshDatasets={() => loadData(filterStartDate, filterEndDate, filterAccount, filterService, true)}
                    onOpenUpload={() => setUploadOpen(true)}
                    filterStartDate={filterStartDate}
                    filterEndDate={filterEndDate}
                    onDateRangeChange={handleDateRangeChange}
                    filterService={filterService}
                    onServiceChange={handleServiceChange}
                    filterAccount={filterAccount}
                    onAccountChange={handleAccountChange}
                    onResetFilters={handleResetFilters}
                    loading={loading}
                    error={error}
                    onRetry={() => loadData(filterStartDate, filterEndDate, filterAccount, filterService)}
                    darkMode={darkMode}
                    onToggleDarkMode={toggleDarkMode}
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    forexData={forexData}
                    masterServices={masterServices}
                    masterServiceCosts={masterServiceCosts}
                  />
                  </ErrorBoundary>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route path="*" element={<NotFoundView />} />
          </Routes>
        </Suspense>
      </div>

      {/* Conditionally Loaded Upload Modal */}
      {uploadOpen && (
        <Suspense fallback={null}>
          <UploadModal
            isOpen={uploadOpen}
            onClose={() => setUploadOpen(false)}
            onUploadSuccess={(filename) => {
              if (filename) {
                handleSelectDataset(filename);
              } else {
                loadData(filterStartDate, filterEndDate, filterAccount);
              }
            }}
          />
        </Suspense>
      )}
          <CookieConsentBanner />
      </ToastProvider>
    </BrowserRouter>
  );
}
