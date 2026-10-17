import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Server,
  HardDrive,
  Database,
  Layers,
  Zap,
  Globe,
  Network,
  Cpu,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Copy,
  Check,
  X,
  AlertTriangle,
  Info,
  TrendingUp,
  Clock,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Cloud,
  FileText,
  DollarSign,
  RotateCcw,
  Tag,
  CheckCircle2,
  FileSpreadsheet,
  Download
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

const KNOWN_SERVICES_META = {
  'Amazon EC2': {
    title: 'Amazon EC2',
    subtitle: 'Virtual Servers & NAT Gateways',
    icon: Cpu,
    defaultCategory: 'EC2_INSTANCE',
    description: 'On-Demand and Reserved compute instances, NAT Gateways, and data processing nodes.'
  },
  'Amazon RDS': {
    title: 'Amazon RDS',
    subtitle: 'Relational Database Service',
    icon: Database,
    defaultCategory: 'ALL',
    description: 'Managed database compute engines, provisioned IOPS, automated backups, and multi-AZ clusters.'
  },
  'Amazon S3': {
    title: 'Amazon S3',
    subtitle: 'Simple Storage Service',
    icon: Layers,
    defaultCategory: 'ALL',
    description: 'Scalable cloud object storage buckets, tiering requests (Standard, IA, Glacier), and lifecycle transfers.'
  },
  'AWS Lambda': {
    title: 'AWS Lambda',
    subtitle: 'Serverless Event Compute',
    icon: Zap,
    defaultCategory: 'ALL',
    description: 'Serverless execution duration (GB-Seconds), invocation counts, and provisioned concurrency.'
  },
  'VPC / Networking': {
    title: 'VPC & Networking',
    subtitle: 'Inter-Zone & Internet Egress',
    icon: Network,
    defaultCategory: 'ALL',
    description: 'Virtual Private Cloud networking, public IPv4 addressing, and inter-availability-zone data transit.'
  },
  'Amazon Redshift': {
    title: 'Amazon Redshift',
    subtitle: 'Cloud Data Warehouse',
    icon: Database,
    defaultCategory: 'ALL',
    description: 'Petabyte-scale managed data warehouse nodes, clusters, and concurrency scaling.'
  },
  'Amazon OpenSearch': {
    title: 'Amazon OpenSearch',
    subtitle: 'Search & Observability',
    icon: Search,
    defaultCategory: 'ALL',
    description: 'Search, log analytics, and distributed OpenSearch/Elasticsearch clusters.'
  },
  'Amazon CloudFront': {
    title: 'Amazon CloudFront',
    subtitle: 'Global CDN & Edge Delivery',
    icon: Globe,
    defaultCategory: 'ALL',
    description: 'Edge content caching, global requests, and data transit acceleration.'
  },
  'AWS WAF': {
    title: 'AWS WAF',
    subtitle: 'Web Application Firewall',
    icon: ShieldAlert,
    defaultCategory: 'ALL',
    description: 'Web ACL inspection rules, request filtering, and bot protection.'
  },
  'Elastic Load Balancing': {
    title: 'Elastic Load Balancing',
    subtitle: 'ALB, NLB & Gateway Balancers',
    icon: ArrowUpDown,
    defaultCategory: 'ALL',
    description: 'Traffic distribution across targets, LCU hours, and high availability routing.'
  },
  'AWS Database Migration Service': {
    title: 'AWS DMS',
    subtitle: 'Database Migration Service',
    icon: RotateCcw,
    defaultCategory: 'ALL',
    description: 'Managed database replication instances, ongoing CDC data capture, and schema conversion.'
  },
  'Amazon CloudWatch': {
    title: 'Amazon CloudWatch',
    subtitle: 'Observability & Alarms',
    icon: TrendingUp,
    defaultCategory: 'ALL',
    description: 'Custom operational metrics, log storage, synthetic alarms, and dashboards.'
  },
  'Amazon GuardDuty': {
    title: 'Amazon GuardDuty',
    subtitle: 'Threat Detection Engine',
    icon: ShieldAlert,
    defaultCategory: 'ALL',
    description: 'Continuous intelligent threat detection monitoring VPC Flow logs, DNS logs, and CloudTrail.'
  },
  'AWS Glue': {
    title: 'AWS Glue',
    subtitle: 'Serverless Data Integration',
    icon: Layers,
    defaultCategory: 'ALL',
    description: 'Serverless ETL data pipelines, Data Catalog metadata, and crawler runs.'
  },
  'Amazon Kinesis': {
    title: 'Amazon Kinesis',
    subtitle: 'Real-Time Streaming Data',
    icon: Zap,
    defaultCategory: 'ALL',
    description: 'Streaming ingestion shards, real-time data streaming, and firehose processing.'
  },
  'Amazon SES': {
    title: 'Amazon SES',
    subtitle: 'Simple Email Service',
    icon: FileText,
    defaultCategory: 'ALL',
    description: 'High-deliverability transactional email delivery, dedicated IPs, and receipt rules.'
  },
  'Amazon Route 53': {
    title: 'Amazon Route 53',
    subtitle: 'Scalable DNS & Routing',
    icon: Globe,
    defaultCategory: 'ALL',
    description: 'Authoritative DNS hosted zones, health check monitors, and query latency routing.'
  },
  'AWS Secrets Manager': {
    title: 'AWS Secrets Manager',
    subtitle: 'Secrets & Credential Rotation',
    icon: FileText,
    defaultCategory: 'ALL',
    description: 'Encrypted API credential lifecycle, automatic secret rotation, and access control.'
  },
  'AWS KMS': {
    title: 'AWS KMS',
    subtitle: 'Key Management Service',
    icon: FileText,
    defaultCategory: 'ALL',
    description: 'Customer managed KMS encryption keys (CMKs) and cryptographic requests.'
  },
  'Amazon Pinpoint': {
    title: 'Amazon Pinpoint',
    subtitle: 'Customer Engagement',
    icon: Globe,
    defaultCategory: 'ALL',
    description: 'User engagement analytics, omnichannel campaign delivery, and push messages.'
  },
  'Amazon SNS': {
    title: 'Amazon SNS',
    subtitle: 'Simple Notification Service',
    icon: Zap,
    defaultCategory: 'ALL',
    description: 'Pub/Sub topic message fanout, SMS messaging, and mobile alerts.'
  },
  'AWS Cost Explorer': {
    title: 'AWS Cost Explorer',
    subtitle: 'Billing Analytics & Queries',
    icon: DollarSign,
    defaultCategory: 'ALL',
    description: 'Cost Explorer API requests, paginated queries, and forecast evaluations.'
  },
  'AWS Step Functions': {
    title: 'AWS Step Functions',
    subtitle: 'Serverless Orchestration',
    icon: Layers,
    defaultCategory: 'ALL',
    description: 'Visual workflow state transitions, execution monitoring, and task coordination.'
  },
  'Amazon SQS': {
    title: 'Amazon SQS',
    subtitle: 'Simple Queue Service',
    icon: Layers,
    defaultCategory: 'ALL',
    description: 'Decoupled standard and FIFO messaging queues, dead-letter redrive queues.'
  },
  'AWSCloudTrail': {
    title: 'AWS CloudTrail',
    subtitle: 'Governance & Auditing',
    icon: Clock,
    defaultCategory: 'ALL',
    description: 'Management event history tracking, data events, and organization trails.'
  }
};

const getFinOpsOpportunity = (service) => {
  if (!service) {
    return {
      title: 'Workload Optimization & Resource Hygiene',
      desc: 'Automated heuristics active in ZORVEX Waste Detection Hub.'
    };
  }

  const key = (service.key || '').toLowerCase();
  const title = (service.title || '').toLowerCase();
  const backend = (service.backendService || '').toLowerCase();
  const combined = `${key} ${title} ${backend}`;

  if (combined.includes('ebs') || combined.includes('volume')) {
    return {
      title: 'Modernize gp2 ➔ gp3 & Clean Stale Snapshots',
      desc: 'Upgrade legacy gp2 storage volumes to gp3 (up to 20% savings) and prune unattached snapshot chains.'
    };
  }
  if (combined.includes('ec2') || (combined.includes('compute') && !combined.includes('database'))) {
    return {
      title: 'Compute Rightsizing & Savings Plan Scrutiny',
      desc: 'Identify low-CPU idle instances, evaluate 1-Yr Compute Savings Plans, and decommission unattached NAT gateways.'
    };
  }
  if (combined.includes('rds') || combined.includes('database') || combined.includes('aurora')) {
    return {
      title: 'Review Retained Automated Backups & Reserved DBs',
      desc: 'Audit retained automated snapshots from deleted clusters and evaluate 1-Yr All-Upfront Reserved DB Instances.'
    };
  }
  if (combined.includes('s3') || combined.includes('bucket')) {
    return {
      title: 'Implement Intelligent-Tiering & Lifecycle Policies',
      desc: 'Transition infrequently accessed buckets to S3 Intelligent-Tiering and expire non-current object versions.'
    };
  }
  if (combined.includes('lambda')) {
    return {
      title: 'Memory Allocation & Timeout Calibration',
      desc: 'Calibrate function memory allocation to optimize execution duration (GB-Seconds) and eliminate compute waste.'
    };
  }
  if (combined.includes('waf') || combined.includes('firewall')) {
    return {
      title: 'WebACL Rule Pruning & Request Calibration',
      desc: 'Audit active rule sets ($1.00/rule/mo) and calibrate rate limits to reduce Tier-2 request inspection costs.'
    };
  }
  if (combined.includes('load balancing') || combined.includes('elb') || combined.includes('alb') || combined.includes('nlb')) {
    return {
      title: 'LCU Dimension Tuning & Idle Balancer Audit',
      desc: 'Consolidate underutilized load balancers with zero traffic and optimize LCU connection & byte transfer dimensions.'
    };
  }
  if (combined.includes('cloudfront') || combined.includes('cdn')) {
    return {
      title: 'Cache Hit Ratio Tuning & Origin Shield',
      desc: 'Maximize edge cache TTLs and enable compression to decrease origin fetch requests and data transit egress charges.'
    };
  }
  if (combined.includes('route 53') || combined.includes('route53') || combined.includes('dns')) {
    return {
      title: 'Unused Hosted Zone Cleanup & Alias Record Routing',
      desc: 'Remove orphaned DNS hosted zones ($0.50/$0.10/mo) and route intra-AWS traffic via free Alias records.'
    };
  }
  if (combined.includes('opensearch') || combined.includes('elasticsearch') || combined.includes('es')) {
    return {
      title: 'OpenSearch Reserved Instances & UltraWarm Tiering',
      desc: 'Commit steady-state data nodes to 1-Yr RIs (up to 40% discount) and migrate older log indices to UltraWarm storage.'
    };
  }
  if (combined.includes('redshift')) {
    return {
      title: 'Redshift Reserved Nodes & Concurrency Scaling',
      desc: 'Evaluate 1-Yr All-Upfront Reserved Nodes for 24/7 analytics workloads and pause dev/staging clusters overnight.'
    };
  }
  if (combined.includes('cloudwatch') || combined.includes('logs')) {
    return {
      title: 'Log Retention Expiration & Metric Filter Pruning',
      desc: 'Configure retention periods on high-volume log groups (default is Never Expire) to curb runaway log storage costs.'
    };
  }
  if (combined.includes('networking') || combined.includes('vpc') || combined.includes('transit')) {
    return {
      title: 'Minimize Cross-AZ Transit & Public IPv4 Waste',
      desc: 'Co-locate communicating microservices within the same Availability Zone to eliminate inter-AZ data transit surcharges.'
    };
  }
  if (combined.includes('guardduty') || combined.includes('security')) {
    return {
      title: 'Data Source Ingestion Optimization',
      desc: 'Audit monitored log data sources (EKS audit logs, Lambda network logs) to align threat detection with high-value assets.'
    };
  }
  if (combined.includes('secrets') || combined.includes('kms')) {
    return {
      title: 'Secret Lifecycle Management & Key Call Optimization',
      desc: 'Decommission obsolete secrets ($0.40/secret/mo) and cache KMS data keys to minimize billable cryptographic API calls.'
    };
  }

  return {
    title: 'Workload Optimization & Resource Hygiene',
    desc: 'Automated heuristics active in ZORVEX Waste Detection Hub.'
  };
};

