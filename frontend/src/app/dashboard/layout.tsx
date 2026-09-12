'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { MobileBottomNav } from '@/components/dashboard/MobileBottomNav';
import { QuickExpenseModal } from '@/components/dashboard/QuickExpenseModal';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Wallet, Plus, LogOut } from 'lucide-react';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddMode, setQuickAddMode] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const handleOpenModal = (e: any) => {
      const mode = e.detail?.mode || 'EXPENSE';
      setQuickAddMode(mode);
      setQuickAddOpen(true);
    };
    window.addEventListener('wealthsync:open-modal', handleOpenModal);
    return () => window.removeEventListener('wealthsync:open-modal', handleOpenModal);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      // In local development, if session is empty, redirect to login
      const token = typeof window !== 'undefined' ? localStorage.getItem('wealthsync_token') : null;
      if (!token && typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard')) {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  const handleExpenseAdded = () => {
    setRefreshTrigger((prev) => prev + 1);
    // Dispatch custom event for child dashboard pages to refresh data
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wealthsync:refresh'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-black dark:bg-white animate-pulse" />
          <p className="text-xs font-semibold text-neutral-400">Loading WealthSync Command Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-neutral-50 dark:bg-black text-neutral-900 dark:text-neutral-100 antialiased">
      {/* Desktop Sidebar */}
      <Sidebar onOpenQuickAdd={() => setQuickAddOpen(true)} />

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Mobile Top Header */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-black dark:bg-white text-white dark:text-black flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="font-bold text-base tracking-tight text-neutral-900 dark:text-white">
              WealthSync
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setQuickAddOpen(true)}
              className="p-1.5 rounded-lg bg-black dark:bg-white text-white dark:text-black shadow-sm cursor-pointer active:scale-95 transition-transform"
              aria-label="Quick Add"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                logout();
              }}
              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer active:scale-95"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-12">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav onOpenQuickAdd={() => setQuickAddOpen(true)} />

        {/* Quick Transaction Modal (Expense / Income) */}
        <QuickExpenseModal
          isOpen={quickAddOpen}
          onClose={() => setQuickAddOpen(false)}
          onSuccess={handleExpenseAdded}
          currency={user?.currency || 'PHP'}
          defaultType={quickAddMode}
        />
      </div>
    </div>
  );
}
