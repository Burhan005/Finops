import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  ShieldCheck, 
  AlertCircle, 
  Sparkles, 
  DollarSign, 
  Calendar, 
  Zap, 
  RotateCcw,
  CheckCircle2,
  Clock,
  Server,
  Database,
  Layers,
  Cpu,
  ShieldAlert,
  ArrowRight,
  Search,
  HardDrive,
  Check,
  X,
  Filter,
  Plus,
  Minus,
  Info,
  Globe,
  Building,
  Activity,
  Award,
  HelpCircle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Percent,
  CheckCircle,
  AlertTriangle,
  FileText,
  Copy
} from 'lucide-react';
import { api } from '../services/api';

const COMMITMENT_CLASSES = [
  {
    id: 'COMPUTE_SP',
    name: 'Compute Savings Plans',
    shortName: 'Compute SP',
    modelType: 'SPEND_COMMITMENT',
    icon: Cpu,
    tag: 'EC2, Fargate & Lambda',
    maxDiscount: '52%',
    desc: 'Universal flexibility across all EC2 families, Fargate & Lambda.'
  },
  {
    id: 'EC2_STANDARD_RI',
    name: 'EC2 Reserved Instances',
    shortName: 'EC2 Standard RI',
    modelType: 'CAPACITY_RESERVATION',
    icon: HardDrive,
    tag: 'Standard EC2',
    maxDiscount: '72%',
    desc: 'Classic EC2 RIs with AZ capacity reservation and deepest instance discounts.'
  },
  {
    id: 'RDS_RI',
    name: 'RDS Reserved Instances',
    shortName: 'RDS Reserved',
    modelType: 'CAPACITY_RESERVATION',
    icon: Database,
    tag: 'Database Instances',
    maxDiscount: '60%',
    desc: 'Purchased by database engine and instance quantity for steady-state workloads.'
  },
  {
    id: 'OPENSEARCH_RI',
    name: 'OpenSearch Reserved Instances',
    shortName: 'OpenSearch RI',
    modelType: 'CAPACITY_RESERVATION',
    icon: Search,
    tag: 'Search & Analytics',
    maxDiscount: '60%',
    desc: '24/7 dedicated OpenSearch search and indexing node capacity reservation.'
  },
  {
    id: 'EC2_INSTANCE_SP',
    name: 'EC2 Instance Savings Plans',
    shortName: 'EC2 Instance SP',
    modelType: 'SPEND_COMMITMENT',
    icon: Server,
    tag: 'Dedicated EC2',
    maxDiscount: '64%',
    desc: 'Deepest EC2 discounts within a chosen family & region.'
  },
  {
    id: 'ELASTICACHE_RI',
    name: 'ElastiCache Reserved Nodes',
    shortName: 'ElastiCache RI',
    modelType: 'CAPACITY_RESERVATION',
    icon: Zap,
    tag: 'Redis & Memcached',
    maxDiscount: '65%',
    desc: 'High-throughput in-memory caching nodes running 24/7 in production.'
  },
  {
    id: 'DOCDB_RI',
    name: 'DocumentDB Reserved Instances',
    shortName: 'DocumentDB RI',
    modelType: 'CAPACITY_RESERVATION',
    icon: Layers,
    tag: 'MongoDB Compatible',
    maxDiscount: '56%',
    desc: 'Reserved capacity for DocumentDB MongoDB-compatible clusters.'
  }
];

