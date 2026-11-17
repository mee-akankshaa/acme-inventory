import { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { authenticate, requireAdmin } from '../middleware/auth'
import { stockInSchema, stockOutSchema, stockAdjustmentSchema, stockTransactionQuerySchema } from '../schemas/stock'
import { alertQueue } from '../queues/alertQueue'

export default async function stockRoutes(fastify: FastifyInstance) {

  // POST /stock/in
  fastify.post('/in', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = stockInSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() })

    const { productId, vendorId, quantity, unitPrice, serialNo, transactionDate, notes, idempotencyKey } = parsed.data
    const userId = request.user.userId

    // Redis idempotency check
    const redisKey = `idempotency:stock:${idempotencyKey}`
    try {
      const cached = await fastify.redis.get(redisKey)
      if (cached) return reply.send(JSON.parse(cached))
    } catch {}

    // Verify product exists
    const product = await fastify.prisma.product.findUnique({ where: { id: productId, active: true } })
    if (!product) return reply.status(404).send({ error: 'Product not found' })

    // Atomic stock-in with SELECT FOR UPDATE
    const result = await fastify.prisma.$transaction(async (tx) => {
      // Lock the inventory row
      const rows = await tx.$queryRaw<{ id: string; quantity_on_hand: number }[]>`
        SELECT id, quantity_on_hand FROM inventory WHERE product_id = ${productId} FOR UPDATE
      `
      if (rows.length === 0) throw new Error('Inventory record not found')
      const inv = rows[0]

      const newQty = inv.quantity_on_hand + quantity

      await tx.$executeRaw`
        UPDATE inventory SET quantity_on_hand = ${newQty}, updated_at = NOW() WHERE id = ${inv.id}
      `

      const transaction = await tx.stockTransaction.create({
        data: {
          type: 'IN',
          productId,
          vendorId: vendorId ?? null,
          quantity,
          unitPrice: unitPrice ? new Prisma.Decimal(unitPrice) : null,
          serialNo: serialNo ?? null,
          transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
          notes: notes ?? null,
          idempotencyKey,
          createdBy: userId,
        },
        include: { product: { select: { id: true, name: true, sku: true } } },
      })

      return { transaction, quantityOnHand: newQty }
    })

    const responseBody = { success: true, ...result }
    try { await fastify.redis.set(redisKey, JSON.stringify(responseBody), 'EX', 86400) } catch {}

    try {
      await alertQueue.add('alert:check', {
        productId,
        quantityOnHand: result.quantityOnHand,
        transactionType: 'IN',
      })
    } catch {}

    return reply.status(201).send(responseBody)
  })

  // POST /stock/out
  fastify.post('/out', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = stockOutSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() })

    const { productId, quantity, buyerName, buyerId, serialNo, issuedTo, transactionDate, notes, idempotencyKey } = parsed.data
    const userId = request.user.userId

    // Redis idempotency check
    const redisKey = `idempotency:stock:${idempotencyKey}`
    try {
      const cached = await fastify.redis.get(redisKey)
      if (cached) return reply.send(JSON.parse(cached))
    } catch {}

    const product = await fastify.prisma.product.findUnique({ where: { id: productId, active: true } })
    if (!product) return reply.status(404).send({ error: 'Product not found' })

    // Atomic stock-out with SELECT FOR UPDATE
    let result: any
    try {
      result = await fastify.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ id: string; quantity_on_hand: number }[]>`
          SELECT id, quantity_on_hand FROM inventory WHERE product_id = ${productId} FOR UPDATE
        `
        if (rows.length === 0) throw new Error('Inventory record not found')
        const inv = rows[0]

        if (inv.quantity_on_hand < quantity) {
          throw Object.assign(new Error('Insufficient stock'), { statusCode: 400, quantityOnHand: inv.quantity_on_hand })
        }

        const newQty = inv.quantity_on_hand - quantity

        await tx.$executeRaw`
          UPDATE inventory SET quantity_on_hand = ${newQty}, updated_at = NOW() WHERE id = ${inv.id}
        `

        const transaction = await tx.stockTransaction.create({
          data: {
            type: 'OUT',
            productId,
            quantity,
            buyerName: buyerName ?? null,
            buyerId: buyerId ?? null,
            serialNo: serialNo ?? null,
            issuedTo: issuedTo ?? null,
            transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
            notes: notes ?? null,
            idempotencyKey,
            createdBy: userId,
          },
          include: { product: { select: { id: true, name: true, sku: true } } },
        })

        return { transaction, quantityOnHand: newQty }
      })
    } catch (err: any) {
      if (err.statusCode === 400) {
        return reply.status(400).send({ error: 'Insufficient stock', quantityOnHand: err.quantityOnHand })
      }
      throw err
    }

    const responseBody = { success: true, ...result }
    try { await fastify.redis.set(redisKey, JSON.stringify(responseBody), 'EX', 86400) } catch {}

    try {
      await alertQueue.add('alert:check', {
        productId,
        quantityOnHand: result.quantityOnHand,
        transactionType: 'OUT',
      })
    } catch {}

    return reply.status(201).send(responseBody)
  })

  // POST /stock/adjustment — admin only
  fastify.post('/adjustment', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const parsed = stockAdjustmentSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() })

    const { productId, newQuantity, reason } = parsed.data
    const userId = request.user.userId

    const product = await fastify.prisma.product.findUnique({ where: { id: productId, active: true } })
    if (!product) return reply.status(404).send({ error: 'Product not found' })

    const result = await fastify.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; quantity_on_hand: number }[]>`
        SELECT id, quantity_on_hand FROM inventory WHERE product_id = ${productId} FOR UPDATE
      `
      if (rows.length === 0) throw new Error('Inventory record not found')
      const inv = rows[0]
      const oldQty = inv.quantity_on_hand
      const delta = newQuantity - oldQty

      await tx.$executeRaw`
        UPDATE inventory SET quantity_on_hand = ${newQuantity}, updated_at = NOW() WHERE id = ${inv.id}
      `

      const transaction = await tx.stockTransaction.create({
        data: {
          type: 'ADJUSTMENT',
          productId,
          quantity: Math.abs(delta),
          notes: reason,
          createdBy: userId,
        },
        include: { product: { select: { id: true, name: true, sku: true } } },
      })

      return { transaction, oldQuantity: oldQty, newQuantity, delta }
    })

    try {
      await alertQueue.add('alert:check', {
        productId,
        quantityOnHand: result.newQuantity,
        transactionType: 'ADJUSTMENT',
      })
    } catch {}

    return reply.status(201).send({ success: true, ...result })
  })

  // GET /stock/transactions
  fastify.get('/transactions', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = stockTransactionQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid query', details: parsed.error.flatten() })

    const { productId, type, dateFrom, dateTo, page, limit } = parsed.data
    const skip = (page - 1) * limit

    const where: Prisma.StockTransactionWhereInput = {}
    if (productId) where.productId = productId
    if (type) where.type = type as any
    if (dateFrom || dateTo) {
      where.transactionDate = {}
      if (dateFrom) where.transactionDate.gte = new Date(dateFrom)
      if (dateTo) {
        const to = new Date(dateTo)
        to.setHours(23, 59, 59, 999)
        where.transactionDate.lte = to
      }
    }

    const [transactions, total] = await fastify.prisma.$transaction([
      fastify.prisma.stockTransaction.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          vendor: { select: { id: true, name: true } },
          buyer: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      fastify.prisma.stockTransaction.count({ where }),
    ])

    return reply.send({ transactions, total, page, limit, pages: Math.ceil(total / limit) })
  })

  // GET /stock/inventory
  fastify.get('/inventory', { preHandler: [authenticate] }, async (request, reply) => {
    const items = await fastify.prisma.inventory.findMany({
      include: {
        product: {
          select: {
            id: true, name: true, sku: true, unit: true,
            minStockLevel: true, active: true,
            category: { select: { id: true, name: true } },
            vendor: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { product: { name: 'asc' } },
    })

    const withLowStock = items.map(item => ({
      ...item,
      isLowStock: item.quantityOnHand < item.product.minStockLevel,
    }))

    const lowStockCount = withLowStock.filter(i => i.isLowStock).length

    return reply.send({ inventory: withLowStock, lowStockCount, total: items.length })
  })
}
