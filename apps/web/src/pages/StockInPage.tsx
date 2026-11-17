import { useState, useMemo, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v3'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PackagePlus } from 'lucide-react'
import { stockApi } from '../services/stock'
import { productsApi } from '../services/products'
import { vendorsApi, Vendor } from '../services/vendors'
import axios from 'axios'
import { generateId } from '../utils/uuid'
import BackButton from '../components/BackButton'
import Breadcrumbs from '../components/Breadcrumbs'
import ProductCombobox from '../components/ProductCombobox'

const schema = z.object({
  productId: z.string().min(1, 'Product is required'),
  vendorId: z.string().optional(),
  quantity: z.coerce.number().int().min(1, 'Min 1'),
  unitPrice: z.coerce.number().positive().optional().or(z.literal('')),
  serialNo: z.string().optional(),
  transactionDate: z.string().min(1, 'Date is required'),
  notes: z.string().optional(),
})

const quickProductSchema = z.object({
  name: z.string().min(1, 'Name required'),
  sku: z.string().min(1, 'SKU required'),
})

const quickVendorSchema = z.object({
  name: z.string().min(1, 'Name required'),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  city: z.string().optional(),
  address: z.string().optional(),
})

type FormValues = z.infer<typeof schema>
type QuickProduct = z.infer<typeof quickProductSchema>
type QuickVendor = z.infer<typeof quickVendorSchema>
type VendorBlurState = 'idle' | 'suggest_single' | 'suggest_multiple'

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

function today() {
  return new Date().toISOString().slice(0, 10)
}

function autoSku(name: string) {
  const prefix = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4) || 'PROD'
  const suffix = Math.floor(Math.random() * 900 + 100)
  return `${prefix}-${suffix}`
}

