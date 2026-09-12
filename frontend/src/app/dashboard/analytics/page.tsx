'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  BarChart3,
  CreditCard,
  Activity,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Receipt,
  Server,
  Database,
  ArrowLeft,
  PieChart,
} from 'lucide-react';
import Link from 'next/link';

interface AdminSummary {
  totalUsers: number;
  totalTransactions: number;
  totalWallets: number;
  totalVolume: number;
  totalExpenses: number;
  totalIncome: number;
  systemStatus: string;
}

interface AdminAnalytics {
  categoryBreakdown: { category: string; amount: number }[];
  paymentBreakdown: { method: string; amount: number }[];
  totalRecords: number;
}

export default function AdminAnalyticsPage() {
  const [summary, setSummary] = useState<AdminSummary>({
    totalUsers: 0,
    totalTransactions: 0,
    totalWallets: 0,
    totalVolume: 0,
    totalExpenses: 0,
    totalIncome: 0,
    systemStatus: 'ONLINE',
  });
  const [analytics, setAnalytics] = useState<AdminAnalytics>({
    categoryBreakdown: [],
    paymentBreakdown: [],
    totalRecords: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      const [sumRes, analyticsRes] = await Promise.all([
        api.get<AdminSummary>('/api/admin/summary').catch(() => null),
        api.get<AdminAnalytics>('/api/admin/analytics').catch(() => ({
          categoryBreakdown: [],
          paymentBreakdown: [],
          totalRecords: 0,
        })),
      ]);

      if (sumRes) setSummary(sumRes);
      if (analyticsRes) setAnalytics(analyticsRes);
    } catch (err) {
      console.warn('Failed to load analytics data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchAnalyticsData();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Admin Overview</span>
            </Link>
            <span className="text-neutral-300 dark:text-neutral-700">/</span>
            <span className="text-xs font-bold text-neutral-900 dark:text-white">System Analytics</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7" />
            <span>Platform & System Analytics</span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Real-time financial telemetry across all mobile app users and payment channels.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Analytics</span>
          </button>
        </div>
      </div>

      {/* Top Volume Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total System Volume</span>
            <TrendingUp className="w-4 h-4 text-neutral-900 dark:text-white" />
          </div>
          <div className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            ₱{summary.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-neutral-500">Gross inflow + outflow</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Expenses</span>
            <TrendingDown className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-extrabold tracking-tight text-red-600 dark:text-red-400">
            ₱{summary.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-neutral-500">Tracked spending logs</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Inflow</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
            ₱{summary.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-neutral-500">Salaries & deposits</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-semibold uppercase tracking-wider">
            <span>Transactions Count</span>
            <Receipt className="w-4 h-4 text-neutral-900 dark:text-white" />
          </div>
          <div className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            {summary.totalTransactions}
          </div>
          <p className="text-[11px] text-neutral-500">Across {summary.totalUsers} registered users</p>
        </div>
      </div>

      {/* Visualizers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Channels Breakdown */}
        <div className="p-6 rounded-3xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-neutral-900 dark:text-white" />
              <span>Payment Methods Distribution</span>
            </h2>
            <span className="text-xs text-neutral-400 font-mono">Live Volume</span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-xs text-neutral-400">Loading payment telemetry...</div>
          ) : analytics.paymentBreakdown.length === 0 ? (
            <div className="text-center py-12 text-xs text-neutral-400">No payment activity recorded yet.</div>
          ) : (
            <div className="space-y-4">
              {analytics.paymentBreakdown.map((pm) => {
                const percent =
                  summary.totalVolume > 0
                    ? Math.round((pm.amount / summary.totalVolume) * 100)
                    : 0;

                return (
                  <div key={pm.method} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {pm.method.replace('_', ' ')}
                      </span>
                      <span className="font-mono text-neutral-500 dark:text-neutral-400">
                        ₱{pm.amount.toLocaleString()} ({percent}%)
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-neutral-100 dark:bg-neutral-900 overflow-hidden">
                      <div
                        className="h-full bg-black dark:bg-white rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(5, percent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Categories Distribution */}
        <div className="p-6 rounded-3xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-neutral-900 dark:text-white" />
              <span>Top Category Activity</span>
            </h2>
            <span className="text-xs text-neutral-400 font-mono">System-Wide</span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-xs text-neutral-400">Loading category telemetry...</div>
          ) : analytics.categoryBreakdown.length === 0 ? (
            <div className="text-center py-12 text-xs text-neutral-400">No category logs recorded yet.</div>
          ) : (
            <div className="space-y-4">
              {analytics.categoryBreakdown.map((cat) => {
                const percent =
                  summary.totalVolume > 0
                    ? Math.round((cat.amount / summary.totalVolume) * 100)
                    : 0;

                return (
                  <div key={cat.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {cat.category}
                      </span>
                      <span className="font-mono text-neutral-500 dark:text-neutral-400">
                        ₱{cat.amount.toLocaleString()} ({percent}%)
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-neutral-100 dark:bg-neutral-900 overflow-hidden">
                      <div
                        className="h-full bg-black dark:bg-white rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(5, percent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* System Health Card */}
      <div className="p-6 rounded-3xl bg-neutral-900 text-white dark:bg-neutral-950 border border-neutral-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">PostgreSQL 18 & Fastify Cluster</h3>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-mono text-emerald-400">ONLINE</span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Render deployment active with automated connection pooling and live synchronization.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-neutral-400">
            <div>
              <span className="text-neutral-500">API: </span>
              <span className="text-white">v1.0.0</span>
            </div>
            <div>
              <span className="text-neutral-500">DB: </span>
              <span className="text-white">PostgreSQL</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
