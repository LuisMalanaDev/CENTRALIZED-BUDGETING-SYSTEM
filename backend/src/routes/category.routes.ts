import { FastifyInstance } from 'fastify';
import { prisma } from '../prisma.js';
import { authenticate } from '../plugins/auth.js';
import { mockStore } from '../services/mockStore.js';
import { dbSafe } from '../services/dbHelper.js';

export async function categoryRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request, reply) => {
    const categories = await dbSafe(
      () => prisma.category.findMany({
        where: {
          OR: [
            { userId: request.user.userId },
            { isSystem: true },
          ],
        },
        orderBy: { name: 'asc' },
      }),
      () => mockStore.categories
    );

    return reply.send({ categories });
  });
}
