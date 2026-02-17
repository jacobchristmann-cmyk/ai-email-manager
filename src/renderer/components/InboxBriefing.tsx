import { useEffect, useState } from 'react'
import { useEmailStore } from '../stores/emailStore'
import type { Briefing, BriefingItem } from '../../shared/types'

const categoryConfig: Record<BriefingItem['category'], { label: string; color: string; bgColor: string; icon: string }> = {
  deadline: { label: 'Deadlines', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20', icon: '\u23F0' },
  important: { label: 'Wichtig', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/20', icon: '\u2B50' },
  newsletter: { label: 'Newsletter', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20', icon: '\uD83D\uDCE8' },
  other: { label: 'Sonstiges', color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-50 dark:bg-gray-800', icon: '\uD83D\uDCE7' }
}

const categoryOrder: BriefingItem['category'][] = ['deadline', 'important', 'other', 'newsletter']

function CategorySection({
  cat,
  items,
  onSelectEmail
}: {
  cat: BriefingItem['category']
  items: BriefingItem[]
  onSelectEmail: (id: string) => void
}): React.JSX.Element {
  const config = categoryConfig[cat]
  const [open, setOpen] = useState(cat === 'deadline' || cat === 'important')

  return (
    <div className={`mb-2 rounded-lg ${config.bgColor}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className={`text-xs font-semibold uppercase tracking-wide ${config.color}`}>
          {config.icon} {config.label} ({items.length})
        </span>
        <svg
          className={`ml-auto h-3.5 w-3.5 transition-transform ${config.color} ${open ? '' : '-rotate-90'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="space-y-1 px-2 pb-2">
          {items.map((item) => (
            <button
              key={item.emailId}
              onClick={() => onSelectEmail(item.emailId)}
              className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/70 dark:hover:bg-gray-700/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {item.subject}
                  </span>
                  {item.deadline && (
                    <span className="shrink-0 rounded bg-red-200 px-1.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/60 dark:text-red-300">
                      {item.deadline}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {item.from}
                  {item.mailbox && <span className="ml-1 text-gray-400 dark:text-gray-500">in {item.mailbox}</span>}
                  {' \u2014 '}{item.summary}
                </p>
              </div>
              <svg className="mt-1 h-3 w-3 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function InboxBriefing(): React.JSX.Element | null {
  const { selectEmail } = useEmailStore()
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      try {
        const result = await window.electronAPI.aiAssistantBriefing()
        if (cancelled) return
        if (result.success && result.data) {
          setBriefing(result.data)
        } else {
          setError(result.error || 'Briefing fehlgeschlagen')
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Briefing fehlgeschlagen')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (isLoading) {
    return (
      <button
        disabled
        className="mb-2 flex w-full items-center gap-2 rounded-lg bg-purple-50 px-3 py-2 text-left text-sm text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
      >
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
        Briefing wird erstellt...
      </button>
    )
  }

  if (error) {
    return (
      <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
        Briefing fehlgeschlagen: {error}
      </div>
    )
  }

  if (!briefing) return null

  if (briefing.totalUnread === 0) {
    return (
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
        <span>{'\u2705'}</span>
        Keine relevanten ungelesenen E-Mails — dein Postfach ist aufgeräumt!
      </div>
    )
  }

  const grouped = briefing.items.reduce<Record<string, BriefingItem[]>>((acc, item) => {
    const cat = item.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  const mailboxes = [...new Set(briefing.items.map((i) => i.mailbox).filter(Boolean))]
  const deadlineCount = grouped['deadline']?.length || 0
  const importantCount = grouped['important']?.length || 0

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="mb-2 flex w-full items-center gap-3 rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-2.5 text-left transition-colors hover:from-purple-100 hover:to-indigo-100 dark:border-purple-800 dark:from-purple-900/20 dark:to-indigo-900/20 dark:hover:from-purple-900/30 dark:hover:to-indigo-900/30"
      >
        <span className="text-base">{'\uD83D\uDCCB'}</span>
        <span className="text-sm font-medium text-purple-800 dark:text-purple-300">
          Tages-Briefing
        </span>
        <span className="rounded-full bg-purple-200 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-800 dark:text-purple-200">
          {briefing.totalUnread} ungelesen
        </span>
        {deadlineCount > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
            {deadlineCount} Deadline{deadlineCount > 1 ? 's' : ''}
          </span>
        )}
        {importantCount > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
            {importantCount} wichtig
          </span>
        )}
        <svg className="ml-auto h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    )
  }

  return (
    <div className="mb-3 rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 dark:border-purple-800 dark:from-purple-900/20 dark:to-indigo-900/20">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(false)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-base">{'\uD83D\uDCCB'}</span>
        <span className="text-sm font-semibold text-purple-800 dark:text-purple-300">
          Tages-Briefing
        </span>
        <span className="rounded-full bg-purple-200 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-800 dark:text-purple-200">
          {briefing.totalUnread} ungelesen
        </span>
        {mailboxes.length > 1 && (
          <span className="text-xs text-purple-500 dark:text-purple-400">
            {mailboxes.length} Postfächer
          </span>
        )}
        <svg className="ml-auto h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {/* Content */}
      <div className="border-t border-purple-200/50 px-4 pb-4 pt-2 dark:border-purple-700/30">
        <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">{briefing.overview}</p>

        {categoryOrder.map((cat) => {
          const items = grouped[cat]
          if (!items || items.length === 0) return null
          return (
            <CategorySection
              key={cat}
              cat={cat}
              items={items}
              onSelectEmail={selectEmail}
            />
          )
        })}
      </div>
    </div>
  )
}
