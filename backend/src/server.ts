import fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import dotenv from 'dotenv';
import { authRoutes } from './routes/auth.routes.js';
import { accountRoutes } from './routes/account.routes.js';
import { categoryRoutes } from './routes/category.routes.js';
import { transactionRoutes } from './routes/transaction.routes.js';
import { budgetRoutes } from './routes/budget.routes.js';
import { vaultRoutes } from './routes/vault.routes.js';
import { analyticsRoutes } from './routes/analytics.routes.js';
import { webhookRoutes } from './routes/webhook.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { prisma } from './prisma.js';

dotenv.config();

const server = fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

async function main() {
  // CORS configuration
  await server.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return cb(null, true);
      const allowedOrigins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        process.env.FRONTEND_URL,
      ].filter(Boolean);

      if (allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
        return cb(null, true);
      }
      return cb(null, true); // Dev-friendly permissive CORS
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cookie'],
  });

  // Cookie plugin
  await server.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'wealthsync_cookie_secret_salt_at_least_32_characters_long_key_wealth',
    parseOptions: {},
  });

  // JWT plugin
  await server.register(jwt, {
    secret: process.env.JWT_SECRET || 'wealthsync_super_secure_jwt_secret_key_2026_finance',
    cookie: {
      cookieName: 'token',
      signed: false,
    },
  });

  // Health check endpoint
  server.get('/health', async () => {
    return {
      status: 'ok',
      service: 'WealthSync Fastify API',
      timestamp: new Date().toISOString(),
    };
  });

  // Register API Routes
  await server.register(authRoutes, { prefix: '/api/auth' });
  await server.register(accountRoutes, { prefix: '/api/accounts' });
  await server.register(categoryRoutes, { prefix: '/api/categories' });
  await server.register(transactionRoutes, { prefix: '/api/transactions' });
  await server.register(budgetRoutes, { prefix: '/api/budgets' });
  await server.register(vaultRoutes, { prefix: '/api/savings-goals' });
  await server.register(analyticsRoutes, { prefix: '/api/analytics' });
  await server.register(webhookRoutes, { prefix: '/api/webhooks' });
  await server.register(adminRoutes, { prefix: '/api/admin' });

  // Error handler
  server.setErrorHandler((error: any, request, reply) => {
    server.log.error(error);
    reply.status(error.statusCode || 500).send({
      error: error.name || 'Internal Server Error',
      message: error.message || 'An unexpected error occurred',
    });
  });

  const port = parseInt(process.env.PORT || '4000', 10);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await server.listen({ port, host });
    console.log(`🚀 WealthSync Backend API listening on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Graceful cleanup
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
for (const signal of signals) {
  process.on(signal, async () => {
    console.log(`\nReceived ${signal}, closing server and database connection...`);
    await server.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main();
