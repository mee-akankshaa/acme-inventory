import api from './api'

export interface ProductResult {
  id: string
  name: string
  sku: string
  unit: string
  category: string | null
  currentStock: number
  minStockLevel: number
  totalStockIn: number
  totalStockOut: number
  stockValue: number
  price: number
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
}

export interface VendorResult {
  id: string
  name: string
  city: string | null
  contactName: string | null
  phone: string | null
}

export interface BuyerResult {
  id: string
  name: string
  city: string | null
  phone: string | null
  lastPurchaseDate: string | null
}

export interface SearchResult {
  products: ProductResult[]
  vendors: VendorResult[]
  buyers: BuyerResult[]
}

export interface ProductDetail {
  id: string
  name: string
  sku: string
  unit: string
  category: string | null
  minStockLevel: number
  price: number
  currentStock: number
  totalStockIn: number
  totalStockOut: number
  stockValue: number
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
}

export interface TransactionRecord {
  id: string
  type: 'IN' | 'OUT' | 'ADJUSTMENT'
  quantity: number
  unitPrice: number | null
  date: string
  vendor: { id: string; name: string } | null
  buyer: { id: string; name: string } | null
  notes: string | null
  by: string | null
}

export const searchApi = {
  search: (q: string) =>
    api.get<SearchResult>('/search', { params: { q } }).then((r) => r.data),

  getProductDetail: (id: string) =>
    api.get<{ product: ProductDetail; transactions: TransactionRecord[] }>(`/search/product/${id}`).then((r) => r.data),
}
