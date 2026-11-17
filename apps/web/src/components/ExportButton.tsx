import { useState, useRef, useEffect } from 'react'
import { Download, ChevronDown, Loader2 } from 'lucide-react'
import { ExportFormat } from '../services/exportImport'

interface Props {
  onExport: (format: ExportFormat) => Promise<void>
  label?: string
  variant?: 'default' | 'primary'
}

export default function ExportButton({ onExport, label = 'Export', variant = 'default' }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMd(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMd)
    return () => document.removeEventListener('mousedown', onMd)
  }, [])

  async function handle(format: ExportFormat) {
    setOpen(false)
    setLoading(true)
    try {
      await onExport(format)
      if (format === 'gsheets') {
        setToast('Google Sheets mein jaake: File → Import → Upload → Replace spreadsheet')
        setTimeout(() => setToast(''), 6000)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setToast(msg.includes('404') ? 'No data to export for selected filters.' : 'Export failed. Please try again.')
      setTimeout(() => setToast(''), 4000)
    } finally {
      setLoading(false)
    }
  }

  const btnBase = variant === 'primary'
    ? 'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary-600 border border-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors'
    : 'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors'

  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => !loading && setOpen(o => !o)} disabled={loading} className={btnBase}>
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Exporting...</>
          : <><Download className="w-4 h-4" /> {label} <ChevronDown className="w-3.5 h-3.5" /></>
        }
      </button>

      {open && !loading && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 w-52 py-1">
          <button onClick={() => handle('xlsx')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2.5">
            <span>📊</span> Download Excel
          </button>
          <button onClick={() => handle('csv')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2.5">
            <span>📋</span> Download CSV
          </button>
          <button onClick={() => handle('gsheets')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2.5">
            <span>📗</span> Google Sheets CSV
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-gray-900 text-white text-sm px-4 py-3 rounded-lg shadow-xl animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  )
}
