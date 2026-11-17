import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, Check, PlusCircle } from 'lucide-react'

export interface ComboboxProduct {
  id: string
  name: string
  sku: string
  stock?: number
}

interface Props {
  products: ComboboxProduct[]
  value: string
  onChange: (productId: string) => void
  onAddNew?: (name: string) => void
  error?: string
  placeholder?: string
}

function StockBadge({ stock }: { stock: number }) {
  const cls =
    stock === 0
      ? 'bg-red-100 text-red-600'
      : stock <= 5
      ? 'bg-amber-100 text-amber-700'
      : 'bg-green-100 text-green-700'
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${cls}`}>
      {stock} in stock
    </span>
  )
}

export default function ProductCombobox({
  products,
  value,
  onChange,
  onAddNew,
  error,
  placeholder = 'Select or type product name...',
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = products.find((p) => p.id === value)

  const filtered = query.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.sku.toLowerCase().includes(query.toLowerCase())
      )
    : products

  const exactMatch = products.some(
    (p) => p.name.toLowerCase() === query.trim().toLowerCase()
  )

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function handleSelect(p: ComboboxProduct) {
    onChange(p.id)
    setQuery('')
    setOpen(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    if (!e.target.value) onChange('')
    if (!open) setOpen(true)
  }

  function handleFocus() {
    setOpen(true)
    setQuery('')
  }

  const displayValue = open ? query : (selected?.name ?? '')

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center border rounded-lg px-3 py-2 gap-2 bg-white transition-shadow
          ${error ? 'border-red-400' : 'border-gray-300'}
          focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent`}
      >
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="flex-1 text-sm outline-none bg-transparent min-w-0"
        />
        {selected && !open && (
          <>
            <span className="text-xs text-gray-400 font-mono flex-shrink-0">{selected.sku}</span>
            {selected.stock !== undefined && <StockBadge stock={selected.stock} />}
          </>
        )}
        <ChevronDown
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {products.length > 0 && (
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-400">
                {filtered.length} of {products.length} products
                {query && ` — matching "${query}"`}
              </span>
            </div>
          )}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-4 py-4 text-sm text-gray-400 text-center">
                {query ? `No products matching "${query}"` : 'No products available'}
              </div>
            )}
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(p) }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors
                  ${value === p.id ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-gray-900">{p.name}</span>
                    <span className="ml-2 text-xs text-gray-400 font-mono">{p.sku}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  {p.stock !== undefined && <StockBadge stock={p.stock} />}
                  {value === p.id && <Check className="w-4 h-4 text-primary-600" />}
                </div>
              </button>
            ))}
          </div>

          {onAddNew && query.trim() && !exactMatch && (
            <div className="border-t border-gray-100 bg-green-50/50">
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onAddNew(query.trim()); setOpen(false); setQuery('') }}
                className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-green-50 text-left transition-colors"
              >
                <PlusCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span className="text-sm text-green-700">
                  Add <span className="font-semibold">"{query.trim()}"</span> as new product
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
