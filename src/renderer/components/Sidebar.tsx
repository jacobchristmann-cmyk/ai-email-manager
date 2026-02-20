import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import { useEmailStore } from '../stores/emailStore'
import { useAccountStore } from '../stores/accountStore'
import { useMailboxStore } from '../stores/mailboxStore'
import type { Mailbox } from '../../shared/types'
import Tooltip from './Tooltip'

interface ContextMenuState {
  x: number
  y: number
  accountId: string
  mailboxPath: string
}

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

export default function Sidebar(): React.JSX.Element {
  const appName = useAppStore((s) => s.appName)
  const selectedAccountId = useEmailStore((s) => s.selectedAccountId)
  const selectedMailbox = useEmailStore((s) => s.selectedMailbox)
  const setSelectedAccountId = useEmailStore((s) => s.setSelectedAccountId)
  const setSelectedMailbox = useEmailStore((s) => s.setSelectedMailbox)
  const accounts = useAccountStore((s) => s.accounts)
  const loadAccounts = useAccountStore((s) => s.loadAccounts)
  const mailboxes = useMailboxStore((s) => s.mailboxes)
  const markAllReadInMailbox = useEmailStore((s) => s.markAllReadInMailbox)
  const loadAllMailboxes = useMailboxStore((s) => s.loadAllMailboxes)
  const unreadCounts = useMailboxStore((s) => s.unreadCounts)
  const loadAllUnreadCounts = useMailboxStore((s) => s.loadAllUnreadCounts)
  const getOrderedMailboxes = useMailboxStore((s) => s.getOrderedMailboxes)
  const reorderMailbox = useMailboxStore((s) => s.reorderMailbox)
  const snoozedEmails = useEmailStore((s) => s.snoozedEmails)
  const loadSnoozedEmails = useEmailStore((s) => s.loadSnoozedEmails)
  const followUps = useEmailStore((s) => s.followUps)
  const loadFollowUps = useEmailStore((s) => s.loadFollowUps)
  const navigate = useNavigate()

  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({})
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  // Drag state
  const [dragAccountId, setDragAccountId] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  useEffect(() => {
    loadAccounts()
    loadSnoozedEmails()
    loadFollowUps()
  }, [loadAccounts, loadSnoozedEmails, loadFollowUps])

  useEffect(() => {
    if (accounts.length > 0) {
      loadAllMailboxes()
      loadAllUnreadCounts()
      const expanded: Record<string, boolean> = {}
      for (const a of accounts) {
        expanded[a.id] = true
      }
      setExpandedAccounts(expanded)
    }
  }, [accounts, loadAllMailboxes, loadAllUnreadCounts])

  // Reload unread counts when sync completes
  const syncUnsubRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    syncUnsubRef.current = window.electronAPI.onSyncStatus((status) => {
      if (status.status === 'done') {
        loadAllUnreadCounts()
      }
    })
    return () => {
      syncUnsubRef.current?.()
    }
  }, [loadAllUnreadCounts])

  const toggleAccount = (accountId: string): void => {
    setExpandedAccounts((prev) => ({ ...prev, [accountId]: !prev[accountId] }))
  }

  const handleMailboxClick = (accountId: string, mailboxPath: string): void => {
    if (selectedAccountId !== accountId) {
      setSelectedAccountId(accountId)
    }
    setSelectedMailbox(mailboxPath)
    navigate('/')
    // Refresh unread counts when selecting a mailbox
    useMailboxStore.getState().loadUnreadCounts(accountId)
  }

  const handleDragStart = (accountId: string, index: number): void => {
    setDragAccountId(accountId)
    setDragIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, accountId: string, index: number): void => {
    e.preventDefault()
    if (dragAccountId === accountId) {
      setDropIndex(index)
    }
  }

  const handleDrop = (accountId: string, index: number): void => {
    if (dragAccountId === accountId && dragIndex !== null && dragIndex !== index) {
      reorderMailbox(accountId, dragIndex, index)
    }
    setDragAccountId(null)
    setDragIndex(null)
    setDropIndex(null)
  }

  const handleContextMenu = (e: React.MouseEvent, accountId: string, mailboxPath: string): void => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, accountId, mailboxPath })
  }

  const handleMarkAllRead = async (): Promise<void> => {
    if (!contextMenu) return
    await markAllReadInMailbox(contextMenu.accountId, contextMenu.mailboxPath)
    useMailboxStore.getState().loadUnreadCounts(contextMenu.accountId)
    setContextMenu(null)
  }

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return
    const close = (): void => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  const handleDragEnd = (): void => {
    setDragAccountId(null)
    setDragIndex(null)
    setDropIndex(null)
  }

  const linkClass = (isActive: boolean): string =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
      isActive
        ? 'bg-gray-700 text-white'
        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
    }`

  return (
    <aside className="flex h-full flex-col overflow-hidden text-white" style={{ background: 'var(--sidebar-bg, #111827)' }}>
      <div className="p-4 text-lg font-bold tracking-tight">{appName}</div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2">
        {/* Prioritäts-Inbox (virtual mailbox) */}
        <Tooltip text="Wichtige E-Mails nach Priorität sortiert" placement="right">
          <button
            onClick={() => { setSelectedMailbox('__priority__'); navigate('/') }}
            className={linkClass(selectedMailbox === '__priority__') + ' w-full'}
          >
            <span className="text-sm">⭐</span>
            <span className="truncate">Prioritäts-Inbox</span>
          </button>
        </Tooltip>

        {/* Zurückgestellt (virtual mailbox) */}
        <Tooltip text="Zurückgestellte E-Mails — erscheinen automatisch wieder zum gesetzten Zeitpunkt" placement="right">
          <button
            onClick={() => { setSelectedMailbox('__snoozed__'); navigate('/') }}
            className={linkClass(selectedMailbox === '__snoozed__') + ' w-full'}
          >
            <span className="text-sm">🕐</span>
            <span className="truncate">Zurückgestellt</span>
            {snoozedEmails.length > 0 && (
              <span className="ml-auto rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium">
                {snoozedEmails.length}
              </span>
            )}
          </button>
        </Tooltip>

        {/* Nachfassen (follow-up virtual mailbox) */}
        <Tooltip text="E-Mails auf die du noch wartest — Erinnerung wenn keine Antwort kommt" placement="right">
          <button
            onClick={() => { setSelectedMailbox('__followup__'); navigate('/') }}
            className={linkClass(selectedMailbox === '__followup__') + ' w-full'}
          >
            <span className="text-sm">🔔</span>
            <span className="truncate">Nachfassen</span>
            {followUps.length > 0 && (
              <span className="ml-auto rounded-full bg-orange-500 px-2 py-0.5 text-xs font-medium">
                {followUps.length}
              </span>
            )}
          </button>
        </Tooltip>

        {accounts.map((account) => {
          const ordered = mailboxes[account.id] ? getOrderedMailboxes(account.id) : []
          return (
            <div key={account.id}>
              <Tooltip text={expandedAccounts[account.id] ? 'Konto einklappen' : 'Konto ausklappen'} placement="right">
              <button
                onClick={() => toggleAccount(account.id)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
              >
                <span className="text-xs">{expandedAccounts[account.id] ? '\u25BC' : '\u25B6'}</span>
                <span className="truncate">{account.name}</span>
              </button>
              </Tooltip>
              {expandedAccounts[account.id] && ordered.length > 0 && (
                <div className="ml-3 space-y-0.5">
                  {ordered.map((mb, idx) => {
                    const isActive = selectedAccountId === account.id && selectedMailbox === mb.path
                    const unread = unreadCounts[account.id]?.[mb.path] ?? 0
                    const isDragging = dragAccountId === account.id && dragIndex === idx
                    const isDropTarget = dragAccountId === account.id && dropIndex === idx
                    return (
                      <button
                        key={mb.path}
                        draggable
                        onDragStart={() => handleDragStart(account.id, idx)}
                        onDragOver={(e) => handleDragOver(e, account.id, idx)}
                        onDrop={() => handleDrop(account.id, idx)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleMailboxClick(account.id, mb.path)}
                        onContextMenu={(e) => handleContextMenu(e, account.id, mb.path)}
                        className={
                          linkClass(isActive) + ' w-full' +
                          (isDragging ? ' opacity-40' : '') +
                          (isDropTarget ? ' border-t-2 border-blue-500' : '')
                        }
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
          )
        })}

      </nav>
      <div className="p-4 text-xs text-gray-500">v1.0.0</div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[180px] rounded-lg border border-gray-600 bg-gray-800 py-1 shadow-xl"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={handleMarkAllRead}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
          >
            Alle als gelesen markieren
          </button>
        </div>
      )}
    </aside>
  )
}
