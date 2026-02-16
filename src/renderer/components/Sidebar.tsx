import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import { useEmailStore } from '../stores/emailStore'
import { useAccountStore } from '../stores/accountStore'
import { useMailboxStore } from '../stores/mailboxStore'
import type { Mailbox } from '../../shared/types'

function getMailboxIcon(mailbox: Mailbox): string {
  switch (mailbox.specialUse) {
    case '\\Inbox': return '\u{1F4E5}'
    case '\\Sent': return '\u{1F4E4}'
    case '\\Drafts': return '\u{1F4DD}'
    case '\\Trash': return '\u{1F5D1}'
    case '\\Junk': return '\u{26A0}\uFE0F'
    default: return '\u{1F4C1}'
  }
}

function getMailboxSortOrder(mailbox: Mailbox): number {
  switch (mailbox.specialUse) {
    case '\\Inbox': return 0
    case '\\Sent': return 1
    case '\\Drafts': return 2
    case '\\Junk': return 3
    case '\\Trash': return 4
    default: return 5
  }
}

export default function Sidebar(): React.JSX.Element {
  const appName = useAppStore((s) => s.appName)
  const emails = useEmailStore((s) => s.emails)
  const selectedAccountId = useEmailStore((s) => s.selectedAccountId)
  const selectedMailbox = useEmailStore((s) => s.selectedMailbox)
  const setSelectedAccountId = useEmailStore((s) => s.setSelectedAccountId)
  const setSelectedMailbox = useEmailStore((s) => s.setSelectedMailbox)
  const accounts = useAccountStore((s) => s.accounts)
  const loadAccounts = useAccountStore((s) => s.loadAccounts)
  const mailboxes = useMailboxStore((s) => s.mailboxes)
  const loadAllMailboxes = useMailboxStore((s) => s.loadAllMailboxes)
  const navigate = useNavigate()

  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    if (accounts.length > 0) {
      loadAllMailboxes()
      // Expand all accounts by default
      const expanded: Record<string, boolean> = {}
      for (const a of accounts) {
        expanded[a.id] = true
      }
      setExpandedAccounts(expanded)
    }
  }, [accounts, loadAllMailboxes])

  const toggleAccount = (accountId: string): void => {
    setExpandedAccounts((prev) => ({ ...prev, [accountId]: !prev[accountId] }))
  }

  const handleMailboxClick = (accountId: string, mailboxPath: string): void => {
    if (selectedAccountId !== accountId) {
      setSelectedAccountId(accountId)
    }
    setSelectedMailbox(mailboxPath)
    navigate('/')
  }

  const getUnreadForMailbox = (accountId: string, mailboxPath: string): number => {
    return emails.filter(
      (e) => e.accountId === accountId && e.mailbox === mailboxPath && !e.isRead
    ).length
  }

  const sortedMailboxes = (list: Mailbox[]): Mailbox[] => {
    return [...list].sort((a, b) => getMailboxSortOrder(a) - getMailboxSortOrder(b))
  }

  const linkClass = (isActive: boolean): string =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
      isActive
        ? 'bg-gray-700 text-white'
        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
    }`

  return (
    <aside className="flex w-56 flex-col bg-gray-900 text-white">
      <div className="p-4 text-lg font-bold tracking-tight">{appName}</div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-2">
        {accounts.map((account) => (
          <div key={account.id}>
            <button
              onClick={() => toggleAccount(account.id)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <span className="text-xs">{expandedAccounts[account.id] ? '\u25BC' : '\u25B6'}</span>
              <span className="truncate">{account.name}</span>
            </button>
            {expandedAccounts[account.id] && mailboxes[account.id] && (
              <div className="ml-3 space-y-0.5">
                {sortedMailboxes(mailboxes[account.id]).map((mb) => {
                  const isActive = selectedAccountId === account.id && selectedMailbox === mb.path
                  const unread = getUnreadForMailbox(account.id, mb.path)
                  return (
                    <button
                      key={mb.path}
                      onClick={() => handleMailboxClick(account.id, mb.path)}
                      className={linkClass(isActive) + ' w-full'}
                    >
                      <span className="text-sm">{getMailboxIcon(mb)}</span>
                      <span className="truncate">{mb.name}</span>
                      {unread > 0 && (
                        <span className="ml-auto rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium">
                          {unread}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}

        <div className="my-2 border-t border-gray-700" />

        <NavLink
          to="/accounts"
          className={({ isActive }) => linkClass(isActive)}
        >
          <span>{'\u{1F464}'}</span>
          <span>Accounts</span>
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) => linkClass(isActive)}
        >
          <span>{'\u2699\uFE0F'}</span>
          <span>Settings</span>
        </NavLink>
      </nav>
      <div className="p-4 text-xs text-gray-500">v1.0.0</div>
    </aside>
  )
}
