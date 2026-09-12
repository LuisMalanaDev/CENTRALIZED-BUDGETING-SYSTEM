'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '../ThemeToggle';
import {
  LayoutDashboard,
  ShoppingBag,
  Receipt,
  PieChart,
  ShieldCheck,
  BarChart3,
  Plus,
  LogOut,
  Wallet,
} from 'lucide-react';

interface SidebarProps {
  onOpenQuickAdd: () => void;
}

export function Sidebar({ onOpenQuickAdd }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navItems = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/tracker', label: 'Shopee & Groceries', icon: ShoppingBag, badge: 'Smart' },
    { href: '/dashboard/transactions', label: 'Transactions', icon: Receipt },
    { href: '/dashboard/budgets', label: 'Dynamic Budgets', icon: PieChart },
    { href: '/dashboard/vaults', label: 'Savings Vaults', icon: ShieldCheck },
    { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black h-screen sticky top-0 shrink-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-neutral-100 dark:border-neutral-900 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold">
            <Wallet className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-black dark:text-white">
              WealthSync
            </span>
            <span className="text-[9px] uppercase font-mono tracking-wider text-neutral-400 -mt-0.5">
              Personal Finance
            </span>
          </div>
        </Link>
        <ThemeToggle />
      </div>

      {/* Quick Action Button - Single Consolidated Button */}
      <div className="p-4">
        <button
          onClick={onOpenQuickAdd}
          className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white dark:text-black bg-black dark:bg-white hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Quick Log</span>
        </button>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white border border-neutral-300 dark:border-neutral-800'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-900/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded border border-neutral-300 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Footer Profile */}
      <div className="p-4 border-t border-neutral-100 dark:border-neutral-900">
        <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white font-bold text-xs flex items-center justify-center shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'L'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-black dark:text-white truncate">
                {user?.name || 'Liam Malana'}
              </p>
              <p className="text-[10px] text-neutral-400 truncate">{user?.email || 'liammalana12@gmail.com'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              logout();
            }}
            className="p-2 rounded-lg text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all cursor-pointer shrink-0 active:scale-95"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
