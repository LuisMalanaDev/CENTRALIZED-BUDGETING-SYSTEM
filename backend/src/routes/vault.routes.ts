import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { VaultService } from '../services/vault.service.js';
import { authenticate } from '../plugins/auth.js';

const createGoalSchema = z.object({
  name: z.string().min(1),
  targetAmount: z.number().positive(),
  currentAmount: z.number().optional(),
  targetDate: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isLocked: z.boolean().optional(),
});

const depositWithdrawSchema = z.object({
  amount: z.number().positive(),
  action: z.enum(['DEPOSIT', 'WITHDRAW']),
  accountId: z.string().optional(),
});

export async function vaultRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // List goals
  fastify.get('/', async (request, reply) => {
    const goals = await VaultService.listGoals(request.user.userId);
    return reply.send({ goals });
  });

  // Create goal
  fastify.post('/', async (request, reply) => {
    const parsed = createGoalSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.format() });
    }

    const goal = await VaultService.createGoal(request.user.userId, parsed.data);
    return reply.status(201).send({ goal });
  });

  // Update goal
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    try {
      const updated = await VaultService.updateGoal(request.user.userId, id, body);
      return reply.send({ goal: updated });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to update goal' });
    }
  });

  // Deposit or Withdraw
  fastify.post('/:id/deposit', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = depositWithdrawSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.format() });
    }

    try {
      const updatedGoal = await VaultService.depositOrWithdraw(request.user.userId, id, parsed.data);
      return reply.send({
        message: `${parsed.data.action === 'DEPOSIT' ? 'Deposited' : 'Withdrew'} ${parsed.data.amount} successfully`,
        goal: updatedGoal,
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to process vault transaction' });
    }
  });

  // Delete goal
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await VaultService.deleteGoal(request.user.userId, id);
      return reply.send({ message: 'Savings goal deleted successfully' });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to delete goal' });
    }
  });
}
