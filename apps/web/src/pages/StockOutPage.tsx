import { useState, useMemo, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v3'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Printer, PackageMinus, AlertCircle } from 'lucide-react'
import { stockApi, StockTransaction } from '../services/stock'
import { productsApi } from '../services/products'
import { buyersApi, Buyer } from '../services/buyers'
import axios from 'axios'
import { generateId } from '../utils/uuid'
import BackButton from '../components/BackButton'
import Breadcrumbs from '../components/Breadcrumbs'
import ProductCombobox from '../components/ProductCombobox'
import { useAuth } from '../contexts/AuthContext'

function today() {
  return new Date().toISOString().slice(0, 10)
}

const schema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z.coerce.number().int().min(1, 'Min 1'),
  buyerName: z.string().optional(),
  buyerId: z.string().optional(),
  serialNo: z.string().optional(),
  issuedTo: z.string().optional(),
  transactionDate: z.string().min(1, 'Date is required'),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>
type BuyerBlurState = 'idle' | 'checking' | 'suggest_single' | 'suggest_multiple'

function calcScore(query: string, name: string): number {
  const q = query.toLowerCase().trim()
  const n = name.toLowerCase().trim()
  if (!q) return 0
  if (q === n) return 1.0
  if (n.startsWith(q) || q.startsWith(n)) return 0.9
  if (n.includes(q) || q.includes(n)) return 0.85
  const qw = q.split(/\s+/).filter(Boolean)
  const nw = new Set(n.split(/\s+/).filter(Boolean))
  const common = qw.filter((w) => nw.has(w)).length
  return common === 0 ? 0 : (common / Math.max(qw.length, nw.size)) * 0.75
}

interface SlipData {
  slipNo: string
  product: { name: string; sku: string }
  quantity: number
  serialNo: string
  buyerName: string
  issuedTo: string
  notes: string
  issuedBy: string
  date: string
  time: string
  txDate: string
}

function PrintSlip({ slip }: { slip: SlipData }) {
  return (
    <div id="print-slip" className="preview-visible">
      <div style={{ textAlign: 'center', borderBottom: '2px solid #1E1B4B', paddingBottom: '10px', marginBottom: '14px' }}>
        <div style={{ fontWeight: 700, fontSize: '17px', letterSpacing: '0.5px', color: '#1E1B4B' }}>ACME SYSTEMS</div>
        <div style={{ fontSize: '11px', color: '#777', marginTop: '2px' }}>Stock Issue Slip</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '10px' }}>
        <tbody>
          <tr>
            <td style={{ color: '#666', width: '38%', padding: '3px 0', fontWeight: 500 }}>Slip No.</td>
            <td style={{ fontWeight: 700, color: '#1E1B4B' }}>{slip.slipNo}</td>
          </tr>
          <tr>
            <td style={{ color: '#666', padding: '3px 0', fontWeight: 500 }}>Issue Date</td>
            <td>{slip.txDate}</td>
          </tr>
          <tr>
            <td style={{ color: '#666', padding: '3px 0', fontWeight: 500 }}>Entry Time</td>
            <td>{slip.date} {slip.time}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ borderTop: '1px dashed #ccc', margin: '10px 0' }} />

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '10px' }}>
        <tbody>
          <tr>
            <td style={{ color: '#666', width: '38%', padding: '3px 0', fontWeight: 500 }}>Product</td>
            <td style={{ fontWeight: 700 }}>{slip.product.name}</td>
          </tr>
          <tr>
            <td style={{ color: '#666', padding: '3px 0', fontWeight: 500 }}>SKU</td>
            <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>{slip.product.sku}</td>
          </tr>
          {slip.serialNo && (
            <tr>
              <td style={{ color: '#666', padding: '3px 0', fontWeight: 500 }}>Serial No.</td>
              <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>{slip.serialNo}</td>
            </tr>
          )}
          <tr>
            <td style={{ color: '#666', padding: '3px 0', fontWeight: 500 }}>Qty Issued</td>
            <td style={{ fontWeight: 700, fontSize: '14px', color: '#c0392b' }}>{slip.quantity} pcs</td>
          </tr>
        </tbody>
      </table>

      <div style={{ borderTop: '1px dashed #ccc', margin: '10px 0' }} />

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '12px' }}>
        <tbody>
          {slip.buyerName && (
            <tr>
              <td style={{ color: '#666', width: '38%', padding: '3px 0', fontWeight: 500 }}>Buyer</td>
              <td style={{ fontWeight: 600 }}>{slip.buyerName}</td>
            </tr>
          )}
          {slip.issuedTo && (
            <tr>
              <td style={{ color: '#666', padding: '3px 0', fontWeight: 500 }}>Issued To</td>
              <td style={{ fontWeight: 600 }}>{slip.issuedTo}</td>
            </tr>
          )}
          <tr>
            <td style={{ color: '#666', padding: '3px 0', fontWeight: 500 }}>Issued By</td>
            <td style={{ fontWeight: 600 }}>{slip.issuedBy}</td>
          </tr>
          {slip.notes && (
            <tr>
              <td style={{ color: '#666', padding: '3px 0', fontWeight: 500 }}>Notes</td>
              <td>{slip.notes}</td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '28px' }}>
        <div style={{ borderTop: '1px solid #333', paddingTop: '4px', textAlign: 'center', fontSize: '11px', color: '#666' }}>
          Issued By Signature
        </div>
        <div style={{ borderTop: '1px solid #333', paddingTop: '4px', textAlign: 'center', fontSize: '11px', color: '#666' }}>
          Received By Signature
        </div>
      </div>
    </div>
  )
}

