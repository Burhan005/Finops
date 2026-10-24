import React, { useState, useMemo } from 'react';
import {
  Server,
  Layers,
  Clock,
  AlertTriangle,
  TrendingUp,
  Cpu,
  Calendar,
  Search,
  ShieldAlert,
  ArrowUpRight,
  Sliders,
  ChevronRight,
  Activity,
  CheckCircle2,
  Database
} from 'lucide-react';
import AwsServiceIcon from './AwsServiceIcon';

// Authentic Architectural Presets matching the interactive EKS & ECS Demo
const CLUSTER_PRESETS = {
  EKS: {
    dev: {
      id: 'dev',
      name: 'dev-eks-01 (Managed Node Group)',
      scopeLabel: 'DEV',
      controlPlaneSpend: 2.40,
      hourlyRatePerNode: 0.096, // m5.large
      instanceType: 'm5.large (2 vCPU · 8 GiB)',
      scheduleStart: 9,
      scheduleEnd: 18,
      activeHoursPattern: [0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 4, 4, 5, 5, 4, 3, 3, 3, 3, 3, 2, 0, 0],
      churnIn: 8,
      churnOut: 6,
      terminatedNodes: [
        { id: 'i-09df18a2bc417e', launch: '09:00', term: '14:30', hrs: 5.5, cost: 0.53, reason: 'Cluster Autoscaler Scaled Down' },
        { id: 'i-0aa43b819f72c0', launch: '09:00', term: '15:10', hrs: 6.2, cost: 0.60, reason: 'Spot Interruption / Replaced' },
        { id: 'i-011e4f93ca00bb', launch: '11:15', term: '17:00', hrs: 5.75, cost: 0.55, reason: 'Build Job Pods Completed' },
        { id: 'i-078a9c21ef45da', launch: '09:00', term: '18:00', hrs: 9.0, cost: 0.86, reason: 'Scheduled Node Group Shrink' },
        { id: 'i-033d8a1766ff31', launch: '13:00', term: '18:15', hrs: 5.25, cost: 0.50, reason: 'Scale In Policy Triggered' },
        { id: 'i-055f10bb87cc92', launch: '14:00', term: '19:00', hrs: 5.0, cost: 0.48, reason: 'Idle Node Drained' }
      ],
      activeNodes: [
        { id: 'i-0c91ba42ef9901', name: 'dev-eks-node-01', launched: '09:00', age: '11h 15m', cost: 1.08, ip: '10.0.12.45', status: 'RUNNING', type: 'm5.large', isNew: false, isTerm: false },
        { id: 'i-088f21ca6633dd', name: 'dev-eks-node-02', launched: '14:30', age: '5h 45m', cost: 0.55, ip: '10.0.12.89', status: 'RUNNING', type: 'm5.large', isNew: true, isTerm: false },
        { id: 'i-0ee4189ac3710b', name: 'dev-eks-node-03', launched: '15:10', age: '5h 05m', cost: 0.49, ip: '10.0.12.112', status: 'RUNNING', type: 'm5.large', isNew: true, isTerm: false }
      ],
      sampleEvents: [
        { id: 'i-09df18a2bc417e', name: 'dev-eks-node-04', type: 'm5.large', event: 'TERMINATED', window: '09:00 → 14:30 UTC', cost: 0.53, isOvertime: false, reason: 'Cluster Autoscaler Scaled Down' },
        { id: 'i-0c91ba42ef9901', name: 'dev-eks-node-01', type: 'm5.large', event: 'OVERTIME_RUNNING', window: '18:00 → 23:00 UTC', cost: 1.08, isOvertime: true, reason: 'Active Past 18:00 Cutoff' },
        { id: 'i-088f21ca6633dd', name: 'dev-eks-node-02', type: 'm5.large', event: 'OVERTIME_RUNNING', window: '18:00 → 23:00 UTC', cost: 0.55, isOvertime: true, reason: 'Active Past 18:00 Cutoff' },
        { id: 'i-0ee4189ac3710b', name: 'dev-eks-node-03', type: 'm5.large', event: 'SPAWNED', window: '15:10 UTC', cost: 0.49, isOvertime: false, reason: 'Cluster Autoscaler Scale-Out' },
        { id: 'i-0aa43b819f72c0', name: 'dev-eks-node-05', type: 'm5.large', event: 'TERMINATED', window: '09:00 → 15:10 UTC', cost: 0.60, isOvertime: false, reason: 'Spot Interruption / Replaced' },
        { id: 'i-078a9c21ef45da', name: 'dev-eks-node-06', type: 'm5.large', event: 'LAUNCHED', window: '09:00 UTC', cost: 0.86, isOvertime: false, reason: 'Scheduled Fleet Boot' }
      ]
    },
    staging: {
      id: 'staging',
      name: 'staging-eks-02 (QA & Automation)',
      scopeLabel: 'STAGING',
      controlPlaneSpend: 2.40,
      hourlyRatePerNode: 0.192, // m5.xlarge
      instanceType: 'm5.xlarge (4 vCPU · 16 GiB)',
      scheduleStart: 8,
      scheduleEnd: 19,
      activeHoursPattern: [0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 6, 6, 6, 5, 4, 4, 4, 4, 4, 0, 0, 0, 0],
      churnIn: 6,
      churnOut: 6,
      terminatedNodes: [
        { id: 'i-0stg18a2bc417e', launch: '08:00', term: '19:00', hrs: 11.0, cost: 2.11, reason: 'Automated Nightly Shutdown' },
        { id: 'i-0stg43b819f72c', launch: '11:00', term: '16:00', hrs: 5.0, cost: 0.96, reason: 'E2E Cypress Test Suite Complete' },
        { id: 'i-0stg9c21ef45da', launch: '08:00', term: '19:00', hrs: 11.0, cost: 2.11, reason: 'Automated Nightly Shutdown' }
      ],
      activeNodes: [
        { id: 'i-0stg99active01', name: 'stg-qa-node-01', launched: '08:00', age: '12h 10m', cost: 2.33, ip: '10.0.24.11', status: 'RUNNING', type: 'm5.xlarge', isNew: false, isTerm: false },
        { id: 'i-0stg99active02', name: 'stg-qa-node-02', launched: '08:00', age: '12h 10m', cost: 2.33, ip: '10.0.24.12', status: 'RUNNING', type: 'm5.xlarge', isNew: false, isTerm: false },
        { id: 'i-0stg99active03', name: 'stg-qa-node-03', launched: '08:00', age: '12h 10m', cost: 2.33, ip: '10.0.24.13', status: 'RUNNING', type: 'm5.xlarge', isNew: false, isTerm: false },
        { id: 'i-0stg99active04', name: 'stg-qa-node-04', launched: '08:00', age: '12h 10m', cost: 2.33, ip: '10.0.24.14', status: 'RUNNING', type: 'm5.xlarge', isNew: false, isTerm: false }
      ],
      sampleEvents: [
        { id: 'i-0stg18a2bc417e', name: 'stg-qa-node-01', type: 'm5.xlarge', event: 'TERMINATED', window: '08:00 → 19:00 UTC', cost: 2.11, isOvertime: false, reason: 'Automated Nightly Shutdown' },
        { id: 'i-0stg43b819f72c', name: 'stg-qa-node-02', type: 'm5.xlarge', event: 'TERMINATED', window: '11:00 → 16:00 UTC', cost: 0.96, isOvertime: false, reason: 'E2E Cypress Test Suite Complete' },
        { id: 'i-0stg99active01', name: 'stg-qa-node-03', type: 'm5.xlarge', event: 'ACTIVE', window: '08:00 → 19:00 UTC', cost: 2.33, isOvertime: false, reason: 'Standard Business Hours' },
        { id: 'i-0stg99active02', name: 'stg-qa-node-04', type: 'm5.xlarge', event: 'ACTIVE', window: '08:00 → 19:00 UTC', cost: 2.33, isOvertime: false, reason: 'Standard Business Hours' },
        { id: 'i-0stg9c21ef45da', name: 'stg-qa-node-05', type: 'm5.xlarge', event: 'TERMINATED', window: '08:00 → 19:00 UTC', cost: 2.11, isOvertime: false, reason: 'Automated Nightly Shutdown' }
      ]
    },
    prod: {
      id: 'prod',
      name: 'prod-eks-03 (High Availability 24/7)',
      scopeLabel: 'PROD',
      controlPlaneSpend: 2.40,
      hourlyRatePerNode: 0.192,
      instanceType: 'c5.2xlarge + r5.xlarge',
      scheduleStart: 0,
      scheduleEnd: 24,
      activeHoursPattern: [10, 10, 10, 10, 10, 11, 12, 12, 14, 15, 16, 16, 16, 15, 15, 14, 13, 13, 12, 12, 11, 10, 10, 10],
      churnIn: 18,
      churnOut: 16,
      terminatedNodes: [
        { id: 'i-0prd01termin88', launch: '02:00', term: '08:00', hrs: 6.0, cost: 1.15, reason: 'Karpenter Bin-Packing Consolidation' },
        { id: 'i-0prd02termin99', launch: '06:00', term: '14:00', hrs: 8.0, cost: 1.54, reason: 'Spot 2-Minute Termination Warning' }
      ],
      activeNodes: [
        { id: 'i-0prdactive901', name: 'prod-k8s-core-01', launched: '00:00', age: '20h 30m', cost: 3.94, ip: '10.0.100.22', status: 'RUNNING', type: 'c5.2xlarge', isNew: false, isTerm: false },
        { id: 'i-0prdactive902', name: 'prod-k8s-core-02', launched: '00:00', age: '20h 30m', cost: 3.94, ip: '10.0.100.23', status: 'RUNNING', type: 'c5.2xlarge', isNew: false, isTerm: false },
        { id: 'i-0prdactive903', name: 'prod-k8s-core-03', launched: '04:00', age: '16h 30m', cost: 3.17, ip: '10.0.100.24', status: 'RUNNING', type: 'r5.xlarge', isNew: true, isTerm: false }
      ],
      sampleEvents: [
        { id: 'i-0prd01termin88', name: 'prod-k8s-core-01', type: 'c5.2xlarge', event: 'TERMINATED', window: '02:00 → 08:00 UTC', cost: 1.15, isOvertime: false, reason: 'Karpenter Bin-Packing Consolidation' },
        { id: 'i-0prd02termin99', name: 'prod-k8s-core-02', type: 'c5.2xlarge', event: 'TERMINATED', window: '06:00 → 14:00 UTC', cost: 1.54, isOvertime: false, reason: 'Spot 2-Minute Termination Warning' },
        { id: 'i-0prdactive901', name: 'prod-k8s-core-03', type: 'c5.2xlarge', event: 'ACTIVE', window: '00:00 → 24:00 UTC', cost: 3.94, isOvertime: false, reason: '24/7 Production Ingress Fleet' },
        { id: 'i-0prdactive902', name: 'prod-k8s-core-04', type: 'c5.2xlarge', event: 'ACTIVE', window: '00:00 → 24:00 UTC', cost: 3.94, isOvertime: false, reason: '24/7 Production Ingress Fleet' },
        { id: 'i-0prdactive903', name: 'prod-k8s-core-05', type: 'r5.xlarge', event: 'SPAWNED', window: '04:00 UTC', cost: 3.17, isOvertime: false, reason: 'High-Memory Job Scale-Out' }
      ]
    }
  },
  ECS: {
    dev: {
      id: 'dev',
      name: 'checkout-ecs-cluster (EC2 Launch Type)',
      scopeLabel: 'DEV',
      controlPlaneSpend: 0.00,
      hourlyRatePerNode: 0.083,
      instanceType: 't3.xlarge Container Instances',
      scheduleStart: 9,
      scheduleEnd: 18,
      activeHoursPattern: [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 3, 3, 4, 4, 3, 2, 2, 2, 2, 1, 0, 0, 0],
      churnIn: 5,
      churnOut: 4,
      terminatedNodes: [
        { id: 'i-0ecsdev9911', launch: '09:00', term: '17:00', hrs: 8.0, cost: 0.66, reason: 'ECS Capacity Provider Scale-In' }
      ],
      activeNodes: [
        { id: 'i-0ecsactv881', name: 'checkout-ecs-host-01', launched: '09:00', age: '11h 00m', cost: 0.91, ip: '10.2.1.8', status: 'RUNNING', type: 't3.xlarge', isNew: false, isTerm: false },
        { id: 'i-0ecsactv882', name: 'checkout-ecs-host-02', launched: '11:00', age: '9h 00m', cost: 0.75, ip: '10.2.1.9', status: 'RUNNING', type: 't3.xlarge', isNew: false, isTerm: false }
      ],
      sampleEvents: [
        { id: 'i-0ecsdev9911', name: 'checkout-ecs-host-03', type: 't3.xlarge', event: 'TERMINATED', window: '09:00 → 17:00 UTC', cost: 0.66, isOvertime: false, reason: 'ECS Capacity Provider Scale-In' },
        { id: 'i-0ecsactv881', name: 'checkout-ecs-host-01', type: 't3.xlarge', event: 'OVERTIME_RUNNING', window: '18:00 → 21:00 UTC', cost: 0.91, isOvertime: true, reason: 'Active Past 18:00 Cutoff' },
        { id: 'i-0ecsactv882', name: 'checkout-ecs-host-02', type: 't3.xlarge', event: 'OVERTIME_RUNNING', window: '18:00 → 20:00 UTC', cost: 0.75, isOvertime: true, reason: 'Active Past 18:00 Cutoff' }
      ]
    },
    prod: {
      id: 'prod',
      name: 'payment-gateway-ecs (Fargate Serverless)',
      scopeLabel: 'PROD',
      controlPlaneSpend: 0.00,
      hourlyRatePerNode: 0.052,
      instanceType: 'Fargate vCPU: 1.0 · RAM: 2GB',
      scheduleStart: 0,
      scheduleEnd: 24,
      activeHoursPattern: [8, 8, 8, 8, 9, 11, 14, 16, 18, 19, 20, 20, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 8],
      churnIn: 24,
      churnOut: 22,
      terminatedNodes: [
        { id: 'task/pay-gw-task-9182', launch: '08:00', term: '14:00', hrs: 6.0, cost: 0.31, reason: 'Task Completed & De-registered' }
      ],
      activeNodes: [
        { id: 'task/pay-gw-task-1001', name: 'pay-gw-task-1001', launched: '00:00', age: '22h 10m', cost: 1.15, ip: '172.16.8.21', status: 'RUNNING', type: 'Fargate Task', isNew: false, isTerm: false },
        { id: 'task/pay-gw-task-1002', name: 'pay-gw-task-1002', launched: '06:00', age: '16h 10m', cost: 0.84, ip: '172.16.8.22', status: 'RUNNING', type: 'Fargate Task', isNew: false, isTerm: false }
      ],
      sampleEvents: [
        { id: 'task/pay-gw-task-9182', name: 'pay-gw-task-9182', type: 'Fargate Task', event: 'TERMINATED', window: '08:00 → 14:00 UTC', cost: 0.31, isOvertime: false, reason: 'Task Completed & De-registered' },
        { id: 'task/pay-gw-task-1001', name: 'pay-gw-task-1001', type: 'Fargate Task', event: 'ACTIVE', window: '00:00 → 24:00 UTC', cost: 1.15, isOvertime: false, reason: '24/7 Payment Service Worker' },
        { id: 'task/pay-gw-task-1002', name: 'pay-gw-task-1002', type: 'Fargate Task', event: 'ACTIVE', window: '06:00 → 24:00 UTC', cost: 0.84, isOvertime: false, reason: '24/7 Payment Service Worker' }
      ]
    }
  }
};

