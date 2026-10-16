import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export default function ClayDropdown({
  options = [],
  value,
  onChange,
  placeholder = 'Select option...',
  searchable = false,
  label = '',
  icon: LeadingIcon = null,
  className = '',
  disabled = false,
  width = 'w-56'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Normalize options: string[] or { value, label, subtext?, icon? }[]
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'string' || typeof opt === 'number') {
      return { value: String(opt), label: String(opt) };
    }
    return {
      value: String(opt.value),
      label: String(opt.label || opt.value),
      subtext: opt.subtext || '',
      icon: opt.icon || null
    };
  });

  const filteredOptions = searchable && searchTerm
    ? normalizedOptions.filter((opt) =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opt.value.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : normalizedOptions;

  const selectedOption = normalizedOptions.find((opt) => opt.value === String(value));

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % filteredOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        onChange(filteredOptions[highlightedIndex].value);
        setIsOpen(false);
      }
    }
  };

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, searchable]);

  return (
    <div
      ref={dropdownRef}
      className={`relative inline-block text-left ${className}`}
      onKeyDown={handleKeyDown}
    >
      {label && (
        <label className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2.5 px-4 py-2.5 rounded-clay-pill clay-button text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text transition-all ${width} ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-zorvex-forest/40'
        } ${isOpen ? 'ring-2 ring-zorvex-forest/30' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 truncate">
          {LeadingIcon ? (
            <LeadingIcon className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-dark-forest flex-shrink-0" />
          ) : selectedOption?.icon ? (
            <selectedOption.icon className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-dark-forest flex-shrink-0" />
          ) : null}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180 text-zorvex-forest dark:text-zorvex-dark-forest' : ''
          }`}
        />
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute left-0 mt-2 ${width} min-w-[220px] rounded-2xl surface-floating z-50 p-2 animate-fade-in border border-zorvex-border dark:border-zorvex-dark-border`}
          role="listbox"
        >
          {searchable && (
            <div className="relative mb-2 px-1">
              <Search className="w-3.5 h-3.5 text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder="Search..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl clay-input text-xs font-medium text-zorvex-text dark:text-zorvex-dark-text focus:outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zorvex-text-secondary hover:text-zorvex-text"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          <div className="max-h-56 overflow-y-auto space-y-0.5 py-0.5">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary text-center italic">
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === String(value);
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors text-left ${
                      isSelected
                        ? 'bg-zorvex-forest-soft text-zorvex-forest dark:bg-zorvex-dark-forest-soft dark:text-zorvex-dark-forest font-extrabold'
                        : isHighlighted
                        ? 'bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-zorvex-text dark:text-zorvex-dark-text font-bold'
                        : 'text-zorvex-text dark:text-zorvex-dark-text hover:bg-zorvex-surface-secondary dark:hover:bg-zorvex-dark-surface-secondary font-medium'
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="truncate mr-2">
                      <div className="flex items-center gap-2">
                        {opt.icon && <opt.icon className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-dark-forest" />}
                        <span className="truncate">{opt.label}</span>
                      </div>
                      {opt.subtext && (
                        <div className="text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-0.5">
                          {opt.subtext}
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-dark-forest flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
