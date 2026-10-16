import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check, X, RotateCcw } from 'lucide-react';

export default function ClayDateRangePicker({
  startDate,
  endDate,
  onApply,
  availableDates = [],
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStart, setTempStart] = useState(startDate || '');
  const [tempEnd, setTempEnd] = useState(endDate || '');
  const [hoverDate, setHoverDate] = useState('');

  // Default to today in 2026 if no start date
  const todayStr = new Date().toISOString().slice(0, 10); // e.g. 2026-10-13
  const initialMonth = (startDate || todayStr).slice(0, 7);
  const [viewYearMonth, setViewYearMonth] = useState(initialMonth);

  const pickerRef = useRef(null);

  useEffect(() => {
    setTempStart(startDate || '');
    setTempEnd(endDate || '');
    if (startDate) {
      setViewYearMonth(startDate.slice(0, 7));
    }
  }, [startDate, endDate]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [currentYear, currentMonth] = viewYearMonth.split('-').map(Number);

  const prevMonth = () => {
    let y = currentYear;
    let m = currentMonth - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setViewYearMonth(`${y}-${String(m).padStart(2, '0')}`);
  };

  const nextMonth = () => {
    let y = currentYear;
    let m = currentMonth + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewYearMonth(`${y}-${String(m).padStart(2, '0')}`);
  };

  const prevYear = () => {
    setViewYearMonth(`${currentYear - 1}-${String(currentMonth).padStart(2, '0')}`);
  };

  const nextYear = () => {
    setViewYearMonth(`${currentYear + 1}-${String(currentMonth).padStart(2, '0')}`);
  };

  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDayWeekday = new Date(currentYear, currentMonth - 1, 1).getDay();

  const daysList = [];
  for (let i = 0; i < firstDayWeekday; i++) {
    daysList.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    daysList.push(dateStr);
  }

  const handleDateClick = (dateStr) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(dateStr);
      setTempEnd('');
    } else {
      if (dateStr < tempStart) {
        setTempEnd(tempStart);
        setTempStart(dateStr);
      } else {
        setTempEnd(dateStr);
      }
    }
  };

  const isInRange = (d) => {
    if (!tempStart) return false;
    const effectiveEnd = tempEnd || hoverDate;
    if (!effectiveEnd) return d === tempStart;
    const [minD, maxD] = tempStart <= effectiveEnd ? [tempStart, effectiveEnd] : [effectiveEnd, tempStart];
    return d >= minD && d <= maxD;
  };

  const applyPreset = (presetName) => {
    const sortedAvailable = availableDates.length > 0 ? [...availableDates].sort() : [];
    const today = new Date();
    const todayFormatted = today.toISOString().slice(0, 10);

    let start = todayFormatted;
    let end = todayFormatted;

    if (presetName === 'today') {
      start = todayFormatted;
      end = todayFormatted;
    } else if (presetName === 'this-month') {
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      start = `${year}-${month}-01`;
      end = todayFormatted;
    } else if (presetName === 'last-7-days') {
      const past7 = new Date(today);
      past7.setDate(past7.getDate() - 7);
      start = past7.toISOString().slice(0, 10);
      end = todayFormatted;
    } else if (presetName === 'last-30-days') {
      const past30 = new Date(today);
      past30.setDate(past30.getDate() - 30);
      start = past30.toISOString().slice(0, 10);
      end = todayFormatted;
    } else if (presetName === 'dataset-latest' && sortedAvailable.length > 0) {
      const latest = sortedAvailable[sortedAvailable.length - 1];
      start = latest;
      end = latest;
    } else if (presetName === 'dataset-all' && sortedAvailable.length > 0) {
      start = sortedAvailable[0];
      end = sortedAvailable[sortedAvailable.length - 1];
    }

    setTempStart(start);
    setTempEnd(end);
    setViewYearMonth(start.slice(0, 7));
  };

  const handleApply = () => {
    const finalStart = tempStart;
    const finalEnd = tempEnd || tempStart;
    onApply(finalStart, finalEnd);
    setIsOpen(false);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div ref={pickerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-clay-pill clay-button text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text transition-all ${
          isOpen ? 'ring-2 ring-zorvex-forest/40' : ''
        }`}
      >
        <CalendarIcon className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-dark-forest" />
        <span className="font-mono">
          {startDate && endDate ? `${startDate} ➔ ${endDate}` : startDate || 'Select Date Range'}
        </span>
      </button>

      {/* Floating Calendar Panel */}
      {isOpen && (
        <div className="absolute left-0 mt-3 w-84 sm:w-96 rounded-3xl surface-floating p-5 z-50 border border-zorvex-border dark:border-zorvex-dark-border animate-fade-in">
          
          {/* Header & Status */}
          <div className="flex items-center justify-between border-b border-zorvex-border dark:border-zorvex-dark-border pb-3 mb-3">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
                Reporting Range
              </span>
              <div className="text-xs font-bold font-mono text-zorvex-forest dark:text-zorvex-dark-forest mt-0.5">
                {tempStart ? `${tempStart} ${tempEnd ? `➔ ${tempEnd}` : '(Click end date)'}` : 'Select start date'}
              </div>
            </div>

            <button
              onClick={() => {
                setTempStart('');
                setTempEnd('');
              }}
              className="p-1.5 rounded-lg clay-button text-zorvex-text-secondary hover:text-zorvex-text dark:text-zorvex-dark-text-secondary dark:hover:text-white text-[11px] flex items-center gap-1"
              title="Reset selected range"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="text-[10px]">Reset</span>
            </button>
          </div>

          {/* Presets */}
          <div className="flex flex-wrap gap-1.5 mb-3.5">
            <button
              type="button"
              onClick={() => applyPreset('today')}
              className="px-2.5 py-1 rounded-clay-pill text-[10px] font-bold bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text dark:text-zorvex-dark-text hover:bg-zorvex-forest-soft dark:hover:bg-zorvex-dark-forest-soft transition-all"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => applyPreset('last-7-days')}
              className="px-2.5 py-1 rounded-clay-pill text-[10px] font-bold bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text dark:text-zorvex-dark-text hover:bg-zorvex-forest-soft dark:hover:bg-zorvex-dark-forest-soft transition-all"
            >
              Last 7D
            </button>
            <button
              type="button"
              onClick={() => applyPreset('this-month')}
              className="px-2.5 py-1 rounded-clay-pill text-[10px] font-bold bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text dark:text-zorvex-dark-text hover:bg-zorvex-forest-soft dark:hover:bg-zorvex-dark-forest-soft transition-all"
            >
              This Month
            </button>
            {availableDates.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => applyPreset('dataset-latest')}
                  className="px-2.5 py-1 rounded-clay-pill text-[10px] font-bold bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-dark-forest-soft dark:text-zorvex-dark-forest hover:bg-zorvex-forest/20 transition-all"
                >
                  Latest Telemetry
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('dataset-all')}
                  className="px-2.5 py-1 rounded-clay-pill text-[10px] font-bold bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-dark-forest-soft dark:text-zorvex-dark-forest hover:bg-zorvex-forest/20 transition-all"
                >
                  All Telemetry
                </button>
              </>
            )}
          </div>

          {/* Month & Year Navigation */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevYear}
                title="Previous Year"
                className="p-1 rounded-full clay-button text-zorvex-text-secondary hover:text-zorvex-text dark:text-zorvex-dark-text-secondary dark:hover:text-white"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={prevMonth}
                title="Previous Month"
                className="p-1 rounded-full clay-button text-zorvex-text-secondary hover:text-zorvex-text dark:text-zorvex-dark-text-secondary dark:hover:text-white"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
                {monthNames[currentMonth - 1]} {currentYear}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={nextMonth}
                title="Next Month"
                className="p-1 rounded-full clay-button text-zorvex-text-secondary hover:text-zorvex-text dark:text-zorvex-dark-text-secondary dark:hover:text-white"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={nextYear}
                title="Next Year"
                className="p-1 rounded-full clay-button text-zorvex-text-secondary hover:text-zorvex-text dark:text-zorvex-dark-text-secondary dark:hover:text-white"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mb-1">
            <span>Su</span>
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
          </div>

          {/* Date Grid */}
          <div className="grid grid-cols-7 gap-1">
            {daysList.map((d, index) => {
              if (!d) return <div key={`empty-${index}`} className="h-8" />;

              const isStart = d === tempStart;
              const isEnd = d === tempEnd;
              const inRange = isInRange(d);
              const dayNum = parseInt(d.split('-')[2], 10);
              const hasRecordedTelemetry = availableDates.includes(d);

              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDateClick(d)}
                  onMouseEnter={() => tempStart && !tempEnd && setHoverDate(d)}
                  className={`h-8 w-full rounded-xl text-xs font-bold transition-all relative flex flex-col items-center justify-center ${
                    isStart || isEnd
                      ? 'bg-zorvex-forest text-white shadow-surface-flat font-extrabold z-10'
                      : inRange
                      ? 'bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-dark-forest-soft dark:text-zorvex-dark-forest rounded-none'
                      : 'text-zorvex-text dark:text-zorvex-dark-text hover:bg-zorvex-surface-secondary dark:hover:bg-zorvex-dark-surface-secondary'
                  }`}
                >
                  <span className="leading-none">{dayNum}</span>
                  {hasRecordedTelemetry && (
                    <span 
                      className={`w-1 h-1 rounded-full mt-0.5 ${
                        isStart || isEnd 
                          ? 'bg-white' 
                          : 'bg-zorvex-forest dark:bg-zorvex-dark-forest'
                      }`}
                      title="Telemetry data recorded"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between border-t border-zorvex-border dark:border-zorvex-dark-border pt-3 mt-4">
            <span className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-zorvex-forest dark:bg-zorvex-dark-forest mr-1 align-middle" />
              Dots indicate recorded data
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 rounded-clay-pill clay-button text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!tempStart}
                onClick={handleApply}
                className={`px-4 py-1.5 rounded-clay-pill text-xs font-extrabold flex items-center gap-1.5 ${
                  tempStart
                    ? 'clay-button-primary'
                    : 'bg-zorvex-surface-recessed text-zorvex-text-secondary/50 cursor-not-allowed'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply</span>
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
