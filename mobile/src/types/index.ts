export interface User {
  id: string;
  email: string;
  name: string;
  currency: string;
}

export type TransactionType = 'EXPENSE' | 'INCOME' | 'TRANSFER';

export type PaymentMethod = 'GCASH' | 'MAYA' | 'CASH' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'DEBIT_CARD';

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  category: string;
  description?: string;
  date: string;
  paymentMethod: PaymentMethod | string;
  account?: string;
  status?: string;
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
  category: string;
  limit: number;
  spent: number;
  period: string;
}

export interface SavingsVault {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  color?: string;
}

export interface TrackerOrder {
  id: string;
  platform: 'SHOPEE' | 'LAZADA' | 'TIKTOK' | 'GROCERY' | 'OTHER';
  orderId?: string;
  trackingNumber?: string;
  merchant?: string;
  items?: string;
  amount: number;
  status: 'PENDING' | 'TO_SHIP' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  orderDate: string;
  deliveryDate?: string;
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
