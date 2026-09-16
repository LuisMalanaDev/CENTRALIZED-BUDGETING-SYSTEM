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
    const categories = (breakdownData?.breakdown || []).slice(0, 5);

    // Fetch savings goals
    let goals: Array<{ name: string; current: number; target: number; pct: number }> = [];
    try {
      const dbGoals = await prisma.savingsGoal.findMany({
        where: { userId },
        select: { name: true, currentAmount: true, targetAmount: true },
      });
      goals = dbGoals.map((g) => {
        const c = Number(g.currentAmount);
        const t = Number(g.targetAmount);
        return {
          name: g.name,
          current: c,
          target: t,
          pct: t > 0 ? Math.round((c / t) * 100) : 0,
        };
      });
    } catch {
      const mg = mockStore.savingsGoals.filter((g) => g.userId === userId);
      goals = mg.map((g) => ({
        name: g.name,
        current: g.currentAmount,
        target: g.targetAmount,
        pct: g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0,
      }));
    }

    // Compute basic savings rate
    const savingsRate = inflow > 0 ? Math.max(0, Math.round((netCashflow / inflow) * 100)) : 0;

    // 2. Try Gemini API if key is available
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (apiKey) {
      const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
      const topCatStr = categories.length > 0
        ? categories.map((c: any) => `${c.name}: ₱${c.amount} (${c.percentage}%)`).join(', ')
        : 'No specific category data logged yet';
      const goalsStr = goals.length > 0
        ? goals.map((g) => `${g.name}: ₱${g.current}/₱${g.target} (${g.pct}%)`).join(', ')
        : 'No savings vaults active';

      const prompt = `You are WealthSync AI, an expert personal financial advisor and money strategist for users in the Philippines (using ₱ / PHP).
Analyze the user's financial status for the selected period:
- Total Inflow (Income/Salary): ₱${inflow.toLocaleString()}
- Total Outflow (Expenses): ₱${outflow.toLocaleString()}
- Net Cashflow: ₱${netCashflow.toLocaleString()} (Savings Rate: ${savingsRate}%)
- Top Spending Categories: ${topCatStr}
- Active Savings Vaults: ${goalsStr}
- Mode: ${mode === 'roast' ? 'ROAST (Witty, funny, sarcastic humor poking fun at impulsive habits like late-night Shopee or food delivery, while still offering 1 good piece of advice)' : 'FINANCIAL COACH (Encouraging, analytical, strategic, high-value)'}

Return strictly valid JSON with this exact schema:
{
  "score": number, // 0 to 100 financial health score
  "headline": string, // 1 punchy sentence summarizing their state
  "insights": [
    {
      "title": string, // 2-4 word title
      "tip": string, // 1-2 sentence actionable insight
      "icon": "trending-up" | "alert-circle" | "shield-checkmark" | "trophy" | "flame"
    }
  ],
  "actionItem": string // 1 single concrete task for this week
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
    const baseScore = inflow === 0 ? 60 : Math.min(100, Math.max(20, Math.round(50 + savingsRate * 0.5 - (outflow > inflow ? 25 : 0))));
    const topCat = categories[0]?.name || 'Shopping';

    if (mode === 'roast') {
      return {
        mode: 'roast',
        score: baseScore,
        headline: outflow > inflow
          ? "Your wallet is screaming for mercy while your parcels are having a party."
          : `You're surviving, but ${topCat} is definitely your wallet's final boss.`,
        insights: [
          {
            title: 'Add to Cart Therapy',
            tip: `₱${outflow.toLocaleString()} spent this period. Just remember that adding to cart doesn't count as cardio.`,
            icon: 'flame',
          },
          {
            title: 'The Invisible Leak',
            tip: `${topCat} took the biggest chunk of your money. Maybe pause the flash deals for 48 hours?`,
            icon: 'alert-circle',
          },
          {
            title: 'Emergency Fund Check',
            tip: goals.length > 0 ? `Your vaults are trying their best. Drop some spare change into them!` : `Zero savings vaults found! Even a piggy bank from 2012 has more balance right now.`,
            icon: 'trophy',
          },
        ],
        actionItem: `Challenge: Go 48 hours with zero non-essential checkouts.`,
        generatedAt: new Date().toISOString(),
      };
    }

    return {
      mode: 'coach',
      score: baseScore,
      headline: netCashflow >= 0
        ? `Solid financial discipline with a positive cashflow of +₱${netCashflow.toLocaleString()}.`
        : `Outflow exceeded inflow by ₱${Math.abs(netCashflow).toLocaleString()}. Time to optimize core expenses.`,
      insights: [
        {
          title: 'Cashflow Velocity',
          tip: `You maintained a ${savingsRate}% savings rate this period. Aim to keep this above 20% consistently.`,
          icon: 'trending-up',
        },
        {
          title: 'Largest Outflow Driver',
          tip: `${topCat} is your top expense category. Setting a strict monthly cap can yield up to 15% instant savings.`,
          icon: 'alert-circle',
        },
        {
          title: 'Vault Growth Milestone',
          tip: goals.length > 0
            ? `${goals.length} active savings vault(s). Consistent micro-deposits accelerate your target completion.`
            : `Set up an Emergency Fund vault to protect yourself against unexpected expenses.`,
          icon: 'shield-checkmark',
        },
      ],
      actionItem: `Set a spending cap for ${topCat} to protect your remaining cashflow.`,
      generatedAt: new Date().toISOString(),
    };
  }
}

