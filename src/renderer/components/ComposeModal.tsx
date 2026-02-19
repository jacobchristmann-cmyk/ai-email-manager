import { useState, useEffect, useRef } from 'react'
import { useEmailStore } from '../stores/emailStore'
import { useAccountStore } from '../stores/accountStore'

export default function ComposeModal(): React.JSX.Element | null {
  const { composeOpen, composeData, closeCompose, sendEmail, isSending } = useEmailStore()
  const { accounts } = useAccountStore()

  const [accountId, setAccountId] = useState('')
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [showCcBcc, setShowCcBcc] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const toRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (composeOpen) {
      setAccountId(composeData?.accountId || accounts[0]?.id || '')
      setTo(composeData?.to || '')
      setCc(composeData?.cc || '')
      setBcc(composeData?.bcc || '')
      setShowCcBcc(!!(composeData?.cc || composeData?.bcc))
      setSubject(composeData?.subject || '')
      setBody(composeData?.body || '')
      setError(null)
      setTimeout(() => toRef.current?.focus(), 50)
    }
  }, [composeOpen, composeData, accounts])

  // Escape closes, Ctrl/Cmd+Enter sends
  useEffect(() => {
    if (!composeOpen) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.stopPropagation(); closeCompose() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSend()
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [composeOpen, accountId, to, subject, body, cc, bcc]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!composeOpen) return null

  const handleSend = async (): Promise<void> => {
    if (!accountId || !to.trim() || !subject.trim()) {
      setError('Bitte alle Pflichtfelder ausfüllen.')
      return
    }
    setError(null)
    const success = await sendEmail({
      accountId,
      to: to.trim(),
      cc: cc.trim() || undefined,
      bcc: bcc.trim() || undefined,
      subject: subject.trim(),
      body
    })
    if (!success) {
      setError('Fehler beim Senden der E-Mail.')
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div
        className="flex w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-2xl dark:bg-gray-800 sm:rounded-xl"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Neue E-Mail</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">Ctrl+Enter senden · Esc schließen</span>
            <button
              onClick={closeCompose}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-2.5 overflow-y-auto p-5">
          {/* Account selector */}
          <div className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-right text-sm text-gray-500 dark:text-gray-400">Von</span>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} &lt;{a.email}&gt;
                </option>
              ))}
            </select>
          </div>

          {/* To + CC/BCC toggle */}
          <div className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-right text-sm text-gray-500 dark:text-gray-400">An</span>
            <input
              ref={toRef}
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="empfänger@example.com, weitere@example.com"
              className={inputClass}
            />
            <button
              onClick={() => setShowCcBcc((v) => !v)}
              className={`shrink-0 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                showCcBcc
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                  : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700'
              }`}
            >
              CC/BCC
            </button>
          </div>

          {showCcBcc && (
            <>
              <div className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-right text-sm text-gray-500 dark:text-gray-400">CC</span>
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="cc@example.com"
                  className={inputClass}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-right text-sm text-gray-500 dark:text-gray-400">BCC</span>
                <input
                  type="text"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="bcc@example.com"
                  className={inputClass}
                />
              </div>
            </>
          )}

          {/* Subject */}
          <div className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-right text-sm text-gray-500 dark:text-gray-400">Betreff</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Betreff eingeben..."
              className={inputClass}
            />
          </div>

          {/* Body */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            placeholder="Nachricht schreiben..."
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end gap-3 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
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
