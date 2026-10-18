import React, { useState, lazy, Suspense } from 'react';
import { 
  Coins, 
  HardDrive, 
  Server, 
  Database, 
  Network, 
  Tag, 
  ChevronRight, 
  ChevronDown,
  Calculator,
  TrendingUp,
  ShieldCheck,
  Clock,
  Layers,
  Compass
} from 'lucide-react';

const SavingsPlanSimulator = lazy(() => import('./SavingsPlanSimulator'));

export default function RecommendationsView({ recommendations }) {
  const [expandedId, setExpandedId] = useState('');
  const [activeTab, setActiveTab] = useState('waste'); // 'waste' | 'simulator'

  if (!recommendations) return null;

  const recList = recommendations.recommendations || [];
  const totalSavings = recommendations.total_potential_savings || 0;

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Storage Optimization':
      case 'Storage Waste Optimization':
      case 'Modernization':
        return <HardDrive className="w-5 h-5 text-zorvex-spike stroke-[1.8]" />;
      case 'Compute Rightsizing':
      case 'Commitment Optimization':
        return <Server className="w-5 h-5 text-zorvex-warning stroke-[1.8]" />;
      case 'Database Architecture':
        return <Database className="w-5 h-5 text-zorvex-forest dark:text-zorvex-forest-highlight stroke-[1.8]" />;
      case 'Network & Data Transfer':
      case 'Network Optimization':
      case 'VPC & Networking':
        return <Network className="w-5 h-5 text-zorvex-forest dark:text-zorvex-forest-highlight stroke-[1.8]" />;
      case 'Governance & Tagging':
        return <Tag className="w-5 h-5 text-zorvex-forest dark:text-zorvex-forest-highlight stroke-[1.8]" />;
      default:
        return <Coins className="w-5 h-5 text-zorvex-forest dark:text-zorvex-forest-highlight stroke-[1.8]" />;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Tab Controls */}
      <div className="clay-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight">
              <Coins className="w-5 h-5 stroke-[1.8]" />
            </span>
            <h2 className="text-xl font-extrabold text-zorvex-text dark:text-zorvex-dark-text tracking-tight">
              ZORVEX Waste Detection & Remediation Hub
            </h2>
          </div>
          <p className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
            Automated FinOps heuristics pinpointing idle resources and architecture downgrade opportunities.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Segmented Tab Switcher */}
          <div className="flex items-center p-1.5 rounded-xl clay-track gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('waste')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'waste'
                  ? 'clay-pill-active'
                  : 'text-zorvex-text-muted dark:text-zorvex-dark-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Waste Hunter ({recList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'simulator'
                  ? 'clay-pill-active'
                  : 'text-zorvex-text-muted dark:text-zorvex-dark-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Savings Plan Simulator</span>
            </button>
          </div>

          {activeTab === 'waste' && (
            <div className="text-right pl-3 border-l border-zorvex-border dark:border-zorvex-dark-border">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                Realizable Savings
              </span>
              <div className="text-2xl font-extrabold text-zorvex-forest dark:text-zorvex-forest-highlight font-mono">
                ${totalSavings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted ml-1">/mo</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recommendations Cards */}
      {activeTab === 'waste' && (
        <div className="grid grid-cols-1 gap-6">
          {recList.map((rec) => {
            const isExpanded = expandedId === rec.id;

            return (
              <div key={rec.id} className="clay-card p-6 transition-all">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-zorvex-border dark:border-zorvex-dark-border">
                  <div className="flex items-start gap-3.5">
                    <div className="p-3 rounded-2xl bg-zorvex-secondary dark:bg-zorvex-dark-secondary text-zorvex-forest dark:text-zorvex-forest-highlight shadow-inner mt-0.5">
                      {getCategoryIcon(rec.category)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zorvex-text-muted dark:text-zorvex-dark-text-muted uppercase tracking-wider">
                          {rec.category}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          rec.severity === 'HIGH'
                            ? 'bg-zorvex-spike-soft dark:bg-zorvex-spike-dark-soft text-zorvex-spike border-zorvex-spike/30'
                            : rec.severity === 'MEDIUM'
                            ? 'bg-zorvex-warning-soft dark:bg-zorvex-warning-dark-soft text-zorvex-warning border-zorvex-warning/30'
                            : 'bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight border-zorvex-forest/30'
                        }`}>
                          {rec.severity} PRIORITY
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text mt-1">
                        {rec.title}
                      </h3>
                      <p className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-1 max-w-2xl leading-relaxed">
                        {rec.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex lg:flex-col items-center lg:items-end justify-between w-full lg:w-auto gap-2">
                    <div className="text-left lg:text-right">
                      <span className="text-[10px] font-bold uppercase text-zorvex-text-muted dark:text-zorvex-dark-text-muted">Potential Savings</span>
                      <div className="text-xl font-extrabold text-zorvex-forest dark:text-zorvex-forest-highlight font-mono">
                        ${rec.monthly_savings.toFixed(2)}
                        <span className="text-xs font-normal text-zorvex-text-muted dark:text-zorvex-dark-text-muted ml-0.5">/mo</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-zorvex-secondary dark:bg-zorvex-dark-secondary border border-zorvex-border dark:border-zorvex-dark-border text-zorvex-text dark:text-zorvex-dark-text">
                      {rec.affected_count} Affected
                    </span>
                  </div>
                </div>

                {/* Executive Remediation & AWS Console Action Bar */}
                <div className="mt-4 p-3.5 rounded-xl bg-zorvex-secondary/70 dark:bg-zorvex-dark-secondary/70 border border-zorvex-border dark:border-zorvex-dark-border flex flex-col gap-3">
                  {/* Top Badges & Target Resource Toggle */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* ROI Annual Savings Badge */}
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Annual ROI: ${(rec.annual_savings ?? (rec.monthly_savings * 12)).toFixed(2)}/yr</span>
                      </span>

                      {/* Risk Level Badge */}
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft border border-zorvex-forest/20 text-[11px] font-bold text-zorvex-forest dark:text-zorvex-forest-highlight">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{rec.risk_level || 'Zero Downtime (Safe)'}</span>
                      </span>

                      {/* Effort Level Badge */}
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{rec.effort_level || 'Low (~5 Mins)'}</span>
                      </span>
                    </div>

                    {/* Target Resources Toggle Button */}
                    {rec.resources?.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? '' : rec.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zorvex-card dark:bg-zorvex-dark-card hover:bg-zorvex-recessed dark:hover:bg-zorvex-dark-recessed border border-zorvex-border dark:border-zorvex-dark-border text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text transition-all cursor-pointer shadow-sm"
                      >
                        <Layers className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                        <span>{isExpanded ? 'Hide Target Resources' : `View Target Resources (${rec.affected_count || rec.resources.length})`}</span>
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  {/* Step-by-Step AWS Console Walkthrough Pill */}
                  {rec.console_steps && (
                    <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-zorvex-card/90 dark:bg-[#121914] border border-zorvex-border/80 dark:border-[#2D382D] text-xs">
                      <Compass className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted block mb-0.5">
                          AWS Management Console Guided Path:
                        </span>
                        <div className="font-medium text-zorvex-text dark:text-zinc-200 text-[11px] leading-relaxed">
                          {rec.console_steps}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Expandable Resource Drawer */}
                {isExpanded && rec.resources?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-zorvex-border dark:border-zorvex-dark-border">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted mb-2">
                      Sample Identified Resources:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {rec.resources.map((item, idx) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-zorvex-secondary/80 dark:bg-zorvex-dark-secondary/80 border border-zorvex-border dark:border-zorvex-dark-border text-xs">
                          <div className="font-mono font-bold text-zorvex-text dark:text-zorvex-dark-text truncate">
                            {item.resource_id}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-1">
                            <span>{item.name || 'unnamed'}</span>
                            <span className="font-mono font-bold text-zorvex-spike">${(item.cost || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* Simulator Tab Content */}
      {activeTab === 'simulator' && (
        <Suspense fallback={
          <div className="clay-card p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-zorvex-forest border-t-transparent animate-spin" />
            <span className="text-xs font-bold text-zorvex-text-secondary">Loading Commitment & Capacity Engine...</span>
          </div>
        }>
          <SavingsPlanSimulator />
        </Suspense>
      )}

    </div>
  );
}
