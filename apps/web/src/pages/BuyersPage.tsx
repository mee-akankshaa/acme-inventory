import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v3'
import { Users, X, PlusCircle } from 'lucide-react'
import { buyersApi } from '../services/buyers'
import axios from 'axios'
import BackButton from '../components/BackButton'
import Breadcrumbs from '../components/Breadcrumbs'
import ExportButton from '../components/ExportButton'
import { exportService, ExportFormat } from '../services/exportImport'

type DateFilter = 'all' | '7d' | '1m' | '3m' | 'custom'

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

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: 'all', label: 'All Buyers' },
  { value: '7d', label: 'Sold last 7 days' },
  { value: '1m', label: 'Sold last 1 month' },
  { value: '3m', label: 'Sold last 3 months' },
  { value: 'custom', label: 'Custom date range' },
]

const addSchema = z.object({
  name: z.string().min(1, 'Name required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  city: z.string().optional(),
  address: z.string().optional(),
})
type AddForm = z.infer<typeof addSchema>

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function BuyersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showAdd, setShowAdd] = useState(false)
  const [addError, setAddError] = useState('')
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
    queryKey: ['buyers', params],
    queryFn: () => buyersApi.list(params),
  })

  const { data: cities } = useQuery({
    queryKey: ['buyer-cities'],
    queryFn: () => buyersApi.cities(),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AddForm>({
    resolver: zodResolver(addSchema),
  })

  const addMutation = useMutation({
    mutationFn: (d: AddForm) => buyersApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['buyers'] })
      qc.invalidateQueries({ queryKey: ['buyer-cities'] })
      setShowAdd(false)
      reset()
      setAddError('')
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err)) setAddError(err.response?.data?.message ?? 'Failed to add buyer.')
      else setAddError('Something went wrong.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => buyersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['buyers'] }),
  })

  const buyers = data?.buyers ?? []
  const total = data?.total ?? 0
  const pages = data?.pages ?? 1
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1
  const rangeEnd = Math.min(page * limit, total)
  const hasFilter = dateFilter !== 'all' || cityFilter || debouncedSearch

  return (
    <div className="p-6">
      <BackButton to="/dashboard" />
      <Breadcrumbs crumbs={[{ label: 'Buyers' }]} />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Buyers</h1>
            <p className="text-xs text-gray-500">Your customers and sale contacts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            onExport={(fmt: ExportFormat) => exportService.buyers(fmt, { ...dateFilterToParams(dateFilter, dateFrom, dateTo), ...(cityFilter ? { city: cityFilter } : {}), ...(debouncedSearch ? { search: debouncedSearch } : {}) })}
            label="Export"
          />
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Add Buyer
          </button>
        </div>
      </div>

      {/* Add Buyer panel */}
      {showAdd && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-blue-800">New Buyer</h2>
            <button onClick={() => { setShowAdd(false); reset(); setAddError('') }}
              className="text-blue-500 hover:text-blue-700"><X className="w-4 h-4" /></button>
          </div>
          {addError && <p className="text-xs text-red-600 mb-3">{addError}</p>}
          <form onSubmit={handleSubmit((d) => addMutation.mutate(d))} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Name *</label>
                <input {...register('name')} placeholder="Buyer name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                {errors.name && <p className="text-xs text-red-600 mt-0.5">{errors.name.message}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Phone</label>
                <input {...register('phone')} placeholder="+1 555 010 0100"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
                <input {...register('email')} type="email" placeholder="buyer@example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                {errors.email && <p className="text-xs text-red-600 mt-0.5">{errors.email.message}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">City</label>
                <input {...register('city')} placeholder="e.g. Springfield"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Address</label>
              <textarea {...register('address')} rows={2} placeholder="Full address..."
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={addMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {addMutation.isPending ? 'Saving...' : 'Save Buyer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or city..."
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-primary-500" />

          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            {DATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Cities</option>
            {(cities ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          {hasFilter && (
            <button onClick={() => { setSearch(''); setDebouncedSearch(''); setDateFilter('all'); setCityFilter(''); setDateFrom(''); setDateTo('') }}
              className="text-sm text-gray-500 hover:text-gray-700 underline">Clear all</button>
          )}
        </div>

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
          <div className="p-12 text-center text-sm text-gray-400">Loading buyers...</div>
        ) : buyers.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">
            {hasFilter ? 'No buyers match your filters.' : 'No buyers yet. Add one or record a Stock Out with buyer name.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Buyer Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Phone</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">City</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Total Sales</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Last Sale</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {buyers.map((b) => {
                const lastSale = b.stockTransactions?.[0]?.createdAt
                return (
                  <tr key={b.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link to={`/buyers/${b.id}`} className="hover:text-blue-600 hover:underline">{b.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{b.phone ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{b.email ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600">{b.city ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600">{b._count?.stockTransactions ?? 0}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {lastSale ? fmt(lastSale) : <span className="text-gray-300">Never</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { if (window.confirm(`Delete buyer "${b.name}"?`)) deleteMutation.mutate(b.id) }}
                        className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                      >
                        Delete
                      </button>
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
              className="px-3 py-1 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 text-xs">Prev</button>
            <span className="px-2 py-1 text-xs text-gray-400">{page}/{pages}</span>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}
              className="px-3 py-1 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 text-xs">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
