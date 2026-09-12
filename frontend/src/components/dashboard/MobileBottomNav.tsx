'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  Plus,
  PieChart,
  ShieldCheck,
} from 'lucide-react';

interface MobileBottomNavProps {
  onOpenQuickAdd: () => void;
}

export function MobileBottomNav({ onOpenQuickAdd }: MobileBottomNavProps) {
  const pathname = usePathname();

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-black/95 backdrop-blur-md border-t border-neutral-200 dark:border-neutral-800 pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {/* Overview */}
        <Link
          href="/dashboard"
          className={`flex flex-col items-center justify-center w-12 py-1 transition-colors ${
            pathname === '/dashboard'
              ? 'text-black dark:text-white font-bold'
              : 'text-neutral-400 dark:text-neutral-500'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[9px] mt-0.5 font-mono">Home</span>
        </Link>

        {/* Shopee & Grocery Tracker */}
        <Link
          href="/dashboard/tracker"
          className={`flex flex-col items-center justify-center w-12 py-1 transition-colors ${
            pathname === '/dashboard/tracker'
              ? 'text-black dark:text-white font-bold'
              : 'text-neutral-400 dark:text-neutral-500'
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
          <span className="text-[9px] mt-0.5 font-mono">Tracker</span>
        </Link>

        {/* Quick Action Floating Plus Button - Monochrome */}
        <div className="flex items-center justify-center -mt-6">
          <button
            onClick={onOpenQuickAdd}
            className="w-12 h-12 rounded-full bg-black text-white dark:bg-white dark:text-black flex items-center justify-center shadow-lg border-2 border-white dark:border-black active:scale-95 transition-transform"
            aria-label="5-Second Quick Expense Entry"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Budgets */}
        <Link
          href="/dashboard/budgets"
          className={`flex flex-col items-center justify-center w-12 py-1 transition-colors ${
            pathname === '/dashboard/budgets'
              ? 'text-black dark:text-white font-bold'
              : 'text-neutral-400 dark:text-neutral-500'
          }`}
        >
          <PieChart className="w-5 h-5" />
          <span className="text-[9px] mt-0.5 font-mono">Budgets</span>
        </Link>

        {/* Vaults */}
        <Link
          href="/dashboard/vaults"
          className={`flex flex-col items-center justify-center w-12 py-1 transition-colors ${
            pathname === '/dashboard/vaults'
              ? 'text-black dark:text-white font-bold'
              : 'text-neutral-400 dark:text-neutral-500'
          }`}
        >
          <ShieldCheck className="w-5 h-5" />
          <span className="text-[9px] mt-0.5 font-mono">Vaults</span>
        </Link>
      </div>
    </div>
  );
}
