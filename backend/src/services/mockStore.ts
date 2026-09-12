import { AccountType, TransactionType } from '@prisma/client';

export interface MockUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockAccount {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  balance: any;
  currency: string;
  color: string | null;
  icon: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockCategory {
  id: string;
  userId: string | null;
  name: string;
  slug: string;
  type: TransactionType;
  color: string | null;
  icon: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockTransaction {
  id: string;
  userId: string;
  accountId?: string | null;
  categoryId?: string | null;
  type: TransactionType;
  amount: any;
  date: Date;
  description: string;
  notes?: string | null;
  paymentMethod: any;
  source?: string | null;
  tags: string[];
  receiptUrl?: string | null;
  isShopeeOrder: boolean;
  orderTrackingNumber?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockBudget {
  id: string;
  userId: string;
  categoryId?: string | null;
  name: string;
  amount: any;
  period: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockSavingsGoal {
  id: string;
  userId: string;
  name: string;
  targetAmount: any;
  currentAmount: any;
  targetDate?: Date | null;
  color: string | null;
  icon: string | null;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

class MockDataStore {
  users: MockUser[] = [];
  accounts: MockAccount[] = [];
  categories: MockCategory[] = [];
  transactions: MockTransaction[] = [];
  budgets: MockBudget[] = [];
  savingsGoals: MockSavingsGoal[] = [];

  constructor() {
    this.seed();
  }

  private seed() {
    const userId = 'user-liam';
    const now = new Date();

    this.users.push({
      id: userId,
      email: 'liammalana12@gmail.com',
      // bcrypt hash for 'WealthSync2026!'
      passwordHash: '$2a$10$f/9N3fE1uS1m.uG1a7Qz9O9R0e2W6Z1o8V.Zk/hY6W9J5r.K7e6mS',
      name: 'Liam Malana',
      currency: 'PHP',
      createdAt: now,
      updatedAt: now,
    });

    // Clean initial accounts with 0 balance
    this.accounts.push(
      { id: 'acc-1', userId, name: 'GCash Wallet', type: AccountType.WALLET, balance: 0.0, currency: 'PHP', color: '#000000', icon: 'Smartphone', createdAt: now, updatedAt: now },
      { id: 'acc-2', userId, name: 'Bank Account', type: AccountType.SAVINGS, balance: 0.0, currency: 'PHP', color: '#000000', icon: 'Landmark', createdAt: now, updatedAt: now },
      { id: 'acc-3', userId, name: 'Cash on Hand', type: AccountType.CASH, balance: 0.0, currency: 'PHP', color: '#000000', icon: 'Banknote', createdAt: now, updatedAt: now },
    );

    // Clean categories with neutral monochrome styling
    this.categories.push(
      { id: 'cat-1', userId: null, name: 'Shopee & Online Orders', slug: 'shopee-online-orders', type: TransactionType.EXPENSE, color: '#000000', icon: 'ShoppingBag', isSystem: true, createdAt: now, updatedAt: now },
      { id: 'cat-2', userId: null, name: 'Groceries & Supermarket', slug: 'groceries', type: TransactionType.EXPENSE, color: '#000000', icon: 'ShoppingCart', isSystem: true, createdAt: now, updatedAt: now },
      { id: 'cat-3', userId: null, name: 'Food & Dining Out', slug: 'food-dining', type: TransactionType.EXPENSE, color: '#000000', icon: 'Utensils', isSystem: true, createdAt: now, updatedAt: now },
      { id: 'cat-4', userId: null, name: 'Utilities & Bills', slug: 'utilities', type: TransactionType.EXPENSE, color: '#000000', icon: 'Zap', isSystem: true, createdAt: now, updatedAt: now },
      { id: 'cat-5', userId: null, name: 'Transportation', slug: 'transportation', type: TransactionType.EXPENSE, color: '#000000', icon: 'Car', isSystem: true, createdAt: now, updatedAt: now },
      { id: 'cat-6', userId: null, name: 'Salary & Primary Income', slug: 'salary', type: TransactionType.INCOME, color: '#000000', icon: 'TrendingUp', isSystem: true, createdAt: now, updatedAt: now },
      { id: 'cat-7', userId: null, name: 'Freelance & Side Hustles', slug: 'freelance', type: TransactionType.INCOME, color: '#000000', icon: 'Briefcase', isSystem: true, createdAt: now, updatedAt: now },
    );

    // NO MOCK TRANSACTIONS - FRESH SLATE
    this.transactions = [];

    // NO MOCK BUDGETS - FRESH SLATE
    this.budgets = [];

    // NO MOCK SAVINGS GOALS - FRESH SLATE
    this.savingsGoals = [];
  }
}

export const mockStore = new MockDataStore();
