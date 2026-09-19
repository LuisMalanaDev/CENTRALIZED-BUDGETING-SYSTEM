import { prisma } from '../prisma.js';
import { BudgetPeriod, Prisma } from '@prisma/client';
import { mockStore, MockBudget } from './mockStore.js';
import { dbSafe } from './dbHelper.js';

export class BudgetService {
  static async listBudgets(userId: string) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    return dbSafe(
      async () => {
        const budgets = await prisma.budget.findMany({
          where: { userId },
          include: {
            category: true,
          },
          orderBy: { createdAt: 'asc' },
        });

        // Fetch transactions for the current year (or recent months) to accurately support both ongoing and specific month budgets
        const expenses = await prisma.transaction.findMany({
          where: {
            userId,
            type: 'EXPENSE',
          },
          select: {
            amount: true,
            categoryId: true,
            category: { select: { id: true, name: true, slug: true } },
            description: true,
            isShopeeOrder: true,
            tags: true,
            source: true,
            date: true,
          },
        });

        // Current calendar month expenses for overall metrics
        const currentMonthExpenses = expenses.filter((e) => {
          const d = new Date(e.date);
          return d >= startOfMonth && d <= endOfMonth;
        });

        const totalMonthlyExpense = currentMonthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

        const budgetsWithMetrics = budgets.map((b) => {
          let spent = 0;
          const bName = (b.name || '').toLowerCase();
          const isOverall = !b.categoryId && (bName === 'all' || bName === 'overall' || bName === 'total budget');

          // Determine the target date window for this specific budget
          const bYear = b.year || currentYear;
          const bMonth = b.month || currentMonth;
          const bStart = b.month && b.year ? new Date(bYear, bMonth - 1, 1) : startOfMonth;
          const bEnd = b.month && b.year ? new Date(bYear, bMonth, 0, 23, 59, 59, 999) : endOfMonth;

          const candidateExpenses = expenses.filter((e) => {
            const d = new Date(e.date);
            return d >= bStart && d <= bEnd;
          });

          if (isOverall) {
            spent = candidateExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
          } else {
            const matched = candidateExpenses.filter((e) => BudgetService.matchesBudgetCategory(b, e));
            spent = matched.reduce((sum, e) => sum + Number(e.amount), 0);
          }

          const budgetAmount = Number(b.amount);
          const remaining = Math.max(0, budgetAmount - spent);
          const percentUsed = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;
          
          let status: 'NORMAL' | 'WARNING' | 'EXCEEDED' = 'NORMAL';
          if (percentUsed >= 100) status = 'EXCEEDED';
          else if (percentUsed >= 80) status = 'WARNING';

          return {
            id: b.id,
            name: b.name,
            amount: budgetAmount,
            categoryId: b.categoryId,
            category: b.category,
            period: b.period,
            month: b.month ?? null,
            year: b.year ?? null,
            spent: Math.round(spent * 100) / 100,
            remaining: Math.round(remaining * 100) / 100,
            percentUsed,
            status,
          };
        });

        return {
          budgets: budgetsWithMetrics,
          totalMonthlyExpense: Math.round(totalMonthlyExpense * 100) / 100,
        };
      },
      () => {
        const budgets = mockStore.budgets.filter((b) => b.userId === userId || b.userId === 'demo-user-uuid-1');
        const expenses = mockStore.transactions.filter(
          (t) => (t.userId === userId || t.userId === 'demo-user-uuid-1') && t.type === 'EXPENSE'
        );

        const currentMonthExpenses = expenses.filter((e) => {
          const d = new Date(e.date);
          return d >= startOfMonth && d <= endOfMonth;
        });

        const totalMonthlyExpense = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

        const budgetsWithMetrics = budgets.map((b) => {
          let spent = 0;
          const bName = (b.name || '').toLowerCase();
          const isOverall = !b.categoryId && (bName === 'all' || bName === 'overall' || bName === 'total budget');

          const bYear = (b as any).year || currentYear;
          const bMonth = (b as any).month || currentMonth;
          const bStart = (b as any).month && (b as any).year ? new Date(bYear, bMonth - 1, 1) : startOfMonth;
          const bEnd = (b as any).month && (b as any).year ? new Date(bYear, bMonth, 0, 23, 59, 59, 999) : endOfMonth;

          const candidateExpenses = expenses.filter((e) => {
            const d = new Date(e.date);
            return d >= bStart && d <= bEnd;
          });

          if (isOverall) {
            spent = candidateExpenses.reduce((sum, e) => sum + e.amount, 0);
          } else {
            const matched = candidateExpenses.filter((e) => BudgetService.matchesBudgetCategory(b, e as any));
            spent = matched.reduce((sum, e) => sum + e.amount, 0);
          }

          const budgetAmount = b.amount;
          const remaining = Math.max(0, budgetAmount - spent);
          const percentUsed = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;

          let status: 'NORMAL' | 'WARNING' | 'EXCEEDED' = 'NORMAL';
          if (percentUsed >= 100) status = 'EXCEEDED';
          else if (percentUsed >= 80) status = 'WARNING';

          const category = mockStore.categories.find((c) => c.id === b.categoryId);

          return {
            id: b.id,
            name: b.name,
            amount: budgetAmount,
            categoryId: b.categoryId,
            category: category ? { id: category.id, name: category.name, slug: category.slug, color: category.color, icon: category.icon } : null,
            period: b.period,
            month: (b as any).month ?? null,
            year: (b as any).year ?? null,
            spent: Math.round(spent * 100) / 100,
            remaining: Math.round(remaining * 100) / 100,
            percentUsed,
            status,
          };
        });

        return {
          budgets: budgetsWithMetrics as any,
          totalMonthlyExpense: Math.round(totalMonthlyExpense * 100) / 100,
        };
      }
    );
  }

  static async resolveCategoryByName(userId: string, name: string) {
    const lower = name.toLowerCase().trim();
    return prisma.category.findFirst({
      where: {
        OR: [
          ...(lower.includes('shopee') || lower.includes('online') ? [{ slug: 'shopee-online-orders' }] : []),
          ...(lower.includes('food') || lower.includes('dining') ? [{ slug: 'food-dining' }] : []),
          ...(lower.includes('grocer') ? [{ slug: 'groceries' }] : []),
          ...(lower.includes('transpo') ? [{ slug: 'transportation' }] : []),
          ...(lower.includes('bill') || lower.includes('util') ? [{ slug: 'utilities' }] : []),
          ...(lower.includes('entertain') ? [{ slug: 'entertainment' }] : []),
          { name: { equals: name, mode: 'insensitive' } },
        ],
      },
    });
  }

  static matchesBudgetCategory(
    b: { name?: string | null; categoryId?: string | null },
    e: {
      categoryId?: string | null;
      category?: { id: string; name: string; slug: string } | null;
      description?: string | null;
      source?: string | null;
      tags?: string[];
      isShopeeOrder?: boolean;
    }
  ): boolean {
    if (b.categoryId && e.categoryId && b.categoryId === e.categoryId) return true;
    const bName = (b.name || '').toLowerCase().trim();
    if (!bName) return false;

    const catName = (e.category?.name || '').toLowerCase().trim();
    const catSlug = (e.category?.slug || '').toLowerCase().trim();
    const desc = (e.description || '').toLowerCase();
    const src = (e.source || '').toLowerCase();
    const tagsStr = (e.tags || []).join(' ').toLowerCase();

    const clean = (s: string) => s.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const bClean = clean(bName);
    const catClean = clean(catName);
    const slugClean = clean(catSlug);

    if (catClean && (bClean.includes(catClean) || catClean.includes(bClean))) return true;
    if (slugClean && (bClean.includes(slugClean) || slugClean.includes(bClean))) return true;

    // Shopee & Online Orders
    const isOnlineBudget = bName.includes('shopee') || bName.includes('online') || bName.includes('parcel');
    if (isOnlineBudget) {
      if (e.isShopeeOrder) return true;
      if (catSlug.includes('shopee') || catSlug.includes('online')) return true;
      if (catName.includes('shopee') || catName.includes('online')) return true;
      if (tagsStr.includes('shopee') || tagsStr.includes('online') || tagsStr.includes('parcel')) return true;
      if (desc.includes('shopee') || desc.includes('lazada') || desc.includes('tiktok') || desc.includes('parcel')) return true;
      if (src.includes('shopee') || src.includes('tracker')) return true;
    }

    // Food & Dining
    const isFoodBudget = bName.includes('food') || bName.includes('dining') || bName.includes('restaurant');
    if (isFoodBudget) {
      if (catSlug.includes('food') || catSlug.includes('dining')) return true;
      if (catName.includes('food') || catName.includes('dining')) return true;
    }

    // Groceries
    const isGroceryBudget = bName.includes('grocer') || bName.includes('supermarket');
    if (isGroceryBudget) {
      if (catSlug.includes('grocer') || catSlug.includes('supermarket')) return true;
      if (catName.includes('grocer') || catName.includes('supermarket')) return true;
    }

    // Transportation
    const isTranspoBudget = bName.includes('transpo') || bName.includes('travel') || bName.includes('commute');
    if (isTranspoBudget) {
      if (catSlug.includes('transpo')) return true;
      if (catName.includes('transpo')) return true;
    }

    // Utilities & Bills
    const isBillsBudget = bName.includes('bill') || bName.includes('util');
    if (isBillsBudget) {
      if (catSlug.includes('util') || catSlug.includes('bill')) return true;
      if (catName.includes('util') || catName.includes('bill')) return true;
    }

    const bWords = bClean.split(' ').filter((w) => w.length >= 4);
    const catWords = (catClean + ' ' + slugClean).split(' ').filter((w) => w.length >= 4);
    if (bWords.some((w) => catWords.includes(w))) return true;

    return false;
  }

  static async createBudget(userId: string, data: {
    name: string;
    amount: number;
    categoryId?: string | null;
    period?: BudgetPeriod;
    month?: number | null;
    year?: number | null;
  }) {
    return dbSafe(
      async () => {
        let categoryId = data.categoryId || null;
        if (!categoryId && data.name) {
          const resolved = await BudgetService.resolveCategoryByName(userId, data.name);
          if (resolved) categoryId = resolved.id;
        }

        const existing = await prisma.budget.findFirst({
          where: {
            userId,
            categoryId: categoryId,
            month: data.month ?? null,
            year: data.year ?? null,
          },
        });

        if (existing) {
          return prisma.budget.update({
            where: { id: existing.id },
            data: {
              name: data.name,
              amount: new Prisma.Decimal(data.amount),
              period: data.period || 'MONTHLY',
              categoryId,
            },
            include: { category: true },
          });
        }

        return prisma.budget.create({
          data: {
            userId,
            name: data.name,
            amount: new Prisma.Decimal(data.amount),
            categoryId,
            period: data.period || 'MONTHLY',
            month: data.month ?? null,
            year: data.year ?? null,
          },
          include: { category: true },
        });
      },
      () => {
        const newBudget: any = {
          id: `bud-${Date.now()}`,
          userId,
          name: data.name,
          amount: data.amount,
          categoryId: data.categoryId,
          period: data.period || 'MONTHLY',
          month: data.month ?? null,
          year: data.year ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockStore.budgets.push(newBudget);
        return newBudget as any;
      }
    );
  }

  static async updateBudget(userId: string, budgetId: string, data: {
    name?: string;
    amount?: number;
    categoryId?: string | null;
    period?: BudgetPeriod;
    month?: number | null;
    year?: number | null;
  }) {
    return dbSafe(
      async () => {
        const budget = await prisma.budget.findFirst({
          where: { id: budgetId, userId },
        });
        if (!budget) throw new Error('Budget not found or unauthorized');

        return prisma.budget.update({
          where: { id: budgetId },
          data: {
            ...(data.name && { name: data.name }),
            ...(data.amount !== undefined && { amount: new Prisma.Decimal(data.amount) }),
            ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
            ...(data.period && { period: data.period }),
            ...(data.month !== undefined && { month: data.month }),
            ...(data.year !== undefined && { year: data.year }),
          },
          include: { category: true },
        });
      },
      () => {
        const b = mockStore.budgets.find((item) => item.id === budgetId);
        if (!b) throw new Error('Budget not found');
        if (data.name) b.name = data.name;
        if (data.amount !== undefined) b.amount = data.amount;
        if (data.categoryId !== undefined) b.categoryId = data.categoryId;
        if (data.month !== undefined) (b as any).month = data.month;
        if (data.year !== undefined) (b as any).year = data.year;
        return b as any;
      }
    );
  }

  static async deleteBudget(userId: string, budgetId: string) {
    return dbSafe(
      async () => {
        const budget = await prisma.budget.findFirst({
          where: { id: budgetId, userId },
        });
        if (!budget) throw new Error('Budget not found or unauthorized');

        return prisma.budget.delete({
          where: { id: budgetId },
        });
      },
      () => {
        const idx = mockStore.budgets.findIndex((b) => b.id === budgetId);
        if (idx !== -1) mockStore.budgets.splice(idx, 1);
        return { id: budgetId } as any;
      }
    );
  }
}
