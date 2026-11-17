import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, FileDown } from 'lucide-react'
import { reportsApi } from '../services/reports'
import { productsApi } from '../services/products'
import { exportService } from '../services/exportImport'
import ExportButton from '../components/ExportButton'
import BackButton from '../components/BackButton'
import Breadcrumbs from '../components/Breadcrumbs'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

function fmtRs(val: number) {
  return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}
function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10)
}
function today() { return new Date().toISOString().slice(0, 10) }

type QuickFilter = 'all' | '7d' | '30d' | '3m' | 'custom'

function useDateRange(defaultQuick: QuickFilter = '30d') {
  const [quick, setQuick] = useState<QuickFilter>(defaultQuick)
  const [from, setFrom] = useState(() => daysAgo(30))
  const [to, setTo] = useState(() => today())

  function applyQuick(q: QuickFilter) {
    setQuick(q)
    if (q === '7d') { setFrom(daysAgo(7)); setTo(today()) }
    else if (q === '30d') { setFrom(daysAgo(30)); setTo(today()) }
    else if (q === '3m') { setFrom(daysAgo(90)); setTo(today()) }
    else if (q === 'all') { setFrom(''); setTo('') }
  }

  const apiParams = quick === 'all' ? {} : { dateFrom: from, dateTo: to }
  const label = quick === 'all' ? 'All Time'
    : quick === '7d' ? 'Last 7 days'
    : quick === '30d' ? 'Last 30 days'
    : quick === '3m' ? 'Last 3 months'
    : `${from} to ${to}`

  return { quick, setQuick, from, setFrom, to, setTo, applyQuick, apiParams, label }
}

function QuickDateBar({ state, noAll }: { state: ReturnType<typeof useDateRange>; noAll?: boolean }) {
  const { quick, applyQuick, from, setFrom, to, setTo, setQuick } = state
  const btns: { v: QuickFilter; l: string }[] = [
    ...(noAll ? [] : [{ v: 'all' as QuickFilter, l: 'All Time' }]),
    { v: '7d', l: '7 days' }, { v: '30d', l: '30 days' }, { v: '3m', l: '3 months' }, { v: 'custom', l: 'Custom' },
  ]
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {btns.map(b => (
        <button key={b.v} onClick={() => applyQuick(b.v)}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${quick === b.v ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          {b.l}
        </button>
      ))}
      {quick === 'custom' && (
        <div className="flex items-center gap-1.5">
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setQuick('custom') }}
            className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400" />
          <span className="text-gray-400 text-xs">–</span>
          <input type="date" value={to} onChange={e => { setTo(e.target.value); setQuick('custom') }}
            className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400" />
        </div>
      )}
    </div>
  )
}

function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      {children}
    </div>
  )
}

