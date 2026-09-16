import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { Account, CategoryBudget, SavingsVault, Transaction } from '../types';

const OVERVIEW_CACHE_KEY = 'ws_cache_overview';
const BUDGETS_CACHE_KEY = 'ws_cache_budgets';
const LEDGER_CACHE_KEY = 'ws_cache_ledger';
const OFFLINE_QUEUE_KEY = 'ws_offline_tx_queue';

export interface OverviewCacheData {
  accounts: Account[];
  transactions: Transaction[];
  metrics: {
    totalInflow: number;
    totalOutflow: number;
    netCashflow: number;
    budgetCap: number;
  };
  breakdown: { name: string; amount: number; percentage: number; color: string }[];
  cashflow: any[];
  totalExpense: number;
  timestamp: number;
}

export interface BudgetsCacheData {
  budgets: CategoryBudget[];
  vaults: SavingsVault[];
  timestamp: number;
}

export interface LedgerCacheData {
  transactions: Transaction[];
  timestamp: number;
}

export interface OfflineQueueItem {
  tempId: string;
  amount: number;
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  category: string;
  paymentMethod: string;
  description: string;
  date: string;
  createdAt: number;
}

export const offlineStorage = {
  // --- Overview Screen Cache ---
  async saveOverviewCache(data: Omit<OverviewCacheData, 'timestamp'>): Promise<void> {
    try {
      const payload: OverviewCacheData = {
        ...data,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(OVERVIEW_CACHE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Failed to save overview cache:', e);
    }
  },

  async getOverviewCache(): Promise<OverviewCacheData | null> {
    try {
      const raw = await AsyncStorage.getItem(OVERVIEW_CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  // --- Budgets & Vaults Cache ---
  async saveBudgetsCache(data: Omit<BudgetsCacheData, 'timestamp'>): Promise<void> {
    try {
      const payload: BudgetsCacheData = {
        ...data,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(BUDGETS_CACHE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Failed to save budgets cache:', e);
    }
  },

  async getBudgetsCache(): Promise<BudgetsCacheData | null> {
    try {
      const raw = await AsyncStorage.getItem(BUDGETS_CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  // --- Ledger Cache ---
  async saveLedgerCache(transactions: Transaction[]): Promise<void> {
    try {
      const payload: LedgerCacheData = {
        transactions,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(LEDGER_CACHE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Failed to save ledger cache:', e);
    }
  },

  async getLedgerCache(): Promise<LedgerCacheData | null> {
    try {
      const raw = await AsyncStorage.getItem(LEDGER_CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  // --- Offline Transaction Queue ---
  async getOfflineQueue(): Promise<OfflineQueueItem[]> {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  async enqueueOfflineTransaction(item: Omit<OfflineQueueItem, 'tempId' | 'createdAt'>): Promise<OfflineQueueItem> {
    const queue = await this.getOfflineQueue();
    const newItem: OfflineQueueItem = {
      ...item,
      tempId: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
    };
    queue.push(newItem);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    return newItem;
  },

  async removeOfflineTransaction(tempId: string): Promise<void> {
    const queue = await this.getOfflineQueue();
    const filtered = queue.filter((item) => item.tempId !== tempId);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
  },

  /**
   * Replays queued offline transactions to the backend API.
   * Returns how many transactions succeeded and how many remain.
   */
  async syncOfflineQueue(): Promise<{ syncedCount: number; remainingCount: number }> {
    const queue = await this.getOfflineQueue();
    if (queue.length === 0) {
      return { syncedCount: 0, remainingCount: 0 };
    }

    let syncedCount = 0;
    const remaining: OfflineQueueItem[] = [];

    for (const item of queue) {
      try {
        await api.post('/api/transactions', {
          amount: item.amount,
          type: item.type,
          category: item.category,
          paymentMethod: item.paymentMethod,
          description: item.description,
          date: item.date,
        });
        syncedCount++;
      } catch (err: any) {
        // If it failed because of network/timeout/unreachable server, keep it in the queue and stop
        remaining.push(item);
        console.warn(`Failed to sync offline transaction ${item.tempId}:`, err.message);
      }
    }

    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    return { syncedCount, remainingCount: remaining.length };
  },

  // --- Clear Caches on Logout ---
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        OVERVIEW_CACHE_KEY,
        BUDGETS_CACHE_KEY,
        LEDGER_CACHE_KEY,
        OFFLINE_QUEUE_KEY,
      ]);
    } catch (e) {
      console.warn('Failed to clear offline storage:', e);
    }
  },
};
