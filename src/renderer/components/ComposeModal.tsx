import { useState, useEffect } from 'react'
import { useEmailStore } from '../stores/emailStore'
import { useAccountStore } from '../stores/accountStore'

export default function ComposeModal(): React.JSX.Element | null {
  const { composeOpen, composeData, closeCompose, sendEmail, isSending } = useEmailStore()
  const { accounts } = useAccountStore()

  const [accountId, setAccountId] = useState('')
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (composeOpen) {
      setAccountId(composeData?.accountId || accounts[0]?.id || '')
      setTo(composeData?.to || '')
      setSubject(composeData?.subject || '')
      setBody(composeData?.body || '')
      setError(null)
    }
  }, [composeOpen, composeData, accounts])

  if (!composeOpen) return null

  const handleSend = async (): Promise<void> => {
    if (!accountId || !to.trim() || !subject.trim()) {
      setError('Bitte alle Pflichtfelder ausfüllen.')
      return
    }
    setError(null)
    const success = await sendEmail({ accountId, to: to.trim(), subject: subject.trim(), body })
    if (!success) {
      setError('Fehler beim Senden der E-Mail.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Neue E-Mail</h2>
          <button
            onClick={closeCompose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4 p-6">
          {/* Account selector */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Von</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} &lt;{a.email}&gt;
                </option>
              ))}
            </select>
          </div>

          {/* To */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">An</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="empfänger@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Betreff</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Betreff eingeben..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {/* Body */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Nachricht</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="Nachricht schreiben..."
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button
            onClick={closeCompose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSend}
            disabled={isSending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSending ? 'Sende...' : 'Senden'}
          </button>
        </div>
      </div>
    </div>
  )
}
