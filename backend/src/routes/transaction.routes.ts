import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TransactionService } from '../services/transaction.service.js';
import { ParserService } from '../services/parser.service.js';
import { authenticate } from '../plugins/auth.js';
import { TransactionType, PaymentMethod } from '@prisma/client';
import { prisma } from '../prisma.js';

const createTransactionSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']).optional(),
  description: z.string().min(1),
  notes: z.string().optional(),
  paymentMethod: z.enum(['GCASH', 'MAYA', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'BANK_TRANSFER', 'OTHER']).optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  receiptUrl: z.string().optional(),
  isShopeeOrder: z.boolean().optional(),
  orderTrackingNumber: z.string().optional(),
  date: z.string().optional(),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  category: z.string().optional(),
});

export async function transactionRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // List transactions with filters
  fastify.get('/', async (request, reply) => {
    const query = request.query as any;
    const filters = {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      type: query.type as TransactionType,
      categoryId: query.categoryId,
      paymentMethod: query.paymentMethod as PaymentMethod,
      startDate: query.startDate,
      endDate: query.endDate,
      search: query.search,
      isShopeeOrder: query.isShopeeOrder !== undefined ? query.isShopeeOrder === 'true' : undefined,
    };

    const result = await TransactionService.listTransactions(request.user.userId, filters);
    return reply.send(result);
  });

  // Create single transaction
  fastify.post('/', async (request, reply) => {
    const parsed = createTransactionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.format() });
    }

    let categoryId = parsed.data.categoryId;
    if (!categoryId && parsed.data.category) {
      const catName = parsed.data.category.trim();
      const slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      try {
        const found = await prisma.category.findFirst({
          where: {
            OR: [
              { name: { equals: catName, mode: 'insensitive' } },
              { slug: { equals: slug, mode: 'insensitive' } },
            ],
          },
        });
        if (found) {
          categoryId = found.id;
        } else {
          const newCat = await prisma.category.create({
            data: {
              name: catName,
              slug,
              userId: request.user.userId,
              type: (parsed.data.type as any) || 'EXPENSE',
            },
          });
          categoryId = newCat.id;
        }
      } catch (err) {
        // Fallback without categoryId if lookup fails
      }
    }

    const transaction = await TransactionService.createTransaction(request.user.userId, {
      ...parsed.data,
      categoryId,
      type: parsed.data.type as TransactionType,
      paymentMethod: parsed.data.paymentMethod as PaymentMethod,
    });

    return reply.status(201).send({ transaction });
  });

  // Ingestion Parser: Parse Shopee orders, GCash statements, or CSV text
  fastify.post('/parse-import', async (request, reply) => {
    const { rawText } = request.body as { rawText: string };
    if (!rawText || typeof rawText !== 'string') {
      return reply.status(400).send({ error: 'Missing or invalid rawText body' });
    }

    const result = ParserService.parseTextOrCsv(rawText);
    return reply.send(result);
  });

  // Bulk save parsed transactions
  fastify.post('/bulk', async (request, reply) => {
    const { items } = request.body as { items: any[] };
    if (!Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({ error: 'Items must be a non-empty array' });
    }

    try {
      const saved = await TransactionService.bulkCreateTransactions(request.user.userId, items);
      return reply.status(201).send({
        message: `Successfully saved ${saved.length} transactions`,
        count: saved.length,
        transactions: saved,
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to save bulk transactions' });
    }
  });

  // Update transaction
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    try {
      const updated = await TransactionService.updateTransaction(request.user.userId, id, body);
      return reply.send({ transaction: updated });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to update transaction' });
    }
  });

  // Delete transaction
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await TransactionService.deleteTransaction(request.user.userId, id);
      return reply.send({ message: 'Transaction deleted successfully' });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to delete transaction' });
    }
  });
}
