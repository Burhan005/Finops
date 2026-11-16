import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  SlidersHorizontal, 
  Layers, 
  RotateCcw, 
  Check, 
  ChevronDown,
  Globe
} from 'lucide-react';

function UnitEconomicsCard({ 
  totalCost, 
  overview, 
  filterStartDate,
  filterEndDate,
  onDateRangeChange,
  filterService = 'All',
  onServiceChange,
  availableServices = [],
  onResetFilters,
  forexData,
  currency = 'USD',
  onToggleCurrency
}) {
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [unitData, setUnitData] = useState(null);

  useEffect(() => {
    let isMounted = true;
    api.getUnitEconomics()
      .then((data) => {
        if (isMounted && data) {
          setUnitData(data);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setServiceDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Extract available dates from overview
  const dates = overview?.dates || Object.keys(overview?.daily_totals || {});
  const totalResources = overview?.total_resources || overview?.matching_resources_count || 401;
  const servicesList = availableServices.length > 0 
    ? availableServices 
    : Object.keys(overview?.services || {});

  // Derive active preset dynamically and accurately from the actual active date range
  const getActivePreset = () => {
    if (!filterStartDate && !filterEndDate) return 'ALL';
    if (!dates || dates.length === 0) return 'ALL';

    const dStart = new Date(filterStartDate);
    const dEnd = new Date(filterEndDate);
    const diffDays = Math.round(Math.abs((dEnd - dStart) / (24 * 60 * 60 * 1000))) + 1;

    if (diffDays <= 7) return '7D';
    if (diffDays <= 14) return '14D';
    if (diffDays <= 31) return '30D';
    return 'CUSTOM';
  };

  const currentPreset = getActivePreset();

  // Handle Preset Switching
  const handlePreset = (preset) => {
    if (preset === 'ALL') {
      if (onResetFilters) onResetFilters();
      else if (onDateRangeChange) onDateRangeChange('', '');
      return;
    }

    const available = dates && dates.length > 0 
      ? dates 
      : Object.keys(overview?.daily_totals || {});

    if (!available || available.length === 0) return;

    const sortedDates = [...available].sort();
    const lastDate = sortedDates[sortedDates.length - 1];

    if (preset === '7D') {
      const startIndex = Math.max(0, sortedDates.length - 7);
      const startDate = sortedDates[startIndex];
      if (onDateRangeChange) onDateRangeChange(startDate, lastDate);
    } else if (preset === '14D') {
      const startIndex = Math.max(0, sortedDates.length - 14);
      const startDate = sortedDates[startIndex];
      if (onDateRangeChange) onDateRangeChange(startDate, lastDate);
    } else if (preset === '30D') {
      const startIndex = Math.max(0, sortedDates.length - 30);
      const startDate = sortedDates[startIndex];
      if (onDateRangeChange) onDateRangeChange(startDate, lastDate);
    }
  };

  const handleServiceSelect = (service) => {
    if (onServiceChange) {
      onServiceChange(service);
    }
    setServiceDropdownOpen(false);
  };

  const hasFilter = (filterStartDate && filterEndDate) || (filterService && filterService !== 'All');
  const usdToInr = forexData?.rate || 95.32;

  // Format date range for badge
  const displayRange = filterStartDate && filterEndDate 
    ? `${filterStartDate.slice(5)} to ${filterEndDate.slice(5)}`
    : dates.length > 0 
      ? `${dates[0].slice(5)} to ${dates[dates.length - 1].slice(5)}`
      : 'All Dates';

  return (
    <div className="clay-card p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative overflow-visible">
      
      {/* Left: Scope Summary & Telemetry Indicator */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-zorvex-forest-soft dark:bg-zorvex-dark-forest-soft text-zorvex-forest dark:text-zorvex-dark-forest flex items-center justify-center flex-shrink-0 shadow-inner">
          <SlidersHorizontal className="w-4 h-4 stroke-[2.2]" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-zorvex-text dark:text-zorvex-dark-text">
              Telemetry Scope & Quick Filters
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-dark-forest-soft dark:text-zorvex-dark-forest">
              <span className="w-1.5 h-1.5 rounded-full bg-zorvex-forest dark:bg-zorvex-dark-forest animate-pulse"></span>
              <span>{totalResources} Billed Resources</span>
            </span>
          </div>

          <p className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5 flex flex-wrap items-center gap-2">
            <span>Filtering across <strong>{servicesList.length || 18} AWS Services</strong></span>
            <span className="text-zorvex-forest dark:text-zorvex-dark-forest font-bold">
              • Scope: {filterService !== 'All' ? filterService : 'All Services'} ({displayRange})
            </span>
            {unitData && unitData.current_unit_cost > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] font-bold border border-emerald-500/20">
                Unit Cost: {currency === 'INR' ? `₹${(unitData.current_unit_cost * (forexData?.rate || 95.32)).toFixed(3)}` : `$${unitData.current_unit_cost.toFixed(4)}`} / {unitData.metric_unit || 'Unit'}
                {unitData.efficiency_gain_pct !== 0 && (
                  <span className="font-sans font-semibold">({unitData.efficiency_gain_pct > 0 ? '+' : ''}{unitData.efficiency_gain_pct}% efficiency)</span>
                )}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Right: Quick Interactive Filter Controls */}
      <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end">
        
        {/* Time-Range Quick Presets (7D, 14D, 30D, ALL) */}
        <div className="surface-recessed inline-flex items-center p-1 rounded-2xl gap-1 text-xs font-extrabold">
          {[
            { id: '7D', label: '7D' },
            { id: '14D', label: '14D' },
            { id: '30D', label: '30D' },
            { id: 'ALL', label: 'ALL' }
          ].map((preset) => {
            const isActive = currentPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePreset(preset.id)}
                className={`px-3.5 py-1.5 rounded-xl transition-all duration-150 text-[11px] font-black cursor-pointer active:scale-95 ${
                  isActive
                    ? 'bg-white dark:bg-[#1E2026] text-[#EC7211] dark:text-[#FF9900] shadow-sm border border-amber-500/25'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Quick Service Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setServiceDropdownOpen(!serviceDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl clay-button text-xs font-extrabold border border-zorvex-border dark:border-zorvex-dark-border cursor-pointer hover:border-zorvex-forest/50 transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-dark-forest" />
            <span className="max-w-[130px] truncate">{filterService === 'All' ? 'All Services' : filterService}</span>
            <ChevronDown className="w-3.5 h-3.5 text-zorvex-text-secondary" />
          </button>

          {serviceDropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-60 max-h-64 overflow-y-auto rounded-2xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-surface-floating z-50 p-1.5 animate-fade-in shadow-2xl">
              <button
                type="button"
                onClick={() => handleServiceSelect('All')}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer ${
                  filterService === 'All' 
                    ? 'bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-dark-forest-soft dark:text-zorvex-dark-forest' 
                    : 'text-zorvex-text dark:text-zorvex-dark-text hover:bg-zorvex-surface-secondary'
                }`}
              >
                <span>All AWS Services</span>
                {filterService === 'All' && <Check className="w-3.5 h-3.5 text-zorvex-forest" />}
              </button>

              {servicesList.map((srv) => (
                <button
                  key={srv}
                  type="button"
                  onClick={() => handleServiceSelect(srv)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between truncate cursor-pointer ${
                    filterService === srv
                      ? 'bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-dark-forest-soft dark:text-zorvex-dark-forest'
                      : 'text-zorvex-text dark:text-zorvex-dark-text hover:bg-zorvex-surface-secondary'
                  }`}
                >
                  <span className="truncate">{srv}</span>
                  {filterService === srv && <Check className="w-3.5 h-3.5 text-zorvex-forest flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Interactive Currency Switcher: USD ($) ⇄ INR (₹) */}
        <div 
          className="inline-flex items-center p-1 bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary rounded-xl border border-zorvex-border dark:border-zorvex-dark-border text-xs font-extrabold shadow-inner"
          title={`Click to switch between USD ($) and Indian Rupees (₹) at live rate ₹${usdToInr.toFixed(2)}`}
        >
          <button
            type="button"
            onClick={() => onToggleCurrency && currency !== 'USD' && onToggleCurrency()}
            className={`px-2.5 py-1 rounded-lg transition-all duration-150 text-[11px] font-extrabold cursor-pointer ${
              currency === 'USD'
                ? 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-forest dark:text-zorvex-dark-forest shadow-sm'
                : 'text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text'
            }`}
          >
            $ USD
          </button>
          <button
            type="button"
            onClick={() => onToggleCurrency && currency !== 'INR' && onToggleCurrency()}
            className={`px-2.5 py-1 rounded-lg transition-all duration-150 text-[11px] font-extrabold cursor-pointer ${
              currency === 'INR'
                ? 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-forest dark:text-zorvex-dark-forest shadow-sm'
                : 'text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-text'
            }`}
          >
            ₹ INR
          </button>
        </div>

        {/* Reset Filter Button (Active when filter is applied) */}
        {hasFilter && (
          <button
            type="button"
            onClick={() => {
              if (onResetFilters) onResetFilters();
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zorvex-spike-soft text-zorvex-spike text-xs font-black hover:opacity-85 transition-all shadow-sm border border-zorvex-spike/20 cursor-pointer"
            title="Reset All Scope Filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}

      </div>

    </div>
  );
}


export default React.memo(UnitEconomicsCard);
