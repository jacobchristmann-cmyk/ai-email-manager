import { useState, useEffect } from 'react'
import { useEmailStore } from '../stores/emailStore'
import { useCategoryStore } from '../stores/categoryStore'

export default function EmailDetail(): React.JSX.Element {
  const selectedEmailId = useEmailStore((s) => s.selectedEmailId)
  const emails = useEmailStore((s) => s.emails)
  const openCompose = useEmailStore((s) => s.openCompose)
  const deleteEmail = useEmailStore((s) => s.deleteEmail)
  const setEmailCategory = useEmailStore((s) => s.setEmailCategory)
  const categories = useCategoryStore((s) => s.categories)

  const email = selectedEmailId ? emails.find((e) => e.id === selectedEmailId) : undefined

  // Local state for the category dropdown to ensure immediate UI feedback
  const [localCategoryId, setLocalCategoryId] = useState<string | null>(email?.categoryId ?? null)

  // Sync local state when the selected email changes or store updates
  useEffect(() => {
    setLocalCategoryId(email?.categoryId ?? null)
  }, [email?.categoryId, selectedEmailId])

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
    })
  }

  const handleDelete = (): void => {
    if (confirm('Möchtest du diese E-Mail wirklich löschen?')) {
      deleteEmail(email.id)
    }
  }

  const iframeSrcDoc = email.bodyHtml
    ? `<!DOCTYPE html><html><head><style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; margin: 8px; color: #374151; }
        @media (prefers-color-scheme: dark) { body { color: #D1D5DB; background: #1F2937; } a { color: #60A5FA; } }
      </style></head><body>${email.bodyHtml}</body></html>`
    : null

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{email.subject}</h2>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={handleReply}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Antworten
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {iframeSrcDoc ? (
          <iframe
            srcDoc={iframeSrcDoc}
            sandbox=""
            className="h-full w-full border-0"
            title="E-Mail-Inhalt"
          />
        ) : (
          <pre className="whitespace-pre-wrap break-words font-sans text-sm text-gray-700 dark:text-gray-300">
            {email.body}
          </pre>
        )}
      </div>
    </div>
  )
}
