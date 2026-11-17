import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { productsApi, Product } from '../services/products'
import BackButton from '../components/BackButton'
import Breadcrumbs from '../components/Breadcrumbs'

export default function ProductsPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 20

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, categoryId, inStockOnly])

  const params: Record<string, string | number> = { page, limit }
  if (debouncedSearch) params.search = debouncedSearch
  if (categoryId) params.categoryId = categoryId
  if (inStockOnly) params.inStock = '1'

  const { data, isLoading } = useQuery({
    queryKey: ['products', params],
    queryFn: () => productsApi.list(params),
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => productsApi.categories(),
  })

  const products = data?.products ?? []
  const total = data?.total ?? 0
  const pages = data?.pages ?? 1
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  function stockBadge(product: Product) {
    const qty = product.inventory?.quantity ?? 0
    const low = qty <= product.minStockLevel
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          low ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        }`}
      >
        {qty}
      </span>
    )
  }

  return (
    <div className="p-6">
      <BackButton to="/dashboard" />
      <Breadcrumbs crumbs={[{ label: 'Products' }]} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Products</h1>
        <Link
          to="/products/new"
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          + Add Product
        </Link>
      </div>

      {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Categories</option>
            {(categories ?? []).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="rounded border-gray-300 text-primary-600"
            />
            In Stock Only
          </label>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No products found</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Unit</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Stock Qty</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Price ($)</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{product.name}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{product.sku}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {product.category?.name ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{product.unit}</td>
                    <td className="px-4 py-3">{stockBadge(product)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {product.price != null ? `$${product.price}` : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/products/${product.id}/edit`}
                        className="text-primary-600 hover:text-primary-800 font-medium"
                      >
                        Edit
                      </Link>
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
                Showing {from}–{to} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Prev
                </button>
                <button
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
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
