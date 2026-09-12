import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, currency?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const initAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('wealthsync_token');
      const storedUser = await AsyncStorage.getItem('wealthsync_user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        
        // Verify with backend silently
        try {
          const res = await api.get<{ user: User }>('/api/auth/me');
          if (res?.user) {
            setUser(res.user);
            await AsyncStorage.setItem('wealthsync_user', JSON.stringify(res.user));
          }
        } catch {
          // Keep cached user if network temporarily unavailable
        }
      }
    } catch {
      // Storage error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.post<{ user: User; token: string }>('/api/auth/login', {
      email,
      password,
    });

    if (data.token && data.user) {
      setToken(data.token);
      setUser(data.user);
      await AsyncStorage.setItem('wealthsync_token', data.token);
      await AsyncStorage.setItem('wealthsync_user', JSON.stringify(data.user));
    }
  };

  const register = async (name: string, email: string, password: string, currency = 'PHP') => {
    const data = await api.post<{ user: User; token: string }>('/api/auth/register', {
      name,
      email,
      password,
      currency,
    });

    if (data.token && data.user) {
      setToken(data.token);
      setUser(data.user);
      await AsyncStorage.setItem('wealthsync_token', data.token);
      await AsyncStorage.setItem('wealthsync_user', JSON.stringify(data.user));
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // Ignore network failures on logout
    }
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem('wealthsync_token');
    await AsyncStorage.removeItem('wealthsync_user');
  };

  const refreshUser = async () => {
    try {
      const res = await api.get<{ user: User }>('/api/auth/me');
      if (res?.user) {
        setUser(res.user);
        await AsyncStorage.setItem('wealthsync_user', JSON.stringify(res.user));
      }
    } catch (e) {
      console.warn('Failed to refresh user:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
