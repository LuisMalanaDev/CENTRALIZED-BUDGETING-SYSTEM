import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BudgetService } from '../services/budget.service.js';
import { authenticate } from '../plugins/auth.js';
import { BudgetPeriod } from '@prisma/client';

const createBudgetSchema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
  categoryId: z.string().nullable().optional(),
  period: z.enum(['MONTHLY', 'WEEKLY', 'YEARLY']).optional(),
});

export async function budgetRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // List budgets with current month spent metrics
  fastify.get('/', async (request, reply) => {
    const result = await BudgetService.listBudgets(request.user.userId);
    return reply.send(result);
  });

  // Create budget
  fastify.post('/', async (request, reply) => {
    const parsed = createBudgetSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.format() });
    }

    const budget = await BudgetService.createBudget(request.user.userId, {
      name: parsed.data.name,
      amount: parsed.data.amount,
      categoryId: parsed.data.categoryId,
      period: parsed.data.period as BudgetPeriod,
    });

    return reply.status(201).send({ budget });
  });

  // Update budget
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    try {
      const updated = await BudgetService.updateBudget(request.user.userId, id, body);
      return reply.send({ budget: updated });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to update budget' });
    }
  });

  // Delete budget
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await BudgetService.deleteBudget(request.user.userId, id);
      return reply.send({ message: 'Budget deleted successfully' });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to delete budget' });
    }
  });
}
