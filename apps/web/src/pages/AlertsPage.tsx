import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { alertsApi } from '../services/alerts'
import BackButton from '../components/BackButton'
import Breadcrumbs from '../components/Breadcrumbs'
import ExportButton from '../components/ExportButton'
import { exportService, ExportFormat } from '../services/exportImport'

type FilterTab = 'ALL' | 'UNREAD' | 'LOW_STOCK' | 'OUT_OF_STOCK'

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function typeBadge(type: string) {
  const styles: Record<string, string> = {
    LOW_STOCK: 'bg-amber-100 text-amber-700',
    OUT_OF_STOCK: 'bg-red-100 text-red-700',
    EXPIRY: 'bg-blue-100 text-blue-700',
  }
  const labels: Record<string, string> = {
    LOW_STOCK: 'Low Stock',
    OUT_OF_STOCK: 'Out of Stock',
    EXPIRY: 'Expiry',
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[type] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {labels[type] ?? type}
    </span>
  )
}

export default function AlertsPage() {
  const [tab, setTab] = useState<FilterTab>('ALL')
  const [page, setPage] = useState(1)
  const limit = 20
  const queryClient = useQueryClient()

  useEffect(() => {
    setPage(1)
  }, [tab])

  const params: Record<string, string | number | boolean> = { page, limit }
  if (tab === 'UNREAD') params.isRead = false
  else if (tab === 'LOW_STOCK') params.type = 'LOW_STOCK'
  else if (tab === 'OUT_OF_STOCK') params.type = 'OUT_OF_STOCK'

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', params],
    queryFn: () => alertsApi.list(params),
  })

  const { data: unreadData } = useQuery({
    queryKey: ['alerts-unread'],
    queryFn: alertsApi.getUnreadCount,
    refetchInterval: 30000,
  })

  const alerts = data?.alerts ?? []
  const total = data?.total ?? 0
  const pages = data?.pages ?? 1
  const unreadCount = unreadData?.count ?? 0
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1
  const rangeEnd = Math.min(page * limit, total)

  const [markingId, setMarkingId] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  async function handleMarkRead(id: string) {
    setMarkingId(id)
    try {
      await alertsApi.markRead(id)
      await queryClient.invalidateQueries({ queryKey: ['alerts'] })
      await queryClient.invalidateQueries({ queryKey: ['alerts-unread'] })
    } finally {
      setMarkingId(null)
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true)
    try {
      await alertsApi.markAllRead()
      await queryClient.invalidateQueries({ queryKey: ['alerts'] })
      await queryClient.invalidateQueries({ queryKey: ['alerts-unread'] })
    } finally {
      setMarkingAll(false)
    }
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'UNREAD', label: 'Unread' },
    { key: 'LOW_STOCK', label: 'Low Stock' },
    { key: 'OUT_OF_STOCK', label: 'Out of Stock' },
  ]

  return (
    <div className="p-6">
      <BackButton to="/dashboard" />
      <Breadcrumbs crumbs={[{ label: 'Alerts' }]} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Alerts</h1>
        <div className="flex items-center gap-2">
          <ExportButton
            onExport={(fmt: ExportFormat) => {
              const params: Record<string, string> = {}
              if (tab === 'LOW_STOCK') params.type = 'LOW_STOCK'
              else if (tab === 'OUT_OF_STOCK') params.type = 'OUT_OF_STOCK'
              else if (tab === 'UNREAD') params.isRead = 'false'
              return exportService.alerts(fmt, params)
            }}
            label="Export"
          />
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {markingAll ? 'Marking...' : 'Mark All Read'}
            </button>
          )}
        </div>
      </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500 text-sm">Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">No alerts found</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Product</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Message</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {alerts.map((alert) => (
                  <tr key={alert.id} className={`hover:bg-gray-50 ${!alert.isRead ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {timeAgo(alert.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {alert.product ? (
                        <>
                          <div className="font-medium text-gray-900">{alert.product.name}</div>
                          <div className="text-xs text-gray-400 font-mono">{alert.product.sku}</div>
                        </>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{typeBadge(alert.type)}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">{alert.message}</td>
                    <td className="px-4 py-3">
                      {alert.isRead ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          Read
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                          Unread
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!alert.isRead && (
                        <button
                          onClick={() => handleMarkRead(alert.id)}
                          disabled={markingId === alert.id}
                          className="px-3 py-1 text-xs font-medium text-primary-600 bg-primary-50 border border-primary-200 rounded-md hover:bg-primary-100 transition-colors disabled:opacity-50"
                        >
                          {markingId === alert.id ? '...' : 'Mark Read'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {!isLoading && total > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
              <span>
                Showing {rangeStart}&ndash;{rangeEnd} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Prev
                </button>
                <button
                  disabled={page >= pages}
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
    </div>
  )
}
