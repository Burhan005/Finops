import React, { useState, useEffect } from 'react';
import {
  Tag,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Terminal,
  RefreshCw,
  ExternalLink,
  Flame,
  Info,
  DollarSign,
  HelpCircle
} from 'lucide-react';
import { api } from '../services/api';
import AwsServiceIcon from './common/AwsServiceIcon';

export default function TagGovernanceView({ activeDataset, darkMode }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');

  const fetchTagGovernance = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getTagGovernance();
      setReport(data);
    } catch (err) {
      console.error('Failed to load tag governance report:', err);
      setError(err.message || 'Unable to load Tag Governance telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTagGovernance();
  }, [activeDataset]);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2200);
  };

  const summary = report?.summary || {};
  const policies = report?.policies || {};
  const topUntagged = report?.top_untagged_spenders || [];
  const discoveredTags = report?.discovered_tags || [];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ==================== 1. PAGE HEADER ==================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zorvex-border/60 dark:border-zorvex-dark-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft border border-zorvex-forest/20 text-zorvex-forest dark:text-zorvex-forest-highlight flex items-center justify-center shadow-clay-sm">
              <Tag className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-zorvex-text dark:text-zorvex-dark-text tracking-tight flex items-center gap-2.5">
                Tag Governance & Cost Allocation
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-forest/20 dark:text-zorvex-forest-highlight border border-zorvex-forest/30">
                  FinOps Tier-1
                </span>
              </h1>
              <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">
                Audits AWS Cost Allocation Tags (CATs), quantifies unallocated Dark Cost, and enforces corporate tagging standards.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchTagGovernance}
            disabled={loading}
            className="px-3.5 py-2 rounded-clay-pill text-xs font-bold bg-zorvex-surface dark:bg-zorvex-dark-surface hover:bg-zorvex-surface-secondary text-zorvex-text dark:text-zorvex-dark-text border border-zorvex-border dark:border-zorvex-dark-border shadow-clay-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-zorvex-forest' : ''}`} />
            <span>{loading ? 'Auditing Tags...' : 'Refresh Audit'}</span>
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ==================== 2. HERO KPI CARDS ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Compliance Score */}
        <div className="clay-card p-5 bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-clay-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
              Tagging Compliance
            </span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-black font-mono ${
              summary.compliance_score >= 80
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                : summary.compliance_score >= 50
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30'
            }`}>
              Grade {summary.grade || 'N/A'}
            </span>
          </div>

          <div className="my-3">
            <div className="text-3xl font-black font-mono text-zorvex-text dark:text-zorvex-dark-text tracking-tight">
              {loading ? '--' : `${summary.compliance_score || 0.0}%`}
            </div>
            <div className="w-full bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary h-2 rounded-full overflow-hidden mt-2 border border-zorvex-border/40">
              <div
                className={`h-full transition-all duration-500 ${
                  summary.compliance_score >= 80 ? 'bg-emerald-500' : summary.compliance_score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, summary.compliance_score || 0))}%` }}
              />
            </div>
          </div>

          <div className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary flex items-center justify-between">
            <span>{summary.tagged_resources_count || 0} Tagged Assets</span>
            <span className="font-mono">{summary.total_physical_resources || 0} Total</span>
          </div>
        </div>

        {/* Dark Cost (Untagged Spend) */}
        <div className="clay-card p-5 bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-clay-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" />
              Dark Cost (Untagged)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 font-mono">
              {summary.dark_cost_percentage || 0}% Leakage
            </span>
          </div>

          <div className="my-3">
            <div className="text-3xl font-black font-mono text-rose-600 dark:text-rose-400 tracking-tight">
              {loading ? '--' : `$${(summary.dark_cost_spend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <p className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">
              Unallocated spend unable to be cross-charged
            </p>
          </div>

          <div className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary flex items-center justify-between">
            <span>{summary.untagged_resources_count || 0} Untagged Assets</span>
            <span className="font-semibold text-rose-600 dark:text-rose-400">High Risk</span>
          </div>
        </div>

        {/* Allocated Tagged Spend */}
        <div className="clay-card p-5 bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-clay-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Allocated Spend
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-mono">
              Attributed
            </span>
          </div>

          <div className="my-3">
            <div className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
              {loading ? '--' : `$${(summary.allocated_tagged_spend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <p className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">
              Properly attributed to cost centers & teams
            </p>
          </div>

          <div className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary flex items-center justify-between">
            <span>Corporate Compliance</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Auditable</span>
          </div>
        </div>

        {/* Total Cloud Footprint */}
        <div className="clay-card p-5 bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-clay-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
              Total Audited Footprint
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zorvex-surface-secondary text-zorvex-text-secondary">
              CUR Telemetry
            </span>
          </div>

          <div className="my-3">
            <div className="text-3xl font-black font-mono text-zorvex-text dark:text-zorvex-dark-text tracking-tight">
              {loading ? '--' : `$${(summary.total_tracked_spend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <p className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">
              Active physical cloud infrastructure
            </p>
          </div>

          <div className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary flex items-center justify-between">
            <span>{summary.total_physical_resources || 0} Physical Resources</span>
            <span className="font-mono text-zorvex-forest dark:text-zorvex-forest-highlight">Live</span>
          </div>
        </div>
      </div>

      {/* ==================== 3. CRITICAL ENTERPRISE POLICY RADAR ==================== */}
      <div className="clay-card p-6 bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-clay-card space-y-4">
        <div>
          <h2 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
            Corporate Tag Policy Enforcement Radar
          </h2>
          <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">
            Evaluates the 4 mandatory FinOps tagging keys required for multi-tenant cross-charging and governance audits.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.values(policies).map((pol) => {
            const pct = pol.compliance_pct || 0;
            const isHealthy = pct >= 80;
            const isWarning = pct >= 40 && pct < 80;
            return (
              <div key={pol.key} className="p-4 rounded-xl bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary/50 border border-zorvex-border/60 dark:border-zorvex-dark-border/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-zorvex-text dark:text-zorvex-dark-text">
                      {pol.label}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isHealthy
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : isWarning
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                    }`}>
                      {pct}%
                    </span>
                  </div>
                  <p className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1 line-clamp-2">
                    {pol.description}
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-zorvex-border/40 dark:border-zorvex-dark-border/40">
                  <div className="w-full bg-zorvex-surface dark:bg-zorvex-dark-surface h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${isHealthy ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-rose-500'}`}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-zorvex-text-secondary mt-1.5">
                    <span>{pol.compliant_count} Compliant</span>
                    <span>{pol.total_count} Total</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ==================== 4. TOP UNTAGGED SPENDERS (DARK COST LEADERBOARD) ==================== */}
      <div className="clay-card p-6 bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-clay-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text tracking-tight flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              Highest-Yield Untagged Assets (Dark Cost Leakage)
            </h2>
            <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">
              Prioritized by monthly spend. Click "Copy Tag Command" to generate the AWS CLI remediation command instantly.
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 self-start sm:self-auto">
            Top {topUntagged.length} Leakage Targets
          </span>
        </div>

        {topUntagged.length === 0 ? (
          <div className="p-8 text-center text-xs text-zorvex-text-secondary border border-dashed border-zorvex-border rounded-xl">
            {report?.has_tag_columns ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Zero unallocated spend detected! All active infrastructure is fully tagged.
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">
                No user cost allocation tags are configured in this CUR export.
              </span>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-zorvex-border dark:border-zorvex-dark-border overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zorvex-surface-secondary/70 dark:bg-zorvex-dark-surface-secondary/80 border-b border-zorvex-border dark:border-zorvex-dark-border text-zorvex-text-secondary uppercase text-[10px] font-black tracking-wider">
                  <th className="py-3 px-4">Resource Identifier</th>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Account / Region</th>
                  <th className="py-3 px-4 text-right">Dark Cost (Spend)</th>
                  <th className="py-3 px-4 text-center">Actionable Remediation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zorvex-border/50 dark:divide-zorvex-dark-border/50">
                {topUntagged.map((item, idx) => (
                  <tr key={item.resource_id || idx} className="hover:bg-zorvex-surface-secondary/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-zorvex-text dark:text-zorvex-dark-text max-w-[280px] truncate" title={item.resource_id}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-zorvex-text-muted font-normal">#{idx + 1}</span>
                        <span className="truncate">{item.short_id || item.resource_id}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <AwsServiceIcon service={item.service} size={16} className="w-4 h-4 rounded shadow-sm flex-shrink-0" />
                        <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text">{item.service}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-zorvex-text-secondary">
                      <div>{item.account_id}</div>
                      <div className="text-[10px] text-zorvex-text-muted">{item.region}</div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                      ${item.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(item.remediation_command, item.resource_id)}
                        className={`px-3 py-1.5 rounded-clay-pill text-[11px] font-bold transition-all flex items-center gap-1.5 mx-auto cursor-pointer ${
                          copiedId === item.resource_id
                            ? 'bg-emerald-600 text-white shadow-clay-sm'
                            : 'bg-zorvex-forest-soft dark:bg-zorvex-forest/20 text-zorvex-forest dark:text-zorvex-forest-highlight hover:bg-zorvex-forest/30 border border-zorvex-forest/30'
                        }`}
                        title="Copy ready-to-run AWS CLI command to tag this resource"
                      >
                        {copiedId === item.resource_id ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied CLI!</span>
                          </>
                        ) : (
                          <>
                            <Terminal className="w-3.5 h-3.5" />
                            <span>Copy Tag CLI</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================== 5. ACTIVE CUR COST ALLOCATION TAGS ==================== */}
      {discoveredTags.length > 0 && (
        <div className="clay-card p-6 bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-clay-card space-y-4">
          <div>
            <h2 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text tracking-tight flex items-center gap-2">
              <Tag className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
              Active User Cost Allocation Tags in Export
            </h2>
            <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">
              The following user-defined tag keys are actively emitted in your AWS CUR and available for cost allocation.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {discoveredTags.map((dt) => (
              <div key={dt.tag} className="p-3 rounded-xl bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary/50 border border-zorvex-border/50 text-xs">
                <div className="font-mono font-bold text-zorvex-text dark:text-zorvex-dark-text truncate" title={dt.tag}>
                  {dt.tag}
                </div>
                <div className="text-[10px] text-zorvex-text-secondary mt-1 flex items-center justify-between">
                  <span>{dt.resource_count} Assets</span>
                  <span className="font-mono font-bold text-zorvex-forest">{dt.coverage_pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== 6. AWS BILLING PREFERENCES ADVISORY ==================== */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-zorvex-forest-soft/40 to-zorvex-surface-secondary/40 border border-zorvex-forest/20 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-zorvex-forest text-white flex items-center justify-center flex-shrink-0 mt-0.5">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <div className="font-extrabold text-sm text-zorvex-text dark:text-zorvex-dark-text">
              How to Activate Cost Allocation Tags in AWS
            </div>
            <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5 leading-relaxed">
              In AWS Billing Console &rarr; <strong>Cost Allocation Tags</strong>, select your tags (e.g. <code>Environment</code>, <code>Owner</code>, <code>CostCenter</code>) and click <strong>Activate</strong>. Once activated, AWS automatically outputs these tags into your CUR file within 24 hours.
            </p>
          </div>
        </div>

        <a
          href="https://docs.aws.amazon.com/cur/latest/userguide/cost-alloc-tags.html"
          target="_blank"
          rel="noreferrer"
          className="px-3.5 py-2 rounded-clay-pill text-xs font-bold bg-zorvex-surface dark:bg-zorvex-dark-surface hover:bg-zorvex-surface-secondary border border-zorvex-border text-zorvex-forest dark:text-zorvex-forest-highlight flex items-center gap-1.5 flex-shrink-0 cursor-pointer shadow-clay-sm"
        >
          <span>AWS Tagging Docs</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
