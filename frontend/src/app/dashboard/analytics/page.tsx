'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { CashflowBarChart, CashflowPoint } from '@/components/charts/CashflowBarChart';
import { CategoryDonutChart, CategoryBreakdownItem } from '@/components/charts/CategoryDonutChart';
import { formatCurrency } from '@/lib/utils';
import { DateFilterBar, DateFilterRange } from '@/components/dashboard/DateFilterBar';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  CreditCard,
  PieChart,
  Calendar,
  Wallet,
  ShoppingBag,
  ArrowRight,
} from 'lucide-react';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const currency = user?.currency || 'PHP';

  const [dateFilter, setDateFilter] = useState<DateFilterRange | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [cashflow, setCashflow] = useState<CashflowPoint[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownItem[]>([]);
  const [totalExpense, setTotalExpense] = useState(0);
  const [paymentShares, setPaymentShares] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const dateFilterRef = useRef<DateFilterRange | null>(null);

  const fetchAnalytics = useCallback(async (filterOverride?: DateFilterRange | null) => {
    try {
      const activeFilter = filterOverride !== undefined ? filterOverride : dateFilterRef.current;
      const params = new URLSearchParams();
      if (activeFilter?.startDate) params.append('startDate', activeFilter.startDate);
      if (activeFilter?.endDate) params.append('endDate', activeFilter.endDate);
      const queryStr = params.toString() ? `?${params.toString()}` : '';

      const [sumRes, cfRes, bdRes, pmRes] = await Promise.all([
        api.get<any>(`/api/analytics/summary${queryStr}`),
        api.get<{ cashflow: CashflowPoint[] }>('/api/analytics/cashflow?months=6'),
        api.get<{ breakdown: CategoryBreakdownItem[]; totalExpense: number }>(`/api/analytics/breakdown${queryStr}`),
        api.get<{ shares: any[]; total: number }>(`/api/analytics/payment-methods${queryStr}`),
      ]);

      setSummary(sumRes);
      setCashflow(cfRes.cashflow || []);
      setCategoryBreakdown(bdRes.breakdown || []);
      setTotalExpense(bdRes.totalExpense || 0);
      setPaymentShares(pmRes.shares || []);
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    const handleGlobalRefresh = () => fetchAnalytics();
    window.addEventListener('wealthsync:refresh', handleGlobalRefresh);
    return () => window.removeEventListener('wealthsync:refresh', handleGlobalRefresh);
  }, [fetchAnalytics]);

  const handleDateFilterChange = useCallback((range: DateFilterRange) => {
    dateFilterRef.current = range;
    setDateFilter(range);
    fetchAnalytics(range);
  }, [fetchAnalytics]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
            Financial Intelligence & Cashflow Analytics
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Deep-dive analysis on burn rate velocity, categorical share, and wallet disbursement.
          </p>
        </div>

        <Link
          href="/dashboard/tracker"
          className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-sm flex items-center gap-2 self-start sm:self-auto"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Go to Shopee & Email Tracker</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* CALENDAR FILTER (Day, Month, Year, All Time) */}
      <DateFilterBar onChange={handleDateFilterChange} defaultPeriod="month" />

      {/* Burn Rate & Velocity Highlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {dateFilter?.label ? `${dateFilter.label} Inflow` : 'Period Inflow'}
            </span>
            <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-neutral-900 dark:text-white mt-2">
            {formatCurrency(summary?.monthlyIncome, currency)}
          </p>
          <p className="text-xs text-neutral-400 mt-1">Salary & consulting revenue</p>
        </div>

        <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {dateFilter?.label ? `${dateFilter.label} Burn Rate` : 'Period Burn Rate'}
            </span>
            <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-neutral-900 dark:text-white mt-2">
            {formatCurrency(summary?.monthlyBurnRate, currency)}
          </p>
          <p className="text-xs text-neutral-400 mt-1">Outflows for selected period</p>
        </div>

        <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Daily Safe-to-Spend
            </span>
            <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-neutral-900 dark:text-white mt-2">
            {formatCurrency(summary?.remainingDailyBudget, currency)} <span className="text-xs font-normal text-neutral-400">/ day</span>
          </p>
          <p className="text-xs text-neutral-400 mt-1">Remaining over {summary?.daysRemainingInMonth || 19} days</p>
        </div>
      </div>

      {/* Visualizers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cashflow Bar Chart */}
        <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm">
          <h3 className="font-bold text-base text-neutral-900 dark:text-white mb-1">
            Cashflow History (6-Month Trend)
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-6">
            Visualizing total income vs total expenses over time
          </p>
          <CashflowBarChart data={cashflow} currency={currency} />
        </div>

        {/* Category Breakdown Donut */}
        <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm">
          <h3 className="font-bold text-base text-neutral-900 dark:text-white mb-1">
            Expense Breakdown by Category
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-6">
            Proportional share of current month spending
          </p>
          <CategoryDonutChart
            data={categoryBreakdown}
            totalExpense={totalExpense}
            currency={currency}
          />
        </div>
      </div>

      {/* Payment Channel Disbursement */}
      <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm">
        <h3 className="font-bold text-base text-neutral-900 dark:text-white mb-1">
          Payment Method Share (GCash vs Cards vs Cash)
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-5">
          Breakdown of which payment rails you utilize most frequently
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {paymentShares.map((item) => (
            <div
              key={item.method}
              className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800"
            >
              <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
                <span className="font-semibold text-neutral-700 dark:text-neutral-200">
                  {item.method.replace('_', ' ')}
                </span>
                <span className="font-bold text-neutral-900 dark:text-white">{item.percentage}%</span>
              </div>
              <p className="text-lg font-extrabold text-neutral-900 dark:text-white">
                {formatCurrency(item.amount, currency)}
              </p>
              <div className="mt-2 w-full h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                <div
                  style={{ width: `${item.percentage}%` }}
                  className="h-full bg-black dark:bg-white rounded-full"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
