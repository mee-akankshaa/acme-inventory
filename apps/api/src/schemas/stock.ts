import { z } from 'zod'

export const stockInSchema = z.object({
  productId: z.string().uuid(),
  vendorId: z.string().uuid().optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive().optional(),
  serialNo: z.string().max(100).optional(),
  transactionDate: z.string().optional(),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().min(1).max(100),
})

export const stockOutSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  buyerName: z.string().max(200).optional(),
  buyerId: z.string().uuid().optional(),
  serialNo: z.string().max(100).optional(),
  issuedTo: z.string().max(200).optional(),
  transactionDate: z.string().optional(),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().min(1).max(100),
})

export const stockAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  newQuantity: z.number().int().min(0),
  reason: z.string().min(1).max(500),
})

export const stockTransactionQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
