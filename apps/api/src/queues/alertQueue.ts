import { Queue } from 'bullmq'
import Redis from 'ioredis'

const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

export const alertQueue = new Queue('alerts', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
})

export interface AlertCheckJobData {
  productId: string
  quantityOnHand: number
  transactionType: 'IN' | 'OUT' | 'ADJUSTMENT'
}

export interface AlertEmailJobData {
  alertId: string
  productName: string
  alertType: string
  message: string
}