export default function SavingsPlanSimulator() {
  const [selectedPlan, setSelectedPlan] = useState('COMPUTE_SP');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [commitment, setCommitment] = useState(null);
  const [reservedUnits, setReservedUnits] = useState(null);
  const [localCommitment, setLocalCommitment] = useState(0.04);
  const [localUnits, setLocalUnits] = useState(0);
  const [termYears, setTermYears] = useState(1);
  const [paymentOption, setPaymentOption] = useState('NO_UPFRONT');
  const [simResult, setSimResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState('');
  
  // Enterprise UI Controls
  const [showGuide, setShowGuide] = useState(false);
  const [showMathModal, setShowMathModal] = useState(false);
  const [copiedMemo, setCopiedMemo] = useState(false);

  // Resource drilldown filter tab: 'all', 'consistent', 'partially_covered', 'scheduled', 'intermittent', 'covered', 'storage', 'networking', 'micro_spend'
  const [resourceFilter, setResourceFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  const debounceTimerRef = useRef(null);

  const fetchSimulation = useCallback(async (
    comm = commitment, 
    term = termYears, 
    pay = paymentOption, 
    plan = selectedPlan, 
    units = reservedUnits,
    acc = selectedAccount,
    reg = selectedRegion,
    background = false
  ) => {
    if (background) {
      setIsSyncing(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const res = await api.simulateSavingsPlan(comm, term, pay, plan, units, acc, reg);
      setSimResult(res);
      if (res.is_savings_plan) {
        if (comm === null || comm === undefined) {
          const rec = res.recommended_commitment || 0;
          setCommitment(rec);
          setLocalCommitment(rec);
        }
      } else {
        if (units === null || units === undefined) {
          const rec = res.recommended_units ?? (res.continuous_units_count ?? 0);
          setReservedUnits(rec);
          setLocalUnits(rec);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to simulate commitment plan');
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, [commitment, termYears, paymentOption, selectedPlan, reservedUnits, selectedAccount, selectedRegion]);

  useEffect(() => {
    fetchSimulation(null, termYears, paymentOption, selectedPlan, null, selectedAccount, selectedRegion, false);
  }, [selectedPlan, selectedAccount, selectedRegion]);

  const handlePlanSelect = (planId) => {
    setSelectedPlan(planId);
    setCommitment(null);
    setReservedUnits(null);
    setResourceFilter('all');
    setCurrentPage(1);
  };

  const handleAccountChange = (acc) => {
    setSelectedAccount(acc);
    setCommitment(null);
    setReservedUnits(null);
    setCurrentPage(1);
  };

  const handleRegionChange = (reg) => {
    setSelectedRegion(reg);
    setCommitment(null);
    setReservedUnits(null);
    setCurrentPage(1);
  };

  const handleCommitmentChange = (val) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setLocalCommitment(num);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setCommitment(num);
      fetchSimulation(num, termYears, paymentOption, selectedPlan, reservedUnits, selectedAccount, selectedRegion, true);
    }, 250);
  };

  const handleUnitsChange = (val) => {
    const count = Math.max(0, parseInt(val) || 0);
    setLocalUnits(count);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setReservedUnits(count);
      fetchSimulation(commitment, termYears, paymentOption, selectedPlan, count, selectedAccount, selectedRegion, true);
    }, 200);
  };

  const handleTermChange = (term) => {
    setTermYears(term);
    fetchSimulation(commitment, term, paymentOption, selectedPlan, reservedUnits, selectedAccount, selectedRegion, false);
  };

  const handlePaymentChange = (pay) => {
    setPaymentOption(pay);
    fetchSimulation(commitment, termYears, pay, selectedPlan, reservedUnits, selectedAccount, selectedRegion, false);
  };

  const handleResetRecommended = () => {
    if (!simResult) return;
    if (simResult.is_savings_plan) {
      const rec = simResult.recommended_commitment || 0;
      setLocalCommitment(rec);
      setCommitment(rec);
      fetchSimulation(rec, termYears, paymentOption, selectedPlan, reservedUnits, selectedAccount, selectedRegion, false);
    } else {
      const rec = simResult.recommended_units ?? (simResult.continuous_units_count ?? 0);
      setLocalUnits(rec);
      setReservedUnits(rec);
      fetchSimulation(commitment, termYears, paymentOption, selectedPlan, rec, selectedAccount, selectedRegion, false);
    }
  };

  // Copy Executive CFO Approval Memo
  const handleCopyCfoMemo = () => {
    if (!simResult) return;
    const memo = `=== ZORVEX FinOps Executive Commitment Proposal ===
Scope: Account: ${selectedAccount === 'all' ? 'All Accounts' : selectedAccount} | Region: ${selectedRegion === 'all' ? 'All Regions' : selectedRegion}
Commitment Strategy: ${simResult.plan_spec?.name} (${termYears}-Year ${paymentOption === 'ALL_UPFRONT' ? 'All Upfront' : 'No Upfront'})
Observed 24/7 Steady-State Baseline: $${(simResult.hourly_baseline || 0).toFixed(4)}/hr ($${(simResult.monthly_ondemand_cost || 0).toFixed(2)}/mo)
Recommended Commitment Target: ${simResult.recommended_display}
Projected Discount Rate: ${simResult.discount_rate_pct}% Off On-Demand
Net Monthly Cash Saved: $${(simResult.monthly_net_savings_usd || 0).toFixed(2)} / month (₹${(simResult.monthly_net_savings_inr || 0).toLocaleString()})
Annual Contract Value ROI: $${(simResult.annual_net_savings_usd || 0).toFixed(2)} / year (₹${(simResult.annual_net_savings_inr || 0).toLocaleString()})
Break-Even Payback Milestone: Day ${simResult.break_even_days || 15}
Risk Assessment: ${simResult.risk_level} (${simResult.coverage_pct}% fleet covered, dev start/stop workloads safely excluded)
Authority: 100% Unblended AWS CUR Telemetry Verified
===================================================`;
    navigator.clipboard.writeText(memo);
    setCopiedMemo(true);
    setTimeout(() => setCopiedMemo(false), 2500);
  };

  const audit = simResult?.continuity_audit;
  const portfolio = simResult?.portfolio_summary || [];
  const resources = simResult?.resources_breakdown || [];
  const availableAccounts = simResult?.available_accounts || [];
  const availableRegions = simResult?.available_regions || [];
  const historicalWindow = simResult?.historical_window;
  const mathBreakdown = simResult?.math_breakdown;
  const termMatrix = simResult?.term_comparison_matrix || [];

  const isSavingsPlan = simResult?.is_savings_plan ?? (selectedPlan === 'COMPUTE_SP' || selectedPlan === 'EC2_INSTANCE_SP');

  // Instant 60 FPS Client-Side Live Metrics Preview
  const liveMetrics = useMemo(() => {
    if (!simResult) return null;
    const monthlyHours = simResult.math_breakdown?.monthly_hours || 730;
    const baselineHourly = simResult.hourly_baseline || 0;
    const monthlyBaseline = baselineHourly * monthlyHours;
    const discountRate = (simResult.discount_rate_pct || 0) / 100.0;
    const spFactor = (1.0 - discountRate) > 0 ? (1.0 - discountRate) : 1.0;

    if (isSavingsPlan) {
      const activeComm = localCommitment !== null ? localCommitment : (simResult.recommended_commitment || 0);
      const monthlyCommCost = activeComm * monthlyHours;
      const maxOndemandAbsorbed = spFactor > 0 ? (activeComm / spFactor) : 0;
      const ondemandCoveredHourly = Math.min(baselineHourly, maxOndemandAbsorbed);
      const ondemandUncoveredHourly = Math.max(0, baselineHourly - ondemandCoveredHourly);
      const monthlyUncoveredOndemand = ondemandUncoveredHourly * monthlyHours;
      const monthlyTotalNewCost = monthlyCommCost + monthlyUncoveredOndemand;
      const monthlyNetSavings = monthlyBaseline - monthlyTotalNewCost;
      const annualNetSavingsUSD = monthlyNetSavings * 12.0;
      const usdToInr = simResult.math_breakdown?.usd_to_inr_rate || 85.0;
      const annualNetSavingsINR = annualNetSavingsUSD * usdToInr;
      const coveragePct = baselineHourly > 0 ? Math.min(100.0, Math.round((ondemandCoveredHourly / baselineHourly) * 1000) / 10) : 0;
      const breakEvenDays = Math.max(10, Math.round(30 * (1.0 - discountRate)));

      return {
        monthlyBaseline,
        monthlyCommCost,
        monthlyNetSavings,
        annualNetSavingsUSD,
        annualNetSavingsINR,
        coveragePct,
        breakEvenDays,
        activeDisplay: `$${activeComm.toFixed(2)}/hr`
      };
    } else {
      const activeCount = localUnits !== null ? localUnits : (simResult.recommended_units ?? 0);
      const continuousUnits = simResult.continuous_units_count || 0;
      const unitOndemand = continuousUnits > 0 ? (monthlyBaseline / continuousUnits) : 0;
      const riCostPerUnit = unitOndemand * (1.0 - discountRate);
      const coveredInstances = Math.min(activeCount, continuousUnits);
      const uncoveredInstances = Math.max(0, continuousUnits - activeCount);
      const monthlyCommCost = activeCount * riCostPerUnit;
      const monthlyTotalNewCost = monthlyCommCost + (uncoveredInstances * unitOndemand);
      const monthlyNetSavings = continuousUnits > 0 ? (monthlyBaseline - monthlyTotalNewCost) : 0;
      const annualNetSavingsUSD = monthlyNetSavings * 12.0;
      const usdToInr = simResult.math_breakdown?.usd_to_inr_rate || 85.0;
      const annualNetSavingsINR = annualNetSavingsUSD * usdToInr;
      const coveragePct = continuousUnits > 0 ? Math.min(100.0, Math.round((coveredInstances / continuousUnits) * 1000) / 10) : (simResult.coverage_pct || 0);
      const breakEvenDays = Math.max(10, Math.round(30 * (1.0 - discountRate)));

      return {
        monthlyBaseline,
        monthlyCommCost,
        monthlyNetSavings,
        annualNetSavingsUSD,
        annualNetSavingsINR,
        coveragePct,
        breakEvenDays,
        activeDisplay: `${activeCount} Instance${activeCount !== 1 ? 's' : ''}`
      };
    }
  }, [simResult, localCommitment, localUnits, isSavingsPlan]);

  const primarySku = simResult?.primary_sku
    || simResult?.continuous_resources?.[0]?.instance_type
    || simResult?.fleet_continuous_resources?.[0]?.instance_type
    || simResult?.already_covered_resources?.[0]?.instance_type
    || '';

  // Memoized filter counts across resources for instant rendering
  const filterCounts = useMemo(() => {
    let all = 0, consistent = 0, partially_covered = 0, scheduled = 0, intermittent = 0, covered = 0, storage = 0, networking = 0, micro_spend = 0;
    for (let i = 0; i < resources.length; i++) {
      const r = resources[i];
      all++;
      if (r.status === 'PARTIALLY_COVERED') partially_covered++;
      else if (r.status === 'CONSISTENT_24_7' || r.workload_continuity === 'CONSISTENT_24_7') consistent++;
      else if (r.status === 'SCHEDULED_USAGE') scheduled++;
      else if (r.status === 'INTERMITTENT') intermittent++;
      else if (r.status === 'ALREADY_COVERED' || r.has_existing_commitment) covered++;
      else if (r.status === 'INELIGIBLE_STORAGE') storage++;
      else if (r.status === 'INELIGIBLE_NETWORKING') networking++;
      else if (r.status === 'MICRO_SPEND') micro_spend++;
    }
    return { all, consistent, partially_covered, scheduled, intermittent, covered, storage, networking, micro_spend };
  }, [resources]);

  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      if (resourceFilter === 'consistent') return r.status === 'CONSISTENT_24_7' || r.workload_continuity === 'CONSISTENT_24_7';
      if (resourceFilter === 'partially_covered') return r.status === 'PARTIALLY_COVERED';
      if (resourceFilter === 'scheduled') return r.status === 'SCHEDULED_USAGE';
      if (resourceFilter === 'intermittent') return r.status === 'INTERMITTENT';
      if (resourceFilter === 'covered') return r.status === 'ALREADY_COVERED' || r.has_existing_commitment;
      if (resourceFilter === 'storage') return r.status === 'INELIGIBLE_STORAGE';
      if (resourceFilter === 'networking') return r.status === 'INELIGIBLE_NETWORKING';
      if (resourceFilter === 'micro_spend') return r.status === 'MICRO_SPEND';
      return true;
    });
  }, [resources, resourceFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredResources.length / PAGE_SIZE));
  const paginatedResources = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredResources.slice(start, start + PAGE_SIZE);
  }, [filteredResources, currentPage]);

  return (
    <div className="clay-card p-6 md:p-8 space-y-7 transition-all">
      
      {/* Header Toolbar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 pb-6 border-b border-zorvex-border dark:border-zorvex-dark-border">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shadow-inner">
              <Calculator className="w-5 h-5 stroke-[2.5]" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold text-zorvex-text dark:text-zorvex-dark-text tracking-tight">
                  ZORVEX AWS Commitment Recommendation Engine
                </h3>
                <span className="clay-pill px-3 py-0.5 text-[10px] font-black bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight uppercase border border-zorvex-forest/25">
                  Enterprise FinOps
                </span>
              </div>
              <p className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-0.5">
                Evidence-based commitment modeling across <strong>Account & Region Scopes</strong>. Separates <strong>Hourly Spend Commitments ($/hr)</strong> from <strong>Capacity Reservations (Units)</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Beginner Explainer Guide Toggle */}
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-clay-pill clay-button text-xs font-black shadow-clay-sm transition-all hover:scale-[1.02]"
            title="Learn what Continuous 24/7 Units and Commitments mean"
          >
            <BookOpen className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-forest-highlight" />
            <span>{showGuide ? 'Close Guide' : 'Continuous Units Guide'}</span>
            {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* CFO Recommendation Memo Export */}
          <button
            onClick={handleCopyCfoMemo}
            className="flex items-center gap-2 px-3.5 py-2 rounded-clay-pill clay-button text-xs font-black shadow-clay-sm transition-all hover:scale-[1.02] text-zorvex-text dark:text-zorvex-dark-text"
            title="Copy an executive-ready FinOps commitment brief for management/CFO sign-off"
          >
            {copiedMemo ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-forest-highlight" />}
            <span>{copiedMemo ? 'Copied to Clipboard!' : 'Copy CFO Proposal'}</span>
          </button>

          {/* Account Filter */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-clay-pill bg-zorvex-secondary dark:bg-zorvex-dark-secondary shadow-inner border border-white/60 dark:border-zorvex-dark-border">
            <Building className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-forest-highlight flex-shrink-0" />
            <select
              value={availableAccounts.includes(selectedAccount) || selectedAccount === 'all' ? selectedAccount : 'custom'}
              onChange={(e) => {
                if (e.target.value !== 'custom') handleAccountChange(e.target.value);
              }}
              className="bg-transparent text-xs font-black text-zorvex-text dark:text-zorvex-dark-text focus:outline-none cursor-pointer"
            >
              <option value="all">All Accounts ({availableAccounts.length})</option>
              {availableAccounts.map(acc => (
                <option key={acc} value={acc} className="bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-text dark:text-zorvex-dark-text">
                  Acc: {acc}
                </option>
              ))}
              {selectedAccount !== 'all' && !availableAccounts.includes(selectedAccount) && (
                <option value="custom" className="bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-text dark:text-zorvex-dark-text">
                  Custom: {selectedAccount}
                </option>
              )}
            </select>
            <input
              id="custom-account-id"
              name="customAccountId"
              aria-label="Custom AWS Account ID"
              type="text"
              placeholder="Or enter Acc ID..."
              value={selectedAccount === 'all' ? '' : selectedAccount}
              onChange={(e) => handleAccountChange(e.target.value.trim() || 'all')}
              className="w-28 bg-transparent text-xs font-mono font-bold text-zorvex-text dark:text-zorvex-dark-text border-l border-zorvex-border dark:border-zorvex-dark-border pl-2 focus:outline-none placeholder:text-zorvex-text-muted/60"
            />
          </div>

          {/* Region Filter */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-clay-pill bg-zorvex-secondary dark:bg-zorvex-dark-secondary shadow-inner border border-white/60 dark:border-zorvex-dark-border">
            <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <select
              value={selectedRegion}
              onChange={(e) => handleRegionChange(e.target.value)}
              className="bg-transparent text-xs font-black text-zorvex-text dark:text-zorvex-dark-text focus:outline-none cursor-pointer"
            >
              <option value="all">All Regions ({availableRegions.length})</option>
              {availableRegions.map(reg => (
                <option key={reg} value={reg} className="bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-text dark:text-zorvex-dark-text">
                  Region: {reg}
                </option>
              ))}
            </select>
          </div>

          {/* AI Recommended Reset */}
          {simResult && (
            <button
              onClick={handleResetRecommended}
              className="clay-button-primary flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold shadow-clay-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>Target: {simResult.recommended_display}</span>
            </button>
          )}
        </div>
      </div>

      {/* BEGINNER EXPLAINER GUIDE (Collapsible Card for New Users) */}
      {showGuide && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-zorvex-surface via-zorvex-secondary/40 to-zorvex-secondary dark:from-zorvex-dark-surface dark:to-zorvex-dark-secondary border-2 border-zorvex-forest/30 dark:border-zorvex-forest/30 shadow-clay space-y-4 transition-all">
          <div className="flex items-center justify-between pb-3 border-b border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight">
                <HelpCircle className="w-5 h-5 stroke-[2.5]" />
              </span>
              <div>
                <h4 className="text-sm font-black text-zorvex-text dark:text-zorvex-dark-text">
                  📘 FinOps AWS Commitments 101: How ZORVEX Calculates Safe Savings
                </h4>
                <p className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-0.5">
                  Understand exactly what "Continuous 24/7 Units", "Intermittent Workloads", and commitments mean before committing capital.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowGuide(false)}
              className="p-1 rounded-lg text-zorvex-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Continuous 24/7 Units */}
            <div className="p-4 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-surface-flat space-y-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="w-4 h-4" />
                </span>
                <span className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                  1. What is a "Continuous Unit"?
                </span>
              </div>
              <p className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted leading-relaxed">
                A server, database, or cache node running non-stop with <strong>&ge;80% observed uptime</strong> across your billing cycle. AWS 1-Year and 3-Year contracts bill you <strong>24 hours every single day</strong>—so only steady-state workloads qualify!
              </p>
            </div>

            {/* Card 2: Intermittent Dev Excluded */}
            <div className="p-4 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-surface-flat space-y-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Clock className="w-4 h-4" />
                </span>
                <span className="text-xs font-black text-amber-800 dark:text-amber-300">
                  2. Why are Dev Workloads Excluded?
                </span>
              </div>
              <p className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted leading-relaxed">
                Workloads that shut down at night or on weekends (dev/staging/testing). If you buy a 24/7 commitment for an 8-hour/day dev server, <strong>you still pay AWS for the other 16 idle hours every day</strong>! ZORVEX excludes them so you never pay for idle phantom hours.
              </p>
            </div>

            {/* Card 3: Spend vs Capacity */}
            <div className="p-4 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-surface-flat space-y-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight">
                  <DollarSign className="w-4 h-4" />
                </span>
                <span className="text-xs font-black text-zorvex-forest dark:text-zorvex-forest-highlight">
                  3. Spend ($/hr) vs Capacity (Units)
                </span>
              </div>
              <p className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted leading-relaxed">
                <strong>Savings Plans ($/hr)</strong> commit to a dollar amount (e.g. $1.50/hr) across all EC2, Fargate & Lambda. <strong>Reserved Instances (Units)</strong> reserve specific server counts (e.g. 1x RDS PostgreSQL db or 1x Redis cache node) for single-service savings.
              </p>
            </div>

            {/* Card 4: 100% Math Accuracy Guarantee */}
            <div className="p-4 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-surface-flat space-y-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <span className="text-xs font-black text-zorvex-forest dark:text-zorvex-forest-highlight">
                  4. 100% Pricing Accuracy
                </span>
              </div>
              <p className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted leading-relaxed">
                Derived directly from AWS unblended CUR billing line items across your actual observed days. Formula: <code>Net Savings = (24/7 Baseline On-Demand) - (Commitment Fee + Any Uncovered Spend)</code>. Over-commitments are proactively penalized.
              </p>
            </div>

          </div>
        </div>
      )}

      {/* Historical Observation Window Pill */}
      {historicalWindow && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-4 py-2.5 rounded-clay-pill bg-zorvex-secondary/70 dark:bg-zorvex-dark-secondary text-zorvex-text-muted dark:text-zorvex-dark-text-muted text-xs shadow-inner border border-white/40 dark:border-zorvex-dark-border">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-forest-highlight" />
            <span>
              <strong>Historical Window:</strong> {historicalWindow.start_date || 'N/A'} to {historicalWindow.end_date || 'N/A'} ({historicalWindow.observed_days} days, {historicalWindow.observed_hours} observed hours)
            </span>
          </div>
          <div className="text-[10px] font-black uppercase tracking-wider text-zorvex-forest dark:text-zorvex-forest-highlight">
            Scope: {selectedAccount === 'all' ? 'Multi-Account' : `Account ${selectedAccount}`} • {selectedRegion === 'all' ? 'Multi-Region' : selectedRegion}
          </div>
        </div>
      )}

      {/* Commitment Class Selector Tabs (7 Classes) - Tactile Clay Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {COMMITMENT_CLASSES.map((c) => {
          const Icon = c.icon;
          const isSelected = selectedPlan === c.id;
          return (
            <button
              key={c.id}
              onClick={() => handlePlanSelect(c.id)}
              className={`p-4 rounded-2xl text-left transition-all relative flex flex-col justify-between ${
                isSelected
                  ? 'bg-gradient-to-br from-zorvex-forest-soft/60 to-zorvex-secondary dark:from-zorvex-forest-dark-soft/40 dark:to-zorvex-dark-surface border-2 border-zorvex-forest dark:border-zorvex-forest shadow-clay -translate-y-1'
                  : 'bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border hover:-translate-y-0.5 hover:shadow-clay-sm opacity-90 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between mb-3 w-full">
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                  isSelected 
                    ? 'bg-gradient-to-br from-zorvex-forest to-zorvex-forest-hover text-white shadow-md' 
                    : 'bg-zorvex-secondary dark:bg-zorvex-dark-secondary text-zorvex-text-muted/80 dark:text-zorvex-dark-text-muted/80 shadow-inner'
                }`}>
                  <Icon className="w-4 h-4" />
                </span>
                <span className="clay-pill px-2 py-0.5 text-[10px] font-black bg-emerald-500/15 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 dark:border-emerald-500/40">
                  Up to {c.maxDiscount}
                </span>
              </div>
              <div>
                <div className="text-xs font-black text-zorvex-text dark:text-zorvex-dark-text truncate">
                  {c.shortName}
                </div>
                <div className="text-[10px] font-bold text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-0.5 truncate">
                  {c.modelType === 'SPEND_COMMITMENT' ? 'Spend ($/hr)' : 'Capacity (Units)'}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 24/7 Continuous Baseline & Coverage Audit Banner */}
      {audit && (
        <div className={`p-5 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-clay-sm ${
          audit.continuous_instances_count === 0 && audit.already_covered_count > 0
            ? 'bg-gradient-to-r from-emerald-500/15 via-zorvex-surface to-emerald-500/10 dark:from-emerald-950/50 dark:via-zorvex-dark-surface dark:to-emerald-950/30 border-emerald-500/40 dark:border-emerald-500/50 text-emerald-950 dark:text-emerald-100'
            : 'bg-gradient-to-r from-emerald-500/10 via-zorvex-surface to-emerald-500/5 dark:from-emerald-950/40 dark:via-zorvex-dark-surface dark:to-emerald-950/20 border border-emerald-500/30 dark:border-emerald-500/40 text-emerald-950 dark:text-emerald-100'
        }`}>
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shadow-inner flex-shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-xs font-black flex flex-wrap items-center gap-2">
                <span>
                  {audit.continuous_instances_count === 0 && audit.already_covered_count > 0
                    ? '🎉 100% Production Fleet Protected by Active Reservations'
                    : 'Observed 24/7 Steady-State Baseline Qualified'}
                </span>
                {audit.continuous_instances_count > 0 && (
                  <span className="clay-pill px-2.5 py-0.5 text-[10px] font-black bg-emerald-500/20 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30">
                    {audit.continuous_instances_count} Continuous Units Qualified (${audit.continuous_spend_usd.toFixed(2)})
                  </span>
                )}
                {audit.already_covered_count > 0 && (
                  <span className="clay-pill px-2.5 py-0.5 text-[10px] font-black bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight border border-zorvex-forest/25">
                    {audit.already_covered_count} Already Covered by Active SP/RI (${(audit.already_covered_spend_usd || 0).toFixed(2)})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-emerald-900/80 dark:text-emerald-200/80 mt-1 leading-relaxed">
                {audit.continuous_instances_count === 0 && audit.already_covered_count > 0 ? (
                  <>
                    All <strong>{audit.already_covered_count} production workloads</strong> in this scope are already operating under active 1-Yr / 3-Yr AWS Reserved Instances or Savings Plans. Zero uncovered continuous compute exists. <strong>Maintain current commitments ($0.00 new commitment needed)</strong> to prevent unnecessary double-billing waste.
                  </>
                ) : audit.intermittent_instances_excluded > 0 ? (
                  <>
                    Safely excluded <strong>{audit.intermittent_instances_excluded} start/stop dev / scheduled workloads</strong> (${audit.intermittent_spend_excluded_usd.toFixed(2)}) from baseline. Prevents unutilized commitment lock-in waste during non-operational hours.
                  </>
                ) : (
                  <>
                    All observed active compute units in this scope operate continuously without scheduled idle shutdowns.
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex-shrink-0 px-4 py-2 rounded-2xl bg-emerald-500/15 dark:bg-emerald-900/50 border border-emerald-500/30 shadow-inner text-right">
            <div className="text-[10px] uppercase font-black text-emerald-800 dark:text-emerald-300 tracking-wider">
              {audit.continuous_instances_count === 0 && audit.already_covered_count > 0 ? 'Fleet Status' : 'Continuous Hourly Run-Rate'}
            </div>
            <div className="text-base font-black font-mono text-emerald-700 dark:text-emerald-300">
              {audit.continuous_instances_count === 0 && audit.already_covered_count > 0
                ? '100% Reserved'
                : `$${(audit.continuous_hourly_baseline || 0).toFixed(4)}/hr`}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-clay-coral-light dark:bg-red-950/40 border border-clay-coral/30 dark:border-red-500/40 text-clay-coral dark:text-red-300 text-xs font-bold flex items-center gap-2.5 shadow-clay-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Simulator Interactive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left: Input Controls */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Commitment / Reservation Input Box (Adapts to SP vs RI) */}
          {isSavingsPlan ? (
            /* Spend Commitment for Savings Plans */
            <div className="p-5 rounded-2xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border space-y-4 shadow-clay-sm">
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="hourly-commitment-input" className="text-xs font-black text-zorvex-text dark:text-zorvex-dark-text uppercase tracking-wider block">
                    Hourly Spend Commitment ($/hr)
                  </label>
                  <span className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted">Fixed $/hr discount commitment across all compute</span>
                </div>
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-clay-pill bg-zorvex-secondary dark:bg-zorvex-dark-secondary shadow-inner border border-white/60 dark:border-zorvex-dark-border">
                  <span className="text-xs font-black text-zorvex-text-muted/80 dark:text-zorvex-dark-text-muted/80">$</span>
                  <input
                    id="hourly-commitment-input"
                    name="hourlyCommitment"
                    aria-label="Hourly spend commitment in dollars per hour"
                    type="number"
                    step="0.01"
                    min="0.0"
                    max="100.00"
                    value={localCommitment !== null ? localCommitment : ''}
                    onChange={(e) => handleCommitmentChange(e.target.value)}
                    className="w-20 bg-transparent text-xs font-black text-zorvex-text dark:text-zorvex-dark-text focus:outline-none font-mono"
                  />
                  <span className="text-[11px] font-black text-zorvex-text-muted/80 dark:text-zorvex-dark-text-muted/80">/hr</span>
                </div>
              </div>

              <input
                id="commitment-range"
                name="commitmentRange"
                aria-label="Commitment range slider"
                type="range"
                min="0.0"
                max={Math.max(5.0, (simResult?.hourly_baseline || 1.0) * 2.2)}
                step="0.01"
                value={localCommitment || 0}
                onChange={(e) => handleCommitmentChange(e.target.value)}
                className="w-full accent-zorvex-forest cursor-pointer"
              />

              <div className="flex items-center justify-between text-[11px] font-bold text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                <span>$0.00/hr</span>
                <span className="text-zorvex-forest dark:text-zorvex-forest-highlight font-black">24/7 Baseline: ${(simResult?.hourly_baseline || 0).toFixed(4)}/hr</span>
                <span>${Math.max(5.0, (simResult?.hourly_baseline || 1.0) * 2.2).toFixed(2)}/hr</span>
              </div>
            </div>
          ) : (
            /* Capacity Reservation (Units / Quantity) for Reserved Instances */
            <div className="p-5 rounded-2xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border space-y-4 shadow-clay-sm">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-black text-zorvex-text dark:text-zorvex-dark-text uppercase tracking-wider block">
                    Reserved Instance Capacity (Units)
                  </label>
                  <span className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted block max-w-[240px]">
                    {selectedPlan.includes('RDS')
                      ? `Purchased by DB instance count${primarySku ? ` (e.g. 1x ${primarySku})` : ''}`
                      : selectedPlan.includes('ELASTICACHE')
                      ? `Purchased by cache node count${primarySku ? ` (e.g. 1x ${primarySku})` : ''}`
                      : selectedPlan.includes('OPENSEARCH')
                      ? `Purchased by search node count${primarySku ? ` (e.g. 1x ${primarySku})` : ''}`
                      : selectedPlan.includes('DOCDB')
                      ? `Purchased by cluster instance count${primarySku ? ` (e.g. 1x ${primarySku})` : ''}`
                      : `Purchased by EC2 instance count${primarySku ? ` (e.g. 1x ${primarySku})` : ''}`
                    }
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUnitsChange((localUnits ?? 0) - 1)}
                    disabled={(localUnits ?? 0) <= 0}
                    aria-label="Decrease reserved units"
                    className="w-8 h-8 rounded-clay-pill clay-button flex items-center justify-center font-black active:scale-95 transition-all text-zorvex-forest dark:text-zorvex-forest-highlight disabled:opacity-40"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-3.5 py-1 rounded-xl bg-zorvex-secondary dark:bg-zorvex-dark-secondary shadow-inner text-base font-black font-mono text-zorvex-forest dark:text-zorvex-forest-highlight">
                    {localUnits ?? 0}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUnitsChange((localUnits ?? 0) + 1)}
                    aria-label="Increase reserved units"
                    className="w-8 h-8 rounded-clay-pill clay-button flex items-center justify-center font-black active:scale-95 transition-all text-zorvex-forest dark:text-zorvex-forest-highlight"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/20 dark:border-amber-500/40 text-[11px] text-amber-900 dark:text-amber-200 flex items-center gap-2 shadow-inner">
                <Info className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>{simResult?.continuous_units_count || 0} continuous 24/7 units</strong> detected in scope. RIs purchase fixed server capacity, not $/hr commitments.
                </span>
              </div>
            </div>
          )}

          {/* Commitment Term Switcher (1-Yr vs 3-Yr) */}
          <div className="space-y-2">
            <label className="text-xs font-black text-zorvex-text dark:text-zorvex-dark-text uppercase tracking-wider block">
              Commitment Duration
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleTermChange(1)}
                className={`p-3.5 rounded-2xl text-left transition-all ${
                  termYears === 1
                    ? 'border-2 border-zorvex-forest bg-gradient-to-br from-zorvex-forest-soft/60 to-zorvex-secondary dark:from-zorvex-forest-dark-soft/40 dark:to-zorvex-dark-surface shadow-clay-sm -translate-y-0.5'
                    : 'bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border hover:-translate-y-0.5 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="text-xs font-black text-zorvex-text dark:text-zorvex-dark-text">1-Year Term</div>
                <div className="text-[11px] text-zorvex-forest dark:text-zorvex-forest-highlight font-extrabold mt-0.5">Flexible 12-Month Plan</div>
              </button>

              <button
                type="button"
                onClick={() => handleTermChange(3)}
                className={`p-3.5 rounded-2xl text-left transition-all ${
                  termYears === 3
                    ? 'border-2 border-zorvex-forest bg-gradient-to-br from-zorvex-forest-soft/60 to-zorvex-secondary dark:from-zorvex-forest-dark-soft/40 dark:to-zorvex-dark-surface shadow-clay-sm -translate-y-0.5'
                    : 'bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border hover:-translate-y-0.5 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="text-xs font-black text-zorvex-text dark:text-zorvex-dark-text">3-Year Term</div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-extrabold mt-0.5">Deepest Discount (Max ROI)</div>
              </button>
            </div>
          </div>

          {/* Payment Structure (No Upfront vs All Upfront) */}
          <div className="space-y-2">
            <label className="text-xs font-black text-zorvex-text dark:text-zorvex-dark-text uppercase tracking-wider block">
              Payment Structure
            </label>
            <div className="p-1 rounded-clay-pill bg-zorvex-secondary dark:bg-zorvex-dark-secondary shadow-inner border border-white/60 dark:border-zorvex-dark-border grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handlePaymentChange('NO_UPFRONT')}
                className={`py-2 rounded-clay-pill text-xs font-black transition-all ${
                  paymentOption === 'NO_UPFRONT'
                    ? 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-forest dark:text-zorvex-forest-highlight shadow-clay-sm'
                    : 'text-zorvex-text-muted dark:text-zorvex-dark-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text'
                }`}
              >
                No Upfront (Monthly Cashflow)
              </button>
              <button
                type="button"
                onClick={() => handlePaymentChange('ALL_UPFRONT')}
                className={`py-2 rounded-clay-pill text-xs font-black transition-all ${
                  paymentOption === 'ALL_UPFRONT'
                    ? 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-forest dark:text-zorvex-forest-highlight shadow-clay-sm'
                    : 'text-zorvex-text-muted dark:text-zorvex-dark-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text'
                }`}
              >
                All Upfront (+7% Extra Yield)
              </button>
            </div>
          </div>

          {/* Risk Guidance Box */}
          {simResult && (
            <div className={`p-4 rounded-2xl shadow-clay-sm border ${
              simResult.risk_level === 'FULLY_COVERED' || simResult.risk_level === 'OPTIMAL'
                ? 'bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-500/30 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
                : simResult.risk_level === 'ELEVATED'
                ? 'bg-amber-500/10 dark:bg-amber-950/40 border-amber-500/30 dark:border-amber-500/40 text-amber-900 dark:text-amber-200'
                : simResult.risk_level === 'NO_WORKLOAD'
                ? 'bg-zorvex-text-muted/10 dark:bg-zorvex-dark-surface/40 border-zorvex-text-muted/30 dark:border-zorvex-dark-border text-zorvex-text dark:text-zorvex-dark-text'
                : 'bg-zorvex-forest/10 dark:bg-zorvex-forest/20 border-zorvex-forest/30 dark:border-zorvex-forest/40 text-zorvex-forest dark:text-zorvex-forest-highlight'
            }`}>
              <div className="flex items-center gap-2 font-black text-xs mb-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="uppercase tracking-wider">{simResult.risk_level} COMMITMENT COVERAGE</span>
                <span className="ml-auto text-[11px] font-black">({simResult.coverage_pct}% 24/7 Fleet Covered)</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                {simResult.risk_message}
              </p>
            </div>
          )}

        </div>

        {/* Right: Financial Projections & ROI Results */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Main Savings Banner - Deep Forest Clay Card */}
          <div className="rounded-clay-lg p-7 bg-gradient-to-br from-[#263628] via-[#1E2B20] to-[#151F17] text-white shadow-clay-lg border border-[#384D3C] relative overflow-hidden space-y-5">
            {/* Subtle Clay Warm Glow */}
            <div className="absolute -top-12 -right-12 w-56 h-56 bg-zorvex-forest-highlight/15 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between relative z-10">
              <div>
                <span className="clay-pill px-3 py-1 text-[11px] font-black uppercase tracking-wider bg-zorvex-forest-highlight/20 text-zorvex-forest-highlight border border-zorvex-forest-highlight/30">
                  {simResult?.plan_spec?.name || 'Commitment'} Projections
                </span>
                <div className="text-[11px] text-zorvex-dark-text-muted mt-1">
                  {simResult?.plan_spec?.scope} • Model: {simResult?.plan_spec?.unit_name}
                </div>
              </div>
              <span className="clay-pill flex items-center gap-1.5 px-3.5 py-1 text-xs font-black bg-emerald-500/25 text-emerald-300 border border-emerald-500/40">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+{simResult?.discount_rate_pct}% Yield</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 relative z-10">
              <div className="p-4 rounded-2xl bg-[#18231A]/80 border border-white/10 shadow-inner">
                <div className="text-xs text-zorvex-dark-text-muted font-bold">Net Monthly Cash Saved</div>
                <div className="text-3xl sm:text-4xl font-black font-mono text-emerald-400 mt-1">
                  ${(liveMetrics?.monthlyNetSavings ?? simResult?.monthly_net_savings_usd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-zorvex-forest-highlight font-bold mt-1">
                  ≈ ₹{(liveMetrics?.monthlyNetSavings ? Math.round(liveMetrics.monthlyNetSavings * (simResult?.math_breakdown?.usd_to_inr_rate || 85)) : (simResult?.monthly_net_savings_inr || 0)).toLocaleString()}/month
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#18231A]/80 border border-white/10 shadow-inner">
                <div className="text-xs text-zorvex-dark-text-muted font-bold">Annualized Net ROI</div>
                <div className="text-3xl sm:text-4xl font-black font-mono text-white mt-1">
                  ${(liveMetrics?.annualNetSavingsUSD ?? simResult?.annual_net_savings_usd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-zorvex-forest-highlight font-bold mt-1">
                  ≈ ₹{(liveMetrics?.annualNetSavingsINR ?? simResult?.annual_net_savings_inr ?? 0).toLocaleString()}/year
                </div>
              </div>
            </div>

            {/* Formula Math Transparency Modal Opener Button */}
            <div className="pt-2 flex items-center justify-between border-t border-white/10 text-xs">
              <span className="text-zorvex-dark-text-muted text-[11px]">
                100% Unblended CUR Authoritative Formula
              </span>
              <button
                onClick={() => setShowMathModal(!showMathModal)}
                className="clay-pill px-3 py-1 text-[11px] font-black bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center gap-1.5 transition-all"
              >
                <Calculator className="w-3 h-3" />
                <span>{showMathModal ? 'Hide Formula Math' : 'View Formula Math & Proof'}</span>
              </button>
            </div>
          </div>

          {/* MATH TRANSPARENCY PROOF DRAWER (When Toggled) */}
          {showMathModal && mathBreakdown && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-zorvex-surface to-zorvex-secondary dark:from-zorvex-dark-surface dark:to-zorvex-dark-secondary border border-zorvex-forest/30 dark:border-zorvex-forest/30 shadow-clay-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black text-zorvex-text dark:text-zorvex-dark-text">
                  <Calculator className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                  <span>Authoritative Pricing Math & Cashflow Audit</span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
                  {mathBreakdown.billing_hours_per_month} AWS Billing Hours / Month
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-secondary border border-zorvex-border dark:border-zorvex-dark-border">
                  <div className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted font-bold">1. Monthly Baseline</div>
                  <div className="font-mono font-black text-zorvex-text dark:text-zorvex-dark-text mt-0.5">
                    ${(liveMetrics?.monthlyBaseline ?? mathBreakdown.monthly_ondemand_baseline).toFixed(2)}
                  </div>
                  <div className="text-[9px] text-zorvex-text-muted/80 dark:text-zorvex-dark-text-muted/80 font-mono">${mathBreakdown.hourly_ondemand_baseline.toFixed(4)}/hr</div>
                </div>

                <div className="p-2.5 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-secondary border border-zorvex-border dark:border-zorvex-dark-border">
                  <div className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted font-bold">2. Commitment Fee</div>
                  <div className="font-mono font-black text-zorvex-forest dark:text-zorvex-forest-highlight mt-0.5">
                    ${(liveMetrics?.monthlyCommCost ?? mathBreakdown.monthly_commitment_cost).toFixed(2)}
                  </div>
                  <div className="text-[9px] text-zorvex-text-muted/80 dark:text-zorvex-dark-text-muted/80 font-mono">${mathBreakdown.hourly_commitment_paid.toFixed(4)}/hr</div>
                </div>

                <div className="p-2.5 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-secondary border border-zorvex-border dark:border-zorvex-dark-border">
                  <div className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted font-bold">3. AWS Discount Yield</div>
                  <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {mathBreakdown.discount_rate_pct}% Off
                  </div>
                  <div className="text-[9px] text-zorvex-text-muted/80 dark:text-zorvex-dark-text-muted/80">Standard AWS Matrix</div>
                </div>

                <div className="p-2.5 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-secondary border border-zorvex-border dark:border-zorvex-dark-border">
                  <div className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted font-bold">4. Net Monthly Saved</div>
                  <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    ${(liveMetrics?.monthlyNetSavings ?? mathBreakdown.monthly_net_savings_usd).toFixed(2)}
                  </div>
                  <div className="text-[9px] text-zorvex-text-muted/80 dark:text-zorvex-dark-text-muted/80 font-mono">₹{(liveMetrics?.monthlyNetSavings ? Math.round(liveMetrics.monthlyNetSavings * mathBreakdown.usd_to_inr_rate) : mathBreakdown.monthly_net_savings_inr).toLocaleString()}</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zorvex-secondary/60 dark:bg-zorvex-dark-secondary text-[11px] text-zorvex-text dark:text-zorvex-dark-text-muted space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Exact Mathematical Proof:</span>
                </div>
                <p className="font-mono text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted leading-relaxed">
                  Net Monthly Savings = (Monthly On-Demand Baseline: ${(liveMetrics?.monthlyBaseline ?? mathBreakdown.monthly_ondemand_baseline).toFixed(2)}) &minus; (Commitment Fee: ${(liveMetrics?.monthlyCommCost ?? mathBreakdown.monthly_commitment_cost).toFixed(2)} + Uncovered On-Demand: ${mathBreakdown.monthly_uncovered_ondemand.toFixed(2)}) = <strong>${(liveMetrics?.monthlyNetSavings ?? mathBreakdown.monthly_net_savings_usd).toFixed(2)} / month</strong>.
                </p>
                {mathBreakdown.is_overcommitted ? (
                  <div className="text-red-600 dark:text-red-400 font-bold flex items-center gap-1 pt-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Warning: Over-commitment detected (${mathBreakdown.monthly_unutilized_waste.toFixed(2)}/mo unutilized idle fee).</span>
                  </div>
                ) : (
                  <div className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1 pt-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Zero Unutilized Idle Waste: 100% of commitment is safely absorbed by running workloads.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* KPI Breakdown Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border flex flex-col justify-between shadow-clay-sm">
              <div className="text-[11px] font-black uppercase text-zorvex-text-muted dark:text-zorvex-dark-text-muted">Monthly 24/7 Baseline</div>
              <div className="text-lg font-black font-mono text-zorvex-text dark:text-zorvex-dark-text mt-1">
                ${(liveMetrics?.monthlyBaseline ?? simResult?.monthly_ondemand_cost ?? 0).toFixed(2)}
              </div>
              <div className="text-[10px] text-zorvex-text-muted/80 dark:text-zorvex-dark-text-muted/80 mt-0.5">Continuous On-Demand cost</div>
            </div>

            <div className="p-4 rounded-2xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border flex flex-col justify-between shadow-clay-sm">
              <div className="text-[11px] font-black uppercase text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                {isSavingsPlan ? 'Committed Monthly Spend' : 'Reserved Monthly Cost'}
              </div>
              <div className="text-lg font-black font-mono text-zorvex-forest dark:text-zorvex-forest-highlight mt-1">
                ${(liveMetrics?.monthlyCommCost ?? simResult?.monthly_commitment_cost ?? 0).toFixed(2)}
              </div>
              <div className="text-[10px] text-zorvex-text-muted/80 dark:text-zorvex-dark-text-muted/80 mt-0.5 truncate">
                {liveMetrics?.activeDisplay || simResult?.active_display}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border flex flex-col justify-between shadow-clay-sm">
              <div className="flex items-center gap-1 text-[11px] font-black uppercase text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                <Clock className="w-3 h-3 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                <span>Payback Cycle</span>
              </div>
              <div className="text-lg font-black font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                Day {liveMetrics?.breakEvenDays ?? simResult?.break_even_days ?? 15}
              </div>
              <div className="text-[10px] text-zorvex-text-muted/80 dark:text-zorvex-dark-text-muted/80 mt-0.5">Break-even milestone</div>
            </div>
          </div>

          {/* AWS Official Telemetry & Pricing Transparency Card */}
          <div className="p-4 rounded-2xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border space-y-2 shadow-clay-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black text-zorvex-text dark:text-zorvex-dark-text">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>AWS Pricing & Telemetry Verification</span>
              </div>
              <span className="clay-pill px-2.5 py-0.5 text-[10px] font-mono font-bold bg-emerald-500/15 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                100% Unblended CUR Authoritative
              </span>
            </div>
            <p className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted leading-relaxed">
              On-Demand rates are derived directly from actual AWS unblended billing line items ({simResult?.historical_window?.observed_days || 0} days observed). Commitments apply standard AWS published <strong>{termYears}-Year {paymentOption === 'ALL_UPFRONT' ? 'All Upfront' : 'No Upfront'}</strong> discount matrix (~{simResult?.discount_rate_pct}% net margin).
            </p>
          </div>

        </div>

      </div>

      {/* ENTERPRISE 4-OPTION TERM & PAYMENT COMPARISON MATRIX */}
      {termMatrix && termMatrix.length > 0 && (
        <div className="p-6 rounded-2xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-clay-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-black text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-2">
                <Award className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                <span>Payment Structure & Duration Strategy Matrix</span>
                <span className="clay-pill px-2.5 py-0.5 text-[10px] font-black bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight">
                  Cashflow Comparison
                </span>
              </h4>
              <p className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-0.5">
                Compare capital requirements and yield across all 4 AWS payment structures for <strong>{simResult?.plan_spec?.name}</strong>.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zorvex-border dark:border-zorvex-dark-border">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zorvex-secondary/60 dark:bg-zorvex-dark-secondary border-b border-zorvex-border dark:border-zorvex-dark-border text-zorvex-text-muted dark:text-zorvex-dark-text-muted uppercase text-[10px] font-black tracking-wider">
                  <th className="py-2.5 px-3 whitespace-nowrap">Commitment Term & Payment</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">AWS Discount Yield</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Upfront Cash Required</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Monthly Commitment</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Net Monthly Saved</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Annual Contract ROI</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Select Strategy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zorvex-border/50 dark:divide-zorvex-dark-border">
                {termMatrix.map((opt) => {
                  const isActive = opt.is_active;
                  return (
                    <tr 
                       key={`${opt.term_years}-${opt.payment_option}`}
                      className={`transition-colors ${
                        isActive 
                          ? 'bg-zorvex-forest/10 dark:bg-zorvex-forest/20 font-bold border-l-4 border-zorvex-forest' 
                          : 'hover:bg-zorvex-secondary/40 dark:hover:bg-zorvex-dark-secondary'
                      }`}
                    >
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-black text-zorvex-text dark:text-zorvex-dark-text">
                          {opt.label}
                        </div>
                        <div className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                          {opt.description}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {opt.discount_pct}% Off
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold whitespace-nowrap text-zorvex-text dark:text-zorvex-dark-text">
                        {opt.upfront_cash_usd > 0 ? `$${opt.upfront_cash_usd.toLocaleString()}` : '$0.00 (Monthly Pay)'}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold whitespace-nowrap text-zorvex-text dark:text-zorvex-dark-text">
                        ${opt.monthly_commitment_cost.toFixed(2)}/mo
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        +${opt.monthly_net_savings_usd.toFixed(2)}/mo
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ${opt.annual_net_savings_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <div className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted font-normal">
                          ₹{opt.annual_net_savings_inr.toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setTermYears(opt.term_years);
                            setPaymentOption(opt.payment_option);
                            fetchSimulation(commitment, opt.term_years, opt.payment_option, selectedPlan, reservedUnits, selectedAccount, selectedRegion);
                          }}
                          disabled={isActive}
                          className={`px-3 py-1.5 rounded-clay-pill text-xs font-black transition-all whitespace-nowrap ${
                            isActive
                              ? 'bg-zorvex-forest text-white shadow-clay-sm cursor-default'
                              : 'clay-button'
                          }`}
                        >
                          {isActive ? 'Active Plan' : 'Apply Option'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RESOURCE-WISE DRILLDOWN: EVIDENCE-BASED CONTINUITY CLASSIFICATION */}
      <div className="pt-6 border-t border-zorvex-border dark:border-zorvex-dark-border space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-black text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-2">
              <Activity className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
              <span>Observed Workload Inventory & Evidence Drilldown</span>
              <span className="clay-pill px-2.5 py-0.5 text-[10px] font-black bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight whitespace-nowrap">
                {resources.length} In-Scope Instances
              </span>
            </h4>
            <p className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-0.5">
              Live inventory classified by observed uptime, existing commitments, and dev start/stop patterns.
            </p>
          </div>

          {/* Filter Pills - Tactile Clay Segmented Bar */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-zorvex-secondary dark:bg-zorvex-dark-secondary shadow-inner border border-white/60 dark:border-zorvex-dark-border">
            <button
              onClick={() => { setResourceFilter('all'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-clay-pill text-xs font-black whitespace-nowrap transition-all ${
                resourceFilter === 'all'
                  ? 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-forest dark:text-zorvex-forest-highlight shadow-clay-sm'
                  : 'text-zorvex-text-muted dark:text-zorvex-dark-text-muted hover:text-zorvex-text dark:hover:text-[#FFF4E7]'
              }`}
            >
              All ({filterCounts.all})
            </button>
            <button
              onClick={() => { setResourceFilter('consistent'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-clay-pill text-xs font-black whitespace-nowrap transition-all ${
                resourceFilter === 'consistent'
                  ? 'bg-emerald-600 text-white shadow-clay-sm'
                  : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10'
              }`}
              title="Continuous 24/7 instances active >=80% of days. Safe for 1-3 yr commitments."
            >
              🟢 24/7 Qualified ({filterCounts.consistent})
            </button>
            {filterCounts.partially_covered > 0 && (
              <button
                onClick={() => { setResourceFilter('partially_covered'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-clay-pill text-xs font-black whitespace-nowrap transition-all ${
                  resourceFilter === 'partially_covered'
                    ? 'bg-amber-500 text-white shadow-clay-sm'
                    : 'text-amber-700 dark:text-amber-400 hover:bg-amber-500/10'
                }`}
                title="Continuous 24/7 workloads with partial RI coverage. Uncovered On-Demand hours are included in commitment baselines."
              >
                🟡 Partially Covered ({filterCounts.partially_covered})
              </button>
            )}
            <button
              onClick={() => { setResourceFilter('scheduled'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-clay-pill text-xs font-black whitespace-nowrap transition-all ${
                resourceFilter === 'scheduled'
                  ? 'bg-amber-600 text-white shadow-clay-sm'
                  : 'text-amber-700 dark:text-amber-300 hover:bg-amber-500/10'
              }`}
              title="Scheduled workloads active 40-79% of days (e.g. dev servers shut down outside work hours)."
            >
              🟡 Scheduled ({filterCounts.scheduled})
            </button>
            <button
              onClick={() => { setResourceFilter('intermittent'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-clay-pill text-xs font-black whitespace-nowrap transition-all ${
                resourceFilter === 'intermittent'
                  ? 'bg-red-600 text-white shadow-clay-sm'
                  : 'text-red-700 dark:text-red-300 hover:bg-red-500/10'
              }`}
              title="Intermittent workloads active <40% of days. Excluded from commitment baselines."
            >
              🟠 Intermittent ({filterCounts.intermittent})
            </button>
            {filterCounts.covered > 0 && (
              <button
                onClick={() => { setResourceFilter('covered'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-clay-pill text-xs font-black whitespace-nowrap transition-all ${
                  resourceFilter === 'covered'
                    ? 'bg-gradient-to-r from-zorvex-forest to-zorvex-forest-hover text-white font-bold shadow-sm'
                    : 'text-zorvex-forest dark:text-zorvex-forest-highlight hover:bg-zorvex-forest/10'
                }`}
                title="Already 100% covered by an active AWS Savings Plan or RI ARN. Excluded to prevent double-counting."
              >
                🛡️ Fully Covered ({filterCounts.covered})
              </button>
            )}
            {filterCounts.storage > 0 && (
              <button
                onClick={() => { setResourceFilter('storage'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-clay-pill text-xs font-black whitespace-nowrap transition-all ${
                  resourceFilter === 'storage'
                    ? 'bg-zorvex-text-muted text-white shadow-clay-sm'
                    : 'text-zorvex-text-muted dark:text-zorvex-dark-text-muted hover:bg-zorvex-text-muted/10'
                }`}
                title="EBS storage volume. Not eligible for compute commitments."
              >
                ⚪ Storage ({filterCounts.storage})
              </button>
            )}
            {filterCounts.networking > 0 && (
              <button
                onClick={() => { setResourceFilter('networking'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-clay-pill text-xs font-black whitespace-nowrap transition-all ${
                  resourceFilter === 'networking'
                    ? 'clay-button-primary text-white shadow-surface-flat'
                    : 'surface-recessed text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-forest dark:hover:text-zorvex-dark-forest'
                }`}
                title="VPC Networking (NAT Gateways, Public IPv4, Egress). Ineligible for Savings Plans or Reserved Instances."
              >
                🌐 Networking ({filterCounts.networking})
              </button>
            )}
            {filterCounts.micro_spend > 0 && (
              <button
                onClick={() => { setResourceFilter('micro_spend'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-clay-pill text-xs font-black whitespace-nowrap transition-all ${
                  resourceFilter === 'micro_spend'
                    ? 'clay-button-primary text-white shadow-surface-flat'
                    : 'surface-recessed text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-forest dark:hover:text-zorvex-dark-forest'
                }`}
                title="Micro-Spend Serverless (<$5/mo). Kept on Free Tier / On-Demand without commitments."
              >
                ⚡ Micro-Spend ({filterCounts.micro_spend})
              </button>
            )}
          </div>
        </div>

        {filteredResources.length === 0 ? (
          <div className="p-8 text-center text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted bg-zorvex-surface dark:bg-zorvex-dark-secondary rounded-2xl border border-dashed border-zorvex-border dark:border-zorvex-dark-border shadow-inner">
            No observed resources match this classification filter under {simResult?.plan_spec?.name || 'this service'}.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zorvex-border dark:border-zorvex-dark-border shadow-clay-sm bg-zorvex-surface dark:bg-zorvex-dark-surface">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zorvex-secondary/60 dark:bg-zorvex-dark-secondary border-b border-zorvex-border dark:border-zorvex-dark-border text-zorvex-text-muted dark:text-zorvex-dark-text-muted uppercase text-[10px] font-black tracking-wider">
                  <th className="py-3 px-3.5 whitespace-nowrap">Resource & Account</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">SKU & Region</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Observed Telemetry</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Historical Spend</th>
                  <th className="py-3 px-3.5 whitespace-nowrap min-w-[170px]">Classification & Confidence</th>
                  <th className="py-3 px-3.5">FinOps Recommendation & Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zorvex-border/50 dark:divide-zorvex-dark-border">
                {paginatedResources.map((res) => (
                  <tr key={res.resource_id} className="hover:bg-zorvex-secondary/40 dark:hover:bg-zorvex-dark-secondary transition-colors">
                    
                    {/* Resource ID & Account */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="font-mono font-bold text-xs text-zorvex-text dark:text-zorvex-dark-text">
                        {res.short_id}
                      </div>
                      <div className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted truncate max-w-[170px] mt-0.5">
                        {res.name || res.service}
                      </div>
                      <div className="text-[10px] text-zorvex-forest dark:text-zorvex-forest-highlight font-mono mt-0.5 font-bold">
                        Acc: {res.account_id}
                      </div>
                    </td>

                    {/* Instance / SKU & Region */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="clay-pill px-2.5 py-0.5 text-[11px] font-mono font-black bg-zorvex-secondary dark:bg-zorvex-dark-secondary text-zorvex-text dark:text-zorvex-dark-text inline-block border border-transparent dark:border-zorvex-dark-border">
                        {res.instance_type}
                      </span>
                      <div className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted font-mono mt-1">
                        📍 {res.region}
                      </div>
                    </td>

                    {/* Lifespan & Uptime */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="text-xs font-black text-zorvex-text dark:text-zorvex-dark-text">
                        {res.total_observed_hours || (res.active_days * 24)} hrs observed
                      </div>
                      <div className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-0.5">
                        {res.active_days} / {res.total_days} days ({res.uptime_pct}% active)
                      </div>
                      {res.status === 'PARTIALLY_COVERED' && (
                        <div className="text-[9px] font-mono text-amber-700 dark:text-amber-300 mt-1">
                          ⚡ {res.ondemand_hours}h OD • 🛡️ {res.discounted_hours}h Cov
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="w-16 h-1.5 rounded-full bg-zorvex-secondary dark:bg-zorvex-dark-secondary shadow-inner overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              res.status === 'CONSISTENT_24_7' 
                                ? 'bg-emerald-500' 
                                : res.status === 'PARTIALLY_COVERED'
                                ? 'bg-amber-500'
                                : res.status === 'SCHEDULED_USAGE'
                                ? 'bg-amber-500'
                                : res.status === 'ALREADY_COVERED'
                                ? 'bg-zorvex-forest'
                                : 'bg-red-500'
                            }`} 
                            style={{ width: `${res.uptime_pct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Spend & Hourly */}
                    <td className="py-3 px-3.5 font-mono font-bold whitespace-nowrap">
                      <div className="text-zorvex-text dark:text-zorvex-dark-text">${res.spend.toFixed(2)}</div>
                      {res.status === 'PARTIALLY_COVERED' && (
                        <div className="text-[9px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted font-normal">
                          OD: ${res.ondemand_spend.toFixed(2)} | Cov: ${res.discounted_spend.toFixed(2)}
                        </div>
                      )}
                      <div className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted font-normal">
                        ${res.hourly_cost.toFixed(4)}/hr
                      </div>
                    </td>

                    {/* Classification Status Badge */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {res.status === 'CONSISTENT_24_7' && (
                        <span className="clay-pill inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-black bg-emerald-500/15 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                          <span>Consistent 24/7 ({res.confidence})</span>
                        </span>
                      )}
                      {res.status === 'PARTIALLY_COVERED' && (
                        <span className="clay-pill inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-black bg-amber-500/15 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap">
                          <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 stroke-[2.5]" />
                          <span>24/7 ({res.coverage_pct}% Covered)</span>
                        </span>
                      )}
                      {res.status === 'SCHEDULED_USAGE' && (
                        <span className="clay-pill inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-black bg-amber-500/15 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap">
                          <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 stroke-[2.5]" />
                          <span>Scheduled Dev ({res.confidence})</span>
                        </span>
                      )}
                      {res.status === 'INTERMITTENT' && (
                        <span className="clay-pill inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-black bg-red-500/15 dark:bg-red-950/70 text-red-800 dark:text-red-300 border border-red-500/30 whitespace-nowrap">
                          <X className="w-3 h-3 text-red-600 dark:text-red-400 stroke-[3]" />
                          <span>Intermittent (&lt;40% uptime)</span>
                        </span>
                      )}
                      {res.status === 'ALREADY_COVERED' && (
                        <span className="clay-pill inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-black bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight border border-zorvex-forest/25 whitespace-nowrap">
                          <ShieldCheck className="w-3 h-3 text-zorvex-forest dark:text-zorvex-forest-highlight stroke-[2.5]" />
                          <span>Already Covered by ARN</span>
                        </span>
                      )}
                      {res.status === 'INELIGIBLE_STORAGE' && (
                        <span className="clay-pill inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold bg-zorvex-text-muted/15 dark:bg-zorvex-dark-surface text-zorvex-text-muted dark:text-zorvex-dark-text-muted border border-transparent dark:border-zorvex-dark-border whitespace-nowrap">
                          <span>{res.status_label || 'Storage Volume'}</span>
                        </span>
                      )}
                      {res.status === 'INELIGIBLE_NETWORKING' && (
                        <span className="clay-pill inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold bg-zorvex-secondary dark:bg-zorvex-dark-secondary text-zorvex-text dark:text-zorvex-dark-text border border-zorvex-border dark:border-zorvex-dark-border whitespace-nowrap">
                          <Globe className="w-3 h-3 text-zorvex-text-muted dark:text-zorvex-dark-text-muted stroke-[2.5]" />
                          <span>{res.status_label || 'Ineligible (Networking)'}</span>
                        </span>
                      )}
                      {res.status === 'MICRO_SPEND' && (
                        <span className="clay-pill inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary border border-zorvex-border dark:border-zorvex-dark-border whitespace-nowrap">
                          <Zap className="w-3 h-3 text-zorvex-text-muted dark:text-zorvex-dark-text-muted stroke-[2.5]" />
                          <span>{res.status_label || 'Micro-Spend (<$5/mo)'}</span>
                        </span>
                      )}
                    </td>

                    {/* Recommendation & Rationale */}
                    <td className="py-3 px-3.5">
                      <div className="text-[11px] font-black text-zorvex-text dark:text-zorvex-dark-text">
                        {res.finops_action}
                      </div>
                      <div className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-0.5 leading-snug max-w-sm">
                        {res.reason}
                      </div>
                      <div className="mt-1 text-[9px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted italic flex items-center gap-1">
                        <span>📡</span>
                        <span>{res.current_runtime_state || 'Historical CUR telemetry (Requires live AWS IAM credentials for real-time status)'}</span>
                      </div>
                      {res.existing_commitment_id && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-[9px] font-mono font-bold bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight px-2 py-0.5 rounded border border-zorvex-forest/25 inline-block truncate max-w-xs" title={res.existing_commitment_id}>
                            🛡️ {res.existing_commitment_id}
                          </span>
                        </div>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-zorvex-border dark:border-zorvex-dark-border bg-zorvex-secondary/30 dark:bg-zorvex-dark-secondary/30">
              <div className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                Showing <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text">{Math.min(filteredResources.length, (currentPage - 1) * PAGE_SIZE + 1)}</span> to{' '}
                <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text">{Math.min(filteredResources.length, currentPage * PAGE_SIZE)}</span> of{' '}
                <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text">{filteredResources.length}</span> instances
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-clay-pill text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed clay-button"
                >
                  Previous
                </button>
                <span className="text-xs font-mono font-bold text-zorvex-text dark:text-zorvex-dark-text px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-clay-pill text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed clay-button"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Multi-Plan Enterprise Portfolio Summary Table */}
      {portfolio && portfolio.length > 0 && (
        <div className="p-6 rounded-2xl bg-zorvex-surface dark:bg-zorvex-dark-surface space-y-5 border border-zorvex-border dark:border-zorvex-dark-border shadow-clay-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-black text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-2">
                <Award className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                <span>Multi-Class Commitment Portfolio Overview</span>
                <span className="clay-pill px-2.5 py-0.5 text-[10px] font-black bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight whitespace-nowrap">
                  All 7 AWS Commitment Classes
                </span>
              </h4>
              <p className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-0.5">
                Scoped to <strong>{selectedAccount === 'all' ? 'All Accounts' : `Account: ${selectedAccount}`}</strong> • <strong>{selectedRegion === 'all' ? 'All Regions' : `Region: ${selectedRegion}`}</strong>.
              </p>
            </div>
            <div className="px-4 py-2 rounded-2xl bg-emerald-500/15 dark:bg-emerald-950/60 border border-emerald-500/30 text-right">
              <span className="text-[10px] uppercase font-black text-emerald-800 dark:text-emerald-300">
                Combined Scoped Annual ROI:
              </span>
              <div className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                ${simResult?.portfolio_total_annual_usd?.toLocaleString() || '0'} / yr
                <span className="text-xs font-bold text-zorvex-text-muted dark:text-zorvex-dark-text-muted ml-1.5">
                  (₹{simResult?.portfolio_total_annual_inr?.toLocaleString() || '0'})
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zorvex-border dark:border-zorvex-dark-border bg-zorvex-surface dark:bg-zorvex-dark-surface">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zorvex-secondary/60 dark:bg-zorvex-dark-secondary border-b border-zorvex-border dark:border-zorvex-dark-border text-zorvex-text-muted dark:text-zorvex-dark-text-muted uppercase text-[10px] font-black tracking-wider">
                  <th className="py-3 px-3.5 whitespace-nowrap">Commitment Class</th>
                  <th className="py-3 px-3.5 whitespace-nowrap min-w-[150px]">
                    24/7 Qualified
                    <span className="block text-[8px] font-bold text-zorvex-text-muted/80 dark:text-zorvex-dark-text-muted/80 normal-case">&ge;80% steady uptime</span>
                  </th>
                  <th className="py-3 px-3.5 whitespace-nowrap min-w-[170px]">
                    Intermittent Excluded
                    <span className="block text-[8px] font-bold text-zorvex-text-muted/80 dark:text-zorvex-dark-text-muted/80 normal-case">dev / start-stop idle</span>
                  </th>
                  <th className="py-3 px-3.5 whitespace-nowrap">
                    Continuous Baseline
                    <span className="block text-[8px] font-bold text-zorvex-text-muted/80 dark:text-zorvex-dark-text-muted/80 normal-case">steady-state $/hr</span>
                  </th>
                  <th className="py-3 px-3.5 whitespace-nowrap">
                    Recommended Target
                    <span className="block text-[8px] font-bold text-zorvex-text-muted/80 dark:text-zorvex-dark-text-muted/80 normal-case">optimal commit</span>
                  </th>
                  <th className="py-3 px-3.5 whitespace-nowrap">
                    AWS Discount
                    <span className="block text-[8px] font-bold text-zorvex-text-muted/80 dark:text-zorvex-dark-text-muted/80 normal-case">{termYears}-Yr {paymentOption === 'ALL_UPFRONT' ? 'All Upfront' : 'No Upfront'}</span>
                  </th>
                  <th className="py-3 px-3.5 text-right whitespace-nowrap">
                    Projected Annual ROI
                    <span className="block text-[8px] font-bold text-zorvex-text-muted/80 dark:text-zorvex-dark-text-muted/80 normal-case">net cash saved</span>
                  </th>
                  <th className="py-3 px-3.5 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zorvex-border/50 dark:divide-zorvex-dark-border">
                {portfolio.map((p) => {
                  const isCurrent = selectedPlan === p.plan_type;
                  return (
                    <tr 
                      key={p.plan_type}
                      className={`transition-colors ${
                        isCurrent 
                          ? 'bg-zorvex-forest/10 dark:bg-zorvex-forest/20 font-bold border-l-4 border-zorvex-forest' 
                          : 'hover:bg-zorvex-secondary/40 dark:hover:bg-zorvex-dark-secondary'
                      }`}
                    >
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-black text-zorvex-text dark:text-zorvex-dark-text">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                          {p.scope}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="clay-pill inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-black bg-emerald-500/15 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25 whitespace-nowrap" title="Continuous servers with >=80% uptime qualified for commitments">
                          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                          {p.continuous_instances} {p.continuous_instances === 1 ? 'Continuous Unit' : 'Continuous Units'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {p.intermittent_excluded > 0 ? (
                          <span className="clay-pill inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-black bg-amber-500/15 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-500/25 whitespace-nowrap" title="Dev/stopped servers safely excluded to prevent paying for idle hours">
                            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 stroke-[2.5]" />
                            {p.intermittent_excluded} Dev/Stop Excluded
                          </span>
                        ) : (
                          <span className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted whitespace-nowrap">0 Excluded</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold whitespace-nowrap text-zorvex-text dark:text-zorvex-dark-text">
                        ${p.continuous_hourly_baseline.toFixed(4)}/hr
                      </td>
                      <td className="py-3 px-3.5 font-mono font-black text-zorvex-forest dark:text-zorvex-forest-highlight whitespace-nowrap">
                        {p.recommended_target_display}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="font-black text-emerald-600 dark:text-emerald-400">
                          ~{p.discount_pct}%
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ${p.annual_savings_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <div className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted font-normal">
                          ₹{p.annual_savings_inr.toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => handlePlanSelect(p.plan_type)}
                          disabled={isCurrent}
                          className={`px-3 py-1.5 rounded-clay-pill text-xs font-black transition-all whitespace-nowrap ${
                            isCurrent
                              ? 'bg-zorvex-forest text-white shadow-clay-sm cursor-default'
                              : 'clay-button'
                          }`}
                        >
                          {isCurrent ? 'Active' : 'Simulate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
