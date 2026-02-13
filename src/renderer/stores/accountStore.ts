import { create } from 'zustand'
import type { Account, AccountCreate } from '../../shared/types'

interface AccountState {
  accounts: Account[]
  isLoading: boolean
  error: string | null
  loadAccounts: () => Promise<void>
  addAccount: (data: AccountCreate) => Promise<boolean>
  deleteAccount: (id: string) => Promise<void>
  testConnection: (config: AccountCreate) => Promise<{ success: boolean; error?: string }>
}

export const useAccountStore = create<AccountState>((set) => ({
  accounts: [],
  isLoading: false,
  error: null,

  loadAccounts: async () => {
    set({ isLoading: true, error: null })
    const result = await window.electronAPI.accountList()
    if (result.success) {
      set({ accounts: result.data!, isLoading: false })
    } else {
      set({ error: result.error || 'Fehler beim Laden', isLoading: false })
    }
  },

  addAccount: async (data) => {
    set({ isLoading: true, error: null })
    const result = await window.electronAPI.accountAdd(data)
    if (result.success) {
      set((state) => ({
        accounts: [result.data!, ...state.accounts],
        isLoading: false
      }))
      return true
    } else {
      set({ error: result.error || 'Fehler beim Erstellen', isLoading: false })
      return false
    }
  },

  deleteAccount: async (id) => {
    const result = await window.electronAPI.accountDelete(id)
    if (result.success) {
      set((state) => ({
        accounts: state.accounts.filter((a) => a.id !== id)
      }))
    }
  },

  testConnection: async (config) => {
    const result = await window.electronAPI.accountTestConnection(config)
    if (result.success) {
      return { success: true }
    }
    return { success: false, error: result.error }
  }
}))
