import { useState, useEffect, useMemo } from 'react'
import { useEmailStore } from '../stores/emailStore'
import { useCategoryStore } from '../stores/categoryStore'
import type { ActionItem, SmartReplyResult } from '../../shared/types'
import SnoozeDialog from './SnoozeDialog'

function actionIcon(type: ActionItem['type']): string {
  const map: Record<ActionItem['type'], string> = { reply: '✉️', deadline: '⏰', confirm: '✅', document: '📄', meeting: '📅', other: '📌' }
  return map[type] ?? '📌'
}

export default function EmailDetail(): React.JSX.Element {
  const selectedEmailId = useEmailStore((s) => s.selectedEmailId)
  const emails = useEmailStore((s) => s.emails)
  const snoozedEmails = useEmailStore((s) => s.snoozedEmails)
  const selectEmail = useEmailStore((s) => s.selectEmail)
  const openCompose = useEmailStore((s) => s.openCompose)
  const deleteEmail = useEmailStore((s) => s.deleteEmail)
  const setEmailCategory = useEmailStore((s) => s.setEmailCategory)
  const loadEmails = useEmailStore((s) => s.loadEmails)
  const isBodyLoading = useEmailStore((s) => s.isBodyLoading)
  const isDetectingActions = useEmailStore((s) => s.isDetectingActions)
  const snoozeEmail = useEmailStore((s) => s.snoozeEmail)
  const unsnoozeEmail = useEmailStore((s) => s.unsnoozeEmail)
  const categories = useCategoryStore((s) => s.categories)

  const email = selectedEmailId
    ? (emails.find((e) => e.id === selectedEmailId) ?? snoozedEmails.find((e) => e.id === selectedEmailId))
    : undefined

  const [showSnooze, setShowSnooze] = useState(false)

  // Thread: find related emails by threadId or matching subject (Re:/Fwd: stripped)
  const threadEmails = useMemo(() => {
    if (!email) return []
    const baseSubject = email.subject.replace(/^(Re:|Fwd:|AW:|Antwort:|WG:)\s*/i, '').trim().toLowerCase()
    return emails
      .filter((e) => {
        if (e.id === email.id) return false
        if (email.threadId && e.threadId === email.threadId) return true
        if (email.messageId && e.inReplyTo === email.messageId) return true
        if (email.inReplyTo && e.messageId === email.inReplyTo) return true
        const eSub = e.subject.replace(/^(Re:|Fwd:|AW:|Antwort:|WG:)\s*/i, '').trim().toLowerCase()
        return eSub === baseSubject && eSub.length > 3
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10)
  }, [email, emails])

  // Local state for the category dropdown to ensure immediate UI feedback
  const [localCategoryId, setLocalCategoryId] = useState<string | null>(email?.categoryId ?? null)

  // Star state
  const [isStarred, setIsStarred] = useState(email?.isStarred ?? false)
  useEffect(() => { setIsStarred(email?.isStarred ?? false) }, [email?.isStarred, selectedEmailId])

  // Unsubscribe state
  const [isUnsubscribing, setIsUnsubscribing] = useState(false)
  const [unsubscribeResult, setUnsubscribeResult] = useState<'post' | 'browser' | null>(null)
  const [unsubscribeError, setUnsubscribeError] = useState<string | null>(null)
  const [unsubscribeLogId, setUnsubscribeLogId] = useState<string | null>(null)
  const [unsubscribeConfirmed, setUnsubscribeConfirmed] = useState(false)

  // Smart reply state
  const [smartReplies, setSmartReplies] = useState<SmartReplyResult | null>(null)
  const [isLoadingReplies, setIsLoadingReplies] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  const [replyLanguage, setReplyLanguage] = useState('Deutsch')

  // Sync local state when the selected email changes or store updates
  useEffect(() => {
    setLocalCategoryId(email?.categoryId ?? null)
  }, [email?.categoryId, selectedEmailId])

  const handleToggleStar = async (): Promise<void> => {
    if (!email) return
    const newVal = !isStarred
    setIsStarred(newVal)
    if (newVal) await window.electronAPI.emailStar(email.id)
    else await window.electronAPI.emailUnstar(email.id)
  }

  // Reset smart replies, unsubscribe state and snooze dialog when email changes
  useEffect(() => {
    setSmartReplies(null)
    setReplyError(null)
    setUnsubscribeResult(null)
    setUnsubscribeError(null)
    setUnsubscribeLogId(null)
    setUnsubscribeConfirmed(false)
    setShowSnooze(false)
  }, [selectedEmailId])

  if (!email) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Wähle eine E-Mail aus, um sie anzuzeigen.
      </div>
    )
  }

  const date = new Date(email.date).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  const currentCategory = localCategoryId
    ? categories.find((c) => c.id === localCategoryId)
    : null

  const handleReply = (): void => {
    const fromName = email.from.replace(/<[^>]+>/, '').trim()
    const fromEmail = email.from.match(/<([^>]+)>/)?.[1] || email.from
    const quotedBody = `\n\n--- Ursprüngliche Nachricht ---\nVon: ${email.from}\nDatum: ${date}\nBetreff: ${email.subject}\n\n${email.body}`
    openCompose({
      accountId: email.accountId,
      to: fromEmail || fromName,
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body: quotedBody
    }, email.id)
  }

  const handleForward = (): void => {
    const quotedBody = `\n\n--- Weitergeleitete Nachricht ---\nVon: ${email.from}\nAn: ${email.to}\nDatum: ${date}\nBetreff: ${email.subject}\n\n${email.body}`
    openCompose({
      accountId: email.accountId,
      to: '',
      subject: email.subject.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`,
      body: quotedBody
    })
  }

  const handleSmartReply = async (): Promise<void> => {
    if (!email) return
    setIsLoadingReplies(true)
    setReplyError(null)
    setSmartReplies(null)
    const result = await window.electronAPI.emailSmartReply(email.id, replyLanguage)
    if (result.success && result.data) {
      setSmartReplies(result.data)
    } else {
      setReplyError(result.error ?? 'Fehler bei der KI-Antwortgenerierung')
    }
    setIsLoadingReplies(false)
  }

  const handleUseReply = (replyBody: string): void => {
    if (!email) return
    const fromEmail = email.from.match(/<([^>]+)>/)?.[1] || email.from.replace(/<[^>]+>/, '').trim()
    const quotedBody = `${replyBody}\n\n--- Ursprüngliche Nachricht ---\nVon: ${email.from}\nDatum: ${date}\nBetreff: ${email.subject}\n\n${email.body}`
    openCompose({
      accountId: email.accountId,
      to: fromEmail,
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body: quotedBody
    })
  }

  const handleDelete = (): void => {
    if (confirm('Möchtest du diese E-Mail wirklich löschen?')) {
      deleteEmail(email.id)
    }
  }

  const iframeSrcDoc = email.bodyHtml
    ? `<!DOCTYPE html><html><head>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https:; img-src * data: blob:; font-src https: data:;">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; margin: 8px; color: #374151; }
          @media (prefers-color-scheme: dark) { body { color: #D1D5DB; background: #1F2937; } a { color: #60A5FA; } }
        </style>
      </head><body>${email.bodyHtml}</body></html>`
    : null

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {showSnooze && (
        <SnoozeDialog
          onSnooze={(until) => { snoozeEmail(email.id, until); setShowSnooze(false) }}
          onClose={() => setShowSnooze(false)}
        />
      )}
      {/* Header */}
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{email.subject}</h2>
          <div className="flex shrink-0 gap-2">
            {email.categoryId === 'cat-newsletter' && (
              <>
                <button
                  onClick={async () => {
                    setIsUnsubscribing(true)
                    setUnsubscribeError(null)
                    setUnsubscribeResult(null)
                    const result = await window.electronAPI.emailUnsubscribe(email.id)
                    if (result.success && result.data) {
                      setUnsubscribeResult(result.data.method)
                      setUnsubscribeLogId(result.data.logId)
                      if (result.data.status === 'confirmed') {
                        setUnsubscribeConfirmed(true)
                      }
                      // Reload emails since the email was moved
                      loadEmails()
                    } else {
                      setUnsubscribeError(result.error ?? 'Kein Abmelde-Link gefunden')
                    }
                    setIsUnsubscribing(false)
                  }}
                  disabled={isUnsubscribing || unsubscribeResult !== null}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white ${
                    unsubscribeResult
                      ? 'bg-green-600'
                      : unsubscribeError
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'bg-orange-500 hover:bg-orange-600'
                  } disabled:opacity-60`}
                  title={unsubscribeError || undefined}
                >
                  {isUnsubscribing
                    ? 'Wird abgemeldet…'
                    : unsubscribeResult === 'post'
                      ? 'Abgemeldet ✓'
                      : unsubscribeResult === 'browser'
                        ? 'Link geöffnet'
                        : unsubscribeError
                          ? 'Kein Link gefunden'
                          : 'Abmelden'}
                </button>
                {unsubscribeResult === 'browser' && unsubscribeLogId && !unsubscribeConfirmed && (
                  <button
                    onClick={async () => {
                      await window.electronAPI.unsubscribeConfirm(unsubscribeLogId)
                      setUnsubscribeConfirmed(true)
                    }}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Abmeldung bestätigen
                  </button>
                )}
                {unsubscribeConfirmed && unsubscribeResult === 'browser' && (
                  <span className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white">
                    Bestätigt
                  </span>
                )}
              </>
            )}
            {email.snoozeUntil ? (
              <button
                onClick={() => unsnoozeEmail(email.id)}
                title="Wiedervorlage aufheben"
                className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-900/20"
              >
                🕐 {new Date(email.snoozeUntil).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </button>
            ) : (
              <button
                onClick={() => setShowSnooze(true)}
                title="Zurückstellen"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-500 hover:border-blue-400 hover:text-blue-500 dark:border-gray-600 dark:text-gray-400"
              >
                🕐
              </button>
            )}
            <button
              onClick={handleToggleStar}
              title={isStarred ? 'Stern entfernen' : 'Mit Stern markieren'}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isStarred
                  ? 'bg-yellow-400 text-white hover:bg-yellow-500'
                  : 'border border-gray-300 text-gray-500 hover:border-yellow-400 hover:text-yellow-500 dark:border-gray-600 dark:text-gray-400'
              }`}
            >
              {isStarred ? '★' : '☆'}
            </button>
            <button
              onClick={handleReply}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Antworten
            </button>
            <button
              onClick={handleForward}
              className="rounded-lg bg-gray-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-600"
            >
              Weiterleiten
            </button>
            <button
              onClick={handleDelete}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              Löschen
            </button>
          </div>
        </div>
        <div className="mt-2 space-y-1 text-sm text-gray-500 dark:text-gray-400">
          <p>
            <span className="font-medium text-gray-700 dark:text-gray-300">Von:</span> {email.from}
          </p>
          <p>
            <span className="font-medium text-gray-700 dark:text-gray-300">An:</span> {email.to}
          </p>
          <p>
            <span className="font-medium text-gray-700 dark:text-gray-300">Datum:</span> {date}
          </p>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700 dark:text-gray-300">Kategorie:</span>
            <select
              value={localCategoryId || ''}
              onChange={(e) => {
                const newId = e.target.value || null
                setLocalCategoryId(newId)
                setEmailCategory(email.id, newId)
              }}
              className="rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              style={currentCategory ? { borderColor: currentCategory.color } : undefined}
            >
              <option value="">Keine Kategorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {currentCategory && (
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: currentCategory.color }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Smart Reply */}
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        {!smartReplies && !isLoadingReplies && (
          <div className="flex items-center gap-2">
            <select
              value={replyLanguage}
              onChange={(e) => setReplyLanguage(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-purple-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="Deutsch">Deutsch</option>
              <option value="English">English</option>
            </select>
            <button
              onClick={handleSmartReply}
              className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
            >
              KI-Antwort
            </button>
          </div>
        )}

        {isLoadingReplies && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            KI generiert Antwortvorschläge…
          </div>
        )}

        {replyError && (
          <div className="text-sm text-red-500">{replyError}</div>
        )}

        {smartReplies && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {smartReplies.shortReplies.map((reply, i) => (
                <button
                  key={i}
                  onClick={() => handleUseReply(reply)}
                  className="rounded-full border border-purple-300 bg-purple-50 px-3 py-1.5 text-sm text-purple-700 hover:bg-purple-100 dark:border-purple-600 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
                >
                  {reply}
                </button>
              ))}
            </div>
            <button
              onClick={() => handleUseReply(smartReplies.fullReply)}
              className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-sm text-purple-700 hover:bg-purple-100 dark:border-purple-600 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
            >
              Ausführliche Antwort verwenden
            </button>
          </div>
        )}
      </div>

      {/* Action Items */}
      {(email.actionItems.length > 0 || isDetectingActions) && (
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Aufgaben</p>
          {isDetectingActions && email.actionItems.length === 0 && (
            <p className="text-xs text-gray-400">KI analysiert…</p>
          )}
          <div className="space-y-1.5">
            {email.actionItems.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-base">{actionIcon(item.type)}</span>
                <span className="flex-1 text-gray-700 dark:text-gray-200">{item.text}</span>
                {item.dueDate && (
                  <span className="shrink-0 text-xs text-orange-500">
                    {new Date(item.dueDate).toLocaleDateString('de-DE')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attachments */}
      {email.hasAttachments && email.attachments.length > 0 && (
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Anhänge</p>
          <div className="flex flex-wrap gap-2">
            {email.attachments.map((att) => (
              <button
                key={att.filename}
                onClick={() => att.tempPath && window.electronAPI.emailOpenAttachment(email.id, att.tempPath)}
                disabled={!att.tempPath}
                title={att.tempPath ? att.filename : 'Anhang erst nach vollständigem Laden verfügbar'}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 hover:border-blue-300 hover:bg-blue-50 disabled:cursor-default disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
              >
                <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="max-w-40 truncate">{att.filename}</span>
                <span className="shrink-0 text-xs text-gray-400">
                  {att.size < 1024 ? `${att.size} B` : att.size < 1048576 ? `${Math.round(att.size / 1024)} KB` : `${(att.size / 1048576).toFixed(1)} MB`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {isBodyLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-11/12" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-9/12" />
          </div>
        ) : !email.hasBody ? (
          <p className="text-sm italic text-gray-400 dark:text-gray-500">
            Inhalt nicht verfügbar
          </p>
        ) : iframeSrcDoc ? (
          <iframe
            srcDoc={iframeSrcDoc}
            className="h-full w-full border-0"
            title="E-Mail-Inhalt"
          />
        ) : (
          <pre className="whitespace-pre-wrap break-words font-sans text-sm text-gray-700 dark:text-gray-300">
            {email.body}
          </pre>
        )}
      </div>

      {/* Thread */}
      {threadEmails.length > 0 && (
        <div className="shrink-0 border-t border-gray-200 dark:border-gray-700">
          <div className="px-4 py-2">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              Konversation ({threadEmails.length + 1} Nachrichten)
            </p>
            <div className="space-y-1">
              {threadEmails.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectEmail(t.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${t.isRead ? 'bg-gray-300 dark:bg-gray-600' : 'bg-blue-500'}`} />
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-300">
                    {t.from.replace(/<[^>]+>/, '').trim() || t.from}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {new Date(t.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
