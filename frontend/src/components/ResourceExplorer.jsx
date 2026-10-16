import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  Server,
  Database,
  HardDrive,
  Camera,
  Layers,
  Globe,
  Network,
  Cpu,
  Copy,
  Check,
  DollarSign,
  Calendar,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  X,
  Eye,
  RefreshCw,
  Clock,
  ShieldAlert,
  SlidersHorizontal,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { api } from '../services/api';
import ClayDropdown from './common/ClayDropdown';

export default function ResourceExplorer({ 
  overview, 
  selectedAccount = 'all', 
  selectedService: selectedServiceProp = 'All',
  onServiceChange,
  activeDataset = '', 
  forexData 
}) {
  // Query & Hierarchy State
  const [query, setQuery] = useState('');
  const [selectedService, setSelectedService] = useState(selectedServiceProp || 'All');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState(selectedAccount || 'all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [minCost, setMinCost] = useState('');
  const [sortBy, setSortBy] = useState('cost');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showAllServices, setShowAllServices] = useState(false);

  // Response Data State
  const [data, setData] = useState(null);
  const [hierarchies, setHierarchies] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');

  // Selected Resource for Deep Audit Drawer
  const [selectedResource, setSelectedResource] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Sync external selectedAccount
  useEffect(() => {
    if (selectedAccount && selectedAccount !== accountFilter) {
      setAccountFilter(selectedAccount);
      setPage(1);
    }
  }, [selectedAccount]);

  // Sync external selectedService from GlobalFilterBar
  useEffect(() => {
    if (selectedServiceProp !== undefined && selectedServiceProp !== selectedService) {
      setSelectedService(selectedServiceProp);
      setSelectedCategory('ALL');
      setPage(1);
    }
  }, [selectedServiceProp]);

  // Fetch Available Hierarchies on mount or dataset change
  const fetchHierarchies = async () => {
    try {
      const res = await api.getResourceHierarchies();
      setHierarchies(res);
    } catch (err) {
      console.warn('Failed to fetch resource hierarchies:', err);
    }
  };

  useEffect(() => {
    fetchHierarchies();
  }, [activeDataset]);

  // Fetch Filtered Resources from Backend
  const fetchResources = async () => {
    setLoading(true);
    setError('');
    try {
      const minVal = minCost ? parseFloat(minCost) : null;
      const res = await api.getResources({
        query: query.trim(),
        service: selectedService,
        category: selectedCategory,
        account_id: accountFilter,
        region: regionFilter,
        min_cost: minVal,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        page_size: pageSize
      });
      setData(res);
      if (res.hierarchies && !hierarchies) {
        setHierarchies(res.hierarchies);
      }
    } catch (err) {
      setError(err.message || 'Failed to query resource explorer');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Debounced Query Execution
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchResources();
    }, 280);
    return () => clearTimeout(timer);
  }, [
    query,
    selectedService,
    selectedCategory,
    accountFilter,
    regionFilter,
    minCost,
    sortBy,
    sortOrder,
    page,
    pageSize,
    activeDataset
  ]);

  // Handle Service Selection Change
  const handleServiceChange = (svc) => {
    setSelectedService(svc);
    setSelectedCategory('ALL');
    setPage(1);
    if (onServiceChange) {
      onServiceChange(svc);
    }
  };

  // Handle Category Selection Change
  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    setPage(1);
  };

  // Copy Identifier Helper
  const copyId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  // Open Deep Resource Audit Drawer
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
  };

  // Data helpers
  const summary = data?.summary || {};
  const snapshotsSummary = data?.snapshots_summary;
  const resourcesList = data?.resources || [];
  const pagination = data?.pagination || { page: 1, page_size: 25, total_records: 0, total_pages: 1 };

  // Discovered Accounts & Regions from overview or hierarchies
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

  // Dynamic Categories for currently selected service
  const currentServiceCategories = useMemo(() => {
    if (!hierarchies?.categories_by_service) return [];
    if (selectedService === 'All' || selectedService === 'SNAPSHOTS_BACKUPS') {
      return [];
    }
    return hierarchies.categories_by_service[selectedService] || [];
  }, [hierarchies, selectedService]);

  // All discovered other services (excluding EC2, RDS which have dedicated anchors)
  const otherServices = useMemo(() => {
    return hierarchies?.services?.filter(s => !['Amazon EC2', 'Amazon RDS'].includes(s.name)) || [];
  }, [hierarchies]);

  // Dynamically visible other services: show top 8 by default, guaranteeing selectedService is always present
  const visibleOtherServices = useMemo(() => {
    if (showAllServices) return otherServices;
    const top = otherServices.slice(0, 8);
    if (selectedService && !['All', 'SNAPSHOTS_BACKUPS', 'Amazon EC2', 'Amazon RDS'].includes(selectedService)) {
      if (!top.some(s => s.name === selectedService)) {
        const found = otherServices.find(s => s.name === selectedService);
        if (found) top.push(found);
      }
    }
    return top;
  }, [otherServices, showAllServices, selectedService]);

  // Is Snapshot View Active?
  const isSnapshotMode = (
    selectedService === 'SNAPSHOTS_BACKUPS' ||
    selectedCategory === 'EBS_SNAPSHOT' ||
    selectedCategory === 'RDS_SNAPSHOT' ||
    selectedCategory === 'RDS_BACKUP'
  );

  // Determine if snapshots are relevant to the selected service scope
  const hasSnapshotsInScope = (
    selectedService === 'All' ||
    selectedService === 'SNAPSHOTS_BACKUPS' ||
    selectedService === 'Amazon EC2' ||
    selectedService === 'Amazon RDS' ||
    Boolean(summary?.scope_snapshot_count > 0)
  );

  const scopeSnapshotCost = useMemo(() => {
    if (selectedService === 'Amazon EC2') {
      return snapshotsSummary?.ebs_snapshot_cost || 0;
    }
    if (selectedService === 'Amazon RDS') {
      return snapshotsSummary?.rds_backup_cost || 0;
    }
    if (summary?.scope_snapshot_cost !== undefined) {
      return summary.scope_snapshot_cost;
    }
    return snapshotsSummary?.total_snapshot_cost || 0;
  }, [selectedService, snapshotsSummary, summary]);

  const scopeSnapshotCount = useMemo(() => {
    if (selectedService === 'Amazon EC2') {
      return snapshotsSummary?.ebs_snapshot_count || 0;
    }
    if (selectedService === 'Amazon RDS') {
      return snapshotsSummary?.rds_backup_count || 0;
    }
    if (summary?.scope_snapshot_count !== undefined) {
      return summary.scope_snapshot_count;
    }
    return snapshotsSummary?.unique_snapshots_count || 0;
  }, [selectedService, snapshotsSummary, summary]);

  return (
    <div className="space-y-6">
      
      {/* ==================== LEVEL 1: SERVICE HIERARCHY NAVIGATION ==================== */}
      <div className="clay-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight shadow-inner">
                <Layers className="w-5 h-5 stroke-[2.5]" />
              </span>
              <div>
                <h2 className="text-xl font-extrabold text-zorvex-text dark:text-zorvex-dark-text tracking-tight flex items-center gap-2">
                  <span>Cloud Resource Explorer</span>
                  <span className="clay-pill px-2.5 py-0.5 text-[11px] font-black bg-zorvex-secondary dark:bg-zorvex-dark-secondary text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                    CUR Telemetry Verified
                  </span>
                </h2>
                <p className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-0.5">
                  Authoritative resource-level cost tracking, snapshot intelligence, and usage attribution.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-zorvex-text-muted dark:text-zorvex-dark-text-muted bg-zorvex-secondary dark:bg-zorvex-dark-secondary px-3 py-1.5 rounded-clay-pill border border-zorvex-border dark:border-zorvex-dark-border">
              Dataset: <span className="text-zorvex-forest dark:text-zorvex-forest-highlight">{summary.dataset_name || activeDataset || 'Active CUR'}</span>
            </span>
          </div>
        </div>

        {/* Service Level Tabs Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zorvex-border/40 dark:border-zorvex-dark-border/40">
          
          {/* All Services */}
          <button
            type="button"
            onClick={() => handleServiceChange('All')}
            className={`px-3.5 py-2 rounded-clay-pill text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedService === 'All'
                ? 'clay-pill-active'
                : 'bg-zorvex-secondary dark:bg-zorvex-dark-secondary text-zorvex-text-muted dark:text-zorvex-dark-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>All Services</span>
          </button>

          {/* Dedicated Global Snapshots & Backups Intelligence Tab */}
          <button
            type="button"
            onClick={() => handleServiceChange('SNAPSHOTS_BACKUPS')}
            className={`px-3.5 py-2 rounded-clay-pill text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedService === 'SNAPSHOTS_BACKUPS'
                ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-clay-sm'
                : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 border border-amber-500/20'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-amber-500" />
            <span>📸 Snapshots & Backups</span>
            {hierarchies?.snapshots_and_backups && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-900/30 font-mono font-bold">
                ${hierarchies.snapshots_and_backups.total_cost.toLocaleString()}
              </span>
            )}
          </button>

          {/* Amazon EC2 */}
          <button
            type="button"
            onClick={() => handleServiceChange('Amazon EC2')}
            className={`px-3.5 py-2 rounded-clay-pill text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedService === 'Amazon EC2'
                ? 'clay-pill-active'
                : 'bg-zorvex-secondary dark:bg-zorvex-dark-secondary text-zorvex-text-muted dark:text-zorvex-dark-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Amazon EC2</span>
          </button>

          {/* Amazon RDS */}
          <button
            type="button"
            onClick={() => handleServiceChange('Amazon RDS')}
            className={`px-3.5 py-2 rounded-clay-pill text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedService === 'Amazon RDS'
                ? 'clay-pill-active'
                : 'bg-zorvex-secondary dark:bg-zorvex-dark-secondary text-zorvex-text-muted dark:text-zorvex-dark-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Amazon RDS</span>
          </button>

          {/* Other Data-Driven Services Discovered in CUR */}
          {visibleOtherServices.map((svc) => (
            <button
              key={svc.id}
              type="button"
              onClick={() => handleServiceChange(svc.name)}
              className={`px-3 py-1.5 rounded-clay-pill text-xs font-bold transition-all cursor-pointer ${
                selectedService === svc.name
                  ? 'clay-pill-active'
                  : 'bg-zorvex-secondary dark:bg-zorvex-dark-secondary text-zorvex-text-muted dark:text-zorvex-dark-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text'
              }`}
            >
              <span>{svc.name}</span>
            </button>
          ))}

          {/* Show More / Show Less Services Toggle */}
          {otherServices.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAllServices(prev => !prev)}
              className="px-3 py-1.5 rounded-clay-pill text-xs font-bold transition-all bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight hover:bg-zorvex-forest/20 flex items-center gap-1 cursor-pointer border border-zorvex-forest/20"
              title={showAllServices ? "Show fewer services" : `Show all ${otherServices.length} discovered services`}
            >
              <span>{showAllServices ? 'Show Fewer' : `+${otherServices.length - 8} More Services`}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAllServices ? 'rotate-180' : ''}`} />
            </button>
          )}

        </div>

        {/* ==================== LEVEL 2: DYNAMIC ASSET CATEGORY PILLS ==================== */}
        {selectedService !== 'All' && selectedService !== 'SNAPSHOTS_BACKUPS' && (
          <div className="pt-3 border-t border-zorvex-border/40 dark:border-zorvex-dark-border/40 space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
              <span>{selectedService} Asset Categories:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleCategoryChange('ALL')}
                className={`px-3 py-1.5 rounded-clay-pill text-xs font-black transition-all cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-zorvex-forest text-white shadow-clay-sm'
                    : 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-text dark:text-zorvex-dark-text hover:bg-zorvex-secondary border border-zorvex-border dark:border-zorvex-dark-border'
                }`}
              >
                All {selectedService.replace('Amazon ', '')}
              </button>

              {currentServiceCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`px-3 py-1.5 rounded-clay-pill text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-zorvex-forest text-white shadow-clay-sm'
                      : 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-text dark:text-zorvex-dark-text hover:bg-zorvex-secondary border border-zorvex-border dark:border-zorvex-dark-border'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zorvex-secondary dark:bg-zorvex-dark-secondary text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                    {cat.unique_resources > 0 ? cat.unique_resources : cat.records_count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ==================== SUMMARY CARDS ROW ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Cost for Current Selection */}
        <div className="clay-card p-5 space-y-1">
          <div className="flex items-center justify-between text-xs font-extrabold text-zorvex-text-muted dark:text-zorvex-dark-text-muted uppercase">
            <span>Selected Scope Spend</span>
            <DollarSign className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
          </div>
          <div className="text-2xl font-black font-mono text-zorvex-forest dark:text-zorvex-forest-highlight">
            ${(summary.total_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted flex items-center gap-1 pt-1">
            <span>Currency:</span>
            <span className="font-bold font-mono text-zorvex-text dark:text-zorvex-dark-text">{summary.currency || 'USD'}</span>
            {forexData?.rate && (
              <span className="font-mono text-zorvex-text-muted">
                (≈ ₹{Math.round((summary.total_cost || 0) * forexData.rate).toLocaleString()})
              </span>
            )}
          </div>
        </div>

        {/* Unique Identified Resources / Active Inventory */}
        <div className="clay-card p-5 space-y-1">
          <div className="flex items-center justify-between text-xs font-extrabold text-zorvex-text-muted dark:text-zorvex-dark-text-muted uppercase">
            <span>{selectedService === 'Amazon RDS' ? 'Active DB Instances' : 'Identified Resources'}</span>
            <Server className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
          </div>
          <div className="text-2xl font-black font-mono text-zorvex-text dark:text-zorvex-dark-text">
            {selectedService === 'Amazon RDS' && summary.inventory_reconciliation
              ? `${summary.inventory_reconciliation.active_instances} Active`
              : (summary.unique_resources_count || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted pt-1">
            {selectedService === 'Amazon RDS' && summary.inventory_reconciliation ? (
              <span title={`${summary.inventory_reconciliation.active_instances} Active compute DBs + ${summary.inventory_reconciliation.retained_backups} retained backup storage identifiers for deleted DBs`}>
                + {summary.inventory_reconciliation.retained_backups} Retained Backups ({summary.unique_resources_count} Total Billable ARNs)
              </span>
            ) : (
              <>Classified Spend: <span className="font-mono font-bold text-zorvex-text dark:text-zorvex-dark-text">${(summary.classified_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></>
            )}
          </div>
        </div>

        {/* Card 3: Snapshot Spend (for EC2/RDS/Backups) OR Charge Activity Timeline (for non-snapshot services like Cost Explorer) */}
        {hasSnapshotsInScope ? (
          <div className={`clay-card p-5 space-y-1 ${isSnapshotMode ? 'ring-2 ring-amber-500/50 bg-amber-500/5' : ''}`}>
            <div className="flex items-center justify-between text-xs font-extrabold text-amber-700 dark:text-amber-400 uppercase">
              <span>{selectedService === 'Amazon EC2' ? 'EBS Snapshot Spend' : selectedService === 'Amazon RDS' ? 'RDS Backup Spend' : 'Snapshot & Backup Spend'}</span>
              <Camera className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black font-mono text-amber-800 dark:text-amber-300">
              ${scopeSnapshotCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted pt-1">
              {selectedService === 'Amazon EC2' ? (
                <><span className="font-bold text-amber-700 dark:text-amber-400 font-mono">{scopeSnapshotCount}</span> EBS Snapshots</>
              ) : selectedService === 'Amazon RDS' ? (
                <><span className="font-bold text-amber-700 dark:text-amber-400 font-mono">{scopeSnapshotCount}</span> Automated RDS Backups</>
              ) : (
                <><span className="font-bold text-amber-700 dark:text-amber-400 font-mono">{scopeSnapshotCount}</span> Assets (EBS: {snapshotsSummary?.ebs_snapshot_count || 0}, RDS: {snapshotsSummary?.rds_backup_count || 0})</>
              )}
            </div>
          </div>
        ) : (
          <div className="clay-card p-5 space-y-1">
            <div className="flex items-center justify-between text-xs font-extrabold text-zorvex-forest dark:text-zorvex-forest-highlight uppercase">
              <span>Charge Activity Timeline</span>
              <Calendar className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
            </div>
            <div className="text-2xl font-black font-mono text-zorvex-forest dark:text-zorvex-forest-highlight truncate">
              {summary.first_charge_date ? (
                summary.charge_dates_count === 1 ? (
                  summary.first_charge_date
                ) : (
                  <span className="text-lg">{summary.first_charge_date} → {summary.last_charge_date}</span>
                )
              ) : (
                '—'
              )}
            </div>
            <div className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted pt-1">
              {summary.charge_dates_count === 1 ? (
                <>Single charge event on <strong className="text-zorvex-text dark:text-zorvex-dark-text font-mono">{summary.first_charge_date}</strong></>
              ) : summary.charge_dates_count > 1 ? (
                <><span className="font-bold font-mono text-zorvex-text dark:text-zorvex-dark-text">{summary.charge_dates_count} active days</span> in billing period</>
              ) : (
                <span>No active charges in scope</span>
              )}
            </div>
          </div>
        )}

        {/* Unallocated / Usage-Level Spend */}
        <div className="clay-card p-5 space-y-1">
          <div className="flex items-center justify-between text-xs font-extrabold text-zorvex-text-muted dark:text-zorvex-dark-text-muted uppercase">
            <span>Usage-Level / Shared</span>
            <Info className="w-4 h-4 text-zorvex-text-muted" />
          </div>
          <div className="text-2xl font-black font-mono text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
            ${(summary.unallocated_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted pt-1">
            <span className="font-bold font-mono">{summary.unallocated_records_count || 0}</span> unallocated usage line items
          </div>
        </div>

      </div>

      {/* ==================== SNAPSHOT COST INTELLIGENCE DEDICATED PANEL ==================== */}
      {isSnapshotMode && snapshotsSummary && (
        <div className="clay-card p-6 space-y-4 border-2 border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 shadow-inner">
                <Camera className="w-5 h-5 stroke-[2.5]" />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-amber-900 dark:text-amber-200">
                  Snapshot & Backup Cost Intelligence
                </h3>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                  Aggregated telemetry across Amazon EC2 EBS Snapshots and Amazon RDS Automated Backups.
                </p>
              </div>
            </div>

            <div className="px-3 py-1.5 rounded-clay-pill bg-amber-500/20 text-amber-900 dark:text-amber-200 text-xs font-bold font-mono">
              Combined Snapshot Pool: ${(snapshotsSummary.total_snapshot_cost || 0).toFixed(2)}
            </div>
          </div>

          {/* Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            
            {/* EBS Snapshots Box */}
            <div className="p-4 rounded-2xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-amber-500/20 space-y-2 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-amber-600" />
                  <span>Amazon EC2 EBS Snapshots</span>
                </span>
                <span className="text-sm font-black font-mono text-zorvex-forest dark:text-zorvex-forest-highlight">
                  ${(snapshotsSummary.ebs_snapshot_cost || 0).toFixed(2)}
                </span>
              </div>
              <div className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted flex items-center justify-between">
                <span>Unique Snapshot Volumes:</span>
                <span className="font-mono font-bold text-zorvex-text dark:text-zorvex-dark-text">{snapshotsSummary.ebs_snapshot_count} snapshots</span>
              </div>
              <div className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                Usage Type: <code className="font-mono font-bold">APS3-EBS:SnapshotUsage</code>
              </div>
            </div>

            {/* RDS Backups Box */}
            <div className="p-4 rounded-2xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-amber-500/20 space-y-2 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-amber-600" />
                  <span>Amazon RDS Automated Backups</span>
                </span>
                <span className="text-sm font-black font-mono text-zorvex-forest dark:text-zorvex-forest-highlight">
                  ${(snapshotsSummary.rds_backup_cost || 0).toFixed(2)}
                </span>
              </div>
              <div className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted flex items-center justify-between">
                <span>Databases with Backups:</span>
                <span className="font-mono font-bold text-zorvex-text dark:text-zorvex-dark-text">{snapshotsSummary.rds_backup_count} database clusters</span>
              </div>
              <div className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                Usage Type: <code className="font-mono font-bold">APS3-RDS:ChargedBackupUsage</code>
              </div>
            </div>

          </div>

          {/* Compliance & Engineering Integrity Disclaimer */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">FinOps Verification Rule: </span>
              {snapshotsSummary.compliance_disclaimer}
            </div>
          </div>
        </div>
      )}

      {/* ==================== SEARCH, FILTERS & CONTROLS ==================== */}
      <div className="clay-card p-5 space-y-4">
        <div className="flex flex-col lg:flex-row items-center gap-3">
          
          {/* Search Bar */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-zorvex-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="resource-search"
              name="resourceSearch"
              aria-label="Search resources by ID, name, or tag"
              type="text"
              placeholder="Search resource ID (snap-*, i-*, vol-*, db:*), name tag, or SKU..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 clay-input text-xs font-semibold text-zorvex-text dark:text-zorvex-dark-text placeholder:text-zorvex-text-muted/60"
            />
          </div>

          {/* Account Filter */}
          <div className="w-full sm:w-52">
            <ClayDropdown
              options={accountOptions}
              value={accountFilter}
              onChange={(val) => {
                setAccountFilter(val);
                setPage(1);
              }}
              searchable={accountOptions.length > 4}
              width="w-full"
            />
          </div>

          {/* Region Filter */}
          <div className="w-full sm:w-44">
            <ClayDropdown
              options={regionOptions}
              value={regionFilter}
              onChange={(val) => {
                setRegionFilter(val);
                setPage(1);
              }}
              searchable={regionOptions.length > 4}
              width="w-full"
            />
          </div>

          {/* Min Cost Filter */}
          <div className="w-full sm:w-32 flex items-center gap-2 px-3 py-2 clay-input">
            <DollarSign className="w-3.5 h-3.5 text-zorvex-text-muted flex-shrink-0" />
            <input
              id="resource-min-cost"
              name="minCost"
              aria-label="Minimum resource cost filter"
              type="number"
              placeholder="Min ($)"
              value={minCost}
              onChange={(e) => {
                setMinCost(e.target.value);
                setPage(1);
              }}
              className="w-full bg-transparent text-xs font-semibold font-mono text-zorvex-text dark:text-zorvex-dark-text focus:outline-none"
            />
          </div>

          {/* Sort Selector */}
          <div className="w-full sm:w-44">
            <ClayDropdown
              options={[
                { value: 'cost', label: 'Sort: Cost (Highest)' },
                { value: 'days', label: 'Sort: Active Days' },
                { value: 'name', label: 'Sort: Name / Tag' },
                { value: 'id', label: 'Sort: Resource ID' },
                { value: 'usage_amount', label: 'Sort: Usage Amount' }
              ]}
              value={sortBy}
              onChange={(val) => setSortBy(val)}
              width="w-full"
            />
          </div>

          {/* Reset Filters Button */}
          {(query || selectedService !== 'All' || selectedCategory !== 'ALL' || accountFilter !== 'all' || regionFilter !== 'all' || minCost) && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSelectedService('All');
                setSelectedCategory('ALL');
                setAccountFilter('all');
                setRegionFilter('all');
                setMinCost('');
                setPage(1);
              }}
              className="px-3.5 py-2 rounded-clay-pill text-xs font-black bg-zorvex-secondary dark:bg-zorvex-dark-secondary text-zorvex-text-muted dark:text-zorvex-dark-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

        </div>
      </div>

      {/* ==================== STREAMLINED RESOURCE INVENTORY TABLE (6 HIGH-DENSITY COLUMNS) ==================== */}
      <div className="clay-card p-6 overflow-hidden space-y-4">
        
        {/* Table Header Controls & Pagination Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
          <div>
            Showing <span className="font-bold font-mono text-zorvex-text dark:text-zorvex-dark-text">{resourcesList.length > 0 ? (pagination.page - 1) * pagination.page_size + 1 : 0}</span> to <span className="font-bold font-mono text-zorvex-text dark:text-zorvex-dark-text">{Math.min(pagination.page * pagination.page_size, pagination.total_records)}</span> of <span className="font-bold font-mono text-zorvex-text dark:text-zorvex-dark-text">{pagination.total_records}</span> unique assets
          </div>

          <div className="flex items-center gap-2">
            <span>Page Size:</span>
            {[25, 50, 100].map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => {
                  setPageSize(sz);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold cursor-pointer ${
                  pageSize === sz
                    ? 'bg-zorvex-forest text-white'
                    : 'bg-zorvex-secondary dark:bg-zorvex-dark-secondary text-zorvex-text-muted dark:text-zorvex-dark-text-muted'
                }`}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>

        {/* RDS Inventory Reconciliation Ground Truth Banner */}
        {selectedService === 'Amazon RDS' && summary.inventory_reconciliation && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
            <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1.5 text-xs text-zorvex-text dark:text-zorvex-dark-text flex-1">
              <div className="font-extrabold text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-2">
                  <span>RDS Inventory Reconciliation: {summary.inventory_reconciliation.active_instances} Active DB Instances Verified</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                    FinOps Ground Truth
                  </span>
                </span>
                <span className="text-[11px] font-mono text-zorvex-text-muted">
                  CUR Source: <strong className="text-zorvex-text dark:text-zorvex-dark-text">{summary.dataset_name}</strong>
                </span>
              </div>
              <p className="text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary leading-relaxed">
                {summary.inventory_reconciliation.reconciliation_note}
              </p>
              <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active Compute DBs: {summary.inventory_reconciliation.active_instances}
                  {summary.inventory_reconciliation.active_instance_names?.length > 0 && (
                    <span className="font-normal opacity-90">
                      ({summary.inventory_reconciliation.active_instance_names.join(', ')})
                    </span>
                  )}
                </span>
                {summary.inventory_reconciliation.retained_backups > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200 font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Retained Backup Storage Only: {summary.inventory_reconciliation.retained_backups}
                    {summary.inventory_reconciliation.retained_backup_names?.length > 0 && (
                      <span className="font-normal opacity-90">
                        ({summary.inventory_reconciliation.retained_backup_names.join(', ')})
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Managed Multi-Node Cluster Architecture Callout (OpenSearch / Redshift) */}
        {(selectedService === 'Amazon OpenSearch' || selectedService === 'Amazon Redshift' || resourcesList.some(r => r.cluster_nodes)) && (
          (() => {
            const clusterRes = resourcesList.find(r => r.cluster_nodes);
            if (!clusterRes || !clusterRes.cluster_nodes) return null;
            const cn = clusterRes.cluster_nodes;
            return (
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-start gap-3">
                <Server className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-xs text-zorvex-text dark:text-zorvex-dark-text flex-1">
                  <div className="font-extrabold text-indigo-900 dark:text-indigo-200 text-sm flex items-center justify-between flex-wrap gap-2">
                    <span className="flex items-center gap-2">
                      <span>{cn.cluster_type || 'Cluster'} Architecture: {clusterRes.short_id || clusterRes.name || clusterRes.resource_id}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/20 text-indigo-800 dark:text-indigo-200 font-bold">
                        {cn.node_count ? `${cn.node_count}-Node Topology` : 'Multi-Node Topology'}
                      </span>
                    </span>
                    <span className="text-[11px] font-mono text-zorvex-text-muted">
                      Total Compute: <strong className="text-zorvex-text dark:text-zorvex-dark-text">{cn.total_compute_hours ? `${cn.total_compute_hours.toLocaleString()} Hrs` : '—'}</strong>
                    </span>
                  </div>

                  {/* Node breakdown pills */}
                  <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
                    {cn.data_nodes && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-900 dark:text-indigo-100 font-bold border border-indigo-500/30">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        Data Nodes: {cn.data_nodes.estimated_count}x {cn.data_nodes.instance_type} ({cn.data_nodes.hours?.toLocaleString()} Hrs)
                        {cn.data_nodes.is_ri_covered && <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px] ml-1">✓ 100% RI Covered</span>}
                      </span>
                    )}

                    {cn.master_nodes && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-900 dark:text-amber-100 font-bold border border-amber-500/30">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        Dedicated Master Nodes: {cn.master_nodes.estimated_count}x {cn.master_nodes.instance_type} ({cn.master_nodes.hours?.toLocaleString()} Hrs)
                        {cn.master_nodes.is_ri_covered && <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px] ml-1">✓ 100% RI Covered</span>}
                      </span>
                    )}

                    {cn.compute_nodes && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-900 dark:text-indigo-100 font-bold border border-indigo-500/30">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        Compute Nodes: {cn.compute_nodes.estimated_count}x {cn.compute_nodes.instance_type} ({cn.compute_nodes.hours?.toLocaleString()} Hrs)
                        {cn.compute_nodes.is_ri_covered && <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px] ml-1">✓ 100% RI Covered</span>}
                      </span>
                    )}

                    {cn.storage && cn.storage.amount > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zorvex-secondary/80 dark:bg-zorvex-dark-secondary text-zorvex-text dark:text-zorvex-dark-text border border-zorvex-border">
                        💾 Storage: {cn.storage.amount?.toLocaleString()} {cn.storage.unit} ({cn.storage.type || 'Storage'}) • ${cn.storage.cost?.toFixed(2)}
                      </span>
                    )}

                    {cn.network_transfer_gb > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zorvex-secondary/80 dark:bg-zorvex-dark-secondary text-zorvex-text dark:text-zorvex-dark-text border border-zorvex-border">
                        🌐 Inter-AZ Transit: {cn.network_transfer_gb?.toLocaleString()} GB • ${cn.network_cost?.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })()
        )}

        {/* Streamlined 6-Column High-Density Table */}
        <div className="rounded-2xl border border-zorvex-border dark:border-zorvex-dark-border overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zorvex-secondary/60 dark:bg-zorvex-dark-secondary border-b border-zorvex-border dark:border-zorvex-dark-border text-zorvex-text-muted dark:text-zorvex-dark-text-muted uppercase text-[10px] font-black tracking-wider">
                <th className="py-3 px-4">Resource & Name</th>
                <th className="py-3 px-4">Service & Category</th>
                <th className="py-3 px-4">Region & Account</th>
                <th className="py-3 px-4 text-right">Usage & Activity</th>
                <th className="py-3 px-4 text-right">Total Cost ($)</th>
                <th className="py-3 px-3 text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zorvex-border/50 dark:divide-zorvex-dark-border">
              {resourcesList.map((item) => (
                <tr
                  key={item.resource_id}
                  className="hover:bg-zorvex-secondary/40 dark:hover:bg-zorvex-dark-secondary transition-colors"
                >
                  
                  {/* 1. Resource & Name */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 font-mono font-bold text-xs text-zorvex-text dark:text-zorvex-dark-text">
                      <span className="truncate max-w-[200px]" title={item.resource_id}>
                        {item.short_id}
                      </span>
                      {item.resource_id !== 'No-Resource-ID' && !item.resource_id.startsWith('TAX-') && (
                        <button
                          type="button"
                          onClick={() => copyId(item.resource_id)}
                          className="p-0.5 rounded text-zorvex-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text cursor-pointer flex-shrink-0"
                          title="Copy Full ARN / Resource ID"
                        >
                          {copiedId === item.resource_id ? (
                            <Check className="w-3 h-3 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[11px] font-semibold text-zorvex-text-muted truncate max-w-[200px]" title={item.name ? item.name : (item.clean_label || item.display_label)}>
                        {item.name ? item.name : (item.clean_label || item.display_label)}
                      </span>
                      {item.active_days === 1 && item.first_seen && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-zorvex-forest/10 text-zorvex-forest dark:text-zorvex-forest-highlight border border-zorvex-forest/20" title={`Charged on ${item.first_seen}`}>
                          {item.first_seen}
                        </span>
                      )}
                      {item.lifecycle_status === 'ACTIVE_INSTANCE' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Active</span>
                        </span>
                      ) : item.lifecycle_status === 'RETAINED_BACKUP_STORAGE' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25" title="Historical automated backup storage. Instance compute has been deleted.">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>Retained Backup</span>
                        </span>
                      ) : item.lifecycle_status === 'SNAPSHOT_STORAGE' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25">
                          <span>Snapshot</span>
                        </span>
                      ) : null}
                    </div>
                    {item.cluster_nodes && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-zorvex-forest-soft/80 text-zorvex-forest dark:bg-zorvex-forest-dark-soft dark:text-zorvex-forest-highlight border border-zorvex-forest/20">
                          <Server className="w-2.5 h-2.5" />
                          <span>{item.cluster_nodes.summary_label}</span>
                        </span>
                      </div>
                    )}
                  </td>

                  {/* 2. Service & Category */}
                  <td className="py-3 px-4">
                    <div className="font-bold text-xs text-zorvex-text dark:text-zorvex-dark-text">
                      {item.service}
                    </div>
                    <div className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-0.5 truncate max-w-[170px]" title={`${item.category_label} • ${item.asset_type}`}>
                      {item.category_label} • {item.asset_type}
                    </div>
                  </td>

                  {/* 3. Region & Account */}
                  <td className="py-3 px-4 font-mono text-[11px]">
                    <div className="text-zorvex-text dark:text-zorvex-dark-text font-bold">
                      📍 {item.region}
                    </div>
                    <div className="text-[10px] text-zorvex-text-muted mt-0.5">
                      Acc: {item.account_id}
                    </div>
                  </td>

                  {/* 4. Usage Quantity & Active Days */}
                  <td className="py-3 px-4 text-right font-mono">
                    <div className="text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text">
                      {item.category === 'TAX_AND_FEES' || item.asset_type?.includes('Tax') || item.category === 'RI_SUBSCRIPTION_FEE' ? (
                        <span className="text-zorvex-text-muted italic font-normal text-[11px]">—</span>
                      ) : item.usage_display ? (
                        <span>{item.usage_display}</span>
                      ) : item.usage_amount > 0 ? (
                        <span>
                          {item.usage_amount < 1 ? item.usage_amount.toFixed(4) : item.usage_amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-[10px] text-zorvex-text-muted">{item.usage_unit}</span>
                        </span>
                      ) : (
                        <span className="text-zorvex-text-muted text-[11px]">—</span>
                      )}
                    </div>
                    <div className="text-[10px] text-zorvex-text-muted mt-0.5 font-mono">
                      {item.cluster_nodes ? (
                        <span className="font-semibold text-zorvex-forest dark:text-zorvex-forest-highlight">
                          {item.cluster_nodes.node_count} nodes running
                        </span>
                      ) : item.active_days === 1 && item.first_seen ? (
                        <span className="font-bold text-zorvex-forest dark:text-zorvex-forest-highlight flex items-center justify-end gap-1" title={`Charged on ${item.first_seen}`}>
                          <span>📅 {item.first_seen}</span>
                          <span className="text-[9px] font-normal opacity-80">(1d)</span>
                        </span>
                      ) : item.first_seen && item.last_seen ? (
                        <span title={`Active from ${item.first_seen} to ${item.last_seen.split(' ')[0]}`}>
                          {item.first_seen} → {item.last_seen.split(' ')[0]} ({item.active_days}d)
                        </span>
                      ) : (
                        <span>{item.active_days} {item.active_days === 1 ? 'day' : 'days'}</span>
                      )}
                    </div>
                  </td>

                  {/* 5. Total Cost ($) */}
                  <td className="py-3 px-4 text-right font-mono">
                    <div className="text-sm font-black text-zorvex-forest dark:text-zorvex-forest-highlight">
                      ${item.total_cost.toFixed(2)}
                    </div>
                    {forexData?.rates?.INR && (
                      <div className="text-[10px] text-zorvex-text-muted mt-0.5">
                        ₹{(item.total_cost * forexData.rates.INR).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    )}
                  </td>

                  {/* 6. Inspect Action */}
                  <td className="py-3 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => openResourceDetail(item)}
                      className="p-1.5 rounded-clay-pill bg-zorvex-secondary dark:bg-zorvex-dark-secondary hover:bg-zorvex-forest-soft text-zorvex-forest dark:text-zorvex-forest-highlight transition-all cursor-pointer shadow-sm"
                      title="Inspect Resource Billing Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>

                </tr>
              ))}

              {/* Empty State */}
              {resourcesList.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Server className="w-8 h-8 text-zorvex-text-muted/40" />
                      <p className="font-bold">No resources match the selected filters or search query.</p>
                      <p className="text-[11px]">Try selecting "All Services" or clearing your minimum cost threshold.</p>
                    </div>
                  </td>
                </tr>
              )}

              {/* Loading State */}
              {loading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-zorvex-forest" />
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
          <div className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
            Page <span className="font-bold font-mono text-zorvex-text dark:text-zorvex-dark-text">{pagination.page}</span> of <span className="font-bold font-mono text-zorvex-text dark:text-zorvex-dark-text">{pagination.total_pages}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 rounded-clay-pill text-xs font-bold bg-zorvex-secondary dark:bg-zorvex-dark-secondary text-zorvex-text dark:text-zorvex-dark-text disabled:opacity-30 cursor-pointer flex items-center gap-1 shadow-sm"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            {/* Simple numeric pages */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setPage(pageNum)}
                    className={`w-7 h-7 rounded-md text-xs font-mono font-bold cursor-pointer ${
                      pagination.page === pageNum
                        ? 'bg-zorvex-forest text-white'
                        : 'bg-zorvex-secondary dark:bg-zorvex-dark-secondary text-zorvex-text-muted hover:text-zorvex-text'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
              disabled={pagination.page >= pagination.total_pages}
              className="px-3 py-1.5 rounded-clay-pill text-xs font-bold bg-zorvex-secondary dark:bg-zorvex-dark-secondary text-zorvex-text dark:text-zorvex-dark-text disabled:opacity-30 cursor-pointer flex items-center gap-1 shadow-sm"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* ==================== RESOURCE AUDIT DETAIL DRAWER / MODAL ==================== */}
      {selectedResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
          <div className="w-full sm:max-w-2xl h-full sm:h-[95vh] bg-zorvex-surface dark:bg-zorvex-dark-surface sm:rounded-3xl border border-zorvex-border dark:border-zorvex-dark-border shadow-2xl flex flex-col overflow-hidden">
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-zorvex-border dark:border-zorvex-dark-border flex items-start justify-between bg-zorvex-secondary/40 dark:bg-zorvex-dark-secondary">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="clay-pill px-2.5 py-0.5 text-[10px] font-black bg-zorvex-forest text-white">
                    {selectedResource.service}
                  </span>
                  <span className="clay-pill px-2.5 py-0.5 text-[10px] font-bold bg-zorvex-secondary dark:bg-zorvex-dark-secondary text-zorvex-text">
                    {selectedResource.category_label}
                  </span>
                </div>
                <h3 className="text-lg font-black font-mono text-zorvex-text dark:text-zorvex-dark-text break-all">
                  {selectedResource.short_id}
                </h3>
                <p className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-0.5">
                  {selectedResource.name ? `Name Tag: ${selectedResource.name}` : selectedResource.display_label}
                </p>
              </div>

              <button
                type="button"
                onClick={closeResourceDetail}
                className="p-2 rounded-full hover:bg-zorvex-secondary dark:hover:bg-zorvex-dark-secondary text-zorvex-text-muted cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Key Resource Attributes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-zorvex-secondary/40 dark:bg-zorvex-dark-secondary border border-zorvex-border/50">
                  <span className="text-zorvex-text-muted block text-[10px] font-bold uppercase">Total Billed Spend</span>
                  <span className="text-base font-black font-mono text-zorvex-forest dark:text-zorvex-forest-highlight">
                    ${selectedResource.total_cost.toFixed(2)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-zorvex-secondary/40 dark:bg-zorvex-dark-secondary border border-zorvex-border/50">
                  <span className="text-zorvex-text-muted block text-[10px] font-bold uppercase">Active Days</span>
                  <span className="text-base font-black font-mono text-zorvex-text dark:text-zorvex-dark-text">
                    {selectedResource.active_days} Days
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-zorvex-secondary/40 dark:bg-zorvex-dark-secondary border border-zorvex-border/50">
                  <span className="text-zorvex-text-muted block text-[10px] font-bold uppercase">Account ID</span>
                  <span className="text-xs font-black font-mono text-zorvex-text dark:text-zorvex-dark-text truncate block">
                    {selectedResource.account_id}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-zorvex-secondary/40 dark:bg-zorvex-dark-secondary border border-zorvex-border/50">
                  <span className="text-zorvex-text-muted block text-[10px] font-bold uppercase">Region</span>
                  <span className="text-xs font-black font-mono text-zorvex-text dark:text-zorvex-dark-text">
                    📍 {selectedResource.region}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-zorvex-secondary/40 dark:bg-zorvex-dark-secondary border border-zorvex-border/50">
                  <span className="text-zorvex-text-muted block text-[10px] font-bold uppercase">Lifecycle Status</span>
                  <span className="text-xs font-black text-zorvex-forest dark:text-zorvex-forest-highlight truncate block">
                    {selectedResource.lifecycle_label || selectedResource.lifecycle_status || 'Active'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-zorvex-secondary/40 dark:bg-zorvex-dark-secondary border border-zorvex-border/50">
                  <span className="text-zorvex-text-muted block text-[10px] font-bold uppercase">Primary Usage Type</span>
                  <span className="text-xs font-black font-mono text-zorvex-text dark:text-zorvex-dark-text truncate block" title={selectedResource.primary_usage_type}>
                    {selectedResource.primary_usage_type}
                  </span>
                </div>
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

                  <p className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted leading-relaxed">
                    Authoritative topology extracted from CUR usage rows. Clusters operate with dedicated node roles separated into search/data nodes, cluster quorum managers, and provisioned storage.
                  </p>

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
                        <div className="text-[11px] font-mono text-zorvex-text-muted flex justify-between">
                          <span>Provisioned Hours:</span>
                          <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text">{selectedResource.cluster_nodes.data_nodes.hours.toLocaleString()} Hrs</span>
                        </div>
                        <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-md">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>100% Reserved Instance (RI) Covered</span>
                        </div>
                        <div className="text-[10px] text-zorvex-text-muted">
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
                        <div className="text-[11px] font-mono text-zorvex-text-muted flex justify-between">
                          <span>Provisioned Hours:</span>
                          <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text">{selectedResource.cluster_nodes.master_nodes.hours.toLocaleString()} Hrs</span>
                        </div>
                        <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-md">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>100% Reserved Instance (RI) Covered</span>
                        </div>
                        <div className="text-[10px] text-zorvex-text-muted">
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
                        <div className="text-[11px] font-mono text-zorvex-text-muted flex justify-between">
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
                        <span className="text-[10px] uppercase font-bold text-zorvex-text-muted block">Cluster Storage ({selectedResource.cluster_nodes.storage.type || 'GP3'})</span>
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
                        <span className="text-[10px] uppercase font-bold text-zorvex-text-muted block">Inter-AZ Data Transit</span>
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
              <div className="p-3.5 rounded-xl bg-zorvex-secondary/60 dark:bg-zorvex-dark-secondary border border-zorvex-border/60 text-xs space-y-1">
                <span className="text-[10px] font-black uppercase text-zorvex-text-muted block">Full AWS Resource ARN / ID:</span>
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

              {/* Daily Spend Timeline */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-zorvex-forest" />
                  <span>Daily Billing Progression</span>
                </h4>
                <div className="p-3 rounded-xl bg-zorvex-secondary/30 dark:bg-zorvex-dark-secondary border border-zorvex-border/40 max-h-44 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-zorvex-text-muted text-[10px] uppercase font-bold border-b border-zorvex-border/40">
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

              {/* Usage Types Breakdown */}
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

              {/* Verification & Audit Integrity Disclaimer */}
              <div className="p-4 rounded-xl bg-zorvex-secondary/50 dark:bg-zorvex-dark-secondary border border-zorvex-border/80 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-zorvex-text dark:text-zorvex-dark-text">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>FinOps Telemetry Notice</span>
                </div>
                <p className="text-zorvex-text-muted dark:text-zorvex-dark-text-muted text-[11px] leading-relaxed">
                  Historical telemetry compiled from unblended AWS CUR records. Billing records represent billed resource consumption over the selected historical period. Historical billing records do not prove whether an instance or snapshot currently exists in live AWS runtime.
                </p>
              </div>

            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-zorvex-border dark:border-zorvex-dark-border bg-zorvex-secondary/40 flex justify-end">
              <button
                type="button"
                onClick={closeResourceDetail}
                className="px-5 py-2 rounded-clay-pill clay-button text-xs font-extrabold cursor-pointer"
              >
                Close Inspector
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
