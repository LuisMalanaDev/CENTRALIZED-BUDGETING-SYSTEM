import { FastifyInstance } from 'fastify';
import { AnalyticsService } from '../services/analytics.service.js';
import { authenticate } from '../plugins/auth.js';
import { prisma } from '../prisma.js';
import { parseDateBounds } from '../utils/dateHelper.js';

export async function analyticsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // High-level summary metrics
  fastify.get('/summary', async (request, reply) => {
    const query = request.query as any;
    const summary = await AnalyticsService.getSummary(request.user.userId, {
      startDate: query.startDate,
      endDate: query.endDate,
      timezone: query.timezone || query.tz,
    });
    return reply.send(summary);
  });

  // Categorical spending breakdown
  fastify.get('/breakdown', async (request, reply) => {
    const query = request.query as any;
    const breakdown = await AnalyticsService.getCategoryBreakdown(request.user.userId, {
      startDate: query.startDate,
      endDate: query.endDate,
      timezone: query.timezone || query.tz,
    });
    return reply.send(breakdown);
  });

  // Payment method breakdown (GCash vs Card vs Cash, etc.)
  fastify.get('/payment-methods', async (request, reply) => {
    const query = request.query as any;
    const share = await AnalyticsService.getPaymentMethodShare(request.user.userId, {
      startDate: query.startDate,
      endDate: query.endDate,
      timezone: query.timezone || query.tz,
    });
    return reply.send(share);
  });

  // Cashflow over time (income vs expenses)
  fastify.get('/cashflow', async (request, reply) => {
    const query = request.query as any;
    const months = query.months ? parseInt(query.months) : 6;
    const cashflow = await AnalyticsService.getCashflowTrend(request.user.userId, months);
    return reply.send({ cashflow });
  });

  // External Order & Grocery Tracker analytics
  fastify.get('/shopping-tracker', async (request, reply) => {
    const query = request.query as any;
    const trackerData = await AnalyticsService.getLifestyleShoppingTracker(request.user.userId, {
      startDate: query.startDate,
      endDate: query.endDate,
      timezone: query.timezone || query.tz,
    });
    return reply.send(trackerData);
  });

  // AI Financial Advisor & Insights (Coach or Roast mode)
  fastify.get('/insights', async (request, reply) => {
    const query = request.query as any;
    const insights = await AnalyticsService.getAiInsights(request.user.userId, {
      startDate: query.startDate,
      endDate: query.endDate,
      timezone: query.timezone || query.tz,
      mode: query.mode,
    });
    return reply.send(insights);
  });

  // Export Transactions as Downloadable CSV File
  fastify.get('/export-csv', async (request, reply) => {
    const query = request.query as any;
    const { startDate, endDate } = parseDateBounds(query.startDate, query.endDate, query.timezone || query.tz);
    const rawLabel = query.label || 'Statement';
    const cleanLabel = rawLabel.replace(/[^a-zA-Z0-9_-]/g, '_');

    const whereClause: any = { userId: request.user.userId };
    if (startDate || endDate) {
      whereClause.date = {
        ...(startDate && { gte: startDate }),
        ...(endDate && { lte: endDate }),
      };
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      include: { category: true, account: true },
      orderBy: { date: 'desc' },
    });

    const headers = ['Date', 'Type', 'Category', 'Description', 'Amount', 'Payment Method', 'Account', 'Source'];
    const rows = transactions.map((t) => [
      t.date ? t.date.toISOString().split('T')[0] : '',
      t.type,
      `"${(t.category?.name || 'Uncategorized').replace(/"/g, '""')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      Number(t.amount || 0).toFixed(2),
      `"${(t.paymentMethod || 'CASH').replace(/"/g, '""')}"`,
      `"${(t.account?.name || 'Default').replace(/"/g, '""')}"`,
      `"${(t.source || 'MANUAL').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="WealthSync_${cleanLabel}.csv"`)
      .send(csvContent);
  });
}