export default function StockInPage() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const prefillProductId = (location.state as any)?.prefillProductId as string | undefined
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState(() => generateId())
  const [showQuickProduct, setShowQuickProduct] = useState(false)
  const [showQuickVendor, setShowQuickVendor] = useState(false)
  const [quickProductErr, setQuickProductErr] = useState('')
  const [quickVendorErr, setQuickVendorErr] = useState('')

  // Vendor combobox state
  const [vendorQuery, setVendorQuery] = useState('')
  const [vendorDropOpen, setVendorDropOpen] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const vendorInputRef = useRef<HTMLInputElement>(null)
  const vendorDropRef = useRef<HTMLDivElement>(null)
  const [vendorBlurState, setVendorBlurState] = useState<VendorBlurState>('idle')
  const [vendorBlurSuggestions, setVendorBlurSuggestions] = useState<Vendor[]>([])

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { transactionDate: today() },
  })

  const selectedProductId = watch('productId') ?? ''

  const qpForm = useForm<QuickProduct>({ resolver: zodResolver(quickProductSchema) })
  const qvForm = useForm<QuickVendor>({ resolver: zodResolver(quickVendorSchema) })

  // Vendor outside-click close
  useEffect(() => {
    function onMd(e: MouseEvent) {
      if (
        vendorDropRef.current && !vendorDropRef.current.contains(e.target as Node) &&
        vendorInputRef.current && !vendorInputRef.current.contains(e.target as Node)
      ) setVendorDropOpen(false)
    }
    document.addEventListener('mousedown', onMd)
    return () => document.removeEventListener('mousedown', onMd)
  }, [])

  const { data: productsData } = useQuery({
    queryKey: ['products', { limit: 200 }],
    queryFn: () => productsApi.list({ limit: 200 }),
  })
  const { data: vendorsData } = useQuery({
    queryKey: ['vendors', { limit: 100 }],
    queryFn: () => vendorsApi.list({ limit: 100 }),
  })
  const { data: inventoryData } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => stockApi.getInventory(),
  })

  // Pre-fill product from navigation state (e.g. from GlobalSearch)
  useEffect(() => {
    if (prefillProductId && productsData?.products?.some((p) => p.id === prefillProductId)) {
      setValue('productId', prefillProductId, { shouldValidate: true })
      window.history.replaceState({}, '')
    }
  }, [prefillProductId, productsData])

  // All active products with current stock level shown
  const products = useMemo(() => {
    const all = productsData?.products ?? []
    const inventory = inventoryData?.inventory ?? []
    return all.map((p) => {
      const inv = inventory.find((i) => i.productId === p.id)
      return { id: p.id, name: p.name, sku: p.sku, stock: inv?.quantityOnHand ?? 0 }
    })
  }, [productsData, inventoryData])

  const allVendors = vendorsData?.vendors ?? []
  const filteredVendors = useMemo(() => {
    if (!vendorQuery.trim()) return allVendors.slice(0, 8)
    const q = vendorQuery.toLowerCase()
    return allVendors.filter((v) =>
      v.name.toLowerCase().includes(q) ||
      (v.city ?? '').toLowerCase().includes(q) ||
      (v.contactName ?? '').toLowerCase().includes(q)
    ).slice(0, 8)
  }, [allVendors, vendorQuery])

  function handleVendorBlur() {
    if (selectedVendor || showQuickVendor) return
    const q = vendorQuery.trim()
    if (!q) return

    const scored = allVendors
      .map((v) => ({ vendor: v, score: calcScore(q, v.name) }))
      .filter((x) => x.score >= 0.6)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    const exactMatch = scored.find((x) => x.score === 1.0)
    if (exactMatch) {
      setSelectedVendor(exactMatch.vendor)
      setVendorQuery(exactMatch.vendor.name)
      setValue('vendorId', exactMatch.vendor.id)
      setVendorDropOpen(false)
      return
    }

    setVendorDropOpen(false)
    if (scored.length === 0) {
      if (vendorQuery) qvForm.setValue('name', vendorQuery)
      setShowQuickVendor(true)
    } else if (scored.length === 1 || scored[0].score >= 0.85) {
      setVendorBlurSuggestions([scored[0].vendor])
      setVendorBlurState('suggest_single')
    } else {
      setVendorBlurSuggestions(scored.map((x) => x.vendor))
      setVendorBlurState('suggest_multiple')
    }
  }

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      stockApi.stockIn({
        productId: data.productId,
        vendorId: data.vendorId || undefined,
        quantity: data.quantity,
        unitPrice: data.unitPrice ? Number(data.unitPrice) : undefined,
        serialNo: data.serialNo || undefined,
        transactionDate: data.transactionDate,
        notes: data.notes || undefined,
        idempotencyKey,
      }),
    onSuccess: () => {
      setSuccessMsg('Stock received successfully')
      setErrorMsg('')
      reset({ transactionDate: today() })
      setIdempotencyKey(generateId())
      setSelectedVendor(null)
      setVendorQuery('')
    },
    onError: (err: unknown) => {
      setSuccessMsg('')
      if (axios.isAxiosError(err)) {
        setErrorMsg(err.response?.data?.message ?? 'Failed. Please try again.')
      } else {
        setErrorMsg('Something went wrong.')
      }
    },
  })

  const quickProductMutation = useMutation({
    mutationFn: (d: QuickProduct) =>
      productsApi.create({ name: d.name, sku: d.sku, unit: 'pcs' }),
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setValue('productId', product.id)
      setShowQuickProduct(false)
      qpForm.reset()
      setQuickProductErr('')
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err)) {
        setQuickProductErr(err.response?.data?.message ?? 'Failed to create product.')
      }
    },
  })

  const quickVendorMutation = useMutation({
    mutationFn: (d: QuickVendor) =>
      vendorsApi.create({
        name: d.name,
        contactName: d.contactName || undefined,
        phone: d.phone || undefined,
        email: d.email || undefined,
        city: d.city || undefined,
        address: d.address || undefined,
      }),
    onSuccess: (vendor) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      setValue('vendorId', vendor.id)
      setSelectedVendor(vendor)
      setVendorQuery(vendor.name)
      setShowQuickVendor(false)
      qvForm.reset()
      setQuickVendorErr('')
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err)) {
        setQuickVendorErr(err.response?.data?.message ?? 'Failed to create vendor.')
      }
    },
  })

  return (
    <div className="p-6 max-w-2xl">
      <BackButton to="/dashboard" />
      <Breadcrumbs crumbs={[{ label: 'Stock In' }]} />

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-100 rounded-lg">
          <PackagePlus className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Receive Stock</h1>
          <p className="text-xs text-gray-500">Record incoming stock to inventory</p>
        </div>
      </div>

      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
          <span className="text-green-500">✓</span> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">

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
              onAddNew={(name) => {
                qpForm.setValue('name', name)
                qpForm.setValue('sku', autoSku(name))
                setShowQuickProduct(true)
                setShowQuickVendor(false)
              }}
              error={errors.productId?.message}
            />
            {errors.productId && <p className="mt-1 text-xs text-red-600">{errors.productId.message}</p>}
          </div>

          {showQuickProduct && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Quick Add Product</p>
              {quickProductErr && <p className="text-xs text-red-600">{quickProductErr}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Product Name *</label>
                  <input
                    {...qpForm.register('name')}
                    placeholder="e.g. USB Cable 1m"
                    onBlur={(e) => {
                      if (!qpForm.getValues('sku')) {
                        qpForm.setValue('sku', autoSku(e.target.value))
                      }
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                  {qpForm.formState.errors.name && <p className="text-xs text-red-600 mt-0.5">{qpForm.formState.errors.name.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">SKU *</label>
                  <input
                    {...qpForm.register('sku')}
                    placeholder="e.g. SAMS-101"
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                  {qpForm.formState.errors.sku && <p className="text-xs text-red-600 mt-0.5">{qpForm.formState.errors.sku.message}</p>}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setShowQuickProduct(false); qpForm.reset(); setQuickProductErr('') }}
                  className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
                  Cancel
                </button>
                <button type="button" onClick={qpForm.handleSubmit((d) => quickProductMutation.mutate(d))}
                  disabled={quickProductMutation.isPending}
                  className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-60">
                  {quickProductMutation.isPending ? 'Saving...' : 'Create & Select'}
                </button>
              </div>
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="0"
              />
              {errors.quantity && <p className="mt-1 text-xs text-red-600">{errors.quantity.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Serial / Batch No. (optional)</label>
              <input
                {...register('serialNo')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="e.g. SN-20240189"
              />
            </div>
          </div>
        </div>

        {/* Section: Vendor & Price */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Vendor & Pricing</h2>

          <input type="hidden" {...register('vendorId')} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor (optional)</label>
            <div className="relative">
              <input
                ref={vendorInputRef}
                value={vendorQuery}
                onChange={(e) => {
                  setVendorQuery(e.target.value)
                  setVendorBlurState('idle')
                  setVendorBlurSuggestions([])
                  if (selectedVendor) { setSelectedVendor(null); setValue('vendorId', '') }
                  setVendorDropOpen(true)
                }}
                onFocus={() => setVendorDropOpen(true)}
                onBlur={handleVendorBlur}
                placeholder="Search vendors by name or city..."
                autoComplete="off"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {vendorDropOpen && (filteredVendors.length > 0 || vendorQuery.length >= 2) && (
                <div ref={vendorDropRef}
                  className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {filteredVendors.map((v) => (
                    <button key={v.id} type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setSelectedVendor(v)
                        setVendorQuery(v.name)
                        setValue('vendorId', v.id)
                        setVendorDropOpen(false)
                        setShowQuickVendor(false)
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-primary-50 flex items-center justify-between border-b border-gray-100 last:border-0">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{v.name}</div>
                        {(v.city || v.contactName) && <div className="text-xs text-gray-400">{[v.contactName, v.city].filter(Boolean).join(' · ')}</div>}
                      </div>
                      <span className="text-xs text-primary-600 font-medium">Select</span>
                    </button>
                  ))}
                  <button type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setVendorDropOpen(false)
                      setShowQuickVendor(true)
                      if (vendorQuery) qvForm.setValue('name', vendorQuery)
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm text-blue-600 font-medium hover:bg-blue-50 flex items-center gap-2">
                    <span>+</span> Add "{vendorQuery || 'new vendor'}"
                  </button>
                </div>
              )}
            </div>

            {/* Blur — single match confirmation */}
            {vendorBlurState === 'suggest_single' && vendorBlurSuggestions[0] && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700 mb-2 font-medium">Kya aap yeh vendor chahte hain?</p>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{vendorBlurSuggestions[0].name}</p>
                    {(vendorBlurSuggestions[0].contactName || vendorBlurSuggestions[0].city) && (
                      <p className="text-xs text-gray-500 mt-0.5">{[vendorBlurSuggestions[0].contactName, vendorBlurSuggestions[0].city].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button type="button" onClick={() => {
                      const v = vendorBlurSuggestions[0]
                      setSelectedVendor(v)
                      setVendorQuery(v.name)
                      setValue('vendorId', v.id)
                      setVendorBlurState('idle')
                      setVendorBlurSuggestions([])
                    }} className="px-3 py-1 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700">
                      Yes, that's the one
                    </button>
                    <button type="button" onClick={() => {
                      setVendorBlurState('idle')
                      setVendorBlurSuggestions([])
                      if (vendorQuery) qvForm.setValue('name', vendorQuery)
                      setShowQuickVendor(true)
                    }} className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                      No, add a new one
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Blur — multiple matches list */}
            {vendorBlurState === 'suggest_multiple' && (
              <div className="mt-2 border border-amber-200 rounded-lg overflow-hidden">
                <p className="px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 border-b border-amber-200">
                  Kuch matching vendors mile — kaunsa select karein?
                </p>
                {vendorBlurSuggestions.map((v) => (
                  <button key={v.id} type="button"
                    onClick={() => {
                      setSelectedVendor(v)
                      setVendorQuery(v.name)
                      setValue('vendorId', v.id)
                      setVendorBlurState('idle')
                      setVendorBlurSuggestions([])
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-primary-50 flex items-center justify-between border-b border-gray-100 last:border-0 bg-white">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{v.name}</p>
                      {(v.city || v.contactName) && <p className="text-xs text-gray-400">{[v.contactName, v.city].filter(Boolean).join(' · ')}</p>}
                    </div>
                    <span className="text-xs text-primary-600 font-medium">Select →</span>
                  </button>
                ))}
                <button type="button"
                  onClick={() => {
                    setVendorBlurState('idle')
                    setVendorBlurSuggestions([])
                    if (vendorQuery) qvForm.setValue('name', vendorQuery)
                    setShowQuickVendor(true)
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm text-blue-600 font-medium hover:bg-blue-50 flex items-center gap-2 bg-white">
                  <span>+</span> Add "{vendorQuery}" as a new vendor
                </button>
              </div>
            )}

            {/* Selected vendor info panel */}
            {selectedVendor && (
              <div className="mt-2 p-3 bg-primary-50 border border-primary-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-primary-700">✓ Linked to saved vendor</p>
                    {selectedVendor.contactName && <p className="text-xs text-gray-700">👤 {selectedVendor.contactName}</p>}
                    {selectedVendor.phone && <p className="text-xs text-gray-700">📞 {selectedVendor.phone}</p>}
                    {selectedVendor.email && <p className="text-xs text-gray-700">📧 {selectedVendor.email}</p>}
                    {selectedVendor.city && <p className="text-xs text-gray-700">📍 {selectedVendor.city}</p>}
                  </div>
                  <button type="button"
                    onClick={() => { setSelectedVendor(null); setVendorQuery(''); setValue('vendorId', '') }}
                    className="text-xs text-gray-400 hover:text-red-500 font-medium">✕ Remove</button>
                </div>
              </div>
            )}
          </div>

          {showQuickVendor && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Add New Vendor</p>
                <button type="button" onClick={() => { setShowQuickVendor(false); qvForm.reset(); setQuickVendorErr('') }}
                  className="text-xs text-gray-400 hover:text-red-500">✕</button>
              </div>
              {quickVendorErr && <p className="text-xs text-red-600">{quickVendorErr}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Company Name *</label>
                  <input {...qvForm.register('name')} placeholder="e.g. Raj Electronics"
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  {qvForm.formState.errors.name && <p className="text-xs text-red-600 mt-0.5">{qvForm.formState.errors.name.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Contact Person</label>
                  <input {...qvForm.register('contactName')} placeholder="e.g. Jane Doe"
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Phone</label>
                  <input {...qvForm.register('phone')} placeholder="+1 555 010 0100"
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
                  <input {...qvForm.register('email')} type="email" placeholder="vendor@example.com"
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  {qvForm.formState.errors.email && <p className="text-xs text-red-600 mt-0.5">{qvForm.formState.errors.email.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">City</label>
                  <input {...qvForm.register('city')} placeholder="e.g. Springfield"
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Address</label>
                <input {...qvForm.register('address')} placeholder="Street, area..."
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setShowQuickVendor(false); qvForm.reset(); setQuickVendorErr('') }}
                  className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                <button type="button" onClick={qvForm.handleSubmit((d) => quickVendorMutation.mutate(d))}
                  disabled={quickVendorMutation.isPending}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60">
                  {quickVendorMutation.isPending ? 'Creating...' : 'Create & Select'}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price $ (optional)</label>
              <input
                {...register('unitPrice')}
                type="number" step="0.01" min={0}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                {...register('transactionDate')}
                type="date"
                max={today()}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.transactionDate && <p className="mt-1 text-xs text-red-600">{errors.transactionDate.message}</p>}
            </div>
          </div>
        </div>

        {/* Section: Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea
            {...register('notes')}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            placeholder="Purchase order number, batch info, etc."
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          {(vendorBlurState === 'suggest_single' || vendorBlurState === 'suggest_multiple') && (
            <span className="text-xs text-amber-600 font-medium">Pehle vendor confirm karein ya naya add karein</span>
          )}
          <button
            type="submit"
            disabled={mutation.isPending || vendorBlurState === 'suggest_single' || vendorBlurState === 'suggest_multiple'}
            className="px-6 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
          >
            {mutation.isPending ? 'Saving...' : 'Receive Stock'}
          </button>
        </div>
      </form>
    </div>
  )
}
