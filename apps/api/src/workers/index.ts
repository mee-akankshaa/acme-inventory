import { Worker } from 'bullmq'
import Redis from 'ioredis'
import { PrismaClient } from '@prisma/client'
import { processAlertCheck } from './processors/alertCheck'
import { processAlertEmail } from './processors/alertEmail'

const prisma = new PrismaClient()
const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

const worker = new Worker(
  'alerts',
  async (job) => {
    if (job.name === 'alert:check') {
      await processAlertCheck(prisma, job.data)
    } else if (job.name === 'alert:email') {
      await processAlertEmail(prisma, job.data)
    }
  },
  { connection, concurrency: 5 }
)

worker.on('completed', (job) => {
  console.log(`[worker] Job ${job.name}:${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.name}:${job?.id} failed:`, err.message)
})

process.on('SIGTERM', async () => {
  await worker.close()
  await prisma.$disconnect()
  process.exit(0)
})

console.log('[worker] Alert worker started')
