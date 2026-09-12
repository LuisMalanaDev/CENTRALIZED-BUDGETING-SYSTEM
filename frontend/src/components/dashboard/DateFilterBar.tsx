'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  X,
  Check,
} from 'lucide-react';

export type FilterPeriod = 'day' | 'month' | 'year' | 'all';

export interface DateFilterRange {
  period: FilterPeriod;
  startDate?: string;
  endDate?: string;
  label: string;
  selectedYear: number;
  selectedMonth: number; // 0-11
  selectedDay: number;   // 1-31
}

interface DateFilterBarProps {
  onChange: (range: DateFilterRange) => void;
  className?: string;
  defaultPeriod?: FilterPeriod;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Generates range of selectable years
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => 2022 + i);

export function DateFilterBar({
  onChange,
  className = '',
  defaultPeriod = 'month',
}: DateFilterBarProps) {
  const today = new Date();

  // Mode: day, month, year, all
  const [period, setPeriod] = useState<FilterPeriod>(defaultPeriod);

  // Selected date anchor
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<number>(today.getDate());

  // Viewing/Navigating month & year inside the calendar popup
  const [viewYear, setViewYear] = useState<number>(today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(today.getMonth());

  // Popover open state
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Compute the start & end dates and label
  const computeRange = useCallback(
    (p: FilterPeriod, y: number, m: number, d: number): DateFilterRange => {
      if (p === 'all') {
        return {
          period: 'all',
          startDate: undefined,
          endDate: undefined,
          label: 'All Time',
          selectedYear: y,
          selectedMonth: m,
          selectedDay: d,
        };
      }

      if (p === 'day') {
        const start = new Date(y, m, d, 0, 0, 0, 0);
        const end = new Date(y, m, d, 23, 59, 59, 999);

        const isToday =
          today.getFullYear() === y &&
          today.getMonth() === m &&
          today.getDate() === d;

        const dateStr = start.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        return {
          period: 'day',
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          label: isToday ? `Today (${dateStr})` : `Day: ${dateStr}`,
          selectedYear: y,
          selectedMonth: m,
          selectedDay: d,
        };
      }

      if (p === 'month') {
        const start = new Date(y, m, 1, 0, 0, 0, 0);
        const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
        const monthStr = `${MONTH_NAMES[m]} ${y}`;

        const isCurrentMonth =
          today.getFullYear() === y && today.getMonth() === m;

        return {
          period: 'month',
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          label: isCurrentMonth ? `This Month (${monthStr})` : `Month: ${monthStr}`,
          selectedYear: y,
          selectedMonth: m,
          selectedDay: d,
        };
      }

      // year
      const start = new Date(y, 0, 1, 0, 0, 0, 0);
      const end = new Date(y, 11, 31, 23, 59, 59, 999);
      const isCurrentYear = today.getFullYear() === y;

      return {
        period: 'year',
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        label: isCurrentYear ? `This Year (${y})` : `Year: ${y}`,
        selectedYear: y,
        selectedMonth: m,
        selectedDay: d,
      };
    },
    []
  );

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const lastEmittedRef = useRef<string>('');

  // Dispatch change only when range actually changes
  useEffect(() => {
    const range = computeRange(period, selectedYear, selectedMonth, selectedDay);
    const key = `${range.period}|${range.startDate || ''}|${range.endDate || ''}`;
    if (key !== lastEmittedRef.current) {
      lastEmittedRef.current = key;
      onChangeRef.current(range);
    }
  }, [period, selectedYear, selectedMonth, selectedDay, computeRange]);

  // Handle clicking a specific day in the calendar grid
  const handleSelectDay = (day: number) => {
    setSelectedYear(viewYear);
    setSelectedMonth(viewMonth);
    setSelectedDay(day);
    setPeriod('day');
    setIsOpen(false);
  };

  // Select Entire Month
  const handleSelectFullMonth = () => {
    setSelectedYear(viewYear);
    setSelectedMonth(viewMonth);
    setPeriod('month');
    setIsOpen(false);
  };

  // Select Entire Year
  const handleSelectFullYear = () => {
    setSelectedYear(viewYear);
    setPeriod('year');
    setIsOpen(false);
  };

  // Select All Time
  const handleSelectAllTime = () => {
    setPeriod('all');
    setIsOpen(false);
  };

  // Jump to Today
  const handleJumpToToday = () => {
    const now = new Date();
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
    setSelectedDay(now.getDate());
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setPeriod('day');
    setIsOpen(false);
  };

  // Step backwards on the main bar
  const handleStepPrev = () => {
    if (period === 'day') {
      const prev = new Date(selectedYear, selectedMonth, selectedDay - 1);
      setSelectedYear(prev.getFullYear());
      setSelectedMonth(prev.getMonth());
      setSelectedDay(prev.getDate());
      setViewYear(prev.getFullYear());
      setViewMonth(prev.getMonth());
    } else if (period === 'month') {
      const prev = new Date(selectedYear, selectedMonth - 1, 1);
      setSelectedYear(prev.getFullYear());
      setSelectedMonth(prev.getMonth());
      setViewYear(prev.getFullYear());
      setViewMonth(prev.getMonth());
    } else if (period === 'year') {
      setSelectedYear((y) => y - 1);
      setViewYear((y) => y - 1);
    }
  };

  // Step forwards on the main bar
  const handleStepNext = () => {
    if (period === 'day') {
      const next = new Date(selectedYear, selectedMonth, selectedDay + 1);
      setSelectedYear(next.getFullYear());
      setSelectedMonth(next.getMonth());
      setSelectedDay(next.getDate());
      setViewYear(next.getFullYear());
      setViewMonth(next.getMonth());
    } else if (period === 'month') {
      const next = new Date(selectedYear, selectedMonth + 1, 1);
      setSelectedYear(next.getFullYear());
      setSelectedMonth(next.getMonth());
      setViewYear(next.getFullYear());
      setViewMonth(next.getMonth());
    } else if (period === 'year') {
      setSelectedYear((y) => y + 1);
      setViewYear((y) => y + 1);
    }
  };

  // Month navigation inside popover
  const handlePrevViewMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextViewMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Calendar Grid Calculations for viewYear & viewMonth
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0: Sun ... 6: Sat
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  // Days from previous month to fill first row
  const prevMonthPadding = Array.from({ length: firstDayOfWeek }, (_, i) => {
    return daysInPrevMonth - firstDayOfWeek + 1 + i;
  });

  // Current month days: 1 to daysInMonth
  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const currentRange = computeRange(period, selectedYear, selectedMonth, selectedDay);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Top Main Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2.5 sm:p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm">
        {/* Left: Interactive Calendar Trigger Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              // Align view with current selection when opening
              setViewYear(selectedYear);
              setViewMonth(selectedMonth);
              setIsOpen((prev) => !prev);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/70 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-[0.98]"
            title="Click to open calendar and choose day, month, or year"
          >
            <CalendarIcon className="w-4 h-4 text-black dark:text-white shrink-0" />
            <span className="font-semibold">{currentRange.label}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Quick Indicator Badge */}
          <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400">
            {period === 'day' ? 'Single Day' : period === 'month' ? 'Monthly' : period === 'year' ? 'Yearly' : 'All Time'}
          </span>
        </div>

        {/* Right: Quick Stepper Buttons & Today Reset */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5">
          {period !== 'all' && (
            <>
              <button
                type="button"
                onClick={handleStepPrev}
                className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
                title="Previous period"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleStepNext}
                className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
                title="Next period"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleJumpToToday}
                className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer flex items-center gap-1"
                title="Jump to Today"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Today</span>
              </button>
            </>
          )}

          {period === 'all' && (
            <button
              type="button"
              onClick={handleJumpToToday}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Back to Today</span>
            </button>
          )}
        </div>
      </div>

      {/* CLICKABLE CALENDAR POPUP */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 z-50 w-full sm:w-[340px] p-4 rounded-2xl bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          {/* Header Controls: Month & Year Picker */}
          <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={handlePrevViewMonth}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              {/* Month Dropdown */}
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-white text-xs font-bold px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 focus:outline-none cursor-pointer"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Year Dropdown */}
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-white text-xs font-bold px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 focus:outline-none cursor-pointer"
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleNextViewMonth}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
                title="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer ml-1"
                title="Close calendar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-neutral-400 mb-1">
            {DAY_NAMES.map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Clickable Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Previous month padding days (muted) */}
            {prevMonthPadding.map((padDay) => (
              <button
                key={`prev-${padDay}`}
                type="button"
                onClick={() => {
                  handlePrevViewMonth();
                }}
                className="h-8 w-8 mx-auto flex items-center justify-center text-xs text-neutral-300 dark:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-lg transition-colors cursor-pointer"
              >
                {padDay}
              </button>
            ))}

            {/* Current month days (1..31) */}
            {currentMonthDays.map((day) => {
              const isSelectedDay =
                period === 'day' &&
                selectedYear === viewYear &&
                selectedMonth === viewMonth &&
                selectedDay === day;

              const isCurrentDate =
                today.getFullYear() === viewYear &&
                today.getMonth() === viewMonth &&
                today.getDate() === day;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-8 w-8 mx-auto flex flex-col items-center justify-center text-xs font-semibold rounded-lg transition-all cursor-pointer relative ${
                    isSelectedDay
                      ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm font-bold scale-105'
                      : 'text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                  title={`Select ${MONTH_NAMES[viewMonth]} ${day}, ${viewYear}`}
                >
                  <span>{day}</span>
                  {isCurrentDate && !isSelectedDay && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-black dark:bg-white" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Scope Selection Actions */}
          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-1.5">
            <button
              type="button"
              onClick={handleSelectFullMonth}
              className={`w-full py-2 px-3 rounded-xl text-xs font-semibold text-left flex items-center justify-between transition-colors cursor-pointer ${
                period === 'month' && selectedYear === viewYear && selectedMonth === viewMonth
                  ? 'bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white font-bold'
                  : 'hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
              }`}
            >
              <span>Select Entire Month ({MONTH_NAMES[viewMonth]} {viewYear})</span>
              {period === 'month' && selectedYear === viewYear && selectedMonth === viewMonth && (
                <Check className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={handleSelectFullYear}
              className={`w-full py-2 px-3 rounded-xl text-xs font-semibold text-left flex items-center justify-between transition-colors cursor-pointer ${
                period === 'year' && selectedYear === viewYear
                  ? 'bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white font-bold'
                  : 'hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
              }`}
            >
              <span>Select Entire Year ({viewYear})</span>
              {period === 'year' && selectedYear === viewYear && (
                <Check className="w-3.5 h-3.5" />
              )}
            </button>

            <div className="flex items-center justify-between pt-1 text-xs">
              <button
                type="button"
                onClick={handleJumpToToday}
                className="text-neutral-500 hover:text-black dark:hover:text-white font-semibold cursor-pointer underline"
              >
                Jump to Today
              </button>

              <button
                type="button"
                onClick={handleSelectAllTime}
                className={`font-semibold cursor-pointer underline ${
                  period === 'all' ? 'text-black dark:text-white font-bold' : 'text-neutral-500 hover:text-black dark:hover:text-white'
                }`}
              >
                All Time History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
