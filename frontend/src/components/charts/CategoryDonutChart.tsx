'use client';

import React from 'react';
import { formatCurrency } from '@/lib/utils';

export interface CategoryBreakdownItem {
  name: string;
  color: string;
  amount: number;
  percentage: number;
}

interface CategoryDonutChartProps {
  data: CategoryBreakdownItem[];
  totalExpense: number;
  currency?: string;
}

const MONOCHROME_SHADES = [
  '#ffffff',
  '#d4d4d8',
  '#a1a1aa',
  '#71717a',
  '#52525b',
  '#3f3f46',
  '#27272a',
];

export function CategoryDonutChart({ data, totalExpense, currency = 'PHP' }: CategoryDonutChartProps) {
  if (!data || data.length === 0 || totalExpense === 0) {
    return (
      <div className="h-60 flex flex-col items-center justify-center text-xs text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
        <p className="font-semibold text-neutral-500 dark:text-neutral-400">No expenses recorded this month.</p>
        <p className="text-[11px] text-neutral-400 mt-0.5">Expenses will appear here in clean monochrome.</p>
      </div>
    );
  }

  const size = 180;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 w-full">
      {/* Donut SVG */}
      <div className="relative flex items-center justify-center">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            className="text-neutral-100 dark:text-neutral-900"
          />

          {data.map((item, idx) => {
            const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
            const strokeDashoffset = -((cumulativePercent / 100) * circumference);
            cumulativePercent += item.percentage;
            const shade = MONOCHROME_SHADES[idx % MONOCHROME_SHADES.length];

            return (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={shade}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                fill="transparent"
                strokeLinecap="round"
                className="transition-all duration-500 hover:opacity-75 cursor-pointer"
              />
            );
          })}
        </svg>

        {/* Centered Total */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            Total Spent
          </span>
          <span className="text-base font-bold text-black dark:text-white tracking-tight">
            {formatCurrency(totalExpense, currency)}
          </span>
        </div>
      </div>

      {/* Legend items */}
      <div className="flex-1 w-full space-y-2 max-h-56 overflow-y-auto pr-1">
        {data.map((item, idx) => {
          const shade = MONOCHROME_SHADES[idx % MONOCHROME_SHADES.length];
          return (
            <div key={idx} className="flex items-center justify-between text-xs py-0.5">
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-neutral-600"
                  style={{ backgroundColor: shade }}
                />
                <span className="font-medium text-neutral-700 dark:text-neutral-300 truncate">
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-2">
                <span className="font-semibold text-black dark:text-white">
                  {formatCurrency(item.amount, currency)}
                </span>
                <span className="text-[11px] font-mono text-neutral-400 w-8 text-right">
                  {item.percentage}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
