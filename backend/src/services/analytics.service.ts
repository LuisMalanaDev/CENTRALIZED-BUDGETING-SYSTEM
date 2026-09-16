import { prisma } from '../prisma.js';
import { mockStore } from './mockStore.js';
import { dbSafe } from './dbHelper.js';
import { parseDateBounds } from '../utils/dateHelper.js';

export class AnalyticsService {
  static async getSummary(userId: string, dateFilter?: { startDate?: string; endDate?: string; timezone?: string }) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const currentDay = now.getDate();
    const daysRemaining = Math.max(1, totalDaysInMonth - currentDay + 1);

    const { startDate, endDate } = parseDateBounds(dateFilter?.startDate, dateFilter?.endDate, dateFilter?.timezone);
    const hasDateFilter = Boolean(startDate || endDate);

    return dbSafe(
      async () => {
        const accounts = await prisma.account.findMany({
          where: { userId },
          select: { balance: true },
        });
        const totalNetWorth = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

        const whereClause: any = { userId };
        if (hasDateFilter) {
          whereClause.date = {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          };
        }

        const monthTransactions = await prisma.transaction.findMany({
          where: whereClause,
          select: { amount: true, type: true },
        });

        let monthlyIncome = 0;
        let monthlyBurnRate = 0;

        for (const t of monthTransactions) {
          if (t.type === 'INCOME') monthlyIncome += Number(t.amount);
          else if (t.type === 'EXPENSE') monthlyBurnRate += Number(t.amount);
        }

        // Compute full active month inflow (unaffected by daily filters)
        const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);
        const endOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
        const currentMonthInflowTxs = await prisma.transaction.findMany({
          where: {
            userId,
            type: 'INCOME',
            date: {
              gte: startOfCurrentMonth,
              lte: endOfCurrentMonth,
            },
          },
          select: { amount: true },
        });
        const activeMonthInflow = currentMonthInflowTxs.reduce((sum, t) => sum + Number(t.amount), 0);

        const currentMonthOutflowTxs = await prisma.transaction.findMany({
          where: {
            userId,
            type: 'EXPENSE',
            date: {
              gte: startOfCurrentMonth,
              lte: endOfCurrentMonth,
            },
          },
          select: { amount: true },
        });
        const activeMonthOutflow = currentMonthOutflowTxs.reduce((sum, t) => sum + Number(t.amount), 0);

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
          totalExpenses: Math.round(monthlyBurnRate * 100) / 100,
          totalIncome: Math.round(monthlyIncome * 100) / 100,
          totalOutflow: Math.round(monthlyBurnRate * 100) / 100,
          totalInflow: Math.round(monthlyIncome * 100) / 100,
          activeMonthInflow: Math.round(activeMonthInflow * 100) / 100,
          activeMonthOutflow: Math.round(activeMonthOutflow * 100) / 100,
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
          (!startDate || new Date(t.date) >= startDate) &&
          (!endDate || new Date(t.date) <= endDate)
        );

        let monthlyIncome = 0;
        let monthlyBurnRate = 0;

        for (const t of monthTransactions) {
          if (t.type === 'INCOME') monthlyIncome += t.amount;
          else if (t.type === 'EXPENSE') monthlyBurnRate += t.amount;
        }

        const activeMonthInflow = mockStore.transactions
          .filter(
            (t) => (t.userId === userId || t.userId === 'demo-user-uuid-1' || t.userId === 'user-liam') &&
            t.type === 'INCOME' &&
            new Date(t.date).getMonth() === currentMonth &&
            new Date(t.date).getFullYear() === currentYear
          )
          .reduce((sum, t) => sum + t.amount, 0);

