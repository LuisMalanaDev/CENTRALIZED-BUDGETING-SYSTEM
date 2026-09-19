export interface User {
  id: string;
  email: string;
  name: string;
  currency: string;
}

export type TransactionType = 'EXPENSE' | 'INCOME' | 'TRANSFER';

export type PaymentMethod = 'GCASH' | 'MAYA' | 'CASH' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'DEBIT_CARD';

export interface Category {
  id?: string;
  name: string;
  slug?: string;
  color?: string;
  icon?: string;
}

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  category: string | Category;
  description?: string;
  date: string;
  paymentMethod: PaymentMethod | string;
  account?: string | { id?: string; name: string; type?: string; color?: string };
  status?: string;
  source?: string;
  isShopeeOrder?: boolean;
  tags?: string[];
  orderTrackingNumber?: string;
  isOfflinePending?: boolean;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency?: string;
}

export interface CategoryBudget {
  id: string;
  category?: string | Category;
  name?: string;
  limit?: number;
  amount?: number;
  spent: number;
  period: string;
  month?: number | null;
  year?: number | null;
}

export interface SavingsVault {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  color?: string;
  icon?: string;
  isLocked?: boolean;
  progressPercent?: number;
  remainingAmount?: number;
  isCompleted?: boolean;
}

export interface TrackerOrder {
  id: string;
  platform: 'SHOPEE' | 'LAZADA' | 'TIKTOK' | 'GROCERY' | 'GOOGLE_PLAY' | 'ROBLOX' | 'FOODPANDA' | 'OTHER';
  orderId?: string;
  trackingNumber?: string;
  merchant?: string;
  items?: string;
  amount: number;
  status: 'PENDING' | 'TO_SHIP' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED' | 'COMPLETED';
  orderDate: string;
  deliveryDate?: string;
  paymentMethod?: string;
  notes?: string;
  source?: string;
}

export interface DateRangeFilter {
  type: 'day' | 'month' | 'year' | 'all';
  year: number;
  month: number; // 0-11
  day: number;   // 1-31
  startDate?: string;
  endDate?: string;
  label: string;
}

export interface SpendingVelocity {
  currentMonthSpend: number;
  prevMonthSameDaySpend: number;
  prevMonthTotalSpend: number;
  changePct: number;
  status: 'slower' | 'faster' | 'on_track';
  message: string;
  currentDay?: number;
  prevMonthSameDay?: number;
}
