import { z } from 'zod'

export const createVendorSchema = z.object({
  name: z.string().min(1).max(200),
  contactName: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  city: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
})

export const updateVendorSchema = createVendorSchema.partial()

export const vendorQuerySchema = z.object({
  search: z.string().optional(),
  city: z.string().optional(),
  dateFilter: z.enum(['all', '7d', '1m', '3m', 'custom']).default('all'),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
