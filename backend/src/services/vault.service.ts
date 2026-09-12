import { prisma } from '../prisma.js';
import { Prisma } from '@prisma/client';
import { mockStore, MockSavingsGoal } from './mockStore.js';
import { dbSafe } from './dbHelper.js';

export class VaultService {
  static async listGoals(userId: string) {
    return dbSafe(
      async () => {
        const goals = await prisma.savingsGoal.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        });

        return goals.map((g) => {
          const current = Number(g.currentAmount);
          const target = Number(g.targetAmount);
          const progressPercent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
          const remainingAmount = Math.max(0, target - current);

          return {
            id: g.id,
            name: g.name,
            targetAmount: target,
            currentAmount: current,
            targetDate: g.targetDate,
            color: g.color || '#3B82F6',
            icon: g.icon || 'ShieldCheck',
            isLocked: g.isLocked,
            progressPercent,
            remainingAmount: Math.round(remainingAmount * 100) / 100,
            isCompleted: current >= target,
            createdAt: g.createdAt,
          };
        });
      },
      () => {
        const goals = mockStore.savingsGoals.filter((g) => g.userId === userId || g.userId === 'demo-user-uuid-1');
        return goals.map((g) => {
          const current = g.currentAmount;
          const target = g.targetAmount;
          const progressPercent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
          const remainingAmount = Math.max(0, target - current);

          return {
            id: g.id,
            name: g.name,
            targetAmount: target,
            currentAmount: current,
            targetDate: g.targetDate,
            color: g.color || '#3B82F6',
            icon: g.icon || 'ShieldCheck',
            isLocked: g.isLocked,
            progressPercent,
            remainingAmount: Math.round(remainingAmount * 100) / 100,
            isCompleted: current >= target,
            createdAt: g.createdAt,
          };
        });
      }
    );
  }

  static async createGoal(userId: string, data: {
    name: string;
    targetAmount: number;
    currentAmount?: number;
    targetDate?: string;
    color?: string;
    icon?: string;
    isLocked?: boolean;
  }) {
    return dbSafe(
      () => prisma.savingsGoal.create({
        data: {
          userId,
          name: data.name,
          targetAmount: new Prisma.Decimal(data.targetAmount),
          currentAmount: new Prisma.Decimal(data.currentAmount ?? 0),
          targetDate: data.targetDate ? new Date(data.targetDate) : null,
          color: data.color || '#3B82F6',
          icon: data.icon || 'ShieldCheck',
          isLocked: data.isLocked ?? false,
        },
      }),
      () => {
        const newGoal: MockSavingsGoal = {
          id: `goal-${Date.now()}`,
          userId,
          name: data.name,
          targetAmount: data.targetAmount,
          currentAmount: data.currentAmount ?? 0,
          targetDate: data.targetDate ? new Date(data.targetDate) : null,
          color: data.color || '#3B82F6',
          icon: data.icon || 'ShieldCheck',
          isLocked: data.isLocked ?? false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockStore.savingsGoals.push(newGoal);
        return newGoal as any;
      }
    );
  }

  static async updateGoal(userId: string, goalId: string, data: {
    name?: string;
    targetAmount?: number;
    currentAmount?: number;
    targetDate?: string;
    color?: string;
    icon?: string;
    isLocked?: boolean;
  }) {
    return dbSafe(
      () => prisma.savingsGoal.update({
        where: { id: goalId, userId },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.targetAmount !== undefined && { targetAmount: new Prisma.Decimal(data.targetAmount) }),
          ...(data.currentAmount !== undefined && { currentAmount: new Prisma.Decimal(data.currentAmount) }),
          ...(data.targetDate !== undefined && { targetDate: data.targetDate ? new Date(data.targetDate) : null }),
          ...(data.color && { color: data.color }),
          ...(data.icon && { icon: data.icon }),
          ...(data.isLocked !== undefined && { isLocked: data.isLocked }),
        },
      }),
      () => {
        const goal = mockStore.savingsGoals.find((g) => g.id === goalId);
        if (!goal) throw new Error('Savings Goal not found');
        if (data.name) goal.name = data.name;
        if (data.targetAmount !== undefined) goal.targetAmount = data.targetAmount;
        if (data.currentAmount !== undefined) goal.currentAmount = data.currentAmount;
        return goal as any;
      }
    );
  }

  static async depositOrWithdraw(userId: string, goalId: string, input: {
    amount: number;
    action: 'DEPOSIT' | 'WITHDRAW';
    accountId?: string;
  }) {
    return dbSafe(
      () => prisma.$transaction(async (tx) => {
        const goal = await tx.savingsGoal.findUnique({
          where: { id: goalId, userId },
        });

        if (!goal) throw new Error('Savings Goal not found');
        const diff = new Prisma.Decimal(input.amount);
        const isDeposit = input.action === 'DEPOSIT';

        if (!isDeposit && Number(goal.currentAmount) < input.amount) {
          throw new Error('Cannot withdraw more than current vault balance');
        }

        const updatedGoal = await tx.savingsGoal.update({
          where: { id: goalId },
          data: {
            currentAmount: isDeposit
              ? { increment: diff }
              : { decrement: diff },
          },
        });

        if (input.accountId) {
          await tx.account.update({
            where: { id: input.accountId, userId },
            data: {
              balance: isDeposit
                ? { decrement: diff }
                : { increment: diff },
            },
          });
        }

        return updatedGoal;
      }),
      () => {
        const goal = mockStore.savingsGoals.find((g) => g.id === goalId);
        if (!goal) throw new Error('Savings Goal not found');
        const isDeposit = input.action === 'DEPOSIT';

        if (!isDeposit && goal.currentAmount < input.amount) {
          throw new Error('Cannot withdraw more than current vault balance');
        }

        goal.currentAmount = isDeposit ? goal.currentAmount + input.amount : goal.currentAmount - input.amount;

        if (input.accountId) {
          const acc = mockStore.accounts.find((a) => a.id === input.accountId);
          if (acc) {
            acc.balance = isDeposit ? acc.balance - input.amount : acc.balance + input.amount;
          }
        }

        return goal as any;
      }
    );
  }

  static async deleteGoal(userId: string, goalId: string) {
    return dbSafe(
      () => prisma.savingsGoal.delete({
        where: { id: goalId, userId },
      }),
      () => {
        const idx = mockStore.savingsGoals.findIndex((g) => g.id === goalId);
        if (idx !== -1) mockStore.savingsGoals.splice(idx, 1);
        return { id: goalId } as any;
      }
    );
  }
}
