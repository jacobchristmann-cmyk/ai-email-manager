import { create } from 'zustand'
import type { Mailbox } from '../../shared/types'

interface MailboxState {
  mailboxes: Record<string, Mailbox[]>
  isLoading: boolean
  loadMailboxes: (accountId: string) => Promise<void>
  loadAllMailboxes: () => Promise<void>
}

export const useMailboxStore = create<MailboxState>((set, get) => ({
  mailboxes: {},
  isLoading: false,

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
    const accountsResult = await window.electronAPI.accountList()
    if (accountsResult.success && accountsResult.data) {
      for (const account of accountsResult.data) {
        await get().loadMailboxes(account.id)
      }
    }
    set({ isLoading: false })
  }
}))
