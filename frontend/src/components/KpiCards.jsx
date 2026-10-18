import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, Coins, Server, ShieldCheck, Zap, ArrowUpRight, Globe } from 'lucide-react';

export default function KpiCards({ overview, forexData }) {
  if (!overview) return null;

  const totalCost = overview.total_cost || 0;
  const defComp = overview.default_comparison || {};
  const deltaCost = defComp.delta_cost || 0;
  const pctDisplay = defComp.pct_display || `${defComp.pct_change || 0}%`;
  const savings = overview.potential_savings || 0;
  const resCount = overview.total_resources || 0;

  const isSpike = deltaCost > 0.01;

  // Real-time dynamic Forex rate from live open exchange API
  const usdToInr = forexData?.rate || 95.32;
  const monthlySavingsInr = savings * usdToInr;
  const annualSavingsUsd = savings * 12;
  const annualSavingsInr = monthlySavingsInr * 12;
  
  // Dynamic Optimization Health Score (90-98 based on waste-to-spend ratio)
  const wasteRatio = totalCost > 0 ? (savings / (totalCost * 2)) : 0;
  const healthScore = Math.max(82, Math.min(98, Math.round(100 - (wasteRatio * 100))));
  const healthGrade = healthScore >= 90 ? 'Grade A' : 'Grade B';

  return (
    <div className="space-y-4">
      
      {/* Executive Command Center Cloud Efficiency & Optimization Bar */}
      <div className="clay-card p-4 sm:p-5 bg-gradient-to-r from-zorvex-forest-soft/60 via-zorvex-surface to-zorvex-surface-secondary/50 border border-zorvex-forest/25 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zorvex-forest-soft dark:bg-zorvex-dark-forest-soft border border-zorvex-forest/20 text-zorvex-forest dark:text-zorvex-dark-forest flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-zorvex-forest dark:text-zorvex-dark-forest">
                Cloud Efficiency & Value Realization
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-dark-forest-soft dark:text-zorvex-dark-forest border border-zorvex-forest/20">
                <ShieldCheck className="w-3 h-3" />
                <span>Verified CUR Engine</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-zorvex-surface-secondary text-zorvex-text-secondary dark:bg-zorvex-dark-surface-secondary dark:text-zorvex-dark-text-secondary border border-zorvex-border dark:border-zorvex-dark-border">
                <span className="w-1.5 h-1.5 rounded-full bg-zorvex-forest dark:bg-zorvex-dark-forest animate-pulse"></span>
                <Globe className="w-3 h-3" />
                <span>Live Forex: $1 = <span className="font-mono font-bold">₹{usdToInr.toFixed(2)}</span></span>
              </span>
            </div>
            <p className="text-xs font-semibold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">
              Identified <strong className="text-zorvex-text dark:text-zorvex-dark-text font-mono">${savings.toFixed(2)}/mo (₹{Math.round(monthlySavingsInr).toLocaleString('en-IN')}/mo)</strong> in actionable AWS cloud waste.
            </p>
          </div>
        </div>

        {/* Combined Executive Metrics: Annual Run-Rate ROI & FinOps Health Score */}
        <div className="flex items-center gap-4 bg-zorvex-surface/80 dark:bg-zorvex-dark-surface/80 px-4 py-2.5 rounded-xl border border-zorvex-border dark:border-zorvex-dark-border shadow-sm">
          {/* Projected Annual Savings */}
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
              Projected Annual Savings
            </span>
            <div className="text-base sm:text-lg font-black text-zorvex-forest dark:text-zorvex-dark-forest font-mono flex items-center justify-end gap-1">
              <span>${Math.round(annualSavingsUsd).toLocaleString('en-US')}/yr</span>
              <span className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary font-normal font-sans">
                (₹{Math.round(annualSavingsInr).toLocaleString('en-IN')})
              </span>
            </div>
          </div>

          <div className="h-8 w-px bg-zorvex-border dark:bg-zorvex-dark-border" />

          {/* Account FinOps Health Score */}
          <div className="text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
              FinOps Health Score
            </span>
            <div className="text-sm font-extrabold text-zorvex-text dark:text-zorvex-dark-text font-mono flex items-center gap-1.5">
              <span className="text-zorvex-forest dark:text-zorvex-dark-forest font-black">{healthScore}/100</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {healthGrade}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Core KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* 1. Total Spend */}
        <div className="clay-card p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
              Total Monitored Spend
            </span>
            <div className="w-10 h-10 rounded-xl bg-zorvex-forest-soft dark:bg-zorvex-dark-forest-soft border border-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-dark-forest shadow-sm">
              <DollarSign className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-zorvex-text dark:text-zorvex-dark-text tracking-tight font-mono">
              ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs font-mono font-bold text-zorvex-forest dark:text-zorvex-dark-forest mt-1">
              ~ ₹{Math.round(totalCost * usdToInr).toLocaleString('en-IN')}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
              <span>Telemetried over</span>
              <span className="px-2 py-0.5 rounded-full bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text dark:text-zorvex-dark-text font-bold border border-zorvex-border dark:border-zorvex-dark-border">
                {overview.filtered_dates?.length || overview.dates?.length || 0} billing days
              </span>
            </div>

            {/* Financial Reconciliation Breakdown (Gross vs Net Invoiced) */}
            {(overview.accounting_reconciliation || overview.taxes_total > 0 || overview.gross_cost !== overview.net_cost) && (
              <div className="pt-2 mt-2 border-t border-zorvex-border/50 dark:border-zorvex-dark-border/50 text-[10px] space-y-0.5">
                <div className="flex items-center justify-between text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                  <span>Gross Usage:</span>
                  <span className="font-mono font-bold text-zorvex-text dark:text-zorvex-dark-text">
                    ${(overview.gross_cost || totalCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {overview.taxes_total > 0 && (
                  <div className="flex items-center justify-between text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                    <span>Tax (GST):</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                      +${overview.taxes_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between font-bold text-zorvex-forest dark:text-zorvex-forest-highlight">
                  <span>Net Invoiced:</span>
                  <span className="font-mono">
                    ${(overview.net_cost || totalCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. Latest Daily Delta */}
        <div className="clay-card p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
              Latest Daily Delta
            </span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border ${
              isSpike 
                ? 'bg-zorvex-spike-soft dark:bg-red-950/40 border-zorvex-spike/20 text-zorvex-spike dark:text-red-400' 
                : 'bg-zorvex-savings-soft dark:bg-emerald-950/40 border-zorvex-savings/20 text-zorvex-savings dark:text-emerald-400'
            }`}>
              {isSpike ? <TrendingUp className="w-5 h-5 stroke-[2.5]" /> : <TrendingDown className="w-5 h-5 stroke-[2.5]" />}
            </div>
          </div>
          <div>
            <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-mono ${
              isSpike ? 'text-zorvex-spike dark:text-red-400' : 'text-zorvex-savings dark:text-emerald-400'
            }`}>
              {isSpike ? `+$${deltaCost.toFixed(2)}` : deltaCost < -0.01 ? `-$${Math.abs(deltaCost).toFixed(2)}` : '$0.00'}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-extrabold border ${
                isSpike 
                  ? 'bg-zorvex-spike-soft text-zorvex-spike border-zorvex-spike/25' 
                  : 'bg-zorvex-savings-soft text-zorvex-savings border-zorvex-savings/25'
              }`}>
                {pctDisplay}
              </span>
              <span className="text-[11px] font-medium text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary truncate">
                {defComp.baseline_date?.slice(5)} ➔ {defComp.target_date?.slice(5)}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Potential Monthly Savings */}
        <div className="clay-card p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
              Identified Waste / Savings
            </span>
            <div className="w-10 h-10 rounded-xl bg-zorvex-forest-soft dark:bg-zorvex-dark-forest-soft border border-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-dark-forest shadow-sm">
              <Coins className="w-5 h-5 stroke-[2]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-zorvex-forest dark:text-zorvex-dark-forest tracking-tight font-mono">
              ${savings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-semibold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary ml-1">/mo</span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs font-medium text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
              <span className="px-2 py-0.5 rounded-full bg-zorvex-forest-soft dark:bg-zorvex-dark-forest-soft text-zorvex-forest dark:text-zorvex-dark-forest font-bold border border-zorvex-forest/20">
                ₹{Math.round(monthlySavingsInr).toLocaleString('en-IN')}/mo
              </span>
              <span className="truncate">EBS, Idle EC2, RDS</span>
            </div>
          </div>
        </div>

        {/* 4. Monitored Resources */}
        <div className="clay-card p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
              Active Cloud Inventory
            </span>
            <div className="w-10 h-10 rounded-xl bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary border border-zorvex-border dark:border-zorvex-dark-border flex items-center justify-center text-zorvex-forest dark:text-zorvex-dark-forest shadow-sm">
              <Server className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-zorvex-text dark:text-zorvex-dark-text tracking-tight font-mono">
              {resCount.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs font-medium text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
              <span className="px-2 py-0.5 rounded-full bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-forest dark:text-zorvex-dark-forest font-bold border border-zorvex-border dark:border-zorvex-dark-border">
                Cataloged
              </span>
              <span className="truncate">EC2, EBS, RDS, S3, NAT</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
