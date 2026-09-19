import { FastifyInstance } from 'fastify';
import { authenticate } from '../plugins/auth.js';
import { prisma } from '../prisma.js';
import { mockStore, MockTransaction } from '../services/mockStore.js';
import { dbSafe } from '../services/dbHelper.js';
import { parseDateBounds } from '../utils/dateHelper.js';
import { TransactionService } from '../services/transaction.service.js';

export async function trackerRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // List all tracked parcel orders for user
  fastify.get('/', async (request, reply) => {
    const userId = request.user.userId;
    const query = request.query as any;

    const orders = await dbSafe(
      async () => {
        const whereClause: any = {
          userId,
          OR: [
            { isShopeeOrder: true },
            { orderTrackingNumber: { not: null } },
            { source: { contains: 'Email' } },
            { source: { contains: 'Tracker' } },
            { notes: { contains: 'Inbound Email' } },
            {
              tags: {
                hasSome: [
                  'Shopee',
                  'Lazada',
                  'TikTok',
                  'Grocery',
                  'Online Orders',
                  'Parcel',
                  'Google Play',
                  'Roblox',
                  'FoodPanda',
                  'GrabFood',
                  'Food Delivery',
                  'Dining',
                  'Receipt',
                  'Email Auto-Forward',
                ],
              },
            },
          ],
        };

        const { startDate, endDate } = parseDateBounds(query.startDate, query.endDate, query.timezone || query.tz);
        if (startDate || endDate) {
          whereClause.date = {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          };
        }

        const transactions = await prisma.transaction.findMany({
          where: whereClause,
          orderBy: { date: 'desc' },
        });

        return transactions.map((t) => {
          let platform: 'SHOPEE' | 'LAZADA' | 'TIKTOK' | 'GROCERY' | 'GOOGLE_PLAY' | 'ROBLOX' | 'FOODPANDA' | 'OTHER' = 'OTHER';
          const lower = (t.description + ' ' + (t.source || '') + ' ' + (t.tags || []).join(' ')).toLowerCase();
          if (t.isShopeeOrder || lower.includes('shopee')) platform = 'SHOPEE';
          else if (lower.includes('lazada')) platform = 'LAZADA';
          else if (lower.includes('tiktok')) platform = 'TIKTOK';
          else if (lower.includes('foodpanda') || lower.includes('food delivery') || lower.includes('grab')) platform = 'FOODPANDA';
          else if (lower.includes('grocery') || lower.includes('supermarket')) platform = 'GROCERY';
          else if (lower.includes('google play') || lower.includes('googleplay')) platform = 'GOOGLE_PLAY';
          else if (lower.includes('roblox') || lower.includes('robux')) platform = 'ROBLOX';

          let status: 'PENDING' | 'TO_SHIP' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED' | 'COMPLETED' = 'IN_TRANSIT';
          const validStatuses = ['PENDING', 'TO_SHIP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'COMPLETED'];
          const matchedTag = (t.tags || []).find((tag) => validStatuses.includes(tag.toUpperCase()));
          if (matchedTag) {
            status = matchedTag.toUpperCase() as any;
          } else if (platform === 'GOOGLE_PLAY' || platform === 'ROBLOX' || platform === 'FOODPANDA') {
            status = 'DELIVERED';
          }

          return {
            id: t.id,
            platform,
            orderId: t.orderTrackingNumber || undefined,
            trackingNumber: t.orderTrackingNumber || undefined,
            merchant: t.description,
            items: t.description,
            amount: Number(t.amount),
            paymentMethod: t.paymentMethod || undefined,
            notes: t.notes || undefined,
            source: t.source || undefined,
            status,
            orderDate: t.date.toISOString(),
          };
        });
      },
      async () => {
        const txs = mockStore.transactions.filter(
          (t) =>
            (t.userId === userId || t.userId === 'demo-user-uuid-1') &&
            (t.isShopeeOrder ||
              !!t.orderTrackingNumber ||
              t.source?.includes('Email') ||
              t.source?.includes('Tracker') ||
              t.notes?.includes('Inbound Email') ||
              t.tags?.some((tag) =>
                [
                  'Shopee',
                  'Lazada',
                  'TikTok',
                  'Grocery',
                  'Online Orders',
                  'Parcel',
                  'Google Play',
                  'Roblox',
                  'FoodPanda',
                  'GrabFood',
                  'Food Delivery',
                  'Dining',
                  'Receipt',
                  'Email Auto-Forward',
                ].includes(tag)
              ))
        );
        return txs.map((t) => {
          const lower = (t.description + ' ' + (t.source || '') + ' ' + (t.tags || []).join(' ')).toLowerCase();
          let platform: any = 'OTHER';
          if (t.isShopeeOrder || lower.includes('shopee')) platform = 'SHOPEE';
          else if (lower.includes('lazada')) platform = 'LAZADA';
          else if (lower.includes('tiktok')) platform = 'TIKTOK';
          else if (lower.includes('foodpanda') || lower.includes('food delivery') || lower.includes('grab')) platform = 'FOODPANDA';
          else if (lower.includes('grocery') || lower.includes('supermarket')) platform = 'GROCERY';
          else if (lower.includes('google play') || lower.includes('googleplay')) platform = 'GOOGLE_PLAY';
          else if (lower.includes('roblox') || lower.includes('robux')) platform = 'ROBLOX';

          let status: any = 'IN_TRANSIT';
          const validStatuses = ['PENDING', 'TO_SHIP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'COMPLETED'];
          const matchedTag = (t.tags || []).find((tag) => validStatuses.includes(tag.toUpperCase()));
          if (matchedTag) {
            status = matchedTag.toUpperCase();
          } else if (platform === 'GOOGLE_PLAY' || platform === 'ROBLOX' || platform === 'FOODPANDA') {
            status = 'DELIVERED';
          }

          return {
            id: t.id,
            platform,
            orderId: t.orderTrackingNumber || undefined,
            trackingNumber: t.orderTrackingNumber || undefined,
            merchant: t.description,
            items: t.description,
            amount: Number(t.amount),
            paymentMethod: t.paymentMethod || undefined,
            notes: t.notes || undefined,
            source: t.source || undefined,
            status,
            orderDate: (t.date instanceof Date ? t.date : new Date(t.date)).toISOString(),
          };
        });
      }
    );

    return reply.send({ orders });
  });

  // Create tracked parcel order manually
  fastify.post('/', async (request, reply) => {
    const userId = request.user.userId;
    const body = request.body as any;

    const isShopee = body.platform === 'SHOPEE';
    const tagList = [body.platform || 'Online Orders', 'Parcel'];
    if (isShopee) tagList.push('Shopee');

    const transaction = await dbSafe(
      async () => {
        const t = await prisma.transaction.create({
          data: {
            userId,
            amount: body.amount || 0,
            type: 'EXPENSE',
            description: body.items || body.merchant || `${body.platform} Order`,
            paymentMethod: 'CASH',
            source: `${body.platform} Tracker`,
            tags: tagList,
            isShopeeOrder: isShopee,
            orderTrackingNumber: body.trackingNumber || undefined,
            date: body.orderDate ? new Date(body.orderDate) : new Date(),
          },
        });
        return t;
      },
      async () => {
        const mockT: MockTransaction = {
          id: `tx-tracker-${Date.now()}`,
          userId,
          amount: body.amount || 0,
          type: 'EXPENSE',
          description: body.items || body.merchant || `${body.platform} Order`,
          paymentMethod: 'CASH',
          source: `${body.platform} Tracker`,
          tags: tagList,
          isShopeeOrder: isShopee,
          orderTrackingNumber: body.trackingNumber,
          date: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockStore.transactions.push(mockT);
        return mockT as any;
      }
    );

    return reply.status(201).send({ success: true, transaction });
  });

  // Update tracked parcel order
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    try {
      const updateData: any = {};
      if (body.amount !== undefined) updateData.amount = Number(body.amount);
      if (body.items !== undefined || body.merchant !== undefined) {
        updateData.description = (body.items || body.merchant).trim();
      }
      if (body.notes !== undefined) updateData.notes = body.notes;
      if (body.paymentMethod !== undefined) {
        const pm = String(body.paymentMethod).toUpperCase().replace(/\s+/g, '_');
        if (['GCASH', 'MAYA', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'BANK_TRANSFER'].includes(pm)) {
          updateData.paymentMethod = pm;
        } else if (pm === 'COD') {
          updateData.paymentMethod = 'CASH';
        } else {
          updateData.paymentMethod = 'OTHER';
        }
      }
      if (body.trackingNumber !== undefined || body.orderId !== undefined) {
        updateData.orderTrackingNumber = body.trackingNumber || body.orderId;
      }
      if (body.status !== undefined) {
        const validStatuses = ['PENDING', 'TO_SHIP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'COMPLETED'];
        const existing = await prisma.transaction.findFirst({ where: { id, userId: request.user.userId } }).catch(() => null);
        if (existing) {
          const oldTags = (existing.tags || []).filter(
            (t) => !validStatuses.includes(t.toUpperCase())
          );
          updateData.tags = [...oldTags, body.status.toUpperCase()];
        }
      }

      const updated = await TransactionService.updateTransaction(request.user.userId, id, updateData);
      return reply.send({ success: true, transaction: updated });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to update order' });
    }
  });

  // Delete tracked parcel order
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await TransactionService.deleteTransaction(request.user.userId, id);
      return reply.send({ success: true, message: 'Order deleted successfully' });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to delete order' });
    }
  });
}
