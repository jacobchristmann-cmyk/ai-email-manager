import { create } from 'zustand'
import type { Email, EmailSend, SyncStatus } from '../../shared/types'

interface EmailState {
  emails: Email[]
  selectedEmailId: string | null
  isLoading: boolean
  isSyncing: boolean
  syncMessage: string | null
  unreadCount: number
  // Filter & search
  selectedAccountId: string | null
  searchQuery: string
  selectedCategoryId: string | null
  // Compose
  composeOpen: boolean
  composeData: Partial<EmailSend> | null
  isSending: boolean

  loadEmails: (accountId?: string) => Promise<void>
  selectEmail: (id: string | null) => Promise<void>
  markRead: (id: string) => void
  deleteEmail: (id: string) => Promise<void>
  syncAccount: (accountId: string) => Promise<void>
  syncAll: () => Promise<void>
  handleSyncStatus: (status: SyncStatus) => void
  // Filter & search
  setSelectedAccountId: (id: string | null) => void
  setSearchQuery: (query: string) => void
  setSelectedCategoryId: (id: string | null) => void
  filteredEmails: () => Email[]
  // Compose
  openCompose: (prefill?: Partial<EmailSend>) => void
  closeCompose: () => void
  sendEmail: (data: EmailSend) => Promise<boolean>
}

export const useEmailStore = create<EmailState>((set, get) => ({
  emails: [],
  selectedEmailId: null,
  isLoading: false,
  isSyncing: false,
  syncMessage: null,
  unreadCount: 0,
  selectedAccountId: null,
  searchQuery: '',
  selectedCategoryId: null,
  composeOpen: false,
  composeData: null,
  isSending: false,

  loadEmails: async (accountId?) => {
    set({ isLoading: true })
    const id = accountId ?? get().selectedAccountId ?? undefined
    const result = await window.electronAPI.emailList(id)
    if (result.success) {
      const emails = result.data!
      const unreadCount = emails.filter((e) => !e.isRead).length
      set({ emails, unreadCount, isLoading: false })
    } else {
      set({ isLoading: false })
    }
  },

  selectEmail: async (id) => {
    set({ selectedEmailId: id })
    if (id) {
      const email = get().emails.find((e) => e.id === id)
      if (email && !email.isRead) {
        await window.electronAPI.emailMarkRead(id)
        set((state) => ({
          emails: state.emails.map((e) => (e.id === id ? { ...e, isRead: true } : e)),
          unreadCount: Math.max(0, state.unreadCount - 1)
        }))
      }
    }
  },

  markRead: (id) => {
    window.electronAPI.emailMarkRead(id)
    set((state) => ({
      emails: state.emails.map((e) => (e.id === id ? { ...e, isRead: true } : e)),
      unreadCount: Math.max(0, state.unreadCount - 1)
    }))
  },

  deleteEmail: async (id) => {
    await window.electronAPI.emailDelete(id)
    set((state) => {
      const email = state.emails.find((e) => e.id === id)
      const wasUnread = email && !email.isRead
      return {
        emails: state.emails.filter((e) => e.id !== id),
        selectedEmailId: state.selectedEmailId === id ? null : state.selectedEmailId,
        unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
      }
    })
  },

  syncAccount: async (accountId) => {
    set({ isSyncing: true, syncMessage: 'Synchronisiere...' })
    await window.electronAPI.syncAccount(accountId)
  },

  syncAll: async () => {
    set({ isSyncing: true, syncMessage: 'Synchronisiere alle Konten...' })
    await window.electronAPI.syncAll()
  },

  handleSyncStatus: (status) => {
    if (status.status === 'syncing') {
      set({ isSyncing: true, syncMessage: status.message })
    } else {
      set({ isSyncing: false, syncMessage: status.message })
      // Reload emails after sync completes, respecting account filter
      const accountId = get().selectedAccountId ?? undefined
      get().loadEmails(accountId)
    }
  },

  // Filter & search
  setSelectedAccountId: (id) => {
    set({ selectedAccountId: id, selectedEmailId: null })
    get().loadEmails(id ?? undefined)
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query })
  },

  setSelectedCategoryId: (id) => {
    set({ selectedCategoryId: id })
  },

  filteredEmails: () => {
    const { emails, searchQuery, selectedCategoryId } = get()
    let filtered = emails

    if (selectedCategoryId) {
      filtered = filtered.filter((e) => e.categoryId === selectedCategoryId)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (e) =>
          e.subject.toLowerCase().includes(q) ||
          e.from.toLowerCase().includes(q) ||
          e.body.toLowerCase().includes(q)
      )
    }

    return filtered
  },

  // Compose
  openCompose: (prefill) => {
    set({ composeOpen: true, composeData: prefill || null })
  },

  closeCompose: () => {
    set({ composeOpen: false, composeData: null })
  },

  sendEmail: async (data) => {
    set({ isSending: true })
    const result = await window.electronAPI.emailSend(data)
    set({ isSending: false })
    if (result.success) {
      set({ composeOpen: false, composeData: null })
      return true
    }
    return false
  }
}))
