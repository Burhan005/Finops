import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import KpiCards from './components/KpiCards';
import SpendingCharts from './components/SpendingCharts';
import GlobalFilterBar from './components/common/GlobalFilterBar';
import AmbientBackground from './components/common/AmbientBackground';
import UnitEconomicsCard from './components/common/UnitEconomicsCard';
import ExecutiveSpendPulse from './components/ExecutiveSpendPulse';
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

const ViewLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center py-20 space-y-3">
    <div className="w-10 h-10 rounded-2xl bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft flex items-center justify-center animate-pulse text-zorvex-forest dark:text-zorvex-forest-highlight shadow-inner">
      <Activity className="w-5 h-5 stroke-[2.5]" />
    </div>
    <span className="text-xs font-bold text-zorvex-text-muted dark:text-zorvex-dark-text-muted tracking-wide">
      Loading module...
    </span>
  </div>
);

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
      
      {/* Navbar with Clean FinOps Clay identity */}
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
      />

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
          <div className="mb-6">
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

        {/* Loading Skeleton */}
        {loading && !overview && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-14 h-14 rounded-clay-sm bg-clay-card shadow-surface-raised flex items-center justify-center animate-pulse">
              <Activity className="w-7 h-7 text-zorvex-forest dark:text-zorvex-dark-forest" />
            </div>
            <p className="text-xs font-extrabold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
              Loading FinOps Telemetry Engine...
            </p>
          </div>
        )}

        {/* Nested Route Views */}
        {!loading && overview && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <Routes>
              <Route
                path="overview"
                element={
                  <div className="page-transition space-y-8">
                    <KpiCards overview={overview} forexData={forexData} />
                    <UnitEconomicsCard totalCost={overview.total_cost} />
                    <SpendingCharts overview={overview} trends={trends} />
                    <ExecutiveSpendPulse overview={overview} recommendations={recommendations} forexData={forexData} />
                    
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
              <Route path="comparison" element={<div className="page-transition"><ComparisonView overview={overview} selectedAccount={filterAccount} forexData={forexData} /></div>} />
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
                element={<div className="page-transition"><SettingsView activeDataset={activeDataset} currentUser={currentUser} /></div>}
              />
              <Route path="*" element={<Navigate to="overview" replace />} />
            </Routes>
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

    </div>
  );
}

export default function App() {
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
      setOverview(ov);
      setTrends(tr);

      if (dsets) {
        setDatasets(dsets);
        let rawActive = dsets.active_dataset || dsets.active || ov?.filename || '';
        if (!currentUser && (rawActive.includes('cur_org_') || !rawActive)) {
          rawActive = 'aws_cur_production_exact.csv';
        }
        setActiveDataset(rawActive);
      } else if (ov?.filename && !activeDataset) {
        let rawActive = ov.filename;
        if (!currentUser && (rawActive.includes('cur_org_') || !rawActive)) {
          rawActive = 'aws_cur_production_exact.csv';
        }
        setActiveDataset(rawActive);
      }

      if (needsRecs && results[3]) {
        setRecommendations(results[3]);
      }

      if (ov?.services) {
        const sKeys = Object.keys(ov.services);
        if (sKeys.length > 1) {
          setMasterServices(sKeys);
          setMasterServiceCosts(ov.services);
        } else {
          setMasterServices((prev) => (prev.length === 0 ? sKeys : prev));
          setMasterServiceCosts((prev) => (Object.keys(prev).length === 0 ? ov.services : prev));
        }
      }
    } catch (err) {
      console.error(err);
      setError('Could not connect to backend engine. Ensure FastAPI server is running on port 8050.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectDataset = async (filename) => {
    setLoading(true);
    try {
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

  return (
    <BrowserRouter>
      {/* Living Atmospheric Ambient Lighting (Zero Grids/Checks) */}
      <AmbientBackground darkMode={darkMode} />

      <div className="relative z-10">
        <Suspense fallback={<ViewLoadingFallback />}>
          <Routes>
            <Route path="/" element={<LandingPageView darkMode={darkMode} onToggleDarkMode={toggleDarkMode} currentUser={currentUser} />} />
            <Route path="/login" element={<LoginView onLoginSuccess={(u) => setCurrentUser(u)} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />} />
            <Route path="/register" element={<RegisterView onRegisterSuccess={(u) => setCurrentUser(u)} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />} />
            <Route path="/forgot-password" element={<ForgotPasswordView darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />} />
            <Route path="/reset-password" element={<ResetPasswordView darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />} />
            <Route
              path="/app/*"
              element={
                authLoading ? (
                  <ViewLoadingFallback />
                ) : currentUser ? (
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
    </BrowserRouter>
  );
}
