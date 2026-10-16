import React, { useState, useEffect } from 'react';
import { 
  TrendingDown, 
  TrendingUp, 
  Gauge, 
  Settings2, 
  Check, 
  AlertCircle, 
  X, 
  DollarSign, 
  Sparkles, 
  Layers 
} from 'lucide-react';
import { api } from '../../services/api';

export default function UnitEconomicsCard({ totalCost }) {
  const [data, setData] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Edit form state
  const [metricName, setMetricName] = useState('Monthly Active Users (MAU)');
  const [metricUnit, setMetricUnit] = useState('Users');
  const [currentVolume, setCurrentVolume] = useState('25000');
  const [previousVolume, setPreviousVolume] = useState('18000');
  const [targetCost, setTargetCost] = useState('0.10');

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const res = await api.getUnitEconomics();
      setData(res);
      setMetricName(res.metric_name);
      setMetricUnit(res.metric_unit);
      setCurrentVolume(res.current_volume?.toString() || '25000');
      setPreviousVolume(res.previous_volume?.toString() || '18000');
      setTargetCost(res.target_unit_cost?.toString() || '0.10');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [totalCost]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await api.saveUnitEconomics({
        metric_name: metricName,
        metric_unit: metricUnit,
        current_volume: parseFloat(currentVolume) || 1.0,
        previous_volume: parseFloat(previousVolume) || 1.0,
        target_unit_cost: parseFloat(targetCost) || 0.10
      });
      setData(updated);
      setModalOpen(false);
    } catch (err) {
      setError(err.message || 'Failed to save unit economics');
    } finally {
      setSaving(false);
    }
  };

  if (!data) return null;

  return (
    <>
      {/* Unit Economics Highlight Banner Card */}
      <div className="clay-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-gradient-to-r from-zorvex-surface via-zorvex-surface-secondary/40 to-zorvex-surface border border-zorvex-border dark:border-zorvex-dark-border">
        
        {/* Left Info */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-zorvex-forest-soft dark:bg-zorvex-dark-forest-soft text-zorvex-forest dark:text-zorvex-dark-forest flex items-center justify-center flex-shrink-0 shadow-inner">
            <Gauge className="w-6 h-6 stroke-[2.2]" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-zorvex-forest dark:text-zorvex-dark-forest">
                Business Unit Economics
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                data.is_improving
                  ? 'bg-zorvex-savings-soft text-zorvex-savings dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'bg-zorvex-spike-soft text-zorvex-spike dark:bg-red-950/40 dark:text-red-400'
              }`}>
                {data.is_improving ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{data.efficiency_gain_pct > 0 ? `+${data.efficiency_gain_pct}%` : `${data.efficiency_gain_pct}%`} Efficiency</span>
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black font-mono text-zorvex-text dark:text-zorvex-dark-text">
                ${data.current_unit_cost?.toFixed(4)}
              </span>
              <span className="text-xs font-bold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                per {data.metric_unit?.toLowerCase()}
              </span>
              <span className="text-[11px] text-zorvex-text-secondary/60 dark:text-zorvex-dark-text-secondary/60 line-through ml-1 font-mono">
                (was ${data.previous_unit_cost?.toFixed(4)})
              </span>
            </div>

            <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">
              Tracking <strong className="text-zorvex-text dark:text-zorvex-dark-text">{data.metric_name}</strong>: <span className="font-mono">{data.current_volume?.toLocaleString()}</span> {data.metric_unit?.toLowerCase()} processed against <span className="font-mono">${totalCost?.toFixed(2)}</span> cloud telemetry.
            </p>
          </div>
        </div>

        {/* Right Action */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-clay-pill clay-button text-xs font-extrabold flex-shrink-0"
          >
            <Settings2 className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-dark-forest" />
            <span>Configure Volume</span>
          </button>
        </div>

      </div>

      {/* Modal Configure Unit Economics */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div 
            className="surface-floating w-full max-w-md bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-surface-floating rounded-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-zorvex-border dark:border-zorvex-dark-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
                  Configure Business Unit Economics
                </h3>
                <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">
                  Tie cloud infrastructure costs to actual business growth metrics.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                className="p-1.5 rounded-xl text-zorvex-text-secondary hover:text-zorvex-text dark:text-zorvex-dark-text-secondary dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-zorvex-spike-soft border border-zorvex-spike/30 text-xs text-zorvex-spike font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="business-metric-name" className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mb-1">
                  Business Metric Name
                </label>
                <input
                  id="business-metric-name"
                  name="businessMetricName"
                  type="text"
                  required
                  value={metricName}
                  onChange={(e) => setMetricName(e.target.value)}
                  placeholder="e.g. Orders, Active Users, API Requests"
                  aria-label="Business Metric Name"
                  className="w-full px-3.5 py-2.5 clay-input text-xs font-semibold text-zorvex-text dark:text-zorvex-dark-text"
                />
              </div>

              <div>
                <label htmlFor="single-unit-label" className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mb-1">
                  Single Unit Label
                </label>
                <input
                  id="single-unit-label"
                  name="singleUnitLabel"
                  type="text"
                  required
                  value={metricUnit}
                  onChange={(e) => setMetricUnit(e.target.value)}
                  placeholder="e.g. Order, User, Call"
                  aria-label="Single Unit Label"
                  className="w-full px-3.5 py-2.5 clay-input text-xs font-semibold text-zorvex-text dark:text-zorvex-dark-text"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="current-volume" className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mb-1">
                    Current Volume
                  </label>
                  <input
                    id="current-volume"
                    name="currentVolume"
                    type="number"
                    required
                    min="1"
                    value={currentVolume}
                    onChange={(e) => setCurrentVolume(e.target.value)}
                    placeholder="e.g. 50000"
                    aria-label="Current Volume"
                    className="w-full px-3.5 py-2.5 clay-input text-xs font-semibold text-zorvex-text dark:text-zorvex-dark-text font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="previous-baseline-volume" className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mb-1">
                    Previous Baseline
                  </label>
                  <input
                    id="previous-baseline-volume"
                    name="previousVolume"
                    type="number"
                    required
                    min="1"
                    value={previousVolume}
                    onChange={(e) => setPreviousVolume(e.target.value)}
                    placeholder="e.g. 35000"
                    aria-label="Previous Baseline Volume"
                    className="w-full px-3.5 py-2.5 clay-input text-xs font-semibold text-zorvex-text dark:text-zorvex-dark-text font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-clay-pill clay-button text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-clay-pill clay-button-primary text-xs font-extrabold flex items-center gap-2"
                >
                  {saving ? 'Updating...' : 'Save Metrics'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
