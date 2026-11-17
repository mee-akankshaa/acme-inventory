import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { vendorsApi } from '../services/vendors'
import BackButton from '../components/BackButton'
import Breadcrumbs from '../components/Breadcrumbs'
import ExportButton from '../components/ExportButton'
import { exportService, ExportFormat } from '../services/exportImport'

type DateFilter = 'all' | '7d' | '1m' | '3m' | 'custom'

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: 'all', label: 'All Vendors' },
  { value: '7d', label: 'Purchased last 7 days' },
  { value: '1m', label: 'Purchased last 1 month' },
  { value: '3m', label: 'Purchased last 3 months' },
  { value: 'custom', label: 'Custom date range' },
]

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

function dateFilterToParams(filter: DateFilter, from: string, to: string): Record<string, string> {
  if (filter === 'custom') {
    const p: Record<string, string> = {}
    if (from) p.dateFrom = from
    if (to) p.dateTo = to
    return p
  }
  const now = new Date()
  if (filter === '7d') { const d = new Date(now); d.setDate(d.getDate() - 7); return { dateFrom: d.toISOString().split('T')[0] } }
  if (filter === '1m') { const d = new Date(now); d.setMonth(d.getMonth() - 1); return { dateFrom: d.toISOString().split('T')[0] } }
  if (filter === '3m') { const d = new Date(now); d.setMonth(d.getMonth() - 3); return { dateFrom: d.toISOString().split('T')[0] } }
  return {}
}

export default function VendorsPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [dateFilter, cityFilter, dateFrom, dateTo])

  const params: Record<string, string | number> = { page, limit, dateFilter }
  if (debouncedSearch) params.search = debouncedSearch
  if (cityFilter) params.city = cityFilter
  if (dateFilter === 'custom' && dateFrom) params.dateFrom = dateFrom
  if (dateFilter === 'custom' && dateTo) params.dateTo = dateTo

  const { data, isLoading } = useQuery({
    queryKey: ['vendors', params],
    queryFn: () => vendorsApi.list(params),
  })

  const { data: cities } = useQuery({
    queryKey: ['vendor-cities'],
    queryFn: () => vendorsApi.cities(),
  })

  const vendors = data?.vendors ?? []
  const total = data?.total ?? 0
  const pages = data?.pages ?? 1
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1
  const rangeEnd = Math.min(page * limit, total)

  const hasFilter = dateFilter !== 'all' || cityFilter || debouncedSearch

  return (
    <div className="p-6">
      <BackButton to="/dashboard" />
      <Breadcrumbs crumbs={[{ label: 'Vendors' }]} />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Building2 className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Vendors</h1>
            <p className="text-xs text-gray-500">Your suppliers and purchase contacts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            onExport={(fmt: ExportFormat) => exportService.vendors(fmt, { ...dateFilterToParams(dateFilter, dateFrom, dateTo), ...(cityFilter ? { city: cityFilter } : {}), ...(debouncedSearch ? { search: debouncedSearch } : {}) })}
            label="Export"
          />
          <Link
            to="/vendors/new"
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            + Add Vendor
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or contact..."
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          {/* Date filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {DATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* City filter */}
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Cities</option>
            {(cities ?? []).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {hasFilter && (
            <button
              onClick={() => { setSearch(''); setDebouncedSearch(''); setDateFilter('all'); setCityFilter(''); setDateFrom(''); setDateTo('') }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Custom date range */}
        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-gray-500">From:</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <span className="text-xs text-gray-400">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-400">Loading vendors...</div>
        ) : vendors.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">
            {hasFilter ? 'No vendors match your filters.' : 'No vendors yet. Add one to get started.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Company Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Contact Person</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">City</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Phone</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Last Purchase</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => {
                const lastPurchase = v.stockTransactions?.[0]?.createdAt
                return (
                  <tr key={v.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{v.name}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{v.contactName ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600">{v.city ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{v.email ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600">{v.phone ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {lastPurchase ? fmt(lastPurchase) : <span className="text-gray-300">Never</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/vendors/${v.id}`}
                          className="px-3 py-1 text-xs font-medium text-primary-600 bg-primary-50 border border-primary-200 rounded-md hover:bg-primary-100 transition-colors">
                          View
                        </Link>
                        <Link to={`/vendors/${v.id}/edit`}
                          className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors">
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span>Showing {rangeStart}–{rangeEnd} of {total}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-3 py-1 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs">Prev</button>
            <span className="px-2 py-1 text-xs text-gray-400">{page}/{pages}</span>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}
              className="px-3 py-1 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
