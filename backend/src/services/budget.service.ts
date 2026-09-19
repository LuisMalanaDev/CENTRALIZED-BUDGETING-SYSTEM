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

        const expenses = await prisma.transaction.findMany({
          where: {
            userId,
            type: 'EXPENSE',
            date: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
          select: {
            amount: true,
            categoryId: true,
            category: { select: { id: true, name: true, slug: true } },
            description: true,
          },
        });

        const totalMonthlyExpense = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

        const budgetsWithMetrics = budgets.map((b) => {
          let spent = 0;
          const bName = (b.name || '').toLowerCase();
          const isOverall = !b.categoryId && (bName === 'all' || bName === 'overall' || bName === 'total budget');

          if (isOverall) {
            spent = totalMonthlyExpense;
          } else {
            const matched = expenses.filter((e) => {
              if (b.categoryId && e.categoryId === b.categoryId) return true;
              const catName = (e.category?.name || '').toLowerCase();
              const catSlug = (e.category?.slug || '').toLowerCase();
              if (catName && (bName.includes(catName) || catName.includes(bName))) return true;
              if (catSlug && (bName.includes(catSlug) || catSlug.includes(bName))) return true;
              return false;
            });
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

        const totalMonthlyExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

        const budgetsWithMetrics = budgets.map((b) => {
          let spent = 0;
          if (!b.categoryId) {
            spent = totalMonthlyExpense;
          } else {
            const matched = expenses.filter((e) => e.categoryId === b.categoryId);
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
        const existing = await prisma.budget.findFirst({
          where: {
            userId,
            categoryId: data.categoryId || null,
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
            },
            include: { category: true },
          });
        }

        return prisma.budget.create({
          data: {
            userId,
            name: data.name,
            amount: new Prisma.Decimal(data.amount),
            categoryId: data.categoryId || null,
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