export default function ClusterLifecycleCard({
  clusterData,
  loading = false,
  selectedDate,
  availableDates = [],
  onDateChange,
  cutoffHour = '18:00',
  onCutoffChange,
  onSelectResource,
  forexRate = 95.32,
  serviceName = 'Amazon EKS'
}) {
  // Determine if service is EKS or ECS
  const serviceKey = useMemo(() => {
    const s = (serviceName || clusterData?.orchestrator || '').toLowerCase();
    if (s.includes('ecs')) return 'ECS';
    return 'EKS';
  }, [serviceName, clusterData]);

  const hasLiveCurCluster = useMemo(() => {
    return Boolean(clusterData && clusterData.nodes && clusterData.nodes.length > 0);
  }, [clusterData]);

  // Selected cluster tab: 'live_cur' if real nodes exist and chosen, or 'dev' / 'staging' / 'prod'
  const [selectedClusterKey, setSelectedClusterKey] = useState(hasLiveCurCluster ? 'live_cur' : 'dev');
  const [hoveredHour, setHoveredHour] = useState(null);
  const [nodeSearch, setNodeSearch] = useState('');

  // Update selected cluster if live data becomes available or disappears
  React.useEffect(() => {
    if (hasLiveCurCluster && selectedClusterKey !== 'live_cur') {
      setSelectedClusterKey('live_cur');
    }
  }, [hasLiveCurCluster]);

  const isLiveCur = selectedClusterKey === 'live_cur' && hasLiveCurCluster;
  const activePreset = CLUSTER_PRESETS[serviceKey]?.[selectedClusterKey] || CLUSTER_PRESETS[serviceKey]?.dev;

  // Compute effective timeline and stats based on active selection and overtime simulator
  const clusterView = useMemo(() => {
    if (isLiveCur) {
      const kpis = clusterData.kpis || {};
      const timeline = clusterData.hourly_timeline || [];
      const nodes = clusterData.nodes || [];
      const cpSpend = kpis.total_cluster_spend > 0 ? (kpis.total_cluster_spend * 0.15) : 2.40;
      const nodeSpend = kpis.spend_today || 0;

      return {
        name: `${clusterData.orchestrator || 'EKS Production'} (${clusterData.dataset_name || 'Live CUR Dataset'})`,
        controlPlaneSpend: cpSpend,
        totalComputeSpend: nodeSpend,
        trueTotalSpend: cpSpend + nodeSpend,
        peakNodes: kpis.peak_hourly_nodes || nodes.length,
        instanceType: 'm5.large / c5.xlarge (Live CUR Nodes)',
        overtimeCost: kpis.overtime_spend_today || 0,
        overtimeHours: kpis.overtime_hours_detected || 0,
        churnIn: kpis.nodes_launched_today || 0,
        churnOut: kpis.nodes_terminated_today || 0,
        hourlyTimeline: timeline,
        terminatedNodes: nodes.filter(n => n.is_terminated_today).map(n => ({
          id: n.resource_id,
          launch: '09:00',
          term: n.last_seen_date || '18:00',
          hrs: 8.0,
          cost: n.spend_today || 0.85,
          reason: 'Node Group Scale Down'
        })),
        activeNodes: nodes.map(n => ({
          id: n.resource_id,
          name: n.resource_name || n.resource_id,
          launched: n.first_seen_date || '09:00',
          age: `${n.active_days || 1}d uptime`,
          cost: n.spend_today,
          ip: '10.0.x.x',
          status: n.status || 'RUNNING',
          type: n.instance_type || 'EC2 Instance',
          isNew: n.is_launched_today,
          isTerm: n.is_terminated_today
        })),
        auditEvents: nodes.map(n => {
          const isOt = Boolean(n.is_overtime && cutoffHour !== '24:00');
          return {
            id: n.resource_id,
            name: n.resource_name || n.resource_id,
            type: n.instance_type || 'm5.large',
            event: n.event || (isOt ? 'OVERTIME_RUNNING' : (cutoffHour === '24:00' ? 'RUNNING_24X7' : 'ACTIVE')),
            window: n.window || (cutoffHour === '24:00' ? '00:00 → 24:00 UTC (24/7 Baseline)' : 'Active Today'),
            reason: n.reason || (cutoffHour === '24:00' ? '24x7 Core Cluster Fleet' : 'Managed Node Group'),
            cost: n.spend_today || 0,
            isOvertime: isOt,
            classification: n.classification || (cutoffHour === '24:00' ? '✓ 24/7 Production Fleet' : (isOt ? '⚠️ Avoidable Overtime' : '✓ Business Hours'))
          };
        }),
        allInventory: nodes
      };
    }

    // Preset cluster with authentic schedule cutoff logic
    const c = activePreset;
    const cutoffInt = parseInt((cutoffHour || '18:00').split(':')[0], 10) || 18;
    const effectivePattern = [...c.activeHoursPattern];

    const totalNodeHours = effectivePattern.reduce((a, b) => a + b, 0);
    const totalComputeSpend = totalNodeHours * c.hourlyRatePerNode;
    const trueTotalSpend = c.controlPlaneSpend + totalComputeSpend;

    let overtimeHours = 0;
    let overtimeNodeHours = 0;
    if (c.scheduleEnd < 24) {
      for (let h = cutoffInt; h < 24; h++) {
        if (effectivePattern[h] > 0) {
          overtimeHours++;
          overtimeNodeHours += effectivePattern[h];
        }
      }
    }
    const overtimeCost = overtimeNodeHours * c.hourlyRatePerNode;
    const peakNodes = Math.max(...effectivePattern);

    // Build 24-hour timeline objects
    const hourlyTimeline = effectivePattern.map((cnt, h) => {
      const isOt = c.scheduleEnd < 24 && h >= cutoffInt && cnt > 0;
      return {
        hour: `${String(h).padStart(2, '0')}:00`,
        node_count: cnt,
        cost: cnt * c.hourlyRatePerNode,
        is_overtime: isOt,
        active_instances: cnt > 0 ? c.activeNodes.slice(0, cnt).map(n => n.id) : []
      };
    });

    return {
      name: c.name,
      controlPlaneSpend: c.controlPlaneSpend,
      totalComputeSpend: totalComputeSpend,
      trueTotalSpend: trueTotalSpend,
      peakNodes: peakNodes,
      instanceType: c.instanceType,
      overtimeCost: overtimeCost,
      overtimeHours: overtimeHours,
      churnIn: c.churnIn,
      churnOut: c.churnOut,
      hourlyTimeline: hourlyTimeline,
      terminatedNodes: c.terminatedNodes,
      activeNodes: c.activeNodes,
      auditEvents: c.sampleEvents || [],
      allInventory: c.activeNodes.map(n => ({
        resource_id: n.id,
        resource_name: n.name,
        status: n.status,
        first_seen_date: selectedDate || 'Today',
        last_seen_date: selectedDate || 'Today',
        spend_today: n.cost,
        overtime_spend_today: n.cost * 0.3,
        total_spend: n.cost,
        is_launched_today: n.isNew,
        is_terminated_today: n.isTerm
      }))
    };
  }, [isLiveCur, clusterData, activePreset, cutoffHour, selectedDate]);

  const maxTimelineNodes = useMemo(() => {
    return Math.max(...clusterView.hourlyTimeline.map(h => h.node_count || 0), 1);
  }, [clusterView]);

  const filteredInventory = useMemo(() => {
    if (!nodeSearch.trim()) return clusterView.allInventory;
    const q = nodeSearch.toLowerCase();
    return clusterView.allInventory.filter(
      n => (n.resource_id || '').toLowerCase().includes(q) || (n.resource_name || '').toLowerCase().includes(q)
    );
  }, [clusterView, nodeSearch]);

  const activeHourInfo = hoveredHour !== null ? clusterView.hourlyTimeline[hoveredHour] : null;

  return (
    <div className="clay-card p-5 sm:p-6 rounded-3xl space-y-6 border border-zorvex-border/60 dark:border-zorvex-dark-border/60 transition-all">
      {/* ==================== 1. HEADER & INTERACTIVE CLUSTER SCOPE RIBBON ==================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zorvex-border/40 dark:border-zorvex-dark-border/40">
        <div>
          <div className="flex items-center gap-2">
            <AwsServiceIcon service={serviceKey === 'ECS' ? 'Amazon ECS' : 'Amazon EKS'} size="sm" className="w-6 h-6" />
            <h2 className="text-base sm:text-lg font-black tracking-tight text-zorvex-text dark:text-zorvex-dark-text">
              Amazon {serviceKey} Cluster Lifecycle & Overtime Tracker
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-forest-dark dark:text-emerald-300">
              {serviceKey === 'ECS' ? 'Fargate / Container Fleet' : 'Kubernetes Fleet'}
            </span>
            {!hasLiveCurCluster && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/20">
                Interactive Simulator Mode
              </span>
            )}
          </div>
          <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">
            Correlating control planes with dynamic EC2 worker nodes, hourly pod churn, and overtime schedule spend leakage.
          </p>
        </div>

        {/* Date & Standard Cutoff Selectors */}
        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-clay-pill clay-input text-xs font-semibold">
            <Calendar className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-forest-highlight" />
            <span className="text-[11px] text-zorvex-text-secondary mr-1">Date:</span>
            <select
              value={selectedDate || clusterData?.target_date || '2026-10-15'}
              onChange={(e) => onDateChange && onDateChange(e.target.value)}
              className="bg-transparent text-xs font-bold font-mono text-zorvex-text dark:text-zorvex-dark-text focus:outline-none cursor-pointer"
            >
              {(availableDates && availableDates.length > 0 ? availableDates : [clusterData?.target_date || selectedDate || '2026-10-15']).map(d => (
                <option key={d} value={d} className="bg-zorvex-card dark:bg-zorvex-dark-surface text-zorvex-text dark:text-zorvex-dark-text">
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-clay-pill clay-input text-xs font-semibold">
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="text-[11px] text-zorvex-text-secondary mr-1">Cutoff:</span>
            <select
              value={cutoffHour || '18:00'}
              onChange={(e) => onCutoffChange && onCutoffChange(e.target.value)}
              className="bg-transparent text-xs font-bold font-mono text-zorvex-text dark:text-zorvex-dark-text focus:outline-none cursor-pointer"
            >
              <option value="24:00" className="bg-zorvex-card dark:bg-zorvex-dark-surface text-zorvex-text dark:text-zorvex-dark-text">24/7 Production (No Cutoff / Zero Overtime)</option>
              <option value="17:00" className="bg-zorvex-card dark:bg-zorvex-dark-surface text-zorvex-text dark:text-zorvex-dark-text">17:00 (5:00 PM - Early Dev)</option>
              <option value="18:00" className="bg-zorvex-card dark:bg-zorvex-dark-surface text-zorvex-text dark:text-zorvex-dark-text">18:00 (6:00 PM - Standard Cutoff)</option>
              <option value="19:00" className="bg-zorvex-card dark:bg-zorvex-dark-surface text-zorvex-text dark:text-zorvex-dark-text">19:00 (7:00 PM - Extended Dev)</option>
              <option value="20:00" className="bg-zorvex-card dark:bg-zorvex-dark-surface text-zorvex-text dark:text-zorvex-dark-text">20:00 (8:00 PM - Staging Cutoff)</option>
              <option value="21:00" className="bg-zorvex-card dark:bg-zorvex-dark-surface text-zorvex-text dark:text-zorvex-dark-text">21:00 (9:00 PM - Extended Staging)</option>
              <option value="22:00" className="bg-zorvex-card dark:bg-zorvex-dark-surface text-zorvex-text dark:text-zorvex-dark-text">22:00 (10:00 PM - Batch Night Cutoff)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ==================== 2. CLUSTER SELECTOR RIBBON ==================== */}
      <div className="clay-card p-3 sm:p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 bg-zorvex-secondary/40 dark:bg-zorvex-dark-secondary/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-600/10 dark:bg-emerald-500/20 flex items-center justify-center font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-600/20">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary block">
              Active Cluster Target
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
              {clusterView.name}
            </span>
          </div>
        </div>

        {/* Dynamic Cluster Buttons */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          {hasLiveCurCluster && (
            <button
              type="button"
              onClick={() => setSelectedClusterKey('live_cur')}
              className={`px-3 py-1.5 rounded-clay-pill transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedClusterKey === 'live_cur'
                  ? 'clay-pill-active'
                  : 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-text-secondary hover:text-zorvex-text border border-zorvex-border dark:border-zorvex-dark-border'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE CUR CLUSTER ({clusterData.nodes.length} Nodes)</span>
            </button>
          )}

          {Object.entries(CLUSTER_PRESETS[serviceKey] || {}).map(([key, c]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedClusterKey(key)}
              className={`px-3 py-1.5 rounded-clay-pill transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedClusterKey === key
                  ? 'clay-pill-active'
                  : 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-text-secondary hover:text-zorvex-text border border-zorvex-border dark:border-zorvex-dark-border'
              }`}
            >
              <span>{c.scopeLabel}: {c.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ==================== 3. 4 KEY EXECUTIVE METRIC PILLARS ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Pillar 1: True Cluster Spend */}
        <div className="clay-card p-5 space-y-1 rounded-2xl flex flex-col justify-between">
          <span className="text-[11px] font-black uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
            True Cluster Spend (24h)
          </span>
          <div className="text-3xl font-black font-mono text-zorvex-forest dark:text-zorvex-forest-highlight my-1">
            ${Number(clusterView.trueTotalSpend || 0).toFixed(2)}
          </div>
          <div className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary font-mono flex items-center gap-1">
            <span className="text-zorvex-text dark:text-zorvex-dark-text font-bold">
              ${Number(clusterView.controlPlaneSpend || 0).toFixed(2)}
            </span>
            <span>Control Plane +</span>
            <span className="text-zorvex-text dark:text-zorvex-dark-text font-bold">
              ${Number(clusterView.totalComputeSpend || 0).toFixed(2)}
            </span>
            <span>Nodes</span>
          </div>
        </div>

        {/* Pillar 2: Peak Fleet Capacity */}
        <div className="clay-card p-5 space-y-1 rounded-2xl flex flex-col justify-between">
          <span className="text-[11px] font-black uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
            Peak Fleet Capacity
          </span>
          <div className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 my-1">
            {clusterView.peakNodes} {serviceKey === 'ECS' && clusterView.name.includes('Fargate') ? 'Tasks' : 'EC2 Nodes'}
          </div>
          <div className="text-[11px] font-medium text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary truncate" title={clusterView.instanceType}>
            {clusterView.instanceType}
          </div>
        </div>

        {/* Pillar 3: Overtime Schedule Leak */}
        <div className="clay-card p-5 space-y-1 rounded-2xl flex flex-col justify-between border-l-4 border-l-[#C85A32]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#C85A32]">
              Overtime Schedule Leak
            </span>
            {clusterView.overtimeHours > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                ALERT
              </span>
            )}
          </div>
          <div className="text-3xl font-black font-mono text-[#C85A32] my-1">
            {clusterView.overtimeCost > 0 ? `+$${clusterView.overtimeCost.toFixed(2)}` : '$0.00'}
          </div>
          <div className="text-[11px] font-semibold text-[#C85A32]">
            {clusterView.overtimeHours > 0 ? `+${clusterView.overtimeHours}.0 hrs past ${cutoffHour} cutoff` : '● Strict Cutoff (Zero Overtime)'}
          </div>
        </div>

        {/* Pillar 4: Daily Churn */}
        <div className="clay-card p-5 space-y-1 rounded-2xl flex flex-col justify-between">
          <span className="text-[11px] font-black uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
            Daily Node Churn
          </span>
          <div className="text-3xl font-black font-mono text-zorvex-text dark:text-zorvex-dark-text my-1">
            {clusterView.churnIn} In / {clusterView.churnOut} Out
          </div>
          <div className="text-[11px] font-medium text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
            {clusterView.churnIn} spawned · {clusterView.churnOut} terminated today
          </div>
        </div>
      </div>

      {/* ==================== 5. 24-HOUR ACTIVE NODE COUNT TIMELINE BAR CHART ==================== */}
      <div className="clay-card p-5 sm:p-6 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zorvex-border/40 dark:border-zorvex-dark-border/40">
          <div>
            <h3 className="text-sm sm:text-base font-black text-zorvex-text dark:text-zorvex-dark-text">
              24-Hour Active Node Count Timeline
            </h3>
            <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">
              Hover over any hour bar to inspect physical running instance IDs and exact hourly spend.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-emerald-600 dark:bg-emerald-500" />
              <span className="text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                Scheduled Hours (09:00 - 18:00)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-[#C85A32]" />
              <span className="text-[#C85A32]">Overtime / Extended Leak</span>
            </div>
          </div>
        </div>

        {/* Timeline Bar Chart Canvas */}
        <div className="h-44 flex items-end gap-1.5 sm:gap-2 pt-6 pb-2 border-b border-zorvex-border/40 dark:border-zorvex-dark-border/40">
          {clusterView.hourlyTimeline.map((h, hourIdx) => {
            const cnt = h.node_count;
            const isOt = h.is_overtime;
            const isHovered = hoveredHour === hourIdx;
            const heightPct = maxTimelineNodes > 0 ? (cnt / maxTimelineNodes) * 100 : 0;

            return (
              <div
                key={h.hour}
                onMouseEnter={() => setHoveredHour(hourIdx)}
                onMouseLeave={() => setHoveredHour(null)}
                className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
              >
                {/* Visual Bar */}
                <div
                  style={{ height: `${Math.max(4, heightPct)}%` }}
                  className={`w-full rounded-md transition-all duration-200 ${
                    isOt
                      ? isHovered
                        ? 'bg-[#B04E2B] ring-2 ring-[#C85A32] shadow-sm'
                        : 'bg-[#C85A32] hover:bg-[#B04E2B]'
                      : cnt > 0
                      ? isHovered
                        ? 'bg-emerald-700 dark:bg-emerald-400 ring-2 ring-emerald-500'
                        : 'bg-emerald-600 dark:bg-emerald-500 hover:brightness-110'
                      : 'bg-zorvex-border/40 dark:bg-zorvex-dark-border/40'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Timeline Hour Labels */}
        <div className="flex justify-between text-[10px] font-mono text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary px-1">
          <span>00:00</span>
          <span>04:00</span>
          <span>08:00</span>
          <span className="font-extrabold text-emerald-600 dark:text-emerald-400">09:00 (Env Start)</span>
          <span>12:00</span>
          <span className="font-extrabold text-[#C85A32]">18:00 (Target Stop)</span>
          <span>20:00</span>
          <span>23:00</span>
        </div>

        {/* Hover Inspector Tooltip Strip */}
        {activeHourInfo && (
          <div className="p-3 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-all">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm text-zorvex-text dark:text-zorvex-dark-text">
                Hour {activeHourInfo.hour} UTC
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                activeHourInfo.is_overtime
                  ? 'bg-amber-500/20 text-[#C85A32] dark:text-amber-300'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              }`}>
                {activeHourInfo.is_overtime ? 'Overtime Leakage Window' : 'Standard Scheduled Window'}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">Active Fleet: </span>
                <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text">{activeHourInfo.node_count} Nodes</span>
              </div>
              <div>
                <span className="text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">Hourly Spend: </span>
                <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text">${Number(activeHourInfo?.cost || 0).toFixed(3)}</span>
              </div>
              {activeHourInfo.active_instances?.length > 0 && (
                <div className="hidden md:block text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                  Instances: {activeHourInfo.active_instances.slice(0, 3).join(', ')}
                  {activeHourInfo.active_instances.length > 3 ? ` +${activeHourInfo.active_instances.length - 3}` : ''}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ==================== 6. EPHEMERAL NODE LIFECYCLE AUDIT (DEMO DESIGN) ==================== */}
      <div className="clay-card p-5 space-y-3 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zorvex-border/40 dark:border-zorvex-dark-border/40">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-zorvex-forest dark:text-emerald-400" />
            <h3 className="text-sm font-extrabold text-zorvex-text dark:text-zorvex-dark-text tracking-tight">
              Ephemeral EC2 Node Lifecycle Audit (Today)
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
            {(clusterView.auditEvents || []).length} ephemeral node events audited
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zorvex-border/50 dark:border-zorvex-dark-border/50">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-zorvex-surface dark:bg-zorvex-dark-surface/80 text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary uppercase text-[10px] tracking-wider border-b border-zorvex-border dark:border-zorvex-dark-border font-bold">
              <tr>
                <th className="py-2.5 px-3">Physical Instance ID</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Lifecycle Event</th>
                <th className="py-2.5 px-3">Window & Reason</th>
                <th className="py-2.5 px-3 text-right">Billed Run Cost</th>
                <th className="py-2.5 px-3">Classification</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zorvex-border/30 dark:divide-zorvex-dark-border/30">
              {(!clusterView.auditEvents || clusterView.auditEvents.length === 0) ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                    Zero ephemeral lifecycle events recorded today.
                  </td>
                </tr>
              ) : (
                clusterView.auditEvents.map((ev, eIdx) => {
                  const isTerm = ev.event && ev.event.includes('TERMINATED');
                  const isOt = ev.isOvertime || (ev.event && ev.event.includes('OVERTIME'));
                  const badgeColor = isTerm
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    : isOt
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20';

                  return (
                    <tr
                      key={ev.id + eIdx}
                      className="hover:bg-zorvex-surface/60 dark:hover:bg-zorvex-dark-surface/60 transition-colors"
                    >
                      {/* 1. Physical Instance ID */}
                      <td className="py-2.5 px-3 font-bold text-zorvex-text dark:text-zorvex-dark-text whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectResource && onSelectResource({
                            resource_id: ev.id,
                            service: 'Amazon EC2',
                            resource_name: ev.name || ev.id,
                            name: ev.name || ev.id,
                            total_cost: typeof ev.cost === 'number' ? ev.cost : parseFloat(String(ev.cost || '0').replace('$', '')) || 0,
                            cost: typeof ev.cost === 'number' ? ev.cost : parseFloat(String(ev.cost || '0').replace('$', '')) || 0,
                            active_days: 1,
                            type: ev.type || 'm5.large',
                            category: 'EC2_INSTANCE',
                            category_label: 'EC2 Instance',
                            primary_usage_type: `${ev.type || 'm5.large'} BoxUsage`
                          })}
                          className="flex items-center gap-1.5 hover:underline text-zorvex-text dark:text-zorvex-dark-text text-left cursor-pointer group"
                          title="Click to open Resource Detail Drawer"
                        >
                          <Cpu className={`w-3.5 h-3.5 ${isTerm ? 'text-rose-500' : isOt ? 'text-amber-500' : 'text-emerald-500'}`} />
                          <span className="group-hover:text-zorvex-forest dark:group-hover:text-emerald-400 font-extrabold">{ev.id}</span>
                          {ev.name && ev.name !== ev.id && (
                            <span className="text-[10px] text-zorvex-text-secondary font-normal truncate max-w-[140px]">
                              ({ev.name})
                            </span>
                          )}
                        </button>
                      </td>

                      {/* 2. Type */}
                      <td className="py-2.5 px-3 text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary whitespace-nowrap">
                        {ev.type || 'm5.large'}
                      </td>

                      {/* 3. Lifecycle Event Badge */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgeColor}`}>
                          {ev.event}
                        </span>
                      </td>

                      {/* 4. Window & Reason */}
                      <td className="py-2.5 px-3 text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary whitespace-nowrap">
                        <div className="font-semibold text-zorvex-text dark:text-zorvex-dark-text text-[11px]">
                          {ev.window}
                        </div>
                        {ev.reason && (
                          <div className={`text-[10px] ${isOt ? 'text-amber-600 dark:text-amber-400 font-medium' : isTerm ? 'text-rose-600 dark:text-rose-400' : 'text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary'}`}>
                            {ev.reason}
                          </div>
                        )}
                      </td>

                      {/* 5. Billed Run Cost */}
                      <td className="py-2.5 px-3 text-right font-extrabold text-zorvex-text dark:text-zorvex-dark-text whitespace-nowrap">
                        ${typeof ev.cost === 'number' ? ev.cost.toFixed(2) : String(ev.cost).replace('$', '')}
                      </td>

                      {/* 6. Classification */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isOt ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#C85A32] dark:text-amber-300">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            Avoidable Overtime
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            {ev.classification || (cutoffHour === '24:00' ? '24/7 Production Fleet' : 'Business Hours')}
                          </span>
                        )}
                      </td>

                      {/* 7. Action */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectResource && onSelectResource({
                            resource_id: ev.id,
                            service: 'Amazon EC2',
                            resource_name: ev.name || ev.id,
                            name: ev.name || ev.id,
                            total_cost: typeof ev.cost === 'number' ? ev.cost : parseFloat(String(ev.cost || '0').replace('$', '')) || 0,
                            cost: typeof ev.cost === 'number' ? ev.cost : parseFloat(String(ev.cost || '0').replace('$', '')) || 0,
                            active_days: 1,
                            type: ev.type || 'm5.large',
                            category: 'EC2_INSTANCE',
                            category_label: 'EC2 Instance',
                            primary_usage_type: `${ev.type || 'm5.large'} BoxUsage`
                          })}
                          className="px-2.5 py-1 rounded-md text-[10px] font-bold clay-button text-zorvex-text dark:text-zorvex-dark-text inline-flex items-center gap-1 hover:text-zorvex-forest dark:hover:text-emerald-400"
                        >
                          <span>Inspect</span>
                          <ArrowUpRight className="w-2.5 h-2.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== 7. CLUSTER COMPUTE NODE INVENTORY TABLE ==================== */}
      <div className="clay-card p-4 sm:p-5 rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs sm:text-sm font-black text-zorvex-text dark:text-zorvex-dark-text">
              Cluster Compute Node Inventory ({filteredInventory.length} Instances)
            </h3>
            <p className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
              Actual compute instances and container tasks discovered from CUR unblended telemetry.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zorvex-text-secondary" />
            <input
              type="text"
              value={nodeSearch}
              onChange={(e) => setNodeSearch(e.target.value)}
              placeholder="Search instance ID or name..."
              className="w-full pl-9 pr-3 py-1.5 rounded-clay-pill clay-input text-xs font-medium focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zorvex-border/50 dark:border-zorvex-dark-border/50">
          <table className="w-full text-left text-xs">
            <thead className="bg-zorvex-surface dark:bg-zorvex-dark-surface/80 border-b border-zorvex-border dark:border-zorvex-dark-border text-[11px] font-bold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Instance / Node ID</th>
                <th className="py-2.5 px-3">Workload Name</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Lifecycle Window</th>
                <th className="py-2.5 px-3 text-right">Spend on {selectedDate || 'Today'}</th>
                <th className="py-2.5 px-3 text-right">Overtime Spend</th>
                <th className="py-2.5 px-3 text-right">Total Spend</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zorvex-border/30 dark:divide-zorvex-dark-border/30">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                    No cluster compute nodes found matching "{nodeSearch}".
                  </td>
                </tr>
              ) : (
                filteredInventory.map((n) => (
                  <tr
                    key={n.resource_id}
                    className="hover:bg-zorvex-surface/60 dark:hover:bg-zorvex-dark-surface/60 transition-colors"
                  >
                    {/* Instance ID */}
                    <td className="py-2.5 px-3 font-mono font-bold text-zorvex-text dark:text-zorvex-dark-text whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-zorvex-forest dark:text-emerald-400" />
                        <span>{n.resource_id}</span>
                        {n.is_launched_today && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                            NEW
                          </span>
                        )}
                        {n.is_terminated_today && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                            TERMINATED
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Name */}
                    <td className="py-2.5 px-3 font-medium text-zorvex-text dark:text-zorvex-dark-text whitespace-nowrap max-w-[200px] truncate" title={n.resource_name}>
                      {n.resource_name || n.resource_id}
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        n.status === 'RUNNING'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-zorvex-border/50 text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${n.status === 'RUNNING' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {n.status || 'RUNNING'}
                      </span>
                    </td>

                    {/* Lifecycle Window */}
                    <td className="py-2.5 px-3 font-mono text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary whitespace-nowrap">
                      {n.first_seen_date || '2026-10-01'} &rarr; {n.last_seen_date || '2026-10-16'}
                    </td>

                    {/* Spend Today */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-zorvex-text dark:text-zorvex-dark-text whitespace-nowrap">
                      ${Number(n.spend_today || 0).toFixed(2)}
                    </td>

                    {/* Overtime Spend */}
                    <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                      {Number(n.overtime_spend_today || 0) > 0 ? (
                        <span className="font-bold text-[#C85A32]">
                          ${Number(n.overtime_spend_today || 0).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-zorvex-text-secondary">
                          $0.00
                        </span>
                      )}
                    </td>

                    {/* Total Spend */}
                    <td className="py-2.5 px-3 text-right font-mono text-zorvex-text dark:text-zorvex-dark-text whitespace-nowrap">
                      ${Number(n.total_spend || n.spend_today || 0).toFixed(2)}
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectResource && onSelectResource({
  resource_id: n.resource_id,
  service: serviceName || 'Amazon EC2',
  resource_name: n.resource_name,
  name: n.resource_name || n.resource_id,
  total_cost: Number(n.total_spend || n.spend_today || 0),
  cost: Number(n.spend_today || 0),
  active_days: n.active_days || 1,
  category: 'EC2_INSTANCE',
  category_label: 'EC2 Instance',
  primary_usage_type: `${n.instance_type || 'm5.large'} BoxUsage`
})}
                        className="px-2.5 py-1 rounded-md text-[10px] font-bold clay-button text-zorvex-text dark:text-zorvex-dark-text inline-flex items-center gap-1 hover:text-zorvex-forest dark:hover:text-emerald-400"
                      >
                        <span>Inspect</span>
                        <ArrowUpRight className="w-2.5 h-2.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
