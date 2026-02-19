import { useEffect, useRef } from 'react'
import { useEmailStore } from '../stores/emailStore'
import EmailListItem from './EmailListItem'

export default function EmailList(): React.JSX.Element {
  const { selectedEmailId, selectEmail, isLoading, filteredEmails, selectedIds, selectAllVisible, clearSelection, bulkMarkRead, bulkMarkUnread, bulkDelete } = useEmailStore()
  const emails = filteredEmails()
  const hasSelection = selectedIds.size > 0
  const listRef = useRef<HTMLDivElement>(null)

  // J/K or ArrowDown/ArrowUp to navigate emails
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (e.key !== 'j' && e.key !== 'k' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      const idx = emails.findIndex((em) => em.id === selectedEmailId)
      if (e.key === 'j' || e.key === 'ArrowDown') {
        const next = emails[idx + 1]
        if (next) selectEmail(next.id)
      } else {
        const prev = emails[idx - 1]
        if (prev) selectEmail(prev.id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [emails, selectedEmailId, selectEmail])

  // Scroll selected item into view
  useEffect(() => {
    if (!selectedEmailId || !listRef.current) return
    const el = listRef.current.querySelector('[data-email-id="' + selectedEmailId + '"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedEmailId])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Lade E-Mails...
      </div>
    )
  }

  if (emails.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-gray-400">
        Keine E-Mails vorhanden. Klicke auf Sync, um E-Mails abzurufen.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Bulk action bar */}
      {hasSelection && (
        <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-blue-50 px-3 py-2 dark:border-gray-700 dark:bg-blue-900/20">
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{selectedIds.size} ausgewählt</span>
          <button onClick={bulkMarkRead} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-700">Gelesen</button>
          <button onClick={bulkMarkUnread} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-700">Ungelesen</button>
          <button onClick={() => { if (confirm(`${selectedIds.size} E-Mails löschen?`)) bulkDelete() }} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-white dark:text-red-400 dark:hover:bg-gray-700">Löschen</button>
          <button onClick={() => selectAllVisible(emails.map((e) => e.id))} className="ml-auto rounded px-2 py-1 text-xs text-gray-500 hover:bg-white dark:text-gray-400 dark:hover:bg-gray-700">Alle</button>
          <button onClick={clearSelection} className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-white dark:text-gray-400 dark:hover:bg-gray-700">✕</button>
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto">
        {emails.map((email) => (
          <div key={email.id} data-email-id={email.id}>
            <EmailListItem
              email={email}
              isSelected={email.id === selectedEmailId}
              onClick={() => selectEmail(email.id)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
