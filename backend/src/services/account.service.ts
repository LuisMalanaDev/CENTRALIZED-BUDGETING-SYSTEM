import { prisma } from '../prisma.js';
import { AccountType } from '@prisma/client';
import { mockStore, MockAccount } from './mockStore.js';
import { dbSafe } from './dbHelper.js';

export class AccountService {
  static async listAccounts(userId: string) {
    return dbSafe(
      () => prisma.account.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      () => mockStore.accounts.filter((a) => a.userId === userId || a.userId === 'demo-user-uuid-1')
    );
  }

  static async createAccount(userId: string, data: {
    name: string;
    type: AccountType;
    balance?: number;
    currency?: string;
    color?: string;
    icon?: string;
  }) {
    return dbSafe(
      () => prisma.account.create({
        data: {
          userId,
          name: data.name,
          type: data.type,
          balance: data.balance ?? 0,
          currency: data.currency ?? 'PHP',
          color: data.color ?? '#3B82F6',
          icon: data.icon ?? 'Wallet',
        },
      }),
      () => {
        const acc: MockAccount = {
          id: `acc-${Date.now()}`,
          userId,
          name: data.name,
          type: data.type,
          balance: data.balance ?? 0,
          currency: data.currency ?? 'PHP',
          color: data.color ?? '#3B82F6',
          icon: data.icon ?? 'Wallet',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockStore.accounts.push(acc);
        return acc as any;
      }
    );
  }

  static async updateAccount(userId: string, accountId: string, data: {
    name?: string;
    type?: AccountType;
    balance?: number;
    color?: string;
    icon?: string;
  }) {
    return dbSafe(
      () => prisma.account.update({
        where: { id: accountId, userId },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.type && { type: data.type }),
          ...(data.balance !== undefined && { balance: data.balance }),
          ...(data.color && { color: data.color }),
          ...(data.icon && { icon: data.icon }),
        },
      }),
      () => {
        const acc = mockStore.accounts.find((a) => a.id === accountId);
        if (!acc) throw new Error('Account not found');
        if (data.name) acc.name = data.name;
        if (data.type) acc.type = data.type;
        if (data.balance !== undefined) acc.balance = data.balance;
        if (data.color) acc.color = data.color;
        if (data.icon) acc.icon = data.icon;
        return acc as any;
      }
    );
  }

  static async deleteAccount(userId: string, accountId: string) {
    return dbSafe(
      () => prisma.account.delete({
        where: { id: accountId, userId },
      }),
      () => {
        const idx = mockStore.accounts.findIndex((a) => a.id === accountId);
        if (idx !== -1) mockStore.accounts.splice(idx, 1);
        return { id: accountId } as any;
      }
    );
  }
}
