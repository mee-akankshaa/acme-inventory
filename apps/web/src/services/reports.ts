import api from './api'

export interface StockSummary {
  totalProducts: number
  totalInventoryValue: number
  lowStockCount: number
  outOfStockCount: number
}

export interface MovementEntry {
  date: string
  totalIn: number
  totalOut: number
  netChange: number
}

export interface StockMovementResponse {
  movement: MovementEntry[]
}

export interface TopProduct {
  id: string
  name: string
  sku: string
  unit: string
  value: number
  totalQuantity?: number
}

export interface TopProductsResponse {
  type: string
  products: TopProduct[]
}

export interface VendorSummaryEntry {
  id: string
  name: string
  city?: string
  contactName: string
  totalProducts: number
  totalOrders: number
  totalUnits: number
  totalValue: number
  totalValueReceived: number
  lastTransactionDate: string
  lastPurchaseDate: string
}

export interface VendorSummaryResponse {
  vendors: VendorSummaryEntry[]
}

export interface BuyerReportEntry {
  id: string
  name: string
  city?: string
  totalOrders: number
  totalUnits: number
  totalValue: number
  lastSaleDate: string
}

export interface BuyerReportResponse {
  buyers: BuyerReportEntry[]
}

export interface ProductReportEntry {
  id: string
  name: string
  sku: string
  category?: string
  minStockLevel: number
  currentStock: number
  stockValue: number
  totalIn: number
  totalOut: number
}

export interface ProductReportResponse {
  products: ProductReportEntry[]
}

export interface LowStockProduct {
  id: string
  name: string
  sku: string
  unit: string
  minStockLevel: number
  quantityOnHand: number
  vendorName: string
}

export interface LowStockReportResponse {
  products: LowStockProduct[]
  total: number
}

export interface TransactionExportResponse {
  transactions: unknown[]
  total: number
  page: number
  pages: number
}

export const reportsApi = {
  getStockSummary: () =>
    api.get<StockSummary>('/reports/stock-summary').then((r) => r.data),

  getStockMovement: (params?: { dateFrom?: string; dateTo?: string; productId?: string }) =>
    api.get<StockMovementResponse>('/reports/stock-movement', { params }).then((r) => r.data),

  getTopProducts: (params?: { limit?: number; type?: string; dateFrom?: string; dateTo?: string }) =>
    api.get<TopProductsResponse>('/reports/top-products', { params }).then((r) => r.data),

  getVendorSummary: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get<VendorSummaryResponse>('/reports/vendor-summary', { params }).then((r) => r.data),

  getBuyerReport: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get<BuyerReportResponse>('/reports/buyer-report', { params }).then((r) => r.data),

  getProductReport: (params?: { categoryId?: string; dateFrom?: string; dateTo?: string }) =>
    api.get<ProductReportResponse>('/reports/product-report', { params }).then((r) => r.data),

  getLowStockReport: () =>
    api.get<LowStockReportResponse>('/reports/low-stock-report').then((r) => r.data),

  getTransactionExport: (params?: { dateFrom?: string; dateTo?: string; page?: number; limit?: number }) =>
    api.get<TransactionExportResponse>('/reports/transaction-export', { params }).then((r) => r.data),
}
