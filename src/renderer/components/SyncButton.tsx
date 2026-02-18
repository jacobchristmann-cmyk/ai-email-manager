import { useEmailStore } from '../stores/emailStore'
import { useAccountStore } from '../stores/accountStore'

export default function SyncButton(): React.JSX.Element {
  const { isSyncing, syncMessage, syncProgress, syncAll, fullResync, selectedAccountId } = useEmailStore()
  const { accounts } = useAccountStore()

  const handleFullResync = (): void => {
    const accountId = selectedAccountId ?? accounts[0]?.id
    if (accountId) {
      fullResync(accountId)
    }
  }

  const progressPercent = syncProgress
    ? Math.round((syncProgress.current / syncProgress.total) * 100)
    : 0

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => syncAll()}
        disabled={isSyncing}
        className="relative flex items-center gap-2 overflow-hidden rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed"
      >
        {/* Progress bar background */}
        {isSyncing && syncProgress && (
          <div
            className="absolute inset-0 bg-blue-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        )}
        <span className="relative flex items-center gap-2">
          {isSyncing && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {isSyncing && syncProgress
            ? `${syncProgress.current}/${syncProgress.total}`
            : isSyncing
              ? 'Synchronisiere...'
              : 'Sync'}
        </span>
      </button>
      <button
        onClick={handleFullResync}
        disabled={isSyncing || accounts.length === 0}
        title="Alle E-Mails neu abrufen (vollständiger Sync)"
        className="rounded-md border border-blue-600 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-900/30"
      >
        Alles abrufen
      </button>
      {isSyncing && syncProgress && (
        <span className="text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate" title={syncProgress.mailbox}>
          {syncProgress.mailbox}
        </span>
      )}
      {syncMessage && !isSyncing && (
        <span className="text-sm text-gray-500 dark:text-gray-400">{syncMessage}</span>
      )}
    </div>
  )
}
