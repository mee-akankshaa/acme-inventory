import { z } from 'zod'

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(50).toUpperCase(),
  description: z.string().max(1000).optional(),
  unit: z.enum(['pcs', 'kg', 'ltr', 'box']),
  price: z.number().positive().optional(),
  costPrice: z.number().positive().optional(),
  categoryId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  minStockLevel: z.number().int().min(0).default(0),
})

export const updateProductSchema = createProductSchema.partial()

export const productQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  inStock: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
})
