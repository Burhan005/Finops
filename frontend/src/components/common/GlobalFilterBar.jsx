import React, { useState, useRef, useEffect } from 'react';
import { 
  Filter, 
  RotateCcw, 
  Download, 
  FileText, 
  FileSpreadsheet, 
  Building2, 
  ChevronDown 
} from 'lucide-react';
import ClayDateRangePicker from './ClayDateRangePicker';
import ClayDropdown from './ClayDropdown';
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
  onResetFilters
}) {
  const [exportOpen, setExportOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const exportRef = useRef(null);

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
    ...availableServices.map((s) => ({ value: s, label: s }))
  ];

  const accountOptions = [
    { value: 'all', label: 'All AWS Accounts' },
    ...availableAccounts.map((acc) => ({ 
      value: acc, 
      label: `Account: ${acc}` 
    }))
  ];

  const hasActiveFilter = (startDate && endDate) || selectedService !== 'All' || (selectedAccount && selectedAccount !== 'all');

  const handlePrintPdf = async () => {
    try {
      setExportLoading(true);
      const res = await api.createExportTicket('html', startDate, endDate, selectedAccount);
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
      await api.downloadExecutiveExcel(startDate, endDate, selectedAccount);
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
            width="w-48"
          />
        )}

        {/* Service Dropdown */}
        {availableServices.length > 0 && (
          <ClayDropdown
            options={serviceOptions}
            value={selectedService}
            onChange={onServiceChange}
            searchable={serviceOptions.length > 5}
            width="w-48"
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
      <div className="relative flex-shrink-0" ref={exportRef}>
        <button
          type="button"
          onClick={() => setExportOpen(!exportOpen)}
          disabled={exportLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-clay-pill clay-button-primary text-xs font-extrabold cursor-pointer transition-all hover:scale-[1.02] disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{exportLoading ? 'Generating...' : 'Download Executive Brief'}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${exportOpen ? 'rotate-180' : ''}`} />
        </button>

        {exportOpen && (
          <div className="absolute right-0 mt-2 w-64 rounded-2xl surface-floating z-50 p-2 animate-fade-in border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="px-3 py-2 border-b border-zorvex-border dark:border-zorvex-dark-border mb-1">
              <p className="text-xs font-extrabold text-zorvex-text dark:text-zorvex-dark-text">Executive Cloud Brief</p>
              <p className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">Boardroom-ready variance briefing</p>
            </div>

            <button
              type="button"
              onClick={handlePrintPdf}
              disabled={exportLoading}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-left text-zorvex-text dark:text-zorvex-dark-text hover:bg-zorvex-surface-secondary dark:hover:bg-zorvex-dark-surface-secondary transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4 text-zorvex-forest dark:text-zorvex-dark-forest flex-shrink-0" />
              <div>
                <div>Print / Save PDF Report</div>
                <div className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary font-normal">Opens print-optimized dashboard</div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={exportLoading}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-left text-zorvex-text dark:text-zorvex-dark-text hover:bg-zorvex-surface-secondary dark:hover:bg-zorvex-dark-surface-secondary transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-zorvex-savings dark:text-zorvex-dark-forest flex-shrink-0" />
              <div>
                <div>Formatted Excel (.xlsx)</div>
                <div className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary font-normal">Direct secure binary download</div>
              </div>
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
