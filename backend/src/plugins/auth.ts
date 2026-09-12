import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../types/index.js';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    // 1. Try to read from cookie
    const cookieToken = request.cookies?.token;

    // 2. Try to read from Authorization header
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const token = cookieToken || bearerToken;

    if (!token) {
      return reply.status(401).send({ error: 'Unauthorized: Missing authentication token' });
    }

    const decoded = request.server.jwt.verify<JwtPayload>(token);
    request.user = decoded;
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized: Invalid or expired token' });
  }
}
