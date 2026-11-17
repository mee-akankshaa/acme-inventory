import { FastifyRequest, FastifyReply } from 'fastify'
import { verifyAccessToken, AccessTokenPayload } from '../utils/jwt'

declare module 'fastify' {
  interface FastifyRequest {
    user: AccessTokenPayload
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing authorization header' })
  }

  try {
    request.user = verifyAccessToken(auth.slice(7))
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired token' })
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (request.user?.role !== 'admin') {
    return reply.status(403).send({ error: 'Admin access required' })
  }
}
