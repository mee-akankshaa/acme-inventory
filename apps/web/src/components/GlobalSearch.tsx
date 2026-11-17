import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Loader2, Package, Building2, Users, AlertCircle } from 'lucide-react'
import { searchApi, SearchResult } from '../services/search'

const RECENT_KEY = 'acme_recent_searches'

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') }
  catch { return [] }
}
function saveRecent(q: string) {
  if (!q.trim()) return
  const list = [q.trim(), ...getRecent().filter((r) => r !== q.trim())].slice(0, 5)
  localStorage.setItem(RECENT_KEY, JSON.stringify(list))
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text ?? ''}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5 font-semibold not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function SearchInput({ query, onChange, loading, inputRef, onClose, onFocus, autoFocus, placeholder, onKeyDown }: {
  query: string
  onChange: (q: string) => void
  loading: boolean
  inputRef: React.RefObject<HTMLInputElement>
  onClose?: () => void
  onFocus?: () => void
  autoFocus?: boolean
  placeholder?: string
  onKeyDown?: (e: React.KeyboardEvent) => void
}) {
  return (
    <div className="relative flex items-center">
      <Search className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none z-10" />
      {loading
        ? <Loader2 className="absolute right-3 w-4 h-4 text-primary-500 animate-spin pointer-events-none z-10" />
        : query
          ? <button
              onMouseDown={(e) => { e.preventDefault(); onChange(''); onClose?.() }}
              className="absolute right-3 text-gray-400 hover:text-gray-600 p-0.5 z-10"
            >
              <X className="w-4 h-4" />
            </button>
          : null
      }
      <input
        ref={inputRef}
        type="text"
        value={query}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? 'Search products, vendors, buyers... (Ctrl+K)'}
        className="w-full pl-9 pr-9 py-2 text-sm bg-gray-100 border border-transparent rounded-lg focus:outline-none focus:bg-white focus:border-primary-300 focus:ring-2 focus:ring-primary-100 transition-all"
      />
    </div>
  )
}

interface ResultsPanelProps {
  query: string
  results: SearchResult | null
  loading: boolean
  error: boolean
  recent: string[]
  activeIdx: number
  onProductClick: (id: string) => void
  onStockIn: (id: string, name: string) => void
  onStockOut: (id: string, name: string, stock: number) => void
  onVendorClick: (id: string) => void
  onBuyerClick: (id: string) => void
  onRecentClick: (q: string) => void
  onViewAll: () => void
}

