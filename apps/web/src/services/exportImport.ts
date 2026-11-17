import api from './api'

export type ExportFormat = 'xlsx' | 'csv' | 'gsheets'

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
}

export async function downloadBlob(
  url: string,
  params: Record<string, string | number | undefined>,
  filename: string
) {
  const clean: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') clean[k] = v
  }
  const res = await api.get(url, { params: clean, responseType: 'blob' })
  const blob = new Blob([res.data])
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

function ext(f: ExportFormat) { return f === 'xlsx' ? 'xlsx' : 'csv' }
function filterLabel(params?: Record<string, string | undefined>) {
  if (!params) return ''
  if (params.dateFrom && params.dateTo) return `_${params.dateFrom}_to_${params.dateTo}`
  if (params.dateFrom) return `_From_${params.dateFrom}`
  if (params.dateTo) return `_To_${params.dateTo}`
  return ''
}

export const exportService = {
  vendors: (format: ExportFormat, params?: Record<string, string>) =>
    downloadBlob('/export/vendors', { format, ...params },
      `Acme_Vendors${filterLabel(params)}_${todayLabel()}.${ext(format)}`),

  buyers: (format: ExportFormat, params?: Record<string, string>) =>
    downloadBlob('/export/buyers', { format, ...params },
      `Acme_Buyers${filterLabel(params)}_${todayLabel()}.${ext(format)}`),

  products: (format: ExportFormat, params?: Record<string, string>) =>
    downloadBlob('/export/products', { format, ...params },
      `Acme_Products_${todayLabel()}.${ext(format)}`),

  transactions: (format: ExportFormat, params?: Record<string, string>) => {
    const typeLabel = params?.type && params.type !== 'ALL' ? `_${params.type}` : ''
    return downloadBlob('/export/transactions', { format, ...params },
      `Acme_Transactions${typeLabel}${filterLabel(params)}_${todayLabel()}.${ext(format)}`)
  },

  fullReportXlsx: (dateFrom?: string, dateTo?: string) => {
    const month = dateFrom
      ? new Date(dateFrom).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).replace(' ', '_')
      : todayLabel()
    return downloadBlob('/export/report', { format: 'xlsx', dateFrom, dateTo },
      `Acme_Inventory_Report_${month}.xlsx`)
  },

  fullReportPdf: (dateFrom?: string, dateTo?: string) => {
    const month = dateFrom
      ? new Date(dateFrom).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).replace(' ', '_')
      : todayLabel()
    return downloadBlob('/export/report/pdf', { dateFrom, dateTo },
      `Acme_Inventory_Report_${month}.pdf`)
  },

  inventory: (format: ExportFormat, params?: Record<string, string>) => {
    const searchLabel = params?.search ? `_${params.search.replace(/\s+/g, '_').substring(0, 20)}` : ''
    const gsLabel = format === 'gsheets' ? '_GoogleSheets' : ''
    return downloadBlob('/export/inventory', { format, ...params },
      `Acme_Inventory${searchLabel}${gsLabel}_${todayLabel()}.${ext(format)}`)
  },

  alerts: (format: ExportFormat, params?: Record<string, string>) => {
    const typeLabel = params?.type && params.type !== 'ALL' ? `_${params.type}` : ''
    const gsLabel = format === 'gsheets' ? '_GoogleSheets' : ''
    return downloadBlob('/export/alerts', { format, ...params },
      `Acme_Alerts${typeLabel}${gsLabel}_${todayLabel()}.${ext(format)}`)
  },
}
