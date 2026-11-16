import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check, X, Clock } from 'lucide-react';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS = {
  Sun: 'Sunday',
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday'
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Format "YYYY-MM-DD" to "31 Oct 2026 (Saturday)" in IST
function formatDisplayDate(dateStr) {
  if (!dateStr) return 'Select Date...';
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const parts = dateStr.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dt = new Date(Date.UTC(y, m, d));
    const dayName = DAYS_OF_WEEK[dt.getUTCDay()] || '';
    const mName = MONTH_NAMES[m]?.slice(0, 3) || parts[1];
    return `${parts[2]} ${mName} ${parts[0]} (${FULL_DAYS[dayName] || dayName})`;
  }
  return dateStr;
}

export default function ClayDatePicker({
  value,
  onChange,
  availableDates = [],
  className = '',
  placeholder = 'Select date (IST)...'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef(null);

  // Set default view year and month based on value or latest available date
  const effectiveDate = value || availableDates[0] || '2026-10-31';
  const initialYearMonth = (effectiveDate || '2026-10').slice(0, 7);
  const [viewYearMonth, setViewYearMonth] = useState(initialYearMonth);

  useEffect(() => {
    if (value && /^\d{4}-\d{2}/.test(value)) {
      setViewYearMonth(value.slice(0, 7));
    }
  }, [value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const [currentYear, currentMonth] = useMemo(() => {
    const parts = (viewYearMonth || '2026-10').split('-').map(Number);
    return [parts[0] || 2026, parts[1] || 10];
  }, [viewYearMonth]);

  const prevMonth = (e) => {
    e.stopPropagation();
    let y = currentYear;
    let m = currentMonth - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setViewYearMonth(`${y}-${String(m).padStart(2, '0')}`);
  };

  const nextMonth = (e) => {
    e.stopPropagation();
    let y = currentYear;
    let m = currentMonth + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewYearMonth(`${y}-${String(m).padStart(2, '0')}`);
  };

  const prevYear = (e) => {
    e.stopPropagation();
    setViewYearMonth(`${currentYear - 1}-${String(currentMonth).padStart(2, '0')}`);
  };

  const nextYear = (e) => {
    e.stopPropagation();
    setViewYearMonth(`${currentYear + 1}-${String(currentMonth).padStart(2, '0')}`);
  };

  // Calendar matrix calculation
  const daysInMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate();
  const firstDayWeekday = new Date(Date.UTC(currentYear, currentMonth - 1, 1)).getUTCDay();

  const calendarDays = useMemo(() => {
    const list = [];
    for (let i = 0; i < firstDayWeekday; i++) {
      list.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      list.push(dateStr);
    }
    return list;
  }, [currentYear, currentMonth, daysInMonth, firstDayWeekday]);

  const availableSet = useMemo(() => new Set(availableDates), [availableDates]);

  const handleSelectDate = (dateStr) => {
    if (onChange) {
      onChange(dateStr);
    }
    setIsOpen(false);
  };

  return (
    <div ref={pickerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button (Clean Claymorphic Pill) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2.5 px-4 py-2.5 rounded-clay-pill clay-button text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text transition-all cursor-pointer border border-zorvex-border dark:border-zorvex-dark-border ${
          isOpen ? 'ring-2 ring-emerald-500/50 border-emerald-500 shadow-sm' : 'hover:border-emerald-500/30'
        }`}
        title="Click to open calendar date picker"
      >
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
          <span className="font-mono font-black text-zorvex-text dark:text-zorvex-dark-text truncate">
            {formatDisplayDate(value)}
          </span>
        </div>
        <span className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary font-sans font-semibold pl-1">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* Floating Interactive Calendar Popover */}
      {isOpen && (
        <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-80 rounded-3xl surface-floating p-4 z-50 border border-zorvex-border/80 dark:border-zorvex-dark-border/80 shadow-2xl bg-zorvex-surface dark:bg-zorvex-dark-surface animate-in fade-in zoom-in-95 duration-150">
          
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-zorvex-border/50 dark:border-zorvex-dark-border/50">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary block">
                Cluster Reporting Date (IST)
              </span>
              <span className="font-mono font-black text-xs text-zorvex-forest dark:text-emerald-400">
                {formatDisplayDate(value)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-zorvex-text-secondary hover:text-zorvex-text hover:bg-zorvex-surface-secondary text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Month & Year Navigation */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevYear}
                className="p-1 rounded-md text-zorvex-text-secondary hover:text-zorvex-text hover:bg-zorvex-surface-secondary text-xs cursor-pointer"
                title="Previous Year"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 rounded-md text-zorvex-text-secondary hover:text-zorvex-text hover:bg-zorvex-surface-secondary text-xs cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            <span className="text-xs font-black font-mono text-zorvex-text dark:text-zorvex-dark-text">
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={nextMonth}
                className="p-1 rounded-md text-zorvex-text-secondary hover:text-zorvex-text hover:bg-zorvex-surface-secondary text-xs cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={nextYear}
                className="p-1 rounded-md text-zorvex-text-secondary hover:text-zorvex-text hover:bg-zorvex-surface-secondary text-xs cursor-pointer"
                title="Next Year"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1.5 text-[10px] font-mono font-bold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, idx) => (
              <span key={d} className={idx === 0 || idx === 6 ? 'text-amber-600 dark:text-amber-400' : ''}>
                {d}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((dStr, idx) => {
              if (!dStr) {
                return <div key={`empty-${idx}`} className="h-8" />;
              }

              const dayNum = parseInt(dStr.split('-')[2], 10);
              const isSelected = value === dStr;
              const hasData = availableSet.size === 0 || availableSet.has(dStr);
              
              // Weekday index (0=Sun, 6=Sat)
              const dt = new Date(Date.UTC(currentYear, currentMonth - 1, dayNum));
              const isWeekend = dt.getUTCDay() === 0 || dt.getUTCDay() === 6;

              let btnClass = 'text-zorvex-text dark:text-zorvex-dark-text hover:bg-zorvex-surface-secondary';
              if (isSelected) {
                btnClass = 'bg-emerald-600 text-white font-black shadow-md scale-105';
              } else if (!hasData) {
                btnClass = 'text-zorvex-text-secondary/30 cursor-not-allowed';
              } else if (isWeekend) {
                btnClass = 'text-amber-700 dark:text-amber-400 font-bold hover:bg-amber-500/15';
              }

              return (
                <button
                  key={dStr}
                  type="button"
                  disabled={!hasData}
                  onClick={() => handleSelectDate(dStr)}
                  className={`h-8 w-8 mx-auto rounded-xl flex items-center justify-center text-xs font-mono font-bold transition-all cursor-pointer ${btnClass}`}
                  title={`${dStr} (${isWeekend ? 'Weekend' : 'Weekday'})${hasData ? ' · Live Telemetry' : ' · No Records'}`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Quick Shortcuts */}
          <div className="pt-3 mt-3 border-t border-zorvex-border/40 dark:border-zorvex-dark-border/40 space-y-1.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-zorvex-text-secondary block">
              Quick Test Dates:
            </span>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => handleSelectDate('2026-10-31')}
                className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-zorvex-surface-secondary text-zorvex-text hover:bg-emerald-500/15 hover:text-emerald-700 transition-all cursor-pointer"
              >
                31 Oct (Sat)
              </button>
              <button
                type="button"
                onClick={() => handleSelectDate('2026-10-30')}
                className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-zorvex-surface-secondary text-zorvex-text hover:bg-emerald-500/15 hover:text-emerald-700 transition-all cursor-pointer"
              >
                30 Oct (Fri)
              </button>
              <button
                type="button"
                onClick={() => handleSelectDate('2026-10-29')}
                className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer"
                title="Wednesday Late Overtime Leak till 10:30 PM"
              >
                29 Oct (Wed Leak)
              </button>
              <button
                type="button"
                onClick={() => handleSelectDate('2026-10-10')}
                className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer"
                title="Saturday 24h Weekend Overtime Leak"
              >
                10 Oct (Weekend Leak)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
