import { useEffect, useRef } from 'react'
import { useEmailStore } from '../stores/emailStore'
import EmailListItem from './EmailListItem'

export default function EmailList(): React.JSX.Element {
  const { selectedEmailId, selectEmail, isLoading, filteredEmails } = useEmailStore()
  const emails = filteredEmails()
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
    <div ref={listRef} className="h-full overflow-y-auto">
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
  )
}
