'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  Users,
  Receipt,
  TrendingUp,
  ShieldCheck,
  Search,
  Wallet,
  Calendar,
  CreditCard,
  CheckCircle2,
  Activity,
  RefreshCw,
  ArrowRight,
  BarChart3,
  LayoutDashboard,
} from 'lucide-react';

interface AdminSummary {
  totalUsers: number;
  totalTransactions: number;
  totalWallets: number;
  totalVolume: number;
  totalExpenses: number;
  totalIncome: number;
  systemStatus: string;
}

interface AdminUserItem {
  id: string;
  email: string;
  name: string;
  currency: string;
  createdAt: string;
  transactionCount: number;
  walletCount: number;
  totalBalance: number;
}

interface AdminAnalytics {
  categoryBreakdown: { category: string; amount: number }[];
  paymentBreakdown: { method: string; amount: number }[];
  totalRecords: number;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AdminSummary>({
    totalUsers: 0,
    totalTransactions: 0,
    totalWallets: 0,
    totalVolume: 0,
    totalExpenses: 0,
    totalIncome: 0,
    systemStatus: 'ONLINE',
  });
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics>({
    categoryBreakdown: [],
    paymentBreakdown: [],
    totalRecords: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchAdminData = useCallback(async () => {
    try {
      const [sumRes, usersRes, analyticsRes] = await Promise.all([
        api.get<AdminSummary>('/api/admin/summary').catch(() => null),
        api.get<{ users: AdminUserItem[] }>('/api/admin/users').catch(() => ({ users: [] })),
        api.get<AdminAnalytics>('/api/admin/analytics').catch(() => ({
          categoryBreakdown: [],
          paymentBreakdown: [],
          totalRecords: 0,
        })),
      ]);

      if (sumRes) setSummary(sumRes);
      if (usersRes?.users) setUsers(usersRes.users);
      if (analyticsRes) setAnalytics(analyticsRes);
    } catch (err) {
      console.warn('Failed to load admin data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchAdminData();
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-8 pb-16">
      {/* Top Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-black dark:text-white" />
            <span>Admin Command Center</span>
            <span className="w-1 h-1 rounded-full bg-emerald-500" />
            <span className="text-emerald-600 dark:text-emerald-400">Live PostgreSQL</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            System Overview & User Directory
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Real-time analytics and telemetry for all active users across web and mobile.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {/* Quick Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider mr-1">Navigation:</span>
        <Link
          href="/dashboard"
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-neutral-900 text-white dark:bg-white dark:text-black shadow-sm flex items-center gap-1.5"
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Admin Overview</span>
        </Link>
        <Link
          href="/dashboard/users"
          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors flex items-center gap-1.5"
        >
          <Users className="w-3.5 h-3.5" />
          <span>Users Directory</span>
          <span className="text-[9px] font-mono px-1 py-0.2 rounded border border-neutral-200 dark:border-neutral-800 text-emerald-600 dark:text-emerald-400 font-bold">
            Live
          </span>
        </Link>
        <Link
          href="/dashboard/analytics"
          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors flex items-center gap-1.5"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>System Analytics</span>
        </Link>
      </div>

      {/* 4 Top KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Users</span>
            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-neutral-900 dark:text-white">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            {summary.totalUsers}
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Registered accounts on mobile & web
          </p>
        </div>

        {/* Total Transactions */}
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Transactions</span>
            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-neutral-900 dark:text-white">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            {summary.totalTransactions}
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Logged entries across all accounts
          </p>
        </div>

        {/* Total Platform Volume */}
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs font-semibold uppercase tracking-wider">
            <span>System Volume</span>
            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-neutral-900 dark:text-white">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            ₱{summary.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Total monetary activity recorded
          </p>
        </div>

        {/* Total Wallets / Accounts */}
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs font-semibold uppercase tracking-wider">
            <span>Active Wallets</span>
            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-neutral-900 dark:text-white">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            {summary.totalWallets}
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            GCash, Maya, cash, & bank accounts
          </p>
        </div>
      </div>

      {/* SECTION: Admin's Users Directory Table */}
      <div id="users" className="p-6 rounded-3xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-neutral-900 dark:text-white" />
                <span>Admin&apos;s Users Directory</span>
              </h2>
              <Link
                href="/dashboard/users"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
              >
                <span>Full Page</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Overview of all registered users (girlfriend, friends, family, and accounts).
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user by name or email..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Currency</th>
                <th className="py-3 px-4">Registered Date</th>
                <th className="py-3 px-4 text-center">Transactions</th>
                <th className="py-3 px-4 text-center">Active Wallets</th>
                <th className="py-3 px-4 text-right">Tracked Balance</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-neutral-400">
                    Loading users directory...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-neutral-400">
                    No users found. Once your friends register on mobile, they will appear here!
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const joinedDate = new Date(u.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-black dark:bg-white text-white dark:text-black font-bold text-xs flex items-center justify-center shrink-0">
                            {u.name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-neutral-900 dark:text-white truncate">
                              {u.name}
                            </div>
                            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono truncate">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono font-medium text-neutral-700 dark:text-neutral-300">
                        {u.currency}
                      </td>

                      <td className="py-3 px-4 text-neutral-500 dark:text-neutral-400">
                        {joinedDate}
                      </td>

                      <td className="py-3 px-4 text-center font-semibold text-neutral-900 dark:text-white">
                        <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                          {u.transactionCount} logs
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center text-neutral-600 dark:text-neutral-400">
                        {u.walletCount} wallets
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900 dark:text-white">
                        ₱{u.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION: Platform Analytics & Payment Methods Breakdown */}
      <div id="analytics" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-neutral-900 dark:text-white" />
                <span>System & Platform Analytics</span>
              </h2>
              <Link
                href="/dashboard/analytics"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
              >
                <span>Full Page</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Financial volume and distribution across payment rails and spending categories.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods Breakdown */}
        <div className="p-6 rounded-3xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-neutral-900 dark:text-white" />
              <span>Payment Methods Volume</span>
            </h2>
            <span className="text-xs text-neutral-400 font-mono">Platform Distribution</span>
          </div>

          {analytics.paymentBreakdown.length === 0 ? (
            <div className="text-center py-8 text-xs text-neutral-400">
              No payment activity recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.paymentBreakdown.map((pm) => {
                const percent =
                  summary.totalVolume > 0
                    ? Math.round((pm.amount / summary.totalVolume) * 100)
                    : 0;

                return (
                  <div key={pm.method} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {pm.method}
                      </span>
                      <span className="font-mono text-neutral-500 dark:text-neutral-400">
                        ₱{pm.amount.toLocaleString()} ({percent}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-900 overflow-hidden">
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

        {/* Top Spending Categories */}
        <div className="p-6 rounded-3xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-neutral-900 dark:text-white" />
              <span>Top Category Activity</span>
            </h2>
            <span className="text-xs text-neutral-400 font-mono">System-Wide</span>
          </div>

          {analytics.categoryBreakdown.length === 0 ? (
            <div className="text-center py-8 text-xs text-neutral-400">
              No category logs recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.categoryBreakdown.slice(0, 6).map((cat) => {
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
                    <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-900 overflow-hidden">
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
    </div>
    </div>
  );
}
