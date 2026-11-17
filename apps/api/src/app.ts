import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import prismaPlugin from './plugins/prisma'
import redisPlugin from './plugins/redis'
import healthRoutes from './routes/health'
import authRoutes from './routes/auth'
import categoriesRoutes from './routes/categories'
import productsRoutes from './routes/products'
import vendorsRoutes from './routes/vendors'
import stockRoutes from './routes/stock'
import alertsRoutes from './routes/alerts'
import reportsRoutes from './routes/reports'
import buyersRoutes from './routes/buyers'
import exportRoutes from './routes/export'
import importRoutes from './routes/import'
import searchRoutes from './routes/search'

export function buildApp() {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  })

  server.register(cors, {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','),
  })

  server.register(rateLimit, { global: false })

  server.register(prismaPlugin)
  server.register(redisPlugin)

  server.register(healthRoutes, { prefix: '/api' })
  server.register(authRoutes, { prefix: '/api/auth' })
  server.register(categoriesRoutes, { prefix: '/api/categories' })
  server.register(productsRoutes, { prefix: '/api/products' })
  server.register(vendorsRoutes, { prefix: '/api/vendors' })
  server.register(stockRoutes, { prefix: '/api/stock' })
  server.register(alertsRoutes, { prefix: '/api/alerts' })
  server.register(reportsRoutes, { prefix: '/api/reports' })
  server.register(buyersRoutes, { prefix: '/api/buyers' })
  server.register(exportRoutes, { prefix: '/api/export' })
  server.register(importRoutes, { prefix: '/api/import' })
  server.register(searchRoutes, { prefix: '/api/search' })

  return server
}
