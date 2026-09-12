'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ShieldCheck, Lock, User, AlertCircle, Smartphone } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('Admin123');
  const [password, setPassword] = useState('12345678');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter admin credentials.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify admin credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillFixedAdmin = () => {
    setUsername('Admin123');
    setPassword('12345678');
    setError('');
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-white dark:bg-black relative overflow-hidden">
      {/* Top navbar toggle */}
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-black dark:bg-white text-white dark:text-black shadow-lg mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
          WealthSync Admin Portal
        </h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Authorized Administrator Command Center
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white dark:bg-neutral-950 py-8 px-6 sm:px-10 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-xl space-y-6">
          {/* Quick Info Box for Fixed Admin Credentials */}
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <div className="text-xs text-neutral-600 dark:text-neutral-300">
              <span className="font-semibold text-neutral-900 dark:text-white block">Fixed Admin Account</span>
              <span>User: <code className="font-mono text-neutral-900 dark:text-white">Admin123</code> • Pass: <code className="font-mono text-neutral-900 dark:text-white">12345678</code></span>
            </div>
            <button
              type="button"
              onClick={fillFixedAdmin}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition-opacity cursor-pointer"
            >
              Fill
            </button>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
                Admin Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Admin123"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer mt-2"
            >
              {loading ? <span>Authenticating Admin...</span> : <span>Enter Admin Command Center</span>}
            </button>
          </form>

          {/* Notice to regular mobile users */}
          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-900 flex items-center justify-center gap-2 text-center text-xs text-neutral-500 dark:text-neutral-400">
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
            <span>Regular personal finance tracking is powered by the mobile app.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
