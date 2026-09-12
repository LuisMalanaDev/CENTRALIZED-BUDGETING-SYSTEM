'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  ShieldCheck,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  X,
  Lock,
  Trash2,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface VaultGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string | null;
  color: string;
  icon: string;
  isLocked: boolean;
  progressPercent: number;
  remainingAmount: number;
  isCompleted: boolean;
}

export default function SavingsVaultsPage() {
  const { user } = useAuth();
  const currency = user?.currency || 'PHP';

  const [goals, setGoals] = useState<VaultGoal[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Vault modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newCurrent, setNewCurrent] = useState('');
  const [newDate, setNewDate] = useState('');

  // Deposit/Withdraw Modal
  const [activeGoal, setActiveGoal] = useState<VaultGoal | null>(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferAction, setTransferAction] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [selectedAccount, setSelectedAccount] = useState('');

  const fetchVaults = useCallback(async () => {
    try {
      const [res, accRes] = await Promise.all([
        api.get<{ goals: VaultGoal[] }>('/api/savings-goals'),
        api.get<{ accounts: any[] }>('/api/accounts'),
      ]);
      setGoals(res.goals || []);
      setAccounts(accRes.accounts || []);
    } catch (err) {
      console.error('Failed to load vaults', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVaults();
  }, [fetchVaults]);

  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(newTarget);
    if (!newName || isNaN(target) || target <= 0) return;

    try {
      await api.post('/api/savings-goals', {
        name: newName,
        targetAmount: target,
        currentAmount: parseFloat(newCurrent) || 0,
        targetDate: newDate || undefined,
      });
      setIsCreateOpen(false);
      setNewName('');
      setNewTarget('');
      setNewCurrent('');
      setNewDate('');
      fetchVaults();
    } catch (err: any) {
      alert(err.message || 'Failed to create vault');
    }
  };

  const handleDepositWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGoal) return;
    const num = parseFloat(transferAmount);
    if (isNaN(num) || num <= 0) return;

    try {
      await api.post(`/api/savings-goals/${activeGoal.id}/deposit`, {
        amount: num,
        action: transferAction,
        accountId: selectedAccount || undefined,
      });
      setActiveGoal(null);
      setTransferAmount('');
      fetchVaults();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wealthsync:refresh'));
      }
    } catch (err: any) {
      alert(err.message || 'Failed to process vault funds');
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!confirm('Are you sure you want to delete this savings vault?')) return;
    try {
      await api.delete(`/api/savings-goals/${id}`);
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete vault');
    }
  };

  const totalSavedInVaults = goals.reduce((sum, g) => sum + g.currentAmount, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
            Savings Envelopes & Vaults
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Ring-fence funds for emergency cushions, dream trips, and high-ticket hardware.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-sm transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Savings Vault</span>
        </button>
      </div>

      {/* Vaults Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {goals.map((goal) => {
          return (
            <div
              key={goal.id}
              className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm border border-neutral-200 dark:border-neutral-800">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                        {goal.name}
                      </h3>
                      {goal.targetDate && (
                        <p className="text-[11px] text-neutral-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          <span>Target: {formatDate(goal.targetDate)}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteGoal(goal.id)}
                    className="p-1 text-neutral-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                    title="Delete goal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Amounts */}
                <div className="mt-6 flex items-baseline justify-between">
                  <div>
                    <span className="text-[11px] font-semibold uppercase text-neutral-400 block">
                      Saved in Vault
                    </span>
                    <span className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                      {formatCurrency(goal.currentAmount, currency)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-semibold uppercase text-neutral-400 block">
                      Target
                    </span>
                    <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                      {formatCurrency(goal.targetAmount, currency)}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="w-full h-2.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      style={{
                        width: `${Math.min(100, goal.progressPercent)}%`,
                      }}
                      className="h-full rounded-full transition-all duration-500 bg-black dark:bg-white"
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs font-semibold">
                    <span className="text-neutral-900 dark:text-white">
                      {goal.progressPercent}% achieved
                    </span>
                    <span className="text-neutral-400 font-normal">
                      {goal.remainingAmount > 0
                        ? `${formatCurrency(goal.remainingAmount, currency)} left`
                        : 'Goal Completed!'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex gap-2">
                <button
                  onClick={() => {
                    setActiveGoal(goal);
                    setTransferAction('DEPOSIT');
                  }}
                  className="flex-1 py-2 rounded-xl font-semibold text-xs text-white bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>Deposit</span>
                </button>
                <button
                  onClick={() => {
                    setActiveGoal(goal);
                    setTransferAction('WITHDRAW');
                  }}
                  className="flex-1 py-2 rounded-xl font-semibold text-xs border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Withdraw</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Deposit / Withdraw Modal */}
      {activeGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                {transferAction === 'DEPOSIT' ? 'Deposit to' : 'Withdraw from'} {activeGoal.name}
              </h3>
              <button
                onClick={() => setActiveGoal(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDepositWithdraw} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold uppercase text-neutral-500 mb-1">
                  Amount ({currency})
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 font-bold text-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-neutral-500 mb-1">
                  Connected Account (Optional)
                </label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white"
                >
                  <option value="">None (Adjust vault balance only)</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatCurrency(a.balance, currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveGoal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-sm"
                >
                  Confirm {transferAction === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Vault Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                Create Savings Vault
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVault} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold uppercase text-neutral-500 mb-1">
                  Vault Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Japan Autumn Adventure 2026"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-neutral-500 mb-1">
                  Target Goal Amount ({currency})
                </label>
                <input
                  type="number"
                  placeholder="e.g. 85000"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-neutral-500 mb-1">
                  Initial Deposit (Optional)
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={newCurrent}
                  onChange={(e) => setNewCurrent(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-neutral-500 mb-1">
                  Target Completion Date (Optional)
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-sm"
                >
                  Lock & Create Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
