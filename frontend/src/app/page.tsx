'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import {
  TrendingUp,
  ShoppingBag,
  ShoppingCart,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  PieChart,
  Smartphone,
  FileText,
  Calculator,
  Lock,
  Star,
  Sparkles,
  DollarSign,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function LandingPage() {
  // Interactive Live Calculator state on landing page
  const [monthlyIncomeInput, setMonthlyIncomeInput] = useState<number>(75000);
  const [shopeePercent, setShopeePercent] = useState<number>(12);
  const [groceryPercent, setGroceryPercent] = useState<number>(25);

  const calculatedShopee = Math.round((monthlyIncomeInput * shopeePercent) / 100);
  const calculatedGrocery = Math.round((monthlyIncomeInput * groceryPercent) / 100);
  const calculatedSavings = Math.round(monthlyIncomeInput * 0.2);
  const remainingDailyAllowance = Math.max(
    0,
    Math.round((monthlyIncomeInput - calculatedShopee - calculatedGrocery - calculatedSavings) / 30)
  );

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-black text-neutral-900 dark:text-neutral-100 transition-colors">
      <Navbar />

      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32">
        {/* Subtle Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-neutral-200/50 dark:bg-neutral-900/40 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Announcement Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 text-xs font-semibold mb-6 animate-in fade-in slide-in-from-top duration-500">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Built for Modern Lifestyle Spend: Shopee, GCash & Smart Groceries</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-neutral-900 dark:text-white max-w-4xl mx-auto leading-[1.12]">
            Centralize your finances.{' '}
            <span className="text-neutral-500 dark:text-neutral-400">
              Eliminate lifestyle leakage.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            WealthSync gives you absolute visibility over your cashflow, digital wallet transfers,
            grocery bills, and Shopee parcels with a 5-second entry engine and smart statement ingestion.
          </p>

          {/* Primary CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl text-base font-semibold text-white bg-black hover:bg-neutral-800 dark:text-black dark:bg-white dark:hover:bg-neutral-200 shadow-sm transition-all flex items-center justify-center gap-2 group"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl text-base font-semibold text-neutral-800 dark:text-neutral-200 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all flex items-center justify-center gap-2"
            >
              <span>Log In</span>
            </Link>
          </div>

          {/* Micro Social Proof */}
          <div className="mt-8 flex items-center justify-center gap-6 text-xs text-neutral-500 dark:text-neutral-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
              <span>Free Forever Starter</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
              <span>Zero-knowledge security</span>
            </div>
          </div>

          {/* HERO PREVIEW MOCKUP */}
          <div className="mt-14 relative max-w-5xl mx-auto rounded-3xl p-2 sm:p-3 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl">
            <div className="rounded-2xl bg-white dark:bg-black p-4 sm:p-6 border border-neutral-200 dark:border-neutral-800 text-left overflow-hidden">
              {/* Mockup Topbar */}
              <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                  <div className="w-3 h-3 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                  <div className="w-3 h-3 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                  <span className="ml-3 text-xs font-mono text-neutral-400">wealthsync.io/dashboard</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800">
                    Live Cashflow Active
                  </span>
                </div>
              </div>

              {/* Mockup Dashboard Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase">Total Net Worth</span>
                  <p className="text-xl font-bold text-neutral-900 dark:text-white mt-1">₱154,150.00</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">+14.2% this month</p>
                </div>
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase">Monthly Burn Rate</span>
                  <p className="text-xl font-bold text-neutral-900 dark:text-white mt-1">₱21,390.50</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">38% of ₱55k cap</p>
                </div>
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase">Daily Safe-to-Spend</span>
                  <p className="text-xl font-bold text-neutral-900 dark:text-white mt-1">₱1,768.92 / day</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">19 days remaining</p>
                </div>
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase">Shopee & Groceries</span>
                  <p className="text-xl font-bold text-neutral-900 dark:text-white mt-1">₱14,390.50</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">6 orders logged</p>
                </div>
              </div>

              {/* Mockup Preview List */}
              <div className="mt-5 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 mb-3">
                  <span>Recent Lifestyle Transactions</span>
                  <span>Auto-Tagged</span>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs py-1 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white">
                        <ShoppingBag className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                          Shopee - Keychron Mechanical Keyboard & Keycaps
                        </p>
                        <p className="text-[10px] text-neutral-400">Ref: SPXPH260912A87X • GCash Wallet</p>
                      </div>
                    </div>
                    <span className="font-bold text-neutral-900 dark:text-white">-₱3,850.00</span>
                  </div>

                  <div className="flex items-center justify-between text-xs py-1">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white">
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                          SM Supermarket - Weekly Fresh Groceries
                        </p>
                        <p className="text-[10px] text-neutral-400">Card Payment • Groceries</p>
                      </div>
                    </div>
                    <span className="font-bold text-neutral-900 dark:text-white">-₱4,820.50</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CORE VALUE PROPOSITIONS */}
      <section id="features" className="py-20 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Complete Financial Control
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white">
              Engineered for the realities of modern spending.
            </h2>
            <p className="mt-4 text-neutral-600 dark:text-neutral-400 text-sm sm:text-base">
              Say goodbye to generic spreadsheets that ignore food delivery, digital wallets, and e-commerce shopping.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black hover:border-neutral-400 dark:hover:border-neutral-600 transition-all group shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-white flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Real-Time Cashflow</h3>
              <p className="mt-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Aggregated Net Worth, monthly burn rate, and a dynamic daily safe-to-spend allowance that adapts to your actual days left in the month.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black hover:border-neutral-400 dark:hover:border-neutral-600 transition-all group shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-white flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">External Order & Grocery Tracker</h3>
              <p className="mt-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                A specialized tracker for Shopee parcels, GrabFood orders, and supermarket receipts with 1-click auto-tagging and budget envelopes.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black hover:border-neutral-400 dark:hover:border-neutral-600 transition-all group shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-white flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <PieChart className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Dynamic Budget Caps</h3>
              <p className="mt-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Set monthly limits overall or per category. Visual warning bars alert you at 80% usage before you exceed your budget.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black hover:border-neutral-400 dark:hover:border-neutral-600 transition-all group shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-white flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Dedicated Savings Vaults</h3>
              <p className="mt-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Lock away funds for Emergency Reserves, travel goals, or tech upgrades. Track target progress with real-time deposit syncing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE DEMO CALCULATOR */}
      <section id="demo" className="py-20 border-t border-neutral-200 dark:border-neutral-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-12 rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-white">
                <Calculator className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">
                  Interactive Lifestyle Budget Simulator
                </h3>
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                  See your remaining daily safe-to-spend allowance based on your monthly income and shopping caps.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              {/* Controls */}
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400 mb-2">
                    <span>Monthly Income</span>
                    <span className="text-neutral-900 dark:text-white font-bold">{formatCurrency(monthlyIncomeInput)}</span>
                  </div>
                  <input
                    type="range"
                    min={20000}
                    max={250000}
                    step={5000}
                    value={monthlyIncomeInput}
                    onChange={(e) => setMonthlyIncomeInput(Number(e.target.value))}
                    className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400 mb-2">
                    <span>Shopee & Shopping Allocation</span>
                    <span className="text-neutral-900 dark:text-white font-bold">{shopeePercent}% ({formatCurrency(calculatedShopee)})</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={30}
                    step={1}
                    value={shopeePercent}
                    onChange={(e) => setShopeePercent(Number(e.target.value))}
                    className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400 mb-2">
                    <span>Groceries & Supermarket Allocation</span>
                    <span className="text-neutral-900 dark:text-white font-bold">{groceryPercent}% ({formatCurrency(calculatedGrocery)})</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={40}
                    step={1}
                    value={groceryPercent}
                    onChange={(e) => setGroceryPercent(Number(e.target.value))}
                    className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white"
                  />
                </div>
              </div>

              {/* Live Output Card */}
              <div className="p-6 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-4">
                <div className="text-center pb-4 border-b border-neutral-200 dark:border-neutral-800">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Remaining Daily Safe-to-Spend
                  </span>
                  <p className="text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white mt-1">
                    {formatCurrency(remainingDailyAllowance)} <span className="text-sm font-normal text-neutral-400">/ day</span>
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Guarantees 20% ({formatCurrency(calculatedSavings)}) goes directly to your Savings Vault!
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-neutral-200 dark:border-neutral-800">
                    <span className="text-neutral-500">Shopee & Online Orders:</span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">{formatCurrency(calculatedShopee)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-neutral-200 dark:border-neutral-800">
                    <span className="text-neutral-500">Supermarket Groceries:</span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">{formatCurrency(calculatedGrocery)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-neutral-500">Dedicated Savings Vaults:</span>
                    <span className="font-semibold text-neutral-900 dark:text-white">{formatCurrency(calculatedSavings)}</span>
                  </div>
                </div>

                <Link
                  href="/register"
                  className="w-full mt-2 py-3 rounded-xl font-semibold text-xs text-white bg-black hover:bg-neutral-800 dark:text-black dark:bg-white dark:hover:bg-neutral-200 shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <span>Apply This Budget in WealthSync</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL HIGH-CONVERTING CTA */}
      <section className="py-20 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-neutral-900 dark:text-white">
            Take command of your wealth today.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto">
            Join thousands of users who optimize their daily burn, grocery runs, and online shopping with WealthSync.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl text-base font-semibold text-white bg-black hover:bg-neutral-800 dark:text-black dark:bg-white dark:hover:bg-neutral-200 shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <span>Create Free Account</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl text-base font-semibold text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all flex items-center justify-center gap-2"
            >
              <span>Log In</span>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto py-10 border-t border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 WealthSync OS. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-black dark:hover:text-white transition-colors">Features</a>
            <a href="#tracker" className="hover:text-black dark:hover:text-white transition-colors">Tracker</a>
            <a href="#budgets" className="hover:text-black dark:hover:text-white transition-colors">Budgets</a>
            <Link href="/login" className="hover:text-black dark:hover:text-white transition-colors">Log In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
