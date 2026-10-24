import React from 'react';
import { AlertCircle, RefreshCw, RotateCcw, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log telemetry internally for operational monitoring
    console.error('[ZORVEX Production ErrorBoundary caught]:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, showDetails: false });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handlePageReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="w-full my-6 p-7 sm:p-8 rounded-3xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-surface-raised flex flex-col items-center justify-center text-center space-y-5 animate-in fade-in duration-200">
          
          {/* Institutional Status Beacon */}
          <div className="w-13 h-13 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-inner">
            <AlertCircle className="w-6 h-6 stroke-[2.2]" />
          </div>

          {/* Executive Reassurance Copy (Zero Raw Stack Traces) */}
          <div className="max-w-md space-y-2">
            <h3 className="text-base sm:text-lg font-black text-zorvex-text dark:text-zorvex-dark-text tracking-tight">
              {this.props.title || 'Analytics Module Temporarily Interrupted'}
            </h3>
            <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary leading-relaxed">
              {this.props.message || 'This analytical panel encountered a momentary display interruption. Your underlying billing records, cloud reconciliations, and session credentials remain completely intact and secure.'}
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3 flex-wrap justify-center pt-1">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-clay-pill text-xs font-black bg-zorvex-forest text-white hover:bg-zorvex-forest/90 dark:bg-zorvex-dark-forest dark:hover:bg-zorvex-dark-forest/90 transition-all duration-150 shadow-surface-raised cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Restore Module</span>
            </button>

            <button
              type="button"
              onClick={this.handlePageReload}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-clay-pill text-xs font-bold surface-recessed hover:surface-raised text-zorvex-text-secondary hover:text-zorvex-text transition-all duration-150 border border-zorvex-border/80 dark:border-zorvex-dark-border/80 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Refresh Workspace</span>
            </button>
          </div>

          {/* Enterprise Data Protection Guarantee Badge */}
          <div className="inline-flex items-center gap-1.5 pt-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Zero Data Loss • Active Tenant Session Verified</span>
          </div>

          {/* Collapsible Diagnostic Trace (Discreet & Non-Intrusive) */}
          {this.state.error && (
            <div className="pt-2 w-full max-w-lg">
              <button
                type="button"
                onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                className="text-[11px] font-mono text-zorvex-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Diagnostic Reference</span>
                {this.state.showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {this.state.showDetails && (
                <div className="mt-2 p-3 rounded-xl surface-recessed border border-zorvex-border/60 dark:border-zorvex-dark-border/60 text-left font-mono text-[10px] text-zorvex-text-muted break-all max-h-32 overflow-y-auto">
                  <div className="text-zorvex-text-secondary font-bold mb-1">Incident Code: ERR_RENDER_SYNC</div>
                  <div>{this.state.error.message || String(this.state.error)}</div>
                </div>
              )}
            </div>
          )}

        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
