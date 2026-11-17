import { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { authenticate } from '../middleware/auth'
import { alertQuerySchema, alertConfigSchema } from '../schemas/alert'

export default async function alertsRoutes(fastify: FastifyInstance) {

  // GET /alerts — paginated list
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = alertQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid query' })

    const { isRead, type, page, limit } = parsed.data
    const skip = (page - 1) * limit

    const where: Prisma.AlertWhereInput = {}
    if (isRead !== undefined) where.isRead = isRead === 'true'
    if (type) where.type = type as any

    const [alerts, total] = await fastify.prisma.$transaction([
      fastify.prisma.alert.findMany({
        where,
        include: { product: { select: { id: true, name: true, sku: true } } },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
      }),
      fastify.prisma.alert.count({ where }),
    ])

    return reply.send({ alerts, total, page, limit, pages: Math.ceil(total / limit) })
  })

  // GET /alerts/unread-count
  fastify.get('/unread-count', { preHandler: [authenticate] }, async (request, reply) => {
    const count = await fastify.prisma.alert.count({ where: { isRead: false } })
    return reply.send({ count })
  })

  // PUT /alerts/read-all
  fastify.put('/read-all', { preHandler: [authenticate] }, async (request, reply) => {
    const result = await fastify.prisma.alert.updateMany({
      where: { isRead: false }, data: { isRead: true },
    })
    return reply.send({ updated: result.count })
  })

  // GET /alerts/config
  fastify.get('/config', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.userId
    const config = await fastify.prisma.alertConfig.upsert({
      where: { userId },
      create: { userId },
      update: {},
    })
    return reply.send({ config })
  })

  // PUT /alerts/config
  fastify.put('/config', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = alertConfigSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() })

    const userId = request.user.userId
    const config = await fastify.prisma.alertConfig.upsert({
      where: { userId },
      create: { userId, ...parsed.data },
      update: parsed.data,
    })
    return reply.send({ config })
  })

  // PUT /alerts/:id/read
  fastify.put('/:id/read', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const alert = await fastify.prisma.alert.findUnique({ where: { id } })
    if (!alert) return reply.status(404).send({ error: 'Alert not found' })

    const updated = await fastify.prisma.alert.update({
      where: { id }, data: { isRead: true },
    })
    return reply.send({ alert: updated })
  })
}
