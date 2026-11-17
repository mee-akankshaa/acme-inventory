import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth'

export default async function searchRoutes(fastify: FastifyInstance) {

  // GET /search?q=...
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const { q } = z.object({ q: z.string().min(2).max(100) }).parse(request.query)
    const pattern = `%${q}%`

    const [productRows, vendorRows, buyerRows] = await Promise.all([
      fastify.prisma.$queryRaw<any[]>`
        SELECT
          p.id, p.name, p.sku, p.unit,
          p.min_stock_level, p.price,
          c.name AS category_name,
          COALESCE(i.quantity_on_hand, 0) AS current_stock,
          COALESCE(SUM(CASE WHEN st.type = 'IN' THEN st.quantity ELSE 0 END), 0)::bigint AS total_in,
          COALESCE(SUM(CASE WHEN st.type = 'OUT' THEN st.quantity ELSE 0 END), 0)::bigint AS total_out
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN inventory i ON i.product_id = p.id
        LEFT JOIN stock_transactions st ON st.product_id = p.id
        WHERE p.active = true
          AND (p.name ILIKE ${pattern} OR p.sku ILIKE ${pattern} OR c.name ILIKE ${pattern})
        GROUP BY p.id, p.name, p.sku, p.unit, p.min_stock_level, p.price, c.name, i.quantity_on_hand
        ORDER BY
          CASE WHEN LOWER(p.name) = LOWER(${q}) THEN 0
               WHEN LOWER(p.sku) = LOWER(${q}) THEN 1
               WHEN p.name ILIKE ${`${q}%`} THEN 2
               ELSE 3 END,
          p.name
        LIMIT 10`,

      fastify.prisma.$queryRaw<any[]>`
        SELECT v.id, v.name, v.city, v.contact_person, v.phone
        FROM vendors v
        WHERE v.active = true
          AND (v.name ILIKE ${pattern} OR v.contact_person ILIKE ${pattern} OR v.city ILIKE ${pattern})
        ORDER BY v.name
        LIMIT 5`,

      fastify.prisma.$queryRaw<any[]>`
        SELECT b.id, b.name, b.city, b.phone,
          MAX(st.transaction_date) AS last_purchase_date
        FROM buyers b
        LEFT JOIN stock_transactions st ON st.buyer_id = b.id AND st.type = 'OUT'
        WHERE b.active = true
          AND (b.name ILIKE ${pattern} OR b.city ILIKE ${pattern} OR b.phone ILIKE ${pattern})
        GROUP BY b.id, b.name, b.city, b.phone
        ORDER BY b.name
        LIMIT 5`,
    ])

    const products = productRows.map((p: any) => {
      const currentStock = Number(p.current_stock)
      const minStockLevel = Number(p.min_stock_level)
      const price = p.price ? Number(p.price) : 0
      return {
        id: p.id, name: p.name, sku: p.sku, unit: p.unit,
        category: p.category_name ?? null,
        currentStock, minStockLevel,
        totalStockIn: Number(p.total_in),
        totalStockOut: Number(p.total_out),
        stockValue: currentStock * price,
        price,
        status: currentStock === 0 ? 'out_of_stock'
          : (currentStock <= minStockLevel && minStockLevel > 0 ? 'low_stock' : 'in_stock'),
      }
    })

    return reply.send({
      products,
      vendors: vendorRows.map((v: any) => ({
        id: v.id, name: v.name,
        city: v.city ?? null,
        contactName: v.contact_person ?? null,
        phone: v.phone ?? null,
      })),
      buyers: buyerRows.map((b: any) => ({
        id: b.id, name: b.name,
        city: b.city ?? null,
        phone: b.phone ?? null,
        lastPurchaseDate: b.last_purchase_date ?? null,
      })),
    })
  })

  // GET /search/product/:id — full product detail with transaction history
  fastify.get('/product/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)

    const [productRows, transactions] = await Promise.all([
      fastify.prisma.$queryRaw<any[]>`
        SELECT
          p.id, p.name, p.sku, p.unit,
          p.min_stock_level, p.price, p.cost_price,
          c.name AS category_name,
          COALESCE(i.quantity_on_hand, 0) AS current_stock,
          COALESCE(SUM(CASE WHEN st.type = 'IN' THEN st.quantity ELSE 0 END), 0)::bigint AS total_in,
          COALESCE(SUM(CASE WHEN st.type = 'OUT' THEN st.quantity ELSE 0 END), 0)::bigint AS total_out
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN inventory i ON i.product_id = p.id
        LEFT JOIN stock_transactions st ON st.product_id = p.id
        WHERE p.id = ${id} AND p.active = true
        GROUP BY p.id, p.name, p.sku, p.unit, p.min_stock_level, p.price, p.cost_price, c.name, i.quantity_on_hand`,

      fastify.prisma.$queryRaw<any[]>`
        SELECT
          st.id, st.type, st.quantity, st.unit_price, st.notes,
          COALESCE(st.transaction_date, st.created_at) AS tx_date,
          v.id AS vendor_id, v.name AS vendor_name,
          b.id AS buyer_id, b.name AS buyer_name,
          u.name AS by_user
        FROM stock_transactions st
        LEFT JOIN vendors v ON v.id = st.vendor_id
        LEFT JOIN buyers b ON b.id = st.buyer_id
        LEFT JOIN users u ON u.id = st.created_by
        WHERE st.product_id = ${id}
        ORDER BY COALESCE(st.transaction_date, st.created_at) DESC
        LIMIT 50`,
    ])

    if (!productRows.length) return reply.status(404).send({ error: 'Product not found' })

    const p = productRows[0]
    const currentStock = Number(p.current_stock)
    const minStockLevel = Number(p.min_stock_level)
    const price = p.price ? Number(p.price) : 0

    return reply.send({
      product: {
        id: p.id, name: p.name, sku: p.sku, unit: p.unit,
        category: p.category_name ?? null,
        minStockLevel, price, currentStock,
        totalStockIn: Number(p.total_in),
        totalStockOut: Number(p.total_out),
        stockValue: currentStock * price,
        status: currentStock === 0 ? 'out_of_stock'
          : (currentStock <= minStockLevel && minStockLevel > 0 ? 'low_stock' : 'in_stock'),
      },
      transactions: transactions.map((t: any) => ({
        id: t.id, type: t.type, quantity: Number(t.quantity),
        unitPrice: t.unit_price ? Number(t.unit_price) : null,
        date: t.tx_date,
        vendor: t.vendor_id ? { id: t.vendor_id, name: t.vendor_name } : null,
        buyer: t.buyer_id ? { id: t.buyer_id, name: t.buyer_name } : null,
        notes: t.notes ?? null,
        by: t.by_user ?? null,
      })),
    })
  })
}
