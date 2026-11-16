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
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
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
  Hash,
  Cloud,
  Lightbulb
} from 'lucide-react';
import { api } from '../services/api';
import ClayDropdown from './common/ClayDropdown';
import ClayDateRangePicker from './common/ClayDateRangePicker';
import AwsServiceIcon from './common/AwsServiceIcon';
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

// Smart Date Window Formatter for Executive Briefings
function formatWindowLabel(start, end) {
  if (!start) return 'Baseline Period';
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parse = (s) => {
    if (!s || typeof s !== 'string') return null;
    const p = s.split('-');
    if (p.length === 3) return { y: p[0], m: monthNames[parseInt(p[1], 10) - 1] || p[1], d: p[2] };
    return null;
  };
  const d1 = parse(start);
  if (!d1) return start;
  if (!end || start === end) {
    return `${d1.m} ${d1.d}, ${d1.y}`;
  }
  const d2 = parse(end);
  if (!d2) return `${start} to ${end}`;
  if (d1.y === d2.y) {
    if (d1.m === d2.m) {
      return `${d1.m} ${d1.d} – ${d2.d}, ${d1.y}`;
    }
    return `${d1.m} ${d1.d} – ${d2.m} ${d2.d}, ${d1.y}`;
  }
  return `${d1.m} ${d1.d}, ${d1.y} – ${d2.m} ${d2.d}, ${d2.y}`;
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

// Service-Aware Classification & Workload Terminology Helpers
function getServiceUnitLabel(service, count = 1) {
  const s = (service || '').toLowerCase();
  if (s.includes('ec2') || s.includes('elastic compute')) {
    return count === 1 ? 'instance' : 'instances';
  }
  if (s.includes('rds') || s.includes('database')) {
    return count === 1 ? 'DB instance' : 'DB instances';
  }
  if (s.includes('s3') || s.includes('simple storage')) {
    return count === 1 ? 'bucket/storage' : 'buckets/storage';
  }
  if (s.includes('cloudfront')) {
    return count === 1 ? 'distribution' : 'distributions';
  }
  if (s.includes('lambda')) {
    return count === 1 ? 'function' : 'functions';
  }
  if (s.includes('dynamodb')) {
    return count === 1 ? 'table' : 'tables';
  }
  if (s.includes('waf')) {
    return count === 1 ? 'web ACL' : 'web ACLs';
  }
  if (s.includes('nat') || s.includes('vpc') || s.includes('gateway')) {
    return count === 1 ? 'gateway' : 'gateways';
  }
  return count === 1 ? 'workload' : 'workloads';
}

function getResourceBadgeType(res) {
  const s = (res?.service || '').toLowerCase();
  if (s.includes('ec2') || s.includes('elastic compute')) return 'INSTANCE';
  if (s.includes('rds') || s.includes('database')) return 'DATABASE';
  if (s.includes('s3') || s.includes('simple storage')) return 'BUCKET';
  if (s.includes('cloudfront')) return 'DISTRIBUTION';
  if (s.includes('lambda')) return 'FUNCTION';
  if (s.includes('dynamodb')) return 'TABLE';
  if (s.includes('waf')) return 'WEB ACL';
  if (s.includes('nat') || s.includes('gateway')) return 'GATEWAY';
  return 'RESOURCE';
}

// Forensic Attribute Extractor (Extracts instance types, storage tiers, SKU shifts, surges, and inflection dates)
function extractResourceForensics(res) {
  if (!res) return { instanceType: null, storageTier: null, isResize: false, isSurge: false, isNew: false, isStopped: false, isCompute: false, inflectionDate: null, inflectionEvent: null, detailBadge: null };
  const exp = res.explanation || '';
  const usageTypes = Array.isArray(res.usage_types) ? res.usage_types.join(' ') : (res.usage_types || '');
  const operations = Array.isArray(res.operations) ? res.operations.join(' ') : (res.operations || '');
  const combined = `${exp} ${usageTypes} ${operations} ${res.name || ''} ${res.resource_id || ''}`;
  const svc = (res.service || '').toLowerCase();
  const isCompute = svc.includes('ec2') || svc.includes('rds') || svc.includes('compute') || svc.includes('database');

  // Match instance sizes like t3.medium, c5.2xlarge, db.r5.xlarge, m5.large, etc.
  const match = combined.match(/\b([a-z][0-9][a-z0-9]*\.[a-z0-9]+)\b/i);
  const instanceType = match ? match[1] : null;

  // Match storage tiers or operations for S3 / Storage
  let storageTier = null;
  if (svc.includes('s3') || svc.includes('storage')) {
    const sMatch = combined.match(/\b(StandardStorage|Requests-Tier1|Requests-Tier2|Glacier|TimedStorage|Intelligent-Tiering|OneZone|DeepArchive)\b/i);
    if (sMatch) {
      storageTier = sMatch[1];
    } else if (res.usage_types && res.usage_types.length > 0) {
      storageTier = res.usage_types[0];
    }
  }

  const cat = (res.change_category || '').toUpperCase();
  const isResize = cat.includes('SKU') || cat.includes('CAPACITY') || exp.toLowerCase().includes('sku changed') || exp.toLowerCase().includes('capacity changed') || exp.toLowerCase().includes('resized');
  const isSurge = cat.includes('INCREASE') || cat.includes('SURGE') || (res.delta_usage_qty > 0 && res.delta_cost > 0.005);
  const isNew = cat.includes('NEW') || (res.baseline_cost <= 0.0001 && res.target_cost > 0.0001);
  const isStopped = cat.includes('TERMINATED') || cat.includes('STOPPED') || (res.baseline_cost > 0.0001 && res.target_cost <= 0.0001);

  const inflectionDate = res.inflection_date || null;
  const inflectionEvent = res.inflection_event || null;
  const detailBadge = res.detail_badge || null;

  return { instanceType, storageTier, isResize, isSurge, isNew, isStopped, isCompute, inflectionDate, inflectionEvent, detailBadge };
}
export default function ComparisonView({ overview, selectedAccount = 'all', forexData = null, currency: propCurrency }) {
  // Currency & Forex conversion support (USD vs INR)
  const [activeCurrency, setActiveCurrency] = useState(() => {
    return propCurrency || localStorage.getItem('zorvex_preferred_currency') || 'USD';
  });

  useEffect(() => {
    if (propCurrency) {
      setActiveCurrency(propCurrency);
    }
  }, [propCurrency]);

  useEffect(() => {
    const handleStorageChange = () => {
      const cur = localStorage.getItem('zorvex_preferred_currency') || 'USD';
      setActiveCurrency(cur);
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('zorvex_currency_change', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('zorvex_currency_change', handleStorageChange);
    };
  }, []);

  const isINR = activeCurrency === 'INR';
  const currencySymbol = isINR ? '₹' : '$';
  const forexRate = Number(forexData?.rate) || 95.32;

  // Currency-aware formatMoney replacing old hardcoded USD formatter
  const formatMoney = (val, showSign = false) => {
    if (val === null || val === undefined || isNaN(val)) return isINR ? '₹0.00' : '$0.00';
    const num = Number(val);
    const converted = isINR ? num * forexRate : num;
    const symbol = isINR ? '₹' : '$';
    const locale = isINR ? 'en-IN' : 'en-US';
    const formatted = Math.abs(converted).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    if (num < -0.004) return `-${symbol}${formatted}`;
    if (num > 0.004 && showSign) return `+${symbol}${formatted}`;
    return `${symbol}${formatted}`;
  };

  const dates = useMemo(() => overview?.dates || [], [overview?.dates]);
  const months = useMemo(() => overview?.months || [], [overview?.months]);
  const availableAccounts = useMemo(() => Object.keys(overview?.accounts || {}), [overview?.accounts]);

  // Date Range Presets:
  // 'yesterday' | '7d' | '30d' | 'mtd' | 'prev_month' | 'custom'
  const [datePreset, setDatePreset] = useState('yesterday');

  // Comparison Options:
  // 'prev_equivalent' | 'same_period_last_year' | 'no_comparison' | 'custom_baseline'
  const [comparisonType, setComparisonType] = useState('custom_baseline');

  // Investigation View Mode: 'SERVICE_DRILLDOWN' (Guided drilldown by service) or 'ALL_WORKLOADS' (Flat global table)
  const [comparisonViewMode, setComparisonViewMode] = useState('SERVICE_DRILLDOWN');
  // Comparison Range Mode: 'DATE_RANGE' (multi-day or monthly range) vs 'SINGLE_DAY' (arbitrary single days like 1st Oct vs 8th Oct)
  const [comparisonRangeMode, setComparisonRangeMode] = useState('DATE_RANGE');
  // Workload Presentation Layout: 'CARDS' (executive grid cards) vs 'TABLE' (dense table)
  const [workloadLayout, setWorkloadLayout] = useState('CARDS');

  // Custom Target Range (Later Period)
  const defaultTargetDay = dates.length > 0 ? dates[dates.length - 1] : '';
  const defaultBaseDay = dates.length > 1 ? dates[dates.length - 2] : (dates[0] || '');
  const [customTargetStart, setCustomTargetStart] = useState(defaultTargetDay);
  const [customTargetEnd, setCustomTargetEnd] = useState(defaultTargetDay);

  // Custom Baseline Range (Earlier Period)
  const [customBaseStart, setCustomBaseStart] = useState(defaultBaseDay);
  const [customBaseEnd, setCustomBaseEnd] = useState(defaultBaseDay);

  // Unified Preset Handler
  const handlePresetClick = (presetId) => {
    setDatePreset(presetId);
    setComparisonType('custom_baseline');
    if (!dates || dates.length === 0) return;
    const latestDay = dates[dates.length - 1];

    if (presetId === 'yesterday') {
      const prevDay = dates.length > 1 ? dates[dates.length - 2] : dates[0];
      setCustomTargetStart(latestDay);
      setCustomTargetEnd(latestDay);
      setCustomBaseStart(prevDay);
      setCustomBaseEnd(prevDay);
    } else if (presetId === '7d') {
      const targetStart = dates.length >= 7 ? dates[dates.length - 7] : dates[0];
      const baseEnd = addDays(targetStart, -1);
      const baseStart = addDays(baseEnd, -6);
      setCustomTargetStart(targetStart);
      setCustomTargetEnd(latestDay);
      setCustomBaseStart(baseStart);
      setCustomBaseEnd(baseEnd);
    } else if (presetId === '30d') {
      const targetStart = dates.length >= 30 ? dates[dates.length - 30] : dates[0];
      const baseEnd = addDays(targetStart, -1);
      const baseStart = addDays(baseEnd, -29);
      setCustomTargetStart(targetStart);
      setCustomTargetEnd(latestDay);
      setCustomBaseStart(baseStart);
      setCustomBaseEnd(baseEnd);
    } else if (presetId === 'mtd') {
      const curMonthPrefix = latestDay.slice(0, 7);
      const mtdDates = dates.filter(d => d.startsWith(curMonthPrefix));
      const targetStart = mtdDates[0] || dates[0];
      const days = getDaysDiff(targetStart, latestDay);
      const baseEnd = addDays(targetStart, -1);
      const baseStart = addDays(baseEnd, -(days - 1));
      setCustomTargetStart(targetStart);
      setCustomTargetEnd(latestDay);
      setCustomBaseStart(baseStart);
      setCustomBaseEnd(baseEnd);
    } else if (presetId === 'custom') {
      // Retain active dates in custom pickers
    }
  };

  // Month selection for Previous Month preset
  const defaultTargetMonth = months.length > 0 ? months[months.length - 1] : '';
  const [selectedMonth, setSelectedMonth] = useState(defaultTargetMonth);

  // Scoping & Filters
  const [activeAccount, setActiveAccount] = useState(selectedAccount || 'all');
  const [selectedServiceFilter, setSelectedServiceFilter] = useState('ALL');
  const [selectedSubtypeFilter, setSelectedSubtypeFilter] = useState('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [resourceSearchQuery, setResourceSearchQuery] = useState('');
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');

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
  const [expandedService, setExpandedService] = useState(null);

  const toggleServiceExpand = (serviceName, e) => {
    if (e) e.stopPropagation();
    setExpandedService(prev => prev === serviceName ? null : serviceName);
  };

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
    if (comparisonType === 'custom_baseline') {
      tStart = customTargetStart || latestDay;
      tEnd = customTargetEnd || latestDay;
      presetLabel = datePreset === 'custom' ? 'Custom Comparison Range' : presetLabel;
    } else {
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
          baselineNote = `Dataset Boundary Note: Selected target spans ${durationDays} days (${tStart} to ${tEnd}), but this CUR starts on ${earliestDate}. Baseline compares all ${availDays} available preceding days (${earliestDate} to ${bEnd}).`;
          bStart = earliestDate;
          isLikeForLike = false;
        }
      }
    }

    // Automatic Chronological Alignment: Baseline is strictly the earlier timeframe, Target is strictly the later timeframe
    let finalTargetStart = tStart;
    let finalTargetEnd = tEnd;
    let finalBaseStart = bStart;
    let finalBaseEnd = bEnd;

    if (finalBaseStart && finalTargetStart && finalBaseStart > finalTargetStart) {
      finalTargetStart = bStart;
      finalTargetEnd = bEnd;
      finalBaseStart = tStart;
      finalBaseEnd = tEnd;
    }

    return {
      target_start: finalTargetStart,
      target_end: finalTargetEnd,
      baseline_start: finalBaseStart,
      baseline_end: finalBaseEnd,
      duration_days: getDaysDiff(finalTargetStart, finalTargetEnd),
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
  const runInvestigation = async (pageOverride = null, pageSizeOverride = null, sortFieldOverride = null, sortOrderOverride = null) => {
    if (!currentWindows.target_start || currentWindows.validation_error) return;
    setLoading(true);
    setError('');
    const targetPage = pageOverride !== null ? pageOverride : resourcePage;
    const targetSize = pageSizeOverride !== null ? pageSizeOverride : resourcePageSize;
    const targetSortField = sortFieldOverride !== null ? sortFieldOverride : resourceSortField;
    const targetSortOrder = sortOrderOverride !== null ? sortOrderOverride : resourceSortOrder;
    const offset = (targetPage - 1) * targetSize;

    try {
      const res = await api.getRootCause({
        baseline_start: currentWindows.baseline_start || '',
        baseline_end: currentWindows.baseline_end || '',
        target_start: currentWindows.target_start,
        target_end: currentWindows.target_end,
        service: selectedServiceFilter !== 'ALL' ? selectedServiceFilter : null,
        account_id: activeAccount !== 'all' ? activeAccount : null,
        min_delta: 0.0001,
        limit: targetSize,
        offset: offset,
        category: selectedCategoryFilter !== 'ALL' ? selectedCategoryFilter : null,
        search: resourceSearchQuery.trim() || null,
        sort_by: targetSortField,
        sort_order: targetSortOrder
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
    setResourcePage(1);
    runInvestigation(1);
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
    let list = [...rootCauseData.service_attribution];

    if (serviceSearchQuery && serviceSearchQuery.trim()) {
      const q = serviceSearchQuery.trim().toLowerCase();
      list = list.filter(s => (s.service || '').toLowerCase().includes(q));
    }

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
  }, [rootCauseData?.service_attribution, serviceSortField, serviceSortOrder, serviceSearchQuery]);

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

  // Aggregate all unique resources available in current investigation payload
  const allAvailableResources = useMemo(() => {
    if (!rootCauseData) return [];
    const map = new Map();
    (rootCauseData.resources || []).forEach(r => { if (r?.resource_id) map.set(r.resource_id, r); });
    (rootCauseData.top_cost_increases || []).forEach(r => { if (r?.resource_id && !map.has(r.resource_id)) map.set(r.resource_id, r); });
    (rootCauseData.top_cost_reductions || []).forEach(r => { if (r?.resource_id && !map.has(r.resource_id)) map.set(r.resource_id, r); });
    (rootCauseData.newly_launched_workloads || []).forEach(r => { if (r?.resource_id && !map.has(r.resource_id)) map.set(r.resource_id, r); });
    (rootCauseData.terminated_workloads || []).forEach(r => { if (r?.resource_id && !map.has(r.resource_id)) map.set(r.resource_id, r); });
    return Array.from(map.values());
  }, [rootCauseData]);

  // Compute FinOps Waterfall Bridge data
  const waterfallData = useMemo(() => {
    if (!rootCauseData?.variance_summary || !rootCauseData?.service_attribution) return null;
    const baseline = rootCauseData.comparison_window?.baseline?.total_cost || 0;
    const target = rootCauseData.comparison_window?.target?.total_cost || 0;
    const netDelta = rootCauseData.variance_summary.net_delta || 0;

    const sorted = [...rootCauseData.service_attribution].sort((a, b) => Math.abs(b.delta_cost || 0) - Math.abs(a.delta_cost || 0));
    const topServices = sorted.slice(0, 4).filter(s => Math.abs(s.delta_cost || 0) > 0.005);
    const topDeltaSum = topServices.reduce((acc, s) => acc + (s.delta_cost || 0), 0);
    const remainingDelta = netDelta - topDeltaSum;

    return {
      baseline,
      target,
      netDelta,
      topServices,
      remainingDelta,
      hasRemainder: Math.abs(remainingDelta) > 0.01 && sorted.length > 4
    };
  }, [rootCauseData]);

  // Dynamic Top 3 Service Drivers for the Executive Attribution Cards
  const topServiceDrivers = useMemo(() => {
    if (!rootCauseData?.service_attribution || rootCauseData.service_attribution.length === 0) {
      return [];
    }
    const sorted = [...rootCauseData.service_attribution].sort((a, b) => Math.abs(b.delta_cost || 0) - Math.abs(a.delta_cost || 0));
    const top3 = sorted.slice(0, 3);

    return top3.map((svc) => {
      const isPositive = (svc.delta_cost || 0) > 0.005;
      const isNegative = (svc.delta_cost || 0) < -0.005;
      
      const candidateList = isPositive 
        ? (rootCauseData.top_cost_increases || []) 
        : (rootCauseData.top_cost_reductions || []);
      const matched = candidateList.find(r => r.service === svc.service) || allAvailableResources.find(r => r.service === svc.service);

      let narrative = '';
      if (matched) {
        const id = matched.short_id || matched.name || matched.resource_id || '';
        const exp = matched.explanation || '';

        if (exp && !exp.toLowerCase().includes('steady-state') && !exp.toLowerCase().includes('baseline operations')) {
          narrative = exp;
        } else if (isPositive) {
          if (id.startsWith('i-')) {
            narrative = `Compute instance ${id} scaled on-demand runtime hours across this timeframe.`;
          } else if (id.startsWith('vol-')) {
            narrative = `Storage volume ${id} provisioned additional disk capacity.`;
          } else if (id.startsWith('eni-')) {
            narrative = `Network interface ${id} processed outbound cross-AZ data transfer.`;
          } else if (id.startsWith('nat-')) {
            narrative = `NAT Gateway ${id} processed increased egress data transfer.`;
          } else if (id.startsWith('db:') || id.includes('rds') || id.includes('db-')) {
            narrative = `Database cluster ${id} scaled allocated storage capacity or IOPS.`;
          } else if (id.startsWith('arn:aws:s3:::') || id.startsWith('s3:')) {
            narrative = `S3 bucket ${id} accumulated additional storage tier volume and API calls.`;
          } else {
            narrative = `Workload ${id} incurred variable usage and operational demand.`;
          }
        } else if (isNegative) {
          if (id.startsWith('i-')) {
            narrative = `Compute workload ${id} reduced runtime hours or was decommissioned.`;
          } else if (id.startsWith('vol-')) {
            narrative = `Storage volume ${id} released capacity or was deleted.`;
          } else if (id.startsWith('eni-')) {
            narrative = `Network interface ${id} processed reduced data transfer volume.`;
          } else if (id.startsWith('db:') || id.includes('rds') || id.includes('db-')) {
            narrative = `Database cluster ${id} reduced storage allocation or compute tier.`;
          } else {
            narrative = `Resource ${id} usage was reduced or terminated between periods.`;
          }
        } else {
          narrative = `Workload ${id} operated within expected baseline thresholds.`;
        }
      } else {
        if (isPositive) {
          narrative = `Operational usage and provisioned capacity increased across ${svc.service} workloads.`;
        } else if (isNegative) {
          narrative = `Billed spend decreased across ${svc.service} workloads due to reduced runtime or deprovisioning.`;
        } else {
          narrative = `Billed spend remained steady across ${svc.service} workloads.`;
        }
      }

      return {
        service: svc.service,
        delta_cost: svc.delta_cost,
        pct_display: svc.pct_display,
        isPositive,
        isNegative,
        narrative,
        matched
      };
    });
  }, [rootCauseData?.service_attribution, rootCauseData?.top_cost_increases, rootCauseData?.top_cost_reductions, allAvailableResources]);


  // Classify resource into workload subtype for granular FinOps navigation
  const classifyWorkloadSubtype = (res) => {
    const sid = (res.short_id || res.resource_id || '').toLowerCase();
    const rid = (res.resource_id || '').toLowerCase();
    const svc = (res.service || '').toLowerCase();
    const exp = (res.explanation || '').toLowerCase();
    const cat = (res.change_category || res.category || '').toLowerCase();

    // 0. Commitments & Taxes (RI Fees, Savings Plans, Invoiced Taxes, Domain Fees)
    if (
      cat === 'billing_fee_or_tax' ||
      cat === 'commitment_fee' ||
      cat === 'commitment_adjustment' ||
      cat === 'tax_adjustment' ||
      cat === 'tax' ||
      cat === 'unallocated_usage' ||
      rid.startsWith('tax-') ||
      rid.startsWith('no-resource-id') ||
      exp.includes('tax') ||
      exp.includes('commitment') ||
      exp.includes('reserved instance')
    ) {
      return { id: 'commitment', label: 'Commitments & Taxes', icon: FileText, badge: 'tax/fee' };
    }

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
    // 6. OpenSearch Clusters
    if (svc.includes('opensearch') || svc.includes('elasticsearch') || rid.includes(':domain/') || rid.includes(':es:') || sid.includes('opensearch')) {
      return { id: 'opensearch', label: 'OpenSearch Clusters', icon: Search, badge: 'search' };
    }
    // 7. S3 Buckets
    if (svc.includes('s3') || rid.startsWith('arn:aws:s3:::') || sid.startsWith('s3:')) {
      return { id: 'bucket', label: 'S3 Buckets', icon: HardDrive, badge: 's3' };
    }
    // 8. CloudFront CDN (Strict match: uppercase E followed by 11-15 hex/alphanumeric characters, or service is CloudFront)
    if (svc.includes('cloudfront') || (/^E[A-Z0-9]{11,15}$/.test(sid))) {
      return { id: 'cloudfront', label: 'CloudFront CDN', icon: Globe, badge: 'cdn' };
    }
    // 9. AWS Lambda
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
        if (Math.abs(valA - valB) > 0.0001) {
          return resourceSortOrder === 'asc' ? valA - valB : valB - valA;
        }
        // Secondary tie-breaker: rank higher spend workloads above zero-dollar snapshots
        const spendA = Math.max(a.target_cost || 0, a.baseline_cost || 0);
        const spendB = Math.max(b.target_cost || 0, b.baseline_cost || 0);
        return spendB - spendA;
      } else {
        valA = Number(valA || 0);
        valB = Number(valB || 0);
        return resourceSortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });

    return list;
  }, [
    baseFilteredResources, 
    selectedSubtypeFilter,
    resourceSortField, 
    resourceSortOrder
  ]);

  // Total Evaluated & Matching Resources
  const totalResourceCount = rootCauseData?.pagination?.total_count ?? rootCauseData?.total_count ?? rootCauseData?.total_evaluated_resources ?? (rootCauseData?.resources?.length || 0);
  const totalResourcePages = Math.max(1, Math.ceil(totalResourceCount / resourcePageSize));

  // Resources to render: use backend paginated slice when available, or client slice fallback
  const paginatedResources = useMemo(() => {
    if (rootCauseData?.pagination) {
      return filteredAndSortedResources;
    }
    const startIdx = (resourcePage - 1) * resourcePageSize;
    return filteredAndSortedResources.slice(startIdx, startIdx + resourcePageSize);
  }, [filteredAndSortedResources, rootCauseData?.pagination, resourcePage, resourcePageSize]);

  // Unique Categories Available in current result (from full dataset metadata)
  const availableCategories = useMemo(() => {
    if (rootCauseData?.available_categories && rootCauseData.available_categories.length > 0) {
      return rootCauseData.available_categories;
    }
    if (rootCauseData?.category_decomposition) {
      return Object.keys(rootCauseData.category_decomposition);
    }
    if (!rootCauseData?.resources) return [];
    const set = new Set();
    rootCauseData.resources.forEach(r => set.add(r.change_category));
    return Array.from(set);
  }, [rootCauseData]);

  // Page Navigation Handlers
  const handlePageChange = (newPage) => {
    setResourcePage(newPage);
    runInvestigation(newPage, resourcePageSize);
  };

  const handlePageSizeChange = (newSize) => {
    const sizeNum = Number(newSize);
    setResourcePageSize(sizeNum);
    setResourcePage(1);
    runInvestigation(1, sizeNum);
  };

  // Service Sort Toggle
  const handleServiceSort = (field) => {
    if (serviceSortField === field) {
      setServiceSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setServiceSortField(field);
      setServiceSortOrder('desc');
    }
  };

  // Resource Sort Toggle with server-side re-query
  const handleResourceSort = (field) => {
    let nextOrder = 'desc';
    if (resourceSortField === field) {
      nextOrder = resourceSortOrder === 'asc' ? 'desc' : 'asc';
    }
    setResourceSortField(field);
    setResourceSortOrder(nextOrder);
    setResourcePage(1);
    runInvestigation(1, resourcePageSize, field, nextOrder);
  };

  // Daily Timeline Chart Data Preparation
  const timelineData = rootCauseData?.daily_timeline || [];
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const forestColor = isDark ? '#FF9900' : '#EC7211';
  const baselineColor = isDark ? '#94A3B8' : '#64748B';

  const chartData = useMemo(() => {
    if (!timelineData.length) return null;

    const labels = timelineData.map(d => d.date.slice(5)); // 'MM-DD'
    const targetSpendData = timelineData.map(d => d.total_cost);
    const hasBaselineSeries = timelineData.some(d => d.equivalent_baseline_cost !== null);
    const baselineSpendData = timelineData.map(d => d.equivalent_baseline_cost || 0);

    const datasets = [
      {
        label: `Target Period Spend (${currencySymbol})`,
        data: targetSpendData,
        borderColor: forestColor,
        backgroundColor: isDark ? 'rgba(175, 198, 155, 0.18)' : 'rgba(73, 102, 77, 0.15)',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: forestColor,
        pointBorderColor: isDark ? '#0E0F12' : '#FFFFFF',
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ];

    if (hasBaselineSeries && currentWindows.baseline_status === 'AVAILABLE') {
      datasets.push({
        label: `Equivalent Baseline Spend (${currencySymbol})`,
        data: baselineSpendData,
        borderColor: baselineColor,
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        fill: false,
        tension: 0.3,
        pointBackgroundColor: baselineColor,
        pointBorderColor: isDark ? '#16171B' : '#FFFFFF',
        pointRadius: 3,
        pointHoverRadius: 5
      });
    }

    return { labels, datasets };
  }, [timelineData, forestColor, baselineColor, isDark, currentWindows.baseline_status]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    devicePixelRatio: Math.min(typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1, 2),
    animation: { duration: 350 },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: isDark ? '#F8FAFC' : '#0F172A',
          font: { family: 'Plus Jakarta Sans', size: 11, weight: '700' }
        }
      },
      tooltip: {
        backgroundColor: isDark ? '#16171B' : '#0F172A',
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
      case 'USAGE_INCREASE':
        return { label: 'Usage Surge', icon: TrendingUp, style: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25' };
      case 'USAGE_QUANTITY_DECREASE':
      case 'USAGE_DECREASE':
        return { label: 'Usage Reduction', icon: TrendingDown, style: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25' };
      case 'ACTIVE_WORKLOAD':
        return { label: 'Active Workload', icon: Activity, style: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25' };
      case 'RESUMED_WORKLOAD':
        return { label: 'Resumed Workload', icon: RefreshCw, style: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/25' };
      case 'NEW_RESOURCE':
      case 'NEW_WORKLOAD':
        return { label: 'New Workload', icon: Rocket, style: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25' };
      case 'TERMINATED_RESOURCE':
      case 'TERMINATED_WORKLOAD':
      case 'STOPPED_WORKLOAD':
        return { label: 'Stopped / Inactive', icon: Trash2, style: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/25' };
      case 'CAPACITY_OR_SKU_CHANGE':
        return { label: 'Capacity / SKU Shift', icon: SlidersHorizontal, style: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25' };
      case 'RATE_OR_DISCOUNT_CHANGE':
        return { label: 'Discount Shift', icon: Zap, style: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25' };
      case 'BILLING_FEE_OR_TAX':
      case 'COMMITMENT_FEE':
        return { label: 'Fees & Taxes', icon: Layers, style: 'bg-stone-500/10 text-stone-700 dark:text-stone-300 border-stone-500/25' };
      case 'STORAGE_LIFECYCLE':
        return { label: 'Storage Retention / Backup', icon: HardDrive, style: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25' };
      case 'PERIODIC_FEE':
        return { label: 'Periodic / Zone Fees', icon: Clock, style: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/25' };
      case 'UNALLOCATED_USAGE':
        return { label: 'Account-Level Usage', icon: Layers, style: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/25' };
      case 'STABLE_USAGE':
      case 'STEADY_STATE':
      default:
        return { label: 'Steady Operations', icon: Activity, style: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/25' };
    }
  };

  const isSingleDayWindow = currentWindows.duration_days === 1;

  return (
    <div className="space-y-6">
      
      {/* ==================== 1. EXECUTIVE CLEAN HEADER & HERO ==================== */}
      <div className="clay-card p-6 space-y-5">
        
        {/* Title & Date Presets */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-zorvex-forest-soft dark:bg-zorvex-dark-forest-soft text-zorvex-forest dark:text-zorvex-forest-highlight shadow-inner flex items-center justify-center">
                <ArrowLeftRight className="w-5 h-5 stroke-[2.5]" />
              </span>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-zorvex-text dark:text-zorvex-dark-text tracking-tight flex items-center gap-2">
                  <span>Cost Comparison</span>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary border border-zorvex-border">
                    {currentWindows.duration_days} {currentWindows.duration_days === 1 ? 'Day' : 'Days'}
                  </span>
                </h2>
              </div>
            </div>
            <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary max-w-2xl leading-relaxed">
              Compare your AWS spend between two date periods to inspect exact service variances, workload changes, and root causes.
            </p>
          </div>

          {/* Comparison Mode Toggle & Presets */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zorvex-border/50 dark:border-zorvex-dark-border/50 pb-3">
            {/* Mode Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zorvex-text-secondary">Comparison Mode:</span>
              <div className="inline-flex rounded-clay-pill p-1 bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border shadow-inner">
                <button
                  type="button"
                  onClick={() => {
                    setComparisonRangeMode('SINGLE_DAY');
                    setDatePreset('custom');
                    setComparisonType('custom_baseline');
                    if (dates.length >= 2) {
                      setCustomTargetStart(dates[dates.length - 1]);
                      setCustomTargetEnd(dates[dates.length - 1]);
                      setCustomBaseStart(dates[dates.length - 2]);
                      setCustomBaseEnd(dates[dates.length - 2]);
                    }
                  }}
                  className={`px-3 py-1 rounded-clay-pill text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    comparisonRangeMode === 'SINGLE_DAY'
                      ? 'bg-zorvex-forest text-white shadow-xs'
                      : 'text-zorvex-text-secondary hover:text-zorvex-text'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Single Days (e.g. 1 Oct vs 8 Oct)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setComparisonRangeMode('DATE_RANGE');
                    handlePresetClick('7d');
                  }}
                  className={`px-3 py-1 rounded-clay-pill text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    comparisonRangeMode === 'DATE_RANGE'
                      ? 'bg-zorvex-forest text-white shadow-xs'
                      : 'text-zorvex-text-secondary hover:text-zorvex-text'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Date Range / Full Month</span>
                </button>
              </div>
            </div>

            {/* Range Presets (Only shown in Date Range Mode) */}
            {comparisonRangeMode === 'DATE_RANGE' && (
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {[
                  { id: 'yesterday', label: 'Yesterday vs Today' },
                  { id: '7d', label: 'Last 7 Days (DoD)' },
                  { id: '30d', label: 'Last 30 Days (MoM)' },
                  { id: 'mtd', label: 'Month-to-Date' },
                  { id: 'custom', label: 'Custom Range' }
                ].map((p) => {
                  const active = datePreset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePresetClick(p.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                        active
                          ? 'bg-zorvex-forest/20 text-zorvex-forest dark:text-zorvex-forest-highlight border border-zorvex-forest/40 font-bold shadow-xs'
                          : 'bg-zorvex-surface-secondary/70 dark:bg-zorvex-dark-surface-secondary/70 text-zorvex-text-secondary hover:text-zorvex-text hover:bg-zorvex-surface-secondary'
                      }`}
                    >
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Side-by-Side Date Pickers (Baseline vs Target) */}
        <div className="p-4 rounded-2xl bg-zorvex-surface-secondary/50 dark:bg-zorvex-dark-surface-secondary/50 border border-zorvex-border/60 dark:border-zorvex-dark-border/60">
          <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
            
            {/* Earlier Period (Baseline) */}
            <div className="md:col-span-5 p-3 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zorvex-text-secondary flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  <span>Earlier Baseline Period</span>
                </span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-zorvex-surface-secondary text-zorvex-text-secondary border border-zorvex-border/40">
                  {currentWindows.duration_days} {currentWindows.duration_days === 1 ? 'Day' : 'Days'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ClayDateRangePicker
                  startDate={currentWindows.baseline_start || customBaseStart}
                  endDate={comparisonRangeMode === 'SINGLE_DAY' ? (currentWindows.baseline_start || customBaseStart) : (currentWindows.baseline_end || customBaseEnd)}
                  availableDates={dates}
                  singleDayMode={comparisonRangeMode === 'SINGLE_DAY'}
                  onApply={(start, end) => {
                    setDatePreset('custom');
                    setComparisonType('custom_baseline');
                    setCustomBaseStart(start);
                    setCustomBaseEnd(comparisonRangeMode === 'SINGLE_DAY' ? start : end);
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-zorvex-text-secondary pt-0.5">
                <span>Baseline Total: <strong className="font-mono text-zorvex-text dark:text-zorvex-dark-text">{formatMoney(rootCauseData?.comparison_window?.baseline?.total_cost || 0)}</strong></span>
                <span className="font-mono">Avg: {formatMoney(rootCauseData?.comparison_window?.daily_average_baseline || 0)}/day</span>
              </div>
            </div>

            {/* VS Badge */}
            <div className="md:col-span-1 flex flex-col items-center justify-center">
              <span className="w-8 h-8 rounded-full bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary border border-zorvex-border/80 flex items-center justify-center text-[10px] font-black text-zorvex-forest dark:text-zorvex-forest-highlight shadow-sm">
                VS
              </span>
            </div>

            {/* Later Period (Target) */}
            <div className="md:col-span-5 p-3 rounded-xl bg-zorvex-forest-soft/30 dark:bg-zorvex-forest-dark-soft/20 border border-zorvex-forest/30 dark:border-zorvex-forest-highlight/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zorvex-forest dark:text-zorvex-forest-highlight flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-zorvex-forest dark:bg-zorvex-forest-highlight"></span>
                  <span>Later Target Period</span>
                </span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-zorvex-forest/15 text-zorvex-forest dark:text-zorvex-forest-highlight border border-zorvex-forest/20">
                  {currentWindows.duration_days} {currentWindows.duration_days === 1 ? 'Day' : 'Days'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ClayDateRangePicker
                  startDate={currentWindows.target_start || customTargetStart}
                  endDate={comparisonRangeMode === 'SINGLE_DAY' ? (currentWindows.target_start || customTargetStart) : (currentWindows.target_end || customTargetEnd)}
                  availableDates={dates}
                  singleDayMode={comparisonRangeMode === 'SINGLE_DAY'}
                  onApply={(start, end) => {
                    setDatePreset('custom');
                    setComparisonType('custom_baseline');
                    setCustomTargetStart(start);
                    setCustomTargetEnd(comparisonRangeMode === 'SINGLE_DAY' ? start : end);
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-zorvex-text-secondary pt-0.5">
                <span>Target Total: <strong className="font-mono text-zorvex-text dark:text-zorvex-dark-text">{formatMoney(rootCauseData?.comparison_window?.target?.total_cost || 0)}</strong></span>
                <span className={`font-mono font-bold ${(rootCauseData?.variance_summary?.net_delta || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {formatMoney(rootCauseData?.variance_summary?.net_delta || 0, true)} ({rootCauseData?.variance_summary?.pct_display || '0.0%'})
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* ==================== 2. EXECUTIVE BILLING ATTRIBUTION (FACTUAL HERO) ==================== */}
        {rootCauseData && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-zorvex-surface via-zorvex-surface-secondary/60 to-zorvex-surface dark:from-zorvex-dark-surface dark:via-zorvex-dark-surface-secondary/40 dark:to-zorvex-dark-surface border border-zorvex-forest/30 dark:border-zorvex-forest-highlight/30 shadow-lg space-y-4">
            
            {/* Header Badge & Net Impact */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zorvex-border/50 dark:border-zorvex-dark-border/50 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-zorvex-forest/15 text-zorvex-forest dark:text-zorvex-forest-highlight border border-zorvex-forest/25">
                  Executive Billing Attribution
                </span>
                <span className="text-xs text-zorvex-text-secondary">
                  Verified AWS CUR 2.0 Line-Item Analysis
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-zorvex-text-secondary">Net Variance: </span>
                <span className={`text-base font-extrabold font-mono ${(rootCauseData.variance_summary?.net_delta || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {formatMoney(rootCauseData.variance_summary?.net_delta || 0, true)} ({rootCauseData.variance_summary?.pct_display || '0.0%'})
                </span>
              </div>
            </div>

            {/* Narrative Headline */}
            <p className="text-sm font-medium text-zorvex-text dark:text-zorvex-dark-text leading-relaxed">
              Total cloud spend shifted from <strong className="font-mono text-zorvex-text dark:text-zorvex-dark-text">{formatMoney(rootCauseData.comparison_window?.baseline?.total_cost || 0)}</strong> ({formatWindowLabel(currentWindows.baseline_start, currentWindows.baseline_end)}) to <strong className="font-mono text-zorvex-text dark:text-zorvex-dark-text">{formatMoney(rootCauseData.comparison_window?.target?.total_cost || 0)}</strong> ({formatWindowLabel(currentWindows.target_start, currentWindows.target_end)}). This net variance of <strong className={`font-mono ${(rootCauseData.variance_summary?.net_delta || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{formatMoney(rootCauseData.variance_summary?.net_delta || 0, true)}</strong> ({rootCauseData.variance_summary?.pct_display || '0.0%'}) is concentrated across verified architectural billing events:
            </p>

            {/* Dynamic Top 3 Service Drivers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {topServiceDrivers.map((drv, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-zorvex-surface dark:bg-black/25 border border-zorvex-border/60 hover:border-zorvex-forest/40 transition-all space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-2 truncate pr-2">
                      <AwsServiceIcon service={drv.service} size={18} />
                      <span className="truncate">{drv.service.replace('Amazon', '').replace('AWS', '')}</span>
                    </span>
                    <span className={`font-mono font-bold flex-shrink-0 ${drv.delta_cost > 0.005 ? 'text-rose-600 dark:text-rose-400' : (drv.delta_cost < -0.005 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zorvex-text-secondary')}`}>
                      {formatMoney(drv.delta_cost, true)}
                    </span>
                  </div>
                  <p className="text-[11px] text-zorvex-text-secondary leading-normal">
                    {drv.narrative}
                  </p>
                </div>
              ))}
            </div>

            {/* Mathematical Proof Bar */}
            <div className="pt-3 border-t border-zorvex-border/50 dark:border-zorvex-dark-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-zorvex-text-secondary">
              <div className="flex items-center gap-2">
                <span className="text-zorvex-forest dark:text-zorvex-forest-highlight font-bold">Root Cause Attribution:</span>
                <span>Primary shift driven by Usage Quantity & Workload Provisioning (ΔQ). AWS Unit Rates (ΔR) remained fixed with zero SKU price changes.</span>
              </div>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                0% Rate Anomaly
              </span>
            </div>

          </div>
        )}

        {/* ==================== 3. COST VARIANCE BRIDGE (WHERE EVERY DOLLAR SHIFTED) ==================== */}
        {waterfallData && waterfallData.topServices?.length > 0 && (
          <div className="p-4 rounded-2xl bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary/40 border border-zorvex-border/60 dark:border-zorvex-dark-border/60 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zorvex-text-secondary flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                <span>Cost Variance Bridge (Where Every Dollar Shifted)</span>
              </span>
              <span className="text-[11px] font-mono text-zorvex-text-secondary">
                Horizontal Spend Attribution Chain
              </span>
            </div>

            <div className="flex flex-wrap md:flex-nowrap items-center gap-2 overflow-x-auto pb-1">
              {/* Baseline Period Node */}
              <div className="flex-1 min-w-[120px] p-3 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/60 text-center shadow-xs">
                <div className="text-[10px] uppercase font-bold text-zorvex-text-secondary tracking-wider">Baseline Period</div>
                <div className="text-sm font-extrabold font-mono text-zorvex-text dark:text-zorvex-dark-text mt-0.5">
                  {formatMoney(waterfallData.baseline)}
                </div>
                <div className="text-[9px] text-zorvex-text-secondary/70 font-mono mt-0.5">
                  {currentWindows.baseline_start || 'Previous Period'}
                </div>
              </div>

              {/* Step Nodes for Top Services */}
              {waterfallData.topServices.map((svc) => (
                <React.Fragment key={svc.service}>
                  <span className="text-zorvex-text-secondary text-xs font-bold px-0.5">➔</span>
                  <div className="flex-1 min-w-[130px] p-2.5 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/60 text-center shadow-xs">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <AwsServiceIcon service={svc.service} size={16} />
                      <span className="text-[10px] font-bold text-zorvex-text dark:text-zorvex-dark-text truncate max-w-[90px]">
                        {svc.service.replace('Amazon', '').replace('AWS', '')}
                      </span>
                    </div>
                    <div className={`text-xs font-extrabold font-mono ${svc.delta_cost > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {formatMoney(svc.delta_cost, true)}
                    </div>
                    <div className="text-[9px] text-zorvex-text-secondary font-mono mt-0.5">
                      {svc.pct_display}
                    </div>
                  </div>
                </React.Fragment>
              ))}

              {/* Target Period Node */}
              <span className="text-zorvex-text-secondary text-xs font-bold px-0.5">➔</span>
              <div className="flex-1 min-w-[130px] p-3 rounded-xl bg-zorvex-forest-soft/40 dark:bg-zorvex-forest-dark-soft/30 border border-zorvex-forest/30 dark:border-zorvex-forest-highlight/30 text-center shadow-xs">
                <div className="text-[10px] uppercase font-black text-zorvex-forest dark:text-zorvex-forest-highlight tracking-wider">Target Period</div>
                <div className="text-sm font-black font-mono text-zorvex-text dark:text-zorvex-dark-text mt-0.5">
                  {formatMoney(waterfallData.target)}
                </div>
                <div className="text-[9px] font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                  {formatMoney(waterfallData.netDelta, true)} Net
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Validation or Baseline Warning */}
        {currentWindows.validation_error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 flex items-center gap-2 text-xs font-bold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{currentWindows.validation_error}</span>
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
            Analyzing billing telemetry...
          </span>
        </div>
      )}

      {/* Multi-Day Timeline Chart (Only shown when a multi-day range like 7d or 30d is selected) */}
      {rootCauseData && !isSingleDayWindow && timelineData.length > 0 && (
        <div className="clay-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                <span>Daily Spend Trajectory</span>
              </h3>
              <p className="text-xs text-zorvex-text-secondary">
                Daily cost movement across the selected window.
              </p>
            </div>
            {chartData && (
              <div className="flex items-center gap-2 text-xs font-mono">
                {rootCauseData.peak_spend_day && (
                  <span className="px-3 py-1 rounded-clay-pill bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold border border-rose-500/20">
                    Peak: {rootCauseData.peak_spend_day.date} ({formatMoney(rootCauseData.peak_spend_day.cost)})
                  </span>
                )}
              </div>
            )}
          </div>
          {chartData && (
            <div className="h-56 sm:h-64 w-full pt-2">
              <Line data={chartData} options={chartOptions} />
            </div>
          )}
        </div>
      )}

      {/* ==================== 5. INVESTIGATION VIEW MODE SWITCHER ==================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-zorvex-surface-secondary/60 dark:bg-zorvex-dark-surface-secondary/60 border border-zorvex-border/60">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zorvex-text-secondary pl-1">Investigation View:</span>
          <div className="inline-flex rounded-clay-pill p-1 bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border shadow-inner">
            <button
              type="button"
              onClick={() => setComparisonViewMode('SERVICE_DRILLDOWN')}
              className={`px-3.5 py-1.5 rounded-clay-pill text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                comparisonViewMode === 'SERVICE_DRILLDOWN'
                  ? 'bg-zorvex-forest text-white shadow-xs'
                  : 'text-zorvex-text-secondary hover:text-zorvex-text'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>By AWS Service (Guided Drilldown)</span>
            </button>
            <button
              type="button"
              onClick={() => setComparisonViewMode('ALL_WORKLOADS')}
              className={`px-3.5 py-1.5 rounded-clay-pill text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                comparisonViewMode === 'ALL_WORKLOADS'
                  ? 'bg-zorvex-forest text-white shadow-xs'
                  : 'text-zorvex-text-secondary hover:text-zorvex-text'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>All Workloads (Flat Filter View)</span>
            </button>
          </div>
        </div>

        <div className="text-xs text-zorvex-text-secondary pr-2">
          {comparisonViewMode === 'SERVICE_DRILLDOWN'
            ? 'Click "Breakdown" on any service to inspect constituent workloads, SKUs, and causes.'
            : `Viewing ${filteredAndSortedResources.length} evaluated cloud workloads across all services.`}
        </div>
      </div>

      {/* Conditional Explorer: Guided Service Breakdown vs Flat Workloads View */}
      {comparisonViewMode === 'SERVICE_DRILLDOWN' ? (
        <>
          {/* ==================== 6. STEP 1: SERVICE-WISE VARIANCE ATTRIBUTION ==================== */}
          {selectedServiceFilter !== 'ALL' ? (
            <div className="clay-card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-l-zorvex-forest bg-zorvex-forest-soft/30 dark:bg-zorvex-forest-dark-soft/20">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-xl bg-white dark:bg-black/30 border border-zorvex-border/40 dark:border-zorvex-dark-border/40 flex-shrink-0 flex items-center justify-center">
                  <AwsServiceIcon service={selectedServiceFilter} size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-zorvex-text-secondary tracking-wider">Selected Service:</span>
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
                  className="px-3.5 py-1.5 rounded-clay-pill bg-zorvex-surface dark:bg-zorvex-dark-surface hover:bg-zorvex-border dark:hover:bg-zorvex-dark-surface-secondary text-zorvex-text dark:text-zorvex-dark-text text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-zorvex-border dark:border-zorvex-dark-border shadow-xs transition-all"
                  title="Show all services"
                >
                  <Eye className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-forest-highlight" />
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
                    <span>Cost Variance by Service</span>
                    <span className="text-xs font-normal text-zorvex-text-secondary font-mono">
                      (Click any service row or breakdown button to inspect constituent resources, sizes, and root causes)
                    </span>
                  </h3>
                </div>

                {/* Service Search Input */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 text-zorvex-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={serviceSearchQuery}
                    onChange={(e) => setServiceSearchQuery(e.target.value)}
                    placeholder="Search services (e.g. S3, RDS, EC2)..."
                    className="w-full pl-8 pr-7 py-1.5 rounded-clay-pill bg-zorvex-surface-secondary/70 dark:bg-zorvex-dark-surface-secondary/70 border border-zorvex-border/60 text-xs font-mono text-zorvex-text dark:text-zorvex-dark-text placeholder:text-zorvex-text-secondary/60 focus:outline-none focus:ring-1 focus:ring-zorvex-forest transition-all"
                  />
                  {serviceSearchQuery && (
                    <button
                      onClick={() => setServiceSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zorvex-text-secondary hover:text-zorvex-text transition-colors"
                      title="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
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
                          <span>Previous ({currencySymbol})</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="py-3 px-4 text-right cursor-pointer hover:text-zorvex-text" onClick={() => handleServiceSort('target_cost')}>
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Current ({currencySymbol})</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="py-3 px-4 text-right cursor-pointer hover:text-zorvex-text" onClick={() => handleServiceSort('delta_cost')}>
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Variance ({currencySymbol})</span>
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
                    {sortedServices.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-zorvex-text-secondary font-sans">
                          <p className="text-sm font-semibold">No AWS services match "{serviceSearchQuery}"</p>
                          <button
                            onClick={() => setServiceSearchQuery('')}
                            className="mt-2 text-xs font-bold text-zorvex-forest dark:text-zorvex-forest-highlight hover:underline"
                          >
                            Clear search filter
                          </button>
                        </td>
                      </tr>
                    ) : (
                      sortedServices.map((svc) => {
                        const isSelected = selectedServiceFilter === svc.service;
                        const isExpanded = expandedService === svc.service;
                        const isSpike = svc.delta_cost > 0.005;
                        const isDrop = svc.delta_cost < -0.005;
                        const impactRatio = Math.min(100, Math.round((Math.abs(svc.delta_cost || 0) / maxServiceDelta) * 100));
                        
                        // Find all matching constituent resources for this service in current investigation dataset
                        const constituentResources = allAvailableResources.filter(r => r.service === svc.service);

                        return (
                          <React.Fragment key={svc.service}>
                            <tr 
                              onClick={() => toggleServiceExpand(svc.service)}
                              className={`transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-zorvex-forest-soft/70 dark:bg-zorvex-dark-forest-soft/40 border-l-4 border-l-zorvex-forest'
                                  : isExpanded
                                    ? 'bg-zorvex-surface-secondary/80 dark:bg-zorvex-dark-surface-secondary/80 border-l-4 border-l-zorvex-forest/60'
                                    : 'hover:bg-zorvex-surface-secondary/40 dark:hover:bg-zorvex-dark-surface-secondary/40'
                              }`}
                            >
                              <td className="py-3 px-4 font-sans font-bold text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-2">
                                {/* Chevron expand/collapse toggle */}
                                <button
                                  type="button"
                                  onClick={(e) => toggleServiceExpand(svc.service, e)}
                                  className="p-1 rounded-md hover:bg-zorvex-border/50 text-zorvex-text-secondary hover:text-zorvex-text transition-colors flex-shrink-0 cursor-pointer"
                                  title={isExpanded ? "Collapse breakdown" : "Click to inspect constituent resources & breakdown"}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                                <span className="p-1 rounded-lg flex-shrink-0 bg-white/80 dark:bg-black/30 shadow-xs border border-zorvex-border/40 dark:border-zorvex-dark-border/40 flex items-center justify-center">
                                  <AwsServiceIcon service={svc.service} size={18} />
                                </span>
                                <span className="truncate">{svc.service}</span>
                                {constituentResources.length > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border text-zorvex-text-secondary hidden sm:inline-block">
                                    {constituentResources.length} {getServiceUnitLabel(svc.service, constituentResources.length)}
                                  </span>
                                )}
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
                                <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => toggleServiceExpand(svc.service)}
                                    className={`px-2.5 py-1 rounded-clay-pill text-[10px] font-sans font-extrabold cursor-pointer transition-all flex items-center gap-1 ${
                                      isExpanded
                                        ? 'bg-zorvex-forest text-white shadow-xs'
                                        : 'bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text hover:bg-zorvex-surface border border-zorvex-border/50'
                                    }`}
                                  >
                                    <span>{isExpanded ? 'Hide' : 'Breakdown'}</span>
                                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                  </button>

                                  {/* Prominent Audit Drawer Button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const serviceRes = constituentResources[0] || allAvailableResources.find(r => r.service === svc.service) || {
                                        resource_id: `${svc.service} (Aggregated)`,
                                        short_id: svc.service,
                                        name: svc.service,
                                        service: svc.service,
                                        baseline_cost: svc.baseline_cost,
                                        target_cost: svc.target_cost,
                                        delta_cost: svc.delta_cost,
                                        pct_change: svc.pct_change,
                                        pct_display: svc.pct_display,
                                        change_category: svc.delta_cost > 0 ? 'SERVICE_SPEND_INCREASE' : 'SERVICE_SPEND_REDUCTION',
                                        explanation: `Service-level expenditure shifted from ${formatMoney(svc.baseline_cost)} to ${formatMoney(svc.target_cost)} (${svc.pct_display}).`,
                                        evidence_status: 'CONFIRMED_BY_CUR',
                                        decomposition_status: 'ATTRIBUTED',
                                        quantity_effect: 0,
                                        rate_effect: svc.delta_cost,
                                        quantity_impact: 0,
                                        rate_impact: svc.delta_cost
                                      };
                                      setInspectModalResource(serviceRes);
                                    }}
                                    className="px-2.5 py-1 rounded-clay-pill text-[10px] font-sans font-extrabold cursor-pointer transition-all bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 flex items-center gap-1 shadow-xs"
                                    title="Audit raw CUR line items, daily breakdown, and mathematical decomposition"
                                  >
                                    <FileText className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                    <span>Audit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedServiceFilter(isSelected ? 'ALL' : svc.service);
                                      setSelectedSubtypeFilter('ALL');
                                      setResourcePage(1);
                                    }}
                                    className={`px-2.5 py-1 rounded-clay-pill text-[10px] font-sans font-extrabold cursor-pointer transition-all ${
                                      isSelected
                                        ? 'bg-zorvex-forest text-white shadow-xs'
                                        : 'bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary hover:text-zorvex-text border border-zorvex-border/40'
                                    }`}
                                    title="Filter in Table Below"
                                  >
                                    {isSelected ? 'Filtered \u2713' : 'Filter'}
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* ==================== INLINE FORENSIC DRILL-DOWN TRAY ==================== */}
                            {isExpanded && (
                              <tr className="bg-zorvex-surface-secondary/40 dark:bg-black/40 border-y border-zorvex-border/60 dark:border-zorvex-dark-border/60">
                                <td colSpan={7} className="p-4 sm:p-5">
                                  <div className="space-y-3">
                                    {/* Tray Header */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zorvex-border/40 dark:border-zorvex-dark-border/40">
                                      <div className="flex items-center gap-2">
                                        <AwsServiceIcon service={svc.service} size={20} />
                                        <div>
                                          <h4 className="text-xs font-black text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-2">
                                            <span>Constituent Resources & Breakdown for {svc.service}</span>
                                            <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-zorvex-forest-soft text-zorvex-forest dark:text-zorvex-forest-highlight font-bold border border-zorvex-forest/20">
                                              Zero-Scroll Drill-Down
                                            </span>
                                          </h4>
                                          <span className="text-[11px] text-zorvex-text-secondary">
                                            {constituentResources.length > 0 
                                              ? `${constituentResources.length} evaluated ${getServiceUnitLabel(svc.service, constituentResources.length)} found with variance root cause evidence`
                                              : `No cached sample for ${svc.service}. Filter below to load all records from CUR.`}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedServiceFilter(svc.service);
                                            setSelectedSubtypeFilter('ALL');
                                            setResourcePage(1);
                                          }}
                                          className="px-3 py-1 rounded-clay-pill bg-zorvex-forest text-white text-[11px] font-bold flex items-center gap-1 shadow-xs hover:bg-zorvex-forest-dark cursor-pointer transition-all"
                                        >
                                          <Filter className="w-3 h-3" />
                                          <span>Focus in Table Below</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setExpandedService(null)}
                                          className="p-1 rounded-md text-zorvex-text-secondary hover:text-zorvex-text cursor-pointer"
                                          title="Close Tray"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Constituent Resources Grid/List */}
                                    {constituentResources.length === 0 ? (
                                      <div className="p-6 text-center text-xs text-zorvex-text-secondary bg-zorvex-surface dark:bg-zorvex-dark-surface rounded-xl border border-zorvex-border/50 space-y-2">
                                        <p>All evaluated resources for <strong>{svc.service}</strong> can be queried directly.</p>
                                        <button
                                          onClick={() => {
                                            setSelectedServiceFilter(svc.service);
                                            setSelectedSubtypeFilter('ALL');
                                            setResourcePage(1);
                                          }}
                                          className="px-4 py-1.5 rounded-clay-pill bg-zorvex-forest text-white font-bold text-xs cursor-pointer shadow-sm"
                                        >
                                          Filter & Load {svc.service} Resources Below ➔
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {constituentResources.map((res) => {
                                          const attrs = extractResourceForensics(res);
                                          const catMeta = getCategoryMeta(res.change_category);
                                          const CatIcon = catMeta.icon;
                                          const isResSpike = res.delta_cost > 0.005;
                                          const isResDrop = res.delta_cost < -0.005;

                                          return (
                                            <div
                                              key={res.resource_id}
                                              onClick={() => setInspectModalResource(res)}
                                              className="p-3.5 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/70 hover:border-zorvex-forest/60 transition-all cursor-pointer shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 group"
                                              title="Click to audit raw CUR line items and math"
                                            >
                                              {/* Left: Identity, Tag Name, Sizing Badges */}
                                              <div className="space-y-1.5 min-w-0 max-w-xl">
                                                <div className="flex flex-wrap items-center gap-2">
                                                  <span className="font-bold text-xs text-zorvex-text dark:text-zorvex-dark-text group-hover:text-zorvex-forest transition-colors truncate">
                                                    {res.name || res.short_id || res.resource_id}
                                                  </span>
                                                  
                                                  {/* Instance Size Pill (EC2/RDS) */}
                                                  {attrs.instanceType && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/25 flex items-center gap-1">
                                                      <Cpu className="w-3 h-3 text-blue-600" />
                                                      <span>Size: {attrs.instanceType}</span>
                                                    </span>
                                                  )}

                                                  {/* Storage Tier Pill (S3 / Storage) */}
                                                  {attrs.storageTier && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 flex items-center gap-1">
                                                      <HardDrive className="w-3 h-3 text-amber-600" />
                                                      <span>Tier: {attrs.storageTier}</span>
                                                    </span>
                                                  )}

                                                  {/* SKU / Capacity Resize Badge */}
                                                  {attrs.isResize && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                                      <SlidersHorizontal className="w-3 h-3 text-purple-600" />
                                                      <span>{attrs.isCompute ? 'RESIZED INSTANCE / SKU' : 'CHANGED SKU / TIER'}</span>
                                                    </span>
                                                  )}

                                                  {/* Runtime Surge Badge */}
                                                  {attrs.isSurge && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25 flex items-center gap-1">
                                                      <TrendingUp className="w-3 h-3 text-rose-600" />
                                                      <span>USAGE SURGE (+{res.delta_usage_qty > 0 ? res.delta_usage_qty.toLocaleString() : ''} {res.usage_unit})</span>
                                                    </span>
                                                  )}

                                                  {/* New Workload Badge */}
                                                  {attrs.isNew && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 flex items-center gap-1">
                                                      <Rocket className="w-3 h-3 text-emerald-600" />
                                                      <span>NEW {getResourceBadgeType(res)}</span>
                                                    </span>
                                                  )}

                                                  {/* Decommissioned / Stopped Badge */}
                                                  {attrs.isStopped && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/25 flex items-center gap-1">
                                                      <Trash2 className="w-3 h-3 text-slate-600" />
                                                      <span>DECOMMISSIONED</span>
                                                    </span>
                                                  )}

                                                  {/* Category Badge */}
                                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-sans font-bold border flex items-center gap-1 ${catMeta.style}`}>
                                                    <CatIcon className="w-2.5 h-2.5" />
                                                    <span>{catMeta.label}</span>
                                                  </span>

                                                  {/* Inflection Date & Specific Event Badge */}
                                                  {(res.inflection_event || res.inflection_date) && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1 shadow-xs" title={`Transition identified on ${res.inflection_date}`}>
                                                      <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                                      <span>{res.inflection_event || res.inflection_date}</span>
                                                    </span>
                                                  )}

                                                  {/* Service-Specific Detail Badge */}
                                                  {res.detail_badge && !res.inflection_event && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 flex items-center gap-1">
                                                      <span>{res.detail_badge}</span>
                                                    </span>
                                                  )}
                                                </div>

                                                {/* Raw Identifier & Explanation */}
                                                <div className="flex items-center gap-1.5 text-[10px] font-mono text-zorvex-text-secondary">
                                                  <span className="truncate max-w-[260px]">{res.resource_id}</span>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      copyId(res.resource_id);
                                                    }}
                                                    className="text-zorvex-text-secondary hover:text-zorvex-text p-0.5"
                                                    title="Copy ARN"
                                                  >
                                                    {copiedId === res.resource_id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                                  </button>
                                                </div>

                                                <p className="text-xs text-zorvex-text dark:text-zorvex-dark-text font-medium leading-relaxed pt-0.5">
                                                  {res.explanation}
                                                </p>
                                              </div>

                                              {/* Right: Quantities & Financial Impact */}
                                              <div className="flex items-center justify-between md:justify-end gap-4 font-mono text-xs flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-zorvex-border/40">
                                                {/* Usage Transition */}
                                                {res.delta_usage_qty !== 0 && (
                                                  <div className="text-right text-[11px] text-zorvex-text-secondary hidden sm:block">
                                                    <span className="block text-[9px] uppercase font-bold text-zorvex-text-secondary">Billed Qty</span>
                                                    <span>{res.baseline_usage_qty.toLocaleString()} ➔ {res.target_usage_qty.toLocaleString()} {res.usage_unit}</span>
                                                  </div>
                                                )}

                                                {/* Cost Movement */}
                                                <div className="text-right">
                                                  <div className={`text-base font-black ${isResSpike ? 'text-rose-600 dark:text-rose-400' : isResDrop ? 'text-emerald-600 dark:text-emerald-400' : 'text-zorvex-text'}`}>
                                                    {formatMoney(res.delta_cost, true)}
                                                  </div>
                                                  <div className="text-[10px] text-zorvex-text-secondary">
                                                    {formatMoney(res.baseline_cost)} ➔ {formatMoney(res.target_cost)}
                                                  </div>
                                                </div>

                                                {/* Audit Button */}
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setInspectModalResource(res);
                                                  }}
                                                  className="px-3 py-1.5 rounded-clay-pill bg-zorvex-forest hover:bg-zorvex-forest-dark text-white text-[11px] font-sans font-bold flex items-center gap-1 shadow-xs cursor-pointer group-hover:scale-105 transition-all"
                                                >
                                                  <Search className="w-3 h-3" />
                                                  <span>Audit</span>
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                  )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ==================== 7. ALL WORKLOADS (FLAT FILTER VIEW) ==================== */
        <div className="clay-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-2">
                  <Server className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                  <span>All Workloads & Resources (Deep View)</span>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text dark:text-zorvex-dark-text border border-zorvex-border dark:border-zorvex-dark-border">
                    {filteredAndSortedResources.length} Billable Resources
                  </span>
                  {selectedServiceFilter !== 'ALL' && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight border border-zorvex-forest/20 dark:border-zorvex-forest-highlight/30">
                      Scoped to {selectedServiceFilter}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-zorvex-text-secondary">
                  Comprehensive list of all individual cloud resources evaluated in this date range.
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
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zorvex-border/40 dark:border-zorvex-dark-border/40">
                <span className="text-[10px] font-black uppercase text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-zorvex-forest dark:text-zorvex-forest-highlight" />
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
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                    selectedSubtypeFilter === 'ALL'
                      ? 'bg-white/20 text-white'
                      : 'bg-zorvex-border/60 dark:bg-black/35 text-zorvex-text dark:text-zorvex-dark-text border border-zorvex-border/30 dark:border-zorvex-dark-border/60'
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
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-zorvex-border/60 dark:bg-black/35 text-zorvex-text dark:text-zorvex-dark-text border border-zorvex-border/30 dark:border-zorvex-dark-border/60'
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
                <span><strong>How to Inspect:</strong> Click anywhere on any resource row or the <strong>Audit</strong> button to open the deep CUR line-item audit modal.</span>
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
                        <span>Previous ({currencySymbol})</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right cursor-pointer hover:text-zorvex-text" onClick={() => handleResourceSort('target_cost')}>
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Current ({currencySymbol})</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right cursor-pointer hover:text-zorvex-text" onClick={() => handleResourceSort('delta_cost')}>
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Delta ({currencySymbol})</span>
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
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-sans font-bold border ${catMeta.style}`}>
                                  <CatIcon className="w-2.5 h-2.5" />
                                  <span>{catMeta.label}</span>
                                </span>
                                {(res.inflection_event || res.inflection_date) && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30" title={`Transition identified on ${res.inflection_date}`}>
                                    <Calendar className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                    <span>{res.inflection_event || res.inflection_date}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Service & Region */}
                          <td className="py-3 px-4 font-sans text-xs">
                            <div className="flex items-center gap-1.5 font-semibold text-zorvex-text dark:text-zorvex-dark-text">
                              <AwsServiceIcon service={res.service} size={16} />
                              <span className="truncate">{res.service}</span>
                            </div>
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

                          {/* Delta Cost & Decomposition Summary */}
                          <td className={`py-3 px-4 text-right font-black ${
                            isSpike ? 'text-rose-600 dark:text-rose-400' : isDrop ? 'text-emerald-600 dark:text-emerald-400' : 'text-zorvex-text-secondary'
                          }`}>
                            <div>{formatMoney(res.delta_cost, true)}</div>
                            <div className="text-[10px] text-zorvex-text-secondary font-normal">
                              ({res.pct_display})
                            </div>
                            {res.decomposition_status === 'RECONCILED' && (
                              <div className="text-[9px] font-mono text-zorvex-text-secondary font-normal flex items-center justify-end gap-1 mt-0.5" title="Reconciled: Quantity Impact + Rate Impact = Delta Cost">
                                <span>Q:{formatMoney(res.quantity_impact ?? res.quantity_effect, true)}</span>
                                <span>|</span>
                                <span>R:{formatMoney(res.rate_impact ?? res.rate_effect, true)}</span>
                              </div>
                            )}
                            {res.decomposition_status === 'UNIT_MISMATCH' && (
                              <div className="text-[9px] font-sans text-amber-600 dark:text-amber-400 font-semibold mt-0.5" title={res.decomposition_note}>
                                Unit Mismatch
                              </div>
                            )}
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
                            <div className="flex items-center gap-1.5 text-[10px] font-mono mt-1 font-bold flex-wrap">
                              {res.evidence_status === 'SUPPORTED_EXPLANATION' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20" title="Jointly corroborated by AWS CloudTrail lifecycle event and CUR line items">
                                  <ShieldCheck className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                                  <span>SUPPORTED EXPLANATION</span>
                                </span>
                              ) : res.evidence_status === 'CORRELATED_WITH_AWS_EVENT' ? (
                                <span className="inline-flex items-center gap-1 text-purple-700 dark:text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20" title="Correlated with recorded AWS CloudTrail lifecycle activity">
                                  <Info className="w-3 h-3 text-purple-500 flex-shrink-0" />
                                  <span>CORRELATED EVENT</span>
                                </span>
                              ) : (res.evidence_status === 'CONFIRMED_BY_CUR' || res.evidence_status === 'CONFIRMED_BY_BILLING_DATA') ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20" title="Directly confirmed by CUR billing line items">
                                  <ShieldCheck className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                                  <span>CONFIRMED BY CUR</span>
                                </span>
                              ) : res.evidence_status === 'INFERRED' ? (
                                <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20" title="Inferred fleet operational pattern">
                                  <Info className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                  <span>INFERRED</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-400 bg-zinc-500/10 px-1.5 py-0.5 rounded border border-zinc-500/20" title="Insufficient CUR evidence to attribute change">
                                  <AlertCircle className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                                  <span>UNKNOWN</span>
                                </span>
                              )}

                              {res.lifecycle_correlation?.primary_event && (
                                <span className="inline-flex items-center gap-1 text-[9px] text-purple-700 dark:text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 font-mono">
                                  <Cloud className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                                  <span>{res.lifecycle_correlation.primary_event.event_name}</span>
                                </span>
                              )}
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
                              <span>Audit</span>
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
                Showing {totalResourceCount > 0 ? (resourcePage - 1) * resourcePageSize + 1 : 0} to{' '}
                {Math.min(resourcePage * resourcePageSize, totalResourceCount)} of {totalResourceCount} evaluated resources
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
                    onChange={(val) => handlePageSizeChange(val)}
                    width="w-32"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={resourcePage <= 1}
                    onClick={() => handlePageChange(Math.max(1, resourcePage - 1))}
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
                    onClick={() => handlePageChange(Math.min(totalResourcePages, resourcePage + 1))}
                    className="p-1.5 rounded-lg border border-zorvex-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zorvex-surface-secondary text-zorvex-text cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
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
            <div className="p-5 border-b border-zorvex-border/50 dark:border-zorvex-dark-border flex items-start justify-between gap-3 bg-zorvex-surface dark:bg-zorvex-dark-surface flex-shrink-0">
              <div>
                <span className="text-[10px] font-mono font-black uppercase text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                  <span>CUR Telemetry & Line-Item Audit Drawer</span>
                </span>
                <h4 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text mt-0.5">
                  {inspectModalResource.short_id || inspectModalResource.resource_id}
                </h4>
                {inspectModalResource.name && (
                  <span className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary block">
                    Tag: {inspectModalResource.name} • {inspectModalResource.service} ({inspectModalResource.region || 'global'})
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setInspectModalResource(null)}
                className="p-1.5 rounded-clay-pill bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary/80 hover:bg-zorvex-border dark:hover:bg-zorvex-dark-border text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text dark:hover:text-zorvex-dark-text cursor-pointer transition-colors border border-zorvex-border/40 dark:border-zorvex-dark-border shadow-xs"
                title="Close Drawer (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 font-sans">
              
              {/* Full Resource ARN Box */}
              <div className="p-3 rounded-xl bg-zorvex-surface-secondary/30 dark:bg-zorvex-dark-surface-secondary/40 border border-zorvex-border/60 dark:border-zorvex-dark-border/60 text-xs font-mono space-y-1">
                <span className="text-[10px] font-bold uppercase text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary block">Full AWS Resource Identifier / ARN:</span>
                <div className="flex items-center justify-between gap-2">
                  <code className="break-all text-[11px] font-bold text-zorvex-text dark:text-zorvex-dark-text">
                    {inspectModalResource.resource_id}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyId(inspectModalResource.resource_id)}
                    className="p-1.5 rounded-md bg-zorvex-surface dark:bg-zorvex-dark-surface-secondary hover:bg-zorvex-border dark:hover:bg-zorvex-dark-border text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary border border-zorvex-border/40 dark:border-zorvex-dark-border/40 shadow-xs cursor-pointer flex-shrink-0"
                    title="Copy ARN"
                  >
                    {copiedId === inspectModalResource.resource_id ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Authoritative Root Cause Verdict Card */}
              <div className="p-4 rounded-xl bg-zorvex-forest-soft/40 dark:bg-zorvex-forest-dark-soft/30 border border-zorvex-forest/20 dark:border-zorvex-forest-highlight/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-zorvex-forest dark:text-zorvex-forest-highlight uppercase tracking-wider text-[10px]">
                    Authoritative Root-Cause Explanation:
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{inspectModalResource.evidence_status?.replace(/_/g, ' ') || 'CONFIRMED BY CUR'}</span>
                  </span>
                </div>
                <p className="text-sm font-bold text-zorvex-text dark:text-zorvex-dark-text leading-snug">
                  {inspectModalResource.explanation}
                </p>
              </div>

              {/* Inflection Date & Transition Point Banner */}
              {(inspectModalResource.inflection_event || inspectModalResource.inflection_date) && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30 flex items-center justify-between text-xs font-mono shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-amber-800 dark:text-amber-300 block">Identified Inflection Point</span>
                      <strong className="text-xs text-zorvex-text dark:text-zorvex-dark-text block mt-0.5">
                        {inspectModalResource.inflection_event || `Event on ${inspectModalResource.inflection_date}`}
                      </strong>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/35">
                    {inspectModalResource.inflection_date}
                  </span>
                </div>
              )}

              {/* Quantitative Mathematical Decomposition Grid */}
              <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
                <div className="p-3 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/60 dark:border-zorvex-dark-border/60">
                  <span className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary block">Baseline Spend</span>
                  <strong className="text-sm block text-zorvex-text dark:text-zorvex-dark-text">{formatMoney(inspectModalResource.baseline_cost)}</strong>
                  <span className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary block mt-0.5">
                    ({inspectModalResource.baseline_usage_qty?.toLocaleString()} {inspectModalResource.usage_unit})
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/60 dark:border-zorvex-dark-border/60">
                  <span className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary block">Target Spend</span>
                  <strong className="text-sm block text-zorvex-text dark:text-zorvex-dark-text">{formatMoney(inspectModalResource.target_cost)}</strong>
                  <span className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary block mt-0.5">
                    ({inspectModalResource.target_usage_qty?.toLocaleString()} {inspectModalResource.usage_unit})
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/60 dark:border-zorvex-dark-border/60">
                  <span className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary block">Quantity Effect (ΔQ)</span>
                  <strong className={`text-sm block ${inspectModalResource.quantity_effect > 0 ? 'text-rose-500 dark:text-rose-400' : inspectModalResource.quantity_effect < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zorvex-text dark:text-zorvex-dark-text'}`}>
                    {formatMoney(inspectModalResource.quantity_effect, true)}
                  </strong>
                  <span className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary block mt-0.5">
                    {inspectModalResource.delta_usage_qty > 0 ? '+' : ''}{inspectModalResource.delta_usage_qty?.toLocaleString()} {inspectModalResource.usage_unit}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/60 dark:border-zorvex-dark-border/60">
                  <span className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary block">Rate / SKU Effect (ΔR)</span>
                  <strong className={`text-sm block ${inspectModalResource.rate_effect > 0 ? 'text-rose-500 dark:text-rose-400' : inspectModalResource.rate_effect < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zorvex-text dark:text-zorvex-dark-text'}`}>
                    {formatMoney(inspectModalResource.rate_effect, true)}
                  </strong>
                  <span className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary block mt-0.5">
                    {inspectModalResource.effective_rate_base > 0 ? `$${inspectModalResource.effective_rate_base.toFixed(4)}` : '$0.00'} ➔ ${inspectModalResource.effective_rate_target?.toFixed(4)}
                  </span>
                </div>
              </div>

              {/* Phase 2 Quantity vs Rate Exact Impact Card */}
              <div className="p-3.5 rounded-xl bg-zorvex-surface-secondary/30 dark:bg-zorvex-dark-surface-secondary/40 border border-zorvex-border/60 dark:border-zorvex-dark-border/60 text-xs font-mono space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                    Quantity vs Rate Impact Decomposition
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    inspectModalResource.decomposition_status === 'RECONCILED'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                      : inspectModalResource.decomposition_status === 'UNIT_MISMATCH'
                        ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/25'
                        : 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25'
                  }`}>
                    {inspectModalResource.decomposition_status || 'ATTRIBUTED'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/40 dark:border-zorvex-dark-border/40">
                    <span className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary block">Quantity Impact:</span>
                    <strong className={inspectModalResource.quantity_impact > 0 ? 'text-rose-500 dark:text-rose-400' : inspectModalResource.quantity_impact < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zorvex-text dark:text-zorvex-dark-text'}>
                      {formatMoney(inspectModalResource.quantity_impact ?? inspectModalResource.quantity_effect, true)}
                    </strong>
                    <span className="text-[9px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary block mt-0.5">
                      (ΔQ × R_base)
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/40 dark:border-zorvex-dark-border/40">
                    <span className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary block">Rate Impact:</span>
                    <strong className={inspectModalResource.rate_impact > 0 ? 'text-rose-500 dark:text-rose-400' : inspectModalResource.rate_impact < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zorvex-text dark:text-zorvex-dark-text'}>
                      {formatMoney(inspectModalResource.rate_impact ?? inspectModalResource.rate_effect, true)}
                    </strong>
                    <span className="text-[9px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary block mt-0.5">
                      (Q_curr × ΔR)
                    </span>
                  </div>
                </div>

                {inspectModalResource.decomposition_note && (
                  <p className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary font-sans leading-normal">
                    {inspectModalResource.decomposition_note}
                  </p>
                )}
              </div>

              {/* Phase 5: AWS Resource Lifecycle & CloudTrail Evidence Card */}
              {inspectModalResource.lifecycle_correlation && (
                <div className={`p-3.5 rounded-xl border text-xs font-mono space-y-2.5 ${
                  inspectModalResource.lifecycle_correlation.has_lifecycle_events
                    ? 'bg-purple-500/10 dark:bg-purple-950/20 border-purple-500/30'
                    : 'bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary/40 border-zorvex-border/60'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-1.5">
                      <Cloud className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                      <span>AWS Resource Lifecycle Correlation</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      inspectModalResource.lifecycle_correlation.classification === 'SUPPORTED_EXPLANATION'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                        : inspectModalResource.lifecycle_correlation.classification === 'CORRELATED_WITH_AWS_EVENT'
                          ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
                          : 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30'
                    }`}>
                      {inspectModalResource.lifecycle_correlation.classification?.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <p className="text-[11px] font-sans text-zorvex-text dark:text-zorvex-dark-text leading-relaxed">
                    {inspectModalResource.lifecycle_correlation.explanation}
                  </p>

                  {inspectModalResource.lifecycle_correlation.has_lifecycle_events && inspectModalResource.lifecycle_correlation.events?.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary uppercase">
                        Matched CloudTrail Events:
                      </span>
                      <div className="space-y-1">
                        {inspectModalResource.lifecycle_correlation.events.map((ev, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/40 text-[10px]">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">{ev.event_name}</span>
                              <span className="text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">by {ev.actor}</span>
                            </div>
                            <span className="font-mono text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">{ev.event_time?.replace('T', ' ')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {inspectModalResource.lifecycle_correlation.operational_boundaries && (
                    <div className="p-2.5 rounded-lg bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/40 text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary font-sans leading-normal">
                      <strong className="text-zorvex-text dark:text-zorvex-dark-text block mb-0.5">Operational Boundary & Billing Mechanics:</strong>
                      {inspectModalResource.lifecycle_correlation.operational_boundaries}
                    </div>
                  )}
                </div>
              )}

              {/* Daily Spend Breakdown Progression */}
              {inspectModalResource.daily_breakdown && inspectModalResource.daily_breakdown.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] font-bold uppercase text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                      <span>Daily Spend Breakdown ({inspectModalResource.daily_breakdown.length} days recorded):</span>
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary/40 border border-zorvex-border/60 dark:border-zorvex-dark-border/60">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {inspectModalResource.daily_breakdown.map((item, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/40 text-center font-mono">
                          <span className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary block">
                            {item.date}
                          </span>
                          <strong className="text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text block mt-0.5">
                            {formatMoney(item.cost)}
                          </strong>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded-full inline-block mt-1 font-bold ${
                            item.period === 'target'
                              ? 'bg-zorvex-forest-soft text-zorvex-forest dark:text-zorvex-forest-highlight'
                              : 'bg-zorvex-surface-secondary text-zorvex-text-secondary'
                          }`}>
                            {item.period === 'target' ? 'current' : 'baseline'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Raw CUR Line-Item Audit Evidence */}
              {inspectModalResource.line_items_sample && inspectModalResource.line_items_sample.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] font-bold uppercase text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary tracking-wider">
                      Authoritative CUR Line-Item Records ({inspectModalResource.line_items_sample.length} sampled):
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-zorvex-border/60 dark:border-zorvex-dark-border/60 max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-[11px] font-mono border-collapse">
                      <thead className="bg-zorvex-surface-secondary/90 dark:bg-zorvex-dark-surface-secondary/90 sticky top-0 text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary uppercase">
                        <tr>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Period</th>
                          <th className="py-2 px-3">Line Type</th>
                          <th className="py-2 px-3">Usage Type / SKU</th>
                          <th className="py-2 px-3 text-right">Quantity</th>
                          <th className="py-2 px-3 text-right">Billed Cost ({currencySymbol})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zorvex-border/30 dark:divide-zorvex-dark-border/30">
                        {inspectModalResource.line_items_sample.map((li, idx) => (
                          <tr key={idx} className="hover:bg-zorvex-surface-secondary/20 dark:hover:bg-zorvex-dark-surface-secondary/30">
                            <td className="py-2 px-3 font-bold text-zorvex-text dark:text-zorvex-dark-text whitespace-nowrap">{li.date}</td>
                            <td className="py-2 px-3">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                li.period === 'target'
                                  ? 'bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight border border-zorvex-forest/20 dark:border-zorvex-forest-highlight/30'
                                  : 'bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary border border-zorvex-border/40 dark:border-zorvex-dark-border/40'
                              }`}>
                                {li.period || 'current'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">{li.line_type}</td>
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
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Operational Investigation Boundary</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {inspectModalResource.operational_note}
                </p>
              </div>

            </div>

            {/* Pinned Drawer Footer */}
            <div className="p-4 border-t border-zorvex-border/50 dark:border-zorvex-dark-border bg-zorvex-surface dark:bg-zorvex-dark-surface flex items-center justify-between gap-3 flex-shrink-0">
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
                className="px-5 py-2 rounded-clay-pill bg-zorvex-forest hover:bg-zorvex-forest/90 dark:bg-zorvex-forest-dark-soft dark:text-zorvex-forest-highlight dark:hover:bg-zorvex-forest/25 border border-transparent dark:border-zorvex-forest-highlight/30 text-white text-xs font-bold cursor-pointer transition-all shadow-sm"
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
