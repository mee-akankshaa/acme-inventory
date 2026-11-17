import { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { authenticate, requireAdmin } from '../middleware/auth'
import { createBuyerSchema, updateBuyerSchema, buyerQuerySchema } from '../schemas/buyer'

function getDateRange(dateFilter: string, dateFrom?: string, dateTo?: string) {
  const to = new Date()
  to.setHours(23, 59, 59, 999)
  const from = new Date()

  if (dateFilter === '7d') from.setDate(from.getDate() - 7)
  else if (dateFilter === '1m') from.setMonth(from.getMonth() - 1)
  else if (dateFilter === '3m') from.setMonth(from.getMonth() - 3)
  else if (dateFilter === 'custom') {
    if (dateFrom) { const d = new Date(dateFrom); from.setTime(d.getTime()) }
    if (dateTo) { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); to.setTime(d.getTime()) }
  }
  return { from, to }
}

export default async function buyersRoutes(fastify: FastifyInstance) {

  // GET /api/buyers/cities
  fastify.get('/cities', { preHandler: [authenticate] }, async (_request, reply) => {
    const rows = await fastify.prisma.buyer.findMany({
      where: { active: true, city: { not: null } },
      select: { city: true },
      distinct: ['city'],
      orderBy: { city: 'asc' },
    })
    return reply.send({ cities: rows.map((r) => r.city).filter(Boolean) })
  })

  // GET /api/buyers
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = buyerQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid query', details: parsed.error.flatten() })

    const { search, city, dateFilter, dateFrom, dateTo, page, limit } = parsed.data
    const skip = (page - 1) * limit

    const where: Prisma.BuyerWhereInput = { active: true }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (city) where.city = { equals: city, mode: 'insensitive' }

    if (dateFilter !== 'all') {
      const { from, to } = getDateRange(dateFilter, dateFrom, dateTo)
      where.stockTransactions = {
        some: { type: 'OUT', createdAt: { gte: from, lte: to } },
      }
    }

    const [buyers, total] = await fastify.prisma.$transaction([
      fastify.prisma.buyer.findMany({
        where,
        include: {
          _count: { select: { stockTransactions: true } },
          stockTransactions: {
            where: { type: 'OUT' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true, product: { select: { name: true } } },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      fastify.prisma.buyer.count({ where }),
    ])

    return reply.send({ buyers, total, page, limit, pages: Math.ceil(total / limit) })
  })

  // POST /api/buyers
  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = createBuyerSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() })

    const { name, phone, email, city, address } = parsed.data

    const buyer = await fastify.prisma.buyer.create({
      data: {
        name,
        phone: phone ?? null,
        email: email && email.trim() !== '' ? email : null,
        city: city ?? null,
        address: address ?? null,
        active: true,
      },
    })

    return reply.status(201).send({ buyer })
  })

  // GET /api/buyers/:id
  fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const buyer = await fastify.prisma.buyer.findUnique({
      where: { id },
      include: {
        _count: { select: { stockTransactions: true } },
        stockTransactions: {
          where: { type: 'OUT' },
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { product: { select: { name: true, sku: true } } },
        },
      },
    })
    if (!buyer || !buyer.active) return reply.status(404).send({ error: 'Buyer not found' })
    return reply.send({ buyer })
  })

  // PUT /api/buyers/:id
  fastify.put('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = updateBuyerSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() })

    const existing = await fastify.prisma.buyer.findUnique({ where: { id } })
    if (!existing || !existing.active) return reply.status(404).send({ error: 'Buyer not found' })

    const data = parsed.data
    const buyer = await fastify.prisma.buyer.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone !== undefined ? (data.phone ?? null) : undefined,
        email: data.email !== undefined ? (data.email && data.email.trim() !== '' ? data.email : null) : undefined,
        city: data.city !== undefined ? (data.city ?? null) : undefined,
        address: data.address !== undefined ? (data.address ?? null) : undefined,
      },
    })

    return reply.send({ buyer })
  })

  // GET /api/buyers/:id/transactions
  fastify.get('/:id/transactions', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const q = request.query as { startDate?: string; endDate?: string; productId?: string; page?: string; limit?: string }

    const buyer = await fastify.prisma.buyer.findUnique({ where: { id } })
    if (!buyer || !buyer.active) return reply.status(404).send({ error: 'Buyer not found' })

    const page = Math.max(1, parseInt(q.page ?? '1'))
    const limit = Math.min(50, Math.max(1, parseInt(q.limit ?? '10')))
    const skip = (page - 1) * limit

    const where: Prisma.StockTransactionWhereInput = { buyerId: id, type: 'OUT' }
    if (q.productId) where.productId = q.productId
    if (q.startDate || q.endDate) {
      where.transactionDate = {}
      if (q.startDate) (where.transactionDate as Prisma.DateTimeFilter).gte = new Date(q.startDate)
      if (q.endDate) {
        const end = new Date(q.endDate); end.setHours(23, 59, 59, 999)
        ;(where.transactionDate as Prisma.DateTimeFilter).lte = end
      }
    }

    const [transactions, total, summaryRows, products] = await Promise.all([
      fastify.prisma.stockTransaction.findMany({
        where, skip, take: limit,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { transactionDate: 'desc' },
      }),
      fastify.prisma.stockTransaction.count({ where }),
      fastify.prisma.stockTransaction.findMany({ where, select: { quantity: true, unitPrice: true } }),
      fastify.prisma.stockTransaction.findMany({
        where: { buyerId: id, type: 'OUT' },
        select: { product: { select: { id: true, name: true } } },
        distinct: ['productId'],
      }),
    ])

    const totalUnits = summaryRows.reduce((s, r) => s + r.quantity, 0)
    const totalAmount = summaryRows.reduce((s, r) => s + r.quantity * Number(r.unitPrice ?? 0), 0)

    return reply.send({
      transactions, total, page, limit,
      pages: Math.ceil(total / limit),
      summary: { totalOrders: total, totalUnits, totalAmount },
      products: products.map((p) => p.product).filter(Boolean),
    })
  })

  // DELETE /api/buyers/:id (soft delete)
  fastify.delete('/:id', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await fastify.prisma.buyer.findUnique({ where: { id } })
    if (!existing || !existing.active) return reply.status(404).send({ error: 'Buyer not found' })

    await fastify.prisma.buyer.update({ where: { id }, data: { active: false } })
    return reply.send({ success: true })
  })
}
