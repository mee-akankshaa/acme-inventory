import { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt'
import { authenticate } from '../middleware/auth'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/login
  fastify.post('/login', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const result = loginSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid input', details: result.error.flatten() })
    }
    const { email, password } = result.data

    const user = await fastify.prisma.user.findUnique({ where: { email } })

    // Constant-time check to prevent user enumeration
    if (!user || !user.active) {
      await bcrypt.compare(password, '$2b$12$invalidhashfortimingnormalization')
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const saved = await fastify.prisma.refreshToken.create({
      data: { userId: user.id, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
    })

    return reply.send({
      accessToken: signAccessToken({ userId: user.id, role: user.role }),
      refreshToken: signRefreshToken({ userId: user.id, tokenId: saved.id }),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  })

  // POST /auth/refresh
  fastify.post('/refresh', async (request, reply) => {
    const result = refreshSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'refreshToken required' })
    }

    let payload
    try {
      payload = verifyRefreshToken(result.data.refreshToken)
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token' })
    }

    const saved = await fastify.prisma.refreshToken.findUnique({
      where: { id: payload.tokenId },
      include: { user: { select: { id: true, role: true, active: true } } },
    })

    if (!saved || saved.expiresAt < new Date() || !saved.user.active) {
      return reply.status(401).send({ error: 'Refresh token expired or revoked' })
    }

    // Rotate: delete old, issue new
    await fastify.prisma.refreshToken.delete({ where: { id: saved.id } })
    const newSaved = await fastify.prisma.refreshToken.create({
      data: { userId: saved.userId, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
    })

    return reply.send({
      accessToken: signAccessToken({ userId: saved.userId, role: saved.user.role }),
      refreshToken: signRefreshToken({ userId: saved.userId, tokenId: newSaved.id }),
    })
  })

  // POST /auth/logout
  fastify.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
    const result = refreshSchema.safeParse(request.body)
    if (result.success) {
      try {
        const payload = verifyRefreshToken(result.data.refreshToken)
        await fastify.prisma.refreshToken.delete({ where: { id: payload.tokenId } }).catch(() => {})
      } catch {}
    }
    return reply.send({ success: true })
  })

  // GET /auth/me
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })
    return reply.send({ user })
  })
}
