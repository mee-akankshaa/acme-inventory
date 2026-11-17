import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { stockApi } from '../services/stock'
import BackButton from '../components/BackButton'
import Breadcrumbs from '../components/Breadcrumbs'
import ExportButton from '../components/ExportButton'
import { exportService, ExportFormat } from '../services/exportImport'

type TxType = 'ALL' | 'IN' | 'OUT' | 'ADJUSTMENT'

export default function StockTransactionsPage() {
  const [typeFilter, setTypeFilter] = useState<TxType>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(productSearch); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [productSearch])

  useEffect(() => { setPage(1) }, [typeFilter, dateFrom, dateTo])

  const params: Record<string, string | number> = { page, limit }
  if (typeFilter !== 'ALL') params.type = typeFilter
  if (dateFrom) params.dateFrom = dateFrom
  if (dateTo) params.dateTo = dateTo
  if (debouncedSearch) params.productSearch = debouncedSearch

  const { data, isLoading } = useQuery({
    queryKey: ['stock-transactions', params],
    queryFn: () => stockApi.getTransactions(params),
  })

  const transactions = data?.transactions ?? []
  const total = data?.total ?? 0
  const pages = data?.pages ?? 1
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1
  const rangeEnd = Math.min(page * limit, total)

  function typeBadge(type: string) {
    const styles: Record<string, string> = {
      IN: 'bg-green-100 text-green-700 border border-green-200',
      OUT: 'bg-red-100 text-red-700 border border-red-200',
      ADJUSTMENT: 'bg-blue-100 text-blue-700 border border-blue-200',
    }
    const labels: Record<string, string> = { IN: '↑ IN', OUT: '↓ OUT', ADJUSTMENT: '⇄ ADJ' }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[type] ?? 'bg-gray-100 text-gray-600'}`}>
        {labels[type] ?? type}
      </span>
    )
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const hasActive = typeFilter !== 'ALL' || dateFrom || dateTo || productSearch

  return (
    <div className="p-6">
      <BackButton to="/dashboard" />
      <Breadcrumbs crumbs={[{ label: 'Transactions' }]} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Transaction History</h1>
          <p className="text-xs text-gray-500 mt-0.5">All stock movements — fully transparent audit trail</p>
        </div>
        <div className="flex items-center gap-3">
          {total > 0 && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
              {total} records
            </span>
          )}
          <ExportButton
            onExport={(fmt: ExportFormat) => exportService.transactions(fmt, { ...(typeFilter !== 'ALL' ? { type: typeFilter } : {}), ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}), ...(debouncedSearch ? { productSearch: debouncedSearch } : {}) })}
            label="Export"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TxType)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="ALL">All Types</option>
          <option value="IN">IN</option>
          <option value="OUT">OUT</option>
          <option value="ADJUSTMENT">ADJUSTMENT</option>
        </select>

        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            title="From date" />
          <span className="text-gray-400 text-xs">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            title="To date" />
        </div>

        <input
          type="text"
          placeholder="Search product..."
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />

        {hasActive && (
          <button
            onClick={() => { setTypeFilter('ALL'); setDateFrom(''); setDateTo(''); setProductSearch('') }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No transactions found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Product</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Qty</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Serial No.</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Vendor / Buyer</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Unit Price</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Notes</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((tx) => (
                <tr key={tx.id} className={`hover:bg-gray-50 transition-colors ${tx.type === 'OUT' ? 'bg-red-50/30' : tx.type === 'IN' ? 'bg-green-50/30' : ''}`}>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap font-medium">
                    {formatDate(tx.transactionDate ?? tx.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{tx.product?.name ?? '—'}</div>
                    <div className="text-xs text-gray-400 font-mono">{tx.product?.sku ?? ''}</div>
                  </td>
                  <td className="px-4 py-3">{typeBadge(tx.type)}</td>
                  <td className={`px-4 py-3 text-right font-bold tabular-nums ${tx.type === 'OUT' ? 'text-red-600' : 'text-green-600'}`}>
                    {tx.type === 'OUT' ? '-' : '+'}{tx.quantity}
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {tx.serialNo ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {tx.type === 'IN' ? (
                      tx.vendor
                        ? <Link to={`/vendors/${tx.vendor.id}`} className="text-blue-600 font-medium text-xs hover:underline">{tx.vendor.name}</Link>
                        : <span className="text-gray-300">—</span>
                    ) : (
                      <>
                        {tx.buyer ? (
                          <Link to={`/buyers/${tx.buyer.id}`} className="text-blue-600 font-medium text-xs hover:underline">{tx.buyer.name}</Link>
                        ) : tx.buyerName ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-700 font-medium text-xs">{tx.buyerName}</span>
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-400 rounded border border-gray-200">Legacy</span>
                          </div>
                        ) : null}
                        {tx.issuedTo && <div className="text-gray-500 text-xs mt-0.5">{tx.issuedTo}</div>}
                        {!tx.buyer && !tx.buyerName && !tx.issuedTo && <span className="text-gray-300">—</span>}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {tx.unitPrice != null ? `$${tx.unitPrice}` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">
                    {tx.notes ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {tx.user?.name ?? <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!isLoading && total > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>Showing {rangeStart}–{rangeEnd} of {total}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors text-xs">
                ← Prev
              </button>
              <span className="px-3 py-1 text-xs text-gray-400">{page}/{pages}</span>
              <button disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}
                className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors text-xs">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
