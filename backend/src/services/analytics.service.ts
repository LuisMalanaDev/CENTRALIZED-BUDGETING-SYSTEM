import { prisma } from '../prisma.js';
import { mockStore } from './mockStore.js';
import { dbSafe } from './dbHelper.js';

export class AnalyticsService {
  static async getSummary(userId: string, dateFilter?: { startDate?: string; endDate?: string }) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const currentDay = now.getDate();
    const daysRemaining = Math.max(1, totalDaysInMonth - currentDay + 1);

    const startDate = dateFilter?.startDate ? new Date(dateFilter.startDate) : new Date(currentYear, currentMonth, 1);
    const endDate = dateFilter?.endDate ? new Date(dateFilter.endDate) : new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    return dbSafe(
      async () => {
        const accounts = await prisma.account.findMany({
          where: { userId },
          select: { balance: true },
        });
        const totalNetWorth = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

        const monthTransactions = await prisma.transaction.findMany({
          where: {
            userId,
            date: { gte: startDate, lte: endDate },
          },
          select: { amount: true, type: true },
        });

        let monthlyIncome = 0;
        let monthlyBurnRate = 0;

        for (const t of monthTransactions) {
          if (t.type === 'INCOME') monthlyIncome += Number(t.amount);
          else if (t.type === 'EXPENSE') monthlyBurnRate += Number(t.amount);
        }

        const overallBudget = await prisma.budget.findFirst({
          where: { userId, categoryId: null },
        });

        let remainingBudget = 0;
        let dailyBudgetRemaining = 0;

        if (overallBudget) {
          const budgetAmount = Number(overallBudget.amount);
          remainingBudget = Math.max(0, budgetAmount - monthlyBurnRate);
          dailyBudgetRemaining = Math.round((remainingBudget / daysRemaining) * 100) / 100;
        } else {
          const surplus = Math.max(0, monthlyIncome - monthlyBurnRate);
          dailyBudgetRemaining = Math.round((surplus / daysRemaining) * 100) / 100;
        }

        return {
          totalNetWorth: Math.round(totalNetWorth * 100) / 100,
          monthlyBurnRate: Math.round(monthlyBurnRate * 100) / 100,
          monthlyIncome: Math.round(monthlyIncome * 100) / 100,
          netCashflow: Math.round((monthlyIncome - monthlyBurnRate) * 100) / 100,
          overallBudgetLimit: overallBudget ? Number(overallBudget.amount) : 55000,
          remainingDailyBudget: dailyBudgetRemaining,
          daysRemainingInMonth: daysRemaining,
        };
      },
      () => {
        const accounts = mockStore.accounts.filter((a) => a.userId === userId || a.userId === 'demo-user-uuid-1' || a.userId === 'user-liam');
        const totalNetWorth = accounts.reduce((sum, a) => sum + a.balance, 0);

        const monthTransactions = mockStore.transactions.filter(
          (t) => (t.userId === userId || t.userId === 'demo-user-uuid-1' || t.userId === 'user-liam') &&
          new Date(t.date) >= startDate && new Date(t.date) <= endDate
        );

        let monthlyIncome = 0;
        let monthlyBurnRate = 0;

        for (const t of monthTransactions) {
          if (t.type === 'INCOME') monthlyIncome += t.amount;
          else if (t.type === 'EXPENSE') monthlyBurnRate += t.amount;
        }

        const overallBudget = mockStore.budgets.find(
          (b) => (b.userId === userId || b.userId === 'demo-user-uuid-1' || b.userId === 'user-liam') && !b.categoryId
        );

        const budgetAmount = overallBudget ? overallBudget.amount : 0;
        const remainingBudget = Math.max(0, budgetAmount - monthlyBurnRate);
        const dailyBudgetRemaining = budgetAmount > 0 ? Math.round((remainingBudget / daysRemaining) * 100) / 100 : 0;

        return {
          totalNetWorth: Math.round(totalNetWorth * 100) / 100,
          monthlyBurnRate: Math.round(monthlyBurnRate * 100) / 100,
          monthlyIncome: Math.round(monthlyIncome * 100) / 100,
          netCashflow: Math.round((monthlyIncome - monthlyBurnRate) * 100) / 100,
          overallBudgetLimit: budgetAmount,
          remainingDailyBudget: dailyBudgetRemaining,
          daysRemainingInMonth: daysRemaining,
        };
      }
    );
  }

  static async getCategoryBreakdown(userId: string, dateFilter?: { startDate?: string; endDate?: string }) {
    return dbSafe(
      async () => {
        const now = new Date();
        const startDate = dateFilter?.startDate ? new Date(dateFilter.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = dateFilter?.endDate ? new Date(dateFilter.endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const expenses = await prisma.transaction.findMany({
          where: {
            userId,
            type: 'EXPENSE',
            date: { gte: startDate, lte: endDate },
          },
          include: { category: true },
        });

        const categoryMap = new Map<string, { name: string; color: string; amount: number }>();
        for (const t of expenses) {
          const catName = t.category?.name || 'Uncategorized';
          const catColor = t.category?.color || '#94A3B8';
          const existing = categoryMap.get(catName) || { name: catName, color: catColor, amount: 0 };
          existing.amount += Number(t.amount);
          categoryMap.set(catName, existing);
        }

        const totalExpense = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
        const breakdown = Array.from(categoryMap.values()).map((c) => ({
          name: c.name,
          color: c.color,
          amount: Math.round(c.amount * 100) / 100,
          percentage: totalExpense > 0 ? Math.round((c.amount / totalExpense) * 100) : 0,
        })).sort((a, b) => b.amount - a.amount);

        return { breakdown, totalExpense: Math.round(totalExpense * 100) / 100 };
      },
      () => {
        const now = new Date();
        const startDate = dateFilter?.startDate ? new Date(dateFilter.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = dateFilter?.endDate ? new Date(dateFilter.endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const expenses = mockStore.transactions.filter(
          (t) => (t.userId === userId || t.userId === 'demo-user-uuid-1' || t.userId === 'user-liam') &&
          t.type === 'EXPENSE' &&
          new Date(t.date) >= startDate && new Date(t.date) <= endDate
        );

        const categoryMap = new Map<string, { name: string; color: string; amount: number }>();
        for (const t of expenses) {
          const category = mockStore.categories.find((c) => c.id === t.categoryId);
          const catName = category?.name || 'Uncategorized';
          const catColor = category?.color || '#94A3B8';
          const existing = categoryMap.get(catName) || { name: catName, color: catColor, amount: 0 };
          existing.amount += t.amount;
          categoryMap.set(catName, existing);
        }

        const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
        const breakdown = Array.from(categoryMap.values()).map((c) => ({
          name: c.name,
          color: c.color,
          amount: Math.round(c.amount * 100) / 100,
          percentage: totalExpense > 0 ? Math.round((c.amount / totalExpense) * 100) : 0,
        })).sort((a, b) => b.amount - a.amount);

        return { breakdown, totalExpense: Math.round(totalExpense * 100) / 100 };
      }
    );
  }

  static async getPaymentMethodShare(userId: string, dateFilter?: { startDate?: string; endDate?: string }) {
    return dbSafe(
      async () => {
        const now = new Date();
        const startDate = dateFilter?.startDate ? new Date(dateFilter.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = dateFilter?.endDate ? new Date(dateFilter.endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const transactions = await prisma.transaction.findMany({
          where: {
            userId,
            type: 'EXPENSE',
            date: { gte: startDate, lte: endDate },
          },
          select: { paymentMethod: true, amount: true },
        });

        const methodMap = new Map<string, number>();
        let total = 0;
        for (const t of transactions) {
          const amount = Number(t.amount);
          total += amount;
          const cur = methodMap.get(t.paymentMethod) || 0;
          methodMap.set(t.paymentMethod, cur + amount);
        }

        const shares = Array.from(methodMap.entries()).map(([method, amount]) => ({
          method,
          amount: Math.round(amount * 100) / 100,
          percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
        })).sort((a, b) => b.amount - a.amount);

        return { shares, total: Math.round(total * 100) / 100 };
      },
      () => {
        const now = new Date();
        const startDate = dateFilter?.startDate ? new Date(dateFilter.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = dateFilter?.endDate ? new Date(dateFilter.endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const transactions = mockStore.transactions.filter(
          (t) => (t.userId === userId || t.userId === 'demo-user-uuid-1' || t.userId === 'user-liam') &&
          t.type === 'EXPENSE' &&
          new Date(t.date) >= startDate && new Date(t.date) <= endDate
        );

        const methodMap = new Map<string, number>();
        let total = 0;
        for (const t of transactions) {
          total += t.amount;
          const cur = methodMap.get(t.paymentMethod) || 0;
          methodMap.set(t.paymentMethod, cur + t.amount);
        }

        const shares = Array.from(methodMap.entries()).map(([method, amount]) => ({
          method,
          amount: Math.round(amount * 100) / 100,
          percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
        })).sort((a, b) => b.amount - a.amount);

        return { shares, total: Math.round(total * 100) / 100 };
      }
    );
  }

  static async getCashflowTrend(userId: string, monthsCount = 6) {
    return dbSafe(
      async () => {
        const now = new Date();
        const result = [];

        for (let i = monthsCount - 1; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const start = new Date(d.getFullYear(), d.getMonth(), 1);
          const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
          const monthName = start.toLocaleString('default', { month: 'short' });
          const year = start.getFullYear();

          const txs = await prisma.transaction.findMany({
            where: {
              userId,
              date: { gte: start, lte: end },
            },
            select: { amount: true, type: true },
          });

          let income = 0;
          let expense = 0;
          for (const t of txs) {
            if (t.type === 'INCOME') income += Number(t.amount);
            else if (t.type === 'EXPENSE') expense += Number(t.amount);
          }

          result.push({
            label: `${monthName} ${year}`,
            month: monthName,
            year,
            income: Math.round(income * 100) / 100,
            expense: Math.round(expense * 100) / 100,
            net: Math.round((income - expense) * 100) / 100,
          });
        }
        return result;
      },
      () => {
        const now = new Date();
        const result = [];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        for (let i = monthsCount - 1; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthName = monthNames[d.getMonth()];
          const year = d.getFullYear();

          const start = new Date(d.getFullYear(), d.getMonth(), 1);
          const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

          const txs = mockStore.transactions.filter(
            (t) => (t.userId === userId || t.userId === 'user-liam') &&
            new Date(t.date) >= start && new Date(t.date) <= end
          );

          let income = 0;
          let expense = 0;
          for (const t of txs) {
            if (t.type === 'INCOME') income += t.amount;
            else if (t.type === 'EXPENSE') expense += t.amount;
          }

          result.push({
            label: `${monthName} ${year}`,
            month: monthName,
            year,
            income: Math.round(income * 100) / 100,
            expense: Math.round(expense * 100) / 100,
            net: Math.round((income - expense) * 100) / 100,
          });
        }
        return result;
      }
    );
  }

  static async getLifestyleShoppingTracker(userId: string, dateFilter?: { startDate?: string; endDate?: string }) {
    return dbSafe(
      async () => {
        const now = new Date();
        const startDate = dateFilter?.startDate ? new Date(dateFilter.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = dateFilter?.endDate ? new Date(dateFilter.endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const transactions = await prisma.transaction.findMany({
          where: {
            userId,
            type: 'EXPENSE',
            date: { gte: startDate, lte: endDate },
            OR: [
              { isShopeeOrder: true },
              { tags: { hasSome: ['Shopee', 'Groceries', 'Food', 'Dining Out'] } },
              { source: { in: ['Shopee', 'GrabFood', 'FoodPanda', 'Supermarket'] } },
            ],
          },
          include: { category: true, account: true },
          orderBy: { date: 'desc' },
        });

        let shopeeTotal = 0;
        let foodDeliveryTotal = 0;
        let groceryTotal = 0;

        for (const t of transactions) {
          const amount = Number(t.amount);
          const descLower = (t.description + ' ' + (t.source || '')).toLowerCase();
          const tags = t.tags || [];

          if (t.isShopeeOrder || tags.includes('Shopee') || descLower.includes('shopee')) {
            shopeeTotal += amount;
          } else if (tags.includes('Groceries') || descLower.includes('grocery') || descLower.includes('supermarket')) {
            groceryTotal += amount;
          } else if (tags.includes('Food') || descLower.includes('grabfood') || descLower.includes('foodpanda')) {
            foodDeliveryTotal += amount;
          }
        }

        const shoppingBudget = await prisma.budget.findFirst({
          where: { userId, name: { contains: 'Shopping', mode: 'insensitive' } },
        });

        const groceryBudget = await prisma.budget.findFirst({
          where: { userId, name: { contains: 'Grocer', mode: 'insensitive' } },
        });

        return {
          metrics: {
            shopeeTotal: Math.round(shopeeTotal * 100) / 100,
            foodDeliveryTotal: Math.round(foodDeliveryTotal * 100) / 100,
            groceryTotal: Math.round(groceryTotal * 100) / 100,
            combinedLifestyleSpend: Math.round((shopeeTotal + foodDeliveryTotal + groceryTotal) * 100) / 100,
          },
          budgets: {
            shoppingBudget: shoppingBudget ? Number(shoppingBudget.amount) : 8500,
            shoppingRemaining: shoppingBudget ? Math.max(0, Number(shoppingBudget.amount) - shopeeTotal) : 2380,
            groceryBudget: groceryBudget ? Number(groceryBudget.amount) : 16000,
            groceryRemaining: groceryBudget ? Math.max(0, Number(groceryBudget.amount) - groceryTotal) : 7729.5,
          },
          recentOrders: transactions.slice(0, 10),
        };
      },
      () => {
        const now = new Date();
        const startDate = dateFilter?.startDate ? new Date(dateFilter.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = dateFilter?.endDate ? new Date(dateFilter.endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const transactions = mockStore.transactions.filter(
          (t) => (t.userId === userId || t.userId === 'demo-user-uuid-1' || t.userId === 'user-liam') &&
          new Date(t.date) >= startDate && new Date(t.date) <= endDate &&
          (t.isShopeeOrder || t.tags.includes('Shopee') || t.tags.includes('Groceries') || t.tags.includes('Food Delivery') || t.tags.includes('Food'))
        );

        let shopeeTotal = 0;
        let foodDeliveryTotal = 0;
        let groceryTotal = 0;

        for (const t of transactions) {
          const descLower = (t.description + ' ' + (t.source || '')).toLowerCase();
          const tags = t.tags || [];

          if (t.isShopeeOrder || tags.includes('Shopee') || descLower.includes('shopee')) {
            shopeeTotal += t.amount;
          } else if (tags.includes('Groceries') || descLower.includes('grocery') || descLower.includes('supermarket')) {
            groceryTotal += t.amount;
          } else if (tags.includes('Food') || descLower.includes('grabfood') || descLower.includes('foodpanda')) {
            foodDeliveryTotal += t.amount;
          }
        }

        const shoppingBudget = mockStore.budgets.find(
          (b) => (b.userId === userId || b.userId === 'demo-user-uuid-1') && b.name.includes('Shopee')
        );
        const groceryBudget = mockStore.budgets.find(
          (b) => (b.userId === userId || b.userId === 'demo-user-uuid-1') && b.name.includes('Groceries')
        );

        const shoppingLimit = shoppingBudget ? shoppingBudget.amount : 0;
        const groceryLimit = groceryBudget ? groceryBudget.amount : 0;

        const pagedOrders = transactions.slice(0, 10).map((t) => {
          const account = mockStore.accounts.find((a) => a.id === t.accountId);
          const category = mockStore.categories.find((c) => c.id === t.categoryId);
          return {
            ...t,
            account,
            category,
          };
        });

        return {
          metrics: {
            shopeeTotal: Math.round(shopeeTotal * 100) / 100,
            foodDeliveryTotal: Math.round(foodDeliveryTotal * 100) / 100,
            groceryTotal: Math.round(groceryTotal * 100) / 100,
            combinedLifestyleSpend: Math.round((shopeeTotal + foodDeliveryTotal + groceryTotal) * 100) / 100,
          },
          budgets: {
            shoppingBudget: shoppingLimit,
            shoppingRemaining: Math.max(0, shoppingLimit - shopeeTotal),
            groceryBudget: groceryLimit,
            groceryRemaining: Math.max(0, groceryLimit - groceryTotal),
          },
          recentOrders: pagedOrders as any,
        };
      }
    );
  }
}
