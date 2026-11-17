import api from './api'

export interface Category {
  id: string
  name: string
  slug: string
  children: Category[]
}

export interface Product {
  id: string
  name: string
  sku: string
  description?: string
  unit: string
  price?: string
  costPrice?: string
  categoryId?: string
  category?: { id: string; name: string; slug: string }
  minStockLevel: number
  active: boolean
  inventory?: { quantity: number }
  createdAt: string
  updatedAt: string
}

export interface ProductsResponse {
  products: Product[]
  total: number
  page: number
  limit: number
  pages: number
}

export const productsApi = {
  list: (params?: Record<string, string | number>) =>
    api.get<ProductsResponse>('/products', { params }).then((r) => r.data),
  get: (id: string) =>
    api.get<{ product: Product }>(`/products/${id}`).then((r) => r.data.product),
  create: (data: unknown) =>
    api.post<{ product: Product }>('/products', data).then((r) => r.data.product),
  update: (id: string, data: unknown) =>
    api.put<{ product: Product }>(`/products/${id}`, data).then((r) => r.data.product),
  delete: (id: string) => api.delete(`/products/${id}`),
  categories: () =>
    api.get<{ categories: Category[] }>('/categories').then((r) => r.data.categories),
}