        const activeMonthOutflow = mockStore.transactions
          .filter(
            (t) => (t.userId === userId || t.userId === 'demo-user-uuid-1' || t.userId === 'user-liam') &&
            t.type === 'EXPENSE' &&
            new Date(t.date).getMonth() === currentMonth &&
            new Date(t.date).getFullYear() === currentYear
          )
          .reduce((sum, t) => sum + t.amount, 0);

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
          totalExpenses: Math.round(monthlyBurnRate * 100) / 100,
          totalIncome: Math.round(monthlyIncome * 100) / 100,
          totalOutflow: Math.round(monthlyBurnRate * 100) / 100,
          totalInflow: Math.round(monthlyIncome * 100) / 100,
          activeMonthInflow: Math.round(activeMonthInflow * 100) / 100,
          activeMonthOutflow: Math.round(activeMonthOutflow * 100) / 100,
          netCashflow: Math.round((monthlyIncome - monthlyBurnRate) * 100) / 100,
          overallBudgetLimit: budgetAmount,
          remainingDailyBudget: dailyBudgetRemaining,
          daysRemainingInMonth: daysRemaining,
        };
      }
    );
  }

  static async getCategoryBreakdown(userId: string, dateFilter?: { startDate?: string; endDate?: string; timezone?: string }) {
    const { startDate, endDate } = parseDateBounds(dateFilter?.startDate, dateFilter?.endDate, dateFilter?.timezone);
    const hasDateFilter = Boolean(startDate || endDate);

    return dbSafe(
      async () => {
        const whereClause: any = {
          userId,
          type: 'EXPENSE',
        };
        if (hasDateFilter) {
          whereClause.date = {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          };
        }

        const expenses = await prisma.transaction.findMany({
          where: whereClause,
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
        const expenses = mockStore.transactions.filter(
          (t) => (t.userId === userId || t.userId === 'demo-user-uuid-1' || t.userId === 'user-liam') &&
          t.type === 'EXPENSE' &&
          (!startDate || new Date(t.date) >= startDate) &&
          (!endDate || new Date(t.date) <= endDate)
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

  static async getPaymentMethodShare(userId: string, dateFilter?: { startDate?: string; endDate?: string; timezone?: string }) {
    const { startDate, endDate } = parseDateBounds(dateFilter?.startDate, dateFilter?.endDate, dateFilter?.timezone);
    const hasDateFilter = Boolean(startDate || endDate);

    return dbSafe(
      async () => {
        const whereClause: any = {
          userId,
          type: 'EXPENSE',
        };
        if (hasDateFilter) {
          whereClause.date = {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          };
        }

        const transactions = await prisma.transaction.findMany({
          where: whereClause,
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
        const transactions = mockStore.transactions.filter(
          (t) => (t.userId === userId || t.userId === 'demo-user-uuid-1' || t.userId === 'user-liam') &&
          t.type === 'EXPENSE' &&
          (!startDate || new Date(t.date) >= startDate) &&
          (!endDate || new Date(t.date) <= endDate)
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

  static async getLifestyleShoppingTracker(userId: string, dateFilter?: { startDate?: string; endDate?: string; timezone?: string }) {
    const { startDate, endDate } = parseDateBounds(dateFilter?.startDate, dateFilter?.endDate, dateFilter?.timezone);
    const hasDateFilter = Boolean(startDate || endDate);

    return dbSafe(
      async () => {
        const whereClause: any = {
          userId,
          type: 'EXPENSE',
          OR: [
            { isShopeeOrder: true },
            { tags: { hasSome: ['Shopee', 'Groceries', 'Food', 'Dining Out'] } },
            { source: { in: ['Shopee', 'GrabFood', 'FoodPanda', 'Supermarket'] } },
          ],
        };
        if (hasDateFilter) {
          whereClause.date = {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          };
        }

        const transactions = await prisma.transaction.findMany({
          where: whereClause,
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
        const transactions = mockStore.transactions.filter(
          (t) => (t.userId === userId || t.userId === 'demo-user-uuid-1' || t.userId === 'user-liam') &&
          (!startDate || new Date(t.date) >= startDate) &&
          (!endDate || new Date(t.date) <= endDate) &&
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

  static async getAiInsights(
    userId: string,
    options?: { startDate?: string; endDate?: string; timezone?: string; mode?: 'coach' | 'roast' }
  ) {
    const mode = options?.mode === 'roast' ? 'roast' : 'coach';

    // 1. Gather live financial figures
    const [summary, breakdownData] = await Promise.all([
      this.getSummary(userId, options).catch(() => null),
      this.getCategoryBreakdown(userId, options).catch(() => ({ breakdown: [], totalExpense: 0 })),
    ]);

    const inflow = summary?.totalInflow ?? summary?.monthlyIncome ?? 0;
    const outflow = summary?.totalOutflow ?? summary?.totalExpenses ?? 0;
    const netCashflow = summary?.netCashflow ?? (inflow - outflow);
    const categories: Array<{ name: string; amount: number; percentage: number; color?: string }> =
      (breakdownData?.breakdown || []).slice(0, 8);

    // Compute days remaining in current month for spending pacing
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysRemaining = Math.max(1, Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const safeDailySpend = netCashflow > 0 ? Math.round(netCashflow / daysRemaining) : 0;

    // Fetch savings goals
    const goals = await dbSafe(
      async () => {
        const dbGoals = await prisma.savingsGoal.findMany({
          where: { userId },
          select: { name: true, currentAmount: true, targetAmount: true },
        });
        return dbGoals.map((g) => {
          const c = Number(g.currentAmount);
          const t = Number(g.targetAmount);
          return {
            name: g.name,
            current: c,
            target: t,
            pct: t > 0 ? Math.round((c / t) * 100) : 0,
          };
        });
      },
      () => {
        const mg = mockStore.savingsGoals.filter((g) => g.userId === userId);
        return mg.map((g) => ({
          name: g.name,
          current: g.currentAmount,
          target: g.targetAmount,
          pct: g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0,
        }));
      }
    );

    // Fetch active budgets
    const budgets = await dbSafe(
      async () => {
        const dbBudgets = await prisma.budget.findMany({
          where: { userId },
          include: { category: true },
        });
        return dbBudgets.map((b) => {
          const limit = Number(b.amount);
          const match = categories.find((c) => c.name.toLowerCase() === b.category?.name?.toLowerCase());
          const spent = match ? match.amount : 0;
          return {
            category: b.category?.name || b.name,
            limit,
            spent,
            pct: limit > 0 ? Math.round((spent / limit) * 100) : 0,
          };
        });
      },
      () => {
        const mb = mockStore.budgets.filter((b) => b.userId === userId);
        return mb.map((b) => ({
          category: b.name,
          limit: b.amount,
          spent: 0,
          pct: 0,
        }));
      }
    );

    // Compute basic savings rate
    const savingsRate = inflow > 0 ? Math.max(0, Math.round((netCashflow / inflow) * 100)) : 0;

    // Detect Category Burn Warnings (e.g. Transportation, Food & Dining, Shopee/Online)
    const categoryWarnings: Array<{
      category: string;
      amount: number;
      percentage: number;
      status: 'danger' | 'warning' | 'info';
      message: string;
      tip: string;
    }> = [];

    for (const cat of categories) {
      const lower = cat.name.toLowerCase();
      if (lower.includes('transpo') || lower.includes('transportation') || lower.includes('gas') || lower.includes('commute')) {
        if (cat.percentage >= 15 || cat.amount >= 2500) {
          categoryWarnings.push({
            category: cat.name,
            amount: cat.amount,
            percentage: cat.percentage,
            status: cat.percentage >= 25 ? 'danger' : 'warning',
            message: `Transportation takes ${cat.percentage}% of your expenses (₱${cat.amount.toLocaleString()}).`,
            tip: `Combine errands into single trips or use train/bus for non-urgent commutes to keep ~₱500 in your pocket.`,
          });
        }
      } else if (lower.includes('food') || lower.includes('dining') || lower.includes('restaurant') || lower.includes('delivery')) {
        if (cat.percentage >= 28 || cat.amount >= 3500) {
          categoryWarnings.push({
            category: cat.name,
            amount: cat.amount,
            percentage: cat.percentage,
            status: cat.percentage >= 40 ? 'danger' : 'warning',
            message: `Food & Dining is consuming ${cat.percentage}% of your budget (₱${cat.amount.toLocaleString()}).`,
            tip: `Cook meals at home 2 extra days this week and reduce delivery app orders to lower food costs.`,
          });
        }
      } else if (lower.includes('shopee') || lower.includes('lazada') || lower.includes('shopping') || lower.includes('online')) {
        if (cat.percentage >= 15 || cat.amount >= 2000) {
          categoryWarnings.push({
            category: cat.name,
            amount: cat.amount,
            percentage: cat.percentage,
            status: cat.percentage >= 25 ? 'danger' : 'warning',
            message: `Online shopping accounts for ${cat.percentage}% of spending (₱${cat.amount.toLocaleString()}).`,
            tip: `Use the 48-Hour Cart Rule: leave items in your cart for 2 full days before buying to prevent impulsive checkouts.`,
          });
        }
      }
    }

    // Check for any category budget nearing or exceeding limit
    for (const b of budgets) {
      if (b.pct >= 80 && !categoryWarnings.some((w) => w.category.toLowerCase() === b.category.toLowerCase())) {
        categoryWarnings.push({
          category: b.category,
          amount: b.spent,
          percentage: b.pct,
          status: b.pct >= 100 ? 'danger' : 'warning',
          message: `${b.category} budget is ${b.pct}% consumed (₱${b.spent.toLocaleString()} / ₱${b.limit.toLocaleString()}).`,
          tip: b.pct >= 100
            ? `Limit exceeded by ₱${(b.spent - b.limit).toLocaleString()}. Freeze spending in this category until next month.`
            : `Only ₱${(b.limit - b.spent).toLocaleString()} remaining for the next ${daysRemaining} days.`,
        });
      }
    }

    // Determine Pacing Status
    const pacingStatus: 'comfortable' | 'tight' | 'critical' =
      netCashflow <= 0 ? 'critical' : safeDailySpend < 200 ? 'tight' : 'comfortable';
    const pacingMessage =
      netCashflow <= 0
        ? `Outflow has exceeded inflow by ₱${Math.abs(netCashflow).toLocaleString()}. Freeze non-essential purchases.`
        : safeDailySpend < 200
        ? `Budget is tight. Limit daily discretionary spend to ₱${safeDailySpend}/day for the remaining ${daysRemaining} days.`
        : `Smooth pacing: You can comfortably spend up to ₱${safeDailySpend}/day over the next ${daysRemaining} days.`;

    // 2. Try Gemini API if key is available
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (apiKey) {
      const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
      const topCatStr = categories.length > 0
        ? categories.map((c: any) => `${c.name}: ₱${c.amount.toLocaleString()} (${c.percentage}%)`).join(', ')
        : 'No specific category data logged yet';
      const goalsStr = goals.length > 0
        ? goals.map((g) => `${g.name}: ₱${g.current.toLocaleString()}/₱${g.target.toLocaleString()} (${g.pct}%)`).join(', ')
        : 'No savings vaults active';
      const budgetsStr = budgets.length > 0
        ? budgets.map((b) => `${b.category}: ₱${b.spent.toLocaleString()}/₱${b.limit.toLocaleString()} (${b.pct}% used)`).join(', ')
        : 'No category budgets configured';

      const prompt = `You are WealthSync AI, an expert personal financial advisor and cashflow pacing strategist for users in the Philippines (using ₱ / PHP).
Analyze the user's financial status for the selected period:
- Total Inflow (Income/Salary): ₱${inflow.toLocaleString()}
- Total Outflow (Expenses): ₱${outflow.toLocaleString()}
- Net Cashflow: ₱${netCashflow.toLocaleString()} (Savings Rate: ${savingsRate}%)
- Days Remaining in Month: ${daysRemaining} days
- Safe Daily Spending Allowance: ₱${safeDailySpend}/day
- Category Spending Breakdown: ${topCatStr}
- Active Category Budgets: ${budgetsStr}
- Savings Vaults: ${goalsStr}
- Mode: ${mode === 'roast' ? 'ROAST (Witty, hilarious Filipino roast about late-night Grab rides, Shopee parcels, coffee runs, and surviving petsa de peligro, while still giving 1 helpful tip)' : 'FINANCIAL COACH (Warm, practical, highly strategic coach helping the user handle money smoothly and pacing expenses)'}

Key Instructions:
1. Provide practical tips on pacing money smoothly so they do not run dry before payday.
2. If spending is high in categories like Transportation, Food & Dining, or Shopping, explain how to optimize them with realistic PH substitutions.
3. Guide them on prioritizing Savings Vaults first upon receiving money.

Return strictly valid JSON with this exact schema:
{
  "score": number, // 0 to 100 financial health score
  "headline": string, // 1 punchy sentence summarizing their pacing and state
  "pacing": {
    "safeDailySpend": number, // PHP safe daily spend
    "daysRemaining": number,
    "status": "comfortable" | "tight" | "critical",
    "message": string // Pacing guidance sentence
  },
  "categoryWarnings": [
    {
      "category": string,
      "amount": number,
      "percentage": number,
      "status": "danger" | "warning" | "info",
      "message": string,
      "tip": string
    }
  ],
  "insights": [
    {
      "title": string, // 2-4 word title
      "tip": string, // 1-2 sentence actionable insight
      "icon": "trending-up" | "alert-circle" | "shield-checkmark" | "trophy" | "flame"
    }
  ],
  "actionItem": string // 1 single concrete high-impact task for this week
}`;

      for (const model of models) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  response_mime_type: 'application/json',
                  temperature: mode === 'roast' ? 0.8 : 0.2,
                },
              }),
            }
          );

          if (res.ok) {
            const data: any = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const parsed = JSON.parse(text);
              if (parsed.headline && Array.isArray(parsed.insights)) {
                return {
                  mode,
                  score: typeof parsed.score === 'number' ? Math.min(100, Math.max(0, parsed.score)) : 75,
                  headline: parsed.headline,
                  pacing: parsed.pacing || {
                    safeDailySpend,
                    daysRemaining,
                    status: pacingStatus,
                    message: pacingMessage,
                  },
                  categoryWarnings: Array.isArray(parsed.categoryWarnings) && parsed.categoryWarnings.length > 0
                    ? parsed.categoryWarnings.slice(0, 3)
                    : categoryWarnings.slice(0, 3),
                  insights: parsed.insights.slice(0, 3),
                  actionItem: parsed.actionItem || 'Review top expenses this weekend.',
                  generatedAt: new Date().toISOString(),
                };
              }
            }
          }
        } catch {
          // Try next model
        }
      }
    }

    // 3. Smart Algorithmic Fallback (if offline or no API key)
    const baseScore = inflow === 0
      ? 60
      : Math.min(100, Math.max(20, Math.round(50 + savingsRate * 0.5 - (outflow > inflow ? 25 : 0))));
    const topCat = categories[0]?.name || 'Shopping';

    // Ensure we have at least one helpful category tip in fallback
    const fallbackCategoryWarnings = categoryWarnings.length > 0
      ? categoryWarnings.slice(0, 3)
      : [
          {
            category: topCat,
            amount: categories[0]?.amount || outflow,
            percentage: categories[0]?.percentage || 100,
            status: 'warning' as const,
            message: `${topCat} is your largest expense driver (${categories[0]?.percentage || 100}% of outflow).`,
            tip: `Setting a weekly cap on ${topCat} will immediately stabilize your daily cashflow.`,
          },
        ];

    if (mode === 'roast') {
      return {
        mode: 'roast',
        score: baseScore,
        headline: outflow > inflow
          ? "Your wallet is screaming for mercy while your parcels and rides are having a fiesta."
          : `You're surviving, but ${topCat} is definitely your wallet's final boss.`,
        pacing: {
          safeDailySpend,
          daysRemaining,
          status: pacingStatus,
          message: outflow > inflow
            ? `You have negative cashflow. Stop spending on wants before petsa de peligro takes over!`
            : `Safe daily allowance is ₱${safeDailySpend}/day for ${daysRemaining} days. Treat yourself, but don't splurge!`,
        },
        categoryWarnings: fallbackCategoryWarnings,
        insights: [
          {
            title: 'Add to Cart Therapy',
            tip: `₱${outflow.toLocaleString()} spent this period. Remember that ordering GrabFood every time you're slightly hungry isn't a financial strategy.`,
            icon: 'flame',
          },
          {
            title: 'The Invisible Commute Leak',
            tip: `${topCat} took the biggest chunk of your money. Maybe pause the rush-hour premium rides for a few days?`,
            icon: 'alert-circle',
          },
          {
            title: 'Emergency Fund Check',
            tip: goals.length > 0
              ? `Your vaults are trying their best. Drop some spare change into them before you spend it on coffee!`
              : `Zero savings vaults found! Even an empty biscuit tin has more financial security right now.`,
            icon: 'trophy',
          },
        ],
        actionItem: `Challenge: Go 48 hours without food delivery or impulse checkouts.`,
        generatedAt: new Date().toISOString(),
      };
    }

    return {
      mode: 'coach',
      score: baseScore,
      headline: netCashflow >= 0
        ? `Smooth cashflow pacing with a positive net buffer of +₱${netCashflow.toLocaleString()}.`
        : `Outflow exceeded inflow by ₱${Math.abs(netCashflow).toLocaleString()}. Rebalance non-essential expenses.`,
      pacing: {
        safeDailySpend,
        daysRemaining,
        status: pacingStatus,
        message: pacingMessage,
      },
      categoryWarnings: fallbackCategoryWarnings,
      insights: [
        {
          title: 'Daily Safe-Spend Pacer',
          tip: safeDailySpend > 0
            ? `Keep daily non-essential spend below ₱${safeDailySpend}/day over the next ${daysRemaining} days to stay completely in the green.`
            : `Your cashflow is currently depleted. Limit all transactions strictly to essential food and bills.`,
          icon: 'trending-up',
        },
        {
          title: 'Category Burn Control',
          tip: `${topCat} represents your biggest outflow. Capping this single category will smooth out your end-of-month finances.`,
          icon: 'alert-circle',
        },
        {
          title: 'Vault-First Rule',
          tip: goals.length > 0
            ? `${goals.length} active vault(s). Deposit into savings immediately upon receiving income, rather than saving what is left.`
            : `Open an Emergency Fund vault to cushion unexpected spikes in transportation and medical costs.`,
          icon: 'shield-checkmark',
        },
      ],
      actionItem: `Set a weekly budget cap for ${topCat} to protect your remaining ₱${safeDailySpend}/day allowance.`,
      generatedAt: new Date().toISOString(),
    };
  }
}

