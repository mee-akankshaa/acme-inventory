import { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { authenticate, requireAdmin } from '../middleware/auth'
import { createProductSchema, updateProductSchema, productQuerySchema } from '../schemas/product'

export default async function productsRoutes(fastify: FastifyInstance) {
  // GET /api/products — paginated list with optional filters
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = productQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query parameters', details: parsed.error.flatten() })
    }

    const { category, search, inStock, page, limit } = parsed.data
    const skip = (page - 1) * limit

    const where: Prisma.ProductWhereInput = { active: true }

    if (category) {
      where.category = { slug: category }
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (inStock === 'true') {
      where.inventory = { quantityOnHand: { gt: 0 } }
    } else if (inStock === 'false') {
      where.inventory = { quantityOnHand: { equals: 0 } }
    }

    const [products, total] = await fastify.prisma.$transaction([
      fastify.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          inventory: { select: { quantityOnHand: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      fastify.prisma.product.count({ where }),
    ])

    return reply.send({
      products,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    })
  })

  // POST /api/products — create a new product
  fastify.post('/', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const parsed = createProductSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() })
    }

    const { name, sku, description, unit, price, costPrice, categoryId, vendorId, minStockLevel } = parsed.data

    // Check for duplicate SKU
    const existing = await fastify.prisma.product.findUnique({ where: { sku } })
    if (existing) {
      return reply.status(409).send({ error: 'SKU already exists' })
    }

    const product = await fastify.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name,
          sku,
          description,
          unit,
          price: price !== undefined ? new Prisma.Decimal(price) : undefined,
          costPrice: costPrice !== undefined ? new Prisma.Decimal(costPrice) : undefined,
          categoryId,
          vendorId,
          minStockLevel,
          active: true,
        },
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      })

      await tx.inventory.create({
        data: {
          productId: created.id,
          quantityOnHand: 0,
        },
      })

      return created
    })

    return reply.status(201).send({ product })
  })

  // GET /api/products/:id — single product detail
  fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const product = await fastify.prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        inventory: { select: { quantityOnHand: true } },
      },
    })

    if (!product || !product.active) {
      return reply.status(404).send({ error: 'Product not found' })
    }

    return reply.send({ product })
  })

  // PUT /api/products/:id — update product
  fastify.put('/:id', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const parsed = updateProductSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() })
    }

    const data = parsed.data

    // Check product exists and is active
    const existing = await fastify.prisma.product.findUnique({ where: { id } })
    if (!existing || !existing.active) {
      return reply.status(404).send({ error: 'Product not found' })
    }

    // If SKU is being changed, check for conflicts
    if (data.sku && data.sku !== existing.sku) {
      const conflict = await fastify.prisma.product.findUnique({ where: { sku: data.sku } })
      if (conflict) {
        return reply.status(409).send({ error: 'SKU already exists' })
      }
    }

    const product = await fastify.prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        sku: data.sku,
        description: data.description,
        unit: data.unit,
        price: data.price !== undefined ? new Prisma.Decimal(data.price) : undefined,
        costPrice: data.costPrice !== undefined ? new Prisma.Decimal(data.costPrice) : undefined,
        categoryId: data.categoryId,
        vendorId: data.vendorId !== undefined ? (data.vendorId ?? null) : undefined,
        minStockLevel: data.minStockLevel,
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        inventory: { select: { quantityOnHand: true } },
      },
    })

    return reply.send({ product })
  })

  // DELETE /api/products/:id — soft delete (active = false)
  fastify.delete('/:id', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await fastify.prisma.product.findUnique({ where: { id } })
    if (!existing || !existing.active) {
      return reply.status(404).send({ error: 'Product not found' })
    }

    await fastify.prisma.product.update({
      where: { id },
      data: { active: false },
    })

    return reply.send({ success: true })
  })
}
