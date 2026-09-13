import { FastifyInstance } from 'fastify';
import { EmailParserService, InboundEmailPayload } from '../services/emailParser.service.js';
import { TransactionService } from '../services/transaction.service.js';
import { authenticate } from '../plugins/auth.js';
import { mockStore } from '../services/mockStore.js';
import { prisma } from '../prisma.js';
import { dbSafe } from '../services/dbHelper.js';

export async function webhookRoutes(fastify: FastifyInstance) {
  // Public incoming webhook endpoint (called by Inbound Email providers or forwarding workers)
  fastify.post('/email-receipt', async (request, reply) => {
    const query = request.query as any;
    const body = (request.body as InboundEmailPayload) || {};

    // 1. Identify User from query token/email or recipient address
    let targetUserId = query.token || query.userId || query.email || body.token || (body as any).userId || '';

    if (!targetUserId && body.to) {
      // e.g. orders+user-123@inbound.wealthsync.io or orders+luis@inbound.wealthsync.io
      const match = body.to.match(/orders\+([a-zA-Z0-9_.-]+)@/i);
      if (match) {
        targetUserId = match[1];
      }
    }

    // If targetUserId is an email address, lookup or auto-create the user
    if (targetUserId && targetUserId.includes('@')) {
      const emailLower = targetUserId.toLowerCase();
      let userByEmail = await dbSafe(
        () => prisma.user.findUnique({ where: { email: emailLower } }),
        () => mockStore.users.find((u) => u.email.toLowerCase() === emailLower)
      );

      if (!userByEmail) {
        // Auto-create user profile for new multi-user email
        userByEmail = await dbSafe(
          () =>
            prisma.user.create({
              data: {
                email: emailLower,
                name: emailLower.split('@')[0],
                passwordHash: '$2a$10$abcdefghijklmnopqrstuu',
                currency: 'PHP',
              },
            }),
          () => null
        );
      }

      if (userByEmail) {
        targetUserId = userByEmail.id;
      }
    }

    // Fallback: If still not identified, default to first user
    if (!targetUserId || targetUserId.includes('@')) {
      targetUserId = await dbSafe(
        async () => {
          const u = await prisma.user.findFirst();
          return u ? u.id : 'demo-user-uuid-1';
        },
        () => mockStore.users[0]?.id || 'demo-user-uuid-1'
      );
    }

    try {
      // 2. Parse email content
      const parsed = EmailParserService.parseEmail(body);

      // 3. Look up categories to assign
      const categories = await dbSafe(
        () => prisma.category.findMany({ where: { isSystem: true } }),
        () => mockStore.categories
      );

      const category = categories.find((c) => c.slug === parsed.suggestedCategorySlug) || categories[0];

      // 4. Look up default account (e.g. GCash)
      let accounts = await dbSafe(
        () => prisma.account.findMany({ where: { userId: targetUserId } }),
        () => mockStore.accounts.filter((a) => a.userId === targetUserId || a.userId === 'demo-user-uuid-1')
      );

      let defaultAccount: any = accounts.find((a) => a.name.includes('GCash')) || accounts[0];
      if (!defaultAccount) {
        defaultAccount = await dbSafe(
          () =>
            prisma.account.create({
              data: {
                userId: targetUserId,
                name: 'GCash Wallet',
                type: 'WALLET',
                balance: 0,
                color: '#007DFE',
              },
            }),
          () => null
        );
      }


      // Ignore non-purchase emails (newsletters, login notifications, promotional ads)
      if (!parsed.amount || parsed.amount <= 0) {
        return reply.status(200).send({
          success: false,
          message: 'Ignored non-transactional email (no monetary amount)',
        });
      }

      // 🛡️ Universal Deduplication Shield: Prevent double-counting across Shopee, Google Play, FoodPanda, etc.
      const dedupeConditions: any[] = [];
      if (parsed.orderTrackingNumber) {
        dedupeConditions.push({ orderTrackingNumber: parsed.orderTrackingNumber });
      }
      if (body.subject && parsed.amount > 0) {
        dedupeConditions.push({
          notes: { contains: body.subject },
          amount: parsed.amount,
        });
      }

      if (dedupeConditions.length > 0) {
        const existingTx = await dbSafe(
          () =>
            prisma.transaction.findFirst({
              where: {
                userId: targetUserId,
                OR: dedupeConditions,
              },
            }),
          () =>
            mockStore.transactions.find(
              (t) =>
                t.userId === targetUserId &&
                ((parsed.orderTrackingNumber && t.orderTrackingNumber === parsed.orderTrackingNumber) ||
                  (body.subject && t.notes?.includes(body.subject) && Number(t.amount) === parsed.amount))
            )
        );

        if (existingTx) {
          return reply.status(200).send({
            success: true,
            deduplicated: true,
            message: `Email receipt already recorded (${body.subject || parsed.orderTrackingNumber}). Prevented duplicate expense.`,
            transaction: existingTx,
          });
        }
      }

      // 5. Automatically record transaction into ledger
      const transaction = await TransactionService.createTransaction(targetUserId, {
        amount: parsed.amount,
        type: 'EXPENSE',
        description: parsed.description,
        notes: `Inbound Email Auto-Forward from ${body.from || 'Shopee / GCash'}. Subject: ${body.subject || 'Order Confirmation'}`,
        paymentMethod: parsed.paymentMethod,
        source: parsed.source,
        tags: parsed.tags,
        isShopeeOrder: parsed.isShopeeOrder,
        orderTrackingNumber: parsed.orderTrackingNumber,
        accountId: defaultAccount?.id,
        categoryId: category?.id,
      });

      return reply.status(201).send({
        success: true,
        message: `Successfully ingested ${parsed.isShopeeOrder ? 'Shopee' : 'receipt'} email for ${parsed.description}`,
        transaction,
      });
    } catch (err: any) {
      request.log.error(err);
      return reply.status(400).send({
        success: false,
        error: err.message || 'Failed to parse inbound email',
      });
    }
  });

  // Authenticated: Get User's Email Forwarding & Webhook Configuration
  fastify.get('/config', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const host = request.headers.host || 'localhost:4000';
    const protocol = request.headers['x-forwarded-proto'] || 'http';

    const forwardingAddress = `orders+${userId}@inbound.wealthsync.io`;
    const webhookUrl = `${protocol}://${host}/api/webhooks/email-receipt?token=${userId}`;

    return reply.send({
      forwardingAddress,
      webhookUrl,
      supportedMerchants: [
        { name: 'Shopee Philippines', domain: 'shopee.ph', autoTags: ['Shopee', 'Online Orders'] },
        { name: 'GCash Payment Confirmation', domain: 'gcash.com', autoTags: ['GCash'] },
        { name: 'GrabFood / FoodPanda', domain: 'grab.com', autoTags: ['Food', 'Food Delivery'] },
      ],
      setupGuide: [
        'Open your Gmail or email settings -> Filters and Blocked Addresses.',
        'Create a filter for incoming emails with sender matching `*@shopee.ph` or `*@gcash.com`.',
        `Set action to "Forward to" your dedicated address: ${forwardingAddress}.`,
        'Every time a parcel is confirmed, WealthSync automatically logs the amount, tracking number, and items into your ledger.',
      ],
    });
  });

  // Authenticated: Test / Simulation Runner
  fastify.post('/simulate', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const body = (request.body as InboundEmailPayload) || {};

    try {
      const parsed = EmailParserService.parseEmail(body);

      const transaction = await TransactionService.createTransaction(userId, {
        amount: parsed.amount,
        type: 'EXPENSE',
        description: parsed.description,
        notes: `Simulated Email Forward. Subject: ${body.subject || 'Order Confirmation'}`,
        paymentMethod: parsed.paymentMethod,
        source: parsed.source,
        tags: parsed.tags,
        isShopeeOrder: parsed.isShopeeOrder,
        orderTrackingNumber: parsed.orderTrackingNumber,
      });

      return reply.status(201).send({
        success: true,
        message: 'Simulated email receipt successfully processed and logged!',
        transaction,
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: err.message || 'Simulation failed',
      });
    }
  });
}
