'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, getTagColor } from '@/lib/utils';
import {
  ShoppingBag,
  ShoppingCart,
  Utensils,
  Smartphone,
  Upload,
  FileText,
  Sparkles,
  Check,
  AlertCircle,
  Clock,
  ExternalLink,
  Plus,
  Filter,
  Mail,
  Copy,
  Send,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { DateFilterBar, DateFilterRange } from '@/components/dashboard/DateFilterBar';

interface ParsedDraft {
  description: string;
  amount: number;
  date: string;
  paymentMethod: string;
  source: string;
  tags: string[];
  suggestedCategorySlug: string;
  isShopeeOrder: boolean;
  orderTrackingNumber?: string;
  rawText?: string;
}

export default function ExternalOrderTrackerPage() {
  const { user } = useAuth();
  const currency = user?.currency || 'PHP';

  const [dateFilter, setDateFilter] = useState<DateFilterRange | null>(null);
  const [activeTab, setActiveTab] = useState<'parser' | 'email' | 'logger'>('email');

  // Parser state
  const [rawText, setRawText] = useState('');
  const [parsedDrafts, setParsedDrafts] = useState<ParsedDraft[]>([]);
  const [parseLoading, setParseLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const [parserSuccess, setParserSuccess] = useState('');
  const [parserError, setParserError] = useState('');

  // Tracker Metrics & Budgets
  const [trackerData, setTrackerData] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [filterSource, setFilterSource] = useState<string>('ALL');

  // Email Forwarding & Webhook Simulation state
  const [emailConfig, setEmailConfig] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [simFrom, setSimFrom] = useState('order-update@shopee.ph');
  const [simSubject, setSimSubject] = useState('Shopee: Your Order SPXPH260930M82X is confirmed!');
  const [simBody, setSimBody] = useState(`Hi ${user?.name || 'Customer'},
Your order SPXPH260930M82X has been placed successfully.

Order Summary:
Item(s): 1x Baseus 65W GaN Multi-Port Fast Charger
Total Payment: PHP 1,890.00
Payment Method: GCash
Tracking: SPXPH260930M82X

Thank you for shopping on Shopee!`);
  const [simLoading, setSimLoading] = useState(false);
  const [simSuccess, setSimSuccess] = useState('');
  const [simError, setSimError] = useState('');

  // Manual Quick Logger Form
  const [manualAmount, setManualAmount] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualTag, setManualTag] = useState('Shopee');
  const [manualMethod, setManualMethod] = useState('GCASH');
  const [manualTracking, setManualTracking] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualMsg, setManualMsg] = useState('');

  const dateFilterRef = useRef<DateFilterRange | null>(null);

  const fetchTrackerData = useCallback(async (filterOverride?: DateFilterRange | null) => {
    try {
      const activeFilter = filterOverride !== undefined ? filterOverride : dateFilterRef.current;
      const params = new URLSearchParams();
      if (activeFilter?.startDate) params.append('startDate', activeFilter.startDate);
      if (activeFilter?.endDate) params.append('endDate', activeFilter.endDate);
      const queryStr = params.toString() ? `?${params.toString()}` : '';

      const [trkData, config] = await Promise.all([
        api.get<any>(`/api/analytics/shopping-tracker${queryStr}`),
        api.get<any>('/api/webhooks/config').catch(() => null),
      ]);
      setTrackerData(trkData);
      setRecentOrders(trkData.recentOrders || []);
      if (config) setEmailConfig(config);
    } catch (err) {
      console.error('Failed to fetch tracker data', err);
    }
  }, []);

  useEffect(() => {
    fetchTrackerData();
  }, [fetchTrackerData]);

  useEffect(() => {
    const handleGlobalRefresh = () => fetchTrackerData();
    window.addEventListener('wealthsync:refresh', handleGlobalRefresh);
    return () => window.removeEventListener('wealthsync:refresh', handleGlobalRefresh);
  }, [fetchTrackerData]);

  const handleDateFilterChange = useCallback((range: DateFilterRange) => {
    dateFilterRef.current = range;
    setDateFilter(range);
    fetchTrackerData(range);
  }, [fetchTrackerData]);

  // Copy forwarding email to clipboard
  const handleCopyForwardingEmail = () => {
    const emailToCopy = emailConfig?.forwardingAddress || `orders+${user?.id || 'demo'}@inbound.wealthsync.io`;
    navigator.clipboard.writeText(emailToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simulate incoming webhook email
  const handleSimulateEmail = async () => {
    setSimLoading(true);
    setSimError('');
    setSimSuccess('');

    try {
      const res = await api.post<any>('/api/webhooks/simulate', {
        from: simFrom,
        to: emailConfig?.forwardingAddress || `orders+${user?.id}@inbound.wealthsync.io`,
        subject: simSubject,
        text: simBody,
      });

      setSimSuccess(res.message || 'Email successfully received and expense logged!');
      fetchTrackerData();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wealthsync:refresh'));
      }
    } catch (err: any) {
      setSimError(err.message || 'Simulation failed');
    } finally {
      setSimLoading(false);
    }
  };

  // Quick preset fills for raw text parser
  const fillShopeeSample = () => {
    setRawText(`Shopee Order Confirmation:
Order ID: SPXPH260920X91Z
1x Keychron K3 Ultra-Slim Mechanical Keyboard (Optical Brown) - ₱4,250.00
1x Ergonomic Wrist Rest Mat - ₱650.00
Payment Method: GCash
Total Payment: ₱4,900.00`);
    setParserError('');
    setParserSuccess('');
  };

  const fillGcashSample = () => {
    setRawText(`You have paid PHP 1,280.00 of GrabFood using GCash on 09/12/2026. Ref. No. 918237461.
You have paid PHP 3,450.00 of SM Supermarket Grocery using GCash on 09/12/2026. Ref. No. 582719382.`);
    setParserError('');
    setParserSuccess('');
  };

  const fillCsvSample = () => {
    setRawText(`Date,Description,Amount,Category,PaymentMethod
2026-09-12,Shopee - Ugreen USB-C Cable Pack,420.00,Shopee,GCash
2026-09-11,Puregold Pantry Restock,2850.00,Groceries,Credit Card
2026-09-10,FoodPanda Dinner Delivery,650.00,Food,GCash`);
    setParserError('');
    setParserSuccess('');
  };

  const handleParse = async () => {
    if (!rawText.trim()) {
      setParserError('Please paste or type text/receipt statements to parse.');
      return;
    }

    setParseLoading(true);
    setParserError('');
    setParserSuccess('');

    try {
      const res = await api.post<{ parsedItems: ParsedDraft[]; totalCount: number; totalAmount: number }>(
        '/api/transactions/parse-import',
        { rawText }
      );

      if (res.parsedItems && res.parsedItems.length > 0) {
        setParsedDrafts(res.parsedItems);
        setParserSuccess(`Successfully parsed ${res.parsedItems.length} transactions (${formatCurrency(res.totalAmount, currency)})! Review below and commit.`);
      } else {
        setParserError('No transactions could be extracted. Check the format or paste a sample.');
      }
    } catch (err: any) {
      setParserError(err.message || 'Failed to parse text input.');
    } finally {
      setParseLoading(false);
    }
  };

  const handleCommitBatch = async () => {
    if (parsedDrafts.length === 0) return;
    setCommitLoading(true);
    setParserError('');

    try {
      await api.post('/api/transactions/bulk', { items: parsedDrafts });
      setParserSuccess(`🎉 All ${parsedDrafts.length} transactions committed to your ledger successfully!`);
      setParsedDrafts([]);
      setRawText('');
      fetchTrackerData();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wealthsync:refresh'));
      }
    } catch (err: any) {
      setParserError(err.message || 'Failed to save transactions.');
    } finally {
      setCommitLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(manualAmount);
    if (isNaN(num) || num <= 0) {
      setManualMsg('Please enter a valid amount.');
      return;
    }

    setManualLoading(true);
    setManualMsg('');

    try {
      await api.post('/api/transactions', {
        amount: num,
        type: 'EXPENSE',
        description: manualDesc || `${manualTag} Purchase`,
        paymentMethod: manualMethod,
        source: manualTag === 'Shopee' ? 'Shopee' : manualTag,
        tags: [manualTag],
        isShopeeOrder: manualTag === 'Shopee',
        orderTrackingNumber: manualTracking || undefined,
      });

      setManualAmount('');
      setManualDesc('');
      setManualTracking('');
      setManualMsg('✅ Expense successfully recorded!');
      fetchTrackerData();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wealthsync:refresh'));
      }
    } catch (err: any) {
      setManualMsg(`Error: ${err.message || 'Failed to log expense'}`);
    } finally {
      setManualLoading(false);
    }
  };

  const filteredOrders = recentOrders.filter((o) => {
    if (filterSource === 'SHOPEE') return o.isShopeeOrder;
    if (filterSource === 'GROCERIES') return o.tags?.includes('Groceries');
    if (filterSource === 'FOOD') return o.tags?.includes('Food');
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-800 mb-2">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Lifestyle Ingestion Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
            Shopee, GCash & Grocery Tracker
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Automate Shopee order tracking via Email Webhooks, statement parsing, and dedicated budget envelopes.
          </p>
        </div>

        {/* 3-Tab switcher */}
        <div className="flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('email')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'email'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email Auto-Forwarding</span>
          </button>
          <button
            onClick={() => setActiveTab('parser')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'parser'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Statement / Text Parser</span>
          </button>
          <button
            onClick={() => setActiveTab('logger')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'logger'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manual Rapid Logger</span>
          </button>
        </div>
      </div>

      {/* CALENDAR FILTER (Day, Month, Year, All Time) */}
      <DateFilterBar onChange={handleDateFilterChange} defaultPeriod="month" />

      {/* DEDICATED LIFESTYLE BUDGET ENVELOPES */}
      {trackerData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Shopee Spending Cap */}
          <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Shopee Online Shopping Cap
              </span>
              <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-neutral-900 dark:text-white mt-2">
              {formatCurrency(trackerData.metrics?.shopeeTotal, currency)}
            </p>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                <span>Monthly Cap: {formatCurrency(trackerData.budgets?.shoppingBudget || 8500, currency)}</span>
                <span>
                  {Math.round(((trackerData.metrics?.shopeeTotal || 0) / (trackerData.budgets?.shoppingBudget || 8500)) * 100)}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                <div
                  style={{
                    width: `${Math.min(100, Math.round(((trackerData.metrics?.shopeeTotal || 0) / (trackerData.budgets?.shoppingBudget || 8500)) * 100))}%`,
                  }}
                  className="h-full bg-black dark:bg-white rounded-full transition-all duration-500"
                />
              </div>
            </div>
          </div>

          {/* Grocery Spending Cap */}
          <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Supermarket & Grocery Budget
              </span>
              <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white">
                <ShoppingCart className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-neutral-900 dark:text-white mt-2">
              {formatCurrency(trackerData.metrics?.groceryTotal, currency)}
            </p>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                <span>Budget: {formatCurrency(trackerData.budgets?.groceryBudget || 16000, currency)}</span>
                <span>
                  {Math.round(((trackerData.metrics?.groceryTotal || 0) / (trackerData.budgets?.groceryBudget || 16000)) * 100)}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                <div
                  style={{
                    width: `${Math.min(100, Math.round(((trackerData.metrics?.groceryTotal || 0) / (trackerData.budgets?.groceryBudget || 16000)) * 100))}%`,
                  }}
                  className="h-full bg-black dark:bg-white rounded-full transition-all duration-500"
                />
              </div>
            </div>
          </div>

          {/* Food Delivery & Dining */}
          <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Food Delivery & Dining
              </span>
              <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white">
                <Utensils className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-neutral-900 dark:text-white mt-2">
              {formatCurrency(trackerData.metrics?.foodDeliveryTotal, currency)}
            </p>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                <span>GrabFood / Panda</span>
                <span className="text-neutral-900 dark:text-white font-semibold">Active</span>
              </div>
              <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                <div style={{ width: '42%' }} className="h-full bg-black dark:bg-white rounded-full" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: EMAIL AUTO-FORWARDING (Option 2) */}
      {activeTab === 'email' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Main Forwarding Config Card */}
          <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-800">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Automatic Receipt Sync Active</span>
                </div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                  Your Dedicated Inbound Receipt Address
                </h3>
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
                  Forward order confirmation emails from <strong>Shopee</strong>, <strong>GCash</strong>, or <strong>GrabFood</strong> to this private address. WealthSync extracts the order item, parcel tracking ID, and exact price in real time.
                </p>
              </div>

              {/* Copy Address Box */}
              <div className="flex items-center gap-2 p-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 shrink-0">
                <Mail className="w-4 h-4 text-neutral-500 ml-2" />
                <span className="font-mono text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  {emailConfig?.forwardingAddress || `orders+${user?.id || 'demo'}@inbound.wealthsync.io`}
                </span>
                <button
                  type="button"
                  onClick={handleCopyForwardingEmail}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Step-by-Step Setup Guide */}
            <div className="mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800">
                <div className="w-6 h-6 rounded-full bg-black text-white dark:bg-white dark:text-black font-bold flex items-center justify-center text-[11px] mb-2">
                  1
                </div>
                <h4 className="font-bold text-neutral-900 dark:text-white mb-1">Open Email Settings</h4>
                <p className="text-neutral-500 dark:text-neutral-400">
                  In Gmail, go to <strong>Settings &gt; Forwarding and POP/IMAP</strong> and click <em>Add a forwarding address</em>.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800">
                <div className="w-6 h-6 rounded-full bg-black text-white dark:bg-white dark:text-black font-bold flex items-center justify-center text-[11px] mb-2">
                  2
                </div>
                <h4 className="font-bold text-neutral-900 dark:text-white mb-1">Create an Auto-Filter</h4>
                <p className="text-neutral-500 dark:text-neutral-400">
                  Create a filter with <strong>from: (*@shopee.ph OR *@gcash.com)</strong>.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800">
                <div className="w-6 h-6 rounded-full bg-black text-white dark:bg-white dark:text-black font-bold flex items-center justify-center text-[11px] mb-2">
                  3
                </div>
                <h4 className="font-bold text-neutral-900 dark:text-white mb-1">Zero-Touch Ingestion</h4>
                <p className="text-neutral-500 dark:text-neutral-400">
                  Select <em>Forward it to your WealthSync address</em>. New purchases log instantly into your budget.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Webhook Simulator */}
          <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-neutral-900 dark:text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-neutral-900 dark:text-white" />
                  <span>Interactive Email Ingestion Simulator</span>
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Test the email ingestion pipeline right now by firing a simulated Shopee receipt payload to your webhook.
                </p>
              </div>
            </div>

            {simError && (
              <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{simError}</span>
              </div>
            )}

            {simSuccess && (
              <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs flex items-center gap-2 font-medium">
                <Check className="w-4 h-4 shrink-0" />
                <span>{simSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold uppercase text-neutral-500 mb-1">Simulated Sender (From)</label>
                <input
                  type="text"
                  value={simFrom}
                  onChange={(e) => setSimFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 font-mono text-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-neutral-500 mb-1">Email Subject</label>
                <input
                  type="text"
                  value={simSubject}
                  onChange={(e) => setSimSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 font-semibold text-neutral-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold uppercase text-neutral-500 mb-1">Email Body Content</label>
              <textarea
                rows={5}
                value={simBody}
                onChange={(e) => setSimBody(e.target.value)}
                className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 font-mono text-xs text-neutral-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSimulateEmail}
                disabled={simLoading}
                className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {simLoading ? <span>Processing Inbound Webhook...</span> : <span>Send Simulated Shopee Email</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: INGESTION PARSER */}
      {activeTab === 'parser' && (
        <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-base text-neutral-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-neutral-900 dark:text-white" />
                <span>Transaction Ingestion Parser</span>
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Paste order summaries, GCash SMS alerts, or CSV text. The parser auto-detects merchants, amounts, and tags.
              </p>
            </div>

            {/* Quick Sample Fill Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-neutral-400">Sample Data:</span>
              <button
                type="button"
                onClick={fillShopeeSample}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Shopee Order
              </button>
              <button
                type="button"
                onClick={fillGcashSample}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                GCash SMS
              </button>
              <button
                type="button"
                onClick={fillCsvSample}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                CSV Statement
              </button>
            </div>
          </div>

          {parserError && (
            <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{parserError}</span>
            </div>
          )}

          {parserSuccess && (
            <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 shrink-0" />
              <span>{parserSuccess}</span>
            </div>
          )}

          {/* Raw Text Input Box */}
          <div className="space-y-2">
            <textarea
              rows={5}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste Shopee order summary, GCash SMS confirmation, or CSV statement lines here..."
              className="w-full p-4 rounded-xl text-xs sm:text-sm font-mono border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-y"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleParse}
                disabled={parseLoading || !rawText.trim()}
                className="px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {parseLoading ? <span>Parsing...</span> : <span>Parse & Auto-Tag Drafts</span>}
              </button>
            </div>
          </div>

          {/* PARSED DRAFTS PREVIEW TABLE */}
          {parsedDrafts.length > 0 && (
            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-neutral-900 dark:text-white">
                  Parsed Drafts ({parsedDrafts.length} items detected)
                </h4>
                <button
                  type="button"
                  onClick={handleCommitBatch}
                  disabled={commitLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{commitLoading ? 'Committing...' : 'Commit All to Ledger'}</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-900 text-neutral-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Auto-Tags</th>
                      <th className="px-4 py-3">Shopee Order?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {parsedDrafts.map((draft, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/40">
                        <td className="px-4 py-3 font-medium text-neutral-800 dark:text-neutral-200">
                          {draft.description}
                          {draft.orderTrackingNumber && (
                            <span className="block text-[10px] text-neutral-400 font-mono">
                              Track: {draft.orderTrackingNumber}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-bold text-neutral-900 dark:text-white">
                          -{formatCurrency(draft.amount, currency)}
                        </td>
                        <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                          {draft.paymentMethod}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {draft.tags.map((tag) => (
                              <span
                                key={tag}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getTagColor(tag)}`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {draft.isShopeeOrder ? (
                            <span className="text-neutral-900 dark:text-white font-semibold flex items-center gap-1">
                              <ShoppingBag className="w-3.5 h-3.5" /> Yes
                            </span>
                          ) : (
                            <span className="text-neutral-400">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MANUAL RAPID LOGGER */}
      {activeTab === 'logger' && (
        <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm max-w-xl">
          <h3 className="font-bold text-base text-neutral-900 dark:text-white mb-4">
            Quick Manual Expense Entry
          </h3>

          {manualMsg && (
            <div className="p-3 mb-4 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs font-medium">
              {manualMsg}
            </div>
          )}

          <form onSubmit={handleManualSubmit} className="space-y-4 text-xs sm:text-sm">
            <div>
              <label className="block font-semibold uppercase text-neutral-500 mb-2">Category Auto-Tag</label>
              <div className="flex flex-wrap gap-2">
                {['Shopee', 'GCash', 'Food', 'Groceries', 'Utilities'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setManualTag(tag)}
                    className={`px-3.5 py-1.5 rounded-xl font-semibold border transition-all ${
                      manualTag === tag
                        ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white shadow-sm'
                        : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold uppercase text-neutral-500 mb-1">Amount ({currency})</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 font-bold text-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white"
              />
            </div>

            <div>
              <label className="block font-semibold uppercase text-neutral-500 mb-1">Description / Order Item</label>
              <input
                type="text"
                placeholder="e.g. Shopee Wireless Keyboard & Mat"
                value={manualDesc}
                onChange={(e) => setManualDesc(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white"
              />
            </div>

            {manualTag === 'Shopee' && (
              <div>
                <label className="block font-semibold uppercase text-neutral-500 mb-1">SPX / Shopee Tracking ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. SPXPH260914K19M"
                  value={manualTracking}
                  onChange={(e) => setManualTracking(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 focus:ring-2 focus:ring-black dark:focus:ring-white font-mono text-xs text-neutral-900 dark:text-white"
                />
              </div>
            )}

            <div>
              <label className="block font-semibold uppercase text-neutral-500 mb-1">Payment Method</label>
              <select
                value={manualMethod}
                onChange={(e) => setManualMethod(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 font-medium text-neutral-900 dark:text-white"
              >
                <option value="GCASH">GCash</option>
                <option value="MAYA">Maya</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CASH">Cash on Delivery</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={manualLoading}
              className="w-full py-3 rounded-xl font-bold text-white bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-sm transition-all disabled:opacity-50"
            >
              {manualLoading ? 'Saving...' : 'Record Expense'}
            </button>
          </form>
        </div>
      )}

      {/* RECENT ORDERS & GROCERY RECEIPTS */}
      <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-white">
              Lifestyle Order History
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Orders and supermarket visits tracked this cycle
            </p>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            {['ALL', 'SHOPEE', 'GROCERIES', 'FOOD'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterSource(tab)}
                className={`px-3 py-1.5 rounded-lg border transition-all ${
                  filterSource === tab
                    ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white shadow-sm'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {filteredOrders.length === 0 ? (
            <p className="text-center py-8 text-xs text-neutral-400">
              No orders found matching this filter.
            </p>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.id}
                className="py-3.5 flex items-center justify-between gap-4 hover:bg-neutral-50 dark:hover:bg-neutral-900/40 px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white">
                    {order.isShopeeOrder ? (
                      <ShoppingBag className="w-4 h-4" />
                    ) : order.tags?.includes('Groceries') ? (
                      <ShoppingCart className="w-4 h-4" />
                    ) : (
                      <Utensils className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                      {order.description}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                      <span>{formatDate(order.date)}</span>
                      <span>•</span>
                      <span>{order.paymentMethod?.replace('_', ' ')}</span>
                      {order.orderTrackingNumber && (
                        <span className="font-mono text-neutral-900 dark:text-white font-medium">
                          [{order.orderTrackingNumber}]
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white">
                    -{formatCurrency(order.amount, currency)}
                  </p>
                  <span className="text-[10px] text-neutral-400 block">
                    {order.category?.name || 'Lifestyle'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
