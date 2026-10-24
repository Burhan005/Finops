import React, { useState, useRef, useEffect } from 'react';
import { 
  Filter, 
  RotateCcw, 
  Download, 
  FileText, 
  FileSpreadsheet, 
  Building2, 
  ChevronDown,
  Calendar
} from 'lucide-react';
import ClayDateRangePicker from './ClayDateRangePicker';
import ClayDropdown from './ClayDropdown';
import AwsServiceIcon from './AwsServiceIcon';
import { api } from '../../services/api';

export default function GlobalFilterBar({
  startDate,
  endDate,
  onDateRangeChange,
  availableDates = [],
  selectedService = 'All',
  onServiceChange,
  availableServices = [],
  selectedAccount = 'all',
  onAccountChange,
  availableAccounts = [],
  onResetFilters,
  currency = 'USD'
}) {
  const [exportOpen, setExportOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [compareMode, setCompareMode] = useState('dod'); // 'dod' (Day-over-Day) | 'range' (Filter Range)
  const exportRef = useRef(null);

  const isINR = currency === 'INR';
  const hasCustomRange = Boolean(startDate && endDate);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const serviceOptions = [
    { value: 'All', label: 'All AWS Services' },
    ...availableServices.map((s) => ({ 
      value: s, 
      label: s,
      icon: (props) => <AwsServiceIcon service={s} size={16} className="w-4 h-4 rounded" {...props} />
    }))
  ];

  const accountOptions = [
    { value: 'all', label: 'All AWS Accounts' },
    ...availableAccounts.map((acc) => ({ 
      value: acc, 
      label: `Account: ${acc}` 
    }))
  ];

  const hasActiveFilter = (startDate && endDate) || selectedService !== 'All' || (selectedAccount && selectedAccount !== 'all');

  // Compute baseline and target dates depending on user comparison mode
  const getComparisonDates = () => {
    if (compareMode === 'range' && hasCustomRange) {
      return { baseline: startDate, target: endDate };
    }
    // Default Day-over-Day (backend automatically picks latest two consecutive days)
    return { baseline: null, target: null };
  };

  const handlePrintPdf = async () => {
    try {
      setExportLoading(true);
      const { baseline, target } = getComparisonDates();
      const res = await api.createExportTicket('html', baseline, target, selectedAccount, currency);
      setExportOpen(false);
      window.open(api.getTicketExportUrl(res.ticket), '_blank');
    } catch (err) {
      console.error('Failed to create secure print ticket:', err);
      alert('Failed to generate export: ' + (err.message || 'Server error'));
    } finally {
      setExportLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      setExportLoading(true);
      setExportOpen(false);
      const { baseline, target } = getComparisonDates();
      await api.downloadExecutiveExcel(baseline, target, selectedAccount, currency);
    } catch (err) {
      console.error('Failed to download Excel brief:', err);
      alert('Failed to download Excel report: ' + (err.message || 'Server error'));
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="clay-card p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border border-zorvex-border dark:border-zorvex-dark-border">
      
      {/* Left Filter Controls */}
      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
        
        {/* Label */}
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mr-1">
          <Filter className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-dark-forest" />
          <span>Filters:</span>
        </div>

        {/* Date Range Picker */}
        <ClayDateRangePicker
          startDate={startDate}
          endDate={endDate}
          availableDates={availableDates}
          onApply={onDateRangeChange}
        />

        {/* Multi-Account Switcher */}
        {availableAccounts.length > 0 && (
          <ClayDropdown
            options={accountOptions}
            value={selectedAccount}
            onChange={onAccountChange}
            searchable={accountOptions.length > 5}
            width="w-full sm:w-48"
          />
        )}

        {/* Service Dropdown */}
        {availableServices.length > 0 && (
          <ClayDropdown
            options={serviceOptions}
            value={selectedService}
            onChange={onServiceChange}
            searchable={serviceOptions.length > 5}
            width="w-full sm:w-48"
          />
        )}

        {/* Clear Filters Button */}
        {hasActiveFilter && (
          <button
            type="button"
            onClick={onResetFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-clay-pill clay-button text-xs font-bold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text dark:hover:text-zorvex-dark-text transition-all"
            title="Clear all active filters"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}

      </div>

      {/* Right Actions: 1-Click Executive Export */}
      <div className="relative w-full sm:w-auto flex-shrink-0" ref={exportRef}>
        <button
          type="button"
          onClick={() => setExportOpen(!exportOpen)}
          disabled={exportLoading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-clay-pill clay-button-primary text-xs font-extrabold cursor-pointer transition-all hover:scale-[1.02] disabled:opacity-50 active-tactile"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{exportLoading ? 'Generating...' : 'Download Executive Brief'}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${exportOpen ? 'rotate-180' : ''}`} />
        </button>

        {exportOpen && (
          <div className="absolute right-0 mt-2 w-[calc(100vw-32px)] sm:w-72 max-w-sm rounded-2xl surface-floating z-50 p-3 animate-fade-in border border-zorvex-border dark:border-zorvex-dark-border shadow-surface-floating">
            
            {/* Header */}
            <div className="px-2 py-1.5 border-b border-zorvex-border dark:border-zorvex-dark-border mb-2.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-extrabold text-zorvex-text dark:text-zorvex-dark-text">Executive Cloud Brief</p>
                <p className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">Boardroom variance & ROI briefing</p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-forest dark:text-zorvex-dark-forest border border-zorvex-border dark:border-zorvex-dark-border">
                {isINR ? '₹ INR' : '$ USD'}
              </span>
            </div>

            {/* Comparison Basis Selector */}
            <div className="mb-3 px-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                <span>Comparison Basis</span>
              </div>
              
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary border border-zorvex-border dark:border-zorvex-dark-border">
                <button
                  type="button"
                  onClick={() => setCompareMode('dod')}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all text-center ${
                    compareMode === 'dod'
                      ? 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-forest dark:text-zorvex-dark-forest shadow-sm'
                      : 'text-zorvex-text-secondary hover:text-zorvex-text'
                  }`}
                >
                  Day-over-Day
                </button>

                <button
                  type="button"
                  onClick={() => setCompareMode('range')}
                  disabled={!hasCustomRange}
                  title={!hasCustomRange ? 'Select a date range filter first' : 'Compare Start vs End date'}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all text-center ${
                    !hasCustomRange
                      ? 'opacity-40 cursor-not-allowed text-zorvex-text-secondary'
                      : compareMode === 'range'
                        ? 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-forest dark:text-zorvex-dark-forest shadow-sm'
                        : 'text-zorvex-text-secondary hover:text-zorvex-text'
                  }`}
                >
                  Range Start ➔ End
                </button>
              </div>

              <p className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1 px-1">
                {compareMode === 'dod' 
                  ? 'Comparing latest 2 billing days (Yesterday vs Today).'
                  : `Comparing ${startDate?.slice(5)} with ${endDate?.slice(5)}.`
                }
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-1.5 pt-1 border-t border-zorvex-border dark:border-zorvex-dark-border">
              <button
                type="button"
                onClick={handlePrintPdf}
                disabled={exportLoading}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-left text-zorvex-text dark:text-zorvex-dark-text hover:bg-zorvex-surface-secondary dark:hover:bg-zorvex-dark-surface-secondary transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4 text-zorvex-forest dark:text-zorvex-dark-forest flex-shrink-0" />
                <div>
                  <div>Print / Save PDF Report</div>
                  <div className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary font-normal">Visual charts & C-suite brief ({currency})</div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleDownloadExcel}
                disabled={exportLoading}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-left text-zorvex-text dark:text-zorvex-dark-text hover:bg-zorvex-surface-secondary dark:hover:bg-zorvex-dark-surface-secondary transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span>Formatted Excel (.xlsx)</span>
                    <span className="text-[9px] font-extrabold uppercase px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300">Multi-tab</span>
                  </div>
                  <div className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary font-normal">4-sheet workbook formatted in {currency}</div>
                </div>
              </button>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
