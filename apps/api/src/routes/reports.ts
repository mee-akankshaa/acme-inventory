import { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { authenticate } from '../middleware/auth'
import { dateRangeSchema, topProductsSchema, transactionExportSchema } from '../schemas/report'

export default async function reportsRoutes(fastify: FastifyInstance) {

  // GET /reports/stock-summary
  fastify.get('/stock-summary', { preHandler: [authenticate] }, async (_request, reply) => {
    const rows = await fastify.prisma.$queryRaw<any[]>`
      SELECT
        COUNT(DISTINCT p.id)::bigint AS total_products,
        SUM(i.quantity_on_hand * COALESCE(p.cost_price, 0)) AS total_inventory_value,
        COUNT(DISTINCT CASE WHEN i.quantity_on_hand > 0 AND i.quantity_on_hand <= p.min_stock_level THEN p.id END)::bigint AS low_stock_count,
        COUNT(DISTINCT CASE WHEN i.quantity_on_hand = 0 THEN p.id END)::bigint AS out_of_stock_count
      FROM products p
      JOIN inventory i ON i.product_id = p.id
      WHERE p.active = true
    `
    const row = rows[0] as any
    return reply.send({
      totalProducts: Number(row.total_products),
      totalInventoryValue: parseFloat(row.total_inventory_value?.toString() ?? '0'),
      lowStockCount: Number(row.low_stock_count),
      outOfStockCount: Number(row.out_of_stock_count),
    })
  })

  // GET /reports/stock-movement
  fastify.get('/stock-movement', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = dateRangeSchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() })

    const { dateFrom, dateTo, productId } = parsed.data

    const now = new Date()
    const defaultFrom = new Date(now)
    defaultFrom.setDate(defaultFrom.getDate() - 30)

    let from: Date
    let to: Date

    if (dateFrom) {
      from = new Date(dateFrom)
      if (isNaN(from.getTime())) return reply.status(400).send({ error: 'Invalid dateFrom' })
    } else {
      from = defaultFrom
    }

    if (dateTo) {
      to = new Date(dateTo)
      if (isNaN(to.getTime())) return reply.status(400).send({ error: 'Invalid dateTo' })
    } else {
      to = now
    }

    const productFilter = productId ? Prisma.sql`AND st.product_id = ${productId}` : Prisma.sql``

    const rows = await fastify.prisma.$queryRaw<any[]>`
      SELECT
        DATE_TRUNC('day', st.created_at) AS date,
        SUM(CASE WHEN st.type = 'IN' THEN st.quantity ELSE 0 END)::bigint AS "totalIn",
        SUM(CASE WHEN st.type = 'OUT' THEN st.quantity ELSE 0 END)::bigint AS "totalOut",
        SUM(CASE WHEN st.type = 'IN' THEN st.quantity WHEN st.type = 'OUT' THEN -st.quantity ELSE 0 END)::bigint AS "netChange"
      FROM stock_transactions st
      WHERE st.created_at >= ${from} AND st.created_at <= ${to}
      ${productFilter}
      GROUP BY DATE_TRUNC('day', st.created_at)
      ORDER BY date ASC
    `

    const movement = rows.map(r => ({
      date: new Date(r.date).toISOString().split('T')[0],
      totalIn: Number(r.totalIn),
      totalOut: Number(r.totalOut),
      netChange: Number(r.netChange),
    }))

    return reply.send({ movement })
  })

  // GET /reports/top-products
  fastify.get('/top-products', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = topProductsSchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() })

    const { limit, type, dateFrom, dateTo } = parsed.data

    if (type === 'most-stocked') {
      const rows = await fastify.prisma.$queryRaw<any[]>`
        SELECT p.id, p.name, p.sku, p.unit, i.quantity_on_hand AS value
        FROM products p
        JOIN inventory i ON i.product_id = p.id
        WHERE p.active = true
        ORDER BY i.quantity_on_hand DESC
        LIMIT ${limit}
      `
      const products = rows.map(r => ({
        id: r.id,
        name: r.name,
        sku: r.sku,
        unit: r.unit,
        value: Number(r.value),
        totalQuantity: Number(r.value),
      }))
      return reply.send({ type, products })
    } else {
      const now = new Date()
      const defaultFrom = new Date(now)
      defaultFrom.setDate(defaultFrom.getDate() - 30)

      let from: Date
      let to: Date

      if (dateFrom) {
        from = new Date(dateFrom)
        if (isNaN(from.getTime())) return reply.status(400).send({ error: 'Invalid dateFrom' })
      } else {
        from = defaultFrom
      }

      if (dateTo) {
        to = new Date(dateTo)
        if (isNaN(to.getTime())) return reply.status(400).send({ error: 'Invalid dateTo' })
      } else {
        to = now
      }

      const rows = await fastify.prisma.$queryRaw<any[]>`
        SELECT p.id, p.name, p.sku, p.unit,
          COUNT(st.id)::bigint AS value,
          COALESCE(SUM(st.quantity), 0)::bigint AS total_quantity
        FROM products p
        LEFT JOIN stock_transactions st ON st.product_id = p.id
          AND st.created_at >= ${from} AND st.created_at <= ${to}
        WHERE p.active = true
        GROUP BY p.id, p.name, p.sku, p.unit
        ORDER BY value DESC
        LIMIT ${limit}
      `
      const products = rows.map(r => ({
        id: r.id,
        name: r.name,
        sku: r.sku,
        unit: r.unit,
        value: Number(r.value),
        totalQuantity: Number(r.total_quantity),
      }))
      return reply.send({ type, products })
    }
  })

  // GET /reports/vendor-summary (accepts optional dateFrom/dateTo)
  fastify.get('/vendor-summary', { preHandler: [authenticate] }, async (request, reply) => {
    const q = request.query as any
    const from = q.dateFrom ? new Date(q.dateFrom) : null
    const to = q.dateTo ? (() => { const d = new Date(q.dateTo); d.setHours(23,59,59,999); return d })() : null

    const dateFilter = from && to
      ? Prisma.sql`AND st.transaction_date >= ${from} AND st.transaction_date <= ${to}`
      : from ? Prisma.sql`AND st.transaction_date >= ${from}`
      : to ? Prisma.sql`AND st.transaction_date <= ${to}`
      : Prisma.sql``

    const rows = await fastify.prisma.$queryRaw<any[]>`
      SELECT
        v.id, v.name, v.city, v.contact_person AS "contactName",
        COUNT(DISTINCT p.id)::bigint AS "totalProducts",
        COUNT(CASE WHEN st.type = 'IN' THEN st.id END)::bigint AS "totalOrders",
        COALESCE(SUM(CASE WHEN st.type = 'IN' THEN st.quantity ELSE 0 END), 0)::bigint AS "totalUnits",
        COALESCE(SUM(CASE WHEN st.type = 'IN' THEN st.quantity * COALESCE(st.unit_price, 0) ELSE 0 END), 0) AS "totalValue",
        MAX(CASE WHEN st.type = 'IN' THEN st.transaction_date END) AS "lastPurchaseDate"
      FROM vendors v
      LEFT JOIN products p ON p.vendor_id = v.id AND p.active = true
      LEFT JOIN stock_transactions st ON st.vendor_id = v.id ${dateFilter}
      WHERE v.active = true
      GROUP BY v.id, v.name, v.city, v.contact_person
      ORDER BY "totalValue" DESC, v.name ASC
    `

    const vendors = rows.map(r => ({
      id: r.id, name: r.name, city: r.city ?? null, contactName: r.contactName ?? null,
      totalProducts: Number(r.totalProducts), totalOrders: Number(r.totalOrders),
      totalUnits: Number(r.totalUnits),
      totalValue: parseFloat(r.totalValue?.toString() ?? '0'),
      // keep legacy field name for existing page code
      totalValueReceived: parseFloat(r.totalValue?.toString() ?? '0'),
      lastTransactionDate: r.lastPurchaseDate ? new Date(r.lastPurchaseDate).toISOString() : null,
      lastPurchaseDate: r.lastPurchaseDate ? new Date(r.lastPurchaseDate).toISOString() : null,
    }))

    return reply.send({ vendors })
  })

  // GET /reports/buyer-report
  fastify.get('/buyer-report', { preHandler: [authenticate] }, async (request, reply) => {
    const q = request.query as any
    const from = q.dateFrom ? new Date(q.dateFrom) : null
    const to = q.dateTo ? (() => { const d = new Date(q.dateTo); d.setHours(23,59,59,999); return d })() : null

    const dateFilter = from && to
      ? Prisma.sql`AND st.transaction_date >= ${from} AND st.transaction_date <= ${to}`
      : from ? Prisma.sql`AND st.transaction_date >= ${from}`
      : to ? Prisma.sql`AND st.transaction_date <= ${to}`
      : Prisma.sql``

    const rows = await fastify.prisma.$queryRaw<any[]>`
      SELECT
        b.id, b.name, b.city,
        COUNT(CASE WHEN st.type = 'OUT' THEN st.id END)::bigint AS "totalOrders",
        COALESCE(SUM(CASE WHEN st.type = 'OUT' THEN st.quantity ELSE 0 END), 0)::bigint AS "totalUnits",
        COALESCE(SUM(CASE WHEN st.type = 'OUT' THEN st.quantity * COALESCE(st.unit_price, 0) ELSE 0 END), 0) AS "totalValue",
        MAX(CASE WHEN st.type = 'OUT' THEN st.transaction_date END) AS "lastSaleDate"
      FROM buyers b
      LEFT JOIN stock_transactions st ON st.buyer_id = b.id ${dateFilter}
      WHERE b.active = true
      GROUP BY b.id, b.name, b.city
      ORDER BY "totalValue" DESC, v.name ASC
    `

    const buyers = rows.map(r => ({
      id: r.id, name: r.name, city: r.city ?? null,
      totalOrders: Number(r.totalOrders), totalUnits: Number(r.totalUnits),
      totalValue: parseFloat(r.totalValue?.toString() ?? '0'),
      lastSaleDate: r.lastSaleDate ? new Date(r.lastSaleDate).toISOString() : null,
    }))

    return reply.send({ buyers })
  })

  // GET /reports/product-report
  fastify.get('/product-report', { preHandler: [authenticate] }, async (request, reply) => {
    const q = request.query as any
    const categoryId = q.categoryId ?? null
    const from = q.dateFrom ? new Date(q.dateFrom) : null
    const to = q.dateTo ? (() => { const d = new Date(q.dateTo); d.setHours(23,59,59,999); return d })() : null

    const catFilter = categoryId ? Prisma.sql`AND p.category_id = ${categoryId}` : Prisma.sql``
    const dateFilter = from && to
      ? Prisma.sql`AND st.transaction_date >= ${from} AND st.transaction_date <= ${to}`
      : from ? Prisma.sql`AND st.transaction_date >= ${from}`
      : to ? Prisma.sql`AND st.transaction_date <= ${to}`
      : Prisma.sql``

    const rows = await fastify.prisma.$queryRaw<any[]>`
      SELECT
        p.id, p.name, p.sku, p.min_stock_level AS "minStockLevel",
        c.name AS category,
        COALESCE(i.quantity_on_hand, 0) AS "currentStock",
        COALESCE(i.quantity_on_hand * COALESCE(p.cost_price, 0), 0) AS "stockValue",
        COALESCE(SUM(CASE WHEN st.type = 'IN' THEN st.quantity ELSE 0 END), 0)::bigint AS "totalIn",
        COALESCE(SUM(CASE WHEN st.type = 'OUT' THEN st.quantity ELSE 0 END), 0)::bigint AS "totalOut"
      FROM products p
      LEFT JOIN inventory i ON i.product_id = p.id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN stock_transactions st ON st.product_id = p.id ${dateFilter}
      WHERE p.active = true ${catFilter}
      GROUP BY p.id, p.name, p.sku, p.min_stock_level, c.name, i.quantity_on_hand, p.cost_price
      ORDER BY p.name ASC
    `

    const products = rows.map(r => ({
      id: r.id, name: r.name, sku: r.sku, category: r.category ?? null,
      minStockLevel: Number(r.minStockLevel), currentStock: Number(r.currentStock),
      stockValue: parseFloat(r.stockValue?.toString() ?? '0'),
      totalIn: Number(r.totalIn), totalOut: Number(r.totalOut),
    }))

    return reply.send({ products })
  })

  // GET /reports/low-stock-report
  fastify.get('/low-stock-report', { preHandler: [authenticate] }, async (_request, reply) => {
    const rows = await fastify.prisma.$queryRaw<any[]>`
      SELECT
        p.id,
        p.name,
        p.sku,
        p.unit,
        p.min_stock_level AS "minStockLevel",
        i.quantity_on_hand AS "quantityOnHand",
        v.name AS "vendorName"
      FROM products p
      JOIN inventory i ON i.product_id = p.id
      LEFT JOIN vendors v ON v.id = p.vendor_id AND v.active = true
      WHERE p.active = true AND i.quantity_on_hand <= p.min_stock_level
      ORDER BY i.quantity_on_hand ASC
    `

    const products = rows.map(r => ({
      id: r.id,
      name: r.name,
      sku: r.sku,
      unit: r.unit,
      minStockLevel: Number(r.minStockLevel),
      quantityOnHand: Number(r.quantityOnHand),
      vendorName: r.vendorName ?? null,
    }))

    return reply.send({ products, total: products.length })
  })

  // GET /reports/transaction-export
  fastify.get('/transaction-export', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = transactionExportSchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() })

    const { dateFrom, dateTo, page, limit } = parsed.data
    const skip = (page - 1) * limit

    const where: Prisma.StockTransactionWhereInput = {}
    if (dateFrom) where.createdAt = { ...where.createdAt as any, gte: new Date(dateFrom) }
    if (dateTo) where.createdAt = { ...where.createdAt as any, lte: new Date(dateTo) }

    const [transactions, total] = await fastify.prisma.$transaction([
      fastify.prisma.stockTransaction.findMany({
        where,
        skip,
        take: limit,
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          vendor: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      fastify.prisma.stockTransaction.count({ where }),
    ])

    return reply.send({ transactions, total, page, limit, pages: Math.ceil(total / limit) })
  })
}
