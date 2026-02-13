import { useState } from 'react'
import { useAccountStore } from '../stores/accountStore'
import { providerPresets, type ProviderPreset } from '../utils/providerPresets'
import type { AccountCreate } from '../../shared/types'

export default function AccountForm(): React.JSX.Element {
  const { addAccount, testConnection } = useAccountStore()

  const [provider, setProvider] = useState<ProviderPreset>(providerPresets[0])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [imapHost, setImapHost] = useState(providerPresets[0].imapHost)
  const [imapPort, setImapPort] = useState(providerPresets[0].imapPort)
  const [smtpHost, setSmtpHost] = useState(providerPresets[0].smtpHost)
  const [smtpPort, setSmtpPort] = useState(providerPresets[0].smtpPort)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [isTesting, setIsTesting] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)

  function handleProviderChange(value: string): void {
    const preset = providerPresets.find((p) => p.value === value) || providerPresets[2]
    setProvider(preset)
    setImapHost(preset.imapHost)
    setImapPort(preset.imapPort)
    setSmtpHost(preset.smtpHost)
    setSmtpPort(preset.smtpPort)
    setTestResult(null)
  }

  function getFormData(): AccountCreate {
    return {
      name,
      email,
      provider: provider.value,
      imapHost,
      imapPort,
      smtpHost,
      smtpPort,
      username,
      password
    }
  }

  async function handleTest(): Promise<void> {
    setIsTesting(true)
    setTestResult(null)
    const result = await testConnection(getFormData())
    setTestResult(result)
    setIsTesting(false)
  }

  async function handleAdd(): Promise<void> {
    setIsAdding(true)
    const success = await addAccount(getFormData())
    if (success) {
      setName('')
      setEmail('')
      setUsername('')
      setPassword('')
      setTestResult(null)
      handleProviderChange('gmail')
    }
    setIsAdding(false)
  }

  const isValid = name && email && imapHost && smtpHost && username && password

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold dark:text-gray-100">Neues Konto hinzufügen</h2>

      <div className="space-y-4">
        {/* Provider */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Provider</label>
          <select
            value={provider.value}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            {providerPresets.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Name + Email */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Max Mustermann"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="max@example.com"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        </div>

        {/* IMAP Host/Port */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">IMAP Host</label>
            <input
              type="text"
              value={imapHost}
              onChange={(e) => setImapHost(e.target.value)}
              placeholder="imap.example.com"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Port</label>
            <input
              type="number"
              value={imapPort}
              onChange={(e) => setImapPort(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        </div>

        {/* SMTP Host/Port */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">SMTP Host</label>
            <input
              type="text"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              placeholder="smtp.example.com"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Port</label>
            <input
              type="number"
              value={smtpPort}
              onChange={(e) => setSmtpPort(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Username + Password */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Benutzername</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="max@example.com"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Passwort (App-Passwort)
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="App-Passwort eingeben"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>

        {/* Test Result */}
        {testResult && (
          <div
            className={`rounded-md p-3 text-sm ${
              testResult.success
                ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            {testResult.success
              ? 'Verbindung erfolgreich!'
              : `Verbindung fehlgeschlagen: ${testResult.error}`}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleTest}
            disabled={!isValid || isTesting}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            {isTesting ? 'Teste...' : 'Verbindung testen'}
          </button>
          <button
            onClick={handleAdd}
            disabled={!isValid || isAdding}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAdding ? 'Wird hinzugefügt...' : 'Konto hinzufügen'}
          </button>
        </div>
      </div>
    </div>
  )
}
