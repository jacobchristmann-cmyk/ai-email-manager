import { create } from 'zustand'
import type { Mailbox } from '../../shared/types'

const SETTINGS_KEY = 'mailboxOrder'

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

interface MailboxState {
  mailboxes: Record<string, Mailbox[]>
  unreadCounts: Record<string, Record<string, number>>
  mailboxOrder: Record<string, string[]>
  isLoading: boolean
  loadMailboxes: (accountId: string) => Promise<void>
  loadAllMailboxes: () => Promise<void>
  loadUnreadCounts: (accountId: string) => Promise<void>
  loadAllUnreadCounts: () => Promise<void>
  loadMailboxOrder: () => Promise<void>
  reorderMailbox: (accountId: string, fromIndex: number, toIndex: number) => void
  getOrderedMailboxes: (accountId: string) => Mailbox[]
}

export const useMailboxStore = create<MailboxState>((set, get) => ({
  mailboxes: {},
  unreadCounts: {},
  mailboxOrder: {},
  isLoading: false,

  loadMailboxOrder: async () => {
    const result = await window.electronAPI.settingsGet()
    if (result.success && result.data && result.data[SETTINGS_KEY]) {
      try {
        const order = JSON.parse(result.data[SETTINGS_KEY]) as Record<string, string[]>
        set({ mailboxOrder: order })
      } catch {
        // ignore invalid JSON
      }
    }
  },

  loadMailboxes: async (accountId) => {
    const result = await window.electronAPI.mailboxList(accountId)
    if (result.success && result.data) {
      set((state) => ({
        mailboxes: { ...state.mailboxes, [accountId]: result.data! }
      }))
    }
  },

  loadAllMailboxes: async () => {
    set({ isLoading: true })
    await get().loadMailboxOrder()
    const accountsResult = await window.electronAPI.accountList()
    if (accountsResult.success && accountsResult.data) {
      for (const account of accountsResult.data) {
        await get().loadMailboxes(account.id)
      }
    }
    set({ isLoading: false })
  },

  loadUnreadCounts: async (accountId) => {
    const result = await window.electronAPI.mailboxUnreadCounts(accountId)
    if (result.success && result.data) {
      set((state) => ({
        unreadCounts: { ...state.unreadCounts, [accountId]: result.data! }
      }))
    }
  },

  loadAllUnreadCounts: async () => {
    const accountsResult = await window.electronAPI.accountList()
    if (accountsResult.success && accountsResult.data) {
      for (const account of accountsResult.data) {
        await get().loadUnreadCounts(account.id)
      }
    }
  },

  reorderMailbox: (accountId, fromIndex, toIndex) => {
    const ordered = get().getOrderedMailboxes(accountId).map((m) => m.path)
    const [moved] = ordered.splice(fromIndex, 1)
    ordered.splice(toIndex, 0, moved)
    const newOrder = { ...get().mailboxOrder, [accountId]: ordered }
    set({ mailboxOrder: newOrder })
    // Persist to DB via settings
    window.electronAPI.settingsSet({ [SETTINGS_KEY]: JSON.stringify(newOrder) })
  },

  getOrderedMailboxes: (accountId) => {
    const list = get().mailboxes[accountId] || []
    const order = get().mailboxOrder[accountId]
    if (!order) {
      return [...list].sort((a, b) => getMailboxSortOrder(a) - getMailboxSortOrder(b))
    }
    const byPath = new Map(list.map((m) => [m.path, m]))
    const result: Mailbox[] = []
    for (const path of order) {
      const mb = byPath.get(path)
      if (mb) {
        result.push(mb)
        byPath.delete(path)
      }
    }
    const remaining = [...byPath.values()].sort(
      (a, b) => getMailboxSortOrder(a) - getMailboxSortOrder(b)
    )
    return [...result, ...remaining]
  }
}))
