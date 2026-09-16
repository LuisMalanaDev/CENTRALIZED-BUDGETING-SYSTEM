import { FastifyInstance } from 'fastify';
import { AnalyticsService } from '../services/analytics.service.js';
import { authenticate } from '../plugins/auth.js';

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
}

