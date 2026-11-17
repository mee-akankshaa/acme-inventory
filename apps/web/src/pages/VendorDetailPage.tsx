import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { vendorsApi } from '../services/vendors'
import BackButton from '../components/BackButton'
import Breadcrumbs from '../components/Breadcrumbs'
import TransactionHistorySection from '../components/TransactionHistorySection'

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    data: vendor,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['vendor', id],
    queryFn: () => vendorsApi.get(id!),
    enabled: !!id,
  })

  const { data: products } = useQuery({
    queryKey: ['vendor-products', id],
    queryFn: () => vendorsApi.products(id!),
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: () => vendorsApi.delete(id!),
    onSuccess: (result) => {
      const msg =
        result.productsUnlinked > 0
          ? `Vendor deleted. ${result.productsUnlinked} product(s) unlinked.`
          : 'Vendor deleted.'
      alert(msg)
      navigate('/vendors')
    },
  })

  function handleDelete() {
    if (
      window.confirm('Are you sure you want to delete this vendor? This action cannot be undone.')
    ) {
      deleteMutation.mutate()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 text-sm">Loading vendor...</p>
      </div>
    )
  }

  if (isError || !vendor) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-700 font-medium mb-2">Vendor not found</p>
          <Link to="/vendors" className="text-sm text-primary-600 hover:underline">
            ← Back to Vendors
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      <BackButton to="/vendors" />
      <Breadcrumbs crumbs={[{ label: 'Vendors', to: '/vendors' }, { label: 'Vendor Detail' }]} />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/vendors" className="text-sm text-gray-500 hover:text-gray-700">
            ← Vendors
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-bold text-gray-900">{vendor.name}</h1>
        </div>
      </div>

      <div className="space-y-6">
        {/* Vendor Details Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{vendor.name}</h2>
              {!vendor.active && (
                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded">
                  Inactive
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Link
                to={`/vendors/${vendor.id}/edit`}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Edit
              </Link>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-60 transition-colors"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {vendor.contactName && (
              <div>
                <dt className="text-gray-500 mb-0.5">Contact</dt>
                <dd className="text-gray-900 font-medium">{vendor.contactName}</dd>
              </div>
            )}
            {vendor.phone && (
              <div>
                <dt className="text-gray-500 mb-0.5">Phone</dt>
                <dd className="text-gray-900 font-medium">{vendor.phone}</dd>
              </div>
            )}
            {vendor.email && (
              <div>
                <dt className="text-gray-500 mb-0.5">Email</dt>
                <dd className="text-gray-900 font-medium">{vendor.email}</dd>
              </div>
            )}
            {vendor.address && (
              <div className="sm:col-span-2">
                <dt className="text-gray-500 mb-0.5">Address</dt>
                <dd className="text-gray-900 font-medium whitespace-pre-wrap">{vendor.address}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Linked Products */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">
              Linked Products ({products?.length ?? 0})
            </h3>
          </div>

          {!products || products.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              No products linked to this vendor.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Stock Qty</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{product.name}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{product.sku}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {product.category?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {product.inventory?.quantity ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {/* Purchase History */}
        <TransactionHistorySection
          queryKey={`vendor-txns-${id}`}
          fetchFn={(params) => vendorsApi.transactions(id!, params)}
          mode="vendor"
          emptyMessage="No purchases from this vendor yet"
        />
      </div>
    </div>
  )
}
