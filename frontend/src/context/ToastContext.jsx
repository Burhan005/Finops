import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { 
  TrendingUp, 
  CheckCircle2, 
  Info, 
  AlertTriangle, 
  X, 
  ArrowUpRight 
} from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idCounterRef = useRef(1);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({ 
    type = 'info', 
    title, 
    message, 
    date = null,
    cost = null,
    service = null,
    actionLabel = null, 
    onAction = null, 
    duration = 5000 
  }) => {
    const id = `toast-${idCounterRef.current++}`;
    const newToast = {
      id,
      type,
      title,
      message,
      date,
      cost,
      service,
      actionLabel,
      onAction,
      duration
    };

    setToasts((prev) => [...prev.slice(-2), newToast]); // Keep max 3 active

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, [removeToast]);

  const spikeAlert = useCallback(({ 
    date, 
    service = 'AWS Workloads', 
    cost = null, 
    currency = '$',
    onAction = null 
  }) => {
    return addToast({
      type: 'spike',
      title: 'Telemetry Spike Detected',
      message: `${service} recorded unusual velocity${cost ? ` (+${currency}${Number(cost).toFixed(2)})` : ''}.`,
      date,
      service,
      cost,
      actionLabel: 'Investigate Spike ↗',
      onAction,
      duration: 8000
    });
  }, [addToast]);

  const success = useCallback((title, message = '') => {
    return addToast({ type: 'success', title, message, duration: 4000 });
  }, [addToast]);

  const info = useCallback((title, message = '') => {
    return addToast({ type: 'info', title, message, duration: 4000 });
  }, [addToast]);

  const warning = useCallback((title, message = '') => {
    return addToast({ type: 'warning', title, message, duration: 5500 });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ addToast, spikeAlert, success, info, warning, removeToast }}>
      {children}

      {/* Tactile Glass Toast Container (Fixed bottom-right, screen-safe) */}
      <div 
        className="fixed bottom-5 right-5 z-[10000] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-[calc(100vw-32px)] pointer-events-none select-none"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const isSpike = toast.type === 'spike';
          const isSuccess = toast.type === 'success';
          const isWarning = toast.type === 'warning';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-2xl p-3.5 surface-floating border backdrop-blur-xl shadow-surface-floating transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${
                isSpike
                  ? 'border-amber-500/50 dark:border-amber-500/60 shadow-amber-500/10'
                  : isSuccess
                  ? 'border-emerald-500/40 dark:border-emerald-500/50 shadow-emerald-500/10'
                  : isWarning
                  ? 'border-rose-500/40 dark:border-rose-500/50 shadow-rose-500/10'
                  : 'border-zorvex-border dark:border-white/10'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                
                {/* Status Beacon / Icon */}
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isSpike
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      : isSuccess
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : isWarning
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      : 'bg-zorvex-forest-soft text-zorvex-forest dark:text-zorvex-dark-forest border border-zorvex-forest/20'
                  }`}>
                    {isSpike ? (
                      <TrendingUp className="w-3.5 h-3.5 stroke-[2.5]" />
                    ) : isSuccess ? (
                      <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                    ) : isWarning ? (
                      <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
                    ) : (
                      <Info className="w-3.5 h-3.5 stroke-[2.5]" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-zorvex-text dark:text-white tracking-tight">
                        {toast.title}
                      </span>
                      {toast.date && (
                        <span className="px-1.5 py-0.2 rounded-md font-mono text-[10px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          {toast.date.slice(5)}
                        </span>
                      )}
                    </div>
                    {toast.message && (
                      <p className="text-[11px] text-zorvex-text-secondary dark:text-slate-300 mt-0.5 leading-snug">
                        {toast.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Dismiss button */}
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer flex-shrink-0"
                  title="Dismiss notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Action Button (e.g. Investigate Spike) */}
              {toast.actionLabel && toast.onAction && (
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      toast.onAction();
                      removeToast(toast.id);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-clay-pill clay-button-primary text-[11px] font-extrabold cursor-pointer active-tactile shadow-xs"
                  >
                    <span>{toast.actionLabel}</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Graceful fallback if invoked outside provider
    return {
      spikeAlert: () => {},
      success: () => {},
      info: () => {},
      warning: () => {},
      addToast: () => {},
      removeToast: () => {}
    };
  }
  return context;
}

export default ToastProvider;
