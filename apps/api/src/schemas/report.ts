import { z } from 'zod'

export const dateRangeSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  productId: z.string().uuid().optional(),
})

export const topProductsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  type: z.enum(['most-stocked', 'most-moved']).default('most-moved'),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

export const transactionExportSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(500).default(100),
})
