import React, { useState, useEffect } from 'react';
import { ArrowUp, Database, Layers } from 'lucide-react';

export default function FloatingScopeCapsule({
  activeDatasetName = 'Enterprise CUR',
  totalCost = 0,
  currency = 'USD',
  forexRate = 95.32,
  servicesCount = 8
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 320) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!visible) return null;

  const isINR = currency === 'INR';
  const convertedSpend = isINR ? totalCost * forexRate : totalCost;
  const formattedSpend = isINR 
    ? `₹${Math.round(convertedSpend).toLocaleString('en-IN')}`
    : `$${convertedSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="surface-raised rounded-full px-4 py-2 border border-zorvex-border/90 dark:border-zorvex-dark-border/90 shadow-surface-floating flex items-center gap-3.5 backdrop-blur-md bg-zorvex-surface/95 dark:bg-zorvex-dark-surface/95">
        {/* Active Dataset Pill */}
        <div className="flex items-center gap-2 pr-3 border-r border-zorvex-border/60 dark:border-zorvex-dark-border/60">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          <span className="text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text max-w-[140px] truncate" title={activeDatasetName}>
            {activeDatasetName}
          </span>
        </div>

        {/* Live Spend Telemetry */}
        <div className="flex items-center gap-1.5 font-mono">
          <span className="text-xs font-black text-zorvex-forest dark:text-zorvex-forest-highlight">
            {formattedSpend}
          </span>
          <span className="text-[10px] uppercase font-bold text-zorvex-text-muted">
            {currency}
          </span>
        </div>

        {/* Services count */}
        {servicesCount > 0 && (
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-zorvex-text-muted border-l border-zorvex-border/60 dark:border-zorvex-dark-border/60 pl-3">
            <Layers className="w-3 h-3 text-zorvex-forest dark:text-zorvex-forest-highlight" />
            <span>{servicesCount} Services</span>
          </div>
        )}

        {/* Scroll to Top Trigger */}
        <button
          type="button"
          onClick={scrollToTop}
          title="Scroll back to top"
          className="w-7 h-7 rounded-full surface-recessed flex items-center justify-center text-zorvex-text hover:text-zorvex-forest dark:hover:text-zorvex-forest-highlight transition-colors cursor-pointer ml-1 active:scale-95"
        >
          <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
}
