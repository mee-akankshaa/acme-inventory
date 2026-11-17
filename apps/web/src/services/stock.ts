import api from './api'

export interface StockInData {
  productId: string
  vendorId?: string
  quantity: number
  unitPrice?: number
  serialNo?: string
  transactionDate?: string
  notes?: string
  idempotencyKey: string
}

export interface StockOutData {
  productId: string
  quantity: number
  buyerName?: string
  buyerId?: string
  serialNo?: string
  issuedTo?: string
  transactionDate?: string
  notes?: string
  idempotencyKey: string
}

export interface StockAdjustmentData {
  productId: string
  newQuantity: number
  reason: string
}

export interface StockTransaction {
  id: string
  productId: string
  type: 'IN' | 'OUT' | 'ADJUSTMENT'
  quantity: number
  unitPrice?: string
  buyerName?: string
  serialNo?: string
  issuedTo?: string
  transactionDate: string
  notes?: string
  idempotencyKey?: string
  createdAt: string
  product?: { id: string; name: string; sku: string }
  vendor?: { id: string; name: string }
  buyer?: { id: string; name: string }
  user?: { id: string; name: string }
}

export interface TransactionsResponse {
  transactions: StockTransaction[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface InventoryItem {
  id: string
  productId: string
  quantityOnHand: number
  isLowStock: boolean
  product: {
    id: string
    name: string
    sku: string
    unit: string
    minStockLevel: number
    category?: { id: string; name: string; slug: string }
    vendor?: { id: string; name: string }
  }
}

export interface InventoryResponse {
  inventory: InventoryItem[]
  lowStockCount: number
  total: number
}

export const stockApi = {
  stockIn: (data: StockInData) =>
    api.post<{ transaction: StockTransaction }>('/stock/in', data).then((r) => r.data),
  stockOut: (data: StockOutData) =>
    api.post<{ transaction: StockTransaction }>('/stock/out', data).then((r) => r.data),
  adjustment: (data: StockAdjustmentData) =>
    api.post<{ transaction: StockTransaction }>('/stock/adjustment', data).then((r) => r.data),
  getTransactions: (params?: Record<string, string | number>) =>
    api.get<TransactionsResponse>('/stock/transactions', { params }).then((r) => r.data),
  getInventory: () =>
    api.get<InventoryResponse>('/stock/inventory').then((r) => r.data),
}
