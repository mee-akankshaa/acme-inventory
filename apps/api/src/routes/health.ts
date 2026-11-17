import { FastifyInstance } from 'fastify'

const startTime = Date.now()

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    let dbStatus = 'connected'
    let redisStatus = 'connected'

    try {
      await fastify.prisma.$queryRaw`SELECT 1`
    } catch {
      dbStatus = 'disconnected'
    }

    try {
      await fastify.redis.ping()
    } catch {
      redisStatus = 'disconnected'
    }

    const healthy = dbStatus === 'connected' && redisStatus === 'connected'

    return reply.status(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'degraded',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV ?? 'development',
      version: '1.0.0',
      db: dbStatus,
      redis: redisStatus,
    })
  })
}
