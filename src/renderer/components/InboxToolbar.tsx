import { useState, useEffect, useRef } from 'react'
import { useEmailStore } from '../stores/emailStore'
import { useAccountStore } from '../stores/accountStore'
import { useCategoryStore } from '../stores/categoryStore'
import { useChatStore } from '../stores/chatStore'

export default function InboxToolbar(): React.JSX.Element {
  const { accounts } = useAccountStore()
  const { categories, isClassifying, error: classifyError, classifyAll } = useCategoryStore()
  const { isOpen: isAssistantOpen, toggle: toggleAssistant } = useChatStore()
  const {
    selectedAccountId,
    setSelectedAccountId,
    searchQuery,
    setSearchQuery,
    selectedCategoryId,
    setSelectedCategoryId,
    loadEmails,
    aiSearchMode,
    setAiSearchMode,
    aiSearch,
    clearAiSearch,
    isAiSearching,
    aiSearchResults,
    aiSearchError,
    isAdvancedSearchOpen,
    toggleAdvancedSearch,
    advancedSearchFilters,
    setAdvancedSearchFilters,
    executeAdvancedSearch,
    clearAdvancedSearch,
    isAdvancedSearchActive,
    searchResultCount
  } = useEmailStore()

  const [localSearch, setLocalSearch] = useState(searchQuery)
  const [classifyResult, setClassifyResult] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const advancedDebounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (aiSearchMode) return // No debounce in AI mode
    debounceRef.current = setTimeout(() => {
      setSearchQuery(localSearch)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [localSearch, setSearchQuery, aiSearchMode])

  // Live advanced search: debounce filter changes and auto-execute
  useEffect(() => {
    if (!isAdvancedSearchOpen) return
    const hasAnyFilter = advancedSearchFilters.from || advancedSearchFilters.to ||
      advancedSearchFilters.subject || advancedSearchFilters.dateFrom ||
      advancedSearchFilters.dateTo || advancedSearchFilters.isRead !== undefined ||
      advancedSearchFilters.categoryId
    if (!hasAnyFilter) {
      if (isAdvancedSearchActive) clearAdvancedSearch()
      return
    }
    advancedDebounceRef.current = setTimeout(() => {
      executeAdvancedSearch()
    }, 400)
    return () => clearTimeout(advancedDebounceRef.current)
  }, [advancedSearchFilters]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClassify = async (): Promise<void> => {
    setClassifyResult(null)
    const results = await classifyAll()
    const count = Object.keys(results).length
    if (count > 0) {
      setClassifyResult(`${count} E-Mail(s) kategorisiert`)
      await loadEmails()
    } else if (!useCategoryStore.getState().error) {
      setClassifyResult('Keine unkategorisierten E-Mails gefunden')
    }
    setTimeout(() => setClassifyResult(null), 5000)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && aiSearchMode && localSearch.trim()) {
      aiSearch(localSearch)
    }
  }

  const handleToggleAiSearch = (): void => {
    if (aiSearchMode) {
      // Switching back to text search
      setAiSearchMode(false)
      clearAiSearch()
      setLocalSearch('')
      setSearchQuery('')
    } else {
      // Switching to AI search
      setAiSearchMode(true)
      setSearchQuery('')
      setLocalSearch('')
    }
  }

  const handleClearAiSearch = (): void => {
    clearAiSearch()
    setLocalSearch('')
  }

  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
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

        {/* Search with AI toggle */}
        <div className="relative flex flex-1 items-center gap-1">
          <button
            onClick={handleToggleAiSearch}
            title={aiSearchMode ? 'Zur normalen Suche wechseln' : 'KI-Suche aktivieren'}
            className={`rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${
              aiSearchMode
                ? 'bg-purple-600 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500'
            }`}
          >
            KI
          </button>
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={aiSearchMode ? 'KI-Suche... (Enter zum Suchen)' : 'E-Mails durchsuchen...'}
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className={`w-full rounded-lg border bg-white px-3 py-1.5 pl-8 text-sm focus:outline-none dark:bg-gray-700 dark:text-gray-100 ${
                aiSearchMode
                  ? 'border-purple-400 focus:border-purple-500 dark:border-purple-500'
                  : 'border-gray-300 focus:border-blue-500 dark:border-gray-600'
              }`}
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
              {isAiSearching ? (
                <span className="inline-block animate-spin">{'\u25F0'}</span>
              ) : aiSearchMode ? (
                '\u2605'
              ) : (
                '\uD83D\uDD0D'
              )}
            </span>
          </div>
          {aiSearchMode && aiSearchResults && (
            <button
              onClick={handleClearAiSearch}
              title="KI-Ergebnisse zurücksetzen"
              className="rounded-lg bg-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
            >
              ✕
            </button>
          )}
        </div>

        {/* Advanced filter toggle */}
        <button
          onClick={toggleAdvancedSearch}
          title={isAdvancedSearchOpen ? 'Filter ausblenden' : 'Erweiterte Filter'}
          className={`rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${
            isAdvancedSearchActive
              ? 'bg-blue-600 text-white'
              : isAdvancedSearchOpen
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500'
          }`}
        >
          Filter
        </button>

        {/* AI Classify button */}
        <button
          onClick={handleClassify}
          disabled={isClassifying}
          className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {isClassifying ? 'Klassifiziere...' : 'KI Kategorisieren'}
        </button>

        {/* AI Assistant toggle */}
        <button
          onClick={toggleAssistant}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            isAssistantOpen
              ? 'bg-purple-700 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500'
          }`}
        >
          KI-Assistent
        </button>
      </div>

      {/* Advanced search filters */}
      {isAdvancedSearchOpen && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-800">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Von</label>
            <input
              type="text"
              placeholder="Absender..."
              value={advancedSearchFilters.from ?? ''}
              onChange={(e) => setAdvancedSearchFilters({ from: e.target.value || undefined })}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">An</label>
            <input
              type="text"
              placeholder="Empfänger..."
              value={advancedSearchFilters.to ?? ''}
              onChange={(e) => setAdvancedSearchFilters({ to: e.target.value || undefined })}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Betreff</label>
            <input
              type="text"
              placeholder="Betreff..."
              value={advancedSearchFilters.subject ?? ''}
              onChange={(e) => setAdvancedSearchFilters({ subject: e.target.value || undefined })}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Kategorie</label>
            <select
              value={advancedSearchFilters.categoryId ?? ''}
              onChange={(e) => setAdvancedSearchFilters({ categoryId: e.target.value || undefined })}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="">Alle</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Datum von</label>
            <input
              type="date"
              value={advancedSearchFilters.dateFrom ?? ''}
              onChange={(e) => setAdvancedSearchFilters({ dateFrom: e.target.value || undefined })}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Datum bis</label>
            <input
              type="date"
              value={advancedSearchFilters.dateTo ?? ''}
              onChange={(e) => setAdvancedSearchFilters({ dateTo: e.target.value || undefined })}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Status</label>
            <select
              value={advancedSearchFilters.isRead === undefined ? '' : advancedSearchFilters.isRead ? 'read' : 'unread'}
              onChange={(e) => {
                const val = e.target.value
                setAdvancedSearchFilters({
                  isRead: val === '' ? undefined : val === 'read'
                })
              }}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="">Alle</option>
              <option value="read">Gelesen</option>
              <option value="unread">Ungelesen</option>
            </select>
          </div>
          {isAdvancedSearchActive && (
            <button
              onClick={clearAdvancedSearch}
              className="rounded-lg bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
            >
              Zurücksetzen
            </button>
          )}
        </div>
      )}

      {/* Advanced search result count */}
      {isAdvancedSearchActive && searchResultCount !== null && (
        <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          {searchResultCount} Ergebnis(se) gefunden
        </div>
      )}

      {/* AI search feedback */}
      {aiSearchMode && isAiSearching && (
        <div className="rounded-lg bg-purple-50 px-3 py-2 text-sm text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
          KI-Suche läuft...
        </div>
      )}
      {aiSearchMode && aiSearchResults && !isAiSearching && (
        <div className="rounded-lg bg-purple-50 px-3 py-2 text-sm text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
          {aiSearchResults.length} Ergebnis(se) gefunden
        </div>
      )}
      {aiSearchError && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          KI-Suche fehlgeschlagen: {aiSearchError}
        </div>
      )}

      {/* Classification feedback */}
      {classifyError && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          Klassifizierung fehlgeschlagen: {classifyError}
        </div>
      )}
      {classifyResult && !classifyError && (
        <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">
          {classifyResult}
        </div>
      )}
    </div>
  )
}
