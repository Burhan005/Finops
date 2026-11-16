import React, { useState, useMemo, useEffect } from 'react';
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
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  Server,
  Clock,
  AlertTriangle,
  Cpu,
  Calendar,
  Search,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Check,
  RotateCcw,
  Activity,
  Layers,
  Sparkles,
  Zap,
  TrendingDown,
  Moon
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);
import AwsServiceIcon from './AwsServiceIcon';
import ClusterMeshIcon from './ClusterMeshIcon';
import ServerlessLambdaIcon from './ServerlessLambdaIcon';
import ClayDatePicker from './ClayDatePicker';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS = {
  Sun: 'Sunday',
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday'
};

// Format IST "HH:MM" (e.g. "10:30") to readable 12-hour label: "10:30 AM IST"
function formatTime12h(timeStr) {
  if (!timeStr) return '';
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return timeStr;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm} IST`;
}

// Convert IST "HH:MM" to UTC string: "05:00 UTC"
function istToUtcStr(timeStr) {
  if (!timeStr) return '';
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return timeStr;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const totalIstMins = h * 60 + m;
  const utcTotal = (totalIstMins - 330 + 1440) % 1440;
  const utcH = Math.floor(utcTotal / 60);
  const utcM = utcTotal % 60;
  return `${String(utcH).padStart(2, '0')}:${String(utcM).padStart(2, '0')} UTC`;
}

// Convert UTC "HH:MM" (e.g. "04:00") to short IST label "09:30 AM"
function formatUtcShortIST(utcHourStr) {
  if (!utcHourStr) return '';
  const match = utcHourStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return utcHourStr;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const totalMins = (h * 60 + m + 330) % 1440;
  const istH = Math.floor(totalMins / 60);
  const istM = totalMins % 60;
  const ampm = istH >= 12 ? 'PM' : 'AM';
  const h12 = istH % 12 === 0 ? 12 : istH % 12;
  return `${String(h12).padStart(2, '0')}:${String(istM).padStart(2, '0')} ${ampm}`;
}

// Format Date string "YYYY-MM-DD" to "DD MMM YYYY (DayName)" in IST
function formatDateWithDayIST(dateStr) {
  if (!dateStr || dateStr === 'Today' || dateStr === 'Live') return dateStr || 'Live';
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const parts = dateStr.split('-');
    const d = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
    const dayName = DAYS_OF_WEEK[d.getUTCDay()];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mIdx = parseInt(parts[1], 10) - 1;
    return `${parts[2]} ${months[mIdx] || parts[1]} ${parts[0]} (${FULL_DAYS[dayName] || dayName})`;
  }
  return `${dateStr} (IST)`;
}

// Convert IST "HH:MM" to UTC total minutes (0 to 1439)
function istTimeToUtcMins(istTimeStr) {
  if (!istTimeStr) return 0;
  const [h, m] = istTimeStr.split(':').map(Number);
  const totalIst = (h || 0) * 60 + (m || 0);
  return (totalIst - 330 + 1440) % 1440;
}

// Mathematical helper to evaluate whether an hourly UTC bucket is outside the user's custom window
function evaluateUtcHourOvertime(utcHourInt, startUtcMins, stopUtcMins) {
  if (startUtcMins === stopUtcMins) {
    return { isOvertime: false, fraction: 0, reason: '' };
  }

  // Midpoint of the hour in UTC minutes (Hour 4 mid = 04:30 UTC / 10:00 AM IST; Hour 11 mid = 11:30 UTC / 05:00 PM IST)
  const hourMidMins = utcHourInt * 60 + 30;

  // Window does not wrap around UTC midnight (e.g. 04:30 UTC to 11:30 UTC for 10:00 AM to 05:00 PM IST)
  if (startUtcMins < stopUtcMins) {
    if (hourMidMins > stopUtcMins + 15) {
      return { isOvertime: true, fraction: 1.0, reason: 'Ran Past Scheduled Cutoff Time' };
    }
    if (hourMidMins < startUtcMins - 15) {
      return { isOvertime: true, fraction: 1.0, reason: 'Ran Before Scheduled Boot Time' };
    }
    return { isOvertime: false, fraction: 0, reason: 'Within Scheduled Operating Window' };
  }

  // Window wraps around UTC midnight (e.g. overnight shifts)
  if (hourMidMins > stopUtcMins + 15 && hourMidMins < startUtcMins - 15) {
    return { isOvertime: true, fraction: 1.0, reason: 'Outside Scheduled Operating Window' };
  }
  return { isOvertime: false, fraction: 0, reason: 'Within Scheduled Operating Window' };
}

export default function ClusterLifecycleCard({
  clusterData,
  loading = false,
  selectedDate,
  availableDates = [],
  onDateChange,
  selectedCluster,
  onSelectCluster,
  onSelectResource,
  serviceName = 'Amazon EKS'
}) {
  const serviceKey = useMemo(() => {
    const s = (serviceName || clusterData?.orchestrator || '').toLowerCase();
    if (s.includes('ecs')) return 'ECS';
    return 'EKS';
  }, [serviceName, clusterData]);

  // Authentic Check: Does the active CUR dataset contain real nodes?
  const hasLiveCurCluster = useMemo(() => {
    return Boolean(clusterData && clusterData.nodes && clusterData.nodes.length > 0);
  }, [clusterData]);

  const [hoveredHour, setHoveredHour] = useState(null);
  const [nodeSearch, setNodeSearch] = useState('');
  const [fleetFilter, setFleetFilter] = useState('ALL'); // 'ALL' | 'RUNNING' | 'TERMINATED'
  const [timelineViewMode, setTimelineViewMode] = useState('GANTT'); // 'GANTT' | 'WAVE' | 'TABLE'

  // User-Controlled Operational Schedule State
  const [scheduleMode, setScheduleMode] = useState('CUSTOM'); // 'CUSTOM' | '24_7'
  const [selectedDays, setSelectedDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [startTimeIST, setStartTimeIST] = useState('10:00'); // 10:00 AM IST
  const [stopTimeIST, setStopTimeIST] = useState('17:00'); // 05:00 PM IST

  // Smart Cluster Persona Presets (Auto-adapts to cluster type without locking the user out of manual edits)
  useEffect(() => {
    if (!selectedCluster) return;
    const lower = selectedCluster.toLowerCase();
    if (lower.includes('prod')) {
      setScheduleMode('24_7');
    } else if (lower.includes('staging') || lower.includes('qa')) {
      setScheduleMode('CUSTOM');
      setStartTimeIST('08:30');
      setStopTimeIST('20:00');
      setSelectedDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    } else if (lower.includes('ml') || lower.includes('batch') || lower.includes('gpu')) {
      setScheduleMode('CUSTOM');
      setStartTimeIST('21:30');
      setStopTimeIST('04:30');
      setSelectedDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    } else if (lower.includes('dev')) {
      setScheduleMode('CUSTOM');
      setStartTimeIST('10:00');
      setStopTimeIST('17:00');
      setSelectedDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    }
  }, [selectedCluster]);

  // Evaluate the Day of Week for selected date in IST
  const effectiveDate = selectedDate || clusterData?.target_date || availableDates?.[0] || '';
  const currentDayOfWeek = useMemo(() => {
    if (!effectiveDate || !/^\d{4}-\d{2}-\d{2}/.test(effectiveDate)) return 'Fri';
    const parts = effectiveDate.split('-');
    const d = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
    return DAYS_OF_WEEK[d.getUTCDay()] || 'Fri';
  }, [effectiveDate]);

  // Is the currently viewed day an unscheduled off-day (e.g. Weekend or Unselected Day)?
  const isTodayOffDay = useMemo(() => {
    if (scheduleMode === '24_7') return false;
    return !selectedDays.includes(currentDayOfWeek);
  }, [scheduleMode, selectedDays, currentDayOfWeek]);

  // Calculate UTC boundary minutes for custom schedule
  const startUtcMins = useMemo(() => istTimeToUtcMins(startTimeIST), [startTimeIST]);
  const stopUtcMins = useMemo(() => istTimeToUtcMins(stopTimeIST), [stopTimeIST]);

  // Toggle individual day chip
  const toggleDay = (day) => {
    setSelectedDays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day);
      }
      return [...prev, day];
    });
  };

  // Compute effective timeline and stats based on user schedule and live CUR
  const clusterView = useMemo(() => {
    if (hasLiveCurCluster) {
      const kpis = clusterData.kpis || {};
      const rawTimeline = clusterData.hourly_timeline || [];
      const nodes = clusterData.nodes || [];
      const cpSpend = kpis.control_plane_spend_today !== undefined 
        ? kpis.control_plane_spend_today 
        : (serviceKey === 'ECS' ? 0.0 : 2.40);

      // Re-evaluate hourly timeline with User Custom Schedule in IST
      let computeSpendToday = 0;
      let overtimeCost = 0;
      let overtimeHours = 0;
      let peakNodes = 0;

      const hourlyTimeline = rawTimeline.map((item, hIdx) => {
        const cnt = item.node_count || 0;
        const cost = Number(item.cost || 0);
        computeSpendToday += cost;
        if (cnt > peakNodes) peakNodes = cnt;

        let isOt = false;
        let otReason = '';

        if (scheduleMode === 'CUSTOM') {
          if (isTodayOffDay) {
            isOt = cnt > 0;
            otReason = `Weekend / Off-Day Run (${FULL_DAYS[currentDayOfWeek]} Unscheduled)`;
            if (isOt) {
              overtimeCost += cost;
              overtimeHours += 1;
            }
          } else {
            const otEval = evaluateUtcHourOvertime(hIdx, startUtcMins, stopUtcMins);
            isOt = (cnt > 0) && otEval.isOvertime;
            otReason = otEval.reason;
            if (isOt) {
              overtimeCost += (cost * otEval.fraction);
              overtimeHours += 1;
            }
          }
        }

        return {
          hour: item.hour,
          istLabel: formatUtcShortIST(item.hour),
          node_count: cnt,
          cost: cost,
          is_overtime: isOt,
          otReason: otReason,
          active_instances: item.active_instances || []
        };
      });

      const allFleet = nodes.map(n => {
        const isTerm = n.status !== 'RUNNING' || Boolean(n.is_terminated_today);
        const isFargate = (n.instance_type || '').toLowerCase().includes('fargate') || (n.resource_id || '').includes('task/');
        
        let nodeScheduleStatus = '24/7 Production Baseline';
        let isNodeOvertime = false;

        if (scheduleMode === 'CUSTOM') {
          if (isTodayOffDay) {
            const hasHours = (n.active_hours || []).length > 0;
            nodeScheduleStatus = hasHours ? `Weekend / Off-Day Run (${FULL_DAYS[currentDayOfWeek]})` : 'Inactive Today';
            isNodeOvertime = hasHours;
          } else {
            // Check if this specific node operated during any overtime/cutoff hour
            const hasOvertimeHour = (n.active_hours || []).some(hStr => {
              const hInt = parseInt(hStr.split(':')[0], 10);
              return evaluateUtcHourOvertime(hInt, startUtcMins, stopUtcMins).isOvertime;
            });

            if (hasOvertimeHour) {
              nodeScheduleStatus = `Active Past Scheduled Cutoff (${stopTimeIST} IST)`;
              isNodeOvertime = true;
            } else if (isTerm) {
              nodeScheduleStatus = n.reason || 'Autoscaler Scaled Down / Drained';
            } else {
              nodeScheduleStatus = `On Schedule (Within ${startTimeIST} - ${stopTimeIST} IST)`;
            }
          }
        }

        return {
          ...n,
          id: n.resource_id,
          name: n.resource_name || n.resource_id,
          type: n.instance_type || (isFargate ? 'AWS Fargate (vCPU)' : 'm5.large'),
          isFargate,
          isRunning: !isTerm,
          isTerminated: isTerm,
          launch: n.first_seen_date || '09:00',
          launchIST: formatDateWithDayIST(n.first_seen_date),
          term: isTerm ? (n.last_seen_date || '18:00') : 'Live Uptime',
          cost: n.spend_today || 0,
          totalCost: n.total_spend || n.spend_today || 0,
          reason: nodeScheduleStatus,
          isNodeOvertime
        };
      });

      const clusterDisplayName = clusterData.active_cluster?.display_name 
        || clusterData.active_cluster?.cluster_name
        || clusterData.cluster_display_name
        || clusterData.orchestrator
        || (serviceKey === 'ECS' ? 'Amazon ECS Cluster' : 'Amazon EKS Cluster');

      return {
        name: clusterDisplayName,
        datasetName: clusterData.dataset_name || 'Active Dataset',
        controlPlaneSpend: cpSpend,
        totalComputeSpend: computeSpendToday,
        trueTotalSpend: cpSpend + computeSpendToday,
        peakNodes: peakNodes || nodes.length,
        instanceType: serviceKey === 'ECS' ? 'AWS Fargate Tasks + EC2 Hosts' : 'Amazon EC2 Worker Nodes',
        overtimeCost: overtimeCost,
        overtimeHours: overtimeHours,
        churnIn: kpis.nodes_launched_today || 0,
        churnOut: kpis.nodes_terminated_today || 0,
        hourlyTimeline: hourlyTimeline,
        allInventory: allFleet
      };
    }

    // Fallback: Simulator mode ONLY if dataset has zero cluster nodes
    return {
      name: `${serviceKey} Simulation Cluster (No Live CUR Cluster Found)`,
      datasetName: 'Simulation Mode',
      controlPlaneSpend: serviceKey === 'ECS' ? 0.0 : 2.40,
      totalComputeSpend: 0,
      trueTotalSpend: serviceKey === 'ECS' ? 0.0 : 2.40,
      peakNodes: 0,
      instanceType: 'Demo Instances',
      overtimeCost: 0,
      overtimeHours: 0,
      churnIn: 0,
      churnOut: 0,
      hourlyTimeline: Array.from({ length: 24 }).map((_, idx) => ({
        hour: `${String(idx).padStart(2, '0')}:00`,
        istLabel: formatUtcShortIST(`${String(idx).padStart(2, '0')}:00`),
        node_count: 0,
        cost: 0,
        is_overtime: false,
        otReason: '',
        active_instances: []
      })),
      allInventory: []
    };
  }, [
    hasLiveCurCluster,
    clusterData,
    serviceKey,
    scheduleMode,
    isTodayOffDay,
    currentDayOfWeek,
    startUtcMins,
    stopUtcMins,
    startTimeIST,
    stopTimeIST
  ]);

  const totalActiveNodesToday = useMemo(() => {
    return (clusterView.hourlyTimeline || []).reduce((acc, h) => acc + (h.node_count || 0), 0);
  }, [clusterView]);

  const runningCount = useMemo(() => {
    return (clusterView.allInventory || []).filter(n => n.isRunning).length;
  }, [clusterView.allInventory]);

  const terminatedCount = useMemo(() => {
    return (clusterView.allInventory || []).filter(n => n.isTerminated).length;
  }, [clusterView.allInventory]);

  const filteredFleet = useMemo(() => {
    const list = clusterView.allInventory || [];
    return list.filter(n => {
      if (fleetFilter === 'RUNNING' && !n.isRunning) return false;
      if (fleetFilter === 'TERMINATED' && !n.isTerminated) return false;
      if (nodeSearch.trim()) {
        const q = nodeSearch.toLowerCase();
        const idMatch = (n.resource_id || n.id || '').toLowerCase().includes(q);
        const nameMatch = (n.resource_name || n.name || '').toLowerCase().includes(q);
        const typeMatch = (n.instance_type || n.type || '').toLowerCase().includes(q);
        if (!idMatch && !nameMatch && !typeMatch) return false;
      }
      return true;
    });
  }, [clusterView.allInventory, fleetFilter, nodeSearch]);

  const activeHourInfo = hoveredHour !== null ? clusterView.hourlyTimeline[hoveredHour] : null;
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  // Executive Verdict Logic (Instant plain-language clarity)
  const verdict = useMemo(() => {
    if (totalActiveNodesToday === 0) {
      return {
        type: 'CLEAN_SHUTDOWN',
        title: 'Cluster Cleanly Shut Down (0 Active Worker Nodes)',
        description: `All worker nodes were stopped on ${formatDateWithDayIST(effectiveDate)}. EC2 compute cost today was $0.00 (Only the fixed EKS control plane fee of $2.40/day was billed).`,
        costStr: '$0.00 Overtime Waste',
        badge: 'CLEAN SHUTDOWN',
        badgeBg: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
        cardBg: 'bg-blue-500/5 border-blue-500/25',
        icon: Moon
      };
    }

    if (scheduleMode === '24_7') {
      return {
        type: 'PROD_BASELINE',
        title: '24/7 Always-On Mission-Critical Baseline',
        description: `Production cluster operates 24 hours across all 7 days with zero schedule penalties or false overtime alerts.`,
        costStr: '$0.00 Overtime Penalty',
        badge: '24/7 PRODUCTION SLA',
        badgeBg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        cardBg: 'bg-emerald-500/5 border-emerald-500/25',
        icon: ShieldCheck
      };
    }

    if (isTodayOffDay) {
      const activeFleetCount = (clusterView.allInventory || []).filter(n => (n.active_hours || []).length > 0).length;
      return {
        type: 'OFF_DAY_LEAK',
        title: `Unscheduled Off-Day Run (${FULL_DAYS[currentDayOfWeek]})`,
        description: `${activeFleetCount} worker node(s) ran on an unscheduled weekend/off-day. All compute runtime today is tracked as overtime leak.`,
        costStr: `+$${clusterView.overtimeCost.toFixed(2)} Off-Day Leak`,
        badge: 'OFF-DAY LEAK',
        badgeBg: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
        cardBg: 'bg-rose-500/5 border-rose-500/30',
        icon: AlertTriangle
      };
    }

    if (clusterView.overtimeCost > 0) {
      const lastActiveItem = [...clusterView.hourlyTimeline].reverse().find(h => h.is_overtime && h.node_count > 0);
      const latestStopStr = lastActiveItem ? `${lastActiveItem.istLabel} IST` : `${stopTimeIST} IST`;
      const leakingCount = (clusterView.allInventory || []).filter(n => n.isNodeOvertime).length;

      return {
        type: 'OVERTIME_LEAK',
        title: `Overtime Detected: ${leakingCount} Node(s) Ran Past ${formatTime12h(stopTimeIST)} Cutoff`,
        description: `Worker nodes remained running until ${latestStopStr} (+${clusterView.overtimeHours}.0 hrs extra runtime past cutoff). Overtime compute spend: $${clusterView.overtimeCost.toFixed(2)} today (~$${(clusterView.overtimeCost * 30).toFixed(2)}/mo projected).`,
        costStr: `+$${clusterView.overtimeCost.toFixed(2)} Overtime Waste`,
        badge: 'OVERTIME LEAK',
        badgeBg: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
        cardBg: 'bg-amber-500/5 border-amber-500/30',
        icon: AlertTriangle
      };
    }

    return {
      type: 'ON_SCHEDULE',
      title: `100% On Schedule: Clean Shutdown by ${formatTime12h(stopTimeIST)}`,
      description: `All ${clusterView.allInventory.length} worker nodes operated within ${formatTime12h(startTimeIST)} – ${formatTime12h(stopTimeIST)} IST and shut down cleanly on time.`,
      costStr: '$0.00 Overtime Waste',
      badge: '100% ON SCHEDULE',
      badgeBg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      cardBg: 'bg-emerald-500/5 border-emerald-500/25',
      icon: CheckCircle2
    };
  }, [totalActiveNodesToday, scheduleMode, isTodayOffDay, clusterView, effectiveDate, currentDayOfWeek, stopTimeIST, startTimeIST]);

  // Area Wave Curve Data
  const areaWaveData = useMemo(() => {
    const labels = (clusterView.hourlyTimeline || []).map(item => item.istLabel);
    const scheduledData = (clusterView.hourlyTimeline || []).map(item => item.is_overtime ? 0 : item.node_count);
    const overtimeData = (clusterView.hourlyTimeline || []).map(item => item.is_overtime ? item.node_count : 0);

    return {
      labels,
      datasets: [
        {
          label: scheduleMode === '24_7' ? '24/7 Production Nodes' : `Scheduled (${startTimeIST} – ${stopTimeIST} IST)`,
          data: scheduledData,
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.22)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.36,
          pointRadius: 2.5,
          pointHoverRadius: 6,
          pointBackgroundColor: '#10B981'
        },
        {
          label: isTodayOffDay ? `Off-Day Run (${FULL_DAYS[currentDayOfWeek]})` : 'Overtime / Unscheduled Run',
          data: overtimeData,
          borderColor: '#EA580C',
          backgroundColor: 'rgba(234, 88, 12, 0.28)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.36,
          pointRadius: 2.5,
          pointHoverRadius: 6,
          pointBackgroundColor: '#EA580C'
        }
      ]
    };
  }, [clusterView, scheduleMode, startTimeIST, stopTimeIST, isTodayOffDay, currentDayOfWeek]);

  const areaWaveOptions = useMemo(() => {
    const maxNodes = Math.max(...(clusterView.hourlyTimeline || []).map(h => h.node_count || 0), 1);
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250, easing: 'easeOutQuart' },
      layout: { padding: { top: 6, bottom: 2, left: 0, right: 8 } },
      onHover: (event, elements) => {
        if (elements && elements.length > 0) setHoveredHour(elements[0].index);
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#F8FAFC',
          bodyColor: '#E2E8F0',
          borderColor: 'rgba(255, 255, 255, 0.12)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            title: (items) => {
              const idx = items[0].dataIndex;
              const item = clusterView.hourlyTimeline[idx];
              return `${item?.istLabel || ''} IST (${item?.hour || ''} UTC)`;
            },
            label: (ctx) => {
              const idx = ctx.dataIndex;
              const item = clusterView.hourlyTimeline[idx];
              const totalNodes = item?.node_count || 0;
              const costStr = `$${Number(item?.cost || 0).toFixed(4)}`;
              if (totalNodes === 0) return '0 Active Nodes (Cluster Shut Down)';
              return `${totalNodes} Active Node${totalNodes > 1 ? 's' : ''} · ${costStr}/hr`;
            },
            afterLabel: (ctx) => {
              const idx = ctx.dataIndex;
              const item = clusterView.hourlyTimeline[idx];
              if (item?.is_overtime) return `Overtime: ${item?.otReason || 'Outside scheduled SLA'}`;
              if ((item?.node_count || 0) > 0) return `On Schedule (${startTimeIST} – ${stopTimeIST} IST)`;
              return '';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: isDark ? '#94A3B8' : '#64748B',
            font: { family: 'IBM Plex Mono', size: 9, weight: 600 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12
          }
        },
        y: {
          min: 0,
          max: Math.max(maxNodes + 1, 4),
          grid: {
            color: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
            borderDash: [3, 3]
          },
          ticks: {
            stepSize: 1,
            color: isDark ? '#94A3B8' : '#64748B',
            font: { family: 'IBM Plex Mono', size: 10, weight: 600 },
            callback: (val) => `${val}n`
          }
        }
      }
    };
  }, [clusterView, isDark, startTimeIST, stopTimeIST]);

  const VerdictIcon = verdict.icon;

  return (
    <div className="clay-card p-5 sm:p-6 rounded-3xl space-y-5 border border-zorvex-border/60 dark:border-zorvex-dark-border/60 transition-all">
      {/* ==================== 1. COMPACT TOP HEADER ==================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zorvex-border/40 dark:border-zorvex-dark-border/40">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <AwsServiceIcon service={serviceKey === 'ECS' ? 'Amazon ECS' : 'Amazon EKS'} size="sm" className="w-6 h-6" />
            <h2 className="text-base sm:text-lg font-black tracking-tight text-zorvex-text dark:text-zorvex-dark-text">
              Amazon {serviceKey} Cluster Lifecycle & Overtime Tracker
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-forest-dark dark:text-emerald-300">
              {serviceKey === 'ECS' ? 'Fargate / Container Fleet' : 'Kubernetes Fleet'}
            </span>
            {hasLiveCurCluster ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live CUR Onboarded ({clusterView.allInventory.length} Nodes)</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/20">
                Simulator Mode
              </span>
            )}
          </div>
          <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">
            Correlating control plane with worker nodes and custom shutdown SLA timings in IST.
          </p>
        </div>

        {/* Calendar Date Picker */}
        <div className="self-start lg:self-center">
          <ClayDatePicker
            value={effectiveDate}
            onChange={(val) => onDateChange && onDateChange(val)}
            availableDates={availableDates}
          />
        </div>
      </div>

      {/* ==================== 2. CLUSTER SELECTOR & INLINE SCHEDULE BAR ==================== */}
      <div className="clay-card p-3.5 sm:p-4 rounded-2xl flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-zorvex-secondary/30 dark:bg-zorvex-dark-secondary/30 border border-zorvex-border/50">
        {/* Cluster Selector Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 mr-1 text-[11px] font-black uppercase tracking-wider text-zorvex-text-secondary">
            <ClusterMeshIcon className="w-4 h-4 text-emerald-600" />
            <span>Cluster:</span>
          </div>

          {(clusterData?.clusters && clusterData.clusters.length > 0) ? (
            clusterData.clusters.map((cl) => {
              const isSelected = (selectedCluster === cl.cluster_name) || (clusterView.name === cl.cluster_name);
              return (
                <button
                  key={cl.cluster_name}
                  type="button"
                  onClick={() => onSelectCluster && onSelectCluster(cl.cluster_name)}
                  className={`px-3 py-1.5 rounded-clay-pill transition-all cursor-pointer flex items-center gap-1.5 text-xs border ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm font-black'
                      : 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-text-secondary hover:text-zorvex-text hover:border-zorvex-forest border-zorvex-border dark:border-zorvex-dark-border font-bold'
                  }`}
                  title={`Switch to ${cl.display_name || cl.cluster_name}`}
                >
                  <span>{cl.display_name || cl.cluster_name}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isSelected ? 'bg-white/20 text-white font-bold' : 'bg-zorvex-surface-secondary text-zorvex-text-secondary'
                  }`}>
                    {cl.total_nodes}n
                  </span>
                </button>
              );
            })
          ) : (
            <div className="px-3 py-1.5 rounded-clay-pill bg-zorvex-forest-soft text-zorvex-forest dark:bg-emerald-500/15 dark:text-emerald-300 font-extrabold text-xs">
              {clusterView.name}
            </div>
          )}
        </div>

        {/* Direct Inline Operating Schedule Controls (No hidden menus!) */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 xl:pt-0 border-t xl:border-t-0 border-zorvex-border/40">
          {/* Mode Toggle */}
          <div className="flex items-center p-0.5 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border text-xs font-bold">
            <button
              type="button"
              onClick={() => setScheduleMode('CUSTOM')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                scheduleMode === 'CUSTOM'
                  ? 'bg-amber-600 text-white shadow-2xs font-black'
                  : 'text-zorvex-text-secondary hover:text-zorvex-text'
              }`}
            >
              Custom SLA
            </button>
            <button
              type="button"
              onClick={() => setScheduleMode('24_7')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                scheduleMode === '24_7'
                  ? 'bg-emerald-600 text-white shadow-2xs font-black'
                  : 'text-zorvex-text-secondary hover:text-zorvex-text'
              }`}
            >
              24/7 Always-On
            </button>
          </div>

          {/* If Custom: Days & Direct Time Inputs */}
          {scheduleMode === 'CUSTOM' && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Day Chips */}
              <div className="flex items-center gap-1">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                  const isSel = selectedDays.includes(day);
                  const isTod = currentDayOfWeek === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`w-6 h-6 rounded-md text-[10px] font-mono font-bold transition-all flex items-center justify-center cursor-pointer border ${
                        isSel
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-black'
                          : 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zinc-400 border-transparent hover:border-zinc-300'
                      } ${isTod ? 'ring-1 ring-amber-500' : ''}`}
                      title={`${day} (${isSel ? 'Active' : 'Off-day'})`}
                    >
                      {day[0]}
                    </button>
                  );
                })}
              </div>

              {/* Start & Stop Inputs */}
              <div className="flex items-center gap-1 text-xs">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border">
                  <span className="text-[10px] uppercase font-bold text-zorvex-text-secondary">Start:</span>
                  <input
                    type="time"
                    value={startTimeIST}
                    onChange={(e) => e.target.value && setStartTimeIST(e.target.value)}
                    className="font-mono font-black text-xs bg-transparent border-none focus:outline-none cursor-pointer text-zorvex-text dark:text-zorvex-dark-text"
                  />
                  <span className="text-[9px] font-bold text-emerald-600">IST</span>
                </div>

                <span className="text-zinc-400 font-bold">→</span>

                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border ${
                  clusterView.overtimeCost > 0 ? 'border-amber-500/60 shadow-2xs' : 'border-zorvex-border dark:border-zorvex-dark-border'
                }`}>
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">Cutoff:</span>
                  <input
                    type="time"
                    value={stopTimeIST}
                    onChange={(e) => e.target.value && setStopTimeIST(e.target.value)}
                    className="font-mono font-black text-xs bg-transparent border-none focus:outline-none cursor-pointer text-amber-700 dark:text-amber-300"
                  />
                  <span className="text-[9px] font-bold text-amber-600">IST</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================== 3. EXECUTIVE VERDICT BANNER (ZERO-CONFUSION) ==================== */}
      <div className={`p-4 rounded-2xl border ${verdict.cardBg} flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zorvex-surface/80 dark:bg-zorvex-dark-surface/80 flex items-center justify-center flex-shrink-0 shadow-2xs">
            <VerdictIcon className={`w-5 h-5 ${
              verdict.type === 'ON_SCHEDULE' ? 'text-emerald-600' :
              verdict.type === 'OVERTIME_LEAK' ? 'text-amber-600' :
              verdict.type === 'OFF_DAY_LEAK' ? 'text-rose-600' : 'text-blue-600'
            }`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-sm text-zorvex-text dark:text-zorvex-dark-text">
                {verdict.title}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-black border ${verdict.badgeBg}`}>
                {verdict.badge}
              </span>
            </div>
            <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">
              {verdict.description}
            </p>
          </div>
        </div>

        <div className="sm:text-right flex-shrink-0 font-mono pl-1">
          <span className="text-[10px] uppercase font-bold text-zorvex-text-secondary block">
            Impact Verdict
          </span>
          <span className={`text-base font-black ${
            verdict.type === 'ON_SCHEDULE' || verdict.type === 'CLEAN_SHUTDOWN' || verdict.type === 'PROD_BASELINE'
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-[#EA580C]'
          }`}>
            {verdict.costStr}
          </span>
        </div>
      </div>

      {/* ==================== 4. 4 EXECUTIVE METRIC PILLARS ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Pillar 1: True Spend */}
        <div className="clay-card p-4 space-y-1 rounded-2xl flex flex-col justify-between">
          <span className="text-[11px] font-black uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
            True Cluster Spend (24h)
          </span>
          <div className="text-2xl sm:text-3xl font-black font-mono text-zorvex-forest dark:text-zorvex-forest-highlight my-1">
            ${Number(clusterView.trueTotalSpend || 0).toFixed(2)}
          </div>
          <div className="text-[11px] text-zorvex-text-secondary font-mono">
            ${Number(clusterView.controlPlaneSpend || 0).toFixed(2)} CP + ${Number(clusterView.totalComputeSpend || 0).toFixed(2)} Nodes
          </div>
        </div>

        {/* Pillar 2: Fleet Capacity */}
        <div className="clay-card p-4 space-y-1 rounded-2xl flex flex-col justify-between">
          <span className="text-[11px] font-black uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
            Peak Fleet Capacity
          </span>
          <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 my-1">
            {clusterView.peakNodes} {serviceKey === 'ECS' && clusterView.name.includes('Fargate') ? 'Tasks' : 'Nodes'}
          </div>
          <div className="text-[11px] font-medium text-zorvex-text-secondary truncate">
            {clusterView.instanceType}
          </div>
        </div>

        {/* Pillar 3: Overtime Waste */}
        <div className={`clay-card p-4 space-y-1 rounded-2xl flex flex-col justify-between border-l-4 ${
          clusterView.overtimeCost > 0 ? 'border-l-[#EA580C]' : 'border-l-emerald-500'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-black uppercase tracking-wider ${
              clusterView.overtimeCost > 0 ? 'text-[#EA580C]' : 'text-emerald-700 dark:text-emerald-400'
            }`}>
              {scheduleMode === '24_7' ? '24/7 Production SLA' : isTodayOffDay ? 'Off-Day Run' : 'Overtime Waste'}
            </span>
          </div>
          <div className={`text-2xl sm:text-3xl font-black font-mono my-1 ${
            clusterView.overtimeCost > 0 ? 'text-[#EA580C]' : 'text-emerald-600 dark:text-emerald-400'
          }`}>
            {clusterView.overtimeCost > 0 ? `+$${clusterView.overtimeCost.toFixed(2)}` : '$0.00'}
          </div>
          <div className="text-[11px] font-semibold text-zorvex-text-secondary">
            {scheduleMode === '24_7' ? (
              <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Zero Schedule Overtime</span>
              </span>
            ) : isTodayOffDay ? (
              <span className="text-rose-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <span>Unscheduled {FULL_DAYS[currentDayOfWeek]}</span>
              </span>
            ) : clusterView.overtimeCost > 0 ? (
              <span className="text-[#EA580C] flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>+{clusterView.overtimeHours}.0h past {stopTimeIST} IST</span>
              </span>
            ) : (
              <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>100% On Schedule</span>
              </span>
            )}
          </div>
        </div>

        {/* Pillar 4: Daily Churn */}
        <div className="clay-card p-4 space-y-1 rounded-2xl flex flex-col justify-between">
          <span className="text-[11px] font-black uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
            Daily Node Churn
          </span>
          <div className="text-2xl sm:text-3xl font-black font-mono text-zorvex-text dark:text-zorvex-dark-text my-1">
            {clusterView.churnIn} In / {clusterView.churnOut} Out
          </div>
          <div className="text-[11px] font-medium text-zorvex-text-secondary">
            {clusterView.churnIn} spawned · {clusterView.churnOut} terminated
          </div>
        </div>
      </div>

      {/* ==================== 5. UNIFIED TIMELINE HORIZON & NODE SWIMLANES ==================== */}
      <div className="clay-card p-5 sm:p-6 rounded-2xl space-y-4">
        {/* FinOps Ground Truth Banner (Strict Zero Double Counting) */}
        <div className="p-3.5 rounded-xl bg-zorvex-forest-soft/30 dark:bg-zorvex-forest-dark-soft/20 border border-zorvex-forest/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p className="text-[11px] text-zorvex-text-secondary leading-relaxed">
              AWS bills <strong>${Number(clusterView.controlPlaneSpend || 2.40).toFixed(2)}/day</strong> under Amazon EKS for the Control Plane. Compute worker nodes ({runningCount} running, {terminatedCount} terminated) are billed under Amazon EC2 and correlated here for fleet lifecycle without double-counting account spend.
            </p>
          </div>
          <span className="font-mono font-black text-zorvex-forest text-xs whitespace-nowrap pl-1">
            EKS Fee: ${Number(clusterView.controlPlaneSpend || 2.40).toFixed(2)}/day
          </span>
        </div>

        {/* Toolbar: View Switcher, Status Tabs & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 pb-2 border-b border-zorvex-border/40 dark:border-zorvex-dark-border/40">
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center p-0.5 rounded-xl bg-zorvex-surface-secondary/80 dark:bg-zorvex-dark-surface-secondary/80 border border-zorvex-border/50 text-xs font-bold">
              <button
                type="button"
                onClick={() => setTimelineViewMode('GANTT')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  timelineViewMode === 'GANTT'
                    ? 'bg-emerald-600 text-white shadow-2xs font-black'
                    : 'text-zorvex-text-secondary hover:text-zorvex-text'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Node Gantt</span>
              </button>
              <button
                type="button"
                onClick={() => setTimelineViewMode('WAVE')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  timelineViewMode === 'WAVE'
                    ? 'bg-emerald-600 text-white shadow-2xs font-black'
                    : 'text-zorvex-text-secondary hover:text-zorvex-text'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Capacity Wave</span>
              </button>
              <button
                type="button"
                onClick={() => setTimelineViewMode('TABLE')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  timelineViewMode === 'TABLE'
                    ? 'bg-emerald-600 text-white shadow-2xs font-black'
                    : 'text-zorvex-text-secondary hover:text-zorvex-text'
                }`}
              >
                <span>Inventory Table</span>
              </button>
            </div>

            {/* Filter Pills */}
            <button
              type="button"
              onClick={() => setFleetFilter('ALL')}
              className={`px-2.5 py-1 rounded-clay-pill text-xs font-bold transition-all cursor-pointer ${
                fleetFilter === 'ALL' ? 'clay-pill-active' : 'text-zorvex-text-secondary hover:text-zorvex-text'
              }`}
            >
              All ({clusterView.allInventory.length})
            </button>
            <button
              type="button"
              onClick={() => setFleetFilter('RUNNING')}
              className={`px-2.5 py-1 rounded-clay-pill text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                fleetFilter === 'RUNNING' ? 'bg-emerald-600 text-white font-black' : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Running ({runningCount})</span>
            </button>
            {terminatedCount > 0 && (
              <button
                type="button"
                onClick={() => setFleetFilter('TERMINATED')}
                className={`px-2.5 py-1 rounded-clay-pill text-xs font-bold transition-all cursor-pointer ${
                  fleetFilter === 'TERMINATED' ? 'bg-rose-600 text-white font-black' : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                Terminated ({terminatedCount})
              </button>
            )}
          </div>

          {/* Node Search Bar */}
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zorvex-text-secondary" />
            <input
              type="text"
              placeholder="Filter node ID..."
              value={nodeSearch}
              onChange={(e) => setNodeSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl clay-input text-zorvex-text dark:text-zorvex-dark-text placeholder:text-zorvex-text-secondary/60 focus:outline-none"
            />
          </div>
        </div>

        {/* View Mode 1: SLEEK CONTINUOUS NODE GANTT SWIMLANES */}
        {timelineViewMode === 'GANTT' && (
          <div className="space-y-3 pt-1">
            {/* Master 24-Hour Horizon Ruler (Aligned with exact 24-column timeline below) */}
            <div className="rounded-2xl bg-zorvex-surface/90 dark:bg-zorvex-dark-surface/90 p-3.5 border border-zorvex-border/50 shadow-xs space-y-2.5">
              {/* Row 1: Operating SLA Badges & Legend (Clean SVG Icons, Zero Emojis) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-zorvex-border/30 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zorvex-text-secondary">
                    Operating Policy:
                  </span>
                  {scheduleMode === '24_7' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>24/7 Always-On Baseline</span>
                    </span>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Boot SLA: {formatTime12h(startTimeIST)}</span>
                      </span>
                      <span className="text-zinc-400 text-xs font-bold">→</span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                        <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        <span>Cutoff SLA: {formatTime12h(stopTimeIST)}</span>
                      </span>
                    </>
                  )}
                </div>

                {/* Micro-Legend */}
                <div className="flex items-center gap-3 text-[11px] font-semibold text-zorvex-text-secondary">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-gradient-to-r from-emerald-500 to-teal-500 shadow-2xs" />
                    <span>On Schedule</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-[repeating-linear-gradient(45deg,#EA580C,#EA580C_3px,#C2410C_3px,#C2410C_6px)] shadow-2xs" />
                    <span className="text-[#EA580C]">Overtime Leak</span>
                  </div>
                </div>
              </div>

              {/* Row 2: Clean 24-Hour Milestones with clear AM/PM (Zero Confusion!) */}
              <div className="flex items-center justify-between text-xs font-mono font-bold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary pt-1 px-1">
                <div className="flex flex-col items-start">
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-bold">05:30 AM</span>
                  <span className="text-[9px] text-zinc-400 font-sans">Day Start</span>
                </div>

                <div className="flex flex-col items-center">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-black flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{formatTime12h(startTimeIST)} Boot</span>
                  </span>
                </div>

                <div className="flex flex-col items-center hidden sm:flex">
                  <span className="text-[11px] text-zinc-400 font-bold">01:00 PM</span>
                  <span className="text-[9px] text-zinc-400 font-sans">Midday</span>
                </div>

                <div className="flex flex-col items-center">
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[11px] font-black flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>{formatTime12h(stopTimeIST)} Cutoff</span>
                  </span>
                </div>

                <div className="flex flex-col items-center hidden md:flex">
                  <span className="text-[11px] text-zinc-400 font-bold">10:30 PM</span>
                  <span className="text-[9px] text-zinc-400 font-sans">Night</span>
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-bold">04:30 AM</span>
                  <span className="text-[9px] text-zinc-400 font-sans">Day End</span>
                </div>
              </div>
            </div>

            {/* Node Rows */}
            {filteredFleet.length === 0 ? (
              <div className="py-12 text-center text-zorvex-text-secondary border border-dashed border-zorvex-border rounded-2xl">
                No cluster compute nodes found matching "{nodeSearch || fleetFilter}".
              </div>
            ) : (
              filteredFleet.map((node, nIdx) => {
                const isRunning = node.isRunning;
                const isFargate = node.isFargate;
                const activeHours = node.active_hours || [];
                const totalNodeCost = Number(node.spend_today || node.cost || 0);

                // Map 24 hours for this node
                const nodeHours = clusterView.hourlyTimeline.map((hItem) => {
                  const isActive = activeHours.length > 0 
                    ? activeHours.includes(hItem.hour)
                    : (hItem.active_instances || []).includes(node.resource_id);
                  
                  return {
                    isActive,
                    isOvertime: isActive && hItem.is_overtime,
                    hour: hItem.hour,
                    istLabel: hItem.istLabel
                  };
                });

                const activeCount = nodeHours.filter(x => x.isActive).length;
                const overtimeCount = nodeHours.filter(x => x.isOvertime).length;
                const hasOvertime = overtimeCount > 0;

                // Find boot and stop hour labels in IST
                const firstActiveIdx = nodeHours.findIndex(x => x.isActive);
                const lastActiveIdx = nodeHours.map(x => x.isActive).lastIndexOf(true);
                const bootHourIST = firstActiveIdx !== -1 ? clusterView.hourlyTimeline[firstActiveIdx]?.istLabel : null;
                const stopHourIST = lastActiveIdx !== -1 ? clusterView.hourlyTimeline[lastActiveIdx]?.istLabel : null;

                return (
                  <div
                    key={(node.resource_id || node.id) + nIdx}
                    className="p-3.5 sm:p-4 rounded-2xl bg-zorvex-surface/80 dark:bg-zorvex-dark-surface/80 border border-zorvex-border/60 hover:border-emerald-500/40 transition-all space-y-2 hover:shadow-2xs"
                  >
                    {/* Header: Node ID & Verdict */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onSelectResource && onSelectResource({
                            resource_id: node.resource_id || node.id,
                            service: isFargate ? 'Amazon ECS' : 'Amazon EC2',
                            resource_name: node.resource_name || node.name || node.resource_id || node.id,
                            name: node.resource_name || node.name || node.resource_id || node.id,
                            total_cost: Number(node.totalCost || node.total_spend || node.cost || 0),
                            cost: Number(node.cost || node.spend_today || 0),
                            active_days: 1,
                            type: node.instance_type || node.type || 'm5.large',
                            category: isFargate ? 'ECS_TASK' : 'EC2_INSTANCE',
                            category_label: isFargate ? 'Fargate Task' : 'EC2 Instance',
                            primary_usage_type: `${node.instance_type || node.type || 'm5.large'} Compute`
                          })}
                          className="font-mono font-black text-xs text-zorvex-text dark:text-zorvex-dark-text hover:text-zorvex-forest dark:hover:text-emerald-400 flex items-center gap-1.5 cursor-pointer group"
                          title={`Click to open drawer for ${node.resource_id || node.id}`}
                        >
                          <Cpu className={`w-3.5 h-3.5 ${isRunning ? 'text-emerald-500' : 'text-zinc-400'}`} />
                          <span>{node.resource_id || node.id}</span>
                          <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-zorvex-forest" />
                        </button>

                        {node.resource_name && node.resource_name !== (node.resource_id || node.id) && (
                          <span className="text-[11px] font-sans font-medium text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                            ({node.resource_name})
                          </span>
                        )}

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zorvex-surface-secondary text-zorvex-text-secondary border border-zorvex-border dark:border-zorvex-dark-border">
                          {node.instance_type || node.type || 'm5.large'}
                        </span>

                        {isRunning ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>RUNNING</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-zinc-500/15 text-zinc-500">
                            STOPPED
                          </span>
                        )}
                      </div>

                      {/* Right: Plain-English Verdict & Cost (Zero Emojis!) */}
                      <div className="flex items-center gap-2.5 text-xs">
                        {activeCount === 0 ? (
                          <span className="text-[11px] font-bold text-zinc-400 flex items-center gap-1">
                            <Moon className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Clean Shutdown (0h · $0.00)</span>
                          </span>
                        ) : scheduleMode === '24_7' ? (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span>24/7 Production SLA</span>
                          </span>
                        ) : isTodayOffDay ? (
                          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                            <span>Off-Day Run (+{activeCount}h leak)</span>
                          </span>
                        ) : hasOvertime ? (
                          <span className="text-[11px] font-black text-[#EA580C] flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            <span>Stopped at {stopHourIST} IST (+{overtimeCount}h Overtime)</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span>On Schedule ({bootHourIST} – {stopHourIST} IST)</span>
                          </span>
                        )}

                        <span className="font-mono font-black text-xs text-zorvex-forest dark:text-emerald-400 border-l border-zorvex-border/60 pl-2">
                          ${totalNodeCost.toFixed(3)}
                        </span>
                      </div>
                    </div>

                    {/* Smooth Continuous Gantt Bar (Sleek Clay Recessed Channel + Styled Gradients) */}
                    <div 
                      className="w-full h-8 rounded-xl p-1 bg-zinc-100/90 dark:bg-zinc-900/70 border border-zorvex-border/50 shadow-inner overflow-hidden relative"
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}
                    >
                      {nodeHours.map((h, hIdx) => {
                        let cellBg = 'bg-transparent';
                        const isPrevActive = hIdx > 0 && nodeHours[hIdx - 1]?.isActive;
                        const isNextActive = hIdx < 23 && nodeHours[hIdx + 1]?.isActive;
                        const isFirstActive = h.isActive && !isPrevActive;
                        const isLastActive = h.isActive && !isNextActive;
                        const isTransition = h.isActive && isNextActive && !h.isOvertime && nodeHours[hIdx + 1]?.isOvertime;

                        if (h.isActive) {
                          cellBg = h.isOvertime 
                            ? 'bg-[repeating-linear-gradient(45deg,#EA580C,#EA580C_4px,#C2410C_4px,#C2410C_8px)] shadow-xs' 
                            : 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-xs';
                        }

                        const isHov = hoveredHour === hIdx;

                        return (
                          <div
                            key={hIdx}
                            onMouseEnter={() => setHoveredHour(hIdx)}
                            onMouseLeave={() => setHoveredHour(null)}
                            className={`h-full transition-all cursor-pointer relative ${cellBg} ${
                              isFirstActive ? 'rounded-l-lg' : ''
                            } ${
                              isLastActive ? 'rounded-r-lg' : ''
                            } ${
                              isTransition ? 'border-r-2 border-white/80' : ''
                            } ${
                              isHov ? 'brightness-125 ring-2 ring-white/95 scale-[1.04] z-20 shadow-md' : ''
                            }`}
                            title={`${clusterView.hourlyTimeline[hIdx]?.istLabel} IST (${clusterView.hourlyTimeline[hIdx]?.hour} UTC): ${
                              h.isActive 
                                ? (h.isOvertime ? 'Overtime Leak Outside Scheduled SLA' : 'Scheduled Active Window') 
                                : 'Inactive / Dormant'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* View Mode 2: DATADOG STYLE CAPACITY WAVE */}
        {timelineViewMode === 'WAVE' && (
          <div className="relative h-56 sm:h-64 w-full pt-1 pb-1">
            {totalActiveNodesToday === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-zorvex-surface/85 dark:bg-zorvex-dark-surface/85 backdrop-blur-xs rounded-xl border border-dashed border-zorvex-border z-10 text-center animate-in fade-in duration-200">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1 shadow-2xs">
                  <Moon className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-black text-zorvex-text dark:text-zorvex-dark-text uppercase tracking-wide">
                  Cluster Cleanly Shut Down (0 Active Worker Nodes)
                </h4>
                <p className="text-[11px] text-zorvex-text-secondary mt-0.5 max-w-lg leading-relaxed">
                  No EC2 worker nodes ran on this date ({formatDateWithDayIST(effectiveDate)}). Only the EKS Control Plane fee was billed ($2.40/day).
                </p>
              </div>
            )}
            <Line data={areaWaveData} options={areaWaveOptions} />
          </div>
        )}

        {/* View Mode 3: DETAILED INVENTORY TABLE */}
        {timelineViewMode === 'TABLE' && (
          <div className="overflow-x-auto rounded-2xl border border-zorvex-border/50 dark:border-zorvex-dark-border/50">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-zorvex-surface dark:bg-zorvex-dark-surface/80 border-b border-zorvex-border text-[10px] font-bold text-zorvex-text-secondary uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3.5">{serviceKey === 'ECS' ? 'Task ID' : 'Worker Node / Instance ID'}</th>
                  <th className="py-3 px-3.5">Workload Name</th>
                  <th className="py-3 px-3.5">Instance Specs</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5">Operating Verdict</th>
                  <th className="py-3 px-3.5 text-right">Billed Cost</th>
                  <th className="py-3 px-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zorvex-border/30 dark:divide-zorvex-dark-border/30">
                {filteredFleet.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zorvex-text-secondary">
                      No cluster compute nodes found matching "{nodeSearch || fleetFilter}".
                    </td>
                  </tr>
                ) : (
                  filteredFleet.map((n, idx) => {
                    const isRunning = n.isRunning;
                    const isFargate = n.isFargate;

                    return (
                      <tr
                        key={(n.resource_id || n.id) + idx}
                        className="hover:bg-zorvex-surface/60 dark:hover:bg-zorvex-dark-surface/60 transition-colors"
                      >
                        <td className="py-3 px-3.5 font-bold text-zorvex-text dark:text-zorvex-dark-text whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onSelectResource && onSelectResource({
                              resource_id: n.resource_id || n.id,
                              service: isFargate ? 'Amazon ECS' : 'Amazon EC2',
                              resource_name: n.resource_name || n.name || n.resource_id || n.id,
                              name: n.resource_name || n.name || n.resource_id || n.id,
                              total_cost: Number(n.totalCost || n.total_spend || n.cost || 0),
                              cost: Number(n.cost || n.spend_today || 0),
                              active_days: 1,
                              type: n.instance_type || n.type || 'm5.large',
                              category: isFargate ? 'ECS_TASK' : 'EC2_INSTANCE',
                              category_label: isFargate ? 'Fargate Task' : 'EC2 Instance',
                              primary_usage_type: `${n.instance_type || n.type || 'm5.large'} Compute`
                            })}
                            className="flex items-center gap-1.5 hover:underline text-left cursor-pointer group"
                            title="Inspect in Resource Drawer"
                          >
                            {isFargate ? (
                              <ServerlessLambdaIcon className="w-3.5 h-3.5 text-amber-500" />
                            ) : (
                              <Cpu className={`w-3.5 h-3.5 ${isRunning ? 'text-emerald-500' : 'text-zinc-400'}`} />
                            )}
                            <span className="group-hover:text-zorvex-forest font-extrabold font-mono text-zorvex-text dark:text-zorvex-dark-text">
                              {n.resource_id || n.id}
                            </span>
                          </button>
                        </td>

                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="font-semibold text-zorvex-text dark:text-zorvex-dark-text text-[11px] truncate max-w-[220px]">
                            {n.resource_name || n.name || n.resource_id || n.id}
                          </div>
                          <div className="text-[10px] text-zorvex-text-secondary font-sans font-medium">
                            {isFargate ? 'AWS Fargate Task' : 'Managed EC2 Node Group'}
                          </div>
                        </td>

                        <td className="py-3 px-3.5 text-zorvex-text-secondary whitespace-nowrap font-sans text-xs font-semibold">
                          {n.instance_type || n.type || 'm5.large'}
                        </td>

                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {isRunning ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span>RUNNING</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-zinc-500/15 text-zinc-600 dark:text-zinc-400">
                              <span>STOPPED</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span className={`text-[11px] font-bold ${
                            n.isNodeOvertime ? 'text-[#EA580C]' : 'text-emerald-700 dark:text-emerald-400'
                          }`}>
                            {n.reason}
                          </span>
                        </td>

                        <td className="py-3 px-3.5 text-right font-black text-zorvex-forest dark:text-emerald-400 whitespace-nowrap">
                          ${Number(n.cost || 0).toFixed(3)}
                        </td>

                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onSelectResource && onSelectResource({
                              resource_id: n.resource_id || n.id,
                              service: isFargate ? 'Amazon ECS' : 'Amazon EC2',
                              resource_name: n.resource_name || n.name || n.resource_id || n.id,
                              name: n.resource_name || n.name || n.resource_id || n.id,
                              total_cost: Number(n.totalCost || n.total_spend || n.cost || 0),
                              cost: Number(n.cost || n.spend_today || 0),
                              active_days: 1,
                              type: n.instance_type || n.type || 'm5.large',
                              category: isFargate ? 'ECS_TASK' : 'EC2_INSTANCE',
                              category_label: isFargate ? 'Fargate Task' : 'EC2 Instance',
                              primary_usage_type: `${n.instance_type || n.type || 'm5.large'} Compute`
                            })}
                            className="p-1.5 rounded-lg text-zorvex-text-secondary hover:text-zorvex-text hover:bg-zorvex-surface-secondary transition-all cursor-pointer inline-flex items-center justify-center"
                            title="Inspect in Resource Drawer"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
