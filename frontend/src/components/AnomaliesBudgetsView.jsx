import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, CheckCircle, ShieldAlert, TrendingUp, DollarSign, 
  Target, Calendar, Plus, Trash2, ArrowUpRight, Check, X, Clock, HelpCircle
} from 'lucide-react';
import { api } from '../services/api';

export default function AnomaliesBudgetsView({ overview }) {
  const [anomalies, setAnomalies] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Create budget modal
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [newBudgetName, setNewBudgetName] = useState('');
  const [newBudgetScope, setNewBudgetScope] = useState('WORKSPACE');
  const [newBudgetVal, setNewBudgetVal] = useState('all');
  const [newBudgetAmount, setNewBudgetAmount] = useState(3000);
  const [newBudgetThreshold, setNewBudgetThreshold] = useState(80);

  const [actionSuccess, setActionSuccess] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [anomData, fcData, bgData] = await Promise.all([
        api.getAnomalies(),
        api.getForecast(),
        api.getBudgets()
      ]);
      setAnomalies(anomData);
      setForecast(fcData);
      setBudgets(bgData);
    } catch (err) {
      console.error(err);
      setError('Could not load anomaly and budget telemetry. Check engine connectivity.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAcknowledge = async (alertId) => {
    try {
      await api.acknowledgeAnomaly(alertId, 'Lead FinOps Architect');
      setActionSuccess('Anomaly acknowledged. Flagged for architectural review.');
      setTimeout(() => setActionSuccess(''), 4000);
      loadData();
    } catch (err) {
      alert(err.message || 'Action failed');
    }
  };

  const handleResolve = async (alertId) => {
    const note = prompt('Enter resolution notes (e.g. Instance stopped, dev schedule fixed):');
    if (note === null) return;
    try {
      await api.resolveAnomaly(alertId, 'Lead FinOps Architect', note);
      setActionSuccess('Anomaly marked resolved with audit log.');
      setTimeout(() => setActionSuccess(''), 4000);
      loadData();
    } catch (err) {
      alert(err.message || 'Action failed');
    }
  };

  const handleCreateBudget = async (e) => {
    e.preventDefault();
    try {
      await api.createBudget({
        name: newBudgetName,
        scope_type: newBudgetScope,
        scope_value: newBudgetVal,
        monthly_budget_usd: parseFloat(newBudgetAmount),
        alert_threshold_pct: parseFloat(newBudgetThreshold)
      });
      setShowAddBudget(false);
      setNewBudgetName('');
      setActionSuccess('Budget threshold guard active.');
      setTimeout(() => setActionSuccess(''), 4000);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to create budget');
    }
  };

  const handleDeleteBudget = async (id) => {
    if (!confirm('Are you sure you want to remove this budget guard?')) return;
    try {
      await api.deleteBudget(id);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to delete budget');
    }
  };

  const openAnomalies = anomalies.filter(a => a.status === 'OPEN');
  const criticalCount = anomalies.filter(a => a.severity === 'CRITICAL' && a.status === 'OPEN').length;

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Header Banner */}
      <div className="clay-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-zorvex-forest/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight">
              <ShieldAlert className="w-5 h-5 stroke-[2.2]" />
            </span>
            <h1 className="text-xl font-black text-zorvex-text dark:text-zorvex-dark-text tracking-tight">
              Intelligent Cost Anomalies & Budget Guard
            </h1>
          </div>
          <p className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-1">
            Statistical Z-score variance detection and explainable run-rate projections derived directly from AWS CUR line items.
          </p>
        </div>

        <button
          onClick={() => setShowAddBudget(true)}
          className="flex items-center gap-2 px-4 py-2.5 clay-button-primary text-xs font-black flex-shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Budget Guard</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* 3 Executive Forecast & Runway Cards */}
      {forecast && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Projected Month-End */}
          <div className="clay-card p-5 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                Forecasted Month-End Spend
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight border border-zorvex-forest/25">
                {forecast.period_month}
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-zorvex-text dark:text-zorvex-dark-text">
              ${forecast.forecasted_month_end_usd?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs font-mono font-bold text-zorvex-forest dark:text-zorvex-forest-highlight">
              ~ ₹{Math.round(forecast.forecasted_month_end_inr || 0).toLocaleString('en-IN')}
            </div>
            <p className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
              Observed {forecast.days_observed} days • {forecast.days_remaining} days remaining in billing cycle.
            </p>
          </div>

          {/* Card 2: Daily Run-Rate */}
          <div className="clay-card p-5 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                Current Daily Burn Rate
              </span>
              <TrendingUp className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
            </div>
            <div className="text-2xl font-black font-mono text-zorvex-text dark:text-zorvex-dark-text">
              ${forecast.daily_burn_rate_usd?.toFixed(2)}
              <span className="text-xs font-normal text-zorvex-text-muted dark:text-zorvex-dark-text-muted"> / day</span>
            </div>
            <div className="text-xs font-mono font-bold text-zorvex-forest dark:text-zorvex-forest-highlight">
              ~ ₹{Math.round((forecast.daily_burn_rate_usd || 0) * (forecast.usd_to_inr_rate || 95.32)).toLocaleString('en-IN')} / day
            </div>
            <p className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
              Weighted moving average (60% weight on recent days).
            </p>
          </div>

          {/* Card 3: 90% Statistical Confidence Range */}
          <div className="clay-card p-5 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                90% Confidence Band
              </span>
              <span className="text-[10px] font-bold text-zorvex-forest dark:text-zorvex-forest-highlight font-mono">
                Statistical Range
              </span>
            </div>
            <div className="text-lg font-black font-mono text-zorvex-text dark:text-zorvex-dark-text">
              ${forecast.confidence_low_usd?.toLocaleString()} – ${forecast.confidence_high_usd?.toLocaleString()}
            </div>
            <div className="w-full bg-zorvex-secondary dark:bg-zorvex-dark-secondary h-2 rounded-full overflow-hidden mt-2 shadow-inner">
              <div 
                className="bg-gradient-to-r from-zorvex-forest to-zorvex-forest-highlight h-full rounded-full" 
                style={{ width: `${Math.min(100, Math.round((forecast.actual_spend_to_date_usd / Math.max(1, forecast.forecasted_month_end_usd)) * 100))}%` }}
              />
            </div>
            <p className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
              Actual to date: <span className="font-mono">${forecast.actual_spend_to_date_usd?.toFixed(2)}</span> ({Math.round((forecast.actual_spend_to_date_usd / Math.max(1, forecast.forecasted_month_end_usd)) * 100)}% consumed).
            </p>
          </div>

        </div>
      )}

      {/* Cost Anomalies Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-zorvex-text dark:text-zorvex-dark-text">
              Detected Cost Anomalies
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
              {openAnomalies.length} Open
            </span>
            {criticalCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-red-600 text-white animate-pulse">
                {criticalCount} Critical
              </span>
            )}
          </div>
          <span className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
            Z-score &gt; 1.8σ or &gt;25% Shift
          </span>
        </div>

        {anomalies.length === 0 ? (
          <div className="clay-card p-8 text-center space-y-2">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="text-sm font-black text-zorvex-text dark:text-zorvex-dark-text">Zero Anomalies Detected</h4>
            <p className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted max-w-md mx-auto">
              Your historical CUR records show predictable steady-state run-rate with no statistically anomalous daily spikes.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {anomalies.map((anom) => (
              <div 
                key={anom.id}
                className={`clay-card p-5 border transition-all ${
                  anom.status === 'RESOLVED' 
                    ? 'opacity-60 bg-zorvex-secondary/40 dark:bg-zorvex-dark-secondary/30 border-zorvex-border dark:border-zorvex-dark-border' 
                    : anom.severity === 'CRITICAL'
                    ? 'border-rose-500/50 bg-rose-500/5 dark:bg-rose-950/20'
                    : 'border-zorvex-border dark:border-zorvex-dark-border'
                }`}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        anom.severity === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40'
                          : anom.severity === 'WARNING'
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                          : 'bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight border border-zorvex-forest/25'
                      }`}>
                        {anom.severity} ANOMALY
                      </span>
                      <span className="text-xs font-black text-zorvex-text dark:text-zorvex-dark-text">
                        {anom.service}
                      </span>
                      <span className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                        • Observed Date: <strong>{anom.date}</strong>
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        anom.status === 'RESOLVED'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : anom.status === 'ACKNOWLEDGED'
                          ? 'bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight'
                          : 'bg-amber-500/15 text-amber-600'
                      }`}>
                        {anom.status}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-zorvex-text dark:text-zorvex-dark-text leading-relaxed">
                      {anom.root_cause_summary}
                    </p>

                    {/* Contributing resource drivers */}
                    {anom.evidence?.top_drivers?.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                        <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text">Top Drivers:</span>
                        {anom.evidence.top_drivers.map((d, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-md bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border font-mono text-[10px]">
                            {d.resource_id} (+${d.day_spend_usd})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Financial Metrics */}
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-sm font-black font-mono text-rose-600 dark:text-rose-400">
                        +${anom.delta_usd.toFixed(2)} (+{anom.delta_pct}%)
                      </div>
                      <div className="text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted font-mono">
                        Base: ${anom.baseline_spend_usd.toFixed(2)} ➔ Actual: ${anom.actual_spend_usd.toFixed(2)}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {anom.status === 'OPEN' && (
                        <button
                          onClick={() => handleAcknowledge(anom.id)}
                          className="clay-button px-3 py-1.5 rounded-lg text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text transition-all cursor-pointer"
                        >
                          Acknowledge
                        </button>
                      )}
                      {anom.status !== 'RESOLVED' && (
                        <button
                          onClick={() => handleResolve(anom.id)}
                          className="clay-button-primary px-3 py-1.5 rounded-lg text-xs font-black shadow-sm transition-all cursor-pointer"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Budget Guard Section */}
      <div className="space-y-4 pt-4 border-t border-zorvex-border dark:border-zorvex-dark-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-zorvex-text dark:text-zorvex-dark-text">
              Active Budget Guardrails
            </h2>
            <p className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
              Proactive threshold monitoring with day-of-month breach timeline.
            </p>
          </div>
        </div>

        {budgets.length === 0 ? (
          <div className="clay-card p-6 text-center space-y-2">
            <Target className="w-8 h-8 text-zorvex-forest dark:text-zorvex-forest-highlight mx-auto opacity-70" />
            <p className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted font-semibold">
              No budget limits configured yet. Click "New Budget Guard" above to set spending caps.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {budgets.map((b) => (
              <div key={b.id} className="clay-card p-5 space-y-3 relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                    <span className="text-xs font-black text-zorvex-text dark:text-zorvex-dark-text">
                      {b.name}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleDeleteBudget(b.id)}
                    className="p-1 rounded text-zorvex-text-muted hover:text-rose-500 transition-colors"
                    title="Remove budget"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-baseline justify-between font-mono">
                  <div>
                    <span className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                      ${b.current_spend_usd.toLocaleString()}
                    </span>
                    <span className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted"> / ${b.monthly_budget_usd.toLocaleString()}</span>
                  </div>
                  <span className={`text-xs font-black ${
                    b.status === 'BREACHED' || b.status === 'FORECASTED_BREACH'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-zorvex-forest dark:text-zorvex-forest-highlight'
                  }`}>
                    {b.current_spend_pct}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-zorvex-secondary dark:bg-zorvex-dark-secondary h-2.5 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      b.status === 'BREACHED' 
                        ? 'bg-rose-600' 
                        : b.status === 'FORECASTED_BREACH'
                        ? 'bg-amber-500'
                        : 'bg-gradient-to-r from-zorvex-forest to-zorvex-forest-highlight'
                    }`}
                    style={{ width: `${Math.min(100, b.current_spend_pct)}%` }}
                  />
                </div>

                {/* Breach Warning or Safe Badge */}
                <div className="text-[11px] pt-1">
                  {b.is_current_breached || b.status === 'BREACHED' ? (
                    <div className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        Budget limit exceeded! Actual spend <span className="font-mono">${b.current_spend_usd.toLocaleString()}</span> exceeds ${b.monthly_budget_usd.toLocaleString()} limit.
                      </span>
                    </div>
                  ) : b.status === 'FORECASTED_BREACH' || b.is_breached ? (
                    <div className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        Projected breach on Day {b.projected_breach_day || '—'} (Forecast: <span className="font-mono">${b.forecasted_spend_usd.toLocaleString()}</span>).
                      </span>
                    </div>
                  ) : (
                    <div className="text-zorvex-forest dark:text-zorvex-forest-highlight font-bold flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Within safe operating parameters.</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Budget Modal */}
      {showAddBudget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="clay-card max-w-md w-full p-6 space-y-4 bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-zorvex-border dark:border-zorvex-dark-border">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                <h3 className="text-sm font-black text-zorvex-text dark:text-zorvex-dark-text">
                  Configure New Budget Guard
                </h3>
              </div>
              <button 
                onClick={() => setShowAddBudget(false)}
                className="p-1 rounded-lg text-zorvex-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBudget} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-zorvex-text dark:text-zorvex-dark-text mb-1">
                  Budget Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. EC2 Production Cap"
                  value={newBudgetName}
                  onChange={(e) => setNewBudgetName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zorvex-secondary dark:bg-zorvex-dark-secondary border border-zorvex-border dark:border-zorvex-dark-border text-zorvex-text dark:text-zorvex-dark-text font-medium focus:outline-none focus:ring-1 focus:ring-zorvex-forest"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zorvex-text dark:text-zorvex-dark-text mb-1">
                    Monthly Cap (USD)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newBudgetAmount}
                    onChange={(e) => setNewBudgetAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zorvex-secondary dark:bg-zorvex-dark-secondary border border-zorvex-border dark:border-zorvex-dark-border text-zorvex-text dark:text-zorvex-dark-text font-mono font-bold focus:outline-none focus:ring-1 focus:ring-zorvex-forest"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zorvex-text dark:text-zorvex-dark-text mb-1">
                    Alert Threshold (%)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    required
                    value={newBudgetThreshold}
                    onChange={(e) => setNewBudgetThreshold(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zorvex-secondary dark:bg-zorvex-dark-secondary border border-zorvex-border dark:border-zorvex-dark-border text-zorvex-text dark:text-zorvex-dark-text font-mono font-bold focus:outline-none focus:ring-1 focus:ring-zorvex-forest"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddBudget(false)}
                  className="px-4 py-2 rounded-xl clay-button text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 clay-button-primary text-xs font-black"
                >
                  Save Budget Guard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
