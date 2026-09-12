'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { StatCard } from '@/components/dashboard/StatCard';
import { CashflowBarChart, CashflowPoint } from '@/components/charts/CashflowBarChart';
import { CategoryDonutChart, CategoryBreakdownItem } from '@/components/charts/CategoryDonutChart';
import { formatCurrency, formatDate, getTagColor } from '@/lib/utils';
import { DateFilterBar, DateFilterRange } from '@/components/dashboard/DateFilterBar';
import {
  Wallet,
  TrendingDown,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  ShoppingBag,
  ShoppingCart,
  ChevronRight,
  Plus,
  RefreshCw,
  Smartphone,
  Landmark,
  Banknote,
} from 'lucide-react';

interface SummaryData {
  totalNetWorth: number;
  monthlyBurnRate: number;
  monthlyIncome: number;
  netCashflow: number;
  overallBudgetLimit: number | null;
  remainingDailyBudget: number;
  daysRemainingInMonth: number;
}

interface TrackerMetrics {
  shopeeTotal: number;
  foodDeliveryTotal: number;
  groceryTotal: number;
  combinedLifestyleSpend: number;
}

interface AccountItem {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
}

export default function DashboardOverviewPage() {
  const { user } = useAuth();
  const currency = user?.currency || 'PHP';

  const [dateFilter, setDateFilter] = useState<DateFilterRange | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [cashflow, setCashflow] = useState<CashflowPoint[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownItem[]>([]);
  const [totalExpense, setTotalExpense] = useState(0);
  const [trackerMetrics, setTrackerMetrics] = useState<TrackerMetrics | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const dateFilterRef = useRef<DateFilterRange | null>(null);

  const fetchDashboardData = useCallback(async (filterOverride?: DateFilterRange | null) => {
    try {
      const activeFilter = filterOverride !== undefined ? filterOverride : dateFilterRef.current;
      const params = new URLSearchParams();
      if (activeFilter?.startDate) params.append('startDate', activeFilter.startDate);
      if (activeFilter?.endDate) params.append('endDate', activeFilter.endDate);
      const queryStr = params.toString() ? `?${params.toString()}` : '';

      const [sumRes, cfRes, bdRes, trkRes, txRes, accRes] = await Promise.all([
        api.get<SummaryData>(`/api/analytics/summary${queryStr}`),
        api.get<{ cashflow: CashflowPoint[] }>('/api/analytics/cashflow?months=6'),
        api.get<{ breakdown: CategoryBreakdownItem[]; totalExpense: number }>(`/api/analytics/breakdown${queryStr}`),
        api.get<{ metrics: TrackerMetrics }>(`/api/analytics/shopping-tracker${queryStr}`),
        api.get<{ transactions: any[] }>(`/api/transactions?limit=6${params.toString() ? `&${params.toString()}` : ''}`),
        api.get<{ accounts: AccountItem[] }>('/api/accounts'),
      ]);

      setSummary(sumRes);
      setCashflow(cfRes.cashflow || []);
      setCategoryBreakdown(bdRes.breakdown || []);
      setTotalExpense(bdRes.totalExpense || 0);
      setTrackerMetrics(trkRes.metrics || null);
      setRecentTransactions(txRes.transactions || []);
      setAccounts(accRes.accounts || []);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchDashboardData();

    // Listen to global quick add events
    const handleGlobalRefresh = () => fetchDashboardData();
    window.addEventListener('wealthsync:refresh', handleGlobalRefresh);
    return () => window.removeEventListener('wealthsync:refresh', handleGlobalRefresh);
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleDateFilterChange = useCallback((range: DateFilterRange) => {
    dateFilterRef.current = range;
    setDateFilter(range);
    fetchDashboardData(range);
  }, [fetchDashboardData]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
            Financial Command Center
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Hello, {user?.name || 'Liam Malana'}. Real-time tracking of money left, income sources, and automatic expense subtractions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-black dark:text-white' : ''}`} />
          </button>

          {/* Consolidated Single Action Button */}
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('wealthsync:open-modal', { detail: { mode: 'EXPENSE' } }));
              }
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-sm flex items-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Quick Log</span>
          </button>

          <Link
            href="/dashboard/tracker"
            className="hidden sm:inline-flex px-3.5 py-2 rounded-xl text-xs font-medium text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors items-center gap-1.5"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Shopee Tracker</span>
          </Link>
        </div>
      </div>

      {/* CALENDAR FILTER (Day, Month, Year, All Time) */}
      <DateFilterBar onChange={handleDateFilterChange} defaultPeriod="month" />

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Total Money Left"
          value={formatCurrency(summary?.totalNetWorth, currency)}
          subtitle="Available funds across all accounts"
          icon={Wallet}
          iconColor="text-neutral-900 bg-neutral-100 dark:text-white dark:bg-neutral-800"
          badge={{ text: 'Available Cash', variant: 'neutral' }}
        />

        <StatCard
          title={dateFilter?.label ? `${dateFilter.label} Inflow` : 'Total Money Received'}
          value={formatCurrency(summary?.monthlyIncome, currency)}
          subtitle="Salary, Freelance & Inflows"
          icon={ArrowDownLeft}
          iconColor="text-neutral-900 bg-neutral-100 dark:text-white dark:bg-neutral-800"
          badge={{ text: 'Inflow (+)', variant: 'neutral' }}
        />

        <StatCard
          title={dateFilter?.label ? `${dateFilter.label} Expenses` : 'Total Expenses'}
          value={formatCurrency(summary?.monthlyBurnRate, currency)}
          subtitle="Subtracted from your money left"
          icon={TrendingDown}
          iconColor="text-neutral-900 bg-neutral-100 dark:text-white dark:bg-neutral-800"
          badge={{ text: 'Outflow (-)', variant: 'neutral' }}
        />

        <StatCard
          title="Safe-to-Spend / Day"
          value={formatCurrency(summary?.remainingDailyBudget, currency)}
          subtitle={`${summary?.daysRemainingInMonth || 19} days remaining in cycle`}
          icon={Calendar}
          iconColor="text-neutral-900 bg-neutral-100 dark:text-white dark:bg-neutral-800"
          badge={{ text: 'Daily Guide', variant: 'neutral' }}
        />
      </div>

      {/* WHERE YOUR MONEY IS STORED (WALLETS & ACCOUNTS) */}
      <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-white flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              <span>Where Your Money Is Stored</span>
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Your actual funds. When you log expenses, it automatically deducts from your remaining money here.
            </p>
          </div>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('wealthsync:open-modal', { detail: { mode: 'INCOME' } }));
              }
            }}
            className="text-xs font-bold text-black dark:text-white hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>+ Add money / starting balance</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {accounts.map((acc) => {
            const isGcash = acc.name.toLowerCase().includes('gcash') || acc.type === 'WALLET';
            const isBank = acc.name.toLowerCase().includes('bank') || acc.type === 'SAVINGS' || acc.type === 'CHECKING';
            const isCash = acc.name.toLowerCase().includes('cash') || acc.type === 'CASH';

            return (
              <div
                key={acc.id}
                className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex flex-col justify-between gap-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-black text-white dark:bg-white dark:text-black flex items-center justify-center font-bold">
                      {isGcash ? <Smartphone className="w-4 h-4" /> : isBank ? <Landmark className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-neutral-900 dark:text-white">{acc.name}</h4>
                      <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono">{acc.type}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-baseline justify-between pt-2 border-t border-neutral-200 dark:border-neutral-800">
                  <span className="text-[11px] text-neutral-500">Balance:</span>
                  <span className="text-base font-extrabold text-neutral-900 dark:text-white font-mono">
                    {formatCurrency(acc.balance, currency)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* LIFESTYLE ORDERS HIGHLIGHT CALLOUT */}
      {trackerMetrics && (
        <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-black text-white dark:bg-white dark:text-black shadow-sm">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Lifestyle & E-Commerce Tracker Active
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Shopee parcels: <strong className="text-neutral-900 dark:text-white">{formatCurrency(trackerMetrics.shopeeTotal, currency)}</strong> • Groceries: <strong className="text-neutral-900 dark:text-white">{formatCurrency(trackerMetrics.groceryTotal, currency)}</strong>
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/tracker"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-900 dark:text-white hover:underline"
          >
            <span>Open Ingestion Parser</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cashflow Bar Chart (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                Monthly Cashflow Trajectory
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Compare actual inflows vs outflows over the past 6 months
              </p>
            </div>
          </div>
          <CashflowBarChart data={cashflow} currency={currency} />
        </div>

        {/* Category Breakdown Donut (1 col) */}
        <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-white">
              Category Distribution
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
              Current cycle expenses
            </p>
            <CategoryDonutChart
              data={categoryBreakdown}
              totalExpense={totalExpense}
              currency={currency}
            />
          </div>
          <div className="pt-4 mt-4 border-t border-neutral-100 dark:border-neutral-800 text-center">
            <Link
              href="/dashboard/budgets"
              className="text-xs font-semibold text-neutral-900 dark:text-white hover:underline inline-flex items-center gap-1"
            >
              <span>Manage spending limits</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* RECENT TRANSACTIONS LEDGER PREVIEW */}
      <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-white">
              Recent Activity
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Latest transactions logged via manual entry or statement parser
            </p>
          </div>
          <Link
            href="/dashboard/transactions"
            className="text-xs font-semibold text-neutral-900 dark:text-white hover:underline flex items-center gap-1"
          >
            <span>View Full Ledger</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {recentTransactions.length === 0 ? (
            <p className="text-center py-8 text-xs text-neutral-400">
              No transactions logged yet. Click Quick Log (+) to add your first expense.
            </p>
          ) : (
            recentTransactions.map((tx) => {
              const isIncome = tx.type === 'INCOME';
              return (
                <div
                  key={tx.id}
                  className="py-3.5 flex items-center justify-between gap-4 hover:bg-neutral-50 dark:hover:bg-neutral-900/40 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white">
                      {tx.isShopeeOrder ? (
                        <ShoppingBag className="w-4 h-4" />
                      ) : (
                        <ShoppingCart className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                        {tx.description}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                        <span>{formatDate(tx.date)}</span>
                        <span>•</span>
                        <span>{tx.paymentMethod?.replace('_', ' ')}</span>
                        {tx.isShopeeOrder && (
                          <span className="hidden sm:inline-block px-1.5 py-0.2 text-[10px] font-semibold rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700">
                            Shopee Order
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white">
                      {isIncome ? '+' : '-'}{formatCurrency(tx.amount, currency)}
                    </p>
                    <span className="text-[10px] text-neutral-400 block">
                      {tx.category?.name || 'General'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
