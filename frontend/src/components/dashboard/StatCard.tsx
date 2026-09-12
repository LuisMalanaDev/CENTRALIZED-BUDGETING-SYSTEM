'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  badge?: {
    text: string;
    variant?: 'positive' | 'negative' | 'neutral' | 'warning';
  };
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
}: StatCardProps) {
  return (
    <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#09090b] shadow-none hover:border-neutral-400 dark:hover:border-neutral-700 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          {title}
        </span>
        <div className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 text-black dark:text-white bg-neutral-50 dark:bg-neutral-900">
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <h4 className="text-2xl font-bold text-black dark:text-white tracking-tight font-mono">
          {value}
        </h4>
        {badge && (
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-900">
            {badge.text}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
          {subtitle}
        </p>
      )}
    </div>
  );
}
