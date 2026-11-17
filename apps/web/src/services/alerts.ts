import api from './api'

export interface Alert {
  id: string
  type: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRY'
  message: string
  isRead: boolean
  createdAt: string
  product?: {
    id: string
    name: string
    sku: string
  }
}

export interface AlertsResponse {
  alerts: Alert[]
  total: number
  page: number
  pages: number
}

export interface AlertsConfig {
  emailEnabled: boolean
  lowStockThreshold: number
  outOfStockEnabled: boolean
}

export const alertsApi = {
  list: (params?: Record<string, string | number | boolean>) =>
    api.get<AlertsResponse>('/alerts', { params }).then((r) => r.data),
  getUnreadCount: () =>
    api.get<{ count: number }>('/alerts/unread-count').then((r) => r.data),
  markRead: (id: string) =>
    api.put<{ alert: Alert }>(`/alerts/${id}/read`).then((r) => r.data.alert),
  markAllRead: () =>
    api.put<{ updated: number }>('/alerts/read-all').then((r) => r.data),
  getConfig: () =>
    api.get<{ config: AlertsConfig }>('/alerts/config').then((r) => r.data.config),
  updateConfig: (data: Partial<AlertsConfig>) =>
    api.put<{ config: AlertsConfig }>('/alerts/config', data).then((r) => r.data.config),
}
