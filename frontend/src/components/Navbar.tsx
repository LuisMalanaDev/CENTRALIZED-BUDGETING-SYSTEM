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

        {/* Action CTAs */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-black hover:bg-neutral-800 dark:text-black dark:bg-white dark:hover:bg-neutral-200 shadow-sm transition-all flex items-center gap-1.5"
          >
            Log In
          </Link>
        </div>
      </div>
    </header>
  );
}
