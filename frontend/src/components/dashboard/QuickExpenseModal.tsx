'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Check,
  ShoppingBag,
  ShoppingCart,
  Utensils,
  Smartphone,
  Zap,
  ArrowDownLeft,
  ArrowUpRight,
  Briefcase,
  Laptop,
  Banknote,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';

interface QuickExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  currency?: string;
  defaultType?: 'EXPENSE' | 'INCOME';
}

export function QuickExpenseModal({
  isOpen,
  onClose,
  onSuccess,
  currency = 'PHP',
  defaultType = 'EXPENSE',
}: QuickExpenseModalProps) {
  const [mode, setMode] = useState<'EXPENSE' | 'INCOME'>(defaultType);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('Shopee');
  const [paymentMethod, setPaymentMethod] = useState<'GCASH' | 'CREDIT_CARD' | 'CASH' | 'MAYA' | 'BANK_TRANSFER'>('GCASH');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMode(defaultType);
      if (defaultType === 'INCOME') {
        setSelectedTag('Salary');
        setDescription('Monthly Salary');
        setPaymentMethod('BANK_TRANSFER');
      } else {
        setSelectedTag('Shopee');
        setDescription('Shopee Order');
        setPaymentMethod('GCASH');
      }
      setAmount('');
      setError('');
    }
  }, [isOpen, defaultType]);

  if (!isOpen) return null;

  interface PresetItem {
    label: string;
    icon: any;
    desc: string;
    defaultMethod: 'GCASH' | 'CREDIT_CARD' | 'CASH' | 'MAYA' | 'BANK_TRANSFER';
  }

  const expensePresets: PresetItem[] = [
    { label: 'Shopee', icon: ShoppingBag, desc: 'Shopee Order', defaultMethod: 'GCASH' },
    { label: 'GCash', icon: Smartphone, desc: 'GCash Transfer', defaultMethod: 'GCASH' },
    { label: 'Food', icon: Utensils, desc: 'Food Delivery / Dining', defaultMethod: 'GCASH' },
    { label: 'Groceries', icon: ShoppingCart, desc: 'Supermarket Groceries', defaultMethod: 'CREDIT_CARD' },
    { label: 'Utilities', icon: Zap, desc: 'Monthly Bill Payment', defaultMethod: 'GCASH' },
  ];

  const incomePresets: PresetItem[] = [
    { label: 'Salary', icon: Briefcase, desc: 'Monthly Salary / Paycheck', defaultMethod: 'BANK_TRANSFER' },
    { label: 'Freelance', icon: Laptop, desc: 'Freelance / Client Gig', defaultMethod: 'GCASH' },
    { label: 'Allowance', icon: Wallet, desc: 'Allowance / Family Funds', defaultMethod: 'GCASH' },
    { label: 'Starting Cash', icon: Banknote, desc: 'Starting Money on Hand', defaultMethod: 'CASH' },
    { label: 'Bonus / Gift', icon: TrendingUp, desc: 'Bonus / Gift Received', defaultMethod: 'BANK_TRANSFER' },
  ];

  const currentPresets = mode === 'EXPENSE' ? expensePresets : incomePresets;

  const handleSelectPreset = (preset: PresetItem) => {
    setSelectedTag(preset.label);
    setDescription(preset.desc);
    setPaymentMethod(preset.defaultMethod);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/api/transactions', {
        amount: numAmount,
        type: mode,
        description: description || `${selectedTag} ${mode === 'INCOME' ? 'Inflow' : 'Expense'}`,
        paymentMethod,
        source: selectedTag,
        tags: [selectedTag, mode === 'INCOME' ? 'Income' : 'Expense'],
        isShopeeOrder: mode === 'EXPENSE' && selectedTag === 'Shopee',
      });

      setAmount('');
      setDescription('');
      onClose();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wealthsync:refresh'));
      }
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white flex items-center justify-center border border-neutral-200 dark:border-neutral-800">
              {mode === 'INCOME' ? <ArrowDownLeft className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-white text-base">
                {mode === 'INCOME' ? 'Add Money / Income' : 'Log Quick Expense'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {mode === 'INCOME' ? 'Where did it come from? Adds to your money left.' : 'Deducts automatically from your money left.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Toggle Tabs (Expense vs Income) */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => {
                setMode('EXPENSE');
                setSelectedTag('Shopee');
                setDescription('Shopee Order');
                setPaymentMethod('GCASH');
              }}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'EXPENSE'
                  ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Log Expense (Minus)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('INCOME');
                setSelectedTag('Salary');
                setDescription('Monthly Salary');
                setPaymentMethod('BANK_TRANSFER');
              }}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'INCOME'
                  ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Add Money (Plus)</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700 font-medium">
              {error}
            </div>
          )}

          {/* Quick preset tags */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
              {mode === 'INCOME' ? 'Where did this money come from?' : 'Fast Category'}
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {currentPresets.map((preset) => {
                const Icon = preset.icon;
                const isSelected = selectedTag === preset.label;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black scale-[1.02] shadow-sm font-bold'
                        : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px] truncate w-full text-center">{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
              {mode === 'INCOME' ? `How much money received? (${currency})` : `Amount Spent (${currency})`}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-neutral-400">
                {currency === 'PHP' ? '₱' : '$'}
              </span>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
                className="w-full pl-10 pr-4 py-3 text-3xl font-extrabold rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white font-mono"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
              {mode === 'INCOME' ? 'Note / Source Details' : 'Description / Item'}
            </label>
            <input
              type="text"
              placeholder={mode === 'INCOME' ? 'e.g. Monthly Salary from Tech Corp' : 'e.g. Shopee Wireless Keyboard'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
          </div>

          {/* Destination / Payment Channel */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
              {mode === 'INCOME' ? 'Where is this money kept / deposited?' : 'Payment Channel'}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(['GCASH', 'BANK_TRANSFER', 'CASH', 'MAYA', 'CREDIT_CARD'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    paymentMethod === method
                      ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white font-semibold shadow-sm'
                      : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {method === 'BANK_TRANSFER' ? 'Bank Account' : method.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-neutral-200 dark:border-neutral-800 text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{mode === 'INCOME' ? 'Add Money (Inflow)' : 'Log Expense (Minus)'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
