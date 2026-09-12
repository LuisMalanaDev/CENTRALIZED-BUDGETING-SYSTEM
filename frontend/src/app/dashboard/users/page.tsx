'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Users,
  Search,
  RefreshCw,
  Wallet,
  Receipt,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

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

interface AdminSummary {
  totalUsers: number;
  totalTransactions: number;
  totalWallets: number;
  totalVolume: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [summary, setSummary] = useState<AdminSummary>({
    totalUsers: 0,
    totalTransactions: 0,
    totalWallets: 0,
    totalVolume: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsersData = useCallback(async () => {
    try {
      const [usersRes, sumRes] = await Promise.all([
        api.get<{ users: AdminUserItem[] }>('/api/admin/users').catch(() => ({ users: [] })),
        api.get<AdminSummary>('/api/admin/summary').catch(() => null),
      ]);

      if (usersRes?.users) setUsers(usersRes.users);
      if (sumRes) setSummary(sumRes);
    } catch (err) {
      console.warn('Failed to load users data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsersData();
  }, [fetchUsersData]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchUsersData();
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

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
            <span className="text-xs font-bold text-neutral-900 dark:text-white">Users Directory</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2.5">
            <Users className="w-7 h-7" />
            <span>Admin&apos;s Users Directory</span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Overview of all registered users (girlfriend, friends, family, and accounts).
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

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
            Total Users
          </span>
          <p className="text-2xl font-extrabold text-neutral-900 dark:text-white mt-1">
            {summary.totalUsers}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">Mobile & Web accounts</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
            Active Accounts
          </span>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {users.length}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">100% active state</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
            Total Logged
          </span>
          <p className="text-2xl font-extrabold text-neutral-900 dark:text-white mt-1">
            {summary.totalTransactions}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">Recorded user transactions</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
            Total Wallets
          </span>
          <p className="text-2xl font-extrabold text-neutral-900 dark:text-white mt-1">
            {summary.totalWallets}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">GCash, Maya, Cash & Banks</p>
        </div>
      </div>

      {/* Directory Table Card */}
      <div className="p-6 rounded-3xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-neutral-900 dark:text-white" />
              <span>Registered Accounts ({filteredUsers.length})</span>
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Live user roster synced with the PostgreSQL production database.
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
                  <td colSpan={7} className="text-center py-12 text-neutral-400">
                    Loading users directory...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-neutral-400">
                    No users found matching your search. Once your friends register on mobile, they will appear here!
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
                        <span className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-[11px]">
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
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
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
    </div>
  );
}
