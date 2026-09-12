'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '../ThemeToggle';
import {
  LayoutDashboard,
  Users,
  BarChart3,
  ShieldCheck,
  LogOut,
} from 'lucide-react';

interface SidebarProps {
  onOpenQuickAdd?: () => void;
}

export function Sidebar({ onOpenQuickAdd }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navItems = [
    { href: '/dashboard', label: 'Admin Overview', icon: LayoutDashboard },
    { href: '/dashboard/users', label: "Users Directory", icon: Users, badge: 'Live' },
    { href: '/dashboard/analytics', label: 'System Analytics', icon: BarChart3 },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black h-screen sticky top-0 shrink-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-neutral-100 dark:border-neutral-900 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-black dark:text-white">
              WealthSync
            </span>
            <span className="text-[9px] uppercase font-mono tracking-wider text-neutral-400 -mt-0.5">
              Admin Portal
            </span>
          </div>
        </Link>
        <ThemeToggle />
      </div>

      {/* Admin Status Pill */}
      <div className="p-4">
        <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              Admin Command
            </span>
          </div>
          <span className="text-[10px] font-mono text-neutral-400">v1.0.0</span>
        </div>
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
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
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
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-800 text-emerald-600 dark:text-emerald-400 font-bold">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Admin User Footer Profile */}
      <div className="p-4 border-t border-neutral-100 dark:border-neutral-900">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-black dark:bg-white text-white dark:text-black font-bold text-xs flex items-center justify-center shrink-0">
              A
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-black dark:text-white truncate">
                Admin123
              </p>
              <p className="text-[10px] text-neutral-400 truncate">
                Administrator
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
