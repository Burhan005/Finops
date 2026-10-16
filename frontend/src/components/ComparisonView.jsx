import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  ArrowLeftRight, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  CalendarDays, 
  Layers, 
  Rocket, 
  Trash2, 
  Copy, 
  Check, 
  AlertCircle,
  HelpCircle,
  Sparkles,
  Filter,
  ChevronRight,
  ChevronLeft,
  Server,
  Database,
  Info,
  ShieldCheck,
  Zap,
  Activity,
  Clock,
  X,
  Search,
  RefreshCw,
  SlidersHorizontal,
  ArrowUpDown,
  Flame,
  Award,
  AlertTriangle,
  FileText,
  CheckCircle2,
  ExternalLink,
  Eye,
  Globe,
  Shield,
  HardDrive,
  Cpu,
  Camera,
  Network,
  BarChart3,
  CheckCircle,
  Hash
} from 'lucide-react';
import { api } from '../services/api';
import ClayDropdown from './common/ClayDropdown';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Date calculation helpers
function parseISODate(s) {
  if (!s) return new Date();
  const parts = s.split('-');
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

function formatISODate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateStr, days) {
  const d = parseISODate(dateStr);
  d.setDate(d.getDate() + days);
  return formatISODate(d);
}

function getDaysDiff(startStr, endStr) {
  const s = parseISODate(startStr);
  const e = parseISODate(endStr);
  const diffTime = e.getTime() - s.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

function shiftYear(dateStr, years) {
  const d = parseISODate(dateStr);
  d.setFullYear(d.getFullYear() + years);
  return formatISODate(d);
}

// Financial Currency Formatter
function formatMoney(val, showSign = false) {
  if (val === null || val === undefined || isNaN(val)) return '$0.00';
  const num = Number(val);
  const formatted = Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (num < -0.004) return `-$${formatted}`;
  if (num > 0.004 && showSign) return `+$${formatted}`;
  return `$${formatted}`;
}

// Service Icon Resolver
function getServiceIcon(serviceName = '') {
  const s = serviceName.toLowerCase();
  if (s.includes('rds') || s.includes('database')) return Database;
  if (s.includes('ec2') || s.includes('compute') || s.includes('instance')) return Cpu;
  if (s.includes('s3') || s.includes('ebs') || s.includes('storage')) return HardDrive;
  if (s.includes('cloudfront') || s.includes('route 53') || s.includes('dns')) return Globe;
  if (s.includes('waf') || s.includes('guardduty') || s.includes('shield')) return Shield;
  if (s.includes('vpc') || s.includes('network') || s.includes('load')) return Network;
  return Server;
}

export default function ComparisonView({ overview, selectedAccount = 'all', forexData = null }) {
  const dates = useMemo(() => overview?.dates || [], [overview?.dates]);
  const months = useMemo(() => overview?.months || [], [overview?.months]);
  const availableAccounts = useMemo(() => Object.keys(overview?.accounts || {}), [overview?.accounts]);

  // Date Range Presets:
  // 'yesterday' | '7d' | '30d' | 'mtd' | 'prev_month' | 'custom'
  const [datePreset, setDatePreset] = useState('yesterday');

  // Comparison Options:
  // 'prev_equivalent' | 'same_period_last_year' | 'no_comparison' | 'custom_baseline'
  const [comparisonType, setComparisonType] = useState('prev_equivalent');

  // Custom Target Range
  const defaultTargetDay = dates.length > 0 ? dates[dates.length - 1] : '';
  const defaultBaseDay = dates.length > 1 ? dates[dates.length - 2] : (dates[0] || '');
  const [customTargetStart, setCustomTargetStart] = useState(defaultTargetDay);
  const [customTargetEnd, setCustomTargetEnd] = useState(defaultTargetDay);

  // Custom Baseline Range
  const [customBaseStart, setCustomBaseStart] = useState(defaultBaseDay);
  const [customBaseEnd, setCustomBaseEnd] = useState(defaultBaseDay);

  // Month selection for Previous Month preset
  const defaultTargetMonth = months.length > 0 ? months[months.length - 1] : '';
  const [selectedMonth, setSelectedMonth] = useState(defaultTargetMonth);

  // Scoping & Filters
  const [activeAccount, setActiveAccount] = useState(selectedAccount || 'all');
  const [selectedServiceFilter, setSelectedServiceFilter] = useState('ALL');
  const [selectedSubtypeFilter, setSelectedSubtypeFilter] = useState('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [resourceSearchQuery, setResourceSearchQuery] = useState('');

  // Sorting State
  const [serviceSortField, setServiceSortField] = useState('delta_cost');
  const [serviceSortOrder, setServiceSortOrder] = useState('desc');
  const [resourceSortField, setResourceSortField] = useState('delta_cost');
  const [resourceSortOrder, setResourceSortOrder] = useState('desc');

  // Pagination State for Resources Table
  const [resourcePage, setResourcePage] = useState(1);
  const [resourcePageSize, setResourcePageSize] = useState(25);

  // Investigation Data & Modals
  const [rootCauseData, setRootCauseData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cacheStats, setCacheStats] = useState(null);
  const [copiedId, setCopiedId] = useState('');
  const [inspectModalResource, setInspectModalResource] = useState(null);

  // Close inspection modal on Escape key & lock background scroll
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setInspectModalResource(null);
      }
    };
    if (inspectModalResource) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [inspectModalResource]);

  // Synchronize account prop
  useEffect(() => {
    setActiveAccount(selectedAccount || 'all');
  }, [selectedAccount]);

  // Auto-init custom date fields on dataset arrival
  useEffect(() => {
    if (dates.length > 0) {
      if (!customTargetEnd) setCustomTargetEnd(dates[dates.length - 1]);
      if (!customTargetStart) setCustomTargetStart(dates[dates.length - 1]);
      if (!customBaseEnd) setCustomBaseEnd(dates.length > 1 ? dates[dates.length - 2] : dates[0]);
      if (!customBaseStart) setCustomBaseStart(dates.length > 1 ? dates[dates.length - 2] : dates[0]);
    }
  }, [dates]);

  // Telemetry Cache Status
  const loadCacheTelemetry = async () => {
    try {
      const stats = await api.getCacheStats();
      setCacheStats(stats);
    } catch {
      // Non-blocking telemetry
    }
  };

  useEffect(() => {
    loadCacheTelemetry();
  }, []);

  // Compute Active Timeframe Windows
  const currentWindows = useMemo(() => {
    if (!dates || dates.length === 0) {
      return {
        target_start: '',
        target_end: '',
        baseline_start: '',
        baseline_end: '',
        duration_days: 0,
        preset_label: 'No Data Ingested',
        is_like_for_like: false,
        baseline_status: 'UNAVAILABLE',
        baseline_note: 'No dates found in active CUR dataset.'
      };
    }

    const latestDay = dates[dates.length - 1];
    let tStart = latestDay;
    let tEnd = latestDay;
    let presetLabel = 'Yesterday vs Today';

    // 1. Resolve Target Date Range
    switch (datePreset) {
      case 'yesterday':
        tStart = latestDay;
        tEnd = latestDay;
        presetLabel = `Latest Day (${latestDay})`;
        break;

      case '7d':
        tEnd = latestDay;
        tStart = dates.length >= 7 ? dates[dates.length - 7] : dates[0];
        presetLabel = 'Last 7 Days';
        break;

      case '30d':
        tEnd = latestDay;
        tStart = dates.length >= 30 ? dates[dates.length - 30] : dates[0];
        presetLabel = 'Last 30 Days';
        break;

      case 'mtd':
        const curMonthPrefix = latestDay.slice(0, 7);
        const mtdDates = dates.filter(d => d.startsWith(curMonthPrefix));
        tStart = mtdDates[0] || dates[0];
        tEnd = latestDay;
        presetLabel = `Month-to-Date (${curMonthPrefix})`;
        break;

      case 'prev_month':
        const targetMo = selectedMonth || (months.length > 1 ? months[months.length - 2] : months[0]);
        const moDates = dates.filter(d => d.startsWith(targetMo));
        if (moDates.length > 0) {
          tStart = moDates[0];
          tEnd = moDates[moDates.length - 1];
        } else {
          tStart = dates[0];
          tEnd = dates[0];
        }
        presetLabel = `Calendar Month (${targetMo})`;
        break;

      case 'custom':
      default:
        tStart = customTargetStart || latestDay;
        tEnd = customTargetEnd || latestDay;
        presetLabel = 'Custom Target Range';
        break;
    }

    // Safety: ensure tStart <= tEnd
    if (tStart > tEnd) {
      return {
        target_start: tStart,
        target_end: tEnd,
        baseline_start: '',
        baseline_end: '',
        preset_label: presetLabel,
        is_like_for_like: false,
        baseline_status: 'ERROR',
        baseline_note: 'End date cannot precede start date.',
        validation_error: 'Invalid date range: End date cannot precede start date.'
      };
    }

    const durationDays = getDaysDiff(tStart, tEnd);

    // 2. Resolve Baseline Date Range according to Comparison Type
    let bStart = '';
    let bEnd = '';
    let baselineStatus = 'AVAILABLE';
    let baselineNote = '';
    let isLikeForLike = true;

    if (comparisonType === 'no_comparison') {
      bStart = '';
      bEnd = '';
      baselineStatus = 'NONE';
      baselineNote = 'Analyzing selected timeframe only without baseline variance.';
      isLikeForLike = false;
    } else if (comparisonType === 'same_period_last_year') {
      bStart = shiftYear(tStart, -1);
      bEnd = shiftYear(tEnd, -1);
      const pyMatches = dates.filter(d => d >= bStart && d <= bEnd);
      if (pyMatches.length === 0) {
        baselineStatus = 'UNAVAILABLE';
        baselineNote = `Prior-year data (${bStart} to ${bEnd}) is not available in the active CUR dataset.`;
        bStart = '';
        bEnd = '';
      } else {
        isLikeForLike = (pyMatches.length === durationDays);
        if (!isLikeForLike) {
          baselineStatus = 'PARTIAL';
          baselineNote = `Prior year contains ${pyMatches.length} of ${durationDays} requested days.`;
        }
      }
    } else if (comparisonType === 'custom_baseline') {
      bStart = customBaseStart || defaultBaseDay;
      bEnd = customBaseEnd || defaultBaseDay;
      if (bStart > bEnd) {
        return {
          target_start: tStart,
          target_end: tEnd,
          baseline_start: '',
          baseline_end: '',
          preset_label: presetLabel,
          is_like_for_like: false,
          baseline_status: 'ERROR',
          baseline_note: 'Baseline end date cannot precede baseline start date.',
          validation_error: 'Invalid baseline: End date cannot precede start date.'
        };
      }
      const bDuration = getDaysDiff(bStart, bEnd);
      isLikeForLike = (bDuration === durationDays);
    } else {
      // 'prev_equivalent' - Authoritative previous equivalent period calculation
      if (datePreset === 'yesterday') {
        const tIdx = dates.indexOf(tStart);
        if (tIdx > 0) {
          bStart = dates[tIdx - 1];
          bEnd = dates[tIdx - 1];
        } else {
          baselineStatus = 'UNAVAILABLE';
          baselineNote = `No preceding billing date exists before ${tStart} in active CUR.`;
        }
      } else {
        // Shift backward by exactly durationDays
        bEnd = addDays(tStart, -1);
        bStart = addDays(bEnd, -(durationDays - 1));

        // Check if baseline window falls within ingested dataset
        const earliestDate = dates[0];
        if (bEnd < earliestDate) {
          baselineStatus = 'UNAVAILABLE';
          baselineNote = `Preceding equivalent period (${bStart} to ${bEnd}) precedes the earliest ingested CUR date (${earliestDate}).`;
          bStart = '';
          bEnd = '';
        } else if (bStart < earliestDate) {
          baselineStatus = 'PARTIAL';
          const availDays = dates.filter(d => d >= earliestDate && d <= bEnd).length;
          baselineNote = `Preceding period partially truncated: ${availDays} of ${durationDays} days available in dataset.`;
          bStart = earliestDate;
          isLikeForLike = false;
        }
      }
    }

    return {
      target_start: tStart,
      target_end: tEnd,
      baseline_start: bStart,
      baseline_end: bEnd,
      duration_days: durationDays,
      preset_label: presetLabel,
      is_like_for_like: isLikeForLike,
      baseline_status: baselineStatus,
      baseline_note: baselineNote,
      validation_error: ''
    };
  }, [
    dates, 
    months, 
    datePreset, 
    comparisonType, 
    customTargetStart, 
    customTargetEnd, 
    customBaseStart, 
    customBaseEnd, 
    selectedMonth, 
    defaultTargetDay, 
    defaultBaseDay
  ]);

  // Execute Root-Cause Investigation Query
  const runInvestigation = async () => {
    if (!currentWindows.target_start || currentWindows.validation_error) return;
    setLoading(true);
    setError('');
    setResourcePage(1);
    try {
      const res = await api.getRootCause({
        baseline_start: currentWindows.baseline_start || '',
        baseline_end: currentWindows.baseline_end || '',
        target_start: currentWindows.target_start,
        target_end: currentWindows.target_end,
        service: selectedServiceFilter !== 'ALL' ? selectedServiceFilter : null,
        account_id: activeAccount !== 'all' ? activeAccount : null,
        min_delta: 0.0001
      });
      setRootCauseData(res);
      loadCacheTelemetry();
    } catch (err) {
      setError(err.message || 'Failed to analyze cost root cause');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runInvestigation();
  }, [
    currentWindows.target_start,
    currentWindows.target_end,
    currentWindows.baseline_start,
    currentWindows.baseline_end,
    activeAccount,
    selectedServiceFilter
  ]);

  const copyId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  // Filter & Sort Services Attribution
  const sortedServices = useMemo(() => {
    if (!rootCauseData?.service_attribution) return [];
    const list = [...rootCauseData.service_attribution];

    list.sort((a, b) => {
      let valA = a[serviceSortField];
      let valB = b[serviceSortField];

      if (serviceSortField === 'service') {
        return serviceSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (serviceSortField === 'delta_cost') {
        valA = Math.abs(valA);
        valB = Math.abs(valB);
      }
      valA = Number(valA || 0);
      valB = Number(valB || 0);
      return serviceSortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [rootCauseData?.service_attribution, serviceSortField, serviceSortOrder]);

  // Max absolute delta across services for proportional impact bars
  const maxServiceDelta = useMemo(() => {
    if (!sortedServices.length) return 1;
    return Math.max(...sortedServices.map(s => Math.abs(s.delta_cost || 0)), 1);
  }, [sortedServices]);

  // Active filtered service details
  const filteredServiceData = useMemo(() => {
    if (selectedServiceFilter === 'ALL' || !sortedServices.length) return null;
    return sortedServices.find(s => s.service === selectedServiceFilter);
  }, [sortedServices, selectedServiceFilter]);

  // Classify resource into workload subtype for granular FinOps navigation
  const classifyWorkloadSubtype = (res) => {
    const sid = (res.short_id || res.resource_id || '').toLowerCase();
    const rid = (res.resource_id || '').toLowerCase();
    const svc = (res.service || '').toLowerCase();
    const exp = (res.explanation || '').toLowerCase();

    // 1. EC2 Virtual Instances
    if (sid.startsWith('i-') || (svc.includes('ec2') && (sid.startsWith('i-') || exp.includes('instance')))) {
      return { id: 'instance', label: 'Virtual Instances', icon: Cpu, badge: 'i-*' };
    }
    // 2. EBS Volumes
    if (sid.startsWith('vol-') || rid.includes(':volume/') || (svc.includes('ec2') && (sid.startsWith('vol-') || exp.includes('volume') || exp.includes('ebs storage')))) {
      return { id: 'volume', label: 'EBS Volumes', icon: HardDrive, badge: 'vol-*' };
    }
    // 3. Snapshots (EBS or RDS)
    if (sid.startsWith('snap-') || rid.includes(':snapshot/') || rid.includes(':snapshot:') || exp.includes('snapshot') || exp.includes('backup')) {
      return { id: 'snapshot', label: 'Snapshots', icon: Camera, badge: 'snap-*' };
    }
    // 4. NAT Gateways & Network Interfaces
    if (sid.startsWith('nat-') || sid.startsWith('eni-') || sid.startsWith('eipalloc-') || svc.includes('vpc') || rid.includes('natgateway') || exp.includes('public ipv4') || exp.includes('nat gateway')) {
      return { id: 'network', label: 'NAT & Network', icon: Network, badge: 'nat/eni' };
    }
    // 5. RDS Databases
    if (svc.includes('rds') || sid.includes('db:') || rid.includes(':db:') || exp.includes('rds')) {
      return { id: 'database', label: 'RDS Databases', icon: Database, badge: 'db' };
    }
    // 6. S3 Buckets
    if (svc.includes('s3') || rid.startsWith('arn:aws:s3:::') || sid.startsWith('s3:')) {
      return { id: 'bucket', label: 'S3 Buckets', icon: HardDrive, badge: 's3' };
    }
    // 7. CloudFront CDN
    if (svc.includes('cloudfront') || (sid.startsWith('e') && sid.length >= 12)) {
      return { id: 'cloudfront', label: 'CloudFront CDN', icon: Globe, badge: 'cdn' };
    }
    // 8. AWS Lambda
    if (svc.includes('lambda') || rid.includes(':function:')) {
      return { id: 'lambda', label: 'Lambda Functions', icon: Zap, badge: 'fn' };
    }

    return { id: 'other', label: 'Other Workloads', icon: Layers, badge: '' };
  };

  // Pre-filter resources by Category and Search (before Subtype filtering)
  const baseFilteredResources = useMemo(() => {
    if (!rootCauseData?.resources) return [];
    let list = [...rootCauseData.resources];

    // Filter by Category
    if (selectedCategoryFilter !== 'ALL') {
      list = list.filter(r => r.change_category === selectedCategoryFilter);
    }

    // Filter by Search Query
    if (resourceSearchQuery.trim()) {
      const q = resourceSearchQuery.toLowerCase();
      list = list.filter(r => 
        (r.resource_id && r.resource_id.toLowerCase().includes(q)) ||
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.explanation && r.explanation.toLowerCase().includes(q)) ||
        (r.service && r.service.toLowerCase().includes(q))
      );
    }

    return list;
  }, [rootCauseData?.resources, selectedCategoryFilter, resourceSearchQuery]);

  // Compute available Subtypes present in current view
  const availableSubtypes = useMemo(() => {
    if (!baseFilteredResources.length) return [];
    const counts = {};
    const metaMap = {};

    baseFilteredResources.forEach(r => {
      const sub = classifyWorkloadSubtype(r);
      counts[sub.id] = (counts[sub.id] || 0) + 1;
      if (!metaMap[sub.id]) metaMap[sub.id] = sub;
    });

    return Object.keys(counts).map(k => ({
      id: k,
      label: metaMap[k].label,
      icon: metaMap[k].icon,
      badge: metaMap[k].badge,
      count: counts[k]
    })).sort((a, b) => b.count - a.count);
  }, [baseFilteredResources]);

  // Filter & Sort Resources Table
  const filteredAndSortedResources = useMemo(() => {
    let list = [...baseFilteredResources];

    // Filter by Subtype
    if (selectedSubtypeFilter !== 'ALL') {
      list = list.filter(r => classifyWorkloadSubtype(r).id === selectedSubtypeFilter);
    }

    // Sort Resources
    list.sort((a, b) => {
      let valA = a[resourceSortField];
      let valB = b[resourceSortField];

      if (resourceSortField === 'resource_id' || resourceSortField === 'name' || resourceSortField === 'service') {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
        return resourceSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      if (resourceSortField === 'delta_cost') {
        valA = Math.abs(valA || 0);
        valB = Math.abs(valB || 0);
      } else {
        valA = Number(valA || 0);
        valB = Number(valB || 0);
      }

      return resourceSortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [
    baseFilteredResources, 
    selectedSubtypeFilter,
    resourceSortField, 
    resourceSortOrder
  ]);

  // Pagination Slice
  const totalResourcePages = Math.max(1, Math.ceil(filteredAndSortedResources.length / resourcePageSize));
  const paginatedResources = useMemo(() => {
    const startIdx = (resourcePage - 1) * resourcePageSize;
    return filteredAndSortedResources.slice(startIdx, startIdx + resourcePageSize);
  }, [filteredAndSortedResources, resourcePage, resourcePageSize]);

  // Unique Categories Available in current result
  const availableCategories = useMemo(() => {
    if (!rootCauseData?.resources) return [];
    const set = new Set();
    rootCauseData.resources.forEach(r => set.add(r.change_category));
    return Array.from(set);
  }, [rootCauseData]);

  // Service Sort Toggle
  const handleServiceSort = (field) => {
    if (serviceSortField === field) {
      setServiceSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setServiceSortField(field);
      setServiceSortOrder('desc');
    }
  };

  // Resource Sort Toggle
  const handleResourceSort = (field) => {
    if (resourceSortField === field) {
      setResourceSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setResourceSortField(field);
      setResourceSortOrder('desc');
    }
    setResourcePage(1);
  };

  // Daily Timeline Chart Data Preparation
  const timelineData = rootCauseData?.daily_timeline || [];
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const forestColor = isDark ? '#AFC69B' : '#49664D';
  const baselineColor = isDark ? '#8A9E8D' : '#656B5F';

  const chartData = useMemo(() => {
    if (!timelineData.length) return null;

    const labels = timelineData.map(d => d.date.slice(5)); // 'MM-DD'
    const targetSpendData = timelineData.map(d => d.total_cost);
    const hasBaselineSeries = timelineData.some(d => d.equivalent_baseline_cost !== null);
    const baselineSpendData = timelineData.map(d => d.equivalent_baseline_cost || 0);

    const datasets = [
      {
        label: 'Target Period Spend ($)',
        data: targetSpendData,
        borderColor: forestColor,
        backgroundColor: isDark ? 'rgba(175, 198, 155, 0.18)' : 'rgba(73, 102, 77, 0.15)',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: forestColor,
        pointBorderColor: isDark ? '#141F16' : '#FFFFFF',
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ];

    if (hasBaselineSeries && currentWindows.baseline_status === 'AVAILABLE') {
      datasets.push({
        label: 'Equivalent Baseline Spend ($)',
        data: baselineSpendData,
        borderColor: baselineColor,
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        fill: false,
        tension: 0.3,
        pointBackgroundColor: baselineColor,
        pointBorderColor: isDark ? '#252E26' : '#FFFCF5',
        pointRadius: 3,
        pointHoverRadius: 5
      });
    }

    return { labels, datasets };
  }, [timelineData, forestColor, baselineColor, isDark, currentWindows.baseline_status]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: isDark ? '#F0EEE4' : '#292E28',
          font: { family: 'Plus Jakarta Sans', size: 11, weight: '700' }
        }
      },
      tooltip: {
        backgroundColor: isDark ? '#252E26' : '#292E28',
        titleColor: '#FFFCF5',
        bodyColor: '#FFFCF5',
        padding: 10,
        cornerRadius: 10,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: $${ctx.parsed.y.toFixed(2)}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: isDark ? '#B7C0AE' : '#656B5F', font: { family: 'IBM Plex Mono', size: 10, weight: 600 } }
      },
      y: {
        grid: { color: isDark ? 'rgba(59, 73, 61, 0.25)' : 'rgba(227, 220, 203, 0.5)' },
        ticks: { 
          color: isDark ? '#B7C0AE' : '#656B5F',
          font: { family: 'IBM Plex Mono', size: 10, weight: 600 },
          callback: (v) => `$${v}`
        }
      }
    }
  };

  // Category Configuration Helper
  const getCategoryMeta = (catKey) => {
    switch (catKey) {
      case 'USAGE_QUANTITY_INCREASE':
        return { label: 'Usage Surge', icon: TrendingUp, style: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25' };
      case 'USAGE_QUANTITY_DECREASE':
        return { label: 'Usage Reduction', icon: TrendingDown, style: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25' };
      case 'NEW_RESOURCE':
        return { label: 'New Workload', icon: Rocket, style: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25' };
      case 'TERMINATED_RESOURCE':
        return { label: 'Decommissioned', icon: Trash2, style: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/25' };
      case 'CAPACITY_OR_SKU_CHANGE':
        return { label: 'Capacity / SKU Shift', icon: SlidersHorizontal, style: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25' };
      case 'RATE_OR_DISCOUNT_CHANGE':
        return { label: 'Discount Shift', icon: Zap, style: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25' };
      case 'BILLING_FEE_OR_TAX':
        return { label: 'Fees & Taxes', icon: Layers, style: 'bg-stone-500/10 text-stone-700 dark:text-stone-300 border-stone-500/25' };
      case 'STABLE_USAGE':
      default:
        return { label: 'Steady Operations', icon: Activity, style: 'bg-zorvex-surface-secondary text-zorvex-text-secondary border-zorvex-border' };
    }
  };

  const isSingleDayWindow = currentWindows.duration_days === 1;

  return (
    <div className="space-y-6">
      
      {/* ==================== 1. EXECUTIVE HERO & COCKPIT HEADER ==================== */}
      <div className="clay-card p-6 space-y-6">
        
        {/* Title & Live Metadata */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-zorvex-forest-soft dark:bg-zorvex-dark-forest-soft text-zorvex-forest dark:text-zorvex-forest-highlight shadow-inner flex items-center justify-center">
                <ArrowLeftRight className="w-5 h-5 stroke-[2.5]" />
              </span>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-zorvex-text dark:text-zorvex-dark-text tracking-tight flex items-center gap-2">
                  <span>Cost Investigation & Variance Attribution</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-zorvex-forest-soft text-zorvex-forest dark:text-zorvex-forest-highlight font-bold border border-zorvex-forest/20">
                    CUR Forensics
                  </span>
                </h2>
              </div>
            </div>
            <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary max-w-3xl leading-relaxed pt-0.5">
              Deconstruct exactly why cloud costs shifted between any two dates. Reconcile contributing AWS accounts, services, 
              individual workloads, and billed usage quantities with mathematical evidence.
            </p>
          </div>

          {/* Cache Telemetry Diagnostics */}
          {cacheStats && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-clay-pill bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border text-xs font-mono flex-shrink-0 shadow-xs">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-zorvex-text-secondary">Cache:</span>
              <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text">
                {cacheStats.backend_in_use === 'redis' ? 'Distributed Redis' : 'In-Memory Fallback Tier'}
              </span>
              <span className="text-zorvex-forest dark:text-zorvex-forest-highlight font-black">
                ({cacheStats.hit_ratio_pct}% hit ratio)
              </span>
            </div>
          )}
        </div>

        {/* ==================== 2. EXECUTIVE 4-KPI SUMMARY CARDS ==================== */}
        {rootCauseData && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            
            {/* Target Spend Card */}
            <div className="p-4 rounded-2xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/70 space-y-1 shadow-surface">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zorvex-text-secondary block">
                Target Period Spend
              </span>
              <div className="text-2xl font-black text-zorvex-text dark:text-zorvex-dark-text font-mono">
                {formatMoney(rootCauseData.comparison_window?.target?.total_cost)}
              </div>
              <div className="flex items-center justify-between text-[11px] text-zorvex-text-secondary pt-1">
                <span>{currentWindows.target_start} to {currentWindows.target_end}</span>
                <span className="font-mono font-semibold">({rootCauseData.comparison_window?.target?.records_count?.toLocaleString()} lines)</span>
              </div>
            </div>

            {/* Baseline Spend Card */}
            <div className="p-4 rounded-2xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/70 space-y-1 shadow-surface">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zorvex-text-secondary block">
                Baseline Spend
              </span>
              <div className="text-2xl font-black text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary font-mono">
                {currentWindows.baseline_start ? formatMoney(rootCauseData.comparison_window?.baseline?.total_cost) : 'No Baseline'}
              </div>
              <div className="flex items-center justify-between text-[11px] text-zorvex-text-secondary pt-1">
                <span>{currentWindows.baseline_start ? `${currentWindows.baseline_start} to ${currentWindows.baseline_end}` : 'Single Period Mode'}</span>
                {currentWindows.baseline_start && (
                  <span className="font-mono font-semibold">({rootCauseData.comparison_window?.baseline?.records_count?.toLocaleString()} lines)</span>
                )}
              </div>
            </div>

            {/* Net Cost Variance Card */}
            <div className="p-4 rounded-2xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/70 space-y-1 shadow-surface">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zorvex-text-secondary block">
                Net Cost Variance
              </span>
              <div className={`text-2xl font-black font-mono flex items-center gap-2 ${
                rootCauseData.variance_summary.net_delta > 0.005 
                  ? 'text-rose-600 dark:text-rose-400' 
                  : rootCauseData.variance_summary.net_delta < -0.005 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : 'text-zorvex-text'
              }`}>
                <span>{formatMoney(rootCauseData.variance_summary.net_delta, true)}</span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                  rootCauseData.variance_summary.net_delta > 0.005 
                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' 
                    : rootCauseData.variance_summary.net_delta < -0.005 
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' 
                      : 'bg-zorvex-surface-secondary text-zorvex-text-secondary'
                }`}>
                  {rootCauseData.variance_summary.pct_display}
                </span>
                <span className="text-[11px] text-zorvex-text-secondary">
                  {rootCauseData.variance_summary.net_delta > 0 ? 'Cost Increase' : rootCauseData.variance_summary.net_delta < 0 ? 'Cost Reduction' : 'Steady State'}
                </span>
              </div>
            </div>

            {/* Financial Reconciliation Quality Card */}
            <div className="p-4 rounded-2xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/70 space-y-1 shadow-surface">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zorvex-text-secondary block">
                Attribution Quality
              </span>
              <div className="text-2xl font-black text-zorvex-forest dark:text-zorvex-forest-highlight font-mono flex items-center gap-1.5">
                <span>{rootCauseData.financial_reconciliation?.allocation_percentage || 100}%</span>
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              </div>
              <div className="flex items-center justify-between text-[11px] text-zorvex-text-secondary pt-1">
                <span>{rootCauseData.total_evaluated_resources?.toLocaleString()} Resources Evaluated</span>
                <span className="font-bold text-emerald-600 text-[10px]">Zero Overlap</span>
              </div>
            </div>

          </div>
        )}

        {/* ==================== 3. TIMEFRAME PRESET SELECTOR RIBBON ==================== */}
        <div className="pt-2 border-t border-zorvex-border/40 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-xs font-black text-zorvex-text-secondary uppercase tracking-wider text-[10px] mr-1">
                Preset:
              </span>
              {[
                { id: 'yesterday', label: 'Yesterday vs Today', icon: Calendar },
                { id: '7d', label: 'Last 7 Days', icon: CalendarDays },
                { id: '30d', label: 'Last 30 Days', icon: CalendarDays },
                { id: 'mtd', label: 'Month-to-Date', icon: Layers },
                { id: 'prev_month', label: 'Previous Month', icon: ArrowLeftRight },
                { id: 'custom', label: 'Custom Range', icon: SlidersHorizontal }
              ].map((p) => {
                const Icon = p.icon;
                const active = datePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setDatePreset(p.id);
                      if (p.id === 'yesterday') setComparisonType('prev_equivalent');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-clay-pill text-xs font-bold transition-all cursor-pointer ${
                      active
                        ? 'clay-pill-active text-white shadow-sm'
                        : 'bg-zorvex-surface-secondary/70 dark:bg-zorvex-dark-surface-secondary/70 text-zorvex-text-secondary hover:text-zorvex-text hover:bg-zorvex-surface-secondary'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Account Scope Switcher */}
            {availableAccounts.length > 1 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-zorvex-text-secondary text-[11px]">AWS Account:</span>
                <ClayDropdown
                  options={[
                    { value: 'all', label: 'All AWS Accounts' },
                    ...availableAccounts.map(a => ({ value: a, label: `Account: ${a}` }))
                  ]}
                  value={activeAccount}
                  onChange={setActiveAccount}
                  width="w-44"
                />
              </div>
            )}
          </div>

          {/* Baseline Type & Date Pickers Sub-bar */}
          <div className="p-3 rounded-2xl bg-zorvex-surface-secondary/50 dark:bg-zorvex-dark-surface-secondary/50 border border-zorvex-border/40 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-black text-zorvex-text-secondary uppercase text-[10px] tracking-wider">
                Compare Against:
              </span>
              <ClayDropdown
                options={[
                  { value: 'prev_equivalent', label: 'Previous Equivalent Period (N days back)' },
                  { value: 'same_period_last_year', label: 'Same Period Last Year' },
                  { value: 'no_comparison', label: 'Single Period (No Baseline)' },
                  { value: 'custom_baseline', label: 'Custom Baseline Range' }
                ]}
                value={comparisonType}
                onChange={setComparisonType}
                width="w-64"
              />

              {/* Month Picker for Previous Month Preset */}
              {datePreset === 'prev_month' && months.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-zorvex-text-secondary">Select Month:</span>
                  <ClayDropdown
                    options={months.map(m => ({ value: m, label: m }))}
                    value={selectedMonth}
                    onChange={setSelectedMonth}
                    width="w-36"
                  />
                </div>
              )}

              {/* Custom Target Start / End Pickers */}
              {datePreset === 'custom' && (
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="font-bold text-zorvex-text-secondary">Target Range:</span>
                  <ClayDropdown
                    options={dates.map(d => ({ value: d, label: d }))}
                    value={customTargetStart}
                    onChange={setCustomTargetStart}
                    width="w-36"
                  />
                  <span>➔</span>
                  <ClayDropdown
                    options={dates.map(d => ({ value: d, label: d }))}
                    value={customTargetEnd}
                    onChange={setCustomTargetEnd}
                    width="w-36"
                  />
                </div>
              )}

              {/* Custom Baseline Start / End Pickers */}
              {comparisonType === 'custom_baseline' && (
                <div className="flex items-center gap-2 font-mono text-[11px] pl-2 border-l border-zorvex-border/40">
                  <span className="font-bold text-zorvex-text-secondary">Baseline Range:</span>
                  <ClayDropdown
                    options={dates.map(d => ({ value: d, label: d }))}
                    value={customBaseStart}
                    onChange={setCustomBaseStart}
                    width="w-36"
                  />
                  <span>➔</span>
                  <ClayDropdown
                    options={dates.map(d => ({ value: d, label: d }))}
                    value={customBaseEnd}
                    onChange={setCustomBaseEnd}
                    width="w-36"
                  />
                </div>
              )}
            </div>

            {/* Active Window Chips */}
            <div className="flex items-center gap-2 font-mono text-xs flex-wrap">
              <span className="px-3 py-1 rounded-clay-pill bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border text-zorvex-text font-bold shadow-xs">
                Target: <strong className="text-zorvex-forest dark:text-zorvex-forest-highlight">{currentWindows.target_start}</strong> to <strong className="text-zorvex-forest dark:text-zorvex-forest-highlight">{currentWindows.target_end}</strong>
              </span>
              {currentWindows.baseline_start && (
                <span className="px-3 py-1 rounded-clay-pill bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border text-zorvex-text-secondary shadow-xs">
                  Baseline: <strong className="text-zorvex-text dark:text-zorvex-dark-text">{currentWindows.baseline_start}</strong> to <strong className="text-zorvex-text dark:text-zorvex-dark-text">{currentWindows.baseline_end}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Validation or Baseline Availability Warning */}
        {currentWindows.validation_error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 flex items-center gap-2 text-xs font-bold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{currentWindows.validation_error}</span>
          </div>
        )}

        {currentWindows.baseline_status === 'UNAVAILABLE' && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 flex items-center gap-2 text-xs font-semibold">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>{currentWindows.baseline_note} Switched to single-window cost investigation.</span>
          </div>
        )}

        {currentWindows.baseline_status === 'PARTIAL' && (
          <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-800 dark:text-blue-200 flex items-center gap-2 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>{currentWindows.baseline_note}</span>
          </div>
        )}
      </div>

      {/* Backend Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={runInvestigation}
            className="flex items-center gap-1.5 px-3 py-1 rounded-clay-pill bg-zorvex-surface text-zorvex-text text-xs shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !rootCauseData && (
        <div className="clay-card p-12 flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight animate-pulse">
            <Activity className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span className="text-xs font-bold text-zorvex-text-secondary tracking-wide">
            Deconstructing Billed CUR Telemetry Across Timeframes...
          </span>
        </div>
      )}

      {/* ==================== 4. EXECUTIVE ROOT CAUSE VERDICT BANNER ==================== */}
      {rootCauseData && (
        <div className="space-y-6">
          <div className="clay-card p-6 border-l-4 border-l-zorvex-forest space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-black uppercase text-zorvex-text-secondary tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                  <span>Authoritative Root Cause Verdict</span>
                </span>
                <h3 className="text-lg font-extrabold text-zorvex-text dark:text-zorvex-dark-text leading-snug">
                  {rootCauseData.variance_summary.executive_summary}
                </h3>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right font-mono">
                  <div className="text-[10px] text-zorvex-text-secondary uppercase">Net Cost Delta</div>
                  <div className={`text-2xl font-black ${
                    rootCauseData.variance_summary.net_delta > 0.005
                      ? 'text-rose-600 dark:text-rose-400'
                      : rootCauseData.variance_summary.net_delta < -0.005
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-zorvex-text'
                  }`}>
                    {formatMoney(rootCauseData.variance_summary.net_delta, true)}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-mono font-black ${
                  rootCauseData.variance_summary.net_delta > 0.005
                    ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                    : rootCauseData.variance_summary.net_delta < -0.005
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                      : 'bg-zorvex-surface-secondary text-zorvex-text-secondary'
                }`}>
                  {rootCauseData.variance_summary.pct_display}
                </span>
              </div>
            </div>

            {/* Categorical Variance Decomposition Pills */}
            <div className="pt-3 border-t border-zorvex-border/40">
              <span className="text-[10px] font-black uppercase text-zorvex-text-secondary tracking-wider block mb-2.5">
                Cost Variance Attributed by Mathematical Factor:
              </span>
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                {Object.entries(rootCauseData.category_decomposition || {}).map(([catKey, val]) => {
                  if (Math.abs(val) < 0.005) return null;
                  const isPositive = val > 0;
                  const meta = getCategoryMeta(catKey);
                  const Icon = meta.icon;

                  return (
                    <span
                      key={catKey}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-clay-pill border text-xs shadow-xs ${
                        isPositive 
                          ? 'bg-rose-500/10 text-rose-800 dark:text-rose-200 border-rose-500/25'
                          : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/25'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="font-sans font-bold">{meta.label}:</span>
                      <strong className="font-bold">{formatMoney(val, true)}</strong>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Financial Reconciliation & Integrity Guarantee */}
            {rootCauseData.financial_reconciliation && (
              <div className="p-3.5 rounded-xl bg-zorvex-surface-secondary/70 dark:bg-zorvex-dark-surface-secondary/70 border border-zorvex-border/50 text-xs flex flex-wrap items-center justify-between gap-3 font-mono">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text">Financial Reconciliation:</span>
                  <span className="text-zorvex-text-secondary">
                    Target Spend: <strong className="text-zorvex-text dark:text-zorvex-dark-text">{formatMoney(rootCauseData.financial_reconciliation.gross_target_cost)}</strong> = 
                    Allocated Resources <strong className="text-zorvex-text dark:text-zorvex-dark-text">{formatMoney(rootCauseData.financial_reconciliation.allocated_target_cost)}</strong> ({rootCauseData.financial_reconciliation.allocation_percentage}%) + 
                    Unallocated / Non-Resource Fees <strong className="text-zorvex-text dark:text-zorvex-dark-text">{formatMoney(rootCauseData.financial_reconciliation.unallocated_target_cost)}</strong>
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  {rootCauseData.financial_reconciliation.is_reconciled ? '✓ Zero Double-Counting Verified' : 'Reconciliation Pending'}
                </span>
              </div>
            )}
          </div>

          {/* ==================== 5. TIMELINE OR DAY-OVER-DAY BRIDGE ==================== */}
          {isSingleDayWindow ? (
            /* Day-over-Day Waterfall Bridge for Single-Day Comparison (e.g. Yesterday vs Today) */
            <div className="clay-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                    <span>Day-over-Day Cost Bridge</span>
                  </h3>
                  <p className="text-xs text-zorvex-text-secondary">
                    Visual comparison bridge from baseline date to target date with top moving services.
                  </p>
                </div>
                {rootCauseData.data_completeness?.is_partial_latest_day && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-clay-pill bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30 text-xs font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Partial Hours: {rootCauseData.data_completeness.latest_ingested_date}</span>
                  </span>
                )}
              </div>

              {/* Visual 3-Stage Movement Bar */}
              <div className="p-4 rounded-2xl bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary/50 border border-zorvex-border/60 dark:border-zorvex-dark-border/60 flex flex-col md:flex-row items-center justify-between gap-4 font-mono">
                <div className="text-center md:text-left space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-zorvex-text-secondary block">Baseline Day Spend</span>
                  <div className="text-xl font-black text-zorvex-text dark:text-zorvex-dark-text">
                    {formatMoney(rootCauseData.comparison_window?.baseline?.total_cost)}
                  </div>
                  <span className="text-xs text-zorvex-text-secondary">{currentWindows.baseline_start}</span>
                </div>

                <div className="flex flex-col items-center space-y-1">
                  <div className={`px-4 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 ${
                    rootCauseData.variance_summary.net_delta > 0 
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' 
                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {rootCauseData.variance_summary.net_delta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    <span>{formatMoney(rootCauseData.variance_summary.net_delta, true)} ({rootCauseData.variance_summary.pct_display})</span>
                  </div>
                  <span className="text-[10px] text-zorvex-text-secondary">Net Daily Velocity</span>
                </div>

                <div className="text-center md:text-right space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-zorvex-text-secondary block">Target Day Spend</span>
                  <div className="text-xl font-black text-zorvex-forest dark:text-zorvex-forest-highlight">
                    {formatMoney(rootCauseData.comparison_window?.target?.total_cost)}
                  </div>
                  <span className="text-xs text-zorvex-text-secondary">{currentWindows.target_start}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Multi-Day Timeline Chart */
            timelineData.length > 0 && (
              <div className="clay-card p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                      <span>Daily Cost Timeline & Velocity</span>
                    </h3>
                    <p className="text-xs text-zorvex-text-secondary">
                      Daily cost trajectories across target window with spike detection and service velocity.
                    </p>
                  </div>

                  {/* Peak & Trough Badges */}
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                    {rootCauseData.peak_spend_day && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-clay-pill bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 font-bold">
                        <Flame className="w-3.5 h-3.5 text-rose-600" />
                        <span>Peak: {rootCauseData.peak_spend_day.date} ({formatMoney(rootCauseData.peak_spend_day.cost)})</span>
                      </span>
                    )}
                    {rootCauseData.trough_spend_day && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-clay-pill bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-bold">
                        <Award className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Trough: {rootCauseData.trough_spend_day.date} ({formatMoney(rootCauseData.trough_spend_day.cost)})</span>
                      </span>
                    )}
                    {rootCauseData.data_completeness?.is_partial_latest_day && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-clay-pill bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30 font-bold">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Partial Hours: {rootCauseData.data_completeness.latest_ingested_date}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Chart */}
                {chartData && (
                  <div className="h-56 sm:h-64 w-full pt-2">
                    <Line data={chartData} options={chartOptions} />
                  </div>
                )}

                {/* Timeline Chips for Daily Drilldown */}
                <div className="pt-2 border-t border-zorvex-border/30">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-zorvex-text-secondary">Drilldown to Single Date:</span>
                    {timelineData.map((d) => (
                      <button
                        key={d.date}
                        type="button"
                        onClick={() => {
                          setDatePreset('custom');
                          setCustomTargetStart(d.date);
                          setCustomTargetEnd(d.date);
                          setComparisonType('prev_equivalent');
                        }}
                        className="px-2.5 py-1 rounded-clay-pill text-[11px] font-mono font-bold bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text dark:hover:text-zorvex-dark-text hover:bg-zorvex-surface dark:hover:bg-zorvex-dark-surface transition-all border border-zorvex-border/40 dark:border-zorvex-dark-border/40 cursor-pointer shadow-xs"
                        title={`Analyze single day: ${d.date}`}
                      >
                        {d.date.slice(5)}: {formatMoney(d.total_cost)}
                        {d.is_spike && <span className="text-rose-600 ml-1 font-black">▲</span>}
                        {d.is_drop && <span className="text-emerald-600 ml-1 font-black">▼</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          )}

          {/* ==================== 6. STEP 1: SERVICE-WISE VARIANCE ATTRIBUTION ==================== */}
          {selectedServiceFilter !== 'ALL' ? (
            <div className="clay-card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-l-zorvex-forest bg-zorvex-forest-soft/30 dark:bg-zorvex-forest-dark-soft/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-zorvex-forest text-white flex-shrink-0">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-zorvex-text-secondary tracking-wider">Step 1 Active Service:</span>
                    <span className="text-sm font-black text-zorvex-text dark:text-zorvex-dark-text">{selectedServiceFilter}</span>
                  </div>
                  <div className="text-xs text-zorvex-text-secondary flex flex-wrap items-center gap-2 font-mono mt-0.5">
                    <span>Net Delta: <strong className={filteredServiceData?.delta_cost < 0 ? 'text-emerald-600' : 'text-rose-600'}>{formatMoney(filteredServiceData?.delta_cost, true)}</strong></span>
                    <span>•</span>
                    <span>Target Spend: <strong>{formatMoney(filteredServiceData?.target_cost)}</strong></span>
                    <span>•</span>
                    <span>Baseline: <strong>{formatMoney(filteredServiceData?.baseline_cost)}</strong></span>
                    <span>•</span>
                    <span>{filteredServiceData?.pct_display}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedServiceFilter('ALL');
                    setSelectedSubtypeFilter('ALL');
                    setResourcePage(1);
                  }}
                  className="px-3.5 py-1.5 rounded-clay-pill bg-zorvex-surface hover:bg-zorvex-border text-zorvex-text text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-zorvex-border shadow-xs transition-all"
                  title="Show all services"
                >
                  <Eye className="w-3.5 h-3.5 text-zorvex-forest" />
                  <span>Switch / View All Services</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedServiceFilter('ALL');
                    setSelectedSubtypeFilter('ALL');
                    setResourcePage(1);
                  }}
                  className="px-3 py-1.5 rounded-clay-pill bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                  title="Reset service filter"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="clay-card p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                    <span>Step 1: Service-Wise Variance Attribution</span>
                    <span className="text-xs font-normal text-zorvex-text-secondary font-mono">
                      (Click any service row to filter its constituent resources in Step 2)
                    </span>
                  </h3>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-zorvex-border/70">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zorvex-surface-secondary/70 dark:bg-zorvex-dark-surface-secondary/70 border-b border-zorvex-border/70 text-zorvex-text-secondary uppercase text-[10px] font-black tracking-wider">
                      <th className="py-3 px-4 cursor-pointer hover:text-zorvex-text" onClick={() => handleServiceSort('service')}>
                        <div className="flex items-center gap-1.5">
                          <span>AWS Service</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="py-3 px-4 text-right cursor-pointer hover:text-zorvex-text" onClick={() => handleServiceSort('baseline_cost')}>
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Baseline Spend</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="py-3 px-4 text-right cursor-pointer hover:text-zorvex-text" onClick={() => handleServiceSort('target_cost')}>
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Target Spend</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="py-3 px-4 text-right cursor-pointer hover:text-zorvex-text" onClick={() => handleServiceSort('delta_cost')}>
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Net Delta ($)</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="py-3 px-4 text-right cursor-pointer hover:text-zorvex-text" onClick={() => handleServiceSort('pct_change')}>
                        <div className="flex items-center justify-end gap-1.5">
                          <span>% Change</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="py-3 px-4 text-center">Impact Share</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zorvex-border/40 font-mono">
                    {sortedServices.map((svc) => {
                      const isSelected = selectedServiceFilter === svc.service;
                      const isSpike = svc.delta_cost > 0.005;
                      const isDrop = svc.delta_cost < -0.005;
                      const Icon = getServiceIcon(svc.service);
                      const impactRatio = Math.min(100, Math.round((Math.abs(svc.delta_cost || 0) / maxServiceDelta) * 100));

                      return (
                        <tr 
                          key={svc.service}
                          onClick={() => {
                            setSelectedServiceFilter(isSelected ? 'ALL' : svc.service);
                            setSelectedSubtypeFilter('ALL');
                            setResourcePage(1);
                          }}
                          className={`transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-zorvex-forest-soft/70 dark:bg-zorvex-dark-forest-soft/40 border-l-4 border-l-zorvex-forest'
                              : 'hover:bg-zorvex-surface-secondary/40 dark:hover:bg-zorvex-dark-surface-secondary/40'
                          }`}
                        >
                          <td className="py-3 px-4 font-sans font-bold text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-2.5">
                            <span className={`p-1.5 rounded-lg flex-shrink-0 ${
                              isSelected ? 'bg-zorvex-forest text-white' : 'bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary'
                            }`}>
                              <Icon className="w-3.5 h-3.5" />
                            </span>
                            <span className="truncate">{svc.service}</span>
                          </td>
                          <td className="py-3 px-4 text-right text-zorvex-text-secondary">
                            {formatMoney(svc.baseline_cost)}
                          </td>
                          <td className="py-3 px-4 text-right text-zorvex-text dark:text-zorvex-dark-text font-bold">
                            {formatMoney(svc.target_cost)}
                          </td>
                          <td className={`py-3 px-4 text-right font-black ${
                            isSpike ? 'text-rose-600 dark:text-rose-400' : isDrop ? 'text-emerald-600 dark:text-emerald-400' : 'text-zorvex-text-secondary'
                          }`}>
                            {formatMoney(svc.delta_cost, true)}
                          </td>
                          <td className="py-3 px-4 text-right text-zorvex-text-secondary font-bold">
                            {svc.pct_display}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="w-24 mx-auto space-y-1">
                              <div className="h-1.5 w-full bg-zorvex-border/50 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${isSpike ? 'bg-rose-500' : isDrop ? 'bg-emerald-500' : 'bg-zorvex-forest'}`}
                                  style={{ width: `${impactRatio}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-zorvex-text-secondary font-bold block">{svc.share_of_total_delta}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              className={`px-3 py-1 rounded-clay-pill text-[10px] font-sans font-extrabold cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-zorvex-forest text-white shadow-sm'
                                  : 'bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text dark:hover:text-zorvex-dark-text hover:bg-zorvex-surface dark:hover:bg-zorvex-dark-surface border border-zorvex-border/40 dark:border-zorvex-dark-border/40'
                              }`}
                            >
                              {isSelected ? 'Active Filter ✓' : 'Filter Resources'}
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

          {/* ==================== 7. STEP 2: RESOURCE-WISE COST INVESTIGATION ==================== */}
          <div className="clay-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-2">
                  <Server className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                  <span>Step 2: Resource-Level Engineering Root Cause</span>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text dark:text-zorvex-dark-text border border-zorvex-border dark:border-zorvex-dark-border">
                    {filteredAndSortedResources.length} Billable Resources
                  </span>
                  {selectedServiceFilter !== 'ALL' && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-zorvex-forest-soft text-zorvex-forest dark:text-zorvex-forest-highlight">
                      Scoped to {selectedServiceFilter}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-zorvex-text-secondary">
                  Individual cloud workloads analyzed with runtime quantities, unit pricing shifts, and sampled CUR line items.
                </p>
              </div>

              {/* Resource Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zorvex-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by ID, name, or cause..."
                    value={resourceSearchQuery}
                    onChange={(e) => {
                      setResourceSearchQuery(e.target.value);
                      setResourcePage(1);
                    }}
                    className="pl-8 pr-3 py-1.5 clay-input text-xs font-medium w-60 rounded-xl"
                  />
                </div>

                {/* Category Dropdown Filter */}
                <ClayDropdown
                  options={[
                    { value: 'ALL', label: 'All Cause Categories' },
                    ...availableCategories.map(c => ({ value: c, label: getCategoryMeta(c).label }))
                  ]}
                  value={selectedCategoryFilter}
                  onChange={(val) => {
                    setSelectedCategoryFilter(val);
                    setResourcePage(1);
                  }}
                  width="w-48"
                />
              </div>
            </div>

            {/* Quick Workload Subtype Tabs / Filter Pills */}
            {availableSubtypes.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zorvex-border/40">
                <span className="text-[10px] font-black uppercase text-zorvex-text-secondary mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-zorvex-forest" />
                  <span>Workload Type:</span>
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubtypeFilter('ALL');
                    setResourcePage(1);
                  }}
                  className={`px-3 py-1 rounded-clay-pill text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    selectedSubtypeFilter === 'ALL'
                      ? 'bg-zorvex-forest text-white'
                      : 'bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text dark:hover:text-zorvex-dark-text hover:bg-zorvex-surface dark:hover:bg-zorvex-dark-surface border border-zorvex-border/40 dark:border-zorvex-dark-border/40'
                  }`}
                >
                  <span>All Workloads</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    selectedSubtypeFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-zorvex-border dark:bg-zorvex-dark-border text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary'
                  }`}>
                    {baseFilteredResources.length}
                  </span>
                </button>

                {availableSubtypes.map(sub => {
                  const SubIcon = sub.icon;
                  const isSelected = selectedSubtypeFilter === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        setSelectedSubtypeFilter(isSelected ? 'ALL' : sub.id);
                        setResourcePage(1);
                      }}
                      className={`px-3 py-1 rounded-clay-pill text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                        isSelected
                          ? 'bg-zorvex-forest text-white'
                          : 'bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text dark:hover:text-zorvex-dark-text hover:bg-zorvex-surface dark:hover:bg-zorvex-dark-surface border border-zorvex-border/40 dark:border-zorvex-dark-border/40'
                      }`}
                    >
                      <SubIcon className="w-3.5 h-3.5" />
                      <span>{sub.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-zorvex-border text-zorvex-text-secondary'
                      }`}>
                        {sub.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Intuitive How-to-Inspect Hint Banner */}
            <div className="flex items-center justify-between text-xs text-zorvex-text-secondary bg-zorvex-surface-secondary/40 px-3.5 py-2 rounded-xl border border-zorvex-border/40 font-sans">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-zorvex-forest flex-shrink-0" />
                <span><strong>How to Inspect:</strong> Click anywhere on any resource row or the <strong>Audit 🔍</strong> button to open the deep CUR line-item audit modal.</span>
              </div>
              <span className="text-[10px] font-mono text-zorvex-text-secondary/70 hidden sm:inline-block">ESC or click backdrop to close</span>
            </div>

            {/* Resources Table */}
            <div className="overflow-x-auto rounded-2xl border border-zorvex-border/70">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zorvex-surface-secondary/70 dark:bg-zorvex-dark-surface-secondary/70 border-b border-zorvex-border/70 text-zorvex-text-secondary uppercase text-[10px] font-black tracking-wider">
                    <th className="py-3 px-4 cursor-pointer hover:text-zorvex-text" onClick={() => handleResourceSort('resource_id')}>
                      <div className="flex items-center gap-1.5">
                        <span>Resource & Classification</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 cursor-pointer hover:text-zorvex-text" onClick={() => handleResourceSort('service')}>
                      <div className="flex items-center gap-1.5">
                        <span>Service & Region</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right cursor-pointer hover:text-zorvex-text" onClick={() => handleResourceSort('baseline_cost')}>
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Baseline Spend</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right cursor-pointer hover:text-zorvex-text" onClick={() => handleResourceSort('target_cost')}>
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Target Spend</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right cursor-pointer hover:text-zorvex-text" onClick={() => handleResourceSort('delta_cost')}>
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Delta ($)</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-center">Usage Quantity (Δ)</th>
                    <th className="py-3 px-4">Engineering Root Cause & Evidence</th>
                    <th className="py-3 px-4 text-center">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zorvex-border/40 font-mono">
                  {paginatedResources.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-zorvex-text-secondary font-sans text-xs">
                        No billable resources match the selected criteria or workload filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedResources.map((res) => {
                      const isSpike = res.delta_cost > 0.005;
                      const isDrop = res.delta_cost < -0.005;
                      const catMeta = getCategoryMeta(res.change_category);
                      const CatIcon = catMeta.icon;

                      return (
                        <tr 
                          key={res.resource_id} 
                          onClick={() => setInspectModalResource(res)}
                          className="hover:bg-zorvex-forest-soft/40 dark:hover:bg-zorvex-forest-dark-soft/25 transition-all cursor-pointer group hover:border-l-4 hover:border-l-zorvex-forest"
                          title={`Click to inspect CUR telemetry for ${res.short_id || res.resource_id}`}
                        >
                          
                          {/* Resource ID & Classification */}
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span 
                                  className="font-sans font-bold text-zorvex-forest dark:text-zorvex-forest-highlight group-hover:underline truncate max-w-[200px] flex items-center gap-1" 
                                  title={res.resource_id}
                                >
                                  <span>{res.short_id || res.resource_id}</span>
                                  <Search className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyId(res.resource_id);
                                  }}
                                  className="text-zorvex-text-secondary hover:text-zorvex-text cursor-pointer p-0.5 rounded hover:bg-zorvex-surface transition-colors"
                                  title="Copy ARN"
                                >
                                  {copiedId === res.resource_id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-sans font-bold border ${catMeta.style}`}>
                                <CatIcon className="w-2.5 h-2.5" />
                                <span>{catMeta.label}</span>
                              </span>
                            </div>
                          </td>

                          {/* Service & Region */}
                          <td className="py-3 px-4 font-sans text-xs">
                            <div className="font-semibold text-zorvex-text dark:text-zorvex-dark-text">{res.service}</div>
                            <div className="text-[10px] text-zorvex-text-secondary font-mono">{res.region || 'global'}</div>
                          </td>

                          {/* Baseline Spend */}
                          <td className="py-3 px-4 text-right text-zorvex-text-secondary">
                            {formatMoney(res.baseline_cost)}
                          </td>

                          {/* Target Spend */}
                          <td className="py-3 px-4 text-right text-zorvex-text dark:text-zorvex-dark-text font-bold">
                            {formatMoney(res.target_cost)}
                          </td>

                          {/* Delta Cost */}
                          <td className={`py-3 px-4 text-right font-black ${
                            isSpike ? 'text-rose-600 dark:text-rose-400' : isDrop ? 'text-emerald-600 dark:text-emerald-400' : 'text-zorvex-text-secondary'
                          }`}>
                            <div>{formatMoney(res.delta_cost, true)}</div>
                            <div className="text-[10px] text-zorvex-text-secondary font-normal">
                              ({res.pct_display})
                            </div>
                          </td>

                          {/* Usage Quantity Change */}
                          <td className="py-3 px-4 text-center">
                            {res.delta_usage_qty !== 0 ? (
                              <div className="space-y-0.5">
                                <span className={`font-bold ${res.delta_usage_qty > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  {res.delta_usage_qty > 0 ? '+' : ''}{res.delta_usage_qty.toLocaleString()} {res.usage_unit}
                                </span>
                                <div className="text-[10px] text-zorvex-text-secondary">
                                  {res.baseline_usage_qty.toLocaleString()} ➔ {res.target_usage_qty.toLocaleString()}
                                </div>
                              </div>
                            ) : (
                              <span className="text-zorvex-text-secondary text-[11px]">Steady Qty</span>
                            )}
                          </td>

                          {/* Engineering Root Cause & Evidence */}
                          <td className="py-3 px-4 font-sans text-xs max-w-sm">
                            <div className="font-semibold text-zorvex-text dark:text-zorvex-dark-text leading-snug">
                              {res.explanation}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-700 dark:text-emerald-400 mt-1 font-bold">
                              <ShieldCheck className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                              <span>{res.evidence_status?.replace(/_/g, ' ') || 'CONFIRMED BY CUR'}</span>
                            </div>
                          </td>

                          {/* Inspect Button */}
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectModalResource(res);
                              }}
                              className="px-3.5 py-1.5 rounded-clay-pill bg-zorvex-forest hover:bg-zorvex-forest-dark text-white text-[11px] font-sans font-bold flex items-center gap-1.5 mx-auto transition-all shadow-xs cursor-pointer group-hover:scale-105"
                              title="Audit raw CUR line items and mathematical decomposition"
                            >
                              <Search className="w-3 h-3" />
                              <span>Audit 🔍</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-zorvex-text-secondary">
                Showing {paginatedResources.length > 0 ? (resourcePage - 1) * resourcePageSize + 1 : 0} to{' '}
                {Math.min(resourcePage * resourcePageSize, filteredAndSortedResources.length)} of {filteredAndSortedResources.length} evaluated resources
              </span>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-zorvex-text-secondary text-[11px]">Rows per page:</span>
                  <ClayDropdown
                    options={[
                      { value: 25, label: '25 per page' },
                      { value: 50, label: '50 per page' },
                      { value: 100, label: '100 per page' },
                      { value: 250, label: '250 per page' },
                      { value: 1000, label: 'All resources' }
                    ]}
                    value={resourcePageSize}
                    onChange={(val) => {
                      setResourcePageSize(Number(val));
                      setResourcePage(1);
                    }}
                    width="w-32"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={resourcePage <= 1}
                    onClick={() => setResourcePage(prev => Math.max(1, prev - 1))}
                    className="p-1.5 rounded-lg border border-zorvex-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zorvex-surface-secondary text-zorvex-text cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-mono font-bold text-zorvex-text">
                    Page {resourcePage} of {totalResourcePages}
                  </span>
                  <button
                    type="button"
                    disabled={resourcePage >= totalResourcePages}
                    onClick={() => setResourcePage(prev => Math.min(totalResourcePages, prev + 1))}
                    className="p-1.5 rounded-lg border border-zorvex-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zorvex-surface-secondary text-zorvex-text cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 8. DEEP LINE ITEM EVIDENCE INSPECTION SIDE-OVER DRAWER ==================== */}
      {inspectModalResource && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex justify-end transition-opacity duration-200 cursor-pointer"
          onClick={() => setInspectModalResource(null)}
        >
          <div 
            className="w-full sm:max-w-xl md:max-w-2xl bg-zorvex-surface dark:bg-zorvex-dark-surface h-full shadow-2xl border-l border-zorvex-border flex flex-col z-[10000] cursor-default animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Pinned Drawer Header */}
            <div className="p-5 border-b border-zorvex-border/50 flex items-start justify-between gap-3 bg-zorvex-surface-secondary/50 flex-shrink-0">
              <div>
                <span className="text-[10px] font-mono font-black uppercase text-zorvex-text-secondary flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                  <span>CUR Telemetry & Line-Item Audit Drawer</span>
                </span>
                <h4 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text mt-0.5">
                  {inspectModalResource.short_id || inspectModalResource.resource_id}
                </h4>
                {inspectModalResource.name && (
                  <span className="text-xs text-zorvex-text-secondary block">
                    Tag: {inspectModalResource.name} • {inspectModalResource.service} ({inspectModalResource.region || 'global'})
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setInspectModalResource(null)}
                className="p-1.5 rounded-clay-pill bg-zorvex-surface hover:bg-zorvex-border text-zorvex-text-secondary hover:text-zorvex-text cursor-pointer transition-colors shadow-xs"
                title="Close Drawer (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 font-sans">
              
              {/* Full Resource ARN Box */}
              <div className="p-3 rounded-xl bg-zorvex-surface-secondary/50 border border-zorvex-border text-xs font-mono space-y-1">
                <span className="text-[10px] font-bold uppercase text-zorvex-text-secondary block">Full AWS Resource Identifier / ARN:</span>
                <div className="flex items-center justify-between gap-2">
                  <code className="break-all text-[11px] font-bold text-zorvex-text dark:text-zorvex-dark-text">
                    {inspectModalResource.resource_id}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyId(inspectModalResource.resource_id)}
                    className="p-1 rounded bg-zorvex-surface shadow-xs cursor-pointer flex-shrink-0 hover:bg-zorvex-border"
                    title="Copy ARN"
                  >
                    {copiedId === inspectModalResource.resource_id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Authoritative Root Cause Verdict Card */}
              <div className="p-4 rounded-xl bg-zorvex-forest-soft/40 dark:bg-zorvex-forest-dark-soft/30 border border-zorvex-forest/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-zorvex-forest dark:text-zorvex-forest-highlight uppercase tracking-wider text-[10px]">
                    Authoritative Root-Cause Explanation:
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{inspectModalResource.evidence_status?.replace(/_/g, ' ') || 'CONFIRMED BY CUR'}</span>
                  </span>
                </div>
                <p className="text-sm font-bold text-zorvex-text dark:text-zorvex-dark-text leading-snug">
                  {inspectModalResource.explanation}
                </p>
              </div>

              {/* Quantitative Mathematical Decomposition Grid */}
              <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
                <div className="p-3 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border">
                  <span className="text-[10px] text-zorvex-text-secondary block">Baseline Spend</span>
                  <strong className="text-sm block">{formatMoney(inspectModalResource.baseline_cost)}</strong>
                  <span className="text-[10px] text-zorvex-text-secondary block mt-0.5">
                    ({inspectModalResource.baseline_usage_qty?.toLocaleString()} {inspectModalResource.usage_unit})
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border">
                  <span className="text-[10px] text-zorvex-text-secondary block">Target Spend</span>
                  <strong className="text-sm block">{formatMoney(inspectModalResource.target_cost)}</strong>
                  <span className="text-[10px] text-zorvex-text-secondary block mt-0.5">
                    ({inspectModalResource.target_usage_qty?.toLocaleString()} {inspectModalResource.usage_unit})
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border">
                  <span className="text-[10px] text-zorvex-text-secondary block">Quantity Effect (ΔQ)</span>
                  <strong className={`text-sm block ${inspectModalResource.quantity_effect > 0 ? 'text-rose-600' : inspectModalResource.quantity_effect < 0 ? 'text-emerald-600' : 'text-zorvex-text'}`}>
                    {formatMoney(inspectModalResource.quantity_effect, true)}
                  </strong>
                  <span className="text-[10px] text-zorvex-text-secondary block mt-0.5">
                    {inspectModalResource.delta_usage_qty > 0 ? '+' : ''}{inspectModalResource.delta_usage_qty?.toLocaleString()} {inspectModalResource.usage_unit}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border">
                  <span className="text-[10px] text-zorvex-text-secondary block">Rate / SKU Effect (ΔR)</span>
                  <strong className={`text-sm block ${inspectModalResource.rate_effect > 0 ? 'text-rose-600' : inspectModalResource.rate_effect < 0 ? 'text-emerald-600' : 'text-zorvex-text'}`}>
                    {formatMoney(inspectModalResource.rate_effect, true)}
                  </strong>
                  <span className="text-[10px] text-zorvex-text-secondary block mt-0.5">
                    {inspectModalResource.effective_rate_base > 0 ? `$${inspectModalResource.effective_rate_base.toFixed(4)}` : '$0.00'} ➔ ${inspectModalResource.effective_rate_target?.toFixed(4)}
                  </span>
                </div>
              </div>

              {/* Raw CUR Line-Item Audit Evidence */}
              {inspectModalResource.line_items_sample && inspectModalResource.line_items_sample.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] font-bold uppercase text-zorvex-text-secondary tracking-wider">
                      Authoritative CUR Line-Item Records ({inspectModalResource.line_items_sample.length} sampled):
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-zorvex-border/60 max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-[11px] font-mono border-collapse">
                      <thead className="bg-zorvex-surface-secondary/90 dark:bg-zorvex-dark-surface-secondary/90 sticky top-0 text-[10px] text-zorvex-text-secondary uppercase">
                        <tr>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Period</th>
                          <th className="py-2 px-3">Line Type</th>
                          <th className="py-2 px-3">Usage Type / SKU</th>
                          <th className="py-2 px-3 text-right">Quantity</th>
                          <th className="py-2 px-3 text-right">Billed Cost ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zorvex-border/30">
                        {inspectModalResource.line_items_sample.map((li, idx) => (
                          <tr key={idx} className="hover:bg-zorvex-surface-secondary/20">
                            <td className="py-2 px-3 font-bold text-zorvex-text dark:text-zorvex-dark-text whitespace-nowrap">{li.date}</td>
                            <td className="py-2 px-3">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                li.period === 'target' ? 'bg-zorvex-forest-soft text-zorvex-forest' : 'bg-zorvex-surface-secondary text-zorvex-text-secondary'
                              }`}>
                                {li.period || 'current'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-zorvex-text-secondary">{li.line_type}</td>
                            <td className="py-2 px-3 truncate max-w-[180px]" title={li.usage_type}>
                              {li.usage_type}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {li.usage_amount.toLocaleString()} {li.unit}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-zorvex-text dark:text-zorvex-dark-text whitespace-nowrap">
                              {formatMoney(li.cost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Operational Boundary Note */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs space-y-1 text-amber-900 dark:text-amber-200">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Operational Investigation Boundary</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {inspectModalResource.operational_note}
                </p>
              </div>

            </div>

            {/* Pinned Drawer Footer */}
            <div className="p-4 border-t border-zorvex-border/50 bg-zorvex-surface-secondary/70 flex items-center justify-between gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  window.open(`/app/resources?search=${encodeURIComponent(inspectModalResource.resource_id)}`, '_blank');
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-zorvex-forest dark:text-zorvex-forest-highlight hover:underline cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Inspect in Resource Explorer</span>
              </button>

              <button
                type="button"
                onClick={() => setInspectModalResource(null)}
                className="px-5 py-2 rounded-clay-pill bg-zorvex-forest hover:bg-zorvex-forest-dark text-white text-xs font-bold cursor-pointer transition-all shadow-sm"
              >
                Close Audit
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
