import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { stockApi } from '../services/stock'
import BackButton from '../components/BackButton'
import Breadcrumbs from '../components/Breadcrumbs'
import ExportButton from '../components/ExportButton'
import { exportService, ExportFormat } from '../services/exportImport'

export default function InventoryPage() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => stockApi.getInventory(),
  })

  const inventory = data?.inventory ?? []
  const lowStockCount = data?.lowStockCount ?? 0
  const total = data?.total ?? 0

  const totalUnits = inventory.reduce((sum, item) => sum + item.quantityOnHand, 0)

  const filtered = search
    ? inventory.filter(
        (item) =>
          item.product.name.toLowerCase().includes(search.toLowerCase()) ||
          item.product.sku.toLowerCase().includes(search.toLowerCase())
      )
    : inventory

  return (
    <div className="p-6">
      <BackButton to="/dashboard" />
      <Breadcrumbs crumbs={[{ label: 'Inventory' }]} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Inventory</h1>
        <ExportButton
          onExport={(fmt: ExportFormat) => exportService.inventory(fmt, search ? { search } : {})}
          label="Export"
        />
      </div>

        {/* Summary bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Total Products</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{total}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Low Stock</p>
            <p className="text-3xl font-bold mt-1">
              <span className={lowStockCount > 0 ? 'text-red-600' : 'text-gray-900'}>
                {lowStockCount}
              </span>
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Total Units on Hand</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{totalUnits.toLocaleString()}</p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              {search ? 'No products match your search.' : 'No inventory data found.'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Product Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Vendor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Unit</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Qty on Hand</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Min Stock</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className={item.isLowStock ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{item.product.name}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{item.product.sku}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {item.product.category?.name ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {item.product.vendor?.name ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.product.unit}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{item.quantityOnHand}</td>
                    <td className="px-4 py-3 text-gray-600">{item.product.minStockLevel}</td>
                    <td className="px-4 py-3">
                      {item.isLowStock ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          OK
                        </span>
                      )}
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
