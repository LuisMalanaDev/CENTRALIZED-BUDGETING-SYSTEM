'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';
import { Wallet, Menu, X, ArrowRight } from 'lucide-react';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-black/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight text-neutral-900 dark:text-white">
              WealthSync
            </span>
            <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-500 dark:text-neutral-400 -mt-1">
              Personal Finance OS
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-600 dark:text-neutral-400">
          <a href="#features" className="hover:text-black dark:hover:text-white transition-colors">
            Features
          </a>
          <a href="#tracker" className="hover:text-black dark:hover:text-white transition-colors">
            Shopee & Grocery Tracker
          </a>
          <a href="#budgets" className="hover:text-black dark:hover:text-white transition-colors">
            Dynamic Budgets
          </a>
          <a href="#vaults" className="hover:text-black dark:hover:text-white transition-colors">
            Savings Vaults
          </a>
          <a href="#demo" className="hover:text-black dark:hover:text-white transition-colors">
            Live Preview
          </a>
        </nav>

        {/* Action CTAs */}
        <div className="hidden sm:flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-colors"
          >
            Log In
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-black hover:bg-neutral-800 dark:text-black dark:bg-white dark:hover:bg-neutral-200 shadow-sm transition-all flex items-center gap-1.5 hover:gap-2 group"
          >
            Get Started
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Mobile menu trigger */}
        <div className="flex sm:hidden items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-black/95 backdrop-blur-lg px-4 py-4 space-y-3">
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 py-1"
          >
            Features
          </a>
          <a
            href="#tracker"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 py-1"
          >
            Shopee & Grocery Tracker
          </a>
          <a
            href="#budgets"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 py-1"
          >
            Dynamic Budgets
          </a>
          <a
            href="#vaults"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 py-1"
          >
            Savings Vaults
          </a>
          <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 text-sm font-medium rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200"
            >
              Log In
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 text-sm font-semibold rounded-xl text-white bg-black dark:text-black dark:bg-white"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
