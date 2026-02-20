import { useState, useEffect, useRef, useCallback } from 'react'
import { useEmailStore } from '../stores/emailStore'
import { useAccountStore } from '../stores/accountStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useTemplateStore } from '../stores/templateStore'

const DRAFT_KEY = 'compose-draft'

function resolveTemplateVars(
  templateBody: string,
  ctx: { to: string; subject: string; accountName: string; accountEmail: string }
): string {
  const date = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return templateBody
    .replace(/\{\{Empfänger\}\}/g, ctx.to)
    .replace(/\{\{Betreff\}\}/g, ctx.subject)
    .replace(/\{\{Datum\}\}/g, date)
    .replace(/\{\{MeinName\}\}/g, ctx.accountName)
    .replace(/\{\{MeineEmail\}\}/g, ctx.accountEmail)
}

export default function ComposeModal(): React.JSX.Element | null {
  const { composeOpen, composeData, composeEmailId, closeCompose, sendEmail, isSending } = useEmailStore()
  const { accounts } = useAccountStore()
  const signature = useSettingsStore((s) => s.settings.signature || '')
  const { templates, loadTemplates } = useTemplateStore()

  const [accountId, setAccountId] = useState('')
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [showCcBcc, setShowCcBcc] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState<{ filename: string; path: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [isGeneratingAiReply, setIsGeneratingAiReply] = useState(false)

  // Contact autocomplete
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [activeField, setActiveField] = useState<'to' | 'cc' | 'bcc' | null>(null)

  const toRef = useRef<HTMLInputElement>(null)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load templates when compose opens
  useEffect(() => {
    if (composeOpen) loadTemplates()
  }, [composeOpen, loadTemplates])

  // Load draft / prefill on open
  useEffect(() => {
    if (!composeOpen) return

    const sig = signature ? `\n\n--\n${signature}` : ''
    const isPrefilled = composeData && Object.keys(composeData).length > 0

    if (isPrefilled) {
      setAccountId(composeData!.accountId || accounts[0]?.id || '')
      setTo(composeData!.to || '')
      setCc(composeData!.cc || '')
      setBcc(composeData!.bcc || '')
      setShowCcBcc(!!(composeData!.cc || composeData!.bcc))
      setSubject(composeData!.subject || '')
      setBody(composeData!.body ? composeData!.body + sig : sig)
      setAttachments([])
    } else {
      try {
        const saved = localStorage.getItem(DRAFT_KEY)
        if (saved) {
          const draft = JSON.parse(saved)
          setAccountId(draft.accountId || accounts[0]?.id || '')
          setTo(draft.to || '')
          setCc(draft.cc || '')
          setBcc(draft.bcc || '')
          setShowCcBcc(!!(draft.cc || draft.bcc))
          setSubject(draft.subject || '')
          setBody(draft.body || sig)
          setAttachments(draft.attachments || [])
        } else {
          setAccountId(accounts[0]?.id || '')
          setTo(''); setCc(''); setBcc('')
          setShowCcBcc(false)
          setSubject('')
          setBody(sig)
          setAttachments([])
        }
      } catch {
        setAccountId(accounts[0]?.id || '')
        setTo(''); setCc(''); setBcc('')
        setShowCcBcc(false); setSubject(''); setBody(sig); setAttachments([])
      }
    }

    setError(null)
    setSuggestions([])
    setTimeout(() => toRef.current?.focus(), 50)
  }, [composeOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save draft (debounced 1s) — only for new composes
  const saveDraft = useCallback(() => {
    const isPrefilled = composeData && Object.keys(composeData).length > 0
    if (!composeOpen || isPrefilled) return
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ accountId, to, cc, bcc, subject, body, attachments }))
      } catch { /* ignore */ }
    }, 1000)
  }, [composeOpen, composeData, accountId, to, cc, bcc, subject, body, attachments])

  useEffect(() => { saveDraft() }, [accountId, to, cc, bcc, subject, body, attachments, saveDraft])

  // Contact autocomplete
  const fetchSuggestions = useCallback(async (query: string, field: 'to' | 'cc' | 'bcc') => {
    const last = query.split(',').pop()?.trim() || ''
    if (last.length < 2) { setSuggestions([]); setActiveField(null); return }
    setActiveField(field)
    const result = await window.electronAPI.emailContactSuggest(last)
    if (result.success && result.data && result.data.length > 0) setSuggestions(result.data)
    else setSuggestions([])
  }, [])

  const applySuggestion = (suggestion: string, field: 'to' | 'cc' | 'bcc'): void => {
    const setter = field === 'to' ? setTo : field === 'cc' ? setCc : setBcc
    const current = field === 'to' ? to : field === 'cc' ? cc : bcc
    const parts = current.split(',')
    parts[parts.length - 1] = suggestion
    setter(parts.join(',').trimStart() + ', ')
    setSuggestions([])
    setActiveField(null)
  }

  // Escape closes, Ctrl/Cmd+Enter sends
  useEffect(() => {
    if (!composeOpen) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        if (showTemplates) { setShowTemplates(false); return }
        if (suggestions.length > 0) { setSuggestions([]); return }
        closeCompose()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSend()
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [composeOpen, accountId, to, subject, body, cc, bcc, suggestions, showTemplates]) // eslint-disable-line react-hooks/exhaustive-deps

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
      body,
      attachments: attachments.length > 0 ? attachments : undefined
    })
    if (success) {
      localStorage.removeItem(DRAFT_KEY)
    } else {
      setError('Fehler beim Senden der E-Mail.')
    }
  }

  const handleAddAttachment = async (): Promise<void> => {
    const result = await window.electronAPI.dialogOpenFile()
    if (result.success && result.data && result.data.length > 0) {
      setAttachments((prev) => [
        ...prev,
        ...result.data!.filter((f) => !prev.some((p) => p.path === f.path))
      ])
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
          <div className="relative flex items-center gap-2">
            <span className="w-14 shrink-0 text-right text-sm text-gray-500 dark:text-gray-400">An</span>
            <input
              ref={toRef}
              type="text"
              value={to}
              onChange={(e) => { setTo(e.target.value); fetchSuggestions(e.target.value, 'to') }}
              onBlur={() => setTimeout(() => { setSuggestions([]); setActiveField(null) }, 150)}
              placeholder="empfänger@example.com"
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
            {activeField === 'to' && suggestions.length > 0 && (
              <div className="absolute left-16 top-full z-10 mt-1 max-h-40 w-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
                {suggestions.map((s) => (
                  <button key={s} onMouseDown={() => applySuggestion(s, 'to')}
                    className="w-full truncate px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {showCcBcc && (
            <>
              <div className="relative flex items-center gap-2">
                <span className="w-14 shrink-0 text-right text-sm text-gray-500 dark:text-gray-400">CC</span>
                <input type="text" value={cc}
                  onChange={(e) => { setCc(e.target.value); fetchSuggestions(e.target.value, 'cc') }}
                  onBlur={() => setTimeout(() => { setSuggestions([]); setActiveField(null) }, 150)}
                  placeholder="cc@example.com" className={inputClass} />
                {activeField === 'cc' && suggestions.length > 0 && (
                  <div className="absolute left-16 top-full z-10 mt-1 max-h-40 w-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
                    {suggestions.map((s) => (
                      <button key={s} onMouseDown={() => applySuggestion(s, 'cc')}
                        className="w-full truncate px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700">{s}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative flex items-center gap-2">
                <span className="w-14 shrink-0 text-right text-sm text-gray-500 dark:text-gray-400">BCC</span>
                <input type="text" value={bcc}
                  onChange={(e) => { setBcc(e.target.value); fetchSuggestions(e.target.value, 'bcc') }}
                  onBlur={() => setTimeout(() => { setSuggestions([]); setActiveField(null) }, 150)}
                  placeholder="bcc@example.com" className={inputClass} />
                {activeField === 'bcc' && suggestions.length > 0 && (
                  <div className="absolute left-16 top-full z-10 mt-1 max-h-40 w-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
                    {suggestions.map((s) => (
                      <button key={s} onMouseDown={() => applySuggestion(s, 'bcc')}
                        className="w-full truncate px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700">{s}</button>
                    ))}
                  </div>
                )}
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

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((a) => (
                <div key={a.path} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  <span className="max-w-40 truncate">{a.filename}</span>
                  <button onClick={() => setAttachments((prev) => prev.filter((x) => x.path !== a.path))}
                    className="ml-1 text-gray-400 hover:text-red-500">✕</button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-gray-200 px-5 py-3 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddAttachment}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Anhang
            </button>

            {/* Template picker / AI reply */}
            {(templates.length > 0 || composeEmailId) && (
              <div className="relative">
                <button
                  onClick={() => setShowTemplates((v) => !v)}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Vorlage
                </button>
                {showTemplates && (
                  <div className="absolute bottom-full left-0 z-20 mb-1 min-w-[220px] rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
                    {templates.length > 0 && (
                      <>
                        <p className="border-b border-gray-100 px-3 py-1.5 text-xs font-medium text-gray-400 dark:border-gray-700 dark:text-gray-500">
                          Vorlage einfügen
                        </p>
                        {templates.map((tpl) => (
                          <button
                            key={tpl.id}
                            onMouseDown={() => {
                              const account = accounts.find((a) => a.id === accountId)
                              const resolved = resolveTemplateVars(tpl.body, {
                                to,
                                subject,
                                accountName: account?.name || '',
                                accountEmail: account?.email || ''
                              })
                              setBody(resolved + '\n\n' + body.trimStart())
                              setShowTemplates(false)
                            }}
                            className="flex w-full items-center px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                          >
                            {tpl.name}
                          </button>
                        ))}
                      </>
                    )}
                    {composeEmailId && (
                      <>
                        {templates.length > 0 && (
                          <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                        )}
                        <button
                          onMouseDown={async () => {
                            setShowTemplates(false)
                            setIsGeneratingAiReply(true)
                            try {
                              const result = await window.electronAPI.emailSmartReply(composeEmailId, 'de')
                              if (result.success && result.data) {
                                setBody(result.data.fullReply + '\n\n' + body.trimStart())
                              } else {
                                setError(result.error ?? 'KI-Antwort konnte nicht generiert werden.')
                              }
                            } finally {
                              setIsGeneratingAiReply(false)
                            }
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                        >
                          <span>✨</span>
                          KI-Antwort generieren
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            {isGeneratingAiReply && (
              <span className="text-xs text-gray-400 animate-pulse">KI generiert Antwort…</span>
            )}
          </div>
          <div className="flex gap-3">
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
    </div>
  )
}
