import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

interface TxRow {
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
}

interface Summary { totalOrders: number; totalUnits: number; totalAmount: number }

interface Props {
  queryKey: string
  fetchFn: (params: Record<string, string | number>) => Promise<{
    transactions: TxRow[]
    total: number
    pages: number
    summary: Summary
    products: { id: string; name: string }[]
  }>
  mode: 'vendor' | 'buyer'
  emptyMessage: string
}

const QUICK: { label: string; days: number | null }[] = [
  { label: 'All time', days: null },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 3 months', days: 90 },
]

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtRs(n: number) {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function TransactionHistorySection({ queryKey, fetchFn, mode, emptyMessage }: Props) {
  const [page, setPage] = useState(1)
  const [quickDays, setQuickDays] = useState<number | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [productId, setProductId] = useState('')

  // When quick button clicked, set date range
  function applyQuick(days: number | null) {
    setQuickDays(days)
    setPage(1)
    if (days === null) { setStartDate(''); setEndDate(''); return }
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - days)
    setStartDate(isoDate(from))
    setEndDate(isoDate(to))
  }

  useEffect(() => { setPage(1) }, [startDate, endDate, productId])

  const params: Record<string, string | number> = { page, limit: 10 }
  if (startDate) params.startDate = startDate
  if (endDate) params.endDate = endDate
  if (productId) params.productId = productId

  const { data, isLoading } = useQuery({
    queryKey: [queryKey, params],
    queryFn: () => fetchFn(params),
  })

  const transactions = data?.transactions ?? []
  const pages = data?.pages ?? 1
  const summary = data?.summary
  const products = data?.products ?? []
  const rangeStart = !data?.total ? 0 : (page - 1) * 10 + 1
  const rangeEnd = Math.min(page * 10, data?.total ?? 0)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          {mode === 'vendor' ? 'Purchase History' : 'Sales History'}
        </h3>
      </div>

      {/* Filter bar */}
      <div className="px-6 py-3 border-b border-gray-100 space-y-3">
        {/* Quick date buttons */}
        <div className="flex flex-wrap gap-2 items-center">
          {QUICK.map((q) => (
            <button
              key={q.label}
              onClick={() => applyQuick(q.days)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                quickDays === q.days
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400 hover:text-primary-600'
              }`}
            >
              {q.label}
            </button>
          ))}
          {products.length > 0 && (
            <select
              value={productId}
              onChange={(e) => { setProductId(e.target.value); setPage(1) }}
              className="ml-auto border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Custom date range */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">From:</span>
          <input type="date" value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setQuickDays(-1) }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500" />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setQuickDays(-1) }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500" />
          {(startDate || endDate || productId) && (
            <button onClick={() => { setStartDate(''); setEndDate(''); setProductId(''); setQuickDays(null) }}
              className="text-xs text-gray-400 hover:text-red-500 underline ml-1">Clear</button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
          <div className="px-6 py-3 text-center">
            <div className="text-xs text-gray-500 mb-0.5">Total Orders</div>
            <div className="text-lg font-bold text-gray-900">{summary.totalOrders}</div>
          </div>
          <div className="px-6 py-3 text-center">
            <div className="text-xs text-gray-500 mb-0.5">Total Units</div>
            <div className="text-lg font-bold text-gray-900">{summary.totalUnits}</div>
          </div>
          <div className="px-6 py-3 text-center">
            <div className="text-xs text-gray-500 mb-0.5">Total Amount</div>
            <div className="text-lg font-bold text-gray-900">{fmtRs(summary.totalAmount)}</div>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="p-10 text-center text-sm text-gray-400">Loading...</div>
      ) : transactions.length === 0 ? (
        <div className="p-10 text-center">
          <div className="text-3xl mb-3">📦</div>
          <p className="text-sm text-gray-500">{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Product</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Qty</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Unit Price</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                {mode === 'buyer' && (
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Issued To</th>
                )}
                {mode === 'vendor' && (
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Received By</th>
                )}
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((tx) => {
                const price = tx.unitPrice ? Number(tx.unitPrice) : null
                const total = price !== null ? price * tx.quantity : null
                return (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {fmt(tx.transactionDate ?? tx.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{tx.product?.name ?? '—'}</div>
                      <div className="text-xs text-gray-400 font-mono">{tx.product?.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900">{tx.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                      {price !== null ? fmtRs(price) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900">
                      {total !== null ? fmtRs(total) : <span className="text-gray-300">—</span>}
                    </td>
                    {mode === 'buyer' && (
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {tx.issuedTo ?? <span className="text-gray-300">—</span>}
                      </td>
                    )}
                    {mode === 'vendor' && (
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {tx.user?.name ?? <span className="text-gray-300">—</span>}
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">
                      {tx.notes ?? <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {(data?.total ?? 0) > 0 && (
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
          <span className="text-xs">Showing {rangeStart}–{rangeEnd} of {data?.total}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-3 py-1 border border-gray-200 rounded-md text-xs hover:bg-gray-50 disabled:opacity-40">← Prev</button>
            <span className="px-2 py-1 text-xs text-gray-400">{page}/{pages}</span>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}
              className="px-3 py-1 border border-gray-200 rounded-md text-xs hover:bg-gray-50 disabled:opacity-40">Next →</button>
          </div>
        </div>
      )}
    </div>
  )
}
