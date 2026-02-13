import { useEmailStore } from '../stores/emailStore'

export default function SyncButton(): React.JSX.Element {
  const { isSyncing, syncMessage, syncAll } = useEmailStore()

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => syncAll()}
        disabled={isSyncing}
        className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
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
        {isSyncing ? 'Synchronisiere...' : 'Sync'}
      </button>
      {syncMessage && !isSyncing && (
        <span className="text-sm text-gray-500 dark:text-gray-400">{syncMessage}</span>
      )}
    </div>
  )
}
