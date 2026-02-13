import type { Account } from '../../shared/types'

interface AccountCardProps {
  account: Account
  onDelete: (id: string) => void
}

const providerLabels: Record<string, string> = {
  gmail: 'Gmail',
  outlook: 'Outlook',
  imap: 'IMAP'
}

export default function AccountCard({ account, onDelete }: AccountCardProps): React.JSX.Element {
  const lastSync = account.lastSyncAt
    ? new Date(account.lastSyncAt).toLocaleString('de-DE')
    : 'Noch nie'

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{account.name}</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
              {providerLabels[account.provider] || account.provider}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{account.email}</p>
          <p className="mt-1 text-xs text-gray-400">Letzter Sync: {lastSync}</p>
        </div>
        <button
          onClick={() => onDelete(account.id)}
          className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
        >
          Löschen
        </button>
      </div>
    </div>
  )
}
