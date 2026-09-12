import { FastifyInstance } from 'fastify';
import { authenticate } from '../plugins/auth.js';
import { prisma } from '../prisma.js';
import { mockStore, MockTransaction } from '../services/mockStore.js';
import { dbSafe } from '../services/dbHelper.js';

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
            { tags: { hasSome: ['Shopee', 'Lazada', 'Grocery', 'Online Orders', 'Parcel', 'Google Play', 'Roblox', 'Steam'] } },
          ],
        };

        if (query.startDate && query.endDate) {
          whereClause.date = {
            gte: new Date(query.startDate),
            lte: new Date(query.endDate),
          };
        }

        const transactions = await prisma.transaction.findMany({
          where: whereClause,
          orderBy: { date: 'desc' },
        });

        return transactions.map((t) => {
          let platform: 'SHOPEE' | 'LAZADA' | 'TIKTOK' | 'GROCERY' | 'GOOGLE_PLAY' | 'STEAM' | 'ROBLOX' | 'OTHER' = 'OTHER';
          const lower = (t.description + ' ' + (t.tags || []).join(' ')).toLowerCase();
          if (t.isShopeeOrder || lower.includes('shopee')) platform = 'SHOPEE';
          else if (lower.includes('lazada')) platform = 'LAZADA';
          else if (lower.includes('tiktok')) platform = 'TIKTOK';
          else if (lower.includes('grocery') || lower.includes('supermarket')) platform = 'GROCERY';
          else if (lower.includes('google play') || lower.includes('googleplay')) platform = 'GOOGLE_PLAY';
          else if (lower.includes('roblox') || lower.includes('robux')) platform = 'ROBLOX';
          else if (lower.includes('steam')) platform = 'STEAM';

          let status: 'PENDING' | 'TO_SHIP' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED' | 'COMPLETED' = 'IN_TRANSIT';
          if (platform === 'GOOGLE_PLAY' || platform === 'STEAM' || platform === 'ROBLOX') {
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
            status,
            orderDate: t.date.toISOString(),
          };
        });
      },
      async () => {
        const txs = mockStore.transactions.filter(
          (t) =>
            (t.userId === userId || t.userId === 'demo-user-uuid-1') &&
            (t.isShopeeOrder || t.tags?.some((tag) => ['Shopee', 'Lazada', 'Google Play', 'Roblox', 'Steam'].includes(tag)))
        );
        return txs.map((t) => {
          const lower = (t.description + ' ' + (t.tags || []).join(' ')).toLowerCase();
          let platform: any = 'SHOPEE';
          if (lower.includes('google play') || lower.includes('googleplay')) platform = 'GOOGLE_PLAY';
          else if (lower.includes('lazada')) platform = 'LAZADA';
          else if (lower.includes('steam')) platform = 'STEAM';

          return {
            id: t.id,
            platform,
            orderId: t.orderTrackingNumber || undefined,
            trackingNumber: t.orderTrackingNumber || undefined,
            merchant: t.description,
            items: t.description,
            amount: Number(t.amount),
            status: (platform === 'GOOGLE_PLAY' || platform === 'STEAM' ? 'DELIVERED' : 'IN_TRANSIT') as any,
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
}