export default function StockOutPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const prefillProductId = (location.state as any)?.prefillProductId as string | undefined
  const qc = useQueryClient()
  const [errorMsg, setErrorMsg] = useState('')
  const [slip, setSlip] = useState<SlipData | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(() => generateId())
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Buyer autosuggest
  const [buyerQuery, setBuyerQuery] = useState('')
  const [debouncedBuyerQuery, setDebouncedBuyerQuery] = useState('')
  const [buyerDropOpen, setBuyerDropOpen] = useState(false)
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null)
  const buyerInputRef = useRef<HTMLInputElement>(null)
  const buyerDropRef = useRef<HTMLDivElement>(null)
  const [buyerBlurState, setBuyerBlurState] = useState<BuyerBlurState>('idle')
  const [buyerBlurSuggestions, setBuyerBlurSuggestions] = useState<Buyer[]>([])

  // New buyer form
  const [newBuyerMode, setNewBuyerMode] = useState(false)
  const [saveAsNewBuyer, setSaveAsNewBuyer] = useState(true)
  const [newBuyerPhone, setNewBuyerPhone] = useState('')
  const [newBuyerEmail, setNewBuyerEmail] = useState('')
  const [newBuyerCity, setNewBuyerCity] = useState('')
  const [newBuyerAddress, setNewBuyerAddress] = useState('')

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { transactionDate: today() },
  })

  // Debounce buyer search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedBuyerQuery(buyerQuery), 250)
    return () => clearTimeout(t)
  }, [buyerQuery])

  const { data: buyerResults } = useQuery({
    queryKey: ['buyers-search', debouncedBuyerQuery],
    queryFn: () => buyersApi.search(debouncedBuyerQuery),
    enabled: debouncedBuyerQuery.length >= 1,
  })
  const buyerSuggestions = buyerResults?.buyers ?? []

  // Close buyer dropdown on outside click
  useEffect(() => {
    function onMousedown(e: MouseEvent) {
      if (
        buyerDropRef.current && !buyerDropRef.current.contains(e.target as Node) &&
        buyerInputRef.current && !buyerInputRef.current.contains(e.target as Node)
      ) {
        setBuyerDropOpen(false)
      }
    }
    document.addEventListener('mousedown', onMousedown)
    return () => document.removeEventListener('mousedown', onMousedown)
  }, [])

  const { data: productsData } = useQuery({
    queryKey: ['products', { limit: 200 }],
    queryFn: () => productsApi.list({ limit: 200 }),
  })

  const { data: inventoryData } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => stockApi.getInventory(),
    refetchOnWindowFocus: true,
  })

  const selectedProductId = watch('productId') ?? ''
  const quantityValue = Number(watch('quantity')) || 0

  // Pre-fill product from navigation state (e.g. from GlobalSearch)
  useEffect(() => {
    if (prefillProductId && productsData?.products?.some((p) => p.id === prefillProductId)) {
      setValue('productId', prefillProductId, { shouldValidate: true })
      window.history.replaceState({}, '')
    }
  }, [prefillProductId, productsData])

  // Only products with stock > 0, with stock count attached
  const products = useMemo(() => {
    const allProducts = productsData?.products ?? []
    const inventory = inventoryData?.inventory ?? []
    return allProducts
      .map((p) => {
        const inv = inventory.find((i) => i.productId === p.id)
        return { id: p.id, name: p.name, sku: p.sku, stock: inv?.quantityOnHand ?? 0 }
      })
      .filter((p) => p.stock > 0)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [productsData, inventoryData])

  // Available stock for selected product
  const availableStock = useMemo(() => {
    if (!selectedProductId) return null
    const item = inventoryData?.inventory.find((i) => i.productId === selectedProductId)
    return item?.quantityOnHand ?? null
  }, [selectedProductId, inventoryData])

  // Real-time stock error — fires as user types
  const realtimeStockError = useMemo(() => {
    if (availableStock === null || quantityValue <= 0) return null
    if (quantityValue > availableStock) {
      return `Only ${availableStock} unit${availableStock !== 1 ? 's' : ''} available in stock`
    }
    return null
  }, [quantityValue, availableStock])

  async function handleBuyerBlur() {
    if (selectedBuyer || newBuyerMode) return
    const q = buyerQuery.trim()
    if (!q) return

    setBuyerBlurState('checking')
    setBuyerDropOpen(false)
    try {
      const result = await buyersApi.search(q)
      const buyers = result.buyers ?? []
      const scored = buyers
        .map((b) => ({ buyer: b, score: calcScore(q, b.name) }))
        .filter((x) => x.score >= 0.6)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

      const exactMatch = scored.find((x) => x.score === 1.0)
      if (exactMatch) {
        setSelectedBuyer(exactMatch.buyer)
        setBuyerQuery(exactMatch.buyer.name)
        setValue('buyerName', exactMatch.buyer.name)
        setValue('buyerId', exactMatch.buyer.id)
        setBuyerBlurState('idle')
        return
      }

      if (scored.length === 0) {
        setBuyerBlurSuggestions([])
        setBuyerBlurState('idle')
        setNewBuyerMode(true)
      } else if (scored.length === 1 || scored[0].score >= 0.85) {
        setBuyerBlurSuggestions([scored[0].buyer])
        setBuyerBlurState('suggest_single')
      } else {
        setBuyerBlurSuggestions(scored.map((x) => x.buyer))
        setBuyerBlurState('suggest_multiple')
      }
    } catch {
      setBuyerBlurState('idle')
    }
  }

  const mutation = useMutation({
    mutationFn: (data: FormValues & { resolvedBuyerId?: string }) =>
      stockApi.stockOut({
        productId: data.productId,
        quantity: data.quantity,
        buyerName: buyerQuery || data.buyerName || undefined,
        buyerId: data.resolvedBuyerId || data.buyerId || undefined,
        serialNo: data.serialNo || undefined,
        issuedTo: data.issuedTo || undefined,
        transactionDate: data.transactionDate,
        notes: data.notes || undefined,
        idempotencyKey,
      }),
    onSuccess: (res, variables) => {
      const tx: StockTransaction = res.transaction
      const now = new Date()
      const product = products.find((p) => p.id === variables.productId)
      const txDate = new Date(variables.transactionDate)
      setSlip({
        slipNo: `ISS-${txDate.getFullYear()}-${tx.id.slice(-6).toUpperCase()}`,
        product: { name: product?.name ?? 'Unknown', sku: product?.sku ?? '—' },
        quantity: variables.quantity,
        serialNo: variables.serialNo ?? '',
        buyerName: variables.buyerName ?? '',
        issuedTo: variables.issuedTo ?? '',
        notes: variables.notes ?? '',
        issuedBy: user?.name ?? 'Admin',
        date: now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        txDate: txDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }),
      })
      setErrorMsg('')
      reset({ transactionDate: today() })
      setIdempotencyKey(generateId())
      setBuyerQuery('')
      setSelectedBuyer(null)
      setNewBuyerMode(false)
      setSaveAsNewBuyer(true)
      setBuyerBlurState('idle')
      setBuyerBlurSuggestions([])
      setNewBuyerPhone(''); setNewBuyerEmail(''); setNewBuyerCity(''); setNewBuyerAddress('')
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err)) {
        const msg: string = err.response?.data?.message ?? ''
        if (err.response?.status === 400 && msg.toLowerCase().includes('insufficient')) {
          setErrorMsg(msg || 'Insufficient stock.')
        } else {
          setErrorMsg(msg || 'Failed to issue stock.')
        }
      } else {
        setErrorMsg('Something went wrong.')
      }
    },
  })

  return (
    <div className="p-6 max-w-2xl">
      <BackButton to="/dashboard" />
      <Breadcrumbs crumbs={[{ label: 'Stock Out' }]} />

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-red-100 rounded-lg">
          <PackageMinus className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Issue Stock</h1>
          <p className="text-xs text-gray-500">Record stock going out of inventory</p>
        </div>
      </div>

      {/* Success slip */}
      {slip && (
        <div className="mb-6">
          <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center justify-between">
            <span className="font-medium">✓ Stock issued successfully</span>
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Slip
              </button>
              <button
                onClick={() => navigate('/stock/transactions')}
                className="px-3 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                View All
              </button>
            </div>
          </div>
          <PrintSlip slip={slip} />
          <button onClick={() => setSlip(null)} className="mt-3 text-xs text-gray-500 hover:text-gray-700 underline">
            Issue another
          </button>
        </div>
      )}

      {!slip && (
        <form onSubmit={handleSubmit(async (d) => {
          setIsSubmitting(true)
          let resolvedBuyerId = d.buyerId || undefined
          if (newBuyerMode && saveAsNewBuyer && buyerQuery.trim()) {
            try {
              const created = await buyersApi.create({
                name: buyerQuery.trim(),
                phone: newBuyerPhone || undefined,
                email: newBuyerEmail || undefined,
                city: newBuyerCity || undefined,
                address: newBuyerAddress || undefined,
              })
              qc.invalidateQueries({ queryKey: ['buyers'] })
              resolvedBuyerId = created.id
            } catch {
              setErrorMsg('Failed to save buyer. Please try again.')
              setIsSubmitting(false)
              return
            }
          }
          setIsSubmitting(false)
          mutation.mutate({ ...d, resolvedBuyerId })
        })} className="space-y-5">

          {/* Section: Product */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Product Details</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product <span className="text-red-500">*</span>
              </label>
              <input type="hidden" {...register('productId')} />
              <ProductCombobox
                products={products}
                value={selectedProductId}
                onChange={(id) => setValue('productId', id, { shouldValidate: true })}
                error={errors.productId?.message}
              />
              {errors.productId && <p className="mt-1 text-xs text-red-600">{errors.productId.message}</p>}
            </div>

            {/* Available stock info bar */}
            {availableStock !== null && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                ${availableStock <= 5 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                <span className="text-base">{availableStock <= 5 ? '⚠️' : '✓'}</span>
                <span>Available stock: <strong>{availableStock} units</strong></span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('quantity')}
                  type="number" min={1}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-colors
                    ${realtimeStockError
                      ? 'border-red-400 focus:ring-red-400 bg-red-50'
                      : 'border-gray-300 focus:ring-primary-500'}`}
                  placeholder="0"
                />
                {errors.quantity && !realtimeStockError && (
                  <p className="mt-1 text-xs text-red-600">{errors.quantity.message}</p>
                )}
                {realtimeStockError && (
                  <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    <p className="text-xs font-semibold text-red-600">{realtimeStockError}</p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Serial No. (optional)</label>
                <input
                  {...register('serialNo')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g. SN20240189"
                />
              </div>
            </div>
          </div>

          {/* Section: Recipient */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Recipient Info</h2>

            <input type="hidden" {...register('buyerId')} />

            {/* Buyer autocomplete */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer / Buyer (optional)</label>
              <div className="relative">
                <input
                  ref={buyerInputRef}
                  value={buyerQuery}
                  onChange={(e) => {
                    const val = e.target.value
                    setBuyerQuery(val)
                    setValue('buyerName', val)
                    setBuyerBlurState('idle')
                    setBuyerBlurSuggestions([])
                    if (selectedBuyer) { setSelectedBuyer(null); setValue('buyerId', '') }
                    if (newBuyerMode) setNewBuyerMode(false)
                    setBuyerDropOpen(true)
                  }}
                  onFocus={() => setBuyerDropOpen(true)}
                  onBlur={handleBuyerBlur}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Type name to search existing buyers..."
                  autoComplete="off"
                />
                {buyerDropOpen && (buyerSuggestions.length > 0 || buyerQuery.length >= 2) && (
                  <div ref={buyerDropRef}
                    className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {buyerSuggestions.map((b) => (
                      <button key={b.id} type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setSelectedBuyer(b)
                          setBuyerQuery(b.name)
                          setValue('buyerName', b.name)
                          setValue('buyerId', b.id)
                          setBuyerBlurState('idle')
                          setBuyerBlurSuggestions([])
                          setBuyerDropOpen(false)
                          setNewBuyerMode(false)
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center justify-between border-b border-gray-100 last:border-0">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{b.name}</div>
                          {(b.city || b.phone) && <div className="text-xs text-gray-400">{[b.city, b.phone].filter(Boolean).join(' · ')}</div>}
                        </div>
                        <span className="text-xs text-primary-600 font-medium">Select</span>
                      </button>
                    ))}
                    {buyerQuery.length >= 2 && (
                      <button type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setNewBuyerMode(true)
                          setSelectedBuyer(null)
                          setValue('buyerId', '')
                          setBuyerDropOpen(false)
                        }}
                        className="w-full text-left px-3 py-2.5 text-sm text-blue-600 font-medium hover:bg-blue-50 flex items-center gap-2">
                        <span>+</span> Add "{buyerQuery}" as new customer
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Blur — checking */}
              {buyerBlurState === 'checking' && (
                <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
                  <span className="inline-block w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  Checking buyer database...
                </div>
              )}

              {/* Blur — single match confirmation */}
              {buyerBlurState === 'suggest_single' && buyerBlurSuggestions[0] && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-700 mb-2 font-medium">Kya aap yeh customer chahte hain?</p>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{buyerBlurSuggestions[0].name}</p>
                      {(buyerBlurSuggestions[0].phone || buyerBlurSuggestions[0].city) && (
                        <p className="text-xs text-gray-500 mt-0.5">{[buyerBlurSuggestions[0].phone, buyerBlurSuggestions[0].city].filter(Boolean).join(' · ')}</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button type="button" onClick={() => {
                        const b = buyerBlurSuggestions[0]
                        setSelectedBuyer(b)
                        setBuyerQuery(b.name)
                        setValue('buyerName', b.name)
                        setValue('buyerId', b.id)
                        setBuyerBlurState('idle')
                        setBuyerBlurSuggestions([])
                      }} className="px-3 py-1 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700">
                        Yes, that's the one
                      </button>
                      <button type="button" onClick={() => {
                        setBuyerBlurState('idle')
                        setBuyerBlurSuggestions([])
                        setNewBuyerMode(true)
                      }} className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                        No, add a new one
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Blur — multiple matches list */}
              {buyerBlurState === 'suggest_multiple' && (
                <div className="mt-2 border border-amber-200 rounded-lg overflow-hidden">
                  <p className="px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 border-b border-amber-200">
                    Kuch matching customers mile — kaunsa select karein?
                  </p>
                  {buyerBlurSuggestions.map((b) => (
                    <button key={b.id} type="button"
                      onClick={() => {
                        setSelectedBuyer(b)
                        setBuyerQuery(b.name)
                        setValue('buyerName', b.name)
                        setValue('buyerId', b.id)
                        setBuyerBlurState('idle')
                        setBuyerBlurSuggestions([])
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center justify-between border-b border-gray-100 last:border-0 bg-white">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{b.name}</p>
                        {(b.city || b.phone) && <p className="text-xs text-gray-400">{[b.city, b.phone].filter(Boolean).join(' · ')}</p>}
                      </div>
                      <span className="text-xs text-primary-600 font-medium">Select →</span>
                    </button>
                  ))}
                  <button type="button"
                    onClick={() => {
                      setBuyerBlurState('idle')
                      setBuyerBlurSuggestions([])
                      setNewBuyerMode(true)
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm text-blue-600 font-medium hover:bg-blue-50 flex items-center gap-2 bg-white">
                    <span>+</span> Add "{buyerQuery}" as a new customer
                  </button>
                </div>
              )}

              {/* Selected buyer profile card */}
              {selectedBuyer && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-blue-700">✓ Linked to saved profile</p>
                      {selectedBuyer.phone && <p className="text-xs text-gray-700">📞 {selectedBuyer.phone}</p>}
                      {selectedBuyer.email && <p className="text-xs text-gray-700">📧 {selectedBuyer.email}</p>}
                      {selectedBuyer.city && <p className="text-xs text-gray-700">📍 {selectedBuyer.city}</p>}
                    </div>
                    <button type="button"
                      onClick={() => { setSelectedBuyer(null); setBuyerQuery(''); setValue('buyerName', ''); setValue('buyerId', '') }}
                      className="text-xs text-gray-400 hover:text-red-500 font-medium">✕ Remove</button>
                  </div>
                </div>
              )}

              {/* New buyer form */}
              {newBuyerMode && (
                <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">New Customer Details</p>
                    <button type="button" onClick={() => { setNewBuyerMode(false); setNewBuyerPhone(''); setNewBuyerEmail(''); setNewBuyerCity(''); setNewBuyerAddress('') }}
                      className="text-xs text-gray-400 hover:text-red-500">✕ Cancel</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Phone</label>
                      <input value={newBuyerPhone} onChange={(e) => setNewBuyerPhone(e.target.value)}
                        placeholder="+1 555 010 0100"
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
                      <input value={newBuyerEmail} onChange={(e) => setNewBuyerEmail(e.target.value)}
                        type="email" placeholder="buyer@example.com"
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">City</label>
                      <input value={newBuyerCity} onChange={(e) => setNewBuyerCity(e.target.value)}
                        placeholder="e.g. Springfield"
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Address</label>
                      <input value={newBuyerAddress} onChange={(e) => setNewBuyerAddress(e.target.value)}
                        placeholder="Street, area..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={saveAsNewBuyer} onChange={(e) => setSaveAsNewBuyer(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                    <span>Save as new buyer in system</span>
                  </label>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issued To (optional)</label>
              <input
                {...register('issuedTo')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Who received / requested this stock"
              />
            </div>
          </div>

          {/* Section: Notes & Date */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Issue Details</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Issue Date <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('transactionDate')}
                  type="date"
                  max={today()}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.transactionDate && <p className="mt-1 text-xs text-red-600">{errors.transactionDate.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <input
                  {...register('notes')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Order reference, reason, etc."
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{errorMsg}</div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            {realtimeStockError && (
              <span className="text-xs text-red-500 font-medium">Fix quantity to proceed</span>
            )}
            {(buyerBlurState === 'checking' || buyerBlurState === 'suggest_single' || buyerBlurState === 'suggest_multiple') && (
              <span className="text-xs text-amber-600 font-medium">Pehle buyer confirm karein ya naya add karein</span>
            )}
            <button
              type="submit"
              disabled={mutation.isPending || isSubmitting || !!realtimeStockError || buyerBlurState === 'checking' || buyerBlurState === 'suggest_single' || buyerBlurState === 'suggest_multiple'}
              className="px-6 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Saving buyer...' : mutation.isPending ? 'Processing...' : 'Issue Stock'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
