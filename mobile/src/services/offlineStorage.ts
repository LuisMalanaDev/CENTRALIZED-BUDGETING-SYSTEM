import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { Account, CategoryBudget, SavingsVault, Transaction, TrackerOrder } from '../types';

const OVERVIEW_CACHE_KEY = 'ws_cache_overview';
const BUDGETS_CACHE_KEY = 'ws_cache_budgets';
const LEDGER_CACHE_KEY = 'ws_cache_ledger';
const TRACKER_CACHE_KEY = 'ws_cache_tracker';
const OFFLINE_QUEUE_KEY = 'ws_offline_tx_queue';

export interface OverviewCacheData {
  accounts: Account[];
  transactions: Transaction[];
  metrics: {
    totalInflow: number;
    totalOutflow: number;
    netCashflow: number;
    budgetCap: number;
    activeMonthInflow?: number;
    activeMonthOutflow?: number;
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

export interface TrackerCacheData {
  orders: TrackerOrder[];
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

  // --- Tracker Cache ---
  async saveTrackerCache(orders: TrackerOrder[]): Promise<void> {
    try {
      const payload: TrackerCacheData = {
        orders,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(TRACKER_CACHE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Failed to save tracker cache:', e);
    }
  },

  async getTrackerCache(): Promise<TrackerCacheData | null> {
    try {
      const raw = await AsyncStorage.getItem(TRACKER_CACHE_KEY);
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
    const tempId = `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newItem: OfflineQueueItem = {
      ...item,
      tempId,
      createdAt: Date.now(),
    };
    queue.push(newItem);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

    // Optimistically update Overview & Ledger caches so UI updates in real time
    try {
      const newTx: Transaction = {
        id: tempId,
        amount: item.amount,
        type: item.type,
        category: item.category,
        paymentMethod: item.paymentMethod,
        description: item.description,
        date: item.date,
        isOfflinePending: true,
      };

      // 1. Update Ledger cache
      const ledgerCache = await this.getLedgerCache();
      const existingLedger = ledgerCache?.transactions || [];
      await this.saveLedgerCache([newTx, ...existingLedger]);

      // 2. Update Overview cache
      const overviewCache = await this.getOverviewCache();
      if (overviewCache) {
        const updatedTxs = [newTx, ...(overviewCache.transactions || [])];
        const isExpense = item.type === 'EXPENSE';
        const isIncome = item.type === 'INCOME';
        const newInflow = overviewCache.metrics.totalInflow + (isIncome ? item.amount : 0);
        const newOutflow = overviewCache.metrics.totalOutflow + (isExpense ? item.amount : 0);

        // Deduct from matching wallet balance
        const updatedAccounts = (overviewCache.accounts || []).map((acc) => {
          const accName = acc.name.toUpperCase();
          const pm = item.paymentMethod.toUpperCase();
          if (accName.includes(pm) || (pm === 'CASH' && accName.includes('CASH'))) {
            const diff = isExpense ? -item.amount : isIncome ? item.amount : 0;
            return { ...acc, balance: Number(acc.balance) + diff };
          }
          return acc;
        });

        await this.saveOverviewCache({
          ...overviewCache,
          accounts: updatedAccounts,
          transactions: updatedTxs,
          metrics: {
            ...overviewCache.metrics,
            totalInflow: newInflow,
            totalOutflow: newOutflow,
            netCashflow: newInflow - newOutflow,
          },
        });
      }
    } catch (e) {
      console.warn('Failed to optimistically update cache on offline enqueue:', e);
    }

    return newItem;
  },

  async removeOfflineTransaction(tempId: string): Promise<void> {
    const queue = await this.getOfflineQueue();
    const filtered = queue.filter((item) => item.tempId !== tempId);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
  },

  async removeTransactionFromOverviewCache(
    txId: string,
    amount: number,
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER',
    paymentMethod?: string
  ): Promise<void> {
    try {
      const overviewCache = await this.getOverviewCache();
      if (!overviewCache) return;

      const updatedTxs = (overviewCache.transactions || []).filter((t) => t.id !== txId);
      const isExpense = type === 'EXPENSE';
      const isIncome = type === 'INCOME';

      const newInflow = Math.max(0, (overviewCache.metrics.totalInflow || 0) - (isIncome ? amount : 0));
      const newOutflow = Math.max(0, (overviewCache.metrics.totalOutflow || 0) - (isExpense ? amount : 0));

      const pm = (paymentMethod || '').toUpperCase();
      const updatedAccounts = (overviewCache.accounts || []).map((acc) => {
        const accName = acc.name.toUpperCase();
        if (pm && (accName.includes(pm) || (pm === 'CASH' && accName.includes('CASH')))) {
          const diff = isExpense ? amount : isIncome ? -amount : 0;
          return { ...acc, balance: Number(acc.balance) + diff };
        }
        return acc;
      });

      await this.saveOverviewCache({
        ...overviewCache,
        accounts: updatedAccounts,
        transactions: updatedTxs,
        metrics: {
          ...overviewCache.metrics,
          totalInflow: newInflow,
          totalOutflow: newOutflow,
          netCashflow: newInflow - newOutflow,
          activeMonthInflow: Math.max(0, (overviewCache.metrics.activeMonthInflow || 0) - (isIncome ? amount : 0)),
          activeMonthOutflow: Math.max(0, (overviewCache.metrics.activeMonthOutflow || 0) - (isExpense ? amount : 0)),
        },
      });
    } catch (e) {
      console.warn('Failed to update overview cache on transaction deletion:', e);
    }
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
        TRACKER_CACHE_KEY,
        OFFLINE_QUEUE_KEY,
      ]);
    } catch (e) {
      console.warn('Failed to clear offline storage:', e);
    }
  },
};
