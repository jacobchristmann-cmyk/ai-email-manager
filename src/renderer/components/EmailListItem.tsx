import { useState, useRef, useEffect } from 'react'
import type { Email } from '../../shared/types'
import { useCategoryStore } from '../stores/categoryStore'
import { useChatStore } from '../stores/chatStore'
import { useEmailStore } from '../stores/emailStore'
import { useMailboxStore } from '../stores/mailboxStore'
import { useSettingsStore } from '../stores/settingsStore'

interface EmailListItemProps {
  email: Email
  isSelected: boolean
  onClick: () => void
}

export default function EmailListItem({
  email,
  isSelected,
  onClick
}: EmailListItemProps): React.JSX.Element {
  const categories = useCategoryStore((s) => s.categories)
  const category = email.categoryId ? categories.find((c) => c.id === email.categoryId) : null
  const analyzeEmail = useChatStore((s) => s.analyzeEmail)
  const { markRead, markUnread, deleteEmail, moveEmail, toggleStar, toggleSelectEmail, selectedIds } = useEmailStore()
  const isSelected2 = selectedIds.has(email.id)
  const mailboxes = useMailboxStore((s) => s.mailboxes)
  const emailDensity = useSettingsStore((s) => s.settings.emailDensity || 'comfortable')
  const densityPy = emailDensity === 'compact' ? 'py-1.5' : emailDensity === 'spacious' ? 'py-5' : 'py-3'

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const date = new Date(email.date)
  const isToday = new Date().toDateString() === date.toDateString()
  const dateStr = isToday
    ? date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })

  const snippet = email.body ? email.body.replace(/\s+/g, ' ').slice(0, 100) : ''

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    setShowMoveSubmenu(false)
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const closeMenu = (): void => {
    setContextMenu(null)
    setShowMoveSubmenu(false)
  }

  const handleAnalyze = (): void => {
    closeMenu()
    analyzeEmail(email.id, email.subject)
  }

  const handleMarkReadUnread = (): void => {
    closeMenu()
    if (email.isRead) {
      markUnread(email.id)
    } else {
      markRead(email.id)
    }
  }

  const handleDelete = (): void => {
    closeMenu()
    deleteEmail(email.id)
  }

  const handleMoveToTrash = (): void => {
    closeMenu()
    moveEmail(email.id, 'Trash')
  }

  const handleMove = (targetMailbox: string): void => {
    closeMenu()
    moveEmail(email.id, targetMailbox)
  }

  // Get available mailboxes for move submenu
  const accountMailboxes = mailboxes[email.accountId] || []
  const moveTargets = accountMailboxes.filter((mb) => mb.path !== email.mailbox)

  useEffect(() => {
    if (!contextMenu) return
    const handleClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [contextMenu])

  return (
    <>
      <div
        className={`group relative border-b border-gray-100 dark:border-gray-700 ${
          isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : isSelected2 ? 'bg-blue-50/60 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        {/* Checkbox (shown on hover or when selected) */}
        <div className="absolute left-1 top-1/2 -translate-y-1/2">
          <input
            type="checkbox"
            checked={isSelected2}
            onChange={() => toggleSelectEmail(email.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-3.5 w-3.5 cursor-pointer accent-blue-600 opacity-0 group-hover:opacity-100 data-[checked]:opacity-100"
            data-checked={isSelected2 || undefined}
          />
        </div>

        <button
          onClick={onClick}
          onContextMenu={handleContextMenu}
          className={`w-full px-4 text-left transition-colors ${densityPy} pl-6`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`truncate text-sm ${
                email.isRead ? 'text-gray-600 dark:text-gray-400' : 'font-semibold text-gray-900 dark:text-gray-100'
              }`}
            >
              {email.from.replace(/<[^>]+>/, '').trim() || email.from}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              {email.hasAttachments && (
                <span className="text-xs text-gray-400">📎</span>
              )}
              <span className="text-xs text-gray-400">{dateStr}</span>
            </div>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <p
              className={`min-w-0 flex-1 truncate text-sm ${
                email.isRead ? 'text-gray-500 dark:text-gray-400' : 'font-medium text-gray-800 dark:text-gray-200'
              }`}
            >
              {email.subject}
            </p>
            {category && (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: category.color }}
              >
                {category.name}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-gray-400">{snippet}</p>
        </button>

        {/* Star button */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleStar(email.id) }}
          className={`absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-sm transition-colors ${
            email.isStarred
              ? 'text-yellow-400'
              : 'text-gray-200 opacity-0 hover:text-yellow-400 group-hover:opacity-100 dark:text-gray-600'
          }`}
          title={email.isStarred ? 'Stern entfernen' : 'Mit Stern markieren'}
        >
          {email.isStarred ? '★' : '☆'}
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {/* Mark read/unread */}
          <button
            onClick={handleMarkReadUnread}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <span className="w-4 text-center text-xs">{email.isRead ? '\u2709' : '\u2714'}</span>
            {email.isRead ? 'Als ungelesen markieren' : 'Als gelesen markieren'}
          </button>

          {/* Move submenu */}
          <div className="relative">
            <button
              onClick={() => setShowMoveSubmenu(!showMoveSubmenu)}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <span className="w-4 text-center text-xs">{'\uD83D\uDCC2'}</span>
              Verschieben
              <svg className="ml-auto h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {showMoveSubmenu && moveTargets.length > 0 && (
              <div className="absolute left-full top-0 ml-1 min-w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
                {moveTargets.map((mb) => (
                  <button
                    key={mb.path}
                    onClick={() => handleMove(mb.path)}
                    className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    {mb.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Move to trash */}
          <button
            onClick={handleMoveToTrash}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <span className="w-4 text-center text-xs">{'\uD83D\uDDD1'}</span>
            In Papierkorb
          </button>

          {/* Divider */}
          <div className="my-1 border-t border-gray-200 dark:border-gray-700" />

          {/* Delete permanently */}
          <button
            onClick={handleDelete}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <span className="w-4 text-center text-xs">{'\u2716'}</span>
            Endgültig löschen
          </button>

          {/* Divider */}
          <div className="my-1 border-t border-gray-200 dark:border-gray-700" />

          {/* AI analyze */}
          <button
            onClick={handleAnalyze}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20"
          >
            <span className="w-4 text-center text-xs">{'\u2733'}</span>
            KI-Analyse
          </button>
        </div>
      )}
    </>
  )
}
