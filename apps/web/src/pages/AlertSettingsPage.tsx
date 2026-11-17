import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { alertsApi } from '../services/alerts'
import BackButton from '../components/BackButton'
import Breadcrumbs from '../components/Breadcrumbs'

export default function AlertSettingsPage() {
  const queryClient = useQueryClient()

  const { data: config, isLoading } = useQuery({
    queryKey: ['alerts-config'],
    queryFn: alertsApi.getConfig,
  })

  const [emailEnabled, setEmailEnabled] = useState(false)
  const [lowStockThreshold, setLowStockThreshold] = useState(10)
  const [outOfStockEnabled, setOutOfStockEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (config) {
      setEmailEnabled(config.emailEnabled)
      setLowStockThreshold(config.lowStockThreshold)
      setOutOfStockEnabled(config.outOfStockEnabled)
    }
  }, [config])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSuccessMsg('')
    setErrorMsg('')
    try {
      await alertsApi.updateConfig({ emailEnabled, lowStockThreshold, outOfStockEnabled })
      await queryClient.invalidateQueries({ queryKey: ['alerts-config'] })
      setSuccessMsg('Settings saved successfully.')
    } catch {
      setErrorMsg('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <BackButton to="/dashboard" />
      <Breadcrumbs crumbs={[{ label: 'Settings' }]} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Alert Settings</h1>
      </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading settings...</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-5">Notification Preferences</h2>

            <form onSubmit={handleSave} className="space-y-5">
              {/* Email Notifications toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Email Notifications</p>
                  <p className="text-xs text-gray-500 mt-0.5">Receive alerts via email</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                    emailEnabled ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
                  role="switch"
                  aria-checked={emailEnabled}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                      emailEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Low Stock Threshold */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Low Stock Threshold
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Alert when quantity falls below this value
                </p>
                <input
                  type="number"
                  min={0}
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Out of Stock Alerts toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Out of Stock Alerts</p>
                  <p className="text-xs text-gray-500 mt-0.5">Alert when a product reaches zero stock</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOutOfStockEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                    outOfStockEnabled ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
                  role="switch"
                  aria-checked={outOfStockEnabled}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                      outOfStockEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Success / Error messages */}
              {successMsg && (
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  {successMsg}
                </p>
              )}
              {errorMsg && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          </div>
        )}
    </div>
  )
}
