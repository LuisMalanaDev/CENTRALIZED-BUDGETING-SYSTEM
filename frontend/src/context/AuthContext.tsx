'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export interface User {
  id: string;
  email: string;
  name: string;
  currency: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name?: string; currency?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        const storedToken = typeof window !== 'undefined' ? localStorage.getItem('wealthsync_token') : null;
        if (!storedToken) {
          setUser(null);
          setLoading(false);
          return;
        }

        const storedUser = localStorage.getItem('wealthsync_user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }

        const res = await api.get<{ user: User }>('/api/auth/me');
        if (res.user) {
          setUser(res.user);
          localStorage.setItem('wealthsync_user', JSON.stringify(res.user));
        }
      } catch {
        setUser(null);
        localStorage.removeItem('wealthsync_user');
        localStorage.removeItem('wealthsync_token');
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ user: User; token: string }>('/api/auth/login', { email, password });
    if (res.token) {
      localStorage.setItem('wealthsync_token', res.token);
    }
    if (res.user) {
      setUser(res.user);
      localStorage.setItem('wealthsync_user', JSON.stringify(res.user));
      router.push('/dashboard');
    }
  };

  const register = async (data: { email: string; password: string; name?: string; currency?: string }) => {
    const res = await api.post<{ user: User; token: string }>('/api/auth/register', data);
    if (res.token) {
      localStorage.setItem('wealthsync_token', res.token);
    }
    if (res.user) {
      setUser(res.user);
      localStorage.setItem('wealthsync_user', JSON.stringify(res.user));
      router.push('/dashboard');
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // ignore
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('wealthsync_token');
        localStorage.removeItem('wealthsync_user');
        document.cookie = 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = 'wealthsync_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        window.location.replace('/');
      }
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
