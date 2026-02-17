import { useState, useRef, useEffect } from 'react'
import type { Email } from '../../shared/types'
import { useCategoryStore } from '../stores/categoryStore'
import { useChatStore } from '../stores/chatStore'

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

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const date = new Date(email.date)
  const isToday = new Date().toDateString() === date.toDateString()
  const dateStr = isToday
    ? date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })

  const snippet = email.body.replace(/\s+/g, ' ').slice(0, 100)

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleAnalyze = (): void => {
    setContextMenu(null)
    analyzeEmail(email.id, email.subject)
  }

  useEffect(() => {
    if (!contextMenu) return
    const handleClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [contextMenu])

  return (
    <>
      <button
        onClick={onClick}
        onContextMenu={handleContextMenu}
        className={`w-full border-b border-gray-100 px-4 py-3 text-left transition-colors dark:border-gray-700 ${
          isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`truncate text-sm ${
              email.isRead ? 'text-gray-600 dark:text-gray-400' : 'font-semibold text-gray-900 dark:text-gray-100'
            }`}
          >
            {email.from.replace(/<[^>]+>/, '').trim() || email.from}
          </span>
          <span className="shrink-0 text-xs text-gray-400">{dateStr}</span>
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

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleAnalyze}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-purple-50 dark:text-gray-200 dark:hover:bg-purple-900/30"
          >
            <span className="text-purple-500">&#9733;</span>
            KI-Analyse dieser E-Mail
          </button>
        </div>
      )}
    </>
  )
}