function ResultsPanel({
  query, results, loading, error, recent, activeIdx,
  onProductClick, onStockIn, onStockOut, onVendorClick, onBuyerClick, onRecentClick, onViewAll,
}: ResultsPanelProps) {
  const hasProducts = !!(results?.products?.length)
  const hasVendors = !!(results?.vendors?.length)
  const hasBuyers = !!(results?.buyers?.length)
  const hasAny = hasProducts || hasVendors || hasBuyers
  const showNoResults = !loading && !error && results !== null && !hasAny && query.length >= 2
  const showRecent = !query && recent.length > 0

  if (!query && !showRecent) return null
  if (query.length > 0 && query.length < 2) return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-xl p-3 text-xs text-gray-400 text-center">
      Type at least 2 characters to search...
    </div>
  )

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-xl max-h-[75vh] overflow-y-auto">
      {showRecent && (
        <div className="p-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Recent</p>
          {recent.map((r) => (
            <button key={r} onMouseDown={() => onRecentClick(r)}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg text-left">
              <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />{r}
            </button>
          ))}
        </div>
      )}

      {loading && query.length >= 2 && (
        <div className="p-4 text-center text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
          Searching...
        </div>
      )}

      {error && !loading && (
        <div className="p-4 text-center">
          <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-1" />
          <p className="text-sm text-red-500">Search failed. Try again.</p>
        </div>
      )}

      {showNoResults && (
        <div className="p-6 text-center">
          <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-600 mb-1">No results for "{query}"</p>
          <p className="text-xs text-gray-400">Try: different spelling · SKU number · category name</p>
        </div>
      )}

      {hasProducts && (
        <div>
          <div className="px-4 pt-3 pb-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Products · {results!.products.length} found
            </span>
          </div>
          {results!.products.map((p, i) => (
            <div key={p.id}
              className={`border-b border-gray-100 last:border-0 ${i === activeIdx ? 'bg-primary-50' : ''}`}>
              <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onMouseDown={() => onProductClick(p.id)}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-start gap-2 min-w-0">
                    <Package className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        <Highlight text={p.name} query={query} />
                      </p>
                      <p className="text-xs text-gray-400">
                        {p.category ? <><Highlight text={p.category} query={query} /> · </> : ''}
                        {p.unit}
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs font-mono text-gray-400"><Highlight text={p.sku} query={query} /></p>
                    <p className="text-xs font-medium mt-0.5">
                      {p.status === 'out_of_stock'
                        ? <span className="text-red-600">Out of Stock</span>
                        : p.status === 'low_stock'
                          ? <span className="text-amber-600">Low Stock</span>
                          : <span className="text-green-600">In Stock</span>}
                    </p>
                  </div>
                </div>

                <div className="ml-6 grid grid-cols-3 gap-1 text-xs text-gray-500 mb-2">
                  <span>On Hand: <b className="text-gray-900">{p.currentStock}</b></span>
                  <span>Total In: <b className="text-green-700">{p.totalStockIn}</b></span>
                  <span>Total Out: <b className="text-red-700">{p.totalStockOut}</b></span>
                  {p.minStockLevel > 0 && <span>Min: <b>{p.minStockLevel}</b></span>}
                  {p.stockValue > 0 && <span className="col-span-2">Value: <b>${p.stockValue.toLocaleString('en-US')}</b></span>}
                </div>

                <div className="ml-6 flex gap-2" onMouseDown={(e) => e.stopPropagation()}>
                  <button onMouseDown={() => onStockIn(p.id, p.name)}
                    className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100">
                    + Stock In
                  </button>
                  <button
                    onMouseDown={() => { if (p.currentStock > 0) onStockOut(p.id, p.name, p.currentStock) }}
                    disabled={p.currentStock === 0}
                    title={p.currentStock === 0 ? 'Stock unavailable' : undefined}
                    className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed">
                    + Stock Out
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button onMouseDown={onViewAll}
            className="w-full px-4 py-2.5 text-xs text-primary-600 hover:bg-primary-50 text-center font-medium border-t border-gray-100">
            View all results in Products →
          </button>
        </div>
      )}

      {hasVendors && (
        <div className={hasProducts ? 'border-t border-gray-200' : ''}>
          <div className="px-4 pt-3 pb-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Vendors</span>
          </div>
          {results!.vendors.map((v) => (
            <button key={v.id} onMouseDown={() => onVendorClick(v.id)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate"><Highlight text={v.name} query={query} /></p>
                  <p className="text-xs text-gray-400 truncate">
                    {v.city ? <><Highlight text={v.city} query={query} />{(v.contactName || v.phone) ? ' · ' : ''}</> : null}
                    {v.contactName ?? ''}{v.phone ? ` · ${v.phone}` : ''}
                  </p>
                </div>
              </div>
              <span className="text-xs text-primary-600 font-medium ml-2 flex-shrink-0">View →</span>
            </button>
          ))}
        </div>
      )}

      {hasBuyers && (
        <div className={hasProducts || hasVendors ? 'border-t border-gray-200' : ''}>
          <div className="px-4 pt-3 pb-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Buyers</span>
          </div>
          {results!.buyers.map((b) => (
            <button key={b.id} onMouseDown={() => onBuyerClick(b.id)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate"><Highlight text={b.name} query={query} /></p>
                  <p className="text-xs text-gray-400 truncate">
                    {b.city ? <><Highlight text={b.city} query={query} /> · </> : null}
                    {b.lastPurchaseDate
                      ? `Last purchase: ${new Date(b.lastPurchaseDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}`
                      : ''}
                  </p>
                </div>
              </div>
              <span className="text-xs text-primary-600 font-medium ml-2 flex-shrink-0">View →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function GlobalSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [recent, setRecent] = useState<string[]>(getRecent())
  const [mobileOpen, setMobileOpen] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // Keyboard shortcuts (global)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        if (window.innerWidth < 768) setMobileOpen(true)
        else { inputRef.current?.focus(); setOpen(true) }
      }
      if (e.key === 'Escape') {
        setOpen(false)
        setMobileOpen(false)
        inputRef.current?.blur()
      }
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement)?.tagName ?? '')) {
        e.preventDefault()
        if (window.innerWidth < 768) setMobileOpen(true)
        else { inputRef.current?.focus(); setOpen(true) }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Outside click
  useEffect(() => {
    function onMd(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
        setActiveIdx(-1)
      }
    }
    document.addEventListener('mousedown', onMd)
    return () => document.removeEventListener('mousedown', onMd)
  }, [])

  // Debounced search
  useEffect(() => {
    clearTimeout(timerRef.current)
    setActiveIdx(-1)
    if (query.length < 2) {
      setResults(null)
      setError(false)
      return
    }
    setLoading(true)
    setError(false)
    timerRef.current = setTimeout(async () => {
      try {
        const data = await searchApi.search(query)
        setResults(data)
        setError(false)
      } catch {
        setResults(null)
        setError(true)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [query])

  // Keyboard navigation within dropdown
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) return
    const totalProducts = results?.products?.length ?? 0
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, totalProducts - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIdx >= 0 && results?.products?.[activeIdx]) {
      e.preventDefault()
      doProductClick(results.products[activeIdx].id)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIdx(-1)
      inputRef.current?.blur()
    }
  }, [open, results, activeIdx])

  function handleQueryChange(q: string) {
    setQuery(q)
    setOpen(true)
  }

  function doClose() {
    setOpen(false)
    setMobileOpen(false)
    setQuery('')
    setResults(null)
    setError(false)
    setActiveIdx(-1)
  }

  function doProductClick(id: string) {
    saveRecent(query); setRecent(getRecent())
    doClose()
    navigate(`/products/${id}`)
  }
  function doStockIn(id: string, name: string) {
    saveRecent(query)
    doClose()
    navigate('/stock/in', { state: { prefillProductId: id, prefillProductName: name } })
  }
  function doStockOut(id: string, name: string, stock: number) {
    if (stock === 0) return
    saveRecent(query)
    doClose()
    navigate('/stock/out', { state: { prefillProductId: id, prefillProductName: name } })
  }
  function doVendorClick(id: string) {
    saveRecent(query); doClose(); navigate(`/vendors/${id}`)
  }
  function doBuyerClick(id: string) {
    saveRecent(query); doClose(); navigate(`/buyers/${id}`)
  }
  function doRecentClick(q: string) {
    setQuery(q)
    setOpen(true)
    inputRef.current?.focus() ?? mobileInputRef.current?.focus()
  }
  function doViewAll() {
    setOpen(false)
    setMobileOpen(false)
    navigate(`/products?search=${encodeURIComponent(query)}`)
    setQuery('')
  }

  const panelProps = {
    query, results, loading, error, recent, activeIdx,
    onProductClick: doProductClick, onStockIn: doStockIn, onStockOut: doStockOut,
    onVendorClick: doVendorClick, onBuyerClick: doBuyerClick,
    onRecentClick: doRecentClick, onViewAll: doViewAll,
  }

  const showPanel = open && (query.length >= 1 || (!query && recent.length > 0))

  return (
    <>
      {/* Desktop search bar */}
      <div ref={wrapperRef} className="hidden md:flex flex-1 max-w-lg mx-4 relative">
        <div className="w-full">
          <SearchInput
            query={query}
            onChange={handleQueryChange}
            loading={loading}
            inputRef={inputRef}
            onClose={doClose}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
          />
        </div>
        {showPanel && (
          <div className="absolute top-full mt-1 left-0 right-0 z-[200]">
            <ResultsPanel {...panelProps} />
          </div>
        )}
        {!open && !query && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden lg:flex items-center gap-1">
            <kbd className="text-[10px] text-gray-400 bg-gray-200 border border-gray-300 rounded px-1 py-0.5 font-mono">Ctrl</kbd>
            <kbd className="text-[10px] text-gray-400 bg-gray-200 border border-gray-300 rounded px-1 py-0.5 font-mono">K</kbd>
          </div>
        )}
      </div>

      {/* Mobile search icon */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
      >
        <Search className="w-5 h-5" />
      </button>

      {/* Mobile full-screen overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col md:hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-white">
            <div className="flex-1">
              <SearchInput
                query={query}
                onChange={setQuery}
                loading={loading}
                inputRef={mobileInputRef}
                autoFocus
                placeholder="Search products, vendors, buyers..."
              />
            </div>
            <button onClick={() => { setMobileOpen(false); setQuery('') }}
              className="text-sm font-medium text-primary-600 px-2 py-1 flex-shrink-0">
              Cancel
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <ResultsPanel {...panelProps} />
          </div>
        </div>
      )}
    </>
  )
}
