import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Package,
  TrendingUp,
  AlertTriangle,
  XCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Boxes,
  BarChart3,
} from 'lucide-react'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Area,
  AreaChart,
} from 'recharts'
import { reportsApi } from '../services/reports'

function formatChartDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatCurrency(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
  return `$${value}`
}

interface StatCardProps {
  label: string
  value: string | number
  loading: boolean
  icon: React.ElementType
  iconBg: string
  iconColor: string
  alert?: boolean
}

function StatCard({ label, value, loading, icon: Icon, iconBg, iconColor, alert }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0 ${iconBg}`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${alert ? 'text-red-600' : 'text-gray-900'}`}>
          {loading ? <span className="text-gray-300">—</span> : value}
        </p>
      </div>
    </div>
  )
}

interface QuickLinkProps {
  to: string
  icon: React.ElementType
  label: string
  color: string
}

function QuickLink({ to, icon: Icon, label, color }: QuickLinkProps) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-transparent hover:border-current transition-all ${color}`}
    >
      <Icon className="w-6 h-6" />
      <span className="text-xs font-semibold">{label}</span>
    </Link>
  )
}

export default function DashboardPage() {
  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(today.getDate() - 7)

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['reports-stock-summary'],
    queryFn: reportsApi.getStockSummary,
  })

  const { data: movementData } = useQuery({
    queryKey: ['reports-movement-30d'],
    queryFn: () =>
      reportsApi.getStockMovement({
        dateFrom: thirtyDaysAgo.toISOString(),
        dateTo: today.toISOString(),
      }),
  })

  const { data: topMovedData } = useQuery({
    queryKey: ['reports-top-moved'],
    queryFn: () => reportsApi.getTopProducts({ limit: 8, type: 'most-moved' }),
  })

  const { data: lowStockData } = useQuery({
    queryKey: ['reports-low-stock'],
    queryFn: reportsApi.getLowStockReport,
  })

  const chartMovement = (movementData?.movement ?? []).map((m) => ({
    ...m,
    date: formatChartDate(m.date),
  }))

  const chartTopProducts = (topMovedData?.products ?? []).map((p) => ({
    name: p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name,
    value: p.value,
  }))

  const lowStockItems = lowStockData?.products?.slice(0, 6) ?? []

  const totalProducts = summaryData?.totalProducts ?? 0
  const inventoryValue = Number(summaryData?.totalInventoryValue ?? 0)
  const lowStockCount = summaryData?.lowStockCount ?? 0
  const outOfStockCount = summaryData?.outOfStockCount ?? 0

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Products"
          value={totalProducts}
          loading={summaryLoading}
          icon={Package}
          iconBg="bg-primary-100"
          iconColor="text-primary-600"
        />
        <StatCard
          label="Inventory Value"
          value={formatCurrency(inventoryValue)}
          loading={summaryLoading}
          icon={TrendingUp}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
        />
        <StatCard
          label="Low Stock"
          value={lowStockCount}
          loading={summaryLoading}
          icon={AlertTriangle}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          alert={lowStockCount > 0}
        />
        <StatCard
          label="Out of Stock"
          value={outOfStockCount}
          loading={summaryLoading}
          icon={XCircle}
          iconBg="bg-red-100"
          iconColor="text-red-500"
          alert={outOfStockCount > 0}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Stock Movement — Area Chart (wider) */}
        <div className="xl:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-800">Stock Movement — Last 30 Days</h2>
            <Link to="/stock/transactions" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
              View all →
            </Link>
          </div>
          {chartMovement.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-sm text-gray-400">
              No movement data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartMovement} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Area type="monotone" dataKey="totalIn" name="Stock In" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorIn)" dot={false} />
                <Area type="monotone" dataKey="totalOut" name="Stock Out" stroke="#ef4444" strokeWidth={2} fill="url(#colorOut)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Products — Horizontal Bar */}
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-800">Most Moved Products</h2>
            <Link to="/reports" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
              View all →
            </Link>
          </div>
          {chartTopProducts.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-sm text-gray-400">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                layout="vertical"
                data={chartTopProducts}
                margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} width={100} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Bar dataKey="value" name="Qty Moved" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Low Stock Table */}
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Low Stock Alert</h2>
            <Link to="/inventory" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
              View inventory →
            </Link>
          </div>
          {lowStockItems.length === 0 && !summaryLoading ? (
            <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium py-4">
              <span className="text-lg">✓</span> All products are well-stocked
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left pb-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                    <th className="text-left pb-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">SKU</th>
                    <th className="text-center pb-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                    <th className="text-center pb-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Min</th>
                    <th className="text-left pb-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.map((item) => {
                    const isOut = item.quantityOnHand === 0
                    return (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-primary-50/40 transition-colors">
                        <td className="py-2.5 px-2 font-medium text-gray-900 max-w-[160px] truncate">{item.name}</td>
                        <td className="py-2.5 px-2 font-mono text-xs text-gray-500">{item.sku}</td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`font-bold ${isOut ? 'text-red-600' : 'text-amber-600'}`}>
                            {item.quantityOnHand}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center text-gray-500">{item.minStockLevel}</td>
                        <td className="py-2.5 px-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            isOut
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {isOut ? 'Out of Stock' : 'Low Stock'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickLink
              to="/stock/in"
              icon={ArrowDownToLine}
              label="Stock In"
              color="text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
            />
            <QuickLink
              to="/stock/out"
              icon={ArrowUpFromLine}
              label="Stock Out"
              color="text-red-600 bg-red-50 hover:bg-red-100"
            />
            <QuickLink
              to="/stock/transactions"
              icon={ArrowLeftRight}
              label="Transactions"
              color="text-primary-600 bg-primary-50 hover:bg-primary-100"
            />
            <QuickLink
              to="/inventory"
              icon={Boxes}
              label="Inventory"
              color="text-blue-600 bg-blue-50 hover:bg-blue-100"
            />
            <QuickLink
              to="/products"
              icon={Package}
              label="Products"
              color="text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
            />
            <QuickLink
              to="/reports"
              icon={BarChart3}
              label="Reports"
              color="text-violet-600 bg-violet-50 hover:bg-violet-100"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
