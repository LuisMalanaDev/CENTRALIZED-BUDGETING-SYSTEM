import { prisma } from '../prisma.js';
import { TransactionType, PaymentMethod, Prisma } from '@prisma/client';
import { mockStore, MockTransaction } from './mockStore.js';
import { dbSafe } from './dbHelper.js';

export interface ListTransactionsFilter {
  page?: number;
  limit?: number;
  type?: TransactionType;
  categoryId?: string;
  paymentMethod?: PaymentMethod;
  startDate?: string;
  endDate?: string;
  search?: string;
  isShopeeOrder?: boolean;
}

export interface CreateTransactionInput {
  amount: number;
  type?: TransactionType;
  description: string;
  notes?: string;
  paymentMethod?: PaymentMethod;
  source?: string;
  tags?: string[];
  receiptUrl?: string;
  isShopeeOrder?: boolean;
  orderTrackingNumber?: string;
  date?: string;
  accountId?: string;
  categoryId?: string;
}

export class TransactionService {
  static async listTransactions(userId: string, filters: ListTransactionsFilter) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const skip = (page - 1) * limit;

    return dbSafe(
      async () => {
        const where: Prisma.TransactionWhereInput = {
          userId,
          ...(filters.type && { type: filters.type }),
          ...(filters.categoryId && { categoryId: filters.categoryId }),
          ...(filters.paymentMethod && { paymentMethod: filters.paymentMethod }),
          ...(filters.isShopeeOrder !== undefined && { isShopeeOrder: filters.isShopeeOrder }),
          ...(filters.startDate || filters.endDate
            ? {
                date: {
                  ...(filters.startDate && { gte: new Date(filters.startDate) }),
                  ...(filters.endDate && { lte: new Date(filters.endDate) }),
                },
              }
            : {}),
          ...(filters.search
            ? {
                OR: [
                  { description: { contains: filters.search, mode: 'insensitive' } },
                  { notes: { contains: filters.search, mode: 'insensitive' } },
                  { source: { contains: filters.search, mode: 'insensitive' } },
                  { orderTrackingNumber: { contains: filters.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        };

        const [transactions, total] = await Promise.all([
          prisma.transaction.findMany({
            where,
            include: {
              account: { select: { id: true, name: true, type: true, color: true } },
              category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
            },
            orderBy: { date: 'desc' },
            skip,
            take: limit,
          }),
          prisma.transaction.count({ where }),
        ]);

        return {
          transactions,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      },
      () => {
        // Mock fallback filtering
        let list = mockStore.transactions.filter((t) => t.userId === userId || t.userId === 'demo-user-uuid-1');

        if (filters.type) {
          list = list.filter((t) => t.type === filters.type);
        }
        if (filters.categoryId) {
          list = list.filter((t) => t.categoryId === filters.categoryId);
        }
        if (filters.paymentMethod) {
          list = list.filter((t) => t.paymentMethod === filters.paymentMethod);
        }
        if (filters.isShopeeOrder !== undefined) {
          list = list.filter((t) => t.isShopeeOrder === filters.isShopeeOrder);
        }
        if (filters.search) {
          const s = filters.search.toLowerCase();
          list = list.filter((t) =>
            t.description.toLowerCase().includes(s) ||
            (t.notes && t.notes.toLowerCase().includes(s)) ||
            (t.source && t.source.toLowerCase().includes(s)) ||
            (t.orderTrackingNumber && t.orderTrackingNumber.toLowerCase().includes(s))
          );
        }
        if (filters.startDate) {
          const start = new Date(filters.startDate).getTime();
          list = list.filter((t) => new Date(t.date).getTime() >= start);
        }
        if (filters.endDate) {
          const end = new Date(filters.endDate).getTime();
          list = list.filter((t) => new Date(t.date).getTime() <= end);
        }

        const total = list.length;
        const paged = list.slice(skip, skip + limit).map((t) => {
          const account = mockStore.accounts.find((a) => a.id === t.accountId);
          const category = mockStore.categories.find((c) => c.id === t.categoryId);
          return {
            ...t,
            amount: t.amount,
            account: account ? { id: account.id, name: account.name, type: account.type, color: account.color } : null,
            category: category ? { id: category.id, name: category.name, slug: category.slug, color: category.color, icon: category.icon } : null,
          };
        });

        return {
          transactions: paged as any,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      }
    );
  }

  static async createTransaction(userId: string, input: CreateTransactionInput) {
    const amount = new Prisma.Decimal(input.amount);
    const date = input.date ? new Date(input.date) : new Date();
    const type = input.type || 'EXPENSE';

    return dbSafe(
      () => prisma.$transaction(async (tx) => {
        const transaction = await tx.transaction.create({
          data: {
            userId,
            accountId: input.accountId,
            categoryId: input.categoryId,
            type,
            amount,
            date,
            description: input.description,
            notes: input.notes,
            paymentMethod: input.paymentMethod || 'GCASH',
            source: input.source,
            tags: input.tags || [],
            receiptUrl: input.receiptUrl,
            isShopeeOrder: input.isShopeeOrder ?? false,
            orderTrackingNumber: input.orderTrackingNumber,
          },
          include: {
            account: true,
            category: true,
          },
        });

        if (input.accountId) {
          const balanceChange = type === 'INCOME' ? amount : amount.negated();
          await tx.account.update({
            where: { id: input.accountId },
            data: {
              balance: {
                increment: balanceChange,
              },
            },
          });
        }

        return transaction;
      }),
      () => {
        const newTx: MockTransaction = {
          id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          userId,
          accountId: input.accountId,
          categoryId: input.categoryId,
          type,
          amount: input.amount,
          date,
          description: input.description,
          notes: input.notes,
          paymentMethod: input.paymentMethod || 'GCASH',
          source: input.source,
          tags: input.tags || [],
          receiptUrl: input.receiptUrl,
          isShopeeOrder: input.isShopeeOrder ?? false,
          orderTrackingNumber: input.orderTrackingNumber,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Auto-resolve account if not specified
        let accId = input.accountId;
        if (!accId && input.paymentMethod) {
          if (input.paymentMethod === 'GCASH') {
            accId = mockStore.accounts.find((a) => (a.userId === userId || a.userId === 'user-liam') && a.name.toLowerCase().includes('gcash'))?.id;
          } else if (input.paymentMethod === 'BANK_TRANSFER' || input.paymentMethod === 'CREDIT_CARD') {
            accId = mockStore.accounts.find((a) => (a.userId === userId || a.userId === 'user-liam') && (a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('bpi')) )?.id;
          } else if (input.paymentMethod === 'CASH') {
            accId = mockStore.accounts.find((a) => (a.userId === userId || a.userId === 'user-liam') && a.name.toLowerCase().includes('cash'))?.id;
          }
        }
        if (!accId) {
          accId = mockStore.accounts.find((a) => a.userId === userId || a.userId === 'user-liam')?.id || mockStore.accounts[0]?.id;
        }

        newTx.accountId = accId;

        // Adjust mock account balance
        if (accId) {
          const acc = mockStore.accounts.find((a) => a.id === accId);
          if (acc) {
            acc.balance = type === 'INCOME' ? acc.balance + input.amount : acc.balance - input.amount;
          }
        }

        const account = mockStore.accounts.find((a) => a.id === accId);
        const category = mockStore.categories.find((c) => c.id === input.categoryId);

        return {
          ...newTx,
          account,
          category,
        } as any;
      }
    );
  }

  static async updateTransaction(userId: string, transactionId: string, input: Partial<CreateTransactionInput>) {
    return dbSafe(
      () => prisma.$transaction(async (tx) => {
        const existing = await tx.transaction.findUnique({
          where: { id: transactionId, userId },
        });

        if (!existing) {
          throw new Error('Transaction not found');
        }

        if (existing.accountId) {
          const revertChange = existing.type === 'INCOME' ? existing.amount.negated() : existing.amount;
          await tx.account.update({
            where: { id: existing.accountId },
            data: { balance: { increment: revertChange } },
          });
        }

        const newAmount = input.amount !== undefined ? new Prisma.Decimal(input.amount) : existing.amount;
        const newType = input.type || existing.type;
        const newAccountId = input.accountId !== undefined ? input.accountId : existing.accountId;

        if (newAccountId) {
          const newChange = newType === 'INCOME' ? newAmount : newAmount.negated();
          await tx.account.update({
            where: { id: newAccountId },
            data: { balance: { increment: newChange } },
          });
        }

        return tx.transaction.update({
          where: { id: transactionId },
          data: {
            ...(input.amount !== undefined && { amount: newAmount }),
            ...(input.type && { type: newType }),
            ...(input.description && { description: input.description }),
            ...(input.notes !== undefined && { notes: input.notes }),
            ...(input.paymentMethod && { paymentMethod: input.paymentMethod }),
            ...(input.source !== undefined && { source: input.source }),
            ...(input.tags && { tags: input.tags }),
            ...(input.receiptUrl !== undefined && { receiptUrl: input.receiptUrl }),
            ...(input.isShopeeOrder !== undefined && { isShopeeOrder: input.isShopeeOrder }),
            ...(input.orderTrackingNumber !== undefined && { orderTrackingNumber: input.orderTrackingNumber }),
            ...(input.date && { date: new Date(input.date) }),
            ...(input.accountId !== undefined && { accountId: input.accountId }),
            ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
          },
          include: {
            account: true,
            category: true,
          },
        });
      }),
      () => {
        const tx = mockStore.transactions.find((t) => t.id === transactionId);
        if (!tx) throw new Error('Transaction not found');

        if (input.amount !== undefined) tx.amount = input.amount;
        if (input.description) tx.description = input.description;
        if (input.notes !== undefined) tx.notes = input.notes;
        if (input.paymentMethod) tx.paymentMethod = input.paymentMethod;
        if (input.source !== undefined) tx.source = input.source;
        if (input.tags) tx.tags = input.tags;
        if (input.isShopeeOrder !== undefined) tx.isShopeeOrder = input.isShopeeOrder;
        if (input.orderTrackingNumber !== undefined) tx.orderTrackingNumber = input.orderTrackingNumber;

        return tx as any;
      }
    );
  }

  static async deleteTransaction(userId: string, transactionId: string) {
    return dbSafe(
      () => prisma.$transaction(async (tx) => {
        const existing = await tx.transaction.findUnique({
          where: { id: transactionId, userId },
        });

        if (!existing) {
          throw new Error('Transaction not found');
        }

        if (existing.accountId) {
          const revertChange = existing.type === 'INCOME' ? existing.amount.negated() : existing.amount;
          await tx.account.update({
            where: { id: existing.accountId },
            data: { balance: { increment: revertChange } },
          });
        }

        return tx.transaction.delete({
          where: { id: transactionId },
        });
      }),
      () => {
        const idx = mockStore.transactions.findIndex((t) => t.id === transactionId);
        if (idx !== -1) {
          const existing = mockStore.transactions[idx];
          if (existing.accountId) {
            const acc = mockStore.accounts.find((a) => a.id === existing.accountId);
            if (acc) {
              acc.balance = existing.type === 'INCOME' ? acc.balance - existing.amount : acc.balance + existing.amount;
            }
          }
          mockStore.transactions.splice(idx, 1);
        }
        return { id: transactionId } as any;
      }
    );
  }

  static async bulkCreateTransactions(userId: string, items: CreateTransactionInput[]) {
    const results = [];
    for (const item of items) {
      const created = await this.createTransaction(userId, item);
      results.push(created);
    }
    return results;
  }
}
