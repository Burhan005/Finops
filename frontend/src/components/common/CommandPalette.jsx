import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  Cloud,
  Server,
  GitCompare,
  Coins,
  ShieldAlert,
  Layers,
  Bot,
  Settings,
  Sun,
  Moon,
  DollarSign,
  RotateCcw,
  Upload,
  ArrowRight,
  Sparkles,
  Command,
  CornerDownLeft,
  X
} from 'lucide-react';
import AwsServiceIcon from './AwsServiceIcon';
import { getAwsServiceColor } from '../../utils/awsServiceColors';

export default function CommandPalette({
  isOpen,
  onClose,
  datasets = [],
  activeDataset,
  onSelectDataset,
  currency = 'USD',
  onToggleCurrency,
  darkMode,
  onToggleDarkMode,
  availableServices = [],
  onSelectService,
  onResetFilters
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();

  // Reset query and selected index on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global keyboard shortcut: Ctrl+K / Cmd+K and Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Trigger open via custom event or direct state in parent
        }
      }
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // All actionable commands
  const allCommands = useMemo(() => {
    const commands = [];

    // 1. Navigation Pages
    const pages = [
      { id: 'page-overview', title: 'Overview Dashboard', subtitle: 'Executive Spend & KPI Cockpit', icon: LayoutDashboard, category: 'Navigation', action: () => navigate('/app/overview') },
      { id: 'page-services', title: 'Services Explorer', subtitle: 'Cloud Service Allocation & Breakdowns', icon: Cloud, category: 'Navigation', action: () => navigate('/app/services') },
      { id: 'page-resources', title: 'Resource Explorer', subtitle: 'Deep Resource-Level CUR Audit', icon: Server, category: 'Navigation', action: () => navigate('/app/resources') },
      { id: 'page-comparison', title: 'Cost Changes & Root Cause', subtitle: 'Period-over-Period Delta Attribution', icon: GitCompare, category: 'Navigation', action: () => navigate('/app/comparison') },
      { id: 'page-recommendations', title: 'Commitments & Waste', subtitle: 'Idle Resources & SP Optimization', icon: Coins, category: 'Navigation', action: () => navigate('/app/recommendations') },
      { id: 'page-anomalies', title: 'Anomalies & Budgets', subtitle: 'Telemetry Spikes & Budget Guards', icon: ShieldAlert, category: 'Navigation', action: () => navigate('/app/anomalies') },
      { id: 'page-ledger', title: 'Savings Ledger', subtitle: 'Boardroom ROI & Realized Proof', icon: Layers, category: 'Navigation', action: () => navigate('/app/ledger') },
      { id: 'page-ai', title: 'Ask ZORVEX AI', subtitle: 'Natural Language FinOps Intelligence', icon: Bot, category: 'Navigation', action: () => navigate('/app/ai') },
      { id: 'page-settings', title: 'Settings & Cloud Accounts', subtitle: 'CUR Ingestion & Platform Config', icon: Settings, category: 'Navigation', action: () => navigate('/app/settings') },
    ];
    commands.push(...pages);

    // 2. AWS Services (Top or Available)
    const topServices = availableServices.length > 0 
      ? availableServices.slice(0, 10)
      : ['Amazon EC2', 'Amazon S3', 'Amazon RDS', 'Amazon CloudFront', 'AWS Lambda', 'Amazon OpenSearch', 'Amazon DynamoDB', 'AWS KMS'];

    topServices.forEach(svc => {
      commands.push({
        id: `svc-${svc}`,
        title: svc,
        subtitle: `Filter telemetry directly to ${svc}`,
        isService: true,
        serviceName: svc,
        category: 'AWS Services',
        action: () => {
          if (onSelectService) onSelectService(svc);
          else navigate(`/app/services?search=${encodeURIComponent(svc)}`);
        }
      });
    });

    // 3. Quick Actions
    commands.push({
      id: 'act-theme',
      title: darkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme',
      subtitle: darkMode ? 'Activate Alabaster Canvas with specularity' : 'Activate Obsidian Charcoal dark mode',
      icon: darkMode ? Sun : Moon,
      category: 'Quick Actions',
      action: () => onToggleDarkMode && onToggleDarkMode()
    });

    commands.push({
      id: 'act-currency',
      title: currency === 'USD' ? 'Switch Currency to INR (₹)' : 'Switch Currency to USD ($)',
      subtitle: currency === 'USD' ? 'Live Forex conversion (₹95.04/USD)' : 'Original AWS Billed Currency (USD)',
      icon: DollarSign,
      category: 'Quick Actions',
      action: () => onToggleCurrency && onToggleCurrency()
    });

    if (onResetFilters) {
      commands.push({
        id: 'act-reset',
        title: 'Reset All Active Filters',
        subtitle: 'Restore full date range, all services and accounts',
        icon: RotateCcw,
        category: 'Quick Actions',
        action: () => onResetFilters()
      });
    }

    return commands;
  }, [navigate, availableServices, darkMode, onToggleDarkMode, currency, onToggleCurrency, onSelectService, onResetFilters]);

  // Filtered commands based on user query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase().trim();
    return allCommands.filter(c => 
      c.title.toLowerCase().includes(q) ||
      (c.subtitle && c.subtitle.toLowerCase().includes(q)) ||
      (c.category && c.category.toLowerCase().includes(q)) ||
      (c.serviceName && c.serviceName.toLowerCase().includes(q))
    );
  }, [allCommands, query]);

  // Handle keyboard list navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl surface-raised rounded-3xl border border-zorvex-border/90 dark:border-zorvex-dark-border/90 shadow-surface-floating overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Top Header & Search Input */}
        <div className="p-4 border-b border-zorvex-border/60 dark:border-zorvex-dark-border/60 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl surface-recessed flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight flex-shrink-0">
            <Search className="w-4 h-4 stroke-[2.5]" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a page, AWS service, or action... (e.g. 'EC2', 'RDS', 'Dark')"
            className="flex-1 bg-transparent border-none outline-none text-sm font-semibold text-zorvex-text dark:text-zorvex-dark-text placeholder:text-zorvex-text-muted/70"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-zorvex-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md surface-recessed border border-zorvex-border/80 dark:border-zorvex-dark-border/80 text-zorvex-text-muted">
              ESC
            </kbd>
          )}
        </div>

        {/* Command Results List */}
        <div 
          ref={listRef}
          className="max-h-[380px] overflow-y-auto p-2 divide-y divide-zorvex-border/30 dark:divide-zorvex-dark-border/30"
        >
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-xs text-zorvex-text-muted">
              <Search className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <span>No matching pages or AWS services found for "{query}"</span>
            </div>
          ) : (
            filteredCommands.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;
              const serviceColor = item.isService ? getAwsServiceColor(item.serviceName) : null;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${
                    isSelected
                      ? 'surface-recessed border-l-4 border-zorvex-forest bg-zorvex-forest-soft/30 dark:bg-zorvex-forest-dark-soft/40 shadow-inner'
                      : 'hover:bg-slate-50/50 dark:hover:bg-slate-900/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div 
                      className="w-8 h-8 rounded-xl surface-raised flex items-center justify-center flex-shrink-0"
                      style={serviceColor ? { borderLeft: `3px solid ${serviceColor}` } : {}}
                    >
                      {item.isService ? (
                        <AwsServiceIcon service={item.serviceName} size="xs" className="w-4 h-4" />
                      ) : (
                        Icon && <Icon className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight stroke-[2.2]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text truncate flex items-center gap-2">
                        <span>{item.title}</span>
                        {item.category && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase tracking-wider surface-recessed text-zorvex-text-muted border border-zorvex-border/60 dark:border-zorvex-dark-border/60">
                            {item.category}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <div className="text-[11px] text-zorvex-text-muted truncate mt-0.5">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-zorvex-forest dark:text-zorvex-forest-highlight flex-shrink-0 ml-2">
                      <span>Jump</span>
                      <CornerDownLeft className="w-3 h-3 stroke-[2.5]" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="p-3 border-t border-zorvex-border/60 dark:border-zorvex-dark-border/60 surface-recessed flex items-center justify-between text-[10px] text-zorvex-text-muted font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/80 dark:border-zorvex-dark-border/80 font-mono font-bold">↑↓</kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/80 dark:border-zorvex-dark-border/80 font-mono font-bold">↵</kbd>
              <span>select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border/80 dark:border-zorvex-dark-border/80 font-mono font-bold">esc</kbd>
              <span>close</span>
            </span>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-wider text-zorvex-forest dark:text-zorvex-forest-highlight font-bold">
            Zorvex Spotlight
          </span>
        </div>
      </div>
    </div>
  );
}
