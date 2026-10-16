import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, CheckCircle2, Clock, Check, X, ArrowUpRight, Zap, 
  Filter, FileSpreadsheet, Layers, Coins, Server, RefreshCw
} from 'lucide-react';
import { api } from '../services/api';

export default function SavingsLedgerView() {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [actionSuccess, setActionSuccess] = useState('');

  const loadLedger = async () => {
    setLoading(true);
    try {
      const [recs, sum] = await Promise.all([
        api.getLedgerRecords(statusFilter, categoryFilter),
        api.getLedgerSummary()
      ]);
      setRecords(recs);
      setSummary(sum);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, [statusFilter, categoryFilter]);

  const handleStatusChange = async (recId, newStatus) => {
    try {
      await api.updateRecommendationStatus(recId, newStatus, 'Lead FinOps Architect');
      setActionSuccess(`Recommendation transitioned to ${newStatus}.`);
      setTimeout(() => setActionSuccess(''), 4000);
      loadLedger();
    } catch (err) {
      alert(err.message || 'Status transition failed');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Header Banner */}
      <div className="clay-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-zorvex-forest/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight">
              <Layers className="w-5 h-5 stroke-[2.2]" />
            </span>
            <h1 className="text-xl font-black text-zorvex-text dark:text-zorvex-dark-text tracking-tight">
              Executive Savings Ledger & Audit Trail
            </h1>
          </div>
          <p className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-1">
            Institutional lifecycle tracking: Identified ➔ Approved ➔ Implemented ➔ Billing-Verified. Deduplicates overlapping compute recommendations.
          </p>
        </div>

        <button
          onClick={loadLedger}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl clay-button text-xs font-bold flex-shrink-0 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {summary && (
        <div className="clay-card p-5 sm:p-6 bg-gradient-to-r from-zorvex-forest-soft/60 via-zorvex-secondary/40 to-zorvex-forest-soft/30 dark:from-zorvex-forest-dark-soft/40 dark:via-zorvex-dark-secondary dark:to-zorvex-forest-dark-soft/20 border border-zorvex-forest/30 space-y-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-zorvex-forest/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft border border-zorvex-forest/30 text-zorvex-forest dark:text-zorvex-forest-highlight flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-zorvex-forest dark:text-zorvex-forest-highlight">
                  Boardroom Value Realization Proof
                </span>
                <p className="text-xs font-semibold text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-0.5">
                  {(summary.total_implemented_monthly_inr || 0) > 0 ? (
                    summary.net_monthly_client_value_inr >= 0 ? (
                      <>Platform fee fully offset with a <strong className="text-zorvex-forest dark:text-zorvex-forest-highlight font-mono">{summary.realized_roi_multiplier}x Realized ROI</strong> against your retainer.</>
                    ) : (
                      <>Progressing realization: <strong className="font-mono">{summary.realized_roi_multiplier}x Realized</strong> (<strong className="text-zorvex-forest dark:text-zorvex-forest-highlight font-mono">{summary.potential_roi_multiplier}x Potential Pipeline</strong>).</>
                    )
                  ) : (
                    <>Identified pipeline: <strong className="text-zorvex-forest dark:text-zorvex-forest-highlight font-mono">{summary.potential_roi_multiplier}x Potential ROI</strong> ({summary.total_recommendations_count} actions cataloged). Implementation pending approval.</>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 bg-zorvex-surface/80 dark:bg-zorvex-dark-surface/80 px-4 py-2 rounded-xl border border-zorvex-border dark:border-zorvex-dark-border shadow-clay-sm">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                  Monthly Retainer Fee
                </span>
                <div className="text-sm font-black font-mono text-zorvex-text dark:text-zorvex-dark-text">
                  ₹{summary.monthly_platform_retainer_inr.toLocaleString()} <span className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted">(${summary.monthly_platform_retainer_usd}/mo)</span>
                </div>
              </div>
              <div className="h-8 w-px bg-zorvex-border dark:bg-zorvex-dark-border" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                  Net Realized Value
                </span>
                <div className={`text-sm font-black font-mono ${summary.net_monthly_client_value_inr >= 0 ? 'text-zorvex-forest dark:text-zorvex-forest-highlight' : 'text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary'}`}>
                  {summary.net_monthly_client_value_inr >= 0 
                    ? `+₹${Math.round(summary.net_monthly_client_value_inr).toLocaleString()}/mo` 
                    : `-₹${Math.abs(Math.round(summary.net_monthly_client_value_inr)).toLocaleString()}/mo`}
                </div>
              </div>
            </div>
          </div>

          {/* 4 Summary Stage Pillars */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <div className="p-3.5 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                1. Identified
              </span>
              <div className="text-lg font-black font-mono text-zorvex-warning mt-1">
                ${summary.total_identified_monthly_usd?.toLocaleString()}
              </div>
              <div className="text-[10px] font-mono text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                ~ ₹{Math.round(summary.total_identified_monthly_inr || 0).toLocaleString()} / mo
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                2. Approved
              </span>
              <div className="text-lg font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
                ${summary.total_approved_monthly_usd?.toLocaleString()}
              </div>
              <div className="text-[10px] font-mono text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                ~ ₹{Math.round(summary.total_approved_monthly_inr || 0).toLocaleString()} / mo
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                3. Implemented
              </span>
              <div className="text-lg font-black font-mono text-zorvex-forest dark:text-zorvex-forest-highlight mt-1">
                ${summary.total_implemented_monthly_usd?.toLocaleString()}
              </div>
              <div className="text-[10px] font-mono text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                ~ ₹{Math.round(summary.total_implemented_monthly_inr || 0).toLocaleString()} / mo
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                4. Billing-Verified
              </span>
              <div className="text-lg font-black font-mono text-zorvex-forest dark:text-zorvex-forest-highlight mt-1">
                ${summary.total_verified_monthly_usd?.toLocaleString()}
              </div>
              <div className="text-[10px] font-mono text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                ~ ₹{Math.round(summary.total_verified_monthly_inr || 0).toLocaleString()} / mo
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Filter and Table Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-zorvex-text-muted dark:text-zorvex-dark-text-muted flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter Status:</span>
          </span>
          {['all', 'IDENTIFIED', 'APPROVED', 'IMPLEMENTED', 'VERIFIED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 text-xs font-black transition-all cursor-pointer rounded-clay-pill ${
                statusFilter === st
                  ? 'clay-pill-active'
                  : 'clay-pill clay-button text-zorvex-text-muted dark:text-zorvex-dark-text-muted'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="text-xs font-bold text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
          Showing <strong className="text-zorvex-text dark:text-zorvex-dark-text font-mono">{records.length}</strong> ledger records
        </div>
      </div>

      {/* Ledger Records Table */}
      <div className="clay-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zorvex-secondary/60 dark:bg-zorvex-dark-secondary text-zorvex-text-muted dark:text-zorvex-dark-text-muted font-bold uppercase tracking-wider text-[10px] border-b border-zorvex-border dark:border-zorvex-dark-border">
              <tr>
                <th className="py-3 px-4">Opportunity & Resource</th>
                <th className="py-3 px-4">Service / Region</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Projected Savings</th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4 text-right">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zorvex-border/60 dark:divide-zorvex-dark-border/60 font-medium">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-zorvex-secondary/40 dark:hover:bg-zorvex-dark-secondary/60 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-black text-zorvex-text dark:text-zorvex-dark-text">
                      {r.title}
                    </div>
                    <div className="text-[11px] font-mono text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-0.5">
                      {r.resource_id}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="font-bold text-zorvex-text dark:text-zorvex-dark-text">{r.service}</div>
                    <div className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted">{r.region} • <span className="font-mono">{r.account_id}</span></div>
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      r.status === 'VERIFIED'
                        ? 'bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight border-zorvex-forest/40'
                        : r.status === 'IMPLEMENTED'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        : r.status === 'APPROVED'
                        ? 'bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight border-zorvex-forest/25'
                        : r.status === 'DISMISSED'
                        ? 'bg-zorvex-text-muted/15 text-zorvex-text-muted dark:text-zorvex-dark-text-muted border-zorvex-text-muted/30'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                    }`}>
                      {r.status}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold">
                    <div className="text-zorvex-forest dark:text-zorvex-forest-highlight">
                      ${r.estimated_monthly_savings_usd.toFixed(2)}/mo
                    </div>
                    <div className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                      ~ ₹{Math.round(r.estimated_monthly_savings_inr).toLocaleString()}/mo
                    </div>
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="font-bold font-mono text-zorvex-text dark:text-zorvex-dark-text">
                      {Math.round(r.confidence_score * 100)}%
                    </div>
                    <div className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted">{r.risk_level} Risk</div>
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {r.status === 'IDENTIFIED' && (
                        <button
                          onClick={() => handleStatusChange(r.recommendation_id, 'APPROVED')}
                          className="px-2.5 py-1 rounded-lg clay-button-primary text-xs font-black shadow-sm transition-all cursor-pointer"
                        >
                          Approve
                        </button>
                      )}
                      {r.status === 'APPROVED' && (
                        <button
                          onClick={() => handleStatusChange(r.recommendation_id, 'IMPLEMENTED')}
                          className="px-2.5 py-1 rounded-lg clay-button-primary text-xs font-black shadow-sm transition-all cursor-pointer"
                        >
                          Mark Implemented
                        </button>
                      )}
                      {r.status === 'IMPLEMENTED' && (
                        <button
                          onClick={() => handleStatusChange(r.recommendation_id, 'VERIFIED')}
                          className="px-2.5 py-1 rounded-lg clay-button-primary text-xs font-black shadow-sm transition-all cursor-pointer"
                        >
                          Verify in CUR
                        </button>
                      )}
                      {r.status !== 'DISMISSED' && (
                        <button
                          onClick={() => handleStatusChange(r.recommendation_id, 'DISMISSED')}
                          className="p-1 rounded text-zorvex-text-muted hover:text-rose-500 transition-colors"
                          title="Dismiss opportunity"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
