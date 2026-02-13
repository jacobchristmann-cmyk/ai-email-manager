import type { Email } from '../../shared/types'
import { useCategoryStore } from '../stores/categoryStore'

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

  const date = new Date(email.date)
  const isToday = new Date().toDateString() === date.toDateString()
  const dateStr = isToday
    ? date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })

  const snippet = email.body.replace(/\s+/g, ' ').slice(0, 100)

  return (
    <button
      onClick={onClick}
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
  )
}