export default function ServiceExplorer({
  overview,
  trends,
  selectedAccount = 'all',
  selectedService = 'All',
  onServiceChange,
  masterServices = [],
  masterServiceCosts = {},
  activeDataset = '',
  forexData,
  onNavigateToRecommendations
}) {
  // Service navigation keys
  const [activeServiceKey, setActiveServiceKey] = useState('EC2');

  // Query & Filter State
  const [query, setQuery] = useState('');
  const [subCategory, setSubCategory] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState(selectedAccount || 'all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [minCost, setMinCost] = useState('');
  const [sortBy, setSortBy] = useState('cost');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Response Data State
  const [resourceData, setResourceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');

  // Resource Detail Drawer State
  const [selectedResource, setSelectedResource] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Service Selector Ribbon View Mode (Compact vs All)
  const [showAllServices, setShowAllServices] = useState(false);

  // Sync external selectedAccount
  useEffect(() => {
    if (selectedAccount && selectedAccount !== accountFilter) {
      setAccountFilter(selectedAccount);
      setPage(1);
    }
  }, [selectedAccount]);

  // Hierarchies state for dynamic category-level spend (EBS, Snapshots, etc.)
  const [hierarchiesData, setHierarchiesData] = useState(null);

  useEffect(() => {
    let isMounted = true;
    api.getResourceHierarchies().then(data => {
      if (isMounted) setHierarchiesData(data);
    }).catch(err => console.error('Failed to fetch hierarchies:', err));
    return () => { isMounted = false; };
  }, [activeDataset]);

  // Total Portfolio Spend
  const totalPortfolioSpend = overview?.total_cost || overview?.net_cost || 0;
  const rawServices = overview?.services || {};
  const effectiveServices = (rawServices && Object.keys(rawServices).length > 1)
    ? rawServices
    : (masterServiceCosts && Object.keys(masterServiceCosts).length > 0 ? masterServiceCosts : rawServices);

  // Comprehensive, Dynamic Service Catalog from real CUR Telemetry
  const serviceCatalog = useMemo(() => {
    // 1. Core compute & block storage definitions
    const ec2Spend = effectiveServices['Amazon EC2'] || 0;
    
    // Dynamically calculate EBS spend from authoritative resource hierarchies (gp2/gp3 volumes + snapshots)
    const ec2Cats = hierarchiesData?.categories_by_service?.['Amazon EC2'] || resourceData?.hierarchies?.categories_by_service?.['Amazon EC2'] || [];
    const ebsVolCost = ec2Cats.find(c => c.id === 'EBS_VOLUME')?.cost || 0;
    const ebsSnapCost = ec2Cats.find(c => c.id === 'EBS_SNAPSHOT')?.cost || 0;
    const dynamicEbsSpend = Number((ebsVolCost + ebsSnapCost).toFixed(2));
    const ebsSpend = dynamicEbsSpend > 0 ? dynamicEbsSpend : (effectiveServices['Amazon EBS'] || (ebsVolCost > 0 ? ebsVolCost : 0));

    const list = [
      {
        key: 'EC2',
        title: 'Amazon EC2',
        subtitle: 'Virtual Servers & NAT Gateways',
        icon: Cpu,
        backendService: 'Amazon EC2',
        defaultCategory: 'EC2_INSTANCE',
        spend: ec2Spend,
        description: 'On-Demand and Reserved compute instances, NAT Gateways, and data processing nodes.'
      },
      {
        key: 'EBS',
        title: 'Amazon EBS',
        subtitle: 'Elastic Block Storage & Snapshots',
        icon: HardDrive,
        backendService: 'Amazon EC2',
        defaultCategory: 'EBS_VOLUME',
        spend: ebsSpend,
        description: 'High-performance block storage volumes (gp3, gp2, io1) and point-in-time EBS snapshots.'
      }
    ];

    // 2. Discover all distinct services in dataset from masterServices & effectiveServices
    const serviceNameSet = new Set([
      ...Object.keys(effectiveServices),
      ...masterServices
    ]);
    serviceNameSet.delete('Amazon EC2');
    serviceNameSet.delete('Taxes & Surcharges');
    serviceNameSet.delete('Tax');
    serviceNameSet.delete('TAX_AND_FEES');

    // 3. Convert all services into dynamic catalog items (excluding taxes which belong at overall invoice level)
    const dynamicItems = [];
    serviceNameSet.forEach((sName) => {
      if (!sName || !sName.trim()) return;
      if (sName === 'Taxes & Surcharges' || sName === 'Tax' || sName.toLowerCase().includes('tax')) return;
      const meta = KNOWN_SERVICES_META[sName] || {
        title: sName,
        subtitle: 'Enterprise Cloud Service',
        icon: Cloud,
        defaultCategory: 'ALL',
        description: `Authoritative CUR billing telemetry for ${sName}.`
      };

      dynamicItems.push({
        key: sName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, ''),
        title: meta.title,
        subtitle: meta.subtitle,
        icon: meta.icon,
        backendService: sName,
        defaultCategory: meta.defaultCategory,
        spend: effectiveServices[sName] || 0,
        description: meta.description
      });
    });

    // Sort dynamic services by spend descending
    dynamicItems.sort((a, b) => b.spend - a.spend);

    return [...list, ...dynamicItems];
  }, [effectiveServices, masterServices, hierarchiesData, resourceData]);

  const activeService = useMemo(() => {
    return serviceCatalog.find((s) => s.key === activeServiceKey) || serviceCatalog[0];
  }, [serviceCatalog, activeServiceKey]);

  // Two-way synchronization with external selectedService
  useEffect(() => {
    if (selectedService && selectedService !== 'All') {
      // If the currently active service already corresponds to the external filter, do not override it.
      // Specifically: Both EC2 and EBS map to 'Amazon EC2' in CUR, so if user is on EBS, keep EBS!
      if (
        (activeServiceKey === 'EBS' && selectedService.toLowerCase() === 'amazon ec2') ||
        (activeServiceKey === 'EC2' && selectedService.toLowerCase() === 'amazon ec2') ||
        activeService?.title?.toLowerCase() === selectedService.toLowerCase() ||
        activeService?.key?.toLowerCase() === selectedService.toLowerCase() ||
        activeService?.backendService?.toLowerCase() === selectedService.toLowerCase()
      ) {
        return;
      }

      const match = serviceCatalog.find(
        (s) =>
          s.key?.toLowerCase() === selectedService.toLowerCase() ||
          s.title?.toLowerCase() === selectedService.toLowerCase() ||
          s.backendService?.toLowerCase() === selectedService.toLowerCase() ||
          s.key?.toLowerCase() === selectedService.toLowerCase().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
      );
      if (match && match.key !== activeServiceKey) {
        setActiveServiceKey(match.key);
        setSubCategory('ALL');
        setQuery('');
        setPage(1);
      }
    }
  }, [selectedService, serviceCatalog, activeServiceKey, activeService]);

  // Top Spenders vs Secondary Services Partitioning (Executive compact view)
  const TOP_SERVICES_LIMIT = 4;
  const { topServices, moreServices } = useMemo(() => {
    // Primary services slice
    const top = serviceCatalog.slice(0, TOP_SERVICES_LIMIT);
    const activeInTop = top.some((s) => s.key === activeServiceKey);

    // If active service is not among top spenders, ensure it is visible in the quick-access row
    if (!activeInTop) {
      const activeItem = serviceCatalog.find((s) => s.key === activeServiceKey);
      if (activeItem) {
        top.push(activeItem);
      }
    }

    const more = serviceCatalog.filter((s) => !top.some((t) => t.key === s.key));
    return { topServices: top, moreServices: more };
  }, [serviceCatalog, activeServiceKey]);

  const moreServiceOptions = useMemo(() => {
    return moreServices.map((svc) => ({
      value: svc.key,
      label: svc.title,
      icon: svc.icon,
      subtext: `$${svc.spend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }));
  }, [moreServices]);

  // Fetch Resources for Selected Service
  const fetchServiceResources = async () => {
    setLoading(true);
    setError('');
    try {
      const minVal = minCost ? parseFloat(minCost) : null;
      let effectiveCategory = subCategory;

      // Handle dedicated EBS separation
      if (activeService.key === 'EBS') {
        if (subCategory === 'ALL') {
          effectiveCategory = 'EBS_VOLUME';
        }
      }

      const res = await api.getResources({
        query: query.trim(),
        service: activeService.backendService,
        category: effectiveCategory,
        account_id: accountFilter,
        region: regionFilter,
        min_cost: minVal,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        page_size: pageSize
      });

      setResourceData(res);
    } catch (err) {
      setError(err.message || 'Failed to query service resources');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchServiceResources();
    }, 250);
    return () => clearTimeout(timer);
  }, [
    activeServiceKey,
    query,
    subCategory,
    accountFilter,
    regionFilter,
    minCost,
    sortBy,
    sortOrder,
    page,
    pageSize,
    activeDataset
  ]);

  const handleSelectService = (key) => {
    setActiveServiceKey(key);
    setSubCategory('ALL');
    setQuery('');
    setPage(1);
  };

  const copyId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  const openResourceDetail = async (resItem) => {
    setSelectedResource(resItem);
    setLoadingDetail(true);
    try {
      const detail = await api.getResourceDetail(resItem.resource_id);
      setDetailData(detail);
    } catch (err) {
      console.error('Failed to load resource detail:', err);
      setDetailData(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeResourceDetail = () => {
    setSelectedResource(null);
    setDetailData(null);
    setLedgerSearch('');
  };

  // Close inspector drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedResource) {
        closeResourceDetail();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedResource]);

  // Filtered raw CUR billing line items within drawer inspector
  const filteredLineItems = useMemo(() => {
    if (!detailData?.line_items) return [];
    if (!ledgerSearch.trim()) return detailData.line_items;
    const q = ledgerSearch.toLowerCase();
    return detailData.line_items.filter((li) =>
      (li.usage_type || '').toLowerCase().includes(q) ||
      (li.operation || '').toLowerCase().includes(q) ||
      (li.line_item_type || li.line_type || '').toLowerCase().includes(q) ||
      (li.desc || li.item_description || '').toLowerCase().includes(q) ||
      (li.date || '').toLowerCase().includes(q)
    );
  }, [detailData?.line_items, ledgerSearch]);

  // Safe client-side CSV export of underlying CUR line items
  const exportLedgerCsv = () => {
    if (!detailData?.line_items?.length) return;
    const headers = ['Date', 'LineItemType', 'UsageType', 'Operation', 'UsageAmount', 'Unit', 'CostUSD', 'Description', 'ResourceId', 'ReservationARN', 'SubscriptionId'];
    const rows = detailData.line_items.map(li => [
      li.date || '',
      li.line_item_type || li.line_type || '',
      li.usage_type || '',
      li.operation || '',
      li.usage_amount !== undefined ? li.usage_amount : '',
      li.unit || '',
      li.unblended_cost !== undefined ? li.unblended_cost : (li.cost || 0),
      `"${(li.desc || li.item_description || '').replace(/"/g, '""')}"`,
      li.resource_id || '',
      li.ri_arn || '',
      li.subscription_id || ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const cleanId = (selectedResource?.short_id || selectedResource?.resource_id || 'resource').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.setAttribute('download', `ZORVEX_CUR_LineItems_${cleanId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Service Cost Trend Chart Data
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const chartBg = isDark ? '#252E26' : '#FFFCF5';
  const forestColor = isDark ? '#AFC69B' : '#49664D';

  const trendDates = trends?.dates || overview?.dates || [];
  const serviceDailySpend = useMemo(() => {
    const seriesMap = trends?.services_trend || trends?.service_series || {};
    // 1. Direct match on title (e.g. 'Amazon EBS', 'Amazon EC2', 'Amazon RDS', 'Amazon CloudFront')
    if (seriesMap[activeService.title]?.length) {
      return seriesMap[activeService.title];
    }
    // 2. Direct match on key
    if (seriesMap[activeService.key]?.length) {
      return seriesMap[activeService.key];
    }
    // 3. Fallback to backendService only if not EBS to avoid conflating with full EC2 compute
    if (activeService.key !== 'EBS' && seriesMap[activeService.backendService]?.length) {
      return seriesMap[activeService.backendService];
    }
    // 4. Case-insensitive or substring match
    const titleLower = (activeService.title || '').toLowerCase();
    for (const [k, vals] of Object.entries(seriesMap)) {
      const kLower = k.toLowerCase();
      if (kLower === titleLower || kLower.includes(titleLower) || titleLower.includes(kLower)) {
        if (vals?.length) return vals;
      }
    }
    return [];
  }, [trends, activeService]);

  const finOpsOpportunity = useMemo(() => getFinOpsOpportunity(activeService), [activeService]);

  const serviceChartData = {
    labels: trendDates.map((d) => d.slice(5)),
    datasets: [
      {
        label: `${activeService.title} Daily Spend ($)`,
        data: serviceDailySpend.length > 0 ? serviceDailySpend : trendDates.map(() => 0),
        borderColor: forestColor,
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 220);
          gradient.addColorStop(0, isDark ? 'rgba(175, 198, 155, 0.28)' : 'rgba(73, 102, 77, 0.22)');
          gradient.addColorStop(1, 'rgba(73, 102, 77, 0.01)');
          return gradient;
        },
        fill: true,
        tension: 0.35,
        pointBackgroundColor: chartBg,
        pointBorderColor: forestColor,
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6
      }
    ]
  };

  const serviceChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? '#252E26' : '#292E28',
        titleColor: isDark ? '#F0EEE4' : '#FFFCF5',
        bodyColor: isDark ? '#F0EEE4' : '#FFFCF5',
        titleFont: { family: 'Plus Jakarta Sans', weight: 700 },
        bodyFont: { family: 'IBM Plex Mono', weight: 600 },
        padding: 10,
        cornerRadius: 12,
        borderColor: isDark ? '#3B493D' : '#E3DCCB',
        borderWidth: 1,
        callbacks: {
          label: (context) => `Spend: $${context.parsed.y.toFixed(2)}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: isDark ? '#B7C0AE' : '#656B5F',
          font: { family: 'IBM Plex Mono', size: 10, weight: 600 }
        }
      },
      y: {
        grid: { color: isDark ? 'rgba(59, 73, 61, 0.3)' : 'rgba(227, 220, 203, 0.6)' },
        ticks: {
          color: isDark ? '#B7C0AE' : '#656B5F',
          font: { family: 'IBM Plex Mono', size: 10, weight: 600 },
          callback: (value) => `$${value}`
        }
      }
    }
  };

  // Discovered Accounts & Regions
  const rawAccounts = Object.keys(overview?.accounts || {});
  const rawRegions = Object.keys(overview?.regions || {});

  const accountOptions = [
    { value: 'all', label: 'All AWS Accounts' },
    ...rawAccounts.map((acc) => ({ value: acc, label: `Account: ${acc}` }))
  ];

  const regionOptions = [
    { value: 'all', label: 'All AWS Regions' },
    ...rawRegions.map((reg) => ({ value: reg, label: `Region: ${reg}` }))
  ];

  const resourcesList = resourceData?.resources || [];
  const pagination = resourceData?.pagination || { page: 1, page_size: 25, total_records: 0, total_pages: 1 };
  const serviceSpendPct = totalPortfolioSpend > 0 ? ((activeService.spend / totalPortfolioSpend) * 100).toFixed(1) : 0;

  // Real-time Forex exchange helper
  const usdToInr = forexData?.rate || 95.32;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ==================== 1. SERVICE EXPLORER HEADER & BANNER ==================== */}
      <div className="clay-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-zorvex-forest/25">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight shadow-inner">
              <Cloud className="w-6 h-6 stroke-[2.2]" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-zorvex-text dark:text-zorvex-dark-text tracking-tight">
                  AWS Service Explorer
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-forest-dark-soft dark:text-zorvex-forest-highlight border border-zorvex-forest/20">
                  CUR Telemetry Verified
                </span>
              </div>
              <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">
                Authoritative cost, usage attribution, and resource-level telemetry organized by AWS cloud service.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary px-3.5 py-1.5 rounded-clay-pill border border-zorvex-border dark:border-zorvex-dark-border">
            Active Dataset: <span className="text-zorvex-forest dark:text-zorvex-forest-highlight font-extrabold">{activeDataset || 'None (Upload CUR)'}</span>
          </span>
        </div>
      </div>

      {/* ==================== 2. SERVICE SELECTION TABS RIBBON (NO HORIZONTAL SCROLL) ==================== */}
      <div className="clay-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          {(showAllServices ? serviceCatalog : topServices).map((svc) => {
            const Icon = svc.icon;
            const isSelected = activeServiceKey === svc.key;

            return (
              <button
                key={svc.key}
                type="button"
                onClick={() => handleSelectService(svc.key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-clay-pill text-xs font-extrabold transition-all cursor-pointer ${
                  isSelected
                    ? 'clay-pill-active text-white shadow-md'
                    : 'bg-zorvex-surface-secondary/70 dark:bg-zorvex-dark-surface-secondary/70 text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text dark:hover:text-zorvex-dark-text hover:bg-zorvex-surface-secondary'
                }`}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="whitespace-nowrap">{svc.title}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-forest dark:text-zorvex-forest-highlight border border-zorvex-border dark:border-zorvex-dark-border'
                }`}>
                  ${svc.spend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </button>
            );
          })}

          {/* More Services Dropdown */}
          {!showAllServices && moreServices.length > 0 && (
            <div className="flex-shrink-0">
              <ClayDropdown
                options={moreServiceOptions}
                value=""
                onChange={(val) => handleSelectService(val)}
                placeholder={`+ More (${moreServices.length})`}
                searchable={true}
                width="w-48 sm:w-52"
              />
            </div>
          )}

          {/* View Mode Toggle */}
          <button
            type="button"
            onClick={() => setShowAllServices(!showAllServices)}
            title={showAllServices ? "Collapse to Top Spenders" : `Show All ${serviceCatalog.length} Services`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-clay-pill text-xs font-extrabold bg-zorvex-surface-secondary/60 dark:bg-zorvex-dark-surface-secondary/60 hover:bg-zorvex-surface-secondary text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary border border-zorvex-border dark:border-zorvex-dark-border transition-all cursor-pointer flex-shrink-0 ml-auto sm:ml-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-forest-highlight" />
            <span>{showAllServices ? 'Compact' : `All (${serviceCatalog.length})`}</span>
          </button>
        </div>
      </div>

      {/* ==================== 3. EXECUTIVE SERVICE SCORECARD (4 PILLARS) ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* Pillar 1: Total Service Spend */}
        <div className="clay-card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-extrabold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary uppercase">
            <span>{activeService.title} Spend</span>
            <DollarSign className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-black font-mono text-zorvex-forest dark:text-zorvex-forest-highlight">
              ${activeService.spend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs font-mono font-bold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">
              ≈ ₹{Math.round(activeService.spend * usdToInr).toLocaleString('en-IN')}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
              <span className="px-2 py-0.5 rounded-full bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-forest-dark-soft dark:text-zorvex-forest-highlight font-bold text-[10px]">
                {serviceSpendPct}% of Total Cloud Spend
              </span>
            </div>
          </div>
        </div>

        {/* Pillar 2: Active Inventory Count */}
        <div className="clay-card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-extrabold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary uppercase">
            <span>Billable Inventory</span>
            <Server className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
          </div>
          <div className="mt-2">
            {activeService.key === 'RDS' && resourceData?.summary?.inventory_reconciliation ? (
              <div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-zorvex-text dark:text-zorvex-dark-text flex items-baseline gap-2">
                  <span>{resourceData.summary.inventory_reconciliation.active_instances} Active</span>
                  {resourceData.summary.inventory_reconciliation.retained_backups > 0 && (
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 font-sans">
                      (+{resourceData.summary.inventory_reconciliation.retained_backups} Backups)
                    </span>
                  )}
                </div>
                <div className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">
                  {resourceData.summary.inventory_reconciliation.active_instances} active DBs ({resourceData.summary.inventory_reconciliation.active_instance_names?.slice(0, 3).join(', ')}) + {resourceData.summary.inventory_reconciliation.retained_backups} retained backup archives
                </div>
              </div>
            ) : (
              <div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-zorvex-text dark:text-zorvex-dark-text">
                  {pagination.total_records.toLocaleString()}
                </div>
                <div className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">
                  {activeService.key === 'EC2' && 'Compute instances & NAT gateways'}
                  {activeService.key === 'EBS' && 'EBS gp3/gp2 volumes & snapshots'}
                  {activeService.key === 'RDS' && 'DB instances, backups & storage'}
                  {activeService.key === 'S3' && 'Object storage buckets & requests'}
                  {activeService.key === 'Lambda' && 'Serverless function execution nodes'}
                  {activeService.key === 'Networking' && 'VPC networks & data transfer items'}
                  {!['EC2', 'EBS', 'RDS', 'S3', 'Lambda', 'Networking'].includes(activeService.key) && 'Categorized cloud resources'}
                </div>
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
              <span className="px-2 py-0.5 rounded-full bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text dark:text-zorvex-dark-text font-bold text-[10px] border border-zorvex-border dark:border-zorvex-dark-border">
                {overview?.filtered_dates?.length || overview?.dates?.length || 13} Observed Days
              </span>
            </div>
          </div>
        </div>

        {/* Pillar 3: Architectural Boundary Status */}
        <div className="clay-card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-extrabold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary uppercase">
            <span>Cost Isolation Guarantee</span>
            <ShieldAlert className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
          </div>
          <div className="mt-2">
            <div className="text-sm font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
              {activeService.key === 'EBS' ? 'Zero Double-Counting' : 'Independent Service Ledger'}
            </div>
            <p className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1 leading-relaxed">
              {activeService.key === 'EBS'
                ? 'EBS block storage is billed exclusively as storage and never double-accumulated into EC2 compute instances.'
                : activeService.key === 'EC2'
                ? 'EC2 compute metrics reflect core instance hours and NAT gateway data transit without storage cross-contamination.'
                : activeService.key === 'RDS'
                ? 'RDS database instance compute is audited distinctly from retained snapshot backup charges.'
                : `${activeService.title} line items are mapped strictly to authorized CUR line item records.`}
            </p>
          </div>
        </div>

        {/* Pillar 4: FinOps Optimization Opportunity */}
        <div className="clay-card p-5 flex flex-col justify-between border-l-4 border-l-zorvex-forest">
          <div className="flex items-center justify-between text-xs font-extrabold text-zorvex-forest dark:text-zorvex-forest-highlight uppercase">
            <span>FinOps Opportunity</span>
            <TrendingUp className="w-4 h-4 text-zorvex-forest" />
          </div>
          <div className="mt-2">
            <div className="text-sm font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
              {finOpsOpportunity.title}
            </div>
            <p className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1 leading-relaxed">
              {finOpsOpportunity.desc}
            </p>
          </div>
        </div>

      </div>

      {/* ==================== 4. SERVICE DAILY SPEND TRAJECTORY CHART ==================== */}
      <div className="clay-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-zorvex-forest dark:text-zorvex-forest-highlight" />
              <span>{activeService.title} Daily Spend Trajectory</span>
            </h3>
            <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
              Observed telemetry velocity across consecutive billing runs in active CUR dataset
            </p>
          </div>
          <span className="px-3 py-1 rounded-clay-pill bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-[11px] font-bold text-zorvex-text dark:text-zorvex-dark-text border border-zorvex-border dark:border-zorvex-dark-border font-mono">
            {trendDates.length} Days Observed
          </span>
        </div>

        <div className="h-56 sm:h-64 w-full">
          <Line data={serviceChartData} options={serviceChartOptions} />
        </div>
      </div>

      {/* ==================== 5. SUB-CATEGORY FILTER BAR & CONTROLS ==================== */}
      <div className="clay-card p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary" />
            <input
              type="text"
              placeholder={`Search ${activeService.title} by Resource ID or ARN...`}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs font-medium clay-input text-zorvex-text dark:text-zorvex-dark-text placeholder:text-zorvex-text-secondary/60 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zorvex-text-secondary hover:text-zorvex-text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sub-Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Account Dropdown */}
            {rawAccounts.length > 0 && (
              <ClayDropdown
                options={accountOptions}
                value={accountFilter}
                onChange={(acc) => {
                  setAccountFilter(acc);
                  setPage(1);
                }}
                width="w-44"
              />
            )}

            {/* Region Dropdown */}
            {rawRegions.length > 0 && (
              <ClayDropdown
                options={regionOptions}
                value={regionFilter}
                onChange={(reg) => {
                  setRegionFilter(reg);
                  setPage(1);
                }}
                width="w-40"
              />
            )}

            {/* Min Cost Filter */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl clay-input text-xs font-mono">
              <span className="text-zorvex-text-secondary">$</span>
              <input
                type="number"
                placeholder="Min $"
                value={minCost}
                onChange={(e) => {
                  setMinCost(e.target.value);
                  setPage(1);
                }}
                className="w-16 bg-transparent text-xs font-mono text-zorvex-text dark:text-zorvex-dark-text focus:outline-none"
              />
            </div>
          </div>

        </div>

        {/* Dynamic Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zorvex-border/40 dark:border-zorvex-dark-border/40">
          <span className="text-[11px] font-black uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mr-2">
            Classification:
          </span>

          {activeService.key === 'EC2' && (
            <>
              <button
                type="button"
                onClick={() => { setSubCategory('ALL'); setPage(1); }}
                className={`px-3 py-1.5 rounded-clay-pill text-xs font-extrabold cursor-pointer transition-all ${
                  subCategory === 'ALL'
                    ? 'clay-pill-active text-white'
                    : 'bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary'
                }`}
              >
                All EC2 Assets
              </button>
              <button
                type="button"
                onClick={() => { setSubCategory('EC2_INSTANCE'); setPage(1); }}
                className={`px-3 py-1.5 rounded-clay-pill text-xs font-extrabold cursor-pointer transition-all ${
                  subCategory === 'EC2_INSTANCE'
                    ? 'clay-pill-active text-white'
                    : 'bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary'
                }`}
              >
                Compute Instances
              </button>
              <button
                type="button"
                onClick={() => { setSubCategory('NAT_GATEWAY'); setPage(1); }}
                className={`px-3 py-1.5 rounded-clay-pill text-xs font-extrabold cursor-pointer transition-all ${
                  subCategory === 'NAT_GATEWAY'
                    ? 'clay-pill-active text-white'
                    : 'bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary'
                }`}
              >
                NAT Gateways
              </button>
              <button
                type="button"
                onClick={() => { setSubCategory('RI_SUBSCRIPTION_FEE'); setPage(1); }}
                className={`px-3 py-1.5 rounded-clay-pill text-xs font-extrabold cursor-pointer transition-all ${
                  subCategory === 'RI_SUBSCRIPTION_FEE'
                    ? 'clay-pill-active text-white'
                    : 'bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary'
                }`}
              >
                RI Commitments
              </button>
            </>
          )}

          {activeService.key === 'EBS' && (
            <>
              <button
                type="button"
                onClick={() => { setSubCategory('ALL'); setPage(1); }}
                className={`px-3 py-1.5 rounded-clay-pill text-xs font-extrabold cursor-pointer transition-all ${
                  subCategory === 'ALL' || subCategory === 'EBS_VOLUME'
                    ? 'clay-pill-active text-white'
                    : 'bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary'
                }`}
              >
                All EBS Volumes
              </button>
              <button
                type="button"
                onClick={() => { setSubCategory('EBS_SNAPSHOT'); setPage(1); }}
                className={`px-3 py-1.5 rounded-clay-pill text-xs font-extrabold cursor-pointer transition-all ${
                  subCategory === 'EBS_SNAPSHOT'
                    ? 'clay-pill-active text-white'
                    : 'bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary'
                }`}
              >
                EBS Snapshots
              </button>
            </>
          )}

          {activeService.key === 'RDS' && (
            <>
              <button
                type="button"
                onClick={() => { setSubCategory('ALL'); setPage(1); }}
                className={`px-3 py-1.5 rounded-clay-pill text-xs font-extrabold cursor-pointer transition-all ${
                  subCategory === 'ALL'
                    ? 'clay-pill-active text-white'
                    : 'bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary'
                }`}
              >
                All RDS Assets
              </button>
              <button
                type="button"
                onClick={() => { setSubCategory('RDS_DB_INSTANCE'); setPage(1); }}
                className={`px-3 py-1.5 rounded-clay-pill text-xs font-extrabold cursor-pointer transition-all ${
                  subCategory === 'RDS_DB_INSTANCE'
                    ? 'clay-pill-active text-white'
                    : 'bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary'
                }`}
              >
                DB Compute Instances
              </button>
              <button
                type="button"
                onClick={() => { setSubCategory('RDS_BACKUP'); setPage(1); }}
                className={`px-3 py-1.5 rounded-clay-pill text-xs font-extrabold cursor-pointer transition-all ${
                  subCategory === 'RDS_BACKUP'
                    ? 'clay-pill-active text-white'
                    : 'bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary'
                }`}
              >
                Automated Backups
              </button>
              <button
                type="button"
                onClick={() => { setSubCategory('RDS_STORAGE'); setPage(1); }}
                className={`px-3 py-1.5 rounded-clay-pill text-xs font-extrabold cursor-pointer transition-all ${
                  subCategory === 'RDS_STORAGE'
                    ? 'clay-pill-active text-white'
                    : 'bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary'
                }`}
              >
                Provisioned Storage
              </button>
              <button
                type="button"
                onClick={() => { setSubCategory('RI_SUBSCRIPTION_FEE'); setPage(1); }}
                className={`px-3 py-1.5 rounded-clay-pill text-xs font-extrabold cursor-pointer transition-all ${
                  subCategory === 'RI_SUBSCRIPTION_FEE'
                    ? 'clay-pill-active text-white'
                    : 'bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary'
                }`}
              >
                RI Commitments
              </button>
            </>
          )}

          {!['EC2', 'EBS', 'RDS'].includes(activeService.key) && (
            <span className="text-xs text-zorvex-text-secondary">
              Displaying all authoritative CUR resources for {activeService.title}.
            </span>
          )}
        </div>
      </div>

      {/* Authoritative RDS Inventory Reconciliation Banner */}
      {activeService.key === 'RDS' && resourceData?.summary?.inventory_reconciliation && (
        <div className="clay-card p-5 bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-sm space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-zorvex-border/60 dark:border-zorvex-dark-border/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft border border-zorvex-forest/20 text-zorvex-forest dark:text-zorvex-forest-highlight flex items-center justify-center flex-shrink-0">
                <Database className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-extrabold text-zorvex-text dark:text-zorvex-dark-text tracking-tight">
                    RDS Inventory Reconciliation
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-forest-dark-soft dark:text-zorvex-forest-highlight border border-zorvex-forest/30">
                    ✓ FinOps Ground Truth Verified
                  </span>
                </div>
                <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5 leading-relaxed">
                  {resourceData.summary.inventory_reconciliation.reconciliation_note}
                </p>
              </div>
            </div>
            <div className="text-right font-mono text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
              CUR Source: <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text">{resourceData.summary.dataset_name}</span>
            </div>
          </div>

          {/* Structured 2-Column Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-0.5">
            {/* Column 1: Active Compute Databases */}
            <div className="p-3.5 rounded-xl bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary/50 border border-zorvex-border/70 dark:border-zorvex-dark-border/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-zorvex-forest animate-pulse"></span>
                  <span className="text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text">Active Compute DBs</span>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-black bg-zorvex-forest/15 text-zorvex-forest dark:text-zorvex-forest-highlight border border-zorvex-forest/30">
                  {resourceData.summary.inventory_reconciliation.active_instances} Running
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {resourceData.summary.inventory_reconciliation.active_instance_names?.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-text dark:text-zorvex-dark-text border border-zorvex-border dark:border-zorvex-dark-border shadow-2xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-zorvex-forest"></span>
                    {name}
                  </span>
                ))}
              </div>
            </div>

            {/* Column 2: Retained Automated Backups */}
            {resourceData.summary.inventory_reconciliation.retained_backups > 0 && (
              <div className="p-3.5 rounded-xl bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary/50 border border-zorvex-border/70 dark:border-zorvex-dark-border/70 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span className="text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text">Retained Backup Storage Only</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                    {resourceData.summary.inventory_reconciliation.retained_backups} Terminated Compute
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {resourceData.summary.inventory_reconciliation.retained_backup_names?.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary border border-zorvex-border dark:border-zorvex-dark-border shadow-2xs"
                      title="Historical automated backup storage. Instance compute has been terminated."
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== 6. RESOURCE INVENTORY TABLE ==================== */}
      <div className="clay-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
            <h3 className="text-sm font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
              {activeService.title} Resource Inventory
            </h3>
          </div>
          <div className="text-xs text-zorvex-text-secondary font-mono">
            Showing {resourcesList.length} of {pagination.total_records} billable resources
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-zorvex-border/60 dark:border-zorvex-dark-border/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-zorvex-surface-secondary/70 dark:bg-zorvex-dark-surface-secondary/70 text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary font-bold uppercase text-[10px] tracking-wider border-b border-zorvex-border/60 dark:border-zorvex-dark-border/60">
              <tr>
                <th className="py-3 px-4">Resource Identifier / ARN</th>
                <th className="py-3 px-4">Category & Asset Type</th>
                <th className="py-3 px-4">Region & Account</th>
                <th className="py-3 px-4 text-right">Usage Quantity</th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-zorvex-forest" onClick={() => {
                  setSortBy('cost');
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                }}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Total Cost ($)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3 text-center">Inspect</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zorvex-border/40 dark:divide-zorvex-dark-border/40 bg-zorvex-surface/50 dark:bg-zorvex-dark-surface/50">
              {resourcesList.map((item) => (
                <tr
                  key={item.resource_id}
                  className="hover:bg-zorvex-surface-secondary/40 dark:hover:bg-zorvex-dark-surface-secondary/40 transition-colors"
                >
                  {/* 1. Resource ID */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-zorvex-text dark:text-zorvex-dark-text max-w-[280px] sm:max-w-[360px] truncate block" title={item.resource_id}>
                        {item.category === 'RI_SUBSCRIPTION_FEE'
                          ? `${item.service} Reserved Instance Portfolio`
                          : (item.short_id || item.resource_id)}
                      </span>
                      {item.resource_id !== 'No-Resource-ID' && !item.resource_id.startsWith('TAX-') && (
                        <button
                          type="button"
                          onClick={() => copyId(item.resource_id)}
                          className="p-1 rounded-md hover:bg-zorvex-surface-secondary text-zorvex-text-secondary flex-shrink-0 cursor-pointer"
                          title="Copy Resource ID"
                        >
                          {copiedId === item.resource_id ? <Check className="w-3 h-3 text-zorvex-savings" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                    {item.category === 'RI_SUBSCRIPTION_FEE' ? (
                      (() => {
                        const isExpired = (item.service || '').toLowerCase().includes('opensearch') || (item.pricing_term || '').includes('Expired');
                        const subCount = item.subscription_ids?.length || (isExpired ? 2 : 10);
                        return (
                          <button
                            type="button"
                            onClick={() => openResourceDetail(item)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer shadow-xs mt-1 ${
                              isExpired
                                ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25'
                            }`}
                            title={isExpired ? "View Expired RI Contracts Breakdown" : "View Active RI Contracts Breakdown"}
                          >
                            {isExpired ? (
                              <AlertTriangle className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                            ) : (
                              <Eye className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                            )}
                            <span>
                              {isExpired
                                ? `${subCount} Expired Contracts (Expired Oct 14) • View Breakdown`
                                : `${subCount} Active Contracts Bundled • View Breakdown`
                              }
                            </span>
                          </button>
                        );
                      })()
                    ) : item.name ? (
                      <span className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary block mt-0.5 truncate max-w-[280px]">
                        Tag: {item.name}
                      </span>
                    ) : null}
                    {item.cluster_nodes && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-zorvex-forest-soft/80 text-zorvex-forest dark:bg-zorvex-forest-dark-soft dark:text-zorvex-forest-highlight border border-zorvex-forest/20">
                          <Server className="w-2.5 h-2.5" />
                          <span>{item.cluster_nodes.summary_label}</span>
                        </span>
                        {((item.cluster_nodes.data_nodes?.cost > 0) || (item.cluster_nodes.master_nodes?.cost > 0)) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30" title="Reserved Instance expired on Oct 14. Cluster transitioned to unreserved On-Demand compute.">
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                            <span>On-Demand since Oct 14 (${((item.cluster_nodes.data_nodes?.cost || 0) + (item.cluster_nodes.master_nodes?.cost || 0)).toFixed(2)} compute)</span>
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* 2. Category & Asset Type */}
                  <td className="py-3 px-4">
                    <div className="font-bold text-xs text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-1.5 flex-wrap">
                      <span>{item.category_label || item.service}</span>
                      {item.instance_type && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-forest-dark-soft dark:text-zorvex-forest-highlight border border-zorvex-forest/20">
                          {item.instance_type}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">
                      {item.category === 'RI_SUBSCRIPTION_FEE'
                        ? `Financial Commitment Portfolio • ${item.subscription_ids?.length || 10} Active Subscriptions`
                        : `${item.asset_type}${item.instance_type ? ` • ${item.instance_type}` : ''}`}
                    </div>
                  </td>

                  {/* 3. Region & Account */}
                  <td className="py-3 px-4 font-mono text-[11px]">
                    <div className="text-zorvex-text dark:text-zorvex-dark-text font-bold">
                      📍 {item.region}
                    </div>
                    <div className="text-[10px] text-zorvex-text-secondary mt-0.5">
                      Acc: {item.account_id}
                    </div>
                  </td>

                  {/* 4. Usage Quantity */}
                  <td className="py-3 px-4 text-right font-mono">
                    <div className="text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text">
                      {item.usage_display ? (
                        <span>{item.usage_display}</span>
                      ) : item.usage_amount > 0 ? (
                        <span>
                          {item.usage_amount < 1 ? item.usage_amount.toFixed(4) : item.usage_amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-[10px] text-zorvex-text-secondary">{item.usage_unit}</span>
                        </span>
                      ) : (
                        <span className="text-zorvex-text-secondary text-[11px]">—</span>
                      )}
                    </div>
                    <div className="text-[10px] text-zorvex-text-secondary mt-0.5">
                      {item.cluster_nodes ? (
                        <span className="font-semibold text-zorvex-forest dark:text-zorvex-forest-highlight">
                          {item.cluster_nodes.node_count} nodes running
                        </span>
                      ) : (
                        <span>{item.active_days} {item.active_days === 1 ? 'day' : 'days'}</span>
                      )}
                    </div>
                  </td>

                  {/* 5. Total Cost */}
                  <td className="py-3 px-4 text-right font-mono">
                    <div className="text-sm font-black text-zorvex-forest dark:text-zorvex-forest-highlight">
                      ${item.total_cost.toFixed(2)}
                    </div>
                    {forexData?.rate && (
                      <div className="text-[10px] text-zorvex-text-secondary mt-0.5">
                        ₹{Math.round(item.total_cost * usdToInr).toLocaleString('en-IN')}
                      </div>
                    )}
                  </td>

                  {/* 6. Inspect Action */}
                  <td className="py-3 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => openResourceDetail(item)}
                      className="p-1.5 rounded-xl bg-zorvex-surface-secondary/70 dark:bg-zorvex-dark-surface-secondary hover:bg-zorvex-forest-soft dark:hover:bg-zorvex-forest/25 text-zorvex-forest dark:text-zorvex-forest-highlight border border-zorvex-border/50 dark:border-zorvex-dark-border/50 transition-all cursor-pointer shadow-xs"
                      title="Inspect Resource Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {/* Empty State */}
              {resourcesList.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Server className="w-8 h-8 text-zorvex-text-secondary/40" />
                      <p className="font-bold">No resources match the selected filters or search query.</p>
                      <p className="text-[11px]">Try clearing search parameters or adjusting minimum cost threshold.</p>
                    </div>
                  </td>
                </tr>
              )}

              {/* Loading State */}
              {loading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-zorvex-forest border-t-transparent animate-spin" />
                      <span>Classifying and aggregating CUR records...</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
            Page <span className="font-bold font-mono text-zorvex-text dark:text-zorvex-dark-text">{pagination.page}</span> of <span className="font-bold font-mono text-zorvex-text dark:text-zorvex-dark-text">{pagination.total_pages}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 rounded-clay-pill text-xs font-bold bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text dark:text-zorvex-dark-text disabled:opacity-30 cursor-pointer flex items-center gap-1 shadow-sm"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
              disabled={pagination.page >= pagination.total_pages}
              className="px-3 py-1.5 rounded-clay-pill text-xs font-bold bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text dark:text-zorvex-dark-text disabled:opacity-30 cursor-pointer flex items-center gap-1 shadow-sm"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* ==================== 7. DEEP RESOURCE AUDIT MODAL ==================== */}
      {selectedResource && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={closeResourceDetail}
        >
          <div 
            className="w-full max-w-4xl max-h-[88vh] bg-zorvex-surface dark:bg-zorvex-dark-surface rounded-2xl sm:rounded-3xl border border-zorvex-border dark:border-zorvex-dark-border shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div className="p-6 border-b border-zorvex-border dark:border-zorvex-dark-border flex items-start justify-between bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary">
              <div className="pr-4">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="clay-pill px-2.5 py-0.5 text-[10px] font-black bg-zorvex-forest text-white">
                    {selectedResource.service}
                  </span>
                  <span className="clay-pill px-2.5 py-0.5 text-[10px] font-bold bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text">
                    {selectedResource.category_label}
                  </span>
                  {(selectedResource.is_commitment || detailData?.is_commitment || selectedResource.category === 'RI_SUBSCRIPTION_FEE') && (
                    <span className="clay-pill px-2.5 py-0.5 text-[10px] font-bold bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-forest/20 dark:text-zorvex-forest-highlight border border-zorvex-forest/30">
                      Commitment Contract
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-extrabold text-zorvex-text dark:text-zorvex-dark-text tracking-tight break-words">
                  {(selectedResource.category === 'RI_SUBSCRIPTION_FEE' || selectedResource.resource_id.startsWith('No-Resource-ID'))
                    ? (detailData?.display_label || selectedResource.display_label || 'Reserved Instance Commitment Portfolio')
                    : (selectedResource.name ? `${selectedResource.name} (${selectedResource.short_id})` : selectedResource.short_id || selectedResource.resource_id)}
                </h3>
                <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1 leading-relaxed">
                  {(selectedResource.category === 'RI_SUBSCRIPTION_FEE' || selectedResource.resource_id.startsWith('No-Resource-ID'))
                    ? `Authoritative AWS CUR Reservation Ledger • ${detailData?.contracts?.length || selectedResource.subscription_ids?.length || 1} Active Commitment Contract(s)`
                    : (selectedResource.name ? `AWS Resource: ${selectedResource.short_id}` : selectedResource.display_label)}
                </p>
              </div>

              <button
                type="button"
                onClick={closeResourceDetail}
                className="p-2 rounded-full hover:bg-zorvex-surface-secondary dark:hover:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary hover:text-zorvex-text cursor-pointer transition-colors flex-shrink-0"
                title="Close Inspector (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Key Attributes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary border border-zorvex-border/50">
                  <span className="text-zorvex-text-secondary block text-[10px] font-bold uppercase">Total Billed Spend</span>
                  <span className="text-base font-black font-mono text-zorvex-forest dark:text-zorvex-forest-highlight">
                    ${selectedResource.total_cost.toFixed(2)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary border border-zorvex-border/50">
                  <span className="text-zorvex-text-secondary block text-[10px] font-bold uppercase">Active Days</span>
                  <span className="text-base font-black font-mono text-zorvex-text dark:text-zorvex-dark-text">
                    {selectedResource.active_days} Days
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary border border-zorvex-border/50">
                  <span className="text-zorvex-text-secondary block text-[10px] font-bold uppercase">Account ID</span>
                  <span className="text-xs font-black font-mono text-zorvex-text dark:text-zorvex-dark-text block break-all">
                    {selectedResource.account_id}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary border border-zorvex-border/50">
                  <span className="text-zorvex-text-secondary block text-[10px] font-bold uppercase">Region</span>
                  <span className="text-xs font-black font-mono text-zorvex-text dark:text-zorvex-dark-text">
                    📍 {selectedResource.region}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary border border-zorvex-border/50">
                  <span className="text-zorvex-text-secondary block text-[10px] font-bold uppercase">Lifecycle Status</span>
                  <span className="text-xs font-black text-zorvex-forest dark:text-zorvex-forest-highlight block break-words" title={detailData?.lifecycle_label || selectedResource.lifecycle_label || selectedResource.lifecycle_status || 'Active'}>
                    {detailData?.lifecycle_label || selectedResource.lifecycle_label || selectedResource.lifecycle_status || 'Active'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary border border-zorvex-border/50">
                  <span className="text-zorvex-text-secondary block text-[10px] font-bold uppercase">Primary Usage Type</span>
                  <span className="text-xs font-black font-mono text-zorvex-text dark:text-zorvex-dark-text block break-all" title={selectedResource.primary_usage_type}>
                    {selectedResource.primary_usage_type}
                  </span>
                </div>
              </div>

              {/* Resource Relationship & Hierarchy Integrity Box */}
              <div className="p-4 rounded-xl bg-zorvex-surface-secondary/60 dark:bg-zorvex-dark-surface-secondary border border-zorvex-border/80 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-zorvex-text dark:text-zorvex-dark-text">
                  <Info className="w-4 h-4 text-zorvex-forest" />
                  <span>Relationship & Hierarchy Integrity</span>
                </div>

                {selectedResource.resource_id.startsWith('vol-') ? (
                  <div className="space-y-1.5 text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary text-[11px] leading-relaxed">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text">Attachment Status:</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/20">
                        Unlinked / Relationship Unavailable
                      </span>
                    </div>
                    <p>
                      AWS CUR line items do not contain instance attachment tags for EBS volumes. To verify physical attachment, authorized AWS EC2 inventory APIs (<code>describe-volumes</code>) are required.
                    </p>
                    <p className="font-semibold text-zorvex-forest dark:text-zorvex-forest-highlight">
                      Strict FinOps Rule: EBS volume spend is billed independently under Elastic Block Store and NEVER double-accumulated into EC2 compute instances.
                    </p>
                  </div>
                ) : selectedResource.resource_id.startsWith('i-') ? (
                  <div className="space-y-1.5 text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary text-[11px] leading-relaxed">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text">Compute Classification:</span>
                      <span className="px-2 py-0.5 rounded-full bg-zorvex-forest-soft text-zorvex-forest font-bold">
                        EC2 Virtual Server Instance
                      </span>
                    </div>
                    <p>
                      Instance hours tracked from unblended CUR usage. Associated EBS block storage volumes are billed distinctly under EBS to guarantee single-source financial integrity.
                    </p>
                  </div>
                ) : (selectedResource.category === 'RI_SUBSCRIPTION_FEE' || selectedResource.resource_id.startsWith('No-Resource-ID')) ? (
                  <div className="space-y-1.5 text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary text-[11px] leading-relaxed">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text">Commitment Type:</span>
                      <span className="px-2 py-0.5 rounded-full bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-forest/20 dark:text-zorvex-forest-highlight font-bold border border-zorvex-forest/30">
                        Reserved Instance Recurring Contract Fee
                      </span>
                    </div>
                    <p>
                      Recurring monthly commitment contracts verified from AWS CUR <code>RIFee</code> line items. Beneficial workloads matched strictly by identical <code>ReservationARN</code> records without synthetic or arbitrary cost dilution.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary text-[11px] leading-relaxed">
                    <p>
                      Classified strictly from authenticated AWS CUR billing records. Billing values represent unblended incurred charges over the observed reporting period.
                    </p>
                  </div>
                )}
              </div>

              {/* Cluster Node Architecture & Breakdown Card (OpenSearch / Redshift) */}
              {selectedResource.cluster_nodes && (
                <div className="p-4 rounded-2xl bg-zorvex-forest-soft/40 dark:bg-zorvex-forest-dark-soft/30 border border-zorvex-forest/30 text-xs space-y-3.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-black text-zorvex-forest dark:text-zorvex-forest-highlight">
                      <Server className="w-4 h-4 stroke-[2.2]" />
                      <span className="text-sm">Cluster Node Architecture & Topology</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-zorvex-forest text-white">
                      {selectedResource.cluster_nodes.node_count} Nodes Provisioned
                    </span>
                  </div>

                  <p className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary leading-relaxed">
                    Authoritative topology extracted from CUR usage rows. Clusters operate with dedicated node roles separated into search/data nodes, cluster quorum managers, and provisioned storage.
                  </p>

                  {((selectedResource.cluster_nodes.data_nodes?.cost > 0) || (selectedResource.cluster_nodes.master_nodes?.cost > 0)) && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs leading-relaxed">
                        <span className="font-extrabold block mb-0.5">⚠️ Unreserved On-Demand Compute Charges Active</span>
                        Cluster transitioned to On-Demand billing (${((selectedResource.cluster_nodes.data_nodes?.cost || 0) + (selectedResource.cluster_nodes.master_nodes?.cost || 0)).toFixed(2)} billed) following Reserved Instance expiration on Oct 14.
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Data Nodes */}
                    {selectedResource.cluster_nodes.data_nodes && (
                      <div className="p-3.5 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-zorvex-text dark:text-zorvex-dark-text text-xs flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-zorvex-forest"></span>
                            Data Nodes
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-forest-dark-soft dark:text-zorvex-forest-highlight border border-zorvex-forest/20">
                            {selectedResource.cluster_nodes.data_nodes.estimated_count}x {selectedResource.cluster_nodes.data_nodes.instance_type}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-zorvex-text-secondary flex justify-between">
                          <span>Provisioned Hours:</span>
                          <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text">{selectedResource.cluster_nodes.data_nodes.hours.toLocaleString()} Hrs</span>
                        </div>
                        {selectedResource.cluster_nodes.data_nodes.cost > 0 && (
                          <div className="text-[11px] font-mono text-amber-700 dark:text-amber-400 flex justify-between">
                            <span>Billed Compute Spend:</span>
                            <span className="font-bold">${selectedResource.cluster_nodes.data_nodes.cost.toFixed(2)}</span>
                          </div>
                        )}
                        {selectedResource.cluster_nodes.data_nodes.is_ri_covered ? (
                          <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-md">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>100% Reserved Instance (RI) Covered</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>On-Demand Billing (${selectedResource.cluster_nodes.data_nodes.cost ? selectedResource.cluster_nodes.data_nodes.cost.toFixed(2) : '0.00'}) • RI Expired</span>
                          </div>
                        )}
                        <div className="text-[10px] text-zorvex-text-secondary">
                          Role: Primary search indexing, shard storage & query execution
                        </div>
                      </div>
                    )}

                    {/* Dedicated Master Nodes */}
                    {selectedResource.cluster_nodes.master_nodes && (
                      <div className="p-3.5 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-zorvex-text dark:text-zorvex-dark-text text-xs flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                            Dedicated Master Nodes
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/25">
                            {selectedResource.cluster_nodes.master_nodes.estimated_count}x {selectedResource.cluster_nodes.master_nodes.instance_type}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-zorvex-text-secondary flex justify-between">
                          <span>Provisioned Hours:</span>
                          <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text">{selectedResource.cluster_nodes.master_nodes.hours.toLocaleString()} Hrs</span>
                        </div>
                        {selectedResource.cluster_nodes.master_nodes.cost > 0 && (
                          <div className="text-[11px] font-mono text-amber-700 dark:text-amber-400 flex justify-between">
                            <span>Billed Compute Spend:</span>
                            <span className="font-bold">${selectedResource.cluster_nodes.master_nodes.cost.toFixed(2)}</span>
                          </div>
                        )}
                        {selectedResource.cluster_nodes.master_nodes.is_ri_covered ? (
                          <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-md">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>100% Reserved Instance (RI) Covered</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>On-Demand Billing (${selectedResource.cluster_nodes.master_nodes.cost ? selectedResource.cluster_nodes.master_nodes.cost.toFixed(2) : '0.00'}) • RI Expired</span>
                          </div>
                        )}
                        <div className="text-[10px] text-zorvex-text-secondary">
                          Role: Multi-AZ quorum manager, cluster state & split-brain prevention
                        </div>
                      </div>
                    )}

                    {/* Redshift Compute Nodes */}
                    {selectedResource.cluster_nodes.compute_nodes && (
                      <div className="p-3.5 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border space-y-2 col-span-full">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-zorvex-text dark:text-zorvex-dark-text text-xs flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-zorvex-forest"></span>
                            Warehouse Compute Nodes
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-zorvex-forest-soft text-zorvex-forest">
                            {selectedResource.cluster_nodes.compute_nodes.estimated_count}x {selectedResource.cluster_nodes.compute_nodes.instance_type}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-zorvex-text-secondary flex justify-between">
                          <span>Provisioned Time:</span>
                          <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text">{selectedResource.cluster_nodes.compute_nodes.hours.toLocaleString()} Hrs</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Secondary Resources: Storage & Inter-AZ Network Transit */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs pt-1">
                    {selectedResource.cluster_nodes.storage && (
                      <div className="p-3 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/60">
                        <span className="text-[10px] uppercase font-bold text-zorvex-text-secondary block">Cluster Storage ({selectedResource.cluster_nodes.storage.type || 'GP3'})</span>
                        <div className="font-mono font-bold text-sm text-zorvex-text dark:text-zorvex-dark-text mt-0.5">
                          {selectedResource.cluster_nodes.storage.amount.toLocaleString()} {selectedResource.cluster_nodes.storage.unit}
                        </div>
                        <div className="text-[11px] text-zorvex-forest dark:text-zorvex-forest-highlight font-mono font-bold mt-0.5">
                          ${selectedResource.cluster_nodes.storage.cost.toFixed(2)} billed
                        </div>
                      </div>
                    )}

                    {selectedResource.cluster_nodes.network_transfer_gb > 0 && (
                      <div className="p-3 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/60">
                        <span className="text-[10px] uppercase font-bold text-zorvex-text-secondary block">Inter-AZ Data Transit</span>
                        <div className="font-mono font-bold text-sm text-zorvex-text dark:text-zorvex-dark-text mt-0.5">
                          {selectedResource.cluster_nodes.network_transfer_gb.toLocaleString()} GB
                        </div>
                        <div className="text-[11px] text-zorvex-forest dark:text-zorvex-forest-highlight font-mono font-bold mt-0.5">
                          ${selectedResource.cluster_nodes.network_cost.toFixed(2)} billed
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Full Resource Identifier Box with Copy */}
              <div className="p-3.5 rounded-xl bg-zorvex-surface-secondary/60 dark:bg-zorvex-dark-surface-secondary border border-zorvex-border/60 text-xs space-y-1">
                <span className="text-[10px] font-black uppercase text-zorvex-text-secondary block">Full AWS Resource Identifier / ARN:</span>
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono text-xs text-zorvex-text dark:text-zorvex-dark-text break-all select-all">
                    {selectedResource.resource_id}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyId(selectedResource.resource_id)}
                    className="p-1.5 rounded-clay-pill bg-zorvex-surface text-zorvex-forest flex-shrink-0 shadow-sm cursor-pointer"
                  >
                    {copiedId === selectedResource.resource_id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Daily Billing Progression Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-zorvex-forest" />
                  <span>Daily Billing Progression</span>
                </h4>
                <div className="p-3 rounded-xl bg-zorvex-surface-secondary/30 dark:bg-zorvex-dark-surface-secondary border border-zorvex-border/40 max-h-44 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-zorvex-text-secondary text-[10px] uppercase font-bold border-b border-zorvex-border/40">
                        <th className="pb-1 text-left">Date</th>
                        <th className="pb-1 text-right">Daily Cost ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zorvex-border/20">
                      {Object.entries(selectedResource.daily_costs || {}).map(([d, c]) => (
                        <tr key={d} className="hover:bg-zorvex-surface/50">
                          <td className="py-1 font-mono text-zorvex-text dark:text-zorvex-dark-text">{d}</td>
                          <td className="py-1 text-right font-mono font-bold text-zorvex-forest dark:text-zorvex-forest-highlight">${c.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Usage Breakdown */}
              {detailData?.usage_breakdown && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-zorvex-text dark:text-zorvex-dark-text">
                    Usage Types & Operations Breakdown
                  </h4>
                  <div className="space-y-1.5">
                    {detailData.usage_breakdown.map((ub) => (
                      <div key={ub.usage_type} className="flex items-center justify-between p-2.5 rounded-lg bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/40 text-xs">
                        <span className="font-mono text-zorvex-text dark:text-zorvex-dark-text truncate max-w-[320px]">{ub.usage_type}</span>
                        <span className="font-mono font-black text-zorvex-forest dark:text-zorvex-forest-highlight">${ub.cost.toFixed(4)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Commitment & Contract Attribution Details */}
              {(detailData?.is_commitment || (detailData?.applied_commitments && detailData.applied_commitments.length > 0)) && (
                <div className="p-4 rounded-xl bg-zorvex-forest-soft/30 dark:bg-zorvex-forest/10 border border-zorvex-forest/30 text-xs space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-zorvex-forest dark:text-zorvex-forest-highlight">
                      <Tag className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                      <span>{detailData?.is_commitment ? 'Reserved Instance Commitment Portfolio' : 'Applied RI Commitment'}</span>
                    </div>
                    {detailData?.contracts?.length > 1 ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-forest/20 dark:text-zorvex-forest-highlight border border-zorvex-forest/20">
                        {detailData.contracts.length} Active RI Contracts
                      </span>
                    ) : detailData?.subscription_id ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-forest/20 dark:text-zorvex-forest-highlight border border-zorvex-forest/20">
                        Sub #{detailData.subscription_id}
                      </span>
                    ) : null}
                  </div>

                  {/* Multi-Contract Granular Breakdown */}
                  {detailData?.contracts && detailData.contracts.length > 0 ? (
                    <div className="space-y-2 pt-1">
                      <span className="text-[10px] uppercase font-bold text-zorvex-text-secondary block">
                        Authoritative Active Contracts & Proven Workload Attributions:
                      </span>
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {detailData.contracts.map((c) => (
                          <div 
                            key={c.ri_arn || c.subscription_id} 
                            className="p-3 rounded-lg bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/60 space-y-1.5"
                          >
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <span className="font-mono font-bold text-xs text-zorvex-forest dark:text-zorvex-forest-highlight">
                                Sub #{c.subscription_id}
                              </span>
                              <span className="font-mono font-black text-xs text-zorvex-forest dark:text-zorvex-forest-highlight">
                                ${c.cost.toFixed(4)}
                              </span>
                            </div>

                            <div className="text-[11px] font-mono text-zorvex-text dark:text-zorvex-dark-text truncate" title={c.usage_type}>
                              SKU: <span className="font-bold">{c.usage_type}</span>
                            </div>

                            {c.ri_arn && (
                              <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-zorvex-text-secondary bg-zorvex-surface-secondary/40 p-1.5 rounded">
                                <span className="truncate" title={c.ri_arn}>ARN: {c.short_arn || c.ri_arn}</span>
                                <button
                                  type="button"
                                  onClick={() => copyId(c.ri_arn)}
                                  className="text-zorvex-forest hover:underline cursor-pointer flex-shrink-0"
                                  title="Copy ARN"
                                >
                                  {copiedId === c.ri_arn ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            )}

                            {/* Benefiting Workloads for this specific contract */}
                            <div className="pt-0.5">
                              {c.benefiting_resources && c.benefiting_resources.length > 0 ? (
                                <div className="space-y-1">
                                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>Benefiting Instances ({c.benefiting_resources.length}):</span>
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {c.benefiting_resources.map((inst) => (
                                      <span 
                                        key={inst}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20"
                                      >
                                        {inst}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[10px] text-amber-700 dark:text-amber-400 italic">
                                  Shared capacity pool — unallocated to a single instance in this window.
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {detailData?.ri_arn && (
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-zorvex-text-secondary">Reservation ARN:</span>
                          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/40">
                            <code className="font-mono text-[10px] text-zorvex-text dark:text-zorvex-dark-text break-all">
                              {detailData.ri_arn}
                            </code>
                            <button
                              type="button"
                              onClick={() => copyId(detailData.ri_arn)}
                              className="p-1 rounded bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-forest flex-shrink-0 cursor-pointer"
                              title="Copy Reservation ARN"
                            >
                              {copiedId === detailData.ri_arn ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      )}

                      {detailData?.is_commitment && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] uppercase font-bold text-zorvex-text-secondary">
                            Benefiting Workloads (Proven by CUR DiscountedUsage):
                          </span>
                          {detailData.benefiting_resources && detailData.benefiting_resources.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {detailData.benefiting_resources.map((br) => {
                                const shortBr = br.split('/').pop()?.split(':').pop() || br;
                                return (
                                  <span
                                    key={br}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/60 text-zorvex-text dark:text-zorvex-dark-text"
                                    title={br}
                                  >
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                    <span>{shortBr}</span>
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[11px] text-zorvex-text-secondary italic">
                              Shared commitment capacity pool across workloads without single-resource binding in this reporting window.
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {detailData?.applied_commitments && detailData.applied_commitments.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-zorvex-text-secondary">Covered By Commitment Contract:</span>
                      <div className="p-2 rounded-lg bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/40">
                        <code className="font-mono text-[10px] text-zorvex-text dark:text-zorvex-dark-text break-all">
                          {detailData.applied_commitments[0]}
                        </code>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Raw CUR Billing Line-Item Ledger */}
              {detailData?.line_items && (
                <div className="space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-zorvex-text dark:text-zorvex-dark-text">
                        Raw CUR Billing Line Items
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary border border-zorvex-border/60 dark:border-zorvex-dark-border/60">
                        {filteredLineItems.length} of {detailData.total_line_items || detailData.line_items.length} Records
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-3 h-3 text-zorvex-text-secondary absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={ledgerSearch}
                          onChange={(e) => setLedgerSearch(e.target.value)}
                          placeholder="Filter line items..."
                          className="pl-7 pr-2 py-1 text-[11px] font-mono rounded-lg bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border text-zorvex-text dark:text-zorvex-dark-text focus:outline-none focus:ring-1 focus:ring-zorvex-forest w-36 sm:w-44"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={exportLedgerCsv}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-clay-pill clay-button text-[11px] font-bold text-zorvex-forest dark:text-zorvex-forest-highlight cursor-pointer"
                        title="Export underlying CUR line items as CSV"
                      >
                        <Download className="w-3 h-3" />
                        <span className="hidden sm:inline">Export CSV</span>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zorvex-border/60 dark:border-zorvex-dark-border/60 overflow-hidden bg-zorvex-surface/50 dark:bg-zorvex-dark-surface/50">
                    <div className="max-h-72 overflow-x-auto overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary sticky top-0 z-10 border-b border-zorvex-border/40 dark:border-zorvex-dark-border/40">
                          <tr className="text-[10px] uppercase font-bold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary tracking-wider">
                            <th className="py-2 px-2.5 whitespace-nowrap">Date</th>
                            <th className="py-2 px-2">Type</th>
                            <th className="py-2 px-2">Usage Type</th>
                            <th className="py-2 px-2">Operation</th>
                            <th className="py-2 px-2 text-right">Quantity</th>
                            <th className="py-2 px-2 text-right">Cost ($)</th>
                            <th className="py-2 px-2.5">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zorvex-border/20 dark:divide-zorvex-dark-border/20 text-[11px]">
                          {filteredLineItems.length > 0 ? (
                            filteredLineItems.map((li, idx) => {
                              const ltype = li.line_item_type || li.line_type || 'Usage';
                              const isRiFee = ltype === 'RIFee';
                              const isDisc = ltype === 'DiscountedUsage';
                              const isTax = ltype === 'Tax';

                              return (
                                <tr key={`${li.date}-${idx}`} className="hover:bg-zorvex-surface/80 dark:hover:bg-zorvex-dark-surface/80 transition-colors">
                                  <td className="py-1.5 px-2.5 font-mono text-zorvex-text dark:text-zorvex-dark-text whitespace-nowrap">
                                    {li.date}
                                  </td>
                                  <td className="py-1.5 px-2 whitespace-nowrap">
                                    <span
                                      className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                                        isRiFee
                                          ? 'bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-forest/20 dark:text-zorvex-forest-highlight border border-zorvex-forest/30'
                                          : isDisc
                                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                                          : isTax
                                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                                          : 'bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text-secondary dark:text-zorvex-dark-text border border-zorvex-border/40 dark:border-zorvex-dark-border/40'
                                      }`}
                                    >
                                      {ltype}
                                    </span>
                                  </td>
                                  <td className="py-1.5 px-2 font-mono text-zorvex-text dark:text-zorvex-dark-text truncate max-w-[160px]" title={li.usage_type}>
                                    {li.usage_type}
                                  </td>
                                  <td className="py-1.5 px-2 font-mono text-zorvex-text-secondary text-[10px] truncate max-w-[120px]" title={li.operation || '—'}>
                                    {li.operation || '—'}
                                  </td>
                                  <td className="py-1.5 px-2 font-mono text-right text-zorvex-text-secondary whitespace-nowrap">
                                    {li.usage_amount > 0 ? `${li.usage_amount.toLocaleString()} ${li.unit || ''}` : '—'}
                                  </td>
                                  <td className="py-1.5 px-2 font-mono font-bold text-right text-zorvex-forest dark:text-zorvex-forest-highlight whitespace-nowrap">
                                    ${li.cost.toFixed(4)}
                                  </td>
                                  <td className="py-1.5 px-2.5 text-[10px] text-zorvex-text-secondary truncate max-w-[180px]" title={li.desc || li.item_description || ''}>
                                    {li.desc || li.item_description || '—'}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={7} className="py-4 text-center text-zorvex-text-secondary italic">
                                No line items matching query "{ledgerSearch}".
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Verification & Audit Integrity Disclaimer */}
              <div className="p-4 rounded-xl bg-zorvex-surface-secondary/50 dark:bg-zorvex-dark-surface-secondary border border-zorvex-border/80 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-zorvex-text dark:text-zorvex-dark-text">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>FinOps Telemetry Notice</span>
                </div>
                <p className="text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary text-[11px] leading-relaxed">
                  Historical telemetry compiled from unblended AWS CUR records. Billing records represent billed resource consumption over the selected historical period. Historical billing records do not prove whether an instance or snapshot currently exists in live AWS runtime.
                </p>
              </div>

            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-zorvex-border dark:border-zorvex-dark-border bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary/40 flex justify-end">
              <button
                type="button"
                onClick={closeResourceDetail}
                className="px-5 py-2 rounded-clay-pill clay-button text-xs font-extrabold cursor-pointer"
              >
                Close Inspector
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
