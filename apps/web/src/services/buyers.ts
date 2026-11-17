import api from './api'

export interface Buyer {
  id: string
  name: string
  phone?: string
  email?: string
  city?: string
  address?: string
  active: boolean
  createdAt: string
  updatedAt: string
  _count?: { stockTransactions: number }
  stockTransactions?: {
    id: string
    createdAt: string
    quantity: number
    serialNo?: string
    notes?: string
    transactionDate?: string
    product?: { name: string; sku: string }
  }[]
}

export interface BuyersResponse {
  buyers: Buyer[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface BuyerTxResponse {
  transactions: {
    id: string
    transactionDate: string
    createdAt: string
    quantity: number
    unitPrice?: string
    serialNo?: string
    issuedTo?: string
    notes?: string
    product?: { id: string; name: string; sku: string }
    user?: { id: string; name: string }
  }[]
  total: number
  page: number
  limit: number
  pages: number
  summary: { totalOrders: number; totalUnits: number; totalAmount: number }
  products: { id: string; name: string }[]
}

export const buyersApi = {
  list: (params?: Record<string, string | number>) =>
    api.get<BuyersResponse>('/buyers', { params }).then((r) => r.data),
  get: (id: string) =>
    api.get<{ buyer: Buyer }>(`/buyers/${id}`).then((r) => r.data.buyer),
  create: (data: unknown) =>
    api.post<{ buyer: Buyer }>('/buyers', data).then((r) => r.data.buyer),
  update: (id: string, data: unknown) =>
    api.put<{ buyer: Buyer }>(`/buyers/${id}`, data).then((r) => r.data.buyer),
  delete: (id: string) =>
    api.delete<{ success: boolean }>(`/buyers/${id}`).then((r) => r.data),
  cities: () =>
    api.get<{ cities: string[] }>('/buyers/cities').then((r) => r.data.cities),
  search: (q: string) =>
    api.get<BuyersResponse>('/buyers', { params: { search: q, limit: 10 } }).then((r) => r.data),
  transactions: (id: string, params?: Record<string, string | number>) =>
    api.get<BuyerTxResponse>(`/buyers/${id}/transactions`, { params }).then((r) => r.data),
}
