import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../services/auth.service.js';
import { authenticate } from '../plugins/auth.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  currency: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post('/register', async (request, reply) => {
    const parseResult = registerSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.format() });
    }

    try {
      const user = await AuthService.register(parseResult.data);
      const token = fastify.jwt.sign({ userId: user.id, email: user.email });

      reply.setCookie('token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      return reply.status(201).send({
        user,
        token,
        message: 'Account registered successfully',
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Registration failed' });
    }
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.format() });
    }

    try {
      const user = await AuthService.login(parseResult.data);
      const token = fastify.jwt.sign({ userId: user.id, email: user.email });

      reply.setCookie('token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      return reply.send({
        user,
        token,
        message: 'Login successful',
      });
    } catch (err: any) {
      return reply.status(401).send({ error: err.message || 'Authentication failed' });
    }
  });

  // Logout
  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('token', { path: '/' });
    return reply.send({ message: 'Logged out successfully' });
  });

  // Get Current User Profile
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const user = await AuthService.getMe(request.user.userId);
      return reply.send({ user });
    } catch (err: any) {
      return reply.status(404).send({ error: err.message || 'User not found' });
    }
  });
}
