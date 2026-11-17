import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'

export default async function categoriesRoutes(fastify: FastifyInstance) {
  // GET /api/categories — returns root categories with 2 levels of children
  fastify.get('/', { preHandler: [authenticate] }, async (_request, reply) => {
    const categories = await fastify.prisma.category.findMany({
      where: {
        parentId: null,
        isActive: true,
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        children: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            children: {
              where: { isActive: true },
              orderBy: { name: 'asc' },
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    })

    return reply.send({ categories })
  })
}
