import { FastifyInstance } from 'fastify';
import { prisma } from '../prisma.js';
import { dbSafe } from '../services/dbHelper.js';
import { mockStore } from '../services/mockStore.js';

export async function adminRoutes(fastify: FastifyInstance) {
  // Get platform KPI summary for admin dashboard
  fastify.get('/summary', async (request, reply) => {
    return dbSafe(
      async () => {
        const [totalUsers, totalTransactions, totalWallets, transactions] = await Promise.all([
          prisma.user.count(),
          prisma.transaction.count(),
          prisma.account.count(),
          prisma.transaction.findMany({
            select: { amount: true, type: true },
          }),
        ]);

        const totalVolume = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const totalExpenses = transactions
          .filter((t) => t.type === 'EXPENSE')
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const totalIncome = transactions
          .filter((t) => t.type === 'INCOME')
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);

        return {
          totalUsers,
          totalTransactions,
          totalWallets,
          totalVolume,
          totalExpenses,
          totalIncome,
          systemStatus: 'ONLINE_ACTIVE',
        };
      },
      async () => {
        const totalUsers = mockStore.users.length;
        const totalTransactions = mockStore.transactions.length;
        const totalWallets = mockStore.accounts.length;
        const totalVolume = mockStore.transactions.reduce((sum, t) => sum + t.amount, 0);

        return {
          totalUsers: Math.max(1, totalUsers),
          totalTransactions,
          totalWallets,
          totalVolume,
          totalExpenses: totalVolume,
          totalIncome: 0,
          systemStatus: 'ONLINE_ACTIVE',
        };
      }
    );
  });

  // Get directory of all registered users
  fastify.get('/users', async (request, reply) => {
    return dbSafe(
      async () => {
        const users = await prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            name: true,
            currency: true,
            createdAt: true,
            _count: {
              select: {
                transactions: true,
                accounts: true,
              },
            },
            accounts: {
              select: {
                balance: true,
              },
            },
          },
        });

        const formatted = users.map((u) => {
          const totalBalance = u.accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
          return {
            id: u.id,
            email: u.email,
            name: u.name || 'User',
            currency: u.currency || 'PHP',
            createdAt: u.createdAt,
            transactionCount: u._count.transactions,
            walletCount: u._count.accounts,
            totalBalance,
          };
        });

        return { users: formatted };
      },
      async () => {
        const formatted = mockStore.users.map((u) => {
          const userAccounts = mockStore.accounts.filter((a) => a.userId === u.id);
          const userTxs = mockStore.transactions.filter((t) => t.userId === u.id);
          const totalBal = userAccounts.reduce((sum, a) => sum + a.balance, 0);

          return {
            id: u.id,
            email: u.email,
            name: u.name,
            currency: u.currency,
            createdAt: u.createdAt,
            transactionCount: userTxs.length,
            walletCount: userAccounts.length,
            totalBalance: totalBal,
          };
        });

        return { users: formatted };
      }
    );
  });

  // System-wide analytics
  fastify.get('/analytics', async (request, reply) => {
    return dbSafe(
      async () => {
        const transactions = await prisma.transaction.findMany({
          select: {
            amount: true,
            type: true,
            category: { select: { name: true } },
            paymentMethod: true,
            date: true,
          },
        });

        // Group by category
        const categoryMap: Record<string, number> = {};
        const methodMap: Record<string, number> = {};

        for (const t of transactions) {
          const cat = t.category?.name || 'General';
          categoryMap[cat] = (categoryMap[cat] || 0) + Number(t.amount || 0);

          const method = t.paymentMethod || 'OTHER';
          methodMap[method] = (methodMap[method] || 0) + Number(t.amount || 0);
        }

        const categoryBreakdown = Object.entries(categoryMap).map(([category, amount]) => ({
          category,
          amount,
        }));

        const paymentBreakdown = Object.entries(methodMap).map(([method, amount]) => ({
          method,
          amount,
        }));

        return {
          categoryBreakdown,
          paymentBreakdown,
          totalRecords: transactions.length,
        };
      },
      async () => {
        const categoryMap: Record<string, number> = {};
        const methodMap: Record<string, number> = {};

        for (const t of mockStore.transactions) {
          const cat = t.categoryId || 'General';
          categoryMap[cat] = (categoryMap[cat] || 0) + t.amount;

          const method = t.paymentMethod || 'OTHER';
          methodMap[method] = (methodMap[method] || 0) + t.amount;
        }

        return {
          categoryBreakdown: Object.entries(categoryMap).map(([category, amount]) => ({ category, amount })),
          paymentBreakdown: Object.entries(methodMap).map(([method, amount]) => ({ method, amount })),
          totalRecords: mockStore.transactions.length,
        };
      }
    );
  });
}
