import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { buyersApi } from '../services/buyers'
import BackButton from '../components/BackButton'
import Breadcrumbs from '../components/Breadcrumbs'
import TransactionHistorySection from '../components/TransactionHistorySection'

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}
function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export default function BuyerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: buyer, isLoading, isError } = useQuery({
    queryKey: ['buyer', id],
    queryFn: () => buyersApi.get(id!),
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: () => buyersApi.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['buyers'] })
      navigate('/buyers')
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 text-sm">Loading buyer...</p>
      </div>
    )
  }

  if (isError || !buyer) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-700 font-medium mb-2">Buyer not found</p>
          <Link to="/buyers" className="text-sm text-blue-600 hover:underline">← Back to Buyers</Link>
        </div>
      </div>
    )
  }

  const txns = buyer.stockTransactions ?? []
  const totalUnits = txns.reduce((s, t) => s + (t.quantity ?? 0), 0)
  const lastTxDate = txns[0]?.transactionDate ?? txns[0]?.createdAt

  return (
    <div className="p-6 max-w-4xl">
      <BackButton to="/buyers" />
      <Breadcrumbs crumbs={[{ label: 'Buyers', to: '/buyers' }, { label: buyer.name }]} />

      <div className="space-y-6">

        {/* Profile card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-blue-600">{initials(buyer.name)}</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{buyer.name}</h1>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-sm text-gray-600">
                    {buyer.phone && (
                      <span className="flex items-center gap-1">
                        <span>📞</span> {buyer.phone}
                      </span>
                    )}
                    {buyer.email && (
                      <span className="flex items-center gap-1">
                        <span>📧</span> {buyer.email}
                      </span>
                    )}
                    {buyer.city && (
                      <span className="flex items-center gap-1">
                        <span>📍</span>
                        {buyer.city}
                        {buyer.address ? `, ${buyer.address}` : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete buyer "${buyer.name}"? This cannot be undone.`))
                        deleteMutation.mutate()
                    }}
                    disabled={deleteMutation.isPending}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-60 transition-colors"
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{buyer._count?.stockTransactions ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1">Total Orders</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{totalUnits}</div>
            <div className="text-xs text-gray-500 mt-1">Units Bought</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-sm font-bold text-gray-500 mt-1">Added</div>
            <div className="text-sm font-semibold text-gray-900 mt-1">{fmt(buyer.createdAt)}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-sm text-gray-500 mt-1">Last Purchase</div>
            <div className="text-sm font-semibold text-gray-900 mt-1">
              {lastTxDate ? fmt(lastTxDate) : '—'}
            </div>
          </div>
        </div>

        {/* Transaction history */}
        <TransactionHistorySection
          queryKey={`buyer-txns-${id}`}
          fetchFn={(params) => buyersApi.transactions(id!, params)}
          mode="buyer"
          emptyMessage="No stock has been issued to this buyer yet"
        />
      </div>
    </div>
  )
}
