'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  PieChart,
  Plus,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
} from 'lucide-react';

interface BudgetWithMetrics {
  id: string;
  name: string;
  amount: number;
  categoryId?: string | null;
  category?: { name: string; slug: string; color?: string } | null;
  period: string;
  spent: number;
  remaining: number;
  percentUsed: number;
  status: 'NORMAL' | 'WARNING' | 'EXCEEDED';
}

export default function DynamicBudgetsPage() {
  const { user } = useAuth();
  const currency = user?.currency || 'PHP';

  const [budgets, setBudgets] = useState<BudgetWithMetrics[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);

  // New budget modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [budgetName, setBudgetName] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>('');

  const fetchBudgets = useCallback(async () => {
    try {
      const [res, catRes] = await Promise.all([
        api.get<{ budgets: BudgetWithMetrics[]; totalMonthlyExpense: number }>('/api/budgets'),
        api.get<{ categories: any[] }>('/api/categories'),
      ]);
      setBudgets(res.budgets || []);
      setTotalSpent(res.totalMonthlyExpense || 0);
      setCategories(catRes.categories || []);
    } catch (err) {
      console.error('Failed to load budgets', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(budgetAmount);
    if (!budgetName || isNaN(num) || num <= 0) return;

    try {
      await api.post('/api/budgets', {
        name: budgetName,
        amount: num,
        categoryId: selectedCatId || null,
      });
      setIsModalOpen(false);
      setBudgetName('');
      setBudgetAmount('');
      setSelectedCatId('');
      fetchBudgets();
    } catch (err: any) {
      alert(err.message || 'Failed to create budget');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this budget limit?')) return;
    try {
      await api.delete(`/api/budgets/${id}`);
      setBudgets((prev) => prev.filter((b) => b.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete budget');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
            Dynamic Budgeting Envelopes
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Maintain strict spending caps across online shopping, food delivery, and household bills.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-sm transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Budget Cap</span>
        </button>
      </div>

      {/* Budget Envelope Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {budgets.map((b) => {
          const isExceeded = b.status === 'EXCEEDED';
          const isWarning = b.status === 'WARNING';

          return (
            <div
              key={b.id}
              className={`p-6 rounded-2xl border bg-white dark:bg-black shadow-sm transition-all ${
                isExceeded
                  ? 'border-neutral-900 dark:border-white ring-1 ring-neutral-900 dark:ring-white'
                  : isWarning
                  ? 'border-neutral-400 dark:border-neutral-600'
                  : 'border-neutral-200 dark:border-neutral-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                      {b.name}
                    </h3>
                    {isExceeded && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-900 text-white dark:bg-white dark:text-black flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Exceeded
                      </span>
                    )}
                    {isWarning && !isExceeded && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-200 text-black dark:bg-neutral-800 dark:text-white border border-neutral-300 dark:border-neutral-700 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> 80%+ Used
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {b.category ? b.category.name : 'Overall Monthly Spending Limit'}
                  </p>
                </div>

                <button
                  onClick={() => handleDelete(b.id)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  title="Remove budget"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Numbers */}
              <div className="mt-5 flex items-baseline justify-between">
                <div>
                  <span className="text-xs text-neutral-400 block">Spent so far</span>
                  <span className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                    {formatCurrency(b.spent, currency)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-neutral-400 block">Cap Allowance</span>
                  <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                    {formatCurrency(b.amount, currency)}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="w-full h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, b.percentUsed)}%` }}
                    className="h-full rounded-full transition-all duration-500 bg-black dark:bg-white"
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs font-medium text-neutral-500">
                  <span>{b.percentUsed}% consumed</span>
                  <span className="text-neutral-900 dark:text-white font-semibold">
                    {b.remaining > 0
                      ? `${formatCurrency(b.remaining, currency)} remaining`
                      : '0.00 left'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* New Budget Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                Create Budget Cap
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBudget} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold uppercase text-neutral-500 mb-1">
                  Budget Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dining Out & Food Delivery"
                  value={budgetName}
                  onChange={(e) => setBudgetName(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-neutral-500 mb-1">
                  Monthly Limit ({currency})
                </label>
                <input
                  type="number"
                  placeholder="e.g. 10000"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-neutral-500 mb-1">
                  Category (Optional - Leave blank for Overall Monthly Cap)
                </label>
                <select
                  value={selectedCatId}
                  onChange={(e) => setSelectedCatId(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white"
                >
                  <option value="">(None) Overall Monthly Spending Cap</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-sm"
                >
                  Create Envelope
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
