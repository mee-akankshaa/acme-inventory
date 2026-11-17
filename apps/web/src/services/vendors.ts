import api from './api'

export interface Vendor {
  id: string
  name: string
  contactName?: string
  phone?: string
  email?: string
  city?: string
  address?: string
  active: boolean
  createdAt: string
  updatedAt: string
  _count?: { products: number; transactions: number; stockTransactions: number }
  stockTransactions?: { createdAt: string }[]
  products?: import('./products').Product[]
}

export interface VendorsResponse {
  vendors: Vendor[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface VendorTxSummary {
  totalOrders: number
  totalUnits: number
  totalAmount: number
}

export interface VendorTxResponse {
  transactions: {
    id: string
    transactionDate: string
    createdAt: string
    quantity: number
    unitPrice?: string
    serialNo?: string
    notes?: string
    product?: { id: string; name: string; sku: string }
    user?: { id: string; name: string }
  }[]
  total: number
  page: number
  limit: number
  pages: number
  summary: VendorTxSummary
  products: { id: string; name: string }[]
}

export const vendorsApi = {
  list: (params?: Record<string, string | number>) =>
    api.get<VendorsResponse>('/vendors', { params }).then((r) => r.data),
  cities: () =>
    api.get<{ cities: string[] }>('/vendors/cities').then((r) => r.data.cities),
  get: (id: string) =>
    api.get<{ vendor: Vendor }>(`/vendors/${id}`).then((r) => r.data.vendor),
  create: (data: unknown) =>
    api.post<{ vendor: Vendor }>('/vendors', data).then((r) => r.data.vendor),
  update: (id: string, data: unknown) =>
    api.put<{ vendor: Vendor }>(`/vendors/${id}`, data).then((r) => r.data.vendor),
  delete: (id: string) =>
    api
      .delete<{ success: boolean; productsUnlinked: number }>(`/vendors/${id}`)
      .then((r) => r.data),
  products: (id: string) =>
    api
      .get<{ products: import('./products').Product[] }>(`/vendors/${id}/products`)
      .then((r) => r.data.products),
  transactions: (id: string, params?: Record<string, string | number>) =>
    api.get<VendorTxResponse>(`/vendors/${id}/transactions`, { params }).then((r) => r.data),
}
