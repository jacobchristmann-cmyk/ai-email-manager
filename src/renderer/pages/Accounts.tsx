import { useEffect } from 'react'
import { useAccountStore } from '../stores/accountStore'
import AccountForm from '../components/AccountForm'
import AccountCard from '../components/AccountCard'

export default function Accounts(): React.JSX.Element {
  const { accounts, loadAccounts, deleteAccount } = useAccountStore()

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  return (
    <div className="flex h-full flex-col">
      <h1 className="mb-4 text-2xl font-bold">Accounts</h1>

      <div className="grid flex-1 grid-cols-2 gap-6">
        {/* Left: Account list */}
        <div className="space-y-3">
          {accounts.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              <p className="text-lg">Keine Konten konfiguriert</p>
              <p className="mt-2 text-sm">
                Füge rechts ein E-Mail-Konto hinzu, um loszulegen.
              </p>
            </div>
          ) : (
            accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onDelete={deleteAccount}
              />
            ))
          )}
        </div>

        {/* Right: Add form */}
        <div>
          <AccountForm />
        </div>
      </div>
    </div>
  )
}
