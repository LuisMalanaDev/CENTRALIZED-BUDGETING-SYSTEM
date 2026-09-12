'use client';

import React, { useState } from 'react';
import { formatCurrency } from '@/lib/utils';

export interface CashflowPoint {
  label: string;
  month: string;
  year: number;
  income: number;
  expense: number;
  net: number;
}

interface CashflowBarChartProps {
  data: CashflowPoint[];
  currency?: string;
}

export function CashflowBarChart({ data, currency = 'PHP' }: CashflowBarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const hasData = data && data.some((d) => d.income > 0 || d.expense > 0);

  if (!hasData) {
    return (
      <div className="h-60 flex flex-col items-center justify-center text-xs text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
        <p className="font-semibold text-neutral-500 dark:text-neutral-400">No cashflow records yet.</p>
        <p className="text-[11px] text-neutral-400 mt-0.5">Logged transactions will generate your monthly trajectory.</p>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => Math.max(d.income, d.expense)), 1000);
  const chartHeight = 200;

  return (
    <div className="w-full">
      {/* Chart Legend - Monochrome */}
      <div className="flex items-center justify-end gap-6 mb-4 text-xs font-semibold">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-black dark:bg-white border border-neutral-400" />
          <span className="text-neutral-700 dark:text-neutral-300">Income</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-neutral-400 dark:bg-neutral-600" />
          <span className="text-neutral-700 dark:text-neutral-300">Expenses</span>
        </div>
      </div>

      {/* Bar visualizer */}
      <div className="relative h-56 flex items-end justify-between gap-3 sm:gap-6 pt-6 pb-8 border-b border-neutral-200 dark:border-neutral-800">
        <div className="absolute inset-x-0 top-0 border-t border-neutral-100 dark:border-neutral-900 pointer-events-none" />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-neutral-100 dark:border-neutral-900 pointer-events-none" />

        {data.map((point, idx) => {
          const incomeHeight = point.income > 0 ? Math.max(8, (point.income / maxVal) * chartHeight) : 0;
          const expenseHeight = point.expense > 0 ? Math.max(8, (point.expense / maxVal) * chartHeight) : 0;
          const isHovered = hoveredIndex === idx;

          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center h-full justify-end relative group cursor-pointer"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Tooltip */}
              {isHovered && (
                <div className="absolute -top-14 z-20 bg-black text-white dark:bg-white dark:text-black text-xs rounded-lg py-1.5 px-2.5 shadow-xl pointer-events-none whitespace-nowrap border border-neutral-700 dark:border-neutral-200 font-medium">
                  <p className="font-bold">{point.label}</p>
                  <p>In: {formatCurrency(point.income, currency)}</p>
                  <p>Out: {formatCurrency(point.expense, currency)}</p>
                </div>
              )}

              {/* Bars container */}
              <div className="flex items-end gap-1.5 sm:gap-2 w-full max-w-[50px] justify-center">
                {/* Income Bar (Black in light / White in dark) */}
                <div
                  style={{ height: `${incomeHeight}px` }}
                  className="w-full rounded-t-sm bg-black dark:bg-white transition-all duration-300"
                />
                {/* Expense Bar (Gray) */}
                <div
                  style={{ height: `${expenseHeight}px` }}
                  className="w-full rounded-t-sm bg-neutral-400 dark:bg-neutral-600 transition-all duration-300"
                />
              </div>

              {/* X-axis Label */}
              <span className="absolute -bottom-6 text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                {point.month}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
