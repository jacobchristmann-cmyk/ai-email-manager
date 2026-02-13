import { useEmailStore } from '../stores/emailStore'
import EmailListItem from './EmailListItem'

export default function EmailList(): React.JSX.Element {
  const { selectedEmailId, selectEmail, isLoading, filteredEmails } = useEmailStore()
  const emails = filteredEmails()

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Lade E-Mails...
      </div>
    )
  }

  if (emails.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-gray-400">
        Keine E-Mails vorhanden. Klicke auf Sync, um E-Mails abzurufen.
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      {emails.map((email) => (
        <EmailListItem
          key={email.id}
          email={email}
          isSelected={email.id === selectedEmailId}
          onClick={() => selectEmail(email.id)}
        />
      ))}
    </div>
  )
}
