import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AccountService } from '../services/account.service.js';
import { authenticate } from '../plugins/auth.js';
import { AccountType } from '@prisma/client';

const createAccountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['CHECKING', 'SAVINGS', 'WALLET', 'CREDIT_CARD', 'CASH']),
  balance: z.number().optional(),
  currency: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export async function accountRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // List accounts
  fastify.get('/', async (request, reply) => {
    const accounts = await AccountService.listAccounts(request.user.userId);
    return reply.send({ accounts });
  });

  // Create account
  fastify.post('/', async (request, reply) => {
    const parsed = createAccountSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.format() });
    }

    const account = await AccountService.createAccount(request.user.userId, {
      name: parsed.data.name,
      type: parsed.data.type as AccountType,
      balance: parsed.data.balance,
      currency: parsed.data.currency,
      color: parsed.data.color,
      icon: parsed.data.icon,
    });

    return reply.status(201).send({ account });
  });

  // Update account
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    try {
      const updated = await AccountService.updateAccount(request.user.userId, id, body);
      return reply.send({ account: updated });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to update account' });
    }
  });

  // Delete account
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await AccountService.deleteAccount(request.user.userId, id);
      return reply.send({ message: 'Account deleted successfully' });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to delete account' });
    }
  });
}
