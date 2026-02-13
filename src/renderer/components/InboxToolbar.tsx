import { useState, useEffect, useRef } from 'react'
import { useEmailStore } from '../stores/emailStore'
import { useAccountStore } from '../stores/accountStore'
import { useCategoryStore } from '../stores/categoryStore'

export default function InboxToolbar(): React.JSX.Element {
  const { accounts } = useAccountStore()
  const { categories, isClassifying, classifyAll } = useCategoryStore()
  const {
    selectedAccountId,
    setSelectedAccountId,
    searchQuery,
    setSearchQuery,
    selectedCategoryId,
    setSelectedCategoryId,
    loadEmails
  } = useEmailStore()

  const [localSearch, setLocalSearch] = useState(searchQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setSearchQuery(localSearch)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [localSearch, setSearchQuery])

  const handleClassify = async (): Promise<void> => {
    await classifyAll()
    await loadEmails()
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      {/* Account filter */}
      <select
        value={selectedAccountId || ''}
        onChange={(e) => setSelectedAccountId(e.target.value || null)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      >
        <option value="">Alle Konten</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.email})
          </option>
        ))}
      </select>

      {/* Category filter */}
      <select
        value={selectedCategoryId || ''}
        onChange={(e) => setSelectedCategoryId(e.target.value || null)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      >
        <option value="">Alle Kategorien</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {/* Search */}
      <div className="relative flex-1">
        <input
          type="text"
          placeholder="E-Mails durchsuchen..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 pl-8 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
          🔍
        </span>
      </div>

      {/* AI Classify button */}
      <button
        onClick={handleClassify}
        disabled={isClassifying}
        className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
      >
        {isClassifying ? 'Klassifiziere...' : 'KI Kategorisieren'}
      </button>
    </div>
  )
}
