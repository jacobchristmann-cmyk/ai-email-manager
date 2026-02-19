import { useState, useEffect, useRef } from 'react'
import { useEmailStore } from '../stores/emailStore'
import { useAccountStore } from '../stores/accountStore'

export default function SyncButton(): React.JSX.Element {
  const { isSyncing, syncMessage, syncProgress, syncAll, fullResync, selectedAccountId } = useEmailStore()
  const { accounts } = useAccountStore()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const progressPercent = syncProgress
    ? Math.round((syncProgress.current / syncProgress.total) * 100)
    : 0

  const handleFullResync = (): void => {
    setDropdownOpen(false)
    const accountId = selectedAccountId ?? accounts[0]?.id
    if (accountId) fullResync(accountId)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  return (
    <div className="flex items-center gap-2">
      {/* Split button */}
      <div ref={dropdownRef} className="relative flex">
        {/* Main sync button */}
        <button
          onClick={() => syncAll()}
          disabled={isSyncing}
          className="relative flex items-center gap-2 overflow-hidden rounded-l-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed"
        >
          {/* Progress bar fills button from left */}
          {isSyncing && syncProgress && (
            <div
              className="absolute inset-0 bg-blue-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          )}
          <span className="relative flex items-center gap-2">
            {isSyncing && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {isSyncing ? 'Synchronisiere...' : 'Sync'}
          </span>
        </button>

        {/* Dropdown arrow */}
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          disabled={isSyncing || accounts.length === 0}
          title="Weitere Sync-Optionen"
          className="flex items-center rounded-r-md border-l border-blue-500 bg-blue-600 px-2 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 8L1 3h10L6 8z" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {dropdownOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
            <button
              onClick={handleFullResync}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <span>Alle E-Mails neu abrufen</span>
            </button>
          </div>
        )}
      </div>

      {/* Status info */}
      {isSyncing && syncProgress && (
        <span className="max-w-[200px] truncate text-xs text-gray-500 dark:text-gray-400" title={syncProgress.mailbox}>
          {syncProgress.mailbox}
        </span>
      )}
      {syncMessage && !isSyncing && (
        <span className="text-sm text-gray-500 dark:text-gray-400">{syncMessage}</span>
      )}
    </div>
  )
}
