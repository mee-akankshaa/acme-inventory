import { z } from 'zod'

export const alertConfigSchema = z.object({
  emailEnabled: z.boolean().optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  outOfStockEnabled: z.boolean().optional(),
})

export const alertQuerySchema = z.object({
  isRead: z.enum(['true', 'false']).optional(),
  type: z.enum(['LOW_STOCK', 'OUT_OF_STOCK', 'EXPIRY']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
