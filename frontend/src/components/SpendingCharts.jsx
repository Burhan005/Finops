import React, { useState, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { 
  TrendingUp, 
  PieChart as PieIcon, 
  Download, 
  Layers, 
  Activity, 
  FileSpreadsheet, 
  FileText,
  Image as ImageIcon,
  ChevronDown,
  Loader2,
  X,
  Calendar,
  BarChart2,
  ArrowLeft,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import AwsServiceIcon from './common/AwsServiceIcon';
import { getAwsServiceColor } from '../utils/awsServiceColors';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

function SpendingCharts({ overview, trends, currency = 'USD', forexData, filterService = 'All', onServiceChange, onDateRangeChange }) {
  if (!overview) return null;

  const chartRef = useRef(null);
  const toast = useToast();
  const [viewMode, setViewMode] = useState('daily'); // 'daily' | 'cumulative' | 'variance'
  const [exportOpen, setExportOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [inspectedDate, setInspectedDate] = useState(null);
  const [chartDisplayType, setChartDisplayType] = useState('trajectory'); // 'trajectory' | 'date_focus'

  // Check if gross usage data exists (e.g., when AWS credits offset net bill)
  const hasGross = Boolean(
    overview.daily_gross_totals && 
    Object.values(overview.daily_gross_totals).some(v => v > 0)
  );
  const [metricMode, setMetricMode] = useState('gross'); // 'gross' | 'net'

  // Dynamic Forex conversion rate ($1 = ₹95.32)
  const fxRate = forexData?.rate || 95.32;
  const isINR = currency === 'INR';
  const symbol = isINR ? '₹' : '$';

  // Format currency value helper
  const fmt = (val) => {
    const converted = isINR ? val * fxRate : val;
    return isINR 
      ? `₹${Math.round(converted).toLocaleString('en-IN')}`
      : `$${converted.toFixed(2)}`;
  };

  // Prepare Daily Trajectory Data
  const dailyTotals = (metricMode === 'gross' && hasGross)
    ? overview.daily_gross_totals
    : (overview.daily_totals || overview.daily_gross_totals || {});
  const dates = Object.keys(dailyTotals);
  const rawSpendData = dates.map(d => dailyTotals[d] || 0);

  // Compute Data according to ViewMode
  let chartDataValues = [];
  let chartLabel = '';
  const metricLabel = (metricMode === 'gross' && hasGross) ? 'Gross Usage' : 'Net Spend';

  if (viewMode === 'daily') {
    chartDataValues = rawSpendData.map(v => isINR ? Math.round(v * fxRate) : Number(v.toFixed(2)));
    chartLabel = `Daily ${metricLabel} (${symbol})`;
  } else if (viewMode === 'cumulative') {
    let running = 0;
    chartDataValues = rawSpendData.map(v => {
      running += isINR ? (v * fxRate) : v;
      return isINR ? Math.round(running) : Number(running.toFixed(2));
    });
    chartLabel = `Cumulative ${metricLabel} (${symbol})`;
  } else if (viewMode === 'variance') {
    chartDataValues = rawSpendData.map((v, idx) => {
      if (idx === 0) return 0;
      const prev = rawSpendData[idx - 1];
      if (prev <= 0) return 0;
      return Number((((v - prev) / prev) * 100).toFixed(2));
    });
    chartLabel = 'Day-over-Day Variance (%)';
  }

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const chartBg = isDark ? '#16171B' : '#FFFFFF';
  const primaryLineColor = viewMode === 'cumulative' 
    ? '#EC7211' 
    : viewMode === 'variance'
      ? '#D97706'
      : isDark ? '#FF9900' : '#EC7211';

  // Find highest spike date for instant 1-click drilldown
  const maxSpikeDate = React.useMemo(() => {
    if (dates.length === 0) return null;
    let maxIdx = 0;
    let maxVal = rawSpendData[0] || 0;
    for (let i = 1; i < rawSpendData.length; i++) {
      if (rawSpendData[i] > maxVal) {
        maxVal = rawSpendData[i];
        maxIdx = i;
      }
    }
    return { date: dates[maxIdx], spend: maxVal, idx: maxIdx };
  }, [dates, rawSpendData]);

  // Pick a couple of sample dates for quick access chips
  const sampleQuickDates = React.useMemo(() => {
    if (dates.length <= 1) return [];
    const list = [];
    const lastIdx = dates.length - 1;
    if (lastIdx !== maxSpikeDate?.idx) {
      list.push({ date: dates[lastIdx], spend: rawSpendData[lastIdx], idx: lastIdx, label: 'Latest' });
    }
    const midIdx = Math.floor(dates.length / 2);
    if (midIdx !== maxSpikeDate?.idx && midIdx !== lastIdx) {
      list.push({ date: dates[midIdx], spend: rawSpendData[midIdx], idx: midIdx, label: 'Mid' });
    }
    return list;
  }, [dates, rawSpendData, maxSpikeDate]);

  // Top contributing services for the inspected date from trends telemetry
  const inspectedDateServices = React.useMemo(() => {
    if (!inspectedDate?.date || !trends?.service_series) return [];
    const dateIdx = (trends.dates || []).indexOf(inspectedDate.date);
    if (dateIdx === -1) return [];

    const list = [];
    Object.keys(trends.service_series).forEach((svc) => {
      const arr = trends.service_series[svc];
      if (arr && arr[dateIdx] !== undefined && arr[dateIdx] > 0) {
        list.push({ service: svc, cost: arr[dateIdx] });
      }
    });

    list.sort((a, b) => b.cost - a.cost);
    return list.slice(0, 4);
  }, [inspectedDate, trends]);

  // Comprehensive service breakdown for the Focused Single-Day Bar Graph (Clean Top 5 + Others Rollup)
  const inspectedDateServiceData = React.useMemo(() => {
    if (!inspectedDate?.date) return [];

    let list = [];

    // Primary: Read from trends.service_series for the exact date
    if (trends?.service_series && trends?.dates) {
      const dateIdx = trends.dates.indexOf(inspectedDate.date);
      if (dateIdx !== -1) {
        Object.keys(trends.service_series).forEach((svc) => {
          if (svc.includes('(All)')) return; // Avoid double-counting composite EC2 (All)
          const arr = trends.service_series[svc];
          if (arr && arr[dateIdx] !== undefined && arr[dateIdx] > 0) {
            list.push({
              service: svc,
              cost: arr[dateIdx],
              color: getAwsServiceColor(svc)
            });
          }
        });
      }
    }

    // Fallback: Proportional distribution from overview.services
    if (list.length === 0 && overview?.services && inspectedDate.spend > 0) {
      const totalOverview = Object.values(overview.services).reduce((a, b) => a + b, 0);
      if (totalOverview > 0) {
        list = Object.entries(overview.services)
          .filter(([svc]) => !svc.includes('(All)'))
          .map(([svc, cost]) => {
            const share = cost / totalOverview;
            return {
              service: svc,
              cost: Number((inspectedDate.spend * share).toFixed(2)),
              color: getAwsServiceColor(svc)
            };
          });
      }
    }

    list.sort((a, b) => b.cost - a.cost);

    // Limit to Top 5 primary drivers + consolidated 'Other Services' to prevent cramped overlapping bars
    if (list.length > 5) {
      const top5 = list.slice(0, 5);
      const remainingCost = list.slice(5).reduce((sum, item) => sum + item.cost, 0);
      if (remainingCost > 0) {
        top5.push({
          service: 'Other Services',
          cost: Number(remainingCost.toFixed(2)),
          color: '#64748B' // Clean neutral slate for rollup
        });
      }
      return top5;
    }

    return list;
  }, [inspectedDate, trends, overview]);

  // Stepper handlers for Prev/Next day in Focused Date Mode
  const handlePrevDate = () => {
    if (!inspectedDate?.date || dates.length === 0) return;
    const curIdx = dates.indexOf(inspectedDate.date);
    const newIdx = curIdx > 0 ? curIdx - 1 : dates.length - 1;
    setInspectedDate({
      date: dates[newIdx],
      spend: rawSpendData[newIdx] || 0,
      idx: newIdx
    });
  };

  const handleNextDate = () => {
    if (!inspectedDate?.date || dates.length === 0) return;
    const curIdx = dates.indexOf(inspectedDate.date);
    const newIdx = curIdx < dates.length - 1 ? curIdx + 1 : 0;
    setInspectedDate({
      date: dates[newIdx],
      spend: rawSpendData[newIdx] || 0,
      idx: newIdx
    });
  };

  const dateFocusDayTotal = inspectedDate?.spend || inspectedDateServiceData.reduce((s, x) => s + x.cost, 0);

  const dateFocusBarData = {
    labels: inspectedDateServiceData.map(d => d.service),
    datasets: [
      {
        label: `Spend on ${inspectedDate?.date || ''} (${symbol})`,
        data: inspectedDateServiceData.map(d => isINR ? Math.round(d.cost * fxRate) : Number(d.cost.toFixed(2))),
        backgroundColor: inspectedDateServiceData.map(d => d.color),
        borderColor: inspectedDateServiceData.map(d => d.color),
        borderWidth: 1,
        borderRadius: 6,
        barThickness: 15,
        maxBarThickness: 18,
        categoryPercentage: 0.75,
        barPercentage: 0.85
      }
    ]
  };

  const dateFocusBarOptions = {
    indexAxis: 'y', // Clean horizontal layout for legible AWS service names
    responsive: true,
    maintainAspectRatio: false,
    devicePixelRatio: Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1, 2),
    animation: { duration: 300, easing: 'easeOutQuart' },
    layout: {
      padding: { top: 6, bottom: 6, left: 4, right: 12 }
    },
    onClick: (event, elements) => {
      if (elements && elements.length > 0 && onServiceChange) {
        const idx = elements[0].index;
        const clickedSvc = inspectedDateServiceData[idx]?.service;
        if (clickedSvc && clickedSvc !== 'Other Services') {
          onServiceChange(clickedSvc === filterService ? 'All' : clickedSvc);
        }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? 'rgba(20, 22, 28, 0.95)' : 'rgba(255, 255, 255, 0.97)',
        titleColor: isDark ? '#F8FAFC' : '#0F172A',
        bodyColor: isDark ? '#CBD5E1' : '#334155',
        titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: 800 },
        bodyFont: { family: 'IBM Plex Mono', size: 11, weight: 600 },
        padding: { top: 10, bottom: 10, left: 14, right: 14 },
        cornerRadius: 14,
        borderColor: isDark ? 'rgba(245, 158, 11, 0.55)' : 'rgba(236, 114, 17, 0.45)',
        borderWidth: 1.5,
        callbacks: {
          title: (items) => items[0] ? `⚡ Service: ${items[0].label}` : '',
          label: (context) => {
            const raw = context.raw || 0;
            const pct = dateFocusDayTotal > 0 ? ((raw / (isINR ? dateFocusDayTotal * fxRate : dateFocusDayTotal)) * 100).toFixed(1) : '0';
            return isINR 
              ? `  Allocation: ₹${Math.round(raw).toLocaleString('en-IN')} (${pct}% of day)` 
              : `  Allocation: $${raw.toFixed(2)} (${pct}% of day)`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: isDark ? 'rgba(40, 41, 48, 0.7)' : 'rgba(226, 232, 240, 0.85)' },
        ticks: {
          color: isDark ? '#94A3B8' : '#475569',
          font: { family: 'IBM Plex Mono', size: 10, weight: 600 },
          callback: (value) => isINR ? `₹${value}` : `$${value}`
        }
      },
      y: {
        grid: { display: false },
        ticks: {
          color: isDark ? '#F8FAFC' : '#0F172A',
          font: { family: 'Plus Jakarta Sans', size: 11, weight: 700 }
        }
      }
    }
  };

  // Average daily spend for benchmark variance
  const avgDailySpend = React.useMemo(() => {
    if (rawSpendData.length === 0) return 0;
    return rawSpendData.reduce((a, b) => a + b, 0) / rawSpendData.length;
  }, [rawSpendData]);

  const lineChartData = {
    labels: dates.map(d => d.slice(5)),
    datasets: [
      {
        label: chartLabel,
        data: chartDataValues,
        borderColor: primaryLineColor,
        backgroundColor: (context) => {
          const ctx = context.chart?.ctx;
          if (!ctx) return 'transparent';
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          if (viewMode === 'cumulative') {
            gradient.addColorStop(0, 'rgba(37, 99, 235, 0.22)');
            gradient.addColorStop(1, 'rgba(37, 99, 235, 0.01)');
          } else if (viewMode === 'variance') {
            gradient.addColorStop(0, 'rgba(217, 119, 6, 0.20)');
            gradient.addColorStop(1, 'rgba(217, 119, 6, 0.01)');
          } else {
            gradient.addColorStop(0, isDark ? 'rgba(175, 198, 155, 0.25)' : 'rgba(73, 102, 77, 0.22)');
            gradient.addColorStop(1, 'rgba(73, 102, 77, 0.01)');
          }
          return gradient;
        },
        fill: true,
        tension: viewMode === 'variance' ? 0.1 : 0.35,
        pointBackgroundColor: (ctx) => (inspectedDate?.idx === ctx.dataIndex ? '#EC7211' : chartBg),
        pointBorderColor: (ctx) => (inspectedDate?.idx === ctx.dataIndex ? (isDark ? '#FFFFFF' : '#0F172A') : primaryLineColor),
        pointBorderWidth: (ctx) => (inspectedDate?.idx === ctx.dataIndex ? 3 : 2),
        pointRadius: (ctx) => (inspectedDate?.idx === ctx.dataIndex ? 7 : 4),
        pointHoverRadius: 8,
        pointHitRadius: 35,
      }
    ]
  };

  // Direct canvas click handler (handles clicks anywhere on the graph)
  const handleLineClick = (e) => {
    const chart = chartRef.current;
    if (!chart) return;
    const evt = e.nativeEvent || e;
    const elements = chart.getElementsAtEventForMode(
      evt,
      'nearest',
      { intersect: false },
      true
    );
    if (elements && elements.length > 0) {
      const idx = elements[0].index;
      if (dates[idx]) {
        setInspectedDate({
          date: dates[idx],
          spend: rawSpendData[idx],
          idx
        });
      }
    }
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    devicePixelRatio: Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1, 2),
    animation: { duration: 350, easing: 'easeOutQuart' },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    onHover: (event, chartElement) => {
      const target = event?.native?.target;
      if (target) {
        target.style.cursor = chartElement && chartElement.length > 0 ? 'pointer' : 'default';
      }
    },
    onClick: (event, elements, chart) => {
      const chartInst = chart || chartRef.current;
      const evt = event?.native || event?.nativeEvent || event;
      if (!chartInst) return;
      
      const active = chartInst.getElementsAtEventForMode
        ? chartInst.getElementsAtEventForMode(evt, 'nearest', { intersect: false }, true)
        : elements;

      if (active && active.length > 0) {
        const idx = active[0].index;
        if (dates[idx]) {
          setInspectedDate({
            date: dates[idx],
            spend: rawSpendData[idx],
            idx
          });
        }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? 'rgba(20, 22, 28, 0.95)' : 'rgba(255, 255, 255, 0.97)',
        titleColor: isDark ? '#F8FAFC' : '#0F172A',
        bodyColor: isDark ? '#CBD5E1' : '#334155',
        titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: 800 },
        bodyFont: { family: 'IBM Plex Mono', size: 11, weight: 600 },
        padding: { top: 10, bottom: 10, left: 14, right: 14 },
        cornerRadius: 14,
        borderColor: isDark ? 'rgba(245, 158, 11, 0.55)' : 'rgba(236, 114, 17, 0.45)',
        borderWidth: 1.5,
        displayColors: false,
        callbacks: {
          title: (items) => {
            if (!items || items.length === 0) return '';
            const idx = items[0].dataIndex;
            const fullDate = dates[idx] || items[0].label;
            return `📅 Billing Date: ${fullDate}`;
          },
          label: (context) => {
            if (viewMode === 'variance') {
              const val = context.parsed.y;
              return `  Day-over-Day Velocity: ${val > 0 ? '+' : ''}${val.toFixed(2)}%`;
            }
            if (viewMode === 'cumulative') {
              const val = context.parsed.y;
              return isINR 
                ? `  Cumulative Total: ₹${Math.round(val).toLocaleString('en-IN')}` 
                : `  Cumulative Total: $${val.toFixed(2)}`;
            }
            const val = context.parsed.y;
            return isINR 
              ? `  Daily Spend: ₹${Math.round(val).toLocaleString('en-IN')}`
              : `  Daily Spend: $${val.toFixed(2)}`;
          },
          afterLabel: (context) => {
            const idx = context.dataIndex;
            const spend = rawSpendData[idx];
            if (spend !== undefined && avgDailySpend > 0 && viewMode === 'daily') {
              const diff = ((spend - avgDailySpend) / avgDailySpend) * 100;
              return `  Benchmark: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}% vs 16-day avg`;
            }
            return '';
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { 
          color: isDark ? '#94A3B8' : '#475569', 
          font: { family: 'IBM Plex Mono', size: 10, weight: 600 } 
        }
      },
      y: {
        grid: { color: isDark ? 'rgba(40, 41, 48, 0.7)' : 'rgba(226, 232, 240, 0.85)' },
        ticks: {
          color: isDark ? '#94A3B8' : '#475569',
          font: { family: 'IBM Plex Mono', size: 10, weight: 600 },
          callback: (value) => {
            if (viewMode === 'variance') return `${value}%`;
            if (isINR) {
              if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
              if (value >= 1000) return `₹${(value / 1000).toFixed(0)}k`;
              return `₹${value}`;
            }
            return `$${value}`;
          }
        }
      }
    }
  };

  // Prepare Service Breakdown Donut
  const services = overview.services || {};
  const topServices = Object.entries(services).slice(0, 5);
  const serviceLabels = topServices.map(([k]) => k);
  const serviceValues = topServices.map(([, v]) => isINR ? Math.round(v * fxRate) : Number(v.toFixed(2)));
  const totalAllocated = serviceValues.reduce((sum, v) => sum + (Number(v) || 0), 0);

  // Authentic Official AWS Architecture Service Colors (Matches exact AWS Architecture Icons)
  const serviceColors = serviceLabels.map(svcName => getAwsServiceColor(svcName));

  const doughnutData = {
    labels: serviceLabels,
    datasets: [
      {
        data: serviceValues,
        backgroundColor: serviceColors,
        borderWidth: 2,
        borderColor: isDark ? '#0D0E11' : '#FFFFFF',
        hoverOffset: 6
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    devicePixelRatio: Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1, 2),
    animation: { duration: 350, easing: 'easeOutQuart' },
    cutout: '72%',
    onClick: (event, elements) => {
      if (elements && elements.length > 0 && onServiceChange) {
        const idx = elements[0].index;
        const clicked = serviceLabels[idx];
        if (clicked) {
          onServiceChange(clicked === filterService ? 'All' : clicked);
        }
      }
    },
    plugins: {
      legend: {
        display: false // Replaced with bespoke AWS Architecture Icon interactive legend below
      },
      tooltip: {
        backgroundColor: isDark ? 'rgba(20, 22, 28, 0.95)' : 'rgba(255, 255, 255, 0.97)',
        titleColor: isDark ? '#F8FAFC' : '#0F172A',
        bodyColor: isDark ? '#CBD5E1' : '#334155',
        titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: 800 },
        bodyFont: { family: 'IBM Plex Mono', size: 11, weight: 600 },
        padding: { top: 10, bottom: 10, left: 14, right: 14 },
        cornerRadius: 14,
        borderColor: isDark ? 'rgba(245, 158, 11, 0.55)' : 'rgba(236, 114, 17, 0.45)',
        borderWidth: 1.5,
        callbacks: {
          title: (items) => items[0] ? `☁️ ${items[0].label}` : '',
          label: (context) => {
            const val = context.raw;
            const pct = totalAllocated > 0 ? ((val / totalAllocated) * 100).toFixed(1) : '0.0';
            return isINR 
              ? `  Spend: ₹${Math.round(val).toLocaleString('en-IN')} (${pct}% of total)` 
              : `  Spend: $${val.toFixed(2)} (${pct}% of total)`;
          }
        }
      }
    }
  };

  const exportRef = useRef(null);

  // Outside click listener for export dropdown
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    };
    if (exportOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportOpen]);

  // 1-Click Export Handlers
  const handleExportPNG = () => {
    if (chartRef.current) {
      const url = chartRef.current.toBase64Image();
      const link = document.createElement('a');
      link.download = `zorvex_spend_${viewMode}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = url;
      link.click();
      toast.success('PNG Chart Exported', 'High-res telemetry canvas capture saved.');
    }
    setExportOpen(false);
  };

  const handleExportExcel = async () => {
    try {
      setExportLoading(true);
      setExportOpen(false);
      await api.downloadExecutiveExcel(overview.baseline_date, overview.target_date, overview.account_id, currency);
      toast.success('Executive Excel Ready', 'Multi-sheet workbook generated.');
    } catch (err) {
      console.error('Failed to export Excel report:', err);
      alert('Failed to generate Excel report: ' + (err.message || 'Server error'));
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportCSV = () => {
    const rows = [['Date', `Daily_Spend_${currency}`, 'Cumulative_Spend_USD', 'Cumulative_Spend_INR']];
    let runUsd = 0;
    dates.forEach((d, i) => {
      const usd = rawSpendData[i] || 0;
      runUsd += usd;
      const inr = (usd * fxRate).toFixed(2);
      const runInr = (runUsd * fxRate).toFixed(2);
      rows.push([d, isINR ? inr : usd.toFixed(2), runUsd.toFixed(2), runInr]);
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `zorvex_telemetry_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV Dataset Exported', 'Filtered spend telemetry saved.');
    setExportOpen(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Daily Spending Trajectory (2 Cols) */}
      <div className="clay-card p-4 sm:p-6 lg:col-span-2 flex flex-col space-y-4">
        
        {/* Header Controls: Title, ViewMode Toggles & Export */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-zorvex-forest dark:text-zorvex-dark-forest" />
              <span>Spend Trajectory & Velocity</span>
            </h3>
            <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">
              Monitoring telemetry velocity across {dates.length} billing dates ({symbol})
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            
            {/* Metric Mode Toggle: Gross Usage vs Net Invoiced (when credits/adjustments exist) */}
            {hasGross && (
              <div className="surface-recessed inline-flex items-center p-1 rounded-2xl gap-1 text-xs font-extrabold">
                <button
                  type="button"
                  onClick={() => setMetricMode('gross')}
                  className={`px-2.5 py-1 rounded-lg transition-all duration-150 text-[11px] font-extrabold cursor-pointer ${
                    metricMode === 'gross'
                      ? 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-forest dark:text-zorvex-dark-forest shadow-sm'
                      : 'text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text'
                  }`}
                  title="Show gross AWS resource usage costs"
                >
                  Gross Usage
                </button>
                <button
                  type="button"
                  onClick={() => setMetricMode('net')}
                  className={`px-2.5 py-1 rounded-lg transition-all duration-150 text-[11px] font-extrabold cursor-pointer ${
                    metricMode === 'net'
                      ? 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-forest dark:text-zorvex-dark-forest shadow-sm'
                      : 'text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text'
                  }`}
                  title="Show net invoiced costs (with credits & refunds)"
                >
                  Net Invoiced
                </button>
              </div>
            )}

            {/* Quick Solo Service Pills */}
            <div className="hidden sm:inline-flex surface-recessed items-center p-1 rounded-2xl gap-1 text-xs font-extrabold">
              <button
                type="button"
                onClick={() => onServiceChange && onServiceChange('All')}
                className={`px-2.5 py-1 rounded-lg transition-all duration-150 text-[11px] font-extrabold cursor-pointer active-tactile ${
                  !filterService || filterService === 'All'
                    ? 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-forest dark:text-zorvex-dark-forest shadow-sm'
                    : 'text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text'
                }`}
                title="View combined telemetry across all AWS services"
              >
                All Services
              </button>
              {topServices.slice(0, 3).map(([svc]) => {
                const isCurrent = filterService === svc;
                const short = svc.replace('Amazon ', '').replace('AWS ', '');
                return (
                  <button
                    key={svc}
                    type="button"
                    onClick={() => onServiceChange && onServiceChange(isCurrent ? 'All' : svc)}
                    className={`px-2 py-1 rounded-lg transition-all duration-150 text-[11px] font-extrabold cursor-pointer active-tactile flex items-center gap-1 ${
                      isCurrent
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text'
                    }`}
                    title={`Solo isolate ${svc}`}
                  >
                    <AwsServiceIcon service={svc} size="xs" className="w-3 h-3 flex-shrink-0" />
                    <span>{short}</span>
                  </button>
                );
              })}
            </div>

            {/* View Mode Segmented Controls */}
            <div className="surface-recessed inline-flex items-center p-1 rounded-2xl gap-1 text-xs font-extrabold">
              <button
                type="button"
                onClick={() => {
                  setChartDisplayType('trajectory');
                  setViewMode('daily');
                }}
                className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all duration-150 text-[11px] font-extrabold cursor-pointer active-tactile ${
                  chartDisplayType === 'trajectory' && viewMode === 'daily'
                    ? 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-forest dark:text-zorvex-dark-forest shadow-sm'
                    : 'text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text'
                }`}
              >
                <span className="hidden sm:inline">16-Day </span>Trajectory
              </button>
              <button
                type="button"
                onClick={() => {
                  setChartDisplayType('trajectory');
                  setViewMode('cumulative');
                }}
                className={`px-3 py-1 rounded-lg transition-all duration-150 text-[11px] font-extrabold cursor-pointer ${
                  chartDisplayType === 'trajectory' && viewMode === 'cumulative'
                    ? 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text'
                }`}
              >
                Cumulative
              </button>
              <button
                type="button"
                onClick={() => {
                  setChartDisplayType('trajectory');
                  setViewMode('variance');
                }}
                className={`px-3 py-1 rounded-lg transition-all duration-150 text-[11px] font-extrabold cursor-pointer ${
                  chartDisplayType === 'trajectory' && viewMode === 'variance'
                    ? 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text'
                }`}
              >
                % Variance
              </button>
              {inspectedDate && (
                <button
                  type="button"
                  onClick={() => setChartDisplayType(chartDisplayType === 'date_focus' ? 'trajectory' : 'date_focus')}
                  className={`px-3 py-1 rounded-lg transition-all duration-150 text-[11px] font-extrabold cursor-pointer flex items-center gap-1.5 ${
                    chartDisplayType === 'date_focus'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300'
                  }`}
                  title="Toggle focused single-day service breakdown"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Focus: {inspectedDate.date.slice(5)}</span>
                </button>
              )}
            </div>

            {/* 1-Click Export Dropdown */}
            <div className="relative" ref={exportRef}>
              <button
                type="button"
                onClick={() => setExportOpen(!exportOpen)}
                disabled={exportLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border text-xs font-extrabold text-zorvex-text dark:text-zorvex-dark-text hover:border-zorvex-forest/50 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                title="Export Chart Image or Data"
              >
                {exportLoading ? (
                  <Loader2 className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-dark-forest animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-dark-forest" />
                )}
                <span>{exportLoading ? 'Exporting...' : 'Export'}</span>
                <ChevronDown className={`w-3 h-3 text-zorvex-text-secondary transition-transform duration-200 ${exportOpen ? 'rotate-180' : ''}`} />
              </button>

              {exportOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-56 rounded-2xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-surface-floating z-30 p-2 animate-fade-in">
                  <div className="px-2.5 py-1.5 border-b border-zorvex-border dark:border-zorvex-dark-border mb-1">
                    <p className="text-[11px] font-extrabold text-zorvex-text dark:text-zorvex-dark-text">Telemetry Export</p>
                    <p className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">Save charts or workbook</p>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportPNG}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text hover:bg-zorvex-surface-secondary dark:hover:bg-zorvex-dark-surface-secondary flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <ImageIcon className="w-4 h-4 text-zorvex-forest dark:text-zorvex-dark-forest flex-shrink-0" />
                    <div>
                      <div>Download PNG Chart</div>
                      <div className="text-[10px] text-zorvex-text-secondary font-normal">High-res canvas capture</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text hover:bg-zorvex-surface-secondary dark:hover:bg-zorvex-dark-surface-secondary flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span>Formatted Excel (.xlsx)</span>
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300">XLSX</span>
                      </div>
                      <div className="text-[10px] text-zorvex-text-secondary font-normal">Multi-tab executive workbook</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text hover:bg-zorvex-surface-secondary dark:hover:bg-zorvex-dark-surface-secondary flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <FileText className="w-4 h-4 text-zorvex-text-secondary flex-shrink-0" />
                    <div>
                      <div>Export CSV Dataset</div>
                      <div className="text-[10px] text-zorvex-text-secondary font-normal">Filtered spend trajectory</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

        {dates.length === 0 ? (
          <div className="h-64 w-full flex flex-col items-center justify-center text-center p-6 bg-zorvex-surface-secondary/40 rounded-2xl border border-dashed border-zorvex-border dark:border-zorvex-dark-border">
            <TrendingUp className="w-8 h-8 text-zorvex-forest dark:text-zorvex-dark-forest opacity-40 mb-2" />
            <p className="text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text">No Telemetry in Selected Date Range</p>
            <p className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">Adjust the date range or select "ALL" to view historical cloud spend.</p>
          </div>
        ) : (
          <div>
            {/* Professional Telemetry Date Selector (Zero Emojis / Vibecoding) */}
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5 px-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-zorvex-text-muted flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-zorvex-text-muted" />
                  <span>Select Date to Inspect:</span>
                </span>

                {maxSpikeDate && maxSpikeDate.spend > 0 && (
                  <button
                    type="button"
                    onClick={() => setInspectedDate({ date: maxSpikeDate.date, spend: maxSpikeDate.spend, idx: maxSpikeDate.idx })}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer border ${
                      inspectedDate?.date === maxSpikeDate.date
                        ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                        : 'surface-recessed text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                    }`}
                    title="Inspect highest spend date"
                  >
                    <span className="text-[10px] uppercase font-bold tracking-wider">Peak Spend:</span>
                    <span>{maxSpikeDate.date.slice(5)} ({fmt(maxSpikeDate.spend)})</span>
                  </button>
                )}

                {sampleQuickDates.map((qd) => (
                  <button
                    key={qd.date}
                    type="button"
                    onClick={() => setInspectedDate({ date: qd.date, spend: qd.spend, idx: qd.idx })}
                    className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer border ${
                      inspectedDate?.date === qd.date
                        ? 'bg-zorvex-forest text-white border-zorvex-forest shadow-sm'
                        : 'surface-recessed text-zorvex-text-muted hover:text-zorvex-text border-zorvex-border/60'
                    }`}
                  >
                    {qd.label ? `${qd.label} ` : ''}{qd.date.slice(5)}: {fmt(qd.spend)}
                  </button>
                ))}
              </div>

              {inspectedDate ? (
                <button
                  type="button"
                  onClick={() => setChartDisplayType(chartDisplayType === 'date_focus' ? 'trajectory' : 'date_focus')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-zorvex-forest text-white hover:bg-zorvex-forest/90 transition-all cursor-pointer shadow-xs ml-auto"
                  title="Switch chart to focus on this single date"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>{chartDisplayType === 'date_focus' ? '← Full Curve' : `Focus ${inspectedDate.date.slice(5)} Graph ↗`}</span>
                </button>
              ) : (
                <span className="hidden sm:inline text-[11px] font-mono text-zorvex-text-muted">
                  Click any curve point or date chip
                </span>
              )}
            </div>

            {chartDisplayType === 'date_focus' && inspectedDate ? (
              <div className="space-y-2.5">
                {/* Single-Day Stepper Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-2.5 rounded-xl surface-recessed border border-zorvex-border/60 dark:border-zorvex-dark-border/60">
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setChartDisplayType('trajectory')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold surface-raised hover:bg-zorvex-surface-secondary text-zorvex-text hover:text-zorvex-forest transition-colors cursor-pointer border border-zorvex-border/70 dark:border-zorvex-dark-border/70 active-tactile"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Full Curve</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handlePrevDate}
                        className="p-1 rounded-lg hover:surface-raised text-zorvex-text-secondary hover:text-zorvex-text cursor-pointer transition-colors active-tactile"
                        title="Previous Day"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      
                      <span className="font-mono text-xs font-black text-zorvex-text dark:text-zorvex-dark-text px-2 py-0.5 rounded-md surface-raised border border-zorvex-border/80 dark:border-zorvex-dark-border/80">
                        {inspectedDate.date}
                      </span>

                      <button
                        type="button"
                        onClick={handleNextDate}
                        className="p-1 rounded-lg hover:surface-raised text-zorvex-text-secondary hover:text-zorvex-text cursor-pointer transition-colors active-tactile"
                        title="Next Day"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between w-full sm:w-auto gap-2 text-right">
                    <span className="text-[11px] font-mono text-zorvex-text-secondary">
                      Day Total: <strong className="text-zorvex-forest dark:text-zorvex-dark-forest font-black">{fmt(inspectedDate.spend)}</strong>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                      {dates.indexOf(inspectedDate.date) + 1}/{dates.length}
                    </span>
                  </div>
                </div>

                {/* Horizontal Service Breakdown Bar Chart for the Single Date (With Unique Key & Clean Spacing) */}
                <div className="h-64 w-full p-3 rounded-2xl surface-recessed border border-slate-200/70 dark:border-[#202128]">
                  {inspectedDateServiceData.length === 0 ? (
                    <div className="h-full w-full flex flex-col items-center justify-center text-center p-4">
                      <BarChart2 className="w-6 h-6 text-zorvex-text-muted opacity-40 mb-1.5" />
                      <p className="text-xs font-bold text-zorvex-text">No Service Costs on {inspectedDate.date}</p>
                      <p className="text-[11px] text-zorvex-text-secondary">Zero resource consumption recorded on this billing date.</p>
                    </div>
                  ) : (
                    <Bar 
                      key={`focus-bar-${inspectedDate.date}-${currency}`}
                      data={dateFocusBarData} 
                      options={dateFocusBarOptions} 
                    />
                  )}
                </div>

                {/* Service Contribution Quick Chips with Authentic AWS Icons */}
                {inspectedDateServiceData.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
                    {inspectedDateServiceData.map((item) => {
                      const pct = dateFocusDayTotal > 0 ? ((item.cost / dateFocusDayTotal) * 100).toFixed(1) : '0';
                      return (
                        <div 
                          key={item.service}
                          onClick={() => {
                            if (item.service !== 'Other Services' && onServiceChange) {
                              onServiceChange(item.service === filterService ? 'All' : item.service);
                            }
                          }}
                          className={`p-2 rounded-xl surface-raised border border-zorvex-border/60 dark:border-zorvex-dark-border/60 flex flex-col justify-between transition-all ${
                            item.service !== 'Other Services' ? 'cursor-pointer hover:border-zorvex-forest/50 hover:shadow-xs' : ''
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 truncate">
                            {item.service !== 'Other Services' ? (
                              <AwsServiceIcon service={item.service} size={14} />
                            ) : (
                              <span className="w-3.5 h-3.5 rounded bg-slate-500/30 flex items-center justify-center text-[9px] font-bold text-slate-400">...</span>
                            )}
                            <span className="text-[11px] font-bold text-zorvex-text dark:text-zorvex-dark-text truncate" title={item.service}>
                              {item.service.replace('Amazon ', '').replace('AWS ', '')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-mono mt-0.5">
                            <span className="font-extrabold text-zorvex-text dark:text-zorvex-dark-text">{fmt(item.cost)}</span>
                            <span className="text-[10px] text-zorvex-text-muted">{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 w-full p-2.5 rounded-2xl surface-recessed border border-slate-200/70 dark:border-[#202128]">
                <Line ref={chartRef} data={lineChartData} options={lineChartOptions} onClick={handleLineClick} />
              </div>
            )}
          </div>
        )}

        {/* Interactive Click-to-Drilldown Date Inspector Drawer */}
        {inspectedDate && (
          <div className="mt-3.5 p-4 rounded-2xl surface-raised border border-zorvex-border dark:border-zorvex-dark-border shadow-surface-raised animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zorvex-border/60 dark:border-zorvex-dark-border/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl surface-recessed flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight">
                  <Activity className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <div className="text-xs font-black text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-2">
                    <span>{inspectedDate.date} Telemetry Drilldown</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      Day {dates.indexOf(inspectedDate.date) + 1} of {dates.length}
                    </span>
                  </div>
                  <div className="text-[11px] text-zorvex-text-muted mt-0.5">
                    Total Day Spend: <span className="font-mono font-bold text-zorvex-forest dark:text-zorvex-forest-highlight">{fmt(inspectedDate.spend)}</span>
                    {avgDailySpend > 0 && (
                      <span className={`ml-2 font-mono font-semibold ${
                        inspectedDate.spend > avgDailySpend ? 'text-rose-500' : 'text-emerald-500'
                      }`}>
                        ({inspectedDate.spend > avgDailySpend ? '+' : ''}{(((inspectedDate.spend - avgDailySpend) / avgDailySpend) * 100).toFixed(1)}% vs avg)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setChartDisplayType(chartDisplayType === 'date_focus' ? 'trajectory' : 'date_focus')}
                  className="px-2.5 py-1 rounded-clay-pill bg-zorvex-forest text-white hover:bg-zorvex-forest/90 text-[11px] font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Toggle single-day graph view"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>{chartDisplayType === 'date_focus' ? 'View Full Trajectory' : 'Focus Day Graph'}</span>
                </button>
                {onDateRangeChange && (
                  <button
                    type="button"
                    onClick={() => onDateRangeChange(inspectedDate.date, inspectedDate.date)}
                    className="px-2.5 py-1 rounded-clay-pill surface-recessed hover:surface-raised text-[11px] font-bold text-zorvex-text hover:text-zorvex-forest transition-all border border-zorvex-border/80 dark:border-zorvex-dark-border/80 cursor-pointer"
                    title="Filter entire platform to this specific date"
                  >
                    Filter to Date
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setInspectedDate(null)}
                  className="p-1 rounded-lg text-zorvex-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text cursor-pointer"
                  title="Close inspector"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Contributing Services on this Date */}
            {inspectedDateServices.length > 0 && (
              <div className="pt-3">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-zorvex-text-muted mb-2">
                  Top Contributing Services on this Day:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {inspectedDateServices.map((svcItem, sIdx) => (
                    <div 
                      key={sIdx}
                      className="p-2 rounded-xl surface-recessed border border-zorvex-border/50 dark:border-zorvex-dark-border/50 flex items-center justify-between gap-1.5"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <AwsServiceIcon service={svcItem.service} size="xs" className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="text-[11px] font-bold text-zorvex-text dark:text-zorvex-dark-text truncate" title={svcItem.service}>
                          {svcItem.service}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] font-black text-zorvex-text dark:text-zorvex-dark-text flex-shrink-0">
                        {fmt(svcItem.cost)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Service Spend Breakdown (1 Col) */}
      <div className="clay-card p-4 sm:p-6 flex flex-col space-y-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-[#EC7211] dark:text-[#FF9900]" />
              <span>Service Allocation</span>
            </h3>
            <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">
              Top AWS services breakdown ({symbol})
            </p>
          </div>
          {filterService && filterService !== 'All' && (
            <button
              type="button"
              onClick={() => onServiceChange && onServiceChange('All')}
              className="text-[10px] font-extrabold text-[#EC7211] dark:text-[#FF9900] hover:underline cursor-pointer bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/25 transition-all"
              title="Reset service filter back to All Services"
            >
              Reset to All
            </button>
          )}
        </div>

        {/* Debossed Carved Socket Housing Donut & Cockpit Gauge */}
        <div className="p-3 rounded-2xl surface-recessed border border-slate-200/70 dark:border-[#202128] flex flex-col items-center">
          
          {/* Donut Chart with Embedded Center Telemetry Core */}
          <div className="h-48 w-full relative flex items-center justify-center">
            <Doughnut data={doughnutData} options={doughnutOptions} />

            {/* Tactile Gauge Center Core */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 leading-none">
                {filterService && filterService !== 'All' ? 'Scoped' : 'Allocated'}
              </span>
              <span className="text-sm sm:text-base font-black text-zorvex-text dark:text-zorvex-dark-text font-mono tracking-tight leading-tight mt-1">
                {isINR 
                  ? `₹${Math.round(totalAllocated).toLocaleString('en-IN')}` 
                  : `$${totalAllocated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                }
              </span>
              <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 font-mono mt-0.5 leading-none">
                {serviceLabels.length} {serviceLabels.length === 1 ? 'Service' : 'Services'}
              </span>
            </div>
          </div>

          {/* Bespoke Interactive Legend with Tactile Clay Pills & Solo Filter Toggles */}
          <div className="w-full mt-2.5 pt-2.5 border-t border-slate-200/60 dark:border-[#202128] space-y-1.5">
            {topServices.map(([svcName, rawCost], idx) => {
              const svcColor = serviceColors[idx] || '#FF9900';
              const val = serviceValues[idx] || 0;
              const pct = totalAllocated > 0 ? ((val / totalAllocated) * 100).toFixed(1) : '0';
              const isSelected = filterService === svcName;

              return (
                <button
                  key={svcName}
                  type="button"
                  onClick={() => onServiceChange && onServiceChange(isSelected ? 'All' : svcName)}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all duration-150 cursor-pointer active-tactile ${
                    isSelected 
                      ? 'surface-raised border border-amber-500/70 ring-1 ring-amber-500/40 shadow-xs' 
                      : 'surface-recessed hover:surface-raised hover:border-zorvex-border/80 border border-transparent'
                  }`}
                  title={isSelected ? `Click to clear filter and show All Services` : `Click to solo-isolate ${svcName} across all telemetry`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <AwsServiceIcon service={svcName} size="xs" />
                    <span className="text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text truncate">
                      {svcName.replace('Amazon ', '').replace('AWS ', '')}
                    </span>
                    {isSelected && (
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-mono flex items-center gap-0.5">
                        Solo Active ✕
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-mono font-bold text-zorvex-text dark:text-zorvex-dark-text">
                      {isINR ? `₹${Math.round(val).toLocaleString('en-IN')}` : `$${val.toFixed(2)}`}
                    </span>
                    <span 
                      className="text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded-md"
                      style={{
                        backgroundColor: `${svcColor}22`,
                        color: svcColor
                      }}
                    >
                      {pct}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

        </div>
      </div>

    </div>
  );
}


export default React.memo(SpendingCharts);
