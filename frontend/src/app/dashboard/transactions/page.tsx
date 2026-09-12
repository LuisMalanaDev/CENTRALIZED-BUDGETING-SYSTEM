'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, getTagColor } from '@/lib/utils';
import { DateFilterBar, DateFilterRange } from '@/components/dashboard/DateFilterBar';
import {
  Receipt,
  Search,
  Filter,
  Plus,
  Trash2,
  ShoppingBag,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  Calendar,
} from 'lucide-react';

export default function TransactionsLedgerPage() {
  const { user } = useAuth();
  const currency = user?.currency || 'PHP';

  const [dateFilter, setDateFilter] = useState<DateFilterRange | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<string>('');

  const dateFilterRef = useRef<DateFilterRange | null>(null);

  const fetchTransactions = useCallback(async (filterOverride?: DateFilterRange | null) => {
    setLoading(true);
    try {
      const activeFilter = filterOverride !== undefined ? filterOverride : dateFilterRef.current;
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (typeFilter) params.append('type', typeFilter);
      if (methodFilter) params.append('paymentMethod', methodFilter);
      if (activeFilter?.startDate) params.append('startDate', activeFilter.startDate);
      if (activeFilter?.endDate) params.append('endDate', activeFilter.endDate);
      params.append('limit', '100');

      const res = await api.get<{ transactions: any[]; total: number }>(
        `/api/transactions?${params.toString()}`
      );
      setTransactions(res.transactions || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load transactions', err);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, methodFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTransactions();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchTransactions]);

  useEffect(() => {
    const handleGlobalRefresh = () => fetchTransactions();
    window.addEventListener('wealthsync:refresh', handleGlobalRefresh);
    return () => window.removeEventListener('wealthsync:refresh', handleGlobalRefresh);
  }, [fetchTransactions]);

  const handleDateFilterChange = useCallback((range: DateFilterRange) => {
    dateFilterRef.current = range;
    setDateFilter(range);
    fetchTransactions(range);
  }, [fetchTransactions]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await api.delete(`/api/transactions/${id}`);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wealthsync:refresh'));
      }
    } catch (err: any) {
      alert(`Failed to delete transaction: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
            Transaction Ledger
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Complete audit trail of all financial inflows and outflows ({total} entries for {dateFilter?.label || 'selected period'}).
          </p>
        </div>

        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('wealthsync:open-modal', { detail: { mode: 'EXPENSE' } }));
            }
          }}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-sm flex items-center gap-1.5 cursor-pointer transition-all self-start sm:self-auto active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Quick Log</span>
        </button>
      </div>

      {/* CALENDAR FILTER (Day, Month, Year, All Time) */}
      <DateFilterBar onChange={handleDateFilterChange} defaultPeriod="month" />

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm flex flex-col sm:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transactions, merchants, order IDs..."
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
          />
        </div>

        {/* Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 text-xs font-medium rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
        >
          <option value="">All Types</option>
          <option value="EXPENSE">Expense Only</option>
          <option value="INCOME">Income Only</option>
        </select>

        {/* Payment Method Filter */}
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 text-xs font-medium rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
        >
          <option value="">All Payment Channels</option>
          <option value="GCASH">GCash</option>
          <option value="MAYA">Maya</option>
          <option value="CREDIT_CARD">Credit Card</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
          <option value="CASH">Cash</option>
        </select>
      </div>

      {/* Transactions Table */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 dark:bg-neutral-900 text-neutral-400 uppercase tracking-wider font-semibold border-b border-neutral-200 dark:border-neutral-800">
              <tr>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Description</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Method</th>
                <th className="px-5 py-3.5 text-right">Amount</th>
                <th className="px-5 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-neutral-400">
                    Loading transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-neutral-400">
                    No transactions recorded yet.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const isIncome = tx.type === 'INCOME';
                  return (
                    <tr key={tx.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap text-neutral-500 dark:text-neutral-400 font-mono">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700">
                            {tx.isShopeeOrder ? (
                              <ShoppingBag className="w-3.5 h-3.5" />
                            ) : isIncome ? (
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-neutral-900 dark:text-white">
                              {tx.description}
                            </p>
                            {tx.orderTrackingNumber && (
                              <span className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                                Ref: {tx.orderTrackingNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                          {tx.category?.name || 'General'}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-neutral-600 dark:text-neutral-400 font-mono">
                        {tx.paymentMethod?.replace('_', ' ')}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-right font-bold font-mono">
                        <span className="text-neutral-900 dark:text-white">
                          {isIncome ? '+' : '-'}{formatCurrency(tx.amount, currency)}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-black dark:hover:bg-white dark:hover:text-black transition-colors"
                          title="Delete transaction"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
