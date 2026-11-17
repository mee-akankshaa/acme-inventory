import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Package } from 'lucide-react'
import { searchApi } from '../services/search'
import BackButton from '../components/BackButton'
import Breadcrumbs from '../components/Breadcrumbs'

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data, isLoading, error } = useQuery({
    queryKey: ['product-detail', id],
    queryFn: () => searchApi.getProductDetail(id!),
    enabled: !!id,
  })

  const product = data?.product
  const transactions = data?.transactions ?? []

  if (isLoading) return <div className="p-8 text-center text-sm text-gray-400">Loading product...</div>
  if (error || !product) return (
    <div className="p-8 text-center">
      <p className="text-sm text-gray-500 mb-3">Product not found</p>
      <button onClick={() => navigate('/products')} className="text-sm text-primary-600 underline">Back to Products</button>
    </div>
  )

  const statusBadge = product.status === 'out_of_stock'
    ? <span className="px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full">Out of Stock</span>
    : product.status === 'low_stock'
      ? <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full">Low Stock</span>
      : <span className="px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded-full">In Stock</span>

  function txTypeBadge(type: string) {
    if (type === 'IN') return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">↑ IN</span>
    if (type === 'OUT') return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">↓ OUT</span>
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">⇄ ADJ</span>
  }

  return (
    <div className="p-6">
      <BackButton />
      <Breadcrumbs crumbs={[{ label: 'Products', to: '/products' }, { label: product.name }]} />

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary-100 rounded-lg mt-0.5">
            <Package className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2 mb-0.5">
              <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>
              {statusBadge}
            </div>
            <p className="text-xs text-gray-500">
              <span className="font-mono">SKU: {product.sku}</span>
              {product.category && <> · {product.category}</>}
              {' · '}{product.unit}
              {product.minStockLevel > 0 && <> · Min stock: {product.minStockLevel}</>}
            </p>
          </div>
        </div>
        <Link to={`/products/${id}/edit`}
          className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex-shrink-0">
          Edit
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className={`rounded-xl border p-4 ${
          product.status === 'out_of_stock' ? 'border-red-200 bg-red-50'
          : product.status === 'low_stock' ? 'border-amber-200 bg-amber-50'
          : 'border-gray-200 bg-white'
        }`}>
          <p className="text-xs text-gray-500 font-medium mb-1">Current Stock</p>
          <p className={`text-3xl font-bold ${
            product.status === 'out_of_stock' ? 'text-red-700'
            : product.status === 'low_stock' ? 'text-amber-700'
            : 'text-gray-900'
          }`}>{product.currentStock}</p>
          <p className="text-xs text-gray-400 mt-0.5">{product.unit} | Min: {product.minStockLevel}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-medium mb-1">Total Stock In</p>
          <p className="text-3xl font-bold text-green-700">{product.totalStockIn}</p>
          <p className="text-xs text-gray-400 mt-0.5">{product.unit} received</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-medium mb-1">Total Stock Out</p>
          <p className="text-3xl font-bold text-red-700">{product.totalStockOut}</p>
          <p className="text-xs text-gray-400 mt-0.5">{product.unit} dispatched</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-medium mb-1">Stock Value</p>
          <p className="text-2xl font-bold text-primary-700">
            {product.stockValue > 0 ? `$${product.stockValue.toLocaleString('en-US')}` : '—'}
          </p>
          {product.price > 0 && <p className="text-xs text-gray-400 mt-0.5">@ ${product.price}/unit</p>}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => navigate('/stock/in', { state: { prefillProductId: id, prefillProductName: product.name } })}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
        >
          + New Stock In
        </button>
        <button
          onClick={() => { if (product.currentStock > 0) navigate('/stock/out', { state: { prefillProductId: id, prefillProductName: product.name } }) }}
          disabled={product.currentStock === 0}
          title={product.currentStock === 0 ? 'Stock unavailable' : undefined}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + New Stock Out
        </button>
      </div>

      {/* Transaction history */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Transaction History</h2>
            <p className="text-xs text-gray-400 mt-0.5">{transactions.length} most recent transactions</p>
          </div>
        </div>
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No transactions yet for this product</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Qty</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vendor / Buyer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Unit Price</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((tx) => (
                <tr key={tx.id} className={`hover:bg-gray-50 ${tx.type === 'OUT' ? 'bg-red-50/20' : tx.type === 'IN' ? 'bg-green-50/20' : ''}`}>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap text-xs">
                    {new Date(tx.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">{txTypeBadge(tx.type)}</td>
                  <td className={`px-4 py-3 text-right font-bold tabular-nums ${tx.type === 'OUT' ? 'text-red-600' : 'text-green-600'}`}>
                    {tx.type === 'OUT' ? '-' : '+'}{tx.quantity}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {tx.vendor
                      ? <Link to={`/vendors/${tx.vendor.id}`} className="text-blue-600 hover:underline">{tx.vendor.name}</Link>
                      : tx.buyer
                        ? <Link to={`/buyers/${tx.buyer.id}`} className="text-blue-600 hover:underline">{tx.buyer.name}</Link>
                        : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {tx.unitPrice != null ? `$${tx.unitPrice.toLocaleString('en-US')}` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px] truncate">
                    {tx.notes ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {tx.by ?? <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