export default function ReportsPage() {
  // Movement chart dates
  const [mvFrom, setMvFrom] = useState(() => daysAgo(30))
  const [mvTo, setMvTo] = useState(() => today())

  // PDF state
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfToast, setPdfToast] = useState('')

  // Report date range for PDF
  const [pdfFrom, setPdfFrom] = useState(() => daysAgo(30))
  const [pdfTo, setPdfTo] = useState(() => today())

  // Section date ranges
  const vendorDR = useDateRange('30d')
  const buyerDR = useDateRange('30d')
  const prodCatId = (() => {
    const [id, setId] = useState(''); return { id, setId }
  })()

  const { data: summaryData, isLoading: sumLoading } = useQuery({
    queryKey: ['reports-summary'], queryFn: reportsApi.getStockSummary,
  })
  const { data: movementData, isLoading: mvLoading } = useQuery({
    queryKey: ['reports-movement', mvFrom, mvTo],
    queryFn: () => reportsApi.getStockMovement({ dateFrom: mvFrom, dateTo: mvTo }),
  })
  const { data: vendorData, isLoading: vendorLoading } = useQuery({
    queryKey: ['reports-vendor', vendorDR.apiParams],
    queryFn: () => reportsApi.getVendorSummary(vendorDR.apiParams),
  })
  const { data: buyerData, isLoading: buyerLoading } = useQuery({
    queryKey: ['reports-buyer', buyerDR.apiParams],
    queryFn: () => reportsApi.getBuyerReport(buyerDR.apiParams),
  })
  const { data: productData, isLoading: productLoading } = useQuery({
    queryKey: ['reports-product', prodCatId.id],
    queryFn: () => reportsApi.getProductReport(prodCatId.id ? { categoryId: prodCatId.id } : {}),
  })
  const { data: lowStockData } = useQuery({
    queryKey: ['reports-low-stock'], queryFn: reportsApi.getLowStockReport,
  })
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'], queryFn: () => productsApi.categories(),
  })

  const chartData = (movementData?.movement ?? []).map(m => ({
    ...m,
    date: new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))
  const totalIn = (movementData?.movement ?? []).reduce((s, m) => s + Number(m.totalIn), 0)
  const totalOut = (movementData?.movement ?? []).reduce((s, m) => s + Number(m.totalOut), 0)

  async function handlePdf() {
    setPdfLoading(true)
    setPdfToast('')
    try {
      await exportService.fullReportPdf(pdfFrom, pdfTo)
      setPdfToast('PDF downloaded successfully!')
    } catch {
      setPdfToast('PDF generation failed. Try with a smaller date range.')
    } finally {
      setPdfLoading(false)
      setTimeout(() => setPdfToast(''), 4000)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <BackButton to="/dashboard" />
      <Breadcrumbs crumbs={[{ label: 'Reports' }]} />

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <input type="date" value={pdfFrom} onChange={e => setPdfFrom(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs" />
            <span>–</span>
            <input type="date" value={pdfTo} onChange={e => setPdfTo(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs" />
          </div>
          <ExportButton label="Full Report Excel"
            onExport={async () => { await exportService.fullReportXlsx(pdfFrom, pdfTo) }} />
          <button onClick={handlePdf} disabled={pdfLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors">
            {pdfLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating PDF...</>
              : <><FileDown className="w-4 h-4" /> Save as PDF</>
            }
          </button>
        </div>
      </div>

      {pdfToast && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${pdfToast.includes('failed') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
          {pdfToast}
        </div>
      )}

      <div className="space-y-6">

        {/* ── STOCK SUMMARY ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Stock Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">Total Products</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{sumLoading ? '—' : summaryData?.totalProducts ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Inventory Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {sumLoading ? '—' : summaryData?.totalInventoryValue != null ? fmtRs(summaryData.totalInventoryValue) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Low Stock Items</p>
              <p className={`text-2xl font-bold mt-1 ${(summaryData?.lowStockCount ?? 0) > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {sumLoading ? '—' : summaryData?.lowStockCount ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Out of Stock</p>
              <p className={`text-2xl font-bold mt-1 ${(summaryData?.outOfStockCount ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {sumLoading ? '—' : summaryData?.outOfStockCount ?? '—'}
              </p>
            </div>
          </div>
        </div>

        {/* ── STOCK MOVEMENT CHART ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Stock Movement</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-gray-500">From</label>
              <input type="date" value={mvFrom} onChange={e => setMvFrom(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
              <label className="text-xs text-gray-500">To</label>
              <input type="date" value={mvTo} onChange={e => setMvTo(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
              <ExportButton onExport={async (fmt) => {
                await exportService.transactions(fmt, { type: 'ALL', dateFrom: mvFrom, dateTo: mvTo })
              }} />
            </div>
          </div>
          {mvLoading ? (
            <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">Loading...</div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">No movement data for selected range</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="totalIn" name="Stock In" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="totalOut" name="Stock Out" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-3 flex gap-6 text-sm border-t border-gray-100 pt-3">
                <div><span className="text-gray-500">Total IN: </span><span className="font-semibold text-blue-600">{totalIn}</span></div>
                <div><span className="text-gray-500">Total OUT: </span><span className="font-semibold text-red-600">{totalOut}</span></div>
                <div><span className="text-gray-500">Net: </span>
                  <span className={`font-semibold ${totalIn - totalOut >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalIn - totalOut >= 0 ? '+' : ''}{totalIn - totalOut}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── VENDOR REPORT ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionHeader title="Vendor Report">
            <ExportButton onExport={async (fmt) => {
              await exportService.vendors(fmt, vendorDR.apiParams as Record<string, string>)
            }} />
          </SectionHeader>
          <div className="mb-4"><QuickDateBar state={vendorDR} /></div>
          <p className="text-xs text-gray-400 mb-3">{vendorDR.label}</p>
          {vendorLoading ? (
            <p className="text-sm text-gray-400 py-6 text-center">Loading vendor data...</p>
          ) : !vendorData?.vendors?.length ? (
            <p className="text-sm text-gray-400 py-6 text-center">No vendor data for this period</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Vendor Name</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">City</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Orders</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Units</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Total Value</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Last Purchase</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vendorData.vendors.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">
                        <Link to={`/vendors/${v.id}`} className="text-primary-600 hover:underline">{v.name}</Link>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{v.city ?? '—'}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{v.totalOrders}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{v.totalUnits}</td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-900">{fmtRs(v.totalValue)}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{fmtDate(v.lastPurchaseDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── BUYER REPORT ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionHeader title="Customer / Buyer Report">
            <ExportButton onExport={async (fmt) => {
              await exportService.buyers(fmt, buyerDR.apiParams as Record<string, string>)
            }} />
          </SectionHeader>
          <div className="mb-4"><QuickDateBar state={buyerDR} /></div>
          <p className="text-xs text-gray-400 mb-3">{buyerDR.label}</p>
          {buyerLoading ? (
            <p className="text-sm text-gray-400 py-6 text-center">Loading buyer data...</p>
          ) : !buyerData?.buyers?.length ? (
            <p className="text-sm text-gray-400 py-6 text-center">No buyer data for this period</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Buyer Name</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">City</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Orders</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Units</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Total Value</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Last Sale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {buyerData.buyers.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">
                        <Link to={`/buyers/${b.id}`} className="text-blue-600 hover:underline">{b.name}</Link>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{b.city ?? '—'}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{b.totalOrders}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{b.totalUnits}</td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-900">{fmtRs(b.totalValue)}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{fmtDate(b.lastSaleDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── PRODUCT-WISE REPORT ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionHeader title="Product-wise Report">
            <ExportButton onExport={async (fmt) => {
              await exportService.products(fmt, prodCatId.id ? { categoryId: prodCatId.id } : undefined)
            }} />
          </SectionHeader>
          <div className="mb-4 flex items-center gap-3">
            <select value={prodCatId.id} onChange={e => prodCatId.setId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">All Categories</option>
              {(categoriesData ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {productLoading ? (
            <p className="text-sm text-gray-400 py-6 text-center">Loading product data...</p>
          ) : !productData?.products?.length ? (
            <p className="text-sm text-gray-400 py-6 text-center">No products found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Product</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">SKU</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Category</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Current Stock</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Total IN</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Total OUT</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Stock Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {productData.products.map(p => {
                    const low = p.currentStock <= p.minStockLevel && p.minStockLevel > 0
                    const out = p.currentStock === 0
                    return (
                      <tr key={p.id} className={`hover:bg-gray-50 ${out ? 'bg-red-50/40' : low ? 'bg-amber-50/40' : ''}`}>
                        <td className="px-3 py-2 font-medium text-gray-900">{p.name}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.sku}</td>
                        <td className="px-3 py-2 text-gray-600">{p.category ?? '—'}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${out ? 'text-red-600' : low ? 'text-amber-600' : 'text-gray-900'}`}>
                          {p.currentStock}
                          {out && <span className="ml-1 text-xs font-normal bg-red-100 text-red-600 px-1 rounded">OUT</span>}
                          {!out && low && <span className="ml-1 text-xs font-normal bg-amber-100 text-amber-600 px-1 rounded">LOW</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-green-700 font-medium">+{p.totalIn}</td>
                        <td className="px-3 py-2 text-right text-red-700 font-medium">-{p.totalOut}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmtRs(p.stockValue)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── LOW STOCK REPORT ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionHeader title="Low Stock Report">
            <ExportButton onExport={async (fmt) => {
              await exportService.products(fmt, { inStock: 'false' })
            }} />
          </SectionHeader>
          {!lowStockData?.products?.length ? (
            <p className="text-sm text-green-600 font-medium">All products are well-stocked ✓</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Product</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">SKU</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Current Qty</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Min Stock</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Vendor</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lowStockData.products.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">{item.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{item.sku}</td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-700">{item.quantityOnHand}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{item.minStockLevel}</td>
                      <td className="px-3 py-2 text-gray-600">{item.vendorName || '—'}</td>
                      <td className="px-3 py-2">
                        {item.quantityOnHand === 0
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">OUT OF STOCK</span>
                          : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">LOW STOCK</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-2">{lowStockData.total} items</p>
            </div>
          )}
        </div>

        {/* ── TRANSACTION EXPORT ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Transaction Export</h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-gray-600">From</label>
            <input type="date" value={pdfFrom} onChange={e => setPdfFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
            <label className="text-sm text-gray-600">To</label>
            <input type="date" value={pdfTo} onChange={e => setPdfTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
            <ExportButton label="Export Transactions"
              onExport={async (fmt) => {
                await exportService.transactions(fmt, { dateFrom: pdfFrom, dateTo: pdfTo })
              }} />
          </div>
          <p className="text-xs text-gray-400 mt-2">Exports all transactions for the selected date range as Excel/CSV.</p>
        </div>

      </div>
    </div>
  )
}
